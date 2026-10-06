import type { DrawSessionState } from "./drawSession";

export interface DrawPresentation {
  revealAt: number;
  speed: number;
  activePotId: string | null;
  selection: { targetId: string; startedAt: number } | null;
  sweep?: { startedAt: number; optionIds: string[] } | null;
  rounds?: RoundsStage;
}

export interface RoundsStage {
  groupName: string;
  drawnTeamIds: string[];
  teamOrder?: string[];
  roster?: { teamId: string; opponents: { id: string; opponentId: string; revealAt: number | null }[] }[];
  fixtures: { id: string; round: number; potName: string; home: boolean; opponentId: string | null; revealAt: number | null }[];
}

export interface DrawPicture {
  session: DrawSessionState;
  spotlightId: string | null;
  presentation?: DrawPresentation;
}

export const revealDuration = (speed: number) => 1900 / speed;
export const selectionDuration = (speed: number) => 2100 / speed;
export const sweepDuration = (count: number, speed: number) => Math.max(12, count * 3) * 100 / speed;

export function sweepSpotlight(presentation: DrawPresentation | undefined, now: number) {
  const sweep = presentation?.sweep;
  if (!sweep?.optionIds.length) return null;
  const index = Math.floor(Math.max(0, now - sweep.startedAt) * presentation.speed / 100);
  return sweep.optionIds[index % sweep.optionIds.length];
}

export function stageSelection(presentation: DrawPresentation | undefined, now: number) {
  if (!presentation?.selection) return "idle";
  const elapsed = (now - presentation.selection.startedAt) * presentation.speed;
  return elapsed < 850 ? "hold" : elapsed < 2100 ? "transfer" : "complete";
}

/** Use a fixed slot height budget, not a team-count guess, to choose the overview. */
export function needsGroupOverview(containers: DrawSessionState["containers"]) {
  const split = Math.ceil(containers.length / 2);
  const rows = Math.max(1, Math.ceil(split / 2));
  return containers.some((container) => container.capacity > 12 || container.capacity * rows > 20);
}