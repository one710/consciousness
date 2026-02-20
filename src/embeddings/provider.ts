export type Embedding = number[];

export interface EmbeddingProvider {
  getEmbedding(text: string): Promise<Embedding>;
  getDimensions(): number;
}
