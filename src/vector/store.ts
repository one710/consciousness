import { Embedding } from "../embeddings/provider.js";

export interface MemoryItem {
  id: string;
  sessionId: string;
  content: string;
  embedding: Embedding;
  metadata?: Record<string, any>;
  dtsIndex?: number[]; // Distance to sample index values
}

export interface SearchResult {
  item: MemoryItem;
  score: number; // Similarity or distance score
}

export interface SearchOptions {
  limit?: number;
  minScore?: number;
  method: "cosine" | "euclidean" | "dts";
}

export interface VectorStore {
  add(
    sessionId: string,
    content: string,
    metadata?: Record<string, any>,
  ): Promise<MemoryItem>;
  search(
    sessionId: string,
    query: string,
    options?: SearchOptions,
  ): Promise<SearchResult[]>;
  forget(sessionId: string, id: string): Promise<void>;
  clear(sessionId: string): Promise<void>;
  initialize?(): Promise<void>;
}
