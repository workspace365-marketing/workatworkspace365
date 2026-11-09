# Werken bij Workspace 365

Carrièresite in het Nederlands en Engels. Statisch gebouwd met `node build.mjs`, gehost op Netlify.

## Lokaal bekijken
```
node build.mjs
npx serve dist
```

## Eenmalig instellen in Netlify (Erik)
1. Netlify: Add new project, Import from Git, kies deze repository. Build command `node build.mjs`, publish directory `dist` (staat al in `netlify.toml`).
2. Domein: koppel het gewenste adres (bijvoorbeeld `werkenbij.workspace365.net`) en zet `SITE_URL` op dat adres.
3. Vacatures: zet `RECRUITEE_TOKEN` (Careers API token uit Recruitee: Instellingen, Apps en plugins, API-tokens). Zonder token probeert de build de openbare feed.
4. Elke ochtend automatisch vernieuwen: maak in Netlify een Build hook en zet die als `BUILD_HOOK_URL`. De functie `netlify/functions/daily-rebuild.mjs` start dan elke ochtend rond 6.30 uur (Nederlandse tijd) een nieuwe build.
5. Contactformulier: Netlify, Forms, Form notifications, zet het e-mailadres van het Talent team. Het formulier heet `contact`.
6. Voorbeeldlinks: zet Deploy Previews aan, zodat elke pull request een eigen testlink krijgt.

## Wijzigingen laten doen
Julia vraagt Claude om een wijziging, bijvoorbeeld "Pas op de cultuurpagina de eerste alinea aan". Claude werkt volgens `CLAUDE.md`: eerst een voorbeeldlink, na goedkeuring live.

## Nog open voor livegang
- Teamprofielen: `data/people.json` bevat nog placeholders (naam, functie, intro).
- Contactpagina: de reactietijd (`[aantal] werkdagen`) en de link naar de privacyverklaring.
- Privacy: het formulier slaat gegevens en cv's op bij Netlify. Laat dat controleren door wie de privacyverklaring beheert.
- Foto's: controleer of alle mensen op de foto's toestemming hebben gegeven voor publicatie.
- Recruitee: de titel "Senior Customer Succes Manager" bevat een typfout (Succes) en de tag "High light" ook.
