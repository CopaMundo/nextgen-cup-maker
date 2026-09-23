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
  defaultPotQuotas,
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
  /** Gezamenlijke standaardverdeling die de capaciteit van elke groep respecteert. */
  const jointDefaults = useMemo(
    () =>
      defaultPotQuotas(
        pots.map((p) => ({ id: p.id, size: p.teamIds.length })),
        containers.map((c) => ({ id: c.id, capacity: c.capacity }))
      ),
    [pots, containers]
  );
  const quotaFor = (potId: string, containerId: string) => {
    const explicit = rules.potQuota[`${potId}|${containerId}`];
    if (explicit != null) return explicit;
    return jointDefaults[potId]?.[containerIds.indexOf(containerId)] ?? 0;
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
      containers.forEach((c, i) => {
        potQuota[`${pot.id}|${c.id}`] = rules.potQuota[`${pot.id}|${c.id}`] ?? jointDefaults[pot.id]?.[i] ?? 0;
      });
    }
    return { ...rules, potQuota, onePerPot: usePots };
  }, [rules, pots, containers, usePots, jointDefaults]);

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
      <span className="inline-flex min-w-0 items-center gap-1.5">
        {team?.logoUrl && <img src={team.logoUrl} alt="" className="h-5 w-5 shrink-0 object-contain" />}
        <CountryFlag country={team?.country} className="h-3 w-4 shrink-0" />
        <span className="truncate">{team?.name || "?"}</span>
      </span>
    );
  };

  const validationError = () => {
    if (containers.length === 0) return { step: "settings" as Step, message: "Er zijn nog geen groepen in deze fase." };
    if (teams.length !== totalCapacity) {
      return {
        step: "settings" as Step,
        message: `${teams.length} beschikbare deelnemers voor ${totalCapacity} vrije plaatsen. Het aantal moet exact overeenkomen.`,
      };
    }
    if (usePots) {
      if (pots.length === 0) return { step: "settings" as Step, message: "Maak eerst minstens één pot aan." };
      const allAssigned = pots.flatMap((pot) => pot.teamIds);
      const uniqueAssigned = new Set(allAssigned);
      if (allAssigned.length !== teams.length || uniqueAssigned.size !== teams.length || teams.some((team) => !uniqueAssigned.has(team.id))) {
        return { step: "pots" as Step, message: "Wijs iedere deelnemer precies één keer aan een pot toe." };
      }
      for (const pot of pots) {
        const quotaTotal = containers.reduce((sum, container) => sum + quotaFor(pot.id, container.id), 0);
        if (quotaTotal !== pot.teamIds.length) {
          return {
            step: "settings" as Step,
            message: `${pot.name} bevat ${pot.teamIds.length} deelnemers, maar de verdeling voorziet ${quotaTotal} plaatsen.`,
          };
        }
      }
    }
    const ctx = buildContainerCtx(teams, pots, effectiveRules);
    const check = checkContainerFeasibility(drawTeamIds, containers, ctx);
    return check.ok ? null : { step: "settings" as Step, message: check.message || "De gekozen regels zijn niet haalbaar." };
  };

  const openDraw = () => {
    const error = validationError();
    if (error) {
      setStep(error.step);
      toast({
        title: error.step === "pots" ? "Controleer de potten" : "Controleer de instellingen",
        description: error.message,
        variant: "destructive",
      });
      return;
    }
    startDraw();
  };

  const renderRules = () => (
    <div className="space-y-3">
      <h3 className="text-sm font-bold">Regels</h3>
      <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-3">
        <div>
          <p className="text-sm font-medium">Zelfde land nooit samen</p>
          <p className="text-xs text-muted-foreground">Deelnemers uit hetzelfde land komen niet in dezelfde groep.</p>
        </div>
        <Switch checked={rules.separateSameCountry} onCheckedChange={(value) => setRules((previous) => ({ ...previous, separateSameCountry: value }))} />
      </div>

      <div className="space-y-3 rounded-lg border border-border p-3">
        <div>
          <Label className="text-xs">Maximum aantal teams per land in een groep</Label>
          <Select
            value={rules.countryMaxDefault == null ? "none" : String(rules.countryMaxDefault)}
            onValueChange={(value) => setRules((previous) => ({ ...previous, countryMaxDefault: value === "none" ? null : Number(value) }))}
          >
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Geen beperking</SelectItem>
              {[1, 2, 3, 4].map((number) => <SelectItem key={number} value={String(number)}>Maximaal {number}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="text-xs">Uitzonderingen per land</Label>
          {Object.entries(rules.countryMax).map(([country, max]) => (
            <div key={country} className="flex items-center gap-2 rounded-md bg-muted/50 px-2 py-1.5 text-xs">
              <CountryFlag country={country} className="h-3 w-4" />
              <span className="flex-1">{country}</span>
              <Input
                type="number"
                min={1}
                value={max}
                onChange={(event) => setRules((previous) => ({ ...previous, countryMax: { ...previous.countryMax, [country]: Number(event.target.value) } }))}
                className="h-8 w-16 text-center"
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                aria-label={`${country} verwijderen`}
                onClick={() => setRules((previous) => {
                  const countryMax = { ...previous.countryMax };
                  delete countryMax[country];
                  return { ...previous, countryMax };
                })}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
          <div className="flex flex-col gap-2 sm:flex-row">
            <Select value={newCountry} onValueChange={setNewCountry}>
              <SelectTrigger><SelectValue placeholder="Land kiezen" /></SelectTrigger>
              <SelectContent>
                {countries.filter((country) => rules.countryMax[country] == null).map((country) => <SelectItem key={country} value={country}>{country}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              disabled={!newCountry}
              onClick={() => {
                setRules((previous) => ({ ...previous, countryMax: { ...previous.countryMax, [newCountry]: 1 } }));
                setNewCountry("");
              }}
            >
              <Plus className="h-3.5 w-3.5" /> Toevoegen
            </Button>
          </div>
        </div>
      </div>

      <div className="space-y-3 rounded-lg border border-border p-3">
        <Label className="text-xs">Teams niet samen of samen in één groep</Label>
        <div className="grid gap-2 sm:grid-cols-2">
          <Select value={pairA} onValueChange={setPairA}>
            <SelectTrigger><SelectValue placeholder="Team 1" /></SelectTrigger>
            <SelectContent>{teams.map((team) => <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={pairB} onValueChange={setPairB}>
            <SelectTrigger><SelectValue placeholder="Team 2" /></SelectTrigger>
            <SelectContent>{teams.filter((team) => team.id !== pairA).map((team) => <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={!pairA || !pairB}
            onClick={() => {
              setRules((previous) => ({ ...previous, forbiddenPairs: [...previous.forbiddenPairs, [pairA, pairB]] }));
              setPairA(""); setPairB("");
            }}
          >Teams niet samen</Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!pairA || !pairB}
            onClick={() => {
              setRules((previous) => ({ ...previous, requiredPairs: [...previous.requiredPairs, [pairA, pairB]] }));
              setPairA(""); setPairB("");
            }}
          >Teams samen in één groep</Button>
        </div>
        <div className="space-y-1">
          {rules.forbiddenPairs.map(([first, second], index) => (
            <div key={`forbidden-${index}`} className="flex items-center justify-between rounded-md bg-muted/50 px-2 py-1 text-xs">
              <span>Niet samen: {teamById.get(first)?.name} · {teamById.get(second)?.name}</span>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" aria-label="Regel verwijderen" onClick={() => setRules((previous) => ({ ...previous, forbiddenPairs: previous.forbiddenPairs.filter((_, itemIndex) => itemIndex !== index) }))}><Trash2 className="h-3 w-3" /></Button>
            </div>
          ))}
          {rules.requiredPairs.map(([first, second], index) => (
            <div key={`required-${index}`} className="flex items-center justify-between rounded-md bg-muted/50 px-2 py-1 text-xs">
              <span>Samen: {teamById.get(first)?.name} · {teamById.get(second)?.name}</span>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" aria-label="Regel verwijderen" onClick={() => setRules((previous) => ({ ...previous, requiredPairs: previous.requiredPairs.filter((_, itemIndex) => itemIndex !== index) }))}><Trash2 className="h-3 w-3" /></Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const drawContent = session && (
    <div className="grid min-h-0 flex-1 gap-5 overflow-hidden lg:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.65fr)]">
      <section className="min-h-0 overflow-y-auto border-b border-border pb-5 lg:border-b-0 lg:border-r lg:pb-0 lg:pr-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase text-muted-foreground">Actueel overzicht</p>
            <h2 className="text-xl font-bold">{phaseName || "Fase"}</h2>
          </div>
          <span className="text-xs text-muted-foreground">{session.history.length}/{teams.length} geplaatst</span>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {session.containers.map((container) => (
            <div key={container.id} className="rounded-lg border border-border bg-card p-3">
              <h3 className="mb-2 text-sm font-bold">{container.name}</h3>
              <div className="space-y-1.5">
                {container.teamIds.map((id) => <div key={id} className="rounded-md bg-muted/50 px-2 py-2 text-xs"><TeamChip id={id} /></div>)}
                {Array.from({ length: Math.max(0, container.capacity - container.teamIds.length) }).map((_, index) => (
                  <div key={`empty-${index}`} className="rounded-md border border-dashed border-border px-2 py-2 text-xs text-muted-foreground">Lege plaats</div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <aside className="min-h-0 overflow-y-auto">
        <div className="space-y-4 rounded-lg border border-border bg-card p-4">
          <div>
            <p className="text-xs font-semibold uppercase text-muted-foreground">Actieve trekking</p>
            <h2 className="text-lg font-bold">{activePot ? activePot.name : "Volledig willekeurig"}</h2>
            <p className="text-sm text-muted-foreground">{session.remaining.length} teams resterend</p>
          </div>

          {!pending && !session.finished && (
            <div className="space-y-3">
              <Button className="w-full" size="lg" onClick={() => handleDrawNext()}><Shuffle className="h-4 w-4" /> Trek team</Button>
              <Select value={manualTeam} onValueChange={(value) => handleDrawNext(value)}>
                <SelectTrigger><SelectValue placeholder="Handmatig kiezen" /></SelectTrigger>
                <SelectContent>{remainingPool.map((id) => <SelectItem key={id} value={id}>{teamName(session, id)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}

          {pending && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 rounded-lg bg-primary/10 p-4">
                {pendingTeam?.logoUrl && <img src={pendingTeam.logoUrl} alt="" className="h-12 w-12 object-contain" />}
                <div className="min-w-0">
                  <div className="flex items-center gap-2"><CountryFlag country={pendingTeam?.country} /><span className="truncate text-lg font-bold">{pendingTeam?.name}</span></div>
                  <p className="text-xs text-muted-foreground">Getrokken team</p>
                </div>
              </div>
              <div>
                <p className="mb-2 text-xs font-semibold text-muted-foreground">Geldige groepen</p>
                <div className="grid grid-cols-2 gap-2">
                  {pending.options.map((option) => <Button key={option.id} variant="outline" onClick={() => handleConfirm(option.id)}>{option.label}</Button>)}
                </div>
                {pending.options.length === 0 && <p className="text-sm text-destructive">Geen geldige groep. Maak de vorige trekking ongedaan.</p>}
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <Button onClick={() => handleConfirm()} disabled={pending.options.length === 0}><Check className="h-4 w-4" /> Bevestig plaatsing</Button>
                <Button variant="outline" onClick={handleRedraw}><RotateCcw className="h-4 w-4" /> Opnieuw trekken</Button>
              </div>
            </div>
          )}

          {session.finished && (
            <div className="space-y-3">
              <p className="rounded-lg bg-primary/10 p-3 text-sm font-semibold text-primary">De loting is volledig.</p>
              <Button className="w-full" onClick={applyDraw} disabled={applying}><Check className="h-4 w-4" /> Indeling toepassen</Button>
            </div>
          )}

          <div className="flex flex-wrap gap-1 border-t border-border pt-3">
            <Button variant="ghost" size="sm" onClick={handleUndo} disabled={session.history.length === 0}><Undo2 className="h-3.5 w-3.5" /> Ongedaan</Button>
            <Button variant="ghost" size="sm" onClick={() => setShowResetConfirm(true)}><RotateCcw className="h-3.5 w-3.5" /> Opnieuw loten</Button>
            <Button variant="outline" size="sm" onClick={handleDrawAll} disabled={session.finished}><Sparkles className="h-3.5 w-3.5" /> Alles trekken</Button>
          </div>
        </div>
      </aside>
    </div>
  );

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className={step === "draw" ? "inset-0 left-0 top-0 flex h-dvh w-screen max-w-none translate-x-0 translate-y-0 flex-col overflow-hidden rounded-none border-0 p-4 sm:p-6" : "max-w-5xl"}>
          <DialogHeader className={step === "draw" ? "shrink-0 border-b border-border pb-3" : ""}>
            <DialogTitle className="flex items-center gap-2">
              {step === "draw" && <Maximize2 className="h-4 w-4" />}
              Live loting{phaseName ? ` · ${phaseName}` : ""}
            </DialogTitle>
          </DialogHeader>

          {loading ? (
            <div className="flex justify-center py-12"><div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>
          ) : step === "settings" ? (
            <div className="max-h-[68vh] space-y-5 overflow-y-auto pr-1">
              <section className="space-y-3">
                <div>
                  <h2 className="text-base font-bold">Instellingen & regels</h2>
                  <p className="text-xs text-muted-foreground">Kies eerst hoe je de teams wilt loten.</p>
                </div>
                <div className="space-y-2">
                  <Label>Lotingsmethode</Label>
                  <RadioGroup value={usePots ? "pots" : "random"} onValueChange={(value) => setUsePots(value === "pots")} className="grid gap-2 sm:grid-cols-2">
                    <label className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 ${!usePots ? "border-primary bg-primary/[0.06]" : "border-border"}`}>
                      <RadioGroupItem value="random" className="mt-0.5" />
                      <span><span className="block text-sm font-semibold">Volledig willekeurige loting</span><span className="block text-xs text-muted-foreground">Alle teams worden zonder potten getrokken.</span></span>
                    </label>
                    <label className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 ${usePots ? "border-primary bg-primary/[0.06]" : "border-border"}`}>
                      <RadioGroupItem value="pots" className="mt-0.5" />
                      <span><span className="block text-sm font-semibold">Met potten loten</span><span className="block text-xs text-muted-foreground">Teams worden eerst volgens niveau of een eigen indeling verdeeld.</span></span>
                    </label>
                  </RadioGroup>
                </div>
              </section>

              {usePots && (
                <section className="space-y-3 border-t border-border pt-5">
                  <h3 className="text-sm font-bold">Potinstellingen</h3>
                  <div className="grid gap-3 sm:grid-cols-[minmax(0,180px)_minmax(0,180px)_1fr] sm:items-end">
                    <div>
                      <Label className="text-xs">Aantal potten</Label>
                      <Select value={String(potCount)} onValueChange={(value) => setPotCount(Number(value))}>
                        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>{Array.from({ length: Math.min(12, Math.max(1, teams.length)) }, (_, index) => index + 1).map((number) => <SelectItem key={number} value={String(number)}>{number}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Teams per pot</Label>
                      <div className="mt-1 flex h-10 items-center rounded-md border border-input bg-muted/30 px-3 text-sm">{Math.floor(teams.length / Math.max(1, potCount))}–{Math.ceil(teams.length / Math.max(1, potCount))}</div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" onClick={autoDistribute}><Shuffle className="h-3.5 w-3.5" /> Potten automatisch aanmaken</Button>
                      <Button variant="ghost" size="sm" onClick={addPot}><Plus className="h-3.5 w-3.5" /> Lege pot toevoegen</Button>
                    </div>
                  </div>

                  <div className="rounded-lg border border-border p-3">
                    <p className="text-sm font-medium">Verdeling per groep</p>
                    <p className="text-xs text-muted-foreground">Elke groep krijgt automatisch één team uit elke pot. Zijn er meer teams dan groepen, dan worden de extra plaatsen evenwichtig aangevuld.</p>
                    <Collapsible open={advancedSpreadOpen} onOpenChange={setAdvancedSpreadOpen} className="mt-3">
                      <CollapsibleTrigger asChild>
                        <Button variant="outline" size="sm">Geavanceerde verdeling aanpassen <ChevronDown className={`h-3.5 w-3.5 transition-transform ${advancedSpreadOpen ? "rotate-180" : ""}`} /></Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="mt-3 space-y-3">
                        <Button variant="ghost" size="sm" onClick={resetQuota}><RotateCcw className="h-3.5 w-3.5" /> Automatische verdeling herstellen</Button>
                        <div className="overflow-x-auto">
                          <table className="w-full min-w-[520px] text-xs">
                            <thead><tr><th className="p-2 text-left">Pot</th>{containers.map((container) => <th key={container.id} className="p-2 text-center">{container.name}</th>)}</tr></thead>
                            <tbody>{pots.map((pot) => {
                              const total = containers.reduce((sum, container) => sum + quotaFor(pot.id, container.id), 0);
                              return <tr key={pot.id} className="border-t border-border"><td className="p-2 font-medium">{pot.name} <span className={total === pot.teamIds.length ? "text-muted-foreground" : "text-destructive"}>{total}/{pot.teamIds.length}</span></td>{containers.map((container) => <td key={container.id} className="p-1"><Input type="number" min={0} value={quotaFor(pot.id, container.id)} onChange={(event) => setQuota(pot.id, container.id, Number(event.target.value))} className="mx-auto h-8 w-16 text-center" /></td>)}</tr>;
                            })}</tbody>
                          </table>
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  </div>

                  {isRounds && (
                    <div className="space-y-2 rounded-lg border border-border p-3">
                      <p className="text-sm font-medium">Ontmoetingen tussen potten</p>
                      <div className="grid gap-2 md:grid-cols-2">
                        {pots.flatMap((first, index) => pots.slice(index).map((second) => (
                          <div key={`${first.id}|${second.id}`} className="flex items-center justify-between gap-3 rounded-md bg-muted/40 p-2">
                            <span className="text-xs font-medium">{first.id === second.id ? `${first.name} onderling` : `${first.name} tegen ${second.name}`}</span>
                            <Select value={String(matrixValue(first.id, second.id))} onValueChange={(value) => setMatrixValue(first.id, second.id, Number(value))}>
                              <SelectTrigger className="h-8 w-20"><SelectValue /></SelectTrigger>
                              <SelectContent>{[0, 1, 2, 3, 4].map((number) => <SelectItem key={number} value={String(number)}>{number}x</SelectItem>)}</SelectContent>
                            </Select>
                          </div>
                        ))) }
                      </div>
                    </div>
                  )}
                </section>
              )}

              <section className="border-t border-border pt-5">{renderRules()}</section>
            </div>
          ) : step === "pots" ? (
            <div className="max-h-[68vh] space-y-4 overflow-y-auto pr-1">
              <div>
                <h2 className="text-base font-bold">Potten</h2>
                <p className="text-sm text-muted-foreground">Verdeel alle teams over de potten. Bij de live loting wordt telkens een team uit de actieve pot getrokken.</p>
              </div>
              <div className={`flex items-start gap-2 rounded-lg border p-3 text-xs ${potTeamTotal !== teams.length || unassignedTeams.length > 0 ? "border-destructive text-destructive" : "border-border text-muted-foreground"}`}>
                {(potTeamTotal !== teams.length || unassignedTeams.length > 0) && <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
                <span>{potTeamTotal} van {teams.length} teams toegewezen · {totalCapacity} vrije plaatsen in {containers.length} groepen.</span>
              </div>
              <DndContext sensors={dndSensors} onDragEnd={handlePotDragEnd}>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {pots.map((pot) => (
                    <div key={pot.id} className="space-y-2 rounded-lg border border-border p-3">
                      <div className="flex items-center gap-2">
                        <Input value={pot.name} onChange={(event) => renamePot(pot.id, event.target.value)} className="h-9 text-sm font-bold" />
                        <span className="whitespace-nowrap text-xs text-muted-foreground">{pot.teamIds.length} teams</span>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => deletePot(pot.id)} aria-label={`${pot.name} verwijderen`}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                      <PotDropZone id={pot.id}>
                        {pot.teamIds.map((id) => <DraggablePotTeam key={id} id={id}><TeamChip id={id} /><Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => removeTeamFromPot(pot.id, id)} aria-label="Uit pot verwijderen"><Trash2 className="h-3 w-3" /></Button></DraggablePotTeam>)}
                        {pot.teamIds.length === 0 && <p className="px-2 py-4 text-center text-xs text-muted-foreground">Sleep een team naar deze pot.</p>}
                      </PotDropZone>
                      {unassignedTeams.length > 0 && (
                        <Select value="" onValueChange={(value) => addTeamToPot(pot.id, value)}>
                          <SelectTrigger><SelectValue placeholder="Team handmatig toevoegen" /></SelectTrigger>
                          <SelectContent>{unassignedTeams.map((team) => <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>)}</SelectContent>
                        </Select>
                      )}
                    </div>
                  ))}
                </div>
              </DndContext>
              {unassignedTeams.length > 0 && (
                <div className="rounded-lg border border-dashed border-border p-3">
                  <p className="mb-2 text-xs font-semibold">Niet toegewezen teams</p>
                  <div className="flex flex-wrap gap-2">{unassignedTeams.map((team) => <span key={team.id} className="rounded-md bg-muted px-2 py-1 text-xs"><TeamChip id={team.id} /></span>)}</div>
                </div>
              )}
            </div>
          ) : drawContent}

          {step !== "draw" && (
            <DialogFooter className="border-t border-border pt-4">
              <Button variant="ghost" onClick={() => onOpenChange(false)}>Sluiten</Button>
              {step === "pots" && <Button variant="outline" onClick={() => setStep("settings")}><ArrowLeft className="h-4 w-4" /> Terug naar instellingen</Button>}
              {step === "settings" && usePots && <Button onClick={() => setStep("pots")}>Verder naar potten</Button>}
              {step === "settings" && !usePots && <Button onClick={openDraw}>Naar de loting</Button>}
              {step === "pots" && <Button onClick={openDraw}>Naar de loting</Button>}
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={showResetConfirm} onOpenChange={setShowResetConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Loting opnieuw starten?</AlertDialogTitle>
            <AlertDialogDescription>Alle bevestigde trekkingen van deze huidige sessie worden verwijderd. De instellingen en potten blijven behouden.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={handleReset}>Opnieuw starten</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default LiveDrawDialog;
