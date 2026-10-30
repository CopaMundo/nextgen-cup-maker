import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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
    const fairplay = screen.getByText("Fairplayklassement");
    const strafpunten = screen.getByText("Strafpunten per kaart.", { exact: false });

    expect(kaarten.compareDocumentPosition(fairplay) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(fairplay.compareDocumentPosition(strafpunten) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("toont aparte blokken: Doelpuntenmakers en Assists naast elkaar, Kaarten op volle breedte", async () => {
    render(
      <TournamentGeneral
        tournament={{ ...TOURNAMENT, enable_fairplay: true } as any}
        onUpdate={vi.fn()}
        generalSubTab="puntentelling"
        onGeneralSubTabChange={vi.fn()}
      />,
    );

    const doelpuntenmakers = await screen.findByText("Doelpuntenmakers");
    const assists = screen.getByText("Assists");
    const kaarten = screen.getByText("Kaarten");

    const blockDm = doelpuntenmakers.closest("div.rounded-lg");
    const blockAs = assists.closest("div.rounded-lg");
    const blockKa = kaarten.closest("div.rounded-lg");

    // Elk statuut in zijn eigen blok; Kaarten zit in een apart, breder blok.
    expect(blockDm).not.toBeNull();
    expect(blockAs).not.toBeNull();
    expect(blockKa).not.toBeNull();
    expect(blockDm).not.toBe(blockKa);
    expect(blockAs).not.toBe(blockKa);

    // Doelpuntenmakers- en Assists-blok delen dezelfde tweecolumns-grid-ouder.
    expect(blockDm?.parentElement).toBe(blockAs?.parentElement);
    expect(blockDm?.parentElement?.className).toContain("sm:grid-cols-2");

    // Kaarten-blok staat buiten die grid-ouder op volle breedte.
    expect(blockKa?.parentElement).not.toBe(blockDm?.parentElement);
    expect(blockKa?.className).not.toContain("sm:grid-cols-2");
  });

  it("houdt fairplay uit en onbeschikbaar zolang kaarten uit staan", async () => {
    const onUpdate = vi.fn();
    render(<TournamentGeneral tournament={{ ...TOURNAMENT, enable_yellow_cards: false, enable_red_cards: false } as any} onUpdate={onUpdate} generalSubTab="puntentelling" onGeneralSubTabChange={vi.fn()} />);
    const fairplay = screen.getByRole("switch", { name: "Fairplayklassement" });
    expect(fairplay).toBeDisabled();
    expect(fairplay).not.toBeChecked();
    fireEvent.click(fairplay);
    expect(onUpdate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("switch", { name: "Kaarten" }));
    expect(fairplay).toBeEnabled();
    fireEvent.click(fairplay);
    await waitFor(() => expect(onUpdate).toHaveBeenLastCalledWith(expect.objectContaining({ enable_yellow_cards: true, enable_red_cards: true, enable_fairplay: true })));
  });

  it("schakelt fairplay mee uit als kaarten worden uitgezet", async () => {
    const onUpdate = vi.fn();
    render(<TournamentGeneral tournament={{ ...TOURNAMENT, enable_fairplay: true } as any} onUpdate={onUpdate} generalSubTab="puntentelling" onGeneralSubTabChange={vi.fn()} />);
    fireEvent.click(screen.getByRole("switch", { name: "Kaarten" }));
    expect(screen.getByRole("switch", { name: "Fairplayklassement" })).toBeDisabled();
    expect(screen.getByRole("switch", { name: "Fairplayklassement" })).not.toBeChecked();
    await waitFor(() => expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({ enable_yellow_cards: false, enable_red_cards: false, enable_fairplay: false })));
  });

  it("bewaart de drie strafpunten en de overige fairplaypunten", async () => {
    const onUpdate = vi.fn();
    render(<TournamentGeneral tournament={{ ...TOURNAMENT, enable_fairplay: true, fairplay_config: { yellow: 1, second_yellow: 3, red: 5, clean_match: 2, start: 100 } } as any} onUpdate={onUpdate} generalSubTab="puntentelling" onGeneralSubTabChange={vi.fn()} />);
    const yellow = screen.getByRole("spinbutton", { name: "Gele kaart" });
    fireEvent.change(yellow, { target: { value: "4" } });
    fireEvent.blur(yellow);
    await waitFor(() => expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({ fairplay_config: { yellow: 4, second_yellow: 3, red: 5, clean_match: 2, start: 100 } })));
  });
});
