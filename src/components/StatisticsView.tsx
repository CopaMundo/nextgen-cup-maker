import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { computeFairplayRows, getFairplayConfig, type FairplayMatch } from "@/lib/fairplay";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ChevronRight } from "lucide-react";
import trophyIconAsset from "@/assets/trophy-icon.png.asset.json";
import bootsIconAsset from "@/assets/boots-icon.png.asset.json";
import yellowCardIconAsset from "@/assets/yellow-card_1.png.asset.json";

const MaskIcon = ({ src, label }: { src: string; label: string }) => (
  <span
    role="img"
    aria-label={label}
    className="inline-block h-4 w-4 bg-primary"
    style={{
      maskImage: `url(${src})`,
      maskSize: "contain",
      maskRepeat: "no-repeat",
      maskPosition: "center",
      WebkitMaskImage: `url(${src})`,
      WebkitMaskSize: "contain",
      WebkitMaskRepeat: "no-repeat",
      WebkitMaskPosition: "center",
    }}
  />
);


interface Team { id: string; name: string; logo_url: string | null; }
interface MatchStat { id: string; match_id: string; stat_type: "goal" | "assist" | "yellow_card" | "red_card" | "straight_red"; player_name: string; team_id: string; }

type StatTab = "scorers" | "assists" | "fairplay";

const OWN_GOAL_LABEL = "Eigen doelpunt";

const StatisticsView = ({ tournamentId, tournament, categoryId }: { tournamentId: string; tournament: any; categoryId?: string | null }) => {
  const [stats, setStats] = useState<MatchStat[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [matches, setMatches] = useState<FairplayMatch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [sRes, tRes, mRes] = await Promise.all([
        supabase.from("match_stats").select("id, match_id, stat_type, player_name, team_id").eq("tournament_id", tournamentId),
        supabase.from("teams").select("id, name, logo_url, category_id").eq("tournament_id", tournamentId),
        supabase.from("matches").select("id, home_team_id, away_team_id, is_played").eq("tournament_id", tournamentId),
      ]);
      const allTeams = (tRes.data || []) as (Team & { category_id: string | null })[];
      const filteredTeams = categoryId ? allTeams.filter(t => t.category_id === categoryId) : allTeams;
      const teamIds = new Set(filteredTeams.map(t => t.id));
      const allStats = (sRes.data || []) as MatchStat[];
      const filteredStats = categoryId ? allStats.filter(s => teamIds.has(s.team_id)) : allStats;
      setTeams(filteredTeams);
      setStats(filteredStats);
      setMatches(((mRes.data || []) as FairplayMatch[]).filter(m => !categoryId || (m.home_team_id && teamIds.has(m.home_team_id)) || (m.away_team_id && teamIds.has(m.away_team_id))));
      setLoading(false);
    })();
  }, [tournamentId, categoryId]);


  const teamName = (id: string) => teams.find(t => t.id === id)?.name || "?";
  const teamLogo = (id: string) => teams.find(t => t.id === id)?.logo_url || null;

  const playerCountAgg = (type: "goal" | "assist") => {
    const filtered = stats.filter(s =>
      s.stat_type === type &&
      s.player_name &&
      s.player_name !== OWN_GOAL_LABEL &&
      s.player_name !== "Onbekend"
    );
    const map: Record<string, { name: string; teamId: string; count: number }> = {};
    filtered.forEach(s => {
      const key = `${s.player_name}__${s.team_id}`;
      if (!map[key]) map[key] = { name: s.player_name, teamId: s.team_id, count: 0 };
      map[key].count++;
    });
    return Object.values(map).sort((a, b) => b.count - a.count);
  };

  // Add competition-style ranking (ties share the same rank, next rank skips)
  const withRank = <T extends { count: number }>(rows: T[]): (T & { rank: number })[] => {
    let lastCount = -1;
    let lastRank = 0;
    return rows.map((r, i) => {
      const rank = r.count === lastCount ? lastRank : i + 1;
      lastCount = r.count;
      lastRank = rank;
      return { ...r, rank };
    });
  };

  const fpConfig = useMemo(() => getFairplayConfig(tournament), [tournament]);

  type TeamFairplayRow = {
    teamId: string;
    yellows: number;
    secondYellows: number;
    reds: number;
    cleanMatches: number;
    penalty: number;
    total: number;
  };

  const fairplayPerTeam = (): TeamFairplayRow[] => {
    const rows = computeFairplayRows(teams.map(t => t.id), stats, matches, fpConfig);
    return rows.sort((a, b) => {
      if (b.total !== a.total) return b.total - a.total;
      return teamName(a.teamId).localeCompare(teamName(b.teamId));
    });
  };

  const fairplayWithRank = (rows: TeamFairplayRow[]) => {
    let lastPoints = Number.NaN;
    let lastRank = 0;
    return rows.map((r, i) => {
      const rank = r.total === lastPoints ? lastRank : i + 1;
      lastPoints = r.total;
      lastRank = rank;
      return { ...r, rank };
    });
  };


  const goals = useMemo(() => withRank(playerCountAgg("goal")), [stats]);
  const assists = useMemo(() => withRank(playerCountAgg("assist")), [stats]);
  const fairplay = useMemo(() => fairplayWithRank(fairplayPerTeam()), [stats, teams]);

  const showGoals = tournament.enable_goalscorers;
  const showAssists = tournament.enable_assists;
  const showFairplayRanking = !!tournament.enable_fairplay;
  const showFairplay = showFairplayRanking;


  const tabs: { id: StatTab; label: string }[] = [
    ...(showGoals ? [{ id: "scorers" as StatTab, label: "Topschutters" }] : []),
    ...(showAssists ? [{ id: "assists" as StatTab, label: "Assists" }] : []),
    ...(showFairplayRanking ? [{ id: "fairplay" as StatTab, label: "Fairplayklassement" }] : []),
  ];


  const [activeTab, setActiveTab] = useState<StatTab>("scorers");
  const isMobile = useIsMobile();
  const [mobileOverview, setMobileOverview] = useState(true);

  useEffect(() => {
    if (tabs.length > 0 && !tabs.find(t => t.id === activeTab)) {
      setActiveTab(tabs[0].id);
    }
  }, [tabs.map(t => t.id).join("|")]);

  if (loading) return <div className="flex justify-center py-8"><div className="h-6 w-6 animate-spin rounded-full border-2 border-foreground border-t-transparent" /></div>;

  if (tabs.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border py-12 text-center">
        <p className="text-muted-foreground">Voor dit toernooi worden geen spelerstatistieken bijgehouden.</p>
      </div>
    );
  }

  const renderPlayerTable = (data: { name: string; teamId: string; count: number; rank: number }[], countLabel: string) => (
    data.length === 0 ? (
      <div className="rounded-xl border border-dashed border-border py-8 text-center">
        <p className="text-sm text-muted-foreground">Nog geen gegevens beschikbaar.</p>
      </div>
    ) : (
      <div className="rounded-xl border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Speler</TableHead>
              <TableHead className="text-xs">Team</TableHead>
              <TableHead className="w-20 text-center text-xs">{countLabel}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.slice(0, 50).map((row) => (
              <TableRow key={`${row.name}-${row.teamId}`}>
                <TableCell className="text-sm font-medium text-foreground">
                  <span className="text-muted-foreground font-bold mr-2 tabular-nums">{row.rank}.</span>
                  {row.name}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5">
                    {teamLogo(row.teamId) && <img src={teamLogo(row.teamId)!} className="h-4 w-4 object-contain" alt="" />}
                    <span className="text-xs text-muted-foreground">{teamName(row.teamId)}</span>
                  </div>
                </TableCell>
                <TableCell className="text-center text-base font-bold text-foreground">{row.count}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    )
  );

  const YellowIcon = () => <div className="h-4 w-3 rounded-sm bg-yellow-400 inline-block" />;
  const SecondYellowIcon = () => (
    <span className="inline-flex items-center gap-0.5 align-middle">
      <div className="h-4 w-3 rounded-sm bg-yellow-400" />
      <div className="h-4 w-3 rounded-sm bg-red-500 -ml-1" />
    </span>
  );
  const RedIcon = () => <div className="h-4 w-3 rounded-sm bg-red-500 inline-block" />;

  const renderFairplayTable = (data: (TeamFairplayRow & { rank: number })[]) => (
    data.length === 0 ? (
      <div className="rounded-xl border border-dashed border-border py-8 text-center">
        <p className="text-sm text-muted-foreground">Nog geen teams.</p>
      </div>
    ) : (
      <div className="rounded-xl border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Team</TableHead>
              <TableHead className="w-16 text-center text-xs"><YellowIcon /></TableHead>
              <TableHead className="w-16 text-center text-xs"><SecondYellowIcon /></TableHead>
              <TableHead className="w-16 text-center text-xs"><RedIcon /></TableHead>
              {fpConfig.clean_match != null && <TableHead className="w-24 text-center text-xs">Zonder kaart</TableHead>}
              <TableHead className="w-20 text-center text-xs">Strafpunten</TableHead>
              {showFairplayRanking && <TableHead className="w-20 text-center text-xs">Totaal</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row) => (
              <TableRow key={row.teamId}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground font-bold tabular-nums w-6">{row.rank}.</span>
                    {teamLogo(row.teamId) && <img src={teamLogo(row.teamId)!} className="h-5 w-5 object-contain" alt="" />}
                    <span className="text-sm font-medium text-foreground">{teamName(row.teamId)}</span>
                  </div>
                </TableCell>
                <TableCell className="text-center text-sm tabular-nums">{row.yellows}</TableCell>
                <TableCell className="text-center text-sm tabular-nums">{row.secondYellows}</TableCell>
                <TableCell className="text-center text-sm tabular-nums">{row.reds}</TableCell>
                {fpConfig.clean_match != null && <TableCell className="text-center text-sm tabular-nums">{row.cleanMatches}</TableCell>}
                <TableCell className={cn("text-center text-sm font-semibold tabular-nums", row.penalty > 0 ? "text-destructive" : "text-muted-foreground")}>
                  {row.penalty > 0 ? `-${row.penalty}` : 0}
                </TableCell>
                {showFairplayRanking && (
                  <TableCell className="text-center text-base font-bold tabular-nums text-foreground">{row.total}</TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="border-t border-border bg-secondary/30 px-4 py-2 text-[11px] text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="inline-flex items-center gap-1.5"><YellowIcon /> = -{fpConfig.yellow} pt</span>
          <span>·</span>
          <span className="inline-flex items-center gap-1.5"><SecondYellowIcon /> = -{fpConfig.second_yellow} pt</span>
          <span>·</span>
          <span className="inline-flex items-center gap-1.5"><RedIcon /> = -{fpConfig.red} pt</span>
          {fpConfig.clean_match != null && (
            <>
              <span>·</span>
              <span>Wedstrijd zonder kaart = +{fpConfig.clean_match} pt</span>
            </>
          )}
          {showFairplayRanking && (
            <>
              <span>·</span>
              <span>Startpunten = {fpConfig.start}</span>
            </>
          )}
        </div>

      </div>
    )
  );

  const activeLabel = tabs.find(t => t.id === activeTab)?.label || "";

  return (
    <div className="space-y-6 w-full">
      {/* Mobiel: statistieken als tegels */}
      {isMobile && mobileOverview && (
        <div className="grid grid-cols-1 gap-2">
          {tabs.map(tab => (
            <div
              key={tab.id}
              role="button"
              tabIndex={0}
              onClick={() => { setActiveTab(tab.id); setMobileOverview(false); }}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { setActiveTab(tab.id); setMobileOverview(false); } }}
              className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5 transition-colors hover:border-primary/50 hover:bg-accent/40"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                {tab.id === "scorers" && <MaskIcon src={trophyIconAsset.url} label="Topschutters" />}
                {tab.id === "assists" && <MaskIcon src={bootsIconAsset.url} label="Assists" />}
                {tab.id === "fairplay" && <MaskIcon src={yellowCardIconAsset.url} label="Fairplay" />}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-semibold">{tab.label}</span>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </div>
          ))}
        </div>
      )}

      {/* Mobiel: kop met terugknop */}
      {isMobile && !mobileOverview && (
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="h-8 w-8" aria-label="Terug naar statistieken" onClick={() => setMobileOverview(true)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h2 className="min-w-0 flex-1 truncate text-base font-semibold">{activeLabel}</h2>
        </div>
      )}

      {!isMobile && (
        <div className="flex justify-center border-b border-border flex-wrap">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "px-6 py-3 text-sm font-semibold uppercase tracking-wide transition-colors relative",
                activeTab === tab.id
                  ? "text-primary after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:bg-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {!(isMobile && mobileOverview) && (
        <div className="max-sm:overflow-x-auto">
          {activeTab === "scorers" && showGoals && renderPlayerTable(goals, "Doelpunten")}
          {activeTab === "assists" && showAssists && renderPlayerTable(assists, "Assists")}
          {activeTab === "fairplay" && showFairplay && renderFairplayTable(fairplay)}
        </div>
      )}
    </div>
  );

};

export default StatisticsView;
