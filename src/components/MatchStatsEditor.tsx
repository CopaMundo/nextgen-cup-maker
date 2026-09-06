import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2 } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Player {
  id: string;
  first_name: string;
  last_name: string;
  shirt_number: number | null;
  team_id: string;
}

export interface MatchStat {
  id: string;
  match_id: string;
  stat_type: "goal" | "assist" | "yellow_card" | "red_card" | "straight_red";
  player_name: string;
  team_id: string;
  // we abuse 'minute' to store ordering: for goals/assists this is the global goal index (0..N-1)
  minute: number | null;
}

interface Tournament {
  id: string;
  enable_goalscorers: boolean;
  enable_assists: boolean;
  enable_yellow_cards: boolean;
  enable_red_cards: boolean;
}

interface Props {
  matchId: string;
  tournament: Tournament;
  homeTeamId: string | null;
  awayTeamId: string | null;
  homeTeamName: string;
  awayTeamName: string;
  homeTeamLogo: string | null;
  awayTeamLogo: string | null;
  homeScore: number | null;
  awayScore: number | null;
  editable: boolean;
}

const NO_PLAYER = "__none__";
const PLACEHOLDER_NAME = "Onbekend";

const MatchStatsEditor = ({
  matchId, tournament, homeTeamId, awayTeamId,
  homeTeamName, awayTeamName, homeTeamLogo, awayTeamLogo,
  homeScore, awayScore, editable,
}: Props) => {
  const [players, setPlayers] = useState<Player[]>([]);
  const [stats, setStats] = useState<MatchStat[]>([]);
  const [deleteStatId, setDeleteStatId] = useState<string | null>(null);
  const { toast } = useToast();

  const hasAnyStats = tournament.enable_goalscorers || tournament.enable_assists || tournament.enable_yellow_cards || tournament.enable_red_cards;

  useEffect(() => {
    const teamIds = [homeTeamId, awayTeamId].filter(Boolean) as string[];
    if (teamIds.length === 0) return;
    Promise.all([
      supabase.from("players").select("id, first_name, last_name, shirt_number, team_id").in("team_id", teamIds),
      supabase.from("match_stats").select("id, match_id, stat_type, player_name, team_id, minute").eq("match_id", matchId),
    ]).then(([pRes, sRes]) => {
      if (pRes.data) setPlayers(pRes.data);
      if (sRes.data) setStats(sRes.data as MatchStat[]);
    });
  }, [matchId, homeTeamId, awayTeamId]);

  if (!hasAnyStats || !homeTeamId || !awayTeamId) return null;

  const homePlayers = players.filter(p => p.team_id === homeTeamId).sort((a, b) => (a.shirt_number ?? 99) - (b.shirt_number ?? 99));
  const awayPlayers = players.filter(p => p.team_id === awayTeamId).sort((a, b) => (a.shirt_number ?? 99) - (b.shirt_number ?? 99));

  // ---- Goals ----
  const totalGoals = (homeScore ?? 0) + (awayScore ?? 0);
  const goalsAll = stats
    .filter(s => s.stat_type === "goal")
    .sort((a, b) => (a.minute ?? 0) - (b.minute ?? 0));
  const assistsAll = stats.filter(s => s.stat_type === "assist");

  const yellows = stats.filter(s => s.stat_type === "yellow_card");
  const reds = stats.filter(s => s.stat_type === "red_card" || s.stat_type === "straight_red");

  // Build running score per goal index using assigned team (in order of pair_index)
  // Only set a score when this specific goal has a team assigned; otherwise leave null.
  const runningScores: ({ home: number; away: number } | null)[] = [];
  let h = 0, a = 0;
  for (let i = 0; i < Math.max(totalGoals, goalsAll.length); i++) {
    const g = goalsAll.find(x => (x.minute ?? -1) === i);
    if (g && (g.team_id === homeTeamId || g.team_id === awayTeamId)) {
      if (g.team_id === homeTeamId) h++;
      else a++;
      runningScores.push({ home: h, away: a });
    } else {
      runningScores.push(null);
    }
  }

  const insertStat = async (payload: {
    teamId: string;
    statType: MatchStat["stat_type"];
    playerName: string;
    minute: number | null;
  }) => {
    const { data, error } = await supabase.from("match_stats").insert({
      match_id: matchId,
      tournament_id: tournament.id,
      team_id: payload.teamId,
      stat_type: payload.statType,
      player_name: payload.playerName,
      minute: payload.minute,
    }).select("id, match_id, stat_type, player_name, team_id, minute").single();

    if (error) {
      toast({ title: "Fout", description: error.message, variant: "destructive" });
      return null;
    }
    if (data) {
      setStats(prev => [...prev, data as MatchStat]);
      return data as MatchStat;
    }
    return null;
  };

  const updateStat = async (id: string, fields: Partial<Pick<MatchStat, "team_id" | "player_name">>) => {
    const { error } = await supabase.from("match_stats").update(fields).eq("id", id);
    if (error) {
      toast({ title: "Fout", description: error.message, variant: "destructive" });
      return;
    }
    setStats(prev => prev.map(s => s.id === id ? { ...s, ...fields } : s));
  };

  const removeStatById = async (id: string) => {
    await supabase.from("match_stats").delete().eq("id", id);
    setStats(prev => prev.filter(s => s.id !== id));
  };

  const confirmRemoveStat = async () => {
    if (!deleteStatId) return;
    await removeStatById(deleteStatId);
    setDeleteStatId(null);
  };

  // Goal row handlers
  const handleGoalTeamChange = async (idx: number, teamId: string) => {
    const existing = goalsAll.find(g => (g.minute ?? -1) === idx);
    if (existing) {
      // team change resets player + assist
      await updateStat(existing.id, { team_id: teamId, player_name: PLACEHOLDER_NAME });
      const assist = assistsAll.find(asg => (asg.minute ?? -1) === idx);
      if (assist) await removeStatById(assist.id);
    } else {
      await insertStat({ teamId, statType: "goal", playerName: PLACEHOLDER_NAME, minute: idx });
    }
  };

  const handleGoalPlayerChange = async (idx: number, playerName: string) => {
    const existing = goalsAll.find(g => (g.minute ?? -1) === idx);
    if (!existing) return;
    await updateStat(existing.id, { player_name: playerName });
  };

  const handleAssistChange = async (idx: number, playerName: string) => {
    const goal = goalsAll.find(g => (g.minute ?? -1) === idx);
    if (!goal) return;
    const existing = assistsAll.find(asg => (asg.minute ?? -1) === idx);
    if (playerName === NO_PLAYER) {
      if (existing) await removeStatById(existing.id);
      return;
    }
    if (existing) {
      await updateStat(existing.id, { player_name: playerName });
    } else {
      await insertStat({ teamId: goal.team_id, statType: "assist", playerName, minute: idx });
    }
  };

  const handleRemoveGoal = async (idx: number) => {
    const goal = goalsAll.find(g => (g.minute ?? -1) === idx);
    const assist = assistsAll.find(asg => (asg.minute ?? -1) === idx);
    if (assist) await removeStatById(assist.id);
    if (goal) await removeStatById(goal.id);
  };

  // Cards
  const sentOff = (teamId: string) => {
    const set = new Set<string>();
    const teamPlayers = teamId === homeTeamId ? homePlayers : awayPlayers;
    teamPlayers.forEach(p => {
      const fullName = `${p.first_name} ${p.last_name}`;
      const y = yellows.filter(s => s.team_id === teamId && s.player_name === fullName).length;
      const r = reds.filter(s => s.team_id === teamId && s.player_name === fullName).length;
      if (y >= 2 || r >= 1) set.add(fullName);
    });
    return set;
  };

  const renderTeamLogoName = (teamId: string | null | undefined, withName = true) => {
    if (teamId === homeTeamId) {
      return (
        <span className="flex items-center gap-1.5">
          {homeTeamLogo && <img src={homeTeamLogo} className="h-4 w-4 object-contain" alt="" />}
          {withName && <span className="truncate">{homeTeamName}</span>}
        </span>
      );
    }
    if (teamId === awayTeamId) {
      return (
        <span className="flex items-center gap-1.5">
          {awayTeamLogo && <img src={awayTeamLogo} className="h-4 w-4 object-contain" alt="" />}
          {withName && <span className="truncate">{awayTeamName}</span>}
        </span>
      );
    }
    return <span className="text-muted-foreground">Selecteer ploeg</span>;
  };

  // Determine which teams are still selectable for goal at idx based on remaining goal capacity.
  const goalTeamOptions = (idx: number) => {
    const homeGoalsAssigned = goalsAll.filter(g => g.team_id === homeTeamId && (g.minute ?? -1) !== idx).length;
    const awayGoalsAssigned = goalsAll.filter(g => g.team_id === awayTeamId && (g.minute ?? -1) !== idx).length;
    const homeCap = (homeScore ?? 0);
    const awayCap = (awayScore ?? 0);
    return {
      home: homeGoalsAssigned < homeCap,
      away: awayGoalsAssigned < awayCap,
    };
  };

  // For assists: exclude the goalscorer from options.
  const assistOptions = (teamPlayers: Player[], goalPlayerName: string | undefined | null) => {
    if (!goalPlayerName || goalPlayerName === PLACEHOLDER_NAME) return teamPlayers;
    return teamPlayers.filter(p => `${p.first_name} ${p.last_name}` !== goalPlayerName);
  };

  const renderGoalRow = (idx: number) => {
    const goal = goalsAll.find(g => (g.minute ?? -1) === idx);
    const assist = assistsAll.find(asg => (asg.minute ?? -1) === idx);
    const teamId = goal?.team_id;
    const teamPlayers = teamId === homeTeamId ? homePlayers : teamId === awayTeamId ? awayPlayers : [];
    const score = runningScores[idx];

    if (!editable) {
      if (!goal) return null;
      return (
        <div key={`g-${idx}`} className="flex items-center gap-2 rounded bg-secondary/50 px-2 py-1.5">
          <span className="text-[11px] font-bold tabular-nums text-muted-foreground w-10 shrink-0">
            {score ? `${score.home}-${score.away}` : ""}
          </span>
          <span className="shrink-0">{renderTeamLogoName(teamId, false)}</span>
          <span className="flex-1 text-xs text-foreground">
            {goal.player_name && goal.player_name !== PLACEHOLDER_NAME ? goal.player_name : <span className="text-muted-foreground italic">onbekend</span>}
            {tournament.enable_assists && assist && assist.player_name && (
              <span className="text-muted-foreground">{` (${assist.player_name.trim()})`}</span>
            )}
          </span>
        </div>
      );
    }

    const teamOpts = goalTeamOptions(idx);

    return (
      <div key={`g-${idx}`} className="rounded bg-secondary/30 p-2 space-y-1.5">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground w-16 shrink-0">
            Doelpunt {idx + 1}
          </span>
          <span className="text-[11px] font-bold tabular-nums text-foreground w-10 shrink-0">
            {score ? `${score.home}-${score.away}` : "—"}
          </span>
          <Select value={teamId ?? ""} onValueChange={(val) => handleGoalTeamChange(idx, val)}>
            <SelectTrigger className="h-7 text-[11px] flex-1 min-w-0">
              <SelectValue placeholder="Selecteer ploeg" />
            </SelectTrigger>
            <SelectContent>
              {(teamOpts.home || teamId === homeTeamId) && (
                <SelectItem value={homeTeamId}>
                  <span className="flex items-center gap-1.5">
                    {homeTeamLogo && <img src={homeTeamLogo} className="h-4 w-4 object-contain" alt="" />}
                    {homeTeamName}
                  </span>
                </SelectItem>
              )}
              {(teamOpts.away || teamId === awayTeamId) && (
                <SelectItem value={awayTeamId}>
                  <span className="flex items-center gap-1.5">
                    {awayTeamLogo && <img src={awayTeamLogo} className="h-4 w-4 object-contain" alt="" />}
                    {awayTeamName}
                  </span>
                </SelectItem>
              )}
            </SelectContent>
          </Select>
          {goal && (
            <button aria-label="Doelpunt verwijderen" onClick={() => setDeleteStatId(goal.id)} className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive sm:h-auto sm:w-auto sm:p-1">
              <Trash2 className="h-3 w-3" />
            </button>
          )}
        </div>

        {goal && tournament.enable_goalscorers && (
          <div className="flex items-center gap-1.5 pl-[72px]">
            <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground w-12 shrink-0">Speler</span>
            <Select
              value={goal.player_name === PLACEHOLDER_NAME ? "" : goal.player_name}
              onValueChange={(val) => handleGoalPlayerChange(idx, val)}
            >
              <SelectTrigger className="h-7 text-[11px] flex-1 min-w-0">
                <SelectValue placeholder="Selecteer speler (optioneel)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Eigen doelpunt">Eigen doelpunt</SelectItem>
                {teamPlayers.map(p => (
                  <SelectItem key={p.id} value={`${p.first_name} ${p.last_name}`}>
                    {p.shirt_number ? `#${p.shirt_number} ` : ""}{p.first_name} {p.last_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {goal && tournament.enable_assists && (
          <div className="flex items-center gap-1.5 pl-[72px]">
            <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground w-12 shrink-0">Assist</span>
            <Select
              value={assist?.player_name ?? ""}
              onValueChange={(val) => handleAssistChange(idx, val)}
            >
              <SelectTrigger className="h-7 text-[11px] flex-1 min-w-0">
                <SelectValue placeholder="Selecteer assistgever (optioneel)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_PLAYER}>Geen</SelectItem>
                {assistOptions(teamPlayers, goal.player_name).map(p => (
                  <SelectItem key={p.id} value={`${p.first_name} ${p.last_name}`}>
                    {p.shirt_number ? `#${p.shirt_number} ` : ""}{p.first_name} {p.last_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
    );
  };

  // For read-only display, merge a player's two yellows into a single "2x yellow → red" row
  // and skip duplicate red entries that result from a second yellow.
  type CardEntry =
    | { kind: "yellow"; stat: MatchStat }
    | { kind: "red"; stat: MatchStat }
    | { kind: "second_yellow"; stat: MatchStat; firstYellow: MatchStat };

  const buildCardEntries = (): CardEntry[] => {
    const sorted = [...yellows, ...reds].sort((a, b) => a.id.localeCompare(b.id));
    const entries: CardEntry[] = [];
    const seenSecondYellowKey = new Set<string>(); // team|player → already merged
    for (const s of sorted) {
      const key = `${s.team_id}|${s.player_name}`;
      if (s.stat_type === "yellow_card") {
        const sameTeamYellows = yellows
          .filter(y => y.team_id === s.team_id && y.player_name === s.player_name)
          .sort((a, b) => a.id.localeCompare(b.id));
        const isSecond = sameTeamYellows.length >= 2 && sameTeamYellows[1].id === s.id;
        if (isSecond && !seenSecondYellowKey.has(key)) {
          seenSecondYellowKey.add(key);
          entries.push({ kind: "second_yellow", stat: s, firstYellow: sameTeamYellows[0] });
        } else if (!isSecond) {
          entries.push({ kind: "yellow", stat: s });
        }
        // First yellow that is followed by a second is replaced by the merged entry → skip duplicate
      } else {
        entries.push({ kind: "red", stat: s });
      }
    }
    // Filter out the original first-yellow rows that were merged into a "second_yellow" entry
    return entries.filter(e => {
      if (e.kind !== "yellow") return true;
      const key = `${e.stat.team_id}|${e.stat.player_name}`;
      return !seenSecondYellowKey.has(key);
    });
  };

  const cardEntriesRO = buildCardEntries();

  // For editable mode keep a flat list (so users can delete each card individually).
  const cardsListEditable = [...yellows, ...reds].sort((a, b) => a.id.localeCompare(b.id));

  return (
    <>
      <div className="space-y-4 border-t border-border pt-3">
        {editable && (
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Statistieken</h4>
        )}

        {/* Goals */}
        {tournament.enable_goalscorers && totalGoals > 0 && (
          <div className="space-y-1.5">
            {Array.from({ length: totalGoals }).map((_, idx) => renderGoalRow(idx))}
          </div>
        )}

        {/* Cards */}
        {(tournament.enable_yellow_cards || tournament.enable_red_cards) && (
          <div className={`space-y-1.5 ${tournament.enable_goalscorers && totalGoals > 0 ? "pt-3 border-t border-border/60" : ""}`}>
            {!editable && cardEntriesRO.length > 0 && (
              <div className="space-y-1">
                {cardEntriesRO.map(entry => {
                  const stat = entry.stat;
                  return (
                    <div key={stat.id} className="flex items-center gap-2 rounded bg-secondary/50 px-2 py-1">
                      {entry.kind === "second_yellow" ? (
                        <span className="flex items-center gap-0.5">
                          <div className="h-3.5 w-2.5 rounded-sm bg-yellow-400" />
                          <div className="h-3.5 w-2.5 rounded-sm bg-yellow-400" />
                          <span className="text-muted-foreground">→</span>
                          <div className="h-3.5 w-2.5 rounded-sm bg-red-500" />
                        </span>
                      ) : entry.kind === "yellow" ? (
                        <div className="h-3.5 w-2.5 rounded-sm bg-yellow-400" />
                      ) : (
                        <div className="h-3.5 w-2.5 rounded-sm bg-red-500" />
                      )}
                      <span className="shrink-0 text-[11px]">{renderTeamLogoName(stat.team_id, false)}</span>
                      <span className="flex-1 text-xs text-foreground truncate">
                        {stat.player_name && stat.player_name !== PLACEHOLDER_NAME ? stat.player_name : <span className="text-muted-foreground italic">onbekend</span>}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {editable && cardsListEditable.length > 0 && (
              <div className="space-y-1">
                {cardsListEditable.map(stat => {
                  const isYellow = stat.stat_type === "yellow_card";
                  const sameTeamYellows = yellows
                    .filter(s => s.team_id === stat.team_id && s.player_name === stat.player_name)
                    .sort((a, b) => a.id.localeCompare(b.id));
                  const isFirstYellowOfTwo =
                    isYellow && sameTeamYellows.length >= 2 && sameTeamYellows[0].id === stat.id;
                  const isSecondYellow =
                    isYellow && sameTeamYellows.length >= 2 && sameTeamYellows[1].id === stat.id;
                  // Hide the first yellow when a second yellow exists — only show the merged "2x → red" row.
                  if (isFirstYellowOfTwo) return null;
                  return (
                    <div key={stat.id} className="flex items-center gap-2 rounded bg-secondary/50 px-2 py-1">
                      {isSecondYellow ? (
                        <span className="flex items-center gap-0.5">
                          <div className="h-3.5 w-2.5 rounded-sm bg-yellow-400" />
                          <div className="h-3.5 w-2.5 rounded-sm bg-yellow-400" />
                          <span className="text-muted-foreground">→</span>
                          <div className="h-3.5 w-2.5 rounded-sm bg-red-500" />
                        </span>
                      ) : isYellow ? (
                        <div className="h-3.5 w-2.5 rounded-sm bg-yellow-400" />
                      ) : (
                        <div className="h-3.5 w-2.5 rounded-sm bg-red-500" />
                      )}
                      <span className="shrink-0 text-[11px]">{renderTeamLogoName(stat.team_id, false)}</span>
                      <span className="flex-1 text-xs text-foreground truncate">
                        {stat.player_name && stat.player_name !== PLACEHOLDER_NAME ? stat.player_name : <span className="text-muted-foreground italic">onbekend</span>}
                      </span>
                      <button aria-label="Kaart verwijderen" onClick={() => setDeleteStatId(stat.id)} className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive sm:h-auto sm:w-auto sm:p-1">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {editable && (
              <div className="flex flex-col gap-1.5">
                {tournament.enable_yellow_cards && (
                  <AddCardRow
                    type="yellow_card"
                    label="Gele kaart"
                    homeTeamId={homeTeamId}
                    awayTeamId={awayTeamId}
                    homeTeamName={homeTeamName}
                    awayTeamName={awayTeamName}
                    homeTeamLogo={homeTeamLogo}
                    awayTeamLogo={awayTeamLogo}
                    homePlayers={homePlayers.filter(p => !sentOff(homeTeamId).has(`${p.first_name} ${p.last_name}`))}
                    awayPlayers={awayPlayers.filter(p => !sentOff(awayTeamId).has(`${p.first_name} ${p.last_name}`))}
                    onAdd={(teamId, name) => insertStat({ teamId, statType: "yellow_card", playerName: name, minute: null })}
                  />
                )}
                {tournament.enable_red_cards && (
                  <AddCardRow
                    type="red_card"
                    label="Directe rode kaart"
                    homeTeamId={homeTeamId}
                    awayTeamId={awayTeamId}
                    homeTeamName={homeTeamName}
                    awayTeamName={awayTeamName}
                    homeTeamLogo={homeTeamLogo}
                    awayTeamLogo={awayTeamLogo}
                    homePlayers={homePlayers.filter(p => !sentOff(homeTeamId).has(`${p.first_name} ${p.last_name}`))}
                    awayPlayers={awayPlayers.filter(p => !sentOff(awayTeamId).has(`${p.first_name} ${p.last_name}`))}
                    onAdd={(teamId, name) => insertStat({ teamId, statType: "straight_red", playerName: name, minute: null })}
                  />
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <AlertDialog open={!!deleteStatId} onOpenChange={(o) => !o && setDeleteStatId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Statistiek verwijderen?</AlertDialogTitle>
            <AlertDialogDescription>Weet je zeker dat je deze statistiek wilt verwijderen?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRemoveStat} className="bg-destructive text-destructive-foreground">Verwijderen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

const AddCardRow = ({
  type, label,
  homeTeamId, awayTeamId, homeTeamName, awayTeamName, homeTeamLogo, awayTeamLogo,
  homePlayers, awayPlayers, onAdd,
}: {
  type: "yellow_card" | "red_card";
  label: string;
  homeTeamId: string;
  awayTeamId: string;
  homeTeamName: string;
  awayTeamName: string;
  homeTeamLogo: string | null;
  awayTeamLogo: string | null;
  homePlayers: Player[];
  awayPlayers: Player[];
  onAdd: (teamId: string, playerName: string) => void;
}) => {
  const [teamId, setTeamId] = useState<string>("");
  const teamPlayers = teamId === homeTeamId ? homePlayers : teamId === awayTeamId ? awayPlayers : [];

  const handlePlayerSelect = (playerName: string) => {
    if (!teamId || !playerName) return;
    onAdd(teamId, playerName);
    // Reset so the next card can be entered
    setTeamId("");
  };

  return (
    <div className="flex items-center gap-1.5">
      <div className={`h-3 w-2 shrink-0 rounded-sm ${type === "yellow_card" ? "bg-yellow-400" : "bg-red-500"}`} />
      <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground w-16 shrink-0">{label}</span>
      <Select value={teamId} onValueChange={(v) => setTeamId(v)}>
        <SelectTrigger className="h-7 text-[11px] flex-1 min-w-0">
          <SelectValue placeholder="Ploeg" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={homeTeamId}>
            <span className="flex items-center gap-1.5">
              {homeTeamLogo && <img src={homeTeamLogo} className="h-4 w-4 object-contain" alt="" />}
              {homeTeamName}
            </span>
          </SelectItem>
          <SelectItem value={awayTeamId}>
            <span className="flex items-center gap-1.5">
              {awayTeamLogo && <img src={awayTeamLogo} className="h-4 w-4 object-contain" alt="" />}
              {awayTeamName}
            </span>
          </SelectItem>
        </SelectContent>
      </Select>
      <Select value="" onValueChange={handlePlayerSelect} disabled={!teamId}>
        <SelectTrigger className="h-7 text-[11px] flex-1 min-w-0">
          <SelectValue placeholder="Speler" />
        </SelectTrigger>
        <SelectContent>
          {teamPlayers.map(p => (
            <SelectItem key={p.id} value={`${p.first_name} ${p.last_name}`}>
              {p.shirt_number ? `#${p.shirt_number} ` : ""}{p.first_name} {p.last_name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

export default MatchStatsEditor;
