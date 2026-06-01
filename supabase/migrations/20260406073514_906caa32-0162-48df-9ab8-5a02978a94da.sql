ALTER TABLE public.tournaments ADD COLUMN planner_breaks jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.tournament_categories ADD COLUMN planner_breaks jsonb DEFAULT '[]'::jsonb;