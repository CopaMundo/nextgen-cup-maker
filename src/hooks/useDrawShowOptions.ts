import { useEffect, useState } from "react";
import { readShowOptions, type DrawShowOptions } from "@/lib/drawStudio";

export function useDrawShowOptions(phaseId: string) {
  const [options, setOptions] = useState<DrawShowOptions>(() => readShowOptions(phaseId));
  useEffect(() => { setOptions(readShowOptions(phaseId)); }, [phaseId]);
  const change = (next: DrawShowOptions) => {
    localStorage.setItem(`copa-draw-show:${phaseId}`, JSON.stringify(next));
    setOptions(next);
  };
  return [options, change] as const;
}