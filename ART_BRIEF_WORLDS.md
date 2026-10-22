# Opdracht tekeningen: wereldkaarten en meegroeiend personage

De code staat klaar. Zonder tekeningen werkt alles al (de totale kaart toont thema-gekleurde gebieden en het
personage blijft in fase 1). Zet een bestand op het juiste pad en de app gebruikt het; voor de kaarten meet ik
daarna de plekken van de knopen op de tekening op (zoals bij de oase), voor de personages de ankerpunten.

Gedeelde regels (zoals eerder afgesproken): elk bestand los, **echte transparantie of echte tekening, geen
uitsneden uit een sheet**, geen tekst, knoppen, letters of sloten in de kaarten zelf (die tekent de app).

## 1. Totale kaart (1 bestand)
`assets/worlds/overview/map.jpg`: staand, **1024 x 1536 px**. Eén landschap met 9 herkenbare gebieden die
met een kronkelend pad verbonden zijn, hoofdstuk 1 onderaan, 9 bovenaan. Gebiedsmiddens (fractie van breedte, hoogte):

| # | Thema | x, y |
|---|---|---|
| 1 | Oase (letters) | 0.30, 0.90 |
| 2 | Bloemenvallei (klinkertekens) | 0.68, 0.80 |
| 3 | De lange rivier (lange klinkers) | 0.32, 0.70 |
| 4 | Echo-bergen (shadda en tanwien) | 0.70, 0.60 |
| 5 | Lichtstad (ha van het voornaamwoord en Allah) | 0.30, 0.50 |
| 6 | Mistbos (noen sakin en tanwien) | 0.68, 0.40 |
| 7 | Sterrenhemel (hamzat al-wasl, losse letters) | 0.32, 0.30 |
| 8 | Zon- en maaneiland (zon- en maanletters) | 0.68, 0.20 |
| 9 | Koranbibliotheek op de berg (Koransymbolen) | 0.50, 0.09 |

Houd rond elk gebiedsmidden ruimte vrij voor een rond knoopje (~15% van de breedte).

## 2. Kaart per wereld (8 bestanden)
`assets/worlds/<map>/map-wide.jpg`, liggend, **1672 x 941 px**, zoals de bestaande oase-kaart maar **zonder**
ingebakken letters/sloten/personages: een geschilderd, kronkelend pad van linksonder naar rechtsboven met ruimte
voor 10 stops. Mappen: `flowers` (2), `river` (3), `mountains` (4), `light` (5), `forest` (6), `stars` (7),
`sunmoon` (8), `library` (9). (Hoofdstuk 1 gebruikt de bestaande `oasis` en `garden`.)
Thema's: zie tabel hierboven; stijl gelijk aan de oase-kaart (warm, glanzend, kindvriendelijk 3D-illustratie).

## 3. Meegroeiend personage (6 bestanden)
Hetzelfde personage, ouder, per leeftijdsfase (fase 1 = nu, ~6-7 jaar; fase 2 ~9-10 jaar; fase 3 ~12-13 jaar):
```
assets/characters/boy/stage2/default.png    assets/characters/girl/stage2/default.png
assets/characters/boy/stage3/default.png    assets/characters/girl/stage3/default.png
```
- zelfde gezicht/identiteit en dezelfde stijl als de officiële tekeningen, volledig lichaam, staand;
- PNG met echte transparantie, ~1024 px breed (meisje) of 1024 x 1536 (jongen); zelfde soort kleding als nu
  (thobe/jurk met hijab, crème stof, roze accenten, bruine sandalen), zodat de kleuren per code blijven werken;
- fase 2 en 3 mogen andere proporties hebben (langer, slanker). Ik bepaal de ankerpunten voor kleur- en
  accessoire-plekken per tekening.

Wat per fase in de kledingkast staat, staat in `character-data.js` (`stages`): speelgoed en dieren bij fase 1,
sportpet, koptelefoon, schooltas, horloge, tasbih en Koran vanaf fase 2 of 3. Wat een kind al heeft blijft van hem.
