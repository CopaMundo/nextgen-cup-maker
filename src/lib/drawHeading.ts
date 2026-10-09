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