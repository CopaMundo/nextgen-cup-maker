import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Moon, Sun, Search, User, LogOut, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";

interface Props {
  title: string;
  tournamentName: string;
  selectors: ReactNode;
  navigation: ReactNode;
  actions: ReactNode;
  actionsRef: (element: HTMLDivElement | null) => void;
}

export function DesktopAdminHeader({ title, tournamentName, selectors, navigation, actions, actionsRef }: Props) {
  const { mode, toggleMode } = useTheme();
  const { signOut } = useAuth();
  return (
    <header className="admin-workspace-header print:hidden">
      <div className="admin-workspace-heading">
        <div className="min-w-0">
          <div className="admin-workspace-breadcrumb">
            <Link to="/dashboard">Mijn toernooien</Link>
            <ChevronRight className="h-3 w-3 shrink-0" />
            <span className="truncate" title={tournamentName}>{tournamentName}</span>
          </div>
          <h1 className="admin-workspace-title">{title}</h1>
        </div>
        <div className="admin-workspace-utilities">
          <Button asChild variant="ghost" size="icon" title="Zoek toernooien" aria-label="Zoek toernooien"><Link to="/search"><Search className="h-4 w-4" /></Link></Button>
          <Button variant="ghost" size="icon" onClick={toggleMode} title={mode === "dark" ? "Lichte weergave" : "Donkere weergave"} aria-label={mode === "dark" ? "Lichte weergave" : "Donkere weergave"}>{mode === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}</Button>
          <span className="h-5 border-l border-border" />
          <Button asChild variant="outline" size="icon" title="Profiel" aria-label="Profiel"><Link to="/profile"><User className="h-4 w-4" /></Link></Button>
          <Button variant="ghost" size="icon" onClick={signOut} title="Uitloggen" aria-label="Uitloggen"><LogOut className="h-4 w-4" /></Button>
        </div>
      </div>
      <div className="admin-workspace-toolbar">
        <div className="admin-workspace-navigation">{navigation}</div>
        <div className="admin-workspace-controls">
          {selectors}
          {actions}
          <div ref={actionsRef} className="flex items-center gap-2 empty:hidden" />
        </div>
      </div>
    </header>
  );
}