import { expect } from "chai";
import { DTSStrategy } from "../src/vector/dts.js";
import { euclideanDistance } from "../src/utils/distance.js";

describe("DTSStrategy", () => {
  it("should calculate index correctly against samples", () => {
    const samples = [
      [1, 0],
      [0, 1],
    ];
    const dts = new DTSStrategy(samples);
    const vector = [1, 1];

    const index = dts.calculateIndex(vector);

    // dist to [1,0] is sqrt(0^2 + 1^2) = 1
    // dist to [0,1] is sqrt(1^2 + 0^2) = 1
    expect(index).to.deep.equal([1, 1]);
  });

  it("should handle exact matches with sample vectors", () => {
    const samples = [
      [1, 2, 3],
      [4, 5, 6],
    ];
    const dts = new DTSStrategy(samples);
    const index = dts.calculateIndex([1, 2, 3]);
    expect(index[0]).to.equal(0);
    expect(index[1]).to.be.greaterThan(0);
  });

  it("should profile distance to multiple samples correctly", () => {
    const samples = [
      [0, 0, 0],
      [1, 1, 1],
      [2, 2, 2],
    ];
    const dts = new DTSStrategy(samples);
    const index = dts.calculateIndex([1, 1, 1]);
    expect(index).to.deep.equal([
      euclideanDistance([1, 1, 1], [0, 0, 0]),
      0,
      euclideanDistance([1, 1, 1], [2, 2, 2]),
    ]);
  });

  it("should return empty array if no samples are set", () => {
    const dts = new DTSStrategy();
    expect(dts.calculateIndex([1, 2, 3])).to.deep.equal([]);
  });

  it("should allow updating samples", () => {
    const dts = new DTSStrategy([[1, 0]]);
    dts.setSamples([[0, 1]]);
    expect(dts.calculateIndex([0, 1])).to.deep.equal([0]);
  });
});
