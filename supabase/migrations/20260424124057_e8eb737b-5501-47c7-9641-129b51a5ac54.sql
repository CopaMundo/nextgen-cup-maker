ALTER TABLE public.tournaments
ADD COLUMN IF NOT EXISTS format_display_mode text NOT NULL DEFAULT 'tabs';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tournaments_format_display_mode_check'
      AND conrelid = 'public.tournaments'::regclass
  ) THEN
    ALTER TABLE public.tournaments
    ADD CONSTRAINT tournaments_format_display_mode_check
    CHECK (format_display_mode IN ('tabs', 'stacked'));
  END IF;
END $$;