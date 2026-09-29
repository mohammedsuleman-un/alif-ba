# Illustratie-assets voor Alif Ba — wat er nog aangeleverd moet worden

Dit document beschrijft exact welke afbeeldingen nodig zijn om het huidige
tijdelijke SVG-poppetje en de CSS-kleurverloop-wereldkaart te vervangen door
professionele illustraties. De code is al volledig voorbereid: zodra een
bestand op het juiste pad staat, gebruikt de app het automatisch — geen
code-aanpassing nodig. Ontbreekt een bestand, dan blijft de bestaande
tijdelijke versie gewoon zichtbaar (nette fallback, geen kapotte plek).

Stijlreferentie die is meegenomen: https://quran.ghaarsa.com/ (geïllustreerde
kinderpersonages + gerenderde moskee/natuur-achtergronden, Duolingo-achtige
padkaart). Dat kwaliteitsniveau is het doel.

---

## 1. Personage-illustraties

### Waar het personage wordt getoond
Home-scherm, wereldkaart (marker op huidige positie), tijdens oefeningen
(companion rechtsonder), level-compleet-scherm (groot, gevierd), Beloningen
n.v.t. direct maar badge-context, Profiel (mini-avatar per profielkaart),
Kledingkast (voorbeeld + grid), Onboarding/personage-maker (live preview).
Al deze plekken roepen dezelfde functie aan (`Character.render`), dus **één
set assets bedient de hele app**.

### Structuur
```
assets/characters/
  girl/
    idle/ listening/ thinking/ encouraging/ happy/ celebrate/ proud/ wave/
  boy/
    idle/ listening/ thinking/ encouraging/ happy/ celebrate/ proud/ wave/
```
(Deze mappen bestaan al in de repo, nu nog leeg.)

### Twee manieren om assets te koppelen

**A. Eén "default" beeld per combinatie van type + mood** (snelste start,
dekt meteen de hele app voor iedereen):
```
assets/characters/girl/idle/default.webp   (of .png)
assets/characters/girl/wave/default.webp
assets/characters/boy/celebrate/default.webp
... enz. (8 moods × 2 types = 16 bestanden voor een volledige basisdekking)
```
Dit is ongeacht de gekozen outfit/hijab/schoentjes — dus 16 illustraties
geven al een volledig werkende, mooie app.

**B. Specifiek per outfit** (optioneel, voor als je wilt dat de kleding
in de illustratie zelf ook echt verandert): vul in `character-data.js` bij
het betreffende item het `assets`-veld in, bv.:
```js
{ id: "outfit_girl_starter", ..., assets: {
    idle: "assets/characters/girl/idle/outfit_girl_starter.png",
    happy: "assets/characters/girl/happy/outfit_girl_starter.png",
    celebrate: "assets/characters/girl/celebrate/outfit_girl_starter.png",
    wave: "assets/characters/girl/wave/outfit_girl_starter.png",
  } }
```
Je hoeft niet alle 8 moods per outfit te doen — wat ontbreekt valt terug op
de "default" van optie A. Zo kun je geleidelijk uitbreiden: begin met A,
verrijk later specifieke outfits met B.

### Bestandsspecificatie
| Eigenschap | Waarde |
|---|---|
| Bestandsnaam | `default.webp` (of `.png`) per moodmap, of `<item-id>.png` bij optie B |
| Formaat | WebP met transparantie (voorkeur) of PNG-24 met alpha-transparantie |
| Achtergrond | **Transparant** — het personage staat los op elke achtergrond (home, kaart, wit kledingkast-scherm) |
| Aanbevolen resolutie | 480 × 690 px (verhouding ≈ 0.7 : 1, zelfde als huidige viewBox 120×172) |
| Aspect ratio | Staand, ~7:10 |
| Pose-framing | Volledig lichaam zichtbaar (hoofd tot voeten), personage gecentreerd, ruimte boven het hoofd voor eventuele badge/overlay |
| Jongen/meisje | Apart — geen gezichtsbedekking, meisje draagt altijd een hijab in de gewone spelervaring |
| Kledingvariant | Zie optie A/B hierboven |

### Verplichte 8 poses/moods (en waar ze zichtbaar zijn)
| Mood | Gebruikt in |
|---|---|
| `idle` | Home, kledingkast-voorbeeld, rustmoment tijdens oefening |
| `listening` | Tijdens het afspelen van audio-instructies |
| `thinking` | Wanneer het kind een vraag overweegt |
| `encouraging` | Na een fout antwoord (NOOIT verdrietig — bemoedigend, "probeer nog eens") |
| `happy` | Na een goed antwoord |
| `celebrate` | Level-compleet-scherm, 3-sterren-moment |
| `proud` | Badge/wereld-voltooid moment |
| `wave` | Wereldkaart-marker, begroeting bij openen personage |

(De code kent ook nog `surprised` als extra mood-optie — niet verplicht,
mag je overslaan.)

---

## 2. Wereld-achtergronden ("woestijn → bos" en overige werelden)

### Waar
Achtergrond van de volledige wereldkaart (`#/spel/wereld/<id>`), achter het
pad met levelknopen.

### Structuur
```
assets/worlds/
  oasis/background.webp    ← Wereld 1 "Letter Oase" (huidige woestijn/oase-thema)
  garden/background.webp   ← Wereld 2 "Lettertuin" (bosachtig/tuin-thema)
```
(Deze mappen bestaan al, nu nog leeg. `.png` werkt ook als fallback-formaat.)

### Bestandsspecificatie
| Eigenschap | Waarde |
|---|---|
| Bestandsnaam | `background.webp` (met `.png`-fallback) |
| Formaat | WebP of PNG, **geen** transparantie nodig (volledige illustratie/render) |
| Aanbevolen resolutie | Minstens 1600 × 2400 px (staand — de kaart scrollt verticaal en groeit met het aantal levels) |
| Aspect ratio | Staand, lang genoeg om te herhalen/uit te rekken zonder duidelijke naad bovenaan/onderaan |
| Stijl | Zelfde richting als quran.ghaarsa.com: warme, gerenderde illustratie met horizon, geen platte vectorvlakken |

### Over "woestijn verbeteren en er een bos van maken"
Twee dingen zijn hier uit elkaar te houden:
1. **Wereld 1 (Letter Oase)** blijft thematisch een oase/woestijn — dat past
   bij de naam en bij letters die er al aan gekoppeld zijn.
2. **Wereld 2 (Lettertuin)** is in de data al het "bos/tuin"-thema
   (`world.theme === "garden"`, eigen groene kleurverloop in de CSS). Zodra
   je een illustratie aanlevert op `assets/worlds/garden/background.webp`
   (bosrijk, groen, met paadjes) krijgt precies dít scherm die boslook —
   zonder dat wereld 1 verandert.

Wil je in plaats daarvan wereld 1 zelf ook bosachtiger maken (bijvoorbeeld
een oase mét meer bomen/bos eromheen in plaats van kale woestijn), dan is
dat gewoon een kwestie van de illustratie voor `assets/worlds/oasis/background.*`
zo te laten tekenen — de code maakt daarbij geen onderscheid, het is puur
de content van dat ene bestand.

Nieuwe werelden later toevoegen = nieuwe map onder `assets/worlds/<theme>/`
plus het `theme`-veld van die wereld in `game-data.js`; geen verdere
codewijziging nodig (zelfde patroon als de personage-assets).

---

## 3. Wat NIET meer nodig is
- Geen aparte bestanden per skin-tone × outfit × hijab-combinatie — dat zou
  honderden varianten vergen. Het systeem is bewust ontworpen om met een
  klein aantal complete illustraties (optie A) of per-outfit illustraties
  (optie B) te werken, niet met losse lichaamsdelen-lagen.
- Geen actie nodig in `character.js`, `character-data.js` (behalve het
  invullen van `assets`-paden bij optie B), of `game.js` — alleen bestanden
  plaatsen.

## 4. Testen na aanleveren
Voeg een bestand toe, herlaad de app (of verhoog `VERSION` in `sw.js` als
hij al eerder gecachet is) en open het scherm waar dat personage/die wereld
zichtbaar is. Als het bestand er is, verschijnt het meteen; is het pad of de
bestandsnaam net anders, dan blijft gewoon de huidige tijdelijke versie
zichtbaar (geen foutmelding voor het kind).
