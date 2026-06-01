import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export type ThemeMode = "dark" | "light";

interface ThemeContextType {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  toggleMode: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  mode: "dark",
  setMode: () => {},
  toggleMode: () => {},
});

export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [mode, setMode] = useState<ThemeMode>(() => {
    return (localStorage.getItem("copa-mode") as ThemeMode) || "dark";
  });

  const toggleMode = () => setMode(m => m === "dark" ? "light" : "dark");

  useEffect(() => {
    localStorage.setItem("copa-mode", mode);
    document.documentElement.setAttribute("data-mode", mode);
    // Remove legacy theme attribute
    document.documentElement.removeAttribute("data-theme");
  }, [mode]);

  return (
    <ThemeContext.Provider value={{ mode, setMode, toggleMode }}>
      {children}
    </ThemeContext.Provider>
  );
};
