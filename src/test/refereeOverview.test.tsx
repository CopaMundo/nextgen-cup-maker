import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import RefereeOverview, { RefereeCardDetails } from "@/components/RefereeOverview";
import { AdminAppearanceContext } from "@/contexts/AdminAppearanceContext";

afterEach(cleanup);

const referees: RefereeCardDetails[] = [{
  name: "Alex Janssens", locations: ["Sporthal: Veld 1", "Stadion: Veld 2", "Bijveld: Veld 3"],
  availability: ["28/10/2026: 09:00–12:00", "29/10/2026: Hele dag"],
  role: "1-2", maxMatches: 8, excludedTeams: ["Team A", "Team B"],
}];

describe("Referee overview controls", () => {
  it("opens the correct referee edit and deletion flow and the add flow", () => {
    const onEdit = vi.fn(), onDelete = vi.fn(), onAdd = vi.fn();
    render(<RefereeOverview referees={referees} onEdit={onEdit} onDelete={onDelete} onAdd={onAdd} />);
    fireEvent.click(screen.getByRole("button", { name: "Alex Janssens bewerken" }));
    expect(onEdit).toHaveBeenCalledWith(0);
    fireEvent.click(screen.getByRole("button", { name: "Alex Janssens verwijderen" }));
    expect(onDelete).toHaveBeenCalledWith(0);
    screen.getAllByRole("button", { name: "Scheidsrechter toevoegen" }).forEach(b => fireEvent.click(b));
    expect(onAdd).toHaveBeenCalledTimes(2);
  });

  it("opens all selected locations in an admin-scoped detail popover", () => {
    render(<AdminAppearanceContext.Provider value={true}><RefereeOverview referees={referees} onEdit={vi.fn()} onDelete={vi.fn()} onAdd={vi.fn()} /></AdminAppearanceContext.Provider>);
    fireEvent.click(screen.getByRole("button", { name: "Locaties en velden: alle details" }));
    const details = screen.getByRole("dialog");
    expect(within(details).getByText("Stadion: Veld 2")).toBeVisible();
    expect(within(details).getByText("Bijveld: Veld 3")).toBeVisible();
    expect(details).toHaveClass("admin-ui");
  });

  it("opens availability and excluded team details", () => {
    render(<RefereeOverview referees={referees} onEdit={vi.fn()} onDelete={vi.fn()} onAdd={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Beschikbaarheid: alle details" }));
    expect(within(screen.getByRole("dialog")).getByText("29/10/2026: Hele dag")).toBeVisible();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    fireEvent.click(screen.getByRole("button", { name: "Uitgesloten teams van Alex Janssens" }));
    expect(within(screen.getByRole("dialog")).getByText("Team B")).toBeVisible();
  });

  it("uses a chevron for truncated rows and shows compact max/role values", () => {
    render(<RefereeOverview referees={referees} onEdit={vi.fn()} onDelete={vi.fn()} onAdd={vi.fn()} />);
    // Afkappingsknoppen tonen een pijltje omlaag, nooit "+ meer"-tekst of een teller.
    const moreButtons = screen.getAllByRole("button", { name: /: alle details$/ });
    expect(moreButtons.length).toBe(2);
    moreButtons.forEach(b => {
      expect(b.textContent).toBe("");
      expect(b.querySelector("svg")).not.toBeNull();
    });
    // Max. aantal wedstrijden zonder herhaalde rubriektekst.
    expect(screen.getByText("8 wedstrijden")).toBeVisible();
    expect(screen.queryByText(/Max\. aantal wedstrijden:/)).toBeNull();
    // Rol direct als waarde, zonder "Rol:" voorvoegsel.
    expect(screen.getByText("1-2")).toBeVisible();
    expect(screen.queryByText(/^Rol: /)).toBeNull();
  });

  it("labels the excluded section after the tournament participant kind", () => {
    render(<RefereeOverview participantsKind="players" referees={referees} onEdit={vi.fn()} onDelete={vi.fn()} onAdd={vi.fn()} />);
    expect(screen.getByText("Uitgesloten spelers")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Uitgesloten spelers van Alex Janssens" }));
    expect(within(screen.getByRole("dialog")).getByText("Team B")).toBeVisible();
  });

  it("shows 'Geen limiet' and 'Geen' for unset values", () => {
    render(<RefereeOverview referees={[{ name: "Bo Peeters", locations: ["Alle velden"], availability: ["Hele dag"], role: "Alle rollen", maxMatches: null, excludedTeams: [] }]} onEdit={vi.fn()} onDelete={vi.fn()} onAdd={vi.fn()} />);
    expect(screen.getByText("Geen limiet")).toBeVisible();
    expect(screen.getByText("Geen")).toBeVisible();
    expect(screen.getByText("Alle rollen")).toBeVisible();
  });

  it("separates card locations with a bullet and lists Geen locations last in the popover", () => {
    const mixed: RefereeCardDetails[] = [{
      name: "Alex Janssens",
      locations: ["Stadion: Veld 1", "Sporthal: Veld 2"],
      locationDetails: ["Stadion: Veld 1", "Sporthal: Veld 2", "Bijveld: Geen"],
      availability: ["Hele dag"], role: "Alle rollen", maxMatches: null, excludedTeams: [],
    }];
    render(<RefereeOverview referees={mixed} onEdit={vi.fn()} onDelete={vi.fn()} onAdd={vi.fn()} />);
    // Op het kaartje alleen actieve locaties, gescheiden door " • "; "Geen" staat er niet tussen.
    expect(screen.getByText("Stadion: Veld 1 • Sporthal: Veld 2")).toBeVisible();
    expect(screen.queryByText("Bijveld: Geen")).toBeNull();
    // In de pop-up wel alle locaties, actieve eerst in toernooivolgorde en "Geen" onderaan.
    fireEvent.click(screen.getByRole("button", { name: "Locaties en velden: alle details" }));
    const details = screen.getByRole("dialog");
    const items = within(details).getAllByText(/: Veld|: Geen/);
    expect(items.map(item => item.textContent)).toEqual(["Stadion: Veld 1", "Sporthal: Veld 2", "Bijveld: Geen"]);
  });

  it("separates availability dates with a bullet", () => {
    render(<RefereeOverview referees={[{ name: "Bo Peeters", locations: ["Alle velden"], availability: ["28/10: 09:00–12:00", "29/10: Hele dag"], role: "Alle rollen", maxMatches: null, excludedTeams: [] }]} onEdit={vi.fn()} onDelete={vi.fn()} onAdd={vi.fn()} />);
    expect(screen.getByText("28/10: 09:00–12:00 • 29/10: Hele dag")).toBeVisible();
  });
});
