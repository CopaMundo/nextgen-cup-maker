/**
 * Lotingsmotor: verdeelt deelnemers uit potten over groepen met respect voor
 * restricties (één per pot, zelfde land gescheiden, geblokkeerde combinaties).
 */

export type PotInput = { id: string; name: string; teamIds: string[] };
export type GroupInput = { id: string; name: string; capacity: number };

export type DrawRules = {
  /** "one_per_pot": uit elke pot precies één deelnemer per groep. "free": vrije verdeling. */
  mode: "one_per_pot" | "free";
  /** Deelnemers met hetzelfde land niet in dezelfde groep. */
  separateSameCountry?: boolean;
  /** Handmatig geblokkeerde combinaties (paren van team-ids). */
  blocked?: [string, string][];
  /** Voor speelrondes: hoeveel keer pot X tegen pot Y speelt. Sleutel: `${potIdA}|${potIdB}`. */
  potMatrix?: Record<string, number>;
};

export type TeamMeta = { id: string; name: string; country?: string | null };

export type DrawStep = {
  teamId: string;
  potId: string;
  potName: string;
  groupId: string;
  groupName: string;
};

function shuffle<T>(list: T[]): T[] {
  const arr = [...list];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function blockedKey(a: string, b: string) {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

/**
 * Berekent een volledige loting. Geeft null terug als er met de huidige
 * restricties geen geldige verdeling gevonden wordt.
 */
export function computeDraw(
  pots: PotInput[],
  groups: GroupInput[],
  rules: DrawRules,
  teams: TeamMeta[]
): DrawStep[] | null {
  const teamById = new Map(teams.map((t) => [t.id, t]));
  const blocked = new Set((rules.blocked || []).map(([a, b]) => blockedKey(a, b)));

  const usablePots = pots.filter((p) => p.teamIds.length > 0);
  if (usablePots.length === 0 || groups.length === 0) return null;

  // Trekkingsvolgorde: pot per pot, binnen een pot willekeurig.
  const order: { teamId: string; pot: PotInput }[] = [];
  for (const pot of usablePots) {
    for (const teamId of shuffle(pot.teamIds)) {
      if (teamById.has(teamId)) order.push({ teamId, pot });
    }
  }

  const totalCapacity = groups.reduce((sum, g) => sum + g.capacity, 0);
  if (order.length > totalCapacity) return null;

  const groupState = new Map(
    groups.map((g) => [g.id, { teamIds: [] as string[], potIds: new Set<string>() }])
  );

  const canPlace = (teamId: string, pot: PotInput, group: GroupInput) => {
    const state = groupState.get(group.id)!;
    if (state.teamIds.length >= group.capacity) return false;
    if (rules.mode === "one_per_pot" && state.potIds.has(pot.id)) return false;

    const team = teamById.get(teamId);
    for (const otherId of state.teamIds) {
      if (blocked.has(blockedKey(teamId, otherId))) return false;
      if (rules.separateSameCountry) {
        const other = teamById.get(otherId);
        if (team?.country && other?.country && team.country === other.country) return false;
      }
    }
    return true;
  };

  const steps: DrawStep[] = [];
  const deadline = Date.now() + 2500;

  const solve = (index: number): boolean => {
    if (index >= order.length) return true;
    if (Date.now() > deadline) return false;

    const { teamId, pot } = order[index];
    // Groepen met de minste deelnemers eerst, willekeurig binnen gelijke stand.
    const candidates = shuffle(groups).sort(
      (a, b) => groupState.get(a.id)!.teamIds.length - groupState.get(b.id)!.teamIds.length
    );

    for (const group of candidates) {
      if (!canPlace(teamId, pot, group)) continue;

      const state = groupState.get(group.id)!;
      state.teamIds.push(teamId);
      state.potIds.add(pot.id);
      steps.push({
        teamId,
        potId: pot.id,
        potName: pot.name,
        groupId: group.id,
        groupName: group.name,
      });

      if (solve(index + 1)) return true;

      steps.pop();
      state.teamIds.pop();
      if (rules.mode === "one_per_pot") state.potIds.delete(pot.id);
    }

    return false;
  };

  for (let attempt = 0; attempt < 8; attempt++) {
    steps.length = 0;
    for (const state of groupState.values()) {
      state.teamIds = [];
      state.potIds.clear();
    }
    if (solve(0)) return [...steps];
  }

  return null;
}

export type PotPairing = { homeTeamId: string; awayTeamId: string; round: number };

/**
 * Genereert wedstrijden op basis van een pot-tegen-pot matrix (voor speelrondes).
 * Elke ontmoeting krijgt een eigen ronde zodat een deelnemer nooit twee keer
 * in dezelfde ronde staat.
 */
export function generatePotMatchups(
  pots: PotInput[],
  matrix: Record<string, number>
): PotPairing[] {
  const raw: { homeTeamId: string; awayTeamId: string }[] = [];

  for (let i = 0; i < pots.length; i++) {
    for (let j = i; j < pots.length; j++) {
      const count = matrix[`${pots[i].id}|${pots[j].id}`] ?? matrix[`${pots[j].id}|${pots[i].id}`] ?? 0;
      if (count <= 0) continue;

      const potA = pots[i];
      const potB = pots[j];

      if (potA.id === potB.id) {
        // Interne round robin binnen de pot, `count` keer.
        for (let rep = 0; rep < count; rep++) {
          for (let a = 0; a < potA.teamIds.length; a++) {
            for (let b = a + 1; b < potA.teamIds.length; b++) {
              const flip = rep % 2 === 1;
              raw.push({
                homeTeamId: flip ? potA.teamIds[b] : potA.teamIds[a],
                awayTeamId: flip ? potA.teamIds[a] : potA.teamIds[b],
              });
            }
          }
        }
        continue;
      }

      if (potA.teamIds.length === 0 || potB.teamIds.length === 0) continue;

      // Elke deelnemer uit pot A speelt `count` keer tegen wisselende
      // tegenstanders uit pot B (rotatie zodat de belasting gelijk blijft).
      for (let rep = 0; rep < count; rep++) {
        const teamsA = potA.teamIds;
        const teamsB = potB.teamIds;
        const size = Math.max(teamsA.length, teamsB.length);
        for (let k = 0; k < size; k++) {
          const home = teamsA[k % teamsA.length];
          const away = teamsB[(k + rep) % teamsB.length];
          if (!home || !away || home === away) continue;
          const flip = rep % 2 === 1;
          raw.push({
            homeTeamId: flip ? away : home,
            awayTeamId: flip ? home : away,
          });
        }
      }
    }
  }

  // Rondes toewijzen: greedy, een deelnemer mag maar één keer per ronde spelen.
  const rounds: Array<Set<string>> = [];
  const result: PotPairing[] = [];

  for (const pairing of raw) {
    let placed = false;
    for (let r = 0; r < rounds.length; r++) {
      if (!rounds[r].has(pairing.homeTeamId) && !rounds[r].has(pairing.awayTeamId)) {
        rounds[r].add(pairing.homeTeamId);
        rounds[r].add(pairing.awayTeamId);
        result.push({ ...pairing, round: r + 1 });
        placed = true;
        break;
      }
    }
    if (!placed) {
      rounds.push(new Set([pairing.homeTeamId, pairing.awayTeamId]));
      result.push({ ...pairing, round: rounds.length });
    }
  }

  return result.sort((a, b) => a.round - b.round);
}
