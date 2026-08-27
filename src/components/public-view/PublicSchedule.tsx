import { useEffect, useRef, useState } from "react";
import type { PublicTournamentData } from "@/pages/PublicView";
import PublicMatchCard from "./PublicMatchCard";
import { useBroadcastStyle } from "@/contexts/BroadcastStyleContext";
import { ds } from "@/lib/broadcastStyles";
import { ChevronDown } from "lucide-react";

const PublicSchedule = ({ data, favoriteTeam }: { data: PublicTournamentData; favoriteTeam: string | null }) => {
  const firstUnplayedRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const [headerHeight, setHeaderHeight] = useState(0);
  const { teams, matches, phases, groups, slots, tournament } = data;
  const bStyle = useBroadcastStyle();

  const sorted = [...matches].sort((a, b) => {
    const dateA = a.match_date || "9999";
    const dateB = b.match_date || "9999";
    if (dateA !== dateB) return dateA.localeCompare(dateB);
    const timeA = a.match_time || "99:99";
    const timeB = b.match_time || "99:99";
    if (timeA !== timeB) return timeA.localeCompare(timeB);
    return (a.field || "").localeCompare(b.field || "");
  });

  const timeslots: { key: string; date: string; time: string; matches: any[] }[] = [];
  const slotMap: Record<string, any[]> = {};

  sorted.forEach(m => {
    const key = `${m.match_date || "nodate"}_${m.match_time || "notime"}`;
    if (!slotMap[key]) {
      slotMap[key] = [];
      timeslots.push({ key, date: m.match_date || "", time: m.match_time || "", matches: slotMap[key] });
    }
    slotMap[key].push(m);
  });

  // Find the first unplayed match id across all sorted matches
  const firstUnplayedMatchId = sorted.find(m => !m.is_played)?.id || null;

  const formatDate = (d: string) => {
    if (!d) return "Geen datum";
    return new Date(d).toLocaleDateString("nl-BE", { weekday: "long", day: "numeric", month: "long" });
  };


  useEffect(() => {
    if (!firstUnplayedMatchId) return;
    const raf = requestAnimationFrame(() => {
      setTimeout(() => {
        const el = firstUnplayedRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const scrollY = window.scrollY + rect.top - 120;
        window.scrollTo({ top: Math.max(0, scrollY), behavior: "instant" });
      }, 100);
    });
    return () => cancelAnimationFrame(raf);
  }, [firstUnplayedMatchId]);

  useEffect(() => {
    const update = () => setHeaderHeight(headerRef.current?.offsetHeight || 56);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const uniqueDates = [...new Set(timeslots.map(s => s.date))].filter(Boolean);
  const scheduledCount = matches.filter(m => m.match_date).length;

  return (
    <div className="px-3 pb-4">
      {/* Sticky section header */}
      <div
        ref={headerRef}
        className="sticky top-0 z-20 -mx-3 px-3 pt-4 pb-3 space-y-3 bg-background/95 backdrop-blur-sm border-b border-border/30"
      >
        <div className="flex items-center gap-3">
          <div className={ds(bStyle, "sectionDot")} />
          <h2 className={ds(bStyle, "sectionTitle")}>Schema</h2>
          <div className={ds(bStyle, "sectionLine")} />
          <span className={ds(bStyle, "sectionMeta") || "text-[10px] font-bold text-muted-foreground uppercase"}>{scheduledCount} wedstrijden</span>

          {uniqueDates.length > 1 && (
            <div className="relative ml-auto shrink-0">
              <select
                value=""
                onChange={(e) => {
                  const date = e.target.value;
                  const el = document.querySelector(`[data-schedule-date="${date}"]`);
                  if (el) {
                    const top = el.getBoundingClientRect().top + window.scrollY - headerHeight;
                    window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
                  }
                }}
                className="appearance-none bg-secondary text-foreground text-[10px] font-bold uppercase rounded-md pl-2 pr-6 py-1.5 cursor-pointer"
              >
                <option value="" disabled>Dag</option>
                {uniqueDates.map(d => (
                  <option key={d} value={d}>{formatDate(d)}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
            </div>
          )}
        </div>
      </div>

      <div className="pt-3 space-y-3">
        {uniqueDates.map(date => (
          <div key={date} data-schedule-date={date} className="space-y-3">
            {/* Sticky date header — spans the whole day group */}
            <div
              className="sticky z-10 bg-background/95 backdrop-blur-sm py-2 mb-1"
              style={{ top: headerHeight }}
            >
              <div className="flex items-center gap-2">
                <div className={ds(bStyle, "dateHeader")}>
                  {formatDate(date)}
                </div>
                {bStyle !== "teletext" && <div className={ds(bStyle, "sectionLine")} />}
              </div>
            </div>
            {timeslots.filter(s => s.date === date).map(slot => (
              <div key={slot.key}>
                <div className={ds(bStyle, "card")}>
                  {/* Timeslot header */}
                  <div className={ds(bStyle, "timeslotHeader")}>
                    {slot.time && (
                      <span className={ds(bStyle, "timeslotBadge") || ds(bStyle, "badge")}>
                        {slot.time.slice(0, 5)}
                      </span>
                    )}
                    <span className={ds(bStyle, "timeslotHeaderMeta") || "text-[10px] font-bold text-muted-foreground uppercase tracking-wider"}>
                      {slot.matches.length} wedstrijd{slot.matches.length !== 1 ? "en" : ""}
                    </span>
                  </div>
                  {/* Match cards — each in its own style-aware container with spacing */}
                  <div className="p-2 space-y-2">
                    {slot.matches.map((m: any) => (
                      <div
                        key={m.id}
                        ref={m.id === firstUnplayedMatchId ? firstUnplayedRef : undefined}
                        className={ds(bStyle, "matchCardWrapper") || "rounded-xl border border-border/60 bg-card overflow-hidden shadow-sm"}
                      >
                        <PublicMatchCard
                          match={m}
                          teams={teams}
                          phases={phases}
                          groups={groups}
                          slots={slots}
                          tournament={tournament}
                          allMatches={matches}
                          favoriteTeam={favoriteTeam}
                          hideRoundNumber
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      {matches.length === 0 && (
        <div className="rounded-xl border-2 border-dashed border-border p-8 text-center">
          <p className="text-sm text-muted-foreground font-medium">Nog geen wedstrijden gepland.</p>
        </div>
      )}
    </div>
  );
};

export default PublicSchedule;
