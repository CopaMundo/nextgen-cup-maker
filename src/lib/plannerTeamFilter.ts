export function filterPlannerMatchesByTeam<T extends { home_team_id: string | null; away_team_id: string | null }>(matches: readonly T[], teamId: string): T[] {
  return matches.filter(match => teamId === "all" || match.home_team_id === teamId || match.away_team_id === teamId);
}