import { describe, expect, it } from "vitest";
import { buildFieldsByLocation } from "@/lib/refereeConfig";

describe("buildFieldsByLocation", () => {
  const entries = [
    { name: "Veld 1", location: "Sporthal" },
    { name: "Veld 2", location: "Stadion" },
    { name: "Los veld", location: null },
    { name: "Sporthal · Veld 3", location: "Sporthal" },
    { name: "Zwerfveld", location: "Bestaat niet" },
  ];

  it("koppelt elk veld strikt aan zijn eigen locatie in toernooivolgorde", () => {
    const map = buildFieldsByLocation(entries, ["Sporthal", "Stadion"]);
    // Velden zonder eigen locatie vallen onder de eerste locatie, in toernooivolgorde.
    expect(map["Sporthal"]).toEqual(["Veld 1", "Los veld", "Sporthal · Veld 3", "Zwerfveld"]);
    expect(map["Stadion"]).toEqual(["Veld 2"]);
  });

  it("laat velden zonder geldige locatie onder de eerste locatie vallen", () => {
    const map = buildFieldsByLocation(entries, ["Sporthal", "Stadion"]);
    // "Los veld" en "Zwerfveld" (onbekende locatie) horen bij de eerste locatie, niet verspreid.
    expect(map["Sporthal"]).toContain("Los veld");
    expect(map["Sporthal"]).toContain("Zwerfveld");
    expect(map["Stadion"]).not.toContain("Los veld");
    expect(map["Stadion"]).not.toContain("Zwerfveld");
  });

  it("geeft lege lijsten terug voor locaties zonder velden", () => {
    const map = buildFieldsByLocation([{ name: "Veld 1", location: "Sporthal" }], ["Sporthal", "Stadion"]);
    expect(map["Stadion"]).toEqual([]);
  });

  it("koppelt niets als er geen locaties zijn", () => {
    const map = buildFieldsByLocation(entries, []);
    expect(map).toEqual({});
  });
});
