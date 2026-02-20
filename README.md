# @one710/consciousness

[![npm version](https://img.shields.io/npm/v/@one710/consciousness.svg)](https://www.npmjs.com/package/@one710/consciousness)
[![npm downloads](https://img.shields.io/npm/dm/@one710/consciousness.svg)](https://www.npmjs.com/package/@one710/consciousness)
[![Build Status](https://github.com/one710/consciousness/actions/workflows/publish.yml/badge.svg)](https://github.com/one710/consciousness/actions/workflows/publish.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A powerful, pluggable vector memory and Model Context Protocol (MCP) server for local semantic search and long-term memory.

## Features

- **MCP Integration**: Fully compatible with the Model Context Protocol.
- **Pluggable Architecture**: Easily swap embedding providers and vector stores.
- **Embedded Local Storage**: Supports Filesystem and Memory stores out of the box.
- **Semantic Search**: Use state-of-the-art embeddings for intelligent memory retrieval.
- **DTS Indexing**: Optimized search using Distance to Samples (DTS) logic.

## Quick Start (using npx)

You can run the consciousness MCP server directly without installation using `npx`:

```bash
npx @one710/consciousness
```

By default, this will start an MCP server named "consciousness" using a `FilesystemVectorStore` (persisted to `./memory_store.json`) and `HFEmbeddingProvider`.

## Installation

```bash
npm install @one710/consciousness
```

## Usage in Code

### Creating an MCP Server

```typescript
import { createServer } from "@one710/consciousness";
import { MemoryVectorStore } from "@one710/consciousness/vector/memory";
import { HFEmbeddingProvider } from "@one710/consciousness/embeddings/huggingface";

const provider = new HFEmbeddingProvider();
const store = new MemoryVectorStore(provider);
const server = createServer("my-server", "1.0.0", store);

// Connect to transport (e.g., Stdio)
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
const transport = new StdioServerTransport();
await server.connect(transport);
```

### Embedding Providers

#### Hugging Face (Local)

Uses `@huggingface/transformers` to generate embeddings locally on your CPU/GPU.

```typescript
import { HFEmbeddingProvider } from "@one710/consciousness/embeddings/huggingface";
const provider = new HFEmbeddingProvider();
```

#### AI SDK (Cloud/Remote)

Uses the Vercel AI SDK to connect to any supported provider (e.g., OpenAI, Anthropic, Google).

```typescript
import { AISDKEmbeddingProvider } from "@one710/consciousness/embeddings/aisdk";
import { openai } from "@ai-sdk/openai";

const provider = new AISDKEmbeddingProvider(
  openai.embedding("text-embedding-3-small"),
  1536, // Dimensions
);
```

### Vector Stores

#### Memory Store (In-memory)

```typescript
import { MemoryVectorStore } from "@one710/consciousness/vector/memory";
const store = new MemoryVectorStore(provider);
```

#### Filesystem Store (Local Persistence)

```typescript
import { FilesystemVectorStore } from "@one710/consciousness/vector/filesystem";
const store = new FilesystemVectorStore(provider, "./memory-data.json");
```

#### Chroma Store (Distributed/Managed)

```typescript
import { ChromaVectorStore } from "@one710/consciousness/vector/chroma";
import { ChromaClient } from "chromadb";

const client = new ChromaClient();
const store = new ChromaVectorStore(provider, client, "my-collection");
```

## License

This project is licensed under the [MIT License](./LICENSE).
