import { useEffect, useMemo, useState } from "react";
import { DndContext, PointerSensor, TouchSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import CountryFlag from "@/components/CountryFlag";
import { Plus, Trash2, Shuffle, Undo2, RotateCcw, Check, AlertTriangle, Sparkles, ChevronDown, GripVertical, ArrowLeft, Maximize2 } from "lucide-react";
import { generatePotMatchups } from "@/lib/drawEngine";
import {
  checkContainerFeasibility,
  buildContainerCtx,
  defaultPotQuota,
  emptyContainerRules,
  type ContainerRules,
  type DrawContainer,
  type DrawTeam,
} from "@/lib/liveDraw";
import {
  confirmPending,
  drawAll,
  drawNext,
  initContainersState,
  teamName,
  undoLast,
  type DrawSessionState,
} from "@/lib/drawSession";

interface Pot {
  id: string;
  name: string;
  sort_order: number;
  teamIds: string[];
}

type Step = "settings" | "pots" | "draw";

const DraggablePotTeam = ({ id, children }: { id: string; children: React.ReactNode }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      className={`flex items-center justify-between rounded-md border border-border bg-background px-2 py-2 text-xs ${isDragging ? "relative z-50 opacity-70 shadow-lg" : ""}`}
    >
      <div className="flex min-w-0 items-center gap-2">
        <span {...attributes} {...listeners} className="touch-none cursor-grab text-muted-foreground" aria-label="Deelnemer verplaatsen">
          <GripVertical className="h-4 w-4" />
        </span>
        {children}
      </div>
    </div>
  );
};

const PotDropZone = ({ id, children }: { id: string; children: React.ReactNode }) => {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className={`min-h-20 space-y-1.5 rounded-md p-1 transition-colors ${isOver ? "bg-primary/10 ring-2 ring-primary/30" : ""}`}>
      {children}
    </div>
  );
};

const LiveDrawDialog = ({
  open,
  onOpenChange,
  tournamentId,
  phaseId,
  categoryId,
  phaseMatchType,
  phaseName,
  onApplied,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tournamentId: string;
  phaseId: string;
  categoryId?: string | null;
  phaseMatchType?: string;
  phaseName?: string;
  onApplied?: () => void;
}) => {
  const isRounds = phaseMatchType === "rounds";
  const { toast } = useToast();
  const [step, setStep] = useState<Step>("settings");
  const [advancedSpreadOpen, setAdvancedSpreadOpen] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pots, setPots] = useState<Pot[]>([]);
  const [containers, setContainers] = useState<DrawContainer[]>([]);
  const [teams, setTeams] = useState<DrawTeam[]>([]);
  const [usePots, setUsePots] = useState(true);
  const [potCount, setPotCount] = useState(4);
  const [rules, setRules] = useState<ContainerRules>(emptyContainerRules());
  const [potMatrix, setPotMatrix] = useState<Record<string, number>>({});

  const [session, setSession] = useState<DrawSessionState | null>(null);
  const [applying, setApplying] = useState(false);
  const [newCountry, setNewCountry] = useState("");
  const [pairA, setPairA] = useState("");
  const [pairB, setPairB] = useState("");
  const [manualTeam, setManualTeam] = useState("");
  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } })
  );

  const teamById = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);
  const assignedTeamIds = useMemo(() => new Set(pots.flatMap((p) => p.teamIds)), [pots]);
  const unassignedTeams = useMemo(() => teams.filter((t) => !assignedTeamIds.has(t.id)), [teams, assignedTeamIds]);
  const countries = useMemo(
    () => Array.from(new Set(teams.map((t) => t.country).filter(Boolean) as string[])).sort(),
    [teams]
  );
  const totalCapacity = containers.reduce((sum, c) => sum + c.capacity, 0);
  const potTeamTotal = pots.reduce((sum, p) => sum + p.teamIds.length, 0);

  /* ------------------------------- laden ------------------------------- */

  const loadAll = async () => {
    setLoading(true);
    try {
      const [{ data: groupRows }, { data: slotRows }, { data: teamRows }, { data: potRows }, { data: potTeamRows }] =
        await Promise.all([
          supabase.from("groups").select("id, name, sort_order").eq("phase_id", phaseId).order("sort_order"),
          supabase.from("slots").select("id, group_id, team_id, slot_code, sort_order").eq("phase_id", phaseId).order("sort_order"),
          supabase.from("teams").select("id, name, country, logo_url, category_id").eq("tournament_id", tournamentId).order("name"),
          supabase.from("draw_pots").select("id, name, sort_order").eq("phase_id", phaseId).order("sort_order"),
          supabase.from("draw_pot_teams").select("pot_id, team_id, sort_order").eq("tournament_id", tournamentId).order("sort_order"),
        ]);

      const freeByGroup = new Map<string, string[]>();
      for (const slot of slotRows || []) {
        if (!slot.group_id || slot.team_id) continue;
        freeByGroup.set(slot.group_id, [...(freeByGroup.get(slot.group_id) || []), slot.id]);
      }
      const nextContainers: DrawContainer[] = (groupRows || []).map((g) => ({
        id: g.id,
        name: g.name,
        capacity: (freeByGroup.get(g.id) || []).length,
        slotIds: freeByGroup.get(g.id) || [],
        teamIds: [],
      }));
      setContainers(nextContainers);

      const occupied = new Set((slotRows || []).filter((s) => s.team_id).map((s) => s.team_id as string));
      const available = (teamRows || [])
        .filter((t) => (categoryId ? t.category_id === categoryId : true))
        .filter((t) => !occupied.has(t.id));
      setTeams(available.map((t) => ({ id: t.id, name: t.name, country: t.country, logoUrl: t.logo_url })));

      const availableIds = new Set(available.map((t) => t.id));
      setPots(
        (potRows || []).map((p) => ({
          id: p.id,
          name: p.name,
          sort_order: p.sort_order,
          teamIds: (potTeamRows || [])
            .filter((pt) => pt.pot_id === p.id && availableIds.has(pt.team_id))
            .map((pt) => pt.team_id),
        }))
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    setStep("settings");
    setAdvancedSpreadOpen(false);
    setSession(null);
    setRules(emptyContainerRules());
    loadAll();
  }, [open, phaseId, categoryId]);

  /* -------------------------------- potten ------------------------------ */

  const addPot = async () => {
    const { data, error } = await supabase
      .from("draw_pots")
      .insert({
        tournament_id: tournamentId,
        phase_id: phaseId,
        category_id: categoryId ?? null,
        name: `Pot ${pots.length + 1}`,
        sort_order: pots.length,
      })
      .select("id, name, sort_order")
      .single();
    if (error || !data) {
      toast({ title: "Pot toevoegen mislukt", description: error?.message, variant: "destructive" });
      return;
    }
    setPots((prev) => [...prev, { id: data.id, name: data.name, sort_order: data.sort_order, teamIds: [] }]);
  };

  const deletePot = async (potId: string) => {
    await supabase.from("draw_pot_teams").delete().eq("pot_id", potId);
    const { error } = await supabase.from("draw_pots").delete().eq("id", potId);
    if (error) {
      toast({ title: "Pot verwijderen mislukt", description: error.message, variant: "destructive" });
      return;
    }
    setPots((prev) => prev.filter((p) => p.id !== potId));
  };

  const renamePot = async (potId: string, name: string) => {
    setPots((prev) => prev.map((p) => (p.id === potId ? { ...p, name } : p)));
    await supabase.from("draw_pots").update({ name }).eq("id", potId);
  };

  const addTeamToPot = async (potId: string, teamId: string) => {
    const pot = pots.find((p) => p.id === potId);
    if (!pot) return;
    const { error } = await supabase
      .from("draw_pot_teams")
      .insert({ pot_id: potId, tournament_id: tournamentId, team_id: teamId, sort_order: pot.teamIds.length });
    if (error) {
      toast({ title: "Toevoegen mislukt", description: error.message, variant: "destructive" });
      return;
    }
    setPots((prev) => prev.map((p) => (p.id === potId ? { ...p, teamIds: [...p.teamIds, teamId] } : p)));
  };

  const removeTeamFromPot = async (potId: string, teamId: string) => {
    await supabase.from("draw_pot_teams").delete().eq("pot_id", potId).eq("team_id", teamId);
    setPots((prev) => prev.map((p) => (p.id === potId ? { ...p, teamIds: p.teamIds.filter((id) => id !== teamId) } : p)));
  };

  /** Maakt `potCount` potten en verdeelt alle deelnemers gelijk (pot 1 eerst). */
  const autoDistribute = async () => {
    setLoading(true);
    try {
      for (const pot of pots) {
        await supabase.from("draw_pot_teams").delete().eq("pot_id", pot.id);
        await supabase.from("draw_pots").delete().eq("id", pot.id);
      }
      const count = Math.max(1, Math.min(potCount, teams.length || 1));
      const created: Pot[] = [];
      for (let i = 0; i < count; i++) {
        const { data } = await supabase
          .from("draw_pots")
          .insert({
            tournament_id: tournamentId,
            phase_id: phaseId,
            category_id: categoryId ?? null,
            name: `Pot ${i + 1}`,
            sort_order: i,
          })
          .select("id, name, sort_order")
          .single();
        if (data) created.push({ id: data.id, name: data.name, sort_order: data.sort_order, teamIds: [] });
      }
      const ordered = [...teams];
      const baseSize = Math.floor(ordered.length / (created.length || 1));
      const extra = ordered.length % (created.length || 1);
      let cursor = 0;
      const inserts: { pot_id: string; tournament_id: string; team_id: string; sort_order: number }[] = [];
      created.forEach((pot, index) => {
        const size = baseSize + (index < extra ? 1 : 0);
        const slice = ordered.slice(cursor, cursor + size);
        cursor += size;
        pot.teamIds = slice.map((t) => t.id);
        slice.forEach((t, i) => inserts.push({ pot_id: pot.id, tournament_id: tournamentId, team_id: t.id, sort_order: i }));
      });
      if (inserts.length) await supabase.from("draw_pot_teams").insert(inserts);
      setPots(created);
      setRules((prev) => ({ ...prev, potQuota: {} }));
      toast({ title: `${created.length} potten aangemaakt`, description: `${inserts.length} deelnemers verdeeld.` });
    } finally {
      setLoading(false);
    }
  };

  /* ------------------------------ verdeling ----------------------------- */

  const containerIds = containers.map((c) => c.id);
  const quotaFor = (potId: string, containerId: string) => {
    const explicit = rules.potQuota[`${potId}|${containerId}`];
    if (explicit != null) return explicit;
    const pot = pots.find((p) => p.id === potId);
    const defaults = defaultPotQuota(pot?.teamIds.length || 0, containerIds);
    return defaults[containerIds.indexOf(containerId)] ?? 0;
  };
  const setQuota = (potId: string, containerId: string, value: number) =>
    setRules((prev) => ({ ...prev, potQuota: { ...prev.potQuota, [`${potId}|${containerId}`]: Math.max(0, value) } }));
  const resetQuota = () => setRules((prev) => ({ ...prev, potQuota: {} }));

  const moveTeamToPot = async (teamId: string, targetPotId: string) => {
    const source = pots.find((pot) => pot.teamIds.includes(teamId));
    if (!source || source.id === targetPotId) return;
    const target = pots.find((pot) => pot.id === targetPotId);
    if (!target) return;
    setPots((prev) =>
      prev.map((pot) => {
        if (pot.id === source.id) return { ...pot, teamIds: pot.teamIds.filter((id) => id !== teamId) };
        if (pot.id === targetPotId) return { ...pot, teamIds: [...pot.teamIds, teamId] };
        return pot;
      })
    );
    const { error: deleteError } = await supabase.from("draw_pot_teams").delete().eq("pot_id", source.id).eq("team_id", teamId);
    if (deleteError) {
      await loadAll();
      toast({ title: "Verplaatsen mislukt", description: deleteError.message, variant: "destructive" });
      return;
    }
    const { error: insertError } = await supabase.from("draw_pot_teams").insert({
      pot_id: targetPotId,
      tournament_id: tournamentId,
      team_id: teamId,
      sort_order: target.teamIds.length,
    });
    if (insertError) {
      await loadAll();
      toast({ title: "Verplaatsen mislukt", description: insertError.message, variant: "destructive" });
    }
  };

  const handlePotDragEnd = (event: DragEndEvent) => {
    const targetPotId = event.over ? String(event.over.id) : "";
    const teamId = String(event.active.id);
    if (targetPotId) void moveTeamToPot(teamId, targetPotId);
  };

  /** Volledige regels met de standaardverdeling expliciet ingevuld. */
  const effectiveRules = useMemo<ContainerRules>(() => {
    const potQuota: Record<string, number> = {};
    for (const pot of pots) {
      const defaults = defaultPotQuota(pot.teamIds.length, containerIds);
      containers.forEach((c, i) => {
        potQuota[`${pot.id}|${c.id}`] = rules.potQuota[`${pot.id}|${c.id}`] ?? defaults[i] ?? 0;
      });
    }
    return { ...rules, potQuota, onePerPot: usePots };
  }, [rules, pots, containers, usePots]);

  /* ------------------------------ ontmoetingen -------------------------- */

  const matrixKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);
  const matrixValue = (a: string, b: string) => potMatrix[matrixKey(a, b)] ?? (a === b ? 0 : 1);
  const setMatrixValue = (a: string, b: string, value: number) =>
    setPotMatrix((prev) => ({ ...prev, [matrixKey(a, b)]: value }));
  const effectiveMatrix = useMemo(() => {
    const result: Record<string, number> = {};
    for (let i = 0; i < pots.length; i++) {
      for (let j = i; j < pots.length; j++) result[`${pots[i].id}|${pots[j].id}`] = matrixValue(pots[i].id, pots[j].id);
    }
    return result;
  }, [pots, potMatrix]);

  /* -------------------------------- loting ------------------------------ */

  const drawTeamIds = usePots ? pots.flatMap((p) => p.teamIds) : teams.map((t) => t.id);

  const startDraw = () => {
    if (usePots && potTeamTotal !== totalCapacity) {
      toast({
        title: "Aantal deelnemers klopt niet",
        description: `${potTeamTotal} deelnemers in potten voor ${totalCapacity} vrije plaatsen in deze fase.`,
        variant: "destructive",
      });
      return;
    }
    const ctx = buildContainerCtx(teams, pots, effectiveRules);
    const check = checkContainerFeasibility(drawTeamIds, containers, ctx);
    if (!check.ok) {
      toast({ title: "Loting niet mogelijk", description: check.message, variant: "destructive" });
      return;
    }
    setSession(
      initContainersState({
        phaseName: phaseName || "Fase",
        mode: usePots ? "pots" : "random",
        teams,
        pots,
        containers,
        rules: effectiveRules,
      })
    );
    setStep("draw");
  };

  const pending = session?.pending ?? null;
  const activePot = session?.activePotId ? pots.find((p) => p.id === session.activePotId) : null;
  const pendingTeam = pending ? teamById.get(pending.teamId) : null;

  const handleDrawNext = (forcedTeamId?: string) => {
    if (!session) return;
    setSession(drawNext(session, forcedTeamId));
    setManualTeam("");
  };
  const handleConfirm = (targetId?: string) => {
    if (!session) return;
    setSession(confirmPending(session, targetId));
  };
  const handleRedraw = () => {
    if (!session) return;
    setSession(drawNext({ ...session, pending: null }));
  };
  const handleUndo = () => session && setSession(undoLast(session));
  const handleDrawAll = () => session && setSession(drawAll(session));
  const handleReset = () => {
    setShowResetConfirm(false);
    startDraw();
  };

  const remainingPool = session
    ? session.mode === "pots"
      ? (pots.find((p) => p.teamIds.some((id) => session.remaining.includes(id)))?.teamIds || []).filter((id) =>
          session.remaining.includes(id)
        )
      : session.remaining
    : [];

  /* -------------------------------- opslaan ----------------------------- */

  const applyDraw = async () => {
    if (!session) return;
    setApplying(true);
    try {
      const { data: slotRows } = await supabase
        .from("slots")
        .select("id, group_id, team_id, slot_code, sort_order")
        .eq("phase_id", phaseId)
        .order("sort_order");

      const freeSlots = new Map<string, { id: string; slot_code: string }[]>();
      for (const slot of slotRows || []) {
        if (!slot.group_id || slot.team_id) continue;
        freeSlots.set(slot.group_id, [...(freeSlots.get(slot.group_id) || []), { id: slot.id, slot_code: slot.slot_code }]);
      }

      const updates: { slotId: string; teamId: string; slotCode: string; groupId: string }[] = [];
      for (const container of session.containers) {
        for (const teamId of container.teamIds) {
          const slot = freeSlots.get(container.id)?.shift();
          if (!slot) continue;
          updates.push({ slotId: slot.id, teamId, slotCode: slot.slot_code, groupId: container.id });
        }
      }

      await Promise.all(updates.map((u) => supabase.from("slots").update({ team_id: u.teamId }).eq("id", u.slotId)));

      await Promise.all(
        updates.flatMap((u) => [
          supabase
            .from("matches")
            .update({ home_team_id: u.teamId })
            .match({ tournament_id: tournamentId, phase_id: phaseId, group_id: u.groupId, home_slot_label: u.slotCode }),
          supabase
            .from("matches")
            .update({ away_team_id: u.teamId })
            .match({ tournament_id: tournamentId, phase_id: phaseId, group_id: u.groupId, away_slot_label: u.slotCode }),
        ])
      );

      if (updates.length)
        await supabase
          .from("group_teams")
          .insert(updates.map((u) => ({ group_id: u.groupId, team_id: u.teamId, tournament_id: tournamentId })));

      let drawnMatches = 0;
      if (isRounds) {
        const membersByGroup = new Map<string, { teamId: string; slotCode: string }[]>();
        for (const u of updates) {
          membersByGroup.set(u.groupId, [...(membersByGroup.get(u.groupId) || []), { teamId: u.teamId, slotCode: u.slotCode }]);
        }
        for (const [groupId, members] of membersByGroup) {
          const memberIds = new Set(members.map((m) => m.teamId));
          const slotByTeam = new Map(members.map((m) => [m.teamId, m.slotCode]));
          const groupPots = pots
            .map((p) => ({ id: p.id, name: p.name, teamIds: p.teamIds.filter((id) => memberIds.has(id)) }))
            .filter((p) => p.teamIds.length > 0);
          const pairings = generatePotMatchups(groupPots, effectiveMatrix);
          if (pairings.length === 0) continue;
          await supabase.from("matches").delete().eq("tournament_id", tournamentId).eq("phase_id", phaseId).eq("group_id", groupId);
          const inserts = pairings.map((p) => ({
            tournament_id: tournamentId,
            phase_id: phaseId,
            group_id: groupId,
            home_team_id: p.homeTeamId,
            away_team_id: p.awayTeamId,
            home_slot_label: slotByTeam.get(p.homeTeamId) ?? null,
            away_slot_label: slotByTeam.get(p.awayTeamId) ?? null,
            round_number: p.round,
          }));
          const { error: insertError } = await supabase.from("matches").insert(inserts);
          if (insertError) throw insertError;
          await supabase.from("groups").update({ manual_planning: false }).eq("id", groupId);
          drawnMatches += inserts.length;
        }
      }

      await supabase.from("draw_reports").insert({
        tournament_id: tournamentId,
        phase_id: phaseId,
        report: {
          drawnAt: new Date().toISOString(),
          phaseName: phaseName || null,
          mode: session.mode,
          pots: pots.map((p) => ({ name: p.name, teams: p.teamIds.map((id) => teamById.get(id)?.name || id) })),
          rules: effectiveRules as unknown as Record<string, unknown>,
          result: session.containers.map((c) => ({
            group: c.name,
            teams: c.teamIds.map((id) => teamById.get(id)?.name || id),
          })),
          log: session.log,
        } as unknown as never,
      });

      toast({
        title: `${updates.length} deelnemers ingedeeld via de live loting`,
        description: drawnMatches > 0 ? `${drawnMatches} wedstrijden geloot over de speelrondes.` : undefined,
      });
      onApplied?.();
      onOpenChange(false);
    } catch (error: any) {
      toast({ title: "Toewijzen mislukt", description: error?.message, variant: "destructive" });
    } finally {
      setApplying(false);
    }
  };

  /* --------------------------------- UI -------------------------------- */

  const TeamChip = ({ id }: { id: string }) => {
    const team = teamById.get(id);
    return (
      <span className="inline-flex items-center gap-1.5">
        {team?.logoUrl && <img src={team.logoUrl} alt="" className="h-4 w-4 object-contain" />}
        <CountryFlag country={team?.country} className="h-3 w-4" />
        <span>{team?.name || "?"}</span>
      </span>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>Live loting{phaseName ? ` · ${phaseName}` : ""}</DialogTitle>
        </DialogHeader>

        <div className="flex gap-1 rounded-lg border border-border p-1">
          {([
            { key: "pots", label: "POTTEN" },
            ...(usePots ? [{ key: "spread" as Tab, label: "VERDELING" }] : []),
            { key: "rules", label: "REGELS" },
            ...(isRounds ? [{ key: "matchups" as Tab, label: "ONTMOETINGEN" }] : []),
            { key: "draw", label: "LOTING" },
          ] as { key: Tab; label: string }[]).map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                tab === t.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="max-h-[62vh] overflow-y-auto pr-1">
          {loading && (
            <div className="flex justify-center py-8">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          )}

          {!loading && tab === "pots" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border border-border p-3">
                <div>
                  <p className="text-sm font-medium">Met potten loten</p>
                  <p className="text-xs text-muted-foreground">
                    Deelnemers worden per pot getrokken. Zet uit voor een volledig willekeurige loting.
                  </p>
                </div>
                <Switch checked={usePots} onCheckedChange={setUsePots} />
              </div>

              {usePots && (
                <>
                  <div className="flex flex-col gap-2 rounded-lg border border-border p-3 sm:flex-row sm:items-end">
                    <div className="w-full sm:w-40">
                      <Label className="text-xs">Aantal potten</Label>
                      <Select value={String(potCount)} onValueChange={(v) => setPotCount(Number(v))}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                            <SelectItem key={n} value={String(n)}>
                              {n} potten · {Math.ceil((teams.length || 0) / n)} per pot
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button variant="outline" size="sm" onClick={autoDistribute}>
                      <Shuffle className="h-3.5 w-3.5" /> Potten aanmaken en verdelen
                    </Button>
                    <Button variant="ghost" size="sm" onClick={addPot}>
                      <Plus className="h-3.5 w-3.5" /> Lege pot
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    {pots.map((pot) => (
                      <div key={pot.id} className="space-y-2 rounded-lg border border-border p-3">
                        <div className="flex items-center gap-2">
                          <Input
                            value={pot.name}
                            onChange={(e) => renamePot(pot.id, e.target.value)}
                            className="h-8 text-sm font-bold"
                          />
                          <span className="whitespace-nowrap text-xs text-muted-foreground">{pot.teamIds.length}</span>
                          <button
                            onClick={() => deletePot(pot.id)}
                            className="text-muted-foreground hover:text-destructive"
                            aria-label={`${pot.name} verwijderen`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <div className="space-y-1">
                          {pot.teamIds.map((id) => (
                            <div key={id} className="flex items-center justify-between rounded-md bg-muted/50 px-2 py-1 text-xs">
                              <TeamChip id={id} />
                              <button onClick={() => removeTeamFromPot(pot.id, id)} className="text-muted-foreground hover:text-destructive">
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          ))}
                          {pot.teamIds.length === 0 && <p className="text-xs text-muted-foreground">Nog geen deelnemers.</p>}
                        </div>
                        {unassignedTeams.length > 0 && (
                          <Select value="" onValueChange={(v) => addTeamToPot(pot.id, v)}>
                            <SelectTrigger>
                              <SelectValue placeholder="Deelnemer toevoegen" />
                            </SelectTrigger>
                            <SelectContent>
                              {unassignedTeams.map((t) => (
                                <SelectItem key={t.id} value={t.id}>
                                  {t.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}

              <div
                className={`flex items-start gap-2 rounded-lg border p-3 text-xs ${
                  usePots && potTeamTotal !== totalCapacity ? "border-destructive text-destructive" : "border-border text-muted-foreground"
                }`}
              >
                {usePots && potTeamTotal !== totalCapacity && <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
                <span>
                  {potTeamTotal} van {teams.length} deelnemers in potten · {totalCapacity} vrije plaatsen in {containers.length} groepen.
                  {usePots && potTeamTotal !== totalCapacity && " Het aantal deelnemers in de potten moet exact gelijk zijn aan het aantal plaatsen."}
                </span>
              </div>
            </div>
          )}

          {!loading && tab === "spread" && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Hoeveel deelnemers uit een pot mogen in dezelfde groep. Standaard krijgt elke groep één deelnemer per pot;
                zitten er meer deelnemers in een pot dan er groepen zijn, dan wordt het verschil automatisch verdeeld.
              </p>
              <Button variant="outline" size="sm" onClick={resetQuota}>
                <RotateCcw className="h-3.5 w-3.5" /> Automatisch verdelen
              </Button>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr>
                      <th className="p-2 text-left font-semibold">Pot</th>
                      {containers.map((c) => (
                        <th key={c.id} className="p-2 text-center font-semibold">
                          {c.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pots.map((pot) => {
                      const total = containers.reduce((sum, c) => sum + quotaFor(pot.id, c.id), 0);
                      return (
                        <tr key={pot.id} className="border-t border-border">
                          <td className="p-2 font-medium">
                            {pot.name}
                            <span className={`ml-2 ${total < pot.teamIds.length ? "text-destructive" : "text-muted-foreground"}`}>
                              {total}/{pot.teamIds.length}
                            </span>
                          </td>
                          {containers.map((c) => (
                            <td key={c.id} className="p-1 text-center">
                              <Input
                                type="number"
                                min={0}
                                value={quotaFor(pot.id, c.id)}
                                onChange={(e) => setQuota(pot.id, c.id, Number(e.target.value))}
                                className="h-8 w-16 text-center"
                              />
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {!loading && tab === "rules" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border border-border p-3">
                <div>
                  <p className="text-sm font-medium">Zelfde land nooit samen</p>
                  <p className="text-xs text-muted-foreground">Deelnemers uit hetzelfde land komen niet in dezelfde groep.</p>
                </div>
                <Switch
                  checked={rules.separateSameCountry}
                  onCheckedChange={(v) => setRules((p) => ({ ...p, separateSameCountry: v }))}
                />
              </div>

              <div className="space-y-2 rounded-lg border border-border p-3">
                <Label className="text-xs">Maximum per land in een groep (alle landen)</Label>
                <Select
                  value={rules.countryMaxDefault == null ? "none" : String(rules.countryMaxDefault)}
                  onValueChange={(v) => setRules((p) => ({ ...p, countryMaxDefault: v === "none" ? null : Number(v) }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Geen beperking</SelectItem>
                    {[1, 2, 3, 4].map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        Maximaal {n}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Label className="pt-2 text-xs">Uitzondering per land</Label>
                <div className="space-y-1">
                  {Object.entries(rules.countryMax).map(([country, max]) => (
                    <div key={country} className="flex items-center gap-2 rounded-md bg-muted/50 px-2 py-1 text-xs">
                      <CountryFlag country={country} className="h-3 w-4" />
                      <span className="flex-1">{country}</span>
                      <Input
                        type="number"
                        min={1}
                        value={max}
                        onChange={(e) =>
                          setRules((p) => ({ ...p, countryMax: { ...p.countryMax, [country]: Number(e.target.value) } }))
                        }
                        className="h-7 w-16 text-center"
                      />
                      <button
                        onClick={() =>
                          setRules((p) => {
                            const next = { ...p.countryMax };
                            delete next[country];
                            return { ...p, countryMax: next };
                          })
                        }
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Select value={newCountry} onValueChange={setNewCountry}>
                    <SelectTrigger>
                      <SelectValue placeholder="Land kiezen" />
                    </SelectTrigger>
                    <SelectContent>
                      {countries
                        .filter((c) => rules.countryMax[c] == null)
                        .map((c) => (
                          <SelectItem key={c} value={c}>
                            {c}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!newCountry}
                    onClick={() => {
                      setRules((p) => ({ ...p, countryMax: { ...p.countryMax, [newCountry]: 1 } }));
                      setNewCountry("");
                    }}
                  >
                    <Plus className="h-3.5 w-3.5" /> Toevoegen
                  </Button>
                </div>
              </div>

              <div className="space-y-2 rounded-lg border border-border p-3">
                <Label className="text-xs">Deelnemers koppelen</Label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Select value={pairA} onValueChange={setPairA}>
                    <SelectTrigger>
                      <SelectValue placeholder="Deelnemer 1" />
                    </SelectTrigger>
                    <SelectContent>
                      {teams.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={pairB} onValueChange={setPairB}>
                    <SelectTrigger>
                      <SelectValue placeholder="Deelnemer 2" />
                    </SelectTrigger>
                    <SelectContent>
                      {teams
                        .filter((t) => t.id !== pairA)
                        .map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!pairA || !pairB}
                    onClick={() => {
                      setRules((p) => ({ ...p, forbiddenPairs: [...p.forbiddenPairs, [pairA, pairB]] }));
                      setPairA("");
                      setPairB("");
                    }}
                  >
                    Niet samen
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!pairA || !pairB}
                    onClick={() => {
                      setRules((p) => ({ ...p, requiredPairs: [...p.requiredPairs, [pairA, pairB]] }));
                      setPairA("");
                      setPairB("");
                    }}
                  >
                    Samen in één groep
                  </Button>
                </div>
                <div className="space-y-1 pt-1">
                  {rules.forbiddenPairs.map(([a, b], i) => (
                    <div key={`f${i}`} className="flex items-center justify-between rounded-md bg-muted/50 px-2 py-1 text-xs">
                      <span>
                        Niet samen: {teamById.get(a)?.name} · {teamById.get(b)?.name}
                      </span>
                      <button
                        onClick={() => setRules((p) => ({ ...p, forbiddenPairs: p.forbiddenPairs.filter((_, idx) => idx !== i) }))}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                  {rules.requiredPairs.map(([a, b], i) => (
                    <div key={`r${i}`} className="flex items-center justify-between rounded-md bg-muted/50 px-2 py-1 text-xs">
                      <span>
                        Samen: {teamById.get(a)?.name} · {teamById.get(b)?.name}
                      </span>
                      <button
                        onClick={() => setRules((p) => ({ ...p, requiredPairs: p.requiredPairs.filter((_, idx) => idx !== i) }))}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {!loading && tab === "matchups" && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Kies hoeveel keer elke pot tegen een andere pot speelt. De wedstrijden worden na de loting over de
                speelrondes verdeeld, waarbij een deelnemer nooit twee keer in dezelfde speelronde staat.
              </p>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                {pots.flatMap((a, i) =>
                  pots.slice(i).map((b) => (
                    <div key={`${a.id}|${b.id}`} className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
                      <span className="text-sm font-medium">{a.id === b.id ? `${a.name} onderling` : `${a.name} vs ${b.name}`}</span>
                      <div className="w-24">
                        <Select value={String(matrixValue(a.id, b.id))} onValueChange={(v) => setMatrixValue(a.id, b.id, Number(v))}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {[0, 1, 2, 3, 4].map((n) => (
                              <SelectItem key={n} value={String(n)}>
                                {n}x
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {!loading && tab === "draw" && (
            <div className="space-y-4">
              {!session && (
                <div className="space-y-3 rounded-lg border border-border p-4 text-center">
                  <p className="text-sm text-muted-foreground">
                    Start de loting met de ingestelde potten, verdeling en regels.
                  </p>
                  <Button onClick={startDraw}>
                    <Play className="h-4 w-4" /> Loting starten
                  </Button>
                </div>
              )}

              {session && (
                <>
                  <div className="space-y-3 rounded-lg border border-border p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-xs text-muted-foreground">
                        {activePot ? `Actieve pot: ${activePot.name} · ` : ""}
                        {session.remaining.length} deelnemers te trekken
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={handleUndo} disabled={session.history.length === 0}>
                          <Undo2 className="h-3.5 w-3.5" /> Ongedaan
                        </Button>
                        <Button variant="ghost" size="sm" onClick={handleReset}>
                          <RotateCcw className="h-3.5 w-3.5" /> Opnieuw loten
                        </Button>
                        <Button variant="outline" size="sm" onClick={handleDrawAll} disabled={session.finished}>
                          <Sparkles className="h-3.5 w-3.5" /> Alles trekken
                        </Button>
                      </div>
                    </div>

                    {!pending && !session.finished && (
                      <div className="flex flex-wrap items-center gap-2">
                        <Button onClick={() => handleDrawNext()}>
                          <Shuffle className="h-4 w-4" /> Trek deelnemer
                        </Button>
                        <div className="w-56">
                          <Select value={manualTeam} onValueChange={(v) => handleDrawNext(v)}>
                            <SelectTrigger>
                              <SelectValue placeholder="Handmatig kiezen" />
                            </SelectTrigger>
                            <SelectContent>
                              {remainingPool.map((id) => (
                                <SelectItem key={id} value={id}>
                                  {teamName(session, id)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    )}

                    {pending && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 rounded-lg bg-primary/10 px-3 py-2">
                          {pendingTeam?.logoUrl && <img src={pendingTeam.logoUrl} alt="" className="h-8 w-8 object-contain" />}
                          <CountryFlag country={pendingTeam?.country} />
                          <span className="text-base font-bold">{pendingTeam?.name}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">Geldige groepen:</p>
                        <div className="flex flex-wrap gap-2">
                          {pending.options.map((o) => (
                            <Button key={o.id} variant="outline" size="sm" onClick={() => handleConfirm(o.id)}>
                              {o.label}
                            </Button>
                          ))}
                          {pending.options.length === 0 && (
                            <p className="text-xs text-destructive">Geen geldige groep. Maak de vorige trekking ongedaan.</p>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => handleConfirm()} disabled={pending.options.length === 0}>
                            <Check className="h-3.5 w-3.5" /> Bevestig
                          </Button>
                          <Button variant="ghost" size="sm" onClick={handleRedraw}>
                            <RotateCcw className="h-3.5 w-3.5" /> Opnieuw trekken
                          </Button>
                        </div>
                      </div>
                    )}

                    {session.finished && <p className="text-sm font-semibold text-primary">De loting is volledig.</p>}
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {session.containers.map((c) => (
                      <div key={c.id} className="rounded-lg border border-border p-3">
                        <h4 className="mb-2 text-sm font-bold">{c.name}</h4>
                        <div className="space-y-1">
                          {c.teamIds.map((id) => (
                            <div key={id} className="rounded-md bg-muted/50 px-2 py-1 text-xs">
                              <TeamChip id={id} />
                            </div>
                          ))}
                          {Array.from({ length: Math.max(0, c.capacity - c.teamIds.length) }).map((_, i) => (
                            <div key={`e${i}`} className="rounded-md border border-dashed border-border px-2 py-1 text-xs text-muted-foreground">
                              —
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Sluiten
          </Button>
          {tab !== "draw" && <Button onClick={() => setTab("draw")}>Naar de loting</Button>}
          {tab === "draw" && (
            <Button onClick={applyDraw} disabled={!session || !session.finished || applying}>
              <Check className="h-4 w-4" /> Indeling toepassen
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default LiveDrawDialog;
