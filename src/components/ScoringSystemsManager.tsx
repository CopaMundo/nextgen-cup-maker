import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, ChevronDown, ChevronUp, ArrowUp, ArrowDown, Pencil, Check, X, Info } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { StandingsColumnsInline } from "./StandingsColumnsSettings";

const TIEBREAKER_OPTIONS = [
  { value: "goal_difference", label: "Doelpuntensaldo" },
  { value: "goals_scored", label: "Aantal doelpunten gescoord" },
  { value: "head_to_head", label: "Onderling resultaat" },
  { value: "wins", label: "Aantal overwinningen" },
  { value: "fairplay", label: "Fairplay klassement" },
  { value: "drawing_lots", label: "Loting" },
];

interface SetResultPoints {
  [outcome: string]: { win: number; loss: number; draw?: number };
}

interface ScoringSystem {
  id: string;
  tournament_id: string;
  name: string;
  sort_order: number;
  scoring_type: "points" | "sets";
  points_win: number;
  points_draw: number;
  points_loss: number;
  points_big_win: number;
  big_win_threshold: number;
  points_win_overtime: number;
  points_draw_with_goals: number;
  points_draw_no_goals: number;
  points_loss_overtime: number;
  no_draws: boolean;
  tiebreaker_rules: string[];
  h2h_sub_rules: string[];
  // Set fields
  num_sets: number;
  playoff_mode: boolean;
  decisive_set: boolean;
  decisive_set_goal_diff: boolean;
  set_points_mode: "per_set" | "total_result";
  set_result_points: SetResultPoints;
}

const H2H_SUB_OPTIONS = [
  { value: "points", label: "Punten" },
  { value: "goal_difference", label: "Doelpuntensaldo" },
  { value: "goals_scored", label: "Doelpunten gescoord" },
  { value: "wins", label: "Aantal overwinningen" },
];

/**
 * Generate the possible outcomes for a given number of sets.
 * For playoff (best of N): outcomes where winner reaches ceil(N/2) sets won first.
 * For non-playoff: all W-L combinations summing to num_sets.
 */
const generateSetOutcomes = (numSets: number, playoff: boolean, decisiveSet: boolean): { key: string; isDraw: boolean }[] => {
  if (numSets <= 1) return [];
  if (playoff) {
    const needed = Math.ceil(numSets / 2);
    const outcomes: { key: string; isDraw: boolean }[] = [];
    for (let loserSets = 0; loserSets < needed; loserSets++) {
      outcomes.push({ key: `${needed}-${loserSets}`, isDraw: false });
    }
    return outcomes;
  }
  const outcomes: { key: string; isDraw: boolean }[] = [];
  for (let w = numSets; w > numSets / 2; w--) {
    outcomes.push({ key: `${w}-${numSets - w}`, isDraw: false });
  }
  // Even sets: add draw outcome unless decisive set is enabled
  if (numSets % 2 === 0 && !decisiveSet) {
    const half = numSets / 2;
    outcomes.push({ key: `${half}-${half}`, isDraw: true });
  }
  return outcomes;
};

/** Check if a scoring system has non-default advanced values */
const hasAdvancedSettings = (sys: ScoringSystem): boolean => {
  if (sys.no_draws) return true;
  if (sys.big_win_threshold !== 2) return true;
  if (sys.points_big_win !== sys.points_win) return true;
  if (sys.points_win_overtime !== sys.points_win) return true;
  if (sys.points_draw_with_goals !== sys.points_draw) return true;
  if (sys.points_draw_no_goals !== sys.points_draw) return true;
  if (sys.points_loss_overtime !== sys.points_loss) return true;
  return false;
};

type ScoringDraft = Omit<ScoringSystem, 'id' | 'tournament_id' | 'name' | 'sort_order' | 'tiebreaker_rules'>;

const ScoringSystemsManager = ({ tournamentId, tournament, onUpdate }: { tournamentId: string; tournament?: any; onUpdate?: (t: any) => void }) => {
  const { toast } = useToast();
  const [systems, setSystems] = useState<ScoringSystem[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showAdvancedId, setShowAdvancedId] = useState<string | null>(null);
  const [tiebreakerEditId, setTiebreakerEditId] = useState<string | null>(null);
  const [tiebreakerDraft, setTiebreakerDraft] = useState<string[]>([]);
  const [h2hSubDraft, setH2hSubDraft] = useState<string[]>(["points", "goal_difference", "goals_scored", "wins"]);
  const [h2hSubOpen, setH2hSubOpen] = useState(false);
  const [editingNameId, setEditingNameId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteUsage, setDeleteUsage] = useState<{
    phases: { id: string; name: string }[];
    groups: { id: string; name: string; phaseName: string }[];
    matches: { id: string; label: string }[];
  } | null>(null);
  const [loadingUsage, setLoadingUsage] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [playedCount, setPlayedCount] = useState(0);

  // Scoring edit dialog state
  const [scoringEditId, setScoringEditId] = useState<string | null>(null);
  const [scoringDraft, setScoringDraft] = useState<ScoringDraft | null>(null);

  // Confirmation alert state
  const [confirmAction, setConfirmAction] = useState<{
    title: string;
    description: string;
    onConfirm: () => Promise<void> | void;
    destructive?: boolean;
  } | null>(null);

  useEffect(() => {
    fetchSystems();
    refreshPlayedCount();
  }, [tournamentId]);

  const fetchSystems = async () => {
    const { data } = await supabase
      .from("tournament_scoring_systems" as any)
      .select("*")
      .eq("tournament_id", tournamentId)
      .order("sort_order");
    if (data) {
      const list = (data as any[]).map((s) => ({
        ...s,
        tiebreaker_rules: Array.isArray(s.tiebreaker_rules) ? (s.tiebreaker_rules.includes("wins") ? s.tiebreaker_rules : [...s.tiebreaker_rules, "wins"]) : ["goal_difference", "goals_scored", "head_to_head", "wins"],
        h2h_sub_rules: Array.isArray(s.h2h_sub_rules) ? s.h2h_sub_rules : ["points", "goal_difference", "goals_scored", "wins"],
        num_sets: s.num_sets ?? 1,
        playoff_mode: s.playoff_mode ?? false,
        decisive_set: s.decisive_set ?? false,
        decisive_set_goal_diff: s.decisive_set_goal_diff ?? false,
        set_points_mode: s.set_points_mode ?? "total_result",
        set_result_points: (typeof s.set_result_points === "object" && s.set_result_points !== null) ? s.set_result_points : {},
      })) as ScoringSystem[];
      setSystems(list);
      const firstId = list[0]?.id ?? null;
      if (!expandedId && firstId) setExpandedId(firstId);
      const expanded = expandedId || firstId;
      if (expanded) {
        const sys = list.find((s) => s.id === expanded);
        if (sys && hasAdvancedSettings(sys)) {
          setShowAdvancedId(sys.id);
        }
      }
    }
  };

  const refreshPlayedCount = async () => {
    const c = await checkPlayedMatches();
    setPlayedCount(c);
  };

  const checkPlayedMatches = async (): Promise<number> => {
    const { count } = await supabase
      .from("matches")
      .select("id", { count: "exact", head: true })
      .eq("tournament_id", tournamentId)
      .eq("is_played", true);
    return count || 0;
  };

  const applyUpdate = async (id: string, updates: Partial<ScoringSystem>) => {
    setSystems((prev) => prev.map((s) => (s.id === id ? { ...s, ...updates } : s)));
    const { error } = await supabase
      .from("tournament_scoring_systems" as any)
      .update(updates as any)
      .eq("id", id);
    if (error) {
      toast({ title: "Opslaan mislukt", description: error.message, variant: "destructive" });
    }
  };

  /** When played matches exist, redirect any inline edit attempt to the full dialog */
  const guardInlineEdit = (sys: ScoringSystem, e?: React.FocusEvent<HTMLInputElement>) => {
    if (playedCount > 0) {
      e?.target.blur();
      openScoringEdit(sys);
      return true;
    }
    return false;
  };

  /** Open scoring edit dialog */
  const openScoringEdit = (sys: ScoringSystem) => {
    setScoringEditId(sys.id);
    setScoringDraft({
      scoring_type: sys.scoring_type,
      points_win: sys.points_win,
      points_draw: sys.points_draw,
      points_loss: sys.points_loss,
      points_big_win: sys.points_big_win,
      big_win_threshold: sys.big_win_threshold,
      points_win_overtime: sys.points_win_overtime,
      points_draw_with_goals: sys.points_draw_with_goals,
      points_draw_no_goals: sys.points_draw_no_goals,
      points_loss_overtime: sys.points_loss_overtime,
      no_draws: sys.no_draws,
      h2h_sub_rules: sys.h2h_sub_rules || ["points", "goal_difference", "goals_scored", "wins"],
      num_sets: sys.num_sets,
      playoff_mode: sys.playoff_mode,
      decisive_set: sys.decisive_set,
      decisive_set_goal_diff: sys.decisive_set_goal_diff,
      set_points_mode: sys.set_points_mode,
      set_result_points: sys.set_result_points ?? {},
    });
  };

  /** Save scoring edit dialog */
  const saveScoringEdit = async () => {
    if (!scoringEditId || !scoringDraft) return;
    const id = scoringEditId;
    const updates = { ...scoringDraft };

    const count = await checkPlayedMatches();
    if (count > 0) {
      setConfirmAction({
        title: "Puntentelling aanpassen?",
        description: `Er ${count === 1 ? "is" : "zijn"} al ${count} gespeelde wedstrijd${count !== 1 ? "en" : ""}. De standen worden herberekend op basis van de nieuwe instellingen.`,
        onConfirm: async () => {
          await applyUpdate(id, updates);
          toast({ title: "Opgeslagen", description: "Standen worden herberekend." });
        },
      });
    } else {
      await applyUpdate(id, updates);
      toast({ title: "Opgeslagen" });
    }
    setScoringEditId(null);
    setScoringDraft(null);
  };

  /** Handle scoring type change (punten <-> sets) */
  const handleTypeChange = async (sys: ScoringSystem, newType: "points" | "sets") => {
    if (sys.scoring_type === newType) return;
    const count = await checkPlayedMatches();
    if (count > 0) {
      setConfirmAction({
        title: newType === "sets" ? "Overschakelen naar Sets?" : "Overschakelen naar Punten?",
        description: `Er ${count === 1 ? "is" : "zijn"} al ${count} gespeelde wedstrijd${count !== 1 ? "en" : ""}. Alle resultaten worden gewist bij het wisselen van type.`,
        destructive: true,
        onConfirm: async () => {
          // Reset all played matches (incl. set_scores)
          await supabase
            .from("matches")
            .update({ home_score: null, away_score: null, home_penalties: null, away_penalties: null, set_scores: null, is_played: false } as any)
            .eq("tournament_id", tournamentId)
            .eq("is_played", true);
          await applyUpdate(sys.id, { scoring_type: newType, ...(newType === "sets" ? { num_sets: Math.max(1, sys.num_sets), set_points_mode: "total_result" } : {}) });
          toast({ title: "Type gewijzigd", description: "Alle resultaten zijn gewist." });
        },
      });
    } else {
      await applyUpdate(sys.id, { scoring_type: newType, ...(newType === "sets" ? { num_sets: Math.max(1, sys.num_sets), set_points_mode: "total_result" } : {}) });
    }
  };

  /** Handle advanced toggle */
  const handleAdvancedToggle = async (sys: ScoringSystem, checked: boolean) => {
    if (checked) {
      setShowAdvancedId(sys.id);
      return;
    }
    // Turning off: reset to defaults
    const resetUpdates: Partial<ScoringSystem> = {
      points_big_win: sys.points_win,
      big_win_threshold: 2,
      points_win_overtime: sys.points_win,
      points_draw_with_goals: sys.points_draw,
      points_draw_no_goals: sys.points_draw,
      points_loss_overtime: sys.points_loss,
      no_draws: false,
    };
    const count = await checkPlayedMatches();
    if (count > 0) {
      setConfirmAction({
        title: "Geavanceerde instellingen uitschakelen?",
        description: `Er ${count === 1 ? "is" : "zijn"} al ${count} gespeelde wedstrijd${count !== 1 ? "en" : ""}. Alle geavanceerde waarden worden teruggezet en de standen worden herberekend.`,
        onConfirm: async () => {
          setShowAdvancedId(null);
          await applyUpdate(sys.id, resetUpdates);
          toast({ title: "Opgeslagen", description: "Geavanceerde instellingen gereset. Standen worden herberekend." });
        },
      });
    } else {
      setShowAdvancedId(null);
      await applyUpdate(sys.id, resetUpdates);
    }
  };

  const addSystem = async () => {
    const nextOrder = systems.length;
    const nextName = `Puntentelling ${nextOrder + 1}`;
    const { data, error } = await supabase
      .from("tournament_scoring_systems" as any)
      .insert({
        tournament_id: tournamentId,
        name: nextName,
        sort_order: nextOrder,
        scoring_type: "points",
        points_win: 3,
        points_draw: 1,
        points_loss: 0,
        tiebreaker_rules: ["goal_difference", "goals_scored", "head_to_head", "wins"] as any,
      } as any)
      .select("*")
      .single();
    if (error) {
      toast({ title: "Toevoegen mislukt", description: error.message, variant: "destructive" });
      return;
    }
    if (data) {
      const newSys = { ...(data as any), tiebreaker_rules: (data as any).tiebreaker_rules || [], h2h_sub_rules: (data as any).h2h_sub_rules || ["points", "goal_difference", "goals_scored", "wins"] } as ScoringSystem;
      setSystems((prev) => [...prev, newSys]);
      setExpandedId(newSys.id);
    }
  };

  const openDelete = async (id: string) => {
    setDeleteId(id);
    setLoadingUsage(true);
    setDeleteUsage(null);
    try {
      const [phasesRes, groupsRes, matchesRes] = await Promise.all([
        supabase.from("tournament_phases").select("id, name").eq("tournament_id", tournamentId).eq("scoring_system_id", id),
        supabase.from("groups").select("id, name, phase_id, tournament_phases(name)").eq("tournament_id", tournamentId).eq("scoring_system_id", id),
        supabase.from("matches").select("id, match_name, home_slot_label, away_slot_label").eq("tournament_id", tournamentId).eq("scoring_system_id", id),
      ]);
      setDeleteUsage({
        phases: (phasesRes.data || []).map((p: any) => ({ id: p.id, name: p.name })),
        groups: (groupsRes.data || []).map((g: any) => ({ id: g.id, name: g.name, phaseName: g.tournament_phases?.name || "" })),
        matches: (matchesRes.data || []).map((m: any) => ({
          id: m.id,
          label: m.match_name || `${m.home_slot_label || "?"} vs ${m.away_slot_label || "?"}`,
        })),
      });
    } finally {
      setLoadingUsage(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    const fallback = systems.filter((s) => s.id !== deleteId).sort((a, b) => a.sort_order - b.sort_order)[0];
    const fallbackId = fallback?.id ?? null;

    try {
      await Promise.all([
        supabase.from("tournament_phases").update({ scoring_system_id: fallbackId }).eq("tournament_id", tournamentId).eq("scoring_system_id", deleteId),
        supabase.from("groups").update({ scoring_system_id: fallbackId }).eq("tournament_id", tournamentId).eq("scoring_system_id", deleteId),
        supabase.from("matches").update({ scoring_system_id: fallbackId }).eq("tournament_id", tournamentId).eq("scoring_system_id", deleteId),
      ]);

      const { error } = await supabase.from("tournament_scoring_systems" as any).delete().eq("id", deleteId);
      if (error) {
        toast({ title: "Verwijderen mislukt", description: error.message, variant: "destructive" });
      } else {
        setSystems((prev) => prev.filter((s) => s.id !== deleteId));
        const usageCount = (deleteUsage?.phases.length || 0) + (deleteUsage?.groups.length || 0) + (deleteUsage?.matches.length || 0);
        toast({
          title: "Puntentelling verwijderd",
          description: usageCount > 0 && fallback ? `${usageCount} koppeling(en) teruggezet naar ${fallback.name}.` : undefined,
        });
      }
    } finally {
      setDeleting(false);
      setDeleteId(null);
      setDeleteUsage(null);
    }
  };

  const moveTbUp = (idx: number) => {
    if (idx === 0) return;
    const next = [...tiebreakerDraft];
    [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
    setTiebreakerDraft(next);
  };

  const moveTbDown = (idx: number) => {
    if (idx === tiebreakerDraft.length - 1) return;
    const next = [...tiebreakerDraft];
    [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
    setTiebreakerDraft(next);
  };

  const openTiebreakerEdit = (sys: ScoringSystem) => {
    const isSets = sys.scoring_type === "sets";
    const defaultPoints = ["goal_difference", "goals_scored", "head_to_head", "wins"];
    const defaultSets = ["goal_difference", "head_to_head", "wins", "goals_scored"];
    const current = sys.tiebreaker_rules || [];
    // If sets-mode and the user has not customised yet (still equal to the points default), use sets default order
    const sameAsPointsDefault =
      current.length === defaultPoints.length && current.every((v, i) => v === defaultPoints[i]);
    const initial = isSets && sameAsPointsDefault ? defaultSets : current;
    setTiebreakerDraft([...initial]);
    setH2hSubDraft([...(sys.h2h_sub_rules || ["points", "goal_difference", "goals_scored", "wins"])]);
    setH2hSubOpen(false);
    setTiebreakerEditId(sys.id);
  };

  const saveTiebreakers = async () => {
    if (!tiebreakerEditId) return;
    const id = tiebreakerEditId;
    const updates = { tiebreaker_rules: tiebreakerDraft, h2h_sub_rules: h2hSubDraft };
    const count = await checkPlayedMatches();
    if (count > 0) {
      setConfirmAction({
        title: "Rangschikking aanpassen?",
        description: `Er ${count === 1 ? "is" : "zijn"} al ${count} gespeelde wedstrijd${count !== 1 ? "en" : ""}. De standen worden herberekend.`,
        onConfirm: async () => {
          await applyUpdate(id, updates);
          toast({ title: "Opgeslagen", description: "Standen worden herberekend." });
        },
      });
    } else {
      await applyUpdate(id, updates);
    }
    setTiebreakerEditId(null);
  };

  const getTbLabel = (v: string, isSetsMode = false) => {
    if (isSetsMode) {
      if (v === "goal_difference") return "Setsaldo";
      if (v === "goals_scored") return "Puntensaldo in sets";
    }
    return TIEBREAKER_OPTIONS.find((o) => o.value === v)?.label || v;
  };
  const getH2hLabel = (v: string, isSetsMode = false) => {
    if (isSetsMode) {
      if (v === "goal_difference") return "Setsaldo";
      if (v === "goals_scored") return "Puntensaldo in sets";
    }
    return H2H_SUB_OPTIONS.find((o) => o.value === v)?.label || v;
  };
  const editingSystem = systems.find((s) => s.id === tiebreakerEditId);
  const editingIsSets = editingSystem?.scoring_type === "sets";

  const moveH2hUp = (idx: number) => {
    if (idx === 0) return;
    const next = [...h2hSubDraft];
    [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
    setH2hSubDraft(next);
  };
  const moveH2hDown = (idx: number) => {
    if (idx === h2hSubDraft.length - 1) return;
    const next = [...h2hSubDraft];
    [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
    setH2hSubDraft(next);
  };

  const removeTb = (idx: number) => setTiebreakerDraft((prev) => prev.filter((_, i) => i !== idx));
  const addTb = (value: string) => setTiebreakerDraft((prev) => [...prev, value]);
  const removeH2h = (idx: number) => setH2hSubDraft((prev) => prev.filter((_, i) => i !== idx));
  const addH2h = (value: string) => setH2hSubDraft((prev) => [...prev, value]);

  const saveName = async (id: string) => {
    const trimmed = editName.trim();
    if (!trimmed) {
      setEditingNameId(null);
      return;
    }
    await applyUpdate(id, { name: trimmed });
    setEditingNameId(null);
  };

  return (
    <>
      <div className="space-y-3">
        {systems.map((sys, sysIdx) => {
          const isOpen = expandedId === sys.id;
          const showAdv = showAdvancedId === sys.id;
          return (
            <div key={sys.id} className="rounded-lg border border-border bg-secondary/30 overflow-hidden">
              <div className="flex items-center gap-2 px-3 py-2.5">
                <button
                  type="button"
                  onClick={() => {
                    const newId = isOpen ? null : sys.id;
                    setExpandedId(newId);
                    if (newId && hasAdvancedSettings(sys)) {
                      setShowAdvancedId(newId);
                    } else if (!newId && showAdvancedId === sys.id) {
                      setShowAdvancedId(null);
                    }
                  }}
                  className="text-muted-foreground hover:text-foreground"
                >
                  {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
                {editingNameId === sys.id ? (
                  <div className="flex items-center gap-1 flex-1">
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") saveName(sys.id); if (e.key === "Escape") setEditingNameId(null); }}
                      autoFocus
                      className="h-8"
                    />
                    <button type="button" onClick={() => saveName(sys.id)} className="text-primary hover:opacity-80"><Check className="h-4 w-4" /></button>
                    <button type="button" onClick={() => setEditingNameId(null)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
                  </div>
                ) : (
                  <>
                    <span className="text-sm font-semibold text-foreground flex-1">{sys.name}</span>
                    <button
                      type="button"
                      onClick={() => { setEditName(sys.name); setEditingNameId(sys.id); }}
                      className="text-muted-foreground hover:text-foreground"
                      aria-label="Naam bewerken"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    {sysIdx > 0 && (
                      <button
                        type="button"
                        onClick={() => openDelete(sys.id)}
                        className="text-muted-foreground hover:text-destructive"
                        aria-label="Verwijderen"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </>
                )}
              </div>

              {isOpen && (
                <div className="border-t border-border bg-card p-4 space-y-5">
                  {/* Punten / Sets toggle */}
                  <div className="space-y-2">
                    <Label>Type</Label>
                    <div className="grid grid-cols-2 rounded-md border border-border bg-secondary p-1 h-10">
                      {(["points", "sets"] as const).map((opt) => (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => handleTypeChange(sys, opt)}
                          className={cn(
                            "rounded-sm text-xs font-semibold uppercase tracking-wide transition-colors",
                            sys.scoring_type === opt
                              ? "bg-primary text-primary-foreground shadow-sm"
                              : "text-muted-foreground hover:text-foreground"
                          )}
                        >
                          {opt === "points" ? "Punten" : "Sets"}
                        </button>
                      ))}
                    </div>
                  </div>

                  {sys.scoring_type === "points" && (
                    <>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between py-1">
                          <Label htmlFor={`adv-${sys.id}`} className="text-sm font-medium cursor-pointer">
                            Geavanceerde instellingen
                          </Label>
                          <Switch
                            id={`adv-${sys.id}`}
                            checked={showAdv}
                            onCheckedChange={(checked) => { if (playedCount > 0) { openScoringEdit(sys); return; } handleAdvancedToggle(sys, checked); }}
                          />
                        </div>

                        <p className="text-xs text-muted-foreground">
                          Stel in hoeveel punten een team in een groep krijgt bij winst, verlies en gelijkspel.
                        </p>

                        {showAdv && (
                          <>
                            <div className="space-y-1">
                              <Label className="text-xs">Bij een grote overwinning</Label>
                              <div className="flex gap-2">
                                <Input
                                  type="number"
                                  className="flex-1"
                                  value={sys.points_big_win ?? ""}
                                  onChange={(e) => setSystems((prev) => prev.map((s) => s.id === sys.id ? { ...s, points_big_win: e.target.value === "" ? 0 : parseInt(e.target.value) } : s))}
                                  onFocus={(e) => guardInlineEdit(sys, e)}
                                  onBlur={(e) => applyUpdate(sys.id, { points_big_win: e.target.value === "" ? 0 : parseInt(e.target.value) })}
                                />
                                <Select
                                  value={String(sys.big_win_threshold ?? 2)}
                                  onValueChange={(v) => { if (guardInlineEdit(sys)) return; applyUpdate(sys.id, { big_win_threshold: parseInt(v) }); }}
                                >
                                  <SelectTrigger className="w-[120px]">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {[2, 3, 4, 5].map((n) => (
                                      <SelectItem key={n} value={String(n)}>+ {n} goals</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                          </>
                        )}

                        <div className="space-y-1">
                          <Label className="text-xs">Bij winst</Label>
                          <Input
                            type="number"
                            value={sys.points_win ?? ""}
                            onChange={(e) => setSystems((prev) => prev.map((s) => s.id === sys.id ? { ...s, points_win: e.target.value === "" ? 0 : parseInt(e.target.value) } : s))}
                            onFocus={(e) => guardInlineEdit(sys, e)}
                            onBlur={(e) => applyUpdate(sys.id, { points_win: e.target.value === "" ? 0 : parseInt(e.target.value) })}
                          />
                        </div>

                        {showAdv && (
                          <div className={cn("space-y-1", !sys.no_draws && "opacity-50")}>
                            <Label className="text-xs">Bij winst na verlenging, strafschoppen of golden goal</Label>
                            <Input
                              type="number"
                              disabled={!sys.no_draws}
                              value={sys.points_win_overtime ?? ""}
                              onChange={(e) => setSystems((prev) => prev.map((s) => s.id === sys.id ? { ...s, points_win_overtime: e.target.value === "" ? 0 : parseInt(e.target.value) } : s))}
                              onFocus={(e) => guardInlineEdit(sys, e)}
                              onBlur={(e) => applyUpdate(sys.id, { points_win_overtime: e.target.value === "" ? 0 : parseInt(e.target.value) })}
                            />
                          </div>
                        )}

                        {(!showAdv || !sys.no_draws) && (
                          <div className="space-y-1">
                            <Label className="text-xs">Bij gelijkspel</Label>
                            <Input
                              type="number"
                              value={sys.points_draw ?? ""}
                              onChange={(e) => setSystems((prev) => prev.map((s) => s.id === sys.id ? { ...s, points_draw: e.target.value === "" ? 0 : parseInt(e.target.value) } : s))}
                              onFocus={(e) => guardInlineEdit(sys, e)}
                              onBlur={(e) => applyUpdate(sys.id, { points_draw: e.target.value === "" ? 0 : parseInt(e.target.value) })}
                            />
                          </div>
                        )}

                        {showAdv && !sys.no_draws && (
                          <>
                            <div className="space-y-1">
                              <Label className="text-xs">Bij gelijkspel met doelpunten</Label>
                              <Input
                                type="number"
                                value={sys.points_draw_with_goals ?? ""}
                                onChange={(e) => setSystems((prev) => prev.map((s) => s.id === sys.id ? { ...s, points_draw_with_goals: e.target.value === "" ? 0 : parseInt(e.target.value) } : s))}
                                onFocus={(e) => guardInlineEdit(sys, e)}
                                onBlur={(e) => applyUpdate(sys.id, { points_draw_with_goals: e.target.value === "" ? 0 : parseInt(e.target.value) })}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Bij gelijkspel zonder doelpunten</Label>
                              <Input
                                type="number"
                                value={sys.points_draw_no_goals ?? ""}
                                onChange={(e) => setSystems((prev) => prev.map((s) => s.id === sys.id ? { ...s, points_draw_no_goals: e.target.value === "" ? 0 : parseInt(e.target.value) } : s))}
                                onFocus={(e) => guardInlineEdit(sys, e)}
                                onBlur={(e) => applyUpdate(sys.id, { points_draw_no_goals: e.target.value === "" ? 0 : parseInt(e.target.value) })}
                              />
                            </div>
                          </>
                        )}

                        <div className="space-y-1">
                          <Label className="text-xs">Bij verlies</Label>
                          <Input
                            type="number"
                            value={sys.points_loss ?? ""}
                            onChange={(e) => setSystems((prev) => prev.map((s) => s.id === sys.id ? { ...s, points_loss: e.target.value === "" ? 0 : parseInt(e.target.value) } : s))}
                            onFocus={(e) => guardInlineEdit(sys, e)}
                            onBlur={(e) => applyUpdate(sys.id, { points_loss: e.target.value === "" ? 0 : parseInt(e.target.value) })}
                          />
                        </div>

                        {showAdv && (
                          <>
                            <div className={cn("space-y-1", !sys.no_draws && "opacity-50")}>
                              <Label className="text-xs">Bij verlies na verlenging, strafschoppen of golden goal</Label>
                              <Input
                                type="number"
                                disabled={!sys.no_draws}
                                value={sys.points_loss_overtime ?? ""}
                                onChange={(e) => setSystems((prev) => prev.map((s) => s.id === sys.id ? { ...s, points_loss_overtime: e.target.value === "" ? 0 : parseInt(e.target.value) } : s))}
                                onFocus={(e) => guardInlineEdit(sys, e)}
                                onBlur={(e) => applyUpdate(sys.id, { points_loss_overtime: e.target.value === "" ? 0 : parseInt(e.target.value) })}
                              />
                            </div>
                            <div className="pt-2 border-t border-border">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="text-sm font-semibold text-foreground">Poulewedstrijden mogen niet eindigen in een gelijkspel</p>
                                  <p className="text-xs text-muted-foreground mt-0.5">
                                    Wanneer ingeschakeld wordt altijd gevraagd de winnaar aan te geven bij een gelijke eindstand.
                                  </p>
                                </div>
                                <Switch
                                  checked={sys.no_draws}
                                  onCheckedChange={async (checked) => {
                                    if (playedCount > 0) { openScoringEdit(sys); return; }
                                    await applyUpdate(sys.id, { no_draws: checked });
                                  }}
                                  className="mt-1 shrink-0"
                                />
                              </div>
                            </div>
                          </>
                        )}
                      </div>

                      <div className="pt-4 border-t border-border space-y-2">
                        <h4 className="text-sm font-semibold text-foreground">Rangschikking bij gelijk aantal punten in de groep</h4>
                        <p className="text-xs text-muted-foreground">
                          Kies de criteria die moeten gelden als twee of meer teams op hetzelfde aantal punten eindigen.
                        </p>
                        <div className="rounded-lg border border-border bg-secondary/30 px-3 py-2.5 mt-2">
                          <ol className="text-sm text-foreground space-y-1">
                            {sys.tiebreaker_rules.map((rule, idx) => (
                              <li key={`${sys.id}-${rule}`} className="flex gap-2">
                                <span className="text-muted-foreground font-medium">{idx + 1}.</span>
                                <span>{getTbLabel(rule)}</span>
                              </li>
                            ))}
                          </ol>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => openTiebreakerEdit(sys)}
                          className="mt-2"
                        >
                          <Pencil className="h-3.5 w-3.5 mr-1.5" /> Criteria aanpassen
                        </Button>
                      </div>

                      {tournament && onUpdate && (
                        <StandingsColumnsInline tournament={tournament} onUpdate={onUpdate} mode="points" />
                      )}
                    </>
                  )}

                   {sys.scoring_type === "sets" && (
                    <div className="space-y-3">
                      <p className="text-xs text-muted-foreground">
                        Stel in hoeveel sets er gespeeld worden en hoe punten worden toegekend.
                      </p>

                      {/* Aantal sets */}
                      <div className="space-y-1">
                        <Label className="text-xs">Aantal sets</Label>
                        <Select
                          value={String(sys.num_sets)}
                          onValueChange={(v) => {
                            if (playedCount > 0) { openScoringEdit(sys); return; }
                            applyUpdate(sys.id, { num_sets: parseInt(v) });
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Array.from({ length: 36 }, (_, i) => i + 1).map((n) => (
                              <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Beslissende set (even sets) */}
                      {sys.num_sets % 2 === 0 && (
                        <div className="space-y-3 pt-2 border-t border-border">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-foreground">Beslissende set</span>
                            <Switch
                              checked={sys.decisive_set}
                              onCheckedChange={(checked) => {
                                if (playedCount > 0) { openScoringEdit(sys); return; }
                                applyUpdate(sys.id, { decisive_set: checked });
                              }}
                            />
                          </div>
                          {sys.decisive_set && (
                            <div className="flex items-center justify-between pl-2">
                              <span className="text-sm text-foreground">Laat beslissende set meetellen in doelsaldo</span>
                              <Switch
                                checked={sys.decisive_set_goal_diff}
                                onCheckedChange={(checked) => {
                                  if (playedCount > 0) { openScoringEdit(sys); return; }
                                  applyUpdate(sys.id, { decisive_set_goal_diff: checked });
                                }}
                              />
                            </div>
                          )}
                        </div>
                      )}

                      {/* Playoff modus (odd sets >= 3, only when NOT per_set scoring) */}
                      {sys.num_sets >= 3 && sys.num_sets % 2 === 1 && sys.set_points_mode !== "per_set" && (
                        <div className="pt-2 border-t border-border">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-foreground">
                              Playoff modus (beste van {sys.num_sets})
                            </span>
                            <Switch
                              checked={sys.playoff_mode}
                              onCheckedChange={(checked) => {
                                if (playedCount > 0) { openScoringEdit(sys); return; }
                                applyUpdate(sys.id, { playoff_mode: checked });
                              }}
                            />
                          </div>
                        </div>
                      )}

                      {/* Punten toekennen */}
                      {sys.num_sets >= 2 && (
                        <div className="space-y-1 pt-2 border-t border-border">
                          <Label className="text-xs">Punten toekennen per team tijdens de groepsfase</Label>
                          <Select
                            value={sys.set_points_mode}
                            onValueChange={(v) => {
                              if (playedCount > 0) { openScoringEdit(sys); return; }
                              applyUpdate(sys.id, { set_points_mode: v as "per_set" | "total_result" });
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="per_set">Per set</SelectItem>
                              <SelectItem value="total_result">Op basis van totale uitslag</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      {/* Per set: W/D/L */}
                      {sys.num_sets >= 2 && sys.set_points_mode === "per_set" && (
                        <div className="space-y-2">
                          <div className="space-y-1">
                            <Label className="text-xs">Bij winst</Label>
                            <Input
                              type="number"
                              value={sys.points_win ?? ""}
                              onFocus={(e) => guardInlineEdit(sys, e)}
                              onBlur={(e) => applyUpdate(sys.id, { points_win: e.target.value === "" ? 0 : parseInt(e.target.value) })}
                              onChange={(e) => setSystems((prev) => prev.map((s) => s.id === sys.id ? { ...s, points_win: e.target.value === "" ? 0 : parseInt(e.target.value) } : s))}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Bij gelijkspel</Label>
                            <Input
                              type="number"
                              value={sys.points_draw ?? ""}
                              onFocus={(e) => guardInlineEdit(sys, e)}
                              onBlur={(e) => applyUpdate(sys.id, { points_draw: e.target.value === "" ? 0 : parseInt(e.target.value) })}
                              onChange={(e) => setSystems((prev) => prev.map((s) => s.id === sys.id ? { ...s, points_draw: e.target.value === "" ? 0 : parseInt(e.target.value) } : s))}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Bij verlies</Label>
                            <Input
                              type="number"
                              value={sys.points_loss ?? ""}
                              onFocus={(e) => guardInlineEdit(sys, e)}
                              onBlur={(e) => applyUpdate(sys.id, { points_loss: e.target.value === "" ? 0 : parseInt(e.target.value) })}
                              onChange={(e) => setSystems((prev) => prev.map((s) => s.id === sys.id ? { ...s, points_loss: e.target.value === "" ? 0 : parseInt(e.target.value) } : s))}
                            />
                          </div>
                        </div>
                      )}

                      {/* Total result: outcome-based */}
                      {sys.num_sets >= 2 && sys.set_points_mode === "total_result" && (() => {
                        const outcomes = generateSetOutcomes(sys.num_sets, sys.playoff_mode, sys.decisive_set);
                        const rp: SetResultPoints = sys.set_result_points || {};
                        return outcomes.length > 0 ? (
                          <div className="space-y-3">
                            {outcomes.map(({ key: oc, isDraw }) => {
                              const pts = rp[oc] || { win: 2, loss: 0, draw: 1 };
                              if (isDraw) {
                                return (
                                  <div key={oc} className="space-y-1">
                                    <Label className="text-xs">Punten bij gelijkspel {oc}</Label>
                                    <div className="space-y-0.5">
                                      <span className="text-[10px] text-muted-foreground">Beide teams</span>
                                      <Input
                                        type="number"
                                        value={pts.draw ?? 1}
                                        onFocus={(e) => guardInlineEdit(sys, e)}
                                        onChange={(e) => setSystems((prev) => prev.map((s) => s.id === sys.id ? { ...s, set_result_points: { ...rp, [oc]: { ...pts, draw: e.target.value === "" ? 0 : parseInt(e.target.value) } } } : s))}
                                        onBlur={(e) => applyUpdate(sys.id, { set_result_points: { ...rp, [oc]: { ...pts, draw: e.target.value === "" ? 0 : parseInt(e.target.value) } } })}
                                      />
                                    </div>
                                  </div>
                                );
                              }
                              return (
                                <div key={oc} className="space-y-1">
                                  <Label className="text-xs">Punten bij uitslag {oc}</Label>
                                  <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-0.5">
                                      <span className="text-[10px] text-muted-foreground">Winnaar</span>
                                      <Input
                                        type="number"
                                        value={pts.win ?? ""}
                                        onFocus={(e) => guardInlineEdit(sys, e)}
                                        onChange={(e) => setSystems((prev) => prev.map((s) => s.id === sys.id ? { ...s, set_result_points: { ...rp, [oc]: { ...pts, win: e.target.value === "" ? 0 : parseInt(e.target.value) } } } : s))}
                                        onBlur={(e) => applyUpdate(sys.id, { set_result_points: { ...rp, [oc]: { ...pts, win: e.target.value === "" ? 0 : parseInt(e.target.value) } } })}
                                      />
                                    </div>
                                    <div className="space-y-0.5">
                                      <span className="text-[10px] text-muted-foreground">Verliezer</span>
                                      <Input
                                        type="number"
                                        value={pts.loss ?? ""}
                                        onFocus={(e) => guardInlineEdit(sys, e)}
                                        onChange={(e) => setSystems((prev) => prev.map((s) => s.id === sys.id ? { ...s, set_result_points: { ...rp, [oc]: { ...pts, loss: e.target.value === "" ? 0 : parseInt(e.target.value) } } } : s))}
                                        onBlur={(e) => applyUpdate(sys.id, { set_result_points: { ...rp, [oc]: { ...pts, loss: e.target.value === "" ? 0 : parseInt(e.target.value) } } })}
                                      />
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : null;
                      })()}

                      {/* 1 set: standard W/D/L */}
                      {sys.num_sets === 1 && (
                        <div className="space-y-2">
                          <div className="space-y-1">
                            <Label className="text-xs">Bij winst</Label>
                            <Input
                              type="number"
                              value={sys.points_win ?? ""}
                              onFocus={(e) => guardInlineEdit(sys, e)}
                              onBlur={(e) => applyUpdate(sys.id, { points_win: e.target.value === "" ? 0 : parseInt(e.target.value) })}
                              onChange={(e) => setSystems((prev) => prev.map((s) => s.id === sys.id ? { ...s, points_win: e.target.value === "" ? 0 : parseInt(e.target.value) } : s))}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Bij gelijkspel</Label>
                            <Input
                              type="number"
                              value={sys.points_draw ?? ""}
                              onFocus={(e) => guardInlineEdit(sys, e)}
                              onBlur={(e) => applyUpdate(sys.id, { points_draw: e.target.value === "" ? 0 : parseInt(e.target.value) })}
                              onChange={(e) => setSystems((prev) => prev.map((s) => s.id === sys.id ? { ...s, points_draw: e.target.value === "" ? 0 : parseInt(e.target.value) } : s))}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Bij verlies</Label>
                            <Input
                              type="number"
                              value={sys.points_loss ?? ""}
                              onFocus={(e) => guardInlineEdit(sys, e)}
                              onBlur={(e) => applyUpdate(sys.id, { points_loss: e.target.value === "" ? 0 : parseInt(e.target.value) })}
                              onChange={(e) => setSystems((prev) => prev.map((s) => s.id === sys.id ? { ...s, points_loss: e.target.value === "" ? 0 : parseInt(e.target.value) } : s))}
                            />
                          </div>
                        </div>
                      )}

                      {/* Tiebreaker section */}
                      <div className="pt-4 border-t border-border space-y-2">
                        <h4 className="text-sm font-semibold text-foreground">Rangschikking bij gelijk aantal punten in de groep</h4>
                        <p className="text-xs text-muted-foreground">
                          Kies de criteria die moeten gelden als twee of meer teams op hetzelfde aantal punten eindigen.
                        </p>
                        <div className="rounded-lg border border-border bg-secondary/30 px-3 py-2.5 mt-2">
                          <ol className="text-sm text-foreground space-y-1">
                            {sys.tiebreaker_rules.map((rule, idx) => (
                              <li key={`${sys.id}-tb-${rule}`} className="flex gap-2">
                                <span className="text-muted-foreground font-medium">{idx + 1}.</span>
                                <span>{getTbLabel(rule, true)}</span>
                              </li>
                            ))}
                          </ol>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => openTiebreakerEdit(sys)}
                          className="mt-2"
                        >
                          <Pencil className="h-3.5 w-3.5 mr-1.5" /> Criteria aanpassen
                        </Button>
                      </div>

                      {tournament && onUpdate && (
                        <StandingsColumnsInline tournament={tournament} onUpdate={onUpdate} mode="sets" />
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addSystem}
          className="w-full bg-primary/10 text-primary border-primary/30 hover:bg-primary/20"
        >
          <Plus className="h-4 w-4 mr-1" /> Puntentelling toevoegen
        </Button>
      </div>

      {/* Scoring Edit Dialog */}
      <Dialog open={!!scoringEditId} onOpenChange={(open) => { if (!open) { setScoringEditId(null); setScoringDraft(null); } }}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{scoringDraft?.scoring_type === "sets" ? "Sets aanpassen" : "Puntentelling aanpassen"}</DialogTitle>
            <DialogDescription>
              {scoringDraft?.scoring_type === "sets"
                ? "Pas de set-instellingen en puntenwaarden aan en druk op Opslaan."
                : "Pas de puntenwaarden aan en druk op Opslaan."}
            </DialogDescription>
          </DialogHeader>
          {scoringDraft && (() => {
            const sys = systems.find((s) => s.id === scoringEditId);
            const isAdvanced = showAdvancedId === scoringEditId;
            const isSets = scoringDraft.scoring_type === "sets";

            if (isSets) {
              const outcomes = generateSetOutcomes(scoringDraft.num_sets, scoringDraft.playoff_mode, scoringDraft.decisive_set);
              const resultPts: SetResultPoints = scoringDraft.set_result_points || {};
              return (
                <div className="space-y-4 py-2">
                  {/* Aantal sets */}
                  <div className="space-y-1">
                    <Label className="text-xs">Aantal sets</Label>
                    <Select
                      value={String(scoringDraft.num_sets)}
                      onValueChange={(v) => setScoringDraft((d) => d ? { ...d, num_sets: parseInt(v) } : d)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 36 }, (_, i) => i + 1).map((n) => (
                          <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Beslissende set (even sets) */}
                  {scoringDraft.num_sets % 2 === 0 && (
                    <div className="space-y-3 pt-2 border-t border-border">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-foreground">Beslissende set</span>
                        <Switch
                          checked={scoringDraft.decisive_set}
                          onCheckedChange={(checked) => setScoringDraft((d) => d ? { ...d, decisive_set: checked } : d)}
                        />
                      </div>
                      {scoringDraft.decisive_set && (
                        <div className="flex items-center justify-between pl-2">
                          <span className="text-sm text-foreground">Laat beslissende set meetellen in doelsaldo</span>
                          <Switch
                            checked={scoringDraft.decisive_set_goal_diff}
                            onCheckedChange={(checked) => setScoringDraft((d) => d ? { ...d, decisive_set_goal_diff: checked } : d)}
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Playoff modus (odd sets >= 3, only when NOT per_set scoring) */}
                  {scoringDraft.num_sets >= 3 && scoringDraft.num_sets % 2 === 1 && scoringDraft.set_points_mode !== "per_set" && (
                    <div className="pt-2 border-t border-border">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-foreground">
                          Playoff modus (beste van {scoringDraft.num_sets})
                        </span>
                        <Switch
                          checked={scoringDraft.playoff_mode}
                          onCheckedChange={(checked) => setScoringDraft((d) => d ? { ...d, playoff_mode: checked } : d)}
                        />
                      </div>
                    </div>
                  )}

                  {/* Punten toekennen */}
                  {scoringDraft.num_sets >= 2 && (
                    <div className="space-y-1 pt-2 border-t border-border">
                      <Label className="text-xs">Punten toekennen per team tijdens de groepsfase</Label>
                      <Select
                        value={scoringDraft.set_points_mode}
                        onValueChange={(v) => setScoringDraft((d) => d ? { ...d, set_points_mode: v as "per_set" | "total_result" } : d)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="per_set">Per set</SelectItem>
                          <SelectItem value="total_result">Op basis van totale uitslag</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Per set: W/D/L */}
                  {scoringDraft.num_sets >= 2 && scoringDraft.set_points_mode === "per_set" && (
                    <>
                      <div className="space-y-1">
                        <Label className="text-xs">Bij winst</Label>
                        <Input
                          type="number"
                          value={scoringDraft.points_win ?? ""}
                          onChange={(e) => setScoringDraft((d) => d ? { ...d, points_win: e.target.value === "" ? 0 : parseInt(e.target.value) } : d)}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Bij gelijkspel</Label>
                        <Input
                          type="number"
                          value={scoringDraft.points_draw ?? ""}
                          onChange={(e) => setScoringDraft((d) => d ? { ...d, points_draw: e.target.value === "" ? 0 : parseInt(e.target.value) } : d)}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Bij verlies</Label>
                        <Input
                          type="number"
                          value={scoringDraft.points_loss ?? ""}
                          onChange={(e) => setScoringDraft((d) => d ? { ...d, points_loss: e.target.value === "" ? 0 : parseInt(e.target.value) } : d)}
                        />
                      </div>
                    </>
                  )}

                  {/* Total result: outcome-based */}
                  {scoringDraft.num_sets >= 2 && scoringDraft.set_points_mode === "total_result" && outcomes.length > 0 && (
                    <div className="space-y-4">
                      {outcomes.map(({ key: oc, isDraw }) => {
                        const pts = resultPts[oc] || { win: 2, loss: 0, draw: 1 };
                        if (isDraw) {
                          return (
                            <div key={oc} className="space-y-1">
                              <Label className="text-xs">Punten bij gelijkspel {oc}</Label>
                              <div className="space-y-0.5">
                                <span className="text-[10px] text-muted-foreground">Beide teams</span>
                                <Input
                                  type="number"
                                  value={pts.draw ?? 1}
                                  onChange={(e) => {
                                    const newPts = { ...resultPts, [oc]: { ...pts, draw: e.target.value === "" ? 0 : parseInt(e.target.value) } };
                                    setScoringDraft((d) => d ? { ...d, set_result_points: newPts } : d);
                                  }}
                                />
                              </div>
                            </div>
                          );
                        }
                        return (
                          <div key={oc} className="space-y-1">
                            <Label className="text-xs">Punten bij uitslag {oc}</Label>
                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-0.5">
                                <span className="text-[10px] text-muted-foreground">Winnaar</span>
                                <Input
                                  type="number"
                                  value={pts.win ?? ""}
                                  onChange={(e) => {
                                    const newPts = { ...resultPts, [oc]: { ...pts, win: e.target.value === "" ? 0 : parseInt(e.target.value) } };
                                    setScoringDraft((d) => d ? { ...d, set_result_points: newPts } : d);
                                  }}
                                />
                              </div>
                              <div className="space-y-0.5">
                                <span className="text-[10px] text-muted-foreground">Verliezer</span>
                                <Input
                                  type="number"
                                  value={pts.loss ?? ""}
                                  onChange={(e) => {
                                    const newPts = { ...resultPts, [oc]: { ...pts, loss: e.target.value === "" ? 0 : parseInt(e.target.value) } };
                                    setScoringDraft((d) => d ? { ...d, set_result_points: newPts } : d);
                                  }}
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* For 1 set: standard W/D/L points */}
                  {scoringDraft.num_sets === 1 && (
                    <>
                      <div className="space-y-1">
                        <Label className="text-xs">Bij winst</Label>
                        <Input
                          type="number"
                          value={scoringDraft.points_win ?? ""}
                          onChange={(e) => setScoringDraft((d) => d ? { ...d, points_win: e.target.value === "" ? 0 : parseInt(e.target.value) } : d)}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Bij gelijkspel</Label>
                        <Input
                          type="number"
                          value={scoringDraft.points_draw ?? ""}
                          onChange={(e) => setScoringDraft((d) => d ? { ...d, points_draw: e.target.value === "" ? 0 : parseInt(e.target.value) } : d)}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Bij verlies</Label>
                        <Input
                          type="number"
                          value={scoringDraft.points_loss ?? ""}
                          onChange={(e) => setScoringDraft((d) => d ? { ...d, points_loss: e.target.value === "" ? 0 : parseInt(e.target.value) } : d)}
                        />
                      </div>
                    </>
                  )}
                </div>
              );
            }

            // Points mode dialog (existing)
            return (
              <div className="space-y-4 py-2">
                <div className="flex items-center justify-between pb-2 border-b border-border">
                  <Label className="text-sm font-medium cursor-pointer">Geavanceerde instellingen</Label>
                  <Switch
                    checked={isAdvanced}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setShowAdvancedId(scoringEditId);
                      } else {
                        setShowAdvancedId(null);
                      }
                    }}
                  />
                </div>
                {isAdvanced && (
                  <>
                    <div className="space-y-1">
                      <Label className="text-xs">Bij een grote overwinning</Label>
                      <div className="flex gap-2">
                        <Input
                          type="number"
                          className="flex-1"
                          value={scoringDraft.points_big_win ?? ""}
                          onChange={(e) => setScoringDraft((d) => d ? { ...d, points_big_win: e.target.value === "" ? 0 : parseInt(e.target.value) } : d)}
                        />
                        <Select
                          value={String(scoringDraft.big_win_threshold ?? 2)}
                          onValueChange={(v) => setScoringDraft((d) => d ? { ...d, big_win_threshold: parseInt(v) } : d)}
                        >
                          <SelectTrigger className="w-[120px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {[2, 3, 4, 5].map((n) => (
                              <SelectItem key={n} value={String(n)}>+ {n} goals</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </>
                )}
                <div className="space-y-1">
                  <Label className="text-xs">Bij winst</Label>
                  <Input
                    type="number"
                    value={scoringDraft.points_win ?? ""}
                    onChange={(e) => setScoringDraft((d) => d ? { ...d, points_win: e.target.value === "" ? 0 : parseInt(e.target.value) } : d)}
                  />
                </div>
                {isAdvanced && (
                  <div className={cn("space-y-1", !scoringDraft.no_draws && "opacity-50")}>
                    <Label className="text-xs">Bij winst na verlenging, strafschoppen of golden goal</Label>
                    <Input
                      type="number"
                      disabled={!scoringDraft.no_draws}
                      value={scoringDraft.points_win_overtime ?? ""}
                      onChange={(e) => setScoringDraft((d) => d ? { ...d, points_win_overtime: e.target.value === "" ? 0 : parseInt(e.target.value) } : d)}
                    />
                  </div>
                )}
                {!isAdvanced && (
                  <div className="space-y-1">
                    <Label className="text-xs">Bij gelijkspel</Label>
                    <Input
                      type="number"
                      value={scoringDraft.points_draw ?? ""}
                      onChange={(e) => setScoringDraft((d) => d ? { ...d, points_draw: e.target.value === "" ? 0 : parseInt(e.target.value) } : d)}
                    />
                  </div>
                )}
                {isAdvanced && !scoringDraft.no_draws && (
                  <>
                    <div className="space-y-1">
                      <Label className="text-xs">Bij gelijkspel met doelpunten</Label>
                      <Input
                        type="number"
                        value={scoringDraft.points_draw_with_goals ?? ""}
                        onChange={(e) => setScoringDraft((d) => d ? { ...d, points_draw_with_goals: e.target.value === "" ? 0 : parseInt(e.target.value) } : d)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Bij gelijkspel zonder doelpunten</Label>
                      <Input
                        type="number"
                        value={scoringDraft.points_draw_no_goals ?? ""}
                        onChange={(e) => setScoringDraft((d) => d ? { ...d, points_draw_no_goals: e.target.value === "" ? 0 : parseInt(e.target.value) } : d)}
                      />
                    </div>
                  </>
                )}
                <div className="space-y-1">
                  <Label className="text-xs">Bij verlies</Label>
                  <Input
                    type="number"
                    value={scoringDraft.points_loss ?? ""}
                    onChange={(e) => setScoringDraft((d) => d ? { ...d, points_loss: e.target.value === "" ? 0 : parseInt(e.target.value) } : d)}
                  />
                </div>
                {isAdvanced && (
                  <div className={cn("space-y-1", !scoringDraft.no_draws && "opacity-50")}>
                    <Label className="text-xs">Bij verlies na verlenging, strafschoppen of golden goal</Label>
                    <Input
                      type="number"
                      disabled={!scoringDraft.no_draws}
                      value={scoringDraft.points_loss_overtime ?? ""}
                      onChange={(e) => setScoringDraft((d) => d ? { ...d, points_loss_overtime: e.target.value === "" ? 0 : parseInt(e.target.value) } : d)}
                    />
                  </div>
                )}
                {isAdvanced && (
                  <div className="pt-2 border-t border-border">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-foreground">Poulewedstrijden mogen niet eindigen in een gelijkspel</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Wanneer ingeschakeld wordt altijd gevraagd de winnaar aan te geven bij een gelijke eindstand.
                        </p>
                      </div>
                      <Switch
                        checked={scoringDraft.no_draws ?? false}
                        onCheckedChange={(checked) => setScoringDraft((d) => d ? { ...d, no_draws: checked } : d)}
                        className="mt-1 shrink-0"
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => { setScoringEditId(null); setScoringDraft(null); }}>Annuleren</Button>
            <Button type="button" onClick={saveScoringEdit}>Opslaan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Tiebreaker Edit Dialog */}
      <Dialog open={!!tiebreakerEditId} onOpenChange={(open) => { if (!open) setTiebreakerEditId(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Criteria bij gelijke punten</DialogTitle>
            <DialogDescription>
              Gebruik de pijlen om de volgorde te bepalen die wordt toegepast als teams gelijk eindigen.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            {tiebreakerDraft.map((rule, idx) => (
              <div key={`draft-${rule}`}>
                <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2">
                  <span className="text-xs font-bold text-muted-foreground w-5">{idx + 1}.</span>
                  <span className="text-sm text-foreground flex-1">{getTbLabel(rule, editingIsSets)}</span>
                  <button type="button" onClick={() => moveTbUp(idx)} disabled={idx === 0} className="text-muted-foreground hover:text-foreground disabled:opacity-30">
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" onClick={() => moveTbDown(idx)} disabled={idx === tiebreakerDraft.length - 1} className="text-muted-foreground hover:text-foreground disabled:opacity-30">
                    <ArrowDown className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" onClick={() => removeTb(idx)} className="text-muted-foreground hover:text-destructive" aria-label="Criterium verwijderen">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                {rule === "head_to_head" && (
                  <div className="ml-6 mt-1.5 mb-1">
                    <button
                      type="button"
                      onClick={() => setH2hSubOpen(!h2hSubOpen)}
                      className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 font-medium"
                    >
                      {h2hSubOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                      Subcriteria aanpassen
                      <span className="relative group/info">
                        <Info className="h-3 w-3 text-muted-foreground" />
                        <span className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1.5 w-56 px-2.5 py-1.5 rounded-md bg-popover border border-border text-xs text-popover-foreground shadow-md opacity-0 group-hover/info:opacity-100 pointer-events-none z-50 transition-opacity">
                          Bij een gelijk aantal punten worden alleen de onderlinge duels tussen de betrokken teams bekeken. De subcriteria bepalen de volgorde van vergelijking.
                        </span>
                      </span>
                    </button>
                    {h2hSubOpen && (
                      <>
                        <div className="space-y-1 mt-1.5">
                          {h2hSubDraft.map((sub, sIdx) => (
                            <div key={`h2h-${sub}`} className="flex items-center gap-2 rounded-md border border-border/60 bg-secondary/20 px-2.5 py-1.5">
                              <span className="text-xs text-muted-foreground w-4">{sIdx + 1}.</span>
                              <span className="text-xs text-foreground flex-1">{getH2hLabel(sub, editingIsSets)}</span>
                              <button type="button" onClick={() => moveH2hUp(sIdx)} disabled={sIdx === 0} className="text-muted-foreground hover:text-foreground disabled:opacity-30">
                                <ArrowUp className="h-3 w-3" />
                              </button>
                              <button type="button" onClick={() => moveH2hDown(sIdx)} disabled={sIdx === h2hSubDraft.length - 1} className="text-muted-foreground hover:text-foreground disabled:opacity-30">
                                <ArrowDown className="h-3 w-3" />
                              </button>
                              <button type="button" onClick={() => removeH2h(sIdx)} className="text-muted-foreground hover:text-destructive" aria-label="Subcriterium verwijderen">
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                        {(() => {
                          const available = H2H_SUB_OPTIONS.filter((o) => !h2hSubDraft.includes(o.value));
                          if (available.length === 0) return null;
                          return (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button type="button" className="mt-1.5 flex items-center gap-1 text-xs text-primary hover:text-primary/80 font-medium">
                                  <Plus className="h-3 w-3" /> Subcriterium toevoegen
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="start">
                                {available.map((o) => (
                                  <DropdownMenuItem key={o.value} onClick={() => addH2h(o.value)}>
                                    {getH2hLabel(o.value, editingIsSets)}
                                  </DropdownMenuItem>
                                ))}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          );
                        })()}
                      </>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setTiebreakerEditId(null)}>Annuleren</Button>
            <Button type="button" onClick={saveTiebreakers}>Opslaan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => { if (!open) { setDeleteId(null); setDeleteUsage(null); } }}>
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {(() => {
                const sys = systems.find((s) => s.id === deleteId);
                return sys ? `${sys.name} verwijderen?` : "Puntentelling verwijderen?";
              })()}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                {loadingUsage && <p className="text-sm text-muted-foreground">Gebruik controleren...</p>}
                {!loadingUsage && deleteUsage && (() => {
                  const fallback = systems.filter((s) => s.id !== deleteId).sort((a, b) => a.sort_order - b.sort_order)[0];
                  const total = deleteUsage.phases.length + deleteUsage.groups.length + deleteUsage.matches.length;
                  if (total === 0) {
                    return <p className="text-sm">Deze puntentelling is nergens in gebruik. Verwijderen kan niet ongedaan worden gemaakt.</p>;
                  }
                  return (
                    <>
                      <p className="text-sm">
                        Deze puntentelling is in gebruik. Bij verwijderen worden alle koppelingen teruggezet naar{" "}
                        <span className="font-semibold text-foreground">{fallback?.name || "(geen)"}</span>.
                      </p>
                      <div className="rounded-md border border-border bg-secondary/40 p-3 space-y-2 max-h-64 overflow-y-auto">
                        {deleteUsage.phases.length > 0 && (
                          <div>
                            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Formats ({deleteUsage.phases.length})</div>
                            <ul className="text-sm space-y-0.5">
                              {deleteUsage.phases.map((p) => <li key={p.id}>• {p.name}</li>)}
                            </ul>
                          </div>
                        )}
                        {deleteUsage.groups.length > 0 && (
                          <div>
                            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Groepen ({deleteUsage.groups.length})</div>
                            <ul className="text-sm space-y-0.5">
                              {deleteUsage.groups.map((g) => <li key={g.id}>• {g.name}{g.phaseName ? ` — ${g.phaseName}` : ""}</li>)}
                            </ul>
                          </div>
                        )}
                        {deleteUsage.matches.length > 0 && (
                          <div>
                            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Wedstrijden ({deleteUsage.matches.length})</div>
                            <ul className="text-sm space-y-0.5">
                              {deleteUsage.matches.map((m) => <li key={m.id}>• {m.label}</li>)}
                            </ul>
                          </div>
                        )}
                      </div>
                    </>
                  );
                })()}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Annuleren</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={loadingUsage || deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Verwijderen..." : (deleteUsage && (deleteUsage.phases.length + deleteUsage.groups.length + deleteUsage.matches.length) > 0 ? "Toch verwijderen" : "Verwijderen")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Generic Confirmation Dialog */}
      <AlertDialog open={!!confirmAction} onOpenChange={(open) => { if (!open) setConfirmAction(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmAction?.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirmAction?.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmAction(null)}>Annuleren</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (confirmAction?.onConfirm) await confirmAction.onConfirm();
                setConfirmAction(null);
              }}
              className={confirmAction?.destructive ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}
            >
              {confirmAction?.destructive ? "Ja, doorgaan" : "Ja, aanpassen"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default ScoringSystemsManager;
