import React, { useState, useEffect, useRef, type ReactNode, type SetStateAction } from "react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { fetchTournamentMatches } from "@/lib/fetchTournamentMatches";
import { Input } from "@/components/ui/input";
import { TimePicker } from "@/components/ui/timepicker";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useDialogFocus } from "@/hooks/useDialogFocus";
import { formatIsoDateForLocale, listIsoDatesInRange, normalizeIsoDates, expandMatchDays, MatchDayEntry } from "@/lib/dateUtils";
import { Plus, Trash2, Zap, Coffee, List, GripVertical, ChevronLeft, ChevronRight, ChevronDown, RotateCcw, Calendar, UserCheck, Pencil, Check, BarChart3, Shuffle, Printer, ArrowUp, ArrowDown, ArrowRight, X, Settings, PanelRightClose, PanelRightOpen } from "lucide-react";
import CalendarClockIcon from "@/components/icons/CalendarClockIcon";
import CalendarXIcon from "@/components/icons/CalendarXIcon";
import { DatePicker } from "@/components/ui/datepicker";
import { parseIsoDate, formatIsoDate } from "@/lib/dateUtils";
import WhistleIcon from "@/components/icons/WhistleIcon";
import { useScoringSystems } from "@/hooks/useScoringSystems";
import { getMatchFormatSuffix } from "@/lib/matchFormatLabel";
import { RefereeConfig, parseReferees, serializeReferees, refereeCanOfficiate, summarizeReferee } from "@/lib/refereeConfig";
import { parseFieldEntries, serializeFieldEntries, registerFieldLocations, formatFieldLabel } from "@/lib/fieldLocations";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import MatchDetailDialog from "./MatchDetailDialog";
import { useIsMobile } from "@/hooks/use-mobile";
import { DndContext, DragOverlay, useDraggable, PointerSensor, TouchSensor, useSensor, useSensors, type DragStartEvent, type DragEndEvent } from "@dnd-kit/core";

/** Extract the minimum seed number from slot labels for stable bracket ordering */
const getMinSeedFromSlots = (m: { home_slot_label?: string | null; away_slot_label?: string | null }) => {
  const nums: number[] = [];
  for (const label of [m.home_slot_label, m.away_slot_label]) {
    if (!label) continue;
    const match = label.match(/Slot\s+(\d+)/i);
    if (match) nums.push(parseInt(match[1], 10));
  }
  return nums.length > 0 ? Math.min(...nums) : Number.MAX_SAFE_INTEGER;
};

interface FieldConfig {
  name: string;
  startTime: string;
  location?: string | null;
}

interface PlannerBreak {
  id: string;
  fieldNames: string[];
  afterSlotIndex: number;
  duration: number;
}

interface StoredPlannerBreaks {
  breaks: PlannerBreak[];
  updatedAt: number;
}

interface Match {
  id: string;
  home_team_id: string | null;
  away_team_id: string | null;
  home_score: number | null;
  away_score: number | null;
  home_penalties: number | null;
  away_penalties: number | null;
  match_date: string | null;
  match_time: string | null;
  field: string | null;
  referee: string | null;
  is_played: boolean;
  phase_id: string;
  group_id: string | null;
  round_number: number | null;
  home_slot_label: string | null;
  away_slot_label: string | null;
  match_name: string | null;
  created_at: string;
}

interface Team { id: string; name: string; logo_url: string | null; }
interface Phase { id: string; name: string; phase_type: string; phase_number: number; match_config?: any; logo_url?: string | null; sort_order?: number; }
interface SlotEntry { id: string; slot_code: string; team_id: string | null; group_id: string | null; phase_id: string; sort_order: number; }
interface GroupEntry { id: string; name: string; phase_id: string; sort_order: number; created_at?: string; }

type PlannerItemType = "match" | "break";

interface PlannerDragPayload {
  id: string;
  type: PlannerItemType;
  field_id: string | null;
  slot_index: number | null;
  container: "schema" | "unscheduled";
}

export const plannerDateStorageKey = (tournamentId: string, categoryId: string | null) =>
  `planner-date:${tournamentId}:${categoryId || "root"}`;

const DraggablePlannerItem = ({ id, data, className, children }: {
  id: string;
  data: PlannerDragPayload;
  className: string;
  children: ReactNode;
}) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id, data });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={`${className} cursor-grab active:cursor-grabbing select-none touch-manipulation transition-all duration-200 ease-out ${
        isDragging ? 'opacity-20 scale-[0.97]' : 'hover:-translate-y-0.5'
      }`}
    >
      {children}
    </div>
  );
};

const PlannerItem = ({ payload, className, children }: {
  payload: PlannerDragPayload;
  className: string;
  children: ReactNode;
}) => (
  <DraggablePlannerItem id={`planner-${payload.id}`} data={payload} className={className}>
    {children}
  </DraggablePlannerItem>
);

const PlannerInsertionMarker = ({ active }: { active: boolean }) => {
  if (!active) return null;
  return (
    <div className="px-2 py-1.5 animate-fade-in" aria-hidden="true">
      <div className="relative h-3">
        <div className="absolute inset-x-1 top-1/2 h-0.5 -translate-y-1/2 rounded-full bg-primary/30" />
        <div className="absolute left-1 top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full border-2 border-background bg-primary shadow-sm" />
      </div>
    </div>
  );
};

const timeToMinutes = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
const minutesToTime = (m: number) => `${Math.floor(m / 60).toString().padStart(2, "0")}:${(m % 60).toString().padStart(2, "0")}`;
const PLANNER_BREAK_SNAPSHOT_TTL = 2 * 60 * 1000;
// Uniform block height so all field columns share one visual timeline
const PLANNER_ROW_H = "h-[92px]";


const formatDateDMY = (d: string | null) => {
  if (!d) return null;
  const parts = d.split("-");
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return d;
};

const getTournamentPlannerDates = (tournament: any) => {
  const extraDays = expandMatchDays((tournament.match_days as MatchDayEntry[]) || []);
  // When explicit match days are configured, those are the only valid dates.
  if (extraDays.length > 0) return extraDays;
  const periodDays = tournament.start_date && tournament.end_date
    ? listIsoDatesInRange(tournament.start_date, tournament.end_date)
    : normalizeIsoDates([tournament.start_date, tournament.end_date]);
  return normalizeIsoDates(periodDays);
};


const getFirstScheduledMatchDate = (matches: Match[]) => {
  const dates = normalizeIsoDates(
    matches
      .filter((match) => match.match_date && match.match_time && match.field)
      .map((match) => match.match_date as string)
  );

  return dates[0] || null;
};


const useResponsiveWindowSize = () => {
  const [size, setSize] = useState(() => {
    if (typeof window === "undefined") return 7;
    const w = window.innerWidth;
    if (w < 480) return 3;
    if (w < 768) return 4;
    if (w < 1024) return 5;
    if (w < 1280) return 7;
    return 10;
  });

  useEffect(() => {
    const handler = () => {
      const w = window.innerWidth;
      if (w < 480) setSize(3);
      else if (w < 768) setSize(4);
      else if (w < 1024) setSize(5);
      else if (w < 1280) setSize(7);
      else setSize(10);
    };
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  return size;
};

const DateStripNav = ({
  dates,
  activeDate,
  onSelect,
  onInvalidPick,
}: {
  dates: string[];
  activeDate: string;
  onSelect: (iso: string) => void;
  onInvalidPick: (iso: string) => void;
}) => {
  const windowSize = useResponsiveWindowSize();
  const [windowStart, setWindowStart] = useState(0);

  // Keep the active date visible — only when the active date itself changes,
  // so manual scrolling/paging through dates is not auto-corrected back.
  useEffect(() => {
    const idx = dates.indexOf(activeDate);
    if (idx === -1) return;
    setWindowStart((current) => {
      if (idx < current) return idx;
      if (idx >= current + windowSize) return Math.max(0, idx - windowSize + 1);
      return current;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDate, windowSize]);

  const maxStart = Math.max(0, dates.length - windowSize);
  const safeStart = Math.min(windowStart, maxStart);
  const visible = dates.slice(safeStart, safeStart + windowSize);
  const showNav = dates.length > windowSize;

  const dateSet = new Set(dates);

  return (
    <div className="flex items-center justify-center gap-2">
      <div className="flex items-center gap-2 min-w-0">
        {showNav && (
          <button
            type="button"
            onClick={() => setWindowStart((s) => Math.max(0, s - 1))}
            disabled={safeStart === 0}
            className="shrink-0 p-1 text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            aria-label="Vorige dagen"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        )}

        <div
          className="flex items-center gap-4 whitespace-nowrap overflow-hidden"
          onWheel={(e) => {
            if (!showNav) return;
            // Vertical wheel → horizontal date navigation
            const delta = e.deltaY !== 0 ? e.deltaY : e.deltaX;
            if (delta > 0) {
              setWindowStart((s) => Math.min(maxStart, s + 1));
            } else if (delta < 0) {
              setWindowStart((s) => Math.max(0, s - 1));
            }
          }}
        >
          {visible.map((d) => {
            const isActive = activeDate === d;
            return (
              <button
                key={d}
                onClick={() => onSelect(d)}
                className={
                  "shrink-0 text-sm font-semibold uppercase tracking-wide transition-colors py-1 " +
                  (isActive
                    ? "text-primary border-b-2 border-primary"
                    : "text-muted-foreground hover:text-foreground")
                }
              >
                {formatIsoDateForLocale(d, "nl-BE", { weekday: "short", day: "numeric", month: "short" })}
              </button>
            );
          })}
        </div>

        {showNav && (
          <button
            type="button"
            onClick={() => setWindowStart((s) => Math.min(maxStart, s + 1))}
            disabled={safeStart >= maxStart}
            className="shrink-0 p-1 text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            aria-label="Volgende dagen"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        )}
      </div>

      <DatePicker
        value={activeDate}
        onChange={(iso) => {
          if (!dateSet.has(iso)) {
            onInvalidPick(iso);
            return;
          }
          onSelect(iso);
        }}
        hideInput
        availableDates={dates}
        onInvalidPick={onInvalidPick}
      />
    </div>
  );
};

const MatchScheduler = ({ tournamentId, tournament, categoryId, selectedLocation: selectedLocationProp, onLocationChange }: { tournamentId: string; tournament: any; categoryId?: string | null; selectedLocation?: string | null; onLocationChange?: (loc: string | null) => void }) => {
  const isMobile = useIsMobile();
  const { systems: scoringSystems } = useScoringSystems(tournamentId);

  const [matches, setMatches] = useState<Match[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [phases, setPhases] = useState<Phase[]>([]);
  const [slots, setSlots] = useState<SlotEntry[]>([]);
  const [allGroups, setAllGroups] = useState<GroupEntry[]>([]);
  const [fields, setFields] = useState<FieldConfig[]>([]);
  const [locations, setLocations] = useState<{ id: string; name: string }[]>([]);
  const [internalSelectedLocation, setInternalSelectedLocation] = useState<string | null>(null);
  const isLocationControlled = selectedLocationProp !== undefined;
  const selectedLocation = isLocationControlled ? selectedLocationProp : internalSelectedLocation;
  const updateSelectedLocation = (loc: string | null) => {
    if (isLocationControlled) onLocationChange?.(loc);
    else setInternalSelectedLocation(loc);
  };
  const [editFieldIdx, setEditFieldIdx] = useState<number | null>(null);
  const [editFieldDraft, setEditFieldDraft] = useState<{ name: string; startTime: string; location: string | null }>({ name: "", startTime: "", location: null });

  const [showAddFieldDialog, setShowAddFieldDialog] = useState(false);
  const [newFieldName, setNewFieldName] = useState("");
  const [newFieldLocation, setNewFieldLocation] = useState<string | null>(null);
  const [newFieldStartTime, setNewFieldStartTime] = useState("09:00");
  const [deleteFieldIdx, setDeleteFieldIdx] = useState<number | null>(null);
  const [clearFieldIdx, setClearFieldIdx] = useState<number | null>(null);
  const [refereeConfigs, setRefereeConfigs] = useState<RefereeConfig[]>([]);
  const referees = refereeConfigs.map(r => r.name);
  const [refereesPerMatch, setRefereesPerMatch] = useState(1);
  const [categoryData, setCategoryData] = useState<any>(null);
  const [allCategories, setAllCategories] = useState<{ id: string; name: string; fields: any; referees: any }[]>([]);
  const [showImportFields, setShowImportFields] = useState(false);
  const [showImportRefs, setShowImportRefs] = useState(false);
  const [editRefIdx, setEditRefIdx] = useState<number | null>(null);
  const [editRefName, setEditRefName] = useState("");
  const [deleteRefIdx, setDeleteRefIdx] = useState<number | null>(null);
  const [globalMatchDuration, setGlobalMatchDuration] = useState(tournament.match_duration || 15);
  const [globalBreakDuration, setGlobalBreakDuration] = useState(tournament.break_duration || 5);
  const [loading, setLoading] = useState(true);
  const [showDurationDialog, setShowDurationDialog] = useState(false);
  const durationDialogRef = useDialogFocus(showDurationDialog);
  const [perFormatDurationEnabled, setPerFormatDurationEnabled] = useState(() => {
    return phases.some(p => {
      const cfg = (p.match_config as any) || {};
      return cfg.phaseDuration != null || cfg.phaseBreak != null;
    });
  });
  // Draft state for duration dialog (only committed on save)
  const [draftMatchDuration, setDraftMatchDuration] = useState(globalMatchDuration);
  const [draftBreakDuration, setDraftBreakDuration] = useState(globalBreakDuration);
  const [draftPerFormat, setDraftPerFormat] = useState(perFormatDurationEnabled);
  const [draftPhaseConfigs, setDraftPhaseConfigs] = useState<Record<string, { phaseDuration: number | null; phaseBreak: number | null }>>(() =>
    phases.reduce((acc, p) => {
      const cfg = (p.match_config as any) || {};
      acc[p.id] = { phaseDuration: cfg.phaseDuration ?? null, phaseBreak: cfg.phaseBreak ?? null };
      return acc;
    }, {} as Record<string, { phaseDuration: number | null; phaseBreak: number | null }>)
  );

  // Filters for list view
  const [filterPhase, setFilterPhase] = useState<string>("all");
  const [filterGroup, setFilterGroup] = useState<string>("all");
  const [filterRound, setFilterRound] = useState<string>("all");

  // UI toggles
  const [showRefAdd, setShowRefAdd] = useState(false);
  const [newRef, setNewRef] = useState("");
  const addFieldDialogRef = useDialogFocus(showAddFieldDialog);
  const editFieldDialogRef = useDialogFocus(editFieldIdx !== null);
  const addRefDialogRef = useDialogFocus(showRefAdd);
  const editRefDialogRef = useDialogFocus(editRefIdx !== null);

  // Planner state
  const [plannerDate, setPlannerDateRaw] = useState<string>(() => {
    const allDays = getTournamentPlannerDates(tournament);
    return allDays[0] || "";
  });
  const [plannerBreaks, setPlannerBreaksRaw] = useState<PlannerBreak[]>([]);
  const [showBreakAdd, setShowBreakAdd] = useState(false);
  const [newBreakDuration, setNewBreakDuration] = useState(20);
  const [newBreakFields, setNewBreakFields] = useState<string[]>([]);
  const [dragItemId, setDragItemId] = useState<string | null>(null);
  const [dragItemType, setDragItemType] = useState<PlannerItemType | null>(null);
  const [dragOverField, setDragOverField] = useState<string | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  // Live reflow preview state
  const [previewField, setPreviewField] = useState<string | null>(null);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [unscheduledOrder, setUnscheduledOrder] = useState<string[]>([]);
  const dragPayloadRef = useRef<PlannerDragPayload | null>(null);
  const dragVisualTimerRef = useRef<number | null>(null);
  const fieldColumnRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const plannerScrollRef = useRef<HTMLDivElement | null>(null);
  const plannerBreaksRef = useRef<PlannerBreak[]>([]);
  const plannerBreaksSaveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const lastPreviewUpdate = useRef<number>(0);
  // Planner scheduling filters — unified: groepen & brackets → round → field
  // schedFormats = knockout/single_match phase IDs (brackets)
  // schedGroups = group IDs from group/round_robin phases
  const [schedFormats, setSchedFormats] = useState<string[]>([]);
  const [schedGroups, setSchedGroups] = useState<string[]>([]);
  const [schedRounds, setSchedRounds] = useState<string[]>([]); // "phaseId:groupId|_:roundNum" composite keys
  const [schedFields, setSchedFields] = useState<string[]>([]);
  
  const [dropdownOpenBrackets, setDropdownOpenBrackets] = useState(false);
  const [dropdownOpenRounds, setDropdownOpenRounds] = useState(false);
  const [dropdownOpenFields, setDropdownOpenFields] = useState(false);
  const dropdownContainerRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownContainerRef.current && !dropdownContainerRef.current.contains(e.target as Node)) {
        setDropdownOpenBrackets(false);
        setDropdownOpenRounds(false);
        setDropdownOpenFields(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const openDropdown = (which: "brackets" | "rounds" | "fields") => {
    setDropdownOpenBrackets(which === "brackets" ? v => !v : false);
    setDropdownOpenRounds(which === "rounds" ? v => !v : false);
    setDropdownOpenFields(which === "fields" ? v => !v : false);
  };

  // Sidebar filter for unscheduled matches — hierarchical
  const [sidebarFormat, setSidebarFormat] = useState<string>("all");
  const [sidebarGroup, setSidebarGroup] = useState<string>("all");
  const [sidebarRound, setSidebarRound] = useState<string>("all"); // "phaseId:groupId|_:roundNum" or simple round number

  // Match edit dialog
  const [editMatchId, setEditMatchId] = useState<string | null>(null);
  const [editMatchReferee, setEditMatchReferee] = useState("");
  const [selectedStatsMatchId, setSelectedStatsMatchId] = useState<string | null>(null);

  // Mobile touch move state
  const [mobileSelectedMatchId, setMobileSelectedMatchId] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [rightSidebarTab, setRightSidebarTab] = useState<"plannen" | "scheidsrechters" | "ongepland">("plannen");
  const [plannerCollapsed, setPlannerCollapsed] = useState(false);
  const [showPauzeModal, setShowPauzeModal] = useState<string | null>(null);
  const [pauzeModalName, setPauzeModalName] = useState("Pauze");
  const [pauzeModalDuration, setPauzeModalDuration] = useState(20);
  const pauzeDialogRef = useDialogFocus(!!showPauzeModal);

  const setPlannerDate = (date: string) => {
    setPlannerDateRaw(date);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(plannerDateStorageKey(tournamentId, categoryId ?? null), date);
    }
  };

  // dnd-kit
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
  );
  const [activeDragPayload, setActiveDragPayload] = useState<PlannerDragPayload | null>(null);
  const pointerPositionRef = useRef({ x: 0, y: 0 });
  const unscheduledZoneRef = useRef<HTMLDivElement | null>(null);

  const { toast } = useToast();
  const hasAnyStats = tournament?.enable_goalscorers || tournament?.enable_assists || tournament?.enable_yellow_cards || tournament?.enable_red_cards;

  const getPlannerBreakStorageKey = () => `copa-planner-breaks:${tournamentId}:${categoryId || "root"}`;

  const readPlannerBreakSnapshot = (): StoredPlannerBreaks | null => {
    if (typeof window === "undefined") return null;

    try {
      const raw = window.sessionStorage.getItem(getPlannerBreakStorageKey());
      if (!raw) return null;

      const parsed = JSON.parse(raw) as Partial<StoredPlannerBreaks>;
      if (!Array.isArray(parsed.breaks) || typeof parsed.updatedAt !== "number") return null;

      return { breaks: parsed.breaks as PlannerBreak[], updatedAt: parsed.updatedAt };
    } catch {
      return null;
    }
  };

  const writePlannerBreakSnapshot = (breaks: PlannerBreak[]) => {
    if (typeof window === "undefined") return;

    window.sessionStorage.setItem(
      getPlannerBreakStorageKey(),
      JSON.stringify({ breaks, updatedAt: Date.now() } satisfies StoredPlannerBreaks),
    );
  };

  const persistPlannerBreaks = async (next: PlannerBreak[]) => {
    writePlannerBreakSnapshot(next);

    // Save immediately to DB — no queue, no chaining
    try {
      const payload = { planner_breaks: next as any };
      const query = categoryId
        ? supabase.from("tournament_categories").update(payload).eq("id", categoryId)
        : supabase.from("tournaments").update(payload).eq("id", tournamentId);

      const { error } = await query;
      if (error) {
        console.error("Pauze save error:", error);
      }
    } catch (err) {
      console.error("Pauze save exception:", err);
    }
  };

  const setPlannerBreaks = (value: SetStateAction<PlannerBreak[]>) => {
    const next = typeof value === "function" ? value(plannerBreaksRef.current) : value;
    plannerBreaksRef.current = next;
    setPlannerBreaksRaw(next);
    void persistPlannerBreaks(next);
    return next;
  };

  useEffect(() => { fetchData(); }, [tournamentId, categoryId]);

  useEffect(() => {
    plannerBreaksRef.current = plannerBreaks;
  }, [plannerBreaks]);

  const fetchData = async () => {
    let phaseQuery = supabase.from("tournament_phases").select("id, name, phase_type, phase_number, match_config, logo_url, sort_order").eq("tournament_id", tournamentId).order("phase_number").order("sort_order");
    if (categoryId) phaseQuery = phaseQuery.eq("category_id", categoryId);

    let teamQuery = supabase.from("teams").select("id, name, logo_url").eq("tournament_id", tournamentId);
    if (categoryId) teamQuery = teamQuery.eq("category_id", categoryId);

    const [mRes, tRes, pRes, sRes, gRes] = await Promise.all([
      fetchTournamentMatches({
        tournamentId,
        orders: [
          { column: "match_date" },
          { column: "match_time" },
        ],
        maxRows: 5000,
      }),
      teamQuery,
      phaseQuery,
      supabase.from("slots").select("id, slot_code, team_id, group_id, phase_id, sort_order").eq("tournament_id", tournamentId).order("sort_order"),
      supabase.from("groups").select("id, name, phase_id, sort_order, created_at").eq("tournament_id", tournamentId).order("sort_order"),
    ]);

    // Load category-specific fields/referees if categoryId is set
    let catFields: FieldConfig[] = [];
    let catReferees: RefereeConfig[] = [];
    let catData: any = null;
    if (categoryId) {
      const { data: catRow } = await supabase.from("tournament_categories").select("*").eq("id", categoryId).single();
      catData = catRow;
      if (catRow) {
        const savedFields = catRow.fields as any;
        if (Array.isArray(savedFields) && savedFields.length > 0) {
          catFields = parseFieldEntries(savedFields);
        }
        catReferees = parseReferees(catRow.referees);
      }
    } else {
      const saved = tournament.fields as any;
      if (Array.isArray(saved) && saved.length > 0) {
        catFields = parseFieldEntries(saved);
      }
      catReferees = parseReferees(tournament.referees);
    }
    setFields(catFields);
    const { data: locRows } = await supabase
      .from("tournament_locations")
      .select("id, name")
      .eq("tournament_id", tournamentId)
      .order("sort_order");
    const locList = (locRows || []) as { id: string; name: string }[];
    setLocations(locList);
    registerFieldLocations([catFields], locList);
    const nextLocation = selectedLocation && locList.some(l => l.name === selectedLocation) ? selectedLocation : (locList[0]?.name ?? null);
    updateSelectedLocation(nextLocation);
    setRefereeConfigs(catReferees);
    setCategoryData(catData);
    // Load persisted planner breaks — use a short-lived session snapshot to survive fast tab switches
    let savedBreaks: PlannerBreak[] | null = null;
    if (categoryId) {
      savedBreaks = catData?.planner_breaks as PlannerBreak[] | null;
    } else {
      const { data: freshTournament } = await supabase.from("tournaments").select("planner_breaks").eq("id", tournamentId).single();
      savedBreaks = freshTournament?.planner_breaks as unknown as PlannerBreak[] | null;
    }
    // Always prefer DB data when available; only fall back to session snapshot if DB has nothing
    const resolvedBreaks = Array.isArray(savedBreaks) && savedBreaks.length > 0
      ? savedBreaks
      : (readPlannerBreakSnapshot()?.breaks || []);
    plannerBreaksRef.current = resolvedBreaks;
    setPlannerBreaksRaw(resolvedBreaks);
    writePlannerBreakSnapshot(resolvedBreaks);

    const fetchedPhases = (pRes.data || []) as Phase[];
    const fetchedGroups = (gRes.data || []) as GroupEntry[];
    // Filter matches to only those belonging to phases in this category
    const phaseIds = new Set(fetchedPhases.map(p => p.id));
    const allMatches = mRes as Match[];
    const fetchedMatches = categoryId ? allMatches.filter(m => phaseIds.has(m.phase_id)) : allMatches;
    setMatches(fetchedMatches);

    const allDays = getTournamentPlannerDates(tournament);
    const firstScheduledDate = getFirstScheduledMatchDate(fetchedMatches);
    const initialPlannerDate = firstScheduledDate || (allDays.includes(plannerDate) ? plannerDate : allDays[0] || "");
    if (initialPlannerDate && initialPlannerDate !== plannerDate) {
      setPlannerDate(initialPlannerDate);
    }

    if (tRes.data) setTeams(tRes.data as any);
    setPhases(fetchedPhases);
    if (sRes.data) setSlots(sRes.data as any);
    setAllGroups(fetchedGroups);

    // Load all categories for import functionality
    if (categoryId) {
      const { data: cats } = await supabase.from("tournament_categories").select("id, name, fields, referees").eq("tournament_id", tournamentId);
      setAllCategories((cats || []).filter((c: any) => c.id !== categoryId));
    } else {
      setAllCategories([]);
    }

    // Default: alles geselecteerd
    const groupPhaseTypes = new Set(["group", "round_robin"]);
    const nonGroupPhases = fetchedPhases.filter(p => !groupPhaseTypes.has(p.phase_type));
    const groupPhasesSet = new Set(fetchedPhases.filter(p => groupPhaseTypes.has(p.phase_type)).map(p => p.id));
    setSchedFormats([]);
    setSchedGroups([]);
    setSchedRounds([]);
    setSchedFields([]);

    setLoading(false);
  };

  useEffect(() => {
    setUnscheduledOrder((prev) => {
      const unscheduledIds = matches
        .filter((m) => !m.match_date || !m.match_time || !m.field)
        .map((m) => m.id);
      const kept = prev.filter((id) => unscheduledIds.includes(id));
      const missing = unscheduledIds.filter((id) => !kept.includes(id));
      return [...kept, ...missing];
    });
  }, [matches]);

  // === CLEAR ALL SCHEDULE ===
  const clearAllSchedule = async () => {
    const scheduled = matches.filter(m => m.match_date || m.match_time || m.field);
    if (scheduled.length === 0) { toast({ title: "Geen geplande wedstrijden om te wissen" }); return; }
    for (const m of scheduled) {
      await supabase.from("matches").update({ match_date: null, match_time: null, field: null, referee: null }).eq("id", m.id);
    }
    setMatches(prev => prev.map(m => ({ ...m, match_date: null, match_time: null, field: null, referee: null })));
    setPlannerBreaks([]);
    setSchedFormats([]); setSchedGroups([]); setSchedRounds([]); setSchedFields([]);
    toast({ title: `${scheduled.length} wedstrijden gewist uit planning` });
  };

  // === FIELD MANAGEMENT ===
  const saveFields = async (updated: FieldConfig[]) => {
    const payload = serializeFieldEntries(updated as any) as any;
    if (categoryId) {
      await supabase.from("tournament_categories").update({ fields: payload }).eq("id", categoryId);
    } else {
      await supabase.from("tournaments").update({ fields: payload }).eq("id", tournamentId);
    }
    setFields(updated);
    registerFieldLocations([updated], locations);
  };
  /** Standaardlocatie voor een nieuw veld: de gekozen locatie, of de enige locatie. */
  const defaultFieldLocation = () =>
    (selectedLocation && selectedLocation !== "__unassigned" ? selectedLocation : null) ??
    (locations.length === 1 ? locations[0].name : null);
  const addField = async () => {
    const fieldNum = fields.length + 1;
    const newField: FieldConfig = { name: `Veld ${fieldNum}`, startTime: "09:00", location: defaultFieldLocation() };
    const updated = [...fields, newField];
    await saveFields(updated);
    toast({ title: `Veld ${fieldNum} toegevoegd` });
  };
  const addFieldFromDialog = async () => {
    const name = newFieldName.trim() || `Veld ${fields.length + 1}`;
    const newField: FieldConfig = { name, startTime: newFieldStartTime, location: newFieldLocation ?? defaultFieldLocation() };
    const updated = [...fields, newField];
    await saveFields(updated);
    setShowAddFieldDialog(false);
    setNewFieldName("");
    setNewFieldLocation(null);
    setNewFieldStartTime("09:00");
    toast({ title: `${name} toegevoegd` });
  };
  const removeField = async (idx: number) => { await saveFields(fields.filter((_, i) => i !== idx)); };
  const clearFieldMatches = async (idx: number) => {
    const fieldName = fields[idx]?.name;
    if (!fieldName) return;
    const fieldMatches = matches.filter(m => m.field === fieldName);
    if (fieldMatches.length === 0) { toast({ title: "Geen wedstrijden op dit veld" }); return; }
    for (const m of fieldMatches) {
      await supabase.from("matches").update({ match_date: null, match_time: null, field: null, referee: null }).eq("id", m.id);
    }
    setMatches(prev => prev.map(m => m.field === fieldName ? { ...m, match_date: null, match_time: null, field: null, referee: null } : m));
    toast({ title: `${fieldMatches.length} wedstrijden van ${fieldName} gewist` });
  };
  const updateFieldConfig = async (idx: number, key: keyof FieldConfig, value: string | number) => {
    await saveFields(fields.map((f, i) => i === idx ? { ...f, [key]: value } : f));
  };

  // === REFEREE MANAGEMENT ===
  const saveReferees = async (updated: RefereeConfig[]) => {
    const payload = serializeReferees(updated) as any;
    if (categoryId) {
      await supabase.from("tournament_categories").update({ referees: payload }).eq("id", categoryId);
    } else {
      await supabase.from("tournaments").update({ referees: payload }).eq("id", tournamentId);
    }
    setRefereeConfigs(updated);
  };
  const addReferee = async () => {
    if (!newRef.trim()) return;
    const updated: RefereeConfig[] = [...refereeConfigs, { name: newRef.trim(), allowedFields: null, availability: null, maxMatches: null, excludedTeams: [], roles: null }];
    await saveReferees(updated);
    setNewRef("");
    setShowRefAdd(false);
  };
  const editReferee = async () => {
    if (editRefIdx === null || !editRefName.trim()) return;
    const updated = refereeConfigs.map((r, i) => i === editRefIdx ? { ...r, name: editRefName.trim() } : r);
    // Also update any matches that had the old name
    const oldName = referees[editRefIdx];
    const newName = editRefName.trim();
    if (oldName !== newName) {
      const matchesWithRef = matches.filter(m => m.referee === oldName);
      for (const m of matchesWithRef) {
        await supabase.from("matches").update({ referee: newName }).eq("id", m.id);
      }
      setMatches(prev => prev.map(m => m.referee === oldName ? { ...m, referee: newName } : m));
    }
    await saveReferees(updated);
    setEditRefIdx(null);
    setEditRefName("");
  };
  const confirmRemoveReferee = async () => {
    if (deleteRefIdx === null) return;
    const updated = refereeConfigs.filter((_, i) => i !== deleteRefIdx);
    await saveReferees(updated);
    setDeleteRefIdx(null);
  };

  // === IMPORT FROM OTHER CATEGORY ===
  const importFieldsFrom = async (catId: string) => {
    const cat = allCategories.find(c => c.id === catId);
    if (!cat) return;
    const imported = parseFieldEntries(cat.fields);
    if (imported.length === 0) { toast({ title: "Deze divisie heeft geen velden", variant: "destructive" }); return; }
    await saveFields(imported);
    setShowImportFields(false);
    toast({ title: `${imported.length} velden geïmporteerd van ${cat.name}` });
  };

  const importRefereesFrom = async (catId: string) => {
    const cat = allCategories.find(c => c.id === catId);
    if (!cat) return;
    const imported = parseReferees(cat.referees);
    if (imported.length === 0) { toast({ title: "Deze divisie heeft geen scheidsrechters", variant: "destructive" }); return; }
    await saveReferees(imported);
    setShowImportRefs(false);
    toast({ title: `${imported.length} scheidsrechters geïmporteerd van ${cat.name}` });
  };

  const autoAssignReferees = async () => {
    if (refereeConfigs.length === 0) { toast({ title: "Voeg eerst scheidsrechters toe", variant: "destructive" }); return; }
    const scheduled = matches.filter(m => m.match_date && m.match_time && m.field);
    if (scheduled.length === 0) { toast({ title: "Geen geplande wedstrijden", variant: "destructive" }); return; }
    const sorted = [...scheduled].sort((a, b) => {
      if (a.match_date !== b.match_date) return (a.match_date || "").localeCompare(b.match_date || "");
      return (a.match_time || "").localeCompare(b.match_time || "");
    });
    const timeSlots = new Map<string, Match[]>();
    for (const m of sorted) {
      const key = `${m.match_date}_${m.match_time}`;
      if (!timeSlots.has(key)) timeSlots.set(key, []);
      timeSlots.get(key)!.push(m);
    }

    // Bestaande belasting meenemen voor de max-limiet
    const load = new Map<string, number>();
    for (const m of matches) {
      for (const name of (m.referee || "").split(",").map(s => s.trim()).filter(Boolean)) {
        load.set(name, (load.get(name) || 0) + 1);
      }
    }

    let refIndex = 0;
    const updates: { id: string; referee: string }[] = [];
    let skipped = 0;

    for (const [, slotMatches] of timeSlots) {
      const usedInSlot = new Set<string>();
      for (const m of slotMatches) {
        const assigned: string[] = [];
        for (let role = 1; role <= refereesPerMatch; role++) {
          let picked: RefereeConfig | null = null;
          for (let attempt = 0; attempt < refereeConfigs.length; attempt++) {
            const cand = refereeConfigs[(refIndex + attempt) % refereeConfigs.length];
            if (usedInSlot.has(cand.name)) continue;
            if (!refereeCanOfficiate(cand, m, role, load.get(cand.name) || 0)) continue;
            picked = cand;
            refIndex = (refIndex + attempt + 1) % refereeConfigs.length;
            break;
          }
          if (!picked) break;
          usedInSlot.add(picked.name);
          load.set(picked.name, (load.get(picked.name) || 0) + 1);
          assigned.push(picked.name);
        }
        if (assigned.length === 0) { skipped++; continue; }
        updates.push({ id: m.id, referee: assigned.join(", ") });
      }
    }

    for (const u of updates) {
      await supabase.from("matches").update({ referee: u.referee }).eq("id", u.id);
    }
    setMatches(prev => prev.map(m => {
      const u = updates.find(x => x.id === m.id);
      return u ? { ...m, referee: u.referee } : m;
    }));
    toast({
      title: `${updates.length} wedstrijden ingedeeld`,
      description: skipped > 0 ? `${skipped} wedstrijden zonder beschikbare scheidsrechter (instellingen)` : undefined,
    });
  };

  // === MATCH UPDATE ===
  const updateMatch = async (id: string, updates: Partial<Match>) => {
    await supabase.from("matches").update(updates).eq("id", id);
    setMatches(m => m.map(x => x.id === id ? { ...x, ...updates } : x));
  };

  const unscheduleMatch = async (id: string) => {
    await updateMatch(id, { match_date: null, match_time: null, field: null });
  };

  const getMatchLabel = (id: string | null, slotLabel: string | null) => {
    if (id) return teams.find(t => t.id === id)?.name || "?";
    return slotLabel || "TBD";
  };

  const getTeamLogo = (id: string | null) => {
    if (!id) return null;
    return teams.find(t => t.id === id)?.logo_url || null;
  };

  // === LIST FILTERS ===
  const getFilteredMatches = () => {
    let filtered = [...matches];
    if (filterPhase !== "all") filtered = filtered.filter(m => m.phase_id === filterPhase);
    if (filterGroup !== "all") filtered = filtered.filter(m => m.group_id === filterGroup);
    if (filterRound !== "all") filtered = filtered.filter(m => m.round_number === parseInt(filterRound));
    filtered.sort((a, b) => {
      const aScheduled = a.match_date && a.match_time ? 0 : 1;
      const bScheduled = b.match_date && b.match_time ? 0 : 1;
      if (aScheduled !== bScheduled) return aScheduled - bScheduled;
      // 1. Date
      if (a.match_date && b.match_date && a.match_date !== b.match_date) return a.match_date.localeCompare(b.match_date);
      // 2. Time
      if (a.match_time && b.match_time && a.match_time !== b.match_time) return a.match_time.localeCompare(b.match_time);
      // 3. Field
      if (a.field && b.field && a.field !== b.field) return a.field.localeCompare(b.field);
      const pa = phases.findIndex(p => p.id === a.phase_id);
      const pb = phases.findIndex(p => p.id === b.phase_id);
      if (pa !== pb) return pa - pb;
      return (a.round_number || 0) - (b.round_number || 0);
    });
    return filtered;
  };

  const getAvailableRounds = () => {
    let targetMatches = matches;
    if (filterPhase !== "all") targetMatches = targetMatches.filter(m => m.phase_id === filterPhase);
    if (filterGroup !== "all") targetMatches = targetMatches.filter(m => m.group_id === filterGroup);
    const rounds = new Set(targetMatches.map(m => m.round_number).filter(Boolean));
    return Array.from(rounds).sort((a, b) => (a as number) - (b as number)) as number[];
  };

  const getListGroups = () => {
    if (filterPhase === "all") return allGroups;
    return allGroups.filter(g => g.phase_id === filterPhase);
  };

  // === TEAM SELECTION FOR EMPTY SLOTS ===
  const getGroupTeamsForMatch = (match: Match) => {
    if (!match.group_id) return [];
    const groupSlots = slots.filter(s => s.group_id === match.group_id);
    const teamIds = groupSlots.map(s => s.team_id).filter(Boolean) as string[];
    return teams.filter(t => teamIds.includes(t.id));
  };

  const getUsedTeamsInRound = (match: Match) => {
    const roundMatches = matches.filter(m =>
      m.group_id === match.group_id &&
      m.round_number === match.round_number &&
      m.id !== match.id
    );
    const used = new Set<string>();
    for (const m of roundMatches) {
      if (m.home_team_id) used.add(m.home_team_id);
      if (m.away_team_id) used.add(m.away_team_id);
    }
    return used;
  };

  const isEmptySlotMatch = (match: Match) => {
    return !!match.match_name;
  };

  // Track which empty slot matches are being edited
  const [editingEmptySlotId, setEditingEmptySlotId] = useState<string | null>(null);

  // Check if an empty slot match has both teams locked (both selected)
  const isEmptySlotLocked = (match: Match) => {
    return isEmptySlotMatch(match) && match.home_team_id && match.away_team_id;
  };

  // === CLASH DETECTION ===
  const getMatchClashes = (match: Match): string[] => {
    if (!match.match_date || !match.match_time) return [];
    const clashes: string[] = [];
    const matchStart = timeToMinutes(match.match_time!);
    const matchPhase = phases.find(p => p.id === match.phase_id);
    const matchMc = (matchPhase?.match_config as any) || {};
    const matchDur = matchMc.phaseDuration ?? globalMatchDuration;
    const matchEnd = matchStart + matchDur;

    // Find all matches that overlap in time (not just exact same time)
    const sameTimeMatches = matches.filter(m => {
      if (m.id === match.id || m.match_date !== match.match_date || !m.match_time) return false;
      return m.match_time === match.match_time;
    });

    // Team clash
    const teamIds = [match.home_team_id, match.away_team_id].filter(Boolean) as string[];
    for (const tid of teamIds) {
      const teamName = teams.find(t => t.id === tid)?.name || "?";
      for (const other of sameTimeMatches) {
        if (other.home_team_id === tid || other.away_team_id === tid) {
          clashes.push(`${teamName} speelt meerdere wedstrijden op hetzelfde tijdstip`);
          break;
        }
      }
    }
    // Referee clash
    if (match.referee) {
      for (const other of sameTimeMatches) {
        if (other.referee === match.referee) {
          clashes.push(`Scheidsrechter ${match.referee} is al ingepland op dit tijdslot`);
          break;
        }
      }
    }
    // Dependency clash within same knockout/bracket phase:
    // A match cannot be scheduled at the same time or before a match it depends on
    if (matchPhase && (matchPhase.phase_type === "knockout" || matchPhase.phase_type === "single_match")) {
      const samePhaseMatches = matches.filter(m =>
        m.id !== match.id && m.phase_id === match.phase_id && m.match_date === match.match_date && m.match_time
      );

      // Check if this match depends on another match (slot label contains "Winnaar" or "Verliezer" of a match_name)
      const getDependencyMatchNames = (m: Match): string[] => {
        const deps: string[] = [];
        const labels = [m.home_slot_label, m.away_slot_label].filter(Boolean) as string[];
        for (const label of labels) {
          // Extract match name from labels like "Winnaar KF1", "Verliezer KF2", "W KF1", "L KF2"
          const cleaned = label
            .replace(/^(Winnaar|Verliezer|Winner|Loser|W|L)\s+/i, "")
            .trim();
          if (cleaned) deps.push(cleaned);
        }
        return deps;
      };

      const myDeps = getDependencyMatchNames(match);

      for (const other of samePhaseMatches) {
        const otherStart = timeToMinutes(other.match_time!);
        const otherDur = matchMc.phaseDuration ?? globalMatchDuration;
        const otherEnd = otherStart + otherDur;

        // Check if this match depends on the other match (other must finish first)
        if (other.match_name && myDeps.includes(other.match_name)) {
          if (otherEnd > matchStart) {
            clashes.push(`${match.match_name || "Wedstrijd"} hangt af van ${other.match_name}`);
          }
        }

        // Check if the other match depends on this match (this must finish first)
        const otherDeps = getDependencyMatchNames(other);
        if (match.match_name && otherDeps.includes(match.match_name)) {
          if (matchEnd > otherStart) {
            clashes.push(`${other.match_name || "Wedstrijd"} hangt af van ${match.match_name}`);
          }
        }
      }
    }
    return clashes;
  };

  // === PLANNER HELPERS ===
  // Velden zonder locatie horen bij de eerste locatie (bestaande toernooien)
  const plannerFields = !selectedLocation
    ? fields
    : fields.filter(f =>
        f.location
          ? f.location === selectedLocation
          : locations[0]?.name === selectedLocation
      );

  const getFieldTimeSlots = (field: FieldConfig) => {
    const result: { time: string; minuteStart: number }[] = [];
    let current = timeToMinutes(field.startTime);
    const endOfDay = 23 * 60 + 59;
    const fieldBreaks = plannerBreaks.filter(b => b.fieldNames.includes(field.name));

    for (let i = 0; i < 50; i++) {
      if (current > endOfDay) break;
      result.push({ time: minutesToTime(current), minuteStart: current });
      current += globalMatchDuration + globalBreakDuration;
      const breakHere = fieldBreaks.find(b => b.afterSlotIndex === i);
      if (breakHere) current += breakHere.duration;
    }
    return result;
  };

  const getMatchesForFieldSlot = (fieldName: string, time: string, date: string) => {
    return matches.filter(m => m.field === fieldName && m.match_time?.slice(0, 5) === time && m.match_date === date);
  };

  const getUnscheduledMatches = () => {
    let unscheduled = matches.filter(m => !m.match_date || !m.match_time || !m.field);
    if (sidebarFormat !== "all") unscheduled = unscheduled.filter(m => m.phase_id === sidebarFormat);
    if (sidebarGroup !== "all") unscheduled = unscheduled.filter(m => m.group_id === sidebarGroup);
    if (sidebarRound !== "all") {
      const parts = sidebarRound.split(":");
      const srPhaseId = parts[0];
      const srRound = parseInt(parts[1]);
      unscheduled = unscheduled.filter(m => m.phase_id === srPhaseId && m.round_number === srRound);
    }

    const orderMap = new Map(unscheduledOrder.map((id, index) => [id, index]));
    return unscheduled.sort((a, b) => {
      const ai = orderMap.get(a.id) ?? Number.MAX_SAFE_INTEGER;
      const bi = orderMap.get(b.id) ?? Number.MAX_SAFE_INTEGER;
      if (ai !== bi) return ai - bi;
      return a.id.localeCompare(b.id);
    });
  };

  const getSidebarRounds = (): { key: string; phaseId: string; round: number }[] => {
    let target = matches.filter(m => !m.match_date || !m.match_time || !m.field);
    if (sidebarFormat !== "all") target = target.filter(m => m.phase_id === sidebarFormat);
    if (sidebarGroup !== "all") target = target.filter(m => m.group_id === sidebarGroup);
    const seen = new Set<string>();
    const result: { key: string; phaseId: string; round: number }[] = [];
    for (const m of target) {
      if (!m.round_number) continue;
      const key = `${m.phase_id}:${m.round_number}`;
      if (seen.has(key)) continue;
      seen.add(key);
      result.push({ key, phaseId: m.phase_id, round: m.round_number });
    }
    return result.sort((a, b) => {
      const pa = phases.findIndex(p => p.id === a.phaseId);
      const pb = phases.findIndex(p => p.id === b.phaseId);
      if (pa !== pb) return pa - pb;
      return a.round - b.round;
    });
  };

  const getSidebarGroups = () => {
    const groupPhaseIds = new Set(phases.filter(p => p.phase_type === "group" || p.phase_type === "round_robin").map(p => p.id));
    if (sidebarFormat !== "all") return allGroups.filter(g => g.phase_id === sidebarFormat && groupPhaseIds.has(g.phase_id));
    return allGroups.filter(g => groupPhaseIds.has(g.phase_id));
  };

  // Unscheduled matches for filter purposes
  const unscheduledMatches = matches.filter(m => !m.match_date || !m.match_time || !m.field);

  // Get unique fase numbers that still have unscheduled matches
  const getUniqueFases = () => {
    const unschedPhaseIds = new Set(unscheduledMatches.map(m => m.phase_id));
    const faseNums = new Set(phases.filter(p => unschedPhaseIds.has(p.id)).map(p => p.phase_number));
    return Array.from(faseNums).sort((a, b) => a - b);
  };

  // Get bracket key for a match's group_id using phase's bracketGroupMap
  const getMatchBracketKey = (m: Match): string => {
    const phase = phases.find(p => p.id === m.phase_id);
    if (!phase) return "main";
    const bracketGroupMap: Record<string, string> = (phase.match_config as any)?.bracketGroupMap || {};
    if (m.group_id && bracketGroupMap[m.group_id]) return bracketGroupMap[m.group_id];
    return "main";
  };

  // Get display name for a bracket key using phase's bracketNames
  const getBracketDisplayName = (phase: typeof phases[0], bracketKey: string): string => {
    const bracketNames: Record<string, string> = (phase.match_config as any)?.bracketNames || {};
    if (bracketNames[bracketKey]) return bracketNames[bracketKey];
    if (bracketKey === "main") {
      if (phase.phase_type === "single_match") return phase.name || "Plaatsingswedstrijd";
      return "Hoofdbracket";
    }
    return `Plaatsing ${bracketKey}`;
  };

  // Helper: check if a match belongs to a selected bracket (phaseId:bracketKey composite key)
  const matchInSelectedBrackets = (m: Match): boolean => {
    const phase = phases.find(p => p.id === m.phase_id);
    if (!phase || phase.phase_type === "group" || phase.phase_type === "round_robin") return false;
    const bracketKey = getMatchBracketKey(m);
    return schedFormats.includes(`${m.phase_id}:${bracketKey}`);
  };

  // Returns composite round keys for round entries — knockout uses round_number per phase
  const getSchedRounds = (): { key: string; phaseId: string; round: number }[] => {
    let target = [...unscheduledMatches];
    if (schedFormats.length > 0 || schedGroups.length > 0) {
      target = target.filter(m => {
        const phase = phases.find(p => p.id === m.phase_id);
        if (phase && (phase.phase_type === "group" || phase.phase_type === "round_robin")) {
          return m.group_id && schedGroups.includes(m.group_id);
        }
        return matchInSelectedBrackets(m);
      });
    }
    const seen = new Set<string>();
    const result: { key: string; phaseId: string; round: number }[] = [];
    for (const m of target) {
      if (!m.round_number) continue;
      const key = `${m.phase_id}:${m.round_number}`;
      if (seen.has(key)) continue;
      seen.add(key);
      result.push({ key, phaseId: m.phase_id, round: m.round_number });
    }
    return result.sort((a, b) => {
      const pa = phases.findIndex(p => p.id === a.phaseId);
      const pb = phases.findIndex(p => p.id === b.phaseId);
      if (pa !== pb) return pa - pb;
      return a.round - b.round;
    });
  };

  // Unified "Groepen & Brackets" options — groups from group phases + knockout/single_match phases as brackets
  const getUnifiedGroupBracketOptions = (): { type: "group" | "bracket"; id: string; label: string; phaseId: string }[] => {
    const unschedPhaseIds = new Set(unscheduledMatches.map(m => m.phase_id));
    const unschedGroupIds = new Set(unscheduledMatches.map(m => m.group_id).filter(Boolean));
    const groupPhaseTypes = new Set(["group", "round_robin"]);
    const items: { type: "group" | "bracket"; id: string; label: string; phaseId: string; phaseSortOrder: number; subSortOrder: number }[] = [];

    // Groups from group phases — sorted by phase index (already sorted by phase_number, sort_order), then group sort_order
    const groupPhases = phases.filter(p => groupPhaseTypes.has(p.phase_type) && unschedPhaseIds.has(p.id));
    for (const gp of groupPhases) {
      const phaseIdx = phases.indexOf(gp);
      const groups = allGroups.filter(g => g.phase_id === gp.id && unschedGroupIds.has(g.id)).sort((a, b) => a.sort_order - b.sort_order);
      for (const g of groups) {
        items.push({ type: "group", id: g.id, label: `${g.name} (${gp.name})`, phaseId: gp.id, phaseSortOrder: phaseIdx, subSortOrder: g.sort_order });
      }
    }

    // Brackets from knockout/single_match phases — sorted by phase index, then bracket key order
    const bracketPhases = phases.filter(p => !groupPhaseTypes.has(p.phase_type) && unschedPhaseIds.has(p.id));
    for (const bp of bracketPhases) {
      const phaseIdx = phases.indexOf(bp);
      const phaseMatches = unscheduledMatches.filter(m => m.phase_id === bp.id);
      const bracketKeysSet = new Set<string>();
      for (const m of phaseMatches) {
        bracketKeysSet.add(getMatchBracketKey(m));
      }
      // Sort bracket keys: "main" first, then by the bracketGroupMap order (use group sort_order if available)
      const bracketKeys = [...bracketKeysSet].sort((a, b) => {
        if (a === "main") return -1;
        if (b === "main") return 1;
        const config = (bp.match_config as any) || {};
        const bgMap = config.bracketGroupMap || {};
        const groupForA = Object.keys(bgMap).find(gid => bgMap[gid] === a);
        const groupForB = Object.keys(bgMap).find(gid => bgMap[gid] === b);
        const grpA = groupForA ? allGroups.find(g => g.id === groupForA) : null;
        const grpB = groupForB ? allGroups.find(g => g.id === groupForB) : null;
        return (grpA?.sort_order ?? 0) - (grpB?.sort_order ?? 0);
      });
      for (let i = 0; i < bracketKeys.length; i++) {
        const bk = bracketKeys[i];
        const displayName = getBracketDisplayName(bp, bk);
        items.push({ type: "bracket", id: `${bp.id}:${bk}`, label: `${bp.name} (${displayName})`, phaseId: bp.id, phaseSortOrder: phaseIdx, subSortOrder: i });
      }
    }

    // Sort by phase index, then sub sort_order
    items.sort((a, b) => a.phaseSortOrder - b.phaseSortOrder || a.subSortOrder - b.subSortOrder);

    return items;
  };

  const getSchedFormatOptions = () => {
    const unschedPhaseIds = new Set(unscheduledMatches.map(m => m.phase_id));
    return phases.filter(p => unschedPhaseIds.has(p.id));
  };

  // Smart round label: knockout uses match_name + sub-bracket context, group uses R1/R2
  // subBracket: "_" = Hoofdbracket, otherwise the extracted sub-bracket name (e.g. "Plaats 5-8")
  const getSmartRoundLabel = (roundNum: number, contextPhaseIds?: string[], showFormatSuffix?: boolean, subBracket?: string) => {
    const contextMatches = matches.filter(m => {
      if (m.round_number !== roundNum) return false;
      if (contextPhaseIds && contextPhaseIds.length > 0 && !contextPhaseIds.includes(m.phase_id)) return false;
      return true;
    });
    const uniquePhaseIds = [...new Set(contextMatches.map(m => m.phase_id))];
    const phase = uniquePhaseIds.length === 1 ? phases.find(p => p.id === uniquePhaseIds[0]) : null;

    // Knockout / single_match: RoundName (FormatName, Hoofdbracket/sub-bracket)
    if (phase && (phase.phase_type === "knockout" || phase.phase_type === "single_match")) {
      // Filter to matches matching this sub-bracket
      const phaseMatches = contextMatches.filter(m => {
        if (!subBracket || subBracket === "_") {
          // Hoofdbracket: matches without parenthetical suffix
          return !m.match_name || !m.match_name.match(/\([^)]+\)\s*$/);
        }
        return m.match_name?.includes(`(${subBracket})`);
      });
      let roundName = `R${roundNum}`;
      if (phaseMatches.length > 0 && phaseMatches[0].match_name) {
        // Strip trailing number AND parenthetical sub-bracket suffix
        roundName = phaseMatches[0].match_name.replace(/\s*\([^)]+\)\s*$/, "").replace(/\s*\d+$/, "");
      }
      const bracketLabel = (!subBracket || subBracket === "_") ? "Hoofdbracket" : subBracket;
      return `${roundName} (${phase.name}, ${bracketLabel})`;
    }

    // Group / round_robin: R1, R2, ...
    const label = `R${roundNum}`;
    if (showFormatSuffix && phase) return `${label} (${phase.name})`;
    return label;
  };

  // Ref for horizontal scrolling of field columns
  const fieldColumnsRef = useState<HTMLDivElement | null>(null);

  // === DRAG & DROP ===
  const DRAG_MIME = "application/x-copa-planner-item";

  const hasPlannerDragData = (e?: React.DragEvent) => {
    if (dragPayloadRef.current || (dragItemId && dragItemType)) return true;
    if (!e) return false;
    const types = Array.from(e.dataTransfer.types || []);
    return types.includes(DRAG_MIME) || types.includes("text/plain");
  };

  const primeDragPayload = (payload: PlannerDragPayload) => {
    dragPayloadRef.current = payload;
  };

  const handleDragStart = (e: React.DragEvent, payload: PlannerDragPayload) => {
    dragPayloadRef.current = payload;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", payload.id);
    e.dataTransfer.setData(DRAG_MIME, JSON.stringify(payload));
    // Delay visual state update to prevent re-render from killing native drag
    if (dragVisualTimerRef.current) cancelAnimationFrame(dragVisualTimerRef.current);
    dragVisualTimerRef.current = requestAnimationFrame(() => {
      setDragItemId(payload.id);
      setDragItemType(payload.type);
    });
  };

  const getDraggedItem = (e?: React.DragEvent): PlannerDragPayload | null => {
    if (e) {
      const payload = e.dataTransfer.getData(DRAG_MIME);
      if (payload) {
        try {
          const parsed = JSON.parse(payload) as Partial<PlannerDragPayload>;
          if (parsed.id && (parsed.type === "match" || parsed.type === "break")) {
            return {
              id: parsed.id,
              type: parsed.type,
              field_id: parsed.field_id ?? null,
              slot_index: typeof parsed.slot_index === "number" ? parsed.slot_index : null,
              container: parsed.container === "schema" ? "schema" : "unscheduled",
            };
          }
        } catch {
          // Ignore malformed payload and fallback to text/plain
        }
      }

      const fallbackId = e.dataTransfer.getData("text/plain");
      if (fallbackId && /^[0-9a-f-]{36}$/i.test(fallbackId)) {
        return { id: fallbackId, type: "match", field_id: null, slot_index: null, container: "unscheduled" };
      }
    }

    if (dragPayloadRef.current) return dragPayloadRef.current;
    if (dragItemId && dragItemType) {
      return { id: dragItemId, type: dragItemType, field_id: null, slot_index: null, container: "unscheduled" };
    }
    return null;
  };

  const handleDragEnd = () => {
    if (dragVisualTimerRef.current) cancelAnimationFrame(dragVisualTimerRef.current);
    dragPayloadRef.current = null;
    setDragItemId(null);
    setDragItemType(null);
    setDragOverField(null);
    setDragOverIndex(null);
    setPreviewField(null);
    setPreviewIndex(null);
    lastPreviewUpdate.current = 0;
  };

  // Calculate insertion index based on mouse Y position relative to match cards in a field column
  const calcInsertionIndex = (fieldName: string, clientY: number): number => {
    const col = fieldColumnRefs.current.get(fieldName);
    if (!col) return 0;
    const cards = col.querySelectorAll<HTMLElement>("[data-planner-match-card]");
    if (cards.length === 0) return 0;
    // Filter out the dragged item (it's collapsed/hidden)
    const visibleCards = Array.from(cards).filter(card => card.getAttribute("data-planner-match-card") !== dragItemId);
    for (let i = 0; i < visibleCards.length; i++) {
      const rect = visibleCards[i].getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      if (clientY < midY) return i;
    }
    return visibleCards.length;
  };

  const handleDragOverSlot = (e: React.DragEvent, fieldName: string, index: number) => {
    if (!hasPlannerDragData(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverField(fieldName);
    setDragOverIndex(index);
  };

  // Continuous field column drag over with Y-position based insertion
  const autoScrollPlanner = (clientX: number, clientY: number) => {
    const scrollContainer = plannerScrollRef.current;
    if (scrollContainer) {
      const rect = scrollContainer.getBoundingClientRect();
      const horizontalEdge = 72;
      if (clientX < rect.left + horizontalEdge) scrollContainer.scrollBy({ left: -18, behavior: "auto" });
      if (clientX > rect.right - horizontalEdge) scrollContainer.scrollBy({ left: 18, behavior: "auto" });
    }

    const verticalEdge = 120;
    if (clientY < verticalEdge) window.scrollBy({ top: -24, behavior: "auto" });
    if (window.innerHeight - clientY < verticalEdge) window.scrollBy({ top: 24, behavior: "auto" });
  };

  const handleFieldColumnDragOver = (e: React.DragEvent, fieldName: string) => {
    if (!hasPlannerDragData(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    autoScrollPlanner(e.clientX, e.clientY);
    
    // Throttle preview updates to ~60fps
    const now = Date.now();
    if (now - lastPreviewUpdate.current < 16) return;
    lastPreviewUpdate.current = now;

    const idx = calcInsertionIndex(fieldName, e.clientY);
    if (previewField !== fieldName || previewIndex !== idx) {
      setPreviewField(fieldName);
      setPreviewIndex(idx);
      setDragOverField(fieldName);
      setDragOverIndex(idx);
    }
  };

  // Get ordered matches for a field on the planner date
  const getFieldMatchesOrdered = (fieldName: string, matchList?: Match[]) => {
    const src = matchList || matches;
    return src
      .filter(m => m.field === fieldName && m.match_date === plannerDate)
      .sort((a, b) => (a.match_time || "").localeCompare(b.match_time || ""));
  };

  // Calculate times for an ordered list of match IDs on a field (pure function, no state)
  const calcFieldTimes = (fieldName: string, orderedMatchIds: string[], breakSource: PlannerBreak[] = plannerBreaksRef.current): { id: string; match_time: string }[] => {
    const field = plannerFields.find(f => f.name === fieldName);
    if (!field) return [];
    const fieldBreaks = breakSource.filter(b => b.fieldNames.includes(fieldName));
    let current = timeToMinutes(field.startTime);
    const updates: { id: string; match_time: string }[] = [];
    for (let i = 0; i < orderedMatchIds.length; i++) {
      updates.push({ id: orderedMatchIds[i], match_time: minutesToTime(current) });
      const m = matches.find(mm => mm.id === orderedMatchIds[i]);
      const mp = m ? phases.find(pp => pp.id === m.phase_id) : undefined;
      const mc = (mp?.match_config as any) || {};
      current += (mc.phaseDuration ?? globalMatchDuration) + (mc.phaseBreak ?? globalBreakDuration);
      const breakHere = fieldBreaks.find(b => b.afterSlotIndex === i);
      if (breakHere) current += breakHere.duration;
    }
    return updates;
  };

  const syncFieldTimes = async (fieldNames: string[], breakSource: PlannerBreak[], matchSource: Match[] = matches) => {
    const uniqueFields = Array.from(new Set(fieldNames.filter(Boolean)));
    if (uniqueFields.length === 0) return;

    const timeUpdates = uniqueFields.flatMap((fieldName) => {
      const orderedMatchIds = getFieldMatchesOrdered(fieldName, matchSource).map((m) => m.id);
      return calcFieldTimes(fieldName, orderedMatchIds, breakSource);
    });

    if (timeUpdates.length === 0) return;

    setMatches((prev) => prev.map((match) => {
      const update = timeUpdates.find((entry) => entry.id === match.id);
      return update && match.match_time !== update.match_time
        ? { ...match, match_time: update.match_time }
        : match;
    }));

    for (const update of timeUpdates) {
      await supabase.from("matches").update({ match_time: update.match_time }).eq("id", update.id);
    }
  };

  const removeBreak = async (breakId: string) => {
    const breakToRemove = plannerBreaksRef.current.find((entry) => entry.id === breakId);
    const affectedFields = breakToRemove?.fieldNames || [];
    const nextBreaks = setPlannerBreaks((prev) => prev.filter((entry) => entry.id !== breakId));
    await syncFieldTimes(affectedFields, nextBreaks);
  };

  // Core drop logic (shared between native drag fallback and dnd-kit)
  const performDrop = async (dragged: PlannerDragPayload, fieldName: string, insertAtIndex: number) => {
    if (dragged.type === "break") {
      const breakId = dragged.id;
      const movedBreak = plannerBreaksRef.current.find((entry) => entry.id === breakId);
      const oldFieldNames = movedBreak?.fieldNames || [];
      const nextBreaks = setPlannerBreaks(prev => prev.map(b => {
        if (b.id !== breakId) return b;
        return { ...b, fieldNames: [fieldName], afterSlotIndex: Math.max(0, insertAtIndex - 1) };
      }));
      await syncFieldTimes([...oldFieldNames, fieldName], nextBreaks);
      toast({ title: "Pauze verplaatst" });
      return;
    }

    const matchId = dragged.id;
    setUnscheduledOrder((prev) => prev.filter((id) => id !== matchId));

    const currentMatches = [...matches];
    const draggedMatch = currentMatches.find(m => m.id === matchId);
    if (!draggedMatch) return;

    const oldField = draggedMatch.field;
    const wasScheduledOnDate = draggedMatch.match_date === plannerDate;
    const wasOnSameField = oldField === fieldName && wasScheduledOnDate;
    const wasOnDifferentField = oldField && oldField !== fieldName && wasScheduledOnDate;

    const currentFieldMatches = currentMatches
      .filter(m => m.field === fieldName && m.match_date === plannerDate)
      .sort((a, b) => (a.match_time || "").localeCompare(b.match_time || ""));
    const currentIds = currentFieldMatches.map(m => m.id);
    const filteredIds = currentIds.filter(id => id !== matchId);

    const clampedIdx = Math.min(insertAtIndex, filteredIds.length);
    filteredIds.splice(clampedIdx, 0, matchId);

    const targetTimes = calcFieldTimes(fieldName, filteredIds);

    let oldFieldTimes: { id: string; match_time: string }[] = [];
    if (wasOnDifferentField && oldField) {
      const oldFieldIds = currentMatches
        .filter(m => m.field === oldField && m.match_date === plannerDate && m.id !== matchId)
        .sort((a, b) => (a.match_time || "").localeCompare(b.match_time || ""))
        .map(m => m.id);
      oldFieldTimes = calcFieldTimes(oldField, oldFieldIds);
    }

    const dbUpdates: { id: string; field?: string; match_date?: string | null; match_time?: string | null }[] = [];
    const newMatches = currentMatches.map(m => {
      if (m.id === matchId) {
        const timeUpdate = targetTimes.find(t => t.id === m.id);
        const newTime = timeUpdate?.match_time || m.match_time;
        dbUpdates.push({ id: m.id, field: fieldName, match_date: plannerDate, match_time: newTime });
        return { ...m, field: fieldName, match_date: plannerDate, match_time: newTime };
      }
      const targetUpdate = targetTimes.find(t => t.id === m.id);
      if (targetUpdate && m.match_time !== targetUpdate.match_time) {
        dbUpdates.push({ id: m.id, match_time: targetUpdate.match_time });
        return { ...m, match_time: targetUpdate.match_time };
      }
      const oldUpdate = oldFieldTimes.find(t => t.id === m.id);
      if (oldUpdate && m.match_time !== oldUpdate.match_time) {
        dbUpdates.push({ id: m.id, match_time: oldUpdate.match_time });
        return { ...m, match_time: oldUpdate.match_time };
      }
      return m;
    });

    setMatches(newMatches);
    for (const u of dbUpdates) {
      const updatePayload: any = {};
      if (u.field !== undefined) updatePayload.field = u.field;
      if (u.match_date !== undefined) updatePayload.match_date = u.match_date;
      if (u.match_time !== undefined) updatePayload.match_time = u.match_time;
      await supabase.from("matches").update(updatePayload).eq("id", u.id);
    }

    // No structural conflict warnings needed — matches from the same round can play simultaneously
  };

  const handleDrop = async (e: React.DragEvent, fieldName: string, insertAtIndex: number) => {
    e.preventDefault();
    const dragged = getDraggedItem(e);
    if (!dragged) return;
    dragPayloadRef.current = null;
    setDragItemId(null);
    setDragItemType(null);
    setDragOverField(null);
    setDragOverIndex(null);
    await performDrop(dragged, fieldName, insertAtIndex);
  };

  const performDropToUnscheduled = async (dragged: PlannerDragPayload, insertAtIndex?: number) => {
    if (dragged.type === "break") {
      await removeBreak(dragged.id);
      toast({ title: "Pauze verwijderd" });
      return;
    }

    const matchId = dragged.id;
    const targetIndex = typeof insertAtIndex === "number" ? insertAtIndex : null;
    const draggedMatch = matches.find((m) => m.id === matchId);
    const alreadyUnscheduled = !!draggedMatch && (!draggedMatch.match_date || !draggedMatch.match_time || !draggedMatch.field);

    if (alreadyUnscheduled) {
      if (targetIndex !== null) {
        setUnscheduledOrder((prev) => {
          const unscheduledIds = matches
            .filter((m) => !m.match_date || !m.match_time || !m.field)
            .map((m) => m.id);
          const ordered = prev.filter((id) => unscheduledIds.includes(id));
          const withoutDragged = ordered.filter((id) => id !== matchId);
          const clampedIndex = Math.max(0, Math.min(targetIndex, withoutDragged.length));
          withoutDragged.splice(clampedIndex, 0, matchId);
          return withoutDragged;
        });
      }
      return;
    }

    const currentMatches = [...matches];
    const droppedMatch = currentMatches.find(m => m.id === matchId);
    if (!droppedMatch) return;

    const oldField = droppedMatch.field;
    const wasOnDate = droppedMatch.match_date === plannerDate;

    let oldFieldTimes: { id: string; match_time: string }[] = [];
    if (oldField && wasOnDate) {
      const oldFieldIds = currentMatches
        .filter(m => m.field === oldField && m.match_date === plannerDate && m.id !== matchId)
        .sort((a, b) => (a.match_time || "").localeCompare(b.match_time || ""))
        .map(m => m.id);
      oldFieldTimes = calcFieldTimes(oldField, oldFieldIds);
    }

    const dbUpdates: { id: string; match_time: string }[] = [];
    const newMatches = currentMatches.map(m => {
      if (m.id === matchId) return { ...m, match_date: null, match_time: null, field: null, referee: null };
      const oldUpdate = oldFieldTimes.find(t => t.id === m.id);
      if (oldUpdate && m.match_time !== oldUpdate.match_time) {
        dbUpdates.push({ id: m.id, match_time: oldUpdate.match_time });
        return { ...m, match_time: oldUpdate.match_time };
      }
      return m;
    });

    setMatches(newMatches);
    await supabase.from("matches").update({ match_date: null, match_time: null, field: null, referee: null }).eq("id", matchId);
    for (const u of dbUpdates) {
      await supabase.from("matches").update({ match_time: u.match_time }).eq("id", u.id);
    }

    setUnscheduledOrder((prev) => {
      const next = prev.filter((id) => id !== matchId);
      const fallbackIndex = next.length;
      const clampedIndex = Math.max(0, Math.min(targetIndex ?? fallbackIndex, next.length));
      next.splice(clampedIndex, 0, matchId);
      return next;
    });
  };

  const handleDropToUnscheduled = async (e: React.DragEvent, insertAtIndex?: number) => {
    e.preventDefault();
    const dragged = getDraggedItem(e);
    if (!dragged) return;
    dragPayloadRef.current = null;
    setDragItemId(null);
    setDragItemType(null);
    setDragOverField(null);
    setDragOverIndex(null);
    await performDropToUnscheduled(dragged, insertAtIndex);
  };

  // === dnd-kit pointer tracking during drag ===
  useEffect(() => {
    if (!activeDragPayload) return;
    const activeId = activeDragPayload.id;

    const handler = (e: PointerEvent) => {
      pointerPositionRef.current = { x: e.clientX, y: e.clientY };
      autoScrollPlanner(e.clientX, e.clientY);

      const now = Date.now();
      if (now - lastPreviewUpdate.current < 16) return;
      lastPreviewUpdate.current = now;

      let foundField: string | null = null;
      for (const [fieldName, el] of fieldColumnRefs.current.entries()) {
        const rect = el.getBoundingClientRect();
        if (e.clientX >= rect.left - 10 && e.clientX <= rect.right + 10) {
          foundField = fieldName;
          break;
        }
      }

      if (foundField) {
        const col = fieldColumnRefs.current.get(foundField);
        if (!col) return;
        const cards = col.querySelectorAll<HTMLElement>("[data-planner-match-card]");
        const visibleCards = Array.from(cards).filter(c => c.getAttribute("data-planner-match-card") !== activeId);
        let idx = visibleCards.length;
        for (let i = 0; i < visibleCards.length; i++) {
          const rect = visibleCards[i].getBoundingClientRect();
          if (e.clientY < rect.top + rect.height / 2) { idx = i; break; }
        }
        setPreviewField(foundField);
        setPreviewIndex(idx);
        setDragOverField(foundField);
        setDragOverIndex(idx);
      } else {
        const unschedEl = unscheduledZoneRef.current;
        if (unschedEl) {
          const rect = unschedEl.getBoundingClientRect();
          if (e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom) {
            setDragOverField("__unscheduled__");
            setPreviewField(null);
            setPreviewIndex(null);
            return;
          }
        }
        setPreviewField(null);
        setPreviewIndex(null);
        setDragOverField(null);
        setDragOverIndex(null);
      }
    };

    window.addEventListener("pointermove", handler, { passive: true });
    return () => window.removeEventListener("pointermove", handler);
  }, [activeDragPayload]);

  // === dnd-kit event handlers ===
  const handleDndDragStart = (event: DragStartEvent) => {
    const payload = event.active.data.current as PlannerDragPayload;
    if (!payload) return;
    setActiveDragPayload(payload);
    setDragItemId(payload.id);
    setDragItemType(payload.type);
  };

  const handleDndDragEnd = (event: DragEndEvent) => {
    const payload = activeDragPayload;
    const targetField = previewField;
    const targetIndex = previewIndex;
    const isUnscheduled = dragOverField === "__unscheduled__";

    setActiveDragPayload(null);
    handleDragEnd();

    if (payload && targetField && targetIndex !== null) {
      void performDrop(payload, targetField, targetIndex);
    } else if (payload && isUnscheduled) {
      void performDropToUnscheduled(payload);
    }
  };

  // === SMART AUTO SCHEDULE ===
  // FIXED: Sort by phase, then group name (A, B, C...), then round
  const autoSchedule = async () => {
    // Empty filters = nothing can be planned
    if (schedFields.length === 0) { toast({ title: "Selecteer minstens één veld", variant: "destructive" }); return; }
    const options = getUnifiedGroupBracketOptions();
    if (options.length > 0 && schedFormats.length === 0 && schedGroups.length === 0) { toast({ title: "Selecteer minstens één groep of bracket", variant: "destructive" }); return; }
    if (getSchedRounds().length > 0 && schedRounds.length === 0) { toast({ title: "Selecteer minstens één speelronde", variant: "destructive" }); return; }

    let toSchedule = matches.filter(m => !m.match_date || !m.match_time || !m.field);
    if (schedFormats.length > 0 || schedGroups.length > 0) {
      toSchedule = toSchedule.filter(m => {
        if (m.group_id && schedGroups.includes(m.group_id)) return true;
        const phase = phases.find(p => p.id === m.phase_id);
        if (phase && (phase.phase_type === "group" || phase.phase_type === "round_robin")) return false;
        return matchInSelectedBrackets(m);
      });
    }
    if (schedRounds.length > 0) {
      const roundTuples = schedRounds.map(k => { const parts = k.split(":"); return { phaseId: parts[0], round: parseInt(parts[1]) }; });
      toSchedule = toSchedule.filter(m => m.round_number && roundTuples.some(rp => rp.phaseId === m.phase_id && rp.round === m.round_number));
    }
    if (toSchedule.length === 0) { toast({ title: "Geen ongeplande wedstrijden voor deze selectie", variant: "destructive" }); return; }

    const useFields = plannerFields.filter(f => schedFields.includes(f.name));
    if (useFields.length === 0) { toast({ title: "Geen velden beschikbaar", variant: "destructive" }); return; }

    const fieldNextSlot: number[] = useFields.map(field => {
      const fieldSlots = getFieldTimeSlots(field);
      const scheduledOnField = matches.filter(m => m.field === field.name && m.match_date === plannerDate && m.match_time);
      if (scheduledOnField.length === 0) return 0;
      // Find the latest match end time on this field (accounting for per-phase duration)
      let latestEnd = 0;
      for (const m of scheduledOnField) {
        const mStart = timeToMinutes(m.match_time!);
        const mp = phases.find(p => p.id === m.phase_id);
        const mc = (mp?.match_config as any) || {};
        const dur = mc.phaseDuration ?? globalMatchDuration;
        const brk = mc.phaseBreak ?? globalBreakDuration;
        const end = mStart + dur + brk;
        if (end > latestEnd) latestEnd = end;
      }
      // Find first slot that starts at or after the latest match end
      const nextIdx = fieldSlots.findIndex(s => s.minuteStart >= latestEnd);
      return nextIdx >= 0 ? nextIdx : fieldSlots.length;
    });


    // Round ordering tracking
    const knockoutRoundEnd: Record<string, number> = {};
    const isKnockoutPhase = (m: Match) => {
      const phase = phases.find(p => p.id === m.phase_id);
      return phase && (phase.phase_type === "knockout" || phase.phase_type === "single_match");
    };
    const isSequentialPhase = (m: Match) => {
      // All phase types enforce round ordering: R1 before R2, QF before SF, etc.
      return m.round_number != null;
    };
    // No structural conflict key needed — matches from the same round CAN play simultaneously
    const getStructKey = (_m: Match): string | null => null;
    // Round ordering key: groups use group_id, knockouts use phase_id (cross-bracket round deps)
    const getRoundOrderKey = (m: Match): string | null => {
      if (m.round_number == null) return null;
      const phase = phases.find(p => p.id === m.phase_id);
      if (phase && (phase.phase_type === "group" || phase.phase_type === "round_robin")) {
        return m.group_id ? `group:${m.group_id}` : null;
      }
      // Knockouts: phase-level tracking so ALL brackets respect global round ordering
      // (e.g. HF round 3 waits for ALL QF round 2 matches across all brackets)
      return `phase:${m.phase_id}`;
    };
    const getRoundKey = (orderKey: string, round: number) => `${orderKey}:round:${round}`;
    const getPrevRoundsEnd = (orderKey: string, currentRound: number) => {
      let maxEnd = 0;
      for (let r = 1; r < currentRound; r++) {
        const k = getRoundKey(orderKey, r);
        if (knockoutRoundEnd[k]) maxEnd = Math.max(maxEnd, knockoutRoundEnd[k]);
      }
      return maxEnd;
    };
    const getMatchDur = (m: Match) => {
      const mp = phases.find(p => p.id === m.phase_id);
      const mc = (mp?.match_config as any) || {};
      return mc.phaseDuration ?? globalMatchDuration;
    };
    for (const m of matches.filter(x => x.match_date === plannerDate && x.match_time && x.field)) {
      if (!m.match_time) continue;
      const endTime = timeToMinutes(m.match_time!) + getMatchDur(m);
      const rok = getRoundOrderKey(m);
      if (rok && m.round_number != null) {
        const krk = getRoundKey(rok, m.round_number);
        knockoutRoundEnd[krk] = Math.max(knockoutRoundEnd[krk] || 0, endTime);
      }
    }

    // Always track team busy times to prevent double-booking
    const teamBusyUntil: Record<string, number> = {};
    for (const m of matches.filter(x => x.match_date === plannerDate && x.match_time && x.field)) {
      if (!m.match_time) continue;
      const endTime = timeToMinutes(m.match_time!) + getMatchDur(m) + globalBreakDuration;
      const homeKey = m.home_team_id || m.home_slot_label || "";
      const awayKey = m.away_team_id || m.away_slot_label || "";
      if (homeKey) teamBusyUntil[homeKey] = Math.max(teamBusyUntil[homeKey] || 0, endTime);
      if (awayKey) teamBusyUntil[awayKey] = Math.max(teamBusyUntil[awayKey] || 0, endTime);
    }

    const updates: { id: string; match_date: string; match_time: string; field: string }[] = [];
    // Sorting: phase order → round number → knockout/single_match by match_name, groups by group name
    const sorted = [...toSchedule].sort((a, b) => {
      // 1) Phase order
      const pa = phases.findIndex(p => p.id === a.phase_id);
      const pb = phases.findIndex(p => p.id === b.phase_id);
      if (pa !== pb) return pa - pb;
      const phaseA = phases.find(p => p.id === a.phase_id);
      // 2) For knockout/single_match: round_number → group sort_order → match number
      if (phaseA && (phaseA.phase_type === "knockout" || phaseA.phase_type === "single_match")) {
        const ra = a.round_number || 0;
        const rb = b.round_number || 0;
        if (ra !== rb) return ra - rb;
        // Within same round: sort by group (bracket) sort_order, then created_at
        const ga = allGroups.find(g => g.id === a.group_id);
        const gb = allGroups.find(g => g.id === b.group_id);
        const gso = (ga?.sort_order ?? 0) - (gb?.sort_order ?? 0);
        if (gso !== 0) return gso;
        const gcr = (ga?.created_at || "").localeCompare(gb?.created_at || "");
        if (gcr !== 0) return gcr;
        // Within same group: sort by structural seed range (slot labels) for stable bracket order
        const seedA = getMinSeedFromSlots(a);
        const seedB = getMinSeedFromSlots(b);
        if (seedA !== seedB) return seedA - seedB;
        return (a.created_at || "").localeCompare(b.created_at || "");
      }
      // 3) For group/round_robin: round number → group sort_order → group created_at
      //    This interleaves groups per round so they share fields instead of one group monopolising all slots
      const ra = a.round_number || 0;
      const rb = b.round_number || 0;
      if (ra !== rb) return ra - rb;
      const ga = allGroups.find(g => g.id === a.group_id);
      const gb = allGroups.find(g => g.id === b.group_id);
      const groupOrder = (ga?.sort_order ?? 0) - (gb?.sort_order ?? 0);
      if (groupOrder !== 0) return groupOrder;
      const groupCreated = (ga?.created_at || "").localeCompare(gb?.created_at || "");
      if (groupCreated !== 0) return groupCreated;
      return (a.created_at || "").localeCompare(b.created_at || "");
    });

    for (const match of sorted) {
      let bestFieldIdx = -1;
      let bestTime = Infinity;
      let bestSlotIdx = -1;

      const fieldIndices = useFields.map((_, i) => i);

      for (const fi of fieldIndices) {
        const field = useFields[fi];
        const fieldSlots = getFieldTimeSlots(field);
        let slotIdx = fieldNextSlot[fi];
        if (slotIdx >= fieldSlots.length) continue;
        let candidateTime = fieldSlots[slotIdx].minuteStart;
        // Always prevent team double-booking
        const homeKey = match.home_team_id || match.home_slot_label || "";
        const awayKey = match.away_team_id || match.away_slot_label || "";
        if (homeKey && teamBusyUntil[homeKey]) candidateTime = Math.max(candidateTime, teamBusyUntil[homeKey]);
        if (awayKey && teamBusyUntil[awayKey]) candidateTime = Math.max(candidateTime, teamBusyUntil[awayKey]);
        // Round ordering: round N waits for ALL previous rounds to finish
        const rok = getRoundOrderKey(match);
        if (rok && match.round_number != null && match.round_number > 1) {
          const prevEnd = getPrevRoundsEnd(rok, match.round_number);
          if (prevEnd > 0) candidateTime = Math.max(candidateTime, prevEnd);
        }
        while (slotIdx < fieldSlots.length && fieldSlots[slotIdx].minuteStart < candidateTime) slotIdx++;
        if (slotIdx >= fieldSlots.length) continue;
        candidateTime = fieldSlots[slotIdx].minuteStart;

        if (candidateTime < bestTime) {
          bestTime = candidateTime;
          bestFieldIdx = fi;
          bestSlotIdx = slotIdx;
        }
      }
      if (bestFieldIdx === -1) continue;
      const field = useFields[bestFieldIdx];
      const fieldSlots = getFieldTimeSlots(field);
      const timeStr = fieldSlots[bestSlotIdx].time;
      updates.push({ id: match.id, match_date: plannerDate, match_time: timeStr, field: field.name });
      fieldNextSlot[bestFieldIdx] = bestSlotIdx + 1;
      // Update round end tracker
      const rok2 = getRoundOrderKey(match);
      if (rok2 && match.round_number != null) {
        const endTime = fieldSlots[bestSlotIdx].minuteStart + getMatchDur(match);
        const krk = getRoundKey(rok2, match.round_number);
        knockoutRoundEnd[krk] = Math.max(knockoutRoundEnd[krk] || 0, endTime);
      }
      // Update team busy tracker
      {
        const endTime = fieldSlots[bestSlotIdx].minuteStart + getMatchDur(match) + globalBreakDuration;
        const hk = match.home_team_id || match.home_slot_label || "";
        const ak = match.away_team_id || match.away_slot_label || "";
        if (hk) teamBusyUntil[hk] = Math.max(teamBusyUntil[hk] || 0, endTime);
        if (ak) teamBusyUntil[ak] = Math.max(teamBusyUntil[ak] || 0, endTime);
      }
    }

    // Recalculate field times for breaks, but NEVER shift a match earlier than its placed time
    // (round-dependency gaps must be preserved)
    const updatedMatches = matches.map(m => {
      const u = updates.find(x => x.id === m.id);
      return u ? { ...m, match_date: u.match_date, match_time: u.match_time, field: u.field } : m;
    });
    const finalUpdates: { id: string; match_time: string }[] = [];
    for (const field of useFields) {
      const fieldMatchIds = updatedMatches
        .filter(m => m.field === field.name && m.match_date === plannerDate)
        .sort((a, b) => (a.match_time || "").localeCompare(b.match_time || ""))
        .map(m => m.id);
      const recalced = calcFieldTimes(field.name, fieldMatchIds);
      for (const rc of recalced) {
        const existing = updatedMatches.find(m => m.id === rc.id);
        if (existing && existing.match_time !== rc.match_time) {
          // Only shift LATER (for pauses), never earlier (preserve round-dependency gaps)
          if (rc.match_time > existing.match_time) {
            existing.match_time = rc.match_time;
            finalUpdates.push(rc);
          }
        }
      }
    }

    // Persist all updates
    for (const u of updates) {
      const final = updatedMatches.find(m => m.id === u.id);
      await supabase.from("matches").update({ match_date: u.match_date, match_time: final?.match_time || u.match_time, field: u.field }).eq("id", u.id);
    }
    for (const u of finalUpdates) {
      if (!updates.find(x => x.id === u.id)) {
        await supabase.from("matches").update({ match_time: u.match_time }).eq("id", u.id);
      }
    }
    setMatches(updatedMatches);
    setSchedFormats([]); setSchedGroups([]); setSchedRounds([]); setSchedFields([]);
    toast({ title: `${updates.length} wedstrijden gepland!` });
  };

  // === PLAN ALL ===
  const planFullTournament = async () => {
    setSchedFormats([]); setSchedGroups([]); setSchedRounds([]); setSchedFields([]);
    let toSchedule = matches.filter(m => !m.match_date || !m.match_time || !m.field);
    if (toSchedule.length === 0) { toast({ title: "Alle wedstrijden zijn al gepland" }); return; }
    const useFields = plannerFields;
    if (useFields.length === 0) { toast({ title: "Geen velden beschikbaar", variant: "destructive" }); return; }

    const fieldNextSlot: number[] = useFields.map(field => {
      const fieldSlots = getFieldTimeSlots(field);
      const scheduledOnField = matches.filter(m => m.field === field.name && m.match_date === plannerDate && m.match_time);
      if (scheduledOnField.length === 0) return 0;
      // Find the latest match end time on this field (accounting for per-phase duration)
      let latestEnd = 0;
      for (const m of scheduledOnField) {
        const mStart = timeToMinutes(m.match_time!);
        const mp = phases.find(p => p.id === m.phase_id);
        const mc = (mp?.match_config as any) || {};
        const dur = mc.phaseDuration ?? globalMatchDuration;
        const brk = mc.phaseBreak ?? globalBreakDuration;
        const end = mStart + dur + brk;
        if (end > latestEnd) latestEnd = end;
      }
      // Find first slot that starts at or after the latest match end
      const nextIdx = fieldSlots.findIndex(s => s.minuteStart >= latestEnd);
      return nextIdx >= 0 ? nextIdx : fieldSlots.length;
    });
    const getMatchDurLocal = (m: Match) => {
      const mp = phases.find(p => p.id === m.phase_id);
      const mc = (mp?.match_config as any) || {};
      return mc.phaseDuration ?? globalMatchDuration;
    };
    // Always track team busy times to prevent double-booking
    const teamBusyUntil: Record<string, number> = {};
    for (const m of matches.filter(x => x.match_date === plannerDate && x.match_time && x.field)) {
      if (!m.match_time) continue;
      const endTime = timeToMinutes(m.match_time!) + getMatchDurLocal(m) + globalBreakDuration;
      const homeKey = m.home_team_id || m.home_slot_label || "";
      const awayKey = m.away_team_id || m.away_slot_label || "";
      if (homeKey) teamBusyUntil[homeKey] = Math.max(teamBusyUntil[homeKey] || 0, endTime);
      if (awayKey) teamBusyUntil[awayKey] = Math.max(teamBusyUntil[awayKey] || 0, endTime);
    }
    // Round ordering tracking
    const knockoutRoundEnd: Record<string, number> = {};
    const getRoundOrderKey = (m: Match): string | null => {
      if (m.round_number == null) return null;
      const phase = phases.find(p => p.id === m.phase_id);
      if (phase && (phase.phase_type === "group" || phase.phase_type === "round_robin")) {
        return m.group_id ? `group:${m.group_id}` : null;
      }
      return `phase:${m.phase_id}`;
    };
    const getRoundKey = (orderKey: string, round: number) => `${orderKey}:round:${round}`;
    const getPrevRoundsEnd = (orderKey: string, currentRound: number) => {
      let maxEnd = 0;
      for (let r = 1; r < currentRound; r++) {
        const k = getRoundKey(orderKey, r);
        if (knockoutRoundEnd[k]) maxEnd = Math.max(maxEnd, knockoutRoundEnd[k]);
      }
      return maxEnd;
    };
    // getMatchDurLocal already defined above
    // Seed round trackers from already-scheduled matches
    for (const m of matches.filter(x => x.match_date === plannerDate && x.match_time && x.field)) {
      if (!m.match_time) continue;
      const endTime = timeToMinutes(m.match_time!) + getMatchDurLocal(m);
      const rok = getRoundOrderKey(m);
      if (rok && m.round_number != null) {
        const krk = getRoundKey(rok, m.round_number);
        knockoutRoundEnd[krk] = Math.max(knockoutRoundEnd[krk] || 0, endTime);
      }
    }
    const updates: { id: string; match_date: string; match_time: string; field: string }[] = [];
    // Sorting: phase order → knockout by created_at, groups by sort_order then round
    const sorted = [...toSchedule].sort((a, b) => {
      // 1) Phase order
      const pa = phases.findIndex(p => p.id === a.phase_id);
      const pb = phases.findIndex(p => p.id === b.phase_id);
      if (pa !== pb) return pa - pb;
      const phaseA = phases.find(p => p.id === a.phase_id);
      // 2) For knockout/single_match: round_number → group sort_order → match number
      if (phaseA && (phaseA.phase_type === "knockout" || phaseA.phase_type === "single_match")) {
        const ra = a.round_number || 0;
        const rb = b.round_number || 0;
        if (ra !== rb) return ra - rb;
        const ga = allGroups.find(g => g.id === a.group_id);
        const gb = allGroups.find(g => g.id === b.group_id);
        const gso = (ga?.sort_order ?? 0) - (gb?.sort_order ?? 0);
        if (gso !== 0) return gso;
        const gcr = (ga?.created_at || "").localeCompare(gb?.created_at || "");
        if (gcr !== 0) return gcr;
        const seedA = getMinSeedFromSlots(a);
        const seedB = getMinSeedFromSlots(b);
        if (seedA !== seedB) return seedA - seedB;
        return (a.created_at || "").localeCompare(b.created_at || "");
      }
      // 3) For group/round_robin: round number → group sort_order → group created_at
      const ra = a.round_number || 0;
      const rb = b.round_number || 0;
      if (ra !== rb) return ra - rb;
      const ga = allGroups.find(g => g.id === a.group_id);
      const gb = allGroups.find(g => g.id === b.group_id);
      const groupOrder = (ga?.sort_order ?? 0) - (gb?.sort_order ?? 0);
      if (groupOrder !== 0) return groupOrder;
      const groupCreated = (ga?.created_at || "").localeCompare(gb?.created_at || "");
      if (groupCreated !== 0) return groupCreated;
      return (a.created_at || "").localeCompare(b.created_at || "");
    });
    for (const match of sorted) {
      let bestFieldIdx = -1;
      let bestTime = Infinity;
      let bestSlotIdx = -1;
      for (let fi = 0; fi < useFields.length; fi++) {
        const field = useFields[fi];
        const fieldSlots = getFieldTimeSlots(field);
        let slotIdx = fieldNextSlot[fi];
        if (slotIdx >= fieldSlots.length) continue;
        let candidateTime = fieldSlots[slotIdx].minuteStart;
        // Always prevent team double-booking
        const homeKey = match.home_team_id || match.home_slot_label || "";
        const awayKey = match.away_team_id || match.away_slot_label || "";
        if (homeKey && teamBusyUntil[homeKey]) candidateTime = Math.max(candidateTime, teamBusyUntil[homeKey]);
        if (awayKey && teamBusyUntil[awayKey]) candidateTime = Math.max(candidateTime, teamBusyUntil[awayKey]);
        // Round ordering: round N waits for ALL previous rounds to finish
        const rok = getRoundOrderKey(match);
        if (rok && match.round_number != null && match.round_number > 1) {
          const prevEnd = getPrevRoundsEnd(rok, match.round_number);
          if (prevEnd > 0) candidateTime = Math.max(candidateTime, prevEnd);
        }
        while (slotIdx < fieldSlots.length && fieldSlots[slotIdx].minuteStart < candidateTime) slotIdx++;
        if (slotIdx >= fieldSlots.length) continue;
        candidateTime = fieldSlots[slotIdx].minuteStart;
        if (candidateTime < bestTime) {
          bestTime = candidateTime;
          bestFieldIdx = fi;
          bestSlotIdx = slotIdx;
        }
      }
      if (bestFieldIdx === -1) continue;
      const field = useFields[bestFieldIdx];
      const fieldSlots = getFieldTimeSlots(field);
      const timeStr = fieldSlots[bestSlotIdx].time;
      updates.push({ id: match.id, match_date: plannerDate, match_time: timeStr, field: field.name });
      fieldNextSlot[bestFieldIdx] = bestSlotIdx + 1;
      // Update round end tracker
      const rok2 = getRoundOrderKey(match);
      if (rok2 && match.round_number != null) {
        const endTime = fieldSlots[bestSlotIdx].minuteStart + getMatchDurLocal(match);
        const krk = getRoundKey(rok2, match.round_number);
        knockoutRoundEnd[krk] = Math.max(knockoutRoundEnd[krk] || 0, endTime);
      }
      // Update team busy tracker
      {
        const endTime = fieldSlots[bestSlotIdx].minuteStart + getMatchDurLocal(match) + globalBreakDuration;
        const hk = match.home_team_id || match.home_slot_label || "";
        const ak = match.away_team_id || match.away_slot_label || "";
        if (hk) teamBusyUntil[hk] = Math.max(teamBusyUntil[hk] || 0, endTime);
        if (ak) teamBusyUntil[ak] = Math.max(teamBusyUntil[ak] || 0, endTime);
      }
    }
    // Recalculate field times for breaks, but NEVER shift a match earlier than its placed time
    const updatedMatches = matches.map(m => {
      const u = updates.find(x => x.id === m.id);
      return u ? { ...m, match_date: u.match_date, match_time: u.match_time, field: u.field } : m;
    });
    const finalUpdates: { id: string; match_time: string }[] = [];
    for (const field of useFields) {
      const fieldMatchIds = updatedMatches
        .filter(m => m.field === field.name && m.match_date === plannerDate)
        .sort((a, b) => (a.match_time || "").localeCompare(b.match_time || ""))
        .map(m => m.id);
      const recalced = calcFieldTimes(field.name, fieldMatchIds);
      for (const rc of recalced) {
        const existing = updatedMatches.find(m => m.id === rc.id);
        if (existing && existing.match_time !== rc.match_time) {
          if (rc.match_time > existing.match_time) {
            existing.match_time = rc.match_time;
            finalUpdates.push(rc);
          }
        }
      }
    }
    for (const u of updates) {
      const final = updatedMatches.find(m => m.id === u.id);
      await supabase.from("matches").update({ match_date: u.match_date, match_time: final?.match_time || u.match_time, field: u.field }).eq("id", u.id);
    }
    for (const u of finalUpdates) {
      if (!updates.find(x => x.id === u.id)) {
        await supabase.from("matches").update({ match_time: u.match_time }).eq("id", u.id);
      }
    }
    setMatches(updatedMatches);
    toast({ title: `${updates.length} wedstrijden gepland voor volledig toernooi!` });
  };

  // === BREAK ===
  const addBreak = () => {
    if (newBreakFields.length === 0) {
      toast({ title: "Selecteer minstens één veld", variant: "destructive" }); return;
    }
    const newBreaks: PlannerBreak[] = [];
    for (const fn of newBreakFields) {
      const fieldMatches = getFieldMatchesOrdered(fn);
      const afterIdx = fieldMatches.length > 0 ? fieldMatches.length - 1 : 0;
      newBreaks.push({
        id: crypto.randomUUID(),
        fieldNames: [fn],
        afterSlotIndex: afterIdx,
        duration: newBreakDuration,
      });
    }
    setPlannerBreaks(b => [...b, ...newBreaks]);
    setShowBreakAdd(false);
    setNewBreakFields([]);
    toast({ title: `${newBreaks.length} pauze(s) toegevoegd` });
  };

  const addBreakToField = (fieldName: string) => {
    const fieldMatches = getFieldMatchesOrdered(fieldName);
    const afterIdx = fieldMatches.length > 0 ? fieldMatches.length - 1 : 0;
    const newBreak: PlannerBreak = {
      id: crypto.randomUUID(),
      fieldNames: [fieldName],
      afterSlotIndex: afterIdx,
      duration: pauzeModalDuration,
    };
    setPlannerBreaks(b => [...b, newBreak]);
    setShowPauzeModal(null);
    setPauzeModalName("Pauze");
    setPauzeModalDuration(20);
    toast({ title: "Pauze toegevoegd" });
  };

  // === TOURNAMENT DATES ===
  const getTournamentDates = () => getTournamentPlannerDates(tournament);


  const tournamentDates = getTournamentDates();

  useEffect(() => {
    if (tournamentDates.length === 0) return;
    if (!tournamentDates.includes(plannerDate)) {
      setPlannerDate(tournamentDates[0]);
    }
  }, [plannerDate, tournamentDates]);

  const toggleSchedFormat = (id: string) => {
    setSchedFormats(prev => {
      const removing = prev.includes(id);
      const next = removing ? prev.filter(x => x !== id) : [...prev, id];
      if (removing) {
        const phaseId = id.split(":")[0];
        // Remove rounds belonging to this phase if no other brackets from same phase remain
        const otherSamePhase = next.some(x => x.startsWith(phaseId + ":"));
        if (!otherSamePhase) {
          setSchedRounds(r => r.filter(k => !k.startsWith(phaseId + ":")));
        }
      }
      return next;
    });
  };
  const toggleSchedRound = (key: string) => {
    setSchedRounds(prev => {
      const next = prev.includes(key) ? prev.filter(x => x !== key) : [...prev, key];
      // Sync: deselect groups/brackets whose rounds are ALL deselected
      syncBracketsFromRounds(next);
      return next;
    });
  };
  const setSchedRoundsAndSync = (nextRounds: string[]) => {
    setSchedRounds(nextRounds);
    syncBracketsFromRounds(nextRounds);
  };
  const syncBracketsFromRounds = (activeRounds: string[]) => {
    const activePhaseIds = new Set(activeRounds.map(k => k.split(":")[0]));
    // For each selected group, check if it still has rounds selected
    setSchedGroups(prev => {
      const groupPhaseTypes = new Set(["group", "round_robin"]);
      return prev.filter(gId => {
        const group = allGroups.find(g => g.id === gId);
        if (!group) return false;
        const phase = phases.find(p => p.id === group.phase_id);
        if (!phase || !groupPhaseTypes.has(phase.phase_type)) return false;
        // Check if any round from this group's phase is still active
        return activeRounds.some(k => k.startsWith(phase.id + ":"));
      });
    });
    // For each selected bracket, check if it still has rounds selected
    setSchedFormats(prev => prev.filter(compositeKey => {
      const phaseId = compositeKey.split(":")[0];
      return activePhaseIds.has(phaseId);
    }));
  };
  const toggleSchedField = (fn: string) => {
    setSchedFields(prev => prev.includes(fn) ? prev.filter(x => x !== fn) : [...prev, fn]);
  };
  const toggleBreakField = (fn: string) => {
    setNewBreakFields(prev => prev.includes(fn) ? prev.filter(x => x !== fn) : [...prev, fn]);
  };
  const toggleSchedGroup = (gId: string) => {
    setSchedGroups(prev => {
      const removing = prev.includes(gId);
      const next = removing ? prev.filter(x => x !== gId) : [...prev, gId];
      if (removing) {
        const group = allGroups.find(g => g.id === gId);
        if (group) {
          // Remove rounds belonging to this group's phase if no other groups from same phase remain
          const samePhaseGroups = allGroups.filter(g => g.phase_id === group.phase_id).map(g => g.id);
          const otherSamePhase = next.some(id => samePhaseGroups.includes(id));
          if (!otherSamePhase) {
            setSchedRounds(r => r.filter(k => !k.startsWith(group.phase_id + ":")));
          }
        }
      }
      return next;
    });
  };

  // Auto-select all rounds when all poules/brackets become selected
  const prevBracketsAllRef = useRef(false);
  useEffect(() => {
    const options = getUnifiedGroupBracketOptions();
    if (options.length === 0) { prevBracketsAllRef.current = false; return; }
    const allGroupIds = options.filter(o => o.type === "group").map(o => o.id);
    const allBracketIds = options.filter(o => o.type === "bracket").map(o => o.id);
    const allSelected = allGroupIds.every(id => schedGroups.includes(id)) && allBracketIds.every(id => schedFormats.includes(id));
    if (allSelected && !prevBracketsAllRef.current) {
      const allRounds = getSchedRounds();
      setSchedRounds(allRounds.map(r => r.key));
    }
    prevBracketsAllRef.current = allSelected;
  }, [schedGroups, schedFormats]);

  const getMatchInfoLabel = (m: Match) => {
    const phase = phases.find(p => p.id === m.phase_id);
    const group = allGroups.find(g => g.id === m.group_id);
    const isKnockout = phase?.phase_type === "knockout" || phase?.phase_type === "single_match";
    const parts: string[] = [];
    if (phase) parts.push(phase.name);
    if (isKnockout) {
      if (m.match_name) {
        // Strip leg suffix; it's appended via getMatchFormatSuffix below.
        const baseName = m.match_name.replace(/\s+\((Heen|Terug)\)$/, "");
        parts.push(baseName);
      }
    } else {
      if (group) parts.push(group.name);
    }
    const label = parts.join(" · ");
    const suffix = getMatchFormatSuffix(m as any, scoringSystems as any, phases as any, allGroups as any);
    return `${label}${suffix}`;
  };

  // PlannerItem, PlannerInsertionMarker and DraggablePlannerItem are defined outside MatchScheduler for component identity stability

  // Team select component for empty slot matches
  const TeamSelectCell = ({ match, side }: { match: Match; side: "home" | "away" }) => {
    const groupTeams = getGroupTeamsForMatch(match);
    const usedTeams = getUsedTeamsInRound(match);
    const currentTeamId = side === "home" ? match.home_team_id : match.away_team_id;
    const otherTeamId = side === "home" ? match.away_team_id : match.home_team_id;

    const availableTeams = groupTeams.filter(t => {
      if (t.id === currentTeamId) return true;
      if (t.id === otherTeamId) return false;
      if (usedTeams.has(t.id)) return false;
      return true;
    });

    return (
      <Select
        value={currentTeamId || "__empty__"}
        onValueChange={async (val) => {
          const teamId = val === "__empty__" ? null : val;
          const upd = side === "home"
            ? { home_team_id: teamId }
            : { away_team_id: teamId };
          await updateMatch(match.id, upd as any);
        }}
      >
        <SelectTrigger className="h-7 text-xs w-36">
          <SelectValue>
            {currentTeamId ? (
              <div className="flex items-center gap-1.5">
                {getTeamLogo(currentTeamId) && <img src={getTeamLogo(currentTeamId)!} className="h-3.5 w-3.5 object-contain" />}
                <span>{getMatchLabel(currentTeamId, null)}</span>
              </div>
            ) : "Team kiezen"}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__empty__">— Leeg —</SelectItem>
          {availableTeams.map(t => (
            <SelectItem key={t.id} value={t.id}>
              <div className="flex items-center gap-1.5">
                {t.logo_url && <img src={t.logo_url} className="h-3.5 w-3.5 object-contain" />}
                {t.name}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  };

  const saveGlobalDuration = async () => {
    await supabase.from("tournaments").update({ match_duration: globalMatchDuration, break_duration: globalBreakDuration } as any).eq("id", tournamentId);
    toast({ title: "Wedstrijdduur opgeslagen" });
  };

  const saveDurationSettings = async () => {
    // Save global
    setGlobalMatchDuration(draftMatchDuration);
    setGlobalBreakDuration(draftBreakDuration);
    await supabase.from("tournaments").update({ match_duration: draftMatchDuration, break_duration: draftBreakDuration } as any).eq("id", tournamentId);

    // Save per-format
    setPerFormatDurationEnabled(draftPerFormat);
    if (draftPerFormat) {
      for (const p of phases) {
        const dc = draftPhaseConfigs[p.id] || { phaseDuration: null, phaseBreak: null };
        const config = (p.match_config as any) || {};
        const newConfig = { ...config, phaseDuration: dc.phaseDuration, phaseBreak: dc.phaseBreak };
        await supabase.from("tournament_phases").update({ match_config: newConfig }).eq("id", p.id);
      }
      setPhases(prev => prev.map(x => {
        const dc = draftPhaseConfigs[x.id] || { phaseDuration: null, phaseBreak: null };
        const cfg = { ...((x.match_config as any) || {}), phaseDuration: dc.phaseDuration, phaseBreak: dc.phaseBreak };
        return { ...x, match_config: cfg };
      }));
    } else {
      // Clear per-format overrides
      for (const p of phases) {
        const config = (p.match_config as any) || {};
        if (config.phaseDuration != null || config.phaseBreak != null) {
          const newConfig = { ...config };
          delete newConfig.phaseDuration;
          delete newConfig.phaseBreak;
          await supabase.from("tournament_phases").update({ match_config: newConfig }).eq("id", p.id);
        }
      }
      setPhases(prev => prev.map(x => {
        const cfg = { ...((x.match_config as any) || {}) };
        delete cfg.phaseDuration;
        delete cfg.phaseBreak;
        return { ...x, match_config: cfg };
      }));
    }

    toast({ title: "Wedstrijdduur opgeslagen" });
    setShowDurationDialog(false);
  };

  const saveMatchEdit = async () => {
    if (!editMatchId) return;
    await updateMatch(editMatchId, { referee: editMatchReferee || null });
    setEditMatchId(null);
    toast({ title: "Scheidsrechter bijgewerkt" });
  };

  // === MOBILE TAP-TO-PLACE ===
  const handleMobileTapMatch = (matchId: string) => {
    if (!isMobile) return;
    setMobileSelectedMatchId(prev => prev === matchId ? null : matchId);
  };

  const handleMobilePlaceMatch = async (fieldName: string, insertAtIndex: number) => {
    if (!mobileSelectedMatchId) return;
    const matchId = mobileSelectedMatchId;
    setMobileSelectedMatchId(null);

    setUnscheduledOrder((prev) => prev.filter((id) => id !== matchId));

    // Compute from current state snapshot
    const currentMatches = [...matches];
    const draggedMatch = currentMatches.find(m => m.id === matchId);
    if (!draggedMatch) return;

    const oldField = draggedMatch.field;
    const wasScheduledOnDate = draggedMatch.match_date === plannerDate;
    const wasOnSameField = oldField === fieldName && wasScheduledOnDate;
    const wasOnDifferentField = oldField && oldField !== fieldName && wasScheduledOnDate;

    const currentFieldMatches = currentMatches
      .filter(m => m.field === fieldName && m.match_date === plannerDate)
      .sort((a, b) => (a.match_time || "").localeCompare(b.match_time || ""));
    const currentIds = currentFieldMatches.map(m => m.id);
    const filteredIds = currentIds.filter(id => id !== matchId);

    let adjustedIndex = insertAtIndex;
    if (wasOnSameField) {
      const originalIndex = currentIds.indexOf(matchId);
      if (originalIndex < insertAtIndex) adjustedIndex = Math.max(0, insertAtIndex - 1);
    }
    const clampedIdx = Math.min(adjustedIndex, filteredIds.length);
    filteredIds.splice(clampedIdx, 0, matchId);

    const targetTimes = calcFieldTimes(fieldName, filteredIds);

    let oldFieldTimes: { id: string; match_time: string }[] = [];
    if (wasOnDifferentField && oldField) {
      const oldFieldIds = currentMatches
        .filter(m => m.field === oldField && m.match_date === plannerDate && m.id !== matchId)
        .sort((a, b) => (a.match_time || "").localeCompare(b.match_time || ""))
        .map(m => m.id);
      oldFieldTimes = calcFieldTimes(oldField, oldFieldIds);
    }

    const dbUpdates: { id: string; field?: string; match_date?: string | null; match_time?: string | null }[] = [];
    const newMatches = currentMatches.map(m => {
      if (m.id === matchId) {
        const timeUpdate = targetTimes.find(t => t.id === m.id);
        const newTime = timeUpdate?.match_time || m.match_time;
        dbUpdates.push({ id: m.id, field: fieldName, match_date: plannerDate, match_time: newTime });
        return { ...m, field: fieldName, match_date: plannerDate, match_time: newTime };
      }
      const targetUpdate = targetTimes.find(t => t.id === m.id);
      if (targetUpdate && m.match_time !== targetUpdate.match_time) {
        dbUpdates.push({ id: m.id, match_time: targetUpdate.match_time });
        return { ...m, match_time: targetUpdate.match_time };
      }
      const oldUpdate = oldFieldTimes.find(t => t.id === m.id);
      if (oldUpdate && m.match_time !== oldUpdate.match_time) {
        dbUpdates.push({ id: m.id, match_time: oldUpdate.match_time });
        return { ...m, match_time: oldUpdate.match_time };
      }
      return m;
    });

    setMatches(newMatches);

    for (const u of dbUpdates) {
      const updatePayload: any = {};
      if (u.field !== undefined) updatePayload.field = u.field;
      if (u.match_date !== undefined) updatePayload.match_date = u.match_date;
      if (u.match_time !== undefined) updatePayload.match_time = u.match_time;
      await supabase.from("matches").update(updatePayload).eq("id", u.id);
    }
    toast({ title: "Wedstrijd geplaatst" });
  };

  const handleMobileUnschedule = async (matchId: string) => {
    setMobileSelectedMatchId(null);
    await unscheduleMatch(matchId);
    toast({ title: "Wedstrijd ontpland" });
  };

  // === PRINT PLANNER ===
  const printPlanner = () => {
    window.print();
  };

  if (loading) return <div className="flex justify-center py-8"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;

  const filteredMatches = getFilteredMatches();
  const availableRounds = getAvailableRounds();

  return (
    <div className="space-y-4">
      {/* Planner only — no tabs */}
      <div>

        {/* ===== PLANNER VIEW ===== */}
        <div className="print-planner-area">
          <DndContext sensors={sensors} onDragStart={handleDndDragStart} onDragEnd={handleDndDragEnd} onDragCancel={() => { setActiveDragPayload(null); handleDragEnd(); }}>
          {/* Top bar — wedstrijddagen als subtiele titels, max 7 zichtbaar met navigatie + datepicker */}
          {tournamentDates.length > 0 ? (
            <div className="py-2 print:hidden border-b border-border mb-0">
              <DateStripNav
                dates={tournamentDates}
                activeDate={plannerDate}
                onSelect={setPlannerDate}
                onInvalidPick={(iso) => {
                  toast({
                    title: "Datum buiten toernooiperiode",
                    description: `${iso} valt niet binnen de ingestelde wedstrijddagen.`,
                    variant: "destructive",
                  });
                }}
              />
            </div>
          ) : (
            <div className="py-4 print:hidden border-b border-border mb-0 text-sm text-muted-foreground">
              Voeg eerst wedstrijddagen toe bij <span className="font-medium text-foreground">Algemeen</span> om de planner te gebruiken.
            </div>
          )}

          {/* Locatiekiezer — enkel bij meerdere locaties */}
          {locations.length > 1 && (
            <div className="flex items-center gap-2 py-2 print:hidden border-b border-border">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Locatie</span>
              <select
                value={selectedLocation || ""}
                onChange={(e) => setSelectedLocation(e.target.value || null)}
                className="h-9 rounded-lg border border-input bg-background px-3 text-sm font-medium"
              >
                {locations.map(l => (
                  <option key={l.id} value={l.name}>{l.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Print header */}
          <div className="hidden print:block mb-4">
            <h2 className="text-xl font-bold">{tournament.name} — Planning</h2>
            <p className="text-sm text-muted-foreground">
              {new Date(plannerDate + "T00:00:00").toLocaleDateString("nl-BE", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            </p>
          </div>

          {/* Duration Dialog */}
          <Dialog open={showDurationDialog} onOpenChange={(open) => {
            if (!open) {
              // Discard: reset drafts to actual saved values
              setDraftMatchDuration(globalMatchDuration);
              setDraftBreakDuration(globalBreakDuration);
              setDraftPerFormat(perFormatDurationEnabled);
              setDraftPhaseConfigs(phases.reduce((acc, p) => {
                const cfg = (p.match_config as any) || {};
                acc[p.id] = { phaseDuration: cfg.phaseDuration ?? null, phaseBreak: cfg.phaseBreak ?? null };
                return acc;
              }, {} as Record<string, { phaseDuration: number | null; phaseBreak: number | null }>));
            }
            setShowDurationDialog(open);
          }}>
            <DialogContent ref={durationDialogRef} className="sm:max-w-md max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Wedstrijdduur</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className={`space-y-3 rounded-md p-3 transition-opacity ${draftPerFormat ? "opacity-40 pointer-events-none bg-muted" : ""}`}>
                  <p className="text-xs font-medium text-muted-foreground">Voor alle wedstrijden</p>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 space-y-1">
                      <Label className="text-xs">Wedstrijdduur</Label>
                      <div className="flex items-center gap-2">
                        <Input type="number" value={draftMatchDuration || ""} onChange={(e) => setDraftMatchDuration(e.target.value === "" ? 0 : parseInt(e.target.value) || 0)} className="h-8 text-xs" disabled={draftPerFormat} />
                        <span className="text-xs text-muted-foreground whitespace-nowrap">minuten</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 space-y-1">
                      <Label className="text-xs">Tijd tussen wedstrijden</Label>
                      <div className="flex items-center gap-2">
                        <Input type="number" value={draftBreakDuration || ""} onChange={(e) => setDraftBreakDuration(e.target.value === "" ? 0 : parseInt(e.target.value) || 0)} className="h-8 text-xs" disabled={draftPerFormat} />
                        <span className="text-xs text-muted-foreground whitespace-nowrap">minuten</span>
                      </div>
                    </div>
                  </div>
                </div>

                {phases.length > 1 && (
                  <>
                    <div className="border-t border-border pt-4">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-medium text-muted-foreground">Per format instellen</Label>
                        <Switch checked={draftPerFormat} onCheckedChange={setDraftPerFormat} />
                      </div>
                    </div>

                    {draftPerFormat && (
                      <div className="space-y-2">
                        {phases.map(p => {
                          const dc = draftPhaseConfigs[p.id] || { phaseDuration: null, phaseBreak: null };
                          return (
                            <div key={p.id} className="rounded-md border border-border p-2 space-y-1.5">
                              <span className="text-xs font-medium text-foreground">{p.name}</span>
                              <div className="flex items-center gap-2">
                                <div className="flex-1 space-y-0.5">
                                  <Label className="text-[10px] text-muted-foreground">Wedstrijdduur</Label>
                                  <div className="flex items-center gap-1.5">
                                    <Input type="number" placeholder={String(draftMatchDuration)} value={dc.phaseDuration ?? ""}
                                      onChange={(e) => {
                                        const val = e.target.value ? parseInt(e.target.value) : null;
                                        setDraftPhaseConfigs(prev => ({ ...prev, [p.id]: { ...prev[p.id], phaseDuration: val } }));
                                      }} className="h-7 text-xs w-16" />
                                    <span className="text-[10px] text-muted-foreground">min</span>
                                  </div>
                                </div>
                                <div className="flex-1 space-y-0.5">
                                  <Label className="text-[10px] text-muted-foreground">Rust</Label>
                                  <div className="flex items-center gap-1.5">
                                    <Input type="number" placeholder={String(draftBreakDuration)} value={dc.phaseBreak ?? ""}
                                      onChange={(e) => {
                                        const val = e.target.value ? parseInt(e.target.value) : null;
                                        setDraftPhaseConfigs(prev => ({ ...prev, [p.id]: { ...prev[p.id], phaseBreak: val } }));
                                      }} className="h-7 text-xs w-16" />
                                    <span className="text-[10px] text-muted-foreground">min</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}

                <Button size="sm" onClick={saveDurationSettings} className="text-xs w-full">Opslaan</Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Main layout: field columns + right sidebar */}
          <div className="flex gap-0 mt-2">
            {/* Field columns */}
            <div className="flex-1 min-w-0 relative">
              {plannerFields.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border py-12 text-center">
                  <p className="text-muted-foreground text-sm mb-3">Voeg velden toe om de planner te gebruiken</p>
                  <Button variant="outline" size="sm" onClick={() => { setNewFieldName(""); setNewFieldStartTime("09:00"); setShowAddFieldDialog(true); }} className="gap-1 text-xs">
                    <Plus className="h-3 w-3" /> Veld toevoegen
                  </Button>
                </div>
              ) : (() => {
                const fieldData = plannerFields.map(field => {
                  const fieldMatches = getFieldMatchesOrdered(field.name);
                  const fieldBreaks = plannerBreaks.filter(b => b.fieldNames.includes(field.name));
                  let currentTime = timeToMinutes(field.startTime);
                  const slotTimes: string[] = [];
                  const items: { kind: "match" | "break"; startMin: number; idx: number; match?: any; brk?: any }[] = [];
                  for (let i = 0; i < fieldMatches.length; i++) {
                    slotTimes.push(minutesToTime(currentTime));
                    items.push({ kind: "match", startMin: currentTime, idx: i, match: fieldMatches[i] });
                    const matchPhase = phases.find(p => p.id === fieldMatches[i].phase_id);
                    const matchCfg = (matchPhase?.match_config as any) || {};
                    const dur = matchCfg.phaseDuration ?? globalMatchDuration;
                    const brk = matchCfg.phaseBreak ?? globalBreakDuration;
                    currentTime += dur + brk;
                    const breakHere = fieldBreaks.find(b => b.afterSlotIndex === i);
                    if (breakHere) {
                      items.push({ kind: "break", startMin: currentTime, idx: i, brk: breakHere });
                      currentTime += breakHere.duration;
                    }
                  }
                  return { field, fieldMatches, fieldBreaks, slotTimes, items, nextFreeTime: minutesToTime(currentTime) };
                });

                // Shared timeline: every distinct start time becomes a row, so equal
                // moments line up across all field columns (gaps get an empty block).
                const timelineTimes = Array.from(
                  new Set(fieldData.flatMap(f => f.items.map(i => i.startMin)))
                ).sort((a, b) => a - b);


                return (
                  <div>
                    {/* Action bar — Wedstrijdduur + planner collapse */}
                    <div className="sticky top-0 z-10 flex items-center justify-end gap-1 mb-1 bg-background/95 backdrop-blur-sm py-1 print:hidden">
                      <Button variant="outline" size="sm" onClick={() => {
                        setDraftMatchDuration(globalMatchDuration);
                        setDraftBreakDuration(globalBreakDuration);
                        setDraftPerFormat(perFormatDurationEnabled);
                        setDraftPhaseConfigs(phases.reduce((acc, p) => {
                          const cfg = (p.match_config as any) || {};
                          acc[p.id] = { phaseDuration: cfg.phaseDuration ?? null, phaseBreak: cfg.phaseBreak ?? null };
                          return acc;
                        }, {} as Record<string, { phaseDuration: number | null; phaseBreak: number | null }>));
                        setShowDurationDialog(true);
                      }} className="gap-1 text-xs h-7">
                        <Settings className="h-3 w-3" /> Wedstrijdduur
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPlannerCollapsed((v) => !v)}
                        className="gap-1 text-xs h-7"
                        title={plannerCollapsed ? "Planner tonen" : "Planner inklappen"}
                      >
                        {plannerCollapsed ? <PanelRightOpen className="h-3.5 w-3.5" /> : <PanelRightClose className="h-3.5 w-3.5" />}
                        {plannerCollapsed ? "Planner tonen" : "Planner inklappen"}
                      </Button>
                    </div>

                    <div id="planner-field-scroll" ref={plannerScrollRef} className="overflow-x-auto pb-2 scroll-smooth">
                      <div className="flex gap-0 min-w-0">
                        {fieldData.map(({ field, fieldMatches, fieldBreaks, slotTimes, items, nextFreeTime }) => (
                          <div key={field.name} className="min-w-[330px] w-[330px] flex-shrink-0 print:min-w-0 print:w-auto print:flex-1">
                            {/* Field header */}
                            <div
                              data-planner-drop-zone="true"
                              onDragOver={(e) => handleFieldColumnDragOver(e, field.name)}
                              onDrop={(e) => handleDrop(e, field.name, 0)}
                              onClick={() => { if (isMobile && mobileSelectedMatchId) handleMobilePlaceMatch(field.name, fieldMatches.length); }}
                              className={`rounded-t-lg bg-secondary border border-border px-3 py-2 transition-colors ${previewField === field.name && previewIndex === 0 && dragItemId ? "border-primary bg-primary/10" : ""} ${isMobile && mobileSelectedMatchId ? "cursor-pointer hover:bg-primary/10" : ""}`}
                            >
                              <div className="flex items-center justify-between">
                                <h4 className="font-display text-sm font-bold text-foreground">{field.name}</h4>
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setEditFieldDraft({ name: field.name, startTime: field.startTime ?? "", location: field.location ?? null }); setEditFieldIdx(fields.indexOf(field)); }}
                                    className="text-muted-foreground hover:text-foreground"
                                  >
                                    <Pencil className="h-3 w-3" />
                                  </button>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setDeleteFieldIdx(fields.indexOf(field)); }}
                                    className="text-muted-foreground hover:text-destructive"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                </div>
                              </div>
                              <p className="text-[10px] text-muted-foreground">
                                {locations.length > 1 && field.location ? `${field.location} · ${field.startTime}` : field.startTime}
                              </p>
                              {isMobile && mobileSelectedMatchId && (
                                <span className="text-[9px] text-primary font-medium">Tap om hier te plaatsen</span>
                              )}
                            </div>

                            {/* Field column body */}
                            <div
                              ref={(el) => { if (el) fieldColumnRefs.current.set(field.name, el); }}
                              className={`border border-t-0 min-h-[200px] transition-[background-color,border-color] duration-200 ${dragItemId ? "border-primary/30 bg-primary/[0.02]" : "border-border"}`}
                              onDragOver={(e) => handleFieldColumnDragOver(e, field.name)}
                              onDrop={(e) => {
                                const idx = previewField === field.name && previewIndex !== null ? previewIndex : fieldMatches.length;
                                void handleDrop(e, field.name, idx);
                              }}
                              onDragLeave={(e) => {
                                if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                                  if (previewField === field.name) { setPreviewField(null); setPreviewIndex(null); }
                                  if (dragOverField === field.name) { setDragOverField(null); setDragOverIndex(null); }
                                }
                              }}
                            >
                              {/* Compute visual insert index: map filtered previewIndex back to original fieldMatches space */}
                              {(() => {
                                const dragOrigIdx = dragItemId ? fieldMatches.findIndex(m => m.id === dragItemId) : -1;
                                const draggingInSameField = dragOrigIdx >= 0;
                                // Map previewIndex (filtered, excludes dragged) → visual index in original fieldMatches
                                const visualInsertIdx = (previewField === field.name && previewIndex !== null && dragItemId)
                                  ? (draggingInSameField
                                    ? (previewIndex >= dragOrigIdx ? previewIndex + 1 : previewIndex)
                                    : previewIndex)
                                  : null;
                                const lastStart = items.length ? items[items.length - 1].startMin : -1;
                                const rowTimes = timelineTimes.filter(t => t <= lastStart);
                                return rowTimes.map((rowTime) => {
                                const item = items.find(i => i.startMin === rowTime);

                                // Empty timeline block (field starts later / other field has a pause)
                                if (!item) {
                                  return (
                                    <div key={`empty-${rowTime}`} className="px-1.5 py-0.5">
                                      <div className={`${PLANNER_ROW_H} rounded-lg border border-dashed border-border/60 bg-muted/20 flex items-center justify-center`}>
                                        <span className="text-[10px] font-mono text-muted-foreground/50">{minutesToTime(rowTime)}</span>
                                      </div>
                                    </div>
                                  );
                                }

                                // Pause block — same size as a match block
                                if (item.kind === "break") {
                                  const brk = item.brk;
                                  return (
                                    <div key={`break-${brk.id}`} className="px-1.5 py-0.5">
                                      <PlannerItem
                                        payload={{ id: brk.id, type: "break", field_id: field.name, slot_index: brk.afterSlotIndex, container: "schema" }}
                                        className={`${PLANNER_ROW_H} rounded-lg bg-primary/10 border border-primary/30 px-3 flex flex-col items-start justify-center gap-1`}
                                      >
                                        <div className="flex items-center justify-between w-full">
                                          <span className="text-[11px] font-mono font-bold text-primary">{minutesToTime(item.startMin)}</span>
                                          <button onClick={(e) => { e.stopPropagation(); void removeBreak(brk.id); }} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-3 w-3" /></button>
                                        </div>
                                        <div className="flex items-center gap-1">
                                          <span className="text-xs text-primary font-medium">Pauze</span>
                                          <span className="text-[10px] border border-primary/30 text-primary rounded-full px-2 py-0.5">{brk.duration} minuten</span>
                                        </div>
                                      </PlannerItem>
                                    </div>
                                  );
                                }

                                const m = item.match;
                                const idx = item.idx;
                                const isDragging = dragItemId === m.id;
                                const time = slotTimes[idx] || m.match_time?.slice(0, 5) || "—";
                                const isPreviewHere = visualInsertIdx === idx && dragItemId && dragItemId !== m.id;
                                const isPreviewAfter = visualInsertIdx === idx + 1 && dragItemId && dragItemId !== m.id;
                                const phase = phases.find(p => p.id === m.phase_id);
                                const group = allGroups.find(g => g.id === m.group_id);


                                return (
                                  <div key={m.id}>
                                    <PlannerInsertionMarker active={!!isPreviewHere} />

                                    <div
                                      data-planner-match-card={m.id}
                                      className={`transition-[max-height,opacity,padding,margin,transform] duration-200 ease-out ${isDragging ? "max-h-0 opacity-0 overflow-hidden" : ""}`}
                                      style={isDragging ? { maxHeight: 0, padding: 0, margin: 0, height: 0 } : undefined}
                                    >
                                      <div className="px-1.5 py-0.5">
                                        <PlannerItem
                                          payload={{ id: m.id, type: "match", field_id: field.name, slot_index: idx, container: "schema" }}
                                          className={`${mobileSelectedMatchId === m.id ? "" : `${PLANNER_ROW_H} overflow-hidden`} rounded-lg border p-2 text-xs transition-all duration-200 ${
                                            mobileSelectedMatchId === m.id
                                              ? "border-primary ring-2 ring-primary/30 bg-primary/10"
                                              : isDragging
                                                ? "border-primary ring-2 ring-primary/20 bg-primary/5"
                                                : getMatchClashes(m).length > 0
                                                  ? "border-destructive ring-1 ring-destructive/30 bg-destructive/5 hover:border-destructive hover:shadow-md"
                                                  : "border-border bg-card hover:border-primary/50 hover:shadow-md"
                                          }`}
                                        >
                                          <div onClick={() => handleMobileTapMatch(m.id)} className="touch-manipulation">
                                            {/* Time row */}
                                            <div className="flex items-center justify-between mb-1">
                                              <div className="flex items-center gap-1">
                                                <span className="text-[11px] font-mono font-bold text-foreground">{time}</span>
                                                {getMatchClashes(m).length > 0 && (
                                                  <span className="text-destructive cursor-help" title={getMatchClashes(m).join("\n")}>⚠</span>
                                                )}
                                              </div>
                                              <button
                                                onClick={(e) => { e.stopPropagation(); setEditMatchId(m.id); setEditMatchReferee(m.referee || ""); }}
                                                className="text-muted-foreground hover:text-foreground print:hidden"
                                              >
                                                <Pencil className="h-2.5 w-2.5" />
                                              </button>
                                            </div>
                                            {/* Teams */}
                                            <div className="space-y-0.5">
                                              <div className="flex items-center gap-1">
                                                {getTeamLogo(m.home_team_id) && <img src={getTeamLogo(m.home_team_id)!} className="h-3.5 w-3.5 object-contain rounded-sm" draggable={false} />}
                                                <span className="font-medium text-[11px] truncate text-foreground">{getMatchLabel(m.home_team_id, m.home_slot_label)}</span>
                                                <span className="text-muted-foreground font-bold mx-0.5">-</span>
                                                {getTeamLogo(m.away_team_id) && <img src={getTeamLogo(m.away_team_id)!} className="h-3.5 w-3.5 object-contain rounded-sm" draggable={false} />}
                                                <span className="font-medium text-[11px] truncate text-foreground">{getMatchLabel(m.away_team_id, m.away_slot_label)}</span>
                                              </div>
                                            </div>
                                            {/* Phase/group badge */}
                                            {(phase || group) && (
                                              <div className="mt-1">
                                                <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-accent/20 text-accent-foreground">{getMatchInfoLabel(m)}</span>
                                              </div>
                                            )}
                                            {m.referee && <div className="text-[8px] text-muted-foreground mt-0.5 flex items-center gap-0.5 print:text-[9px]"><WhistleIcon className="h-2.5 w-2.5" /> {m.referee}</div>}
                                          </div>
                                          {/* Mobile actions */}
                                          {isMobile && mobileSelectedMatchId === m.id && (
                                            <div className="flex items-center gap-1 mt-1.5 pt-1.5 border-t border-border">
                                              <Button variant="outline" size="sm" className="h-6 text-[10px] flex-1" onClick={(e) => { e.stopPropagation(); handleMobileUnschedule(m.id); }}>
                                                <X className="h-3 w-3" /> Ontplannen
                                              </Button>
                                              {idx > 0 && (
                                                <Button variant="outline" size="icon" className="h-6 w-6" onClick={async (e) => { e.stopPropagation(); setMobileSelectedMatchId(null); await handleMobilePlaceMatch(field.name, idx - 1); }}>
                                                  <ArrowUp className="h-3 w-3" />
                                                </Button>
                                              )}
                                              {idx < fieldMatches.length - 1 && (
                                                <Button variant="outline" size="icon" className="h-6 w-6" onClick={async (e) => { e.stopPropagation(); setMobileSelectedMatchId(null); await handleMobilePlaceMatch(field.name, idx + 2); }}>
                                                  <ArrowDown className="h-3 w-3" />
                                                </Button>
                                              )}
                                            </div>
                                          )}
                                        </PlannerItem>
                                      </div>
                                    </div>




                                    <PlannerInsertionMarker active={!!(isPreviewAfter && idx === fieldMatches.length - 1)} />
                                  </div>
                                );
                              });
                              })()}

                              {/* Placeholder at end - also works for same-field drags */}
                              {previewField === field.name && previewIndex !== null && dragItemId && (() => {
                                const dragOrigIdx = dragItemId ? fieldMatches.findIndex(m => m.id === dragItemId) : -1;
                                const draggingInSameField = dragOrigIdx >= 0;
                                const visualInsertIdx = draggingInSameField
                                  ? (previewIndex >= dragOrigIdx ? previewIndex + 1 : previewIndex)
                                  : previewIndex;
                                return visualInsertIdx >= fieldMatches.length;
                              })() && (
                                <PlannerInsertionMarker active />
                              )}

                              {fieldMatches.length === 0 && (
                                <div
                                  data-planner-drop-zone="true"
                                  onDragOver={(e) => handleFieldColumnDragOver(e, field.name)}
                                  onDrop={(e) => handleDrop(e, field.name, 0)}
                                  onClick={() => { if (isMobile && mobileSelectedMatchId) handleMobilePlaceMatch(field.name, 0); }}
                                  className={`px-3 py-10 text-center transition-all duration-300 rounded-b-lg ${
                                    mobileSelectedMatchId
                                      ? "bg-primary/10 border-2 border-dashed border-primary m-1 rounded-lg cursor-pointer"
                                      : previewField === field.name && dragItemId
                                        ? "bg-primary/10"
                                        : ""
                                  }`}
                                >
                                  {previewField === field.name && dragItemId ? (
                                    <PlannerInsertionMarker active />
                                  ) : (
                                    <p className="text-[10px] text-muted-foreground/40">
                                      {mobileSelectedMatchId ? "⬇ Tap om hier te plaatsen" : dragItemId ? "⬇ Sleep item hier" : `Start: ${field.startTime}`}
                                    </p>
                                  )}
                                </div>
                              )}

                              {fieldMatches.length > 0 && (
                                <div className="px-3 py-1 text-center">
                                  <span className="text-[10px] text-muted-foreground/40">Volgende: {nextFreeTime}</span>
                                </div>
                              )}
                            </div>

                            {/* + PAUZE button at bottom of each column */}
                            <div className="border border-t-0 border-border rounded-b-lg">
                              <button
                                onClick={() => { setShowPauzeModal(field.name); setPauzeModalDuration(20); setPauzeModalName("Pauze"); }}
                                className="w-full py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors font-medium uppercase tracking-wider"
                              >
                                + Pauze
                              </button>
                            </div>
                          </div>
                        ))}
                        {/* + Veld toevoegen column */}
                        <div className="min-w-[140px] flex-shrink-0 flex items-start pt-1 pl-2 print:hidden">
                          <Button variant="outline" size="sm" onClick={() => { setNewFieldName(""); setNewFieldStartTime("09:00"); setShowAddFieldDialog(true); }} className="h-8 text-xs gap-1 whitespace-nowrap">
                            <Plus className="h-3 w-3" /> Veld toevoegen
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* Bottom drop zone */}
                    {dragItemId && dragItemType === "match" && (
                      <div
                        onDragOver={(e) => {
                          if (!hasPlannerDragData(e)) return;
                          e.preventDefault();
                          e.dataTransfer.dropEffect = "move";
                          setDragOverField("__bottom_unschedule__");
                        }}
                        onDragLeave={() => { if (dragOverField === "__bottom_unschedule__") setDragOverField(null); }}
                        onDrop={(e) => void handleDropToUnscheduled(e)}
                        className={`mt-3 rounded-xl border-2 border-dashed py-6 text-center transition-all duration-200 ${
                          dragOverField === "__bottom_unschedule__"
                            ? "border-destructive bg-destructive/10 text-destructive scale-[1.01]"
                            : "border-primary/40 bg-primary/5 text-primary/60"
                        }`}
                      >
                        <span className="text-sm font-medium">↓ Sleep hier om te ontplannen</span>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* ===== RIGHT SIDEBAR ===== */}
            {!plannerCollapsed && (
            <div className="w-72 shrink-0 border-l border-border ml-0 print:hidden">
              {/* Tab icons */}
              <div className="flex border-b border-border">
                <button
                  onClick={() => setRightSidebarTab("plannen")}
                  className={`flex-1 py-2.5 flex justify-center transition-colors ${rightSidebarTab === "plannen" ? "border-b-2 border-primary text-primary" : "text-muted-foreground hover:text-foreground"}`}
                  title="Plannen"
                >
                  <CalendarClockIcon className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setRightSidebarTab("scheidsrechters")}
                  className={`flex-1 py-2.5 flex justify-center transition-colors ${rightSidebarTab === "scheidsrechters" ? "border-b-2 border-primary text-primary" : "text-muted-foreground hover:text-foreground"}`}
                  title="Scheidsrechters"
                >
                  <WhistleIcon className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setRightSidebarTab("ongepland")}
                  className={`flex-1 py-2.5 flex justify-center transition-colors ${rightSidebarTab === "ongepland" ? "border-b-2 border-primary text-primary" : "text-muted-foreground hover:text-foreground"}`}
                  title="Niet gepland"
                >
                  <CalendarXIcon className="h-4 w-4" />
                </button>
              </div>

              <div className="p-3 overflow-y-auto max-h-[calc(100vh-200px)]">
                {/* ===== PLANNEN TAB ===== */}
                {rightSidebarTab === "plannen" && (
                  <div className="space-y-4">
                    <h3 className="font-display text-sm font-bold text-foreground">Plannen</h3>


                    {/* Scheduling filters — Tournify-style multi-select dropdowns */}
                    {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events */}
                    <div className="space-y-3 border-t border-border pt-3" ref={dropdownContainerRef}>
                      {/* Poules/Brackets dropdown */}
                      {(() => {
                        const options = getUnifiedGroupBracketOptions();
                        const allGroupIds = options.filter((o: any) => o.type === "group").map((o: any) => o.id);
                        const allBracketIds = options.filter((o: any) => o.type === "bracket").map((o: any) => o.id);
                        const allSelected = options.length > 0 && allGroupIds.every((id: string) => schedGroups.includes(id)) && allBracketIds.every((id: string) => schedFormats.includes(id));
                        const selectedCount = options.filter((item: any) => item.type === "group" ? schedGroups.includes(item.id) : schedFormats.includes(item.id)).length;
                        const toggleAll = () => {
                          if (allSelected) { setSchedGroups([]); setSchedFormats([]); setSchedRounds([]); }
                          else { setSchedGroups(allGroupIds); setSchedFormats(allBracketIds); }
                        };
                        const toggleItem = (item: any) => {
                          if (item.type === "group") toggleSchedGroup(item.id);
                          else toggleSchedFormat(item.id);
                        };
                        const isChecked = (item: any) => item.type === "group" ? schedGroups.includes(item.id) : schedFormats.includes(item.id);
                        const open = dropdownOpenBrackets;
                        const hasSelection = selectedCount > 0;
                        const displayLabel = hasSelection
                          ? (allSelected ? "Alle poules/brackets" : `${selectedCount} geselecteerd`)
                          : "Selecteer poules/brackets";
                        return (
                          <div className="space-y-1 relative">
                            {hasSelection && <Label className="text-[10px] text-muted-foreground">Selecteer poules/brackets</Label>}
                            <button
                              onClick={() => openDropdown("brackets")}
                              className="w-full flex items-center justify-between border border-border rounded-md px-2 py-1.5 text-xs bg-background hover:bg-secondary/50 transition-colors"
                            >
                              <span className="flex items-center gap-1 truncate">
                                {hasSelection ? (
                                  <span className="inline-flex items-center gap-1 bg-secondary text-secondary-foreground px-1.5 py-0.5 rounded text-[10px]">
                                    {displayLabel}
                                    <button onClick={(e) => { e.stopPropagation(); setSchedGroups([]); setSchedFormats([]); setSchedRounds([]); }} className="text-muted-foreground hover:text-destructive"><X className="h-2.5 w-2.5" /></button>
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground">{displayLabel}</span>
                                )}
                              </span>
                              <ChevronDown className={`h-3 w-3 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
                            </button>
                            {open && (
                              <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-lg max-h-48 overflow-y-auto">
                                {options.length === 0 ? (
                                  <div className="px-3 py-2 text-xs text-muted-foreground">Alles is ingepland</div>
                                ) : (
                                  <>
                                    <label className="flex items-center gap-2 px-3 py-2 text-xs cursor-pointer hover:bg-secondary/50 border-b border-border font-semibold">
                                      <Checkbox checked={allSelected} onCheckedChange={toggleAll} className="h-3.5 w-3.5" />
                                      Alle poules/brackets
                                    </label>
                                    {options.map((item: any) => (
                                      <label key={`${item.type}-${item.id}`} className="flex items-center gap-2 px-3 py-2 text-xs cursor-pointer hover:bg-secondary/50">
                                        <Checkbox checked={isChecked(item)} onCheckedChange={() => toggleItem(item)} className="h-3.5 w-3.5" />
                                        {item.label}
                                      </label>
                                    ))}
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      {/* Rondes dropdown */}
                      {(() => {
                        const rounds = getSchedRounds();
                        const allSelected = rounds.length > 0 && schedRounds.length === rounds.length;
                        const selectedCount = schedRounds.length;
                        const open = dropdownOpenRounds;
                        const noBracketsSelected = schedGroups.length === 0 && schedFormats.length === 0;
                        const hasSelection = selectedCount > 0;
                        const displayLabel = hasSelection && !noBracketsSelected
                          ? (allSelected ? "Alle rondes" : `${selectedCount} geselecteerd`)
                          : "Selecteer rondes";
                        return (
                          <div className="space-y-1 relative">
                            {hasSelection && !noBracketsSelected && <Label className="text-[10px] text-muted-foreground">Selecteer rondes</Label>}
                            <button
                              onClick={() => openDropdown("rounds")}
                              className="w-full flex items-center justify-between border border-border rounded-md px-2 py-1.5 text-xs bg-background hover:bg-secondary/50 transition-colors"
                            >
                              <span className="flex items-center gap-1 truncate">
                                {hasSelection && !noBracketsSelected ? (
                                  <span className="inline-flex items-center gap-1 bg-secondary text-secondary-foreground px-1.5 py-0.5 rounded text-[10px]">
                                    {displayLabel}
                                    <button onClick={(e) => { e.stopPropagation(); setSchedRoundsAndSync([]); }} className="text-muted-foreground hover:text-destructive"><X className="h-2.5 w-2.5" /></button>
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground">{displayLabel}</span>
                                )}
                              </span>
                              <ChevronDown className={`h-3 w-3 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
                            </button>
                            {open && (
                              <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-lg max-h-48 overflow-y-auto">
                                {unscheduledMatches.length === 0 ? (
                                  <div className="px-3 py-2 text-xs text-muted-foreground">Alles is ingepland</div>
                                ) : noBracketsSelected ? (
                                  <div className="px-3 py-2 text-xs text-muted-foreground">Kies eerst poules/brackets</div>
                                ) : rounds.length === 0 ? (
                                  <div className="px-3 py-2 text-xs text-muted-foreground">Kies eerst poules/brackets</div>
                                ) : (
                                  <>
                                    <label className="flex items-center gap-2 px-3 py-2 text-xs cursor-pointer hover:bg-secondary/50 border-b border-border font-semibold">
                                      <Checkbox checked={allSelected} onCheckedChange={() => setSchedRoundsAndSync(allSelected ? [] : rounds.map(r => r.key))} className="h-3.5 w-3.5" />
                                      Alle rondes
                                    </label>
                                    {rounds.map(r => (
                                      <label key={r.key} className="flex items-center gap-2 px-3 py-2 text-xs cursor-pointer hover:bg-secondary/50">
                                        <Checkbox checked={schedRounds.includes(r.key)} onCheckedChange={() => toggleSchedRound(r.key)} className="h-3.5 w-3.5" />
                                        {(() => {
                                          const phase = phases.find(p => p.id === r.phaseId);
                                          const phaseName = phase?.name || "";
                                          if (phase && (phase.phase_type === "knockout" || phase.phase_type === "single_match")) {
                                            const phaseMatches = matches.filter(m => m.phase_id === r.phaseId && m.round_number === r.round);
                                            if (phaseMatches.length > 0 && phaseMatches[0].match_name) {
                                              const roundLabel = phaseMatches[0].match_name.replace(/\s*\([^)]+\)\s*$/, "").replace(/\s*\d+$/, "");
                                              return `${roundLabel} (${phaseName})`;
                                            }
                                          }
                                          return `R${r.round} (${phaseName})`;
                                        })()}
                                      </label>
                                    ))}
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      {/* Velden dropdown */}
                      {(() => {
                        const hasFields = plannerFields.length > 0;
                        const allSelected = hasFields && schedFields.length === plannerFields.length;
                        const selectedCount = schedFields.length;
                        const open = dropdownOpenFields;
                        const hasSelection = selectedCount > 0;
                        const displayLabel = !hasFields
                          ? "Geen velden"
                          : hasSelection
                            ? (allSelected ? "Alle velden" : `${selectedCount} geselecteerd`)
                            : "Selecteer velden";
                        return (
                          <div className="space-y-1 relative">
                            {hasSelection && <Label className="text-[10px] text-muted-foreground">Selecteer velden</Label>}
                            <button
                              onClick={() => hasFields && openDropdown("fields")}
                              disabled={!hasFields}
                              className="w-full flex items-center justify-between border border-border rounded-md px-2 py-1.5 text-xs bg-background hover:bg-secondary/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <span className="flex items-center gap-1 truncate">
                                {hasSelection ? (
                                  <span className="inline-flex items-center gap-1 bg-secondary text-secondary-foreground px-1.5 py-0.5 rounded text-[10px]">
                                    {displayLabel}
                                    <button onClick={(e) => { e.stopPropagation(); setSchedFields([]); }} className="text-muted-foreground hover:text-destructive"><X className="h-2.5 w-2.5" /></button>
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground">{displayLabel}</span>
                                )}
                              </span>
                              <ChevronDown className={`h-3 w-3 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
                            </button>
                            {open && hasFields && (
                              <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-lg max-h-48 overflow-y-auto">
                                <label className="flex items-center gap-2 px-3 py-2 text-xs cursor-pointer hover:bg-secondary/50 border-b border-border font-semibold">
                                  <Checkbox checked={allSelected} onCheckedChange={() => setSchedFields(allSelected ? [] : plannerFields.map(f => f.name))} className="h-3.5 w-3.5" />
                                  Alle velden
                                </label>
                                {plannerFields.map(f => (
                                  <label key={f.name} className="flex items-center gap-2 px-3 py-2 text-xs cursor-pointer hover:bg-secondary/50">
                                    <Checkbox checked={schedFields.includes(f.name)} onCheckedChange={() => toggleSchedField(f.name)} className="h-3.5 w-3.5" />
                                    {f.name}
                                  </label>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })()}

                    </div>

                    {/* Action buttons */}
                    <div className="space-y-1.5 border-t border-border pt-3">
                      {(() => {
                        const hasAnyFilter = schedFormats.length > 0 || schedGroups.length > 0 || schedRounds.length > 0;
                        let count = 0;
                        if (hasAnyFilter) {
                          let filtered = unscheduledMatches;
                          if (schedFormats.length > 0 || schedGroups.length > 0) {
                            filtered = filtered.filter(m => {
                              if (m.group_id && schedGroups.includes(m.group_id)) return true;
                              const phase = phases.find(p => p.id === m.phase_id);
                              if (phase && (phase.phase_type === "group" || phase.phase_type === "round_robin")) return false;
                              return matchInSelectedBrackets(m);
                            });
                          }
                          if (schedRounds.length > 0) {
                            const roundTuples = schedRounds.map(k => { const parts = k.split(":"); return { phaseId: parts[0], round: parseInt(parts[1]) }; });
                            filtered = filtered.filter(m => m.round_number && roundTuples.some(rp => rp.phaseId === m.phase_id && rp.round === m.round_number));
                          }
                          count = filtered.length;
                        }
                        const isDisabled = count === 0;
                        return (
                          <Button size="sm" onClick={autoSchedule} disabled={isDisabled} className={`w-full gap-1 text-xs ${isDisabled ? "opacity-50 cursor-not-allowed" : ""}`}>
                            {`${count}/${unscheduledMatches.length} Plannen`}
                          </Button>
                        );
                      })()}
                      <Button size="sm" variant="outline" onClick={() => setShowClearConfirm(true)} className="w-full gap-1 text-xs text-destructive hover:text-destructive">
                        <RotateCcw className="h-3 w-3" /> Schema leegmaken
                      </Button>
                    </div>

                  </div>
                )}

                {/* ===== SCHEIDSRECHTERS TAB ===== */}
                {rightSidebarTab === "scheidsrechters" && (
                  <div className="space-y-4">
                    <h3 className="font-display text-sm font-bold text-foreground">Scheidsrechters</h3>

                    {/* Dropdown: aantal scheidsrechters per wedstrijd */}
                    <Select value={String(refereesPerMatch)} onValueChange={(v) => setRefereesPerMatch(Number(v))}>
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {["Eén", "Twee", "Drie", "Vier", "Vijf"].map((label, i) => (
                          <SelectItem key={i + 1} value={String(i + 1)}>{label} scheidsrechter{i > 0 ? "s" : ""} per wedstrijd</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {/* + Scheidsrechter toevoegen */}
                    <Button variant="outline" size="sm" onClick={() => { setNewRef(""); setShowRefAdd(true); }} className="w-full gap-1 text-xs">
                      <Plus className="h-3 w-3" /> Scheidsrechter toevoegen
                    </Button>

                    {/* Lijst van scheidsrechters */}
                    {referees.length === 0 ? (
                      <div className="text-center py-6">
                        <WhistleIcon className="h-10 w-10 mx-auto text-muted-foreground/30 mb-2" />
                        <p className="text-xs text-muted-foreground">Nog geen scheidsrechters. Voeg je eerste scheidsrechter toe.</p>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        {refereeConfigs.map((rc, i) => {
                          const r = rc.name;
                          const count = matches.filter(m => (m.referee || "").split(",").map(s => s.trim()).includes(r)).length;
                          return (
                            <div key={i} className="rounded-md border border-border px-2.5 py-1.5 text-xs">
                              <div className="flex items-center gap-2">
                                <span className="inline-flex items-center justify-center h-5 min-w-[20px] rounded-full bg-muted text-[10px] font-semibold text-muted-foreground">{count}</span>
                                <span className="flex-1 font-medium text-foreground truncate">{r}</span>
                                <button onClick={() => { setEditRefIdx(i); setEditRefName(r); }} className="text-muted-foreground hover:text-foreground">
                                  <Pencil className="h-3 w-3" />
                                </button>
                                <button onClick={() => setDeleteRefIdx(i)} className="text-muted-foreground hover:text-destructive">
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </div>
                              <p className="mt-1 text-[9px] leading-snug text-muted-foreground">
                                {summarizeReferee(rc, { totalFields: fields.length, teamName: (id) => teams.find(t => t.id === id)?.name || "?" }).join(" · ")}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Scheidsrechters toewijzen */}
                    <div className="pt-2 border-t border-border space-y-2">
                      <h4 className="text-xs font-semibold text-foreground">Scheidsrechters toewijzen</h4>
                      <Button variant="outline" size="sm" onClick={autoAssignReferees} className="w-full gap-1 text-xs">
                        <UserCheck className="h-3 w-3" /> Indelen op {plannerDate ? formatIsoDateForLocale(plannerDate) : "schema"}
                      </Button>
                    </div>
                  </div>
                )}

                {/* ===== ONGEPLAND TAB ===== */}
                {rightSidebarTab === "ongepland" && (
                  <div className="space-y-3" ref={unscheduledZoneRef}>
                    <h3 className="font-display text-sm font-bold text-foreground">Niet gepland ({getUnscheduledMatches().length}/{matches.length})</h3>

                    {/* Sidebar filters */}
                    <div className="flex gap-1 flex-wrap mb-1">
                      {phases.length > 1 && (
                        <select value={sidebarFormat} onChange={(e) => { setSidebarFormat(e.target.value); setSidebarGroup("all"); setSidebarRound("all"); }} className="h-6 rounded border border-input bg-background px-1 text-[10px]">
                          <option value="all">Alle formats</option>
                          {phases.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                      )}
                      {getSidebarGroups().length > 0 && (
                        <select value={sidebarGroup} onChange={(e) => { setSidebarGroup(e.target.value); setSidebarRound("all"); }} className="h-6 rounded border border-input bg-background px-1 text-[10px]">
                          <option value="all">Alle groepen</option>
                          {getSidebarGroups().map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                        </select>
                      )}
                      {getSidebarRounds().length > 0 && (
                        <select value={sidebarRound} onChange={(e) => setSidebarRound(e.target.value)} className="h-6 rounded border border-input bg-background px-1 text-[10px]">
                          <option value="all">Alle rondes</option>
                          {getSidebarRounds().map(r => {
                            const phase = phases.find(p => p.id === r.phaseId);
                            const isKnockout = phase && (phase.phase_type === "knockout" || phase.phase_type === "single_match");
                            let label = `R${r.round}`;
                            if (isKnockout) {
                              const phaseMatches = matches.filter(m => m.phase_id === r.phaseId && m.round_number === r.round);
                              if (phaseMatches.length > 0 && phaseMatches[0].match_name) {
                                label = phaseMatches[0].match_name.replace(/\s*\([^)]+\)\s*$/, "").replace(/\s*\d+$/, "");
                              }
                              label = `${label} (${phase.name})`;
                            } else if (phases.length > 1 && phase) {
                              label = `${label} (${phase.name})`;
                            }
                            return <option key={r.key} value={r.key}>{label}</option>;
                          })}
                        </select>
                      )}
                    </div>

                    {/* Drop zone when dragging */}
                    {dragItemId && (
                      <div
                        className={`rounded-lg border-2 border-dashed py-3 text-center text-xs transition-all duration-200 ${dragOverField === "__unscheduled__" ? "border-primary bg-primary/10 text-primary" : "border-primary/30 bg-primary/5 text-primary/60"}`}
                        onDragOver={(e) => {
                          if (!hasPlannerDragData(e)) return;
                          e.preventDefault();
                          setDragOverField("__unscheduled__");
                          setDragOverIndex(getUnscheduledMatches().length);
                        }}
                        onDragLeave={() => { if (dragOverField === "__unscheduled__") setDragOverField(null); }}
                        onDrop={(e) => void handleDropToUnscheduled(e, getUnscheduledMatches().length)}
                      >
                        ↩ Sleep hier om te ontplannen
                      </div>
                    )}

                    {/* Unscheduled match list */}
                    <div className="space-y-1 max-h-[500px] overflow-y-auto pr-1">
                      {getUnscheduledMatches().map((m, idx) => (
                        <div key={m.id} className="space-y-1">
                          <div
                            data-planner-drop-zone="true"
                            onDragOver={(e) => {
                              if (!hasPlannerDragData(e)) return;
                              e.preventDefault();
                              setDragOverField("__unscheduled__");
                              setDragOverIndex(idx);
                            }}
                            onDrop={(e) => void handleDropToUnscheduled(e, idx)}
                            className={`transition-all duration-200 overflow-hidden ${
                              dragItemId
                                ? dragOverField === "__unscheduled__" && dragOverIndex === idx
                                  ? "h-7 rounded-md border border-dashed border-primary bg-primary/10"
                                  : "h-2"
                                : "h-0"
                            }`}
                          />
                          <PlannerItem
                            payload={{ id: m.id, type: "match", field_id: null, slot_index: null, container: "unscheduled" }}
                            className={`rounded-lg border bg-card p-2 text-xs hover:border-primary/60 hover:shadow-sm transition-all duration-150 ${
                              mobileSelectedMatchId === m.id
                                ? "border-primary ring-2 ring-primary/30 bg-primary/10"
                                : dragItemId === m.id ? "opacity-30 scale-95 border-primary ring-2 ring-primary/20" : "border-border"
                            }`}
                          >
                            <div onClick={() => handleMobileTapMatch(m.id)} className="touch-manipulation">
                              <div className="flex items-center gap-1 mb-0.5">
                                <GripVertical className="h-3 w-3 text-muted-foreground shrink-0" />
                                <span className="text-[10px] text-muted-foreground truncate">{getMatchInfoLabel(m)}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                {getTeamLogo(m.home_team_id) && <img src={getTeamLogo(m.home_team_id)!} className="h-3.5 w-3.5 object-contain" draggable={false} />}
                                <span className="font-medium truncate">{getMatchLabel(m.home_team_id, m.home_slot_label)}</span>
                                <span className="text-muted-foreground mx-0.5">–</span>
                                {getTeamLogo(m.away_team_id) && <img src={getTeamLogo(m.away_team_id)!} className="h-3.5 w-3.5 object-contain" draggable={false} />}
                                <span className="font-medium truncate">{getMatchLabel(m.away_team_id, m.away_slot_label)}</span>
                              </div>
                            </div>
                          </PlannerItem>
                        </div>
                        ))}



                      <div
                        data-planner-drop-zone="true"
                        onDragOver={(e) => {
                          if (!hasPlannerDragData(e)) return;
                          e.preventDefault();
                          setDragOverField("__unscheduled__");
                          setDragOverIndex(getUnscheduledMatches().length);
                        }}
                        onDrop={(e) => void handleDropToUnscheduled(e, getUnscheduledMatches().length)}
                        className={`transition-all duration-200 overflow-hidden ${
                          dragItemId
                            ? dragOverField === "__unscheduled__" && dragOverIndex === getUnscheduledMatches().length
                              ? "h-8 rounded-md border border-dashed border-primary bg-primary/10"
                              : "h-2"
                            : "h-0"
                        }`}
                      />

                      {getUnscheduledMatches().length === 0 && (
                        <div className="text-center py-8">
                          <Check className="h-10 w-10 mx-auto text-muted-foreground/30 mb-2" />
                          <p className="text-xs text-muted-foreground">Alle wedstrijden zijn ingepland. Sleep een wedstrijd hierheen om het uit het schema te halen.</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
            )}
          </div>

          {/* dnd-kit DragOverlay */}
          <DragOverlay dropAnimation={{ duration: 200, easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)' }}>
            {activeDragPayload && (() => {
              if (activeDragPayload.type === "match") {
                const m = matches.find(x => x.id === activeDragPayload.id);
                if (!m) return null;
                return (
                  <div className="rounded-lg border-2 border-primary bg-card p-2 text-xs shadow-2xl w-[200px] rotate-1">
                    <div className="text-[10px] text-muted-foreground mb-0.5">{getMatchInfoLabel(m)}</div>
                    <div className="flex items-center gap-1">
                      {getTeamLogo(m.home_team_id) && <img src={getTeamLogo(m.home_team_id)!} className="h-3.5 w-3.5 object-contain" />}
                      <span className="font-medium text-[11px]">{getMatchLabel(m.home_team_id, m.home_slot_label)}</span>
                      <span className="text-muted-foreground mx-0.5">-</span>
                      {getTeamLogo(m.away_team_id) && <img src={getTeamLogo(m.away_team_id)!} className="h-3.5 w-3.5 object-contain" />}
                      <span className="font-medium text-[11px]">{getMatchLabel(m.away_team_id, m.away_slot_label)}</span>
                    </div>
                  </div>
                );
              }
              if (activeDragPayload.type === "break") {
                return (
                  <div className="rounded-lg bg-primary/20 border-2 border-primary/40 px-3 py-1.5 text-xs shadow-2xl w-[200px] rotate-1 font-medium text-primary">
                    Pauze
                  </div>
                );
              }
              return null;
            })()}
          </DragOverlay>
          </DndContext>
        </div>
      </div>

      {/* Match edit dialog — referee only */}
      <Dialog open={!!editMatchId} onOpenChange={(open) => { if (!open) setEditMatchId(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm">Scheidsrechter toewijzen</DialogTitle>
          </DialogHeader>
          {editMatchId && (() => {
            const m = matches.find(x => x.id === editMatchId);
            if (!m) return null;
            return (
              <div className="space-y-3">
                <div className="text-xs text-muted-foreground">
                  {getMatchLabel(m.home_team_id, m.home_slot_label)} vs {getMatchLabel(m.away_team_id, m.away_slot_label)}
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Scheidsrechter</Label>
                  <Select value={editMatchReferee || "__none__"} onValueChange={(v) => setEditMatchReferee(v === "__none__" ? "" : v)}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Kies scheidsrechter" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— Geen —</SelectItem>
                      {referees.map(r => (
                        <SelectItem key={r} value={r}>{r}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button size="sm" onClick={saveMatchEdit} className="w-full">Opslaan</Button>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Scheidsrechter toevoegen dialog */}
      <Dialog open={showRefAdd} onOpenChange={(open) => { if (!open) { setShowRefAdd(false); setNewRef(""); } }}>
        <DialogContent ref={addRefDialogRef} className="max-w-xs">
          <DialogHeader>
            <DialogTitle className="text-sm">Scheidsrechter toevoegen</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input value={newRef} onChange={(e) => setNewRef(e.target.value)} placeholder="Naam" className="h-9 text-sm" onKeyDown={(e) => e.key === "Enter" && addReferee()} />
            <Button size="sm" onClick={addReferee} disabled={!newRef.trim()} className="w-full">Toevoegen</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Scheidsrechter bewerken dialog */}
      <Dialog open={editRefIdx !== null} onOpenChange={(open) => { if (!open) { setEditRefIdx(null); setEditRefName(""); } }}>
        <DialogContent ref={editRefDialogRef} className="max-w-xs">
          <DialogHeader>
            <DialogTitle className="text-sm">Scheidsrechter bewerken</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input value={editRefName} onChange={(e) => setEditRefName(e.target.value)} placeholder="Naam" className="h-9 text-sm" onKeyDown={(e) => e.key === "Enter" && editReferee()} />
            <Button size="sm" onClick={editReferee} disabled={!editRefName.trim()} className="w-full">Opslaan</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Scheidsrechter verwijderen bevestiging */}
      <AlertDialog open={deleteRefIdx !== null} onOpenChange={(open) => { if (!open) setDeleteRefIdx(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Scheidsrechter verwijderen</AlertDialogTitle>
            <AlertDialogDescription>
              Weet je zeker dat je {deleteRefIdx !== null ? `"${referees[deleteRefIdx]}"` : ""} wilt verwijderen?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRemoveReferee} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Verwijderen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {hasAnyStats && (() => {
        const sm = selectedStatsMatchId ? matches.find(m => m.id === selectedStatsMatchId) : null;
        const smPhase = sm ? phases.find(p => p.id === sm.phase_id) : null;
        const smGroup = sm ? allGroups.find(g => g.id === sm.group_id) : null;
        return (
          <MatchDetailDialog
            open={!!sm}
            onClose={() => setSelectedStatsMatchId(null)}
            match={sm ? {
              id: sm.id,
              match_name: sm.match_name,
              home_team_id: sm.home_team_id,
              away_team_id: sm.away_team_id,
              home_score: sm.home_score,
              away_score: sm.away_score,
              home_penalties: sm.home_penalties,
              away_penalties: sm.away_penalties,
              match_date: sm.match_date,
              match_time: sm.match_time,
              field: sm.field,
              referee: sm.referee,
              is_played: sm.is_played,
              format_name: smPhase?.name || null,
              group_name: smGroup?.name || null,
              round_number: sm.round_number,
            } : null}
            tournament={tournament}
            teams={teams}
            scoreEditable={true}
          />
        );
      })()}

      <AlertDialog open={showClearConfirm} onOpenChange={setShowClearConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Schema leegmaken?</AlertDialogTitle>
            <AlertDialogDescription>
              Alle geplande wedstrijden ({matches.filter(m => m.match_date || m.match_time || m.field).length}) worden gewist uit de planning. Scores en resultaten blijven behouden. Dit kan niet ongedaan worden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setShowClearConfirm(false); clearAllSchedule(); }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Leegmaken
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Pauze toevoegen modal */}
      <Dialog open={!!showPauzeModal} onOpenChange={(open) => { if (!open) setShowPauzeModal(null); }}>
        <DialogContent ref={pauzeDialogRef} className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Pauze toevoegen</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label className="text-sm">Naam</Label>
              <Input value={pauzeModalName} onChange={(e) => setPauzeModalName(e.target.value)} className="h-9" />
            </div>
            <div className="space-y-1">
              <Label className="text-sm">Duur</Label>
              <div className="flex items-center gap-2">
                <Input type="number" value={pauzeModalDuration || ""} onChange={(e) => setPauzeModalDuration(e.target.value === "" ? 0 : parseInt(e.target.value) || 0)} className="h-9 w-24" />
                <span className="text-sm text-muted-foreground">minuten</span>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowPauzeModal(null)}>Annuleren</Button>
              <Button onClick={() => { if (showPauzeModal) addBreakToField(showPauzeModal); }}>Toevoegen</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add field dialog */}
      <Dialog open={showAddFieldDialog} onOpenChange={setShowAddFieldDialog}>
        <DialogContent ref={addFieldDialogRef} className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Veld toevoegen</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label className="text-sm">Naam</Label>
              <Input value={newFieldName} onChange={(e) => setNewFieldName(e.target.value)} placeholder={`Veld ${fields.length + 1}`} className="h-9" />
            </div>
            {locations.length > 1 && (
              <div className="space-y-1">
                <Label className="text-sm">Locatie</Label>
                <Select value={newFieldLocation ?? defaultFieldLocation() ?? "__none"} onValueChange={(v) => setNewFieldLocation(v === "__none" ? null : v)}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Kies locatie" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">Geen locatie</SelectItem>
                    {locations.map(l => <SelectItem key={l.id} value={l.name}>{l.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1">
              <Label className="text-sm">Starttijd</Label>
              <TimePicker value={newFieldStartTime} onChange={(v) => setNewFieldStartTime(v)} className="h-9" />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowAddFieldDialog(false)}>Annuleren</Button>
              <Button onClick={addFieldFromDialog}>Toevoegen</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit field dialog */}
      <Dialog open={editFieldIdx !== null} onOpenChange={(open) => { if (!open) setEditFieldIdx(null); }}>
        <DialogContent ref={editFieldDialogRef} className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Veld bewerken</DialogTitle>
          </DialogHeader>
          {editFieldIdx !== null && fields[editFieldIdx] && (
            <div className="space-y-4">
              <div className="space-y-1">
                <Label className="text-sm">Naam</Label>
                <Input value={editFieldDraft.name} onChange={(e) => setEditFieldDraft(d => ({ ...d, name: e.target.value }))} className="h-9" />
              </div>
              {locations.length > 1 && (
                <div className="space-y-1">
                  <Label className="text-sm">Locatie</Label>
                  <Select value={editFieldDraft.location ?? "__none"} onValueChange={(v) => setEditFieldDraft(d => ({ ...d, location: v === "__none" ? null : v }))}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="Kies locatie" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none">Geen locatie</SelectItem>
                      {locations.map(l => <SelectItem key={l.id} value={l.name}>{l.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-1">
                <Label className="text-sm">Starttijd</Label>
                <TimePicker value={editFieldDraft.startTime} onChange={(v) => setEditFieldDraft(d => ({ ...d, startTime: v }))} className="h-9" />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={() => { setClearFieldIdx(editFieldIdx); }} className="text-xs gap-1">
                  <RotateCcw className="h-3 w-3" /> Veld leegmaken
                </Button>
                <Button
                  onClick={async () => {
                    const idx = editFieldIdx;
                    setEditFieldIdx(null);
                    await saveFields(fields.map((f, i) => i === idx ? { ...f, name: editFieldDraft.name, startTime: editFieldDraft.startTime, location: editFieldDraft.location } : f));
                  }}
                  className="text-xs"
                >
                  Opslaan
                </Button>
              </div>
            </div>
          )}

        </DialogContent>
      </Dialog>

      {/* Delete field confirmation */}
      <AlertDialog open={deleteFieldIdx !== null} onOpenChange={(open) => { if (!open) setDeleteFieldIdx(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Veld verwijderen?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteFieldIdx !== null && fields[deleteFieldIdx] ? `"${fields[deleteFieldIdx].name}" wordt verwijderd. Wedstrijden op dit veld worden ontpland.` : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction onClick={async () => { if (deleteFieldIdx !== null) { await clearFieldMatches(deleteFieldIdx); await removeField(deleteFieldIdx); setDeleteFieldIdx(null); } }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Verwijderen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Clear field confirmation */}
      <AlertDialog open={clearFieldIdx !== null} onOpenChange={(open) => { if (!open) setClearFieldIdx(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Veld leegmaken?</AlertDialogTitle>
            <AlertDialogDescription>
              {clearFieldIdx !== null && fields[clearFieldIdx] ? `Alle wedstrijden op "${fields[clearFieldIdx].name}" worden uit de planning verwijderd. Scores blijven behouden.` : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction onClick={async () => { if (clearFieldIdx !== null) { await clearFieldMatches(clearFieldIdx); setClearFieldIdx(null); setEditFieldIdx(null); } }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Leegmaken
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <div className="h-16" />
    </div>
  );
};

export default MatchScheduler;
