import { ChromaClient, Collection } from "chromadb";
import { EmbeddingProvider } from "../embeddings/provider.js";
import {
  MemoryItem,
  SearchOptions,
  SearchResult,
  VectorStore,
} from "./store.js";

export class ChromaVectorStore implements VectorStore {
  private collection: Collection | null = null;

  constructor(
    private embeddingProvider: EmbeddingProvider,
    private client: ChromaClient,
    private collectionName: string = "consciousness-memory",
  ) {}

  async initialize(): Promise<void> {
    this.collection = await this.client.getOrCreateCollection({
      name: this.collectionName,
      metadata: { "hnsw:space": "cosine" },
    });
  }

  async add(
    content: string,
    metadata: Record<string, any> = {},
  ): Promise<MemoryItem> {
    if (!this.collection) await this.initialize();

    const embedding = await this.embeddingProvider.getEmbedding(content);
    const id = Math.random().toString(36).substring(2, 11);

    const params: any = {
      ids: [id],
      embeddings: [embedding],
      documents: [content],
    };

    if (metadata && Object.keys(metadata).length > 0) {
      params.metadatas = [metadata];
    }

    await this.collection!.add(params);

    return {
      id,
      content,
      embedding,
      metadata,
    };
  }

  async search(
    query: string,
    options: SearchOptions = { method: "cosine", limit: 5 },
  ): Promise<SearchResult[]> {
    if (!this.collection) await this.initialize();

    const queryEmbedding = await this.embeddingProvider.getEmbedding(query);

    const results = await this.collection!.query({
      queryEmbeddings: [queryEmbedding],
      nResults: options.limit || 5,
      // We manually cast because the library types can be restrictive
      include: ["documents", "metadatas", "embeddings", "distances"] as any,
    });

    const searchResults: SearchResult[] = [];
    if (results.ids[0]) {
      for (let i = 0; i < results.ids[0].length; i++) {
        const item: MemoryItem = {
          id: results.ids[0][i],
          content: results.documents[0][i]!,
          embedding: results.embeddings
            ? (results.embeddings[0][i] as any)
            : [],
          metadata: results.metadatas[0][i] as Record<string, any>,
        };
        searchResults.push({
          item,
          score: results.distances ? (results.distances[0][i] ?? 0) : 0,
        });
      }
    }

    // Note: Chroma results are already sorted by its internal distance metric.
    return searchResults;
  }

  async forget(id: string): Promise<void> {
    if (!this.collection) await this.initialize();
    await this.collection!.delete({ ids: [id] });
  }

  async clear(): Promise<void> {
    if (!this.collection) await this.initialize();
    await this.client.deleteCollection({ name: this.collectionName });
    await this.initialize();
  }
}
