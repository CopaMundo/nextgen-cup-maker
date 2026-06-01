
-- Drop and recreate all foreign keys referencing tournaments with ON DELETE CASCADE

-- teams
ALTER TABLE public.teams DROP CONSTRAINT IF EXISTS teams_tournament_id_fkey;
ALTER TABLE public.teams ADD CONSTRAINT teams_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id) ON DELETE CASCADE;

-- players
ALTER TABLE public.players DROP CONSTRAINT IF EXISTS players_tournament_id_fkey;
ALTER TABLE public.players ADD CONSTRAINT players_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id) ON DELETE CASCADE;

-- staff
ALTER TABLE public.staff DROP CONSTRAINT IF EXISTS staff_tournament_id_fkey;
ALTER TABLE public.staff ADD CONSTRAINT staff_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id) ON DELETE CASCADE;

-- matches
ALTER TABLE public.matches DROP CONSTRAINT IF EXISTS matches_tournament_id_fkey;
ALTER TABLE public.matches ADD CONSTRAINT matches_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id) ON DELETE CASCADE;

-- match_stats
ALTER TABLE public.match_stats DROP CONSTRAINT IF EXISTS match_stats_tournament_id_fkey;
ALTER TABLE public.match_stats ADD CONSTRAINT match_stats_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id) ON DELETE CASCADE;

-- groups
ALTER TABLE public.groups DROP CONSTRAINT IF EXISTS groups_tournament_id_fkey;
ALTER TABLE public.groups ADD CONSTRAINT groups_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id) ON DELETE CASCADE;

-- group_teams
ALTER TABLE public.group_teams DROP CONSTRAINT IF EXISTS group_teams_tournament_id_fkey;
ALTER TABLE public.group_teams ADD CONSTRAINT group_teams_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id) ON DELETE CASCADE;

-- tournament_phases
ALTER TABLE public.tournament_phases DROP CONSTRAINT IF EXISTS tournament_phases_tournament_id_fkey;
ALTER TABLE public.tournament_phases ADD CONSTRAINT tournament_phases_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id) ON DELETE CASCADE;

-- phase_progressions
ALTER TABLE public.phase_progressions DROP CONSTRAINT IF EXISTS phase_progressions_tournament_id_fkey;
ALTER TABLE public.phase_progressions ADD CONSTRAINT phase_progressions_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id) ON DELETE CASCADE;

-- slots
ALTER TABLE public.slots DROP CONSTRAINT IF EXISTS slots_tournament_id_fkey;
ALTER TABLE public.slots ADD CONSTRAINT slots_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id) ON DELETE CASCADE;

-- standing_colors
ALTER TABLE public.standing_colors DROP CONSTRAINT IF EXISTS standing_colors_tournament_id_fkey;
ALTER TABLE public.standing_colors ADD CONSTRAINT standing_colors_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id) ON DELETE CASCADE;

-- tournament_sponsors
ALTER TABLE public.tournament_sponsors DROP CONSTRAINT IF EXISTS tournament_sponsors_tournament_id_fkey;
ALTER TABLE public.tournament_sponsors ADD CONSTRAINT tournament_sponsors_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id) ON DELETE CASCADE;

-- tournament_categories
ALTER TABLE public.tournament_categories DROP CONSTRAINT IF EXISTS tournament_categories_tournament_id_fkey;
ALTER TABLE public.tournament_categories ADD CONSTRAINT tournament_categories_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id) ON DELETE CASCADE;

-- tournament_attachments
ALTER TABLE public.tournament_attachments DROP CONSTRAINT IF EXISTS tournament_attachments_tournament_id_fkey;
ALTER TABLE public.tournament_attachments ADD CONSTRAINT tournament_attachments_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id) ON DELETE CASCADE;

-- tournament_polls
ALTER TABLE public.tournament_polls DROP CONSTRAINT IF EXISTS tournament_polls_tournament_id_fkey;
ALTER TABLE public.tournament_polls ADD CONSTRAINT tournament_polls_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id) ON DELETE CASCADE;

-- ranking_rules
ALTER TABLE public.ranking_rules DROP CONSTRAINT IF EXISTS ranking_rules_tournament_id_fkey;
ALTER TABLE public.ranking_rules ADD CONSTRAINT ranking_rules_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id) ON DELETE CASCADE;

-- tournament_locations
ALTER TABLE public.tournament_locations DROP CONSTRAINT IF EXISTS tournament_locations_tournament_id_fkey;
ALTER TABLE public.tournament_locations ADD CONSTRAINT tournament_locations_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id) ON DELETE CASCADE;
