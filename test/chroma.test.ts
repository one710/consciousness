import { expect } from "chai";
import { ChromaClient } from "chromadb";
import { ChromaVectorStore } from "../src/vector/chroma.js";
import { HFEmbeddingProvider } from "../src/embeddings/huggingface.js";

describe("ChromaVectorStore", function () {
  this.timeout(30000); // Higher timeout for loading the model
  const provider = new HFEmbeddingProvider();
  let client: ChromaClient;
  let store: ChromaVectorStore;
  const collectionName = "test-comp-collection";
  const SESSION = "test-session";

  beforeEach(async () => {
    client = new ChromaClient();
    store = new ChromaVectorStore(provider, client, collectionName);

    // Explicitly delete collection if it exists to start fresh
    try {
      await client.deleteCollection({ name: collectionName });
    } catch (e) {
      // Ignore
    }

    await store.initialize();
  });

  it("should be instantiable", () => {
    expect(store).to.be.an.instanceOf(ChromaVectorStore);
  });

  it("should add and search items", async () => {
    const item = await store.add(SESSION, "the cat", { tag: "test" });

    expect(item.content).to.equal("the cat");
    expect(item.sessionId).to.equal(SESSION);
    expect(item.embedding).to.have.lengthOf(384);

    const results = await store.search(SESSION, "cat", { method: "cosine", limit: 1 });
    expect(results).to.have.lengthOf(1);
    expect(results[0].item.content).to.equal("the cat");
    expect(results[0].item.sessionId).to.equal(SESSION);
  });

  it("should respect limit", async () => {
    await store.add(SESSION, "item 1");
    await store.add(SESSION, "item 2");
    await store.add(SESSION, "item 3");

    const results = await store.search(SESSION, "query", { method: "cosine", limit: 2 });
    expect(results).to.have.lengthOf(2);
  });

  it("should forget an item", async () => {
    const item = await store.add(SESSION, "to be forgotten");
    await store.forget(SESSION, item.id);

    const results = await store.search(SESSION, "forgotten");
    expect(results.some((r) => r.item.id === item.id)).to.be.false;
  });

  it("should clear items in session", async () => {
    await store.add(SESSION, "test item");
    await store.add("other-session", "other item");

    await store.clear(SESSION);

    const results = await store.search(SESSION, "test");
    expect(results).to.have.lengthOf(0);

    const otherResults = await store.search("other-session", "other");
    expect(otherResults).to.have.lengthOf(1);
    expect(otherResults[0].item.content).to.equal("other item");
  });
});
