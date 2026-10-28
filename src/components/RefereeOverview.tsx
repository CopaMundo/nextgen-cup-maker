import { Copy, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import WhistleIcon from "@/components/icons/WhistleIcon";

export interface RefereeCardDetails {
  name: string;
  locations: string[];
  availability: string[];
  role: string;
  maxMatches: number | null;
  excludedTeams: string[];
  excludedKind?: "teams" | "players";
}

function CompactDetails({ label, lines }: { label: string; lines: string[] }) {
  const first = lines[0] ?? "Geen";
  return (
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="flex h-7 min-w-0 items-center gap-2">
        <span className="min-w-0 flex-1 truncate text-sm text-foreground" title={first}>{first}</span>
        {(lines.length > 1 || first.length > 40) && (
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 shrink-0 px-1.5 text-xs text-primary" aria-label={`${label}: alle details`}>
                {lines.length > 1 ? `+${lines.length - 1} meer` : <MoreHorizontal className="h-4 w-4" />}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="max-w-[calc(100vw-2rem)] p-3">
              <p className="mb-2 text-sm font-semibold">{label}</p>
              <ul className="max-h-60 space-y-2 overflow-y-auto text-sm">
                {lines.map((line, index) => <li key={index} className="break-words">{line}</li>)}
              </ul>
            </PopoverContent>
          </Popover>
        )}
      </div>
    </div>
  );
}

interface Props {
  referees: RefereeCardDetails[];
  onEdit: (index: number) => void;
  onDelete: (index: number) => void;
  onAdd: () => void;
  onImport?: () => void;
}

export default function RefereeOverview({ referees, onEdit, onDelete, onAdd, onImport }: Props) {
  return (
    <div className="space-y-3">
      <div className="flex min-h-8 items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{referees.length} Scheidsrechter{referees.length !== 1 ? "s" : ""}</p>
        {onImport && <Button variant="outline" size="sm" className="gap-1.5" onClick={onImport}><Copy className="h-3.5 w-3.5" /> Importeren</Button>}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {referees.map((referee, index) => (
          <article key={index} aria-label={referee.name} className="flex h-64 min-w-0 flex-col gap-3 rounded-lg border border-border bg-card p-4">
            <div className="flex h-9 shrink-0 items-center gap-2">
              <WhistleIcon className="h-5 w-5 shrink-0 text-primary" />
              <h3 className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground" title={referee.name}>{referee.name}</h3>
              <div className="flex shrink-0 items-center">
                <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground" onClick={() => onEdit(index)} aria-label={`${referee.name} bewerken`} title="Bewerken"><Pencil className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" onClick={() => onDelete(index)} aria-label={`${referee.name} verwijderen`} title="Verwijderen"><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>
            <CompactDetails label="Locaties en velden" lines={referee.locations} />
            <CompactDetails label="Beschikbaarheid" lines={referee.availability} />
            <div className="flex h-7 min-w-0 shrink-0 items-center justify-between gap-2 text-xs text-muted-foreground">
              <span className="shrink-0">{referee.maxMatches !== null ? `Max. ${referee.maxMatches} wedstrijden` : "Max. wedstrijden: Geen limiet"}</span>
              {referee.excludedTeams.length > 0 && (() => {
                const players = referee.excludedKind === "players";
                const noun = players ? (referee.excludedTeams.length !== 1 ? "spelers" : "speler") : (referee.excludedTeams.length !== 1 ? "teams" : "team");
                return (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-7 min-w-0 px-1.5 text-xs text-primary" aria-label={`Uitgesloten ${players ? "spelers" : "teams"} van ${referee.name}`}>
                        <span className="truncate">{referee.excludedTeams.length} uitgesloten {noun}</span>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent align="end" className="max-w-[calc(100vw-2rem)] p-3">
                      <p className="mb-2 text-sm font-semibold">Uitgesloten {players ? "spelers" : "teams"}</p>
                      <ul className="max-h-60 space-y-2 overflow-y-auto text-sm">{referee.excludedTeams.map((name, i) => <li key={i} className="break-words">{name}</li>)}</ul>
                    </PopoverContent>
                  </Popover>
                );
              })()}
            </div>
            <div className="mt-auto flex h-7 min-w-0 shrink-0 items-center text-xs text-muted-foreground">
              <span className="truncate" title={referee.role}>Rol: <span className="text-foreground">{referee.role}</span></span>
            </div>
          </article>
        ))}
        <Button variant="outline" onClick={onAdd} className="flex h-64 min-w-0 flex-col gap-3 whitespace-normal rounded-lg border-dashed bg-card text-foreground hover:border-primary">
          <Plus className="h-7 w-7 text-primary" />
          <span className="text-sm font-medium">Scheidsrechter toevoegen</span>
        </Button>
      </div>
    </div>
  );
}