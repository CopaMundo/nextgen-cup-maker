import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MatchDrawSetup } from "@/components/draw/MatchDrawSetup";

afterEach(cleanup);
const containers = [{ id: "m1", name: "Wedstrijd 1", capacity: 2, slotIds: ["h1", "a1"], teamIds: [] as string[], matchSlots: [null, null], seedRanks: [null, null] }];
const teams = [{ id: "t1", name: "Ajax" }, { id: "t2", name: "PSV" }];
const props = { teams, selectedIds: ["t1", "t2"], containers, originals: containers, onTeamsChange: vi.fn(), seedCount: 1, onSeedCount: vi.fn(), onSeed: vi.fn() };
describe("Fixture assignment step", () => {
  it("uses a numbered seed list with a separate fixed-position choice", () => {
    render(<MatchDrawSetup {...props} useSeeds />);
    expect(screen.getByRole("combobox", { name: "Reekshoofd 1" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Bracketpositie reekshoofd 1" })).toBeDisabled();
    expect(screen.queryByRole("combobox", { name: "Teamvak 1" })).not.toBeInTheDocument();
  });
  it("only asks for participant selection when there are excess teams", () => {
    render(<MatchDrawSetup {...props} teams={[...teams, { id: "t3", name: "Feyenoord" }]} useSeeds={false} />);
    expect(screen.getAllByRole("checkbox").length).toBeGreaterThan(2);
    expect(screen.queryByRole("combobox", { name: "Reekshoofd 1" })).not.toBeInTheDocument();
  });
});