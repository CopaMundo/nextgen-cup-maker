
ALTER TABLE public.tournament_scoring_systems
  ADD COLUMN IF NOT EXISTS points_big_win integer NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS big_win_threshold integer NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS points_win_overtime integer NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS points_draw_with_goals integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS points_draw_no_goals integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS points_loss_overtime integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS no_draws boolean NOT NULL DEFAULT false;
