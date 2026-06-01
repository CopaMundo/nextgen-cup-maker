GRANT SELECT, INSERT, UPDATE, DELETE ON public.tournaments TO authenticated;
GRANT SELECT ON public.tournaments TO anon;
GRANT ALL ON public.tournaments TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tournament_phases TO authenticated;
GRANT SELECT ON public.tournament_phases TO anon;
GRANT ALL ON public.tournament_phases TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tournament_categories TO authenticated;
GRANT SELECT ON public.tournament_categories TO anon;
GRANT ALL ON public.tournament_categories TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tournament_locations TO authenticated;
GRANT SELECT ON public.tournament_locations TO anon;
GRANT ALL ON public.tournament_locations TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tournament_attachments TO authenticated;
GRANT SELECT ON public.tournament_attachments TO anon;
GRANT ALL ON public.tournament_attachments TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tournament_sponsors TO authenticated;
GRANT SELECT ON public.tournament_sponsors TO anon;
GRANT ALL ON public.tournament_sponsors TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tournament_polls TO authenticated;
GRANT SELECT ON public.tournament_polls TO anon;
GRANT ALL ON public.tournament_polls TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.poll_votes TO authenticated;
GRANT INSERT ON public.poll_votes TO anon;
GRANT ALL ON public.poll_votes TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tournament_scoring_systems TO authenticated;
GRANT SELECT ON public.tournament_scoring_systems TO anon;
GRANT ALL ON public.tournament_scoring_systems TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tournament_slideshows TO authenticated;
GRANT SELECT ON public.tournament_slideshows TO anon;
GRANT ALL ON public.tournament_slideshows TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.teams TO authenticated;
GRANT SELECT ON public.teams TO anon;
GRANT ALL ON public.teams TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.players TO authenticated;
GRANT SELECT ON public.players TO anon;
GRANT ALL ON public.players TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff TO authenticated;
GRANT SELECT ON public.staff TO anon;
GRANT ALL ON public.staff TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.groups TO authenticated;
GRANT SELECT ON public.groups TO anon;
GRANT ALL ON public.groups TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_teams TO authenticated;
GRANT SELECT ON public.group_teams TO anon;
GRANT ALL ON public.group_teams TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.matches TO authenticated;
GRANT SELECT ON public.matches TO anon;
GRANT ALL ON public.matches TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.match_stats TO authenticated;
GRANT SELECT ON public.match_stats TO anon;
GRANT ALL ON public.match_stats TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.phase_progressions TO authenticated;
GRANT SELECT ON public.phase_progressions TO anon;
GRANT ALL ON public.phase_progressions TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ranking_rules TO authenticated;
GRANT SELECT ON public.ranking_rules TO anon;
GRANT ALL ON public.ranking_rules TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.slots TO authenticated;
GRANT SELECT ON public.slots TO anon;
GRANT ALL ON public.slots TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.standing_colors TO authenticated;
GRANT SELECT ON public.standing_colors TO anon;
GRANT ALL ON public.standing_colors TO service_role;

GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

DROP POLICY IF EXISTS "Team logos: owner upload" ON storage.objects;
DROP POLICY IF EXISTS "Team logos: owner update" ON storage.objects;
DROP POLICY IF EXISTS "Team logos: owner delete" ON storage.objects;
DROP POLICY IF EXISTS "Attachments: owner upload" ON storage.objects;
DROP POLICY IF EXISTS "Attachments: owner update" ON storage.objects;
DROP POLICY IF EXISTS "Attachments: owner delete" ON storage.objects;

CREATE POLICY "Team logos: owner upload"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'team-logos'
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND EXISTS (
    SELECT 1 FROM public.tournaments tr
    WHERE tr.id = ((storage.foldername(name))[1])::uuid
      AND tr.owner_id = auth.uid()
  )
);

CREATE POLICY "Team logos: owner update"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'team-logos'
  AND (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND EXISTS (
    SELECT 1 FROM public.tournaments tr
    WHERE tr.id = ((storage.foldername(name))[1])::uuid
      AND tr.owner_id = auth.uid()
  )
)
WITH CHECK (
  bucket_id = 'team-logos'
  AND (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND EXISTS (
    SELECT 1 FROM public.tournaments tr
    WHERE tr.id = ((storage.foldername(name))[1])::uuid
      AND tr.owner_id = auth.uid()
  )
);

CREATE POLICY "Team logos: owner delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'team-logos'
  AND (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND EXISTS (
    SELECT 1 FROM public.tournaments tr
    WHERE tr.id = ((storage.foldername(name))[1])::uuid
      AND tr.owner_id = auth.uid()
  )
);

CREATE POLICY "Attachments: owner upload"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'tournament-attachments'
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND EXISTS (
    SELECT 1 FROM public.tournaments tr
    WHERE tr.id = ((storage.foldername(name))[1])::uuid
      AND tr.owner_id = auth.uid()
  )
);

CREATE POLICY "Attachments: owner update"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'tournament-attachments'
  AND (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND EXISTS (
    SELECT 1 FROM public.tournaments tr
    WHERE tr.id = ((storage.foldername(name))[1])::uuid
      AND tr.owner_id = auth.uid()
  )
)
WITH CHECK (
  bucket_id = 'tournament-attachments'
  AND (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND EXISTS (
    SELECT 1 FROM public.tournaments tr
    WHERE tr.id = ((storage.foldername(name))[1])::uuid
      AND tr.owner_id = auth.uid()
  )
);

CREATE POLICY "Attachments: owner delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'tournament-attachments'
  AND (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND EXISTS (
    SELECT 1 FROM public.tournaments tr
    WHERE tr.id = ((storage.foldername(name))[1])::uuid
      AND tr.owner_id = auth.uid()
  )
);