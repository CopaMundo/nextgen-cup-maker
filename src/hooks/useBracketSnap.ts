import { useEffect, type RefObject } from "react";

/** Native scrolling owns each frame; React only updates once scrolling settles. */
export function useBracketSnap(ref: RefObject<HTMLDivElement>, columnWidth: number, roundCount: number, onRound: (round: number) => void, onWidth?: (width: number) => void) {
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const settle = () => onRound(Math.max(0, Math.min(roundCount - 1, Math.round(element.scrollLeft / columnWidth))));
    const resize = new ResizeObserver(() => onWidth?.(element.clientWidth));
    resize.observe(element);
    element.addEventListener("scrollend", settle, { passive: true });
    return () => { resize.disconnect(); element.removeEventListener("scrollend", settle); };
  });
}