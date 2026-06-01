
-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  display_name TEXT,
  avatar_url TEXT,
  organization TEXT,
  phone TEXT,
  country TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Profiles RLS
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);

-- Tournaments table
CREATE TYPE public.tournament_type AS ENUM ('classic', 'nextgen');
CREATE TYPE public.sport_type AS ENUM ('football');

CREATE TABLE public.tournaments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sport public.sport_type NOT NULL DEFAULT 'football',
  tournament_type public.tournament_type NOT NULL DEFAULT 'classic',
  is_multi_category BOOLEAN NOT NULL DEFAULT false,
  team_count INTEGER NOT NULL DEFAULT 4 CHECK (team_count >= 4 AND team_count <= 128),
  nextgen_size INTEGER, -- 12, 16, 24, 32 for nextgen
  nextgen_rounds INTEGER, -- 4-8 for nextgen phase 1
  view_link_token TEXT UNIQUE,
  view_link_active BOOLEAN NOT NULL DEFAULT false,
  enable_goalscorers BOOLEAN NOT NULL DEFAULT false,
  enable_assists BOOLEAN NOT NULL DEFAULT false,
  enable_yellow_cards BOOLEAN NOT NULL DEFAULT false,
  enable_red_cards BOOLEAN NOT NULL DEFAULT false,
  enable_fairplay BOOLEAN NOT NULL DEFAULT false,
  points_win INTEGER NOT NULL DEFAULT 3,
  points_draw INTEGER NOT NULL DEFAULT 1,
  points_loss INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_tournaments_updated_at
  BEFORE UPDATE ON public.tournaments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Helper: check tournament ownership (SECURITY DEFINER to avoid RLS recursion)
CREATE OR REPLACE FUNCTION public.is_tournament_owner(_user_id UUID, _tournament_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tournaments WHERE id = _tournament_id AND owner_id = _user_id
  );
$$;

-- Tournament RLS
CREATE POLICY "Owners can manage own tournaments" ON public.tournaments
  FOR ALL USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Public view via token" ON public.tournaments
  FOR SELECT USING (view_link_active = true AND view_link_token IS NOT NULL);

-- Categories
CREATE TABLE public.tournament_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tournament_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage categories" ON public.tournament_categories
  FOR ALL USING (public.is_tournament_owner(auth.uid(), tournament_id))
  WITH CHECK (public.is_tournament_owner(auth.uid(), tournament_id));

CREATE POLICY "Public view categories" ON public.tournament_categories
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.tournaments t WHERE t.id = tournament_id AND t.view_link_active = true AND t.view_link_token IS NOT NULL)
  );

-- Phases
CREATE TYPE public.phase_type AS ENUM ('group', 'knockout', 'round_robin');

CREATE TABLE public.tournament_phases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.tournament_categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phase_number INTEGER NOT NULL DEFAULT 1,
  phase_type public.phase_type NOT NULL DEFAULT 'group',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tournament_phases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage phases" ON public.tournament_phases
  FOR ALL USING (public.is_tournament_owner(auth.uid(), tournament_id))
  WITH CHECK (public.is_tournament_owner(auth.uid(), tournament_id));

CREATE POLICY "Public view phases" ON public.tournament_phases
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.tournaments t WHERE t.id = tournament_id AND t.view_link_active = true)
  );

-- Groups
CREATE TABLE public.groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phase_id UUID NOT NULL REFERENCES public.tournament_phases(id) ON DELETE CASCADE,
  tournament_id UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Groep A',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage groups" ON public.groups
  FOR ALL USING (public.is_tournament_owner(auth.uid(), tournament_id))
  WITH CHECK (public.is_tournament_owner(auth.uid(), tournament_id));

CREATE POLICY "Public view groups" ON public.groups
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.tournaments t WHERE t.id = tournament_id AND t.view_link_active = true)
  );

-- Teams
CREATE TABLE public.teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  logo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage teams" ON public.teams
  FOR ALL USING (public.is_tournament_owner(auth.uid(), tournament_id))
  WITH CHECK (public.is_tournament_owner(auth.uid(), tournament_id));

CREATE POLICY "Public view teams" ON public.teams
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.tournaments t WHERE t.id = tournament_id AND t.view_link_active = true)
  );

-- Group-team assignments with bonus points
CREATE TABLE public.group_teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  tournament_id UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  bonus_points INTEGER NOT NULL DEFAULT 0,
  UNIQUE(group_id, team_id)
);

ALTER TABLE public.group_teams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage group_teams" ON public.group_teams
  FOR ALL USING (public.is_tournament_owner(auth.uid(), tournament_id))
  WITH CHECK (public.is_tournament_owner(auth.uid(), tournament_id));

CREATE POLICY "Public view group_teams" ON public.group_teams
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.tournaments t WHERE t.id = tournament_id AND t.view_link_active = true)
  );

-- Matches
CREATE TABLE public.matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  phase_id UUID NOT NULL REFERENCES public.tournament_phases(id) ON DELETE CASCADE,
  group_id UUID REFERENCES public.groups(id) ON DELETE SET NULL,
  home_team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
  away_team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
  home_score INTEGER,
  away_score INTEGER,
  home_penalties INTEGER,
  away_penalties INTEGER,
  match_date DATE,
  match_time TIME,
  field TEXT,
  referee TEXT,
  round_number INTEGER,
  is_played BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage matches" ON public.matches
  FOR ALL USING (public.is_tournament_owner(auth.uid(), tournament_id))
  WITH CHECK (public.is_tournament_owner(auth.uid(), tournament_id));

CREATE POLICY "Public view matches" ON public.matches
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.tournaments t WHERE t.id = tournament_id AND t.view_link_active = true)
  );

-- Match stats (goalscorers, assists, cards)
CREATE TYPE public.stat_type AS ENUM ('goal', 'assist', 'yellow_card', 'red_card');

CREATE TABLE public.match_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  tournament_id UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  player_name TEXT NOT NULL,
  stat_type public.stat_type NOT NULL,
  minute INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.match_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage match_stats" ON public.match_stats
  FOR ALL USING (public.is_tournament_owner(auth.uid(), tournament_id))
  WITH CHECK (public.is_tournament_owner(auth.uid(), tournament_id));

CREATE POLICY "Public view match_stats" ON public.match_stats
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.tournaments t WHERE t.id = tournament_id AND t.view_link_active = true)
  );

-- Ranking rules config
CREATE TABLE public.ranking_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  phase_id UUID REFERENCES public.tournament_phases(id) ON DELETE CASCADE,
  rule_order JSONB NOT NULL DEFAULT '["goal_difference","goals_scored","wins","head_to_head","fairplay","bonus_points"]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ranking_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage ranking_rules" ON public.ranking_rules
  FOR ALL USING (public.is_tournament_owner(auth.uid(), tournament_id))
  WITH CHECK (public.is_tournament_owner(auth.uid(), tournament_id));

CREATE POLICY "Public view ranking_rules" ON public.ranking_rules
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.tournaments t WHERE t.id = tournament_id AND t.view_link_active = true)
  );

-- Standing color rules
CREATE TABLE public.standing_colors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  phase_id UUID REFERENCES public.tournament_phases(id) ON DELETE CASCADE,
  position_from INTEGER NOT NULL,
  position_to INTEGER NOT NULL,
  color TEXT NOT NULL DEFAULT '#3b82f6',
  label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.standing_colors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage standing_colors" ON public.standing_colors
  FOR ALL USING (public.is_tournament_owner(auth.uid(), tournament_id))
  WITH CHECK (public.is_tournament_owner(auth.uid(), tournament_id));

CREATE POLICY "Public view standing_colors" ON public.standing_colors
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.tournaments t WHERE t.id = tournament_id AND t.view_link_active = true)
  );

-- Phase progression rules
CREATE TABLE public.phase_progressions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  from_phase_id UUID NOT NULL REFERENCES public.tournament_phases(id) ON DELETE CASCADE,
  to_phase_id UUID NOT NULL REFERENCES public.tournament_phases(id) ON DELETE CASCADE,
  from_group_id UUID REFERENCES public.groups(id) ON DELETE SET NULL,
  to_group_id UUID REFERENCES public.groups(id) ON DELETE SET NULL,
  from_position INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.phase_progressions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage progressions" ON public.phase_progressions
  FOR ALL USING (public.is_tournament_owner(auth.uid(), tournament_id))
  WITH CHECK (public.is_tournament_owner(auth.uid(), tournament_id));

CREATE POLICY "Public view progressions" ON public.phase_progressions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.tournaments t WHERE t.id = tournament_id AND t.view_link_active = true)
  );

-- Storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('team-logos', 'team-logos', true);

-- Avatar storage policies
CREATE POLICY "Avatars publicly readable" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "Users upload own avatar" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users update own avatar" ON storage.objects FOR UPDATE USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users delete own avatar" ON storage.objects FOR DELETE USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Team logo storage policies
CREATE POLICY "Team logos publicly readable" ON storage.objects FOR SELECT USING (bucket_id = 'team-logos');
CREATE POLICY "Authenticated users upload logos" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'team-logos' AND auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users update logos" ON storage.objects FOR UPDATE USING (bucket_id = 'team-logos' AND auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users delete logos" ON storage.objects FOR DELETE USING (bucket_id = 'team-logos' AND auth.uid() IS NOT NULL);

-- Enable realtime for key tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.matches;
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_teams;
ALTER PUBLICATION supabase_realtime ADD TABLE public.match_stats;
