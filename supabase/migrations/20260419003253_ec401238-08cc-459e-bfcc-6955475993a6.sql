-- Add scoring_system_id to tournament_phases
ALTER TABLE public.tournament_phases
ADD COLUMN scoring_system_id uuid REFERENCES public.tournament_scoring_systems(id) ON DELETE RESTRICT;

CREATE INDEX idx_tournament_phases_scoring_system ON public.tournament_phases(scoring_system_id) WHERE scoring_system_id IS NOT NULL;

-- Add scoring_system_id to groups
ALTER TABLE public.groups
ADD COLUMN scoring_system_id uuid REFERENCES public.tournament_scoring_systems(id) ON DELETE RESTRICT;

CREATE INDEX idx_groups_scoring_system ON public.groups(scoring_system_id) WHERE scoring_system_id IS NOT NULL;

-- Add scoring_system_id to matches
ALTER TABLE public.matches
ADD COLUMN scoring_system_id uuid REFERENCES public.tournament_scoring_systems(id) ON DELETE RESTRICT;

CREATE INDEX idx_matches_scoring_system ON public.matches(scoring_system_id) WHERE scoring_system_id IS NOT NULL;