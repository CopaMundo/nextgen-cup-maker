import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PotTeamSlots } from "./PotTeamSlots";
import type { DrawContainer, DrawTeam } from "@/lib/liveDraw";

export function MatchDrawSetup({ teams, selectedIds, onTeamsChange, containers, originals, useSeeds, seedCount, onSeedCount, onSeed }: {
  teams: DrawTeam[]; selectedIds: string[]; onTeamsChange: (ids: string[]) => void;
  containers: DrawContainer[]; originals: DrawContainer[]; useSeeds: boolean; seedCount: number;
  onSeedCount: (count: number) => void;
  onSeed: (rank: number, teamId: string | null, fixtureId?: string, side?: number) => void;
}) {
  const fixedIds = new Set(containers.flatMap(c => c.teamIds));
  const originalIds = new Set(originals.flatMap(c => c.teamIds));
  const capacity = containers.length * 2;
  return <div className="space-y-5">
    {teams.length > capacity && <section className="space-y-2"><h3 className="font-semibold">Deelnemers · {selectedIds.length}/{capacity}</h3><PotTeamSlots teams={teams} teamIds={selectedIds} assignedIds={new Set(selectedIds)} lockedIds={fixedIds} capacity={capacity} onChange={(index, id) => { const next = [...selectedIds]; if (id) next[index] = id; else next.splice(index, 1); onTeamsChange(next); }} /></section>}
    {useSeeds && <section className="space-y-3">
      <Label htmlFor="seed-count">Aantal reekshoofden</Label>
      <Select value={String(seedCount)} onValueChange={value => onSeedCount(Number(value))}><SelectTrigger id="seed-count" className="w-44"><SelectValue /></SelectTrigger><SelectContent>{Array.from({ length: containers.length }, (_, i) => i + 1).map(count => <SelectItem key={count} value={String(count)}>{count}</SelectItem>)}</SelectContent></Select>
      {Array.from({ length: seedCount }, (_, i) => i + 1).map(rank => {
        const fixture = containers.find(c => c.seedRanks?.includes(rank));
        const side = fixture?.seedRanks?.indexOf(rank) ?? -1;
        const id = side >= 0 ? fixture?.matchSlots?.[side] : null;
        const locked = Boolean(id && originalIds.has(id));
        return <div key={rank} className="draw-panel space-y-2 p-3">
          <Label htmlFor={`seed-team-${rank}`}>Reekshoofd {rank}</Label>
          <div className="grid gap-2 sm:grid-cols-2">
            <Select value={id ?? "empty"} disabled={locked} onValueChange={value => onSeed(rank, value === "empty" ? null : value)}><SelectTrigger id={`seed-team-${rank}`} aria-label={`Reekshoofd ${rank}`}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="empty">Kies team</SelectItem>{teams.filter(t => selectedIds.includes(t.id) && (!fixedIds.has(t.id) || t.id === id)).map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent></Select>
            <Select value={fixture && side >= 0 ? `${fixture.id}|${side}` : "empty"} disabled={!id || locked} onValueChange={value => { const [fixtureId, nextSide] = value.split("|"); onSeed(rank, id ?? null, fixtureId, Number(nextSide)); }}><SelectTrigger aria-label={`Bracketpositie reekshoofd ${rank}`}><SelectValue placeholder="Vaste bracketpositie" /></SelectTrigger><SelectContent>{!fixture && <SelectItem value="empty">Vaste bracketpositie</SelectItem>}{containers.flatMap(c => [0, 1].filter(s => !c.matchSlots?.[s] || c.matchSlots[s] === id).map(s => <SelectItem key={`${c.id}|${s}`} value={`${c.id}|${s}`}>{c.name} · {s === 0 ? "Thuis" : "Uit"}</SelectItem>))}</SelectContent></Select>
          </div>
          {id && !locked && <Button size="sm" variant="ghost" onClick={() => onSeed(rank, null)}>Selectie wissen</Button>}
        </div>;
      })}
    </section>}
  </div>;
}