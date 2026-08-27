import * as React from "react";
import { format, parse, parseISO, isValid, addMonths, subMonths, setYear } from "date-fns";
import { nl } from "date-fns/locale";
import { CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface DatePickerProps {
  value?: string;
  onChange: (date: string) => void;
  placeholder?: string;
  className?: string;
}

const MASK = "dd/mm/jjjj";

const maskFromDigits = (raw: string) => {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  let masked = digits.slice(0, 2);
  if (digits.length >= 3) masked += "/" + digits.slice(2, 4);
  if (digits.length >= 5) masked += "/" + digits.slice(4, 8);
  return masked;
};

export function DatePicker({
  value,
  onChange,
  placeholder = "Kies een datum",
  className,
}: DatePickerProps) {
  const date = value ? parseISO(value) : undefined;
  const validDate = date && isValid(date) ? date : undefined;

  const [inputValue, setInputValue] = React.useState(
    validDate ? format(validDate, "dd/MM/yyyy") : ""
  );
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState<Date | undefined>(validDate);
  const [month, setMonth] = React.useState<Date>(validDate ?? new Date());

  React.useEffect(() => {
    setInputValue(validDate ? format(validDate, "dd/MM/yyyy") : "");
  }, [value]);

  // Persistent mask: everything not typed yet stays visible as DD/MM/JJJJ.
  const remainder = MASK.slice(inputValue.length);

  const commitInput = (typedValue: string) => {
    if (!typedValue.trim()) {
      onChange("");
      return;
    }
    const parsed = parse(typedValue, "dd/MM/yyyy", new Date());
    if (isValid(parsed) && format(parsed, "dd/MM/yyyy") === typedValue) {
      onChange(format(parsed, "yyyy-MM-dd"));
    }
  };

  const openDialog = () => {
    const base = validDate ?? new Date();
    setDraft(validDate);
    setMonth(base);
    setOpen(true);
  };

  const confirm = () => {
    if (draft && isValid(draft)) onChange(format(draft, "yyyy-MM-dd"));
    setOpen(false);
  };

  const years = React.useMemo(
    () => Array.from({ length: 201 }, (_, i) => 1900 + i),
    []
  );

  return (
    <>
      <div className={cn("relative h-10 w-full", className)}>
        <Input
          type="text"
          inputMode="numeric"
          value={inputValue}
          onChange={(event) => {
            const typedValue = maskFromDigits(event.target.value);
            setInputValue(typedValue);
            commitInput(typedValue);
          }}
          onBlur={() => {
            if (validDate) setInputValue(format(validDate, "dd/MM/yyyy"));
          }}
          placeholder=""
          aria-label={placeholder}
          className="h-full w-full pr-10"
        />
        {remainder && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 left-3 right-10 flex items-center overflow-hidden text-sm"
          >
            <span className="invisible whitespace-pre">{inputValue}</span>
            <span className="whitespace-pre text-muted-foreground/60">{remainder}</span>
          </div>
        )}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Open kalender"
          onClick={openDialog}
          className="absolute right-0 top-0 h-full w-10 bg-transparent text-primary hover:bg-transparent hover:text-primary dark:text-white dark:hover:bg-transparent dark:hover:text-white"
        >
          <CalendarIcon className="h-4 w-4" />
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-[340px] gap-0 overflow-hidden p-0">
          <div data-mode="light" className="bg-popover text-popover-foreground">
            {/* Material-style header */}
            <div className="bg-primary px-4 pb-3 pt-4 text-primary-foreground">
              <DialogTitle className="text-[11px] font-medium uppercase tracking-wide opacity-80">
                Selecteer datum
              </DialogTitle>
              <p className="mt-1 text-xl font-semibold">
                {draft && isValid(draft)
                  ? format(draft, "EEE d MMM yyyy", { locale: nl })
                  : "Geen datum"}
              </p>
            </div>

            {/* Month navigation */}
            <div className="flex items-center justify-between gap-2 px-3 pt-3">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Vorige maand"
                className="h-8 w-8"
                onClick={() => setMonth((m) => subMonths(m, 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium capitalize">
                  {format(month, "LLLL", { locale: nl })}
                </span>
                <Select
                  value={month.getFullYear().toString()}
                  onValueChange={(val) => setMonth((m) => setYear(m, parseInt(val)))}
                >
                  <SelectTrigger className="h-7 w-[80px] text-xs font-medium">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="z-[200] max-h-72 pointer-events-auto">
                    {years.map((y) => (
                      <SelectItem key={y} value={y.toString()} className="text-xs">
                        {y}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Volgende maand"
                className="h-8 w-8"
                onClick={() => setMonth((m) => addMonths(m, 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            <Calendar
              mode="single"
              selected={draft}
              onSelect={(selected) => selected && setDraft(selected)}
              month={month}
              onMonthChange={setMonth}
              locale={nl}
              weekStartsOn={1}
              showOutsideDays={false}
              components={{ Caption: () => null }}
              className="p-3 pointer-events-auto"
            />

            <DialogFooter className="flex-row justify-end gap-2 border-t border-border px-3 py-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Annuleren
              </Button>
              <Button type="button" onClick={confirm} disabled={!draft}>
                OK
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
