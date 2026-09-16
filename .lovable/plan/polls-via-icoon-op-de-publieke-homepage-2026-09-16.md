# Polls via icoon op de publieke homepage

## Doel
Polls verdwijnen als vast onderdeel onderaan de publieke homepage. Bezoekers openen ze voortaan via een duidelijk poll-icoon rechtsboven naast de toernooinaam.

## Uitvoering
- Voeg rechtsboven in de titelbalk van de publieke homepage een thematisch poll-icoon toe, uitsluitend wanneer er actieve polls zijn.
- Toon een subtiele aanduiding op het icoon wanneer er nog minstens één onbeantwoorde poll is.
- Open bij een klik een mobielvriendelijk, centraal pollvenster met alle actieve polls en een duidelijke sluitknop.
- Sorteer polls eerst op **nog niet gestemd**, en binnen beide groepen op **nieuwste eerst**.
- Behoud per poll de bestaande opties, percentages, gekozen optie en het totale aantal stemmen.
- Verwerk een stem slechts één keer per bezoeker, sla de keuze zoals nu lokaal op en toon onmiddellijk de nieuwe percentages inclusief de zojuist uitgebrachte stem.
- Behandel een mislukte stemopslag duidelijk: geen schijnresultaat tonen en opnieuw stemmen mogelijk laten.
- Verwijder het huidige pollblok onderaan de homepage en ruim de daar overbodig geworden code op.

## Technisch
- De bestaande actieve polls en stemmen uit de publieke toernooidata blijven de bron; er is geen nieuw datamodel nodig.
- De pollweergave en stemstatus worden in een afzonderlijk publiek pollvenster ondergebracht, passend bij alle bestaande broadcaststijlen.
- Na een geslaagde insert wordt de lokale stemmenlijst meteen aangevuld, terwijl de bestaande realtime-verversing latere stemmen van andere bezoekers blijft binnenhalen.

## Controle
- Controleren op mobiel en desktop dat het icoon rechtsboven staat, het venster goed opent/sluit en de onderste pollsectie weg is.
- Stemmen op meerdere polls testen: onbeantwoorde polls blijven bovenaan, de eigen stem telt direct mee en een tweede stem op dezelfde poll is geblokkeerd.
- Controleren dat zonder actieve polls geen leeg icoon of leeg venster zichtbaar is.
