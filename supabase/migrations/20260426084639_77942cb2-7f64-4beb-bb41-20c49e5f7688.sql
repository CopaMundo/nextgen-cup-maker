CREATE TABLE public.tournament_slideshows (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tournament_id uuid NOT NULL,
  name text NOT NULL DEFAULT 'Diavoorstelling 1',
  sort_order integer NOT NULL DEFAULT 0,
  slides jsonb NOT NULL DEFAULT '[]'::jsonb,
  sponsor_bar jsonb NOT NULL DEFAULT '{"enabled": true}'::jsonb,
  options jsonb NOT NULL DEFAULT '{"showTournamentName": true, "showCurrentTime": true, "defaultDurationSec": 15}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.tournament_slideshows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage slideshows"
ON public.tournament_slideshows
FOR ALL
USING (public.is_tournament_owner(auth.uid(), tournament_id))
WITH CHECK (public.is_tournament_owner(auth.uid(), tournament_id));

CREATE POLICY "Public view slideshows"
ON public.tournament_slideshows
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.tournaments t
  WHERE t.id = tournament_slideshows.tournament_id
    AND t.view_link_active = true
));

CREATE TRIGGER update_tournament_slideshows_updated_at
BEFORE UPDATE ON public.tournament_slideshows
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();

CREATE INDEX idx_tournament_slideshows_tournament ON public.tournament_slideshows(tournament_id, sort_order);