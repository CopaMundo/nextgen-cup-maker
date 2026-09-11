---
name: Broadcaststijlen en vormgevingskeuze
description: Definitieve lijst broadcaststijlen, welke light/dark varianten beschikbaar zijn en dat de beheerder (niet de bezoeker) de vormgeving kiest
type: feature
---

Er zijn nog exact 6 broadcaststijlen (`SELECTABLE_BROADCAST_STYLES`): `copa_mundo_bc`, `european_nights`, `wc26`, `la_rosa`, `teletext`, `retro_bw`. Serie A en alle oudere thema's (champions_league, fifa, retro, espn, street, data_geek, gazette, social, copa_mundo, netflix, retro_football, joga_bonito, old_newspaper, modern_bw, soccertec, old_clubhouse, sticker_album, world_cup_*) zijn volledig verwijderd uit code en `index.css`.

`retro_bw` heet in de UI **Stadium Noir**.

Beschikbare vormgevingen per stijl (`STYLE_APPEARANCES`):
- copa_mundo_bc: Light + Dark; standaard Dark
- la_rosa: Light + Dark
- teletext: P500 (dark) + P800 (light); standaard P500
- european_nights: enkel dark; toon geen tekst over een vaste layout
- wc26: enkel light
- retro_bw: enkel dark

Bij stijlen met Light en Dark staat Light visueel altijd als eerste. La Rosa gebruikt standaard Light. De variantkeuzes zijn pas zichtbaar nadat de stijlkaart geselecteerd is; stijlen zonder keuze tonen geen extra tekst.

De beheerder kiest de vormgeving in de stijlkaart bij Presentatie > Vormgeving; dit wordt opgeslagen in `tournaments.view_display_appearance`. De publieke bezoeker kan de vormgeving NIET meer wisselen — de light/dark- en P500/P800-schakelaar op de publieke infopagina is verwijderd.
