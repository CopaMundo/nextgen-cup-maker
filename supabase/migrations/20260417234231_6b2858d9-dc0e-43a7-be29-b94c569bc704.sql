-- Create scoring systems table
CREATE TABLE public.tournament_scoring_systems (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tournament_id UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Puntentelling 1',
  sort_order INTEGER NOT NULL DEFAULT 0,
  scoring_type TEXT NOT NULL DEFAULT 'points',
  points_win INTEGER NOT NULL DEFAULT 3,
  points_draw INTEGER NOT NULL DEFAULT 1,
  points_loss INTEGER NOT NULL DEFAULT 0,
  tiebreaker_rules JSONB NOT NULL DEFAULT '["goal_difference", "goals_scored", "head_to_head"]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_scoring_systems_tournament ON public.tournament_scoring_systems(tournament_id, sort_order);

ALTER TABLE public.tournament_scoring_systems ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage scoring systems"
ON public.tournament_scoring_systems
FOR ALL
USING (is_tournament_owner(auth.uid(), tournament_id))
WITH CHECK (is_tournament_owner(auth.uid(), tournament_id));

CREATE POLICY "Public view scoring systems"
ON public.tournament_scoring_systems
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.tournaments t
  WHERE t.id = tournament_scoring_systems.tournament_id AND t.view_link_active = true
));

-- Migrate existing tournaments: create a "Puntentelling 1" record for each, copying current values
INSERT INTO public.tournament_scoring_systems (tournament_id, name, sort_order, scoring_type, points_win, points_draw, points_loss, tiebreaker_rules)
SELECT 
  t.id,
  'Puntentelling 1',
  0,
  COALESCE(t.scoring_type, 'points'),
  COALESCE(t.points_win, 3),
  COALESCE(t.points_draw, 1),
  COALESCE(t.points_loss, 0),
  COALESCE(
    (SELECT rr.rule_order FROM public.ranking_rules rr 
     WHERE rr.tournament_id = t.id AND rr.phase_id IS NULL 
     ORDER BY rr.created_at LIMIT 1),
    '["goal_difference", "goals_scored", "head_to_head"]'::jsonb
  )
FROM public.tournaments t;