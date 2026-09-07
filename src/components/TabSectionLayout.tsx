import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

interface Section {
  id: string;
  label: string;
  icon?: React.ReactNode;
}

interface TabSectionLayoutProps {
  title: string;
  icon?: React.ReactNode;
  sections: Section[];
  activeSection: string;
  onSectionChange: (id: string) => void;
  children: React.ReactNode;
  actions?: React.ReactNode;
}

export function TabSectionLayout({
  title,
  icon,
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
          {icon && <span className="text-primary">{icon}</span>}
          <h2 className="font-display text-lg font-bold text-foreground">{title}</h2>
        </div>
        <nav aria-label={title} className="flex flex-col gap-1">
          {sections.map((section) => {
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
                {section.icon && <span className="shrink-0">{section.icon}</span>}
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
