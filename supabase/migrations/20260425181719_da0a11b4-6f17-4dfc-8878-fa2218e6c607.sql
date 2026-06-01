-- Fix cross-format propagation: clear home_team_id where slot_label points to a "Winnaar X" / "Verliezer X"
-- match that is NOT played in the same phase_id, OR where the team is not the actual winner/loser of that source.

WITH source_matches AS (
  SELECT 
    id, phase_id, match_name, home_team_id, away_team_id, home_score, away_score,
    home_penalties, away_penalties, is_played
  FROM public.matches
),
-- Compute winner/loser per played source match
resolved AS (
  SELECT 
    s.id AS source_id,
    s.phase_id,
    s.match_name,
    CASE 
      WHEN s.is_played AND s.home_score > s.away_score THEN s.home_team_id
      WHEN s.is_played AND s.away_score > s.home_score THEN s.away_team_id
      WHEN s.is_played AND s.home_score = s.away_score AND s.home_penalties > s.away_penalties THEN s.home_team_id
      WHEN s.is_played AND s.home_score = s.away_score AND s.away_penalties > s.home_penalties THEN s.away_team_id
      ELSE NULL
    END AS winner_id,
    CASE 
      WHEN s.is_played AND s.home_score > s.away_score THEN s.away_team_id
      WHEN s.is_played AND s.away_score > s.home_score THEN s.home_team_id
      WHEN s.is_played AND s.home_score = s.away_score AND s.home_penalties > s.away_penalties THEN s.away_team_id
      WHEN s.is_played AND s.home_score = s.away_score AND s.away_penalties > s.home_penalties THEN s.home_team_id
      ELSE NULL
    END AS loser_id
  FROM source_matches s
)
-- Clear home_team_id when it shouldn't propagate
UPDATE public.matches m
SET home_team_id = NULL
WHERE m.is_played = false
  AND m.home_team_id IS NOT NULL
  AND (
    (m.home_slot_label LIKE 'Winnaar %' AND NOT EXISTS (
      SELECT 1 FROM resolved r 
      WHERE r.phase_id = m.phase_id 
        AND r.match_name = SUBSTRING(m.home_slot_label FROM 9)
        AND r.winner_id = m.home_team_id
    ))
    OR
    (m.home_slot_label LIKE 'Verliezer %' AND NOT EXISTS (
      SELECT 1 FROM resolved r 
      WHERE r.phase_id = m.phase_id 
        AND r.match_name = SUBSTRING(m.home_slot_label FROM 11)
        AND r.loser_id = m.home_team_id
    ))
  );

-- Same for away_team_id
WITH source_matches AS (
  SELECT 
    id, phase_id, match_name, home_team_id, away_team_id, home_score, away_score,
    home_penalties, away_penalties, is_played
  FROM public.matches
),
resolved AS (
  SELECT 
    s.id AS source_id,
    s.phase_id,
    s.match_name,
    CASE 
      WHEN s.is_played AND s.home_score > s.away_score THEN s.home_team_id
      WHEN s.is_played AND s.away_score > s.home_score THEN s.away_team_id
      WHEN s.is_played AND s.home_score = s.away_score AND s.home_penalties > s.away_penalties THEN s.home_team_id
      WHEN s.is_played AND s.home_score = s.away_score AND s.away_penalties > s.home_penalties THEN s.away_team_id
      ELSE NULL
    END AS winner_id,
    CASE 
      WHEN s.is_played AND s.home_score > s.away_score THEN s.away_team_id
      WHEN s.is_played AND s.away_score > s.home_score THEN s.home_team_id
      WHEN s.is_played AND s.home_score = s.away_score AND s.home_penalties > s.away_penalties THEN s.away_team_id
      WHEN s.is_played AND s.home_score = s.away_score AND s.away_penalties > s.home_penalties THEN s.home_team_id
      ELSE NULL
    END AS loser_id
  FROM source_matches s
)
UPDATE public.matches m
SET away_team_id = NULL
WHERE m.is_played = false
  AND m.away_team_id IS NOT NULL
  AND (
    (m.away_slot_label LIKE 'Winnaar %' AND NOT EXISTS (
      SELECT 1 FROM resolved r 
      WHERE r.phase_id = m.phase_id 
        AND r.match_name = SUBSTRING(m.away_slot_label FROM 9)
        AND r.winner_id = m.away_team_id
    ))
    OR
    (m.away_slot_label LIKE 'Verliezer %' AND NOT EXISTS (
      SELECT 1 FROM resolved r 
      WHERE r.phase_id = m.phase_id 
        AND r.match_name = SUBSTRING(m.away_slot_label FROM 11)
        AND r.loser_id = m.away_team_id
    ))
  );