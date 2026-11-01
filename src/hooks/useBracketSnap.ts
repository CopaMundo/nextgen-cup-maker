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

/**
 * Native scrolling owns each frame; React only updates once scrolling settles.
 * The settled round always converges. The card nearest the viewer's centre in
 * the new round stays at the same screen position, so the followed team stays
 * in view and stacked sibling trees never slide underneath the viewer.
 */
export function useBracketSnap(ref: RefObject<HTMLDivElement>, columnWidth: number, roundCount: number, onRound: (round: number) => void, onWidth?: (width: number) => void, onIndicator?: (round: number) => void) {
  const current = useRef(0);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const settle = () => {
      const round = Math.max(0, Math.min(roundCount - 1, Math.round(element.scrollLeft / (columnWidth || 1))));
      onIndicator?.(round);
      if (round === current.current) return;
      current.current = round;
      const scroller = verticalScroller(element);
      const isRoot = scroller === document.scrollingElement || scroller === document.documentElement;
      const viewTop = isRoot ? 0 : scroller.getBoundingClientRect().top;
      const viewBottom = isRoot ? window.innerHeight : viewTop + scroller.clientHeight;
      const centre = (Math.max(viewTop, 0) + Math.min(viewBottom, window.innerHeight)) / 2;
      let anchor: HTMLElement | null = null;
      let distance = Infinity;
      element.querySelectorAll<HTMLElement>(`[data-bracket-round="${round}"]`).forEach(card => {
        const rect = card.getBoundingClientRect();
        const d = Math.abs(rect.top + rect.height / 2 - centre);
        if (d < distance) { distance = d; anchor = card; }
      });
      const before = (anchor as HTMLElement | null)?.getBoundingClientRect().top;
      // Apply the converged geometry in one frame so the anchor can be held still.
      element.classList.add("bracket-instant");
      flushSync(() => onRound(round));
      if (anchor && before !== undefined) {
        const delta = (anchor as HTMLElement).getBoundingClientRect().top - before;
        if (Math.abs(delta) > 0.5) scroller.scrollBy({ top: delta, behavior: "instant" as ScrollBehavior });
      }
      requestAnimationFrame(() => requestAnimationFrame(() => element.classList.remove("bracket-instant")));
    };
    const resize = new ResizeObserver(() => onWidth?.(element.clientWidth));
    resize.observe(element);
    element.addEventListener("scrollend", settle, { passive: true });
    return () => { resize.disconnect(); element.removeEventListener("scrollend", settle); };
  });
}
