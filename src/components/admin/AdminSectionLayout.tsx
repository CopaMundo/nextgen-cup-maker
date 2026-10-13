import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface AdminSectionLink { id: string; label: string }

/** Sections stay mounted; navigation tracks the actual admin scrolling pane. */
export default function AdminSectionLayout({ sections, scrollRoot, children }: {
  sections: readonly AdminSectionLink[];
  scrollRoot: RefObject<HTMLDivElement>;
  children: ReactNode;
}) {
  const content = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(sections[0]?.id ?? "");

  useEffect(() => {
    const root = scrollRoot.current;
    const body = content.current;
    if (!root || !body) return;
    let frame = 0;
    const update = () => {
      const threshold = root.getBoundingClientRect().top + 110;
      let current = sections[0]?.id ?? "";
      for (const section of sections) {
        const element = body.querySelector<HTMLElement>(`[data-admin-section="${section.id}"]`);
        if (element && element.getBoundingClientRect().top <= threshold) current = section.id;
      }
      if (root.scrollHeight > root.clientHeight && root.scrollTop + root.clientHeight >= root.scrollHeight - 2) {
        current = sections[sections.length - 1]?.id ?? current;
      }
      setActive(current);
    };
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };
    const observer = new ResizeObserver(onScroll);
    observer.observe(body);
    root.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    update();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      root.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [sections, scrollRoot]);

  const jump = (id: string) => {
    const root = scrollRoot.current;
    const element = content.current?.querySelector<HTMLElement>(`[data-admin-section="${id}"]`);
    if (!root || !element) return;
    root.scrollTo({
      top: root.scrollTop + element.getBoundingClientRect().top - root.getBoundingClientRect().top - 88,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
    });
    setActive(id);
    const heading = element.querySelector<HTMLElement>("h2");
    if (heading) {
      heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
    }
  };

  return <div className="admin-section-layout">
    <nav aria-label="Sectienavigatie" className="admin-section-nav print:hidden">
      <p className="admin-section-nav-label">Op deze pagina</p>
      {sections.map(section => <Button key={section.id} variant="ghost"
        aria-current={active === section.id ? "location" : undefined}
        aria-controls={`admin-section-${section.id}`}
        onClick={() => jump(section.id)}
        className={cn("admin-section-link", active === section.id && "admin-section-link-active")}>
        <span className="min-w-0 whitespace-normal text-left">{section.label}</span>
      </Button>)}
    </nav>
    <div ref={content} className="admin-section-body min-w-0">{children}</div>
  </div>;
}

export function AdminSection({ id, title, children }: { id: string; title?: string; children: ReactNode }) {
  return <section id={`admin-section-${id}`} data-admin-section={id} className="admin-stacked-section">
    {title && <h2 className="section-title admin-section-heading">{title}</h2>}
    {children}
  </section>;
}