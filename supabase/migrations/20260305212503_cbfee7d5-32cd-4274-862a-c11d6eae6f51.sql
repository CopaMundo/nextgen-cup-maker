ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS home_slot_label text;
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS away_slot_label text;