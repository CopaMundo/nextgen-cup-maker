import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DrawShowOptions } from "@/components/draw/DrawShowOptions";
import { defaultShowOptions } from "@/lib/drawStudio";

afterEach(cleanup);
describe("Shared draw show settings", () => {
  it("shows normal speed, enabled flags, the projector link and Gold by default", () => {
    render(<DrawShowOptions phaseId="phase" options={defaultShowOptions} onChange={vi.fn()} />);
    expect(screen.getByText("Normaal")).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Landenvlag tonen achter teamnaam" })).toBeChecked();
    expect(screen.getByRole("button", { name: "COPA Gold" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText("Live loting link")).toHaveValue(`${window.location.origin}/draw/phase`);
    expect(screen.getByRole("button", { name: "Delen" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "QR-code" }));
    expect(screen.getByTitle("QR-code kijklink")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "QR-code" }));
    expect(screen.queryByTitle("QR-code kijklink")).not.toBeInTheDocument();
  });
});