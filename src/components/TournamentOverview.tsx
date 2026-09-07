import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchTournamentMatches } from "@/lib/fetchTournamentMatches";
import { expandMatchDays, formatIsoDateForLocale, getTodayIsoDate, type MatchDayEntry } from "@/lib/dateUtils";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  Check,
  Copy,
  ExternalLink,
  Globe,
  Handshake,
  Lock,
  MapPin,
  Users,
} from "lucide-react";
import BracketTreeIcon from "@/components/icons/BracketTreeIcon";
import ScoreboardIcon from "@/components/icons/ScoreboardIcon";
import CalendarClockIcon from "@/components/icons/CalendarClockIcon";
import PollIcon from "@/components/icons/PollIcon";

interface TournamentOverviewProps {
  tournamentId: string;
  tournament: any;
  onNavigate: (tab: string) => void;
}

type Counts = {
  teams: number;
  referees: number;
  phases: number;
  formats: number;
  matches: number;
  played: number;
  sponsors: number;
  polls: number;
};

type UpcomingMatch = {
  id: string;
  match_date: string | null;
  match_time: string | null;
  field: string | null;
  home: string;
  away: string;
};

const Card = ({
  className,
  onClick,
  children,
}: {
  className?: string;
  onClick?: () => void;
  children: React.ReactNode;
}) => {
  const Comp: any = onClick ? "button" : "div";
  return (
    <Comp
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "group relative flex flex-col rounded-2xl border border-border bg-card p-5 text-left transition-all",
        onClick && "hover:-translate-y-0.5 hover:border-primary/60 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        className
      )}
    >
      {children}
    </Comp>
  );
};

const CardHead = ({
  icon,
  label,
  action,
}: {
  icon: React.ReactNode;
  label: string;
  action?: boolean;
}) => (
  <div className="mb-3 flex items-center gap-2">
    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">{icon}</span>
    <span className="flex-1 truncate font-display text-sm font-bold uppercase tracking-wide text-muted-foreground">
      {label}
    </span>
    {action && (
      <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-primary" />
    )}
  </div>
);

const TournamentOverview = ({ tournamentId, tournament, onNavigate }: TournamentOverviewProps) => {
  const { toast } = useToast();
  const [counts, setCounts] = useState<Counts>({
    teams: 0,
    referees: 0,
    phases: 0,
    formats: 0,
    matches: 0,
    played: 0,
    sponsors: 0,
    polls: 0,
  });
  const [upcoming, setUpcoming] = useState<UpcomingMatch[]>([]);
  const [locations, setLocations] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      const [teamsRes, refsRes, phasesRes, formatsRes, sponsorsRes, pollsRes, fieldsRes] = await Promise.all([
        supabase.from("teams").select("id, name").eq("tournament_id", tournamentId),
        supabase.from("referees").select("id").eq("tournament_id", tournamentId),
        supabase.from("tournament_phases").select("id").eq("tournament_id", tournamentId),
        supabase.from("phase_formats").select("id").eq("tournament_id", tournamentId),
        supabase.from("sponsors").select("id").eq("tournament_id", tournamentId),
        supabase.from("polls").select("id").eq("tournament_id", tournamentId),
        supabase.from("fields").select("location").eq("tournament_id", tournamentId),
      ]);

      let matches: any[] = [];
      try {
        matches = await fetchTournamentMatches({
          tournamentId,
          columns: "id, match_date, match_time, field, is_played, home_team_id, away_team_id, home_slot_label, away_slot_label",
          orders: [{ column: "match_date" }, { column: "match_time" }],
        });
      } catch {
        matches = [];
      }

      if (cancelled) return;

      const teamNames = new Map<string, string>((teamsRes.data ?? []).map((t: any) => [t.id, t.name]));
      const today = getTodayIsoDate();
      const next = matches
        .filter((m) => !m.is_played)
        .sort((a, b) => {
          const da = a.match_date ?? "9999-12-31";
          const db = b.match_date ?? "9999-12-31";
          if (da !== db) return da < db ? -1 : 1;
          return (a.match_time ?? "99:99") < (b.match_time ?? "99:99") ? -1 : 1;
        })
        .filter((m) => !m.match_date || m.match_date >= today)
        .slice(0, 5)
        .map((m) => ({
          id: m.id,
          match_date: m.match_date,
          match_time: m.match_time,
          field: m.field,
          home: teamNames.get(m.home_team_id) ?? m.home_slot_label ?? "—",
          away: teamNames.get(m.away_team_id) ?? m.away_slot_label ?? "—",
        }));

      setCounts({
        teams: teamsRes.data?.length ?? 0,
        referees: refsRes.data?.length ?? 0,
        phases: phasesRes.data?.length ?? 0,
        formats: formatsRes.data?.length ?? 0,
        matches: matches.length,
        played: matches.filter((m) => m.is_played).length,
        sponsors: sponsorsRes.data?.length ?? 0,
        polls: pollsRes.data?.length ?? 0,
      });
      setUpcoming(next);
      setLocations(
        Array.from(
          new Set(((fieldsRes.data ?? []) as any[]).map((f) => f.location).filter(Boolean))
        ) as string[]
      );
      setLoading(false);
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [tournamentId]);

  const matchDays = (() => {
    const raw = tournament?.match_days;
    const entries: MatchDayEntry[] = Array.isArray(raw)
      ? raw
      : typeof raw === "string"
        ? (() => {
            try {
              const p = JSON.parse(raw);
              return Array.isArray(p) ? p : [];
            } catch {
              return [];
            }
          })()
        : [];
    return expandMatchDays(entries);
  })();

  const periodLabel = (() => {
    if (matchDays.length === 0) return "Nog geen speeldagen";
    const first = matchDays[0];
    const last = matchDays[matchDays.length - 1];
    if (first === last) return formatIsoDateForLocale(first);
    return `${formatIsoDateForLocale(first)} – ${formatIsoDateForLocale(last)}`;
  })();

  const progress = counts.matches > 0 ? Math.round((counts.played / counts.matches) * 100) : 0;
  const viewUrl = tournament?.view_link_token
    ? `${window.location.origin}/view/${tournament.view_link_token}`
    : null;

  const copyLink = async () => {
    if (!viewUrl) return;
    await navigator.clipboard.writeText(viewUrl);
    setCopied(true);
    toast({ title: "Link gekopieerd" });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Identity band */}
      <section className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-primary/10 via-card to-card p-6">
        <div className="flex items-center gap-4">
          {tournament?.logo_url ? (
            <img src={tournament.logo_url} alt="" className="h-14 w-14 shrink-0 object-contain" />
          ) : null}
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-display text-3xl font-bold tracking-tight text-foreground">
              {tournament?.name}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays className="h-4 w-4" />
                {periodLabel}
              </span>
              {locations.length > 0 && (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="h-4 w-4" />
                  {locations.length === 1 ? locations[0] : `${locations.length} locaties`}
                </span>
              )}
              <span className="inline-flex items-center gap-1.5">
                {tournament?.is_public ? <Globe className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                {tournament?.is_public ? "Publiek zichtbaar" : "Privé"}
              </span>
            </div>
          </div>
          {viewUrl && (
            <div className="flex shrink-0 gap-2">
              <Button variant="outline" onClick={copyLink}>
                {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
                Link kopiëren
              </Button>
              <Button asChild>
                <a href={viewUrl} target="_blank" rel="noreferrer">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Publieke site
                </a>
              </Button>
            </div>
          )}
        </div>
      </section>

      {/* Bento grid */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        {/* Upcoming matches — large */}
        <Card className="lg:col-span-2 lg:row-span-2" onClick={() => onNavigate("schedule")}>
          <CardHead icon={<CalendarClockIcon className="h-4 w-4" />} label="Volgende wedstrijden" action />
          {loading ? (
            <p className="text-sm text-muted-foreground">Laden…</p>
          ) : upcoming.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nog geen wedstrijden ingepland. Maak eerst je format en zet daarna het schema op.
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-border/70">
              {upcoming.map((m) => (
                <li key={m.id} className="flex items-center gap-3 py-2.5">
                  <div className="w-24 shrink-0 text-xs font-semibold text-muted-foreground">
                    {m.match_date ? formatIsoDateForLocale(m.match_date, "nl-BE", { day: "2-digit", month: "2-digit" }) : "—"}
                    {m.match_time ? ` ${m.match_time.slice(0, 5)}` : ""}
                  </div>
                  <div className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
                    {m.home} <span className="text-muted-foreground">–</span> {m.away}
                  </div>
                  {m.field && (
                    <span className="shrink-0 rounded-md bg-secondary px-2 py-0.5 text-[11px] font-semibold text-secondary-foreground">
                      {m.field}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Deelnemers */}
        <Card onClick={() => onNavigate("teams")}>
          <CardHead icon={<Users className="h-4 w-4" />} label={tournament?.teams_label || "Deelnemers"} action />
          <p className="font-display text-4xl font-bold text-foreground">{counts.teams}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {counts.referees} {tournament?.referees_label?.toLowerCase() || "scheidsrechters"}
          </p>
        </Card>

        {/* Format */}
        <Card onClick={() => onNavigate("phases")}>
          <CardHead icon={<BracketTreeIcon className="h-4 w-4" />} label="Format" action />
          <p className="font-display text-4xl font-bold text-foreground">{counts.phases}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {counts.phases === 1 ? "fase" : "fases"} · {counts.formats} {counts.formats === 1 ? "onderdeel" : "onderdelen"}
          </p>
        </Card>

        {/* Voortgang */}
        <Card className="lg:col-span-2" onClick={() => onNavigate("results")}>
          <CardHead icon={<ScoreboardIcon className="h-4 w-4" />} label="Uitslagen" action />
          <div className="flex items-end justify-between gap-4">
            <p className="font-display text-4xl font-bold text-foreground">
              {counts.played}
              <span className="text-xl text-muted-foreground">/{counts.matches}</span>
            </p>
            <p className="text-sm font-semibold text-muted-foreground">{progress}% gespeeld</p>
          </div>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-secondary">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
          </div>
        </Card>

        {/* Statistieken */}
        <Card onClick={() => onNavigate("statistics")}>
          <CardHead icon={<BarChart3 className="h-4 w-4" />} label="Statistieken" action />
          <p className="text-sm text-muted-foreground">Topschutters, assists en fairplay van dit toernooi.</p>
        </Card>

        {/* Sponsors */}
        <Card onClick={() => onNavigate("sponsors")}>
          <CardHead icon={<Handshake className="h-4 w-4" />} label="Sponsors" action />
          <p className="font-display text-4xl font-bold text-foreground">{counts.sponsors}</p>
          <p className="mt-1 text-sm text-muted-foreground">logo's op de publieke site</p>
        </Card>

        {/* Polls */}
        <Card onClick={() => onNavigate("polls")}>
          <CardHead icon={<PollIcon className="h-4 w-4" />} label="Polls" action />
          <p className="font-display text-4xl font-bold text-foreground">{counts.polls}</p>
          <p className="mt-1 text-sm text-muted-foreground">vragen voor het publiek</p>
        </Card>

        {/* Publieke weergave */}
        <Card onClick={() => onNavigate("presentation")}>
          <CardHead icon={<Globe className="h-4 w-4" />} label="Publieke weergave" action />
          <p className="text-sm text-muted-foreground">
            Website, schermvoorstelling en vormgeving instellen.
          </p>
        </Card>
      </div>
    </div>
  );
};

export default TournamentOverview;
