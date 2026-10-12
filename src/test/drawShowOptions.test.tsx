import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DrawShowOptions } from "@/components/draw/DrawShowOptions";
import { defaultShowOptions } from "@/lib/drawStudio";

afterEach(cleanup);
describe("Shared draw show settings", () => {
  it("changes speed and flags with segmented choices", () => {
    const onChange = vi.fn();
    render(<DrawShowOptions phaseId="phase" options={defaultShowOptions} onChange={onChange} />);
    expect(screen.getByRole("button", { name: "Normaal" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "Langzaam" }));
    expect(onChange).toHaveBeenCalledWith({ ...defaultShowOptions, speed: .75 });
    fireEvent.click(screen.getByRole("button", { name: "Uit" }));
    expect(onChange).toHaveBeenCalledWith({ ...defaultShowOptions, flagBackdrops: false });
    expect(screen.getByText("LIVE LOTING LINK").closest(".draw-panel")).toBeNull();
  });
  it("shows normal speed, enabled flags, the projector link and Gold by default", () => {
    render(<DrawShowOptions phaseId="phase" options={defaultShowOptions} onChange={vi.fn()} />);
    expect(screen.getByText("Normaal")).toBeInTheDocument();
    expect(within(screen.getByRole("group", { name: "Landenvlag tonen achter teamnaam" })).getByRole("button", { name: "Aan" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "COPA Gold" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText("LIVE LOTING LINK")).toHaveValue(`${window.location.origin}/draw/phase`);
    expect(screen.getByRole("button", { name: "Delen" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "QR-code" }));
    expect(screen.getByTitle("QR-code kijklink")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "QR-code" }));
    expect(screen.queryByTitle("QR-code kijklink")).not.toBeInTheDocument();
  });
});