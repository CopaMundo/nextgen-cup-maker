export interface RefereeAvailability {
  date: string; // ISO date
  from: string; // HH:MM
  to: string;   // HH:MM
}

export interface RefereeConfig {
  name: string;
  /** null = alle velden/locaties toegestaan */
  allowedFields: string[] | null;
  /** null = hele dag, alle dagen */
  availability: RefereeAvailability[] | null;
  /** null = geen limiet */
  maxMatches: number | null;
  /** team ids die deze scheidsrechter niet mag fluiten */
  excludedTeams: string[];
  /** null = alle rollen (1..5) */
  roles: number[] | null;
}

export const ALL_ROLES = [1, 2, 3, 4, 5];

export type LocationFieldMode = "all" | "select" | "none";

/** Bepaal de veldmodus voor één locatie op basis van allowedFields. */
export const getLocationFieldMode = (
  location: string,
  allowedFields: string[] | null,
  fields: string[]
): LocationFieldMode => {
  if (!allowedFields) return "all";
  if (allowedFields.length === 0) return "none";
  const hasLocation = allowedFields.includes(location);
  if (!hasLocation) return "none";
  if (fields.length === 0) return "all";
  const allFieldsSelected = fields.every(f => allowedFields.includes(f));
  return allFieldsSelected ? "all" : "select";
};

/** Wijzig allowedFields voor één locatie (locatienaam zit zelf ook in allowedFields). */
export const setLocationFieldMode = (
  location: string,
  mode: LocationFieldMode,
  allowedFields: string[] | null,
  fields: string[]
): string[] => {
  const base = allowedFields ? [...allowedFields] : [];
  if (mode === "none") {
    return base.filter(f => f !== location && !fields.includes(f));
  }
  const set = new Set(base);
  set.add(location);
  fields.forEach(f => set.add(f));
  return Array.from(set);
};

/** Wissel één veld aan/uit binnen allowedFields. */
export const toggleFieldInAllowed = (
  field: string,
  allowedFields: string[] | null,
  allFields: string[]
): string[] => {
  const base = allowedFields ? [...allowedFields] : [...allFields];
  const set = new Set(base);
  if (set.has(field)) set.delete(field);
  else set.add(field);
  return Array.from(set);
};

export const parseReferee = (entry: any): RefereeConfig => {
  if (typeof entry === "string") {
    return { name: entry, allowedFields: null, availability: null, maxMatches: null, excludedTeams: [], roles: null };
  }
  const e = entry || {};
  return {
    name: typeof e.name === "string" ? e.name : "",
    allowedFields: Array.isArray(e.allowedFields) ? e.allowedFields.filter((f: any) => typeof f === "string") : null,
    availability: Array.isArray(e.availability)
      ? e.availability
          .filter((a: any) => a && typeof a.date === "string")
          .map((a: any) => ({ date: a.date, from: a.from || "00:00", to: a.to || "23:59" }))
      : null,
    maxMatches: typeof e.maxMatches === "number" && e.maxMatches > 0 ? e.maxMatches : null,
    excludedTeams: Array.isArray(e.excludedTeams) ? e.excludedTeams.filter((t: any) => typeof t === "string") : [],
    roles: Array.isArray(e.roles) ? e.roles.filter((r: any) => typeof r === "number") : null,
  };
};

export const parseReferees = (raw: any): RefereeConfig[] =>
  Array.isArray(raw) ? raw.map(parseReferee).filter(r => r.name) : [];

export const serializeReferees = (refs: RefereeConfig[]) =>
  refs.map(r => ({
    name: r.name,
    allowedFields: r.allowedFields,
    availability: r.availability,
    maxMatches: r.maxMatches,
    excludedTeams: r.excludedTeams,
    roles: r.roles,
  }));

export const refereeNames = (refs: RefereeConfig[]) => refs.map(r => r.name);

const timeToMinutes = (t: string | null | undefined) => {
  if (!t) return null;
  const [h, m] = t.split(":");
  const hours = Number(h);
  const mins = Number(m ?? 0);
  if (Number.isNaN(hours)) return null;
  return hours * 60 + (Number.isNaN(mins) ? 0 : mins);
};

/** Korte samenvatting van de instellingen, in vaste volgorde. */
export const summarizeReferee = (
  ref: RefereeConfig,
  opts: { totalFields?: number; teamName?: (id: string) => string } = {}
): string[] => {
  const parts: string[] = [];

  if (ref.allowedFields && ref.allowedFields.length === 0) {
    parts.push("Geen velden");
  } else if (!ref.allowedFields || (opts.totalFields && ref.allowedFields.length >= opts.totalFields)) {
    parts.push("Alle velden");
  } else {
    parts.push(ref.allowedFields.length === 1 ? ref.allowedFields[0] : `${ref.allowedFields.length} velden`);
  }

  if (!ref.availability || ref.availability.length === 0) {
    parts.push("Hele dag");
  } else if (ref.availability.length === 1) {
    parts.push(`${ref.availability[0].from}–${ref.availability[0].to}`);
  } else {
    parts.push(`${ref.availability.length} dagen`);
  }

  parts.push(ref.maxMatches ? `Max ${ref.maxMatches}` : "Geen limiet");

  if (!ref.excludedTeams || ref.excludedTeams.length === 0) {
    parts.push("/");
  } else if (ref.excludedTeams.length === 1 && opts.teamName) {
    parts.push(`Niet: ${opts.teamName(ref.excludedTeams[0])}`);
  } else {
    parts.push(`${ref.excludedTeams.length} uitgesloten`);
  }

  const roles = ref.roles;
  if (!roles || roles.length === 0 || roles.length >= ALL_ROLES.length) {
    parts.push("Alle rollen");
  } else {
    parts.push(`Rol ${[...roles].sort((a, b) => a - b).join(", ")}`);
  }

  return parts;
};

export interface RefereeSummaryLine {
  label: string;
  value: string;
}

const locationModeLabel = (mode: LocationFieldMode, fields: string[], allowedFields: string[] | null): string => {
  if (mode === "none") return "Geen";
  if (mode === "all" || fields.length === 0) return "Alle velden";
  const selectedCount = fields.filter(f => allowedFields?.includes(f)).length;
  return selectedCount === 1 ? "1 veld" : `${selectedCount} velden`;
};

/** Gelabelde samenvatting voor scheidsrechtertegels (label = waarde). */
export const summarizeRefereeLabeled = (
  ref: RefereeConfig,
  opts: { locations?: string[]; fields?: string[]; teamName?: (id: string) => string } = {}
): RefereeSummaryLine[] => {
  const lines: RefereeSummaryLine[] = [];
  const locations = opts.locations || [];
  const fields = opts.fields || [];

  // Locaties/velden — één regel, ook als er meerdere locaties zijn.
  if (locations.length > 0) {
    const modes = locations.map(loc => getLocationFieldMode(loc, ref.allowedFields, fields));
    const allAll = modes.every(m => m === "all");
    const allNone = modes.every(m => m === "none");
    if (allNone) {
      lines.push({ label: "Locaties/velden", value: "Geen velden" });
    } else if (allAll) {
      lines.push({ label: "Locaties/velden", value: "Alle velden" });
    } else {
      const noneCount = modes.filter(m => m === "none").length;
      const allCount = modes.filter(m => m === "all").length;
      const selectCount = modes.filter(m => m === "select").length;
      const parts: string[] = [];
      if (allCount > 0) parts.push(`${allCount} alle velden`);
      if (selectCount > 0) parts.push(`${selectCount} selectie`);
      if (noneCount > 0) parts.push(`${noneCount} geen`);
      lines.push({ label: "Locaties/velden", value: parts.join(", ") });
    }
  } else {
    const total = fields.length;
    if (ref.allowedFields && ref.allowedFields.length === 0) {
      lines.push({ label: "Locaties/velden", value: "Geen velden" });
    } else if (!ref.allowedFields || (total > 0 && ref.allowedFields.length >= total)) {
      lines.push({ label: "Locaties/velden", value: "Alle velden" });
    } else {
      lines.push({
        label: "Locaties/velden",
        value: ref.allowedFields.length === 1 ? ref.allowedFields[0] : `${ref.allowedFields.length} velden`,
      });
    }
  }

  if (!ref.availability || ref.availability.length === 0) {
    lines.push({ label: "Beschikbaarheid", value: "Hele dag" });
  } else if (ref.availability.length === 1) {
    lines.push({ label: "Beschikbaarheid", value: `${ref.availability[0].from}–${ref.availability[0].to}` });
  } else {
    lines.push({ label: "Beschikbaarheid", value: `${ref.availability.length} dagen` });
  }

  lines.push({ label: "Max aantal wedstrijden", value: ref.maxMatches ? `Max ${ref.maxMatches}` : "Geen limiet" });

  if (!ref.excludedTeams || ref.excludedTeams.length === 0) {
    lines.push({ label: "Uitgesloten teams/spelers", value: "/" });
  } else if (ref.excludedTeams.length === 1 && opts.teamName) {
    lines.push({ label: "Uitgesloten teams/spelers", value: `Niet: ${opts.teamName(ref.excludedTeams[0])}` });
  } else {
    lines.push({ label: "Uitgesloten teams/spelers", value: `${ref.excludedTeams.length} uitgesloten` });
  }

  const roles = ref.roles;
  if (!roles || roles.length === 0 || roles.length >= ALL_ROLES.length) {
    lines.push({ label: "Rol 1-5", value: "Alle rollen" });
  } else {
    lines.push({ label: "Rol 1-5", value: `Rol ${[...roles].sort((a, b) => a - b).join(", ")}` });
  }

  return lines;
};

export interface MatchLike {
  match_date: string | null;
  match_time: string | null;
  field: string | null;
  home_team_id: string | null;
  away_team_id: string | null;
}

/** Mag deze scheidsrechter deze wedstrijd (in deze rol) fluiten? */
export const refereeCanOfficiate = (
  ref: RefereeConfig,
  match: MatchLike,
  role = 1,
  assignedCount = 0
): boolean => {
  // Rol
  if (ref.roles && ref.roles.length > 0 && !ref.roles.includes(role)) return false;

  // Max aantal wedstrijden
  if (ref.maxMatches != null && assignedCount >= ref.maxMatches) return false;

  // Velden / locaties
  if (ref.allowedFields && ref.allowedFields.length > 0 && match.field && !ref.allowedFields.includes(match.field)) return false;
  if (ref.allowedFields && ref.allowedFields.length === 0) return false;

  // Uitgesloten teams
  if (ref.excludedTeams.length > 0) {
    if (match.home_team_id && ref.excludedTeams.includes(match.home_team_id)) return false;
    if (match.away_team_id && ref.excludedTeams.includes(match.away_team_id)) return false;
  }

  // Beschikbaarheid
  if (ref.availability && ref.availability.length > 0) {
    if (!match.match_date) return false;
    const windows = ref.availability.filter(a => a.date === match.match_date);
    if (windows.length === 0) return false;
    const start = timeToMinutes(match.match_time);
    if (start == null) return true;
    const fits = windows.some(w => {
      const from = timeToMinutes(w.from) ?? 0;
      const to = timeToMinutes(w.to) ?? 24 * 60;
      return start >= from && start <= to;
    });
    if (!fits) return false;
  }

  return true;
};
