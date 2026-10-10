import { describe, expect, it } from "vitest";
import { consoleBand, consoleContour } from "@/lib/drawConsoleGeometry";

describe("curved studio bar", () => {
  it("bows gently with symmetric raised ends and no oversized wings", () => {
    expect(consoleContour(0).z).toBeGreaterThan(consoleContour(5.2).z);
    expect(consoleContour(6.5).z).toBeLessThan(consoleContour(5.2).z);
    expect(consoleContour(-6.5)).toEqual(consoleContour(6.5));
    expect(consoleContour(6.5).inset).toBe(0);
    expect(consoleContour(6.5).rise).toBeCloseTo(.4);
  });
  it("builds finite closed bands with continuous texture coordinates", () => {
    const geometry = consoleBand(1.13, .77, .45);
    const positions = geometry.getAttribute("position");
    expect(Array.from(positions.array).every(Number.isFinite)).toBe(true);
    expect(geometry.getAttribute("uv").getX(0)).toBe(0);
    expect(geometry.getAttribute("uv").getX(positions.count - 1)).toBe(1);
    expect(geometry.index?.count).toBeGreaterThan(0);
    geometry.dispose();
  });
});