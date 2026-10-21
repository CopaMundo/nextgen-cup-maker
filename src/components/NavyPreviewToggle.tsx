import { useEffect, useState } from "react";

type NavyVariant = "standaard" | "deep" | "royal";

const STORAGE_KEY = "copa-navy-preview";

const OPTIONS: { value: NavyVariant; label: string; swatch: string }[] = [
  { value: "standaard", label: "Huidig", swatch: "#121826" },
  { value: "deep", label: "Optie 1 · Deep Navy", swatch: "#111C35" },
  { value: "royal", label: "Optie 2 · Royal Navy", swatch: "#142143" },
];

/** Tijdelijke vergelijkingsschakelaar voor de nachtblauwe varianten (preview). */
const NavyPreviewToggle = () => {
  const [variant, setVariant] = useState<NavyVariant>(() => {
    return (localStorage.getItem(STORAGE_KEY) as NavyVariant) || "standaard";
  });

  useEffect(() => {
    if (variant === "standaard") {
      document.documentElement.removeAttribute("data-navy");
      localStorage.removeItem(STORAGE_KEY);
    } else {
      document.documentElement.setAttribute("data-navy", variant);
      localStorage.setItem(STORAGE_KEY, variant);
    }
  }, [variant]);

  return (
    <div className="fixed bottom-3 left-3 z-[100] flex items-center gap-1 rounded-full border border-border bg-card/95 p-1 shadow-lg backdrop-blur sm:bottom-6 sm:left-6">
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => setVariant(option.value)}
          className={`flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[11px] font-medium transition-colors ${
            variant === option.value
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
          title={option.label}
        >
          <span
            className="h-3 w-3 rounded-full border border-white/20"
            style={{ backgroundColor: option.swatch }}
          />
          <span className="hidden sm:inline">{option.label}</span>
        </button>
      ))}
    </div>
  );
};

export default NavyPreviewToggle;
