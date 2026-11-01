import { useLayoutEffect, useRef, type RefObject } from "react";
import { alignBracketTop, bracketSuccessorIndex, bracketVisibleBounds, centerBracketMatch } from "@/lib/bracketScroll";

export function useBracketRoundAlignment(ref: RefObject<HTMLDivElement>, activeRound: number, enabled = true) {
  const previousRound = useRef(activeRound);
  const anchor = useRef<{ round: number; index: number; counts: number[] } | null>(null);
  const focusedName = useRef("");
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element || !enabled) return;
    const capture = () => {
      const cards = Array.from(element.querySelectorAll<HTMLElement>("[data-bracket-round][data-bracket-index]"));
      const bounds = bracketVisibleBounds(element);
      const current = cards.filter(card => Number(card.dataset.bracketRound) === previousRound.current);
      const visible = current.filter(card => {
        const rect = card.getBoundingClientRect();
        return rect.bottom > bounds.top && rect.top < bounds.bottom;
      });
      const closest = visible.sort((a, b) => {
        const center = (card: HTMLElement) => { const rect = card.getBoundingClientRect(); return (rect.top + rect.bottom) / 2; };
        return Math.abs(center(a) - bounds.center) - Math.abs(center(b) - bounds.center);
      })[0];
      if (!closest) return;
      const counts: number[] = [];
      cards.forEach(card => {
        const round = Number(card.dataset.bracketRound);
        counts[round] = Math.max(counts[round] ?? 0, Number(card.dataset.bracketIndex) + 1);
      });
      anchor.current = { round: previousRound.current, index: Number(closest.dataset.bracketIndex), counts };
      focusedName.current = closest.dataset.bracketName ?? "";
    };
    document.addEventListener("scroll", capture, true);
    element.addEventListener("pointerdown", capture);
    capture();
    return () => {
      document.removeEventListener("scroll", capture, true);
      element.removeEventListener("pointerdown", capture);
    };
  }, [ref, enabled]);
  useLayoutEffect(() => {
    if (previousRound.current === activeRound) return;
    previousRound.current = activeRound;
    if (!ref.current || !enabled) return;
    const tracked = anchor.current;
    let index = tracked ? bracketSuccessorIndex(tracked.index, tracked.round, activeRound, tracked.counts) : 0;
    if (tracked && activeRound === tracked.round + 1 && focusedName.current) {
      const linked = Array.from(ref.current.querySelectorAll<HTMLElement>(`[data-bracket-round="${activeRound}"]`)).find(card => {
        try { return (JSON.parse(card.dataset.bracketFeeders ?? "[]") as string[]).includes(focusedName.current); }
        catch { return false; }
      });
      if (linked) index = Number(linked.dataset.bracketIndex);
    }
    const target = ref.current.querySelector<HTMLElement>(`[data-bracket-round="${activeRound}"][data-bracket-index="${index}"]`);
    if (target && tracked) centerBracketMatch(target);
    else alignBracketTop(ref.current);
    if (tracked) anchor.current = { ...tracked, round: activeRound, index };
    focusedName.current = target?.dataset.bracketName ?? "";
    // Transforming mobile cards can change their containing block during animation.
    const finish = () => {
      const current = ref.current?.querySelector<HTMLElement>(`[data-bracket-round="${activeRound}"][data-bracket-index="${index}"]`);
      if (current && tracked) centerBracketMatch(current);
    };
    target?.addEventListener("transitionend", finish, { once: true });
    const observer = new ResizeObserver(finish);
    if (target && tracked) observer.observe(target);
    const settled = window.setTimeout(() => { finish(); observer.disconnect(); }, 500);
    return () => { observer.disconnect(); window.clearTimeout(settled); target?.removeEventListener("transitionend", finish); };
  }, [activeRound, ref, enabled]);
}