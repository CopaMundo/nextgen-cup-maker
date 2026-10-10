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