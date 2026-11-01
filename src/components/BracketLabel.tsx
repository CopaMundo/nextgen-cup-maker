import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export const isStandardBracketLabel = (name: string) => /^(?:(?:Winnaar|Verliezer)\s+)?(?:P\d+-\d+:\s*)?(?:(?:Finale|Halve\s*finale|Kwart\s*finale|Achtste\s*finale|Zestiende\s*finale|Ronde)(?:\s+\d+)?(?:\s*:\s*Plaats\s+\d+-\d+)?(?:\s+\((?:Heen|Terug|HEEN|TERUG)\))?|\d+e\s+Groep\s+\S+|LEGE PLEK|BYE)$/i.test(name);

/** Standard labels may wrap; custom names remain bounded with their full tooltip. */
export default function BracketLabel({ name, full = false, className = "" }: { name: string; full?: boolean; className?: string }) {
  return <Tooltip>
    <TooltipTrigger asChild>
      <span title={name} className={`block min-w-0 ${full ? "whitespace-normal break-words" : "truncate"} ${className}`}>{name}</span>
    </TooltipTrigger>
    <TooltipContent className="max-w-sm break-words">{name}</TooltipContent>
  </Tooltip>;
}