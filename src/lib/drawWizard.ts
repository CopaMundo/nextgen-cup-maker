import type { DrawContainer } from "./liveDraw";

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