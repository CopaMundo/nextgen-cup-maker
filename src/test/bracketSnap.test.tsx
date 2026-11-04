import { render, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import AdaptiveBracketViewport from "@/components/AdaptiveBracketViewport";
import { bracketLerp } from "@/lib/adaptiveBracketLayout";
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

const setup = () => {
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
  const view = render(<AdaptiveBracketViewport roundCount={4} columnWidth={304}>{({ activeRound }) => <output>{activeRound}</output>}</AdaptiveBracketViewport>);
  return { view, rail: view.getByLabelText("Bracketrondes") };
};

describe("bracket geometry follows the horizontal scroll", () => {
  it("halfway between round 2 and 3 the base is round 2 at fraction 0.5", () => {
    const { view, rail } = setup();
    rail.scrollLeft = 456;
    fireEvent.scroll(rail);
    expect(view.getByRole("status").textContent).toBe("1");
    expect(rail.style.getPropertyValue("--bf")).toBe("0.5000");
  });
  it("at the last round the geometry fully reaches that round", () => {
    const { view, rail } = setup();
    rail.scrollLeft = 912;
    fireEvent.scroll(rail);
    expect(view.getByRole("status").textContent).toBe("2");
    expect(rail.style.getPropertyValue("--bf")).toBe("1.0000");
  });
  it("interpolates a position between both rounds", () => {
    expect(bracketLerp(100, 40)).toBe("calc(100px + -60px * var(--bf, 0))");
    expect(bracketLerp(10, 10)).toBe("10px");
  });
  it("does not shorten the viewport below a still-visible outgoing match", () => {
    Object.defineProperty(document.documentElement, "scrollBy", { configurable: true, value: vi.fn() });
    const { rail } = setup();
    vi.spyOn(rail, "getBoundingClientRect").mockReturnValue({ left: 0, right: 304, top: 0 } as DOMRect);
    const card = document.createElement("div");
    card.dataset.bracketRound = "0";
    rail.append(card);
    vi.spyOn(card, "getBoundingClientRect").mockReturnValue({ left: -100, right: 180, top: 5500, bottom: 5580, height: 80 } as DOMRect);
    rail.scrollLeft = 100;
    fireEvent.scroll(rail);
    expect(rail.style.height).toBe("5600px");
    card.getBoundingClientRect = () => ({ left: -304, right: -24, top: 5500, bottom: 5580, height: 80 } as DOMRect);
    const successor = document.createElement("div");
    successor.dataset.bracketRound = "1";
    rail.append(successor);
    vi.spyOn(successor, "getBoundingClientRect").mockReturnValue({ left: 0, right: 280, top: 2700, bottom: 2780, height: 80 } as DOMRect);
    rail.scrollLeft = 304;
    fireEvent.scroll(rail);
    expect(rail.style.height).toBe("2800px");
  });
  it("shows no floating round dots above a snapping admin bracket", () => {
    const { view } = setup();
    expect(view.queryByLabelText("Ronde 1 van 4")).toBeNull();
  });
});
