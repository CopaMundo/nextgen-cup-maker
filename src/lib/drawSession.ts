/**
 * Toestand van een live loting. De volledige toestand zit in één object dat in
 * `draw_sessions.state` bewaard wordt, zodat het live scherm realtime meevolgt.
 */

import {
  applyPairToCtx,
  buildContainerCtx,
  buildRoundsCtx,
  computeRoundsForGroup,
  type ContainerRules,
  type DrawContainer,
  type DrawKind,
  type DrawMode,
  type DrawPot,
  type DrawTeam,
  type RoundsRules,
  shuffle,
  validContainersFor,
  validOpponents,
} from "./liveDraw";

export interface RoundsGroup {
  groupId: string;
  groupName: string;
  totalRounds: number;
  teamIds: string[];
}

export interface DrawPairRecord {
  groupId: string;
  round: number;
  homeId: string;
  awayId: string;
}

export interface PendingDraw {
  teamId: string;
  /** Geldige keuzes: bakje-id (containers) of tegenstander-id (speelrondes). */
  options: { id: string; label: string }[];
}

export interface DrawSessionState {
  kind: DrawKind;
  mode: DrawMode;
  phaseName: string;
  teams: DrawTeam[];
  pots: DrawPot[];

  /** Containers-loting. */
  containers: DrawContainer[];
  containerRules: ContainerRules | null;
  remaining: string[];
  activePotId: string | null;

  /** Speelrondes-loting. */
  roundsGroups: RoundsGroup[];
  roundsRules: RoundsRules | null;
  pairs: DrawPairRecord[];
  activeGroupIndex: number;
  activeRound: number;
  availableThisRound: string[];

  pending: PendingDraw | null;
  history: { teamId: string; targetId: string; label: string }[];
  log: string[];
  finished: boolean;
}

export const teamName = (state: DrawSessionState, id: string) =>
  state.teams.find((t) => t.id === id)?.name || "?";

/* ---------------------------- initialisatie ---------------------------- */

export function initContainersState(input: {
  phaseName: string;
  mode: DrawMode;
  teams: DrawTeam[];
  pots: DrawPot[];
  containers: DrawContainer[];
  rules: ContainerRules;
}): DrawSessionState {
  const inPots = new Set(input.pots.flatMap((p) => p.teamIds));
  const remaining =
    input.mode === "pots"
      ? input.pots.flatMap((p) => shuffle(p.teamIds))
      : shuffle(input.teams.map((t) => t.id));
  return {
    kind: "containers",
    mode: input.mode,
    phaseName: input.phaseName,
    teams: input.teams,
    pots: input.mode === "pots" ? input.pots : [],
    containers: input.containers.map((c) => ({ ...c, teamIds: [...c.teamIds] })),
    containerRules: { ...input.rules, onePerPot: input.mode === "pots" ? input.rules.onePerPot : false },
    remaining: input.mode === "pots" ? remaining.filter((id) => inPots.has(id)) : remaining,
    activePotId: null,
    roundsGroups: [],
    roundsRules: null,
    pairs: [],
    activeGroupIndex: 0,
    activeRound: 1,
    availableThisRound: [],
    pending: null,
    history: [],
    log: [],
    finished: false,
  };
}

export function initRoundsState(input: {
  phaseName: string;
  mode: DrawMode;
  teams: DrawTeam[];
  pots: DrawPot[];
  groups: RoundsGroup[];
  rules: RoundsRules;
}): DrawSessionState {
  const first = input.groups[0];
  return {
    kind: "rounds",
    mode: input.mode,
    phaseName: input.phaseName,
    teams: input.teams,
    pots: input.mode === "pots" ? input.pots : [],
    containers: [],
    containerRules: null,
    remaining: [],
    activePotId: null,
    roundsGroups: input.groups,
    roundsRules: input.rules,
    pairs: [],
    activeGroupIndex: 0,
    activeRound: 1,
    availableThisRound: first ? shuffle(first.teamIds) : [],
    pending: null,
    history: [],
    log: [],
    finished: !first,
  };
}

/* ------------------------------ trekken ------------------------------- */

function containerCtxFor(state: DrawSessionState) {
  return buildContainerCtx(state.teams, state.pots, state.containerRules!);
}

function roundsCtxFor(state: DrawSessionState) {
  const ctx = buildRoundsCtx(state.teams, state.pots, state.roundsRules!);
  for (const pair of state.pairs) applyPairToCtx(ctx, pair.homeId, pair.awayId, 1);
  return ctx;
}

/** Trekt de volgende deelnemer en berekent de geldige keuzes. */
export function drawNext(state: DrawSessionState, forcedTeamId?: string, potId?: string | null): DrawSessionState {
  if (state.finished || state.pending) return state;

  if (state.kind === "containers") {
    let pool = state.remaining;
    if (state.mode === "pots") {
      // Gekozen actieve pot, anders de eerste pot met resterende teams.
      const chosen = potId ? state.pots.find((p) => p.id === potId && p.teamIds.some((id) => state.remaining.includes(id))) : null;
      const activePot = chosen || state.pots.find((p) => p.teamIds.some((id) => state.remaining.includes(id)));
      if (activePot) pool = state.remaining.filter((id) => activePot.teamIds.includes(id));
      if (!activePot) return { ...state, finished: true };
    }
    if (pool.length === 0) return { ...state, finished: true };
    const teamId = forcedTeamId && pool.includes(forcedTeamId) ? forcedTeamId : pool[Math.floor(Math.random() * pool.length)];
    const ctx = containerCtxFor(state);
    const remainingAfter = state.remaining.filter((id) => id !== teamId);
    const validIds = validContainersFor(teamId, remainingAfter, state.containers, ctx);
    const options = validIds.map((id) => ({
      id,
      label: state.containers.find((c) => c.id === id)?.name || id,
    }));
    const activePotId = state.pots.find((p) => p.teamIds.includes(teamId))?.id ?? null;
    return { ...state, pending: { teamId, options }, activePotId };
  }

  // Speelrondes
  const group = state.roundsGroups[state.activeGroupIndex];
  if (!group) return { ...state, finished: true };
  let available = state.availableThisRound;
  if (available.length < 2) {
    const next = advanceRounds(state);
    if (next.finished) return next;
    return drawNext(next, forcedTeamId);
  }
  const teamId = forcedTeamId && available.includes(forcedTeamId) ? forcedTeamId : available[Math.floor(Math.random() * available.length)];
  const ctx = roundsCtxFor(state);
  const opponents = validOpponents(teamId, available, ctx, group.teamIds);
  const activePotId = state.pots.find((p) => p.teamIds.includes(teamId))?.id ?? null;
  return {
    ...state,
    activePotId,
    pending: {
      teamId,
      options: opponents.map((id) => ({ id, label: teamName(state, id) })),
    },
  };
}

/** Zet de loting naar de volgende speelronde of groep. */
function advanceRounds(state: DrawSessionState): DrawSessionState {
  const group = state.roundsGroups[state.activeGroupIndex];
  if (!group) return { ...state, finished: true };
  if (state.activeRound < group.totalRounds) {
    return {
      ...state,
      activeRound: state.activeRound + 1,
      availableThisRound: shuffle(group.teamIds),
    };
  }
  const nextIndex = state.activeGroupIndex + 1;
  const nextGroup = state.roundsGroups[nextIndex];
  if (!nextGroup) return { ...state, finished: true, availableThisRound: [] };
  return {
    ...state,
    activeGroupIndex: nextIndex,
    activeRound: 1,
    availableThisRound: shuffle(nextGroup.teamIds),
  };
}

/** Bevestigt de openstaande trekking op de gekozen (of eerste geldige) keuze. */
export function confirmPending(state: DrawSessionState, targetId?: string): DrawSessionState {
  if (!state.pending) return state;
  const { teamId, options } = state.pending;
  const choice = targetId && options.some((o) => o.id === targetId) ? targetId : options[0]?.id;
  if (!choice) return state;

  if (state.kind === "containers") {
    const containers = state.containers.map((c) =>
      c.id === choice ? { ...c, teamIds: [...c.teamIds, teamId] } : c
    );
    const label = state.containers.find((c) => c.id === choice)?.name || choice;
    const remaining = state.remaining.filter((id) => id !== teamId);
    return {
      ...state,
      containers,
      remaining,
      pending: null,
      history: [...state.history, { teamId, targetId: choice, label }],
      log: [...state.log, `${teamName(state, teamId)} → ${label}`],
      finished: remaining.length === 0,
    };
  }

  const group = state.roundsGroups[state.activeGroupIndex];
  const pairs = [
    ...state.pairs,
    { groupId: group.groupId, round: state.activeRound, homeId: teamId, awayId: choice },
  ];
  const available = state.availableThisRound.filter((id) => id !== teamId && id !== choice);
  let next: DrawSessionState = {
    ...state,
    pairs,
    availableThisRound: available,
    pending: null,
    history: [...state.history, { teamId, targetId: choice, label: teamName(state, choice) }],
    log: [
      ...state.log,
      `${group.groupName} · speelronde ${state.activeRound}: ${teamName(state, teamId)} - ${teamName(state, choice)}`,
    ],
  };
  if (available.length < 2) next = advanceRounds(next);
  return next;
}

/** Maakt de laatste bevestigde trekking ongedaan. */
export function undoLast(state: DrawSessionState): DrawSessionState {
  const last = state.history[state.history.length - 1];
  if (!last) return state;
  const history = state.history.slice(0, -1);
  const log = state.log.slice(0, -1);

  if (state.kind === "containers") {
    return {
      ...state,
      containers: state.containers.map((c) =>
        c.id === last.targetId ? { ...c, teamIds: c.teamIds.filter((id) => id !== last.teamId) } : c
      ),
      remaining: [last.teamId, ...state.remaining],
      pending: null,
      history,
      log,
      finished: false,
    };
  }

  const pairs = state.pairs.slice(0, -1);
  const removed = state.pairs[state.pairs.length - 1];
  if (!removed) return state;
  const groupIndex = state.roundsGroups.findIndex((g) => g.groupId === removed.groupId);
  const group = state.roundsGroups[groupIndex];
  const usedInRound = new Set(
    pairs.filter((p) => p.groupId === removed.groupId && p.round === removed.round).flatMap((p) => [p.homeId, p.awayId])
  );
  return {
    ...state,
    pairs,
    activeGroupIndex: groupIndex >= 0 ? groupIndex : state.activeGroupIndex,
    activeRound: removed.round,
    availableThisRound: (group?.teamIds || []).filter((id) => !usedInRound.has(id)),
    pending: null,
    history,
    log,
    finished: false,
  };
}

/** Trekt de volledige loting in één keer uit. */
export function drawAll(state: DrawSessionState): DrawSessionState {
  let current = state.pending ? confirmPending(state) : state;
  if (current.kind === "rounds" && current.pairs.length === 0) {
    // Volledige berekening per groep is sneller dan stap per stap.
    const ctx = buildRoundsCtx(current.teams, current.pots, current.roundsRules!);
    const pairs: DrawPairRecord[] = [];
    for (const group of current.roundsGroups) {
      const result = computeRoundsForGroup(group.teamIds, group.totalRounds, ctx);
      if (!result) return current;
      for (const pair of result) pairs.push({ groupId: group.groupId, round: pair.round, homeId: pair.homeId, awayId: pair.awayId });
    }
    return {
      ...current,
      pairs,
      pending: null,
      availableThisRound: [],
      finished: true,
      history: pairs.map((p) => ({ teamId: p.homeId, targetId: p.awayId, label: teamName(current, p.awayId) })),
      log: pairs.map(
        (p) =>
          `${current.roundsGroups.find((g) => g.groupId === p.groupId)?.groupName} · speelronde ${p.round}: ${teamName(current, p.homeId)} - ${teamName(current, p.awayId)}`
      ),
    };
  }

  let guard = 0;
  while (!current.finished && guard++ < 2000) {
    const drawn = drawNext(current);
    if (!drawn.pending) {
      if (drawn.finished) return drawn;
      current = drawn;
      continue;
    }
    current = confirmPending(drawn);
  }
  return current;
}
