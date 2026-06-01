
ALTER TABLE public.tournament_phases ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;
ALTER TABLE public.tournament_phases ADD COLUMN IF NOT EXISTS emoji text;
