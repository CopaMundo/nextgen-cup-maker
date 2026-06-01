import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ArrowUp, ArrowDown, Save } from "lucide-react";
import { Button } from "@/components/ui/button";

const TIEBREAKER_OPTIONS = [
  { value: "goal_difference", label: "Doelpuntensaldo" },
  { value: "goals_scored", label: "Doelpunten gemaakt" },
  { value: "head_to_head", label: "Onderling duel" },
  { value: "least_cards", label: "Minst kaarten" },
  { value: "wins", label: "Meeste overwinningen" },
  { value: "drawing_lots", label: "Loting" },
];

const TiebreakerManager = ({ tournamentId }: { tournamentId: string }) => {
  const [rules, setRules] = useState<string[]>(["goal_difference", "goals_scored", "head_to_head", "wins"]);
  const [ruleId, setRuleId] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    supabase
      .from("ranking_rules")
      .select("id, rule_order")
      .eq("tournament_id", tournamentId)
      .is("phase_id", null)
      .limit(1)
      .then(({ data }) => {
        if (data && data.length > 0) {
          setRuleId(data[0].id);
          const order = data[0].rule_order;
          if (Array.isArray(order)) setRules(order as string[]);
        }
      });
  }, [tournamentId]);

  const moveUp = (idx: number) => {
    if (idx === 0) return;
    const next = [...rules];
    [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
    setRules(next);
  };

  const moveDown = (idx: number) => {
    if (idx === rules.length - 1) return;
    const next = [...rules];
    [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
    setRules(next);
  };

  const save = async () => {
    if (ruleId) {
      await supabase.from("ranking_rules").update({ rule_order: rules as any }).eq("id", ruleId);
    } else {
      const { data } = await supabase
        .from("ranking_rules")
        .insert({ tournament_id: tournamentId, rule_order: rules as any })
        .select("id")
        .single();
      if (data) setRuleId(data.id);
    }
    toast({ title: "Rangschikkingsregels opgeslagen" });
  };

  const getLabel = (v: string) => TIEBREAKER_OPTIONS.find((o) => o.value === v)?.label || v;

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">Bepaal de volgorde van criteria bij gelijke punten.</p>
      {rules.map((rule, idx) => (
        <div key={rule} className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2">
          <span className="text-xs font-bold text-muted-foreground w-5">{idx + 1}.</span>
          <span className="text-sm text-foreground flex-1">{getLabel(rule)}</span>
          <button onClick={() => moveUp(idx)} disabled={idx === 0} className="text-muted-foreground hover:text-foreground disabled:opacity-30">
            <ArrowUp className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => moveDown(idx)} disabled={idx === rules.length - 1} className="text-muted-foreground hover:text-foreground disabled:opacity-30">
            <ArrowDown className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={save}>
        <Save className="h-3.5 w-3.5" /> Opslaan
      </Button>
    </div>
  );
};

export default TiebreakerManager;
