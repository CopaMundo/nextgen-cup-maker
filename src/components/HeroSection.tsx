import { Plus, Search, ArrowDown } from "lucide-react";
import { Link } from "react-router-dom";
import trophyLogo from "@/assets/copa-mundo-trophy.png";
import stadiumHero from "@/assets/stadium-hero.jpg";

const HeroSection = () => {
  return (
    <section className="relative w-full min-h-[90vh] flex items-end overflow-hidden">
      {/* Full-bleed stadium background */}
      <div className="absolute inset-0">
        <img
          src={stadiumHero}
          alt="Stadium atmosphere"
          className="h-full w-full object-cover object-center"
        />
        {/* Dark overlay gradient from bottom */}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-background/20" />
        {/* Extra darkness at bottom for text contrast */}
        <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-background to-transparent" />
      </div>

      {/* Content */}
      <div className="relative z-10 w-full px-6 sm:px-10 pb-16 pt-32">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col items-start gap-6">
            {/* Logo + badge */}
            <div className="flex items-center gap-4">
              <img src={trophyLogo} alt="" className="h-16 w-16 sm:h-20 sm:w-20 object-contain drop-shadow-2xl" />
              <div>
                <p className="text-xs sm:text-sm font-bold uppercase tracking-[0.3em] text-primary/80">
                  Toernooi Platform
                </p>
                <h1 className="font-display text-5xl sm:text-7xl md:text-8xl lg:text-9xl font-black leading-[0.85] tracking-tighter">
                  <span className="text-gradient-brand">Copa</span>
                  <br />
                  <span className="text-foreground">Mundo</span>
                </h1>
              </div>
            </div>

            <p className="max-w-lg text-base sm:text-lg leading-relaxed text-muted-foreground">
              Organiseer professionele voetbaltoernooien. Van teamregistratie tot live klassementen
              — alles op één plek, gedeeld via één link.
            </p>

            <div className="flex flex-wrap gap-3">
              <Link
                to="/create"
                className="group inline-flex items-center gap-2.5 rounded-xl bg-primary px-6 py-3.5 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/25 transition-all hover:scale-105 hover:shadow-xl hover:shadow-primary/30"
              >
                <Plus className="h-4 w-4" />
                Toernooi Aanmaken
              </Link>
              <Link
                to="/search"
                className="inline-flex items-center gap-2.5 rounded-xl border border-foreground/20 bg-foreground/10 px-6 py-3.5 text-sm font-bold text-foreground backdrop-blur-sm transition-all hover:scale-105 hover:bg-foreground/20"
              >
                <Search className="h-4 w-4" />
                Zoek Toernooien
              </Link>
            </div>
          </div>

          {/* Stats bar */}
          <div className="mt-12 grid grid-cols-3 gap-4 sm:gap-8 border-t border-foreground/10 pt-8 max-w-lg">
            {[
              { value: "128", label: "Max Teams" },
              { value: "10", label: "Thema's" },
              { value: "∞", label: "Toernooien" },
            ].map((stat) => (
              <div key={stat.label} className="text-center sm:text-left">
                <p className="font-display text-2xl sm:text-3xl font-black text-primary">{stat.value}</p>
                <p className="text-xs sm:text-sm text-muted-foreground">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10">
        <ArrowDown className="h-5 w-5 text-muted-foreground animate-bounce" />
      </div>
    </section>
  );
};

export default HeroSection;
