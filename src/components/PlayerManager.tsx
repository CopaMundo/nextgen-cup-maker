import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/datepicker";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useDialogFocus } from "@/hooks/useDialogFocus";
import { Plus, Trash2, Pencil, Upload, User } from "lucide-react";
import { compressImage, getFileExtension } from "@/lib/compressImage";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const POSITIONS = [
  { value: "goalkeeper", label: "Doelman" },
  { value: "defender", label: "Verdediger" },
  { value: "midfielder", label: "Middenvelder" },
  { value: "attacker", label: "Aanvaller" },
];

const POSITION_ORDER = { goalkeeper: 0, defender: 1, midfielder: 2, attacker: 3 };

interface Player {
  id: string;
  first_name: string;
  last_name: string;
  shirt_number: number | null;
  photo_url: string | null;
  birth_date: string | null;
  position: string | null;
}

const PlayerManager = ({ tournamentId, teamId }: { tournamentId: string; teamId: string }) => {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", shirt_number: "", birth_date: "", position: "" });
  const [editForm, setEditForm] = useState({ first_name: "", last_name: "", shirt_number: "", birth_date: "", position: "" });
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const { toast } = useToast();
  const [deletePlayerId, setDeletePlayerId] = useState<string | null>(null);
  const addDialogRef = useDialogFocus(showAdd);
  const editDialogRef = useDialogFocus(!!editingId);

  useEffect(() => { fetchPlayers(); }, [teamId]);

  const fetchPlayers = async () => {
    const { data } = await supabase
      .from("players")
      .select("id, first_name, last_name, shirt_number, photo_url, birth_date, position")
      .eq("team_id", teamId)
      .order("created_at");
    if (data) setPlayers(data);
    setLoading(false);
  };

  const sortedPlayers = [...players].sort((a, b) => {
    const pa = POSITION_ORDER[a.position as keyof typeof POSITION_ORDER] ?? 99;
    const pb = POSITION_ORDER[b.position as keyof typeof POSITION_ORDER] ?? 99;
    return pa - pb;
  });

  const uploadPhoto = async (playerId: string, rawFile: File): Promise<string | null> => {
    const file = await compressImage(rawFile);
    const ext = getFileExtension(file);
    const path = `${tournamentId}/players/${playerId}.${ext}`;
    const { error } = await supabase.storage.from("team-logos").upload(path, file, { upsert: true });
    if (error) { toast({ title: "Foto upload mislukt", variant: "destructive" }); return null; }
    const { data: { publicUrl } } = supabase.storage.from("team-logos").getPublicUrl(path);
    await supabase.from("players").update({ photo_url: publicUrl } as any).eq("id", playerId);
    return publicUrl;
  };

  const addPlayer = async () => {
    if (!form.name.trim()) {
      toast({ title: "Naam is verplicht", variant: "destructive" });
      return;
    }
    const parts = form.name.trim().split(/\s+/);
    const firstName = parts[0];
    const lastName = parts.length > 1 ? parts.slice(1).join(" ") : "";
    const { data, error } = await supabase
      .from("players")
      .insert({
        tournament_id: tournamentId,
        team_id: teamId,
        first_name: firstName,
        last_name: lastName,
        shirt_number: form.shirt_number ? parseInt(form.shirt_number) : null,
        birth_date: form.birth_date || null,
        position: form.position || null,
      } as any)
      .select("id, first_name, last_name, shirt_number, photo_url, birth_date, position")
      .single();
    if (error) {
      toast({ title: "Fout", description: error.message, variant: "destructive" });
    } else if (data) {
      let player = data as Player;
      if (photoFile) {
        const url = await uploadPhoto(player.id, photoFile);
        if (url) player = { ...player, photo_url: url };
      }
      setPlayers(p => [...p, player]);
      setForm({ name: "", shirt_number: "", birth_date: "", position: "" });
      setPhotoFile(null);
      setShowAdd(false);
    }
  };

  const confirmDeletePlayer = async () => {
    if (!deletePlayerId) return;
    // Verzamel mogelijke naamvarianten zoals opgeslagen in match_stats.player_name
    const player = players.find(p => p.id === deletePlayerId);
    const nameVariants = new Set<string>();
    if (player) {
      const full = `${player.first_name} ${player.last_name}`.trim();
      if (full) nameVariants.add(full);
      if (player.first_name) nameVariants.add(player.first_name.trim());
      if (player.last_name) nameVariants.add(player.last_name.trim());
    }
    // Verwijder gerelateerde statistieken (doelpunten, assists, kaarten) voor deze speler binnen dit team
    if (nameVariants.size > 0) {
      await supabase
        .from("match_stats")
        .delete()
        .eq("tournament_id", tournamentId)
        .eq("team_id", teamId)
        .in("player_name", Array.from(nameVariants));
    }
    await supabase.from("players").delete().eq("id", deletePlayerId);
    setPlayers(p => p.filter(x => x.id !== deletePlayerId));
    setDeletePlayerId(null);
    toast({ title: "Speler verwijderd", description: "Statistieken van deze speler zijn ook verwijderd." });
  };

  const handlePhotoChange = async (playerId: string, file: File) => {
    const url = await uploadPhoto(playerId, file);
    if (url) setPlayers(p => p.map(x => x.id === playerId ? { ...x, photo_url: url } : x));
  };

  const saveEdit = async (id: string) => {
    if (!editForm.first_name.trim()) return;
    const parts = editForm.first_name.trim().split(/\s+/);
    const firstName = parts[0];
    const lastName = parts.length > 1 ? parts.slice(1).join(" ") : editForm.last_name.trim();
    const newFullName = `${firstName} ${lastName}`.trim();
    const previous = players.find(x => x.id === id);
    const oldFullName = previous ? `${previous.first_name} ${previous.last_name}`.trim() : "";
    await supabase.from("players").update({
      first_name: firstName,
      last_name: lastName,
      shirt_number: editForm.shirt_number ? parseInt(editForm.shirt_number) : null,
      birth_date: editForm.birth_date || null,
      position: editForm.position || null,
    } as any).eq("id", id);
    // Als de naam is gewijzigd, ook bestaande statistieken meeschuiven
    if (oldFullName && newFullName && oldFullName !== newFullName) {
      await supabase
        .from("match_stats")
        .update({ player_name: newFullName })
        .eq("tournament_id", tournamentId)
        .eq("team_id", teamId)
        .eq("player_name", oldFullName);
    }
    setPlayers(p => p.map(x => x.id === id ? {
      ...x,
      first_name: firstName,
      last_name: lastName,
      shirt_number: editForm.shirt_number ? parseInt(editForm.shirt_number) : null,
      birth_date: editForm.birth_date || null,
      position: editForm.position || null,
    } : x));
    setEditingId(null);
  };

  if (loading) return <div className="flex justify-center py-4"><div className="h-5 w-5 animate-spin rounded-full border-2 border-foreground border-t-transparent" /></div>;

  return (
    <>
    <div className="space-y-3">
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => { setShowAdd(false); setPhotoFile(null); }}>
          <div ref={addDialogRef} className="relative w-full max-w-md rounded-2xl border border-border bg-card p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="font-display text-lg font-bold text-foreground">Speler toevoegen</h3>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">Naam *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Bijv. Jan Janssen" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Rugnummer</Label>
                  <Input type="number" value={form.shirt_number} onChange={(e) => setForm({ ...form, shirt_number: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Geboortedatum</Label>
                  <DatePicker value={form.birth_date} onChange={(v) => setForm({ ...form, birth_date: v })} placeholder="Kies datum" />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Foto</Label>
                <label className="flex h-10 w-full cursor-pointer items-center justify-center rounded-md border border-input bg-background px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors">
                  <Upload className="h-4 w-4 mr-2" />
                  {photoFile ? photoFile.name : "Bestand kiezen"}
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => setPhotoFile(e.target.files?.[0] || null)} />
                </label>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setShowAdd(false); setPhotoFile(null); }}>Annuleren</Button>
              <Button onClick={addPlayer} className="bg-foreground text-background hover:bg-foreground/90">Toevoegen</Button>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4">
        {sortedPlayers.map(player => (
          <div key={player.id} className="rounded-xl border border-border bg-card p-3 flex flex-col items-center gap-2 relative">
            <label className="cursor-pointer relative group">
              <div className="h-20 w-20 rounded-full overflow-hidden bg-secondary flex-shrink-0">
                {player.photo_url ? (
                  <img src={player.photo_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <User className="h-8 w-8 text-muted-foreground" />
                  </div>
                )}
              </div>
              <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
                <Upload className="h-4 w-4 text-white" />
              </div>
              <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handlePhotoChange(player.id, e.target.files[0])} />
              {player.shirt_number !== null && (
                <div className="absolute -bottom-0.5 -right-0.5 h-6 w-6 rounded-full bg-primary flex items-center justify-center">
                  <span className="text-[10px] font-bold text-primary-foreground">{player.shirt_number}</span>
                </div>
              )}
            </label>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1">
                <p className="text-sm font-medium text-foreground">{player.first_name} {player.last_name}</p>
                <button onClick={() => { setEditingId(player.id); setEditForm({ first_name: `${player.first_name} ${player.last_name}`.trim(), last_name: player.last_name, shirt_number: player.shirt_number?.toString() || "", birth_date: player.birth_date || "", position: player.position || "" }); }} className="text-muted-foreground hover:text-foreground">
                  <Pencil className="h-3 w-3" />
                </button>
              </div>
              {player.birth_date && (
                <p className="text-[10px] text-muted-foreground">{new Date(player.birth_date).toLocaleDateString("nl-BE")}</p>
              )}
            </div>
            <button onClick={() => setDeletePlayerId(player.id)} className="absolute top-1.5 right-1.5 text-muted-foreground hover:text-destructive">
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        ))}
        <button
          onClick={() => setShowAdd(true)}
          className="rounded-xl border border-border bg-card p-3 flex flex-col items-center justify-center gap-2 hover:bg-accent hover:text-accent-foreground transition-colors min-h-[140px]"
        >
          <Plus className="h-6 w-6 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Speler toevoegen</span>
        </button>
      </div>
    </div>

      {editingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setEditingId(null)}>
          <div ref={editDialogRef} className="relative w-full max-w-md rounded-2xl border border-border bg-card p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="font-display text-lg font-bold text-foreground">Speler bewerken</h3>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">Naam *</Label>
                <Input value={editForm.first_name} onChange={(e) => setEditForm({ ...editForm, first_name: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Rugnummer</Label>
                  <Input type="number" value={editForm.shirt_number} onChange={(e) => setEditForm({ ...editForm, shirt_number: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Geboortedatum</Label>
                  <DatePicker value={editForm.birth_date} onChange={(v) => setEditForm({ ...editForm, birth_date: v })} placeholder="Kies datum" />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditingId(null)}>Annuleren</Button>
              <Button onClick={() => saveEdit(editingId)} className="bg-foreground text-background hover:bg-foreground/90">Opslaan</Button>
            </div>
          </div>
        </div>
      )}

      <AlertDialog open={!!deletePlayerId} onOpenChange={(o) => !o && setDeletePlayerId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Speler verwijderen?</AlertDialogTitle>
            <AlertDialogDescription>Weet je zeker dat je deze speler wilt verwijderen?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeletePlayer} className="bg-destructive text-destructive-foreground">Verwijderen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default PlayerManager;
