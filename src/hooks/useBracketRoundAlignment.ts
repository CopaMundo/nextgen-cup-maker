import { useLayoutEffect, useRef, type RefObject } from "react";
import { alignBracketTop } from "@/lib/bracketScroll";

export function useBracketRoundAlignment(ref: RefObject<HTMLDivElement>, activeRound: number) {
  const previousRound = useRef(activeRound);
  useLayoutEffect(() => {
    if (previousRound.current === activeRound) return;
    previousRound.current = activeRound;
    if (ref.current) alignBracketTop(ref.current);
  }, [activeRound, ref]);
}