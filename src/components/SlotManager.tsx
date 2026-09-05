import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ChevronDown, User, ArrowRight, X, ArrowLeftRight } from "lucide-react";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { SortableRowShell } from "@/components/SortableList";

interface Slot {
  id: string;
  slot_code: string;
  sort_order: number;
  team_id: string | null;
  ref_phase_id: string | null;
  ref_group_id: string | null;
  ref_position: number | null;
  group_id: string | null;
}

interface Team {
  id: string;
  name: string;
  logo_url: string | null;
  category_id: string | null;
}

interface Phase {
  id: string;
  name: string;
  phase_number: number;
  phase_type: string;
  category_id?: string | null;
}

interface GroupInfo {
  id: string;
  name: string;
  phase_id: string;
}

interface MatchReferenceLabel {
  id: string;
  home_slot_label: string | null;
  away_slot_label: string | null;
}

interface SlotManagerProps {
  tournamentId: string;
  phaseId: string;
  groupId: string;
  groupName: string;
  phaseNumber: number;
  phases: Phase[];
  categoryId?: string | null;
  refreshKey?: number;
  onSlotChange?: () => void;
}

const SlotManager = ({ tournamentId, phaseId, groupId, groupName, phaseNumber, phases, categoryId, refreshKey, onSlotChange }: SlotManagerProps) => {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [allSlots, setAllSlots] = useState<Slot[]>([]);
  const [allMatches, setAllMatches] = useState<MatchReferenceLabel[]>([]);
  const [allGroups, setAllGroups] = useState<GroupInfo[]>([]);
  const [groupTeamCounts, setGroupTeamCounts] = useState<Record<string, number>>({});
  const [openSlotId, setOpenSlotId] = useState<string | null>(null);
  const [swappedTiers, setSwappedTiers] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  const currentPhase = phases.find((p) => p.id === phaseId);
  const activeCategoryId = currentPhase?.category_id ?? categoryId ?? null;
  const scopedPhases = activeCategoryId
    ? phases.filter((p) => p.category_id === activeCategoryId)
    : phases;
  const scopedPhaseIds = scopedPhases.map((p) => p.id);
  const phaseScopeKey = [...scopedPhaseIds].sort().join("|");

  useEffect(() => {
    fetchData();
  }, [groupId, refreshKey, phaseScopeKey]);

  useEffect(() => {
    const handleSwapMode = (event: Event) => {
      const detail = (event as CustomEvent<{ tierKey: string; active: boolean }>).detail;
      if (!detail?.tierKey) return;

      setSwappedTiers((prev) => {
        const next = new Set(prev);
        if (detail.active) next.add(detail.tierKey);
        else next.delete(detail.tierKey);
        return next;
      });
    };

    window.addEventListener("tier-swap-mode-change", handleSwapMode as EventListener);
    return () => window.removeEventListener("tier-swap-mode-change", handleSwapMode as EventListener);
  }, []);

  const fetchData = async () => {
    const phaseIdsForScope = scopedPhaseIds.length > 0 ? scopedPhaseIds : [phaseId];

    const [slotsRes, teamsRes, allSlotsRes, matchesRes, groupsRes, gtRes] = await Promise.all([
      supabase.from("slots").select("*").eq("group_id", groupId).order("sort_order"),
      supabase.from("teams").select("id, name, logo_url, category_id").eq("tournament_id", tournamentId).order("name"),
      supabase.from("slots").select("*").in("phase_id", phaseIdsForScope),
      supabase.from("matches").select("id, home_slot_label, away_slot_label").eq("tournament_id", tournamentId).in("phase_id", phaseIdsForScope),
      supabase.from("groups").select("id, name, phase_id").in("phase_id", phaseIdsForScope).order("created_at"),
      supabase.from("group_teams").select("group_id").eq("tournament_id", tournamentId),
    ]);
    if (slotsRes.data) setSlots(slotsRes.data as any);
    if (teamsRes.data) setTeams(teamsRes.data as any);
    if (allSlotsRes.data) setAllSlots(allSlotsRes.data as any);
    if (matchesRes.data) setAllMatches(matchesRes.data as any);
    if (groupsRes.data) setAllGroups(groupsRes.data as any);
    if (gtRes.data) {
      const counts: Record<string, number> = {};
      for (const row of gtRes.data) {
        counts[row.group_id] = (counts[row.group_id] || 0) + 1;
      }
      setGroupTeamCounts(counts);
    }
  };

  const currentPhaseNumber = currentPhase?.phase_number ?? phaseNumber;

  // Include all phases with the same phase_number (sibling formats)
  const siblingPhaseIds = new Set(
    scopedPhases.filter((p) => p.phase_number === currentPhaseNumber).map((p) => p.id)
  );
  const siblingGroupIds = new Set(allGroups.filter((g) => siblingPhaseIds.has(g.phase_id)).map((g) => g.id));

  const assignedTeamIds = new Set(
    allSlots.filter((s) => s.group_id && siblingGroupIds.has(s.group_id) && s.team_id).map((s) => s.team_id!)
  );

  const previousPhases = scopedPhases.filter((p) => p.phase_number < currentPhaseNumber);
  const previousPhaseIds = new Set(previousPhases.map((p) => p.id));
  const previousPhaseGroupIds = new Set(allGroups.filter((g) => previousPhaseIds.has(g.phase_id)).map((g) => g.id));
  const teamsUsedInEarlierPhases = new Set(
    allSlots.filter((s) => s.group_id && previousPhaseGroupIds.has(s.group_id) && s.team_id).map((s) => s.team_id!)
  );

  const currentFormatGroupIds = new Set(allGroups.filter((g) => g.phase_id === phaseId).map((g) => g.id));

  const getGroupSourceKey = (sourcePhaseId: string, sourceGroupId: string, position: number) => `${sourcePhaseId}|${sourceGroupId}|${position}`;
  const getCrossSourceKey = (sourcePhaseId: string, tier: number, rank: number) => `${sourcePhaseId}|${tier}|${rank}`;
  const getTierPhaseKey = (sourcePhaseId: string, tier: number) => `${sourcePhaseId}|${tier}`;

  // A source position may only be used once across all scoped formats/phases in this category.
  const usedGroupSourceKeys = new Set(
    allSlots
      .filter(s => s.ref_phase_id && s.ref_group_id && s.ref_position)
      .map(s => getGroupSourceKey(s.ref_phase_id!, s.ref_group_id!, s.ref_position!))
  );

  // Cross-ranking selections are also globally unique across scoped formats/phases.
  const usedCrossSourceKeys = new Set(
    allSlots
      .filter(s => s.ref_phase_id && !s.ref_group_id && s.ref_position && s.ref_position >= 100)
      .map(s => getCrossSourceKey(s.ref_phase_id!, Math.floor(s.ref_position! / 100), s.ref_position! % 100))
  );

  const crossModeTierPhaseKeys = new Set(
    allSlots
      .filter(s => s.ref_phase_id && !s.ref_group_id && s.ref_position && s.ref_position >= 100)
      .map(s => getTierPhaseKey(s.ref_phase_id!, Math.floor((s.ref_position as number) / 100)))
  );

  const categoryFilteredTeams = activeCategoryId
    ? teams.filter(t => t.category_id === activeCategoryId)
    : teams;

  const availableTeams = categoryFilteredTeams.filter(t => {
    if (assignedTeamIds.has(t.id)) return false;
    if (phaseNumber > 1 && teamsUsedInEarlierPhases.has(t.id)) return false;
    return true;
  });

  const buildGroupReferenceLabel = (position: number, sourceGroupName: string, sourceFormatName?: string | null) =>
    `${position}e ${sourceGroupName}${sourceFormatName ? ` (${sourceFormatName})` : ""}`;

  const buildCrossReferenceLabel = (rank: number, tier: number, sourceFormatName?: string | null) =>
    `${rank}e nr.${tier}${sourceFormatName ? ` (${sourceFormatName})` : ""}`;

  const getGroupedByPosition = () => {
    const codes: Record<number, { label: string; phaseId: string; groupId: string | null; position: number; formatName: string; groupName: string }[]> = {};
    // Knockout phases produce final placements — skip them; only group/round_robin/single_match positions are selectable
    const eligiblePrevPhases = previousPhases.filter(p => p.phase_type !== "knockout");
    for (const pp of eligiblePrevPhases) {
      const ppGroups = allGroups
        .filter(g => g.phase_id === pp.id)
        .sort((a, b) => a.name.localeCompare(b.name, "nl", { sensitivity: "base", numeric: true }));
      for (const g of ppGroups) {
        const teamCount = groupTeamCounts[g.id] || 0;
        const groupSlots = allSlots.filter(s => s.group_id === g.id);
        const count = teamCount > 0 ? teamCount : Math.max(groupSlots.length, 4);
        for (let pos = 1; pos <= count; pos++) {
          if (!codes[pos]) codes[pos] = [];
          codes[pos].push({
            label: buildGroupReferenceLabel(pos, g.name, pp.name),
            phaseId: pp.id,
            groupId: g.id,
            position: pos,
            formatName: pp.name,
            groupName: g.name,
          });
        }
      }
    }
    return codes;
  };

  const syncSlotToGroupTeamsAndMatches = async (slot: Slot, teamId: string | null, oldTeamId: string | null) => {
    if (oldTeamId && slot.group_id) {
      await supabase.from("group_teams").delete()
        .eq("group_id", slot.group_id)
        .eq("team_id", oldTeamId)
        .eq("tournament_id", tournamentId);
    }
    if (teamId && slot.group_id) {
      const { data: existing } = await supabase.from("group_teams")
        .select("id")
        .eq("group_id", slot.group_id)
        .eq("team_id", teamId)
        .eq("tournament_id", tournamentId)
        .maybeSingle();
      if (!existing) {
        await supabase.from("group_teams").insert({
          group_id: slot.group_id,
          team_id: teamId,
          tournament_id: tournamentId,
        });
      }
    }
    if (slot.slot_code) {
      let homeUpdate = supabase.from("matches").update({ home_team_id: teamId }).eq("tournament_id", tournamentId).eq("phase_id", phaseId).eq("home_slot_label", slot.slot_code);
      let awayUpdate = supabase.from("matches").update({ away_team_id: teamId }).eq("tournament_id", tournamentId).eq("phase_id", phaseId).eq("away_slot_label", slot.slot_code);
      if (slot.group_id) {
        homeUpdate = homeUpdate.eq("group_id", slot.group_id);
        awayUpdate = awayUpdate.eq("group_id", slot.group_id);
      } else {
        homeUpdate = homeUpdate.is("group_id", null);
        awayUpdate = awayUpdate.is("group_id", null);
      }
      await homeUpdate;
      await awayUpdate;
    }
  };

  const updateMatchSlotLabels = async (slot: Slot, newSlotCode: string) => {
    if (slot.slot_code === newSlotCode) return;
    let homeUpdate = supabase.from("matches").update({ home_slot_label: newSlotCode }).eq("tournament_id", tournamentId).eq("phase_id", phaseId).eq("home_slot_label", slot.slot_code);
    let awayUpdate = supabase.from("matches").update({ away_slot_label: newSlotCode }).eq("tournament_id", tournamentId).eq("phase_id", phaseId).eq("away_slot_label", slot.slot_code);
    if (slot.group_id) {
      homeUpdate = homeUpdate.eq("group_id", slot.group_id);
      awayUpdate = awayUpdate.eq("group_id", slot.group_id);
    } else {
      homeUpdate = homeUpdate.is("group_id", null);
      awayUpdate = awayUpdate.is("group_id", null);
    }
    await homeUpdate;
    await awayUpdate;
  };

  const assignTeam = async (slotId: string, teamId: string) => {
    const slot = slots.find(s => s.id === slotId);
    if (!slot) return;
    const oldTeamId = slot.team_id;
    const { error } = await supabase.from("slots").update({
      team_id: teamId, ref_phase_id: null, ref_group_id: null, ref_position: null,
    }).eq("id", slotId);
    if (error) { toast({ title: "Fout", description: error.message, variant: "destructive" }); return; }
    await syncSlotToGroupTeamsAndMatches(slot, teamId, oldTeamId);
    setOpenSlotId(null);
    await fetchData();
    onSlotChange?.();
  };

  const assignReference = async (slotId: string, refPhaseId: string, refGroupId: string | null, refPosition: number) => {
    const slot = slots.find(s => s.id === slotId);
    if (!slot) return;
    const oldTeamId = slot.team_id;
    const refGroup = allGroups.find(g => g.id === refGroupId);
    const refPhase = phases.find(p => p.id === refPhaseId);
    const newSlotCode = refGroup
      ? buildGroupReferenceLabel(refPosition, refGroup.name, refPhase?.name)
      : slot.slot_code;
    const { error } = await supabase.from("slots").update({
      team_id: null, ref_phase_id: refPhaseId, ref_group_id: refGroupId, ref_position: refPosition, slot_code: newSlotCode,
    }).eq("id", slotId);
    if (error) { toast({ title: "Fout", description: error.message, variant: "destructive" }); return; }
    if (oldTeamId) await syncSlotToGroupTeamsAndMatches(slot, null, oldTeamId);
    await updateMatchSlotLabels(slot, newSlotCode);
    setOpenSlotId(null);
    await fetchData();
    onSlotChange?.();
  };

  const assignCrossGroupRef = async (slotId: string, refPhaseId: string, positionTier: number, rankWithinTier: number, formatName: string) => {
    const slot = slots.find(s => s.id === slotId);
    if (!slot) return;
    const oldTeamId = slot.team_id;
    const encodedPosition = positionTier * 100 + rankWithinTier;
    const newSlotCode = buildCrossReferenceLabel(rankWithinTier, positionTier, formatName);
    const { error } = await supabase.from("slots").update({
      team_id: null, ref_phase_id: refPhaseId, ref_group_id: null, ref_position: encodedPosition, slot_code: newSlotCode,
    }).eq("id", slotId);
    if (error) { toast({ title: "Fout", description: error.message, variant: "destructive" }); return; }
    if (oldTeamId) await syncSlotToGroupTeamsAndMatches(slot, null, oldTeamId);
    await updateMatchSlotLabels(slot, newSlotCode);
    setOpenSlotId(null);
    await fetchData();
    onSlotChange?.();
  };

  const clearSlot = async (slotId: string) => {
    const slot = slots.find(s => s.id === slotId);
    if (!slot) return;
    const oldTeamId = slot.team_id;
    const { error } = await supabase.from("slots").update({
      team_id: null, ref_phase_id: null, ref_group_id: null, ref_position: null,
    }).eq("id", slotId);
    if (!error) {
      if (oldTeamId) await syncSlotToGroupTeamsAndMatches(slot, null, oldTeamId);
    }
    setOpenSlotId(null);
    await fetchData();
    onSlotChange?.();
  };

  const getSlotDisplay = (slot: Slot) => {
    if (slot.team_id) {
      const team = teams.find(t => t.id === slot.team_id);
      return { type: "team" as const, label: team?.name || "Onbekend", logo: team?.logo_url || null };
    }
    if (slot.ref_phase_id) {
      if (slot.ref_group_id) {
        const group = allGroups.find(g => g.id === slot.ref_group_id);
        const refPhase = phases.find(p => p.id === slot.ref_phase_id);
        if (group) return { type: "ref" as const, label: buildGroupReferenceLabel(slot.ref_position ?? 0, group.name, refPhase?.name), logo: null };
      }
      if (slot.ref_position && slot.ref_position >= 100) {
        const tier = Math.floor(slot.ref_position / 100);
        const rank = slot.ref_position % 100;
        const refPhase = phases.find(p => p.id === slot.ref_phase_id);
        return { type: "ref" as const, label: buildCrossReferenceLabel(rank, tier, refPhase?.name), logo: null };
      }
      return { type: "ref" as const, label: slot.slot_code, logo: null };
    }
    return { type: "empty" as const, label: "LEGE PLEK", logo: null };
  };

  const groupedByPosition = getGroupedByPosition();
  const allPreviousPositions = Object.values(groupedByPosition).flat();

  const registerUsedMatchLabel = (label: string | null) => {
    if (!label || label === "TBD" || label === "BYE" || /^S\d+$/i.test(label)) return;

    const crossMatch = label.match(/^(\d+)e nr\.(\d+)(?: \((.+)\))?$/);
    if (crossMatch) {
      const rank = parseInt(crossMatch[1], 10);
      const tier = parseInt(crossMatch[2], 10);
      const formatName = crossMatch[3];
      const refPhase = previousPhases.find((phase) => phase.name === formatName);
      if (refPhase) {
        usedCrossSourceKeys.add(getCrossSourceKey(refPhase.id, tier, rank));
        crossModeTierPhaseKeys.add(getTierPhaseKey(refPhase.id, tier));
      }
      return;
    }

    const selectedPosition = allPreviousPositions.find((position) => position.label === label);
    if (selectedPosition?.groupId) {
      usedGroupSourceKeys.add(getGroupSourceKey(selectedPosition.phaseId, selectedPosition.groupId, selectedPosition.position));
    }
  };

  for (const match of allMatches) {
    registerUsedMatchLabel(match.home_slot_label);
    registerUsedMatchLabel(match.away_slot_label);
  }

  const hasPreviousPhases = previousPhases.length > 0;

  const toggleSwapTier = async (e: React.MouseEvent, sourcePhaseId: string, tier: number) => {
    e.stopPropagation();
    const tierKey = getTierPhaseKey(sourcePhaseId, tier);
    const isActivating = !(crossModeTierPhaseKeys.has(tierKey) || swappedTiers.has(tierKey));
    const tierPositions = [...allPreviousPositions.filter((p) => p.phaseId === sourcePhaseId && p.position === tier)]
      .sort((a, b) => a.groupName.localeCompare(b.groupName, "nl", { sensitivity: "base", numeric: true }));

    if (tierPositions.length === 0) return;

    const buildCrossLabel = (rank: number) => {
      const refPhase = phases.find((p) => p.id === sourcePhaseId);
      return buildCrossReferenceLabel(rank, tier, refPhase?.name).trim();
    };

    const rankBySourceKey = new Map<string, number>(
      tierPositions
        .filter((entry): entry is typeof entry & { groupId: string } => !!entry.groupId)
        .map((entry, index) => [getGroupSourceKey(entry.phaseId, entry.groupId, entry.position), index + 1])
    );

    const labelMap = new Map<string, string>(
      tierPositions.map((entry, index) => {
        const rank = index + 1;
        return isActivating
          ? [entry.label, buildCrossLabel(rank)]
          : [buildCrossLabel(rank), entry.label];
      })
    );

    let didChange = false;

    if (isActivating) {
      const slotsToConvert = allSlots.filter((entry) =>
        entry.ref_phase_id === sourcePhaseId &&
        entry.ref_group_id &&
        entry.ref_position === tier &&
        rankBySourceKey.has(getGroupSourceKey(entry.ref_phase_id!, entry.ref_group_id!, entry.ref_position!))
      );

      if (slotsToConvert.length > 0) {
        const results = await Promise.all(
          slotsToConvert.map((entry) => {
            const rank = rankBySourceKey.get(getGroupSourceKey(entry.ref_phase_id!, entry.ref_group_id!, entry.ref_position!));
            return supabase
              .from("slots")
              .update({
                ref_group_id: null,
                ref_position: tier * 100 + (rank ?? 1),
              })
              .eq("id", entry.id);
          })
        );

        const updateError = results.find((result) => result.error)?.error;
        if (updateError) {
          toast({ title: "Fout", description: updateError.message, variant: "destructive" });
          return;
        }
        didChange = true;
      }
    } else {
      const slotsToConvert = allSlots.filter((entry) =>
        entry.ref_phase_id === sourcePhaseId &&
        entry.ref_group_id === null &&
        entry.ref_position !== null &&
        entry.ref_position >= tier * 100 &&
        entry.ref_position < (tier + 1) * 100
      );

      if (slotsToConvert.length > 0) {
        const results = await Promise.all(
          slotsToConvert.map((entry) => {
            const rank = entry.ref_position! % 100;
            const targetEntry = tierPositions[rank - 1];
            if (!targetEntry?.groupId) return Promise.resolve({ error: null } as { error: null });
            return supabase
              .from("slots")
              .update({
                ref_group_id: targetEntry.groupId,
                ref_position: tier,
              })
              .eq("id", entry.id);
          })
        );

        const updateError = results.find((result) => result.error)?.error;
        if (updateError) {
          toast({ title: "Fout", description: updateError.message, variant: "destructive" });
          return;
        }
        didChange = true;
      }
    }

    const matchUpdates = allMatches.flatMap((match) => {
      const updates: { home_slot_label?: string; away_slot_label?: string } = {};
      const nextHomeLabel = match.home_slot_label ? labelMap.get(match.home_slot_label) : undefined;
      const nextAwayLabel = match.away_slot_label ? labelMap.get(match.away_slot_label) : undefined;

      if (nextHomeLabel && nextHomeLabel !== match.home_slot_label) updates.home_slot_label = nextHomeLabel;
      if (nextAwayLabel && nextAwayLabel !== match.away_slot_label) updates.away_slot_label = nextAwayLabel;

      if (Object.keys(updates).length === 0) return [];
      return [supabase.from("matches").update(updates).eq("id", match.id)];
    });

    if (matchUpdates.length > 0) {
      const results = await Promise.all(matchUpdates);
      const updateError = results.find((result) => result.error)?.error;
      if (updateError) {
        toast({ title: "Fout", description: updateError.message, variant: "destructive" });
        return;
      }
      didChange = true;
    }

    if (didChange) {
      await fetchData();
      onSlotChange?.();
    }

    window.dispatchEvent(new CustomEvent("tier-swap-mode-change", { detail: { tierKey, active: isActivating } }));
  };

  return (
    <SortableContext items={slots.map((s) => s.id)} strategy={verticalListSortingStrategy}>
    <div className="space-y-1.5">
      {slots.map((slot, slotIndex) => {
        const display = getSlotDisplay(slot);
        const isOpen = openSlotId === slot.id;
        const isLastSlot = slotIndex >= slots.length - 1;

        return (
          <SortableRowShell key={slot.id} id={slot.id} dragLabel="Team verplaatsen" className="flex items-start gap-1.5">
            {(handle) => (
          <>
          {handle}
          <div className="relative flex-1 min-w-0">
            <button
              onClick={() => setOpenSlotId(isOpen ? null : slot.id)}
              className={`flex items-center gap-2 w-full rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                display.type === "empty"
                  ? "border-dashed border-border text-muted-foreground hover:border-foreground/20"
                  : display.type === "ref"
                  ? "border-primary/20 bg-primary/5 text-foreground hover:border-primary/40"
                  : "border-border bg-foreground/[0.02] text-foreground hover:bg-foreground/[0.04]"
              }`}
            >
              {display.type === "team" && display.logo && (
                <img src={display.logo} className="h-4 w-4 object-contain flex-shrink-0" />
              )}
              {display.type === "team" && <User className="h-3 w-3 text-muted-foreground flex-shrink-0" />}
              {display.type === "ref" && <ArrowRight className="h-3 w-3 text-primary flex-shrink-0" />}
              <span className="flex-1 truncate">
                {display.type === "ref" && display.label.includes("(") ? (
                  <>
                    {display.label.replace(/\s*\(.*\)$/, "")}
                    <span className="text-[10px] text-muted-foreground ml-1">
                      {display.label.match(/\(.*\)$/)?.[0]}
                    </span>
                  </>
                ) : display.label}
              </span>
              {display.type !== "empty" && (
                <button
                  onClick={(e) => { e.stopPropagation(); clearSlot(slot.id); }}
                  className="text-muted-foreground hover:text-destructive flex-shrink-0"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
              <ChevronDown className="h-3 w-3 text-muted-foreground flex-shrink-0" />
            </button>

            {isOpen && (
              <div className={`absolute z-50 w-full rounded-lg border border-border bg-card shadow-lg max-h-64 overflow-y-auto ${isLastSlot ? "bottom-full mb-1" : "top-full mt-1"}`}>
                {/* 1. Geen (empty slot) */}
                <button
                  onClick={() => clearSlot(slot.id)}
                  className="w-full px-3 py-1.5 text-left text-xs hover:bg-accent/50 transition-colors flex items-center gap-2"
                >
                  <span className="font-mono font-bold text-destructive text-xs">GEEN</span>
                  <span className="text-[10px] text-muted-foreground">— slot leegmaken</span>
                </button>

                {/* 2. Positions from previous phase */}
                {hasPreviousPhases && Object.keys(groupedByPosition).length > 0 && (
                  <>
                    <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground bg-secondary/50 border-t border-border">
                      Positie uit vorige fase
                    </div>
                    {(() => {
                      // Group entries by phaseId for format headers
                      const allEntries = Object.values(groupedByPosition).flat();
                      const byPhase: Record<string, typeof allEntries> = {};
                      for (const entry of allEntries) {
                        if (!byPhase[entry.phaseId]) byPhase[entry.phaseId] = [];
                        byPhase[entry.phaseId].push(entry);
                      }
                      const eligiblePrevPhases = previousPhases.filter(p => p.phase_type !== "knockout");
                      const orderedPhaseIds = eligiblePrevPhases
                        .sort((a, b) => (a.phase_number ?? 0) - (b.phase_number ?? 0))
                        .map(p => p.id)
                        .filter(id => byPhase[id]);

                      return orderedPhaseIds.map(prevPhaseId => {
                        const phaseEntries = byPhase[prevPhaseId];
                        const prevPhase = eligiblePrevPhases.find(p => p.id === prevPhaseId);
                        const isSingleMatchPhase = prevPhase?.phase_type === "single_match";

                        const sortedEntries = [...phaseEntries].sort((a, b) => {
                          if (isSingleMatchPhase) return a.position - b.position;
                          return a.position - b.position || a.groupName.localeCompare(b.groupName, "nl", { sensitivity: "base", numeric: true });
                        });

                        return (
                          <div key={prevPhaseId}>
                            <div className="px-3 py-1 text-[10px] font-bold text-primary bg-primary/10 border-t border-border">
                              {prevPhase?.name || "Fase"}
                            </div>
                            {isSingleMatchPhase ? (
                              sortedEntries.map((entry, i) => {
                                const groupKey = entry.groupId ? getGroupSourceKey(entry.phaseId, entry.groupId, entry.position) : null;
                                const isCurrentSelection =
                                  slot.ref_phase_id === entry.phaseId &&
                                  slot.ref_group_id === entry.groupId &&
                                  slot.ref_position === entry.position;
                                if (groupKey && usedGroupSourceKeys.has(groupKey) && !isCurrentSelection) return null;
                                return (
                                  <button
                                    key={i}
                                    onClick={() => assignReference(slot.id, entry.phaseId, entry.groupId, entry.position)}
                                    className="w-full px-3 py-1.5 text-left text-xs text-foreground hover:bg-foreground/5 transition-colors flex items-center gap-2"
                                  >
                                    <ArrowRight className="h-3 w-3 text-primary flex-shrink-0" />
                                    <span className="truncate">
                                      {entry.label.replace(/\s*\(.*\)$/, "")}
                                      {entry.label.match(/\(.*\)$/)?.[0] && (
                                        <span className="text-[9px] text-muted-foreground ml-1">{entry.label.match(/\(.*\)$/)?.[0]}</span>
                                      )}
                                    </span>
                                  </button>
                                );
                              })
                            ) : (
                              (() => {
                                const positionTiers = [...new Set(sortedEntries.map(e => e.position))].sort((a, b) => a - b);
                                return positionTiers.map(pos => {
                                  const tierEntries = sortedEntries.filter(e => e.position === pos);
                                  const multipleGroups = tierEntries.length > 1;
                                  const showCrossRanking = swappedTiers.has(getTierPhaseKey(prevPhaseId, pos)) || tierEntries.some(entry => crossModeTierPhaseKeys.has(getTierPhaseKey(entry.phaseId, pos)));

                                  return (
                                    <div key={pos}>
                                      <div className="px-3 py-0.5 text-[10px] font-semibold text-muted-foreground bg-muted/20 border-t border-border/50 flex items-center justify-between">
                                        <span>{pos}e plaatsen</span>
                                        {multipleGroups && (
                                          <button
                                            onClick={(e) => { e.stopPropagation(); toggleSwapTier(e, prevPhaseId, pos); }}
                                            className={`p-0.5 rounded flex-shrink-0 ${showCrossRanking ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-primary hover:bg-primary/10"}`}
                                            title={showCrossRanking ? "Terug naar groepsweergave" : "Wissel naar rangschikking"}
                                          >
                                            <ArrowLeftRight className="h-3 w-3" />
                                          </button>
                                        )}
                                      </div>
                                      {showCrossRanking ? (
                                        tierEntries.map((entry, i) => {
                                          const rank = i + 1;
                                          const encodedPos = pos * 100 + rank;
                                           const crossKey = getCrossSourceKey(entry.phaseId, pos, rank);
                                           const groupKey = entry.groupId ? getGroupSourceKey(entry.phaseId, entry.groupId, entry.position) : null;
                                          const isCurrentSelection =
                                            slot.ref_phase_id === entry.phaseId &&
                                            ((slot.ref_group_id === null && slot.ref_position === encodedPos) ||
                                              (slot.ref_group_id === entry.groupId && slot.ref_position === entry.position));
                                           if ((usedCrossSourceKeys.has(crossKey) || (groupKey ? usedGroupSourceKeys.has(groupKey) : false)) && !isCurrentSelection) return null;
                                          return (
                                            <button
                                              key={i}
                                              onClick={() => assignCrossGroupRef(slot.id, entry.phaseId, pos, rank, entry.formatName)}
                                              className="w-full px-3 py-1.5 text-left text-xs text-foreground hover:bg-foreground/5 transition-colors flex items-center gap-2"
                                            >
                                              <span className="font-mono text-[10px] bg-primary/10 text-primary px-1 py-0.5 rounded font-bold flex-shrink-0">
                                                #{rank}
                                              </span>
                                              <span className="truncate">
                                                {rank}e nummer {pos}
                                                <span className="text-[9px] text-muted-foreground ml-1">({entry.formatName})</span>
                                              </span>
                                            </button>
                                          );
                                        })
                                      ) : (
                                        tierEntries.map((entry, i) => {
                                          const rank = i + 1;
                                           const groupKey = entry.groupId ? getGroupSourceKey(entry.phaseId, entry.groupId, entry.position) : null;
                                           const crossKey = getCrossSourceKey(entry.phaseId, pos, rank);
                                           const inCrossMode = crossModeTierPhaseKeys.has(getTierPhaseKey(entry.phaseId, pos));
                                          const isCurrentSelection =
                                            slot.ref_phase_id === entry.phaseId &&
                                            ((slot.ref_group_id === entry.groupId && slot.ref_position === entry.position) ||
                                              (slot.ref_group_id === null && slot.ref_position === pos * 100 + rank));
                                           if (((groupKey ? usedGroupSourceKeys.has(groupKey) : false) || usedCrossSourceKeys.has(crossKey) || inCrossMode) && !isCurrentSelection) return null;
                                          return (
                                            <button
                                              key={i}
                                              onClick={() => assignReference(slot.id, entry.phaseId, entry.groupId, entry.position)}
                                              className="w-full px-3 py-1.5 text-left text-xs text-foreground hover:bg-foreground/5 transition-colors flex items-center gap-2"
                                            >
                                              <ArrowRight className="h-3 w-3 text-primary flex-shrink-0" />
                                              <span className="truncate">
                                                {entry.label.replace(/\s*\(.*\)$/, "")}
                                                {entry.label.match(/\(.*\)$/)?.[0] && (
                                                  <span className="text-[9px] text-muted-foreground ml-1">{entry.label.match(/\(.*\)$/)?.[0]}</span>
                                                )}
                                              </span>
                                            </button>
                                          );
                                        })
                                      )}
                                    </div>
                                  );
                                });
                              })()
                            )}
                          </div>
                        );
                      });
                    })()}
                  </>
                )}

                {/* Teams section */}
                {availableTeams.length > 0 && (
                  <>
                    <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-primary bg-primary/10 border-t border-border">
                      {phaseNumber > 1 ? "Teams (niet in vorige fase)" : "Teams"}
                    </div>
                    {availableTeams.map(t => (
                      <button
                        key={t.id}
                        onClick={() => assignTeam(slot.id, t.id)}
                        className="w-full px-3 py-1.5 text-left text-xs text-foreground hover:bg-foreground/5 transition-colors flex items-center gap-2"
                      >
                        {t.logo_url && <img src={t.logo_url} className="h-4 w-4 object-contain" />}
                        <User className="h-3 w-3 text-muted-foreground" />
                        {t.name}
                      </button>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>
          </>
            )}
          </SortableRowShell>
        );
      })}
      {slots.length === 0 && (
        <div className="flex justify-center py-3">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      )}
    </div>
    </SortableContext>
  );
};

export default SlotManager;
