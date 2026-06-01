interface SlotLike {
  slot_code: string;
  phase_id?: string | null;
  group_id?: string | null;
  ref_position?: number | null;
  ref_phase_id?: string | null;
  ref_group_id?: string | null;
}

interface PhaseLike { id: string; name: string; phase_type?: string | null; phase_number?: number | null; }
interface GroupLike { id: string; name: string; phase_id?: string | null; }
interface TeamLike { id: string; name: string; }

const isSlotCode = (label: string | null | undefined) => !!label && /^S\d+$/i.test(label);

const positionLabel = (position: number) => `${position}e`;

const shouldShowSourceFormatName = (sourcePhase: PhaseLike | null | undefined, phases?: PhaseLike[]) => {
  if (!sourcePhase || !phases?.length) return false;
  if (typeof sourcePhase.phase_number !== "number") return false;
  return phases.filter((phase) => phase.phase_number === sourcePhase.phase_number).length > 1;
};

const withSourceFormatName = (label: string, sourcePhase: PhaseLike | null | undefined, phases?: PhaseLike[]) => {
  if (!sourcePhase?.name || !shouldShowSourceFormatName(sourcePhase, phases)) return label;
  return `${label} (${sourcePhase.name})`;
};

export const getSlotReferenceLabel = (
  slotLabel: string | null | undefined,
  context: { slots?: SlotLike[]; phases?: PhaseLike[]; groups?: GroupLike[]; phaseId?: string | null; groupId?: string | null },
) => {
  if (!slotLabel) return null;
  if (!isSlotCode(slotLabel)) return slotLabel;

  const slot = (context.slots || []).find((entry) =>
    entry.slot_code === slotLabel &&
    (!context.phaseId || entry.phase_id === context.phaseId) &&
    (!context.groupId || !entry.group_id || entry.group_id === context.groupId)
  ) || (context.slots || []).find((entry) => entry.slot_code === slotLabel && (!context.phaseId || entry.phase_id === context.phaseId));

  if (!slot?.ref_position) return null;
  if (slot.ref_position === 0) return "BYE";

  const sourceGroup = slot.ref_group_id ? context.groups?.find((group) => group.id === slot.ref_group_id) : null;
  const sourcePhase = slot.ref_phase_id
    ? context.phases?.find((phase) => phase.id === slot.ref_phase_id)
    : sourceGroup?.phase_id
      ? context.phases?.find((phase) => phase.id === sourceGroup.phase_id)
      : null;

  if (sourcePhase?.phase_type === "single_match") {
    const matchIndex = Math.ceil(slot.ref_position / 2);
    return withSourceFormatName(`${slot.ref_position % 2 === 1 ? "Winnaar" : "Verliezer"} Wedstrijd ${matchIndex}`, sourcePhase, context.phases);
  }

  if (sourceGroup) return withSourceFormatName(`${positionLabel(slot.ref_position)} ${sourceGroup.name}`, sourcePhase, context.phases);

  if (slot.ref_position >= 100) {
    const tier = Math.floor(slot.ref_position / 100);
    const rank = slot.ref_position % 100;
    return `${positionLabel(rank)} nr.${tier}${sourcePhase?.name ? ` (${sourcePhase.name})` : ""}`;
  }

  return `${positionLabel(slot.ref_position)} positie${sourcePhase?.name ? ` (${sourcePhase.name})` : ""}`;
};

export const getMatchSideDisplayName = (
  match: { home_team_id?: string | null; away_team_id?: string | null; home_slot_label?: string | null; away_slot_label?: string | null; phase_id?: string | null; group_id?: string | null },
  side: "home" | "away",
  teams: TeamLike[],
  context: { slots?: SlotLike[]; phases?: PhaseLike[]; groups?: GroupLike[]; emptyLabel?: string },
) => {
  const teamId = side === "home" ? match.home_team_id : match.away_team_id;
  if (teamId) return teams.find((team) => team.id === teamId)?.name || "?";

  const slotLabel = side === "home" ? match.home_slot_label : match.away_slot_label;
  const reference = getSlotReferenceLabel(slotLabel, {
    ...context,
    phaseId: match.phase_id,
    groupId: match.group_id,
  });

  return reference || context.emptyLabel || "LEGE PLEK";
};