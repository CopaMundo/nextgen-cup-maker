ALTER TABLE public.tournaments
ADD COLUMN IF NOT EXISTS standings_columns jsonb NOT NULL DEFAULT
'{"points":{"gp":true,"w":true,"d":true,"l":true,"gf":true,"ga":true,"gd":true},"sets":{"gp":true,"w":true,"d":true,"l":true,"sf":true,"sa":true,"sd":true,"pf":false,"pa":false,"pd":false}}'::jsonb;