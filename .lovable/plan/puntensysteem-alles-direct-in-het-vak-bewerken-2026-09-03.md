# Puntensysteem: alles direct in het vak bewerken

## Doel
Bij Algemeen > Puntensysteem moet alles meteen in het uitgeklapte kader werken: de schakelaar "Geavanceerde instellingen" gaat gewoon aan/uit, en winst, gelijkspel, verlies, sets en setinstellingen zijn direct invulbaar. Geen tussenpopup meer.

## Huidige situatie
Zodra er al gespeelde wedstrijden zijn (`playedCount > 0`), leidt elke inline-actie (focus op een puntenveld, de geavanceerd-switch, sets-velden) door naar de dialog "Puntentelling aanpassen" / "Sets aanpassen". Daardoor komt bij bijna elke wijziging een popup.

## Wat er verandert
- De doorverwijzing naar de bewerk-popup vervalt volledig: elk veld en elke schakelaar is altijd direct in het kader te bedienen.
- "Geavanceerde instellingen" schakelt onmiddellijk aan/uit; bij uitschakelen worden de geavanceerde waarden zoals nu teruggezet, zonder bevestigingsvenster.
- Punten bij winst / gelijkspel / verlies, grote overwinning, verlenging-varianten: opslaan bij blur, direct zichtbaar.
- Sets: aantal sets, puntenmodus en de puntenmatrix per uitslag zijn allemaal direct in het kader te bewerken.
- Wijzigen blijft de standen herberekenen; feedback gebeurt via een korte toast in plaats van een popup.
- Enige uitzondering die blijft: wisselen tussen type Punten en Sets wist alle ingevoerde resultaten — die bevestiging blijft staan (destructieve actie).
- De popup "Criteria bij gelijke punten" en de verwijderbevestiging blijven ongewijzigd.

## Technisch
- `src/components/ScoringSystemsManager.tsx`: `guardInlineEdit` en alle `if (playedCount > 0) { openScoringEdit(sys); return; }` checks verwijderen; `openScoringEdit`, `scoringDraft`, `saveScoringEdit` en de bijhorende Dialog opruimen.
- `handleAdvancedToggle`: `confirmAction` bij uitschakelen weghalen, direct `applyUpdate` met de resetwaarden.
- `handleTypeChange` behoudt zijn `confirmAction` (wist resultaten).
