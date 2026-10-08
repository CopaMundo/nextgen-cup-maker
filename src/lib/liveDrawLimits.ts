/** Presentation limits do not restrict tournament format creation or group draws. */
export const MAX_LIVE_DRAW_ROUNDS = 20;

export const liveRoundsAvailable = (rounds: number) => rounds <= MAX_LIVE_DRAW_ROUNDS;

export const liveRoundsLimitMessage = "De live show voor speelrondes is beschikbaar tot maximaal 20 speelrondes. Voor dit toernooi worden de speelrondes automatisch gegenereerd. Je kunt wel de groepen live loten.";

export const canChooseLiveDraw = (mode: "full" | "groups" | "rounds", rounds: number) =>
  mode === "groups" || liveRoundsAvailable(rounds);