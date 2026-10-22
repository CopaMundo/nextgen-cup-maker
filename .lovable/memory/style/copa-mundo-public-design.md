---
name: Copa Mundo public design system
description: Visual identity of the public tournament view (broadcast style copa_mundo) — palette, typography, yellow accent rules
type: design
---
De publieke toernooiweergave gebruikt `copa_mundo_bc` als standaard, dark mode is de primaire ervaring (default aan).

Laatste keuze: alleen Copa Mundo Light en Dark volgen het huidige beheerthema. Dark: vaste Deep Navy-ladder (canvas #111C35 = 222 51% 14%, panelen #182647 = 222 50% 19%, randen/velden #243763 = 222 47% 26%, infobalken 222 49% 22%); kaders en kaarten delen die pagina-achtergrond met enkel een subtiele rand, secundaire vlakken alleen voor infobalken van wedstrijdkaarten, zachtwitte tekst en origineel logo-geel (52 100% 50%). Light: witte achtergrond/panelen, zwart/donkergrijze tekst, subtiele grijze randen en Copa-blauwe knoppen/actieve accenten (220.17 100% 23.14%). Andere broadcaststijlen en liveshow-thema's blijven ongewijzigd; bestaande publieke indeling en werking behouden. De voorlopige navy-preview-schakelaar is verwijderd; Deep Navy is de vaste standaard in donker (beheer + publiek, desktop en mobiel).

Ook op de mobiele publieke link volgen alle achtergronden het huidige thema: wit in Light en rijk nachtblauw in Dark, inclusief de achtergrond bij doorscrollen. Geen oude zwarte achtergrond in Light. Accentkleuren blijven spaarzaam voor actieve navigatie, tijden, punten en belangrijke knoppen.

De hele site deelt dit thema: de algemene pagina's (inloggen, registreren, zoek toernooien, Mijn Toernooien, profiel, landingspagina) gebruiken dezelfde basistokens als beheer en publieke link — Dark: Deep Navy-ladder met geel accent; Light: wit, donkergrijze tekst, grijze randen, blauwe accenten. Nooit terug naar de oude groen-zwarte donkertinten of blauwgrijze lichte tekst.

Typografie: bestaande Inter-typografie behouden.

UI: rounded 12-16px cards, dunne borders (foreground/10), nauwelijks shadows, veel spacing. Standen: dunne verticale kwalificatie-indicatoren, subtiele rijscheidingen, punten in gele pills. Bottom nav: donkere verhoogde cirkel met dunne gele rand + clublogo (geen gekleurde vulling).

Alle stijltokens staan in `src/lib/broadcastStyles.ts` onder `copa_mundo`; kleuren in `src/index.css` onder `[data-broadcast="copa_mundo"]`.
