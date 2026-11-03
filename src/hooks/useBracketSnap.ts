import { useEffect, useRef, type RefObject } from "react";
import { flushSync } from "react-dom";
import { bracketSuccessorIndex } from "@/lib/adaptiveBracketLayout";

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

function successorCard(element: HTMLElement, source: HTMLElement, from: number, to: number) {
  const sources = Array.from(element.querySelectorAll<HTMLElement>(`[data-bracket-round="${from}"]`));
  const targets = Array.from(element.querySelectorAll<HTMLElement>(`[data-bracket-round="${to}"]`));
  const index = sources.indexOf(source);
  const feedersOf = (card: HTMLElement) => (card.dataset.bracketFeeders ?? "").split(",").filter(Boolean).map(Number);
  if (to === from + 1) {
    const fed = targets.find(card => feedersOf(card).includes(index));
    if (fed) return fed;
  } else if (to === from - 1) {
    const feeder = feedersOf(source)[0];
    if (feeder !== undefined && targets[feeder]) return targets[feeder];
  }
  return targets[bracketSuccessorIndex(Math.max(0, index), sources.length, targets.length)] ?? source;
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
    let previousProgress = 0;
    let tracked: HTMLElement | null = null;
    let trackingBase = -1;
    let trackingDirection = 0;
    let originCentre = 0;
    let desiredCentre = 0;
    let originFraction = 0;
    let lastVertical = verticalScroller(element).scrollTop;
    // Rail padding shifts where the first round snaps; measure the real snap
    // positions so a resting round reports exactly --bf 0 instead of a partial step.
    const snapPosition = (round: number) => {
      let node = element.querySelector<HTMLElement>(`[data-bracket-round="${round}"]`);
      while (node && node !== element && getComputedStyle(node).scrollSnapAlign.includes("none")) node = node.parentElement;
      if (!node || node === element) return undefined;
      const padding = parseFloat(getComputedStyle(element).scrollPaddingLeft) || 0;
      return node.getBoundingClientRect().left - element.getBoundingClientRect().left - element.clientLeft + element.scrollLeft - padding;
    };
    const apply = () => {
      const last = Math.max(0, roundCount - 1);
      const first = snapPosition(0);
      const second = roundCount > 1 ? snapPosition(1) : undefined;
      const origin = first !== undefined ? Math.max(0, Math.min(first, element.scrollWidth - element.clientWidth)) : 0;
      const step = first !== undefined && second !== undefined && second - first > 1 ? second - first : (columnWidth || 1);
      const progress = Math.max(0, Math.min(last, (element.scrollLeft - origin) / step));
      const nextBase = Math.min(Math.floor(progress), Math.max(0, roundCount - 2));
      const fraction = roundCount > 1 ? Math.min(1, progress - nextBase) : 0;
      const shown = Math.round(progress);
      const scroller = verticalScroller(element);
      const direction = Math.sign(progress - previousProgress) || trackingDirection || 1;
      const finishingInterval = tracked?.isConnected && direction === trackingDirection && nextBase !== trackingBase && ((direction > 0 && fraction < 0.0001) || (direction < 0 && fraction > 0.9999));
      if (!finishingInterval && (nextBase !== trackingBase || direction !== trackingDirection || !tracked?.isConnected || Math.abs(scroller.scrollTop - lastVertical) > 1)) {
        // Capture the source visible to the viewer before changing either endpoint.
        const sourceRound = direction > 0 ? nextBase : Math.min(nextBase + 1, last);
        const source = nearestCard(element, scroller, sourceRound);
        const targetRound = direction > 0 ? Math.min(nextBase + 1, last) : nextBase;
        tracked = source ? successorCard(element, source, sourceRound, targetRound) : null;
        trackingBase = nextBase;
        trackingDirection = direction;
        originFraction = Math.max(0, Math.min(1, previousProgress - nextBase));
        if (tracked) {
          const rect = tracked.getBoundingClientRect();
          originCentre = rect.top + rect.height / 2;
          const isRoot = scroller === document.scrollingElement || scroller === document.documentElement;
          const viewportTop = isRoot ? 0 : Math.max(0, scroller.getBoundingClientRect().top);
          const viewportBottom = isRoot ? window.innerHeight : Math.min(window.innerHeight, scroller.getBoundingClientRect().top + scroller.clientHeight);
          desiredCentre = (viewportTop + viewportBottom) / 2;
        }
      }
      const beforeRect = tracked?.getBoundingClientRect();
      const before = beforeRect ? beforeRect.top + beforeRect.height / 2 : undefined;
      if (nextBase !== base.current) { base.current = nextBase; flushSync(() => onBase(nextBase)); }
      element.style.setProperty("--bf", fraction.toFixed(4));
      // Only visible columns determine the viewport height. Outgoing cards remain
      // reachable until they actually leave horizontally, instead of being cut off
      // by the shrinking incoming round. Offscreen columns cannot enlarge the rail.
      const railRect = element.getBoundingClientRect();
      const railStyle = getComputedStyle(element);
      const visibleLeft = railRect.left + (parseFloat(railStyle.paddingLeft) || 0);
      const visibleRight = railRect.right - (parseFloat(railStyle.paddingRight) || 0);
      let bottom = 0;
      element.querySelectorAll<HTMLElement>("[data-bracket-round], [data-bracket-placement]").forEach(card => {
        const rect = card.getBoundingClientRect();
        if (rect.right > visibleLeft + 1 && rect.left < visibleRight - 1) bottom = Math.max(bottom, rect.bottom - railRect.top);
      });
      if (bottom > 0) element.style.height = `${Math.ceil(bottom + 20)}px`;
      if (tracked && before !== undefined && element.dataset.dragging !== "true") {
        const rect = tracked.getBoundingClientRect();
        const travel = finishingInterval ? 1 : direction > 0 ? (fraction - originFraction) / Math.max(0.0001, 1 - originFraction) : (originFraction - fraction) / Math.max(0.0001, originFraction);
        const desired = originCentre + (desiredCentre - originCentre) * Math.max(0, Math.min(1, travel));
        const delta = rect.top + rect.height / 2 - desired;
        if (Math.abs(delta) > 0.5) scroller.scrollBy({ top: delta, behavior: "instant" as ScrollBehavior });
      }
      previousProgress = progress;
      lastVertical = scroller.scrollTop;
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
