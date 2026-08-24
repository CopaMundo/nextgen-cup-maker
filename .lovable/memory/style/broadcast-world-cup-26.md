---
name: Broadcast style World Cup 26
description: Specs van de wc26 broadcaststijl (internationale zwart-wit broadcast met turquoise + goud) voor de publieke toernooipagina's
type: design
---

Broadcast Style #7 `wc26` — "World Cup 26".

- Palet light: bg #F7F7F5, card #FFFFFF, secundair #EFEFED, tekst #090909, secundaire tekst #686868, borders #D8D8D5. Dark: bg #050505, card #0D0D0D, tekst #FFFFFF.
- Accent turquoise #19C7B5 (highlight #39E1CF) voor actieve tabs, live, kwalificatiezones, favoriet team. Goud #D6B448 spaarzaam (premium details, outline centrale nav-logo, tweede kwalificatiezone).
- Geen gradients, geen textures; enkel effen vlakken. Shadows max 0 1px 2px /0.06.
- Typografie: Barlow Condensed 600–800 uppercase (titels, scores, tijden, groep/fase labels, tabellen headers) + Inter 400–600 (body, clubnamen, locatie, scheidsrechter).
- Kaders: 6px radius (`.wc26-card`, `--radius: 0.375rem`), 1px borders.
- Zwarte vlakken met witte tekst voor tijdslot-/datum-/groupheaders; punten-badges vierkant zwart. Bottom nav zwart, actieve tab turquoise.
- `.wc26-cover` = sterke donkere cover-overlay met turquoise onderrand; `.wc26-connector` = dunne bracketlijnen; `.wc26-qual` / `.wc26-qual-gold` = verticale kwalificatie-indicators.
