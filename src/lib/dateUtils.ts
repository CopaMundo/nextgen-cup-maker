export const getTodayIsoDate = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const parseIsoDate = (dateStr: string | null | undefined): Date | null => {
  if (!dateStr) return null;

  const iso = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!iso) return null;

  const year = Number(iso[1]);
  const month = Number(iso[2]);
  const day = Number(iso[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const result = new Date(Date.UTC(year, month - 1, day));
  if (
    result.getUTCFullYear() !== year ||
    result.getUTCMonth() !== month - 1 ||
    result.getUTCDate() !== day
  ) {
    return null;
  }

  return result;
};

export const formatIsoDate = (date: Date) => {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const listIsoDatesInRange = (startDate: string, endDate: string) => {
  const start = parseIsoDate(startDate);
  const end = parseIsoDate(endDate);
  if (!start || !end || start.getTime() > end.getTime()) return [];

  const dates: string[] = [];
  const current = new Date(start.getTime());

  while (current.getTime() <= end.getTime()) {
    dates.push(formatIsoDate(current));
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return dates;
};

export const normalizeIsoDates = (dates: Array<string | null | undefined>) => {
  return Array.from(
    new Set(
      dates.filter((date): date is string => Boolean(parseIsoDate(date)))
    )
  ).sort((a, b) => a.localeCompare(b));
};

export const formatIsoDateForLocale = (dateStr: string, locale = "nl-BE", options?: Intl.DateTimeFormatOptions) => {
  const parsed = parseIsoDate(dateStr);
  if (!parsed) return dateStr;

  return new Intl.DateTimeFormat(locale, options).format(parsed);
};

export type MatchDayEntry = string | { start: string; end: string };

/**
 * Expand a mixed match_days array (strings + period objects) into individual ISO date strings.
 */
export const expandMatchDays = (entries: MatchDayEntry[]): string[] => {
  const allDates: string[] = [];
  for (const entry of entries) {
    if (typeof entry === "string") {
      allDates.push(entry);
    } else if (entry && typeof entry === "object" && "start" in entry && "end" in entry) {
      allDates.push(...listIsoDatesInRange(entry.start, entry.end));
    }
  }
  return normalizeIsoDates(allDates);
};
