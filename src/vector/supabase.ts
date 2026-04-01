import type { SupabaseClient } from "@supabase/supabase-js";
import { EmbeddingProvider } from "../embeddings/provider.js";
import {
  MemoryItem,
  SearchOptions,
  SearchResult,
  VectorStore,
} from "./store.js";

export interface SupabaseVectorStoreOptions {
  /** Table name; must match the migration (default `consciousness_memory`). */
  tableName?: string;
  /** RPC name; must match the migration (default `consciousness_memory_search`). */
  searchRpcName?: string;
}

type SearchRow = {
  id: string;
  session_id: string;
  content: string;
  metadata: Record<string, unknown> | null;
  score: number;
  embedding: string | number[];
};

function parseVectorColumn(value: string | number[]): number[] {
  if (Array.isArray(value)) {
    return value.map((n) => Number(n));
  }
  const s = value.trim();
  if (s.startsWith("[") && s.endsWith("]")) {
    return s
      .slice(1, -1)
      .split(",")
      .map((x) => Number(x.trim()));
  }
  return [];
}

/**
 * Vector store backed by Supabase + pgvector.
 *
 * Apply `supabase/migrations/*_consciousness_memory.sql` (or equivalent) in your
 * project. Set `embedding_dim` in that migration’s `DO` block to match
 * `embeddingProvider.getDimensions()`. DTS search uses cosine similarity (pgvector
 * has no DTS index).
 */
export class SupabaseVectorStore implements VectorStore {
  private readonly tableName: string;
  private readonly searchRpcName: string;

  constructor(
    private embeddingProvider: EmbeddingProvider,
    private client: SupabaseClient,
    options: SupabaseVectorStoreOptions = {},
  ) {
    this.tableName = options.tableName ?? "consciousness_memory";
    this.searchRpcName = options.searchRpcName ?? "consciousness_memory_search";
  }

  async add(
    sessionId: string,
    content: string,
    metadata: Record<string, any> = {},
  ): Promise<MemoryItem> {
    const embedding = await this.embeddingProvider.getEmbedding(content);
    const id = Math.random().toString(36).substring(2, 11);

    const { error } = await this.client.from(this.tableName).insert({
      id,
      session_id: sessionId,
      content,
      embedding,
      metadata,
    });

    if (error) {
      throw new Error(`SupabaseVectorStore.add: ${error.message}`);
    }

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
    const queryEmbedding = await this.embeddingProvider.getEmbedding(query);
    const limit = options.limit ?? 5;
    const metric = options.method === "euclidean" ? "euclidean" : "cosine";
    const fetchCount = Math.min(200, Math.max(limit * 20, Math.max(limit, 20)));

    const { data, error } = await this.client.rpc(this.searchRpcName, {
      p_query_embedding: queryEmbedding,
      p_session_id: sessionId,
      p_match_count: fetchCount,
      p_metric: metric,
    });

    if (error) {
      throw new Error(`SupabaseVectorStore.search: ${error.message}`);
    }

    const rows = (data ?? []) as SearchRow[];
    let results: SearchResult[] = rows.map((row) => {
      const meta = (row.metadata ?? {}) as Record<string, any>;
      return {
        item: {
          id: row.id,
          sessionId: row.session_id,
          content: row.content,
          embedding: parseVectorColumn(row.embedding),
          metadata: meta,
        },
        score: row.score,
      };
    });

    if (options.minScore !== undefined) {
      results = results.filter((r) =>
        metric === "cosine"
          ? r.score >= options.minScore!
          : r.score <= options.minScore!,
      );
    }

    if (metric === "cosine") {
      results.sort((a, b) => b.score - a.score);
    } else {
      results.sort((a, b) => a.score - b.score);
    }

    return results.slice(0, limit);
  }

  async forget(sessionId: string, id: string): Promise<void> {
    const { error } = await this.client
      .from(this.tableName)
      .delete()
      .eq("id", id)
      .eq("session_id", sessionId);

    if (error) {
      throw new Error(`SupabaseVectorStore.forget: ${error.message}`);
    }
  }

  async clear(sessionId: string): Promise<void> {
    const { error } = await this.client
      .from(this.tableName)
      .delete()
      .eq("session_id", sessionId);

    if (error) {
      throw new Error(`SupabaseVectorStore.clear: ${error.message}`);
    }
  }
}
