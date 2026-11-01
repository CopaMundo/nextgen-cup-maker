import { useEffect, type RefObject } from "react";

/** Native scrolling owns each frame; React only updates once scrolling settles. */
export function useBracketSnap(ref: RefObject<HTMLDivElement>, columnWidth: number, roundCount: number, onRound: (round: number) => void, onWidth?: (width: number) => void) {
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const settle = () => {
      // A shrinking tree must not pull a sibling into the user's current view.
      // Reserve only the viewed area when lowered, not the complete first round.
      let top = 0;
      let bottom = window.innerHeight;
      let parent = element.parentElement;
      while (parent && parent !== document.body) {
        if (/(auto|scroll)/.test(getComputedStyle(parent).overflowY) && parent.scrollHeight > parent.clientHeight) {
          const rect = parent.getBoundingClientRect();
          top = Math.max(top, rect.top);
          bottom = Math.min(bottom, rect.top + parent.clientHeight);
        }
        parent = parent.parentElement;
      }
      const treeTop = element.getBoundingClientRect().top;
      element.style.minHeight = treeTop < top ? `${Math.max(0, bottom - treeTop)}px` : "";
      onRound(Math.max(0, Math.min(roundCount - 1, Math.round(element.scrollLeft / columnWidth))));
    };
    const resize = new ResizeObserver(() => onWidth?.(element.clientWidth));
    resize.observe(element);
    element.addEventListener("scrollend", settle, { passive: true });
    return () => { resize.disconnect(); element.removeEventListener("scrollend", settle); };
  });
}