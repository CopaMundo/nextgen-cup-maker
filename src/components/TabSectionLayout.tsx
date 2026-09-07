import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import type { LucideIcon } from "lucide-react";

interface Section {
  id: string;
  label: string;
  icon?: LucideIcon;
}

interface TabSectionLayoutProps {
  title: string;
  icon?: LucideIcon;
  sections: Section[];
  activeSection: string;
  onSectionChange: (id: string) => void;
  children: React.ReactNode;
  actions?: React.ReactNode;
}

export function TabSectionLayout({
  title,
  icon: Icon,
  sections,
  activeSection,
  onSectionChange,
  children,
  actions,
}: TabSectionLayoutProps) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-0 flex-1 gap-6">
      {/* Sub-navigation sidebar */}
      <aside className="sticky top-0 hidden h-fit w-56 shrink-0 flex-col gap-1 lg:flex">
        <div className="mb-3 flex items-center gap-2 border-b border-border pb-3">
          {Icon && <Icon className="h-5 w-5 text-primary" />}
          <h2 className="font-display text-lg font-bold text-foreground">{title}</h2>
        </div>
        <nav aria-label={title} className="flex flex-col gap-1">
          {sections.map((section) => {
            const SectionIcon = section.icon;
            const active = activeSection === section.id;
            return (
              <button
                key={section.id}
                type="button"
                onClick={() => onSectionChange(section.id)}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-semibold transition-colors",
                  active
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                {SectionIcon && <SectionIcon className="h-4 w-4 shrink-0" />}
                <span className="truncate">{section.label}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Content */}
      <div className="min-w-0 flex-1">
        {actions && (
          <div className="mb-4 flex items-center justify-end gap-2">{actions}</div>
        )}
        {children}
      </div>
    </div>
  );
}
