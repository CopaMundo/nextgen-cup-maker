import * as React from "react";
import { format, parse, parseISO, isValid } from "date-fns";
import { CalendarIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface DatePickerProps {
  value?: string;
  onChange: (date: string) => void;
  placeholder?: string;
  className?: string;
}

export function DatePicker({
  value,
  onChange,
  placeholder = "Kies een datum",
  className,
}: DatePickerProps) {
  const date = value ? parseISO(value) : undefined;
  const [inputValue, setInputValue] = React.useState(
    date && isValid(date) ? format(date, "dd/MM/yyyy") : ""
  );

  React.useEffect(() => {
    const nextDate = value ? parseISO(value) : undefined;
    setInputValue(nextDate && isValid(nextDate) ? format(nextDate, "dd/MM/yyyy") : "");
  }, [value]);

  const maskInput = (raw: string) => {
    const digits = raw.replace(/\D/g, "").slice(0, 8);
    let masked = digits.slice(0, 2);
    if (digits.length >= 3) masked += "/" + digits.slice(2, 4);
    if (digits.length >= 5) masked += "/" + digits.slice(4, 8);
    return masked;
  };

  const maskRemainder = (() => {
    const digits = inputValue.replace(/\D/g, "").length;
    if (digits === 0) return "dd/mm/jjjj";
    if (digits === 1) return "d/mm/jjjj";
    if (digits === 2) return "/mm/jjjj";
    if (digits === 3) return "m/jjjj";
    if (digits === 4) return "/jjjj";
    if (digits < 8) return "j".repeat(8 - digits);
    return "";
  })();

  const commitInput = (typedValue: string) => {
    if (!typedValue.trim()) {
      onChange("");
      return;
    }

    const parsedDate = parse(typedValue, "dd/MM/yyyy", new Date());
    if (isValid(parsedDate) && format(parsedDate, "dd/MM/yyyy") === typedValue) {
      onChange(format(parsedDate, "yyyy-MM-dd"));
    }
  };

  const handleSelect = (selected?: Date) => {
    if (selected && isValid(selected)) {
      onChange(format(selected, "yyyy-MM-dd"));
    }
  };

  return (
    <Popover>
      <div className={cn("relative h-10 w-full", className)}>
        <Input
          type="text"
          inputMode="numeric"
          value={inputValue}
          onChange={(event) => {
            const typedValue = maskInput(event.target.value);
            setInputValue(typedValue);
            commitInput(typedValue);
          }}
          onBlur={() => {
            if (date && isValid(date)) setInputValue(format(date, "dd/MM/yyyy"));
          }}
          placeholder=""
          aria-label={placeholder}
          className="peer h-full w-full pr-10"
        />
        {maskRemainder && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 left-3 right-10 flex items-center overflow-hidden text-sm"
          >
            <span className="invisible whitespace-pre">{inputValue}</span>
            <span className="whitespace-pre text-muted-foreground/70">{maskRemainder}</span>
          </div>
        )}
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Open kalender"
            className="absolute right-0 top-0 h-full w-10 text-primary hover:bg-transparent dark:text-white"
          >
            <CalendarIcon className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
      </div>
      <PopoverContent
        className="z-[100] w-auto max-w-[calc(100vw-1rem)] overflow-visible p-0 pointer-events-auto"
        align="end"
        side="bottom"
        avoidCollisions
        sideOffset={8}
        collisionPadding={8}
      >
        <div data-mode="light" className="rounded-md bg-popover text-popover-foreground">
          <Calendar
            mode="single"
            selected={date}
            onSelect={handleSelect}
            defaultMonth={date && isValid(date) ? date : undefined}
            initialFocus
            className={cn("p-3 pointer-events-auto")}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}
