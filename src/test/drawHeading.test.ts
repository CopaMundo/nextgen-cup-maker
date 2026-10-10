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
  const stage = 720;
  const board = 512;
  const em = 61.44; // 4.8cqw at a 1280px stage
  it("never distorts letters while fitting the board width", () => {
    const fitted = fitWallTitle(board, 1010, em, stage);
    expect(fitted.scale).toBeCloseTo(0.507, 2);
    expect(fitted.stretch).toBe(1);
    expect(fitted.scale * 1010).toBeCloseTo(board, 0);
  });
  it("caps the scale so the ink stays inside the vertical band for short names", () => {
    const fitted = fitWallTitle(board, 300, em, stage);
    const capHeight = em * 0.74 * fitted.scale * fitted.stretch;
    expect(capHeight).toBeLessThanOrEqual(stage * 0.102 + 0.01);
    expect(fitted.stretch).toBe(1);
  });
  it("returns neutral values for unmeasured geometry", () => {
    expect(fitWallTitle(0, 300, em, stage)).toEqual({ scale: 1, stretch: 1 });
    expect(fitWallTitle(board, 300, 0, stage)).toEqual({ scale: 1, stretch: 1 });
  });
});