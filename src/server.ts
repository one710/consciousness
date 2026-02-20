#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { VectorStore } from "./vector/store.js";

export function createServer(
  name: string,
  version: string,
  vectorStore: VectorStore,
): McpServer {
  const server = new McpServer({ name, version });

  server.registerTool(
    "add_to_memory",
    {
      description: "Store information in vector memory",
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
      const item = await vectorStore.add(content, metadata);
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
    "search_memory",
    {
      description:
        "Retrieve information from vector memory using similarity or DTS search",
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
      const results = await vectorStore.search(query, { method, limit });

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
    "clear_memory",
    {
      description: "Clear all stored memories",
    },
    async () => {
      await vectorStore.initialize?.();
      await vectorStore.clear();
      return {
        content: [{ type: "text", text: "Memory store cleared successfully." }],
      };
    },
  );

  server.registerTool(
    "forget_memory",
    {
      description: "Remove a specific memory item by its ID",
      inputSchema: {
        id: z.string().describe("The unique ID of the memory item to forget"),
      },
    },
    async ({ id }) => {
      await vectorStore.initialize?.();
      await vectorStore.forget(id);
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
