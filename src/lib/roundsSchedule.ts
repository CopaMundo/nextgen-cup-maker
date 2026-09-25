/**
 * Speelrondes: volledige planning vooraf berekenen.
 *
 * De live loting van speelrondes is een onthulling: de volledige planning
 * (welke affiches in welke speelronde) wordt vóór de loting berekend en
 * gecontroleerd. Kan dat niet met de ingestelde regels, dan start de loting niet.
 */

import { pairKey, shuffle } from "@/lib/liveDraw";

export type SameCountryMode = "allow" | "avoid" | "never";

export interface ScheduleTeam {
  id: string;
  country?: string | null;
  potIndex: number;
}

export interface ScheduleRules {
  sameCountry: SameCountryMode;
  /** Teams die nooit tegen elkaar mogen spelen. */
  forbiddenPairs: [string, string][];
  /** Maximum aantal keer dat twee teams elkaar ontmoeten. */
  maxMeetings: number;
}

export interface ScheduledMatch {
  round: number;
  homeId: string;
  awayId: string;
}

export interface ScheduleResult {
  ok: boolean;
  message?: string;
  matches: ScheduledMatch[];
  /** Aantal affiches waarbij teams uit hetzelfde land elkaar toch ontmoeten. */
  sameCountryCount: number;
}

/** Aantal wedstrijden per team bij `rounds` speelrondes (oneven groep: één vrij per ronde). */
export function matchesPerTeam(teamCount: number, rounds: number): number {
  if (teamCount < 2) return 0;
  if (teamCount % 2 === 0) return rounds;
  return Math.floor((rounds * (teamCount - 1)) / teamCount);
}

/**
 * Symmetrische standaardmatrix: iedere pot speelt `floor(M/P)` keer tegen elke pot,
 * de extra wedstrijden worden symmetrisch verdeeld zodat de matrix klopt.
 */
export function defaultOpponentMatrix(potSizes: number[], perTeam: number): number[][] {
  const P = potSizes.length;
  if (P === 0) return [];
  const base = Math.floor(perTeam / P);
  const extra = perTeam % P;
  const offsets: number[] = [];
  if (extra % 2 === 1) offsets.push(P % 2 === 0 ? P / 2 : 0);
  for (let k = 1; offsets.length < extra && k < P; k++) {
    if (P % 2 === 0 && k === P / 2) continue;
    offsets.push(k, P - k);
  }
  const m = Array.from({ length: P }, () => new Array(P).fill(base));
  for (let i = 0; i < P; i++) for (const o of offsets.slice(0, extra)) m[i][(i + o) % P] += 1;
  return m;
}

/** Wiskundige controle van de matrix. Geeft een foutmelding of null. */
export function validateMatrix(
  matrix: number[][],
  potSizes: number[],
  potNames: string[],
  perTeam: number,
  maxMeetings: number
): string | null {
  const P = potSizes.length;
  for (let i = 0; i < P; i++) {
    if (potSizes[i] === 0) continue;
    const sum = matrix[i].reduce((a, b) => a + b, 0);
    if (sum !== perTeam)
      return `${potNames[i]}: de rij telt ${sum} wedstrijden, maar elk team speelt er ${perTeam}.`;
    for (let j = 0; j < P; j++) {
      const c = matrix[i][j];
      const available = i === j ? potSizes[j] - 1 : potSizes[j];
      if (c > 0 && available <= 0)
        return `${potNames[i]} kan niet tegen ${potNames[j]} spelen: daar zijn geen andere teams.`;
      if (c > available * Math.max(1, maxMeetings))
        return `${potNames[i]} tegen ${potNames[j]}: ${c} wedstrijden, maar er zijn maar ${available} tegenstanders (max. ${maxMeetings} ontmoetingen).`;
      if (i === j && (potSizes[i] * c) % 2 === 1)
        return `${potNames[i]} tegen de eigen pot: ${potSizes[i]} teams × ${c} wedstrijd(en) geeft een oneven aantal, dat kan niet.`;
      if (i < j && potSizes[i] * matrix[i][j] !== potSizes[j] * matrix[j][i])
        return `${potNames[i]} tegen ${potNames[j]} (${potSizes[i] * matrix[i][j]} wedstrijden) klopt niet met ${potNames[j]} tegen ${potNames[i]} (${potSizes[j] * matrix[j][i]}).`;
    }
  }
  return null;
}

/**
 * Berekent een volledige planning over `rounds` speelrondes.
 * Harde regels: potverdeling, max. één wedstrijd per ronde, geen herhaling zolang
 * er nog een ongespeelde tegenstander met open plaats beschikbaar is, verboden paren,
 * "nooit"-landenregel, maximum ontmoetingen.
 */
export function buildSchedule(
  teams: ScheduleTeam[],
  rounds: number,
  matrix: number[][],
  rules: ScheduleRules,
  timeBudgetMs = 4000
): ScheduleResult {
  const n = teams.length;
  const fail = (message: string): ScheduleResult => ({ ok: false, message, matches: [], sameCountryCount: 0 });
  if (n < 2) return fail("Deze groep heeft te weinig teams.");
  const forbidden = new Set(rules.forbiddenPairs.map(([a, b]) => pairKey(a, b)));
  const byId = new Map(teams.map((t) => [t.id, t]));
  const deadline = Date.now() + timeBudgetMs;
  const maxMeet = Math.max(1, rules.maxMeetings);

  for (let attempt = 0; Date.now() < deadline; attempt++) {
    // need[team][pot]
    const need = new Map<string, number[]>(teams.map((t) => [t.id, [...matrix[t.potIndex]]]));
    const meetings = new Map<string, number>();
    const matches: ScheduledMatch[] = [];
    const avoidCountry = rules.sameCountry === "avoid" && attempt < 40;
    let failed = false;

    const total = (id: string) => need.get(id)!.reduce((a, b) => a + b, 0);
    const hasUnplayedOption = (a: string) =>
      teams.some(
        (t) => t.id !== a && (meetings.get(pairKey(a, t.id)) || 0) === 0 && need.get(a)![t.potIndex] > 0 && need.get(t.id)![byId.get(a)!.potIndex] > 0 && !forbidden.has(pairKey(a, t.id))
      );
    const allowed = (a: string, b: string, strictCountry: boolean) => {
      const ta = byId.get(a)!;
      const tb = byId.get(b)!;
      if (need.get(a)![tb.potIndex] <= 0 || need.get(b)![ta.potIndex] <= 0) return false;
      if (forbidden.has(pairKey(a, b))) return false;
      const met = meetings.get(pairKey(a, b)) || 0;
      if (met >= maxMeet) return false;
      if (met > 0 && (hasUnplayedOption(a) || hasUnplayedOption(b))) return false;
      if (ta.country && ta.country === tb.country) {
        if (rules.sameCountry === "never") return false;
        if (strictCountry) return false;
      }
      return true;
    };

    for (let round = 1; round <= rounds && !failed; round++) {
      const left = rounds - round + 1;
      const order = shuffle(teams.map((t) => t.id)).sort((a, b) => total(b) - total(a));
      const used = new Set<string>();
      const pairs: [string, string][] = [];
      let steps = 0;
      const dfs = (idx: number): boolean => {
        if (++steps > 20000) return false;
        while (idx < order.length && (used.has(order[idx]) || total(order[idx]) === 0)) idx++;
        if (idx >= order.length) return true;
        const a = order[idx];
        const candidates = shuffle(order.slice(idx + 1).filter((b) => !used.has(b) && total(b) > 0));
        candidates.sort((x, y) => (meetings.get(pairKey(a, x)) || 0) - (meetings.get(pairKey(a, y)) || 0));
        for (const strict of avoidCountry ? [true, false] : [false]) {
          for (const b of candidates) {
            if (!allowed(a, b, strict)) continue;
            const pa = byId.get(a)!.potIndex;
            const pb = byId.get(b)!.potIndex;
            need.get(a)![pb]--;
            need.get(b)![pa]--;
            meetings.set(pairKey(a, b), (meetings.get(pairKey(a, b)) || 0) + 1);
            used.add(a);
            used.add(b);
            pairs.push([a, b]);
            if (dfs(idx + 1)) return true;
            pairs.pop();
            used.delete(a);
            used.delete(b);
            meetings.set(pairKey(a, b), (meetings.get(pairKey(a, b)) || 0) - 1);
            need.get(a)![pb]++;
            need.get(b)![pa]++;
          }
        }
        // Team mag deze ronde vrij zijn als het zijn resterende wedstrijden nog kwijt kan.
        if (total(a) < left) {
          used.add(a);
          if (dfs(idx + 1)) return true;
          used.delete(a);
        }
        return false;
      };
      if (!dfs(0)) {
        failed = true;
        break;
      }
      for (const [a, b] of pairs) {
        const flip = Math.random() < 0.5;
        matches.push({ round, homeId: flip ? b : a, awayId: flip ? a : b });
      }
    }
    if (failed) continue;
    if (teams.some((t) => total(t.id) !== 0)) continue;
    const sameCountryCount = matches.filter((m) => {
      const c = byId.get(m.homeId)?.country;
      return c && c === byId.get(m.awayId)?.country;
    }).length;
    return { ok: true, matches, sameCountryCount };
  }
  return fail(
    "Met deze instellingen kunnen de speelrondes niet volledig worden aangemaakt. Pas de verdeling per pot of de regels aan."
  );
}
