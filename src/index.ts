#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { FilesystemVectorStore } from "./vector/filesystem.js";
import { HFEmbeddingProvider } from "./embeddings/huggingface.js";
import { createServer } from "./server.js";

(async function main() {
  const embeddingProvider = new HFEmbeddingProvider();
  const memoryFilePath = process.env.MEMORY_FILE_PATH || "./memory_store.json";
  const vectorStore = new FilesystemVectorStore(
    embeddingProvider,
    memoryFilePath,
  );
  const server = createServer("consciousness", "1.0.0", vectorStore);
  const transport = new StdioServerTransport();
  await server.connect(transport);
})();
