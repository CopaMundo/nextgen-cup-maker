import { describe, expect, it } from "vitest";
import { needsGroupOverview, revealDuration, selectionDuration, stageSelection, sweepSpotlight, type DrawPresentation } from "@/lib/drawPresentation";

const picture: DrawPresentation = { revealAt: 1000, speed: 1, activePotId: "p1", selection: { targetId: "g1", startedAt: 1000 } };
describe("Shared draw presentation", () => {
  it("holds the selected group before transferring and clearing the team", () => {
    expect(stageSelection(picture, 1500)).toBe("hold");
    expect(stageSelection(picture, 1900)).toBe("transfer");
    expect(stageSelection(picture, 3100)).toBe("complete");
  });
  it("keeps projector and organizer on the same timestamp-driven sweep", () => {
    const sweep = { ...picture, sweep: { startedAt: 1000, optionIds: ["a", "c", "f"] } };
    expect(sweepSpotlight(sweep, 1000)).toBe("a");
    expect(sweepSpotlight(sweep, 1100)).toBe("c");
    expect(sweepSpotlight(sweep, 1200)).toBe("f");
    expect(sweepSpotlight(sweep, 1300)).toBe("a");
  });
  it("scales both reveal and placement timing together", () => {
    expect(revealDuration(1.5)).toBeCloseTo(1900 / 1.5);
    expect(selectionDuration(1.5)).toBe(1400);
  });
  it("preserves normal eight-group layouts and summarizes large capacities", () => {
    const groups = (count: number, capacity: number) => Array.from({ length: count }, (_, index) => ({ id: String(index), name: `Groep ${index}`, capacity, teamIds: [] }));
    expect(needsGroupOverview(groups(8, 4))).toBe(false);
    expect(needsGroupOverview(groups(8, 16))).toBe(true);
    expect(needsGroupOverview(groups(2, 64))).toBe(true);
  });
});