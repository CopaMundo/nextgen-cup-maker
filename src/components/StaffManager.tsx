import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useDialogFocus } from "@/hooks/useDialogFocus";
import { Plus, Trash2, Upload, User, Pencil } from "lucide-react";
import { compressImage, getFileExtension } from "@/lib/compressImage";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const STAFF_ROLES = ["Trainer", "Assistent trainer", "Teammanager", "Verzorger", "Keeperstrainer", "Analist"];

interface Staff {
  id: string;
  name: string;
  role: string;
  photo_url: string | null;
}

const StaffManager = ({ tournamentId, teamId }: { tournamentId: string; teamId: string }) => {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: "", role: "Trainer" });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: "", role: "Trainer" });
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const { toast } = useToast();
  const [deleteStaffId, setDeleteStaffId] = useState<string | null>(null);
  const addDialogRef = useDialogFocus(showAdd);
  const editDialogRef = useDialogFocus(!!editingId);

  useEffect(() => { fetchStaff(); }, [teamId]);

  const fetchStaff = async () => {
    const { data } = await supabase
      .from("staff")
      .select("id, name, role, photo_url")
      .eq("team_id", teamId)
      .order("created_at");
    if (data) setStaff(data);
    setLoading(false);
  };

  const uploadPhoto = async (staffId: string, rawFile: File): Promise<string | null> => {
    const file = await compressImage(rawFile);
    const ext = getFileExtension(file);
    const path = `${tournamentId}/staff/${staffId}.${ext}`;
    const { error } = await supabase.storage.from("team-logos").upload(path, file, { upsert: true });
    if (error) { toast({ title: "Foto upload mislukt", variant: "destructive" }); return null; }
    const { data: { publicUrl } } = supabase.storage.from("team-logos").getPublicUrl(path);
    await supabase.from("staff").update({ photo_url: publicUrl } as any).eq("id", staffId);
    return publicUrl;
  };

  const addStaff = async () => {
    if (!form.name.trim()) return;
    const { data, error } = await supabase
      .from("staff")
      .insert({ tournament_id: tournamentId, team_id: teamId, name: form.name.trim(), role: form.role } as any)
      .select("id, name, role, photo_url")
      .single();
    if (error) {
      toast({ title: "Fout", description: error.message, variant: "destructive" });
    } else if (data) {
      let member = data as Staff;
      if (photoFile) {
        const url = await uploadPhoto(member.id, photoFile);
        if (url) member = { ...member, photo_url: url };
      }
      setStaff(s => [...s, member]);
      setForm({ name: "", role: "Trainer" });
      setPhotoFile(null);
      setShowAdd(false);
    }
  };

  const confirmDeleteStaff = async () => {
    if (!deleteStaffId) return;
    await supabase.from("staff").delete().eq("id", deleteStaffId);
    setStaff(s => s.filter(x => x.id !== deleteStaffId));
    setDeleteStaffId(null);
  };

  const handlePhotoChange = async (staffId: string, file: File) => {
    const url = await uploadPhoto(staffId, file);
    if (url) setStaff(s => s.map(x => x.id === staffId ? { ...x, photo_url: url } : x));
  };

  const saveEditStaff = async (id: string) => {
    if (!editForm.name.trim()) return;
    await supabase.from("staff").update({ name: editForm.name.trim(), role: editForm.role } as any).eq("id", id);
    setStaff(s => s.map(x => x.id === id ? { ...x, name: editForm.name.trim(), role: editForm.role } : x));
    setEditingId(null);
  };

  if (loading) return <div className="flex justify-center py-4"><div className="h-5 w-5 animate-spin rounded-full border-2 border-foreground border-t-transparent" /></div>;

  return (
    <>
    <div className="space-y-3">
      {/* Add staff modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/70 p-3 sm:p-4" onClick={() => { setShowAdd(false); setPhotoFile(null); }}>
          <div ref={addDialogRef} className="relative w-full max-w-md max-h-[85dvh] overflow-y-auto overscroll-contain rounded-2xl border border-border bg-card p-4 sm:p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="font-display text-lg font-bold text-foreground">Stafflid toevoegen</h3>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">Naam *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Functie</Label>
                <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  {STAFF_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
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
              <Button onClick={addStaff} className="bg-foreground text-background hover:bg-foreground/90">Toevoegen</Button>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4">
        {staff.map(s => (
          <div key={s.id} className="rounded-xl border border-border bg-card p-3 flex flex-col items-center gap-2 relative">
            <label className="cursor-pointer relative group">
              <div className="h-20 w-20 rounded-full overflow-hidden bg-secondary flex-shrink-0">
                {s.photo_url ? (
                  <img src={s.photo_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <User className="h-8 w-8 text-muted-foreground" />
                  </div>
                )}
              </div>
              <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
                <Upload className="h-4 w-4 text-white" />
              </div>
              <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handlePhotoChange(s.id, e.target.files[0])} />
            </label>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1">
                <p className="text-sm font-medium text-foreground">{s.name}</p>
                <button onClick={() => { setEditingId(s.id); setEditForm({ name: s.name, role: s.role }); }} className="text-muted-foreground hover:text-foreground">
                  <Pencil className="h-3 w-3" />
                </button>
              </div>
              <p className="text-[10px] text-muted-foreground">{s.role}</p>
            </div>
            <button onClick={() => setDeleteStaffId(s.id)} className="absolute top-1.5 right-1.5 text-muted-foreground hover:text-destructive">
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        ))}
        <button
          onClick={() => setShowAdd(true)}
          className="rounded-xl border border-border bg-card p-3 flex flex-col items-center justify-center gap-2 hover:bg-accent hover:text-accent-foreground transition-colors min-h-[140px]"
        >
          <Plus className="h-6 w-6 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Stafflid toevoegen</span>
        </button>
      </div>
    </div>

      {/* Edit staff dialog */}
      {editingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/70 p-3 sm:p-4" onClick={() => setEditingId(null)}>
          <div ref={editDialogRef} className="relative w-full max-w-md max-h-[85dvh] overflow-y-auto overscroll-contain rounded-2xl border border-border bg-card p-4 sm:p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="font-display text-lg font-bold text-foreground">Stafflid bewerken</h3>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">Naam *</Label>
                <Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Functie</Label>
                <select value={editForm.role} onChange={(e) => setEditForm({ ...editForm, role: e.target.value })} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  {STAFF_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditingId(null)}>Annuleren</Button>
              <Button onClick={() => saveEditStaff(editingId)} className="bg-foreground text-background hover:bg-foreground/90">Opslaan</Button>
            </div>
          </div>
        </div>
      )}

      <AlertDialog open={!!deleteStaffId} onOpenChange={(o) => !o && setDeleteStaffId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Staf verwijderen?</AlertDialogTitle>
            <AlertDialogDescription>Weet je zeker dat je dit staflid wilt verwijderen?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteStaff} className="bg-destructive text-destructive-foreground">Verwijderen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default StaffManager;
