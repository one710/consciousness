#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { VectorStore } from "./vector/store.js";

const UNIVERSAL_SESSION_ID = "universal";

export function createServer(
  name: string,
  version: string,
  vectorStore: VectorStore,
): McpServer {
  const server = new McpServer({ name, version });

  // ---------------------------------------------------------------------------
  // Scoped tools (require sessionId)
  // ---------------------------------------------------------------------------

  server.registerTool(
    "add_to_scoped_memory",
    {
      description: "Store information in session-scoped vector memory",
      inputSchema: {
        sessionId: z
          .string()
          .describe("The session ID to scope this memory to"),
        content: z.string().describe("The text content to store"),
        metadata: z
          .record(z.string(), z.any())
          .optional()
          .describe("Optional metadata for the memory item"),
      },
    },
    async ({ sessionId, content, metadata }) => {
      await vectorStore.initialize?.();
      const item = await vectorStore.add(sessionId, content, metadata);
      return {
        content: [
          {
            type: "text",
            text: `Successfully added to memory (ID: ${item.id}). Contents: "${content}"`,
          },
        ],
      };
    },
  );

  server.registerTool(
    "search_scoped_memory",
    {
      description:
        "Retrieve information from session-scoped vector memory using similarity or DTS search",
      inputSchema: {
        sessionId: z.string().describe("The session ID to search within"),
        query: z.string().describe("The search query"),
        method: z
          .enum(["cosine", "euclidean", "dts"])
          .optional()
          .default("dts")
          .describe("Search method (default: dts)"),
        limit: z
          .number()
          .optional()
          .default(5)
          .describe("Maximum number of results to return"),
      },
    },
    async ({ sessionId, query, method, limit }) => {
      await vectorStore.initialize?.();
      const results = await vectorStore.search(sessionId, query, {
        method,
        limit,
      });

      if (results.length === 0) {
        return {
          content: [{ type: "text", text: "No matching memories found." }],
        };
      }

      const formattedResults = JSON.stringify(
        results.map((r) => ({
          content: r.item.content,
          score: r.score,
          metadata: r.item.metadata,
        })),
        null,
        2,
      );

      return {
        content: [{ type: "text", text: formattedResults }],
      };
    },
  );

  server.registerTool(
    "clear_scoped_memory",
    {
      description: "Clear all stored memories for a session",
      inputSchema: {
        sessionId: z.string().describe("The session ID to clear memories for"),
      },
    },
    async ({ sessionId }) => {
      await vectorStore.initialize?.();
      await vectorStore.clear(sessionId);
      return {
        content: [{ type: "text", text: "Memory store cleared successfully." }],
      };
    },
  );

  server.registerTool(
    "forget_scoped_memory",
    {
      description: "Remove a specific session-scoped memory item by its ID",
      inputSchema: {
        sessionId: z.string().describe("The session ID the memory belongs to"),
        id: z.string().describe("The unique ID of the memory item to forget"),
      },
    },
    async ({ sessionId, id }) => {
      await vectorStore.initialize?.();
      await vectorStore.forget(sessionId, id);
      return {
        content: [
          {
            type: "text",
            text: `Successfully forgotten memory with ID: ${id}`,
          },
        ],
      };
    },
  );

  // ---------------------------------------------------------------------------
  // Universal tools (use a fixed "universal" sessionId)
  // ---------------------------------------------------------------------------

  server.registerTool(
    "add_to_universal_memory",
    {
      description:
        "Store information in universal (session-independent) vector memory",
      inputSchema: {
        content: z.string().describe("The text content to store"),
        metadata: z
          .record(z.string(), z.any())
          .optional()
          .describe("Optional metadata for the memory item"),
      },
    },
    async ({ content, metadata }) => {
      await vectorStore.initialize?.();
      const item = await vectorStore.add(
        UNIVERSAL_SESSION_ID,
        content,
        metadata,
      );
      return {
        content: [
          {
            type: "text",
            text: `Successfully added to memory (ID: ${item.id}). Contents: "${content}"`,
          },
        ],
      };
    },
  );

  server.registerTool(
    "search_universal_memory",
    {
      description:
        "Retrieve information from universal (session-independent) vector memory using similarity or DTS search",
      inputSchema: {
        query: z.string().describe("The search query"),
        method: z
          .enum(["cosine", "euclidean", "dts"])
          .optional()
          .default("dts")
          .describe("Search method (default: dts)"),
        limit: z
          .number()
          .optional()
          .default(5)
          .describe("Maximum number of results to return"),
      },
    },
    async ({ query, method, limit }) => {
      await vectorStore.initialize?.();
      const results = await vectorStore.search(UNIVERSAL_SESSION_ID, query, {
        method,
        limit,
      });

      if (results.length === 0) {
        return {
          content: [{ type: "text", text: "No matching memories found." }],
        };
      }

      const formattedResults = JSON.stringify(
        results.map((r) => ({
          content: r.item.content,
          score: r.score,
          metadata: r.item.metadata,
        })),
        null,
        2,
      );

      return {
        content: [{ type: "text", text: formattedResults }],
      };
    },
  );

  server.registerTool(
    "clear_universal_memory",
    {
      description:
        "Clear all stored memories in universal (session-independent) memory",
    },
    async () => {
      await vectorStore.initialize?.();
      await vectorStore.clear(UNIVERSAL_SESSION_ID);
      return {
        content: [{ type: "text", text: "Memory store cleared successfully." }],
      };
    },
  );

  server.registerTool(
    "forget_universal_memory",
    {
      description:
        "Remove a specific memory item by its ID from universal (session-independent) memory",
      inputSchema: {
        id: z.string().describe("The unique ID of the memory item to forget"),
      },
    },
    async ({ id }) => {
      await vectorStore.initialize?.();
      await vectorStore.forget(UNIVERSAL_SESSION_ID, id);
      return {
        content: [
          {
            type: "text",
            text: `Successfully forgotten memory with ID: ${id}`,
          },
        ],
      };
    },
  );

  return server;
}
