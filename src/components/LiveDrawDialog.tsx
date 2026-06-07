import { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Sparkles, Play, X, Maximize2, Minimize2, ArrowLeft } from "lucide-react";
import CountryFlag from "@/components/CountryFlag";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { generateRoundRobin } from "@/lib/matchGenerator";

type Team = { id: string; name: string; logo_url: string | null; country: string | null; category_id: string | null };
type Phase = { id: string; phase_number: number };
type SlotRow = { id: string; slot_code: string; group_id: string | null; team_id: string | null; sort_order: number };
type MatchRow = { id: string; group_id: string | null; home_team_id: string | null; away_team_id: string | null; home_slot_label: string | null; away_slot_label: string | null; match_name: string | null };

type Pairing = { kind: "match"; matchId: string; group_id: string | null; home: Team | null; away: Team | null };
type GroupSlot = { kind: "slot"; slotId: string; slot_code: string; group_id: string; group_name: string; team: Team | null; potIndex?: number };
type GeneratedMatch = { group_id: string; round: number; home: Team; away: Team; homeSlot: string; awaySlot: string; matchName?: string | null };

type DrawMode = "groups" | "matches";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tournamentId: string;
  phaseId: string;
  phaseType: string;
  categoryId: string | null;
  phases?: Phase[];
  phaseNumber?: number;
  mode?: DrawMode; // explicit override
  targetGroupId?: string | null; // if set in matches mode, restrict to this group
  onComplete?: () => void;
}

const shuffle = <T,>(arr: T[]): T[] => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const autoDistribute = (total: number, parts: number): number[] => {
  if (parts <= 0) return [];
  const base = Math.floor(total / parts);
  const remainder = total % parts;
  return Array.from({ length: parts }, (_, i) => base + (i < remainder ? 1 : 0));
};

/**
 * Live draw dialog. Supports:
 *  - groups mode: distribute teams over existing group slots (optional pots)
 *  - matches mode: generate matches for a group (or all groups) optionally based on pot matrix
 */
const LiveDrawDialog = ({
  open, onOpenChange, tournamentId, phaseId, phaseType, categoryId,
  phases: phasesProp, phaseNumber: phaseNumberProp,
  mode: modeProp, targetGroupId,
  onComplete,
}: Props) => {
  const { toast } = useToast();
  const isBracketPhase = phaseType === "knockout" || phaseType === "single_match";
  const initialMode: DrawMode = modeProp ?? (isBracketPhase ? "matches" : "groups");

  // ----- top-level state -----
  const [mode, setMode] = useState<DrawMode>(initialMode);
  const [fullscreen, setFullscreen] = useState(true);
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState<"choose" | "options" | "ready" | "drawing" | "done">("options");

  // ----- data state -----
  const [teams, setTeams] = useState<Team[]>([]); // available teams
  const [groupSlots, setGroupSlots] = useState<GroupSlot[]>([]); // for groups mode (and overview in matches mode)
  const [groupNames, setGroupNames] = useState<{ id: string; name: string; size: number }[]>([]);
  const [bracketPairings, setBracketPairings] = useState<Pairing[]>([]);
  const [matchConfig, setMatchConfig] = useState<{ matchType: string; encounters: number; rounds: number }>({ matchType: "single_leg", encounters: 3, rounds: 3 });
  const [existingAssignment, setExistingAssignment] = useState(false); // any slot has a team

  // bracket animation steps
  const [bracketSteps, setBracketSteps] = useState<{ matchIdx: number; side: "home" | "away"; team: Team }[]>([]);

  // ----- group draw options -----
  const [useGroupPots, setUseGroupPots] = useState(false);
  const [groupPotCount, setGroupPotCount] = useState(0);
  const [groupPotSizes, setGroupPotSizes] = useState<number[]>([]);
  const [avoidCountry, setAvoidCountry] = useState(true);

  // ----- match draw options (single global config applied to each target group of equal size) -----
  const [useMatchPots, setUseMatchPots] = useState(false);
  const [matchPotCount, setMatchPotCount] = useState(0);
  const [matchPotSizes, setMatchPotSizes] = useState<number[]>([]); // sizes per pot (within a group)
  const [matchupMatrix, setMatchupMatrix] = useState<number[][]>([]); // symmetric, diagonal allowed
  const [redrawGroupsToo, setRedrawGroupsToo] = useState(false);

  // ----- animation state -----
  const [pool, setPool] = useState<Team[]>([]);
  const [currentPot, setCurrentPot] = useState<number>(0);
  const [step, setStep] = useState(0);
  const [highlight, setHighlight] = useState<string | null>(null);
  const [generatedMatches, setGeneratedMatches] = useState<GeneratedMatch[]>([]);
  const [revealedMatches, setRevealedMatches] = useState<GeneratedMatch[]>([]);

  // ============ LOAD DATA ============
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setMode(initialMode);
    setPhase("options");
    setStep(0);
    setHighlight(null);
    setLoading(true);
    setRevealedMatches([]);
    setRedrawGroupsToo(false);

    (async () => {
      // teams
      const { data: allTeams } = await supabase
        .from("teams")
        .select("id, name, logo_url, country, category_id")
        .eq("tournament_id", tournamentId)
        .order("name");
      const filtered = (allTeams || []).filter(t => !categoryId || t.category_id === categoryId);

      // phases context
      let phases = phasesProp || [];
      if (!phases.length) {
        const { data: ph } = await supabase.from("tournament_phases").select("id, phase_number").eq("tournament_id", tournamentId);
        phases = (ph || []) as Phase[];
      }
      const pNumber = phaseNumberProp ?? (phases.find(p => p.id === phaseId)?.phase_number ?? 1);
      const siblingIds = phases.filter(p => p.phase_number === pNumber).map(p => p.id);
      const earlierIds = phases.filter(p => p.phase_number < pNumber).map(p => p.id);

      const placedIds = new Set<string>();
      const otherSiblings = siblingIds.filter(id => id !== phaseId);
      if (otherSiblings.length > 0) {
        const { data } = await supabase.from("slots").select("team_id").in("phase_id", otherSiblings);
        (data || []).forEach(s => s.team_id && placedIds.add(s.team_id));
      }
      if (earlierIds.length > 0) {
        const { data } = await supabase.from("slots").select("team_id").in("phase_id", earlierIds);
        (data || []).forEach(s => s.team_id && placedIds.add(s.team_id));
      }
      const available = filtered.filter(t => !placedIds.has(t.id));
      if (cancelled) return;
      setTeams(available);

      // groups + slots
      const { data: gRows } = await supabase
        .from("groups").select("id, name").eq("phase_id", phaseId).order("created_at");
      const groupArr = (gRows || []) as { id: string; name: string }[];
      const restrictGroup = targetGroupId && initialMode === "matches";
      const groupArrUsed = restrictGroup ? groupArr.filter(g => g.id === targetGroupId) : groupArr;

      const { data: slotRows } = await supabase
        .from("slots")
        .select("id, slot_code, group_id, team_id, sort_order")
        .eq("tournament_id", tournamentId)
        .eq("phase_id", phaseId);
      const slots = (slotRows || []) as SlotRow[];

      const slotsByGroup = new Map<string, SlotRow[]>();
      slots.forEach(s => {
        if (!s.group_id) return;
        const arr = slotsByGroup.get(s.group_id) || [];
        arr.push(s);
        slotsByGroup.set(s.group_id, arr);
      });

      // build map for team lookup
      const teamMap = new Map(filtered.map(t => [t.id, t]));

      const gs: GroupSlot[] = [];
      const names: { id: string; name: string; size: number }[] = [];
      groupArrUsed.forEach((g, i) => {
        const list = (slotsByGroup.get(g.id) || []).sort((a, b) => a.sort_order - b.sort_order);
        names.push({ id: g.id, name: g.name || `Groep ${String.fromCharCode(65 + i)}`, size: list.length });
        list.forEach(s => gs.push({
          kind: "slot",
          slotId: s.id,
          slot_code: s.slot_code,
          group_id: g.id,
          group_name: g.name || `Groep ${String.fromCharCode(65 + i)}`,
          team: s.team_id ? (teamMap.get(s.team_id) || null) : null,
        }));
      });
      if (cancelled) return;
      setGroupSlots(gs);
      setGroupNames(names);
      setExistingAssignment(gs.some(x => x.team !== null));

      // bracket: load round-1 matches
      if (isBracketPhase) {
        const { data: matches } = await supabase
          .from("matches")
          .select("id, group_id, home_team_id, away_team_id, home_slot_label, away_slot_label, match_name")
          .eq("tournament_id", tournamentId).eq("phase_id", phaseId);
        const allMatches = (matches || []) as MatchRow[];
        const rawSlotCodes = new Set(slots.map(s => s.slot_code));
        let r1 = allMatches.filter(mt => (mt.home_slot_label && rawSlotCodes.has(mt.home_slot_label)) || (mt.away_slot_label && rawSlotCodes.has(mt.away_slot_label)));
        r1 = r1.filter(mt => !mt.match_name?.endsWith("(Terug)"));
        if (cancelled) return;
        setBracketPairings(r1.map(mt => ({ kind: "match" as const, matchId: mt.id, group_id: mt.group_id, home: null, away: null })));
        setExistingAssignment(r1.some(mt => mt.home_team_id || mt.away_team_id));
      } else {
        setBracketPairings([]);
      }

      // phase match config
      const { data: phaseRow } = await supabase
        .from("tournament_phases").select("match_config").eq("id", phaseId).single();
      const cfg = ((phaseRow?.match_config as any) || {}) as any;
      setMatchConfig({
        matchType: cfg.matchType || "single_leg",
        encounters: cfg.encounters || 3,
        rounds: cfg.rounds || 3,
      });

      // defaults
      const totalTeams = Math.min(available.length, gs.length || available.length);
      const nGroups = names.length || 1;
      setGroupPotCount(nGroups);
      setGroupPotSizes(autoDistribute(totalTeams, nGroups));

      const sizePerGroup = names[0]?.size || 4;
      setMatchPotCount(sizePerGroup);
      setMatchPotSizes(autoDistribute(sizePerGroup, sizePerGroup));
      // default matrix: identity-ish (each pot vs each pot = matches per opponent according to format)
      const perOpponent = cfg.matchType === "home_away" ? 2 : cfg.matchType === "multiple" ? (cfg.encounters || 3) : 1;
      const mat = Array.from({ length: sizePerGroup }, (_, i) =>
        Array.from({ length: sizePerGroup }, (_, j) => (i === j ? 0 : perOpponent))
      );
      setMatchupMatrix(mat);

      // For matches mode, if there is no existing assignment, force redrawGroupsToo
      if (initialMode === "matches" && !gs.some(x => x.team)) {
        setRedrawGroupsToo(true);
      }

      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [open, tournamentId, phaseId, categoryId, phaseNumberProp, initialMode, targetGroupId]);

  // when match pot count changes, recompute sizes + matrix
  useEffect(() => {
    if (matchPotCount <= 0) return;
    const sizePerGroup = groupNames[0]?.size || matchPotCount;
    setMatchPotSizes(autoDistribute(sizePerGroup, matchPotCount));
    const perOpponent = matchConfig.matchType === "home_away" ? 2 : matchConfig.matchType === "multiple" ? (matchConfig.encounters || 3) : 1;
    setMatchupMatrix(Array.from({ length: matchPotCount }, (_, i) =>
      Array.from({ length: matchPotCount }, (_, j) => (i === j ? 0 : perOpponent))
    ));
  }, [matchPotCount, groupNames, matchConfig]);

  // when group pot count changes, recompute sizes
  useEffect(() => {
    if (groupPotCount <= 0) return;
    const total = Math.min(teams.length, groupSlots.length);
    setGroupPotSizes(autoDistribute(total, groupPotCount));
  }, [groupPotCount, teams.length, groupSlots.length]);

  // ============ GROUP DRAW PLAN ============
  type GroupAssignment = { slotId: string; team: Team; potIndex: number; group_id: string };
  const buildGroupAssignments = useCallback((): GroupAssignment[] => {
    const slotsByGroup = new Map<string, GroupSlot[]>();
    groupSlots.forEach(gs => {
      const arr = slotsByGroup.get(gs.group_id) || [];
      arr.push(gs);
      slotsByGroup.set(gs.group_id, arr);
    });
    const totalAvailable = Math.min(teams.length, groupSlots.length);
    const pickList = teams.slice(0, totalAvailable);

    // Build pots
    let pots: Team[][];
    if (useGroupPots) {
      const sizes = groupPotSizes;
      pots = [];
      let cursor = 0;
      for (const s of sizes) {
        pots.push(shuffle(pickList.slice(cursor, cursor + s)));
        cursor += s;
      }
    } else {
      pots = [shuffle(pickList)];
    }

    // Track remaining capacity per group
    const capacity = new Map<string, number>();
    groupNames.forEach(g => capacity.set(g.id, g.size));

    const tryAssign = (): GroupAssignment[] | null => {
      const cap = new Map(capacity);
      const result: GroupAssignment[] = [];
      const groupSeenCountry = new Map<string, Set<string>>();
      groupNames.forEach(g => groupSeenCountry.set(g.id, new Set()));

      for (let p = 0; p < pots.length; p++) {
        const potTeams = pots[p];
        for (const team of potTeams) {
          // pick a group with capacity > 0, prefer ones without same country (if option on)
          const candidateGroups = groupNames.filter(g => (cap.get(g.id) || 0) > 0);
          if (candidateGroups.length === 0) return null;
          let pickGroups = candidateGroups;
          if (avoidCountry && team.country) {
            const safe = candidateGroups.filter(g => !groupSeenCountry.get(g.id)!.has(team.country!));
            if (safe.length > 0) pickGroups = safe;
          }
          const target = pickGroups[Math.floor(Math.random() * pickGroups.length)];
          const slotList = slotsByGroup.get(target.id) || [];
          const used = result.filter(r => r.group_id === target.id).length;
          const slot = slotList[used];
          if (!slot) return null;
          result.push({ slotId: slot.slotId, team, potIndex: p, group_id: target.id });
          cap.set(target.id, (cap.get(target.id) || 0) - 1);
          if (team.country) groupSeenCountry.get(target.id)!.add(team.country);
        }
      }
      return result;
    };

    for (let attempt = 0; attempt < 30; attempt++) {
      const r = tryAssign();
      if (r) return r;
    }
    // fallback without avoid country
    const cap = new Map(capacity);
    const result: GroupAssignment[] = [];
    for (let p = 0; p < pots.length; p++) {
      for (const team of pots[p]) {
        const candidateGroups = groupNames.filter(g => (cap.get(g.id) || 0) > 0);
        if (!candidateGroups.length) break;
        const target = candidateGroups[Math.floor(Math.random() * candidateGroups.length)];
        const slotList = slotsByGroup.get(target.id) || [];
        const used = result.filter(r => r.group_id === target.id).length;
        const slot = slotList[used];
        if (!slot) continue;
        result.push({ slotId: slot.slotId, team, potIndex: p, group_id: target.id });
        cap.set(target.id, (cap.get(target.id) || 0) - 1);
      }
    }
    return result;
  }, [groupSlots, groupNames, teams, useGroupPots, groupPotSizes, avoidCountry]);

  // ============ MATCH DRAW PLAN ============
  const buildMatchPlan = useCallback((slots: GroupSlot[]): GeneratedMatch[] => {
    // group by group_id
    const byGroup = new Map<string, GroupSlot[]>();
    slots.forEach(s => {
      if (!s.team) return;
      const arr = byGroup.get(s.group_id) || [];
      arr.push(s);
      byGroup.set(s.group_id, arr);
    });

    const out: GeneratedMatch[] = [];
    const matchType = matchConfig.matchType;
    const customRounds = matchType === "multiple" ? matchConfig.encounters : matchConfig.rounds;
    const genType = matchType === "home_away" ? "home_away" : (matchType === "multiple" || matchType === "rounds") ? "custom" : "single_leg";

    for (const [gid, gSlots] of byGroup.entries()) {
      const teamsInGroup = gSlots.filter(s => s.team) as (GroupSlot & { team: Team })[];
      if (teamsInGroup.length < 2) continue;
      const gName = groupNames.find(g => g.id === gid)?.name || "Groep";

      if (!useMatchPots) {
        // simple shuffle the teams, then use generateRoundRobin against indices to derive pairings
        const shuffled = shuffle(teamsInGroup);
        const pairings = generateRoundRobin(shuffled.length, genType as any, customRounds);
        for (const p of pairings) {
          const home = shuffled[p.homeIdx];
          const away = shuffled[p.awayIdx];
          if (!home || !away) continue;
          out.push({
            group_id: gid,
            round: p.round,
            home: home.team, away: away.team,
            homeSlot: home.slot_code, awaySlot: away.slot_code,
          });
        }
      } else {
        // Pot mode: assign teams to pots in this group based on matchPotSizes
        const shuffled = shuffle(teamsInGroup);
        const potTeams: (GroupSlot & { team: Team })[][] = [];
        let cursor = 0;
        for (const sz of matchPotSizes) {
          potTeams.push(shuffled.slice(cursor, cursor + sz));
          cursor += sz;
        }
        // Build pairing budget from matrix (only upper triangle + diagonal)
        type PairPool = { i: number; j: number; budget: number };
        const pools: PairPool[] = [];
        for (let i = 0; i < matchPotCount; i++) {
          for (let j = i; j < matchPotCount; j++) {
            pools.push({ i, j, budget: matchupMatrix[i]?.[j] || 0 });
          }
        }
        const groupPairings: GeneratedMatch[] = [];
        // For each pool, generate `budget` matches per team-of-pot-i (with team in pot j)
        for (const pool of pools) {
          if (pool.budget <= 0) continue;
          const A = potTeams[pool.i];
          const B = potTeams[pool.j];
          if (pool.i === pool.j) {
            // intra-pot: round-robin within pool of size n, repeated `budget` times
            for (let rep = 0; rep < pool.budget; rep++) {
              const pairs = generateRoundRobin(A.length, "single_leg", 1);
              for (const p of pairs) {
                const h = A[p.homeIdx]; const a = A[p.awayIdx];
                if (h && a) groupPairings.push({
                  group_id: gid, round: rep + 1,
                  home: h.team, away: a.team,
                  homeSlot: h.slot_code, awaySlot: a.slot_code,
                });
              }
            }
          } else {
            // inter-pot: each team in A plays `budget` matches against teams in B; balance B usage
            for (let rep = 0; rep < pool.budget; rep++) {
              const aOrder = shuffle(A);
              const bOrder = shuffle(B);
              // simple pairing — if |A| ≤ |B|, each a meets a unique b; otherwise wrap
              const len = Math.max(aOrder.length, bOrder.length);
              for (let k = 0; k < len; k++) {
                const h = aOrder[k % aOrder.length];
                const a = bOrder[k % bOrder.length];
                if (h && a && h.team.id !== a.team.id) {
                  groupPairings.push({
                    group_id: gid, round: rep + 1,
                    home: h.team, away: a.team,
                    homeSlot: h.slot_code, awaySlot: a.slot_code,
                  });
                }
              }
            }
          }
        }
        out.push(...groupPairings);
      }
    }
    return out;
  }, [groupSlots, matchConfig, useMatchPots, matchPotSizes, matchPotCount, matchupMatrix, groupNames]);

  // ============ BRACKET DRAW PLAN ============
  const buildBracketPlan = useCallback((): { matchIdx: number; side: "home" | "away"; team: Team }[] => {
    const totalSlots = bracketPairings.length * 2;
    const pickList = teams.slice(0, totalSlots);
    let order: Team[];
    if (useGroupPots) {
      const half = Math.ceil(pickList.length / 2);
      const potA = shuffle(pickList.slice(0, half));
      const potB = shuffle(pickList.slice(half));
      order = [];
      for (let i = 0; i < bracketPairings.length; i++) {
        if (potA[i]) order.push(potA[i]);
        if (potB[i]) order.push(potB[i]);
      }
    } else {
      order = shuffle(pickList);
    }
    if (avoidCountry) {
      for (let i = 0; i + 1 < order.length; i += 2) {
        if (order[i]?.country && order[i].country === order[i + 1]?.country) {
          for (let j = i + 2; j < order.length; j++) {
            if (order[j]?.country !== order[i].country) {
              [order[i + 1], order[j]] = [order[j], order[i + 1]];
              break;
            }
          }
        }
      }
    }
    const plan: { matchIdx: number; side: "home" | "away"; team: Team }[] = [];
    for (let i = 0; i < bracketPairings.length; i++) {
      if (order[i * 2]) plan.push({ matchIdx: i, side: "home", team: order[i * 2] });
      if (order[i * 2 + 1]) plan.push({ matchIdx: i, side: "away", team: order[i * 2 + 1] });
    }
    return plan;
  }, [bracketPairings, teams, useGroupPots, avoidCountry]);

  // ============ START DRAW ============
  const startDraw = () => {
    setPhase("drawing");
    setStep(0);
    setHighlight(null);
    setRevealedMatches([]);
    setCurrentPot(0);
  };

  // groups animation
  const [pendingGroupAssignments, setPendingGroupAssignments] = useState<GroupAssignment[]>([]);

  useEffect(() => {
    if (phase !== "drawing") return;
    if (isBracketPhase) {
      const plan = buildBracketPlan();
      setBracketSteps(plan);
      setBracketPairings(prev => prev.map(p => ({ ...p, home: null, away: null })));
      setStep(0);
      return;
    }
    // groups stage runs first if needed
    if (mode === "groups" || (mode === "matches" && redrawGroupsToo)) {
      const assignments = buildGroupAssignments();
      setPendingGroupAssignments(assignments);
      setPool(assignments.map(a => a.team));
      // clear group slot teams in UI for animation
      setGroupSlots(prev => prev.map(s => ({ ...s, team: null })));
    } else {
      setPendingGroupAssignments([]);
      // matches stage only — go straight to matches
      const plan = buildMatchPlan(groupSlots);
      setGeneratedMatches(plan);
    }
    setStep(0);
  }, [phase]);

  // step through assignments
  useEffect(() => {
    if (phase !== "drawing") return;
    if (isBracketPhase) {
      if (bracketSteps.length === 0) return;
      if (step >= bracketSteps.length) {
        void persistBracket().then(() => setPhase("done"));
        return;
      }
      const cur = bracketSteps[step];
      setHighlight(cur.team.id);
      const t = setTimeout(() => {
        setBracketPairings(prev => prev.map((p, i) => i === cur.matchIdx ? { ...p, [cur.side]: cur.team } as Pairing : p));
        setHighlight(null);
        setStep(s => s + 1);
      }, 700);
      return () => clearTimeout(t);
    }
    if (mode === "groups" || (mode === "matches" && redrawGroupsToo)) {
      if (pendingGroupAssignments.length === 0) return;
      if (step >= pendingGroupAssignments.length) {
        // done with group draw
        if (mode === "groups") {
          void persistGroups().then(() => setPhase("done"));
        } else {
          // continue to matches stage
          const updatedSlots = applyGroupAssignmentsToSlots(groupSlots, pendingGroupAssignments);
          setGroupSlots(updatedSlots);
          const plan = buildMatchPlan(updatedSlots);
          setGeneratedMatches(plan);
          setStep(0);
          setPendingGroupAssignments([]); // signals: now matches stage
        }
        return;
      }
      const cur = pendingGroupAssignments[step];
      setHighlight(cur.team.id);
      setCurrentPot(cur.potIndex);
      const t = setTimeout(() => {
        setGroupSlots(prev => prev.map(s => s.slotId === cur.slotId ? { ...s, team: cur.team } : s));
        setHighlight(null);
        setStep(s => s + 1);
      }, 700);
      return () => clearTimeout(t);
    }

    // matches stage
    if (generatedMatches.length === 0) {
      void persistMatches([]).then(() => setPhase("done"));
      return;
    }
    if (step >= generatedMatches.length) {
      void persistMatches(generatedMatches).then(() => setPhase("done"));
      return;
    }
    const cur = generatedMatches[step];
    const t = setTimeout(() => {
      setRevealedMatches(prev => [...prev, cur]);
      setStep(s => s + 1);
    }, 500);
    return () => clearTimeout(t);
  }, [phase, step, pendingGroupAssignments, generatedMatches, mode, redrawGroupsToo]);

  const applyGroupAssignmentsToSlots = (slots: GroupSlot[], assigns: GroupAssignment[]): GroupSlot[] => {
    const map = new Map(assigns.map(a => [a.slotId, a.team]));
    return slots.map(s => map.has(s.slotId) ? { ...s, team: map.get(s.slotId)! } : s);
  };

  // ============ PERSIST ============
  const persistGroups = async () => {
    try {
      // clear current slots first (for re-draws)
      const slotIds = groupSlots.map(s => s.slotId);
      if (slotIds.length === 0) return;
      // upsert teams
      const updates: Promise<any>[] = [];
      const groupTeamRows: { group_id: string; team_id: string; tournament_id: string }[] = [];
      // 1) clear ALL team_ids in these slots first
      await supabase.from("slots").update({ team_id: null }).in("id", slotIds);
      await supabase.from("group_teams").delete().eq("tournament_id", tournamentId).in("group_id", groupNames.map(g => g.id));

      for (const gs of groupSlots) {
        if (!gs.team) continue;
        updates.push(Promise.resolve(supabase.from("slots").update({ team_id: gs.team.id }).eq("id", gs.slotId)));
        groupTeamRows.push({ group_id: gs.group_id, team_id: gs.team.id, tournament_id: tournamentId });
        updates.push(Promise.resolve(supabase.from("matches").update({ home_team_id: gs.team.id })
          .match({ tournament_id: tournamentId, phase_id: phaseId, home_slot_label: gs.slot_code, group_id: gs.group_id })));
        updates.push(Promise.resolve(supabase.from("matches").update({ away_team_id: gs.team.id })
          .match({ tournament_id: tournamentId, phase_id: phaseId, away_slot_label: gs.slot_code, group_id: gs.group_id })));
      }
      await Promise.all(updates);
      if (groupTeamRows.length) await supabase.from("group_teams").upsert(groupTeamRows, { onConflict: "group_id,team_id" } as any);
      toast({ title: "Loting voltooid", description: "Groepen ingedeeld." });
      onComplete?.();
    } catch (e: any) {
      toast({ title: "Loting mislukt", description: e.message || "Onbekende fout", variant: "destructive" });
    }
  };

  const persistMatches = async (plan: GeneratedMatch[]) => {
    try {
      // also persist groups if redraw was done
      if (redrawGroupsToo) {
        await persistGroups();
      }
      // delete existing matches for the target groups
      const gids = Array.from(new Set(groupSlots.map(s => s.group_id)));
      if (gids.length === 0) return;
      await supabase.from("matches").delete()
        .eq("tournament_id", tournamentId).eq("phase_id", phaseId).in("group_id", gids);

      const inserts: any[] = [];
      // For home_away: also create reverse leg
      const isHomeAway = matchConfig.matchType === "home_away";
      for (const m of plan) {
        const base = {
          tournament_id: tournamentId,
          phase_id: phaseId,
          group_id: m.group_id,
          home_team_id: m.home.id,
          away_team_id: m.away.id,
          home_slot_label: m.homeSlot,
          away_slot_label: m.awaySlot,
          round_number: m.round,
        };
        inserts.push(base);
      }
      if (inserts.length) {
        const { error } = await supabase.from("matches").insert(inserts);
        if (error) throw error;
      }
      toast({ title: "Loting voltooid", description: `${inserts.length} wedstrijden gegenereerd.` });
      onComplete?.();
    } catch (e: any) {
      toast({ title: "Loting mislukt", description: e.message || "Onbekende fout", variant: "destructive" });
    }
  };

  // ============ UI ============
  const renderModeChooser = () => (
    <div className="flex-1 flex items-center justify-center">
      <div className="max-w-md w-full space-y-3">
        <p className="text-center text-muted-foreground mb-4">Wat wil je loten?</p>
        <button
          onClick={() => { setRedrawGroupsToo(true); setPhase("options"); }}
          className="w-full rounded-lg border border-border bg-card p-4 text-left hover:border-primary transition-colors"
        >
          <p className="font-bold">Groepen + wedstrijden loten</p>
          <p className="text-xs text-muted-foreground mt-1">Alle huidige teamtoewijzingen worden gewist en opnieuw geloot.</p>
        </button>
        <button
          onClick={() => { setRedrawGroupsToo(false); setPhase("options"); }}
          className="w-full rounded-lg border border-border bg-card p-4 text-left hover:border-primary transition-colors"
        >
          <p className="font-bold">Enkel wedstrijden loten</p>
          <p className="text-xs text-muted-foreground mt-1">De huidige groepsindeling blijft behouden. Alleen de wedstrijden worden opnieuw gegenereerd.</p>
        </button>
      </div>
    </div>
  );

  const setMatrixCell = (i: number, j: number, v: number) => {
    setMatchupMatrix(prev => {
      const next = prev.map(row => [...row]);
      next[i][j] = v;
      if (i !== j) next[j][i] = v;
      return next;
    });
  };

  const updateGroupPotSize = (idx: number, v: number) => {
    setGroupPotSizes(prev => prev.map((s, i) => i === idx ? v : s));
  };

  const groupPotsSum = groupPotSizes.reduce((a, b) => a + b, 0);
  const groupPotsValid = groupPotsSum === Math.min(teams.length, groupSlots.length);
  const matchPotsSum = matchPotSizes.reduce((a, b) => a + b, 0);
  const sizePerGroup = groupNames[0]?.size || 0;
  const matchPotsValid = matchPotsSum === sizePerGroup;

  const renderOptions = () => {
    const showGroupSection = mode === "groups" || (mode === "matches" && redrawGroupsToo);
    const showMatchSection = mode === "matches";
    return (
      <div className="space-y-5">
        {showGroupSection && (
          <div className="rounded-xl border border-border bg-card/40 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-bold">Groepsloting</Label>
                <p className="text-xs text-muted-foreground">Verdeel teams over de groepen.</p>
              </div>
            </div>
            <div className="flex items-center justify-between rounded-md border border-border p-3">
              <div>
                <Label className="text-sm font-semibold">Potten gebruiken</Label>
                <p className="text-xs text-muted-foreground">Verdeel teams in potten met aangepaste grootte.</p>
              </div>
              <Switch checked={useGroupPots} onCheckedChange={setUseGroupPots} />
            </div>
            {useGroupPots && (
              <div className="rounded-md border border-border p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <Label className="text-xs">Aantal potten</Label>
                  <Input
                    type="number" min={1} max={Math.max(1, teams.length)}
                    value={groupPotCount || ""}
                    onChange={(e) => setGroupPotCount(parseInt(e.target.value) || 0)}
                    className="h-8 w-20"
                  />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {groupPotSizes.map((s, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-xs font-bold w-12">Pot {i + 1}</span>
                      <Input
                        type="number" min={0}
                        value={s} onChange={(e) => updateGroupPotSize(i, parseInt(e.target.value) || 0)}
                        className="h-8 w-20"
                      />
                    </div>
                  ))}
                </div>
                <p className={cn("text-xs", groupPotsValid ? "text-muted-foreground" : "text-destructive font-medium")}>
                  Totaal: {groupPotsSum} / {Math.min(teams.length, groupSlots.length)} teams
                </p>
              </div>
            )}
            <div className="flex items-center justify-between rounded-md border border-border p-3">
              <div>
                <Label className="text-sm font-semibold">Zelfde land vermijden</Label>
                <p className="text-xs text-muted-foreground">Best-effort: niet altijd mogelijk.</p>
              </div>
              <Switch checked={avoidCountry} onCheckedChange={setAvoidCountry} />
            </div>
          </div>
        )}

        {showMatchSection && (
          <div className="rounded-xl border border-border bg-card/40 p-4 space-y-3">
            <div>
              <Label className="text-sm font-bold">Wedstrijdloting</Label>
              <p className="text-xs text-muted-foreground">
                Format: <span className="font-medium">{matchConfig.matchType}</span>
                {matchConfig.matchType === "multiple" && ` (${matchConfig.encounters} ontmoetingen)`}
                {matchConfig.matchType === "rounds" && ` (${matchConfig.rounds} speelrondes)`}
              </p>
            </div>
            <div className="flex items-center justify-between rounded-md border border-border p-3">
              <div>
                <Label className="text-sm font-semibold">Met potten loten</Label>
                <p className="text-xs text-muted-foreground">Bepaal hoeveel wedstrijden tussen welke potten.</p>
              </div>
              <Switch checked={useMatchPots} onCheckedChange={setUseMatchPots} />
            </div>
            {useMatchPots && sizePerGroup > 0 && (
              <div className="rounded-md border border-border p-3 space-y-3">
                <div className="flex items-center gap-2">
                  <Label className="text-xs">Aantal potten per groep</Label>
                  <Input
                    type="number" min={1} max={sizePerGroup}
                    value={matchPotCount || ""}
                    onChange={(e) => setMatchPotCount(Math.min(parseInt(e.target.value) || 0, sizePerGroup))}
                    className="h-8 w-20"
                  />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {matchPotSizes.map((s, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-xs font-bold w-12">Pot {i + 1}</span>
                      <Input
                        type="number" min={0} value={s}
                        onChange={(e) => setMatchPotSizes(prev => prev.map((x, k) => k === i ? parseInt(e.target.value) || 0 : x))}
                        className="h-8 w-20"
                      />
                    </div>
                  ))}
                </div>
                <p className={cn("text-xs", matchPotsValid ? "text-muted-foreground" : "text-destructive font-medium")}>
                  Som: {matchPotsSum} / {sizePerGroup} teams per groep
                </p>
                <div className="space-y-1">
                  <Label className="text-xs">Wedstrijden per pot-paar</Label>
                  <div className="overflow-auto">
                    <table className="text-xs">
                      <thead>
                        <tr>
                          <th className="p-1"></th>
                          {Array.from({ length: matchPotCount }).map((_, j) => (
                            <th key={j} className="p-1 font-bold text-center">vs P{j + 1}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {Array.from({ length: matchPotCount }).map((_, i) => (
                          <tr key={i}>
                            <td className="p-1 font-bold">Pot {i + 1}</td>
                            {Array.from({ length: matchPotCount }).map((_, j) => (
                              <td key={j} className="p-1">
                                <Input
                                  type="number" min={0}
                                  value={matchupMatrix[i]?.[j] ?? 0}
                                  onChange={(e) => setMatrixCell(i, j, parseInt(e.target.value) || 0)}
                                  className="h-7 w-14"
                                />
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-xs text-muted-foreground">Matrix is symmetrisch: cel (i,j) = (j,i).</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderStage = () => {
    const inGroupStage = mode === "groups" || (mode === "matches" && redrawGroupsToo && pendingGroupAssignments.length > 0);
    return (
      <div className="grid lg:grid-cols-[1fr_2fr] gap-6 h-full">
        <div className="rounded-xl border border-border bg-card/40 p-4 min-h-[300px] overflow-auto">
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-3">
            {inGroupStage ? (useGroupPots ? `Pot ${currentPot + 1}` : "Pot") : "Wedstrijden"}
          </h3>
          {inGroupStage ? (
            <div className="flex flex-wrap gap-2">
              {pendingGroupAssignments.slice(step).map(a => (
                <div
                  key={a.slotId + a.team.id}
                  className={cn(
                    "flex items-center gap-2 rounded-md border border-border bg-background px-2.5 py-1.5 text-sm transition-all",
                    highlight === a.team.id && "scale-110 ring-2 ring-primary shadow-lg shadow-primary/30"
                  )}
                >
                  {a.team.logo_url ? <img src={a.team.logo_url} className="h-5 w-5 object-contain" alt="" /> : <CountryFlag country={a.team.country} />}
                  <span className="font-medium">{a.team.name}</span>
                  {useGroupPots && <span className="text-[10px] text-muted-foreground">P{a.potIndex + 1}</span>}
                </div>
              ))}
              {pendingGroupAssignments.length - step === 0 && <p className="text-sm text-muted-foreground">Klaar.</p>}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{step} / {generatedMatches.length} geloot</p>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card/40 p-4 overflow-auto">
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-3">
            {inGroupStage ? "Groepen" : "Geloot"}
          </h3>
          {inGroupStage ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {groupNames.map(g => (
                <div key={g.id} className="rounded-lg border border-border bg-background p-3">
                  <div className="text-xs font-bold uppercase tracking-wider text-primary mb-2">{g.name}</div>
                  <div className="space-y-1">
                    {groupSlots.filter(gs => gs.group_id === g.id).map(gs => (
                      <TeamSlot key={gs.slotId} team={gs.team} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-2">
              {revealedMatches.map((m, i) => (
                <div key={i} className="rounded-lg border border-border bg-background p-2 text-sm animate-fade-in">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                    {groupNames.find(g => g.id === m.group_id)?.name} · Ronde {m.round}
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <TeamMini team={m.home} /> <span className="text-xs">vs</span> <TeamMini team={m.away} />
                  </div>
                </div>
              ))}
              {revealedMatches.length === 0 && <p className="text-sm text-muted-foreground col-span-2">Loting bezig...</p>}
            </div>
          )}
        </div>
      </div>
    );
  };

  // Decide if matches-mode dialog should start at "choose" (groups vs no-groups)
  useEffect(() => {
    if (!open) return;
    if (mode === "matches" && existingAssignment) {
      setPhase("choose");
    }
  }, [open, mode, existingAssignment]);

  const startDisabled = () => {
    if (loading) return true;
    if (mode === "groups") {
      if (useGroupPots && !groupPotsValid) return true;
      if (groupSlots.length === 0) return true;
      return false;
    }
    if (mode === "matches") {
      if (useMatchPots && !matchPotsValid) return true;
      if (useMatchPots) {
        // verify each row sum makes sense
        const expected = matchConfig.matchType === "home_away" ? 2 * (sizePerGroup - 1)
          : matchConfig.matchType === "multiple" ? (matchConfig.encounters * (sizePerGroup - 1))
          : matchConfig.matchType === "rounds" ? Number.POSITIVE_INFINITY // free
          : (sizePerGroup - 1);
        if (expected !== Number.POSITIVE_INFINITY) {
          for (let i = 0; i < matchPotCount; i++) {
            let rowMatches = 0;
            for (let j = 0; j < matchPotCount; j++) {
              const cell = matchupMatrix[i]?.[j] || 0;
              // intra-pot pairs are split among (sizes[i] - 1) opponents per round-rep; approximate
              rowMatches += cell * (i === j ? Math.max(0, matchPotSizes[i] - 1) : matchPotSizes[j]);
            }
            // soft check — don't block, but inform
          }
        }
      }
      return false;
    }
    return true;
  };

  const body = (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-bold">
            Live Loting{mode === "matches" ? " — Wedstrijden" : ""}
          </h2>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={() => setFullscreen(f => !f)} title={fullscreen ? "Verklein" : "Vergroot"}>
            {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)} title="Sluiten">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {loading && (
        <div className="flex-1 flex items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      )}

      {!loading && phase === "choose" && renderModeChooser()}

      {!loading && phase === "options" && (
        <div className="flex-1 overflow-auto">{renderOptions()}</div>
      )}

      {!loading && (phase === "drawing" || phase === "done") && (
        <div className="flex-1 min-h-0">{renderStage()}</div>
      )}

      <div className="flex justify-between gap-2 mt-4">
        <div>
          {phase === "options" && mode === "matches" && existingAssignment && (
            <Button variant="ghost" size="sm" onClick={() => setPhase("choose")}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Terug
            </Button>
          )}
        </div>
        <div className="flex gap-2">
          {phase === "options" && (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Annuleren</Button>
              <Button onClick={startDraw} disabled={startDisabled()}>
                <Play className="h-4 w-4" /> Start loting
              </Button>
            </>
          )}
          {phase === "drawing" && (
            <Button variant="outline" disabled>Loting bezig...</Button>
          )}
          {phase === "done" && (
            <Button onClick={() => onOpenChange(false)}>Sluiten</Button>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn("p-6 gap-0", fullscreen ? "max-w-[100vw] w-screen h-screen sm:rounded-none border-0" : "max-w-5xl h-[85vh]")}>
        <DialogHeader className="sr-only">
          <DialogTitle>Live Loting</DialogTitle>
          <DialogDescription>Geanimeerde live loting voor deze fase.</DialogDescription>
        </DialogHeader>
        {body}
      </DialogContent>
    </Dialog>
  );
};

const TeamSlot = ({ team }: { team: Team | null }) => (
  <div className={cn(
    "flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm transition-all",
    team ? "border-primary/40 bg-primary/5" : "border-dashed border-border bg-muted/30 text-muted-foreground"
  )}>
    {team ? (
      <>
        {team.logo_url ? <img src={team.logo_url} className="h-5 w-5 object-contain" alt="" /> : <CountryFlag country={team.country} />}
        <span className="font-medium truncate">{team.name}</span>
      </>
    ) : (
      <span className="text-xs italic">leeg</span>
    )}
  </div>
);

const TeamMini = ({ team }: { team: Team }) => (
  <div className="flex items-center gap-1.5 min-w-0">
    {team.logo_url ? <img src={team.logo_url} className="h-4 w-4 object-contain" alt="" /> : <CountryFlag country={team.country} />}
    <span className="font-medium truncate text-xs">{team.name}</span>
  </div>
);

export default LiveDrawDialog;
