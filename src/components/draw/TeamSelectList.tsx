import CountryFlag from "@/components/CountryFlag";
import { Checkbox } from "@/components/ui/checkbox";

type Team = { id: string; name: string; country?: string | null; logoUrl?: string | null };

/** Editable participant checklist; the wizard validates the exact capacity on continuation. */
export function TeamSelectList({ teams, selectedIds, capacity, onChange, lockedIds }: {
  teams: Team[]; selectedIds: string[]; capacity: number; onChange: (ids: string[]) => void; lockedIds?: Set<string>;
}) {
  const selected = new Set(selectedIds);
  return <section className="space-y-2">
    <h3 className="section-title">DEELNEMERS</h3>
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <p>Selecteer {capacity} teams voor de loting</p>
      <span aria-label="Geselecteerde deelnemers" className="shrink-0 font-semibold tabular-nums">{selectedIds.length} / {capacity}</span>
    </div>
    <ul aria-label="Deelnemers selecteren" className="draw-panel grid max-h-[50vh] gap-1 overflow-y-auto p-2 sm:grid-cols-2 lg:grid-cols-3">
      {teams.map(team => {
        const checked = selected.has(team.id);
        const locked = Boolean(lockedIds?.has(team.id));
        return <li key={team.id}>
          <label className={`flex min-h-10 cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-primary/[0.06] ${checked ? "bg-primary/[0.08]" : ""}`}>
            <Checkbox checked={checked} disabled={locked} aria-label={team.name}
              onCheckedChange={value => onChange(value ? [...selectedIds, team.id] : selectedIds.filter(id => id !== team.id))} />
            {team.logoUrl && <img src={team.logoUrl} alt="" className="h-6 w-6 shrink-0 object-contain" />}
            <span className="min-w-0 flex-1 truncate">{team.name}</span>
            <CountryFlag country={team.country} className="h-3 w-4 shrink-0" />
          </label>
        </li>;
      })}
    </ul>
  </section>;
}
