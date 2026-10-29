import { describe, expect, it } from "vitest";
import { formatRefereeRoleLine } from "@/lib/refereeConfig";

// Rolweergave op het kaartje: gekozen rollen op volgorde, nooit bereik-compressie zoals "1,3-5".
describe("formatRefereeRoleLine", () => {
  it("toont gekozen rollen los op volgorde, zonder bereiken", () => {
    expect(formatRefereeRoleLine([1, 2, 4, 5])).toBe("1, 2, 4, 5");
    expect(formatRefereeRoleLine([4, 1, 5, 2])).toBe("1, 2, 4, 5");
    expect(formatRefereeRoleLine([2])).toBe("2");
  });

  it("toont Alle rollen bij geen of alle rollen", () => {
    expect(formatRefereeRoleLine(null)).toBe("Alle rollen");
    expect(formatRefereeRoleLine([])).toBe("Alle rollen");
    expect(formatRefereeRoleLine([1, 2, 3, 4, 5])).toBe("Alle rollen");
  });
});
