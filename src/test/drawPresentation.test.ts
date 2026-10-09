import { describe, expect, it } from "vitest";
import { calculateGroupLayout, calculateWingDensity, drawOverviewPage, revealDuration, selectionDuration, stageSelection, sweepSpotlight, type DrawPresentation } from "@/lib/drawPresentation";

const picture: DrawPresentation = { revealAt: 1000, speed: 1, activePotId: "p1", selection: { targetId: "g1", startedAt: 1000 } };
describe("Shared draw presentation", () => {
  it("balances overview teams over two synchronized pages from 24 teams", () => {
    for (const count of [1, 23, 24, 28, 32, 48, 64, 128, 29]) {
      const ids = Array.from({ length: count }, (_, i) => String(i));
      const first = drawOverviewPage(ids, 0);
      const second = drawOverviewPage(ids, 5000);
      expect(first.pageCount).toBe(count >= 24 ? 2 : 1);
      if (count >= 24) {
        expect(Math.abs(first.teamIds.length - second.teamIds.length)).toBeLessThanOrEqual(1);
        expect([...first.teamIds, ...second.teamIds]).toEqual(ids);
        expect(drawOverviewPage(ids, 10000).teamIds).toEqual(first.teamIds);
      } else expect(second.teamIds).toEqual(ids);
    }
  });
  it("selects all five studio profiles from actual wing groups and internal slot rows", () => {
    const groups = (count: number, capacity: number) => Array.from({ length: count }, (_, index) => ({ id: String(index), name: `Groep ${index}`, capacity, teamIds: [], slotIds: [] }));
    for (const [count, capacity, expected] of [
      [2, 3, "royal"], [2, 4, "royal"], [2, 5, "royal"],
      [4, 4, "comfortable"], [2, 6, "comfortable"], [4, 8, "comfortable"],
      [4, 16, "comfortable"], [2, 32, "comfortable"], [8, 3, "comfortable"], [8, 4, "comfortable"], [8, 8, "comfortable"],
      [6, 4, "standard"], [6, 12, "standard"], [12, 4, "standard"], [12, 5, "standard"],
      [2, 64, "logo-only"], [16, 6, "logo-only"],
    ] as const) {
      const containers = groups(count, capacity);
      expect(calculateWingDensity(containers.slice(0, Math.ceil(count / 2)), calculateGroupLayout(containers))).toBe(expected);
    }
    const uneven = groups(5, 6);
    const layout = calculateGroupLayout(uneven);
    expect(calculateWingDensity(uneven.slice(0, 3), layout)).toBe("standard");
    expect(calculateWingDensity(uneven.slice(3), layout)).toBe("comfortable");
    const fiveSmall = groups(5, 4);
    expect(calculateWingDensity(fiveSmall.slice(0, 3), calculateGroupLayout(fiveSmall))).toBe("standard");
    expect(calculateWingDensity(fiveSmall.slice(3), calculateGroupLayout(fiveSmall))).toBe("comfortable");
    expect(calculateWingDensity([], calculateGroupLayout([]))).toBe("royal");
  });
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