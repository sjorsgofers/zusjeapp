# Zusje App

Interne app voor het personeel van restaurant Zusje. Werkt op telefoon, iPad en computer, en is installeerbaar als webapp (PWA — toevoegen aan beginscherm).

Live: **https://sjorsgofers.github.io/zusjeapp/** — wachtwoord: `zusje2026`

## Tabbladen
- **Dranken** — bereidingswijze per drankje (NL/EN, foto's, glas/fles-keuze bij wijn). De tegels schalen zo dat ze altijd allemaal op het scherm passen. Bron: `dranken/`.
- **Allergenen** — allergenen per gerecht opzoeken. Bron: `allergenen/`.
- **Checklists** — de checklist-app. Bron: `checklists/` (kopie van de repo `Checklists`).
- **Kiosk** — de Shiftbase-kiosk (`https://kiosk.shiftbase.com/`) fullscreen ingebed.
  Auto-login is niet mogelijk (browserbeveiliging voor externe iframes). Per apparaat éénmalig inloggen met
  **Account ID 105540** en **Kiosk code gr3gh**; de kiosk onthoudt dit daarna. Er staat een eenmalige hint in de app.

## Screensaver
Na **1 minuut** zonder muisbeweging/klik verschijnt het dashboard (`https://sjorsgofers.github.io/monitor-dashboard/`)
schermvullend. Bij de eerste beweging of klik verdwijnt het weer en is het onderliggende scherm meteen terug.
Interactie binnen de app-tabbladen telt ook als activiteit.

## PWA / webapp
`manifest.json` + `sw.js` (service worker) maken de app installeerbaar en offline-bruikbaar (behalve de externe kiosk).
Iconen: `icon-192.png`, `icon-512.png`.

## Structuur
```
index.html            # shell: tabbladen, login, screensaver, PWA-registratie
dranken/              # drankenkaart-app (index.html, data.json, images/)
allergenen/           # allergenen-app (index.html, data.json)
checklists/           # checklist-app (index.html)
manifest.json, sw.js, icon-192.png, icon-512.png, logo.png, favicon.png
```

## Bijwerken
- Dranken: `dranken/data.json` (`name`, `name_en`, `category`, `img`, `steps`, `steps_en`) + foto in `dranken/images/<code>.jpeg`.
- Allergenen: `allergenen/data.json`.
- Checklists: `checklists/index.html`.
