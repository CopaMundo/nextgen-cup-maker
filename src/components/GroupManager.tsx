import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useDialogFocus } from "@/hooks/useDialogFocus";
import { Plus, Trash2, Pencil, Shuffle, Upload, X, Info, CalendarDays, Check, AlertTriangle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import SlotManager from "./SlotManager";
import ScoringSystemSelector from "./ScoringSystemSelector";
import { useScoringSystems } from "@/hooks/useScoringSystems";
import { compressImage } from "@/lib/compressImage";
import { generateRoundRobin } from "@/lib/matchGenerator";

interface Group {
  id: string;
  name: string;
  logo_url: string | null;
  scoring_system_id?: string | null;
}

interface Phase {
  id: string;
  name: string;
  phase_number: number;
  phase_type: string;
  sort_order: number;
  emoji?: string | null;
}

type MatchType = "single_leg" | "home_away" | "multiple" | "rounds";

const COMPETITION_TYPES: { value: MatchType; label: string; desc: string }[] = [
  { value: "single_leg", label: "ENKELE WEDSTRIJD", desc: "Elk team speelt één keer tegen elk ander team in de poule" },
  { value: "home_away", label: "HEEN EN TERUG", desc: "Elk team speelt twee keer tegen elk ander team in de poule (thuis & uit)" },
  { value: "multiple", label: "MEERDERE ONTMOETINGEN", desc: "Elk team speelt meerdere keren tegen elke tegenstander in de poule" },
  { value: "rounds", label: "SPEELRONDES", desc: "Bepaal zelf het totaal aantal wedstrijden dat elk team moet spelen" },
];

const GroupManager = ({
  tournamentId,
  phaseId,
  phaseType,
  phaseNumber,
  phases = [],
  categoryId,
  refreshKey,
  onSlotChange,
  showRandomAssign = true,
}: {
  tournamentId: string;
  phaseId: string;
  phaseType: string;
  phaseNumber: number;
  phases?: Phase[];
  categoryId?: string | null;
  refreshKey?: number;
  onSlotChange?: () => void;
  showRandomAssign?: boolean;
}) => {
  const [groups, setGroups] = useState<Group[]>([]);
  const [groupsLoaded, setGroupsLoaded] = useState(false);
  const [slotRefreshKey, setSlotRefreshKey] = useState(0);
  const { toast } = useToast();
  const { systems: scoringSystems } = useScoringSystems(tournamentId);
  const [phaseScoringSystemId, setPhaseScoringSystemId] = useState<string | null>(null);
  const [dialogScoringSystemId, setDialogScoringSystemId] = useState<string | null>(null);

  // Dialog state
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const createDialogRef = useDialogFocus(createOpen);
  const editDialogRef = useDialogFocus(editOpen);
  const [dialogName, setDialogName] = useState("");
  const [dialogSlots, setDialogSlots] = useState(4);
  const [dialogMatchType, setDialogMatchType] = useState<MatchType>("single_leg");
  const [dialogEncounters, setDialogEncounters] = useState(3);
  const [dialogRounds, setDialogRounds] = useState(3);
  const [dialogMatchGenMode, setDialogMatchGenMode] = useState<"auto" | "empty">("auto");
  const [dialogLogoFile, setDialogLogoFile] = useState<File | null>(null);
  const [dialogLogoPreview, setDialogLogoPreview] = useState<string | null>(null);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Phase match config (current)
  const [phaseMatchType, setPhaseMatchType] = useState<MatchType>("single_leg");
  const [phaseEncounters, setPhaseEncounters] = useState(3);
  const [phaseRounds, setPhaseRounds] = useState(3);

  const fetchMatchConfig = async () => {
    const { data } = await supabase
      .from("tournament_phases")
      .select("match_config, scoring_system_id")
      .eq("id", phaseId)
      .single();
    const config = (data?.match_config as any) || {};
    setPhaseMatchType(config.matchType || "single_leg");
    setPhaseEncounters(config.encounters || 3);
    setPhaseRounds(config.rounds || 3);
    setPhaseScoringSystemId((data as any)?.scoring_system_id ?? null);
  };

  /** Generate round-robin matches for a group based on its slots */
  const generateMatchesForGroup = async (groupId: string, matchType?: MatchType, encounters?: number, rounds?: number, genMode?: "auto" | "empty") => {
    const { data: slots } = await supabase
      .from("slots")
      .select("slot_code, team_id")
      .eq("group_id", groupId)
      .eq("tournament_id", tournamentId)
      .order("sort_order");
    if (!slots || slots.length < 2) return;

    const mt = matchType || phaseMatchType;
    const enc = encounters || phaseEncounters;
    const rnd = rounds || phaseRounds;
    const mode = genMode || "auto";

    const rawMatchType = mt;
    const genMatchType = rawMatchType === "home_away" ? "home_away" : (rawMatchType === "multiple" || rawMatchType === "rounds") ? "custom" : "single_leg";
    const customRounds = rawMatchType === "multiple" ? enc : rnd;

    // Delete existing matches for this group
    await supabase
      .from("matches")
      .delete()
      .eq("group_id", groupId)
      .eq("tournament_id", tournamentId)
      .eq("phase_id", phaseId);

    // Planning mode applies only to "Speelrondes"; other formats always auto-generate
    const effectiveMode = rawMatchType === "rounds" ? mode : "auto";

    if (effectiveMode === "auto") {
      const pairings = generateRoundRobin(slots.length, genMatchType as any, customRounds);
      if (pairings.length === 0) return;

      const newMatches = pairings.map(p => ({
        tournament_id: tournamentId,
        phase_id: phaseId,
        group_id: groupId,
        home_team_id: slots[p.homeIdx]?.team_id || null,
        away_team_id: slots[p.awayIdx]?.team_id || null,
        home_slot_label: slots[p.homeIdx]?.slot_code,
        away_slot_label: slots[p.awayIdx]?.slot_code,
        round_number: p.round,
      }));

      await supabase.from("matches").insert(newMatches);
    } else {
      // Manual mode: empty match slots
      const slotCount = slots.length;
      const n = slotCount % 2 === 0 ? slotCount : slotCount + 1;
      const singleLegRounds = n - 1;
      const totalRoundsToGenerate =
        rawMatchType === "single_leg"
          ? singleLegRounds
          : rawMatchType === "home_away"
            ? singleLegRounds * 2
            : customRounds;
      const matchesPerRound = Math.floor(slotCount / 2);

      // Get group name for match naming
      const { data: groupData } = await supabase.from("groups").select("name").eq("id", groupId).single();
      const groupName = groupData?.name || "Groep";

      const newMatches: any[] = [];
      for (let round = 0; round < totalRoundsToGenerate; round++) {
        for (let mi = 0; mi < matchesPerRound; mi++) {
          newMatches.push({
            tournament_id: tournamentId,
            phase_id: phaseId,
            group_id: groupId,
            home_team_id: null,
            away_team_id: null,
            home_slot_label: null,
            away_slot_label: null,
            match_name: `${groupName} - M${round * matchesPerRound + mi + 1}`,
            round_number: round + 1,
          });
        }
      }
      if (newMatches.length > 0) {
        await supabase.from("matches").insert(newMatches);
      }
    }
  };

  useEffect(() => {
    fetchGroups();
    fetchMatchConfig();
  }, [phaseId]);

  const cleanupOrphanedGroupMatches = async (phaseGroups: Group[]) => {
    const validGroupIds = new Set(phaseGroups.map((group) => group.id));

    const { data: phaseMatches, error: matchesError } = await supabase
      .from("matches")
      .select("id, group_id")
      .eq("tournament_id", tournamentId)
      .eq("phase_id", phaseId)
      .not("group_id", "is", null);

    if (matchesError) throw matchesError;

    const orphanedMatchIds = (phaseMatches || [])
      .filter((match) => match.group_id && !validGroupIds.has(match.group_id))
      .map((match) => match.id);

    if (orphanedMatchIds.length === 0) return;

    const { error: statsDeleteError } = await supabase
      .from("match_stats")
      .delete()
      .eq("tournament_id", tournamentId)
      .in("match_id", orphanedMatchIds);

    if (statsDeleteError) throw statsDeleteError;

    const { error: matchesDeleteError } = await supabase
      .from("matches")
      .delete()
      .eq("tournament_id", tournamentId)
      .in("id", orphanedMatchIds);

    if (matchesDeleteError) throw matchesDeleteError;
  };

  const fetchGroups = async () => {
    const { data, error } = await supabase
      .from("groups")
      .select("id, name, logo_url, scoring_system_id")
      .eq("phase_id", phaseId)
      .order("created_at");

    if (error) {
      setGroupsLoaded(true);
      return;
    }

    const nextGroups = data || [];
    await cleanupOrphanedGroupMatches(nextGroups);
    setGroups(nextGroups);
    setGroupsLoaded(true);
  };

  const uploadLogo = async (file: File, groupId: string): Promise<string | null> => {
    try {
      const compressed = await compressImage(file);
      const path = `${tournamentId}/group_${groupId}_${Date.now()}.webp`;
      const { error } = await supabase.storage.from("team-logos").upload(path, compressed, { upsert: true });
      if (error) return null;
      const { data: urlData } = supabase.storage.from("team-logos").getPublicUrl(path);
      return urlData.publicUrl;
    } catch {
      return null;
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setDialogLogoFile(file);
    setDialogLogoPreview(URL.createObjectURL(file));
  };

  const openCreateDialog = () => {
    setDialogName("");
    setDialogSlots(4);
    setDialogMatchType(phaseMatchType);
    setDialogEncounters(phaseEncounters);
    setDialogRounds(phaseRounds);
    setDialogMatchGenMode("auto");
    setDialogLogoFile(null);
    setDialogLogoPreview(null);
    // Default to the phase's scoring system, or first available
    const sortedSystems = [...scoringSystems].sort((a, b) => a.sort_order - b.sort_order);
    setDialogScoringSystemId(phaseScoringSystemId ?? sortedSystems[0]?.id ?? null);
    setCreateOpen(true);
  };

  const [editSlotCount, setEditSlotCount] = useState(0);
  const [originalSlotCount, setOriginalSlotCount] = useState(0);
  const [logoRemoved, setLogoRemoved] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showRandomConfirm, setShowRandomConfirm] = useState(false);
  const [hasAssignedTeams, setHasAssignedTeams] = useState(false);

  const notifySlotChange = () => {
    setSlotRefreshKey((k) => k + 1);
    onSlotChange?.();
  };

  // ---- Handmatige wedstrijdplanning per groep ----
  type PlanMatch = { id: string; round_number: number | null; match_name: string | null; home: string; away: string };
  type PlanSlot = { slot_code: string; team_id: string | null; label: string };
  const [manualGroupIds, setManualGroupIds] = useState<Set<string>>(new Set());
  const [planOpen, setPlanOpen] = useState(false);
  const planDialogRef = useDialogFocus(planOpen);
  const [planGroup, setPlanGroup] = useState<Group | null>(null);
  const [planMatches, setPlanMatches] = useState<PlanMatch[]>([]);
  const [planSlots, setPlanSlots] = useState<PlanSlot[]>([]);
  const [planSaving, setPlanSaving] = useState(false);
  const [planLoading, setPlanLoading] = useState(false);
  const [planHintGroupId, setPlanHintGroupId] = useState<string | null>(null);
  const planHintKey = `plan-hint-dismissed-${phaseId}`;

  const dismissPlanHint = () => {
    setPlanHintGroupId(null);
    try { localStorage.setItem(planHintKey, "1"); } catch { /* ignore */ }
  };

  const refreshManualGroups = async () => {
    const { data } = await supabase
      .from("matches")
      .select("group_id, home_slot_label, away_slot_label")
      .eq("tournament_id", tournamentId)
      .eq("phase_id", phaseId)
      .not("group_id", "is", null);
    const ids = new Set<string>();
    for (const m of data || []) {
      if (m.group_id && (!m.home_slot_label || !m.away_slot_label)) ids.add(m.group_id);
    }
    setManualGroupIds(ids);

    let dismissed = false;
    try { dismissed = localStorage.getItem(planHintKey) === "1"; } catch { /* ignore */ }
    if (!dismissed && ids.size > 0) {
      const firstGroup = groups.find((g) => ids.has(g.id));
      if (firstGroup) setPlanHintGroupId(firstGroup.id);
    } else if (ids.size === 0) {
      setPlanHintGroupId(null);
    }
  };

  useEffect(() => {
    refreshManualGroups();
  }, [phaseId, groups.length, slotRefreshKey, refreshKey]);

  const openPlanDialog = async (group: Group) => {
    setPlanGroup(group);
    setPlanOpen(true);
    setPlanMatches([]);
    setPlanSlots([]);
    setPlanLoading(true);
    setPlanHintGroupId(null);

    const loadOnce = async () => {
      const [{ data: slots }, { data: matches }, { data: teams }] = await Promise.all([
        supabase.from("slots").select("slot_code, team_id, sort_order").eq("group_id", group.id).eq("tournament_id", tournamentId).order("sort_order"),
        supabase.from("matches").select("id, round_number, match_name, home_slot_label, away_slot_label").eq("group_id", group.id).eq("tournament_id", tournamentId).eq("phase_id", phaseId).order("round_number").order("created_at"),
        supabase.from("teams").select("id, name").eq("tournament_id", tournamentId),
      ]);

      const teamNames = new Map((teams || []).map(t => [t.id, t.name]));
      setPlanSlots((slots || []).map(s => ({
        slot_code: s.slot_code,
        team_id: s.team_id,
        label: (s.team_id ? teamNames.get(s.team_id) : null) || s.slot_code,
      })));
      setPlanMatches((matches || []).map(m => ({
        id: m.id,
        round_number: m.round_number,
        match_name: m.match_name,
        home: m.home_slot_label || "",
        away: m.away_slot_label || "",
      })));
      return (matches || []).length;
    };

    let count = await loadOnce();
    for (let attempt = 0; attempt < 4 && count === 0; attempt++) {
      await new Promise((r) => setTimeout(r, 400));
      count = await loadOnce();
    }
    setPlanLoading(false);
  };

  const setPlanValue = (matchId: string, side: "home" | "away", value: string) => {
    setPlanMatches(prev => prev.map(m => (m.id === matchId ? { ...m, [side]: value } : m)));
  };

  const savePlan = async () => {
    if (!planGroup) return;
    const invalid = planMatches.find(m => m.home && m.away && m.home === m.away);
    if (invalid) {
      toast({ title: "Ongeldige wedstrijd", description: "Een team kan niet tegen zichzelf spelen.", variant: "destructive" });
      return;
    }
    // Elk team mag per speelronde slechts 1x voorkomen
    const rounds = new Set(planMatches.map(m => m.round_number ?? 0));
    for (const round of rounds) {
      const used = new Set<string>();
      for (const m of planMatches.filter(x => (x.round_number ?? 0) === round)) {
        for (const code of [m.home, m.away]) {
          if (!code) continue;
          if (used.has(code)) {
            toast({ title: `Ronde ${round}`, description: "Elk team kan per speelronde maar 1 keer spelen.", variant: "destructive" });
            return;
          }
          used.add(code);
        }
      }
    }
    setPlanSaving(true);
    const slotMap = new Map(planSlots.map(s => [s.slot_code, s]));
    await Promise.all(planMatches.map(m =>
      Promise.resolve(supabase.from("matches").update({
        home_slot_label: m.home || null,
        away_slot_label: m.away || null,
        home_team_id: m.home ? (slotMap.get(m.home)?.team_id ?? null) : null,
        away_team_id: m.away ? (slotMap.get(m.away)?.team_id ?? null) : null,
      }).eq("id", m.id))
    ));
    setPlanSaving(false);
    setPlanOpen(false);
    toast({ title: "Wedstrijden opgeslagen" });
    notifySlotChange();
    refreshManualGroups();
  };

  const checkAssignedTeams = async () => {
    const { data } = await supabase
      .from("slots")
      .select("id")
      .eq("phase_id", phaseId)
      .not("team_id", "is", null)
      .limit(1);
    setHasAssignedTeams((data?.length || 0) > 0);
  };

  useEffect(() => {
    checkAssignedTeams();
  }, [phaseId, slotRefreshKey, refreshKey]);

  const openEditDialog = async (group: Group) => {
    setEditingGroup(group);
    setDialogName(group.name);
    setDialogLogoFile(null);
    setDialogLogoPreview(group.logo_url || null);
    setLogoRemoved(false);
    setDialogMatchType(phaseMatchType);
    setDialogEncounters(phaseEncounters);
    setDialogRounds(phaseRounds);
    setDialogMatchGenMode("auto");
    // For existing group: use its own scoring system, fallback to phase, fallback to first
    const sortedSystems = [...scoringSystems].sort((a, b) => a.sort_order - b.sort_order);
    setDialogScoringSystemId(group.scoring_system_id ?? phaseScoringSystemId ?? sortedSystems[0]?.id ?? null);
    // Fetch current slot count for this group
    const { data: slots } = await supabase
      .from("slots")
      .select("id")
      .eq("group_id", group.id);
    const count = slots?.length || 0;
    setEditSlotCount(count);
    setOriginalSlotCount(count);
    setEditOpen(true);
  };

  const addGroup = async () => {
    const { data: existingSlots } = await supabase
      .from("slots")
      .select("id")
      .eq("phase_id", phaseId);
    const currentTotal = existingSlots?.length || 0;
    const newTotal = currentTotal + dialogSlots;

    if (newTotal > 128) {
      toast({
        title: "Capaciteit overschreden",
        description: `Er zijn al ${currentTotal} slots in deze fase. ${dialogSlots} extra zou ${newTotal} geven (max 128).`,
        variant: "destructive",
      });
      return;
    }

    // Update phase match_config if competition type changed
    if (dialogMatchType !== phaseMatchType || dialogEncounters !== phaseEncounters || dialogRounds !== phaseRounds) {
      await supabase.from("tournament_phases").update({
        match_config: { matchType: dialogMatchType, encounters: dialogEncounters, rounds: dialogRounds },
      } as any).eq("id", phaseId);
      setPhaseMatchType(dialogMatchType);
      setPhaseEncounters(dialogEncounters);
      setPhaseRounds(dialogRounds);
    }

    setUploading(true);
    const name = dialogName.trim() || `Group ${String.fromCharCode(65 + groups.length)}`;
    const groupLetter = name.replace(/[^A-Za-z]/g, "").charAt(0).toUpperCase() || String.fromCharCode(65 + groups.length);
    const { data } = await supabase
      .from("groups")
      .insert({ phase_id: phaseId, tournament_id: tournamentId, name, scoring_system_id: dialogScoringSystemId } as any)
      .select("id, name, logo_url, scoring_system_id")
      .single();
    if (data) {
      if (dialogLogoFile) {
        const logoUrl = await uploadLogo(dialogLogoFile, data.id);
        if (logoUrl) {
          await supabase.from("groups").update({ logo_url: logoUrl }).eq("id", data.id);
          data.logo_url = logoUrl;
        }
      }

      const slotsToInsert = Array.from({ length: dialogSlots }, (_, j) => ({
        tournament_id: tournamentId,
        phase_id: phaseId,
        group_id: data.id,
        slot_code: `${groupLetter}${j + 1}`,
        sort_order: j,
      }));
      await supabase.from("slots").insert(slotsToInsert);
      await generateMatchesForGroup(data.id, dialogMatchType, dialogEncounters, dialogRounds, dialogMatchGenMode);
      setGroups((g) => [...g, data]);
      await refreshManualGroups();
      if (dialogMatchType === "rounds" && dialogMatchGenMode === "empty") {
        setPlanHintGroupId(data.id);
      }
      toast({ title: `${name} toegevoegd met ${dialogSlots} slots en wedstrijden` });
    }
    setUploading(false);
    setCreateOpen(false);
    notifySlotChange();
  };

  const saveGroupEdit = async () => {
    if (!editingGroup) return;

    const slotCountChanged = editSlotCount !== originalSlotCount;
    const matchTypeChanged = dialogMatchType !== phaseMatchType || dialogEncounters !== phaseEncounters || dialogRounds !== phaseRounds;

    // Handle reducing slots
    if (editSlotCount < originalSlotCount) {
      const diff = originalSlotCount - editSlotCount;
      const { data: groupSlots } = await supabase
        .from("slots")
        .select("id, team_id, slot_code")
        .eq("group_id", editingGroup.id)
        .order("sort_order", { ascending: false });
      const slotsToRemove = groupSlots?.slice(0, diff) || [];
      const occupiedCount = slotsToRemove.filter(s => s.team_id).length;
      if (occupiedCount > 0) {
        const confirmed = window.confirm(
          `Let op: ${occupiedCount} van de ${diff} te verwijderen slots heeft al een team toegewezen. Wil je doorgaan?`
        );
        if (!confirmed) return;
      }

      for (const slot of slotsToRemove) {
        if (slot.team_id) {
          await supabase.from("group_teams").delete()
            .eq("group_id", editingGroup.id)
            .eq("team_id", slot.team_id)
            .eq("tournament_id", tournamentId);
        }
      }

      const idsToRemove = slotsToRemove.map(s => s.id);
      if (idsToRemove.length > 0) {
        await supabase.from("slots").delete().in("id", idsToRemove);
      }
    } else if (editSlotCount > originalSlotCount) {
      const diff = editSlotCount - originalSlotCount;
      const groupLetter = editingGroup.name.replace(/[^A-Za-z]/g, "").charAt(0).toUpperCase() || "X";
      const newSlots = Array.from({ length: diff }, (_, j) => ({
        tournament_id: tournamentId,
        phase_id: phaseId,
        group_id: editingGroup.id,
        slot_code: `${groupLetter}${originalSlotCount + j + 1}`,
        sort_order: originalSlotCount + j,
      }));
      await supabase.from("slots").insert(newSlots);
    }

    // Update match config if changed
    if (matchTypeChanged) {
      await supabase.from("tournament_phases").update({
        match_config: { matchType: dialogMatchType, encounters: dialogEncounters, rounds: dialogRounds },
      } as any).eq("id", phaseId);
      setPhaseMatchType(dialogMatchType);
      setPhaseEncounters(dialogEncounters);
      setPhaseRounds(dialogRounds);
    }

    // If slot count or match type changed, regenerate matches for ALL groups
    if (slotCountChanged || matchTypeChanged) {
      const allGroups = await supabase.from("groups").select("id").eq("phase_id", phaseId);
      for (const g of (allGroups.data || [])) {
        await generateMatchesForGroup(g.id, dialogMatchType, dialogEncounters, dialogRounds, dialogMatchGenMode);
      }
    }

    setUploading(true);
    const updates: { name?: string; logo_url?: string | null; scoring_system_id?: string | null } = {};
    if (dialogName.trim() && dialogName.trim() !== editingGroup.name) {
      updates.name = dialogName.trim();
    }
    if (logoRemoved && !dialogLogoFile) {
      if (editingGroup.logo_url) {
        try {
          const url = new URL(editingGroup.logo_url);
          const pathMatch = url.pathname.match(/\/object\/public\/team-logos\/(.+)/);
          if (pathMatch) {
            await supabase.storage.from("team-logos").remove([pathMatch[1]]);
          }
        } catch { /* ignore parse errors */ }
      }
      updates.logo_url = null;
    }
    if (dialogLogoFile) {
      const logoUrl = await uploadLogo(dialogLogoFile, editingGroup.id);
      if (logoUrl) updates.logo_url = logoUrl;
    }
    // Always sync scoring_system_id (could be set back to null = inherit)
    if (dialogScoringSystemId !== (editingGroup.scoring_system_id ?? null)) {
      updates.scoring_system_id = dialogScoringSystemId;
    }
    if (Object.keys(updates).length > 0) {
      await supabase.from("groups").update(updates as any).eq("id", editingGroup.id);
      setGroups((g) => g.map((x) => (x.id === editingGroup.id ? { ...x, ...updates } : x)));
    }
    setUploading(false);
    setEditOpen(false);
    setEditingGroup(null);
    notifySlotChange();
  };

  const [deleteGroupId, setDeleteGroupId] = useState<string | null>(null);

  const confirmRemoveGroup = async () => {
    if (!deleteGroupId) return;

    try {
      const { data: groupSlots, error: slotsReadError } = await supabase
        .from("slots")
        .select("slot_code")
        .eq("group_id", deleteGroupId)
        .eq("phase_id", phaseId)
        .eq("tournament_id", tournamentId);

      if (slotsReadError) throw slotsReadError;

      const slotCodes = (groupSlots || []).map((slot) => slot.slot_code).filter(Boolean);

      const { data: phaseMatches, error: matchesReadError } = await supabase
        .from("matches")
        .select("id, group_id, home_slot_label, away_slot_label")
        .eq("tournament_id", tournamentId)
        .eq("phase_id", phaseId);

      if (matchesReadError) throw matchesReadError;

      const relatedMatchIds = (phaseMatches || [])
        .filter((match) => {
          if (match.group_id === deleteGroupId) return true;
          if (slotCodes.length === 0) return false;
          return (
            !!match.home_slot_label &&
            !!match.away_slot_label &&
            slotCodes.includes(match.home_slot_label) &&
            slotCodes.includes(match.away_slot_label)
          );
        })
        .map((match) => match.id);

      if (relatedMatchIds.length > 0) {
        const { error: statsDeleteError } = await supabase
          .from("match_stats")
          .delete()
          .eq("tournament_id", tournamentId)
          .in("match_id", relatedMatchIds);

        if (statsDeleteError) throw statsDeleteError;

        const { error: matchesDeleteError } = await supabase
          .from("matches")
          .delete()
          .eq("tournament_id", tournamentId)
          .in("id", relatedMatchIds);

        if (matchesDeleteError) throw matchesDeleteError;
      }

      const [{ error: fromProgressionError }, { error: toProgressionError }] = await Promise.all([
        supabase
          .from("phase_progressions")
          .delete()
          .eq("tournament_id", tournamentId)
          .eq("from_group_id", deleteGroupId),
        supabase
          .from("phase_progressions")
          .delete()
          .eq("tournament_id", tournamentId)
          .eq("to_group_id", deleteGroupId),
      ]);

      if (fromProgressionError) throw fromProgressionError;
      if (toProgressionError) throw toProgressionError;

      const [{ error: slotsDeleteError }, { error: groupTeamsDeleteError }] = await Promise.all([
        supabase.from("slots").delete().eq("group_id", deleteGroupId).eq("tournament_id", tournamentId),
        supabase.from("group_teams").delete().eq("group_id", deleteGroupId).eq("tournament_id", tournamentId),
      ]);

      if (slotsDeleteError) throw slotsDeleteError;
      if (groupTeamsDeleteError) throw groupTeamsDeleteError;

      const { error: groupDeleteError } = await supabase.from("groups").delete().eq("id", deleteGroupId);
      if (groupDeleteError) throw groupDeleteError;

      setGroups((g) => g.filter((x) => x.id !== deleteGroupId));
      setDeleteGroupId(null);
      notifySlotChange();
      await fetchGroups();
      toast({ title: "Groep en bijbehorende wedstrijden verwijderd" });
    } catch (error: any) {
      toast({
        title: "Verwijderen mislukt",
        description: error?.message || "De groep kon niet volledig verwijderd worden.",
        variant: "destructive",
      });
    }
  };

  const randomAssignTeams = async () => {
    const { data: phaseSlots } = await supabase
      .from("slots")
      .select("id, group_id, team_id, slot_code, sort_order")
      .eq("phase_id", phaseId)
      .order("sort_order");
    if (!phaseSlots) return;

    const currentPhase = phases.find(p => p.id === phaseId);
    const currentPhaseNumber = currentPhase?.phase_number ?? phaseNumber;
    const siblingPhaseIds = phases.filter(p => p.phase_number === currentPhaseNumber).map(p => p.id);

    const { data: allSiblingSlots } = await supabase
      .from("slots")
      .select("team_id")
      .in("phase_id", siblingPhaseIds);

    let teamQuery = supabase.from("teams").select("id, name, logo_url, category_id").eq("tournament_id", tournamentId).order("name");
    const { data: allTeams } = await teamQuery;
    if (!allTeams) return;

    const filteredTeams = categoryId ? allTeams.filter(t => t.category_id === categoryId) : allTeams;

    const assignedIds = new Set(
      (allSiblingSlots || []).filter(s => s.team_id).map(s => s.team_id!)
    );

    if (currentPhaseNumber > 1) {
      const earlierPhaseIds = phases.filter(p => p.phase_number < currentPhaseNumber).map(p => p.id);
      if (earlierPhaseIds.length > 0) {
        const { data: earlierSlots } = await supabase
          .from("slots")
          .select("team_id")
          .in("phase_id", earlierPhaseIds);
        if (earlierSlots) {
          for (const s of earlierSlots) {
            if (s.team_id) assignedIds.add(s.team_id);
          }
        }
      }
    }

    const emptySlotsWithGroup = phaseSlots.filter(s => !s.team_id);
    const available = filteredTeams.filter(t => !assignedIds.has(t.id));
    const shuffled = [...available].sort(() => Math.random() - 0.5);
    const toAssign = Math.min(shuffled.length, emptySlotsWithGroup.length);
    if (toAssign === 0) {
      toast({ title: "Geen teams beschikbaar", description: "Alle slots zijn al gevuld of er zijn geen teams.", variant: "destructive" });
      return;
    }

    const slotUpdates = [];
    const groupTeamsToInsert: { group_id: string; team_id: string; tournament_id: string }[] = [];

    for (let i = 0; i < toAssign; i++) {
      const slot = emptySlotsWithGroup[i];
      const team = shuffled[i];
      slotUpdates.push({ slotId: slot.id, teamId: team.id, slotCode: slot.slot_code, groupId: slot.group_id });
      if (slot.group_id) {
        groupTeamsToInsert.push({ group_id: slot.group_id, team_id: team.id, tournament_id: tournamentId });
      }
    }

    await Promise.all(slotUpdates.map(u =>
      Promise.resolve(supabase.from("slots").update({ team_id: u.teamId }).eq("id", u.slotId))
    ));

    await Promise.all(slotUpdates.filter(u => u.slotCode).flatMap(u => {
      const base = { tournament_id: tournamentId, phase_id: phaseId };
      const homeQ = u.groupId
        ? supabase.from("matches").update({ home_team_id: u.teamId }).match({ ...base, home_slot_label: u.slotCode, group_id: u.groupId })
        : supabase.from("matches").update({ home_team_id: u.teamId }).match({ ...base, home_slot_label: u.slotCode }).is("group_id", null);
      const awayQ = u.groupId
        ? supabase.from("matches").update({ away_team_id: u.teamId }).match({ ...base, away_slot_label: u.slotCode, group_id: u.groupId })
        : supabase.from("matches").update({ away_team_id: u.teamId }).match({ ...base, away_slot_label: u.slotCode }).is("group_id", null);
      return [Promise.resolve(homeQ), Promise.resolve(awayQ)];
    }));

    if (groupTeamsToInsert.length > 0) {
      await supabase.from("group_teams").upsert(groupTeamsToInsert, { onConflict: "group_id,team_id" } as any);
    }

    toast({ title: `${toAssign} teams willekeurig ingedeeld!` });
    notifySlotChange();
    fetchGroups();
  };

  const clearAllSlots = async () => {
    const { data: phaseSlots } = await supabase
      .from("slots")
      .select("id, group_id, team_id, slot_code")
      .eq("phase_id", phaseId);
    if (!phaseSlots || phaseSlots.length === 0) return;

    for (const slot of phaseSlots) {
      if (slot.team_id && slot.group_id) {
        await supabase.from("group_teams").delete()
          .eq("group_id", slot.group_id)
          .eq("team_id", slot.team_id)
          .eq("tournament_id", tournamentId);
      }
    }

    // Reset slots: team_id én alle doorstromingsverwijzingen
    await supabase.from("slots").update({
      team_id: null, ref_phase_id: null, ref_group_id: null, ref_position: null,
    }).eq("phase_id", phaseId);

    // Verwijder ALLE matchstatistieken (doelpunten, assists, kaarten) van deze fase
    const { data: phaseMatchIds } = await supabase
      .from("matches")
      .select("id")
      .eq("phase_id", phaseId)
      .eq("tournament_id", tournamentId);
    const matchIds = (phaseMatchIds ?? []).map(m => m.id);
    if (matchIds.length > 0) {
      await supabase.from("match_stats").delete().in("match_id", matchIds);
    }

    // Reset matches volledig: teams + ALLE resultaatvelden (scores, penalties, sets, gespeeld-vlag)
    await supabase.from("matches").update({
      home_team_id: null,
      away_team_id: null,
      home_score: null,
      away_score: null,
      home_penalties: null,
      away_penalties: null,
      set_scores: null,
      is_played: false,
    }).eq("phase_id", phaseId).eq("tournament_id", tournamentId);

    toast({ title: "Alle slots, resultaten en doorstroming leeggemaakt" });
    notifySlotChange();
    fetchGroups();
  };

  const addLabel = phaseType === "knockout" ? "Ronde" : phaseType === "round_robin" ? "League" : "Groep";

  const renderGroupCard = (group: Group) => (
    <div key={group.id} className="rounded-lg border border-border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {group.logo_url && (
            <img src={group.logo_url} alt="" className="h-6 w-6 rounded object-cover" />
          )}
          <h4 className="font-display font-bold text-foreground">{group.name}</h4>
          <button
            onClick={() => openEditDialog(group)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground sm:h-auto sm:w-auto sm:p-1"
            aria-label={`${group.name} bewerken`}
          >
            <Pencil className="h-3 w-3" />
          </button>
          {manualGroupIds.has(group.id) && (
            <div className="relative inline-flex items-center">
              <button
                onClick={() => openPlanDialog(group)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-md text-primary hover:bg-primary/10 sm:h-auto sm:w-auto sm:p-1"
                aria-label={`Wedstrijden plannen voor ${group.name}`}
                title="Wedstrijden plannen"
              >
                <CalendarDays className="h-3.5 w-3.5" />
              </button>
              {planHintGroupId === group.id && (
                <div className="absolute left-1/2 top-full z-30 mt-2 w-56 -translate-x-1/2 rounded-md border border-primary/40 bg-popover p-2 text-xs text-foreground shadow-lg">
                  <span className="absolute -top-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 border-l border-t border-primary/40 bg-popover" />
                  Hier kan je de wedstrijden handmatig ingeven.
                  <button
                    onClick={(e) => { e.stopPropagation(); dismissPlanHint(); }}
                    className="mt-1 block text-[11px] font-semibold text-primary hover:underline"
                  >
                    Begrepen
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
        <button onClick={() => setDeleteGroupId(group.id)} className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive sm:h-auto sm:w-auto sm:p-1" aria-label={`${group.name} verwijderen`}>
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      <SlotManager
        tournamentId={tournamentId}
        phaseId={phaseId}
        groupId={group.id}
        groupName={group.name}
        phaseNumber={phaseNumber}
        phases={phases}
        categoryId={categoryId}
        refreshKey={slotRefreshKey + (refreshKey ?? 0)}
        onSlotChange={notifySlotChange}
      />
    </div>
  );

  const renderLogoUpload = () => (
    <div className="space-y-2">
      <label className="text-sm font-medium">Logo (optioneel)</label>
      <div className="flex items-center gap-3">
        {dialogLogoPreview ? (
          <div className="relative">
            <img src={dialogLogoPreview} alt="" className="h-12 w-12 rounded-lg object-cover border border-border" />
            <button
              onClick={() => { setDialogLogoFile(null); setDialogLogoPreview(null); setLogoRemoved(true); }}
              className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full p-0.5"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => fileInputRef.current?.click()}
            className="h-12 w-12 rounded-lg border-2 border-dashed border-border flex items-center justify-center text-muted-foreground hover:border-primary hover:text-primary transition-colors"
          >
            <Upload className="h-4 w-4" />
          </button>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileSelect}
        />
      </div>
    </div>
  );

  const renderCompetitionTypeSelector = (isEdit: boolean) => {
    // Determine if anything has changed that warrants a warning
    const sizeChanged = isEdit && editSlotCount !== originalSlotCount;
    const typeChanged = isEdit && (dialogMatchType !== phaseMatchType || dialogEncounters !== phaseEncounters || dialogRounds !== phaseRounds);
    const showWarning = sizeChanged || typeChanged;

    return (
      <div className="space-y-3">
        <div className="space-y-1">
          <Label className="text-xs">Competitieformat</Label>
          <div className="grid grid-cols-2 gap-2">
            {COMPETITION_TYPES.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setDialogMatchType(opt.value)}
                className={`rounded-lg border p-2.5 text-left transition-all text-xs ${
                  dialogMatchType === opt.value
                    ? "border-y-2 border-y-primary bg-primary/[0.06]"
                    : "border-border hover:border-primary/20"
                }`}
              >
                <p className="font-bold text-foreground uppercase tracking-wide">{opt.label}</p>
                <p className="text-muted-foreground mt-0.5">{opt.desc}</p>
              </button>
            ))}
          </div>
        </div>
        {dialogMatchType === "multiple" && (
          <div className="space-y-1">
            <Label className="text-xs">Aantal ontmoetingen per tegenstander</Label>
            <Select value={String(dialogEncounters)} onValueChange={(v) => setDialogEncounters(parseInt(v))}>
              <SelectTrigger className="h-10 w-full max-w-[200px]"><SelectValue /></SelectTrigger>
              <SelectContent className="max-h-64">
                {Array.from({ length: 8 }, (_, i) => i + 3).map((n) => (
                  <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        {dialogMatchType === "rounds" && (
          <div className="space-y-1">
            <Label className="text-xs">Aantal speelrondes</Label>
            <Select value={String(dialogRounds)} onValueChange={(v) => setDialogRounds(parseInt(v))}>
              <SelectTrigger className="h-10 w-full max-w-[200px]"><SelectValue /></SelectTrigger>
              <SelectContent className="max-h-64">
                {Array.from({ length: 126 }, (_, i) => i + 1).map((n) => (
                  <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        {dialogMatchType === "rounds" && (
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
                    type="button"
                    onClick={() => setDialogMatchGenMode(opt.value)}
                    className={`rounded-lg border p-2.5 text-center transition-all text-xs ${
                      dialogMatchGenMode === opt.value
                        ? "border-y-2 border-y-primary bg-primary/[0.06]"
                        : "border-border hover:border-primary/20"
                    }`}
                  >
                    <p className="font-bold text-foreground uppercase tracking-wide">{opt.label}</p>
                  </button>
                ))}
              </div>
            </div>
        )}
        {showWarning && (
          <p className="text-xs text-destructive font-medium">
            Let op: bij het wijzigen van de {sizeChanged && typeChanged ? "poulegrootte en competitieformat" : sizeChanged ? "poulegrootte" : "competitieformat"} worden de wedstrijden die al gepland zijn uit het schema gehaald.
          </p>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {phaseType === "knockout" && (
        <p className="text-xs text-muted-foreground">
          Bracket (knockout). Wijs teams of posities toe aan de bracket slots.
        </p>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        {showRandomAssign && (
          <Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={() => {
            if (hasAssignedTeams) { setShowRandomConfirm(true); } else { randomAssignTeams(); }
          }}>
            <Shuffle className="h-3 w-3" /> Willekeurige indeling
          </Button>
        )}
        <Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={() => setShowClearConfirm(true)}>
          <Trash2 className="h-3 w-3" /> Alles leeg maken
        </Button>
      </div>

      {/* Grid layout for groups */}
      {!groupsLoaded && groups.length === 0 ? (
        <div className="flex justify-center py-6">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {groups.map((g) => renderGroupCard(g))}
            {(phaseType === "group" || phaseType === "round_robin") && (
              <button
                onClick={openCreateDialog}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-border px-3 py-6 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors min-h-[80px]"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>{addLabel}</span>
              </button>
            )}
          </div>
        </>
      )}

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent ref={createDialogRef} className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{addLabel} toevoegen</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Naam</label>
              <Input
                value={dialogName}
                onChange={(e) => setDialogName(e.target.value)}
                placeholder={`${addLabel} naam (optioneel)`}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Aantal teams</label>
              <Select value={String(dialogSlots)} onValueChange={(v) => setDialogSlots(parseInt(v))}>
                <SelectTrigger className="w-full h-10"><SelectValue /></SelectTrigger>
                <SelectContent className="max-h-64">
                  {Array.from({ length: 63 }, (_, i) => i + 2).map((n) => (
                    <SelectItem key={n} value={String(n)}>{n} teams</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {renderCompetitionTypeSelector(false)}
            <ScoringSystemSelector
              systems={scoringSystems}
              value={dialogScoringSystemId}
              onChange={setDialogScoringSystemId}
            />
            {renderLogoUpload()}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Annuleren</Button>
            <Button onClick={addGroup} disabled={uploading}>
              {uploading ? "Bezig..." : "Toevoegen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={(open) => { setEditOpen(open); if (!open) setEditingGroup(null); }}>
        <DialogContent ref={editDialogRef} className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{addLabel} bewerken</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Naam</label>
              <Input
                value={dialogName}
                onChange={(e) => setDialogName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Aantal teams</label>
              <Select value={String(editSlotCount)} onValueChange={(v) => setEditSlotCount(parseInt(v))}>
                <SelectTrigger className="w-full h-10"><SelectValue /></SelectTrigger>
                <SelectContent className="max-h-64">
                  {Array.from({ length: 63 }, (_, i) => i + 2).map((n) => (
                    <SelectItem key={n} value={String(n)}>{n} teams</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {renderCompetitionTypeSelector(true)}
            <ScoringSystemSelector
              systems={scoringSystems}
              value={dialogScoringSystemId}
              onChange={setDialogScoringSystemId}
            />
            {renderLogoUpload()}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Annuleren</Button>
            <Button onClick={saveGroupEdit} disabled={uploading}>
              {uploading ? "Bezig..." : "Opslaan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Handmatige wedstrijdplanning */}
      <Dialog open={planOpen} onOpenChange={(open) => { setPlanOpen(open); if (!open) setPlanGroup(null); }}>
        <DialogContent ref={planDialogRef} className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Wedstrijden plannen{planGroup ? ` — ${planGroup.name}` : ""}</DialogTitle>
          </DialogHeader>
          <div className="space-y-5">
            {planLoading && planMatches.length === 0 ? (
              <div className="space-y-2">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="h-9 animate-pulse rounded-md bg-muted" />
                ))}
              </div>
            ) : planMatches.length === 0 ? (
              <p className="text-sm text-muted-foreground">Geen wedstrijden gevonden.</p>
            ) : (
              Array.from(new Set(planMatches.map(m => m.round_number ?? 0))).sort((a, b) => a - b).map((round) => {
                const roundMatches = planMatches.filter(m => (m.round_number ?? 0) === round);
                return (
                  <div key={round} className="space-y-2">
                    <div className="flex items-center gap-2 border-b border-border pb-1">
                      <h5 className="text-sm font-bold uppercase tracking-wide text-foreground">Ronde {round}</h5>
                      <span className="text-xs text-muted-foreground">({roundMatches.length} {roundMatches.length === 1 ? "wedstrijd" : "wedstrijden"})</span>
                    </div>
                    <div className="space-y-2">
                      {roundMatches.map((m, i) => {
                        // Elk team mag per speelronde slechts 1x gebruikt worden.
                        const usedInRound = new Set<string>();
                        roundMatches.forEach(rm => {
                          if (rm.home) usedInRound.add(rm.home);
                          if (rm.away) usedInRound.add(rm.away);
                        });
                        const optionsFor = (own: string) =>
                          planSlots.filter(s => s.slot_code === own || !usedInRound.has(s.slot_code));
                        return (
                        <div key={m.id} className="flex items-center gap-2">
                          <span className="w-6 shrink-0 text-xs text-muted-foreground">{i + 1}.</span>
                          <Select
                            value={m.home || "__empty__"}
                            onValueChange={(value) => setPlanValue(m.id, "home", value === "__empty__" ? "" : value)}
                          >
                            <SelectTrigger className="flex h-9 flex-1 min-w-0 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:border-y-2 focus:border-y-primary focus:bg-primary/[0.06]">
                              <SelectValue placeholder="Kies team" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__empty__">Kies team</SelectItem>
                              {optionsFor(m.home).map(s => (
                                <SelectItem key={s.slot_code} value={s.slot_code}>{s.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <span className="text-xs text-muted-foreground">vs</span>
                          <Select
                            value={m.away || "__empty__"}
                            onValueChange={(value) => setPlanValue(m.id, "away", value === "__empty__" ? "" : value)}
                          >
                            <SelectTrigger className="flex h-9 flex-1 min-w-0 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:border-y-2 focus:border-y-primary focus:bg-primary/[0.06]">
                              <SelectValue placeholder="Kies team" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__empty__">Kies team</SelectItem>
                              {optionsFor(m.away).map(s => (
                                <SelectItem key={s.slot_code} value={s.slot_code}>{s.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPlanOpen(false)}>Annuleren</Button>
            <Button onClick={savePlan} disabled={planSaving || planMatches.length === 0}>
              {planSaving ? "Bezig..." : "Opslaan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Clear all confirmation */}
      <AlertDialog open={showClearConfirm} onOpenChange={setShowClearConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Alles leeg maken?</AlertDialogTitle>
            <AlertDialogDescription>
              Weet je zeker dat je deze fase volledig wilt resetten? Alle teamtoewijzingen, scores, doorstroming en statistieken worden verwijderd. De wedstrijden zelf blijven bestaan maar worden volledig leeggemaakt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setShowClearConfirm(false); clearAllSlots(); }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
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
            <AlertDialogAction onClick={() => { setShowRandomConfirm(false); clearAllSlots().then(() => randomAssignTeams()); }}>
              Opnieuw indelen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteGroupId} onOpenChange={(o) => !o && setDeleteGroupId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Groep verwijderen?</AlertDialogTitle>
            <AlertDialogDescription>
              Weet je zeker dat je deze groep wilt verwijderen? Alle bijbehorende wedstrijden, slots en teamtoewijzingen worden ook verwijderd.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRemoveGroup} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Verwijderen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default GroupManager;
