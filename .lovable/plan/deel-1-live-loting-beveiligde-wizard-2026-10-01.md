# Deel 1 live loting: beveiligde wizard

## Doel
De live loting opent opnieuw als één ruime, beveiligde pop-up boven de beheerpagina. De organisator doorloopt een duidelijke wizard voor startkeuze, pouleloting en eventueel speelrondes, zonder verlies van automatisch opgeslagen instellingen.

## Flow
1. **Startkeuze**
   - Bij fases met speelrondes: drie kaarten voor **Volledige loting**, **Alleen poules loten** en **Alleen speelrondes loten**.
   - **Volledige loting** staat standaard geselecteerd; alleen de geselecteerde kaart krijgt de gouden boven- en onderrand.
   - Een aparte knop **Volgende** opent de gekozen flow, na de bestaande overschrijfbevestiging wanneer nodig.
   - Bij exact één poule wordt een volledige loting direct als speelrondeloting behandeld; pouleloting wordt overgeslagen.

2. **Pouleloting: type en potten**
   - Keuze tussen **Willekeurige loting** en **Pottenloting**.
   - Willekeurig gaat met **Volgende** rechtstreeks naar de poule-instellingen.
   - Pottenloting toont alleen gelijke, wiskundig geldige potverdelingen vanaf twee potten.
   - Iedere pot gebruikt dezelfde vaste teamkeuzevakken als de Indeling/Format-weergave, inclusief logo, vlag, naam en een kruisje om een team direct te verwijderen.
   - Een pot kan nooit meer teams bevatten dan de gekozen potgrootte.

3. **Pouleloting: instellingen**
   - Eén selector **Landenlimiet per poule** met Geen beperking, Max 1, Max 2, enzovoort.
   - De standaardlimiet wordt automatisch bepaald op basis van landenaantallen en het aantal poules.
   - Uitzonderingen verschijnen alleen voor landen met meer teams dan poules en alleen wanneer een limiet actief is.
   - Teamregels ondersteunen uitsluitend **niet samen in één poule**; de optie voor verplicht samenvoegen verdwijnt.
   - De bestaande haalbaarheidscontrole blijft verplicht voordat de live trekking start.

4. **Doorstroom naar speelrondes**
   - Na het toepassen van de pouleloting gaat **Volledige loting** automatisch verder naar de speelrondeconfiguratie.
   - **Alleen speelrondes loten** opent direct de bestaande speelrondewizard.
   - Daar blijven Vrije speelrondeloting, Niveau-potten, gelijke potverdelingen, tegenstandersmatrix, landenregels, geblokkeerde ontmoetingen en de vooraf berekende planning behouden.

## Veilige pop-up en navigatie
- Eén brede modalcontainer met vaste titelbalk, intern scrollbare inhoud en vaste knoppenbalk.
- Buitenklikken en Escape worden geblokkeerd.
- Sluiten kan alleen via de zichtbare sluitactie; omdat drafts automatisch per fase worden opgeslagen, kan de wizard later hervat worden.
- **Vorige** en **Volgende** sturen alle configuratiestappen; de live trekking zelf behoudt haar specifieke trek- en bevestigingsknoppen.
- De modal en beide lotingstypes gebruiken dezelfde thematische `draw-*` rollen en volgen licht/donker met Copa Mundo goud/geel als accent.

## Technisch
- `GroupManager` beheert één modal en de hoofdfase van de wizard, inclusief startkeuze, overschrijfbevestiging en de overgang poules → speelrondes.
- `LiveDrawDialog` en `RoundsDrawDialog` worden inhoudsweergaven binnen die modal, zonder eigen overlay of buitenklikgedrag.
- De bestaande fasegebonden browserdrafts blijven behouden; de actieve wizardstap en gekozen hoofdoptie worden eveneens opgeslagen.
- `PotTeamSlots` krijgt een expliciete verwijderknop zonder de begrensde slotlogica te omzeilen.
- Bestaande lotingsmotoren, voorafgaande haalbaarheidscontrole, rapporten en database-opslag blijven behouden.

## Controle
- Controleer de drie startopties, standaardselectie en één-poule-overslag.
- Controleer dat buitenklik en Escape de wizard niet sluiten, maar de zichtbare sluitactie wel.
- Controleer willekeurige en potten-pouleloting, geldige potopties, verwijderen via ×, landenlimieten en uitgesloten teamparen.
- Controleer dat een volledige loting na poules automatisch doorgaat naar speelrondes en dat refresh de draft herstelt.
- Controleer licht en donker op desktop en mobiel, plus typecontrole en actuele buildstatus.
