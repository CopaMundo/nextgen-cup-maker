import { describe, expect, it } from "vitest";
import { adaptiveBracketLayout, bracketSuccessorIndex } from "@/lib/adaptiveBracketLayout";

describe("independent converging bracket geometry", () => {
  it("keeps all 64 opening matches and centers successors in a 128-team tree", () => {
    const counts = [64, 32, 16, 8, 4, 2, 1];
    for (let active = 0; active < counts.length; active++) {
      const layout = adaptiveBracketLayout(counts, active, 80, 10);
      const last = counts[active] - 1;
      expect(layout.tops[active][last] + 80).toBe(layout.height);
      if (active + 1 < counts.length) {
        for (let i = 0; i < counts[active + 1]; i++) {
          expect(layout.tops[active + 1][i]).toBe((layout.tops[active][2 * i] + layout.tops[active][2 * i + 1]) / 2);
        }
      }
    }
  });
  it("follows match 20 into match 10 and back to its feeder pair", () => {
    expect(bracketSuccessorIndex(19, 64, 32)).toBe(9);
    expect(bracketSuccessorIndex(9, 32, 16)).toBe(4);
    expect(bracketSuccessorIndex(9, 32, 64)).toBe(18);
  });
  it("uses the active round height without reserving empty first-round space", () => {
    for (let round = 0; round < 4; round++) {
      const layout = adaptiveBracketLayout([8, 4, 2, 1], round, 80, 10);
      expect(layout.height).toBe([710, 350, 170, 80][round]);
      expect(layout.tops[round][0]).toBe(0);
    }
    expect(adaptiveBracketLayout([8, 4, 2, 1], 3, 80, 10).height).toBe(80);
  });
  it("sizes each placement tree independently and handles an empty tree", () => {
    expect(adaptiveBracketLayout([16, 8, 4, 2, 1], 4, 80, 10).height).toBe(80);
    expect(adaptiveBracketLayout([8, 4, 2, 1], 0, 80, 10).height).toBe(710);
    expect(adaptiveBracketLayout([], 0, 80, 10).height).toBe(0);
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