import { useEffect, useRef } from "react";
import { MapPin, CalendarDays, Download, FileText, Sun, Moon, AlertCircle } from "lucide-react";
import type { PublicTournamentData } from "@/pages/PublicView";
import { useBroadcastStyle } from "@/contexts/BroadcastStyleContext";
import { ds } from "@/lib/broadcastStyles";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

interface Props {
  data: PublicTournamentData;
  selectedCategory?: string | null;
  onCategoryChange?: (id: string) => void;
  darkMode?: boolean;
  onToggleDarkMode?: () => void;
}

const PublicInfo = ({ data, selectedCategory, onCategoryChange, darkMode, onToggleDarkMode }: Props) => {
  const { tournament, attachments, sponsors, locations, categories } = data;
  const bStyle = useBroadcastStyle();
  const wrapperToken = ds(bStyle, "matchCardWrapper");
  const cardFrame = wrapperToken || "rounded-xl border border-border bg-card shadow-sm";
  const largeFrameShape = "rounded-2xl";
  const controlFrameShape = "rounded-lg";
  const divisionRef = useRef<HTMLDivElement>(null);
  const isMultiCat = tournament.is_multi_category && categories.length > 1;
  const needsSelection = isMultiCat && (!selectedCategory || selectedCategory === "");

  useEffect(() => {
    if (needsSelection && divisionRef.current) {
      setTimeout(() => divisionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 300);
    }
  }, [needsSelection]);

  const formatDate = (d: string | null) => {
    if (!d) return null;
    return new Date(d).toLocaleDateString("nl-BE", { day: "numeric", month: "long", year: "numeric" });
  };

  const renderSponsors = () => {
    if (sponsors.length === 0) return null;
    const rows: any[][] = [];
    const items = [...sponsors];
    
    while (items.length > 0) {
      if (items.length === 1) rows.push([items.shift()!]);
      else if (items.length === 2) rows.push([items.shift()!, items.shift()!]);
      else if (items.length === 4) { rows.push([items.shift()!, items.shift()!]); rows.push([items.shift()!, items.shift()!]); }
      else rows.push([items.shift()!, items.shift()!, items.shift()!]);
    }

    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <h3 className={ds(bStyle, "label")}>Sponsors</h3>
          <div className={ds(bStyle, "sectionLine")} />
        </div>
        {rows.map((row, ri) => (
          <div key={ri} className="flex justify-center gap-4">
            {row.map((s: any) => (
              <div key={s.id} className={`h-20 w-20 overflow-hidden p-2 ${cardFrame}`}>
                <img src={s.logo_url} alt={s.name || ""} className="h-full w-full object-contain" />
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className={bStyle === "teletext" ? "ttx-info" : undefined}>
      {/* Cover + Logo header */}
      <div className="relative">
        {tournament.cover_url ? (
          <div className="h-48 w-full overflow-hidden">
            <img src={tournament.cover_url} alt="" className="h-full w-full object-cover" />
            {ds(bStyle, "coverOverlay") ? (
              <>
                <div className={ds(bStyle, "coverOverlay")} />
                <div className="en-prism-line bottom-0" />
              </>
            ) : (
              <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />
            )}
          </div>
        ) : (
          <div className="h-40 w-full bg-[radial-gradient(120%_100%_at_50%_0%,hsl(var(--secondary))_0%,hsl(var(--background))_70%)] relative">
            {ds(bStyle, "coverOverlay") ? <div className="en-prism-line bottom-0" /> : <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />}
          </div>
        )}

        <div className="absolute bottom-0 left-0 right-0 translate-y-1/2 flex items-end justify-center px-5">
          {/* Dark mode toggle - aligned with bottom of logo */}
          {onToggleDarkMode && (
            <div className="flex-1" />
          )}
          {tournament.logo_url ? (
            <div className={`h-36 w-36 flex-shrink-0 overflow-hidden border-4 border-background bg-card shadow-xl ${largeFrameShape} ${ds(bStyle, "logoFrame")}`}>
              <img src={tournament.logo_url} alt="" className="h-full w-full object-contain" />
            </div>
          ) : (
            <div className={`flex h-36 w-36 flex-shrink-0 items-center justify-center border-4 border-background bg-primary shadow-xl ${largeFrameShape} ${ds(bStyle, "logoFrame")}`}>
              <span className="font-display text-5xl font-black text-primary-foreground">
                {tournament.name?.charAt(0)}
              </span>
            </div>
          )}

          {onToggleDarkMode ? (
            <div className="flex-1 flex justify-end pb-1">
              <button onClick={onToggleDarkMode}
                className={`flex items-center gap-1.5 border border-border bg-card px-3 py-1.5 text-xs font-bold text-muted-foreground hover:text-foreground transition-all shadow-sm ${controlFrameShape}`}>
                {bStyle === "teletext" ? (
                  <span className="tabular-nums">P{darkMode ? "500" : "800"}</span>
                ) : (
                  <>
                    {darkMode ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
                    {darkMode ? "Light" : "Dark"}
                  </>
                )}
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-20 px-5 space-y-4">
        <h1 className="font-display text-2xl font-black text-foreground leading-tight text-center uppercase tracking-wide">{tournament.name}</h1>

        {/* Date & Location badges */}
        <div className="flex flex-wrap gap-2 justify-center">
          {(tournament.start_date || tournament.end_date) && (
            <div className={`ttx-info-badge flex items-center gap-1.5 bg-secondary/60 border border-foreground/10 px-3 py-2 text-sm ${controlFrameShape}`}>
              <CalendarDays className="h-4 w-4 text-primary" />
              <span className="text-foreground font-bold text-xs">
                {formatDate(tournament.start_date)}
                {tournament.end_date && tournament.end_date !== tournament.start_date && ` – ${formatDate(tournament.end_date)}`}
              </span>
            </div>
          )}
          {locations.length > 0 && (
            <div className={`ttx-info-badge flex items-center gap-1.5 bg-secondary/60 border border-foreground/10 px-3 py-2 text-sm ${controlFrameShape}`}>
              <MapPin className="h-4 w-4 text-primary" />
              <span className="text-foreground font-bold text-xs">{locations.map(l => l.name).join(", ")}</span>
            </div>
          )}
        </div>

        {/* Description */}
        {tournament.description && (
          <div className={`p-4 ${cardFrame}`}>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">{tournament.description}</p>
          </div>
        )}

        {/* Division selector */}
        {isMultiCat && (
          <div ref={divisionRef} className={`p-4 space-y-2 border-2 rounded-xl ${needsSelection ? "border-destructive bg-destructive/10 animate-pulse" : "border-foreground/10 bg-secondary/50"}`}>
            <label className={`text-[10px] font-black uppercase tracking-[0.15em] flex items-center gap-1.5 ${needsSelection ? "text-destructive" : "text-primary"}`}>
              {needsSelection && <AlertCircle className="h-4 w-4" />}
              Meerdere divisies beschikbaar
            </label>
            <Select value={selectedCategory || ""} onValueChange={(v) => onCategoryChange?.(v)}>
              <SelectTrigger className={`w-full ${needsSelection ? "border-destructive" : ""}`}>
                <SelectValue placeholder="Kies divisie" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c: any) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {needsSelection && (
              <p className="text-xs text-destructive font-bold">Selecteer eerst een divisie om verder te gaan</p>
            )}
          </div>
        )}

        {/* Attachments */}
        {attachments.length > 0 && (
          <div className={`p-4 ${cardFrame}`}>
            <div className="flex items-center gap-2 mb-3">
              <h3 className="text-[10px] font-black uppercase tracking-[0.15em] text-primary flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5" /> Bijlagen
              </h3>
              <div className="flex-1 h-px bg-primary/20" />
            </div>
            <div className="space-y-2">
              {attachments.map((att: any) => (
                <a key={att.id} href={att.file_url} target="_blank" rel="noopener"
                  className={`flex items-center gap-2 bg-secondary hover:bg-primary/10 px-3 py-2.5 text-sm font-bold text-foreground transition-all border border-transparent hover:border-primary/20 ${controlFrameShape}`}>
                  <Download className="h-4 w-4 text-primary flex-shrink-0" />
                  <span className="truncate">{att.file_name}</span>
                </a>
              ))}
            </div>
          </div>
        )}

        {renderSponsors()}
      </div>
    </div>
  );
};

export default PublicInfo;
