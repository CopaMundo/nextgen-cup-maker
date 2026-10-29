import { describe, it, expect } from "vitest";
import { parseReferee, refereeCanOfficiate, refereeViolations } from "@/lib/refereeConfig";

const ref = parseReferee({ name: "Jan", availability: [{ date: "2026-11-01", from: "00:00", to: "23:59", location: "Sporthal" }] });
const base = { match_date: "2026-11-01", match_time: "10:00", field: "Veld 1", home_team_id: null, away_team_id: null };

describe("per-dag locatie van scheidsrechters", () => {
  it("bewaart de locatie bij het inlezen", () => {
    expect(ref.availability?.[0].location).toBe("Sporthal");
  });
  it("mag enkel op die locatie fluiten", () => {
    expect(refereeCanOfficiate(ref, { ...base, location: "Sporthal" })).toBe(true);
    expect(refereeCanOfficiate(ref, { ...base, location: "Buitenveld" })).toBe(false);
  });
  it("meldt een overtreding op een andere locatie", () => {
    expect(refereeViolations(ref, { ...base, location: "Buitenveld" })).toHaveLength(1);
    expect(refereeViolations(ref, { ...base, location: "Sporthal" })).toHaveLength(0);
  });
});

describe("meerdere tijdvakken per dag", () => {
  const multi = parseReferee({ name: "An", availability: [
    { date: "2026-11-01", from: "09:00", to: "12:00", location: "Sporthal" },
    { date: "2026-11-01", from: "14:00", to: "18:00", location: "Buitenveld" },
  ] });
  const m = (time: string, location: string) => ({ match_date: "2026-11-01", match_time: time, field: "Veld 1", home_team_id: null, away_team_id: null, location });
  it("volgt per tijdvak de eigen locatie", () => {
    expect(refereeCanOfficiate(multi, m("10:00", "Sporthal"))).toBe(true);
    expect(refereeCanOfficiate(multi, m("10:00", "Buitenveld"))).toBe(false);
    expect(refereeCanOfficiate(multi, m("15:00", "Buitenveld"))).toBe(true);
    expect(refereeCanOfficiate(multi, m("13:00", "Sporthal"))).toBe(false);
  });
  it("meldt locatie- en tijdovertredingen", () => {
    expect(refereeViolations(multi, m("15:00", "Sporthal"))[0]).toContain("Buitenveld");
    expect(refereeViolations(multi, m("13:00", "Sporthal"))[0]).toContain("Buiten beschikbaarheid");
  });
});
