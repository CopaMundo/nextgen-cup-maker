import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Pencil, Trash2, Download } from "lucide-react";
import WhistleIcon from "@/components/icons/WhistleIcon";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Props {
  tournamentId: string;
  categoryId?: string | null;
}

const RefereeManager = ({ tournamentId, categoryId }: Props) => {
  const [referees, setReferees] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newRef, setNewRef] = useState("");
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [deleteIdx, setDeleteIdx] = useState<number | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [otherCategories, setOtherCategories] = useState<{ id: string; name: string; referees: string[] }[]>([]);

  useEffect(() => {
    fetchReferees();
  }, [tournamentId, categoryId]);

  const fetchReferees = async () => {
    setLoading(true);
    if (categoryId) {
      const { data } = await supabase.from("tournament_categories").select("referees").eq("id", categoryId).single();
      setReferees(Array.isArray(data?.referees) ? (data.referees as string[]) : []);
    } else {
      const { data } = await supabase.from("tournaments").select("referees").eq("id", tournamentId).single();
      setReferees(Array.isArray(data?.referees) ? (data.referees as string[]) : []);
    }
    setLoading(false);
  };

  const saveReferees = async (updated: string[]) => {
    if (categoryId) {
      await supabase.from("tournament_categories").update({ referees: updated as any }).eq("id", categoryId);
    } else {
      await supabase.from("tournaments").update({ referees: updated as any }).eq("id", tournamentId);
    }
    setReferees(updated);
  };

  const addReferee = async () => {
    if (!newRef.trim()) return;
    await saveReferees([...referees, newRef.trim()]);
    setNewRef("");
    setShowAdd(false);
  };

  const editReferee = async () => {
    if (editIdx === null || !editName.trim()) return;
    const oldName = referees[editIdx];
    const newName = editName.trim();
    const updated = referees.map((r, i) => i === editIdx ? newName : r);
    if (oldName !== newName) {
      const { data: matchesWithRef } = await supabase
        .from("matches")
        .select("id")
        .eq("tournament_id", tournamentId)
        .eq("referee", oldName);
      if (matchesWithRef) {
        for (const m of matchesWithRef) {
          await supabase.from("matches").update({ referee: newName }).eq("id", m.id);
        }
      }
    }
    await saveReferees(updated);
    setEditIdx(null);
    setEditName("");
  };

  const confirmRemoveReferee = async () => {
    if (deleteIdx === null) return;
    const updated = referees.filter((_, i) => i !== deleteIdx);
    await saveReferees(updated);
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
      (cats || []).map(c => ({
        id: c.id,
        name: c.name,
        referees: Array.isArray(c.referees) ? (c.referees as string[]) : [],
      })).filter(c => c.referees.length > 0)
    );
    setShowImport(true);
  };

  const importFromCategory = async (catRefs: string[]) => {
    const existing = new Set(referees);
    const toAdd = catRefs.filter(r => !existing.has(r));
    if (toAdd.length > 0) {
      await saveReferees([...referees, ...toAdd]);
    }
    setShowImport(false);
  };

  if (loading) return <div className="flex justify-center py-8"><div className="h-6 w-6 animate-spin rounded-full border-2 border-foreground border-t-transparent" /></div>;

  return (
    <div className="space-y-4">
      {/* Actions row */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button variant="outline" size="sm" onClick={() => { setNewRef(""); setShowAdd(true); }} className="gap-1">
          <Plus className="h-3.5 w-3.5" /> Scheidsrechter toevoegen
        </Button>
        {categoryId && (
          <Button variant="outline" size="sm" onClick={openImport} className="gap-1">
            <Download className="h-3.5 w-3.5" /> Importeer uit divisies
          </Button>
        )}
        <p className="text-sm text-muted-foreground ml-auto">{referees.length} Scheidsrechter{referees.length !== 1 ? "s" : ""}</p>
      </div>

      {/* Grid of referees */}
      {referees.length === 0 ? (
        <div className="text-center py-12">
          <WhistleIcon className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">Nog geen scheidsrechters. Voeg je eerste scheidsrechter toe.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {referees.map((r, i) => (
            <div key={i} className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5">
              <WhistleIcon className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="flex-1 text-sm font-medium text-foreground truncate">{r}</span>
              <button onClick={() => { setEditIdx(i); setEditName(r); }} className="text-muted-foreground hover:text-foreground transition-colors shrink-0" title="Bewerken">
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button onClick={() => setDeleteIdx(i)} className="text-muted-foreground hover:text-destructive transition-colors shrink-0" title="Verwijderen">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

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
      <Dialog open={editIdx !== null} onOpenChange={(open) => { if (!open) { setEditIdx(null); setEditName(""); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Scheidsrechter bewerken</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Naam scheidsrechter" onKeyDown={(e) => e.key === "Enter" && editReferee()} autoFocus />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setEditIdx(null); setEditName(""); }}>Annuleren</Button>
              <Button onClick={editReferee} className="bg-foreground text-background hover:bg-foreground/90">Opslaan</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={deleteIdx !== null} onOpenChange={(open) => { if (!open) setDeleteIdx(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Scheidsrechter verwijderen?</AlertDialogTitle>
            <AlertDialogDescription>
              Weet je zeker dat je {deleteIdx !== null ? `"${referees[deleteIdx]}"` : "deze scheidsrechter"} wilt verwijderen?
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
