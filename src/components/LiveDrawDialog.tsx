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
import { Trash2, Shuffle, Undo2, RotateCcw, Check, AlertTriangle, Sparkles, ChevronDown, ArrowLeft, ExternalLink, Settings2, SlidersHorizontal } from "lucide-react";
import { matchDrawContainers, matchPotCapacity, nextMatchPot } from "@/lib/matchDraw";
import { MatchDrawSetup } from "@/components/draw/MatchDrawSetup";
import { DrawWizardHeader } from "@/components/draw/DrawWizardHeader";
import { DrawChoice, DrawTypeChoices } from "@/components/draw/DrawTypeChoices";
import { TeamSelectList } from "@/components/draw/TeamSelectList";
import { completeLastDrawPot, defaultDrawPotCount, defaultDrawSeedCount, placeDrawSeed } from "@/lib/drawWizard";
import { generatePotMatchups } from "@/lib/drawEngine";
import { generateRoundRobin } from "@/lib/matchGenerator";
import {
  checkContainerFeasibility,
  buildContainerCtx,
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

type Step = "method" | "teams" | "pots" | "rules" | "settings" | "draw";

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
  matchContainers?: DrawContainer[];
  selectedMatchTeams?: string[];
  useSeeds?: boolean;
  seedCount?: number;
  pots?: Pot[];
}

const LiveDrawDialog = ({
  open,
  onOpenChange,
  tournamentId,
  phaseId,
  categoryId,
  phaseMatchType,
  fixtureKind,
  phaseName,
  onApplied,
  overwrite = false,
  onBack,
  onRestart,
  onStepChange,
  automaticRounds,
  initialMethod,
  initialStep = "method",
  hideHeader = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tournamentId: string;
  phaseId: string;
  categoryId?: string | null;
  phaseMatchType?: string;
  fixtureKind?: "knockout" | "single_match";
  phaseName?: string;
  onApplied?: () => void;
  overwrite?: boolean;
  onBack?: () => void;
  onRestart?: () => void;
  onStepChange?: (step: string) => void;
  automaticRounds?: number;
  initialMethod?: "random" | "pots";
  initialStep?: "method" | "teams";
  hideHeader?: boolean;
}) => {
  const isMatchDraw = Boolean(fixtureKind);
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
  const [selectedMatchTeams, setSelectedMatchTeams] = useState<string[]>([]);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const originalMatchContainers = useRef<DrawContainer[]>([]);
  const [usePots, setUsePots] = useState(false);
  const [useSeeds, setUseSeeds] = useState(false);
  const [seedCount, setSeedCount] = useState(2);
  const [potCount, setPotCount] = useState(4);
  const [rules, setRules] = useState<ContainerRules>(emptyContainerRules());
  const [potMatrix, setPotMatrix] = useState<Record<string, number>>({});

  const [session, setSession] = useState<DrawSessionState | null>(null);
  const [applying, setApplying] = useState(false);
  const [pairA, setPairA] = useState("");
  const [pairB, setPairB] = useState("");
  const [manualTeam, setManualTeam] = useState("");
  const [placementMode, setPlacementMode] = useState<"manual" | "automatic">("automatic");
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
  const fixedIds = useMemo(() => new Set(containers.flatMap(c => c.teamIds)), [containers]);
  const eligibleTeams = useMemo(() => teams.filter(t => !fixedIds.has(t.id) && (usePots || (!isMatchDraw && teams.length <= containers.reduce((sum, c) => sum + c.capacity - c.teamIds.length, 0)) || selectedMatchTeams.includes(t.id))), [teams, fixedIds, usePots, selectedMatchTeams, isMatchDraw, containers]);
  const unassignedTeams = useMemo(() => eligibleTeams.filter((t) => !assignedTeamIds.has(t.id)), [eligibleTeams, assignedTeamIds]);
  const participatingTeams = useMemo(() => {
    const ids = new Set(usePots ? pots.flatMap(p => p.teamIds) : [...fixedIds, ...eligibleTeams.map(t => t.id)]);
    return teams.filter(t => ids.has(t.id));
  }, [teams, pots, usePots, fixedIds, eligibleTeams]);
  const countryCounts = useMemo(() => participatingTeams.reduce<Record<string, number>>((counts, team) => {
    if (team.country) counts[team.country] = (counts[team.country] || 0) + 1;
    return counts;
  }, {}), [participatingTeams]);
  const exceptionalCountries = useMemo(() => Object.keys(countryCounts).sort().filter(country =>
    rules.countryMaxDefault != null && countryCounts[country] > rules.countryMaxDefault * containers.length
  ), [countryCounts, rules.countryMaxDefault, containers.length]);
  const maxGroupCapacity = Math.max(1, ...containers.map((container) => container.capacity));
  const totalCapacity = containers.reduce((sum, c) => sum + c.capacity - c.teamIds.length, 0);
  const potTeamTotal = pots.reduce((sum, p) => sum + p.teamIds.length, 0);
  /** Aantal te loten teams = capaciteit van het format, niet het aantal ingeschreven teams. */
  const drawSize = totalCapacity;
  useEffect(() => { if (open) onStepChange?.(step); }, [open, step]);

  /* ------------------------------- laden ------------------------------- */

  const loadAll = async () => {
    setLoading(true);
    try {
      const [{ data: groupRows }, { data: slotRows }, { data: teamRows }, { data: potRows }, { data: potTeamRows }, { data: fixtureRows, error: fixtureError }] =
        await Promise.all([
          supabase.from("groups").select("id, name, sort_order").eq("phase_id", phaseId).order("created_at").order("name"),
          supabase.from("slots").select("id, group_id, team_id, slot_code, sort_order").eq("phase_id", phaseId).order("sort_order"),
          supabase.from("teams").select("id, name, country, logo_url, category_id").eq("tournament_id", tournamentId).order("name"),
          supabase.from("draw_pots").select("id, name, sort_order").eq("phase_id", phaseId).order("sort_order"),
          supabase.from("draw_pot_teams").select("pot_id, team_id, sort_order").eq("tournament_id", tournamentId).order("sort_order"),
          supabase.from("matches").select("id, group_id, home_slot_label, away_slot_label, round_number, match_name").eq("tournament_id", tournamentId).eq("phase_id", phaseId).range(0, 999),
        ]);

      const freeByGroup = new Map<string, string[]>();
      for (const slot of slotRows || []) {
        if (!slot.group_id || (slot.team_id && !overwrite)) continue;
        freeByGroup.set(slot.group_id, [...(freeByGroup.get(slot.group_id) || []), slot.id]);
      }
      if (fixtureError) throw fixtureError;
      const nextContainers: DrawContainer[] = isMatchDraw ? matchDrawContainers(slotRows || [], fixtureRows || [], fixtureKind === "knockout") : (groupRows || []).map((g) => ({
        id: g.id,
        name: g.name,
        capacity: (freeByGroup.get(g.id) || []).length,
        slotIds: freeByGroup.get(g.id) || [],
        teamIds: [],
      }));
      setContainers(nextContainers);
      originalMatchContainers.current = nextContainers;
      const matchTeamIds = (teamRows || []).filter(t => !categoryId || t.category_id === categoryId).map(t => t.id);
      const originalFixed = nextContainers.flatMap(c => c.teamIds);
      const availableCapacity = nextContainers.reduce((sum, c) => sum + c.capacity, 0);
      setSeedCount(defaultDrawSeedCount(nextContainers.length * 2));
      setUsePots(initialMethod === "pots");

      const occupied = new Set(overwrite && !isMatchDraw ? [] : (slotRows || []).filter((s) => s.team_id).map((s) => s.team_id as string));
      const available = (teamRows || [])
        .filter((t) => (categoryId ? t.category_id === categoryId : true))
        .filter((t) => !occupied.has(t.id));
      setSelectedMatchTeams(isMatchDraw ? [...originalFixed, ...(matchTeamIds.length === availableCapacity ? matchTeamIds.filter(id => !originalFixed.includes(id)) : [])] : available.length === availableCapacity ? available.map(t => t.id) : []);
      setTeams((isMatchDraw ? (teamRows || []).filter(t => !categoryId || t.category_id === categoryId) : available).map((t) => ({ id: t.id, name: t.name, country: t.country, logoUrl: t.logo_url })));

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
          const validTeamIds = new Set(isMatchDraw ? matchTeamIds : available.map((team) => team.id));
          const validContainerIds = new Set(nextContainers.map((container) => container.id));
          const restoredPots = draft.pots?.map(p => ({ ...p, teamIds: p.teamIds.filter(id => validTeamIds.has(id)) })) ?? nextPots;
          setPots(restoredPots);
          const validPotIds = new Set(restoredPots.map(p => p.id));
          const geometryValid = !isMatchDraw || !draft.matchContainers || (draft.matchContainers.length === nextContainers.length && draft.matchContainers.every(c => nextContainers.some(next => next.id === c.id && next.slotIds.every((id, side) => id === c.slotIds[side]))));
          const sessionValid = geometryValid && (!draft.session || (
            draft.session.remaining.every((id) => validTeamIds.has(id)) &&
            draft.session.containers.every((container) => validContainerIds.has(container.id) && container.teamIds.every((id) => validTeamIds.has(id) || nextContainers.some(c => c.teamIds.includes(id))))
          ));
          setStep(sessionValid ? draft.step === "pots" ? "teams" : draft.step === "method" ? initialStep : draft.step : "method");
          setUsePots(initialMethod ? initialMethod === "pots" : draft.usePots);
          setPotCount(draft.potCount);
          setRules({ ...draft.rules, separateSameCountry: isMatchDraw ? Boolean(draft.rules.separateSameCountry) : false, requiredPairs: [] });
          setUseSeeds(Boolean(draft.useSeeds));
          setSeedCount(Math.max(2, Math.min(nextContainers.length, draft.seedCount ?? defaultDrawSeedCount(nextContainers.length * 2))));
          setPotMatrix(draft.potMatrix);
          const restoredSelection = draft.selectedMatchTeams?.filter(id => matchTeamIds.includes(id)) ?? [];
          if (draft.selectedMatchTeams) setSelectedMatchTeams([...new Set([...originalFixed, ...restoredSelection.filter(id => validTeamIds.has(id))])]);
          if (isMatchDraw && geometryValid && draft.matchContainers?.every(c => validContainerIds.has(c.id))) setContainers(nextContainers.map(c => {
            const saved = draft.matchContainers?.find(item => item.id === c.id);
            const matchSlots = (c.matchSlots ?? []).map((id, side) => id ?? (saved?.matchSlots?.[side] && matchTeamIds.includes(saved.matchSlots[side] as string) ? saved.matchSlots[side] : null));
            return { ...c, matchSlots, teamIds: matchSlots.filter((id): id is string => Boolean(id)), seedRanks: saved?.seedRanks ?? c.seedRanks };
          }));
          const recovered = sessionValid ? draft.session : null;
          setSession(recovered?.pending && draft.presentation?.selection ? confirmPending(recovered, draft.presentation.selection.targetId) : recovered);
          setPresentation({ revealAt: draft.presentation?.revealAt ?? 0, speed: draft.animationSpeed ?? 1, activePotId: draft.presentation?.activePotId ?? null, selection: null, sweep: null });
          setSelectedPotId(draft.selectedPotId && validPotIds.has(draft.selectedPotId) ? draft.selectedPotId : null);
          setAdvancedOpen(draft.advancedOpen);
          setAdvancedSpreadOpen(draft.advancedSpreadOpen);
          setPlacementMode(draft.placementMode ?? "automatic");
        } else {
          setRules(previous => ({ ...previous, countryMaxDefault: null, separateSameCountry: false, requiredPairs: [] }));
        }
      } catch {
        localStorage.removeItem(draftKey);
      }
    } catch (error: any) {
      toast({ title: "Loting laden mislukt", description: error?.message, variant: "destructive" });
    } finally {
      setDraftReady(true);
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    setDraftReady(false);
    setStep(initialStep);
    setAdvancedOpen(false);
    setAdvancedSpreadOpen(false);
    setSelectedPotId(null);
    setSession(null);
    setPlacementMode("automatic");
    setSpotlightId(null);
    setRules(emptyContainerRules());
    loadAll();
  }, [open, phaseId, categoryId]);

  useEffect(() => {
    if (!open || !draftReady) return;
    const draft: LiveDrawDraft = { version: 1, step, usePots, potCount, rules, potMatrix, session, selectedPotId, advancedOpen, advancedSpreadOpen, placementMode, animationSpeed, presentation, matchContainers: isMatchDraw ? containers : undefined, selectedMatchTeams, useSeeds, seedCount, pots };
    localStorage.setItem(draftKey, JSON.stringify(draft));
  }, [open, draftReady, draftKey, step, usePots, potCount, rules, potMatrix, session, selectedPotId, advancedOpen, advancedSpreadOpen, placementMode, animationSpeed, presentation, containers, selectedMatchTeams, useSeeds, seedCount, pots]);

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

  const renamePot = (potId: string, name: string) => {
    setPots(previous => previous.map(pot => pot.id === potId ? { ...pot, name } : pot));
  };

  const createEmptyPots = async (count: number) => {
    if (count < 2 || (!isMatchDraw && (drawSize % count !== 0 || count > drawSize))) return;
    setPots(Array.from({ length: count }, (_, index) => ({ id: crypto.randomUUID(), name: `Pot ${index + 1}`, sort_order: index, teamIds: [] })));
    setPotCount(count);
    setRules(previous => ({ ...previous, potQuota: {} }));
  };

   const potOptions = isMatchDraw ? [2] : Array.from({ length: drawSize }, (_, i) => i + 1)
     .filter((count) => count >= 2 && (count < drawSize || drawSize === 2) && drawSize % count === 0);
   const nextFromMethod = async () => {
     if (isMatchDraw) {
       if (usePots && pots.length !== 2) await createEmptyPots(2);
       setStep("teams");
       return;
     }
     if (usePots) {
       if (!potOptions.includes(pots.length)) {
         const count = isMatchDraw ? 2 : defaultDrawPotCount(drawSize, maxGroupCapacity);
         if (!count) { toast({ title: "Geen gelijke potverdeling mogelijk", description: "Kies een vrije loting voor dit aantal plaatsen.", variant: "destructive" }); return; }
         await createEmptyPots(count);
       }
      }
      setStep("teams");
   };
    useEffect(() => {
      if (!open || !draftReady || loading || step !== "teams" || !usePots || pots.length || !drawSize) return;
      const count = isMatchDraw ? 2 : defaultDrawPotCount(drawSize, maxGroupCapacity);
      if (count) void createEmptyPots(count);
    }, [open, draftReady, loading, step, usePots, pots.length, drawSize]);
   const changeRankedSeed = (rank: number, teamId: string | null, fixtureId?: string, side?: number) => {
     setContainers(previous => {
       const existing = previous.find(c => c.seedRanks?.includes(rank));
       const existingSide = existing?.seedRanks?.indexOf(rank) ?? -1;
       let next = existing && existingSide >= 0 ? placeDrawSeed(previous, existing.id, existingSide, null) : previous;
       if (!teamId) return next;
       const preferred = rank === 2 ? next[next.length - 1] : next[Math.min(next.length - 1, rank - 1)];
       const target = fixtureId ? next.find(c => c.id === fixtureId) : (existing ? next.find(c => c.id === existing.id) : preferred);
       const targetSide = side ?? (existingSide >= 0 ? existingSide : target?.matchSlots?.findIndex(id => !id) ?? -1);
       if (!target || targetSide < 0 || target.matchSlots?.[targetSide]) return previous;
       next = placeDrawSeed(next, target.id, targetSide, teamId);
       return next.map(c => c.id === target.id ? { ...c, seedRanks: (c.seedRanks ?? [null, null]).map((value, index) => index === targetSide ? rank : value) } : c);
     });
   };
   const selectMatchMethod = (method: "random" | "pots" | "seeds") => {
     setUsePots(method === "pots"); setUseSeeds(method === "seeds");
     if (method !== "seeds") setContainers(originalMatchContainers.current.map(c => ({ ...c, seedRanks: [null, null] })));
     else setContainers(previous => {
       let rank = 1;
       return previous.map(c => ({ ...c, seedRanks: (c.matchSlots ?? []).map(id => id ? rank++ : null) }));
     });
   };
   const changeSeedCount = (count: number) => {
     setSeedCount(count);
     setContainers(previous => previous.map(c => {
       const matchSlots = (c.matchSlots ?? []).map((id, side) => (c.seedRanks?.[side] ?? 0) > count && !originalMatchContainers.current.some(item => item.teamIds.includes(id ?? "")) ? null : id);
       return { ...c, matchSlots, teamIds: matchSlots.filter((id): id is string => Boolean(id)), seedRanks: (c.seedRanks ?? []).map(rank => rank && rank > count ? null : rank) };
     }));
   };
const requestPotCount = (count: number) => {
    if (count === pots.length) return;
    if (pots.some((pot) => pot.teamIds.length)) setPendingPotCount(count);
    else void createEmptyPots(count);
  };

  /* ------------------------------ verdeling ----------------------------- */

  const quotaBounds = (potId: string, containerId: string) => {
    const explicit = rules.potQuota[`${potId}|${containerId}`];
    if (explicit != null) return { min: explicit, max: explicit };
    const size = pots.find(p => p.id === potId)?.teamIds.length ?? 0;
    const count = Math.max(1, containers.length);
    return { min: Math.floor(size / count), max: Math.ceil(size / count) };
  };
  const setQuota = (potId: string, containerId: string, value: string) =>
    setRules(prev => {
      const potQuota = { ...prev.potQuota };
      if (value === "") delete potQuota[`${potId}|${containerId}`];
      else potQuota[`${potId}|${containerId}`] = Math.max(0, Number(value));
      return { ...prev, potQuota };
    });
  const resetQuota = () => setRules(prev => ({ ...prev, potQuota: {} }));

  const setPotSlot = (potId: string, index: number, teamId: string | null) => {
    const pot = pots.find(p => p.id === potId);
    if (!pot || index < 0 || index >= (isMatchDraw ? matchPotCapacity(containers, pots.indexOf(pot)) : drawSize / pots.length)) return;
    if (teamId && !eligibleTeams.some(team => team.id === teamId)) return;
    setPots(previous => {
      const updated = previous.map(p => {
        const teamIds = [...p.teamIds];
        const sourceIndex = teamId ? teamIds.indexOf(teamId) : -1;
        const replaced = pot.teamIds[index];
        if (p.id === potId) {
          if (sourceIndex >= 0 && sourceIndex !== index) {
            if (replaced) teamIds[sourceIndex] = replaced; else teamIds.splice(sourceIndex, 1);
          }
          if (teamId) teamIds[Math.min(index, teamIds.length)] = teamId; else teamIds.splice(index, 1);
        } else if (sourceIndex >= 0) {
          if (replaced) teamIds[sourceIndex] = replaced; else teamIds.splice(sourceIndex, 1);
        }
        return { ...p, teamIds };
      });
      return completeLastDrawPot(updated, eligibleTeams.map(team => team.id), updated.map((_, side) => isMatchDraw ? matchPotCapacity(containers, side) : drawSize / updated.length));
    });
  };

  /** Volledige regels met de standaardverdeling expliciet ingevuld. */
  const effectiveRules = useMemo<ContainerRules>(() => {
    const potQuota: Record<string, number> = {};
    const potQuotaMin: Record<string, number> = {};
    for (const pot of pots) for (const c of containers) {
      const key = `${pot.id}|${c.id}`;
      const bounds = quotaBounds(pot.id, c.id);
      potQuota[key] = isMatchDraw ? (c.matchSlots?.[pots.indexOf(pot)] ? 0 : 1) : bounds.max;
      potQuotaMin[key] = isMatchDraw ? potQuota[key] : bounds.min;
    }
    const countryMax = Object.fromEntries(exceptionalCountries.map(country => [country,
      rules.countryMax[country] ?? Math.ceil(countryCounts[country] / Math.max(1, containers.length))]));
    return { ...rules, countryMax, potQuota, potQuotaMin, onePerPot: usePots };
  }, [rules, pots, containers, usePots, isMatchDraw, exceptionalCountries, countryCounts]);

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

   const drawTeamIds = usePots ? pots.flatMap((p) => p.teamIds) : eligibleTeams.map((t) => t.id);

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
        fixtureKind,
        phaseName: phaseName || "Fase",
        mode: usePots ? "pots" : "random",
        teams: teams.filter(t => fixedIds.has(t.id) || drawTeamIds.includes(t.id)),
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
      ? (isMatchDraw ? nextMatchPot(session.containers, pots) : null) || pots.find((p) => !isMatchDraw && p.id === selectedPotId && p.teamIds.some((id) => session.remaining.includes(id))) ||
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
    if (step !== "draw" || (!isMatchDraw && placementMode !== "automatic") || !session?.pending?.options.length || rolling || revealing) return;
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
      if (usePots) {
        const { data: existing, error: readError } = await supabase.from("draw_pots").select("id").eq("tournament_id", tournamentId).eq("phase_id", phaseId);
        if (readError) throw readError;
        const existingIds = (existing ?? []).map(p => p.id);
        if (existingIds.length) {
          const { error } = await supabase.from("draw_pot_teams").delete().eq("tournament_id", tournamentId).in("pot_id", existingIds);
          if (error) throw error;
        }
        const { error: clearError } = await supabase.from("draw_pots").delete().eq("tournament_id", tournamentId).eq("phase_id", phaseId);
        if (clearError) throw clearError;
        const { error: potsError } = await supabase.from("draw_pots").insert(pots.map(p => ({ id: p.id, tournament_id: tournamentId, phase_id: phaseId, category_id: categoryId ?? null, name: p.name, sort_order: p.sort_order })));
        if (potsError) throw potsError;
        const { error: teamsError } = await supabase.from("draw_pot_teams").insert(pots.flatMap(p => p.teamIds.map((teamId, index) => ({ pot_id: p.id, tournament_id: tournamentId, team_id: teamId, sort_order: index }))));
        if (teamsError) throw teamsError;
      }
      if (isMatchDraw) {
        for (const container of session.containers) {
          for (const [index, teamId] of (container.matchSlots ?? []).entries()) {
            if (!teamId || originalMatchContainers.current.find(c => c.id === container.id)?.matchSlots?.[index] === teamId) continue;
            const slotId = container.slotIds[index];
            const { data: slot, error: readError } = await supabase.from("slots").select("slot_code, group_id").eq("tournament_id", tournamentId).eq("phase_id", phaseId).eq("id", slotId).single();
            if (readError) throw readError;
            const { error } = await supabase.from("slots").update({ team_id: teamId }).eq("tournament_id", tournamentId).eq("phase_id", phaseId).eq("id", slotId);
            if (error) throw error;
            for (const side of ["home", "away"] as const) {
              let update = supabase.from("matches").update(side === "home" ? { home_team_id: teamId } : { away_team_id: teamId }).eq("tournament_id", tournamentId).eq("phase_id", phaseId).eq(side === "home" ? "home_slot_label" : "away_slot_label", slot.slot_code);
              update = slot.group_id ? update.eq("group_id", slot.group_id) : update.is("group_id", null);
              const { error: matchError } = await update;
              if (matchError) throw matchError;
            }
          }
        }
        const { error: reportError } = await supabase.from("draw_reports").insert({ tournament_id: tournamentId, phase_id: phaseId, report: { drawnAt: new Date().toISOString(), mode: session.mode, fixtureKind, result: session.containers, log: session.log } as unknown as never });
        if (reportError) throw reportError;
        localStorage.removeItem(draftKey);
        onApplied?.();
        onOpenChange(false);
        toast({ title: "Wedstrijdloting toegepast" });
        return;
      }
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
      await onApplied?.();
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
    if (!isMatchDraw && !usePots && teams.length > drawSize && new Set(selectedMatchTeams).size !== drawSize) return { step: "teams", message: `Selecteer precies ${drawSize} teams.` };
    if (isMatchDraw && !usePots && (selectedMatchTeams.length !== containers.length * 2 || new Set(selectedMatchTeams).size !== selectedMatchTeams.length)) return { step: "teams", message: `Kies precies ${containers.length * 2} verschillende teams.` };
    const seedRanks = containers.flatMap(c => c.seedRanks ?? []).filter((rank): rank is number => rank != null);
    if (fixtureKind === "knockout" && useSeeds && !fixedIds.size) return { step: "teams", message: "Kies minstens één reekshoofd op een vaste wedstrijdplaats." };
    if (usePots && pots.some(p => p.teamIds.some(id => !eligibleTeams.some(t => t.id === id)))) return { step: "pots", message: "Een pot bevat een vast reekshoofd of een niet-geselecteerd team. Pas de potindeling aan." };
    if (useSeeds && seedRanks.length !== seedCount) return { step: "teams", message: `Wijs alle ${seedCount} reekshoofden toe.` };
     if (fixtureKind === "knockout" && useSeeds && (seedRanks.some(rank => !Number.isInteger(rank) || rank < 1 || rank > seedCount) || new Set(seedRanks).size !== seedRanks.length)) return { step: "teams", message: "Wijs ieder genummerd reekshoofd precies één keer toe." };
    if (!usePots && drawTeamIds.length !== totalCapacity) {
      return {
        step: "teams",
        message: `${eligibleTeams.length} beschikbare teams voor ${totalCapacity} vrije plaatsen. Het aantal moet exact overeenkomen.`,
      };
    }
    if (usePots) {
      if (pots.length === 0) return { step: "pots", message: "Kies eerst het aantal potten." };
      if ((isMatchDraw && pots.length !== 2) || (!isMatchDraw && drawSize % pots.length !== 0) || pots.some((pot, index) => pot.teamIds.length !== (isMatchDraw ? matchPotCapacity(containers, index) : drawSize / pots.length))) return { step: "pots", message: isMatchDraw ? `Vul Pot 1 met ${matchPotCapacity(containers, 0)} teams en Pot 2 met ${matchPotCapacity(containers, 1)} teams.` : `Vul elke pot met precies ${drawSize / pots.length} teams.` };
      const allAssigned = pots.flatMap((pot) => pot.teamIds);
      const uniqueAssigned = new Set(allAssigned);
      if (allAssigned.length !== drawSize || uniqueAssigned.size !== drawSize)
        return { step: "pots", message: "Wijs ieder team precies één keer aan een pot toe." };
      const emptyPot = pots.find((pot, index) => pot.teamIds.length === 0 && (!isMatchDraw || matchPotCapacity(containers, index) > 0));
      if (emptyPot) return { step: "pots", message: `${emptyPot.name} is nog leeg. Voeg teams toe of kies minder potten.` };
    }

    const ctx = buildContainerCtx(teams, pots, effectiveRules);
    const check = checkContainerFeasibility(drawTeamIds, containers, ctx);
    return check.ok ? null : { step: "rules", message: check.message || "De gekozen regels zijn niet haalbaar." };
  };

  const openDraw = () => {
    const error = validationError();
    if (error) {
      setStep(isMatchDraw && error.step === "pots" ? "teams" : error.step);
      toast({ title: "Loting kan nog niet starten", description: error.message, variant: "destructive" });
      return;
    }
    startDraw();
  };

  const renderRules = () => (
    <div className="space-y-3">
      <h3 className="draw-section-title">Landenlimiet per poule</h3>
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
          <div><Label className="text-xs">Uitzonderingen op de landenlimiet</Label><p className="text-xs text-muted-foreground">Deze landen passen niet binnen de algemene limiet. Het verschil tussen poules blijft maximaal één team.</p></div>
          {exceptionalCountries.map((country) => (
            <div key={country} className="flex items-center gap-2 rounded-md bg-muted/50 px-2 py-1.5 text-xs">
              <CountryFlag country={country} className="h-3 w-4" />
              <span className="flex-1">{country} · {countryCounts[country]} teams</span>
              {(() => {
                const minNeeded = Math.ceil(countryCounts[country] / Math.max(1, containers.length));
                const options = Array.from({ length: Math.max(0, maxGroupCapacity - minNeeded + 1) }, (_, index) => minNeeded + index);
                return (
                  <Select
                    value={String(rules.countryMax[country] ?? minNeeded)}
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

      <h3 className="pt-2 draw-section-title">Teamregels</h3>
      <div className="space-y-3 rounded-lg border border-border p-3">
        <p className="text-sm font-medium">Kies twee teams die niet samen in één poule mogen komen.</p>
        <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
          <Select value={pairA} onValueChange={setPairA}>
            <SelectTrigger><SelectValue placeholder="Team 1" /></SelectTrigger>
            <SelectContent>{participatingTeams.map((team) => <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={pairB} onValueChange={setPairB}>
            <SelectTrigger><SelectValue placeholder="Team 2" /></SelectTrigger>
            <SelectContent>{participatingTeams.filter((team) => team.id !== pairA).map((team) => <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>)}</SelectContent>
          </Select>
        <Button
            variant="outline"
            size="sm"
            disabled={!pairA || !pairB}
            onClick={() => {
              setRules((previous) => ({ ...previous, forbiddenPairs: [...previous.forbiddenPairs, [pairA, pairB]] }));
              setPairA(""); setPairB("");
            }}
          >Toevoegen</Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {rules.forbiddenPairs.map(([first, second], index) => (
            <div key={`forbidden-${index}`} className="inline-flex max-w-full items-center gap-2 rounded-md border border-border px-2 py-1 text-xs">
              <span>Niet samen: {teamById.get(first)?.name} · {teamById.get(second)?.name}</span>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" aria-label="Regel verwijderen" onClick={() => setRules((previous) => ({ ...previous, forbiddenPairs: previous.forbiddenPairs.filter((_, itemIndex) => itemIndex !== index) }))}><Trash2 className="h-3 w-3" /></Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderMatchRules = () => (
    <div className="space-y-3">
      <h3 className="draw-section-title">Lotingsregels</h3>
      <div className="draw-panel flex items-start justify-between gap-4 p-3">
        <div><Label htmlFor="country-protection" className="font-medium">Landbescherming</Label><p className="text-xs text-muted-foreground">Teams uit hetzelfde land worden niet tegen elkaar geloot.</p></div>
        <Switch id="country-protection" checked={rules.separateSameCountry} onCheckedChange={(checked) => setRules((previous) => ({ ...previous, separateSameCountry: checked }))} />
      </div>
      <div className="draw-panel space-y-3 p-3">
        <p className="text-sm font-medium">Verboden combinaties: kies twee teams die niet tegen elkaar mogen loten.</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <Select value={pairA} onValueChange={setPairA}><SelectTrigger><SelectValue placeholder="Team 1" /></SelectTrigger><SelectContent>{participatingTeams.map((team) => <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>)}</SelectContent></Select>
          <Select value={pairB} onValueChange={setPairB}><SelectTrigger><SelectValue placeholder="Team 2" /></SelectTrigger><SelectContent>{participatingTeams.filter((team) => team.id !== pairA).map((team) => <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>)}</SelectContent></Select>
        </div>
        <Button variant="outline" size="sm" disabled={!pairA || !pairB} onClick={() => { setRules((previous) => ({ ...previous, forbiddenPairs: [...previous.forbiddenPairs, [pairA, pairB]] })); setPairA(""); setPairB(""); }}>Niet tegen elkaar</Button>
        <div className="space-y-1">{rules.forbiddenPairs.map(([first, second], index) => <div key={`match-forbidden-${index}`} className="inline-flex max-w-full items-center gap-2 rounded-md border border-border px-2 py-1 text-xs"><span>Niet tegen elkaar: {teamById.get(first)?.name} · {teamById.get(second)?.name}</span><Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" aria-label="Regel verwijderen" onClick={() => setRules((previous) => ({ ...previous, forbiddenPairs: previous.forbiddenPairs.filter((_, itemIndex) => itemIndex !== index) }))}><Trash2 className="h-3 w-3" /></Button></div>)}</div>
      </div>
    </div>
  );

  const sceneBusy = rolling || revealing;
  const drawContent = session && (
    <div ref={directorRef} className="draw-control-stage">
      <DrawShow session={session} spotlightId={spotlightId} presentation={{ ...presentation, tournamentName, tournamentLogo, theme: showOptions.theme, flagBackdrops: showOptions.flagBackdrops, language: navigator.language, speed: animationSpeed, activePotId: pending ? session.activePotId : activePotChoice?.id ?? null }} controls={<>
        <div className="draw-control-primary">
          {session.finished ? <Button onClick={applyDraw} disabled={applying} className="draw-scene-button"><Check />Indeling toepassen</Button>
            : <Button className="draw-scene-button" disabled={sceneBusy || (Boolean(pending) && !pending?.options.length)} onClick={() => pending ? drawGroup() : handleDrawNext()}><Shuffle />{pending ? (isMatchDraw ? "Plaatsen" : "Loot groep") : "Trek team"}</Button>}
        </div>
        <aside className="draw-control-dock">
          <DrawFullscreenButton target={directorRef} />
          <Button className="draw-scene-button" variant="ghost" size="sm" aria-label="Ongedaan maken" title="Ongedaan maken" onClick={handleUndo} disabled={sceneBusy || Boolean(pending) || !session.history.length}><Undo2 /></Button>
          <Button className="draw-scene-button" variant="ghost" size="sm" aria-label="Alles loten" title="Alles loten" onClick={() => setScopeAction("complete")} disabled={sceneBusy || session.finished}><Sparkles /></Button>
          <Button className="draw-scene-button" variant="ghost" size="sm" aria-label="Opnieuw beginnen" title="Opnieuw beginnen" onClick={() => setScopeAction("reset")} disabled={sceneBusy}><RotateCcw /></Button>
          <Button className="draw-scene-button" variant="ghost" size="sm" onClick={() => setAdjustOpen(true)} disabled={sceneBusy || applying}><SlidersHorizontal />Loting aanpassen</Button>
          <Popover><PopoverTrigger asChild><Button className="draw-scene-button" variant="ghost" size="icon" aria-label="Instellingen" title="Instellingen" disabled={sceneBusy}><Settings2 /></Button></PopoverTrigger>
            <PopoverContent portalContainer={directorRef.current} className="draw-scene-settings space-y-4" side="top">
              <h2 className="font-semibold">Regie-instellingen</h2>
              <DrawShowOptions compact phaseId={phaseId} options={showOptions} onChange={setShowOptions} portalContainer={directorRef.current} />
              {!isMatchDraw && <div className="flex items-center justify-between gap-4"><Label htmlFor="automatic-placement">Automatisch toewijzen</Label><Switch id="automatic-placement" checked={placementMode === "automatic"} onCheckedChange={(checked) => setPlacementMode(checked ? "automatic" : "manual")} /></div>}
              {session.mode === "pots" && !isMatchDraw && <div><Label>Actieve pot</Label><Select value={activePotChoice?.id} onValueChange={setSelectedPotId} disabled={Boolean(pending)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent portalContainer={directorRef.current}>{pots.map((pot) => <SelectItem key={pot.id} value={pot.id} disabled={!pot.teamIds.some((id) => session.remaining.includes(id))}>{pot.name}</SelectItem>)}</SelectContent></Select></div>}
              {!pending && !session.finished && <div><Label>Handmatig kiezen</Label><Select value={manualTeam} onValueChange={handleDrawNext}><SelectTrigger><SelectValue placeholder="Selecteer team" /></SelectTrigger><SelectContent portalContainer={directorRef.current}>{remainingPool.map((id) => <SelectItem key={id} value={id}>{teamName(session, id)}</SelectItem>)}</SelectContent></Select></div>}
              {pending && <Button className="draw-scene-button w-full" variant="outline" onClick={handleRedraw}><RotateCcw />Opnieuw trekken</Button>}
              <Button className="draw-scene-button w-full" variant="outline" onClick={() => window.open(`/draw/${phaseId}`, "_blank", "noopener,noreferrer")}><ExternalLink />Beamerscherm</Button>
            </PopoverContent>
          </Popover>
        </aside>
      </>} />
      <AlertDialog open={adjustOpen} onOpenChange={setAdjustOpen}>
        <AlertDialogContent portalContainer={directorRef.current} className="draw-dialog-theme">
          <AlertDialogHeader><AlertDialogTitle>Loting aanpassen?</AlertDialogTitle><AlertDialogDescription>De huidige show wordt gewist en gereset. Je keert terug naar de wizard; je gekozen instellingen blijven behouden.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Annuleren</AlertDialogCancel><AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => { setAdjustOpen(false); setScopeAction(null); setSession(null); setPresentation((previous) => ({ ...previous, revealAt: 0, selection: null, sweep: null })); setStep("method"); }}>Show wissen en aanpassen</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <DrawScopeConfirm action={scopeAction} onClose={() => setScopeAction(null)} container={directorRef.current} scope={isMatchDraw ? undefined : activePotChoice ? "pot" : session.containers.length === 1 ? "groep" : undefined} onCurrent={() => scopeAction === "reset" ? activePotChoice ? resetCurrentPot() : handleReset() : handleDrawAll(true)} onAll={() => scopeAction === "reset" ? handleReset() : handleDrawAll()} />
    </div>
  );

  if (!open) return null;

  return (
    <>
      <section className="draw-surface draw-dialog-theme flex min-h-0 flex-1 bg-background p-4 text-foreground sm:p-6">
        <div className="mx-auto flex min-h-0 w-full max-w-7xl flex-1 flex-col gap-4">
          {!hideHeader && <DrawWizardHeader tournamentName={tournamentName} formatName={fixtureKind === "knockout" ? "Knockout" : fixtureKind === "single_match" ? "Enkele wedstrijd" : isRounds ? "Groepsfase met Speelrondes" : "Groepsfase"} step={step} onClose={() => onOpenChange(false)} />}

          {loading && step !== "draw" ? (
            <div className="flex justify-center py-12"><div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>
          ) : step === "method" ? (
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto pr-1">
              <h2 className="text-lg font-bold">Type loting</h2>
              <DrawTypeChoices format={fixtureKind ?? "group"} value={useSeeds ? "seeds" : usePots ? "pots" : "random"}
                seedsDisabled={containers.length < 2}
                onChange={method => { if (isMatchDraw) selectMatchMethod(method); else setUsePots(method === "pots"); }} />
            </div>
          ) : step === "teams" && !usePots ? (
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto"><h2 className="text-lg font-bold">Indeling &amp; teams</h2>{isMatchDraw ? <MatchDrawSetup teams={teams} selectedIds={selectedMatchTeams} onTeamsChange={setSelectedMatchTeams} containers={containers} originals={originalMatchContainers.current} useSeeds={useSeeds} seedCount={seedCount} onSeedCount={changeSeedCount} onSeed={changeRankedSeed} /> : (teams.length > drawSize ? <TeamSelectList teams={teams} selectedIds={selectedMatchTeams} capacity={drawSize} onChange={setSelectedMatchTeams} /> : <section className="space-y-2"><h3 className="draw-section-title">DEELNEMERS</h3><div className="flex flex-wrap items-center gap-3 text-sm"><p>Selecteer {drawSize} teams voor de loting</p><span className="font-semibold tabular-nums">{teams.length} / {drawSize}</span></div><ul className="draw-panel grid gap-2 p-3 sm:grid-cols-2 lg:grid-cols-3">{teams.map(team => <li key={team.id}><TeamChip id={team.id} /></li>)}</ul></section>)}{isMatchDraw && !useSeeds && teams.length <= containers.length * 2 && <PotTeamSlots teams={teams} teamIds={selectedMatchTeams} assignedIds={new Set(selectedMatchTeams)} capacity={containers.length * 2} disabled onChange={() => {}} />}</div>
          ) : step === "pots" || (step === "teams" && usePots) ? (
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto pr-1">
              <div>
                <h2 className="text-lg font-bold">Indeling &amp; teams</h2>
              </div>

                <div className="flex flex-wrap items-end gap-2">
                 <div className="min-w-[220px] flex-1 sm:max-w-sm">
                   <Label className="draw-section-title" htmlFor="group-pot-distribution">POTVERDELING</Label>
                   <Select value={potOptions.includes(pots.length) ? String(pots.length) : ""} onValueChange={(value) => requestPotCount(Number(value))}>
                     <SelectTrigger id="group-pot-distribution" className="mt-1"><SelectValue placeholder="Kies een gelijke potverdeling" /></SelectTrigger>
                     <SelectContent>{potOptions.map((count) => <SelectItem key={count} value={String(count)}>{isMatchDraw ? `Pot 1: ${matchPotCapacity(containers, 0)} · Pot 2: ${matchPotCapacity(containers, 1)}` : `${count} potten van ${drawSize / count} teams`}</SelectItem>)}</SelectContent>
                   </Select>
                 </div>
                 <span className="mb-3 shrink-0 text-sm font-semibold tabular-nums" aria-label="Teams in potten">{potTeamTotal} / {drawSize}</span>
               </div>

               {potOptions.includes(pots.length) && (
                 <>
                  <p className="text-xs text-muted-foreground">{potTeamTotal} van {drawSize} plaatsen gevuld.</p>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                     {pots.map((pot) => {
                       const expected = isMatchDraw ? matchPotCapacity(containers, pots.indexOf(pot)) : drawSize / pots.length;
                      return (
                        <div key={pot.id} className="draw-panel space-y-2 p-3">
                          <div className="flex items-center gap-2">
                            <Input value={pot.name} onChange={(event) => renamePot(pot.id, event.target.value)} className="h-9 text-sm font-bold" aria-label="Potnaam" />
                            <span className={`whitespace-nowrap text-xs font-semibold ${pot.teamIds.length === expected ? "text-primary" : "text-muted-foreground"}`}>{pot.teamIds.length} / {expected} teams</span>
                          </div>
                           <PotTeamSlots teams={eligibleTeams} teamIds={pot.teamIds} assignedIds={assignedTeamIds} capacity={expected} disabled={savingSlot} onChange={(index, teamId) => void setPotSlot(pot.id, index, teamId)} />
                        </div>
                      );
                    })}
                  </div>
                 </>
              )}

            </div>
          ) : step === "rules" ? (
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto"><h2 className="text-lg font-bold">Regels</h2>{isMatchDraw ? renderMatchRules() : renderRules()}{!isMatchDraw && usePots && potOptions.includes(pots.length) && (
                  <div className="space-y-5 pt-4">
                    <section className="space-y-2">
                      <h3 className="draw-section-title">Verdeling van potten over groepen</h3>
                      <div className="draw-panel p-3">
                        <p className="text-xs text-muted-foreground">Teams uit elke pot worden gelijkmatig over de groepen verdeeld. Waar nodig wijst de loting het resterende team toe.</p>
                         <div className="mt-3 space-y-2">{pots.map(pot => <div key={pot.id} className="flex flex-wrap items-center justify-between gap-2 text-sm"><span className="font-semibold">{pot.name}</span><span>Maximaal <strong>{Math.ceil(pot.teamIds.length / Math.max(1, containers.length))}</strong> team(s) per poule</span></div>)}</div>
                         <Collapsible open={advancedSpreadOpen} onOpenChange={setAdvancedSpreadOpen} className="mt-3">
                           <CollapsibleTrigger asChild><Button variant="outline" size="sm" className="h-auto whitespace-normal text-left"><ChevronDown className={`h-4 w-4 shrink-0 ${advancedSpreadOpen ? "rotate-180" : ""}`} />Geavanceerde groepsverdeling aanpassen</Button></CollapsibleTrigger>
                           <CollapsibleContent className="mt-3 space-y-3">
                            <Button variant="ghost" size="sm" onClick={resetQuota}><RotateCcw className="h-3.5 w-3.5" /> Automatische verdeling herstellen</Button>
                            <div className="overflow-x-auto">
                              <table className="draw-table min-w-[520px] text-xs">
                                <thead><tr><th className="p-2 text-left">Pot</th>{containers.map((container) => <th key={container.id} className="p-2 text-center">{container.name}</th>)}</tr></thead>
                                <tbody>
                                  {pots.map((pot) => {
                                    return <tr key={pot.id} className="border-t border-border"><td className="p-2 font-medium">{pot.name} <span className="text-muted-foreground">· {pot.teamIds.length} teams</span></td>{containers.map(container => {
                                      const bounds = quotaBounds(pot.id, container.id);
                                      return <td key={container.id} className="p-1"><Input aria-label={`${pot.name} · ${container.name}`} type="number" min={0} placeholder={bounds.min === bounds.max ? String(bounds.min) : `${bounds.min} - ${bounds.max}`} value={rules.potQuota[`${pot.id}|${container.id}`] ?? ""} onChange={event => setQuota(pot.id, container.id, event.target.value)} className="mx-auto h-8 w-20 text-center" /></td>;
                                    })}</tr>;
                                  })}
                                  <tr className="border-t border-border"><td className="p-2 font-semibold">Plaatsen</td>{containers.map(container => <td key={container.id} className="p-2 text-center font-semibold">{container.capacity}</td>)}</tr>
                                </tbody>
                              </table>
                             </div>
                           </CollapsibleContent>
                         </Collapsible>
                      </div>
                    </section>


                 </div>
              )}</div>
          ) : step === "settings" ? (
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto pr-1">
              <div>
                <h2 className="text-lg font-bold">Instellingen Live loting</h2>
              </div>
              <DrawShowOptions phaseId={phaseId} options={showOptions} onChange={setShowOptions}>
                {!isMatchDraw && <div className="space-y-2"><Label className="draw-section-title">Groepstoewijzing</Label><div className="grid gap-3 sm:grid-cols-2"><DrawChoice label="Automatisch toewijzen" description="Na de loting van het team wordt deze direct toegewezen aan de eerstvolgende beschikbare poule." selected={placementMode === "automatic"} onClick={() => setPlacementMode("automatic")} /><DrawChoice label="Groep loten" description="Na het loten van het team volgt een aparte loting om de poule te bepalen." selected={placementMode === "manual"} onClick={() => setPlacementMode("manual")} /></div></div>}
              </DrawShowOptions>
               
            </div>
          ) : drawContent}

          {step !== "draw" && (
            <footer className="flex shrink-0 flex-col-reverse gap-2 border-t border-primary/30 pt-4 sm:flex-row sm:items-center">
              <div className="ml-auto flex gap-2">
                <Button variant="outline" disabled={loading || savingSlot || step === "method"} onClick={() => {
                  if (step === "teams" || step === "pots") { if (onBack && isRounds) onBack(); else setStep("method"); }
                  else setStep(step === "settings" ? "rules" : "teams");
                }}><ArrowLeft className="h-4 w-4" />Vorige</Button>
                <Button disabled={loading || savingSlot} onClick={() => {
                  if (step === "method") { void nextFromMethod(); return; }
                  if (step === "settings") { openDraw(); return; }
                  const error = validationError();
                  if (error && (step === "rules" || (error.step !== "rules" && error.step !== "settings"))) {
                    toast({ title: "Loting nog niet compleet", description: error.message, variant: "destructive" }); return;
                  }
                  setStep(step === "rules" ? "settings" : "rules");
                }}>{step === "settings" ? "Start loting show" : "Volgende"}</Button>
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
