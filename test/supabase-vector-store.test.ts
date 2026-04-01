import { expect } from "chai";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SupabaseVectorStore } from "../src/vector/supabase.js";
import { HFEmbeddingProvider } from "../src/embeddings/huggingface.js";

/** Default local Supabase CLI (`yarn supabase:start`). Use `yarn docker:test` for `docker-compose.test.yml` (port 54331). */
const DEFAULT_LOCAL_URL = "http://127.0.0.1:54321";
const DEFAULT_LOCAL_SERVICE_ROLE =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

async function supabaseReachable(
  url: string,
  key: string,
): Promise<
  { ok: true; client: SupabaseClient } | { ok: false; reason: string }
> {
  try {
    const client = createClient(url, key);
    const { error } = await client
      .from("consciousness_memory")
      .select("id")
      .limit(1);
    if (error) {
      return { ok: false, reason: error.message };
    }
    return { ok: true, client };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, reason: msg };
  }
}

describe("SupabaseVectorStore (integration)", function () {
  this.timeout(120000);

  const SESSION = "test-session-supabase";
  const OTHER = "other-session-supabase";

  let client: SupabaseClient | null = null;
  let store: SupabaseVectorStore | null = null;
  const provider = new HFEmbeddingProvider();

  before(async function () {
    if (process.env.SKIP_SUPABASE_TESTS === "1") {
      return;
    }
    const url =
      process.env.SUPABASE_URL ?? process.env.API_URL ?? DEFAULT_LOCAL_URL;
    const key =
      process.env.SUPABASE_SERVICE_ROLE_KEY ??
      process.env.SERVICE_ROLE_KEY ??
      DEFAULT_LOCAL_SERVICE_ROLE;

    const result = await supabaseReachable(url, key);
    if (!result.ok) {
      console.warn(
        `[SupabaseVectorStore] Skipping integration tests (${result.reason}). ` +
          `Start the stack with: yarn supabase:start`,
      );
      return;
    }
    client = result.client;
    store = new SupabaseVectorStore(provider, client);
  });

  beforeEach(async function () {
    if (!client || !store) {
      this.skip();
    }
    await store.clear(SESSION);
    await store.clear(OTHER);
  });

  it("should add and search items", async function () {
    const item = await store!.add(SESSION, "the cat", { tag: "test" });
    expect(item.content).to.equal("the cat");
    expect(item.sessionId).to.equal(SESSION);
    expect(item.embedding).to.have.lengthOf(384);

    const results = await store!.search(SESSION, "cat", {
      method: "cosine",
      limit: 1,
    });
    expect(results).to.have.lengthOf(1);
    expect(results[0].item.content).to.equal("the cat");
    expect(results[0].item.sessionId).to.equal(SESSION);
  });

  it("should respect limit", async function () {
    await store!.add(SESSION, "item 1");
    await store!.add(SESSION, "item 2");
    await store!.add(SESSION, "item 3");

    const results = await store!.search(SESSION, "query", {
      method: "cosine",
      limit: 2,
    });
    expect(results).to.have.lengthOf(2);
  });

  it("should forget an item", async function () {
    const item = await store!.add(SESSION, "to be forgotten");
    await store!.forget(SESSION, item.id);

    const results = await store!.search(SESSION, "forgotten", { limit: 10 });
    expect(results.some((r) => r.item.id === item.id)).to.be.false;
  });

  it("should clear items in session only", async function () {
    await store!.add(SESSION, "test item");
    await store!.add(OTHER, "other item");

    await store!.clear(SESSION);

    const scoped = await store!.search(SESSION, "test");
    expect(scoped).to.have.lengthOf(0);

    const other = await store!.search(OTHER, "other");
    expect(other).to.have.lengthOf(1);
    expect(other[0].item.content).to.equal("other item");
  });
});
