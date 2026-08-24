---
name: Broadcast style Modern Black & White
description: Specs van de modern_bw broadcaststijl (strak minimalistisch zwart-wit) voor de publieke toernooipagina's
type: design
---

Broadcast Style #6 `modern_bw` — "Modern Black & White".

- Palet light: bg #F7F7F7, card #FFFFFF, secundair #EFEFEF, zwart #0A0A0A, tekst #111111, secundaire tekst #737373, borders #E0E0E0. Dark = geïnverteerd (bg 6%, card 10%, tekst 98%).
- Geen gekleurde interface-accenten; enige kleur komt van clublogo's en vlaggen (nooit filters).
- Typografie: Inter overal — 800 titels/scores, 700 sectietitels, 600–700 teamnamen, 400–500 body, uppercase 500–600 metadata met lichte letterspacing. Geen serif/condensed.
- Kaders: 8px radius (`.mbw-card`, `--radius: 0.5rem`), 1px borders, vrijwel geen shadow (max 0 1px 2px /0.04), geen gradients, geen textures/grain.
- Zwarte vlakken met witte tekst voor: groupheaders, tijdslot-headers, datumheaders, actieve tabs/fases, punten-badges. Winnaar krijgt lichtgrijze rij i.p.v. kleur.
- `.mbw-cover` = neutrale zwart-wit fade op de infopagina cover; `.mbw-connector` = dunne donkergrijze bracketlijnen.
