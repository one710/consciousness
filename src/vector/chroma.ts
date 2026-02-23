import {
  ChromaClient,
  Collection,
  EmbeddingFunction,
  registerEmbeddingFunction,
} from "chromadb";
import { EmbeddingProvider } from "../embeddings/provider.js";
import {
  MemoryItem,
  SearchOptions,
  SearchResult,
  VectorStore,
} from "./store.js";

class ChromaEmbeddingFunction implements EmbeddingFunction {
  public name = "consciousness-ef";

  constructor(private provider?: EmbeddingProvider) {}

  async generate(texts: string[]): Promise<number[][]> {
    if (!this.provider) {
      throw new Error(
        "EmbeddingProvider not initialized for ChromaEmbeddingFunction",
      );
    }
    return Promise.all(texts.map((text) => this.provider!.getEmbedding(text)));
  }

  getConfig() {
    return {};
  }

  static buildFromConfig(): EmbeddingFunction {
    return new ChromaEmbeddingFunction();
  }
}

// Register it to avoid "No embedding function found" warnings
try {
  registerEmbeddingFunction("consciousness-ef", ChromaEmbeddingFunction as any);
} catch (e) {
  // Already registered or other error
}

export class ChromaVectorStore implements VectorStore {
  private collection: Collection | null = null;

  constructor(
    private embeddingProvider: EmbeddingProvider,
    private client: ChromaClient,
    private collectionName: string = "consciousness-memory",
  ) {}

  async initialize(): Promise<void> {
    const ef = new ChromaEmbeddingFunction(this.embeddingProvider);
    this.collection = await this.client.getOrCreateCollection({
      name: this.collectionName,
      metadata: { "hnsw:space": "cosine" },
      embeddingFunction: ef,
    });
  }

  async add(
    sessionId: string,
    content: string,
    metadata: Record<string, any> = {},
  ): Promise<MemoryItem> {
    if (!this.collection) await this.initialize();

    const id = Math.random().toString(36).substring(2, 11);

    await this.collection!.add({
      ids: [id],
      documents: [content],
      metadatas: [{ ...metadata, sessionId }],
    });

    // We still need the embedding for the return value, so we'll fetch it from the collection or provider
    // fetching from provider is faster than a second roundtrip to Chroma if it's local
    const embedding = await this.embeddingProvider.getEmbedding(content);

    return {
      id,
      sessionId,
      content,
      embedding,
      metadata,
    };
  }

  async search(
    sessionId: string,
    query: string,
    options: SearchOptions = { method: "cosine", limit: 5 },
  ): Promise<SearchResult[]> {
    if (!this.collection) await this.initialize();

    const results = await this.collection!.query({
      queryTexts: [query],
      nResults: options.limit || 5,
      where: { sessionId },
      // We manually cast because the library types can be restrictive
      include: ["documents", "metadatas", "embeddings", "distances"] as any,
    });

    const searchResults: SearchResult[] = [];
    if (results.ids[0]) {
      for (let i = 0; i < results.ids[0].length; i++) {
        const chromaMetadata = results.metadatas[0][i] as Record<string, any>;
        // Strip sessionId from metadata returned to callers
        const { sessionId: _sid, ...userMetadata } = chromaMetadata || {};
        const item: MemoryItem = {
          id: results.ids[0][i],
          sessionId,
          content: results.documents[0][i]!,
          embedding: results.embeddings
            ? (results.embeddings[0][i] as any)
            : [],
          metadata: userMetadata,
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

  async forget(sessionId: string, id: string): Promise<void> {
    if (!this.collection) await this.initialize();
    await this.collection!.delete({ ids: [id] });
  }

  async clear(sessionId: string): Promise<void> {
    if (!this.collection) await this.initialize();
    // Delete only items belonging to this session
    await this.collection!.delete({ where: { sessionId } });
  }
}
