import { ChevronDown, Copy, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import WhistleIcon from "@/components/icons/WhistleIcon";

export interface RefereeCardDetails {
  name: string;
  /** Regels voor op het kaartje: alleen actieve locaties, in toernooivolgorde. */
  locations: string[];
  /** Volledige regels voor de detail-popover: actieve locaties eerst, locaties met "Geen" daaronder. */
  locationDetails?: string[];
  availability: string[];
  role: string;
  maxMatches: number | null;
  excludedTeams: string[];
}

const LABEL = "text-xs font-bold uppercase tracking-wider text-muted-foreground";

function CompactDetails({ label, lines, popupLines, separator = ", " }: { label: string; lines: string[]; popupLines?: string[]; separator?: string }) {
  const first = lines.length > 0 ? lines.join(separator) : "Geen";
  return (
    <div className="min-w-0">
      <p className={LABEL}>{label}</p>
      <div className="flex h-7 min-w-0 items-center gap-1">
        <span className="min-w-0 flex-1 truncate text-sm text-foreground" title={first}>{first}</span>
        {(lines.length > 1 || first.length > 40) && (
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="group/details h-6 w-6 shrink-0 text-muted-foreground hover:bg-transparent hover:text-primary"
                aria-label={`${label}: alle details`}
                title="Alle details bekijken"
              >
                <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200 group-data-[state=open]/details:rotate-180" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="max-w-[calc(100vw-2rem)] p-3">
              <p className={`mb-2 ${LABEL}`}>{label}</p>
              <ul className="max-h-60 space-y-2 overflow-y-auto text-sm">
                {(popupLines ?? lines).map((line, index) => <li key={index} className="break-words">{line}</li>)}
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
  /** of het toernooi met teams of spelers werkt (bepaalt de rubriek "Uitgesloten ...") */
  participantsKind?: "teams" | "players";
  onEdit: (index: number) => void;
  onDelete: (index: number) => void;
  onAdd: () => void;
  onImport?: () => void;
}

export default function RefereeOverview({ referees, participantsKind = "teams", onEdit, onDelete, onAdd, onImport }: Props) {
  const players = participantsKind === "players";
  const excludedTitle = `Uitgesloten ${players ? "spelers" : "teams"}`;
  return (
    <div className="space-y-3">
      <div className="flex min-h-8 items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{referees.length} Scheidsrechter{referees.length !== 1 ? "s" : ""}</p>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {onImport && <Button variant="outline" size="sm" className="gap-1.5" onClick={onImport}><Copy className="h-3.5 w-3.5" /> Importeer uit andere divisie</Button>}
          <Button size="sm" className="gap-1.5" onClick={onAdd}><Plus className="h-3.5 w-3.5" /> Scheidsrechter toevoegen</Button>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {referees.map((referee, index) => {
          const count = referee.excludedTeams.length;
          const noun = players ? (count !== 1 ? "spelers" : "speler") : (count !== 1 ? "teams" : "team");
          return (
            <article key={index} aria-label={referee.name} className="flex h-[21rem] min-w-0 flex-col gap-2.5 rounded-lg border border-border bg-card p-4">
              <div className="flex h-9 shrink-0 items-center gap-2">
                <WhistleIcon className="h-5 w-5 shrink-0 text-primary" />
                <h3 className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground" title={referee.name}>{referee.name}</h3>
                <div className="flex shrink-0 items-center">
                  <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground" onClick={() => onEdit(index)} aria-label={`${referee.name} bewerken`} title="Bewerken"><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" onClick={() => onDelete(index)} aria-label={`${referee.name} verwijderen`} title="Verwijderen"><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
              <CompactDetails label="Locaties en velden" lines={referee.locations} popupLines={referee.locationDetails} separator=" • " />
              <CompactDetails label="Beschikbaarheid" lines={referee.availability} separator=" • " />
              <div className="min-w-0 shrink-0">
                <p className={LABEL}>Max. aantal wedstrijden</p>
                <p className="flex h-7 items-center truncate text-sm text-foreground">
                  {referee.maxMatches !== null ? `${referee.maxMatches} wedstrijd${referee.maxMatches !== 1 ? "en" : ""}` : "Geen limiet"}
                </p>
              </div>
              <div className="min-w-0 shrink-0">
                <p className={LABEL}>{excludedTitle}</p>
                <div className="flex h-7 items-center">
                  {count === 0 ? <span className="text-sm text-foreground">Geen</span> : (
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="ghost" className="h-7 min-w-0 justify-start gap-1 px-0 text-sm font-normal text-foreground hover:bg-transparent group/details" aria-label={`${excludedTitle} van ${referee.name}`}>
                          <span className="truncate">{count} {noun}</span>
                          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-hover/details:text-primary group-data-[state=open]/details:rotate-180" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent align="start" className="max-w-[calc(100vw-2rem)] p-3">
                        <p className={`mb-2 ${LABEL}`}>{excludedTitle}</p>
                        <ul className="max-h-60 space-y-2 overflow-y-auto text-sm">{referee.excludedTeams.map((name, i) => <li key={i} className="break-words">{name}</li>)}</ul>
                      </PopoverContent>
                    </Popover>
                  )}
                </div>
              </div>
              <div className="min-w-0 shrink-0">
                <p className={LABEL}>Rol</p>
                <p className="flex h-7 items-center truncate text-sm text-foreground" title={referee.role}>{referee.role}</p>
              </div>
            </article>
          );
        })}
        <Button variant="outline" onClick={onAdd} className="flex h-[21rem] min-w-0 flex-col gap-3 whitespace-normal rounded-lg border-dashed bg-card text-foreground hover:border-primary">
          <Plus className="h-7 w-7 text-primary" />
          <span className="text-sm font-medium">Scheidsrechter toevoegen</span>
        </Button>
      </div>
    </div>
  );
}
