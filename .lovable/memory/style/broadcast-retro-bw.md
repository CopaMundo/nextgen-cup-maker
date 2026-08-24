---
name: Broadcast style Retro Black & White
description: Specs van de retro_bw broadcaststijl (zwart-wit editorial matchdayprogramma) voor de publieke toernooipagina's
type: design
---

Broadcast Style #4 `retro_bw` — "Retro Black & White".

- Palet light: bg #F7F6F2, card #FFFFFF, secundair #F1F0EC, zwart #0A0A0A, tekst #111111, secundaire tekst #737373, borders #D2D0CA. Dark mode = geïnverteerd (bg #121212, card #1C1C1C, off-white tekst).
- Geen enkele accentkleur naast zwart/wit/off-white. Clublogo's en vlaggen houden altijd hun originele kleuren (geen filters, geen nieuwe omkadering).
- Typografie: Barlow Condensed 600–700 voor titels, headers, labels, scores; Barlow 400–600 voor body. Uppercase + verhoogde letterspacing bij titels.
- Kaders: 3px radius (`.rbw-card`), 1px borders, geen shadows (globaal uitgeschakeld binnen deze stijl), geen gradients, compacte spacing.
- Retro details: zwart vierkantje + dunne lijn bij sectietitels, `.rbw-brush` brush-stroke voor datumheaders, subtiele grain via repeating-linear-gradient, `.rbw-cover` krant-fade op de infopagina cover.
- Zwarte vlakken met witte tekst voor: groupheaders, tijdslot-headers, datumheaders, actieve tabs/fases, punten-scoreboxes, centrale navbutton.
