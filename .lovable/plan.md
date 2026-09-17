# Live loting met potten in Copa Mundo

## Wat ik voorstel

Matchmaker Swiss is een apart project met zijn eigen gegevensopslag. Twee projecten echt dezelfde gegevens laten delen is rommelig en kwetsbaar: elke wijziging in Copa Mundo moet dan ook in Matchmaker kloppen, en je hebt altijd twee plaatsen die stuk kunnen gaan.

Omdat je zelf koos om de loting hier in te bouwen, bouwen we de volledige lotingsmodule in Copa Mundo. Je hebt dan alles op één plek: format aanmaken, potten samenstellen, live loting, wedstrijden genereren. Geen import/export nodig, geen tweede app om te onderhouden.

## Wat je krijgt

**1. Potten samenstellen (per fase)**
- Je maakt zelf potten aan (Pot 1, Pot 2, ... of eigen namen).
- Deelnemers naar potten slepen of automatisch verdelen.
- Deelnemers die nog in geen pot zitten blijven duidelijk apart staan.

**2. Lotingsregels**
- Per groepsfase: uit elke pot precies één deelnemer per groep (klassieke opzet), of vrije verdeling.
- Bij speelrondes: welke pot tegen welke pot speelt en hoeveel keer.
- Optionele beperkingen: deelnemers uit hetzelfde land / dezelfde club niet in dezelfde groep, en handmatig geblokkeerde combinaties.

**3. Live loting**
- Een schermvullende lotingsweergave: pot kiezen, deelnemer trekken, animatie, en de deelnemer landt in de groep of het duel.
- Stap voor stap of alles in één keer.
- Ongedaan maken van de laatste trekking, en volledig opnieuw loten.
- Werkt in het thema van de app, ook geschikt om op een scherm te tonen.

**4. Wedstrijden direct erna**
- Zodra de loting klaar is, worden de wedstrijden aangemaakt volgens het gekozen format (enkele wedstrijd, heen en terug, of aantal speelrondes).
- Je kan daarna nog altijd handmatig aanpassen zoals nu.

## Technisch

- Nieuwe tabellen: `draw_pots` (naam, sort_order, fase, categorie) en `draw_pot_teams` (pot ↔ team), plus lotingsregels in `match_config` van de fase (pot-tegen-pot matrix, aantal ontmoetingen, restricties). GRANT + RLS via `is_tournament_owner`, zoals de bestaande tabellen.
- Nieuwe componenten: `DrawPotsManager.tsx` (potten beheren), `LiveDrawDialog.tsx` (live loting), en een `src/lib/drawEngine.ts` met de trekkingslogica en restrictiecontrole (met terugval als een trekking vastloopt).
- Toewijzing gebeurt op de bestaande `slots`; wedstrijdgeneratie hergebruikt `generateRoundRobin` uit `src/lib/matchGenerator.ts` en de bestaande insert-logica in `GroupManager.tsx`, zodat doorstroming en planning ongewijzigd blijven werken.
- Ingangen: knop **Loting** in de Indeling-titelbalk naast de bestaande willekeurige indeling; die bestaande knop blijft ongewijzigd.

## Aanpak in stappen

1. Potten: database + beheerscherm.
2. Lotingsregels per fase (pot-tegen-pot, aantal keer, restricties).
3. Lotingsmotor met restricties en terugval.
4. Live lotingsweergave met animatie en ongedaan maken.
5. Wedstrijden genereren na de loting.
