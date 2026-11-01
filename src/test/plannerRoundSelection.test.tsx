import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import MatchScheduler from "@/components/MatchScheduler";

const fixtures = vi.hoisted(() => ({
  tournament_phases: [
    { id: "groups-phase", name: "Groepsfase", phase_type: "group", phase_number: 1 },
    { id: "bracket-phase", name: "Finales", phase_type: "knockout", phase_number: 2 },
  ],
  groups: [{ id: "group-a", name: "Poule A", phase_id: "groups-phase", sort_order: 0 }],
  matches: [
    { id: "group-1", phase_id: "groups-phase", group_id: "group-a", round_number: 1 },
    { id: "group-2", phase_id: "groups-phase", group_id: "group-a", round_number: 2 },
    { id: "bracket-1", phase_id: "bracket-phase", group_id: null, round_number: 1 },
  ],
}));

vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: (table: string) => {
  const data = fixtures[table as keyof typeof fixtures] ?? [];
  const result = { data, error: null };
  const query: Record<string, unknown> = { then: (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve) };
  for (const method of ["select", "eq", "order", "range", "single", "update"]) query[method] = () => query;
  return query;
} } }));
vi.mock("@/lib/fetchTournamentMatches", () => ({ fetchTournamentMatches: async () => fixtures.matches }));
vi.mock("@/hooks/useScoringSystems", () => ({ useScoringSystems: () => ({ systems: [] }) }));
vi.mock("@/components/MatchDetailDialog", () => ({ default: () => null }));
vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => false }));

afterEach(cleanup);

async function selectParents() {
  render(<MatchScheduler tournamentId="test" tournament={{ name: "Test", fields: [], referees: [] }} />);
  fireEvent.click(await screen.findByText("Selecteer poules/brackets"));
  fireEvent.click(screen.getByText("Alle poules/brackets").closest("label") as HTMLLabelElement);
  fireEvent.click(screen.getByText("Plannen", { selector: "h3" }));
  const group = screen.getByText("Selecteer poules/brackets").parentElement;
  expect(group).not.toBeNull();
  return group as HTMLElement;
}

it("unchecking All rounds preserves the selected group and bracket", async () => {
  const parents = await selectParents();
  fireEvent.click(screen.getByText("Alle rondes"));
  fireEvent.click(screen.getByText("Alle rondes", { selector: "label" }));
  expect(within(parents).getByText("Alle poules/brackets", { selector: "span" })).toBeInTheDocument();
  expect(screen.getByText("Ronde 1 (Groepsfase)").closest("label")?.querySelector('[role="checkbox"]')).toHaveAttribute("aria-checked", "false");
});

it("unchecking individual rounds never removes either selected parent", async () => {
  const parents = await selectParents();
  fireEvent.click(screen.getByText("Alle rondes"));
  for (const label of ["Ronde 1 (Groepsfase)", "Ronde 2 (Groepsfase)", "Ronde 1 (Finales)"]) {
    fireEvent.click(screen.getByText(label).closest("label") as HTMLLabelElement);
    expect(within(parents).getByText("Alle poules/brackets", { selector: "span" })).toBeInTheDocument();
  }
});

it("clearing rounds with the clear control preserves the selected group and bracket", async () => {
  const parents = await selectParents();
  fireEvent.click(screen.getByRole("button", { name: "Rondeselectie wissen" }));
  expect(within(parents).getByText("Alle poules/brackets", { selector: "span" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Rondeselectie wissen" })).not.toBeInTheDocument();
});