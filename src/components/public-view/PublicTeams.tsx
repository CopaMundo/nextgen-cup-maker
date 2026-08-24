import { useState } from "react";
import { ArrowLeft, User } from "lucide-react";
import CountryFlag from "@/components/CountryFlag";
import PublicMatchCard from "@/components/public-view/PublicMatchCard";
import type { PublicTournamentData } from "@/pages/PublicView";
import { useBroadcastStyle } from "@/contexts/BroadcastStyleContext";
import { ds , isSquareStyle } from "@/lib/broadcastStyles";
import { calculateGroupStandings } from "@/lib/standingsCalculator";

const POSITION_ORDER = ["goalkeeper", "defender", "midfielder", "attacker"];
const POSITION_LABELS: Record<string, string> = {
  goalkeeper: "Keepers",
  defender: "Verdedigers",
  midfielder: "Middenvelders",
  attacker: "Aanvallers",
};

const PublicTeams = ({ data, favoriteTeam }: { data: PublicTournamentData; favoriteTeam: string | null }) => {
  const { teams, players, staff, matches, stats, phases, groups, slots, tournament, groupTeams, scoringSystems } = data;
  const bStyle = useBroadcastStyle();
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
  const [teamTab, setTeamTab] = useState<"selectie" | "wedstrijden">("selectie");

  const team = selectedTeam ? teams.find((t: any) => t.id === selectedTeam) : null;

  if (team) {
    const teamPlayers = players.filter((p: any) => p.team_id === team.id);
    const teamStaff = staff.filter((s: any) => s.team_id === team.id);
    const teamMatches = matches.filter((m: any) => m.home_team_id === team.id || m.away_team_id === team.id);
    const hasPlayers = teamPlayers.length > 0 || teamStaff.length > 0;

    const played = teamMatches.filter((m: any) => m.is_played);
    let w = 0, d = 0, l = 0, gf = 0, ga = 0;
    played.forEach((m: any) => {
      if (m.home_team_id === team.id) {
        gf += m.home_score ?? 0; ga += m.away_score ?? 0;
        if ((m.home_score ?? 0) > (m.away_score ?? 0)) w++; else if (m.home_score === m.away_score) d++; else l++;
      } else {
        gf += m.away_score ?? 0; ga += m.home_score ?? 0;
        if ((m.away_score ?? 0) > (m.home_score ?? 0)) w++; else if (m.home_score === m.away_score) d++; else l++;
      }
    });

    const form = played.slice(-5).map((m: any) => {
      const isHome = m.home_team_id === team.id;
      const my = isHome ? m.home_score : m.away_score;
      const op = isHome ? m.away_score : m.home_score;
      if (my > op) return "W";
      if (my === op) return "G";
      return "V";
    });

    const playersByPosition: Record<string, any[]> = {};
    teamPlayers.forEach((p: any) => {
      const pos = p.position || "attacker";
      if (!playersByPosition[pos]) playersByPosition[pos] = [];
      playersByPosition[pos].push(p);
    });
    Object.values(playersByPosition).forEach(arr => arr.sort((a: any, b: any) => (a.last_name || "").localeCompare(b.last_name || "")));

    const findGroupInfo = () => {
      for (const g of groups) {
        const phase = phases.find((p: any) => p.id === g.phase_id);
        if (!phase || phase.phase_type === "knockout") continue;
        const gts = data.groupTeams.filter((gt: any) => gt.group_id === g.id);
        if (!gts.find((gt: any) => gt.team_id === team.id)) continue;
        const rows = calculateGroupStandings(
          g.id,
          groupTeams as any,
          matches as any,
          groups as any,
          phases as any,
          (scoringSystems || []) as any,
          tournament,
        );
        const pos = rows.findIndex((r: any) => r.teamId === team.id) + 1;
        if (pos > 0) return { groupName: g.name, pos };
      }
      return null;
    };

    const groupInfo = findGroupInfo();

    return (
      <div className="px-3 pt-4 space-y-4">
        <button onClick={() => setSelectedTeam(null)} className={ds(bStyle, "backButton")}>
          <ArrowLeft className="h-4 w-4" /> Alle teams
        </button>

        {/* Team header - broadcast style */}
        <div className="flex items-center gap-4">
          <div className={`h-16 w-16 overflow-hidden flex-shrink-0 border-2 border-primary/20 shadow-sm ${isSquareStyle(bStyle) ? "" : "rounded-xl"}`}>
            {team.logo_url ? <img src={team.logo_url} alt="" className="h-full w-full object-contain" /> :
              <div className="flex h-full w-full items-center justify-center bg-secondary text-2xl font-black text-muted-foreground">{team.name?.charAt(0)}</div>}
          </div>
          <div>
            <h2 className="font-display text-xl font-black text-foreground uppercase tracking-wide">{team.name}</h2>
            {team.country && <div className="flex items-center gap-1.5 mt-0.5"><CountryFlag country={team.country} /><span className="text-xs text-muted-foreground font-bold">{team.country}</span></div>}
          </div>
        </div>

        {team.team_photo_url && (
          <div className={`overflow-hidden border border-border shadow-sm ${isSquareStyle(bStyle) ? "" : "rounded-xl"}`}>
            <img src={team.team_photo_url} alt="" className="w-full object-cover" />
          </div>
        )}

        {/* Stats summary - broadcast cards */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: "GS", value: played.length },
            { label: "W-G-V", value: `${w}-${d}-${l}` },
            { label: "DV", value: gf },
            { label: "DT", value: ga },
          ].map(s => (
            <div key={s.label} className={`${ds(bStyle, "card")} p-3 text-center`}>
              <p className={`text-lg font-black ${ds(bStyle, "matchScoreWin")}`}>{s.value}</p>
              <p className="text-[8px] font-black text-muted-foreground uppercase tracking-wider">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Form + Position */}
        <div className="flex items-center gap-3">
          {form.length > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] font-black uppercase tracking-[0.15em] text-muted-foreground mr-1">Vorm</span>
              {form.map((r, i) => (
                <span key={i} className={`inline-flex h-5 w-5 items-center justify-center rounded text-[9px] font-black text-white ${
                  r === "W" ? "bg-emerald-500" : r === "G" ? "bg-gray-500" : "bg-red-500"
                }`}>{r}</span>
              ))}
            </div>
          )}
          {groupInfo && (
            <span className="text-[10px] font-bold text-muted-foreground">
              {groupInfo.groupName}: <span className="text-primary font-black">#{groupInfo.pos}</span>
            </span>
          )}
        </div>

        {/* Tabs */}
        {hasPlayers ? (
          <>
            <div className={ds(bStyle, "tabContainer")}>
              <button onClick={() => setTeamTab("selectie")}
                className={teamTab === "selectie" ? ds(bStyle, "tabActive") : ds(bStyle, "tabInactive")}>Selectie</button>
              <button onClick={() => setTeamTab("wedstrijden")}
                className={teamTab === "wedstrijden" ? ds(bStyle, "tabActive") : ds(bStyle, "tabInactive")}>Wedstrijden</button>
            </div>

            {teamTab === "selectie" && (
              <div className="space-y-4">
                {POSITION_ORDER.map(pos => {
                  const posPlayers = playersByPosition[pos];
                  if (!posPlayers || posPlayers.length === 0) return null;
                  return (
                    <div key={pos} className={ds(bStyle, "card")}>
                      <div className={ds(bStyle, "cardHeader")}>
                        <div className={ds(bStyle, "cardHeaderDot")} />
                        <h4 className={ds(bStyle, "cardHeaderTitle")}>{POSITION_LABELS[pos] || pos}</h4>
                      </div>
                      <div className="divide-y divide-border/50">
                        {posPlayers.map((p: any, i: number) => (
                          <div key={p.id} className={`flex items-center gap-3 px-4 py-2.5 ${i % 2 === 1 ? "bg-secondary/20" : ""}`}>
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary text-xs font-black text-muted-foreground overflow-hidden border border-border">
                              {p.photo_url ? <img src={p.photo_url} alt="" className="h-full w-full object-cover" /> :
                                p.shirt_number ?? <User className="h-3.5 w-3.5" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold text-foreground truncate">{p.first_name} {p.last_name}</p>
                              <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-bold">
                                {p.shirt_number && <span className="text-primary">#{p.shirt_number}</span>}
                                {p.birth_date && <span>{new Date(p.birth_date).toLocaleDateString("nl-BE", { day: "numeric", month: "short", year: "numeric" })}</span>}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}

                {teamStaff.length > 0 && (
                  <div className={ds(bStyle, "card")}>
                    <div className={ds(bStyle, "cardHeader")}>
                      <div className={ds(bStyle, "cardHeaderDot")} />
                      <h4 className={ds(bStyle, "cardHeaderTitle")}>Staf</h4>
                    </div>
                    <div className="divide-y divide-border/50">
                      {teamStaff.map((s: any, i: number) => (
                        <div key={s.id} className={`flex items-center gap-3 px-4 py-2.5 ${i % 2 === 1 ? "bg-secondary/20" : ""}`}>
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary text-xs font-black text-muted-foreground overflow-hidden border border-border">
                            {s.photo_url ? <img src={s.photo_url} alt="" className="h-full w-full object-cover" /> :
                              <User className="h-3.5 w-3.5" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-foreground truncate">{s.name}</p>
                            <p className="text-[10px] text-muted-foreground font-bold">{s.role}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {teamTab === "wedstrijden" && (
              <TeamMatchList team={team} teamMatches={teamMatches} teams={teams} phases={phases} groups={groups} slots={slots} tournament={tournament} />
            )}
          </>
        ) : (
          <TeamMatchList team={team} teamMatches={teamMatches} teams={teams} phases={phases} groups={groups} slots={slots} tournament={tournament} />
        )}
      </div>
    );
  }

  // Team grid - broadcast style
  return (
    <div className="px-3 pt-4 space-y-4">
      <div className="flex items-center gap-3">
        <div className={ds(bStyle, "sectionDot")} />
        <h2 className={ds(bStyle, "sectionTitle")}>Teams</h2>
        <div className={ds(bStyle, "sectionLine")} />
        <span className="text-[10px] font-bold text-muted-foreground uppercase">{teams.length} teams</span>
      </div>
      <div className="grid grid-cols-3 gap-2.5">
        {teams.map((t: any) => (
          <button key={t.id} onClick={() => { setSelectedTeam(t.id); setTeamTab("selectie"); }}
            className={`flex flex-col items-center gap-2 p-3 transition-all border ${isSquareStyle(bStyle) ? "" : "rounded-xl"} ${
              favoriteTeam === t.id ? "border-primary bg-primary/5 shadow-sm" : "border-transparent hover:bg-secondary/50 hover:border-border"
            }`}>
            <div className="h-12 w-12 overflow-hidden flex-shrink-0">
              {t.logo_url ? <img src={t.logo_url} alt="" className="h-full w-full object-contain" /> :
                <div className="flex h-full w-full items-center justify-center bg-secondary text-lg font-black text-muted-foreground rounded-lg">{t.name?.charAt(0)}</div>}
            </div>
            <div className="text-center min-w-0 w-full">
              <p className="text-xs font-bold text-foreground truncate">{t.name}</p>
              {t.country && <CountryFlag country={t.country} className="h-3 w-4 object-contain inline-block mt-0.5" />}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

const TeamMatchList = ({ team, teamMatches, teams, phases, groups, slots, tournament }: {
  team: any; teamMatches: any[]; teams: any[]; phases: any[]; groups: any[]; slots: any[]; tournament: any;
}) => {
  const bStyle = useBroadcastStyle();
  return (
    <div className={ds(bStyle, "card")}>
      <div className={ds(bStyle, "cardHeader")}>
        <div className={ds(bStyle, "cardHeaderDot")} />
        <h3 className={ds(bStyle, "cardHeaderTitle")}>Wedstrijden</h3>
      </div>
      <div className="p-2 space-y-2">
        {teamMatches.map((m: any) => (
          <div key={m.id} className={ds(bStyle, "matchCardWrapper") || "rounded-xl border border-border/60 bg-card overflow-hidden shadow-sm"}>
            <PublicMatchCard
              match={m}
              teams={teams}
              phases={phases}
              groups={groups}
              slots={slots}
              tournament={tournament}
              allMatches={teamMatches}
              favoriteTeam={team.id}
              hideRoundNumber
            />
          </div>
        ))}
        {teamMatches.length === 0 && (
          <div className="p-6 text-center text-sm text-muted-foreground font-medium">Nog geen wedstrijden</div>
        )}
      </div>
    </div>
  );
};

export default PublicTeams;
