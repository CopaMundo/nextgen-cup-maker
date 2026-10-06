import type { DrawSessionState } from "@/lib/drawSession";
import CountryFlag from "@/components/CountryFlag";
import liveDrawStage from "@/assets/live-draw-empty-stage.png";

const BALL_POSITIONS = [
  [48, 72], [37, 68], [59, 67], [28, 62], [49, 59], [69, 61], [39, 52], [59, 51],
  [20, 54], [77, 54], [29, 45], [49, 43], [68, 44], [39, 36], [59, 35], [49, 28],
] as const;

/** The exact same read-only picture is used in the control window and on the projector. */
export function DrawShow({ session, spotlightId }: { session?: DrawSessionState | null; spotlightId?: string | null }) {
  if (!session) {
    return (
      <div className="draw-show draw-show-stage" style={{ backgroundImage: `url(${liveDrawStage})` }}>
        <div className="draw-show-brand" aria-label="Copa Mundo Live loting">
          <strong>COPA MUNDO</strong>
          <span>LIVE LOTING</span>
        </div>
        <div className="draw-show-waiting">
          <strong>Wachten op de live loting</strong>
          <span>Het fanbeeld verschijnt zodra de organisator start.</span>
        </div>
      </div>
    );
  }
  const pending = session.pending;
  const team = session.teams.find((item) => item.id === pending?.teamId);
  const last = session.history[session.history.length - 1];
  const shown = team ?? session.teams.find((item) => item.id === last?.teamId);
  const eligible = pending?.options ?? [];
  const eligibleIds = new Set(eligible.map((option) => option.id));
  const splitAt = Math.ceil(session.containers.length / 2);
  const leftContainers = session.containers.slice(0, splitAt);
  const rightContainers = session.containers.slice(splitAt);
  const activePot = session.mode === "pots"
    ? session.pots.find((pot) => pot.id === session.activePotId && pot.teamIds.some((id) => session.remaining.includes(id))) ?? session.pots.find((pot) => pot.teamIds.some((id) => session.remaining.includes(id)))
    : null;
  const remainingBallIds = (activePot
    ? activePot.teamIds.filter((id) => session.remaining.includes(id))
    : session.remaining
  ).filter((id) => id !== pending?.teamId);

  const renderContainer = (container: DrawSessionState["containers"][number]) => {
    const isEligible = Boolean(pending && eligibleIds.has(container.id));
    const isSpotlight = spotlightId === container.id;
    const isLast = !pending && last?.targetId === container.id;
    const slots = Array.from({ length: container.capacity }, (_, index) => {
      const teamId = container.teamIds[index];
      const placedTeam = session.teams.find((item) => item.id === teamId);
      return (
        <div key={`${container.id}-${index}`} className="draw-show-slot">
          <span className="draw-show-slot-mark">
            {placedTeam?.logoUrl ? <img src={placedTeam.logoUrl} alt="" /> : index + 1}
          </span>
          <span className="draw-show-slot-name">{placedTeam?.name ?? ""}</span>
        </div>
      );
    });

    return (
      <section
        key={container.id}
        className={`draw-show-group-card ${isEligible ? "is-eligible" : ""} ${isSpotlight ? "is-spotlight" : ""} ${isLast ? "is-placed" : ""} ${pending && !isEligible ? "is-muted" : ""}`}
      >
        <h2>{container.name}</h2>
        <div className="draw-show-slots">{slots}</div>
      </section>
    );
  };

  return <div className="draw-show draw-show-stage" style={{ backgroundImage: `url(${liveDrawStage})` }}>
    <div className="draw-show-phase">{session.phaseName} · {session.history.length}/{session.teams.length}</div>

    <div className="draw-show-wing draw-show-wing-left">{leftContainers.map(renderContainer)}</div>
    <div className="draw-show-wing draw-show-wing-right">{rightContainers.map(renderContainer)}</div>

    <main className="draw-show-center">
      <div className="draw-show-team-card">
        {pending && <div key={pending.teamId} className="draw-reveal-ball" aria-hidden="true">
          <span className="draw-ball-half draw-ball-left" /><span className="draw-ball-half draw-ball-right" />
        </div>}
        {shown ? <div key={`${shown.id}-${session.history.length}`} className={`draw-show-team ${pending ? "draw-reveal-name" : ""}`}>
          {shown.logoUrl && <img src={shown.logoUrl} alt="" className="draw-show-team-logo" />}
          <div className="draw-show-team-country"><CountryFlag country={shown.country} className="h-4 w-6" /><span>{shown.country}</span></div>
          <strong>{shown.name}</strong>
          <p>{pending ? "GETROKKEN TEAM" : last ? `GEPLAATST IN ${last.label}` : "VOLGENDE TREKKING"}</p>
        </div> : <p className="draw-show-ready">{session.finished ? "LOTING AFGEROND" : "KLAAR VOOR DE VOLGENDE TREKKING"}</p>}
      </div>
      {pending && <div className="draw-show-eligible">
        <p className="draw-show-eligible-label">TOELAATBARE {eligible.length === 1 ? "POULE" : "POULES"}</p>
        <div className="draw-show-eligible-groups">
          {eligible.map((option) => <span key={option.id} className={spotlightId === option.id ? "is-spotlight" : ""}>{option.label}</span>)}
        </div>
      </div>}
    </main>

    <div className="draw-show-bowl" aria-label={`${remainingBallIds.length} ballen resterend`}>
      {remainingBallIds.map((teamId, index) => {
        const [left, top] = BALL_POSITIONS[index % BALL_POSITIONS.length];
        const layer = Math.floor(index / BALL_POSITIONS.length);
        return <span
          key={teamId}
          className="draw-show-bowl-ball"
          style={{ left: `${Math.min(84, left + (layer % 2 ? 3 : 0))}%`, top: `${Math.max(18, top - layer * 7)}%`, zIndex: index + 1 }}
        />;
      })}
    </div>
    {pending && <span key={`flight-${pending.teamId}`} className="draw-show-flying-ball" aria-hidden="true" />}
  </div>;
}