
-- Create a function to clean up storage objects before tournament deletion
CREATE OR REPLACE FUNCTION public.cleanup_tournament_storage()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _logo text;
  _cover text;
  _team record;
  _attachment record;
  _player record;
  _staff_rec record;
  _paths text[] := '{}';
BEGIN
  -- Tournament logo
  IF OLD.logo_url IS NOT NULL AND OLD.logo_url LIKE '%/storage/v1/object/public/%' THEN
    _paths := _paths || regexp_replace(OLD.logo_url, '^.*/storage/v1/object/public/team-logos/', '');
  END IF;

  -- Tournament cover
  IF OLD.cover_url IS NOT NULL AND OLD.cover_url LIKE '%/storage/v1/object/public/%' THEN
    _paths := _paths || regexp_replace(OLD.cover_url, '^.*/storage/v1/object/public/team-logos/', '');
  END IF;

  -- Team logos and photos
  FOR _team IN SELECT logo_url, team_photo_url FROM public.teams WHERE tournament_id = OLD.id LOOP
    IF _team.logo_url IS NOT NULL AND _team.logo_url LIKE '%/storage/v1/object/public/team-logos/%' THEN
      _paths := _paths || regexp_replace(_team.logo_url, '^.*/storage/v1/object/public/team-logos/', '');
    END IF;
    IF _team.team_photo_url IS NOT NULL AND _team.team_photo_url LIKE '%/storage/v1/object/public/team-logos/%' THEN
      _paths := _paths || regexp_replace(_team.team_photo_url, '^.*/storage/v1/object/public/team-logos/', '');
    END IF;
  END LOOP;

  -- Player photos
  FOR _player IN SELECT photo_url FROM public.players WHERE tournament_id = OLD.id AND photo_url IS NOT NULL LOOP
    IF _player.photo_url LIKE '%/storage/v1/object/public/team-logos/%' THEN
      _paths := _paths || regexp_replace(_player.photo_url, '^.*/storage/v1/object/public/team-logos/', '');
    END IF;
  END LOOP;

  -- Staff photos
  FOR _staff_rec IN SELECT photo_url FROM public.staff WHERE tournament_id = OLD.id AND photo_url IS NOT NULL LOOP
    IF _staff_rec.photo_url LIKE '%/storage/v1/object/public/team-logos/%' THEN
      _paths := _paths || regexp_replace(_staff_rec.photo_url, '^.*/storage/v1/object/public/team-logos/', '');
    END IF;
  END LOOP;

  -- Delete from team-logos bucket
  IF array_length(_paths, 1) > 0 THEN
    DELETE FROM storage.objects WHERE bucket_id = 'team-logos' AND name = ANY(_paths);
  END IF;

  -- Tournament attachments bucket
  DELETE FROM storage.objects
  WHERE bucket_id = 'tournament-attachments'
    AND name LIKE OLD.id::text || '/%';

  -- Sponsor logos (also in team-logos bucket)
  DECLARE
    _sponsor record;
    _sponsor_paths text[] := '{}';
  BEGIN
    FOR _sponsor IN SELECT logo_url FROM public.tournament_sponsors WHERE tournament_id = OLD.id LOOP
      IF _sponsor.logo_url LIKE '%/storage/v1/object/public/team-logos/%' THEN
        _sponsor_paths := _sponsor_paths || regexp_replace(_sponsor.logo_url, '^.*/storage/v1/object/public/team-logos/', '');
      END IF;
    END LOOP;
    IF array_length(_sponsor_paths, 1) > 0 THEN
      DELETE FROM storage.objects WHERE bucket_id = 'team-logos' AND name = ANY(_sponsor_paths);
    END IF;
  END;

  RETURN OLD;
END;
$$;

-- Create BEFORE DELETE trigger on tournaments
CREATE TRIGGER cleanup_tournament_storage_trigger
  BEFORE DELETE ON public.tournaments
  FOR EACH ROW
  EXECUTE FUNCTION public.cleanup_tournament_storage();
