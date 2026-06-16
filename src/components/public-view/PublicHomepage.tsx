import { useState, useEffect, useRef, useMemo } from "react";
import { Star, ChevronRight, ArrowLeft, Trophy, Zap, Clock, BarChart3, MessageCircle } from "lucide-react";
import { useBroadcastStyle } from "@/contexts/BroadcastStyleContext";
import { ds } from "@/lib/broadcastStyles";
import CountryFlag from "@/components/CountryFlag";
import PublicMatchCard from "@/components/public-view/PublicMatchCard";
import PublicBracketSection from "@/components/public-view/PublicBracketSection";
import type { PublicTournamentData } from "@/pages/PublicView";
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

const PublicHomepage = ({ data, favoriteTeam, toggleFavorite, setActiveTab, homeResetKey }: Props) => {
  const { tournament, teams, matches, groupTeams, groups, phases, slots, stats, standingColors, polls, pollVotes } = data;
  const bStyle = useBroadcastStyle();
  const homeHeaderCls = ds(bStyle, "homeCardHeader") || ds(bStyle, "cardHeader");
  const homeHeaderTitleCls = ds(bStyle, "homeCardHeaderTitle") || ds(bStyle, "cardHeaderTitle");
  const matchCardWrapperCls = ds(bStyle, "matchCardWrapper") || "rounded-xl border border-border/60 bg-card overflow-hidden shadow-sm";
  const [expandedGrid, setExpandedGrid] = useState<string | null>(null);
  const [votedPolls, setVotedPolls] = useState<Record<string, number>>(() => {
    try { return JSON.parse(localStorage.getItem(`poll-votes-${tournament.id}`) || "{}"); } catch { return {}; }
  });

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

  const calcStandings = (groupId: string) => {
    const gts = groupTeams.filter((gt: any) => gt.group_id === groupId);
    const gMatches = matches.filter((m: any) => m.group_id === groupId && m.is_played);
    const ptsWin = tournament?.points_win ?? 3;
    const ptsDraw = tournament?.points_draw ?? 1;
    const rows = gts.map((gt: any) => {
      const team = teams.find((t: any) => t.id === gt.team_id);
      let w = 0, d = 0, l = 0, gf = 0, ga = 0;
      gMatches.forEach((m: any) => {
        if (m.home_team_id === gt.team_id) {
          gf += m.home_score ?? 0; ga += m.away_score ?? 0;
          if ((m.home_score ?? 0) > (m.away_score ?? 0)) w++; else if (m.home_score === m.away_score) d++; else l++;
        } else if (m.away_team_id === gt.team_id) {
          gf += m.away_score ?? 0; ga += m.home_score ?? 0;
          if ((m.away_score ?? 0) > (m.home_score ?? 0)) w++; else if (m.home_score === m.away_score) d++; else l++;
        }
      });
      return { team, gp: w + d + l, w, d, l, gf, ga, gd: gf - ga, pts: w * ptsWin + d * ptsDraw + gt.bonus_points };
    });
    rows.sort((a: any, b: any) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf || b.w - a.w);
    return rows.map((r: any, i: number) => ({ ...r, pos: i + 1 }));
  };

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

    if (expandedGrid === "fav-standing" && favGroup) {
      const standings = calcStandings(favGroup.id);
      return (
        <div className="px-3 pt-4 space-y-4">
          <button onClick={() => setExpandedGrid(null)} className={ds(bStyle, "backButton")}>
            <ArrowLeft className="h-4 w-4" /> Terug
          </button>
          <div className="flex items-center gap-2">
            <div className={ds(bStyle, "sectionDot")} />
            <h2 className={ds(bStyle, "sectionTitle")}>{favGroup.name}</h2>
            <div className={ds(bStyle, "sectionLine")} />
          </div>
          <StandingTable standings={standings} favoriteTeam={favoriteTeam} tournament={tournament} standingColors={standingColors} phaseId={favGroup.phase_id} />
        </div>
      );
    }

    if (expandedGrid === "fav-standing-next" && nextGroupPhaseGroup) {
      const standings = calcStandings(nextGroupPhaseGroup.id);
      return (
        <div className="px-3 pt-4 space-y-4">
          <button onClick={() => setExpandedGrid(null)} className={ds(bStyle, "backButton")}>
            <ArrowLeft className="h-4 w-4" /> Terug
          </button>
          <div className="flex items-center gap-2">
            <div className={ds(bStyle, "sectionDot")} />
            <h2 className={ds(bStyle, "sectionTitle")}>{nextGroupPhaseGroup.name}</h2>
            <div className={ds(bStyle, "sectionLine")} />
          </div>
          <StandingTable standings={standings} favoriteTeam={favoriteTeam} tournament={tournament} standingColors={standingColors} phaseId={nextGroupPhaseGroup.phase_id} />
        </div>
      );
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

      // Find the bracket group containing the favorite team to scroll to
      const favGroupForScroll = favoriteTeam ? groups.find((g: any) =>
        matches.some((m: any) => m.phase_id === bracketPhaseId && m.group_id === g.id && (m.home_team_id === favoriteTeam || m.away_team_id === favoriteTeam))
      ) : null;

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
        <MatchListView matches={matchList} teams={teams} phases={phases} groups={groups} slots={slots} favoriteTeam={favoriteTeam} tournament={tournament} />
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
        {tournament.logo_url && <img src={tournament.logo_url} alt="" className="h-10 w-10 rounded-xl object-contain shadow-sm" />}
        <div className="flex-1 min-w-0">
          <h1 className="font-display font-black text-foreground leading-tight text-lg uppercase tracking-wide truncate">{tournament.name}</h1>
        </div>
      </div>

      {/* No favorite chosen → prompt */}
      {!favoriteTeam && (
        <div className={`${ds(bStyle, "card")} p-4`}>
          <label className={`${ds(bStyle, "label")} mb-2 block flex items-center gap-1.5`}>
            <Star className="h-3 w-3" /> Kies je favoriete team
          </label>
          <Select value="" onValueChange={(v) => toggleFavorite(v)}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Selecteer je favoriete team" />
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
      )}

      {/* === FAVORITE TEAM BLOCK (everything about my team grouped together in one container) === */}
      {favoriteTeam && favTeamObj && (
        <div className={`${ds(bStyle, "card")}`}>
          {/* Colored header bar */}
          <div className={`flex items-center justify-between ${homeHeaderCls}`}>
            <div className="flex items-center gap-2">
              <Star className="h-3.5 w-3.5" />
              <h2 className={homeHeaderTitleCls}>Mijn team</h2>
            </div>
            <button
              onClick={() => toggleFavorite(favoriteTeam)}
              className={`${homeHeaderTitleCls} opacity-80 hover:opacity-100`}
            >
              Wijzigen
            </button>
          </div>

          {/* Body */}
          <div className="divide-y divide-border">
            {/* Compact favorite team card with logo + name */}
            <div className="px-3 py-2 flex items-center gap-2.5">
              {favTeamObj.logo_url ? (
                <img src={favTeamObj.logo_url} alt="" className="h-7 w-7 object-contain shrink-0" />
              ) : (
                <div className="h-7 w-7 rounded-md bg-muted flex items-center justify-center shrink-0">
                  <Star className="h-3 w-3 text-muted-foreground" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-black text-foreground uppercase tracking-wide truncate">{favTeamObj.name}</p>
              </div>
              {favTeamObj.country && (
                <CountryFlag country={favTeamObj.country} className="h-4 w-6 rounded-sm shrink-0" />
              )}
            </div>

            {/* Wedstrijden — laatste resultaat + volgende wedstrijd, klikbaar voor volledig overzicht */}
            {(lastFavMatch || nextFavMatch) && (
              <div
                className="cursor-pointer hover:bg-muted/30 transition-colors"
                onClick={() => setExpandedGrid("fav-matches")}
              >
                <div className={ds(bStyle, "subHeader")}>
                  <div className="flex items-center gap-2">
                    <Clock className="h-3 w-3" />
                    <span className={ds(bStyle, "subHeaderTitle")}>Wedstrijden</span>
                  </div>
                  <ChevronRight className="h-3 w-3" />
                </div>
                <div className="px-3 pt-3 pb-3 space-y-3">
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
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Stand in groepsfase of bracketboom */}
            {showCurrentKnockout && activeKnockout && (() => {
              const bracketLabel = getBracketGridCardTitle(activeKnockout);
              return (
                <div
                  className="cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => setExpandedGrid(`fav-bracket:${activeKnockout.id}`)}
                >
                  <div className={ds(bStyle, "subHeader")}>
                    <div className="flex items-center gap-2">
                      <Trophy className="h-3 w-3" />
                      <span className={ds(bStyle, "subHeaderTitle")}>{bracketLabel}</span>
                    </div>
                    <ChevronRight className="h-3 w-3" />
                  </div>
                  <div className="px-3 pb-3 pt-2">
                    <KnockoutPreview matches={matches.filter((m: any) => m.phase_id === activeKnockout.id)} teams={teams} slots={slots} favoriteTeam={favoriteTeam} allMatches={matches} phases={phases} groups={groups} tournament={tournament} />
                  </div>
                </div>
              );
            })()}

            {!showCurrentKnockout && !showBracketInstead && !showNextGroupInstead && favGroup && favStandings.length > 0 && (
              <div
                className="cursor-pointer hover:bg-muted/30 transition-colors"
                onClick={() => setExpandedGrid("fav-standing")}
              >
                <div className={ds(bStyle, "subHeader")}>
                  <div className="flex items-center gap-2">
                    <Trophy className="h-3 w-3" />
                    <span className={ds(bStyle, "subHeaderTitle")}>{favGroup.name} – Klassement</span>
                  </div>
                  <ChevronRight className="h-3 w-3" />
                </div>
                <div className="px-3 pb-3 pt-2">
                  <CompactStanding standings={favStandings} favoriteTeam={favoriteTeam} tournament={tournament} />
                </div>
              </div>
            )}

            {!showCurrentKnockout && showNextGroupInstead && nextGroupPhaseGroup && (
              <div
                className="cursor-pointer hover:bg-muted/30 transition-colors"
                onClick={() => setExpandedGrid("fav-standing-next")}
              >
                <div className={ds(bStyle, "subHeader")}>
                  <div className="flex items-center gap-2">
                    <Trophy className="h-3 w-3" />
                    <span className={ds(bStyle, "subHeaderTitle")}>{nextGroupPhaseGroup.name} – Klassement</span>
                  </div>
                  <ChevronRight className="h-3 w-3" />
                </div>
                <div className="px-3 pb-3 pt-2">
                  <CompactStanding standings={calcStandings(nextGroupPhaseGroup.id)} favoriteTeam={favoriteTeam} tournament={tournament} />
                </div>
              </div>
            )}

            {!showCurrentKnockout && showBracketInstead && nextKnockoutPhase && (() => {
              const bracketLabel = getBracketGridCardTitle(nextKnockoutPhase);
              return (
                <div
                  className="cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => setExpandedGrid(`fav-bracket:${nextKnockoutPhase.id}`)}
                >
                  <div className={ds(bStyle, "subHeader")}>
                    <div className="flex items-center gap-2">
                      <Trophy className="h-3 w-3" />
                      <span className={ds(bStyle, "subHeaderTitle")}>{bracketLabel}</span>
                    </div>
                    <ChevronRight className="h-3 w-3" />
                  </div>
                  <div className="px-3 pb-3 pt-2">
                    <KnockoutPreview matches={matches.filter((m: any) => m.phase_id === nextKnockoutPhase.id)} teams={teams} slots={slots} favoriteTeam={favoriteTeam} allMatches={matches} phases={phases} groups={groups} tournament={tournament} />
                  </div>
                </div>
              );
            })()}


          </div>
        </div>
      )}

      {/* === GLOBAL: Laatste resultaten === */}
      {lastBlockMatches.length > 0 && (
        <div className={`${ds(bStyle, "card")} cursor-pointer`} onClick={() => setExpandedGrid("last-results")}>
          <div className={`flex items-center justify-between ${homeHeaderCls}`}>
            <div className="flex items-center">
              <Clock className="h-3.5 w-3.5 ml-2" />
              <h2 className={`${homeHeaderTitleCls} ml-2`}>Laatste resultaten</h2>
            </div>
            <ChevronRight className="h-4 w-4 mr-2" />
          </div>
          <div className="px-3 py-3">
            <MatchListView matches={lastBlockMatches} teams={teams} phases={phases} groups={groups} slots={slots} favoriteTeam={favoriteTeam} compact tournament={tournament} />
          </div>
        </div>
      )}

      {/* === GLOBAL: Volgende wedstrijden === */}
      {nextBlockMatchesAll.length > 0 && (
        <div className={`${ds(bStyle, "card")} cursor-pointer`} onClick={() => setExpandedGrid("next-block")}>
          <div className={`flex items-center justify-between ${homeHeaderCls}`}>
            <div className="flex items-center">
              <Clock className="h-3.5 w-3.5 ml-2" />
              <h2 className={`${homeHeaderTitleCls} ml-2`}>Volgende wedstrijden</h2>
            </div>
            <ChevronRight className="h-4 w-4 mr-2" />
          </div>
          <div className="px-3 py-3">
            <MatchListView matches={nextBlockMatches} teams={teams} phases={phases} groups={groups} slots={slots} favoriteTeam={favoriteTeam} compact tournament={tournament} />
          </div>
        </div>
      )}

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
            const label = siblings.length === 1 ? siblings[0].name : `Fase ${pn}`;
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
const KnockoutPreview = ({ matches, teams, slots = [], favoriteTeam, allMatches, phases, groups, tournament }: { matches: any[]; teams: any[]; slots?: any[]; favoriteTeam: string | null; allMatches?: any[]; phases?: any[]; groups?: any[]; tournament?: any }) => {

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
      <div className="divide-y divide-border">
        {fallback.map((m: any) => (
          <PublicMatchCard key={m.id} match={m} teams={teams} phases={phases || []} groups={groups || []} slots={slots} tournament={tournament} allMatches={matches} favoriteTeam={favoriteTeam} hideContext />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {nextFavMatch && (
        <div>
          <p className="text-[9px] font-black uppercase tracking-[0.15em] text-primary mb-1">Jouw wedstrijd</p>
          <div className="divide-y divide-border rounded-lg border border-border overflow-hidden">
            <PublicMatchCard match={nextFavMatch} teams={teams} phases={phases || []} groups={groups || []} slots={slots} tournament={tournament} allMatches={matches} favoriteTeam={favoriteTeam} hideContext />
          </div>
        </div>
      )}
      {otherMatch && (
        <div className="pt-2 border-t border-border">
          <p className="text-[9px] font-black uppercase tracking-[0.15em] text-muted-foreground mb-1">Mogelijke tegenstander</p>
          <div className="divide-y divide-border rounded-lg border border-border overflow-hidden">
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
      {visible.map((row: any, idx: number) => (
        <div key={row.team?.id} className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-xs ${
          favoriteTeam === row.team?.id ? "bg-primary/10 border border-primary/20" : idx % 2 === 1 ? "bg-secondary/30" : ""
        }`}>
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
            <span className="inline-flex items-center justify-center rounded bg-primary/15 px-1 py-0.5 text-[10px] font-black text-primary">{row.pts}</span>
          </span>
          <span className="w-8 text-center text-muted-foreground font-bold">{row.gd > 0 ? `+${row.gd}` : row.gd}</span>
        </div>
      ))}
    </div>
  );
};

// Match list view — each card wrapped in its own rounded container with spacing
const MatchListView = ({ matches, teams, phases, groups, slots = [], favoriteTeam, compact, tournament }: {
  matches: any[]; teams: any[]; phases: any[]; groups: any[]; slots?: any[]; favoriteTeam: string | null; compact?: boolean; tournament?: any;
}) => {
  const bStyle = useBroadcastStyle();
  return (
    <div className="space-y-2">
      {matches.map((m: any) => (
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
          />
        </div>
      ))}
    </div>
  );
};

// Full standing table for expanded view
const StandingTable = ({ standings, favoriteTeam, tournament, standingColors, phaseId }: {
  standings: any[]; favoriteTeam: string | null; tournament: any; standingColors: any[]; phaseId: string;
}) => {
  const getColor = (pos: number) => standingColors.find((sc: any) => sc.phase_id === phaseId && pos >= sc.position_from && pos <= sc.position_to);

  return (
    <div className="rounded-xl border border-border overflow-hidden bg-card shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-primary/10 text-[10px] font-black uppercase tracking-wider text-muted-foreground border-b-2 border-primary/30">
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
            {standings.map((row: any, idx: number) => {
              const colorZone = getColor(row.pos);
              return (
                <tr key={row.team?.id} className={`${favoriteTeam === row.team?.id ? "bg-primary/5" : idx % 2 === 1 ? "bg-secondary/20" : ""}`}>
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
                      <span className={`font-bold ${favoriteTeam === row.team?.id ? "text-primary" : "text-foreground"}`}>{row.team?.name}</span>
                      {tournament?.show_country && row.team?.country && <CountryFlag country={row.team.country} className="h-2.5 w-3.5 object-contain" />}
                    </div>
                  </td>
                  <td className="text-center px-0.5 py-2 text-muted-foreground">{row.gp}</td>
                  <td className="text-center px-0.5 py-2 font-bold">{row.w}</td>
                  <td className="text-center px-0.5 py-2 text-muted-foreground">{row.d}</td>
                  <td className="text-center px-0.5 py-2 text-muted-foreground">{row.l}</td>
                  <td className="text-center px-0.5 py-2 font-bold">{row.gd > 0 ? `+${row.gd}` : row.gd}</td>
                  <td className="text-center px-0.5 py-2">
                    <span className="inline-flex items-center justify-center rounded bg-primary/15 px-1.5 py-0.5 font-black text-primary">{row.pts}</span>
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

export default PublicHomepage;
