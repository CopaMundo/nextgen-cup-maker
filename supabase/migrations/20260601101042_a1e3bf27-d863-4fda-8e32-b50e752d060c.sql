CREATE OR REPLACE FUNCTION public.storage_path_tournament_id(_object_name text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, storage
AS $$
  SELECT CASE
    WHEN (storage.foldername(_object_name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    THEN ((storage.foldername(_object_name))[1])::uuid
    ELSE NULL
  END;
$$;

GRANT EXECUTE ON FUNCTION public.storage_path_tournament_id(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.storage_path_tournament_id(text) TO service_role;

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
  AND public.storage_path_tournament_id(storage.objects.name) IS NOT NULL
  AND public.is_tournament_owner(auth.uid(), public.storage_path_tournament_id(storage.objects.name))
);

CREATE POLICY "Team logos: owner update"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'team-logos'
  AND public.storage_path_tournament_id(storage.objects.name) IS NOT NULL
  AND public.is_tournament_owner(auth.uid(), public.storage_path_tournament_id(storage.objects.name))
)
WITH CHECK (
  bucket_id = 'team-logos'
  AND public.storage_path_tournament_id(storage.objects.name) IS NOT NULL
  AND public.is_tournament_owner(auth.uid(), public.storage_path_tournament_id(storage.objects.name))
);

CREATE POLICY "Team logos: owner delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'team-logos'
  AND public.storage_path_tournament_id(storage.objects.name) IS NOT NULL
  AND public.is_tournament_owner(auth.uid(), public.storage_path_tournament_id(storage.objects.name))
);

CREATE POLICY "Attachments: owner upload"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'tournament-attachments'
  AND auth.uid() IS NOT NULL
  AND public.storage_path_tournament_id(storage.objects.name) IS NOT NULL
  AND public.is_tournament_owner(auth.uid(), public.storage_path_tournament_id(storage.objects.name))
);

CREATE POLICY "Attachments: owner update"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'tournament-attachments'
  AND public.storage_path_tournament_id(storage.objects.name) IS NOT NULL
  AND public.is_tournament_owner(auth.uid(), public.storage_path_tournament_id(storage.objects.name))
)
WITH CHECK (
  bucket_id = 'tournament-attachments'
  AND public.storage_path_tournament_id(storage.objects.name) IS NOT NULL
  AND public.is_tournament_owner(auth.uid(), public.storage_path_tournament_id(storage.objects.name))
);

CREATE POLICY "Attachments: owner delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'tournament-attachments'
  AND public.storage_path_tournament_id(storage.objects.name) IS NOT NULL
  AND public.is_tournament_owner(auth.uid(), public.storage_path_tournament_id(storage.objects.name))
);