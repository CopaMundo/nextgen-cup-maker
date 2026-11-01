import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/** Standard labels may wrap; custom names remain bounded with their full tooltip. */
export default function BracketLabel({ name, full = false, className = "" }: { name: string; full?: boolean; className?: string }) {
  return <Tooltip>
    <TooltipTrigger asChild>
      <span title={name} className={`block min-w-0 ${full ? "whitespace-normal break-words" : "truncate"} ${className}`}>{name}</span>
    </TooltipTrigger>
    <TooltipContent className="max-w-sm break-words">{name}</TooltipContent>
  </Tooltip>;
}