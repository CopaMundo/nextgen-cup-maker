import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

export function DrawScopeConfirm({ action, onClose, container, scope, onCurrent, onAll }: {
  action: "reset" | "complete" | null;
  onClose: () => void;
  container: HTMLElement | null;
  scope?: "pot" | "groep";
  onCurrent: () => void;
  onAll: () => void;
}) {
  const reset = action === "reset";
  return <AlertDialog open={action !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
    <AlertDialogContent portalContainer={container} className="draw-dialog-theme">
      <AlertDialogHeader>
        <AlertDialogTitle>{reset ? "Loting opnieuw beginnen?" : "Alles loten?"}</AlertDialogTitle>
        <AlertDialogDescription>{reset ? "De gekozen trekkingen worden gewist. De instellingen blijven behouden." : "De gekozen trekkingen worden direct voltooid zonder verdere teamonthullingen."}</AlertDialogDescription>
      </AlertDialogHeader>
      <div className="flex flex-col gap-2">
        {scope && <AlertDialogAction className={reset ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""} onClick={onCurrent}>Huidige {scope} {reset ? "resetten" : "afronden"}</AlertDialogAction>}
        <AlertDialogAction className={reset ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""} onClick={onAll}>{reset ? "Volledige loting opnieuw beginnen" : "Hele loting voltooien"}</AlertDialogAction>
        <AlertDialogCancel>Annuleren</AlertDialogCancel>
      </div>
    </AlertDialogContent>
  </AlertDialog>;
}