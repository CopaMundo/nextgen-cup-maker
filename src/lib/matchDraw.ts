import type { DrawContainer, DrawPot } from "./liveDraw";

export interface MatchDrawSlot {
  id: string;
  group_id: string | null;
  slot_code: string;
  sort_order: number;
  team_id: string | null;
}
export interface MatchDrawFixture {
  id: string;
  group_id: string | null;
  home_slot_label: string | null;
  away_slot_label: string | null;
  round_number: number | null;
  match_name: string | null;
}

/** Only encounters backed by entry slots participate; return legs share one card. */
export function matchDrawContainers(slots: MatchDrawSlot[], matches: MatchDrawFixture[], seeded: boolean): DrawContainer[] {
  const byCode = new Map(slots.map(slot => [`${slot.group_id}|${slot.slot_code}`, slot]));
  const seen = new Set<string>();
  return [...matches].sort((a, b) => (a.round_number ?? 1) - (b.round_number ?? 1) || (a.match_name ?? "").localeCompare(b.match_name ?? "", "nl", { numeric: true }))
    .flatMap(match => {
      if (/\(Terug\)$/i.test(match.match_name ?? "")) return [];
      const home = byCode.get(`${match.group_id}|${match.home_slot_label}`);
      const away = byCode.get(`${match.group_id}|${match.away_slot_label}`);
      if (!home || !away) return [];
      const key = [home.id, away.id].sort().join("|");
      if (seen.has(key)) return [];
      seen.add(key);
      const matchSlots = [home.team_id, away.team_id];
      return [{ id: match.id, name: `Wedstrijd ${seen.size}`, capacity: 2, slotIds: [home.id, away.id], teamIds: matchSlots.filter((id): id is string => Boolean(id)), matchSlots, groupId: match.group_id, matchNumber: seen.size,
        // Assigned entry positions are fixed. Explicit ranks can be edited before starting.
        seedRanks: seeded ? matchSlots.map((id, index) => id ? Number((index === 0 ? home : away).slot_code.replace(/^S/i, "")) || null : null) : [null, null] }];
    }).sort((a, b) => {
      const aSlot = slots.find(slot => slot.id === a.slotIds[0]);
      const bSlot = slots.find(slot => slot.id === b.slotIds[0]);
      return (aSlot?.sort_order ?? 0) - (bSlot?.sort_order ?? 0);
    }).map((container, index) => ({ ...container, name: `Wedstrijd ${index + 1}`, matchNumber: index + 1 }));
}

export function nextMatchContainer(containers: DrawContainer[]) {
  return containers.find(container => container.matchSlots?.some(id => !id));
}

export function nextMatchPot(containers: DrawContainer[], pots: DrawPot[]) {
  const container = nextMatchContainer(containers);
  const side = container?.matchSlots?.findIndex(id => !id) ?? -1;
  return side < 0 ? null : pots[side] ?? null;
}

export function matchPotCapacity(containers: DrawContainer[], side: number) {
  return containers.filter(container => !container.matchSlots?.[side]).length;
}

/** Fixed halves. Large shows expose exactly one 16-encounter segment at a time. */
export function matchDrawPage(containers: DrawContainer[], targetId: string | null | undefined, finished: boolean, now: number) {
  const half = Math.ceil(containers.length / 2);
  if (containers.length <= 32) return { left: containers.slice(0, half), right: containers.slice(half), segment: 0 };
  const target = Math.max(0, containers.findIndex(container => container.id === targetId));
  const segments = [containers.slice(0, half).slice(0, 16), containers.slice(0, half).slice(16), containers.slice(half).slice(0, 16), containers.slice(half).slice(16)];
  const segment = finished ? Math.floor(now / 6500) % 4 : target < half ? Math.floor(target / 16) : 2 + Math.floor((target - half) / 16);
  return { left: segment < 2 ? segments[segment] : [], right: segment >= 2 ? segments[segment] : [], segment };
}