import { afterEach, describe, expect, it, vi } from "vitest";
import { alignBracketTop, bracketSuccessorIndex } from "@/lib/bracketScroll";

afterEach(() => { document.body.innerHTML = ""; vi.restoreAllMocks(); });
describe("vertical bracket round alignment", () => {
  it("follows match 20 into match 10, then match 5, instead of resetting to the first match", () => {
    expect(bracketSuccessorIndex(19, 0, 1, [32, 16, 8, 4, 2, 1])).toBe(9);
    expect(bracketSuccessorIndex(19, 0, 2, [32, 16, 8, 4, 2, 1])).toBe(4);
  });
  it("keeps the same encounter in equal-size rounds and selects its feeder when going back", () => {
    expect(bracketSuccessorIndex(19, 0, 1, [32, 32, 16])).toBe(19);
    expect(bracketSuccessorIndex(9, 1, 0, [32, 16])).toBe(18);
  });
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