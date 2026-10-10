import { useLayoutEffect, useRef } from "react";
import { balanceWallTitle } from "@/lib/drawHeading";

/** Balance names in their actual columns, using one shared size for the entire grid. */
export function FittedPotName({ name }: { name: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const element = ref.current;
    const grid = element?.closest(".draw-show-pot-teams");
    if (!element || !grid) return;
    let disposed = false;
    const fit = () => {
      if (disposed) return;
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
    fit();
    void document.fonts.ready.then(fit);
    document.fonts.addEventListener("loadingdone", fit);
    const observer = new ResizeObserver(fit);
    observer.observe(grid);
    return () => { disposed = true; observer.disconnect(); document.fonts.removeEventListener("loadingdone", fit); };
  }, [name]);
  return <span ref={ref} className="draw-show-pot-name" data-name={name}>{name}</span>;
}