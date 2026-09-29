# Stap 1: live loting als vaste toernooiweergave

## Doel
De pouleloting en speelrondeloting openen niet langer als pop-up, maar nemen tijdelijk de beheerweergave over binnen hetzelfde browsertabblad. De organisator kan altijd bewust terug naar het toernooi en hervat later dezelfde loting per fase.

## Wat wordt gebouwd

### 1. Eén vaste lotingsweergave
- De knop **Live loting** opent een schermvullende weergave binnen de huidige toernooipagina.
- Bovenaan komt **← Terug naar toernooi**; de gewone indeling blijft verborgen zolang de lotingsweergave actief is.
- Het keuzescherm **Wat wil je loten?**, de pouleloting en de speelrondeloting gebruiken dezezelfde vaste omkadering.
- Alleen noodzakelijke bevestigingen, zoals het overschrijven van een bestaande indeling, blijven als bevestigingsvenster bestaan.
- Klikken buiten de loting kan de loting daardoor niet meer sluiten.

### 2. Automatisch hervatten per fase
- Beide lotingen bewaren hun actuele stap, methode, regels, potindeling, matrix en voortgang automatisch per fase in de browser.
- Ook de keuze **volledige loting / alleen poules / alleen speelrondes** wordt per fase onthouden zolang de flow actief is.
- Bij vernieuwen of terugkeren wordt het concept hersteld nadat de actuele teams, groepen en plaatsen zijn geladen.
- Verouderde of ongeldige verwijzingen naar verwijderde teams, groepen of potten worden bij herstel veilig genegeerd.
- Een toegepaste loting wist het bijbehorende concept; teruggaan bewaart het concept juist.

### 3. Actief licht of donker thema
- `draw-dialog-theme` wordt een gedeelde lotingsthemalaag zonder afgedwongen donkere kleuren.
- Achtergronden, tekst, panelen, tabellen en invoervelden volgen de actieve licht/donker-instelling van Copa Mundo.
- Goud/geel blijft het herkenbare accent voor geselecteerde keuzes, randen en primaire acties.
- Dezelfde stijl blijft gelden in alle stappen en in de schermvullende lotingspresentatie.

### 4. Startkeuze in Copa Mundo-stijl
- **Volledige loting**, **Alleen poules loten** en **Alleen speelrondes loten** worden grote keuze­kaarten binnen de vaste lotingsweergave.
- Elke kaart gebruikt dezelfde `draw-choice`-hiërarchie als beide lotingsflows.
- Geselecteerde of geactiveerde kaarten krijgen uitsluitend de gouden boven- en onderrand met de subtiele primaire achtergrond.

### 5. Eén poule automatisch overslaan
- Heeft een speelrondefase exact één poule, dan toont Copa Mundo het keuzescherm **Wat wil je loten?** niet.
- De knop **Live loting** opent dan direct **Alleen speelrondes loten** met de bestaande poule-indeling.
- De bestaande controle en bevestiging voor het vervangen van al aangemaakte speelrondes blijft behouden.

## Technisch
- `GroupManager` beheert één actieve lotingsweergave en rendert die in plaats van de normale indelingsinhoud.
- `LiveDrawDialog` en `RoundsDrawDialog` worden presentatieweergaven zonder `Dialog`/overlay, met een gedeelde terugactie.
- Per flow komt een versieerbaar, fasegebonden localStorage-concept; alleen gebruikersinvoer en lotingsvoortgang worden opgeslagen, terwijl actuele brongegevens opnieuw uit de database worden geladen.
- De bestaande definitieve opslag van poules, speelrondes en lotingsverslagen blijft ongewijzigd.

## Controle
- Controleren in licht en donker thema dat kaarten, panelen, tabellen, keuzestatussen en het volledige lotingsscherm leesbaar en gelijkvormig zijn.
- Controleren dat teruggaan en vernieuwen de loting hervatten.
- Controleren dat toepassen het concept verwijdert.
- Controleren dat één poule direct naar speelrondes gaat en meerdere poules de drie keuzes tonen.
- Typecontrole en de hoofdflows in de browser uitvoeren.
