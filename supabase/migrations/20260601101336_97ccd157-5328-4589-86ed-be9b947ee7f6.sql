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

REVOKE ALL ON FUNCTION public.storage_path_tournament_id(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.storage_path_tournament_id(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.storage_path_tournament_id(text) TO service_role;