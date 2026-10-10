import { useLayoutEffect, useRef } from "react";
import { balanceWallTitle } from "@/lib/drawHeading";

/** Measure the actual name column after its logo and padding have taken space. */
export function FittedPotName({ name }: { name: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    let disposed = false;
    const fit = () => {
      if (disposed) return;
      element.style.removeProperty("font-size");
      const maximum = parseFloat(getComputedStyle(element).fontSize);
      const range = document.createRange();
      const measure = (text: string) => {
        element.textContent = text;
        range.selectNodeContents(element);
        return range.getBoundingClientRect().width;
      };
      // Keep the normal font size; only names that overflow gain a second line.
      element.textContent = balanceWallTitle(name, element.clientWidth * .62, measure);
      range.selectNodeContents(element);
      const parent = element.parentElement;
      const parentStyle = parent ? getComputedStyle(parent) : undefined;
      const availableHeight = parent ? parent.clientHeight - parseFloat(parentStyle?.paddingTop || "0") - parseFloat(parentStyle?.paddingBottom || "0") : Infinity;
      const fits = () => range.getBoundingClientRect().width <= element.clientWidth - .5 && element.getBoundingClientRect().height <= availableHeight;
      if (element.clientWidth > 0 && !fits()) {
        let low = 0;
        let high = maximum;
        for (let iteration = 0; iteration < 16; iteration++) {
          const size = (low + high) / 2;
          element.style.fontSize = `${size}px`;
          if (fits()) low = size;
          else high = size;
        }
        element.style.fontSize = `${low}px`;
      }
    };
    fit();
    void document.fonts.ready.then(fit);
    document.fonts.addEventListener("loadingdone", fit);
    const observer = new ResizeObserver(fit);
    observer.observe(element);
    return () => { disposed = true; observer.disconnect(); document.fonts.removeEventListener("loadingdone", fit); };
  }, [name]);
  return <span ref={ref} className="draw-show-pot-name">{name}</span>;
}