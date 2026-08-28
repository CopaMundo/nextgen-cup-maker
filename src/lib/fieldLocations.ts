import { useSyncExternalStore } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface FieldEntry {
  name: string;
  startTime: string;
  location?: string | null;
}

/** Parse een jsonb fields-array (tournaments.fields / tournament_categories.fields). */
export const parseFieldEntries = (raw: any): FieldEntry[] => {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((f: any) =>
      typeof f === "string"
        ? { name: f, startTime: "09:00", location: null }
        : { name: f?.name || "", startTime: f?.startTime || "09:00", location: typeof f?.location === "string" && f.location ? f.location : null }
    )
    .filter((f) => f.name);
};

/** Serialiseer terug naar jsonb. */
export const serializeFieldEntries = (fields: FieldEntry[]) =>
  fields.map((f) => ({ name: f.name, startTime: f.startTime, location: f.location ?? null }));

// ---- Globale registry: veldnaam -> locatienaam (voor labels op wedstrijdkaarten) ----

let fieldToLocation: Record<string, string> = {};
let locationCount = 0;
let snapshot = 0;
const listeners = new Set<() => void>();

const emit = () => {
  snapshot++;
  listeners.forEach((l) => l());
};

export const registerFieldLocations = (fieldSources: any[], locations: { name: string }[]) => {
  const map: Record<string, string> = {};
  fieldSources.forEach((src) => {
    parseFieldEntries(src).forEach((f) => {
      if (f.location) map[f.name] = f.location;
    });
  });
  const count = (locations || []).filter((l) => l?.name).length;
  const changed = count !== locationCount || JSON.stringify(map) !== JSON.stringify(fieldToLocation);
  fieldToLocation = map;
  locationCount = count;
  if (changed) emit();
};

/** Haal fields/locaties op uit de database en registreer ze. */
export const loadFieldLocations = async (tournamentId: string) => {
  const [tRes, cRes, lRes] = await Promise.all([
    supabase.from("tournaments").select("fields").eq("id", tournamentId).maybeSingle(),
    supabase.from("tournament_categories").select("fields").eq("tournament_id", tournamentId),
    supabase.from("tournament_locations").select("name").eq("tournament_id", tournamentId),
  ]);
  registerFieldLocations(
    [tRes.data?.fields, ...((cRes.data || []) as any[]).map((c) => c.fields)],
    (lRes.data || []) as any[]
  );
};

export const getFieldLocation = (field?: string | null): string | null =>
  field ? fieldToLocation[field] ?? null : null;

export const hasMultipleLocations = () => locationCount > 1;

/** Verwijder een eventueel opgeslagen "Locatie · " prefix uit een veldnaam. */
export const stripLocationPrefix = (field: string, loc?: string | null): string =>
  loc && field.startsWith(`${loc} · `) ? field.slice(loc.length + 3) : field;

/** Zichtbare veldnaam (zonder interne locatie-prefix). */
export const displayFieldName = (field?: string | null): string => {
  if (!field) return "";
  return stripLocationPrefix(field, getFieldLocation(field));
};

/** "Locatie · Veld" bij meerdere locaties, anders enkel de veldnaam. */
export const formatFieldLabel = (field?: string | null): string => {
  if (!field) return "";
  const loc = getFieldLocation(field);
  const bare = stripLocationPrefix(field, loc);
  if (locationCount > 1 && loc && loc !== bare) return `${loc} · ${bare}`;
  return bare;
};

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};

/** Reactieve variant: hertekent wanneer de registry wijzigt. */
export const useFieldLabel = () => {
  useSyncExternalStore(subscribe, () => snapshot, () => snapshot);
  return formatFieldLabel;
};
