import { describe, expect, it } from "vitest";
import { canChooseLiveDraw, liveRoundsAvailable } from "@/lib/liveDrawLimits";
import { generateRoundRobin } from "@/lib/matchGenerator";

describe("Live draw presentation limit", () => {
  it("supports rounds shows through twenty rounds", () => {
    for (const rounds of [1, 10, 11, 20]) {
      expect(liveRoundsAvailable(rounds)).toBe(true);
      expect(canChooseLiveDraw("full", rounds)).toBe(true);
      expect(canChooseLiveDraw("rounds", rounds)).toBe(true);
    }
  });
  it("keeps group draws accessible above twenty without allowing rounds shows", () => {
    for (const rounds of [21, 32, 64]) {
      expect(canChooseLiveDraw("groups", rounds)).toBe(true);
      expect(canChooseLiveDraw("full", rounds)).toBe(false);
      expect(canChooseLiveDraw("rounds", rounds)).toBe(false);
    }
  });
  it("automatically generates every configured round above the live-show limit", () => {
    const matches = generateRoundRobin(4, "custom", 21);
    expect(matches).toHaveLength(42);
    expect(new Set(matches.map((match) => match.round)).size).toBe(21);
    for (let round = 1; round <= 21; round++) {
      const teams = matches.filter((match) => match.round === round).flatMap((match) => [match.homeIdx, match.awayIdx]);
      expect(new Set(teams).size).toBe(4);
    }
  });
});