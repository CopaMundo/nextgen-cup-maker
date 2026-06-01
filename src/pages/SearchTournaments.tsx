import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import ThemeSwitcher from "@/components/ThemeSwitcher";
import { Input } from "@/components/ui/input";
import { Search, Trophy, Calendar, Users } from "lucide-react";
import SEOHead from "@/components/SEOHead";

const SearchTournaments = () => {
  const [query, setQuery] = useState("");
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPublicTournaments();
  }, []);

  const fetchPublicTournaments = async () => {
    const { data } = await supabase
      .from("tournaments")
      .select("id, name, description, logo_url, cover_url, team_count, start_date, end_date, sport, tournament_type, view_link_active, view_link_token")
      .eq("is_public", true)
      .order("created_at", { ascending: false });
    if (data) setTournaments(data);
    setLoading(false);
  };

  const filtered = tournaments.filter((t) =>
    t.name.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background">
      <SEOHead title="Zoek toernooien – Copa Mundo" description="Ontdek en volg publieke voetbaltoernooien op Copa Mundo. Bekijk standen, uitslagen en programma's." canonical="/search" />
      <Navbar />
      <ThemeSwitcher />
      <div className="px-4 sm:px-6 py-6 sm:py-8 w-full">
        <div className="max-w-4xl mx-auto space-y-6">
          <div>
            <h1 className="font-display text-3xl sm:text-4xl font-black text-foreground">
              Zoek toernooien
            </h1>
            <p className="text-muted-foreground mt-1">
              Ontdek publieke toernooien en volg ze live.
            </p>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Zoek op naam..."
              className="pl-10"
            />
          </div>

          {loading ? (
            <div className="flex justify-center py-16">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-foreground border-t-transparent" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16">
              <Trophy className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground">
                {query
                  ? "Geen toernooien gevonden voor deze zoekopdracht."
                  : "Er zijn nog geen publieke toernooien."}
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {filtered.map((t) => (
                <a
                  key={t.id}
                  href={
                    t.view_link_active && t.view_link_token
                      ? `/view/${t.view_link_token}`
                      : "#"
                  }
                  className={`group rounded-xl border border-border bg-card overflow-hidden transition-all hover:border-primary/30 hover:shadow-lg ${
                    !t.view_link_active ? "opacity-60 pointer-events-none" : ""
                  }`}
                >
                  {t.cover_url ? (
                    <div className="h-32 bg-secondary">
                      <img
                        src={t.cover_url}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="h-32 bg-secondary flex items-center justify-center">
                      <Trophy className="h-10 w-10 text-muted-foreground/20" />
                    </div>
                  )}
                  <div className="p-4 space-y-2">
                    <div className="flex items-center gap-3">
                      {t.logo_url && (
                        <img
                          src={t.logo_url}
                          alt=""
                          className="h-10 w-10 rounded-lg object-contain bg-secondary flex-shrink-0"
                        />
                      )}
                      <div className="min-w-0">
                        <h3 className="font-display font-bold text-foreground truncate group-hover:text-primary transition-colors">
                          {t.name}
                        </h3>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" /> {t.team_count} teams
                          </span>
                          {t.start_date && (
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" /> {t.start_date}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    {t.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {t.description}
                      </p>
                    )}
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SearchTournaments;
