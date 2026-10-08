import { describe, expect, it } from "vitest";
import { canChooseLiveDraw, liveRoundsAvailable } from "@/lib/liveDrawLimits";

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
});