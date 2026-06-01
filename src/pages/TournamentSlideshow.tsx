import { useState, useEffect, useMemo, useRef, useLayoutEffect, type ReactNode } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { fetchTournamentMatches } from "@/lib/fetchTournamentMatches";
import { isSetsGroup, computeSetPointTotals, formatSigned } from "@/lib/standingsDisplay";
import {
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  Maximize,
  Minimize,
  Trophy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import BroadcastStyleContext from "@/contexts/BroadcastStyleContext";
import { type BroadcastStyle } from "@/lib/broadcastStyles";
import {
  type SlideshowRow,
  type Slide,
  type SlideBlock,
  BLOCK_LABELS,
  DEFAULT_OPTIONS,
  DEFAULT_SPONSOR_BAR,
} from "@/lib/slideshowTypes";
import { ds } from "@/lib/broadcastStyles";
import PublicBracketSection, { detectBracketStructure } from "@/components/public-view/PublicBracketSection";

// ── Helpers ──────────────────────────────────────────────────
const teamNameOf = (teams: any[], id: string | null | undefined) =>
  teams.find(t => t.id === id)?.name || "—";

const teamLogoOf = (teams: any[], id: string | null | undefined) =>
  teams.find(t => t.id === id)?.logo_url || null;

/**
 * Wrapper die de slideshow-inhoud op een vaste 1920x1080 canvas rendert
 * en die schaalt om binnen de beschikbare ruimte te passen. Hierdoor zien
 * popup en fullscreen er altijd identiek uit.
 */
const SlideshowCanvas = ({ children }: { children: ReactNode }) => {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const compute = () => {
      const el = wrapRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const s = Math.min(rect.width / 1920, rect.height / 1080);
      setScale(s);
    };
    compute();
    const ro = new ResizeObserver(compute);
    if (wrapRef.current) ro.observe(wrapRef.current);
    window.addEventListener("resize", compute);
    document.addEventListener("fullscreenchange", compute);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", compute);
      document.removeEventListener("fullscreenchange", compute);
    };
  }, []);

  return (
    <div ref={wrapRef} className="relative w-full h-full overflow-hidden">
      <div
        style={{
          position: "absolute",
          width: 1920,
          height: 1080,
          left: "50%",
          top: "50%",
          marginLeft: -960,
          marginTop: -540,
          transform: `scale(${scale})`,
          transformOrigin: "center center",
        }}
      >
        {children}
      </div>
    </div>
  );
};

const TournamentSlideshow = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const wantedShowId = searchParams.get("show");

  const [tournament, setTournament] = useState<any>(null);
  const [shows, setShows] = useState<SlideshowRow[]>([]);
  const [phases, setPhases] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [groupTeams, setGroupTeams] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [matches, setMatches] = useState<any[]>([]);
  const [stats, setStats] = useState<any[]>([]);
  const [sponsors, setSponsors] = useState<any[]>([]);
  const [slots, setSlots] = useState<any[]>([]);
  const [scoringSystems, setScoringSystems] = useState<any[]>([]);
  const [standingColors, setStandingColors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [currentIdx, setCurrentIdx] = useState(0);
  const [autoPlay, setAutoPlay] = useState(true);
  const [now, setNow] = useState(new Date());
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // ── Initial load ─────────────────────────────────────────
  const fetchAll = async () => {
    if (!id) return;
    try {
      const { data: t } = await supabase
        .from("tournaments")
        .select("*")
        .eq("id", id)
        .single();
      if (!t) {
        setLoading(false);
        return;
      }
      setTournament(t);

      const [showsRes, pRes, gRes, teamsRes, gtRes, mRes, statsRes, sponsorsRes, slotsRes, ssRes, scRes] =
        await Promise.all([
          supabase
            .from("tournament_slideshows" as any)
            .select("*")
            .eq("tournament_id", t.id)
            .order("sort_order"),
          supabase
            .from("tournament_phases")
            .select("*")
            .eq("tournament_id", t.id)
            .order("sort_order"),
          supabase
            .from("groups")
            .select("*")
            .eq("tournament_id", t.id)
            .order("sort_order"),
          supabase.from("teams").select("*").eq("tournament_id", t.id),
          supabase.from("group_teams").select("*").eq("tournament_id", t.id),
          fetchTournamentMatches({
            tournamentId: t.id,
            orders: [{ column: "match_date" }, { column: "match_time" }],
            maxRows: 5000,
          }).catch(() => []),
          supabase.from("match_stats").select("*").eq("tournament_id", t.id),
          supabase
            .from("tournament_sponsors")
            .select("*")
            .eq("tournament_id", t.id)
            .order("sort_order"),
          supabase.from("slots").select("*").eq("tournament_id", t.id),
          supabase.from("tournament_scoring_systems" as any).select("*").eq("tournament_id", t.id),
          supabase.from("standing_colors").select("*").eq("tournament_id", t.id),
        ]);

      setShows(((showsRes.data ?? []) as any[]) as SlideshowRow[]);
      setPhases(pRes.data ?? []);
      setGroups(gRes.data ?? []);
      setTeams(teamsRes.data ?? []);
      setGroupTeams(gtRes.data ?? []);
      setMatches(mRes as any[]);
      setStats(statsRes.data ?? []);
      setSponsors(sponsorsRes.data ?? []);
      setSlots(slotsRes.data ?? []);
      setScoringSystems((ssRes as any).data ?? []);
      setStandingColors((scRes as any).data ?? []);
    } catch (error) {
      console.warn("Slideshow load failed", error);
    } finally {
      setLoading(false);
    }
  };

  const recoverMissingShow = async () => {
    if (!id || loading || shows.length > 0) return;
    const fallbackShow: SlideshowRow = {
      id: "local-fallback",
      tournament_id: id,
      name: "Diavoorstelling 1",
      sort_order: 0,
      slides: [],
      sponsor_bar: DEFAULT_SPONSOR_BAR,
      options: DEFAULT_OPTIONS,
      category_id: null,
    };
    setShows([fallbackShow]);
  };

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    recoverMissingShow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, shows.length, id]);

  // Realtime
  useEffect(() => {
    if (!tournament) return;
    const filter = `tournament_id=eq.${tournament.id}`;
    const tables = [
      "matches",
      "group_teams",
      "groups",
      "teams",
      "tournament_phases",
      "tournament_slideshows",
      "tournament_sponsors",
      "tournament_polls",
      "poll_votes",
      "match_stats",
      "standing_colors",
      "slots",
      "tournament_scoring_systems",
      "ranking_rules",
      "phase_progressions",
      "tournaments",
      "players",
      "staff",
      "tournament_locations",
      "tournament_attachments",
      "tournament_categories",
    ];
    let ch = supabase.channel("slideshow-" + tournament.id);
    for (const table of tables) {
      // tournaments-tabel gebruikt 'id' i.p.v. 'tournament_id'; poll_votes heeft geen tournament_id
      const tableFilter =
        table === "poll_votes"
          ? undefined
          : table === "tournaments"
            ? `id=eq.${tournament.id}`
            : filter;
      ch = ch.on(
        "postgres_changes" as any,
        { event: "*", schema: "public", table, filter: tableFilter },
        fetchAll
      );
    }
    ch.subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tournament?.id]);

  // Clock
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  // Active show
  const activeShow = useMemo(() => {
    if (!shows.length) return null;
    if (wantedShowId) return shows.find(s => s.id === wantedShowId) || shows[0];
    return shows[0];
  }, [shows, wantedShowId]);

  // Helper: tel hoeveel rondes een bracket-block heeft (gebruikt om grote brackets in 2 slides te splitsen)
  const countBracketRounds = (block: SlideBlock): number => {
    if (block.type !== "bracket" || !block.refId) return 0;
    const phase = phases.find(p => p.id === block.refId);
    if (!phase) return 0;
    const phaseGroups = groups.filter(g => g.phase_id === phase.id);
    const phaseMatches = matches.filter(m => m.phase_id === phase.id);
    if (phaseGroups.length === 0 || phaseMatches.length === 0) return 0;
    const cfg = (phase.match_config || {}) as any;
    const bracketGroupMap = (cfg.bracketGroupMap || {}) as Record<string, string>;
    const phaseMatchType = cfg.matchType || "single_leg";
    try {
      const struct = detectBracketStructure(phaseGroups, phaseMatches, bracketGroupMap, phaseMatchType);
      const key = block.bracketKey || "main";
      const rounds = key === "main" ? struct.mainRounds : (struct.loserBrackets[key] || []);
      return rounds.length;
    } catch {
      return 0;
    }
  };

  const enabledSlides = useMemo<Slide[]>(() => {
    const base = (activeShow?.slides ?? []).filter(s => s.enabled && s.blocks.length > 0);
    // Voor brackets met 7+ rondes (≥128 teams): splits in twee slides
    // Slide A: R128-uitslagen als compact grid
    // Slide B: bracket vanaf R64 (skipFirstRounds=1)
    const expanded: Slide[] = [];
    for (const slide of base) {
      // Alleen splitsen als de slide exact één bracket-block bevat (gebruikelijk: bracket = full-width)
      const onlyBracket = slide.blocks.length === 1 && slide.blocks[0].type === "bracket";
      if (onlyBracket) {
        const rounds = countBracketRounds(slide.blocks[0]);
        if (rounds >= 7) {
          expanded.push({
            ...slide,
            id: slide.id + "::r128-results",
            blocks: [{ ...slide.blocks[0], _bracketView: "r128-results" } as any],
          });
          expanded.push({
            ...slide,
            id: slide.id + "::from-r64",
            blocks: [{ ...slide.blocks[0], _bracketView: "from-r64" } as any],
          });
          continue;
        }
      }
      expanded.push(slide);
    }
    return expanded;
  }, [activeShow, phases, groups, matches]);

  // Auto-advance using current slide's duration
  useEffect(() => {
    if (!autoPlay || enabledSlides.length <= 1) return;
    const slide = enabledSlides[currentIdx % enabledSlides.length];
    const dur = (slide?.durationSec ?? activeShow?.options.defaultDurationSec ?? 15) * 1000;
    const t = setTimeout(() => {
      setCurrentIdx(i => (i + 1) % enabledSlides.length);
    }, dur);
    return () => clearTimeout(t);
  }, [autoPlay, currentIdx, enabledSlides, activeShow]);

  // Keep currentIdx in range
  useEffect(() => {
    if (currentIdx >= enabledSlides.length) setCurrentIdx(0);
  }, [enabledSlides.length, currentIdx]);

  // Keyboard
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault();
        setCurrentIdx(i => (i + 1) % Math.max(1, enabledSlides.length));
      } else if (e.key === "ArrowLeft") {
        setCurrentIdx(i => (i === 0 ? enabledSlides.length - 1 : i - 1));
      } else if (e.key === "f" || e.key === "F") {
        toggleFullscreen();
      } else if (e.key === "Escape") {
        if (document.fullscreenElement) document.exitFullscreen();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [enabledSlides.length]);

  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  // Auto-fullscreen wanneer geopend vanuit het beheer (?autofs=1).
  // requestFullscreen vereist een user gesture — daarom triggeren we het
  // bij de eerste klik of toetsaanslag op de pagina.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("autofs") !== "1") return;
    if (document.fullscreenElement) return;
    const tryFs = () => {
      if (document.fullscreenElement) return;
      containerRef.current?.requestFullscreen?.().catch(() => {});
    };
    // Probeer direct (sommige browsers staan dit toe vanuit window.open)
    tryFs();
    const onInteract = () => {
      tryFs();
      window.removeEventListener("pointerdown", onInteract);
      window.removeEventListener("keydown", onInteract);
    };
    window.addEventListener("pointerdown", onInteract);
    window.addEventListener("keydown", onInteract);
    return () => {
      window.removeEventListener("pointerdown", onInteract);
      window.removeEventListener("keydown", onInteract);
    };
  }, []);

  // Force light-mode + active broadcast style on the slideshow page (same as PublicView)
  useEffect(() => {
    if (!tournament) return;
    const style = tournament.view_display_style || "espn";
    const prevMode = document.documentElement.getAttribute("data-mode");
    const prevBroadcast = document.documentElement.getAttribute("data-broadcast");
    document.documentElement.setAttribute("data-mode", "light");
    document.documentElement.setAttribute("data-broadcast", style);
    return () => {
      if (prevMode) document.documentElement.setAttribute("data-mode", prevMode);
      else document.documentElement.removeAttribute("data-mode");
      if (prevBroadcast) document.documentElement.setAttribute("data-broadcast", prevBroadcast);
      else document.documentElement.removeAttribute("data-broadcast");
    };
  }, [tournament?.id, tournament?.view_display_style]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  // Filter source data to the active show's division (if set).
  // Hooks must run on every render in the same order — keep them BEFORE any early return.
  const showCategoryId = (activeShow as any)?.category_id ?? null;
  const allowedPhaseIds = useMemo(() => {
    if (!showCategoryId) return null;
    return new Set(phases.filter(p => p.category_id === showCategoryId).map(p => p.id));
  }, [phases, showCategoryId]);
  const filteredPhases = useMemo(
    () => (allowedPhaseIds ? phases.filter(p => allowedPhaseIds.has(p.id)) : phases),
    [phases, allowedPhaseIds],
  );
  const filteredGroups = useMemo(
    () => (allowedPhaseIds ? groups.filter(g => allowedPhaseIds.has(g.phase_id)) : groups),
    [groups, allowedPhaseIds],
  );
  const filteredMatches = useMemo(
    () => (allowedPhaseIds ? matches.filter(m => allowedPhaseIds.has(m.phase_id)) : matches),
    [matches, allowedPhaseIds],
  );
  const filteredStats = useMemo(() => {
    if (!allowedPhaseIds) return stats;
    const matchIds = new Set(filteredMatches.map(m => m.id));
    return stats.filter(s => matchIds.has(s.match_id));
  }, [stats, filteredMatches, allowedPhaseIds]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground text-lg">Toernooi niet gevonden.</p>
      </div>
    );
  }

  const broadcastStyle = (tournament.view_display_style || "espn") as BroadcastStyle;
  const opts = activeShow?.options;
  const sponsorBarOn = !!activeShow?.sponsor_bar?.enabled && sponsors.length > 0;
  // Build one fixed-width sponsor set wider than the 1920px canvas, then duplicate it.
  // The fixed item width prevents narrow logos from creating an empty tail before reset.
  const sponsorItemWidth = 188;
  const setRepeats = Math.max(1, Math.ceil(1920 / Math.max(1, sponsors.length * sponsorItemWidth)) + 1);
  const oneSet = Array.from({ length: setRepeats }).flatMap(() => sponsors);
  const sponsorTicker = [...oneSet, ...oneSet];
  const sponsorSetWidth = oneSet.length * sponsorItemWidth;
  const sponsorScrollDuration = Math.max(20, Math.round(sponsorSetWidth / 80));

  const slide = enabledSlides[currentIdx];
  const slideHasBracket = !!slide?.blocks.some(block => block.type === "bracket");

  return (
    <BroadcastStyleContext.Provider value={broadcastStyle}>
      <div ref={containerRef} className="h-screen min-h-screen overflow-hidden bg-background">
       <SlideshowCanvas>
        <div className="w-[1920px] h-[1080px] overflow-hidden bg-background flex flex-col">
        {/* Top bar */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-border bg-card">
          <div className="flex items-center gap-4 min-w-0">
            {tournament.logo_url && (
              <img src={tournament.logo_url} alt="" className="h-12 w-12 rounded object-contain" />
            )}
            {opts?.showTournamentName && (
              <span className={`${ds(broadcastStyle, "sectionTitle") || "font-display font-black"} truncate text-3xl text-foreground`}>
                {tournament.name}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {opts?.showCurrentTime && (
              <span className={`${ds(broadcastStyle, "matchTimeBadge") || "font-mono font-bold tabular-nums"} text-3xl text-foreground`}>
                {now.toLocaleTimeString("nl-BE", { hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
          </div>
        </div>

        {/* Slide content */}
        <div className="flex-1 min-h-0 flex items-stretch justify-center p-6 overflow-hidden">
          {!slide ? (
            <div className="m-auto text-center">
              <Trophy className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground">
                Geen actieve dia's. Voeg dia's toe in het beheer.
              </p>
            </div>
          ) : (
            <div className={`w-full h-full min-h-0 ${slideHasBracket ? "max-w-none" : "max-w-[1600px]"} flex flex-wrap gap-4 content-start`}>
              {slide.blocks.map(block => (
                <BlockView
                  key={block.id}
                  block={block}
                  context={{ tournament, phases: filteredPhases, groups: filteredGroups, groupTeams, teams, matches: filteredMatches, stats: filteredStats, slots, scoringSystems, standingColors, style: broadcastStyle }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Sponsor bar */}
        {sponsorBarOn && (
          <div className="border-t border-border bg-card overflow-hidden h-16 flex items-center">
            <div
              className="flex items-center whitespace-nowrap"
              style={{ animation: `slideshow-scroll ${sponsorScrollDuration}s linear infinite` }}
            >
              {sponsorTicker.map((sp, i) => (
                <div key={`${sp.id ?? sp.logo_url}-${i}`} className="w-[188px] shrink-0 px-6 flex items-center justify-center">
                  <img
                    src={sp.logo_url}
                    alt={sp.name || ""}
                    className="h-12 max-w-full object-contain"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Inline keyframes (single-shot insert) */}
        <style>{`
          @keyframes slideshow-scroll {
            0% { transform: translateX(0); }
            100% { transform: translateX(-50%); }
          }
        `}</style>
        </div>
       </SlideshowCanvas>
      </div>
    </BroadcastStyleContext.Provider>
  );
};

// ── Block view ───────────────────────────────────────────────

interface Ctx {
  tournament: any;
  phases: any[];
  groups: any[];
  groupTeams: any[];
  teams: any[];
  matches: any[];
  stats: any[];
  slots: any[];
  scoringSystems: any[];
  standingColors: any[];
  style: BroadcastStyle;
}

const BlockView = ({ block, context }: { block: SlideBlock; context: Ctx }) => {
  const blockTeamCount = block.type === "group_standing" && block.refId
    ? context.groupTeams.filter(gt => gt.group_id === block.refId).length
    : 0;
  // Stand+Schema en bracket worden altijd op volle breedte getoond
  const forceFull =
    block.type === "bracket" ||
    (block.type === "group_standing" && blockTeamCount > 64) ||
    (block.type === "group_combo" && (!block.comboLayout || block.comboLayout === "standing_schedule"));
  const effWidth = forceFull ? 100 : block.width;

  const widthClass =
    effWidth === 100
      ? "w-full"
      : effWidth === 66
      ? "w-full md:w-[calc(66.666%-0.5rem)]"
      : effWidth === 50
      ? "w-full md:w-[calc(50%-0.5rem)]"
      : "w-full md:w-[calc(33.333%-0.667rem)]";

  const cardCls = ds(context.style, "card") || "rounded-xl border border-border bg-card";
  const fullHeightSizing = block.type === "bracket" ? "h-full min-h-0" : block.type === "group_standing" ? "max-h-full min-h-0" : "";

  // Stand + Schema → render als TWEE losse kaarten naast elkaar
  // (zelfde stijl als andere blokken — eigen header per kaart)
  if (block.type === "group_combo" && (!block.comboLayout || block.comboLayout === "standing_schedule")) {
    return (
      <div className={`${widthClass} h-full min-h-0 flex flex-wrap gap-4 items-start`}>
        <div className={`flex-1 min-w-[280px] max-h-full min-h-0 ${cardCls} overflow-hidden flex flex-col`}>
          <GroupStandingBlock groupId={block.refId} context={context} />
        </div>
        <div className={`flex-1 min-w-[280px] max-h-full min-h-0 ${cardCls} overflow-hidden flex flex-col`}>
          <GroupScheduleBlock groupId={block.refId} context={context} hideSubtitle />
        </div>
      </div>
    );
  }

  return (
    <div className={`${widthClass} ${fullHeightSizing} ${cardCls} overflow-hidden flex flex-col`}>
      <BlockContent block={block} context={context} />
    </div>
  );
};

const BlockContent = ({ block, context }: { block: SlideBlock; context: Ctx }) => {
  switch (block.type) {
    case "group_standing":
      return <GroupStandingBlock groupId={block.refId} context={context} />;
    case "group_schedule":
      return <GroupScheduleBlock groupId={block.refId} context={context} />;
    case "group_combo":
      return <GroupComboBlock groupId={block.refId} layout={block.comboLayout} context={context} />;
    case "bracket":
      return <BracketBlock phaseId={block.refId} bracketKey={block.bracketKey ?? "main"} context={context} view={(block as any)._bracketView} />;
    case "upcoming_matches":
      return <UpcomingBlock context={context} />;
    case "recent_results":
      return <RecentResultsBlock context={context} />;
    case "topscorers":
      return <StatRankingBlock type="goal" title="Topscorers" context={context} />;
    case "assists":
      return <StatRankingBlock type="assist" title="Assists" context={context} />;
    case "fairplay":
      return <FairplayBlock context={context} />;
    case "image":
      return (
        <div className="w-full h-full flex items-center justify-center bg-card overflow-hidden">
          {block.imageUrl ? (
            <img
              src={block.imageUrl}
              alt=""
              className="w-full h-full object-contain"
            />
          ) : (
            <p className="p-6 text-muted-foreground text-sm">Geen afbeelding</p>
          )}
        </div>
      );
    default:
      return <p className="p-6 text-muted-foreground text-sm">Onbekend blok</p>;
  }
};

// ── Block-specific renderers ─────────────────────────────────

const BlockHeader = ({
  title,
  subtitle,
  style,
  count,
}: {
  title: string;
  subtitle?: string;
  style: BroadcastStyle;
  count?: string;
}) => {
  const headerCls = ds(style, "cardHeader") || "bg-primary text-primary-foreground px-4 py-2";
  const titleCls = ds(style, "cardHeaderTitle") || "text-lg font-black uppercase tracking-wide";
  const dotCls = ds(style, "cardHeaderDot") || "";
  return (
    <div className={`${headerCls} flex items-center justify-between`}>
      <div className="flex items-center gap-2 min-w-0">
        {dotCls && <span className={dotCls} />}
        <h3 className={`${titleCls} truncate font-black`}>
          {title}
          {count ? ` (${count})` : ""}
        </h3>
      </div>
      {subtitle && <span className="text-xs font-bold uppercase tracking-wide opacity-90 truncate">{subtitle}</span>}
    </div>
  );
};

const calcStandings = (groupId: string, ctx: Ctx) => {
  const gts = ctx.groupTeams.filter(gt => gt.group_id === groupId);
  const gMatches = ctx.matches.filter(m => m.group_id === groupId && m.is_played);
  const ptsWin = ctx.tournament?.points_win ?? 3;
  const ptsDraw = ctx.tournament?.points_draw ?? 1;
  const rows = gts.map(gt => {
    const team = ctx.teams.find(t => t.id === gt.team_id);
    let w = 0, d = 0, l = 0, gf = 0, ga = 0;
    gMatches.forEach(m => {
      if (m.home_team_id === gt.team_id) {
        gf += m.home_score ?? 0;
        ga += m.away_score ?? 0;
        if ((m.home_score ?? 0) > (m.away_score ?? 0)) w++;
        else if (m.home_score === m.away_score) d++;
        else l++;
      } else if (m.away_team_id === gt.team_id) {
        gf += m.away_score ?? 0;
        ga += m.home_score ?? 0;
        if ((m.away_score ?? 0) > (m.home_score ?? 0)) w++;
        else if (m.home_score === m.away_score) d++;
        else l++;
      }
    });
    return {
      team,
      gp: w + d + l,
      w, d, l, gf, ga,
      gd: gf - ga,
      pts: w * ptsWin + d * ptsDraw + (gt.bonus_points ?? 0),
    };
  });
  rows.sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf || b.w - a.w);
  return rows.map((r, i) => ({ ...r, pos: i + 1 }));
};

const StandingsTable = ({
  groupId,
  context,
  compact,
  /** Bij heel grote groepen tonen we alleen GP / DS / Pt om plek te besparen */
  minimal,
  /** Vul de beschikbare hoogte: rijen krijgen evenveel ruimte */
  fillHeight,
}: {
  groupId: string;
  context: Ctx;
  compact?: boolean;
  minimal?: boolean;
  fillHeight?: boolean;
}) => {
  const standings = calcStandings(groupId, context);
  const headerCls = ds(context.style, "tableHeader") || "bg-secondary text-muted-foreground text-[11px] uppercase";
  const ptsCls = ds(context.style, "ptsBadge") || "font-bold text-primary";
  const padX = compact ? "px-1.5" : "px-2";
  const teamPadX = compact ? "px-2" : "px-3";

  const total = standings.length;
  // Maximaal ±32 rijen per kolom: 64 teams = 2 kolommen, 128 teams = 4 kolommen.
  const cols = total > 96 ? 4 : total > 64 ? 3 : total >= 20 ? 2 : 1;
  const tightColumns = cols >= 3;

  const setsMode = isSetsGroup(groupId, context.groups as any, context.phases as any, context.scoringSystems as any);
  const setPts = setsMode ? computeSetPointTotals(groupId, context.matches as any) : null;

  // Color zones (kwalificatie) — gekoppeld aan de phase van deze groep
  const grp = context.groups.find((g: any) => g.id === groupId);
  const phaseColors = (context.standingColors || [])
    .filter((sc: any) => sc.phase_id === grp?.phase_id)
    .sort((a: any, b: any) => a.position_from - b.position_from);
  const colorForPos = (pos: number) =>
    phaseColors.find((sc: any) => pos >= sc.position_from && pos <= sc.position_to);

  // Bepaal rijgrootte op basis van aantal rijen per kolom — schaalt door bij erg veel teams.
  // Standaard: rij-hoogte komt overeen met schema-rijen (py-2, h-6 logo, text-base) zodat
  // klassement en schema dezelfde balkhoogte hebben. Tabel sluit af op natuurlijke hoogte
  // (geen stretch tot onderaan). Pas wanneer er te veel rijen zijn om te passen, schalen
  // we omlaag in tiers; uiteindelijk splitst de tabel in kolommen (zie `cols` hierboven).
  const renderTable = (rows: typeof standings) => {
    const n = rows.length;
    // Density tiers — pas verkleinen wanneer een groep echt te groot is voor de slot.
    // Drempels gelden per kolom (na splitsing zit n al lager, dus dense/xDense triggeren minder).
    const dense = n > 16;       // iets compactere rijen
    const xDense = n > 24;      // duidelijk kleinere rijen
    const ultra = n > 32;       // minimale rijhoogte voor extreme gevallen
    // Default sizing matcht de schedule-rij (py-2, h-6 logo, text-base).
    const logoSize = ultra ? "h-3 w-3" : xDense || tightColumns ? "h-4 w-4" : dense ? "h-5 w-5" : "h-6 w-6";
    const textSize = ultra ? "text-[10px] leading-none" : xDense || tightColumns ? "text-xs leading-none" : dense ? "text-sm leading-tight" : "text-base";
    const tPadX = ultra ? "px-1" : xDense || tightColumns ? "px-1.5" : dense ? "px-2" : teamPadX;
    const cPadX = ultra ? "px-0.5" : xDense || tightColumns ? "px-1" : dense ? "px-1.5" : padX;
    const gap = ultra || xDense || tightColumns ? "gap-1" : "gap-2";
    const rowPadY = ultra ? "py-0.5" : xDense || tightColumns ? "py-1" : dense ? "py-1.5" : "py-2";
    const posW = tightColumns ? "w-5" : "w-7";
    const numW = tightColumns ? "w-6" : "w-8";
    const wideNumW = tightColumns ? "w-7" : "w-10";
    const headRowH = ultra ? "h-4" : xDense || tightColumns ? "h-5" : "h-6";
    const headTextSize = ultra || xDense || tightColumns ? "text-[10px]" : "text-[11px]";
    return (
      <table className={`w-full ${textSize} table-fixed`} style={{ borderCollapse: "collapse" }}>
        <thead>
          <tr className={`${headerCls} ${headTextSize} ${headRowH} uppercase tracking-wide`}>
            <th className={`${tPadX} text-left ${posW} align-middle font-bold`}>#</th>
            <th className={`${tPadX} text-left align-middle font-bold`}>Team</th>
            <th className={`${cPadX} text-center ${numW} align-middle font-bold`}>GS</th>
            {!minimal && <th className={`${cPadX} text-center ${numW} align-middle font-bold`}>W</th>}
            {!minimal && <th className={`${cPadX} text-center ${numW} align-middle font-bold`}>G</th>}
            {!minimal && <th className={`${cPadX} text-center ${numW} align-middle font-bold`}>V</th>}
            {!minimal && setsMode ? (
              <>
                <th className={`${cPadX} text-center w-9 align-middle font-bold`}>SV</th>
                <th className={`${cPadX} text-center w-9 align-middle font-bold`}>ST</th>
                <th className={`${cPadX} text-center ${wideNumW} align-middle font-bold`}>S+/-</th>
                <th className={`${cPadX} text-center w-10 align-middle font-bold`}>PV</th>
                <th className={`${cPadX} text-center w-10 align-middle font-bold`}>PT</th>
              </>
            ) : !minimal ? (
              <>
                <th className={`${cPadX} text-center w-9 align-middle font-bold`}>+</th>
                <th className={`${cPadX} text-center w-9 align-middle font-bold`}>-</th>
                <th className={`${cPadX} text-center ${wideNumW} align-middle font-bold`}>+/-</th>
              </>
            ) : (
              <th className={`${cPadX} text-center ${wideNumW} align-middle font-bold`}>{setsMode ? "S+/-" : "+/-"}</th>
            )}
            <th className={`${cPadX} text-center ${wideNumW} align-middle font-bold`}>P</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const sp = setPts?.get(r.team?.id) || { pf: 0, pa: 0 };
            return (
            <tr
              key={r.team?.id}
              className={`border-t border-border ${rowPadY === "py-0.5" ? "[&>td]:py-0.5" : rowPadY === "py-1" ? "[&>td]:py-1" : rowPadY === "py-1.5" ? "[&>td]:py-1.5" : "[&>td]:py-2"} ${i % 2 === 1 ? ds(context.style, "tableRowAlt") : ""}`}
            >
              <td className={`${tPadX} font-black text-foreground ${posW} align-middle`}>
                <div className="flex items-center gap-1">
                  {colorForPos(r.pos) && (
                    <span
                      className="inline-block w-1 rounded-full shrink-0"
                      style={{ backgroundColor: colorForPos(r.pos)!.color, height: "0.85em" }}
                    />
                  )}
                  <span>{r.pos}</span>
                </div>
              </td>
              <td className={`${tPadX} align-middle`}>
                <div className={`flex items-center ${gap} min-w-0`}>
                  {r.team?.logo_url && (
                    <img src={r.team.logo_url} alt="" className={`${logoSize} rounded object-contain bg-white shrink-0`} />
                  )}
                  <span className="font-bold text-foreground truncate">{r.team?.name}</span>
                </div>
              </td>
              <td className={`${cPadX} text-center font-semibold text-foreground tabular-nums ${numW} align-middle`}>{r.gp}</td>
              {!minimal && <td className={`${cPadX} text-center font-semibold tabular-nums ${numW} align-middle`}>{r.w}</td>}
              {!minimal && <td className={`${cPadX} text-center font-semibold tabular-nums ${numW} align-middle`}>{r.d}</td>}
              {!minimal && <td className={`${cPadX} text-center font-semibold tabular-nums ${numW} align-middle`}>{r.l}</td>}
              {!minimal && setsMode ? (
                <>
                  <td className={`${cPadX} text-center font-semibold text-foreground tabular-nums w-9 align-middle`}>{r.gf}</td>
                  <td className={`${cPadX} text-center font-semibold text-foreground tabular-nums w-9 align-middle`}>{r.ga}</td>
                  <td className={`${cPadX} text-center font-bold tabular-nums ${wideNumW} align-middle`}>{formatSigned(r.gd)}</td>
                  <td className={`${cPadX} text-center font-semibold text-foreground tabular-nums w-10 align-middle`}>{sp.pf}</td>
                  <td className={`${cPadX} text-center font-semibold text-foreground tabular-nums w-10 align-middle`}>{sp.pa}</td>
                </>
              ) : !minimal ? (
                <>
                  <td className={`${cPadX} text-center font-semibold text-foreground tabular-nums w-9 align-middle`}>{formatSigned(r.gf)}</td>
                  <td className={`${cPadX} text-center font-semibold text-foreground tabular-nums w-9 align-middle`}>-{r.ga}</td>
                  <td className={`${cPadX} text-center font-bold tabular-nums ${wideNumW} align-middle`}>{formatSigned(r.gd)}</td>
                </>
              ) : (
                <td className={`${cPadX} text-center font-bold tabular-nums ${wideNumW} align-middle`}>{formatSigned(r.gd)}</td>
              )}
              <td className={`${cPadX} text-center ${wideNumW} align-middle`}><span className={`${ptsCls} font-black tabular-nums`}>{r.pts}</span></td>
            </tr>
            );
          })}
        </tbody>
      </table>
    );
  };

  const Legend = phaseColors.length > 0 ? (
    <div className="border-t border-border px-3 py-1.5 flex flex-wrap gap-x-3 gap-y-1">
      {phaseColors.map((c: any) => (
        <div key={c.id} className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
          <span>{c.label || `Plaats ${c.position_from}–${c.position_to}`}</span>
        </div>
      ))}
    </div>
  ) : null;

  if (cols === 1) return (
    <div className="w-full h-full flex flex-col min-h-0">
      <div className="flex-1 min-h-0 overflow-hidden">{renderTable(standings)}</div>
      {Legend}
    </div>
  );
  const perCol = Math.ceil(total / cols);
  const chunks: typeof standings[] = [];
  for (let i = 0; i < cols; i++) chunks.push(standings.slice(i * perCol, (i + 1) * perCol));
  return (
    <div className="w-full h-full flex flex-col min-h-0">
      <div className="flex-1 min-h-0 grid w-full gap-3" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {chunks.map((chunk, i) => (
          <div key={i} className="min-h-0 h-full overflow-hidden">{renderTable(chunk)}</div>
        ))}
      </div>
      {Legend}
    </div>
  );
};

const GroupStandingBlock = ({ groupId, context }: { groupId?: string | null; context: Ctx }) => {
  const group = context.groups.find(g => g.id === groupId);
  if (!group) return <EmptyBlock label="Geen groep gekozen" />;
  const teamCount = context.groupTeams.filter(gt => gt.group_id === group.id).length;
  const isLarge = teamCount >= 20;
  return (
    <>
      <BlockHeader title={group.name} style={context.style} />
      <div className="flex-1 min-h-0 overflow-hidden">
        <StandingsTable groupId={group.id} context={context} compact={isLarge} minimal={isLarge} />
      </div>
    </>
  );
};

// Helpers for match meta
const groupNameOf = (groups: any[], id: string | null | undefined) =>
  groups.find(g => g.id === id)?.name || null;

const phaseOf = (phases: any[], id: string | null | undefined) =>
  phases.find(p => p.id === id);

const matchSubtitle = (m: any, ctx: Ctx): string | null => {
  // Group phase → group name
  if (m.group_id) return groupNameOf(ctx.groups, m.group_id);
  // Knockout → format (phase) name + round name (or match_name)
  const p = phaseOf(ctx.phases, m.phase_id);
  const formatName = p?.phase_label || p?.name || "";
  const roundName = m.match_name || (m.round_number ? `Ronde ${m.round_number}` : "");
  return [formatName, roundName].filter(Boolean).join(" · ") || null;
};

// Rich match card matching the broadcast layout (see uploaded ESPN-style examples):
//   [code] [home name › logo] [time badge / score] [logo ‹ away name] [group / phase label]
const MatchCardLine = ({ m, context, alt, hideSubtitle }: { m: any; context: Ctx; alt?: boolean; hideSubtitle?: boolean }) => {
  const homeName = teamNameOf(context.teams, m.home_team_id) || m.home_slot_label || "—";
  const awayName = teamNameOf(context.teams, m.away_team_id) || m.away_slot_label || "—";
  const homeLogo = teamLogoOf(context.teams, m.home_team_id);
  const awayLogo = teamLogoOf(context.teams, m.away_team_id);
  const subtitle = matchSubtitle(m, context);
  const timeBadge =
    ds(context.style, "matchTimeBadge") ||
    "inline-flex items-center justify-center text-base font-black tabular-nums px-3 py-1 rounded bg-primary text-primary-foreground";
  const altRowCls = alt ? ds(context.style, "tableRowAlt") || "bg-muted/30" : "";

  // Field name on the left (e.g. "Veld 1"); falls back to round when no field
  const fieldLabel = m.field || (m.round_number ? `R${m.round_number}` : "");

  return (
    <div
      className={`grid items-center gap-2 px-3 py-2 border-b border-border last:border-b-0 text-base ${altRowCls}`}
      style={{ gridTemplateColumns: "70px 1fr 28px 96px 28px 1fr 110px" }}
    >
      {/* Field name */}
      <span className="text-sm font-black uppercase text-foreground tracking-wide truncate">
        {fieldLabel}
      </span>

      {/* Home name (right-aligned) */}
      <span className="font-black text-foreground truncate text-right text-base">{homeName}</span>

      {/* Home logo */}
      <span className="flex justify-center">
        {homeLogo ? <img src={homeLogo} alt="" className="h-6 w-6 rounded object-contain bg-white" /> : null}
      </span>

      {/* Center: time or score */}
      <div className="flex items-center justify-center">
        {m.is_played ? (
          <span className={`${timeBadge} font-black`}>
            {m.home_score ?? 0} - {m.away_score ?? 0}
          </span>
        ) : (
          <span className={`${timeBadge} font-black`}>{m.match_time ? m.match_time.slice(0, 5) : "—"}</span>
        )}
      </div>

      {/* Away logo */}
      <span className="flex justify-center">
        {awayLogo ? <img src={awayLogo} alt="" className="h-6 w-6 rounded object-contain bg-white" /> : null}
      </span>

      {/* Away name (left-aligned) */}
      <span className="font-black text-foreground truncate text-base">{awayName}</span>

      {/* Right: group / phase label — leeg voor groepsschema (groep staat al in header) */}
      <span className="text-xs font-bold text-muted-foreground truncate text-right uppercase tracking-wide">
        {hideSubtitle ? "" : (subtitle || "")}
      </span>
    </div>
  );
};

// Sorteer wedstrijden op datum/tijd/veld zodat we chronologisch kunnen vensteren
const sortMatchesChrono = (arr: any[]) =>
  [...arr].sort((a, b) => {
    const da = a.match_date || "9999-99-99";
    const db = b.match_date || "9999-99-99";
    if (da !== db) return da.localeCompare(db);
    const ta = a.match_time || "99:99";
    const tb = b.match_time || "99:99";
    if (ta !== tb) return ta.localeCompare(tb);
    return (a.field || "").localeCompare(b.field || "");
  });

// Schema-lijst die altijd het beschikbare blok volledig vult.
// Als alles past → toon alles. Als er te veel wedstrijden zijn → toon een venster
// dat de eerstvolgende ongespeelde wedstrijd bevat (resultaten ervoor blijven zichtbaar
// voor zover ze passen, gevolgd door de komende wedstrijden), zodat het blok altijd vol is.
const ScheduleList = ({ matches, context, hideSubtitle }: { matches: any[]; context: Ctx; hideSubtitle?: boolean }) => {
  const sorted = useMemo(() => sortMatchesChrono(matches), [matches]);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const measureRef = useRef<HTMLDivElement | null>(null);
  const [visibleCount, setVisibleCount] = useState<number>(18);
  const [rowHeight, setRowHeight] = useState<number>(44);

  useLayoutEffect(() => {
    const compute = () => {
      const c = containerRef.current;
      const m = measureRef.current;
      if (!c || !m || sorted.length === 0) return;
      const rowH = m.getBoundingClientRect().height || 44;
      const availH = c.clientHeight;
      if (rowH <= 0 || availH <= 0) return;
      const fit = Math.max(1, Math.floor(availH / rowH));
      const count = Math.min(sorted.length, fit, 18);
      setRowHeight(rowH);
      setVisibleCount(count);
    };
    compute();
    const ro = new ResizeObserver(compute);
    if (containerRef.current) ro.observe(containerRef.current);
    const t = window.setTimeout(compute, 100);
    return () => { ro.disconnect(); window.clearTimeout(t); };
  }, [sorted]);

  const safeVisibleCount = sorted.length > 0 ? Math.min(sorted.length, Math.max(1, visibleCount), 18) : 0;
  const visibleMatches = useMemo(() => {
    if (safeVisibleCount === 0 || sorted.length <= safeVisibleCount) return sorted;

    const played = sorted.filter(m => m.is_played);
    const upcoming = sorted.filter(m => !m.is_played);

    if (played.length > 0 && upcoming.length > 0) {
      const wantedResults = Math.min(Math.floor(safeVisibleCount / 2), played.length);
      const wantedUpcoming = Math.min(safeVisibleCount - wantedResults, upcoming.length);
      const extraResults = Math.max(0, safeVisibleCount - wantedResults - wantedUpcoming);
      const resultCount = Math.min(played.length, wantedResults + extraResults);
      const upcomingCount = Math.min(upcoming.length, safeVisibleCount - resultCount);

      return [
        ...played.slice(-resultCount),
        ...upcoming.slice(0, upcomingCount),
      ];
    }

    if (played.length > 0) return played.slice(-safeVisibleCount);
    return upcoming.slice(0, safeVisibleCount);
  }, [safeVisibleCount, sorted]);

  return (
    <div
      ref={containerRef}
      className="h-full overflow-hidden relative"
      style={{ scrollbarWidth: "none" }}
    >
      {/* Onzichtbare meet-rij om actuele rijhoogte te bepalen */}
      <div ref={measureRef} className="absolute opacity-0 pointer-events-none -z-10 left-0 right-0">
        {sorted[0] && <MatchCardLine m={sorted[0]} context={context} hideSubtitle={hideSubtitle} />}
      </div>
      {sorted.length === 0 && (
        <p className="px-4 py-6 text-center text-sm text-muted-foreground italic">
          Geen wedstrijden
        </p>
      )}
      <div
        style={{
          minHeight: rowHeight * visibleMatches.length,
        }}
      >
        {visibleMatches.map((m, i) => (
          <MatchCardLine key={m.id} m={m} context={context} alt={i % 2 === 1} hideSubtitle={hideSubtitle} />
        ))}
      </div>
    </div>
  );
};

const GroupScheduleBlock = ({ groupId, context, hideSubtitle = true }: { groupId?: string | null; context: Ctx; hideSubtitle?: boolean }) => {
  const group = context.groups.find(g => g.id === groupId);
  if (!group) return <EmptyBlock label="Geen groep gekozen" />;
  const gMatches = context.matches.filter(m => m.group_id === group.id);
  return (
    <>
      <BlockHeader title={group.name} subtitle="Schema" style={context.style} />
      <div className="flex-1 min-h-0 overflow-hidden"><ScheduleList matches={gMatches} context={context} hideSubtitle={hideSubtitle} /></div>
    </>
  );
};

const SubSectionHeader = ({ title, style }: { title: string; style: BroadcastStyle }) => {
  const headerCls = ds(style, "tableHeader") || "bg-secondary text-muted-foreground";
  return (
    <div className={`${headerCls} px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] border-b border-border`}>
      {title}
    </div>
  );
};

const GroupComboBlock = ({
  groupId,
  layout,
  context,
}: {
  groupId?: string | null;
  layout?: "standing_schedule" | "standing" | "schedule";
  context: Ctx;
}) => {
  const mode = layout || "standing_schedule";
  if (mode === "standing") return <GroupStandingBlock groupId={groupId} context={context} />;
  if (mode === "schedule") return <GroupScheduleBlock groupId={groupId} context={context} />;
  // both — Stand + Schema naast elkaar met duidelijke scheiding
  const group = context.groups.find(g => g.id === groupId);
  if (!group) return <EmptyBlock label="Geen groep gekozen" />;
  const gMatches = context.matches.filter(m => m.group_id === group.id);
  return (
    <>
      <BlockHeader title={group.name} subtitle="Stand & schema" style={context.style} />
      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 overflow-hidden">
        {/* Stand */}
        <div className="flex flex-col overflow-hidden border-b-4 md:border-b-0 md:border-r-4 border-border bg-card">
          <SubSectionHeader title="Stand" style={context.style} />
          <div className="flex-1 overflow-auto">
            <StandingsTable groupId={group.id} context={context} compact />
          </div>
        </div>
        {/* Schema */}
        <div className="flex flex-col overflow-hidden bg-card">
          <SubSectionHeader title="Schema" style={context.style} />
          <div className="flex-1 min-h-0 overflow-hidden">
            <ScheduleList matches={gMatches} context={context} hideSubtitle />
          </div>
        </div>
      </div>
    </>
  );
};

const BracketBlock = ({
  phaseId,
  bracketKey,
  context,
  view,
}: {
  phaseId?: string | null;
  bracketKey?: string | null;
  context: Ctx;
  /** Voor zeer grote brackets (≥128 teams): "r128-results" toont uitslagen-grid van de eerste ronde, "from-r64" toont de bracket startend bij ronde 2. */
  view?: "r128-results" | "from-r64";
}) => {
  const phase = context.phases.find(p => p.id === phaseId);
  if (!phase) return <EmptyBlock label="Geen bracket gekozen" />;

  // Alle groepen binnen de phase (zonder filter op category — die filter is al toegepast vóór context)
  const allPhaseGroups = context.groups.filter(g => g.phase_id === phase.id);
  const phaseMatches = context.matches.filter(m => m.phase_id === phase.id);

  const cfg = (phase.match_config || {}) as any;
  const bracketGroupMap = (cfg.bracketGroupMap || {}) as Record<string, string>;
  const bracketNames = (cfg.bracketNames || {}) as Record<string, string>;
  const phaseMatchType = cfg.matchType || "single_leg";

  // Bepaal welke groepen tot de gekozen bracket behoren via detectie
  let scopedGroups = allPhaseGroups;
  let title = phase.phase_label || phase.name;
  let firstRoundMatches: any[] = [];
  let firstRoundName = "Eerste ronde";
  try {
    const struct = detectBracketStructure(allPhaseGroups, phaseMatches, bracketGroupMap, phaseMatchType);
    const key = bracketKey || "main";
    let bracketRounds: any[] = [];
    if (key === "main") {
      bracketRounds = struct.mainRounds;
      const ids = new Set(bracketRounds.map((r: any) => r.id));
      // Inclusief plaatsingsrondes onder hoofdbracket
      struct.placementRounds.forEach((r: any) => ids.add(r.id));
      scopedGroups = allPhaseGroups.filter(g => ids.has(g.id));
      title = bracketNames["main"] || "Hoofdbracket";
    } else {
      bracketRounds = struct.loserBrackets[key] || [];
      const pl = struct.loserPlacementRounds[key] || [];
      const ids = new Set([...bracketRounds, ...pl].map((r: any) => r.id));
      scopedGroups = allPhaseGroups.filter(g => ids.has(g.id));
      title = bracketNames[key] || `Bracket ${key}`;
    }
    if (bracketRounds.length > 0) {
      firstRoundMatches = bracketRounds[0].matches || [];
      firstRoundName = bracketRounds[0].name || firstRoundName;
    }
  } catch {
    // Bij detectie-fout val terug op alle groepen van de fase
  }

  if (scopedGroups.length === 0 || phaseMatches.length === 0) {
    return (
      <>
        <BlockHeader title={title} subtitle="Bracket" style={context.style} />
        <EmptyBlock label="Geen wedstrijden in deze bracket" />
      </>
    );
  }

  // ── View 1: R128-uitslagen als compact grid ──────────────────────
  if (view === "r128-results") {
    return (
      <>
        <BlockHeader title={title} subtitle={`Uitslagen ${firstRoundName}`} style={context.style} />
        <div className="relative flex-1 min-h-0 overflow-hidden p-4">
          <FirstRoundResultsGrid matches={firstRoundMatches} teams={context.teams} style={context.style} />
        </div>
      </>
    );
  }

  // ── View 2 of standaard: bracket-tree (eventueel skip 1e ronde) ──
  const skipFirstRounds = view === "from-r64" ? 1 : 0;
  const subtitle = view === "from-r64" ? "Bracket vanaf 1/32" : "Bracket";

  return (
    <>
      <BlockHeader title={title} subtitle={subtitle} style={context.style} />
      <div className="relative flex-1 min-h-0 overflow-hidden">
        <BracketAutoFit>
          <PublicBracketSection
            groups={scopedGroups}
            labelGroups={allPhaseGroups}
            matches={phaseMatches}
            teams={context.teams}
            slots={context.slots}
            tournament={context.tournament}
            phases={context.phases}
            showAllOnly
            hideSectionDividers
            presentationCompact
            skipFirstRounds={skipFirstRounds}
          />
        </BracketAutoFit>
      </div>
    </>
  );
};

/**
 * Lijst-weergave van eerste-ronde-uitslagen voor zeer grote brackets (R128).
 * Layout: 4 kolommen × 16 rijen per kolom (64 wedstrijden). Elke rij is een
 * lijstregel met links de thuisploeg, midden de score/tijd, rechts de uitploeg —
 * vergelijkbaar met het schema-overzicht in de publieke view.
 */
const FirstRoundResultsGrid = ({ matches, teams, style }: { matches: any[]; teams: any[]; style: BroadcastStyle }) => {
  if (matches.length === 0) {
    return <EmptyBlock label="Geen wedstrijden in deze ronde" />;
  }
  const cardCls = ds(style, "card") || "rounded-md border border-border bg-card";

  const COLUMNS = 4;
  const total = matches.length;
  const rowsPerCol = Math.max(1, Math.ceil(total / COLUMNS));
  const half = Math.ceil(total / 2);

  // Splits in 4 kolommen: kolom 1-2 = bovenste helft, kolom 3-4 = onderste helft.
  // Binnen elke helft top-down volgorde behouden.
  const columns: any[][] = [];
  const leftMatches = matches.slice(0, half);
  const rightMatches = matches.slice(half);
  const splitInTwo = (arr: any[]) => {
    const mid = Math.ceil(arr.length / 2);
    return [arr.slice(0, mid), arr.slice(mid)];
  };
  const [c1, c2] = splitInTwo(leftMatches);
  const [c3, c4] = splitInTwo(rightMatches);
  columns.push(c1, c2, c3, c4);

  const renderRow = (m: any, matchNum: number) => {
    const homeTeam = teams.find(t => t.id === m.home_team_id);
    const awayTeam = teams.find(t => t.id === m.away_team_id);
    const isPlayed = m.is_played;
    const homeScore = m.home_score ?? "–";
    const awayScore = m.away_score ?? "–";
    const homeWins = isPlayed && (m.home_score ?? 0) > (m.away_score ?? 0);
    const awayWins = isPlayed && (m.away_score ?? 0) > (m.home_score ?? 0);
    const matchLabel = m.match_name || m.name || `Wedstrijd ${matchNum}`;
    const matchTime = m.match_time ? String(m.match_time).slice(0, 5) : null;

    return (
      <div
        key={m.id}
        className="flex-1 min-h-0 flex flex-col justify-center px-3 py-1 border-b border-border/40 last:border-b-0"
      >
        {/* Wedstrijdnaam (geen uur, geen M-nummer) */}
        <div className="flex items-center justify-center mb-0.5">
          <span className="text-[9px] font-bold text-muted-foreground/80 uppercase tracking-wide truncate">
            {matchLabel}
          </span>
        </div>
        {/* Teams + score/uur */}
        <div className="flex items-center gap-1.5">
          {/* Home: naam + logo (rechts uitgelijnd) */}
          <div className="flex-1 flex items-center justify-end gap-1.5 min-w-0">
            <span className={`truncate text-[12px] leading-tight text-right ${homeWins ? "font-bold text-foreground" : "font-medium text-foreground/85"}`}>
              {homeTeam?.name || "–"}
            </span>
            {homeTeam?.logo_url ? (
              <img src={homeTeam.logo_url} className="h-6 w-6 object-contain shrink-0" alt="" />
            ) : (
              <span className="h-6 w-6 shrink-0" />
            )}
          </div>
          {/* Score (gespeeld) of uur/vs (niet gespeeld) */}
          <div className="shrink-0 px-2 py-0.5 rounded-md bg-primary/10 text-primary text-[12px] font-bold tabular-nums min-w-[2.75rem] text-center">
            {isPlayed ? `${homeScore}-${awayScore}` : (matchTime || "vs")}
          </div>
          {/* Away: logo + naam (links uitgelijnd) */}
          <div className="flex-1 flex items-center gap-1.5 min-w-0">
            {awayTeam?.logo_url ? (
              <img src={awayTeam.logo_url} className="h-6 w-6 object-contain shrink-0" alt="" />
            ) : (
              <span className="h-6 w-6 shrink-0" />
            )}
            <span className={`truncate text-[12px] leading-tight ${awayWins ? "font-bold text-foreground" : "font-medium text-foreground/85"}`}>
              {awayTeam?.name || "–"}
            </span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="h-full w-full overflow-hidden">
      <div
        className="grid h-full w-full gap-3"
        style={{ gridTemplateColumns: `repeat(${COLUMNS}, minmax(0, 1fr))` }}
      >
        {columns.map((col, colIdx) => {
          // Bepaal het matchnummer-offset per kolom op basis van originele volgorde.
          const offsetBase = colIdx < 2
            ? (colIdx === 0 ? 0 : c1.length)
            : half + (colIdx === 2 ? 0 : c3.length);
          return (
            <div
              key={colIdx}
              className={`${cardCls} flex flex-col h-full min-h-0 overflow-hidden`}
            >
              {col.map((m, rowIdx) => renderRow(m, offsetBase + rowIdx + 1))}
            </div>
          );
        })}
      </div>
    </div>
  );
};

/**
 * Schaalt de bracket-inhoud automatisch zodat deze volledig past binnen de beschikbare ruimte.
 * Meet de natuurlijke grootte van de inhoud en past een CSS transform: scale() toe.
 */
const BracketAutoFit = ({ children }: { children: React.ReactNode }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const timersRef = useRef<number[]>([]);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const recompute = () => {
      const c = containerRef.current;
      const inner = contentRef.current;
      if (!c || !inner) return;
      inner.style.width = "max-content";
      const styles = getComputedStyle(c);
      const px = parseFloat(styles.paddingLeft) + parseFloat(styles.paddingRight);
      const py = parseFloat(styles.paddingTop) + parseFloat(styles.paddingBottom);
      const rect = c.getBoundingClientRect();
      const cw = Math.floor(rect.width - px);
      const ch = Math.floor(rect.height - py);
      const iw = Math.ceil(Math.max(inner.scrollWidth, inner.offsetWidth));
      const ih = Math.ceil(Math.max(inner.scrollHeight, inner.offsetHeight));
      if (cw <= 0 || ch <= 0 || iw === 0 || ih === 0) return;
      const s = Math.min(cw / iw, ch / ih, 1) * 0.98;
      setScale(Math.max(0.05, s));
    };

    const scheduleRecompute = () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = requestAnimationFrame(() => {
          rafRef.current = null;
          recompute();
        });
      });
    };

    const runAfterViewportSettles = () => {
      recompute();
      scheduleRecompute();
      timersRef.current.forEach(window.clearTimeout);
      timersRef.current = [80, 180, 350, 700, 1100].map(delay => window.setTimeout(scheduleRecompute, delay));
    };
    runAfterViewportSettles();
    const ro = new ResizeObserver(scheduleRecompute);
    if (containerRef.current) ro.observe(containerRef.current);
    if (contentRef.current) ro.observe(contentRef.current);
    window.addEventListener("resize", runAfterViewportSettles);
    document.addEventListener("fullscreenchange", runAfterViewportSettles);
    document.addEventListener("webkitfullscreenchange", runAfterViewportSettles);
    screen.orientation?.addEventListener?.("change", runAfterViewportSettles);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", runAfterViewportSettles);
      document.removeEventListener("fullscreenchange", runAfterViewportSettles);
      document.removeEventListener("webkitfullscreenchange", runAfterViewportSettles);
      screen.orientation?.removeEventListener?.("change", runAfterViewportSettles);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      timersRef.current.forEach(window.clearTimeout);
    };
  }, [children]);

  return (
    <div ref={containerRef} className="absolute inset-0 min-h-0 overflow-hidden p-2 flex items-center justify-center">
      <style>{`
        .slideshow-bracket-fit .overflow-x-auto {
          overflow: visible !important;
          padding-bottom: 0 !important;
        }
      `}</style>
      <div
        ref={contentRef}
        className="slideshow-bracket-fit"
        style={{
          transform: `scale(${scale})`,
          transformOrigin: "center center",
          width: "max-content",
          maxWidth: "none",
        }}
      >
        {children}
      </div>
    </div>
  );
};

const UPCOMING_LIMIT = 24;
const RECENT_LIMIT = 24;

const UpcomingBlock = ({ context }: { context: Ctx }) => {
  const all = context.matches.filter(m => !m.is_played);
  const sorted = [...all].sort((a, b) => {
    const da = `${a.match_date ?? ""} ${a.match_time ?? ""}`;
    const db = `${b.match_date ?? ""} ${b.match_time ?? ""}`;
    return da.localeCompare(db);
  });
  const list = sorted.slice(0, UPCOMING_LIMIT);
  return (
    <>
      <BlockHeader
        title="Aankomende wedstrijden"
        count={`${list.length}/${all.length}`}
        style={context.style}
      />
      <div className="flex-1 min-h-0 overflow-hidden"><ScheduleList matches={list} context={context} /></div>
    </>
  );
};

const RecentResultsBlock = ({ context }: { context: Ctx }) => {
  const all = context.matches.filter(m => m.is_played);
  const sorted = [...all].sort((a, b) => {
    const da = `${a.match_date ?? ""} ${a.match_time ?? ""}`;
    const db = `${b.match_date ?? ""} ${b.match_time ?? ""}`;
    return db.localeCompare(da);
  });
  const list = sorted.slice(0, RECENT_LIMIT);
  return (
    <>
      <BlockHeader
        title="Laatste resultaten"
        count={`${list.length}/${all.length}`}
        style={context.style}
      />
      <div className="flex-1 min-h-0 overflow-hidden"><ScheduleList matches={list} context={context} /></div>
    </>
  );
};

const StatRankingBlock = ({ type, title, context }: { type: "goal" | "assist"; title: string; context: Ctx }) => {
  // group stats by player
  const tally = new Map<string, { name: string; team_id: string; count: number }>();
  context.stats
    .filter(s =>
      s.stat_type === type &&
      s.player_name &&
      s.player_name !== "Onbekend" &&
      s.player_name !== "Eigen doelpunt"
    )
    .forEach(s => {
      const key = `${s.team_id}|${s.player_name}`;
      const cur = tally.get(key) || { name: s.player_name, team_id: s.team_id, count: 0 };
      cur.count++;
      tally.set(key, cur);
    });
  const list = [...tally.values()].sort((a, b) => b.count - a.count).slice(0, 12);
  const ptsCls = ds(context.style, "ptsBadge") || "font-bold text-primary";
  return (
    <>
      <BlockHeader title={title} style={context.style} />
      <div className="flex-1 overflow-auto">
        {list.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground italic">Nog geen data</p>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {list.map((r, i) => (
                <tr key={i} className={`border-t border-border ${i % 2 === 1 ? ds(context.style, "tableRowAlt") : ""}`}>
                  <td className="px-3 py-2 w-8 text-muted-foreground font-bold">{i + 1}</td>
                  <td className="px-3 py-2 font-semibold">{r.name}</td>
                  <td className="px-3 py-2 text-muted-foreground text-xs">{teamNameOf(context.teams, r.team_id)}</td>
                  <td className="px-3 py-2 text-right"><span className={ptsCls}>{r.count}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
};

const FairplayBlock = ({ context }: { context: Ctx }) => {
  // Per team: yellow=1, red=3
  const tally = new Map<string, { team_id: string; yellow: number; red: number; pts: number }>();
  context.stats.forEach(s => {
    if (s.stat_type !== "yellow_card" && s.stat_type !== "red_card") return;
    const cur = tally.get(s.team_id) || { team_id: s.team_id, yellow: 0, red: 0, pts: 0 };
    if (s.stat_type === "yellow_card") cur.yellow++;
    if (s.stat_type === "red_card") cur.red++;
    cur.pts = cur.yellow + cur.red * 3;
    tally.set(s.team_id, cur);
  });
  const list = [...tally.values()].sort((a, b) => a.pts - b.pts).slice(0, 12);
  const headerCls = ds(context.style, "tableHeader") || "bg-secondary text-muted-foreground text-[11px] uppercase";
  const ptsCls = ds(context.style, "ptsBadge") || "font-bold text-primary";
  return (
    <>
      <BlockHeader title="Fairplay" style={context.style} />
      <div className="flex-1 overflow-auto">
        {list.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground italic">Nog geen data</p>
        ) : (
          <table className="w-full text-sm">
            <thead className={headerCls}>
              <tr>
                <th className="px-3 py-2 text-left w-8">#</th>
                <th className="px-3 py-2 text-left">Team</th>
                <th className="px-2 py-2 text-center w-12 text-yellow-600">Geel</th>
                <th className="px-2 py-2 text-center w-12 text-red-600">Rood</th>
                <th className="px-2 py-2 text-center w-12">Pt</th>
              </tr>
            </thead>
            <tbody>
              {list.map((r, i) => (
                <tr key={r.team_id} className={`border-t border-border ${i % 2 === 1 ? ds(context.style, "tableRowAlt") : ""}`}>
                  <td className="px-3 py-2 font-bold text-muted-foreground">{i + 1}</td>
                  <td className="px-3 py-2 font-semibold">{teamNameOf(context.teams, r.team_id)}</td>
                  <td className="px-2 py-2 text-center">{r.yellow}</td>
                  <td className="px-2 py-2 text-center">{r.red}</td>
                  <td className="px-2 py-2 text-center"><span className={ptsCls}>{r.pts}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
};

const EmptyBlock = ({ label }: { label: string }) => (
  <div className="p-8 text-center text-muted-foreground italic text-sm flex-1 flex items-center justify-center">
    {label}
  </div>
);

export default TournamentSlideshow;
