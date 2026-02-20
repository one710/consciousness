import fs from "fs/promises";
import path from "path";
import { MemoryItem } from "./store.js";
import { EmbeddingProvider } from "../embeddings/provider.js";
import { MemoryVectorStore } from "./memory.js";

export class FilesystemVectorStore extends MemoryVectorStore {
  constructor(
    embeddingProvider: EmbeddingProvider,
    private filePath: string,
  ) {
    super(embeddingProvider);
  }

  async initialize() {
    try {
      const data = await fs.readFile(this.filePath, "utf-8");
      this.items = JSON.parse(data);
      this.updateIndexSamples();
    } catch (error) {
      this.items = [];
      this.updateIndexSamples();
    }
  }

  private async save() {
    const dir = path.dirname(this.filePath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(this.filePath, JSON.stringify(this.items, null, 2));
  }

  async add(
    content: string,
    metadata: Record<string, any> = {},
  ): Promise<MemoryItem> {
    const item = await super.add(content, metadata);
    await this.save();
    return item;
  }

  async forget(id: string): Promise<void> {
    await super.forget(id);
    await this.save();
  }

  async clear(): Promise<void> {
    await super.clear();
    await this.save();
  }
}
