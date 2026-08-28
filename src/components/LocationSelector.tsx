import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface Location {
  id: string;
  name: string;
  sort_order: number;
}

const LocationSelector = ({
  tournamentId,
  selectedLocation,
  onSelect,
  className,
}: {
  tournamentId: string;
  selectedLocation: string | null;
  onSelect: (name: string | null) => void;
  className?: string;
}) => {
  const [locations, setLocations] = useState<Location[]>([]);

  useEffect(() => {
    supabase
      .from("tournament_locations")
      .select("id, name, sort_order")
      .eq("tournament_id", tournamentId)
      .order("sort_order")
      .then(({ data, error }) => {
        if (error) {
          console.error("LocationSelector load error:", error);
          return;
        }
        const nextLocations = (data || []) as Location[];
        setLocations(nextLocations);

        if (nextLocations.length === 0) {
          onSelect(null);
          return;
        }

        const hasSelected = nextLocations.some((l) => l.name === selectedLocation);
        if (!selectedLocation || !hasSelected) {
          onSelect(nextLocations[0].name);
        }
      });
  }, [tournamentId, selectedLocation, onSelect]);

  if (locations.length <= 1) return null;

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Locatie</span>
      <select
        value={selectedLocation || ""}
        onChange={(e) => onSelect(e.target.value || null)}
        className="h-9 rounded-lg border border-input bg-background px-3 text-sm font-medium"
      >
        {locations.map((l) => (
          <option key={l.id} value={l.name}>
            {l.name}
          </option>
        ))}
      </select>
    </div>
  );
};

export default LocationSelector;
