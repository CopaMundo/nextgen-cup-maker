import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import LiveDrawDialog from "@/components/LiveDrawDialog";
import RoundsDrawDialog from "@/components/RoundsDrawDialog";

const fixtures = vi.hoisted(() => ({ excess: false }));
vi.mock("@/hooks/useDrawTournamentName", () => ({ useDrawTournamentName: () => "Copa Mundo" }));
vi.mock("@/hooks/useDrawTournamentLogo", () => ({ useDrawTournamentLogo: () => null }));
vi.mock("@/hooks/useDrawShowOptions", () => ({ useDrawShowOptions: () => [{ theme: "copa-gold", speed: 1, flagBackdrops: true }, vi.fn()] }));
vi.mock("@/components/draw/DrawShow", () => ({ DrawShow: () => <div>Studio</div> }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: (table: string) => {
  const data = table === "groups" ? [{ id: "g1", name: "Groep A" }]
    : table === "teams" ? Array.from({ length: fixtures.excess ? 5 : 4 }, (_, i) => ({ id: `t${i}`, name: `Team ${i}`, country: null }))
    : table === "slots" ? Array.from({ length: 4 }, (_, i) => ({ id: `s${i}`, group_id: "g1", team_id: null, slot_code: `S${i}`, sort_order: i })) : [];
  const query: Record<string, unknown> = {};
  for (const method of ["select", "eq", "order", "range", "insert", "upsert", "update", "delete", "in"]) query[method] = () => query;
  query.then = (resolve: (value: unknown) => unknown) => Promise.resolve({ data, error: null }).then(resolve);
  return query;
} } }));

beforeEach(() => { localStorage.clear(); fixtures.excess = false; });
afterEach(cleanup);
const props = { open: true, onOpenChange: vi.fn(), tournamentId: "tournament", phaseId: "phase" };

describe("Uniform draw preparation", () => {
  it("keeps all four group steps visible and preserves selection when going back", async () => {
    render(<LiveDrawDialog {...props} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Volgende" })).toBeEnabled());
    expect(within(screen.getByRole("list", { name: "Lotingsstappen" })).getAllByRole("listitem")).toHaveLength(4);
    expect(screen.getByRole("heading", { name: "Live loting Copa Mundo · Groepsfase" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Opnieuw beginnen" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Willekeurig/ }));
    fireEvent.click(screen.getByRole("button", { name: "Volgende" }));
    await screen.findByRole("heading", { name: "Indeling & teams" });
    expect(screen.getAllByRole("combobox")).toHaveLength(4);
    fireEvent.click(screen.getByRole("button", { name: "Volgende" }));
    await screen.findByRole("heading", { name: "Regels" });
    fireEvent.click(screen.getByRole("button", { name: "Vorige" }));
    expect(screen.getByText("Deelnemers · 4/4")).toBeInTheDocument();
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
    expect(screen.getByRole("combobox", { name: "Teamvak 1" })).toBeEnabled();
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