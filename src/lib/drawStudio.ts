import gold from "@/assets/copa-gold-studio-v11-4k.webp.asset.json";
import blue from "@/assets/champions-blue-studio-v9-4k.webp.asset.json";
import white from "@/assets/platinum-white-studio-v11-4k.webp.asset.json";
import goldBowl from "@/assets/draw-bowl-gold.png";
import blueBowl from "@/assets/draw-bowl-blue.png";
import whiteBowl from "@/assets/draw-bowl-platinum.png";

export type DrawStudioTheme = "copa-gold" | "champions-blue" | "platinum-white";
export const drawStudios = [
  { id: "copa-gold", name: "COPA Gold", asset: gold, bowl: goldBowl },
  { id: "champions-blue", name: "Champions Blue", asset: blue, bowl: blueBowl },
  { id: "platinum-white", name: "Platinum White", asset: white, bowl: whiteBowl },
] as const;
export function studioFor(theme?: string) {
  return drawStudios.find((studio) => studio.id === theme) ?? drawStudios[0];
}
export interface DrawShowOptions {
  theme: DrawStudioTheme;
  speed: number;
  flagBackdrops: boolean;
}
export const defaultShowOptions: DrawShowOptions = { theme: "copa-gold", speed: 1, flagBackdrops: true };

export function readShowOptions(phaseId: string): DrawShowOptions {
  try {
    const saved = JSON.parse(localStorage.getItem(`copa-draw-show:${phaseId}`) ?? "null");
    return { theme: studioFor(saved?.theme).id, speed: [.75, 1, 1.5].includes(saved?.speed) ? saved.speed : 1, flagBackdrops: saved?.flagBackdrops !== false };
  } catch { return defaultShowOptions; }
}
