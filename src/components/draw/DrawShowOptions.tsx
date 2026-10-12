import { useId, useState, type ReactNode } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Check, Copy, ExternalLink, QrCode, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
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
  const segment = (active: boolean) => cn("rounded-sm text-xs sm:text-sm font-semibold uppercase tracking-wide transition-colors", active ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground");
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
      <div className="min-w-0 space-y-2"><Label id={`${id}-speed`} className="draw-section-title">Animatiesnelheid</Label><div className="grid h-11 grid-cols-3 rounded-md border border-border bg-secondary p-1" role="group" aria-labelledby={`${id}-speed`}>{[{ value: .75, label: "Langzaam" }, { value: 1, label: "Normaal" }, { value: 1.5, label: "Snel" }].map(item => <button key={item.value} type="button" aria-pressed={options.speed === item.value} className={segment(options.speed === item.value)} onClick={() => onChange({ ...options, speed: item.value })}>{item.label}</button>)}</div></div>
      <div className="min-w-0 space-y-2"><Label id={`${id}-flags`} className="draw-section-title">Landenvlag tonen achter teamnaam</Label><div className="grid h-11 grid-cols-2 rounded-md border border-border bg-secondary p-1" role="group" aria-labelledby={`${id}-flags`}>{[true, false].map(enabled => <button key={String(enabled)} type="button" aria-pressed={options.flagBackdrops === enabled} className={segment(options.flagBackdrops === enabled)} onClick={() => onChange({ ...options, flagBackdrops: enabled })}>{enabled ? "Aan" : "Uit"}</button>)}</div></div>
    </div>
    {children}
    <div className="space-y-2">
      <Label htmlFor={`${id}-url`} className="draw-section-title">LIVE LOTING LINK</Label>
      <div className="draw-panel space-y-3 p-3">
      <div className="flex items-center gap-2"><Input id={`${id}-url`} value={url} readOnly onFocus={(event) => event.target.select()} className="min-w-0" /><Button variant="ghost" size="icon" aria-label="Live loting link openen" onClick={() => window.open(url, "_blank", "noopener,noreferrer")}><ExternalLink className="h-4 w-4" /></Button></div>
      <div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" onClick={copy}>{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}{copied ? "Gekopieerd" : "Kopiëren"}</Button><Button variant="outline" size="sm" onClick={share}><Share2 className="h-4 w-4" />Delen</Button><Button variant="outline" size="sm" aria-expanded={qr} onClick={() => setQr(value => !value)}><QrCode className="h-4 w-4" />QR-code</Button></div>
      {qr && <div className="draw-watch-qr mx-auto w-fit p-3"><QRCodeSVG value={url} size={compact ? 120 : 160} title="QR-code kijklink" marginSize={1} /></div>}
      </div>
    </div>
    <div className="space-y-2"><Label className="draw-section-title">Thema kiezen</Label>
      {compact ? <Select value={options.theme} onValueChange={(theme) => onChange({ ...options, theme: drawStudios.find((item) => item.id === theme)?.id ?? "copa-gold" })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent portalContainer={portalContainer}>{drawStudios.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select>
        : <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">{drawStudios.map((item) => <Button key={item.id} variant="outline" aria-pressed={options.theme === item.id} onClick={() => onChange({ ...options, theme: item.id })} className="draw-choice draw-type-choice h-auto flex-col overflow-hidden p-0 text-foreground"><img src={item.asset.url} alt="" className="aspect-video w-full object-cover" /><span className="flex w-full items-center justify-between gap-2 p-3 text-foreground">{item.name}{options.theme === item.id && <Check className="h-4 w-4 text-primary" />}</span></Button>)}</div>}
    </div>
  </section>;
}
