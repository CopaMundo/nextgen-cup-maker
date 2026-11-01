import { expect, it } from "vitest";
import { formatIsoDateForLocale } from "@/lib/dateUtils";

it("includes the full year in tournament matchday labels even with custom date options", () => {
  expect(formatIsoDateForLocale("2026-11-01", "nl-BE", {
    weekday: "long", day: "numeric", month: "long",
  })).toBe("zondag 1 november 2026");
  expect(formatIsoDateForLocale("2027-01-01", "nl-BE", {
    day: "numeric", month: "short", year: "2-digit",
  })).toContain("2027");
});

it("keeps numeric tournament dates in dd/mm/yyyy format", () => {
  expect(formatIsoDateForLocale("2026-11-01")).toBe("01/11/2026");
});