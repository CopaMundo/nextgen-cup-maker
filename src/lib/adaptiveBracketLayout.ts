/** Display geometry only: never reorders matches or changes their references. */
export function adaptiveBracketLayout(counts: number[], activeRound: number, cardHeight: number, gap: number, feeders?: number[][][]) {
  const active = Math.max(0, Math.min(activeRound, counts.length - 1));
  const count = counts[active] ?? 0;
  const height = count * cardHeight + Math.max(0, count - 1) * gap;
  const centers: number[][] = [];
  counts.forEach((size, round) => {
    const previous = centers[round - 1];
    centers.push(Array.from({ length: size }, (_, index) => {
      if (round <= active || !previous) return index * (cardHeight + gap) + cardHeight / 2;
      const sources = (feeders?.[round]?.[index] ?? []).filter(source => source >= 0 && source < previous.length);
      if (sources.length > 0) return sources.reduce((sum, source) => sum + previous[source], 0) / sources.length;
      if (previous.length === size * 2) return ((previous[index * 2] ?? 0) + (previous[index * 2 + 1] ?? 0)) / 2;
      if (previous.length === size) return previous[index] ?? cardHeight / 2;
      return height / size * (index + 0.5);
    }));
  });
  return { active, height, tops: centers.map(round => round.map(center => center - cardHeight / 2)) };
}
/** CSS value interpolated by the rail's --bf (0 at the base round, 1 at the next round). */
export function bracketLerp(from: number, to: number, unit = "px") {
  if (Math.abs(to - from) < 0.01) return `${from}${unit}`;
  return `calc(${from}${unit} + ${to - from}${unit} * var(--bf, 0))`;
}

/** Follow the source encounter, not whichever successor happens to be nearest. */
export function bracketSuccessorIndex(source: number, sourceCount: number, targetCount: number) {
  if (sourceCount <= 0 || targetCount <= 0) return 0;
  return Math.min(targetCount - 1, Math.floor(source * targetCount / sourceCount));
}

interface FeederMatch { match_name?: string | null; home_slot_label?: string | null; away_slot_label?: string | null }
const baseName = (name: string) => name.replace(/\s+\((Heen|Terug)\)$/i, "").trim().toLowerCase();

/** Previous-round indices that feed each match ("Winnaar <match>"), so later cards center between their real feeders. */
export function bracketFeederIndices(rounds: FeederMatch[][]): number[][][] {
  return rounds.map((matches, round) => {
    const previous = rounds[round - 1];
    if (!previous) return matches.map(() => []);
    const byName = new Map<string, number>();
    previous.forEach((match, index) => { if (match.match_name) byName.set(baseName(match.match_name), index); });
    return matches.map(match => [match.home_slot_label, match.away_slot_label].flatMap(label => {
      const ref = (label ?? "").match(/^Winnaar\s+(.+)$/i);
      const index = ref ? byName.get(baseName(ref[1])) : undefined;
      return index === undefined ? [] : [index];
    }));
  });
}

/** Display-only: order each later round by its feeders' positions so stacked rounds never cross (e.g. QF3 created before QF1). */
export function orderRoundsByFeeders<M extends FeederMatch>(rounds: M[][]): M[][] {
  const ordered: M[][] = [];
  rounds.forEach((matches, round) => {
    if (round === 0) { ordered.push([...matches]); return; }
    const feeders = bracketFeederIndices([ordered[round - 1], matches])[1];
    const keyed = matches.map((match, index) => {
      const sources = feeders[index];
      return { match, index, key: sources.length ? Math.min(...sources) : Number.POSITIVE_INFINITY };
    });
    keyed.sort((a, b) => (a.key === b.key ? a.index - b.index : a.key - b.key));
    ordered.push(keyed.map(entry => entry.match));
  });
  return ordered;
}
