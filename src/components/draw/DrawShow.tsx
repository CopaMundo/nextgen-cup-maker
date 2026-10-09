import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { DrawSessionState } from "@/lib/drawSession";
import { calculateGroupLayout, calculateWingDensity, revealDuration, stageSelection, sweepSpotlight, type DrawPresentation } from "@/lib/drawPresentation";
import { alphabeticalTeamIds, opponentRevealDuration, roundsTeamComplete } from "@/lib/roundsDrawPresentation";
import { House, Plane } from "lucide-react";
import CountryFlag from "@/components/CountryFlag";
import { AutoTrimLogo } from "@/components/draw/AutoTrimLogo";
import { RoundsRosterLoop } from "@/components/draw/RoundsRosterLoop";
import liveDrawStageAsset from "@/assets/live-draw-studio-4k.webp.asset.json";

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
  const rounds = presentation?.rounds;
  const selectedId = presentation?.selection?.targetId;
  const team = session?.teams.find((item) => item.id === pending?.teamId);
  const teamReady = !presentation?.revealAt || now >= presentation.revealAt + revealDuration(presentation.speed);
  const last = session?.history[session.history.length - 1];
  const eligible = selectedId ? pending?.options.filter((option) => option.id === selectedId) ?? [] : pending?.options ?? [];
  const layout = calculateGroupLayout(session?.containers ?? []);
  const splitAt = Math.ceil((session?.containers.length ?? 0) / 2);
  const leftContainers = session?.containers.slice(0, splitAt) ?? [];
  const rightContainers = session?.containers.slice(splitAt) ?? [];
  const leftDensity = calculateWingDensity(leftContainers, layout);
  const rightDensity = calculateWingDensity(rightContainers, layout);
  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const measure = () => {
      const slot = stage.querySelector<HTMLElement>("[data-transfer-target='true']");
      if (!slot) return;
      const rect = stage.getBoundingClientRect();
      const target = slot.getBoundingClientRect();
      setDestination({ x: target.left + target.width / 2 - rect.left - rect.width / 2, y: target.top + target.height / 2 - rect.top - rect.height * .44 });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(stage);
    const target = stage.querySelector<HTMLElement>("[data-transfer-target='true']");
    if (target) observer.observe(target);
    return () => observer.disconnect();
  }, [selectedId, pending?.teamId, session?.containers, layout.mode, layout.teamColumns, layout.wingRows, leftDensity, rightDensity]);

  const activePot = session?.mode === "pots"
    ? session.pots.find((pot) => pot.id === (presentation?.activePotId ?? session.activePotId)) ?? session.pots.find((pot) => pot.teamIds.some((id) => session.remaining.includes(id)))
    : null;
  const remainingIds = (activePot ? activePot.teamIds : session?.remaining ?? [])
    .filter((id) => session?.remaining.includes(id) && id !== pending?.teamId);
  const potTeamIds = alphabeticalTeamIds(activePot?.teamIds ?? session?.teams.map((item) => item.id) ?? [], session?.teams ?? []);
  const rosterIds = alphabeticalTeamIds(session?.mode === "pots" ? activePot?.teamIds ?? session?.pots[0]?.teamIds ?? [] : session?.teams.map((item) => item.id) ?? [], session?.teams ?? []);
  const potMaxColumns = potTeamIds.length > 16 ? 8 : 4;
  const potRows = Math.max(1, Math.ceil(potTeamIds.length / potMaxColumns));
  const potColumns = Math.max(1, Math.ceil(potTeamIds.length / potRows));
  const potGridStyle = { "--pot-columns": potColumns, "--pot-cell-width": potColumns > 4 ? "5cqw" : potColumns === 4 ? "10cqw" : "12cqw", "--pot-name-size": potColumns > 4 ? ".5cqw" : ".74cqw", "--pot-name-lines": potColumns > 4 ? 3 : 2, "--pot-logo-size": potColumns > 4 ? ".95cqw" : "1.45cqw", "--pot-cell-gap": potColumns > 4 ? ".18cqw" : ".3cqw" } as CSSProperties;
  const renderContainer = (container: DrawSessionState["containers"][number]) => (
    <section key={container.id} data-group-id={container.id} data-team-columns={layout.teamColumns} style={{ "--group-slot-rows": Math.max(1, Math.ceil(container.capacity / layout.teamColumns)) } as CSSProperties} className={`draw-show-group-card ${container.id === selectedId || container.id === activeSpotlight || (!pending && last?.targetId === container.id) ? "is-placed" : ""}`}>
      <h2>{container.name}</h2>
      <div className="draw-show-slots" style={{ "--slot-columns": layout.teamColumns, "--slot-rows": Math.max(1, Math.ceil(container.capacity / layout.teamColumns)) } as CSSProperties}>
        {Array.from({ length: container.capacity }, (_, index) => {
          const placed = session?.teams.find((item) => item.id === container.teamIds[index]);
          return <div key={index} className="draw-show-slot" title={placed?.name} aria-label={placed?.name} data-transfer-target={container.id === selectedId && index === container.teamIds.length}>
            <span className="draw-show-slot-mark">{placed?.logoUrl ? <AutoTrimLogo src={placed.logoUrl} /> : placed?.name.slice(0, 2).toUpperCase()}</span>
            {layout.mode !== "C" && <span className="draw-show-slot-name">{placed?.name ?? ""}</span>}
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

  return <div ref={stageRef} data-group-layout={rounds ? undefined : layout.mode} className={`draw-show draw-show-stage ${rounds ? "" : `draw-show-layout-${layout.mode}`}`} style={{ backgroundImage: `url(${liveDrawStageAsset.url})`, "--wing-columns": layout.wingColumns, "--wing-rows": layout.wingRows, ...motionStyle } as CSSProperties}>
    {!session ? <div className="draw-show-waiting"><strong>Wachten op de live loting</strong></div> : <>
      <div className="draw-show-phase">{session.phaseName} · {rounds ? `${rounds.groupName} · ${rounds.drawnTeamIds.length}/${session.teams.length}` : `${session.history.length}/${session.containers.reduce((sum, item) => sum + item.capacity, 0)}`}</div>
      {rounds ? <>
        <section className="draw-show-rounds-roster draw-show-wing-left draw-show-group-card" aria-label={`Teams ${rounds.groupName}`}>
          <h2>{rounds.groupName}{session.mode === "pots" && <small> · {activePot?.name ?? session.pots[0]?.name}</small>}</h2>
          <RoundsRosterLoop rosterKey={`${rounds.groupName}-${activePot?.id ?? "all"}`}>
            <div className="draw-show-rounds-teams">
              {rosterIds.map((id) => {
                const item = session.teams.find((candidate) => candidate.id === id);
                const entry = rounds.roster?.find((candidate) => candidate.teamId === id);
                const complete = roundsTeamComplete(entry, now, presentation?.speed ?? 1) && (id !== pending?.teamId || teamReady);
                return <div key={id} data-team-id={id} data-complete={complete} className={`draw-show-slot draw-show-rounds-roster-team ${complete ? "is-complete" : "is-inactive"}`}>
                  <span className="draw-show-slot-mark draw-show-rounds-club-logo">{item?.logoUrl ? <AutoTrimLogo src={item.logoUrl} /> : item?.name.slice(0, 2).toUpperCase()}</span>
                  <div className="draw-show-rounds-roster-identity"><span className="draw-show-slot-name">{item?.name}</span></div>
                  <div className="draw-show-rounds-opponent-badges">{complete && entry?.opponents.map((opponent) => {
                    const opponentTeam = session.teams.find((candidate) => candidate.id === opponent.opponentId);
                    return <span key={opponent.id} className="draw-show-slot-mark" title={opponentTeam?.name} aria-label={opponentTeam?.name}>{opponentTeam?.logoUrl ? <AutoTrimLogo src={opponentTeam.logoUrl} /> : opponentTeam?.name.slice(0, 2).toUpperCase()}</span>;
                  })}</div>
                </div>;
              })}
            </div>
          </RoundsRosterLoop>
        </section>
        <section className="draw-show-rounds-schedule draw-show-wing-right draw-show-group-card" aria-label="Speelschema getrokken team">
          <div className="draw-show-rounds-team-header">
            {team && teamReady && <><span className="draw-show-slot-mark">{team.logoUrl ? <AutoTrimLogo src={team.logoUrl} /> : team.name.slice(0, 2).toUpperCase()}</span><div><strong>{team.name}</strong>{session.mode === "pots" && <small>{activePot?.name}</small>}</div><CountryFlag country={team.country} className="draw-show-rounds-header-flag" /></>}
          </div>
          <div className={`draw-show-rounds-fixtures ${rounds.fixtures.length > 10 ? "is-two-columns" : ""}`} style={{ "--fixture-rows": Math.max(1, Math.ceil(rounds.fixtures.length / (rounds.fixtures.length > 10 ? 2 : 1))) } as CSSProperties}>
            {rounds.fixtures.map((fixture) => { const finished = teamReady && (!fixture.revealAt || now >= fixture.revealAt + opponentRevealDuration / (presentation?.speed ?? 1)); const opponent = finished ? session.teams.find((item) => item.id === fixture.opponentId) : undefined; return <div key={`${pending?.teamId}-${fixture.id}`} className={`draw-show-rounds-fixture draw-show-slot ${opponent ? "is-known" : ""}`}>
              {session.mode === "pots" && <span className="draw-show-rounds-pot-tag">{fixture.potName}</span>}
              <span className="draw-show-slot-mark">{opponent?.logoUrl ? <AutoTrimLogo src={opponent.logoUrl} /> : opponent?.name.slice(0, 2).toUpperCase()}</span>
              <span className="draw-show-rounds-opponent-identity"><span className="draw-show-slot-name">{opponent?.name ?? "—"}</span>{opponent && <CountryFlag country={opponent.country} className="draw-show-rounds-flag" />}</span>
              {opponent && <span className="draw-show-rounds-venue" aria-label={fixture.home ? "Thuis" : "Uit"} title={fixture.home ? "Thuis" : "Uit"}>{fixture.home ? <House /> : <Plane />}</span>}
            </div>; })}
          </div>
        </section>
      </> : <>
        <div className="draw-show-wing draw-show-wing-left" data-wing-columns={layout.wingColumns} data-density={leftDensity} style={{ "--wing-rows": Math.max(1, Math.ceil(leftContainers.length / layout.wingColumns)), "--wing-slot-rows": Math.max(1, ...leftContainers.map((container) => Math.ceil(container.capacity / layout.teamColumns))) } as CSSProperties}>{leftContainers.map(renderContainer)}</div>
        <div className="draw-show-wing draw-show-wing-right" data-wing-columns={layout.wingColumns} data-density={rightDensity} style={{ "--wing-rows": Math.max(1, Math.ceil(rightContainers.length / layout.wingColumns)), "--wing-slot-rows": Math.max(1, ...rightContainers.map((container) => Math.ceil(container.capacity / layout.teamColumns))) } as CSSProperties}>{rightContainers.map(renderContainer)}</div>
      </>}
      <main className="draw-show-center">
        <div className="draw-show-team-card">
          {pending && team && selectionPhase !== "transfer" && selectionPhase !== "complete" && <div key={pending.teamId} className="draw-show-team draw-reveal-name">{teamContent}</div>}
        </div>
        {!rounds && pending && selectionPhase !== "complete" && <div className="draw-show-eligible draw-reveal-name"><div className="draw-show-eligible-groups">{eligible.map((option) => <span key={option.id} className={activeSpotlight === option.id || selectedId === option.id ? "is-spotlight" : ""}>{option.label}</span>)}</div></div>}
      </main>
      {selectionPhase === "transfer" && team && <div className="draw-show-transfer" key={`${team.id}-${selectedId}`}>{teamContent}</div>}
      <div className="draw-show-bowl" aria-label={`${remainingIds.length} ballen resterend`}>
        {remainingIds.map((id, index) => {
          const columns = remainingIds.length > 49 ? 10 : 5;
          const row = Math.floor(index / columns);
          const column = index % columns;
          const totalRows = Math.ceil(remainingIds.length / columns);
          return <span key={id} className="draw-show-bowl-ball" style={{ left: `${24 + column * 52 / columns + (row % 2 ? 2 : 0)}%`, top: `${84 - row * Math.min(11, 40 / totalRows)}%`, "--drift-delay": `${-index * .37}s`, "--ball-size": remainingIds.length > 49 ? ".65cqw" : "1.15cqw", zIndex: index + 1 } as CSSProperties} />;
        })}
      </div>
      {pending && !selectedId && <span key={`flight-${pending.teamId}`} className="draw-show-flying-ball" aria-hidden="true"><span className="draw-ball-half draw-ball-left" /><span className="draw-ball-half draw-ball-right" /></span>}
      <strong className="draw-show-pot-label">{activePot?.name ?? (session.finished ? "LOTING AFGEROND" : "ALLE TEAMS")}</strong><div className="draw-show-pot"><div className="draw-show-pot-teams" style={potGridStyle} aria-label="Clubs in actieve pot">{potTeamIds.map((id) => { const item = session.teams.find((candidate) => candidate.id === id); const drawn = !remainingIds.includes(id); return <span key={id} className={drawn ? "is-drawn" : ""} title={`${item?.name ?? ""}${drawn ? " · Getrokken" : ""}`}><span className="draw-show-pot-logo">{item?.logoUrl && <AutoTrimLogo src={item.logoUrl} />}</span><span className="draw-show-pot-name">{item?.name}</span></span>; })}</div></div>
    </>}
    {controls}
  </div>;
}
