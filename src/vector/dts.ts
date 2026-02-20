import { Embedding } from "../embeddings/provider.js";
import { euclideanDistance } from "../utils/distance.js";

export class DTSStrategy {
  private samples: Embedding[] = [];

  constructor(samples?: Embedding[]) {
    if (samples) {
      this.samples = samples;
    }
  }

  /**
   * Set the reference sample vectors for indexing.
   */
  setSamples(samples: Embedding[]) {
    this.samples = samples;
  }

  getSamples(): Embedding[] {
    return this.samples;
  }

  /**
   * Calculate distances from a vector to all samples.
   */
  calculateIndex(vector: Embedding): number[] {
    if (this.samples.length === 0) return [];

    return this.samples.map((sample) => euclideanDistance(vector, sample));
  }
}
