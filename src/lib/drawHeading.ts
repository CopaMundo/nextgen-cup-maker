const headings: Record<string, string> = {
  nl: "LIVE LOTING",
  en: "LIVE DRAW",
  fr: "TIRAGE EN DIRECT",
  de: "LIVE-AUSLOSUNG",
  es: "SORTEO EN DIRECTO",
  it: "SORTEGGIO IN DIRETTA",
  pt: "SORTEIO AO VIVO",
};

export function drawHeading(language: string): string {
  return headings[language.toLowerCase().split(/[-_]/)[0]] ?? headings.en;
}

type WallTitleMeasurement = { width: number; height: number; lines: number };

export function balanceWallTitle(text: string, width: number, measure: (text: string) => number): string {
  const words = text.trim().split(/\s+/);
  if (words.length < 2 || measure(words.join(" ")) <= width) return words.join(" ");
  let best = 1;
  let smallestWidth = Infinity;
  for (let split = 1; split < words.length; split++) {
    const widest = Math.max(measure(words.slice(0, split).join(" ")), measure(words.slice(split).join(" ")));
    if (widest < smallestWidth) { best = split; smallestWidth = widest; }
  }
  return `${words.slice(0, best).join(" ")}\n${words.slice(best).join(" ")}`;
}

// Measure real balanced browser wrapping; size the font, never distort glyphs.
export function fitWallTitle(width: number, height: number, maxFontSize: number, measure: (fontSize: number) => WallTitleMeasurement): number {
  if (!(width > 0) || !(height > 0) || !(maxFontSize > 0)) return 0;
  let low = 0;
  let high = maxFontSize;
  for (let iteration = 0; iteration < 22; iteration++) {
    const size = (low + high) / 2;
    const measured = measure(size);
    if (measured.width <= width && measured.height <= height && measured.lines <= 2) low = size;
    else high = size;
  }
  return low;
}