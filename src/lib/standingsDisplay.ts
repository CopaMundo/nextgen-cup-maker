/**
 * Display helpers voor klassement-tabellen.
 * - Bepaalt of een groep een sets-scoringsysteem gebruikt (zodat we
 *   SV/ST/S+/-/PV/PT kolommen tonen i.p.v. DV/DT/+/-).
 * - Aggregeert set-punten (PV/PT) op basis van match.set_scores.
 */

export interface DisplayMatch {
  home_team_id: string | null;
  away_team_id: string | null;
  home_score: number | null;
  away_score: number | null;
  is_played: boolean;
  group_id: string | null;
  phase_id: string;
  scoring_system_id?: string | null;
  set_scores?: { home: number | null; away: number | null }[] | null;
}

export interface DisplayGroup {
  id: string;
  phase_id: string;
  scoring_system_id?: string | null;
}

export interface DisplayPhase {
  id: string;
  scoring_system_id?: string | null;
}

export interface DisplayScoringSystem {
  id: string;
  scoring_type?: string;
  num_sets?: number;
}

/** Resolve het effectieve scoringsysteem voor een groep. */
const resolveGroupSystem = (
  groupId: string,
  groups: DisplayGroup[],
  phases: DisplayPhase[],
  scoringSystems: DisplayScoringSystem[],
): DisplayScoringSystem | null => {
  const g = groups.find((x) => x.id === groupId);
  if (!g) return scoringSystems[0] || null;
  let sys = g.scoring_system_id
    ? scoringSystems.find((s) => s.id === g.scoring_system_id)
    : undefined;
  if (!sys) {
    const p = phases.find((x) => x.id === g.phase_id);
    sys = p?.scoring_system_id
      ? scoringSystems.find((s) => s.id === p.scoring_system_id)
      : undefined;
  }
  if (!sys) sys = scoringSystems[0];
  return sys || null;
};

/** Toont deze groep set-kolommen i.p.v. doelpuntenkolommen? */
export const isSetsGroup = (
  groupId: string,
  groups: DisplayGroup[],
  phases: DisplayPhase[],
  scoringSystems: DisplayScoringSystem[],
): boolean => {
  const sys = resolveGroupSystem(groupId, groups, phases, scoringSystems);
  return !!sys && sys.scoring_type === "sets" && (sys.num_sets ?? 1) >= 2;
};

/**
 * Bereken som van set-punten per team binnen een groep.
 * Returnt Map<teamId, { pf, pa }> waarbij pf = punten voor in alle sets,
 * pa = punten tegen in alle sets.
 */
export const computeSetPointTotals = (
  groupId: string,
  matches: DisplayMatch[],
): Map<string, { pf: number; pa: number }> => {
  const out = new Map<string, { pf: number; pa: number }>();
  matches.forEach((m) => {
    if (!m.is_played) return;
    if (m.group_id !== groupId) return;
    if (!m.home_team_id || !m.away_team_id) return;
    const sets = Array.isArray(m.set_scores) ? m.set_scores : [];
    let homePts = 0;
    let awayPts = 0;
    for (const s of sets) {
      homePts += s?.home ?? 0;
      awayPts += s?.away ?? 0;
    }
    const h = out.get(m.home_team_id) || { pf: 0, pa: 0 };
    h.pf += homePts;
    h.pa += awayPts;
    out.set(m.home_team_id, h);
    const a = out.get(m.away_team_id) || { pf: 0, pa: 0 };
    a.pf += awayPts;
    a.pa += homePts;
    out.set(m.away_team_id, a);
  });
  return out;
};

/** Format een doelsaldo / setsaldo met expliciet +/- teken. */
export const formatSigned = (n: number): string => (n > 0 ? `+${n}` : `${n}`);

export interface PointsColumnsConfig {
  gp: boolean; w: boolean; d: boolean; l: boolean;
  gf: boolean; ga: boolean; gd: boolean;
}
export interface SetsColumnsConfig {
  gp: boolean; w: boolean; d: boolean; l: boolean;
  sf: boolean; sa: boolean; sd: boolean;
  pf: boolean; pa: boolean; pd: boolean;
}
export interface StandingsColumnsConfig {
  points: PointsColumnsConfig;
  sets: SetsColumnsConfig;
}

export const DEFAULT_STANDINGS_COLUMNS: StandingsColumnsConfig = {
  points: { gp: true, w: true, d: true, l: true, gf: true, ga: true, gd: true },
  sets:   { gp: true, w: true, d: true, l: true, sf: true, sa: true, sd: true, pf: false, pa: false, pd: false },
};

/** Resolve de kolomzichtbaarheid uit tournament.standings_columns met defaults. */
export const resolveStandingsColumns = (raw: any): StandingsColumnsConfig => {
  const r = raw || {};
  return {
    points: { ...DEFAULT_STANDINGS_COLUMNS.points, ...(r.points || {}) },
    sets:   { ...DEFAULT_STANDINGS_COLUMNS.sets,   ...(r.sets   || {}) },
  };
};
