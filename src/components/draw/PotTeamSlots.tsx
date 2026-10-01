import CountryFlag from "@/components/CountryFlag";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X } from "lucide-react";

type Team = { id: string; name: string; country?: string | null; logoUrl?: string | null };

export function PotTeamSlots({ teams, teamIds, assignedIds, capacity, onChange, disabled = false }: {
  teams: Team[];
  teamIds: string[];
  assignedIds: Set<string>;
  capacity: number;
  onChange: (index: number, teamId: string | null) => void;
  disabled?: boolean;
}) {
  const byId = new Map(teams.map((team) => [team.id, team]));
  return <div className="grid gap-2">
    {Array.from({ length: capacity }, (_, index) => {
      const current = teamIds[index];
      const selected = current ? byId.get(current) : undefined;
      return <div key={index} className="flex min-w-0 items-center gap-1.5">
        <Select value={current || "empty"} disabled={disabled || index > teamIds.length} onValueChange={(value) => onChange(index, value === "empty" ? null : value)}>
          <SelectTrigger aria-label={`Teamvak ${index + 1}`} className="h-11 min-w-0 flex-1 border-border bg-background text-left">
            <SelectValue>
              {selected ? <span className="flex min-w-0 items-center gap-2">
                {selected.logoUrl && <img src={selected.logoUrl} alt="" className="h-6 w-6 shrink-0 object-contain" />}
                <CountryFlag country={selected.country} className="h-3 w-4 shrink-0" />
                <span className="truncate">{selected.name}</span>
              </span> : <span className="text-muted-foreground">Lege plaats {index + 1}</span>}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="empty">Lege plaats</SelectItem>
            {teams.filter((team) => team.id === current || !assignedIds.has(team.id)).map((team) =>
              <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>
            )}
          </SelectContent>
        </Select>
        <Button type="button" variant="ghost" size="icon" className="h-9 w-9 shrink-0" disabled={disabled || !current} aria-label={`Team uit plaats ${index + 1} verwijderen`} onClick={() => onChange(index, null)}>
          <X className="h-4 w-4" />
        </Button>
      </div>;
    })}
  </div>;
}