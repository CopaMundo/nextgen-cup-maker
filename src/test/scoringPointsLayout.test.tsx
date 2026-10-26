import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ScoringSystemsManager from "@/components/ScoringSystemsManager";

const { SYSTEM } = vi.hoisted(() => ({
  SYSTEM: {
    id: "sys-1",
    tournament_id: "t-1",
    name: "Standaard",
    sort_order: 0,
    scoring_type: "points",
    points_win: 3,
    points_draw: 1,
    points_loss: 0,
    points_big_win: 3,
    big_win_threshold: 2,
    points_win_overtime: 3,
    points_draw_with_goals: 1,
    points_draw_no_goals: 1,
    points_loss_overtime: 0,
    no_draws: false,
    tiebreaker_rules: ["goal_difference", "wins"],
    h2h_sub_rules: ["points"],
    num_sets: 1,
    playoff_mode: false,
    decisive_set: false,
    decisive_set_goal_diff: false,
    set_points_mode: "total_result",
    set_result_points: {},
  },
}));

vi.mock("@/integrations/supabase/client", () => {
  const query = (result: any) => {
    const q: any = { then: (res: any) => Promise.resolve(result).then(res) };
    return new Proxy(q, { get: (t, p) => (p in t ? (t as any)[p] : () => q) });
  };
  return { supabase: { from: () => query({ data: [SYSTEM], count: 0, error: null }) } };
});

const rowOf = (label: string) => {
  const input = screen.getByLabelText(label);
  const row = input.closest("div.grid");
  if (!row) throw new Error(`Veld "${label}" staat niet in een rij`);
  return row as HTMLElement;
};

afterEach(() => cleanup());

describe("Puntentoekenning in groepswedstrijden", () => {
  it("zet winst, gelijkspel en verlies op één horizontale rij", async () => {
    render(<ScoringSystemsManager tournamentId="t-1" />);
    await screen.findByLabelText("Bij winst");

    expect(rowOf("Bij gelijkspel")).toBe(rowOf("Bij winst"));
    expect(rowOf("Bij verlies")).toBe(rowOf("Bij winst"));
    expect(rowOf("Bij winst").className).toContain("sm:grid-cols-3");
    expect(rowOf("Bij winst").querySelectorAll('input[type="number"]')).toHaveLength(3);
  });

  it("schikt geavanceerde velden naast hun eigen basiswaarde", async () => {
    render(<ScoringSystemsManager tournamentId="t-1" />);
    fireEvent.click(await screen.findByLabelText("Geavanceerde instellingen"));

    expect(rowOf("Bij winst na verlenging, strafschoppen of golden goal")).toBe(rowOf("Bij winst"));
    expect(rowOf("Bij winst").className).toContain("sm:grid-cols-2");

    expect(rowOf("Bij gelijkspel met doelpunten")).toBe(rowOf("Bij gelijkspel"));
    expect(rowOf("Bij gelijkspel zonder doelpunten")).toBe(rowOf("Bij gelijkspel"));
    expect(rowOf("Bij gelijkspel").querySelectorAll('input[type="number"]')).toHaveLength(3);

    expect(rowOf("Bij verlies na verlenging, strafschoppen of golden goal")).toBe(rowOf("Bij verlies"));
    expect(rowOf("Bij verlies").className).toContain("sm:grid-cols-2");
  });
});
