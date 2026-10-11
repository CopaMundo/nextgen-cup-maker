
export const drawPreparationSteps = ["Type loting", "Indeling & teams", "Regels", "Loting show instellingen"];

export function DrawWizardHeader({ tournamentName, formatName, step, onClose }: {
  tournamentName: string; formatName: string; step: string; onClose: () => void;
}) {
  const current = step === "method" ? 0 : step === "teams" || step === "pots" ? 1 : step === "rules" ? 2 : 3;
  void onClose;
  if (step === "draw") return null;
  return <header className="shrink-0 space-y-3 border-b border-primary/30 bg-background pb-3 pr-10">
    <span className="text-xs text-muted-foreground">Stap {current + 1} van 4</span>
    <h1 className="break-words text-lg font-semibold">Live loting{tournamentName ? ` ${tournamentName}` : ""} · {formatName}</h1>
    <ol aria-label="Lotingsstappen" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {drawPreparationSteps.map((label, index) => <li key={label} aria-current={current === index ? "step" : undefined} className={`min-w-0 border-t-2 pt-2 text-xs leading-relaxed ${current === index ? "border-primary font-semibold text-primary" : "border-border text-muted-foreground"}`}>{index + 1}. {label}</li>)}
    </ol>
  </header>;
}