import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useDialogFocus } from "@/hooks/useDialogFocus";
import { Plus, Trash2, BarChart3, X } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Poll {
  id: string;
  question: string;
  options: string[];
  active: boolean;
  created_at: string;
}

interface PollVote {
  poll_id: string;
  option_index: number;
}

const PollManager = ({ tournamentId, tournament }: { tournamentId: string; tournament: any }) => {
  const [polls, setPolls] = useState<Poll[]>([]);
  const [votes, setVotes] = useState<PollVote[]>([]);
  const [loading, setLoading] = useState(true);
  const [newQuestion, setNewQuestion] = useState("");
  const [newOptions, setNewOptions] = useState(["", ""]);
  const [showAdd, setShowAdd] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const { toast } = useToast();
  const addDialogRef = useDialogFocus(showAdd);

  useEffect(() => { fetchData(); }, [tournamentId]);

  const fetchData = async () => {
    const [pRes, vRes] = await Promise.all([
      supabase.from("tournament_polls").select("id, question, options, active, created_at").eq("tournament_id", tournamentId).order("created_at", { ascending: false }),
      supabase.from("poll_votes").select("poll_id, option_index"),
    ]);
    if (pRes.data) setPolls(pRes.data.map((p: any) => ({ ...p, options: Array.isArray(p.options) ? p.options : [] })));
    if (vRes.data) setVotes(vRes.data);
    setLoading(false);
  };

  const addPoll = async () => {
    const validOptions = newOptions.filter(o => o.trim());
    if (!newQuestion.trim() || validOptions.length < 2) {
      toast({ title: "Vul een vraag en minstens 2 antwoorden in", variant: "destructive" });
      return;
    }
    const { data, error } = await supabase
      .from("tournament_polls")
      .insert({ tournament_id: tournamentId, question: newQuestion.trim(), options: validOptions as any, active: true })
      .select("id, question, options, active, created_at")
      .single();
    if (error) {
      toast({ title: "Fout", description: error.message, variant: "destructive" });
    } else if (data) {
      setPolls(p => [{ ...data, options: Array.isArray(data.options) ? data.options : [] } as Poll, ...p]);
      setNewQuestion("");
      setNewOptions(["", ""]);
      setShowAdd(false);
      toast({ title: "Poll aangemaakt" });
    }
  };

  const toggleActive = async (id: string, active: boolean) => {
    await supabase.from("tournament_polls").update({ active }).eq("id", id);
    setPolls(p => p.map(x => x.id === id ? { ...x, active } : x));
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    await supabase.from("poll_votes").delete().eq("poll_id", deleteId);
    await supabase.from("tournament_polls").delete().eq("id", deleteId);
    setPolls(p => p.filter(x => x.id !== deleteId));
    setDeleteId(null);
    toast({ title: "Poll verwijderd" });
  };

  const getVotesForPoll = (pollId: string) => votes.filter(v => v.poll_id === pollId);

  if (loading) return <div className="flex justify-center py-8"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;

  return (
    <div className="space-y-6 w-full">
      {/* Section header tab bar (matches Statistics/Sponsors pattern) */}
      <div className="flex justify-center border-b border-border flex-wrap">
        <div className="px-6 py-3 text-sm font-semibold uppercase tracking-wide text-primary relative after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:bg-primary">
          Polls
        </div>
      </div>

      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          {polls.length} {polls.length === 1 ? "poll" : "polls"}
          {!tournament.view_link_active && " · Activeer eerst de view-link bij Presentatie zodat bezoekers kunnen stemmen."}
        </p>

        <div className="space-y-3">
          {polls.map(poll => {
            const pollVotes = getVotesForPoll(poll.id);
            const totalVotes = pollVotes.length;
            return (
              <div key={poll.id} className="rounded-xl border border-border bg-card p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-medium text-foreground">{poll.question}</h3>
                    <span className="text-xs text-muted-foreground">{totalVotes} stem{totalVotes !== 1 ? "men" : ""}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-muted-foreground">{poll.active ? "Actief" : "Uit"}</span>
                      <Switch checked={poll.active} onCheckedChange={(v) => toggleActive(poll.id, v)} />
                    </div>
                    <button onClick={() => setDeleteId(poll.id)} className="text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  {poll.options.map((option, i) => {
                    const optVotes = pollVotes.filter(v => v.option_index === i).length;
                    const pct = totalVotes > 0 ? Math.round((optVotes / totalVotes) * 100) : 0;
                    return (
                      <div key={i} className="relative overflow-hidden rounded bg-background border border-border">
                        <div className="absolute inset-0 bg-primary/10 transition-all" style={{ width: `${pct}%` }} />
                        <div className="relative flex items-center justify-between px-3 py-1.5">
                          <span className="text-sm text-foreground">{option}</span>
                          <span className="text-xs font-medium text-muted-foreground">{optVotes} ({pct}%)</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Full-width add tile (matches Teams pattern) */}
          <button
            onClick={() => setShowAdd(true)}
            className="w-full rounded-xl border border-border bg-card p-4 flex flex-col items-center justify-center gap-2 hover:bg-accent hover:text-accent-foreground transition-colors min-h-[120px]"
          >
            <Plus className="h-6 w-6 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Poll toevoegen</span>
          </button>
        </div>
      </div>

      {/* Add poll modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/70 p-3 sm:p-4" onClick={() => setShowAdd(false)}>
          <div ref={addDialogRef} className="relative w-full max-w-md max-h-[85dvh] overflow-y-auto overscroll-contain rounded-2xl border border-border bg-card p-4 sm:p-6 space-y-4 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 className="font-display text-lg font-bold text-foreground">Poll toevoegen</h3>
            <div className="space-y-1">
              <Label className="text-xs">Vraag</Label>
              <Input value={newQuestion} onChange={(e) => setNewQuestion(e.target.value)} placeholder="Bijv. Wie wint het toernooi?" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Antwoorden ({newOptions.length}/128)</Label>
              <div className="max-h-60 overflow-y-auto space-y-1">
                {newOptions.map((opt, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <Input
                      value={opt}
                      onChange={(e) => setNewOptions(o => o.map((x, j) => j === i ? e.target.value : x))}
                      placeholder={`Antwoord ${i + 1}`}
                      className="h-8 text-sm"
                    />
                    {newOptions.length > 2 && (
                      <button onClick={() => setNewOptions(o => o.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-destructive">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {newOptions.length < 128 && (
                <Button variant="ghost" size="sm" onClick={() => setNewOptions(o => [...o, ""])} className="text-xs">
                  <Plus className="h-3 w-3" /> Antwoord
                </Button>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowAdd(false)}>Annuleren</Button>
              <Button onClick={addPoll} className="bg-foreground text-background hover:bg-foreground/90">Aanmaken</Button>
            </div>
          </div>
        </div>
      )}

      <AlertDialog open={!!deleteId} onOpenChange={(open) => { if (!open) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Poll verwijderen?</AlertDialogTitle>
            <AlertDialogDescription>De poll en alle stemmen worden permanent verwijderd.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground">Verwijderen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default PollManager;
