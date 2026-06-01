import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export interface ScoringSystemOption {
  id: string;
  name: string;
  sort_order: number;
  scoring_type?: string | null;
  num_sets?: number | null;
  playoff_mode?: boolean | null;
}

interface Props {
  systems: ScoringSystemOption[];
  /** Selected scoring system id. Use "__mixed__" to display "Meerdere". */
  value: string | null;
  onChange: (value: string) => void;
  label?: string;
  hint?: string;
  className?: string;
  /** Show a "Meerdere" placeholder option (used in format edit when child entities have mixed systems) */
  showMixed?: boolean;
}

export const MIXED_VALUE = "__mixed__";

/**
 * Selector for choosing a scoring system. Shows nothing when there is only 1 system
 * (because there is no choice to make).
 *
 * Always resolves to a concrete scoring system id — no "default/inherit" option.
 */
const ScoringSystemSelector = ({
  systems,
  value,
  onChange,
  label = "Puntentelling",
  hint,
  className,
  showMixed = false,
}: Props) => {
  if (systems.length <= 1) return null;

  const sorted = [...systems].sort((a, b) => a.sort_order - b.sort_order);
  const effectiveValue = value ?? sorted[0]?.id ?? "";

  return (
    <div className={`space-y-1.5 ${className || ""}`}>
      <Label className="text-sm font-medium">{label}</Label>
      <Select
        value={effectiveValue}
        onValueChange={(v) => onChange(v)}
      >
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {showMixed && (
            <SelectItem value={MIXED_VALUE} disabled>
              Meerdere
            </SelectItem>
          )}
          {sorted.map((s) => (
            <SelectItem key={s.id} value={s.id}>
              {s.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
};

export default ScoringSystemSelector;
