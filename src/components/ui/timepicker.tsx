import * as React from "react";
import { Clock } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";

interface TimePickerProps {
  value?: string;
  onChange: (time: string) => void;
  placeholder?: string;
  className?: string;
}

const extractDigits = (raw: string) => raw.replace(/\D/g, "").slice(0, 4);

const buildDisplayValue = (digits: string) => {
  const d = digits.padEnd(4, " ");
  const h1 = d[0] === " " ? "u" : d[0];
  const h2 = d[1] === " " ? "u" : d[1];
  const m1 = d[2] === " " ? "m" : d[2];
  const m2 = d[3] === " " ? "m" : d[3];
  return `${h1}${h2}:${m1}${m2}`;
};

const buildPartialValue = (digits: string) =>
  digits.length <= 2 ? digits : `${digits.slice(0, 2)}:${digits.slice(2)}`;

/** Clamp digits so hours stay 00-23 and minutes 00-59 while typing. */
const clampDigits = (digits: string) => {
  const out = digits.split("");
  if (out.length >= 1 && Number(out[0]) > 2) out[0] = "2";
  if (out.length >= 2 && Number(out[0]) === 2 && Number(out[1]) > 3) out[1] = "3";
  if (out.length >= 3 && Number(out[2]) > 5) out[2] = "5";
  return out.join("");
};

const digitsToTime = (digits: string) =>
  digits.length === 4 ? `${digits.slice(0, 2)}:${digits.slice(2)}` : "";

const parseTime = (time?: string) => {
  if (!time) return null;
  const m = /^(\d{1,2}):(\d{2})/.exec(time);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return { h, m: min };
};

const pad = (n: number) => n.toString().padStart(2, "0");

const OUTER_HOURS = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const INNER_HOURS = [0, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23];
const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

const posOnCircle = (index: number, radius: number) => {
  const angle = (index * 30 - 90) * (Math.PI / 180);
  return {
    x: 50 + radius * Math.cos(angle),
    y: 50 + radius * Math.sin(angle),
  };
};

export function TimePicker({
  value,
  onChange,
  placeholder = "Kies een tijd",
  className,
}: TimePickerProps) {
  const parsed = parseTime(value);

  const [digits, setDigits] = React.useState(
    parsed ? `${pad(parsed.h)}${pad(parsed.m)}` : ""
  );
  const [open, setOpen] = React.useState(false);
  const [view, setView] = React.useState<"hours" | "minutes">("hours");
  const [draftH, setDraftH] = React.useState(parsed?.h ?? 12);
  const [draftM, setDraftM] = React.useState(parsed?.m ?? 0);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    const p = parseTime(value);
    setDigits(p ? `${pad(p.h)}${pad(p.m)}` : "");
  }, [value]);

  const displayValue = React.useMemo(() => buildDisplayValue(digits), [digits]);
  const partialValue = React.useMemo(() => buildPartialValue(digits), [digits]);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newDigits = clampDigits(extractDigits(event.target.value));
    setDigits(newDigits);
    if (newDigits.length === 4) onChange(digitsToTime(newDigits));
    else if (newDigits.length === 0) onChange("");
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    const allowed = [
      "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown",
      "Home", "End", "Delete", "Backspace", "Tab", "Enter", "Escape",
    ];
    if (allowed.includes(event.key)) return;
    if (event.ctrlKey || event.metaKey) return;
    if (!/^\d$/.test(event.key)) event.preventDefault();
  };

  const handleBlur = () => {
    const p = parseTime(value);
    setDigits(p ? `${pad(p.h)}${pad(p.m)}` : "");
  };

  React.useEffect(() => {
    if (inputRef.current && document.activeElement === inputRef.current) {
      const pos = buildPartialValue(digits).length;
      inputRef.current.setSelectionRange(pos, pos);
    }
  }, [digits]);

  const openDialog = () => {
    const p = parseTime(value);
    setDraftH(p?.h ?? 12);
    setDraftM(p?.m ?? 0);
    setView("hours");
    setOpen(true);
  };

  const confirm = () => {
    onChange(`${pad(draftH)}:${pad(draftM)}`);
    setOpen(false);
  };

  const svgRef = React.useRef<SVGSVGElement>(null);
  const draggingRef = React.useRef(false);

  const pickFromPointer = (clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 100 - 50;
    const y = ((clientY - rect.top) / rect.height) * 100 - 50;
    let angle = (Math.atan2(y, x) * 180) / Math.PI + 90;
    if (angle < 0) angle += 360;
    const radius = Math.hypot(x, y);
    if (view === "hours") {
      const idx = Math.round(angle / 30) % 12;
      setDraftH(radius < 32 ? INNER_HOURS[idx] : OUTER_HOURS[idx]);
    } else {
      setDraftM(Math.round(angle / 6) % 60);
    }
  };

  const handIndex = view === "hours" ? draftH % 12 : draftM / 5;
  const handRadius = view === "hours" && (draftH === 0 || draftH > 12) ? 25 : 38;
  const handEnd = posOnCircle(handIndex, handRadius);

  return (
    <>
      <div className={cn("relative h-10 w-full", className)}>
        <Input
          ref={inputRef}
          type="text"
          inputMode="numeric"
          value={partialValue}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => inputRef.current?.select()}
          onBlur={handleBlur}
          placeholder=""
          autoComplete="off"
          aria-label={placeholder}
          className="h-full w-full pr-10 text-foreground"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-3 right-10 flex items-center overflow-hidden text-sm"
        >
          {displayValue.split("").map((char, i) => (
            <span
              key={i}
              className={i < partialValue.length ? "text-transparent" : "text-white"}
            >
              {char}
            </span>
          ))}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Open tijdkiezer"
          onClick={openDialog}
          className="absolute right-0 top-0 h-full w-10 bg-transparent text-foreground hover:bg-transparent hover:text-foreground dark:text-white dark:hover:bg-transparent dark:hover:text-white"
        >
          <Clock className="h-4 w-4" />
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-[340px] gap-0 overflow-hidden border border-border bg-popover p-0 text-popover-foreground">
          <div className="bg-popover text-popover-foreground">
            {/* Material-style header */}
            <div className="bg-primary px-4 pb-3 pt-4 text-primary-foreground">
              <DialogTitle className="text-[11px] font-medium uppercase tracking-wide opacity-80">
                Selecteer tijd
              </DialogTitle>
              <p className="mt-1 flex items-baseline gap-1 text-3xl font-semibold">
                <button
                  type="button"
                  onClick={() => setView("hours")}
                  className={cn("tabular-nums", view === "hours" ? "opacity-100" : "opacity-60")}
                >
                  {pad(draftH)}
                </button>
                <span>:</span>
                <button
                  type="button"
                  onClick={() => setView("minutes")}
                  className={cn("tabular-nums", view === "minutes" ? "opacity-100" : "opacity-60")}
                >
                  {pad(draftM)}
                </button>
              </p>
            </div>

            {/* Analog clock */}
            <div className="p-4">
              <svg
                ref={svgRef}
                viewBox="0 0 100 100"
                className="mx-auto h-64 w-64 touch-none select-none cursor-pointer"
                onPointerDown={(e) => {
                  draggingRef.current = true;
                  e.currentTarget.setPointerCapture(e.pointerId);
                  pickFromPointer(e.clientX, e.clientY);
                }}
                onPointerMove={(e) => {
                  if (draggingRef.current) pickFromPointer(e.clientX, e.clientY);
                }}
                onPointerUp={() => {
                  draggingRef.current = false;
                  if (view === "hours") setView("minutes");
                }}
              >
                <circle cx="50" cy="50" r="48" className="fill-secondary/40" />
                <line
                  x1="50"
                  y1="50"
                  x2={handEnd.x}
                  y2={handEnd.y}
                  className="stroke-primary"
                  strokeWidth="1.2"
                />
                <circle cx="50" cy="50" r="2" className="fill-primary" />
                <circle cx={handEnd.x} cy={handEnd.y} r="7" className="fill-primary" />

                <g className="pointer-events-none">
                  {view === "hours" ? (
                    <>
                      {OUTER_HOURS.map((h, i) => {
                        const p = posOnCircle(i, 38);
                        const active = draftH === h;
                        return (
                          <text
                            key={`o${h}`}
                            x={p.x}
                            y={p.y}
                            textAnchor="middle"
                            dominantBaseline="central"
                            fontSize="7"
                            className={active ? "fill-primary-foreground font-bold" : "fill-foreground"}
                          >
                            {pad(h)}
                          </text>
                        );
                      })}
                      {INNER_HOURS.map((h, i) => {
                        const p = posOnCircle(i, 25);
                        const active = draftH === h;
                        return (
                          <text
                            key={`i${h}`}
                            x={p.x}
                            y={p.y}
                            textAnchor="middle"
                            dominantBaseline="central"
                            fontSize="5.5"
                            className={active ? "fill-primary-foreground font-bold" : "fill-muted-foreground"}
                          >
                            {pad(h)}
                          </text>
                        );
                      })}
                    </>
                  ) : (
                    MINUTES.map((m, i) => {
                      const p = posOnCircle(i, 38);
                      const active = draftM === m;
                      return (
                        <text
                          key={m}
                          x={p.x}
                          y={p.y}
                          textAnchor="middle"
                          dominantBaseline="central"
                          fontSize="7"
                          className={active ? "fill-primary-foreground font-bold" : "fill-foreground"}
                        >
                          {pad(m)}
                        </text>
                      );
                    })
                  )}
                </g>
              </svg>
            </div>


            <DialogFooter className="flex-row justify-end gap-2 border-t border-border px-3 py-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Annuleren
              </Button>
              <Button type="button" onClick={confirm}>
                OK
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
