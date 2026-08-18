import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Pencil, Trash2, Download } from "lucide-react";
import WhistleIcon from "@/components/icons/WhistleIcon";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  RefereeConfig, ALL_ROLES, parseReferees, serializeReferees, summarizeRefereeLabeled,
  getLocationFieldMode, setLocationFieldMode, toggleFieldInAllowed, LocationFieldMode,
} from "@/lib/refereeConfig";
import { expandMatchDays, listIsoDatesInRange, normalizeIsoDates, formatIsoDateForLocale, MatchDayEntry } from "@/lib/dateUtils";

type DayMode = "all" | "times" | "none";
type ExcludeMode = "none" | "select";
type RoleMode = "all" | "select";
const WHOLE_DAY = { from: "00:00", to: "23:59" };

interface Props {
  tournamentId: string;
  categoryId?: string | null;
}

const RefereeManager = ({ tournamentId, categoryId }: Props) => {
  const [referees, setReferees] = useState<RefereeConfig[]>([]);
  const [fieldNames, setFieldNames] = useState<string[]>([]);
  const [locationNames, setLocationNames] = useState<string[]>([]);
  const [fieldOnlyNames, setFieldOnlyNames] = useState<string[]>([]);
  const [teams, setTeams] = useState<{ id: string; name: string }[]>([]);
  const [days, setDays] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newRef, setNewRef] = useState("");
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [draft, setDraft] = useState<RefereeConfig | null>(null);
  const [excludeMode, setExcludeMode] = useState<ExcludeMode>("none");
  const [roleMode, setRoleMode] = useState<RoleMode>("all");
  const [deleteIdx, setDeleteIdx] = useState<number | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [otherCategories, setOtherCategories] = useState<{ id: string; name: string; referees: RefereeConfig[] }[]>([]);

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tournamentId, categoryId]);

  const fetchAll = async () => {
    setLoading(true);

    const [tRes, locRes, teamRes, catRes] = await Promise.all([
      supabase.from("tournaments").select("referees, fields, match_days, start_date, end_date").eq("id", tournamentId).single(),
      supabase.from("tournament_locations").select("name").eq("tournament_id", tournamentId),
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
    const fieldsList = Array.isArray(rawFields) ? rawFields.map((f: any) => (typeof f === "string" ? f : f?.name)).filter(Boolean) : [];
    const locations = (locRes.data || []).map((l: any) => l.name).filter(Boolean);
    setLocationNames(Array.from(new Set(locations)));
    setFieldOnlyNames(Array.from(new Set(fieldsList)));
    setFieldNames(Array.from(new Set([...locations, ...fieldsList])));

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
    const ref: RefereeConfig = JSON.parse(JSON.stringify(referees[i]));
    setEditIdx(i);
    setDraft(ref);
    const modes: Record<string, LocationFieldMode> = {};
    locationNames.forEach(loc => {
      modes[loc] = getLocationFieldMode(loc, ref.allowedFields, fieldOnlyNames);
    });
    setLocModes(modes);
    setExcludeMode(ref.excludedTeams.length > 0 ? "select" : "none");
    setRoleMode(ref.roles === null ? "all" : "select");
  };

  const closeEdit = () => { setEditIdx(null); setDraft(null); };

  const saveEdit = async () => {
    if (editIdx === null || !draft || !draft.name.trim()) return;
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

  const importFromCategory = async (catRefs: RefereeConfig[]) => {
    const existing = new Set(referees.map(r => r.name));
    const toAdd = catRefs.filter(r => !existing.has(r.name));
    if (toAdd.length > 0) await saveReferees([...referees, ...toAdd]);
    setShowImport(false);
  };

  // ==== draft helpers ====
  const applyLocationFieldMode = (location: string, mode: LocationFieldMode) => {
    if (!draft) return;
    setDraft({
      ...draft,
      allowedFields: setLocationFieldMode(location, mode, draft.allowedFields, fieldOnlyNames),
    });
  };
  const toggleField = (name: string) => {
    if (!draft) return;
    setDraft({
      ...draft,
      allowedFields: toggleFieldInAllowed(name, draft.allowedFields, fieldNames),
    });
  };

  const dayMode = (date: string): DayMode => {
    if (!draft?.availability) return "all";
    const win = draft.availability.find(a => a.date === date);
    if (!win) return "none";
    return win.from === WHOLE_DAY.from && win.to === WHOLE_DAY.to ? "all" : "times";
  };
  const applyDayMode = (date: string, mode: DayMode) => {
    if (!draft) return;
    const base = draft.availability ?? days.map(d => ({ date: d, ...WHOLE_DAY }));
    let next = base.filter(a => a.date !== date);
    if (mode === "all") next = [...next, { date, ...WHOLE_DAY }];
    if (mode === "times") {
      const prev = draft.availability?.find(a => a.date === date);
      const isWholeDay = !prev || (prev.from === WHOLE_DAY.from && prev.to === WHOLE_DAY.to);
      next = [...next, { date, from: isWholeDay ? "09:00" : prev.from, to: isWholeDay ? "18:00" : prev.to }];
    }
    next.sort((a, b) => a.date.localeCompare(b.date));
    const allWholeDay = next.length === days.length && next.every(a => a.from === WHOLE_DAY.from && a.to === WHOLE_DAY.to);
    setDraft({ ...draft, availability: allWholeDay ? null : next });
  };
  const updateWindow = (date: string, key: "from" | "to", value: string) => {
    if (!draft?.availability) return;
    setDraft({ ...draft, availability: draft.availability.map(a => (a.date === date ? { ...a, [key]: value } : a)) });
  };

  const applyExcludeMode = (mode: ExcludeMode) => {
    if (!draft) return;
    setExcludeMode(mode);
    if (mode === "none") setDraft({ ...draft, excludedTeams: [] });
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

  if (loading) return <div className="flex justify-center py-8"><div className="h-6 w-6 animate-spin rounded-full border-2 border-foreground border-t-transparent" /></div>;

  return (
    <div className="space-y-4">
      {/* Actions row */}
      <div className="flex items-center gap-2 flex-wrap">
        {categoryId && (
          <Button variant="outline" size="sm" onClick={openImport} className="gap-1">
            <Download className="h-3.5 w-3.5" /> Importeer uit divisies
          </Button>
        )}
        <p className="text-sm text-muted-foreground ml-auto">{referees.length} Scheidsrechter{referees.length !== 1 ? "s" : ""}</p>
      </div>

      {/* Grid of referees */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {referees.map((r, i) => (
          <div key={i} className="rounded-xl border border-border bg-card px-3 py-2.5">
            <div className="flex items-center gap-2">
              <WhistleIcon className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="flex-1 text-sm font-medium text-foreground truncate">{r.name}</span>
              <button onClick={() => openEdit(i)} className="text-muted-foreground hover:text-foreground transition-colors shrink-0" title="Bewerken">
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button onClick={() => setDeleteIdx(i)} className="text-muted-foreground hover:text-destructive transition-colors shrink-0" title="Verwijderen">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="mt-2 space-y-0.5">
              {summarizeRefereeLabeled(r, { locations: locationNames, fields: fieldOnlyNames, teamName }).map(line => (
                <p key={line.label} className="text-[10px] leading-snug text-muted-foreground">
                  <span className="font-medium text-foreground/80">{line.label} =</span> {line.value}
                </p>
              ))}
            </div>
          </div>
        ))}
        <button
          onClick={() => { setNewRef(""); setShowAdd(true); }}
          className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-card/50 px-3 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" /> Scheidsrechter
        </button>
      </div>

      {/* Add dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Scheidsrechter toevoegen</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input value={newRef} onChange={(e) => setNewRef(e.target.value)} placeholder="Naam scheidsrechter" onKeyDown={(e) => e.key === "Enter" && addReferee()} autoFocus />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowAdd(false)}>Annuleren</Button>
              <Button onClick={addReferee} className="bg-foreground text-background hover:bg-foreground/90">Toevoegen</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={editIdx !== null} onOpenChange={(open) => { if (!open) closeEdit(); }}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Scheidsrechter bewerken</DialogTitle></DialogHeader>
          {draft && (
            <div className="space-y-5">
              {/* Naam */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wide">Naam</Label>
                <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Naam scheidsrechter" autoFocus />
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
                      const mode = getLocationFieldMode(loc, draft.allowedFields, fieldOnlyNames);
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
                          {mode === "select" && fieldOnlyNames.length > 0 && (
                            <div className="grid grid-cols-2 gap-2">
                              {fieldOnlyNames.map(f => (
                                <label key={f} className="flex items-center gap-2 rounded-lg border border-border px-2.5 py-2 text-sm">
                                  <Checkbox checked={(draft.allowedFields ?? fieldNames).includes(f)} onCheckedChange={() => toggleField(f)} />
                                  <span className="truncate">{f}</span>
                                </label>
                              ))}
                            </div>
                          )}
                          {mode === "select" && fieldOnlyNames.length === 0 && (
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
                    const win = draft.availability?.find(a => a.date === d);
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
                        {mode === "times" && win && (
                          <div className="flex items-center gap-1">
                            <Input type="time" value={win.from} onChange={(e) => updateWindow(d, "from", e.target.value)} className="h-8 w-[92px] text-xs" />
                            <span className="text-xs text-muted-foreground">tot</span>
                            <Input type="time" value={win.to} onChange={(e) => updateWindow(d, "to", e.target.value)} className="h-8 w-[92px] text-xs" />
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

              {/* Uitgesloten teams */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Uitgesloten teams/spelers</Label>
                <Select value={excludeMode} onValueChange={(v) => applyExcludeMode(v as ExcludeMode)}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Geen</SelectItem>
                    <SelectItem value="select">Selecteer teams/spelers</SelectItem>
                  </SelectContent>
                </Select>
                {excludeMode === "select" && (
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
                <Button onClick={saveEdit} className="bg-foreground text-background hover:bg-foreground/90">Opslaan</Button>
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
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Importeer scheidsrechters</DialogTitle></DialogHeader>
          <div className="space-y-2">
            {otherCategories.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Geen andere divisies met scheidsrechters gevonden.</p>
            ) : (
              otherCategories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => importFromCategory(cat.referees)}
                  className="w-full flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3 hover:bg-secondary transition-colors"
                >
                  <span className="text-sm font-medium">{cat.name}</span>
                  <span className="text-xs text-muted-foreground">{cat.referees.length} scheidsrechter{cat.referees.length !== 1 ? "s" : ""}</span>
                </button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RefereeManager;
