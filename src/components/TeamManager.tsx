import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Upload, Pencil, Check, X, ArrowLeft, Users, Camera, Copy, ChevronRight } from "lucide-react";
import { compressImage, getFileExtension } from "@/lib/compressImage";
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
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import CountryFlag from "@/components/CountryFlag";
import PlayerManager from "./PlayerManager";
import StaffManager from "./StaffManager";
import CountrySelect from "./CountrySelect";
import { useIsMobile } from "@/hooks/use-mobile";

interface Team {
  id: string;
  name: string;
  country: string | null;
  logo_url: string | null;
  team_photo_url: string | null;
  category_id: string | null;
}

interface Category {
  id: string;
  name: string;
}

const TeamManager = ({ tournamentId, teamCount, showCountry, categoryId, teamsLabel = "Teams", onDetailOpenChange }: { tournamentId: string; teamCount: number; showCountry: boolean; categoryId?: string | null; teamsLabel?: string; onDetailOpenChange?: (open: boolean) => void }) => {
  const isPlayers = teamsLabel === "Spelers";
  const singularLabel = isPlayers ? "Speler" : "Team";
  const pluralLabel = isPlayers ? "Spelers" : "Teams";
  const [teams, setTeams] = useState<Team[]>([]);
  const [allTeams, setAllTeams] = useState<Team[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [newTeam, setNewTeam] = useState({ name: "", country: "" });
  const [editTeam, setEditTeam] = useState({ name: "", country: "" });
  const isMobile = useIsMobile();

  const { toast } = useToast();

  useEffect(() => { fetchTeams(); }, [tournamentId, categoryId]);
  useEffect(() => { onDetailOpenChange?.(!!selectedTeamId); }, [selectedTeamId, onDetailOpenChange]);
  useEffect(() => () => { onDetailOpenChange?.(false); }, [onDetailOpenChange]);

  const fetchTeams = async () => {
    const [teamsRes, allTeamsRes, catRes] = await Promise.all([
      supabase.from("teams").select("id, name, country, logo_url, team_photo_url, category_id").eq("tournament_id", tournamentId).order("created_at"),
      supabase.from("teams").select("id, name, country, logo_url, team_photo_url, category_id").eq("tournament_id", tournamentId).order("name"),
      supabase.from("tournament_categories").select("id, name").eq("tournament_id", tournamentId).order("sort_order"),
    ]);
    const all = (teamsRes.data || []) as Team[];
    setAllTeams(all);
    // Filter by category if multi-category
    if (categoryId) {
      setTeams(all.filter(t => t.category_id === categoryId));
    } else {
      setTeams(all);
    }
    if (catRes.data) setCategories(catRes.data);
    setLoading(false);
  };

  const addTeam = async () => {
    if (!newTeam.name.trim()) return;
    const { data, error } = await supabase
      .from("teams")
      .insert({ tournament_id: tournamentId, name: newTeam.name.trim(), country: newTeam.country || null, category_id: categoryId || null } as any)
      .select("id, name, country, logo_url, team_photo_url, category_id")
      .single();
    if (error) {
      toast({ title: "Fout", description: error.message, variant: "destructive" });
    } else if (data) {
      setTeams(t => [...t, data as Team]);
      setAllTeams(t => [...t, data as Team]);
      setNewTeam({ name: "", country: "" });
      setShowAdd(false);
    }
  };

  const importTeam = async (sourceTeam: Team) => {
    const { data, error } = await supabase
      .from("teams")
      .insert({
        tournament_id: tournamentId,
        name: sourceTeam.name,
        country: sourceTeam.country,
        logo_url: sourceTeam.logo_url,
        category_id: categoryId || null,
      } as any)
      .select("id, name, country, logo_url, team_photo_url, category_id")
      .single();
    if (error) {
      toast({ title: "Fout", description: error.message, variant: "destructive" });
    } else if (data) {
      setTeams(t => [...t, data as Team]);
      setAllTeams(t => [...t, data as Team]);
      toast({ title: "Team geïmporteerd", description: `${sourceTeam.name} is toegevoegd aan deze divisie.` });
    }
  };

  const [teamToDelete, setTeamToDelete] = useState<string | null>(null);

  const removeTeam = async (id: string) => {
    await supabase.from("teams").delete().eq("id", id);
    setTeams(t => t.filter(x => x.id !== id));
    setAllTeams(t => t.filter(x => x.id !== id));
    setTeamToDelete(null);
  };

  const saveEdit = async (id: string) => {
    if (!editTeam.name.trim()) return;
    await supabase.from("teams").update({ name: editTeam.name.trim(), country: editTeam.country || null } as any).eq("id", id);
    setTeams(t => t.map(x => x.id === id ? { ...x, name: editTeam.name.trim(), country: editTeam.country || null } : x));
    setEditingId(null);
  };

  const uploadLogo = async (teamId: string, rawFile: File) => {
    const file = await compressImage(rawFile);
    const ext = getFileExtension(file);
    const ts = Date.now();
    const path = `${tournamentId}/${teamId}_${ts}.${ext}`;
    // Delete old logo files for this team
    const { data: existing } = await supabase.storage.from("team-logos").list(tournamentId, { limit: 500 });
    if (existing) {
      const old = existing.filter(f => f.name.startsWith(teamId) && !f.name.includes("-photo")).map(f => `${tournamentId}/${f.name}`);
      if (old.length > 0) await supabase.storage.from("team-logos").remove(old);
    }
    const { error } = await supabase.storage.from("team-logos").upload(path, file, { upsert: true });
    if (error) { toast({ title: "Upload mislukt", description: error.message, variant: "destructive" }); return; }
    const { data: { publicUrl } } = supabase.storage.from("team-logos").getPublicUrl(path);
    await supabase.from("teams").update({ logo_url: publicUrl }).eq("id", teamId);
    setTeams(t => t.map(x => x.id === teamId ? { ...x, logo_url: publicUrl } : x));
  };

  const uploadTeamPhoto = async (teamId: string, rawFile: File) => {
    const file = await compressImage(rawFile);
    const ext = getFileExtension(file);
    const ts = Date.now();
    const path = `${tournamentId}/${teamId}-photo_${ts}.${ext}`;
    // Delete old team photo files
    const { data: existing } = await supabase.storage.from("team-logos").list(tournamentId, { limit: 500 });
    if (existing) {
      const old = existing.filter(f => f.name.startsWith(`${teamId}-photo`)).map(f => `${tournamentId}/${f.name}`);
      if (old.length > 0) await supabase.storage.from("team-logos").remove(old);
    }
    const { error } = await supabase.storage.from("team-logos").upload(path, file, { upsert: true });
    if (error) { toast({ title: "Upload mislukt", description: error.message, variant: "destructive" }); return; }
    const { data: { publicUrl } } = supabase.storage.from("team-logos").getPublicUrl(path);
    await supabase.from("teams").update({ team_photo_url: publicUrl } as any).eq("id", teamId);
    setTeams(t => t.map(x => x.id === teamId ? { ...x, team_photo_url: publicUrl } : x));
  };

  // Teams from other categories available for import
  const importableTeams = categoryId
    ? allTeams.filter(t => t.category_id !== categoryId && t.category_id !== null)
    : [];

  // Group importable teams by category
  const importByCategory = categories
    .filter(c => c.id !== categoryId)
    .map(c => ({
      ...c,
      teams: importableTeams.filter(t => t.category_id === c.id),
    }))
    .filter(c => c.teams.length > 0);

  if (loading) return <div className="flex justify-center py-8"><div className="h-6 w-6 animate-spin rounded-full border-2 border-foreground border-t-transparent" /></div>;

  // Team detail page (management)
  if (selectedTeamId) {
    const team = teams.find(t => t.id === selectedTeamId);
    if (!team) return null;
    return (
      <div className={isMobile ? "space-y-4" : "space-y-6"}>
        {isMobile ? (
          <div className="flex items-center gap-3">
            <Button variant="outline" size="icon" className="h-8 w-8 shrink-0" onClick={() => setSelectedTeamId(null)} aria-label={`Terug naar ${pluralLabel.toLowerCase()}`}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h2 className="min-w-0 flex-1 truncate font-display text-lg font-bold text-foreground">{team.name}</h2>
          </div>
        ) : (
          <button onClick={() => setSelectedTeamId(null)} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" /> Terug naar {pluralLabel.toLowerCase()}
          </button>
        )}
        <div className={isMobile ? "flex items-center gap-4" : "flex items-center gap-6"}>
          <label className="cursor-pointer relative group">
            <div className={`${isMobile ? "h-16 w-16" : "h-24 w-24"} overflow-hidden flex-shrink-0`}>
              {team.logo_url ? (
                <img src={team.logo_url} alt={team.name} className="h-full w-full object-contain" />
              ) : (
                <div className="flex h-full w-full items-center justify-center rounded-2xl bg-secondary text-3xl font-bold text-muted-foreground">{team.name.charAt(0)}</div>
              )}
            </div>
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
              <Upload className="h-6 w-6 text-foreground" />
            </div>
            <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && uploadLogo(team.id, e.target.files[0])} />
          </label>
          <div className="min-w-0">
            {!isMobile && <h2 className="font-display text-2xl font-bold text-foreground">{team.name}</h2>}
            {isMobile && <p className="text-xs text-muted-foreground">Tik op het logo om te wijzigen</p>}
            {showCountry && team.country && <p className="text-sm text-muted-foreground flex items-center gap-1"><CountryFlag country={team.country} className="h-4 w-5 object-contain" /> {team.country}</p>}
          </div>
        </div>

        {!isPlayers && (
          <>
            <div className={`rounded-xl border border-border bg-card ${isMobile ? "p-4" : "p-6"}`}>
              <h3 className="font-display text-lg font-bold text-foreground mb-4">Ploegfoto</h3>
              <label className="cursor-pointer relative group block">
                {team.team_photo_url ? (
                  <div className="relative rounded-xl overflow-hidden">
                    <img src={team.team_photo_url} alt="Ploegfoto" className="w-full h-auto object-contain rounded-xl" />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl">
                      <Camera className="h-8 w-8 text-white" />
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border py-12 hover:border-foreground/20 transition-colors">
                    <Camera className="h-8 w-8 text-muted-foreground mb-2" />
                    <span className="text-sm text-muted-foreground">Upload ploegfoto</span>
                  </div>
                )}
                <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && uploadTeamPhoto(team.id, e.target.files[0])} />
              </label>
            </div>
            <div className={`rounded-xl border border-border bg-card ${isMobile ? "p-4" : "p-6"}`}>
              <h3 className="font-display text-lg font-bold text-foreground mb-4">Spelers</h3>
              <PlayerManager tournamentId={tournamentId} teamId={selectedTeamId} />
            </div>
            <div className={`rounded-xl border border-border bg-card ${isMobile ? "p-4" : "p-6"}`}>
              <h3 className="font-display text-lg font-bold text-foreground mb-4">Staff</h3>
              <StaffManager tournamentId={tournamentId} teamId={selectedTeamId} />
            </div>
          </>
        )}
      </div>
    );
  }

  const modals = (
    <>
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{singularLabel} toevoegen</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">{isPlayers ? "Naam" : "Teamnaam"} *</Label>
              <Input value={newTeam.name} onChange={(e) => setNewTeam({ ...newTeam, name: e.target.value })} placeholder={isPlayers ? "Bijv. Lionel Messi" : "Bijv. RSC Anderlecht"} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Land (optioneel)</Label>
              <CountrySelect value={newTeam.country} onChange={(v) => setNewTeam({ ...newTeam, country: v })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Annuleren</Button>
            <Button onClick={addTeam} className="bg-foreground text-background hover:bg-foreground/90">Toevoegen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingId} onOpenChange={(o) => { if (!o) setEditingId(null); }}>
        <DialogContent className="max-w-md">
          {(() => {
            const team = teams.find(t => t.id === editingId);
            if (!team) return null;
            return (
              <>
                <DialogHeader>
                  <DialogTitle>{singularLabel} bewerken</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="flex justify-center">
                    <label className="cursor-pointer relative group">
                      <div className="h-24 w-24 overflow-hidden flex-shrink-0">
                        {team.logo_url ? (
                          <img src={team.logo_url} alt={team.name} className="h-full w-full object-contain" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center rounded-xl bg-secondary text-3xl font-bold text-muted-foreground">{editTeam.name.charAt(0) || team.name.charAt(0)}</div>
                        )}
                      </div>
                      <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Upload className="h-6 w-6 text-foreground" />
                      </div>
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => { if (e.target.files?.[0]) uploadLogo(team.id, e.target.files[0]); }} />
                    </label>
                  </div>
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <Label className="text-xs">{isPlayers ? "Naam" : "Teamnaam"} *</Label>
                      <Input value={editTeam.name} onChange={(e) => setEditTeam({ ...editTeam, name: e.target.value })} placeholder={isPlayers ? "Naam" : "Teamnaam"} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Land (optioneel)</Label>
                      <CountrySelect value={editTeam.country} onChange={(v) => setEditTeam({ ...editTeam, country: v })} />
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setEditingId(null)}>Annuleren</Button>
                  <Button onClick={() => editingId && saveEdit(editingId)} className="bg-foreground text-background hover:bg-foreground/90">Opslaan</Button>
                </DialogFooter>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      <Dialog open={showImport} onOpenChange={setShowImport}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Team importeren uit andere divisie</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">Alleen teamnaam, logo en land worden gekopieerd. Spelers, staff en ploegfoto worden niet overgenomen.</p>
          {importByCategory.map(cat => (
            <div key={cat.id} className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{cat.name}</h4>
              <div className="grid gap-2">
                {cat.teams.map(t => {
                  const alreadyImported = teams.some(existing => existing.name === t.name);
                  return (
                    <button
                      key={t.id}
                      disabled={alreadyImported}
                      onClick={() => { importTeam(t); }}
                      className={`flex items-center gap-3 rounded-lg border border-border p-3 text-left transition-colors ${
                        alreadyImported ? "opacity-50 cursor-not-allowed" : "hover:bg-foreground/5"
                      }`}
                    >
                      {t.logo_url ? (
                        <img src={t.logo_url} className="h-8 w-8 rounded-lg object-contain" />
                      ) : (
                        <div className="h-8 w-8 rounded-lg bg-secondary flex items-center justify-center text-sm font-bold text-muted-foreground">{t.name.charAt(0)}</div>
                      )}
                      <div>
                        <span className="text-sm font-medium text-foreground">{t.name}</span>
                        {t.country && <CountryFlag country={t.country} className="ml-2 h-3.5 w-5 object-contain inline-block align-text-bottom" />}
                      </div>
                      {alreadyImported && <span className="ml-auto text-xs text-muted-foreground">Al toegevoegd</span>}
                      {!alreadyImported && <Copy className="ml-auto h-3.5 w-3.5 text-muted-foreground" />}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowImport(false)}>Sluiten</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!teamToDelete} onOpenChange={(open) => { if (!open) setTeamToDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{singularLabel} verwijderen?</AlertDialogTitle>
            <AlertDialogDescription>
              {isPlayers
                ? "Weet je zeker dat je deze speler wilt verwijderen? Alle gekoppelde wedstrijddata gaat verloren."
                : "Weet je zeker dat je dit team wilt verwijderen? Alle gekoppelde spelers, staff en wedstrijddata gaan verloren."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction onClick={() => teamToDelete && removeTeam(teamToDelete)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Verwijderen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );

  if (isMobile) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">{teams.length} {pluralLabel}</p>
          {categoryId && importByCategory.length > 0 && (
            <Button variant="outline" size="sm" className="h-8" onClick={() => setShowImport(true)}>
              <Copy className="h-3.5 w-3.5 mr-1" /> Importeren
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 gap-2">
          {teams.map(team => (
            <div
              key={team.id}
              onClick={isPlayers ? undefined : () => setSelectedTeamId(team.id)}
              className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5 text-left transition-colors active:bg-accent/40"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md bg-primary/10">
                {team.logo_url ? (
                  <img src={team.logo_url} alt={team.name} className="h-full w-full object-contain" />
                ) : (
                  <span className="text-sm font-bold text-primary">{team.name.charAt(0)}</span>
                )}
              </div>
              <span className="min-w-0 flex-1 truncate font-display text-sm font-semibold text-foreground">{team.name}</span>
              {showCountry && team.country && <CountryFlag country={team.country} className="h-3.5 w-5 shrink-0 object-contain" />}
              <div className="flex shrink-0 items-center gap-1" onClick={e => e.stopPropagation()}>
                <button
                  onClick={() => { setEditingId(team.id); setEditTeam({ name: team.name, country: team.country || "" }); }}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  title="Bewerken"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => setTeamToDelete(team.id)}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                  title="Verwijderen"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              {!isPlayers && (
                <span className="shrink-0 text-muted-foreground">
                  <ChevronRight className="h-4 w-4" />
                </span>
              )}
            </div>
          ))}
          {teams.length < 128 && (
            <button
              onClick={() => setShowAdd(true)}
              className="flex items-center gap-3 rounded-lg border border-dashed border-border bg-card px-3 py-2.5 text-left transition-colors active:bg-accent/40"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                <Plus className="h-4 w-4" />
              </div>
              <span className="font-display text-sm font-semibold text-foreground">{singularLabel} toevoegen</span>
            </button>
          )}
        </div>
        {modals}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{teams.length} {pluralLabel}</p>
        {categoryId && importByCategory.length > 0 && (
          <Button variant="outline" size="sm" onClick={() => setShowImport(true)}>
            <Copy className="h-3.5 w-3.5 mr-1" /> Importeer uit andere divisie
          </Button>
        )}
      </div>

      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {teams.map(team => (
          <div key={team.id} className={`rounded-xl border border-border bg-card p-4 flex flex-col items-center gap-3 group relative ${isPlayers ? "" : "cursor-pointer"}`} onClick={isPlayers ? undefined : () => setSelectedTeamId(team.id)}>
            <div className="h-20 w-20 overflow-hidden flex-shrink-0">
              {team.logo_url ? (
                <img src={team.logo_url} alt={team.name} className="h-full w-full object-contain" />
              ) : (
                <div className="flex h-full w-full items-center justify-center rounded-xl bg-secondary text-2xl font-bold text-muted-foreground">{team.name.charAt(0)}</div>
              )}
            </div>
            <div className="text-center">
              <span className="text-sm font-medium text-foreground block">{team.name}</span>
              {showCountry && team.country && <CountryFlag country={team.country} className="h-3.5 w-5 object-contain" />}
            </div>
            <div className="flex gap-2" onClick={e => e.stopPropagation()}>
              <button onClick={() => { setEditingId(team.id); setEditTeam({ name: team.name, country: team.country || "" }); }} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-md hover:bg-accent" title={`${singularLabel} bewerken`}>
                <Pencil className="h-4 w-4" />
              </button>
              {!isPlayers && (
                <button onClick={() => setSelectedTeamId(team.id)} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-md hover:bg-accent" title="Teammanagement">
                  <Users className="h-4 w-4" />
                </button>
              )}
            </div>
            <button onClick={(e) => { e.stopPropagation(); setTeamToDelete(team.id); }} className="absolute top-2 right-2 text-muted-foreground hover:text-destructive transition-colors">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        {teams.length < 128 && (
          <button
            onClick={() => setShowAdd(true)}
            className="rounded-xl border border-border bg-card p-4 flex flex-col items-center justify-center gap-2 hover:bg-accent hover:text-accent-foreground transition-colors min-h-[160px]"
          >
            <Plus className="h-6 w-6 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">{singularLabel} toevoegen</span>
          </button>
        )}
      </div>


      {modals}
    </div>
  );
};

export default TeamManager;
