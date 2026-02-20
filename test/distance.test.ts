import { expect } from "chai";
import { euclideanDistance, cosineSimilarity } from "../src/utils/distance.js";

describe("Distance Utilities", () => {
  describe("euclideanDistance", () => {
    it("should calculate distance correctly between simple vectors", () => {
      const a = [1, 0];
      const b = [0, 1];
      expect(euclideanDistance(a, b)).to.be.closeTo(1.4142, 0.0001);
    });

    it("should handle multi-dimensional vectors", () => {
      const a = [1, 2, 3, 4, 5];
      const b = [5, 4, 3, 2, 1];
      // dist = sqrt((1-5)^2 + (2-4)^2 + (3-3)^2 + (4-2)^2 + (5-1)^2)
      // dist = sqrt(16 + 4 + 0 + 4 + 16) = sqrt(40) = 6.3245
      expect(euclideanDistance(a, b)).to.be.closeTo(6.3245, 0.0001);
    });

    it("should handle negative coordinates", () => {
      const a = [-1, -1];
      const b = [1, 1];
      expect(euclideanDistance(a, b)).to.be.closeTo(2.8284, 0.0001);
    });

    it("should be zero for identical vectors", () => {
      const a = [1, 2, 3];
      expect(euclideanDistance(a, a)).to.equal(0);
    });

    it("should throw error for mismatched lengths", () => {
      expect(() => euclideanDistance([1], [1, 2])).to.throw(
        /Vector length mismatch/,
      );
    });
  });

  describe("cosineSimilarity", () => {
    it("should calculate similarity correctly", () => {
      const a = [1, 0];
      const b = [1, 0];
      expect(cosineSimilarity(a, b)).to.equal(1);

      const c = [0, 1];
      expect(cosineSimilarity(a, c)).to.equal(0); // Orthogonal

      const d = [-1, 0];
      expect(cosineSimilarity(a, d)).to.equal(-1); // Opposite
    });

    it("should handle multi-dimensional vectors", () => {
      const a = [1, 2, 3];
      const b = [2, 4, 6];
      expect(cosineSimilarity(a, b)).to.be.closeTo(1, 0.0001); // Same direction
    });

    it("should handle zero vectors by returning 0 (via isNaN check)", () => {
      const a = [0, 0];
      const b = [1, 1];
      expect(cosineSimilarity(a, b)).to.equal(0);
    });
  });
});
