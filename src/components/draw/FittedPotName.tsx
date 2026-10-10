import { useLayoutEffect, useRef } from "react";

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
      range.selectNodeContents(element);
      const naturalWidth = range.getBoundingClientRect().width;
      if (naturalWidth > element.clientWidth && element.clientWidth > 0) {
        element.style.fontSize = `${maximum * element.clientWidth / naturalWidth * .98}px`;
      }
    };
    fit();
    void document.fonts.ready.then(fit);
    const observer = new ResizeObserver(fit);
    observer.observe(element);
    return () => { disposed = true; observer.disconnect(); };
  }, [name]);
  return <span ref={ref} className="draw-show-pot-name">{name}</span>;
}