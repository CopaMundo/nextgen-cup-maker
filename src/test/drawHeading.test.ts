import { describe, expect, it } from "vitest";
import { balanceWallTitle, drawHeading, fitWallTitle } from "@/lib/drawHeading";

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

describe("balanceWallTitle", () => {
  it("leaves short names on one line", () => {
    expect(balanceWallTitle("COPA MUNDO", 20, (text) => text.length)).toBe("COPA MUNDO");
  });
  it("balances a long name at a word boundary", () => {
    expect(balanceWallTitle("INTERNATIONALE COPA MUNDO CHAMPIONS CUP", 20, (text) => text.length)).toBe("INTERNATIONALE COPA\nMUNDO CHAMPIONS CUP");
  });
  it("shrinks medium names on one line before considering a split", () => {
    expect(balanceWallTitle("SOCCERTEC MASTERS", 12, (text) => text.length)).toBe("SOCCERTEC MASTERS");
  });
  it("chooses a wider lower line even when the reverse split is more balanced", () => {
    const title = balanceWallTitle("AAAAAA BBBB CCCCC DDDD", 10, (text) => text.length);
    const [upper, lower] = title.split("\n");
    expect(lower.length).toBeGreaterThanOrEqual(upper.length);
    expect(title).toBe("AAAAAA BBBB\nCCCCC DDDD".replace("AAAAAA BBBB\nCCCCC DDDD", "AAAAAA\nBBBB CCCCC DDDD"));
  });
  it("keeps an unbroken name intact for browser wrapping", () => {
    expect(balanceWallTitle("CHAMPIONSHIP", 5, (text) => text.length)).toBe("CHAMPIONSHIP");
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