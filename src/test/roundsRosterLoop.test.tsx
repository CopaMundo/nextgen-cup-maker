import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { RoundsRosterLoop } from "@/components/draw/RoundsRosterLoop";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function measureRoster(contentHeight: number, viewportHeight: number) {
  vi.stubGlobal("ResizeObserver", class {
    observe() {}
    disconnect() {}
  });
  vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(contentHeight);
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(viewportHeight);
  return render(<RoundsRosterLoop rosterKey="group-a"><div>Team A</div></RoundsRosterLoop>);
}

describe("Rounds roster overflow", () => {
  it("keeps a fitting roster stationary without a duplicate", () => {
    const { container } = measureRoster(300, 400);
    expect(container.firstElementChild).not.toHaveClass("is-looping");
    expect(container.querySelector('[aria-hidden="true"]')).toBeNull();
  });

  it("measures a seamless loop and discreet pages for reduced motion", () => {
    const { container } = measureRoster(1200, 400);
    const list = container.querySelector<HTMLElement>(".draw-show-rounds-roster-list");
    expect(list).toHaveClass("is-looping");
    expect(list?.style.getPropertyValue("--roster-distance")).toBe("1200px");
    expect(list?.style.getPropertyValue("--roster-pages")).toBe("3");
    expect(list?.style.getPropertyValue("--roster-page-duration")).toBe("24s");
    expect(container.querySelector('[aria-hidden="true"]')).not.toBeNull();
  });
});