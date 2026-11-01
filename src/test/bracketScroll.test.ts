import { afterEach, describe, expect, it, vi } from "vitest";
import { alignBracketTop } from "@/lib/bracketScroll";

afterEach(() => { document.body.innerHTML = ""; vi.restoreAllMocks(); });
describe("vertical bracket round alignment", () => {
  it("returns a lowered dialog viewport to the new round without changing either horizontal position", () => {
    const parent = document.createElement("div");
    const tree = document.createElement("div");
    const sibling = document.createElement("div");
    parent.style.overflowY = "auto";
    parent.append(tree, sibling);
    document.body.append(parent);
    Object.defineProperties(parent, { scrollHeight: { value: 1000 }, clientHeight: { value: 400 } });
    vi.spyOn(parent, "getBoundingClientRect").mockReturnValue({ top: 100 } as DOMRect);
    vi.spyOn(tree, "getBoundingClientRect").mockReturnValue({ top: -100 } as DOMRect);
    parent.scrollTop = 300;
    tree.scrollLeft = 304;
    sibling.scrollLeft = 0;
    vi.spyOn(window, "scrollBy").mockImplementation(() => {});
    alignBracketTop(tree);
    expect(parent.scrollTop).toBe(92);
    expect(tree.scrollLeft).toBe(304);
    expect(sibling.scrollLeft).toBe(0);
  });
  it("aligns a round above the page viewport but leaves already visible rounds alone", () => {
    const tree = document.createElement("div");
    document.body.append(tree);
    const rect = vi.spyOn(tree, "getBoundingClientRect");
    const scroll = vi.spyOn(window, "scrollBy").mockImplementation(() => {});
    rect.mockReturnValue({ top: -200 } as DOMRect);
    alignBracketTop(tree);
    expect(scroll).toHaveBeenCalledWith({ top: -216, behavior: "instant" });
    scroll.mockClear();
    rect.mockReturnValue({ top: 100 } as DOMRect);
    alignBracketTop(tree);
    expect(scroll).not.toHaveBeenCalled();
  });
});