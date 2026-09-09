import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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
  selectClassName,
}: {
  tournamentId: string;
  selectedLocation: string | null;
  onSelect: (name: string | null) => void;
  className?: string;
  selectClassName?: string;
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
      <span className="w-12 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Locatie</span>
      <Select value={selectedLocation || ""} onValueChange={(value) => onSelect(value || null)}>
        <SelectTrigger
          title={selectedLocation || ""}
          className={cn("h-8 w-auto min-w-fit max-w-[20ch] gap-2 px-2 text-xs font-medium", selectClassName)}
        >
          <SelectValue placeholder="Kies locatie" />
        </SelectTrigger>
        <SelectContent>
        {locations.map((l) => (
          <SelectItem key={l.id} value={l.name}>{l.name}</SelectItem>
        ))}
        </SelectContent>
      </Select>
    </div>
  );
};

export default LocationSelector;
