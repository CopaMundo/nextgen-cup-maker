import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { DrawShow } from "@/components/draw/DrawShow";
import type { DrawSessionState } from "@/lib/drawSession";

type Picture = { session: DrawSessionState; spotlightId: string | null };

export default function DrawProjector() {
  const { phaseId } = useParams<{ phaseId: string }>();
  const [picture, setPicture] = useState<Picture | null>(null);
  useEffect(() => {
    if (!phaseId) return;
    let active = true;
    const refresh = async () => {
      const { data } = await supabase.from("draw_sessions").select("status, state").eq("phase_id", phaseId).maybeSingle();
      if (!active) return;
      const state = data?.state as unknown as Picture | undefined;
      setPicture(data?.status === "running" && state?.session?.kind === "containers" ? state : null);
    };
    void refresh();
    const channel = supabase.channel(`draw-projector-${phaseId}`).on("postgres_changes", { event: "*", schema: "public", table: "draw_sessions", filter: `phase_id=eq.${phaseId}` }, () => { void refresh(); }).subscribe();
    const interval = window.setInterval(() => { void refresh(); }, 3000);
    return () => { active = false; window.clearInterval(interval); void supabase.removeChannel(channel); };
  }, [phaseId]);
  return <main className="draw-projector-stage flex h-dvh items-center justify-center overflow-hidden bg-background text-foreground">
    <DrawShow session={picture?.session} spotlightId={picture?.spotlightId} />
  </main>;
}