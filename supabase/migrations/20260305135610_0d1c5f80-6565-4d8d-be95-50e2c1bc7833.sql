
-- Add team_photo_url to teams table
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS team_photo_url text;

-- Add single_match to phase_type enum
ALTER TYPE public.phase_type ADD VALUE IF NOT EXISTS 'single_match';
