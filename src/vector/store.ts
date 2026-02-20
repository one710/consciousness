import { Embedding } from "../embeddings/provider.js";

export interface MemoryItem {
  id: string;
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
  add(content: string, metadata?: Record<string, any>): Promise<MemoryItem>;
  search(query: string, options?: SearchOptions): Promise<SearchResult[]>;
  forget(id: string): Promise<void>;
  clear(): Promise<void>;
  initialize?(): Promise<void>;
}
