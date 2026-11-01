export default function BracketRoundIndicators({ count, active }: { count: number; active: number }) {
  return <div className="flex justify-center gap-1.5 py-1 mb-2" role="img" aria-label={`Ronde ${active + 1} van ${count}`}>
    {Array.from({ length: count }, (_, index) => <span key={index} aria-hidden className={`h-1.5 rounded-full ${index === active ? "w-4 bg-primary" : "w-1.5 bg-muted-foreground/30"}`} />)}
  </div>;
}