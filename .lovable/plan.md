# Loting-popup verbeteren met teamlogo

## Doel
De sub-popup voor handmatige loting (bij het voltooien van een groepsformat) wordt visueel duidelijker gemaakt. Elke gelijkgeëindigde teamrij toont het teamlogo prominent, de huidige positie, de teamnaam en de landenvlag. De bediening met omhoog/omlaag-pijltjes blijft werken zoals nu.

## Huidige stand
In `src/components/ResultsManager.tsx` bestaat al een `Dialog` rond `lotsDialogGroupId`. Deze toont al een klein logo (`h-5 w-5`), positie, teamnaam, vlag en pijltjes. Deze lay-out wordt opgefrist.

## Wijzigingen
1. **Grotere teamlogo's**
   - Logo wordt 32×32 px (`h-8 w-8`) en krijgt `object-contain`.
   - Als een team geen logo heeft, wordt `public/placeholder.svg` als fallback getoond zodat de rij altijd even breed is.

2. **Prominente positie**
   - Positie komt in een compacte badge/kolom links van het logo (`font-bold`, iets groter).

3. **Behouden elementen**
   - Teamnaam blijft leesbaar en wordt afgekort indien nodig.
   - Landenvlag blijft staan als `tournament.show_country` aan staat.
   - Omhoog/omlaag-pijltjes blijven rechts, maar krijgen duidelijke hover- en disabled-states.

4. **Visuele scheiding**
   - Elke teamrij krijgt een lichte achtergrond (`bg-card`) en padding, vergelijkbaar met de rest van de admin-UI.
   - De popup krijgt een iets ruimere breedte (`sm:max-w-lg`) zodat langere teamnamen niet direct worden afgekapt.

5. **Actieknop**
   - "Sluiten" wordt "Klaar" zodat het duidelijk is dat de handmatige volgorde is opgeslagen (de wijzigingen worden direct naar `group_teams.manual_position` weggeschreven).

## Technische details
- Bestand: `src/components/ResultsManager.tsx` (regio rond `lotsDialogGroupId` en `moveDrawingLotsTeam`).
- De bestaande `moveDrawingLotsTeam`-logica en de `manual_position`-update in Supabase worden niet aangepast, alleen de presentatie.
- Geen wijzigingen in `standingsCalculator.ts` of in de voltooiingslogica zelf.

## Validatie
- Typecheck (`tsgo` of `bunx tsc --noEmit`) moet groen blijven.
- Indien beschikbaar: de bestaande `standingsCalculator.test.ts` moet blijven slagen.
- Visuele controle via preview: open een groepsformat waarbij teams gelijk eindigen, klik op "Volgorde bepalen" en controleer of logo's, vlaggen en posities correct worden weergegeven.
