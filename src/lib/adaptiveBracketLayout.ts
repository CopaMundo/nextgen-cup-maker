/** Display geometry only: never reorders matches or changes their references. */
export function adaptiveBracketLayout(counts: number[], activeRound: number, cardHeight: number, gap: number) {
  const active = Math.max(0, Math.min(activeRound, counts.length - 1));
  const count = counts[active] ?? 0;
  const height = count * cardHeight + Math.max(0, count - 1) * gap;
  // Reserve the complete first-round tree even when the active cards converge.
  const firstCount = counts[0] ?? 0;
  const containerHeight = firstCount * cardHeight + Math.max(0, firstCount - 1) * gap;
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
  return { active, height, containerHeight, tops: centers.map(round => round.map(center => center - cardHeight / 2)) };
}