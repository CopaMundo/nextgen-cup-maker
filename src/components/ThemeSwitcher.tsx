import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import { Sun, Moon } from "lucide-react";

const ThemeSwitcher = () => {
  const { mode, toggleMode } = useTheme();
  const { user } = useAuth();

  if (!user) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <button
        onClick={toggleMode}
        className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 shadow-2xl text-muted-foreground hover:text-foreground transition-colors"
        title={mode === "dark" ? "Switch naar light mode" : "Switch naar dark mode"}
      >
        {mode === "dark" ? <Sun className="h-4 w-4 text-primary" /> : <Moon className="h-4 w-4 text-primary" />}
        <span className="text-xs font-medium">{mode === "dark" ? "Light" : "Dark"}</span>
      </button>
    </div>
  );
};

export default ThemeSwitcher;
