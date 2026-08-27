import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

interface Team { id: string; name: string; logo_url: string | null; }
interface MatchStat { id: string; match_id: string; stat_type: "goal" | "assist" | "yellow_card" | "red_card" | "straight_red"; player_name: string; team_id: string; }

type StatTab = "scorers" | "assists" | "fairplay" | "cards";

const OWN_GOAL_LABEL = "Eigen doelpunt";

const StatisticsView = ({ tournamentId, tournament, categoryId }: { tournamentId: string; tournament: any; categoryId?: string | null }) => {
  const [stats, setStats] = useState<MatchStat[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [sRes, tRes] = await Promise.all([
        supabase.from("match_stats").select("id, match_id, stat_type, player_name, team_id").eq("tournament_id", tournamentId),
        supabase.from("teams").select("id, name, logo_url, category_id").eq("tournament_id", tournamentId),
      ]);
      const allTeams = (tRes.data || []) as (Team & { category_id: string | null })[];
      const filteredTeams = categoryId ? allTeams.filter(t => t.category_id === categoryId) : allTeams;
      const teamIds = new Set(filteredTeams.map(t => t.id));
      const allStats = (sRes.data || []) as MatchStat[];
      const filteredStats = categoryId ? allStats.filter(s => teamIds.has(s.team_id)) : allStats;
      setTeams(filteredTeams);
      setStats(filteredStats);
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

  type TeamFairplayRow = {
    teamId: string;
    yellows: number;
    secondYellows: number;
    straightReds: number;
    legacyReds: number;
    points: number; // negative
  };

  const fairplayPerTeam = (): TeamFairplayRow[] => {
    // Build map for ALL teams so they appear with 0 even without cards
    const teamMap: Record<string, TeamFairplayRow> = {};
    teams.forEach(t => {
      teamMap[t.id] = { teamId: t.id, yellows: 0, secondYellows: 0, straightReds: 0, legacyReds: 0, points: 0 };
    });

    // Compute 2nd-yellows per (team, player) by pairing yellow cards
    const yellowMap: Record<string, number> = {};
    stats.forEach(s => {
      if (s.stat_type === "yellow_card") {
        const key = `${s.team_id}__${s.player_name}`;
        yellowMap[key] = (yellowMap[key] || 0) + 1;
      }
    });
    Object.entries(yellowMap).forEach(([key, total]) => {
      const teamId = key.split("__")[0];
      if (!teamMap[teamId]) return;
      teamMap[teamId].secondYellows += Math.floor(total / 2);
      teamMap[teamId].yellows += total % 2;
    });

    stats.forEach(s => {
      if (!teamMap[s.team_id]) return;
      if (s.stat_type === "straight_red") teamMap[s.team_id].straightReds++;
      else if (s.stat_type === "red_card") teamMap[s.team_id].legacyReds++;
    });

    // Negative points: yellow -1, 2x-yellow/red -3, straight red -5, legacy red -3
    Object.values(teamMap).forEach(r => {
      r.points = -(r.yellows * 1 + r.secondYellows * 3 + r.straightReds * 5 + r.legacyReds * 3);
    });

    // Sort: highest points first (closest to 0), then by team name
    return Object.values(teamMap).sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      return teamName(a.teamId).localeCompare(teamName(b.teamId));
    });
  };

  const fairplayWithRank = (rows: TeamFairplayRow[]) => {
    let lastPoints = Number.NaN;
    let lastRank = 0;
    return rows.map((r, i) => {
      const rank = r.points === lastPoints ? lastRank : i + 1;
      lastPoints = r.points;
      lastRank = rank;
      return { ...r, rank };
    });
  };

  // Kaarten per speler (individueel): geel, 2x geel, rood
  type PlayerCardsRow = {
    name: string;
    teamId: string;
    yellows: number;
    secondYellows: number;
    reds: number;
    totalPoints: number; // negatief, voor sortering
  };

  const cardsPerPlayer = (): PlayerCardsRow[] => {
    const map: Record<string, PlayerCardsRow> = {};
    stats.forEach((s) => {
      if (!s.player_name || s.player_name === "Onbekend") return;
      const key = `${s.player_name}__${s.team_id}`;
      if (!map[key]) {
        map[key] = { name: s.player_name, teamId: s.team_id, yellows: 0, secondYellows: 0, reds: 0, totalPoints: 0 };
      }
      const row = map[key];
      if (s.stat_type === "yellow_card") row.yellows++;
      else if (s.stat_type === "straight_red") row.reds++;
      else if (s.stat_type === "red_card") row.reds++;
    });
    // 2x geel paren per speler
    Object.values(map).forEach((row) => {
      row.secondYellows = Math.floor(row.yellows / 2);
      row.yellows = row.yellows % 2;
      row.totalPoints = -(row.yellows * 1 + row.secondYellows * 3 + row.reds * 5);
    });
    return Object.values(map)
      .filter((r) => r.yellows + r.secondYellows + r.reds > 0)
      .sort((a, b) => a.totalPoints - b.totalPoints || a.name.localeCompare(b.name));
  };

  const goals = useMemo(() => withRank(playerCountAgg("goal")), [stats]);
  const assists = useMemo(() => withRank(playerCountAgg("assist")), [stats]);
  const fairplay = useMemo(() => fairplayWithRank(fairplayPerTeam()), [stats, teams]);
  const playerCards = useMemo(() => cardsPerPlayer(), [stats]);

  const showGoals = tournament.enable_goalscorers;
  const showAssists = tournament.enable_assists;
  const showFairplay = tournament.enable_yellow_cards || tournament.enable_red_cards;

  const tabs: { id: StatTab; label: string }[] = [
    ...(showGoals ? [{ id: "scorers" as StatTab, label: "Topschutters" }] : []),
    ...(showAssists ? [{ id: "assists" as StatTab, label: "Meeste assists" }] : []),
    ...(showFairplay ? [{ id: "fairplay" as StatTab, label: "Kaarten" }] : []),
    ...(showFairplay ? [{ id: "cards" as StatTab, label: "Kaarten per speler" }] : []),
  ];

  const [activeTab, setActiveTab] = useState<StatTab>("scorers");

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
              <TableHead className="w-20 text-center text-xs">Punten</TableHead>
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
                <TableCell className="text-center text-sm tabular-nums">{row.straightReds + row.legacyReds}</TableCell>
                <TableCell className={cn("text-center text-base font-bold tabular-nums", row.points < 0 ? "text-destructive" : "text-foreground")}>
                  {row.points}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="border-t border-border bg-secondary/30 px-4 py-2 text-[11px] text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="inline-flex items-center gap-1.5"><YellowIcon /> = -1 pt</span>
          <span>·</span>
          <span className="inline-flex items-center gap-1.5"><SecondYellowIcon /> = -3 pt</span>
          <span>·</span>
          <span className="inline-flex items-center gap-1.5"><RedIcon /> = -5 pt</span>
        </div>
      </div>
    )
  );

  const renderCardsTable = (data: PlayerCardsRow[]) => (
    data.length === 0 ? (
      <div className="rounded-xl border border-dashed border-border py-8 text-center">
        <p className="text-sm text-muted-foreground">Nog geen kaarten uitgedeeld.</p>
      </div>
    ) : (
      <div className="rounded-xl border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Speler</TableHead>
              <TableHead className="text-xs">Team</TableHead>
              <TableHead className="w-12 text-center text-xs"><YellowIcon /></TableHead>
              <TableHead className="w-12 text-center text-xs"><SecondYellowIcon /></TableHead>
              <TableHead className="w-12 text-center text-xs"><RedIcon /></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row) => (
              <TableRow key={`${row.name}-${row.teamId}`}>
                <TableCell className="text-sm font-medium text-foreground">{row.name}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5">
                    {teamLogo(row.teamId) && <img src={teamLogo(row.teamId)!} className="h-4 w-4 object-contain" alt="" />}
                    <span className="text-xs text-muted-foreground">{teamName(row.teamId)}</span>
                  </div>
                </TableCell>
                <TableCell className="text-center text-sm tabular-nums">{row.yellows}</TableCell>
                <TableCell className="text-center text-sm tabular-nums">{row.secondYellows}</TableCell>
                <TableCell className="text-center text-sm tabular-nums">{row.reds}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    )
  );

  return (
    <div className="space-y-6 w-full">
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

      {activeTab === "scorers" && showGoals && renderPlayerTable(goals, "Doelpunten")}
      {activeTab === "assists" && showAssists && renderPlayerTable(assists, "Assists")}
      {activeTab === "fairplay" && showFairplay && renderFairplayTable(fairplay)}
      {activeTab === "cards" && showFairplay && renderCardsTable(playerCards)}
    </div>
  );
};

export default StatisticsView;
