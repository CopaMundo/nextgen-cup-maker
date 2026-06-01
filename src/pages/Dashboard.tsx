import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import ThemeSwitcher from "@/components/ThemeSwitcher";
import SportIcon from "@/components/SportIcon";
import { Button } from "@/components/ui/button";
import { Plus, Trophy, Calendar, Trash2 } from "lucide-react";
import SEOHead from "@/components/SEOHead";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Tournament {
  id: string;
  name: string;
  tournament_type: string;
  team_count: number;
  created_at: string;
  logo_url: string | null;
  cover_url: string | null;
  start_date: string | null;
  end_date: string | null;
  sport: string | null;
}

const Dashboard = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => { if (user) fetchTournaments(); }, [user]);

  const fetchTournaments = async () => {
    const { data } = await supabase
      .from("tournaments")
      .select("id, name, tournament_type, team_count, created_at, logo_url, cover_url, start_date, end_date, sport")
      .eq("owner_id", user!.id)
      .order("created_at", { ascending: false });
    if (data) setTournaments(data as any);
    setLoading(false);
  };

  const confirmDelete = async () => {
    if (!deleteId) return;

    // Clean up storage files first
    const cleanupBucket = async (bucket: string, prefix: string) => {
      const { data: files } = await supabase.storage.from(bucket).list(prefix, { limit: 1000 });
      if (files && files.length > 0) {
        const paths = files.map(f => `${prefix}/${f.name}`);
        await supabase.storage.from(bucket).remove(paths);
      }
      // Also check subfolders (players/, staff/, sponsors/)
      for (const sub of ["players", "staff", "sponsors"]) {
        const { data: subFiles } = await supabase.storage.from(bucket).list(`${prefix}/${sub}`, { limit: 1000 });
        if (subFiles && subFiles.length > 0) {
          const subPaths = subFiles.map(f => `${prefix}/${sub}/${f.name}`);
          await supabase.storage.from(bucket).remove(subPaths);
        }
      }
    };

    await Promise.all([
      cleanupBucket("team-logos", deleteId),
      cleanupBucket("tournament-attachments", deleteId),
    ]);

    const { error } = await supabase.from("tournaments").delete().eq("id", deleteId);
    if (error) {
      toast({ title: "Verwijderen mislukt", description: error.message, variant: "destructive" });
    } else {
      setTournaments(t => t.filter(x => x.id !== deleteId));
      toast({ title: "Toernooi verwijderd" });
    }
    setDeleteId(null);
  };

  return (
    <div className="min-h-screen bg-background">
      <SEOHead title="Mijn Toernooien – Copa Mundo" description="Beheer je toernooien op Copa Mundo." noIndex />
      <Navbar />
      <ThemeSwitcher />
      <div className="px-4 sm:px-6 py-8 w-full">
        <div className="flex items-center justify-between mb-8">
          <h1 className="font-display text-3xl font-bold text-foreground">Mijn Toernooien</h1>
          <Link to="/create">
            <Button><Plus className="h-4 w-4" /> Nieuw Toernooi</Button>
          </Link>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : tournaments.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-primary/30 py-16">
            <Trophy className="h-12 w-12 text-primary mb-4" />
            <h2 className="font-display text-xl font-bold text-foreground">Nog geen toernooien</h2>
            <p className="mt-2 text-muted-foreground mb-6">Maak je eerste toernooi aan om te beginnen</p>
            <Link to="/create"><Button><Plus className="h-4 w-4" /> Toernooi Aanmaken</Button></Link>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {tournaments.map(t => (
              <Link key={t.id} to={`/tournament/${t.id}`} className="group">
                <div className="card-glow rounded-xl border border-border bg-card overflow-hidden transition-all duration-300 hover:border-primary/40">
                  {/* Cover photo */}
                  {t.cover_url ? (
                    <div className="h-32 w-full overflow-hidden">
                      <img src={t.cover_url} alt="" className="h-full w-full object-cover" />
                    </div>
                  ) : (
                    <div className="h-32 w-full bg-gradient-to-br from-primary/20 to-accent/10" />
                  )}
                  <div className="p-4 pt-0">
                    <div className="flex items-start gap-3 -mt-10">
                      {/* Logo overlapping cover */}
                      <div className="h-20 w-20 shrink-0 rounded-lg border-4 border-card bg-card overflow-hidden shadow-md">
                        {t.logo_url ? (
                          <img src={t.logo_url} alt="" className="h-full w-full object-contain bg-card" />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center bg-muted">
                            <Trophy className="h-7 w-7 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0 pt-11">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-display text-lg font-bold text-foreground truncate">{t.name}</h3>
                          <button
                            onClick={e => { e.preventDefault(); setDeleteId(t.id); }}
                            className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                        {t.tournament_type === "nextgen" && (
                          <div className="mt-0.5 text-xs font-semibold uppercase tracking-wider">
                            <span className="text-gradient-brand">Copa Mundo</span>
                          </div>
                        )}
                        {t.sport && (
                          <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                            <SportIcon sport={t.sport} size={14} white />
                            <span>{t.sport}</span>
                          </div>
                        )}
                        <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Calendar className="h-3.5 w-3.5" />
                          {t.start_date ? new Date(t.start_date).toLocaleDateString("nl-NL") : new Date(t.created_at).toLocaleDateString("nl-NL")}
                          {t.end_date && ` – ${new Date(t.end_date).toLocaleDateString("nl-NL")}`}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => { if (!open) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Toernooi verwijderen?</AlertDialogTitle>
            <AlertDialogDescription>
              Dit verwijdert het toernooi en alle bijbehorende data permanent. Dit kan niet ongedaan worden gemaakt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Verwijderen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Dashboard;
