/**
 * Centralized helper to compute the format suffix for a match name,
 * e.g. " (Heen)", " (Terug)", " (5 sets)", " (beste van 5)".
 *
 * The suffix is appended to the match base name in UI labels across
 * the admin tools (ResultsManager, MatchScheduler, BracketView) and
 * the public view (PublicMatchCard, PublicBracketSection).
 */

export interface MatchLikeForLabel {
  match_name?: string | null;
  scoring_system_id?: string | null;
  phase_id?: string | null;
  group_id?: string | null;
}

export interface ScoringSystemLike {
  id: string;
  scoring_type?: string | null;
  num_sets?: number | null;
  playoff_mode?: boolean | null;
}

export interface PhaseLike {
  id: string;
  scoring_system_id?: string | null;
}

export interface GroupLike {
  id: string;
  phase_id?: string | null;
  scoring_system_id?: string | null;
}

/** Strip (Heen)/(Terug) suffix from match_name. */
export const getBaseMatchName = (name: string | null | undefined): string => {
  if (!name) return "";
  return name.replace(/\s+\((Heen|Terug)\)$/, "").trim();
};

/** Returns "Heen" | "Terug" | null based on the match_name suffix. */
export const getHALeg = (name: string | null | undefined): "Heen" | "Terug" | null => {
  if (!name) return null;
  const m = name.match(/\((Heen|Terug)\)\s*$/);
  return (m?.[1] as "Heen" | "Terug" | null) ?? null;
};

/** Resolve the effective scoring system for a match (match → group → phase). */
export const resolveScoringSystem = (
  match: MatchLikeForLabel,
  scoringSystems: ScoringSystemLike[],
  phases: PhaseLike[],
  groups: GroupLike[]
): ScoringSystemLike | undefined => {
  const find = (id: string | null | undefined) =>
    id ? scoringSystems.find((s) => s.id === id) : undefined;
  let sys = find(match.scoring_system_id);
  if (!sys && match.group_id) {
    const g = groups.find((x) => x.id === match.group_id);
    sys = find(g?.scoring_system_id);
  }
  if (!sys && match.phase_id) {
    const p = phases.find((x) => x.id === match.phase_id);
    sys = find(p?.scoring_system_id);
  }
  return sys;
};

/**
 * Build the format suffix for a given match.
 * Combines H&A leg + sets/best-of label, e.g. " (Heen) (beste van 5)".
 *
 * Options:
 *   - includeLeg: when true, append "(Heen)" / "(Terug)" derived from match_name.
 *   - includeScoring: when true, append "(N sets)" or "(beste van N)".
 *   - haPairLabel: when set (e.g. "Home & Away"), used for the bracket chip
 *     where one chip represents both legs — overrides the leg suffix.
 */
export const getMatchFormatSuffix = (
  match: MatchLikeForLabel,
  scoringSystems: ScoringSystemLike[],
  phases: PhaseLike[],
  groups: GroupLike[],
  options?: { includeLeg?: boolean; includeScoring?: boolean; haPairLabel?: string }
): string => {
  const includeLeg = options?.includeLeg !== false;
  const includeScoring = options?.includeScoring !== false;

  const parts: string[] = [];

  if (options?.haPairLabel) {
    parts.push(`(${options.haPairLabel})`);
  } else if (includeLeg) {
    const leg = getHALeg(match.match_name);
    if (leg) parts.push(`(${leg})`);
  }

  if (includeScoring) {
    const sys = resolveScoringSystem(match, scoringSystems, phases, groups);
    if (sys && sys.scoring_type === "sets") {
      const n = Math.max(1, sys.num_sets ?? 1);
      if (n >= 2) {
        parts.push(sys.playoff_mode ? `(beste van ${n})` : `(${n} sets)`);
      }
    }
  }

  return parts.length ? ` ${parts.join(" ")}` : "";
};

/**
 * Convenience: return the full display name, i.e. base + format suffix.
 * Examples:
 *   "Halve finale" + H&A heen → "Halve finale (Heen)"
 *   "Plaats 1-2" + best-of-5  → "Plaats 1-2 (beste van 5)"
 */
export const getMatchDisplayName = (
  match: MatchLikeForLabel,
  scoringSystems: ScoringSystemLike[],
  phases: PhaseLike[],
  groups: GroupLike[],
  options?: { includeLeg?: boolean; includeScoring?: boolean; baseOverride?: string }
): string => {
  const base =
    options?.baseOverride ??
    (getHALeg(match.match_name) ? getBaseMatchName(match.match_name) : (match.match_name ?? ""));
  const suffix = getMatchFormatSuffix(match, scoringSystems, phases, groups, options);
  return `${base}${suffix}`.trim();
};
