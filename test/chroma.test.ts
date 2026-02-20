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
    const item = await store.add("the cat", { tag: "test" });

    expect(item.content).to.equal("the cat");
    expect(item.embedding).to.have.lengthOf(384);

    const results = await store.search("cat", { method: "cosine", limit: 1 });
    expect(results).to.have.lengthOf(1);
    expect(results[0].item.content).to.equal("the cat");
  });

  it("should respect limit", async () => {
    await store.add("item 1");
    await store.add("item 2");
    await store.add("item 3");

    const results = await store.search("query", { method: "cosine", limit: 2 });
    expect(results).to.have.lengthOf(2);
  });

  it("should forget an item", async () => {
    const item = await store.add("to be forgotten");
    await store.forget(item.id);

    const results = await store.search("forgotten");
    expect(results.some((r) => r.item.id === item.id)).to.be.false;
  });

  it("should clear all items", async () => {
    await store.add("test item");
    await store.clear();

    const results = await store.search("test");
    expect(results).to.have.lengthOf(0);
  });
});
