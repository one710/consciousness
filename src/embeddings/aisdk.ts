import { embed, EmbeddingModel } from "ai";
import { Embedding, EmbeddingProvider } from "./provider.js";

export class AISDKEmbeddingProvider implements EmbeddingProvider {
  /**
   * @param model An AI SDK embedding model (e.g., openai.embedding('text-embedding-3-small'))
   * @param dimensions The expected dimension of the embeddings
   * @param providerOptions Optional provider-specific options (e.g., for openai dimensions)
   */
  constructor(
    private model: EmbeddingModel,
    private dimensions: number,
    private providerOptions?: Record<string, any>,
  ) {}

  async getEmbedding(text: string): Promise<Embedding> {
    const { embedding } = await embed({
      model: this.model,
      value: text,
      providerOptions: this.providerOptions,
    });
    return embedding;
  }

  getDimensions(): number {
    return this.dimensions;
  }
}
