---
name: Copa Mundo public design system
description: Visual identity of the public tournament view (broadcast style copa_mundo) — palette, typography, yellow accent rules
type: design
---
De publieke toernooiweergave gebruikt de broadcaststijl `copa_mundo` als standaard (fallback in PublicView), dark mode is de primaire ervaring (default aan).

Palet (dark): background #07110E, card #101B17, secondary surface #17241F, tekst #F5F5F0, secundaire tekst #8D9B95, accent geel #FFD600. Light: groen-getinte off-white bg, witte cards, donkergroene tekst en logo-groen #1E8D4C als primaire kleur (geen blauw meer). Geen turquoise/blauw als hoofdkleur.

Verhouding: 80-85% donkergroen/zwart, 10-15% cream, max 5-10% geel. Geel enkel voor: actieve nav/tabs, tijden, punten-pills, belangrijke knoppen, dunne lijnen — nooit grote gele vlakken.

Typografie: Montserrat (ExtraBold headings, Bold Italic uppercase sportlabels met letter-spacing, Regular/Medium body, Bold/ExtraBold cijfers).

UI: rounded 12-16px cards, dunne borders (foreground/10), nauwelijks shadows, veel spacing. Standen: dunne verticale kwalificatie-indicatoren, subtiele rijscheidingen, punten in gele pills. Bottom nav: donkere verhoogde cirkel met dunne gele rand + clublogo (geen gekleurde vulling).

Alle stijltokens staan in `src/lib/broadcastStyles.ts` onder `copa_mundo`; kleuren in `src/index.css` onder `[data-broadcast="copa_mundo"]`.
