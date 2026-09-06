import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useDialogFocus } from "@/hooks/useDialogFocus";
import { Plus, Trash2, Upload, Pencil } from "lucide-react";
import { compressImage, getFileExtension } from "@/lib/compressImage";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Sponsor {
  id: string;
  name: string;
  logo_url: string;
  sort_order: number;
}

const SponsorManager = ({ tournamentId }: { tournamentId: string }) => {
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const { toast } = useToast();

  useEffect(() => { fetchSponsors(); }, [tournamentId]);

  const fetchSponsors = async () => {
    const { data } = await supabase
      .from("tournament_sponsors")
      .select("id, name, logo_url, sort_order")
      .eq("tournament_id", tournamentId)
      .order("sort_order");
    if (data) setSponsors(data);
    setLoading(false);
  };

  const addSponsor = async (rawFile: File) => {
    setUploading(true);
    const file = await compressImage(rawFile);
    const ext = getFileExtension(file);
    const path = `${tournamentId}/sponsors/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("team-logos").upload(path, file, { upsert: true });
    if (error) {
      toast({ title: "Upload mislukt", description: error.message, variant: "destructive" });
      setUploading(false);
      return;
    }
    const { data: { publicUrl } } = supabase.storage.from("team-logos").getPublicUrl(path);
    const { data } = await supabase
      .from("tournament_sponsors")
      .insert({ tournament_id: tournamentId, logo_url: publicUrl, name: file.name.split(".")[0], sort_order: sponsors.length })
      .select("id, name, logo_url, sort_order")
      .single();
    if (data) {
      setSponsors(s => [...s, data]);
      toast({ title: "Sponsor toegevoegd" });
    }
    setUploading(false);
  };

  const replaceLogo = async (id: string, rawFile: File) => {
    const file = await compressImage(rawFile);
    const ext = getFileExtension(file);
    const path = `${tournamentId}/sponsors/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("team-logos").upload(path, file, { upsert: true });
    if (error) {
      toast({ title: "Upload mislukt", description: error.message, variant: "destructive" });
      return;
    }
    const { data: { publicUrl } } = supabase.storage.from("team-logos").getPublicUrl(path);
    await supabase.from("tournament_sponsors").update({ logo_url: publicUrl }).eq("id", id);
    setSponsors(s => s.map(x => x.id === id ? { ...x, logo_url: publicUrl } : x));
  };

  const saveEdit = async (id: string) => {
    await supabase.from("tournament_sponsors").update({ name: editName }).eq("id", id);
    setSponsors(s => s.map(x => x.id === id ? { ...x, name: editName } : x));
    setEditingId(null);
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    await supabase.from("tournament_sponsors").delete().eq("id", deleteId);
    setSponsors(s => s.filter(x => x.id !== deleteId));
    setDeleteId(null);
    toast({ title: "Sponsor verwijderd" });
  };

  const editingSponsor = sponsors.find(s => s.id === editingId);
  const editDialogRef = useDialogFocus(!!editingSponsor);

  if (loading) return <div className="flex justify-center py-8"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;


  return (
    <div className="space-y-6 w-full">
      {/* Section header tab bar (matches Statistics/Deelnemers pattern) */}
      <div className="flex justify-center border-b border-border flex-wrap">
        <div className="px-6 py-3 text-sm font-semibold uppercase tracking-wide text-primary relative after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:bg-primary">
          Sponsors
        </div>
      </div>

      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">{sponsors.length} {sponsors.length === 1 ? "sponsor" : "sponsors"}</p>

        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {sponsors.map(sponsor => (
            <div key={sponsor.id} className="rounded-xl border border-border bg-card p-4 flex flex-col items-center gap-3 group relative">
              <div className="h-20 w-20 overflow-hidden rounded-xl bg-secondary flex-shrink-0 flex items-center justify-center">
                {sponsor.logo_url ? (
                  <img src={sponsor.logo_url} alt={sponsor.name} className="h-full w-full object-contain" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-2xl font-bold text-muted-foreground">{sponsor.name.charAt(0)}</div>
                )}
              </div>
              <div className="text-center">
                <span className="text-sm font-medium text-foreground block truncate max-w-[140px]">{sponsor.name || "Naamloos"}</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => { setEditingId(sponsor.id); setEditName(sponsor.name); }}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  title="Sponsor bewerken"
                >
                  <Pencil className="h-3 w-3" />
                </button>
              </div>
              <button
                onClick={() => setDeleteId(sponsor.id)}
                className="absolute top-2 right-2 text-muted-foreground hover:text-destructive transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}

          <label className="rounded-xl border border-border bg-card p-4 flex flex-col items-center justify-center gap-2 hover:bg-accent hover:text-accent-foreground transition-colors min-h-[160px] cursor-pointer">
            <Plus className="h-6 w-6 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">{uploading ? "Uploaden..." : "Sponsor toevoegen"}</span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={uploading}
              onChange={(e) => { if (e.target.files?.[0]) { addSponsor(e.target.files[0]); e.target.value = ""; } }}
            />
          </label>
        </div>
      </div>

      {/* Edit sponsor dialog */}
      {editingSponsor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/70 p-3 sm:p-4" onClick={() => setEditingId(null)}>
          <div ref={editDialogRef} className="relative w-full max-w-md max-h-[85dvh] overflow-y-auto overscroll-contain rounded-2xl border border-border bg-card p-4 sm:p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="font-display text-lg font-bold text-foreground">Sponsor bewerken</h3>
            <div className="flex justify-center">
              <label className="cursor-pointer relative group">
                <div className="h-24 w-24 overflow-hidden rounded-xl bg-secondary flex-shrink-0 flex items-center justify-center">
                  {editingSponsor.logo_url ? (
                    <img src={editingSponsor.logo_url} alt={editingSponsor.name} className="h-full w-full object-contain" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-3xl font-bold text-muted-foreground">{editName.charAt(0) || "?"}</div>
                  )}
                </div>
                <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Upload className="h-6 w-6 text-foreground" />
                </div>
                <input type="file" accept="image/*" className="hidden" onChange={(e) => { if (e.target.files?.[0]) replaceLogo(editingSponsor.id, e.target.files[0]); }} />
              </label>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Sponsornaam</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Naam sponsor" />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditingId(null)}>Annuleren</Button>
              <Button onClick={() => saveEdit(editingSponsor.id)} className="bg-foreground text-background hover:bg-foreground/90">Opslaan</Button>
            </div>
          </div>
        </div>
      )}

      <AlertDialog open={!!deleteId} onOpenChange={(open) => { if (!open) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sponsor verwijderen?</AlertDialogTitle>
            <AlertDialogDescription>Deze sponsor wordt permanent verwijderd.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground">Verwijderen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default SponsorManager;
