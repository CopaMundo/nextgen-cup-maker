import gold from "@/assets/studio-gold-4k.webp.asset.json";
import blue from "@/assets/studio-blue-4k.webp.asset.json";
import white from "@/assets/studio-white-4k.webp.asset.json";

export type DrawStudioTheme = "copa-gold" | "champions-blue" | "platinum-white";
export const drawStudios = [
  { id: "copa-gold", name: "COPA Gold", asset: gold },
  { id: "champions-blue", name: "Champions Blue", asset: blue },
  { id: "platinum-white", name: "Platinum White", asset: white },
] as const;
export function studioFor(theme?: string) {
  return drawStudios.find((studio) => studio.id === theme) ?? drawStudios[0];
}
export interface DrawShowOptions {
  theme: DrawStudioTheme;
  speed: number;
}
export const defaultShowOptions: DrawShowOptions = { theme: "copa-gold", speed: 1 };

export function readShowOptions(phaseId: string): DrawShowOptions {
  try {
    const saved = JSON.parse(localStorage.getItem(`copa-draw-show:${phaseId}`) ?? "null");
    return { theme: studioFor(saved?.theme).id, speed: [.75, 1, 1.5].includes(saved?.speed) ? saved.speed : 1 };
  } catch { return defaultShowOptions; }
}