import { useState, useEffect } from "react";
import { formatFieldLabel } from "@/lib/fieldLocations";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import MatchStatsEditor from "./MatchStatsEditor";

interface MatchInfo {
  id: string;
  match_name: string | null;
  home_team_id: string | null;
  away_team_id: string | null;
  home_score: number | null;
  away_score: number | null;
  home_penalties: number | null;
  away_penalties: number | null;
  match_date: string | null;
  match_time: string | null;
  field: string | null;
  referee: string | null;
  is_played: boolean;
  phase_name?: string | null;
  format_name?: string | null;
  group_name?: string | null;
  round_number?: number | null;
}

interface Tournament {
  id: string;
  enable_goalscorers: boolean;
  enable_assists: boolean;
  enable_yellow_cards: boolean;
  enable_red_cards: boolean;
}

interface Team {
  id: string;
  name: string;
  logo_url: string | null;
}

interface MatchDetailDialogProps {
  open: boolean;
  onClose: () => void;
  match: MatchInfo | null;
  tournament: Tournament;
  teams: Team[];
  scoreEditable?: boolean;
  onScoreUpdate?: (matchId: string, homeScore: number | null, awayScore: number | null, homePen: number | null, awayPen: number | null) => void;
}

const MatchDetailDialog = ({ open, onClose, match, tournament, teams, scoreEditable = false }: MatchDetailDialogProps) => {
  const homeTeam = teams.find(t => t.id === match?.home_team_id);
  const awayTeam = teams.find(t => t.id === match?.away_team_id);

  const hasAnyStats = tournament.enable_goalscorers || tournament.enable_assists || tournament.enable_yellow_cards || tournament.enable_red_cards;

  if (!match) return null;

  const formatDate = (d: string | null) => {
    if (!d) return null;
    try {
      const date = new Date(d);
      return date.toLocaleDateString("nl-BE", { weekday: "short", day: "numeric", month: "short" });
    } catch { return d; }
  };

  const formatTime = (t: string | null) => {
    if (!t) return null;
    return t.substring(0, 5);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md max-h-[90dvh] overflow-y-auto overscroll-contain">
        <DialogHeader>
          <DialogTitle className="text-base font-bold">
            {match.match_name || "Wedstrijd"}
          </DialogTitle>
          <div className="flex flex-wrap gap-1.5 mt-1">
            {match.phase_name && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">{match.phase_name}</span>
            )}
            {match.format_name && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">{match.format_name}</span>
            )}
            {match.group_name && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">{match.group_name}</span>
            )}
          </div>
        </DialogHeader>

        <div className="rounded-lg border border-border bg-secondary/30 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 flex-1">
              {homeTeam?.logo_url && <img src={homeTeam.logo_url} className="h-8 w-8 object-contain" alt="" />}
              <span className="text-sm font-bold text-foreground">{homeTeam?.name || "TBD"}</span>
            </div>
            <div className="px-3 text-center">
              <span className="text-xl font-bold text-foreground tabular-nums">
                {match.home_score ?? "–"} - {match.away_score ?? "–"}
              </span>
              {match.home_penalties !== null && match.away_penalties !== null && (
                <div className="text-[10px] text-muted-foreground">
                  ({match.home_penalties} - {match.away_penalties} pen.)
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 flex-1 justify-end">
              <span className="text-sm font-bold text-foreground text-right">{awayTeam?.name || "TBD"}</span>
              {awayTeam?.logo_url && <img src={awayTeam.logo_url} className="h-8 w-8 object-contain" alt="" />}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {match.match_date && (
            <div className="flex items-center gap-2 rounded bg-secondary/30 px-3 py-2">
              <span className="text-xs text-foreground">{formatDate(match.match_date)}</span>
            </div>
          )}
          {match.match_time && (
            <div className="flex items-center gap-2 rounded bg-secondary/30 px-3 py-2">
              <span className="text-xs text-foreground">{formatTime(match.match_time)}</span>
            </div>
          )}
          {match.field && (
            <div className="flex items-center gap-2 rounded bg-secondary/30 px-3 py-2">
              <span className="text-xs text-foreground">{formatFieldLabel(match.field)}</span>
            </div>
          )}
          {match.referee && (
            <div className="flex items-center gap-2 rounded bg-secondary/30 px-3 py-2">
              <span className="text-xs text-foreground">{match.referee}</span>
            </div>
          )}
        </div>

        {hasAnyStats && match.home_team_id && match.away_team_id && (
          <MatchStatsEditor
            matchId={match.id}
            tournament={tournament}
            homeTeamId={match.home_team_id}
            awayTeamId={match.away_team_id}
            homeTeamName={homeTeam?.name || "Thuis"}
            awayTeamName={awayTeam?.name || "Uit"}
            homeTeamLogo={homeTeam?.logo_url || null}
            awayTeamLogo={awayTeam?.logo_url || null}
            homeScore={match.home_score}
            awayScore={match.away_score}
            editable={scoreEditable}
          />
        )}
      </DialogContent>
    </Dialog>
  );
};

export default MatchDetailDialog;
