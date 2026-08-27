import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/datepicker";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Info } from "lucide-react";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import { SPORT_CATEGORIES, findSport } from "@/lib/sportsList";
import SportIcon from "@/components/SportIcon";

const TOTAL_STEPS = 3;

type DateMode = "single" | "period";

const CreateTournament = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [showSportPicker, setShowSportPicker] = useState(false);
  const [sportSearch, setSportSearch] = useState("");

  const [form, setForm] = useState({
    name: "",
    sport: "",
    date_mode: "single" as DateMode,
    start_date: "",
    end_date: "",
    match_days: [""] as string[],
    tournament_type: "classic" as "classic" | "nextgen",
    categories: [""] as string[],
    locations: [""] as string[],
    is_esport: false,
  });

  const canNext = () => {
    if (step === 1) return form.name.trim().length > 0;
    if (step === 2) return true;
    if (step === 3) return true;
    return false;
  };

  const handleCreate = async () => {
    if (!form.name.trim()) return;
    setLoading(true);

    const validCategories = form.categories.filter((c) => c.trim());
    const startDate =
      form.date_mode === "period"
        ? form.start_date || null
        : form.match_days.find((d) => d) || null;

    const hasMultipleCategories = validCategories.length > 1;

    const { data, error } = await supabase
      .from("tournaments")
      .insert({
        owner_id: user!.id,
        name: form.name,
        sport: form.sport || null,
        tournament_type: form.tournament_type,
        team_count: form.tournament_type === "nextgen" ? 12 : 8,
        is_multi_category: hasMultipleCategories,
        start_date: startDate,
        end_date: form.date_mode === "period" && form.end_date ? form.end_date : null,
        date_mode: form.date_mode,
        match_days: form.date_mode === "single" ? form.match_days.filter((d) => d) : [],
        is_esport: form.is_esport,
      })
      .select("id")
      .single();

    if (error) {
      setLoading(false);
      toast({ title: "Aanmaken mislukt", description: error.message, variant: "destructive" });
      return;
    }

    // Always create at least one category so teams and phases can be linked
    if (validCategories.length > 0) {
      await supabase.from("tournament_categories").insert(
        validCategories.map((name, i) => ({
          tournament_id: data.id,
          name: name.trim(),
          sort_order: i,
        }))
      );
    } else {
      // No divisions entered — create a silent default category
      await supabase.from("tournament_categories").insert({
        tournament_id: data.id,
        name: "",
        sort_order: 0,
      });
    }

    // Always create a default scoring system
    await supabase.from("tournament_scoring_systems" as any).insert({
      tournament_id: data.id,
      name: "Puntentelling 1",
      sort_order: 0,
      scoring_type: "points",
      points_win: 3,
      points_draw: 1,
      points_loss: 0,
      tiebreaker_rules: ["goal_difference", "goals_scored", "head_to_head"],
    } as any);

    if (!form.is_esport) {
      const validLocations = form.locations.filter((l) => l.trim());
      if (validLocations.length > 0) {
        await supabase.from("tournament_locations").insert(
          validLocations.map((name) => ({ tournament_id: data.id, name: name.trim() }))
        );
      }
    }

    setLoading(false);
    toast({ title: "Toernooi aangemaakt!" });
    navigate(`/tournament/${data.id}`);
  };

  // Location helpers
  const addLocation = () => setForm({ ...form, locations: [...form.locations, ""] });
  const removeLocation = (i: number) => {
    if (form.locations.length <= 1) return;
    setForm({ ...form, locations: form.locations.filter((_, idx) => idx !== i) });
  };
  const updateLocation = (i: number, val: string) => {
    const locs = [...form.locations];
    locs[i] = val;
    setForm({ ...form, locations: locs });
  };

  // Category helpers
  const addCategory = () => setForm({ ...form, categories: [...form.categories, ""] });
  const removeCategory = (i: number) => {
    if (form.categories.length <= 1) return;
    setForm({ ...form, categories: form.categories.filter((_, idx) => idx !== i) });
  };
  const updateCategory = (i: number, val: string) => {
    const cats = [...form.categories];
    cats[i] = val;
    setForm({ ...form, categories: cats });
  };

  // Match day helpers
  const addMatchDay = () => setForm({ ...form, match_days: [...form.match_days, ""] });
  const removeMatchDay = (i: number) => {
    if (form.match_days.length <= 1) return;
    setForm({ ...form, match_days: form.match_days.filter((_, idx) => idx !== i) });
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-lg">
          {/* Progress bar */}
          <div className="flex gap-1 mb-8">
            {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
              <div
                key={i}
                className={`h-1 flex-1 rounded-full transition-colors ${
                  i < step ? "bg-primary" : "bg-muted"
                }`}
              />
            ))}
          </div>

          {/* Step 1: Name + Dates */}
          {step === 1 && (
            <div className="rounded-2xl border border-border bg-card p-6 space-y-5">
              <div>
                <h2 className="font-display text-2xl font-bold text-foreground">Nieuw toernooi</h2>
                <p className="text-sm text-muted-foreground mt-1">Je kunt alle details later nog aanpassen.</p>
              </div>
              <div className="space-y-2">
                <Label>Toernooinaam</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Bijv. Copa Mundo"
                />
              </div>

              {/* Sport picker */}
              <div className="space-y-2">
                <Label>Sport</Label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowSportPicker(!showSportPicker)}
                    className="flex items-center gap-2 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground hover:border-primary/50 transition-colors text-left h-10"
                  >
                    {(() => {
                      const found = findSport(form.sport);
                      return found ? (
                        <>
                          <SportIcon sport={found.name} size={16} className="shrink-0" white />
                          <span className="font-medium truncate">{found.name}</span>
                        </>
                      ) : (
                        <span className="text-muted-foreground">Kies een sport</span>
                      );
                    })()}
                  </button>
                  {showSportPicker && (
                    <div className="absolute z-50 mt-1 w-full max-h-80 overflow-auto rounded-lg border border-border bg-popover shadow-lg">
                      <div className="p-2">
                        <Input
                          placeholder="Zoek sport..."
                          value={sportSearch}
                          onChange={(e) => setSportSearch(e.target.value)}
                          className="h-8 text-sm"
                          autoFocus
                        />
                      </div>
                      {SPORT_CATEGORIES.map((cat) => {
                        const filtered = cat.options.filter((s) =>
                          s.name.toLowerCase().includes(sportSearch.toLowerCase())
                        );
                        if (filtered.length === 0) return null;
                        return (
                          <div key={cat.label}>
                            {filtered.map((sport) => (
                              <button
                                key={sport.name}
                                type="button"
                                onClick={() => {
                                  setForm({ ...form, sport: sport.name });
                                  setShowSportPicker(false);
                                  setSportSearch("");
                                }}
                                className={cn(
                                  "flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-accent transition-colors text-left",
                                  form.sport === sport.name && "bg-primary/10 text-primary font-medium"
                                )}
                              >
                                <SportIcon sport={sport.name} size={16} className="shrink-0" white />
                                <span>{sport.name}</span>
                              </button>
                            ))}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Date mode: match days */}
              {form.date_mode === "single" && (
                <div className="space-y-3">
                  <Label>Datum</Label>
                  {form.match_days.map((day, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className="flex-1">
                        <DatePicker
                          value={day}
                          onChange={(val) => {
                            const days = [...form.match_days];
                            days[i] = val;
                            setForm({ ...form, match_days: days });
                          }}
                          placeholder="Kies een datum"
                        />
                      </div>
                      {form.match_days.length > 1 && (
                        <button onClick={() => removeMatchDay(i)} className="text-muted-foreground hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={addMatchDay}
                      className="uppercase text-xs font-semibold tracking-wide"
                    >
                      Wedstrijddag toevoegen
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setForm({ ...form, date_mode: "period", match_days: [""] })}
                      className="uppercase text-xs font-semibold tracking-wide"
                    >
                      Periode toevoegen
                    </Button>
                  </div>
                </div>
              )}

              {/* Date mode: period */}
              {form.date_mode === "period" && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Startdatum</Label>
                      <DatePicker
                        value={form.start_date}
                        onChange={(val) => setForm({ ...form, start_date: val })}
                        placeholder="Startdatum"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Einddatum</Label>
                      <DatePicker
                        value={form.end_date}
                        onChange={(val) => setForm({ ...form, end_date: val })}
                        placeholder="Einddatum"
                      />
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setForm({ ...form, date_mode: "single", start_date: "", end_date: "" })}
                    className="uppercase text-xs font-semibold tracking-wide"
                  >
                    Wedstrijddag toevoegen
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Locations + Esport */}
          {step === 2 && (
            <div className="rounded-2xl border border-border bg-card p-6 space-y-5">
              <div>
                <h2 className="font-display text-2xl font-bold text-foreground">Voer locatie in</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Vul hier de naam van de club, vereniging, sportpark of sporthal in. Velden voeg je later toe.
                </p>
              </div>

              {!form.is_esport && (
                <>
                  {form.locations.map((loc, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Input
                        value={loc}
                        onChange={(e) => updateLocation(i, e.target.value)}
                        placeholder="Voer locatie in"
                        className="flex-1"
                      />
                      {form.locations.length > 1 && (
                        <button onClick={() => removeLocation(i)} className="text-muted-foreground hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                  <Button variant="outline" size="sm" onClick={addLocation} className="uppercase text-xs font-semibold tracking-wide">
                    Locatie toevoegen
                  </Button>
                </>
              )}

              <TooltipProvider>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-foreground">Dit is een online (eSport) toernooi</p>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-[240px] text-xs">
                        Bij een online toernooi worden de wedstrijden automatisch in rondes verdeeld. Je kunt hiervoor geen veldplanning maken.
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <Switch
                    checked={form.is_esport}
                    onCheckedChange={(value) => setForm({ ...form, is_esport: value, locations: value ? [] : [""] })}
                  />
                </div>
              </TooltipProvider>
            </div>
          )}

          {/* Step 3: Divisions */}
          {step === 3 && (
            <div className="rounded-2xl border border-border bg-card p-6 space-y-5">
              <div>
                <h2 className="font-display text-2xl font-bold text-foreground">Voer divisie in</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Verdeel je toernooi in divisies op basis van leeftijd of niveau. Elke divisie krijgt een eigen deelnemerslijst, indeling en schema.
                </p>
              </div>
              {form.categories.map((cat, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    value={cat}
                    onChange={(e) => updateCategory(i, e.target.value)}
                    placeholder="Bijv. U12"
                    className="flex-1"
                  />
                  {form.categories.length > 1 && (
                    <button onClick={() => removeCategory(i)} className="text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={addCategory} className="uppercase text-xs font-semibold tracking-wide">
                Divisie toevoegen
              </Button>
            </div>
          )}

          {/* Navigation buttons */}
          <div className="flex items-center justify-between mt-6">
            <div>
              {step === 1 ? (
                <Button variant="ghost" onClick={() => navigate("/dashboard")} className="uppercase text-xs font-semibold tracking-wide">
                  Annuleren
                </Button>
              ) : (
                <Button variant="ghost" onClick={() => setStep(step - 1)} className="uppercase text-xs font-semibold tracking-wide">
                  Terug
                </Button>
              )}
            </div>
            <div>
              {step < TOTAL_STEPS ? (
                <Button
                  onClick={() => setStep(step + 1)}
                  disabled={!canNext()}
                  className="bg-primary text-primary-foreground hover:bg-primary/90 uppercase text-xs font-semibold tracking-wide"
                >
                  Volgende
                </Button>
              ) : (
                <Button
                  onClick={handleCreate}
                  disabled={loading || !canNext()}
                  className="bg-primary text-primary-foreground hover:bg-primary/90 uppercase text-xs font-semibold tracking-wide"
                >
                  {loading ? "Aanmaken..." : "Aanmaken"}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateTournament;
