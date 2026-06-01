ALTER TABLE public.tournaments ADD COLUMN IF NOT EXISTS date_mode text NOT NULL DEFAULT 'period';
ALTER TABLE public.tournaments ADD COLUMN IF NOT EXISTS match_days jsonb NOT NULL DEFAULT '[]'::jsonb;