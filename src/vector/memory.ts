import {
  MemoryItem,
  VectorStore,
  SearchResult,
  SearchOptions,
} from "./store.js";
import { EmbeddingProvider } from "../embeddings/provider.js";
import { DTSStrategy } from "./dts.js";
import { euclideanDistance, cosineSimilarity } from "../utils/distance.js";

export class MemoryVectorStore implements VectorStore {
  protected items: MemoryItem[] = [];
  protected dts: DTSStrategy;
  protected samplesInitialized = false;

  constructor(private embeddingProvider: EmbeddingProvider) {
    this.dts = new DTSStrategy();
  }

  protected updateIndexSamples() {
    if (this.items.length >= 5) {
      const samples = [...this.items]
        .sort(() => 0.5 - Math.random())
        .slice(0, 5)
        .map((item) => item.embedding);
      this.dts.setSamples(samples);
      this.samplesInitialized = true;

      for (const item of this.items) {
        item.dtsIndex = this.dts.calculateIndex(item.embedding);
      }
    } else if (this.items.length > 0) {
      const samples = this.items.map((item) => item.embedding);
      this.dts.setSamples(samples);
      this.samplesInitialized = false;
    }
  }

  async add(
    sessionId: string,
    content: string,
    metadata: Record<string, any> = {},
  ): Promise<MemoryItem> {
    const embedding = await this.embeddingProvider.getEmbedding(content);
    const id = Math.random().toString(36).substring(2, 11);

    const item: MemoryItem = {
      id,
      sessionId,
      content,
      embedding,
      metadata,
      dtsIndex: this.dts.calculateIndex(embedding),
    };

    this.items.push(item);

    if (this.items.length === 5) {
      this.updateIndexSamples();
    }

    return item;
  }

  async search(
    sessionId: string,
    query: string,
    options: SearchOptions = { method: "cosine", limit: 5 },
  ): Promise<SearchResult[]> {
    const queryEmbedding = await this.embeddingProvider.getEmbedding(query);
    const sessionItems = this.items.filter(
      (item) => item.sessionId === sessionId,
    );
    let results: SearchResult[] = [];

    if (options.method === "dts" && this.samplesInitialized) {
      const queryDtsIndex = this.dts.calculateIndex(queryEmbedding);
      results = sessionItems.map((item) => {
        if (!item.dtsIndex) return { item, score: Infinity };
        let profileDiff = 0;
        for (let i = 0; i < queryDtsIndex.length; i++) {
          const d = queryDtsIndex[i] - item.dtsIndex[i];
          profileDiff += d * d;
        }
        return { item, score: Math.sqrt(profileDiff) };
      });
      results.sort((a, b) => a.score - b.score);
    } else {
      results = sessionItems.map((item) => {
        let score = 0;
        if (
          options.method === "euclidean" ||
          (options.method === "dts" && !this.samplesInitialized)
        ) {
          score = euclideanDistance(queryEmbedding, item.embedding);
        } else {
          score = cosineSimilarity(queryEmbedding, item.embedding);
        }
        return { item, score };
      });

      if (options.method === "cosine") {
        results.sort((a, b) => b.score - a.score);
      } else {
        results.sort((a, b) => a.score - b.score);
      }
    }

    return results
      .filter(
        (r) =>
          options.minScore === undefined ||
          (options.method === "cosine"
            ? r.score >= options.minScore
            : r.score <= options.minScore),
      )
      .slice(0, options.limit || 5);
  }

  async clear(sessionId: string): Promise<void> {
    this.items = this.items.filter((item) => item.sessionId !== sessionId);
    if (this.items.length < 5) {
      this.samplesInitialized = false;
    }
  }

  async forget(sessionId: string, id: string): Promise<void> {
    this.items = this.items.filter(
      (item) => !(item.sessionId === sessionId && item.id === id),
    );
    if (this.items.length < 5) {
      this.samplesInitialized = false;
    }
  }
}
