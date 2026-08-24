---
name: Broadcast style Old Newspaper
description: Specs van de old_newspaper broadcaststijl (oude Europese sportkrant) voor de publieke toernooipagina's
type: design
---

Broadcast Style #5 `old_newspaper` — "Old Newspaper".

- Palet light: papier #E9E1CF, card #F4EEDF, secundair #DDD3BE, inkt #181713, secundaire tekst #625D52, rules #8C8474, donkere vlakken #24221D, accent donkerrood #8B2E24 (zeer beperkt). Dark mode = donkere inktpagina met warm off-white tekst en rood accent.
- Typografie: Playfair Display 900 voor headlines/paginatitels, Roboto Slab 700 voor sectietitels, Roboto Slab 800 voor scores, Libre Franklin voor body/tabellen/metadata (uppercase + brede letterspacing).
- Kaders: 1px radius, geen shadows (globaal uitgeschakeld), geen gradients/pills. Kaarten zijn horizontale newspaper rules i.p.v. floating cards; `.onp-rule-double` voor dubbele lijnen onder headlines.
- Details: fijne paper grain (repeating-linear-gradient horizontaal + verticaal), `.onp-ink` donkere inktvlakken met printtextuur, `.onp-cover` voorpagina-overlay, `.onp-connector` dunne bracketlijnen.
- Tijdslots en datums zijn krantsectie-headers (geen badges); punten in het klassement zijn vierkante newspaper scoreboxes, geen blauwe pills.
- Actieve tabs/fases: donkere inkt met lichte tekst; inactief papierkleur met dunne borders. Actieve bottom-nav tab is donkerrood.
