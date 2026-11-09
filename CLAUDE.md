# Werken bij Workspace 365: instructies voor Claude

Deze repository bevat de carrièresite van Workspace 365, in het Nederlands (`/nl/`) en Engels (`/en/`).
Julia (Talent) en Erik laten wijzigingen via Claude doorvoeren. Werk altijd volgens onderstaande afspraken.

## Waar staat wat
- `src/pages/nl/*.html` en `src/pages/en/*.html`: de pagina's. De tekst staat gewoon in de HTML. Elke pagina bestaat in beide talen.
- `src/partials/<taal>/`: de kaarten voor vacatures en teamleden.
- `data/pitches.json`: per vacature de pitchregel (nl en en) en de foto. Alleen vacatures die hier staan komen op de site.
- `data/people.json`: de teamleden (nu nog placeholders).
- `data/seo.json`: beschrijving per pagina voor zoekmachines.
- `data/vacancies.snapshot.json`: reserve als Recruitee niet bereikbaar is. De echte lijst komt bij elke build uit Recruitee.
- `public/assets/img/`: afbeeldingen. `public/assets/site.js`: interactie.
- `build.mjs`: bouwt de site naar `dist/`. `dist/` is gegenereerd, pas dat nooit aan.

## Werkwijze bij elke wijziging
1. Maak een branch `content/<korte-omschrijving>`. Werk nooit direct op `main`.
2. Pas de tekst aan in BEIDE talen. Vraagt iemand een wijziging in het Nederlands, vertaal die dan zelf naar het Engels (en andersom) en zeg dat. Twijfel je over de vertaling, vraag het.
3. Draai `node build.mjs`. Het moet zonder fout klaar zijn.
4. Commit, push en open een pull request. Netlify maakt daarvan een voorbeeldlink. Geef die link aan de aanvrager.
5. Merge pas naar `main` als de aanvrager heeft gezegd dat het goed is. Dan staat het live.

## Schrijfregels (tone of voice)
- Spreek de lezer aan met "je" (nooit "u"), en gebruik "we" voor Workspace 365.
- Geen streepjes of gedachtestreepjes als leesteken. Gebruik een punt of herschrijf de zin.
- Actieve vorm en tegenwoordige tijd. Korte, heldere zinnen.
- Engels is Brits Engels (organise, personalise).
- Belofte: "Wij maken alles eenvoudig" / "Everything simplified". Leidende term: "intelligente werkplek" / "intelligent workspace".
- Kelly is "zij" / "she", een AI-collega, nooit een chatbot.
- Geen buzzwoorden: naadloos, adaptief, revolutionair, stroomlijnen, cutting-edge, gamechanger, moeiteloos, ontzorgen.

## Vacatures
- De feiten (titel, uren, salaris, contract) komen uit Recruitee. Pas die dus niet in deze repository aan, maar in Recruitee.
- Een nieuwe vacature verschijnt pas na een regel in `data/pitches.json` met een pitch in het Nederlands en Engels (één zin) en een foto in `public/assets/img/`. De build meldt vacatures zonder pitch.
- Is een vacature gesloten, dan verdwijnt hij vanzelf bij de volgende build. Laat de regel in `pitches.json` staan of verwijder hem, dat maakt niet uit.

## Afbeeldingen
Maximaal 1600 pixels breed, jpg, liefst onder 300 kB. Geef afbeeldingen een beschrijvende `alt` in de taal van de pagina.

## Niet doen
- Geen lay-out, kleuren of lettertypen aanpassen zonder expliciete vraag. Het ontwerp is bewust zo gemaakt.
- Geen persoonsgegevens of tokens in de repository zetten. Het Recruitee-token en de build hook staan alleen in Netlify.
- Geen foto's van mensen toevoegen zonder dat de aanvrager bevestigt dat die persoon toestemming heeft gegeven.
