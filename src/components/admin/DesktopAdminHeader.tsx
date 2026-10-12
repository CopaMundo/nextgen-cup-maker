import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Moon, Sun, Search, User, LogOut, ChevronLeft } from "lucide-react";
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
  primaryNavigation?: ReactNode;
  tournamentLogo?: string | null;
}

export function DesktopAdminHeader({ title, tournamentName, selectors, navigation, actions, actionsRef, primaryNavigation, tournamentLogo }: Props) {
  const { mode, toggleMode } = useTheme();
  const { signOut } = useAuth();
  return (
    <header className="admin-workspace-header print:hidden">
      <div className="admin-command-bar">
        <Link to="/dashboard" className="admin-command-identity" title="Mijn toernooien">
          <ChevronLeft className="h-4 w-4 shrink-0 text-muted-foreground" />
          {tournamentLogo && <img src={tournamentLogo} alt="" className="h-9 w-9 object-contain" />}
          <span><small>COPA MUNDO</small><strong>{tournamentName}</strong></span>
        </Link>
        <div className="admin-workspace-utilities">
          <Button asChild variant="ghost" size="icon" title="Zoek toernooien" aria-label="Zoek toernooien"><Link to="/search"><Search className="h-4 w-4" /></Link></Button>
          <Button variant="ghost" size="icon" onClick={toggleMode} title={mode === "dark" ? "Lichte weergave" : "Donkere weergave"} aria-label={mode === "dark" ? "Lichte weergave" : "Donkere weergave"}>{mode === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}</Button>
          <Button asChild variant="outline" size="icon" title="Profiel" aria-label="Profiel"><Link to="/profile"><User className="h-4 w-4" /></Link></Button>
          <Button variant="ghost" size="icon" onClick={signOut} title="Uitloggen" aria-label="Uitloggen"><LogOut className="h-4 w-4" /></Button>
        </div>
      </div>
      {primaryNavigation}
      <div className="admin-workspace-heading">
        <div className="min-w-0">
          <h1 className="admin-workspace-title">{title}</h1>
        </div>
        <div className="admin-workspace-controls">
          {selectors}
          {actions}
          <div ref={actionsRef} className="flex flex-wrap items-center gap-2 empty:hidden" />
        </div>
      </div>
      <div className="admin-workspace-toolbar">
        <div className="admin-workspace-navigation">{navigation}</div>
      </div>
    </header>
  );
}