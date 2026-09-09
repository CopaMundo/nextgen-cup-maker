# Uniforme selectors in de beheeromgeving

## Doel
Alle uitklapbare keuzes in het toernooibeheer krijgen dezelfde compacte, duidelijke stijl als de filters onder **Plannen** in Schema. Gewone actie- of inklapknoppen die geen keuze openen, blijven ongewijzigd.

## Aanpassingen
- Maak één herbruikbare selectorstijl voor het gesloten vak, de pijl, het geopende keuzemenu, actieve waarden, lege toestand en uitgeschakelde toestand.
- Trek die stijl door naar de divisie- en locatiekeuze in de titelbalk en mobiele werkbalk.
- Gebruik dezelfde stijl voor de planningsfilters: poules/brackets, rondes en velden.
- Trek de stijl door naar overige echte keuzelijsten in de beheeromgeving, inclusief keuzes in pop-ups en instellingen.
- Behoud selectievakjes uitsluitend bij meervoudige keuzes; enkelvoudige keuzes tonen gewone keuzerijen zonder selectievakje.
- Laat actie-menu’s, bewerkmenu’s, gewone inklapknoppen en de publieke pagina buiten deze wijziging.

## Technische details
- Gebruik de bestaande semantische kleuren, focusstijl met alleen de blauwe boven- en onderlijn, typografie en compacte afmetingen.
- Bouw waar mogelijk voort op de gedeelde Select-component; vervang losse native keuzelijsten en maatwerk-triggers in het beheer door dezelfde gedeelde presentatie zonder hun werking te wijzigen.
- Bewaar bestaande selectie-, wis-, multi-select- en opslaglogica.
- Controleer titelbalk, Schema-filters, formulieren en pop-ups op desktop en mobiel, plus de typecontrole.
