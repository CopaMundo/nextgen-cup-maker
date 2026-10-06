import { useEffect, useState, type RefObject } from "react";
import { Maximize, Minimize } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

export function DrawFullscreenButton({ target }: { target: RefObject<HTMLDivElement> }) {
  const [fullscreen, setFullscreen] = useState(false);
  const { toast } = useToast();
  useEffect(() => {
    const update = () => setFullscreen(document.fullscreenElement === target.current);
    document.addEventListener("fullscreenchange", update);
    return () => document.removeEventListener("fullscreenchange", update);
  }, [target]);
  const toggle = async () => {
    const element = target.current;
    if (!element) return;
    try {
      if (document.fullscreenElement === element) await document.exitFullscreen();
      else await element.requestFullscreen();
    } catch {
      toast({ title: "Schermvullend niet beschikbaar", description: "Open de app in een apart browsertabblad en probeer opnieuw." });
    }
  };
  const label = fullscreen ? "Schermvullend sluiten" : "Schermvullend";
  return <Button className="draw-scene-button" variant="ghost" size="icon" aria-label={label} title={label} onClick={toggle}>{fullscreen ? <Minimize /> : <Maximize />}</Button>;
}