import { pipeline } from "@huggingface/transformers";
import { Embedding, EmbeddingProvider } from "./provider.js";

export class HFEmbeddingProvider implements EmbeddingProvider {
  private extractor: any = null;

  constructor(
    private modelName: string = "Xenova/all-MiniLM-L6-v2",
    private dimensions: number = 384,
  ) {}

  private async getExtractor() {
    if (!this.extractor) {
      this.extractor = await pipeline("feature-extraction", this.modelName);
    }
    return this.extractor;
  }

  async getEmbedding(text: string): Promise<Embedding> {
    const extractor = await this.getExtractor();
    const output = await extractor(text, {
      pooling: "mean",
      normalize: true,
    });

    // Convert to standard array
    return Array.from(output.data);
  }

  getDimensions(): number {
    return this.dimensions;
  }
}
