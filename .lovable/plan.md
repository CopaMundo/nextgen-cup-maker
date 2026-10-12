# Nieuwe professionele layout voor de toernooipagina

De kleurthema's blijven (donker: geel accent, licht: blauw accent). Alles wat beheer is, krijgt één nieuwe, rustige en professionele stijl. Publieke weergave, broadcaststijlen en de live-lotingshow blijven ongewijzigd.

## Nieuwe stijl
- Achtergrond, kaders, velden en randen worden echt neutraal: diep antraciet in donker, zacht wit en lichtgrijs in licht. Geen groene, olijf- of blauwe zweem meer, ook niet op mobiel en in pop-ups.
- Geel/blauw komt alleen terug als accent: actieve tab, actieve zijbalkregel, primaire knop, focusrand en selectiebalk.
- Duidelijke diepte met drie lagen: pagina, kaart, veld. Subtiele schaduw in plaats van gekleurde vullingen.
- Eén typografieschaal: paginatitel, sectietitel met gele balk, kleine labels in hoofdletters, rustige hulptekst.

## Layout
- Bovenbalk: logo links, toernooinaam en divisiekeuze centraal, acties rechts; vast en compact.
- Zijbalk: dezelfde iconen, rustiger actieve staat (dunne accentlijn + lichtgrijze vulling), inklapbaar.
- Subtabs (Toernooi informatie, Wedstrijddagen, ...) als strakke tabbalk met onderlijn in accentkleur.
- Inhoud in een gecentreerde kolom met vaste maximale breedte en gelijke tussenruimtes.
- Formatkaarten bij Indeling, teamkaarten bij Deelnemers, schema, resultaten en presentatie gebruiken dezelfde kaartstijl, kop en knoppenrij.
- Mobiel: zijbalk wordt onderste navigatiebalk, kaarten op volle breedte, geen horizontale scroll.

## Pop-ups
- Alle pop-ups (ook de loting-wizard) krijgen dezelfde kop, rand, velden en knoppenrij als de tabs.

## Controle
- Elk tabblad en de wizard fotograferen in donker en licht, op desktop en mobiel, en kleurwaarden controleren op nul kleurzweem.

## Technische details
- Admin-tokens in de globale CSS opnieuw definiëren onder `.admin-ui` (achromatisch) plus gedeelde klassen: `admin-shell`, `admin-card`, `admin-tabs`, `admin-field`.
- Resterende hardgecodeerde gekleurde vullingen (`bg-primary/x`, groene/blauwe hsl-waarden, oude thema-tokens buiten `.admin-ui`) opzoeken en vervangen.
- Toepassen in TournamentDetail-layout, zijbalk, subtabs, en de beheercomponenten; draw-show en broadcast uitsluiten.
