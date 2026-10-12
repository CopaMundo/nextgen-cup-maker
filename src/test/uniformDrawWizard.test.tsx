import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import LiveDrawDialog from "@/components/LiveDrawDialog";
import RoundsDrawDialog from "@/components/RoundsDrawDialog";

const fixtures = vi.hoisted(() => ({ excess: false, matches: false, occupied: false }));
vi.mock("@/hooks/useDrawTournamentName", () => ({ useDrawTournamentName: () => "Copa Mundo" }));
vi.mock("@/hooks/useDrawTournamentLogo", () => ({ useDrawTournamentLogo: () => null }));
vi.mock("@/hooks/useDrawShowOptions", () => ({ useDrawShowOptions: () => [{ theme: "copa-gold", speed: 1, flagBackdrops: true }, vi.fn()] }));
vi.mock("@/components/draw/DrawShow", () => ({ DrawShow: () => <div>Studio</div> }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: (table: string) => {
  const data = table === "groups" ? [{ id: "g1", name: "Groep A" }]
    : table === "teams" ? Array.from({ length: fixtures.excess ? 5 : 4 }, (_, i) => ({ id: `t${i}`, name: `Team ${i}`, country: i < 3 ? "Belgium" : "Netherlands" }))
    : table === "matches" && fixtures.matches ? [{ id: "m1", group_id: "g1", home_slot_label: "S0", away_slot_label: "S1", round_number: 1, match_name: "Wedstrijd 1" }, { id: "m2", group_id: "g1", home_slot_label: "S2", away_slot_label: "S3", round_number: 1, match_name: "Wedstrijd 2" }]
    : table === "slots" ? Array.from({ length: 4 }, (_, i) => ({ id: `s${i}`, group_id: "g1", team_id: fixtures.occupied ? `t${i}` : null, slot_code: `S${i}`, sort_order: i })) : [];
  const query: Record<string, unknown> = {};
  for (const method of ["select", "eq", "order", "range", "insert", "upsert", "update", "delete", "in"]) query[method] = () => query;
  query.then = (resolve: (value: unknown) => unknown) => Promise.resolve({ data, error: null }).then(resolve);
  return query;
} } }));

beforeEach(() => { localStorage.clear(); fixtures.excess = false; fixtures.matches = false; fixtures.occupied = false; });
afterEach(cleanup);
const props = { open: true, onOpenChange: vi.fn(), tournamentId: "tournament", phaseId: "phase" };

describe("Uniform draw preparation", () => {
  it("shows the pot distribution table directly with the helper text", async () => {
    Object.defineProperty(Element.prototype, "scrollIntoView", { configurable: true, value: vi.fn() });
    render(<LiveDrawDialog {...props} initialMethod="pots" initialStep="teams" />);
    await screen.findByText("0 / 4");
    const slots = screen.getAllByRole("combobox", { name: /Teamvak/ });
    for (let index = 0; index < slots.length - 1; index++) {
      fireEvent.click(slots[index]);
      fireEvent.click(await screen.findByRole("option", { name: `Team ${index}` }));
    }
    fireEvent.click(screen.getByRole("button", { name: "Volgende" }));
    await screen.findByRole("heading", { name: "Regels" });
    expect(screen.queryByText("Geavanceerde groepsverdeling aanpassen")).not.toBeInTheDocument();
    expect(screen.getByText(/Pas hieronder eventueel jouw voorkeuren aan/)).toBeInTheDocument();
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Automatische verdeling herstellen" })).toBeInTheDocument();
  });
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
    expect(screen.getByRole("heading", { name: "DEELNEMERS" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Volgende" }));
    await screen.findByRole("heading", { name: "Regels" });
    fireEvent.click(screen.getByRole("button", { name: "Vorige" }));
    expect(screen.getByRole("heading", { name: "DEELNEMERS" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Volgende" }));
    fireEvent.click(screen.getByRole("button", { name: "Volgende" }));
    await screen.findByRole("heading", { name: "Instellingen Live loting" });
    expect(screen.queryByText("Landenlimiet per poule")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start loting show" })).toBeInTheDocument();
    expect(within(screen.getByRole("group", { name: "Landenvlag tonen achter teamnaam" })).getByRole("button", { name: "Aan" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "Start loting show" }));
    await screen.findByText("Studio");
  });
  it("shows pot errors only after trying to continue", async () => {
    render(<LiveDrawDialog {...props} initialMethod="pots" initialStep="teams" />);
    await screen.findByText("0 / 4");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Volgende" }));
    expect(screen.getByRole("heading", { name: "Indeling & teams" })).toBeInTheDocument();
  });
  it("defaults country limits to unrestricted and counts selected participants", async () => {
    fixtures.excess = true;
    render(<LiveDrawDialog {...props} initialStep="teams" />);
    await screen.findByText("5 / 4");
    fireEvent.click(screen.getByRole("checkbox", { name: "Team 2" }));
    fireEvent.click(screen.getByRole("button", { name: "Volgende" }));
    await screen.findByRole("heading", { name: "Regels" });
    expect(screen.getByText("Geen beperking")).toBeInTheDocument();
    const countryHeading = screen.getByRole("heading", { name: "Landenregels" });
    expect(countryHeading.closest(".draw-panel")).toBeNull();
    expect(screen.getByText("Aantal teams uit hetzelfde land per poule").closest(".draw-panel")).not.toBeNull();
    expect(screen.getByText("Teams die niet samen in één poule mogen worden geloot").closest(".draw-panel")).not.toBeNull();
    expect(screen.queryByText("Uitzonderingen op de landenlimiet")).not.toBeInTheDocument();
  });
  it("starts excess participants checked and requires the exact number", async () => {
    fixtures.excess = true;
    render(<LiveDrawDialog {...props} initialMethod="random" initialStep="teams" />);
    await screen.findByText("5 / 4");
    expect(screen.getByRole("checkbox", { name: "Team 0" })).toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: "Volgende" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Selecteer precies 4 teams");
    fireEvent.click(screen.getByRole("checkbox", { name: "Team 4" }));
    fireEvent.click(screen.getByRole("button", { name: "Volgende" }));
    await screen.findByRole("heading", { name: "Regels" });
  });
  it.each([undefined, "knockout", "single_match"] as const)("allows unchecking exact participants and preserves choices for %s", async fixtureKind => {
    fixtures.matches = Boolean(fixtureKind);
    const { unmount } = render(<LiveDrawDialog {...props} fixtureKind={fixtureKind} initialStep="teams" />);
    await screen.findByText("4 / 4");
    expect(screen.getAllByRole("checkbox")).toHaveLength(4);
    expect(screen.getByRole("heading", { name: "Indeling & teams" })).toHaveClass("section-title");
    expect(screen.getByRole("heading", { name: "DEELNEMERS" })).toHaveClass("form-label");
    expect(screen.getByRole("heading", { name: "DEELNEMERS" })).not.toHaveClass("section-title");
    expect(screen.getByRole("checkbox", { name: "Team 0" }).closest("label")).toHaveClass("bg-background", "border-input");
    for (const checkbox of screen.getAllByRole("checkbox")) expect(checkbox).toBeChecked();
    fireEvent.click(screen.getByRole("checkbox", { name: "Team 0" }));
    fireEvent.click(screen.getByRole("button", { name: "Volgende" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Selecteer precies 4");
    expect(screen.getByRole("alert")).toHaveTextContent("3 teams geselecteerd");
    unmount();
    render(<LiveDrawDialog {...props} fixtureKind={fixtureKind} initialStep="teams" />);
    await screen.findByText("3 / 4");
    expect(screen.getByRole("checkbox", { name: "Team 0" })).not.toBeChecked();
    fireEvent.click(screen.getByRole("checkbox", { name: "Team 0" }));
    fireEvent.click(screen.getByRole("button", { name: "Volgende" }));
    await screen.findByRole("heading", { name: "Regels" });
  });
  it("requires all assigned rounds participants to remain selected", async () => {
    fixtures.occupied = true;
    render(<RoundsDrawDialog {...props} defaultRounds={2} />);
    await screen.findByRole("button", { name: /^Willekeurig/ });
    fireEvent.click(screen.getByRole("button", { name: "Volgende" }));
    await screen.findByText("4 / 4");
    fireEvent.click(screen.getByRole("checkbox", { name: "Team 1" }));
    fireEvent.click(screen.getByRole("button", { name: "Volgende" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Selecteer precies 4 teams");
    fireEvent.click(screen.getByRole("checkbox", { name: "Team 1" }));
    fireEvent.click(screen.getByRole("button", { name: "Volgende" }));
    await screen.findByRole("heading", { name: "Regels" });
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