import { useState, useEffect, useMemo } from "react";
import { formatFieldLabel } from "@/lib/fieldLocations";
import { getPhaseLabel } from "@/lib/phaseLabel";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { fetchTournamentMatches } from "@/lib/fetchTournamentMatches";
import { useToast } from "@/hooks/use-toast";
import { useDialogFocus } from "@/hooks/useDialogFocus";
import { CheckCircle2, RotateCcw, BarChart3, ChevronDown, ChevronRight, ChevronUp, Plus, Minus, MapPin, ListOrdered, Users } from "lucide-react";
import rankingPodium from "@/assets/ranking-podium.png";
import WhistleIcon from "@/components/icons/WhistleIcon";
import MatchDetailDialog from "./MatchDetailDialog";
import ScoreEntryDialog from "./ScoreEntryDialog";
import CountryFlag from "@/components/CountryFlag";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import BracketView from "./BracketView";
import { calculateGroupStandings, type ScoringSystem } from "@/lib/standingsCalculator";
import { getMatchSideDisplayName } from "@/lib/slotLabels";
import { getMatchFormatSuffix } from "@/lib/matchFormatLabel";
import { isSetsGroup, computeSetPointTotals, formatSigned, resolveStandingsColumns } from "@/lib/standingsDisplay";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Match {
  id: string;
  home_team_id: string | null;
  away_team_id: string | null;
  home_score: number | null;
  away_score: number | null;
  home_penalties: number | null;
  away_penalties: number | null;
  match_date: string | null;
  match_time: string | null;
  field: string | null;
  referee: string | null;
  is_played: boolean;
  phase_id: string;
  group_id: string | null;
  round_number: number | null;
  home_slot_label: string | null;
  away_slot_label: string | null;
  match_name: string | null;
  scoring_system_id?: string | null;
  set_scores?: { home: number | null; away: number | null }[] | null;
}

interface Team { id: string; name: string; logo_url: string | null; country: string | null; }
interface Phase { id: string; name: string; phase_number: number; phase_type: string; emoji?: string | null; logo_url?: string | null; sort_order: number; match_config?: Record<string, any> | null; scoring_system_id?: string | null; }
interface Group { id: string; name: string; phase_id: string; scoring_system_id?: string | null; }
interface GroupTeamEntry { group_id: string; team_id: string; bonus_points: number; fairplay_points?: number; manual_position?: number | null; }
interface StandingColor { id: string; position_from: number; position_to: number; color: string; label: string | null; phase_id: string | null; }
interface SlotEntry { id: string; slot_code: string; team_id: string | null; group_id: string | null; phase_id: string; sort_order: number; ref_phase_id: string | null; ref_group_id: string | null; ref_position: number | null; }

const formatDateDMY = (d: string | null) => {
  if (!d) return null;
  const parts = d.split("-");
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return d;
};

const phaseStorageKey = (tournamentId: string, categoryId: string | null) =>
  `results-phase:${tournamentId}:${categoryId || "all"}`;

const ResultsManager = ({ tournamentId, tournament, categoryId }: { tournamentId: string; tournament: any; categoryId?: string | null }) => {
  const [matches, setMatches] = useState<Match[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [phases, setPhases] = useState<Phase[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [groupTeams, setGroupTeams] = useState<GroupTeamEntry[]>([]);
  const [standingColors, setStandingColors] = useState<StandingColor[]>([]);
  const [slots, setSlots] = useState<SlotEntry[]>([]);
  const [scoringSystems, setScoringSystems] = useState<ScoringSystem[]>([]);
  const [categoryFieldNames, setCategoryFieldNames] = useState<string[]>([]);
  const [selectedPhaseNumber, setSelectedPhaseNumberState] = useState<number | null>(() => {
    const stored = localStorage.getItem(phaseStorageKey(tournamentId, categoryId ?? null));
    return stored ? parseInt(stored) : null;
  });
  const [loading, setLoading] = useState(true);
  const [editingMatchId, setEditingMatchId] = useState<string | null>(null);
  const [phaseActionDialog, setPhaseActionDialog] = useState<"format-complete" | "format-undo" | "format-incomplete" | null>(null);
  const [lotsDialogGroupId, setLotsDialogGroupId] = useState<string | null>(null);
  const [confirmedLotsGroups, setConfirmedLotsGroups] = useState<Set<string>>(new Set());
  const [selectedFormatActionId, setSelectedFormatActionId] = useState<string | null>(null);
  const [selectedStatsMatchId, setSelectedStatsMatchId] = useState<string | null>(null);
  const [expandedFormats, setExpandedFormats] = useState<Set<string>>(new Set());
  const [standingsDialogGroupId, setStandingsDialogGroupId] = useState<string | null>(null);
  const [bracketDialogFormatId, setBracketDialogFormatId] = useState<string | null>(null);
  const [scoreEntryMatchId, setScoreEntryMatchId] = useState<string | null>(null);
  const [resultsRefreshKey, setResultsRefreshKey] = useState(0);
  const [collapsedTimeSlots, setCollapsedTimeSlots] = useState<Set<string>>(new Set());
  const [manuallyOpenedTimeSlots, setManuallyOpenedTimeSlots] = useState<Set<string>>(new Set());
  // Teams wijzigen aan een wedstrijd (draft-state: pas opslaan bij "Opslaan")
  const [assigningMatchId, setAssigningMatchId] = useState<string | null>(null);
  const [assignDraft, setAssignDraft] = useState<{ homeTeamId: string; awayTeamId: string }>({ homeTeamId: "", awayTeamId: "" });
  const [savingAssign, setSavingAssign] = useState(false);
  const assignMatchDialogRef = useDialogFocus(!!assigningMatchId);
  const { toast } = useToast();


  const hasAnyStats = tournament?.enable_goalscorers || tournament?.enable_assists || tournament?.enable_yellow_cards || tournament?.enable_red_cards;

  const setSelectedPhaseNumber = (pn: number) => {
    setSelectedPhaseNumberState(pn);
    localStorage.setItem(phaseStorageKey(tournamentId, categoryId ?? null), String(pn));
  };

  const toggleFormat = (id: string) => {
    setExpandedFormats(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleTimeSlot = (key: string) => {
    setCollapsedTimeSlots(prev => {
      const next = new Set(prev);
      const isCollapsed = next.has(key);
      isCollapsed ? next.delete(key) : next.add(key);
      setManuallyOpenedTimeSlots(openedPrev => {
        const openedNext = new Set(openedPrev);
        isCollapsed ? openedNext.add(key) : openedNext.delete(key);
        return openedNext;
      });
      return next;
    });
  };

  const requestCompleteFormat = (format: Phase, options?: { confirmIncomplete?: boolean }) => {
    if (!canEditFormat(format)) {
      toast({ title: "Niet bewerkbaar", description: "Dit format kan nu niet voltooid worden.", variant: "destructive" });
      return;
    }
    setSelectedFormatActionId(format.id);
    setExpandedFormats(new Set());
    setConfirmedLotsGroups(new Set());
    const formatMatches = matches.filter(match => match.phase_id === format.id);
    const hasUnplayedMatches = formatMatches.some(match => !match.is_played);
    setPhaseActionDialog(options?.confirmIncomplete && hasUnplayedMatches ? "format-incomplete" : "format-complete");
  };

  const requestUndoFormat = (format: Phase) => {
    setSelectedFormatActionId(format.id);
    setPhaseActionDialog("format-undo");
  };

  useEffect(() => { fetchData(); }, [tournamentId, categoryId]);

  const fetchData = async () => {
    let phaseQuery = supabase.from("tournament_phases").select("id, name, phase_number, phase_type, emoji, logo_url, sort_order, match_config, scoring_system_id").eq("tournament_id", tournamentId).order("phase_number").order("sort_order");
    if (categoryId) phaseQuery = phaseQuery.eq("category_id", categoryId);
    const [mRes, tRes, pRes, gRes, gtRes, scRes, slRes, ssRes, catRes] = await Promise.all([
      fetchTournamentMatches({
        tournamentId,
        orders: [
          { column: "round_number" },
          { column: "match_time" },
        ],
        maxRows: 5000,
      }),
      supabase.from("teams").select("id, name, logo_url, country").eq("tournament_id", tournamentId),
      phaseQuery,
      supabase.from("groups").select("*").eq("tournament_id", tournamentId).order("created_at"),
      supabase.from("group_teams").select("*").eq("tournament_id", tournamentId),
      supabase.from("standing_colors").select("*").eq("tournament_id", tournamentId),
      supabase.from("slots").select("*").eq("tournament_id", tournamentId).order("sort_order"),
      supabase.from("tournament_scoring_systems" as any).select("id, scoring_type, num_sets, set_points_mode, set_result_points, decisive_set, playoff_mode, no_draws, points_win, points_draw, points_loss, points_big_win, big_win_threshold, points_win_overtime, points_draw_with_goals, points_draw_no_goals, points_loss_overtime, tiebreaker_rules").eq("tournament_id", tournamentId),
      categoryId
        ? supabase.from("tournament_categories").select("fields, referees").eq("tournament_id", tournamentId).eq("id", categoryId).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);
    setMatches(mRes as any);
    if (tRes.data) setTeams(tRes.data);
    if (catRes?.data?.fields && Array.isArray(catRes.data.fields)) {
      setCategoryFieldNames(
        catRes.data.fields
          .map((field: any) => (typeof field === "string" ? field : field?.name || ""))
          .filter(Boolean),
      );
    } else {
      setCategoryFieldNames([]);
    }

    if (pRes.data) {
      setPhases(pRes.data as any);
      // Auto-select first phase if nothing persisted
      if (pRes.data.length > 0) {
        const stored = localStorage.getItem(phaseStorageKey(tournamentId, categoryId ?? null));
        const storedNum = stored ? parseInt(stored) : null;
        const validPhaseNums = [...new Set((pRes.data as any[]).map((p: any) => p.phase_number))];
        if (storedNum !== null && validPhaseNums.includes(storedNum)) {
          setSelectedPhaseNumberState(storedNum);
        } else {
          setSelectedPhaseNumberState((pRes.data as any[])[0].phase_number);
        }
      }
    }
    if (gRes.data) setGroups(gRes.data);
    if (gtRes.data) setGroupTeams(gtRes.data);
    if (scRes.data) setStandingColors(scRes.data);
    if (slRes.data) setSlots(slRes.data as any);
    if (ssRes.data) setScoringSystems(ssRes.data as any);
    setLoading(false);
  };

  const clearDownstreamTeams = async (matchName: string, currentMatches: Match[], scopePhaseId?: string | null): Promise<Match[]> => {
    const winnerLabel = `Winnaar ${matchName}`;
    const loserLabel = `Verliezer ${matchName}`;
    let updated = [...currentMatches];

    for (let i = 0; i < updated.length; i++) {
      const m = updated[i];
      // Scope to the same format (phase_id) to avoid cross-format propagation
      // when multiple formats share match names like "Kwartfinale - 1".
      if (scopePhaseId && m.phase_id !== scopePhaseId) continue;
      const mUpdates: any = {};
      if (m.home_slot_label === winnerLabel) mUpdates.home_team_id = null;
      if (m.away_slot_label === winnerLabel) mUpdates.away_team_id = null;
      if (m.home_slot_label === loserLabel) mUpdates.home_team_id = null;
      if (m.away_slot_label === loserLabel) mUpdates.away_team_id = null;

      if (Object.keys(mUpdates).length > 0) {
        const alsoReset: any = {};
        if (m.is_played) {
          alsoReset.home_score = null;
          alsoReset.away_score = null;
          alsoReset.home_penalties = null;
          alsoReset.away_penalties = null;
          alsoReset.set_scores = null;
          alsoReset.is_played = false;
          // Wis ook alle bijhorende statistieken
          await supabase.from("match_stats").delete().eq("match_id", m.id);
        }
        await supabase.from("matches").update({ ...mUpdates, ...alsoReset }).eq("id", m.id);
        updated[i] = { ...m, ...mUpdates, ...alsoReset };

        if (m.match_name && m.is_played) {
          updated = await clearDownstreamTeams(m.match_name, updated, scopePhaseId ?? m.phase_id);
        }
      }
    }
    return updated;
  };

  /** Kan deze wedstrijd een beslissende score hebben (ongeacht huidige stand)? */
  const matchAllowsDecider = (match: Match): boolean => {
    const phase = phases.find(p => p.id === match.phase_id);
    const isKnockout = phase?.phase_type === "knockout" || phase?.phase_type === "single_match";
    if (isKnockout) return true;
    let sysId = match.scoring_system_id;
    if (!sysId && match.group_id) {
      const g = groups.find(x => x.id === match.group_id);
      sysId = g?.scoring_system_id ?? null;
    }
    if (!sysId) {
      sysId = phase?.scoring_system_id ?? null;
    }
    const sys = sysId
      ? scoringSystems.find(s => s.id === sysId)
      : scoringSystems[0];
    return !!sys?.no_draws;
  };

  const resolveMatchNeedsDecider = (match: Match, baseList?: Match[]): boolean => {
    const list = baseList ?? matches;
    if (!matchAllowsDecider(match)) return false;

    // Wedstrijden over meerdere ontmoetingen (Heen/Terug): geen beslissende score
    // per leg — enkel op de Heen-wedstrijd wanneer alle legs gespeeld zijn én de
    // totaalscore gelijk is.
    const ha = match.match_name?.match(/^(.+)\s+\((Heen|Terug)\)$/);
    if (ha) {
      if (ha[2] !== "Terug") return false; // beslissing leeft op de Terug-wedstrijd
      const heen = list.find(m => m.match_name === `${ha[1]} (Heen)` && m.group_id === match.group_id);
      if (!heen) return false;
      if (match.home_score === null || match.away_score === null) return false;
      if (heen.home_score === null || heen.away_score === null) return false;
      // Aggregaat in Terug-oriëntatie: Heen home/away zijn omgewisseld
      const aggHome = match.home_score + heen.away_score;
      const aggAway = match.away_score + heen.home_score;
      return aggHome === aggAway;
    }

    // Meerdere ontmoetingen met identieke naam (zonder Heen/Terug-suffix):
    // enkel de eerste wedstrijd draagt de beslissing, en pas als alles gespeeld
    // is en het totaal gelijk is.
    if (match.match_name) {
      // Volgorde van ontmoetingen volgt het schema (datum/tijd), niet de aanmaak.
      const scheduleKey = (m: Match) => {
        const scheduled = !!(m.match_date && m.match_time && m.field);
        return `${scheduled ? "0" : "1"}|${m.match_date || "9999-12-31"}|${m.match_time || "99:99"}|${String(m.round_number ?? 0).padStart(4, "0")}|${m.id}`;
      };
      const siblings = list
        .filter(m => m.phase_id === match.phase_id && m.match_name === match.match_name)
        .sort((a, b) => scheduleKey(a).localeCompare(scheduleKey(b)));
      if (siblings.length > 1) {
        if (siblings[siblings.length - 1].id !== match.id) return false;
        if (!siblings.every(m => m.home_score !== null && m.away_score !== null)) return false;
        const aggHome = siblings.reduce((s, m) => s + (m.home_score ?? 0), 0);
        const aggAway = siblings.reduce((s, m) => s + (m.away_score ?? 0), 0);
        return aggHome === aggAway;
      }
    }

    const isTied = match.home_score !== null && match.away_score !== null && match.home_score === match.away_score;
    return isTied;
  };


  const saveScore = async (match: Match, baseList?: Match[]) => {
    const base = baseList ?? matches;
    const isPlayed = match.home_score !== null && match.away_score !== null;
    // H&A legs: resolveMatchNeedsDecider eist enkel penalties op de Heen-match
    // wanneer alle legs gespeeld zijn en het aggregaat gelijk is.
    const isHALeg = !!match.match_name?.match(/\s+\((Heen|Terug)\)$/);
    const needsPenalties = resolveMatchNeedsDecider(match, base);
    const hasPenalties = match.home_penalties !== null && match.away_penalties !== null && match.home_penalties !== match.away_penalties;
    const finalIsPlayed = isPlayed && (!needsPenalties || hasPenalties);

    // Was de wedstrijd eerder gespeeld? Zo ja en nu niet meer → statistieken wissen
    const wasPlayed = base.find(x => x.id === match.id)?.is_played === true;
    if (wasPlayed && !finalIsPlayed) {
      await supabase.from("match_stats").delete().eq("match_id", match.id);
    }

    const { error } = await supabase.from("matches").update({
      home_score: match.home_score,
      away_score: match.away_score,
      home_penalties: match.home_penalties,
      away_penalties: match.away_penalties,
      is_played: finalIsPlayed,
      set_scores: (match as any).set_scores ?? null,
    } as any).eq("id", match.id);
    if (error) {
      toast({ title: "Fout", description: error.message, variant: "destructive" });
      return base;
    }

    let updatedMatches = base.map(x => x.id === match.id ? {
      ...x,
      home_score: match.home_score,
      away_score: match.away_score,
      home_penalties: match.home_penalties,
      away_penalties: match.away_penalties,
      set_scores: match.set_scores ?? null,
      is_played: finalIsPlayed,
    } : x);

    if (!finalIsPlayed && match.match_name) {
      const baseForClear = isHALeg
        ? match.match_name.replace(/\s+\((Heen|Terug)\)$/, "")
        : match.match_name;
      updatedMatches = await clearDownstreamTeams(baseForClear, updatedMatches, match.phase_id);
      setMatches(updatedMatches);
      return updatedMatches;
    }

    if (finalIsPlayed && match.match_name) {
      let winnerId: string | null = null;
      let loserId: string | null = null;
      let winnerBaseName = match.match_name;

      if (isHALeg) {
        // H&A: winnaar pas bepalen na beide legs; gebruik aggregaat + penalties op Heen
        const baseName = match.match_name.replace(/\s+\((Heen|Terug)\)$/, "");
        winnerBaseName = baseName;
        const heenName = `${baseName} (Heen)`;
        const terugName = `${baseName} (Terug)`;
        const heenM = updatedMatches.find(m => m.match_name === heenName && m.group_id === match.group_id);
        const terugM = updatedMatches.find(m => m.match_name === terugName && m.group_id === match.group_id);
        if (heenM && terugM && heenM.is_played && terugM.is_played) {
          const homeTotal = (heenM.home_score ?? 0) + (terugM.away_score ?? 0);
          const awayTotal = (heenM.away_score ?? 0) + (terugM.home_score ?? 0);
          if (homeTotal > awayTotal) { winnerId = heenM.home_team_id; loserId = heenM.away_team_id; }
          else if (awayTotal > homeTotal) { winnerId = heenM.away_team_id; loserId = heenM.home_team_id; }
          else {
            // Penalties staan op de Terug-wedstrijd, in Terug-oriëntatie
            const hp = terugM.home_penalties ?? 0;
            const ap = terugM.away_penalties ?? 0;
            if (hp > ap) { winnerId = terugM.home_team_id; loserId = terugM.away_team_id; }
            else if (ap > hp) { winnerId = terugM.away_team_id; loserId = terugM.home_team_id; }
          }
        }
      } else {
        const hs = match.home_score ?? 0;
        const as_ = match.away_score ?? 0;
        if (hs > as_) { winnerId = match.home_team_id; loserId = match.away_team_id; }
        else if (as_ > hs) { winnerId = match.away_team_id; loserId = match.home_team_id; }
        else {
          const hp = match.home_penalties ?? 0;
          const ap = match.away_penalties ?? 0;
          if (hp > ap) { winnerId = match.home_team_id; loserId = match.away_team_id; }
          else if (ap > hp) { winnerId = match.away_team_id; loserId = match.home_team_id; }
        }
      }

      if (winnerId) {
        const winnerLabel = `Winnaar ${winnerBaseName}`;
        const loserLabel = `Verliezer ${winnerBaseName}`;

        for (let i = 0; i < updatedMatches.length; i++) {
          const m = updatedMatches[i];
          if (m.id === match.id) continue;
          // Scope to the same format (phase_id) so duplicate match names
          // in sibling formats don't get cross-overwritten.
          if (m.phase_id !== match.phase_id) continue;
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
      }
    }
    setMatches(updatedMatches);
    return updatedMatches;
  };

  const updatePhaseCompletionState = async (phaseFormats: Phase[], completed: boolean) => {
    const completedAt = completed ? new Date().toISOString() : null;

    await Promise.all(
      phaseFormats.map((format) =>
        supabase
          .from("tournament_phases")
          .update({
            match_config: {
              ...(format.match_config ?? {}),
              phaseCompleted: completed,
              completedAt,
            },
          } as any)
          .eq("id", format.id),
      ),
    );

    setPhases((current) =>
      current.map((phase) =>
        phaseFormats.some((format) => format.id === phase.id)
          ? {
              ...phase,
              match_config: {
                ...(phase.match_config ?? {}),
                phaseCompleted: completed,
                completedAt,
              },
            }
          : phase,
      ),
    );
  };

  const updateFormatCompletionState = async (format: Phase, completed: boolean) => {
    await updatePhaseCompletionState([format], completed);
  };

  const isPreviousPhaseCompleted = (phaseNum: number) => {
    if (phaseNum <= 1) return true;
    const prevPhaseFormats = phases.filter(p => p.phase_number === phaseNum - 1);
    return prevPhaseFormats.length > 0 && prevPhaseFormats.every(f => Boolean(f.match_config?.phaseCompleted));
  };

  const isLaterPhaseCompleted = (phaseNum: number) => {
    const laterPhaseFormats = phases.filter(p => p.phase_number > phaseNum);
    return laterPhaseFormats.some(f => Boolean(f.match_config?.phaseCompleted));
  };

  const currentPhaseFormatsForCheck = phases.filter(p => p.phase_number === selectedPhaseNumber);
  const isCurrentPhaseCompleted = currentPhaseFormatsForCheck.length > 0 && currentPhaseFormatsForCheck.every((format) => Boolean(format.match_config?.phaseCompleted));
  const canEditScores = selectedPhaseNumber !== null;
  const canEditFormat = (format: Phase) => !Boolean(format.match_config?.phaseCompleted);
  const canEditMatch = (match: Match) => {
    const format = phases.find(p => p.id === match.phase_id);
    return Boolean(format && canEditFormat(format) && match.home_team_id && match.away_team_id);
  };

  const calcStandings = (groupId: string) => {
    const rows = calculateGroupStandings(
      groupId,
      groupTeams as any,
      matches as any,
      groups as any,
      phases as any,
      scoringSystems,
      tournament,
    );
    return rows.map((r) => ({
      ...r,
      team:
        teams.find((t) => t.id === r.teamId) ||
        ({ id: r.teamId, name: "?", logo_url: null, country: null } as any),
    }));
  };

  const getColorForPosition = (phaseId: string, pos: number) => {
    return standingColors.find(sc => sc.phase_id === phaseId && pos >= sc.position_from && pos <= sc.position_to);
  };

  // Preview data for the selected format completion dialog
  const completePreview = useMemo(() => {
    const selectedFormat = selectedFormatActionId ? phases.find(p => p.id === selectedFormatActionId) : null;
    if (!selectedFormat) return null;
    const phaseFormats = [selectedFormat];
    const groupFormats = phaseFormats.filter(p => p.phase_type === "group" || p.phase_type === "round_robin");

    const standingsByGroup = new Map<string, ReturnType<typeof calcStandings>>();
    const positionsByGroup = new Map<string, { teamId: string; position: number }[]>();

    const formatPreviews = groupFormats.map((format) => {
      const formatGroups = groups
        .filter(g => g.phase_id === format.id)
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }));
      const groupPreviews = formatGroups.map((group) => {
        const standings = calcStandings(group.id);
        standingsByGroup.set(group.id, standings);
        positionsByGroup.set(group.id, standings.map(row => ({ teamId: row.team.id, position: row.pos })));
        const groupSlots = slots
          .filter(s => s.ref_phase_id === format.id && s.ref_group_id === group.id && s.ref_position)
          .sort((a, b) => (a.ref_position ?? 0) - (b.ref_position ?? 0));
        const progressions = groupSlots.map((slot) => {
          const targetPhase = phases.find(p => p.id === slot.phase_id);
          const standingEntry = standings.find(s => s.pos === slot.ref_position);
          return {
            slotId: slot.id,
            slotCode: slot.slot_code,
            position: slot.ref_position!,
            targetPhaseName: targetPhase ? getPhaseLabel(targetPhase.phase_number, phases) : "?",
            team: standingEntry?.team ?? null,
          };
        });
        return { group, standings, progressions };
      });
      return { format, groupPreviews };
    });

    if (selectedFormat.phase_type === "knockout" || selectedFormat.phase_type === "single_match") {
      const formatGroups = groups.filter(g => g.phase_id === selectedFormat.id);
      const getWinnerLoser = (m: Match) => {
        if (m.home_score === null || m.away_score === null) return null;
        const homeWins = m.home_score > m.away_score ||
          (m.home_score === m.away_score && (m.home_penalties ?? 0) > (m.away_penalties ?? 0));
        return {
          winnerId: homeWins ? m.home_team_id : m.away_team_id,
          loserId: homeWins ? m.away_team_id : m.home_team_id,
        };
      };

      for (const group of formatGroups) {
        const groupMatches = matches.filter(m => m.phase_id === selectedFormat.id && m.group_id === group.id && m.is_played);
        if (groupMatches.length === 0) continue;
        const maxRound = Math.max(...groupMatches.map(m => m.round_number ?? 0));
        const positions: { teamId: string; position: number }[] = [];
        const finalMatches = groupMatches
          .filter(m => (m.round_number ?? 0) === maxRound)
          .sort((a, b) => (a.match_name ?? "").localeCompare(b.match_name ?? ""));
        const winners: string[] = [];
        const losers: string[] = [];
        for (const match of finalMatches) {
          const result = getWinnerLoser(match);
          if (result?.winnerId) winners.push(result.winnerId);
          if (result?.loserId) losers.push(result.loserId);
        }
        let nextPosition = 1;
        winners.forEach(teamId => positions.push({ teamId, position: nextPosition++ }));
        losers.forEach(teamId => positions.push({ teamId, position: nextPosition++ }));
        positionsByGroup.set(group.id, positions);
      }
    }

    const nextPhaseNumber = Math.min(
      ...phases
        .filter(p => p.phase_number > selectedFormat.phase_number)
        .map(p => p.phase_number),
    );
    const nextFormatPreviews = Number.isFinite(nextPhaseNumber)
      ? phases
          .filter(p => p.phase_number === nextPhaseNumber)
          .map((format) => {
            const formatSlots = slots
              .filter(s => s.phase_id === format.id)
              .sort((a, b) => a.sort_order - b.sort_order || a.slot_code.localeCompare(b.slot_code, undefined, { numeric: true, sensitivity: "base" }))
              .map((slot) => {
                const directTeam = slot.team_id ? teams.find(t => t.id === slot.team_id) ?? null : null;
                const sourceStandings = slot.ref_group_id ? standingsByGroup.get(slot.ref_group_id) : null;
                const sourceEntry = sourceStandings?.find(row => row.pos === slot.ref_position);
                const sourcePosition = slot.ref_group_id ? positionsByGroup.get(slot.ref_group_id)?.find(row => row.position === slot.ref_position) : null;
                const sourceGroup = slot.ref_group_id ? groups.find(g => g.id === slot.ref_group_id) : null;
                const sourcePhase = slot.ref_phase_id ? phases.find(p => p.id === slot.ref_phase_id) : null;
                const sourceTeam = sourceEntry?.team ?? (sourcePosition?.teamId ? teams.find(t => t.id === sourcePosition.teamId) ?? null : null);
                const isReachedBySelectedFormat = slot.ref_phase_id === selectedFormat.id && Boolean(sourceTeam);

                return {
                  ...slot,
                  team: directTeam ?? sourceTeam,
                  isReachedBySelectedFormat,
                  sourceLabel: sourceGroup && slot.ref_position
                    ? `${slot.ref_position}e ${sourceGroup.name}`
                    : sourcePhase && slot.ref_position
                      ? `${slot.ref_position}e ${sourcePhase.name}`
                      : null,
                };
              });

            const formatMatches = matches
              .filter(m => m.phase_id === format.id)
              .sort((a, b) => (a.round_number ?? 0) - (b.round_number ?? 0) || (a.match_name ?? "").localeCompare(b.match_name ?? ""));
            const firstReachedRound = Math.min(
              ...formatMatches
                .filter((match) => {
                  const homeSlot = formatSlots.find(slot => slot.slot_code === match.home_slot_label);
                  const awaySlot = formatSlots.find(slot => slot.slot_code === match.away_slot_label);
                  return Boolean(homeSlot?.isReachedBySelectedFormat || awaySlot?.isReachedBySelectedFormat);
                })
                .map(match => match.round_number ?? 0),
            );
            const matchPreviews = Number.isFinite(firstReachedRound) ? formatMatches.filter(match => (match.round_number ?? 0) === firstReachedRound).map((match) => {
              const homeSlot = formatSlots.find(slot => slot.slot_code === match.home_slot_label);
              const awaySlot = formatSlots.find(slot => slot.slot_code === match.away_slot_label);
              return {
                match,
                homeName: homeSlot?.team?.name ?? getMatchSideDisplayName(match, "home", teams, { slots, phases, groups, emptyLabel: "LEGE PLEK" }),
                awayName: awaySlot?.team?.name ?? getMatchSideDisplayName(match, "away", teams, { slots, phases, groups, emptyLabel: "LEGE PLEK" }),
              };
            }) : [];

            return { format, slots: formatSlots, matchPreviews };
          })
      : [];

    return { selectedFormat, formatPreviews, nextFormatPreviews };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFormatActionId, phases, groups, slots, groupTeams, matches, scoringSystems, teams, tournament]);

  const completeFormats = async (phaseFormats: Phase[], options?: { advancePhase?: boolean }) => {
    if (phaseFormats.length === 0) return;
    const phaseNumber = phaseFormats[0].phase_number;

    if (!isPreviousPhaseCompleted(phaseNumber)) {
      toast({ title: "Vorige fase nog niet voltooid", description: `Voltooi eerst ${getPhaseLabel(phaseNumber - 1, phases)} voordat je dit format kunt voltooien.`, variant: "destructive" });
      setPhaseActionDialog(null);
      return;
    }

    const groupFormats = phaseFormats.filter(p => p.phase_type === "group" || p.phase_type === "round_robin");

    const standingsMap: Record<string, { teamId: string; position: number }[]> = {};

    // Tied teams are ordered manually in the completion dialog; use current order
    for (const format of groupFormats) {
      const formatGroups = groups.filter(g => g.phase_id === format.id);
      for (const group of formatGroups) {
        const standings = calcStandings(group.id);
        standingsMap[group.id] = standings.map(s => ({ teamId: s.team.id, position: s.pos }));
      }
    }

    const knockoutFormats = phaseFormats.filter(p => p.phase_type === "knockout" || p.phase_type === "single_match");
    for (const format of knockoutFormats) {
      const formatGroups = groups.filter(g => g.phase_id === format.id);
      const formatMatches = matches.filter(m => m.phase_id === format.id && m.is_played);

      for (const group of formatGroups) {
        const groupMatches = formatMatches.filter(m => m.group_id === group.id);
        if (groupMatches.length === 0) continue;

        const getWinnerLoser = (m: Match) => {
          if (m.home_score === null || m.away_score === null) return null;
          const homeWins = m.home_score > m.away_score ||
            (m.home_score === m.away_score && (m.home_penalties ?? 0) > (m.away_penalties ?? 0));
          return {
            winnerId: homeWins ? m.home_team_id : m.away_team_id,
            loserId: homeWins ? m.away_team_id : m.home_team_id,
          };
        };

        const maxRound = Math.max(...groupMatches.map(m => m.round_number ?? 0));
        const positions: { teamId: string; position: number }[] = [];

        if (maxRound > 0) {
          const finalMatches = groupMatches
            .filter(m => m.round_number === maxRound)
            .sort((a, b) => (a.match_name ?? "").localeCompare(b.match_name ?? ""));

          const winners: string[] = [];
          const losers: string[] = [];

          for (const m of finalMatches) {
            const result = getWinnerLoser(m);
            if (!result) continue;
            if (result.winnerId) winners.push(result.winnerId);
            if (result.loserId) losers.push(result.loserId);
          }

          let nextPosition = 1;
          for (const id of winners) positions.push({ teamId: id, position: nextPosition++ });
          for (const id of losers) positions.push({ teamId: id, position: nextPosition++ });

          const alreadyPlaced = new Set(positions.map(p => p.teamId));
          for (let round = maxRound - 1; round >= 1; round--) {
            const roundMatches = groupMatches
              .filter(m => m.round_number === round)
              .sort((a, b) => (a.match_name ?? "").localeCompare(b.match_name ?? ""));

            const roundLosers: string[] = [];
            for (const m of roundMatches) {
              const result = getWinnerLoser(m);
              if (!result) continue;
              if (result.loserId && !alreadyPlaced.has(result.loserId)) {
                roundLosers.push(result.loserId);
                alreadyPlaced.add(result.loserId);
              }
            }
            for (const id of roundLosers) positions.push({ teamId: id, position: nextPosition++ });
          }
        }

        if (positions.length > 0) {
          standingsMap[group.id] = positions;
        }
      }
    }

    const formatIds = phaseFormats.map(f => f.id);

    const crossGroupRankings: Record<string, { teamId: string; rank: number }[]> = {};
    for (const format of groupFormats) {
      const formatGroups = groups.filter(g => g.phase_id === format.id);
      const tierMap: Record<number, { teamId: string; gd: number; gf: number; pts: number }[]> = {};
      for (const group of formatGroups) {
        const standings = standingsMap[group.id];
        if (!standings) continue;
        for (const s of standings) {
          if (!tierMap[s.position]) tierMap[s.position] = [];
          const gts = groupTeams.filter(gt => gt.group_id === group.id);
          const groupMatches = matches.filter(m => m.group_id === group.id && m.is_played);
          const gt = gts.find(gt => gt.team_id === s.teamId);
          if (!gt) { tierMap[s.position].push({ teamId: s.teamId, gd: 0, gf: 0, pts: 0 }); continue; }
          let w = 0, d = 0, l = 0, gf = 0, ga = 0, pts = 0;
          groupMatches.forEach(m => {
            const isHome = m.home_team_id === s.teamId;
            const isAway = m.away_team_id === s.teamId;
            if (!isHome && !isAway) return;
            const own = (isHome ? m.home_score : m.away_score) ?? 0;
            const opp = (isHome ? m.away_score : m.home_score) ?? 0;
            let sys = m.scoring_system_id ? scoringSystems.find(x => x.id === m.scoring_system_id) : undefined;
            if (!sys && m.group_id) {
              const g = groups.find(x => x.id === m.group_id);
              sys = g?.scoring_system_id ? scoringSystems.find(x => x.id === g.scoring_system_id) : undefined;
            }
            if (!sys) {
              const p = phases.find(x => x.id === m.phase_id);
              sys = (p as any)?.scoring_system_id ? scoringSystems.find(x => x.id === (p as any).scoring_system_id) : undefined;
            }
            const ptsWin = sys?.points_win ?? tournament?.points_win ?? 3;
            const ptsDraw = sys?.points_draw ?? tournament?.points_draw ?? 1;
            const ptsLoss = sys?.points_loss ?? tournament?.points_loss ?? 0;
            gf += own; ga += opp;
            if (own > opp) { w++; pts += ptsWin; } else if (own === opp) { d++; pts += ptsDraw; } else { l++; pts += ptsLoss; }
          });
          tierMap[s.position].push({ teamId: s.teamId, pts, gd: gf - ga, gf });
        }
      }
      for (const tier in tierMap) {
        tierMap[tier].sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf);
        const posNum = parseInt(tier);
        for (let rank = 0; rank < tierMap[tier].length; rank++) {
          const encodedPos = posNum * 100 + (rank + 1);
          const key = `${format.id}|${encodedPos}`;
          if (!crossGroupRankings[key]) crossGroupRankings[key] = [];
          crossGroupRankings[key].push({ teamId: tierMap[tier][rank].teamId, rank: rank + 1 });
        }
      }
    }

    const { data: refSlots } = await supabase
      .from("slots")
      .select("*")
      .eq("tournament_id", tournamentId)
      .in("ref_phase_id", formatIds);

    let filledCount = 0;

    if (refSlots && refSlots.length > 0) {
      for (const slot of refSlots) {
        if (!slot.ref_position) continue;

        let teamId: string | null = null;

        if (slot.ref_group_id) {
          const groupStandings = standingsMap[slot.ref_group_id];
          if (!groupStandings) continue;
          const entry = groupStandings.find(s => s.position === slot.ref_position);
          if (!entry) continue;
          teamId = entry.teamId;
        } else if (slot.ref_position >= 100) {
          const key = `${slot.ref_phase_id}|${slot.ref_position}`;
          const ranking = crossGroupRankings[key];
          if (ranking && ranking.length > 0) {
            teamId = ranking[0].teamId;
          } else continue;
        } else continue;

        if (!teamId) continue;

        await supabase.from("slots").update({ team_id: teamId }).eq("id", slot.id);

        if (slot.group_id) {
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

        if (slot.slot_code && slot.phase_id) {
          let homeUpdate = supabase.from("matches")
            .update({ home_team_id: teamId })
            .eq("tournament_id", tournamentId)
            .eq("phase_id", slot.phase_id)
            .eq("home_slot_label", slot.slot_code);
          let awayUpdate = supabase.from("matches")
            .update({ away_team_id: teamId })
            .eq("tournament_id", tournamentId)
            .eq("phase_id", slot.phase_id)
            .eq("away_slot_label", slot.slot_code);
          if (slot.group_id) {
            homeUpdate = homeUpdate.eq("group_id", slot.group_id);
            awayUpdate = awayUpdate.eq("group_id", slot.group_id);
          }
          await homeUpdate;
          await awayUpdate;
        }
        filledCount++;
      }
    }

    await updatePhaseCompletionState(phaseFormats, true);
    setPhaseActionDialog(null);
    setSelectedFormatActionId(null);

    const isSingleFormat = phaseFormats.length === 1;
    if (filledCount > 0) {
      toast({ title: isSingleFormat ? "Format voltooid!" : "Fase voltooid!", description: `${filledCount} slot(s) automatisch ingevuld in volgende fase.` });
    } else {
      toast({ title: isSingleFormat ? "Format voltooid" : "Fase voltooid", description: "Klassement is definitief." });
    }

    if (options?.advancePhase) {
      const nextPhaseNumber = [...new Set(phases.map(p => p.phase_number))].sort((a, b) => a - b).find(pn => pn > phaseNumber);
      if (nextPhaseNumber !== undefined) {
        setSelectedPhaseNumber(nextPhaseNumber);
      }
    }

    await fetchData();
  };

  const completeSelectedFormat = async () => {
    const format = selectedFormatActionId ? phases.find(p => p.id === selectedFormatActionId) : null;
    if (!format) return;
    await completeFormats([format], { advancePhase: false });
  };

  const undoCompletedFormats = async (phaseFormats: Phase[]) => {
    if (phaseFormats.length === 0) return;

    const formatIds = phaseFormats.map((phase) => phase.id);
    const formatIdsToReset = new Set<string>();
    const affectedTargetPhaseIds = new Set<string>();
    const { data: allSlots } = await supabase
      .from("slots")
      .select("*")
      .eq("tournament_id", tournamentId);

    const tournamentSlots = (allSlots ?? []) as SlotEntry[];
    const slotsToClear: SlotEntry[] = [];
    const queuedSourceFormatIds = [...formatIds];
    const visitedSourceFormatIds = new Set<string>();

    while (queuedSourceFormatIds.length > 0) {
      const sourceFormatId = queuedSourceFormatIds.shift()!;
      if (visitedSourceFormatIds.has(sourceFormatId)) continue;
      visitedSourceFormatIds.add(sourceFormatId);

      const outgoingSlots = tournamentSlots.filter(slot => slot.ref_phase_id === sourceFormatId);
      for (const slot of outgoingSlots) {
        if (formatIds.includes(slot.phase_id)) continue;
        if (!slotsToClear.some(existing => existing.id === slot.id)) {
          slotsToClear.push(slot);
        }
        affectedTargetPhaseIds.add(slot.phase_id);
        if (!formatIdsToReset.has(slot.phase_id)) {
          formatIdsToReset.add(slot.phase_id);
          queuedSourceFormatIds.push(slot.phase_id);
        }
      }
    }

    let clearedCount = 0;
    const targetFormatIds = new Set([...formatIdsToReset].filter(id => !formatIds.includes(id)));
    const targetGroupIds = groups
      .filter((group) => targetFormatIds.has(group.phase_id))
      .map((group) => group.id);
    if (targetGroupIds.length > 0) {
      await supabase.from("group_teams")
        .delete()
        .eq("tournament_id", tournamentId)
        .in("group_id", targetGroupIds);
    }

    const allTargetSlotsToClear = tournamentSlots.filter(slot => targetFormatIds.has(slot.phase_id) && slot.team_id);
    const combinedSlotsToClear = [...slotsToClear];
    for (const slot of allTargetSlotsToClear) {
      if (!combinedSlotsToClear.some(existing => existing.id === slot.id)) {
        combinedSlotsToClear.push(slot);
      }
    }

    if (combinedSlotsToClear.length > 0) {
      for (const slot of combinedSlotsToClear) {
        const previousTeamId = slot.team_id;
        await supabase.from("slots").update({ team_id: null }).eq("id", slot.id);

        if (slot.group_id && previousTeamId) {
          await supabase.from("group_teams")
            .delete()
            .eq("group_id", slot.group_id)
            .eq("team_id", previousTeamId)
            .eq("tournament_id", tournamentId);
        }
        clearedCount++;
      }
    }

    // Reset ALLE wedstrijden in de ongedaan gemaakte formats én alle formats
    // die daarvan afhankelijk zijn. Zo verdwijnen ook scores/teams uit latere
    // rondes die eerst door een gespeelde wedstrijd in het doel-format waren
    // doorgestroomd.
    const { data: allUndoMatches } = await supabase
      .from("matches")
      .select("id, phase_id, group_id, match_name, home_slot_label, away_slot_label, home_team_id, away_team_id, home_score, away_score, home_penalties, away_penalties, is_played, set_scores")
      .eq("tournament_id", tournamentId);
    const undoMatches = (allUndoMatches ?? matches) as Match[];
    const matchesInResetFormats = undoMatches.filter((m) => formatIdsToReset.has(m.phase_id));
    if (matchesInResetFormats.length > 0) {
      const resetMatchIds = matchesInResetFormats.map((m) => m.id);
      const targetResetMatchIds = matchesInResetFormats
        .filter((m) => targetFormatIds.has(m.phase_id))
        .map((m) => m.id);

      await supabase.from("match_stats")
        .delete()
        .eq("tournament_id", tournamentId)
        .in("match_id", resetMatchIds);

      await supabase.from("matches")
        .update({
          home_score: null,
          away_score: null,
          home_penalties: null,
          away_penalties: null,
          set_scores: null,
          is_played: false,
        })
        .eq("tournament_id", tournamentId)
        .in("id", resetMatchIds);

      if (targetResetMatchIds.length > 0) {
        await supabase.from("matches")
          .update({ home_team_id: null, away_team_id: null })
          .eq("tournament_id", tournamentId)
          .in("id", targetResetMatchIds);
      }

      for (const m of matchesInResetFormats) {
        if (targetFormatIds.has(m.phase_id)) continue;
        const updates: Record<string, null> = {};
        if (m.home_slot_label) updates.home_team_id = null;
        if (m.away_slot_label) updates.away_team_id = null;
        if (Object.keys(updates).length > 0) {
          await supabase.from("matches").update(updates).eq("id", m.id);
        }
      }

      clearedCount += matchesInResetFormats.length;
    }

    // Also undo bracket-style propagation: any match (in OTHER formats, including
    // later phases) whose slot_label references a match name from reset
    // format(s) via "Winnaar X" / "Verliezer X" should have its propagated team
    // and score cleared. This catches downstream brackets that received teams
    // via match_name propagation rather than via slots.
    const propagationSourceFormatIds = new Set([...formatIds, ...formatIdsToReset]);
    const sourceMatchNames = new Set<string>();
    for (const m of undoMatches) {
      if (propagationSourceFormatIds.has(m.phase_id) && m.match_name) {
        sourceMatchNames.add(m.match_name);
        // Strip H&A suffix so "Halve Finale - 1 (Heen)" matches "Winnaar Halve Finale - 1"
        const baseName = m.match_name.replace(/\s+\((Heen|Terug)\)$/, "");
        if (baseName !== m.match_name) sourceMatchNames.add(baseName);
      }
    }

    if (sourceMatchNames.size > 0) {
      const propagationLabels = new Set<string>();
      for (const name of sourceMatchNames) {
        propagationLabels.add(`Winnaar ${name}`);
        propagationLabels.add(`Verliezer ${name}`);
      }

      const downstreamMatchIds = new Set<string>();
      for (const m of undoMatches) {
        // Skip bron- en reset-formats: bron blijft bewaard, targets zijn al gereset.
        if (propagationSourceFormatIds.has(m.phase_id)) continue;
        const homeHit = m.home_slot_label && propagationLabels.has(m.home_slot_label);
        const awayHit = m.away_slot_label && propagationLabels.has(m.away_slot_label);
        if (homeHit || awayHit) {
          downstreamMatchIds.add(m.id);
          if (homeHit) {
            await supabase.from("matches").update({ home_team_id: null }).eq("id", m.id);
          }
          if (awayHit) {
            await supabase.from("matches").update({ away_team_id: null }).eq("id", m.id);
          }
        }
      }

      if (downstreamMatchIds.size > 0) {
        const ids = [...downstreamMatchIds];
        await supabase.from("match_stats")
          .delete()
          .eq("tournament_id", tournamentId)
          .in("match_id", ids);
        await supabase.from("matches")
          .update({
            home_score: null,
            away_score: null,
            home_penalties: null,
            away_penalties: null,
            set_scores: null,
            is_played: false,
          })
          .eq("tournament_id", tournamentId)
          .in("id", ids);
        clearedCount += downstreamMatchIds.size;

        // Also mark any later-phase formats containing these matches as not completed
        for (const mid of downstreamMatchIds) {
          const m = undoMatches.find((x) => x.id === mid);
          if (m) affectedTargetPhaseIds.add(m.phase_id);
        }
      }
    }

    const resetFormats = phases.filter(p => formatIds.includes(p.id) || formatIdsToReset.has(p.id) || affectedTargetPhaseIds.has(p.id));
    await updatePhaseCompletionState(resetFormats.length > 0 ? resetFormats : phaseFormats, false);
    setPhaseActionDialog(null);
    setSelectedFormatActionId(null);
    setResultsRefreshKey((current) => current + 1);

    toast({
      title: phaseFormats.length === 1 ? "Format ongedaan gemaakt" : "Fase ongedaan gemaakt",
      description: clearedCount > 0
        ? `Alle wedstrijden en doorstromingen binnen dit format zijn gereset.`
        : "Dit onderdeel is opnieuw bewerkbaar.",
    });
    await fetchData();
  };

  const undoSelectedFormat = async () => {
    const format = selectedFormatActionId ? phases.find(p => p.id === selectedFormatActionId) : null;
    if (!format) return;
    await undoCompletedFormats([format]);
  };

  const getDisplayName = (match: Match, side: "home" | "away") => {
    return getMatchSideDisplayName(match, side, teams, { slots, phases, groups, emptyLabel: "LEGE PLEK" });
  };

  const teamLogo = (id: string | null) => teams.find(t => t.id === id)?.logo_url || null;

  const resolveScoringSystem = (match: Match) => {
    let sysId = match.scoring_system_id;
    if (!sysId && match.group_id) {
      const g = groups.find(x => x.id === match.group_id);
      sysId = g?.scoring_system_id ?? null;
    }
    if (!sysId) {
      const phase = phases.find(p => p.id === match.phase_id);
      sysId = phase?.scoring_system_id ?? null;
    }
    const sys = sysId ? scoringSystems.find(s => s.id === sysId) : scoringSystems[0];
    return sys as any;
  };

  const handleScoreChange = (id: string, field: "home_score" | "away_score", value: string) => {
    if (value !== "" && isNaN(parseInt(value))) return;
    const numVal = value === "" ? null : parseInt(value);
    const updated = matches.map(x => {
      if (x.id !== id) return x;
      const newMatch = { ...x, [field]: numVal };
      const hs = field === "home_score" ? numVal : x.home_score;
      const as_ = field === "away_score" ? numVal : x.away_score;
      if (hs !== null && as_ !== null && hs !== as_) {
        newMatch.home_penalties = null;
        newMatch.away_penalties = null;
      }
      return newMatch;
    });
    setMatches(updated);
  };

  const handlePenaltyChange = (id: string, field: "home_penalties" | "away_penalties", value: string) => {
    if (value !== "" && isNaN(parseInt(value))) return;
    setMatches(m => m.map(x => x.id === id ? { ...x, [field]: value === "" ? null : parseInt(value) } : x));
  };

  const handleBlurSave = (m: Match) => {
    const match = matches.find(x => x.id === m.id) || m;
    saveScore(match);
  };

  const updateBonusPoints = async (groupId: string, teamId: string, delta: number) => {
    const gt = groupTeams.find(x => x.group_id === groupId && x.team_id === teamId);
    if (!gt) return;
    const newVal = (gt.bonus_points || 0) + delta;
    await supabase.from("group_teams")
      .update({ bonus_points: newVal })
      .eq("group_id", groupId)
      .eq("team_id", teamId)
      .eq("tournament_id", tournamentId);
    setGroupTeams(prev => prev.map(x =>
      x.group_id === groupId && x.team_id === teamId
        ? { ...x, bonus_points: newVal }
        : x
    ));
  };

  const updateFairplayPoints = async (groupId: string, teamId: string, delta: number) => {
    const gt = groupTeams.find(x => x.group_id === groupId && x.team_id === teamId);
    if (!gt) return;
    const newVal = Math.max(0, (gt.fairplay_points || 0) + delta);
    await supabase.from("group_teams")
      .update({ fairplay_points: newVal } as any)
      .eq("group_id", groupId)
      .eq("team_id", teamId)
      .eq("tournament_id", tournamentId);
    setGroupTeams(prev => prev.map(x =>
      x.group_id === groupId && x.team_id === teamId
        ? { ...x, fairplay_points: newVal }
        : x
    ));
  };

  /**
   * Move a tied team (drawing_lots) up or down. Persists the manual ordering
   * by storing 1-based manual_position on the relevant group_teams rows.
   */
  const moveDrawingLotsTeam = async (groupId: string, teamId: string, direction: -1 | 1) => {
    const standings = calcStandings(groupId);
    const idx = standings.findIndex(s => s.team.id === teamId);
    if (idx < 0) return;
    const target = idx + direction;
    if (target < 0 || target >= standings.length) return;
    // Only swap with an adjacent team that is also flagged for drawing lots
    if (!standings[idx].needsDrawingLots || !standings[target].needsDrawingLots) return;

    // Determine the contiguous block of tied (drawing_lots) teams around idx
    let start = idx, end = idx;
    while (start > 0 && standings[start - 1].needsDrawingLots) start--;
    while (end < standings.length - 1 && standings[end + 1].needsDrawingLots) end++;

    // Build the new order for that block, swapping idx & target
    const block = standings.slice(start, end + 1).map(s => s.team.id);
    const localIdx = idx - start;
    const localTarget = target - start;
    [block[localIdx], block[localTarget]] = [block[localTarget], block[localIdx]];

    // Persist 1-based manual positions for every team in the block
    const updates = block.map((tid, i) => ({ teamId: tid, manualPos: i + 1 }));
    await Promise.all(updates.map(u =>
      supabase.from("group_teams")
        .update({ manual_position: u.manualPos } as any)
        .eq("group_id", groupId)
        .eq("team_id", u.teamId)
        .eq("tournament_id", tournamentId)
    ));
    setGroupTeams(prev => prev.map(x => {
      const u = updates.find(u => u.teamId === x.team_id && x.group_id === groupId);
      return u ? { ...x, manual_position: u.manualPos } : x;
    }));
  };

  // Derived data
  const phaseNumbers = [...new Set(phases.map(p => p.phase_number))].sort((a, b) => a - b);
  const currentPhaseFormats = phases
    .filter(p => selectedPhaseNumber === null || p.phase_number === selectedPhaseNumber)
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }));

  const configuredPlannerFieldNames = useMemo(() => {
    return categoryFieldNames.length > 0
      ? categoryFieldNames
      : Array.isArray(tournament?.fields)
        ? tournament.fields
            .map((f: any) => (typeof f === "string" ? f : f?.name || ""))
            .filter(Boolean)
        : [];
  }, [categoryFieldNames, tournament?.fields]);

  const isMatchPlannedInSchema = (match: Match) => {
    if (!match.match_date || !match.match_time || !match.field) return false;
    return configuredPlannerFieldNames.includes(match.field);
  };

  // Teams wijzigen aan een wedstrijd (enkel home/away, de rest gebeurt in het Schema-tabblad)
  // Eenmaal gepland in het Schema-tabblad kan je de teams niet meer wijzigen.
  const canAssignTeams = (match: Match) => {
    const format = phases.find(p => p.id === match.phase_id);
    return Boolean(format && canEditFormat(format) && !isMatchPlannedInSchema(match));
  };

  const openAssignDialog = (match: Match) => {
    setAssignDraft({
      homeTeamId: match.home_team_id || "",
      awayTeamId: match.away_team_id || "",
    });
    setAssigningMatchId(match.id);
  };

  const saveAssign = async () => {
    if (!assigningMatchId) return;
    setSavingAssign(true);
    const currentMatch = matches.find(m => m.id === assigningMatchId);
    if (!currentMatch) {
      setSavingAssign(false);
      return;
    }

    const payload = {
      home_team_id: assignDraft.homeTeamId || null,
      away_team_id: assignDraft.awayTeamId || null,
    };

    const teamsChanged = currentMatch.home_team_id !== payload.home_team_id ||
                         currentMatch.away_team_id !== payload.away_team_id;

    let finalPayload: any = { ...payload };
    if (teamsChanged && currentMatch.is_played) {
      finalPayload = {
        ...finalPayload,
        home_score: null,
        away_score: null,
        home_penalties: null,
        away_penalties: null,
        set_scores: null,
        is_played: false,
      };
      await supabase.from("match_stats").delete().eq("match_id", currentMatch.id);
    }

    const { error } = await supabase.from("matches").update(finalPayload).eq("id", assigningMatchId);
    setSavingAssign(false);
    if (error) {
      toast({ title: "Opslaan mislukt", description: error.message, variant: "destructive" });
      return;
    }

    let updatedMatches = matches.map(m => m.id === assigningMatchId ? { ...m, ...finalPayload } as Match : m);

    if (teamsChanged && currentMatch.match_name) {
      updatedMatches = await clearDownstreamTeams(currentMatch.match_name, updatedMatches, currentMatch.phase_id);
    }

    setMatches(updatedMatches);
    setAssigningMatchId(null);
    toast({ title: "Teams opgeslagen" });
  };


  // All matches: visible planner time slots first, unplanned always at the bottom.
  // C-mode: ALWAYS list every match in the (category-scoped) tournament chronologically,
  // independent of the active phase tab. Phase tabs only drive the format-chip rail above.
  const allPhaseMatches = useMemo(() => {
    const phaseIdsInScope = phases.map(p => p.id); // already category-scoped via fetchData
    const phaseOrderMap: Record<string, number> = {};
    phases.forEach((p, idx) => { phaseOrderMap[p.id] = idx; });
    const phaseMatches = matches.filter(m => phaseIdsInScope.includes(m.phase_id));

    const fieldOrderMap: Record<string, number> = {};
    configuredPlannerFieldNames.forEach((name, idx) => {
      fieldOrderMap[name] = idx;
    });

    return [...phaseMatches].sort((a, b) => {
      const plannedA = isMatchPlannedInSchema(a);
      const plannedB = isMatchPlannedInSchema(b);
      if (plannedA !== plannedB) return plannedA ? -1 : 1;

      const dateA = a.match_date || "9999-12-31";
      const dateB = b.match_date || "9999-12-31";
      if (dateA !== dateB) return dateA.localeCompare(dateB);

      const timeA = a.match_time || "99:99:99";
      const timeB = b.match_time || "99:99:99";
      if (timeA !== timeB) return timeA.localeCompare(timeB);

      const fieldIdxA = a.field ? (fieldOrderMap[a.field] ?? Number.MAX_SAFE_INTEGER) : Number.MAX_SAFE_INTEGER;
      const fieldIdxB = b.field ? (fieldOrderMap[b.field] ?? Number.MAX_SAFE_INTEGER) : Number.MAX_SAFE_INTEGER;
      if (fieldIdxA !== fieldIdxB) return fieldIdxA - fieldIdxB;

      if ((a.field || "") !== (b.field || "")) {
        return (a.field || "").localeCompare(b.field || "", undefined, { numeric: true, sensitivity: "base" });
      }

      const phaseIdxA = phaseOrderMap[a.phase_id] ?? Number.MAX_SAFE_INTEGER;
      const phaseIdxB = phaseOrderMap[b.phase_id] ?? Number.MAX_SAFE_INTEGER;
      if (phaseIdxA !== phaseIdxB) return phaseIdxA - phaseIdxB;

      return (a.round_number || 0) - (b.round_number || 0);
    });
  }, [matches, phases, configuredPlannerFieldNames]);

  // Group by day → time slot (compact, overview-friendly)
  const dayGroups = useMemo(() => {
    type Slot = { key: string; time: string; matches: Match[] };
    type Day = { key: string; date: string; label: string; slots: Slot[]; unplannedMatches: Match[] };
    const days: Day[] = [];
    const dayMap: Record<string, Day> = {};
    const unplannedTail: Match[] = [];

    allPhaseMatches.forEach(match => {
      const planned = isMatchPlannedInSchema(match);
      if (!planned) {
        unplannedTail.push(match);
        return;
      }
      const date = match.match_date || "";
      const time = match.match_time ? match.match_time.slice(0, 5) : "";
      if (!dayMap[date]) {
        let label = formatDateDMY(date) || date;
        try {
          const dt = new Date(date);
          label = dt.toLocaleDateString("nl-BE", { weekday: "long", day: "numeric", month: "long" });
          label = label.charAt(0).toUpperCase() + label.slice(1);
        } catch { /* keep fallback */ }
        const day: Day = { key: date, date, label, slots: [], unplannedMatches: [] };
        dayMap[date] = day;
        days.push(day);
      }
      const day = dayMap[date];
      const slotKey = `${date}|${time}`;
      let slot = day.slots.find(s => s.key === slotKey);
      if (!slot) {
        slot = { key: slotKey, time, matches: [] };
        day.slots.push(slot);
      }
      slot.matches.push(match);
    });

    if (unplannedTail.length > 0) {
      days.push({
        key: "__unplanned__",
        date: "",
        label: "Ongepland",
        slots: [{ key: "__unplanned__", time: "", matches: unplannedTail }],
        unplannedMatches: unplannedTail,
      });
    }

    return days;
  }, [allPhaseMatches, configuredPlannerFieldNames]);

  // Backwards-compat flat slot list for the auto-collapse effect.
  const timeSlotGroups = useMemo(() => {
    const flat: { key: string; label: string; matches: Match[] }[] = [];
    dayGroups.forEach(day => {
      day.slots.forEach(slot => {
        flat.push({ key: slot.key, label: slot.time || day.label, matches: slot.matches });
      });
    });
    return flat;
  }, [dayGroups]);

  useEffect(() => {
    setCollapsedTimeSlots(prev => {
      let changed = false;
      const next = new Set(prev);

      timeSlotGroups.forEach(group => {
        if (group.key === "__unplanned__") return;
        const allPlayed = group.matches.length > 0 && group.matches.every(match => match.is_played);
        if (allPlayed && !manuallyOpenedTimeSlots.has(group.key) && !next.has(group.key)) {
          next.add(group.key);
          changed = true;
        }
      });

      return changed ? next : prev;
    });
  }, [timeSlotGroups, manuallyOpenedTimeSlots]);

  // Render standings table with +/- controls
  const renderStandingsTable = (groupId: string, formatId: string, compact?: boolean) => {
    const standings = calcStandings(groupId);
    const group = groups.find(g => g.id === groupId);
    const tableFormat = phases.find(p => p.id === formatId);
    const tableCanEdit = tableFormat ? canEditFormat(tableFormat) : canEditScores;
    const phaseColors = standingColors.filter(sc => sc.phase_id === formatId).sort((a, b) => a.position_from - b.position_from);
    const setsMode = isSetsGroup(groupId, groups as any, phases as any, scoringSystems as any);
    const setPts = setsMode ? computeSetPointTotals(groupId, matches as any) : null;
    const cols = resolveStandingsColumns(tournament?.standings_columns);
    const pc = cols.points;
    const sc = cols.sets;

    return (
      <div className="rounded-lg border border-border overflow-hidden">
        {group && (
          <div className="bg-secondary px-3 py-1.5">
            <h4 className="font-display text-sm font-bold text-foreground">{group.name}</h4>
          </div>
        )}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-7 px-1.5 text-xs">#</TableHead>
              <TableHead className="text-xs px-1.5">Team</TableHead>
              {setsMode ? (
                <>
                  {sc.gp && <TableHead className="w-7 text-center text-xs px-0.5">GS</TableHead>}
                  {sc.w  && <TableHead className="w-7 text-center text-xs px-0.5">W</TableHead>}
                  {sc.d  && <TableHead className="w-7 text-center text-xs px-0.5">G</TableHead>}
                  {sc.l  && <TableHead className="w-7 text-center text-xs px-0.5">V</TableHead>}
                  {sc.sf && <TableHead className="w-7 text-center text-xs px-0.5">S+</TableHead>}
                  {sc.sa && <TableHead className="w-7 text-center text-xs px-0.5">S-</TableHead>}
                  {sc.sd && <TableHead className="w-9 text-center text-xs px-0.5">S+/-</TableHead>}
                  {sc.pf && <TableHead className="w-9 text-center text-xs px-0.5">P/S+</TableHead>}
                  {sc.pa && <TableHead className="w-9 text-center text-xs px-0.5">P/S-</TableHead>}
                  {sc.pd && <TableHead className="w-10 text-center text-xs px-0.5">P/S+/-</TableHead>}
                </>
              ) : (
                <>
                  {pc.gp && <TableHead className="w-7 text-center text-xs px-0.5">GS</TableHead>}
                  {pc.w  && <TableHead className="w-7 text-center text-xs px-0.5">W</TableHead>}
                  {pc.d  && <TableHead className="w-7 text-center text-xs px-0.5">G</TableHead>}
                  {pc.l  && <TableHead className="w-7 text-center text-xs px-0.5">V</TableHead>}
                  {pc.gf && <TableHead className="w-7 text-center text-xs px-0.5">+</TableHead>}
                  {pc.ga && <TableHead className="w-7 text-center text-xs px-0.5">-</TableHead>}
                  {pc.gd && <TableHead className="w-9 text-center text-xs px-0.5">+/-</TableHead>}
                </>
              )}
              <TableHead className={`text-center text-xs px-0.5 font-bold ${tableCanEdit ? "w-24" : "w-8"}`}>P</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {standings.map(row => {
              const colorZone = getColorForPosition(formatId, row.pos);
              const sp = setPts?.get(row.team.id) || { pf: 0, pa: 0 };
              return (
                <TableRow key={row.team.id}>
                  <TableCell className="px-1.5 py-1">
                    <div className="flex items-center gap-1">
                      {colorZone && <div className="w-1 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: colorZone.color }} />}
                      <span className="font-bold text-muted-foreground text-xs">{row.pos}</span>
                      {row.needsDrawingLots && (
                        <span title="Loting vereist — bepaal volgorde handmatig" className="text-[9px] font-bold text-amber-600 dark:text-amber-400 leading-none">L</span>
                      )}
                      {row.needsDrawingLots && tableCanEdit && (
                        <div className="flex flex-col -my-0.5 ml-0.5">
                          <button
                            type="button"
                            aria-label="Omhoog verplaatsen"
                            className="hover:text-foreground text-muted-foreground disabled:opacity-30 disabled:pointer-events-none leading-none"
                            disabled={standings.findIndex(s => s.team.id === row.team.id) === 0 || !standings[Math.max(0, standings.findIndex(s => s.team.id === row.team.id) - 1)]?.needsDrawingLots}
                            onClick={() => moveDrawingLotsTeam(groupId, row.team.id, -1)}
                          >
                            <ChevronUp className="!h-3 !w-3" />
                          </button>
                          <button
                            type="button"
                            aria-label="Omlaag verplaatsen"
                            className="hover:text-foreground text-muted-foreground disabled:opacity-30 disabled:pointer-events-none leading-none"
                            disabled={(() => { const i = standings.findIndex(s => s.team.id === row.team.id); return i === standings.length - 1 || !standings[i + 1]?.needsDrawingLots; })()}
                            onClick={() => moveDrawingLotsTeam(groupId, row.team.id, 1)}
                          >
                            <ChevronDown className="!h-3 !w-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="px-1 py-1 whitespace-nowrap">
                    <div className="flex items-center gap-1 w-fit">
                      {row.team.logo_url && <img src={row.team.logo_url} alt="" className="h-4 w-4 object-contain flex-shrink-0" />}
                      <span className="font-medium text-foreground text-xs">{row.team.name}</span>
                      {tournament?.show_country && row.team.country && (
                        <CountryFlag country={row.team.country} className="h-3 w-4 object-contain flex-shrink-0 align-middle" />
                      )}
                    </div>
                  </TableCell>
                  {setsMode ? (
                    <>
                      {sc.gp && <TableCell className="text-center px-0.5 py-1 text-xs">{row.gp}</TableCell>}
                      {sc.w  && <TableCell className="text-center px-0.5 py-1 text-xs">{row.w}</TableCell>}
                      {sc.d  && <TableCell className="text-center px-0.5 py-1 text-xs">{row.d}</TableCell>}
                      {sc.l  && <TableCell className="text-center px-0.5 py-1 text-xs">{row.l}</TableCell>}
                      {sc.sf && <TableCell className="text-center px-0.5 py-1 text-xs">{row.gf}</TableCell>}
                      {sc.sa && <TableCell className="text-center px-0.5 py-1 text-xs">{row.ga}</TableCell>}
                      {sc.sd && <TableCell className="text-center px-0.5 py-1 text-xs font-medium">{formatSigned(row.gd)}</TableCell>}
                      {sc.pf && <TableCell className="text-center px-0.5 py-1 text-xs">{sp.pf}</TableCell>}
                      {sc.pa && <TableCell className="text-center px-0.5 py-1 text-xs">{sp.pa}</TableCell>}
                      {sc.pd && <TableCell className="text-center px-0.5 py-1 text-xs font-medium">{formatSigned(sp.pf - sp.pa)}</TableCell>}
                    </>
                  ) : (
                    <>
                      {pc.gp && <TableCell className="text-center px-0.5 py-1 text-xs">{row.gp}</TableCell>}
                      {pc.w  && <TableCell className="text-center px-0.5 py-1 text-xs">{row.w}</TableCell>}
                      {pc.d  && <TableCell className="text-center px-0.5 py-1 text-xs">{row.d}</TableCell>}
                      {pc.l  && <TableCell className="text-center px-0.5 py-1 text-xs">{row.l}</TableCell>}
                      {pc.gf && <TableCell className="text-center px-0.5 py-1 text-xs">{formatSigned(row.gf)}</TableCell>}
                      {pc.ga && <TableCell className="text-center px-0.5 py-1 text-xs">{row.ga}</TableCell>}
                      {pc.gd && <TableCell className="text-center px-0.5 py-1 text-xs font-medium">{formatSigned(row.gd)}</TableCell>}
                    </>
                  )}
                  <TableCell className="text-center px-0.5 py-1 font-bold text-xs">
                    <div className="flex items-center justify-center gap-1">
                      {tableCanEdit && (
                        <button
                          type="button"
                          onClick={() => updateBonusPoints(groupId, row.team.id, -1)}
                          className="h-5 w-5 rounded flex items-center justify-center bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors flex-shrink-0"
                          aria-label="Punt aftrekken"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                      )}
                      <div className="flex flex-col items-center min-w-[1.5rem]">
                        {row.bonus !== 0 && (
                          <span className={`text-[9px] leading-none font-bold ${row.bonus > 0 ? "text-green-600 dark:text-green-400" : "text-destructive"}`}>
                            {row.bonus > 0 ? `+${row.bonus}` : row.bonus}
                          </span>
                        )}
                        <span>{row.pts}</span>
                      </div>
                      {tableCanEdit && (
                        <button
                          type="button"
                          onClick={() => updateBonusPoints(groupId, row.team.id, 1)}
                          className="h-5 w-5 rounded flex items-center justify-center bg-green-500/10 text-green-600 dark:text-green-400 hover:bg-green-500/20 transition-colors flex-shrink-0"
                          aria-label="Punt toevoegen"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        {phaseColors.length > 0 && (
          <div className="border-t border-border px-2 py-1 flex flex-wrap gap-2">
            {phaseColors.map(c => (
              <div key={c.id} className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: c.color }} />
                <span>{c.label || `Pos ${c.position_from}–${c.position_to}`}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // Render format progress bar
  const renderFormatProgress = (format: Phase) => {
    const formatMatches = matches.filter(m => m.phase_id === format.id);
    const playedCount = formatMatches.filter(m => m.is_played).length;
    const totalCount = formatMatches.length;
    const pct = totalCount > 0 ? (playedCount / totalCount) * 100 : 0;
    const isExpanded = expandedFormats.has(format.id);
    const formatGroups = groups.filter(g => g.phase_id === format.id);

    return (
      <div key={format.id} className="border border-border rounded-lg overflow-hidden">
        <button
          onClick={() => toggleFormat(format.id)}
          className="w-full px-4 py-3 flex items-center gap-3 bg-card hover:bg-secondary/50 transition-colors"
        >
          {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
          {format.logo_url && <img src={format.logo_url} alt="" className="h-5 w-5 object-contain rounded flex-shrink-0" />}
          <span className="font-medium text-sm text-foreground">{format.name}</span>
          <div className="flex-1 mx-2">
            <div className="h-2 bg-secondary rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${pct}%`,
                  backgroundColor: pct === 100 ? "hsl(var(--accent))" : "hsl(var(--primary))",
                }}
              />
            </div>
          </div>
          <span className="text-xs text-muted-foreground font-medium tabular-nums">{playedCount}/{totalCount}</span>
        </button>

        {isExpanded && (
          <div className="border-t border-border p-4 space-y-3">
            {(format.phase_type === "group" || format.phase_type === "round_robin") && (
              formatGroups.map(group => (
                <div key={group.id}>
                  {renderStandingsTable(group.id, format.id)}
                </div>
              ))
            )}
            {(format.phase_type === "knockout" || format.phase_type === "single_match") && (
              <BracketView
                tournamentId={tournamentId}
                phaseId={format.id}
                editable={false}
                scoreEditable={false}
                showRandomAssign={false}
                tournament={tournament}
                refreshKey={resultsRefreshKey}
              />
            )}
          </div>
        )}
      </div>
    );
  };

  // Render match card
  const renderMatchCard = (match: Match) => {
    const phase = phases.find(p => p.id === match.phase_id);
    const group = groups.find(g => g.id === match.group_id);
    const homeScore = match.home_score;
    const awayScore = match.away_score;
    const showPenalties = resolveMatchNeedsDecider(match);
    const needsPenaltiesFilled = showPenalties && (match.home_penalties === null || match.away_penalties === null || match.home_penalties === match.away_penalties);
    const homeName = getDisplayName(match, "home");
    const awayName = getDisplayName(match, "away");

    const headerLabel = phase?.name || "";
    const formatSuffix = getMatchFormatSuffix(match, scoringSystems as any, phases as any, groups as any);
    const baseMatchName = (match.match_name || "").replace(/\s+\((Heen|Terug)\)$/, "");
    const subLabel = group ? `${group.name}${formatSuffix}` : `${baseMatchName}${formatSuffix}`.trim();

    return (
      <div key={match.id} className="rounded-md border border-border/60 bg-card hover:border-border transition-colors">
        <div className="px-2 py-1.5 flex items-center gap-2">
          {/* Phase / group meta — compact left rail */}
          <div className="flex flex-col shrink-0 min-w-0 max-w-[6.5rem] gap-0">
            <div className="flex items-center gap-1 min-w-0">
              {phase?.logo_url && <img src={phase.logo_url} alt="" className="h-2.5 w-2.5 object-contain rounded flex-shrink-0" />}
              <span className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground truncate">{headerLabel}</span>
            </div>
            {subLabel && (
              <span className="text-[9px] text-muted-foreground/80 truncate leading-tight">{subLabel}</span>
            )}
            {(match.field || match.referee) && (
              <div className="flex items-center gap-1.5 mt-0.5">
                {match.field && (
                  <span className="text-[9px] text-muted-foreground flex items-center gap-0.5 truncate">
                    <MapPin className="h-2 w-2 shrink-0" />{formatFieldLabel(match.field)}
                  </span>
                )}
                {match.referee && (
                  <span className="text-[9px] text-muted-foreground flex items-center gap-0.5 truncate">
                    <WhistleIcon className="h-2 w-2 shrink-0" />{match.referee}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Teams + score */}
          <div className="flex-1 flex flex-col items-center gap-0 min-w-0">
            <div className="flex items-center justify-center gap-1.5 w-full">
              <div className="flex items-center gap-1 flex-1 justify-end min-w-0">
                <span className="font-medium text-foreground text-xs truncate">{homeName}</span>
                {teamLogo(match.home_team_id) && <img src={teamLogo(match.home_team_id)!} className="h-4 w-4 object-contain flex-shrink-0" />}
              </div>

              <button
                onClick={() => canEditMatch(match) && setScoreEntryMatchId(match.id)}
                className={`flex items-center gap-0.5 shrink-0 rounded border px-1.5 py-0.5 ${match.is_played ? 'border-primary' : 'border-input'} ${canEditMatch(match) ? "cursor-pointer hover:bg-secondary/50 transition-colors" : "cursor-default"}`}
              >
                <span className="h-5 w-7 flex items-center justify-center text-xs font-bold tabular-nums text-foreground">
                  {match.home_score ?? "–"}
                </span>
                <span className="text-xs font-bold text-muted-foreground">:</span>
                <span className="h-5 w-7 flex items-center justify-center text-xs font-bold tabular-nums text-foreground">
                  {match.away_score ?? "–"}
                </span>
              </button>

              <div className="flex items-center gap-1 flex-1 min-w-0">
                {teamLogo(match.away_team_id) && <img src={teamLogo(match.away_team_id)!} className="h-4 w-4 object-contain flex-shrink-0" />}
                <span className="font-medium text-foreground text-xs truncate">{awayName}</span>
              </div>
            </div>

            {showPenalties && match.home_penalties !== null && match.away_penalties !== null && (
              <div className="text-[9px] text-muted-foreground text-center leading-tight">
                ({match.home_penalties} - {match.away_penalties} pen.)
              </div>
            )}
            {showPenalties && needsPenaltiesFilled && (
              <p className="text-[9px] text-destructive text-center font-medium leading-tight">Vul de beslissende score in</p>
            )}
          </div>

          {/* Action icons */}
          <div className="flex items-center gap-1.5 shrink-0">
            {canAssignTeams(match) && (
              <button
                onClick={() => openAssignDialog(match)}
                className="text-muted-foreground hover:text-primary transition-colors"
                title="Teams wijzigen"
              >
                <Users className="h-3.5 w-3.5" />
              </button>
            )}

            {match.group_id && (phase?.phase_type === "group" || phase?.phase_type === "round_robin") && (
              <button
                onClick={() => setStandingsDialogGroupId(match.group_id)}
                className="text-muted-foreground hover:text-primary transition-colors"
                title="Stand bekijken"
              >
                <span
                  aria-label="Stand"
                  className="block h-3.5 w-3.5 bg-current"
                  style={{
                    WebkitMaskImage: `url(${rankingPodium})`,
                    maskImage: `url(${rankingPodium})`,
                    WebkitMaskRepeat: "no-repeat",
                    maskRepeat: "no-repeat",
                    WebkitMaskPosition: "center",
                    maskPosition: "center",
                    WebkitMaskSize: "contain",
                    maskSize: "contain",
                  }}
                />
              </button>
            )}
            {(phase?.phase_type === "knockout" || phase?.phase_type === "single_match") && (
              <button
                onClick={() => setBracketDialogFormatId(match.phase_id)}
                className="text-muted-foreground hover:text-primary transition-colors"
                title="Bracket bekijken"
              >
                <span
                  aria-label="Bracket"
                  className="block h-3.5 w-3.5 bg-current"
                  style={{
                    WebkitMaskImage: `url(${rankingPodium})`,
                    maskImage: `url(${rankingPodium})`,
                    WebkitMaskRepeat: "no-repeat",
                    maskRepeat: "no-repeat",
                    WebkitMaskPosition: "center",
                    maskPosition: "center",
                    WebkitMaskSize: "contain",
                    maskSize: "contain",
                  }}
                />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  if (loading) return <div className="flex justify-center py-8"><div className="h-6 w-6 animate-spin rounded-full border-2 border-foreground border-t-transparent" /></div>;

  // Find the group for standings dialog
  const standingsDialogGroup = standingsDialogGroupId ? groups.find(g => g.id === standingsDialogGroupId) : null;
  const standingsDialogFormat = standingsDialogGroup ? phases.find(p => p.id === standingsDialogGroup.phase_id) : null;
  const selectedFormatAction = selectedFormatActionId ? phases.find(p => p.id === selectedFormatActionId) : null;

  return (
    <div className="space-y-3 lg:h-[calc(100vh-8rem)] lg:overflow-hidden">
      <div className="flex h-full min-h-0 gap-3 lg:flex-row flex-col">
        {/* Format chips – left sidebar (sticky on desktop) */}
        {phaseNumbers.length > 0 && (
          <aside className="lg:w-56 lg:shrink-0 lg:h-full lg:overflow-y-auto lg:border-r lg:border-border lg:pr-2">
            {phaseNumbers.length > 1 && (
              <div className="mb-2 flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible pb-1 lg:pb-0">
                {phaseNumbers.map(phaseNumber => {
                  const isSelected = phaseNumber === selectedPhaseNumber;
                  return (
                    <button
                      key={phaseNumber}
                      type="button"
                      onClick={() => setSelectedPhaseNumber(phaseNumber)}
                      className={`shrink-0 lg:w-full rounded-md border px-2 py-1 text-[10px] font-semibold uppercase transition-colors text-left ${
                        isSelected
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-card text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {getPhaseLabel(phaseNumber, phases)}
                    </button>
                  );
                })}
              </div>
            )}
            <div className="flex lg:flex-col gap-1.5 overflow-x-auto lg:overflow-visible pb-1 lg:pb-0">
              {currentPhaseFormats.map(format => {
                const formatMatches = matches.filter(m => m.phase_id === format.id);
                const playedCount = formatMatches.filter(m => m.is_played).length;
                const totalCount = formatMatches.length;
                const allMatchesPlayed = totalCount > 0 && playedCount === totalCount;
                const pct = totalCount > 0 ? (playedCount / totalCount) * 100 : 0;
                const phaseLabel = getPhaseLabel(format.phase_number, phases);

                return (
                  <div key={format.id} className="min-w-[9rem] lg:min-w-0 lg:w-full max-w-[12rem] lg:max-w-none rounded-md border border-border bg-card px-2 py-1.5 text-left">
                    <button
                      type="button"
                      onClick={() => setExpandedFormats(new Set([format.id]))}
                      className="w-full text-left hover:text-primary transition-colors"
                    >
                      <div className="flex min-w-0 items-center gap-1.5">
                        {format.logo_url && <img src={format.logo_url} alt="" className="h-3 w-3 object-contain flex-shrink-0" />}
                        <span className="min-w-0 flex-1 truncate text-[10px] font-semibold text-foreground">{phaseLabel} · {format.name}</span>
                      </div>
                      <div className="mt-1 h-0.5 bg-secondary rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{
                            width: `${pct}%`,
                            backgroundColor: format.match_config?.phaseCompleted ? "hsl(var(--accent))" : "hsl(var(--primary))",
                          }}
                        />
                      </div>
                      <div className="mt-1 flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
                        <span className="tabular-nums">{playedCount}/{totalCount}</span>
                        {format.match_config?.phaseCompleted && <span className="font-semibold text-accent">Voltooid</span>}
                      </div>
                    </button>
                    {(format.match_config?.phaseCompleted || allMatchesPlayed) && <div className="mt-1.5 border-t border-border pt-1.5">
                      {format.match_config?.phaseCompleted ? (
                        <Button size="sm" variant="destructive" className="h-6 w-full px-1.5 text-[9px]" onClick={() => requestUndoFormat(format)}>
                          <RotateCcw className="h-3 w-3" /> Ongedaan
                        </Button>
                      ) : (
                        <Button size="sm" className="h-6 w-full px-1.5 text-[9px]" onClick={() => requestCompleteFormat(format, { confirmIncomplete: true })} disabled={!canEditFormat(format)}>
                          <CheckCircle2 className="h-3 w-3" /> Voltooien
                        </Button>
                      )}
                    </div>}
                  </div>
                );
              })}
            </div>
          </aside>
        )}

        <div className="min-h-0 min-w-0 space-y-4 lg:flex-1 lg:overflow-y-auto lg:pr-2">

      {/* Format detail dialog */}
      {(() => {
        const openFormatId = [...expandedFormats][0] ?? null;
        const openFormat = openFormatId ? phases.find(p => p.id === openFormatId) : null;
        const formatGroups = openFormat ? groups.filter(g => g.phase_id === openFormat.id) : [];
        return (
          <Dialog open={!!openFormat} onOpenChange={(open) => { if (!open) setExpandedFormats(new Set()); }}>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{openFormat?.name || ""}</DialogTitle>
              </DialogHeader>
              {openFormat && (openFormat.phase_type === "group" || openFormat.phase_type === "round_robin") && (
                <div className="space-y-3">
                  {formatGroups.map(group => (
                    <div key={group.id}>
                      {renderStandingsTable(group.id, openFormat.id)}
                    </div>
                  ))}
                </div>
              )}
              {openFormat && (openFormat.phase_type === "knockout" || openFormat.phase_type === "single_match") && (
                <BracketView
                  tournamentId={tournamentId}
                  phaseId={openFormat.id}
                  editable={false}
                  scoreEditable={false}
                  showRandomAssign={false}
                  tournament={tournament}
                  refreshKey={resultsRefreshKey}
                />
              )}
              {openFormat && (
                <div className="flex justify-end gap-2 border-t border-border pt-4">
                  {openFormat.match_config?.phaseCompleted ? (
                    <Button size="sm" variant="outline" onClick={() => requestUndoFormat(openFormat)}>
                      <RotateCcw className="h-3.5 w-3.5" /> Ongedaan maken
                    </Button>
                  ) : (
                    <Button size="sm" onClick={() => requestCompleteFormat(openFormat, { confirmIncomplete: true })} disabled={!canEditFormat(openFormat)}>
                      <CheckCircle2 className="h-3.5 w-3.5" /> Format voltooien
                    </Button>
                  )}
                </div>
              )}
            </DialogContent>
          </Dialog>
        );
      })()}

          {/* All matches chronologically — grouped by Day → Time slot (across all phases) */}
          {allPhaseMatches.length > 0 && (
            <div className="space-y-5">
              {dayGroups.map(day => {
                const dayPlayed = day.slots.reduce((acc, s) => acc + s.matches.filter(m => m.is_played).length, 0);
                const dayTotal = day.slots.reduce((acc, s) => acc + s.matches.length, 0);
                return (
                  <section key={day.key} className="space-y-2">
                    {/* Day header */}
                    <div className="sticky top-0 z-10 -mx-1 flex items-center gap-3 bg-background/95 px-1 py-1.5 backdrop-blur supports-[backdrop-filter]:bg-background/70">
                      <span className="text-xs font-black uppercase tracking-[0.18em] text-foreground">
                        {day.label}
                      </span>
                      <div className="h-px flex-1 bg-border" />
                      <span className="text-[10px] font-semibold tabular-nums text-muted-foreground">
                        {dayPlayed}/{dayTotal} gespeeld
                      </span>
                    </div>

                    {/* Time slots */}
                    <div className="space-y-2">
                      {day.slots.map(slot => {
                        const collapsed = collapsedTimeSlots.has(slot.key);
                        const slotPlayed = slot.matches.filter(m => m.is_played).length;
                        const slotTotal = slot.matches.length;
                        const allPlayed = slotTotal > 0 && slotPlayed === slotTotal;
                        
                        return (
                          <div key={slot.key} className="rounded-lg border border-border bg-card/40 overflow-hidden">
                            <button
                              type="button"
                              onClick={() => toggleTimeSlot(slot.key)}
                              className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-secondary/40 transition-colors"
                            >
                              {collapsed
                                ? <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                              {slot.time && (
                                <span className="text-base font-bold tabular-nums text-foreground shrink-0">
                                  {slot.time}
                                </span>
                              )}
                              {!slot.time && (
                                <span className="text-sm font-bold text-muted-foreground shrink-0">{day.label === "Ongepland" ? "" : day.label}</span>
                              )}
                              
                              <div className="h-px flex-1 bg-border/60" />
                              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums ${
                                allPlayed
                                  ? "bg-accent/15 text-accent"
                                  : slotPlayed > 0
                                    ? "bg-primary/10 text-primary"
                                    : "bg-secondary text-muted-foreground"
                              }`}>
                                {slotPlayed}/{slotTotal}
                              </span>
                            </button>

                            {!collapsed && (
                              <div className="border-t border-border/60 p-2 space-y-1.5 bg-background/40">
                                {slot.matches.map(match => renderMatchCard(match))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
            </div>
          )}

          {currentPhaseFormats.length === 0 && (
            <div className="rounded-xl border border-dashed border-border py-12 text-center">
              <p className="text-muted-foreground">Geen formats in deze fase. Voeg formats toe via "Fases & Indeling".</p>
            </div>
          )}

          {allPhaseMatches.length === 0 && currentPhaseFormats.length > 0 && (
            <div className="rounded-xl border border-dashed border-border py-8 text-center">
              <p className="text-muted-foreground text-sm">Geen geplande wedstrijden in het Schema.</p>
            </div>
          )}
        </div>
      </div>

      {/* Incomplete format confirmation */}
      <AlertDialog
        open={phaseActionDialog === "format-incomplete"}
        onOpenChange={(open) => { if (!open) { setPhaseActionDialog(null); setSelectedFormatActionId(null); } }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{selectedFormatAction?.name ?? "Format"} voltooien met open wedstrijden?</AlertDialogTitle>
            <AlertDialogDescription>
              Nog niet alle wedstrijden in dit format zijn gespeeld. Weet je zeker dat je dit format toch wilt voltooien en wilt laten doorstromen?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                setPhaseActionDialog("format-complete");
              }}
            >
              Ja, ga verder
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Complete format preview */}
      <Dialog
        open={phaseActionDialog === "format-complete"}
        onOpenChange={(open) => { if (!open) { setPhaseActionDialog(null); setSelectedFormatActionId(null); setConfirmedLotsGroups(new Set()); } }}
      >
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Format voltooien</DialogTitle>
            <DialogDescription>
              Alleen dit format wordt vergrendeld en doorgestuurd naar gekoppelde plekken in de volgende fase. Andere formats in dezelfde fase blijven bewerkbaar.
            </DialogDescription>
          </DialogHeader>
          {completePreview ? (
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1.05fr)_minmax(300px,0.95fr)]">
              <div className="space-y-4 min-w-0">
                <h3 className="font-display text-sm font-bold text-foreground">{completePreview.selectedFormat.name}</h3>
                {(() => {
                  const tieGroups = completePreview.formatPreviews
                    .flatMap(({ groupPreviews }) => groupPreviews.map(({ group }) => group))
                    .filter(group => calcStandings(group.id).some(r => r.needsDrawingLots));
                  if (tieGroups.length === 0) return null;
                  const allConfirmed = tieGroups.every(g => confirmedLotsGroups.has(g.id));
                  return (
                    <div className={cn(
                      "rounded-lg border p-3 space-y-2",
                      allConfirmed
                        ? "border-green-500/50 bg-green-500/10"
                        : "border-amber-500/50 bg-amber-500/10"
                    )}>
                      <p className={cn(
                        "text-xs font-bold uppercase tracking-wide",
                        allConfirmed ? "text-green-700 dark:text-green-400" : "text-amber-700 dark:text-amber-400"
                      )}>Loting vereist</p>
                      <p className="text-xs text-foreground">
                        In {tieGroups.map(g => g.name).join(", ")} zijn alle criteria voor gelijke punten identiek. Bepaal de volgorde handmatig voor de betrokken teams.
                      </p>
                      <div className="flex flex-wrap gap-2 pt-1">
                        {tieGroups.map(g => {
                          const confirmed = confirmedLotsGroups.has(g.id);
                          return (
                            <Button
                              key={g.id}
                              variant="outline"
                              size="sm"
                              className={cn(
                                "h-7 text-xs",
                                confirmed
                                  ? "border-green-500/50 text-green-700 dark:text-green-400 hover:bg-green-500/20"
                                  : "border-amber-500/50 text-amber-700 dark:text-amber-400 hover:bg-amber-500/20"
                              )}
                              onClick={() => setLotsDialogGroupId(g.id)}
                            >
                              <ListOrdered className="h-3 w-3 mr-1" /> {g.name}: {confirmed ? "volgorde wijzigen" : "volgorde bepalen"}
                            </Button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

                {completePreview.formatPreviews.length > 0 ? (
                  completePreview.formatPreviews.map(({ format, groupPreviews }) => (
                    <div key={format.id} className="space-y-3">
                      {groupPreviews.map(({ group }) => (
                        <div key={group.id}>{renderStandingsTable(group.id, format.id, true)}</div>
                      ))}
                    </div>
                  ))
                ) : completePreview.selectedFormat.phase_type === "knockout" || completePreview.selectedFormat.phase_type === "single_match" ? (
                  <BracketView
                    tournamentId={tournamentId}
                    phaseId={completePreview.selectedFormat.id}
                    editable={false}
                    scoreEditable={false}
                    showRandomAssign={false}
                    tournament={tournament}
                    refreshKey={resultsRefreshKey}
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">Geen stand beschikbaar voor dit format.</p>
                )}
              </div>

              <aside className="space-y-3 rounded-lg border border-border bg-muted/20 p-3 min-w-0">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Doorstroming</p>
                  <h3 className="font-display text-sm font-bold text-foreground">Nieuwe groepen of wedstrijden</h3>
                </div>
                {completePreview.nextFormatPreviews.length > 0 ? (
                  completePreview.nextFormatPreviews.map(({ format, slots: nextSlots, matchPreviews }) => (
                    <div key={format.id} className="rounded-lg border border-border bg-background/70 p-3 space-y-2">
                      <p className="text-xs font-semibold text-foreground">{format.name}</p>
                      {matchPreviews.length > 0 && (format.phase_type === "knockout" || format.phase_type === "single_match") ? (
                        <ul className="space-y-1.5">
                          {matchPreviews.map(({ match, homeName, awayName }) => (
                            <li key={match.id} className="rounded-md border border-border bg-card px-2 py-1.5 text-xs">
                              <span className="block font-medium text-foreground">{match.match_name || "Wedstrijd"}</span>
                              <span className="text-muted-foreground">{homeName} - {awayName}</span>
                            </li>
                          ))}
                        </ul>
                      ) : nextSlots.length > 0 ? (
                        <ul className="space-y-1.5">
                          {nextSlots.filter(slot => slot.team).map((slot) => (
                            <li key={slot.id} className="flex items-center justify-between gap-2 text-xs">
                              <span className="min-w-0 text-muted-foreground">{groups.find(group => group.id === slot.group_id)?.name ?? format.name}</span>
                              <span className="truncate font-medium text-foreground">{slot.team?.name ?? "—"}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-xs text-muted-foreground">Geen gekoppelde plekken gevonden.</p>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground">Geen volgende fase gevonden.</p>
                )}
              </aside>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">De stand wordt vastgezet en beschikbare posities worden doorgestuurd.</p>
          )}
          <div className="flex justify-end gap-2 pt-4 border-t border-border">
            <Button variant="outline" onClick={() => { setPhaseActionDialog(null); setSelectedFormatActionId(null); }}>
              Annuleren
            </Button>
            <Button className="bg-accent text-accent-foreground hover:bg-accent/90" onClick={() => { void completeSelectedFormat(); }}>
              <CheckCircle2 className="h-4 w-4" /> Ja, format voltooien
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Loting bepalen: sub-popup bovenop de voltooiingspopup */}
      <Dialog
        open={lotsDialogGroupId !== null}
        onOpenChange={(open) => { if (!open) setLotsDialogGroupId(null); }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Loting bepalen — {groups.find(g => g.id === lotsDialogGroupId)?.name ?? ""}</DialogTitle>
            <DialogDescription>
              Deze teams zijn volledig gelijk geëindigd. Bepaal handmatig de eindvolgorde met de pijltjes.
            </DialogDescription>
          </DialogHeader>
          {lotsDialogGroupId && (() => {
            const standings = calcStandings(lotsDialogGroupId);
            const tied = standings.filter(s => s.needsDrawingLots);
            if (tied.length === 0) {
              return <p className="text-sm text-muted-foreground">Er zijn geen teams meer die een loting vereisen in deze groep.</p>;
            }
            return (
              <ul className="space-y-2">
                {tied.map((row) => {
                  const idx = standings.findIndex(s => s.team.id === row.team.id);
                  const canUp = idx > 0 && !!standings[idx - 1]?.needsDrawingLots;
                  const canDown = idx < standings.length - 1 && !!standings[idx + 1]?.needsDrawingLots;
                  return (
                    <li key={row.team.id} className="flex items-center justify-between gap-3 rounded-md border border-border bg-card px-3 py-2">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded bg-muted text-xs font-bold text-foreground">
                          {row.pos}
                        </span>
                        <img
                          src={row.team.logo_url || "/placeholder.svg"}
                          alt=""
                          className="h-8 w-8 object-contain flex-shrink-0"
                        />
                        <span className="truncate font-medium text-foreground text-sm">{row.team.name}</span>
                        {tournament?.show_country && row.team.country && (
                          <CountryFlag country={row.team.country} className="h-4 w-5 object-contain flex-shrink-0" />
                        )}
                      </div>
                      <div className="flex flex-col flex-shrink-0 -my-1">
                        <button
                          type="button"
                          aria-label="Omhoog verplaatsen"
                          className="hover:text-foreground text-muted-foreground disabled:opacity-30 disabled:pointer-events-none leading-none"
                          disabled={!canUp}
                          onClick={() => moveDrawingLotsTeam(lotsDialogGroupId, row.team.id, -1)}
                        >
                          <ChevronUp className="!h-4 !w-4" />
                        </button>
                        <button
                          type="button"
                          aria-label="Omlaag verplaatsen"
                          className="hover:text-foreground text-muted-foreground disabled:opacity-30 disabled:pointer-events-none leading-none"
                          disabled={!canDown}
                          onClick={() => moveDrawingLotsTeam(lotsDialogGroupId, row.team.id, 1)}
                        >
                          <ChevronDown className="!h-4 !w-4" />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            );
          })()}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                if (lotsDialogGroupId) {
                  setConfirmedLotsGroups(prev => new Set(prev).add(lotsDialogGroupId));
                }
                setLotsDialogGroupId(null);
              }}
            >
              Klaar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Undo format AlertDialog */}
      <AlertDialog
        open={phaseActionDialog === "format-undo"}
        onOpenChange={(open) => { if (!open) { setPhaseActionDialog(null); setSelectedFormatActionId(null); } }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{selectedFormatAction?.name ?? "Format"} ongedaan maken?</AlertDialogTitle>
            <AlertDialogDescription>
              Alleen de doorgestroomde plekken die aan dit format gekoppeld zijn worden leeggemaakt. Andere formats en ingevulde plekken blijven behouden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction onClick={() => { void undoSelectedFormat(); }}>
              Ja, maak format ongedaan
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Standings Dialog */}
      <Dialog open={!!standingsDialogGroupId} onOpenChange={(open) => { if (!open) setStandingsDialogGroupId(null); }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{standingsDialogGroup?.name || "Stand"}</DialogTitle>
          </DialogHeader>
          {standingsDialogGroup && standingsDialogFormat && (
            renderStandingsTable(standingsDialogGroup.id, standingsDialogFormat.id)
          )}
        </DialogContent>
      </Dialog>

      {/* Bracket Dialog for knockout/single_match */}
      {(() => {
        const bracketFormat = bracketDialogFormatId ? phases.find(p => p.id === bracketDialogFormatId) : null;
        return (
          <Dialog open={!!bracketDialogFormatId} onOpenChange={(open) => { if (!open) setBracketDialogFormatId(null); }}>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{bracketFormat?.name || "Bracket"}</DialogTitle>
              </DialogHeader>
              {bracketFormat && (
                <BracketView
                  tournamentId={tournamentId}
                  phaseId={bracketFormat.id}
                  editable={false}
                  scoreEditable={false}
                  showRandomAssign={false}
                  tournament={tournament}
                  refreshKey={resultsRefreshKey}
                />
              )}
            </DialogContent>
          </Dialog>
        );
      })()}

      {/* Stats dialog */}
      {hasAnyStats && (() => {
        const sm = selectedStatsMatchId ? matches.find(m => m.id === selectedStatsMatchId) : null;
        const smPhase = sm ? phases.find(p => p.id === sm.phase_id) : null;
        const smGroup = sm ? groups.find(g => g.id === sm.group_id) : null;
        return (
          <MatchDetailDialog
            open={!!sm}
            onClose={() => setSelectedStatsMatchId(null)}
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
              format_name: smPhase?.name || null,
              group_name: smGroup?.name || null,
              round_number: sm.round_number,
            } : null}
            tournament={tournament}
            teams={teams}
            scoreEditable={true}
          />
        );
      })()}

      {/* Score Entry Dialog */}
      {(() => {
        const sem = scoreEntryMatchId ? matches.find(m => m.id === scoreEntryMatchId) : null;
        if (!sem) return null;
        const sys = resolveScoringSystem(sem);
        const scoringType: "points" | "sets" = sys?.scoring_type === "sets" ? "sets" : "points";
        const numSets = sys?.num_sets ?? 1;
        const homeName = getDisplayName(sem, "home");
        const awayName = getDisplayName(sem, "away");

        // H&A detectie: gepaarde Heen/Terug-wedstrijd in dezelfde groep
        const haMatch = sem.match_name?.match(/^(.+)\s+\((Heen|Terug)\)$/);
        const isHALeg = !!haMatch;
        const baseName = haMatch?.[1] || null;
        const currentLegLabel = haMatch?.[2] || "";
        const currentIsHeen = currentLegLabel === "Heen";
        const pairedName = baseName ? `${baseName} (${currentIsHeen ? "Terug" : "Heen"})` : null;
        const pairedMatch = pairedName
          ? matches.find(m => m.match_name === pairedName && m.group_id === sem.group_id) || null
          : null;
        // De beslissende score (penalty's) staat altijd op de Terug-wedstrijd.
        const terugMatch = isHALeg ? (currentIsHeen ? pairedMatch : sem) : null;

        // Voor H&A leggen we 'pairedHomeScore/pairedAwayScore' uit in oriëntatie
        // van de HUIDIGE wedstrijd. In een H&A reeks wisselen home/away tussen legs,
        // dus de partner-wedstrijds home_score telt mee als away voor deze leg.
        let aggregateProp: any = null;
        if (isHALeg && pairedMatch) {
          const pairedPlayed = pairedMatch.home_score !== null && pairedMatch.away_score !== null;
          aggregateProp = {
            currentLegLabel,
            pairedLegLabel: currentIsHeen ? "Terug" : "Heen",
            pairedPlayed,
            // Wissel: paired.away → current home, paired.home → current away
            pairedHomeScore: pairedPlayed ? pairedMatch.away_score : null,
            pairedAwayScore: pairedPlayed ? pairedMatch.home_score : null,
            storedHomePenalties: terugMatch?.home_penalties ?? null,
            storedAwayPenalties: terugMatch?.away_penalties ?? null,
            currentIsCarrier: !currentIsHeen,
          };
        }

        // Voor H&A: needsPenalties altijd true in knockout/single_match (zodra aggregate tied is)
        const phase = phases.find(p => p.id === sem.phase_id);
        const isKnockoutLike = phase?.phase_type === "knockout" || phase?.phase_type === "single_match";
        const needsPen = isHALeg && isKnockoutLike ? true : matchAllowsDecider(sem);

        return (
          <ScoreEntryDialog
            open={true}
            onClose={() => setScoreEntryMatchId(null)}
            match={{
              id: sem.id,
              home_team_id: sem.home_team_id,
              away_team_id: sem.away_team_id,
              home_score: sem.home_score,
              away_score: sem.away_score,
              home_penalties: sem.home_penalties,
              away_penalties: sem.away_penalties,
              set_scores: sem.set_scores ?? null,
            }}
            homeName={homeName}
            awayName={awayName}
            homeLogo={teamLogo(sem.home_team_id)}
            awayLogo={teamLogo(sem.away_team_id)}
            scoringType={scoringType}
            numSets={numSets}
            needsPenalties={needsPen}
            editable={canEditMatch(sem)}
            hasStatsEnabled={
              hasAnyStats && !!sem.home_team_id && !!sem.away_team_id
            }
            tournament={tournament}
            aggregate={aggregateProp}
            onSave={async (data) => {
              // Update de huidige leg (zonder penalties bij H&A — die horen op de Terug-match)
              const updatedMatch: Match = {
                ...sem,
                home_score: data.homeScore,
                away_score: data.awayScore,
                home_penalties: isHALeg ? sem.home_penalties : data.homePenalties,
                away_penalties: isHALeg ? sem.away_penalties : data.awayPenalties,
                set_scores: data.setScores,
              };

              // H&A: penalties horen op de Terug-match (in Terug-oriëntatie)
              let updatedCarrier: Match | null = null;
              if (isHALeg && terugMatch) {
                const swap = currentIsHeen;
                const carrierHomePen = swap ? data.awayPenalties : data.homePenalties;
                const carrierAwayPen = swap ? data.homePenalties : data.awayPenalties;
                const carrierBase = terugMatch.id === sem.id ? updatedMatch : terugMatch;
                if (
                  carrierHomePen !== carrierBase.home_penalties ||
                  carrierAwayPen !== carrierBase.away_penalties
                ) {
                  updatedCarrier = {
                    ...carrierBase,
                    home_penalties: carrierHomePen,
                    away_penalties: carrierAwayPen,
                  };
                }
              }
              if (updatedCarrier && updatedCarrier.id === sem.id) {
                updatedMatch.home_penalties = updatedCarrier.home_penalties;
                updatedMatch.away_penalties = updatedCarrier.away_penalties;
                updatedCarrier = null;
              }

              // Werk alle betrokken wedstrijden in één keer bij, zodat de
              // winnaarbepaling meteen de nieuwe scores én penalties ziet.
              const nextList = matches.map(m => {
                if (m.id === updatedMatch.id) return updatedMatch;
                if (updatedCarrier && m.id === updatedCarrier.id) return updatedCarrier;
                return m;
              });
              setMatches(nextList);

              let listAfter = nextList;
              if (updatedCarrier) {
                listAfter = (await saveScore(updatedCarrier, listAfter)) ?? listAfter;
              }
              await saveScore(updatedMatch, listAfter);
            }}
          />
        );
      })()}

      {/* Teams wijzigen aan een wedstrijd */}
      <Dialog open={!!assigningMatchId} onOpenChange={(open) => { if (!open) setAssigningMatchId(null); }}>
        <DialogContent ref={assignMatchDialogRef} className="max-w-md">
          <DialogHeader>
            <DialogTitle>Teams wijzigen</DialogTitle>
            <DialogDescription>Kies het thuis- en uitteam voor deze wedstrijd. Datum, uur, veld en scheidsrechter pas je aan in het Schema-tabblad.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Thuis</Label>
              <Select
                value={assignDraft.homeTeamId || "__none__"}
                onValueChange={(v) => setAssignDraft(d => ({ ...d, homeTeamId: v === "__none__" ? "" : v }))}
              >
                <SelectTrigger className="h-9"><SelectValue placeholder="Kies team" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Geen team</SelectItem>
                  {teams.map(team => (
                    <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Uit</Label>
              <Select
                value={assignDraft.awayTeamId || "__none__"}
                onValueChange={(v) => setAssignDraft(d => ({ ...d, awayTeamId: v === "__none__" ? "" : v }))}
              >
                <SelectTrigger className="h-9"><SelectValue placeholder="Kies team" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Geen team</SelectItem>
                  {teams.map(team => (
                    <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssigningMatchId(null)}>Annuleren</Button>
            <Button onClick={saveAssign} disabled={savingAssign}>Opslaan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>

  );
};

export default ResultsManager;
