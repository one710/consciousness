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

  it("should list available tools", async () => {
    const tools = await serverClient.listTools();
    const toolNames = tools.tools.map((t) => t.name);
    expect(toolNames).to.include("add_to_memory");
    expect(toolNames).to.include("search_memory");
    expect(toolNames).to.include("forget_memory");
    expect(toolNames).to.include("clear_memory");
  });

  it("should add and search memories semantically", async () => {
    // Add memory via tool
    (await serverClient.callTool(
      {
        name: "add_to_memory",
        arguments: {
          content: "The cat is sleeping on the mat",
          metadata: { category: "pets" },
        },
      },
      CallToolResultSchema,
    )) as CallToolResult;

    // Search via tool (semantic check: "feline" -> "cat")
    const result = (await serverClient.callTool(
      {
        name: "search_memory",
        arguments: {
          query: "feline animals",
          method: "cosine",
          limit: 1,
        },
      },
      CallToolResultSchema,
    )) as CallToolResult;

    const content = result.content[0];
    if (content.type !== "text") {
      throw new Error("Expected text content");
    }
    const text = content.text;
    const data = JSON.parse(text);

    expect(data[0].content).to.equal("The cat is sleeping on the mat");
    expect(data[0].metadata.category).to.equal("pets");
  });

  it("should forget a memory by ID", async () => {
    // Add memory
    const addResult = (await serverClient.callTool(
      {
        name: "add_to_memory",
        arguments: { content: "temporary memory" },
      },
      CallToolResultSchema,
    )) as CallToolResult;

    // Extract ID from response (using regex because of the formatted message)
    const addContent = addResult.content[0];
    if (addContent.type !== "text") {
      throw new Error("Expected text content");
    }
    const text = addContent.text;
    const idMatch = text.match(/\(ID: (.*?)\)/);
    if (!idMatch) {
      throw new Error("Could not find ID in response");
    }
    const id = idMatch[1];

    // Forget memory
    await serverClient.callTool(
      {
        name: "forget_memory",
        arguments: { id },
      },
      CallToolResultSchema,
    );

    // Verify it's gone
    const searchResult = (await serverClient.callTool(
      {
        name: "search_memory",
        arguments: { query: "temporary" },
      },
      CallToolResultSchema,
    )) as CallToolResult;

    const finalContent = searchResult.content[0];
    if (finalContent.type !== "text") {
      throw new Error("Expected text content");
    }

    expect(finalContent.text).to.equal("No matching memories found.");
  });

  it("should clear the memory store", async () => {
    await serverClient.callTool(
      {
        name: "add_to_memory",
        arguments: { content: "memory 1" },
      },
      CallToolResultSchema,
    );

    await serverClient.callTool({ name: "clear_memory" }, CallToolResultSchema);

    const result = (await serverClient.callTool(
      {
        name: "search_memory",
        arguments: { query: "memory" },
      },
      CallToolResultSchema,
    )) as CallToolResult;

    const resultContent = result.content[0];
    if (resultContent.type !== "text") {
      throw new Error("Expected text content");
    }

    expect(resultContent.text).to.equal("No matching memories found.");
  });
});
