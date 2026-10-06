import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { DrawSessionState } from "@/lib/drawSession";
import { needsGroupOverview, stageSelection, sweepSpotlight, type DrawPresentation } from "@/lib/drawPresentation";
import CountryFlag from "@/components/CountryFlag";
import { AutoTrimLogo } from "@/components/draw/AutoTrimLogo";
import liveDrawStage from "@/assets/live-draw-raised-bowl-stage.png";

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
  const activeSpotlight = sweepSpotlight(presentation, now) ?? spotlightId;
  const pending = session?.pending;
  const selectedId = presentation?.selection?.targetId;
  const team = session?.teams.find((item) => item.id === pending?.teamId);
  const last = session?.history[session.history.length - 1];
  const eligible = selectedId ? pending?.options.filter((option) => option.id === selectedId) ?? [] : pending?.options ?? [];
  const overview = needsGroupOverview(session?.containers ?? []);
  const focusId = selectedId ?? activeSpotlight ?? pending?.options[0]?.id ?? last?.targetId ?? session?.containers[0]?.id;
  const focus = session?.containers.find((container) => container.id === focusId);
  useLayoutEffect(() => {
    const stage = stageRef.current;
    const slot = stage?.querySelector<HTMLElement>("[data-transfer-target='true']");
    if (!stage || !slot) return;
    if (overview && slot.parentElement) {
      const list = slot.parentElement;
      list.scrollTop = Math.max(0, slot.offsetTop - list.offsetTop - list.clientHeight / 2);
    }
    const rect = stage.getBoundingClientRect();
    const target = slot.getBoundingClientRect();
    setDestination({ x: target.left + target.width / 2 - rect.left - rect.width / 2, y: target.top + target.height / 2 - rect.top - rect.height * .44 });
  }, [selectedId, focusId, overview]);

  const activePot = session?.mode === "pots"
    ? session.pots.find((pot) => pot.id === (presentation?.activePotId ?? session.activePotId)) ?? session.pots.find((pot) => pot.teamIds.some((id) => session.remaining.includes(id)))
    : null;
  const remainingIds = (activePot ? activePot.teamIds : session?.remaining ?? [])
    .filter((id) => session?.remaining.includes(id) && id !== pending?.teamId);
  const potTeamIds = activePot?.teamIds ?? session?.teams.map((item) => item.id) ?? [];
  const potMaxColumns = potTeamIds.length > 16 ? 8 : 4;
  const potRows = Math.max(1, Math.ceil(potTeamIds.length / potMaxColumns));
  const potColumns = Math.max(1, Math.ceil(potTeamIds.length / potRows));
  const potGridStyle = { "--pot-columns": potColumns, "--pot-cell-width": potColumns > 4 ? "4.9cqw" : "9.2cqw", "--pot-name-size": potColumns > 4 ? ".56cqw" : ".74cqw", "--pot-logo-size": potColumns > 4 ? "1.05cqw" : "1.45cqw" } as CSSProperties;
  const splitAt = Math.ceil((session?.containers.length ?? 0) / 2);
  const renderContainer = (container: DrawSessionState["containers"][number]) => (
    <section key={container.id} className={`draw-show-group-card ${container.id === selectedId || (!pending && last?.targetId === container.id) ? "is-placed" : ""}`}>
      <h2>{container.name}</h2>
      <div className="draw-show-slots" style={{ "--slot-columns": 1 } as CSSProperties}>
        {Array.from({ length: container.capacity }, (_, index) => {
          const placed = session?.teams.find((item) => item.id === container.teamIds[index]);
          return <div key={index} className="draw-show-slot" data-transfer-target={container.id === selectedId && index === container.teamIds.length}>
            <span className="draw-show-slot-mark">{placed?.logoUrl && <AutoTrimLogo src={placed.logoUrl} />}</span>
            <span className="draw-show-slot-name" title={placed?.name}>{placed?.name ?? ""}</span>
          </div>;
        })}
      </div>
    </section>
  );
  const teamContent = team && <><span className="draw-show-team-identity"><span className="draw-show-reveal-logo">{team.logoUrl && <AutoTrimLogo src={team.logoUrl} className="draw-show-team-logo" />}</span><strong>{team.name}</strong></span>{team.country && <span className="draw-show-flag-backdrop" aria-hidden="true"><CountryFlag country={team.country} className="draw-show-flag" /></span>}</>;
  const speed = presentation?.speed ?? 1;
  const elapsed = useMemo(() => presentation?.revealAt ? Math.max(0, Date.now() - presentation.revealAt) : 0, [presentation?.revealAt, pending?.teamId, speed]);
  const transferElapsed = useMemo(() => selectionPhase === "transfer" && presentation?.selection ? Math.max(0, Date.now() - presentation.selection.startedAt - 850 / speed) : 0, [selectionPhase, presentation?.selection?.startedAt, speed]);
  const motionStyle = { "--draw-rate": speed, "--reveal-offset": `${-elapsed}ms`, "--transfer-offset": `${-transferElapsed}ms`, "--transfer-x": `${destination.x}px`, "--transfer-y": `${destination.y}px` } as CSSProperties;

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
        {pending && selectionPhase !== "complete" && <div className="draw-show-eligible draw-reveal-name"><div className="draw-show-eligible-groups">{eligible.map((option) => <span key={option.id} className={activeSpotlight === option.id || selectedId === option.id ? "is-spotlight" : ""}>{option.label}</span>)}</div></div>}
      </main>
      {selectionPhase === "transfer" && team && <div className="draw-show-transfer" key={`${team.id}-${selectedId}`}>{teamContent}</div>}
      <div className="draw-show-bowl" aria-label={`${remainingIds.length} ballen resterend`}>
        {remainingIds.map((id, index) => {
          const columns = remainingIds.length > 49 ? 10 : 6;
          const row = Math.floor(index / columns);
          const column = index % columns;
          const totalRows = Math.ceil(remainingIds.length / columns);
          return <span key={id} className="draw-show-bowl-ball" style={{ left: `${27 + column * 46 / columns + (row % 2 ? 1 : 0)}%`, top: `${84 - row * Math.min(8, 38 / totalRows)}%`, "--drift-delay": `${-index * .37}s`, "--ball-size": remainingIds.length > 49 ? ".45cqw" : ".8cqw", zIndex: index + 1 } as CSSProperties} />;
        })}
      </div>
      {pending && !selectedId && <span key={`flight-${pending.teamId}`} className="draw-show-flying-ball" aria-hidden="true"><span className="draw-ball-half draw-ball-left" /><span className="draw-ball-half draw-ball-right" /></span>}
      <strong className="draw-show-pot-label">{activePot?.name ?? (session.finished ? "LOTING AFGEROND" : "ALLE TEAMS")}</strong><div className="draw-show-pot"><div className="draw-show-pot-teams" style={potGridStyle} aria-label="Clubs in actieve pot">{potTeamIds.map((id) => { const item = session.teams.find((candidate) => candidate.id === id); const drawn = !remainingIds.includes(id); return <span key={id} className={drawn ? "is-drawn" : ""} title={`${item?.name ?? ""}${drawn ? " · Getrokken" : ""}`}><span className="draw-show-pot-logo">{item?.logoUrl && <AutoTrimLogo src={item.logoUrl} />}</span><span className="draw-show-pot-name">{item?.name}</span></span>; })}</div></div>
    </>}
    {controls}
  </div>;
}
