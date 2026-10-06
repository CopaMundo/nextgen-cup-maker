import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { DrawSessionState } from "@/lib/drawSession";
import { needsGroupOverview, stageSelection, type DrawPresentation } from "@/lib/drawPresentation";
import CountryFlag from "@/components/CountryFlag";
import liveDrawStage from "@/assets/live-draw-compact-stage.png";

export function DrawShow({ session, spotlightId, presentation, controls }: {
  session?: DrawSessionState | null;
  spotlightId?: string | null;
  presentation?: DrawPresentation;
  controls?: ReactNode;
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [now, setNow] = useState(Date.now());
  const [destination, setDestination] = useState({ x: 0, y: 0 });
  useEffect(() => {
    if (!session?.pending) return;
    const timer = window.setInterval(() => setNow(Date.now()), 40);
    return () => window.clearInterval(timer);
  }, [session?.pending?.teamId]);
  const selectionPhase = stageSelection(presentation, now);
  const pending = session?.pending;
  const selectedId = presentation?.selection?.targetId;
  const team = session?.teams.find((item) => item.id === pending?.teamId);
  const last = session?.history[session.history.length - 1];
  const eligible = selectedId ? pending?.options.filter((option) => option.id === selectedId) ?? [] : pending?.options ?? [];
  const overview = needsGroupOverview(session?.containers ?? []);
  const focusId = selectedId ?? spotlightId ?? pending?.options[0]?.id ?? last?.targetId ?? session?.containers[0]?.id;
  const focus = session?.containers.find((container) => container.id === focusId);
  useLayoutEffect(() => {
    const stage = stageRef.current;
    const slot = stage?.querySelector<HTMLElement>("[data-transfer-target='true']");
    if (!stage || !slot) return;
    const rect = stage.getBoundingClientRect();
    const target = slot.getBoundingClientRect();
    setDestination({ x: target.left + target.width / 2 - rect.left - rect.width / 2, y: target.top + target.height / 2 - rect.top - rect.height * .44 });
  }, [selectedId, focusId, overview]);

  const activePot = session?.mode === "pots"
    ? session.pots.find((pot) => pot.id === (presentation?.activePotId ?? session.activePotId)) ?? session.pots.find((pot) => pot.teamIds.some((id) => session.remaining.includes(id)))
    : null;
  const remainingIds = (activePot ? activePot.teamIds : session?.remaining ?? [])
    .filter((id) => session?.remaining.includes(id) && id !== pending?.teamId);
  const splitAt = Math.ceil((session?.containers.length ?? 0) / 2);
  const renderContainer = (container: DrawSessionState["containers"][number]) => (
    <section key={container.id} className={`draw-show-group-card ${container.id === selectedId || (!pending && last?.targetId === container.id) ? "is-placed" : ""}`}>
      <h2>{container.name}<small>{container.teamIds.length}/{container.capacity}</small></h2>
      <div className="draw-show-slots" style={{ "--slot-columns": overview ? Math.ceil(container.capacity / 16) : 1 } as CSSProperties}>
        {Array.from({ length: container.capacity }, (_, index) => {
          const placed = session?.teams.find((item) => item.id === container.teamIds[index]);
          return <div key={index} className="draw-show-slot" data-transfer-target={container.id === selectedId && index === container.teamIds.length}>
            <span className="draw-show-slot-mark">{placed?.logoUrl ? <img src={placed.logoUrl} alt="" /> : placed ? null : index + 1}</span>
            <span className="draw-show-slot-name" title={placed?.name}>{placed?.name ?? ""}</span>
          </div>;
        })}
      </div>
    </section>
  );
  const teamContent = team && <>{team.logoUrl && <img src={team.logoUrl} alt="" className="draw-show-team-logo" />}<CountryFlag country={team.country} className="draw-show-flag" /><strong>{team.name}</strong></>;
  const speed = presentation?.speed ?? 1;
  const elapsed = pending && presentation?.revealAt ? Math.max(0, now - presentation.revealAt) : 0;
  const motionStyle = { "--draw-rate": speed, "--reveal-offset": `${-elapsed}ms`, "--transfer-x": `${destination.x}px`, "--transfer-y": `${destination.y}px` } as CSSProperties;

  return <div ref={stageRef} className={`draw-show draw-show-stage ${overview ? "draw-show-overview-mode" : ""}`} style={{ backgroundImage: `url(${liveDrawStage})`, ...motionStyle }}>
    {!session ? <div className="draw-show-waiting"><strong>Wachten op de live loting</strong></div> : <>
      <div className="draw-show-phase">{session.phaseName} · {session.history.length}/{session.containers.reduce((sum, item) => sum + item.capacity, 0)}</div>
      {overview ? <>
        <div className="draw-show-group-overview">{session.containers.map((container) => <div key={container.id} className={focusId === container.id ? "is-active" : ""}><strong>{container.name}</strong><span>{container.teamIds.length}/{container.capacity}</span></div>)}</div>
        <div className="draw-show-wing draw-show-wing-right draw-show-active-group">{focus && renderContainer(focus)}</div>
      </> : <>
        <div className="draw-show-wing draw-show-wing-left">{session.containers.slice(0, splitAt).map(renderContainer)}</div>
        <div className="draw-show-wing draw-show-wing-right">{session.containers.slice(splitAt).map(renderContainer)}</div>
      </>}
      <main className="draw-show-center">
        <div className="draw-show-team-card">
          {pending && team && selectionPhase !== "transfer" && selectionPhase !== "complete" && <div key={pending.teamId} className="draw-show-team draw-reveal-name">{teamContent}</div>}
        </div>
        {pending && selectionPhase !== "complete" && <div className="draw-show-eligible draw-reveal-name"><div className="draw-show-eligible-groups">{eligible.map((option) => <span key={option.id} className={spotlightId === option.id || selectedId === option.id ? "is-spotlight" : ""}>{option.label}</span>)}</div></div>}
      </main>
      {selectionPhase === "transfer" && team && <div className="draw-show-transfer" key={`${team.id}-${selectedId}`}>{teamContent}</div>}
      <div className="draw-show-bowl" aria-label={`${remainingIds.length} ballen resterend`}>
        {remainingIds.map((id, index) => {
          const row = Math.floor(index / 7);
          const column = index % 7;
          return <span key={id} className="draw-show-bowl-ball" style={{ left: `${28 + column * 7 + (row % 2 ? 2 : 0)}%`, top: `${82 - row * 8 + Math.abs(column - 3) * -1.4}%`, "--drift-delay": `${-index * .37}s`, zIndex: index + 1 } as CSSProperties} />;
        })}
      </div>
      {pending && !selectedId && <span key={`flight-${pending.teamId}`} className="draw-show-flying-ball" aria-hidden="true"><span className="draw-ball-half draw-ball-left" /><span className="draw-ball-half draw-ball-right" /></span>}
      <div className="draw-show-pot"><strong>{activePot?.name ?? (session.finished ? "LOTING AFGEROND" : "ALLE TEAMS")}</strong><div className="draw-show-pot-teams" aria-label="Resterende teams in actieve pot">{remainingIds.map((id) => { const item = session.teams.find((candidate) => candidate.id === id); return <span key={id}>{item?.logoUrl && <img src={item.logoUrl} alt="" />}{item?.name}</span>; })}</div></div>
    </>}
    {controls}
  </div>;
}
