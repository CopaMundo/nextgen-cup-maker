import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import CountryFlag from "@/components/CountryFlag";
import { AlertTriangle, ArrowLeft, Check, ChevronDown, Pause, Play, Plus, Trash2, FastForward } from "lucide-react";
import {
  buildSchedule,
  defaultOpponentMatrix,
  matchesPerTeam,
  validateMatrix,
  type SameCountryMode,
  type ScheduledMatch,
} from "@/lib/roundsSchedule";
import { shuffle } from "@/lib/liveDraw";
import { DndContext, PointerSensor, TouchSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";

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

const REVEAL_MS = 1300;

const DraggableTeam = ({ id, children }: { id: string; children: React.ReactNode }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id });
  return <div ref={setNodeRef} style={{ transform: CSS.Translate.toString(transform) }} className={`flex min-w-0 items-center gap-2 border border-border bg-background px-2 py-2 text-sm ${isDragging ? "relative z-50 opacity-70" : ""}`}>
    <span {...attributes} {...listeners} aria-label="Team verplaatsen" className="cursor-grab touch-none text-muted-foreground"><GripVertical className="h-4 w-4" /></span>{children}
  </div>;
};

const PotZone = ({ id, children }: { id: string; children: React.ReactNode }) => {
  const { setNodeRef, isOver } = useDroppable({ id });
  return <div ref={setNodeRef} className={`min-h-16 space-y-1 p-1 ${isOver ? "bg-primary/10 ring-2 ring-primary/30" : ""}`}>{children}</div>;
};

const RoundsDrawDialog = ({
  open,
  onOpenChange,
  tournamentId,
  phaseId,
  categoryId,
  phaseName,
  defaultRounds,
  onApplied,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tournamentId: string;
  phaseId: string;
  categoryId?: string | null;
  phaseName?: string;
  defaultRounds: number;
  onApplied?: () => void;
}) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"method" | "pots" | "settings" | "draw">("method");
  const [method, setMethod] = useState<"free" | "pots">("free");
  const [teams, setTeams] = useState<Team[]>([]);
  const [groups, setGroups] = useState<GroupInfo[]>([]);
  const [potGroups, setPotGroups] = useState<Record<string, GroupInfo["pots"]>>({});
  const [potError, setPotError] = useState("");
  const [potGroupId, setPotGroupId] = useState("");
  const potSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }));
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
  const [queue, setQueue] = useState<number[]>([]);
  const [paused, setPaused] = useState(false);
  const timer = useRef<number | null>(null);

  const teamById = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);

  const load = async () => {
    setLoading(true);
    try {
      const [{ data: groupRows }, { data: slotRows }, { data: teamRows }, { data: potRows }, { data: potTeamRows }, { data: matchRows }] =
        await Promise.all([
          supabase.from("groups").select("id, name, sort_order").eq("phase_id", phaseId).order("sort_order"),
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
          rounds: maxRound || defaultRounds,
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
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    setStep("method");
    setMethod("free");
    setPotError("");
    setDraws([]);
    setTeamIdx({});
    setRevealed({});
    setQueue([]);
    setActiveGroupIdx(0);
    setPaused(false);
    setForbiddenPairs([]);
    setSameCountry("allow");
    setMaxMeetings(2);
    load();
  }, [open, phaseId]);

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
    setPotGroups((prev) => ({ ...prev, [group.id]: Array.from({ length: count }, (_, i) => ({
      id: crypto.randomUUID(), name: `Pot ${i + 1}`, teamIds: [],
    })) }));
    setPotError("");
  };

  const movePotTeam = (groupId: string, teamId: string, targetId: string) => {
    const group = groups.find((g) => g.id === groupId);
    const pots = potGroups[groupId] || [];
    if (!group?.teamIds.includes(teamId) || (targetId !== "unassigned" && !pots.some((p) => p.id === targetId))) return;
    if (targetId !== "unassigned" && pots.find((p) => p.id === targetId)?.teamIds.length === group.teamIds.length / pots.length && !pots.find((p) => p.id === targetId)?.teamIds.includes(teamId)) {
      setPotError("Deze pot is al gevuld. Kies een andere pot.");
      return;
    }
    setPotGroups((prev) => ({ ...prev, [groupId]: pots.map((p) => ({ ...p, teamIds: p.id === targetId ? [...new Set([...p.teamIds, teamId])] : p.teamIds.filter((id) => id !== teamId) })) }));
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
      next[g.id] = defaultOpponentMatrix(g.pots.map((p) => p.teamIds.length), matchesPerTeam(g.teamIds.length, g.rounds));
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

  const prepare = async () => {
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
      setQueue([]);
      setActiveGroupIdx(0);
      setStep("draw");
    } finally {
      setChecking(false);
    }
  };

  /* ------------------------------- onthulling ------------------------------- */

  const activeDraw = draws[activeGroupIdx];
  const activeGroup = drawGroups.find((g) => g.id === activeDraw?.groupId);
  const potOf = (group: GroupInfo | undefined, teamId: string) => group?.pots.findIndex((p) => p.teamIds.includes(teamId)) ?? 0;
  const currentIdx = activeDraw ? teamIdx[activeDraw.groupId] ?? -1 : -1;
  const currentTeamId = activeDraw && currentIdx >= 0 ? activeDraw.order[currentIdx] : null;
  const revealedSet = new Set(activeDraw ? revealed[activeDraw.groupId] || [] : []);

  /** Wedstrijden van een team, gesorteerd op pot van de tegenstander. */
  const teamMatches = (draw: GroupDraw, group: GroupInfo, teamId: string) =>
    draw.matches
      .map((m, i) => ({ m, i, opp: m.homeId === teamId ? m.awayId : m.homeId }))
      .filter(({ m }) => m.homeId === teamId || m.awayId === teamId)
      .sort((a, b) => potOf(group, a.opp) - potOf(group, b.opp) || a.m.round - b.m.round);

  const drawNextTeam = () => {
    if (!activeDraw || !activeGroup || queue.length) return;
    const next = currentIdx + 1;
    if (next >= activeDraw.order.length) return;
    const teamId = activeDraw.order[next];
    setTeamIdx((prev) => ({ ...prev, [activeDraw.groupId]: next }));
    const pendingIdx = teamMatches(activeDraw, activeGroup, teamId)
      .map((x) => x.i)
      .filter((i) => !revealedSet.has(i));
    setQueue(pendingIdx);
  };

  useEffect(() => {
    if (!queue.length || paused || !activeDraw) return;
    timer.current = window.setTimeout(() => {
      const [head, ...rest] = queue;
      setRevealed((prev) => ({ ...prev, [activeDraw.groupId]: [...(prev[activeDraw.groupId] || []), head] }));
      setQueue(rest);
    }, REVEAL_MS);
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [queue, paused, activeDraw]);

  const revealAll = () => {
    if (!activeDraw) return;
    setQueue([]);
    setRevealed((prev) => ({ ...prev, [activeDraw.groupId]: activeDraw.matches.map((_, i) => i) }));
    setTeamIdx((prev) => ({ ...prev, [activeDraw.groupId]: activeDraw.order.length - 1 }));
  };

  const groupDone = (d: GroupDraw) => (revealed[d.groupId] || []).length >= d.matches.length && !(d.groupId === activeDraw?.groupId && queue.length);
  const allDone = draws.length > 0 && draws.every(groupDone);

  /* --------------------------------- opslaan -------------------------------- */

  const apply = async () => {
    setApplying(true);
    try {
      let total = 0;
      for (const d of draws) {
        const g = drawGroups.find((x) => x.id === d.groupId)!;
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
             const g = drawGroups.find((x) => x.id === d.groupId)!;
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
            className={`relative h-auto min-h-36 w-full flex-col items-start justify-start gap-2 whitespace-normal border-x-0 border-y-2 p-5 text-left hover:bg-secondary ${selected ? "border-y-primary bg-primary/[0.06]" : "border-y-border bg-card"}`}>
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
  const unassigned = potGroup?.teamIds.filter((id) => !assigned.has(id)) || [];
  const potOptions = potGroup ? Array.from({ length: Math.floor(potGroup.teamIds.length / 2) }, (_, i) => i + 2)
    .filter((count) => count <= potGroup.teamIds.length && potGroup.teamIds.length % count === 0) : [];
  const potScreen = (
    <div className="min-h-0 space-y-4 overflow-y-auto pr-1">
      <div><h3 className="text-lg font-bold">Potindeling</h3><p className="text-sm text-muted-foreground">Verdeel de teams per poule gelijkmatig over de niveau-potten.</p></div>
      {groups.length > 1 && <div className="flex flex-wrap gap-2">{groups.map((g) => <Button key={g.id} size="sm" variant={potGroup?.id === g.id ? "default" : "outline"} onClick={() => { setPotGroupId(g.id); setPotError(""); }}>{g.name} {potGroups[g.id]?.length ? `· ${potGroups[g.id].flatMap((p) => p.teamIds).length}/${g.teamIds.length}` : ""}</Button>)}</div>}
      {potGroup && <>
        <div className="space-y-2"><Label>Aantal potten · {potGroup.teamIds.length} teams</Label><div className="flex flex-wrap gap-2">
          {potOptions.map((count) => <Button key={count} variant="outline" aria-pressed={groupPots.length === count} onClick={() => selectPotCount(potGroup, count)} className={`h-auto flex-col items-start border-x-0 border-y-2 px-4 py-2 ${groupPots.length === count ? "border-y-primary bg-primary/[0.06]" : "border-y-border bg-card"}`}>
            <span className="font-semibold">{count} potten</span><span className="text-xs text-muted-foreground">{potGroup.teamIds.length / count} teams per pot</span>
          </Button>)}
        </div></div>
        {groupPots.length > 0 && <DndContext sensors={potSensors} onDragEnd={(event: DragEndEvent) => { if (event.over) movePotTeam(potGroup.id, String(event.active.id), String(event.over.id)); }}>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="border border-border bg-card p-3"><div className="mb-2 font-semibold">Niet ingedeeld <span className="text-muted-foreground">{unassigned.length}</span></div>
              <PotZone id="unassigned">{unassigned.map((id) => <DraggableTeam key={id} id={id}><TeamChip id={id} /></DraggableTeam>)}</PotZone>
            </div>
            {groupPots.map((pot) => <div key={pot.id} className="border border-border bg-card p-3">
              <div className="mb-2 flex items-center gap-2"><Input aria-label="Potnaam" value={pot.name} onChange={(e) => setPotGroups((prev) => ({ ...prev, [potGroup.id]: (prev[potGroup.id] || []).map((p) => p.id === pot.id ? { ...p, name: e.target.value } : p) }))} className="h-8 min-w-0 flex-1 font-semibold" /><span className={`shrink-0 text-sm font-bold ${pot.teamIds.length === potGroup.teamIds.length / groupPots.length ? "text-primary" : "text-muted-foreground"}`}>{pot.teamIds.length}/{potGroup.teamIds.length / groupPots.length}</span></div>
              <PotZone id={pot.id}>{pot.teamIds.map((id) => <div key={id} className="flex items-center gap-1"><div className="min-w-0 flex-1"><DraggableTeam id={id}><TeamChip id={id} /></DraggableTeam></div><Button size="icon" variant="ghost" aria-label={`${teamById.get(id)?.name || "Team"} verwijderen uit ${pot.name}`} onClick={() => movePotTeam(potGroup.id, id, "unassigned")}><Trash2 className="h-4 w-4" /></Button></div>)}</PotZone>
              {unassigned.length > 0 && pot.teamIds.length < potGroup.teamIds.length / groupPots.length && <Select onValueChange={(id) => movePotTeam(potGroup.id, id, pot.id)}><SelectTrigger className="mt-2 h-8"><SelectValue placeholder="Team toevoegen" /></SelectTrigger><SelectContent>{unassigned.map((id) => <SelectItem key={id} value={id}>{teamById.get(id)?.name}</SelectItem>)}</SelectContent></Select>}
            </div>)}
          </div>
        </DndContext>}
      </>}
      {potError && <p role="alert" className="flex items-center gap-2 text-sm text-destructive"><AlertTriangle className="h-4 w-4" />{potError}</p>}
    </div>
  );

  const settings = (
    <div className="min-h-0 space-y-5 overflow-y-auto pr-1">
      <div>
        <h3 className="text-lg font-semibold">Speelrondes loten</h3>
        <p className="text-sm text-muted-foreground">Bepaal hoeveel tegenstanders elk team uit iedere pot loot. De speelrondes worden vóór de loting volledig aangemaakt en gecontroleerd.</p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {drawGroups.map((g) => (
          <div key={g.id} className="rounded-md border border-primary/25 bg-card p-3 text-sm">
            <div className="font-semibold">{g.name}</div>
            <div className="text-muted-foreground">
              {g.teamIds.length} teams · {g.rounds} speelrondes · {matchesPerTeam(g.teamIds.length, g.rounds)} wedstrijden per team
            </div>
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
        <div className="rounded-md border border-primary/25 bg-card p-4">
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
            <table className="text-sm">
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
        </div>
      )}

      <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
        <CollapsibleTrigger asChild>
            <Button variant="outline" className="w-full justify-between">Geavanceerde regels <ChevronDown className={`h-4 w-4 transition-transform ${advancedOpen ? "rotate-180" : ""}`} /></Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-3 space-y-4 rounded-md border border-primary/25 bg-card p-4">
          <div>
            <Label className="font-semibold">Teams uit hetzelfde land</Label>
            <RadioGroup value={sameCountry} onValueChange={(v) => setSameCountry(v as SameCountryMode)} className="mt-2 space-y-1">
              <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="allow" /> Niet vermijden</label>
              <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="avoid" /> Zo lang mogelijk vermijden</label>
              <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="never" /> Nooit tegen elkaar</label>
            </RadioGroup>
          </div>
          <div className="flex items-center gap-3">
            <Label className="text-sm">Maximum aantal keer dat twee teams elkaar ontmoeten</Label>
            <Input type="number" min={1} className="h-8 w-16" value={maxMeetings} onChange={(e) => setMaxMeetings(Math.max(1, Number(e.target.value) || 1))} />
          </div>
          <div>
            <Label className="font-semibold">Teams nooit tegen elkaar</Label>
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
        </CollapsibleContent>
      </Collapsible>
    </div>
  );

  const drawScreen = activeDraw && activeGroup && (
    <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)]">
      {/* Links: overzicht */}
      <div className="min-h-0 overflow-y-auto rounded-lg border border-border bg-card p-3">
        {draws.length > 1 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {draws.map((d, i) => {
               const g = drawGroups.find((x) => x.id === d.groupId);
              return (
                <Button key={d.groupId} size="sm" variant={i === activeGroupIdx ? "default" : "outline"} disabled={queue.length > 0} onClick={() => setActiveGroupIdx(i)}>
                  {g?.name} {groupDone(d) && <Check className="h-3.5 w-3.5" />}
                </Button>
              );
            })}
          </div>
        )}
        <div className="space-y-1.5">
          {activeDraw.order.map((teamId) => {
            const list = teamMatches(activeDraw, activeGroup, teamId);
            const known = list.filter((x) => revealedSet.has(x.i));
            const status = teamId === currentTeamId && queue.length ? "Bezig" : known.length === list.length ? "Volledig geloot" : known.length ? "Deels bekend" : "Nog niet gestart";
            return (
              <div key={teamId} className={`rounded-md border px-2 py-1.5 text-sm ${teamId === currentTeamId ? "border-primary bg-primary/10" : "border-border"}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="text-xs text-muted-foreground">{activeGroup.pots[potOf(activeGroup, teamId)]?.name}</span>
                    <TeamChip id={teamId} />
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">{known.length}/{list.length} · {status}</span>
                </div>
                {known.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 pl-1 text-xs text-muted-foreground">
                    {known.map((x) => <span key={x.i}>{teamById.get(x.opp)?.name}</span>)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Rechts: actieve trekking */}
      <div className="flex min-h-0 flex-col gap-3 overflow-y-auto rounded-lg border border-border bg-card p-4">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">{activeGroup.name}</div>
        {currentTeamId ? (
          <>
            <div className="rounded-lg border border-primary/40 bg-primary/5 p-4">
              <div className="text-xs text-muted-foreground">{activeGroup.pots[potOf(activeGroup, currentTeamId)]?.name}</div>
              <TeamChip id={currentTeamId} big />
            </div>
            <div className="space-y-3">
              {activeGroup.pots.map((pot, pi) => {
                const list = teamMatches(activeDraw, activeGroup, currentTeamId).filter((x) => potOf(activeGroup, x.opp) === pi);
                if (!list.length) return null;
                const open = list.filter((x) => !revealedSet.has(x.i)).length;
                return (
                  <div key={pot.id}>
                    <div className="mb-1 flex justify-between text-xs font-semibold uppercase text-muted-foreground">
                      <span>Tegen {pot.name}</span><span>nog {open}</span>
                    </div>
                    <div className="space-y-1.5">
                      {list.map((x) => (
                        <div key={x.i} className={`flex h-10 items-center rounded-md border px-3 text-sm transition-all duration-500 ${revealedSet.has(x.i) ? "border-primary/40 bg-background" : "border-dashed border-border text-muted-foreground"}`}>
                          {revealedSet.has(x.i) ? <TeamChip id={x.opp} /> : "?"}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Trek het eerste team{activeGroup.pots.length > 1 ? ` uit ${activeGroup.pots[0].name}` : ""}. Zijn tegenstanders verschijnen daarna één voor één.</p>
        )}
        <div className="mt-auto flex flex-wrap gap-2 pt-2">
          {currentIdx + 1 < activeDraw.order.length && (
            <Button onClick={drawNextTeam} disabled={queue.length > 0}>
              Trek team{activeGroup.pots.length > 1 ? ` (${activeGroup.pots[potOf(activeGroup, activeDraw.order[currentIdx + 1])]?.name})` : ""}
            </Button>
          )}
          {queue.length > 0 && (
            <Button variant="outline" onClick={() => setPaused((p) => !p)}>
              {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />} {paused ? "Verder" : "Pauze"}
            </Button>
          )}
          {!groupDone(activeDraw) && <Button variant="ghost" onClick={revealAll}><FastForward className="h-4 w-4" /> Alles tonen</Button>}
          {groupDone(activeDraw) && activeGroupIdx + 1 < draws.length && (
            <Button onClick={() => setActiveGroupIdx(activeGroupIdx + 1)}>Volgende groep</Button>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
       <DialogContent scrollable={false} className={`rounds-draw-theme text-foreground ${step === "draw" ? "inset-0 left-0 top-0 h-dvh w-screen max-w-none translate-x-0 translate-y-0 overflow-hidden rounded-none border border-primary/30 bg-background p-4 sm:p-6" : "max-w-4xl border-primary/30 bg-background"}`}>
         <DialogHeader className="shrink-0 border-b border-primary/30 pb-3">
          <DialogTitle>Live loting speelrondes{phaseName ? ` · ${phaseName}` : ""}</DialogTitle>
        </DialogHeader>
         <div aria-label="Voortgang live loting" className="grid grid-cols-3 gap-2 border-b border-primary/20 pb-3">
           {(["Type loting", "Regels & matrix", "Loting & Schema"] as const).map((label, index) => {
             const active = ["method", "settings", "draw"].indexOf(step) === index;
             const done = ["method", "settings", "draw"].indexOf(step) > index;
             return <div key={label} aria-current={active ? "step" : undefined} className={`min-w-0 border-y-2 px-2 py-2 text-xs font-semibold sm:px-3 ${active ? "border-primary bg-primary/10 text-primary" : done ? "border-primary/50 bg-card text-foreground" : "border-border bg-card text-muted-foreground"}`}>
               <span className="block text-[10px] uppercase">Stap {index + 1}</span><span>{label}</span>
             </div>;
           })}
         </div>
        {loading ? (
          <div className="py-10 text-center text-sm text-muted-foreground">Laden...</div>
         ) : step === "method" ? methodScreen : step === "settings" ? settings : drawScreen}
        <DialogFooter className="shrink-0 gap-2">
           {step === "method" ? (
             <><Button variant="ghost" onClick={() => onOpenChange(false)}>Sluiten</Button><Button onClick={nextToRules} disabled={loading || groups.length === 0 || (method === "pots" && !potDrawAvailable)}>Verder naar regels & matrix</Button></>
           ) : step === "settings" ? (
            <>
               <Button variant="outline" onClick={() => setStep("method")}><ArrowLeft className="h-4 w-4" /> Terug naar type loting</Button>
              <Button onClick={prepare} disabled={checking || groups.length === 0}>
                {checking ? "Speelrondes aanmaken..." : "Naar de loting"}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setStep("settings")} disabled={applying}><ArrowLeft className="h-4 w-4" /> Terug naar instellingen</Button>
              {allDone ? (
                <Button onClick={apply} disabled={applying}><Check className="h-4 w-4" /> {applying ? "Opslaan..." : "Wedstrijden opslaan"}</Button>
              ) : (
                <span className="flex items-center gap-1 text-xs text-muted-foreground"><AlertTriangle className="h-3.5 w-3.5" /> Onthul alle tegenstanders om de wedstrijden op te slaan.</span>
              )}
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RoundsDrawDialog;
