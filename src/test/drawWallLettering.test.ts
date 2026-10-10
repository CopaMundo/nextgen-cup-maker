import { describe, expect, it } from "vitest";
import { wallLetterGeometry } from "@/lib/drawWallLettering";

describe("mounted studio lettering", () => {
  it.each(["SOCCERTEC MASTERS", "ÉLITE CUP – KÖLN", "Een bijzonder lange internationale toernooinaam voor alle deelnemers", ""])('centers and bounds %s with physical bevel depth', text => {
    const geometry = wallLetterGeometry(text, 1.02, 12.1);
    const box = geometry.boundingBox;
    expect(box).not.toBeNull();
    if (!box) return;
    expect(box.max.x - box.min.x).toBeLessThanOrEqual(12.101);
    expect(box.max.y - box.min.y).toBeLessThanOrEqual(1.021);
    expect(box.min.x + box.max.x).toBeCloseTo(0, 4);
    expect(box.min.y + box.max.y).toBeCloseTo(0, 4);
    expect(box.max.z - box.min.z).toBeGreaterThan(.08);
    expect(Array.from(geometry.getAttribute("position").array).every(Number.isFinite)).toBe(true);
    geometry.dispose();
  });
  it("keeps spaced translated captions within their dedicated band", () => {
    const geometry = wallLetterGeometry("TIRAGE EN DIRECT", .24, 9, .16);
    expect((geometry.boundingBox?.max.x ?? 0) - (geometry.boundingBox?.min.x ?? 0)).toBeLessThanOrEqual(9.001);
    geometry.dispose();
  });
  it("bounds the larger architectural title with a heavier milled edge", () => {
    const geometry = wallLetterGeometry("SOCCERTEC MASTERS", 1.28, 12.8, 0, .026);
    const box = geometry.boundingBox;
    if (!box) throw new Error("Missing title bounds");
    expect(box.max.x - box.min.x).toBeLessThanOrEqual(12.801);
    expect(box.max.y - box.min.y).toBeLessThanOrEqual(1.281);
    expect(box.max.y - box.min.y).toBeGreaterThan(1.02);
    expect(box.min.x + box.max.x).toBeCloseTo(0, 4);
    expect(Array.from(geometry.getAttribute("position").array).every(Number.isFinite)).toBe(true);
    geometry.dispose();
  });
});