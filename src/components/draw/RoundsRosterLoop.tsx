import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

/** Measure actual overflow, so short rosters never move and long rosters loop seamlessly. */
export function RoundsRosterLoop({ children, rosterKey }: { children: ReactNode; rosterKey: string }) {
  const viewport = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const [distance, setDistance] = useState(0);
  const [pages, setPages] = useState(1);
  useLayoutEffect(() => {
    const outer = viewport.current;
    const inner = content.current;
    if (!outer || !inner) return;
    const measure = () => {
      const overflow = inner.offsetHeight > outer.clientHeight + 1;
      setDistance(overflow ? inner.offsetHeight : 0);
      setPages(overflow ? Math.max(1, Math.ceil(inner.offsetHeight / Math.max(1, outer.clientHeight))) : 1);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(outer);
    observer.observe(inner);
    measure();
    return () => observer.disconnect();
  }, [rosterKey]);
  const style = { "--roster-distance": `${distance}px`, "--roster-duration": `${distance / 12}s`, "--roster-pages": pages, "--roster-page-duration": `${pages * 8}s` } as CSSProperties;
  return <div ref={viewport} className={`draw-show-rounds-roster-list ${distance ? "is-looping" : ""}`} style={style}>
    <div className="draw-show-rounds-roster-track" key={rosterKey}>
      <div ref={content}>{children}</div>
      {distance > 0 && <div aria-hidden="true" className="draw-show-rounds-roster-copy">{children}</div>}
    </div>
  </div>;
}