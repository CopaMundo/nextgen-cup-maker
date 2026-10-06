import type { RoundsStage } from "./drawPresentation";
import type { ScheduledMatch } from "./roundsSchedule";

/** Never publish hidden opponent identities to the fan picture. */
export function roundsStage(input: {
  groupName: string;
  order: string[];
  currentIndex: number;
  matches: ScheduledMatch[];
  pots: { name: string; teamIds: string[] }[];
  revealed: number[];
  revealTimes: Record<string, number>;
}): RoundsStage {
  const currentId = input.order[input.currentIndex];
  const known = new Set(input.revealed);
  const potIndex = (id: string) => input.pots.findIndex((pot) => pot.teamIds.includes(id));
  return {
    groupName: input.groupName,
    drawnTeamIds: input.order.slice(0, input.currentIndex + 1),
    fixtures: input.matches.flatMap((match, index) => {
      if (!currentId || (match.homeId !== currentId && match.awayId !== currentId)) return [];
      const opponent = match.homeId === currentId ? match.awayId : match.homeId;
      return [{ id: String(index), round: match.round, potName: input.pots[potIndex(opponent)]?.name ?? "Alle teams", home: match.homeId === currentId, opponentId: known.has(index) ? opponent : null, revealAt: known.has(index) ? input.revealTimes[String(index)] ?? null : null, potIndex: potIndex(opponent) }];
    }).sort((a, b) => a.potIndex - b.potIndex || a.round - b.round).map(({ potIndex: _, ...fixture }) => fixture),
  };
}