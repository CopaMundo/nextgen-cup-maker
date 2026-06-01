
-- Add description and is_public columns to tournaments
ALTER TABLE public.tournaments ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.tournaments ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false;

-- Create tournament_attachments table
CREATE TABLE public.tournament_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_url text NOT NULL,
  file_size integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tournament_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage attachments" ON public.tournament_attachments
  FOR ALL TO public
  USING (is_tournament_owner(auth.uid(), tournament_id))
  WITH CHECK (is_tournament_owner(auth.uid(), tournament_id));

CREATE POLICY "Public view attachments" ON public.tournament_attachments
  FOR SELECT TO public
  USING (EXISTS (
    SELECT 1 FROM tournaments t
    WHERE t.id = tournament_attachments.tournament_id AND t.view_link_active = true
  ));

-- Update public view policy for tournaments to also allow viewing public tournaments
DROP POLICY IF EXISTS "Public view via token" ON public.tournaments;
CREATE POLICY "Public view via token or public" ON public.tournaments
  FOR SELECT TO public
  USING (
    (view_link_active = true AND view_link_token IS NOT NULL)
    OR is_public = true
  );

-- Create storage bucket for attachments
INSERT INTO storage.buckets (id, name, public) VALUES ('tournament-attachments', 'tournament-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for attachments bucket
CREATE POLICY "Authenticated users upload attachments" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'tournament-attachments');

CREATE POLICY "Public read attachments" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'tournament-attachments');

CREATE POLICY "Authenticated users delete attachments" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'tournament-attachments');
