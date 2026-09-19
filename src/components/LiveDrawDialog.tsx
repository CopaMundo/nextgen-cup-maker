import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Shuffle, Play, Undo2, RotateCcw, Check } from "lucide-react";
import { computeDraw, generatePotMatchups, type DrawStep, type PotInput, type GroupInput, type TeamMeta } from "@/lib/drawEngine";

interface Pot {
  id: string;
  name: string;
  sort_order: number;
  teamIds: string[];
}

interface GroupRow {
  id: string;
  name: string;
  capacity: number;
}

type Tab = "pots" | "rules" | "matchups" | "draw";

const LiveDrawDialog = ({
  open,
  onOpenChange,
  tournamentId,
  phaseId,
  categoryId,
  phaseMatchType,
  onApplied,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tournamentId: string;
  phaseId: string;
  categoryId?: string | null;
  phaseMatchType?: string;
  onApplied?: () => void;
}) => {
  const isRounds = phaseMatchType === "rounds";
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>("pots");
  const [loading, setLoading] = useState(false);
  const [pots, setPots] = useState<Pot[]>([]);
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [teams, setTeams] = useState<TeamMeta[]>([]);
  const [mode, setMode] = useState<"one_per_pot" | "free">("one_per_pot");
  const [separateSameCountry, setSeparateSameCountry] = useState(false);
  const [newPotName, setNewPotName] = useState("");
  const [potCount, setPotCount] = useState(4);
  const [potMatrix, setPotMatrix] = useState<Record<string, number>>({});

  const [steps, setSteps] = useState<DrawStep[] | null>(null);
  const [revealed, setRevealed] = useState(0);
  const [applying, setApplying] = useState(false);
  const [justRevealed, setJustRevealed] = useState<string | null>(null);

  const teamById = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);
  const assignedTeamIds = useMemo(
    () => new Set(pots.flatMap((p) => p.teamIds)),
    [pots]
  );
  const unassignedTeams = useMemo(
    () => teams.filter((t) => !assignedTeamIds.has(t.id)),
    [teams, assignedTeamIds]
  );

  /** Pot-tegen-pot: hoeveel keer speelt pot A tegen pot B (standaard 1 tussen verschillende potten). */
  const matrixKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);
  const matrixValue = (a: string, b: string) => potMatrix[matrixKey(a, b)] ?? (a === b ? 0 : 1);
  const setMatrixValue = (a: string, b: string, value: number) =>
    setPotMatrix((prev) => ({ ...prev, [matrixKey(a, b)]: value }));

  const effectiveMatrix = useMemo(() => {
    const result: Record<string, number> = {};
    for (let i = 0; i < pots.length; i++) {
      for (let j = i; j < pots.length; j++) {
        result[`${pots[i].id}|${pots[j].id}`] = matrixValue(pots[i].id, pots[j].id);
      }
    }
    return result;
  }, [pots, potMatrix]);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [{ data: groupRows }, { data: slotRows }, { data: teamRows }, { data: potRows }, { data: potTeamRows }] =
        await Promise.all([
          supabase.from("groups").select("id, name, sort_order").eq("phase_id", phaseId).order("sort_order"),
          supabase.from("slots").select("id, group_id, team_id, slot_code, sort_order").eq("phase_id", phaseId).order("sort_order"),
          supabase.from("teams").select("id, name, country, category_id").eq("tournament_id", tournamentId).order("name"),
          supabase.from("draw_pots").select("id, name, sort_order").eq("phase_id", phaseId).order("sort_order"),
          supabase.from("draw_pot_teams").select("pot_id, team_id, sort_order").eq("tournament_id", tournamentId).order("sort_order"),
        ]);

      const emptyByGroup = new Map<string, number>();
      for (const slot of slotRows || []) {
        if (!slot.group_id || slot.team_id) continue;
        emptyByGroup.set(slot.group_id, (emptyByGroup.get(slot.group_id) || 0) + 1);
      }
      setGroups(
        (groupRows || []).map((g) => ({ id: g.id, name: g.name, capacity: emptyByGroup.get(g.id) || 0 }))
      );

      const occupied = new Set((slotRows || []).filter((s) => s.team_id).map((s) => s.team_id as string));
      const filtered = (teamRows || [])
        .filter((t) => (categoryId ? t.category_id === categoryId : true))
        .filter((t) => !occupied.has(t.id));
      setTeams(filtered.map((t) => ({ id: t.id, name: t.name, country: t.country })));

      const potIds = new Set((potRows || []).map((p) => p.id));
      setPots(
        (potRows || []).map((p) => ({
          id: p.id,
          name: p.name,
          sort_order: p.sort_order,
          teamIds: (potTeamRows || []).filter((pt) => pt.pot_id === p.id && potIds.has(pt.pot_id)).map((pt) => pt.team_id),
        }))
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    setTab("pots");
    setSteps(null);
    setRevealed(0);
    loadAll();
  }, [open, phaseId, categoryId]);

  const addPot = async (name?: string) => {
    const potName = (name ?? newPotName).trim() || `Pot ${pots.length + 1}`;
    const { data, error } = await supabase
      .from("draw_pots")
      .insert({ tournament_id: tournamentId, phase_id: phaseId, category_id: categoryId ?? null, name: potName, sort_order: pots.length })
      .select("id, name, sort_order")
      .single();
    if (error || !data) {
      toast({ title: "Pot toevoegen mislukt", description: error?.message, variant: "destructive" });
      return null;
    }
    setNewPotName("");
    setPots((prev) => [...prev, { id: data.id, name: data.name, sort_order: data.sort_order, teamIds: [] }]);
    return data.id;
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

  const addTeamToPot = async (potId: string, teamId: string) => {
    const pot = pots.find((p) => p.id === potId);
    if (!pot) return;
    const { error } = await supabase.from("draw_pot_teams").insert({
      pot_id: potId,
      tournament_id: tournamentId,
      team_id: teamId,
      sort_order: pot.teamIds.length,
    });
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

  /** Maakt `potCount` potten aan en verdeelt alle deelnemers er gelijk over. */
  const autoDistribute = async () => {
    setLoading(true);
    try {
      // Bestaande potten en verdeling wissen
      for (const pot of pots) {
        await supabase.from("draw_pot_teams").delete().eq("pot_id", pot.id);
        await supabase.from("draw_pots").delete().eq("id", pot.id);
      }
      const count = Math.max(1, Math.min(potCount, teams.length || 1));
      const created: Pot[] = [];
      for (let i = 0; i < count; i++) {
        const { data } = await supabase
          .from("draw_pots")
          .insert({ tournament_id: tournamentId, phase_id: phaseId, category_id: categoryId ?? null, name: `Pot ${i + 1}`, sort_order: i })
          .select("id, name, sort_order")
          .single();
        if (data) created.push({ id: data.id, name: data.name, sort_order: data.sort_order, teamIds: [] });
      }
      const shuffled = [...teams].sort(() => Math.random() - 0.5);
      const perPot = Math.ceil(shuffled.length / created.length);
      const inserts: { pot_id: string; tournament_id: string; team_id: string; sort_order: number }[] = [];
      created.forEach((pot, index) => {
        const slice = shuffled.slice(index * perPot, (index + 1) * perPot);
        pot.teamIds = slice.map((t) => t.id);
        slice.forEach((t, i) => inserts.push({ pot_id: pot.id, tournament_id: tournamentId, team_id: t.id, sort_order: i }));
      });
      if (inserts.length) await supabase.from("draw_pot_teams").insert(inserts);
      setPots(created);
      toast({ title: `${created.length} potten aangemaakt` });
    } finally {
      setLoading(false);
    }
  };

  const startDraw = () => {
    const potInputs: PotInput[] = pots.map((p) => ({ id: p.id, name: p.name, teamIds: p.teamIds }));
    const groupInputs: GroupInput[] = groups.map((g) => ({ id: g.id, name: g.name, capacity: g.capacity }));
    const result = computeDraw(potInputs, groupInputs, { mode, separateSameCountry }, teams);
    if (!result) {
      toast({
        title: "Loting niet mogelijk",
        description: "Met deze potten, groepen en restricties is er geen geldige verdeling. Pas de potten of regels aan.",
        variant: "destructive",
      });
      return;
    }
    setSteps(result);
    setRevealed(0);
    setTab("draw");
  };

  const revealNext = () => {
    if (!steps || revealed >= steps.length) return;
    setJustRevealed(steps[revealed].teamId);
    setRevealed((r) => r + 1);
    window.setTimeout(() => setJustRevealed(null), 700);
  };

  const revealAll = () => {
    if (!steps) return;
    setRevealed(steps.length);
  };

  const applyDraw = async () => {
    if (!steps) return;
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
        const list = freeSlots.get(slot.group_id) || [];
        list.push({ id: slot.id, slot_code: slot.slot_code });
        freeSlots.set(slot.group_id, list);
      }

      const updates: { slotId: string; teamId: string; slotCode: string; groupId: string }[] = [];
      for (const step of steps) {
        const list = freeSlots.get(step.groupId);
        const slot = list?.shift();
        if (!slot) continue;
        updates.push({ slotId: slot.id, teamId: step.teamId, slotCode: slot.slot_code, groupId: step.groupId });
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

      const groupTeams = updates.map((u) => ({ group_id: u.groupId, team_id: u.teamId, tournament_id: tournamentId }));
      if (groupTeams.length) await supabase.from("group_teams").insert(groupTeams);

      let drawnMatches = 0;
      if (isRounds) {
        const membersByGroup = new Map<string, { teamId: string; slotCode: string }[]>();
        for (const u of updates) {
          const list = membersByGroup.get(u.groupId) || [];
          list.push({ teamId: u.teamId, slotCode: u.slotCode });
          membersByGroup.set(u.groupId, list);
        }

        for (const [groupId, members] of membersByGroup) {
          const memberIds = new Set(members.map((m) => m.teamId));
          const slotByTeam = new Map(members.map((m) => [m.teamId, m.slotCode]));
          const groupPots = pots
            .map((p) => ({ id: p.id, name: p.name, teamIds: p.teamIds.filter((id) => memberIds.has(id)) }))
            .filter((p) => p.teamIds.length > 0);
          const pairings = generatePotMatchups(groupPots, effectiveMatrix);
          if (pairings.length === 0) continue;

          await supabase
            .from("matches")
            .delete()
            .eq("tournament_id", tournamentId)
            .eq("phase_id", phaseId)
            .eq("group_id", groupId);

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

      toast({
        title: `${updates.length} deelnemers ingedeeld via loting`,
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

  const totalCapacity = groups.reduce((sum, g) => sum + g.capacity, 0);
  const potTeamTotal = pots.reduce((sum, p) => sum + p.teamIds.length, 0);

  const groupResult = (groupId: string) =>
    (steps || []).slice(0, revealed).filter((s) => s.groupId === groupId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Loting</DialogTitle>
        </DialogHeader>

        <div className="flex gap-1 rounded-lg border border-border p-1">
          {([
            { key: "pots", label: "POTTEN" },
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

        <div className="max-h-[60vh] overflow-y-auto pr-1">
          {loading && <div className="flex justify-center py-8"><div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>}

          {!loading && tab === "pots" && (
            <div className="space-y-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <div className="flex-1">
                  <Label className="text-xs">Nieuwe pot</Label>
                  <Input value={newPotName} onChange={(e) => setNewPotName(e.target.value)} placeholder={`Pot ${pots.length + 1}`} />
                </div>
                <Button variant="outline" size="sm" onClick={() => addPot()}>
                  <Plus className="h-3.5 w-3.5" /> Pot toevoegen
                </Button>
              </div>

              <div className="flex flex-col gap-2 rounded-lg border border-border p-3 sm:flex-row sm:items-end">
                <div className="w-full sm:w-40">
                  <Label className="text-xs">Aantal potten</Label>
                  <Select value={String(potCount)} onValueChange={(v) => setPotCount(Number(v))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 8 }, (_, i) => i + 1).map((n) => (
                        <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button variant="outline" size="sm" onClick={autoDistribute}>
                  <Shuffle className="h-3.5 w-3.5" /> Automatisch verdelen
                </Button>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {pots.map((pot) => (
                  <div key={pot.id} className="rounded-lg border border-border p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-bold">{pot.name}</h4>
                      <button onClick={() => deletePot(pot.id)} className="text-muted-foreground hover:text-destructive" aria-label={`${pot.name} verwijderen`}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="space-y-1">
                      {pot.teamIds.map((id) => (
                        <div key={id} className="flex items-center justify-between rounded-md bg-muted/50 px-2 py-1 text-xs">
                          <span>{teamById.get(id)?.name || "?"}</span>
                          <button onClick={() => removeTeamFromPot(pot.id, id)} className="text-muted-foreground hover:text-destructive">
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                      {pot.teamIds.length === 0 && <p className="text-xs text-muted-foreground">Nog geen deelnemers.</p>}
                    </div>
                    {unassignedTeams.length > 0 && (
                      <Select value="" onValueChange={(v) => addTeamToPot(pot.id, v)}>
                        <SelectTrigger><SelectValue placeholder="Deelnemer toevoegen" /></SelectTrigger>
                        <SelectContent>
                          {unassignedTeams.map((t) => (
                            <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                ))}
              </div>

              <p className="text-xs text-muted-foreground">
                {potTeamTotal} van {teams.length} deelnemers in potten · {totalCapacity} vrije plaatsen in {groups.length} groepen
              </p>
            </div>
          )}

          {!loading && tab === "rules" && (
            <div className="space-y-4">
              <div>
                <Label className="text-xs">Verdeling</Label>
                <Select value={mode} onValueChange={(v) => setMode(v as "one_per_pot" | "free")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="one_per_pot">Eén deelnemer per pot per groep</SelectItem>
                    <SelectItem value="free">Vrije verdeling</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border p-3">
                <div>
                  <p className="text-sm font-medium">Zelfde land scheiden</p>
                  <p className="text-xs text-muted-foreground">Deelnemers met hetzelfde land komen niet in dezelfde groep.</p>
                </div>
                <Switch checked={separateSameCountry} onCheckedChange={setSeparateSameCountry} />
              </div>
            </div>
          )}

          {!loading && tab === "matchups" && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Kies hoeveel keer elke pot tegen een andere pot speelt. De wedstrijden worden na de loting over de
                speelrondes verdeeld, waarbij een deelnemer nooit twee keer in dezelfde speelronde staat.
              </p>
              {pots.length < 1 && <p className="text-xs text-muted-foreground">Maak eerst potten aan.</p>}
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                {pots.flatMap((a, i) =>
                  pots.slice(i).map((b) => (
                    <div
                      key={`${a.id}|${b.id}`}
                      className="flex items-center justify-between gap-3 rounded-lg border border-border p-3"
                    >
                      <span className="text-sm font-medium">
                        {a.id === b.id ? `${a.name} onderling` : `${a.name} vs ${b.name}`}
                      </span>
                      <div className="w-24">
                        <Select
                          value={String(matrixValue(a.id, b.id))}
                          onValueChange={(v) => setMatrixValue(a.id, b.id, Number(v))}
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {[0, 1, 2, 3, 4].map((n) => (
                              <SelectItem key={n} value={String(n)}>{n}x</SelectItem>
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
              {!steps && (
                <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                  Start de loting om de deelnemers uit de potten over de groepen te verdelen.
                </div>
              )}

              {steps && (
                <>
                  <div className="rounded-lg border border-primary/40 bg-primary/5 p-4 text-center">
                    {revealed > 0 ? (
                      <>
                        <p className="text-xs uppercase text-muted-foreground">{steps[revealed - 1].potName}</p>
                        <p className="text-xl font-bold">{teamById.get(steps[revealed - 1].teamId)?.name}</p>
                        <p className="text-sm text-primary">naar {steps[revealed - 1].groupName}</p>
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground">Klaar om te trekken ({steps.length} deelnemers).</p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                    {groups.map((g) => (
                      <div key={g.id} className="rounded-lg border border-border p-3">
                        <h4 className="mb-2 text-sm font-bold">{g.name}</h4>
                        <div className="space-y-1">
                          {groupResult(g.id).map((s) => (
                            <div
                              key={s.teamId}
                              className={`rounded-md px-2 py-1 text-xs transition-colors ${
                                justRevealed === s.teamId ? "bg-primary text-primary-foreground" : "bg-muted/50"
                              }`}
                            >
                              {teamById.get(s.teamId)?.name}
                            </div>
                          ))}
                          {groupResult(g.id).length === 0 && <p className="text-xs text-muted-foreground">—</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          {tab !== "draw" && (
            <Button onClick={startDraw} disabled={potTeamTotal === 0 || groups.length === 0}>
              <Play className="h-3.5 w-3.5" /> Loting starten
            </Button>
          )}
          {tab === "draw" && steps && (
            <>
              <Button variant="outline" size="sm" onClick={() => setRevealed((r) => Math.max(0, r - 1))} disabled={revealed === 0}>
                <Undo2 className="h-3.5 w-3.5" /> Ongedaan maken
              </Button>
              <Button variant="outline" size="sm" onClick={startDraw}>
                <RotateCcw className="h-3.5 w-3.5" /> Opnieuw loten
              </Button>
              {revealed < steps.length ? (
                <>
                  <Button variant="outline" size="sm" onClick={revealAll}>Alles tonen</Button>
                  <Button size="sm" onClick={revealNext}>Volgende trekking</Button>
                </>
              ) : (
                <Button size="sm" onClick={applyDraw} disabled={applying}>
                  <Check className="h-3.5 w-3.5" /> {applying ? "Bezig..." : "Indeling toepassen"}
                </Button>
              )}
            </>
          )}
          {tab === "draw" && !steps && (
            <Button onClick={startDraw} disabled={potTeamTotal === 0 || groups.length === 0}>
              <Play className="h-3.5 w-3.5" /> Loting starten
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default LiveDrawDialog;
