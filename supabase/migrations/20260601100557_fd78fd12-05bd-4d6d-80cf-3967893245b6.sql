-- Restore Data-API grants lost during remix.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tournaments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tournament_phases TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tournament_categories TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tournament_locations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tournament_attachments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tournament_sponsors TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tournament_polls TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tournament_scoring_systems TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tournament_slideshows TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.teams TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.players TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.groups TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_teams TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.matches TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.match_stats TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.phase_progressions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ranking_rules TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.slots TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.standing_colors TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.poll_votes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;

-- Public (anon) read access for tables exposed via the public view link
GRANT SELECT ON public.tournaments TO anon;
GRANT SELECT ON public.tournament_phases TO anon;
GRANT SELECT ON public.tournament_categories TO anon;
GRANT SELECT ON public.tournament_locations TO anon;
GRANT SELECT ON public.tournament_attachments TO anon;
GRANT SELECT ON public.tournament_sponsors TO anon;
GRANT SELECT ON public.tournament_polls TO anon;
GRANT SELECT ON public.tournament_scoring_systems TO anon;
GRANT SELECT ON public.tournament_slideshows TO anon;
GRANT SELECT ON public.teams TO anon;
GRANT SELECT ON public.players TO anon;
GRANT SELECT ON public.staff TO anon;
GRANT SELECT ON public.groups TO anon;
GRANT SELECT ON public.group_teams TO anon;
GRANT SELECT ON public.matches TO anon;
GRANT SELECT ON public.match_stats TO anon;
GRANT SELECT ON public.phase_progressions TO anon;
GRANT SELECT ON public.ranking_rules TO anon;
GRANT SELECT ON public.slots TO anon;
GRANT SELECT ON public.standing_colors TO anon;
GRANT INSERT ON public.poll_votes TO anon;

-- Service role gets full access on everything
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;