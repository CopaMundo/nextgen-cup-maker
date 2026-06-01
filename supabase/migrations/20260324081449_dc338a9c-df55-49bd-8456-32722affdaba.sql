ALTER TABLE public.tournament_categories
  ADD COLUMN fields jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN referees jsonb DEFAULT '[]'::jsonb;