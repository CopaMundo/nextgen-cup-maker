import { useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useDrawPlayback } from "@/hooks/useDrawPlayback";
import type { DrawSessionState } from "@/lib/drawSession";
import { calculateGroupLayout, calculateWingDensity, drawChoiceGrid, drawOverviewPage, stageSelection, sweepSpotlight, type DrawPresentation } from "@/lib/drawPresentation";
import { alphabeticalTeamIds, opponentRevealDuration, roundsTeamComplete } from "@/lib/roundsDrawPresentation";
import { House, Plane } from "lucide-react";
import CountryFlag from "@/components/CountryFlag";
import { countryToFlagUrl } from "@/lib/countryFlags";
import { AutoTrimLogo } from "@/components/draw/AutoTrimLogo";
import { RoundsRosterLoop } from "@/components/draw/RoundsRosterLoop";
import { studioFor } from "@/lib/drawStudio";
import { DrawBalls } from "@/components/draw/DrawBalls";
import { FittedPotName } from "@/components/draw/FittedPotName";


export function DrawShow({ session: incomingSession, spotlightId: incomingSpotlight, presentation: incomingPresentation, controls }: {
  session?: DrawSessionState | null;
  spotlightId?: string | null;
  presentation?: DrawPresentation;
  controls?: ReactNode;
}) {
  const { session, spotlightId, presentation, now, revealKey, revealElapsed, revealing } = useDrawPlayback({ session: incomingSession ?? undefined, spotlightId: incomingSpotlight ?? null, presentation: incomingPresentation });
  const ballClock = useRef(revealElapsed);
  ballClock.current = revealElapsed;
  const revealAnimations = useRef<Animation[]>([]);
  const stageRef = useRef<HTMLDivElement>(null);
  const ledArcId = `draw-pot-${useId().replace(/:/g, "")}`;
  const studio = studioFor(presentation?.theme);
  const [destination, setDestination] = useState({ x: 0, y: 0, width: 0, height: 0, logo: "1.5cqw", name: ".82cqw" });
  useLayoutEffect(() => {
    revealAnimations.current = stageRef.current ? Array.from(stageRef.current.querySelectorAll<HTMLElement>(".draw-reveal-name")).flatMap(element => element.getAnimations()) : [];
    revealAnimations.current.forEach(animation => animation.pause());
  }, [revealKey]);
  useLayoutEffect(() => {
    revealAnimations.current.forEach(animation => { animation.currentTime = revealElapsed; });
  }, [revealElapsed]);
  const selectionPhase = stageSelection(presentation, now);
  const activeSpotlight = sweepSpotlight(presentation, now) ?? spotlightId;
  const pending = session?.pending;
  const rounds = presentation?.rounds;
  const selectedId = presentation?.selection?.targetId;
  const flagBackdrop = (country?: string | null) => presentation?.flagBackdrops !== false && country ? <span className="draw-show-flag-backdrop" aria-hidden="true"><svg className="draw-show-flag" viewBox="3 5 30 26" preserveAspectRatio="none"><image href={countryToFlagUrl(country) ?? undefined} width="36" height="36" /></svg></span> : null;
  const teamById = useMemo(() => new Map(session?.teams.map(item => [item.id, item])), [session?.teams]);
  const team = pending ? teamById.get(pending.teamId) : undefined;
  const teamReady = !revealing;
  const [choicesReady, setChoicesReady] = useState(false);
  useLayoutEffect(() => {
    setChoicesReady(false);
    if (revealing || !revealKey) return;
    const timer = window.setTimeout(() => setChoicesReady(true), 550 / (presentation?.speed ?? 1));
    return () => window.clearTimeout(timer);
  }, [revealing, revealKey, presentation?.speed]);
  const last = session?.history[session.history.length - 1];
  const eligible = selectedId ? pending?.options.filter((option) => option.id === selectedId) ?? [] : pending?.options ?? [];
  const { layout, leftContainers, rightContainers, leftDensity, rightDensity } = useMemo(() => {
    const containers = session?.containers ?? [];
    const layout = calculateGroupLayout(containers);
    const splitAt = Math.ceil(containers.length / 2);
    const leftContainers = containers.slice(0, splitAt), rightContainers = containers.slice(splitAt);
    return { layout, leftContainers, rightContainers, leftDensity: calculateWingDensity(leftContainers, layout), rightDensity: calculateWingDensity(rightContainers, layout) };
  }, [session?.containers]);
  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage || !selectedId) return;
    const measure = () => {
      const slot = stage.querySelector<HTMLElement>("[data-transfer-target='true']");
      if (!slot) return;
      const rect = stage.getBoundingClientRect();
      const target = slot.getBoundingClientRect();
      const next = { x: target.left + target.width / 2 - rect.left - rect.width / 2, y: target.top + target.height / 2 - rect.top - rect.height * .42, width: target.width, height: target.height, logo: getComputedStyle(slot.querySelector(".draw-show-slot-mark") ?? slot).width, name: getComputedStyle(slot.querySelector(".draw-show-slot-name") ?? slot).fontSize };
      setDestination(previous => Object.keys(next).every(key => previous[key as keyof typeof previous] === next[key as keyof typeof next]) ? previous : next);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(stage);
    const target = stage.querySelector<HTMLElement>("[data-transfer-target='true']");
    if (target) observer.observe(target);
    return () => observer.disconnect();
  }, [selectedId, pending?.teamId, session?.containers, layout.mode, layout.teamColumns, layout.wingRows, leftDensity, rightDensity]);

  const { activePot, remainingIds, potTeamIds, rosterIds } = useMemo(() => {
    const remaining = new Set(session?.remaining ?? []);
    const activePot = session?.mode === "pots" ? session.pots.find(pot => pot.id === (presentation?.activePotId ?? session.activePotId)) ?? session.pots.find(pot => pot.teamIds.some(id => remaining.has(id))) : null;
    const allIds = session?.teams.map(item => item.id) ?? [];
    return {
      activePot,
      remainingIds: (activePot ? activePot.teamIds : session?.remaining ?? []).filter(id => remaining.has(id) && id !== pending?.teamId),
      potTeamIds: alphabeticalTeamIds(activePot?.teamIds ?? allIds, session?.teams ?? []),
      rosterIds: alphabeticalTeamIds(session?.mode === "pots" ? activePot?.teamIds ?? session.pots[0]?.teamIds ?? [] : allIds, session?.teams ?? []),
    };
  }, [session?.mode, session?.pots, session?.remaining, session?.teams, session?.activePotId, presentation?.activePotId, pending?.teamId]);
  const overviewTick = Math.floor(now / 5000);
  const { pageIndex, teamIds: visiblePotIds } = useMemo(() => drawOverviewPage(potTeamIds, overviewTick * 5000), [potTeamIds, overviewTick]);
  const potMaxColumns = visiblePotIds.length > 8 ? 8 : 4;
  const potRows = Math.max(1, Math.ceil(visiblePotIds.length / potMaxColumns));
  const potColumns = Math.max(1, Math.ceil(visiblePotIds.length / potRows));
   const potGridStyle = { "--pot-columns": potColumns, "--pot-slot-height": `${Math.min(1.8, 5.6 / potRows - .25)}cqw`, "--pot-cell-width": potColumns > 4 ? "5cqw" : potColumns === 4 ? "10cqw" : "12cqw", "--pot-name-size": potColumns > 4 ? ".62cqw" : ".74cqw", "--pot-logo-size": potColumns > 4 ? "1.1cqw" : "1.45cqw", "--pot-cell-gap": potColumns > 4 ? ".18cqw" : ".3cqw" } as CSSProperties;
  const renderContainer = (container: DrawSessionState["containers"][number]) => (
    <section key={container.id} data-group-id={container.id} data-team-columns={layout.teamColumns} style={{ "--group-slot-rows": Math.max(1, Math.ceil(container.capacity / layout.teamColumns)) } as CSSProperties} className={`draw-show-group-card ${container.id === selectedId || container.id === activeSpotlight || (!pending && last?.targetId === container.id) ? "is-placed" : ""}`}>
      <h2>{container.name}</h2>
      <div className="draw-show-slots" style={{ "--slot-columns": layout.teamColumns, "--slot-rows": Math.max(1, Math.ceil(container.capacity / layout.teamColumns)) } as CSSProperties}>
        {Array.from({ length: container.capacity }, (_, index) => {
          const placed = teamById.get(container.teamIds[index]);
          return <div key={index} className={`draw-show-slot ${!pending && last?.teamId === placed?.id && last?.targetId === container.id ? "is-arriving" : ""}`} title={placed?.name} aria-label={placed?.name} data-transfer-target={container.id === selectedId && index === container.teamIds.length}>
            {flagBackdrop(placed?.country)}
            <span className="draw-show-slot-mark">{placed?.logoUrl ? <AutoTrimLogo src={placed.logoUrl} /> : placed?.name.slice(0, 2).toUpperCase()}</span>
            {layout.mode !== "C" && <span className="draw-show-slot-name">{placed?.name ?? ""}</span>}
          </div>;
        })}
      </div>
    </section>
  );
  // Static wings never reconcile on playback ticks; only identity/selection changes do.
  const leftCards = useMemo(() => leftContainers.map(renderContainer), [leftContainers, teamById, layout, selectedId, activeSpotlight, pending?.teamId, last, presentation?.flagBackdrops]);
  const rightCards = useMemo(() => rightContainers.map(renderContainer), [rightContainers, teamById, layout, selectedId, activeSpotlight, pending?.teamId, last, presentation?.flagBackdrops]);
   const teamContent = team && <span className="draw-show-team-identity"><span className="draw-show-reveal-logo">{team.logoUrl ? <AutoTrimLogo src={team.logoUrl} className="draw-show-team-logo" /> : team.name.slice(0, 2).toUpperCase()}</span><strong>{team.name}</strong><CountryFlag country={team.country} className="draw-show-identity-flag" /></span>;
   const footLabel = rounds ? `${rounds.groupName}${activePot ? ` · ${activePot.name}` : ""}` : activePot?.name ?? session?.phaseName;
   const drawnCount = potTeamIds.filter((id) => rounds ? rounds.drawnTeamIds.includes(id) : !session?.remaining.includes(id)).length;
  const potCards = useMemo(() => visiblePotIds.map((id) => { const item = teamById.get(id); const drawn = !remainingIds.includes(id) && (id !== pending?.teamId || teamReady); return <span key={id} className={drawn ? "is-drawn" : ""} title={`${item?.name ?? ""}${drawn ? " · Getrokken" : ""}`}><span className="draw-show-pot-logo">{item?.logoUrl && <AutoTrimLogo src={item.logoUrl} />}</span><FittedPotName name={item?.name ?? ""} /></span>; }), [visiblePotIds, teamById, remainingIds, pending?.teamId, teamReady]);
  const speed = presentation?.speed ?? 1;
  const transferElapsed = useMemo(() => selectionPhase === "transfer" && presentation?.selection ? Math.max(0, Date.now() - presentation.selection.startedAt - 850 / speed) : 0, [selectionPhase, presentation?.selection?.startedAt, speed]);
  const { columns: choiceColumns } = drawChoiceGrid(pending?.options.length ?? 1);
   const motionStyle = { "--draw-choice-width": `${Math.min(8, (20 - .16 * (choiceColumns - 1)) / choiceColumns)}cqw`, "--draw-rate": speed, "--reveal-offset": "0ms", "--transfer-offset": `${-transferElapsed}ms`, "--transfer-x": `${destination.x}px`, "--transfer-y": `${destination.y}px`, "--transfer-width": `${destination.width}px`, "--transfer-height": `${destination.height}px`, "--landing-logo-size": destination.logo, "--landing-name-size": destination.name } as CSSProperties;

  return <div ref={stageRef} data-studio-theme={studio.id} data-group-layout={rounds ? undefined : layout.mode} className={`draw-show draw-show-stage ${rounds ? "" : `draw-show-layout-${layout.mode}`}`} style={{ backgroundImage: `url(${studio.asset.url})`, "--wing-columns": layout.wingColumns, "--wing-rows": layout.wingRows, ...motionStyle } as CSSProperties}>
    {!session ? <div className="draw-show-waiting"><strong>Wachten op de live loting</strong></div> : <>
      {rounds ? <>
        <section className="draw-show-rounds-roster draw-show-wing-left draw-show-group-card" aria-label={`Teams ${rounds.groupName}`}>
          <h2>{rounds.groupName}{session.mode === "pots" && <small> · {activePot?.name ?? session.pots[0]?.name}</small>}</h2>
          <RoundsRosterLoop rosterKey={`${rounds.groupName}-${activePot?.id ?? "all"}`}>
            <div className="draw-show-rounds-teams">
              {rosterIds.map((id) => {
                const item = teamById.get(id);
                const entry = rounds.roster?.find((candidate) => candidate.teamId === id);
                const complete = roundsTeamComplete(entry, now, presentation?.speed ?? 1) && (id !== pending?.teamId || teamReady);
                return <div key={id} data-team-id={id} data-complete={complete} className={`draw-show-slot draw-show-rounds-roster-team ${complete ? "is-complete" : "is-inactive"}`}>
                  {flagBackdrop(item?.country)}
                  <span className="draw-show-slot-mark draw-show-rounds-club-logo">{item?.logoUrl ? <AutoTrimLogo src={item.logoUrl} /> : item?.name.slice(0, 2).toUpperCase()}</span>
                  <div className="draw-show-rounds-roster-identity"><span className="draw-show-slot-name">{item?.name}</span></div>
                  <div className="draw-show-rounds-opponent-badges">{complete && entry?.opponents.map((opponent) => {
                    const opponentTeam = teamById.get(opponent.opponentId);
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
            {rounds.fixtures.map((fixture) => { const finished = teamReady && (!fixture.revealAt || now >= fixture.revealAt + opponentRevealDuration / (presentation?.speed ?? 1)); const opponent = finished ? teamById.get(fixture.opponentId ?? "") : undefined; return <div key={`${pending?.teamId}-${fixture.id}`} className={`draw-show-rounds-fixture draw-show-slot ${opponent ? "is-known" : ""}`}>
               {flagBackdrop(opponent?.country)}
              {session.mode === "pots" && <span className="draw-show-rounds-pot-tag">{fixture.potName}</span>}
              <span className="draw-show-slot-mark">{opponent?.logoUrl ? <AutoTrimLogo src={opponent.logoUrl} /> : opponent?.name.slice(0, 2).toUpperCase()}</span>
              <span className="draw-show-rounds-opponent-identity"><span className="draw-show-slot-name">{opponent?.name ?? "—"}</span>{opponent && <CountryFlag country={opponent.country} className="draw-show-rounds-flag" />}</span>
              {opponent && <span className="draw-show-rounds-venue" aria-label={fixture.home ? "Thuis" : "Uit"} title={fixture.home ? "Thuis" : "Uit"}>{fixture.home ? <House /> : <Plane />}</span>}
            </div>; })}
          </div>
        </section>
      </> : <>
        <div className="draw-show-wing draw-show-wing-left" data-wing-columns={layout.wingColumns} data-density={leftDensity} style={{ "--wing-rows": Math.max(1, Math.ceil(leftContainers.length / layout.wingColumns)), "--wing-slot-rows": Math.max(1, ...leftContainers.map((container) => Math.ceil(container.capacity / layout.teamColumns))) } as CSSProperties}>{leftCards}</div>
        <div className="draw-show-wing draw-show-wing-right" data-wing-columns={layout.wingColumns} data-density={rightDensity} style={{ "--wing-rows": Math.max(1, Math.ceil(rightContainers.length / layout.wingColumns)), "--wing-slot-rows": Math.max(1, ...rightContainers.map((container) => Math.ceil(container.capacity / layout.teamColumns))) } as CSSProperties}>{rightCards}</div>
      </>}
      <main className="draw-show-center">
        {pending && team && selectionPhase !== "transfer" && selectionPhase !== "complete" && <div key={revealKey ?? pending.teamId} className="draw-show-team-card draw-reveal-name">
          <div className="draw-show-team">{teamContent}</div>
        </div>}
        {!rounds && pending && choicesReady && teamReady && selectionPhase !== "complete" && <div key={pending.teamId} className={`draw-show-eligible ${selectedId ? "has-selection" : ""}`}><div className="draw-show-eligible-groups" style={{ "--eligible-columns": drawChoiceGrid(eligible.length).columns } as CSSProperties}>{eligible.map((option) => <span key={option.id} title={option.label} aria-label={option.label} className={activeSpotlight === option.id || selectedId === option.id ? "is-spotlight" : ""}>{eligible.length > 18 ? option.label.replace(/^(groep|group|poule)\s+/i, "") : option.label}</span>)}</div></div>}
      </main>
      {selectionPhase === "transfer" && team && <div className={`draw-show-transfer ${layout.mode === "C" ? "is-logo-only" : ""}`} key={`${team.id}-${selectedId}`}><div className="draw-transfer-slot draw-show-team">{flagBackdrop(team.country)}<span className="draw-show-slot-mark">{team.logoUrl ? <AutoTrimLogo src={team.logoUrl} /> : team.name.slice(0, 2).toUpperCase()}</span><span className="draw-show-slot-name">{team.name}</span><CountryFlag country={team.country} className="draw-show-identity-flag" /></div></div>}
      <div className="draw-show-bowl" aria-label={`${remainingIds.length} ballen resterend`}><img src={studio.bowl} alt="" className="draw-show-bowl-art" /></div>
      <DrawBalls key={activePot?.id ?? rounds?.groupName ?? "all"} clock={ballClock} teamIds={remainingIds} drawnId={pending?.teamId} revealKey={revealKey} elapsed={revealElapsed} speed={speed} revealing={revealing} theme={studio.id} />
      <svg className="draw-show-pot-label" viewBox="0 0 600 100" role="img" aria-label={footLabel}><defs><path id={`${ledArcId}-pot`} d="M 20 46 Q 300 90 580 46" /></defs><text textAnchor="middle"><textPath href={`#${ledArcId}-pot`} startOffset="50%">{footLabel}</textPath></text></svg><div className="draw-show-pot-counter">{drawnCount}/{potTeamIds.length}</div><div className="draw-show-pot"><div key={`${rounds?.groupName}-${activePot?.id}-${pageIndex}`} className="draw-show-pot-teams" style={potGridStyle} aria-label="Clubs in actieve pot">{potCards}</div></div>
    </>}
    {controls}
  </div>;
}
