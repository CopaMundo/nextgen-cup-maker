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
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import SlideshowConfig from "./SlideshowConfig";

type SubTab = "website" | "slideshow" | "visualization";

const PresentationManager = ({
  tournament,
  onUpdate,
  subTab = "website",
}: {
  tournament: any;
  onUpdate: (t: any) => void;
  subTab?: SubTab;
}) => {
  const { toast } = useToast();
  const [showQR, setShowQR] = useState(false);
  const [confirmRegenerate, setConfirmRegenerate] = useState(false);
  const [displayStyle, setDisplayStyle] = useState<BroadcastStyle>(normalizeBroadcastStyle(tournament.view_display_style));
  const [formatDisplayMode, setFormatDisplayMode] = useState<"tabs" | "stacked">((tournament.format_display_mode || "tabs") as "tabs" | "stacked");

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

  return (
    <>
      <div className="w-full space-y-6">

        {subTab === "website" && (
          <>
            {/* Website link */}
            <div className="section-card space-y-5">
              <h2 className="section-title">
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
                  <div className="flex flex-wrap gap-2">
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
            <div className="section-card space-y-5">
              <h2 className="section-title">
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
            <div className="section-card space-y-5">
              <h2 className="section-title">
                <Eye className="h-5 w-5 text-primary" /> Broadcast stijl
              </h2>
              {(() => {
                const applyStyle = async (target: BroadcastStyle, name: string) => {
                  setDisplayStyle(target);
                  await supabase.from("tournaments").update({ view_display_style: target } as any).eq("id", tournament.id);
                  onUpdate({ ...tournament, view_display_style: target });
                  toast({ title: `Stijl '${name}' ingesteld` });
                };
                const entries = (Object.entries(BROADCAST_STYLES) as [BroadcastStyle, { name: string; description: string; preview: string }][])
                  .filter(([key]) => SELECTABLE_BROADCAST_STYLES.includes(key));
                return (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {entries.map(([key, info]) => {
                      const isActive = displayStyle === key;
                      return (
                        <button
                          key={key}
                          onClick={() => applyStyle(key, info.name)}
                          className={cn(
                            "flex items-center gap-3 rounded-lg border p-3 text-left transition-colors",
                            isActive ? "border-y-2 border-y-primary bg-primary/[0.06]" : "border-border hover:border-foreground/30"
                          )}
                        >
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-lg">
                            {info.preview}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">{info.name}</span>
                        </button>
                      );
                    })}
                  </div>
                );
              })()}
            </div>


            {/* Format display */}
            <div className="section-card space-y-5">
              <div className="flex items-start justify-between gap-4">
                <h2 className="section-title">
                  <Presentation className="h-5 w-5 text-primary" /> Formatweergave
                </h2>
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => updateFormatDisplayMode("stacked")}
                  className={cn(
                    "flex flex-col rounded-lg border p-3 text-left transition-colors",
                    formatDisplayMode === "stacked" ? "border-y-2 border-y-primary bg-primary/[0.06]" : "border-border hover:border-foreground/30"
                  )}
                >
                  <span className="text-sm font-semibold text-foreground">Onder elkaar</span>
                  <span className="text-xs text-muted-foreground">Alle formats staan direct onder dezelfde fase.</span>
                </button>
                <button
                  type="button"
                  onClick={() => updateFormatDisplayMode("tabs")}
                  className={cn(
                    "flex flex-col rounded-lg border p-3 text-left transition-colors",
                    formatDisplayMode === "tabs" ? "border-y-2 border-y-primary bg-primary/[0.06]" : "border-border hover:border-foreground/30"
                  )}
                >
                  <span className="text-sm font-semibold text-foreground">Tabs</span>
                  <span className="text-xs text-muted-foreground">Formats worden als keuzes onder de fase getoond.</span>
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
