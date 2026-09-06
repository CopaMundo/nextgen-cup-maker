import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Upload, Plus, Trash2, Pencil, X, CalendarPlus, FileText, Info, ArrowLeft, CalendarDays, MapPin, LayoutGrid, Trophy } from "lucide-react";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import { compressImage, getFileExtension } from "@/lib/compressImage";
import { SPORT_CATEGORIES, findSport } from "@/lib/sportsList";
import SportIcon from "@/components/SportIcon";
import { formatIsoDateForLocale, listIsoDatesInRange, normalizeIsoDates, MatchDayEntry } from "@/lib/dateUtils";
import TiebreakerManager from "./TiebreakerManager";
import ScoringSystemsManager from "./ScoringSystemsManager";
import { DatePicker } from "@/components/ui/datepicker";
import { useDialogFocus } from "@/hooks/useDialogFocus";
import { getFairplayConfig, FAIRPLAY_DEFAULTS } from "@/lib/fairplay";

import { DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable, sortableKeyboardCoordinates, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { SortableRowShell } from "@/components/SortableList";
import { GripVertical } from "lucide-react";

import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Location {
  id: string;
  name: string;
  sort_order?: number;
}

interface Category {
  id: string;
  name: string;
  sort_order: number;
}

interface Attachment {
  id: string;
  file_name: string;
  file_url: string;
  file_size: number | null;
}

const SortableRow = ({
  id,
  label,
  dragLabel,
  onRename,
  onDelete,
}: { id: string; label: string; dragLabel: string; onRename: () => void; onDelete: () => void }) => (
  <SortableRowShell
    id={id}
    dragLabel={dragLabel}
    className="flex items-center justify-between gap-2 text-sm rounded-lg border border-border bg-secondary px-3 py-2"
  >
    {(handle) => (
      <>
        <div className="flex items-center gap-1.5 min-w-0">
          {handle}
          <span className="text-foreground font-medium truncate">{label}</span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={onRename} className="text-muted-foreground hover:text-foreground"><Pencil className="h-3.5 w-3.5" /></button>
          <button onClick={onDelete} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
        </div>
      </>
    )}
  </SortableRowShell>
);



const TournamentGeneral = ({ tournament, onUpdate }: { tournament: any; onUpdate: (t: any) => void }) => {
  const { toast } = useToast();
  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const [locations, setLocations] = useState<Location[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [editCatName, setEditCatName] = useState("");
  const editCategoryDialogRef = useDialogFocus(!!editingCatId);
  const [editingLocId, setEditingLocId] = useState<string | null>(null);
  const [editLocName, setEditLocName] = useState("");
  const editLocationDialogRef = useDialogFocus(!!editingLocId);

  const [showAddLocation, setShowAddLocation] = useState(false);
  const [newLocationName, setNewLocationName] = useState("");
  const addLocationDialogRef = useDialogFocus(showAddLocation);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const addCategoryDialogRef = useDialogFocus(showAddCategory);
  const [showAddMatchDay, setShowAddMatchDay] = useState(false);
  const [newMatchDay, setNewMatchDay] = useState("");
  const addMatchDayDialogRef = useDialogFocus(showAddMatchDay);
  const [showAddPeriod, setShowAddPeriod] = useState(false);
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const addPeriodDialogRef = useDialogFocus(showAddPeriod);

  const [deleteLocId, setDeleteLocId] = useState<string | null>(null);
  const [deleteCatId, setDeleteCatId] = useState<string | null>(null);

  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [deleteAttachment, setDeleteAttachment] = useState<Attachment | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Edit name/description dialogs
  const [showEditName, setShowEditName] = useState(false);
  const [editName, setEditName] = useState("");
  const editNameDialogRef = useDialogFocus(showEditName);
  const [showEditDesc, setShowEditDesc] = useState(false);
  const [editDesc, setEditDesc] = useState("");
  const editDescDialogRef = useDialogFocus(showEditDesc);

  // Edit match day/period
  const [editMatchDayIdx, setEditMatchDayIdx] = useState<number | null>(null);
  const [editMatchDayValue, setEditMatchDayValue] = useState("");
  const editMatchDayDialogRef = useDialogFocus(editMatchDayIdx !== null);
  const [editPeriodIdx, setEditPeriodIdx] = useState<number | null>(null);
  const [editPeriodStart, setEditPeriodStart] = useState("");
  const [editPeriodEnd, setEditPeriodEnd] = useState("");
  const editPeriodDialogRef = useDialogFocus(editPeriodIdx !== null);
  const [deleteMatchDayIdx, setDeleteMatchDayIdx] = useState<number | null>(null);
  const [showEsportWarning, setShowEsportWarning] = useState(false);
  const [showSportPicker, setShowSportPicker] = useState(false);
  const [sportSearch, setSportSearch] = useState("");
  const [generalSubTab, setGeneralSubTab] = useState<"overview" | "info" | "wedstrijddagen" | "locaties" | "divisies" | "puntentelling">("overview");
  const [pendingParticipantSwitch, setPendingParticipantSwitch] = useState<"Teams" | "Spelers" | null>(null);

  const [form, setForm] = useState({
    name: tournament.name || "",
    description: tournament.description || "",
    start_date: tournament.start_date || "",
    end_date: tournament.end_date || "",
    
    match_days: (Array.isArray(tournament.match_days) ? tournament.match_days : typeof tournament.match_days === "string" ? (() => { try { const p = JSON.parse(tournament.match_days); return Array.isArray(p) ? p : []; } catch { return []; } })() : []) as MatchDayEntry[],
    points_win: tournament.points_win ?? 3,
    points_draw: tournament.points_draw ?? 1,
    points_loss: tournament.points_loss ?? 0,
    show_country: tournament.show_country ?? false,
    enable_goalscorers: tournament.enable_goalscorers ?? false,
    enable_assists: tournament.enable_assists ?? false,
    enable_yellow_cards: tournament.enable_yellow_cards ?? false,
    enable_red_cards: tournament.enable_red_cards ?? false,
    enable_fairplay: tournament.enable_fairplay ?? false,

    show_public_top_scorers: tournament.show_public_top_scorers ?? false,
    show_public_assists: tournament.show_public_assists ?? false,
    show_public_fairplay: tournament.show_public_fairplay ?? false,
    is_multi_category: tournament.is_multi_category ?? false,
    teams_label: tournament.teams_label || "Teams",
    referees_label: tournament.referees_label || "Scheidsrechters",
    is_esport: tournament.is_esport ?? false,
    sport: tournament.sport || "",
    scoring_type: (tournament.scoring_type as "points" | "sets") || "points",
  });

  const [showAdvancedPoints, setShowAdvancedPoints] = useState(false);

  const initialFp = getFairplayConfig(tournament);
  const [fpDraft, setFpDraft] = useState({
    yellow: String(initialFp.yellow),
    second_yellow: String(initialFp.second_yellow),
    red: String(initialFp.red),
    clean_match: String(initialFp.clean_match ?? 0),
    start: String(initialFp.start),
  });

  const saveFairplayConfig = async () => {
    const num = (v: string) => (v.trim() === "" ? 0 : Number(v));
    const config = {
      yellow: num(fpDraft.yellow),
      second_yellow: num(fpDraft.second_yellow),
      red: num(fpDraft.red),
      clean_match: num(fpDraft.clean_match),
      start: num(fpDraft.start),
    };
    setFpDraft({
      yellow: String(config.yellow),
      second_yellow: String(config.second_yellow),
      red: String(config.red),
      clean_match: String(config.clean_match),
      start: String(config.start),
    });
    const { error } = await supabase.from("tournaments").update({ fairplay_config: config } as any).eq("id", tournament.id);
    if (error) {
      toast({ title: "Opslaan mislukt", description: error.message, variant: "destructive" });
    } else {
      onUpdate({ ...tournament, ...form, fairplay_config: config });
    }
  };



  const saveToDb = async (updates: Partial<typeof form>) => {
    const newForm = { ...form, ...updates };
    setForm(newForm);
    const { error } = await supabase
      .from("tournaments")
      .update(updates as any)
      .eq("id", tournament.id);

    if (error) {
      toast({ title: "Opslaan mislukt", description: error.message, variant: "destructive" });
    } else {
      onUpdate({ ...tournament, ...newForm });
    }
  };


  const saveTournamentPeriod = async (updates: Partial<Pick<typeof form, "start_date" | "end_date">>) => {
    const nextPeriod = {
      start_date: updates.start_date ?? form.start_date,
      end_date: updates.end_date ?? form.end_date,
    };

    if (nextPeriod.start_date && nextPeriod.end_date && nextPeriod.start_date > nextPeriod.end_date) {
      toast({ title: "Startdatum moet voor einddatum liggen", variant: "destructive" });
      return;
    }

    await saveToDb(updates as Partial<typeof form>);
  };

  useEffect(() => {
    fetchLocations();
    fetchCategories();
    fetchAttachments();
  }, [tournament.id]);


  const fetchLocations = async () => {
    const { data } = await supabase
      .from("tournament_locations")
      .select("id, name, sort_order")
      .eq("tournament_id", tournament.id)
      .order("sort_order")
      .order("created_at");
    if (data) setLocations(data as Location[]);
  };


  const fetchCategories = async () => {
    const { data } = await supabase
      .from("tournament_categories")
      .select("id, name, sort_order")
      .eq("tournament_id", tournament.id)
      .order("sort_order");
    if (data) setCategories(data);
  };

  const fetchAttachments = async () => {
    const { data } = await supabase
      .from("tournament_attachments")
      .select("*")
      .eq("tournament_id", tournament.id)
      .order("created_at");
    if (data) setAttachments(data as Attachment[]);
  };

  const uploadAttachment = async (file: File) => {
    const ext = file.name.split(".").pop();
    const path = `${tournament.id}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("tournament-attachments").upload(path, file);
    if (error) {
      toast({ title: "Upload mislukt", description: error.message, variant: "destructive" });
      return;
    }

    const { data: { publicUrl } } = supabase.storage.from("tournament-attachments").getPublicUrl(path);
    const { data } = await supabase
      .from("tournament_attachments")
      .insert({ tournament_id: tournament.id, file_name: file.name, file_url: publicUrl, file_size: file.size } as any)
      .select("*")
      .single();

    if (data) {
      setAttachments((prev) => [...prev, data as Attachment]);
      toast({ title: "Bijlage geüpload" });
    }
  };

  const confirmRemoveAttachment = async () => {
    if (!deleteAttachment) return;
    await supabase.from("tournament_attachments").delete().eq("id", deleteAttachment.id);
    const urlParts = deleteAttachment.file_url.split("/tournament-attachments/");
    if (urlParts[1]) await supabase.storage.from("tournament-attachments").remove([urlParts[1]]);
    setAttachments((prev) => prev.filter((attachment) => attachment.id !== deleteAttachment.id));
    setDeleteAttachment(null);
    toast({ title: "Bijlage verwijderd" });
  };

  const formatSize = (bytes: number | null) => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const uploadLogo = async (rawFile: File) => {
    const file = await compressImage(rawFile);
    const ext = getFileExtension(file);
    const ts = Date.now();
    const fileName = `logo_${ts}.${ext}`;
    const path = `${tournament.id}/${fileName}`;
    const { data: existing } = await supabase.storage.from("team-logos").list(tournament.id, { limit: 100 });
    if (existing) {
      const oldLogos = existing.filter((f) => f.name.startsWith("logo")).map((f) => `${tournament.id}/${f.name}`);
      if (oldLogos.length > 0) await supabase.storage.from("team-logos").remove(oldLogos);
    }
    const { error } = await supabase.storage.from("team-logos").upload(path, file, { upsert: true });
    if (error) {
      toast({ title: "Upload mislukt", description: error.message, variant: "destructive" });
      return;
    }
    const { data: { publicUrl } } = supabase.storage.from("team-logos").getPublicUrl(path);
    await supabase.from("tournaments").update({ logo_url: publicUrl } as any).eq("id", tournament.id);
    onUpdate({ ...tournament, logo_url: publicUrl });
    toast({ title: "Logo geüpload" });
  };

  const uploadCover = async (rawFile: File) => {
    const file = await compressImage(rawFile);
    const ext = getFileExtension(file);
    const ts = Date.now();
    const fileName = `cover_${ts}.${ext}`;
    const path = `${tournament.id}/${fileName}`;
    const { data: existing } = await supabase.storage.from("team-logos").list(tournament.id, { limit: 100 });
    if (existing) {
      const oldCovers = existing.filter((f) => f.name.startsWith("cover")).map((f) => `${tournament.id}/${f.name}`);
      if (oldCovers.length > 0) await supabase.storage.from("team-logos").remove(oldCovers);
    }
    const { error } = await supabase.storage.from("team-logos").upload(path, file, { upsert: true });
    if (error) {
      toast({ title: "Upload mislukt", description: error.message, variant: "destructive" });
      return;
    }
    const { data: { publicUrl } } = supabase.storage.from("team-logos").getPublicUrl(path);
    await supabase.from("tournaments").update({ cover_url: publicUrl } as any).eq("id", tournament.id);
    onUpdate({ ...tournament, cover_url: publicUrl });
    toast({ title: "Omslagfoto geüpload" });
  };

  const handleLocationDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = locations.findIndex((l) => l.id === active.id);
    const newIndex = locations.findIndex((l) => l.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const reordered = arrayMove(locations, oldIndex, newIndex).map((l, i) => ({ ...l, sort_order: i }));
    setLocations(reordered);
    await Promise.all(
      reordered.map((l) => supabase.from("tournament_locations").update({ sort_order: l.sort_order } as any).eq("id", l.id)),
    );
    toast({ title: "Volgorde locaties opgeslagen" });
  };

  const addLocation = async () => {
    if (!newLocationName.trim()) return;
    const { data } = await supabase
      .from("tournament_locations")
      .insert({ tournament_id: tournament.id, name: newLocationName.trim(), sort_order: locations.length } as any)
      .select("id, name, sort_order")
      .single();
    if (data) {
      setLocations((prev) => [...prev, data as Location]);

      setNewLocationName("");
      setShowAddLocation(false);
    }
  };

  const confirmRemoveLocation = async () => {
    if (!deleteLocId) return;
    await supabase.from("tournament_locations").delete().eq("id", deleteLocId);
    setLocations((prev) => prev.filter((location) => location.id !== deleteLocId));
    setDeleteLocId(null);
  };

  const addCategory = async () => {
    if (!newCategoryName.trim()) return;
    const { data } = await supabase
      .from("tournament_categories")
      .insert({ tournament_id: tournament.id, name: newCategoryName.trim(), sort_order: categories.length })
      .select("id, name, sort_order")
      .single();
    if (data) {
      setCategories((prev) => [...prev, data]);
      setNewCategoryName("");
      setShowAddCategory(false);
      if (!form.is_multi_category) {
        saveToDb({ is_multi_category: true });
      }
    }
  };

  const confirmRemoveCategory = async () => {
    if (!deleteCatId) return;
    await supabase.from("tournament_categories").delete().eq("id", deleteCatId);
    const remaining = categories.filter((category) => category.id !== deleteCatId);
    setCategories(remaining);
    setDeleteCatId(null);
    if (remaining.length === 0) {
      saveToDb({ is_multi_category: false });
    }
  };

  const handleCategoryDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = categories.findIndex((c) => c.id === active.id);
    const newIndex = categories.findIndex((c) => c.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const reordered = arrayMove(categories, oldIndex, newIndex).map((c, i) => ({ ...c, sort_order: i }));
    setCategories(reordered);
    await Promise.all(
      reordered.map((c) => supabase.from("tournament_categories").update({ sort_order: c.sort_order }).eq("id", c.id)),
    );
    toast({ title: "Volgorde divisies opgeslagen" });
  };

  const saveCategoryRename = async () => {
    if (!editingCatId || !editCatName.trim()) return;
    await supabase.from("tournament_categories").update({ name: editCatName.trim() }).eq("id", editingCatId);
    setCategories((prev) => prev.map((category) => category.id === editingCatId ? { ...category, name: editCatName.trim() } : category));
    setEditingCatId(null);
  };

  const saveLocationRename = async () => {
    if (!editingLocId || !editLocName.trim()) return;
    await supabase.from("tournament_locations").update({ name: editLocName.trim() }).eq("id", editingLocId);
    setLocations((prev) => prev.map((location) => location.id === editingLocId ? { ...location, name: editLocName.trim() } : location));
    setEditingLocId(null);
  };

  const saveMatchDays = async (rawEntries: MatchDayEntry[]) => {
    const entryStart = (e: MatchDayEntry) => (typeof e === "string" ? e : e.start);
    const entries = [...rawEntries].sort((a, b) => entryStart(a).localeCompare(entryStart(b)));
    setForm((prev) => ({ ...prev, match_days: entries }));

    const { error } = await supabase
      .from("tournaments")
      .update({ match_days: entries as any })
      .eq("id", tournament.id);

    if (error) {
      console.error("saveMatchDays error:", error);
      toast({ title: "Opslaan mislukt", description: error.message, variant: "destructive" });
      return;
    }

    onUpdate({ ...tournament, match_days: entries });
    toast({ title: "Wedstrijddagen opgeslagen" });
  };

  const addMatchDay = async () => {
    if (!newMatchDay) return;
    // Check duplicates against expanded dates
    const existingDates = (form.match_days || []).flatMap((e: MatchDayEntry) =>
      typeof e === "string" ? [e] : listIsoDatesInRange(e.start, e.end)
    );
    if (existingDates.includes(newMatchDay)) {
      toast({ title: "Deze dag staat er al bij", variant: "destructive" });
      return;
    }
    await saveMatchDays([...(form.match_days || []), newMatchDay]);
    setNewMatchDay("");
    setShowAddMatchDay(false);
  };

  const removeMatchDayEntry = async (index: number) => {
    const entries = (form.match_days || []) as MatchDayEntry[];
    const removedEntry = entries[index];
    const updated = entries.filter((_: MatchDayEntry, i: number) => i !== index);

    // Dates that no longer exist after removal → unschedule their matches
    const expand = (e: MatchDayEntry) => (typeof e === "string" ? [e] : listIsoDatesInRange(e.start, e.end));
    const remainingDates = new Set(updated.flatMap(expand));
    const orphanDates = removedEntry ? expand(removedEntry).filter((d) => !remainingDates.has(d)) : [];

    await saveMatchDays(updated);

    if (orphanDates.length > 0) {
      await supabase
        .from("matches")
        .update({ match_date: null, match_time: null, field: null })
        .eq("tournament_id", tournament.id)
        .in("match_date", orphanDates);
    }
  };


  const addPeriod = async () => {
    if (!periodStart || !periodEnd) return;
    if (periodStart > periodEnd) {
      toast({ title: "Startdatum moet voor einddatum liggen", variant: "destructive" });
      return;
    }
    const periodDays = listIsoDatesInRange(periodStart, periodEnd);
    if (periodDays.length === 0) {
      toast({ title: "Ongeldige periode", variant: "destructive" });
      return;
    }
    await saveMatchDays([...(form.match_days || []), { start: periodStart, end: periodEnd }]);
    setPeriodStart("");
    setPeriodEnd("");
    setShowAddPeriod(false);
  };


  const formatDate = (date: string) => {
    return formatIsoDateForLocale(date, "nl-BE", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
  };

  return (
    <>
      <div className="space-y-6 w-full">
        {generalSubTab === "overview" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {([
              { id: "info", label: "Toernooi informatie", description: "Naam, beschrijving, sport, logo, omslagfoto en bijlagen", icon: Info },
              { id: "wedstrijddagen", label: "Wedstrijddagen", description: "Losse dagen of periodes waarop er gespeeld wordt", icon: CalendarDays },
              { id: "locaties", label: "Locaties", description: "Speelvelden of locaties voor je toernooi", icon: MapPin },
              { id: "divisies", label: "Divisies", description: "Verdeel je toernooi in leeftijds- of niveaugroepen", icon: LayoutGrid },
              { id: "puntentelling", label: "Puntensysteem", description: "Punten, sets, spelersstatistieken en fairplay", icon: Trophy },
            ] as const).map((card) => {
              const Icon = card.icon;
              return (
                <button
                  key={card.id}
                  onClick={() => setGeneralSubTab(card.id)}
                  className="group text-left rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/50 hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className="rounded-full border border-border bg-secondary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
                      Openen
                    </span>
                  </div>
                  <div className="mt-4">
                    <h3 className="font-display text-base font-bold text-foreground">{card.label}</h3>
                    <p className="mt-1 text-sm text-muted-foreground leading-snug">{card.description}</p>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="flex items-center gap-3 mb-2">
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setGeneralSubTab("overview")} aria-label="Terug naar overzicht">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h2 className="font-display text-lg font-bold text-foreground">
              {(() => {
                const titles: Record<Exclude<typeof generalSubTab, "overview">, string> = {
                  info: "Toernooi informatie",
                  wedstrijddagen: "Wedstrijddagen",
                  locaties: "Locaties",
                  divisies: "Divisies",
                  puntentelling: "Puntensysteem",
                };
                return titles[generalSubTab];
              })()}
            </h2>
          </div>
        )}

        {generalSubTab === "info" && (
        <div className="rounded-xl border border-border bg-card p-6 space-y-4">
          <div className="space-y-2">
            <Label>Toernooinaam</Label>
            {isMobile ? (
              <Input
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== tournament.name) saveToDb({ name: v }); }}
                placeholder="Naam van het toernooi"
              />
            ) : (
              <div
                onClick={() => { setEditName(form.name); setShowEditName(true); }}
                className="cursor-pointer rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground hover:border-primary/50 transition-colors"
              >
                {form.name || <span className="text-muted-foreground">Klik om naam in te vullen</span>}
              </div>
            )}
          </div>
          <div className="space-y-2">
            <Label>Beschrijving</Label>
            <p className="text-xs text-muted-foreground">Deze beschrijving is het eerste wat bezoekers zien op de toernooipagina.</p>
            {isMobile ? (
              <Textarea
                value={form.description}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                onBlur={(e) => { if (e.target.value !== (tournament as any).description) saveToDb({ description: e.target.value }); }}
                rows={4}
                placeholder="Beschrijving van het toernooi"
              />
            ) : (
              <div
                onClick={() => { setEditDesc(form.description); setShowEditDesc(true); }}
                className="cursor-pointer rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground hover:border-primary/50 transition-colors h-[60px] overflow-hidden line-clamp-2 whitespace-pre-wrap"
              >
                {form.description || <span className="text-muted-foreground">Klik om beschrijving toe te voegen</span>}
              </div>
            )}
          </div>


          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 h-5"><Label>Sport</Label></div>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowSportPicker(!showSportPicker)}
                  className="flex items-center gap-2 w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground hover:border-primary/50 transition-colors text-left h-10"
                >
                  {(() => {
                    const found = findSport(form.sport);
                    return found ? (
                      <>
                        <SportIcon sport={found.name} size={16} className="shrink-0" white />
                        <span className="font-medium truncate">{found.name}</span>
                      </>
                    ) : (
                      <span className="text-muted-foreground">Kies een sport</span>
                    );
                  })()}
                </button>
                {showSportPicker && (
                  <div className="absolute z-50 mt-1 w-full max-h-80 overflow-auto rounded-lg border border-border bg-popover shadow-lg">
                    <div className="p-2">
                      <Input
                        placeholder="Zoek sport..."
                        value={sportSearch}
                        onChange={(e) => setSportSearch(e.target.value)}
                        className="h-8 text-sm"
                        autoFocus
                      />
                    </div>
                    {SPORT_CATEGORIES.map((cat) => {
                      const filtered = cat.options.filter((s) =>
                        s.name.toLowerCase().includes(sportSearch.toLowerCase())
                      );
                      if (filtered.length === 0) return null;
                      return (
                        <div key={cat.label}>
                          <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide bg-muted/50">
                            {cat.label}
                          </div>
                          {filtered.map((sport) => (
                            <button
                              key={sport.name}
                              type="button"
                              onClick={() => {
                                saveToDb({ sport: sport.name } as any);
                                setShowSportPicker(false);
                                setSportSearch("");
                              }}
                              className={cn(
                                "flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-accent transition-colors text-left",
                                form.sport === sport.name && "bg-primary/10 text-primary font-medium"
                              )}
                            >
                              <SportIcon sport={sport.name} size={16} className="shrink-0" white />
                              <span>{sport.name}</span>
                            </button>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Type deelnemers: Teams / Spelers */}
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 h-5"><Label>Type deelnemers</Label></div>
              <div className="grid grid-cols-2 rounded-md border border-border bg-secondary p-1 h-10">
                {(["Teams", "Spelers"] as const).map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => {
                      if (form.teams_label === opt) return;
                      if (opt === "Spelers") {
                        setPendingParticipantSwitch(opt);
                      } else {
                        saveToDb({ teams_label: opt });
                      }
                    }}
                    className={cn(
                      "rounded-sm text-xs font-semibold uppercase tracking-wide transition-colors",
                      form.teams_label === opt
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>



            <div className="space-y-2">
              <div className="flex items-center gap-1.5 h-5">
                <Label>Landvlag bij deelnemers</Label>
                <TooltipProvider delayDuration={150}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button type="button" className="text-muted-foreground hover:text-foreground transition-colors">
                        <Info className="h-3.5 w-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs text-xs">
                      Landvlaggen worden getoond achter de naam van de deelnemers op de toernooipagina.
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <div className="flex items-center justify-between gap-2 rounded-md border border-border bg-secondary px-3 h-10">
                <span className="text-sm text-muted-foreground">
                  {form.show_country ? "Tonen" : "Verbergen"}
                </span>
                <Switch
                  checked={form.show_country}
                  onCheckedChange={(value) => saveToDb({ show_country: value })}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Logo</Label>
              <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-4">
                {tournament.logo_url && (
                  <img src={tournament.logo_url} alt="Logo" className="h-16 w-16 rounded-lg object-contain bg-secondary" />
                 )}
                <input id="logo-upload" type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && uploadLogo(e.target.files[0])} />
                <Button variant="outline" size="sm" onClick={() => document.getElementById('logo-upload')?.click()}>
                  <Upload className="h-4 w-4" /> Logo uploaden
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Omslagfoto</Label>
              <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-4">
                {tournament.cover_url && (
                  <img src={tournament.cover_url} alt="Cover" className="h-16 w-28 rounded-lg object-cover bg-secondary" />
                )}
                <input id="cover-upload" type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && uploadCover(e.target.files[0])} />
                <Button variant="outline" size="sm" onClick={() => document.getElementById('cover-upload')?.click()}>
                  <Upload className="h-4 w-4" /> Omslagfoto uploaden
                </Button>
              </div>
            </div>
          </div>

          <div className="space-y-2 pt-2 border-t border-border">
            <Label>Bijlagen</Label>
            <p className="text-xs text-muted-foreground">Upload hier documenten die bezoekers kunnen downloaden op je toernooipagina.</p>
            {attachments.length > 0 && (
              <div className="space-y-1">
                {attachments.map((attachment) => (
                  <div key={attachment.id} className="flex items-center justify-between rounded-lg border border-border bg-secondary p-2.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <a href={attachment.file_url} target="_blank" rel="noopener" className="text-sm font-medium text-foreground hover:text-primary truncate">{attachment.file_name}</a>
                      <span className="text-xs text-muted-foreground flex-shrink-0">{formatSize(attachment.file_size)}</span>
                    </div>
                    <button onClick={() => setDeleteAttachment(attachment)} className="text-muted-foreground hover:text-destructive flex-shrink-0 ml-2">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <input ref={fileInputRef} type="file" className="hidden" onChange={(e) => { if (e.target.files?.[0]) uploadAttachment(e.target.files[0]); e.target.value = ""; }} />
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
              <Upload className="h-4 w-4" /> Bijlage uploaden
            </Button>
          </div>
        </div>
        )}


        {generalSubTab === "wedstrijddagen" && (
          <div className="rounded-xl border border-border bg-card p-6 space-y-4">
            <p className="text-xs text-muted-foreground">Voeg hier losse wedstrijddagen of meteen een volledige periode toe. De dagen staan automatisch op chronologische volgorde.</p>

            {(form.match_days || []).length > 0 && (
              <div className="space-y-1">
                {(form.match_days as MatchDayEntry[]).map((entry, idx) => {
                  if (typeof entry === "string") {
                    return (
                      <div key={`day-${idx}`} className="flex items-center justify-between text-sm rounded-lg border border-border bg-secondary px-3 py-2">
                        <div className="flex items-center gap-2">
                          <CalendarPlus className="h-4 w-4 text-primary" />
                          <span className="text-foreground font-medium">{formatDate(entry)}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <button onClick={() => { setEditMatchDayIdx(idx); setEditMatchDayValue(entry); }} className="text-muted-foreground hover:text-foreground">
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => setDeleteMatchDayIdx(idx)} className="text-muted-foreground hover:text-destructive">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  }
                  return (
                    <div key={`period-${idx}`} className="flex items-center justify-between text-sm rounded-lg border border-primary/30 bg-primary/5 px-3 py-2">
                      <div className="flex items-center gap-2">
                        <CalendarPlus className="h-4 w-4 text-primary" />
                        <span className="text-foreground font-medium">{formatDate(entry.start)} – {formatDate(entry.end)}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => { setEditPeriodIdx(idx); setEditPeriodStart(entry.start); setEditPeriodEnd(entry.end); }} className="text-muted-foreground hover:text-foreground">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => setDeleteMatchDayIdx(idx)} className="text-muted-foreground hover:text-destructive">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button variant="outline" size="sm" onClick={() => { setNewMatchDay(""); setShowAddMatchDay(true); }}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Wedstrijddag toevoegen
              </Button>
              <Button variant="outline" size="sm" onClick={() => { setPeriodStart(""); setPeriodEnd(""); setShowAddPeriod(true); }}>
                <CalendarPlus className="h-3.5 w-3.5 mr-1" /> Periode toevoegen
              </Button>
            </div>
          </div>
        )}

        {generalSubTab === "locaties" && (
          <div className="rounded-xl border border-border bg-card p-6 space-y-4">
            {!form.is_esport && (
              <>
                {locations.length > 0 && (
                  <DndContext
                    sensors={dndSensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleLocationDragEnd}
                  >
                    <SortableContext items={locations.map((l) => l.id)} strategy={verticalListSortingStrategy}>
                      <div className="space-y-1">
                        {locations.map((loc) => (
                          <SortableRow
                            key={loc.id}
                            id={loc.id}
                            label={loc.name}
                            dragLabel="Locatie verplaatsen"
                            onRename={() => { setEditingLocId(loc.id); setEditLocName(loc.name); }}
                            onDelete={() => setDeleteLocId(loc.id)}
                          />
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                )}

                <Button variant="outline" size="sm" onClick={() => { setNewLocationName(""); setShowAddLocation(true); }}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Locatie toevoegen
                </Button>
              </>
            )}

            <TooltipProvider>
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-medium text-foreground">Dit is een online (eSport) toernooi</p>
                <Switch
                  checked={form.is_esport}
                  onCheckedChange={async (value) => {
                    if (value) {
                      const { count } = await supabase
                        .from("matches")
                        .select("id", { count: "exact", head: true })
                        .eq("tournament_id", tournament.id)
                        .not("field", "is", null);
                      if ((count ?? 0) > 0) {
                        setShowEsportWarning(true);
                        return;
                      }
                    }
                    saveToDb({ is_esport: value });
                  }}
                />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-[240px] text-xs">
                    Bij een online toernooi worden de wedstrijden automatisch in rondes verdeeld. Je kunt hiervoor geen veldplanning maken.
                  </TooltipContent>
                </Tooltip>
              </div>
            </TooltipProvider>
          </div>
        )}

        {generalSubTab === "divisies" && (
          <div className="rounded-xl border border-border bg-card p-6 space-y-4">
            <p className="text-xs text-muted-foreground">
              Verdeel je toernooi in divisies op basis van leeftijd of niveau. Elke divisie krijgt een eigen deelnemerslijst, indeling en schema.
            </p>

            {categories.length > 0 && (
              <DndContext
                sensors={dndSensors}
                collisionDetection={closestCenter}
                onDragEnd={handleCategoryDragEnd}
              >
                <SortableContext items={categories.map((c) => c.id)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-1">
                    {categories.map((cat) => (
                      <SortableRow
                        key={cat.id}
                        id={cat.id}
                        label={cat.name}
                        dragLabel="Divisie verplaatsen"
                        onRename={() => { setEditingCatId(cat.id); setEditCatName(cat.name); }}
                        onDelete={() => setDeleteCatId(cat.id)}
                      />

                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}

            <Button variant="outline" size="sm" onClick={() => { setNewCategoryName(""); setShowAddCategory(true); }}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Divisie toevoegen
            </Button>
          </div>
        )}

        {generalSubTab === "puntentelling" && (
          <div className="space-y-6">
            <div className="rounded-xl border border-border bg-card p-6 space-y-4">
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 h-5"><Label>Puntentelling</Label></div>
                <p className="text-xs text-muted-foreground">Kies tussen punten of sets, bepaal de puntentoekenning en stel de rangschikkingsregels vast voor een gelijke stand in de poule. Voeg meerdere puntentellingen toe om ze later per format, groep of wedstrijd te kunnen kiezen.</p>
              </div>
              <ScoringSystemsManager tournamentId={tournament.id} tournament={tournament} onUpdate={onUpdate} />
            </div>

            <div className="rounded-xl border border-border bg-card p-6 space-y-4">
              <div className="space-y-2">
                <h3 className="font-display text-base font-bold text-foreground">Spelersstatistieken</h3>
                <p className="text-xs text-muted-foreground max-w-3xl">
                  Als je spelers aan je teams hebt toegevoegd, kun je hieronder kiezen welke spelersstatistieken je per wedstrijd wilt bijhouden. Een klassement voor doelpuntenmakers en assists wordt automatisch zichtbaar op de publieke toernooiwebsite zodra je deze aanvinkt.
                </p>
              </div>
              <div className="grid gap-3 lg:grid-cols-2">
                {[
                  { key: "enable_goalscorers", publicKey: "show_public_top_scorers", label: "Doelpuntenmakers" },
                  { key: "enable_assists", publicKey: "show_public_assists", label: "Assists" },
                ].map(({ key, publicKey, label }) => {
                  const isEnabled = form[key as keyof typeof form] as boolean;

                  return (
                  <div key={key} className="rounded-lg border border-border bg-background/40 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <h4 className="text-sm font-semibold text-foreground">{label}</h4>
                      <Switch
                        checked={isEnabled}
                        onCheckedChange={(value) => {
                          const updates: any = { [key]: value };
                          if (publicKey) updates[publicKey] = value;
                          saveToDb(updates);
                        }}
                      />
                    </div>
                  </div>
                  );
                })}
              </div>

              <div className="rounded-lg border border-border bg-background/40 p-4 space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <h4 className="text-sm font-semibold text-foreground">Kaarten</h4>
                  <Switch
                    checked={form.enable_yellow_cards}
                    onCheckedChange={(value) => {
                      const updates: any = { enable_yellow_cards: value, enable_red_cards: value };
                      if (!value) updates.enable_fairplay = false;
                      saveToDb(updates);
                    }}
                  />
                </div>

              {form.enable_yellow_cards && (
                <div className="rounded-lg border border-border bg-card p-4 space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h4 className="text-sm font-semibold text-foreground">Fairplayklassement</h4>
                      <p className="text-xs text-muted-foreground mt-0.5">Alleen zichtbaar in de beheeromgeving. Je kunt fairplay ook toevoegen als criterium bij gelijke punten in de puntentelling.</p>
                    </div>
                    <Switch
                      checked={form.enable_fairplay}
                      onCheckedChange={(value) => {
                        const updates: any = { enable_fairplay: value };
                        if (value && !tournament.fairplay_config) updates.fairplay_config = { ...FAIRPLAY_DEFAULTS };
                        saveToDb(updates);
                      }}
                    />
                  </div>


                  {form.enable_fairplay && (
                    <div className="space-y-3">
                      <p className="text-xs text-muted-foreground">Bepaal hoeveel strafpunten elke kaart kost. Een gele kaart gevolgd door een rechtstreekse rode kaart voor dezelfde speler telt op (standaard 1 + 5 = 6 strafpunten).</p>
                      <TooltipProvider delayDuration={150}>
                        <div className="grid gap-3 sm:grid-cols-3">
                          {([
                            { key: "yellow", icon: <div className="h-4 w-3 rounded-sm bg-yellow-400" />, tip: "Gele kaart" },
                            { key: "second_yellow", icon: (
                              <span className="inline-flex items-center">
                                <div className="h-4 w-3 rounded-sm bg-yellow-400" />
                                <div className="h-4 w-3 rounded-sm bg-red-500 -ml-1" />
                              </span>
                            ), tip: "Tweede gele kaart → rood" },
                            { key: "red", icon: <div className="h-4 w-3 rounded-sm bg-red-500" />, tip: "Rechtstreekse rode kaart" },
                          ] as const).map(({ key, icon, tip }) => (
                            <div key={key} className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="inline-flex items-center cursor-help">{icon}</span>
                                </TooltipTrigger>
                                <TooltipContent>{tip}</TooltipContent>
                              </Tooltip>
                              <span className="text-xs text-muted-foreground flex-1">strafpunten</span>
                              <Input
                                type="number"
                                min={0}
                                className="h-8 w-16 text-center"
                                value={fpDraft[key]}
                                onChange={(e) => setFpDraft((p) => ({ ...p, [key]: e.target.value }))}
                                onBlur={() => saveFairplayConfig()}
                              />
                            </div>
                          ))}
                        </div>
                      </TooltipProvider>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1.5">
                          <Label className="text-xs">Punten voor een wedstrijd zonder kaarten</Label>
                          <Input
                            type="number"
                            className="h-8"
                            placeholder="0"
                            value={fpDraft.clean_match}
                            onChange={(e) => setFpDraft((p) => ({ ...p, clean_match: e.target.value }))}
                            onBlur={() => saveFairplayConfig()}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Startpuntentotaal</Label>
                          <Input
                            type="number"
                            className="h-8"
                            value={fpDraft.start}
                            onChange={(e) => setFpDraft((p) => ({ ...p, start: e.target.value }))}
                            onBlur={() => saveFairplayConfig()}
                          />
                        </div>
                      </div>
                      
                    </div>
                  )}
                </div>
              )}
              </div>

            </div>
          </div>
        )}
      </div>

      <Dialog open={showAddLocation} onOpenChange={setShowAddLocation}>
        <DialogContent ref={addLocationDialogRef} className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Locatie toevoegen</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Naam</Label>
            <Input
              value={newLocationName}
              onChange={(e) => setNewLocationName(e.target.value)}
              placeholder="Bijv. Sporthal Centrum"
              onKeyDown={(e) => e.key === "Enter" && addLocation()}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddLocation(false)}>Annuleren</Button>
            <Button onClick={addLocation} disabled={!newLocationName.trim()}>Toevoegen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showAddCategory} onOpenChange={setShowAddCategory}>
        <DialogContent ref={addCategoryDialogRef} className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Divisie toevoegen</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Naam</Label>
            <Input
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder="Bijv. U13, Seniors"
              onKeyDown={(e) => e.key === "Enter" && addCategory()}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddCategory(false)}>Annuleren</Button>
            <Button onClick={addCategory} disabled={!newCategoryName.trim()}>Toevoegen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showAddMatchDay} onOpenChange={setShowAddMatchDay}>
        <DialogContent ref={addMatchDayDialogRef} className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Wedstrijddag toevoegen</DialogTitle>
            <DialogDescription>Kies een datum waarop er gespeeld wordt.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Datum</Label>
            <DatePicker
              value={newMatchDay}
              onChange={(date) => setNewMatchDay(date)}
              placeholder="Kies een datum"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddMatchDay(false)}>Annuleren</Button>
            <Button onClick={addMatchDay} disabled={!newMatchDay}>Toevoegen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showAddPeriod} onOpenChange={setShowAddPeriod}>
        <DialogContent ref={addPeriodDialogRef} className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Periode toevoegen</DialogTitle>
            <DialogDescription>Alle dagen binnen deze periode worden toegevoegd als extra wedstrijddagen.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Startdatum</Label>
              <DatePicker
                value={periodStart}
                onChange={(date) => setPeriodStart(date)}
                placeholder="Startdatum"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Einddatum</Label>
              <DatePicker
                value={periodEnd}
                onChange={(date) => setPeriodEnd(date)}
                placeholder="Einddatum"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddPeriod(false)}>Annuleren</Button>
            <Button onClick={addPeriod} disabled={!periodStart || !periodEnd}>Toevoegen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteLocId} onOpenChange={(open) => !open && setDeleteLocId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Locatie verwijderen?</AlertDialogTitle>
            <AlertDialogDescription>Weet je zeker dat je deze locatie wilt verwijderen?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRemoveLocation} className="bg-destructive text-destructive-foreground">Verwijderen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteCatId} onOpenChange={(open) => !open && setDeleteCatId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Divisie verwijderen?</AlertDialogTitle>
            <AlertDialogDescription>Weet je zeker dat je deze divisie wilt verwijderen? Alle bijbehorende teams en fases worden ook verwijderd.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRemoveCategory} className="bg-destructive text-destructive-foreground">Verwijderen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteAttachment} onOpenChange={(open) => !open && setDeleteAttachment(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Bijlage verwijderen?</AlertDialogTitle>
            <AlertDialogDescription>Weet je zeker dat je &quot;{deleteAttachment?.file_name}&quot; wilt verwijderen?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRemoveAttachment} className="bg-destructive text-destructive-foreground">Verwijderen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!editingCatId} onOpenChange={(open) => !open && setEditingCatId(null)}>
        <DialogContent ref={editCategoryDialogRef} className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Divisie bewerken</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Naam</Label>
            <Input
              value={editCatName}
              onChange={(e) => setEditCatName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && saveCategoryRename()}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingCatId(null)}>Annuleren</Button>
            <Button onClick={saveCategoryRename} disabled={!editCatName.trim()}>Opslaan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingLocId} onOpenChange={(open) => !open && setEditingLocId(null)}>
        <DialogContent ref={editLocationDialogRef} className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Locatie bewerken</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Naam</Label>
            <Input
              value={editLocName}
              onChange={(e) => setEditLocName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && saveLocationRename()}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingLocId(null)}>Annuleren</Button>
            <Button onClick={saveLocationRename} disabled={!editLocName.trim()}>Opslaan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Name Dialog */}
      <Dialog open={showEditName} onOpenChange={setShowEditName}>
        <DialogContent ref={editNameDialogRef} className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Toernooinaam</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { saveToDb({ name: editName }); setShowEditName(false); } }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditName(false)}>Annuleren</Button>
            <Button onClick={() => { saveToDb({ name: editName }); setShowEditName(false); }} disabled={!editName.trim()}>Opslaan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Description Dialog */}
      <Dialog open={showEditDesc} onOpenChange={setShowEditDesc}>
        <DialogContent ref={editDescDialogRef} className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Beschrijving</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Textarea
              value={editDesc}
              onChange={(e) => setEditDesc(e.target.value)}
              rows={10}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDesc(false)}>Annuleren</Button>
            <Button onClick={() => { saveToDb({ description: editDesc }); setShowEditDesc(false); }}>Opslaan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Match Day Dialog */}
      <Dialog open={editMatchDayIdx !== null} onOpenChange={(open) => !open && setEditMatchDayIdx(null)}>
        <DialogContent ref={editMatchDayDialogRef} className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Wedstrijddag bewerken</DialogTitle>
            <DialogDescription>Pas de datum aan.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Datum</Label>
            <DatePicker
              value={editMatchDayValue}
              onChange={(date) => setEditMatchDayValue(date)}
              placeholder="Kies een datum"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditMatchDayIdx(null)}>Annuleren</Button>
            <Button onClick={() => {
              if (editMatchDayIdx === null || !editMatchDayValue) return;
              const updated = [...(form.match_days || [])];
              updated[editMatchDayIdx] = editMatchDayValue;
              saveMatchDays(updated);
              setEditMatchDayIdx(null);
            }} disabled={!editMatchDayValue}>Opslaan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Period Dialog */}
      <Dialog open={editPeriodIdx !== null} onOpenChange={(open) => !open && setEditPeriodIdx(null)}>
        <DialogContent ref={editPeriodDialogRef} className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Periode bewerken</DialogTitle>
            <DialogDescription>Pas de start- en einddatum aan.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Startdatum</Label>
              <DatePicker
                value={editPeriodStart}
                onChange={(date) => setEditPeriodStart(date)}
                placeholder="Startdatum"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Einddatum</Label>
              <DatePicker
                value={editPeriodEnd}
                onChange={(date) => setEditPeriodEnd(date)}
                placeholder="Einddatum"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditPeriodIdx(null)}>Annuleren</Button>
            <Button onClick={() => {
              if (editPeriodIdx === null || !editPeriodStart || !editPeriodEnd) return;
              if (editPeriodStart > editPeriodEnd) {
                toast({ title: "Startdatum moet voor einddatum liggen", variant: "destructive" });
                return;
              }
              const updated = [...(form.match_days || [])];
              updated[editPeriodIdx] = { start: editPeriodStart, end: editPeriodEnd };
              saveMatchDays(updated);
              setEditPeriodIdx(null);
            }} disabled={!editPeriodStart || !editPeriodEnd}>Opslaan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Match Day / Period confirmation */}
      <AlertDialog open={deleteMatchDayIdx !== null} onOpenChange={(open) => !open && setDeleteMatchDayIdx(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Verwijderen?</AlertDialogTitle>
            <AlertDialogDescription>Weet je zeker dat je deze wedstrijddag of periode wilt verwijderen?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (deleteMatchDayIdx !== null) { removeMatchDayEntry(deleteMatchDayIdx); setDeleteMatchDayIdx(null); } }} className="bg-destructive text-destructive-foreground">Verwijderen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Esport Warning Dialog */}
      <AlertDialog open={showEsportWarning} onOpenChange={setShowEsportWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Overschakelen naar esport?</AlertDialogTitle>
            <AlertDialogDescription>
              Er zijn wedstrijden met een veldplanning. Als je overschakelt naar een online toernooi worden alle veldtoewijzingen en schema's verwijderd.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground"
              onClick={async () => {
                // Clear all field assignments
                await supabase
                  .from("matches")
                  .update({ field: null, match_date: null, match_time: null })
                  .eq("tournament_id", tournament.id);
                // Delete locations
                await supabase.from("tournament_locations").delete().eq("tournament_id", tournament.id);
                setLocations([]);
                saveToDb({ is_esport: true });
                setShowEsportWarning(false);
              }}
            >
              Overschakelen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!pendingParticipantSwitch} onOpenChange={(open) => { if (!open) setPendingParticipantSwitch(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Overschakelen naar Spelers?</AlertDialogTitle>
            <AlertDialogDescription>
              Bij individuele deelnemers (Spelers) zijn ploegfoto's, spelersrosters en staf niet beschikbaar.
              Alle bestaande spelers, staf en ploegfoto's worden definitief verwijderd. De namen, landen en logo's van je deelnemers blijven behouden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                // Verwijder spelers en staf voor dit toernooi
                await Promise.all([
                  supabase.from("players").delete().eq("tournament_id", tournament.id),
                  supabase.from("staff").delete().eq("tournament_id", tournament.id),
                ]);
                // Wis ploegfoto's
                await supabase.from("teams").update({ team_photo_url: null } as any).eq("tournament_id", tournament.id);
                // Storage opruimen voor *-photo bestanden
                const { data: existing } = await supabase.storage.from("team-logos").list(tournament.id, { limit: 1000 });
                if (existing) {
                  const photos = existing.filter(f => f.name.includes("-photo")).map(f => `${tournament.id}/${f.name}`);
                  if (photos.length > 0) await supabase.storage.from("team-logos").remove(photos);
                }
                saveToDb({ teams_label: "Spelers" });
                setPendingParticipantSwitch(null);
                toast({ title: "Overgeschakeld naar Spelers", description: "Spelers, staf en ploegfoto's zijn verwijderd." });
              }}
            >
              Overschakelen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default TournamentGeneral;
