# Personage: hoe het werkt en welke tekeningen er nog bij kunnen

## Hoe het nu werkt
Er is **één officiële, scherpe tekening per personage** (`assets/characters/boy/idle/default.png` en
`assets/characters/girl/idle/default.png`). Alles wat het kind kan veranderen gebeurt in code over die
tekening heen (`character.js`, gegevens in `character-data.js`):

| Wat | Hoe |
|---|---|
| Huidskleur (3 tinten) | alleen de huidgebieden (gezicht, handen, voeten) worden aangepast |
| Hijab / borduursel / schoenen (meisje) | de roze tinten schuiven op naar een andere kleur |
| Jurk / thobe / kufi | de crème stof krijgt een tint |
| Sandalen (jongen) | de bruine sandalen krijgen een andere kleur |
| Accessoires (hoofd, gezicht, hals, hand, rug, huisdier) | getekende SVG-lagen over/achter het personage |
| Emoties | beweging + effecten (hartjes, confetti, vraagteken, enz.), geen aparte tekening |

Nieuwe kleuren of accessoires toevoegen = een regel in `character-data.js` (kleur) of een tekenfunctie in
`character.js` (accessoire). Prijs (`price`) en wanneer het in de winkel komt (`shelf` = aantal voltooide niveaus).

## Wat code niet kan, en wat jij kunt aanleveren
Dit vraagt echte tekeningen (zelfde stijl als de officiële personages):

1. **Andere kledingstukken** (abaya, jas, vest, wereld-outfits zoals de Oase-outfit): per outfit één volledige
   afbeelding van het personage **in exact dezelfde pose, grootte en positie** als de officiële tekening.
   PNG met echte transparantie, 1024 x 1536 px (jongen) of 1275 x 1234 px (meisje, zelfde canvas als nu).
2. **Gezichtsuitdrukkingen** (blij, verdrietig, verbaasd, enzovoort): alleen het gezicht verandert; zelfde
   pose en canvas. Dan kunnen emoties ook echte gezichten krijgen in plaats van alleen beweging.
3. **Meer personages** (andere haarkleur/haardracht, andere leeftijd).

Regels (zoals eerder afgesproken): geen uitsneden uit een sheet, geen achtergrond weghalen of schaakbord als
transparantie; elk bestand los, met echte alpha.
