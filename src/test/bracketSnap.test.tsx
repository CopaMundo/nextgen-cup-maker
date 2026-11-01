import { render, fireEvent, act } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import AdaptiveBracketViewport from "@/components/AdaptiveBracketViewport";
afterEach(() => vi.unstubAllGlobals());

describe("settled bracket round selection", () => {
  it("protects the viewed area when a lowered tree converges, without changing vertical or sibling horizontal scroll", () => {
    vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
    const view = render(<AdaptiveBracketViewport roundCount={4} columnWidth={304}>{({ activeRound }) => <output>{activeRound}</output>}</AdaptiveBracketViewport>);
    const rail = view.getByLabelText("Bracketrondes");
    vi.spyOn(rail, "getBoundingClientRect").mockReturnValue({ top: -400 } as DOMRect);
    rail.scrollLeft = 912;
    act(() => rail.dispatchEvent(new Event("scrollend")));
    expect(rail.style.minHeight).toBe("");
    expect(rail.scrollTop).toBe(0);
    expect(view.getByRole("status").textContent).toBe("0");
    view.unmount();
  });
  it("keeps geometry unchanged during scrolling and selects the second round only at scrollend", () => {
    vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
    const view = render(<AdaptiveBracketViewport roundCount={4} columnWidth={304}>{({ activeRound }) => <output>{activeRound}</output>}</AdaptiveBracketViewport>);
    const rail = view.getByLabelText("Bracketrondes");
    rail.scrollLeft = 304;
    fireEvent.scroll(rail);
    expect(view.getByRole("status").textContent).toBe("0");
    act(() => rail.dispatchEvent(new Event("scrollend")));
    expect(view.getByRole("status").textContent).toBe("1");
  });
});