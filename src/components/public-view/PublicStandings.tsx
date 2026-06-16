import { useState, useEffect, useMemo } from "react";
import { getPhaseLabel } from "@/lib/phaseLabel";
import { BarChart3, ChevronDown, ChevronUp, ListOrdered } from "lucide-react";
import CountryFlag from "@/components/CountryFlag";
import PublicMatchCard from "@/components/public-view/PublicMatchCard";
import type { PublicTournamentData } from "@/pages/PublicView";
import PublicBracketSection from "@/components/public-view/PublicBracketSection";
import { useBroadcastStyle } from "@/contexts/BroadcastStyleContext";
import { ds } from "@/lib/broadcastStyles";
import { calculateGroupStandings } from "@/lib/standingsCalculator";
import { isSetsGroup, computeSetPointTotals, formatSigned, resolveStandingsColumns } from "@/lib/standingsDisplay";

const PublicStandings = ({ data, initialPhaseId, initialGroupId }: { data: PublicTournamentData; initialPhaseId?: string; initialGroupId?: string }) => {
  const { tournament, phases, groups, teams, matches, groupTeams, slots, standingColors, stats, scoringSystems } = data;
  const bStyle = useBroadcastStyle();
  const [subTab, setSubTab] = useState<"standings" | "stats">("standings");
  
  const allPhaseNumbers = [...new Set(phases.map((p: any) => p.phase_number))].sort((a, b) => a - b);
  
  // Auto-detect current active phase reactively
  const autoPhaseNum = useMemo(() => {
    if (initialPhaseId) {
      return phases.find((p: any) => p.id === initialPhaseId)?.phase_number ?? null;
    }

    const hasCompletionMetadata = phases.some(
      (p: any) => typeof p.match_config?.phaseCompleted === "boolean",
    );

    if (hasCompletionMetadata) {
      for (const pn of allPhaseNumbers) {
        const phaseFormats = phases.filter((p: any) => p.phase_number === pn);
        if (phaseFormats.length === 0) continue;

        const isPhaseCompleted = phaseFormats.every(
          (format: any) => format.match_config?.phaseCompleted === true,
        );

        if (!isPhaseCompleted) {
          return pn;
        }
      }
      return allPhaseNumbers[allPhaseNumbers.length - 1] ?? null;
    }

    for (const pn of allPhaseNumbers) {
      const phasesInNum = phases.filter((p: any) => p.phase_number === pn);
      const phaseIds = phasesInNum.map((p: any) => p.id);
      const phaseMatches = matches.filter((m: any) => phaseIds.includes(m.phase_id));
      if (phaseMatches.length === 0 || phaseMatches.some((m: any) => !m.is_played)) {
        return pn;
      }
    }

    return allPhaseNumbers[allPhaseNumbers.length - 1] ?? null;
  }, [phases, matches, initialPhaseId, allPhaseNumbers]);
  
  const [selectedPhaseNum, setSelectedPhaseNum] = useState<number | null>(autoPhaseNum);
  const [selectedFormatId, setSelectedFormatId] = useState<string | null>(initialPhaseId || null);
  const [expandedGroupSchedule, setExpandedGroupSchedule] = useState<string | null>(null);
  const [selectedRoundFilter, setSelectedRoundFilter] = useState<string>("all");

  // Keep selectedPhaseNum in sync when data changes (e.g. phase undo)
  useEffect(() => {
    setSelectedPhaseNum(autoPhaseNum);
    setSelectedFormatId(null);
  }, [autoPhaseNum]);

  // When jumping to a specific group (from "my team"), scroll it into view
  useEffect(() => {
    if (!initialGroupId) return;
    const tryScroll = (attempt = 0) => {
      const el = document.getElementById(`standings-group-${initialGroupId}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      } else if (attempt < 10) {
        setTimeout(() => tryScroll(attempt + 1), 80);
      }
    };
    tryScroll();
  }, [initialGroupId, selectedPhaseNum, selectedFormatId]);

  const activePhaseNum = selectedPhaseNum ?? allPhaseNumbers[0] ?? null;
  const phasesInActiveNum = phases.filter((p: any) => p.phase_number === activePhaseNum);
  const showFormatsAsTabs = tournament.format_display_mode !== "stacked";
  
  const activeFormat = selectedFormatId 
    ? phasesInActiveNum.find((p: any) => p.id === selectedFormatId) || phasesInActiveNum[0]
    : phasesInActiveNum[0];
  const visibleFormats = showFormatsAsTabs ? (activeFormat ? [activeFormat] : []) : phasesInActiveNum;

  const calcStandings = (groupId: string) => {
    const rows = calculateGroupStandings(
      groupId,
      groupTeams as any,
      matches as any,
      groups as any,
      phases as any,
      (scoringSystems || []) as any,
      tournament,
    );
    return rows.map((r: any) => ({
      ...r,
      team: teams.find((t: any) => t.id === r.teamId),
    }));
  };

  const getColor = (phaseId: string, pos: number) =>
    standingColors.find((sc: any) => sc.phase_id === phaseId && pos >= sc.position_from && pos <= sc.position_to);

  const getPhaseColors = (phaseId: string) =>
    standingColors.filter((sc: any) => sc.phase_id === phaseId).sort((a: any, b: any) => a.position_from - b.position_from);

  const playerAgg = (type: string) => {
    const filtered = stats.filter((s: any) => s.stat_type === type);
    const map: Record<string, { name: string; teamId: string; count: number }> = {};
    filtered.forEach((s: any) => {
      const key = `${s.player_name}__${s.team_id}`;
      if (!map[key]) map[key] = { name: s.player_name, teamId: s.team_id, count: 0 };
      map[key].count++;
    });
    return Object.values(map).sort((a, b) => b.count - a.count);
  };

  // Fair-play aggregation: yellow=1, 2x yellow (auto red)=3, straight_red=5, legacy red_card=3
  const fairplayAgg = () => {
    const map: Record<string, { name: string; teamId: string; yellows: number; secondYellows: number; straightReds: number; legacyReds: number; points: number }> = {};
    const ensure = (name: string, teamId: string) => {
      const key = `${name}__${teamId}`;
      if (!map[key]) map[key] = { name, teamId, yellows: 0, secondYellows: 0, straightReds: 0, legacyReds: 0, points: 0 };
      return map[key];
    };
    const yellowMap: Record<string, number> = {};
    stats.forEach((s: any) => {
      if (s.stat_type === "yellow_card") {
        const key = `${s.player_name}__${s.team_id}`;
        yellowMap[key] = (yellowMap[key] || 0) + 1;
      }
    });
    Object.entries(yellowMap).forEach(([key, total]) => {
      const [name, teamId] = key.split("__");
      const row = ensure(name, teamId);
      row.secondYellows = Math.floor(total / 2);
      row.yellows = total % 2;
    });
    stats.forEach((s: any) => {
      if (s.stat_type === "straight_red") ensure(s.player_name, s.team_id).straightReds++;
      else if (s.stat_type === "red_card") ensure(s.player_name, s.team_id).legacyReds++;
    });
    Object.values(map).forEach(r => {
      r.points = r.yellows * 1 + r.secondYellows * 3 + r.straightReds * 5 + r.legacyReds * 3;
    });
    return Object.values(map).filter(r => r.points > 0).sort((a, b) => b.points - a.points);
  };


  return (
    <div className="px-3 pt-4 space-y-4">
      {/* Section header with stats toggle icon (icon at far right) */}
      <div className="flex items-center gap-3">
        <div className={ds(bStyle, "sectionDot")} />
        <h2 className={ds(bStyle, "sectionTitle")}>
          {subTab === "standings" ? "Standen" : "Statistieken"}
        </h2>
        <div className={ds(bStyle, "sectionLine")} />
        <button
          onClick={() => setSubTab(subTab === "standings" ? "stats" : "standings")}
          className="shrink-0 inline-flex items-center justify-center h-7 w-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          aria-label={subTab === "standings" ? "Statistieken openen" : "Standen openen"}
          title={subTab === "standings" ? "Statistieken" : "Standen"}
        >
          {subTab === "standings"
            ? <BarChart3 className="h-4 w-4" />
            : <ListOrdered className="h-4 w-4" />}
        </button>
      </div>

      {subTab === "standings" && (
        <div className="space-y-1.5">
          {/* Phase tabs — admin Format-stijl (Deelnemers-stijl) */}
          {allPhaseNumbers.length > 1 && (
            <div className="flex justify-center border-b border-border flex-wrap overflow-x-auto">
              {allPhaseNumbers.map(pn => {
                const isActive = activePhaseNum === pn;
                return (
                  <button
                    key={pn}
                    onClick={() => { setSelectedPhaseNum(pn); setSelectedFormatId(null); }}
                    className={
                      "px-6 py-3 text-sm font-semibold uppercase tracking-wide transition-colors relative whitespace-nowrap " +
                      (isActive
                        ? "text-primary after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:bg-primary"
                        : "text-muted-foreground hover:text-foreground")
                    }
                  >
                    {getPhaseLabel(pn, phases)}
                  </button>
                );
              })}
            </div>
          )}

          {/* Format tabs — narrower, scrollable */}
          {showFormatsAsTabs && phasesInActiveNum.length > 1 && (
            <div className="flex gap-1 overflow-x-auto pb-0.5 scrollbar-none px-1">
              {phasesInActiveNum.map((f: any) => (
                <button key={f.id} onClick={() => { setSelectedFormatId(f.id); }}
                  className={`shrink-0 ${ds(bStyle, "phaseTab")} ${activeFormat?.id === f.id ? ds(bStyle, "phaseTabActive") : ds(bStyle, "phaseTabInactive")} flex items-center gap-1`}>
                  {f.logo_url && <img src={f.logo_url} alt="" className="h-4 w-4 object-contain flex-shrink-0 rounded-sm" />}
                  {!f.logo_url && f.emoji ? `${f.emoji} ` : ""}{f.name}
                </button>
              ))}
            </div>
          )}

          {visibleFormats.map((format: any, formatIndex: number) => {
            const isGroupFormat = format.phase_type === "group" || format.phase_type === "round_robin";
            const isKnockoutFormat = format.phase_type === "knockout" || format.phase_type === "single_match";
            const formatGroups = groups.filter((g: any) => g.phase_id === format.id);
            const formatMatches = matches.filter((m: any) => m.phase_id === format.id);

            return (
              <div key={format.id} className={`space-y-3 ${!showFormatsAsTabs && formatIndex > 0 ? "border-t border-border pt-5 mt-5" : ""}`}>
                {!showFormatsAsTabs && phasesInActiveNum.length > 1 && (
                  <div className={ds(bStyle, "card")}>
                    <div className={ds(bStyle, "cardHeader")}>
                      {format.logo_url && <img src={format.logo_url} alt="" className="h-7 w-7 object-contain flex-shrink-0" />}
                      <h3 className="font-display text-xl font-black uppercase text-foreground">{!format.logo_url && format.emoji ? `${format.emoji} ` : ""}{format.name}</h3>
                    </div>
                  </div>
                )}

                {isGroupFormat && formatGroups.map((group: any) => {
                  const standings = calcStandings(group.id);
                  const colors = getPhaseColors(format.id);
                  const groupMatches = matches.filter((m: any) => m.group_id === group.id);
                  const roundNumbers = [...new Set(groupMatches.map((m: any) => m.round_number).filter(Boolean))].sort((a, b) => a - b);
                  const isExpanded = expandedGroupSchedule === group.id;
                  const setsMode = isSetsGroup(group.id, groups as any, phases as any, (scoringSystems || []) as any);
                  const setPts = setsMode ? computeSetPointTotals(group.id, matches as any) : null;
                  const cols = resolveStandingsColumns(tournament?.standings_columns);
                  const pc = cols.points;
                  const sc = cols.sets;

                  if (standings.length === 0) return null;
                  return (
                    <div key={group.id} id={`standings-group-${group.id}`} className={ds(bStyle, "card")}>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className={ds(bStyle, "tableHeader")}>
                              <th className="w-8 px-1.5 py-2.5 text-left">#</th>
                              <th className="px-1.5 py-2.5 text-left">Team</th>
                              {setsMode ? (
                                <>
                                  {sc.gp && <th className="w-7 px-0.5 py-2.5 text-center">GS</th>}
                                  {sc.w  && <th className="w-7 px-0.5 py-2.5 text-center">W</th>}
                                  {sc.d  && <th className="w-7 px-0.5 py-2.5 text-center">G</th>}
                                  {sc.l  && <th className="w-7 px-0.5 py-2.5 text-center">V</th>}
                                  {sc.sf && <th className="w-7 px-0.5 py-2.5 text-center">S+</th>}
                                  {sc.sa && <th className="w-7 px-0.5 py-2.5 text-center">S-</th>}
                                  {sc.sd && <th className="w-9 px-0.5 py-2.5 text-center">S+/-</th>}
                                  {sc.pf && <th className="w-9 px-0.5 py-2.5 text-center">P/S+</th>}
                                  {sc.pa && <th className="w-9 px-0.5 py-2.5 text-center">P/S-</th>}
                                  {sc.pd && <th className="w-10 px-0.5 py-2.5 text-center">P/S+/-</th>}
                                </>
                              ) : (
                                <>
                                  {pc.gp && <th className="w-7 px-0.5 py-2.5 text-center">GS</th>}
                                  {pc.w  && <th className="w-7 px-0.5 py-2.5 text-center">W</th>}
                                  {pc.d  && <th className="w-7 px-0.5 py-2.5 text-center">G</th>}
                                  {pc.l  && <th className="w-7 px-0.5 py-2.5 text-center">V</th>}
                                  {pc.gf && <th className="w-7 px-0.5 py-2.5 text-center">+</th>}
                                  {pc.ga && <th className="w-7 px-0.5 py-2.5 text-center">-</th>}
                                  {pc.gd && <th className="w-9 px-0.5 py-2.5 text-center">+/-</th>}
                                </>
                              )}
                              <th className="w-8 px-0.5 py-2.5 text-center">P</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border/50">
                            {standings.map((row: any, idx: number) => {
                              const colorZone = getColor(format.id, row.pos);
                              const sp = setPts?.get(row.team?.id) || { pf: 0, pa: 0 };
                              return (
                                <tr key={row.team?.id} className={`transition-colors ${idx % 2 === 0 ? "" : ds(bStyle, "tableRowAlt")}`}>
                                  <td className="px-1.5 py-2">
                                    <div className="flex items-center gap-1">
                                      {colorZone && <div className="w-1 h-5 rounded-full flex-shrink-0" style={{ backgroundColor: colorZone.color }} />}
                                      <span className="font-black text-muted-foreground">{row.pos}</span>
                                    </div>
                                  </td>
                                  <td className="px-1.5 py-2 whitespace-nowrap">
                                    <div className="flex items-center gap-1.5">
                                      <div className="h-6 w-6 overflow-hidden flex-shrink-0">
                                        {row.team?.logo_url ? <img src={row.team.logo_url} alt="" className="h-full w-full object-contain" /> :
                                          <div className="flex h-full w-full items-center justify-center bg-secondary text-[8px] font-black text-muted-foreground">{row.team?.name?.charAt(0)}</div>}
                                      </div>
                                      <span className="font-bold text-foreground">{row.team?.name}</span>
                                      {tournament.show_country && row.team?.country && <CountryFlag country={row.team.country} className="h-2.5 w-3.5 object-contain" />}
                                    </div>
                                  </td>
                                  {setsMode ? (
                                    <>
                                      {sc.gp && <td className="text-center px-0.5 py-2 text-muted-foreground">{row.gp}</td>}
                                      {sc.w  && <td className="text-center px-0.5 py-2 font-bold text-foreground">{row.w}</td>}
                                      {sc.d  && <td className="text-center px-0.5 py-2 text-muted-foreground">{row.d}</td>}
                                      {sc.l  && <td className="text-center px-0.5 py-2 text-muted-foreground">{row.l}</td>}
                                      {sc.sf && <td className="text-center px-0.5 py-2 text-foreground">{row.gf}</td>}
                                      {sc.sa && <td className="text-center px-0.5 py-2 text-muted-foreground">{row.ga}</td>}
                                      {sc.sd && <td className="text-center px-0.5 py-2 font-bold">{formatSigned(row.gd)}</td>}
                                      {sc.pf && <td className="text-center px-0.5 py-2 text-foreground">{sp.pf}</td>}
                                      {sc.pa && <td className="text-center px-0.5 py-2 text-muted-foreground">{sp.pa}</td>}
                                      {sc.pd && <td className="text-center px-0.5 py-2 font-bold">{formatSigned(sp.pf - sp.pa)}</td>}
                                    </>
                                  ) : (
                                    <>
                                      {pc.gp && <td className="text-center px-0.5 py-2 text-muted-foreground">{row.gp}</td>}
                                      {pc.w  && <td className="text-center px-0.5 py-2 font-bold text-foreground">{row.w}</td>}
                                      {pc.d  && <td className="text-center px-0.5 py-2 text-muted-foreground">{row.d}</td>}
                                      {pc.l  && <td className="text-center px-0.5 py-2 text-muted-foreground">{row.l}</td>}
                                      {pc.gf && <td className="text-center px-0.5 py-2 text-foreground">{formatSigned(row.gf)}</td>}
                                      {pc.ga && <td className="text-center px-0.5 py-2 text-muted-foreground">-{row.ga}</td>}
                                      {pc.gd && <td className="text-center px-0.5 py-2 font-bold">{formatSigned(row.gd)}</td>}
                                    </>
                                  )}
                                  <td className="text-center px-0.5 py-2">
                                    <span className={ds(bStyle, "ptsBadge")}>{row.pts}</span>
                                    {row.bonus > 0 && <span className="ml-0.5 text-[9px] font-bold text-primary align-super">+{row.bonus}</span>}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                      {colors.length > 0 && (
                        <div className="border-t border-border px-3 py-2 flex flex-wrap gap-3">
                          {colors.map((c: any) => (
                            <div key={c.id} className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: c.color }} />
                              <span>{c.label || `Positie ${c.position_from}–${c.position_to}`}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Expandable match schedule */}
                      {groupMatches.length > 0 && (
                        <div className="border-t border-border">
                          <button onClick={() => setExpandedGroupSchedule(isExpanded ? null : group.id)}
                            className="flex items-center justify-between w-full px-4 py-2 text-[10px] font-black uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors">
                            <span>Speelschema</span>
                            {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                          </button>
                          {isExpanded && (
                            <div className="px-3 pb-3 space-y-2">
                              {roundNumbers.length > 1 && (
                              <div className="flex gap-1 overflow-x-auto pb-1">
                                  <button onClick={() => setSelectedRoundFilter("all")}
                                    className={`${ds(bStyle, "phaseTab")} ${selectedRoundFilter === "all" ? ds(bStyle, "phaseTabActive") : ds(bStyle, "phaseTabInactive")}`}>Alle</button>
                                  {roundNumbers.map((r: number) => (
                                    <button key={r} onClick={() => setSelectedRoundFilter(String(r))}
                                      className={`${ds(bStyle, "phaseTab")} ${selectedRoundFilter === String(r) ? ds(bStyle, "phaseTabActive") : ds(bStyle, "phaseTabInactive")}`}>R{r}</button>
                                  ))}
                                </div>
                              )}
                              <div className="p-2 space-y-2">
                                {groupMatches
                                  .filter((m: any) => selectedRoundFilter === "all" || String(m.round_number) === selectedRoundFilter)
                                  .map((m: any) => (
                                    <div key={m.id} className={ds(bStyle, "matchCardWrapper") || "rounded-xl border border-border/60 bg-card overflow-hidden shadow-sm"}>
                                      <PublicMatchCard
                                        match={m}
                                        teams={teams}
                                        phases={phases}
                                        groups={groups}
                                        slots={slots}
                                        tournament={tournament}
                                        allMatches={matches}
                                        hideRoundNumber
                                      />
                                    </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}

                {isKnockoutFormat && (
                  <PublicBracketSection
                    groups={formatGroups}
                    labelGroups={groups}
                    matches={formatMatches}
                    teams={teams}
                    slots={slots}
                    tournament={tournament}
                    phases={phases}
                    showAllOnly
                    formatName={format.name}
                    hideSectionDividers={!showFormatsAsTabs}
                  />
                )}
              </div>
            );
          })}

          {allPhaseNumbers.length === 0 && (
            <div className="rounded-xl border-2 border-dashed border-border p-8 text-center">
              <p className="text-sm text-muted-foreground font-medium">Nog geen standen beschikbaar.</p>
            </div>
          )}
        </div>
      )}

      {subTab === "stats" && (
        <div className="space-y-4">
          <TeamStatsSection teams={teams} matches={matches} />
          {tournament.enable_goalscorers && tournament.show_public_top_scorers && <PlayerRanking title="Topscorers" icon="⚽" data={playerAgg("goal")} teams={teams} />}
          {tournament.enable_assists && tournament.show_public_assists && <PlayerRanking title="Meeste assists" icon="🅰️" data={playerAgg("assist")} teams={teams} />}
          {(tournament.enable_yellow_cards || tournament.enable_red_cards) && tournament.show_public_fairplay && <FairplayRanking data={fairplayAgg()} teams={teams} />}
        </div>
      )}
    </div>
  );
};

// Team stats section
const TeamStatsSection = ({ teams, matches }: { teams: any[]; matches: any[] }) => {
  const bStyle = useBroadcastStyle();
  const teamData = teams.map((t: any) => {
    const tm = matches.filter((m: any) => (m.home_team_id === t.id || m.away_team_id === t.id) && m.is_played);
    let gf = 0, ga = 0, cleanSheets = 0, maxWinStreak = 0, maxUnbeaten = 0, biggestWin = 0;
    let curWin = 0, curUnb = 0;
    
    tm.forEach((m: any) => {
      const isHome = m.home_team_id === t.id;
      const my = isHome ? m.home_score ?? 0 : m.away_score ?? 0;
      const op = isHome ? m.away_score ?? 0 : m.home_score ?? 0;
      gf += my; ga += op;
      if (op === 0) cleanSheets++;
      if (my > op) { curWin++; curUnb++; biggestWin = Math.max(biggestWin, my - op); }
      else if (my === op) { curWin = 0; curUnb++; }
      else { curWin = 0; curUnb = 0; }
      maxWinStreak = Math.max(maxWinStreak, curWin);
      maxUnbeaten = Math.max(maxUnbeaten, curUnb);
    });

    return { ...t, gf, ga, cleanSheets, maxWinStreak, maxUnbeaten, biggestWin, played: tm.length };
  }).filter(t => t.played > 0);

  if (teamData.length === 0) return null;

  const statCategories = [
    { label: "Meeste doelpunten", data: [...teamData].sort((a, b) => b.gf - a.gf).slice(0, 5), getValue: (t: any) => t.gf },
    { label: "Minste tegendoelpunten", data: [...teamData].sort((a, b) => a.ga - b.ga).slice(0, 5), getValue: (t: any) => t.ga },
    { label: "Meeste clean sheets", data: [...teamData].sort((a, b) => b.cleanSheets - a.cleanSheets).filter(t => t.cleanSheets > 0).slice(0, 5), getValue: (t: any) => t.cleanSheets },
    { label: "Langste winstreeks", data: [...teamData].sort((a, b) => b.maxWinStreak - a.maxWinStreak).filter(t => t.maxWinStreak > 0).slice(0, 5), getValue: (t: any) => t.maxWinStreak },
    { label: "Langste ongeslagen reeks", data: [...teamData].sort((a, b) => b.maxUnbeaten - a.maxUnbeaten).filter(t => t.maxUnbeaten > 0).slice(0, 5), getValue: (t: any) => t.maxUnbeaten },
    { label: "Grootste overwinning", data: [...teamData].sort((a, b) => b.biggestWin - a.biggestWin).filter(t => t.biggestWin > 0).slice(0, 5), getValue: (t: any) => `+${t.biggestWin}` },
  ];

  return (
    <>
      <div className="flex items-center gap-2">
        <h3 className="text-[10px] font-black uppercase tracking-[0.15em] text-primary">Team statistieken</h3>
        <div className="flex-1 h-px bg-primary/20" />
      </div>
      {statCategories.map(({ label, data: statData, getValue }) => {
        if (statData.length === 0) return null;
        return (
          <div key={label} className={ds(bStyle, "card")}>
            <div className={ds(bStyle, "cardHeader")}>
              <div className={ds(bStyle, "cardHeaderDot")} />
              <h4 className={ds(bStyle, "cardHeaderTitle")}>{label}</h4>
            </div>
            <div className="divide-y divide-border/50">
              {statData.map((t: any, i: number) => (
                <div key={t.id} className={`flex items-center gap-3 px-4 py-2.5 ${i % 2 === 1 ? "bg-secondary/20" : ""}`}>
                  <span className="w-6 text-center text-xs font-black text-primary">{i + 1}</span>
                  <div className="h-6 w-6 overflow-hidden flex-shrink-0">
                    {t.logo_url ? <img src={t.logo_url} alt="" className="h-full w-full object-contain" /> :
                      <div className="flex h-full w-full items-center justify-center bg-secondary text-[8px] font-black text-muted-foreground">{t.name?.charAt(0)}</div>}
                  </div>
                  <span className="flex-1 text-xs font-bold text-foreground truncate">{t.name}</span>
                  <span className="text-sm font-black text-foreground">{getValue(t)}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </>
  );
};

const PlayerRanking = ({ title, icon, data, teams }: { title: string; icon: string; data: any[]; teams: any[] }) => {
  const bStyle = useBroadcastStyle();
  if (data.length === 0) return null;
  const tName = (id: string) => teams.find((t: any) => t.id === id)?.name || "?";
  const tLogo = (id: string) => teams.find((t: any) => t.id === id)?.logo_url;

  return (
    <div className={ds(bStyle, "card")}>
      <div className={ds(bStyle, "cardHeader")}>
        <span>{icon}</span>
        <h3 className={ds(bStyle, "cardHeaderTitle")}>{title}</h3>
      </div>
      <div className="divide-y divide-border/50">
        {data.slice(0, 10).map((row, i) => (
          <div key={`${row.name}-${row.teamId}`} className={`flex items-center gap-3 px-4 py-2.5 ${i % 2 === 1 ? "bg-secondary/20" : ""}`}>
            <span className="w-6 text-center text-xs font-black text-primary">{i + 1}</span>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-foreground truncate">{row.name}</p>
              <div className="flex items-center gap-1">
                {tLogo(row.teamId) && <img src={tLogo(row.teamId)!} className="h-3 w-3 object-contain" alt="" />}
                <span className="text-[10px] text-muted-foreground">{tName(row.teamId)}</span>
              </div>
            </div>
            <span className="text-sm font-black text-foreground">{row.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const FairplayRanking = ({ data, teams }: { data: any[]; teams: any[] }) => {
  const bStyle = useBroadcastStyle();
  if (data.length === 0) return null;
  const tName = (id: string) => teams.find((t: any) => t.id === id)?.name || "?";
  const tLogo = (id: string) => teams.find((t: any) => t.id === id)?.logo_url;

  return (
    <div className={ds(bStyle, "card")}>
      <div className={ds(bStyle, "cardHeader")}>
        <span className="flex items-center gap-0.5">
          <div className="h-3.5 w-2.5 rounded-sm bg-yellow-400" />
          <div className="h-3.5 w-2.5 rounded-sm bg-red-500" />
        </span>
        <h3 className={ds(bStyle, "cardHeaderTitle")}>Fair-playklassement</h3>
      </div>
      <div className="divide-y divide-border/50">
        {data.slice(0, 10).map((row, i) => (
          <div key={`${row.name}-${row.teamId}`} className={`flex items-center gap-3 px-4 py-2.5 ${i % 2 === 1 ? "bg-secondary/20" : ""}`}>
            <span className="w-6 text-center text-xs font-black text-primary">{i + 1}</span>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-foreground truncate">{row.name}</p>
              <div className="flex items-center gap-1">
                {tLogo(row.teamId) && <img src={tLogo(row.teamId)!} className="h-3 w-3 object-contain" alt="" />}
                <span className="text-[10px] text-muted-foreground">{tName(row.teamId)}</span>
              </div>
            </div>
            <div className="flex items-center gap-0.5">
              {Array.from({ length: row.yellows }).map((_, idx) => (
                <div key={`y-${idx}`} className="h-3 w-2 rounded-sm bg-yellow-400" />
              ))}
              {Array.from({ length: row.secondYellows }).map((_, idx) => (
                <span key={`2y-${idx}`} className="flex items-center gap-0.5">
                  <div className="h-3 w-2 rounded-sm bg-yellow-400" />
                  <div className="h-3 w-2 rounded-sm bg-yellow-400" />
                  <div className="h-3 w-2 rounded-sm bg-red-500" />
                </span>
              ))}
              {Array.from({ length: row.straightReds + row.legacyReds }).map((_, idx) => (
                <div key={`r-${idx}`} className="h-3 w-2 rounded-sm bg-red-500" />
              ))}
            </div>
            <span className="text-sm font-black text-foreground">{row.points}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PublicStandings;

