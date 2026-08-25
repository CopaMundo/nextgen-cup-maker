---
name: Broadcast style Old Clubhouse
description: Specs van de old_clubhouse broadcaststijl (oud wedstrijd-/uitslagenbord uit een voetbalkantine) voor de publieke toernooipagina's
type: design
---

Broadcast Style #10 `old_clubhouse` — "Old Clubhouse".

- Palet: clubhouse green #263326, donkergroen #17231A, scoreboard zwart #11110F, donker hout #4A3423, middenbruin hout #6A4B30, crème #E7D9B8, licht papier #F0E6CE, inkt #171713, tekst op donker #F1E8D2, secundair #817968, green accent #536B3D, messing #A68A50. Light = crème papier, dark = donkergroen bord.
- Typografie: Oswald 600/700 uppercase (titels, scores, tijden, labels) + Roboto Condensed / Arial Narrow body.
- Radius 2px, geen shadows of gradients (globaal uitgeschakeld voor deze stijl).
- Materiaalhiërarchie: `.och-frame` (hout, hoofdframes/nav/logo-omkadering), `.och-board` (zwart letterboard met horizontale gleuven — wedstrijdkaarten, standen), `.och-paper` (crème papier — scores, badges, info), `.och-enamel` (+ `.och-screws` schroefdetails — headers, tabs, datum/tijdslot), `.och-cork` (bijlagen/documentenbord).
- Scores en punten zijn crème `och-paper` nummerplaatjes; kwalificatie via `.och-qual` (messing marker links op de rij); bracketlijnen `.och-connector` (crème/grijs, 1.25px); infopagina cover `.och-cover` met houten onderrand.
