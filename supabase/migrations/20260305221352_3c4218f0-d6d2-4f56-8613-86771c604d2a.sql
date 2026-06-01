
CREATE TABLE public.slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  phase_id uuid NOT NULL REFERENCES tournament_phases(id) ON DELETE CASCADE,
  group_id uuid REFERENCES groups(id) ON DELETE CASCADE,
  slot_code text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  team_id uuid REFERENCES teams(id) ON DELETE SET NULL,
  ref_phase_id uuid REFERENCES tournament_phases(id) ON DELETE SET NULL,
  ref_group_id uuid REFERENCES groups(id) ON DELETE SET NULL,
  ref_position integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage slots" ON public.slots FOR ALL
  USING (is_tournament_owner(auth.uid(), tournament_id))
  WITH CHECK (is_tournament_owner(auth.uid(), tournament_id));

CREATE POLICY "Public view slots" ON public.slots FOR SELECT
  USING (EXISTS (SELECT 1 FROM tournaments t WHERE t.id = slots.tournament_id AND t.view_link_active = true));
