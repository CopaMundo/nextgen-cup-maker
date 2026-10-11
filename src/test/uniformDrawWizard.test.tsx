import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import LiveDrawDialog from "@/components/LiveDrawDialog";
import RoundsDrawDialog from "@/components/RoundsDrawDialog";

const fixtures = vi.hoisted(() => ({ excess: false, matches: false }));
vi.mock("@/hooks/useDrawTournamentName", () => ({ useDrawTournamentName: () => "Copa Mundo" }));
vi.mock("@/hooks/useDrawTournamentLogo", () => ({ useDrawTournamentLogo: () => null }));
vi.mock("@/hooks/useDrawShowOptions", () => ({ useDrawShowOptions: () => [{ theme: "copa-gold", speed: 1, flagBackdrops: true }, vi.fn()] }));
vi.mock("@/components/draw/DrawShow", () => ({ DrawShow: () => <div>Studio</div> }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: (table: string) => {
  const data = table === "groups" ? [{ id: "g1", name: "Groep A" }]
    : table === "teams" ? Array.from({ length: fixtures.excess ? 5 : 4 }, (_, i) => ({ id: `t${i}`, name: `Team ${i}`, country: null }))
    : table === "matches" && fixtures.matches ? [{ id: "m1", group_id: "g1", home_slot_label: "S0", away_slot_label: "S1", round_number: 1, match_name: "Wedstrijd 1" }, { id: "m2", group_id: "g1", home_slot_label: "S2", away_slot_label: "S3", round_number: 1, match_name: "Wedstrijd 2" }]
    : table === "slots" ? Array.from({ length: 4 }, (_, i) => ({ id: `s${i}`, group_id: "g1", team_id: null, slot_code: `S${i}`, sort_order: i })) : [];
  const query: Record<string, unknown> = {};
  for (const method of ["select", "eq", "order", "range", "insert", "upsert", "update", "delete", "in"]) query[method] = () => query;
  query.then = (resolve: (value: unknown) => unknown) => Promise.resolve({ data, error: null }).then(resolve);
  return query;
} } }));

beforeEach(() => { localStorage.clear(); fixtures.excess = false; fixtures.matches = false; });
afterEach(cleanup);
const props = { open: true, onOpenChange: vi.fn(), tournamentId: "tournament", phaseId: "phase" };

describe("Uniform draw preparation", () => {
  it.each(["knockout", "single_match"] as const)("uses four steps for %s with suitable methods", async kind => {
    fixtures.matches = true;
    render(<LiveDrawDialog {...props} fixtureKind={kind} />);
    await screen.findByRole("button", { name: "Willekeurige loting" });
    if (kind === "knockout") {
      fireEvent.click(screen.getByRole("button", { name: "Loting met reekshoofden" }));
      fireEvent.click(screen.getByRole("button", { name: "Volgende" }));
      await screen.findByRole("combobox", { name: "Reekshoofd 2" });
      expect(screen.getByRole("combobox", { name: "Aantal reekshoofden" })).toHaveTextContent("2");
    } else {
      expect(screen.queryByRole("button", { name: "Loting met reekshoofden" })).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Volgende" }));
      await screen.findByRole("heading", { name: "Indeling & teams" });
      fireEvent.click(screen.getByRole("button", { name: "Volgende" }));
      await screen.findByRole("heading", { name: "Regels" });
    }
  });

  it("keeps all four group steps visible and preserves selection when going back", async () => {
    render(<LiveDrawDialog {...props} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Volgende" })).toBeEnabled());
    expect(within(screen.getByRole("list", { name: "Lotingsstappen" })).getAllByRole("listitem")).toHaveLength(4);
    expect(screen.getByRole("heading", { name: "Live loting Copa Mundo · Groepsfase" })).toBeInTheDocument();
    expect(screen.queryByText(/Stap \d van 4/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Willekeurige loting" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("De teams worden volledig willekeurig over de beschikbare groepen verdeeld.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Opnieuw beginnen" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Willekeurig/ }));
    fireEvent.click(screen.getByRole("button", { name: "Volgende" }));
    await screen.findByRole("heading", { name: "Indeling & teams" });
    expect(screen.getByText("Alle 4 teams doen mee aan de loting.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Volgende" }));
    await screen.findByRole("heading", { name: "Regels" });
    fireEvent.click(screen.getByRole("button", { name: "Vorige" }));
    expect(screen.getByText("Alle 4 teams doen mee aan de loting.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Volgende" }));
    fireEvent.click(screen.getByRole("button", { name: "Volgende" }));
    await screen.findByRole("heading", { name: "Loting show instellingen" });
    expect(screen.queryByText("Landenlimiet per poule")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start loting show" })).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Landenvlag" })).toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: "Start loting show" }));
    await screen.findByText("Studio");
  });
  it("requires manual participant selection with excess teams", async () => {
    fixtures.excess = true;
    render(<LiveDrawDialog {...props} initialMethod="random" initialStep="teams" />);
    await screen.findByText("Deelnemers · 0/4");
    expect(screen.getByRole("checkbox", { name: "Team 0" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Volgende" }));
    expect(screen.getByRole("heading", { name: "Indeling & teams" })).toBeInTheDocument();
  });
  it("uses the same header and separate team step for rounds", async () => {
    render(<RoundsDrawDialog {...props} defaultRounds={2} />);
    await screen.findByRole("button", { name: /^Willekeurig/ });
    expect(within(screen.getByRole("list", { name: "Lotingsstappen" })).getAllByRole("listitem")).toHaveLength(4);
    expect(screen.queryByRole("button", { name: "Opnieuw beginnen" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Volgende" }));
    await screen.findByRole("heading", { name: "Indeling & teams" });
  });
});