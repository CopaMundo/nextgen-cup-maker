import { useRef, useState, type ReactNode } from "react";
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
  const [activeRound, setActiveRound] = useState(0);
  const [viewportWidth, setViewportWidth] = useState(0);
  const [indicatorRound, setIndicatorRound] = useState(0);
  useBracketSnap(ref, columnWidth, roundCount, setActiveRound, setViewportWidth, setIndicatorRound);
  return <div className="min-w-0">
    <BracketRoundIndicators count={roundCount} active={indicatorRound} />
    <div ref={ref} className="w-full min-w-0 overflow-x-auto overflow-y-hidden overscroll-x-contain snap-x snap-mandatory scroll-smooth motion-reduce:scroll-auto [overflow-anchor:none] pb-2" aria-label="Bracketrondes">
    {children({ activeRound, viewportWidth })}
  </div></div>;
}