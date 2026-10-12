import { describe, expect, it } from "vitest";
import { buildContainerCtx, emptyContainerRules, solveContainers, validContainersFor } from "@/lib/liveDraw";

describe("Live group allocation bounds", () => {
  const groups = Array.from({ length: 2 }, (_, i) => ({ id: `g${i}`, name: `Group ${i}`, capacity: 3, slotIds: [], teamIds: [] as string[] }));
  const teams = Array.from({ length: 6 }, (_, i) => ({ id: `t${i}`, name: `Team ${i}` }));
  const pots = [{ id: "p0", name: "Pot 1", teamIds: ["t0", "t1", "t2"] }, { id: "p1", name: "Pot 2", teamIds: ["t3", "t4", "t5"] }];
  const rules = { ...emptyContainerRules(), potQuota: { "p0|g0": 2, "p0|g1": 2, "p1|g0": 2, "p1|g1": 2 }, potQuotaMin: { "p0|g0": 1, "p0|g1": 1, "p1|g0": 1, "p1|g1": 1 } };
  it("allows either group to receive the remainder during the live draw", () => {
    const ctx = buildContainerCtx(teams, pots, rules);
    const working = groups.map((g, i) => ({ ...g, teamIds: i === 0 ? ["t0"] : ["t1"] }));
    expect(validContainersFor("t2", ["t3", "t4", "t5"], working, ctx).sort()).toEqual(["g0", "g1"]);
  });
  it("respects exact manual cells and rejects impossible minimum totals", () => {
    const exact = { ...rules, potQuota: { ...rules.potQuota, "p0|g0": 1 }, potQuotaMin: { ...rules.potQuotaMin, "p0|g0": 1 } };
    const result = solveContainers(teams.map(t => t.id), groups, buildContainerCtx(teams, pots, exact));
    expect(result).not.toBeNull();
    expect(pots[0].teamIds.filter(id => result?.[id] === "g0")).toHaveLength(1);
    const impossible = { ...rules, potQuotaMin: { ...rules.potQuotaMin, "p0|g0": 2, "p1|g0": 2 } };
    expect(solveContainers(teams.map(t => t.id), groups, buildContainerCtx(teams, pots, impossible))).toBeNull();
  });
  it("spreads five same-country participants as 2/1/1/1", () => {
    const roster = Array.from({ length: 8 }, (_, i) => ({ id: `t${i}`, name: `Team ${i}`, country: i < 5 ? "Belgium" : "Netherlands" }));
    const containers = Array.from({ length: 4 }, (_, i) => ({ id: `g${i}`, name: `Group ${i}`, capacity: 2, slotIds: [], teamIds: [] as string[] }));
    const countryRules = { ...emptyContainerRules(), onePerPot: false, countryMaxDefault: 1, countryMax: { Belgium: 2 } };
    const result = solveContainers(roster.map(t => t.id), containers, buildContainerCtx(roster, [], countryRules));
    expect(result).not.toBeNull();
    expect(containers.map(g => roster.filter(t => t.country === "Belgium" && result?.[t.id] === g.id).length).sort()).toEqual([1, 1, 1, 2]);
  });
});