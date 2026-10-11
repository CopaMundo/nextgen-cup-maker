import type { DrawContainer } from "./liveDraw";

/** Only complete the final pot when the entire eligible roster fits exactly. */
export function completeLastDrawPot<T extends { teamIds: string[] }>(pots: T[], availableIds: string[], capacities: number[]): T[] {
  if (pots.length < 2 || new Set(availableIds).size !== capacities.reduce((sum, size) => sum + size, 0)) return pots;
  if (pots.slice(0, -1).some((pot, index) => pot.teamIds.length !== capacities[index])) return pots;
  const assigned = pots.flatMap(pot => pot.teamIds);
  if (new Set(assigned).size !== assigned.length || assigned.some(id => !availableIds.includes(id))) return pots;
  const last = pots[pots.length - 1];
  const remaining = availableIds.filter(id => !assigned.includes(id));
  if (last.teamIds.length + remaining.length !== capacities[capacities.length - 1] || !remaining.length) return pots;
  return pots.map((pot, index) => index === pots.length - 1 ? { ...pot, teamIds: [...pot.teamIds, ...remaining] } : pot);
}

export function defaultDrawSeedCount(teamCount: number): number {
  return Math.max(2, Math.floor(teamCount / 2));
}

/** Prefer one pot per group position, otherwise the nearest small equal split. */
export function defaultDrawPotCount(size: number, preferred = 4): number | null {
  const options = Array.from({ length: Math.max(0, size) }, (_, i) => i + 1)
    .filter(count => count >= 2 && count < size && size % count === 0);
  if (size === 2) return 2;
  return options.sort((a, b) => Math.abs(a - preferred) - Math.abs(b - preferred) || a - b)[0] ?? null;
}

/** Update only an explicitly chosen entry position; never move another seed. */
export function placeDrawSeed(containers: DrawContainer[], fixtureId: string, side: number, teamId: string | null): DrawContainer[] {
  if (teamId && containers.some(c => c.id !== fixtureId ? c.teamIds.includes(teamId) : c.matchSlots?.some((id, index) => index !== side && id === teamId))) return containers;
  const ranks = new Set(containers.flatMap(c => c.seedRanks ?? []).filter(rank => rank != null));
  let nextRank = 1;
  while (ranks.has(nextRank)) nextRank++;
  return containers.map(c => {
    if (c.id !== fixtureId) return c;
    const matchSlots = [...(c.matchSlots ?? [null, null])];
    const seedRanks = [...(c.seedRanks ?? [null, null])];
    matchSlots[side] = teamId;
    seedRanks[side] = teamId ? seedRanks[side] ?? nextRank : null;
    return { ...c, matchSlots, seedRanks, teamIds: matchSlots.filter((id): id is string => Boolean(id)) };
  });
}