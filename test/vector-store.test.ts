import { expect } from "chai";
import fs from "fs/promises";
import { MemoryVectorStore } from "../src/vector/memory.js";
import { FilesystemVectorStore } from "../src/vector/filesystem.js";
import { HFEmbeddingProvider } from "../src/embeddings/huggingface.js";

describe("Vector Stores", function () {
  this.timeout(30000); // Higher timeout for loading the model
  const provider = new HFEmbeddingProvider();
  const SESSION = "test-session";

  describe("MemoryVectorStore", () => {
    let store: MemoryVectorStore;

    beforeEach(() => {
      store = new MemoryVectorStore(provider);
    });

    it("should add and search items", async () => {
      await store.add(SESSION, "the cat");
      await store.add(SESSION, "the dog");

      const results = await store.search(SESSION, "cat", {
        method: "cosine",
        limit: 1,
      });
      expect(results).to.have.lengthOf(1);
      expect(results[0].item.content).to.equal("the cat");
    });

    it("should sort results correctly by method", async () => {
      await store.add(SESSION, "A juicy red apple");
      await store.add(SESSION, "A golden retriever dog");
      await store.add(SESSION, "A pair of blue running shoes");

      // Cosine: Descending (higher is better)
      const cosineResults = await store.search(SESSION, "fruit", {
        method: "cosine",
      });
      expect(cosineResults[0].item.content).to.equal("A juicy red apple");
      expect(cosineResults[0].score).to.be.greaterThan(cosineResults[1].score);

      // Euclidean: Ascending (lower is better)
      const euclideanResults = await store.search(SESSION, "fruit", {
        method: "euclidean",
      });
      expect(euclideanResults[0].item.content).to.equal("A juicy red apple");
      expect(euclideanResults[0].score).to.be.lessThan(
        euclideanResults[1].score,
      );
    });

    it("should respect limit and minScore", async () => {
      await store.add(SESSION, "the cat");
      await store.add(SESSION, "the kitten");
      await store.add(SESSION, "completely unrelated text about cars");

      const results = await store.search(SESSION, "feline", {
        method: "cosine",
        limit: 2,
        minScore: 0.5,
      });
      expect(results).to.have.lengthOf(2);
      expect(results[0].item.content).to.match(/cat|kitten/);
    });

    it("should trigger DTS re-indexing after 5 items", async () => {
      // Initially samplesInitialized should be false
      expect((store as any).samplesInitialized).to.be.false;

      await store.add(SESSION, "item 1");
      await store.add(SESSION, "item 2");
      await store.add(SESSION, "item 3");
      await store.add(SESSION, "item 4");
      await store.add(SESSION, "item 5");

      // After 5 items, it should initialize samples
      expect((store as any).samplesInitialized).to.be.true;

      const results = await store.search(SESSION, "query", { method: "dts" });
      expect(results[0].item.dtsIndex).to.have.lengthOf(5);
    });

    it("should forget an item", async () => {
      const item = await store.add(SESSION, "to be forgotten");
      await store.forget(SESSION, item.id);
      const results = await store.search(SESSION, "forgotten");
      expect(results.some((r) => r.item.id === item.id)).to.be.false;
    });

    it("should clear items", async () => {
      await store.add(SESSION, "test");
      await store.clear(SESSION);
      const results = await store.search(SESSION, "test");
      expect(results).to.have.lengthOf(0);
    });

    it("should isolate memories by sessionId", async () => {
      await store.add("session-a", "Apples are red fruits");
      await store.add("session-b", "Bananas are yellow fruits");

      const resultsA = await store.search("session-a", "fruit", {
        method: "cosine",
      });
      expect(resultsA).to.have.lengthOf(1);
      expect(resultsA[0].item.content).to.equal("Apples are red fruits");
      expect(resultsA[0].item.sessionId).to.equal("session-a");

      const resultsB = await store.search("session-b", "fruit", {
        method: "cosine",
      });
      expect(resultsB).to.have.lengthOf(1);
      expect(resultsB[0].item.content).to.equal("Bananas are yellow fruits");
      expect(resultsB[0].item.sessionId).to.equal("session-b");
    });
  });

  describe("FilesystemVectorStore", () => {
    const testFile = "./test_suite_store.json";

    beforeEach(async () => {
      if (await fs.stat(testFile).catch(() => null)) {
        await fs.unlink(testFile);
      }
    });

    afterEach(async () => {
      if (await fs.stat(testFile).catch(() => null)) {
        await fs.unlink(testFile);
      }
    });

    it("should persist data to disk", async () => {
      const store1 = new FilesystemVectorStore(provider, testFile);
      await store1.add(SESSION, "persistent item");

      const store2 = new FilesystemVectorStore(provider, testFile);
      await store2.initialize();

      const results = await store2.search(SESSION, "persistent");
      expect(results).to.have.lengthOf(1);
      expect(results[0].item.content).to.equal("persistent item");
    });
  });
});
