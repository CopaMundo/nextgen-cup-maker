import { useState, useEffect, useRef, useMemo } from "react";
import { Star, ChevronRight, ArrowLeft, Trophy, Zap, Clock, MessageCircle } from "lucide-react";
import { useBroadcastStyle } from "@/contexts/BroadcastStyleContext";
import { ds } from "@/lib/broadcastStyles";
import CountryFlag from "@/components/CountryFlag";
import PublicMatchCard from "@/components/public-view/PublicMatchCard";
import PublicBracketSection from "@/components/public-view/PublicBracketSection";
import PublicStandings from "@/components/public-view/PublicStandings";
import type { PublicTournamentData } from "@/pages/PublicView";
import { calculateGroupStandings, getMatchTeamPositions } from "@/lib/standingsCalculator";
import { getPhaseLabel } from "@/lib/phaseLabel";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

interface Props {
  data: PublicTournamentData;
  favoriteTeam: string | null;
  toggleFavorite: (id: string) => void;
  setActiveTab: (tab: any, target?: { phaseId?: string }) => void;
  homeResetKey?: number;
}

/** Venster van max 6 posities rond het favoriete team. Tot 6 teams = alles tonen. Vanaf 7 teams max 5, met 2 boven en 2 onder het favoriete team, tenzij deze 1ste of 2de staat. */
const windowStandings = (rows: any[], favoriteTeam: string | null) => {
  if (rows.length <= 6) return rows;
  const idx = rows.findIndex((r: any) => r.team?.id === favoriteTeam);
  if (idx < 0) return rows.slice(0, 5);
  if (idx <= 1) return rows.slice(0, 5); // 1ste of 2de: toon top 5
  return rows.slice(idx - 2, idx + 3); // 2 boven, favoriet, 2 onder
};


const PublicHomepage = ({ data, favoriteTeam, toggleFavorite, setActiveTab, homeResetKey }: Props) => {
  const { tournament, teams, matches, groupTeams, groups, phases, slots, stats, standingColors, polls, pollVotes, scoringSystems } = data;
  const bStyle = useBroadcastStyle();
  const homeHeaderCls = ds(bStyle, "homeCardHeader") || ds(bStyle, "cardHeader");
  const homeHeaderTitleCls = ds(bStyle, "homeCardHeaderTitle") || ds(bStyle, "cardHeaderTitle");
  const matchCardWrapperCls = ds(bStyle, "matchCardWrapper") || "rounded-xl border border-border/60 bg-card overflow-hidden shadow-sm";

  const matchPositions = (m: any) => getMatchTeamPositions(m, groupTeams as any, matches as any, groups as any, phases as any, scoringSystems as any, tournament);

  const [expandedGrid, setExpandedGridState] = useState<string | null>(() => {
    const hash = window.location.hash.replace("#", "");
    return hash.startsWith("grid-") ? hash.replace("grid-", "") : null;
  });
  const [favTab, setFavTab] = useState<"matches" | "standings">("matches");
  const [globalTab, setGlobalTab] = useState<"results" | "next">("next");
  
  const [votedPolls, setVotedPolls] = useState<Record<string, number>>(() => {
    try { return JSON.parse(localStorage.getItem(`poll-votes-${tournament.id}`) || "{}"); } catch { return {}; }
  });

  const setExpandedGrid = (value: string | null) => {
    setExpandedGridState(value);
    if (value) {
      window.history.pushState({ expandedGrid: value }, "", `#grid-${value}`);
    } else {
      window.history.pushState({}, "", window.location.pathname + window.location.search);
    }
  };

  useEffect(() => {
    const onPop = () => {
      const hash = window.location.hash.replace("#", "");
      setExpandedGridState(hash.startsWith("grid-") ? hash.replace("grid-", "") : null);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // Reset expanded grid when Home button is pressed
  useEffect(() => {
    if (homeResetKey !== undefined) setExpandedGrid(null);
  }, [homeResetKey]);

  const teamName = (id: string | null) => teams.find((t: any) => t.id === id)?.name || "–";
  const teamLogo = (id: string | null) => teams.find((t: any) => t.id === id)?.logo_url;

  // Find the most relevant phase for the favorite team
  const allFavGroupTeams = favoriteTeam ? groupTeams.filter((gt: any) => gt.team_id === favoriteTeam) : [];
  const allFavEntries = allFavGroupTeams.map((gt: any) => {
    const group = groups.find((g: any) => g.id === gt.group_id);
    const phase = group ? phases.find((p: any) => p.id === group.phase_id) : null;
    return { gt, group, phase };
  }).filter((e: any) => e.phase).sort((a: any, b: any) => (a.phase.phase_number ?? 0) - (b.phase.phase_number ?? 0));

  const isPhaseComplete = (phaseId: string) => {
    const phase = phases.find((p: any) => p.id === phaseId);
    if (phase?.match_config?.phaseCompleted) return true;
    if (phase) {
      const sameNumberPhases = phases.filter((p: any) => p.phase_number === phase.phase_number);
      if (sameNumberPhases.length > 0 && sameNumberPhases.every((p: any) => p.match_config?.phaseCompleted)) return true;
    }
    const phaseMatches = matches.filter((m: any) => m.phase_id === phaseId);
    return phaseMatches.length > 0 && phaseMatches.every((m: any) => m.is_played);
  };

  // Phase logic: find the first incomplete phase the fav team is in, fallback to first phase
  const activeFavEntry = allFavEntries.find((e: any) => !isPhaseComplete(e.phase.id)) || allFavEntries[0] || null;
  const favGroupTeam = activeFavEntry?.gt || null;
  const favGroup = activeFavEntry?.group || null;
  const favPhase = activeFavEntry?.phase || null;

  // Check if current favPhase is itself a knockout/single_match
  const favPhaseIsKnockout = favPhase && (favPhase.phase_type === "knockout" || favPhase.phase_type === "single_match");

  // Gather ALL knockout phases the fav team participates in (regardless of earlier phase completion for knockout-first scenarios)
  const allFavKnockoutPhases = favoriteTeam ? phases
    .filter((p: any) => (p.phase_type === "knockout" || p.phase_type === "single_match"))
    .filter((p: any) => matches.some((m: any) => m.phase_id === p.id && (m.home_team_id === favoriteTeam || m.away_team_id === favoriteTeam)))
    .sort((a: any, b: any) => (a.phase_number ?? 0) - (b.phase_number ?? 0))
  : [];

  // Only consider knockout phases if all earlier group phases for this team are complete
  const allEarlierPhasesComplete = allFavEntries
    .filter((e: any) => (e.phase.phase_number ?? 0) < (favPhase?.phase_number ?? Infinity))
    .every((e: any) => isPhaseComplete(e.phase.id));
  const currentGroupPhaseComplete = favPhase ? isPhaseComplete(favPhase.id) : true;

  const favKnockoutPhases = (favPhaseIsKnockout || (allEarlierPhasesComplete && currentGroupPhaseComplete)) ? allFavKnockoutPhases : [];

  const didFavoriteTeamWin = (match: any) => {
    if (!favoriteTeam || !match?.is_played) return false;
    const isHome = match.home_team_id === favoriteTeam;
    const myScore = isHome ? (match.home_score ?? 0) : (match.away_score ?? 0);
    const oppScore = isHome ? (match.away_score ?? 0) : (match.home_score ?? 0);
    if (myScore > oppScore) return true;
    if (myScore < oppScore) return false;
    const myPens = isHome ? (match.home_penalties ?? 0) : (match.away_penalties ?? 0);
    const oppPens = isHome ? (match.away_penalties ?? 0) : (match.home_penalties ?? 0);
    return myPens > oppPens;
  };

  // Direct phase: first with unplayed match for favorite team, fallback to latest known phase for team
  const directActiveKnockout = favKnockoutPhases.find((p: any) =>
    matches.some((m: any) => m.phase_id === p.id && !m.is_played && (m.home_team_id === favoriteTeam || m.away_team_id === favoriteTeam))
  ) || (favKnockoutPhases.length > 0 ? favKnockoutPhases[favKnockoutPhases.length - 1] : null);

  const currentFavPhaseMatches = directActiveKnockout
    ? matches.filter((m: any) => m.phase_id === directActiveKnockout.id && (m.home_team_id === favoriteTeam || m.away_team_id === favoriteTeam))
    : [];
  const currentFavHasUnplayed = currentFavPhaseMatches.some((m: any) => !m.is_played);
  const latestPlayedCurrentFavMatch = [...currentFavPhaseMatches]
    .filter((m: any) => m.is_played)
    .sort((a: any, b: any) => (b.round_number ?? 0) - (a.round_number ?? 0) || (b.created_at || "").localeCompare(a.created_at || ""))[0];

  const currentBracketGroup = latestPlayedCurrentFavMatch?.group_id
    ? groups.find((g: any) => g.id === latestPlayedCurrentFavMatch.group_id)
    : null;

  // If favorite team won and has no remaining match in this phase, preselect next knockout phase (even before team_id propagation)
  const inferredNextKnockout = (directActiveKnockout && !currentFavHasUnplayed && latestPlayedCurrentFavMatch && didFavoriteTeamWin(latestPlayedCurrentFavMatch))
    ? phases
        .filter((p: any) => (p.phase_type === "knockout" || p.phase_type === "single_match") && (p.phase_number ?? 0) > (directActiveKnockout.phase_number ?? 0))
        .sort((a: any, b: any) => (a.phase_number ?? 0) - (b.phase_number ?? 0))
        .find((p: any) => {
          const phaseGroups = groups.filter((g: any) => g.phase_id === p.id);
          if (!currentBracketGroup?.name) return phaseGroups.length > 0;
          return phaseGroups.some((g: any) => g.name === currentBracketGroup.name);
        })
    : null;

  const activeKnockout = inferredNextKnockout || directActiveKnockout;
  const showCurrentKnockout = !!activeKnockout;

  const getRelevantFavoriteMatchInPhase = (phaseId: string) => {
    const phaseFavMatches = matches
      .filter((m: any) => m.phase_id === phaseId && (m.home_team_id === favoriteTeam || m.away_team_id === favoriteTeam));

    if (phaseFavMatches.length === 0) return null;

    const nextUnplayed = [...phaseFavMatches]
      .filter((m: any) => !m.is_played)
      .sort((a: any, b: any) =>
        (a.round_number ?? 0) - (b.round_number ?? 0)
        || (a.created_at || "").localeCompare(b.created_at || "")
      )[0];
    if (nextUnplayed) return nextUnplayed;

    const latestPlayed = [...phaseFavMatches]
      .filter((m: any) => m.is_played)
      .sort((a: any, b: any) =>
        (b.round_number ?? 0) - (a.round_number ?? 0)
        || (b.created_at || "").localeCompare(a.created_at || "")
      )[0];

    return latestPlayed || phaseFavMatches[phaseFavMatches.length - 1];
  };

  const resolveFavBracketGroupForPhase = (phaseId: string) => {
    const phaseGroups = groups.filter((g: any) => g.phase_id === phaseId);
    const relevantMatch = getRelevantFavoriteMatchInPhase(phaseId);

    if (relevantMatch?.group_id) {
      const relevantGroup = phaseGroups.find((g: any) => g.id === relevantMatch.group_id);
      if (relevantGroup) return relevantGroup;
    }

    if (currentBracketGroup?.name) {
      const sameNamedGroup = phaseGroups.find((g: any) => g.name === currentBracketGroup.name);
      if (sameNamedGroup) return sameNamedGroup;
    }

    return phaseGroups[0] || null;
  };

  const getBracketGridCardTitle = (phase: any) => {
    const favBracketGroup = resolveFavBracketGroupForPhase(phase.id);
    return favBracketGroup ? `${phase.name} - ${favBracketGroup.name}` : phase.name;
  };

  // Next phase after current group phase completes (only relevant when favPhase is a group phase)
  const nextPhaseAfterCurrent = (!favPhaseIsKnockout && !showCurrentKnockout && favPhase && isPhaseComplete(favPhase.id)) ? phases
    .filter((p: any) => p.phase_number > favPhase.phase_number)
    .sort((a: any, b: any) => a.phase_number - b.phase_number)
    .find((p: any) => {
      if (p.phase_type === "knockout" || p.phase_type === "single_match") {
        return matches.some((m: any) => m.phase_id === p.id && (m.home_team_id === favoriteTeam || m.away_team_id === favoriteTeam));
      }
      const phaseGroups = groups.filter((g: any) => g.phase_id === p.id);
      return phaseGroups.some((g: any) => groupTeams.some((gt: any) => gt.group_id === g.id && gt.team_id === favoriteTeam));
    })
  : null;
  const showBracketInstead = !showCurrentKnockout && favPhase && isPhaseComplete(favPhase.id) && nextPhaseAfterCurrent &&
    (nextPhaseAfterCurrent.phase_type === "knockout" || nextPhaseAfterCurrent.phase_type === "single_match");
  const showNextGroupInstead = !showCurrentKnockout && favPhase && isPhaseComplete(favPhase.id) && nextPhaseAfterCurrent &&
    (nextPhaseAfterCurrent.phase_type === "group" || nextPhaseAfterCurrent.phase_type === "round_robin");

  const nextGroupPhaseGroup = showNextGroupInstead ? (() => {
    const phaseGroups = groups.filter((g: any) => g.phase_id === nextPhaseAfterCurrent.id);
    const teamGroup = phaseGroups.find((g: any) => groupTeams.some((gt: any) => gt.group_id === g.id && gt.team_id === favoriteTeam));
    return teamGroup || null;
  })() : null;
  const nextKnockoutPhase = showBracketInstead ? nextPhaseAfterCurrent : null;

  const calcStandings = (groupId: string) => calculateGroupStandings(
    groupId,
    groupTeams as any,
    matches as any,
    groups as any,
    phases as any,
    (scoringSystems || []) as any,
    tournament,
  ).map((r: any) => ({ ...r, team: teams.find((t: any) => t.id === r.teamId) }));

  // Sliding window for fav matches: 1 played + 2 upcoming = max 3
  const favMatches = favoriteTeam
    ? matches.filter((m: any) => m.home_team_id === favoriteTeam || m.away_team_id === favoriteTeam)
    : [];

  const getSlidingWindow = () => {
    const played = favMatches.filter((m: any) => m.is_played);
    const upcoming = favMatches.filter((m: any) => !m.is_played);
    const recentPlayed = played.slice(-1); // max 1 played
    const nextUpcoming = upcoming.slice(0, 2); // max 2 upcoming
    return [...recentPlayed, ...nextUpcoming].slice(0, 3);
  };

  const matchesByTimeBlock = (list: any[]) => {
    const blocks: Record<string, any[]> = {};
    list.forEach(m => {
      const key = `${m.match_date || "nodate"}_${m.match_time || "notime"}`;
      if (!blocks[key]) blocks[key] = [];
      blocks[key].push(m);
    });
    return blocks;
  };

  const upcomingMatches = matches.filter((m: any) => !m.is_played);
  const playedMatches = matches.filter((m: any) => m.is_played);

  const upcomingBlocks = matchesByTimeBlock(upcomingMatches);
  const nextBlockKey = Object.keys(upcomingBlocks).sort()[0];
  const nextBlockMatchesAll = nextBlockKey ? upcomingBlocks[nextBlockKey] : [];
  const nextBlockMatches = nextBlockMatchesAll.slice(0, 3); // max 3 shown

  const playedBlocks = matchesByTimeBlock(playedMatches);
  const lastBlockKey = Object.keys(playedBlocks).sort().pop();
  const lastBlockMatches = lastBlockKey ? playedBlocks[lastBlockKey] : [];

  // Favorite team stats
  const favStats = favoriteTeam ? stats.filter((s: any) => s.team_id === favoriteTeam) : [];
  const favPlayed = favMatches.filter((m: any) => m.is_played);
  let favW = 0, favD = 0, favL = 0, favGF = 0, favGA = 0;
  favPlayed.forEach((m: any) => {
    if (m.home_team_id === favoriteTeam) {
      favGF += m.home_score ?? 0; favGA += m.away_score ?? 0;
      if ((m.home_score ?? 0) > (m.away_score ?? 0)) favW++; else if (m.home_score === m.away_score) favD++; else favL++;
    } else {
      favGF += m.away_score ?? 0; favGA += m.home_score ?? 0;
      if ((m.away_score ?? 0) > (m.home_score ?? 0)) favW++; else if (m.home_score === m.away_score) favD++; else favL++;
    }
  });

  const getForm = () => {
    return favPlayed.slice(-5).map((m: any) => {
      const isHome = m.home_team_id === favoriteTeam;
      const myScore = isHome ? m.home_score : m.away_score;
      const opScore = isHome ? m.away_score : m.home_score;
      if (myScore > opScore) return "W";
      if (myScore === opScore) return "G";
      return "V";
    });
  };

  const favStandings = favGroup ? calcStandings(favGroup.id) : [];
  const favPos = favStandings.find((r: any) => r.team?.id === favoriteTeam)?.pos;

  // Find the bracket group containing the favorite team for inline display
  const getFavBracketGroup = (phaseId: string) => {
    const phaseGroups = groups.filter((g: any) => g.phase_id === phaseId);
    if (!favoriteTeam) return phaseGroups;
    // Find groups where fav team has matches
    const favGroups = phaseGroups.filter((g: any) =>
      matches.some((m: any) => m.group_id === g.id && (m.home_team_id === favoriteTeam || m.away_team_id === favoriteTeam))
    );
    return favGroups.length > 0 ? favGroups : phaseGroups.slice(0, 1);
  };

  // Expanded detail view
  if (expandedGrid) {
    let title = "";
    let matchList: any[] = [];

    // Volledig programma: eigen pagina met terugknop, tabs en volledige tijdslotlijst
    if (expandedGrid.startsWith("programma:")) {
      const listMatches = globalTab === "next" ? upcomingMatches : playedMatches;
      return (
        <div className="px-3 pt-4 space-y-4">
          <button onClick={() => setExpandedGrid(null)} className={ds(bStyle, "backButton")}>
            <ArrowLeft className="h-4 w-4" /> Terug
          </button>
          <div className="flex items-center gap-2">
            <div className={ds(bStyle, "sectionDot")} />
            <h2 className={ds(bStyle, "sectionTitle")}>Programma</h2>
            <div className={ds(bStyle, "sectionLine")} />
          </div>
          <div className={ds(bStyle, "card")}>
            <div className="grid grid-cols-2 gap-0 border-b border-border">
              <button
                onClick={() => setGlobalTab("next")}
                className={`py-2 text-[11px] font-black uppercase tracking-wider transition-colors ${globalTab === "next" ? "text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"}`}
              >
                Volgende wedstrijden
              </button>
              <button
                onClick={() => setGlobalTab("results")}
                className={`py-2 text-[11px] font-black uppercase tracking-wider transition-colors ${globalTab === "results" ? "text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"}`}
              >
                Resultaten
              </button>
            </div>
            <div className="p-2 space-y-3">
              {listMatches.length > 0 ? (
                <ProgrammaTimeslotList
                  matches={listMatches}
                  teams={teams}
                  phases={phases}
                  groups={groups}
                  slots={slots}
                  tournament={tournament}
                  favoriteTeam={favoriteTeam}
                  bStyle={bStyle}
                  scrollToLatest={globalTab === "results"}
                  groupTeams={groupTeams}
                  scoringSystems={scoringSystems}
                />
              ) : (
                <p className="text-sm text-muted-foreground font-medium text-center py-4">
                  {globalTab === "next" ? "Geen komende wedstrijden." : "Nog geen resultaten."}
                </p>
              )}
            </div>
          </div>
        </div>
      );
    }


    // Volledig klassement: toon de Standen-view (met fases en formattabs) inline op de hoofdpagina
    if (expandedGrid === "fav-standing" && favGroup) {
      return (
        <div className="px-3 pt-4 space-y-4">
          <button onClick={() => setExpandedGrid(null)} className={ds(bStyle, "backButton")}>
            <ArrowLeft className="h-4 w-4" /> Terug
          </button>
          <PublicStandings data={data} initialPhaseId={favGroup.phase_id} initialGroupId={favGroup.id} favoriteTeam={favoriteTeam} />
        </div>
      );
    }

    if (expandedGrid === "fav-standing-next" && nextGroupPhaseGroup) {
      return (
        <div className="px-3 pt-4 space-y-4">
          <button onClick={() => setExpandedGrid(null)} className={ds(bStyle, "backButton")}>
            <ArrowLeft className="h-4 w-4" /> Terug
          </button>
          <PublicStandings data={data} initialPhaseId={nextGroupPhaseGroup.phase_id} initialGroupId={nextGroupPhaseGroup.id} favoriteTeam={favoriteTeam} />
        </div>
      );
    }

    // Volledige standen-view voor knockout / enkele wedstrijd (met fases en formattabs)
    if (expandedGrid.startsWith("fav-standing-knockout:")) {
      const koPhaseId = expandedGrid.replace("fav-standing-knockout:", "");
      const koPhase = phases.find((p: any) => p.id === koPhaseId);
      const koGroupHasFav = (g: any, onlyUnplayed: boolean) =>
        g.phase_id === koPhaseId &&
        matches.some((m: any) => m.group_id === g.id && (m.home_team_id === favoriteTeam || m.away_team_id === favoriteTeam) && (!onlyUnplayed || !m.is_played));
      const favKoGroup = favoriteTeam
        ? groups.find((g: any) => koGroupHasFav(g, true)) || groups.find((g: any) => koGroupHasFav(g, false))
        : null;

      if (koPhase) {
        return (
          <div className="px-3 pt-4 space-y-4">
            <button onClick={() => setExpandedGrid(null)} className={ds(bStyle, "backButton")}>
              <ArrowLeft className="h-4 w-4" /> Terug
            </button>
            <PublicStandings data={data} initialPhaseId={koPhase.id} initialGroupId={favKoGroup?.id} favoriteTeam={favoriteTeam} />
          </div>
        );
      }
    }

    // Inline bracket view for knockout phases
    if (expandedGrid.startsWith("fav-bracket:")) {
      const bracketPhaseId = expandedGrid.replace("fav-bracket:", "");
      const bracketPhase = phases.find((p: any) => p.id === bracketPhaseId);

      // Gather unique phase_numbers for knockout/single_match phases
      const allKnockoutPhases = phases
        .filter((p: any) => p.phase_type === "knockout" || p.phase_type === "single_match")
        .sort((a: any, b: any) => (a.phase_number ?? 0) - (b.phase_number ?? 0) || (a.sort_order ?? 0) - (b.sort_order ?? 0));
      
      const phaseNumberSet = [...new Set(allKnockoutPhases.map((p: any) => p.phase_number))];
      const currentPhaseNumber = bracketPhase?.phase_number;

      // All sibling phases (same phase_number) for the selected tab
      const siblingPhases = allKnockoutPhases.filter((p: any) => p.phase_number === currentPhaseNumber);

      // Sort bracket groups: fav team's group first, then the rest
      const getAllGroupsForPhase = (phaseId: string) => {
        const phaseGroups = groups.filter((g: any) => g.phase_id === phaseId);
        if (!favoriteTeam) return phaseGroups;
        const favGs = phaseGroups.filter((g: any) =>
          matches.some((m: any) => m.group_id === g.id && (m.home_team_id === favoriteTeam || m.away_team_id === favoriteTeam))
        );
        const otherGs = phaseGroups.filter((g: any) => !favGs.includes(g));
        return [...favGs, ...otherGs];
      };

      // Find the bracket group containing the favorite team's next unplayed match to scroll to
      const bracketGroupHasFav = (g: any, onlyUnplayed: boolean) =>
        matches.some((m: any) => m.phase_id === bracketPhaseId && m.group_id === g.id && (m.home_team_id === favoriteTeam || m.away_team_id === favoriteTeam) && (!onlyUnplayed || !m.is_played));
      const favGroupForScroll = favoriteTeam
        ? groups.find((g: any) => bracketGroupHasFav(g, true)) || groups.find((g: any) => bracketGroupHasFav(g, false))
        : null;


      // Find the best phase to land on: the one where the fav team has an unplayed match
      const bestPhaseForFav = (() => {
        if (!favoriteTeam) return null;
        // Search through all knockout phases for the first one with an unplayed fav match
        for (const pn of phaseNumberSet) {
          const phasesForNumber = allKnockoutPhases.filter((p: any) => p.phase_number === pn);
          for (const p of phasesForNumber) {
            const hasUnplayed = matches.some((m: any) =>
              m.phase_id === p.id && !m.is_played &&
              (m.home_team_id === favoriteTeam || m.away_team_id === favoriteTeam)
            );
            if (hasUnplayed) return p;
          }
        }
        // Fallback: find the phase with the fav team's last played match
        let lastPhase: any = null;
        for (const pn of phaseNumberSet) {
          const phasesForNumber = allKnockoutPhases.filter((p: any) => p.phase_number === pn);
          for (const p of phasesForNumber) {
            const hasPlayed = matches.some((m: any) =>
              m.phase_id === p.id && m.is_played &&
              (m.home_team_id === favoriteTeam || m.away_team_id === favoriteTeam)
            );
            if (hasPlayed) lastPhase = p;
          }
        }
        return lastPhase;
      })();

      // If we found a better phase than what was clicked, redirect
      if (bestPhaseForFav && bestPhaseForFav.phase_number !== currentPhaseNumber) {
        const redirectPhaseNumber = bestPhaseForFav.phase_number;
        const redirectSiblings = allKnockoutPhases.filter((p: any) => p.phase_number === redirectPhaseNumber);
        const redirectGetAllGroups = getAllGroupsForPhase;
        const redirectFavGroup = groups.find((g: any) =>
          matches.some((m: any) => m.phase_id === bestPhaseForFav.id && m.group_id === g.id && !m.is_played &&
            (m.home_team_id === favoriteTeam || m.away_team_id === favoriteTeam))
        );

        return (
          <InlineBracketView
            backAction={() => setExpandedGrid(null)}
            bStyle={bStyle}
            phaseNumberSet={phaseNumberSet}
            allKnockoutPhases={allKnockoutPhases}
            currentPhaseNumber={redirectPhaseNumber}
            setExpandedGrid={setExpandedGrid}
            siblingPhases={redirectSiblings}
            getAllGroupsForPhase={redirectGetAllGroups}
            matches={matches}
            groups={groups}
            teams={teams}
            slots={slots}
            tournament={tournament}
            phases={phases}
            favoriteTeam={favoriteTeam}
            scrollToGroupId={redirectFavGroup?.id || null}
          />
        );
      }

      return (
        <InlineBracketView
          backAction={() => setExpandedGrid(null)}
          bStyle={bStyle}
          phaseNumberSet={phaseNumberSet}
          allKnockoutPhases={allKnockoutPhases}
          currentPhaseNumber={currentPhaseNumber}
          setExpandedGrid={setExpandedGrid}
          siblingPhases={siblingPhases}
          getAllGroupsForPhase={getAllGroupsForPhase}
          matches={matches}
          groups={groups}
          teams={teams}
          slots={slots}
          tournament={tournament}
          phases={phases}
          favoriteTeam={favoriteTeam}
          scrollToGroupId={favGroupForScroll?.id || null}
        />
      );
    }

    if (expandedGrid === "fav-matches") {
      title = "Wedstrijden";
      matchList = [...favMatches].sort((a: any, b: any) => {
        const dA = a.match_date || "9999"; const dB = b.match_date || "9999";
        if (dA !== dB) return dA.localeCompare(dB);
        const tA = a.match_time || "99:99"; const tB = b.match_time || "99:99";
        return tA.localeCompare(tB);
      });
    }
    if (expandedGrid === "next-block") { title = "Volgende wedstrijden"; matchList = nextBlockMatchesAll; }
    if (expandedGrid === "last-results") { title = "Laatste resultaten"; matchList = lastBlockMatches; }

    return (
      <div className="px-3 pt-4 space-y-4">
        <button onClick={() => setExpandedGrid(null)} className={ds(bStyle, "backButton")}>
          <ArrowLeft className="h-4 w-4" /> Terug
        </button>
        <div className="flex items-center gap-2">
          <div className={ds(bStyle, "sectionDot")} />
          <h2 className={ds(bStyle, "sectionTitle")}>{title}</h2>
          <div className={ds(bStyle, "sectionLine")} />
        </div>
        <MatchListView matches={matchList} teams={teams} phases={phases} groups={groups} slots={slots} favoriteTeam={favoriteTeam} tournament={tournament} groupTeams={groupTeams} scoringSystems={scoringSystems} />
      </div>
    );
  }

  const slidingMatches = getSlidingWindow();
  const form = getForm();

  // Compact favorite team data
  const favTeamObj = favoriteTeam ? teams.find((t: any) => t.id === favoriteTeam) : null;

  // Sort favorite team matches chronologically
  const sortedFavMatches = [...favMatches].sort((a: any, b: any) => {
    const dA = a.match_date || "9999"; const dB = b.match_date || "9999";
    if (dA !== dB) return dA.localeCompare(dB);
    const tA = a.match_time || "99:99"; const tB = b.match_time || "99:99";
    return tA.localeCompare(tB);
  });
  const nextFavMatch = favoriteTeam
    ? sortedFavMatches.filter((m: any) => !m.is_played)[0] || null
    : null;
  const lastFavMatch = favoriteTeam
    ? [...sortedFavMatches].filter((m: any) => m.is_played).slice(-1)[0] || null
    : null;

  return (
    <div className="pt-4 space-y-4 px-3">
      {/* Tournament name - broadcast header */}
      <div className="flex items-center gap-3 mb-1">
        {tournament.logo_url && <img src={tournament.logo_url} alt="" className={`h-10 w-10 object-contain shadow-sm rounded-xl`} />}
        <div className="flex-1 min-w-0">
          <h1 className="font-display font-black text-foreground leading-tight text-lg uppercase tracking-wide truncate">{tournament.name}</h1>
        </div>
      </div>

      {/* === MIJN TEAM: titel + teamkiezer rechts === */}
      <div className="flex items-center gap-2">
        <div className={ds(bStyle, "sectionDot")} />
        <h2 className={ds(bStyle, "sectionTitle")}>Mijn team</h2>
        <div className={`${ds(bStyle, "sectionLine")} flex-1`} />
        <Select value={favoriteTeam || ""} onValueChange={(v) => { if (v !== favoriteTeam) { if (favoriteTeam) toggleFavorite(favoriteTeam); toggleFavorite(v); } }}>
          <SelectTrigger className="h-7 w-auto min-w-[110px] max-w-[150px] text-[10px] font-black uppercase tracking-wider">
            <SelectValue placeholder="Kies uw team" />
          </SelectTrigger>
          <SelectContent>
            {teams.map((t: any) => (
              <SelectItem key={t.id} value={t.id}>
                <div className="flex items-center gap-2">
                  {t.logo_url && <img src={t.logo_url} className="h-4 w-4 object-contain" alt="" />}
                  {t.name}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* === FAVORITE TEAM BLOCK (everything about my team grouped together in one container) === */}
      {favoriteTeam && favTeamObj && (
        <div className={`${ds(bStyle, "card")}`}>


          {/* Body */}
          <div className="divide-y divide-border">
            {/* Compact favorite team card with logo + name */}
            <div className="px-3 py-2 flex items-center gap-2.5">
              {favTeamObj.logo_url ? (
                <img src={favTeamObj.logo_url} alt="" className="h-7 w-7 object-contain shrink-0" />
              ) : (
                <div className={`h-7 w-7 bg-muted flex items-center justify-center shrink-0 rounded-md`}>
                  <Star className="h-3 w-3 text-muted-foreground" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-black text-foreground uppercase tracking-wide truncate">{favTeamObj.name}</p>
              </div>
              {favTeamObj.country && (
                <CountryFlag country={favTeamObj.country} className="h-4 w-6 shrink-0" />
              )}
            </div>

            {/* Teamstatistieken */}
            {favPlayed.length > 0 && (
              <div className="px-3 py-2.5 flex items-center justify-between gap-3">
                <div className="grid grid-cols-4 flex-1 gap-1 text-center">
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Gesp.</p>
                    <p className="text-sm font-black text-foreground tabular-nums">{favPlayed.length}</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">W-G-V</p>
                    <p className="text-sm font-black text-foreground tabular-nums">{favW}-{favD}-{favL}</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Voor</p>
                    <p className="text-sm font-black text-foreground tabular-nums">{favGF}</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Tegen</p>
                    <p className="text-sm font-black text-foreground tabular-nums">{favGA}</p>
                  </div>
                </div>
                <div className="flex flex-col items-center gap-1 shrink-0">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Vorm</p>
                  <div className="flex gap-0.5">
                    {getForm().map((f, i) => (
                      <span
                        key={i}
                        className={`flex h-4 w-4 items-center justify-center rounded-sm text-[9px] font-black ${
                          f === "W" ? "bg-green-500/20 text-green-500" : f === "G" ? "bg-muted text-muted-foreground" : "bg-red-500/20 text-red-500"
                        }`}
                      >
                        {f}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Tab switcher: Wedstrijden / Standen */}
            {(lastFavMatch || nextFavMatch || showCurrentKnockout || showBracketInstead || showNextGroupInstead || (favGroup && favStandings.length > 0)) && (
              <div className="ttx-myteam-tabs grid grid-cols-2 gap-0 border-b border-border">
                <button
                  onClick={() => setFavTab("matches")}
                  data-active={favTab === "matches"}
                  className={`ttx-myteam-tab py-2 text-[11px] font-black uppercase tracking-wider transition-colors ${favTab === "matches" ? "text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"}`}
                >
                  Wedstrijden
                </button>
                <button
                  onClick={() => setFavTab("standings")}
                  data-active={favTab === "standings"}
                  className={`ttx-myteam-tab py-2 text-[11px] font-black uppercase tracking-wider transition-colors ${favTab === "standings" ? "text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"}`}
                >
                  Standen
                </button>
              </div>
            )}

            {/* Wedstrijden tab — alleen laatste resultaat + volgende wedstrijd, klik = alle wedstrijden */}
            {favTab === "matches" && (lastFavMatch || nextFavMatch) && (
              <div
                className="cursor-pointer hover:bg-muted/30 transition-colors"
                onClick={() => setExpandedGrid("fav-matches")}
              >
                <div className="px-3 pt-3 pb-2 space-y-3">
                  {lastFavMatch && (
                    <div>
                      <div className="pb-1.5">
                        <span className="text-[10px] font-black uppercase tracking-[0.18em] text-primary italic">Laatste resultaat</span>
                      </div>
                      <div className={matchCardWrapperCls}>
                        <PublicMatchCard
                          match={lastFavMatch}
                          teams={teams}
                          phases={phases}
                          groups={groups}
                          slots={slots}
                          tournament={tournament}
                          allMatches={matches}
                          favoriteTeam={favoriteTeam}
                          hideRoundNumber
                          {...matchPositions(lastFavMatch)}
                        />
                      </div>
                    </div>
                  )}
                  {nextFavMatch && (
                    <div>
                      <div className="pb-1.5">
                        <span className="text-[10px] font-black uppercase tracking-[0.18em] text-primary italic">Volgende wedstrijd</span>
                      </div>
                      <div className={matchCardWrapperCls}>
                        <PublicMatchCard
                          match={nextFavMatch}
                          teams={teams}
                          phases={phases}
                          groups={groups}
                          slots={slots}
                          tournament={tournament}
                          allMatches={matches}
                          favoriteTeam={favoriteTeam}
                          hideRoundNumber
                          {...matchPositions(nextFavMatch)}
                        />
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-center gap-1 pb-2 text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">
                  Alle wedstrijden
                  <ChevronRight className="h-3 w-3 rotate-90" />
                </div>
              </div>
            )}

            {/* Standen tab — inline weergave (klassement of bracket), terug-knop houdt op homepage */}
            {favTab === "standings" && showCurrentKnockout && activeKnockout && (
              <button
                onClick={() => setExpandedGrid(`fav-standing-knockout:${activeKnockout.id}`)}
                className="w-full px-3 py-4 text-left hover:bg-muted/30 transition-colors flex items-center justify-between gap-2"
              >
                <div className="flex items-center gap-2">
                  <Trophy className="h-3.5 w-3.5 text-primary" />
                  <span className="text-xs font-black uppercase tracking-wider text-foreground">{getBracketGridCardTitle(activeKnockout)}</span>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
            )}

            {favTab === "standings" && !showCurrentKnockout && !showBracketInstead && !showNextGroupInstead && favGroup && favStandings.length > 0 && (
              <div className="cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => setExpandedGrid("fav-standing")}>
                <div className="px-3 pt-3 pb-2 space-y-2">
                  <div className="text-[10px] font-black uppercase tracking-[0.18em] text-primary italic">{favGroup.name}</div>
                  <StandingTable standings={windowStandings(favStandings, favoriteTeam)} favoriteTeam={favoriteTeam} tournament={tournament} standingColors={standingColors} phaseId={favGroup.phase_id} />
                </div>
                <div className="flex items-center justify-center gap-1 pb-2 text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">
                  Volledig klassement
                  <ChevronRight className="h-3 w-3 rotate-90" />
                </div>
              </div>
            )}

            {favTab === "standings" && !showCurrentKnockout && showNextGroupInstead && nextGroupPhaseGroup && (
              <div className="cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => setExpandedGrid("fav-standing-next")}>
                <div className="px-3 pt-3 pb-2 space-y-2">
                  <div className="text-[10px] font-black uppercase tracking-[0.18em] text-primary italic">{nextGroupPhaseGroup.name}</div>
                  <StandingTable standings={windowStandings(calcStandings(nextGroupPhaseGroup.id), favoriteTeam)} favoriteTeam={favoriteTeam} tournament={tournament} standingColors={standingColors} phaseId={nextGroupPhaseGroup.phase_id} />
                </div>
                <div className="flex items-center justify-center gap-1 pb-2 text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">
                  Volledig klassement
                  <ChevronRight className="h-3 w-3 rotate-90" />
                </div>
              </div>
            )}



            {favTab === "standings" && !showCurrentKnockout && showBracketInstead && nextKnockoutPhase && (
              <button
                onClick={() => setExpandedGrid(`fav-standing-knockout:${nextKnockoutPhase.id}`)}
                className="w-full px-3 py-4 text-left hover:bg-muted/30 transition-colors flex items-center justify-between gap-2"
              >
                <div className="flex items-center gap-2">
                  <Trophy className="h-3.5 w-3.5 text-primary" />
                  <span className="text-xs font-black uppercase tracking-wider text-foreground">{getBracketGridCardTitle(nextKnockoutPhase)}</span>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* === GLOBAL: Programma (Resultaten / Volgende wedstrijden) === */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div className={ds(bStyle, "sectionDot")} />
          <h2 className={ds(bStyle, "sectionTitle")}>Programma</h2>
          <div className={ds(bStyle, "sectionLine")} />
        </div>

        {/* Tabs */}
        <div className={ds(bStyle, "card")}>
          <div className="grid grid-cols-2 gap-0 border-b border-border">
            <button
              onClick={() => setGlobalTab("next")}
              className={`py-2 text-[11px] font-black uppercase tracking-wider transition-colors ${globalTab === "next" ? "text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"}`}
            >
              Volgende wedstrijden
            </button>
            <button
              onClick={() => setGlobalTab("results")}
              className={`py-2 text-[11px] font-black uppercase tracking-wider transition-colors ${globalTab === "results" ? "text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"}`}
            >
              Resultaten
            </button>
          </div>

          {/* Default view: current/next or last-played time slot */}
          <div className="px-3 py-3 space-y-2">
            {globalTab === "next" && nextBlockMatchesAll.length > 0 && (
              <MatchListView
                matches={nextBlockMatchesAll}
                teams={teams}
                phases={phases}
                groups={groups}
                slots={slots}
                favoriteTeam={favoriteTeam}
                compact
                tournament={tournament}
                onCardClick={() => setExpandedGrid(`programma:${globalTab}`)}
                groupTeams={groupTeams}
                scoringSystems={scoringSystems}
              />
            )}
            {globalTab === "results" && lastBlockMatches.length > 0 && (
              <MatchListView
                matches={lastBlockMatches}
                teams={teams}
                phases={phases}
                groups={groups}
                slots={slots}
                favoriteTeam={favoriteTeam}
                compact
                tournament={tournament}
                onCardClick={() => setExpandedGrid(`programma:${globalTab}`)}
                groupTeams={groupTeams}
                scoringSystems={scoringSystems}
              />
            )}
            {((globalTab === "next" && nextBlockMatchesAll.length === 0) || (globalTab === "results" && lastBlockMatches.length === 0)) && (
              <p className="text-sm text-muted-foreground font-medium text-center py-4">
                {globalTab === "next" ? "Geen komende wedstrijden." : "Nog geen resultaten."}
              </p>
            )}
          </div>

          {/* Toggle: opent volledig programma op eigen pagina */}
          {((globalTab === "next" && nextBlockMatchesAll.length > 0) || (globalTab === "results" && lastBlockMatches.length > 0)) && (
            <button
              onClick={() => setExpandedGrid(`programma:${globalTab}`)}
              className="w-full py-2 text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-1"
            >
              Alles bekijken
              <ChevronRight className="h-3 w-3 rotate-90" />
            </button>
          )}
        </div>
      </div>

      {/* === Polls === */}
      {polls.length > 0 && (
        <GridCard title="Polls" icon={<MessageCircle className="h-4 w-4" />}>
          <div className="space-y-4">
            {polls.map((poll: any) => (
              <PollCard key={poll.id} poll={poll} pollVotes={pollVotes} votedPolls={votedPolls}
                onVote={(pollId, optIdx) => {
                  import("@/integrations/supabase/client").then(({ supabase }) => {
                    const voterId = localStorage.getItem("voter-id") || crypto.randomUUID();
                    localStorage.setItem("voter-id", voterId);
                    supabase.from("poll_votes").insert({ poll_id: pollId, option_index: optIdx, voter_id: voterId }).then(() => {
                      const updated = { ...votedPolls, [pollId]: optIdx };
                      setVotedPolls(updated);
                      localStorage.setItem(`poll-votes-${tournament.id}`, JSON.stringify(updated));
                    });
                  });
                }} />
            ))}
          </div>
        </GridCard>
      )}
    </div>
  );
};

// Poll card
const PollCard = ({ poll, pollVotes, votedPolls, onVote }: { poll: any; pollVotes: any[]; votedPolls: Record<string, number>; onVote: (pollId: string, optIdx: number) => void }) => {
  const options = Array.isArray(poll.options) ? poll.options : [];
  const votes = pollVotes.filter((v: any) => v.poll_id === poll.id);
  const totalVotes = votes.length;
  const hasVoted = votedPolls[poll.id] !== undefined;

  return (
    <div>
      <p className="text-sm font-bold text-foreground mb-2">{poll.question}</p>
      <div className="space-y-1.5">
        {options.map((opt: string, i: number) => {
          const count = votes.filter((v: any) => v.option_index === i).length;
          const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
          const isSelected = votedPolls[poll.id] === i;
          return (
            <button key={i} onClick={() => !hasVoted && onVote(poll.id, i)} disabled={hasVoted}
              className={`relative w-full rounded-lg border px-3 py-2 text-left text-xs transition-all overflow-hidden ${
                isSelected ? "border-primary bg-primary/10" : "border-border hover:border-primary/30"
              }`}>
              {hasVoted && <div className="absolute inset-0 bg-primary/10 rounded-lg" style={{ width: `${pct}%` }} />}
              <div className="relative flex items-center justify-between">
                <span className="font-bold text-foreground">{opt}</span>
                {hasVoted && <span className="text-muted-foreground font-black">{pct}%</span>}
              </div>
            </button>
          );
        })}
      </div>
      {hasVoted && <p className="text-[10px] text-muted-foreground mt-1 font-bold">{totalVotes} stemmen</p>}
    </div>
  );
};

// Inline bracket view with direct navigation to favorite team's bracket
const InlineBracketView = ({ backAction, bStyle, phaseNumberSet, allKnockoutPhases, currentPhaseNumber, setExpandedGrid, siblingPhases, getAllGroupsForPhase, matches: allMatches, groups = [], teams, slots = [], tournament, phases, favoriteTeam, scrollToGroupId }: any) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Find the bracket group_id where the fav team has an unplayed match (for scroll targeting)
  // Fallback: last played match's group when all matches are played
  const favTargetGroupId = useMemo(() => {
    if (!favoriteTeam) return null;
    // First: look for unplayed match
    for (const sp of siblingPhases) {
      const spMatches = allMatches.filter((m: any) => m.phase_id === sp.id);
      const unplayed = spMatches.find((m: any) =>
        !m.is_played && (m.home_team_id === favoriteTeam || m.away_team_id === favoriteTeam)
      );
      if (unplayed?.group_id) return unplayed.group_id;
    }
    // Fallback: last played match's group (when all matches are done)
    let lastPlayedGroup: string | null = null;
    for (const sp of siblingPhases) {
      const spMatches = allMatches.filter((m: any) => m.phase_id === sp.id);
      const played = spMatches
        .filter((m: any) => m.is_played && (m.home_team_id === favoriteTeam || m.away_team_id === favoriteTeam))
        .sort((a: any, b: any) => (a.round_number ?? 0) - (b.round_number ?? 0));
      if (played.length > 0) lastPlayedGroup = played[played.length - 1].group_id;
    }
    return lastPlayedGroup;
  }, [favoriteTeam, siblingPhases, allMatches]);

  return (
    <div className="px-3 pt-4 space-y-4" ref={containerRef}>
      <button onClick={backAction} className={ds(bStyle, "backButton")}>
        <ArrowLeft className="h-4 w-4" /> Terug
      </button>
      {phaseNumberSet.length > 1 && (
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          {phaseNumberSet.map((pn: any) => {
            const representative = allKnockoutPhases.find((p: any) => p.phase_number === pn);
            const siblings = allKnockoutPhases.filter((p: any) => p.phase_number === pn);
            const label = siblings.length === 1 ? siblings[0].name : getPhaseLabel(pn, allKnockoutPhases);
            return (
              <button
                key={pn}
                onClick={() => setExpandedGrid(`fav-bracket:${representative.id}`)}
                className={`whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-semibold transition-colors shrink-0 ${
                  pn === currentPhaseNumber
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-accent"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      )}
      {siblingPhases.map((sp: any) => {
        const allSpGroups = getAllGroupsForPhase(sp.id);
        // Check if favorite team is in this specific format (sibling phase)
        if (favoriteTeam) {
          const teamInThisPhase = allMatches.some((m: any) => m.phase_id === sp.id && (m.home_team_id === favoriteTeam || m.away_team_id === favoriteTeam));
          if (!teamInThisPhase) {
            // Check if team is in ANY sibling phase at this phase_number
            const teamInAnySibling = siblingPhases.some((sib: any) =>
              allMatches.some((m: any) => m.phase_id === sib.id && (m.home_team_id === favoriteTeam || m.away_team_id === favoriteTeam))
            );
            if (teamInAnySibling) {
              // Team is in a different format at this level - skip this one
              return null;
            }
            // Team not yet at this level - try name matching from earlier phases
            const earlierFavGroupName = (() => {
              for (const ep of allKnockoutPhases) {
                if ((ep.phase_number ?? 0) >= (sp.phase_number ?? 0)) continue;
                const favMatch = allMatches.find((m: any) => m.phase_id === ep.id && (m.home_team_id === favoriteTeam || m.away_team_id === favoriteTeam));
                if (favMatch?.group_id) {
                  const g = getAllGroupsForPhase(ep.id).find((g: any) => g.id === favMatch.group_id);
                  if (g) return g.name;
                }
              }
              return null;
            })();
            if (!earlierFavGroupName) return null;
            const hasNameMatch = allSpGroups.some((g: any) => g.name === earlierFavGroupName);
            if (!hasNameMatch) return null;
          }
        }
        // Show ALL groups in this format (main bracket + plaatsing brackets)
        const spGroups = allSpGroups;
        if (spGroups.length === 0) return null;
        const spMatches = allMatches.filter((m: any) => m.phase_id === sp.id);
        return (
          <div key={sp.id} data-group-id={sp.id}>
            {siblingPhases.length > 1 && (
              <div className="flex items-center gap-2 mb-2">
                <div className={ds(bStyle, "sectionDot")} />
                <h3 className={`${ds(bStyle, "sectionTitle")} text-sm`}>{sp.name}</h3>
                <div className={ds(bStyle, "sectionLine")} />
              </div>
            )}
              <PublicBracketSection
              groups={spGroups}
              labelGroups={groups}
              matches={spMatches}
              teams={teams}
                slots={slots}
              tournament={tournament}
              phases={phases}
              showAllOnly
              favoriteTeam={favoriteTeam}
              scrollToGroupId={favTargetGroupId}
              formatName={sp.name}
            />
          </div>
        );
      })}
    </div>
  );
};

// Knockout preview
const KnockoutPreview = ({ matches, teams, slots = [], favoriteTeam, allMatches, phases, groups, tournament, groupTeams, scoringSystems }: { matches: any[]; teams: any[]; slots?: any[]; favoriteTeam: string | null; allMatches?: any[]; phases?: any[]; groups?: any[]; tournament?: any; groupTeams?: any[]; scoringSystems?: any[] }) => {
  const bStyle = useBroadcastStyle();
  const matchCardWrapperCls = ds(bStyle, "matchCardWrapper") || "rounded-xl border border-border/60 bg-card overflow-hidden shadow-sm";

  const favMatches = matches.filter((m: any) => m.home_team_id === favoriteTeam || m.away_team_id === favoriteTeam);
  const nextFavMatch = favMatches.find((m: any) => !m.is_played) || favMatches[favMatches.length - 1];

  let otherMatch: any = null;
  if (nextFavMatch) {
    const pool = allMatches || matches;
    const matchName = nextFavMatch.match_name || "";
    
    const slotRefsMatch = (slot: string | null, name: string) => {
      if (!slot || !name) return false;
      const ref = slot.match(/^Winnaar\s+(.+)$/i);
      if (!ref) return false;
      const r = ref[1].toLowerCase(), n = name.toLowerCase();
      return r === n || n.startsWith(r) || r.startsWith(n);
    };

    const nextRoundMatch = pool.find((m: any) =>
      slotRefsMatch(m.home_slot_label, matchName) || slotRefsMatch(m.away_slot_label, matchName)
    );
    
    if (nextRoundMatch) {
      const ourSlotIsHome = slotRefsMatch(nextRoundMatch.home_slot_label, matchName);
      const otherSlot: string | null = ourSlotIsHome ? nextRoundMatch.away_slot_label : nextRoundMatch.home_slot_label;
      if (otherSlot) {
        const otherRef = otherSlot.match(/^Winnaar\s+(.+)$/i);
        if (otherRef) {
          const r = otherRef[1].toLowerCase();
          otherMatch = pool.find((m: any) => m.match_name?.toLowerCase() === r)
            || pool.find((m: any) => m.match_name && (m.match_name.toLowerCase().startsWith(r) || r.startsWith(m.match_name.toLowerCase())) && m.id !== nextFavMatch?.id);
        }
      }
    }

    if (!otherMatch && nextFavMatch.home_slot_label) {
      const sMatch = nextFavMatch.home_slot_label.match(/^S(\d+)$/);
      if (sMatch) {
        const sNum = parseInt(sMatch[1]);
        const groupBase = Math.floor((sNum - 1) / 4) * 4;
        const siblingHome = sNum <= groupBase + 2 ? `S${groupBase + 3}` : `S${groupBase + 1}`;
        otherMatch = pool.find((m: any) => m.home_slot_label === siblingHome && m.phase_id === nextFavMatch.phase_id && m.group_id === nextFavMatch.group_id);
      }
    }

    if (!otherMatch && nextFavMatch.home_slot_label?.startsWith("Winnaar")) {
      const allNextRound = pool.filter((m: any) =>
        m.home_slot_label?.startsWith("Winnaar") && m.away_slot_label?.startsWith("Winnaar") &&
        m.phase_id === nextFavMatch.phase_id && m.group_id === nextFavMatch.group_id
      );
      for (const nrm of allNextRound) {
        const homeRef = nrm.home_slot_label.match(/^Winnaar\s+(.+)$/i)?.[1] || "";
        const awayRef = nrm.away_slot_label.match(/^Winnaar\s+(.+)$/i)?.[1] || "";
        const homeRefMatch = pool.find((m: any) => m.match_name?.toLowerCase() === homeRef.toLowerCase()
          || (m.match_name && (m.match_name.toLowerCase().startsWith(homeRef.toLowerCase()) || homeRef.toLowerCase().startsWith(m.match_name.toLowerCase()))));
        const awayRefMatch = pool.find((m: any) => m.match_name?.toLowerCase() === awayRef.toLowerCase()
          || (m.match_name && (m.match_name.toLowerCase().startsWith(awayRef.toLowerCase()) || awayRef.toLowerCase().startsWith(m.match_name.toLowerCase()))));
        if (homeRefMatch?.id === nextFavMatch.id && awayRefMatch && awayRefMatch.id !== nextFavMatch.id) {
          otherMatch = awayRefMatch;
          break;
        }
        if (awayRefMatch?.id === nextFavMatch.id && homeRefMatch && homeRefMatch.id !== nextFavMatch.id) {
          otherMatch = homeRefMatch;
          break;
        }
      }
    }
  }

  const display = [nextFavMatch, otherMatch].filter(Boolean);
  if (display.length === 0) {
    const fallback = favMatches.length > 0 ? favMatches.slice(0, 3) : matches.slice(0, 3);
    return (
      <div className="space-y-2">
          {fallback.map((m: any) => (
          <div key={m.id} className={matchCardWrapperCls}>
            <PublicMatchCard match={m} teams={teams} phases={phases || []} groups={groups || []} slots={slots} tournament={tournament} allMatches={matches} favoriteTeam={favoriteTeam} hideContext />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {nextFavMatch && (
        <div>
          <p className="text-[9px] font-black uppercase tracking-[0.15em] text-primary mb-1">Jouw wedstrijd</p>
          <div className={matchCardWrapperCls}>
            <PublicMatchCard match={nextFavMatch} teams={teams} phases={phases || []} groups={groups || []} slots={slots} tournament={tournament} allMatches={matches} favoriteTeam={favoriteTeam} hideContext />
          </div>
        </div>
      )}
      {otherMatch && (
        <div className="pt-2 border-t border-border">
          <p className="text-[9px] font-black uppercase tracking-[0.15em] text-muted-foreground mb-1">Mogelijke tegenstander</p>
          <div className={matchCardWrapperCls}>
            <PublicMatchCard match={otherMatch} teams={teams} phases={phases || []} groups={groups || []} slots={slots} tournament={tournament} allMatches={matches} favoriteTeam={favoriteTeam} hideContext />
          </div>
        </div>
      )}
    </div>
  );
};




// Broadcast-style grid card
const GridCard = ({ title, icon, onClick, children }: { title: string; icon?: React.ReactNode; onClick?: () => void; children: React.ReactNode }) => {
  const bStyle = useBroadcastStyle();
  const headerCls = ds(bStyle, "homeCardHeader") || ds(bStyle, "cardHeader");
  const titleCls = ds(bStyle, "homeCardHeaderTitle") || ds(bStyle, "cardHeaderTitle");
  return (
    <div className={`${ds(bStyle, "card")} ${onClick ? "cursor-pointer hover:border-primary/30 hover:shadow-md transition-all" : ""}`}
      onClick={onClick}>
      <div className={`flex items-center justify-between ${headerCls}`}>
        <div className="flex items-center gap-2">
          {icon && <span className="text-primary">{icon}</span>}
          <h3 className={titleCls}>{title}</h3>
        </div>
        {onClick && <ChevronRight className="h-4 w-4 text-primary" />}
      </div>
      <div className="p-3">{children}</div>
    </div>
  );
};

// Compact standings
const CompactStanding = ({ standings, favoriteTeam, tournament }: { standings: any[]; favoriteTeam: string | null; tournament: any }) => {
  const bStyle = useBroadcastStyle();
  let visible = standings;
  const total = standings.length;

  if (favoriteTeam) {
    const idx = standings.findIndex((r: any) => r.team?.id === favoriteTeam);
    if (total <= 6) {
      visible = standings;
    } else {
      const start = Math.max(0, Math.min(idx - 2, total - 5));
      visible = standings.slice(start, start + 5);
    }
  } else {
    visible = standings.slice(0, 6);
  }

  return (
    <div className="space-y-0.5">
      <div className="flex items-center gap-2 px-2 py-1 text-[8px] font-black uppercase tracking-[0.15em] text-muted-foreground">
        <span className="w-5 text-center">#</span>
        <span className="flex-1">Team</span>
        <span className="w-5 text-center">GS</span>
        <span className="w-8 text-center">P</span>
        <span className="w-8 text-center">DS</span>
      </div>
      {visible.map((row: any) => (
        <div key={row.team?.id} className="flex items-center gap-2 px-2 py-1.5 text-xs rounded-md">
          <span className="w-5 text-center font-black text-muted-foreground">{row.pos}</span>
          <div className="h-5 w-5 overflow-hidden flex-shrink-0">
            {row.team?.logo_url ? <img src={row.team.logo_url} alt="" className="h-full w-full object-contain" /> :
              <div className="flex h-full w-full items-center justify-center text-[8px] font-black text-muted-foreground bg-secondary">{row.team?.name?.charAt(0)}</div>}
          </div>
          <div className="flex items-center gap-1 flex-1 min-w-0">
            <span className={`font-bold truncate ${favoriteTeam === row.team?.id ? "text-primary" : "text-foreground"}`}>{row.team?.name}</span>
            {tournament?.show_country && row.team?.country && <CountryFlag country={row.team.country} className="h-2.5 w-3.5 object-contain flex-shrink-0" />}
          </div>
          <span className="w-5 text-center text-muted-foreground">{row.gp}</span>
          <span className="w-8 text-center">
            <span className={`inline-flex items-center justify-center bg-primary/15 px-1 py-0.5 text-[10px] font-black text-primary rounded`}>{row.pts}</span>
          </span>
          <span className="w-8 text-center text-muted-foreground font-bold">{row.gd > 0 ? `+${row.gd}` : row.gd}</span>
        </div>
      ))}
    </div>
  );
};

// Match list view — each card wrapped in its own rounded container with spacing
const MatchListView = ({ matches, teams, phases, groups, slots = [], favoriteTeam, compact, tournament, onCardClick, groupTeams, scoringSystems }: {
  matches: any[]; teams: any[]; phases: any[]; groups: any[]; slots?: any[]; favoriteTeam: string | null; compact?: boolean; tournament?: any;
  onCardClick?: () => void; groupTeams?: any[]; scoringSystems?: any[];
}) => {
  const bStyle = useBroadcastStyle();
  return (
    <div className="space-y-2">
      {matches.map((m: any) => {
        const positions = getMatchTeamPositions(m, groupTeams || [], matches, groups, phases, scoringSystems || [], tournament);
        return (
        <div key={m.id} className={ds(bStyle, "matchCardWrapper") || "rounded-xl border border-border/60 bg-card overflow-hidden shadow-sm"}>
          <PublicMatchCard
            match={m}
            teams={teams}
            phases={phases}
            groups={groups}
            slots={slots}
            tournament={tournament}
            allMatches={matches}
            favoriteTeam={favoriteTeam}
            onCardClick={onCardClick}
            {...positions}
          />
        </div>
      );})}
    </div>
  );
};

// Full standing table for expanded view
const StandingTable = ({ standings, favoriteTeam, tournament, standingColors, phaseId }: {
  standings: any[]; favoriteTeam: string | null; tournament: any; standingColors: any[]; phaseId: string;
}) => {
  const bStyle = useBroadcastStyle();
  const getColor = (pos: number) => standingColors.find((sc: any) => sc.phase_id === phaseId && pos >= sc.position_from && pos <= sc.position_to);

  return (
    <div className={ds(bStyle, "card") || "rounded-xl border border-border overflow-hidden bg-card shadow-sm"}>
      <div className="overflow-x-auto">
        <table className="ttx-standings-table w-full text-xs">
          <thead>
            <tr className={ds(bStyle, "tableHeader") || "bg-primary/10 text-[10px] font-black uppercase tracking-wider text-muted-foreground border-b-2 border-primary/30"}>
              <th className="w-8 px-1.5 py-2.5 text-left">#</th>
              <th className="px-1.5 py-2.5 text-left">Team</th>
              <th className="w-7 px-0.5 py-2.5 text-center">GS</th>
              <th className="w-7 px-0.5 py-2.5 text-center">W</th>
              <th className="w-7 px-0.5 py-2.5 text-center">G</th>
              <th className="w-7 px-0.5 py-2.5 text-center">V</th>
              <th className="w-8 px-0.5 py-2.5 text-center">DS</th>
              <th className="w-8 px-0.5 py-2.5 text-center">P</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {standings.map((row: any) => {
              const colorZone = getColor(row.pos);
              return (
                <tr key={row.team?.id}>
                  <td className="px-1.5 py-2">
                    <div className="flex items-center gap-1">
                      {colorZone && <div className="w-1 h-5 rounded-full flex-shrink-0" style={{ backgroundColor: colorZone.color }} />}
                      <span className="font-black text-muted-foreground">{row.pos}</span>
                    </div>
                  </td>
                  <td className="px-1.5 py-2">
                    <div className="flex items-center gap-1.5">
                      <div className="h-6 w-6 overflow-hidden flex-shrink-0">
                        {row.team?.logo_url ? <img src={row.team.logo_url} alt="" className="h-full w-full object-contain" /> :
                          <div className="flex h-full w-full items-center justify-center text-[8px] font-black text-muted-foreground bg-secondary">{row.team?.name?.charAt(0)}</div>}
                      </div>
                      <span className={`font-bold ${favoriteTeam === row.team?.id ? "ttx-fav-team text-primary" : "text-foreground"}`}>{row.team?.name}</span>
                      {tournament?.show_country && row.team?.country && <CountryFlag country={row.team.country} className="h-2.5 w-3.5 object-contain" />}
                    </div>
                  </td>
                  <td className="text-center px-0.5 py-2 text-muted-foreground">{row.gp}</td>
                  <td className="text-center px-0.5 py-2 font-bold">{row.w}</td>
                  <td className="text-center px-0.5 py-2 text-muted-foreground">{row.d}</td>
                  <td className="text-center px-0.5 py-2 text-muted-foreground">{row.l}</td>
                  <td className="text-center px-0.5 py-2 font-bold">{row.gd > 0 ? `+${row.gd}` : row.gd}</td>
                  <td className="text-center px-0.5 py-2">
                    <span className={ds(bStyle, "ptsBadge") || `inline-flex items-center justify-center bg-primary/15 px-1.5 py-0.5 font-black text-primary rounded`}>{row.pts}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// Expanded Programma timeslot list (homepage inline view)
const ProgrammaTimeslotList = ({ matches, teams, phases, groups, slots, tournament, favoriteTeam, bStyle, scrollToLatest, groupTeams, scoringSystems }: any) => {
  const targetRef = useRef<HTMLDivElement>(null);
  const sorted = [...matches].sort((a: any, b: any) => {
    const dateA = a.match_date || "9999";
    const dateB = b.match_date || "9999";
    if (dateA !== dateB) return dateA.localeCompare(dateB);
    const timeA = a.match_time || "99:99";
    const timeB = b.match_time || "99:99";
    if (timeA !== timeB) return timeA.localeCompare(timeB);
    return (a.field || "").localeCompare(b.field || "");
  });

  const timeslots: { key: string; date: string; time: string; matches: any[] }[] = [];
  const slotMap: Record<string, any[]> = {};
  sorted.forEach((m: any) => {
    const key = `${m.match_date || "nodate"}_${m.match_time || "notime"}`;
    if (!slotMap[key]) {
      slotMap[key] = [];
      timeslots.push({ key, date: m.match_date || "", time: m.match_time || "", matches: slotMap[key] });
    }
    slotMap[key].push(m);
  });

  const targetMatchId = scrollToLatest
    ? sorted[sorted.length - 1]?.id
    : sorted.find((m: any) => !m.is_played)?.id || sorted[0]?.id;

  const formatDate = (d: string) => {
    if (!d) return "Geen datum";
    return new Date(d).toLocaleDateString("nl-BE", { weekday: "long", day: "numeric", month: "long" });
  };

  useEffect(() => {
    if (!targetMatchId) return;
    const raf = requestAnimationFrame(() => {
      setTimeout(() => {
        const el = targetRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const scrollY = window.scrollY + rect.top - 120;
        window.scrollTo({ top: Math.max(0, scrollY), behavior: "instant" });
      }, 100);
    });
    return () => cancelAnimationFrame(raf);
  }, [targetMatchId]);

  let lastDate = "";

  return (
    <div className="space-y-3">
      {timeslots.map(slot => {
        const showDateHeader = slot.date !== lastDate;
        lastDate = slot.date;
        return (
          <div key={slot.key} className="space-y-1">
            {showDateHeader && (
              <div className="flex items-center gap-2 py-1">
                <div className={ds(bStyle, "dateHeader")}>{formatDate(slot.date)}</div>
                {bStyle !== "teletext" && <div className={ds(bStyle, "sectionLine")} />}
              </div>
            )}
            <div className={ds(bStyle, "card")}>
              <div className={ds(bStyle, "timeslotHeader")}>
                {slot.time && (
                  <span className={ds(bStyle, "timeslotBadge") || ds(bStyle, "badge")}>{slot.time.slice(0, 5)}</span>
                )}
                <span className={ds(bStyle, "timeslotHeaderMeta") || "text-[10px] font-bold text-muted-foreground uppercase tracking-wider"}>
                  {slot.matches.length} wedstrijd{slot.matches.length !== 1 ? "en" : ""}
                </span>
              </div>
              <div className="p-2 space-y-2">
                {slot.matches.map((m: any) => {
                  const positions = getMatchTeamPositions(m, groupTeams || [], matches, groups, phases, scoringSystems || [], tournament);
                  return (
                  <div
                    key={m.id}
                    ref={m.id === targetMatchId ? targetRef : undefined}
                    className={ds(bStyle, "matchCardWrapper") || "rounded-xl border border-border/60 bg-card overflow-hidden shadow-sm"}
                  >
                    <PublicMatchCard
                      match={m}
                      teams={teams}
                      phases={phases}
                      groups={groups}
                      slots={slots}
                      tournament={tournament}
                      allMatches={matches}
                      favoriteTeam={favoriteTeam}
                      hideRoundNumber
                      {...positions}
                    />
                  </div>
                );})}
              </div>
            </div>
          </div>
        );
      })}
      {timeslots.length === 0 && (
        <p className="text-sm text-muted-foreground font-medium text-center py-4">Geen wedstrijden gevonden.</p>
      )}
    </div>
  );
};

export default PublicHomepage;
