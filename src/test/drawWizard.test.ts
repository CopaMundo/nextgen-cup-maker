import { describe, expect, it } from "vitest";
import { defaultDrawPotCount, placeDrawSeed } from "@/lib/drawWizard";
import { initContainersState, drawAll } from "@/lib/drawSession";
import { emptyContainerRules } from "@/lib/liveDraw";

describe("Draw wizard defaults and fixed positions", () => {
  it("chooses only equal, usable pots closest to the phase structure", () => {
    expect(defaultDrawPotCount(32, 8)).toBe(8);
    expect(defaultDrawPotCount(32)).toBe(4);
    expect(defaultDrawPotCount(6)).toBe(3);
    expect(defaultDrawPotCount(2)).toBe(2);
    expect(defaultDrawPotCount(7)).toBeNull();
  });
  const fixtures = Array.from({ length: 4 }, (_, i) => ({ id: `m${i}`, name: `Wedstrijd ${i + 1}`, capacity: 2, slotIds: [`h${i}`, `a${i}`], teamIds: [] as string[], matchSlots: [null, null] as (string | null)[], seedRanks: [null, null] as (number | null)[] }));
  const teams = Array.from({ length: 8 }, (_, i) => ({ id: `t${i}`, name: `Team ${i}` }));
  it("assigns explicit ranks and never relocates or duplicates another seed", () => {
    let result = placeDrawSeed(fixtures, "m0", 0, "t0");
    result = placeDrawSeed(result, "m3", 1, "t1");
    expect(result[0].seedRanks).toEqual([1, null]);
    expect(result[3].seedRanks).toEqual([null, 2]);
    expect(placeDrawSeed(result, "m1", 0, "t0")).toBe(result);
    const state = initContainersState({ fixtureKind: "knockout", phaseName: "KO", teams, pots: [], containers: result, mode: "random", rules: emptyContainerRules() });
    expect(state.remaining).not.toContain("t0");
    expect(state.remaining).not.toContain("t1");
    const complete = drawAll(state);
    expect(complete.finished).toBe(true);
    expect(complete.containers[0].matchSlots?.[0]).toBe("t0");
    expect(complete.containers[3].matchSlots?.[1]).toBe("t1");
    expect(new Set(complete.containers.flatMap(c => c.teamIds)).size).toBe(8);
  });
  it("clears only the chosen position and its rank", () => {
    const result = placeDrawSeed(placeDrawSeed(fixtures, "m0", 0, "t0"), "m0", 0, null);
    expect(result[0].matchSlots).toEqual([null, null]);
    expect(result[0].seedRanks).toEqual([null, null]);
    expect(result[0].teamIds).toEqual([]);
  });
});