interface LegScore {
  home_score: number | null;
  away_score: number | null;
}

/** Sum both legs in the first leg's team orientation, including a partial tie. */
export function bracketAggregate(first: LegScore, second: LegScore) {
  return {
    homeTotal: (first.home_score ?? 0) + (second.away_score ?? 0),
    awayTotal: (first.away_score ?? 0) + (second.home_score ?? 0),
  };
}