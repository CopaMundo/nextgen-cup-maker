ALTER TABLE public.tournament_slideshows
ADD COLUMN IF NOT EXISTS category_id uuid;

CREATE INDEX IF NOT EXISTS idx_tournament_slideshows_category
  ON public.tournament_slideshows (tournament_id, category_id);