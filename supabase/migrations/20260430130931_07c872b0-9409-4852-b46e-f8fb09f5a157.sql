ALTER TABLE public.group_teams 
ADD COLUMN IF NOT EXISTS fairplay_points integer NOT NULL DEFAULT 0;