import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BROADCAST_STYLES, SELECTABLE_BROADCAST_STYLES, type BroadcastStyle, normalizeBroadcastStyle } from "@/lib/broadcastStyles";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Copy,
  LinkIcon,
  ExternalLink,
  Eye,
  Globe,
  QrCode,
  Presentation,
  AlertTriangle,
  HelpCircle,
  ChevronRight,
  ArrowLeft,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import SlideshowConfig from "./SlideshowConfig";
import { useIsMobile } from "@/hooks/use-mobile";
import websiteIconAsset from "@/assets/world-wide-web.png.asset.json";
import slideshowIconAsset from "@/assets/television.png.asset.json";
import stylingIconAsset from "@/assets/paint_1.png.asset.json";

const MaskIcon = ({ src, label, className = "h-4 w-4" }: { src: string; label: string; className?: string }) => (
  <span
    role="img"
    aria-label={label}
    className={`inline-block bg-primary ${className}`}
    style={{
      maskImage: `url(${src})`,
      maskSize: "contain",
      maskRepeat: "no-repeat",
      maskPosition: "center",
      WebkitMaskImage: `url(${src})`,
      WebkitMaskSize: "contain",
      WebkitMaskRepeat: "no-repeat",
      WebkitMaskPosition: "center",
    }}
  />
);

type SubTab = "website" | "slideshow" | "visualization";

const PresentationManager = ({
  tournament,
  onUpdate,
}: {
  tournament: any;
  onUpdate: (t: any) => void;
}) => {
  const { toast } = useToast();
  const [showQR, setShowQR] = useState(false);
  const [confirmRegenerate, setConfirmRegenerate] = useState(false);
  const [viewTheme, setViewTheme] = useState(tournament.view_theme || "tropical");
  const [displayStyle, setDisplayStyle] = useState<BroadcastStyle>(normalizeBroadcastStyle(tournament.view_display_style));
  const [formatDisplayMode, setFormatDisplayMode] = useState<"tabs" | "stacked">((tournament.format_display_mode || "tabs") as "tabs" | "stacked");
  const [subTab, setSubTab] = useState<SubTab>("website");
  const isMobile = useIsMobile();
  const [mobileOverview, setMobileOverview] = useState(true);

  const viewUrl = `${window.location.origin}/view/${tournament.view_link_token}`;

  const toggleViewLink = async () => {
    const token = tournament.view_link_token || crypto.randomUUID();
    const { error } = await supabase
      .from("tournaments")
      .update({
        view_link_active: !tournament.view_link_active,
        view_link_token: token,
      } as any)
      .eq("id", tournament.id);
    if (!error) {
      onUpdate({
        ...tournament,
        view_link_active: !tournament.view_link_active,
        view_link_token: token,
      });
      toast({
        title: !tournament.view_link_active
          ? "Website-link geactiveerd"
          : "Website-link gedeactiveerd",
      });
    }
  };

  const regenerateLink = async () => {
    const token = crypto.randomUUID();
    const { error } = await supabase
      .from("tournaments")
      .update({ view_link_token: token } as any)
      .eq("id", tournament.id);
    if (!error) {
      onUpdate({ ...tournament, view_link_token: token });
      toast({ title: "Nieuwe link gegenereerd" });
    }
    setConfirmRegenerate(false);
  };

  const copyViewLink = () => {
    navigator.clipboard.writeText(viewUrl);
    toast({ title: "Link gekopieerd!" });
  };

  const openViewLink = () => {
    window.open(viewUrl, "_blank");
  };

  const togglePublic = async () => {
    const { error } = await supabase
      .from("tournaments")
      .update({ is_public: !tournament.is_public } as any)
      .eq("id", tournament.id);
    if (!error) {
      onUpdate({ ...tournament, is_public: !tournament.is_public });
      toast({
        title: !tournament.is_public
          ? "Toernooi is nu vindbaar op de site"
          : "Toernooi is niet meer vindbaar",
      });
    }
  };

  const updateFormatDisplayMode = async (mode: "tabs" | "stacked") => {
    setFormatDisplayMode(mode);
    const { error } = await supabase
      .from("tournaments")
      .update({ format_display_mode: mode } as any)
      .eq("id", tournament.id);
    if (!error) {
      onUpdate({ ...tournament, format_display_mode: mode });
      toast({ title: mode === "tabs" ? "Formats worden als tabs getoond" : "Formats worden onder elkaar getoond" });
    }
  };

  const tabs: { id: SubTab; label: string; icon: React.ReactNode }[] = [
    { id: "website", label: "Website", icon: <MaskIcon src={websiteIconAsset.url} label="Website" className="h-5 w-5" /> },
    { id: "slideshow", label: "Dialoogvoorstelling", icon: <MaskIcon src={slideshowIconAsset.url} label="Dialoogvoorstelling" className="h-5 w-5" /> },
    { id: "visualization", label: "Vormgeving", icon: <MaskIcon src={stylingIconAsset.url} label="Vormgeving" className="h-5 w-5" /> },
  ];

  const activeLabel = tabs.find(t => t.id === subTab)?.label ?? "";

  return (
    <>
      {isMobile && mobileOverview && (
        <div className="grid grid-cols-1 gap-2 mb-4">
          {tabs.map(t => (
            <div
              key={t.id}
              role="button"
              tabIndex={0}
              onClick={() => { setSubTab(t.id); setMobileOverview(false); }}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { setSubTab(t.id); setMobileOverview(false); } }}
              className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5 transition-colors hover:border-primary/50 hover:bg-accent/40"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                {t.icon}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-semibold">{t.label}</span>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </div>
          ))}
        </div>
      )}

      {isMobile && !mobileOverview && (
        <div className="flex items-center gap-2 mb-4">
          <Button variant="outline" size="icon" className="h-8 w-8" aria-label="Terug naar presentatie" onClick={() => setMobileOverview(true)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h2 className="min-w-0 flex-1 truncate text-base font-semibold">{activeLabel}</h2>
        </div>
      )}

      {!isMobile && (
        <div className="flex justify-center border-b border-border flex-wrap mb-6">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setSubTab(t.id)}
              className={cn(
                "px-6 py-3 text-sm font-semibold uppercase tracking-wide transition-colors relative",
                subTab === t.id
                  ? "text-primary after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:bg-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      <div className={cn("space-y-6 max-w-2xl", isMobile && mobileOverview && "hidden")}>

        {subTab === "website" && (
          <>
            {/* Website link */}
            <div className="rounded-xl border border-border bg-card p-6 space-y-4">
              <h2 className="font-display text-lg font-bold text-foreground flex items-center gap-2">
                <LinkIcon className="h-5 w-5 text-primary" /> Website-link
              </h2>
              <p className="text-sm text-muted-foreground">
                Deel deze link zodat anderen het toernooi kunnen volgen met realtime updates.
              </p>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">Link activeren</p>
                  <p className="text-xs text-muted-foreground">
                    Maak het toernooi toegankelijk via een unieke link
                  </p>
                </div>
                <Switch
                  checked={tournament.view_link_active}
                  onCheckedChange={toggleViewLink}
                />
              </div>

              {tournament.view_link_active && (
                <div className="space-y-3">
                  <div className="rounded-lg border border-border bg-secondary p-3">
                    <p className="text-xs text-muted-foreground break-all font-mono">{viewUrl}</p>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Button variant="outline" size="sm" onClick={copyViewLink}>
                      <Copy className="h-4 w-4" /> Kopieer link
                    </Button>
                    <Button variant="outline" size="sm" onClick={openViewLink}>
                      <ExternalLink className="h-4 w-4" /> Openen
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setShowQR(true)}>
                      <QrCode className="h-4 w-4" /> QR-code
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Site visibility */}
            <div className="rounded-xl border border-border bg-card p-6 space-y-4">
              <h2 className="font-display text-lg font-bold text-foreground flex items-center gap-2">
                <Globe className="h-5 w-5 text-primary" /> Zichtbaarheid op de site
              </h2>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">Vindbaar op de website</p>
                  <p className="text-xs text-muted-foreground">
                    Mensen kunnen dit toernooi terugvinden via "Zoek toernooien" op de homepagina
                  </p>
                </div>
                <Switch
                  checked={tournament.is_public ?? false}
                  onCheckedChange={togglePublic}
                />
              </div>
            </div>

          </>
        )}

        {subTab === "slideshow" && (
          <>
            {!tournament.view_link_active && (
              <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-foreground">
                Activeer eerst de website-link (tab Website) om de dialoogvoorstelling te kunnen gebruiken.
              </div>
            )}
            <SlideshowConfig
              tournamentId={tournament.id}
              tournament={tournament}
              onUpdate={onUpdate}
            />
          </>
        )}

        {subTab === "visualization" && (
          <>
            {/* Broadcast style */}
            <div className="rounded-xl border border-border bg-card p-6 space-y-4">
              <h2 className="font-display text-lg font-bold text-foreground flex items-center gap-2">
                <Eye className="h-5 w-5 text-primary" /> Broadcast stijl
              </h2>
              <p className="text-sm text-muted-foreground">
                Kies hoe het toernooi visueel wordt gepresenteerd voor bezoekers. Light/dark wordt door de bezoeker zelf gekozen.
              </p>
              {(() => {
                const applyStyle = async (target: BroadcastStyle, name: string) => {
                  setDisplayStyle(target);
                  await supabase.from("tournaments").update({ view_display_style: target } as any).eq("id", tournament.id);
                  onUpdate({ ...tournament, view_display_style: target });
                  toast({ title: `Stijl '${name}' ingesteld` });
                };
                const entries = (Object.entries(BROADCAST_STYLES) as [BroadcastStyle, { name: string; description: string; preview: string }][])
                  .filter(([key]) => SELECTABLE_BROADCAST_STYLES.includes(key));
                const renderCard = ([key, info]: [BroadcastStyle, { name: string; description: string; preview: string }]) => {
                  const isActive = displayStyle === key;
                  return (
                    <button key={key} onClick={() => applyStyle(key, info.name)}
                      className={`rounded-lg border p-3 text-left transition-colors ${
                        isActive ? "border-primary bg-primary/10" : "border-border hover:border-foreground/30"
                      }`}>
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{info.preview}</span>
                        <div>
                          <p className="text-xs font-bold text-foreground">{info.name}</p>
                          <p className="text-[10px] text-muted-foreground">{info.description}</p>
                        </div>
                      </div>
                    </button>
                  );
                };
                return (
                  <div className="space-y-2">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-primary">Broadcast styles</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">{entries.map(renderCard)}</div>
                  </div>
                );
              })()}
            </div>


            {/* Format display */}
            <div className="rounded-xl border border-border bg-card p-6 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="font-display text-lg font-bold text-foreground flex items-center gap-2">
                    <Presentation className="h-5 w-5 text-primary" /> Formatweergave
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Kies hoe meerdere formats binnen dezelfde fase zichtbaar zijn voor bezoekers.
                  </p>
                </div>
                <TooltipProvider delayDuration={150}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button type="button" className="mt-1 text-muted-foreground transition-colors hover:text-foreground" aria-label="Uitleg over formatweergave">
                        <HelpCircle className="h-4 w-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="left" className="max-w-xs text-xs leading-relaxed">
                      Tabs tonen formats als aparte keuzes onder de fase. Onder elkaar toont alle formats direct na elkaar binnen dezelfde fase.
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => updateFormatDisplayMode("stacked")}
                  className={`rounded-lg border p-3 text-left transition-colors ${
                    formatDisplayMode === "stacked" ? "border-primary bg-primary/10" : "border-border hover:border-foreground/30"
                  }`}
                >
                  <p className="text-xs font-bold text-foreground">Onder elkaar</p>
                  <p className="mt-1 text-[10px] text-muted-foreground">Alle formats staan direct onder dezelfde fase.</p>
                </button>
                <button
                  type="button"
                  onClick={() => updateFormatDisplayMode("tabs")}
                  className={`rounded-lg border p-3 text-left transition-colors ${
                    formatDisplayMode === "tabs" ? "border-primary bg-primary/10" : "border-border hover:border-foreground/30"
                  }`}
                >
                  <p className="text-xs font-bold text-foreground">Tabs</p>
                  <p className="mt-1 text-[10px] text-muted-foreground">Formats worden als keuzes onder de fase getoond.</p>
                </button>
              </div>
            </div>
          </>
        )}

        {/* QR Code Dialog */}
        <Dialog open={showQR} onOpenChange={setShowQR}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>QR-code</DialogTitle>
              <DialogDescription>Scan deze code om het toernooi te openen</DialogDescription>
            </DialogHeader>
            <div className="flex justify-center p-4">
              <div className="rounded-xl bg-white p-4">
                <QRCodeSVG value={viewUrl} size={220} level="H" />
              </div>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground break-all font-mono">{viewUrl}</p>
            </div>
          </DialogContent>
        </Dialog>

        {/* Regenerate confirm dialog */}
        <Dialog open={confirmRegenerate} onOpenChange={setConfirmRegenerate}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" /> Nieuwe link genereren?
              </DialogTitle>
              <DialogDescription>
                De huidige link zal niet meer werken. Iedereen die de oude link heeft zal een nieuwe link nodig hebben.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setConfirmRegenerate(false)}>
                Annuleren
              </Button>
              <Button onClick={regenerateLink} variant="destructive">
                Nieuwe link genereren
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
};

export default PresentationManager;
