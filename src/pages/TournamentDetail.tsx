import { useState, useEffect, useMemo } from "react";
import { loadFieldLocations } from "@/lib/fieldLocations";
import { useParams, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import ThemeSwitcher from "@/components/ThemeSwitcher";
import { Settings, Tv2, BarChart3, MessageCircle, Handshake } from "lucide-react";
import BracketTreeIcon from "@/components/icons/BracketTreeIcon";
import ScoreboardIcon from "@/components/icons/ScoreboardIcon";
import CalendarClockIcon from "@/components/icons/CalendarClockIcon";
import ShirtIcon from "@/components/icons/ShirtIcon";
import TournamentGeneral from "@/components/TournamentGeneral";
import TeamManager from "@/components/TeamManager";
import PhaseManager from "@/components/PhaseManager";
import MatchScheduler from "@/components/MatchScheduler";
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

// Op smalle (mobiele) schermen wordt de volledige desktop-layout van het beheer
// verkleind weergegeven, zodat het er op een telefoon exact hetzelfde uitziet.
const ADMIN_MIN_WIDTH = 625;

const useAdminDesktopScale = () => {
  useEffect(() => {
    const root = document.documentElement;
    const apply = () => {
      const zoom = window.innerWidth < ADMIN_MIN_WIDTH ? window.innerWidth / ADMIN_MIN_WIDTH : 1;
      root.style.zoom = zoom === 1 ? "" : String(zoom);
      // 100vh houdt geen rekening met zoom: hoogte expliciet omrekenen,
      // anders wordt de onderkant van de pagina afgesneden.
      root.style.setProperty("--admin-vh", zoom === 1 ? "100vh" : `${window.innerHeight / zoom}px`);
    };
    apply();
    window.addEventListener("resize", apply);
    window.addEventListener("orientationchange", apply);
    return () => {
      window.removeEventListener("resize", apply);
      window.removeEventListener("orientationchange", apply);
      root.style.zoom = "";
      root.style.removeProperty("--admin-vh");
    };
  }, []);

};




const sidebarItems = [

  { id: "general", icon: Settings, label: "Algemeen" },
  { id: "teams", icon: ShirtIcon, label: "Deelnemers" },
  { id: "phases", icon: BracketTreeIcon, label: "Format" },
  { id: "schedule", icon: CalendarClockIcon, label: "Schema" },
  { id: "results", icon: ScoreboardIcon, label: "Resultaten" },
  { id: "statistics", icon: BarChart3, label: "Statistieken" },
  { id: "sponsors", icon: Handshake, label: "Sponsors" },
  { id: "polls", icon: MessageCircle, label: "Polls" },
  { id: "presentation", icon: Tv2, label: "Presentatie" },
] as const;

type TabId = typeof sidebarItems[number]["id"];

const categoryStorageKey = (tournamentId: string) => `tournament-category:${tournamentId}`;
const locationStorageKey = (tournamentId: string) => `tournament-location:${tournamentId}`;

const TournamentDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  useAdminDesktopScale();

  const [tournament, setTournament] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedCategoryId, setSelectedCategoryIdState] = useState<string | null>(() => {
    if (typeof window === "undefined" || !id) return null;
    return localStorage.getItem(categoryStorageKey(id));
  });
  const [activeTab, setActiveTab] = useState<TabId>("general");
  const [deelnemersSubTab, setDeelnemersSubTab] = useState<"teams" | "referees">("teams");
  const [selectedLocation, setSelectedLocationState] = useState<string | null>(() => {
    if (typeof window === "undefined" || !id) return null;
    return localStorage.getItem(locationStorageKey(id));
  });

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
        return <TournamentGeneral tournament={tournament} onUpdate={t => setTournament(t)} />;
      case "teams":
        return (
          <>
            {categorySelector}
            {(!tournament.is_multi_category || effectiveCategoryId) && (
              <>
                <div className="flex justify-center border-b border-border mb-6">
                  <button
                    onClick={() => setDeelnemersSubTab("teams")}
                    className={cn(
                      "px-6 py-3 text-sm font-semibold uppercase tracking-wide transition-colors relative",
                      deelnemersSubTab === "teams"
                        ? "text-primary after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:bg-primary"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {tournament.teams_label || "Teams"}
                  </button>
                  <button
                    onClick={() => setDeelnemersSubTab("referees")}
                    className={cn(
                      "px-6 py-3 text-sm font-semibold uppercase tracking-wide transition-colors relative",
                      deelnemersSubTab === "referees"
                        ? "text-primary after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:bg-primary"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {tournament.referees_label || "Scheidsrechters"}
                  </button>
                </div>
                {deelnemersSubTab === "teams" && (
                  <TeamManager tournamentId={id!} teamCount={tournament.team_count} showCountry={tournament.show_country} categoryId={effectiveCategoryId} teamsLabel={tournament.teams_label || "Teams"} />
                )}
                {deelnemersSubTab === "referees" && (
                  <RefereeManager tournamentId={id!} categoryId={effectiveCategoryId} />
                )}
              </>
            )}
          </>
        );
      case "phases":
        return (
          <>
            {categorySelector}
            {(!tournament.is_multi_category || effectiveCategoryId) && (
              <PhaseManager key={`phases-${id}-${effectiveCategoryId ?? "all"}`} tournamentId={id!} tournamentType={tournament.tournament_type} categoryId={effectiveCategoryId} />
            )}
          </>
        );
      case "schedule": {
        const compactSelect = "h-7 w-auto min-w-fit rounded-md px-2 text-xs";
        const scheduleSelectors = (
          <>
            <CategorySelector
              tournamentId={id!}
              isMultiCategory={tournament.is_multi_category}
              selectedCategoryId={selectedCategoryId}
              onSelect={setSelectedCategoryId}
              selectClassName={compactSelect}
            />
            <LocationSelector
              tournamentId={id!}
              selectedLocation={selectedLocation}
              onSelect={setSelectedLocation}
              selectClassName={compactSelect}
            />
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
          />
        ) : (
          <div className="flex flex-wrap items-center gap-3 mb-4">{scheduleSelectors}</div>
        );
      }
      case "results":
        return (
          <>
            {categorySelector}
            {(!tournament.is_multi_category || effectiveCategoryId) && (
              <ResultsManager tournamentId={id!} tournament={tournament} categoryId={effectiveCategoryId} />
            )}
          </>
        );
      case "statistics":
        return (
          <>
            {categorySelector}
            {(!tournament.is_multi_category || effectiveCategoryId) && (
              <StatisticsView tournamentId={id!} tournament={tournament} categoryId={effectiveCategoryId} />
            )}
          </>
        );
      case "sponsors":
        return <SponsorManager tournamentId={id!} />;
      case "polls":
        return <PollManager tournamentId={id!} tournament={tournament} />;
      case "presentation":
        return <PresentationManager tournament={tournament} onUpdate={t => setTournament(t)} />;
      default:
        return null;
    }
  };

  return (
    <div
      className="min-h-0 bg-background flex flex-col overflow-hidden"
      style={{ height: "var(--admin-vh, 100vh)" }}
    >


      <Navbar tournamentName={tournament?.name} />
      <ThemeSwitcher />
      <div className="flex flex-1 overflow-hidden min-h-0">
        {/* Left icon sidebar */}
        <TooltipProvider delayDuration={200}>
          <nav className="w-20 shrink-0 border-r border-border bg-card flex flex-col items-center py-2 gap-0.5 print:hidden min-h-0 overflow-hidden">
            {tournament.logo_url && (
              <div className="mb-2 pb-2 border-b border-border shrink-0">
                <img src={tournament.logo_url} alt="" className="h-8 w-8 rounded-lg object-contain" />
              </div>
            )}
            {sidebarItems.map(item => (
              <Tooltip key={item.id}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setActiveTab(item.id)}
                    className={cn(
                      "w-16 flex-1 min-h-0 max-h-[56px] py-1 rounded-lg flex flex-col items-center justify-center gap-0.5 transition-all duration-150 overflow-hidden",
                      activeTab === item.id
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                    )}
                  >
                    <item.icon className="h-5 w-5" />
                    <span className="text-[10px] font-medium leading-tight truncate w-full text-center">{item.label}</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="text-xs">
                  {item.label}
                </TooltipContent>
              </Tooltip>
            ))}
          </nav>
        </TooltipProvider>

        {/* Main content */}
        <div className="flex-1 min-w-0 overflow-auto min-h-0 flex flex-col">
          <div className="px-3 sm:px-6 py-3 sm:py-4 w-full flex flex-col">
            <div className="flex flex-col">{renderContent()}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TournamentDetail;
