import { useState, useEffect, useRef } from "react";
import { getPhaseLabel } from "@/lib/phaseLabel";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useDialogFocus } from "@/hooks/useDialogFocus";
import { Plus, ArrowUp, ArrowDown, Trash2, Info, Pencil, ChevronRight, ArrowLeft, Grid3X3, Trophy, Swords, ListOrdered } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import FormatCard from "./FormatCard";
import { SortableVerticalList, SortableRowShell } from "@/components/SortableList";
import ScoringSystemSelector from "./ScoringSystemSelector";
import { useScoringSystems } from "@/hooks/useScoringSystems";
import { generateRoundRobin } from "@/lib/matchGenerator";

const formatTypeLabel = (t: string) =>
  t === "group" ? "Groepsfase" : t === "knockout" ? "Knock-outfase" : t === "single_match" ? "Losse wedstrijd" : "Round Robin";

const formatIcon = (t: string) => {
  const cls = "h-4 w-4";
  if (t === "group") return <Grid3X3 className={cls} />;
  if (t === "knockout") return <Trophy className={cls} />;
  if (t === "single_match") return <Swords className={cls} />;
  return <ListOrdered className={cls} />;
};

interface Phase {
  id: string;
  name: string;
  phase_number: number;
  phase_type: string;
  sort_order: number;
  category_id?: string | null;
  emoji?: string | null;
  logo_url?: string | null;
  match_config?: Record<string, any> | null;
}

interface PhaseContainer {
  phaseNumber: number;
  formats: Phase[];
}

const PhaseManager = ({ tournamentId, tournamentType, categoryId }: { tournamentId: string; tournamentType: string; categoryId?: string | null }) => {
  const isMobile = useIsMobile();
  const [openFormatId, setOpenFormatId] = useState<string | null>(null);
  const [mobilePhaseOverview, setMobilePhaseOverview] = useState(true);
  const [allFormats, setAllFormats] = useState<Phase[]>([]);
  const [loading, setLoading] = useState(true);
  const [creatingFormat, setCreatingFormat] = useState(false);
  const prevCategoryRef = useRef(categoryId);
  const [showAddFormat, setShowAddFormat] = useState<number | null>(null);
  const [newFormatType, setNewFormatType] = useState("group");
  const [groupConfig, setGroupConfig] = useState({ groupCount: 2, teamsPerGroup: 4, matchType: "single_leg" as "single_leg" | "home_away" | "multiple" | "rounds", rounds: 3, encounters: 3 });

  const [bracketConfig, setBracketConfig] = useState({ teamCount: 4, matchType: "single_leg" as "single_leg" | "home_away", startPosition: 1, hasPlacement: false });
  const [singleMatchConfig, setSingleMatchConfig] = useState({ matchCount: 1, matchType: "single_leg" as "single_leg" | "home_away", startPosition: 1, hasPlacement: false });
  const [matchGenMode, setMatchGenMode] = useState<"auto" | "empty">("auto");
  const [newFormatName, setNewFormatName] = useState("");
  const [deletePhaseNumber, setDeletePhaseNumber] = useState<number | null>(null);
  const [slotRefreshKey, setSlotRefreshKey] = useState(0);
  const [newlyCreatedId, setNewlyCreatedId] = useState<string | null>(null);
  useEffect(() => { if (isMobile && newlyCreatedId) setOpenFormatId(newlyCreatedId); }, [isMobile, newlyCreatedId]);
  const [editPhaseNumber, setEditPhaseNumber] = useState<number | null>(null);
  const [editPhaseLabel, setEditPhaseLabel] = useState("");
  const addFormatDialogRef = useDialogFocus(showAddFormat !== null);
  const editPhaseDialogRef = useDialogFocus(editPhaseNumber !== null);
  /** Labels voor fases die (nog) geen formats hebben; worden toegepast bij het eerste format. */
  const [pendingPhaseLabels, setPendingPhaseLabels] = useState<Record<number, string>>({});
  const [savingPhaseEdit, setSavingPhaseEdit] = useState(false);
  const [activePhaseNumber, setActivePhaseNumber] = useState<number | null>(null);
  const [draftPhaseNumbers, setDraftPhaseNumbers] = useState<number[]>([]);
  const [newFormatScoringSystemId, setNewFormatScoringSystemId] = useState<string | null>(null);
  const { toast } = useToast();
  const { systems: scoringSystems, refetch: refetchScoringSystems } = useScoringSystems(tournamentId);

  useEffect(() => { fetchFormats(); }, [tournamentId, categoryId]);

  // Reset dialog state when it opens; fetch fresh data once per open
  useEffect(() => {
    if (showAddFormat === null) return;

    fetchFormats();
    refetchScoringSystems();
    setBracketConfig({ teamCount: 4, matchType: "single_leg", startPosition: 1, hasPlacement: false });
    setSingleMatchConfig({ matchCount: 1, matchType: "single_leg", startPosition: 1, hasPlacement: false });
    setNewFormatType("group");
    setNewFormatName("");
  }, [showAddFormat]);

  // When scoring systems load, pick the first one if none selected yet
  useEffect(() => {
    if (showAddFormat === null) return;
    if (newFormatScoringSystemId) return;

    const sorted = [...scoringSystems].sort((a, b) => a.sort_order - b.sort_order);
    setNewFormatScoringSystemId(sorted[0]?.id ?? null);
  }, [showAddFormat, scoringSystems, newFormatScoringSystemId]);

  // Reset format cards when category changes (handled by key prop on PhaseManager)
  useEffect(() => {
    prevCategoryRef.current = categoryId;
  }, [categoryId]);

  const fetchFormats = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("tournament_phases")
        .select("*")
        .eq("tournament_id", tournamentId)
        .order("phase_number")
        .order("sort_order");
      if (error) {
        console.error("fetchFormats error:", error);
        toast({ title: "Fout bij laden fases", description: error.message, variant: "destructive" });
        setLoading(false);
        return;
      }

      const nextFormats = (data || []).filter((format) => {
        if (!categoryId) return true;
        return format.category_id === categoryId || format.category_id === null;
      });

      setAllFormats((nextFormats || []) as Phase[]);
    } catch (err) {
      console.error("fetchFormats exception:", err);
    }
    setLoading(false);
  };

  const openPhaseEdit = (phaseNumber: number) => {
    const firstFormat = allFormats.find(f => f.phase_number === phaseNumber);
    const existingLabel = firstFormat?.match_config?.phaseLabel;
    setEditPhaseLabel(
      typeof existingLabel === "string" && existingLabel
        ? existingLabel
        : (pendingPhaseLabels[phaseNumber] ?? "")
    );
    setEditPhaseNumber(phaseNumber);
  };

  const savePhaseEdit = async () => {
    if (editPhaseNumber === null) return;
    setSavingPhaseEdit(true);

    const trimmedLabel = editPhaseLabel.trim();
    const phaseNumber = editPhaseNumber;
    const phaseFormats = allFormats.filter(f => f.phase_number === phaseNumber);

    // Fase zonder formats: bewaar de naam lokaal en pas hem toe op het eerste format.
    if (phaseFormats.length === 0) {
      setPendingPhaseLabels(prev => {
        const next = { ...prev };
        if (trimmedLabel) next[phaseNumber] = trimmedLabel;
        else delete next[phaseNumber];
        return next;
      });
      setSavingPhaseEdit(false);
      setEditPhaseNumber(null);
      toast({
        title: "Naam ingesteld",
        description: "De naam wordt opgeslagen zodra je een format toevoegt aan deze fase.",
      });
      return;
    }

    for (const phaseFormat of phaseFormats) {
      const nextMatchConfig = { ...(phaseFormat.match_config ?? {}) } as Record<string, any>;

      if (trimmedLabel) nextMatchConfig.phaseLabel = trimmedLabel;
      else delete nextMatchConfig.phaseLabel;

      const { error: updateErr } = await supabase
        .from("tournament_phases")
        .update({ match_config: nextMatchConfig } as any)
        .eq("id", phaseFormat.id);

      if (updateErr) {
        console.error("Phase update error:", updateErr);
        toast({ title: "Opslaan mislukt", description: updateErr.message, variant: "destructive" });
        setSavingPhaseEdit(false);
        return;
      }
    }

    setAllFormats(prev => prev.map(f => {
      if (f.phase_number !== phaseNumber) return f;
      const nextMatchConfig = { ...(f.match_config ?? {}) } as Record<string, any>;
      if (trimmedLabel) nextMatchConfig.phaseLabel = trimmedLabel;
      else delete nextMatchConfig.phaseLabel;
      return { ...f, match_config: nextMatchConfig };
    }));

    setPendingPhaseLabels(prev => {
      if (!(phaseNumber in prev)) return prev;
      const next = { ...prev };
      delete next[phaseNumber];
      return next;
    });

    setSavingPhaseEdit(false);
    setEditPhaseNumber(null);
    toast({ title: "Fasenaam opgeslagen" });
  };

  const getErrorMessage = (error: unknown, fallback: string) => {
    if (error instanceof Error && error.message) return error.message;
    if (typeof error === "object" && error !== null && "message" in error && typeof (error as { message?: unknown }).message === "string") {
      return (error as { message: string }).message;
    }
    return fallback;
  };

  const containers: PhaseContainer[] = [];
  const seen = new Set<number>();
  allFormats.forEach((f) => {
    if (!seen.has(f.phase_number)) {
      seen.add(f.phase_number);
      containers.push({
        phaseNumber: f.phase_number,
        formats: allFormats.filter((x) => x.phase_number === f.phase_number),
      });
    }
  });

  // Add draft (empty) phases to containers if they don't already exist via formats
  draftPhaseNumbers.forEach((dp) => {
    if (!seen.has(dp)) {
      seen.add(dp);
      containers.push({ phaseNumber: dp, formats: [] });
    }
  });
  containers.sort((a, b) => a.phaseNumber - b.phaseNumber);

  // Drop drafts once they have actual formats (saved to DB)
  useEffect(() => {
    if (draftPhaseNumbers.length === 0) return;
    const remaining = draftPhaseNumbers.filter(
      (dp) => !allFormats.some((f) => f.phase_number === dp)
    );
    if (remaining.length !== draftPhaseNumbers.length) {
      setDraftPhaseNumbers(remaining);
    }
  }, [allFormats, draftPhaseNumbers]);

  // Auto-create Fase 1 draft when no phases exist (run only after initial load)
  useEffect(() => {
    if (loading) return;
    if (allFormats.length === 0) {
      setDraftPhaseNumbers((prev) => prev.includes(1) ? prev : [...prev, 1]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  // Keep activePhaseNumber in sync with available containers
  useEffect(() => {
    if (containers.length === 0) {
      if (activePhaseNumber !== null) setActivePhaseNumber(null);
      return;
    }
    const exists = containers.some((c) => c.phaseNumber === activePhaseNumber);
    if (!exists) {
      setActivePhaseNumber(containers[0].phaseNumber);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allFormats, draftPhaseNumbers]);

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "group": return "Groepsfase";
      case "knockout": return "Knock-outfase";
      case "single_match": return "Losse wedstrijd";
      default: return "Format";
    }
  };

  const getAutoName = (type: string, phaseNumber: number) => {
    const existingOfType = allFormats.filter(f => f.phase_type === type && f.phase_number === phaseNumber);
    const count = existingOfType.length;
    switch (type) {
      case "group": return count === 0 ? "Groepsfase" : `Groepsfase ${count + 1}`;
      case "knockout": return `Bracket ${String.fromCharCode(65 + count)}`;
      case "single_match": return count === 0 ? "Plaatsingswedstrijd" : `Plaatsingswedstrijd ${count + 1}`;
      default: return `Format ${count + 1}`;
    }
  };

  const addFormatToPhase = async (phaseNumber: number) => {
    if (creatingFormat) return;

    setCreatingFormat(true);
    const name = newFormatName.trim() || getAutoName(newFormatType, phaseNumber);
    const existingInPhase = allFormats.filter((f) => f.phase_number === phaseNumber);
    const nextSort = existingInPhase.length;
    let createdPhaseId: string | null = null;

    try {
      const matchConfig = newFormatType === "group" ? {
        matchType: groupConfig.matchType,
        rounds: groupConfig.rounds,
        encounters: groupConfig.encounters,
      } : newFormatType === "knockout" ? {
        matchType: bracketConfig.matchType,
        ...(bracketConfig.hasPlacement ? { startPosition: bracketConfig.startPosition || 1 } : {}),
      } : newFormatType === "single_match" ? {
        matchType: singleMatchConfig.matchType,
        ...(singleMatchConfig.hasPlacement ? { startPosition: singleMatchConfig.startPosition || 1 } : {}),
      } : {};

      const existingPhaseFormat = allFormats.find(f => f.phase_number === phaseNumber);
      const inheritedPhaseLabel =
        existingPhaseFormat?.match_config?.phaseLabel ?? pendingPhaseLabels[phaseNumber];
      const matchConfigWithPhaseLabel = {
        ...matchConfig,
        ...(typeof inheritedPhaseLabel === "string" && inheritedPhaseLabel ? { phaseLabel: inheritedPhaseLabel } : {}),
      };

      const { data, error } = await supabase
        .from("tournament_phases")
        .insert({
          tournament_id: tournamentId,
          name,
          phase_number: phaseNumber,
          phase_type: newFormatType as any,
          sort_order: nextSort,
          category_id: categoryId || null,
          match_config: matchConfigWithPhaseLabel,
          scoring_system_id: newFormatScoringSystemId,
        } as any)
        .select("*")
        .maybeSingle();

      if (error) throw error;
      if (!data) throw new Error("Het format kon niet worden aangemaakt.");
      createdPhaseId = data.id;

      if (data.phase_type === "group") {
        for (let i = 0; i < groupConfig.groupCount; i++) {
          const groupName = `Group ${String.fromCharCode(65 + i)}`;
          const groupLetter = String.fromCharCode(65 + i);
          const { data: gData, error: groupError } = await supabase.from("groups").insert({
            phase_id: data.id,
            tournament_id: tournamentId,
            name: groupName,
          }).select("id").maybeSingle();

          if (groupError) throw groupError;
          if (!gData) throw new Error(`Groep ${groupName} kon niet worden aangemaakt.`);

          const slotsToInsert = Array.from({ length: groupConfig.teamsPerGroup }, (_, j) => ({
            tournament_id: tournamentId,
            phase_id: data.id,
            group_id: gData.id,
            slot_code: `${groupLetter}${j + 1}`,
            sort_order: j,
          }));

          const { error: slotInsertError } = await supabase.from("slots").insert(slotsToInsert);
          if (slotInsertError) throw slotInsertError;
        }

        const [gRes, sRes] = await Promise.all([
          supabase.from("groups").select("id, name").eq("phase_id", data.id).order("created_at"),
          supabase.from("slots").select("id, slot_code, team_id, group_id, sort_order").eq("phase_id", data.id).order("sort_order"),
        ]);

        if (gRes.error) throw gRes.error;
        if (sRes.error) throw sRes.error;

        const createdGroups = gRes.data || [];
        const createdSlots = sRes.data || [];
        const rawMatchType = groupConfig.matchType;
        const genMatchType = rawMatchType === "rounds" ? "custom" : rawMatchType === "multiple" ? "custom" : rawMatchType;
        const customRounds = rawMatchType === "multiple" ? groupConfig.encounters : (groupConfig.rounds || 1);
        const n0 = groupConfig.teamsPerGroup;
        const n = n0 % 2 === 0 ? n0 : n0 + 1;
        const singleLegRounds = n - 1;
        let totalRoundsToGenerate: number;
        if (genMatchType === "single_leg") totalRoundsToGenerate = singleLegRounds;
        else if (genMatchType === "home_away") totalRoundsToGenerate = singleLegRounds * 2;
        else totalRoundsToGenerate = customRounds;

        const effectiveGenMode = rawMatchType === "rounds" ? matchGenMode : "auto";
        const matchesToInsertGroup: any[] = [];

        for (const group of createdGroups) {
          const groupSlots = createdSlots.filter(s => s.group_id === group.id).sort((a, b) => a.sort_order - b.sort_order);
          const slotCount = groupSlots.length;
          if (slotCount < 2) continue;

          if (effectiveGenMode === "auto") {
            const pairings = generateRoundRobin(slotCount, genMatchType as any, customRounds);
            for (const p of pairings) {
              const homeSlot = groupSlots[p.homeIdx];
              const awaySlot = groupSlots[p.awayIdx];
              matchesToInsertGroup.push({
                tournament_id: tournamentId,
                phase_id: data.id,
                group_id: group.id,
                home_team_id: homeSlot.team_id || null,
                away_team_id: awaySlot.team_id || null,
                home_slot_label: homeSlot.slot_code,
                away_slot_label: awaySlot.slot_code,
                round_number: p.round,
              });
            }
          } else {
            const matchesPerRound = Math.floor(slotCount / 2);
            for (let round = 0; round < totalRoundsToGenerate; round++) {
              for (let mi = 0; mi < matchesPerRound; mi++) {
                matchesToInsertGroup.push({
                  tournament_id: tournamentId,
                  phase_id: data.id,
                  group_id: group.id,
                  home_team_id: null,
                  away_team_id: null,
                  home_slot_label: null,
                  away_slot_label: null,
                  match_name: `${group.name} - M${round * matchesPerRound + mi + 1}`,
                  round_number: round + 1,
                });
              }
            }
          }
        }

        if (matchesToInsertGroup.length > 0) {
          const { error: matchesError } = await supabase.from("matches").insert(matchesToInsertGroup);
          if (matchesError) throw matchesError;
        }
      }

      if (data.phase_type === "knockout") {
        const totalTeams = bracketConfig.teamCount;
        const totalRounds = Math.log2(totalTeams);
        const roundGroups: { id: string; name: string }[] = [];
        const sp = bracketConfig.hasPlacement ? (bracketConfig.startPosition || 1) : 1;
        const hasPlacement = sp > 1;

        const getKnockoutRoundName = (matchesInRound: number) => {
          if (matchesInRound === 1) return "Finale";
          if (matchesInRound === 2) return "Halve Finale";
          if (matchesInRound === 4) return "Kwartfinale";
          if (matchesInRound === 8) return "Achtste Finale";
          if (matchesInRound === 16) return "1/16 Finale";
          if (matchesInRound === 32) return "1/32 Finale";
          return `1/${matchesInRound * 2} Finale`;
        };

        const getKnockoutRoundNamePlural = (matchesInRound: number) => {
          if (matchesInRound === 1) return "Finale";
          if (matchesInRound === 2) return "Halve Finales";
          if (matchesInRound === 4) return "Kwartfinales";
          if (matchesInRound === 8) return "Achtste Finales";
          if (matchesInRound === 16) return "1/16 Finales";
          if (matchesInRound === 32) return "1/32 Finales";
          return `1/${matchesInRound * 2} Finales`;
        };

        // Group name (plural) with optional placement suffix
        const getPlacementLabel = (rangeStart: number, rangeEnd: number) => `Plaats ${rangeStart}-${rangeEnd}`;

        const getGroupRoundName = (matchesInRound: number) => {
          const base = getKnockoutRoundNamePlural(matchesInRound);
          if (!hasPlacement) return base;
          return `${base}: ${getPlacementLabel(sp, sp + matchesInRound * 2 - 1)}`;
        };

        // Match name (singular) — placement suffix is appended per-match
        const getMatchRoundName = (matchesInRound: number) => {
          return getKnockoutRoundName(matchesInRound);
        };

        const getMatchPlacementSuffix = (matchesInRound: number) => {
          if (!hasPlacement) return "";
          return ` (${getPlacementLabel(sp, sp + matchesInRound * 2 - 1)})`;
        };

        for (let round = 0; round < totalRounds; round++) {
          const matchesInRound = totalTeams / Math.pow(2, round + 1);
          const roundName = getGroupRoundName(matchesInRound);
          const { data: gData, error: groupError } = await supabase.from("groups").insert({
            phase_id: data.id,
            tournament_id: tournamentId,
            name: roundName,
            sort_order: round,
          }).select("id, name").maybeSingle();

          if (groupError) throw groupError;
          if (!gData) throw new Error(`Bracketronde ${roundName} kon niet worden aangemaakt.`);

          roundGroups.push(gData);

          if (round === 0) {
            const slotsToInsert: any[] = [];
            for (let s = 0; s < totalTeams; s++) {
              slotsToInsert.push({
                tournament_id: tournamentId,
                phase_id: data.id,
                group_id: gData.id,
                slot_code: `S${s + 1}`,
                sort_order: s,
              });
            }

            const { error: slotInsertError } = await supabase.from("slots").insert(slotsToInsert);
            if (slotInsertError) throw slotInsertError;
          }
        }

        const matchesToInsert: any[] = [];
        const matchNamesPerRound: string[][] = [];

        for (let round = 0; round < totalRounds; round++) {
          const matchesInRound = totalTeams / Math.pow(2, round + 1);
          const roundName = getMatchRoundName(matchesInRound);
          const placementSuffix = getMatchPlacementSuffix(matchesInRound);
          const names: string[] = [];
          for (let m = 0; m < matchesInRound; m++) {
            names.push(matchesInRound === 1 ? `${roundName}${placementSuffix}` : `${roundName} ${m + 1}${placementSuffix}`);
          }
          matchNamesPerRound.push(names);
        }

        const isHomeAway = bracketConfig.matchType === "home_away";
        for (let round = 0; round < totalRounds; round++) {
          const matchesInRound = totalTeams / Math.pow(2, round + 1);
          const roundGroup = roundGroups[round];
          if (!roundGroup) throw new Error("Niet alle bracketrondes konden worden opgebouwd.");

          for (let m = 0; m < matchesInRound; m++) {
            let homeSlot: string;
            let awaySlot: string;
            if (round === 0) {
              homeSlot = `S${m * 2 + 1}`;
              awaySlot = `S${m * 2 + 2}`;
            } else {
              const prevNames = matchNamesPerRound[round - 1];
              homeSlot = `Winnaar ${prevNames[m * 2]}`;
              awaySlot = `Winnaar ${prevNames[m * 2 + 1]}`;
            }

            const matchName = matchNamesPerRound[round][m];
            if (isHomeAway) {
              matchesToInsert.push({
                tournament_id: tournamentId,
                phase_id: data.id,
                group_id: roundGroup.id,
                home_slot_label: homeSlot,
                away_slot_label: awaySlot,
                round_number: round + 1,
                match_name: `${matchName} (Heen)`,
              });
              matchesToInsert.push({
                tournament_id: tournamentId,
                phase_id: data.id,
                group_id: roundGroup.id,
                home_slot_label: awaySlot,
                away_slot_label: homeSlot,
                round_number: round + 1,
                match_name: `${matchName} (Terug)`,
              });
            } else {
              matchesToInsert.push({
                tournament_id: tournamentId,
                phase_id: data.id,
                group_id: roundGroup.id,
                home_slot_label: homeSlot,
                away_slot_label: awaySlot,
                round_number: round + 1,
                match_name: matchName,
              });
            }
          }
        }

        if (matchesToInsert.length > 0) {
          const { error: matchesError } = await supabase.from("matches").insert(matchesToInsert);
          if (matchesError) throw matchesError;
        }
      }

      if (data.phase_type === "single_match") {
        const count = singleMatchConfig.matchCount;
        const isHA = singleMatchConfig.matchType === "home_away";
        const smSp = singleMatchConfig.hasPlacement ? (singleMatchConfig.startPosition || 1) : 1;
        const smHasPlacement = smSp > 1;
        const { data: gData, error: groupError } = await supabase.from("groups").insert({
          phase_id: data.id,
          tournament_id: tournamentId,
          name: "Wedstrijden",
        }).select("id").maybeSingle();

        if (groupError) throw groupError;
        if (!gData) throw new Error("De wedstrijdrij kon niet worden aangemaakt.");

        const slotsToInsert: any[] = [];
        const matchesToInsertSM: any[] = [];

        for (let i = 0; i < count; i++) {
          slotsToInsert.push(
            { tournament_id: tournamentId, phase_id: data.id, group_id: gData.id, slot_code: `S${i * 2 + 1}`, sort_order: i * 2 },
            { tournament_id: tournamentId, phase_id: data.id, group_id: gData.id, slot_code: `S${i * 2 + 2}`, sort_order: i * 2 + 1 },
          );
          const posFrom = smSp + i * 2;
          const posTo = posFrom + 1;
          const baseName = smHasPlacement 
            ? (count === 1 ? `Plaats ${posFrom}-${posTo}` : `Plaats ${posFrom}-${posTo}`)
            : (count === 1 ? "Wedstrijd 1" : `Wedstrijd ${i + 1}`);
          if (isHA) {
            matchesToInsertSM.push(
              {
                tournament_id: tournamentId, phase_id: data.id, group_id: gData.id,
                home_slot_label: `S${i * 2 + 1}`, away_slot_label: `S${i * 2 + 2}`,
                round_number: 1, match_name: `${baseName} (Heen)`,
              },
              {
                tournament_id: tournamentId, phase_id: data.id, group_id: gData.id,
                home_slot_label: `S${i * 2 + 2}`, away_slot_label: `S${i * 2 + 1}`,
                round_number: 2, match_name: `${baseName} (Terug)`,
              },
            );
          } else {
            matchesToInsertSM.push({
              tournament_id: tournamentId, phase_id: data.id, group_id: gData.id,
              home_slot_label: `S${i * 2 + 1}`, away_slot_label: `S${i * 2 + 2}`,
              round_number: 1, match_name: baseName,
            });
          }
        }

        const { error: slotInsertError } = await supabase.from("slots").insert(slotsToInsert);
        if (slotInsertError) throw slotInsertError;

        const { error: matchesError } = await supabase.from("matches").insert(matchesToInsertSM);
        if (matchesError) throw matchesError;
      }

      setNewlyCreatedId(data.id);
      await fetchFormats();
      setShowAddFormat(null);
      setNewFormatName("");
    } catch (error) {
      if (createdPhaseId) {
        await supabase.from("matches").delete().eq("phase_id", createdPhaseId);
        await supabase.from("slots").delete().eq("phase_id", createdPhaseId);
        await supabase.from("groups").delete().eq("phase_id", createdPhaseId);
        await supabase.from("tournament_phases").delete().eq("id", createdPhaseId);
      }

      toast({
        title: "Fout",
        description: getErrorMessage(error, "Het format kon niet worden aangemaakt."),
        variant: "destructive",
      });
    } finally {
      setCreatingFormat(false);
    }
  };

  const addNewPhase = () => {
    const maxExisting = containers.length > 0 ? Math.max(...containers.map((c) => c.phaseNumber)) : 0;
    const nextPhaseNumber = maxExisting + 1;
    setDraftPhaseNumbers((prev) => (prev.includes(nextPhaseNumber) ? prev : [...prev, nextPhaseNumber]));
    setActivePhaseNumber(nextPhaseNumber);
  };

  const clearSlotsReferencingFormats = async (formatIds: string[]) => {
    if (formatIds.length === 0) return;

    const { data: referencedSlots, error } = await supabase
      .from("slots")
      .select("id, slot_code, phase_id, group_id")
      .eq("tournament_id", tournamentId)
      .in("ref_phase_id", formatIds);

    if (error) throw error;

    for (const slot of referencedSlots || []) {
      const { error: slotUpdateError } = await supabase
        .from("slots")
        .update({ ref_phase_id: null, ref_group_id: null, ref_position: null, team_id: null } as any)
        .eq("id", slot.id);
      if (slotUpdateError) throw slotUpdateError;

      let homeUpdate = supabase
        .from("matches")
        .update({ home_team_id: null } as any)
        .eq("tournament_id", tournamentId)
        .eq("phase_id", slot.phase_id)
        .eq("home_slot_label", slot.slot_code);
      let awayUpdate = supabase
        .from("matches")
        .update({ away_team_id: null } as any)
        .eq("tournament_id", tournamentId)
        .eq("phase_id", slot.phase_id)
        .eq("away_slot_label", slot.slot_code);

      if (slot.group_id) {
        homeUpdate = homeUpdate.eq("group_id", slot.group_id);
        awayUpdate = awayUpdate.eq("group_id", slot.group_id);
      } else {
        homeUpdate = homeUpdate.is("group_id", null);
        awayUpdate = awayUpdate.is("group_id", null);
      }

      const [{ error: homeError }, { error: awayError }] = await Promise.all([homeUpdate, awayUpdate]);
      if (homeError) throw homeError;
      if (awayError) throw awayError;
    }
  };

  const removeFormat = async (id: string) => {
    const removed = allFormats.find((f) => f.id === id);
    await clearSlotsReferencingFormats([id]);
    await supabase.from("tournament_phases").delete().eq("id", id);
    const next = allFormats.filter((x) => x.id !== id);
    setAllFormats(next);
    // Keep phase visible (as draft) if this was the last format in that phase
    if (removed && !next.some((f) => f.phase_number === removed.phase_number)) {
      setDraftPhaseNumbers((prev) => prev.includes(removed.phase_number) ? prev : [...prev, removed.phase_number]);
    }
    setSlotRefreshKey(k => k + 1);
  };

  // Delete entire phase (all formats in it) with renumbering. Also handles draft (empty) phases.
  const deletePhase = async (phaseNumber: number) => {
    // Never allow deleting the last remaining phase or the first phase
    if (containers.length <= 1 || phaseNumber === 1) {
      setDeletePhaseNumber(null);
      return;
    }

    // If this is an empty draft phase, just drop it locally
    const isDraft = draftPhaseNumbers.includes(phaseNumber) && !allFormats.some(f => f.phase_number === phaseNumber);
    if (isDraft) {
      setDraftPhaseNumbers((prev) => prev.filter((n) => n !== phaseNumber));
      setDeletePhaseNumber(null);
      toast({ title: "Fase verwijderd" });
      return;
    }

    const formatsToDelete = allFormats.filter(f => f.phase_number === phaseNumber);
    await clearSlotsReferencingFormats(formatsToDelete.map((fmt) => fmt.id));
    for (const fmt of formatsToDelete) {
      await supabase.from("tournament_phases").delete().eq("id", fmt.id);
    }

    // Renumber remaining phases
    const remaining = allFormats.filter(f => f.phase_number !== phaseNumber);
    const uniquePhaseNumbers = [...new Set(remaining.map(f => f.phase_number))].sort((a, b) => a - b);

    const renumberMap = new Map<number, number>();
    uniquePhaseNumbers.forEach((oldNumber, i) => renumberMap.set(oldNumber, i + 1));

    for (const fmt of remaining) {
      const newNumber = renumberMap.get(fmt.phase_number)!;
      if (newNumber !== fmt.phase_number) {
        await supabase.from("tournament_phases").update({ phase_number: newNumber } as any).eq("id", fmt.id);
      }
    }

    const renumbered = remaining
      .map((fmt) => ({ ...fmt, phase_number: renumberMap.get(fmt.phase_number)! }))
      .sort((a, b) => a.phase_number - b.phase_number || a.sort_order - b.sort_order);

    setAllFormats(renumbered);
    setDraftPhaseNumbers((prev) => prev.filter((n) => n !== phaseNumber && n <= renumbered.length));
    setSlotRefreshKey(k => k + 1);
    setDeletePhaseNumber(null);
    toast({ title: "Fase verwijderd en hernummerd" });

  };

  // Swap format sort_order within a phase
  const swapFormats = async (formatA: Phase, formatB: Phase) => {
    // Get all formats in this phase, sorted by current sort_order
    const phaseFormats = [...allFormats]
      .filter(f => f.phase_number === formatA.phase_number)
      .sort((a, b) => a.sort_order - b.sort_order);

    const idxA = phaseFormats.findIndex(f => f.id === formatA.id);
    const idxB = phaseFormats.findIndex(f => f.id === formatB.id);
    if (idxA === -1 || idxB === -1) return;

    // Swap positions in array
    [phaseFormats[idxA], phaseFormats[idxB]] = [phaseFormats[idxB], phaseFormats[idxA]];

    // Assign clean sequential sort_orders and save
    const updates: Promise<any>[] = [];
    for (let i = 0; i < phaseFormats.length; i++) {
      if (phaseFormats[i].sort_order !== i) {
        updates.push(
          Promise.resolve(supabase.from("tournament_phases").update({ sort_order: i } as any).eq("id", phaseFormats[i].id))
        );
      }
      phaseFormats[i] = { ...phaseFormats[i], sort_order: i };
    }
    await Promise.all(updates);

    // Update local state
    const updatedMap = new Map(phaseFormats.map(f => [f.id, f.sort_order]));
    setAllFormats(prev =>
      prev.map(f => updatedMap.has(f.id) ? { ...f, sort_order: updatedMap.get(f.id)! } : f)
        .sort((a, b) => a.phase_number - b.phase_number || a.sort_order - b.sort_order)
    );
  };

  // Reorder formats within a phase via drag & drop
  const reorderFormats = async (ordered: Phase[]) => {
    const updates: Promise<any>[] = [];
    ordered.forEach((f, i) => {
      if (f.sort_order !== i) {
        updates.push(Promise.resolve(supabase.from("tournament_phases").update({ sort_order: i } as any).eq("id", f.id)));
      }
    });
    const map = new Map(ordered.map((f, i) => [f.id, i]));
    setAllFormats(prev =>
      prev.map(f => (map.has(f.id) ? { ...f, sort_order: map.get(f.id)! } : f))
        .sort((a, b) => a.phase_number - b.phase_number || a.sort_order - b.sort_order)
    );
    await Promise.all(updates);
  };

  // Swap phase positions
  const swapPhases = async (phaseA: number, phaseB: number) => {
    const formatsA = allFormats.filter(f => f.phase_number === phaseA);
    const formatsB = allFormats.filter(f => f.phase_number === phaseB);

    for (const fmt of formatsA) {
      await supabase.from("tournament_phases").update({ phase_number: phaseB } as any).eq("id", fmt.id);
    }
    for (const fmt of formatsB) {
      await supabase.from("tournament_phases").update({ phase_number: phaseA } as any).eq("id", fmt.id);
    }

    setAllFormats(prev =>
      prev.map(f => {
        if (formatsA.some(a => a.id === f.id)) return { ...f, phase_number: phaseB };
        if (formatsB.some(b => b.id === f.id)) return { ...f, phase_number: phaseA };
        return f;
      }).sort((a, b) => a.phase_number - b.phase_number || a.sort_order - b.sort_order)
    );
  };

  const updateFormat = async (id: string, updates: Partial<Phase>) => {
    const oldFormat = allFormats.find(f => f.id === id);
    setAllFormats((f) => f.map((x) => (x.id === id ? { ...x, ...updates } : x)));

    // When name changes, update downstream slot_codes that reference this phase
    if (updates.name && oldFormat && updates.name !== oldFormat.name) {
      const newName = updates.name;
      // Find all slots referencing this phase
      const { data: refSlots } = await supabase
        .from("slots")
        .select("id, slot_code, phase_id, group_id, ref_phase_id, ref_group_id, ref_position")
        .eq("ref_phase_id", id);
      if (refSlots && refSlots.length > 0) {
        // Update cross-group slots (ref_group_id is null, slot_code contains old format name)
        for (const slot of refSlots) {
          if (!slot.ref_group_id && slot.slot_code) {
            // Pattern: "Xe nr.Y oldName" -> "Xe nr.Y newName"
            const regex = new RegExp(`(\\d+e\\s+nr\\.\\d+\\s+)${oldFormat.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`);
            if (regex.test(slot.slot_code)) {
              const newSlotCode = slot.slot_code.replace(regex, `$1${newName}`);
              await supabase.from("slots").update({ slot_code: newSlotCode }).eq("id", slot.id);
              // Also update match labels
              const oldCode = slot.slot_code;
              await supabase.from("matches").update({ home_slot_label: newSlotCode }).eq("phase_id", slot.phase_id).eq("home_slot_label", oldCode);
              await supabase.from("matches").update({ away_slot_label: newSlotCode }).eq("phase_id", slot.phase_id).eq("away_slot_label", oldCode);
            }
          }
        }
        setSlotRefreshKey(k => k + 1);
      }
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-foreground border-t-transparent" />
      </div>
    );
  }

  const formatTypeSelector = (
    <div className="space-y-4">
      <div className="space-y-1">
        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Type</Label>
        <div className="grid grid-cols-3 gap-2">
          {[
            { value: "group", label: "GROEPSFASE" },
            { value: "knockout", label: "KNOCK-OUTFASE" },
            { value: "single_match", label: "LOSSE WEDSTRIJD" },
          ].map((opt) => (
            <button
              key={opt.value}
              onClick={() => setNewFormatType(opt.value)}
              className={`rounded-lg border-2 p-3 text-center transition-all ${
                newFormatType === opt.value
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/20"
              }`}
            >
              <p className="text-xs font-bold text-foreground uppercase tracking-wide">{opt.label}</p>
            </button>
          ))}
        </div>
      </div>

      {newFormatType === "group" && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Aantal groepen</Label>
              <select
                value={groupConfig.groupCount}
                onChange={(e) => {
                  const newCount = parseInt(e.target.value);
                  const maxTeams = Math.floor(128 / newCount);
                  setGroupConfig({
                    ...groupConfig,
                    groupCount: newCount,
                    teamsPerGroup: Math.min(groupConfig.teamsPerGroup, Math.max(2, maxTeams)),
                  });
                }}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {Array.from({ length: 32 }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Teams per groep</Label>
              <select
                value={groupConfig.teamsPerGroup}
                onChange={(e) => setGroupConfig({ ...groupConfig, teamsPerGroup: parseInt(e.target.value) })}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {Array.from({ length: Math.max(1, Math.min(128, Math.floor(128 / groupConfig.groupCount)) - 1) }, (_, i) => i + 2).map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Competitieformat</Label>
            <div className="grid grid-cols-2 gap-2">
               {[
                { value: "single_leg", label: "ENKELE WEDSTRIJD", desc: "Elk team speelt één keer tegen elk ander team in de poule" },
                { value: "home_away", label: "HEEN EN TERUG", desc: "Elk team speelt twee keer tegen elk ander team in de poule (thuis & uit)" },
                { value: "multiple", label: "MEERDERE ONTMOETINGEN", desc: "Elk team speelt meerdere keren tegen elke tegenstander in de poule" },
                { value: "rounds", label: "SPEELRONDES", desc: "Bepaal zelf het totaal aantal wedstrijden dat elk team moet spelen" },
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setGroupConfig({ ...groupConfig, matchType: opt.value as any })}
                  className={`rounded-lg border p-2.5 text-left transition-all text-xs ${
                    groupConfig.matchType === opt.value
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/20"
                  }`}
                >
                  <p className="font-bold text-foreground uppercase tracking-wide">{opt.label}</p>
                  <p className="text-muted-foreground mt-0.5">{opt.desc}</p>
                </button>
              ))}
            </div>
          </div>
          {groupConfig.matchType === "multiple" && (
            <div className="space-y-1">
              <Label className="text-xs">Aantal ontmoetingen per tegenstander</Label>
              <select
                value={groupConfig.encounters}
                onChange={(e) => setGroupConfig({ ...groupConfig, encounters: parseInt(e.target.value) })}
                className="flex h-10 w-full max-w-[200px] rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {Array.from({ length: 8 }, (_, i) => i + 3).map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
          )}
          {groupConfig.matchType === "rounds" && (
            <div className="space-y-1">
              <Label className="text-xs">Aantal speelrondes</Label>
              <select
                value={groupConfig.rounds}
                onChange={(e) => setGroupConfig({ ...groupConfig, rounds: parseInt(e.target.value) })}
                className="flex h-10 w-full max-w-[200px] rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {Array.from({ length: 126 }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
          )}
          {groupConfig.matchType === "rounds" && (
            <div className="space-y-1">
              <div className="flex items-center gap-1.5">
                <Label className="text-xs">Wedstrijden genereren</Label>
                <TooltipProvider delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent side="right" className="max-w-xs text-xs">
                      <p className="font-semibold mb-1">Automatische inplanning</p>
                      <p className="mb-2">Het systeem genereert alle wedstrijden en vult deze direct willekeurig in met de beschikbare teams.</p>
                      <p className="font-semibold mb-1">Handmatige inplanning</p>
                      <p>Het systeem genereert lege wedstrijdslots zonder teams. Je vult daarna zelf per wedstrijd in welke teams tegen elkaar spelen.</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { value: "auto" as const, label: "AUTOMATISCHE INPLANNING" },
                  { value: "empty" as const, label: "HANDMATIGE INPLANNING" },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setMatchGenMode(opt.value)}
                    className={`rounded-lg border p-2.5 text-center transition-all text-xs ${
                      matchGenMode === opt.value
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/20"
                    }`}
                  >
                    <p className="font-bold text-foreground uppercase tracking-wide">{opt.label}</p>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {newFormatType === "knockout" && (
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Aantal teams</Label>
            <select
              value={bracketConfig.teamCount}
              onChange={(e) => setBracketConfig({ ...bracketConfig, teamCount: parseInt(e.target.value) })}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {[2, 4, 8, 16, 32, 64, 128].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Wedstrijdformat</Label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { value: "single_leg" as const, label: "ENKELE WEDSTRIJD", desc: "Eén beslissende wedstrijd" },
                { value: "home_away" as const, label: "HEEN EN TERUG", desc: "Heen- en terugwedstrijd" },
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setBracketConfig({ ...bracketConfig, matchType: opt.value })}
                  className={`rounded-lg border p-2.5 text-left transition-all text-xs ${
                    bracketConfig.matchType === opt.value
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/20"
                  }`}
                >
                  <p className="font-bold text-foreground uppercase tracking-wide">{opt.label}</p>
                  <p className="text-muted-foreground mt-0.5">{opt.desc}</p>
                </button>
              ))}
            </div>
          </div>
          {showAddFormat !== null && allFormats.some(f => f.phase_number === showAddFormat && (f.phase_type === "knockout" || f.phase_type === "single_match")) && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Switch checked={bracketConfig.hasPlacement} onCheckedChange={(v) => {
                  if (v && showAddFormat !== null) {
                    // Auto-calculate startPosition based on existing formats in this phase
                    const formatsInPhase = allFormats.filter(f => f.phase_number === showAddFormat && (f.phase_type === "knockout" || f.phase_type === "single_match"));
                    let totalTeamsUsed = 0;
                    for (const fmt of formatsInPhase) {
                      const mc = fmt.match_config as Record<string, any> | null;
                      if (mc?.startPosition && mc.startPosition > 1) {
                        // This format has placement, skip counting toward main bracket
                      } else if (fmt.phase_type === "knockout") {
                        // Count teams from match_config or groups
                        const groups = allFormats.filter(f2 => f2.id === fmt.id);
                        // Estimate from database: use a simple heuristic based on existing bracket team counts
                      }
                    }
                    // Simple approach: sum up team counts of all knockout/single_match formats without placement
                    let autoStart = 1;
                    for (const fmt of formatsInPhase) {
                      const mc = fmt.match_config as Record<string, any> | null;
                      if (!mc?.startPosition || mc.startPosition === 1) {
                        // This is a main bracket - we need to know its team count
                        // We can't easily know from here, but we can query slots count
                        // For now, use a simpler approach: count from slot data or use position offset
                      }
                    }
                    // Better approach: calculate from the formats that already exist
                    // Each format without placement contributes its team count to the position offset
                    // We'll fetch slot counts for existing formats
                    const calcStartPosition = async () => {
                      let pos = 1;
                      for (const fmt of formatsInPhase) {
                        const mc = fmt.match_config as Record<string, any> | null;
                        const sp = mc?.startPosition || 1;
                        // Get the number of slots (teams) in this format's first round
                        const { count } = await supabase.from("slots").select("id", { count: "exact", head: true }).eq("phase_id", fmt.id);
                        const teamCount = count || 0;
                        const endPos = sp + teamCount - 1;
                        if (endPos >= pos) pos = endPos + 1;
                      }
                      setBracketConfig(prev => ({ ...prev, hasPlacement: true, startPosition: pos }));
                    };
                    calcStartPosition();
                  } else {
                    setBracketConfig({ ...bracketConfig, hasPlacement: v });
                  }
                }} />
                <Label className="text-xs">Eindklassering</Label>
              </div>
              <p className="text-[10px] text-muted-foreground">
                Activeer dit om een specifieke eindklassering in te stellen voor deze bracket (bijv. plaatsing 17 t/m 32). Dit is handig wanneer je meerdere brackets gebruikt voor verschillende eindklasseringen. Wanneer dit is uitgeschakeld, maakt het systeem automatisch de hoofdbracket aan voor de 1e plaats.
              </p>
              {bracketConfig.hasPlacement && (
                <div className="flex items-center gap-2 pt-1">
                  <span className="text-sm text-muted-foreground">Plaats</span>
                  <Input
                    type="number"
                    min={1}
                    value={bracketConfig.startPosition || ""}
                    onChange={(e) => setBracketConfig({ ...bracketConfig, startPosition: e.target.value === "" ? 0 : Math.max(1, parseInt(e.target.value) || 0) })}
                    className="h-10 w-20"
                    placeholder="1"
                  />
                  <span className="text-sm text-muted-foreground">tot</span>
                  <span className="text-sm font-medium text-foreground">{(bracketConfig.startPosition || 1) + bracketConfig.teamCount - 1}</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {newFormatType === "single_match" && (
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Aantal losse wedstrijden</Label>
            <select
              value={singleMatchConfig.matchCount}
              onChange={(e) => setSingleMatchConfig({ ...singleMatchConfig, matchCount: parseInt(e.target.value) })}
              className="flex h-10 w-full max-w-[200px] rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {Array.from({ length: 32 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Wedstrijdformat</Label>
            <div className="flex gap-2">
              {[
                { value: "single_leg", label: "ENKELE WEDSTRIJD", desc: "Eén beslissende wedstrijd" },
                { value: "home_away", label: "HEEN EN TERUG", desc: "Heen- en terugwedstrijd" },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setSingleMatchConfig({ ...singleMatchConfig, matchType: opt.value as any })}
                  className={`flex-1 text-left border rounded-lg px-3 py-2 text-xs transition-all ${singleMatchConfig.matchType === opt.value ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"}`}
                >
                  <span className="font-bold block">{opt.label}</span>
                  <p className="text-muted-foreground mt-0.5">{opt.desc}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="space-y-1">
        <Label className="text-xs">Naam (optioneel)</Label>
        <Input
          value={newFormatName}
          onChange={(e) => setNewFormatName(e.target.value)}
          placeholder={getAutoName(newFormatType, showAddFormat || containers.length + 1)}
          className="h-10 max-w-[300px]"
        />
      </div>
    </div>
  );

  const openFormat = openFormatId ? allFormats.find((f) => f.id === openFormatId) ?? null : null;

  return (
    <div className="space-y-6">
      {/* Phase tab-bar (Deelnemers-stijl) */}
      {containers.length > 0 && !(isMobile && openFormat) && (
        <div className="flex border-b border-border max-sm:flex-nowrap max-sm:overflow-x-auto max-sm:justify-start sm:justify-center sm:flex-wrap">
          {containers.map((c) => {
            const isActive = activePhaseNumber === c.phaseNumber;
            return (
              <div key={c.phaseNumber} className="relative flex items-center">
                <button
                  onClick={() => setActivePhaseNumber(c.phaseNumber)}
                  className={
                    "pl-6 pr-3 py-3 text-sm font-semibold uppercase tracking-wide transition-colors relative flex items-center gap-2 shrink-0 whitespace-nowrap max-sm:pl-3 max-sm:text-xs " +
                    (isActive
                      ? "text-primary after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:bg-primary"
                      : "text-muted-foreground hover:text-foreground")
                  }
                >
                  <span>
                    {allFormats.some(f => f.phase_number === c.phaseNumber)
                      ? getPhaseLabel(c.phaseNumber, allFormats)
                      : (pendingPhaseLabels[c.phaseNumber] || `Fase ${c.phaseNumber}`)}
                  </span>
                  {isActive && (
                    <span className="flex items-center gap-0.5 ml-1">
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => { e.stopPropagation(); openPhaseEdit(c.phaseNumber); }}
                        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.stopPropagation(); openPhaseEdit(c.phaseNumber); } }}
                        className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
                        title="Naam bewerken"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </span>
                      {containers.length > 1 && c.phaseNumber !== 1 && (
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(e) => { e.stopPropagation(); setDeletePhaseNumber(c.phaseNumber); }}
                          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.stopPropagation(); setDeletePhaseNumber(c.phaseNumber); } }}
                          className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-muted cursor-pointer"
                          title="Fase verwijderen"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </span>
                      )}
                    </span>
                  )}
                </button>
              </div>
            );
          })}
          <button
            onClick={addNewPhase}
            className="px-6 py-3 text-sm font-semibold uppercase tracking-wide text-primary hover:text-primary/80 transition-colors flex items-center gap-1.5 shrink-0 whitespace-nowrap max-sm:px-3 max-sm:text-xs"
            title="Fase toevoegen"
          >
            <Plus className="h-4 w-4" /> Fase toevoegen
          </button>
        </div>
      )}

      {containers
        .filter((c) => c.phaseNumber === activePhaseNumber)
        .map((container) => (
          <div key={container.phaseNumber}>
            {isMobile ? (
              openFormat ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="icon" className="h-8 w-8" aria-label="Terug naar formats" onClick={() => setOpenFormatId(null)}>
                      <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <h2 className="truncate text-base font-semibold">{openFormat.name}</h2>
                  </div>
                  <FormatCard
                    key={openFormat.id}
                    format={openFormat}
                    tournamentId={tournamentId}
                    allFormats={allFormats}
                    onRemove={(id) => { setOpenFormatId(null); removeFormat(id); }}
                    onUpdate={updateFormat}
                    categoryId={categoryId}
                    refreshKey={slotRefreshKey}
                    onSlotChange={() => setSlotRefreshKey(k => k + 1)}
                    initialExpanded
                  />
                </div>
              ) : (
                <div className="space-y-3">
                  <SortableVerticalList
                    items={container.formats}
                    getId={(f) => f.id}
                    onReorder={(next) => reorderFormats(next)}
                    className="grid grid-cols-1 gap-2"
                  >
                    {container.formats.map((format) => (
                      <SortableRowShell key={format.id} id={format.id} manualRowDrag dragLabel="Format verplaatsen">
                        {(handle, rowProps) => (
                          <div
                            role="button"
                            tabIndex={0}
                            onClick={() => setOpenFormatId(format.id)}
                            onKeyDown={(e) => { if (e.key === "Enter") setOpenFormatId(format.id); }}
                            className="flex items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-2 transition-colors hover:border-primary/50 hover:bg-accent/40"
                          >
                            <span {...rowProps} data-no-drag={undefined} onClick={(e) => e.stopPropagation()} className="flex h-7 w-7 shrink-0 items-center justify-center text-muted-foreground cursor-grab active:cursor-grabbing touch-none">
                              {handle}
                            </span>
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md bg-primary/10 text-primary">
                              {format.logo_url
                                ? <img src={format.logo_url} alt="" className="h-full w-full object-contain" />
                                : formatIcon(format.phase_type)}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-semibold">{format.name}</span>
                              <span className="block truncate text-[11px] text-muted-foreground">{formatTypeLabel(format.phase_type)}</span>
                            </span>
                            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                          </div>
                        )}
                      </SortableRowShell>
                    ))}
                  </SortableVerticalList>
                  <button
                    onClick={() => setShowAddFormat(container.phaseNumber)}
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-primary/40 bg-primary/5 px-3 py-2.5 text-sm font-medium text-primary transition-colors hover:bg-primary/10"
                  >
                    <Plus className="h-4 w-4" /> Format toevoegen
                  </button>
                </div>
              )
            ) : (
            <div className="space-y-3">
              {/* Format cards - always visible, individually collapsible */}
              <SortableVerticalList
                items={container.formats}
                getId={(f) => f.id}
                onReorder={(next) => reorderFormats(next)}
                className="space-y-3"
              >
              {container.formats.map((format, formatIdx) => (
                <SortableRowShell key={format.id} id={format.id} manualRowDrag dragLabel="Format verplaatsen">
                  {(handle, rowProps) => (
                <FormatCard
                  format={format}
                  dragHandle={handle}
                  dragRowProps={rowProps}
                  tournamentId={tournamentId}
                  allFormats={allFormats}
                  onRemove={removeFormat}
                  onUpdate={updateFormat}
                  categoryId={categoryId}
                  refreshKey={slotRefreshKey}
                  onSlotChange={() => setSlotRefreshKey(k => k + 1)}
                  canMoveUp={formatIdx > 0}
                  canMoveDown={formatIdx < container.formats.length - 1}
                  onMoveUp={() => formatIdx > 0 && swapFormats(format, container.formats[formatIdx - 1])}
                  onMoveDown={() => formatIdx < container.formats.length - 1 && swapFormats(format, container.formats[formatIdx + 1])}
                  initialExpanded={format.id === newlyCreatedId}
                />
                  )}
                </SortableRowShell>
              ))}
              </SortableVerticalList>

              <div className="flex justify-start">
                <button
                  onClick={() => setShowAddFormat(container.phaseNumber)}
                  className="inline-flex items-center gap-1.5 rounded-md border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20 hover:border-primary/50 transition-colors"
                >
                  <Plus className="h-3 w-3" /> Format toevoegen
                </button>
              </div>
            </div>
            )}
          </div>
        ))}


      {/* Dialog for adding format */}
      <Dialog open={showAddFormat !== null} onOpenChange={(open) => {
        if (!open) {
          setShowAddFormat(null);
          setNewFormatScoringSystemId(null);
        }
      }}>
        <DialogContent ref={addFormatDialogRef} className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Format toevoegen{showAddFormat !== null && containers.some(c => c.phaseNumber === showAddFormat) ? ` aan Fase ${showAddFormat}` : ` — Fase ${showAddFormat}`}</DialogTitle>
          </DialogHeader>
          {formatTypeSelector}
          <ScoringSystemSelector
            systems={scoringSystems}
            value={newFormatScoringSystemId}
            onChange={setNewFormatScoringSystemId}
            hint="Geldt voor alle groepen/wedstrijden in dit format (kan per groep/wedstrijd worden overschreven)."
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => {
              setShowAddFormat(null);
              setNewFormatScoringSystemId(null);
            }}>Annuleren</Button>
            <Button onClick={() => showAddFormat !== null && addFormatToPhase(showAddFormat)} disabled={creatingFormat} className="bg-primary text-primary-foreground hover:bg-primary/90">
              {creatingFormat ? "Toevoegen..." : "Toevoegen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete phase confirmation */}
      <AlertDialog open={deletePhaseNumber !== null} onOpenChange={(open) => { if (!open) setDeletePhaseNumber(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{deletePhaseNumber ? getPhaseLabel(deletePhaseNumber, allFormats) : "Fase"} verwijderen?</AlertDialogTitle>
            <AlertDialogDescription>
              Alle formats, groepen, wedstrijden en slots in deze fase worden verwijderd. Overige fases worden automatisch hernummerd. Dit kan niet ongedaan worden gemaakt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction onClick={() => deletePhaseNumber && deletePhase(deletePhaseNumber)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Verwijderen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit phase dialog */}
      <Dialog open={editPhaseNumber !== null} onOpenChange={(open) => { if (!open) setEditPhaseNumber(null); }}>
        <DialogContent ref={editPhaseDialogRef} className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Fase bewerken</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Naam</Label>
              <Input
                value={editPhaseLabel}
                onChange={(e) => setEditPhaseLabel(e.target.value)}
                placeholder={`Fase ${editPhaseNumber}`}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditPhaseNumber(null)}>Annuleren</Button>
            <Button onClick={savePhaseEdit} disabled={savingPhaseEdit}>
              {savingPhaseEdit ? "Opslaan..." : "Opslaan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PhaseManager;
