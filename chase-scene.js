// Letter Chase V3 — Oase-zone: Phaser-wereld (camera/wereld/physics/layers),
// volledig losstaand van de DOM-chrome/app-integratie in game-stage.js.
//
// Compositie en asset-metadata komen uit game-assets-manifest.js (geen
// hardgecodeerde paden hier) — dit bestand GENEREERT nette, tijdelijke
// placeholder-textures voor elk asset-ID uit dat manifest totdat er echte
// productie-assets zijn (zie ASSET_SPECS daar + het assetverzoek in de
// sessie-rapportage), en bouwt daarmee de wereld op.
//
// Lagen (Phaser depth), laag naar hoog:
//   BACKGROUND(0) < MIDGROUND(1, grond/pad/water/waterval/brug)
//   < GAMEPLAY(5..6, character/letters/Y-sortable rotsen&palmen)
//   < FOREGROUND(10, niet-sortable decoratie zoals bloemen/struiken)
//   < FX(20, sparkles/correct-feedback)
class ChaseScene extends Phaser.Scene {
  constructor() {
    super("ChaseScene");
  }

  // data = { worldW, worldH, tier, spawnDist, chaseConfig, textureUrls,
  //          charBoxSize: {w,h}, inputMode }
  init(data) {
    this.cfg = data;
    this.worldW = data.worldW;
    this.worldH = data.worldH;
    this.spawnDist = data.spawnDist;
    this.chaseConfig = data.chaseConfig;
    this.textureUrls = data.textureUrls;
    this.charBoxSize = data.charBoxSize;
    this.tier = data.tier;
    this.inputMode = data.inputMode || "dpad";
    // { assetId: probedUrl } — alleen IDs die game-stage.js al succesvol kon
    // laden; alles hier ontbreekt → procedurele placeholder (sectie 16 V3.1).
    this.sceneryAssets = data.sceneryAssets || {};

    this.letterR = 59;
    this.roundLetters = [];
    this.collisionLocked = true;
    this.moveVector = { x: 0, y: 0 };
    this.moveTargetWorld = null;
    this.facing = 1;
    this.sortables = []; // {obj, baseY} — Y-sortable scenery (rotsen/palmen) + character
    this.waterRects = []; // collision-rechthoeken van de rivier
    this.rockColliders = []; // {x,y,r} — voor walkability-check van letter-spawn/wander
  }

  preload() {
    Object.entries(this.textureUrls).forEach(([mood, url]) => {
      if (url) this.load.image(`char-${mood}`, url);
    });
    Object.entries(this.sceneryAssets).forEach(([id, url]) => {
      this.load.image(`prod-${id}`, url);
    });
  }

  // Levert de te gebruiken texture-key voor een asset-ID: de productie-
  // versie als die geladen is, anders de procedurele placeholder ("ph-"+id)
  // — "production asset aanwezig + geldig → gebruik hem, anders placeholder".
  textureKeyFor(id) {
    const prodKey = `prod-${id}`;
    return (this.sceneryAssets[id] && this.textures.exists(prodKey)) ? prodKey : `ph-${id}`;
  }

  create() {
    this.physics.world.setBounds(0, 0, this.worldW, this.worldH);
    this.cameras.main.setBounds(0, 0, this.worldW, this.worldH);
    // `coverZoom` is het absolute minimum om de viewport nooit breder/hoger
    // dan de wereld te laten zijn (anders is er lege ruimte buiten de wereld
    // zichtbaar — sectie 7). De tier-boost zoomt daarna extra in op mobiel
    // (character/letters groot, camera dicht op de speler) en blijft op
    // desktop dicht bij coverZoom (zoveel mogelijk wereld tegelijk zichtbaar).
    const coverZoom = Math.max(this.scale.width / this.worldW, this.scale.height / this.worldH);
    const boost = this.tier === "mobile" ? 1.5 : this.tier === "tablet" ? 1.15 : 1.03;
    this.cameras.main.setZoom(coverZoom * boost);

    this.buildPlaceholderTextures();
    this.buildBackground();
    this.buildMidground();
    this.buildCollisionGroup();
    this.buildScenery();

    this.buildPlayer();
    this.sortables.push({ obj: this.playerSprite, isPlayer: true });

    this.physics.add.collider(this.playerBody, this.collisionGroup);

    this.cameras.main.startFollow(this.playerBody, true, 0.09, 0.09);

    this.input.on("pointerdown", (pointer) => {
      if (this.inputMode !== "tap" || this.collisionLocked) return;
      const wp = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
      this.moveToWorld(wp.x, wp.y);
    });

    this.spawnRound();
    this.events.emit("chase-ready");

    // Herbereken de zoom bij elke resize (bv. schermrotatie) — anders kan
    // een grotere viewport na resize alsnog breder/hoger worden dan de
    // wereld, met lege ruimte als gevolg (zelfde klasse bug als hierboven).
    this.scale.on("resize", (gameSize) => {
      // setZoom alléén is niet genoeg: de camera-VIEWPORT zelf volgt de
      // canvasgrootte niet automatisch mee bij Scale.Mode.NONE + handmatige
      // game.scale.resize() — zonder expliciete setSize() blijft Phaser in
      // het oorspronkelijke (kleinere) camera-gebied tekenen, met een lege
      // rand op de rest van het vergrote canvas tot gevolg.
      this.cameras.main.setSize(gameSize.width, gameSize.height);
      const coverZoom = Math.max(gameSize.width / this.worldW, gameSize.height / this.worldH);
      const boost = this.tier === "mobile" ? 1.5 : this.tier === "tablet" ? 1.15 : 1.03;
      this.cameras.main.setZoom(coverZoom * boost);
    });
  }

  update(time, delta) {
    this.updateMovement(delta / 1000);
    this.updateWalkBob(time);
    this.updateScenery(delta);
    this.updateWander(time, delta);
    this.updateDepthSort();
  }

  // ========== PUBLIEKE API (aangeroepen vanuit game-stage.js) ==========

  setInputMode(mode) { this.inputMode = mode; this.moveVector = { x: 0, y: 0 }; this.clearMoveTarget(); }
  setMoveVector(x, y) { if (x || y) this.clearMoveTarget(); this.moveVector = { x, y }; }

  moveToWorld(worldX, worldY) {
    worldX = Phaser.Math.Clamp(worldX, 0, this.worldW);
    worldY = Phaser.Math.Clamp(worldY, 0, this.worldH);
    this.moveVector = { x: 0, y: 0 };
    this.moveTargetWorld = { x: worldX, y: worldY };
    this.events.emit("chase-tap-marker", this.worldToScreen(worldX, worldY));
  }
  clearMoveTarget() {
    if (this.moveTargetWorld) this.events.emit("chase-tap-marker-hide");
    this.moveTargetWorld = null;
  }

  setCharMood(mood) {
    const key = `char-${mood}`;
    if (this.textures.exists(key)) this.playerSprite.setTexture(key);
  }

  lockInput() { this.collisionLocked = true; this.moveVector = { x: 0, y: 0 }; this.clearMoveTarget(); }
  unlockInput() { this.collisionLocked = false; }
  getPlayerWorldPos() { return { x: this.playerBody.x, y: this.playerBody.y }; }
  getTargetLetterObj() { return this.roundLetters.find((l) => l.isTarget && l.active) || null; }

  // ========== Placeholder-textures (nette, tijdelijke eigen vormgeving — GEEN gecropte AI-sheets) ==========

  buildPlaceholderTextures() {
    this.makeGradientCanvas("ph-sky", 8, 512, [[0, "#bfe4f5"], [0.55, "#dcf0e2"], [1, "#f3e3bd"]]);
    this.makeMountainsTexture("ph-mountains", 1200, 220);
    this.makeCityTexture("ph-city", 900, 180);
    this.makeGroundTexture("ph-ground", 256, 256);
    this.makePathTexture("ph-path", 256, 140);
    this.makeWaterTexture("ph-water", 64, 64);
    this.makeWaterfallFrames("ph-waterfall", 6);
    this.makeBridgeTexture("ph-bridge_01", 220, 120);
    this.makeRockTexture("ph-rock_01", 160, 120, "#c9a876");
    this.makeRockTexture("ph-rock_02", 120, 92, "#d4b483");
    this.makePalmTexture("ph-palm_01", 180, 260);
    this.makePalmTexture("ph-palm_02", 150, 220);
    this.makeFlowerTexture("ph-flower_cluster_01", 100, 70);
    this.makeBushTexture("ph-bush_01", 100, 70);
  }

  makeGradientCanvas(key, w, h, stops) {
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    const ctx = c.getContext("2d");
    const g = ctx.createLinearGradient(0, 0, 0, h);
    stops.forEach(([o, col]) => g.addColorStop(o, col));
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    this.textures.addCanvas(key, c);
  }

  makeMountainsTexture(key, w, h) {
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    const ctx = c.getContext("2d");
    const layers = [{ col: "rgba(168,150,190,.35)", base: h * 0.75, amp: 50 }, { col: "rgba(140,120,170,.45)", base: h * 0.85, amp: 40 }];
    layers.forEach((l) => {
      ctx.beginPath(); ctx.moveTo(0, h);
      for (let x = 0; x <= w; x += 20) ctx.lineTo(x, l.base - Math.sin(x * 0.006 + l.amp) * l.amp - Math.sin(x * 0.015) * (l.amp * 0.4));
      ctx.lineTo(w, h); ctx.closePath(); ctx.fillStyle = l.col; ctx.fill();
    });
    this.textures.addCanvas(key, c);
  }

  makeCityTexture(key, w, h) {
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "rgba(196,150,110,.55)";
    for (let x = 20; x < w - 20; x += 90) {
      const bw = 56, bh = Phaser.Math.Between(h * 0.4, h * 0.7);
      ctx.fillRect(x, h - bh, bw, bh);
      ctx.beginPath(); ctx.arc(x + bw / 2, h - bh, bw / 2, Math.PI, 0); ctx.fill(); // koepeltje
    }
    this.textures.addCanvas(key, c);
  }

  makeGroundTexture(key, w, h) {
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    const ctx = c.getContext("2d");
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "#e7d9a6"); g.addColorStop(1, "#dcc889");
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "rgba(255,255,255,.12)";
    for (let i = 0; i < 40; i++) { const x = Math.random() * w, y = Math.random() * h; ctx.beginPath(); ctx.arc(x, y, Phaser.Math.Between(1, 3), 0, Math.PI * 2); ctx.fill(); }
    this.textures.addCanvas(key, c);
  }

  makePathTexture(key, w, h) {
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    const ctx = c.getContext("2d");
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "#f0e2b8"); g.addColorStop(1, "#e6d19f");
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    this.textures.addCanvas(key, c);
  }

  makeWaterTexture(key, w, h) {
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    const ctx = c.getContext("2d");
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "#6fd3dd"); g.addColorStop(1, "#4cb9cc");
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "rgba(255,255,255,.45)"; ctx.lineWidth = 2.5;
    for (let y = 10; y < h; y += 14) { ctx.beginPath(); ctx.moveTo(0, y); ctx.bezierCurveTo(w * 0.25, y - 5, w * 0.75, y + 5, w, y); ctx.stroke(); }
    this.textures.addCanvas(key, c);
  }

  // Spritesheet-architectuur voor de waterval: 6 losse frames, netjes als
  // loopende animatie opgezet — klaar om later 1-op-1 vervangen te worden
  // door echte aangeleverde frames (zelfde key/afmeting).
  makeWaterfallFrames(key, frameCount) {
    const fw = 64, fh = 160;
    const sheet = document.createElement("canvas"); sheet.width = fw * frameCount; sheet.height = fh;
    const ctx = sheet.getContext("2d");
    for (let f = 0; f < frameCount; f++) {
      const ox = f * fw;
      const g = ctx.createLinearGradient(ox, 0, ox, fh);
      g.addColorStop(0, "rgba(220,247,250,.95)"); g.addColorStop(1, "rgba(130,210,225,.85)");
      ctx.fillStyle = g; ctx.fillRect(ox, 0, fw, fh);
      ctx.strokeStyle = "rgba(255,255,255,.8)"; ctx.lineWidth = 3;
      const shift = (f / frameCount) * 24;
      for (let x = 6; x < fw; x += 11) { ctx.beginPath(); ctx.moveTo(ox + x, -8 + ((shift + x) % 16)); ctx.lineTo(ox + x, fh); ctx.stroke(); }
    }
    this.textures.addSpriteSheet(key, sheet, { frameWidth: fw, frameHeight: fh });
    this.anims.create({ key: "waterfall-flow", frames: this.anims.generateFrameNumbers(key, { start: 0, end: frameCount - 1 }), frameRate: 8, repeat: -1 });
  }

  makeBridgeTexture(key, w, h) {
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#b9834f"; roundRect(ctx, 10, h * 0.45, w - 20, h * 0.3, 10); ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,.12)"; ctx.lineWidth = 2;
    for (let x = 20; x < w - 10; x += 18) { ctx.beginPath(); ctx.moveTo(x, h * 0.45); ctx.lineTo(x, h * 0.75); ctx.stroke(); }
    ctx.fillStyle = "#8a5f38";
    ctx.fillRect(6, h * 0.3, 10, h * 0.55); ctx.fillRect(w - 16, h * 0.3, 10, h * 0.55);
    this.textures.addCanvas(key, c);
  }

  makeRockTexture(key, w, h, color) {
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    const ctx = c.getContext("2d");
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, lighten(color, 18)); g.addColorStop(1, darken(color, 12));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(w * 0.1, h * 0.9);
    ctx.bezierCurveTo(w * -0.02, h * 0.5, w * 0.15, h * 0.08, w * 0.45, h * 0.05);
    ctx.bezierCurveTo(w * 0.8, h * 0.02, w * 1.05, h * 0.35, w * 0.92, h * 0.65);
    ctx.bezierCurveTo(w * 0.98, h * 0.85, w * 0.7, h * 1.0, w * 0.4, h * 0.97);
    ctx.bezierCurveTo(w * 0.2, h * 0.98, w * 0.08, h * 0.95, w * 0.1, h * 0.9);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,.18)";
    ctx.beginPath(); ctx.ellipse(w * 0.35, h * 0.3, w * 0.18, h * 0.1, -0.3, 0, Math.PI * 2); ctx.fill();
    this.textures.addCanvas(key, c);
  }

  makePalmTexture(key, w, h) {
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    const ctx = c.getContext("2d");
    const trunkW = w * 0.14, trunkX = w / 2 - trunkW / 2, trunkTop = h * 0.42;
    const tg = ctx.createLinearGradient(trunkX, 0, trunkX + trunkW, 0);
    tg.addColorStop(0, "#8a6238"); tg.addColorStop(1, "#5e4123");
    ctx.fillStyle = tg;
    ctx.beginPath();
    ctx.moveTo(trunkX, h); ctx.quadraticCurveTo(w / 2 - trunkW, h * 0.7, w / 2 - trunkW * 0.3, trunkTop);
    ctx.lineTo(w / 2 + trunkW * 0.3, trunkTop); ctx.quadraticCurveTo(w / 2 + trunkW, h * 0.7, trunkX + trunkW, h);
    ctx.closePath(); ctx.fill();
    const fronds = 6;
    for (let i = 0; i < fronds; i++) {
      const angle = (-Math.PI / 2) + (i - (fronds - 1) / 2) * 0.48;
      const len = w * 0.52;
      const fx = w / 2 + Math.cos(angle) * len, fy = trunkTop + Math.sin(angle) * len * 0.75;
      const fg = ctx.createLinearGradient(w / 2, trunkTop, fx, fy);
      fg.addColorStop(0, "#5fae5a"); fg.addColorStop(1, "#3c8a46");
      ctx.strokeStyle = fg; ctx.lineWidth = w * 0.09; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(w / 2, trunkTop); ctx.quadraticCurveTo(w / 2 + Math.cos(angle) * len * 0.5, trunkTop + Math.sin(angle) * len * 0.3, fx, fy); ctx.stroke();
    }
    ctx.fillStyle = "#6b4423";
    [-1, 0, 1].forEach((i) => { ctx.beginPath(); ctx.arc(w / 2 + i * trunkW * 0.6, trunkTop + 6, trunkW * 0.22, 0, Math.PI * 2); ctx.fill(); });
    this.textures.addCanvas(key, c);
  }

  makeFlowerTexture(key, w, h) {
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    const ctx = c.getContext("2d");
    ctx.strokeStyle = "#4a8a4f"; ctx.lineWidth = 3;
    const colors = ["#f08fb0", "#f5c26b", "#b98fe0", "#f5f0a0"];
    for (let i = 0; i < 5; i++) {
      const bx = w * (0.12 + i * 0.19), by = h * 0.85;
      ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx, by - h * 0.35); ctx.stroke();
      ctx.fillStyle = colors[i % colors.length];
      const cy = by - h * 0.42;
      for (let p = 0; p < 5; p++) { const a = (p / 5) * Math.PI * 2; ctx.beginPath(); ctx.ellipse(bx + Math.cos(a) * 7, cy + Math.sin(a) * 7, 6, 4, a, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = "#f7e07a"; ctx.beginPath(); ctx.arc(bx, cy, 4, 0, Math.PI * 2); ctx.fill();
    }
    this.textures.addCanvas(key, c);
  }

  makeBushTexture(key, w, h) {
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    const ctx = c.getContext("2d");
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "#6fbf6f"); g.addColorStop(1, "#4b9a52");
    ctx.fillStyle = g;
    [[0.3, 0.55, 0.32], [0.62, 0.5, 0.36], [0.5, 0.3, 0.3]].forEach(([cx, cy, r]) => { ctx.beginPath(); ctx.arc(w * cx, h * cy, w * r, 0, Math.PI * 2); ctx.fill(); });
    this.textures.addCanvas(key, c);
  }

  // ========== Wereldopbouw ==========

  buildBackground() {
    this.add.image(0, 0, "ph-sky").setOrigin(0, 0).setDisplaySize(this.worldW, this.worldH).setDepth(DEPTH.BACKGROUND);
    this.add.image(0, this.worldH * 0.12, "ph-mountains").setOrigin(0, 0).setDisplaySize(this.worldW, this.worldH * 0.22).setDepth(DEPTH.BACKGROUND + 0.1).setAlpha(0.9);
    this.add.image(this.worldW * 0.15, this.worldH * 0.2, "ph-city").setOrigin(0, 0).setDisplaySize(this.worldW * 0.7, this.worldH * 0.16).setDepth(DEPTH.BACKGROUND + 0.2).setAlpha(0.85);
    this.add.tileSprite(0, 0, this.worldW, this.worldH, "ph-ground").setOrigin(0, 0).setDepth(DEPTH.BACKGROUND + 0.3);
  }

  buildMidground() {
    const M = window.GameAssetManifest.WORLD_COMPOSITION;
    const rx0 = M.river.x0, rx1 = M.river.x1, rw = rx1 - rx0;

    // Zandpad onder de palmen-route (puur decoratief, geen collision).
    this.add.tileSprite(120, 950, rx0 - 150, 260, "ph-path").setOrigin(0, 0).setDepth(DEPTH.MIDGROUND).setAngle(-4);

    // Rivier (twee tileSprites — noord/zuid — met de brug-opening ertussen).
    const gapY0 = M.bridgeGapY.y0, gapY1 = M.bridgeGapY.y1;
    const waterKey = this.textureKeyFor("water_tile");
    this.water1 = this.add.tileSprite(rx0, 0, rw, gapY0, waterKey).setOrigin(0, 0).setDepth(DEPTH.MIDGROUND + 0.1);
    this.water2 = this.add.tileSprite(rx0, gapY1, rw, this.worldH - gapY1, waterKey).setOrigin(0, 0).setDepth(DEPTH.MIDGROUND + 0.1);

    // Waterval bovenaan de rivier (voedt hem), loopende frame-animatie.
    const wf = M.waterfall;
    this.waterfallSprite = this.add.sprite(wf.x, wf.y, "ph-waterfall").setOrigin(0.5, 0).setDisplaySize(90, 220).setDepth(DEPTH.MIDGROUND + 0.2);
    this.waterfallSprite.play("waterfall-flow");

    // Brug-dek over de opening heen. De productie-art heeft een eigen
    // (bredere) beeldverhouding dan de placeholder-strook, dus een aparte
    // wereldmaat die de brug-crossing netjes dekt i.p.v. de rivierbreedte
    // blind te stretchen.
    const bridgeObj = M.objects.find((o) => o.asset === "bridge_01");
    if (bridgeObj) {
      const bridgeKey = this.textureKeyFor("bridge_01");
      const [bw, bh] = bridgeKey.startsWith("prod-") ? [340, 170] : [rw + 80, 130];
      this.add.image(bridgeObj.x, bridgeObj.y, bridgeKey).setDisplaySize(bw, bh).setDepth(DEPTH.MIDGROUND + 0.3);
    }

    this.waterRects = [
      { x0: rx0, y0: 0, x1: rx1, y1: gapY0 },
      { x0: rx0, y0: gapY1, x1: rx1, y1: this.worldH },
    ];
  }

  // Statische Arcade-collisiongroep: rivier (2 rechthoeken) + rotsen
  // (cirkels, uit WORLD_COMPOSITION). Eenvoudige shapes, geen navmesh.
  buildCollisionGroup() {
    this.collisionGroup = this.physics.add.staticGroup();
    this.waterRects.forEach((r) => {
      const w = r.x1 - r.x0, h = r.y1 - r.y0;
      const body = this.add.rectangle(r.x0 + w / 2, r.y0 + h / 2, w, h, 0x000000, 0).setDepth(-1);
      this.physics.add.existing(body, true);
      this.collisionGroup.add(body);
    });
  }

  buildScenery() {
    const M = window.GameAssetManifest.WORLD_COMPOSITION;
    // Placeholder-maten (passen bij de procedurele vormen) vs. productie-
    // maten (passen bij de daadwerkelijke beeldverhouding van het aangeleverde
    // bestand — zie sectie 7 V3.1: "schaal naar wereldmaten, neem geen
    // pixelafmeting van de bron aan").
    const placeholderSizes = { rock_01: [160, 120], rock_02: [120, 92], palm_01: [160, 240], palm_02: [130, 200], flower_cluster_01: [110, 80], bush_01: [110, 80] };
    const productionSizes = { rock_01: [210, 140], palm_01: [214, 320], flower_cluster_01: [165, 110] };
    M.objects.forEach((o) => {
      if (o.asset === "bridge_01") return; // al apart getekend in buildMidground()
      const key = this.textureKeyFor(o.asset);
      const isProd = key.startsWith("prod-");
      const [w, h] = (isProd && productionSizes[o.asset]) || placeholderSizes[o.asset] || [100, 100];
      const img = this.add.image(o.x, o.y, key).setOrigin(0.5, 1).setDisplaySize(w, h);
      const isForeground = !o.sortable;
      img.setDepth(isForeground ? DEPTH.FOREGROUND : DEPTH.GAMEPLAY);
      if (o.sortable) this.sortables.push({ obj: img, isPlayer: false });

      if (o.collision === "circle") {
        // Rotsen: collision rond de visuele rotsmassa (iets boven de
        // grondanker). Palm: collision uitsluitend rond de stam/basis, dus
        // vrijwel exact op het grondanker-punt zelf — de kroon/bladeren
        // blijven volledig vrij van collision (sectie 9/11 V3.1).
        const isPalm = o.asset === "palm_01" || o.asset === "palm_02";
        const offsetY = isPalm ? h * 0.02 : h * 0.12;
        const cy = o.y - offsetY;
        const body = this.add.circle(o.x, cy, o.collisionR || 50, 0x000000, 0);
        this.physics.add.existing(body, true);
        this.collisionGroup.add(body);
        this.rockColliders.push({ x: o.x, y: cy, r: (o.collisionR || 50) + this.letterR * 0.4 });
      }
    });
  }

  buildPlayer() {
    const startX = 300, startY = 650; // in de START AREA, niet in het wereldmidden
    this.playerShadow = this.add.ellipse(startX, startY, this.charBoxSize.w * 0.7, this.charBoxSize.h * 0.22, 0x1a0f05, 0.28).setDepth(DEPTH.GAMEPLAY - 0.01);

    // Een Zone i.p.v. een (onzichtbaar) Image: Zone heeft geen texture/frame,
    // dus geen risico dat Phaser's offset-berekening uitgaat van de RUWE
    // pixelgrootte van het geladen character-PNG (die zelden overeenkomt met
    // charBoxSize) — zelfde probleem dat met expliciete offsets bij de
    // letter-containers hieronder al correct is opgelost.
    this.playerBody = this.physics.add.existing(this.add.zone(startX, startY, this.charBoxSize.w, this.charBoxSize.h));
    const r = this.charBoxSize.h * 0.3;
    this.playerBody.body.setCircle(r, this.charBoxSize.w / 2 - r, this.charBoxSize.h / 2 - r);
    // setCircle()'s offset wordt pas verwerkt in body.x/y bij de eerstvolgende
    // positie-sync — die blijft voor een stilstaand object uit totdat het
    // beweegt. Zonder deze expliciete sync staat het physics-lichaam het
    // EERSTE moment (en bij stilstaan) los van het zichtbare character.
    this.playerBody.body.updateFromGameObject();
    this.playerBody.body.setCollideWorldBounds(true); // Zone heeft geen setCollideWorldBounds-gemakslaag zoals Image/Sprite — rechtstreeks op body
    this.playerBody.setDepth(DEPTH.GAMEPLAY);

    this.playerSprite = this.add.image(startX, startY, "char-idle")
      .setDisplaySize(this.charBoxSize.w, this.charBoxSize.h)
      .setOrigin(0.5, 1)
      .setDepth(DEPTH.GAMEPLAY);
  }

  // ========== Loop-helpers ==========

  updateScenery(delta) {
    if (this.water1) { this.water1.tilePositionX += delta * 0.018; this.water1.tilePositionY += delta * 0.006; }
    if (this.water2) { this.water2.tilePositionX += delta * 0.018; this.water2.tilePositionY += delta * 0.006; }
  }

  // Objecten lager op het scherm (hogere world-Y) renderen vóór objecten
  // hoger op het scherm — geeft het 2.5D-gevoel dat het character achter een
  // palm/rots kan verdwijnen en er weer voor kan opduiken.
  updateDepthSort() {
    this.sortables.forEach((s) => {
      const y = s.isPlayer ? this.playerBody.y : s.obj.y;
      s.obj.setDepth(DEPTH.GAMEPLAY + y / 100000);
    });
    this.playerShadow.setPosition(this.playerBody.x, this.playerBody.y);
  }

  updateMovement(dt) {
    if (this.collisionLocked) { this.playerBody.body.setVelocity(0, 0); return; }
    let dx = 0, dy = 0;
    if (this.moveTargetWorld) {
      const rdx = this.moveTargetWorld.x - this.playerBody.x, rdy = this.moveTargetWorld.y - this.playerBody.y;
      const dist = Math.hypot(rdx, rdy);
      if (dist < 6) { this.clearMoveTarget(); }
      else { dx = rdx / dist; dy = rdy / dist; }
    } else {
      dx = this.moveVector.x; dy = this.moveVector.y;
      const len = Math.hypot(dx, dy);
      if (len > 1) { dx /= len; dy /= len; }
    }
    const SPEED = 260;
    this.playerBody.body.setVelocity(dx * SPEED, dy * SPEED);
    if (dx) this.facing = dx < 0 ? -1 : 1;
    this.playerSprite.setFlipX(this.facing < 0);

    // Tap-to-move heeft (nog) geen pathfinding: botst de speler onderweg op
    // een obstakel, dan stopt de Arcade-physics het lichaam netjes (geen
    // teleport, geen doorlopen) — de resterende tap-bestemming wordt dan
    // losgelaten in plaats van eindeloos tegen het obstakel te duwen.
    if (this.moveTargetWorld && this.playerBody.body.velocity.lengthSq() < 4 && (dx || dy)) {
      this.clearMoveTarget();
    }
  }

  updateWalkBob(time) {
    const moving = this.playerBody.body.velocity.lengthSq() > 4;
    const bob = moving ? Math.sin(time * 0.012) * 3 : Math.sin(time * 0.003) * 1.2; // snellere/grotere bob tijdens lopen, zachte adem-bob idle
    this.playerSprite.x = this.playerBody.x;
    this.playerSprite.y = this.playerBody.y + bob;
    this.playerShadow.setScale(moving ? 0.92 : 1);
  }

  isWalkable(x, y) {
    if (this.waterRects.some((r) => x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1)) return false;
    if (this.rockColliders.some((r) => Math.hypot(x - r.x, y - r.y) < r.r)) return false;
    return true;
  }

  // ========== Letters: "magische" game objects ==========

  makeLetterObject(letter, x, y) {
    const isTarget = letter === this.chaseConfig.target;
    const container = this.add.container(x, y).setDepth(DEPTH.GAMEPLAY + 0.5);

    const shadow = this.add.ellipse(0, 46, 70, 18, 0x1a0f05, 0.18);
    const aura = this.add.circle(0, 0, 54, 0xffd97a, 0.28);
    const auraRing = this.add.circle(0, 0, 54, 0xffffff, 0).setStrokeStyle(2, 0xfff2cf, 0.6);
    const glyph = this.add.text(0, 0, letter, { fontFamily: "Amiri, serif", fontSize: "58px", color: "#2a1c12" })
      .setOrigin(0.5).setShadow(0, 3, "rgba(120,80,20,.35)", 6, false, true);
    container.add([shadow, aura, auraRing, glyph]);

    this.physics.add.existing(container);
    const r = this.letterR;
    container.body.setCircle(r, -r, -r);

    this.tweens.add({ targets: container, y: y - 8, duration: 1500 + Math.random() * 400, yoyo: true, repeat: -1, ease: "Sine.InOut" });
    this.tweens.add({ targets: aura, scale: 1.12, alpha: 0.18, duration: 1700 + Math.random() * 300, yoyo: true, repeat: -1, ease: "Sine.InOut" });

    const obj = { letter, isTarget, container, glyph, aura, wanderAnchor: { x, y }, wanderNextAt: 0, active: true };
    this.physics.add.overlap(this.playerBody, container, () => this.onOverlap(obj), null, this);
    return obj;
  }

  onOverlap(obj) {
    if (this.collisionLocked || !obj.active) return;
    this.collisionLocked = true;
    obj.active = false;
    if (obj.container.body) obj.container.body.enable = false;
    this.events.emit("chase-collision", { letterObj: obj, letter: obj.letter, isTarget: obj.isTarget, worldX: obj.container.x, worldY: obj.container.y });
  }

  // Kort houden: stop bewegen, kleine squash/stretch, sparkle, kort groter,
  // dan verdwijnen — geen lange viering per vangst.
  playCorrectAnim(obj) {
    this.tweens.killTweensOf([obj.container, obj.aura]);
    this.tweens.add({ targets: obj.container, scaleX: 1.25, scaleY: 0.8, duration: 110, yoyo: true, ease: "Quad.Out" });
    this.spawnSparkles(obj.container.x, obj.container.y);
    this.tweens.add({ targets: obj.container, scale: 1.35, alpha: 0, duration: 380, delay: 120, ease: "Sine.In", onComplete: () => obj.container.destroy() });
  }
  playWrongAnim(obj) {
    this.tweens.add({ targets: obj.container, x: obj.container.x - 6, duration: 70, yoyo: true, repeat: 3, ease: "Sine.InOut" });
  }
  pulseHint(obj) {
    this.tweens.add({ targets: obj.aura, scale: 1.5, alpha: 0.45, duration: 200, yoyo: true, ease: "Sine.InOut" });
  }
  spawnSparkles(x, y) {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const s = this.add.circle(x, y, 4, 0xfff1b8, 0.95).setDepth(DEPTH.FX);
      this.tweens.add({ targets: s, x: x + Math.cos(a) * 46, y: y + Math.sin(a) * 46, alpha: 0, scale: 0.3, duration: 420, ease: "Sine.Out", onComplete: () => s.destroy() });
    }
  }

  // ========== Spawn (onveranderd principe t.o.v. V2: afstand-tot-speler, nu óók walkability-check) ==========

  spawnRound() {
    // killTweensOf vóór destroy(): Phaser stopt lopende (repeat:-1) tweens
    // niet automatisch zodra hun target destroyed wordt, dus zonder dit
    // stapelen de idle-float/adem-tweens van elke ronde zich op (reëel
    // performance-lek, gevonden tijdens FPS-metingen in deze sessie).
    this.roundLetters.forEach((l) => {
      if (l.container && l.container.active) { this.tweens.killTweensOf([l.container, l.aura]); l.container.destroy(); }
    });
    this.roundLetters = [];

    const letters = Phaser.Utils.Array.Shuffle([this.chaseConfig.target, ...this.chaseConfig.distractors]);
    const { min: minD, max: maxD } = this.spawnDist;
    const margin = this.letterR + 16;
    const wx0 = margin, wx1 = this.worldW - margin, wy0 = margin, wy1 = this.worldH - margin;
    const avoidX = this.playerBody.x, avoidY = this.playerBody.y - this.charBoxSize.h / 2;

    const minDistFloor = this.letterR * 2 + 6;
    const avoidRFloor = this.charBoxSize.h / 2 + this.letterR + 4;
    const placed = [];

    for (let li = 0; li < letters.length; li++) {
      let minLetterDist = this.letterR * 2 + 34;
      let avoidR = this.charBoxSize.h / 2 + this.letterR + 30;
      let found = null;

      const inBounds = (x, y) => x >= wx0 && x <= wx1 && y >= wy0 && y <= wy1;
      const isValid = (x, y) => inBounds(x, y) && this.isWalkable(x, y)
        && Phaser.Math.Distance.Between(x, y, avoidX, avoidY) >= avoidR
        && placed.every((p) => Phaser.Math.Distance.Between(x, y, p.x, p.y) >= minLetterDist);
      const randomCandidate = () => {
        const angle = Phaser.Math.FloatBetween(0, Math.PI * 2), r = Phaser.Math.FloatBetween(minD, maxD);
        return { x: Phaser.Math.Clamp(avoidX + Math.cos(angle) * r, wx0, wx1), y: Phaser.Math.Clamp(avoidY + Math.sin(angle) * r, wy0, wy1) };
      };
      const gridCandidates = () => {
        const pts = [], steps = 24, radii = [minD, (minD + maxD) / 2, maxD];
        for (let a = 0; a < steps; a++) {
          const angle = (a / steps) * Math.PI * 2;
          for (const r of radii) pts.push({ x: Phaser.Math.Clamp(avoidX + Math.cos(angle) * r, wx0, wx1), y: Phaser.Math.Clamp(avoidY + Math.sin(angle) * r, wy0, wy1) });
        }
        return pts;
      };

      for (let relax = 0; relax < 6 && !found; relax++) {
        for (let tcount = 0; tcount < 200 && !found; tcount++) { const p = randomCandidate(); if (isValid(p.x, p.y)) found = p; }
        if (!found) { for (const p of gridCandidates()) { if (isValid(p.x, p.y)) { found = p; break; } } }
        if (!found) { minLetterDist = Math.max(minDistFloor, minLetterDist * 0.82); avoidR = Math.max(avoidRFloor, avoidR * 0.82); }
      }
      if (!found) {
        // Laatste redmiddel, nog steeds walkability-gevalideerd: beste
        // kandidaat uit alles wat geprobeerd is (nooit een ongeteste positie).
        let best = null, bestScore = -Infinity;
        for (const p of [...Array(200)].map(randomCandidate).concat(gridCandidates())) {
          if (!inBounds(p.x, p.y) || !this.isWalkable(p.x, p.y)) continue;
          const scoreAvoid = Phaser.Math.Distance.Between(p.x, p.y, avoidX, avoidY) - avoidRFloor;
          const scoreLetters = placed.length ? Math.min(...placed.map((q) => Phaser.Math.Distance.Between(p.x, p.y, q.x, q.y))) - minDistFloor : Infinity;
          const score = Math.min(scoreAvoid, scoreLetters);
          if (score > bestScore) { bestScore = score; best = p; }
        }
        found = best || { x: avoidX, y: avoidY };
      }
      placed.push(found);
    }

    this.roundLetters = letters.map((letter, i) => this.makeLetterObject(letter, placed[i].x, placed[i].y));
  }

  // ========== Moving target (sectie 18-19 V3): merkt speler op, wijkt een klein stukje uit, blijft in veilige (walkable) zone ==========

  updateWander(time, delta) {
    if (!this.chaseConfig.movingTarget) return;
    for (const l of this.roundLetters) {
      if (!l.isTarget || !l.active) continue;
      if (time > l.wanderNextAt) {
        const distToPlayer = Phaser.Math.Distance.Between(l.container.x, l.container.y, this.playerBody.x, this.playerBody.y);
        const noticesPlayer = distToPlayer < 220;
        l.wanderNextAt = time + (noticesPlayer ? Phaser.Math.Between(900, 1400) : Phaser.Math.Between(2000, 3000));
        const a = l.wanderAnchor;
        let tx, ty, tries = 0;
        do {
          let angle;
          if (noticesPlayer) {
            const awayAngle = Phaser.Math.Angle.Between(this.playerBody.x, this.playerBody.y, l.container.x, l.container.y);
            angle = awayAngle + Phaser.Math.FloatBetween(-0.4, 0.4);
          } else {
            angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
          }
          const dist = noticesPlayer ? Phaser.Math.Between(50, 90) : Phaser.Math.Between(20, 60);
          tx = Phaser.Math.Clamp(l.container.x + Math.cos(angle) * dist, this.letterR + 10, this.worldW - this.letterR - 10);
          ty = Phaser.Math.Clamp(l.container.y + Math.sin(angle) * dist, this.letterR + 10, this.worldH - this.letterR - 10);
          tries++;
        } while (!this.isWalkable(tx, ty) && tries < 8);
        if (!this.isWalkable(tx, ty)) { tx = a.x; ty = a.y; } // veilige terugval: terug naar het oorspronkelijke ankerpunt
        this.tweens.add({ targets: l.container, x: tx, y: ty, duration: noticesPlayer ? 500 : 1800, ease: "Sine.InOut" });
      }
    }
  }

  worldToScreen(worldX, worldY) {
    const cam = this.cameras.main;
    return { x: (worldX - cam.worldView.x) * cam.zoom, y: (worldY - cam.worldView.y) * cam.zoom };
  }

  destroyScene() {
    this.tweens.killAll();
    this.roundLetters.forEach((l) => { if (l.container && l.container.active) l.container.destroy(); });
    this.input.removeAllListeners();
  }
}

const DEPTH = { BACKGROUND: 0, MIDGROUND: 1, GAMEPLAY: 5, FOREGROUND: 10, FX: 20 };

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function clamp255(v) { return Math.max(0, Math.min(255, v)); }
function shade(hex, percent) {
  const num = parseInt(hex.slice(1), 16), amt = Math.round(2.55 * percent);
  const r = clamp255((num >> 16) + amt), g = clamp255(((num >> 8) & 0xff) + amt), b = clamp255((num & 0xff) + amt);
  return "#" + (0x1000000 + r * 0x10000 + g * 0x100 + b).toString(16).slice(1);
}
const lighten = (hex, pct) => shade(hex, pct);
const darken = (hex, pct) => shade(hex, -pct);

window.ChaseScene = ChaseScene;
