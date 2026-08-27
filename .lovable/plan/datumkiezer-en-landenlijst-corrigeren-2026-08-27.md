# Datumkiezer en landenlijst corrigeren

## Wijzigingen
- Zet de landenlijst in een vaste, correcte Nederlandse alfabetische volgorde zodat Engeland altijd op de juiste plaats staat.
- Bouw de gedeelde datumkiezer om naar een invoerveld waarin `dd/mm/jjjj` rechtstreeks getypt kan worden, met daarnaast de kalenderknop.
- Zorg dat de kalender als volledig zichtbare popover boven dialogen verschijnt en binnen kleine schermen blijft.
- Vervang de resterende losse HTML-datumvelden bij het aanmaken van een toernooi en wedstrijden door dezelfde gedeelde datumkiezer.

## Technisch
- Bewaar datums intern als `yyyy-MM-dd`; toon en accepteer handmatige invoer als `dd/mm/yyyy`.
- Behoud kalenderselectie via de bestaande Shadcn Calendar en voeg `pointer-events-auto`, hogere z-index en collision padding toe.
- Controleer de relevante datumflows na de wijziging.
