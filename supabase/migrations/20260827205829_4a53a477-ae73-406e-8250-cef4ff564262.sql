ALTER TABLE public.tournament_locations ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;
WITH ordered AS (
  SELECT id, row_number() OVER (PARTITION BY tournament_id ORDER BY created_at) - 1 AS rn
  FROM public.tournament_locations
)
UPDATE public.tournament_locations l SET sort_order = o.rn FROM ordered o WHERE o.id = l.id;