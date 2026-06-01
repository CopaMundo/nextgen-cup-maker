
DROP FUNCTION IF EXISTS public.set_tournament_match_days(uuid, jsonb);

CREATE OR REPLACE FUNCTION public.set_tournament_match_days(
  _tournament_id uuid,
  _match_days jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _owner uuid;
  _result jsonb;
BEGIN
  SELECT owner_id INTO _owner FROM public.tournaments WHERE id = _tournament_id;
  IF _owner IS NULL OR _owner != auth.uid() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE public.tournaments
  SET match_days = _match_days, updated_at = now()
  WHERE id = _tournament_id;

  SELECT match_days INTO _result FROM public.tournaments WHERE id = _tournament_id;
  RETURN _result;
END;
$$;

NOTIFY pgrst, 'reload schema';
