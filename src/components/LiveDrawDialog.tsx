import { useEffect, useMemo, useRef, useState } from "react";
import { useDrawTournamentLogo } from "@/hooks/useDrawTournamentLogo";
import { DrawScopeConfirm } from "@/components/draw/DrawScopeConfirm";
import { useDrawTournamentName } from "@/hooks/useDrawTournamentName";
import { PotTeamSlots } from "@/components/draw/PotTeamSlots";
import { DrawShow } from "@/components/draw/DrawShow";
import { DrawShowOptions } from "@/components/draw/DrawShowOptions";
import { useDrawShowOptions } from "@/hooks/useDrawShowOptions";
import { DrawFullscreenButton } from "@/components/draw/DrawFullscreenButton";
import { revealDuration, selectionDuration, sweepDuration, type DrawPresentation } from "@/lib/drawPresentation";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
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
import { Trash2, Shuffle, Undo2, RotateCcw, Check, AlertTriangle, Sparkles, ChevronDown, ArrowLeft, ExternalLink, Settings2 } from "lucide-react";
import { generatePotMatchups } from "@/lib/drawEngine";
import { generateRoundRobin } from "@/lib/matchGenerator";
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

type Step = "method" | "pots" | "settings" | "draw";

interface LiveDrawDraft {
  version: 1;
  step: Step;
  usePots: boolean;
  potCount: number;
  rules: ContainerRules;
  potMatrix: Record<string, number>;
  session: DrawSessionState | null;
  selectedPotId: string | null;
  advancedOpen: boolean;
  advancedSpreadOpen: boolean;
  placementMode?: "manual" | "automatic";
  animationSpeed?: number;
  presentation?: DrawPresentation;
}

const LiveDrawDialog = ({
  open,
  onOpenChange,
  tournamentId,
  phaseId,
  categoryId,
  phaseMatchType,
  phaseName,
  onApplied,
  overwrite = false,
  onBack,
  onRestart,
  onStepChange,
  automaticRounds,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tournamentId: string;
  phaseId: string;
  categoryId?: string | null;
  phaseMatchType?: string;
  phaseName?: string;
  onApplied?: () => void;
  overwrite?: boolean;
  onBack?: () => void;
  onRestart?: () => void;
  onStepChange?: (step: string) => void;
  automaticRounds?: number;
}) => {
  const isRounds = phaseMatchType === "rounds";
  const tournamentName = useDrawTournamentName(tournamentId, open);
  const tournamentLogo = useDrawTournamentLogo(tournamentId, open);
  const [scopeAction, setScopeAction] = useState<"reset" | "complete" | null>(null);
  const { toast } = useToast();
  const [step, setStep] = useState<Step>("method");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [advancedSpreadOpen, setAdvancedSpreadOpen] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [selectedPotId, setSelectedPotId] = useState<string | null>(null);
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
  const [pairA, setPairA] = useState("");
  const [pairB, setPairB] = useState("");
  const [manualTeam, setManualTeam] = useState("");
  const [placementMode, setPlacementMode] = useState<"manual" | "automatic">("manual");
  const [spotlightId, setSpotlightId] = useState<string | null>(null);
  const [rolling, setRolling] = useState(false);
  const [showOptions, setShowOptions] = useDrawShowOptions(phaseId);
  const animationSpeed = showOptions.speed;
  const [presentation, setPresentation] = useState<DrawPresentation>({ revealAt: 0, speed: 1, activePotId: null, selection: null });
  const [revealing, setRevealing] = useState(false);
  const timers = useRef<number[]>([]);
  const directorRef = useRef<HTMLDivElement>(null);
  const syncQueue = useRef<Promise<unknown>>(Promise.resolve());
  const publishedHere = useRef(false);
  const [draftReady, setDraftReady] = useState(false);
  const draftKey = `copa-live-draw:groups:v1:${phaseId}`;
  const [savingSlot, setSavingSlot] = useState(false);
  const [pendingPotCount, setPendingPotCount] = useState<number | null>(null);

  const teamById = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);
  const assignedTeamIds = useMemo(() => new Set(pots.flatMap((p) => p.teamIds)), [pots]);
  const unassignedTeams = useMemo(() => teams.filter((t) => !assignedTeamIds.has(t.id)), [teams, assignedTeamIds]);
  const countries = useMemo(
    () => Array.from(new Set(teams.map((t) => t.country).filter(Boolean) as string[])).sort(),
    [teams]
  );
  const countryCounts = useMemo(() => teams.reduce<Record<string, number>>((counts, team) => {
    if (team.country) counts[team.country] = (counts[team.country] || 0) + 1;
    return counts;
  }, {}), [teams]);
  const exceptionalCountries = useMemo(
    () => countries.filter((country) => countryCounts[country] > containers.length),
    [countries, countryCounts, containers.length]
  );
  const maxGroupCapacity = Math.max(1, ...containers.map((container) => container.capacity));
  const totalCapacity = containers.reduce((sum, c) => sum + c.capacity, 0);
  const potTeamTotal = pots.reduce((sum, p) => sum + p.teamIds.length, 0);
  /** Aantal te loten teams = capaciteit van het format, niet het aantal ingeschreven teams. */
  const drawSize = totalCapacity;
  useEffect(() => { if (open) onStepChange?.(step); }, [open, step]);

  /* ------------------------------- laden ------------------------------- */

  const loadAll = async () => {
    setLoading(true);
    try {
      const [{ data: groupRows }, { data: slotRows }, { data: teamRows }, { data: potRows }, { data: potTeamRows }] =
        await Promise.all([
          supabase.from("groups").select("id, name, sort_order").eq("phase_id", phaseId).order("created_at").order("name"),
          supabase.from("slots").select("id, group_id, team_id, slot_code, sort_order").eq("phase_id", phaseId).order("sort_order"),
          supabase.from("teams").select("id, name, country, logo_url, category_id").eq("tournament_id", tournamentId).order("name"),
          supabase.from("draw_pots").select("id, name, sort_order").eq("phase_id", phaseId).order("sort_order"),
          supabase.from("draw_pot_teams").select("pot_id, team_id, sort_order").eq("tournament_id", tournamentId).order("sort_order"),
        ]);

      const freeByGroup = new Map<string, string[]>();
      for (const slot of slotRows || []) {
        if (!slot.group_id || (slot.team_id && !overwrite)) continue;
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

      const occupied = new Set(overwrite ? [] : (slotRows || []).filter((s) => s.team_id).map((s) => s.team_id as string));
      const available = (teamRows || [])
        .filter((t) => (categoryId ? t.category_id === categoryId : true))
        .filter((t) => !occupied.has(t.id));
      setTeams(available.map((t) => ({ id: t.id, name: t.name, country: t.country, logoUrl: t.logo_url })));

      const availableIds = new Set(available.map((t) => t.id));
      const nextPots =
        (potRows || []).map((p) => ({
          id: p.id,
          name: p.name,
          sort_order: p.sort_order,
          teamIds: (potTeamRows || [])
            .filter((pt) => pt.pot_id === p.id && availableIds.has(pt.team_id))
            .map((pt) => pt.team_id),
        }));
      setPots(nextPots);
      try {
        const raw = localStorage.getItem(draftKey);
        const draft = raw ? JSON.parse(raw) as LiveDrawDraft : null;
        if (draft?.version === 1) {
          const validTeamIds = new Set(available.map((team) => team.id));
          const validContainerIds = new Set(nextContainers.map((container) => container.id));
          const validPotIds = new Set(nextPots.map((pot) => pot.id));
          const sessionValid = !draft.session || (
            draft.session.remaining.every((id) => validTeamIds.has(id)) &&
            draft.session.containers.every((container) => validContainerIds.has(container.id) && container.teamIds.every((id) => validTeamIds.has(id)))
          );
          setStep(sessionValid ? draft.step : "method");
          setUsePots(draft.usePots);
          setPotCount(draft.potCount);
          setRules({ ...draft.rules, separateSameCountry: false, requiredPairs: [] });
          setPotMatrix(draft.potMatrix);
          const recovered = sessionValid ? draft.session : null;
          setSession(recovered?.pending && draft.presentation?.selection ? confirmPending(recovered, draft.presentation.selection.targetId) : recovered);
          setPresentation({ revealAt: draft.presentation?.revealAt ?? 0, speed: draft.animationSpeed ?? 1, activePotId: draft.presentation?.activePotId ?? null, selection: null, sweep: null });
          setSelectedPotId(draft.selectedPotId && validPotIds.has(draft.selectedPotId) ? draft.selectedPotId : null);
          setAdvancedOpen(draft.advancedOpen);
          setAdvancedSpreadOpen(draft.advancedSpreadOpen);
          setPlacementMode(draft.placementMode ?? "manual");
        } else {
          const counts = available.reduce<Record<string, number>>((result, team) => {
            if (team.country) result[team.country] = (result[team.country] || 0) + 1;
            return result;
          }, {});
          const automaticLimit = nextContainers.length
            ? Math.max(1, ...Object.values(counts).map((count) => Math.ceil(count / nextContainers.length)))
            : null;
          setRules((previous) => ({ ...previous, countryMaxDefault: automaticLimit, separateSameCountry: false, requiredPairs: [] }));
        }
      } catch {
        localStorage.removeItem(draftKey);
      }
    } finally {
      setDraftReady(true);
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    setDraftReady(false);
    setStep("method");
    setAdvancedOpen(false);
    setAdvancedSpreadOpen(false);
    setSelectedPotId(null);
    setSession(null);
    setPlacementMode("manual");
    setSpotlightId(null);
    setRules(emptyContainerRules());
    loadAll();
  }, [open, phaseId, categoryId]);

  useEffect(() => {
    if (!open || !draftReady) return;
    const draft: LiveDrawDraft = { version: 1, step, usePots, potCount, rules, potMatrix, session, selectedPotId, advancedOpen, advancedSpreadOpen, placementMode, animationSpeed, presentation };
    localStorage.setItem(draftKey, JSON.stringify(draft));
  }, [open, draftReady, draftKey, step, usePots, potCount, rules, potMatrix, session, selectedPotId, advancedOpen, advancedSpreadOpen, placementMode, animationSpeed, presentation]);

  useEffect(() => {
    if (!open || !draftReady || (step !== "draw" && step !== "settings")) return;
    const picture = { session: step === "draw" ? session : null, spotlightId, presentation: { ...presentation, tournamentName, tournamentLogo, theme: showOptions.theme, flagBackdrops: showOptions.flagBackdrops, language: navigator.language, speed: animationSpeed, activePotId: session?.pending ? session.activePotId : activePotChoice?.id ?? null } };
    publishedHere.current = true;
    syncQueue.current = syncQueue.current.then(async () => {
      const { error } = await supabase.from("draw_sessions").upsert({ tournament_id: tournamentId, phase_id: phaseId, category_id: categoryId ?? null, status: step === "draw" ? "running" : "setup", state: picture as unknown as never }, { onConflict: "phase_id" });
      if (error) console.warn("Live loting niet gesynchroniseerd", error.message);
    });
  }, [open, draftReady, session, step, spotlightId, presentation, animationSpeed, showOptions.theme, showOptions.flagBackdrops, selectedPotId, tournamentId, tournamentName, tournamentLogo, phaseId, categoryId]);

  useEffect(() => {
    if (open && step === "draw") return;
    timers.current.forEach(window.clearTimeout);
    timers.current = [];
    setRolling(false);
    setRevealing(false);
    setPresentation((previous) => ({ ...previous, selection: null }));
    if (publishedHere.current && (!open || (step !== "draw" && step !== "settings"))) {
      publishedHere.current = false;
      syncQueue.current = syncQueue.current.then(() => supabase.from("draw_sessions").update({ status: "closed" }).eq("phase_id", phaseId));
    }
  }, [open, step, phaseId, draftReady]);

  /* -------------------------------- potten ------------------------------ */

  const renamePot = async (potId: string, name: string) => {
    setPots((prev) => prev.map((p) => (p.id === potId ? { ...p, name } : p)));
    await supabase.from("draw_pots").update({ name }).eq("id", potId);
  };

  /** Maakt `count` lege potten aan (Pot 1, Pot 2, ...) en vervangt de bestaande. */
  const createEmptyPots = async (count: number) => {
    if (drawSize % count !== 0 || count < 2 || count > drawSize) return;
    setLoading(true);
    try {
      if (pots.length) {
        const { error: assignmentsError } = await supabase.from("draw_pot_teams").delete().in("pot_id", pots.map((p) => p.id));
        if (assignmentsError) throw assignmentsError;
        const { error: potsError } = await supabase.from("draw_pots").delete().in("id", pots.map((p) => p.id));
        if (potsError) throw potsError;
      }
      const { data, error } = await supabase
        .from("draw_pots")
        .insert(
          Array.from({ length: count }, (_, i) => ({
            tournament_id: tournamentId,
            phase_id: phaseId,
            category_id: categoryId ?? null,
            name: `Pot ${i + 1}`,
            sort_order: i,
          }))
        )
        .select("id, name, sort_order");
      if (error) {
        toast({ title: "Potten aanmaken mislukt", description: error.message, variant: "destructive" });
        return;
      }
      setPots(
        (data || [])
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((p) => ({ id: p.id, name: p.name, sort_order: p.sort_order, teamIds: [] }))
      );
      setPotCount(count);
      setRules((prev) => ({ ...prev, potQuota: {} }));
    } catch (error: any) {
      toast({ title: "Potverdeling wijzigen mislukt", description: error?.message, variant: "destructive" });
      await loadAll();
    } finally {
      setLoading(false);
    }
  };

  const potOptions = Array.from({ length: drawSize }, (_, i) => i + 1)
    .filter((count) => count >= 2 && count < drawSize && drawSize % count === 0);
  const requestPotCount = (count: number) => {
    if (count === pots.length) return;
    if (pots.some((pot) => pot.teamIds.length)) setPendingPotCount(count);
    else void createEmptyPots(count);
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

  const setPotSlot = async (potId: string, index: number, teamId: string | null) => {
    if (savingSlot) return;
    const pot = pots.find((p) => p.id === potId);
    if (!pot || drawSize % pots.length !== 0 || index >= drawSize / pots.length) return;
    const previous = pot.teamIds[index];
    if (previous === teamId || (teamId && assignedTeamIds.has(teamId))) return;
    setSavingSlot(true);
    try {
      if (previous) {
        const { error } = await supabase.from("draw_pot_teams").delete().eq("pot_id", potId).eq("team_id", previous);
        if (error) throw error;
      }
      if (teamId) {
        const { error } = await supabase.from("draw_pot_teams").insert({ pot_id: potId, tournament_id: tournamentId, team_id: teamId, sort_order: index });
        if (error) {
          if (previous) await supabase.from("draw_pot_teams").insert({ pot_id: potId, tournament_id: tournamentId, team_id: previous, sort_order: index });
          throw error;
        }
      }
      setPots((prev) => prev.map((p) => {
        if (p.id !== potId) return p;
        const teamIds = [...p.teamIds];
        if (teamId) teamIds[index] = teamId;
        else teamIds.splice(index, 1);
        return { ...p, teamIds };
      }));
    } catch (error: any) {
      toast({ title: "Toewijzen mislukt", description: error?.message, variant: "destructive" });
      await loadAll();
    } finally {
      setSavingSlot(false);
    }
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

  const activePotChoice =
    session?.mode === "pots"
      ? pots.find((p) => p.id === selectedPotId && p.teamIds.some((id) => session.remaining.includes(id))) ||
        pots.find((p) => p.teamIds.some((id) => session.remaining.includes(id))) ||
        null
      : null;
  const handleDrawNext = (forcedTeamId?: string) => {
    if (!session || rolling || revealing) return;
    setPresentation({ revealAt: Date.now(), speed: animationSpeed, activePotId: activePotChoice?.id ?? null, selection: null });
    setRevealing(true);
    timers.current.push(window.setTimeout(() => setRevealing(false), revealDuration(animationSpeed)));
    setSession(drawNext(session, forcedTeamId, activePotChoice?.id ?? null));
    setManualTeam("");
  };
  const placeSelection = (targetId: string) => {
    setRolling(true);
    setSpotlightId(targetId);
    setPresentation((previous) => ({ ...previous, speed: animationSpeed, sweep: null, selection: { targetId, startedAt: Date.now() } }));
    timers.current.push(window.setTimeout(() => {
      setSession((current) => current?.pending ? confirmPending(current, targetId) : current);
      setPresentation((previous) => ({ ...previous, selection: null }));
      setSpotlightId(null);
      setRolling(false);
    }, selectionDuration(animationSpeed)));
  };
  const drawGroup = () => {
    if (!session?.pending?.options.length || rolling || revealing) return;
    const options = session.pending.options;
    setRolling(true);
    const winner = options[Math.floor(Math.random() * options.length)].id;
    setPresentation((previous) => ({ ...previous, speed: animationSpeed, sweep: { startedAt: Date.now(), optionIds: options.map((option) => option.id) } }));
    timers.current.push(window.setTimeout(() => placeSelection(winner), sweepDuration(options.length, animationSpeed)));
  };
  useEffect(() => {
    if (step !== "draw" || placementMode !== "automatic" || !session?.pending?.options.length || rolling || revealing) return;
    const targetId = session.pending.options[0].id;
    const id = window.setTimeout(() => placeSelection(targetId), 350 / animationSpeed);
    return () => window.clearTimeout(id);
  }, [step, placementMode, session?.pending?.teamId, rolling, revealing]);
  const handleRedraw = () => {
    if (!session || rolling || revealing) return;
    const next = { ...session, pending: null };
    setPresentation({ revealAt: Date.now(), speed: animationSpeed, activePotId: activePotChoice?.id ?? null, selection: null });
    setRevealing(true);
    timers.current.push(window.setTimeout(() => setRevealing(false), revealDuration(animationSpeed)));
    setSession(drawNext(next, undefined, activePotChoice?.id));
  };
  const handleUndo = () => { if (session && !rolling && !revealing) { setPresentation((previous) => ({ ...previous, selection: null })); setSession(undoLast(session)); } };
  const handleDrawAll = (currentPotOnly = false) => {
    if (!session || rolling || revealing) return;
    if (!currentPotOnly || !activePotChoice) setSession(drawAll(session));
    else {
      let next = session;
      for (let i = 0; i <= activePotChoice.teamIds.length; i++) {
        if (next.pending) next = confirmPending(next);
        const id = activePotChoice.teamIds.find((teamId) => next.remaining.includes(teamId));
        if (!id) break;
        next = drawNext(next, id, activePotChoice.id);
        if (!next.pending?.options.length) break;
      }
      if (next.pending) next = confirmPending(next);
      setSession(next);
    }
    setPresentation((previous) => ({ ...previous, revealAt: 0, selection: null, sweep: null }));
    setScopeAction(null);
  };
  const resetCurrentPot = () => {
    if (!session || !activePotChoice) return;
    const ids = new Set(activePotChoice.teamIds);
    const removed = session.history.filter((entry) => ids.has(entry.teamId));
    setSession({ ...session, containers: session.containers.map((c) => ({ ...c, teamIds: c.teamIds.filter((id) => !removed.some((entry) => entry.teamId === id)) })), history: session.history.filter((entry) => !ids.has(entry.teamId)), log: session.log.filter((_, i) => !ids.has(session.history[i]?.teamId)), remaining: [...new Set([...session.remaining, ...removed.map((entry) => entry.teamId)])], pending: null, finished: false, activePotId: activePotChoice.id });
    setPresentation((previous) => ({ ...previous, revealAt: 0, selection: null, sweep: null }));
    setScopeAction(null);
  };
  const handleReset = () => {
    setShowResetConfirm(false);
    setScopeAction(null);
    setPresentation((previous) => ({ ...previous, revealAt: 0, selection: null, sweep: null }));
    startDraw();
  };

  const remainingPool = session
    ? session.mode === "pots"
      ? (activePotChoice?.teamIds || []).filter((id) => session.remaining.includes(id))
      : session.remaining
    : [];

  /* -------------------------------- opslaan ----------------------------- */

  const applyDraw = async () => {
    if (!session) return;
    setApplying(true);
    try {
      if (overwrite) {
        const groupIds = containers.map((c) => c.id);
        const { error: slotErr } = await supabase.from("slots").update({ team_id: null }).eq("phase_id", phaseId).not("team_id", "is", null);
        if (slotErr) throw slotErr;
        if (groupIds.length) await supabase.from("group_teams").delete().in("group_id", groupIds);
        if (isRounds) {
          await supabase.from("matches").delete().eq("tournament_id", tournamentId).eq("phase_id", phaseId);
        } else {
          await supabase.from("matches").update({ home_team_id: null, away_team_id: null, home_score: null, away_score: null, home_penalties: null, away_penalties: null, set_scores: null, is_played: false }).eq("tournament_id", tournamentId).eq("phase_id", phaseId);
        }
      }
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
      if (isRounds && automaticRounds) {
        for (const container of session.containers) {
          const members = (slotRows || []).filter((slot) => slot.group_id === container.id).map((slot) => ({
            slotCode: slot.slot_code,
            teamId: updates.find((update) => update.slotId === slot.id)?.teamId ?? slot.team_id,
          }));
          const pairings = generateRoundRobin(members.length, "custom", automaticRounds);
          if (!pairings.length) continue;
          const { error: deleteError } = await supabase.from("matches").delete().eq("tournament_id", tournamentId).eq("phase_id", phaseId).eq("group_id", container.id);
          if (deleteError) throw deleteError;
          const inserts = pairings.map((pairing) => ({
            tournament_id: tournamentId, phase_id: phaseId, group_id: container.id,
            home_team_id: members[pairing.homeIdx]?.teamId ?? null,
            away_team_id: members[pairing.awayIdx]?.teamId ?? null,
            home_slot_label: members[pairing.homeIdx]?.slotCode ?? null,
            away_slot_label: members[pairing.awayIdx]?.slotCode ?? null,
            round_number: pairing.round,
          }));
          const { error: insertError } = await supabase.from("matches").insert(inserts);
          if (insertError) throw insertError;
          const { error: groupError } = await supabase.from("groups").update({ manual_planning: false }).eq("tournament_id", tournamentId).eq("phase_id", phaseId).eq("id", container.id);
          if (groupError) throw groupError;
          drawnMatches += inserts.length;
        }
      } else if (isRounds) {
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
      localStorage.removeItem(draftKey);
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

  const validationError = (): { step: Step; message: string } | null => {
    if (containers.length === 0) return { step: "method", message: "Er zijn nog geen groepen in deze fase." };
    if (!usePots && teams.length !== totalCapacity) {
      return {
        step: "method",
        message: `${teams.length} beschikbare teams voor ${totalCapacity} vrije plaatsen. Het aantal moet exact overeenkomen.`,
      };
    }
    if (usePots) {
      if (pots.length === 0) return { step: "pots", message: "Kies eerst het aantal potten." };
      if (drawSize % pots.length !== 0 || pots.some((pot) => pot.teamIds.length !== drawSize / pots.length)) return { step: "pots", message: `Vul elke pot met precies ${drawSize / pots.length} teams.` };
      const allAssigned = pots.flatMap((pot) => pot.teamIds);
      const uniqueAssigned = new Set(allAssigned);
      if (allAssigned.length !== drawSize || uniqueAssigned.size !== drawSize)
        return { step: "pots", message: "Wijs ieder team precies één keer aan een pot toe." };
      const emptyPot = pots.find((pot) => pot.teamIds.length === 0);
      if (emptyPot) return { step: "pots", message: `${emptyPot.name} is nog leeg. Voeg teams toe of kies minder potten.` };
      for (const pot of pots) {
        const quotaTotal = containers.reduce((sum, container) => sum + quotaFor(pot.id, container.id), 0);
        if (quotaTotal !== pot.teamIds.length) {
          setAdvancedSpreadOpen(true);
          return {
            step: "settings",
            message: `Verdeling: ${pot.name} bevat ${pot.teamIds.length} teams, maar de verdeling over de groepen voorziet ${quotaTotal} plaatsen.`,
          };
        }
      }
      for (const container of containers) {
        const groupTotal = pots.reduce((sum, pot) => sum + quotaFor(pot.id, container.id), 0);
        if (groupTotal !== container.capacity) {
          setAdvancedSpreadOpen(true);
          return {
            step: "settings",
            message: `Verdeling: ${container.name} krijgt ${groupTotal} teams, maar heeft exact ${container.capacity} plaatsen.`,
          };
        }
      }
    }
    const ctx = buildContainerCtx(teams, pots, effectiveRules);
    const check = checkContainerFeasibility(drawTeamIds, containers, ctx);
    return check.ok ? null : { step: "settings", message: check.message || "De gekozen regels zijn niet haalbaar." };
  };

  const openDraw = () => {
    const error = validationError();
    if (error) {
      setStep(error.step);
      toast({ title: "Loting kan nog niet starten", description: error.message, variant: "destructive" });
      return;
    }
    startDraw();
  };

  const renderRules = () => (
    <div className="space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Landenlimiet per poule</h3>
      <div className="space-y-3 rounded-lg border border-border p-3">
        <div>
          <Label className="text-xs">Maximum aantal teams uit hetzelfde land</Label>
          <Select
            value={rules.countryMaxDefault == null ? "none" : String(rules.countryMaxDefault)}
            onValueChange={(value) => setRules((previous) => ({
              ...previous,
              separateSameCountry: false,
              countryMaxDefault: value === "none" ? null : Number(value),
              countryMax: value === "none" ? {} : previous.countryMax,
            }))}
          >
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Geen beperking</SelectItem>
              {Array.from({ length: maxGroupCapacity }, (_, index) => index + 1).map((number) => <SelectItem key={number} value={String(number)}>Max {number} per poule</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {rules.countryMaxDefault != null && exceptionalCountries.length > 0 && <div className="space-y-2">
          <div><Label className="text-xs">Uitzonderingen op de landenlimiet</Label><p className="text-xs text-muted-foreground">Alleen landen met meer teams dan poules. Ze worden optimaal gespreid: elke poule krijgt eerst één team van dat land en het verschil tussen poules is maximaal één.</p></div>
          {exceptionalCountries.map((country) => (
            <div key={country} className="flex items-center gap-2 rounded-md bg-muted/50 px-2 py-1.5 text-xs">
              <CountryFlag country={country} className="h-3 w-4" />
              <span className="flex-1">{country} · {countryCounts[country]} teams</span>
              {(() => {
                const minNeeded = Math.ceil(countryCounts[country] / Math.max(1, containers.length));
                const options = Array.from({ length: Math.max(0, maxGroupCapacity - minNeeded + 1) }, (_, index) => minNeeded + index);
                return (
                  <Select
                    value={rules.countryMax[country] != null ? String(rules.countryMax[country]) : undefined}
                    onValueChange={(value) => setRules((previous) => ({ ...previous, countryMax: { ...previous.countryMax, [country]: Number(value) } }))}
                  >
                    <SelectTrigger className="h-8 w-28"><SelectValue placeholder="Kies max" /></SelectTrigger>
                    <SelectContent>{options.map((number) => <SelectItem key={number} value={String(number)}>Max {number} per poule</SelectItem>)}</SelectContent>
                  </Select>
                );
              })()}
            </div>
          ))}
        </div>}
      </div>

      <h3 className="pt-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Teamregels</h3>
      <div className="space-y-3 rounded-lg border border-border p-3">
        <p className="text-sm font-medium">Kies twee teams die niet samen in één poule mogen komen.</p>
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
        <div className="flex flex-wrap gap-2"><Button
            variant="outline"
            size="sm"
            disabled={!pairA || !pairB}
            onClick={() => {
              setRules((previous) => ({ ...previous, forbiddenPairs: [...previous.forbiddenPairs, [pairA, pairB]] }));
              setPairA(""); setPairB("");
            }}
          >Niet samen in één poule</Button>
        </div>
        <div className="space-y-1">
          {rules.forbiddenPairs.map(([first, second], index) => (
            <div key={`forbidden-${index}`} className="flex items-center justify-between rounded-md bg-muted/50 px-2 py-1 text-xs">
              <span>Niet samen: {teamById.get(first)?.name} · {teamById.get(second)?.name}</span>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" aria-label="Regel verwijderen" onClick={() => setRules((previous) => ({ ...previous, forbiddenPairs: previous.forbiddenPairs.filter((_, itemIndex) => itemIndex !== index) }))}><Trash2 className="h-3 w-3" /></Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const sceneBusy = rolling || revealing;
  const drawContent = session && (
    <div ref={directorRef} className="draw-control-stage">
      <DrawShow session={session} spotlightId={spotlightId} presentation={{ ...presentation, tournamentName, tournamentLogo, theme: showOptions.theme, flagBackdrops: showOptions.flagBackdrops, language: navigator.language, speed: animationSpeed, activePotId: pending ? session.activePotId : activePotChoice?.id ?? null }} controls={<>
        <div className="draw-control-primary">
          {session.finished ? <Button onClick={applyDraw} disabled={applying} className="draw-scene-button"><Check />Indeling toepassen</Button>
            : <Button className="draw-scene-button" disabled={sceneBusy || (Boolean(pending) && !pending?.options.length)} onClick={() => pending ? drawGroup() : handleDrawNext()}><Shuffle />{pending ? "Loot groep" : "Trek team"}</Button>}
        </div>
        <aside className="draw-control-dock">
          <DrawFullscreenButton target={directorRef} />
          <Button className="draw-scene-button" variant="ghost" size="sm" aria-label="Ongedaan maken" title="Ongedaan maken" onClick={handleUndo} disabled={sceneBusy || Boolean(pending) || !session.history.length}><Undo2 /></Button>
          <Button className="draw-scene-button" variant="ghost" size="sm" aria-label="Alles loten" title="Alles loten" onClick={() => setScopeAction("complete")} disabled={sceneBusy || session.finished}><Sparkles /></Button>
          <Button className="draw-scene-button" variant="ghost" size="sm" aria-label="Opnieuw beginnen" title="Opnieuw beginnen" onClick={() => setScopeAction("reset")} disabled={sceneBusy}><RotateCcw /></Button>
          <Popover><PopoverTrigger asChild><Button className="draw-scene-button" variant="ghost" size="icon" aria-label="Instellingen" title="Instellingen" disabled={sceneBusy}><Settings2 /></Button></PopoverTrigger>
            <PopoverContent portalContainer={directorRef.current} className="draw-scene-settings space-y-4" side="top">
              <h2 className="font-semibold">Regie-instellingen</h2>
              <DrawShowOptions compact phaseId={phaseId} options={showOptions} onChange={setShowOptions} portalContainer={directorRef.current} />
              <div className="flex items-center justify-between gap-4"><Label htmlFor="automatic-placement">Automatisch toewijzen</Label><Switch id="automatic-placement" checked={placementMode === "automatic"} onCheckedChange={(checked) => setPlacementMode(checked ? "automatic" : "manual")} /></div>
              {session.mode === "pots" && <div><Label>Actieve pot</Label><Select value={activePotChoice?.id} onValueChange={setSelectedPotId} disabled={Boolean(pending)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent portalContainer={directorRef.current}>{pots.map((pot) => <SelectItem key={pot.id} value={pot.id} disabled={!pot.teamIds.some((id) => session.remaining.includes(id))}>{pot.name}</SelectItem>)}</SelectContent></Select></div>}
              {!pending && !session.finished && <div><Label>Handmatig kiezen</Label><Select value={manualTeam} onValueChange={handleDrawNext}><SelectTrigger><SelectValue placeholder="Selecteer team" /></SelectTrigger><SelectContent portalContainer={directorRef.current}>{remainingPool.map((id) => <SelectItem key={id} value={id}>{teamName(session, id)}</SelectItem>)}</SelectContent></Select></div>}
              {pending && <Button className="draw-scene-button w-full" variant="outline" onClick={handleRedraw}><RotateCcw />Opnieuw trekken</Button>}
              <Button className="draw-scene-button w-full" variant="outline" onClick={() => window.open(`/draw/${phaseId}`, "_blank", "noopener,noreferrer")}><ExternalLink />Beamerscherm</Button>
            </PopoverContent>
          </Popover>
        </aside>
      </>} />
      <DrawScopeConfirm action={scopeAction} onClose={() => setScopeAction(null)} container={directorRef.current} scope={activePotChoice ? "pot" : session.containers.length === 1 ? "groep" : undefined} onCurrent={() => scopeAction === "reset" ? activePotChoice ? resetCurrentPot() : handleReset() : handleDrawAll(true)} onAll={() => scopeAction === "reset" ? handleReset() : handleDrawAll()} />
    </div>
  );

  if (!open) return null;

  return (
    <>
      <section className="draw-surface draw-dialog-theme flex min-h-0 flex-1 bg-background p-4 text-foreground sm:p-6">
        <div className="mx-auto flex min-h-0 w-full max-w-7xl flex-1 flex-col gap-4">
          <header className="shrink-0 border-b border-primary/30 pb-3">
            <h1 className="text-lg font-semibold">Live loting{phaseName ? ` · ${phaseName}` : ""}</h1>
          </header>

          {loading && step !== "draw" ? (
            <div className="flex justify-center py-12"><div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>
          ) : step === "method" ? (
            <div className="min-h-0 space-y-5 overflow-y-auto pr-1">
              <div>
                <h2 className="text-lg font-bold">Kies je lotingsmethode</h2>
                <p className="text-xs text-muted-foreground">{drawSize} plaatsen · {containers.length} groepen{teams.length !== drawSize ? ` · ${teams.length} beschikbare teams` : ""}</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  { value: false, label: "Volledig willekeurige loting", title: "Verdeel alle teams volledig willekeurig", text: "De teams worden zonder voorafgaande indeling willekeurig over de beschikbare groepen verdeeld." },
                  { value: true, label: "Loting met potten", title: "Trek teams pot per pot", text: "Verdeel de teams vooraf over verschillende potten, bijvoorbeeld op basis van niveau, ranking of je eigen voorkeur. Tijdens de loting trek je vervolgens team per team uit de gekozen pot." },
                ].map((opt) => {
                  const selected = usePots === opt.value;
                  return (
                    <Button
                      key={opt.label}
                      type="button"
                      variant="outline"
                      aria-pressed={selected}
                      onClick={() => setUsePots(opt.value)}
                      className={`draw-choice relative h-auto min-h-36 w-full flex-col items-start justify-start gap-0 whitespace-normal p-5 text-left transition-all ${selected ? "border-y-2 border-y-primary bg-primary/[0.06]" : "border-y-border hover:border-y-primary/30"}`}
                    >
                      {selected && <Check className="absolute right-3 top-3 h-4 w-4 text-primary" />}
                      <p className="text-xs font-bold uppercase tracking-wide text-foreground">{opt.label}</p>
                      <p className="mt-2 text-sm font-semibold">{opt.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{opt.text}</p>
                    </Button>
                  );
                })}
              </div>
            </div>
          ) : step === "pots" ? (
            <div className="max-h-[70vh] space-y-5 overflow-y-auto pr-1">
              <div>
                <h2 className="text-lg font-bold">Potindeling</h2>
                <p className="text-xs text-muted-foreground">Maak je potten aan, verdeel de teams en stel indien nodig geavanceerde lotingsregels in.</p>
              </div>

               <div className="flex flex-wrap items-end gap-2">
                 <div className="min-w-[220px] flex-1 sm:max-w-sm">
                   <Label htmlFor="group-pot-distribution">Potverdeling · {drawSize} plaatsen in dit format</Label>
                   <Select value={potOptions.includes(pots.length) ? String(pots.length) : undefined} onValueChange={(value) => requestPotCount(Number(value))}>
                     <SelectTrigger id="group-pot-distribution" className="mt-1"><SelectValue placeholder="Kies een gelijke potverdeling" /></SelectTrigger>
                     <SelectContent>{potOptions.map((count) => <SelectItem key={count} value={String(count)}>{count} potten van {drawSize / count} teams</SelectItem>)}</SelectContent>
                   </Select>
                 </div>
               </div>

               {potOptions.includes(pots.length) && (
                 <>
                  <div className={`flex items-start gap-2 rounded-lg border p-3 text-xs ${potTeamTotal < drawSize ? "border-destructive/50 text-destructive" : "border-border text-muted-foreground"}`}>
                    {potTeamTotal < drawSize && <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
                     <span>{potTeamTotal} van {drawSize} plaatsen gevuld.</span>
                  </div>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                     {pots.map((pot) => {
                       const expected = drawSize / pots.length;
                      return (
                        <div key={pot.id} className="draw-panel space-y-2 p-3">
                          <div className="flex items-center gap-2">
                            <Input value={pot.name} onChange={(event) => renamePot(pot.id, event.target.value)} className="h-9 text-sm font-bold" aria-label="Potnaam" />
                            <span className={`whitespace-nowrap text-xs font-semibold ${pot.teamIds.length === expected ? "text-primary" : "text-muted-foreground"}`}>{pot.teamIds.length} / {expected} teams</span>
                          </div>
                           <PotTeamSlots teams={teams} teamIds={pot.teamIds} assignedIds={assignedTeamIds} capacity={expected} disabled={savingSlot} onChange={(index, teamId) => void setPotSlot(pot.id, index, teamId)} />
                        </div>
                      );
                    })}
                  </div>
                 </>
              )}

            </div>
          ) : step === "settings" ? (
            <div className="min-h-0 space-y-5 overflow-y-auto pr-1">
              <div>
                <h2 className="text-lg font-bold">Instellingen pouleloting</h2>
                <p className="text-xs text-muted-foreground">Stel de landenlimiet en teams in die niet samen in één poule mogen komen.</p>
              </div>
              {renderRules()}
              <DrawShowOptions phaseId={phaseId} options={showOptions} onChange={setShowOptions}>
                <div className="flex items-center justify-between gap-4"><Label htmlFor="prepare-automatic-placement">Automatisch toewijzen</Label><Switch id="prepare-automatic-placement" checked={placementMode === "automatic"} onCheckedChange={(checked) => setPlacementMode(checked ? "automatic" : "manual")} /></div>
              </DrawShowOptions>
               {usePots && potOptions.includes(pots.length) && (
                  <div className="space-y-5 border-t border-primary/30 pt-4">
                    <section className="space-y-2">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Verdeling van potten over groepen</h3>
                      <div className="draw-panel p-3">
                        <p className="text-sm font-medium">{Object.keys(rules.potQuota).length ? "Handmatige verdeling" : "Automatisch evenwichtig verdelen"}</p>
                        <p className="text-xs text-muted-foreground">Copa Mundo verdeelt de teams uit elke pot zo gelijk mogelijk over de groepen. Het verschil tussen groepen is maximaal één team; welke groepen een extra team krijgen, wordt willekeurig bepaald.</p>
                        <div className="mt-3 space-y-3">
                            <Button variant="ghost" size="sm" onClick={resetQuota}><RotateCcw className="h-3.5 w-3.5" /> Automatische verdeling herstellen</Button>
                            <div className="overflow-x-auto">
                              <table className="draw-table min-w-[520px] text-xs">
                                <thead><tr><th className="p-2 text-left">Pot</th>{containers.map((container) => <th key={container.id} className="p-2 text-center">{container.name}</th>)}</tr></thead>
                                <tbody>
                                  {pots.map((pot) => {
                                    const total = containers.reduce((sum, container) => sum + quotaFor(pot.id, container.id), 0);
                                    return <tr key={pot.id} className="border-t border-border"><td className="p-2 font-medium">{pot.name} <span className={total === pot.teamIds.length ? "text-muted-foreground" : "text-destructive"}>{total}/{pot.teamIds.length}</span></td>{containers.map((container) => <td key={container.id} className="p-1"><Input type="number" min={0} value={quotaFor(pot.id, container.id)} onChange={(event) => setQuota(pot.id, container.id, Number(event.target.value))} className="mx-auto h-8 w-16 text-center" /></td>)}</tr>;
                                  })}
                                  <tr className="border-t border-border">
                                    <td className="p-2 font-semibold">Totaal</td>
                                    {containers.map((container) => {
                                      const total = pots.reduce((sum, pot) => sum + quotaFor(pot.id, container.id), 0);
                                      return <td key={container.id} className={`p-2 text-center font-semibold ${total === container.capacity ? "text-muted-foreground" : "text-destructive"}`}>{total}/{container.capacity}</td>;
                                    })}
                                  </tr>
                                </tbody>
                              </table>
                            </div>
                        </div>
                      </div>
                    </section>


                 </div>
              )}
            </div>
          ) : drawContent}

          {step !== "draw" && (
            <footer className="flex shrink-0 flex-col-reverse gap-2 border-t border-primary/30 pt-4 sm:flex-row sm:items-center">
              {onRestart && <Button variant="ghost" className="sm:mr-auto" onClick={onRestart}><RotateCcw className="h-4 w-4" /> Opnieuw beginnen</Button>}
              <div className="flex flex-col-reverse gap-2 sm:ml-auto sm:flex-row">
              {step === "method" && <Button variant="outline" onClick={() => (onBack ? onBack() : onOpenChange(false))}><ArrowLeft className="h-4 w-4" /> Vorige</Button>}
              {step === "pots" && <Button variant="outline" onClick={() => setStep("method")}><ArrowLeft className="h-4 w-4" /> Vorige</Button>}
              {step === "settings" && <Button variant="outline" onClick={() => setStep(usePots ? "pots" : "method")}><ArrowLeft className="h-4 w-4" /> Vorige</Button>}
              {step === "method" && <Button onClick={() => setStep(usePots ? "pots" : "settings")}>Volgende</Button>}
              {step === "pots" && <Button onClick={() => {
                const error = validationError();
                if (error?.step === "pots") {
                  toast({ title: "Potindeling nog niet compleet", description: error.message, variant: "destructive" });
                  return;
                }
                setStep("settings");
              }}>Volgende</Button>}
              {step === "settings" && <Button onClick={openDraw}>Start loting</Button>}
              </div>
            </footer>
          )}
        </div>
      </section>

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
      <AlertDialog open={pendingPotCount !== null} onOpenChange={(open) => { if (!open) setPendingPotCount(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Potverdeling wijzigen?</AlertDialogTitle>
            <AlertDialogDescription>De huidige toewijzingen aan potten worden verwijderd. Je kunt de teams daarna opnieuw indelen.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => { const count = pendingPotCount; setPendingPotCount(null); if (count !== null) void createEmptyPots(count); }}>Verdeling wijzigen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default LiveDrawDialog;
