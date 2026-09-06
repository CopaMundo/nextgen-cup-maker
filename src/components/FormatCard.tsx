import { useState, useRef, useEffect } from "react";
import { compressImage, getFileExtension } from "@/lib/compressImage";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Trash2, ChevronDown, ChevronUp, Pencil, Check, X, ImagePlus, Users, Grid3X3, ArrowUp, ArrowDown, Upload } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import GroupManager from "./GroupManager";
import StandingColorManager from "./StandingColorManager";
import BracketView from "./BracketView";
import { generateRoundRobin } from "@/lib/matchGenerator";
import ScoringSystemSelector, { MIXED_VALUE } from "./ScoringSystemSelector";
import { useScoringSystems } from "@/hooks/useScoringSystems";
import { formatTypeIcon } from "./FormatTypeIcon";

interface Phase {
  id: string;
  name: string;
  phase_number: number;
  phase_type: string;
  sort_order: number;
  emoji?: string | null;
  logo_url?: string | null;
  match_config?: Record<string, any> | null;
  scoring_system_id?: string | null;
}

interface FormatCardProps {
  format: Phase;
  tournamentId: string;
  allFormats: Phase[];
  onRemove: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Phase>) => void;
  categoryId?: string | null;
  refreshKey?: number;
  onSlotChange?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  dragHandle?: React.ReactNode;
  dragRowProps?: Record<string, any>;
  initialExpanded?: boolean;
}

interface AffectedGroup { id: string; name: string; current: string | null; }
interface AffectedMatch { id: string; label: string; current: string | null; }

const FormatCard = ({ format, tournamentId, allFormats, onRemove, onUpdate, categoryId, refreshKey, onSlotChange, onMoveUp, onMoveDown, canMoveUp, canMoveDown, dragHandle, dragRowProps, initialExpanded }: FormatCardProps) => {
  const [expanded, setExpanded] = useState(initialExpanded ?? false);
  const [uploading, setUploading] = useState(false);
  const [confirmMode, setConfirmMode] = useState<"auto" | "empty" | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editName, setEditName] = useState(format.name);
  const [editLogoFile, setEditLogoFile] = useState<File | null>(null);
  const [editLogoPreview, setEditLogoPreview] = useState<string | null>(format.logo_url || null);
  const [editLogoRemoved, setEditLogoRemoved] = useState(false);
  const [localRefreshKey, setLocalRefreshKey] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Scoring system: tracks the value shown in the selector. Special value MIXED_VALUE
  // means current children have multiple different scoring systems.
  const { systems: scoringSystems } = useScoringSystems(tournamentId);
  const [editScoringSystemId, setEditScoringSystemId] = useState<string | null>(null);
  const [originalScoringValue, setOriginalScoringValue] = useState<string | null>(null);
  const [affectedGroups, setAffectedGroups] = useState<AffectedGroup[]>([]);
  const [affectedMatches, setAffectedMatches] = useState<AffectedMatch[]>([]);
  const [confirmScoringChange, setConfirmScoringChange] = useState(false);
  const [pendingUpdates, setPendingUpdates] = useState<any | null>(null);
  const [pendingNewScoringId, setPendingNewScoringId] = useState<string | null>(null);

  const typeLabel = format.phase_type === "group"
    ? "Groepsfase"
    : format.phase_type === "knockout"
    ? "Knock-outfase"
    : format.phase_type === "single_match"
    ? "Losse wedstrijd"
    : "Round Robin";

  const sysName = (id: string | null) => {
    if (!id) return "Puntentelling 1";
    return scoringSystems.find(s => s.id === id)?.name || "?";
  };

  /**
   * Open edit dialog. Determine the displayed scoring value:
   *  - Look at format.scoring_system_id and all child groups + matches.
   *  - If all share the same id (or all null fallback to format) → show that id.
   *  - Otherwise → show MIXED_VALUE.
   */
  const openEditDialog = async () => {
    setEditName(format.name);
    setEditLogoFile(null);
    setEditLogoPreview(format.logo_url || null);
    setEditLogoRemoved(false);

    // Resolve the format's effective scoring id (fallback to first system if null)
    const sortedSys = [...scoringSystems].sort((a, b) => a.sort_order - b.sort_order);
    const formatEffective = format.scoring_system_id ?? sortedSys[0]?.id ?? null;

    // Fetch children to detect mixed state
    const [gRes, mRes] = await Promise.all([
      supabase.from("groups").select("id, scoring_system_id").eq("phase_id", format.id),
      supabase.from("matches").select("id, scoring_system_id").eq("phase_id", format.id),
    ]);

    const allIds = new Set<string | null>();
    allIds.add(formatEffective);
    (gRes.data || []).forEach((g: any) => allIds.add(g.scoring_system_id ?? formatEffective));
    (mRes.data || []).forEach((m: any) => allIds.add(m.scoring_system_id ?? formatEffective));

    const initial = allIds.size > 1 ? MIXED_VALUE : (formatEffective ?? sortedSys[0]?.id ?? null);
    setEditScoringSystemId(initial);
    setOriginalScoringValue(initial);
    setEditDialogOpen(true);
  };

  const handleEditLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setEditLogoFile(file);
    setEditLogoPreview(URL.createObjectURL(file));
    setEditLogoRemoved(false);
  };

  /** First step: gather basic updates and possibly trigger confirmation dialog. */
  const saveFormatEdit = async () => {
    setUploading(true);
    const updates: any = {};
    if (editName.trim()) updates.name = editName.trim();

    if (editLogoRemoved && !editLogoFile) {
      updates.logo_url = null;
    }
    if (editLogoFile) {
      const file = await compressImage(editLogoFile);
      const ext = getFileExtension(file);
      const path = `${tournamentId}/format-logos/${format.id}.${ext}`;
      const { error: upErr } = await supabase.storage.from("team-logos").upload(path, file, { upsert: true });
      if (upErr) { toast({ title: "Upload mislukt", description: upErr.message, variant: "destructive" }); setUploading(false); return; }
      const { data: urlData } = supabase.storage.from("team-logos").getPublicUrl(path);
      updates.logo_url = urlData.publicUrl + "?t=" + Date.now();
    }

    // Detect scoring change
    const scoringChanged =
      editScoringSystemId !== null &&
      editScoringSystemId !== MIXED_VALUE &&
      editScoringSystemId !== originalScoringValue;

    if (scoringChanged) {
      // Gather affected groups + matches that will change
      const [gRes, mRes] = await Promise.all([
        supabase.from("groups").select("id, name, scoring_system_id").eq("phase_id", format.id),
        supabase.from("matches").select("id, scoring_system_id, match_name, home_slot_label, away_slot_label, round_number").eq("phase_id", format.id),
      ]);

      const newId = editScoringSystemId;
      const groupChanges: AffectedGroup[] = (gRes.data || [])
        .filter((g: any) => (g.scoring_system_id ?? format.scoring_system_id ?? null) !== newId)
        .map((g: any) => ({ id: g.id, name: g.name, current: g.scoring_system_id ?? format.scoring_system_id ?? null }));

      const matchChanges: AffectedMatch[] = (mRes.data || [])
        .filter((m: any) => (m.scoring_system_id ?? format.scoring_system_id ?? null) !== newId)
        .map((m: any) => {
          const label = m.match_name
            || [m.home_slot_label, m.away_slot_label].filter(Boolean).join(" vs ")
            || "Wedstrijd";
          return { id: m.id, label, current: m.scoring_system_id ?? format.scoring_system_id ?? null };
        });

      setAffectedGroups(groupChanges);
      setAffectedMatches(matchChanges);
      setPendingUpdates(updates);
      setPendingNewScoringId(newId);
      setUploading(false);
      setConfirmScoringChange(true);
      return;
    }

    await supabase.from("tournament_phases").update(updates).eq("id", format.id);
    onUpdate(format.id, updates);
    setLocalRefreshKey(k => k + 1);
    setUploading(false);
    setEditDialogOpen(false);
  };

  /** Second step: actually perform the scoring change after confirmation. */
  const confirmAndApplyScoringChange = async () => {
    if (!pendingNewScoringId) return;
    setUploading(true);
    const updates = { ...(pendingUpdates || {}), scoring_system_id: pendingNewScoringId };

    // Update format itself
    await supabase.from("tournament_phases").update(updates).eq("id", format.id);

    // Cascade: explicitly set all child groups + matches to the new id so the result is consistent
    await Promise.all([
      supabase.from("groups").update({ scoring_system_id: pendingNewScoringId } as any).eq("phase_id", format.id),
      supabase.from("matches").update({ scoring_system_id: pendingNewScoringId } as any).eq("phase_id", format.id),
    ]);

    onUpdate(format.id, updates);
    setLocalRefreshKey(k => k + 1);
    setUploading(false);
    setConfirmScoringChange(false);
    setEditDialogOpen(false);
    toast({ title: "Puntentelling gewijzigd", description: `Format en alle onderliggende groepen/wedstrijden gebruiken nu ${sysName(pendingNewScoringId)}.` });
  };

  const generateMatches = async (mode: "auto" | "empty") => {
    if (format.phase_type === "knockout" || format.phase_type === "single_match") {
      toast({ title: "Wedstrijden bestaan al", description: "Knockout en single match wedstrijden worden automatisch aangemaakt." });
      return;
    }
    const { data: existing } = await supabase.from("matches").select("id").eq("phase_id", format.id).limit(1);
    if (existing && existing.length > 0) {
      setConfirmMode(mode);
      return;
    }
    await doGenerateMatches(mode);
  };

  const handleConfirmReplace = async () => {
    if (!confirmMode) return;
    await supabase.from("matches").delete().eq("phase_id", format.id);
    await doGenerateMatches(confirmMode);
    setConfirmMode(null);
  };

  const doGenerateMatches = async (mode: "auto" | "empty") => {
    const [gRes, sRes] = await Promise.all([
      supabase.from("groups").select("id, name").eq("phase_id", format.id).order("created_at"),
      supabase.from("slots").select("id, slot_code, team_id, group_id, sort_order").eq("phase_id", format.id).order("sort_order"),
    ]);
    const groups = gRes.data || [];
    const slots = sRes.data || [];

    const { data: phaseData } = await supabase.from("tournament_phases").select("match_config").eq("id", format.id).single();
    const config = (phaseData?.match_config as any) || {};
    const rawMatchType = config.matchType || "single_leg";
    // PhaseManager stores "rounds" and "multiple" but generator expects "custom"
    const matchType = (rawMatchType === "rounds" || rawMatchType === "multiple") ? "custom" : rawMatchType;
    const customRounds = rawMatchType === "multiple" ? (config.encounters || 1) : (config.rounds || 1);

    const matchesToInsert: any[] = [];

    for (const group of groups) {
      const groupSlots = slots.filter(s => s.group_id === group.id).sort((a, b) => a.sort_order - b.sort_order);
      const slotCount = groupSlots.length;
      if (slotCount < 2) continue;

      const n = slotCount % 2 === 0 ? slotCount : slotCount + 1;
      const singleLegRounds = n - 1;

      let totalRoundsToGenerate: number;
      if (matchType === "single_leg") totalRoundsToGenerate = singleLegRounds;
      else if (matchType === "home_away") totalRoundsToGenerate = singleLegRounds * 2;
      else totalRoundsToGenerate = customRounds;

      if (mode === "auto") {
        const pairings = generateRoundRobin(slotCount, matchType as any, customRounds);

        for (const p of pairings) {
          const homeSlot = groupSlots[p.homeIdx];
          const awaySlot = groupSlots[p.awayIdx];
          matchesToInsert.push({
            tournament_id: tournamentId,
            phase_id: format.id,
            group_id: group.id,
            home_team_id: homeSlot.team_id || null,
            away_team_id: awaySlot.team_id || null,
            home_slot_label: homeSlot.slot_code,
            away_slot_label: awaySlot.slot_code,
            round_number: p.round,
          });
        }
      } else {
        const matchesPerRound = Math.floor(slotCount / 2);
        for (let round = 0; round < totalRoundsToGenerate; round++) {
          for (let mi = 0; mi < matchesPerRound; mi++) {
            matchesToInsert.push({
              tournament_id: tournamentId,
              phase_id: format.id,
              group_id: group.id,
              home_team_id: null,
              away_team_id: null,
              home_slot_label: null,
              away_slot_label: null,
              match_name: `${group.name} - M${round * matchesPerRound + mi + 1}`,
              round_number: round + 1,
            });
          }
        }
      }
    }

    if (matchesToInsert.length === 0) {
      toast({ title: "Geen wedstrijden", description: "Voeg eerst slots toe", variant: "destructive" });
      return;
    }

    const { data, error } = await supabase.from("matches").insert(matchesToInsert).select("id");
    if (error) {
      toast({ title: "Fout", description: error.message, variant: "destructive" });
    } else {
      toast({ title: `${data?.length || 0} wedstrijden gegenereerd!` });
    }
  };

  return (
    <>
      <div className="rounded-lg border border-border bg-card/50 overflow-hidden">
        <div
          {...(dragRowProps ? (({ className: _c, ...rest }) => rest)(dragRowProps) : {})}
          className={`flex items-center justify-between w-full p-3 hover:bg-foreground/[0.02] transition-colors ${dragRowProps ? "cursor-grab active:cursor-grabbing touch-none" : ""}`}
        >
          {dragHandle}
          <div
            onClick={() => setExpanded(!expanded)}
            className="flex min-w-0 flex-1 items-center gap-2 text-left cursor-pointer"
          >
            {format.logo_url ? (
              <img src={format.logo_url} alt="" className="h-6 w-6 object-contain flex-shrink-0 rounded" />
            ) : (
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-primary/10 text-primary">
                {formatTypeIcon(format.phase_type, "h-4 w-4")}
              </span>
            )}

            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-1.5 py-0.5 rounded bg-secondary">
              {typeLabel}
            </span>
            <span className="font-display text-sm font-bold text-foreground">{format.name}</span>
            <button type="button" aria-label={`${format.name} bewerken`} onClick={(e) => { e.stopPropagation(); openEditDialog(); }} className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground sm:h-auto sm:w-auto sm:p-1">
              <Pencil className="h-4 w-4 sm:h-3 sm:w-3" />
            </button>
          </div>
          <div className="ml-3 flex shrink-0 items-center gap-1.5">
            {!dragHandle && canMoveUp && (
              <button type="button" onClick={onMoveUp} className="text-muted-foreground hover:text-foreground" title="Naar boven">
                <ArrowUp className="h-3.5 w-3.5" />
              </button>
            )}
            {!dragHandle && canMoveDown && (
              <button type="button" onClick={onMoveDown} className="text-muted-foreground hover:text-foreground" title="Naar beneden">
                <ArrowDown className="h-3.5 w-3.5" />
              </button>
            )}
            <button type="button" aria-label={`${format.name} verwijderen`} onClick={() => setShowDeleteConfirm(true)} className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive sm:h-auto sm:w-auto sm:p-1">
              <Trash2 className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
            </button>
            <button type="button" onClick={() => setExpanded(!expanded)} className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground sm:h-auto sm:w-auto sm:p-1" title={expanded ? "Inklappen" : "Uitklappen"}>
              {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>

        {expanded && (
          <div className="border-t border-border p-3 space-y-4">
            {format.phase_type !== "knockout" && format.phase_type !== "single_match" && (
              <GroupManager
                tournamentId={tournamentId}
                phaseId={format.id}
                phaseType={format.phase_type}
                phaseNumber={format.phase_number}
                phases={allFormats}
                categoryId={categoryId}
                refreshKey={refreshKey}
                onSlotChange={onSlotChange}
                showRandomAssign={format.phase_number === 1}
              />
            )}

            {(format.phase_type === "round_robin" || format.phase_type === "group") && (
              <div className="border-t border-border pt-3">
                <StandingColorManager tournamentId={tournamentId} phaseId={format.id} />
              </div>
            )}

            {(format.phase_type === "knockout" || format.phase_type === "single_match") && (
              <BracketView
                tournamentId={tournamentId}
                phaseId={format.id}
                editable={true}
                showScores={false}
                showRandomAssign={format.phase_number === 1}
                refreshKey={(refreshKey ?? 0) + localRefreshKey}
                onSlotChange={onSlotChange}
              />
            )}
          </div>
        )}
      </div>

      {/* Delete format confirmation */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Format verwijderen?</AlertDialogTitle>
            <AlertDialogDescription>
              Weet je zeker dat je "{format.name}" wilt verwijderen? Alle bijbehorende groepen, wedstrijden en slots worden ook verwijderd. Dit kan niet ongedaan worden gemaakt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setShowDeleteConfirm(false); onRemove(format.id); }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Verwijderen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Replace matches confirmation */}
      <AlertDialog open={!!confirmMode} onOpenChange={(open) => { if (!open) setConfirmMode(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Wedstrijden vervangen?</AlertDialogTitle>
            <AlertDialogDescription>
              Wilt u alle huidige wedstrijden verwijderen en vervangen door {confirmMode === "auto" ? "automatisch gegenereerde wedstrijden" : "lege wedstrijdslots"}?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Nee</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmReplace}>Ja</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit format dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Format bewerken</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Naam</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Logo (optioneel)</Label>
              {editLogoPreview && !editLogoRemoved ? (
                <div className="flex items-center gap-3">
                  <img src={editLogoPreview} alt="" className="h-12 w-12 object-contain rounded border border-border" />
                  <Button variant="outline" size="sm" onClick={() => { setEditLogoRemoved(true); setEditLogoPreview(null); setEditLogoFile(null); }}>
                    <X className="h-3 w-3 mr-1" /> Verwijderen
                  </Button>
                </div>
              ) : (
                <div>
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleEditLogoSelect} />
                  <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                    <Upload className="h-3 w-3 mr-1" /> Logo uploaden
                  </Button>
                </div>
              )}
            </div>
            <ScoringSystemSelector
              systems={scoringSystems}
              value={editScoringSystemId}
              onChange={(v) => setEditScoringSystemId(v)}
              showMixed={originalScoringValue === MIXED_VALUE}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Annuleren</Button>
            <Button onClick={saveFormatEdit} disabled={uploading}>
              {uploading ? "Opslaan..." : "Opslaan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm cascading scoring system change */}
      <AlertDialog open={confirmScoringChange} onOpenChange={(open) => { if (!open) { setConfirmScoringChange(false); setUploading(false); } }}>
        <AlertDialogContent className="max-h-[85vh] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>Puntentelling wijzigen?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  De volgende onderdelen krijgen <strong>{sysName(pendingNewScoringId)}</strong>:
                </p>
                {affectedGroups.length > 0 && (
                  <div>
                    <p className="font-medium text-foreground text-sm mb-1">Groepen ({affectedGroups.length})</p>
                    <ul className="text-xs space-y-0.5 max-h-32 overflow-y-auto pl-4 list-disc">
                      {affectedGroups.map(g => (
                        <li key={g.id}>{g.name} <span className="text-muted-foreground">— nu: {sysName(g.current)}</span></li>
                      ))}
                    </ul>
                  </div>
                )}
                {affectedMatches.length > 0 && (
                  <div>
                    <p className="font-medium text-foreground text-sm mb-1">Wedstrijden ({affectedMatches.length})</p>
                    <ul className="text-xs space-y-0.5 max-h-40 overflow-y-auto pl-4 list-disc">
                      {affectedMatches.map(m => (
                        <li key={m.id}>{m.label} <span className="text-muted-foreground">— nu: {sysName(m.current)}</span></li>
                      ))}
                    </ul>
                  </div>
                )}
                {affectedGroups.length === 0 && affectedMatches.length === 0 && (
                  <p className="text-muted-foreground text-sm">Alleen het format zelf wijzigt — alle onderliggende groepen en wedstrijden hebben deze puntentelling al.</p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={uploading}>Annuleren</AlertDialogCancel>
            <AlertDialogAction onClick={confirmAndApplyScoringChange} disabled={uploading}>
              {uploading ? "Bezig..." : "Bevestig wijziging"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default FormatCard;
