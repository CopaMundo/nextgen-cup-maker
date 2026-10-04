import type { DrawSessionState } from "@/lib/drawSession";
import CountryFlag from "@/components/CountryFlag";

/** The exact same read-only picture is used in the control window and on the projector. */
export function DrawShow({ session, spotlightId }: { session: DrawSessionState; spotlightId?: string | null }) {
  const pending = session.pending;
  const team = session.teams.find((item) => item.id === pending?.teamId);
  const last = session.history[session.history.length - 1];
  const shown = team ?? session.teams.find((item) => item.id === last?.teamId);
  const eligible = pending?.options ?? [];

  return <div className="draw-show flex min-h-0 flex-col bg-background text-foreground">
    <div className="flex shrink-0 items-center justify-between border-b border-primary/30 px-5 py-3">
      <span className="text-sm font-bold uppercase text-primary">Copa Mundo · Live loting</span>
      <span className="text-xs text-muted-foreground">{session.phaseName} · {session.history.length}/{session.teams.length}</span>
    </div>
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 py-6 lg:px-8">
      <div className="relative flex min-h-48 shrink-0 items-center justify-center overflow-hidden border-b border-border py-8 sm:min-h-56">
        {pending && <div key={pending.teamId} className="draw-reveal-ball" aria-hidden="true">
          <span className="draw-ball-half draw-ball-left" /><span className="draw-ball-half draw-ball-right" />
        </div>}
        {shown ? <div key={`${shown.id}-${session.history.length}`} className={pending ? "draw-reveal-name" : ""}>
          {shown.logoUrl && <img src={shown.logoUrl} alt="" className="mx-auto mb-3 h-14 w-14 object-contain" />}
          <div className="flex items-center justify-center gap-3"><CountryFlag country={shown.country} /><strong className="text-center text-2xl font-bold sm:text-4xl">{shown.name}</strong></div>
          <p className="mt-2 text-center text-xs uppercase text-muted-foreground">{pending ? "Getrokken team" : last ? `In ${last.label}` : "Volgende trekking"}</p>
        </div> : <p className="text-center text-xl font-semibold text-muted-foreground">{session.finished ? "Loting afgerond" : "Klaar voor de volgende trekking"}</p>}
      </div>
      {pending && <div className="shrink-0 py-5">
        <h2 className="mb-3 text-xs font-semibold uppercase text-muted-foreground">Toelaatbare poules</h2>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {eligible.map((option) => <div key={option.id} className={`draw-show-group border-y-2 px-4 py-4 text-center text-lg font-bold ${spotlightId === option.id ? "border-y-primary bg-primary/10 text-primary draw-show-spotlight" : "border-y-border bg-card"}`}>{option.label}</div>)}
        </div>
      </div>}
      {!pending && <div className="grid gap-3 py-5 sm:grid-cols-2 lg:grid-cols-3">
        {session.containers.map((container) => <div key={container.id} className={`border-t-2 px-3 py-3 ${last?.targetId === container.id ? "border-primary bg-primary/10" : "border-border bg-card"}`}>
          <h3 className="mb-2 font-bold">{container.name}</h3>
          <div className="space-y-1 text-sm">{container.teamIds.map((id) => <div key={id} className="flex items-center gap-2 border-b border-border py-1">
            {session.teams.find((item) => item.id === id)?.logoUrl && <img src={session.teams.find((item) => item.id === id)?.logoUrl ?? ""} alt="" className="h-5 w-5 object-contain" />}
            <span className="truncate">{session.teams.find((item) => item.id === id)?.name}</span>
          </div>)}<span className="text-muted-foreground">{container.capacity - container.teamIds.length} plaatsen vrij</span></div>
        </div>)}
      </div>}
    </div>
  </div>;
}