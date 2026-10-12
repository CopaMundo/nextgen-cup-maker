import { useId, useState, type ReactNode } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Check, Copy, ExternalLink, QrCode, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { drawStudios, type DrawShowOptions as Options } from "@/lib/drawStudio";
import { useToast } from "@/hooks/use-toast";

export function DrawShowOptions({ phaseId, options, onChange, portalContainer, compact = false, children }: {
  phaseId: string; options: Options; onChange: (options: Options) => void;
  portalContainer?: HTMLElement | null; compact?: boolean; children?: ReactNode;
}) {
  const id = useId();
  const { toast } = useToast();
  const [qr, setQr] = useState(false);
  const [copied, setCopied] = useState(false);
  const url = `${window.location.origin}/draw/${encodeURIComponent(phaseId)}`;
  const copy = async () => {
    try { await navigator.clipboard.writeText(url); setCopied(true); }
    catch { toast({ title: "Kopiëren niet gelukt", description: "Selecteer en kopieer de kijklink.", variant: "destructive" }); }
  };
  const share = async () => {
    if (!navigator.share) { await copy(); return; }
    try { await navigator.share({ title: "Live loting", url }); }
    catch (error) { if (!(error instanceof DOMException && error.name === "AbortError")) await copy(); }
  };
  return <section className="space-y-5" aria-label="Loting opties">
    <div className={`grid gap-4 ${compact ? "" : "sm:grid-cols-2"}`}>
      <div className="space-y-2"><Label htmlFor={`${id}-speed`}>Animatiesnelheid</Label><Select value={String(options.speed)} onValueChange={(speed) => onChange({ ...options, speed: Number(speed) })}><SelectTrigger id={`${id}-speed`}><SelectValue /></SelectTrigger><SelectContent portalContainer={portalContainer}>{[{ value: .75, label: "Langzaam" }, { value: 1, label: "Normaal" }, { value: 1.5, label: "Snel" }].map((item) => <SelectItem key={item.value} value={String(item.value)}>{item.label}</SelectItem>)}</SelectContent></Select></div>
      <div className="flex items-center justify-between gap-3"><Label htmlFor={`${id}-flags`}>Landenvlag tonen achter teamnaam</Label><div className="flex shrink-0 items-center gap-2"><span className="text-xs text-muted-foreground">{options.flagBackdrops ? "Aan" : "Uit"}</span><Switch id={`${id}-flags`} checked={options.flagBackdrops} onCheckedChange={(flagBackdrops) => onChange({ ...options, flagBackdrops })} /></div></div>
    </div>
    {children}
    <div className="draw-panel space-y-3 p-3">
      <Label htmlFor={`${id}-url`} className="font-semibold">Live loting link</Label>
      <div className="flex items-center gap-2"><Input id={`${id}-url`} value={url} readOnly onFocus={(event) => event.target.select()} className="min-w-0" /><Button variant="ghost" size="icon" aria-label="Live loting link openen" onClick={() => window.open(url, "_blank", "noopener,noreferrer")}><ExternalLink className="h-4 w-4" /></Button></div>
      <div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" onClick={copy}>{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}{copied ? "Gekopieerd" : "Kopiëren"}</Button><Button variant="outline" size="sm" onClick={share}><Share2 className="h-4 w-4" />Delen</Button><Button variant="outline" size="sm" aria-expanded={qr} onClick={() => setQr(value => !value)}><QrCode className="h-4 w-4" />QR-code</Button></div>
      {qr && <div className="draw-watch-qr mx-auto w-fit p-3"><QRCodeSVG value={url} size={compact ? 120 : 160} title="QR-code kijklink" marginSize={1} /></div>}
    </div>
    <div className="space-y-2"><Label>Thema kiezen</Label>
      {compact ? <Select value={options.theme} onValueChange={(theme) => onChange({ ...options, theme: drawStudios.find((item) => item.id === theme)?.id ?? "copa-gold" })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent portalContainer={portalContainer}>{drawStudios.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select>
        : <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">{drawStudios.map((item) => <Button key={item.id} variant="outline" aria-pressed={options.theme === item.id} onClick={() => onChange({ ...options, theme: item.id })} className="draw-choice draw-type-choice h-auto flex-col overflow-hidden p-0 text-foreground"><img src={item.asset.url} alt={item.name} className="aspect-video w-full object-cover" /><span className="flex w-full items-center justify-between gap-2 p-3 text-foreground">{item.name}{options.theme === item.id && <Check className="h-4 w-4 text-primary" />}</span></Button>)}</div>}
    </div>
  </section>;
}
