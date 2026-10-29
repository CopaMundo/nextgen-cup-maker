import type { ReactNode } from "react";
import { Info } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/** Section label with an info tooltip, matching the "Landvlag bij deelnemers" pattern. */
export const InfoHeading = ({
  title,
  info,
  htmlFor,
  right,
  className,
  labelClassName,
}: {
  title: string;
  info?: ReactNode;
  htmlFor?: string;
  right?: ReactNode;
  className?: string;
  /** Extra styling voor het label zelf (default stijl van ui/label blijft staan). */
  labelClassName?: string;
}) => (
  <div className={cn("flex min-h-5 items-center justify-between gap-3", className)}>
    <div className="flex min-w-0 items-center gap-1.5">
      <Label htmlFor={htmlFor} className={labelClassName}>{title}</Label>
      {info && (
        <TooltipProvider delayDuration={150}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button type="button" aria-label={`Uitleg: ${title}`} className="shrink-0 text-muted-foreground transition-colors hover:text-foreground">
                <Info className="h-3.5 w-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs text-xs">{info}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
    {right}
  </div>
);
