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

  const displayName = (selectedLocation || "").length > 16 ? `${selectedLocation!.slice(0, 16).trimEnd()}...` : selectedLocation;

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <span className="w-10 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Locatie</span>
      <Select value={selectedLocation || ""} onValueChange={(value) => onSelect(value || null)}>
        <SelectTrigger
          title={selectedLocation || ""}
          className={cn("h-7 w-auto min-w-fit max-w-[18ch] gap-1 px-1.5 text-[11px] font-medium leading-none", !isMobile && "h-6", selectClassName)}
        >
          <SelectValue>{displayName || "Kies locatie"}</SelectValue>
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
