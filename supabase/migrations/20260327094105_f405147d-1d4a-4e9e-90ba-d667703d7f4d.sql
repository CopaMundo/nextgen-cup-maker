
-- Helper function to get orphaned team-logos paths
CREATE OR REPLACE FUNCTION public.get_orphaned_storage_paths()
RETURNS TABLE(name text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, storage
AS $$
  SELECT o.name
  FROM storage.objects o
  WHERE o.bucket_id = 'team-logos'
  AND split_part(o.name, '/', 1) ~ '^[0-9a-f]{8}-'
  AND split_part(o.name, '/', 1) NOT IN (SELECT t.id::text FROM public.tournaments t)
$$;

-- Helper function to get orphaned attachment paths
CREATE OR REPLACE FUNCTION public.get_orphaned_attachment_paths()
RETURNS TABLE(name text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, storage
AS $$
  SELECT o.name
  FROM storage.objects o
  WHERE o.bucket_id = 'tournament-attachments'
  AND split_part(o.name, '/', 1) ~ '^[0-9a-f]{8}-'
  AND split_part(o.name, '/', 1) NOT IN (SELECT t.id::text FROM public.tournaments t)
$$;

-- Also fix the trigger to use storage API approach instead of direct delete
-- Drop the broken trigger that tries direct SQL delete on storage.objects
DROP TRIGGER IF EXISTS cleanup_tournament_storage_trigger ON public.tournaments;
DROP FUNCTION IF EXISTS public.cleanup_tournament_storage();
