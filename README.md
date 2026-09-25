# Alif Ba Qur'ani – leesapp voor kinderen

Webapp (PWA) bij het boekje *قاعدة ألف با قرءاني*. Kinderen tikken op een vierkant en horen de uitspraak.
Werkt in de browser en kan op telefoon/tablet worden geïnstalleerd ("Toevoegen aan beginscherm"), ook offline.

## Structuur
- `index.html`, `style.css`, `app.js` – de app
- `book-data.js` – alle pagina's en de positie van elk vierkant (automatisch uit de PDF gehaald)
- `pages/` – de pagina's als afbeelding (uit de PDF, 150 dpi)
- `audio/` – hier komen de opnames
- `opnamelijst.csv` – lijst van alle 912 benodigde opnames met bestandsnaam (openen in Excel)

## Opnames toevoegen
Zet elk mp3-bestand in `audio/` met de naam uit `opnamelijst.csv`, bijvoorbeeld `p10_01.mp3`.
- `p10` = pagina 10 van de PDF
- `01` = vierkant 1; nummering loopt **van rechts naar links, van boven naar beneden** (leesvolgorde)

Ontbreekt een opname, dan wiebelt het vierkant en verschijnt "Opname volgt nog".
Na het vervangen van opnames: verhoog `VERSION` in `sw.js` zodat telefoons de nieuwe versie ophalen.

## Pagina's zonder vierkanten (tekstregels, tabellen)
Open de app met `?bewerk` achter het adres (bijv. `http://localhost:8080/?bewerk`), ga naar de pagina,
sleep rechthoeken over de woorden/regels, en klik op **Exporteer book-data.js**. Vervang daarna het bestaande bestand.

## Lokaal testen
Rechtsklik `serve.ps1` > *Uitvoeren met PowerShell* en open http://localhost:8080.

## Publiceren
- **Web**: upload de hele map naar een statische host (GitHub Pages, Netlify, Cloudflare Pages). HTTPS is nodig voor installeren/offline.
- **App Store / Play Store**: later dezelfde code verpakken met Capacitor; er hoeft niets opnieuw gebouwd te worden.
