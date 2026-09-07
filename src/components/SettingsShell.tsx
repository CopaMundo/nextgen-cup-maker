import type { ComponentType, ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface SettingsShellItem {
  id: string;
  label: string;
  icon?: ComponentType<{ className?: string }>;
  /** Alternative to `icon` when the icon is already an element. */
  iconNode?: ReactNode;
}

interface SettingsNavProps {
  title: string;
  description?: string;
  icon: ComponentType<{ className?: string }>;
  items: readonly SettingsShellItem[];
  activeId: string;
  onSelect: (id: string) => void;
  className?: string;
}

/** Left-hand navigation card for the desktop two-pane tab layout. */
export const SettingsNav = ({
  title,
  description,
  icon: Icon,
  items,
  activeId,
  onSelect,
  className,
}: SettingsNavProps) => (
  <aside className={cn("w-60 shrink-0 self-start rounded-xl border border-border bg-card p-4", className)}>
    <div className="flex flex-col gap-2 px-2 pb-4 pt-2">
      <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <h2 className="font-display text-lg font-bold leading-tight text-foreground">{title}</h2>
      {description && <p className="text-sm leading-snug text-muted-foreground">{description}</p>}
    </div>
    <nav className="flex flex-col gap-1" aria-label={title}>
      {items.map((item) => {
        const ItemIcon = item.icon;
        const active = item.id === activeId;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect(item.id)}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-lg border-l-2 px-3 py-2.5 text-left text-sm font-semibold transition-colors",
              active
                ? "border-primary bg-primary/10 text-primary"
                : "border-transparent text-muted-foreground hover:bg-accent/40 hover:text-foreground"
            )}
          >
            {ItemIcon ? <ItemIcon className="h-[18px] w-[18px] shrink-0" /> : item.iconNode}
            <span className="min-w-0 flex-1 truncate">{item.label}</span>
          </button>
        );
      })}
    </nav>
  </aside>
);

interface SectionHeaderProps {
  icon?: ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

/** Content-card header: icon, title, description and an optional action on the right. */
export const SectionHeader = ({ icon: Icon, title, description, action, className }: SectionHeaderProps) => (
  <div className={cn("flex items-start gap-4", className)}>
    {Icon && (
      <div className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary sm:flex">
        <Icon className="h-5 w-5" />
      </div>
    )}
    <div className="min-w-0 flex-1">
      <h2 className="font-display text-lg font-bold leading-tight text-foreground sm:text-xl">{title}</h2>
      {description && <p className="mt-1 text-xs text-muted-foreground sm:text-sm">{description}</p>}
    </div>
    {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
  </div>
);

export default SettingsNav;
