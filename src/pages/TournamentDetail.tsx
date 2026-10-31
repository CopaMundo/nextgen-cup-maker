import { useState, useEffect, useMemo, useRef } from "react";
import { AdminAppearanceContext } from "@/contexts/AdminAppearanceContext";
import { loadFieldLocations } from "@/lib/fieldLocations";
import { useParams, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import ThemeSwitcher from "@/components/ThemeSwitcher";
import { Settings, Tv2, PanelLeftClose, PanelLeftOpen, ArrowLeft, ChevronRight, Users, Plus, Globe, Palette, Handshake, BarChart3, MonitorPlay, ListChecks } from "lucide-react";
import { GiWhistle } from "react-icons/gi";
import BracketTreeIcon from "@/components/icons/BracketTreeIcon";
import ScoreboardIcon from "@/components/icons/ScoreboardIcon";
import CalendarClockIcon from "@/components/icons/CalendarClockIcon";
import ShirtIcon from "@/components/icons/ShirtIcon";
import TournamentGeneral from "@/components/TournamentGeneral";
import TeamManager from "@/components/TeamManager";
import PhaseManager from "@/components/PhaseManager";
import MatchScheduler, { getTournamentPlannerDates, plannerDateStorageKey } from "@/components/MatchScheduler";
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


const sidebarItems = [

  { id: "general", icon: Settings, label: "Algemeen", title: "Toernooi-instellingen", desc: "Naam, logo, speeldagen, locaties en puntentelling" },
  { id: "teams", icon: ShirtIcon, label: "Deelnemers", title: "Deelnemerslijst", desc: "Teams, spelers en scheidsrechters beheren" },
  { id: "phases", icon: BracketTreeIcon, label: "Indeling", title: "Toernooiopbouw", desc: "Fases, groepen en knock-outschema's" },
  { id: "schedule", icon: CalendarClockIcon, label: "Schema", title: "Speelschema", desc: "Wedstrijden verdelen over velden en tijdsloten" },
  { id: "results", icon: ScoreboardIcon, label: "Resultaten", title: "Uitslagen & statistieken", desc: "Scores invullen, standen en cijfers" },
  { id: "presentation", icon: Tv2, label: "Presentatie", title: "Publieke weergave", desc: "Website, sponsors, polls en vormgeving" },
] as const;

const resultsSubTabs = [
  { id: "results", label: "Uitslagen" },
  { id: "statistics", label: "Statistieken" },
] as const;

const presentationSubTabs = [
  { id: "website", label: "Website" },
  { id: "slideshow", label: "Dialoogvoorstelling" },
  { id: "visualization", label: "Vormgeving" },
  { id: "sponsors", label: "Sponsors" },
  { id: "polls", label: "Polls" },
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
const activeTabStorageKey = (tournamentId: string) => `tournament-admin-tab:${tournamentId}`;
const mobileSidebarStorageKey = "admin-mobile-sidebar-collapsed";

const TournamentDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const adminScrollRoot = useRef<HTMLDivElement>(null);

  const [tournament, setTournament] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedCategoryId, setSelectedCategoryIdState] = useState<string | null>(() => {
    if (typeof window === "undefined" || !id) return null;
    return localStorage.getItem(categoryStorageKey(id));
  });
  const [activeTab, setActiveTabState] = useState<TabId>(() => {
    if (typeof window === "undefined" || !id) return "general";
    const saved = localStorage.getItem(activeTabStorageKey(id));
    return sidebarItems.some((item) => item.id === saved) ? saved as TabId : "general";
  });
  const setActiveTab = (tab: TabId) => {
    setActiveTabState(tab);
    if (id) localStorage.setItem(activeTabStorageKey(id), tab);
    setMobileResultsOverview(true);
    setMobilePresentationOverview(true);
    setMobileDeelnemersOverview(true);
  };
  const [generalSubTab, setGeneralSubTab] = useState<GeneralSubTab>(() => {
    if (typeof window === "undefined") return "info";
    return window.matchMedia("(max-width: 639px)").matches ? "overview" : "info";
  });
  const [deelnemersSubTab, setDeelnemersSubTab] = useState<"teams" | "referees">("teams");
  const [resultsSubTab, setResultsSubTab] = useState<ResultsSubTab>("results");
  const [presentationSubTab, setPresentationSubTab] = useState<PresentationSubTab>("website");

  const [plannerDate, setPlannerDate] = useState<string>(() => {
    if (typeof window === "undefined" || !id) return "";
    return localStorage.getItem(plannerDateStorageKey(id, selectedCategoryId)) || "";
  });

  const subTabBar = (
    items: readonly { id: string; label: string; icon?: any }[],
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
          {item.icon && <item.icon className="h-4 w-4 shrink-0" />}
          {item.label}
        </button>
      ))}
    </div>
  );

  const [mobileDeelnemersOverview, setMobileDeelnemersOverview] = useState(true);
  const [mobileResultsOverview, setMobileResultsOverview] = useState(true);
  const [mobilePresentationOverview, setMobilePresentationOverview] = useState(true);

  const renderMobileOverview = (
    items: readonly { id: string; label: string; icon?: any }[],
    onPick: (id: any) => void,
  ) => (
    <div className="grid grid-cols-1 gap-2">
      {items.map((card) => (
        <button
          key={card.id}
          onClick={() => onPick(card.id)}
          className="group flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-3 text-left transition-colors hover:border-primary/50 hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
        >
          <span className="h-6 w-1 shrink-0 rounded-full bg-primary" aria-hidden="true" />
          <span className="min-w-0 flex-1 font-display text-sm font-semibold text-foreground">{card.label}</span>
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        </button>
      ))}
    </div>
  );

  const renderMobileBackHeader = (label: string, onBack: () => void) => (
    <div className="flex items-center gap-3 mb-3">
      <Button variant="outline" size="icon" className="h-8 w-8" onClick={onBack} aria-label="Terug naar overzicht">
        <ArrowLeft className="h-4 w-4" />
      </Button>
      <h2 className="font-display text-lg font-bold text-foreground">{label}</h2>
    </div>
  );
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


  const fetchTournament = async () => {
    const { data } = await supabase.from("tournaments").select("*").eq("id", id ?? "").single();
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
      tournamentId={id ?? ""}
      isMultiCategory={tournament.is_multi_category}
      selectedCategoryId={selectedCategoryId}
      onSelect={setSelectedCategoryId}
    />
  );

  const effectiveCategoryId = selectedCategoryId;

  const desktopCategorySelector = !isMobile && tournament.is_multi_category ? (
    <CategorySelector
      tournamentId={id ?? ""}
      isMultiCategory={tournament.is_multi_category}
      selectedCategoryId={selectedCategoryId}
      onSelect={setSelectedCategoryId}
      className="shrink-0"
      selectClassName="h-7 w-36 min-w-0 max-w-36 rounded-md px-2 text-xs"
    />
  ) : null;

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
                    renderMobileOverview(
                      [
                        { id: "teams" as const, label: tournament.teams_label || "Teams" },
                        { id: "referees" as const, label: tournament.referees_label || "Scheidsrechters" },
                      ],
                      (id) => { setDeelnemersSubTab(id); setMobileDeelnemersOverview(false); }
                    )
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
                {!isMobile && (
                  <div className="flex min-w-0 items-center justify-between gap-3">
                  <h2 className="section-title min-w-0 !mb-0">
                    {deelnemersSubTab === "teams"
                      ? (tournament.teams_label || "Teams")
                      : (tournament.referees_label || "Scheidsrechters")}
                  </h2>
                  {desktopCategorySelector}
                  </div>
                )}
                {!isMobile && (deelnemersSubTab === "teams" ? (
                  <TeamManager tournamentId={id ?? ""} teamCount={tournament.team_count} showCountry={tournament.show_country} categoryId={effectiveCategoryId} teamsLabel={tournament.teams_label || "Teams"} onDetailOpenChange={setTeamDetailOpen} />
                ) : (
                  <RefereeManager tournamentId={id ?? ""} categoryId={effectiveCategoryId} teamsLabel={tournament.teams_label || "Teams"} />
                ))}
                {isMobile && !mobileDeelnemersOverview && deelnemersSubTab === "teams" && (
                  <TeamManager tournamentId={id ?? ""} teamCount={tournament.team_count} showCountry={tournament.show_country} categoryId={effectiveCategoryId} teamsLabel={tournament.teams_label || "Teams"} onDetailOpenChange={setTeamDetailOpen} />
                )}
                {isMobile && !mobileDeelnemersOverview && deelnemersSubTab === "referees" && (
                  <RefereeManager tournamentId={id ?? ""} categoryId={effectiveCategoryId} teamsLabel={tournament.teams_label || "Teams"} />
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
                tournamentId={id ?? ""}
                tournamentType={tournament.tournament_type}
                categoryId={effectiveCategoryId}
                toolbarRight={desktopCategorySelector}
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
                tournamentId={id ?? ""}
                isMultiCategory={tournament.is_multi_category}
                selectedCategoryId={selectedCategoryId}
                onSelect={setSelectedCategoryId}
                selectClassName={compactSelect}
              />
            )}
            {(
              <LocationSelector
                tournamentId={id ?? ""}
                selectedLocation={selectedLocation}
                onSelect={setSelectedLocation}
                selectClassName={isMobile ? compactSelect : "h-7 min-w-[140px] rounded-md px-2 text-xs font-semibold"}
                showLabel={false}
              />
            )}
          </>
        );
        const showScheduler = !tournament.is_multi_category || !!effectiveCategoryId;
        return showScheduler ? (
          <MatchScheduler
            tournamentId={id ?? ""}
            tournament={tournament}
            categoryId={effectiveCategoryId}
            selectedLocation={selectedLocation}
            onLocationChange={setSelectedLocation}
            onManageReferees={goToRefereesTab}
            toolbarLeft={scheduleSelectors}
            plannerDate={plannerDate}
            onPlannerDateChange={handlePlannerDateChange}
            toolbarRight={desktopCategorySelector}
          />
        ) : (
          <div className="flex flex-wrap items-center gap-3 mb-4">{scheduleSelectors}</div>
        );
      }
      case "results": {
        const resultsItems = [
          { id: "results" as const, label: "Uitslagen", icon: ScoreboardIcon },
          { id: "statistics" as const, label: "Statistieken", icon: BarChart3 },
        ];
        if (isMobile && mobileResultsOverview) {
          return renderMobileOverview(resultsItems, (sid) => { setResultsSubTab(sid); setMobileResultsOverview(false); });
        }
        return (
          <>
            {isMobile && renderMobileBackHeader(
              resultsItems.find((i) => i.id === resultsSubTab)?.label ?? "",
              () => setMobileResultsOverview(true),
            )}
            {isMobile && categorySelector}
            {(!tournament.is_multi_category || effectiveCategoryId) && (
              resultsSubTab === "results" ? (
                <ResultsManager tournamentId={id ?? ""} tournament={tournament} categoryId={effectiveCategoryId} toolbarRight={desktopCategorySelector} />
              ) : (
                <div className="flex min-h-0 flex-1 flex-col gap-3">
                {!isMobile && <div className="flex justify-end">{desktopCategorySelector}</div>}
                <StatisticsView tournamentId={id ?? ""} tournament={tournament} categoryId={effectiveCategoryId} />
                </div>
              )
            )}
          </>
        );
      }
      case "presentation": {
        const presentationItems = [
          { id: "website" as const, label: "Website", icon: Globe },
          { id: "slideshow" as const, label: "Dialoogvoorstelling", icon: MonitorPlay },
          { id: "visualization" as const, label: "Vormgeving", icon: Palette },
          { id: "sponsors" as const, label: "Sponsors", icon: Handshake },
          { id: "polls" as const, label: "Polls", icon: ListChecks },
        ];
        if (isMobile && mobilePresentationOverview) {
          return renderMobileOverview(presentationItems, (sid) => { setPresentationSubTab(sid); setMobilePresentationOverview(false); });
        }
        return (
          <>
            {isMobile && renderMobileBackHeader(
              presentationItems.find((i) => i.id === presentationSubTab)?.label ?? "",
              () => setMobilePresentationOverview(true),
            )}
            {presentationSubTab === "website" && (
              <PresentationManager tournament={tournament} onUpdate={t => setTournament(t)} subTab="website" />
            )}
            {presentationSubTab === "slideshow" && (
              <PresentationManager tournament={tournament} onUpdate={t => setTournament(t)} subTab="slideshow" />
            )}
            {presentationSubTab === "visualization" && (
              <PresentationManager tournament={tournament} onUpdate={t => setTournament(t)} subTab="visualization" />
            )}
            {presentationSubTab === "sponsors" && <SponsorManager tournamentId={id ?? ""} />}
            {presentationSubTab === "polls" && <PollManager tournamentId={id ?? ""} tournament={tournament} />}
          </>
        );
      }

      default:
        return null;
    }
  };

  const desktopSubItems = activeTab === "general" ? {
    items: generalSubTabs, active: generalSubTab, select: (value: string) => setGeneralSubTab(value as GeneralSubTab),
  } : activeTab === "teams" ? {
    items: [{ id: "teams", label: tournament.teams_label || "Teams" }, { id: "referees", label: tournament.referees_label || "Scheidsrechters" }],
    active: deelnemersSubTab, select: (value: string) => setDeelnemersSubTab(value as "teams" | "referees"),
  } : activeTab === "results" ? {
    items: resultsSubTabs, active: resultsSubTab, select: (value: string) => setResultsSubTab(value as ResultsSubTab),
  } : activeTab === "presentation" ? {
    items: presentationSubTabs, active: presentationSubTab, select: (value: string) => setPresentationSubTab(value as PresentationSubTab),
  } : null;

  return (
    <AdminAppearanceContext.Provider value={true}>
    <div
      className="admin-ui tournament-admin h-dvh min-h-0 bg-background flex flex-col overflow-hidden"
    >


      <Navbar />
      {isMobile && (
        <div className="flex h-12 shrink-0 items-center gap-3 border-b border-border bg-card px-4 print:hidden">
          <Button variant="ghost" size="icon" onClick={toggleMobileSidebar} aria-label={mobileSidebarCollapsed ? "Menu openen" : "Menu inklappen"} aria-expanded={!mobileSidebarCollapsed} className="h-8 w-8 shrink-0">
            {mobileSidebarCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </Button>
          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
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
          <ThemeSwitcher embedded />
        </div>
      )}
      <div className="relative flex flex-1 overflow-hidden min-h-0">
        {/* Desktop: left navigation column */}
        {!isMobile && (
          <TooltipProvider delayDuration={300}>
            <nav
              aria-label="Toernooibeheer"
              className={cn(
                "admin-module-sidebar shrink-0 self-stretch flex flex-col min-h-0 border-r border-border bg-card print:hidden transition-[width] duration-200",
                desktopNavCollapsed ? "w-[68px]" : "w-60"
              )}
            >
              <div className="h-14 shrink-0 border-b border-border px-3">
                <div className="flex h-full items-center gap-2.5">
                  {tournament.logo_url && (
                    <img src={tournament.logo_url} alt="" className="h-8 w-8 shrink-0 object-contain" />
                  )}
                  {!desktopNavCollapsed && (
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground" title={tournament.name}>
                      {tournament.name}
                    </span>
                  )}
                </div>
              </div>

              <div className="min-h-0 flex-1 space-y-1 overflow-y-auto px-2 py-3">
                {sidebarItems.map((item) => {
                  const active = activeTab === item.id;
                  return (
                    <div key={item.id}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          type="button"
                          onClick={() => {
                            setActiveTab(item.id);
                            if (generalSubTab === "overview") setGeneralSubTab("info");
                            adminScrollRoot.current?.scrollTo({ top: 0 });
                          }}
                          aria-current={active ? "page" : undefined}
                          className={cn(
                            "group relative flex h-11 w-full justify-start items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors",
                            desktopNavCollapsed && "justify-center px-0",
                            active
                              ? "admin-nav-active text-foreground"
                              : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                          )}
                        >
                          {active && !desktopNavCollapsed && (
                            <span className="absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-full bg-primary" />
                          )}
                          <item.icon className={cn("h-[18px] w-[18px] shrink-0", active && "text-primary")} />
                          {!desktopNavCollapsed && <span className="truncate">{item.label}</span>}
                        </Button>
                      </TooltipTrigger>
                      {desktopNavCollapsed && (
                        <TooltipContent side="right" className="text-xs">{item.label}</TooltipContent>
                      )}
                    </Tooltip>
                    {active && desktopSubItems && (
                      <div className={cn("admin-module-subnav", desktopNavCollapsed && "admin-module-subnav-mini")} aria-label={`${item.label} onderdelen`}>
                        {desktopSubItems.items.map((subItem) => (
                          <Tooltip key={subItem.id}>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" type="button"
                                aria-label={subItem.label}
                                aria-current={desktopSubItems.active === subItem.id ? "page" : undefined}
                                onClick={() => { desktopSubItems.select(subItem.id); adminScrollRoot.current?.scrollTo({ top: 0 }); }}
                                className="admin-module-sublink">
                                {desktopNavCollapsed ? <span aria-hidden="true">{subItem.label.charAt(0)}</span> : <span>{subItem.label}</span>}
                              </Button>
                            </TooltipTrigger>
                            {desktopNavCollapsed && <TooltipContent side="right">{subItem.label}</TooltipContent>}
                          </Tooltip>
                        ))}
                      </div>
                    )}
                    </div>
                  );
                })}
              </div>

              <div className="flex shrink-0 items-center gap-1 border-t border-border p-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={toggleDesktopNav}
                  className={cn(
                    "min-w-0 flex-1 justify-start gap-3 px-2.5 text-xs font-semibold text-muted-foreground",
                    desktopNavCollapsed && "justify-center px-0"
                  )}
                  aria-label={desktopNavCollapsed ? "Menu openen" : "Menu inklappen"}
                >
                  {desktopNavCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
                  {!desktopNavCollapsed && <span>Inklappen</span>}
                </Button>
                <ThemeSwitcher embedded />
              </div>
            </nav>
          </TooltipProvider>
        )}

        {/* Mobile: fully hideable icon-only navigation */}
        {isMobile && !mobileSidebarCollapsed && (
          <nav
            aria-label="Toernooibeheer"
            className="flex w-14 shrink-0 flex-col gap-1 overflow-y-auto border-r border-border bg-card px-1 py-3 print:hidden"
          >
            {sidebarItems.map(item => {
              const active = activeTab === item.id;
              return (
                <Button
                  key={item.id}
                  variant="ghost"
                  size="icon"
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  aria-label={item.label}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative h-11 w-full shrink-0 rounded-md",
                    active ? "admin-nav-active text-primary" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {active && <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-primary" />}
                  <item.icon className={cn("h-5 w-5 shrink-0", active && "text-primary")} />
                </Button>
              );
            })}
          </nav>
        )}

        {/* Main content */}
        <div className="flex flex-1 min-w-0 min-h-0 flex-col">
          <div ref={adminScrollRoot} className="admin-scroll-pane flex-1 min-w-0 overflow-auto min-h-0 flex flex-col">
          <div className={cn("admin-content admin-workspace-inset pt-4 pb-4 sm:pb-6", (activeTab === "schedule" || activeTab === "results") && "flex flex-col md:flex-1 md:min-h-0 md:overflow-hidden")}>
            <div className={cn("flex flex-col gap-4 md:flex-1 md:min-h-0", !isMobile && activeTab !== "schedule" && activeTab !== "results" && "admin-focused-screen")}>
              {renderContent()}
            </div>
          </div>
        </div>
        </div>

      </div>

    </div>
    </AdminAppearanceContext.Provider>
  );
};

export default TournamentDetail;
