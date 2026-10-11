import { memo, type CSSProperties } from "react";
import type { DrawContainer, DrawTeam } from "@/lib/liveDraw";
import { AutoTrimLogo } from "./AutoTrimLogo";

export const MatchDrawWings = memo(function MatchDrawWings({ left, right, teams, targetId, lastTeamId }: {
  left: DrawContainer[]; right: DrawContainer[]; teams: Map<string, DrawTeam>; targetId?: string | null; lastTeamId?: string;
}) {
  return <>{([left, right] as const).map((fixtures, wing) => {
    const columns = fixtures.length > 8 ? 2 : 1;
    const rows = Math.max(1, Math.ceil(fixtures.length / columns));
    return <section key={wing} className={`draw-show-match-wing ${wing === 0 ? "is-left" : "is-right"}`} aria-label={wing === 0 ? "Linker brackethelft" : "Rechter brackethelft"} style={{ "--match-columns": columns, "--match-rows": rows } as CSSProperties}>
      {fixtures.map(fixture => <article key={fixture.id} className={`draw-show-match-card ${fixture.id === targetId ? "is-active" : ""}`} data-match-number={fixture.matchNumber}>
        <span className="draw-show-match-number" aria-label={`Wedstrijd ${fixture.matchNumber}`}>{fixture.matchNumber}</span>
        {(fixture.matchSlots ?? [null, null]).map((id, side) => {
          const team = id ? teams.get(id) : undefined;
          const rank = fixture.seedRanks?.[side];
          const name = team ? `${team.name}${rank ? ` (${rank})` : ""}` : "—";
          return <div key={side} className={`draw-show-slot ${id && id === lastTeamId ? "is-arriving" : ""}`} data-transfer-target={fixture.id === targetId && side === fixture.matchSlots?.findIndex(slot => !slot)} title={name}>
            <span className="draw-show-slot-mark">{team?.logoUrl ? <AutoTrimLogo src={team.logoUrl} /> : team?.name.slice(0, 2).toUpperCase()}</span>
            <span className="draw-show-slot-name">{name}</span>
          </div>;
        })}
      </article>)}
    </section>;
  })}</>;
});