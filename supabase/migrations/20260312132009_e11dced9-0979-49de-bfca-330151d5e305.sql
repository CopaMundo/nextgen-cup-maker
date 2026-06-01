ALTER TABLE public.tournaments ADD COLUMN IF NOT EXISTS cover_url text DEFAULT NULL;

CREATE TABLE IF NOT EXISTS public.tournament_sponsors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  logo_url text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.tournament_sponsors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage sponsors" ON public.tournament_sponsors FOR ALL TO public USING (is_tournament_owner(auth.uid(), tournament_id)) WITH CHECK (is_tournament_owner(auth.uid(), tournament_id));
CREATE POLICY "Public view sponsors" ON public.tournament_sponsors FOR SELECT TO public USING (EXISTS (SELECT 1 FROM tournaments t WHERE t.id = tournament_sponsors.tournament_id AND t.view_link_active = true));