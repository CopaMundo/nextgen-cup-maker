import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  resolveStandingsColumns,
  type StandingsColumnsConfig,
  type PointsColumnsConfig,
  type SetsColumnsConfig,
} from "@/lib/standingsDisplay";

interface Props {
  tournament: any;
  onUpdate: (t: any) => void;
}

const POINTS_COLS: { key: keyof PointsColumnsConfig; label: string; short: string }[] = [
  { key: "gp", label: "Gespeelde wedstrijden", short: "GS" },
  { key: "w",  label: "Winst", short: "W" },
  { key: "d",  label: "Gelijk", short: "G" },
  { key: "l",  label: "Verlies", short: "V" },
  { key: "gf", label: "Doelpunten voor", short: "+" },
  { key: "ga", label: "Doelpunten tegen", short: "−" },
  { key: "gd", label: "Doelsaldo", short: "+/−" },
];

const SETS_COLS: { key: keyof SetsColumnsConfig; label: string; short: string }[] = [
  { key: "gp", label: "Gespeelde wedstrijden", short: "GS" },
  { key: "w",  label: "Winst", short: "W" },
  { key: "d",  label: "Gelijk", short: "G" },
  { key: "l",  label: "Verlies", short: "V" },
  { key: "sf", label: "Sets voor", short: "S+" },
  { key: "sa", label: "Sets tegen", short: "S−" },
  { key: "sd", label: "Setsaldo", short: "S+/−" },
  { key: "pf", label: "Punten per set voor", short: "P/S+" },
  { key: "pa", label: "Punten per set tegen", short: "P/S−" },
  { key: "pd", label: "Punten per set saldo", short: "P/S+/−" },
];

const persistColumns = async (
  tournament: any,
  next: StandingsColumnsConfig,
  onUpdate: (t: any) => void,
  toast: ReturnType<typeof useToast>["toast"],
) => {
  const { error } = await supabase
    .from("tournaments")
    .update({ standings_columns: next as any })
    .eq("id", tournament.id);
  if (error) {
    toast({ title: "Opslaan mislukt", description: error.message, variant: "destructive" });
  } else {
    onUpdate({ ...tournament, standings_columns: next });
  }
};

/**
 * Compacte inline variant — getoond binnen een puntentelling onder "Criteria aanpassen".
 * `mode` bepaalt welke kolomset getoond wordt.
 */
export const StandingsColumnsInline = ({
  tournament,
  onUpdate,
  mode,
}: Props & { mode: "points" | "sets" }) => {
  const { toast } = useToast();
  const [cfg, setCfg] = useState<StandingsColumnsConfig>(
    resolveStandingsColumns(tournament.standings_columns),
  );

  const cols = mode === "points" ? POINTS_COLS : SETS_COLS;
  const current = mode === "points" ? cfg.points : cfg.sets;

  const toggle = async (key: string, val: boolean) => {
    const next: StandingsColumnsConfig =
      mode === "points"
        ? { ...cfg, points: { ...cfg.points, [key]: val } as PointsColumnsConfig }
        : { ...cfg, sets:   { ...cfg.sets,   [key]: val } as SetsColumnsConfig };
    setCfg(next);
    await persistColumns(tournament, next, onUpdate, toast);
  };

  return (
    <div className="pt-4 border-t border-border space-y-2">
      <h4 className="text-sm font-semibold text-foreground">Standen tabellen</h4>
      <p className="text-xs text-muted-foreground">
        Bepaal welke kolommen zichtbaar zijn in de klassementen. Punten (P) staat altijd aan.
      </p>
      <div className="rounded-lg border border-border bg-secondary/30 px-3 py-3 mt-2">
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          {cols.map(({ key, label, short }) => (
            <label
              key={key}
              title={label}
              className="flex items-center gap-2 cursor-pointer select-none"
            >
              <Checkbox
                checked={(current as any)[key]}
                onCheckedChange={(v) => toggle(key as string, !!v)}
              />
              <span className="text-xs font-medium text-foreground">{short}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
};

/** Oude globale variant — behouden voor backwards compatibiliteit, niet meer gebruikt. */
const StandingsColumnsSettings = ({ tournament, onUpdate }: Props) => {
  const { toast } = useToast();
  const [cfg, setCfg] = useState<StandingsColumnsConfig>(
    resolveStandingsColumns(tournament.standings_columns),
  );

  const persist = async (next: StandingsColumnsConfig) => {
    setCfg(next);
    await persistColumns(tournament, next, onUpdate, toast);
  };

  return (
    <div className="rounded-xl border border-border bg-card p-6 space-y-6">
      <div className="space-y-2">
        <Label>Klassement-kolommen</Label>
        <p className="text-xs text-muted-foreground">
          Bepaal welke kolommen zichtbaar zijn in de klassementen. Punten (P) staat altijd aan.
        </p>
      </div>

      <div className="space-y-3">
        <h4 className="text-sm font-bold text-foreground">Bij puntensysteem</h4>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {POINTS_COLS.map(({ key, label, short }) => (
            <div key={key} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background/40 px-3 py-2">
              <div className="min-w-0">
                <div className="text-sm font-medium text-foreground truncate">{label}</div>
                <div className="text-[11px] text-muted-foreground">{short}</div>
              </div>
              <Switch checked={cfg.points[key]} onCheckedChange={(v) => persist({ ...cfg, points: { ...cfg.points, [key]: v } })} />
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <h4 className="text-sm font-bold text-foreground">Bij setsysteem</h4>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {SETS_COLS.map(({ key, label, short }) => (
            <div key={key} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background/40 px-3 py-2">
              <div className="min-w-0">
                <div className="text-sm font-medium text-foreground truncate">{label}</div>
                <div className="text-[11px] text-muted-foreground">{short}</div>
              </div>
              <Switch checked={cfg.sets[key]} onCheckedChange={(v) => persist({ ...cfg, sets: { ...cfg.sets, [key]: v } })} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default StandingsColumnsSettings;
