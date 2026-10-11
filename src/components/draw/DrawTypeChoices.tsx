import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";

export type DrawMethod = "random" | "pots" | "seeds";
export type DrawScope = "full" | "groups" | "rounds";

export function DrawChoice({ label, description, selected, disabled, onClick }: {
  label: string; description: string; selected: boolean; disabled?: boolean; onClick: () => void;
}) {
  return <Button type="button" variant="outline" aria-label={label} aria-pressed={selected} disabled={disabled} onClick={onClick}
    className={`draw-choice relative h-auto min-h-36 w-full flex-col items-start justify-start gap-2 whitespace-normal p-5 text-left ${selected ? "border-y-primary" : "border-y-border hover:border-y-primary/30"}`}>
    <span className="flex w-full items-start justify-between gap-3 text-sm font-semibold text-foreground">{label}{selected && <Check className="h-4 w-4 shrink-0 text-primary" />}</span>
    <span className="text-xs font-normal leading-relaxed text-muted-foreground">{description}</span>
  </Button>;
}

export function DrawTypeChoices({ format = "group", value, onChange, seedsDisabled, potsDisabled }: {
  format?: "group" | "knockout" | "single_match"; value: DrawMethod; onChange: (value: DrawMethod) => void; seedsDisabled?: boolean; potsDisabled?: boolean;
}) {
  const randomText = format === "knockout" ? "De teams worden volledig willekeurig aan elkaar gekoppeld in het knock-outschema." : format === "single_match" ? "De teams worden volledig willekeurig aan elkaar gekoppeld voor de wedstrijden." : "De teams worden volledig willekeurig over de beschikbare groepen verdeeld.";
  return <div className={`grid gap-3 ${format === "knockout" ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
    <DrawChoice label="Willekeurige loting" description={randomText} selected={value === "random"} onClick={() => onChange("random")} />
    <DrawChoice label="Loting met potindeling" description={format === "group" ? "De teams worden over verschillende potten verdeeld op basis van niveau, ranking of eigen voorkeur." : "De teams worden verdeeld over 2 potten op basis van niveau, ranking of voorkeur (bijv. Pot 1 tegen Pot 2)."} selected={value === "pots"} disabled={potsDisabled} onClick={() => onChange("pots")} />
    {format === "knockout" && <DrawChoice label="Loting met reekshoofden" description="De hoogst geplaatste teams krijgen een vaste beschermde positie in het knock-outschema." selected={value === "seeds"} disabled={seedsDisabled} onClick={() => onChange("seeds")} />}
  </div>;
}

export function DrawTypeProgress({ part }: { part: "scope" | "method" }) {
  return <ol aria-label="Type loting onderdelen" className="grid grid-cols-2 gap-3">
    {(["Wat wil je loten?", "Methode"] as const).map((label, index) => <li key={label} aria-current={(part === "scope" ? 0 : 1) === index ? "step" : undefined} className={`border-t-2 pt-2 text-xs ${(part === "scope" ? 0 : 1) === index ? "border-primary font-semibold text-primary" : "border-border text-muted-foreground"}`}>{index + 1}. {label}</li>)}
  </ol>;
}

export function DrawScopeChoices({ value, onChange, roundsAvailable }: { value: DrawScope; onChange: (value: DrawScope) => void; roundsAvailable: boolean }) {
  return <div className="grid gap-3 md:grid-cols-3">
    <DrawChoice label="Volledige loting" description="Loting voor zowel de groepsfase als alle speelrondes." selected={value === "full"} disabled={!roundsAvailable} onClick={() => onChange("full")} />
    <DrawChoice label="Alleen groepsfase" description="Alleen de groepen worden live geloot; speelrondes worden automatisch gegenereerd." selected={value === "groups"} onClick={() => onChange("groups")} />
    <DrawChoice label="Alleen speelrondes" description="Alleen de speelrondes worden live geloot op basis van de ingedeelde groepen." selected={value === "rounds"} disabled={!roundsAvailable} onClick={() => onChange("rounds")} />
  </div>;
}