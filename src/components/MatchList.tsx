import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { fetchTournamentMatches } from "@/lib/fetchTournamentMatches";
import { Input } from "@/components/ui/input";
import { TimePicker } from "@/components/ui/timepicker";
import { DatePicker } from "@/components/ui/datepicker";
import { useToast } from "@/hooks/use-toast";
import { Plus, Save, Zap, Trash2 } from "lucide-react";
import { generateRoundRobin } from "@/lib/matchGenerator";

interface Match {
  id: string;
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
  phase_id: string;
  group_id: string | null;
  round_number: number | null;
}

interface Team {
  id: string;
  name: string;
}

interface Phase {
  id: string;
  name: string;
  phase_type: string;
}

interface Group {
  id: string;
  name: string;
  phase_id: string;
}

interface GroupTeamEntry {
  group_id: string;
  team_id: string;
}

const MatchList = ({ tournamentId }: { tournamentId: string }) => {
  const [matches, setMatches] = useState<Match[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [phases, setPhases] = useState<Phase[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [groupTeams, setGroupTeams] = useState<GroupTeamEntry[]>([]);
  const [selectedPhase, setSelectedPhase] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, [tournamentId]);

  const fetchData = async () => {
    const [matchesRes, teamsRes, phasesRes, groupsRes, gtRes] = await Promise.all([
      fetchTournamentMatches({
        tournamentId,
        orders: [
          { column: "round_number" },
          { column: "created_at" },
        ],
        maxRows: 5000,
      }),
      supabase.from("teams").select("id, name").eq("tournament_id", tournamentId),
      supabase.from("tournament_phases").select("id, name, phase_type").eq("tournament_id", tournamentId).order("phase_number"),
      supabase.from("groups").select("id, name, phase_id").eq("tournament_id", tournamentId),
      supabase.from("group_teams").select("group_id, team_id").eq("tournament_id", tournamentId),
    ]);
    setMatches(matchesRes as any);
    if (teamsRes.data) setTeams(teamsRes.data);
    if (phasesRes.data) {
      setPhases(phasesRes.data);
      if (phasesRes.data.length > 0 && !selectedPhase) setSelectedPhase(phasesRes.data[0].id);
    }
    if (groupsRes.data) setGroups(groupsRes.data);
    if (gtRes.data) setGroupTeams(gtRes.data);
    setLoading(false);
  };

  const generateMatches = async (singleLeg: boolean) => {
    if (!selectedPhase) return;
    const phase = phases.find(p => p.id === selectedPhase);
    if (!phase) return;

    const phaseGroups = groups.filter(g => g.phase_id === selectedPhase);
    const matchesToInsert: any[] = [];

    if (phase.phase_type === "group" && phaseGroups.length > 0) {
      // Per group
      for (const group of phaseGroups) {
        const gTeamIds = groupTeams.filter(gt => gt.group_id === group.id).map(gt => gt.team_id);
        const gTeams = teams.filter(t => gTeamIds.includes(t.id));
        if (gTeams.length < 2) continue;

        const matchType = singleLeg ? "single_leg" : "home_away";
        const pairings = generateRoundRobin(gTeams.length, matchType);

        for (const p of pairings) {
          matchesToInsert.push({
            tournament_id: tournamentId,
            phase_id: selectedPhase,
            group_id: group.id,
            home_team_id: gTeams[p.homeIdx].id,
            away_team_id: gTeams[p.awayIdx].id,
            round_number: p.round,
          });
        }
      }
    } else {
      // Round robin - all teams
      let phaseTeams = teams;
      if (phaseTeams.length < 2) {
        toast({ title: "Minimaal 2 teams nodig", variant: "destructive" });
        return;
      }

      const matchType = singleLeg ? "single_leg" : "home_away";
      const pairings = generateRoundRobin(phaseTeams.length, matchType);

      for (const p of pairings) {
        matchesToInsert.push({
          tournament_id: tournamentId,
          phase_id: selectedPhase,
          home_team_id: phaseTeams[p.homeIdx].id,
          away_team_id: phaseTeams[p.awayIdx].id,
          round_number: p.round,
        });
      }
    }

    if (matchesToInsert.length === 0) {
      toast({ title: "Geen wedstrijden te genereren", variant: "destructive" });
      return;
    }

    const { data, error } = await supabase.from("matches").insert(matchesToInsert).select("*");
    if (error) {
      toast({ title: "Fout", description: error.message, variant: "destructive" });
    } else if (data) {
      setMatches((m) => [...m, ...data]);
      toast({ title: `${data.length} wedstrijden gegenereerd!` });
    }
  };

  const addMatch = async () => {
    if (!selectedPhase) {
      toast({ title: "Selecteer eerst een fase", variant: "destructive" });
      return;
    }
    const { data, error } = await supabase
      .from("matches")
      .insert({ tournament_id: tournamentId, phase_id: selectedPhase })
      .select("*")
      .single();
    if (data) setMatches((m) => [...m, data]);
  };

  const updateMatch = async (matchId: string, updates: Partial<Match>) => {
    const { error } = await supabase.from("matches").update(updates).eq("id", matchId);
    if (!error) {
      setMatches((m) => m.map((x) => (x.id === matchId ? { ...x, ...updates } : x)));
    }
  };

  const deleteMatch = async (matchId: string) => {
    await supabase.from("matches").delete().eq("id", matchId);
    setMatches((m) => m.filter((x) => x.id !== matchId));
  };

  const saveScore = async (match: Match) => {
    await updateMatch(match.id, {
      home_score: match.home_score,
      away_score: match.away_score,
      home_penalties: match.home_penalties,
      away_penalties: match.away_penalties,
      is_played: match.home_score !== null && match.away_score !== null,
    });
    toast({ title: "Score opgeslagen" });
  };

  const teamName = (id: string | null) => teams.find((t) => t.id === id)?.name || "–";

  const phaseMatches = matches.filter((m) => m.phase_id === selectedPhase);
  const currentPhase = phases.find(p => p.id === selectedPhase);

  if (loading) return <div className="flex justify-center py-8"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;

  return (
    <div className="space-y-4">
      {/* Phase selector */}
      <div className="flex gap-2 items-center flex-wrap">
        <select
          value={selectedPhase}
          onChange={(e) => setSelectedPhase(e.target.value)}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm flex-1 min-w-[200px]"
        >
          {phases.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <Button variant="outline" onClick={addMatch}><Plus className="h-4 w-4" /> Wedstrijd</Button>
        {currentPhase && (currentPhase.phase_type === "round_robin" || currentPhase.phase_type === "group") && (
          <>
            <Button variant="outline" onClick={() => generateMatches(true)}>
              <Zap className="h-4 w-4" /> Single
            </Button>
            <Button variant="outline" onClick={() => generateMatches(false)}>
              <Zap className="h-4 w-4" /> Heen en terug
            </Button>
          </>
        )}
      </div>

      {/* Match cards */}
      {phaseMatches.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-12 text-center">
          <p className="text-muted-foreground">Nog geen wedstrijden in deze fase</p>
        </div>
      ) : (
        <div className="space-y-3">
          {phaseMatches.map((match) => (
                  <div key={match.id} className="rounded-lg border border-border bg-card p-4 space-y-3">
                    <div className="grid grid-cols-3 gap-2 items-center">
                      <select
                        value={match.home_team_id || ""}
                        onChange={(e) => updateMatch(match.id, { home_team_id: e.target.value || null })}
                        className="h-9 rounded border border-input bg-background px-2 text-sm"
                      >
                        <option value="">Thuisteam</option>
                        {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                      <div className="flex items-center justify-center gap-1">
                        <Input
                          type="number" min={0}
                          value={match.home_score ?? ""}
                          onChange={(e) => setMatches((m) => m.map((x) => x.id === match.id ? { ...x, home_score: e.target.value === "" ? null : parseInt(e.target.value) } : x))}
                          className="h-9 w-14 text-center" placeholder="-"
                        />
                        <span className="text-muted-foreground font-bold">:</span>
                        <Input
                          type="number" min={0}
                          value={match.away_score ?? ""}
                          onChange={(e) => setMatches((m) => m.map((x) => x.id === match.id ? { ...x, away_score: e.target.value === "" ? null : parseInt(e.target.value) } : x))}
                          className="h-9 w-14 text-center" placeholder="-"
                        />
                      </div>
                      <select
                        value={match.away_team_id || ""}
                        onChange={(e) => updateMatch(match.id, { away_team_id: e.target.value || null })}
                        className="h-9 rounded border border-input bg-background px-2 text-sm"
                      >
                        <option value="">Uitteam</option>
                        {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      <DatePicker value={match.match_date || ""} onChange={(date) => updateMatch(match.id, { match_date: date || null })} placeholder="dd/mm/jjjj" className="h-8 text-xs" />
                      <TimePicker value={match.match_time || ""} onChange={(v) => updateMatch(match.id, { match_time: v || null })} className="h-8 text-xs" />
                      <Input value={match.field || ""} onChange={(e) => updateMatch(match.id, { field: e.target.value || null })} placeholder="Veld" className="h-8 text-xs" />
                      <Input value={match.referee || ""} onChange={(e) => updateMatch(match.id, { referee: e.target.value || null })} placeholder="Scheidsrechter" className="h-8 text-xs" />
                    </div>
                    <div className="flex justify-between">
                      <button onClick={() => deleteMatch(match.id)} className="text-xs text-muted-foreground hover:text-destructive transition-colors">
                        <Trash2 className="h-3 w-3" />
                      </button>
                      <Button size="sm" variant="outline" onClick={() => saveScore(match)}>
                        <Save className="h-3 w-3" /> Opslaan
                      </Button>
                    </div>
                  </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MatchList;
