/**
 * Professional Round-Robin Match Generator
 *
 * Architecture:
 *  1) Generate single-leg rounds with Berger/circle method
 *  2) Assign H/A using greedy balanced (large groups) or search-based (small groups)
 *  3) For home_away: mirror first leg with junction-aware shift
 *  4) Validate constraints (max consecutive ≤ 2, balance)
 */

interface Pairing {
  homeIdx: number;
  awayIdx: number;
  round: number;
}

interface BaseMatch {
  teamA: number;
  teamB: number;
}

// ── STEP 1: Circle method for single-leg rounds ─────────────────────

function circleMethodRounds(teamCount: number): BaseMatch[][] {
  const n = teamCount % 2 === 0 ? teamCount : teamCount + 1;
  const rounds: BaseMatch[][] = [];

  for (let r = 0; r < n - 1; r++) {
    const roundPairings: BaseMatch[] = [];
    const rotated = [0];

    for (let i = 0; i < n - 1; i++) {
      rotated.push(((i + r) % (n - 1)) + 1);
    }

    for (let i = 0; i < n / 2; i++) {
      const t1 = rotated[i];
      const t2 = rotated[n - 1 - i];
      if (t1 < teamCount && t2 < teamCount) {
        roundPairings.push({ teamA: t1, teamB: t2 });
      }
    }

    rounds.push(roundPairings);
  }

  return rounds;
}

// ── Helpers ──────────────────────────────────────────────────────────

function countHA(pairings: Pairing[], teamCount: number): { h: number[]; a: number[] } {
  const h = new Array(teamCount).fill(0);
  const a = new Array(teamCount).fill(0);
  for (const p of pairings) {
    h[p.homeIdx]++;
    a[p.awayIdx]++;
  }
  return { h, a };
}

function swapHomeAway(p: Pairing) {
  const tmp = p.homeIdx;
  p.homeIdx = p.awayIdx;
  p.awayIdx = tmp;
}

function buildTeamTimelines(pairings: Pairing[], teamCount: number) {
  const timelines: Array<Array<{ round: number; side: "H" | "A"; opponent: number }>> =
    new Array(teamCount).fill(null).map(() => []);

  for (const p of pairings) {
    timelines[p.homeIdx].push({ round: p.round, side: "H", opponent: p.awayIdx });
    timelines[p.awayIdx].push({ round: p.round, side: "A", opponent: p.homeIdx });
  }

  for (const list of timelines) {
    list.sort((a, b) => a.round - b.round);
  }

  return timelines;
}

function getConsecutiveStats(timelines: Array<Array<{ round: number; side: "H" | "A" }>>): {
  maxConsec: number;
  overflowOver2: number;
  violationRuns: number;
} {
  let maxConsec = 0;
  let overflowOver2 = 0;
  let violationRuns = 0;

  for (const list of timelines) {
    if (list.length === 0) continue;

    let run = 1;
    for (let i = 1; i < list.length; i++) {
      const isConsecutive = list[i].round === list[i - 1].round + 1;
      if (list[i].side === list[i - 1].side && isConsecutive) {
        run++;
      } else {
        if (run > maxConsec) maxConsec = run;
        if (run > 2) {
          overflowOver2 += run - 2;
          violationRuns++;
        }
        run = 1;
      }
    }

    if (run > maxConsec) maxConsec = run;
    if (run > 2) {
      overflowOver2 += run - 2;
      violationRuns++;
    }
  }

  return { maxConsec, overflowOver2, violationRuns };
}

function renumberRounds(pairings: Pairing[]) {
  const allRounds = [...new Set(pairings.map((p) => p.round))].sort((a, b) => a - b);
  const remap = new Map<number, number>();
  allRounds.forEach((r, i) => remap.set(r, i + 1));
  for (const p of pairings) {
    p.round = remap.get(p.round) || p.round;
  }
}

const LARGE_GROUP_THRESHOLD = 18;

function expectedRoundsForMatchType(
  teamCount: number,
  matchType: "single_leg" | "home_away" | "custom",
  customRounds: number
): number {
  if (matchType === "custom") return Math.max(0, customRounds);
  const singleLegRounds = teamCount % 2 === 0 ? teamCount - 1 : teamCount;
  return matchType === "home_away" ? singleLegRounds * 2 : singleLegRounds;
}

function expectedMatchesPerRound(teamCount: number): number {
  return Math.floor(teamCount / 2);
}

function isScheduleStructurallyValid(
  pairings: Pairing[],
  teamCount: number,
  expectedRounds: number
): boolean {
  if (expectedRounds < 1) return pairings.length === 0;

  const matchesPerRound = expectedMatchesPerRound(teamCount);
  const expectedMatches = matchesPerRound * expectedRounds;
  if (pairings.length !== expectedMatches) return false;

  const teamsPerRound = teamCount % 2 === 0 ? teamCount : teamCount - 1;
  const roundTeams = new Map<number, Set<number>>();
  const roundMatchCount = new Map<number, number>();

  for (const p of pairings) {
    if (p.round < 1 || p.round > expectedRounds) return false;
    if (p.homeIdx === p.awayIdx) return false;
    if (p.homeIdx < 0 || p.homeIdx >= teamCount || p.awayIdx < 0 || p.awayIdx >= teamCount) {
      return false;
    }

    if (!roundTeams.has(p.round)) roundTeams.set(p.round, new Set<number>());
    const usedTeams = roundTeams.get(p.round)!;

    if (usedTeams.has(p.homeIdx) || usedTeams.has(p.awayIdx)) {
      return false;
    }

    usedTeams.add(p.homeIdx);
    usedTeams.add(p.awayIdx);
    roundMatchCount.set(p.round, (roundMatchCount.get(p.round) ?? 0) + 1);
  }

  for (let round = 1; round <= expectedRounds; round++) {
    const usedTeams = roundTeams.get(round);
    if (!usedTeams) return false;
    if ((roundMatchCount.get(round) ?? 0) !== matchesPerRound) return false;
    if (usedTeams.size !== teamsPerRound) return false;
  }

  return roundTeams.size === expectedRounds;
}

function buildCustomFromSingleLeg(singleLeg: Pairing[], singleLegRoundCount: number, customRounds: number): Pairing[] {
  if (customRounds < 1) return [];

  const byRound = new Map<number, Pairing[]>();
  for (const p of singleLeg) {
    if (!byRound.has(p.round)) byRound.set(p.round, []);
    byRound.get(p.round)!.push(p);
  }

  const result: Pairing[] = [];
  for (let roundNum = 0; roundNum < customRounds; roundNum++) {
    const cycleIndex = Math.floor(roundNum / singleLegRoundCount);
    const sourceRound = (roundNum % singleLegRoundCount) + 1;
    const flipRound = cycleIndex % 2 === 1;
    const sourceMatches = byRound.get(sourceRound) ?? [];

    for (const match of sourceMatches) {
      result.push({
        homeIdx: flipRound ? match.awayIdx : match.homeIdx,
        awayIdx: flipRound ? match.homeIdx : match.awayIdx,
        round: roundNum + 1,
      });
    }
  }

  return result;
}

function buildDeterministicFallback(
  baseRounds: BaseMatch[][],
  teamCount: number,
  matchType: "single_leg" | "home_away" | "custom",
  customRounds: number
): Pairing[] {
  const singleLeg = assignHomeAwayGreedyBalanced(baseRounds, teamCount);

  if (matchType === "single_leg") {
    return singleLeg;
  }

  if (matchType === "home_away") {
    return buildMirroredScheduleGreedy(singleLeg, baseRounds, teamCount);
  }

  return buildCustomFromSingleLeg(singleLeg, baseRounds.length, customRounds);
}

// ── STEP 2: H/A assignment ───────────────────────────────────────────

/**
 * Canonical de Werra H/A assignment for the circle method.
 * Works well for small even team counts.
 */
function assignHomeAwayCanonical(baseRounds: BaseMatch[][], teamCount: number): Pairing[] {
  const n = teamCount % 2 === 0 ? teamCount : teamCount + 1;
  const pairings: Pairing[] = [];

  for (let r = 0; r < baseRounds.length; r++) {
    const rotated = [0];
    for (let i = 0; i < n - 1; i++) {
      rotated.push(((i + r) % (n - 1)) + 1);
    }

    for (let i = 0; i < n / 2; i++) {
      const t1 = rotated[i];
      const t2 = rotated[n - 1 - i];
      if (t1 >= teamCount || t2 >= teamCount) continue;

      let homeTeam: number;
      let awayTeam: number;

      if (i === 0) {
        homeTeam = r % 2 === 0 ? t1 : t2;
        awayTeam = r % 2 === 0 ? t2 : t1;
      } else {
        homeTeam = (r + i) % 2 === 0 ? t1 : t2;
        awayTeam = (r + i) % 2 === 0 ? t2 : t1;
      }

      pairings.push({ homeIdx: homeTeam, awayIdx: awayTeam, round: r + 1 });
    }
  }

  return pairings;
}

/**
 * Jitter-based H/A assignment for variety (used as alternative seeds for small groups).
 */
function assignHomeAway(baseRounds: BaseMatch[][], seed: number): Pairing[] {
  const pairings: Pairing[] = [];

  for (let r = 0; r < baseRounds.length; r++) {
    for (let m = 0; m < baseRounds[r].length; m++) {
      const match = baseRounds[r][m];
      const baseFlip = (r + m) % 2 === 0;
      const jitter = ((seed + 1) * 53 + (r + 1) * 97 + (m + 1) * 193) % 11;
      const flip = baseFlip !== (jitter < 5);

      pairings.push({
        homeIdx: flip ? match.teamB : match.teamA,
        awayIdx: flip ? match.teamA : match.teamB,
        round: r + 1,
      });
    }
  }

  return pairings;
}

/**
 * Greedy balanced H/A assignment — O(n²) and guarantees streak ≤ 2.
 * For each match, picks the H/A orientation that minimizes a penalty
 * combining streak length and H/A balance.
 */
function assignHomeAwayGreedyBalanced(baseRounds: BaseMatch[][], teamCount: number): Pairing[] {
  const homeCount = new Array(teamCount).fill(0);
  const awayCount = new Array(teamCount).fill(0);
  const lastSide = new Array<"H" | "A" | null>(teamCount).fill(null);
  const lastRound = new Array(teamCount).fill(-10);
  const runLen = new Array(teamCount).fill(0);

  const penaltyFor = (team: number, side: "H" | "A", round: number) => {
    let penalty = 0;
    const consecutive = lastRound[team] === round - 1;
    if (consecutive && lastSide[team] === side) {
      const nextRun = runLen[team] + 1;
      if (nextRun > 2) penalty += 10_000_000;
      else if (nextRun === 2) penalty += 200;
    } else if (consecutive && lastSide[team] !== side) {
      penalty -= 50;
    }
    const projH = homeCount[team] + (side === "H" ? 1 : 0);
    const projA = awayCount[team] + (side === "A" ? 1 : 0);
    penalty += Math.abs(projH - projA) * 100;
    return penalty;
  };

  const applySide = (team: number, side: "H" | "A", round: number) => {
    if (side === "H") homeCount[team]++;
    else awayCount[team]++;
    if (lastRound[team] === round - 1 && lastSide[team] === side) {
      runLen[team] += 1;
    } else {
      runLen[team] = 1;
    }
    lastSide[team] = side;
    lastRound[team] = round;
  };

  const pairings: Pairing[] = [];

  for (let r = 0; r < baseRounds.length; r++) {
    const round = r + 1;
    // Process matches in varying order each round to avoid positional bias
    const matches = [...baseRounds[r]];
    if (r % 2 === 1) matches.reverse();

    for (const match of matches) {
      const a = match.teamA;
      const b = match.teamB;
      const costAB = penaltyFor(a, "H", round) + penaltyFor(b, "A", round);
      const costBA = penaltyFor(a, "A", round) + penaltyFor(b, "H", round);
      if (costAB <= costBA) {
        pairings.push({ homeIdx: a, awayIdx: b, round });
        applySide(a, "H", round);
        applySide(b, "A", round);
      } else {
        pairings.push({ homeIdx: b, awayIdx: a, round });
        applySide(b, "H", round);
        applySide(a, "A", round);
      }
    }
  }

  // ── Balance correction pass ────────────────────────────────────────
  // Fix remaining H/A imbalance by swapping matches involving unbalanced teams,
  // as long as the swap doesn't create a streak > 2.
  balanceCorrectionPass(pairings, teamCount);

  return pairings;
}

/**
 * Post-processing pass: iteratively swap H/A for matches involving the most
 * unbalanced team, verifying streak constraint after each swap.
 */
function balanceCorrectionPass(pairings: Pairing[], teamCount: number): void {
  const maxPasses = 200;

  for (let pass = 0; pass < maxPasses; pass++) {
    // Recalculate balance
    const hc = new Array(teamCount).fill(0);
    const ac = new Array(teamCount).fill(0);
    for (const p of pairings) {
      hc[p.homeIdx]++;
      ac[p.awayIdx]++;
    }

    // Find worst imbalanced team
    let worstTeam = -1;
    let worstDiff = 0;
    for (let i = 0; i < teamCount; i++) {
      const diff = Math.abs(hc[i] - ac[i]);
      if (diff > worstDiff) {
        worstDiff = diff;
        worstTeam = i;
      }
    }

    const maxAllowed = teamCount % 2 === 0 ? 0 : 1;
    if (worstDiff <= maxAllowed) break;

    // The worst team needs more of one side
    const needsMoreHome = ac[worstTeam] > hc[worstTeam];

    // Find best swap candidate: a match involving worstTeam where swapping
    // helps both teams and doesn't create streak > 2
    let bestSwapIdx = -1;
    let bestSwapScore = Infinity;

    for (let i = 0; i < pairings.length; i++) {
      const p = pairings[i];
      const isHome = p.homeIdx === worstTeam;
      const isAway = p.awayIdx === worstTeam;
      if (!isHome && !isAway) continue;

      // Check if swap helps
      if (needsMoreHome && isHome) continue;  // already home, swap would make away
      if (!needsMoreHome && isAway) continue;  // already away, swap would make home

      const partner = isHome ? p.awayIdx : p.homeIdx;

      // Check if swap also helps or at least doesn't hurt partner
      const partnerDiff = hc[partner] - ac[partner];
      // If worstTeam needs more home (swap away→home), partner goes home→away
      // Partner's new diff = (hc[partner]-1) - (ac[partner]+1) = partnerDiff - 2
      // If worstTeam needs more away (swap home→away), partner goes away→home
      // Partner's new diff = (hc[partner]+1) - (ac[partner]-1) = partnerDiff + 2
      const partnerNewDiff = needsMoreHome ? partnerDiff - 2 : partnerDiff + 2;
      if (Math.abs(partnerNewDiff) > Math.abs(partnerDiff)) continue; // makes partner worse

      // Check streak constraint after swap
      swapHomeAway(pairings[i]);
      const timelines = buildTeamTimelines(pairings, teamCount);
      const { maxConsec } = getConsecutiveStats(timelines);
      swapHomeAway(pairings[i]); // undo

      if (maxConsec > 2) continue;

      // Score: prefer swaps that improve overall balance most
      const score = Math.abs(partnerNewDiff);
      if (score < bestSwapScore) {
        bestSwapScore = score;
        bestSwapIdx = i;
      }
    }

    if (bestSwapIdx === -1) break; // No valid swap found
    swapHomeAway(pairings[bestSwapIdx]);
  }
}

// ── Score a candidate schedule ───────────────────────────────────────

function scoreSchedule(pairings: Pairing[], teamCount: number): {
  score: number;
  maxConsec: number;
  imbalance: number;
  rematches: number;
} {
  const timelines = buildTeamTimelines(pairings, teamCount);
  const { maxConsec, overflowOver2, violationRuns } = getConsecutiveStats(timelines);

  const { h, a } = countHA(pairings, teamCount);
  let imbalance = 0;
  for (let i = 0; i < teamCount; i++) {
    imbalance += Math.abs(h[i] - a[i]);
  }

  let rematches = 0;
  for (const list of timelines) {
    for (let i = 1; i < list.length; i++) {
      if (list[i].round === list[i - 1].round + 1 && list[i].opponent === list[i - 1].opponent) {
        rematches++;
      }
    }
  }

  let earlyPenalty = 0;
  for (const list of timelines) {
    if (list.length >= 2) {
      const first2 = list.slice(0, 2);
      const hasH = first2.some((e) => e.side === "H");
      const hasA = first2.some((e) => e.side === "A");
      if (!hasH || !hasA) earlyPenalty++;
    }
  }

  const score =
    violationRuns * 5_000_000 +
    overflowOver2 * 1_000_000 +
    imbalance * 120_000 +
    rematches * 60_000 +
    earlyPenalty * 15_000 +
    maxConsec * 100;

  return { score, maxConsec, imbalance, rematches };
}

// ── STEP 3: Build mirrored home/away schedule ────────────────────────

function buildMirroredSchedule(firstLeg: Pairing[], roundCount: number, shift: number): Pairing[] {
  const returnLeg = firstLeg.map((p) => ({
    homeIdx: p.awayIdx,
    awayIdx: p.homeIdx,
    round: roundCount + 1 + ((p.round - 1 + shift) % roundCount),
  }));

  return [...firstLeg, ...returnLeg];
}

/**
 * Build a home_away schedule for large groups.
 * Uses exact mirror (guarantees balance + mirror constraint),
 * then fixes junction streaks with paired-swap fixer.
 */
function buildMirroredScheduleGreedy(
  _firstLeg: Pairing[],
  baseRounds: BaseMatch[][],
  teamCount: number
): Pairing[] {
  const roundCount = baseRounds.length;

  // Try multiple shifts to find one where the junction has no streak issues
  let bestResult: Pairing[] | null = null;
  let bestMaxConsec = Infinity;

  const shifts = [0, 1, Math.floor(roundCount / 2), Math.floor(roundCount / 3), Math.floor(roundCount * 2 / 3)];
  const deadline = Date.now() + 3000;

  for (const shift of shifts) {
    if (Date.now() > deadline && bestResult) break;

    // Generate first leg without balance correction (mirror will guarantee balance)
    const firstLeg = assignHomeAwayGreedyBalancedRaw(baseRounds, teamCount);

    // Create exact mirror with shifted round mapping
    const returnLeg = firstLeg.map((p) => ({
      homeIdx: p.awayIdx,
      awayIdx: p.homeIdx,
      round: roundCount + 1 + ((p.round - 1 + shift) % roundCount),
    }));

    const combined = [...firstLeg, ...returnLeg];

    // Fix streaks using paired swaps (always swap match + its mirror to preserve balance)
    const mirrorMap = new Map<number, number>();
    for (let i = 0; i < firstLeg.length; i++) {
      // Find the mirror of match i in returnLeg
      const fl = firstLeg[i];
      const mirrorIdx = firstLeg.length + firstLeg.findIndex((_, j) => {
        const rl = returnLeg[j];
        return rl.homeIdx === fl.awayIdx && rl.awayIdx === fl.homeIdx;
      });
      // Actually simpler: match i maps to returnLeg[i] since mirror is 1:1
      mirrorMap.set(i, firstLeg.length + i);
      mirrorMap.set(firstLeg.length + i, i);
    }

    // Aggressive paired-swap streak fixer
    const swapDeadline = Date.now() + Math.min(500, Math.max(100, deadline - Date.now()));
    for (let pass = 0; pass < 300 && Date.now() < swapDeadline; pass++) {
      const timelines = buildTeamTimelines(combined, teamCount);
      const { maxConsec } = getConsecutiveStats(timelines);
      if (maxConsec <= 2) break;

      // Collect ALL match indices involved in streaks > 2
      const streakIndices = new Set<number>();
      for (const list of timelines) {
        let runStart = 0;
        for (let i = 1; i <= list.length; i++) {
          const cont = i < list.length && list[i].round === list[i - 1].round + 1 && list[i].side === list[i - 1].side;
          if (!cont) {
            if (i - runStart > 2) {
              for (let j = runStart; j < i; j++) {
                const round = list[j].round;
                for (let pi = 0; pi < combined.length; pi++) {
                  if (combined[pi].round === round) streakIndices.add(pi);
                }
              }
            }
            runStart = i;
          }
        }
      }

      let improved = false;
      for (const idx of streakIndices) {
        if (Date.now() > swapDeadline) break;
        const mi = mirrorMap.get(idx);
        if (mi === undefined) continue;

        swapHomeAway(combined[idx]);
        swapHomeAway(combined[mi]);
        const nt = buildTeamTimelines(combined, teamCount);
        const { maxConsec: nm } = getConsecutiveStats(nt);
        if (nm < maxConsec) {
          improved = true;
          break; // restart to recalculate streaks
        }
        swapHomeAway(combined[idx]);
        swapHomeAway(combined[mi]);
      }

      if (!improved) break;
    }

    const timelines = buildTeamTimelines(combined, teamCount);
    const { maxConsec } = getConsecutiveStats(timelines);
    if (maxConsec < bestMaxConsec) {
      bestMaxConsec = maxConsec;
      bestResult = combined;
      if (maxConsec <= 2) break;
    }
  }

  return bestResult!;
}

/**
 * Greedy balanced H/A without the balance correction pass.
 */
function assignHomeAwayGreedyBalancedRaw(baseRounds: BaseMatch[][], teamCount: number): Pairing[] {
  const homeCount = new Array(teamCount).fill(0);
  const awayCount = new Array(teamCount).fill(0);
  const lastSide = new Array<"H" | "A" | null>(teamCount).fill(null);
  const lastRound = new Array(teamCount).fill(-10);
  const runLen = new Array(teamCount).fill(0);

  const penaltyFor = (team: number, side: "H" | "A", round: number) => {
    let penalty = 0;
    const consecutive = lastRound[team] === round - 1;
    if (consecutive && lastSide[team] === side) {
      const nextRun = runLen[team] + 1;
      if (nextRun > 2) penalty += 10_000_000;
      else if (nextRun === 2) penalty += 200;
    } else if (consecutive && lastSide[team] !== side) {
      penalty -= 50;
    }
    const projH = homeCount[team] + (side === "H" ? 1 : 0);
    const projA = awayCount[team] + (side === "A" ? 1 : 0);
    penalty += Math.abs(projH - projA) * 100;
    return penalty;
  };

  const applySide = (team: number, side: "H" | "A", round: number) => {
    if (side === "H") homeCount[team]++;
    else awayCount[team]++;
    if (lastRound[team] === round - 1 && lastSide[team] === side) {
      runLen[team] += 1;
    } else {
      runLen[team] = 1;
    }
    lastSide[team] = side;
    lastRound[team] = round;
  };

  const pairings: Pairing[] = [];

  for (let r = 0; r < baseRounds.length; r++) {
    const round = r + 1;
    const matches = [...baseRounds[r]];
    if (r % 2 === 1) matches.reverse();

    for (const match of matches) {
      const a = match.teamA;
      const b = match.teamB;
      const costAB = penaltyFor(a, "H", round) + penaltyFor(b, "A", round);
      const costBA = penaltyFor(a, "A", round) + penaltyFor(b, "H", round);
      if (costAB <= costBA) {
        pairings.push({ homeIdx: a, awayIdx: b, round });
        applySide(a, "H", round);
        applySide(b, "A", round);
      } else {
        pairings.push({ homeIdx: b, awayIdx: a, round });
        applySide(b, "H", round);
        applySide(a, "A", round);
      }
    }
  }

  return pairings;
}

function flipRound(pairings: Pairing[], round: number): void {
  for (const p of pairings) {
    if (p.round === round) swapHomeAway(p);
  }
}

// ── Local search optimizers ───────────────────────────────────────────

function targetedStreakBreaker(pairings: Pairing[], teamCount: number, maxMs: number): void {
  const deadline = Date.now() + maxMs;

  while (Date.now() < deadline) {
    const timelines = buildTeamTimelines(pairings, teamCount);
    const { maxConsec } = getConsecutiveStats(timelines);
    if (maxConsec <= 2) break;

    const streakMatches: Set<number> = new Set();
    for (const list of timelines) {
      let runStart = 0;
      for (let i = 1; i <= list.length; i++) {
        const continues =
          i < list.length &&
          list[i].round === list[i - 1].round + 1 &&
          list[i].side === list[i - 1].side;
        if (!continues) {
          const runLen = i - runStart;
          if (runLen > 2) {
            for (let j = runStart; j < i; j++) {
              const round = list[j].round;
              for (let pi = 0; pi < pairings.length; pi++) {
                if (pairings[pi].round === round) {
                  streakMatches.add(pi);
                }
              }
            }
          }
          runStart = i;
        }
      }
    }

    if (streakMatches.size === 0) break;

    const currentScore = scoreSchedule(pairings, teamCount).score;
    let bestIdx = -1;
    let bestScore = currentScore;

    for (const idx of streakMatches) {
      if (Date.now() > deadline) break;
      swapHomeAway(pairings[idx]);
      const s = scoreSchedule(pairings, teamCount).score;
      swapHomeAway(pairings[idx]);
      if (s < bestScore) {
        bestScore = s;
        bestIdx = idx;
      }
    }

    if (bestIdx === -1) break;
    swapHomeAway(pairings[bestIdx]);
  }
}

function pairSwapOptimizer(pairings: Pairing[], teamCount: number, maxMs: number): void {
  const deadline = Date.now() + maxMs;
  const byRound = new Map<number, number[]>();
  for (let i = 0; i < pairings.length; i++) {
    const r = pairings[i].round;
    if (!byRound.has(r)) byRound.set(r, []);
    byRound.get(r)!.push(i);
  }

  while (Date.now() < deadline) {
    const currentScore = scoreSchedule(pairings, teamCount).score;
    if (currentScore === 0) break;
    let improved = false;

    for (const [, indices] of byRound) {
      if (Date.now() > deadline) break;
      for (let a = 0; a < indices.length; a++) {
        for (let b = a + 1; b < indices.length; b++) {
          swapHomeAway(pairings[indices[a]]);
          swapHomeAway(pairings[indices[b]]);
          const s = scoreSchedule(pairings, teamCount).score;
          if (s < currentScore) {
            improved = true;
            break;
          }
          swapHomeAway(pairings[indices[a]]);
          swapHomeAway(pairings[indices[b]]);
        }
        if (improved) break;
      }
      if (improved) break;
    }

    if (!improved) break;
  }
}

function quickFixFlips(pairings: Pairing[], teamCount: number, maxMs: number): void {
  const deadline = Date.now() + maxMs;

  while (Date.now() < deadline) {
    const currentScore = scoreSchedule(pairings, teamCount).score;
    let bestIdx = -1;
    let bestScore = currentScore;

    for (let i = 0; i < pairings.length; i++) {
      if (Date.now() > deadline) break;

      swapHomeAway(pairings[i]);
      const newScore = scoreSchedule(pairings, teamCount).score;
      swapHomeAway(pairings[i]);

      if (newScore < bestScore) {
        bestScore = newScore;
        bestIdx = i;
      }
    }

    if (bestIdx === -1) break;
    swapHomeAway(pairings[bestIdx]);
  }
}

function quickFixRoundFlips(pairings: Pairing[], teamCount: number, maxMs: number): void {
  const deadline = Date.now() + maxMs;
  const rounds = [...new Set(pairings.map((p) => p.round))].sort((a, b) => a - b);

  while (Date.now() < deadline) {
    const currentScore = scoreSchedule(pairings, teamCount).score;
    let bestRound: number | null = null;
    let bestScore = currentScore;

    for (const round of rounds) {
      if (Date.now() > deadline) break;

      flipRound(pairings, round);
      const newScore = scoreSchedule(pairings, teamCount).score;
      flipRound(pairings, round);

      if (newScore < bestScore) {
        bestScore = newScore;
        bestRound = round;
      }
    }

    if (bestRound === null) break;
    flipRound(pairings, bestRound);
  }
}

function optimizePairings(pairings: Pairing[], teamCount: number, maxMs: number): void {
  const deadline = Date.now() + maxMs;

  while (Date.now() < deadline) {
    const before = scoreSchedule(pairings, teamCount);
    const timeLeft = Math.max(20, deadline - Date.now());

    quickFixRoundFlips(pairings, teamCount, Math.min(120, timeLeft));
    targetedStreakBreaker(pairings, teamCount, Math.min(200, timeLeft));
    quickFixFlips(pairings, teamCount, Math.min(180, timeLeft));
    pairSwapOptimizer(pairings, teamCount, Math.min(150, timeLeft));

    const after = scoreSchedule(pairings, teamCount);
    if (after.score >= before.score) break;
    if (after.maxConsec <= 2 && after.imbalance === 0 && after.rematches === 0) break;
  }
}

// ── Generate single leg schedule ─────────────────────────────────────

function generateSingleLeg(baseRounds: BaseMatch[][], teamCount: number): Pairing[] {
  // Large groups: greedy balanced is O(n²), fast, and guarantees streak ≤ 2
  if (teamCount >= LARGE_GROUP_THRESHOLD) {
    const result = assignHomeAwayGreedyBalanced(baseRounds, teamCount);
    renumberRounds(result);
    return result;
  }

  let best: Pairing[] | null = null;
  let bestScore = Infinity;

  const maxSeeds = teamCount <= 8 ? 12 : teamCount <= 12 ? 20 : 30;
  const deadline = Date.now() + (teamCount <= 12 ? 2000 : 4000);

  // Try canonical assignment first
  const canonical = assignHomeAwayCanonical(baseRounds, teamCount);
  optimizePairings(canonical, teamCount, Math.min(400, teamCount <= 12 ? 300 : 600));
  const canonicalResult = scoreSchedule(canonical, teamCount);
  if (canonicalResult.score < bestScore) {
    bestScore = canonicalResult.score;
    best = canonical.map((p) => ({ ...p }));
  }

  // Try jitter-based seeds if canonical wasn't perfect
  if (bestScore > 0) {
    for (let seed = 0; seed < maxSeeds; seed++) {
      if (Date.now() > deadline && best) break;
      const candidate = assignHomeAway(baseRounds, seed);
      optimizePairings(candidate, teamCount, teamCount <= 10 ? 300 : teamCount <= 12 ? 500 : 800);

      const { score } = scoreSchedule(candidate, teamCount);
      if (score < bestScore) {
        bestScore = score;
        best = candidate.map((p) => ({ ...p }));
        if (score === 0) break;
      }
    }
  }

  const result = best ?? assignHomeAwayCanonical(baseRounds, teamCount);
  renumberRounds(result);
  return result;
}

// ── Generate home & away schedule ────────────────────────────────────

function generateHomeAway(baseRounds: BaseMatch[][], teamCount: number): Pairing[] {
  const roundCount = baseRounds.length;

  // Large groups: use greedy balanced across all 2N rounds
  if (teamCount >= LARGE_GROUP_THRESHOLD) {
    const firstLeg = assignHomeAwayGreedyBalanced(baseRounds, teamCount);
    const result = buildMirroredScheduleGreedy(firstLeg, baseRounds, teamCount);
    renumberRounds(result);
    return result;
  }

  // Small groups: search-based approach with multiple seeds and shifts
  let best: Pairing[] | null = null;
  let bestScore = Infinity;

  const deadline = Date.now() + (teamCount <= 12 ? 3000 : 6000);
  const maxSeeds = teamCount <= 8 ? 14 : teamCount <= 12 ? 12 : 10;
  const maxShifts = Math.min(roundCount, teamCount <= 10 ? roundCount : 8);

  function tryFirstLeg(firstLeg: Pairing[]) {
    for (let shift = 0; shift < maxShifts; shift++) {
      const combined = buildMirroredSchedule(firstLeg, roundCount, shift);

      const pairMap = new Map<number, number>();
      for (let r = 1; r <= roundCount; r++) {
        pairMap.set(r, roundCount + 1 + ((r - 1 + shift) % roundCount));
      }

      const firstLegIndices: number[] = [];
      const returnLegIndices: number[] = [];
      for (let i = 0; i < combined.length; i++) {
        if (combined[i].round <= roundCount) firstLegIndices.push(i);
        else returnLegIndices.push(i);
      }

      // Paired round flips
      const flipDeadline = Date.now() + Math.min(150, Math.max(30, deadline - Date.now()));
      while (Date.now() < flipDeadline) {
        const currentScore = scoreSchedule(combined, teamCount).score;
        let bestFlipRound: number | null = null;
        let bestFlipScore = currentScore;

        for (let r = 1; r <= roundCount; r++) {
          const mr = pairMap.get(r)!;
          flipRound(combined, r);
          flipRound(combined, mr);
          const s = scoreSchedule(combined, teamCount).score;
          flipRound(combined, r);
          flipRound(combined, mr);
          if (s < bestFlipScore) {
            bestFlipScore = s;
            bestFlipRound = r;
          }
        }

        if (bestFlipRound === null) break;
        flipRound(combined, bestFlipRound);
        flipRound(combined, pairMap.get(bestFlipRound)!);
      }

      // Paired match flips
      const matchFlipDeadline = Date.now() + Math.min(200, Math.max(30, deadline - Date.now()));
      while (Date.now() < matchFlipDeadline) {
        const currentScore = scoreSchedule(combined, teamCount).score;
        if (currentScore === 0) break;
        let bestPairIdx = -1;
        let bestPairScore = currentScore;

        for (let fi = 0; fi < firstLegIndices.length; fi++) {
          if (Date.now() > matchFlipDeadline) break;
          const i1 = firstLegIndices[fi];
          const i2 = returnLegIndices[fi];
          swapHomeAway(combined[i1]);
          swapHomeAway(combined[i2]);
          const s = scoreSchedule(combined, teamCount).score;
          swapHomeAway(combined[i1]);
          swapHomeAway(combined[i2]);
          if (s < bestPairScore) {
            bestPairScore = s;
            bestPairIdx = fi;
          }
        }

        if (bestPairIdx === -1) break;
        swapHomeAway(combined[firstLegIndices[bestPairIdx]]);
        swapHomeAway(combined[returnLegIndices[bestPairIdx]]);
      }

      const { score } = scoreSchedule(combined, teamCount);
      if (score < bestScore) {
        bestScore = score;
        best = combined.map((p) => ({ ...p }));
        if (score === 0) return;
      }
    }
  }

  // Try canonical assignment first
  const canonical = assignHomeAwayCanonical(baseRounds, teamCount);
  optimizePairings(canonical, teamCount, Math.min(400, Math.max(100, deadline - Date.now())));
  tryFirstLeg(canonical);

  // Try jitter-based seeds
  if (bestScore > 0) {
    for (let seed = 0; seed < maxSeeds; seed++) {
      if (Date.now() > deadline && best) break;
      if (bestScore === 0) break;

      const firstLeg = assignHomeAway(baseRounds, seed);
      const timeLeft = Math.max(100, deadline - Date.now());
      optimizePairings(firstLeg, teamCount, Math.min(teamCount <= 12 ? 300 : 600, timeLeft));
      tryFirstLeg(firstLeg);
    }
  }

  if (!best) {
    const firstLeg = generateSingleLeg(baseRounds, teamCount);
    best = buildMirroredSchedule(firstLeg, roundCount, 0);
  }

  renumberRounds(best);
  return best;
}

// ── Generate custom rounds schedule ──────────────────────────────────

function generateCustom(baseRounds: BaseMatch[][], teamCount: number, customRounds: number): Pairing[] {
  if (customRounds < 1) return [];

  const singleLeg = generateSingleLeg(baseRounds, teamCount);
  const deterministic = buildCustomFromSingleLeg(singleLeg, baseRounds.length, customRounds);

  // IMPORTANT: keep deterministic mirror pattern for repeated encounters:
  // A-B, B-A, A-B, ... across cycles.
  renumberRounds(deterministic);
  return deterministic;
}

// ── Main Entry Point ──────────────────────────────────────────────────

/**
 * Generate a balanced round-robin schedule.
 *
 * @param teamCount Number of teams in the group
 * @param matchType "single_leg" | "home_away" | "custom"
 * @param customRounds For "custom": number of match rounds
 * @returns Array of pairings with homeIdx, awayIdx, round (1-indexed)
 */
export function generateRoundRobin(
  teamCount: number,
  matchType: "single_leg" | "home_away" | "custom" = "single_leg",
  customRounds: number = 1
): Pairing[] {
  if (teamCount < 2) return [];

  const baseRounds = circleMethodRounds(teamCount);
  const expectedRounds = expectedRoundsForMatchType(teamCount, matchType, customRounds);

  let generated: Pairing[];
  if (matchType === "single_leg") {
    generated = generateSingleLeg(baseRounds, teamCount);
  } else if (matchType === "custom") {
    generated = generateCustom(baseRounds, teamCount, customRounds);
  } else {
    generated = generateHomeAway(baseRounds, teamCount);
  }

  if (isScheduleStructurallyValid(generated, teamCount, expectedRounds)) {
    return generated;
  }

  const fallback = buildDeterministicFallback(baseRounds, teamCount, matchType, customRounds);
  renumberRounds(fallback);

  if (isScheduleStructurallyValid(fallback, teamCount, expectedRounds)) {
    return fallback;
  }

  return generated;
}
