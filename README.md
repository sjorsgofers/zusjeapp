# Zusje App

Interne app voor het personeel van restaurant Zusje. Werkt op telefoon, iPad en computer.

Live: **https://sjorsgofers.github.io/zusjeapp/** — wachtwoord: `zusje2026`

## Tabbladen
- **Dranken** — bereidingswijze per drankje opzoeken (NL/EN, foto's, glas/fles-keuze bij wijn). Bron: `dranken/`.
- **Allergenen** — allergenen per gerecht opzoeken. Bron: `allergenen/`.
- **Kiosk** — de Shiftbase-kiosk (`https://kiosk.shiftbase.com/`) fullscreen ingebed.
  Auto-login is niet mogelijk (browserbeveiliging voor externe iframes). Per apparaat éénmalig inloggen met
  **Account ID 105540** en **Kiosk code gr3gh**; de kiosk onthoudt dit daarna. Er staat een eenmalige hint in de app.

## Structuur
```
index.html            # shell met tabbladen + gezamenlijke login
dranken/              # drankenkaart-app (index.html, data.json, images/)
allergenen/           # allergenen-app (index.html, data.json)
logo.png / favicon.png
```

## Bijwerken
- Dranken: `dranken/data.json` (`name`, `name_en`, `category`, `img`, `steps`, `steps_en`) + foto in `dranken/images/<code>.jpeg`.
- Allergenen: `allergenen/data.json`.
