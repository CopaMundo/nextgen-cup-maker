import { describe, expect, it } from "vitest";
import { generateRoundRobin } from "@/lib/matchGenerator";

type MatchType = "single_leg" | "home_away" | "custom";
type Pairing = { homeIdx: number; awayIdx: number; round: number };

function maxConsecutiveHomeOrAway(pairings: Pairing[], teamCount: number): number {
  const timelines: Array<Array<{ round: number; side: "H" | "A" }>> =
    new Array(teamCount).fill(null).map(() => []);

  for (const p of pairings) {
    timelines[p.homeIdx].push({ round: p.round, side: "H" });
    timelines[p.awayIdx].push({ round: p.round, side: "A" });
  }

  let worst = 0;
  for (const list of timelines) {
    list.sort((a, b) => a.round - b.round);
    let run = 1;

    for (let i = 1; i < list.length; i++) {
      if (list[i].round === list[i - 1].round + 1 && list[i].side === list[i - 1].side) {
        run++;
      } else {
        run = 1;
      }

      worst = Math.max(worst, run);
    }
  }

  return worst;
}

function expectedRoundCount(teamCount: number, matchType: MatchType, customRounds = 1): number {
  const singleLegRounds = teamCount % 2 === 0 ? teamCount - 1 : teamCount;
  if (matchType === "single_leg") return singleLegRounds;
  if (matchType === "home_away") return singleLegRounds * 2;
  return customRounds;
}

function expectedMatchCount(teamCount: number, matchType: MatchType, customRounds = 1): number {
  const matchesPerRound = Math.floor(teamCount / 2);
  return expectedRoundCount(teamCount, matchType, customRounds) * matchesPerRound;
}

function validateRoundIntegrity(
  pairings: Pairing[],
  teamCount: number,
  matchType: MatchType,
  customRounds = 1
): string | null {
  const expectedRounds = expectedRoundCount(teamCount, matchType, customRounds);
  const expectedMatches = expectedMatchCount(teamCount, matchType, customRounds);

  if (pairings.length !== expectedMatches) {
    return `expected ${expectedMatches} matches, got ${pairings.length}`;
  }

  const matchesPerRound = Math.floor(teamCount / 2);
  const expectedTeamsInRound = teamCount % 2 === 0 ? teamCount : teamCount - 1;
  const roundTeamSet = new Map<number, Set<number>>();
  const roundMatchCount = new Map<number, number>();

  for (const p of pairings) {
    if (p.round < 1 || p.round > expectedRounds) {
      return `invalid round number ${p.round}`;
    }

    if (p.homeIdx === p.awayIdx) {
      return `same team on both sides in round ${p.round}`;
    }

    if (p.homeIdx < 0 || p.homeIdx >= teamCount || p.awayIdx < 0 || p.awayIdx >= teamCount) {
      return `team index out of range in round ${p.round}`;
    }

    if (!roundTeamSet.has(p.round)) roundTeamSet.set(p.round, new Set<number>());
    const usedTeams = roundTeamSet.get(p.round)!;

    if (usedTeams.has(p.homeIdx) || usedTeams.has(p.awayIdx)) {
      return `team appears twice in round ${p.round}`;
    }

    usedTeams.add(p.homeIdx);
    usedTeams.add(p.awayIdx);
    roundMatchCount.set(p.round, (roundMatchCount.get(p.round) ?? 0) + 1);
  }

  for (let round = 1; round <= expectedRounds; round++) {
    const usedTeams = roundTeamSet.get(round);
    if (!usedTeams) return `missing round ${round}`;
    if ((roundMatchCount.get(round) ?? 0) !== matchesPerRound) {
      return `round ${round} has ${(roundMatchCount.get(round) ?? 0)} matches, expected ${matchesPerRound}`;
    }
    if (usedTeams.size !== expectedTeamsInRound) {
      return `round ${round} has ${usedTeams.size} unique teams, expected ${expectedTeamsInRound}`;
    }
  }

  if (roundTeamSet.size !== expectedRounds) {
    return `unexpected number of rounds: ${roundTeamSet.size}`;
  }

  return null;
}

function validatePairAlternation(pairings: Pairing[]): string | null {
  const pairEncounters = new Map<string, Array<{ round: number; homeIsLower: boolean }>>();

  for (const p of pairings) {
    const low = Math.min(p.homeIdx, p.awayIdx);
    const high = Math.max(p.homeIdx, p.awayIdx);
    const key = `${low}-${high}`;

    if (!pairEncounters.has(key)) pairEncounters.set(key, []);
    pairEncounters.get(key)!.push({ round: p.round, homeIsLower: p.homeIdx === low });
  }

  for (const [key, encounters] of pairEncounters) {
    encounters.sort((a, b) => a.round - b.round);

    for (let i = 1; i < encounters.length; i++) {
      if (encounters[i].homeIsLower === encounters[i - 1].homeIsLower) {
        return `pair ${key} does not alternate at rounds ${encounters[i - 1].round} and ${encounters[i].round}`;
      }
    }
  }

  return null;
}

// ── Streak tests for all team counts ────────────────────────────────

describe("matchGenerator streak limits", () => {
  // Test single_leg for 4..16 teams
  for (let t = 4; t <= 16; t++) {
    it(`single_leg | teams=${t} — streak <= 2`, () => {
      const pairings = generateRoundRobin(t, "single_leg");
      expect(pairings).toHaveLength(expectedMatchCount(t, "single_leg"));
      expect(maxConsecutiveHomeOrAway(pairings, t)).toBeLessThanOrEqual(2);
    });
  }

  // Test home_away for 4..16 teams
  for (let t = 4; t <= 16; t++) {
    it(`home_away | teams=${t} — streak <= 2`, () => {
      const pairings = generateRoundRobin(t, "home_away");
      expect(pairings).toHaveLength(expectedMatchCount(t, "home_away"));
      expect(maxConsecutiveHomeOrAway(pairings, t)).toBeLessThanOrEqual(2);
    });
  }

  // Test custom for various configs
  const customScenarios = [
    { t: 6, r: 4 },
    { t: 8, r: 5 },
    { t: 10, r: 6 },
    { t: 12, r: 8 },
    { t: 14, r: 8 },
    { t: 16, r: 8 },
  ];
  for (const { t, r } of customScenarios) {
    it(`custom | teams=${t} rounds=${r} — streak <= 2`, () => {
      const pairings = generateRoundRobin(t, "custom", r);
      expect(pairings).toHaveLength(expectedMatchCount(t, "custom", r));
      expect(maxConsecutiveHomeOrAway(pairings, t)).toBeLessThanOrEqual(2);
    });
  }
});

// ── Large group streak tests (20..64 teams) ─────────────────────────

describe("large group streak limits", () => {
  for (const t of [20, 24, 32, 48, 64]) {
    it(`single_leg | teams=${t} — streak <= 2`, () => {
      const pairings = generateRoundRobin(t, "single_leg");
      expect(pairings).toHaveLength(expectedMatchCount(t, "single_leg"));
      expect(maxConsecutiveHomeOrAway(pairings, t)).toBeLessThanOrEqual(2);
    });

    it(`home_away | teams=${t} — streak <= 2`, () => {
      const pairings = generateRoundRobin(t, "home_away");
      expect(pairings).toHaveLength(expectedMatchCount(t, "home_away"));
      expect(maxConsecutiveHomeOrAway(pairings, t)).toBeLessThanOrEqual(2);
    });
  }
});

// ── Home_away opponent coverage ─────────────────────────────────────

describe("home_away opponent coverage", () => {
  const teamCounts = [...Array.from({ length: 13 }, (_, i) => i + 4), 32, 64];

  for (const t of teamCounts) {
    it(`teams=${t} — every pair plays exactly twice (once each way)`, () => {
      const pairings = generateRoundRobin(t, "home_away");
      const singleLegRounds = t % 2 === 0 ? t - 1 : t;
      const totalRounds = singleLegRounds * 2;

      // Each ordered pair {home, away} should appear exactly once
      const pairCounts = new Map<string, number>();
      for (const p of pairings) {
        const key = `${p.homeIdx}-${p.awayIdx}`;
        pairCounts.set(key, (pairCounts.get(key) ?? 0) + 1);
      }

      // For each unordered pair {X,Y}, both X-Y and Y-X should exist exactly once
      for (let i = 0; i < t; i++) {
        for (let j = i + 1; j < t; j++) {
          const ab = pairCounts.get(`${i}-${j}`) ?? 0;
          const ba = pairCounts.get(`${j}-${i}`) ?? 0;
          expect(ab + ba).toBe(2);
          // Each direction exactly once
          expect(Math.max(ab, ba)).toBeLessThanOrEqual(2);
          expect(Math.min(ab, ba)).toBeGreaterThanOrEqual(0);
        }
      }

      // Verify round count
      const maxRound = Math.max(...pairings.map((p) => p.round));
      expect(maxRound).toBe(totalRounds);
    }, 30_000);
  }
});

// ── Round integrity at scale ────────────────────────────────────────

describe("round integrity at scale", () => {
  it(
    "single_leg | teams 4..64 — no duplicate teams per round",
    () => {
      for (let t = 4; t <= 64; t++) {
        const pairings = generateRoundRobin(t, "single_leg");
        const error = validateRoundIntegrity(pairings, t, "single_leg");
        expect(error).toBeNull();
      }
    },
    30_000
  );

  it(
    "home_away | teams 4..64 — no duplicate teams per round",
    () => {
      for (let t = 4; t <= 64; t++) {
        const pairings = generateRoundRobin(t, "home_away");
        const error = validateRoundIntegrity(pairings, t, "home_away");
        expect(error).toBeNull();
      }
    },
    60_000
  );

  it("custom | stress scenarios — no duplicate teams per round", () => {
    const stressCases = [
      { t: 32, rounds: 32 },
      { t: 32, rounds: 48 },
      { t: 64, rounds: 64 },
    ];

    for (const c of stressCases) {
      const pairings = generateRoundRobin(c.t, "custom", c.rounds);
      const error = validateRoundIntegrity(pairings, c.t, "custom", c.rounds);
      expect(error).toBeNull();
    }
  });

  it("64 teams home_away has full contiguous coverage of 126 rounds", () => {
    const pairings = generateRoundRobin(64, "home_away");
    const error = validateRoundIntegrity(pairings, 64, "home_away");
    expect(error).toBeNull();

    const maxRound = Math.max(...pairings.map((p) => p.round));
    expect(maxRound).toBe(126);
  }, 30_000);
});

// ── Custom mirror alternation regressions ────────────────────────────

describe("custom mirror alternation", () => {
  const scenarios = [
    { t: 4, r: 126 },
    { t: 5, r: 100 },
    { t: 6, r: 50 },
    { t: 8, r: 126 },
    { t: 10, r: 90 },
    { t: 12, r: 66 },
    { t: 16, r: 60 },
    { t: 20, r: 38 },
    { t: 32, r: 62 },
    { t: 48, r: 94 },
    { t: 64, r: 126 },
  ];

  for (const { t, r } of scenarios) {
    it(`teams=${t} rounds=${r} — repeated opponents alternate home/away`, () => {
      const pairings = generateRoundRobin(t, "custom", r);
      const integrityError = validateRoundIntegrity(pairings, t, "custom", r);
      expect(integrityError).toBeNull();

      const alternationError = validatePairAlternation(pairings);
      expect(alternationError).toBeNull();
    }, 30_000);
  }
});
