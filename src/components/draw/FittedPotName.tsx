import { useLayoutEffect, useRef } from "react";
const scheduledGrids = new WeakMap<Element, number>();
const gridObservers = new WeakMap<Element, { count: number; fit: () => void; dispose: () => void }>();

/** Keep normal names large; only an exceptional name fits its own two-line column. */
export function FittedPotName({ name }: { name: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const element = ref.current;
    const grid = element?.closest(".draw-show-pot-teams");
    if (!element || !grid) return;
    const existing = gridObservers.get(grid);
    if (existing) {
      existing.count++;
      existing.fit();
      return () => { if (--existing.count === 0) { existing.dispose(); gridObservers.delete(grid); } };
    }
    let disposed = false;
    const fitNow = () => {
      scheduledGrids.delete(grid);
      if (!grid.isConnected) return;
      const names = Array.from(grid.querySelectorAll<HTMLElement>(".draw-show-pot-name"));
      const probe = names[0];
      if (!probe) return;
      names.forEach((item) => item.style.removeProperty("font-size"));
      const maximum = parseFloat(getComputedStyle(probe).fontSize);
      const css = getComputedStyle(probe);
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      if (!context) return;
      context.font = `${css.fontWeight} ${maximum}px ${css.fontFamily}`;
      const width = probe.clientWidth;
      const parent = probe.parentElement;
      const parentStyle = parent ? getComputedStyle(parent) : undefined;
      const availableHeight = parent ? parent.clientHeight - parseFloat(parentStyle?.paddingTop || "0") - parseFloat(parentStyle?.paddingBottom || "0") : Infinity;
      const measure = (text: string) => context.measureText(text).width;
      const balanced = (name: string) => {
        if (measure(name) <= width) return name;
        const words = name.trim().split(/\s+/);
        let best = name, score = Infinity;
        for (let split = 1; split < words.length; split++) {
          const upper = words.slice(0, split).join(" "), lower = words.slice(split).join(" ");
          const a = measure(upper), b = measure(lower);
          const next = Math.max(a, b) + (b < a ? width * .15 : 0);
          if (next < score) { score = next; best = `${upper}\n${lower}`; }
        }
        return best;
      };
      const fitted = names.map((item) => {
        const text = balanced(item.dataset.name || "");
        const lines = text.split("\n");
        const measuredWidth = Math.max(...lines.map(measure));
        // Ordinary one-line and balanced two-line names keep the exact same
        // base size. Only an unbreakable exceptional word needs optical fitting.
        const ratio = Math.min(1, item.clientWidth / Math.max(1, measuredWidth), availableHeight / (lines.length * maximum * 1.1));
        return { item, text, size: maximum * ratio };
      });
      fitted.forEach(({ item, text, size }) => { item.textContent = text; item.style.fontSize = `${size}px`; });
    };
    // Every name in the grid shares one measurement pass per frame.
    const fit = () => {
      if (disposed || scheduledGrids.has(grid)) return;
      scheduledGrids.set(grid, requestAnimationFrame(fitNow));
    };
    fit();
    void document.fonts.ready.then(fit);
    document.fonts.addEventListener("loadingdone", fit);
    const observer = new ResizeObserver(fit);
    observer.observe(grid);
    const registration = { count: 1, fit, dispose: () => {
      disposed = true;
      observer.disconnect();
      document.fonts.removeEventListener("loadingdone", fit);
      const frame = scheduledGrids.get(grid);
      if (frame !== undefined) cancelAnimationFrame(frame);
      scheduledGrids.delete(grid);
    } };
    gridObservers.set(grid, registration);
    return () => { if (--registration.count === 0) { registration.dispose(); gridObservers.delete(grid); } };
  }, [name]);
  return <span ref={ref} className="draw-show-pot-name" data-name={name}>{name}</span>;
}