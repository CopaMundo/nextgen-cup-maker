import { useLayoutEffect, useRef } from "react";
import { balanceWallTitle } from "@/lib/drawHeading";

const scheduledGrids = new WeakMap<Element, number>();
const gridObservers = new WeakMap<Element, { count: number; fit: () => void; dispose: () => void }>();

/** Balance names in their actual columns, using one shared size for the entire grid. */
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
      names.forEach((item) => item.style.removeProperty("font-size"));
      let sharedSize = Infinity;
      for (const item of names) {
        const maximum = parseFloat(getComputedStyle(item).fontSize);
        const range = document.createRange();
        const measure = (text: string) => {
          item.textContent = text;
          range.selectNodeContents(item);
          return range.getBoundingClientRect().width;
        };
        item.textContent = balanceWallTitle(item.dataset.name || "", item.clientWidth * .62, measure);
        range.selectNodeContents(item);
        const parent = item.parentElement;
        const parentStyle = parent ? getComputedStyle(parent) : undefined;
        const availableHeight = parent ? parent.clientHeight - parseFloat(parentStyle?.paddingTop || "0") - parseFloat(parentStyle?.paddingBottom || "0") : Infinity;
        const fits = () => range.getBoundingClientRect().width <= item.clientWidth - .5 && item.getBoundingClientRect().height <= availableHeight;
        let fittedSize = maximum;
        if (item.clientWidth > 0 && !fits()) {
          let low = 0;
          let high = maximum;
          for (let iteration = 0; iteration < 16; iteration++) {
            const size = (low + high) / 2;
            item.style.fontSize = `${size}px`;
            if (fits()) low = size;
            else high = size;
          }
          fittedSize = low;
        }
        sharedSize = Math.min(sharedSize, fittedSize);
      }
      if (Number.isFinite(sharedSize)) names.forEach((item) => { item.style.fontSize = `${sharedSize}px`; });
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