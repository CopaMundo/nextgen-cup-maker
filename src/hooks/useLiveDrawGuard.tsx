import { useCallback, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

const draftKeys = (phaseId: string) => [
  `copa-live-draw:groups:v1:${phaseId}`,
  `copa-live-draw:rounds:v1:${phaseId}`,
  `copa-live-draw-overwrite:${phaseId}`,
];

/** True when a live draw for this phase was started (draft/session) or completed (report). */
export async function hasLiveDraw(phaseId: string): Promise<boolean> {
  if (draftKeys(phaseId).slice(0, 2).some(key => localStorage.getItem(key))) return true;
  const [{ data: sessions }, { data: reports }] = await Promise.all([
    supabase.from("draw_sessions").select("id").eq("phase_id", phaseId).limit(1),
    supabase.from("draw_reports").select("id").eq("phase_id", phaseId).limit(1),
  ]);
  return Boolean(sessions?.length || reports?.length);
}

/** Wipe the live draw status: browser drafts, shared show session and draw reports. */
export async function resetLiveDraw(phaseId: string): Promise<void> {
  for (const key of draftKeys(phaseId)) localStorage.removeItem(key);
  await Promise.all([
    supabase.from("draw_sessions").delete().eq("phase_id", phaseId),
    supabase.from("draw_reports").delete().eq("phase_id", phaseId),
  ]);
}

/** Guards manual/random layout changes against silently overwriting a live draw. */
export function useLiveDrawGuard(phaseId: string, onReset?: () => void) {
  const [open, setOpen] = useState(false);
  const pending = useRef<(() => unknown) | null>(null);
  const cleared = useRef(false);

  const guard = useCallback(async (action: () => unknown) => {
    if (!cleared.current && await hasLiveDraw(phaseId)) {
      pending.current = action;
      setOpen(true);
      return;
    }
    await action();
  }, [phaseId]);

  const confirm = async () => {
    setOpen(false);
    const action = pending.current;
    pending.current = null;
    await resetLiveDraw(phaseId);
    onReset?.();
    if (action) await action();
  };

  const dialog = <AlertDialog open={open} onOpenChange={(o) => { if (!o) { setOpen(false); pending.current = null; } }}>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Loting overschrijven?</AlertDialogTitle>
        <AlertDialogDescription>Als je handmatig wijzigt of een willekeurige indeling toepast, gaat de huidige live loting en showstatus verloren.</AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>Annuleren</AlertDialogCancel>
        <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => { void confirm(); }}>Ja, overschrijven</AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>;

  return { guard, dialog };
}
