# @one710/consciousness

[![npm version](https://img.shields.io/npm/v/@one710/consciousness.svg)](https://www.npmjs.com/package/@one710/consciousness)
[![npm downloads](https://img.shields.io/npm/dm/@one710/consciousness.svg)](https://www.npmjs.com/package/@one710/consciousness)
[![Build Status](https://github.com/one710/consciousness/actions/workflows/publish.yml/badge.svg)](https://github.com/one710/consciousness/actions/workflows/publish.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A powerful, pluggable vector memory and Model Context Protocol (MCP) server for local semantic search and long-term memory.

## Features

- **MCP Integration**: Fully compatible with the Model Context Protocol.
- **Session-Scoped & Universal Memory**: Scoped tools isolate memory per `sessionId`; universal tools provide shared, session-independent storage.
- **Pluggable Architecture**: Easily swap embedding providers and vector stores.
- **Multiple Storage Backends**: Memory, Filesystem, ChromaDB, and Supabase (pgvector) via optional entry points.
- **Optional embedding entry points**: Hugging Face and AI SDK providers load only when imported from `@one710/consciousness/huggingface` or `@one710/consciousness/aisdk`.
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
import { createServer, MemoryVectorStore } from "@one710/consciousness";
import { HFEmbeddingProvider } from "@one710/consciousness/huggingface";

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

Uses `@huggingface/transformers` to generate embeddings locally on your CPU/GPU. Import the optional entry so the main package graph does not load Transformers until you use this provider:

```typescript
import { HFEmbeddingProvider } from "@one710/consciousness/huggingface";

const provider = new HFEmbeddingProvider();
```

#### AI SDK (Cloud/Remote)

Uses the Vercel AI SDK to connect to any supported provider (e.g., OpenAI, Anthropic, Google). Install `ai` and the provider package you use, then import:

```typescript
import { AISDKEmbeddingProvider } from "@one710/consciousness/aisdk";
import { openai } from "@ai-sdk/openai";

const provider = new AISDKEmbeddingProvider(
  openai.embedding("text-embedding-3-small"),
  1536, // Dimensions
);
```

### Vector Stores

#### Memory Store (In-memory)

```typescript
import { MemoryVectorStore } from "@one710/consciousness";

const store = new MemoryVectorStore(provider);
```

#### Filesystem Store (Local Persistence)

```typescript
import { FilesystemVectorStore } from "@one710/consciousness";

const store = new FilesystemVectorStore(provider, "./memory-data.json");
```

#### Chroma Store (Distributed/Managed)

Install `chromadb` alongside this package, then import the optional entry (the main package does not depend on Chroma):

```typescript
import { ChromaVectorStore } from "@one710/consciousness/chroma";
import { ChromaClient } from "chromadb";

const client = new ChromaClient();
const store = new ChromaVectorStore(provider, client, "my-collection");
```

#### Supabase Store (pgvector)

Install `@supabase/supabase-js`, apply the SQL under `supabase/migrations/` in your project. In that migration, set `embedding_dim` in the `DO` block to your provider’s width (e.g. `1536` for OpenAI `text-embedding-3-small`, `384` for the default MiniLM model) before the first run. Then:

```typescript
import { createClient } from "@supabase/supabase-js";
import { SupabaseVectorStore } from "@one710/consciousness/supabase";

const client = createClient(url, key);
const store = new SupabaseVectorStore(provider, client);
```

### Working with Sessions

All store operations require a `sessionId` to isolate memories:

```typescript
const sessionId = "user-123";

// Store a memory
await store.add(sessionId, "The capital of France is Paris");

// Search within the session
const results = await store.search(sessionId, "France", {
  method: "cosine",
  limit: 5,
});

// Forget a specific memory
await store.forget(sessionId, results[0].item.id);

// Clear all memories for the session
await store.clear(sessionId);
```

### MCP Tools

The MCP server exposes two sets of tools:

#### Scoped Tools (require `sessionId`)

| Tool                   | Description                                                     |
| ---------------------- | --------------------------------------------------------------- |
| `add_to_scoped_memory` | Store content scoped to a session                               |
| `search_scoped_memory` | Semantic search within a session (`cosine`, `euclidean`, `dts`) |
| `forget_scoped_memory` | Remove a specific memory by ID within a session                 |
| `clear_scoped_memory`  | Clear all memories for a session                                |

#### Universal Tools (no `sessionId` needed)

| Tool                      | Description                                                            |
| ------------------------- | ---------------------------------------------------------------------- |
| `add_to_universal_memory` | Store content in shared, session-independent memory                    |
| `search_universal_memory` | Semantic search across universal memory (`cosine`, `euclidean`, `dts`) |
| `forget_universal_memory` | Remove a specific memory by ID from universal memory                   |
| `clear_universal_memory`  | Clear all universal memories                                           |

## Local Supabase (Docker) and tests

The repo includes a Supabase CLI project under `supabase/`. With [Docker](https://docs.docker.com/get-docker/) running:

```bash
yarn supabase:start
```

That pulls images, applies `supabase/migrations/`, and exposes the API at `http://127.0.0.1:54321` (see `yarn supabase:status`). Stop with `yarn supabase:stop`.

Integration tests in `test/supabase-vector-store.test.ts` probe that URL with the default local **service role** JWT. If the stack is down, they skip with a short console warning so `yarn test` still finishes. To force-skip them (e.g. in CI without Docker):

```bash
SKIP_SUPABASE_TESTS=1 yarn test
```

To run only the Supabase tests:

```bash
yarn supabase:start   # once per machine session
yarn test:supabase
```

Override URL/key when needed: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (or `API_URL` / `SERVICE_ROLE_KEY` from `supabase status --output env`).

### Chroma + Supabase via Docker Compose (integration tests)

[`docker-compose.test.yml`](./docker-compose.test.yml) runs **Chroma** (port **8000**), **Postgres + pgvector** (host **54332**), **PostgREST**, and a tiny **nginx** gateway so `@supabase/supabase-js` keeps using the `/rest/v1/` paths it expects. Defaults avoid colliding with Supabase CLI on **54321** / **54322**; the API for tests is **`http://127.0.0.1:54331`**.

```bash
yarn docker:test:up    # wait until containers are healthy
yarn docker:test       # sets SUPABASE_URL=http://127.0.0.1:54331 and runs the full suite
yarn docker:test:down  # stop and remove volumes
```

`yarn test` expects **Chroma on localhost:8000** (e.g. `yarn docker:test:up` before a full run). `test/chroma.test.ts` uses `ChromaClient` defaults to match the compose mapping. `SKIP_SUPABASE_TESTS` still applies when no Supabase-compatible API is reachable on `SUPABASE_URL` (default `http://127.0.0.1:54321`).

## License

This project is licensed under the [MIT License](./LICENSE).
