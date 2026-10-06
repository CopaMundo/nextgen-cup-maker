import type { RoundsStage } from "./drawPresentation";
import type { ScheduledMatch } from "./roundsSchedule";

export const opponentRevealDuration = 500;

/** Show order is independent of scheduled round numbers. */
export function orderedTeamFixtures(matches: ScheduledMatch[], teamId: string, pots: { teamIds: string[] }[], revealed: number[], usePots: boolean) {
  const known = new Set(revealed);
  const potIndex = (id: string) => pots.findIndex((pot) => pot.teamIds.includes(id));
  return matches.map((m, i) => ({ m, i, opp: m.homeId === teamId ? m.awayId : m.homeId }))
    .filter(({ m }) => m.homeId === teamId || m.awayId === teamId)
    .sort((a, b) => usePots ? potIndex(a.opp) - potIndex(b.opp) : Number(known.has(b.i)) - Number(known.has(a.i)));
}

/** Never publish hidden opponent identities to the fan picture. */
export function roundsStage(input: {
  groupName: string;
  order: string[];
  currentIndex: number;
  matches: ScheduledMatch[];
  pots: { name: string; teamIds: string[] }[];
  revealed: number[];
  revealTimes: Record<string, number>;
  usePots?: boolean;
}): RoundsStage {
  const currentId = input.order[input.currentIndex];
  const known = new Set(input.revealed);
  return {
    groupName: input.groupName,
    drawnTeamIds: input.order.slice(0, input.currentIndex + 1),
    fixtures: currentId ? orderedTeamFixtures(input.matches, currentId, input.pots, input.revealed, input.usePots ?? input.pots.length > 1).map(({ m, i, opp }) => ({
      id: String(i), round: m.round, potName: input.pots.find((pot) => pot.teamIds.includes(opp))?.name ?? "Alle teams",
      home: m.homeId === currentId, opponentId: known.has(i) ? opp : null, revealAt: known.has(i) ? input.revealTimes[String(i)] ?? null : null,
    })) : [],
  };
}