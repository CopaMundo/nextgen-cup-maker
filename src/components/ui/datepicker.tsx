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
  autoFocus?: boolean;
  hideInput?: boolean;
  availableDates?: string[];
  onInvalidPick?: (iso: string) => void;
}

const MASK = "dd/mm/jjjj";

const buildDisplayValue = (digits: string) => {
  const d = digits.padEnd(8, " ");
  const day1 = d[0] === " " ? "d" : d[0];
  const day2 = d[1] === " " ? "d" : d[1];
  const mon1 = d[2] === " " ? "m" : d[2];
  const mon2 = d[3] === " " ? "m" : d[3];
  const yr1 = d[4] === " " ? "j" : d[4];
  const yr2 = d[5] === " " ? "j" : d[5];
  const yr3 = d[6] === " " ? "j" : d[6];
  const yr4 = d[7] === " " ? "j" : d[7];
  return `${day1}${day2}/${mon1}${mon2}/${yr1}${yr2}${yr3}${yr4}`;
};

const extractDigits = (raw: string) => raw.replace(/\D/g, "").slice(0, 8);

const buildPartialValue = (digits: string) => {
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
};

export function DatePicker({
  value,
  onChange,
  placeholder = "Kies een datum",
  className,
  autoFocus,
  hideInput,
  availableDates,
  onInvalidPick,
}: DatePickerProps) {
  const date = value ? parseISO(value) : undefined;
  const validDate = date && isValid(date) ? date : undefined;

  const [digits, setDigits] = React.useState(
    validDate ? format(validDate, "ddMMyyyy") : ""
  );
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState<Date | undefined>(validDate);
  const [month, setMonth] = React.useState<Date>(validDate ?? new Date());
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (!autoFocus) return;
    const frame = window.requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [autoFocus]);

  React.useEffect(() => {
    setDigits(validDate ? format(validDate, "ddMMyyyy") : "");
  }, [value]);

  const displayValue = React.useMemo(() => buildDisplayValue(digits), [digits]);
  const partialValue = React.useMemo(() => buildPartialValue(digits), [digits]);

  const commit = (newDigits: string) => {
    if (newDigits.length !== 8) {
      if (newDigits.length === 0) onChange("");
      return;
    }
    const display = buildDisplayValue(newDigits);
    const parsed = parse(display, "dd/MM/yyyy", new Date());
    if (isValid(parsed) && format(parsed, "dd/MM/yyyy") === display) {
      onChange(format(parsed, "yyyy-MM-dd"));
    }
  };

  const selectAllRef = React.useRef(false);
  const pendingSelectRef = React.useRef<[number, number] | null>(null);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    let newDigits = extractDigits(event.target.value);
    // Full value selected + one digit typed: replace first digit, keep rest selected.
    if (selectAllRef.current && newDigits.length === 1 && digits.length === 8) {
      newDigits = newDigits + digits.slice(1);
      pendingSelectRef.current = [1, buildDisplayValue(newDigits).length];
    }
    selectAllRef.current = false;
    setDigits(newDigits);
    commit(newDigits);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    const allowed = [
      "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown",
      "Home", "End", "Delete", "Backspace", "Tab", "Enter", "Escape"
    ];
    if (allowed.includes(event.key)) return;
    if (event.ctrlKey || event.metaKey) return;
    if (!/^\d$/.test(event.key)) {
      event.preventDefault();
    }
  };

  const handleFocus = () => {
    selectAllRef.current = true;
    inputRef.current?.select();
  };

  const handleMouseDown = (event: React.MouseEvent<HTMLInputElement>) => {
    // Prevent the browser from placing the caret after mouseup; keep full selection.
    event.preventDefault();
    inputRef.current?.focus();
    selectAllRef.current = true;
    inputRef.current?.select();
  };

  const handleBlur = () => {
    if (validDate) {
      setDigits(format(validDate, "ddMMyyyy"));
    } else {
      setDigits("");
    }
  };

  React.useEffect(() => {
    if (inputRef.current && document.activeElement === inputRef.current) {
      const pending = pendingSelectRef.current;
      pendingSelectRef.current = null;
      if (pending) {
        inputRef.current.setSelectionRange(pending[0], pending[1]);
        return;
      }
      const pos = buildPartialValue(digits).length;
      inputRef.current.setSelectionRange(pos, pos);
    }
  }, [digits]);

  const openDialog = () => {
    const base = validDate ?? new Date();
    setDraft(validDate);
    setMonth(base);
    setOpen(true);
  };

  const confirm = () => {
    if (draft && isValid(draft)) {
      const iso = format(draft, "yyyy-MM-dd");
      if (availableDates && !availableDates.includes(iso)) {
        onInvalidPick?.(iso);
      } else {
        onChange(iso);
      }
    }
    setOpen(false);
  };

  const years = React.useMemo(
    () => Array.from({ length: 201 }, (_, i) => 1900 + i),
    []
  );

  return (
    <>
      <div className={cn("relative", hideInput ? "h-auto w-auto" : "h-10 w-full", className)}>
        <Input
          ref={inputRef}
          type="text"
          inputMode="numeric"
          value={displayValue}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          onClick={handleFocus}
          onMouseDown={handleMouseDown}
          onBlur={handleBlur}
          placeholder=""
          autoComplete="off"
          autoFocus={autoFocus}
          aria-label={placeholder}
          className={cn(
            "h-full text-foreground",
            hideInput ? "sr-only" : "w-full pr-10"
          )}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Open kalender"
          onClick={openDialog}
          className={cn(
            "bg-transparent text-foreground hover:bg-transparent hover:text-foreground dark:text-white dark:hover:bg-transparent dark:hover:text-white",
            hideInput ? "relative h-8 w-8" : "absolute right-0 top-0 h-full w-10"
          )}
        >
          <CalendarIcon className="h-4 w-4" />
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-[340px] gap-0 overflow-hidden border border-border bg-popover p-0 text-popover-foreground">
          <div className="bg-popover text-popover-foreground">

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
