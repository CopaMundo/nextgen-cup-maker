import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ChevronDown,
  ExternalLink,
  Pencil,
  Plus,
  Trash2,
  Award,
  ShieldCheck,
  ListOrdered,
  BarChart3,
  Check,
  ImageIcon,
  Upload,
} from "lucide-react";
import BracketTreeIcon from "@/components/icons/BracketTreeIcon";
import CalendarClockIcon from "@/components/icons/CalendarClockIcon";
import ScoreboardIcon from "@/components/icons/ScoreboardIcon";
import { compressImage, getFileExtension } from "@/lib/compressImage";
import { detectBracketStructure } from "@/components/public-view/PublicBracketSection";
import { BROADCAST_STYLES, SELECTABLE_BROADCAST_STYLES, type BroadcastStyle } from "@/lib/broadcastStyles";
import {
  type Slide,
  type SlideBlock,
  type BlockType,
  type BlockWidth,
  type SlideshowRow,
  type SlideshowOptions,
  type SponsorBar,
  DEFAULT_OPTIONS,
  DEFAULT_SPONSOR_BAR,
  BLOCK_LABELS,
} from "@/lib/slideshowTypes";

interface Props {
  tournamentId: string;
  tournament: any;
  onUpdate: (t: any) => void;
}

const STYLE_KEYS = SELECTABLE_BROADCAST_STYLES;

const newId = () =>
  (typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2));

const SlideshowConfig = ({ tournamentId, tournament, onUpdate }: Props) => {
  const { toast } = useToast();
  const [shows, setShows] = useState<SlideshowRow[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [renamingShow, setRenamingShow] = useState<SlideshowRow | null>(null);

  // Available source data
  const [sources, setSources] = useState<{
    groups: { id: string; name: string; phaseName: string; categoryId?: string | null; categoryName?: string }[];
    brackets: { phaseId: string; bracketKey: string; name: string; categoryId?: string | null; categoryName?: string }[];
  }>({ groups: [], brackets: [] });
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);

  const activeShow = shows.find(s => s.id === activeId) || null;

  // Filter sources to active show's category (if set)
  const filteredSources = useMemo(() => {
    const catId = activeShow?.category_id ?? null;
    if (!catId) return sources;
    return {
      groups: sources.groups.filter(g => g.categoryId === catId),
      brackets: sources.brackets.filter(b => b.categoryId === catId),
    };
  }, [sources, activeShow?.category_id]);

  // ── Load shows ──────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("tournament_slideshows" as any)
        .select("*")
        .eq("tournament_id", tournamentId)
        .order("sort_order");
      if (cancelled) return;
      let rows = ((data ?? []) as any[]) as SlideshowRow[];
      // Auto-create first show if none exist yet
      if (rows.length === 0) {
        const { data: created } = await supabase
          .from("tournament_slideshows" as any)
          .insert({
            tournament_id: tournamentId,
            name: "Diavoorstelling 1",
            sort_order: 0,
            slides: [],
            sponsor_bar: DEFAULT_SPONSOR_BAR,
            options: DEFAULT_OPTIONS,
          } as any)
          .select()
          .single();
        if (created) rows = [created as any];
      }
      setShows(rows);
      setActiveId(rows[0]?.id ?? null);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [tournamentId]);

  // ── Load sources ─────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [phasesRes, groupsRes, catRes, matchesRes] = await Promise.all([
        supabase
          .from("tournament_phases")
          .select("id, name, phase_label, phase_type, category_id, sort_order, match_config")
          .eq("tournament_id", tournamentId)
          .order("sort_order"),
        supabase
          .from("groups")
          .select("id, name, phase_id, sort_order")
          .eq("tournament_id", tournamentId)
          .order("sort_order"),
        supabase
          .from("tournament_categories")
          .select("id, name")
          .eq("tournament_id", tournamentId),
        supabase
          .from("matches")
          .select("id, phase_id, group_id, round_number, match_name, home_slot_label, away_slot_label, created_at")
          .eq("tournament_id", tournamentId),
      ]);
      if (cancelled) return;
      const phases = phasesRes.data ?? [];
      const groups = groupsRes.data ?? [];
      const cats = catRes.data ?? [];
      const allMatches = matchesRes.data ?? [];
      const catMap = new Map(cats.map(c => [c.id, c.name]));
      const phaseMap = new Map(phases.map((p: any) => [p.id, p]));

      const groupSrc = groups
        .filter((g: any) => {
          const ph: any = phaseMap.get(g.phase_id);
          return ph?.phase_type === "group";
        })
        .map((g: any) => {
          const ph: any = phaseMap.get(g.phase_id);
          return {
            id: g.id,
            name: g.name,
            phaseName: "",
            categoryId: ph?.category_id ?? null,
            categoryName: ph?.category_id ? catMap.get(ph.category_id) : undefined,
          };
        });

      // Per knockout phase, detect main + sub-brackets via the public bracket detector
      const bracketSrc: { phaseId: string; bracketKey: string; name: string; categoryId?: string | null; categoryName?: string }[] = [];
      const knockoutPhases = phases.filter((p: any) => p.phase_type === "knockout");
      for (const ph of knockoutPhases as any[]) {
        const phGroups = groups.filter((g: any) => g.phase_id === ph.id);
        const phMatches = allMatches.filter((m: any) => m.phase_id === ph.id);
        const cfg = (ph.match_config || {}) as any;
        const bracketGroupMap = (cfg.bracketGroupMap || {}) as Record<string, string>;
        const bracketNames = (cfg.bracketNames || {}) as Record<string, string>;
        const phaseMatchType = cfg.matchType || "single_leg";
        const catId = ph.category_id ?? null;
        const catName = catId ? catMap.get(catId) : undefined;
        const phaseLabel = ph.phase_label || ph.name;

        try {
          const struct = detectBracketStructure(phGroups, phMatches, bracketGroupMap, phaseMatchType);
          // Main bracket
          if (struct.mainRounds.length > 0) {
            bracketSrc.push({
              phaseId: ph.id,
              bracketKey: "main",
              name: bracketNames["main"] || (knockoutPhases.length > 1 ? `${phaseLabel} · Hoofdbracket` : "Hoofdbracket"),
              categoryId: catId,
              categoryName: catName,
            });
          }
          // Loser/sub-brackets (5-8, 9-16, …)
          const allLoserKeys = Object.keys(struct.loserBrackets).sort((a, b) => parseInt(a) - parseInt(b));
          for (const key of allLoserKeys) {
            bracketSrc.push({
              phaseId: ph.id,
              bracketKey: key,
              name: bracketNames[key] || `Bracket ${key}`,
              categoryId: catId,
              categoryName: catName,
            });
          }
          // Fallback: phase has matches but no main detected → expose as single entry
          if (struct.mainRounds.length === 0 && allLoserKeys.length === 0 && phMatches.length > 0) {
            bracketSrc.push({
              phaseId: ph.id,
              bracketKey: "main",
              name: phaseLabel,
              categoryId: catId,
              categoryName: catName,
            });
          }
        } catch {
          bracketSrc.push({
            phaseId: ph.id,
            bracketKey: "main",
            name: phaseLabel,
            categoryId: catId,
            categoryName: catName,
          });
        }
      }

      setSources({ groups: groupSrc, brackets: bracketSrc });
      setCategories(cats.map((c: any) => ({ id: c.id, name: c.name })));
    })();
    return () => {
      cancelled = true;
    };
  }, [tournamentId]);

  // ── Persistence helpers ──────────────────────────────────────
  const persistShow = async (show: SlideshowRow) => {
    setSavingId(show.id);
    const { error } = await supabase
      .from("tournament_slideshows" as any)
      .update({
        name: show.name,
        slides: show.slides,
        sponsor_bar: show.sponsor_bar,
        options: show.options,
        sort_order: show.sort_order,
        category_id: show.category_id ?? null,
      } as any)
      .eq("id", show.id);
    setSavingId(null);
    if (error) {
      toast({ title: "Opslaan mislukt", variant: "destructive" });
    }
  };

  const updateActiveShow = (patch: Partial<SlideshowRow>, persist = true) => {
    if (!activeShow) return;
    const updated = { ...activeShow, ...patch };
    setShows(prev => prev.map(s => (s.id === activeShow.id ? updated : s)));
    if (persist) persistShow(updated);
  };

  const updateOptions = (patch: Partial<SlideshowOptions>) => {
    if (!activeShow) return;
    updateActiveShow({ options: { ...activeShow.options, ...patch } });
  };

  const updateSponsorBar = (patch: Partial<SponsorBar>) => {
    if (!activeShow) return;
    updateActiveShow({ sponsor_bar: { ...activeShow.sponsor_bar, ...patch } });
  };

  // ── Slide actions ────────────────────────────────────────────
  const addSlide = () => {
    if (!activeShow) return;
    const slide: Slide = {
      id: newId(),
      name: `Dia ${activeShow.slides.length + 1}`,
      durationSec: activeShow.options.defaultDurationSec || 15,
      enabled: true,
      blocks: [],
    };
    updateActiveShow({ slides: [...activeShow.slides, slide] });
  };

  const updateSlide = (slideId: string, patch: Partial<Slide>) => {
    if (!activeShow) return;
    updateActiveShow({
      slides: activeShow.slides.map(s => (s.id === slideId ? { ...s, ...patch } : s)),
    });
  };

  const removeSlide = (slideId: string) => {
    if (!activeShow) return;
    updateActiveShow({ slides: activeShow.slides.filter(s => s.id !== slideId) });
  };

  const addBlock = (slideId: string, type: BlockType, extra?: Partial<SlideBlock>) => {
    if (!activeShow) return;
    const block: SlideBlock = {
      id: newId(),
      type,
      width: 100,
      refId: null,
      ...extra,
    };
    updateActiveShow({
      slides: activeShow.slides.map(s =>
        s.id === slideId ? { ...s, blocks: [...s.blocks, block] } : s,
      ),
    });
  };

  const updateBlock = (slideId: string, blockId: string, patch: Partial<SlideBlock>) => {
    if (!activeShow) return;
    updateActiveShow({
      slides: activeShow.slides.map(s =>
        s.id === slideId
          ? { ...s, blocks: s.blocks.map(b => (b.id === blockId ? { ...b, ...patch } : b)) }
          : s,
      ),
    });
  };

  const removeBlock = (slideId: string, blockId: string) => {
    if (!activeShow) return;
    updateActiveShow({
      slides: activeShow.slides.map(s =>
        s.id === slideId ? { ...s, blocks: s.blocks.filter(b => b.id !== blockId) } : s,
      ),
    });
  };

  // ── Show actions ─────────────────────────────────────────────
  const createShow = async () => {
    const nextOrder = shows.length;
    const { data, error } = await supabase
      .from("tournament_slideshows" as any)
      .insert({
        tournament_id: tournamentId,
        name: `Diavoorstelling ${nextOrder + 1}`,
        sort_order: nextOrder,
        slides: [],
        sponsor_bar: DEFAULT_SPONSOR_BAR,
        options: DEFAULT_OPTIONS,
      } as any)
      .select()
      .single();
    if (error || !data) {
      toast({ title: "Aanmaken mislukt", variant: "destructive" });
      return;
    }
    const row = data as any as SlideshowRow;
    setShows(prev => [...prev, row]);
    setActiveId(row.id);
  };

  const deleteShow = async (id: string) => {
    if (shows.length === 1) {
      toast({ title: "Minstens één voorstelling vereist" });
      return;
    }
    const { error } = await supabase
      .from("tournament_slideshows" as any)
      .delete()
      .eq("id", id);
    if (error) {
      toast({ title: "Verwijderen mislukt", variant: "destructive" });
      return;
    }
    const remaining = shows.filter(s => s.id !== id);
    setShows(remaining);
    if (activeId === id) setActiveId(remaining[0]?.id ?? null);
  };

  const renameShow = async (id: string, name: string) => {
    setShows(prev => prev.map(s => (s.id === id ? { ...s, name } : s)));
    await supabase.from("tournament_slideshows" as any).update({ name } as any).eq("id", id);
  };

  // Set active broadcast style on tournament (saved on tournaments)
  const setStyle = async (style: BroadcastStyle) => {
    await supabase.from("tournaments").update({ view_display_style: style } as any).eq("id", tournamentId);
    onUpdate({ ...tournament, view_display_style: style });
  };

  const openSlideshow = () => {
    if (!activeShow) return;
    const params = new URLSearchParams({ show: activeShow.id, autofs: "1" });
    const previewToken = new URLSearchParams(window.location.search).get("__lovable_token");
    if (previewToken) params.set("__lovable_token", previewToken);
    const url = `/slideshow/${tournamentId}?${params.toString()}`;
    const w = window.screen?.availWidth || window.innerWidth;
    const h = window.screen?.availHeight || window.innerHeight;
    // Gebruik een relatieve URL. Zo blijft de Lovable-preview token/query behouden
    // en laadt het popupvenster niet leeg op de preview-domain.
    let win: Window | null = null;
    try {
      const features = `popup=yes,width=${w},height=${h},left=0,top=0`;
      win = window.open(url, "_blank", features);
      try { win?.moveTo(0, 0); win?.resizeTo(w, h); } catch {}
    } catch {
      win = null;
    }
    if (!win || win.closed) {
      // Fallback: nieuw tabblad
      window.open(url, "_blank");
    }
  };

  if (loading) {
    return <p className="text-sm text-muted-foreground">Laden…</p>;
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="space-y-2">
        <h2 className="font-display text-lg font-bold text-foreground">Dialoogvoorstelling</h2>
        <p className="text-sm text-muted-foreground">
          Alleen dia's die gemarkeerd zijn als 'actief' worden getoond. Hoeveel informatie er op één
          dia past, hangt af van de grootte van de elementen. Open de dialoogvoorstelling op
          volledig scherm om het resultaat te bekijken.
        </p>
      </div>

      {/* Global toggles */}
      {activeShow && (
        <div className="space-y-3">
          <ToggleRow
            label="Toon toernooinaam op diavoorstelling"
            checked={activeShow.options.showTournamentName}
            onChange={v => updateOptions({ showTournamentName: v })}
          />
          <ToggleRow
            label="Toon huidige tijd op diavoorstelling"
            checked={activeShow.options.showCurrentTime}
            onChange={v => updateOptions({ showCurrentTime: v })}
          />
          <ToggleRow
            label="Sponsorbalk weergeven"
            checked={activeShow.sponsor_bar.enabled}
            onChange={v => updateSponsorBar({ enabled: v })}
          />
        </div>
      )}

      {/* Show selector + style chips */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs font-bold uppercase tracking-wide text-foreground hover:border-foreground/30"
              >
                {activeShow?.name || "—"}
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              {shows.map(s => (
                <DropdownMenuItem
                  key={s.id}
                  onClick={() => setActiveId(s.id)}
                  className="flex items-center justify-between gap-2"
                >
                  <span className="truncate">{s.name}</span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={e => {
                        e.stopPropagation();
                        setRenamingShow(s);
                      }}
                      className="text-muted-foreground hover:text-foreground"
                      aria-label="Hernoem"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                    {shows.length > 1 && (
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation();
                          deleteShow(s.id);
                        }}
                        className="text-muted-foreground hover:text-destructive"
                        aria-label="Verwijder"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={createShow}>
                <Plus className="h-3.5 w-3.5" /> Nieuwe voorstelling
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Division filter — only when tournament has multiple categories */}
          {categories.length > 1 && activeShow && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  title="Beperk deze voorstelling tot één divisie"
                  className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs font-bold uppercase tracking-wide text-foreground hover:border-foreground/30"
                >
                  <span className="text-muted-foreground normal-case font-normal">Divisie:</span>
                  {categories.find(c => c.id === activeShow.category_id)?.name || "Alle"}
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuItem onClick={() => updateActiveShow({ category_id: null })}>
                  Alle divisies
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {categories.map(c => (
                  <DropdownMenuItem
                    key={c.id}
                    onClick={() => updateActiveShow({ category_id: c.id })}
                  >
                    {c.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          <button
            type="button"
            onClick={openSlideshow}
            disabled={!activeShow}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 disabled:opacity-40"
            aria-label="Open diavoorstelling"
          >
            <ExternalLink className="h-4 w-4" />
          </button>
        </div>

      </div>

      {/* Slides list */}
      {activeShow && (
        <div className="space-y-3">
          {activeShow.slides.length === 0 && (
            <p className="text-sm text-muted-foreground italic">
              Nog geen dia's. Klik op "Dia toevoegen" om te beginnen.
            </p>
          )}
          {activeShow.slides.map((slide, idx) => (
            <SlideCard
              key={slide.id}
              index={idx}
              slide={slide}
              sources={filteredSources}
              tournament={tournament}
              tournamentId={tournamentId}
              onChange={patch => updateSlide(slide.id, patch)}
              onRemove={() => removeSlide(slide.id)}
              onAddBlock={(type, extra) => addBlock(slide.id, type, extra)}
              onUpdateBlock={(blockId, patch) => updateBlock(slide.id, blockId, patch)}
              onRemoveBlock={blockId => removeBlock(slide.id, blockId)}
            />
          ))}
          <button
            type="button"
            onClick={addSlide}
            className="w-full rounded-lg border border-dashed border-border py-3 text-xs font-bold uppercase tracking-wide text-muted-foreground hover:text-foreground hover:border-foreground/30"
          >
            Dia toevoegen
          </button>
        </div>
      )}

      {savingId && <p className="text-[11px] text-muted-foreground">Opslaan…</p>}

      {/* Rename dialog */}
      <Dialog open={!!renamingShow} onOpenChange={o => !o && setRenamingShow(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Voorstelling hernoemen</DialogTitle>
          </DialogHeader>
          {renamingShow && (
            <Input
              autoFocus
              defaultValue={renamingShow.name}
              onChange={e => setRenamingShow({ ...renamingShow, name: e.target.value })}
            />
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenamingShow(null)}>
              Annuleren
            </Button>
            <Button
              onClick={async () => {
                if (renamingShow) {
                  await renameShow(renamingShow.id, renamingShow.name || "Diavoorstelling");
                  setRenamingShow(null);
                }
              }}
            >
              Opslaan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// ── Sub-components ────────────────────────────────────────────

const ToggleRow = ({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) => (
  <label className="flex items-center gap-3 cursor-pointer">
    <Switch checked={checked} onCheckedChange={onChange} />
    <span className="text-sm text-foreground">{label}</span>
  </label>
);

interface SlideCardProps {
  index: number;
  slide: Slide;
  sources: {
    groups: { id: string; name: string; phaseName: string; categoryName?: string }[];
    brackets: { phaseId: string; bracketKey: string; name: string; categoryName?: string }[];
  };
  tournament: any;
  tournamentId: string;
  onChange: (patch: Partial<Slide>) => void;
  onRemove: () => void;
  onAddBlock: (type: BlockType, extra?: Partial<SlideBlock>) => void;
  onUpdateBlock: (blockId: string, patch: Partial<SlideBlock>) => void;
  onRemoveBlock: (blockId: string) => void;
}

const SlideCard = ({
  index,
  slide,
  sources,
  tournament,
  tournamentId,
  onChange,
  onRemove,
  onAddBlock,
  onUpdateBlock,
  onRemoveBlock,
}: SlideCardProps) => {
  
  const [confirmDeleteSlide, setConfirmDeleteSlide] = useState(false);
  const [confirmDeleteBlockId, setConfirmDeleteBlockId] = useState<string | null>(null);
  const [editingMeta, setEditingMeta] = useState(false);

  const statisticsEnabled =
    tournament.enable_goalscorers ||
    tournament.enable_assists ||
    tournament.enable_fairplay ||
    tournament.enable_yellow_cards ||
    tournament.enable_red_cards;

  const slideName = slide.name?.trim() || `Dia ${index + 1}`;

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      {/* Header bar */}
      <div className="flex items-center justify-between bg-primary text-primary-foreground px-4 py-2.5">
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold">{slideName}</span>
          <span className="inline-flex items-center gap-2">
            <span className="inline-flex items-center rounded bg-background/20 px-2 py-0.5 text-sm font-bold text-primary-foreground">
              {slide.durationSec || 15} seconden
            </span>
            <button
              type="button"
              onClick={() => setEditingMeta(true)}
              className="inline-flex h-6 w-6 items-center justify-center rounded text-primary-foreground/90 hover:bg-background/20 hover:text-primary-foreground"
              aria-label="Dianaam en tijd in beeld bewerken"
              title="Bewerken"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          </span>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
            <span>Actief:</span>
            <span
              className={`relative inline-flex h-4 w-4 items-center justify-center rounded border ${
                slide.enabled
                  ? "bg-green-500 border-green-600"
                  : "bg-transparent border-primary-foreground/40"
              }`}
            >
              {slide.enabled && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
              <input
                type="checkbox"
                checked={slide.enabled}
                onChange={e => onChange({ enabled: e.target.checked })}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
            </span>
          </label>
          <button
            type="button"
            onClick={() => setConfirmDeleteSlide(true)}
            className="text-primary-foreground/80 hover:text-primary-foreground"
            aria-label="Verwijder dia"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Body: blocks */}
      <div className="bg-card p-3 space-y-2">
        {slide.blocks.length === 0 ? (
          <p className="text-xs text-muted-foreground italic px-1">
            Nog geen blokken. Voeg er een toe via de iconen onderaan.
          </p>
        ) : (
          slide.blocks.map(block => (
            <BlockRow
              key={block.id}
              block={block}
              sources={sources}
              tournament={tournament}
              tournamentId={tournamentId}
              onChange={patch => onUpdateBlock(block.id, patch)}
              onRemove={() => setConfirmDeleteBlockId(block.id)}
            />
          ))
        )}

        {/* Block toolbar */}
        <div className="flex items-center justify-center gap-1 pt-2 border-t border-border">
          <GroupBracketPicker sources={sources} onAddBlock={onAddBlock} />
          <BlockButton icon={CalendarClockIcon} label="Aankomende wedstrijden" onClick={() => onAddBlock("upcoming_matches")} />
          <BlockButton icon={ScoreboardIcon} label="Laatste resultaten" onClick={() => onAddBlock("recent_results")} />
          {statisticsEnabled && (
            <StatisticsPicker tournament={tournament} onAddBlock={onAddBlock} />
          )}
          <ImageUploadButton tournamentId={tournamentId} onUploaded={url => onAddBlock("image", { imageUrl: url })} />
        </div>
      </div>

      {/* Confirm delete slide */}
      <AlertDialog open={confirmDeleteSlide} onOpenChange={setConfirmDeleteSlide}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Dia verwijderen?</AlertDialogTitle>
            <AlertDialogDescription>
              Deze dia en al zijn blokken worden permanent verwijderd.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { onRemove(); setConfirmDeleteSlide(false); }}
              className="bg-destructive text-destructive-foreground"
            >
              Verwijderen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm delete block */}
      <AlertDialog open={!!confirmDeleteBlockId} onOpenChange={o => !o && setConfirmDeleteBlockId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Blok verwijderen?</AlertDialogTitle>
            <AlertDialogDescription>
              Dit blok wordt verwijderd uit deze dia.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmDeleteBlockId) onRemoveBlock(confirmDeleteBlockId);
                setConfirmDeleteBlockId(null);
              }}
              className="bg-destructive text-destructive-foreground"
            >
              Verwijderen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <SlideMetaDialog
        open={editingMeta}
        slide={slide}
        fallbackName={`Dia ${index + 1}`}
        onOpenChange={setEditingMeta}
        onSave={patch => onChange(patch)}
      />
    </div>
  );
};

const SlideMetaDialog = ({
  open,
  slide,
  fallbackName,
  onOpenChange,
  onSave,
}: {
  open: boolean;
  slide: Slide;
  fallbackName: string;
  onOpenChange: (open: boolean) => void;
  onSave: (patch: Partial<Slide>) => void;
}) => {
  const [draftName, setDraftName] = useState(slide.name?.trim() || fallbackName);
  const [draftSeconds, setDraftSeconds] = useState(String(slide.durationSec || 15));

  useEffect(() => {
    if (!open) return;
    setDraftName(slide.name?.trim() || fallbackName);
    setDraftSeconds(String(slide.durationSec || 15));
  }, [open, slide.id, slide.name, slide.durationSec, fallbackName]);

  const save = () => {
    const parsed = Number.parseInt(draftSeconds, 10);
    const durationSec = Number.isFinite(parsed) && parsed > 0 ? parsed : 15;
    onSave({ name: draftName.trim() || fallbackName, durationSec });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Dia bewerken</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Dianaam</label>
            <Input value={draftName} onChange={e => setDraftName(e.target.value)} autoFocus />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Tijd in beeld</label>
            <div className="flex items-center gap-2">
              <Input
                inputMode="numeric"
                type="number"
                min={1}
                value={draftSeconds}
                onChange={e => setDraftSeconds(e.target.value)}
                className="w-24"
              />
              <span className="text-sm text-foreground">seconden</span>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuleren
          </Button>
          <Button onClick={save}>Opslaan</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// Statistics picker — one tab/icon, popover lets you choose Topscorers / Assists / Fairplay
const StatisticsPicker = ({
  tournament,
  onAddBlock,
}: {
  tournament: any;
  onAddBlock: (type: BlockType, extra?: Partial<SlideBlock>) => void;
}) => {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          title="Statistieken"
          className="h-8 w-8 inline-flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
        >
          <BarChart3 className="h-4 w-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 p-1">
        {tournament.enable_goalscorers && (
          <button
            type="button"
            onClick={() => { onAddBlock("topscorers"); setOpen(false); }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded hover:bg-secondary text-foreground"
          >
            <Award className="h-4 w-4" /> Topscorers
          </button>
        )}
        {tournament.enable_assists && (
          <button
            type="button"
            onClick={() => { onAddBlock("assists"); setOpen(false); }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded hover:bg-secondary text-foreground"
          >
            <Award className="h-4 w-4" /> Assists
          </button>
        )}
        {(tournament.enable_fairplay || tournament.enable_yellow_cards || tournament.enable_red_cards) && (
          <button
            type="button"
            onClick={() => { onAddBlock("fairplay"); setOpen(false); }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded hover:bg-secondary text-foreground"
          >
            <ShieldCheck className="h-4 w-4" /> Fairplay
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
};

// Unified picker for "Groep / Bracket" — one icon, popover lets you pick group (with mode) or bracket
const GroupBracketPicker = ({
  sources,
  onAddBlock,
}: {
  sources: SlideCardProps["sources"];
  onAddBlock: (type: BlockType, extra?: Partial<SlideBlock>) => void;
}) => {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          title="Groep of bracket"
          className="h-8 w-8 inline-flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
        >
          <BracketTreeIcon size={16} />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-0">
        <div className="max-h-80 overflow-auto">
          {sources.groups.length > 0 && (
            <div className="border-b border-border">
              <p className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                <ListOrdered className="h-3 w-3" /> Groepen
              </p>
              {sources.groups.map(g => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => {
                    onAddBlock("group_combo", { refId: g.id, comboLayout: "standing_schedule" });
                    setOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-secondary border-t border-border first:border-t-0"
                >
                  {g.categoryName ? g.categoryName + " · " : ""}
                  {g.name}
                </button>
              ))}
            </div>
          )}
          {sources.brackets.length > 0 && (
            <div>
              <p className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                <BracketTreeIcon size={12} /> Brackets
              </p>
              {sources.brackets.map(b => (
                <button
                  key={`${b.phaseId}-${b.bracketKey}`}
                  type="button"
                  onClick={() => {
                    onAddBlock("bracket", { refId: b.phaseId, bracketKey: b.bracketKey });
                    setOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-secondary"
                >
                  {b.categoryName ? b.categoryName + " · " : ""}
                  {b.name}
                </button>
              ))}
            </div>
          )}
          {sources.groups.length === 0 && sources.brackets.length === 0 && (
            <p className="p-4 text-xs text-muted-foreground italic">
              Nog geen groepen of brackets in dit toernooi.
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};




const BlockButton = ({
  icon: Icon,
  label,
  onClick,
}: {
  icon: any;
  label: string;
  onClick: () => void;
}) => (
  <button
    type="button"
    title={label}
    onClick={onClick}
    className="h-8 w-8 inline-flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
  >
    <Icon className="h-4 w-4" />
  </button>
);

const BlockRow = ({
  block,
  sources,
  tournament,
  tournamentId,
  onChange,
  onRemove,
}: {
  block: SlideBlock;
  sources: {
    groups: { id: string; name: string; phaseName: string; categoryName?: string }[];
    brackets: { phaseId: string; bracketKey: string; name: string; categoryName?: string }[];
  };
  tournament: any;
  tournamentId: string;
  onChange: (patch: Partial<SlideBlock>) => void;
  onRemove: () => void;
}) => {
  const needsGroup = block.type === "group_standing" || block.type === "group_schedule" || block.type === "group_combo";
  const needsPhase = block.type === "bracket";

  // Een geselecteerde groep staat vast — via de toolbar kies je een groep,
  // het type blok pas je dan aan via de comboLayout-knop (Stand / Schema / Stand+Schema).
  const groupLocked = block.type === "group_combo";

  const refOptions = needsGroup
    ? sources.groups.map(g => ({
        id: g.id,
        bracketKey: null as string | null,
        label: `${g.categoryName ? g.categoryName + " · " : ""}${g.name}`,
      }))
    : needsPhase
    ? sources.brackets.map(b => ({
        id: b.phaseId,
        bracketKey: b.bracketKey,
        label: `${b.categoryName ? b.categoryName + " · " : ""}${b.name}`,
      }))
    : [];

  const findActiveOption = () => {
    if (needsPhase) {
      return refOptions.find(o => o.id === block.refId && o.bracketKey === (block.bracketKey ?? "main"));
    }
    return refOptions.find(o => o.id === block.refId);
  };
  const activeOpt = findActiveOption();
  const refLabel = activeOpt?.label || refOptions[0]?.label || "—";

  // Image-blok: eigen rij met preview en upload
  if (block.type === "image") {
    return (
      <div className="flex items-center gap-2">
        <div className="flex-1 flex items-center gap-3 rounded border border-border bg-card px-3 py-2">
          {block.imageUrl ? (
            <img src={block.imageUrl} alt="" className="h-10 w-16 object-contain rounded bg-muted" />
          ) : (
            <div className="h-10 w-16 flex items-center justify-center rounded bg-muted text-muted-foreground">
              <ImageIcon className="h-4 w-4" />
            </div>
          )}
          <span className="text-sm text-foreground truncate">
            {block.imageUrl ? "Afbeelding" : "Geen afbeelding gekozen"}
          </span>
          <ImageUploadButton
            tournamentId={tournamentId}
            label={block.imageUrl ? "Vervangen" : "Uploaden"}
            inline
            onUploaded={url => onChange({ imageUrl: url })}
          />
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="text-muted-foreground hover:text-destructive"
          aria-label="Verwijder blok"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {/* Source picker (or static label) */}
      {refOptions.length === 0 ? (
        <div className="flex-1 rounded border border-border bg-card px-3 py-2 text-sm text-foreground">
          {BLOCK_LABELS[block.type]}
        </div>
      ) : groupLocked ? (
        <div className="flex-1 inline-flex items-center justify-between gap-2 rounded border border-border bg-muted/40 px-3 py-2 text-sm text-foreground">
          <span className="truncate">{refLabel}</span>
        </div>
      ) : (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex-1 inline-flex items-center justify-between gap-2 rounded border border-border bg-card px-3 py-2 text-sm text-foreground hover:border-foreground/30"
            >
              <span className="truncate">{refLabel}</span>
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-72">
            {refOptions.map((o, idx) => (
              <DropdownMenuItem
                key={`${o.id}-${o.bracketKey ?? idx}`}
                onClick={() =>
                  onChange(
                    needsPhase
                      ? { refId: o.id, bracketKey: o.bracketKey ?? "main" }
                      : { refId: o.id },
                  )
                }
              >
                {o.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {/* For group_combo, allow toggling sub-layout */}
      {block.type === "group_combo" && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="inline-flex items-center justify-between gap-1 rounded border border-border bg-card px-2 py-2 text-xs text-foreground hover:border-foreground/30"
            >
              {block.comboLayout === "standing"
                ? "Stand"
                : block.comboLayout === "schedule"
                ? "Schema"
                : "Stand en schema"}
              <ChevronDown className="h-3 w-3" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onChange({ comboLayout: "standing_schedule" })}>
              Stand en schema
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onChange({ comboLayout: "standing" })}>
              Stand
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onChange({ comboLayout: "schedule" })}>
              Schema
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {/* Width — group_combo (stand+schema) en bracket zijn altijd 100% */}
      {!(block.type === "bracket" || (block.type === "group_combo" && (!block.comboLayout || block.comboLayout === "standing_schedule"))) && (
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded border border-border bg-card px-3 py-2 text-xs text-foreground hover:border-foreground/30"
            >
              {block.width}%
              <ChevronDown className="h-3 w-3" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-32 p-2" align="end">
            <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-1 px-1">
              Breedte
            </p>
            {([33, 50, 66, 100] as BlockWidth[]).map(w => (
              <button
                key={w}
                type="button"
                onClick={() => onChange({ width: w })}
                className={`w-full text-left px-2 py-1.5 text-sm rounded hover:bg-secondary ${
                  block.width === w ? "text-primary font-bold" : "text-foreground"
                }`}
              >
                {w}%
              </button>
            ))}
          </PopoverContent>
        </Popover>
      )}

      <button
        type="button"
        onClick={onRemove}
        className="text-muted-foreground hover:text-destructive"
        aria-label="Verwijder blok"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
};

// ── Image upload button ─────────────────────────────────────
const ImageUploadButton = ({
  tournamentId,
  onUploaded,
  label,
  inline = false,
}: {
  tournamentId: string;
  onUploaded: (url: string) => void;
  label?: string;
  inline?: boolean;
}) => {
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);

  const handleFile = async (file: File | null) => {
    if (!file) return;
    setUploading(true);
    try {
      const compressed = await compressImage(file);
      const ext = getFileExtension(compressed);
      const path = `${tournamentId}/slideshow-${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from("tournament-attachments")
        .upload(path, compressed, { upsert: true, contentType: compressed.type });
      if (error) throw error;
      const { data } = supabase.storage.from("tournament-attachments").getPublicUrl(path);
      onUploaded(data.publicUrl);
      toast({ title: "Afbeelding geüpload" });
    } catch (e: any) {
      toast({ title: "Upload mislukt", description: e?.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  if (inline) {
    return (
      <label className="ml-auto inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-primary cursor-pointer hover:underline">
        <Upload className="h-3.5 w-3.5" />
        {uploading ? "Bezig…" : (label || "Uploaden")}
        <input
          type="file"
          accept="image/*"
          className="hidden"
          onChange={e => { handleFile(e.target.files?.[0] ?? null); e.target.value = ""; }}
        />
      </label>
    );
  }

  return (
    <label
      title="Afbeelding"
      className="h-8 w-8 inline-flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer"
    >
      <ImageIcon className="h-4 w-4" />
      <input
        type="file"
        accept="image/*"
        className="hidden"
        disabled={uploading}
        onChange={e => { handleFile(e.target.files?.[0] ?? null); e.target.value = ""; }}
      />
    </label>
  );
};

export default SlideshowConfig;
