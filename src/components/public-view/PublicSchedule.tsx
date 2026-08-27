import { useEffect, useRef, useState, useMemo } from "react";
import type { PublicTournamentData } from "@/pages/PublicView";
import PublicMatchCard from "./PublicMatchCard";
import { useBroadcastStyle } from "@/contexts/BroadcastStyleContext";
import { ds } from "@/lib/broadcastStyles";

const PublicSchedule = ({ data, favoriteTeam }: { data: PublicTournamentData; favoriteTeam: string | null }) => {
  const firstUnplayedRef = useRef<HTMLDivElement>(null);
  const lastPlayedRef = useRef<HTMLDivElement>(null);
  const { teams, matches, phases, groups, slots, tournament } = data;
  const bStyle = useBroadcastStyle();

  const [activeTab, setActiveTab] = useState<"next" | "results">("next");
  const [viewAll, setViewAll] = useState(false);

  const sorted = useMemo(() => [...matches].sort((a, b) => {
    const dateA = a.match_date || "9999";
    const dateB = b.match_date || "9999";
    if (dateA !== dateB) return dateA.localeCompare(dateB);
    const timeA = a.match_time || "99:99";
    const timeB = b.match_time || "99:99";
    if (timeA !== timeB) return timeA.localeCompare(timeB);
    return (a.field || "").localeCompare(b.field || "");
  }), [matches]);

  const timeslots = useMemo(() => {
    const list: { key: string; date: string; time: string; matches: any[] }[] = [];
    const slotMap: Record<string, any[]> = {};
    sorted.forEach(m => {
      const key = `${m.match_date || "nodate"}_${m.match_time || "notime"}`;
      if (!slotMap[key]) {
        slotMap[key] = [];
        list.push({ key, date: m.match_date || "", time: m.match_time || "", matches: slotMap[key] });
      }
      slotMap[key].push(m);
    });
    return list;
  }, [sorted]);

  const firstUnplayedMatchId = sorted.find(m => !m.is_played)?.id || null;
  const lastPlayedMatchId = [...sorted].reverse().find(m => m.is_played)?.id || null;

  const nextTimeslot = timeslots.find(s => s.matches.some(m => !m.is_played));
  const lastPlayedTimeslot = [...timeslots].reverse().find(s => s.matches.some(m => m.is_played));

  const visibleTimeslots = useMemo(() => {
    if (activeTab === "next") {
      if (viewAll) return timeslots.filter(s => s.matches.some(m => !m.is_played));
      return nextTimeslot ? [nextTimeslot] : [];
    }
    if (viewAll) return timeslots.filter(s => s.matches.some(m => m.is_played));
    return lastPlayedTimeslot ? [lastPlayedTimeslot] : [];
  }, [activeTab, viewAll, timeslots, nextTimeslot, lastPlayedTimeslot]);

  const formatDate = (d: string) => {
    if (!d) return "Geen datum";
    return new Date(d).toLocaleDateString("nl-BE", { weekday: "long", day: "numeric", month: "long" });
  };

  // Scroll to first unplayed match when next-tab is active; scroll to last played match when results-tab is active
  useEffect(() => {
    const targetId = activeTab === "next" ? firstUnplayedMatchId : lastPlayedMatchId;
    if (!targetId) return;
    const raf = requestAnimationFrame(() => {
      setTimeout(() => {
        const el = activeTab === "next" ? firstUnplayedRef.current : lastPlayedRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const scrollY = window.scrollY + rect.top - 120;
        window.scrollTo({ top: Math.max(0, scrollY), behavior: "instant" });
      }, 100);
    });
    return () => cancelAnimationFrame(raf);
  }, [activeTab, firstUnplayedMatchId, lastPlayedMatchId, viewAll]);

  const tabButtonCls = (isActive: boolean) => {
    const base = ds(bStyle, "tabButton") || "px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded-md border transition-colors";
    return isActive
      ? `${base} ${ds(bStyle, "tabButtonActive") || "bg-primary text-primary-foreground border-primary"}`
      : `${base} ${ds(bStyle, "tabButtonInactive") || "bg-muted text-muted-foreground border-transparent hover:bg-muted/80"}`;
  };

  let lastDate = "";

  return (
    <div className="pt-4 space-y-3 px-3">
      {/* Section header */}
      <div className="flex items-center gap-3">
        <div className={ds(bStyle, "sectionDot")} />
        <h2 className={ds(bStyle, "sectionTitle")}>Schema</h2>
        <div className={ds(bStyle, "sectionLine")} />
        <span className={ds(bStyle, "sectionMeta") || "text-[10px] font-bold text-muted-foreground uppercase"}>{matches.length} wedstrijden</span>
      </div>

      {/* Tab toggle */}
      <div className="flex items-center gap-2">
        <button onClick={() => { setActiveTab("next"); setViewAll(false); }} className={tabButtonCls(activeTab === "next")}>
          Volgende wedstrijden
        </button>
        <button onClick={() => { setActiveTab("results"); setViewAll(false); }} className={tabButtonCls(activeTab === "results")}>
          Resultaten
        </button>
      </div>

      {/* View-all toggle */}
      {visibleTimeslots.length > 0 && (
        <div className="flex justify-end">
          <button
            onClick={() => setViewAll(v => !v)}
            className={ds(bStyle, "viewAllButton") || "text-xs font-bold uppercase tracking-wider text-primary hover:underline"}
          >
            {viewAll ? "Toon enkel huidig tijdslot" : "Alles bekijken"}
          </button>
        </div>
      )}

      {visibleTimeslots.map(slot => {
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
              {/* Match cards */}
              <div className="p-2 space-y-2">
                {slot.matches.map((m: any) => {
                  const isTarget =
                    (activeTab === "next" && m.id === firstUnplayedMatchId) ||
                    (activeTab === "results" && m.id === lastPlayedMatchId);
                  return (
                    <div
                      key={m.id}
                      ref={isTarget ? (activeTab === "next" ? firstUnplayedRef : lastPlayedRef) : undefined}
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
                  );
                })}
              </div>
            </div>
          </div>
        );
      })}

      {visibleTimeslots.length === 0 && (
        <div className="rounded-xl border-2 border-dashed border-border p-8 text-center">
          <p className="text-sm text-muted-foreground font-medium">
            {activeTab === "next" ? "Geen komende wedstrijden gevonden." : "Nog geen resultaten beschikbaar."}
          </p>
        </div>
      )}
    </div>
  );
};

export default PublicSchedule;
