# Fanweergave voor live pouleloting

## Wat ik bouw
- Het aangeleverde gouden decor wordt als visuele basis gebruikt, opgeschoond zodat de poules en teaminformatie live ingevuld worden.
- Het gedeelde lotingsbeeld krijgt dynamische poulevleugels: de eerste helft links en de tweede helft rechts, met lege plaatsen en reeds geplaatste teams.
- Op het centrale podium verschijnt de getrokken teamkaart met logo, land en teamnaam; de stille bal opent links en rechts.
- Tijdens de pouletrekking blijven alleen geldige poules actief zichtbaar en loopt de gouden focus langs deze opties.
- Het regievenster en `/draw/:phaseId` gebruiken exact hetzelfde fanbeeld; alleen de organisator ziet een zwevende bedieningsbalk.
- De indeling schaalt mee voor afwijkende aantallen poules en teams zonder dat kaarten of bediening overlappen.

## Controle
- Desktop- en mobiele verhoudingen visueel controleren.
- Regiebeeld en publiek beamerscherm vergelijken.
- Controleren dat de app foutloos bouwt en dat de lotingsanimaties verminderde beweging respecteren.

## Technisch
- Eén gedeelde `DrawShow` blijft de bron voor beide schermen.
- Het decor wordt lokaal als appbeeld gebruikt; poulekaarten en teamdata blijven echte interface-elementen.
- De bestaande realtime lotingssessie en lotingsregels blijven ongewijzigd.
