/**
 * Lotingsmotor voor de live loting.
 *
 * Twee soorten lotingen:
 *  - "containers": deelnemers worden in bakjes geplaatst. Een bakje is een groep
 *    (groepsfase) of een wedstrijd (knock-out / enkele wedstrijd).
 *  - "rounds": per groep worden de tegenstanders per speelronde geloot.
 */

export type DrawKind = "containers" | "rounds";
export type DrawMode = "random" | "pots";

export interface DrawTeam {
  id: string;
  name: string;
  country?: string | null;
  logoUrl?: string | null;
  /** Groep uit de vorige fase (voor knock-outregels). */
  prevGroupId?: string | null;
}

export interface DrawPot {
  id: string;
  name: string;
  teamIds: string[];
}

export interface DrawContainer {
  id: string;
  name: string;
  capacity: number;
  /** Vrije slot-ids in volgorde (leeg bij een testloting op nieuwe groepen). */
  slotIds: string[];
  teamIds: string[];
}

export interface ContainerRules {
  /** Nooit twee deelnemers met hetzelfde land in hetzelfde bakje. */
  separateSameCountry: boolean;
  /** Algemeen maximum per land per bakje (null = geen limiet). */
  countryMaxDefault: number | null;
  /** Maximum per specifiek land per bakje. */
  countryMax: Record<string, number>;
  /** Deze deelnemers mogen niet samen. */
  forbiddenPairs: [string, string][];
  /** Deze deelnemers moeten samen. */
  requiredPairs: [string, string][];
  /** Deelnemers uit dezelfde vorige groep niet samen (knock-out). */
  separateSamePrevGroup: boolean;
  /** Uit elke pot precies één deelnemer per bakje. */
  onePerPot: boolean;
}

export const emptyContainerRules = (): ContainerRules => ({
  separateSameCountry: false,
  countryMaxDefault: null,
  countryMax: {},
  forbiddenPairs: [],
  requiredPairs: [],
  separateSamePrevGroup: false,
  onePerPot: true,
});

export interface RoundsRules {
  /** Deelnemers uit hetzelfde land spelen nooit tegen elkaar. */
  neverSameCountry: boolean;
  /** Maximum aantal wedstrijden tegen een bepaald land (per deelnemer). */
  maxVsCountry: Record<string, number>;
  /** Minimum aantal wedstrijden tegen een bepaald land (per deelnemer). */
  minVsCountry: Record<string, number>;
  /** Deze landen mogen niet tegen elkaar. */
  forbiddenCountryPairs: [string, string][];
  /** Deze deelnemers mogen niet tegen elkaar. */
  forbiddenPairs: [string, string][];
  /** Deze deelnemers moeten tegen elkaar. */
  requiredPairs: [string, string][];
  /** Maximum aantal keer dat twee deelnemers tegen elkaar mogen spelen. */
  maxMeetings: number;
  /** Aantal tegenstanders uit een pot per deelnemer (potId -> aantal). */
  potQuota: Record<string, number>;
}

export const emptyRoundsRules = (): RoundsRules => ({
  neverSameCountry: false,
  maxVsCountry: {},
  minVsCountry: {},
  forbiddenCountryPairs: [],
  forbiddenPairs: [],
  requiredPairs: [],
  maxMeetings: 2,
  potQuota: {},
});

export const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

export function shuffle<T>(list: T[]): T[] {
  const arr = [...list];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/* ------------------------------------------------------------------ */
/* Containers (groepsfase, knock-out, enkele wedstrijd)                */
/* ------------------------------------------------------------------ */

interface ContainerCtx {
  teamById: Map<string, DrawTeam>;
  potByTeam: Map<string, string>;
  rules: ContainerRules;
  forbidden: Set<string>;
  required: Map<string, string[]>;
}

export function buildContainerCtx(teams: DrawTeam[], pots: DrawPot[], rules: ContainerRules): ContainerCtx {
  const potByTeam = new Map<string, string>();
  pots.forEach((p) => p.teamIds.forEach((id) => potByTeam.set(id, p.id)));
  const required = new Map<string, string[]>();
  for (const [a, b] of rules.requiredPairs || []) {
    required.set(a, [...(required.get(a) || []), b]);
    required.set(b, [...(required.get(b) || []), a]);
  }
  return {
    teamById: new Map(teams.map((t) => [t.id, t])),
    potByTeam,
    rules,
    forbidden: new Set((rules.forbiddenPairs || []).map(([a, b]) => pairKey(a, b))),
    required,
  };
}

function countryLimit(rules: ContainerRules, country?: string | null): number | null {
  if (!country) return null;
  if (rules.separateSameCountry) return 1;
  if (rules.countryMax[country] != null) return rules.countryMax[country];
  return rules.countryMaxDefault ?? null;
}

/** Mag deze deelnemer in dit bakje? */
export function containerAllows(container: DrawContainer, teamId: string, ctx: ContainerCtx): boolean {
  if (container.teamIds.length >= container.capacity) return false;
  const team = ctx.teamById.get(teamId);
  if (!team) return false;

  if (ctx.rules.onePerPot) {
    const pot = ctx.potByTeam.get(teamId);
    if (pot && container.teamIds.some((id) => ctx.potByTeam.get(id) === pot)) return false;
  }

  const limit = countryLimit(ctx.rules, team.country);
  if (limit != null && team.country) {
    const same = container.teamIds.filter((id) => ctx.teamById.get(id)?.country === team.country).length;
    if (same + 1 > limit) return false;
  }

  for (const otherId of container.teamIds) {
    if (ctx.forbidden.has(pairKey(teamId, otherId))) return false;
    if (ctx.rules.separateSamePrevGroup) {
      const other = ctx.teamById.get(otherId);
      if (team.prevGroupId && other?.prevGroupId && team.prevGroupId === other.prevGroupId) return false;
    }
  }

  // Verplichte combinaties: partners moeten in hetzelfde bakje terechtkomen.
  const partners = ctx.required.get(teamId) || [];
  for (const partnerId of partners) {
    const placedElsewhere = container.teamIds.includes(partnerId);
    if (placedElsewhere) continue;
  }
  return true;
}

/**
 * Zoekt een volledige geldige verdeling van `teamIds` over de bakjes.
 * Geeft null als het niet kan (binnen de tijdslimiet).
 */
export function solveContainers(
  teamIds: string[],
  containers: DrawContainer[],
  ctx: ContainerCtx,
  timeBudgetMs = 1200
): Record<string, string> | null {
  const working = containers.map((c) => ({ ...c, teamIds: [...c.teamIds] }));
  const totalFree = working.reduce((sum, c) => sum + (c.capacity - c.teamIds.length), 0);
  if (teamIds.length > totalFree) return null;

  const assignment: Record<string, string> = {};
  const deadline = Date.now() + timeBudgetMs;

  // Verplichte paren eerst: partners samen plaatsen.
  const order = [...teamIds].sort((a, b) => (ctx.required.get(b)?.length || 0) - (ctx.required.get(a)?.length || 0));

  const solve = (index: number): boolean => {
    if (index >= order.length) return true;
    if (Date.now() > deadline) return false;
    const teamId = order[index];

    const partners = (ctx.required.get(teamId) || []).filter((p) => assignment[p]);
    let candidates = working;
    if (partners.length) {
      const target = assignment[partners[0]];
      candidates = working.filter((c) => c.id === target);
    } else {
      candidates = shuffle(working).sort(
        (a, b) => a.capacity - a.teamIds.length - (b.capacity - b.teamIds.length)
      ).reverse();
    }

    for (const container of candidates) {
      if (!containerAllows(container, teamId, ctx)) continue;
      container.teamIds.push(teamId);
      assignment[teamId] = container.id;
      if (solve(index + 1)) return true;
      container.teamIds.pop();
      delete assignment[teamId];
    }
    return false;
  };

  for (let attempt = 0; attempt < 5; attempt++) {
    for (const c of working) c.teamIds = [...(containers.find((x) => x.id === c.id)?.teamIds || [])];
    for (const key of Object.keys(assignment)) delete assignment[key];
    if (solve(0)) return { ...assignment };
  }
  return null;
}

/**
 * Bakjes waar deze deelnemer in mag, met controle dat de rest van de loting
 * nadien nog altijd volledig kan worden afgemaakt.
 */
export function validContainersFor(
  teamId: string,
  remainingAfter: string[],
  containers: DrawContainer[],
  ctx: ContainerCtx
): string[] {
  const valid: string[] = [];
  for (const container of containers) {
    if (!containerAllows(container, teamId, ctx)) continue;
    const hypothetical = containers.map((c) =>
      c.id === container.id ? { ...c, teamIds: [...c.teamIds, teamId] } : { ...c, teamIds: [...c.teamIds] }
    );
    if (remainingAfter.length === 0 || solveContainers(remainingAfter, hypothetical, ctx, 600)) {
      valid.push(container.id);
    }
  }
  return valid;
}

/** Controleert vóór de loting of de instellingen haalbaar zijn. */
export function checkContainerFeasibility(
  teamIds: string[],
  containers: DrawContainer[],
  ctx: ContainerCtx
): { ok: boolean; message?: string } {
  const free = containers.reduce((sum, c) => sum + (c.capacity - c.teamIds.length), 0);
  if (containers.length === 0) return { ok: false, message: "Er zijn nog geen groepen of wedstrijden in deze fase." };
  if (teamIds.length === 0) return { ok: false, message: "Er zijn geen deelnemers om te loten." };
  if (teamIds.length > free)
    return { ok: false, message: `${teamIds.length} deelnemers voor ${free} vrije plaatsen. Voeg plaatsen toe of haal deelnemers weg.` };
  if (!solveContainers(teamIds, containers, ctx, 2000))
    return { ok: false, message: "Met deze regels is er geen geldige verdeling mogelijk. Versoepel de regels." };
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Speelrondes                                                         */
/* ------------------------------------------------------------------ */

export interface RoundPair {
  round: number;
  homeId: string;
  awayId: string;
}

export interface RoundsCtx {
  teamById: Map<string, DrawTeam>;
  potByTeam: Map<string, string>;
  rules: RoundsRules;
  forbidden: Set<string>;
  forbiddenCountries: Set<string>;
  /** Aantal keer dat twee deelnemers al tegen elkaar speelden. */
  meetings: Map<string, number>;
  /** Aantal wedstrijden per deelnemer tegen een land. */
  vsCountry: Map<string, number>;
  /** Aantal tegenstanders per deelnemer per pot. */
  vsPot: Map<string, number>;
}

export function buildRoundsCtx(teams: DrawTeam[], pots: DrawPot[], rules: RoundsRules): RoundsCtx {
  const potByTeam = new Map<string, string>();
  pots.forEach((p) => p.teamIds.forEach((id) => potByTeam.set(id, p.id)));
  return {
    teamById: new Map(teams.map((t) => [t.id, t])),
    potByTeam,
    rules,
    forbidden: new Set((rules.forbiddenPairs || []).map(([a, b]) => pairKey(a, b))),
    forbiddenCountries: new Set((rules.forbiddenCountryPairs || []).map(([a, b]) => pairKey(a, b))),
    meetings: new Map(),
    vsCountry: new Map(),
    vsPot: new Map(),
  };
}

export function applyPairToCtx(ctx: RoundsCtx, homeId: string, awayId: string, delta = 1) {
  const key = pairKey(homeId, awayId);
  ctx.meetings.set(key, Math.max(0, (ctx.meetings.get(key) || 0) + delta));
  const home = ctx.teamById.get(homeId);
  const away = ctx.teamById.get(awayId);
  if (away?.country) {
    const k = `${homeId}|${away.country}`;
    ctx.vsCountry.set(k, Math.max(0, (ctx.vsCountry.get(k) || 0) + delta));
  }
  if (home?.country) {
    const k = `${awayId}|${home.country}`;
    ctx.vsCountry.set(k, Math.max(0, (ctx.vsCountry.get(k) || 0) + delta));
  }
  const homePot = ctx.potByTeam.get(homeId);
  const awayPot = ctx.potByTeam.get(awayId);
  if (awayPot) {
    const k = `${homeId}|${awayPot}`;
    ctx.vsPot.set(k, Math.max(0, (ctx.vsPot.get(k) || 0) + delta));
  }
  if (homePot) {
    const k = `${awayId}|${homePot}`;
    ctx.vsPot.set(k, Math.max(0, (ctx.vsPot.get(k) || 0) + delta));
  }
}

/** Basiscontrole: mogen deze twee deelnemers (nog) tegen elkaar? */
export function pairAllowed(ctx: RoundsCtx, aId: string, bId: string): boolean {
  if (aId === bId) return false;
  const a = ctx.teamById.get(aId);
  const b = ctx.teamById.get(bId);
  if (!a || !b) return false;
  if (ctx.forbidden.has(pairKey(aId, bId))) return false;
  if (ctx.rules.neverSameCountry && a.country && b.country && a.country === b.country) return false;
  if (a.country && b.country && ctx.forbiddenCountries.has(pairKey(a.country, b.country))) return false;

  const met = ctx.meetings.get(pairKey(aId, bId)) || 0;
  if (met >= Math.max(1, ctx.rules.maxMeetings)) return false;

  if (b.country) {
    const max = ctx.rules.maxVsCountry[b.country];
    if (max != null && (ctx.vsCountry.get(`${aId}|${b.country}`) || 0) + 1 > max) return false;
  }
  if (a.country) {
    const max = ctx.rules.maxVsCountry[a.country];
    if (max != null && (ctx.vsCountry.get(`${bId}|${a.country}`) || 0) + 1 > max) return false;
  }

  const bPot = ctx.potByTeam.get(bId);
  if (bPot != null && ctx.rules.potQuota[bPot] != null) {
    if ((ctx.vsPot.get(`${aId}|${bPot}`) || 0) + 1 > ctx.rules.potQuota[bPot]) return false;
  }
  const aPot = ctx.potByTeam.get(aId);
  if (aPot != null && ctx.rules.potQuota[aPot] != null) {
    if ((ctx.vsPot.get(`${bId}|${aPot}`) || 0) + 1 > ctx.rules.potQuota[aPot]) return false;
  }
  return true;
}

/**
 * Harde regel: zolang er nog deelnemers zijn waartegen nog niet gespeeld is,
 * moeten die eerst aan bod komen.
 */
function preferUnplayed(ctx: RoundsCtx, teamId: string, candidates: string[], allGroupTeamIds: string[]): string[] {
  const unplayedInGroup = allGroupTeamIds.filter(
    (other) => other !== teamId && (ctx.meetings.get(pairKey(teamId, other)) || 0) === 0
  );
  if (unplayedInGroup.length === 0) return candidates;
  const unplayedCandidates = candidates.filter((c) => (ctx.meetings.get(pairKey(teamId, c)) || 0) === 0);
  if (unplayedCandidates.length > 0) return unplayedCandidates;
  // Geen enkele ongespeelde tegenstander beschikbaar in deze ronde: kies de
  // tegenstander met het minste aantal eerdere ontmoetingen.
  const min = Math.min(...candidates.map((c) => ctx.meetings.get(pairKey(teamId, c)) || 0));
  return candidates.filter((c) => (ctx.meetings.get(pairKey(teamId, c)) || 0) === min);
}

/** Probeert de resterende deelnemers van één speelronde volledig te koppelen. */
function solveRound(available: string[], ctx: RoundsCtx, deadline: number): [string, string][] | null {
  if (available.length < 2) return [];
  if (Date.now() > deadline) return null;
  const [first, ...rest] = available;
  for (const candidate of shuffle(rest)) {
    if (!pairAllowed(ctx, first, candidate)) continue;
    applyPairToCtx(ctx, first, candidate, 1);
    const remaining = rest.filter((id) => id !== candidate);
    const solved = solveRound(remaining, ctx, deadline);
    applyPairToCtx(ctx, first, candidate, -1);
    if (solved) return [[first, candidate], ...solved];
  }
  return null;
}

/**
 * Geldige tegenstanders voor `teamId` in de huidige speelronde, met controle dat
 * de rest van de ronde nadien nog gekoppeld kan worden.
 */
export function validOpponents(
  teamId: string,
  availableThisRound: string[],
  ctx: RoundsCtx,
  allGroupTeamIds: string[]
): string[] {
  const others = availableThisRound.filter((id) => id !== teamId);
  const base = others.filter((id) => pairAllowed(ctx, teamId, id));
  const preferred = preferUnplayed(ctx, teamId, base, allGroupTeamIds);
  const deadline = Date.now() + 900;

  const valid: string[] = [];
  for (const candidate of preferred) {
    applyPairToCtx(ctx, teamId, candidate, 1);
    const rest = others.filter((id) => id !== candidate);
    const ok = rest.length < 2 || solveRound(rest, ctx, Date.now() + 400) !== null;
    applyPairToCtx(ctx, teamId, candidate, -1);
    if (ok) valid.push(candidate);
    if (Date.now() > deadline) break;
  }
  return valid.length > 0 ? valid : preferred;
}

/** Berekent een volledige speelrondeloting voor één groep. */
export function computeRoundsForGroup(
  groupTeamIds: string[],
  rounds: number,
  ctx: RoundsCtx
): RoundPair[] | null {
  const pairs: RoundPair[] = [];
  for (let round = 1; round <= rounds; round++) {
    let available = shuffle(groupTeamIds);
    if (available.length % 2 === 1) available = available.slice(0, available.length - 1);
    const solved = solveRound(available, ctx, Date.now() + 2000);
    if (!solved) return null;
    for (const [home, away] of solved) pairs.push({ round, homeId: home, awayId: away });
  }
  return pairs;
}

/** Controleert of een speelrondeloting haalbaar is met de huidige regels. */
export function checkRoundsFeasibility(
  groupTeamIds: string[],
  rounds: number,
  teams: DrawTeam[],
  pots: DrawPot[],
  rules: RoundsRules
): { ok: boolean; message?: string } {
  if (groupTeamIds.length < 2) return { ok: false, message: "Deze groep heeft te weinig deelnemers." };
  if (rounds < 1) return { ok: false, message: "Deze fase heeft geen speelrondes ingesteld." };
  const ctx = buildRoundsCtx(teams, pots, rules);
  const result = computeRoundsForGroup(groupTeamIds, rounds, ctx);
  if (!result)
    return {
      ok: false,
      message: "Met deze regels kan niet elke speelronde volledig geloot worden. Versoepel de regels of pas de potten aan.",
    };
  return { ok: true };
}
