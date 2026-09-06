import { useState } from "react";
import { formatFieldLabel } from "@/lib/fieldLocations";
import { Calendar, Clock, MapPin, ChevronDown } from "lucide-react";
import WhistleIcon from "@/components/icons/WhistleIcon";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useBroadcastStyle } from "@/contexts/BroadcastStyleContext";
import { ds } from "@/lib/broadcastStyles";
import MatchStatsEditor from "@/components/MatchStatsEditor";
import { useScoringSystems } from "@/hooks/useScoringSystems";
import { getMatchFormatSuffix, getBaseMatchName } from "@/lib/matchFormatLabel";
import { getMatchSideDisplayName } from "@/lib/slotLabels";

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

interface PublicMatchDetailDialogProps {
  open: boolean;
  onClose: () => void;
  /** The clicked match (for H&A this can be either Heen or Terug). */
  match: any | null;
  /** Optional paired match for Heen en terug (the other leg). */
  pairedMatch?: any | null;
  teams: Team[];
  tournament: Tournament | null | undefined;
  phases?: any[];
  groups?: any[];
  slots?: any[];
}

const formatDate = (d: string | null | undefined) => {
  if (!d) return null;
  try {
    const dt = new Date(d);
    return dt.toLocaleDateString("nl-BE", { weekday: "short", day: "numeric", month: "short" });
  } catch {
    return d;
  }
};

const formatTime = (t: string | null | undefined) =>
  t ? t.substring(0, 5) : null;

/**
 * Unified Flashscore-style match popup for the public view.
 * Works for:
 *   - Single matches (knockout or single_match)
 *   - Group matches (with sets/best-of)
 *   - Heen en terug pairs (two legs)
 *
 * Title rules:
 *   - Group phase  → group name
 *   - Knockout     → format/phase name + round name underneath
 *   - Single match → match_name as title
 *
 * Body:
 *   - Single/sets: date · time · field · referee row, then logos+names with score, then stats.
 *   - H&A: aggregate header, then per-leg (date/time/field/referee) and per-leg score, with
 *          collapsible stats per leg.
 */
const PublicMatchDetailDialog = ({
  open,
  onClose,
  match,
  pairedMatch,
  teams,
  tournament,
  phases = [],
  groups = [],
  slots = [],
}: PublicMatchDetailDialogProps) => {
  const bStyle = useBroadcastStyle();
  const { systems: scoringSystems } = useScoringSystems(tournament?.id);
  const [expandedLeg, setExpandedLeg] = useState<"heen" | "terug" | null>(null);

  if (!match) return null;

  const isHA = !!pairedMatch;
  const isHeen = match.match_name?.endsWith("(Heen)") ?? false;
  const heenMatch = isHA ? (isHeen ? match : pairedMatch) : match;
  const terugMatch = isHA ? (isHeen ? pairedMatch : match) : null;

  const phase = phases.find((p) => p.id === match.phase_id);
  const group = groups.find((g) => g.id === match.group_id);

  // Title hierarchy
  const isKnockout = phase?.phase_type === "knockout" || phase?.phase_type === "single_match";
  const isSingleMatch = phase?.phase_type === "single_match";
  const formatSuffix = getMatchFormatSuffix(
    match,
    scoringSystems as any,
    phases as any,
    groups as any,
    isHA ? { includeLeg: false } : undefined
  );

  let titleMain = "";
  let titleSub = "";

  if (isSingleMatch) {
    const base = getBaseMatchName(match.match_name) || match.match_name || "Wedstrijd";
    titleMain = `${base}${formatSuffix}`.trim();
  } else if (isKnockout) {
    titleMain = phase?.name || "";
    const base = getBaseMatchName(match.match_name) || match.match_name || "";
    titleSub = `${base}${formatSuffix}`.trim();
  } else {
    // Group phase → format/phase name on top, group name underneath
    titleMain = phase?.name || group?.name || "";
    const parts: string[] = [];
    if (group?.name && group.name !== phase?.name) parts.push(group.name);
    if (formatSuffix) parts.push(formatSuffix.trim());
    titleSub = parts.filter(Boolean).join(" · ");
  }


  // Resolve teams + names (use slot-aware label resolver so TBD slot labels work too)
  const homeTeam = teams.find((t) => t.id === heenMatch?.home_team_id);
  const awayTeam = teams.find((t) => t.id === heenMatch?.away_team_id);
  const homeName = getMatchSideDisplayName(heenMatch, "home", teams, {
    slots, phases, groups, emptyLabel: "TBD",
  });
  const awayName = getMatchSideDisplayName(heenMatch, "away", teams, {
    slots, phases, groups, emptyLabel: "TBD",
  });
  const homeLogo = homeTeam?.logo_url || null;
  const awayLogo = awayTeam?.logo_url || null;

  // Aggregate / score logic
  const haTotal = isHA && heenMatch && terugMatch
    ? (() => {
        const homeTotal = (heenMatch.home_score ?? 0) + (terugMatch.away_score ?? 0);
        const awayTotal = (heenMatch.away_score ?? 0) + (terugMatch.home_score ?? 0);
        const bothPlayed = !!(heenMatch.is_played && terugMatch.is_played);
        const anyScored =
          heenMatch.home_score !== null || heenMatch.away_score !== null ||
          terugMatch.home_score !== null || terugMatch.away_score !== null;
        const isTied = homeTotal === awayTotal && bothPlayed;
        // Penalties staan op de Terug-wedstrijd (in Terug-oriëntatie)
        const homePen = terugMatch.away_penalties ?? 0;
        const awayPen = terugMatch.home_penalties ?? 0;
        const hasPenalties = isTied && homePen !== awayPen;
        return { homeTotal, awayTotal, bothPlayed, anyScored, isTied, hasPenalties, homePen, awayPen };
      })()
    : null;

  const homeWon = haTotal
    ? haTotal.bothPlayed && (haTotal.homeTotal > haTotal.awayTotal || (haTotal.isTied && haTotal.homePen > haTotal.awayPen))
    : !!match.is_played && (
        (match.home_score ?? 0) > (match.away_score ?? 0) ||
        ((match.home_score ?? 0) === (match.away_score ?? 0) && (match.home_penalties ?? 0) > (match.away_penalties ?? 0))
      );
  const awayWon = haTotal
    ? haTotal.bothPlayed && (haTotal.awayTotal > haTotal.homeTotal || (haTotal.isTied && haTotal.awayPen > haTotal.homePen))
    : !!match.is_played && !homeWon && (match.home_score !== null || match.away_score !== null) &&
        ((match.away_score ?? 0) >= (match.home_score ?? 0));

  // Score display
  const homeDisplay = isHA
    ? (haTotal?.anyScored ? haTotal.homeTotal : null)
    : match.home_score;
  const awayDisplay = isHA
    ? (haTotal?.anyScored ? haTotal.awayTotal : null)
    : match.away_score;

  const dialogTournament = tournament ?? {
    id: "",
    enable_goalscorers: false,
    enable_assists: false,
    enable_yellow_cards: false,
    enable_red_cards: false,
  };

  const hasAnyStats =
    dialogTournament.enable_goalscorers ||
    dialogTournament.enable_assists ||
    dialogTournament.enable_yellow_cards ||
    dialogTournament.enable_red_cards;

  // Single/sets meta row
  const MetaRow = ({ m }: { m: any }) => {
    const dateStr = formatDate(m?.match_date);
    const timeStr = formatTime(m?.match_time);
    const fld = formatFieldLabel(m?.field);
    const ref = m?.referee;
    if (!dateStr && !timeStr && !fld && !ref) return null;
    return (
      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        {dateStr && (
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" /> {dateStr}
          </span>
        )}
        {timeStr && (
          <span className="flex items-center gap-1 tabular-nums">
            <Clock className="h-3 w-3" /> {timeStr}
          </span>
        )}
        {fld && (
          <span className="flex items-center gap-1">
            <MapPin className="h-3 w-3" /> {fld}
          </span>
        )}
        {ref && (
          <span className="flex items-center gap-1">
            <WhistleIcon className="h-3 w-3" /> {ref}
          </span>
        )}
      </div>
    );
  };

  const LegHeader = ({ m, label }: { m: any; label: string }) => {
    const dateStr = formatDate(m?.match_date);
    const timeStr = formatTime(m?.match_time);
    const fld = formatFieldLabel(m?.field);
    const ref = m?.referee;
    return (
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider whitespace-nowrap">
          {label}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-x-2 gap-y-0.5 text-[10px] text-muted-foreground">
          {dateStr && (
            <span className="flex items-center gap-0.5"><Calendar className="h-2.5 w-2.5" />{dateStr}</span>
          )}
          {timeStr && (
            <span className="flex items-center gap-0.5 tabular-nums"><Clock className="h-2.5 w-2.5" />{timeStr}</span>
          )}
          {fld && (
            <span className="flex items-center gap-0.5"><MapPin className="h-2.5 w-2.5" />{fld}</span>
          )}
          {ref && (
            <span className="flex items-center gap-0.5"><WhistleIcon className="h-2.5 w-2.5" />{ref}</span>
          )}
        </div>
      </div>
    );
  };

  const renderLegScoreRow = (
    hName: string,
    hLogo: string | null,
    aName: string,
    aLogo: string | null,
    hScore: number | null,
    aScore: number | null,
  ) => {
    const hWin = (hScore ?? 0) > (aScore ?? 0);
    const aWin = (aScore ?? 0) > (hScore ?? 0);
    return (
      <div className={`${ds(bStyle, "card")} overflow-hidden`}>
        <div className={`flex items-center gap-2 px-3 py-1.5`}>
          {hLogo
            ? <img src={hLogo} className="h-5 w-5 object-contain flex-shrink-0" alt="" />
            : <div className="h-5 w-5 bg-secondary rounded text-[8px] flex items-center justify-center font-bold flex-shrink-0">{hName.charAt(0)}</div>}
          <span className={`flex-1 truncate ${ds(bStyle, "matchTeamName")} ${hWin ? "font-bold" : ""}`}>{hName}</span>
          <span className={`text-sm tabular-nums ${hWin ? "font-bold " + ds(bStyle, "matchScoreWin") : ds(bStyle, "matchScoreLose")}`}>{hScore ?? "–"}</span>
        </div>
        <div className={`flex items-center gap-2 px-3 py-1.5 border-t border-border`}>
          {aLogo
            ? <img src={aLogo} className="h-5 w-5 object-contain flex-shrink-0" alt="" />
            : <div className="h-5 w-5 bg-secondary rounded text-[8px] flex items-center justify-center font-bold flex-shrink-0">{aName.charAt(0)}</div>}
          <span className={`flex-1 truncate ${ds(bStyle, "matchTeamName")} ${aWin ? "font-bold" : ""}`}>{aName}</span>
          <span className={`text-sm tabular-nums ${aWin ? "font-bold " + ds(bStyle, "matchScoreWin") : ds(bStyle, "matchScoreLose")}`}>{aScore ?? "–"}</span>
        </div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { setExpandedLeg(null); onClose(); } }}>
      <DialogContent className="max-w-sm p-0 gap-0 overflow-hidden max-h-[90vh] overflow-y-auto">
        {/* Title */}
        <div className={`${ds(bStyle, "matchContext")} px-4 py-2.5 text-center`}>
          {titleMain && (
            <div className={`${ds(bStyle, "matchContextText")}`}>{titleMain}</div>
          )}
          {titleSub && (
            <div className="text-[10px] text-muted-foreground/80 font-medium mt-0.5">{titleSub}</div>
          )}
        </div>

        {/* Single / Sets: meta row */}
        {!isHA && (
          <div className="px-4 pt-3 pb-2">
            <MetaRow m={match} />
          </div>
        )}

        {/* Score header — logos + names + score */}
        <div className="px-4 pt-2 pb-3">
          <div className="flex items-center justify-center gap-3">
            {/* Home */}
            <div className="flex flex-col items-center gap-1.5 min-w-0 flex-1">
              {homeLogo
                ? <img src={homeLogo} className="h-12 w-12 object-contain" alt="" />
                : <div className="h-12 w-12 bg-secondary rounded-lg flex items-center justify-center text-lg font-black text-muted-foreground">{homeName.charAt(0)}</div>}
              <span className={`text-xs text-center w-full ${homeWon ? "font-bold" : ""} ${ds(bStyle, "matchTeamName")}`}>{homeName}</span>
            </div>

            {/* Score */}
            <div className="flex flex-col items-center shrink-0 px-1">
              <span className={`text-3xl font-black tabular-nums tracking-tight ${ds(bStyle, "matchScore")}`}>
                {homeDisplay ?? "–"}<span className="text-muted-foreground/60 mx-1">:</span>{awayDisplay ?? "–"}
              </span>
              {/* Penalties */}
              {!isHA && match.home_penalties !== null && match.away_penalties !== null && (
                <span className="text-[10px] text-muted-foreground font-medium mt-0.5">
                  ({match.home_penalties} – {match.away_penalties} pen.)
                </span>
              )}
              {isHA && haTotal?.hasPenalties && (
                <span className="text-[10px] text-muted-foreground font-medium mt-0.5">
                  ({haTotal.homePen} – {haTotal.awayPen} pen.)
                </span>
              )}
            </div>

            {/* Away */}
            <div className="flex flex-col items-center gap-1.5 min-w-0 flex-1">
              {awayLogo
                ? <img src={awayLogo} className="h-12 w-12 object-contain" alt="" />
                : <div className="h-12 w-12 bg-secondary rounded-lg flex items-center justify-center text-lg font-black text-muted-foreground">{awayName.charAt(0)}</div>}
              <span className={`text-xs text-center w-full ${awayWon ? "font-bold" : ""} ${ds(bStyle, "matchTeamName")}`}>{awayName}</span>
            </div>
          </div>
        </div>

        {/* H&A: legs */}
        {isHA && heenMatch && terugMatch && (
          <>
            {([
              { key: "heen" as const, label: "Wedstrijd 1 (Heen)", m: heenMatch, h: homeName, hl: homeLogo, a: awayName, al: awayLogo, hs: heenMatch.home_score, as: heenMatch.away_score },
              { key: "terug" as const, label: "Wedstrijd 2 (Terug)", m: terugMatch, h: awayName, hl: awayLogo, a: homeName, al: homeLogo, hs: terugMatch.home_score, as: terugMatch.away_score },
            ]).map((leg) => {
              const isExpanded = expandedLeg === leg.key;
              const canExpand = hasAnyStats && leg.m.home_team_id && leg.m.away_team_id;
              return (
                <div key={leg.key} className="px-4 py-3 border-t border-border">
                  <LegHeader m={leg.m} label={leg.label} />
                  {renderLegScoreRow(leg.h, leg.hl, leg.a, leg.al, leg.hs, leg.as)}
                  {canExpand && (
                    <>
                      <button
                        type="button"
                        onClick={() => setExpandedLeg(isExpanded ? null : leg.key)}
                        className="mt-2 w-full flex items-center justify-center gap-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
                      >
                        Statistieken
                        <ChevronDown className={`h-3 w-3 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                      </button>
                      {isExpanded && (
                        <div className="mt-2">
                          <MatchStatsEditor
                            matchId={leg.m.id}
                            tournament={dialogTournament}
                            homeTeamId={leg.m.home_team_id}
                            awayTeamId={leg.m.away_team_id}
                            homeTeamName={leg.h}
                            awayTeamName={leg.a}
                            homeTeamLogo={leg.hl}
                            awayTeamLogo={leg.al}
                            homeScore={leg.hs}
                            awayScore={leg.as}
                            editable={false}
                          />
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </>
        )}

        {/* Single match: stats below */}
        {!isHA && hasAnyStats && match.home_team_id && match.away_team_id && (
          <div className="px-4 pb-4">
            <MatchStatsEditor
              matchId={match.id}
              tournament={dialogTournament}
              homeTeamId={match.home_team_id}
              awayTeamId={match.away_team_id}
              homeTeamName={homeName}
              awayTeamName={awayName}
              homeTeamLogo={homeLogo}
              awayTeamLogo={awayLogo}
              homeScore={match.home_score}
              awayScore={match.away_score}
              editable={false}
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default PublicMatchDetailDialog;
