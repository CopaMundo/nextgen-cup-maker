import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import CountryFlag from "@/components/CountryFlag";
import { AlertTriangle, ArrowLeft, Check, ChevronDown, Pause, Play, Plus, Trash2, FastForward, RotateCcw } from "lucide-react";
import {
  buildSchedule,
  defaultOpponentMatrix,
  matchesPerTeam,
  validateMatrix,
  type SameCountryMode,
  type ScheduledMatch,
} from "@/lib/roundsSchedule";
import { emptyRoundsRules, shuffle } from "@/lib/liveDraw";
import { PotTeamSlots } from "@/components/draw/PotTeamSlots";
import { DrawShow } from "@/components/draw/DrawShow";
import { DrawFullscreenButton } from "@/components/draw/DrawFullscreenButton";
import { initRoundsState } from "@/lib/drawSession";
import { orderedTeamFixtures, opponentRevealDuration, roundsStage } from "@/lib/roundsDrawPresentation";
import { revealDuration, type DrawPicture } from "@/lib/drawPresentation";
import { ExternalLink, Settings2, Shuffle } from "lucide-react";

interface Team {
  id: string;
  name: string;
  country: string | null;
  logoUrl: string | null;
}
interface GroupInfo {
  id: string;
  name: string;
  teamIds: string[];
  slotByTeam: Record<string, string>;
  rounds: number;
  /** Potten die in deze groep voorkomen (volgorde = potindex). */
  pots: { id: string; name: string; teamIds: string[] }[];
  hasPlayed: boolean;
  freeSlots: number;
}
interface GroupDraw {
  groupId: string;
  matches: ScheduledMatch[];
  order: string[];
  warning?: string;
}

interface RoundsDrawDraft {
  version: 1;
  step: "method" | "pots" | "settings" | "draw";
  method: "free" | "pots";
  potGroups: Record<string, GroupInfo["pots"]>;
  matrices: Record<string, number[][]>;
  sameForAll: boolean;
  sameCountry: SameCountryMode;
  maxMeetings: number;
  forbiddenPairs: [string, string][];
  draws: GroupDraw[];
  activeGroupIdx: number;
  teamIdx: Record<string, number>;
  revealed: Record<string, number[]>;
  autoReveal?: boolean;
  revealAt?: number;
  revealTimes?: Record<string, Record<string, number>>;
  groupRounds?: Record<string, number>;
}

const REVEAL_MS = 1300;

const RoundsDrawDialog = ({
  open,
  onOpenChange,
  tournamentId,
  phaseId,
  categoryId,
  phaseName,
  defaultRounds,
  onApplied,
  overwrite = false,
  onBack,
  onRestart,
  onStepChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tournamentId: string;
  phaseId: string;
  categoryId?: string | null;
  phaseName?: string;
  defaultRounds: number;
  onApplied?: () => void;
  overwrite?: boolean;
  onBack?: () => void;
  onRestart?: () => void;
  onStepChange?: (step: string) => void;
}) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"method" | "pots" | "settings" | "draw">("method");
  const [method, setMethod] = useState<"free" | "pots">("free");
  const [teams, setTeams] = useState<Team[]>([]);
  const [groups, setGroups] = useState<GroupInfo[]>([]);
  const [roundInputs, setRoundInputs] = useState<Record<string, string>>({});
  const [potGroups, setPotGroups] = useState<Record<string, GroupInfo["pots"]>>({});
  const [potError, setPotError] = useState("");
  const [potGroupId, setPotGroupId] = useState("");
  const [sameForAll, setSameForAll] = useState(true);
  const [matrices, setMatrices] = useState<Record<string, number[][]>>({});
  const [editGroupId, setEditGroupId] = useState<string>("");
  const [sameCountry, setSameCountry] = useState<SameCountryMode>("allow");
  const [maxMeetings, setMaxMeetings] = useState(2);
  const [forbiddenPairs, setForbiddenPairs] = useState<[string, string][]>([]);
  const [pairA, setPairA] = useState("");
  const [pairB, setPairB] = useState("");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [checking, setChecking] = useState(false);
  const [applying, setApplying] = useState(false);

  // Live onthulling
  const [draws, setDraws] = useState<GroupDraw[]>([]);
  const [activeGroupIdx, setActiveGroupIdx] = useState(0);
  const [teamIdx, setTeamIdx] = useState<Record<string, number>>({});
  const [revealed, setRevealed] = useState<Record<string, number[]>>({});
  const [autoReveal, setAutoReveal] = useState(true);
  const [revealAt, setRevealAt] = useState(0);
  const [revealReady, setRevealReady] = useState(true);
  const [revealTimes, setRevealTimes] = useState<Record<string, Record<string, number>>>({});
  const directorRef = useRef<HTMLDivElement>(null);
  const syncQueue = useRef<Promise<unknown>>(Promise.resolve());
  const publishedHere = useRef(false);
  const syncFailed = useRef(false);
  const [paused, setPaused] = useState(false);
  const timer = useRef<number | null>(null);
  const [draftReady, setDraftReady] = useState(false);
  const draftKey = `copa-live-draw:rounds:v1:${phaseId}`;

  useEffect(() => { if (open) onStepChange?.(step); }, [open, step]);
  const teamById = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);

  const load = async () => {
    setLoading(true);
    try {
      const [{ data: groupRows }, { data: slotRows }, { data: teamRows }, { data: potRows }, { data: potTeamRows }, { data: matchRows }] =
        await Promise.all([
          supabase.from("groups").select("id, name, sort_order").eq("phase_id", phaseId).order("created_at").order("name"),
          supabase.from("slots").select("group_id, team_id, slot_code, sort_order").eq("phase_id", phaseId).order("sort_order"),
          supabase.from("teams").select("id, name, country, logo_url").eq("tournament_id", tournamentId),
          supabase.from("draw_pots").select("id, name, sort_order").eq("phase_id", phaseId).order("sort_order"),
          supabase.from("draw_pot_teams").select("pot_id, team_id, sort_order").eq("tournament_id", tournamentId).order("sort_order"),
          supabase.from("matches").select("group_id, round_number, is_played").eq("phase_id", phaseId),
        ]);
      setTeams((teamRows || []).map((t) => ({ id: t.id, name: t.name, country: t.country, logoUrl: t.logo_url })));
      const potIds = new Set((potRows || []).map((p) => p.id));
      const infos: GroupInfo[] = (groupRows || []).map((g) => {
        const groupSlots = (slotRows || []).filter((s) => s.group_id === g.id);
        const teamIds = groupSlots.filter((s) => s.team_id).map((s) => s.team_id as string);
        const slotByTeam: Record<string, string> = {};
        groupSlots.forEach((s) => s.team_id && (slotByTeam[s.team_id] = s.slot_code));
        const members = new Set(teamIds);
        let pots = (potRows || [])
          .map((p) => ({
            id: p.id,
            name: p.name,
            teamIds: (potTeamRows || []).filter((pt) => pt.pot_id === p.id && members.has(pt.team_id)).map((pt) => pt.team_id),
          }))
          .filter((p) => p.teamIds.length > 0);
        const inPot = new Set(pots.flatMap((p) => p.teamIds));
        if (pots.length === 0 || teamIds.some((id) => !inPot.has(id)) || !potIds.size) {
          pots = [{ id: "all", name: "Alle teams", teamIds }];
        }
        const groupMatches = (matchRows || []).filter((m) => m.group_id === g.id);
        const maxRound = Math.max(0, ...groupMatches.map((m) => m.round_number || 0));
        return {
          id: g.id,
          name: g.name,
          teamIds,
          slotByTeam,
          rounds: defaultRounds > 0 ? defaultRounds : maxRound || 1,
          pots,
          hasPlayed: groupMatches.some((m) => m.is_played),
          freeSlots: groupSlots.filter((s) => !s.team_id).length,
        };
      });
      setGroups(infos);
      setPotGroups(Object.fromEntries(infos.map((g) => [g.id, g.pots.length > 1 && g.pots.every((p) => p.teamIds.length === g.teamIds.length / g.pots.length) ? g.pots : []])));
      setPotGroupId(infos[0]?.id || "");
      setEditGroupId(infos[0]?.id || "");
      const initial: Record<string, number[][]> = {};
      infos.forEach((g) => {
        initial[g.id] = defaultOpponentMatrix(
          g.pots.map((p) => p.teamIds.length),
          matchesPerTeam(g.teamIds.length, g.rounds)
        );
      });
      setMatrices(initial);
      // Structuur gelijk voor alle groepen? Anders per groep instellen.
      const sig = (g: GroupInfo) => `${g.pots.length}|${g.pots.map((p) => p.teamIds.length).join(",")}|${matchesPerTeam(g.teamIds.length, g.rounds)}`;
      setSameForAll(infos.every((g) => sig(g) === sig(infos[0])));
      try {
        const raw = localStorage.getItem(draftKey);
        const draft = raw ? JSON.parse(raw) as RoundsDrawDraft : null;
        if (draft?.version === 1) {
          const validGroupIds = new Set(infos.map((group) => group.id));
          infos.forEach((group) => {
            const savedRounds = draft.groupRounds?.[group.id];
            if (savedRounds && Number.isInteger(savedRounds) && savedRounds > 0) group.rounds = savedRounds;
          });
          setGroups([...infos]);
          const teamIdsByGroup = new Map(infos.map((group) => [group.id, new Set(group.teamIds)]));
          const restoredPots = Object.fromEntries(Object.entries(draft.potGroups).filter(([groupId, groupPots]) => validGroupIds.has(groupId) && groupPots.every((pot) => pot.teamIds.every((id) => teamIdsByGroup.get(groupId)?.has(id)))));
          const drawsValid = draft.draws.every((draw) => validGroupIds.has(draw.groupId) && draw.order.every((id) => teamIdsByGroup.get(draw.groupId)?.has(id)));
          setStep(drawsValid ? draft.step : "method");
          setMethod(draft.method);
          setPotGroups(restoredPots);
          setMatrices(Object.fromEntries(Object.entries(draft.matrices).filter(([groupId]) => validGroupIds.has(groupId))));
          setSameForAll(draft.sameForAll);
          setSameCountry(draft.sameCountry);
          setMaxMeetings(draft.maxMeetings);
          setForbiddenPairs(draft.forbiddenPairs.filter(([a, b]) => infos.some((group) => group.teamIds.includes(a) && group.teamIds.includes(b))));
          setDraws(drawsValid ? draft.draws : []);
          setActiveGroupIdx(drawsValid ? Math.min(draft.activeGroupIdx, Math.max(0, draft.draws.length - 1)) : 0);
          setTeamIdx(drawsValid ? draft.teamIdx : {});
          setRevealed(drawsValid ? draft.revealed : {});
          setAutoReveal(draft.autoReveal ?? true);
          setRevealAt(draft.revealAt ?? 0);
          setRevealTimes(draft.revealTimes ?? {});
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
    setMethod("free");
    setPotError("");
    setRoundInputs({});
    setDraws([]);
    setTeamIdx({});
    setRevealed({});
    setRevealAt(0);
    setRevealTimes({});
    setActiveGroupIdx(0);
    setPaused(false);
    setForbiddenPairs([]);
    setSameCountry("allow");
    setMaxMeetings(2);
    load();
  }, [open, phaseId]);

  useEffect(() => {
    if (!open || !draftReady) return;
    const draft: RoundsDrawDraft = { version: 1, step, method, potGroups, matrices, sameForAll, sameCountry, maxMeetings, forbiddenPairs, draws, activeGroupIdx, teamIdx, revealed, autoReveal, revealAt, revealTimes, groupRounds: Object.fromEntries(groups.map((g) => [g.id, g.rounds])) };
    localStorage.setItem(draftKey, JSON.stringify(draft));
  }, [open, draftReady, draftKey, step, method, potGroups, matrices, sameForAll, sameCountry, maxMeetings, forbiddenPairs, draws, activeGroupIdx, teamIdx, revealed, autoReveal, revealAt, revealTimes, groups]);

  // Vrij loten negeert potten; pottenloting gebruikt de indeling die hier per groep is samengesteld.
  const drawGroups = useMemo(() => method === "pots" ? groups.map((g) => ({ ...g, pots: potGroups[g.id] || [] })) : groups.map((g) => ({
    ...g, pots: [{ id: "all", name: "Alle teams", teamIds: g.teamIds }],
  })), [groups, method, potGroups]);
  const canShare = useMemo(() => {
    if (drawGroups.length < 2) return false;
    const sig = (g: GroupInfo) => `${g.pots.length}|${g.pots.map((p) => p.teamIds.length).join(",")}|${matchesPerTeam(g.teamIds.length, g.rounds)}`;
    return drawGroups.every((g) => sig(g) === sig(drawGroups[0]));
  }, [drawGroups]);
  const potDrawAvailable = groups.length > 0 && groups.every((g) => g.teamIds.length >= 4 && g.teamIds.length % 2 === 0 && g.freeSlots === 0);

  const selectPotCount = (group: GroupInfo, count: number) => {
    if (potGroups[group.id]?.length === count) return;
    setPotGroups((prev) => ({ ...prev, [group.id]: Array.from({ length: count }, (_, i) => ({
      id: crypto.randomUUID(), name: `Pot ${i + 1}`, teamIds: [],
    })) }));
    setMatrices((prev) => ({ ...prev, [group.id]: defaultOpponentMatrix(Array(count).fill(group.teamIds.length / count), matchesPerTeam(group.teamIds.length, group.rounds)) }));
    setPotError("");
  };

  const setPotSlot = (groupId: string, potId: string, index: number, teamId: string | null) => {
    const group = groups.find((g) => g.id === groupId);
    const pots = potGroups[groupId] || [];
    const assigned = new Set(pots.flatMap((pot) => pot.teamIds));
    const previous = pots.find((pot) => pot.id === potId)?.teamIds[index];
    if (!group || !pots.length || (teamId && (!group.teamIds.includes(teamId) || (assigned.has(teamId) && teamId !== previous)))) return;
    setPotGroups((prev) => ({ ...prev, [groupId]: (prev[groupId] || []).map((pot) => {
      if (pot.id !== potId) return pot;
      const teamIds = [...pot.teamIds];
      if (teamId) teamIds[index] = teamId;
      else teamIds.splice(index, 1);
      return { ...pot, teamIds };
    }) }));
    setPotError("");
  };

  const checkPots = () => {
    for (const group of groups) {
      const pots = potGroups[group.id] || [];
      if (!pots.length) return `${group.name}: kies eerst een gelijkmatige potverdeling.`;
      const size = group.teamIds.length / pots.length;
      if (pots.some((p) => p.teamIds.length !== size)) return `${group.name}: vul elke pot met precies ${size} teams.`;
      const assigned = pots.flatMap((p) => p.teamIds);
      if (assigned.length !== group.teamIds.length || new Set(assigned).size !== group.teamIds.length || assigned.some((id) => !group.teamIds.includes(id))) return `${group.name}: wijs elk team precies één keer toe.`;
    }
    return "";
  };

  const proceedFromPots = () => {
    const error = checkPots();
    if (error) { setPotError(error); return; }
    nextToRules();
  };

  const nextToRules = () => {
    if (method === "pots" && !potDrawAvailable) return;
    const next: Record<string, number[][]> = {};
    drawGroups.forEach((g) => {
      next[g.id] = matrices[g.id]?.length === g.pots.length ? matrices[g.id] : defaultOpponentMatrix(g.pots.map((p) => p.teamIds.length), matchesPerTeam(g.teamIds.length, g.rounds));
    });
    setMatrices(next);
    setEditGroupId(drawGroups[0]?.id || "");
    setSameForAll(drawGroups.length > 1 && drawGroups.every((g) => `${g.pots.length}|${g.pots.map((p) => p.teamIds.length).join(",")}|${matchesPerTeam(g.teamIds.length, g.rounds)}` === `${drawGroups[0].pots.length}|${drawGroups[0].pots.map((p) => p.teamIds.length).join(",")}|${matchesPerTeam(drawGroups[0].teamIds.length, drawGroups[0].rounds)}`));
    setStep("settings");
  };

  const setCell = (groupId: string, i: number, j: number, value: number) => {
    setMatrices((prev) => {
      const targets = sameForAll && canShare ? drawGroups.map((g) => g.id) : [groupId];
      const next = { ...prev };
      for (const id of targets) {
        const m = (next[id] || []).map((row) => [...row]);
        if (!m[i]) continue;
        m[i][j] = Math.max(0, value);
        next[id] = m;
      }
      return next;
    });
  };

  const resetMatrix = (groupId: string) => {
    const targets = sameForAll && canShare ? drawGroups : drawGroups.filter((g) => g.id === groupId);
    setMatrices((prev) => {
      const next = { ...prev };
      targets.forEach((g) => {
        next[g.id] = defaultOpponentMatrix(g.pots.map((p) => p.teamIds.length), matchesPerTeam(g.teamIds.length, g.rounds));
      });
      return next;
    });
  };

  /* ------------------------ planning vooraf aanmaken ------------------------ */

  const updateRounds = (groupId: string, value: string) => {
    setRoundInputs((prev) => ({ ...prev, [groupId]: value }));
    const count = Number(value);
    if (!value || !Number.isInteger(count) || count < 1) return;
    const group = drawGroups.find((g) => g.id === groupId);
    if (!group) return;
    setGroups((prev) => prev.map((g) => g.id === groupId ? { ...g, rounds: count } : g));
    setMatrices((prev) => ({ ...prev, [groupId]: defaultOpponentMatrix(group.pots.map((p) => p.teamIds.length), matchesPerTeam(group.teamIds.length, count)) }));
    setDraws([]);
    setTeamIdx({});
    setRevealed({});
    setRevealTimes({});
  };

  const prepare = async () => {
    if (drawGroups.some((g) => roundInputs[g.id] !== undefined && (!roundInputs[g.id] || !Number.isInteger(Number(roundInputs[g.id])) || Number(roundInputs[g.id]) < 1))) {
      toast({ title: "Vul een geldig aantal speelrondes in", variant: "destructive" });
      return;
    }
    if (method === "pots") {
      const error = checkPots();
      if (error) { setPotError(error); setStep("pots"); return; }
    }
    for (const g of drawGroups) {
      if (g.freeSlots > 0) {
        toast({ title: `${g.name} is nog niet volledig`, description: "Deel eerst alle teams in de groepen in.", variant: "destructive" });
        return;
      }
      if (g.hasPlayed) {
        toast({ title: `${g.name} heeft al gespeelde wedstrijden`, description: "De speelrondes kunnen niet opnieuw geloot worden.", variant: "destructive" });
        return;
      }
      const err = validateMatrix(
        matrices[g.id] || [],
        g.pots.map((p) => p.teamIds.length),
        g.pots.map((p) => p.name),
        matchesPerTeam(g.teamIds.length, g.rounds),
        maxMeetings
      );
      if (err) {
        setEditGroupId(g.id);
        toast({ title: `${g.name}: verdeling niet mogelijk`, description: err, variant: "destructive" });
        return;
      }
    }
    setChecking(true);
    await new Promise((r) => setTimeout(r, 30));
    try {
      const result: GroupDraw[] = [];
      for (const g of drawGroups) {
        const potIndex = new Map<string, number>();
        g.pots.forEach((p, i) => p.teamIds.forEach((id) => potIndex.set(id, i)));
        const schedule = buildSchedule(
          g.teamIds.map((id) => ({ id, country: teamById.get(id)?.country, potIndex: potIndex.get(id) ?? 0 })),
          g.rounds,
          matrices[g.id],
          { sameCountry, forbiddenPairs, maxMeetings }
        );
        if (!schedule.ok) {
          setEditGroupId(g.id);
          toast({ title: `${g.name}: speelrondes niet aan te maken`, description: schedule.message, variant: "destructive" });
          return;
        }
        const order = g.pots.flatMap((p) => shuffle(p.teamIds));
        result.push({
          groupId: g.id,
          matches: schedule.matches,
          order,
          warning:
            sameCountry === "avoid" && schedule.sameCountryCount > 0
              ? `${schedule.sameCountryCount} affiche(s) tussen teams uit hetzelfde land waren onvermijdelijk.`
              : undefined,
        });
      }
      result.forEach((d) => {
        if (d.warning) toast({ title: drawGroups.find((g) => g.id === d.groupId)?.name, description: d.warning });
      });
      setDraws(result);
      setTeamIdx({});
      setRevealed({});
      setRevealAt(0);
      setRevealTimes({});
      setActiveGroupIdx(0);
      setStep("draw");
    } finally {
      setChecking(false);
    }
  };

  /* ------------------------------- onthulling ------------------------------- */

  const activeDraw = draws[activeGroupIdx];
  const activeGroup = drawGroups.find((g) => g.id === activeDraw?.groupId);
  const currentIdx = activeDraw ? teamIdx[activeDraw.groupId] ?? -1 : -1;
  const currentTeamId = activeDraw && currentIdx >= 0 ? activeDraw.order[currentIdx] : null;
  const revealedSet = new Set(activeDraw ? revealed[activeDraw.groupId] || [] : []);

  /** Wedstrijden van een team, gesorteerd op pot van de tegenstander. */
  const teamMatches = (draw: GroupDraw, group: GroupInfo, teamId: string) =>
    orderedTeamFixtures(draw.matches, teamId, group.pots, revealed[draw.groupId] || [], method === "pots");

  const queue = activeDraw && activeGroup && currentTeamId
    ? teamMatches(activeDraw, activeGroup, currentTeamId).map((item) => item.i).filter((index) => !revealedSet.has(index))
    : [];

  useEffect(() => {
    const wait = Math.max(0, revealAt + revealDuration(1) - Date.now());
    setRevealReady(wait === 0);
    const timeout = window.setTimeout(() => setRevealReady(true), wait);
    return () => window.clearTimeout(timeout);
  }, [revealAt]);

  const drawNextTeam = () => {
    if (!activeDraw || !activeGroup || queue.length || !revealReady) return;
    const next = currentIdx + 1;
    if (next >= activeDraw.order.length) return;
    setRevealAt(Date.now());
    setRevealReady(false);
    setPaused(false);
    setTeamIdx((prev) => ({ ...prev, [activeDraw.groupId]: next }));
  };

  const revealNextOpponent = () => {
    const head = queue[0];
    if (!activeDraw || head === undefined || !revealReady) return;
    const groupId = activeDraw.groupId;
    setRevealed((prev) => ({ ...prev, [groupId]: [...new Set([...(prev[groupId] || []), head])] }));
    setRevealTimes((prev) => ({ ...prev, [groupId]: { ...prev[groupId], [String(head)]: Date.now() } }));
    setRevealReady(false);
    window.setTimeout(() => setRevealReady(true), opponentRevealDuration);
  };

  useEffect(() => {
    if (!open || step !== "draw" || !queue.length || paused || !autoReveal || !revealReady) return;
    timer.current = window.setTimeout(revealNextOpponent, REVEAL_MS);
    return () => { if (timer.current) window.clearTimeout(timer.current); };
  }, [open, step, queue.join(","), paused, autoReveal, revealReady, activeDraw?.groupId]);

  const revealAll = () => {
    if (!activeDraw) return;
    setRevealed((prev) => ({ ...prev, [activeDraw.groupId]: activeDraw.matches.map((_, i) => i) }));
    setTeamIdx((prev) => ({ ...prev, [activeDraw.groupId]: activeDraw.order.length - 1 }));
  };

  const groupDone = (d: GroupDraw) => (teamIdx[d.groupId] ?? -1) >= d.order.length - 1 && (revealed[d.groupId] || []).length >= d.matches.length;
  const allDone = draws.length > 0 && draws.every(groupDone);

  /* --------------------------------- opslaan -------------------------------- */

  const apply = async () => {
    setApplying(true);
    try {
      if (overwrite) {
        const { error } = await supabase.from("matches").delete().eq("tournament_id", tournamentId).eq("phase_id", phaseId);
        if (error) throw error;
      }
      let total = 0;
      for (const d of draws) {
        const g = drawGroups.find((x) => x.id === d.groupId);
        if (!g) throw new Error("Poule niet gevonden");
        const { data: existing } = await supabase
          .from("matches")
          .select("id, round_number")
          .eq("tournament_id", tournamentId)
          .eq("phase_id", phaseId)
          .eq("group_id", g.id)
          .order("round_number")
          .order("created_at");
        const byRound = new Map<number, string[]>();
        (existing || []).forEach((m) => byRound.set(m.round_number || 0, [...(byRound.get(m.round_number || 0) || []), m.id]));
        const used = new Set<string>();
        const inserts: any[] = [];
        const updates: Promise<unknown>[] = [];
        for (const m of d.matches) {
          const row = {
            home_team_id: m.homeId,
            away_team_id: m.awayId,
            home_slot_label: g.slotByTeam[m.homeId] ?? null,
            away_slot_label: g.slotByTeam[m.awayId] ?? null,
            round_number: m.round,
          };
          const reuse = (byRound.get(m.round) || []).find((id) => !used.has(id));
          if (reuse) {
            used.add(reuse);
            updates.push(Promise.resolve(supabase.from("matches").update(row).eq("id", reuse)));
          } else {
            inserts.push({ tournament_id: tournamentId, phase_id: phaseId, group_id: g.id, ...row });
          }
        }
        await Promise.all(updates);
        const leftovers = (existing || []).map((m) => m.id).filter((id) => !used.has(id));
        if (leftovers.length) await supabase.from("matches").delete().in("id", leftovers);
        if (inserts.length) {
          const { error } = await supabase.from("matches").insert(inserts);
          if (error) throw error;
        }
        await supabase.from("groups").update({ manual_planning: false }).eq("id", g.id);
        total += d.matches.length;
      }
      await supabase.from("draw_reports").insert({
        tournament_id: tournamentId,
        phase_id: phaseId,
        report: {
          kind: "rounds",
          drawnAt: new Date().toISOString(),
          phaseName: phaseName || null,
          rules: { sameCountry, maxMeetings, forbiddenPairs },
          groups: draws.map((d) => {
             const g = drawGroups.find((x) => x.id === d.groupId);
              if (!g) throw new Error("Poule niet gevonden");
            return {
              group: g.name,
              pots: g.pots.map((p) => ({ name: p.name, teams: p.teamIds.map((id) => teamById.get(id)?.name || id) })),
              matrix: matrices[g.id],
              drawOrder: d.order.map((id) => teamById.get(id)?.name || id),
              matches: d.matches.map((m) => ({ round: m.round, home: teamById.get(m.homeId)?.name, away: teamById.get(m.awayId)?.name })),
            };
          }),
        } as unknown as never,
      });
      toast({ title: `${total} wedstrijden ingepland over de speelrondes` });
      localStorage.removeItem(draftKey);
      onApplied?.();
      onOpenChange(false);
    } catch (error: any) {
      toast({ title: "Opslaan mislukt", description: error?.message, variant: "destructive" });
    } finally {
      setApplying(false);
    }
  };

  /* ----------------------------------- UI ----------------------------------- */

  const TeamChip = ({ id, big }: { id: string; big?: boolean }) => {
    const t = teamById.get(id);
    return (
      <span className="inline-flex min-w-0 items-center gap-2">
        {t?.logoUrl && <img src={t.logoUrl} alt="" className={`${big ? "h-12 w-12" : "h-5 w-5"} shrink-0 object-contain`} />}
        <CountryFlag country={t?.country} className={big ? "h-5 w-7 shrink-0" : "h-3 w-4 shrink-0"} />
        <span className={`truncate ${big ? "text-2xl font-bold" : ""}`}>{t?.name || "?"}</span>
      </span>
    );
  };

  const editGroup = drawGroups.find((g) => g.id === editGroupId) || drawGroups[0];
  const matrixGroup = sameForAll && canShare ? drawGroups[0] : editGroup;

  const methodScreen = (
    <div className="space-y-5 overflow-y-auto pr-1">
      <div>
        <h3 className="text-lg font-bold">Kies je type loting</h3>
        <p className="text-sm text-muted-foreground">{phaseName || "Speelrondes"} · {groups.length} poules</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {([
          { id: "free" as const, label: "VRIJE SPEELRONDELOTING", description: "Elk team speelt het opgegeven aantal rondes tegen willekeurige tegenstanders." },
          { id: "pots" as const, label: "LOTING MET NIVEAU-POTTEN", description: "Teams worden via potten ingedeeld en het schema volgt een potmatrix." },
        ]).map((option) => {
          const disabled = option.id === "pots" && !potDrawAvailable;
          const selected = method === option.id;
          return <Button key={option.id} type="button" variant="outline" aria-pressed={selected} disabled={disabled}
            onClick={() => setMethod(option.id)}
            className={`draw-choice relative h-auto min-h-36 w-full flex-col items-start justify-start gap-2 whitespace-normal p-5 text-left ${selected ? "border-y-2 border-y-primary bg-primary/[0.06]" : "border-y-border hover:border-y-primary/30"}`}>
            <span className="flex w-full items-start justify-between gap-2 text-sm font-bold text-foreground">
              {option.label}{selected && <Check className="h-4 w-4 shrink-0 text-primary" />}
            </span>
            <span className="text-xs font-normal leading-relaxed text-muted-foreground">{option.description}</span>
          </Button>;
        })}
      </div>
      {!potDrawAvailable && <p className="flex items-start gap-2 text-sm text-warning"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> Loting met niveau-potten vereist minimaal 4 teams en een even aantal teams per poule. Vul ook alle plaatsen in.</p>}
    </div>
  );

  const potGroup = groups.find((g) => g.id === potGroupId) || groups[0];
  const groupPots = potGroup ? potGroups[potGroup.id] || [] : [];
  const assigned = new Set(groupPots.flatMap((p) => p.teamIds));
  const potOptions = potGroup ? Array.from({ length: Math.max(0, potGroup.teamIds.length - 1) }, (_, i) => i + 2)
    .filter((count) => count <= potGroup.teamIds.length && potGroup.teamIds.length % count === 0) : [];
  const settings = (
    <div className="min-h-0 space-y-5 overflow-y-auto pr-1">
      <div>
        <h3 className="text-lg font-semibold">Speelrondes loten</h3>
        <p className="text-sm text-muted-foreground">Bepaal hoeveel tegenstanders elk team uit iedere pot loot. De speelrondes worden vóór de loting volledig aangemaakt en gecontroleerd.</p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {drawGroups.map((g) => (
          <div key={g.id} className="draw-panel p-3 text-sm">
            <div className="font-semibold">{g.name}</div>
            <div className="text-muted-foreground">
              {g.teamIds.length} teams · {g.rounds} speelrondes · {matchesPerTeam(g.teamIds.length, g.rounds)} wedstrijden per team
            </div>
            <Label htmlFor={`draw-rounds-${g.id}`} className="mt-3 block">Aantal speelrondes</Label>
            <Input id={`draw-rounds-${g.id}`} type="number" min={1} step={1} className="mt-1 w-24" value={roundInputs[g.id] ?? String(g.rounds)} disabled={g.hasPlayed} onChange={(event) => updateRounds(g.id, event.target.value)} />
            {method === "pots" && <div className="text-xs text-muted-foreground">{g.pots.map((p) => `${p.name} (${p.teamIds.length})`).join(" · ")}</div>}
            {g.freeSlots > 0 && <div className="mt-1 text-xs text-destructive">Nog {g.freeSlots} lege plaatsen in deze groep.</div>}
            {g.hasPlayed && <div className="mt-1 text-xs text-destructive">Er zijn al wedstrijden gespeeld.</div>}
          </div>
        ))}
      </div>

      {drawGroups.length > 1 && (
        <RadioGroup value={sameForAll && canShare ? "same" : "per"} onValueChange={(v) => setSameForAll(v === "same")} className="flex flex-wrap gap-4">
          <label className={`flex items-center gap-2 text-sm ${!canShare ? "opacity-50" : ""}`}>
            <RadioGroupItem value="same" disabled={!canShare} /> Dezelfde instellingen voor alle groepen
          </label>
          <label className="flex items-center gap-2 text-sm">
            <RadioGroupItem value="per" /> Instellingen per groep aanpassen
          </label>
        </RadioGroup>
      )}

      {matrixGroup && (
        <div className="draw-panel p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="font-semibold">Verdeling van tegenstanders per pot</div>
              <p className="text-xs text-muted-foreground">Bepaal hoeveel keer een team uit elke pot tegen teams uit de andere potten speelt.</p>
            </div>
            <div className="flex items-center gap-2">
              {!(sameForAll && canShare) && groups.length > 1 && (
                <Select value={editGroup?.id} onValueChange={setEditGroupId}>
                  <SelectTrigger className="h-8 w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>{drawGroups.map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}</SelectContent>
                </Select>
              )}
              <Button size="sm" variant="outline" onClick={() => resetMatrix(matrixGroup.id)}>Standaard</Button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="draw-table text-sm">
              <thead>
                <tr>
                  <th className="px-2 py-1 text-left text-xs text-muted-foreground">Eigen pot</th>
                  {matrixGroup.pots.map((p) => <th key={p.id} className="px-2 py-1 text-xs text-muted-foreground">tegen {p.name}</th>)}
                  <th className="px-2 py-1 text-xs text-muted-foreground">Totaal</th>
                </tr>
              </thead>
              <tbody>
                {matrixGroup.pots.map((p, i) => {
                  const row = matrices[matrixGroup.id]?.[i] || [];
                  const sum = row.reduce((a, b) => a + b, 0);
                  const target = matchesPerTeam(matrixGroup.teamIds.length, matrixGroup.rounds);
                  return (
                    <tr key={p.id}>
                      <td className="px-2 py-1 font-medium">{p.name}</td>
                      {matrixGroup.pots.map((q, j) => (
                        <td key={q.id} className="px-2 py-1">
                          <Input
                            type="number"
                            min={0}
                            className="h-8 w-16 text-center"
                            value={row[j] ?? 0}
                            onChange={(e) => setCell(matrixGroup.id, i, j, e.target.value === "" ? 0 : Number(e.target.value))}
                          />
                        </td>
                      ))}
                      <td className={`px-2 py-1 text-center font-semibold ${sum !== target ? "text-destructive" : ""}`}>{sum}/{target}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {(() => {
            const target = matchesPerTeam(matrixGroup.teamIds.length, matrixGroup.rounds);
            const err = validateMatrix(matrices[matrixGroup.id] || [], matrixGroup.pots.map((p) => p.teamIds.length), matrixGroup.pots.map((p) => p.name), target, maxMeetings);
            return (
              <p className={`mt-3 text-xs ${err ? "text-destructive" : "text-primary"}`}>
                {err ?? `Klopt: elk team speelt exact ${target} wedstrijden over ${matrixGroup.rounds} speelrondes.`}
              </p>
            );
          })()}
        </div>
      )}

      <div className="draw-panel p-4 text-sm">
        <div className="font-semibold">Vaste kwaliteitsregels</div>
        <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs text-muted-foreground">
          <li>Evenwichtige thuis/uit-balans per pot: bij 2 ontmoetingen speelt elk team 1x thuis en 1x uit.</li>
          <li>Nooit meer dan 2 opeenvolgende thuis- of uitwedstrijden.</li>
        </ul>
      </div>

      <div className="draw-panel space-y-4 p-4">
          <div>
            <Label className="font-semibold">Teams uit hetzelfde land</Label>
            <RadioGroup value={sameCountry} onValueChange={(v) => setSameCountry(v as SameCountryMode)} className="mt-2 space-y-1">
              <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="allow" /> Altijd toestaan</label>
              <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="avoid" /> Zo lang mogelijk vermijden (voorkeur)</label>
              <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="never" /> Strikt verbieden</label>
            </RadioGroup>
          </div>
          <div className="flex items-center gap-3">
            <Label className="text-sm">Maximum aantal keer dat twee teams elkaar ontmoeten</Label>
            <Input type="number" min={1} className="h-8 w-16" value={maxMeetings} onChange={(e) => setMaxMeetings(Math.max(1, Number(e.target.value) || 1))} />
          </div>
          <div>
            <Label className="font-semibold">Geblokkeerde ontmoetingen</Label>
            <p className="text-xs text-muted-foreground">Deze teams worden nooit tegen elkaar geloot.</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Select value={pairA} onValueChange={setPairA}>
                <SelectTrigger className="h-8 w-44"><SelectValue placeholder="Team" /></SelectTrigger>
                 <SelectContent>{drawGroups.flatMap((g) => g.teamIds).map((id) => <SelectItem key={id} value={id}>{teamById.get(id)?.name}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={pairB} onValueChange={setPairB}>
                <SelectTrigger className="h-8 w-44"><SelectValue placeholder="Team" /></SelectTrigger>
                 <SelectContent>{drawGroups.flatMap((g) => g.teamIds).filter((id) => id !== pairA).map((id) => <SelectItem key={id} value={id}>{teamById.get(id)?.name}</SelectItem>)}</SelectContent>
              </Select>
              <Button size="sm" variant="outline" disabled={!pairA || !pairB} onClick={() => { setForbiddenPairs((p) => [...p, [pairA, pairB]]); setPairA(""); setPairB(""); }}>
                <Plus className="h-4 w-4" /> Toevoegen
              </Button>
            </div>
            <div className="mt-2 space-y-1">
              {forbiddenPairs.map(([a, b], i) => (
                <div key={i} className="flex items-center justify-between rounded-md border border-border px-2 py-1 text-sm">
                  <span className="flex items-center gap-2"><TeamChip id={a} /> tegen <TeamChip id={b} /></span>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setForbiddenPairs((p) => p.filter((_, k) => k !== i))}><Trash2 className="h-4 w-4" /></Button>
                </div>
              ))}
            </div>
          </div>
      </div>
    </div>
  );

  const potScreen = (
    <div className="min-h-0 space-y-4 overflow-y-auto pr-1">
      <div><h3 className="text-lg font-bold">Potindeling</h3><p className="text-sm text-muted-foreground">Verdeel de teams per poule gelijkmatig over de niveau-potten.</p></div>
      {groups.length > 1 && <div className="flex flex-wrap gap-2">{groups.map((g) => <Button key={g.id} size="sm" variant="outline" aria-pressed={potGroup?.id === g.id} className={`draw-choice ${potGroup?.id === g.id ? "border-y-2 border-y-primary bg-primary/[0.06]" : "border-y-border"}`} onClick={() => { setPotGroupId(g.id); setPotError(""); }}>{g.name} {potGroups[g.id]?.length ? `· ${potGroups[g.id].flatMap((p) => p.teamIds).length}/${g.teamIds.length}` : ""}</Button>)}</div>}
      {potGroup && <>
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[220px] flex-1 sm:max-w-sm"><Label>Potverdeling · {potGroup.teamIds.length} teams</Label>
            <Select value={groupPots.length ? String(groupPots.length) : undefined} onValueChange={(value) => selectPotCount(potGroup, Number(value))}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Kies een gelijke potverdeling" /></SelectTrigger>
              <SelectContent>{potOptions.map((count) => <SelectItem key={count} value={String(count)}>{count} potten van {potGroup.teamIds.length / count} teams</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        {groupPots.length > 0 && <>
          <p className="text-xs text-muted-foreground">{assigned.size}/{potGroup.teamIds.length} teams ingedeeld</p>
          <div className="grid gap-3 md:grid-cols-2">
            {groupPots.map((pot) => <div key={pot.id} className="draw-panel p-3">
              <div className="mb-3 flex items-center gap-2"><Input aria-label="Potnaam" value={pot.name} onChange={(e) => setPotGroups((prev) => ({ ...prev, [potGroup.id]: (prev[potGroup.id] || []).map((p) => p.id === pot.id ? { ...p, name: e.target.value } : p) }))} className="h-8 min-w-0 flex-1 font-semibold" /><span className={`shrink-0 text-sm font-bold ${pot.teamIds.length === potGroup.teamIds.length / groupPots.length ? "text-primary" : "text-muted-foreground"}`}>{pot.teamIds.length}/{potGroup.teamIds.length / groupPots.length}</span></div>
              <PotTeamSlots teams={potGroup.teamIds.map((id) => teamById.get(id)).filter((team): team is Team => Boolean(team))} teamIds={pot.teamIds} assignedIds={assigned} capacity={potGroup.teamIds.length / groupPots.length} onChange={(index, teamId) => setPotSlot(potGroup.id, pot.id, index, teamId)} />
            </div>)}
          </div>
        </>}
      </>}
      {potError && <p role="alert" className="flex items-center gap-2 text-sm text-destructive"><AlertTriangle className="h-4 w-4" />{potError}</p>}
    </div>
  );

  const picture = useMemo<DrawPicture | null>(() => {
    if (!activeDraw || !activeGroup) return null;
    const pots = activeGroup.pots.map((pot, index) => ({ ...pot, sortOrder: index }));
    const currentPot = currentTeamId ? pots.find((pot) => pot.teamIds.includes(currentTeamId)) : pots[0];
    const session = initRoundsState({
      phaseName: phaseName || "Speelrondes", mode: method === "pots" ? "pots" : "random",
      teams: teams.filter((team) => activeGroup.teamIds.includes(team.id)), pots,
      groups: [{ groupId: activeGroup.id, groupName: activeGroup.name, totalRounds: activeGroup.rounds, teamIds: activeGroup.teamIds }],
      rules: emptyRoundsRules(),
    });
    session.pots = pots;
    session.remaining = activeDraw.order.slice(currentIdx + 1);
    session.activePotId = currentPot?.id ?? null;
    session.pending = currentTeamId ? { teamId: currentTeamId, options: [] } : null;
    session.finished = groupDone(activeDraw);
    return { session, spotlightId: null, presentation: {
      revealAt, speed: 1, activePotId: currentPot?.id ?? null, selection: null,
      rounds: roundsStage({ groupName: activeGroup.name, order: activeDraw.order, currentIndex: currentIdx, matches: activeDraw.matches, pots, revealed: revealed[activeGroup.id] || [], revealTimes: revealTimes[activeGroup.id] || {}, usePots: method === "pots" }),
    } };
  }, [activeDraw, activeGroup, currentTeamId, currentIdx, teams, method, phaseName, revealed, revealTimes, revealAt]);

  useEffect(() => {
    if (!open || !draftReady || step !== "draw" || !picture) return;
    publishedHere.current = true;
    syncQueue.current = syncQueue.current.then(async () => {
      const { error } = await supabase.from("draw_sessions").upsert({ tournament_id: tournamentId, phase_id: phaseId, category_id: categoryId ?? null, status: "running", state: picture as unknown as never }, { onConflict: "phase_id" });
      if (error && !syncFailed.current) {
        syncFailed.current = true;
        toast({ title: "Beamerscherm niet bijgewerkt", description: "Controleer de verbinding en open de loting opnieuw.", variant: "destructive" });
      }
      if (!error) syncFailed.current = false;
    });
  }, [open, draftReady, step, picture, tournamentId, phaseId, categoryId]);

  useEffect(() => {
    if (open && step === "draw") return;
    if (!publishedHere.current) return;
    publishedHere.current = false;
    syncQueue.current = syncQueue.current.then(() => supabase.from("draw_sessions").update({ status: "closed" }).eq("phase_id", phaseId).eq("tournament_id", tournamentId));
  }, [open, step, phaseId, tournamentId]);

  const drawScreen = picture && activeDraw && activeGroup && (
    <div ref={directorRef} className="draw-control-stage">
      <DrawShow {...picture} controls={<>
        <div className="draw-control-primary">
          {queue.length ? <Button className="draw-scene-button" disabled={!revealReady || (autoReveal && !paused)} onClick={revealNextOpponent}><Play />Onthul wedstrijd</Button>
            : currentIdx + 1 < activeDraw.order.length ? <Button className="draw-scene-button" disabled={!revealReady} onClick={drawNextTeam}><Shuffle />Trek team</Button>
            : activeGroupIdx + 1 < draws.length ? <Button className="draw-scene-button" disabled={!revealReady} onClick={() => setActiveGroupIdx(activeGroupIdx + 1)}>Volgende groep</Button>
            : <Button className="draw-scene-button" disabled={!allDone || applying} onClick={apply}><Check />Wedstrijden opslaan</Button>}
        </div>
        <aside className="draw-control-dock">
          <DrawFullscreenButton target={directorRef} />
          <Button className="draw-scene-button" variant="ghost" aria-pressed={autoReveal} onClick={() => { setAutoReveal((value) => !value); setPaused(false); }}>{autoReveal ? <Play /> : <Pause />}{autoReveal ? "Achter elkaar" : "Per klik"}</Button>
          {autoReveal && queue.length > 0 && <Button className="draw-scene-button" variant="ghost" onClick={() => setPaused((value) => !value)}>{paused ? <Play /> : <Pause />}{paused ? "Verder" : "Pauze"}</Button>}
          <Button className="draw-scene-button" variant="ghost" disabled={!revealReady || groupDone(activeDraw)} onClick={revealAll}><FastForward />Alles tonen</Button>
          <Button className="draw-scene-button" variant="ghost" onClick={async () => { if (document.fullscreenElement === directorRef.current) await document.exitFullscreen(); setStep("settings"); }}><Settings2 />Instellingen</Button>
          <Button className="draw-scene-button" variant="ghost" aria-label="Beamerscherm" title="Beamerscherm" onClick={() => window.open(`/draw/${phaseId}`, "_blank", "noopener,noreferrer")}><ExternalLink /></Button>
        </aside>
      </>} />
    </div>
  );

  if (!open) return null;

  return (
    <section className="draw-surface draw-dialog-theme flex min-h-0 flex-1 bg-background p-4 text-foreground sm:p-6">
      <div className="mx-auto flex min-h-0 w-full max-w-7xl flex-1 flex-col gap-4">
        <header className="shrink-0 border-b border-primary/30 pb-3">
          <h1 className="text-lg font-semibold">Live loting speelrondes{phaseName ? ` · ${phaseName}` : ""}</h1>
        </header>
        {loading ? (
          <div className="py-10 text-center text-sm text-muted-foreground">Laden...</div>
         ) : step === "method" ? methodScreen : step === "pots" ? potScreen : step === "settings" ? settings : drawScreen}
        <footer className="flex shrink-0 flex-col-reverse gap-2 border-t border-primary/30 pt-4 sm:flex-row sm:items-center">
          {onRestart && <Button variant="ghost" className="sm:mr-auto" onClick={onRestart} disabled={applying}><RotateCcw className="h-4 w-4" /> Opnieuw beginnen</Button>}
          <div className="flex flex-col-reverse gap-2 sm:ml-auto sm:flex-row">
           {step === "method" ? (
             <><Button variant="outline" onClick={() => (onBack ? onBack() : onOpenChange(false))}><ArrowLeft className="h-4 w-4" /> Vorige</Button><Button onClick={() => method === "pots" ? setStep("pots") : nextToRules()} disabled={loading || groups.length === 0 || (method === "pots" && !potDrawAvailable)}>Volgende</Button></>
           ) : step === "pots" ? (
             <><Button variant="outline" onClick={() => setStep("method")}><ArrowLeft className="h-4 w-4" /> Vorige</Button><Button onClick={proceedFromPots}>Volgende</Button></>
           ) : step === "settings" ? (
            <>
               <Button variant="outline" onClick={() => setStep(method === "pots" ? "pots" : "method")}><ArrowLeft className="h-4 w-4" /> Vorige</Button>
              <Button onClick={prepare} disabled={checking || groups.length === 0}>
                {checking ? "Speelrondes aanmaken..." : "Volgende"}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setStep("settings")} disabled={applying}><ArrowLeft className="h-4 w-4" /> Vorige</Button>
              {allDone ? (
                <Button onClick={apply} disabled={applying}><Check className="h-4 w-4" /> {applying ? "Opslaan..." : "Wedstrijden opslaan"}</Button>
              ) : (
                <span className="flex items-center gap-1 text-xs text-muted-foreground"><AlertTriangle className="h-3.5 w-3.5" /> Onthul alle tegenstanders om de wedstrijden op te slaan.</span>
              )}
            </>
          )}
          </div>
        </footer>
      </div>
    </section>
  );
};

export default RoundsDrawDialog;
