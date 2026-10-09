import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/** Resolve the current title once per open draw; publish it with the picture. */
export function useDrawTournamentName(tournamentId: string, open: boolean) {
  const [name, setName] = useState("");
  useEffect(() => {
    if (!open) return;
    let active = true;
    setName("");
    void supabase.from("tournaments").select("name").eq("id", tournamentId).maybeSingle().then(({ data }) => {
      if (active) setName(data?.name ?? "");
    });
    return () => { active = false; };
  }, [tournamentId, open]);
  return name;
}