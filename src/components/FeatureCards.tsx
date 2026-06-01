import {
  Users, CalendarDays, BarChart3, Trophy, Globe, Palette,
  Shield, Layers, BarChart, Monitor, ArrowRight, Zap,
  Share2, Settings, FileText
} from "lucide-react";
import { Link } from "react-router-dom";
import productMockup from "@/assets/product-mockup.png";

const features = [
  {
    icon: Users,
    title: "Team & Speler Beheer",
    description: "Tot 128 teams met spelers, staf, rugnummers, posities en landenvlaggen. Upload logo's en ploegfoto's.",
  },
  {
    icon: CalendarDays,
    title: "Automatische Planning",
    description: "Genereer round-robin wedstrijden automatisch. Stel datum, tijd, veld en scheidsrechter in per wedstrijd.",
  },
  {
    icon: BarChart3,
    title: "Live Klassementen",
    description: "Real-time standen met aanpasbare tiebreakers, kleurzones en bonuspunten. Alles automatisch berekend.",
  },
  {
    icon: Trophy,
    title: "Next Gen League",
    description: "Het unieke Copa Mundo format verdeelt teams automatisch in Champions, Europa en Conference League divisies.",
  },
  {
    icon: Globe,
    title: "Publieke View",
    description: "Deel één link — bezoekers volgen live standen, schema's en brackets zonder in te loggen.",
  },
  {
    icon: Palette,
    title: "10 Thema's",
    description: "Van Tropical tot Cyberpunk. Elk thema in light & dark mode met broadcast-stijlen voor presentatie.",
  },
  {
    icon: Layers,
    title: "Fases & Brackets",
    description: "Combineer groepsfases, knockouts en plaatsingswedstrijden. Visuele bracket-weergave inclusief penalty's.",
  },
  {
    icon: Shield,
    title: "Statistieken",
    description: "Doelpunten, assists, gele en rode kaarten per speler. Topscorerslijsten automatisch bijgewerkt.",
  },
];

const steps = [
  {
    number: "01",
    title: "Maak een account",
    description: "Registreer gratis en start direct.",
  },
  {
    number: "02",
    title: "Configureer",
    description: "Kies format, voeg teams toe, stel groepen en fases in.",
  },
  {
    number: "03",
    title: "Genereer & Plan",
    description: "Wedstrijden automatisch genereren en inplannen.",
  },
  {
    number: "04",
    title: "Deel & Volg Live",
    description: "Deel de publieke link. Alles realtime bijgewerkt.",
  },
];

const highlights = [
  { icon: Monitor, text: "Slideshow modus voor grote schermen" },
  { icon: Share2, text: "QR-code generatie voor publieke link" },
  { icon: Settings, text: "Multi-categorie (bijv. U8, U10, U12)" },
  { icon: FileText, text: "Bijlagen uploaden (reglementen, PDF's)" },
  { icon: Zap, text: "Polls & enquêtes voor bezoekers" },
  { icon: Shield, text: "Sponsors met logo beheer" },
];

const FeatureCards = () => {
  return (
    <>
      {/* Product Showcase */}
      <section className="relative py-20 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-background via-card/50 to-background" />
        <div className="relative container mx-auto px-6">
          <div className="text-center mb-10">
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-primary mb-3">Dashboard</p>
            <h2 className="font-display text-3xl sm:text-5xl font-black text-foreground leading-tight">
              Alles onder controle
            </h2>
            <p className="mt-3 text-muted-foreground max-w-md mx-auto">
              Eén overzichtelijk dashboard voor al je toernooien, teams, wedstrijden en statistieken.
            </p>
          </div>
          <div className="mx-auto max-w-5xl">
            <div className="relative rounded-2xl border border-border/50 bg-card/30 p-2 sm:p-3 backdrop-blur-sm shadow-2xl shadow-primary/5">
              <img
                src={productMockup}
                alt="Copa Mundo dashboard preview"
                className="w-full rounded-xl"
                width={1920}
                height={1080}
                loading="lazy"
              />
              <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-t from-background/40 via-transparent to-transparent" />
            </div>
          </div>
        </div>
      </section>

      {/* Features grid */}
      <section className="container mx-auto px-6 py-20">
        <div className="text-center mb-14">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-primary mb-3">Mogelijkheden</p>
          <h2 className="font-display text-3xl sm:text-5xl font-black text-foreground leading-tight">
            Alles wat je nodig hebt
          </h2>
          <p className="mt-3 text-muted-foreground max-w-lg mx-auto">
            Van team beheer tot live uitzendingen — een compleet pakket voor elk voetbaltoernooi.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f, i) => (
            <div
              key={f.title}
              className="card-glow group relative rounded-2xl border border-border bg-card/60 backdrop-blur-sm p-6 transition-all duration-300 hover:border-primary/40 hover:-translate-y-1"
            >
              <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 transition-colors group-hover:bg-primary/20">
                <f.icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="mt-4 font-display text-sm font-bold text-foreground uppercase tracking-wide">
                {f.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {f.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Extra highlights strip */}
      <section className="border-y border-border/50 bg-card/30 py-10">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-6">
            {highlights.map((h) => (
              <div key={h.text} className="flex flex-col items-center text-center gap-2">
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <h.icon className="h-4 w-4 text-primary" />
                </div>
                <p className="text-xs text-muted-foreground leading-snug">{h.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20">
        <div className="container mx-auto px-6">
          <div className="text-center mb-14">
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-primary mb-3">Hoe het werkt</p>
            <h2 className="font-display text-3xl sm:text-5xl font-black text-foreground leading-tight">
              In 4 stappen live
            </h2>
          </div>

          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4 max-w-4xl mx-auto">
            {steps.map((s, i) => (
              <div key={s.number} className="relative text-center">
                {i < steps.length - 1 && (
                  <div className="hidden lg:block absolute top-7 left-[calc(50%+32px)] w-[calc(100%-64px)] h-px bg-gradient-to-r from-primary/30 to-primary/5" />
                )}
                <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl border-2 border-primary/30 bg-primary/10 mb-4">
                  <span className="font-display text-lg font-black text-primary">{s.number}</span>
                </div>
                <h3 className="font-display text-sm font-bold text-foreground uppercase tracking-wide mb-2">{s.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{s.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="container mx-auto px-6 py-12">
        <div className="relative overflow-hidden rounded-3xl border border-primary/20 bg-primary/5 p-10 sm:p-16 text-center">
          <div className="pointer-events-none absolute -right-20 -top-20 h-[300px] w-[300px] rounded-full bg-primary/10 blur-3xl" />
          <div className="pointer-events-none absolute -left-20 -bottom-20 h-[200px] w-[200px] rounded-full bg-accent/10 blur-3xl" />
          <div className="relative">
            <h2 className="font-display text-3xl sm:text-4xl font-black text-foreground mb-4">
              Klaar om te starten?
            </h2>
            <p className="text-muted-foreground mb-8 max-w-md mx-auto">
              Maak gratis een account en organiseer je eerste toernooi in minuten.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Link
                to="/register"
                className="inline-flex items-center gap-2.5 rounded-xl bg-primary px-7 py-3.5 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/25 transition-all hover:scale-105"
              >
                Gratis Registreren
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/search"
                className="inline-flex items-center gap-2.5 rounded-xl border border-primary/30 bg-primary/10 px-7 py-3.5 text-sm font-bold text-primary transition-all hover:scale-105 hover:bg-primary/20"
              >
                Bekijk Toernooien
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 py-8 mt-4">
        <div className="container mx-auto px-6 text-center">
          <p className="text-sm text-muted-foreground">
            © 2026 <span className="text-primary font-semibold">Copa Mundo</span>. All rights reserved.
          </p>
        </div>
      </footer>
    </>
  );
};

export default FeatureCards;
