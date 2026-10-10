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

// Fits the wall title between the fixed LIVE LOTING heading and the brand line.
// Fills the board width whenever the uppercase ink still fits the vertical band,
// then stretches the condensed glyphs vertically for the tall narrow look.
export function fitWallTitle(boardWidth: number, naturalWidth: number, emHeight: number, stageHeight: number): { scale: number; stretch: number } {
  if (!(boardWidth > 0) || !(naturalWidth > 0) || !(emHeight > 0) || !(stageHeight > 0)) return { scale: 1, stretch: 1 };
  const usable = stageHeight * 0.102;
  const capUnit = emHeight * 0.74;
  const widthFit = boardWidth / naturalWidth;
  const stretchAtWidthFit = usable / (capUnit * widthFit);
  if (stretchAtWidthFit >= 1) return { scale: widthFit, stretch: Math.min(1.6, stretchAtWidthFit) };
  return { scale: usable / (capUnit * 1.6), stretch: 1.6 };
}