import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import RefereeOverview, { RefereeCardDetails } from "@/components/RefereeOverview";
import { AdminAppearanceContext } from "@/contexts/AdminAppearanceContext";

afterEach(cleanup);

const referees: RefereeCardDetails[] = [{
  name: "Alex Janssens", locations: ["Sporthal: Veld 1", "Stadion: Veld 2", "Bijveld: Veld 3"],
  availability: ["28/10/2026: 09:00–12:00", "29/10/2026: Hele dag"],
  role: "1e, 2e", maxMatches: 8, excludedTeams: ["Team A", "Team B"],
}];

describe("Referee overview controls", () => {
  it("opens the correct referee edit and deletion flow and the add flow", () => {
    const onEdit = vi.fn(), onDelete = vi.fn(), onAdd = vi.fn();
    render(<RefereeOverview referees={referees} onEdit={onEdit} onDelete={onDelete} onAdd={onAdd} />);
    fireEvent.click(screen.getByRole("button", { name: "Alex Janssens bewerken" }));
    expect(onEdit).toHaveBeenCalledWith(0);
    fireEvent.click(screen.getByRole("button", { name: "Alex Janssens verwijderen" }));
    expect(onDelete).toHaveBeenCalledWith(0);
    fireEvent.click(screen.getByRole("button", { name: "Scheidsrechter toevoegen" }));
    expect(onAdd).toHaveBeenCalledOnce();
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
});