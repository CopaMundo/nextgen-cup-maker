ALTER TABLE public.tournament_scoring_systems
  ADD COLUMN IF NOT EXISTS num_sets integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS playoff_mode boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS decisive_set boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS decisive_set_goal_diff boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS set_points_mode text NOT NULL DEFAULT 'per_set',
  ADD COLUMN IF NOT EXISTS set_result_points jsonb NOT NULL DEFAULT '{}';
