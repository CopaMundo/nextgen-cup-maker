# Rondenummers overal verbergen

## Aanpak
- Verwijder zichtbare labels zoals **Ronde 7**, **Speelronde 7** en **R7** van alle wedstrijdkaarten, detailvensters en presentaties, zowel in beheer als op de publieke toernooiwebsite.
- Toon wedstrijdnaam, format, groep, datum, tijd en veld verder ongewijzigd; als een rondenummer nu als terugvaltekst wordt gebruikt, laat die plek leeg in plaats van het nummer te tonen.
- Maak wedstrijdlijsten die nu per zichtbare speelronde gegroepeerd zijn tot één doorlopende lijst, met behoud van hun bestaande interne volgorde.
- Behoud `round_number` volledig als interne informatie voor het aanmaken, sorteren, filteren en plaatsen van wedstrijden in het schema. De rondekeuzes in de planner blijven dus beschikbaar.

## Controle
- Zoek na de aanpassing opnieuw naar alle zichtbare ronde- en speelrondeteksten.
- Controleer de gewijzigde wedstrijdkaarten en pop-ups en voer de relevante automatische controles uit.

## Technisch
- Alleen weergavecode wordt aangepast; databasevelden en planningslogica blijven intact.
- Knock-outnamen zoals **Kwartfinale**, **Halve finale** en **Finale** blijven zichtbaar, omdat dit wedstrijdnamen zijn en geen numerieke rondenummers.
