import { useState, useEffect } from "react";
import { getPhaseLabel } from "@/lib/phaseLabel";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fetchTournamentMatches } from "@/lib/fetchTournamentMatches";
import CountryFlag from "@/components/CountryFlag";
import { calculateGroupStandings, type ScoringSystem } from "@/lib/standingsCalculator";
import { isSetsGroup, computeSetPointTotals, formatSigned, resolveStandingsColumns } from "@/lib/standingsDisplay";

interface Team {
  id: string;
  name: string;
  logo_url: string | null;
  country: string | null;
}

interface Match {
  home_team_id: string | null;
  away_team_id: string | null;
  home_score: number | null;
  away_score: number | null;
  is_played: boolean;
  group_id: string | null;
  phase_id: string;
  scoring_system_id?: string | null;
  set_scores?: { home: number | null; away: number | null }[] | null;
}

interface GroupTeamEntry {
  group_id: string;
  team_id: string;
  bonus_points: number;
  fairplay_points?: number;
}

interface Group {
  id: string;
  name: string;
  phase_id: string;
  scoring_system_id?: string | null;
}

interface Phase {
  id: string;
  name: string;
  phase_number: number;
  phase_type: string;
  emoji?: string | null;
  scoring_system_id?: string | null;
}

interface StandingColor {
  id: string;
  position_from: number;
  position_to: number;
  color: string;
  label: string | null;
  phase_id: string | null;
}

interface StandingRow {
  pos: number;
  team: Team;
  gp: number;
  w: number;
  d: number;
  l: number;
  gf: number;
  ga: number;
  gd: number;
  pts: number;
  bonus: number;
  fairplay: number;
  needsDrawingLots?: boolean;
}

const StandingsTable = ({ tournamentId, tournament, categoryId }: { tournamentId: string; tournament: any; categoryId?: string | null }) => {
  const [phases, setPhases] = useState<Phase[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [groupTeams, setGroupTeams] = useState<GroupTeamEntry[]>([]);
  const [standingColors, setStandingColors] = useState<StandingColor[]>([]);
  const [scoringSystems, setScoringSystems] = useState<ScoringSystem[]>([]);
  const [selectedPhaseNumber, setSelectedPhaseNumber] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAll();
  }, [tournamentId, categoryId]);

  const fetchAll = async () => {
    let phaseQuery = supabase.from("tournament_phases").select("id, name, phase_number, phase_type, emoji, scoring_system_id").eq("tournament_id", tournamentId).order("phase_number").order("sort_order");
    if (categoryId) phaseQuery = phaseQuery.eq("category_id", categoryId);
    const [pRes, gRes, tRes, mRes, gtRes, scRes, ssRes] = await Promise.all([
      phaseQuery,
      supabase.from("groups").select("*").eq("tournament_id", tournamentId),
      supabase.from("teams").select("*").eq("tournament_id", tournamentId),
      fetchTournamentMatches({ tournamentId, maxRows: 5000 }),
      supabase.from("group_teams").select("*").eq("tournament_id", tournamentId),
      supabase.from("standing_colors").select("*").eq("tournament_id", tournamentId),
      supabase.from("tournament_scoring_systems" as any).select("id, scoring_type, num_sets, set_points_mode, set_result_points, points_win, points_draw, points_loss, points_big_win, big_win_threshold, points_win_overtime, points_draw_with_goals, points_draw_no_goals, points_loss_overtime, no_draws, tiebreaker_rules").eq("tournament_id", tournamentId),
    ]);
    if (pRes.data) {
      setPhases(pRes.data as any);
      // Find first phase_number that has group/round_robin formats
      const standingPhases = pRes.data.filter(p => p.phase_type === "group" || p.phase_type === "round_robin");
      if (standingPhases.length > 0 && selectedPhaseNumber === null) {
        setSelectedPhaseNumber(standingPhases[0].phase_number);
      }
    }
    if (gRes.data) setGroups(gRes.data as any);
    if (tRes.data) setTeams(tRes.data);
    setMatches(mRes as any);
    if (gtRes.data) setGroupTeams(gtRes.data);
    if (scRes.data) setStandingColors(scRes.data);
    if (ssRes.data) setScoringSystems(ssRes.data as any);
    setLoading(false);
  };

  const calcStandings = (groupId: string): StandingRow[] => {
    const rows = calculateGroupStandings(
      groupId,
      groupTeams,
      matches,
      groups,
      phases,
      scoringSystems,
      tournament,
    );
    return rows.map((r) => ({
      ...r,
      team:
        teams.find((t) => t.id === r.teamId) ||
        ({ id: r.teamId, name: "Onbekend", logo_url: null, country: null } as Team),
    }));
  };

  const getColorForPosition = (phaseId: string, pos: number) => {
    return standingColors.find(
      (sc) => sc.phase_id === phaseId && pos >= sc.position_from && pos <= sc.position_to
    );
  };

  const getPhaseColors = (phaseId: string) =>
    standingColors.filter((sc) => sc.phase_id === phaseId).sort((a, b) => a.position_from - b.position_from);

  const showCountry = tournament?.show_country;

  // Only show phases that have group or round_robin type (no knockout/single_match)
  const standingPhaseNumbers = [...new Set(
    phases.filter(p => p.phase_type === "group" || p.phase_type === "round_robin").map(p => p.phase_number)
  )].sort((a, b) => a - b);

  // Get all group/round_robin formats in the selected phase number
  const selectedFormats = phases.filter(
    p => p.phase_number === selectedPhaseNumber && (p.phase_type === "group" || p.phase_type === "round_robin")
  );

  if (loading) return <div className="flex justify-center py-8"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;

  if (standingPhaseNumbers.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border py-12 text-center">
        <p className="text-muted-foreground">Geen groepsfase of round robin fases gevonden voor klassement.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Phase number tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {standingPhaseNumbers.map(pn => (
          <button
            key={pn}
            onClick={() => setSelectedPhaseNumber(pn)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              selectedPhaseNumber === pn ? "bg-foreground text-background" : "bg-secondary text-foreground hover:bg-secondary/80"
            }`}
          >
            {getPhaseLabel(pn, phases)}
          </button>
        ))}
      </div>

      {selectedFormats.map(format => {
        const formatGroups = groups.filter(g => g.phase_id === format.id);
        return (
          <div key={format.id} className="space-y-4">
            {selectedFormats.length > 1 && (
              <h3 className="font-display text-sm font-bold text-foreground">
                {format.emoji ? `${format.emoji} ` : ""}{format.name}
              </h3>
            )}
            {formatGroups.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border py-8 text-center">
                <p className="text-muted-foreground text-sm">Geen groepen in dit format</p>
              </div>
            ) : (
              formatGroups.map((group) => {
                const standings = calcStandings(group.id);
                const colors = getPhaseColors(format.id);
                const setsMode = isSetsGroup(group.id, groups as any, phases as any, scoringSystems as any);
                const setPts = setsMode ? computeSetPointTotals(group.id, matches as any) : null;
                const cols = resolveStandingsColumns(tournament?.standings_columns);
                const pc = cols.points;
                const sc = cols.sets;
                return (
                  <div key={group.id} className="rounded-xl border border-border overflow-hidden">
                    <div className="bg-secondary px-4 py-2">
                      <h3 className="font-display font-bold text-foreground">{group.name}</h3>
                    </div>
                    <Table className="text-xs">
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-8 px-1">#</TableHead>
                          <TableHead className="px-1">Team</TableHead>
                          {setsMode ? (
                            <>
                              {sc.gp && <TableHead className="w-7 text-center px-0.5">GS</TableHead>}
                              {sc.w  && <TableHead className="w-7 text-center px-0.5">W</TableHead>}
                              {sc.d  && <TableHead className="w-7 text-center px-0.5">G</TableHead>}
                              {sc.l  && <TableHead className="w-7 text-center px-0.5">V</TableHead>}
                              {sc.sf && <TableHead className="w-7 text-center px-0.5">S+</TableHead>}
                              {sc.sa && <TableHead className="w-7 text-center px-0.5">S-</TableHead>}
                              {sc.sd && <TableHead className="w-9 text-center px-0.5">S+/-</TableHead>}
                              {sc.pf && <TableHead className="w-9 text-center px-0.5">P/S+</TableHead>}
                              {sc.pa && <TableHead className="w-9 text-center px-0.5">P/S-</TableHead>}
                              {sc.pd && <TableHead className="w-10 text-center px-0.5">P/S+/-</TableHead>}
                            </>
                          ) : (
                            <>
                              {pc.gp && <TableHead className="w-7 text-center px-0.5">GS</TableHead>}
                              {pc.w  && <TableHead className="w-7 text-center px-0.5">W</TableHead>}
                              {pc.d  && <TableHead className="w-7 text-center px-0.5">G</TableHead>}
                              {pc.l  && <TableHead className="w-7 text-center px-0.5">V</TableHead>}
                              {pc.gf && <TableHead className="w-7 text-center px-0.5">+</TableHead>}
                              {pc.ga && <TableHead className="w-7 text-center px-0.5">-</TableHead>}
                              {pc.gd && <TableHead className="w-9 text-center px-0.5">+/-</TableHead>}
                            </>
                          )}
                          <TableHead className="w-8 text-center px-0.5 font-bold">P</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {standings.map((row) => {
                          const colorZone = getColorForPosition(format.id, row.pos);
                          const sp = setPts?.get(row.team.id) || { pf: 0, pa: 0 };
                          return (
                            <TableRow key={row.team.id}>
                              <TableCell className="px-1 py-1">
                                <div className="flex items-center gap-1">
                                  {colorZone && (
                                    <div
                                      className="w-1 h-4 rounded-full flex-shrink-0"
                                      style={{ backgroundColor: colorZone.color }}
                                    />
                                  )}
                                  <span className="font-bold text-muted-foreground text-xs">{row.pos}</span>
                                </div>
                              </TableCell>
                              <TableCell className="px-1 py-1 whitespace-nowrap">
                                <div className="flex items-center gap-1 w-fit">
                                  <div className="h-5 w-5 overflow-hidden rounded bg-secondary flex-shrink-0">
                                    {row.team.logo_url ? (
                                      <img src={row.team.logo_url} alt="" className="h-full w-full object-contain" />
                                    ) : (
                                      <div className="flex h-full w-full items-center justify-center text-[9px] font-bold text-muted-foreground">
                                        {row.team.name.charAt(0)}
                                      </div>
                                    )}
                                  </div>
                                  <span className="font-medium text-foreground text-xs">
                                    {row.team.name}
                                  </span>
                                  {showCountry && row.team.country && (
                                    <CountryFlag country={row.team.country} className="h-3 w-4 object-contain flex-shrink-0 align-middle" />
                                  )}
                                </div>
                              </TableCell>
                              {setsMode ? (
                                <>
                                  {sc.gp && <TableCell className="text-center px-0.5 py-1 text-xs">{row.gp}</TableCell>}
                                  {sc.w  && <TableCell className="text-center px-0.5 py-1 text-xs">{row.w}</TableCell>}
                                  {sc.d  && <TableCell className="text-center px-0.5 py-1 text-xs">{row.d}</TableCell>}
                                  {sc.l  && <TableCell className="text-center px-0.5 py-1 text-xs">{row.l}</TableCell>}
                                  {sc.sf && <TableCell className="text-center px-0.5 py-1 text-xs">{row.gf}</TableCell>}
                                  {sc.sa && <TableCell className="text-center px-0.5 py-1 text-xs">{row.ga}</TableCell>}
                                  {sc.sd && <TableCell className="text-center px-0.5 py-1 text-xs font-medium">{formatSigned(row.gd)}</TableCell>}
                                  {sc.pf && <TableCell className="text-center px-0.5 py-1 text-xs">{sp.pf}</TableCell>}
                                  {sc.pa && <TableCell className="text-center px-0.5 py-1 text-xs">{sp.pa}</TableCell>}
                                  {sc.pd && <TableCell className="text-center px-0.5 py-1 text-xs font-medium">{formatSigned(sp.pf - sp.pa)}</TableCell>}
                                </>
                              ) : (
                                <>
                                  {pc.gp && <TableCell className="text-center px-0.5 py-1 text-xs">{row.gp}</TableCell>}
                                  {pc.w  && <TableCell className="text-center px-0.5 py-1 text-xs">{row.w}</TableCell>}
                                  {pc.d  && <TableCell className="text-center px-0.5 py-1 text-xs">{row.d}</TableCell>}
                                  {pc.l  && <TableCell className="text-center px-0.5 py-1 text-xs">{row.l}</TableCell>}
                                  {pc.gf && <TableCell className="text-center px-0.5 py-1 text-xs">{formatSigned(row.gf)}</TableCell>}
                                  {pc.ga && <TableCell className="text-center px-0.5 py-1 text-xs">-{row.ga}</TableCell>}
                                  {pc.gd && <TableCell className="text-center px-0.5 py-1 text-xs font-medium">{formatSigned(row.gd)}</TableCell>}
                                </>
                              )}
                              <TableCell className="text-center px-0.5 py-1">
                                <span className="font-bold text-foreground text-xs">{row.pts}</span>
                                {row.bonus > 0 && (
                                  <span className="ml-0.5 text-[9px] font-semibold text-primary align-super">+{row.bonus}</span>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                    {colors.length > 0 && (
                      <div className="border-t border-border px-4 py-2 flex flex-wrap gap-3">
                        {colors.map((c) => (
                          <div key={c.id} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: c.color }} />
                            <span>{c.label || `Positie ${c.position_from}–${c.position_to}`}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        );
      })}
    </div>
  );
};

export default StandingsTable;
