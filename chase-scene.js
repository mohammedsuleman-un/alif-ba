// Letter Chase V2 — Phaser-wereld (camera/wereld/physics/layers), volledig
// losstaand van de DOM-chrome en app-integratie in game-stage.js.
//
// Verantwoordelijkheden van DEZE scene: wereld + camera + character + letter-
// objecten + scenery-layers + collision. GEEN audio, GEEN localStorage, GEEN
// routing — die blijven in game-stage.js ("de bestaande app-interface"), die
// deze scene aanstuurt via een kleine publieke API (zie onder "PUBLIEKE API")
// en naar buiten luistert via Phaser's eigen events ("this.events.emit").
//
// Lagen (sectie 18 van de opdracht), via Phaser depth, laag naar hoog:
//   BACKGROUND(0) < MIDGROUND(1, water/waterval) < GAMEPLAY(5, letters+player)
//   < FOREGROUND(10, boom-placeholder) < FX(20, correct-sparkle)
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
    this.textureUrls = data.textureUrls; // { idle, wave, happy, thinking, encouraging, celebrate }
    this.charBoxSize = data.charBoxSize;
    this.inputMode = data.inputMode || "dpad";

    this.letterR = 59;
    this.roundLetters = []; // [{letter,isTarget,textObj,wanderAnchor:{x,y}}]
    this.collisionLocked = true; // pas na spawnRound() + "ready" weer actief
    this.moveVector = { x: 0, y: 0 }; // d-pad/keyboard, genormaliseerd
    this.moveTargetWorld = null;      // tap-to-move bestemming, of null
    this.facing = 1;
  }

  preload() {
    Object.entries(this.textureUrls).forEach(([mood, url]) => {
      if (url) this.load.image(`char-${mood}`, url);
    });
  }

  create() {
    this.physics.world.setBounds(0, 0, this.worldW, this.worldH);
    this.cameras.main.setBounds(0, 0, this.worldW, this.worldH);

    this.buildBackground();
    this.buildMidground();
    this.buildForeground();

    this.buildPlayer();

    // Camera volgt vloeiend (lerp), niet hard gecentreerd op elke pixel —
    // sectie 6 van de opdracht.
    this.cameras.main.startFollow(this.playerBody, true, 0.09, 0.09);

    this.input.on("pointerdown", (pointer) => {
      if (this.inputMode !== "tap" || this.collisionLocked) return;
      const wp = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
      this.moveToWorld(wp.x, wp.y);
    });

    this.spawnRound();
    this.events.emit("chase-ready");
  }

  update(time, delta) {
    this.updateMovement(delta / 1000);
    this.updateWalkBob(time);
    this.updateScenery(delta);
    this.updateWander(time, delta);
  }

  // ========== PUBLIEKE API (aangeroepen vanuit game-stage.js) ==========

  setInputMode(mode) {
    this.inputMode = mode;
    this.moveVector = { x: 0, y: 0 };
    this.clearMoveTarget();
  }

  // d-pad/keyboard sturen een genormaliseerde richtingsvector (sectie 10:
  // "moveVector(x, y)"), niet een absolute snelheid — de scene bepaalt zelf
  // de speed/physics.
  setMoveVector(x, y) {
    if (x || y) this.clearMoveTarget();
    this.moveVector = { x, y };
  }

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

  lockInput() {
    this.collisionLocked = true;
    this.moveVector = { x: 0, y: 0 };
    this.clearMoveTarget();
  }
  unlockInput() { this.collisionLocked = false; }

  // Levert de huidige speler-wereldpositie + afstand tot een punt — gebruikt
  // door game-stage.js om chaseDistancePx te loggen (sectie 24).
  getPlayerWorldPos() { return { x: this.playerBody.x, y: this.playerBody.y }; }

  celebrateAt(worldX, worldY) {
    const p = this.worldToScreen(worldX, worldY);
    const ring = this.add.circle(worldX, worldY, 20, 0x3fa85c, 0.35).setDepth(DEPTH.FX);
    this.tweens.add({ targets: ring, radius: 70, alpha: 0, duration: 500, ease: "Sine.Out", onComplete: () => ring.destroy() });
    return p;
  }

  spawnRound() {
    this.roundLetters.forEach((l) => l.textObj.destroy());
    this.roundLetters = [];

    const letters = Phaser.Utils.Array.Shuffle([this.chaseConfig.target, ...this.chaseConfig.distractors]);
    const { min: minD, max: maxD } = this.spawnDist;
    const margin = this.letterR + 16;
    const wx0 = margin, wx1 = this.worldW - margin;
    const wy0 = margin, wy1 = this.worldH - margin;
    const avoidX = this.playerBody.x, avoidY = this.playerBody.y;

    const minDistFloor = this.letterR * 2 + 6;
    const avoidRFloor = this.charBoxSize.h / 2 + this.letterR + 4;
    const placed = [];

    for (let li = 0; li < letters.length; li++) {
      let minLetterDist = this.letterR * 2 + 34;
      let avoidR = this.charBoxSize.h / 2 + this.letterR + 30;
      let found = null;

      const inBounds = (x, y) => x >= wx0 && x <= wx1 && y >= wy0 && y <= wy1;
      const isValid = (x, y) => inBounds(x, y)
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
        for (let tcount = 0; tcount < 200 && !found; tcount++) {
          const p = randomCandidate();
          if (isValid(p.x, p.y)) found = p;
        }
        if (!found) { for (const p of gridCandidates()) { if (isValid(p.x, p.y)) { found = p; break; } } }
        if (!found) { minLetterDist = Math.max(minDistFloor, minLetterDist * 0.82); avoidR = Math.max(avoidRFloor, avoidR * 0.82); }
      }
      if (!found) {
        let best = null, bestScore = -Infinity;
        for (const p of [...Array(200)].map(randomCandidate).concat(gridCandidates())) {
          if (!inBounds(p.x, p.y)) continue;
          const scoreAvoid = Phaser.Math.Distance.Between(p.x, p.y, avoidX, avoidY) - avoidRFloor;
          const scoreLetters = placed.length ? Math.min(...placed.map((q) => Phaser.Math.Distance.Between(p.x, p.y, q.x, q.y))) - minDistFloor : Infinity;
          const score = Math.min(scoreAvoid, scoreLetters);
          if (score > bestScore) { bestScore = score; best = p; }
        }
        found = best || { x: (wx0 + wx1) / 2, y: (wy0 + wy1) / 2 };
      }
      placed.push(found);
    }

    this.roundLetters = letters.map((letter, i) => this.makeLetterObject(letter, placed[i].x, placed[i].y));
  }

  destroyScene() {
    this.tweens.killAll();
    this.roundLetters.forEach((l) => l.textObj.destroy());
    this.input.removeAllListeners();
  }

  // ========== interne opbouw ==========

  makeLetterObject(letter, x, y) {
    const isTarget = letter === this.chaseConfig.target;
    const textObj = this.add.text(x, y, letter, {
      fontFamily: "Amiri, serif", fontSize: "58px", color: "#2a1c12",
    }).setOrigin(0.5).setDepth(DEPTH.GAMEPLAY).setPadding(8, 8, 8, 8)
      .setShadow(0, 3, "rgba(120,80,20,.35)", 6, false, true);
    this.physics.add.existing(textObj);
    const r = this.letterR;
    textObj.body.setCircle(r, textObj.displayWidth / 2 - r, textObj.displayHeight / 2 - r);

    // Rustige idle-animatie (sectie 13): zacht zweven + heel subtiele
    // schaal-"adem" — nooit wilde beweging, letter blijft goed herkenbaar.
    this.tweens.add({ targets: textObj, y: y - 6, duration: 1400 + Math.random() * 400, yoyo: true, repeat: -1, ease: "Sine.InOut" });
    this.tweens.add({ targets: textObj, scale: 1.04, duration: 1800 + Math.random() * 400, yoyo: true, repeat: -1, ease: "Sine.InOut" });

    const obj = { letter, isTarget, textObj, wanderAnchor: { x, y }, wanderNextAt: 0 };
    this.physics.add.overlap(this.playerBody, textObj, () => this.onOverlap(obj), null, this);
    return obj;
  }

  onOverlap(obj) {
    if (this.collisionLocked) return;
    this.collisionLocked = true;
    textObjSafeDisableBody(obj.textObj);
    this.events.emit("chase-collision", { letter: obj.letter, isTarget: obj.isTarget, worldX: obj.textObj.x, worldY: obj.textObj.y });
  }

  buildPlayer() {
    const startX = this.worldW / 2, startY = this.worldH * 0.5;
    // Onzichtbaar physics-lichaam = de "echte" speler (movement/collision/
    // camera-follow); een los, puur visueel sprite erbovenop geeft de
    // subtiele loop-bob zonder de physics-stap te verstoren.
    this.playerBody = this.physics.add.image(startX, startY, "char-idle").setVisible(false);
    this.playerBody.body.setCircle(this.charBoxSize.h * 0.32);
    this.playerBody.setCollideWorldBounds(true);
    this.playerBody.setDepth(DEPTH.GAMEPLAY);

    this.playerSprite = this.add.image(startX, startY, "char-wave")
      .setDisplaySize(this.charBoxSize.w, this.charBoxSize.h)
      .setOrigin(0.5, 1) // voetpunt-anchor, net als de V1.2 DOM-versie
      .setDepth(DEPTH.GAMEPLAY);
  }

  buildBackground() {
    const canvas = document.createElement("canvas");
    canvas.width = 8; canvas.height = 512;
    const ctx = canvas.getContext("2d");
    const grad = ctx.createLinearGradient(0, 0, 0, 512);
    grad.addColorStop(0, "#bfe4f5"); grad.addColorStop(0.62, "#e7f4de"); grad.addColorStop(1, "#ead9a6");
    ctx.fillStyle = grad; ctx.fillRect(0, 0, 8, 512);
    this.textures.addCanvas("chaseSky", canvas);
    this.add.image(0, 0, "chaseSky").setOrigin(0, 0).setDisplaySize(this.worldW, this.worldH).setDepth(DEPTH.BACKGROUND);

    const groundH = this.worldH * 0.16;
    this.add.rectangle(0, this.worldH - groundH, this.worldW, groundH, 0xd9b36a).setOrigin(0, 0).setDepth(DEPTH.BACKGROUND + 0.1);

    // Zon + een paar wolken, puur decoratief (geen AI-art, simpele vormen).
    this.add.circle(this.worldW - 140, 140, 60, 0xffd264, 1).setDepth(DEPTH.BACKGROUND + 0.2);
    for (let i = 0; i < 6; i++) {
      this.add.text(Phaser.Math.Between(80, this.worldW - 80), Phaser.Math.Between(60, this.worldH * 0.5), "☁️", { fontSize: "40px" })
        .setAlpha(0.8).setDepth(DEPTH.BACKGROUND + 0.2);
    }
  }

  buildMidground() {
    // Sectie 19: eenvoudige, performante geanimeerde watertextuur.
    const waterCanvas = document.createElement("canvas");
    waterCanvas.width = 64; waterCanvas.height = 64;
    const wctx = waterCanvas.getContext("2d");
    wctx.fillStyle = "#6fc3e0"; wctx.fillRect(0, 0, 64, 64);
    wctx.strokeStyle = "rgba(255,255,255,.5)"; wctx.lineWidth = 3;
    for (let y = 8; y < 64; y += 16) { wctx.beginPath(); wctx.moveTo(0, y); wctx.bezierCurveTo(16, y - 6, 48, y + 6, 64, y); wctx.stroke(); }
    this.textures.addCanvas("chaseWater", waterCanvas);

    const waterY = this.worldH * 0.58, waterH = 110, waterW = this.worldW * 0.5, waterX = this.worldW * 0.08;
    this.water = this.add.tileSprite(waterX, waterY, waterW, waterH, "chaseWater").setOrigin(0, 0).setDepth(DEPTH.MIDGROUND).setAlpha(0.9);

    // Sectie 20: eenvoudige geanimeerde "waterval" (verticale tile-scroll).
    const fallCanvas = document.createElement("canvas");
    fallCanvas.width = 32; fallCanvas.height = 64;
    const fctx = fallCanvas.getContext("2d");
    fctx.fillStyle = "#bfe9f5"; fctx.fillRect(0, 0, 32, 64);
    fctx.strokeStyle = "rgba(255,255,255,.7)"; fctx.lineWidth = 3;
    for (let x = 4; x < 32; x += 8) { fctx.beginPath(); fctx.moveTo(x, 0); fctx.lineTo(x, 64); fctx.stroke(); }
    this.textures.addCanvas("chaseWaterfall", fallCanvas);
    this.waterfall = this.add.tileSprite(waterX - 60, waterY - 160, 56, 160, "chaseWaterfall").setOrigin(0, 0).setDepth(DEPTH.MIDGROUND);
  }

  buildForeground() {
    // Sectie 21: één foreground-object (boom-placeholder) om depth-ordering
    // te bewijzen — character/letters zitten op GAMEPLAY(5), dit object op
    // FOREGROUND(10), dus het character kan er visueel "achter" lopen.
    this.add.text(this.worldW * 0.42, this.worldH * 0.46, "🌴", { fontSize: "140px" }).setOrigin(0.5).setDepth(DEPTH.FOREGROUND);
  }

  updateScenery(delta) {
    if (this.water) this.water.tilePositionX += delta * 0.02;
    if (this.waterfall) this.waterfall.tilePositionY += delta * 0.15;
  }

  updateMovement(dt) {
    if (this.collisionLocked) { this.playerBody.setVelocity(0, 0); return; }
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
    this.playerBody.setVelocity(dx * SPEED, dy * SPEED);
    if (dx) this.facing = dx < 0 ? -1 : 1;
    this.playerSprite.setFlipX(this.facing < 0); // uitsluitend op basis van bewegingsrichting, nooit RTL
  }

  updateWalkBob(time) {
    const moving = this.playerBody.body.velocity.lengthSq() > 4;
    const bob = moving ? Math.sin(time * 0.012) * 3 : 0;
    this.playerSprite.x = this.playerBody.x;
    this.playerSprite.y = this.playerBody.y + bob;
  }

  // Sectie 14/15: de CORRECTE letter mag (achter chaseConfig.movingTarget)
  // langzaam en voorspelbaar binnen een klein gebied bewegen — geen
  // pathfinding, geen snelheid die met de speler kan concurreren.
  updateWander(time, delta) {
    if (!this.chaseConfig.movingTarget) return;
    for (const l of this.roundLetters) {
      if (!l.isTarget || !l.textObj.active) continue;
      if (time > l.wanderNextAt) {
        l.wanderNextAt = time + Phaser.Math.Between(1800, 2800);
        const a = l.wanderAnchor;
        const tx = Phaser.Math.Clamp(a.x + Phaser.Math.Between(-60, 60), this.letterR + 10, this.worldW - this.letterR - 10);
        const ty = Phaser.Math.Clamp(a.y + Phaser.Math.Between(-60, 60), this.letterR + 10, this.worldH - this.letterR - 10);
        this.tweens.add({ targets: l.textObj, x: tx, y: ty, duration: 2000, ease: "Sine.InOut" });
      }
    }
  }

  worldToScreen(worldX, worldY) {
    const cam = this.cameras.main;
    return { x: (worldX - cam.worldView.x) * cam.zoom, y: (worldY - cam.worldView.y) * cam.zoom };
  }
}

const DEPTH = { BACKGROUND: 0, MIDGROUND: 1, GAMEPLAY: 5, FOREGROUND: 10, FX: 20 };

function textObjSafeDisableBody(textObj) {
  if (textObj.body) textObj.body.enable = false;
}

window.ChaseScene = ChaseScene;
