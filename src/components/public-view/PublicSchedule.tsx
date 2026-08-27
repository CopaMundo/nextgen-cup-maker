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

  let lastDate = "";

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

  return (
    <div className="pt-4 space-y-3 px-3">
      {/* Section header */}
      <div className="flex items-center gap-3">
        <div className={ds(bStyle, "sectionDot")} />
        <h2 className={ds(bStyle, "sectionTitle")}>Schema</h2>
        <div className={ds(bStyle, "sectionLine")} />
        <span className={ds(bStyle, "sectionMeta") || "text-[10px] font-bold text-muted-foreground uppercase"}>{matches.length} wedstrijden</span>
      </div>

      {timeslots.map(slot => {
        const showDateHeader = slot.date !== lastDate;
        lastDate = slot.date;

        return (
          <div key={slot.key}>
            {showDateHeader && (
              <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm py-2 mb-1">
                <div className="flex items-center gap-2">
                  <div className={ds(bStyle, "dateHeader")}>
                    {formatDate(slot.date)}
                  </div>
                  {bStyle !== "teletext" && <div className={ds(bStyle, "sectionLine")} />}
                </div>
              </div>
            )}
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
        );
      })}

      {matches.length === 0 && (
        <div className="rounded-xl border-2 border-dashed border-border p-8 text-center">
          <p className="text-sm text-muted-foreground font-medium">Nog geen wedstrijden gepland.</p>
        </div>
      )}
    </div>
  );
};

export default PublicSchedule;
