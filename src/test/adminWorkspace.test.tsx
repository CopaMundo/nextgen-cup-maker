import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { AdminPageActions, AdminPageActionsContext } from "@/components/admin/AdminPageActions";
import { DesktopAdminHeader } from "@/components/admin/DesktopAdminHeader";

const toggleMode = vi.fn();
vi.mock("@/contexts/ThemeContext", () => ({ useTheme: () => ({ mode: "dark", toggleMode }) }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ signOut: vi.fn() }) }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("Desktop management workspace", () => {
  it("portals feature controls without replacing their handler", () => {
    const target = document.createElement("div");
    document.body.appendChild(target);
    const action = vi.fn();
    render(<AdminPageActionsContext.Provider value={target}><AdminPageActions><button onClick={action}>Wedstrijdduur</button></AdminPageActions></AdminPageActionsContext.Provider>);
    expect(target).toContainElement(screen.getByText("Wedstrijdduur"));
    fireEvent.click(screen.getByText("Wedstrijdduur"));
    expect(action).toHaveBeenCalledOnce();
    target.remove();
  });
  it("leaves phone controls inline", () => {
    const { container } = render(<AdminPageActions><button>Planning</button></AdminPageActions>);
    expect(container).toContainElement(screen.getByText("Planning"));
  });
  it("combines title, selectors, navigation and theme controls", () => {
    render(<MemoryRouter><DesktopAdminHeader title="Schema" tournamentName="Copa Test" navigation={<span>12/10/2026</span>} selectors={<span>U12</span>} actions={<button>Fase toevoegen</button>} actionsRef={() => {}} /></MemoryRouter>);
    expect(screen.getByRole("heading", { level: 1, name: "Schema" })).toBeInTheDocument();
    expect(screen.getByText("U12")).toBeInTheDocument();
    expect(screen.getByText("12/10/2026")).toBeInTheDocument();
    expect(screen.getAllByText("Copa Test")).toHaveLength(1);
    expect(screen.getByTitle("Mijn toernooien")).toHaveAttribute("href", "/dashboard");
    fireEvent.click(screen.getByRole("button", { name: "Lichte weergave" }));
    expect(toggleMode).toHaveBeenCalledOnce();
  });
  it("renders primary navigation separately from page tools", () => {
    render(<MemoryRouter><DesktopAdminHeader title="Algemeen" tournamentName="Copa Test" primaryNavigation={<nav aria-label="Toernooibeheer"><button>Deelnemers</button></nav>} navigation={null} selectors={null} actions={<button>Toevoegen</button>} actionsRef={() => {}} /></MemoryRouter>);
    expect(screen.getByRole("navigation", { name: "Toernooibeheer" })).toContainElement(screen.getByText("Deelnemers"));
    expect(screen.getByText("Toevoegen").closest(".admin-workspace-heading")).not.toBeNull();
  });
});