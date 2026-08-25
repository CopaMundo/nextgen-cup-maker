import { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import BroadcastStyleContext from "@/contexts/BroadcastStyleContext";
import { defaultAppearanceForStyle, type BroadcastStyle } from "@/lib/broadcastStyles";
import { fetchTournamentMatches } from "@/lib/fetchTournamentMatches";
import PublicBottomNav from "@/components/public-view/PublicBottomNav";
import PublicInfo from "@/components/public-view/PublicInfo";
import PublicTeams from "@/components/public-view/PublicTeams";
import PublicHomepage from "@/components/public-view/PublicHomepage";
import PublicStandings from "@/components/public-view/PublicStandings";
import PublicSchedule from "@/components/public-view/PublicSchedule";

export interface PublicTournamentData {
  tournament: any;
  phases: any[];
  groups: any[];
  teams: any[];
  matches: any[];
  groupTeams: any[];
  attachments: any[];
  sponsors: any[];
  locations: any[];
  stats: any[];
  players: any[];
  staff: any[];
  slots: any[];
  standingColors: any[];
  polls: any[];
  pollVotes: any[];
  categories: any[];
  scoringSystems: any[];
}

const PublicView = () => {
  const { token } = useParams<{ token: string }>();
  const [activeTab, setActiveTab] = useState<"info" | "teams" | "home" | "standings" | "schedule">(() => {
    const visitedKey = `visited-${token}`;
    const hasVisited = localStorage.getItem(visitedKey);
    if (!hasVisited) {
      localStorage.setItem(visitedKey, "true");
      return "info";
    }
    return "home";
  });
  const [standingsTarget, setStandingsTarget] = useState<{ phaseId?: string } | null>(null);
  const [data, setData] = useState<PublicTournamentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [favoriteTeam, setFavoriteTeam] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [darkMode, setDarkMode] = useState(true);
  const [homeResetKey, setHomeResetKey] = useState(0);

  useEffect(() => {
    const stored = localStorage.getItem(`fav-${token}`);
    if (stored) setFavoriteTeam(stored);
    const storedCat = localStorage.getItem(`cat-${token}`);
    if (storedCat) setSelectedCategory(storedCat);
    const storedDark = localStorage.getItem(`dark-${token}`);
    if (storedDark !== null) setDarkMode(storedDark === "true");
    fetchData();
  }, [token]);

  // Standaard light/dark per broadcaststijl, tenzij de bezoeker zelf al koos
  useEffect(() => {
    if (!data?.tournament) return;
    if (localStorage.getItem(`dark-${token}`) !== null) return;
    const style = (data.tournament.view_display_style || "copa_mundo") as BroadcastStyle;
    setDarkMode(defaultAppearanceForStyle(style) === "dark");
  }, [data?.tournament?.view_display_style, token]);


  useEffect(() => {
    if (!data?.tournament) return;
    const style = data.tournament.view_display_style || "copa_mundo";
    document.documentElement.setAttribute("data-mode", darkMode ? "dark" : "light");
    document.documentElement.setAttribute("data-broadcast", style);
    return () => {
      const savedMode = localStorage.getItem("copa-mode") || "dark";
      document.documentElement.setAttribute("data-mode", savedMode);
      document.documentElement.removeAttribute("data-broadcast");
    };
  }, [data?.tournament?.view_display_style, darkMode]);

  const toggleDarkMode = useCallback(() => {
    setDarkMode(prev => {
      const next = !prev;
      localStorage.setItem(`dark-${token}`, String(next));
      return next;
    });
  }, [token]);

  // Realtime
  useEffect(() => {
    if (!data?.tournament) return;
    const channel = supabase
      .channel("public-view")
      .on("postgres_changes", { event: "*", schema: "public", table: "matches", filter: `tournament_id=eq.${data.tournament.id}` }, () => fetchData())
      .on("postgres_changes", { event: "*", schema: "public", table: "group_teams", filter: `tournament_id=eq.${data.tournament.id}` }, () => fetchData())
      .on("postgres_changes", { event: "*", schema: "public", table: "match_stats", filter: `tournament_id=eq.${data.tournament.id}` }, () => fetchData())
      .on("postgres_changes", { event: "*", schema: "public", table: "tournament_phases", filter: `tournament_id=eq.${data.tournament.id}` }, () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [data?.tournament?.id]);

  const fetchData = async () => {
    const { data: t } = await supabase.from("tournaments").select("*").eq("view_link_token", token!).eq("view_link_active", true).single();
    if (!t) { setLoading(false); return; }

    const [pRes, gRes, tRes, mRes, gtRes, attRes, spRes, locRes, stRes, plRes, slotsRes, scRes, pollRes, pvRes, catRes, staffRes, ssRes] = await Promise.all([
      supabase.from("tournament_phases").select("*").eq("tournament_id", t.id).order("phase_number").order("sort_order"),
      supabase.from("groups").select("*").eq("tournament_id", t.id),
      supabase.from("teams").select("*").eq("tournament_id", t.id),
      fetchTournamentMatches({ tournamentId: t.id, orders: [{ column: "match_date" }, { column: "match_time" }, { column: "round_number" }, { column: "created_at" }], maxRows: 5000 }),
      supabase.from("group_teams").select("*").eq("tournament_id", t.id),
      supabase.from("tournament_attachments").select("*").eq("tournament_id", t.id).order("created_at"),
      supabase.from("tournament_sponsors").select("*").eq("tournament_id", t.id).order("sort_order"),
      supabase.from("tournament_locations").select("*").eq("tournament_id", t.id),
      supabase.from("match_stats").select("*").eq("tournament_id", t.id),
      supabase.from("players").select("*").eq("tournament_id", t.id),
      supabase.from("slots").select("*").eq("tournament_id", t.id),
      supabase.from("standing_colors").select("*").eq("tournament_id", t.id),
      supabase.from("tournament_polls").select("*").eq("tournament_id", t.id).eq("active", true),
      supabase.from("poll_votes").select("*"),
      supabase.from("tournament_categories").select("*").eq("tournament_id", t.id).order("sort_order"),
      supabase.from("staff").select("*").eq("tournament_id", t.id),
      supabase.from("tournament_scoring_systems" as any).select("id, scoring_type, num_sets, set_points_mode, set_result_points, points_win, points_draw, points_loss, points_big_win, big_win_threshold, points_win_overtime, points_draw_with_goals, points_draw_no_goals, points_loss_overtime, no_draws, tiebreaker_rules").eq("tournament_id", t.id),
    ]);

    const pollIds = (pollRes.data || []).map((p: any) => p.id);
    const filteredVotes = (pvRes.data || []).filter((v: any) => pollIds.includes(v.poll_id));

    setData({
      tournament: t,
      phases: pRes.data || [],
      groups: gRes.data || [],
      teams: tRes.data || [],
      matches: mRes as any[],
      groupTeams: gtRes.data || [],
      attachments: attRes.data || [],
      sponsors: spRes.data || [],
      locations: locRes.data || [],
      stats: stRes.data || [],
      players: plRes.data || [],
      staff: staffRes.data || [],
      slots: slotsRes.data || [],
      standingColors: scRes.data || [],
      polls: pollRes.data || [],
      pollVotes: filteredVotes,
      categories: catRes.data || [],
      scoringSystems: (ssRes as any).data || [],
    });
    setLoading(false);
  };

  const toggleFavorite = useCallback((teamId: string) => {
    if (favoriteTeam === teamId) {
      setFavoriteTeam(null);
      localStorage.removeItem(`fav-${token}`);
    } else {
      setFavoriteTeam(teamId);
      localStorage.setItem(`fav-${token}`, teamId);
    }
  }, [favoriteTeam, token]);

  const handleCategoryChange = useCallback((catId: string) => {
    setSelectedCategory(catId);
    localStorage.setItem(`cat-${token}`, catId);
  }, [token]);

  const isMultiCat = data?.tournament?.is_multi_category && (data?.categories?.length ?? 0) > 1;
  const needsDivisionSelection = isMultiCat && (!selectedCategory || selectedCategory === "");

  const handleSetActiveTab = useCallback((tab: any, target?: { phaseId?: string }) => {
    if (needsDivisionSelection && tab !== "info") {
      setActiveTab("info");
      return;
    }
    if (tab === "home") setHomeResetKey(k => k + 1);
    if (target) setStandingsTarget(target);
    else setStandingsTarget(null);
    setActiveTab(tab);
    // Scroll to top for all tabs except schedule (handled internally)
    if (tab !== "schedule") {
      window.scrollTo({ top: 0 });
    }
  }, [needsDivisionSelection]);

  if (loading) return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );

  if (!data?.tournament) return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <p className="text-muted-foreground text-lg">Toernooi niet gevonden of link niet actief.</p>
    </div>
  );

  // Filter data by category if selected
  const filteredData = { ...data };
  if (selectedCategory && selectedCategory !== "all" && isMultiCat) {
    const catPhaseIds = data.phases.filter((p: any) => p.category_id === selectedCategory).map((p: any) => p.id);
    filteredData.phases = data.phases.filter((p: any) => p.category_id === selectedCategory);
    filteredData.groups = data.groups.filter((g: any) => catPhaseIds.includes(g.phase_id));
    const groupIds = filteredData.groups.map((g: any) => g.id);
    filteredData.teams = data.teams.filter((t: any) => t.category_id === selectedCategory);
    filteredData.groupTeams = data.groupTeams.filter((gt: any) => groupIds.includes(gt.group_id));
    filteredData.matches = data.matches.filter((m: any) => catPhaseIds.includes(m.phase_id));
    const teamIds = filteredData.teams.map((t: any) => t.id);
    filteredData.players = data.players.filter((p: any) => teamIds.includes(p.team_id));
    filteredData.staff = data.staff.filter((s: any) => teamIds.includes(s.team_id));
    filteredData.stats = data.stats.filter((s: any) => teamIds.includes(s.team_id));
    filteredData.slots = data.slots.filter((s: any) => catPhaseIds.includes(s.phase_id) || catPhaseIds.includes(s.ref_phase_id));
    filteredData.standingColors = data.standingColors.filter((sc: any) => catPhaseIds.includes(sc.phase_id));
  }

  const displayStyle = (data.tournament.view_display_style || "copa_mundo") as BroadcastStyle;

  return (
    <BroadcastStyleContext.Provider value={displayStyle}>
      <div className="min-h-screen bg-background pb-20" data-broadcast={displayStyle}>
        {activeTab === "info" && <PublicInfo data={data} selectedCategory={selectedCategory} onCategoryChange={handleCategoryChange} darkMode={darkMode} onToggleDarkMode={toggleDarkMode} />}
        {activeTab === "teams" && <PublicTeams data={filteredData} favoriteTeam={favoriteTeam} />}
        {activeTab === "home" && <PublicHomepage data={filteredData} favoriteTeam={favoriteTeam} toggleFavorite={toggleFavorite} setActiveTab={handleSetActiveTab} homeResetKey={homeResetKey} />}
        {activeTab === "standings" && <PublicStandings data={filteredData} initialPhaseId={standingsTarget?.phaseId} />}
        {activeTab === "schedule" && <PublicSchedule data={filteredData} favoriteTeam={favoriteTeam} />}

        <PublicBottomNav activeTab={activeTab} setActiveTab={handleSetActiveTab} tournament={data.tournament} favoriteTeam={favoriteTeam} teams={filteredData.teams} />
      </div>
    </BroadcastStyleContext.Provider>
  );
};

export default PublicView;
