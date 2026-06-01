
-- Add position to players
DO $$ BEGIN
  CREATE TYPE public.player_position AS ENUM ('goalkeeper', 'defender', 'midfielder', 'attacker');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.players ADD COLUMN IF NOT EXISTS position public.player_position;

-- Create staff table
CREATE TABLE IF NOT EXISTS public.staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  name text NOT NULL,
  role text NOT NULL DEFAULT 'Trainer',
  photo_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage staff" ON public.staff FOR ALL TO authenticated
  USING (is_tournament_owner(auth.uid(), tournament_id))
  WITH CHECK (is_tournament_owner(auth.uid(), tournament_id));

CREATE POLICY "Public view staff" ON public.staff FOR SELECT
  USING (EXISTS (SELECT 1 FROM tournaments t WHERE t.id = staff.tournament_id AND t.view_link_active = true));

-- Add dates to tournaments
ALTER TABLE public.tournaments ADD COLUMN IF NOT EXISTS start_date date;
ALTER TABLE public.tournaments ADD COLUMN IF NOT EXISTS end_date date;

-- Create tournament_locations table
CREATE TABLE IF NOT EXISTS public.tournament_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tournament_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage locations" ON public.tournament_locations FOR ALL TO authenticated
  USING (is_tournament_owner(auth.uid(), tournament_id))
  WITH CHECK (is_tournament_owner(auth.uid(), tournament_id));

CREATE POLICY "Public view locations" ON public.tournament_locations FOR SELECT
  USING (EXISTS (SELECT 1 FROM tournaments t WHERE t.id = tournament_locations.tournament_id AND t.view_link_active = true));

-- Add logo_url to groups
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS logo_url text;

-- Create polls table
CREATE TABLE IF NOT EXISTS public.tournament_polls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  question text NOT NULL,
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tournament_polls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage polls" ON public.tournament_polls FOR ALL TO authenticated
  USING (is_tournament_owner(auth.uid(), tournament_id))
  WITH CHECK (is_tournament_owner(auth.uid(), tournament_id));

CREATE POLICY "Public view polls" ON public.tournament_polls FOR SELECT
  USING (EXISTS (SELECT 1 FROM tournaments t WHERE t.id = tournament_polls.tournament_id AND t.view_link_active = true));

-- Poll votes
CREATE TABLE IF NOT EXISTS public.poll_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id uuid NOT NULL REFERENCES public.tournament_polls(id) ON DELETE CASCADE,
  option_index integer NOT NULL,
  voter_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(poll_id, voter_id)
);

ALTER TABLE public.poll_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can vote" ON public.poll_votes FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can view votes" ON public.poll_votes FOR SELECT USING (true);
