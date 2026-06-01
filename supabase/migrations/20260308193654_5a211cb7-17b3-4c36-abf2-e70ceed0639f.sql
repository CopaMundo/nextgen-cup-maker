
-- Add category_id to teams for multi-division support
ALTER TABLE public.teams ADD COLUMN category_id uuid REFERENCES public.tournament_categories(id) ON DELETE SET NULL;

-- Add match_name to matches for named bracket matches
ALTER TABLE public.matches ADD COLUMN match_name text;
