/**
 * Hierarchical scoring resolution: match > group > phase > tournament default.
 *
 * Each match is scored using its own scoring_system_id; if absent the group's,
 * then the phase's, finally the tournament default (points_win/points_draw on
 * the tournaments table — backed by Puntentelling 1).
 */

export interface SetResultPoints {
  [outcome: string]: { win: number; loss: number; draw?: number };
}

export interface ScoringSystem {
  id: string;
  points_win: number;
  points_draw: number;
  points_loss: number;
  points_big_win?: number;
  big_win_threshold?: number;
  points_win_overtime?: number;
  points_draw_with_goals?: number;
  points_draw_no_goals?: number;
  points_loss_overtime?: number;
  no_draws?: boolean;
  tiebreaker_rules?: string[] | null;
  h2h_sub_rules?: string[] | null;
  scoring_type?: string;
  set_points_mode?: string;
  set_result_points?: SetResultPoints;
  num_sets?: number;
}

export interface StandingMatch {
  home_team_id: string | null;
  away_team_id: string | null;
  home_score: number | null;
  away_score: number | null;
  home_penalties?: number | null;
  away_penalties?: number | null;
  is_played: boolean;
  group_id: string | null;
  phase_id: string;
  scoring_system_id?: string | null;
  set_scores?: { home: number | null; away: number | null }[] | null;
}

export interface StandingGroupTeam {
  group_id: string;
  team_id: string;
  bonus_points: number;
  fairplay_points?: number;
  manual_position?: number | null;
}

export interface StandingPhase {
  id: string;
  scoring_system_id?: string | null;
}

export interface StandingGroup {
  id: string;
  phase_id: string;
  scoring_system_id?: string | null;
}

export interface TournamentDefaults {
  points_win?: number | null;
  points_draw?: number | null;
  points_loss?: number | null;
}

/**
 * Resolve the effective scoring system for a single match using the
 * hierarchy: match > group > phase > tournament default.
 * Returns the resolved ScoringSystem (or a synthetic one from tournament defaults).
 */
const resolveEffectiveSystem = (
  match: StandingMatch,
  groups: StandingGroup[],
  phases: StandingPhase[],
  scoringSystems: ScoringSystem[],
  tournament: TournamentDefaults | null | undefined,
): ScoringSystem | null => {
  const find = (id: string | null | undefined) =>
    id ? scoringSystems.find((s) => s.id === id) : undefined;

  let sys = find(match.scoring_system_id);
  if (!sys && match.group_id) {
    const g = groups.find((x) => x.id === match.group_id);
    sys = find(g?.scoring_system_id);
  }
  if (!sys) {
    const p = phases.find((x) => x.id === match.phase_id);
    sys = find(p?.scoring_system_id);
  }
  // Fallback: if only one scoring system exists, use it as the default
  if (!sys && scoringSystems.length > 0) {
    sys = scoringSystems[0];
  }
  return sys || null;
};

/**
 * Calculate points awarded to the home and away team for a single match,
 * taking into account advanced scoring rules (big win, overtime, draw variants).
 */
export const resolveMatchScoring = (
  match: StandingMatch,
  groups: StandingGroup[],
  phases: StandingPhase[],
  scoringSystems: ScoringSystem[],
  tournament: TournamentDefaults | null | undefined,
): { points_win: number; points_draw: number; points_loss: number } => {
  const sys = resolveEffectiveSystem(match, groups, phases, scoringSystems, tournament);
  if (!sys) {
    return {
      points_win: tournament?.points_win ?? 3,
      points_draw: tournament?.points_draw ?? 1,
      points_loss: tournament?.points_loss ?? 0,
    };
  }
  return { points_win: sys.points_win, points_draw: sys.points_draw, points_loss: sys.points_loss };
};

/**
 * Resolve per-team points for a single match with full advanced scoring:
 * big win, overtime win/loss, draw with/without goals.
 */
export const resolveAdvancedMatchPoints = (
  match: StandingMatch,
  groups: StandingGroup[],
  phases: StandingPhase[],
  scoringSystems: ScoringSystem[],
  tournament: TournamentDefaults | null | undefined,
): { homePoints: number; awayPoints: number } => {
  const sys = resolveEffectiveSystem(match, groups, phases, scoringSystems, tournament);

  // --- Set scoring modes ---
  if (sys && sys.scoring_type === "sets" && (sys.num_sets ?? 1) >= 2) {
    const hs = match.home_score ?? 0; // set wins for home
    const as_ = match.away_score ?? 0; // set wins for away

    if (sys.set_points_mode === "per_set") {
      // Points per individual set won/drawn/lost
      const sets = match.set_scores || [];
      let homePts = 0;
      let awayPts = 0;
      for (const s of sets) {
        if (s.home === null || s.away === null) continue;
        if (s.home > s.away) { homePts += sys.points_win; awayPts += sys.points_loss; }
        else if (s.away > s.home) { awayPts += sys.points_win; homePts += sys.points_loss; }
        else { homePts += sys.points_draw; awayPts += sys.points_draw; }
      }
      return { homePoints: homePts, awayPoints: awayPts };
    }

    // total_result mode: lookup outcome key in set_result_points
    if (sys.set_points_mode === "total_result" && sys.set_result_points) {
      const winnerSets = Math.max(hs, as_);
      const loserSets = Math.min(hs, as_);
      const key = `${winnerSets}-${loserSets}`;
      const rp = sys.set_result_points[key];
      if (rp) {
        if (hs > as_) return { homePoints: rp.win ?? 0, awayPoints: rp.loss ?? 0 };
        if (as_ > hs) return { homePoints: rp.loss ?? 0, awayPoints: rp.win ?? 0 };
        // Draw in sets
        return { homePoints: rp.draw ?? 0, awayPoints: rp.draw ?? 0 };
      }
    }

    // Fallback for sets: use standard points_win/draw/loss on overall result
    if (hs > as_) return { homePoints: sys.points_win, awayPoints: sys.points_loss };
    if (as_ > hs) return { homePoints: sys.points_loss, awayPoints: sys.points_win };
    return { homePoints: sys.points_draw, awayPoints: sys.points_draw };
  }

  // --- Standard points scoring ---
  const hs = match.home_score ?? 0;
  const as_ = match.away_score ?? 0;
  const hp = match.home_penalties ?? 0;
  const ap = match.away_penalties ?? 0;
  const hasOT = (match.home_penalties != null && match.away_penalties != null) &&
    (hp !== 0 || ap !== 0);

  // Determine effective winner: regular score first, then penalties if tied
  let homeWins = hs > as_;
  let awayWins = hs < as_;
  const isDraw = hs === as_;
  if (isDraw && hasOT) {
    homeWins = hp > ap;
    awayWins = ap > hp;
  }

  if (!sys) {
    const pw = tournament?.points_win ?? 3;
    const pd = tournament?.points_draw ?? 1;
    const pl = tournament?.points_loss ?? 0;
    if (homeWins) return { homePoints: pw, awayPoints: pl };
    if (awayWins) return { homePoints: pl, awayPoints: pw };
    return { homePoints: pd, awayPoints: pd };
  }

  const threshold = sys.big_win_threshold ?? 2;
  const diff = Math.abs(hs - as_);

  // Winner / loser (including overtime/penalty winners)
  if (homeWins) {
    let wp = sys.points_win;
    let lp = sys.points_loss;
    // Big win check (only on regular score, not OT)
    if (!isDraw && diff >= threshold && sys.points_big_win != null) wp = sys.points_big_win;
    // Overtime override (score was tied, decided by penalties)
    if (isDraw && hasOT) {
      if (sys.points_win_overtime != null) wp = sys.points_win_overtime;
      if (sys.points_loss_overtime != null) lp = sys.points_loss_overtime;
    }
    return { homePoints: wp, awayPoints: lp };
  }
  if (awayWins) {
    let wp = sys.points_win;
    let lp = sys.points_loss;
    if (!isDraw && diff >= threshold && sys.points_big_win != null) wp = sys.points_big_win;
    if (isDraw && hasOT) {
      if (sys.points_win_overtime != null) wp = sys.points_win_overtime;
      if (sys.points_loss_overtime != null) lp = sys.points_loss_overtime;
    }
    return { homePoints: lp, awayPoints: wp };
  }

  // Draw (no penalties or penalties also tied)
  if (hs > 0 && sys.points_draw_with_goals != null) {
    return { homePoints: sys.points_draw_with_goals, awayPoints: sys.points_draw_with_goals };
  }
  if (hs === 0 && sys.points_draw_no_goals != null) {
    return { homePoints: sys.points_draw_no_goals, awayPoints: sys.points_draw_no_goals };
  }
  return { homePoints: sys.points_draw, awayPoints: sys.points_draw };
};

export interface StandingRow {
  pos: number;
  teamId: string;
  gp: number;
  w: number;
  d: number;
  l: number;
  gf: number;
  ga: number;
  gd: number;
  pts: number;
  bonus: number;
  fairplay: number;
  /** True if final position is undecided due to drawing_lots tiebreaker */
  needsDrawingLots?: boolean;
  /** Manual position override (used for tied teams when drawing_lots is the tiebreaker) */
  manualPosition?: number | null;
}

/**
 * Determine the dominant tiebreaker rule order to apply for a group.
 * Uses the rule_order from the scoring system that applies to the *majority* of
 * matches in the group (typically the group's effective scoring system).
 */
const resolveGroupTiebreakers = (
  groupId: string,
  matches: StandingMatch[],
  groups: StandingGroup[],
  phases: StandingPhase[],
  scoringSystems: ScoringSystem[],
): { rules: string[]; h2hSubRules: string[] } => {
  // Find the group's effective scoring system: group > phase > first available
  const g = groups.find((x) => x.id === groupId);
  let sys = g?.scoring_system_id ? scoringSystems.find((s) => s.id === g.scoring_system_id) : undefined;
  if (!sys && g) {
    const p = phases.find((x) => x.id === g.phase_id);
    sys = p?.scoring_system_id ? scoringSystems.find((s) => s.id === p.scoring_system_id) : undefined;
  }
  if (!sys) sys = scoringSystems[0];
  const rules = Array.isArray(sys?.tiebreaker_rules) && sys!.tiebreaker_rules!.length > 0
    ? sys!.tiebreaker_rules!
    : ["goal_difference", "goals_scored", "head_to_head"];
  const h2hSubRules = Array.isArray(sys?.h2h_sub_rules) && sys!.h2h_sub_rules!.length > 0
    ? sys!.h2h_sub_rules!
    : ["points", "goal_difference", "goals_scored", "wins"];
  return { rules, h2hSubRules };
};

/**
 * Compute head-to-head mini-standings between a subset of tied teams.
 * Returns a Map of teamId → { pts, gd, gf, w } based ONLY on matches between them.
 */
const computeHeadToHead = (
  tiedTeamIds: string[],
  matches: StandingMatch[],
  groups: StandingGroup[],
  phases: StandingPhase[],
  scoringSystems: ScoringSystem[],
  tournament: TournamentDefaults | null | undefined,
): Map<string, { pts: number; gd: number; gf: number; w: number }> => {
  const set = new Set(tiedTeamIds);
  const result = new Map<string, { pts: number; gd: number; gf: number; w: number }>();
  tiedTeamIds.forEach((id) => result.set(id, { pts: 0, gd: 0, gf: 0, w: 0 }));

  matches.forEach((m) => {
    if (!m.is_played) return;
    if (!m.home_team_id || !m.away_team_id) return;
    if (!set.has(m.home_team_id) || !set.has(m.away_team_id)) return;
    const adv = resolveAdvancedMatchPoints(m, groups, phases, scoringSystems, tournament);
    const hs = m.home_score ?? 0;
    const as = m.away_score ?? 0;
    const home = result.get(m.home_team_id)!;
    const away = result.get(m.away_team_id)!;
    home.gf += hs; home.gd += hs - as;
    away.gf += as; away.gd += as - hs;
    if (hs > as) { home.pts += adv.homePoints; away.pts += adv.awayPoints; home.w++; }
    else if (hs < as) { away.pts += adv.awayPoints; home.pts += adv.homePoints; away.w++; }
    else { home.pts += adv.homePoints; away.pts += adv.awayPoints; }
  });
  return result;
};

/**
 * Apply the configured tiebreaker rules in sequence to sort tied groups of teams.
 * Each rule operates only on the currently-tied subset.
 */
const applyTiebreakers = (
  rows: StandingRow[],
  rules: string[],
  h2hSubRules: string[],
  matches: StandingMatch[],
  groups: StandingGroup[],
  phases: StandingPhase[],
  scoringSystems: ScoringSystem[],
  tournament: TournamentDefaults | null | undefined,
): StandingRow[] => {
  // First sort by points (always primary)
  rows.sort((a, b) => b.pts - a.pts);

  // Mark a still-tied subset as requiring drawing lots, honouring manual positions
  const markDrawingLots = (subset: StandingRow[]): StandingRow[] => {
    subset.forEach((r) => { r.needsDrawingLots = true; });
    const hasManual = subset.some((r) => r.manualPosition != null);
    if (hasManual) {
      subset.sort((a, b) => {
        const am = a.manualPosition ?? Number.MAX_SAFE_INTEGER;
        const bm = b.manualPosition ?? Number.MAX_SAFE_INTEGER;
        return am - bm;
      });
    }
    return subset;
  };

  // Recursively resolve groups that are tied on points using the rules sequence
  const resolveTied = (subset: StandingRow[], ruleIdx: number): StandingRow[] => {
    if (subset.length <= 1) return subset;
    // All configured criteria exhausted but teams are still tied: fall back to drawing lots
    if (ruleIdx >= rules.length) return markDrawingLots(subset);
    const rule = rules[ruleIdx];

    if (rule === "head_to_head") {
      const ids = subset.map((r) => r.teamId);
      const h2h = computeHeadToHead(ids, matches, groups, phases, scoringSystems, tournament);
      // Sort by configurable h2h sub-rules
      subset.sort((a, b) => {
        const ha = h2h.get(a.teamId)!;
        const hb = h2h.get(b.teamId)!;
        for (const sub of h2hSubRules) {
          let diff = 0;
          if (sub === "points") diff = hb.pts - ha.pts;
          else if (sub === "goal_difference") diff = hb.gd - ha.gd;
          else if (sub === "goals_scored") diff = hb.gf - ha.gf;
          else if (sub === "wins") diff = hb.w - ha.w;
          if (diff !== 0) return diff;
        }
        return 0;
      });
      // After H2H, regroup teams that are still tied on all h2h sub-rules and continue
      const next: StandingRow[] = [];
      let i = 0;
      while (i < subset.length) {
        let j = i + 1;
        const ha = h2h.get(subset[i].teamId)!;
        while (
          j < subset.length &&
          (() => {
            const hb = h2h.get(subset[j].teamId)!;
            return h2hSubRules.every((sub) => {
              if (sub === "points") return hb.pts === ha.pts;
              if (sub === "goal_difference") return hb.gd === ha.gd;
              if (sub === "goals_scored") return hb.gf === ha.gf;
              if (sub === "wins") return hb.w === ha.w;
              return true;
            });
          })()
        ) j++;
        next.push(...resolveTied(subset.slice(i, j), ruleIdx + 1));
        i = j;
      }
      return next;
    }

    if (rule === "drawing_lots") {
      // Mark all still-tied teams as requiring a manual draw.
      return markDrawingLots(subset);
    }

    // fairplay & least_cards: lower is better
    const lowerIsBetter = rule === "fairplay" || rule === "least_cards";
    const getKey = (r: StandingRow): number => {
      switch (rule) {
        case "goal_difference": return r.gd;
        case "goals_scored": return r.gf;
        case "wins": return r.w;
        case "fairplay": return r.fairplay;
        case "least_cards": return 0; // not tracked
        default: return 0;
      }
    };
    subset.sort((a, b) => lowerIsBetter ? getKey(a) - getKey(b) : getKey(b) - getKey(a));
    // Regroup teams still tied on this key
    const next: StandingRow[] = [];
    let i = 0;
    while (i < subset.length) {
      let j = i + 1;
      const ka = getKey(subset[i]);
      while (j < subset.length && getKey(subset[j]) === ka) j++;
      next.push(...resolveTied(subset.slice(i, j), ruleIdx + 1));
      i = j;
    }
    return next;
  };

  // Group rows by points then resolve each tied bucket
  const out: StandingRow[] = [];
  let i = 0;
  while (i < rows.length) {
    let j = i + 1;
    while (j < rows.length && rows[j].pts === rows[i].pts) j++;
    out.push(...resolveTied(rows.slice(i, j), 0));
    i = j;
  }
  return out;
};

/**
 * Calculate standings for a single group, applying per-match scoring resolution
 * and the configured tiebreaker rules (incl. head-to-head).
 */
export const calculateGroupStandings = (
  groupId: string,
  groupTeams: StandingGroupTeam[],
  matches: StandingMatch[],
  groups: StandingGroup[],
  phases: StandingPhase[],
  scoringSystems: ScoringSystem[],
  tournament: TournamentDefaults | null | undefined,
): StandingRow[] => {
  const gts = groupTeams.filter((gt) => gt.group_id === groupId);
  const groupMatches = matches.filter((m) => m.group_id === groupId && m.is_played);

  let rows: StandingRow[] = gts.map((gt) => {
    let w = 0, d = 0, l = 0, gf = 0, ga = 0, pts = 0;
    groupMatches.forEach((m) => {
      const isHome = m.home_team_id === gt.team_id;
      const isAway = m.away_team_id === gt.team_id;
      if (!isHome && !isAway) return;
      const adv = resolveAdvancedMatchPoints(m, groups, phases, scoringSystems, tournament);
      const own = (isHome ? m.home_score : m.away_score) ?? 0;
      const opp = (isHome ? m.away_score : m.home_score) ?? 0;
      gf += own; ga += opp;
      const myPts = isHome ? adv.homePoints : adv.awayPoints;
      if (own > opp) { w++; pts += myPts; }
      else if (own === opp) { d++; pts += myPts; }
      else { l++; pts += myPts; }
    });
    return {
      pos: 0,
      teamId: gt.team_id,
      gp: w + d + l, w, d, l, gf, ga, gd: gf - ga,
      pts: pts + gt.bonus_points,
      bonus: gt.bonus_points,
      fairplay: gt.fairplay_points ?? 0,
      manualPosition: gt.manual_position ?? null,
    };
  });

  const { rules, h2hSubRules } = resolveGroupTiebreakers(groupId, matches, groups, phases, scoringSystems);
  rows = applyTiebreakers(rows, rules, h2hSubRules, groupMatches, groups, phases, scoringSystems, tournament);
  rows.forEach((r, i) => (r.pos = i + 1));
  return rows;
};

/**
 * Calculate the current group position for the home and away teams of a match.
 * Returns undefined positions for non-group phases or when data is unavailable.
 */
export const getMatchTeamPositions = (
  match: StandingMatch,
  groupTeams: StandingGroupTeam[],
  matches: StandingMatch[],
  groups: StandingGroup[],
  phases: StandingPhase[],
  scoringSystems: ScoringSystem[],
  tournament: TournamentDefaults | null | undefined,
): { homePosition?: number; awayPosition?: number } => {
  if (!match.group_id) return {};
  const group = groups.find((g) => g.id === match.group_id);
  const phase = phases.find((p) => p.id === match.phase_id);
  if (!group || ((phase as any)?.phase_type !== "group" && (phase as any)?.phase_type !== "round_robin")) return {};

  const standings = calculateGroupStandings(
    match.group_id,
    groupTeams,
    matches,
    groups,
    phases,
    scoringSystems,
    tournament,
  );

  return {
    homePosition: standings.find((r) => r.teamId === match.home_team_id)?.pos,
    awayPosition: standings.find((r) => r.teamId === match.away_team_id)?.pos,
  };
};
