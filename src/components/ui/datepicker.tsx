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
      <div className={cn("flex h-10 w-full", className)}>
        <Input
          type="text"
          inputMode="numeric"
          value={inputValue}
          onChange={(event) => {
            const typedValue = event.target.value;
            setInputValue(typedValue);
            commitInput(typedValue);
          }}
          onBlur={() => {
            if (date && isValid(date)) setInputValue(format(date, "dd/MM/yyyy"));
          }}
          placeholder={placeholder === "Kies een datum" ? "dd/mm/jjjj" : placeholder}
          aria-label={placeholder}
          className="h-full min-w-0 rounded-r-none border-r-0"
        />
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="default"
            size="icon"
            aria-label="Open kalender"
            className="h-full w-10 shrink-0 rounded-l-none"
          >
            <CalendarIcon className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
      </div>
      <PopoverContent
        className="z-[100] w-auto max-w-[calc(100vw-2rem)] overflow-visible p-0 pointer-events-auto"
        align="end"
        sideOffset={8}
        collisionPadding={16}
      >
        <div data-mode="light" className="rounded-md bg-popover text-popover-foreground">
          <Calendar
            mode="single"
            selected={date}
            onSelect={handleSelect}
            initialFocus
            className={cn("p-3 pointer-events-auto")}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}
