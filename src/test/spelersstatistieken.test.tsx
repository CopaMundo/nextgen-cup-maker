import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import TournamentGeneral from "@/components/TournamentGeneral";

vi.mock("@/integrations/supabase/client", () => {
  const query = (result: any) => {
    const q: any = { then: (res: any) => Promise.resolve(result).then(res) };
    const chain: any = new Proxy(q, { get: (t, p) => (p in t ? (t as any)[p] : () => chain) });
    return chain;
  };
  return { supabase: { from: () => query({ data: [], count: 0, error: null }), storage: { from: () => query({ data: [], error: null }) } } };
});
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => false }));

const TOURNAMENT = {
  id: "t-1",
  name: "Beker",
  enable_goalscorers: true,
  enable_assists: false,
  enable_yellow_cards: true,
  enable_red_cards: true,
  enable_fairplay: false,
};

afterEach(() => cleanup());

describe("Spelersstatistieken", () => {
  it("toont de drie heldere opties Doelpuntenmakers, Assists en Kaarten", async () => {
    render(
      <TournamentGeneral
        tournament={TOURNAMENT as any}
        onUpdate={vi.fn()}
        generalSubTab="puntentelling"
        onGeneralSubTabChange={vi.fn()}
      />,
    );

    expect(await screen.findByText("Doelpuntenmakers")).toBeInTheDocument();
    expect(screen.getByText("Assists")).toBeInTheDocument();
    expect(screen.getByText("Kaarten")).toBeInTheDocument();
    expect(screen.queryByText("Topscorers bijhouden")).not.toBeInTheDocument();
    expect(screen.queryByText("Assists bijhouden")).not.toBeInTheDocument();
    expect(screen.queryByText("Gele en rode kaarten bijhouden")).not.toBeInTheDocument();

    // Originele toelichting onder de hoofdtitel, zonder extra i-knopjes
    expect(screen.getByText(/Als je spelers aan je teams hebt toegevoegd/)).toBeInTheDocument();
    expect(screen.queryByLabelText("Uitleg: Doelpuntenmakers")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Uitleg: Assists")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Uitleg: Kaarten")).not.toBeInTheDocument();

    // Doelpuntenmakers en Assists naast elkaar op één lijn
    const doelpuntenmakers = screen.getByText("Doelpuntenmakers");
    const assists = screen.getByText("Assists");
    const rij = doelpuntenmakers.closest("div.grid");
    expect(rij?.className).toContain("sm:grid-cols-2");
    expect(rij).toBe(assists.closest("div.grid"));
  });

  it("sluit het fair-playklassement direct aan bij Kaarten met strafpunten", async () => {
    render(
      <TournamentGeneral
        tournament={{ ...TOURNAMENT, enable_fairplay: true } as any}
        onUpdate={vi.fn()}
        generalSubTab="puntentelling"
        onGeneralSubTabChange={vi.fn()}
      />,
    );

    const kaarten = await screen.findByText("Kaarten");
    const fairplay = screen.getByText("Fair-playklassement activeren");
    const strafpunten = screen.getByText("Strafpunten per kaart.", { exact: false });

    expect(kaarten.compareDocumentPosition(fairplay) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(fairplay.compareDocumentPosition(strafpunten) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
