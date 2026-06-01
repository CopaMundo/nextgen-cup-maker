import { describe, it, expect } from "vitest";
import {
  calculateGroupStandings,
  type StandingMatch,
  type StandingGroupTeam,
  type StandingGroup,
  type StandingPhase,
  type ScoringSystem,
} from "@/lib/standingsCalculator";

const PHASE_ID = "p1";
const GROUP_ID = "g1";

const makeSystem = (rules: string[]): ScoringSystem => ({
  id: "s1",
  points_win: 3,
  points_draw: 1,
  points_loss: 0,
  tiebreaker_rules: rules,
});

const phases: StandingPhase[] = [{ id: PHASE_ID, scoring_system_id: "s1" }];
const groups: StandingGroup[] = [{ id: GROUP_ID, phase_id: PHASE_ID, scoring_system_id: "s1" }];

const gt = (teamId: string): StandingGroupTeam => ({
  group_id: GROUP_ID,
  team_id: teamId,
  bonus_points: 0,
});

const m = (
  home: string,
  away: string,
  hs: number,
  as: number,
): StandingMatch => ({
  home_team_id: home,
  away_team_id: away,
  home_score: hs,
  away_score: as,
  is_played: true,
  group_id: GROUP_ID,
  phase_id: PHASE_ID,
  scoring_system_id: null,
});

describe("standingsCalculator — tiebreakers", () => {
  it("ranks by points first", () => {
    const system = makeSystem(["goal_difference", "goals_scored", "head_to_head"]);
    const teams = [gt("A"), gt("B"), gt("C")];
    const matches = [m("A", "B", 2, 0), m("B", "C", 1, 0), m("A", "C", 0, 0)];
    const rows = calculateGroupStandings(GROUP_ID, teams, matches, groups, phases, [system], null);
    expect(rows[0].teamId).toBe("A"); // 4 pts
    expect(rows[1].teamId).toBe("B"); // 3 pts
    expect(rows[2].teamId).toBe("C"); // 1 pt
  });

  it("breaks tie by goal_difference", () => {
    const system = makeSystem(["goal_difference", "goals_scored", "head_to_head"]);
    const teams = [gt("A"), gt("B"), gt("C")];
    // A and B both 3 pts; A has gd +3, B has gd +1
    const matches = [m("A", "C", 3, 0), m("B", "C", 1, 0), m("A", "B", 0, 0)];
    const rows = calculateGroupStandings(GROUP_ID, teams, matches, groups, phases, [system], null);
    expect(rows[0].teamId).toBe("A");
    expect(rows[1].teamId).toBe("B");
  });

  it("breaks tie by goals_scored when gd equal", () => {
    const system = makeSystem(["goal_difference", "goals_scored", "head_to_head"]);
    const teams = [gt("A"), gt("B"), gt("C")];
    // A: 3-2 vs C → gd +1, gf 3. B: 1-0 vs C → gd +1, gf 1. Tie A vs B.
    const matches = [m("A", "C", 3, 2), m("B", "C", 1, 0), m("A", "B", 1, 1)];
    const rows = calculateGroupStandings(GROUP_ID, teams, matches, groups, phases, [system], null);
    expect(rows[0].teamId).toBe("A");
    expect(rows[1].teamId).toBe("B");
  });

  it("breaks tie by head_to_head (onderling resultaat)", () => {
    const system = makeSystem(["head_to_head", "goal_difference", "goals_scored"]);
    const teams = [gt("A"), gt("B"), gt("C")];
    // A beat B directly; both equal points & gd otherwise
    const matches = [
      m("A", "B", 1, 0), // A wins direct
      m("A", "C", 1, 2), // A loses to C
      m("B", "C", 2, 1), // B beats C
    ];
    // A: 3pts (W vs B, L vs C), B: 3pts (L vs A, W vs C), C: 3pts (W vs A, L vs B)
    // All tied on 3 points. H2H mini-table: each beats one, loses to one → still tied on h2h pts
    // Then h2h gd: A: +1-1=0, B: +1-1=0, C: +1-1=0. h2h gf: A:2 B:2 C:3 → C wins h2h gf? Actually:
    // Recompute h2h-only matches: all three matches involve all three teams.
    // h2h gf: A=1+1=2, B=0+2=2, C=2+1=3 → so C ranks first by h2h gf
    const rows = calculateGroupStandings(GROUP_ID, teams, matches, groups, phases, [system], null);
    expect(rows[0].teamId).toBe("C");
  });

  it("breaks tie by wins (aantal overwinningen)", () => {
    const system = makeSystem(["wins", "goal_difference"]);
    const teamsX: StandingGroupTeam[] = [
      { group_id: GROUP_ID, team_id: "A", bonus_points: 0 },
      { group_id: GROUP_ID, team_id: "B", bonus_points: 3 }, // B: 3 pts, 0 wins. A: 3pts 1 win. Tied on points.
    ];
    const matchesX = [m("A", "B", 2, 1)]; // A: 3pts 1 win, B: 0pts + bonus 3 = 3pts
    const rowsX = calculateGroupStandings(
      GROUP_ID, teamsX, matchesX, groups, phases, [system], null,
    );
    expect(rowsX[0].teamId).toBe("A"); // more wins
    expect(rowsX[1].teamId).toBe("B");
  });

  it("falls through multiple tiebreaker rules in order", () => {
    const system = makeSystem(["goal_difference", "goals_scored", "head_to_head"]);
    const teams2 = [gt("A"), gt("B"), gt("C"), gt("D")];
    const matches3 = [m("A", "C", 2, 0), m("B", "D", 2, 0)];
    const rows = calculateGroupStandings(GROUP_ID, teams2, matches3, groups, phases, [system], null);
    // A and B tied on every metric incl. h2h (no h2h match) → stable order
    expect(rows[0].pts).toBe(3);
    expect(rows[1].pts).toBe(3);
    expect(rows[2].pts).toBe(0);
    expect(rows[3].pts).toBe(0);
  });

  it("applies bonus_points to total", () => {
    const system = makeSystem(["goal_difference"]);
    const teams: StandingGroupTeam[] = [
      { group_id: GROUP_ID, team_id: "A", bonus_points: 5 },
      { group_id: GROUP_ID, team_id: "B", bonus_points: 0 },
    ];
    const matches = [m("A", "B", 0, 1)]; // B wins normally
    const rows = calculateGroupStandings(GROUP_ID, teams, matches, groups, phases, [system], null);
    // A: 0 + 5 bonus = 5 pts; B: 3 pts → A first
    expect(rows[0].teamId).toBe("A");
    expect(rows[0].pts).toBe(5);
  });

  it("counts draws and losses correctly", () => {
    const system = makeSystem(["goal_difference"]);
    const teams = [gt("A"), gt("B"), gt("C")];
    const matches = [m("A", "B", 1, 1), m("A", "C", 0, 2), m("B", "C", 0, 0)];
    const rows = calculateGroupStandings(GROUP_ID, teams, matches, groups, phases, [system], null);
    const a = rows.find((r) => r.teamId === "A")!;
    const b = rows.find((r) => r.teamId === "B")!;
    const c = rows.find((r) => r.teamId === "C")!;
    expect(a).toMatchObject({ w: 0, d: 1, l: 1, gf: 1, ga: 3 });
    expect(b).toMatchObject({ w: 0, d: 2, l: 0, gf: 1, ga: 1 });
    expect(c).toMatchObject({ w: 1, d: 1, l: 0, gf: 2, ga: 0 });
  });

  it("ignores unplayed matches", () => {
    const system = makeSystem(["goal_difference"]);
    const teams = [gt("A"), gt("B")];
    const matches: StandingMatch[] = [
      { ...m("A", "B", 5, 0), is_played: false },
    ];
    const rows = calculateGroupStandings(GROUP_ID, teams, matches, groups, phases, [system], null);
    expect(rows.every((r) => r.gp === 0)).toBe(true);
  });

  it("awards big_win points when margin >= threshold", () => {
    const system: ScoringSystem = {
      id: "s1",
      points_win: 3,
      points_draw: 1,
      points_loss: 0,
      points_big_win: 5,
      big_win_threshold: 3,
      tiebreaker_rules: ["goal_difference"],
    };
    const teams = [gt("A"), gt("B")];
    const matches = [m("A", "B", 5, 0)]; // diff 5 >= threshold 3
    const rows = calculateGroupStandings(GROUP_ID, teams, matches, groups, phases, [system], null);
    expect(rows[0].teamId).toBe("A");
    expect(rows[0].pts).toBe(5); // big win points
    expect(rows[1].pts).toBe(0);
  });

  it("awards normal win points when margin < big_win_threshold", () => {
    const system: ScoringSystem = {
      id: "s1",
      points_win: 3,
      points_draw: 1,
      points_loss: 0,
      points_big_win: 5,
      big_win_threshold: 3,
      tiebreaker_rules: ["goal_difference"],
    };
    const teams = [gt("A"), gt("B")];
    const matches = [m("A", "B", 2, 0)]; // diff 2 < threshold 3
    const rows = calculateGroupStandings(GROUP_ID, teams, matches, groups, phases, [system], null);
    expect(rows[0].pts).toBe(3); // normal win
  });

  it("awards draw_with_goals points for 1-1", () => {
    const system: ScoringSystem = {
      id: "s1",
      points_win: 3,
      points_draw: 1,
      points_loss: 0,
      points_draw_with_goals: 2,
      points_draw_no_goals: 0,
      tiebreaker_rules: ["goal_difference"],
    };
    const teams = [gt("A"), gt("B")];
    const matches = [m("A", "B", 1, 1)];
    const rows = calculateGroupStandings(GROUP_ID, teams, matches, groups, phases, [system], null);
    expect(rows[0].pts).toBe(2); // draw with goals
    expect(rows[1].pts).toBe(2);
  });

  it("awards draw_no_goals points for 0-0", () => {
    const system: ScoringSystem = {
      id: "s1",
      points_win: 3,
      points_draw: 1,
      points_loss: 0,
      points_draw_with_goals: 2,
      points_draw_no_goals: 0,
      tiebreaker_rules: ["goal_difference"],
    };
    const teams = [gt("A"), gt("B")];
    const matches = [m("A", "B", 0, 0)];
    const rows = calculateGroupStandings(GROUP_ID, teams, matches, groups, phases, [system], null);
    expect(rows[0].pts).toBe(0); // draw no goals
    expect(rows[1].pts).toBe(0);
  });

  it("awards overtime win/loss points when penalties present", () => {
    const system: ScoringSystem = {
      id: "s1",
      points_win: 3,
      points_draw: 1,
      points_loss: 0,
      points_win_overtime: 2,
      points_loss_overtime: 1,
      tiebreaker_rules: ["goal_difference"],
    };
    const teams = [gt("A"), gt("B")];
    const matches: StandingMatch[] = [{
      home_team_id: "A", away_team_id: "B",
      home_score: 1, away_score: 1,
      home_penalties: 3, away_penalties: 1,
      is_played: true, group_id: GROUP_ID, phase_id: PHASE_ID,
      scoring_system_id: null,
    }];
    const rows = calculateGroupStandings(GROUP_ID, teams, matches, groups, phases, [system], null);
    // Home wins via penalties: overtime win = 2 pts, away gets overtime loss = 1 pt
    const homeRow = rows.find(r => r.teamId === "A")!;
    const awayRow = rows.find(r => r.teamId === "B")!;
    expect(homeRow.pts).toBe(2);
    expect(awayRow.pts).toBe(1);
  });
});
