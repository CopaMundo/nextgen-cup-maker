ALTER TABLE public.tournaments
ADD COLUMN IF NOT EXISTS show_public_top_scorers boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS show_public_assists boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS show_public_fairplay boolean NOT NULL DEFAULT false;