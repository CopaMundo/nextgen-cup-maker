import { useLayoutEffect, useRef } from "react";
import { balanceWallTitle } from "@/lib/drawHeading";

const sharedSizes = new Map<string, number>();
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
      const probe = names[0];
      if (!probe) return;
      names.forEach((item) => item.style.removeProperty("font-size"));
      const maximum = parseFloat(getComputedStyle(probe).fontSize);
      const width = probe.clientWidth;
      const parent = probe.parentElement;
      const parentStyle = parent ? getComputedStyle(parent) : undefined;
      const availableHeight = parent ? parent.clientHeight - parseFloat(parentStyle?.paddingTop || "0") - parseFloat(parentStyle?.paddingBottom || "0") : Infinity;
      const range = document.createRange();
      const measure = (text: string) => {
        probe.textContent = text;
        range.selectNodeContents(probe);
        return range.getBoundingClientRect().width;
      };
      const balanced = (name: string) => balanceWallTitle(name, width * .62, measure);
      // All pot names (every overview page) decide one shared size, cached per column width.
      const allNames = Array.from(new Set((grid.getAttribute("data-all-names") || names.map((item) => item.dataset.name || "").join("\n")).split("\n").filter(Boolean)));
      const cacheKey = `${Math.round(width)}|${Math.round(availableHeight)}|${maximum}|${allNames.join("\n")}`;
      let sharedSize = sharedSizes.get(cacheKey) ?? Infinity;
      if (!sharedSizes.has(cacheKey) && width > 0) {
        for (const name of allNames) {
          probe.style.removeProperty("font-size");
          probe.textContent = balanced(name);
          range.selectNodeContents(probe);
          const fits = () => range.getBoundingClientRect().width <= width - .5 && probe.getBoundingClientRect().height <= availableHeight;
          let fittedSize = maximum;
          if (!fits()) {
            let low = 0;
            let high = Math.min(maximum, sharedSize);
            for (let iteration = 0; iteration < 14; iteration++) {
              const size = (low + high) / 2;
              probe.style.fontSize = `${size}px`;
              if (fits()) low = size;
              else high = size;
            }
            fittedSize = low;
          }
          sharedSize = Math.min(sharedSize, fittedSize);
        }
        if (Number.isFinite(sharedSize)) sharedSizes.set(cacheKey, sharedSize);
      }
      probe.style.removeProperty("font-size");
      names.forEach((item) => { item.textContent = balanced(item.dataset.name || ""); });
      probe.textContent = balanced(probe.dataset.name || "");
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