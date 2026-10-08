import { describe, expect, it } from "vitest";
import { calculateGroupLayout, revealDuration, selectionDuration, stageSelection, sweepSpotlight, type DrawPresentation } from "@/lib/drawPresentation";

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
  it("selects the requested named and compact layouts at their physical limits", () => {
    const groups = (count: number, capacity: number) => Array.from({ length: count }, (_, index) => ({ id: String(index), name: `Groep ${index}`, capacity, teamIds: [], slotIds: [] }));
    for (const [count, capacity, mode, columns] of [
      [8, 8, "B", 1], [12, 4, "B", 1], [6, 12, "A", 2],
      [4, 16, "A", 2], [2, 64, "C", 8], [16, 6, "C", 4],
      [6, 6, "A", 1], [4, 8, "A", 1], [2, 16, "A", 1],
      [2, 32, "A", 2], [12, 5, "B", 1],
      [12, 6, "C", 3], [8, 9, "C", 3], [6, 13, "C", 4],
      [4, 17, "C", 3], [1, 33, "C", 6],
    ] as const) {
      expect(calculateGroupLayout(groups(count, capacity))).toMatchObject({ mode, teamColumns: columns });
    }
    expect(calculateGroupLayout(groups(6, 12))).toMatchObject({ wingColumns: 1, wingRows: 3 });
    expect(calculateGroupLayout(groups(12, 4))).toMatchObject({ wingColumns: 2, wingRows: 3 });
    expect(calculateGroupLayout([])).toEqual({ mode: "A", wingColumns: 1, wingRows: 1, teamColumns: 1 });
    const mixed = groups(8, 4);
    mixed[3].capacity = 10;
    expect(calculateGroupLayout(mixed).mode).toBe("C");
  });
});