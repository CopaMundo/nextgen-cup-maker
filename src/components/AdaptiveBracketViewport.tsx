import { useRef, useState, type ReactNode, type PointerEvent as ReactPointerEvent } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useBracketSnap } from "@/hooks/useBracketSnap";
import BracketRoundIndicators from "@/components/BracketRoundIndicators";

interface ViewportState {
  activeRound: number;
  viewportWidth: number;
}

/** Each bracket owns its horizontal scroll position, including placement brackets. */
export default function AdaptiveBracketViewport({ roundCount, columnWidth, children }: {
  roundCount: number;
  columnWidth: number;
  children: (state: ViewportState) => ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; left: number; moved: boolean } | null>(null);
  const [activeRound, setActiveRound] = useState(0);
  const [viewportWidth, setViewportWidth] = useState(0);
  const [indicatorRound, setIndicatorRound] = useState(0);
  useBracketSnap(ref, columnWidth, roundCount, setActiveRound, setViewportWidth, setIndicatorRound);

  const goTo = (round: number) => {
    const el = ref.current;
    if (!el) return;
    const target = Math.max(0, Math.min(roundCount - 1, round));
    const card = el.querySelector<HTMLElement>(`[data-bracket-round="${target}"]`);
    const left = card
      ? el.scrollLeft + card.getBoundingClientRect().left - el.getBoundingClientRect().left - (parseFloat(getComputedStyle(el).scrollPaddingLeft) || 0)
      : target * columnWidth;
    el.scrollTo({ left, behavior: "smooth" });
  };

  // Mouse drag-to-scroll: snapping is paused while dragging and vertical following is off,
  // so the page never jolts; on release the rail snaps to the nearest round.
  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "mouse" || e.button !== 0) return;
    if ((e.target as HTMLElement).closest("button, input, a, select, textarea, [role='button']")) return;
    const el = ref.current; if (!el) return;
    drag.current = { x: e.clientX, left: el.scrollLeft, moved: false };
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const el = ref.current; const d = drag.current;
    if (!el || !d) return;
    const dx = e.clientX - d.x;
    if (!d.moved && Math.abs(dx) < 4) return;
    if (!d.moved) {
      d.moved = true;
      el.dataset.dragging = "true";
      el.style.scrollSnapType = "none";
      el.style.scrollBehavior = "auto";
      el.setPointerCapture(e.pointerId);
    }
    e.preventDefault();
    el.scrollLeft = d.left - dx;
  };
  const endDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
    const el = ref.current; const d = drag.current;
    drag.current = null;
    if (!el || !d?.moved) return;
    if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
    el.style.scrollSnapType = "";
    el.style.scrollBehavior = "";
    const step = columnWidth || 1;
    const dx = d.left - el.scrollLeft;
    const from = Math.round(d.left / step);
    const round = Math.abs(dx) > step * 0.2 ? from + (dx < 0 ? 1 : -1) : from;
    goTo(round);
    window.setTimeout(() => { delete el.dataset.dragging; }, 450);
  };

  const arrow = "pointer-events-auto flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card/95 text-foreground shadow-md backdrop-blur transition-colors hover:border-primary hover:text-primary";
  return <div className="min-w-0">
    <BracketRoundIndicators count={roundCount} active={indicatorRound} />
    <div className="relative">
      <div ref={ref}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={endDrag} onPointerCancel={endDrag}
        onClickCapture={e => { if (ref.current?.dataset.dragging === "true") { e.stopPropagation(); e.preventDefault(); } }}
        className="w-full min-w-0 select-none overflow-x-auto overflow-y-hidden overscroll-x-contain snap-x snap-mandatory scroll-smooth motion-reduce:scroll-auto [overflow-anchor:none] pb-2" aria-label="Bracketrondes">
        {children({ activeRound, viewportWidth })}
      </div>
      {roundCount > 1 && <>
        <div className="pointer-events-none absolute inset-y-0 left-1 z-20 w-9">
          {indicatorRound > 0 && <div className="sticky mt-4" style={{ top: "calc(50vh - 18px)" }}>
            <button type="button" aria-label="Vorige ronde" className={arrow} onClick={() => goTo(indicatorRound - 1)}><ChevronLeft className="h-5 w-5" /></button>
          </div>}
        </div>
        <div className="pointer-events-none absolute inset-y-0 right-1 z-20 w-9">
          {indicatorRound < roundCount - 1 && <div className="sticky mt-4" style={{ top: "calc(50vh - 18px)" }}>
            <button type="button" aria-label="Volgende ronde" className={arrow} onClick={() => goTo(indicatorRound + 1)}><ChevronRight className="h-5 w-5" /></button>
          </div>}
        </div>
      </>}
    </div>
  </div>;
}
