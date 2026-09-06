import { useState } from "react";
import { useFieldLabel, displayFieldName } from "@/lib/fieldLocations";
import { firstRefereeName } from "@/lib/refereeConfig";
import { MapPin } from "lucide-react";
import WhistleIcon from "@/components/icons/WhistleIcon";
import CountryFlag from "@/components/CountryFlag";
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
  /** Current group position for the home team (shown before the score). */
  homePosition?: number;
  /** Current group position for the away team (shown before the score). */
  awayPosition?: number;
  /** When provided, overrides the default match-detail dialog open. */
  onCardClick?: () => void;
  /** Active location filter in the public schedule. When set, the field label shows only the field name. */
  locationFilter?: string;
}

const getTeamName = (teams: any[], id: string | null) => teams.find((t) => t.id === id)?.name || "–";
const getTeamLogo = (teams: any[], id: string | null) => teams.find((t) => t.id === id)?.logo_url;
const getTeamCountry = (teams: any[], id: string | null) => teams.find((t) => t.id === id)?.country;

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
  homePosition,
  awayPosition,
  onCardClick,
}: PublicMatchCardProps) => {
  const bStyle = useBroadcastStyle();
  const fieldLabel = useFieldLabel();
  const phase = phases.find((p) => p.id === m.phase_id);
  const group = groups.find((g) => g.id === m.group_id);
  const isFav = favoriteTeam && (m.home_team_id === favoriteTeam || m.away_team_id === favoriteTeam);

  const { systems: scoringSystems } = useScoringSystems(tournament?.id);
  // Format suffix: "(Heen)" / "(Terug)" + "(N sets)" / "(beste van N)"
  const formatSuffix = getMatchFormatSuffix(m, scoringSystems as any, phases as any, groups as any);
  const isHALeg = !!m.match_name && /\s+\((Heen|Terug)\)$/.test(m.match_name);
  const haLegLabel = isHALeg ? (m.match_name?.endsWith("(Heen)") ? "HEEN" : "TERUG") : null;

  // Build structured context lines
  const isKnockout = phase?.phase_type === "knockout" || phase?.phase_type === "single_match";
  let formatName = "";
  let detailLine = "";

  if (isKnockout) {
    formatName = extraContext || phase?.name || "";
    // Strip leg from match_name; H&A leg is shown as a small badge instead.
    const baseMatchName = getBaseMatchName(m.match_name) || "";
    detailLine = isHALeg ? baseMatchName : `${baseMatchName}${formatSuffix}`.trim();
  } else {
    formatName = extraContext || phase?.name || "";
    if (!hideContext) {
      const parts: string[] = [];
      if (group?.name && group.name !== phase?.name) parts.push(group.name);
      detailLine = parts.join(" ● ");
    }
    if (formatSuffix && !isHALeg) {
      detailLine = `${detailLine}${detailLine ? " " : ""}${formatSuffix.trim()}`;
    }
  }

  const homeName = getMatchSideDisplayName(m, "home", teams, { slots, phases, groups, emptyLabel: "TBD" });
  const awayName = getMatchSideDisplayName(m, "away", teams, { slots, phases, groups, emptyLabel: "TBD" });
  const homeLogo = getTeamLogo(teams, m.home_team_id);
  const awayLogo = getTeamLogo(teams, m.away_team_id);
  const homeCountry = getTeamCountry(teams, m.home_team_id);
  const awayCountry = getTeamCountry(teams, m.away_team_id);

  // Beslissende score hoort nooit bij een Heen-wedstrijd; toon ze daar nooit.
  const hasPenalties = haLegLabel !== "HEEN" && m.home_penalties != null && m.away_penalties != null;
  // Scores worden weergegeven zodra ze zijn ingevuld, ook als een beslissende
  // score nog ontbreekt (wedstrijd nog niet officieel afgerond).
  const showScores = m.is_played || (m.home_score != null && m.away_score != null);
  const homeWin = showScores && ((m.home_score ?? 0) > (m.away_score ?? 0) || ((m.home_score ?? 0) === (m.away_score ?? 0) && hasPenalties && (m.home_penalties ?? 0) > (m.away_penalties ?? 0)));
  const awayWin = showScores && ((m.away_score ?? 0) > (m.home_score ?? 0) || ((m.home_score ?? 0) === (m.away_score ?? 0) && hasPenalties && (m.away_penalties ?? 0) > (m.home_penalties ?? 0)));


  const renderTeamRow = (name: string, logo: string | undefined, country: string | undefined, teamId: string | null, penalties: number | null, score: number | null, isWin: boolean, position?: number) => (
    <div className={`flex h-10 items-center gap-2 ${ds(bStyle, "matchTeamRow") || "rounded-md"} px-2 transition-colors`}>
      <div className="h-7 w-7 flex-shrink-0 overflow-hidden">
        {logo ? (
          <img src={logo} className="h-full w-full object-contain" alt="" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-secondary text-[10px] font-black text-muted-foreground">{name.charAt(0)}</div>
        )}
      </div>
      <div className="flex min-w-0 flex-1 items-center gap-1.5">
        <span className={`ttx-team-name truncate ${ds(bStyle, "matchTeamName")} ${teamId === favoriteTeam ? `ttx-fav-team ${ds(bStyle, "matchTeamNameFav")}` : (ds(bStyle, "matchTeamName").includes("text-") ? "" : "text-foreground")}`}>
          {name}
        </span>
          {tournament?.show_country && country && (
            <span className="inline-flex h-3 w-4 flex-shrink-0 items-center justify-center">
              <CountryFlag country={country} className="h-full w-full object-contain" />
            </span>
          )}
      </div>
      <div className="flex flex-shrink-0 items-center gap-1.5">
        <div className="relative flex items-center">
          {showScores ? (
            <>
              <span className={`min-w-[1.1rem] text-right leading-none tabular-nums ${ds(bStyle, "matchScore")} ${isWin ? "font-bold " + ds(bStyle, "matchScoreWin") : ds(bStyle, "matchScoreLose")}`}>{score}</span>
              {hasPenalties && (
                <span className="absolute left-full ml-0.5 text-left text-[8px] font-medium leading-none whitespace-nowrap tabular-nums text-muted-foreground">({penalties})</span>
              )}
            </>
          ) : null}
        </div>
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
        role={onCardClick ? undefined : "button"}
        tabIndex={onCardClick ? undefined : 0}
        onClick={() => { if (onCardClick) onCardClick(); else setOpen(true); }}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); if (onCardClick) onCardClick(); else setOpen(true); } }}
        className={`relative overflow-hidden transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${onCardClick ? "cursor-pointer" : "cursor-pointer hover:bg-secondary/40"}`}
      >
        {/* Context: format name + detail line */}
        {(formatName || detailLine || m.field || m.referee) && (
          <div className={`ttx-match-context ${ds(bStyle, "matchContext")}`}>
            <div className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-0.5 leading-none py-0.5 min-h-[22px]">
              {formatName ? (
                detailLine || isHALeg ? (
                  <>
                    <div className="flex items-center gap-1.5 min-w-0">
                      {phase?.logo_url && (
                        <img src={phase.logo_url} alt="" className="h-5 w-5 object-contain flex-shrink-0 rounded-sm" />
                      )}
                      <span className={`truncate ${ds(bStyle, "matchContextText")}`}>{formatName}</span>
                    </div>
                    {m.field ? (
                      <div className="font-bold text-muted-foreground inline-flex items-center gap-0.5 justify-end text-[9px] leading-none">
                        <MapPin className="h-2.5 w-2.5 flex-shrink-0" /> <span className="leading-none truncate max-w-[110px]" title={m.field || undefined}>{fieldLabel(m.field)}</span>
                      </div>
                    ) : <div />}
                    <div className="flex items-center gap-1.5 min-w-0">
                      {detailLine && (
                        <span className="text-[9px] text-muted-foreground font-medium truncate">{detailLine}</span>
                      )}
                      {isHALeg && (
                        <span className={`shrink-0 ${ds(bStyle, "matchLegBadge")}`}>
                          {haLegLabel}
                        </span>
                      )}
                    </div>
                    {m.referee ? (
                      <div className="text-muted-foreground/70 inline-flex items-center gap-0.5 justify-end text-[9px] leading-none">
                        <WhistleIcon className="h-2.5 w-2.5 flex-shrink-0" /> <span className="leading-none truncate max-w-[110px]" title={m.referee || undefined}>{firstRefereeName(m.referee)}</span>
                      </div>
                    ) : <div />}
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-1.5 min-w-0">
                      {phase?.logo_url && (
                        <img src={phase.logo_url} alt="" className="h-5 w-5 object-contain flex-shrink-0 rounded-sm" />
                      )}
                      <span className={`truncate ${ds(bStyle, "matchContextText")}`}>{formatName}</span>
                      {isHALeg && (
                        <span className={`shrink-0 ${ds(bStyle, "matchLegBadge")}`}>
                          {haLegLabel}
                        </span>
                      )}
                    </div>
                    {m.field ? (
                      <div className="font-bold text-muted-foreground inline-flex items-center gap-0.5 justify-end text-[9px] leading-none">
                        <MapPin className="h-2.5 w-2.5 flex-shrink-0" /> <span className="leading-none truncate max-w-[110px]" title={m.field || undefined}>{fieldLabel(m.field)}</span>
                      </div>
                    ) : m.referee ? (
                      <div className="text-muted-foreground/70 inline-flex items-center gap-0.5 justify-end text-[9px] leading-none">
                        <WhistleIcon className="h-2.5 w-2.5 flex-shrink-0" /> <span className="leading-none truncate max-w-[110px]" title={m.referee || undefined}>{firstRefereeName(m.referee)}</span>
                      </div>
                    ) : <div />}
                    {m.field && m.referee && (
                      <>
                        <div />
                        <div className="text-muted-foreground/70 inline-flex items-center gap-0.5 justify-end text-[9px] leading-none">
                          <WhistleIcon className="h-2.5 w-2.5 flex-shrink-0" /> <span className="leading-none truncate max-w-[110px]" title={m.referee || undefined}>{firstRefereeName(m.referee)}</span>
                        </div>
                      </>
                    )}
                  </>
                )
              ) : (
                detailLine || isHALeg ? (
                  <>
                    <div className="flex items-center gap-1.5 min-w-0">
                      {phase?.logo_url && (
                        <img src={phase.logo_url} alt="" className="h-5 w-5 object-contain flex-shrink-0 rounded-sm" />
                      )}
                      {detailLine && (
                        <span className="text-[9px] text-muted-foreground font-medium truncate">{detailLine}</span>
                      )}
                      {isHALeg && (
                        <span className={`shrink-0 ${ds(bStyle, "matchLegBadge")}`}>
                          {haLegLabel}
                        </span>
                      )}
                    </div>
                    {m.field ? (
                      <div className="font-bold text-muted-foreground inline-flex items-center gap-0.5 justify-end text-[9px] leading-none">
                        <MapPin className="h-2.5 w-2.5 flex-shrink-0" /> <span className="leading-none truncate max-w-[110px]" title={m.field || undefined}>{fieldLabel(m.field)}</span>
                      </div>
                    ) : m.referee ? (
                      <div className="text-muted-foreground/70 inline-flex items-center gap-0.5 justify-end text-[9px] leading-none">
                        <WhistleIcon className="h-2.5 w-2.5 flex-shrink-0" /> <span className="leading-none truncate max-w-[110px]" title={m.referee || undefined}>{firstRefereeName(m.referee)}</span>
                      </div>
                    ) : <div />}
                    {m.field && m.referee && (
                      <>
                        <div />
                        <div className="text-muted-foreground/70 inline-flex items-center gap-0.5 justify-end text-[9px] leading-none">
                          <WhistleIcon className="h-2.5 w-2.5 flex-shrink-0" /> <span className="leading-none truncate max-w-[110px]" title={m.referee || undefined}>{firstRefereeName(m.referee)}</span>
                        </div>
                      </>
                    )}
                  </>
                ) : (
                  <>
                    <div />
                    {m.field ? (
                      <div className="font-bold text-muted-foreground inline-flex items-center gap-0.5 justify-end text-[9px] leading-none">
                        <MapPin className="h-2.5 w-2.5 flex-shrink-0" /> <span className="leading-none truncate max-w-[110px]" title={m.field || undefined}>{fieldLabel(m.field)}</span>
                      </div>
                    ) : m.referee ? (
                      <div className="text-muted-foreground/70 inline-flex items-center gap-0.5 justify-end text-[9px] leading-none">
                        <WhistleIcon className="h-2.5 w-2.5 flex-shrink-0" /> <span className="leading-none truncate max-w-[110px]" title={m.referee || undefined}>{firstRefereeName(m.referee)}</span>
                      </div>
                    ) : <div />}
                  </>
                )
              )}
            </div>
          </div>
        )}


        {/* Match body */}
        <div className="relative px-3 py-2">
          {renderTeamRow(homeName, homeLogo, homeCountry, m.home_team_id, m.home_penalties, m.home_score, homeWin, homePosition)}

          {/* Time/VS badge — absolutely positioned to keep card height identical to played cards */}
          {!showScores && (
            <div className="pointer-events-none absolute right-5 top-1/2 -translate-y-1/2 z-10">
              <span className={ds(bStyle, "matchTimeBadge")}>
                {m.match_time?.slice(0, 5) || "VS"}
              </span>
            </div>
          )}

          {renderTeamRow(awayName, awayLogo, awayCountry, m.away_team_id, m.away_penalties, m.away_score, awayWin, awayPosition)}
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
