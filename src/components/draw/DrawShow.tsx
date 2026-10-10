import { useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useDrawPlayback } from "@/hooks/useDrawPlayback";
import type { DrawSessionState } from "@/lib/drawSession";
import { calculateGroupLayout, calculateWingDensity, drawOverviewPage, stageSelection, sweepSpotlight, type DrawPresentation } from "@/lib/drawPresentation";
import { alphabeticalTeamIds, opponentRevealDuration, roundsTeamComplete } from "@/lib/roundsDrawPresentation";
import { House, Plane } from "lucide-react";
import CountryFlag from "@/components/CountryFlag";
import { countryToFlagUrl } from "@/lib/countryFlags";
import { AutoTrimLogo } from "@/components/draw/AutoTrimLogo";
import { RoundsRosterLoop } from "@/components/draw/RoundsRosterLoop";
import { studioFor } from "@/lib/drawStudio";
import { DrawBalls } from "@/components/draw/DrawBalls";
import { FittedPotName } from "@/components/draw/FittedPotName";

import { balanceWallTitle, drawHeading, fitWallTitle } from "@/lib/drawHeading";

export function DrawShow({ session: incomingSession, spotlightId: incomingSpotlight, presentation: incomingPresentation, controls }: {
  session?: DrawSessionState | null;
  spotlightId?: string | null;
  presentation?: DrawPresentation;
  controls?: ReactNode;
}) {
  const { session, spotlightId, presentation, now, revealKey, revealElapsed, revealing } = useDrawPlayback({ session: incomingSession ?? undefined, spotlightId: incomingSpotlight ?? null, presentation: incomingPresentation });
  const stageRef = useRef<HTMLDivElement>(null);
  const wallTitleRef = useRef<HTMLSpanElement>(null);
  const [wallTitleSize, setWallTitleSize] = useState<number>();
  const [wallTitleText, setWallTitleText] = useState(presentation?.tournamentName || "COPA MUNDO");
  const [browserLanguage, setBrowserLanguage] = useState(navigator.language);
  const ledArcId = `draw-led-${useId().replace(/:/g, "")}`;
  const heading = drawHeading(presentation?.language ?? browserLanguage);
  const studio = studioFor(presentation?.theme);
  useLayoutEffect(() => {
    if (document.querySelector("link[data-draw-wall-font]")) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Montserrat:wght@500&display=swap";
    link.dataset.drawWallFont = "true";
    document.head.appendChild(link);
  }, []);
  useLayoutEffect(() => {
    const update = () => setBrowserLanguage(navigator.language);
    window.addEventListener("languagechange", update);
    return () => window.removeEventListener("languagechange", update);
  }, []);
  useLayoutEffect(() => {
    const title = wallTitleRef.current;
    const board = title?.parentElement;
    const stage = stageRef.current;
    if (!title || !board || !stage) return;
    const fit = () => {
      title.style.removeProperty("font-size");
      const maxSize = parseFloat(getComputedStyle(title).fontSize);
      const text = presentation?.tournamentName || "COPA MUNDO";
      const balanced = balanceWallTitle(text, board.clientWidth, (value) => {
        title.textContent = value;
        const naturalRange = document.createRange();
        naturalRange.selectNodeContents(title);
        // Temporarily prevent wrapping to measure the natural inscription width.
        title.style.whiteSpace = "nowrap";
        const width = naturalRange.getBoundingClientRect().width;
        title.style.removeProperty("white-space");
        return width;
      });
      title.textContent = balanced;
      setWallTitleText(balanced);
      const range = document.createRange();
      range.selectNodeContents(title);
      const header = board.parentElement;
      if (!header) return;
      const captions = Array.from(header.querySelectorAll<HTMLElement>(".draw-wall-caption"));
      const availableHeight = header.clientHeight - captions.reduce((height, caption) => height + caption.getBoundingClientRect().height, 0) - 2 * parseFloat(getComputedStyle(header).rowGap);
      const fitted = fitWallTitle(board.clientWidth, availableHeight, maxSize, (size) => {
        title.style.fontSize = `${size}px`;
        const rects = Array.from(range.getClientRects()).filter((rect) => rect.width > 0);
        const lines = new Set(rects.map((rect) => Math.round(rect.top * 10))).size;
        return { width: Math.max(title.scrollWidth, ...rects.map((rect) => rect.width)), height: title.getBoundingClientRect().height, lines };
      });
      if (fitted > 0) setWallTitleSize(fitted);
    };
    fit();
    void document.fonts.ready.then(fit);
    document.fonts.addEventListener("loadingdone", fit);
    const observer = new ResizeObserver(fit);
    observer.observe(board);
    observer.observe(stage);
    return () => { observer.disconnect(); document.fonts.removeEventListener("loadingdone", fit); };
  }, [presentation?.tournamentName]);
  const [destination, setDestination] = useState({ x: 0, y: 0, width: 0, height: 0, logo: "1.5cqw", name: ".82cqw" });
  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    // Drive reveal keyframes with the receiver's uninterrupted playback clock,
    // rather than negative delays that skip flights after network latency.
    stage.querySelectorAll<HTMLElement>(".draw-show-flying-ball, .draw-ball-half, .draw-reveal-name").forEach((element) => {
      element.getAnimations().forEach((animation) => {
        animation.pause();
        animation.currentTime = revealElapsed;
      });
    });
  }, [revealElapsed, revealKey, session, presentation]);
  const selectionPhase = stageSelection(presentation, now);
  const activeSpotlight = sweepSpotlight(presentation, now) ?? spotlightId;
  const pending = session?.pending;
  const rounds = presentation?.rounds;
  const selectedId = presentation?.selection?.targetId;
  const flagBackdrop = (country?: string | null) => presentation?.flagBackdrops !== false && country ? <span className="draw-show-flag-backdrop" aria-hidden="true"><svg className="draw-show-flag" viewBox="3 5 30 26" preserveAspectRatio="none"><image href={countryToFlagUrl(country) ?? undefined} width="36" height="36" /></svg></span> : null;
  const team = session?.teams.find((item) => item.id === pending?.teamId);
  const teamReady = !revealing;
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
      setDestination({ x: target.left + target.width / 2 - rect.left - rect.width / 2, y: target.top + target.height / 2 - rect.top - rect.height * .44, width: target.width, height: target.height, logo: getComputedStyle(slot.querySelector(".draw-show-slot-mark") ?? slot).width, name: getComputedStyle(slot.querySelector(".draw-show-slot-name") ?? slot).fontSize });
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
   const { pageCount, pageIndex, teamIds: visiblePotIds } = drawOverviewPage(potTeamIds, now);
  const potMaxColumns = visiblePotIds.length > 8 ? 8 : 4;
  const potRows = Math.max(1, Math.ceil(visiblePotIds.length / potMaxColumns));
  const potColumns = Math.max(1, Math.ceil(visiblePotIds.length / potRows));
   const potGridStyle = { "--pot-columns": potColumns, "--pot-slot-height": `${Math.min(1.7, 4 / potRows - .15)}cqw`, "--pot-cell-width": potColumns > 4 ? "5cqw" : potColumns === 4 ? "10cqw" : "12cqw", "--pot-name-size": potColumns > 4 ? ".5cqw" : ".74cqw", "--pot-logo-size": potColumns > 4 ? ".95cqw" : "1.45cqw", "--pot-cell-gap": potColumns > 4 ? ".18cqw" : ".3cqw" } as CSSProperties;
  const renderContainer = (container: DrawSessionState["containers"][number]) => (
    <section key={container.id} data-group-id={container.id} data-team-columns={layout.teamColumns} style={{ "--group-slot-rows": Math.max(1, Math.ceil(container.capacity / layout.teamColumns)) } as CSSProperties} className={`draw-show-group-card ${container.id === selectedId || container.id === activeSpotlight || (!pending && last?.targetId === container.id) ? "is-placed" : ""}`}>
      <h2>{container.name}</h2>
      <div className="draw-show-slots" style={{ "--slot-columns": layout.teamColumns, "--slot-rows": Math.max(1, Math.ceil(container.capacity / layout.teamColumns)) } as CSSProperties}>
        {Array.from({ length: container.capacity }, (_, index) => {
          const placed = session?.teams.find((item) => item.id === container.teamIds[index]);
          return <div key={index} className={`draw-show-slot ${!pending && last?.teamId === placed?.id && last?.targetId === container.id ? "is-arriving" : ""}`} title={placed?.name} aria-label={placed?.name} data-transfer-target={container.id === selectedId && index === container.teamIds.length}>
            {flagBackdrop(placed?.country)}
            <span className="draw-show-slot-mark">{placed?.logoUrl ? <AutoTrimLogo src={placed.logoUrl} /> : placed?.name.slice(0, 2).toUpperCase()}</span>
            {layout.mode !== "C" && <span className="draw-show-slot-name">{placed?.name ?? ""}</span>}
          </div>;
        })}
      </div>
    </section>
  );
   const teamContent = team && <>{flagBackdrop(team.country)}<span className="draw-show-team-identity"><span className="draw-show-reveal-logo">{team.logoUrl && <AutoTrimLogo src={team.logoUrl} className="draw-show-team-logo" />}</span><strong>{team.name}</strong></span></>;
   const footLabel = rounds ? `${rounds.groupName}${activePot ? ` · ${activePot.name}` : ""}` : activePot?.name ?? session?.phaseName;
   const drawnCount = potTeamIds.filter((id) => rounds ? rounds.drawnTeamIds.includes(id) : !session?.remaining.includes(id)).length;
  const speed = presentation?.speed ?? 1;
  const transferElapsed = useMemo(() => selectionPhase === "transfer" && presentation?.selection ? Math.max(0, Date.now() - presentation.selection.startedAt - 850 / speed) : 0, [selectionPhase, presentation?.selection?.startedAt, speed]);
  const choiceColumns = Math.max(1, Math.min(8, pending?.options.length ?? 1));
   const motionStyle = { "--draw-choice-width": `${Math.min(8, (42 - .16 * (choiceColumns - 1)) / choiceColumns)}cqw`, "--draw-rate": speed, "--reveal-offset": "0ms", "--transfer-offset": `${-transferElapsed}ms`, "--transfer-x": `${destination.x}px`, "--transfer-y": `${destination.y}px`, "--transfer-width": `${destination.width}px`, "--transfer-height": `${destination.height}px`, "--landing-logo-size": destination.logo, "--landing-name-size": destination.name } as CSSProperties;

  return <div ref={stageRef} data-studio-theme={studio.id} data-group-layout={rounds ? undefined : layout.mode} className={`draw-show draw-show-stage ${rounds ? "" : `draw-show-layout-${layout.mode}`}`} style={{ backgroundImage: `url(${studio.asset.url})`, "--wing-columns": layout.wingColumns, "--wing-rows": layout.wingRows, ...motionStyle } as CSSProperties}>
    <header className="draw-show-wall-header">
      <div className="draw-show-live-heading draw-wall-metal draw-wall-caption">{heading}</div>
      <div className="draw-show-wall-title" style={{ "--wall-title-size": wallTitleSize ? `${wallTitleSize}px` : undefined } as CSSProperties}>
        <span ref={wallTitleRef} className="draw-wall-title-measure" aria-hidden="true">{presentation?.tournamentName || "COPA MUNDO"}</span>
        <span className="draw-wall-title-lettering">{wallTitleText.split("\n").map((line, index) => <span className="draw-wall-title-line draw-wall-metal" key={index}>{line}</span>)}</span>
      </div>
      <div className="draw-show-brand draw-wall-metal draw-wall-caption">POWERED BY COPA MUNDO</div>
    </header>
    {!session ? <div className="draw-show-waiting"><strong>Wachten op de live loting</strong></div> : <>
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
                  {flagBackdrop(item?.country)}
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
               {flagBackdrop(opponent?.country)}
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
          {pending && team && selectionPhase !== "transfer" && selectionPhase !== "complete" && <div key={revealKey ?? pending.teamId} className="draw-show-team draw-reveal-name">{teamContent}</div>}
        </div>
        {!rounds && pending && selectionPhase !== "complete" && <div className={`draw-show-eligible draw-reveal-name ${selectedId ? "has-selection" : ""}`}><div className="draw-show-eligible-groups" style={{ "--eligible-columns": Math.max(1, Math.min(8, eligible.length)) } as CSSProperties}>{eligible.map((option) => <span key={option.id} title={option.label} className={activeSpotlight === option.id || selectedId === option.id ? "is-spotlight" : ""}>{option.label}</span>)}</div></div>}
      </main>
      {selectionPhase === "transfer" && team && <div className={`draw-show-transfer ${layout.mode === "C" ? "is-logo-only" : ""}`} key={`${team.id}-${selectedId}`}><div className="draw-transfer-slot">{flagBackdrop(team.country)}<span className="draw-show-slot-mark">{team.logoUrl ? <AutoTrimLogo src={team.logoUrl} /> : team.name.slice(0, 2).toUpperCase()}</span><span className="draw-show-slot-name">{team.name}</span></div></div>}
      <svg width="0" height="0" aria-hidden="true" className="draw-show-bowl-mask"><defs><clipPath id={`${ledArcId}-bowl`} clipPathUnits="objectBoundingBox"><path d="M .426 .619 C .426 .608 .460 .603 .500 .603 C .540 .603 .574 .608 .574 .619 C .574 .683 .552 .741 .519 .764 C .510 .770 .490 .770 .481 .764 C .448 .741 .426 .683 .426 .619 Z" /></clipPath></defs></svg>
      <div className="draw-show-bowl-sheen" style={{ clipPath: `url(#${ledArcId}-bowl)` }} aria-hidden="true" />
      <div className="draw-show-bowl" aria-label={`${remainingIds.length} ballen resterend`} />
      <DrawBalls key={activePot?.id ?? rounds?.groupName ?? "all"} teamIds={remainingIds} drawnId={pending?.teamId} revealKey={revealKey} elapsed={revealElapsed} speed={speed} revealing={revealing} theme={studio.id} />
      <svg className="draw-show-pot-label" viewBox="0 0 600 100" role="img" aria-label={footLabel}><defs><path id={`${ledArcId}-pot`} d="M 20 46 Q 300 90 580 46" /></defs><text textAnchor="middle"><textPath href={`#${ledArcId}-pot`} startOffset="50%">{footLabel}</textPath></text></svg><div className="draw-show-pot-counter">{drawnCount}/{potTeamIds.length}</div><div className="draw-show-pot"><div key={`${rounds?.groupName}-${activePot?.id}-${pageIndex}`} className="draw-show-pot-teams" style={potGridStyle} aria-label="Clubs in actieve pot">{visiblePotIds.map((id) => { const item = session.teams.find((candidate) => candidate.id === id); const drawn = !remainingIds.includes(id) && (id !== pending?.teamId || teamReady); return <span key={id} className={drawn ? "is-drawn" : ""} title={`${item?.name ?? ""}${drawn ? " · Getrokken" : ""}`}><span className="draw-show-pot-logo">{item?.logoUrl && <AutoTrimLogo src={item.logoUrl} />}</span><FittedPotName name={item?.name ?? ""} /></span>; })}</div></div>
    </>}
    {controls}
  </div>;
}
