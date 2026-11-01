import { render, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import AdaptiveBracketViewport from "@/components/AdaptiveBracketViewport";
import { bracketLerp } from "@/lib/adaptiveBracketLayout";
afterEach(() => vi.unstubAllGlobals());

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
});
