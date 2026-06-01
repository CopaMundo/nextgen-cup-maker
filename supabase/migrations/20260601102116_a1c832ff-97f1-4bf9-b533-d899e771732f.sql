DROP POLICY IF EXISTS "Team logos publicly readable" ON storage.objects;
DROP POLICY IF EXISTS "Tournament attachments publicly readable" ON storage.objects;

CREATE POLICY "Team logos publicly readable"
ON storage.objects
FOR SELECT
TO anon, authenticated
USING (bucket_id = 'team-logos');

CREATE POLICY "Tournament attachments publicly readable"
ON storage.objects
FOR SELECT
TO anon, authenticated
USING (bucket_id = 'tournament-attachments');