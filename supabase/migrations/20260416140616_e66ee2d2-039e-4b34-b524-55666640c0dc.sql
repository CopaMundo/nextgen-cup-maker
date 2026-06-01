-- Change sport column from enum to text to support all sports
ALTER TABLE public.tournaments 
  ALTER COLUMN sport TYPE text USING sport::text;

-- Set default to 'Voetbal'
ALTER TABLE public.tournaments 
  ALTER COLUMN sport SET DEFAULT 'Voetbal';

-- Update existing 'football' values to 'Voetbal'  
UPDATE public.tournaments SET sport = 'Voetbal' WHERE sport = 'football';

-- Drop the old enum type
DROP TYPE IF EXISTS public.sport_type;