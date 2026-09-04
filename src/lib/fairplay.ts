/**
 * Fairplay ranking (admin-only). Penalty points per card type are configurable
 * per tournament and stored in tournaments.fairplay_config.
 */

export interface FairplayConfig {
  /** Strafpunten voor een gele kaart */
  yellow: number;
  /** Strafpunten voor 2x geel -> rood */
  second_yellow: number;
  /** Strafpunten voor een rechtstreekse rode kaart */
  red: number;
  /** Bonuspunten voor een wedstrijd zonder kaarten (null = niet gebruiken) */
  clean_match: number | null;
  /** Startpuntentotaal */
  start: number;
}

export const FAIRPLAY_DEFAULTS: FairplayConfig = {
  yellow: 1,
  second_yellow: 3,
  red: 5,
  clean_match: 0,
  start: 100,
};

export const getFairplayConfig = (tournament: any): FairplayConfig => {
  const raw = (tournament?.fairplay_config ?? {}) as Partial<FairplayConfig>;
  return {
    yellow: raw.yellow ?? FAIRPLAY_DEFAULTS.yellow,
    second_yellow: raw.second_yellow ?? FAIRPLAY_DEFAULTS.second_yellow,
    red: raw.red ?? FAIRPLAY_DEFAULTS.red,
    clean_match: raw.clean_match ?? FAIRPLAY_DEFAULTS.clean_match,
    start: raw.start ?? FAIRPLAY_DEFAULTS.start,
  };
};


export interface FairplayStat {
  match_id: string;
  team_id: string;
  player_name: string;
  stat_type: string;
}

export interface FairplayMatch {
  id: string;
  home_team_id: string | null;
  away_team_id: string | null;
  is_played: boolean;
}

export interface FairplayRow {
  teamId: string;
  yellows: number;
  secondYellows: number;
  reds: number;
  cleanMatches: number;
  /** Totale strafpunten (positief getal) */
  penalty: number;
  /** Eindtotaal: start - strafpunten + bonus voor kaartloze wedstrijden */
  total: number;
}

/**
 * Compute the fairplay table. Yellow cards are paired per player *per match*:
 * two yellows in one match count as a "2x geel -> rood". A yellow plus a
 * straight red in the same match therefore counts as yellow + red points.
 */
export const computeFairplayRows = (
  teamIds: string[],
  stats: FairplayStat[],
  matches: FairplayMatch[],
  config: FairplayConfig,
): FairplayRow[] => {
  const map: Record<string, FairplayRow> = {};
  teamIds.forEach((id) => {
    map[id] = { teamId: id, yellows: 0, secondYellows: 0, reds: 0, cleanMatches: 0, penalty: 0, total: 0 };
  });

  // Yellow cards paired per (match, team, player)
  const yellowMap: Record<string, number> = {};
  stats.forEach((s) => {
    if (s.stat_type === "yellow_card") {
      const key = `${s.match_id}__${s.team_id}__${s.player_name}`;
      yellowMap[key] = (yellowMap[key] || 0) + 1;
    }
  });
  Object.entries(yellowMap).forEach(([key, total]) => {
    const teamId = key.split("__")[1];
    if (!map[teamId]) return;
    map[teamId].secondYellows += Math.floor(total / 2);
    map[teamId].yellows += total % 2;
  });

  stats.forEach((s) => {
    if (!map[s.team_id]) return;
    if (s.stat_type === "straight_red") map[s.team_id].reds++;
    else if (s.stat_type === "red_card") map[s.team_id].secondYellows++;
  });

  // Matches without any card for that team
  if (config.clean_match != null) {
    const carded = new Set(
      stats
        .filter((s) => s.stat_type === "yellow_card" || s.stat_type === "red_card" || s.stat_type === "straight_red")
        .map((s) => `${s.match_id}__${s.team_id}`),
    );
    matches.forEach((m) => {
      if (!m.is_played) return;
      [m.home_team_id, m.away_team_id].forEach((tid) => {
        if (!tid || !map[tid]) return;
        if (!carded.has(`${m.id}__${tid}`)) map[tid].cleanMatches++;
      });
    });
  }

  Object.values(map).forEach((r) => {
    r.penalty = r.yellows * config.yellow + r.secondYellows * config.second_yellow + r.reds * config.red;
    r.total = config.start - r.penalty + r.cleanMatches * (config.clean_match ?? 0);
  });

  return Object.values(map);
};
