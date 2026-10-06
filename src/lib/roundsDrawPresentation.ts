import type { RoundsStage } from "./drawPresentation";
import type { ScheduledMatch } from "./roundsSchedule";

export const opponentRevealDuration = 500;

/** Show order is independent of scheduled round numbers. */
export function orderedTeamFixtures(matches: ScheduledMatch[], teamId: string, pots: { teamIds: string[] }[], revealed: number[], usePots: boolean) {
  const known = new Set(revealed);
  const potIndex = (id: string) => pots.findIndex((pot) => pot.teamIds.includes(id));
  return matches.map((m, i) => ({ m, i, opp: m.homeId === teamId ? m.awayId : m.homeId }))
    .filter(({ m }) => m.homeId === teamId || m.awayId === teamId)
    .sort((a, b) => Number(known.has(b.i)) - Number(known.has(a.i)) || (usePots ? potIndex(a.opp) - potIndex(b.opp) : 0));
}

/** A single twelve-team list advances only when a new team is drawn. */
export function roundsRosterWindow(order: string[], activeId: string | undefined) {
  const size = 12;
  if (order.length <= size) return order;
  const index = Math.max(0, order.indexOf(activeId ?? ""));
  const start = Math.max(0, index - size + 1);
  return order.slice(start, start + size);
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
  const earlier = new Set(input.order.slice(0, input.currentIndex));
  const previouslyKnown = input.matches.flatMap((match, index) => known.has(index) && (earlier.has(match.homeId) || earlier.has(match.awayId)) ? [index] : []);
  const drawnTeamIds = input.order.slice(0, input.currentIndex + 1);
  return {
    groupName: input.groupName,
    drawnTeamIds,
    teamOrder: input.order,
    roster: drawnTeamIds.map((teamId) => ({ teamId, opponents: orderedTeamFixtures(input.matches, teamId, input.pots, [], input.usePots ?? input.pots.length > 1)
      .filter(({ i }) => known.has(i)).map(({ i, opp }) => ({ id: String(i), opponentId: opp, revealAt: input.revealTimes[String(i)] ?? null })) })),
    fixtures: currentId ? orderedTeamFixtures(input.matches, currentId, input.pots, previouslyKnown, input.usePots ?? input.pots.length > 1).map(({ m, i, opp }) => ({
      id: String(i), round: m.round, potName: input.pots.find((pot) => pot.teamIds.includes(opp))?.name ?? "Alle teams",
      home: m.homeId === currentId, opponentId: known.has(i) ? opp : null, revealAt: known.has(i) ? input.revealTimes[String(i)] ?? null : null,
    })) : [],
  };
}