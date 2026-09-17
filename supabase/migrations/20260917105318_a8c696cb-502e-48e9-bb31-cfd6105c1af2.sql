CREATE TABLE public.draw_pots (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tournament_id uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  phase_id uuid NOT NULL REFERENCES public.tournament_phases(id) ON DELETE CASCADE,
  category_id uuid REFERENCES public.tournament_categories(id) ON DELETE CASCADE,
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.draw_pots TO authenticated;
GRANT ALL ON public.draw_pots TO service_role;

ALTER TABLE public.draw_pots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage their draw pots"
ON public.draw_pots FOR ALL TO authenticated
USING (public.is_tournament_owner(auth.uid(), tournament_id))
WITH CHECK (public.is_tournament_owner(auth.uid(), tournament_id));

CREATE TRIGGER update_draw_pots_updated_at
BEFORE UPDATE ON public.draw_pots
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.draw_pot_teams (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pot_id uuid NOT NULL REFERENCES public.draw_pots(id) ON DELETE CASCADE,
  tournament_id uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (pot_id, team_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.draw_pot_teams TO authenticated;
GRANT ALL ON public.draw_pot_teams TO service_role;

ALTER TABLE public.draw_pot_teams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage their draw pot teams"
ON public.draw_pot_teams FOR ALL TO authenticated
USING (public.is_tournament_owner(auth.uid(), tournament_id))
WITH CHECK (public.is_tournament_owner(auth.uid(), tournament_id));

CREATE INDEX idx_draw_pots_phase ON public.draw_pots(phase_id);
CREATE INDEX idx_draw_pot_teams_pot ON public.draw_pot_teams(pot_id);