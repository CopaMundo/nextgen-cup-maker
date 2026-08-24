---
name: Broadcast style La Rosa
description: Specs van de la_rosa broadcaststijl (moderne Italiaanse sportkrant, roze papier) voor de publieke toernooipagina's
type: design
---

Broadcast Style #8 `la_rosa` — "La Rosa".

- Palet light: paper pink #F3CDD3 (achtergrond), light paper pink #F8E1E5 (secundair), paper white #FFF9F8 (cards), highlight magenta #E6004F (primary), deep magenta #C90046, ink black #0A0A0A, secundaire tekst #6F6668, border #CBAEB3. Dark mode = zwarte inktpagina met warm roze-wit tekst en magenta accent.
- Typografie: Roboto Condensed 700/800/900 voor headlines, scores, tijden en posities (uppercase); Roboto 400–700 voor body, clubnamen en UI. Roboto Slab enkel zeer beperkt voor editorial details.
- Kaders: 0–4px radius (`.lrosa-card` = 2px, `--radius: 0.125rem`), geen shadows, geen gradients. Dunne borders en horizontale editorial dividers i.p.v. floating cards.
- Section headings: magenta verticale bar (3px) + zwarte condensed uppercase titel + dunne horizontale lijn.
- Standen: doorlopende tabel met horizontale lijnen, zwarte group headers met witte tekst, posities in Roboto Condensed 800, punten in zwarte rechthoek met witte tekst; kwalificatie via `.lrosa-qual` (verticale magenta lijn links).
- Schema: datumheader als magenta banner, tijdslot als zwarte balk met grote condensed tijd, wedstrijden in paper-white blokken met dunne borders.
- Tabs: active = magenta underline (nav-tabs) of magenta vlak met witte tekst (fase/bracket-tabs); inactive = light pink met 1px border.
- Bottom nav: zwarte balk (#0A0A0A), witte iconen/labels, magenta actief, centraal logo in vierkante donkere container met paper-pink outline.
- Infopagina: `.lrosa-cover` editorial roze/zwarte cover-overlay met magenta onderrand, logo in `logoFrame` met dunne zwarte border, zwarte info-strip voor datum/locatie.
- Bracket connectors: `.lrosa-connector`, dunne inktlijnen (1.25px).
