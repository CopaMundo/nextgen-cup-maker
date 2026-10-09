import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useDrawTournamentLogo(tournamentId: string, open: boolean) {
  const [logo, setLogo] = useState<string | undefined>();
  useEffect(() => {
    if (!open) return;
    let active = true;
    setLogo(undefined);
    void supabase.from("tournaments").select("logo_url").eq("id", tournamentId).maybeSingle().then(({ data }) => {
      if (active) setLogo(data?.logo_url ?? undefined);
    });
    return () => { active = false; };
  }, [tournamentId, open]);
  return logo;
}