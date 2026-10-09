import type { DrawSessionState } from "./drawSession";
import type { DrawStudioTheme } from "./drawStudio";

export interface DrawPresentation {
  tournamentName?: string;
  theme?: DrawStudioTheme;
  language?: string;
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
  roster?: { teamId: string; completedAt?: number | null; opponents: { id: string; opponentId: string; revealAt: number | null }[] }[];
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

export interface GroupDrawLayout {
  mode: "A" | "B" | "C";
  wingColumns: number;
  wingRows: number;
  teamColumns: number;
}

export type GroupWingDensity = "royal" | "comfortable" | "standard" | "compact" | "logo-only";

/** Five studio profiles, selected independently from each wing's actual load. */
export function calculateWingDensity(containers: DrawSessionState["containers"], layout: GroupDrawLayout): GroupWingDensity {
  if (layout.mode === "C") return "logo-only";
  // Density follows the real vertical occupancy per team column, so split
  // cards and side-by-side wings with few teams still get readable sizes.
  const wingRows = Math.max(1, Math.ceil(containers.length / layout.wingColumns));
  const slotRows = Math.max(0, ...containers.map((container) => Math.ceil(container.capacity / layout.teamColumns)));
  const load = wingRows * slotRows;
  if (layout.mode === "A" && layout.teamColumns === 1 && wingRows === 1 && slotRows <= 5) return "royal";
  if (wingRows <= 2 && load <= 16) return "comfortable";
  if (layout.mode === "B") return load <= 24 ? "standard" : "compact";
  return "standard";
}

/** Fixed 16:9 wing budgets preserve names before falling back to logo tiles. */
export function calculateGroupLayout(containers: DrawSessionState["containers"]): GroupDrawLayout {
  const count = containers.length;
  const capacity = Math.max(0, ...containers.map((container) => container.capacity));
  const nameLimit = count <= 2 ? 32 : count <= 4 ? 16 : 12;
  const mode = count <= 6 && capacity <= nameLimit ? "A"
    : count <= 12 && capacity <= (count <= 8 ? 8 : 5) ? "B" : "C";
  const wingColumns = mode === "A" || count <= 2 ? 1
    : mode === "C" && count > 24 ? Math.ceil(Math.sqrt(Math.ceil(count / 2) / 2)) : 2;
  const wingRows = Math.max(1, Math.ceil(Math.ceil(count / 2) / wingColumns));
  const splitThreshold = count <= 2 ? 16 : count <= 4 ? 8 : 6;
  const teamColumns = mode === "C" ? Math.max(1, Math.ceil(Math.sqrt(capacity * wingRows / wingColumns)))
    : mode === "A" && capacity > splitThreshold ? 2 : 1;
  return { mode, wingColumns, wingRows, teamColumns };
}