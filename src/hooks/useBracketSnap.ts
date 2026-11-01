import { useEffect, useRef, type RefObject } from "react";
import { flushSync } from "react-dom";

function verticalScroller(element: HTMLElement): HTMLElement {
  let parent = element.parentElement;
  while (parent && parent !== document.body) {
    if (/(auto|scroll)/.test(getComputedStyle(parent).overflowY) && parent.scrollHeight > parent.clientHeight) return parent;
    parent = parent.parentElement;
  }
  return (document.scrollingElement as HTMLElement) ?? document.documentElement;
}

function nearestCard(element: HTMLElement, scroller: HTMLElement, round: number) {
  const isRoot = scroller === document.scrollingElement || scroller === document.documentElement;
  const top = isRoot ? 0 : Math.max(0, scroller.getBoundingClientRect().top);
  const bottom = isRoot ? window.innerHeight : Math.min(window.innerHeight, scroller.getBoundingClientRect().top + scroller.clientHeight);
  const centre = (top + bottom) / 2;
  let best: HTMLElement | null = null;
  let distance = Infinity;
  element.querySelectorAll<HTMLElement>(`[data-bracket-round="${round}"]`).forEach(card => {
    const rect = card.getBoundingClientRect();
    const d = Math.abs(rect.top + rect.height / 2 - centre);
    if (d < distance) { distance = d; best = card; }
  });
  return best as HTMLElement | null;
}

/**
 * The geometry follows the finger: the rail exposes --bf, the fraction between
 * the base round and the next one, and cards interpolate their positions in CSS.
 * React only re-renders when the base round changes. The card the viewer is
 * looking at is held at the same screen position, so the followed team stays in
 * view in both directions and sibling trees never slide underneath.
 */
export function useBracketSnap(ref: RefObject<HTMLDivElement>, columnWidth: number, roundCount: number, onBase: (round: number) => void, onWidth?: (width: number) => void, onIndicator?: (round: number) => void) {
  const base = useRef(0);
  const indicator = useRef(0);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const apply = () => {
      const last = Math.max(0, roundCount - 1);
      const progress = Math.max(0, Math.min(last, element.scrollLeft / (columnWidth || 1)));
      const nextBase = Math.min(Math.floor(progress), Math.max(0, roundCount - 2));
      const fraction = roundCount > 1 ? Math.min(1, progress - nextBase) : 0;
      const shown = Math.round(progress);
      const scroller = verticalScroller(element);
      // Hold the round being entered/left after the base: its cards are the ones that move.
      const anchor = nearestCard(element, scroller, Math.min(base.current + 1, last));
      const before = anchor?.getBoundingClientRect().top;
      if (nextBase !== base.current) { base.current = nextBase; flushSync(() => onBase(nextBase)); }
      element.style.setProperty("--bf", fraction.toFixed(4));
      if (anchor && before !== undefined) {
        const delta = anchor.getBoundingClientRect().top - before;
        if (Math.abs(delta) > 0.5) scroller.scrollBy({ top: delta, behavior: "instant" as ScrollBehavior });
      }
      if (shown !== indicator.current) { indicator.current = shown; onIndicator?.(shown); }
    };
    const resize = new ResizeObserver(() => { onWidth?.(element.clientWidth); });
    resize.observe(element);
    element.addEventListener("scroll", apply, { passive: true });
    apply();
    return () => {
      resize.disconnect();
      element.removeEventListener("scroll", apply);
    };
  }, [ref, columnWidth, roundCount, onBase, onWidth, onIndicator]);
}
