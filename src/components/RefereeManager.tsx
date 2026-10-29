import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TimePicker } from "@/components/ui/timepicker";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useDialogFocus } from "@/hooks/useDialogFocus";
import { Copy, Plus, X } from "lucide-react";
import RefereeOverview from "@/components/RefereeOverview";
import WhistleIcon from "@/components/icons/WhistleIcon";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  RefereeConfig, RefereeAvailability, ALL_ROLES, parseReferees, serializeReferees, buildFieldsByLocation,
  getLocationFieldMode, setLocationFieldMode, toggleFieldInAllowed, LocationFieldMode,
} from "@/lib/refereeConfig";
import { expandMatchDays, listIsoDatesInRange, normalizeIsoDates, formatIsoDateForLocale, MatchDayEntry } from "@/lib/dateUtils";
import { parseFieldEntries, stripLocationPrefix } from "@/lib/fieldLocations";

type DayMode = "all" | "times" | "none";
type ExcludeMode = "none" | "select";
type RoleMode = "all" | "select";
const WHOLE_DAY = { from: "00:00", to: "23:59" };

interface Props {
  tournamentId: string;
  categoryId?: string | null;
  /** "Teams" of "Spelers" — bepaalt de uitsluitingskeuze en -benaming */
  teamsLabel?: string;
}

const RefereeManager = ({ tournamentId, categoryId, teamsLabel = "Teams" }: Props) => {
  const isPlayers = teamsLabel === "Spelers";
  const [referees, setReferees] = useState<RefereeConfig[]>([]);
  const [fieldNames, setFieldNames] = useState<string[]>([]);
  const [locationNames, setLocationNames] = useState<string[]>([]);
  const [fieldOnlyNames, setFieldOnlyNames] = useState<string[]>([]);
  /** Velden per locatie (via het location-veld), in toernooivolgorde. */
  const [fieldsByLocation, setFieldsByLocation] = useState<Record<string, string[]>>({});
  const [teams, setTeams] = useState<{ id: string; name: string }[]>([]);
  const [days, setDays] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newRef, setNewRef] = useState("");
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [draft, setDraft] = useState<RefereeConfig | null>(null);
  const [locModes, setLocModes] = useState<Record<string, LocationFieldMode>>({});
  const [excludeMode, setExcludeMode] = useState<ExcludeMode>("none");
  const [roleMode, setRoleMode] = useState<RoleMode>("all");
  const [deleteIdx, setDeleteIdx] = useState<number | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [otherCategories, setOtherCategories] = useState<{ id: string; name: string; referees: RefereeConfig[] }[]>([]);
  const addDialogRef = useDialogFocus(showAdd);
  const editDialogRef = useDialogFocus(editIdx !== null);
  const importDialogRef = useDialogFocus(showImport);

  const [hasOtherDivisions, setHasOtherDivisions] = useState(false);
  useEffect(() => {
    if (!categoryId) { setHasOtherDivisions(false); return; }
    supabase.from("tournament_categories").select("id", { count: "exact", head: true })
      .eq("tournament_id", tournamentId).neq("id", categoryId)
      .then(({ count }) => setHasOtherDivisions((count ?? 0) > 0));
  }, [tournamentId, categoryId]);

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tournamentId, categoryId]);

  const fetchAll = async () => {
    setLoading(true);

    const [tRes, locRes, teamRes, catRes] = await Promise.all([
      supabase.from("tournaments").select("referees, fields, match_days, start_date, end_date").eq("id", tournamentId).single(),
      supabase.from("tournament_locations").select("name").eq("tournament_id", tournamentId).order("sort_order").order("created_at"),
      (categoryId
        ? supabase.from("teams").select("id, name").eq("tournament_id", tournamentId).eq("category_id", categoryId).order("name")
        : supabase.from("teams").select("id, name").eq("tournament_id", tournamentId).order("name")),
      categoryId
        ? supabase.from("tournament_categories").select("referees, fields").eq("id", categoryId).single()
        : Promise.resolve({ data: null } as any),
    ]);

    const source: any = categoryId ? catRes.data : tRes.data;
    setReferees(parseReferees(source?.referees));

    const rawFields = (categoryId ? catRes.data?.fields : tRes.data?.fields) as any;
    const entries = parseFieldEntries(rawFields);
    const fieldsList = entries.map(e => e.name);
    const uniqueLocations = Array.from(new Set((locRes.data || []).map((l: any) => l.name).filter(Boolean)));
    setLocationNames(uniqueLocations);
    setFieldOnlyNames(Array.from(new Set(fieldsList)));
    setFieldNames(Array.from(new Set([...uniqueLocations, ...fieldsList])));
    // Elk veld hoort bij zijn eigen locatie (location-veld); velden zonder geldige locatie vallen onder de eerste locatie.
    setFieldsByLocation(buildFieldsByLocation(entries, uniqueLocations));

    setTeams((teamRes.data || []) as any);

    const t: any = tRes.data;
    const explicit = expandMatchDays(((t?.match_days as MatchDayEntry[]) || []));
    const period = t?.start_date && t?.end_date ? listIsoDatesInRange(t.start_date, t.end_date) : normalizeIsoDates([t?.start_date, t?.end_date]);
    setDays(explicit.length > 0 ? explicit : period);

    setLoading(false);
  };

  const saveReferees = async (updated: RefereeConfig[]) => {
    const payload = serializeReferees(updated) as any;
    if (categoryId) {
      await supabase.from("tournament_categories").update({ referees: payload }).eq("id", categoryId);
    } else {
      await supabase.from("tournaments").update({ referees: payload }).eq("id", tournamentId);
    }
    setReferees(updated);
  };

  const addReferee = async () => {
    if (!newRef.trim()) return;
    await saveReferees([
      ...referees,
      { name: newRef.trim(), allowedFields: null, availability: null, maxMatches: null, excludedTeams: [], roles: null },
    ]);
    setNewRef("");
    setShowAdd(false);
  };

  const openEdit = (i: number) => {
    const ref: RefereeConfig = i === -1
      ? { name: "", allowedFields: null, availability: null, maxMatches: null, excludedTeams: [], excludedKind: "teams", roles: null }
      : JSON.parse(JSON.stringify(referees[i]));
    setEditIdx(i);
    setDraft(ref);
    const modes: Record<string, LocationFieldMode> = {};
    locationNames.forEach(loc => {
      modes[loc] = getLocationFieldMode(loc, ref.allowedFields, fieldsByLocation[loc] ?? []);
    });
    setLocModes(modes);
    setExcludeMode(ref.excludedTeams.length > 0 ? "select" : "none");
    setRoleMode(ref.roles === null ? "all" : "select");
  };

  const closeEdit = () => { setEditIdx(null); setDraft(null); };

  const saveEdit = async () => {
    if (editIdx === null || !draft || !draft.name.trim()) return;
    if (editIdx === -1) {
      await saveReferees([...referees, { ...draft, name: draft.name.trim() }]);
      closeEdit();
      return;
    }
    const oldName = referees[editIdx].name;
    const newName = draft.name.trim();
    if (oldName !== newName) {
      const { data: matchesWithRef } = await supabase
        .from("matches").select("id").eq("tournament_id", tournamentId).eq("referee", oldName);
      for (const m of matchesWithRef || []) {
        await supabase.from("matches").update({ referee: newName }).eq("id", m.id);
      }
    }
    await saveReferees(referees.map((r, i) => (i === editIdx ? { ...draft, name: newName } : r)));
    closeEdit();
  };

  const confirmRemoveReferee = async () => {
    if (deleteIdx === null) return;
    await saveReferees(referees.filter((_, i) => i !== deleteIdx));
    setDeleteIdx(null);
  };

  const openImport = async () => {
    const { data: cats } = await supabase
      .from("tournament_categories")
      .select("id, name, referees")
      .eq("tournament_id", tournamentId)
      .neq("id", categoryId || "")
      .order("sort_order");
    setOtherCategories(
      (cats || []).map(c => ({ id: c.id, name: c.name, referees: parseReferees(c.referees) })).filter(c => c.referees.length > 0)
    );
    setShowImport(true);
  };

  const importReferee = async (ref: RefereeConfig) => {
    if (referees.some(r => r.name === ref.name)) return;
    await saveReferees([
      ...referees,
      { name: ref.name, allowedFields: null, availability: null, maxMatches: null, excludedTeams: [], roles: null },
    ]);
  };


  // ==== draft helpers ====
  /** Bouw allowedFields op basis van de gekozen modus per locatie. */
  const composeAllowed = (
    modes: Record<string, LocationFieldMode>,
    current: string[] | null
  ): string[] | null => {
    if (locationNames.length === 0) return current;
    if (locationNames.every(loc => (modes[loc] ?? "all") === "all")) return null;
    const set = new Set<string>();
    locationNames.forEach(loc => {
      const mode = modes[loc] ?? "all";
      if (mode === "none") return;
      // Alleen de velden van deze locatie; eerder gekozen velden van deze locatie blijven behouden.
      const locFields = fieldsByLocation[loc] ?? [];
      const previouslySelected = (current ?? locFields).filter(f => locFields.includes(f));
      set.add(loc);
      if (mode === "all") locFields.forEach(f => set.add(f));
      else previouslySelected.forEach(f => set.add(f));
    });
    return Array.from(set);
  };

  const applyLocationFieldMode = (location: string, mode: LocationFieldMode) => {
    if (!draft) return;
    const nextModes = { ...locModes, [location]: mode };
    setLocModes(nextModes);
    setDraft({ ...draft, allowedFields: composeAllowed(nextModes, draft.allowedFields) });
  };
  const toggleField = (name: string) => {
    if (!draft) return;
    setDraft({
      ...draft,
      allowedFields: toggleFieldInAllowed(name, draft.allowedFields, fieldNames),
    });
  };

  const isWhole = (w: RefereeAvailability) => w.from === WHOLE_DAY.from && w.to === WHOLE_DAY.to;
  const dayWindows = (date: string): RefereeAvailability[] =>
    draft?.availability ? draft.availability.filter(a => a.date === date) : [{ date, ...WHOLE_DAY }];
  const dayMode = (date: string): DayMode => {
    if (!draft?.availability) return "all";
    const wins = dayWindows(date);
    if (wins.length === 0) return "none";
    return wins.length === 1 && isWhole(wins[0]) ? "all" : "times";
  };
  /** Vervang alle tijdvakken van één dag en normaliseer (alles hele dag zonder locatie = null). */
  const setDayWindows = (date: string, wins: RefereeAvailability[]) => {
    if (!draft) return;
    const base: RefereeAvailability[] = draft.availability ?? days.map(d => ({ date: d, ...WHOLE_DAY }));
    const next = [...base.filter(a => a.date !== date), ...wins.map(w => ({ ...w, date }))];
    next.sort((x, y) => x.date.localeCompare(y.date) || x.from.localeCompare(y.from));
    const allWholeDay = days.every(d => {
      const ws = next.filter(a => a.date === d);
      return ws.length === 1 && isWhole(ws[0]) && !ws[0].location;
    }) && next.length === days.length;
    setDraft({ ...draft, availability: allWholeDay ? null : next });
  };
  const applyDayMode = (date: string, mode: DayMode) => {
    const prev = dayWindows(date);
    const locPart = prev[0]?.location ? { location: prev[0].location } : {};
    if (mode === "none") return setDayWindows(date, []);
    if (mode === "all") return setDayWindows(date, [{ date, ...WHOLE_DAY, ...locPart }]);
    const timed = prev.filter(w => !isWhole(w));
    setDayWindows(date, timed.length > 0 ? timed : [{ date, from: "09:00", to: "18:00", ...locPart }]);
  };
  const updateWindow = (date: string, idx: number, patch: Partial<RefereeAvailability>) => {
    const wins = dayWindows(date).map((w, i) => {
      if (i !== idx) return w;
      const merged = { ...w, ...patch };
      if (!merged.location) { const { location: _l, ...rest } = merged; return rest; }
      return merged;
    });
    setDayWindows(date, wins);
  };
  const addWindow = (date: string) => {
    const wins = dayWindows(date);
    const last = wins[wins.length - 1];
    const from = last && last.to < "23:00" ? last.to : "09:00";
    const to = from < "22:00" ? `${String(Math.min(23, Number(from.slice(0, 2)) + 2)).padStart(2, "0")}:${from.slice(3, 5)}` : "23:59";
    setDayWindows(date, [...wins, { date, from, to }]);
  };
  const removeWindow = (date: string, idx: number) => {
    setDayWindows(date, dayWindows(date).filter((_, i) => i !== idx));
  };
  const dayLocationChoices = (): string[] => {
    if (!draft || locationNames.length <= 1) return [];
    const active = locationNames.filter(loc => getLocationFieldMode(loc, draft.allowedFields, fieldsByLocation[loc] ?? []) !== "none");
    return active.length > 0 ? active : locationNames;
  };

  const applyExcludeMode = (mode: ExcludeMode) => {
    if (!draft) return;
    setExcludeMode(mode);
    if (mode === "none") setDraft({ ...draft, excludedTeams: [] });
    else setDraft({ ...draft, excludedKind: isPlayers ? "players" : "teams" });
  };
  const toggleTeam = (id: string) => {
    if (!draft) return;
    const has = draft.excludedTeams.includes(id);
    setDraft({ ...draft, excludedTeams: has ? draft.excludedTeams.filter(t => t !== id) : [...draft.excludedTeams, id] });
  };

  const applyRoleMode = (mode: RoleMode) => {
    if (!draft) return;
    setRoleMode(mode);
    if (mode === "all") setDraft({ ...draft, roles: null });
    else setDraft({ ...draft, roles: draft.roles && draft.roles.length > 0 ? draft.roles : [...ALL_ROLES] });
  };
  const toggleRole = (role: number) => {
    if (!draft) return;
    const current = draft.roles ?? [...ALL_ROLES];
    const next = current.includes(role) ? current.filter(r => r !== role) : [...current, role];
    setDraft({ ...draft, roles: next });
  };

  const teamName = (id: string) => teams.find(t => t.id === id)?.name || "?";

  const locationValue = (r: RefereeConfig, loc: string): string => {
    const locFields = fieldsByLocation[loc] ?? [];
    const mode = getLocationFieldMode(loc, r.allowedFields, locFields);
    const sel = locFields.filter(f => r.allowedFields?.includes(f)).map(f => stripLocationPrefix(f, loc));
    return mode === "none" ? "Geen"
      : mode === "all" || locFields.length === 0 ? "Alle velden"
      : sel.length > 0 ? sel.join(", ") : "Geen";
  };

  // Regel voor op het kaartje: alleen actieve locaties in toernooivolgorde; als alles op "Geen" staat toont het "Geen".
  const locationLines = (r: RefereeConfig): string[] => {
    if (locationNames.length === 0) {
      if (fieldOnlyNames.length === 0) return r.allowedFields === null ? ["Alle velden"] : r.allowedFields.length > 0 ? r.allowedFields : ["Geen"];
      if (r.allowedFields === null) return ["Alle velden"];
      const sel = fieldOnlyNames.filter(f => r.allowedFields?.includes(f));
      if (sel.length === 0) return ["Geen"];
      if (sel.length === fieldOnlyNames.length) return ["Alle velden"];
      return sel;
    }
    if (r.allowedFields === null) return ["Alle velden"];
    const active = locationNames
      .map(loc => ({ loc, value: locationValue(r, loc) }))
      .filter(entry => entry.value !== "Geen");
    if (active.length === 0) return ["Geen"];
    // Bij één actieve locatie enkel de veldnamen tonen, zonder locatievoorvoegsel.
    return active.length === 1 ? [active[0].value] : active.map(entry => `${entry.loc}: ${entry.value}`);
  };

  // Volledig overzicht voor de pop-up: alle locaties in toernooivolgorde, de locaties met "Geen" onderaan.
  const locationDetails = (r: RefereeConfig): string[] => {
    if (locationNames.length === 0 || r.allowedFields === null) return locationLines(r);
    const entries = locationNames.map(loc => ({ loc, value: locationValue(r, loc) }));
    const active = entries.filter(entry => entry.value !== "Geen");
    const none = entries.filter(entry => entry.value === "Geen");
    const activeLines = active.length === 1 ? [active[0].value] : active.map(entry => `${entry.loc}: ${entry.value}`);
    return [...activeLines, ...none.map(entry => `${entry.loc}: Geen`)];
  };

  const availabilityLines = (r: RefereeConfig): string[] => {
    const fullLabel = days.length <= 1 ? "Hele dag" : "Alle dagen";
    if (!r.availability) return [fullLabel];
    if (days.length > 0 && days.every(d => r.availability!.some(a => a.date === d && a.from === WHOLE_DAY.from && a.to === WHOLE_DAY.to && !a.location))) return [fullLabel];
    if (days.length === 0) return r.availability.length > 0
      ? r.availability.map(win => `${formatIsoDateForLocale(win.date)}: ${win.from}–${win.to}`)
      : ["Niet beschikbaar"];
    const winText = (win: RefereeAvailability) => {
      const locSuffix = win.location && locationNames.length > 1 ? ` (${win.location})` : "";
      return win.from === WHOLE_DAY.from && win.to === WHOLE_DAY.to ? `Hele dag${locSuffix}` : `${win.from}–${win.to}${locSuffix}`;
    };
    return days.map(d => {
      const label = formatIsoDateForLocale(d);
      const wins = r.availability!.filter(a => a.date === d).sort((x, y) => x.from.localeCompare(y.from));
      if (wins.length === 0) return `${label}: Niet beschikbaar`;
      return `${label}: ${wins.map(winText).join(", ")}`;
    });
  };

  const excludedLines = (r: RefereeConfig): string[] =>
    r.excludedTeams.map(teamName);

  const roleLine = (r: RefereeConfig): string => {
    if (!r.roles || r.roles.length === 0 || r.roles.length >= ALL_ROLES.length) return "Alle rollen";
    const sorted = [...r.roles].sort((a, b) => a - b);
    const parts: string[] = [];
    let start = sorted[0];
    let prev = sorted[0];
    for (let i = 1; i <= sorted.length; i++) {
      const cur = sorted[i];
      if (cur === prev + 1) { prev = cur; continue; }
      parts.push(start === prev ? `${start}` : `${start}-${prev}`);
      start = cur;
      prev = cur;
    }
    return parts.join(", ");
  };

  if (loading) return <div className="flex justify-center py-8"><div className="h-6 w-6 animate-spin rounded-full border-2 border-foreground border-t-transparent" /></div>;

  return (
    <div className="space-y-4">
      <RefereeOverview
        participantsKind={isPlayers ? "players" : "teams"}
        referees={referees.map(r => ({
          name: r.name,
          locations: locationLines(r),
          locationDetails: locationDetails(r),
          availability: availabilityLines(r),
          role: roleLine(r),
          maxMatches: r.maxMatches,
          excludedTeams: excludedLines(r),
        }))}
        onEdit={openEdit}
        onDelete={setDeleteIdx}
        onAdd={() => openEdit(-1)}
        onImport={categoryId && hasOtherDivisions ? openImport : undefined}
      />

      {/* Add dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent ref={addDialogRef} className="max-w-sm">
          <DialogHeader><DialogTitle>Scheidsrechter toevoegen</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input value={newRef} onChange={(e) => setNewRef(e.target.value)} placeholder="Naam scheidsrechter" onKeyDown={(e) => e.key === "Enter" && addReferee()} />
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="outline" onClick={() => setShowAdd(false)}>Annuleren</Button>
              <Button onClick={addReferee} className="bg-foreground text-background hover:bg-foreground/90">Toevoegen</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={editIdx !== null} onOpenChange={(open) => { if (!open) closeEdit(); }}>
        <DialogContent ref={editDialogRef} className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editIdx === -1 ? "Scheidsrechter toevoegen" : "Scheidsrechter bewerken"}</DialogTitle></DialogHeader>
          {draft && (
            <div className="space-y-5">
              {/* Naam */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wide">Naam</Label>
                <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Naam scheidsrechter" />
              </div>

              {/* Locaties en velden */}
              <div className="space-y-3">
                <Label className="text-sm font-semibold">Locaties en velden</Label>
                {locationNames.length === 0 && fieldOnlyNames.length === 0 && (
                  <p className="text-xs text-muted-foreground">Nog geen locaties of velden ingesteld.</p>
                )}
                {locationNames.length === 0 && fieldOnlyNames.length > 0 && (
                  <div className="space-y-2">
                    <Select
                      value={getLocationFieldMode("", draft.allowedFields, fieldOnlyNames)}
                      onValueChange={(v) => setDraft({ ...draft, allowedFields: v === "all" ? null : v === "none" ? [] : [...fieldOnlyNames] })}
                    >
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Alle velden</SelectItem>
                        <SelectItem value="select">Selecteer velden</SelectItem>
                        <SelectItem value="none">Geen</SelectItem>
                      </SelectContent>
                    </Select>
                    {getLocationFieldMode("", draft.allowedFields, fieldOnlyNames) === "select" && (
                      <div className="grid grid-cols-2 gap-2">
                        {fieldOnlyNames.map(f => (
                          <label key={f} className="flex items-center gap-2 rounded-lg border border-border px-2.5 py-2 text-sm">
                            <Checkbox checked={(draft.allowedFields ?? fieldNames).includes(f)} onCheckedChange={() => toggleField(f)} />
                            <span className="truncate">{f}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {locationNames.length > 0 && (
                  <div className="space-y-3">
                    {locationNames.map(loc => {
                      const locFields = fieldsByLocation[loc] ?? [];
                      const mode = locModes[loc] ?? getLocationFieldMode(loc, draft.allowedFields, locFields);
                      return (
                        <div key={loc} className="space-y-2 rounded-lg border border-border px-3 py-2.5">
                          <p className="text-xs font-medium text-muted-foreground">{loc}</p>
                          <Select value={mode} onValueChange={(v) => applyLocationFieldMode(loc, v as LocationFieldMode)}>
                            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">Alle velden</SelectItem>
                              <SelectItem value="select">Selecteer velden</SelectItem>
                              <SelectItem value="none">Geen</SelectItem>
                            </SelectContent>
                          </Select>
                          {/* Strikt de velden van deze locatie, nooit velden van een andere locatie. */}
                          {mode === "select" && locFields.length > 0 && (
                            <div className="grid grid-cols-2 gap-2">
                              {locFields.map(f => (
                                <label key={f} className="flex items-center gap-2 rounded-lg border border-border px-2.5 py-2 text-sm">
                                  <Checkbox checked={(draft.allowedFields ?? fieldNames).includes(f)} onCheckedChange={() => toggleField(f)} />
                                  <span className="truncate">{stripLocationPrefix(f, loc)}</span>
                                </label>
                              ))}
                            </div>
                          )}
                          {mode === "select" && locFields.length === 0 && (
                            <p className="text-xs text-muted-foreground">Nog geen velden ingesteld.</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Beschikbaarheid */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Beschikbaarheid (dagen en tijden)</Label>
                {days.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Nog geen wedstrijddagen ingesteld.</p>
                ) : (
                  days.map(d => {
                    const mode = dayMode(d);
                    const wins = dayWindows(d);
                    const locChoices = dayLocationChoices();
                    const locSelect = (w: RefereeAvailability, i: number) => (
                      <Select
                        value={w.location && locChoices.includes(w.location) ? w.location : "__all__"}
                        onValueChange={(v) => updateWindow(d, i, { location: v === "__all__" ? null : v })}
                      >
                        <SelectTrigger className="h-8 text-xs" aria-label={`Locatie op ${formatIsoDateForLocale(d)}`}><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__all__">Alle gekozen locaties</SelectItem>
                          {locChoices.map(loc => <SelectItem key={loc} value={loc}>{loc}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    );
                    return (
                      <div key={d} className="space-y-1.5 rounded-lg border border-border px-2.5 py-2">
                        <p className="text-[11px] font-medium text-muted-foreground">{formatIsoDateForLocale(d)}</p>
                        <Select value={mode} onValueChange={(v) => applyDayMode(d, v as DayMode)}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Hele dag</SelectItem>
                            <SelectItem value="times">Selecteer tijden</SelectItem>
                            <SelectItem value="none">Niet beschikbaar</SelectItem>
                          </SelectContent>
                        </Select>
                        {mode === "all" && wins[0] && locChoices.length > 0 && locSelect(wins[0], 0)}
                        {mode === "times" && (
                          <div className="space-y-2">
                            {wins.map((w, i) => (
                              <div key={i} className="space-y-1.5 border-l-2 border-border pl-2">
                                <div className="flex items-center gap-1">
                                  <TimePicker value={w.from} onChange={(v) => updateWindow(d, i, { from: v })} className="h-8 w-[110px] text-xs" />
                                  <span className="text-xs text-muted-foreground">tot</span>
                                  <TimePicker value={w.to} onChange={(v) => updateWindow(d, i, { to: v })} className="h-8 w-[110px] text-xs" />
                                  {wins.length > 1 && (
                                    <Button type="button" variant="ghost" size="icon" className="ml-auto h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => removeWindow(d, i)} aria-label="Tijdvak verwijderen">
                                      <X className="h-3.5 w-3.5" />
                                    </Button>
                                  )}
                                </div>
                                {locChoices.length > 0 && locSelect(w, i)}
                              </div>
                            ))}
                            <Button type="button" variant="outline" size="sm" className="h-7 gap-1 text-xs" onClick={() => addWindow(d)}>
                              <Plus className="h-3.5 w-3.5" /> Tijdvak toevoegen
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {/* Max aantal wedstrijden */}
              <div className="space-y-1.5">
                <Label className="text-sm font-semibold">Max. aantal wedstrijden</Label>
                <Input
                  type="number"
                  min={1}
                  value={draft.maxMatches ?? ""}
                  placeholder="Geen limiet"
                  onChange={(e) => setDraft({ ...draft, maxMatches: e.target.value === "" ? null : Number(e.target.value) })}
                  className="h-9 w-36"
                />
              </div>

              {/* Uitgesloten teams/spelers */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Uitgesloten {isPlayers ? "spelers" : "teams"}</Label>
                <Select value={excludeMode} onValueChange={(v) => applyExcludeMode(v as ExcludeMode)}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Geen</SelectItem>
                    <SelectItem value="select">Selecteer {isPlayers ? "spelers" : "teams"}</SelectItem>
                  </SelectContent>
                </Select>
                {excludeMode !== "none" && (
                  teams.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Nog geen deelnemers toegevoegd.</p>
                  ) : (
                    <div className="grid grid-cols-2 gap-2 max-h-52 overflow-y-auto pr-1">
                      {teams.map(t => (
                        <label key={t.id} className="flex items-center gap-2 rounded-lg border border-border px-2.5 py-2 text-sm">
                          <Checkbox checked={draft.excludedTeams.includes(t.id)} onCheckedChange={() => toggleTeam(t.id)} />
                          <span className="truncate">{t.name}</span>
                        </label>
                      ))}
                    </div>
                  )
                )}
              </div>

              {/* Rollen */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Rol (1-5)</Label>
                <Select value={roleMode} onValueChange={(v) => applyRoleMode(v as RoleMode)}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle rollen</SelectItem>
                    <SelectItem value="select">Selecteer rollen</SelectItem>
                  </SelectContent>
                </Select>
                {roleMode === "select" && (
                  <div className="flex flex-wrap gap-2">
                    {ALL_ROLES.map(role => (
                      <label key={role} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm">
                        <Checkbox checked={(draft.roles ?? ALL_ROLES).includes(role)} onCheckedChange={() => toggleRole(role)} />
                        <span>Rol {role}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <Button variant="outline" onClick={closeEdit}>Annuleren</Button>
                <Button onClick={saveEdit} disabled={!draft.name.trim()} className="bg-foreground text-background hover:bg-foreground/90">{editIdx === -1 ? "Toevoegen" : "Opslaan"}</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>


      {/* Delete confirmation */}
      <AlertDialog open={deleteIdx !== null} onOpenChange={(open) => { if (!open) setDeleteIdx(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Scheidsrechter verwijderen?</AlertDialogTitle>
            <AlertDialogDescription>
              Weet je zeker dat je {deleteIdx !== null ? `"${referees[deleteIdx].name}"` : "deze scheidsrechter"} wilt verwijderen?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRemoveReferee} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Verwijderen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Import from divisions dialog */}
      <Dialog open={showImport} onOpenChange={setShowImport}>
        <DialogContent ref={importDialogRef} className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Scheidsrechter importeren uit andere divisie</DialogTitle></DialogHeader>
          <p className="text-xs text-muted-foreground">Kies per scheidsrechter. Alleen de naam wordt gekopieerd, instellingen niet.</p>
          <div className="space-y-4">
            {otherCategories.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Geen andere divisies met scheidsrechters gevonden.</p>
            ) : (
              otherCategories.map(cat => (
                <div key={cat.id} className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{cat.name}</h4>
                  <div className="grid gap-2">
                    {cat.referees.map((r, i) => {
                      const already = referees.some(existing => existing.name === r.name);
                      return (
                        <button
                          key={`${cat.id}-${r.name}-${i}`}
                          disabled={already}
                          onClick={() => importReferee(r)}
                          className={`flex items-center gap-3 rounded-lg border border-border p-3 text-left transition-colors ${
                            already ? "opacity-50 cursor-not-allowed" : "hover:bg-foreground/5"
                          }`}
                        >
                          <div className="h-8 w-8 rounded-lg bg-secondary flex items-center justify-center text-muted-foreground">
                            <WhistleIcon className="h-4 w-4" />
                          </div>
                          <span className="text-sm font-medium text-foreground">{r.name}</span>
                          {already
                            ? <span className="ml-auto text-xs text-muted-foreground">Al toegevoegd</span>
                            : <Copy className="ml-auto h-3.5 w-3.5 text-muted-foreground" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowImport(false)}>Sluiten</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
};

export default RefereeManager;
