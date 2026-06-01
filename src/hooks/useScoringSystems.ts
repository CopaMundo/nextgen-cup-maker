import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { ScoringSystemOption } from "@/components/ScoringSystemSelector";

/**
 * Fetches all scoring systems for a tournament. Used for showing selectors
 * (only rendered when there is more than 1 system).
 */
export const useScoringSystems = (tournamentId: string | undefined | null) => {
  const [systems, setSystems] = useState<ScoringSystemOption[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!tournamentId) {
      setSystems([]);
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from("tournament_scoring_systems" as any)
      .select("id, name, sort_order, scoring_type, num_sets, playoff_mode")
      .eq("tournament_id", tournamentId)
      .order("sort_order");
    setSystems((data as any) || []);
    setLoading(false);
  }, [tournamentId]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { systems, loading, refetch };
};
