import { describe, it, expect } from "vitest";
import { generateSetOutcomes } from "@/components/ScoringSystemsManager";

describe("set outcomes", () => {
  it("2 sets zonder beslissende set bevat 1-1 gelijkspel", () => {
    expect(generateSetOutcomes(2, false, false).map((o) => o.key)).toEqual(["2-0", "1-1"]);
  });
  it("2 sets met beslissende set geeft 2-1 in plaats van 1-1", () => {
    const o = generateSetOutcomes(2, false, true);
    expect(o.map((x) => x.key)).toEqual(["2-0", "2-1"]);
    expect(o.some((x) => x.isDraw)).toBe(false);
  });
});
