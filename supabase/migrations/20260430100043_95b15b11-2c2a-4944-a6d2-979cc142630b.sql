
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'groups','teams','tournament_slideshows','tournament_sponsors','tournament_polls',
    'poll_votes','standing_colors','slots','tournament_scoring_systems','ranking_rules',
    'phase_progressions','tournaments','players','staff','tournament_locations',
    'tournament_attachments','tournament_categories'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL', t);
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    END;
  END LOOP;
END $$;

ALTER TABLE public.matches REPLICA IDENTITY FULL;
ALTER TABLE public.group_teams REPLICA IDENTITY FULL;
ALTER TABLE public.match_stats REPLICA IDENTITY FULL;
ALTER TABLE public.tournament_phases REPLICA IDENTITY FULL;
