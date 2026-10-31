import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function HorizontalRail({ children, label }: { children: ReactNode; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });
  const update = () => {
    const element = ref.current;
    if (!element) return;
    setEdges({ left: element.scrollLeft > 1, right: element.scrollLeft + element.clientWidth < element.scrollWidth - 1 });
  };
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    if (element.firstElementChild) observer.observe(element.firstElementChild);
    return () => observer.disconnect();
  }, [children]);
  const scroll = (direction: number) => {
    const element = ref.current;
    element?.scrollBy({ left: direction * Math.max(160, element.clientWidth * 0.75), behavior: "smooth" });
  };
  const overflow = edges.left || edges.right;
  return <div className="flex min-w-0 flex-1 items-center gap-1.5">
    {overflow && <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" aria-label={`${label} naar links scrollen`} disabled={!edges.left} onClick={() => scroll(-1)}><ChevronLeft className="h-4 w-4" /></Button>}
    <div ref={ref} onScroll={update} aria-label={label} className="min-w-0 flex-1 overflow-x-auto scrollbar-none">
      <div className="flex w-max min-w-full items-stretch gap-2 py-0.5">{children}</div>
    </div>
    {overflow && <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" aria-label={`${label} naar rechts scrollen`} disabled={!edges.right} onClick={() => scroll(1)}><ChevronRight className="h-4 w-4" /></Button>}
  </div>;
}