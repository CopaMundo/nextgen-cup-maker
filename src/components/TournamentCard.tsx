import { Trophy, ArrowRight, Calendar } from "lucide-react";

interface TournamentCardProps {
  name: string;
  teams: number;
  rounds: number;
  createdAt: string;
  type?: "classic" | "nextgen";
}

const TournamentCard = ({ name, teams, rounds, createdAt, type = "classic" }: TournamentCardProps) => {
  return (
    <div className="card-glow group cursor-pointer rounded-xl border border-border bg-card p-5 transition-all duration-300 hover:border-primary/30">
      <div className="flex items-start justify-between">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-primary">
          {teams} teams • {rounds} rondes
        </span>
        <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
      </div>

      <h3 className="mt-3 font-display text-lg font-bold text-foreground">
        {name}
      </h3>

      <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Calendar className="h-3.5 w-3.5" />
        Aangemaakt {createdAt}
      </div>
    </div>
  );
};

export default TournamentCard;
