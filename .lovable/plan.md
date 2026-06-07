## Doel

Live Loting wordt uitgebreid op twee plekken bij een groepsfase in Fase 1:

1. **Groepen-loting** (bestaande knop "Live Loting" naast "Willekeurige indeling")  
   → potten configureerbaar maken
2. **Wedstrijd-loting** (nieuw, naast bestaande "AUTOMATISCHE INPLANNING" / "HANDMATIGE INPLANNING" in de competitieformat-selector)  
   → derde optie "LIVE LOTING" voor het loten van de wedstrijden zelf

Bracket / single match wordt nu niet aangepast. Knock-outfase ook niet. Focus: groepsfase (single leg, home & away, meerdere ontmoetingen, speelrondes).

---

## 1. Groepen-loting met configureerbare potten

In `LiveDrawDialog` (groep-modus) wordt de optieblok uitgebreid wanneer "Potten gebruiken" aanstaat:

- **Aantal potten** — selector. Standaardwaarde = aantal groepen. Toegestaan: 1 t/m aantal teams.
- **Verdeling per pot** — auto berekend op basis van totaal teams / aantal potten, met de rest evenwichtig verdeeld over de eerste potten. Voorbeeld: 25 teams / 4 potten → 7-6-6-6. Tabel toont elke pot met zijn grootte; de gebruiker kan elke pot handmatig overschrijven met een number-input. Validatie: som moet gelijk zijn aan aantal teams; toon foutmelding anders en disable Start.
- **Verdeling over groepen** — algoritme: 
  - Voor elke pot in volgorde, neem een willekeurige permutatie van de groepen en plaats één team per groep, totdat de pot leeg is of alle groepen vol zijn.
  - Groepen met een vrije slot in de huidige pot worden eerst gevuld; oneven aantallen (bv. 5 groepen van 4 + 1 groep van 5) werken automatisch omdat pot-grootte ≠ aantal groepen toegestaan is.
- **Avoid same country** blijft optie, gegarandeerd best-effort (≤ 40 retries).
- Pot-by-pot reveal: animatie toont eerst alle teams van Pot 1 met label "POT 1", verdeelt die, dan Pot 2 etc.

---

## 2. Wedstrijd-loting (nieuw)

Vervangt geen bestaande functionaliteit; voegt een derde knop toe in `renderCompetitionTypeSelector` van `GroupManager`:

```
[ AUTOMATISCHE INPLANNING ]  [ HANDMATIGE INPLANNING ]  [ LIVE LOTING ]
```

(Voor alle competitieformats: single_leg, home_away, multiple, rounds.)

Bij opslaan met `dialogMatchGenMode === "live_draw"`:
- Groep en slots worden zoals nu aangemaakt, maar **geen** wedstrijden gegenereerd door `generateMatchesForGroup`. In plaats daarvan opent direct na opslaan een nieuwe `LiveDrawDialog` in modus **"matches"**.

In de Live Loting voor wedstrijden:
- **Detect state** — zijn er al teams ingedeeld in slots?
  - Ja → keuzevraag: "Loot enkel wedstrijden" of "Loot ook groepen opnieuw".
  - Nee → automatisch "groepen + wedstrijden".
- **Groepen-stap** (indien gekozen) — zelfde flow als hierboven.
- **Wedstrijden-stap** — keuze:
  - **Willekeurig** — pure random pairing per ronde, respecteert het competitieformat.
  - **Met potten** — gebruiker definieert potten **binnen elke groep** (default = elk team is z'n eigen pot, dus 4 potten in een groep van 4) en een matrix:
    
    ```
            vs P1  vs P2  vs P3  vs P4
    Pot 1   [ 1 ]  [ 1 ]  [ 2 ]  [ 2 ]
    Pot 2   [ 1 ]  [ 1 ]  [ 2 ]  [ 2 ]
    Pot 3   [ 2 ]  [ 2 ]  [ 1 ]  [ 1 ]
    Pot 4   [ 2 ]  [ 2 ]  [ 1 ]  [ 1 ]
    ```
    
    Matrix is symmetrisch (cel [i][j] = [j][i]); diagonaal = wedstrijden binnen dezelfde pot. Som per rij = totaal wedstrijden per team (afgeleid van competitieformat). Validatie blokkeert Start als de som niet klopt.
- Animatie: per ronde worden de pairings geanimeerd onthuld; bij potten-mode wordt eerst Pot-i geselecteerd, dan een tegenstander uit Pot-j volgens de matrix-budgetten.
- **Persistence** — voor elke groep: leeg bestaande matches, insert nieuwe matches met `home_team_id`, `away_team_id`, `home_slot_label`, `away_slot_label`, `round_number`.

---

## Technische details

**Wijzigingen**

- `src/components/LiveDrawDialog.tsx`
  - Nieuwe prop `mode: "groups" | "matches"` (default afgeleid uit `phaseType` zoals nu).
  - Pot-configuratie state: `potCount`, `potSizes: number[]`.
  - Wedstrijd-loting state: `matchPotCount`, `matchPotAssignment` (per slot welke pot), `matchupMatrix: number[][]`.
  - `drawPlan` uitgebreid met pot-aware groepsverdeling.
  - Nieuwe `buildMatchDrawPlan()` die uit groep-slots, matrix en aantal rondes een lijst pairings construeert met backtracking om matrix-budget te respecteren.
  - `persistAssignments()` uitgebreid met matches-insert voor "matches"-mode.

- `src/components/GroupManager.tsx`
  - `MatchGenMode` uitbreiden van `"auto" | "empty"` naar `"auto" | "empty" | "live_draw"`.
  - Derde knop in `renderCompetitionTypeSelector`.
  - `addGroup` en `saveGroupEdit`: als mode = `live_draw`, sla groep + slots op, sla `generateMatchesForGroup` over en open `LiveDrawDialog` in `mode="matches"` met de juiste groep-id ingevuld.
  - State `matchDrawOpen` + targetGroupId.

- Geen database-schema-wijzigingen.

**Niet in scope (nu)**

- Knockout / single match draw (blijft zoals het is)
- PNG-export / presenter shell
- Swiss-league specifieke draw (round-per-round pot selectie)
- Wijzigingen aan andere fases dan Fase 1

---

## Validatie

- TypeScript build draait door.
- Bestaande "Willekeurige indeling" en "Live Loting" voor groepen blijft werken (potten = nu configureerbaar, default = uit zoals nu).
- Nieuwe `LIVE LOTING` knop is alleen klikbaar in Fase 1 (`showRandomAssign === true`).
