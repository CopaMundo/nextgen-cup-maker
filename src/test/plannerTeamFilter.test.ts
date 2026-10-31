import { expect, it } from "vitest";
import { filterPlannerMatchesByTeam } from "@/lib/plannerTeamFilter";

it("shows only the selected team's home and away duels; All teams restores every duel", () => {
  const matches = [
    { id: "home", home_team_id: "antwerp", away_team_id: "brugge" },
    { id: "away", home_team_id: "gent", away_team_id: "antwerp" },
    { id: "other", home_team_id: "gent", away_team_id: "brugge" },
  ];
  expect(filterPlannerMatchesByTeam(matches, "antwerp").map(m => m.id)).toEqual(["home", "away"]);
  expect(filterPlannerMatchesByTeam(matches, "all")).toEqual(matches);
});