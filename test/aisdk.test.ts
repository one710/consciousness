import { expect } from "chai";
import { AISDKEmbeddingProvider } from "../src/embeddings/aisdk.js";

describe("AISDKEmbeddingProvider", () => {
  it("should correctly return dimensions", () => {
    const mockModel = {} as any;
    const provider = new AISDKEmbeddingProvider(mockModel, 512);
    expect(provider.getDimensions()).to.equal(512);
  });

  // In a real scenario, we would mock the 'embed' function from the 'ai' package.
  // However, since we are using ESM and 'ai' is an external dependency,
  // we will focus on structural verification here.
});
