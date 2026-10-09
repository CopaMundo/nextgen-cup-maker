import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { DrawShow } from "@/components/draw/DrawShow";
import type { DrawPicture } from "@/lib/drawPresentation";

type Picture = DrawPicture;

export default function DrawProjector() {
  const { phaseId } = useParams<{ phaseId: string }>();
  const [picture, setPicture] = useState<Picture | null>(null);
  useEffect(() => {
    if (!phaseId) return;
    let active = true;
    let revision = 0;
    const show = (data: { status?: unknown; state?: unknown } | null) => {
      const state = data?.state as Picture | undefined;
      setPicture(data?.status === "running" && (state?.session?.kind === "containers" || state?.session?.kind === "rounds") ? state : null);
    };
    const refresh = async () => {
      const request = ++revision;
      const { data } = await supabase.from("draw_sessions").select("status, state").eq("phase_id", phaseId).maybeSingle();
      if (!active || request !== revision) return;
      show(data);
    };
    void refresh();
    const channel = supabase.channel(`draw-projector-${phaseId}`).on("postgres_changes", { event: "*", schema: "public", table: "draw_sessions", filter: `phase_id=eq.${phaseId}` }, (payload) => {
      if (!active) return;
      ++revision;
      if (payload.eventType === "DELETE") show(null);
      else show(payload.new);
    }).subscribe();
    const interval = window.setInterval(() => { void refresh(); }, 3000);
    return () => { active = false; window.clearInterval(interval); void supabase.removeChannel(channel); };
  }, [phaseId]);
  return <main className="draw-projector-stage flex h-dvh items-center justify-center overflow-hidden bg-background text-foreground">
    <DrawShow session={picture?.session} spotlightId={picture?.spotlightId} presentation={picture?.presentation} />
  </main>;
}