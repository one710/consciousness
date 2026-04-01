/**
 * Library entry point. Re-exports the public API for consumers that install
 * this package. The default entry (index.js) is the CLI/MCP server.
 */

export type { Embedding, EmbeddingProvider } from "./embeddings/provider.js";

export type {
  MemoryItem,
  SearchResult,
  SearchOptions,
  VectorStore,
} from "./vector/store.js";
export { MemoryVectorStore } from "./vector/memory.js";
export { FilesystemVectorStore } from "./vector/filesystem.js";
export { DTSStrategy } from "./vector/dts.js";

export { euclideanDistance, cosineSimilarity } from "./utils/distance.js";

export { createServer } from "./server.js";
