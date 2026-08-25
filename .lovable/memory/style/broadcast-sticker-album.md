---
name: Broadcast Sticker Album
description: sticker_album stijl — voetbalstickeralbum, albumpapier #F3EBD8, witte sticker cards, navy #172A46 + rood #C62828, Barlow Condensed + Inter, 4px radius
type: design
---
Broadcast Style #11 `sticker_album`.

- Light: bg #F3EBD8, cards #FFFFFF, secundair #E9DFC8, tekst #171717 / #8B806C, borders #D6C7A5.
- Dark: navy karton (216 40% 10%) met crème print.
- Navy #172A46 = headers/bands/punten; rood #C62828 = accent/LIVE/sectiedot.
- Typografie: Barlow Condensed 700/800 (titels, scores, tijden) + Inter body.
- Radius 4px (`--radius: 0.25rem`), geen gradients, subtiele 1px offset shadow.
- CSS utilities: `.sa-sticker`, `.sa-panel`, `.sa-band`, `.sa-qual`, `.sa-connector`, `.sa-cover`.
- Decoratieve stickernummers (#001, #002…) via CSS counter op het teamsraster — puur visueel, geen data.
