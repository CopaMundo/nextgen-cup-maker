import { useEffect, useRef, useState, type ReactNode } from "react";

interface ViewportState {
  activeRound: number;
  viewportWidth: number;
  scrollToRound: (round: number) => void;
}

/** Each bracket owns its horizontal scroll position, including placement brackets. */
export default function AdaptiveBracketViewport({ roundCount, columnWidth, children }: {
  roundCount: number;
  columnWidth: number;
  children: (state: ViewportState) => ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [activeRound, setActiveRound] = useState(0);
  const [viewportWidth, setViewportWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    const update = () => {
      setActiveRound(Math.max(0, Math.min(roundCount - 1, Math.round(el.scrollLeft / columnWidth))));
      setViewportWidth(el.clientWidth);
    };
    const onScroll = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(update); };
    el.addEventListener("scroll", onScroll, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(el);
    update();
    return () => { cancelAnimationFrame(raf); observer.disconnect(); el.removeEventListener("scroll", onScroll); };
  }, [columnWidth, roundCount]);
  return <div ref={ref} className="w-full min-w-0 overflow-x-auto overscroll-x-contain pb-2" aria-label="Bracketrondes">
    {children({ activeRound, viewportWidth, scrollToRound: round => ref.current?.scrollTo({ left: round * columnWidth, behavior: "smooth" }) })}
  </div>;
}