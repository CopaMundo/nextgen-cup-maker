import { useState } from "react";
import { MapPin } from "lucide-react";
import WhistleIcon from "@/components/icons/WhistleIcon";
import { useBroadcastStyle } from "@/contexts/BroadcastStyleContext";
import { ds } from "@/lib/broadcastStyles";
import { getMatchSideDisplayName } from "@/lib/slotLabels";
import PublicMatchDetailDialog from "@/components/public-view/PublicMatchDetailDialog";
import { useScoringSystems } from "@/hooks/useScoringSystems";
import { getMatchFormatSuffix, getBaseMatchName } from "@/lib/matchFormatLabel";

interface PublicMatchCardProps {
  match: any;
  teams: any[];
  phases?: any[];
  groups?: any[];
  slots?: any[];
  tournament?: any;
  /** When provided, used to find the paired H&A match for the popup. */
  allMatches?: any[];
  favoriteTeam?: string | null;
  hideContext?: boolean;
  extraContext?: string;
  hideRoundNumber?: boolean;
  /** When provided, overrides the default match-detail dialog open. */
  onCardClick?: () => void;
}

const getTeamName = (teams: any[], id: string | null) => teams.find((t) => t.id === id)?.name || "–";
const getTeamLogo = (teams: any[], id: string | null) => teams.find((t) => t.id === id)?.logo_url;

const PublicMatchCard = ({
  match: m,
  teams,
  phases = [],
  groups = [],
  slots = [],
  tournament,
  allMatches,
  favoriteTeam,
  hideContext,
  extraContext,
  hideRoundNumber,
}: PublicMatchCardProps) => {
  const bStyle = useBroadcastStyle();
  const phase = phases.find((p) => p.id === m.phase_id);
  const group = groups.find((g) => g.id === m.group_id);
  const isFav = favoriteTeam && (m.home_team_id === favoriteTeam || m.away_team_id === favoriteTeam);

  const { systems: scoringSystems } = useScoringSystems(tournament?.id);
  // Format suffix: "(Heen)" / "(Terug)" + "(N sets)" / "(beste van N)"
  const formatSuffix = getMatchFormatSuffix(m, scoringSystems as any, phases as any, groups as any);

  // Build structured context lines
  const isKnockout = phase?.phase_type === "knockout" || phase?.phase_type === "single_match";
  let formatName = "";
  let detailLine = "";

  if (isKnockout) {
    formatName = extraContext || phase?.name || "";
    // Strip leg from match_name; getMatchFormatSuffix re-appends it consistently.
    const baseMatchName = getBaseMatchName(m.match_name) || "";
    detailLine = `${baseMatchName}${formatSuffix}`.trim();
  } else {
    formatName = extraContext || phase?.name || "";
    if (!hideContext) {
      const parts: string[] = [];
      if (group?.name && group.name !== phase?.name) parts.push(group.name);
      detailLine = parts.join(" ● ");
    }
    if (formatSuffix) {
      detailLine = `${detailLine}${detailLine ? " " : ""}${formatSuffix.trim()}`;
    }
  }

  const homeName = getMatchSideDisplayName(m, "home", teams, { slots, phases, groups, emptyLabel: "TBD" });
  const awayName = getMatchSideDisplayName(m, "away", teams, { slots, phases, groups, emptyLabel: "TBD" });
  const homeLogo = getTeamLogo(teams, m.home_team_id);
  const awayLogo = getTeamLogo(teams, m.away_team_id);

  const hasPenalties = m.home_penalties != null && m.away_penalties != null;
  const homeWin = m.is_played && ((m.home_score ?? 0) > (m.away_score ?? 0) || ((m.home_score ?? 0) === (m.away_score ?? 0) && hasPenalties && (m.home_penalties ?? 0) > (m.away_penalties ?? 0)));
  const awayWin = m.is_played && ((m.away_score ?? 0) > (m.home_score ?? 0) || ((m.home_score ?? 0) === (m.away_score ?? 0) && hasPenalties && (m.away_penalties ?? 0) > (m.home_penalties ?? 0)));

  const renderTeamRow = (name: string, logo: string | undefined, teamId: string | null, penalties: number | null, score: number | null, isWin: boolean) => (
    <div className={`flex h-10 items-center gap-2 ${ds(bStyle, "matchTeamRow") || "rounded-md"} px-2 transition-colors`}>
      <div className="h-7 w-7 flex-shrink-0 overflow-hidden">
        {logo ? (
          <img src={logo} className="h-full w-full object-contain" alt="" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-secondary text-[10px] font-black text-muted-foreground">{name.charAt(0)}</div>
        )}
      </div>
      <span className={`ttx-team-name flex-1 truncate ${ds(bStyle, "matchTeamName")} ${teamId === favoriteTeam ? `ttx-fav-team ${ds(bStyle, "matchTeamNameFav")}` : (ds(bStyle, "matchTeamName").includes("text-") ? "" : "text-foreground")}`}>
        {name}
      </span>
      <div className="relative flex items-center">
        {m.is_played ? (
          <>
            <span className={`min-w-[1.1rem] text-right leading-none tabular-nums ${ds(bStyle, "matchScore")} ${isWin ? "font-bold " + ds(bStyle, "matchScoreWin") : ds(bStyle, "matchScoreLose")}`}>{score}</span>
            {hasPenalties && (
              <span className="absolute left-full ml-0.5 text-left text-[8px] font-medium leading-none whitespace-nowrap tabular-nums text-muted-foreground">({penalties})</span>
            )}
          </>
        ) : null}
      </div>

    </div>
  );



  const [open, setOpen] = useState(false);

  // Detect H&A pair from allMatches (if available) — used to open the
  // unified Flashscore-style dialog with both legs.
  const baseName = getBaseMatchName(m.match_name);
  const isHA = !!m.match_name && /\s+\((Heen|Terug)\)$/.test(m.match_name);
  const isHeen = m.match_name?.endsWith("(Heen)") ?? false;
  const pairedMatch = isHA && allMatches
    ? allMatches.find(
        (x: any) =>
          x.match_name === `${baseName} ${isHeen ? "(Terug)" : "(Heen)"}` &&
          x.group_id === m.group_id,
      ) ?? null
    : null;

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpen(true)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpen(true); } }}
        className="relative overflow-hidden cursor-pointer transition-colors hover:bg-secondary/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
      >
        {/* Context: format name + detail line */}
        {(formatName || detailLine || m.field || m.referee) && (
          <div className={`ttx-match-context ${ds(bStyle, "matchContext")}`}>
            <div className="flex items-start justify-between w-full">
              <div className="flex items-start gap-1.5">
                {phase?.logo_url && (
                  <img src={phase.logo_url} alt="" className="h-5 w-5 object-contain flex-shrink-0 rounded-sm mt-0.5" />
                )}
                <div className="flex flex-col">
                  {formatName && (
                    <span className={ds(bStyle, "matchContextText")}>{formatName}</span>
                  )}
                  {detailLine && (
                    <span className="text-[9px] text-muted-foreground font-medium">{detailLine}</span>
                  )}
                </div>
              </div>
              {(m.field || m.referee) && (
                <div className="flex flex-col items-end text-[9px] text-muted-foreground flex-shrink-0">
                  {m.field && (
                    <span className="flex items-center gap-0.5 font-bold">
                      <MapPin className="h-2.5 w-2.5" /> {m.field}
                    </span>
                  )}
                  {m.referee && (
                    <span className="flex items-center gap-0.5">
                      <WhistleIcon className="h-2.5 w-2.5" /> {m.referee}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        )}


        {/* Match body */}
        <div className="relative px-3 py-2">
          {renderTeamRow(homeName, homeLogo, m.home_team_id, m.home_penalties, m.home_score, homeWin)}

          {/* Time/VS badge — absolutely positioned to keep card height identical to played cards */}
          {!m.is_played && (
            <div className="pointer-events-none absolute right-5 top-1/2 -translate-y-1/2 z-10">
              <span className={ds(bStyle, "matchTimeBadge")}>
                {m.match_time?.slice(0, 5) || "VS"}
              </span>
            </div>
          )}

          {renderTeamRow(awayName, awayLogo, m.away_team_id, m.away_penalties, m.away_score, awayWin)}
        </div>
      </div>

      <PublicMatchDetailDialog
        open={open}
        onClose={() => setOpen(false)}
        match={m}
        pairedMatch={pairedMatch}
        teams={teams}
        tournament={tournament ?? null}
        phases={phases}
        groups={groups}
        slots={slots}
      />
    </>
  );
};

export default PublicMatchCard;
