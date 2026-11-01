/** Display geometry only: never reorders matches or changes their references. */
export function adaptiveBracketLayout(counts: number[], activeRound: number, cardHeight: number, gap: number) {
  const active = Math.max(0, Math.min(activeRound, counts.length - 1));
  const count = counts[active] ?? 0;
  const height = count * cardHeight + Math.max(0, count - 1) * gap;
  const centers: number[][] = [];
  counts.forEach((size, round) => {
    const previous = centers[round - 1];
    centers.push(Array.from({ length: size }, (_, index) => {
      if (round <= active || !previous) return index * (cardHeight + gap) + cardHeight / 2;
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
