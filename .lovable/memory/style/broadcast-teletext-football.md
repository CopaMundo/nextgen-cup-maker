---
name: Broadcast Teletext Football
description: teletext stijl — klassieke voetbalteletekst/Ceefax results service, zwart met cyan/geel/groen/rood, VT323 als enige lettertype, 0px radius
type: design
---

Broadcast style #12, key `teletext`, label "Teletext Football".

Palet (dark, authentiek): bg/cards #000000, secundair #101010, tekst #FFFFFF, secundair #BFBFBF.
Functionele teletextkleuren: cyan #00FFFF (nav, sectietitels, tijden), yellow #FFFF00 (scores, selectie, datum),
green #00FF00 (kwalificatie/winnaar/afgewerkt), red #FF3030 (LIVE), blue #0066FF (tabelheaders).
Light mode = "printed teletext": bg #F2F2EE, surfaces #FFFFFF, tekst #111111. Gele tekst op wit wordt
vervangen door een donkere drukvariant (amber/olijf #8B7500) zodat alles leesbaar blijft; gele vlakken
(.ttx-bar-yellow) houden zwarte tekst.

Typografie: VT323 als ENIGE lettertype voor de volledige broadcaststijl — titels, scores, tijden, standen,
pagenummers, bodytekst en labels. Geen IBM Plex Mono meer. Veel uppercase, monospaced uitlijning,
scores groter dan echte teletext voor mobiele leesbaarheid.

Vormtaal: border-radius 0 overal (globale `!important` override binnen de stijl), geen shadows, geen gradients,
geen floating cards. In plaats daarvan platte `.ttx-panel` regels met boven/onderlijn, gekleurde balken
(`.ttx-bar-cyan/-yellow/-blue/-red`), dashed `.ttx-rule` separators en kolomstructuren.

Extra tokens: `.ttx-qual` (groene inset kwalificatiemarker), `.ttx-connector` (rechte cyan bracketlijnen,
crispEdges), `.ttx-cover` (cover in video-window met scanline-dither en 4-kleuren teletextbalk onderaan),
teamsraster met teletext pagenummers (201, 202, …) via counters.

Varianten (schakelaar i.p.v. light/dark): P500 (Belgisch, data-ttx-variant="500", cyan-dominant, gele scores,
witte teamnummers vanaf 501, donkerblauwe prismalijn/sectionLine/tijdsblokken met witte tekst) en P800
(Nederlands, data-ttx-variant="801", groene koppen, rode balken, teamnummers vanaf 801 via counter-reset 800,
oranje prismalijn + oranje info-icoontjes/tekst op infopagina).
