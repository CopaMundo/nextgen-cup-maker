
-- Add abbreviation and country to teams
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS abbreviation text;
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS country text;

-- Add status, logo_url, show_country to tournaments
ALTER TABLE public.tournaments ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'concept';
ALTER TABLE public.tournaments ADD COLUMN IF NOT EXISTS logo_url text;
ALTER TABLE public.tournaments ADD COLUMN IF NOT EXISTS show_country boolean NOT NULL DEFAULT false;

-- Create players table
CREATE TABLE public.players (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  tournament_id uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  first_name text NOT NULL,
  last_name text NOT NULL,
  shirt_number integer,
  photo_url text,
  birth_date date,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage players" ON public.players
  FOR ALL TO authenticated
  USING (is_tournament_owner(auth.uid(), tournament_id))
  WITH CHECK (is_tournament_owner(auth.uid(), tournament_id));

CREATE POLICY "Public view players" ON public.players
  FOR SELECT TO anon, authenticated
  USING (EXISTS (
    SELECT 1 FROM tournaments t
    WHERE t.id = players.tournament_id AND t.view_link_active = true
  ));
