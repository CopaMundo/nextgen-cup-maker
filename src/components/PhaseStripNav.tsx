import { useEffect, useState } from "react";
import { Pencil, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PhaseHeaderState {
  phases: { phaseNumber: number; label: string; canDelete: boolean }[];
  activePhaseNumber: number | null;
  onSelect: (n: number) => void;
  onEdit: (n: number) => void;
  onDelete: (n: number) => void;
  onAdd: () => void;
}

const PHASE_WINDOW = 3;

export const PhaseStripNav = ({
  phases,
  activePhaseNumber,
  onSelect,
  onEdit,
  onDelete,
}: Omit<PhaseHeaderState, "onAdd">) => {
  const numbers = phases.map((p) => p.phaseNumber);
  const labelFor = (n: number) => phases.find((p) => p.phaseNumber === n)?.label ?? `Fase ${n}`;
  const canDelete = (n: number) => phases.find((p) => p.phaseNumber === n)?.canDelete ?? false;
  const windowSize = Math.min(PHASE_WINDOW, Math.max(1, numbers.length));
  const maxStart = Math.max(0, numbers.length - windowSize);
  const [windowStart, setWindowStart] = useState(0);

  useEffect(() => {
    if (activePhaseNumber === null) return;
    const idx = numbers.indexOf(activePhaseNumber);
    if (idx === -1) return;
    const centered = idx - Math.floor((windowSize - 1) / 2);
    setWindowStart(Math.min(maxStart, Math.max(0, centered)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePhaseNumber, windowSize, maxStart]);

  const safeStart = Math.min(windowStart, maxStart);
  const visible = numbers.slice(safeStart, safeStart + windowSize);
  const showNav = numbers.length > windowSize;
  const middleIndex = Math.floor(visible.length / 2);

  const shift = (dir: -1 | 1) => {
    const next = Math.min(maxStart, Math.max(0, safeStart + dir));
    setWindowStart(next);
    const mid = numbers[next + middleIndex];
    if (mid !== undefined && mid !== activePhaseNumber) onSelect(mid);
  };

  return (
    <div className="flex min-w-0 items-center gap-2">
      {showNav && (
        <button
          type="button"
          onClick={() => shift(-1)}
          disabled={safeStart === 0}
          className="shrink-0 p-1 text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
          aria-label="Vorige fases"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
      )}

      <div className="flex items-center gap-4 overflow-hidden whitespace-nowrap">
        {visible.map((n) => {
          const isActive = activePhaseNumber === n;
          return (
            <div key={n} className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={() => onSelect(n)}
                className={cn(
                  "py-1 text-sm font-semibold uppercase tracking-wide transition-colors",
                  isActive
                    ? "border-b-2 border-primary text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {labelFor(n)}
              </button>
              {isActive && (
                <>
                  <button
                    type="button"
                    onClick={() => onEdit(n)}
                    className="rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    title="Naam bewerken"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  {canDelete(n) && (
                    <button
                      type="button"
                      onClick={() => onDelete(n)}
                      className="rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-destructive"
                      title="Fase verwijderen"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>

      {showNav && (
        <button
          type="button"
          onClick={() => shift(1)}
          disabled={safeStart >= maxStart}
          className="shrink-0 p-1 text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
          aria-label="Volgende fases"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      )}
    </div>
  );
};

export default PhaseStripNav;
