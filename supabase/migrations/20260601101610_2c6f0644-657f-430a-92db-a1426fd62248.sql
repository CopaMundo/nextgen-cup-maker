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
  AND public.is_tournament_owner(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "Team logos: owner update"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'team-logos'
  AND (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND public.is_tournament_owner(auth.uid(), ((storage.foldername(name))[1])::uuid)
)
WITH CHECK (
  bucket_id = 'team-logos'
  AND (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND public.is_tournament_owner(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "Team logos: owner delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'team-logos'
  AND (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND public.is_tournament_owner(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "Attachments: owner upload"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'tournament-attachments'
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND public.is_tournament_owner(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "Attachments: owner update"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'tournament-attachments'
  AND (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND public.is_tournament_owner(auth.uid(), ((storage.foldername(name))[1])::uuid)
)
WITH CHECK (
  bucket_id = 'tournament-attachments'
  AND (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND public.is_tournament_owner(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "Attachments: owner delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'tournament-attachments'
  AND (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND public.is_tournament_owner(auth.uid(), ((storage.foldername(name))[1])::uuid)
);