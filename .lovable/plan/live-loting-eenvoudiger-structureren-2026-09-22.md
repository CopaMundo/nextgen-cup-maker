# Live loting eenvoudiger structureren

## Doel
De bestaande groepsfase-loting blijft functioneel, maar krijgt een vaste voorbereiding in maximaal twee stappen. De trekking zelf verdwijnt uit de configuratie en opent als schermvullende lotingsomgeving.

## Nieuwe flow
1. **Instellingen & regels** opent altijd eerst.
   - Duidelijke keuze tussen volledig willekeurig en met potten.
   - Bij willekeurig: alleen de bestaande landen- en teamregels.
   - Bij potten: aantal potten, beoogd aantal teams per pot, automatisch aanmaken, lege pot toevoegen en de automatische verdeling per groep.
   - De bestaande pot-per-groep-tabel staat achter **Geavanceerde verdeling aanpassen**.
   - Voor Speelrondes blijft de bestaande instelling voor potontmoetingen in deze voorbereidingsstap beschikbaar.
2. **Potten** verschijnt alleen bij loting met potten.
   - Uitsluitend teams aan potten toewijzen, potnamen wijzigen en de bezetting bekijken.
   - Teams kunnen worden toegevoegd, verwijderd en tussen potten gesleept.
3. **Live loting** opent via de onderste actieknop als schermvullende weergave.
   - Links staan de groepen, geplaatste teams en lege plaatsen.
   - Rechts staan actieve pot, resterende teams, getrokken team en alleen geldige groepen.
   - Bestaande acties blijven: trekken, bevestigen, opnieuw trekken, handmatig kiezen, ongedaan maken, alles trekken en indeling toepassen.

## Controles
- Zonder potten: haalbaarheid van capaciteit, landenregels en teamregels vóór opening.
- Met potten: elk beschikbaar team is exact één keer toegewezen, potbezetting past bij de ingestelde verdeling en alle regels zijn haalbaar.
- Een foutmelding benoemt de oorzaak en brengt de organisator terug naar **Instellingen & regels** of **Potten**.
- Reset/opnieuw loten vraagt een duidelijke bevestiging.

## Technisch
- `LiveDrawDialog` wordt opgesplitst in voorbereidingsstappen en een schermvullende trekkingstoestand, zonder de bestaande lotingsmotor of opslag van het eindrapport te vervangen.
- Potverplaatsingen gebruiken de bestaande drag-and-dropbibliotheek en worden direct in de huidige potkoppelingen opgeslagen.
- De knop in de fase heet voortaan **Live loting** en geeft de fasenaam door.
- Na de wijziging worden typecontrole en de hoofdflow in de browser gecontroleerd.
