import { describe, expect, it } from "vitest";
import { drawHeading, fitWallTitle } from "@/lib/drawHeading";

describe("draw heading", () => {
  it("uses the browser language independent of its region", () => {
    expect(drawHeading("nl-BE")).toBe("LIVE LOTING");
    expect(drawHeading("fr-FR")).toBe("TIRAGE EN DIRECT");
    expect(drawHeading("DE_de")).toBe("LIVE-AUSLOSUNG");
  });
  it("falls back to English for unsupported languages", () => {
    expect(drawHeading("ja-JP")).toBe("LIVE DRAW");
  });
});

describe("fitWallTitle", () => {
  it("keeps natural font size for a fitting one-line name", () => {
    expect(fitWallTitle(512, 80, 60, (size) => ({ width: size * 7, height: size, lines: 1 }))).toBeCloseTo(60);
  });
  it("fits two lines inside the available height", () => {
    expect(fitWallTitle(512, 80, 60, (size) => ({ width: size * 10, height: size * 2, lines: 2 }))).toBeCloseTo(40);
  });
  it("shrinks until a long name wraps to at most two lines", () => {
    expect(fitWallTitle(512, 100, 60, (size) => ({ width: 512, height: size * (size > 35 ? 3 : 2), lines: size > 35 ? 3 : 2 }))).toBeCloseTo(35);
  });
  it("bounds the width of an unbroken name too", () => {
    expect(fitWallTitle(512, 80, 60, (size) => ({ width: size * 20, height: size, lines: 1 }))).toBeCloseTo(25.6);
  });
  it("returns zero for unmeasured geometry", () => {
    expect(fitWallTitle(0, 80, 60, () => ({ width: 0, height: 0, lines: 0 }))).toBe(0);
    expect(fitWallTitle(512, 0, 60, () => ({ width: 0, height: 0, lines: 0 }))).toBe(0);
  });
});