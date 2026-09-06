import { useState, useEffect } from "react";
import { HexColorPicker } from "react-colorful";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Pencil } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ColorZone {
  id: string;
  position_from: number;
  position_to: number;
  color: string;
  label: string | null;
}

const PRESET_COLORS = [
  "#22c55e", "#16a34a", "#3b82f6", "#2563eb", "#f59e0b",
  "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#f97316",
  "#6366f1", "#14b8a6", "#84cc16", "#e11d48", "#0ea5e9",
  "#a855f7", "#d946ef", "#64748b", "#78716c", "#000000",
];

const StandingColorManager = ({
  tournamentId,
  phaseId,
}: {
  tournamentId: string;
  phaseId: string;
}) => {
  const [zones, setZones] = useState<ColorZone[]>([]);
  const [showDialog, setShowDialog] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newFrom, setNewFrom] = useState<string>("1");
  const [newTo, setNewTo] = useState<string>("2");
  const [newColor, setNewColor] = useState("#22c55e");
  const [newLabel, setNewLabel] = useState("");
  const [hexInput, setHexInput] = useState("#22c55e");

  useEffect(() => {
    fetchZones();
  }, [phaseId]);

  const fetchZones = async () => {
    const { data } = await supabase
      .from("standing_colors")
      .select("*")
      .eq("phase_id", phaseId)
      .eq("tournament_id", tournamentId)
      .order("position_from");
    if (data) setZones(data);
  };

  const openDialog = (zone?: ColorZone) => {
    if (zone) {
      setEditingId(zone.id);
      setNewFrom(String(zone.position_from));
      setNewTo(String(zone.position_to));
      setNewColor(zone.color);
      setHexInput(zone.color);
      setNewLabel(zone.label || "");
    } else {
      setEditingId(null);
      setNewFrom("1");
      setNewTo("2");
      setNewColor("#22c55e");
      setHexInput("#22c55e");
      setNewLabel("");
    }
    setShowColorPicker(false);
    setShowDialog(true);
  };

  const saveZone = async () => {
    const from = parseInt(newFrom);
    const to = parseInt(newTo);
    if (!from || !to || from < 1 || to < 1) return;

    if (editingId) {
      const { data } = await supabase
        .from("standing_colors")
        .update({
          position_from: from,
          position_to: to,
          color: newColor,
          label: newLabel.trim() || null,
        })
        .eq("id", editingId)
        .select("*")
        .single();
      if (data) {
        setZones((z) => z.map((x) => (x.id === data.id ? data : x)).sort((a, b) => a.position_from - b.position_from));
        setShowDialog(false);
      }
    } else {
      const { data } = await supabase
        .from("standing_colors")
        .insert({
          tournament_id: tournamentId,
          phase_id: phaseId,
          position_from: from,
          position_to: to,
          color: newColor,
          label: newLabel.trim() || null,
        })
        .select("*")
        .single();
      if (data) {
        setZones((z) => [...z, data].sort((a, b) => a.position_from - b.position_from));
        setShowDialog(false);
      }
    }
  };

  const [deleteId, setDeleteId] = useState<string | null>(null);

  const confirmDelete = async () => {
    if (!deleteId) return;
    await supabase.from("standing_colors").delete().eq("id", deleteId);
    setZones((z) => z.filter((x) => x.id !== deleteId));
    setDeleteId(null);
  };

  const selectColor = (color: string) => {
    setNewColor(color);
    setHexInput(color);
  };

  const handleHexChange = (val: string) => {
    setHexInput(val);
    if (/^#[0-9a-fA-F]{6}$/.test(val)) {
      setNewColor(val);
    }
  };

  return (
    <div className="space-y-3">
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Kwalificatiezones
        </h4>
        <p className="text-xs text-muted-foreground mt-1">
          Stel kleurzones in voor het klassement
        </p>
      </div>

      {zones.map((zone) => (
        <div key={zone.id} className="flex items-center gap-2 text-sm">
          <div
            className="h-4 w-4 rounded-sm flex-shrink-0"
            style={{ backgroundColor: zone.color }}
          />
          <span className="text-muted-foreground">
            Pos {zone.position_from}–{zone.position_to}
          </span>
           {zone.label && (
             <span className="text-foreground font-medium">→ {zone.label}</span>
           )}
           <button
             onClick={() => openDialog(zone)}
             className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground sm:h-auto sm:w-auto sm:p-1"
             aria-label="Kwalificatiezone bewerken"
           >
             <Pencil className="h-3 w-3" />
           </button>
           <button
             onClick={() => setDeleteId(zone.id)}
             className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive sm:h-auto sm:w-auto sm:p-1"
             aria-label="Kwalificatiezone verwijderen"
           >
             <Trash2 className="h-3 w-3" />
           </button>
         </div>
       ))}

      <button
        onClick={() => openDialog()}
        className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
      >
        <Plus className="h-3 w-3" />
        <span>Zone</span>
      </button>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? "Zone bewerken" : "Zone toevoegen"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Van positie</Label>
                <Input
                  type="number"
                  min={1}
                  value={newFrom}
                  onChange={(e) => setNewFrom(e.target.value)}
                  className="h-9"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Tot positie</Label>
                <Input
                  type="number"
                  min={1}
                  value={newTo}
                  onChange={(e) => setNewTo(e.target.value)}
                  className="h-9"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Naam kwalificatiezone</Label>
              <Input
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="bv. Halve finale"
                className="h-9"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Kleur</Label>
              <div
                className="h-9 w-14 rounded-md border border-border cursor-pointer"
                style={{ backgroundColor: newColor }}
                onClick={() => setShowColorPicker((v) => !v)}
              />
              {showColorPicker && (
                <div className="space-y-3 pt-1">
                  <HexColorPicker color={newColor} onChange={(c) => { setNewColor(c); setHexInput(c); }} style={{ width: "100%" }} />
                  <Input
                    value={hexInput}
                    onChange={(e) => handleHexChange(e.target.value)}
                    placeholder="#000000"
                    className="h-8 font-mono text-sm w-32"
                    maxLength={7}
                  />
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setShowDialog(false)}>
              Annuleren
            </Button>
            <Button
              size="sm"
              onClick={saveZone}
              disabled={!newFrom || !newTo}
              className="bg-foreground text-background hover:bg-foreground/90"
            >
              {editingId ? "Opslaan" : "Toevoegen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Zone verwijderen?</AlertDialogTitle>
            <AlertDialogDescription>
              Weet je zeker dat je deze kwalificatiezone wilt verwijderen? Dit kan niet ongedaan worden gemaakt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Verwijderen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default StandingColorManager;
