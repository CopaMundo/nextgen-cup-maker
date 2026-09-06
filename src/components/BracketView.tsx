import React, { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { useDialogFocus } from "@/hooks/useDialogFocus";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Pencil, Check, X, Plus, ChevronDown, User, ArrowRight, ArrowLeftRight, Shuffle, Trash2, MapPin, Settings, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import MatchDetailDialog from "./MatchDetailDialog";
import ScoringSystemSelector from "./ScoringSystemSelector";
import { useScoringSystems } from "@/hooks/useScoringSystems";
import WhistleIcon from "@/components/icons/WhistleIcon";
import CountryFlag from "@/components/CountryFlag";
import { getSlotReferenceLabel as resolveSlotReferenceLabel } from "@/lib/slotLabels";
import { firstRefereeName } from "@/lib/refereeConfig";
import { getMatchFormatSuffix } from "@/lib/matchFormatLabel";

interface BracketMatch {
  id: string;
  created_at: string;
  home_team_id: string | null;
  away_team_id: string | null;
  home_score: number | null;
  away_score: number | null;
  home_penalties: number | null;
  away_penalties: number | null;
  home_slot_label: string | null;
  away_slot_label: string | null;
  is_played: boolean;
  round_number: number | null;
  group_id: string | null;
  match_name: string | null;
  field: string | null;
  match_time: string | null;
  match_date: string | null;
  referee: string | null;
  scoring_system_id?: string | null;
}

interface MatchReferenceRecord {
  id: string;
  home_slot_label: string | null;
  away_slot_label: string | null;
  group_id: string | null;
  phase_id: string;
}

interface Team {
  id: string;
  name: string;
  logo_url: string | null;
  category_id: string | null;
  country: string | null;
}

interface BracketGroup { id: string; name: string; }
interface Phase {
  id: string;
  name: string;
  phase_number: number;
  phase_type: string;
  category_id: string | null;
  match_config?: Record<string, any> | null;
  logo_url?: string | null;
}
interface GroupInfo { id: string; name: string; phase_id: string; }
interface GroupTeamCount { group_id: string; count: number; }
interface SlotEntry {
  id: string;
  slot_code: string;
  team_id: string | null;
  ref_position: number | null;
  ref_phase_id: string | null;
  ref_group_id: string | null;
  group_id: string | null;
  phase_id?: string;
}

interface TournamentInfo {
  id: string;
  enable_goalscorers: boolean;
  enable_assists: boolean;
  enable_yellow_cards: boolean;
  enable_red_cards: boolean;
  show_country?: boolean;
}

interface BracketViewProps {
  tournamentId: string;
  phaseId: string;
  editable?: boolean;
  scoreEditable?: boolean;
  showRandomAssign?: boolean;
  showScores?: boolean;
  filterGroupIds?: string[];
  tournament?: TournamentInfo;
  refreshKey?: number;
  onSlotChange?: () => void;
}

const formatDateDMY = (d: string | null) => {
  if (!d) return null;
  const parts = d.split("-");
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return d;
};

const BracketView = ({ tournamentId, phaseId, editable = false, scoreEditable, showRandomAssign = true, showScores = true, filterGroupIds, tournament, refreshKey, onSlotChange }: BracketViewProps) => {
  const isMobile = useIsMobile();
  const effectiveScoreEditable = scoreEditable ?? editable;

  const [matches, setMatches] = useState<BracketMatch[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [groups, setGroups] = useState<BracketGroup[]>([]);
  const [phases, setPhases] = useState<Phase[]>([]);
  const [allGroups, setAllGroups] = useState<GroupInfo[]>([]);
  const [slots, setSlots] = useState<SlotEntry[]>([]);
  const [allTournamentSlots, setAllTournamentSlots] = useState<SlotEntry[]>([]);
  const [allTournamentMatches, setAllTournamentMatches] = useState<MatchReferenceRecord[]>([]);
  const [groupTeamCounts, setGroupTeamCounts] = useState<GroupTeamCount[]>([]);
  const [loaded, setLoaded] = useState(false);
  const byeAutoProcessedRef = useRef<string | null>(null);

  const [editingRoundName, setEditingRoundName] = useState<string | null>(null);
  const [roundNameEdit, setRoundNameEdit] = useState("");
  const [editingMatchName, setEditingMatchName] = useState<string | null>(null);
  const [matchNameEdit, setMatchNameEdit] = useState("");
  const [savingMatchNameId, setSavingMatchNameId] = useState<string | null>(null);
  const [matchNameError, setMatchNameError] = useState<string | null>(null);
  const [editingBracketName, setEditingBracketName] = useState<string | null>(null);
  const [bracketNameEdit, setBracketNameEdit] = useState("");
  const editingBracketRoundsRef = useRef<typeof rounds>([]);
  const [roundNameBase, setRoundNameBase] = useState("");
  const [teamPickerOpen, setTeamPickerOpen] = useState<{ matchId: string; side: "home" | "away" } | null>(null);
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [selectedHAMatchId, setSelectedHAMatchId] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showRandomConfirm, setShowRandomConfirm] = useState(false);
  const [showDeleteSingleConfirm, setShowDeleteSingleConfirm] = useState<string | null>(null);
  const [showDeleteBracketConfirm, setShowDeleteBracketConfirm] = useState<string | null>(null);
  const [showDeletePlacementConfirm, setShowDeletePlacementConfirm] = useState<string | null>(null);
  const [matchSettingsOpen, setMatchSettingsOpen] = useState<string | null>(null);
  const [matchSettingsName, setMatchSettingsName] = useState("");
  const [matchSettingsMatchType, setMatchSettingsMatchType] = useState<"single_leg" | "home_away">("single_leg");
  const [matchSettingsEncounters, setMatchSettingsEncounters] = useState(1);
  const [matchSettingsScoringSystemId, setMatchSettingsScoringSystemId] = useState<string | null>(null);
  const bracketNameDialogRef = useDialogFocus(editingBracketName !== null);
  const roundNameDialogRef = useDialogFocus(editingRoundName !== null);
  const matchSettingsDialogRef = useDialogFocus(matchSettingsOpen !== null);
  const [swappedTiers, setSwappedTiers] = useState<Set<string>>(new Set());
  const pickerRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const { systems: scoringSystems } = useScoringSystems(tournamentId);

  const fetchData = async () => {
    const [mRes, tRes, gRes, pRes, agRes, sRes, gtRes, allSlotsRes, allMatchesRes] = await Promise.all([
      supabase
        .from("matches")
        .select(
          "id, created_at, home_team_id, away_team_id, home_score, away_score, home_penalties, away_penalties, home_slot_label, away_slot_label, is_played, round_number, group_id, match_name, field, match_time, match_date, referee, scoring_system_id",
        )
        .eq("phase_id", phaseId)
        .order("round_number")
        .order("created_at"),
      supabase.from("teams").select("id, name, logo_url, category_id, country").eq("tournament_id", tournamentId),
      supabase.from("groups").select("id, name").eq("phase_id", phaseId).order("created_at"),
      supabase
        .from("tournament_phases")
        .select("id, name, phase_number, phase_type, category_id, match_config, logo_url")
        .eq("tournament_id", tournamentId)
        .order("phase_number"),
      supabase.from("groups").select("id, name, phase_id").eq("tournament_id", tournamentId).order("created_at"),
      supabase
        .from("slots")
        .select("id, slot_code, team_id, ref_position, ref_phase_id, ref_group_id, group_id")
        .eq("tournament_id", tournamentId)
        .eq("phase_id", phaseId),
      // Get actual team counts per group (from group_teams table)
      supabase.from("group_teams").select("group_id").eq("tournament_id", tournamentId),
      // Get ALL slots across tournament to identify teams used in earlier phases
      supabase
        .from("slots")
        .select("id, slot_code, team_id, ref_position, ref_phase_id, ref_group_id, group_id, phase_id")
        .eq("tournament_id", tournamentId),
      supabase
        .from("matches")
        .select("id, home_slot_label, away_slot_label, group_id, phase_id")
        .eq("tournament_id", tournamentId),
    ]);

    if (mRes.data) setMatches(mRes.data as any);
    if (tRes.data) setTeams(tRes.data);
    if (gRes.data) setGroups(gRes.data);
    if (pRes.data) setPhases(pRes.data as any);
    if (agRes.data) setAllGroups(agRes.data as any);
    if (sRes.data) setSlots(sRes.data as any);
    if (allSlotsRes.data) setAllTournamentSlots(allSlotsRes.data as any);
    if (allMatchesRes.data) setAllTournamentMatches(allMatchesRes.data as any);
    
    // Count teams per group
    if (gtRes.data) {
      const counts: Record<string, number> = {};
      for (const row of gtRes.data) {
        counts[row.group_id] = (counts[row.group_id] || 0) + 1;
      }
      setGroupTeamCounts(Object.entries(counts).map(([group_id, count]) => ({ group_id, count })));
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Don't reset loaded if we already have data (avoid flash)
      if (!loaded) setLoaded(false);
      byeAutoProcessedRef.current = null;
      await fetchData();
      if (!cancelled) setLoaded(true);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phaseId, refreshKey]);

  useEffect(() => {
    if (!editable && !effectiveScoreEditable) return;
    if (!loaded) return;
    if (byeAutoProcessedRef.current === phaseId) return;
    byeAutoProcessedRef.current = phaseId;
    void processAllByes(matches);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editable, effectiveScoreEditable, loaded, phaseId]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setTeamPickerOpen(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

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

  const currentPhase = phases.find((p) => p.id === phaseId);
  const currentPhaseNumber = currentPhase?.phase_number || 0;
  const currentCategoryId = currentPhase?.category_id || null;
  const scopedPhases = currentCategoryId
    ? phases.filter((p) => p.category_id === currentCategoryId)
    : phases;
  const scopedPhaseIds = new Set(scopedPhases.map((p) => p.id));
  const scopedGroups = allGroups.filter((g) => scopedPhaseIds.has(g.phase_id));
  const categoryTeams = currentCategoryId ? teams.filter((t) => t.category_id === currentCategoryId) : teams;
  
  // For phases > 1: exclude teams that are already used in earlier phases (via slots with team_id set)
  const teamsUsedInEarlierPhases = (() => {
    if (currentPhaseNumber <= 1) return new Set<string>();
    const earlierPhaseIds = new Set(scopedPhases.filter((p) => p.phase_number < currentPhaseNumber).map((p) => p.id));
    const earlierGroupIds = new Set(scopedGroups.filter((g) => earlierPhaseIds.has(g.phase_id)).map((g) => g.id));
    return new Set(
      allTournamentSlots
        .filter(s => s.team_id && s.group_id && earlierGroupIds.has(s.group_id))
        .map(s => s.team_id!)
    );
  })();
  
  const filteredTeams = categoryTeams.filter(t => !teamsUsedInEarlierPhases.has(t.id));
  const startPosition: number = (currentPhase?.match_config as any)?.startPosition || 1;
  const labelOffset = startPosition - 1;
  const hasPlacement = startPosition > 1;
  const totalSeedSlots = slots.length;
  const placementEnd = startPosition + (totalSeedSlots > 0 ? totalSeedSlots : 2) - 1;
  const bracketNames: Record<string, string> = (currentPhase?.match_config as any)?.bracketNames || {};
  const bracketGroupMap: Record<string, string> = (currentPhase?.match_config as any)?.bracketGroupMap || {};
  const getBracketKeyForGroup = (groupId: string | null): string => {
    if (!groupId) return "main";
    return bracketGroupMap[groupId] || "main";
  };
  const getSameBracketGroupIds = (groupId: string | null): Set<string> => {
    const key = getBracketKeyForGroup(groupId);
    const ids = new Set<string>();
    // Add all groups with the same bracket key
    for (const g of groups) {
      if (getBracketKeyForGroup(g.id) === key) ids.add(g.id);
    }
    if (groupId) ids.add(groupId);
    return ids;
  };
  const isSingleMatch = currentPhase?.phase_type === "single_match";
  const isKnockout = currentPhase?.phase_type === "knockout";
  const phaseMatchType = (currentPhase?.match_config as any)?.matchType || "single_leg";
  const isHomeAway = (isKnockout || isSingleMatch) && phaseMatchType === "home_away";
  const phaseEncounters = (currentPhase?.match_config as any)?.encounters || 1;
  const getSubBracketName = (key: string): string => {
    if (bracketNames[key]) return bracketNames[key];
    if (key === "main") {
      if (isSingleMatch) return currentPhase?.name || "Plaatsingswedstrijd";
      if (hasPlacement) return `Plaatsing ${startPosition}-${placementEnd}`;
      return "Hoofdbracket";
    }
    return `Plaatsing ${key}`;
  };
  const getBracketName = (key: string): string => getSubBracketName(key);
  const parseRoundName = (name: string) => {
    const colonIdx = name.indexOf(":");
    if (colonIdx === -1) return { base: name, suffix: "" };
    return { base: name.substring(0, colonIdx).trim(), suffix: name.substring(colonIdx + 1).trim() };
  };
  const getBaseKnockoutRoundLabel = (matchesInRound: number) => {
    if (matchesInRound === 1) return "Finale";
    if (matchesInRound === 2) return "Halve Finales";
    if (matchesInRound === 4) return "Kwartfinales";
    if (matchesInRound === 8) return "Achtste Finales";
    if (matchesInRound === 16) return "1/16 Finales";
    if (matchesInRound === 32) return "1/32 Finales";
    return `1/${matchesInRound * 2} Finales`;
  };
  const getBaseKnockoutRoundLabelSingular = (matchesInRound: number) => {
    if (matchesInRound === 1) return "Finale";
    if (matchesInRound === 2) return "Halve Finale";
    if (matchesInRound === 4) return "Kwartfinale";
    if (matchesInRound === 8) return "Achtste Finale";
    if (matchesInRound === 16) return "1/16 Finale";
    if (matchesInRound === 32) return "1/32 Finale";
    return `1/${matchesInRound * 2} Finale`;
  };
  const getKnockoutRoundLabel = (matchesInRound: number) => {
    const base = getBaseKnockoutRoundLabel(matchesInRound);
    if (hasPlacement) {
      return `${base}: Plaats ${startPosition}-${startPosition + matchesInRound * 2 - 1}`;
    }
    return base;
  };
  const getKnockoutRoundLabelSingular = (matchesInRound: number) => {
    const base = getBaseKnockoutRoundLabelSingular(matchesInRound);
    if (hasPlacement) {
      return `${base}: Plaats ${startPosition}-${startPosition + matchesInRound * 2 - 1}`;
    }
    return base;
  };
  const getSubBracketRoundLabel = (matchesInRound: number, prefix: string) => {
    const subStart = parseInt(prefix.split("-")[0]);
    if (!Number.isFinite(subStart)) return getBaseKnockoutRoundLabel(matchesInRound);
    return `${getBaseKnockoutRoundLabel(matchesInRound)}: Plaats ${subStart}-${subStart + matchesInRound * 2 - 1}`;
  };
  const getSubBracketRoundLabelSingular = (matchesInRound: number, prefix: string) => {
    const subStart = parseInt(prefix.split("-")[0]);
    if (!Number.isFinite(subStart)) return getBaseKnockoutRoundLabelSingular(matchesInRound);
    return `${getBaseKnockoutRoundLabelSingular(matchesInRound)}: Plaats ${subStart}-${subStart + matchesInRound * 2 - 1}`;
  };
  const getRoundDisplayName = (round: { id: string; name: string; matches: BracketMatch[] }, bracketPrefix?: string | null) => {
    return getBaseKnockoutRoundLabel(round.matches.length);
  };
  const previousPhases = scopedPhases.filter((p) => p.phase_number < currentPhaseNumber);

  const buildGroupReferenceLabel = (position: number, sourceGroupName: string, sourceFormatName?: string | null) =>
    `${position}e ${sourceGroupName}${sourceFormatName ? ` (${sourceFormatName})` : ""}`;

  const buildCrossReferenceLabel = (rank: number, tier: number, sourceFormatName?: string | null) =>
    `${rank}e nr.${tier}${sourceFormatName ? ` (${sourceFormatName})` : ""}`;

  // Get positions grouped by rank (all 1st places, then all 2nd, etc.)
  // Knockout phases produce final placements — skip them; only group/round_robin/single_match positions are selectable
  const getPreviousPositionsGrouped = () => {
    const grouped: Record<number, { label: string; phaseId: string; groupId: string | null; position: number; formatName: string; groupName: string; isSingleMatchPos?: boolean }[]> = {};
    const eligiblePrevPhases = previousPhases.filter(p => p.phase_type !== "knockout");
    for (const pp of eligiblePrevPhases) {
      if (pp.phase_type === "single_match") {
        // Single match positions go into a special key space (negative numbers) to keep them separate
        const ppGroups = scopedGroups.filter((g) => g.phase_id === pp.id);
        const ppGroupId = ppGroups[0]?.id || null;
        const phaseSlots = allTournamentSlots.filter(s => s.phase_id === pp.id);
        const estimatedMatches = Math.max(1, Math.floor(phaseSlots.length / 2));
        for (let mi = 1; mi <= estimatedMatches; mi++) {
          const winPos = mi * 2 - 1;
          const losePos = mi * 2;
          // Use negative keys to separate from normal grouped positions
          const winKey = -(mi * 2 - 1);
          const loseKey = -(mi * 2);
          if (!grouped[winKey]) grouped[winKey] = [];
          grouped[winKey].push({
            label: `Winnaar Wedstrijd ${mi} ${pp.name}`,
            phaseId: pp.id,
            groupId: ppGroupId,
            position: winPos,
            formatName: pp.name,
            groupName: ppGroups[0]?.name || pp.name,
            isSingleMatchPos: true,
          });
          if (!grouped[loseKey]) grouped[loseKey] = [];
          grouped[loseKey].push({
            label: `Verliezer Wedstrijd ${mi} ${pp.name}`,
            phaseId: pp.id,
            groupId: ppGroupId,
            position: losePos,
            formatName: pp.name,
            groupName: ppGroups[0]?.name || pp.name,
            isSingleMatchPos: true,
          });
        }
        continue;
      }
      const ppGroups = scopedGroups.filter((g) => g.phase_id === pp.id);
      for (const g of ppGroups) {
        const gtCount = groupTeamCounts.find(c => c.group_id === g.id)?.count || 0;
        const maxPos = gtCount > 0 ? gtCount : (pp.phase_type === "knockout" ? 2 : 4);
        for (let pos = 1; pos <= maxPos; pos++) {
          if (!grouped[pos]) grouped[pos] = [];
          grouped[pos].push({
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
    return grouped;
  };

  const getSlotReferenceLabel = (slotCode: string | null) => {
    const resolved = resolveSlotReferenceLabel(slotCode, { slots, phases, groups: allGroups, phaseId });
    if (resolved) return resolved;
    const slot = slots.find((entry) => entry.slot_code === slotCode);
    if (!slot?.ref_position) return null;
    if (slot.ref_group_id) {
      // Check if this references a single_match phase
      const refPhase = phases.find(p => {
        const refGroup = allGroups.find(g => g.id === slot.ref_group_id);
        return refGroup && p.id === refGroup.phase_id;
      });
      if (refPhase?.phase_type === "single_match" && slot.ref_position) {
        const matchIndex = Math.ceil(slot.ref_position / 2);
        const isWinner = slot.ref_position % 2 === 1;
        return `${isWinner ? "Winnaar" : "Verliezer"} Wedstrijd ${matchIndex} ${refPhase.name}`;
      }
      const group = allGroups.find((entry) => entry.id === slot.ref_group_id);
      return group ? buildGroupReferenceLabel(slot.ref_position, group.name, refPhase?.name) : `${slot.ref_position}e positie`;
    }
    // Cross-group ref (ref_position >= 100, ref_group_id is null)
    if (slot.ref_position >= 100 && slot.ref_phase_id) {
      const tier = Math.floor(slot.ref_position / 100);
      const rank = slot.ref_position % 100;
      const refPhase = previousPhases.find(p => p.id === slot.ref_phase_id);
      return buildCrossReferenceLabel(rank, tier, refPhase?.name);
    }
    return `${slot.ref_position}e positie`;
  };

  const getTeamName = (teamId: string | null, slotLabel: string | null) => {
    if (teamId) return teams.find((t) => t.id === teamId)?.name || "?";
    const refLabel = getSlotReferenceLabel(slotLabel);
    if (refLabel) return refLabel;
    // Hide raw slot codes and show empty placeholder
    if (!slotLabel || /^S\d+$/i.test(slotLabel)) return "LEGE PLEK";
    return slotLabel || "LEGE PLEK";
  };

  const getTeamLogo = (teamId: string | null) => teams.find((t) => t.id === teamId)?.logo_url || null;
  const getTeamCountry = (teamId: string | null) => teams.find((t) => t.id === teamId)?.country || null;

  const BYE_LABEL = "BYE";
  const isSlotCode = (label: string | null) => !!label && /^S\d+$/i.test(label);
  const byeSlotCodes = new Set(slots.filter((s) => s.ref_position === 0 && !s.team_id).map((s) => s.slot_code));

  const isBye = (match: BracketMatch, side: "home" | "away") => {
    const slotLabel = side === "home" ? match.home_slot_label : match.away_slot_label;
    const teamId = side === "home" ? match.home_team_id : match.away_team_id;
    if (teamId) return false;
    if (slotLabel === BYE_LABEL) return true;
    if (isSlotCode(slotLabel)) return byeSlotCodes.has(slotLabel);
    return false;
  };

  const processByeMatch = async (match: BracketMatch, allMatches: BracketMatch[]): Promise<BracketMatch[]> => {
    const homeBye = isBye(match, "home");
    const awayBye = isBye(match, "away");
    if (!homeBye && !awayBye) return allMatches;
    if (!match.match_name) return allMatches;

    const winnerId = homeBye ? match.away_team_id : match.home_team_id;
    if (homeBye !== awayBye && !winnerId) return allMatches;

    let updated = [...allMatches];
    const sameBracketGroups = getSameBracketGroupIds(match.group_id);

    if (homeBye && awayBye) {
      const winnerLabel = `Winnaar ${match.match_name}`;
      for (let i = 0; i < updated.length; i++) {
        const m = updated[i];
        if (m.group_id && !sameBracketGroups.has(m.group_id)) continue;
        const mUpdates: any = {};
        if (m.home_slot_label === winnerLabel) { mUpdates.home_slot_label = BYE_LABEL; mUpdates.home_team_id = null; }
        if (m.away_slot_label === winnerLabel) { mUpdates.away_slot_label = BYE_LABEL; mUpdates.away_team_id = null; }
        if (Object.keys(mUpdates).length > 0) {
          await supabase.from("matches").update(mUpdates).eq("id", m.id);
          updated[i] = { ...m, ...mUpdates };
          updated = await processByeMatch(updated[i], updated);
        }
      }
      const needsMarkPlayed = !match.is_played || match.home_score !== 0 || match.away_score !== 0 || match.home_penalties !== null || match.away_penalties !== null;
      if (needsMarkPlayed) {
        await supabase.from("matches").update({ is_played: true, home_score: 0, away_score: 0, home_penalties: null, away_penalties: null }).eq("id", match.id);
        updated = updated.map((m) => m.id === match.id ? { ...m, is_played: true, home_score: 0, away_score: 0, home_penalties: null, away_penalties: null } : m);
      }
    } else {
      const winnerLabel = `Winnaar ${match.match_name}`;
      for (let i = 0; i < updated.length; i++) {
        const m = updated[i];
        if (m.group_id && !sameBracketGroups.has(m.group_id)) continue;
        const mUpdates: any = {};
        if (m.home_slot_label === winnerLabel) mUpdates.home_team_id = winnerId;
        if (m.away_slot_label === winnerLabel) mUpdates.away_team_id = winnerId;
        if (Object.keys(mUpdates).length > 0) {
          await supabase.from("matches").update(mUpdates).eq("id", m.id);
          updated[i] = { ...m, ...mUpdates };
          updated = await processByeMatch(updated[i], updated);
        }
      }
      const desiredHome = homeBye ? 0 : 1;
      const desiredAway = awayBye ? 0 : 1;
      const needsMarkPlayed = match.is_played !== true || match.home_score !== desiredHome || match.away_score !== desiredAway || match.home_penalties !== null || match.away_penalties !== null;
      if (needsMarkPlayed) {
        await supabase.from("matches").update({ is_played: true, home_score: desiredHome, away_score: desiredAway, home_penalties: null, away_penalties: null }).eq("id", match.id);
        updated = updated.map((m) => m.id === match.id ? { ...m, is_played: true, home_score: desiredHome, away_score: desiredAway, home_penalties: null, away_penalties: null } : m);
      }
    }
    return updated;
  };

  const processAllByes = async (currentMatches: BracketMatch[]) => {
    let updated = [...currentMatches];
    for (const round of rounds) {
      for (const match of round.matches) {
        const current = updated.find((m) => m.id === match.id);
        if (current) updated = await processByeMatch(current, updated);
      }
    }
    setMatches(updated);
  };

  const assignTeamToMatch = async (matchId: string, side: "home" | "away", teamId: string) => {
    const updates: any = side === "home" ? { home_team_id: teamId } : { away_team_id: teamId };
    const { error } = await supabase.from("matches").update(updates).eq("id", matchId);
    if (error) { toast({ title: "Fout", description: error.message, variant: "destructive" }); } else {
      const match = matches.find((m) => m.id === matchId);
      const slotLabel = side === "home" ? match?.home_slot_label : match?.away_slot_label;
      if (slotLabel && slotLabel !== BYE_LABEL) {
        const slotUpdates: any = {
          team_id: teamId,
          ref_phase_id: null,
          ref_group_id: null,
          ref_position: null,
        };
        await supabase.from("slots").update(slotUpdates).eq("tournament_id", tournamentId).eq("phase_id", phaseId).eq("slot_code", slotLabel);
      }
      // H&A: sync Terug match when assigning team to Heen match (phase-level or per-match)
      if (match?.match_name?.endsWith("(Heen)")) {
        const baseName = getBaseMatchName(match.match_name);
        const terug = matches.find(m => m.match_name === `${baseName} (Terug)` && m.group_id === match.group_id);
        if (terug) {
          // Heen home → Terug away, Heen away → Terug home
          const terugUpdates: any = side === "home" ? { away_team_id: teamId } : { home_team_id: teamId };
          await supabase.from("matches").update(terugUpdates).eq("id", terug.id);
        }
      }
      await fetchData();
      // Process byes after refetch
      const freshMatch = matches.find((m) => m.id === matchId);
      if (freshMatch) {
        const otherBye = side === "home" ? isBye(freshMatch, "away") : isBye(freshMatch, "home");
        if (otherBye) await processAllByes(matches);
      }
    }
    setTeamPickerOpen(null);
    onSlotChange?.();
  };

  const assignByeToMatch = async (matchId: string, side: "home" | "away") => {
    const match = matches.find((m) => m.id === matchId);
    const slotLabel = side === "home" ? match?.home_slot_label : match?.away_slot_label;
    const isSlot = isSlotCode(slotLabel ?? null);
    const updates: any = side === "home"
      ? { home_team_id: null, ...(isSlot ? {} : { home_slot_label: BYE_LABEL }), is_played: false, home_score: null, away_score: null, home_penalties: null, away_penalties: null }
      : { away_team_id: null, ...(isSlot ? {} : { away_slot_label: BYE_LABEL }), is_played: false, home_score: null, away_score: null, home_penalties: null, away_penalties: null };
    const { error } = await supabase.from("matches").update(updates).eq("id", matchId);
    if (error) { toast({ title: "Fout", description: error.message, variant: "destructive" }); return; }
    if (isSlot && slotLabel) {
      const byeSlotUpdate = { team_id: null, ref_phase_id: null, ref_group_id: null, ref_position: 0 };
      await supabase.from("slots").update(byeSlotUpdate).eq("tournament_id", tournamentId).eq("phase_id", phaseId).eq("slot_code", slotLabel);
    }
    await fetchData();
    setTeamPickerOpen(null);
    onSlotChange?.();
  };

  const assignPositionToMatch = async (matchId: string, side: "home" | "away", label: string, positionRef?: { phaseId: string; groupId: string | null; position: number } | null) => {
    const match = matches.find((entry) => entry.id === matchId);
    if (!match) return;

    const slotLabel = side === "home" ? match.home_slot_label : match.away_slot_label;
    const teamField = side === "home" ? "home_team_id" : "away_team_id";

    if (slotLabel && isSlotCode(slotLabel)) {
      // Use directly passed position reference if available, otherwise fall back to label matching
      let selectedPosition = positionRef || null;
      if (!selectedPosition && label !== "TBD") {
        const allPrevPositions = Object.values(previousPositionsGrouped).flat();
        selectedPosition = allPrevPositions.find((position) => position.label === label) || null;
      }

      // Check for cross-group ref pattern: "Xe nr.Y formatName"
      let crossGroupSlotUpdates: any = null;
      if (!selectedPosition && label !== "TBD") {
        const crossMatch = label.match(/^(\d+)e nr\.(\d+)(?: \((.+)\))?$/);
        if (crossMatch) {
          const rank = parseInt(crossMatch[1]);
          const tier = parseInt(crossMatch[2]);
          const formatName = crossMatch[3];
          const refPhase = previousPhases.find(p => p.name === formatName);
          if (refPhase) {
            const encodedPosition = tier * 100 + rank;
            crossGroupSlotUpdates = {
              team_id: null,
              ref_phase_id: refPhase.id,
              ref_group_id: null,
              ref_position: encodedPosition,
            };
          }
        }
      }

      const slotUpdates = label === "TBD"
        ? { team_id: null, ref_phase_id: null, ref_group_id: null, ref_position: null }
        : selectedPosition
          ? {
              team_id: null,
              ref_phase_id: selectedPosition.phaseId,
              ref_group_id: selectedPosition.groupId,
              ref_position: selectedPosition.position,
            }
          : crossGroupSlotUpdates;

      if (slotUpdates) {
        const { error: slotError } = await supabase
          .from("slots")
          .update(slotUpdates)
          .eq("tournament_id", tournamentId)
          .eq("phase_id", phaseId)
          .eq("slot_code", slotLabel);

        if (slotError) {
          toast({ title: "Fout", description: slotError.message, variant: "destructive" });
          return;
        }

        const matchUpdates = { [teamField]: null };
        const { error: matchError } = await supabase.from("matches").update(matchUpdates).eq("id", matchId);
        if (matchError) {
          toast({ title: "Fout", description: matchError.message, variant: "destructive" });
          return;
        }

        await fetchData();
        setTeamPickerOpen(null);
        onSlotChange?.();
        return;
      }
    }

    const updates: any = side === "home" ? { home_slot_label: label, home_team_id: null } : { away_slot_label: label, away_team_id: null };
    const { error } = await supabase.from("matches").update(updates).eq("id", matchId);
    if (error) {
      toast({ title: "Fout", description: error.message, variant: "destructive" });
    } else {
      await fetchData();
      onSlotChange?.();
    }
    setTeamPickerOpen(null);
  };

  const clearDownstreamTeams = async (matchName: string, currentMatches: BracketMatch[], scopeGroupId?: string | null): Promise<BracketMatch[]> => {
    const sameBracketGroups = scopeGroupId !== undefined ? getSameBracketGroupIds(scopeGroupId) : null;
    const winnerLabel = `Winnaar ${matchName}`;
    const loserLabel = `Verliezer ${matchName}`;
    let updated = [...currentMatches];

    for (let i = 0; i < updated.length; i++) {
      const m = updated[i];
      // Scope to same bracket if specified
      if (sameBracketGroups && m.group_id && !sameBracketGroups.has(m.group_id)) continue;
      const mUpdates: any = {};
      if (m.home_slot_label === winnerLabel) mUpdates.home_team_id = null;
      if (m.away_slot_label === winnerLabel) mUpdates.away_team_id = null;
      if (m.home_slot_label === loserLabel) mUpdates.home_team_id = null;
      if (m.away_slot_label === loserLabel) mUpdates.away_team_id = null;

      if (Object.keys(mUpdates).length > 0) {
        // If this match had a result, clear it too and recurse
        const alsoReset: any = {};
        if (m.is_played) {
          alsoReset.home_score = null;
          alsoReset.away_score = null;
          alsoReset.home_penalties = null;
          alsoReset.away_penalties = null;
          alsoReset.is_played = false;
        }
        await supabase.from("matches").update({ ...mUpdates, ...alsoReset }).eq("id", m.id);
        updated[i] = { ...m, ...mUpdates, ...alsoReset };

        // Recursively clear downstream of this match too
        if (m.match_name && m.is_played) {
          updated = await clearDownstreamTeams(m.match_name, updated, m.group_id);
        }
      }
    }
    return updated;
  };

  const saveScore = async (match: BracketMatch) => {
    const hs = match.home_score;
    const as_ = match.away_score;

    // Check if this is an H&A leg (phase-level or per-match)
    const isHALeg = (isHomeAway || isMatchHomeAway(match)) && (match.match_name?.endsWith("(Heen)") || match.match_name?.endsWith("(Terug)"));

    const isTied = hs !== null && as_ !== null && hs === as_;
    const hasPenalties = match.home_penalties !== null && match.away_penalties !== null && match.home_penalties !== match.away_penalties;
    // H&A legs: played = both scores entered (no penalty requirement per leg)
    const isPlayed = isHALeg
      ? (hs !== null && as_ !== null)
      : (hs !== null && as_ !== null && (!isTied || hasPenalties));

    const { error } = await supabase.from("matches").update({
      home_score: hs, away_score: as_, home_penalties: match.home_penalties, away_penalties: match.away_penalties, is_played: isPlayed,
    }).eq("id", match.id);
    if (error) { toast({ title: "Fout", description: error.message, variant: "destructive" }); return; }

    // H&A: propagate winner using aggregate when both legs are played
    if (isHALeg) {
      const baseName = getBaseMatchName(match.match_name);
      const heenMatchName = `${baseName} (Heen)`;
      const terugMatchName = `${baseName} (Terug)`;
      const updatedMatches = matches.map(x => x.id === match.id ? { ...x, home_score: hs, away_score: as_, home_penalties: match.home_penalties, away_penalties: match.away_penalties, is_played: isPlayed } : x);
      const sameBracketGroups = getSameBracketGroupIds(match.group_id);
      const heenM = updatedMatches.find(m => m.match_name === heenMatchName && m.group_id && sameBracketGroups.has(m.group_id));
      const terugM = updatedMatches.find(m => m.match_name === terugMatchName && m.group_id && sameBracketGroups.has(m.group_id));

      if (heenM && terugM && heenM.is_played && terugM.is_played) {
        const homeTotal = (heenM.home_score ?? 0) + (terugM.away_score ?? 0);
        const awayTotal = (heenM.away_score ?? 0) + (terugM.home_score ?? 0);
        let winnerId: string | null = null;
        if (homeTotal > awayTotal) winnerId = heenM.home_team_id;
        else if (awayTotal > homeTotal) winnerId = heenM.away_team_id;
        else {
          // Penalties staan op de Terug-wedstrijd, in Terug-oriëntatie
          if ((terugM.home_penalties ?? 0) > (terugM.away_penalties ?? 0)) winnerId = heenM.away_team_id;
          else if ((terugM.away_penalties ?? 0) > (terugM.home_penalties ?? 0)) winnerId = heenM.home_team_id;
        }

        if (winnerId && baseName) {
          const winnerLabel = `Winnaar ${baseName}`;
          const loserId = winnerId === heenM.home_team_id ? heenM.away_team_id : heenM.home_team_id;
          const loserLabel = `Verliezer ${baseName}`;
          const finalMatches = [...updatedMatches];
          for (let i = 0; i < finalMatches.length; i++) {
            const m = finalMatches[i];
            if (m.id === heenM.id || m.id === terugM.id) continue;
            if (m.group_id && !sameBracketGroups.has(m.group_id)) continue;
            const mUpdates: any = {};
            if (m.home_slot_label === winnerLabel) mUpdates.home_team_id = winnerId;
            if (m.away_slot_label === winnerLabel) mUpdates.away_team_id = winnerId;
            if (loserId) {
              if (m.home_slot_label === loserLabel) mUpdates.home_team_id = loserId;
              if (m.away_slot_label === loserLabel) mUpdates.away_team_id = loserId;
            }
            if (Object.keys(mUpdates).length > 0) {
              await supabase.from("matches").update(mUpdates).eq("id", m.id);
              finalMatches[i] = { ...m, ...mUpdates };
            }
          }
          setMatches(finalMatches);
        } else {
          setMatches(updatedMatches);
        }
      } else {
        if (baseName) {
          let cleared = [...updatedMatches];
          cleared = await clearDownstreamTeams(baseName, cleared);
          setMatches(cleared);
        } else {
          setMatches(updatedMatches);
        }
      }
      return;
    }

    // If score was cleared, remove propagated teams downstream
    if (!isPlayed && match.match_name) {
      let updatedMatches = matches.map(x => x.id === match.id ? { ...x, home_score: hs, away_score: as_, home_penalties: match.home_penalties, away_penalties: match.away_penalties, is_played: false } : x);
      updatedMatches = await clearDownstreamTeams(match.match_name, updatedMatches, match.group_id);
      setMatches(updatedMatches);
      return;
    }

    if (isPlayed && match.match_name) {
      let winnerId: string | null = null;
      if ((hs ?? 0) > (as_ ?? 0)) winnerId = match.home_team_id;
      else if ((as_ ?? 0) > (hs ?? 0)) winnerId = match.away_team_id;
      else {
        if ((match.home_penalties ?? 0) > (match.away_penalties ?? 0)) winnerId = match.home_team_id;
        else if ((match.away_penalties ?? 0) > (match.home_penalties ?? 0)) winnerId = match.away_team_id;
      }
      if (winnerId) {
        const winnerLabel = `Winnaar ${match.match_name}`;
        const loserId = winnerId === match.home_team_id ? match.away_team_id : match.home_team_id;
        const loserLabel = `Verliezer ${match.match_name}`;
        const sameBracketGroups = getSameBracketGroupIds(match.group_id);
        const updatedMatches = [...matches];
        for (let i = 0; i < updatedMatches.length; i++) {
          const m = updatedMatches[i];
          if (m.id === match.id) { updatedMatches[i] = { ...m, is_played: isPlayed }; continue; }
          // Scope to same bracket
          if (m.group_id && !sameBracketGroups.has(m.group_id)) continue;
          const mUpdates: any = {};
          if (m.home_slot_label === winnerLabel) mUpdates.home_team_id = winnerId;
          if (m.away_slot_label === winnerLabel) mUpdates.away_team_id = winnerId;
          if (loserId) {
            if (m.home_slot_label === loserLabel) mUpdates.home_team_id = loserId;
            if (m.away_slot_label === loserLabel) mUpdates.away_team_id = loserId;
          }
          if (Object.keys(mUpdates).length > 0) {
            await supabase.from("matches").update(mUpdates).eq("id", m.id);
            updatedMatches[i] = { ...m, ...mUpdates };
          }
        }
        setMatches(updatedMatches);
      } else {
        setMatches(m => m.map(x => x.id === match.id ? { ...x, is_played: isPlayed } : x));
      }
    } else {
      setMatches(m => m.map(x => x.id === match.id ? { ...x, is_played: hs !== null && as_ !== null && (!isTied || hasPenalties) } : x));
    }
  };

  // H&A helper: find paired match (Heen ↔ Terug) - works for both phase-level and per-match H&A
  const findPairedMatch = (match: BracketMatch): BracketMatch | null => {
    if (!match.match_name) return null;
    const heenMatch = match.match_name.match(/^(.+)\s+\(Heen\)$/);
    const terugMatch = match.match_name.match(/^(.+)\s+\(Terug\)$/);
    if (heenMatch) {
      return matches.find(m => m.match_name === `${heenMatch[1]} (Terug)` && m.group_id === match.group_id) || null;
    }
    if (terugMatch) {
      return matches.find(m => m.match_name === `${terugMatch[1]} (Heen)` && m.group_id === match.group_id) || null;
    }
    return null;
  };

  const isMatchHomeAway = (match: BracketMatch): boolean => {
    // Always check per-match indicators first (suffix-based)
    if (match.match_name?.endsWith("(Heen)") || match.match_name?.endsWith("(Terug)")) return true;
    // If phase-level H&A is set, check if this match actually still has a paired return leg
    if (isHomeAway) {
      const baseName = match.match_name?.replace(/\s+\(Heen\)$/, "").replace(/\s+\(Terug\)$/, "") || match.match_name;
      const hasPair = matches.some(m => m.id !== match.id && m.match_name === `${baseName} (Terug)`) ||
                      matches.some(m => m.id !== match.id && m.match_name === `${baseName} (Heen)`);
      return hasPair;
    }
    return false;
  };

  const isReturnLeg = (match: BracketMatch) => !!match.match_name?.endsWith("(Terug)");
  const getBaseMatchName = (name: string | null) => {
    if (!name) return "";
    return name.replace(/\s+\(Heen\)$/, "").replace(/\s+\(Terug\)$/, "");
  };

  // Encounter grouping for single_match
  const getEncounterGroup = (match: BracketMatch): BracketMatch[] => {
    if (!isSingleMatch || phaseEncounters <= 1) return [match];
    const baseName = match.match_name?.replace(/\s+\(\d+\)$/, "") || "";
    return matches.filter(m => {
      const mBase = m.match_name?.replace(/\s+\(\d+\)$/, "") || "";
      return mBase === baseName && m.home_slot_label === match.home_slot_label && m.away_slot_label === match.away_slot_label;
    }).sort((a, b) => (a.round_number || 0) - (b.round_number || 0));
  };

  const isFirstEncounter = (match: BracketMatch): boolean => {
    if (!isSingleMatch || phaseEncounters <= 1) return true;
    return (match.round_number || 1) === 1;
  };

  // Open match settings dialog
  const openMatchSettings = async (matchId: string) => {
    const match = matches.find(m => m.id === matchId);
    if (!match) return;
    const matchIsHA = isMatchHomeAway(match);
    const baseName = matchIsHA ? getBaseMatchName(match.match_name) : (match.match_name || "");
    setMatchSettingsName(baseName);
    setMatchSettingsMatchType(matchIsHA ? "home_away" : "single_leg");
    // Resolve effective scoring system: match > group > phase > first available
    const sortedSys = [...scoringSystems].sort((a, b) => a.sort_order - b.sort_order);
    let effSys: string | null = match.scoring_system_id ?? null;
    if (!effSys && match.group_id) {
      const g = (groups as any[]).find((x: any) => x.id === match.group_id);
      effSys = g?.scoring_system_id ?? null;
    }
    if (!effSys) {
      const { data: phaseRow } = await supabase
        .from("tournament_phases")
        .select("scoring_system_id")
        .eq("id", phaseId)
        .single();
      effSys = (phaseRow as any)?.scoring_system_id ?? null;
    }
    setMatchSettingsScoringSystemId(effSys ?? sortedSys[0]?.id ?? null);
    if (isSingleMatch) {
      const group = getEncounterGroup(match);
      setMatchSettingsEncounters(group.length);
    }
    setMatchNameError(null);
    setMatchSettingsOpen(matchId);
  };

  // Save match settings
  const saveMatchSettings = async () => {
    if (!matchSettingsOpen) return;
    const match = matches.find(m => m.id === matchSettingsOpen);
    if (!match) return;
    
    const currentMatchIsHA = isMatchHomeAway(match);
    const oldBaseName = currentMatchIsHA ? getBaseMatchName(match.match_name) : (match.match_name || "");
    const newBaseName = matchSettingsName.trim();
    const wantHA = matchSettingsMatchType === "home_away";

    // Validate duplicate match name within same bracket/format
    if (newBaseName && newBaseName !== oldBaseName) {
      const sameBracketGroups = getSameBracketGroupIds(match.group_id);
      const effectiveName = wantHA ? newBaseName : newBaseName;
      const duplicate = matches.find(m => {
        if (m.id === match.id) return false;
        // Skip paired H&A match
        const paired = findPairedMatch(match);
        if (paired && m.id === paired.id) return false;
        if (!m.group_id || !sameBracketGroups.has(m.group_id)) return false;
        const mBase = isMatchHomeAway(m) ? getBaseMatchName(m.match_name) : m.match_name;
        return mBase === effectiveName;
      });
      if (duplicate) {
        setMatchNameError(`"${newBaseName}" bestaat al in dit format.`);
        return;
      }
    }

    // Handle match type change per individual match
    if (wantHA && !currentMatchIsHA) {
      // Switch from single_leg to home_away: rename current match to "(Heen)" and create "(Terug)"
      const baseName = newBaseName || oldBaseName || match.match_name || "Wedstrijd";
      await supabase.from("matches").update({ match_name: `${baseName} (Heen)` }).eq("id", match.id);
      // Create return leg in same group/round
      await supabase.from("matches").insert({
        tournament_id: tournamentId,
        phase_id: phaseId,
        group_id: match.group_id,
        round_number: match.round_number,
        match_name: `${baseName} (Terug)`,
        home_team_id: match.away_team_id,
        away_team_id: match.home_team_id,
        home_slot_label: match.away_slot_label,
        away_slot_label: match.home_slot_label,
        is_played: false,
      });

      setMatchSettingsOpen(null);
      await fetchData();
      toast({ title: "Terugwedstrijd aangemaakt" });
      return;
    }

    if (!wantHA && currentMatchIsHA) {
      // Switch from home_away to single_leg: remove "(Heen)" suffix and delete "(Terug)" match
      const baseName = newBaseName || oldBaseName;
      const paired = findPairedMatch(match);
      // If this is the Terug match, find the Heen match instead
      const isTerug = match.match_name?.endsWith("(Terug)");
      const heenMatch = isTerug ? paired : match;
      const terugMatch = isTerug ? match : paired;

      if (heenMatch) {
        // Reset scores and rename
        await supabase.from("matches").update({
          match_name: baseName || null,
          home_score: null,
          away_score: null,
          home_penalties: null,
          away_penalties: null,
          is_played: false,
        }).eq("id", heenMatch.id);
      }
      if (terugMatch) {
        // Delete match stats for the return leg first
        await supabase.from("match_stats").delete().eq("match_id", terugMatch.id);
        await supabase.from("matches").delete().eq("id", terugMatch.id);
      }

      setMatchSettingsOpen(null);
      await fetchData();
      toast({ title: "Terugwedstrijd verwijderd" });
      return;
    }

    // Name-only update
    if (newBaseName && newBaseName !== oldBaseName) {
      if (currentMatchIsHA) {
        const heenName = `${newBaseName} (Heen)`;
        const terugName = `${newBaseName} (Terug)`;
        const paired = findPairedMatch(match);
        const isHeen = match.match_name?.endsWith("(Heen)");
        const mainMatch = isHeen ? match : paired;
        const otherMatch = isHeen ? paired : match;
        if (mainMatch) {
          const oldMainName = mainMatch.match_name;
          await supabase.from("matches").update({ match_name: heenName }).eq("id", mainMatch.id);
          if (oldMainName) {
            await supabase.from("matches").update({ home_slot_label: `Winnaar ${newBaseName}` })
              .eq("tournament_id", tournamentId).eq("phase_id", phaseId).eq("home_slot_label", `Winnaar ${getBaseMatchName(oldMainName)}`);
            await supabase.from("matches").update({ away_slot_label: `Winnaar ${newBaseName}` })
              .eq("tournament_id", tournamentId).eq("phase_id", phaseId).eq("away_slot_label", `Winnaar ${getBaseMatchName(oldMainName)}`);
          }
        }
        if (otherMatch) {
          await supabase.from("matches").update({ match_name: terugName }).eq("id", otherMatch.id);
        }
      } else if (isSingleMatch && phaseEncounters > 1) {
        const group = getEncounterGroup(match);
        for (let i = 0; i < group.length; i++) {
          const newName = `${newBaseName} (${i + 1})`;
          await supabase.from("matches").update({ match_name: newName }).eq("id", group[i].id);
        }
      } else {
        const oldName = match.match_name;
        await supabase.from("matches").update({ match_name: newBaseName || null }).eq("id", match.id);
        if (oldName && newBaseName) {
          await supabase.from("matches").update({ home_slot_label: `Winnaar ${newBaseName}` })
            .eq("tournament_id", tournamentId).eq("phase_id", phaseId).eq("home_slot_label", `Winnaar ${oldName}`);
          await supabase.from("matches").update({ away_slot_label: `Winnaar ${newBaseName}` })
            .eq("tournament_id", tournamentId).eq("phase_id", phaseId).eq("away_slot_label", `Winnaar ${oldName}`);
          await supabase.from("matches").update({ home_slot_label: `Verliezer ${newBaseName}` })
            .eq("tournament_id", tournamentId).eq("phase_id", phaseId).eq("home_slot_label", `Verliezer ${oldName}`);
          await supabase.from("matches").update({ away_slot_label: `Verliezer ${newBaseName}` })
            .eq("tournament_id", tournamentId).eq("phase_id", phaseId).eq("away_slot_label", `Verliezer ${oldName}`);
        }
      }
    }

    // Always sync scoring_system_id (even if name/format unchanged).
    // For H&A pairs, apply to both legs.
    const currentMatch = matches.find(m => m.id === matchSettingsOpen);
    if (currentMatch && (currentMatch.scoring_system_id ?? null) !== matchSettingsScoringSystemId) {
      await supabase.from("matches").update({ scoring_system_id: matchSettingsScoringSystemId } as any).eq("id", currentMatch.id);
      const paired = findPairedMatch(currentMatch);
      if (paired) {
        await supabase.from("matches").update({ scoring_system_id: matchSettingsScoringSystemId } as any).eq("id", paired.id);
      }
    }

    setMatchSettingsOpen(null);
    await fetchData();
    toast({ title: "Instellingen opgeslagen" });
  };

  const saveRoundName = async (groupId: string) => {
    const group = groups.find(g => g.id === groupId);
    if (!group) return;
    // Use knockout label from match count as the fixed base
    const roundMatches = sortMatchesByStructure(matches.filter(m => m.group_id === groupId));
    // Check if this is a sub-bracket group
    const groupPrefix = bracketGroupMap[groupId];
    const isSubBracketGroup = groupPrefix && groupPrefix !== "main";
    let base: string;
    if (isSubBracketGroup) {
      base = getSubBracketRoundLabel(roundMatches.length, groupPrefix);
    } else {
      base = getKnockoutRoundLabel(roundMatches.length);
    }
    const newSuffix = roundNameEdit.trim();
    const newGroupName = newSuffix ? `${base}: ${newSuffix}` : base;

    // Ensure bracketGroupMap is stored for ALL loser bracket groups so detection survives rename
    const updatedGroupMap = { ...bracketGroupMap };
    let mapChanged = false;
    for (const [prefix, bracketRounds] of Object.entries(loserBrackets)) {
      for (const r of bracketRounds) {
        if (!updatedGroupMap[r.id]) { updatedGroupMap[r.id] = prefix; mapChanged = true; }
      }
    }
    for (const pr of placementCandidateRounds) {
      if (updatedGroupMap[pr.id]) continue;
      const sourceGroups = loserSourceGroupsByRound.get(pr.id);
      if (!sourceGroups) continue;
      for (const [prefix, bracketRounds] of Object.entries(loserBrackets)) {
        if (bracketRounds.some(r => sourceGroups.has(r.id))) {
          updatedGroupMap[pr.id] = prefix; mapChanged = true; break;
        }
      }
      if (!updatedGroupMap[pr.id] && rounds.some(r => sourceGroups.has(r.id))) {
        updatedGroupMap[pr.id] = "main"; mapChanged = true;
      }
    }
    if (mapChanged) {
      await supabase.from("tournament_phases").update({
        match_config: { ...(currentPhase?.match_config || {}), bracketGroupMap: updatedGroupMap }
      } as any).eq("id", phaseId);
    }

    await supabase.from("groups").update({ name: newGroupName }).eq("id", groupId);

    const groupMatches = sortMatchesByStructure(matches.filter(m => m.group_id === groupId));
    for (let i = 0; i < groupMatches.length; i++) {
      const match = groupMatches[i];
      const oldName = match.match_name;
      const newMatchName = groupMatches.length === 1
        ? newGroupName
        : `${newGroupName} - ${i + 1}`;

      if (oldName && oldName !== newMatchName) {
        await supabase.from("matches").update({ match_name: newMatchName }).eq("id", match.id);
        await supabase.from("matches").update({ home_slot_label: `Winnaar ${newMatchName}` })
          .eq("tournament_id", tournamentId).eq("phase_id", phaseId).eq("home_slot_label", `Winnaar ${oldName}`);
        await supabase.from("matches").update({ away_slot_label: `Winnaar ${newMatchName}` })
          .eq("tournament_id", tournamentId).eq("phase_id", phaseId).eq("away_slot_label", `Winnaar ${oldName}`);
        await supabase.from("matches").update({ home_slot_label: `Verliezer ${newMatchName}` })
          .eq("tournament_id", tournamentId).eq("phase_id", phaseId).eq("home_slot_label", `Verliezer ${oldName}`);
        await supabase.from("matches").update({ away_slot_label: `Verliezer ${newMatchName}` })
          .eq("tournament_id", tournamentId).eq("phase_id", phaseId).eq("away_slot_label", `Verliezer ${oldName}`);
      }
    }

    setGroups(g => g.map(x => x.id === groupId ? { ...x, name: newGroupName } : x));
    setEditingRoundName(null);
    await fetchData();
  };

  const saveMatchName = async (matchId: string) => {
    if (savingMatchNameId === matchId) return;

    const match = matches.find(m => m.id === matchId);
    if (!match) return;

    const oldName = match.match_name;
    const newName = matchNameEdit.trim() || null;

    // Check for duplicate name within same bracket/format
    if (newName) {
      const sameBracketGroups = getSameBracketGroupIds(match.group_id);
      const duplicate = matches.find(m => m.id !== matchId && m.match_name === newName && m.group_id && sameBracketGroups.has(m.group_id));
      if (duplicate) {
        setMatchNameError(`"${newName}" bestaat al in dit format.`);
        return;
      }
    }

    // Allow saving even if the name is the same (including empty)
    if (oldName === newName && newName !== null) {
      setEditingMatchName(null);
      return;
    }

    const previousMatches = matches;
    const optimisticMatches = previousMatches.map(m => {
      if (m.id === matchId) return { ...m, match_name: newName };
      if (!oldName || !newName) return m;

      let updated = { ...m };
      if (m.home_slot_label === `Winnaar ${oldName}`) updated = { ...updated, home_slot_label: `Winnaar ${newName}` };
      if (m.away_slot_label === `Winnaar ${oldName}`) updated = { ...updated, away_slot_label: `Winnaar ${newName}` };
      if (m.home_slot_label === `Verliezer ${oldName}`) updated = { ...updated, home_slot_label: `Verliezer ${newName}` };
      if (m.away_slot_label === `Verliezer ${oldName}`) updated = { ...updated, away_slot_label: `Verliezer ${newName}` };
      return updated;
    });

    setMatches(optimisticMatches);
    setEditingMatchName(null);
    setSavingMatchNameId(matchId);

    const { error: matchNameError } = await supabase
      .from("matches")
      .update({ match_name: newName } as any)
      .eq("id", matchId);

    if (matchNameError) {
      setMatches(previousMatches);
      toast({ title: "Opslaan mislukt", description: matchNameError.message, variant: "destructive" });
      setSavingMatchNameId(null);
      return;
    }

    if (oldName && newName) {
      const dependentUpdates = previousMatches
        .filter((m) => m.id !== matchId)
        .map(async (m) => {
          const updates: Record<string, string> = {};
          if (m.home_slot_label === `Winnaar ${oldName}`) updates.home_slot_label = `Winnaar ${newName}`;
          if (m.away_slot_label === `Winnaar ${oldName}`) updates.away_slot_label = `Winnaar ${newName}`;
          if (m.home_slot_label === `Verliezer ${oldName}`) updates.home_slot_label = `Verliezer ${newName}`;
          if (m.away_slot_label === `Verliezer ${oldName}`) updates.away_slot_label = `Verliezer ${newName}`;
          if (Object.keys(updates).length === 0) return null;
          return supabase.from("matches").update(updates).eq("id", m.id);
        });

      const results = await Promise.all(dependentUpdates);
      const dependentError = results.find((result) => result?.error)?.error;
      if (dependentError) {
        toast({ title: "Waarschuwing", description: "Naam bewaard, maar niet alle verwijzingen zijn meteen gesynchroniseerd.", variant: "destructive" });
        await fetchData();
      }
    }

    setSavingMatchNameId(null);
  };

  const addPlacementMatch = async (bracketRounds: { id: string; name: string; matches: BracketMatch[]; minRound: number }[], prefix?: string) => {
    const semiFinalsRound = bracketRounds[bracketRounds.length - 2];
    if (!semiFinalsRound) return;
    // H&A: strip "(Heen)" suffix so labels match saveScore's baseName convention
    const matchNames = semiFinalsRound.matches.map(m => isMatchHomeAway(m) ? getBaseMatchName(m.match_name) : m.match_name).filter(Boolean);
    if (matchNames.length < 2) { toast({ title: "Fout", description: "Er zijn minstens 2 halve finales nodig.", variant: "destructive" }); return; }
    const groupName = "Finale";
    const bracketKey = prefix || "main";
    let matchName: string;
    if (!prefix) {
      matchName = `Finale (Plaats ${3 + labelOffset}-${4 + labelOffset})`;
    } else {
      const posFrom = parseInt(prefix.split("-")[0]);
      matchName = `Finale (Plaats ${posFrom + 2}-${posFrom + 3})`;
    }

    const placementSortOrder = prefix ? parseInt(prefix.split("-")[0]) * 100 + 99 : 99;
    const { data: gData } = await supabase.from("groups").insert({ phase_id: phaseId, tournament_id: tournamentId, name: groupName, sort_order: placementSortOrder }).select("id, name").single();
    if (gData) {
      if (prefix) {
        const updatedGroupMap = { ...bracketGroupMap, [gData.id]: prefix };
        await supabase.from("tournament_phases").update({
          match_config: { ...(currentPhase?.match_config || {}), bracketGroupMap: updatedGroupMap }
        } as any).eq("id", phaseId);
      }
      await supabase.from("matches").insert({
        tournament_id: tournamentId, phase_id: phaseId, group_id: gData.id,
        home_slot_label: `Verliezer ${matchNames[0]}`, away_slot_label: `Verliezer ${matchNames[1]}`,
        round_number: (semiFinalsRound.matches[0]?.round_number ?? 1) + 1, match_name: matchName,
      });
      toast({ title: `${groupName} toegevoegd` });
      await fetchData();
    }
  };

  const removePlacementRound = async (groupId: string) => {
    // Delete match stats and slots for all matches in this group
    const groupMatches = matches.filter(m => m.group_id === groupId);
    for (const m of groupMatches) {
      await supabase.from("match_stats").delete().eq("match_id", m.id);
      if (m.home_slot_label && isSlotCode(m.home_slot_label)) {
        await supabase.from("slots").delete().eq("tournament_id", tournamentId).eq("phase_id", phaseId).eq("slot_code", m.home_slot_label);
      }
      if (m.away_slot_label && isSlotCode(m.away_slot_label)) {
        await supabase.from("slots").delete().eq("tournament_id", tournamentId).eq("phase_id", phaseId).eq("slot_code", m.away_slot_label);
      }
    }
    await supabase.from("matches").delete().eq("group_id", groupId);
    await supabase.from("groups").delete().eq("id", groupId);
    toast({ title: "Wedstrijd verwijderd" });
    await fetchData();
    onSlotChange?.();
  };

  const addLoserBracket = async (sourceRound: { id: string; matches: BracketMatch[] }, posFrom: number, posTo: number) => {
    const loserCount = sourceRound.matches.length;
    const prefix = `${posFrom}-${posTo}`;
    const bracketDisplayName = getBracketName(prefix);
    const numSubRounds = Math.ceil(Math.log2(loserCount));
    const baseRoundNumber = Math.max(...sourceRound.matches.map(m => m.round_number ?? 0));
    const groupIds: string[] = [];
    const newGroupMap: Record<string, string> = {};
    const groupNames: string[] = [];
    const matchSingulars: string[] = [];
    const matchPlacementSuffixes: string[] = [];

    for (let r = 0; r < numSubRounds; r++) {
      const matchesInRound = loserCount / Math.pow(2, r + 1);
      const rangeEnd = posFrom + Math.floor(loserCount / Math.pow(2, r)) - 1;
      const roundLabel = getBaseKnockoutRoundLabelSingular(matchesInRound);
      const roundLabelPlural = getBaseKnockoutRoundLabel(matchesInRound);
      const placementSuffix = ` (Plaats ${posFrom}-${rangeEnd})`;
      const groupName = `${roundLabelPlural}: Plaats ${posFrom}-${rangeEnd}`;
      groupNames.push(groupName);
      matchSingulars.push(roundLabel);
      matchPlacementSuffixes.push(placementSuffix);
      const { data } = await supabase.from("groups").insert({ phase_id: phaseId, tournament_id: tournamentId, name: groupName, sort_order: posFrom * 100 + r }).select("id").single();
      if (data) {
        groupIds.push(data.id);
        newGroupMap[data.id] = prefix;
      }
    }

    // Store bracket group mapping
    const updatedGroupMap = { ...bracketGroupMap, ...newGroupMap };
    await supabase.from("tournament_phases").update({
      match_config: { ...(currentPhase?.match_config || {}), bracketGroupMap: updatedGroupMap }
    } as any).eq("id", phaseId);

    const allMatchNames: string[][] = [];
    const firstRoundMatchCount = loserCount / 2;
    for (let m = 0; m < firstRoundMatchCount; m++) {
      const src1 = sourceRound.matches[m * 2]; const src2 = sourceRound.matches[m * 2 + 1];
      // H&A: strip "(Heen)" suffix so labels match saveScore's baseName convention
      const src1Name = isMatchHomeAway(src1) ? getBaseMatchName(src1.match_name) : src1.match_name;
      const src2Name = isMatchHomeAway(src2) ? getBaseMatchName(src2.match_name) : src2.match_name;
      const matchName = firstRoundMatchCount === 1
        ? `${matchSingulars[0]}${matchPlacementSuffixes[0]}`
        : `${matchSingulars[0]} ${m + 1}${matchPlacementSuffixes[0]}`;
      if (!allMatchNames[0]) allMatchNames[0] = [];
      allMatchNames[0].push(matchName);
      await supabase.from("matches").insert({
        tournament_id: tournamentId, phase_id: phaseId, group_id: groupIds[0],
        home_slot_label: src1Name ? `Verliezer ${src1Name}` : "TBD",
        away_slot_label: src2Name ? `Verliezer ${src2Name}` : "TBD",
        round_number: baseRoundNumber + 1, match_name: matchName,
      });
    }
    for (let r = 1; r < numSubRounds; r++) {
      const prevNames = allMatchNames[r - 1]; const roundMatchCount = prevNames.length / 2; const currentNames: string[] = [];
      for (let m = 0; m < roundMatchCount; m++) {
        const matchName = roundMatchCount === 1
          ? `${matchSingulars[r]}${matchPlacementSuffixes[r]}`
          : `${matchSingulars[r]} ${m + 1}${matchPlacementSuffixes[r]}`;
        currentNames.push(matchName);
        await supabase.from("matches").insert({
          tournament_id: tournamentId, phase_id: phaseId, group_id: groupIds[r],
          home_slot_label: `Winnaar ${prevNames[m * 2]}`, away_slot_label: `Winnaar ${prevNames[m * 2 + 1]}`,
          round_number: baseRoundNumber + r + 1, match_name: matchName,
        });
      }
      allMatchNames.push(currentNames);
    }
    toast({ title: `Bracket ${prefix} toegevoegd` });
    await fetchData();
  };

  const collectAllChildPrefixes = (prefix: string): string[] => {
    const children = loserBracketChildren[prefix] || [];
    const all: string[] = [];
    for (const child of children) {
      all.push(child);
      all.push(...collectAllChildPrefixes(child));
    }
    return all;
  };

  const removeLoserBracket = async (prefix: string) => {
    const allPrefixes = [prefix, ...collectAllChildPrefixes(prefix)];
    const groupIdsToDelete = new Set<string>();

    for (const p of allPrefixes) {
      const bracketGroups = loserBrackets[p];
      if (!bracketGroups) continue;

      for (const g of bracketGroups) {
        groupIdsToDelete.add(g.id);
      }

      const placementRounds = getPlacementRoundsForBracket(bracketGroups);
      for (const round of placementRounds) {
        groupIdsToDelete.add(round.id);
      }
    }

    for (const groupId of groupIdsToDelete) {
      const groupMatches = matches.filter(m => m.group_id === groupId);
      for (const m of groupMatches) {
        await supabase.from("match_stats").delete().eq("match_id", m.id);
        if (m.home_slot_label && isSlotCode(m.home_slot_label)) {
          await supabase.from("slots").delete().eq("tournament_id", tournamentId).eq("phase_id", phaseId).eq("slot_code", m.home_slot_label);
        }
        if (m.away_slot_label && isSlotCode(m.away_slot_label)) {
          await supabase.from("slots").delete().eq("tournament_id", tournamentId).eq("phase_id", phaseId).eq("slot_code", m.away_slot_label);
        }
      }
      await supabase.from("matches").delete().eq("group_id", groupId);
      await supabase.from("groups").delete().eq("id", groupId);
    }
    toast({ title: `Bracket verwijderd` });
    await fetchData();
    onSlotChange?.();
  };

  // H&A: sync Terug matches with swapped team IDs from Heen matches
  const syncTerugMatches = async (heenMatches: BracketMatch[]) => {
    if (!isHomeAway) return;
    const updates: Promise<any>[] = [];
    for (const heen of heenMatches) {
      if (!heen.match_name?.endsWith("(Heen)")) continue;
      const baseName = getBaseMatchName(heen.match_name);
      const terug = matches.find(m => m.match_name === `${baseName} (Terug)` && m.group_id === heen.group_id);
      if (!terug) continue;
      // Terug has swapped home/away
      const terugUpdates: any = {};
      if (heen.home_team_id && terug.away_team_id !== heen.home_team_id) terugUpdates.away_team_id = heen.home_team_id;
      if (heen.away_team_id && terug.home_team_id !== heen.away_team_id) terugUpdates.home_team_id = heen.away_team_id;
      if (!heen.home_team_id) terugUpdates.away_team_id = null;
      if (!heen.away_team_id) terugUpdates.home_team_id = null;
      if (Object.keys(terugUpdates).length > 0) {
        updates.push(Promise.resolve(supabase.from("matches").update(terugUpdates).eq("id", terug.id)));
      }
    }
    if (updates.length > 0) await Promise.all(updates);
  };

  const randomAssignRound1 = async () => {
    if (r1Matches.length === 0) return;
    const slotsArr: { matchId: string; side: "home" | "away" }[] = [];
    for (const m of r1Matches) { slotsArr.push({ matchId: m.id, side: "home" }); slotsArr.push({ matchId: m.id, side: "away" }); }
    const available = [...filteredTeams];
    for (let i = available.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [available[i], available[j]] = [available[j], available[i]]; }
    const assignments = slotsArr.slice(0, Math.min(slotsArr.length, available.length)).map((s, i) => ({ ...s, teamId: available[i].id }));

    // Batch all match + slot updates in parallel
    await Promise.all(assignments.map(({ matchId, side, teamId }) => {
      const updates: any = side === "home" ? { home_team_id: teamId } : { away_team_id: teamId };
      return Promise.resolve(supabase.from("matches").update(updates).eq("id", matchId));
    }));
    await Promise.all(assignments.map(({ matchId, side, teamId }) => {
      const match = r1Matches.find(m => m.id === matchId);
      const slotLabel = side === "home" ? match?.home_slot_label : match?.away_slot_label;
      if (slotLabel) return Promise.resolve(supabase.from("slots").update({ team_id: teamId }).eq("tournament_id", tournamentId).eq("slot_code", slotLabel));
      return Promise.resolve();
    }));

    // H&A: sync Terug matches with swapped teams
    if (isHomeAway) {
      const updatedR1 = r1Matches.map(m => {
        const homeAssign = assignments.find(a => a.matchId === m.id && a.side === "home");
        const awayAssign = assignments.find(a => a.matchId === m.id && a.side === "away");
        return { ...m, home_team_id: homeAssign?.teamId || m.home_team_id, away_team_id: awayAssign?.teamId || m.away_team_id };
      });
      await syncTerugMatches(updatedR1);
    }

    await fetchData();
    toast({ title: "Teams willekeurig ingedeeld" });
    onSlotChange?.();
  };

  const addSingleMatch = async () => {
    const groupId = groups[0]?.id;
    if (!groupId) return;
    const allSlotCodes = slots.map(s => parseInt(s.slot_code.replace("S", ""))).filter(n => !isNaN(n));
    const maxSlot = allSlotCodes.length > 0 ? Math.max(...allSlotCodes) : 0;
    const homeSlot = `S${maxSlot + 1}`;
    const awaySlot = `S${maxSlot + 2}`;
    const matchIndex = matches.filter(m => !isReturnLeg(m)).length + 1;
    const matchName = `Wedstrijd ${matchIndex}`;

    const matchesToInsert: any[] = [];
    if (isHomeAway) {
      matchesToInsert.push(
        { tournament_id: tournamentId, phase_id: phaseId, group_id: groupId, home_slot_label: homeSlot, away_slot_label: awaySlot, round_number: 1, match_name: `${matchName} (Heen)` },
        { tournament_id: tournamentId, phase_id: phaseId, group_id: groupId, home_slot_label: awaySlot, away_slot_label: homeSlot, round_number: 2, match_name: `${matchName} (Terug)` },
      );
    } else {
      matchesToInsert.push({ tournament_id: tournamentId, phase_id: phaseId, group_id: groupId, home_slot_label: homeSlot, away_slot_label: awaySlot, round_number: 1, match_name: matchName });
    }

    const [slotsRes, matchRes] = await Promise.all([
      supabase.from("slots").insert([
        { tournament_id: tournamentId, phase_id: phaseId, group_id: groupId, slot_code: homeSlot, sort_order: maxSlot },
        { tournament_id: tournamentId, phase_id: phaseId, group_id: groupId, slot_code: awaySlot, sort_order: maxSlot + 1 },
      ]).select("*"),
      supabase.from("matches").insert(matchesToInsert).select("*"),
    ]);

    if (matchRes.data) {
      setMatches(prev => [...prev, ...matchRes.data as any]);
    }
    if (slotsRes.data) {
      setSlots(prev => [...prev, ...slotsRes.data as any]);
      setAllTournamentSlots(prev => [...prev, ...slotsRes.data as any]);
    }
    toast({ title: "Wedstrijd toegevoegd" });
    onSlotChange?.();
  };

  const deleteSingleMatch = async (matchId: string) => {
    const match = matches.find(m => m.id === matchId);
    if (!match) return;
    
    // Delete paired return leg if H&A
    const paired = findPairedMatch(match);
    const matchIdsToDelete = [match.id];
    if (paired) matchIdsToDelete.push(paired.id);
    
    // Delete stats and slots for these matches
    for (const mId of matchIdsToDelete) {
      const m = matches.find(x => x.id === mId);
      await supabase.from("match_stats").delete().eq("match_id", mId);
      // Delete associated slots
      if (m?.home_slot_label && isSlotCode(m.home_slot_label)) {
        await supabase.from("slots").delete().eq("tournament_id", tournamentId).eq("phase_id", phaseId).eq("slot_code", m.home_slot_label);
      }
      if (m?.away_slot_label && isSlotCode(m.away_slot_label)) {
        await supabase.from("slots").delete().eq("tournament_id", tournamentId).eq("phase_id", phaseId).eq("slot_code", m.away_slot_label);
      }
      await supabase.from("matches").delete().eq("id", mId);
    }
    
    await fetchData();
    toast({ title: "Wedstrijd verwijderd" });
    onSlotChange?.();
  };

  const clearAllR1Slots = async () => {
    if (matches.length === 0) return;
    const matchIds = matches.map(m => m.id);

    // 1) Verwijder alle matchstatistieken (doelpunten, assists, kaarten) van deze bracket
    if (matchIds.length > 0) {
      await supabase.from("match_stats").delete().in("match_id", matchIds);
    }

    // 2) Reset ALLE matches in deze bracket: teamtoewijzingen + resultaten
    //    Hiermee verdwijnt ook de doorstroming naar latere rondes (winnaars/verliezers).
    await supabase.from("matches").update({
      home_team_id: null,
      away_team_id: null,
      home_score: null,
      away_score: null,
      home_penalties: null,
      away_penalties: null,
      set_scores: null,
      is_played: false,
    }).in("id", matchIds);

    // 3) Leeg alle slot-codes die door deze bracket-matches gebruikt worden
    //    (zowel R1-startslots als latere ref_*-slots).
    const slotCodes = new Set<string>();
    for (const m of matches) {
      for (const lbl of [m.home_slot_label, m.away_slot_label]) {
        if (lbl && isSlotCode(lbl)) slotCodes.add(lbl);
      }
    }
    if (slotCodes.size > 0) {
      const clearUpdate = { team_id: null, ref_phase_id: null, ref_group_id: null, ref_position: null };
      await supabase
        .from("slots")
        .update(clearUpdate)
        .eq("tournament_id", tournamentId)
        .eq("phase_id", phaseId)
        .in("slot_code", Array.from(slotCodes));
    }

    await fetchData();
    toast({ title: "Alle slots, resultaten en doorstroming leeggemaakt" });
    onSlotChange?.();
  };

  // Score handlers
  const handleScoreChange = (matchId: string, field: "home_score" | "away_score", value: string) => {
    const numVal = value === "" ? null : parseInt(value);
    if (value !== "" && isNaN(parseInt(value))) return;
    setMatches(m => m.map(x => {
      if (x.id !== matchId) return x;
      const updated = { ...x, [field]: numVal };
      const hs = field === "home_score" ? numVal : x.home_score;
      const as_ = field === "away_score" ? numVal : x.away_score;
      if (hs !== null && as_ !== null && hs !== as_) { updated.home_penalties = null; updated.away_penalties = null; }
      return updated;
    }));
  };

  const handlePenaltyChange = (matchId: string, field: "home_penalties" | "away_penalties", value: string) => {
    if (value !== "" && isNaN(parseInt(value))) return;
    setMatches(m => m.map(x => x.id === matchId ? { ...x, [field]: value === "" ? null : parseInt(value) } : x));
  };

  const handleBlurSave = (matchId: string) => {
    const match = matches.find(m => m.id === matchId);
    if (match) saveScore(match);
  };

  const getReferenceMatchFromLabel = (label: string | null) => {
    const reference = label?.match(/^(Winnaar|Verliezer)\s+(.+)$/);
    if (!reference) return null;
    return matches.find((match) => match.match_name === reference[2]) ?? null;
  };

  const getSeedNumbersFromLabel = (label: string | null, visited = new Set<string>()): number[] => {
    if (!label) return [];

    const slotMatch = label.match(/^S(\d+)$/i);
    if (slotMatch) return [parseInt(slotMatch[1], 10)];

    const referencedMatch = getReferenceMatchFromLabel(label);
    if (!referencedMatch || visited.has(referencedMatch.id)) return [];

    const nextVisited = new Set(visited);
    nextVisited.add(referencedMatch.id);

    return [
      ...getSeedNumbersFromLabel(referencedMatch.home_slot_label, nextVisited),
      ...getSeedNumbersFromLabel(referencedMatch.away_slot_label, nextVisited),
    ];
  };

  const getStructuralSeedRange = (match: BracketMatch) => {
    const seedNumbers = [
      ...getSeedNumbersFromLabel(match.home_slot_label),
      ...getSeedNumbersFromLabel(match.away_slot_label),
    ].filter((value) => Number.isFinite(value));

    if (seedNumbers.length === 0) {
      return { min: Number.MAX_SAFE_INTEGER, max: Number.MAX_SAFE_INTEGER };
    }

    return {
      min: Math.min(...seedNumbers),
      max: Math.max(...seedNumbers),
    };
  };

  const sortMatchesByStructure = (items: BracketMatch[]) => {
    return [...items].sort((a, b) => {
      const roundDiff = (a.round_number ?? 999) - (b.round_number ?? 999);
      if (roundDiff !== 0) return roundDiff;

      const aSeeds = getStructuralSeedRange(a);
      const bSeeds = getStructuralSeedRange(b);
      if (aSeeds.min !== bSeeds.min) return aSeeds.min - bSeeds.min;
      if (aSeeds.max !== bSeeds.max) return aSeeds.max - bSeeds.max;

      const createdDiff = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      if (createdDiff !== 0) return createdDiff;

      return a.id.localeCompare(b.id);
    });
  };

  // Bracket structuur blijft vast op basis van match-relaties, niet op ronde-naam
  const visibleGroups = filterGroupIds?.length ? groups.filter(group => filterGroupIds.includes(group.id)) : groups;
  const visibleGroupIds = new Set(visibleGroups.map((group) => group.id));

  const allRounds = visibleGroups.map(g => {
    let roundMatches = sortMatchesByStructure(matches.filter(m => m.group_id === g.id));
    // H&A: filter out "(Terug)" matches from display — they're shown inline in the Heen card
    // This applies for both phase-level and per-match H&A
    roundMatches = roundMatches.filter(m => !isReturnLeg(m));
    // Multi-encounter single_match: only show first encounter per slot pair
    if (isSingleMatch && phaseEncounters > 1) {
      roundMatches = roundMatches.filter(m => isFirstEncounter(m));
    }
    const minRound = roundMatches.length > 0 ? Math.min(...roundMatches.map(m => m.round_number ?? 999)) : 999;
    return { ...g, matches: roundMatches, minRound };
  });

  const parseReference = (label: string | null): { type: "Winnaar" | "Verliezer"; matchName: string } | null => {
    if (!label) return null;
    const parsed = label.match(/^(Winnaar|Verliezer)\s+(.+)$/);
    if (!parsed) return null;
    return { type: parsed[1] as "Winnaar" | "Verliezer", matchName: parsed[2] };
  };

  const matchesByName = new Map<string, BracketMatch>();
  for (const match of matches) {
    if (match.match_name && !matchesByName.has(match.match_name)) {
      matchesByName.set(match.match_name, match);
    }
    // H&A: also register base name (without Heen/Terug) so downstream "Winnaar BaseName" references resolve
    if (match.match_name) {
      const base = getBaseMatchName(match.match_name);
      if (base && base !== match.match_name && !matchesByName.has(base)) {
        matchesByName.set(base, match);
      }
    }
  }

  const winnerEdges = new Map<string, Set<string>>();
  const loserSourceGroupsByRound = new Map<string, Set<string>>();

  for (const round of allRounds) {
    for (const match of round.matches) {
      for (const label of [match.home_slot_label, match.away_slot_label]) {
        const reference = parseReference(label);
        if (!reference) continue;
        const sourceMatch = matchesByName.get(reference.matchName);
        if (!sourceMatch?.group_id || !visibleGroupIds.has(sourceMatch.group_id) || sourceMatch.group_id === round.id) continue;

        if (reference.type === "Winnaar") {
          if (!winnerEdges.has(sourceMatch.group_id)) winnerEdges.set(sourceMatch.group_id, new Set());
          winnerEdges.get(sourceMatch.group_id)!.add(round.id);
        } else {
          if (!loserSourceGroupsByRound.has(round.id)) loserSourceGroupsByRound.set(round.id, new Set());
          loserSourceGroupsByRound.get(round.id)!.add(sourceMatch.group_id);
        }
      }
    }
  }

  const hasBaseSlot = (label: string | null) => !!label && !/^(Winnaar|Verliezer)\s+/i.test(label);
  const seedGroupIds = new Set(
    allRounds
      .filter(round => round.matches.some(match => hasBaseSlot(match.home_slot_label) || hasBaseSlot(match.away_slot_label)))
      .map(round => round.id),
  );

  if (seedGroupIds.size === 0 && allRounds.length > 0) {
    seedGroupIds.add(allRounds[0].id);
  }

  const mainGroupIds = new Set<string>(seedGroupIds);
  const queue = [...seedGroupIds];
  while (queue.length > 0) {
    const groupId = queue.shift()!;
    const nextGroups = winnerEdges.get(groupId);
    if (!nextGroups) continue;
    for (const nextGroupId of nextGroups) {
      if (mainGroupIds.has(nextGroupId)) continue;
      mainGroupIds.add(nextGroupId);
      queue.push(nextGroupId);
    }
  }

  const rounds = allRounds.filter(round => mainGroupIds.has(round.id)).sort((a, b) => a.minRound - b.minRound);

  const extractLoserPrefix = (round: (typeof allRounds)[number]): string | null => {
    // Check stored mapping first (most reliable, survives renames)
    const mappedPrefix = bracketGroupMap[round.id];
    if (mappedPrefix) return mappedPrefix;

    // Old format: "Plaatsing X-Y: ..."
    const fromGroupName = round.name.match(/^Plaatsing\s+(\d+-\d+)/i);
    if (fromGroupName) return fromGroupName[1];

    // Match names have the bracket prefix (P-prefix or Finale prefix)
    for (const match of round.matches) {
      const fromMatchName = match.match_name?.match(/(?:^P|Finale\s+)(\d+-\d+)/i);
      if (fromMatchName) return fromMatchName[1];
      const fromHomeRef = match.home_slot_label?.match(/(?:Winnaar|Verliezer)\s+(?:P(\d+-\d+)|Finale\s+(\d+-\d+))/i);
      if (fromHomeRef) return fromHomeRef[1] || fromHomeRef[2];
      const fromAwayRef = match.away_slot_label?.match(/(?:Winnaar|Verliezer)\s+(?:P(\d+-\d+)|Finale\s+(\d+-\d+))/i);
      if (fromAwayRef) return fromAwayRef[1] || fromAwayRef[2];
    }

    // New format group name: "RoundName: Plaats X-Y" — fallback
    const fromNewGroupName = round.name.match(/Plaats\s+(\d+-\d+)/i);
    if (fromNewGroupName) {
      for (const match of round.matches) {
        for (const label of [match.home_slot_label, match.away_slot_label]) {
          const ref = label?.match(/(?:Winnaar|Verliezer)\s+P(\d+-\d+)/i);
          if (ref) return ref[1];
        }
      }
      return fromNewGroupName[1];
    }

    return null;
  };

  const placementCandidateRounds: typeof allRounds = [];
  const loserBrackets: Record<string, typeof allRounds> = {};

  const isPlacementRound = (round: (typeof allRounds)[number]) => {
    if (round.matches.length !== 1) return false;
    const sourceGroups = loserSourceGroupsByRound.get(round.id);
    if (!sourceGroups || sourceGroups.size !== 1) return false;
    const [sourceGroupId] = Array.from(sourceGroups);
    const sourceRound = allRounds.find((entry) => entry.id === sourceGroupId);
    return !!sourceRound && sourceRound.matches.length === 2;
  };

  for (const round of allRounds) {
    if (mainGroupIds.has(round.id)) continue;

    if (isPlacementRound(round)) {
      placementCandidateRounds.push(round);
      continue;
    }

    const prefix = extractLoserPrefix(round);
    if (!prefix) {
      placementCandidateRounds.push(round);
      continue;
    }
    if (!loserBrackets[prefix]) loserBrackets[prefix] = [];
    loserBrackets[prefix].push(round);
  }

  for (const key of Object.keys(loserBrackets)) {
    loserBrackets[key].sort((a, b) => a.minRound - b.minRound);
  }

  const getPlacementRoundsForBracket = (bracketRounds: typeof rounds) => {
    if (bracketRounds.length < 2) return [] as typeof allRounds;
    const semiFinalGroupId = bracketRounds[bracketRounds.length - 2].id;
    return placementCandidateRounds
      .filter((round) => loserSourceGroupsByRound.get(round.id)?.has(semiFinalGroupId))
      .sort((a, b) => a.minRound - b.minRound);
  };

  const existingLoserPrefixes = new Set(Object.keys(loserBrackets));
  const sortedLoserKeys = Object.keys(loserBrackets).sort((a, b) => parseInt(a) - parseInt(b));

  // Detect parent-child relationships between loser brackets
  const getLoserBracketParent = (prefix: string): string | null => {
    const bracketRounds = loserBrackets[prefix];
    if (!bracketRounds || bracketRounds.length === 0) return null;
    const firstRound = bracketRounds[0];
    for (const match of firstRound.matches) {
      for (const label of [match.home_slot_label, match.away_slot_label]) {
        const ref = parseReference(label);
        if (ref?.type === "Verliezer") {
          const sourceMatch = matchesByName.get(ref.matchName);
          if (sourceMatch) {
            for (const [otherPrefix, otherRounds] of Object.entries(loserBrackets)) {
              if (otherPrefix === prefix) continue;
              if (otherRounds.some(r => r.matches.some(m => m.id === sourceMatch.id))) {
                return otherPrefix;
              }
            }
          }
        }
      }
    }
    return null;
  };

  const loserBracketParents: Record<string, string | null> = {};
  for (const prefix of sortedLoserKeys) {
    loserBracketParents[prefix] = getLoserBracketParent(prefix);
  }
  const topLevelLoserKeys = sortedLoserKeys.filter(k => !loserBracketParents[k]);

  const saveBracketName = async (bracketKey: string, bracketRoundsToRename: typeof rounds) => {
    const newBracketName = bracketNameEdit.trim();

    // Single match title: update the phase name directly
    if (isSingleMatch && newBracketName) {
      await supabase.from("tournament_phases").update({ name: newBracketName } as any).eq("id", phaseId);
      setPhases(p => p.map(ph => ph.id === phaseId ? { ...ph, name: newBracketName } : ph));
      setEditingBracketName(null);
      await fetchData();
      return;
    }

    const updatedNames = { ...bracketNames, [bracketKey]: newBracketName };
    const updatedGroupMap = { ...bracketGroupMap };

    // For sub-brackets: store bracketGroupMap and cascade rename round/match names
    if (bracketKey !== "main") {
      const placementRounds = getPlacementRoundsForBracket(bracketRoundsToRename);
      const allBracketRounds = [...bracketRoundsToRename, ...placementRounds];

      // Store bracketGroupMap for all groups (prevents disappearing after rename)
      for (const round of allBracketRounds) {
        updatedGroupMap[round.id] = bracketKey;
      }

      // Collect match names from OTHER brackets for collision detection
      const bracketGroupIdSet = new Set(allBracketRounds.map(r => r.id));
      const otherMatchNames = new Set(
        matches.filter(m => m.group_id && !bracketGroupIdSet.has(m.group_id) && m.match_name)
          .map(m => m.match_name!)
      );

      // Auto-update round names and match names
      for (const round of allBracketRounds) {
        const matchCount = round.matches.length;
        const knockoutLabel = getKnockoutRoundLabel(matchCount);
        const oldGroupName = round.name;

        const sortedMatches = sortMatchesByStructure(round.matches);
        const newGroupName = `${knockoutLabel}: ${newBracketName}`;

        if (oldGroupName !== newGroupName) {
          await supabase.from("groups").update({ name: newGroupName }).eq("id", round.id);

          for (let i = 0; i < sortedMatches.length; i++) {
            const match = sortedMatches[i];
            const oldMatchName = match.match_name;
            const singularLabel = getBaseKnockoutRoundLabelSingular(matchCount);
            const newMatchName = sortedMatches.length === 1
              ? `${singularLabel} (${newBracketName})`
              : `${singularLabel} ${i + 1} (${newBracketName})`;

            if (oldMatchName && oldMatchName !== newMatchName) {
              otherMatchNames.add(newMatchName);
              await supabase.from("matches").update({ match_name: newMatchName }).eq("id", match.id);
              await supabase.from("matches").update({ home_slot_label: `Winnaar ${newMatchName}` })
                .eq("tournament_id", tournamentId).eq("phase_id", phaseId).eq("home_slot_label", `Winnaar ${oldMatchName}`);
              await supabase.from("matches").update({ away_slot_label: `Winnaar ${newMatchName}` })
                .eq("tournament_id", tournamentId).eq("phase_id", phaseId).eq("away_slot_label", `Winnaar ${oldMatchName}`);
              await supabase.from("matches").update({ home_slot_label: `Verliezer ${newMatchName}` })
                .eq("tournament_id", tournamentId).eq("phase_id", phaseId).eq("home_slot_label", `Verliezer ${oldMatchName}`);
              await supabase.from("matches").update({ away_slot_label: `Verliezer ${newMatchName}` })
                .eq("tournament_id", tournamentId).eq("phase_id", phaseId).eq("away_slot_label", `Verliezer ${oldMatchName}`);
            }
          }
        }
      }
    }

    await supabase.from("tournament_phases").update({
      match_config: { ...(currentPhase?.match_config || {}), bracketNames: updatedNames, bracketGroupMap: updatedGroupMap }
    } as any).eq("id", phaseId);

    setPhases(p => p.map(ph => ph.id === phaseId ? { ...ph, match_config: { ...(ph.match_config || {}), bracketNames: updatedNames, bracketGroupMap: updatedGroupMap } } : ph));
    setEditingBracketName(null);
    await fetchData();
  };
  const loserBracketChildren: Record<string, string[]> = {};
  for (const prefix of sortedLoserKeys) {
    const parent = loserBracketParents[prefix];
    if (parent) {
      if (!loserBracketChildren[parent]) loserBracketChildren[parent] = [];
      loserBracketChildren[parent].push(prefix);
    }
  }

  const getAvailableSubBrackets = (prefix: string) => {
    const bracketRounds = loserBrackets[prefix];
    if (!bracketRounds || bracketRounds.length < 3) return [];
    const [fromStr, toStr] = prefix.split("-");
    const offset = parseInt(fromStr) - 1;
    const parentTo = parseInt(toStr);
    const result: { prefix: string; posFrom: number; posTo: number; sourceRound: typeof rounds[0] }[] = [];
    for (let i = 0; i < bracketRounds.length - 2; i++) {
      const matchCount = bracketRounds[i].matches.length;
      if (matchCount < 2) continue;
      const relFrom = matchCount + 1;
      const absFrom = relFrom + offset;
      const absTo = absFrom + matchCount - 1;
      const subPrefix = `${absFrom}-${absTo}`;
      if (!existingLoserPrefixes.has(subPrefix)) {
        result.push({ prefix: subPrefix, posFrom: absFrom, posTo: absTo, sourceRound: bracketRounds[i] });
      }
    }
    return result;
  };

  const availableLoserBrackets = (() => {
    const result = new Map<string, { prefix: string; posFrom: number; posTo: number; sourceRound: typeof rounds[0] }>();
    for (let i = 0; i < rounds.length - 2; i++) {
      const matchCount = rounds[i].matches.length;
      if (matchCount < 2) continue;
      const posFrom = matchCount + 1 + labelOffset;
      const posTo = matchCount * 2 + labelOffset;
      const prefix = `${posFrom}-${posTo}`;
      if (!existingLoserPrefixes.has(prefix) && !result.has(prefix)) {
        result.set(prefix, { prefix, posFrom, posTo, sourceRound: rounds[i] });
      }
    }
    return Array.from(result.values()).sort((a, b) => a.posFrom - b.posFrom);
  })();

  const previousPositionsGrouped = getPreviousPositionsGrouped();
  const hasPreviousPhases = Object.keys(previousPositionsGrouped).length > 0;
  const allPreviousPositions = Object.values(previousPositionsGrouped).flat();
  const getGroupSourceKey = (phaseId: string, groupId: string, position: number) => `${phaseId}|${groupId}|${position}`;
  const getCrossSourceKey = (phaseId: string, tier: number, rank: number) => `${phaseId}|${tier}|${rank}`;
  const getTierPhaseKey = (phaseId: string, tier: number) => `${phaseId}|${tier}`;
  const round1GroupId = rounds.length > 0 ? rounds[0].id : null;
  const isRound1Match = (match: BracketMatch) => match.group_id === round1GroupId;
  const r1Matches = rounds.length > 0 ? rounds[0].matches : [];
  const assignedTeamIds = new Set<string>();
  const teamPickerMatches = isSingleMatch ? rounds.flatMap(r => r.matches) : r1Matches;
  for (const m of teamPickerMatches) { if (m.home_team_id) assignedTeamIds.add(m.home_team_id); if (m.away_team_id) assignedTeamIds.add(m.away_team_id); }

  // Source positions are unique across scoped formats/phases, but the visual swap mode stays local.
  const usedGroupSourceKeys = new Set<string>();
  const usedCrossSourceKeys = new Set<string>();
  const crossModeTierPhaseKeys = new Set<string>();

  const registerLegacyLabel = (label: string | null) => {
    if (!label || isSlotCode(label) || label === "TBD" || label === "BYE") return;

    const crossMatch = label.match(/^(\d+)e nr\.(\d+)(?: \((.+)\))?$/);
    if (crossMatch) {
      const rank = parseInt(crossMatch[1], 10);
      const tier = parseInt(crossMatch[2], 10);
      const formatName = crossMatch[3];
      const refPhase = previousPhases.find((p) => p.name === formatName);
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

  const scopedPhaseIdSet = new Set(scopedPhases.map((phase) => phase.id));
  const scopedMatchGroupIds = new Set(scopedGroups.map((group) => group.id));
  const relevantMatches = allTournamentMatches.filter((match) => scopedPhaseIdSet.has(match.phase_id));

  for (const m of relevantMatches) {
    registerLegacyLabel(m.home_slot_label);
    registerLegacyLabel(m.away_slot_label);
  }

  // Check slot references from all scoped phases for uniqueness
  for (const s of allTournamentSlots) {
    if (!scopedPhaseIdSet.has(s.phase_id ?? "")) continue;
    if (s.ref_phase_id && s.ref_position) {
      if (s.ref_group_id) {
        usedGroupSourceKeys.add(getGroupSourceKey(s.ref_phase_id, s.ref_group_id, s.ref_position));
      } else if (s.ref_position >= 100) {
        const tier = Math.floor(s.ref_position / 100);
        const rank = s.ref_position % 100;
        usedCrossSourceKeys.add(getCrossSourceKey(s.ref_phase_id, tier, rank));
        if ((s.group_id && scopedMatchGroupIds.has(s.group_id)) || (isSingleMatch && s.phase_id === phaseId)) {
          crossModeTierPhaseKeys.add(getTierPhaseKey(s.ref_phase_id, tier));
        }
      }
    }
  }

  const toggleSwapTier = async (e: React.MouseEvent, sourcePhaseId: string, tier: number) => {
    e.stopPropagation();
    const tierKey = getTierPhaseKey(sourcePhaseId, tier);
    const isActivating = !swappedTiers.has(tierKey);
    const tierPositions = [...allPreviousPositions.filter((p) => p.phaseId === sourcePhaseId && p.position === tier && !p.isSingleMatchPos)].sort((a, b) => {
      const phaseA = previousPhases.find((p) => p.id === a.phaseId);
      const phaseB = previousPhases.find((p) => p.id === b.phaseId);
      const phaseOrderDiff = (phaseA?.phase_number ?? 0) - (phaseB?.phase_number ?? 0);
      if (phaseOrderDiff !== 0) return phaseOrderDiff;
      return a.groupName.localeCompare(b.groupName);
    });

    if (tierPositions.length === 0) {
      setSwappedTiers((prev) => {
        const next = new Set(prev);
        if (next.has(tierKey)) next.delete(tierKey);
        else next.add(tierKey);
        return next;
      });
      window.dispatchEvent(new CustomEvent("tier-swap-mode-change", { detail: { tierKey, active: isActivating } }));
      return;
    }

    const buildCrossLabel = (refPhaseId: string, rank: number) => {
      const refPhase = phases.find((p) => p.id === refPhaseId);
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
          ? [entry.label, buildCrossLabel(entry.phaseId, rank)]
          : [buildCrossLabel(entry.phaseId, rank), entry.label];
      })
    );

    let didChange = false;

    if (isActivating) {
      const allSlotsToConvert = allTournamentSlots.filter((slot) =>
        scopedPhaseIdSet.has(slot.phase_id ?? "") &&
        slot.ref_phase_id === sourcePhaseId &&
        slot.ref_phase_id &&
        slot.ref_group_id &&
        slot.ref_position === tier &&
        rankBySourceKey.has(getGroupSourceKey(slot.ref_phase_id, slot.ref_group_id, slot.ref_position))
      );

      if (allSlotsToConvert.length > 0) {
        const slotResults = await Promise.all(
          allSlotsToConvert.map((slot) => {
            const rank = rankBySourceKey.get(getGroupSourceKey(slot.ref_phase_id!, slot.ref_group_id!, slot.ref_position!));
            return supabase
              .from("slots")
              .update({
                ref_group_id: null,
                ref_position: tier * 100 + (rank ?? 1),
              })
              .eq("id", slot.id);
          })
        );

        const slotError = slotResults.find((result) => result.error)?.error;
        if (slotError) {
          toast({ title: "Fout", description: slotError.message, variant: "destructive" });
          return;
        }
        didChange = true;
      }
    } else {
      const allSlotsToConvert = allTournamentSlots.filter((slot) =>
        scopedPhaseIdSet.has(slot.phase_id ?? "") &&
        slot.ref_phase_id === sourcePhaseId &&
        slot.ref_phase_id &&
        slot.ref_group_id === null &&
        slot.ref_position !== null &&
        slot.ref_position >= tier * 100 &&
        slot.ref_position < (tier + 1) * 100
      );

      if (allSlotsToConvert.length > 0) {
        const slotResults = await Promise.all(
          allSlotsToConvert.map((slot) => {
            const rank = slot.ref_position! % 100;
            const targetEntry = tierPositions[rank - 1];
            if (!targetEntry?.groupId) return Promise.resolve({ error: null } as { error: null });
            return supabase
              .from("slots")
              .update({
                ref_group_id: targetEntry.groupId,
                ref_position: tier,
              })
              .eq("id", slot.id);
          })
        );

        const slotError = slotResults.find((result) => result.error)?.error;
        if (slotError) {
          toast({ title: "Fout", description: slotError.message, variant: "destructive" });
          return;
        }
        didChange = true;
      }
    }

    const { data: tournamentMatches, error: matchesError } = await supabase
      .from("matches")
      .select("id, home_slot_label, away_slot_label")
      .eq("tournament_id", tournamentId);

    if (matchesError) {
      toast({ title: "Fout", description: matchesError.message, variant: "destructive" });
      return;
    }

    const matchUpdates = (tournamentMatches ?? []).flatMap((match) => {
      const updates: { home_slot_label?: string; away_slot_label?: string } = {};
      const nextHomeLabel = match.home_slot_label ? labelMap.get(match.home_slot_label) : undefined;
      const nextAwayLabel = match.away_slot_label ? labelMap.get(match.away_slot_label) : undefined;

      if (nextHomeLabel && nextHomeLabel !== match.home_slot_label) updates.home_slot_label = nextHomeLabel;
      if (nextAwayLabel && nextAwayLabel !== match.away_slot_label) updates.away_slot_label = nextAwayLabel;

      if (Object.keys(updates).length === 0) return [];
      return [supabase.from("matches").update(updates).eq("id", match.id)];
    });

    if (matchUpdates.length > 0) {
      const matchResults = await Promise.all(matchUpdates);
      const matchError = matchResults.find((result) => result.error)?.error;
      if (matchError) {
        toast({ title: "Fout", description: matchError.message, variant: "destructive" });
        return;
      }
      didChange = true;
    }

    if (didChange) {
      await fetchData();
      onSlotChange?.();
    }

    setSwappedTiers((prev) => {
      const next = new Set(prev);
        if (next.has(tierKey)) next.delete(tierKey);
        else next.add(tierKey);
      return next;
    });

    window.dispatchEvent(new CustomEvent("tier-swap-mode-change", { detail: { tierKey, active: isActivating } }));
  };

  // Team picker (only for structural editing)
  const renderTeamPicker = (matchId: string, side: "home" | "away") => {
    if (!editable) return null;
    if (!teamPickerOpen || teamPickerOpen.matchId !== matchId || teamPickerOpen.side !== side) return null;
    const match = matches.find(m => m.id === matchId);
    const currentTeamId = side === "home" ? match?.home_team_id : match?.away_team_id;
    const currentLabel = side === "home" ? match?.home_slot_label : match?.away_slot_label;
    const currentSlot = currentLabel ? slots.find((entry) => entry.slot_code === currentLabel) : null;

    let currentGroupSourceKey: string | null = null;
    let currentCrossSourceKey: string | null = null;

    if (currentSlot?.ref_phase_id && currentSlot?.ref_position) {
      if (currentSlot.ref_group_id) {
        currentGroupSourceKey = getGroupSourceKey(currentSlot.ref_phase_id, currentSlot.ref_group_id, currentSlot.ref_position);
      } else if (currentSlot.ref_position >= 100) {
        const tier = Math.floor(currentSlot.ref_position / 100);
        const rank = currentSlot.ref_position % 100;
        currentCrossSourceKey = getCrossSourceKey(currentSlot.ref_phase_id, tier, rank);
      }
    }

    if (!currentGroupSourceKey && !currentCrossSourceKey && currentLabel && !isSlotCode(currentLabel)) {
      const selectedPosition = allPreviousPositions.find((position) => position.label === currentLabel);
      if (selectedPosition?.groupId) {
        currentGroupSourceKey = getGroupSourceKey(selectedPosition.phaseId, selectedPosition.groupId, selectedPosition.position);
      } else {
        const crossMatch = currentLabel.match(/^(\d+)e nr\.(\d+)(?: \((.+)\))?$/);
        if (crossMatch) {
          const rank = parseInt(crossMatch[1], 10);
          const tier = parseInt(crossMatch[2], 10);
          const formatName = crossMatch[3];
          const refPhase = previousPhases.find((p) => p.name === formatName);
          if (refPhase) currentCrossSourceKey = getCrossSourceKey(refPhase.id, tier, rank);
        }
      }
    }

    const pickerTeams = filteredTeams.filter(t => !assignedTeamIds.has(t.id) || t.id === currentTeamId);
    return (
      <div ref={(el) => {
        (pickerRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
        if (el) {
          const rect = el.getBoundingClientRect();
          const spaceBelow = window.innerHeight - rect.top;
          if (spaceBelow < 100 && rect.top > rect.height) {
            el.style.top = "auto";
            el.style.bottom = "100%";
            el.style.marginTop = "0";
            el.style.marginBottom = "4px";
          }
        }
      }} className="absolute z-50 w-56 rounded-lg border border-border bg-card shadow-lg max-h-72 overflow-y-auto top-full mt-1 left-0" style={{ maxHeight: "min(288px, 50vh)" }}>
        {/* 1. Geen (empty slot) */}
        <button onClick={(e) => { e.stopPropagation(); assignPositionToMatch(matchId, side, "TBD"); }}
          className="w-full px-3 py-1.5 text-left text-xs hover:bg-accent/50 transition-colors flex items-center gap-2">
          <span className="font-mono font-bold text-destructive text-xs">GEEN</span>
          <span className="text-[10px] text-muted-foreground">— slot leegmaken</span>
        </button>
        {/* 2. BYE with info tooltip */}
        <div className="flex items-center border-t border-border">
          <button onClick={(e) => { e.stopPropagation(); assignByeToMatch(matchId, side); }}
            className="flex-1 px-3 py-1.5 text-left text-xs hover:bg-accent/50 transition-colors flex items-center gap-2">
            <span className="font-mono font-bold text-primary text-xs">BYE</span>
            <span className="text-[10px] text-muted-foreground">— geen tegenstander</span>
          </button>
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button onClick={(e) => e.stopPropagation()} className="px-2 py-1.5 text-muted-foreground hover:text-foreground">
                  <Info className="h-3 w-3" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-[200px] text-xs">
                Door een ploeg een BYE te geven is deze automatisch door naar de volgende ronde in de knock-outfase.
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        {/* 3. Posities uit vorige fase */}
        {hasPreviousPhases && (
          <>
            <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground bg-secondary/50 border-t border-border">Positie uit vorige fase</div>
            {/* Positions grouped by format (phase), ordered by phase sort_order */}
            {(() => {
              const allPositions = Object.values(previousPositionsGrouped).flat();
              // Group by phaseId
              const byPhase: Record<string, typeof allPositions> = {};
              for (const entry of allPositions) {
                if (!byPhase[entry.phaseId]) byPhase[entry.phaseId] = [];
                byPhase[entry.phaseId].push(entry);
              }
              // Order phases by their sort_order from previousPhases
              const eligiblePrevPhases = previousPhases.filter(p => p.phase_type !== "knockout");
              const orderedPhaseIds = eligiblePrevPhases
                .sort((a, b) => (a.phase_number ?? 0) - (b.phase_number ?? 0))
                .map(p => p.id)
                .filter(id => byPhase[id]);

              return orderedPhaseIds.map(phaseId => {
                const entries = byPhase[phaseId];
                const phase = eligiblePrevPhases.find(p => p.id === phaseId);
                const isSingleMatch = phase?.phase_type === "single_match";

                // Sort entries: for single_match by position (W1,L1,W2,L2), for groups by position then group name
                const sortedEntries = [...entries].sort((a, b) => {
                  if (isSingleMatch) return a.position - b.position;
                  return a.position - b.position || a.groupName.localeCompare(b.groupName);
                });

                return (
                  <div key={phaseId}>
                    <div className="px-3 py-1 text-[10px] font-bold text-primary bg-primary/10 border-t border-border">
                      {phase?.name || "Fase"}
                    </div>
                    {isSingleMatch ? (
                      /* Single match: flat list */
                      sortedEntries.map((entry, i) => {
                        const groupSourceKey = entry.groupId ? getGroupSourceKey(entry.phaseId, entry.groupId, entry.position) : null;
                        const isCurrent = groupSourceKey ? currentGroupSourceKey === groupSourceKey : false;
                        if (groupSourceKey && usedGroupSourceKeys.has(groupSourceKey) && !isCurrent) return null;
                        return (
                          <button
                            key={i}
                            onClick={(e) => { e.stopPropagation(); assignPositionToMatch(matchId, side, entry.label, { phaseId: entry.phaseId, groupId: entry.groupId, position: entry.position }); }}
                            className="w-full px-3 py-1.5 text-left text-xs text-foreground hover:bg-foreground/5 transition-colors flex items-center gap-2"
                          >
                            <ArrowRight className="h-3 w-3 text-primary flex-shrink-0" />
                            <span className="break-words">{entry.label}</span>
                          </button>
                        );
                      })
                    ) : (
                      /* Group/round_robin: sub-group by position tier */
                      (() => {
                        const positionTiers = [...new Set(sortedEntries.map(e => e.position))].sort((a, b) => a - b);
                        return positionTiers.map(pos => {
                          const tierEntries = sortedEntries.filter(e => e.position === pos);
                          const multipleGroups = tierEntries.length > 1;
                          const tierPhaseKey = getTierPhaseKey(phaseId, pos);
                          const isSwapped = swappedTiers.has(tierPhaseKey);
                          const hasCrossMode = tierEntries.some(e => crossModeTierPhaseKeys.has(getTierPhaseKey(e.phaseId, pos)));
                          const showCrossRanking = isSwapped || hasCrossMode;

                          return (
                            <div key={pos}>
                              <div className="px-3 py-0.5 text-[10px] font-semibold text-muted-foreground bg-muted/20 border-t border-border/50 flex items-center justify-between">
                                <span>{pos}e plaatsen</span>
                                {multipleGroups && (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); toggleSwapTier(e, phaseId, pos); }}
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
                                  const crossSourceKey = getCrossSourceKey(entry.phaseId, pos, rank);
                                  const groupSourceKey = entry.groupId ? getGroupSourceKey(entry.phaseId, entry.groupId, entry.position) : null;
                                  const isCurrent = currentCrossSourceKey === crossSourceKey || (groupSourceKey ? currentGroupSourceKey === groupSourceKey : false);
                                  if ((usedCrossSourceKeys.has(crossSourceKey) || (groupSourceKey ? usedGroupSourceKeys.has(groupSourceKey) : false)) && !isCurrent) return null;
                                  const crossLabel = buildCrossReferenceLabel(rank, pos, entry.formatName);
                                  return (
                                    <button
                                      key={i}
                                      onClick={(e) => { e.stopPropagation(); assignPositionToMatch(matchId, side, crossLabel); }}
                                      className="w-full px-3 py-1.5 text-left text-xs text-foreground hover:bg-foreground/5 transition-colors flex items-center gap-2"
                                    >
                                      <span className="font-mono text-[10px] bg-primary/10 text-primary px-1 py-0.5 rounded font-bold flex-shrink-0">
                                        #{rank}
                                      </span>
                                      <span className="break-words">{buildCrossReferenceLabel(rank, pos, entry.formatName)}</span>
                                    </button>
                                  );
                                })
                              ) : (
                                tierEntries.map((entry, i) => {
                                  const rank = i + 1;
                                  const groupSourceKey = entry.groupId ? getGroupSourceKey(entry.phaseId, entry.groupId, entry.position) : null;
                                  const crossSourceKey = getCrossSourceKey(entry.phaseId, pos, rank);
                                  const inCrossMode = crossModeTierPhaseKeys.has(getTierPhaseKey(entry.phaseId, pos));
                                  const isCurrent = (groupSourceKey ? currentGroupSourceKey === groupSourceKey : false) || currentCrossSourceKey === crossSourceKey;
                                  if ((groupSourceKey && usedGroupSourceKeys.has(groupSourceKey)) || usedCrossSourceKeys.has(crossSourceKey) || inCrossMode) {
                                    if (!isCurrent) return null;
                                  }
                                  return (
                                    <button
                                      key={i}
                                      onClick={(e) => { e.stopPropagation(); assignPositionToMatch(matchId, side, entry.label, { phaseId: entry.phaseId, groupId: entry.groupId, position: entry.position }); }}
                                      className="w-full px-3 py-1.5 text-left text-xs text-foreground hover:bg-foreground/5 transition-colors flex items-center gap-2"
                                    >
                                      <ArrowRight className="h-3 w-3 text-primary flex-shrink-0" />
                                      <span className="break-words">{entry.label}</span>
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
        <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-primary bg-primary/10 border-t border-border">Teams</div>
        {pickerTeams.map(t => (
          <button key={t.id} onClick={(e) => { e.stopPropagation(); assignTeamToMatch(matchId, side, t.id); }}
            className="w-full px-3 py-1.5 text-left text-xs text-foreground hover:bg-foreground/5 transition-colors flex items-center gap-2">
            {t.logo_url && <img src={t.logo_url} className="h-4 w-4 object-contain flex-shrink-0" alt="" />}
            <User className="h-3 w-3 text-muted-foreground flex-shrink-0" />{t.name}
          </button>
        ))}
      </div>
    );
  };

  const formatTime = (t: string | null) => t ? t.substring(0, 5) : null;

  // Match card
  const renderMatchCard = (match: BracketMatch) => {
    const homeName = isBye(match, "home") ? "BYE" : getTeamName(match.home_team_id, match.home_slot_label);
    const awayName = isBye(match, "away") ? "BYE" : getTeamName(match.away_team_id, match.away_slot_label);
    const homeLogo = getTeamLogo(match.home_team_id);
    const awayLogo = getTeamLogo(match.away_team_id);
    const canPickTeam = editable && (isSingleMatch || isRound1Match(match));
    const matchHasBye = isBye(match, "home") || isBye(match, "away");

    const fieldStr = match.field;
    const timeStr = formatTime(match.match_time);
    const dateStr = formatDateDMY(match.match_date);

    // H&A: find paired match for total display (works for both phase-level and per-match H&A)
    const matchIsHA = isMatchHomeAway(match);
    const pairedMatch = findPairedMatch(match);
    const isHeen = match.match_name?.endsWith("(Heen)");
    const displayBaseName = matchIsHA ? getBaseMatchName(match.match_name) : match.match_name;

    // H&A total score (computed early for won logic)
    const haTotal = matchIsHA && pairedMatch ? (() => {
      const heenMatch = isHeen ? match : pairedMatch;
      const terugMatch = isHeen ? pairedMatch : match;
      const homeTotal = (heenMatch.home_score ?? 0) + (terugMatch.away_score ?? 0);
      const awayTotal = (heenMatch.away_score ?? 0) + (terugMatch.home_score ?? 0);
      const bothPlayed = heenMatch.is_played && terugMatch.is_played;
      const anyScored = heenMatch.home_score !== null || terugMatch.home_score !== null;
      return { homeTotal, awayTotal, bothPlayed, anyScored, isTied: homeTotal === awayTotal && bothPlayed };
    })() : null;

    const isTied = match.home_score !== null && match.away_score !== null && match.home_score === match.away_score;

    // Determine winner: H&A uses aggregate, normal uses single match
    const homeWon = haTotal ? (
      haTotal.bothPlayed && (haTotal.homeTotal > haTotal.awayTotal || (haTotal.isTied && (match.home_penalties ?? 0) > (match.away_penalties ?? 0)))
    ) : match.is_played && (
      (match.home_score ?? 0) > (match.away_score ?? 0) ||
      ((match.home_score ?? 0) === (match.away_score ?? 0) && (match.home_penalties ?? 0) > (match.away_penalties ?? 0))
    );
    const awayWon = haTotal ? (
      haTotal.bothPlayed && (haTotal.awayTotal > haTotal.homeTotal || (haTotal.isTied && (match.away_penalties ?? 0) > (match.home_penalties ?? 0)))
    ) : match.is_played && !homeWon;

    // For encounters: get all encounters
    const encounterGroup = isSingleMatch && phaseEncounters > 1 ? getEncounterGroup(match) : null;
    const encounterTotal = encounterGroup ? {
      home: encounterGroup.reduce((sum, m) => sum + (m.home_score ?? 0), 0),
      away: encounterGroup.reduce((sum, m) => sum + (m.away_score ?? 0), 0),
      played: encounterGroup.filter(m => m.is_played).length,
    } : null;

    const renderTeamRow = (side: "home" | "away") => {
      const isHome = side === "home";
      const name = isHome ? homeName : awayName;
      const logo = isHome ? homeLogo : awayLogo;
      const won = isHome ? homeWon : awayWon;
      const score = isHome ? match.home_score : match.away_score;
      const penalties = isHome ? match.home_penalties : match.away_penalties;
      const scoreField = isHome ? "home_score" : "away_score";
      const teamId = isHome ? match.home_team_id : match.away_team_id;
      const hasTeam = !!teamId;

      // H&A: second score from paired match (return leg)
      const haTerugScore = matchIsHA && pairedMatch ? (isHome ? pairedMatch.away_score : pairedMatch.home_score) : null;
      const haTerugField = isHome ? "away_score" : "home_score";

      return (
        <div className="relative">
          <div
            className={`flex items-center gap-1.5 px-2 py-1 ${isHome ? "border-b border-border" : ""} transition-colors ${won ? "bg-accent/10" : ""} ${canPickTeam ? "cursor-pointer hover:bg-foreground/[0.03]" : ""}`}
            onClick={(e) => {
              if (canPickTeam) {
                e.stopPropagation();
                setTeamPickerOpen(teamPickerOpen?.matchId === match.id && teamPickerOpen.side === side ? null : { matchId: match.id, side });
              }
            }}
          >
            {logo && <img src={logo} className="h-4 w-4 object-contain flex-shrink-0" alt="" />}
            <div className={`flex items-center gap-1 flex-1 min-w-0 ${won ? "font-bold text-accent" : (isHome && homeName === "BYE") || (!isHome && awayName === "BYE") ? "font-mono font-bold text-primary" : ""}`}>
              <span className={`text-[11px] truncate ${won ? "font-bold text-accent" : "font-medium text-foreground"}`}>
                {name}
              </span>
              {tournament?.show_country && (isHome ? match.home_team_id : match.away_team_id) && (
                <CountryFlag country={getTeamCountry(isHome ? match.home_team_id : match.away_team_id)} className="h-3 w-4 object-contain flex-shrink-0 align-middle" />
              )}
            </div>
            {canPickTeam && !(isHome ? match.home_team_id : match.away_team_id) && <ChevronDown className="h-3 w-3 text-muted-foreground" />}

            {/* H&A: total + dual score inputs + inline penalties */}
            {matchIsHA && pairedMatch && !matchHasBye && showScores && effectiveScoreEditable ? (
              <div className="flex items-center gap-0.5 shrink-0">
                {haTotal && haTotal.anyScored && (
                  <span className="text-[9px] font-bold text-primary/70 tabular-nums mr-1">
                    {isHome ? haTotal.homeTotal : haTotal.awayTotal}
                  </span>
                )}
                <input
                  type="text" inputMode="numeric" pattern="[0-9]*"
                  value={score ?? ""}
                  onChange={(e) => handleScoreChange(match.id, scoreField as any, e.target.value)}
                  onBlur={() => handleBlurSave(match.id)}
                  className="h-6 w-8 text-center text-[11px] font-bold border border-muted rounded bg-background p-0 focus:outline-none focus:ring-1 focus:ring-ring"
                  placeholder="–" onClick={e => e.stopPropagation()}
                />
                <input
                  type="text" inputMode="numeric" pattern="[0-9]*"
                  value={haTerugScore ?? ""}
                  onChange={(e) => handleScoreChange(pairedMatch.id, haTerugField as any, e.target.value)}
                  onBlur={() => handleBlurSave(pairedMatch.id)}
                  className="h-6 w-8 text-center text-[11px] font-bold border border-muted rounded bg-background p-0 focus:outline-none focus:ring-1 focus:ring-ring"
                  placeholder="–" onClick={e => e.stopPropagation()}
                />
                {haTotal?.isTied && (
                  <input
                    type="text" inputMode="numeric" pattern="[0-9]*"
                    value={penalties ?? ""}
                    onChange={(e) => handlePenaltyChange(match.id, isHome ? "home_penalties" : "away_penalties", e.target.value)}
                    onBlur={() => handleBlurSave(match.id)}
                    className="h-5 w-5 text-center text-[8px] border border-muted rounded bg-background p-0 focus:outline-none focus:ring-1 focus:ring-ring ml-px"
                    placeholder="·" onClick={e => e.stopPropagation()}
                  />
                )}
                {!haTotal?.isTied && penalties !== null && (
                  <span className="text-[8px] text-muted-foreground font-medium ml-px">({penalties})</span>
                )}
              </div>
            ) : matchIsHA && pairedMatch && !matchHasBye && showScores ? (
              <div className="flex items-center gap-0.5 shrink-0">
                {haTotal && haTotal.anyScored && (
                  <span className="text-[9px] font-bold text-primary/70 tabular-nums mr-1">
                    {isHome ? haTotal.homeTotal : haTotal.awayTotal}
                  </span>
                )}
                <span className={`text-[11px] tabular-nums ${won ? "font-bold text-accent" : "font-medium text-foreground"}`}>
                  {score ?? "–"}
                </span>
                <span className={`text-[11px] tabular-nums ${won ? "font-bold text-accent" : "font-medium text-foreground"}`}>
                  {haTerugScore ?? "–"}
                </span>
                {penalties !== null && <span className="text-[8px] text-muted-foreground font-medium ml-px">({penalties})</span>}
              </div>
            ) : !matchHasBye && showScores && effectiveScoreEditable ? (
              <div className="flex items-center gap-0.5 shrink-0">
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={score ?? ""}
                  onChange={(e) => handleScoreChange(match.id, scoreField as any, e.target.value)}
                  onBlur={() => handleBlurSave(match.id)}
                  className="h-6 w-8 text-center text-[11px] font-bold border border-muted rounded bg-background p-0 focus:outline-none focus:ring-1 focus:ring-ring"
                  placeholder="–"
                  onClick={e => e.stopPropagation()}
                />
                {isTied && (
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={penalties ?? ""}
                    onChange={(e) => handlePenaltyChange(match.id, isHome ? "home_penalties" : "away_penalties", e.target.value)}
                    onBlur={() => handleBlurSave(match.id)}
                    className="h-5 w-5 text-center text-[8px] border border-muted rounded bg-background p-0 focus:outline-none focus:ring-1 focus:ring-ring ml-px"
                    placeholder="·"
                    onClick={e => e.stopPropagation()}
                  />
                )}
                {!isTied && penalties !== null && (
                  <span className="text-[8px] text-muted-foreground font-medium ml-px">({penalties})</span>
                )}
              </div>
            ) : !matchHasBye && showScores ? (
              <div className="flex items-center gap-0.5 shrink-0">
                <span className={`text-[11px] tabular-nums ${won ? "font-bold text-accent" : "font-medium text-foreground"}`}>{score ?? "–"}</span>
                {penalties !== null && <span className="text-[8px] text-muted-foreground font-medium ml-px">({penalties})</span>}
              </div>
            ) : null}
          </div>
          {canPickTeam && renderTeamPicker(match.id, side)}
        </div>
      );
    };

    return (
      <div
        key={match.id}
        className={`w-60 rounded-lg border border-border bg-card shadow-sm ${!canPickTeam && tournament ? "cursor-pointer hover:border-accent/40 transition-colors" : ""}`}
        style={{ overflow: "visible" }}
        onClick={() => {
          if (!canPickTeam && tournament) {
            if (matchIsHA && pairedMatch) {
              setSelectedHAMatchId(isHeen ? match.id : pairedMatch.id);
            } else {
              setSelectedMatchId(match.id);
            }
          }
        }}
      >
        {(currentPhase?.name || match.match_name || fieldStr || match.referee) && (
          <div className="px-2.5 py-1 bg-secondary/50 border-b border-border">
            <div className="flex items-start justify-between">
              <div className="min-w-0 flex-1">
                {editable && editingMatchName === match.id ? (
                  <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                    <Input value={matchNameEdit} onChange={e => { setMatchNameEdit(e.target.value); setMatchNameError(null); }} className={`h-5 text-[10px] flex-1 ${matchNameError ? "border-destructive" : ""}`}
                      onKeyDown={e => { if (e.key === "Enter") saveMatchName(match.id); if (e.key === "Escape") { setEditingMatchName(null); setMatchNameError(null); } }}
                      onBlur={(e) => { if (!e.relatedTarget?.closest?.('[data-match-edit-actions]')) saveMatchName(match.id); }}
                      autoFocus />
                    {matchNameError && <p className="text-[9px] text-destructive w-full">{matchNameError}</p>}
                    <div data-match-edit-actions className="flex items-center gap-1">
                      <button onMouseDown={e => e.preventDefault()} onClick={() => saveMatchName(match.id)} className="text-primary"><Check className="h-3 w-3" /></button>
                      <button onMouseDown={e => e.preventDefault()} onClick={() => setEditingMatchName(null)} className="text-muted-foreground"><X className="h-3 w-3" /></button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-1.5">
                    {currentPhase?.logo_url && (
                      <img src={currentPhase.logo_url} alt="" className="h-5 w-5 object-contain flex-shrink-0 rounded-sm mt-0.5" />
                    )}
                    <div className="min-w-0 flex-1">
                      {currentPhase?.name && (
                        <div className="text-[9px] font-bold text-primary/80 truncate leading-tight">
                          {currentPhase.name}
                        </div>
                      )}
                      {(displayBaseName || match.match_name) && (() => {
                        const baseName = displayBaseName || match.match_name || "";
                        const haSuffix = matchIsHA
                          ? ` (${match.match_name?.endsWith("(Heen)") ? "HEEN" : "TERUG"})`
                          : "";
                        const suffix = matchIsHA
                          ? ""
                          : getMatchFormatSuffix(
                              match as any,
                              scoringSystems as any,
                              phases as any,
                              groups as any
                            );
                        return (
                          <span className="text-[10px] font-semibold text-muted-foreground truncate leading-tight block">
                            {baseName}{suffix}{haSuffix}
                          </span>
                        );
                      })()}
                      {dateStr && (
                        <div className="text-[9px] text-muted-foreground/70 truncate leading-tight">{dateStr}{timeStr ? ` • ${timeStr}` : ""}</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
              <div className="flex items-start gap-1 flex-shrink-0 ml-1">
                {editable && (
                  <button 
                    onClick={(e) => { e.stopPropagation(); openMatchSettings(match.id); }} 
                    className="text-muted-foreground hover:text-foreground p-0.5 rounded hover:bg-foreground/5"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                )}
                {editable && isSingleMatch && (
                  <button 
                    onClick={(e) => { e.stopPropagation(); setShowDeleteSingleConfirm(match.id); }} 
                    className="text-muted-foreground hover:text-destructive p-0.5 rounded hover:bg-destructive/5"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
                <div className="text-right">
                  {fieldStr && (
                    <div className="text-[9px] font-bold text-muted-foreground inline-flex items-center gap-0.5 justify-end leading-none">
                      <MapPin className="h-2 w-2 flex-shrink-0" /> <span className="leading-none truncate max-w-[110px]" title={fieldStr}>{fieldStr}</span>
                    </div>
                  )}
                  {match.referee && (
                    <div className="text-[9px] text-muted-foreground/70 inline-flex items-center gap-0.5 justify-end leading-none">
                      <WhistleIcon className="h-2 w-2 flex-shrink-0" /> <span className="leading-none truncate max-w-[110px]" title={match.referee || undefined}>{firstRefereeName(match.referee)}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Encounter total for single_match */}
        {encounterTotal && encounterTotal.played > 0 && (
          <div className="px-2.5 py-0.5 bg-primary/5 border-b border-border flex items-center justify-between">
            <span className="text-[9px] font-bold text-primary/80">Totaal ({encounterTotal.played}/{encounterGroup!.length})</span>
            <span className="text-[11px] font-bold tabular-nums text-foreground">
              {encounterTotal.home} - {encounterTotal.away}
            </span>
          </div>
        )}

        <div>
          {renderTeamRow("home")}
          {renderTeamRow("away")}
        </div>
      </div>
    );
  };

  // --- Measure real bracket card height so vertical spacing/connectors always line up ---
  const bracketCardEls = useRef<Map<string, HTMLDivElement>>(new Map());
  const bracketCardObserver = useRef<ResizeObserver | null>(null);
  const [measuredCardH, setMeasuredCardH] = useState(0);

  const recomputeCardH = useCallback(() => {
    let max = 0;
    bracketCardEls.current.forEach((el, id) => {
      if (!el.isConnected) { bracketCardEls.current.delete(id); return; }
      max = Math.max(max, el.offsetHeight);
    });
    setMeasuredCardH(prev => (Math.abs(prev - max) > 0.5 ? max : prev));
  }, []);

  const setBracketCardRef = useCallback((id: string) => (el: HTMLDivElement | null) => {
    if (typeof ResizeObserver !== "undefined" && !bracketCardObserver.current) {
      bracketCardObserver.current = new ResizeObserver(() => recomputeCardH());
    }
    const prev = bracketCardEls.current.get(id);
    if (prev && prev !== el) {
      bracketCardObserver.current?.unobserve(prev);
      bracketCardEls.current.delete(id);
    }
    if (el) {
      bracketCardEls.current.set(id, el);
      bracketCardObserver.current?.observe(el);
    }
    recomputeCardH();
  }, [recomputeCardH]);

  useEffect(() => () => { bracketCardObserver.current?.disconnect(); bracketCardObserver.current = null; }, []);

  // Bracket tree with SVG connectors — FIXED: lines from exact center of match cards
  const renderBracketTree = (bracketRounds: typeof rounds, bracketPrefix?: string | null) => {
    if (bracketRounds.length === 0) return null;
    const CARD_W = 240;
    const CONNECTOR_W = 32;
    // Card height is measured from the real DOM (headers, dates, score inputs all change it),
    // so spacing stays correct whether cards are empty, filled with teams or with scores.
    const CARD_H = Math.max(measuredCardH, effectiveScoreEditable ? 104 : 90);
    const GAP = CONNECTOR_W;
    const HEADER_H = 36; // Header height (mb-3 + text)

    const isWinnerRef = (label: string | null) => (label ?? "").startsWith("Winnaar ");
    const isLoserRef = (label: string | null) => (label ?? "").startsWith("Verliezer ");

    const lastRound = bracketRounds[bracketRounds.length - 1];
    let inlinePlacementMatch: BracketMatch | null = null;
    let displayRounds = bracketRounds;

    if (bracketRounds.length === 2 && bracketRounds[0].matches.length === 2 && lastRound.matches.length === 2) {
      const winnerFinal = lastRound.matches.find(m => isWinnerRef(m.home_slot_label) || isWinnerRef(m.away_slot_label));
      const loserFinal = lastRound.matches.find(m => isLoserRef(m.home_slot_label) || isLoserRef(m.away_slot_label));
      if (winnerFinal && loserFinal && winnerFinal.id !== loserFinal.id) {
        inlinePlacementMatch = loserFinal;
        displayRounds = bracketRounds.map((r, idx) => idx === bracketRounds.length - 1 ? { ...r, matches: [winnerFinal] } : r);
      }
    }

    const firstRoundCount = displayRounds[0].matches.length;
    const totalHeight = firstRoundCount * CARD_H + (firstRoundCount - 1) * GAP;

    const placementTitle = "Finale";

    // === MOBILE COMPACT MODE ===
    if (isMobile) {
      return (
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-3">
            {displayRounds.map((round, roundIdx) => {
              const matchCount = round.matches.length;
              const roundHeight = matchCount * CARD_H + (matchCount - 1) * GAP;

              return (
                <div key={round.id} className="flex-shrink-0" style={{ width: CARD_W }}>
                  {/* Header */}
                  <div className="text-center mb-3 h-6 flex items-center justify-center">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground bg-secondary px-2 py-0.5 rounded">
                        {getRoundDisplayName(round, bracketPrefix)}
                      </span>
                  </div>
                  {/* Match cards — compact, no absolute positioning */}
                  <div className="flex flex-col" style={{ gap: GAP }}>
                    {round.matches.map((match) => (
                      <div key={match.id}>{renderMatchCard(match)}</div>
                    ))}
                  </div>

                  {/* Placement match below finale */}
                  {roundIdx === displayRounds.length - 1 && displayRounds.length >= 2 && (() => {
                    const currentPlacementRounds = getPlacementRoundsForBracket(displayRounds);
                    const placementMatchIds = new Set(currentPlacementRounds.flatMap((r) => r.matches.map((m) => m.id)));
                    const showInlinePlacement = inlinePlacementMatch && !placementMatchIds.has(inlinePlacementMatch.id);

                    return (
                      <div className="mt-6">
                        {showInlinePlacement && (
                          <div className="mb-2">
                            <div className="text-center mb-1.5">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground bg-secondary px-2 py-0.5 rounded inline-flex items-center gap-1">
                                {placementTitle}
                              </span>
                            </div>
                            {renderMatchCard(inlinePlacementMatch)}
                          </div>
                        )}
                        {currentPlacementRounds.filter((r) => r.matches.length > 0).map((pRound) => (
                          <div key={pRound.id}>
                            <div className="text-center mb-1.5">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground bg-secondary px-2 py-0.5 rounded inline-flex items-center gap-1">
                                {pRound.name}
                              </span>
                            </div>
                            {pRound.matches.map((m) => renderMatchCard(m))}
                          </div>
                        ))}
                        {editable && !currentPlacementRounds.some((r) => r.matches.length > 0) && !showInlinePlacement && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full"
                            onClick={() => addPlacementMatch(displayRounds, bracketPrefix || undefined)}
                          >
                            <Plus className="h-3 w-3" /> Wedstrijd
                          </Button>
                        )}
                      </div>
                    );
                  })()}
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    // === DESKTOP MODE (existing absolute positioning + SVG connectors) ===
    return (
      <div className="overflow-x-auto pb-4">
        <div className="flex" style={{ minHeight: totalHeight + 200 }}>
          {displayRounds.map((round, roundIdx) => {
            const matchCount = round.matches.length;
            const slotH = totalHeight / matchCount;
            const isFirstRound = roundIdx === 0;
            const getTop = (idx: number) => (isFirstRound ? idx * (CARD_H + GAP) : slotH * idx + (slotH - CARD_H) / 2);
            // FIXED: Center Y is exactly at the vertical middle of the card
            const getCenterY = (idx: number) => getTop(idx) + CARD_H / 2;

            // Next round for connector target
            const nextRound = roundIdx < displayRounds.length - 1 ? displayRounds[roundIdx + 1] : null;
            const nextMatchCount = nextRound ? nextRound.matches.length : 0;
            const nextSlotH = nextMatchCount > 0 ? totalHeight / nextMatchCount : 0;
            const getNextTop = (idx: number) => (roundIdx + 1 === 0 ? idx * (CARD_H + GAP) : nextSlotH * idx + (nextSlotH - CARD_H) / 2);
            const getNextCenterY = (idx: number) => getNextTop(idx) + CARD_H / 2;

            return (
              <div key={round.id} className="flex flex-shrink-0">
                <div className="flex flex-col flex-shrink-0" style={{ width: CARD_W }}>
                  {/* Header */}
                  <div className="text-center mb-3 h-6 flex items-center justify-center">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground bg-secondary px-2 py-0.5 rounded">
                        {getRoundDisplayName(round, bracketPrefix)}
                      </span>
                  </div>
                  {/* Match cards */}
                  <div className="relative" style={{ height: totalHeight }}>
                    {round.matches.map((match, matchIdx) => (
                      <div key={match.id} ref={setBracketCardRef(match.id)} className="absolute left-0 right-0" style={{ top: getTop(matchIdx) }}>
                        {renderMatchCard(match)}
                      </div>
                    ))}

                    {/* Placement match below finale */}
                    {roundIdx === displayRounds.length - 1 && displayRounds.length >= 2 && (() => {
                      const currentPlacementRounds = getPlacementRoundsForBracket(displayRounds);
                      const placementMatchIds = new Set(currentPlacementRounds.flatMap((r) => r.matches.map((m) => m.id)));
                      const showInlinePlacement = inlinePlacementMatch && !placementMatchIds.has(inlinePlacementMatch.id);
                      const hasPlacement = currentPlacementRounds.some((r) => r.matches.length > 0) || showInlinePlacement;

                      return (
                        <div className="absolute left-0 right-0" style={{ top: totalHeight / 2 + CARD_H / 2 + 48 }}>
                          {showInlinePlacement && (
                            <div className="mb-2">
                              <div className="text-center mb-1.5">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground bg-secondary px-2 py-0.5 rounded inline-flex items-center gap-1">
                                  {placementTitle}
                                </span>
                              </div>
                              {renderMatchCard(inlinePlacementMatch)}
                            </div>
                          )}
                          {currentPlacementRounds.filter((r) => r.matches.length > 0).map((pRound) => (
                            <div key={pRound.id}>
                              <div className="text-center mb-1.5">
                                <div className="flex items-center gap-1 justify-center">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground bg-secondary px-2 py-0.5 rounded">
                                      {pRound.name}
                                    </span>
                                    {editable && (
                                      <button onClick={() => setShowDeletePlacementConfirm(pRound.id)} className="text-muted-foreground hover:text-destructive">
                                        <Trash2 className="h-3 w-3" />
                                      </button>
                                    )}
                                  </div>
                              </div>
                              {pRound.matches.map((m) => renderMatchCard(m))}
                            </div>
                          ))}
                          {editable && !hasPlacement && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full"
                              onClick={() => addPlacementMatch(displayRounds, bracketPrefix || undefined)}
                            >
                              <Plus className="h-3 w-3" /> Wedstrijd
                            </Button>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                </div>
                {/* SVG connectors — FIXED: lines from center to center of actual card positions */}
                {roundIdx < displayRounds.length - 1 && matchCount >= 2 && (
                  <svg className="flex-shrink-0" width={CONNECTOR_W} style={{ marginTop: HEADER_H, height: totalHeight }} xmlns="http://www.w3.org/2000/svg">
                    {round.matches.map((_, matchIdx) => {
                      if (matchIdx % 2 !== 0) return null;
                      const y1 = getCenterY(matchIdx);
                      const y2 = getCenterY(matchIdx + 1);
                      const nextIdx = Math.floor(matchIdx / 2);
                      const yTarget = getNextCenterY(nextIdx);
                      const midX = CONNECTOR_W / 2;
                      return (
                        <g key={matchIdx}>
                          {/* From top match center-right to midpoint */}
                          <line x1={0} y1={y1} x2={midX} y2={y1} className="stroke-border" strokeWidth={1.5} />
                          {/* From bottom match center-right to midpoint */}
                          <line x1={0} y1={y2} x2={midX} y2={y2} className="stroke-border" strokeWidth={1.5} />
                          {/* Vertical line connecting the two */}
                          <line x1={midX} y1={y1} x2={midX} y2={y2} className="stroke-border" strokeWidth={1.5} />
                          {/* From midpoint to next match center-left */}
                          <line x1={midX} y1={yTarget} x2={CONNECTOR_W} y2={yTarget} className="stroke-border" strokeWidth={1.5} />
                        </g>
                      );
                    })}
                  </svg>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const hasRenderableContent = rounds.length > 0 || sortedLoserKeys.length > 0;

  const selectedMatch = selectedMatchId ? matches.find(m => m.id === selectedMatchId) : null;

  return (
    <div className="space-y-6">
      {editable && rounds.length > 0 && (
        <div className="flex items-center gap-2">
          {showRandomAssign && !isSingleMatch && filteredTeams.length > 0 && (
            <Button variant="outline" size="sm" onClick={() => {
              const hasTeams = r1Matches.some(m => m.home_team_id || m.away_team_id);
              if (hasTeams) { setShowRandomConfirm(true); } else { randomAssignRound1(); }
            }}>
              <Shuffle className="h-3 w-3" /> Willekeurige indeling
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => setShowClearConfirm(true)}>
            <Trash2 className="h-3 w-3" /> Alles leeg maken
          </Button>
        </div>
      )}

      {!loaded && (
        <div className="flex justify-center py-8">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      )}

      {loaded && !hasRenderableContent && (
        <div className="rounded-lg border border-dashed border-border py-8 text-center">
          <p className="text-sm text-muted-foreground">Nog geen bracket wedstrijden voor deze selectie.</p>
        </div>
      )}

      {/* Single match: simple vertical list with editable title */}
      {isSingleMatch && rounds.length > 0 && (
        <div className="pb-4" style={{ overflow: "visible" }}>
          {editable && (
            <div className="flex items-center gap-2 mb-4">
              {editingBracketName === "single_match_title" ? null : (
                <h3 className="text-sm font-bold text-foreground cursor-pointer hover:text-primary flex items-center gap-1"
                  onClick={() => { setEditingBracketName("single_match_title"); setBracketNameEdit(currentPhase?.name || "Plaatsingswedstrijd"); editingBracketRoundsRef.current = rounds; }}>
                  {currentPhase?.name || "Plaatsingswedstrijd"}
                  <Pencil className="h-3 w-3 text-muted-foreground" />
                </h3>
              )}
            </div>
          )}
          {!editable && (
            <h3 className="text-sm font-bold text-foreground mb-4">{currentPhase?.name || "Plaatsingswedstrijd"}</h3>
          )}
          <div className="flex flex-col pb-72" style={{ gap: 16, overflow: "visible" }}>
            {rounds.flatMap(r => r.matches).map(match => (
              <div key={match.id} className="relative" style={{ width: 240, overflow: "visible" }}>{renderMatchCard(match)}</div>
            ))}
            {editable && (
              <Button variant="outline" size="sm" className="w-[240px]" onClick={addSingleMatch}>
                <Plus className="h-3.5 w-3.5" /> Losse wedstrijd
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Regular knockout bracket */}
      {!isSingleMatch && editable && rounds.length > 0 && (
        <div className="flex items-center gap-2 mb-2">
          {editingBracketName === "main" ? null : (
            <h3 className="text-sm font-bold text-foreground cursor-pointer hover:text-primary flex items-center gap-1"
              onClick={() => { setEditingBracketName("main"); setBracketNameEdit(getSubBracketName("main")); editingBracketRoundsRef.current = rounds; }}>
              {getBracketName("main")}
              <Pencil className="h-3 w-3 text-muted-foreground" />
            </h3>
          )}
        </div>
      )}
      {!isSingleMatch && rounds.length > 0 && renderBracketTree(rounds, null)}

      {/* Loser brackets with inline children */}
      {(() => {
        const shouldShowSeparator = (childPrefix: string, parentPrefix: string): boolean => {
          const [parentFromStr, parentToStr] = parentPrefix.split("-");
          const parentStart = parseInt(parentFromStr);
          const parentSize = parseInt(parentToStr) - parentStart + 1;
          const childStart = parseInt(childPrefix.split("-")[0]);
          return (childStart - parentStart) >= parentSize / 2;
        };

        const renderBracketWithChildren = (p: string, isChild: boolean, parentPrefix?: string): React.ReactNode => {
          const showSep = !isChild || (parentPrefix ? shouldShowSeparator(p, parentPrefix) : false);
          const displayName = getBracketName(p);
          return (
            <div key={p}>
              <div className="border-t border-border my-6" />
              <div className="flex items-center justify-between mb-2">
                <h3 className={`text-sm font-bold text-foreground flex items-center gap-1 ${editable ? "cursor-pointer hover:text-primary" : ""}`}
                    onClick={() => { if (editable) { setEditingBracketName(p); setBracketNameEdit(getSubBracketName(p)); editingBracketRoundsRef.current = loserBrackets[p]; } }}>
                    {displayName}
                    {editable && <Pencil className="h-3 w-3 text-muted-foreground" />}
                  </h3>
                {editable && (
                  <Button variant="ghost" size="sm" onClick={() => setShowDeleteBracketConfirm(p)} className="text-muted-foreground hover:text-destructive h-7 px-2">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
              {renderBracketTree(loserBrackets[p], p)}
              {(loserBracketChildren[p] || []).map(childPrefix => renderBracketWithChildren(childPrefix, true, p))}
              {editable && getAvailableSubBrackets(p).length > 0 && (
                <div className="flex flex-wrap gap-2 pt-2">
                  {getAvailableSubBrackets(p).map(b => (
                    <Button key={b.prefix} variant="outline" size="sm" onClick={() => addLoserBracket(b.sourceRound, b.posFrom, b.posTo)}>
                      <Plus className="h-3 w-3" /> Bracket {b.prefix}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          );
        };
        return topLevelLoserKeys.map(prefix => renderBracketWithChildren(prefix, false));
      })()}

      {/* Add bracket buttons for main bracket */}
      {editable && availableLoserBrackets.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-2">
          {availableLoserBrackets.map(b => (
            <Button key={b.prefix} variant="outline" size="sm" onClick={() => addLoserBracket(b.sourceRound, b.posFrom, b.posTo)}>
              <Plus className="h-3 w-3" /> Bracket {b.prefix}
            </Button>
          ))}
        </div>
      )}

      {/* H&A Detail Dialog */}
      {tournament && (() => {
        const heenM = selectedHAMatchId ? matches.find(m => m.id === selectedHAMatchId) : null;
        if (!heenM) return null;
        const terugM = matches.find(m => m.match_name === `${getBaseMatchName(heenM.match_name)} (Terug)` && m.group_id === heenM.group_id);
        if (!terugM) return null;
        const homeTotal = (heenM.home_score ?? 0) + (terugM.away_score ?? 0);
        const awayTotal = (heenM.away_score ?? 0) + (terugM.home_score ?? 0);
        const bothPlayed = heenM.is_played && terugM.is_played;
        const isTied = homeTotal === awayTotal && bothPlayed;
        const hasPenalties = isTied && (heenM.home_penalties != null || heenM.away_penalties != null || terugM.home_penalties != null || terugM.away_penalties != null);
        // Penalties live on the Terug match, whose orientation is swapped vs Heen:
        // terug.home = heen.away. Map them back to the Heen orientation shown here.
        const homePen = (terugM.away_penalties ?? heenM.home_penalties ?? 0);
        const awayPen = (terugM.home_penalties ?? heenM.away_penalties ?? 0);
        const homeWon = bothPlayed && (homeTotal > awayTotal || (isTied && homePen > awayPen));
        const awayWon = bothPlayed && (awayTotal > homeTotal || (isTied && awayPen > homePen));

        const homeName = heenM.home_team_id ? (teams.find(t => t.id === heenM.home_team_id)?.name ?? "TBD") : "TBD";
        const awayName = heenM.away_team_id ? (teams.find(t => t.id === heenM.away_team_id)?.name ?? "TBD") : "TBD";
        const homeLogo = teams.find(t => t.id === heenM.home_team_id)?.logo_url;
        const awayLogo = teams.find(t => t.id === heenM.away_team_id)?.logo_url;

        const renderLegRow = (hName: string, hLogo: string | undefined, aName: string, aLogo: string | undefined, hScore: number | null, aScore: number | null) => (
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            <div className={`flex items-center gap-1.5 px-3 py-1.5 ${(hScore ?? 0) > (aScore ?? 0) ? "bg-primary/5" : ""}`}>
              {hLogo ? <img src={hLogo} className="h-5 w-5 object-contain flex-shrink-0" alt="" /> : <div className="h-5 w-5 bg-secondary rounded text-[8px] flex items-center justify-center font-bold text-muted-foreground">{hName.charAt(0)}</div>}
              <span className={`flex-1 truncate text-xs ${(hScore ?? 0) > (aScore ?? 0) ? "font-bold text-foreground" : "text-muted-foreground"}`}>{hName}</span>
              <span className={`text-sm tabular-nums ${(hScore ?? 0) > (aScore ?? 0) ? "font-bold text-foreground" : "text-muted-foreground"}`}>{hScore ?? "–"}</span>
            </div>
            <div className={`flex items-center gap-1.5 px-3 py-1.5 border-t border-border ${(aScore ?? 0) > (hScore ?? 0) ? "bg-primary/5" : ""}`}>
              {aLogo ? <img src={aLogo} className="h-5 w-5 object-contain flex-shrink-0" alt="" /> : <div className="h-5 w-5 bg-secondary rounded text-[8px] flex items-center justify-center font-bold text-muted-foreground">{aName.charAt(0)}</div>}
              <span className={`flex-1 truncate text-xs ${(aScore ?? 0) > (hScore ?? 0) ? "font-bold text-foreground" : "text-muted-foreground"}`}>{aName}</span>
              <span className={`text-sm tabular-nums ${(aScore ?? 0) > (hScore ?? 0) ? "font-bold text-foreground" : "text-muted-foreground"}`}>{aScore ?? "–"}</span>
            </div>
          </div>
        );

        return (
          <Dialog open={!!selectedHAMatchId} onOpenChange={() => setSelectedHAMatchId(null)}>
            <DialogContent className="max-w-xs p-0 gap-0 overflow-hidden">
              <DialogHeader className="sr-only"><DialogTitle>Wedstrijddetail</DialogTitle></DialogHeader>
              {/* Header: Teams side-by-side with aggregate score */}
              <div className="bg-card px-4 pt-5 pb-3">
                <div className="flex items-center justify-center gap-4">
                  <div className="flex flex-col items-center gap-1.5 min-w-0 flex-1">
                    {homeLogo ? <img src={homeLogo} className="h-10 w-10 object-contain" alt="" /> : <div className="h-10 w-10 bg-secondary rounded-lg flex items-center justify-center text-lg font-black text-muted-foreground">{homeName.charAt(0)}</div>}
                    <span className={`text-xs text-center truncate w-full ${homeWon ? "font-bold" : ""} text-foreground`}>{homeName}</span>
                  </div>
                  <div className="flex flex-col items-center shrink-0">
                    <span className="text-2xl font-black tabular-nums tracking-tight text-foreground">
                      {homeTotal}–{awayTotal}
                    </span>
                    {hasPenalties && (
                      <span className="text-[10px] text-muted-foreground font-medium mt-0.5">
                        ({homePen} – {awayPen} pen.)
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col items-center gap-1.5 min-w-0 flex-1">
                    {awayLogo ? <img src={awayLogo} className="h-10 w-10 object-contain" alt="" /> : <div className="h-10 w-10 bg-secondary rounded-lg flex items-center justify-center text-lg font-black text-muted-foreground">{awayName.charAt(0)}</div>}
                    <span className={`text-xs text-center truncate w-full ${awayWon ? "font-bold" : ""} text-foreground`}>{awayName}</span>
                  </div>
                </div>
              </div>
              {/* Leg 1 (Heen) */}
              <div className="px-4 py-2 border-t border-border">
                <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Wedstrijd 1 (Heen)</div>
                {renderLegRow(homeName, homeLogo, awayName, awayLogo, heenM.home_score, heenM.away_score)}
              </div>
              {/* Leg 2 (Terug) - home/away swapped */}
              <div className="px-4 pt-2 pb-4 border-t border-border">
                <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Wedstrijd 2 (Terug)</div>
                {renderLegRow(awayName, awayLogo, homeName, homeLogo, terugM.home_score, terugM.away_score)}
              </div>
            </DialogContent>
          </Dialog>
        );
      })()}

      {/* Match Detail Popup (single leg) */}
      {tournament && (() => {
        const sm = selectedMatch;
        const matchGroup = sm ? groups.find(g => g.id === sm.group_id) : null;
        return (
          <MatchDetailDialog
            open={!!sm}
            onClose={() => setSelectedMatchId(null)}
            match={sm ? {
              id: sm.id,
              match_name: sm.match_name,
              home_team_id: sm.home_team_id,
              away_team_id: sm.away_team_id,
              home_score: sm.home_score,
              away_score: sm.away_score,
              home_penalties: sm.home_penalties,
              away_penalties: sm.away_penalties,
              match_date: sm.match_date,
              match_time: sm.match_time,
              field: sm.field,
              referee: sm.referee,
              is_played: sm.is_played,
              format_name: currentPhase?.name || null,
              group_name: matchGroup?.name || null,
              round_number: sm.round_number,
            } : null}
            tournament={tournament}
            teams={teams}
            scoreEditable={effectiveScoreEditable}
          />
        );
      })()}
      <AlertDialog open={showClearConfirm} onOpenChange={setShowClearConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Alles leeg maken?</AlertDialogTitle>
            <AlertDialogDescription>
              Weet je zeker dat je deze bracket volledig wilt resetten? Alle teamtoewijzingen, scores, doorstroming en statistieken worden verwijderd. De wedstrijden zelf blijven bestaan maar worden volledig leeggemaakt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setShowClearConfirm(false); clearAllR1Slots(); }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Leeg maken
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {/* Random reassign confirmation */}
      <AlertDialog open={showRandomConfirm} onOpenChange={setShowRandomConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Opnieuw indelen?</AlertDialogTitle>
            <AlertDialogDescription>
              Er zijn al teams ingedeeld. Wil je alle huidige toewijzingen wissen en opnieuw willekeurig indelen?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setShowRandomConfirm(false); clearAllR1Slots().then(() => randomAssignRound1()); }}>
              Opnieuw indelen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete single match confirmation */}
      <AlertDialog open={!!showDeleteSingleConfirm} onOpenChange={(open) => { if (!open) setShowDeleteSingleConfirm(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Wedstrijd verwijderen?</AlertDialogTitle>
            <AlertDialogDescription>
              Weet je zeker dat je deze wedstrijd wilt verwijderen? Dit kan niet ongedaan worden gemaakt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (showDeleteSingleConfirm) { deleteSingleMatch(showDeleteSingleConfirm); setShowDeleteSingleConfirm(null); } }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Verwijderen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete bracket confirmation */}
      <AlertDialog open={!!showDeleteBracketConfirm} onOpenChange={(open) => { if (!open) setShowDeleteBracketConfirm(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Bracket verwijderen?</AlertDialogTitle>
            <AlertDialogDescription>
              Weet je zeker dat je deze bracket en alle bijbehorende wedstrijden wilt verwijderen? Dit kan niet ongedaan worden gemaakt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (showDeleteBracketConfirm) { removeLoserBracket(showDeleteBracketConfirm); setShowDeleteBracketConfirm(null); } }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Verwijderen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete placement match confirmation */}
      <AlertDialog open={!!showDeletePlacementConfirm} onOpenChange={(open) => { if (!open) setShowDeletePlacementConfirm(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Wedstrijd verwijderen?</AlertDialogTitle>
            <AlertDialogDescription>
              Weet je zeker dat je deze plaatsingswedstrijd wilt verwijderen? Dit kan niet ongedaan worden gemaakt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (showDeletePlacementConfirm) { removePlacementRound(showDeletePlacementConfirm); setShowDeletePlacementConfirm(null); } }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Verwijderen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!matchSettingsOpen} onOpenChange={(open) => { if (!open) setMatchSettingsOpen(null); }}>
        <DialogContent ref={matchSettingsDialogRef} className="sm:max-w-md" onClick={e => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>Wedstrijd instellingen</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Wedstrijdnaam</Label>
              <Input
                value={matchSettingsName}
                onChange={(e) => { setMatchSettingsName(e.target.value); setMatchNameError(null); }}
                className={matchNameError ? "border-destructive" : ""}
              />
              {matchNameError && <p className="text-xs text-destructive">{matchNameError}</p>}
            </div>
            {isKnockout && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Wedstrijdformat</Label>
                <div className="space-y-2">
                  {[
                    { value: "single_leg" as const, label: "ENKELE WEDSTRIJD", desc: "Er wordt één beslissende wedstrijd gespeeld" },
                    { value: "home_away" as const, label: "HEEN EN TERUG", desc: "Er worden twee wedstrijden gespeeld: één thuis en één uit" },
                  ].map(opt => (
                    <label key={opt.value} className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${matchSettingsMatchType === opt.value ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"}`}>
                      <input
                        type="radio"
                        name="matchSettingsType"
                        checked={matchSettingsMatchType === opt.value}
                        onChange={() => setMatchSettingsMatchType(opt.value)}
                        className="mt-0.5"
                      />
                      <div>
                        <div className="text-xs font-bold">{opt.label}</div>
                        <div className="text-[10px] text-muted-foreground">{opt.desc}</div>
                      </div>
                    </label>
                  ))}
                </div>
                {matchSettingsMatchType === "home_away" && matchSettingsOpen && !isMatchHomeAway(matches.find(m => m.id === matchSettingsOpen)!) && (
                   <p className="text-xs text-destructive font-medium">
                    Er wordt een terugwedstrijd aangemaakt voor deze wedstrijd.
                   </p>
                )}
                {matchSettingsMatchType === "single_leg" && matchSettingsOpen && isMatchHomeAway(matches.find(m => m.id === matchSettingsOpen)!) && (
                   <p className="text-xs text-destructive font-medium">
                    De terugwedstrijd wordt verwijderd.
                   </p>
                )}
              </div>
            )}
            {isSingleMatch && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Wedstrijdformat</Label>
                <div className="space-y-2">
                  {[
                    { value: "single_leg" as const, label: "ENKELE WEDSTRIJD", desc: "Eén beslissende wedstrijd" },
                    { value: "home_away" as const, label: "HEEN EN TERUG", desc: "Heen- en terugwedstrijd" },
                  ].map(opt => (
                    <label key={opt.value} className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${matchSettingsMatchType === opt.value ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"}`}>
                      <input
                        type="radio"
                        name="matchSettingsSMType"
                        checked={matchSettingsMatchType === opt.value}
                        onChange={() => setMatchSettingsMatchType(opt.value)}
                        className="mt-0.5"
                      />
                      <div>
                        <div className="text-xs font-bold">{opt.label}</div>
                        <div className="text-[10px] text-muted-foreground">{opt.desc}</div>
                      </div>
                    </label>
                  ))}
                </div>
                {matchSettingsMatchType === "home_away" && matchSettingsOpen && !isMatchHomeAway(matches.find(m => m.id === matchSettingsOpen)!) && (
                  <p className="text-xs text-destructive font-medium">
                    Er wordt een terugwedstrijd aangemaakt voor deze wedstrijd.
                  </p>
                )}
                {matchSettingsMatchType === "single_leg" && matchSettingsOpen && isMatchHomeAway(matches.find(m => m.id === matchSettingsOpen)!) && (
                  <p className="text-xs text-destructive font-medium">
                    De terugwedstrijd wordt verwijderd.
                  </p>
                )}
              </div>
            )}
          </div>
          <div className="pt-2 border-t border-border">
            <ScoringSystemSelector
              systems={scoringSystems}
              value={matchSettingsScoringSystemId}
              onChange={setMatchSettingsScoringSystemId}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMatchSettingsOpen(null)}>Annuleren</Button>
            <Button onClick={saveMatchSettings}>Opslaan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bracket name edit dialog */}
      <Dialog open={!!editingBracketName} onOpenChange={(open) => { if (!open) setEditingBracketName(null); }}>
        <DialogContent ref={bracketNameDialogRef} className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Naam bewerken</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label className="text-sm font-medium">Naam</Label>
            <Input value={bracketNameEdit} onChange={e => setBracketNameEdit(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") { const key = editingBracketName === "single_match_title" ? "main" : editingBracketName!; saveBracketName(key, editingBracketRoundsRef.current); } }} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingBracketName(null)}>Annuleren</Button>
            <Button onClick={() => { const key = editingBracketName === "single_match_title" ? "main" : editingBracketName!; saveBracketName(key, editingBracketRoundsRef.current); }}>Opslaan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Round name edit dialog */}
      <Dialog open={!!editingRoundName} onOpenChange={(open) => { if (!open) setEditingRoundName(null); }}>
        <DialogContent ref={roundNameDialogRef} className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Rondenaam bewerken</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">{roundNameBase}</div>
            <Label className="text-sm font-medium">Toevoeging (optioneel)</Label>
            <Input value={roundNameEdit} onChange={e => setRoundNameEdit(e.target.value)}
              placeholder="bv. om de eer"
              onKeyDown={e => { if (e.key === "Enter" && editingRoundName) saveRoundName(editingRoundName); }} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingRoundName(null)}>Annuleren</Button>
            <Button onClick={() => { if (editingRoundName) saveRoundName(editingRoundName); }}>Opslaan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BracketView;
