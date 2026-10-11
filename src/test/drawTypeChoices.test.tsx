import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DrawScopeChoices, DrawTypeChoices, DrawTypeProgress } from "@/components/draw/DrawTypeChoices";

afterEach(cleanup);
describe("Type loting choices", () => {
  it.each(["group", "knockout", "single_match"] as const)("renders consistent choices for %s", format => {
    const onChange = vi.fn();
    render(<DrawTypeChoices format={format} value="random" onChange={onChange} />);
    expect(screen.getByRole("button", { name: "Willekeurige loting" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "Loting met potindeling" }));
    expect(onChange).toHaveBeenCalledWith("pots");
    expect(screen.queryByRole("button", { name: "Loting met reekshoofden" }) !== null).toBe(format === "knockout");
  });
  it("shows full draw selected and emits scope changes", () => {
    const onChange = vi.fn();
    render(<DrawScopeChoices value="full" onChange={onChange} roundsAvailable />);
    expect(screen.getByRole("button", { name: "Volledige loting" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Alleen de groepen worden live geloot; speelrondes worden automatisch gegenereerd.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Alleen speelrondes" }));
    expect(onChange).toHaveBeenCalledWith("rounds");
  });
  it("keeps rounds show limits without blocking group draws", () => {
    render(<DrawScopeChoices value="groups" onChange={vi.fn()} roundsAvailable={false} />);
    expect(screen.getByRole("button", { name: "Volledige loting" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Alleen groepsfase" })).toBeEnabled();
  });
  it("marks the current part in a two-part progress indicator", () => {
    const { rerender } = render(<DrawTypeProgress part="scope" />);
    expect(screen.getByText("1. Wat wil je loten?")).toHaveAttribute("aria-current", "step");
    rerender(<DrawTypeProgress part="method" />);
    expect(screen.getByText("2. Methode")).toHaveAttribute("aria-current", "step");
  });
});