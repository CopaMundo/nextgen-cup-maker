
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS first_name text,
ADD COLUMN IF NOT EXISTS last_name text,
ADD COLUMN IF NOT EXISTS city text,
ADD COLUMN IF NOT EXISTS address text,
ADD COLUMN IF NOT EXISTS postal_code text,
ADD COLUMN IF NOT EXISTS phone_country_code text DEFAULT '+32';

-- Add tournament settings columns for fields and referees
ALTER TABLE public.tournaments
ADD COLUMN IF NOT EXISTS fields jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS referees jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS match_duration integer DEFAULT 15,
ADD COLUMN IF NOT EXISTS break_duration integer DEFAULT 5,
ADD COLUMN IF NOT EXISTS num_fields integer DEFAULT 1;
