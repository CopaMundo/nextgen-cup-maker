import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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
    const chain: any = new Proxy(q, { get: (t, p) => (p in t ? (t as any)[p] : () => chain) });
    return chain;
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

describe("Puntentoekenning", () => {
  it("zet winst, gelijkspel en verlies op één horizontale rij", async () => {
    render(<ScoringSystemsManager tournamentId="t-1" />);
    await screen.findByLabelText("Bij winst");

    expect(rowOf("Bij gelijkspel")).toBe(rowOf("Bij winst"));
    expect(rowOf("Bij verlies")).toBe(rowOf("Bij winst"));
    expect(rowOf("Bij winst").className).toContain("sm:grid-cols-3");
    expect(rowOf("Bij winst").querySelectorAll('input[type="number"]')).toHaveLength(3);
  });

  it("schikt geavanceerde velden: alle winst bij elkaar, daarna gelijkspel en verlies", async () => {
    render(<ScoringSystemsManager tournamentId="t-1" />);
    fireEvent.click(await screen.findByLabelText("Geavanceerde instellingen"));

    expect(rowOf("Bij een grote overwinning")).toBe(rowOf("Bij winst"));
    expect(rowOf("Bij winst na gelijkspel")).toBe(rowOf("Bij winst"));
    expect(rowOf("Bij winst").className).toContain("sm:grid-cols-3");

    // Gelijkspel toont alleen de twee varianten, naast elkaar
    expect(rowOf("Bij gelijkspel met doelpunten")).toBe(rowOf("Bij gelijkspel zonder doelpunten"));
    expect(rowOf("Bij gelijkspel met doelpunten").querySelectorAll('input[type="number"]')).toHaveLength(2);

    expect(rowOf("Bij verlies na gelijkspel")).toBe(rowOf("Bij verlies"));
    expect(rowOf("Bij verlies").className).toContain("sm:grid-cols-2");

    const winstRow = rowOf("Bij winst");
    const gelijkRow = rowOf("Bij gelijkspel met doelpunten");
    expect(winstRow.compareDocumentPosition(gelijkRow) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("staat de schakelaar 'geen gelijkspel' direct bij de gelijkspelvelden en schakelt die uit", async () => {
    render(<ScoringSystemsManager tournamentId="t-1" />);
    fireEvent.click(await screen.findByLabelText("Geavanceerde instellingen"));

    const gelijkRow = rowOf("Bij gelijkspel met doelpunten");
    const schakelaarTitel = screen.getByText("Groepswedstrijden mogen niet eindigen in een gelijkspel");
    expect(gelijkRow.compareDocumentPosition(schakelaarTitel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect((schakelaarTitel.closest("div.grid") ?? schakelaarTitel.parentElement?.parentElement?.parentElement)?.textContent)
      .not.toContain("Bij verlies");

    const switches = screen.getAllByRole("switch");
    fireEvent.click(switches[switches.length - 1]);

    await waitFor(() => expect(screen.getByLabelText("Bij gelijkspel met doelpunten")).toBeDisabled());
    expect(screen.getByLabelText("Bij gelijkspel zonder doelpunten")).toBeDisabled();
    expect(screen.getByLabelText("Bij winst na gelijkspel")).toBeEnabled();
    expect(screen.getByLabelText("Bij verlies na gelijkspel")).toBeEnabled();
  });

  it("geeft veldlabels het standaard gewicht en zet de geavanceerde schakelaar naast de titel", async () => {
    render(<ScoringSystemsManager tournamentId="t-1" />);
    const input = await screen.findByLabelText("Bij winst");
    const label = document.querySelector(`label[for="${input.id}"]`);
    expect(label?.className).toContain("font-medium");
    expect(label?.className).toContain("text-foreground");
    expect(label?.className).not.toContain("text-muted-foreground");

    const title = await screen.findByText("Puntentoekenning");
    expect(title.textContent).toBe("Puntentoekenning");
    expect(screen.queryByText(/^Puntentoekenning in/)).toBeNull();

    const advSwitch = screen.getByLabelText("Geavanceerde instellingen");
    expect(advSwitch.closest("div")?.parentElement).toBe(title.closest("div")?.parentElement);
    expect(advSwitch.closest("div")?.parentElement?.textContent).toContain("Puntentoekenning");
  });
});
