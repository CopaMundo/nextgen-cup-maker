import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import { Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";

const ThemeSwitcher = () => {
  const { mode, toggleMode } = useTheme();
  const { user } = useAuth();

  if (!user) return null;

  return (
    <div className="fixed bottom-3 right-3 z-50 sm:bottom-6 sm:right-6">
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={toggleMode}
        className="h-10 w-10 bg-card text-muted-foreground shadow-lg sm:h-auto sm:w-auto sm:px-4 sm:py-3"
        title={mode === "dark" ? "Switch naar light mode" : "Switch naar dark mode"}
        aria-label={mode === "dark" ? "Light mode" : "Dark mode"}
      >
        {mode === "dark" ? <Sun className="h-4 w-4 text-primary" /> : <Moon className="h-4 w-4 text-primary" />}
        <span className="hidden text-xs font-medium sm:inline">{mode === "dark" ? "Light" : "Dark"}</span>
      </Button>
    </div>
  );
};

export default ThemeSwitcher;
