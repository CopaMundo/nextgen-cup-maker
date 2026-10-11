import { useEffect, useState, type RefObject } from "react";
import { Maximize, Minimize } from "lucide-react";
import { Button } from "@/components/ui/button";

const PSEUDO_CLASS = "is-pseudo-fullscreen";

/**
 * Browser fullscreen on the director stage, with an in-page fallback when the
 * browser or an embedding frame refuses the Fullscreen API.
 */
export function DrawFullscreenButton({ target }: { target: RefObject<HTMLDivElement> }) {
  const [fullscreen, setFullscreen] = useState(false);
  useEffect(() => {
    const update = () => setFullscreen(document.fullscreenElement === target.current || Boolean(target.current?.classList.contains(PSEUDO_CLASS)));
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && target.current?.classList.contains(PSEUDO_CLASS)) { target.current.classList.remove(PSEUDO_CLASS); update(); }
    };
    document.addEventListener("fullscreenchange", update);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("fullscreenchange", update);
      document.removeEventListener("keydown", onKey);
      target.current?.classList.remove(PSEUDO_CLASS);
    };
  }, [target]);
  const toggle = async () => {
    const element = target.current;
    if (!element) return;
    if (element.classList.contains(PSEUDO_CLASS)) { element.classList.remove(PSEUDO_CLASS); setFullscreen(false); return; }
    if (document.fullscreenElement === element) { await document.exitFullscreen().catch(() => undefined); return; }
    try {
      if (!document.fullscreenEnabled || !element.requestFullscreen) throw new Error("unavailable");
      await element.requestFullscreen();
    } catch {
      element.classList.add(PSEUDO_CLASS);
      setFullscreen(true);
    }
  };
  const label = fullscreen ? "Schermvullend sluiten" : "Schermvullend";
  return <Button className="draw-scene-button" variant="ghost" size="icon" aria-label={label} title={label} onClick={toggle}>{fullscreen ? <Minimize /> : <Maximize />}</Button>;
}
