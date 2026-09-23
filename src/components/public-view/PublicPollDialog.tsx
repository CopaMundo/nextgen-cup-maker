import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import PollIcon from "@/components/icons/PollIcon";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

interface PublicPollDialogProps {
  tournamentId: string;
  polls: any[];
  pollVotes: any[];
  onVoteAdded: (vote: any) => void;
}

const PublicPollDialog = ({ tournamentId, polls, pollVotes, onVoteAdded }: PublicPollDialogProps) => {
  const { toast } = useToast();
  const [submittingPollId, setSubmittingPollId] = useState<string | null>(null);
  const [votedPolls, setVotedPolls] = useState<Record<string, number>>(() => {
    try {
      return JSON.parse(localStorage.getItem(`poll-votes-${tournamentId}`) || "{}");
    } catch {
      return {};
    }
  });

  const sortedPolls = useMemo(() => [...polls].sort((a, b) => {
    const aVoted = votedPolls[a.id] !== undefined;
    const bVoted = votedPolls[b.id] !== undefined;
    if (aVoted !== bVoted) return aVoted ? 1 : -1;
    return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
  }), [polls, votedPolls]);

  const unansweredCount = polls.filter((poll) => votedPolls[poll.id] === undefined).length;

  const vote = async (pollId: string, optionIndex: number) => {
    if (votedPolls[pollId] !== undefined || submittingPollId) return;
    setSubmittingPollId(pollId);

    const voterId = localStorage.getItem("voter-id") || crypto.randomUUID();
    localStorage.setItem("voter-id", voterId);
    const { error } = await supabase.from("poll_votes").insert({
      poll_id: pollId,
      option_index: optionIndex,
      voter_id: voterId,
    });

    if (error) {
      setSubmittingPollId(null);
      toast({
        title: "Stem niet opgeslagen",
        description: "Probeer het opnieuw.",
        variant: "destructive",
      });
      return;
    }

    const updated = { ...votedPolls, [pollId]: optionIndex };
    setVotedPolls(updated);
    localStorage.setItem(`poll-votes-${tournamentId}`, JSON.stringify(updated));
    onVoteAdded({
      id: `local-${crypto.randomUUID()}`,
      poll_id: pollId,
      option_index: optionIndex,
      voter_id: voterId,
    });
    setSubmittingPollId(null);
  };

  if (polls.length === 0) return null;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="relative h-10 w-10 shrink-0 border-primary/40 bg-card text-primary shadow-sm"
          aria-label={`Polls openen${unansweredCount > 0 ? `, ${unansweredCount} nog niet beantwoord` : ""}`}
          title="Polls"
        >
          <PollIcon className="h-5 w-5" />
          {unansweredCount > 0 && (
            <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-destructive ring-2 ring-card" />
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[88dvh] overflow-hidden p-0 sm:max-w-xl" scrollable={false}>
        <DialogHeader className="border-b border-border px-4 pb-3 pt-4 pr-14 text-left sm:px-6 sm:pt-6">
          <DialogTitle className="font-display text-xl font-black uppercase text-foreground">Polls</DialogTitle>
          <DialogDescription>
            {unansweredCount > 0
              ? `${unansweredCount} ${unansweredCount === 1 ? "poll wacht" : "polls wachten"} nog op jouw stem.`
              : "Je hebt op alle polls gestemd."}
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[calc(88dvh-7rem)] space-y-3 overflow-y-auto overscroll-contain px-4 pb-5 sm:px-6 sm:pb-6">
          {sortedPolls.map((poll) => (
            <PublicPollCard
              key={poll.id}
              poll={poll}
              pollVotes={pollVotes}
              selectedOption={votedPolls[poll.id]}
              submitting={submittingPollId === poll.id}
              onVote={vote}
            />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};

interface PublicPollCardProps {
  poll: any;
  pollVotes: any[];
  selectedOption: number | undefined;
  submitting: boolean;
  onVote: (pollId: string, optionIndex: number) => void;
}

const PublicPollCard = ({ poll, pollVotes, selectedOption, submitting, onVote }: PublicPollCardProps) => {
  const options = Array.isArray(poll.options) ? poll.options : [];
  const votes = pollVotes.filter((vote) => vote.poll_id === poll.id);
  const totalVotes = votes.length;
  const hasVoted = selectedOption !== undefined;

  return (
    <section className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="border-b border-border px-4 py-3">
        <h3 className="text-sm font-bold text-foreground">{poll.question}</h3>
      </div>
      <div className="space-y-2 p-3">
        {options.map((option: string, index: number) => {
          const count = votes.filter((vote) => vote.option_index === index).length;
          const percentage = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
          const selected = selectedOption === index;

          return (
            <Button
              key={index}
              type="button"
              variant="outline"
              disabled={hasVoted || submitting}
              onClick={() => onVote(poll.id, index)}
              className={`relative h-auto min-h-10 w-full justify-start overflow-hidden px-3 py-2 text-left text-xs ${selected ? "border-primary" : ""}`}
            >
              {hasVoted && (
                <span
                  className="absolute inset-y-0 left-0 bg-primary/15 transition-[width] duration-300"
                  style={{ width: `${percentage}%` }}
                />
              )}
              <span className="relative flex w-full items-center justify-between gap-3">
                <span className="font-bold text-foreground">{option}</span>
                {hasVoted && <span className="shrink-0 font-black text-foreground">{percentage}%</span>}
              </span>
            </Button>
          );
        })}
        {hasVoted && (
          <p className="pt-1 text-[11px] font-bold text-muted-foreground">
            {totalVotes} {totalVotes === 1 ? "stem" : "stemmen"}
          </p>
        )}
      </div>
    </section>
  );
};

export default PublicPollDialog;