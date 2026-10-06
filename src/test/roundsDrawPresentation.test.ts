import { describe, expect, it } from "vitest";
import { orderedTeamFixtures, roundsRosterWindow, roundsStage } from "@/lib/roundsDrawPresentation";

describe("Rounds fan picture", () => {
  const input = {
    groupName: "Groep A", order: ["a", "b", "c", "d"], currentIndex: 1,
    matches: [{ round: 2, homeId: "b", awayId: "d" }, { round: 1, homeId: "a", awayId: "b" }],
    pots: [{ name: "Pot 1", teamIds: ["a", "b"] }, { name: "Pot 2", teamIds: ["c", "d"] }],
    revealed: [1], revealTimes: {},
  };
  it("shows an earlier team's known fixture immediately and hides the remaining opponent", () => {
    const picture = roundsStage(input);
    expect(picture.drawnTeamIds).toEqual(["a", "b"]);
    expect(picture.fixtures.map((fixture) => fixture.opponentId)).toEqual(["a", null]);
    expect(picture.fixtures[0]).toMatchObject({ round: 1, home: false, revealAt: null });
  });
  it("reveals opponents in pot order with the shared reveal timestamp", () => {
    const picture = roundsStage({ ...input, revealed: [0, 1], revealTimes: { "0": 2000 } });
    expect(picture.fixtures[1]).toMatchObject({ opponentId: "d", potName: "Pot 2", revealAt: 2000 });
  });
  it("publishes no fixtures or drawn teams before the first ball", () => {
    expect(roundsStage({ ...input, currentIndex: -1 })).toMatchObject({ drawnTeamIds: [], fixtures: [] });
  });
  it("puts already known opponents first in free draws, regardless of round", () => {
    const matches = [{ round: 1, homeId: "b", awayId: "d" }, { round: 4, homeId: "a", awayId: "b" }];
    const picture = roundsStage({ ...input, matches, pots: [{ name: "Alle teams", teamIds: input.order }], usePots: false });
    expect(picture.fixtures.map((fixture) => fixture.opponentId)).toEqual(["a", null]);
  });
  it("keeps match order within each pot, not round order", () => {
    const matches = [{ round: 4, homeId: "b", awayId: "c" }, { round: 1, homeId: "b", awayId: "d" }];
    expect(orderedTeamFixtures(matches, "b", input.pots, [], true).map(({ i }) => i)).toEqual([0, 1]);
  });
  it("anchors previously known opponents above open pot rows without jumping during reveals", () => {
    const config = { ...input, order: ["d", "b", "a", "c"], matches: [
      { round: 1, homeId: "b", awayId: "a" }, { round: 3, homeId: "b", awayId: "d" }, { round: 2, homeId: "b", awayId: "c" },
    ], revealed: [1] };
    const before = roundsStage(config);
    const during = roundsStage({ ...config, revealed: [1, 0], revealTimes: { "0": 3000 } });
    expect(before.fixtures.map((fixture) => fixture.id)).toEqual(["1", "0", "2"]);
    expect(during.fixtures.map((fixture) => fixture.id)).toEqual(before.fixtures.map((fixture) => fixture.id));
    expect(during.fixtures[0].opponentId).toBe("d");
  });
  it("publishes roster badges only for drawn teams and revealed encounters", () => {
    const picture = roundsStage(input);
    expect(picture.roster).toEqual([
      { teamId: "a", opponents: [{ id: "1", opponentId: "b", revealAt: null }] },
      { teamId: "b", opponents: [{ id: "1", opponentId: "a", revealAt: null }] },
    ]);
    expect(roundsStage({ ...input, revealed: [0, 1], revealTimes: { "0": 3000 } }).roster?.[1].opponents[1]).toMatchObject({ opponentId: "d", revealAt: 3000 });
  });
  it("shows all 24 teams and bounded centered windows for larger groups", () => {
    const order = Array.from({ length: 64 }, (_, i) => String(i));
    expect(roundsRosterWindow(order.slice(0, 24), "12")).toHaveLength(24);
    expect(roundsRosterWindow(order.slice(0, 32), "16")).toEqual(order.slice(12, 20));
    expect(roundsRosterWindow(order, "32")).toEqual(order.slice(27, 37));
    expect(roundsRosterWindow(order, "63")).toEqual(order.slice(54));
    expect(roundsRosterWindow(order, undefined)).toEqual(order.slice(0, 10));
  });
});