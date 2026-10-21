---
name: Copa Mundo public design system
description: Visual identity of the public tournament view (broadcast style copa_mundo) — palette, typography, yellow accent rules
type: design
---
De publieke toernooiweergave gebruikt `copa_mundo_bc` als standaard, dark mode is de primaire ervaring (default aan).

Laatste keuze: alleen Copa Mundo Light en Dark volgen het huidige beheerthema. Dark: rijke nachtblauwe achtergrond (222 35% 11%), panelen (222 35% 16%), secundaire vlakken (222 34% 21%), zachtwitte tekst en origineel logo-geel (52 100% 50%). Light: witte achtergrond/panelen, zwart/donkergrijze tekst, subtiele grijze randen en Copa-blauwe knoppen/actieve accenten (220.17 100% 23.14%). Andere broadcaststijlen en liveshow-thema's blijven ongewijzigd; bestaande publieke indeling en werking behouden.

Verhouding: 80-85% donkergroen/zwart, 10-15% cream, max 5-10% geel. Geel enkel voor: actieve nav/tabs, tijden, punten-pills, belangrijke knoppen, dunne lijnen — nooit grote gele vlakken.

Typografie: bestaande Inter-typografie behouden.

UI: rounded 12-16px cards, dunne borders (foreground/10), nauwelijks shadows, veel spacing. Standen: dunne verticale kwalificatie-indicatoren, subtiele rijscheidingen, punten in gele pills. Bottom nav: donkere verhoogde cirkel met dunne gele rand + clublogo (geen gekleurde vulling).

Alle stijltokens staan in `src/lib/broadcastStyles.ts` onder `copa_mundo`; kleuren in `src/index.css` onder `[data-broadcast="copa_mundo"]`.
