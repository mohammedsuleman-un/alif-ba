// Letter Chase V3 — Oase-zone: asset-/compositiemanifest.
// Puur data, geen Phaser-afhankelijkheid, geen hardgecodeerde assetpaden in
// chase-scene.js. Twee delen:
//
//  1. ASSET_SPECS — per asset-ID de PRODUCTIE-asset die we uiteindelijk nodig
//     hebben (pad/afmeting/transparantie/animatie), gebruikt voor het
//     assetverzoek aan het einde van de sessie. Zolang een spec geen
//     bevestigd bestand heeft, genereert chase-scene.js er zelf een nette,
//     tijdelijke placeholder-texture voor (zie makePlaceholder-functies daar)
//     — NOOIT een slechte AI-sheet gecropt of transparantie uit een
//     checkerboard geraden.
//  2. WORLD_COMPOSITION — de daadwerkelijke plaatsing van elke asset-
//     instantie in de 2400x1400-wereld: positie, laag (depth), of hij
//     walkable-collision heeft, en of hij met het character mee Y-sort.
(() => {
  "use strict";

  const ASSET_SPECS = {
    oasis_sky:        { path: "assets/chase/oasis/oasis_sky.webp",        size: "2400×700",  transparent: false, animated: false, frames: 0, purpose: "background — lucht/verre lucht, volle breedte" },
    distant_mountains:{ path: "assets/chase/oasis/distant_mountains.webp",size: "2400×400",   transparent: true,  animated: false, frames: 0, purpose: "background — verre bergen, horizon" },
    distant_city:      { path: "assets/chase/oasis/distant_city.webp",     size: "1600×300",   transparent: true,  animated: false, frames: 0, purpose: "background — verre stad/architectuur silhouet" },
    oasis_ground:      { path: "assets/chase/oasis/oasis_ground.webp",     size: "512×512",    transparent: false, animated: false, frames: 0, purpose: "midground — zand/gras grondtextuur (tileable)" },
    path_sand:         { path: "assets/chase/oasis/path_sand.webp",        size: "512×256",    transparent: true,  animated: false, frames: 0, purpose: "midground — zandpad-strook (tileable)" },
    water_tile:        { path: "assets/game/oasis/water_tile.png",         size: "1254×1254", transparent: false, animated: true,  frames: 0, purpose: "midground — rivier-watertextuur (tileable, zacht bewegend)", delivered: true },
    waterfall_frames:  { path: "assets/chase/oasis/waterfall_frames.webp", size: "384×512",    transparent: true,  animated: true,  frames: 6, purpose: "midground — loopende watervalanimatie (spritesheet)" },
    bridge_01:         { path: "assets/game/oasis/bridge_01.png",          size: "1774×887",   transparent: true,  animated: false, frames: 0, purpose: "midground — brugdek (walkable, geen collision)", delivered: true },
    rock_01:           { path: "assets/game/oasis/rock_01.png",            size: "1536×1024",  transparent: true,  animated: false, frames: 0, purpose: "gameplay (Y-sortable) — obstakel, collision", delivered: true },
    rock_02:           { path: "assets/chase/oasis/rock_02.webp",          size: "160×130",    transparent: true,  animated: false, frames: 0, purpose: "gameplay (Y-sortable) — obstakel, collision" },
    palm_01:           { path: "assets/game/oasis/palm_01.png",            size: "1024×1536",  transparent: true,  animated: false, frames: 0, purpose: "gameplay (Y-sortable) — foreground-depth object, geen collision", delivered: true },
    palm_02:           { path: "assets/chase/oasis/palm_02.webp",          size: "260×400",    transparent: true,  animated: false, frames: 0, purpose: "gameplay (Y-sortable) — foreground-depth object, geen collision" },
    flower_cluster_01: { path: "assets/game/oasis/flower_cluster_01.png",  size: "1536×1024",  transparent: true,  animated: false, frames: 0, purpose: "foreground — decoratie, geen collision", delivered: true },
    bush_01:           { path: "assets/chase/oasis/bush_01.webp",          size: "160×110",    transparent: true,  animated: false, frames: 0, purpose: "foreground — decoratie, geen collision" },
  };

  // Elke instantie: { asset, x, y, scale?, collision?: "rect"|"circle"|none,
  //   collisionSize?, sortable?: boolean (Y-depth sort t.o.v. character) }
  // Wereld = 2400×1400. Compositie volgt de gevraagde route:
  //   START AREA → pad langs palmen → kleine brug → waterzone →
  //   bloementuin → watervalgebied → klein eindgebied.
  const WORLD_COMPOSITION = {
    // Rivier loopt verticaal door de wereld (x 1100–1320), met een
    // watervalbron bovenin en een brug-doorgang halverwege. Collision wordt
    // in chase-scene.js opgebouwd uit twee rechthoeken (boven/onder de
    // brug-opening) — zie RIVER_X/RIVER_GAP_Y hieronder.
    river: { x0: 1100, x1: 1320 },
    bridgeGapY: { y0: 650, y1: 800 },
    waterfall: { x: 1210, y: 110 }, // bovenaan de rivier, voedt hem

    objects: [
      // --- START AREA (open zandvlakte, x 100–500) ---
      { asset: "bush_01", x: 220, y: 500, sortable: false },
      { asset: "flower_cluster_01", x: 340, y: 820, sortable: false },
      { asset: "rock_02", x: 160, y: 950, sortable: true, collision: "circle", collisionR: 50 },

      // --- PAD LANGS PALMEN (x 500–1000) ---
      // collision bij palm_01 is bewust klein en alleen rond de stam/base
      // (sectie 9/11 V3.1) — de bladerkroon blijft vrij belopen.
      { asset: "palm_01", x: 560, y: 420, sortable: true, collision: "circle", collisionR: 22 },
      { asset: "palm_02", x: 700, y: 980, sortable: true },
      { asset: "palm_01", x: 880, y: 300, sortable: true, collision: "circle", collisionR: 22 },
      { asset: "rock_01", x: 760, y: 650, sortable: true, collision: "circle", collisionR: 70 },
      { asset: "bush_01", x: 950, y: 1080, sortable: false },

      // --- BRUG (x ~1050–1370, kruist de rivier bij y 650-800) ---
      { asset: "bridge_01", x: 1210, y: 725, sortable: false },

      // --- BLOEMENTUIN (x 1400–1900) ---
      { asset: "flower_cluster_01", x: 1420, y: 360, sortable: false },
      { asset: "flower_cluster_01", x: 1520, y: 1020, sortable: false },
      { asset: "flower_cluster_01", x: 1680, y: 260, sortable: false },
      { asset: "palm_02", x: 1600, y: 560, sortable: true },
      { asset: "palm_01", x: 1800, y: 980, sortable: true, collision: "circle", collisionR: 22 },
      { asset: "bush_01", x: 1750, y: 420, sortable: false },

      // --- WATERVALGEBIED / rotswand rond de bron (x ~1000–1420, y klein) ---
      { asset: "rock_01", x: 1050, y: 180, sortable: true, collision: "circle", collisionR: 80 },
      { asset: "rock_01", x: 1380, y: 170, sortable: true, collision: "circle", collisionR: 80 },
      { asset: "rock_02", x: 1250, y: 260, sortable: true, collision: "circle", collisionR: 50 },

      // --- EINDGEBIED (open zandvlakte, x 2000–2300) ---
      { asset: "palm_01", x: 2080, y: 500, sortable: true, collision: "circle", collisionR: 22 },
      { asset: "palm_02", x: 2220, y: 950, sortable: true },
      { asset: "flower_cluster_01", x: 2150, y: 760, sortable: false },
      { asset: "bush_01", x: 2000, y: 400, sortable: false },
    ],
  };

  window.GameAssetManifest = { ASSET_SPECS, WORLD_COMPOSITION };
})();
