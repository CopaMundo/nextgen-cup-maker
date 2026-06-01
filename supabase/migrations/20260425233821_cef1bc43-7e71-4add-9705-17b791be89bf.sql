ALTER TABLE public.tournaments
ADD COLUMN IF NOT EXISTS slideshow_config jsonb NOT NULL DEFAULT '{"slides": [], "sponsorBar": {"enabled": true, "mode": "scroll"}, "defaultDurationSec": 15}'::jsonb;