import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import MatchStatsEditor from "./MatchStatsEditor";
import { formatFieldLabel } from "@/lib/fieldLocations";
import { MapPin, Calendar, Clock } from "lucide-react";
import WhistleIcon from "@/components/icons/WhistleIcon";

interface SetScore {
  home: number | null;
  away: number | null;
}

interface TournamentStatsConfig {
  id: string;
  enable_goalscorers: boolean;
  enable_assists: boolean;
  enable_yellow_cards: boolean;
  enable_red_cards: boolean;
}

interface AggregateInfo {
  /** Label voor de huidige leg, bijv. "Heen" of "Terug" */
  currentLegLabel: string;
  /** Label voor de andere leg */
  pairedLegLabel: string;
  /** Of de partner-wedstrijd al gespeeld is (beide scores ingevuld) */
  pairedPlayed: boolean;
  /** Score van de partner-wedstrijd, uitgedrukt vanuit het perspectief van de HUIDIGE wedstrijd
   *  (dus partner-away_score → currentHome bij omgewisselde teams). */
  pairedHomeScore: number | null;
  pairedAwayScore: number | null;
  /** Bestaande penalty-waarden zoals opgeslagen op de Terug-wedstrijd (laatste leg), in die oriëntatie. */
  storedHomePenalties: number | null;
  storedAwayPenalties: number | null;
  /** True als de huidige leg de penalty-drager is (Terug/laatste leg): oriëntatie = current. */
  currentIsCarrier: boolean;
}

interface ScoreEntryDialogProps {
  open: boolean;
  onClose: () => void;
  match: {
    id: string;
    home_team_id?: string | null;
    away_team_id?: string | null;
    home_score: number | null;
    away_score: number | null;
    home_penalties: number | null;
    away_penalties: number | null;
    set_scores: SetScore[] | null;
  };
  homeName: string;
  awayName: string;
  homeLogo: string | null;
  awayLogo: string | null;
  scoringType: "points" | "sets";
  numSets: number;
  needsPenalties: boolean;
  editable: boolean;
  hasStatsEnabled?: boolean;
  tournament?: TournamentStatsConfig;
  onOpenStats?: () => void;
  aggregate?: AggregateInfo | null;
  onSave: (data: {
    homeScore: number | null;
    awayScore: number | null;
    homePenalties: number | null;
    awayPenalties: number | null;
    setScores: SetScore[] | null;
  }) => void;
}

const ScoreEntryDialog = ({
  open, onClose, match, homeName, awayName, homeLogo, awayLogo,
  scoringType, numSets, needsPenalties, editable, hasStatsEnabled, tournament, onOpenStats, aggregate, onSave,
}: ScoreEntryDialogProps) => {
  const [homeScore, setHomeScore] = useState<string>("");
  const [awayScore, setAwayScore] = useState<string>("");
  const [homePen, setHomePen] = useState<string>("");
  const [awayPen, setAwayPen] = useState<string>("");
  const [setScores, setSetScores] = useState<{ home: string; away: string }[]>([]);

  const parsedSetScores: SetScore[] = setScores.map((s) => ({
    home: s.home === "" ? null : parseInt(s.home),
    away: s.away === "" ? null : parseInt(s.away),
  }));

  const setWinTarget = numSets >= 2 ? Math.ceil(numSets / 2) : 1;

  const computedSetTotals = parsedSetScores.reduce(
    (totals, s) => {
      if (s.home === null || s.away === null) return totals;
      if (s.home > s.away) totals.homeWins += 1;
      else if (s.away > s.home) totals.awayWins += 1;
      return totals;
    },
    { homeWins: 0, awayWins: 0 },
  );

  const setsMatchCompleted = scoringType === "sets" && numSets >= 2
    ? computedSetTotals.homeWins >= setWinTarget || computedSetTotals.awayWins >= setWinTarget
    : false;

  useEffect(() => {
    if (!open) return;
    setHomeScore(match.home_score !== null ? String(match.home_score) : "");
    setAwayScore(match.away_score !== null ? String(match.away_score) : "");

    // H&A: de beslissende score hoort UITSLUITEND op de Terug-wedstrijd.
    // Bij de Heen-wedstrijd tonen we die dus nooit en houden we de velden leeg.
    if (aggregate) {
      if (aggregate.currentIsCarrier) {
        setHomePen(aggregate.storedHomePenalties !== null ? String(aggregate.storedHomePenalties) : "");
        setAwayPen(aggregate.storedAwayPenalties !== null ? String(aggregate.storedAwayPenalties) : "");
      } else {
        setHomePen("");
        setAwayPen("");
      }
    } else {
      setHomePen(match.home_penalties !== null ? String(match.home_penalties) : "");
      setAwayPen(match.away_penalties !== null ? String(match.away_penalties) : "");
    }


    if (scoringType === "sets" && numSets >= 2) {
      const existing = match.set_scores || [];
      const sets: { home: string; away: string }[] = [];
      for (let i = 0; i < numSets; i++) {
        const s = existing[i];
        sets.push({
          home: s?.home !== null && s?.home !== undefined ? String(s.home) : "",
          away: s?.away !== null && s?.away !== undefined ? String(s.away) : "",
        });
      }
      setSetScores(sets);
    }
  }, [open, match.id]);

  const handleSetChange = (idx: number, side: "home" | "away", val: string) => {
    if (val !== "" && isNaN(parseInt(val))) return;
    setSetScores(prev => prev.map((s, i) => i === idx ? { ...s, [side]: val } : s));
  };

  const saveCurrentScore = () => {
    // If penalties (beslissende score) shouldn't be shown, force-clear them.
    // Otherwise we'd persist stale values from before the totals changed.
    const homePenOut = actualShowPenalties ? (homePen === "" ? null : parseInt(homePen)) : null;
    const awayPenOut = actualShowPenalties ? (awayPen === "" ? null : parseInt(awayPen)) : null;

    if (scoringType === "sets" && numSets >= 2) {
      const anyFilled = parsedSetScores.some(s => s.home !== null || s.away !== null);
      onSave({
        homeScore: anyFilled ? computedSetTotals.homeWins : null,
        awayScore: anyFilled ? computedSetTotals.awayWins : null,
        homePenalties: homePenOut,
        awayPenalties: awayPenOut,
        setScores: parsedSetScores,
      });
    } else {
      onSave({
        homeScore: homeScore === "" ? null : parseInt(homeScore),
        awayScore: awayScore === "" ? null : parseInt(awayScore),
        homePenalties: homePenOut,
        awayPenalties: awayPenOut,
        setScores: null,
      });
    }
  };

  const handleSave = () => {
    saveCurrentScore();
    onClose();
  };

  const handleDiscard = () => {
    onClose();
  };

  const handleScoreInput = (val: string, setter: (v: string) => void) => {
    if (val !== "" && isNaN(parseInt(val))) return;
    setter(val);
  };

  // For sets: check if tied and penalties needed
  const parsedHomeScore = homeScore === "" ? null : parseInt(homeScore);
  const parsedAwayScore = awayScore === "" ? null : parseInt(awayScore);

  // Aggregate (H&A) totals from current leg + paired leg
  const aggregateTotals = (() => {
    if (!aggregate) return null;
    if (parsedHomeScore === null || parsedAwayScore === null) return null;
    if (!aggregate.pairedPlayed || aggregate.pairedHomeScore === null || aggregate.pairedAwayScore === null) return null;
    const totalHome = parsedHomeScore + aggregate.pairedHomeScore;
    const totalAway = parsedAwayScore + aggregate.pairedAwayScore;
    return { totalHome, totalAway, tied: totalHome === totalAway };
  })();

  // Bij H&A mag de beslissende score enkel op de Terug-wedstrijd ingegeven worden.
  const penaltiesLockedToOtherLeg = !!aggregate && !aggregate.currentIsCarrier;

  const showPenalties = aggregate
    ? (needsPenalties && !!aggregateTotals && aggregateTotals.tied)
    : (needsPenalties && parsedHomeScore !== null && parsedAwayScore !== null && parsedHomeScore === parsedAwayScore);
  // For sets mode, calculate from set scores
  const setsShowPenalties = (() => {
    if (scoringType !== "sets" || numSets < 2 || !needsPenalties) return false;
    return setsMatchCompleted && computedSetTotals.homeWins === computedSetTotals.awayWins;
  })();

  const tieNeedsDecider = scoringType === "sets" ? setsShowPenalties : showPenalties;
  const actualShowPenalties = tieNeedsDecider && !penaltiesLockedToOtherLeg;


  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleDiscard(); }}>
      <DialogContent className="max-w-md top-4 translate-y-0 sm:top-[50%] sm:translate-y-[-50%] max-h-[calc(100dvh-2rem)] sm:max-h-[90dvh] overflow-y-auto overscroll-contain">
        <DialogHeader>
          <DialogTitle className="text-base">Score invullen</DialogTitle>
        </DialogHeader>

        {/* Team headers */}
        <div className="flex items-center justify-between px-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {homeLogo && <img src={homeLogo} className="h-6 w-6 object-contain flex-shrink-0" alt="" />}
            <span className="text-sm font-bold text-foreground truncate">{homeName}</span>
          </div>
          <div className="w-8" />
          <div className="flex items-center gap-2 flex-1 justify-end min-w-0">
            <span className="text-sm font-bold text-foreground truncate text-right">{awayName}</span>
            {awayLogo && <img src={awayLogo} className="h-6 w-6 object-contain flex-shrink-0" alt="" />}
          </div>
        </div>

        {/* H&A: paired-leg score boven de invulvelden */}
        {aggregate && aggregate.pairedPlayed && aggregate.pairedHomeScore !== null && aggregate.pairedAwayScore !== null && (
          <div className="flex items-center justify-center gap-2 -mb-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {aggregate.pairedLegLabel}
            </span>
            <span className="text-sm font-bold text-foreground tabular-nums bg-secondary/60 rounded px-2 py-0.5">
              {aggregate.pairedHomeScore} – {aggregate.pairedAwayScore}
            </span>
          </div>
        )}

        {/* Points mode: single score */}
        {(scoringType === "points" || numSets < 2) && (
          <>
            {aggregate && (
              <div className="flex items-center justify-center pt-1 -mb-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-primary">
                  {aggregate.currentLegLabel}
                </span>
              </div>
            )}
            <div className="flex items-center justify-center gap-3 py-2">
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={homeScore}
                onChange={(e) => handleScoreInput(e.target.value, setHomeScore)}
                disabled={!editable}
                className="h-12 w-16 text-center text-xl font-bold border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 disabled:cursor-not-allowed"
                placeholder="–"
              />
              <span className="text-xl font-bold text-muted-foreground">:</span>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={awayScore}
                onChange={(e) => handleScoreInput(e.target.value, setAwayScore)}
                disabled={!editable}
                className="h-12 w-16 text-center text-xl font-bold border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 disabled:cursor-not-allowed"
                placeholder="–"
              />
            </div>
            {aggregateTotals && (
              <div className="flex items-center justify-center gap-2 -mt-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Totaal</span>
                <span className="text-sm font-bold text-foreground tabular-nums bg-primary/10 text-primary rounded px-2 py-0.5">
                  {aggregateTotals.totalHome} – {aggregateTotals.totalAway}
                </span>
              </div>
            )}
          </>
        )}

        {/* Sets mode */}
        {scoringType === "sets" && numSets >= 2 && (
          <div className="space-y-2">
            {setScores.map((s, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground w-12 shrink-0">Set {idx + 1}</span>
                <div className="flex items-center gap-2 flex-1 justify-center">
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={s.home}
                    onChange={(e) => handleSetChange(idx, "home", e.target.value)}
                    disabled={!editable}
                    className="h-9 w-14 text-center text-sm font-bold border border-input rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50 disabled:cursor-not-allowed"
                    placeholder="–"
                  />
                  <span className="text-sm font-bold text-muted-foreground">:</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={s.away}
                    onChange={(e) => handleSetChange(idx, "away", e.target.value)}
                    disabled={!editable}
                    className="h-9 w-14 text-center text-sm font-bold border border-input rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50 disabled:cursor-not-allowed"
                    placeholder="–"
                  />
                </div>
              </div>
            ))}
            {/* Set totals */}
            <div className="flex items-center gap-2 border-t border-border pt-2 mt-2">
              <span className="text-xs font-bold text-foreground w-12 shrink-0">Totaal</span>
              <div className="flex items-center gap-2 flex-1 justify-center">
                {(() => {
                  return (
                    <>
                      <span className="h-9 w-14 flex items-center justify-center text-sm font-bold text-foreground bg-secondary/50 rounded-md">{computedSetTotals.homeWins}</span>
                      <span className="text-sm font-bold text-muted-foreground">:</span>
                      <span className="h-9 w-14 flex items-center justify-center text-sm font-bold text-foreground bg-secondary/50 rounded-md">{computedSetTotals.awayWins}</span>
                    </>
                  );
                })()}
              </div>
            </div>
          </div>
        )}

        {/* Penalties / decisive score */}
        {actualShowPenalties && (
          <div className="flex flex-col items-center gap-1 pt-1">
            <span className="text-xs text-muted-foreground font-medium">Beslissende score</span>
            <div className="flex items-center gap-2">
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={homePen}
                onChange={(e) => handleScoreInput(e.target.value, setHomePen)}
                disabled={!editable}
                className="h-8 w-12 text-center text-sm font-bold border border-input rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50 disabled:cursor-not-allowed"
                placeholder="–"
              />
              <span className="text-sm text-muted-foreground">–</span>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={awayPen}
                onChange={(e) => handleScoreInput(e.target.value, setAwayPen)}
                disabled={!editable}
                className="h-8 w-12 text-center text-sm font-bold border border-input rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50 disabled:cursor-not-allowed"
                placeholder="–"
              />
            </div>
          </div>
        )}

        {tieNeedsDecider && penaltiesLockedToOtherLeg && (
          <p className="text-[11px] text-center text-muted-foreground font-medium pt-1">
            Beslissende score wordt ingegeven bij de {aggregate?.pairedLegLabel?.toLowerCase() ?? "terug"}wedstrijd
          </p>
        )}


        {hasStatsEnabled && tournament && match.home_team_id && match.away_team_id && (() => {
          const effHome = scoringType === "sets" && numSets >= 2
            ? computedSetTotals.homeWins
            : (homeScore === "" ? null : parseInt(homeScore));
          const effAway = scoringType === "sets" && numSets >= 2
            ? computedSetTotals.awayWins
            : (awayScore === "" ? null : parseInt(awayScore));
          if (effHome === null && effAway === null) return null;
          return (
            <MatchStatsEditor
              matchId={match.id}
              tournament={tournament}
              homeTeamId={match.home_team_id}
              awayTeamId={match.away_team_id}
              homeTeamName={homeName}
              awayTeamName={awayName}
              homeTeamLogo={homeLogo}
              awayTeamLogo={awayLogo}
              homeScore={effHome}
              awayScore={effAway}
              editable={editable}
            />
          );
        })()}

        {editable && (
          <DialogFooter className="flex-col gap-2 sm:flex-col sm:space-x-0">
            <div className="flex w-full justify-end gap-2">
              <Button variant="outline" onClick={handleDiscard}>Annuleren</Button>
              <Button onClick={handleSave}>Opslaan</Button>
            </div>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ScoreEntryDialog;
