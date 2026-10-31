import { describe, expect, it } from "vitest";
import { sortPlannerMatchesByTeam } from "@/lib/plannerTeamSort";

describe("planner team sorting", () => {
  it("orders duels alphabetically by either team, keeping the planner order unchanged", () => {
    const matches = [
      { id: "z", home: "Zulte", away: "Gent" },
      { id: "b", home: "Brugge", away: "Antwerp" },
      { id: "a", home: "Antwerp", away: "Anderlecht" },
    ];
    expect(sortPlannerMatchesByTeam(matches, m => [m.home, m.away]).map(m => m.id)).toEqual(["a", "b", "z"]);
    expect(matches.map(m => m.id)).toEqual(["z", "b", "a"]);
  });
});