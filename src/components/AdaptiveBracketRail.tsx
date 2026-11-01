import { useEffect, useRef, useState, type ReactNode } from "react";

interface Props {
  roundCount: number;
  children: (layout: { activeRound: number; cardWidth: number }) => ReactNode;
}

/** Results-only viewport; the bracket cards and tree remain the admin presentation. */
export default function AdaptiveBracketRail({ roundCount, children }: Props) {
  const railRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(296);
  const [activeRound, setActiveRound] = useState(0);
  const cardWidth = Math.max(160, width - 88);
  const stride = cardWidth + 16;

  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    const observer = new ResizeObserver(() => setWidth(rail.clientWidth));
    observer.observe(rail);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={railRef}
      aria-label="Bracketrondes"
      className="w-full max-w-[296px] overflow-auto overscroll-contain pb-2"
      style={{ scrollSnapType: "x mandatory", scrollPaddingInline: (width - cardWidth) / 2 }}
      onScroll={(event) => {
        const rail = event.currentTarget;
        const next = Math.min(roundCount - 1, Math.max(0, Math.round((rail.scrollLeft + (width - cardWidth) / 2) / stride)));
        if (next !== activeRound) {
          setActiveRound(next);
          rail.scrollTop = 0;
        }
      }}
    >
      {children({ activeRound, cardWidth })}
    </div>
  );
}