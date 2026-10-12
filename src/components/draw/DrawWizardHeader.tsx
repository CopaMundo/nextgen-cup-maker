
export const drawPreparationSteps = ["Type loting", "Indeling & teams", "Regels", "Instellingen Live loting"];

export function DrawWizardHeader({ tournamentName, formatName, step, onClose, typePart }: {
  tournamentName: string; formatName: string; step: string; onClose: () => void; typePart?: "scope" | "method";
}) {
  const current = step === "method" ? 0 : step === "teams" || step === "pots" ? 1 : step === "rules" ? 2 : 3;
  void onClose;
  if (step === "draw") return null;
  return <header className="shrink-0 space-y-3 border-b border-primary/30 bg-background pb-3 pr-10">
    <h1 className="break-words text-lg font-semibold">Live loting{tournamentName ? ` ${tournamentName}` : ""} · {formatName}</h1>
    <ol aria-label="Lotingsstappen" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {drawPreparationSteps.map((label, index) => {
        const active = current === index;
        if (index === 0 && typePart) {
          const half = typePart === "scope" ? 0 : 1;
          return <li key={label} aria-current={active ? "step" : undefined} className={`min-w-0 text-xs leading-relaxed ${active ? "font-semibold text-primary" : "text-muted-foreground"}`}>
            <span aria-hidden className="mb-2 grid grid-cols-2 gap-1">
              {[0, 1].map(part => <span key={part} className={`h-0.5 ${active && part <= half ? "bg-primary" : current > 0 ? "bg-primary/50" : "bg-border"}`} />)}
            </span>
            {index + 1}. {label}
          </li>;
        }
        return <li key={label} aria-current={active ? "step" : undefined} className={`min-w-0 border-t-2 pt-2 text-xs leading-relaxed ${active ? "border-primary font-semibold text-primary" : "border-border text-muted-foreground"}`}>{index + 1}. {label}</li>;
      })}
    </ol>
  </header>;
}
