import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Sparkles, Play, X, Maximize2, Minimize2 } from "lucide-react";
import CountryFlag from "@/components/CountryFlag";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type Team = { id: string; name: string; logo_url: string | null; country: string | null; category_id: string | null };

type Phase = { id: string; phase_number: number };

type SlotRow = { id: string; slot_code: string; group_id: string | null; team_id: string | null };

type MatchRow = { id: string; group_id: string | null; home_team_id: string | null; away_team_id: string | null; home_slot_label: string | null; away_slot_label: string | null; match_name: string | null };

type Pairing = { kind: "match"; matchId: string; group_id: string | null; home: Team | null; away: Team | null };
type GroupSlot = { kind: "slot"; slotId: string; slot_code: string; group_id: string; group_name: string; team: Team | null };

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tournamentId: string;
  phaseId: string;
  phaseType: string;
  categoryId: string | null;
  phases?: Phase[];
  phaseNumber?: number;
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

/**
 * Live draw dialog. Adapts to the format type of the phase:
 *  - knockout / single_match → bracket pairing draw (optional seeded pots, optional avoid-same-country)
 *  - group / round_robin     → group draw, slot per group, optional pots, optional avoid-same-country
 *
 * After the animated reveal, persists the assignment using the same writes
 * as the existing "Willekeurige indeling" actions.
 */
const LiveDrawDialog = ({ open, onOpenChange, tournamentId, phaseId, phaseType, categoryId, phases: phasesProp, phaseNumber: phaseNumberProp, onComplete }: Props) => {
  const { toast } = useToast();
  const isBracket = phaseType === "knockout" || phaseType === "single_match";

  // options
  const [usePots, setUsePots] = useState(false);
  const [avoidCountry, setAvoidCountry] = useState(true);
  const [fullscreen, setFullscreen] = useState(true);

  // data
  const [loading, setLoading] = useState(false);
  const [teams, setTeams] = useState<Team[]>([]);
  const [pairings, setPairings] = useState<Pairing[]>([]); // bracket
  const [groupSlots, setGroupSlots] = useState<GroupSlot[]>([]); // groups
  const [groupNames, setGroupNames] = useState<{ id: string; name: string; size: number }[]>([]);

  // animation
  const [phase, setPhase] = useState<"idle" | "ready" | "drawing" | "done">("idle");
  const [pool, setPool] = useState<Team[]>([]);
  const [step, setStep] = useState(0); // index into draw plan
  const [highlight, setHighlight] = useState<string | null>(null); // team id currently flying

  // ------- load data when opening -------
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setPhase("idle");
    setStep(0);
    setHighlight(null);
    setLoading(true);

    (async () => {
      // load teams (only available ones)
      const { data: allTeams } = await supabase
        .from("teams")
        .select("id, name, logo_url, country, category_id")
        .eq("tournament_id", tournamentId)
        .order("name");

      const filtered = (allTeams || []).filter(t => !categoryId || t.category_id === categoryId);

      // exclude teams already placed elsewhere (sibling phases + earlier phases)
      const siblingIds = phases.filter(p => p.phase_number === phaseNumber).map(p => p.id);
      const earlierIds = phases.filter(p => p.phase_number < phaseNumber).map(p => p.id);
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

      if (isBracket) {
        // round 1 matches only — match_name pattern: "Ronde 1 - Wedstrijd N" or includes "(Heen)" / "(Terug)"
        // safer: take phase matches, group by group, find lowest round; for single_match: all matches.
        const { data: matches } = await supabase
          .from("matches")
          .select("id, group_id, home_team_id, away_team_id, home_slot_label, away_slot_label, match_name")
          .eq("tournament_id", tournamentId)
          .eq("phase_id", phaseId);

        const m = (matches || []) as MatchRow[];
        // Determine round-1 matches: those with both slot labels referencing raw slots (no ref_phase),
        // approximated by filtering to matches whose slot_code does NOT start with "W"/"L" winner-progressions.
        // Practical heuristic: round-1 matches are the ones whose slot labels appear in the slots table.
        const { data: slotRows } = await supabase
          .from("slots")
          .select("slot_code")
          .eq("tournament_id", tournamentId)
          .eq("phase_id", phaseId);
        const raw = new Set((slotRows || []).map(s => s.slot_code));
        let r1 = m.filter(mt => (mt.home_slot_label && raw.has(mt.home_slot_label)) || (mt.away_slot_label && raw.has(mt.away_slot_label)));
        // Skip "Terug" legs for two-leg formats
        r1 = r1.filter(mt => !mt.match_name?.endsWith("(Terug)"));
        if (cancelled) return;
        setPairings(r1.map(mt => ({ kind: "match" as const, matchId: mt.id, group_id: mt.group_id, home: null, away: null })));
        setGroupSlots([]);
        setGroupNames([]);
      } else {
        // group draw — fetch groups + empty slots
        const { data: gRows } = await supabase
          .from("groups")
          .select("id, name")
          .eq("phase_id", phaseId)
          .order("created_at");
        const groupArr = (gRows || []) as { id: string; name: string }[];

        const { data: slotRows } = await supabase
          .from("slots")
          .select("id, slot_code, group_id, team_id")
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

        const gs: GroupSlot[] = [];
        const names: { id: string; name: string; size: number }[] = [];
        groupArr.forEach((g, i) => {
          const groupSlotList = (slotsByGroup.get(g.id) || []).sort((a, b) => a.slot_code.localeCompare(b.slot_code));
          names.push({ id: g.id, name: g.name || `Groep ${String.fromCharCode(65 + i)}`, size: groupSlotList.length });
          groupSlotList.forEach(s => gs.push({
            kind: "slot",
            slotId: s.id,
            slot_code: s.slot_code,
            group_id: g.id,
            group_name: g.name || `Groep ${String.fromCharCode(65 + i)}`,
            team: null,
          }));
        });
        if (cancelled) return;
        setGroupSlots(gs);
        setPairings([]);
        setGroupNames(names);
      }

      setLoading(false);
      setPhase("ready");
    })();

    return () => { cancelled = true; };
  }, [open, tournamentId, phaseId, phaseType, categoryId, phaseNumber]);

  // ------- build draw plan -------
  const drawPlan = useMemo(() => {
    if (phase === "idle") return [];
    if (isBracket) {
      // slot count = pairings * 2
      const totalSlots = pairings.length * 2;
      const pickList = teams.slice(0, totalSlots);
      let order: Team[];
      if (usePots) {
        // split into pot A (top half by alpha order = "seeded") and pot B (bottom half)
        const half = Math.ceil(pickList.length / 2);
        const potA = shuffle(pickList.slice(0, half));
        const potB = shuffle(pickList.slice(half));
        order = [];
        for (let i = 0; i < pairings.length; i++) {
          order.push(potA[i]); order.push(potB[i]);
        }
      } else {
        order = shuffle(pickList);
      }
      if (avoidCountry) order = reorderAvoidCountryBracket(order);
      return order;
    } else {
      const totalSlots = groupSlots.length;
      const pickList = teams.slice(0, totalSlots);
      let order: Team[];
      if (usePots && groupNames.length > 0) {
        // pot count = number of groups; round-robin across pots
        const nGroups = groupNames.length;
        const potSize = Math.ceil(pickList.length / nGroups);
        const pots: Team[][] = [];
        for (let i = 0; i < nGroups; i++) {
          pots.push(shuffle(pickList.slice(i * potSize, (i + 1) * potSize)));
        }
        // Distribute pot-by-pot, one team per group per pot, then permute group assignment per pot
        order = [];
        const slotsByGroupId = new Map<string, GroupSlot[]>();
        groupSlots.forEach(gs => {
          const arr = slotsByGroupId.get(gs.group_id) || [];
          arr.push(gs);
          slotsByGroupId.set(gs.group_id, arr);
        });
        const cursor = new Map<string, number>();
        groupNames.forEach(g => cursor.set(g.id, 0));
        for (let p = 0; p < pots.length; p++) {
          const targetGroups = shuffle(groupNames.map(g => g.id));
          const potTeams = pots[p];
          for (let i = 0; i < potTeams.length; i++) {
            const gid = targetGroups[i % targetGroups.length];
            const arr = slotsByGroupId.get(gid) || [];
            const idx = cursor.get(gid) || 0;
            if (idx < arr.length) {
              order.push(potTeams[i]);
              cursor.set(gid, idx + 1);
            }
          }
        }
      } else {
        order = shuffle(pickList);
      }
      if (avoidCountry) order = reorderAvoidCountryGroups(order, groupSlots);
      return order;
    }
  }, [phase, isBracket, pairings, groupSlots, teams, usePots, avoidCountry, groupNames]);

  // ------- run animation -------
  useEffect(() => {
    if (phase !== "drawing") return;
    setPool(drawPlan);
    setStep(0);
  }, [phase]);

  useEffect(() => {
    if (phase !== "drawing") return;
    if (step >= drawPlan.length) {
      // commit
      void persistAssignments().then(() => setPhase("done"));
      return;
    }
    const team = drawPlan[step];
    setHighlight(team.id);
    const t = setTimeout(() => {
      if (isBracket) {
        const matchIdx = Math.floor(step / 2);
        const side = step % 2 === 0 ? "home" : "away";
        setPairings(prev => prev.map((p, i) => i === matchIdx ? { ...p, [side]: team } as Pairing : p));
      } else {
        setGroupSlots(prev => {
          const next = [...prev];
          next[step] = { ...next[step], team };
          return next;
        });
      }
      setHighlight(null);
      setStep(s => s + 1);
    }, 900);
    return () => clearTimeout(t);
  }, [phase, step, drawPlan, isBracket]);

  // ------- persistence -------
  const persistAssignments = async () => {
    try {
      if (isBracket) {
        const updates: Promise<any>[] = [];
        for (const p of pairings) {
          if (!p.home && !p.away) continue;
          const upd: any = {};
          if (p.home) upd.home_team_id = p.home.id;
          if (p.away) upd.away_team_id = p.away.id;
          updates.push(Promise.resolve(supabase.from("matches").update(upd).eq("id", p.matchId)));
        }
        // also write to slots so summary stays consistent: fetch slots for this phase
        const { data: slotRows } = await supabase.from("slots").select("id, slot_code").eq("tournament_id", tournamentId).eq("phase_id", phaseId);
        const slotMap = new Map((slotRows || []).map(s => [s.slot_code, s.id]));
        // we need slot labels — fetch matches again
        const { data: ms } = await supabase.from("matches").select("id, home_slot_label, away_slot_label").in("id", pairings.map(p => p.matchId));
        for (const m of ms || []) {
          const pair = pairings.find(p => p.matchId === m.id);
          if (!pair) continue;
          if (pair.home && m.home_slot_label && slotMap.has(m.home_slot_label)) {
            updates.push(Promise.resolve(supabase.from("slots").update({ team_id: pair.home.id }).eq("id", slotMap.get(m.home_slot_label)!)));
          }
          if (pair.away && m.away_slot_label && slotMap.has(m.away_slot_label)) {
            updates.push(Promise.resolve(supabase.from("slots").update({ team_id: pair.away.id }).eq("id", slotMap.get(m.away_slot_label)!)));
          }
        }
        await Promise.all(updates);

        // Sync (Terug) legs if any
        const { data: terug } = await supabase
          .from("matches")
          .select("id, group_id, home_team_id, away_team_id, match_name")
          .eq("tournament_id", tournamentId).eq("phase_id", phaseId);
        const terugUpdates: Promise<any>[] = [];
        for (const t of terug || []) {
          if (!t.match_name?.endsWith("(Terug)")) continue;
          const base = t.match_name.replace(/ \(Terug\)$/, "");
          const heen = (terug || []).find((x: any) => x.match_name === `${base} (Heen)` && x.group_id === t.group_id);
          if (!heen) continue;
          const upd: any = {};
          if (heen.home_team_id) upd.away_team_id = heen.home_team_id;
          if (heen.away_team_id) upd.home_team_id = heen.away_team_id;
          if (Object.keys(upd).length > 0) terugUpdates.push(Promise.resolve(supabase.from("matches").update(upd).eq("id", t.id)));
        }
        if (terugUpdates.length) await Promise.all(terugUpdates);
      } else {
        // groups: write slots, group_teams, matches
        const updates: Promise<any>[] = [];
        const groupTeamRows: { group_id: string; team_id: string; tournament_id: string }[] = [];
        for (const gs of groupSlots) {
          if (!gs.team) continue;
          updates.push(Promise.resolve(supabase.from("slots").update({ team_id: gs.team.id }).eq("id", gs.slotId)));
          groupTeamRows.push({ group_id: gs.group_id, team_id: gs.team.id, tournament_id: tournamentId });
          // matches with this slot_code → fill team
          updates.push(Promise.resolve(supabase.from("matches").update({ home_team_id: gs.team.id })
            .match({ tournament_id: tournamentId, phase_id: phaseId, home_slot_label: gs.slot_code, group_id: gs.group_id })));
          updates.push(Promise.resolve(supabase.from("matches").update({ away_team_id: gs.team.id })
            .match({ tournament_id: tournamentId, phase_id: phaseId, away_slot_label: gs.slot_code, group_id: gs.group_id })));
        }
        await Promise.all(updates);
        if (groupTeamRows.length) await supabase.from("group_teams").upsert(groupTeamRows, { onConflict: "group_id,team_id" } as any);
      }
      toast({ title: "Loting voltooid", description: "De indeling is opgeslagen." });
      onComplete?.();
    } catch (e: any) {
      toast({ title: "Loting mislukt", description: e.message || "Onbekende fout", variant: "destructive" });
    }
  };

  // ------- UI -------
  const renderOptions = () => (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {isBracket
          ? "Bracket-loting. Teams worden geloot voor de eerste ronde."
          : "Groepsloting. Teams worden verdeeld over de groepen."}
      </p>
      <div className="flex items-center justify-between rounded-md border border-border p-3">
        <div>
          <Label className="text-sm font-semibold">{isBracket ? "Seeded potten" : "Potten gebruiken"}</Label>
          <p className="text-xs text-muted-foreground">
            {isBracket
              ? "Bovenste helft (alfabetisch) loot tegen onderste helft."
              : "Verdeel teams in potten gelijk aan het aantal groepen."}
          </p>
        </div>
        <Switch checked={usePots} onCheckedChange={setUsePots} />
      </div>
      <div className="flex items-center justify-between rounded-md border border-border p-3">
        <div>
          <Label className="text-sm font-semibold">Zelfde land vermijden</Label>
          <p className="text-xs text-muted-foreground">Teams uit hetzelfde land worden zoveel mogelijk gescheiden.</p>
        </div>
        <Switch checked={avoidCountry} onCheckedChange={setAvoidCountry} />
      </div>
    </div>
  );

  const renderStage = () => {
    const remaining = drawPlan.slice(step);
    return (
      <div className="grid lg:grid-cols-[1fr_2fr] gap-6 h-full">
        {/* Pool */}
        <div className="rounded-xl border border-border bg-card/40 p-4 min-h-[300px]">
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-3">Pot</h3>
          <div className="flex flex-wrap gap-2">
            {remaining.map(t => (
              <div
                key={t.id}
                className={cn(
                  "flex items-center gap-2 rounded-md border border-border bg-background px-2.5 py-1.5 text-sm transition-all",
                  highlight === t.id && "scale-110 ring-2 ring-primary shadow-lg shadow-primary/30"
                )}
              >
                {t.logo_url ? <img src={t.logo_url} className="h-5 w-5 object-contain" alt="" /> : <CountryFlag country={t.country} />}
                <span className="font-medium">{t.name}</span>
              </div>
            ))}
            {remaining.length === 0 && <p className="text-sm text-muted-foreground">Pot is leeg.</p>}
          </div>
        </div>

        {/* Result board */}
        <div className="rounded-xl border border-border bg-card/40 p-4 overflow-auto">
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-3">
            {isBracket ? "Bracket" : "Groepen"}
          </h3>
          {isBracket ? (
            <div className="grid sm:grid-cols-2 gap-3">
              {pairings.map((p, i) => (
                <div key={p.matchId} className="rounded-lg border border-border bg-background p-3">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Wedstrijd {i + 1}</div>
                  <TeamSlot team={p.home} />
                  <div className="text-center text-xs text-muted-foreground my-1">vs</div>
                  <TeamSlot team={p.away} />
                </div>
              ))}
            </div>
          ) : (
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
          )}
        </div>
      </div>
    );
  };

  const body = (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-bold">Live Loting</h2>
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

      {!loading && phase === "ready" && (
        <div className="flex-1 grid lg:grid-cols-2 gap-6">
          {renderOptions()}
          <div className="rounded-xl border border-dashed border-border bg-card/40 p-4 flex flex-col items-center justify-center text-center">
            <Sparkles className="h-12 w-12 text-primary mb-3" />
            <p className="text-sm text-muted-foreground mb-1">{teams.length} teams beschikbaar</p>
            <p className="text-2xl font-bold">
              {isBracket ? `${pairings.length} wedstrijden` : `${groupNames.length} groepen, ${groupSlots.length} plaatsen`}
            </p>
            {((isBracket && pairings.length === 0) || (!isBracket && groupSlots.length === 0)) && (
              <p className="text-xs text-destructive mt-3">Geen lege plaatsen om in te loten.</p>
            )}
          </div>
        </div>
      )}

      {!loading && (phase === "drawing" || phase === "done") && (
        <div className="flex-1 min-h-0">{renderStage()}</div>
      )}

      <div className="flex justify-end gap-2 mt-4">
        {phase === "ready" && (
          <>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Annuleren</Button>
            <Button
              onClick={() => setPhase("drawing")}
              disabled={(isBracket && pairings.length === 0) || (!isBracket && groupSlots.length === 0)}
            >
              <Play className="h-4 w-4" /> Start loting
            </Button>
          </>
        )}
        {phase === "drawing" && (
          <Button variant="outline" disabled>
            Loting bezig... ({step}/{drawPlan.length})
          </Button>
        )}
        {phase === "done" && (
          <Button onClick={() => onOpenChange(false)}>Sluiten</Button>
        )}
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "p-6 gap-0",
          fullscreen ? "max-w-[100vw] w-screen h-screen sm:rounded-none border-0" : "max-w-5xl h-[85vh]"
        )}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Live Loting</DialogTitle>
          <DialogDescription>Geanimeerde live loting voor deze fase.</DialogDescription>
        </DialogHeader>
        {body}
      </DialogContent>
    </Dialog>
  );
};

// ------- helpers -------
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

// Try to reorder so consecutive pairs (i, i+1) don't share country.
const reorderAvoidCountryBracket = (teams: Team[]): Team[] => {
  for (let attempt = 0; attempt < 30; attempt++) {
    const arr = attempt === 0 ? [...teams] : shuffle(teams);
    let ok = true;
    for (let i = 0; i < arr.length; i += 2) {
      const a = arr[i]; const b = arr[i + 1];
      if (a && b && a.country && b.country && a.country === b.country) { ok = false; break; }
    }
    if (ok) return arr;
  }
  return teams;
};

// Try to reorder so teams from same country don't end up in the same group.
const reorderAvoidCountryGroups = (teams: Team[], slots: { group_id: string }[]): Team[] => {
  for (let attempt = 0; attempt < 40; attempt++) {
    const arr = attempt === 0 ? [...teams] : shuffle(teams);
    const byGroup = new Map<string, Set<string>>();
    let ok = true;
    for (let i = 0; i < Math.min(arr.length, slots.length); i++) {
      const gid = slots[i].group_id;
      const t = arr[i];
      if (!t.country) continue;
      const set = byGroup.get(gid) || new Set<string>();
      if (set.has(t.country)) { ok = false; break; }
      set.add(t.country);
      byGroup.set(gid, set);
    }
    if (ok) return arr;
  }
  return teams;
};

export default LiveDrawDialog;
