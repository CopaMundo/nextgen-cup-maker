
UPDATE public.slots 
SET team_id = NULL, ref_phase_id = NULL, ref_group_id = NULL, ref_position = NULL
WHERE phase_id = '2fdc4ff8-3d1e-4bbb-9574-4034ac8b86d8'
AND group_id = '64d9bacb-781c-4b7c-9caf-6b4841edff2b';

DELETE FROM public.group_teams
WHERE group_id = '64d9bacb-781c-4b7c-9caf-6b4841edff2b';
