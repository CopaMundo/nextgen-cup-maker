import { describe, expect, it } from "vitest";
import { matchDrawContainers, matchDrawPage } from "@/lib/matchDraw";
import { initContainersState, drawNext, confirmPending, undoLast, drawAll } from "@/lib/drawSession";
import { emptyContainerRules } from "@/lib/liveDraw";

const teams = Array.from({ length: 128 }, (_, i) => ({ id: `t${i}`, name: `Team ${i}` }));
function fixtures(count: number) {
  return Array.from({ length: count }, (_, i) => ({ id: `m${i}`, name: `Wedstrijd ${i + 1}`, matchNumber: i + 1, capacity: 2, teamIds: [], slotIds: [`s${i * 2}`, `s${i * 2 + 1}`], matchSlots: [null, null] }));
}
describe("Live encounter draw", () => {
  it("pairs successive random draws and undoes the exact slot", () => {
    let state = initContainersState({ fixtureKind: "single_match", phaseName: "Losse", mode: "random", teams: teams.slice(0, 4), pots: [], containers: fixtures(2), rules: emptyContainerRules() });
    for (const id of ["t0", "t1", "t2", "t3"]) state = confirmPending(drawNext(state, id));
    expect(state.containers.map(c => c.matchSlots)).toEqual([["t0", "t1"], ["t2", "t3"]]);
    expect(undoLast(state).containers[1].matchSlots).toEqual(["t2", null]);
  });
  it("alternates pots for each fixture even if another pot is requested", () => {
    const containers = fixtures(2);
    const pots = [{ id: "p1", name: "Pot 1", teamIds: ["t0", "t1"] }, { id: "p2", name: "Pot 2", teamIds: ["t2", "t3"] }];
    const state = initContainersState({ fixtureKind: "knockout", phaseName: "KO", mode: "pots", teams: teams.slice(0, 4), pots, containers, rules: emptyContainerRules() });
    const next = drawNext(state, "t0", "p2");
    expect(next.activePotId).toBe("p1");
    const second = drawNext(confirmPending(next), "t2", "p1");
    expect(second.activePotId).toBe("p2");
    const result = drawAll(confirmPending(second));
    expect(result.finished).toBe(true);
    expect(result.containers.every(c => pots[0].teamIds.includes(c.matchSlots?.[0] ?? "") && pots[1].teamIds.includes(c.matchSlots?.[1] ?? ""))).toBe(true);
  });
  it("keeps assigned seeds on either side and out of the bowl", () => {
    const containers = fixtures(2).map((c, i) => ({ ...c, teamIds: [`t${i}`], matchSlots: i === 0 ? ["t0", null] : [null, "t1"], seedRanks: i === 0 ? [1, null] : [null, 2] }));
    const state = initContainersState({ fixtureKind: "knockout", phaseName: "KO", mode: "random", teams: teams.slice(0, 4), pots: [], containers, rules: emptyContainerRules() });
    expect(state.remaining.sort()).toEqual(["t2", "t3"]);
    const result = drawAll(state);
    expect(result.containers[0].matchSlots?.[0]).toBe("t0");
    expect(result.containers[1].matchSlots?.[1]).toBe("t1");
  });
  it("preserves entry geometry and deduplicates return legs", () => {
    const slots = [{ id: "s1", group_id: "g", slot_code: "S1", sort_order: 0, team_id: null }, { id: "s2", group_id: "g", slot_code: "S2", sort_order: 1, team_id: "t0" }];
    const matches = [{ id: "m1", group_id: "g", home_slot_label: "S1", away_slot_label: "S2", round_number: 1, match_name: "Finale (Heen)" }, { id: "m2", group_id: "g", home_slot_label: "S2", away_slot_label: "S1", round_number: 1, match_name: "Finale (Terug)" }];
    expect(matchDrawContainers(slots, matches, true)).toHaveLength(1);
    expect(matchDrawContainers(slots, matches, true)[0].matchSlots).toEqual([null, "t0"]);
    expect(matchDrawContainers(slots, matches, true)[0].seedRanks).toEqual([null, null]);
  });
  it("draws all 128 teams without duplicates", () => {
    const state = drawAll(initContainersState({ fixtureKind: "knockout", phaseName: "KO", mode: "random", teams, pots: [], containers: fixtures(64), rules: emptyContainerRules() }));
    expect(state.finished).toBe(true);
    expect(new Set(state.containers.flatMap(c => c.teamIds)).size).toBe(128);
  });
  it("keeps 64-team brackets fully visible and 128-team segments on fixed sides", () => {
    expect(matchDrawPage(fixtures(32), "m20", false, 0).left).toHaveLength(16);
    expect(matchDrawPage(fixtures(32), "m20", false, 0).right).toHaveLength(16);
    for (let segment = 0; segment < 4; segment++) {
      const page = matchDrawPage(fixtures(64), `m${segment * 16}`, false, 0);
      expect(page.segment).toBe(segment);
      expect((segment < 2 ? page.left : page.right).map(c => c.matchNumber)).toEqual(Array.from({ length: 16 }, (_, i) => segment * 16 + i + 1));
      expect(segment < 2 ? page.right : page.left).toHaveLength(0);
      expect(matchDrawPage(fixtures(64), null, true, segment * 6500).segment).toBe(segment);
    }
  });
});