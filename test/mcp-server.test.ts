import { expect } from "chai";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "../src/server.js";
import { MemoryVectorStore } from "../src/vector/memory.js";
import { HFEmbeddingProvider } from "../src/embeddings/huggingface.js";
import {
  CallToolResultSchema,
  CallToolResult,
} from "@modelcontextprotocol/sdk/types.js";

describe("MCP Server Integration", function () {
  this.timeout(30000); // Model loading time

  let serverClient: Client;
  let serverTransport: InMemoryTransport;
  let clientTransport: InMemoryTransport;
  let store: MemoryVectorStore;

  const SESSION = "test-session";

  beforeEach(async () => {
    // Setup Memory Store and Provider
    const provider = new HFEmbeddingProvider();
    store = new MemoryVectorStore(provider);

    // Setup Server
    const server = createServer("test-server", "1.0.0", store);
    [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    // Setup Client
    serverClient = new Client(
      { name: "test-client", version: "1.0.0" },
      { capabilities: {} },
    );

    // Link transport
    await Promise.all([
      server.connect(serverTransport),
      serverClient.connect(clientTransport),
    ]);
  });

  afterEach(async () => {
    await serverClient.close();
  });

  it("should list all available tools", async () => {
    const tools = await serverClient.listTools();
    const toolNames = tools.tools.map((t) => t.name);
    // Scoped tools
    expect(toolNames).to.include("add_to_scoped_memory");
    expect(toolNames).to.include("search_scoped_memory");
    expect(toolNames).to.include("forget_scoped_memory");
    expect(toolNames).to.include("clear_scoped_memory");
    // Universal tools
    expect(toolNames).to.include("add_to_universal_memory");
    expect(toolNames).to.include("search_universal_memory");
    expect(toolNames).to.include("forget_universal_memory");
    expect(toolNames).to.include("clear_universal_memory");
  });

  describe("Scoped memory tools", () => {
    it("should add and search memories semantically", async () => {
      (await serverClient.callTool(
        {
          name: "add_to_scoped_memory",
          arguments: {
            sessionId: SESSION,
            content: "The cat is sleeping on the mat",
            metadata: { category: "pets" },
          },
        },
        CallToolResultSchema,
      )) as CallToolResult;

      const result = (await serverClient.callTool(
        {
          name: "search_scoped_memory",
          arguments: {
            sessionId: SESSION,
            query: "feline animals",
            method: "cosine",
            limit: 1,
          },
        },
        CallToolResultSchema,
      )) as CallToolResult;

      const content = result.content[0];
      if (content.type !== "text") throw new Error("Expected text content");
      const data = JSON.parse(content.text);

      expect(data[0].content).to.equal("The cat is sleeping on the mat");
      expect(data[0].metadata.category).to.equal("pets");
    });

    it("should forget a memory by ID", async () => {
      const addResult = (await serverClient.callTool(
        {
          name: "add_to_scoped_memory",
          arguments: { sessionId: SESSION, content: "temporary memory" },
        },
        CallToolResultSchema,
      )) as CallToolResult;

      const addContent = addResult.content[0];
      if (addContent.type !== "text") throw new Error("Expected text content");
      const idMatch = addContent.text.match(/\(ID: (.*?)\)/);
      if (!idMatch) throw new Error("Could not find ID in response");
      const id = idMatch[1];

      await serverClient.callTool(
        {
          name: "forget_scoped_memory",
          arguments: { sessionId: SESSION, id },
        },
        CallToolResultSchema,
      );

      const searchResult = (await serverClient.callTool(
        {
          name: "search_scoped_memory",
          arguments: { sessionId: SESSION, query: "temporary" },
        },
        CallToolResultSchema,
      )) as CallToolResult;

      const finalContent = searchResult.content[0];
      if (finalContent.type !== "text")
        throw new Error("Expected text content");
      expect(finalContent.text).to.equal("No matching memories found.");
    });

    it("should clear the memory store", async () => {
      await serverClient.callTool(
        {
          name: "add_to_scoped_memory",
          arguments: { sessionId: SESSION, content: "memory 1" },
        },
        CallToolResultSchema,
      );

      await serverClient.callTool(
        {
          name: "clear_scoped_memory",
          arguments: { sessionId: SESSION },
        },
        CallToolResultSchema,
      );

      const result = (await serverClient.callTool(
        {
          name: "search_scoped_memory",
          arguments: { sessionId: SESSION, query: "memory" },
        },
        CallToolResultSchema,
      )) as CallToolResult;

      const resultContent = result.content[0];
      if (resultContent.type !== "text")
        throw new Error("Expected text content");
      expect(resultContent.text).to.equal("No matching memories found.");
    });
  });

  describe("Universal memory tools", () => {
    it("should add and search memories without sessionId", async () => {
      await serverClient.callTool(
        {
          name: "add_to_universal_memory",
          arguments: {
            content: "Shared knowledge about TypeScript",
            metadata: { topic: "programming" },
          },
        },
        CallToolResultSchema,
      );

      const result = (await serverClient.callTool(
        {
          name: "search_universal_memory",
          arguments: { query: "TypeScript", method: "cosine", limit: 1 },
        },
        CallToolResultSchema,
      )) as CallToolResult;

      const content = result.content[0];
      if (content.type !== "text") throw new Error("Expected text content");
      const data = JSON.parse(content.text);

      expect(data[0].content).to.equal("Shared knowledge about TypeScript");
      expect(data[0].metadata.topic).to.equal("programming");
    });

    it("should clear universal memories without affecting scoped ones", async () => {
      // Add to both universal and scoped
      await serverClient.callTool(
        {
          name: "add_to_universal_memory",
          arguments: { content: "universal fact" },
        },
        CallToolResultSchema,
      );
      await serverClient.callTool(
        {
          name: "add_to_scoped_memory",
          arguments: { sessionId: SESSION, content: "scoped fact" },
        },
        CallToolResultSchema,
      );

      // Clear universal
      await serverClient.callTool(
        { name: "clear_universal_memory" },
        CallToolResultSchema,
      );

      // Universal should be empty
      const uniResult = (await serverClient.callTool(
        {
          name: "search_universal_memory",
          arguments: { query: "fact" },
        },
        CallToolResultSchema,
      )) as CallToolResult;
      const uniContent = uniResult.content[0];
      if (uniContent.type !== "text") throw new Error("Expected text content");
      expect(uniContent.text).to.equal("No matching memories found.");

      // Scoped should still have its item
      const scopedResult = (await serverClient.callTool(
        {
          name: "search_scoped_memory",
          arguments: { sessionId: SESSION, query: "fact" },
        },
        CallToolResultSchema,
      )) as CallToolResult;
      const scopedContent = scopedResult.content[0];
      if (scopedContent.type !== "text")
        throw new Error("Expected text content");
      const data = JSON.parse(scopedContent.text);
      expect(data[0].content).to.equal("scoped fact");
    });
  });
});
