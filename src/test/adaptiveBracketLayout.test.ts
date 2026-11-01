import { describe, expect, it } from "vitest";
import { adaptiveBracketLayout } from "@/lib/adaptiveBracketLayout";

describe("independent converging bracket geometry", () => {
  it("reserves the first-round height for every active round without losing compact geometry", () => {
    for (let round = 0; round < 4; round++) {
      const layout = adaptiveBracketLayout([8, 4, 2, 1], round, 80, 10);
      expect(layout.containerHeight).toBe(710);
      expect(layout.tops[round][0]).toBe(0);
    }
    expect(adaptiveBracketLayout([8, 4, 2, 1], 3, 80, 10).height).toBe(80);
  });
  it("reserves each placement tree independently and handles an empty tree", () => {
    expect(adaptiveBracketLayout([16, 8, 4, 2, 1], 4, 80, 10).containerHeight).toBe(1430);
    expect(adaptiveBracketLayout([8, 4, 2, 1], 0, 80, 10).containerHeight).toBe(710);
    expect(adaptiveBracketLayout([], 0, 80, 10).containerHeight).toBe(0);
  });
  it("stacks the active round and centers later matches between both feeders", () => {
    const layout = adaptiveBracketLayout([8, 4, 2, 1], 1, 80, 10);
    expect(layout.height).toBe(350);
    expect(layout.tops[1]).toEqual([0, 90, 180, 270]);
    expect(layout.tops[2]).toEqual([45, 225]);
    expect(layout.tops[3]).toEqual([135]);
  });
  it("starts a placement bracket at its own first round after the main finale", () => {
    const main = adaptiveBracketLayout([16, 8, 4, 2, 1], 4, 80, 10);
    const placement = adaptiveBracketLayout([8, 4, 2, 1], 0, 80, 10);
    expect(main.height).toBe(80);
    expect(placement.active).toBe(0);
    expect(placement.height).toBe(710);
    expect(placement.tops[0]).toEqual([0, 90, 180, 270, 360, 450, 540, 630]);
  });
});