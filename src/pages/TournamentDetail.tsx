import { useState, useEffect, useMemo } from "react";
import { loadFieldLocations } from "@/lib/fieldLocations";
import { useParams, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import ThemeSwitcher from "@/components/ThemeSwitcher";
import { Settings, Tv2, BarChart3, Handshake, PanelLeftClose, PanelLeftOpen, ArrowLeft, ChevronRight, Users, Plus } from "lucide-react";
import { GiWhistle } from "react-icons/gi";
import BracketTreeIcon from "@/components/icons/BracketTreeIcon";
import ScoreboardIcon from "@/components/icons/ScoreboardIcon";
import CalendarClockIcon from "@/components/icons/CalendarClockIcon";
import ShirtIcon from "@/components/icons/ShirtIcon";
import PollIcon from "@/components/icons/PollIcon";
import TournamentGeneral from "@/components/TournamentGeneral";
import TeamManager from "@/components/TeamManager";
import PhaseManager from "@/components/PhaseManager";
import { PhaseStripNav, type PhaseHeaderState } from "@/components/PhaseStripNav";
import MatchScheduler, { getTournamentPlannerDates, plannerDateStorageKey, DateStripNav } from "@/components/MatchScheduler";
import { getMiddleDate } from "@/lib/dateUtils";
import ResultsManager from "@/components/ResultsManager";

import PresentationManager from "@/components/PresentationManager";
import RefereeManager from "@/components/RefereeManager";
import CategorySelector from "@/components/CategorySelector";
import LocationSelector from "@/components/LocationSelector";
import StatisticsView from "@/components/StatisticsView";
import SponsorManager from "@/components/SponsorManager";
import PollManager from "@/components/PollManager";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import { useToast } from "@/hooks/use-toast";


const sidebarItems = [

  { id: "general", icon: Settings, label: "Algemeen", title: "Toernooi-instellingen", desc: "Naam, logo, speeldagen, locaties en puntentelling" },
  { id: "teams", icon: ShirtIcon, label: "Deelnemers", title: "Deelnemerslijst", desc: "Teams, spelers en scheidsrechters beheren" },
  { id: "phases", icon: BracketTreeIcon, label: "Format", title: "Toernooiopbouw", desc: "Fases, groepen en knock-outschema's" },
  { id: "schedule", icon: CalendarClockIcon, label: "Schema", title: "Speelschema", desc: "Wedstrijden verdelen over velden en tijdsloten" },
  { id: "results", icon: ScoreboardIcon, label: "Resultaten", title: "Uitslagen & statistieken", desc: "Scores invullen, standen en cijfers" },
  { id: "presentation", icon: Tv2, label: "Presentatie", title: "Publieke weergave", desc: "Website, sponsors, polls en vormgeving" },
] as const;

const resultsSubTabs = [
  { id: "results", label: "Uitslagen", icon: ScoreboardIcon },
  { id: "statistics", label: "Statistieken", icon: BarChart3 },
] as const;

const presentationSubTabs = [
  { id: "presentation", label: "Weergave", icon: Tv2 },
  { id: "sponsors", label: "Sponsors", icon: Handshake },
  { id: "polls", label: "Polls", icon: PollIcon },
] as const;

type TabId = typeof sidebarItems[number]["id"];
type ResultsSubTab = typeof resultsSubTabs[number]["id"];
type PresentationSubTab = typeof presentationSubTabs[number]["id"];
type GeneralSubTab = "overview" | "info" | "wedstrijddagen" | "locaties" | "divisies" | "puntentelling";

const generalSubTabs = [
  { id: "info", label: "Toernooi informatie" },
  { id: "wedstrijddagen", label: "Wedstrijddagen" },
  { id: "locaties", label: "Locaties" },
  { id: "divisies", label: "Divisies" },
  { id: "puntentelling", label: "Puntensysteem" },
] as const;


const categoryStorageKey = (tournamentId: string) => `tournament-category:${tournamentId}`;
const locationStorageKey = (tournamentId: string) => `tournament-location:${tournamentId}`;
const mobileSidebarStorageKey = "admin-mobile-sidebar-collapsed";

const TournamentDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const { toast } = useToast();
  const [phaseHeader, setPhaseHeader] = useState<PhaseHeaderState | null>(null);

  const [tournament, setTournament] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedCategoryId, setSelectedCategoryIdState] = useState<string | null>(() => {
    if (typeof window === "undefined" || !id) return null;
    return localStorage.getItem(categoryStorageKey(id));
  });
  const [activeTab, setActiveTab] = useState<TabId>("general");
  const [generalSubTab, setGeneralSubTab] = useState<GeneralSubTab>(() => {
    if (typeof window === "undefined") return "info";
    return window.matchMedia("(max-width: 639px)").matches ? "overview" : "info";
  });
  const [deelnemersSubTab, setDeelnemersSubTab] = useState<"teams" | "referees">("teams");
  const [resultsSubTab, setResultsSubTab] = useState<ResultsSubTab>("results");
  const [presentationSubTab, setPresentationSubTab] = useState<PresentationSubTab>("presentation");

  const [plannerDate, setPlannerDate] = useState<string>(() => {
    if (typeof window === "undefined" || !id) return "";
    return localStorage.getItem(plannerDateStorageKey(id, selectedCategoryId)) || "";
  });

  const subTabBar = (
    items: readonly { id: string; label: string; icon: any }[],
    active: string,
    onSelect: (id: any) => void,
  ) => (
    <div className="flex flex-wrap items-center gap-1 border-b border-border px-1 pb-0">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onSelect(item.id)}
          className={cn(
            "relative flex items-center gap-2 rounded-t-lg px-3 py-2.5 text-xs sm:text-sm font-semibold uppercase tracking-wide text-muted-foreground transition-colors hover:text-foreground",
            active === item.id
              ? "text-foreground after:absolute after:bottom-0 after:left-2 after:right-2 after:h-[2px] after:rounded-full after:bg-primary"
              : ""
          )}
        >
          <item.icon className="h-4 w-4 shrink-0" />
          {item.label}
        </button>
      ))}
    </div>
  );

  const [mobileDeelnemersOverview, setMobileDeelnemersOverview] = useState(true);
  const [teamDetailOpen, setTeamDetailOpen] = useState(false);
  const [selectedLocation, setSelectedLocationState] = useState<string | null>(() => {
    if (typeof window === "undefined" || !id) return null;
    return localStorage.getItem(locationStorageKey(id));
  });
  const [mobileSidebarCollapsed, setMobileSidebarCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return sessionStorage.getItem(mobileSidebarStorageKey) === "true";
  });
  const [desktopNavCollapsed, setDesktopNavCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return sessionStorage.getItem("admin-desktop-nav-collapsed") === "true";
  });

  const toggleDesktopNav = () => {
    setDesktopNavCollapsed((collapsed) => {
      const next = !collapsed;
      sessionStorage.setItem("admin-desktop-nav-collapsed", String(next));
      return next;
    });
  };


  const toggleMobileSidebar = () => {
    setMobileSidebarCollapsed((collapsed) => {
      const next = !collapsed;
      sessionStorage.setItem(mobileSidebarStorageKey, String(next));
      return next;
    });
  };

  // Persist location selection per tournament
  const setSelectedLocation = (location: string | null) => {
    setSelectedLocationState(location);
    if (typeof window !== "undefined" && id) {
      if (location) localStorage.setItem(locationStorageKey(id), location);
      else localStorage.removeItem(locationStorageKey(id));
    }
  };

  // Persist category selection per tournament
  const setSelectedCategoryId = (categoryId: string | null) => {
    setSelectedCategoryIdState(categoryId);
    if (typeof window !== "undefined" && id) {
      if (categoryId) localStorage.setItem(categoryStorageKey(id), categoryId);
      else localStorage.removeItem(categoryStorageKey(id));
    }
  };

  const goToRefereesTab = () => {
    setActiveTab("teams");
    setDeelnemersSubTab("referees");
    setMobileDeelnemersOverview(false);
  };

  const handlePlannerDateChange = (date: string) => {
    setPlannerDate(date);
    if (typeof window !== "undefined" && id) {
      localStorage.setItem(plannerDateStorageKey(id, selectedCategoryId), date);
    }
  };

  // When tournament id changes, hydrate from localStorage
  useEffect(() => {
    if (!id) return;
    const stored = localStorage.getItem(categoryStorageKey(id));
    setSelectedCategoryIdState(stored);
  }, [id]);

  useEffect(() => {
    if (!id) return;
    const stored = localStorage.getItem(locationStorageKey(id));
    setSelectedLocationState(stored);
  }, [id]);

  // Keep plannerDate storage key in sync with selected category and default to the middle tournament day
  useEffect(() => {
    if (!id || !tournament) return;
    const allDays = getTournamentPlannerDates(tournament);
    const key = plannerDateStorageKey(id, selectedCategoryId);
    const stored = localStorage.getItem(key);
    const valid = stored && allDays.includes(stored) ? stored : getMiddleDate(allDays);
    setPlannerDate((current) => (current !== valid ? valid : current));
  }, [id, tournament, selectedCategoryId]);


  // For single-category tournaments, auto-select the lone category
  // For multi-category tournaments, validate / pick the first
  useEffect(() => {
    if (!id || !tournament) return;

    let cancelled = false;

    supabase
      .from("tournament_categories")
      .select("id")
      .eq("tournament_id", id)
      .order("sort_order")
      .then(({ data, error }) => {
        if (cancelled || error || !data) return;
        const validIds = data.map((c) => c.id);

        if (!tournament.is_multi_category) {
          // Single category: always use the first (and only) category
          const first = validIds[0] ?? null;
          if (first && selectedCategoryId !== first) setSelectedCategoryId(first);
        } else {
          // Multi category: validate current selection
          if (!selectedCategoryId || !validIds.includes(selectedCategoryId)) {
            const first = validIds[0] ?? null;
            if (first) setSelectedCategoryId(first);
          }
        }
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, tournament?.is_multi_category, selectedCategoryId]);

  useEffect(() => { if (id) fetchTournament(); }, [id]);

  const tournamentDates = useMemo(() => {
    if (!tournament) return [];
    return getTournamentPlannerDates(tournament);
  }, [tournament]);

  const fetchTournament = async () => {
    const { data } = await supabase.from("tournaments").select("*").eq("id", id!).single();
    setTournament(data);
    if (id) void loadFieldLocations(id);
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex justify-center py-16"><div className="h-8 w-8 animate-spin rounded-full border-2 border-foreground border-t-transparent" /></div>
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="px-4 sm:px-6 py-16 text-center">
          <h1 className="font-display text-2xl font-bold text-foreground">Toernooi niet gevonden</h1>
          <Link to="/dashboard" className="mt-4 text-muted-foreground hover:text-foreground hover:underline">Terug naar dashboard</Link>
        </div>
      </div>
    );
  }

  const categorySelector = (
    <CategorySelector
      tournamentId={id!}
      isMultiCategory={tournament.is_multi_category}
      selectedCategoryId={selectedCategoryId}
      onSelect={setSelectedCategoryId}
      className="mb-4"
    />
  );

  const effectiveCategoryId = selectedCategoryId;

  const renderContent = () => {
    switch (activeTab) {
      case "general":
        return (
          <TournamentGeneral
            tournament={tournament}
            onUpdate={t => setTournament(t)}
            generalSubTab={generalSubTab}
            onGeneralSubTabChange={setGeneralSubTab}
          />
        );
      case "teams":
        return (
          <>
            {isMobile && categorySelector}
            {(!tournament.is_multi_category || effectiveCategoryId) && (
              <>
                {isMobile ? (
                  mobileDeelnemersOverview ? (
                    <div className="grid grid-cols-1 gap-2">
                      {([
                        { id: "teams" as const, label: tournament.teams_label || "Teams", icon: Users },
                        { id: "referees" as const, label: tournament.referees_label || "Scheidsrechters", icon: GiWhistle },
                      ]).map((card) => {
                        const Icon = card.icon;
                        return (
                          <button
                            key={card.id}
                            onClick={() => { setDeelnemersSubTab(card.id); setMobileDeelnemersOverview(false); }}
                            className="group flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-3 text-left transition-colors hover:border-primary/50 hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
                          >
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                              <Icon className="h-4 w-4" />
                            </div>
                            <span className="min-w-0 flex-1 font-display text-sm font-semibold text-foreground">{card.label}</span>
                            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                          </button>
                        );
                      })}
                    </div>
                  ) : teamDetailOpen ? null : (
                    <div className="flex items-center gap-3 mb-3">
                      <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setMobileDeelnemersOverview(true)} aria-label="Terug naar overzicht">
                        <ArrowLeft className="h-4 w-4" />
                      </Button>
                      <h2 className="font-display text-lg font-bold text-foreground">
                        {deelnemersSubTab === "teams" ? (tournament.teams_label || "Teams") : (tournament.referees_label || "Scheidsrechters")}
                      </h2>
                    </div>
                  )
                ) : (
                null
                )}
                {(!isMobile || !mobileDeelnemersOverview) && deelnemersSubTab === "teams" && (
                  <TeamManager tournamentId={id!} teamCount={tournament.team_count} showCountry={tournament.show_country} categoryId={effectiveCategoryId} teamsLabel={tournament.teams_label || "Teams"} onDetailOpenChange={setTeamDetailOpen} />
                )}
                {(!isMobile || !mobileDeelnemersOverview) && deelnemersSubTab === "referees" && (
                  <RefereeManager tournamentId={id!} categoryId={effectiveCategoryId} />
                )}
              </>
            )}
          </>
        );
      case "phases":
        return (
          <>
            {isMobile && categorySelector}
            {(!tournament.is_multi_category || effectiveCategoryId) && (
              <PhaseManager
                key={`phases-${id}-${effectiveCategoryId ?? "all"}`}
                tournamentId={id!}
                tournamentType={tournament.tournament_type}
                categoryId={effectiveCategoryId}
                onHeaderStateChange={isMobile ? undefined : setPhaseHeader}
              />
            )}
          </>
        );
      case "schedule": {
        const compactSelect = "h-7 w-auto min-w-fit rounded-md px-2 text-xs";
        const scheduleSelectors = (
          <>
            {isMobile && (
              <CategorySelector
                tournamentId={id!}
                isMultiCategory={tournament.is_multi_category}
                selectedCategoryId={selectedCategoryId}
                onSelect={setSelectedCategoryId}
                selectClassName={compactSelect}
              />
            )}
            {isMobile && (
              <LocationSelector
                tournamentId={id!}
                selectedLocation={selectedLocation}
                onSelect={setSelectedLocation}
                selectClassName={compactSelect}
              />
            )}
          </>
        );
        const showScheduler = !tournament.is_multi_category || !!effectiveCategoryId;
        return showScheduler ? (
          <MatchScheduler
            tournamentId={id!}
            tournament={tournament}
            categoryId={effectiveCategoryId}
            selectedLocation={selectedLocation}
            onLocationChange={setSelectedLocation}
            onManageReferees={goToRefereesTab}
            toolbarLeft={scheduleSelectors}
            plannerDate={plannerDate}
            onPlannerDateChange={handlePlannerDateChange}
          />
        ) : (
          <div className="flex flex-wrap items-center gap-3 mb-4">{scheduleSelectors}</div>
        );
      }
      case "results":
        return (
          <>
            {isMobile && subTabBar(resultsSubTabs, resultsSubTab, setResultsSubTab)}
            {isMobile && categorySelector}
            {(!tournament.is_multi_category || effectiveCategoryId) && (
              resultsSubTab === "results" ? (
                <ResultsManager tournamentId={id!} tournament={tournament} categoryId={effectiveCategoryId} />
              ) : (
                <StatisticsView tournamentId={id!} tournament={tournament} categoryId={effectiveCategoryId} />
              )
            )}
          </>
        );
      case "presentation":
        return (
          <>
            {isMobile && subTabBar(presentationSubTabs, presentationSubTab, setPresentationSubTab)}
            {presentationSubTab === "presentation" && (
              <PresentationManager tournament={tournament} onUpdate={t => setTournament(t)} />
            )}
            {presentationSubTab === "sponsors" && <SponsorManager tournamentId={id!} />}
            {presentationSubTab === "polls" && <PollManager tournamentId={id!} tournament={tournament} />}
          </>
        );

      default:
        return null;
    }
  };

  const desktopSegments: { items: readonly { id: string; label: string; icon?: any }[]; active: string; onSelect: (id: any) => void } | null =
    activeTab === "general"
      ? { items: generalSubTabs, active: generalSubTab, onSelect: setGeneralSubTab }
      : activeTab === "teams"
      ? {
          items: [
            { id: "teams", label: tournament.teams_label || "Teams" },
            { id: "referees", label: tournament.referees_label || "Scheidsrechters" },
          ],
          active: deelnemersSubTab,
          onSelect: setDeelnemersSubTab,
        }
      : activeTab === "results"
      ? { items: resultsSubTabs, active: resultsSubTab, onSelect: setResultsSubTab }
      : activeTab === "presentation"
      ? { items: presentationSubTabs, active: presentationSubTab, onSelect: setPresentationSubTab }
      : null;

  return (
    <div
      className="h-dvh min-h-0 bg-background flex flex-col overflow-hidden"
    >


      <Navbar tournamentName={tournament?.name} hideTournamentNameOnMobile />
      <ThemeSwitcher />
      {isMobile && (
        <div className="flex h-9 shrink-0 items-center gap-2 border-b border-border bg-card px-2 print:hidden">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={toggleMobileSidebar}
            className="h-7 w-7 shrink-0"
            aria-label={mobileSidebarCollapsed ? "Navigatie openen" : "Navigatie sluiten"}
            title={mobileSidebarCollapsed ? "Navigatie openen" : "Navigatie sluiten"}
          >
            {mobileSidebarCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </Button>
          <span className="min-w-0 flex-1 truncate text-xs font-semibold text-foreground">
            {sidebarItems.find((item) => item.id === activeTab)?.label}
          </span>
          <div className="flex items-center justify-end gap-1.5 min-w-0 max-w-[55%]">
            <span className="truncate text-right text-xs font-bold text-foreground" title={tournament.name}>
              {tournament.name}
            </span>
            {tournament.logo_url && (
              <img src={tournament.logo_url} alt="" className="h-4 w-4 shrink-0 object-contain" />
            )}
          </div>
        </div>
      )}
      <div className="relative flex flex-1 overflow-hidden min-h-0">
        {/* Desktop: left navigation column */}
        {!isMobile && (
          <TooltipProvider delayDuration={300}>
            <nav
              aria-label="Toernooibeheer"
              className={cn(
                "shrink-0 self-stretch flex flex-col min-h-0 border-r border-border bg-card print:hidden transition-[width] duration-200",
                desktopNavCollapsed ? "w-[68px]" : "w-60"
              )}
            >
              <div className="flex h-14 shrink-0 items-center gap-2.5 border-b border-border px-3">
                {tournament.logo_url ? (
                  <img src={tournament.logo_url} alt="" className="h-8 w-8 shrink-0 object-contain" />
                ) : (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 font-display text-sm font-bold text-primary">
                    {tournament.name?.charAt(0)?.toUpperCase()}
                  </div>
                )}
                {!desktopNavCollapsed && (
                  <span className="min-w-0 flex-1 truncate font-display text-sm font-bold uppercase tracking-wide text-foreground" title={tournament.name}>
                    {tournament.name}
                  </span>
                )}
              </div>

              <div className="min-h-0 flex-1 space-y-1 overflow-y-auto px-2 py-3">
                {sidebarItems.map((item) => {
                  const active = activeTab === item.id;
                  return (
                    <Tooltip key={item.id}>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={() => setActiveTab(item.id)}
                          aria-current={active ? "page" : undefined}
                          className={cn(
                            "group relative flex w-full items-center gap-3 rounded-lg px-2.5 py-2.5 text-sm font-semibold transition-colors",
                            desktopNavCollapsed && "justify-center px-0",
                            active
                              ? "bg-primary/10 text-primary"
                              : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                          )}
                        >
                          {active && !desktopNavCollapsed && (
                            <span className="absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-full bg-primary" />
                          )}
                          <item.icon className="h-[18px] w-[18px] shrink-0" />
                          {!desktopNavCollapsed && <span className="truncate">{item.label}</span>}
                        </button>
                      </TooltipTrigger>
                      {desktopNavCollapsed && (
                        <TooltipContent side="right" className="text-xs">{item.label}</TooltipContent>
                      )}
                    </Tooltip>
                  );
                })}
              </div>

              <div className="shrink-0 border-t border-border p-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={toggleDesktopNav}
                  className={cn(
                    "w-full justify-start gap-3 px-2.5 text-xs font-semibold text-muted-foreground",
                    desktopNavCollapsed && "justify-center px-0"
                  )}
                  aria-label={desktopNavCollapsed ? "Menu openen" : "Menu inklappen"}
                >
                  {desktopNavCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
                  {!desktopNavCollapsed && <span>Inklappen</span>}
                </Button>
              </div>
            </nav>
          </TooltipProvider>
        )}

        {/* Mobile: left icon sidebar */}
        {isMobile && (
          <TooltipProvider delayDuration={200}>
            <nav
              aria-label="Toernooibeheer"
              className={cn(
                "shrink-0 self-stretch bg-card flex flex-col py-2 gap-1 print:hidden min-h-0 overflow-hidden transition-[width,border-color] duration-200",
                mobileSidebarCollapsed
                  ? "relative w-0 border-r-0"
                  : "relative w-14 items-center border-r border-border"
              )}
            >
              <div className="min-h-0 w-full flex-1 overflow-y-auto scrollbar-none">
                {sidebarItems.map(item => (
                  <Tooltip key={item.id}>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => {
                          setActiveTab(item.id);
                        }}
                        aria-label={item.label}
                        aria-current={activeTab === item.id ? "page" : undefined}
                        className={cn(
                          "shrink-0 rounded-md flex items-center transition-colors duration-150 overflow-hidden",
                          "mx-auto mb-1 h-11 w-11 justify-center p-0",
                          activeTab === item.id
                            ? "bg-primary text-primary-foreground shadow-sm"
                            : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                        )}
                      >
                        <item.icon className="h-[18px] w-[18px] shrink-0" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="text-xs">
                      {item.label}
                    </TooltipContent>
                  </Tooltip>
                ))}
              </div>
            </nav>
          </TooltipProvider>
        )}

        {/* Main content */}
        <div className="flex-1 min-w-0 overflow-auto min-h-0 flex flex-col">
          {!isMobile && (
            <header className="sticky top-0 z-20 shrink-0 border-b border-border bg-background/95 backdrop-blur print:hidden">
              <div className="mx-auto grid h-14 w-full max-w-[1920px] grid-cols-[minmax(220px,1fr)_auto_minmax(220px,1fr)] items-center gap-6 px-3 sm:px-6 lg:px-8">
                <div className="flex flex-col items-start gap-1 justify-self-start [&>*]:mb-0">
                  {categorySelector}
                  {activeTab === "schedule" && (
                    <LocationSelector
                      tournamentId={id!}
                      selectedLocation={selectedLocation}
                      onSelect={setSelectedLocation}
                      selectClassName="h-6 rounded-md px-1.5 text-[11px] font-medium leading-none"
                    />
                  )}
                </div>

                <div className="flex min-w-0 justify-center justify-self-center">
                  {activeTab === "phases" && phaseHeader && phaseHeader.phases.length > 0 ? (
                    <PhaseStripNav
                      phases={phaseHeader.phases}
                      activePhaseNumber={phaseHeader.activePhaseNumber}
                      onSelect={phaseHeader.onSelect}
                      onEdit={phaseHeader.onEdit}
                      onDelete={phaseHeader.onDelete}
                    />
                  ) : activeTab === "schedule" && tournamentDates.length > 0 ? (
                    <DateStripNav
                      dates={tournamentDates}
                      activeDate={plannerDate}
                      onSelect={handlePlannerDateChange}
                      maxVisible={3}
                      centerActive
                      onInvalidPick={(iso) => {
                        toast({
                          title: "Datum buiten toernooiperiode",
                          description: `${iso} valt niet binnen de ingestelde wedstrijddagen.`,
                          variant: "destructive",
                        });
                      }}
                    />
                  ) : (
                    desktopSegments && (
                      <div className="flex shrink-0 items-center gap-1">
                        {desktopSegments.items.map((seg) => {
                          const active = desktopSegments.active === seg.id;
                          return (
                            <button
                              key={seg.id}
                              type="button"
                              onClick={() => desktopSegments.onSelect(seg.id)}
                              className={cn(
                                "relative flex items-center gap-2 rounded-t-lg px-3 py-2.5 text-xs font-bold uppercase tracking-wide text-muted-foreground transition-colors hover:text-foreground",
                                active
                                  ? "text-foreground after:absolute after:bottom-0 after:left-2 after:right-2 after:h-[2px] after:rounded-full after:bg-primary"
                                  : ""
                              )}
                            >
                              {seg.icon && <seg.icon className="h-4 w-4 shrink-0" />}
                              <span className="truncate">{seg.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    )
                  )}
                </div>

                <div className="flex items-center justify-end gap-3">
                  {activeTab === "phases" && phaseHeader && (
                    <>
                      {phaseHeader.activePhaseNumber !== null && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={phaseHeader.onAddFormat}
                          title="Format toevoegen"
                          className="gap-1.5 border-primary/30 text-primary hover:bg-primary/10 hover:text-primary"
                        >
                          <Plus className="h-4 w-4" /> Format toevoegen
                        </Button>
                      )}
                      <Button size="sm" onClick={phaseHeader.onAdd} title="Fase toevoegen" className="gap-1.5">
                        <Plus className="h-4 w-4" /> Fase
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </header>
          )}
          <div className="w-full px-3 py-4 sm:mx-auto sm:max-w-[1920px] sm:px-6 sm:py-6 lg:px-8">
            <div className="flex flex-col gap-4">{renderContent()}</div>
          </div>
        </div>

      </div>

    </div>
  );
};

export default TournamentDetail;
