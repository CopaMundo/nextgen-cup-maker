import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export const drawPreparationSteps = ["Type loting", "Indeling & teams", "Regels", "Loting show instellingen"];

export function DrawWizardHeader({ tournamentName, formatName, step, onClose }: {
  tournamentName: string; formatName: string; step: string; onClose: () => void;
}) {
  const current = step === "method" ? 0 : step === "teams" || step === "pots" ? 1 : step === "rules" ? 2 : 3;
  return <header className="shrink-0 space-y-3 border-b border-primary/30 bg-background pb-3">
    <div className="flex items-center justify-between gap-3 rounded-md border border-primary/30 p-2">
      <Button variant="outline" size="sm" onClick={onClose}><ArrowLeft className="h-4 w-4" />Terug naar toernooi</Button>
      <span className="text-xs text-muted-foreground">{step === "draw" ? "Live loting show" : `Stap ${current + 1} van 4`}</span>
    </div>
    <h1 className="break-words text-lg font-semibold">Live loting{tournamentName ? ` ${tournamentName}` : ""} · {formatName}</h1>
    <ol aria-label="Lotingsstappen" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {drawPreparationSteps.map((label, index) => <li key={label} aria-current={current === index ? "step" : undefined} className={`min-w-0 border-t-2 pt-2 text-xs leading-relaxed ${current === index ? "border-primary font-semibold text-primary" : "border-border text-muted-foreground"}`}>{index + 1}. {label}</li>)}
    </ol>
  </header>;
}