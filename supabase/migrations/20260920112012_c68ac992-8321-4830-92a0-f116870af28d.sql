CREATE TABLE public.draw_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tournament_id uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  phase_id uuid NOT NULL REFERENCES public.tournament_phases(id) ON DELETE CASCADE,
  category_id uuid REFERENCES public.tournament_categories(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'setup',
  is_test boolean NOT NULL DEFAULT true,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  state jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (phase_id)
);

GRANT SELECT ON public.draw_sessions TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.draw_sessions TO authenticated;
GRANT ALL ON public.draw_sessions TO service_role;

ALTER TABLE public.draw_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view draw sessions"
ON public.draw_sessions FOR SELECT
USING (true);

CREATE POLICY "Owners can insert draw sessions"
ON public.draw_sessions FOR INSERT TO authenticated
WITH CHECK (public.is_tournament_owner(auth.uid(), tournament_id));

CREATE POLICY "Owners can update draw sessions"
ON public.draw_sessions FOR UPDATE TO authenticated
USING (public.is_tournament_owner(auth.uid(), tournament_id))
WITH CHECK (public.is_tournament_owner(auth.uid(), tournament_id));

CREATE POLICY "Owners can delete draw sessions"
ON public.draw_sessions FOR DELETE TO authenticated
USING (public.is_tournament_owner(auth.uid(), tournament_id));

CREATE TRIGGER update_draw_sessions_updated_at
BEFORE UPDATE ON public.draw_sessions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.draw_reports (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tournament_id uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  phase_id uuid NOT NULL REFERENCES public.tournament_phases(id) ON DELETE CASCADE,
  report jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, DELETE ON public.draw_reports TO authenticated;
GRANT ALL ON public.draw_reports TO service_role;

ALTER TABLE public.draw_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view draw reports"
ON public.draw_reports FOR SELECT TO authenticated
USING (public.is_tournament_owner(auth.uid(), tournament_id));

CREATE POLICY "Owners can insert draw reports"
ON public.draw_reports FOR INSERT TO authenticated
WITH CHECK (public.is_tournament_owner(auth.uid(), tournament_id));

CREATE POLICY "Owners can delete draw reports"
ON public.draw_reports FOR DELETE TO authenticated
USING (public.is_tournament_owner(auth.uid(), tournament_id));

CREATE INDEX idx_draw_sessions_tournament ON public.draw_sessions(tournament_id);
CREATE INDEX idx_draw_reports_phase ON public.draw_reports(phase_id);

ALTER PUBLICATION supabase_realtime ADD TABLE public.draw_sessions;