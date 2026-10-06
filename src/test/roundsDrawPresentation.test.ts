import { describe, expect, it } from "vitest";
import { roundsStage } from "@/lib/roundsDrawPresentation";

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
});