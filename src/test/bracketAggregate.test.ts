import { describe, expect, it } from "vitest";
import { bracketAggregate } from "@/lib/bracketAggregate";

describe("home/away encounter totals", () => {
  it("retains the first leg score while the return leg is unplayed", () => {
    expect(bracketAggregate({ home_score: 2, away_score: 1 }, { home_score: null, away_score: null }))
      .toEqual({ homeTotal: 2, awayTotal: 1 });
  });
  it("adds the return leg in reversed home/away orientation", () => {
    expect(bracketAggregate({ home_score: 2, away_score: 1 }, { home_score: 4, away_score: 3 }))
      .toEqual({ homeTotal: 5, awayTotal: 5 });
  });
});