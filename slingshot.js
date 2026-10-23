// Letter Slingshot — klank -> letter. Het kind hoort een letter en schiet de steen
// op de lantaarn met die letter. Eigen route: #/gamestage/slingshot/1
//
// Spelregels (gelijk aan de referentiespelletjes):
//  - Alleen de beslissende actie telt: een lantaarn die echt geraakt wordt.
//    Een korte of gemiste worp is GEEN fout.
//  - Geen timers, geen levens. Een foute lantaarn wiebelt, de steen komt terug.
//  - Hulp (💡) alleen op verzoek; een mission met hulp telt als "geholpen".
//  - Drie missies met oplopende moeilijkheid: stilstaand, bewegend, 4 lantaarns.
//
// Phaser wordt (net als bij Letter Chase) pas geladen zodra dit scherm opent.
(() => {
  "use strict";

  const PHASER_SRC = "https://cdnjs.cloudflare.com/ajax/libs/phaser/3.70.0/phaser.min.js";
  const ROUTE = /^#\/gamestage\/slingshot(\/(\w+))?/;
  const DEBUG = location.hostname === "localhost";

  const $ = (id) => document.getElementById(id);
  const D = window.MiniCore;
  const { store, dir, lang, recordAttempt } = D;
  const RETURN_HASH = "#/gamestage/games";

  const TXT = {
    nl: { find: "Vind", good: "Goed gedaan", again: "Nog een keer", back: "Terug", listen: "Luister opnieuw", help: "Help mij",
      pull: "Trek de steen naar achteren en laat los", keys: "Pijltjes richten, spatie schiet" },
    en: { find: "Find", good: "Well done", again: "Play again", back: "Back", listen: "Listen again", help: "Help me",
      pull: "Pull the stone back and let go", keys: "Arrows aim, space shoots" },
    ar: { find: "ابحث عن", good: "أحسنت", again: "مرة أخرى", back: "رجوع", listen: "استمع مرة أخرى", help: "ساعدني",
      pull: "اسحب الحجر إلى الخلف ثم اتركه", keys: "الأسهم للتوجيه والمسافة للإطلاق" },
    tr: { find: "Bul", good: "Aferin", again: "Tekrar oyna", back: "Geri", listen: "Tekrar dinle", help: "Yardım et",
      pull: "Taşı geri çek ve bırak", keys: "Oklar nişan alır, boşluk atar" },
  };
  const tx = () => TXT[lang()] || TXT.nl;

  // ---------- Missies ----------
  const MG = window.MiniGames;
  const shuffle = MG.shuffle;
  // Missies van het huidige niveau: alle nieuwe letters + herhaal-letters; afleiders komen uit de hele pool.
  function buildMissions() {
    const lvl = MG.currentLevel(profileId);
    const cfgs = [{ moving: false, speed: 0, count: 3 }, { moving: true, speed: 0.4, count: 3 }, { moving: true, speed: 0.65, count: 4 }];
    return MG.missionTargets(lvl).map((target, i) => {
      const cfg = cfgs[Math.min(i, 2)];
      const d = MG.distractors(lvl, target, 3);
      const letters = [target, d[0], d[1]];
      if (cfg.count === 4) letters.push(d[2]);
      return { target, letters: shuffle(letters), moving: cfg.moving, speed: cfg.speed };
    });
  }

  // ---------- Module state ----------
  let active = false, epoch = 0;
  let profileId = null, game = null, scene = null;
  let missions = [], missionIdx = 0, solved = [], helped = false, wrongThisMission = 0, missionStart = 0, busy = false;

  function activeProfile() {
    const pid = store.get("gp_active", null);
    return store.get("gp_profiles", []).find((p) => p.id === pid) || null;
  }

  function loadScript(src) {
    return new Promise((res, rej) => {
      const s = document.createElement("script");
      s.src = src; s.onload = res; s.onerror = () => rej(new Error("script-load-failed " + src));
      document.head.appendChild(s);
    });
  }
  async function ensurePhaser() {
    if (window.Phaser) return;
    if (!ensurePhaser._p) ensurePhaser._p = loadScript(PHASER_SRC);
    await ensurePhaser._p;
  }

  // ---------- Opzet / teardown ----------
  function teardown() {
    active = false; epoch++;
    window.removeEventListener("keydown", onKey);
    if (scene) { try { scene.shutdownScene(); } catch {} scene = null; }
    if (game) { try { game.destroy(true); } catch {} game = null; }
    if (resizeObs) { resizeObs.disconnect(); resizeObs = null; }
    document.documentElement.classList.remove("gamestage-active");
    const section = $("gamestage");
    if (section && section.dataset.owner === "slingshot") { section.hidden = true; section.innerHTML = ""; delete section.dataset.owner; }
  }

  let resizeObs = null;

  async function setup() {
    const prof = activeProfile();
    if (!prof) { location.hash = "#/spel"; return; }
    profileId = prof.id;
    const myEpoch = ++epoch;
    const section = $("gamestage");
    if (!section) return;
    section.hidden = false; section.dataset.owner = "slingshot";
    active = true;
    document.documentElement.classList.add("gamestage-active");
    document.documentElement.dir = dir();

    missions = buildMissions(); missionIdx = 0; solved = []; helped = false; wrongThisMission = 0; busy = true;
    renderChrome();
    window.addEventListener("keydown", onKey);

    try {
      await ensurePhaser();
      if (document.fonts && document.fonts.load) await Promise.race([document.fonts.load('700 64px Amiri'), new Promise((r) => setTimeout(r, 1500))]);
    } catch (e) { if (DEBUG) console.warn(e); return; }
    if (myEpoch !== epoch) return;
    createGame(myEpoch);
  }

  function createGame(myEpoch) {
    const mount = $("slMount");
    if (!mount) return;
    const w = mount.clientWidth || 390, h = mount.clientHeight || 500;
    const SceneClass = makeSceneClass(window.Phaser);
    const local = new window.Phaser.Game({
      type: window.Phaser.AUTO, parent: "slMount", width: w, height: h, transparent: true,
      scale: { mode: window.Phaser.Scale.NONE },
    });
    game = local;
    local.events.once("ready", () => {
      if (myEpoch !== epoch) { try { local.destroy(true); } catch {} return; }
      const sc = local.scene.add("SlingScene", SceneClass, true, {});
      scene = sc;
      sc.events.on("sling-hit", onHit);
      sc.events.once("sling-ready", () => { if (myEpoch === epoch) startMission(); });
    });
    resizeObs = new ResizeObserver(() => {
      if (myEpoch !== epoch) return;
      const nw = mount.clientWidth, nh = mount.clientHeight;
      if (nw > 0 && nh > 0) local.scale.resize(nw, nh);
    });
    resizeObs.observe(mount);
    if (DEBUG) window.Slingshot = { get scene() { return scene; }, get game() { return game; }, get missions() { return missions; } };
  }

  // ---------- DOM-chrome (hergebruikt de chase-klassen uit minigames.css) ----------
  function renderChrome() {
    const tt = tx();
    $("gamestage").innerHTML = `
      <div class="chase-screen">
        <header class="chase-head">
          <button id="slBack" class="g-icon-btn" aria-label="${tt.back}"><svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg></button>
          <button id="slReplay" class="chase-replay" aria-label="${tt.listen}">🔊</button>
          <div class="chase-instr">
            <span class="chase-instr-text">${tt.find}</span>
            <span class="chase-instr-letter" id="slTarget" lang="ar" dir="rtl">؟</span>
          </div>
          <button id="slHelp" class="chase-replay sling-help" aria-label="${tt.help}">💡</button>
          <div class="chase-dots" id="slDots"></div>
        </header>
        <div class="chase-field" id="slField"><div id="slMount" class="chase-phaser-mount"></div></div>
        <div class="sling-hint" id="slHint">${tt.pull}</div>
        <div class="chase-overlay" id="slOverlay" hidden></div>
      </div>`;
    $("slBack").onclick = () => { location.hash = RETURN_HASH; };
    $("slReplay").onclick = () => playMissionAudio();
    $("slHelp").onclick = () => onHelp();
    updateDots();
  }
  function updateDots() {
    const el = $("slDots"); if (!el) return;
    el.innerHTML = missions.map((_, i) => `<i class="${i < solved.length ? "done" : ""}"></i>`).join("");
  }

  // ---------- Audio (AudioManager blijft de enige audio-eigenaar) ----------
  function playMissionAudio() {
    const m = missions[missionIdx]; if (!m) return Promise.resolve(false);
    const btn = $("slReplay");
    if (btn) { btn.disabled = true; btn.classList.add("is-playing"); }
    const done = () => { if (btn) { btn.disabled = false; btn.classList.remove("is-playing"); } };
    return window.AudioManager.playInstruction("find-letter").then((ok) => {
      if (ok === false) return false; // onderbroken: geen restje letter na het antwoord
      const base = window.GAME && window.GAME.letterAudio ? window.GAME.letterAudio[m.target] : null;
      return base ? window.AudioManager.playLearningAudio(base) : true;
    }).then(done, done);
  }
  function letterAudio(letter) {
    const base = window.GAME && window.GAME.letterAudio ? window.GAME.letterAudio[letter] : null;
    return base ? window.AudioManager.playLearningAudio(base) : Promise.resolve(true);
  }

  // ---------- Spelverloop ----------
  function startMission() {
    const m = missions[missionIdx];
    helped = false; wrongThisMission = 0; busy = false; missionStart = performance.now();
    $("slTarget").textContent = m.target;
    $("slHelp").classList.remove("is-used");
    scene.setupMission(m);
    playMissionAudio();
  }

  function onHelp() {
    if (!active || busy || !scene) return;
    helped = true;
    $("slHelp").classList.add("is-used");
    scene.highlightTarget();
    playMissionAudio();
  }

  function onHit({ letter, isTarget }) {
    if (!active || busy) return;
    const m = missions[missionIdx];
    recordAttempt(profileId, {
      game: "slingshot", target: m.target, selectedLetter: letter, correct: isTarget, helped,
      mission: missionIdx + 1, moving: m.moving, responseTimeMs: Math.round(performance.now() - missionStart), timestamp: Date.now(),
    });
    busy = true;
    const field = $("slField");
    if (isTarget) {
      solved.push({ target: m.target, helped, wrong: wrongThisMission });
      updateDots();
      scene.celebrateHit();
      MG.sfx("ok");
      MG.banner(field, { ok: true, letter });
      const finished = missionIdx + 1 >= missions.length;
      // Jingle, dan "goed gedaan" in de gekozen taal, dan even rust (geen letter erachteraan).
      MG.wait(500).then(() => window.AudioManager.playRandomCorrectFeedback())
        .then(() => MG.wait(1100)).then(() => {
          MG.hideBanner(field);
          if (!active) return;
          if (finished) complete(); else { missionIdx++; startMission(); }
        });
    } else {
      wrongThisMission++;
      scene.wrongHit();
      MG.sfx("no");
      MG.banner(field, { ok: false, letter });
      MG.wait(900).then(() => window.AudioManager.playRandomRetryFeedback()).then(() => MG.wait(500)).then(() => {
        MG.hideBanner(field);
        if (!active) return;
        busy = false;
        scene.returnStone();
        playMissionAudio(); // de gevraagde letter nog eens horen
      });
    }
  }

  function complete() {
    MG.finish($("slOverlay"), {
      pid: profileId, level: MG.currentLevel(profileId), stars: solved.filter((s) => !s.helped).length,
      onAgain: () => { missions = buildMissions(); missionIdx = 0; solved = []; updateDots(); startMission(); },
      onBack: () => { location.hash = RETURN_HASH; },
    });
  }

  function onKey(e) {
    if (!active) return;
    if (e.key === "Escape") { location.hash = RETURN_HASH; }
  }

  // ---------- Phaser-scène ----------
  function makeSceneClass(Phaser) {
    const clamp = Phaser.Math.Clamp;
    return class SlingScene extends Phaser.Scene {
      constructor() { super("SlingScene"); }

      preload() {
        ["palm_01", "rock_01", "flower_cluster_01"].forEach((id) => this.load.image(id, `assets/game/oasis/${id}.png`));
        this.load.on("loaderror", () => {}); // ontbrekende art mag het spel niet stoppen
      }

      create() {
        this.mission = null;
        this.lanterns = [];
        this.state = "idle"; // idle | dragging | flying | locked
        this.kb = { angle: 0, pull: 0, active: false };
        this.input.keyboard.on("keydown", this.onKeyDown, this);
        this.build();
        this.input.on("pointerdown", this.onDown, this);
        this.input.on("pointermove", this.onMove, this);
        this.input.on("pointerup", this.onUp, this);
        this.input.on("pointerupoutside", this.onUp, this);
        this.scale.on("resize", this.onResize, this);
        this.events.emit("sling-ready");
      }

      shutdownScene() {
        this.scale.off("resize", this.onResize, this);
        this.tweens.killAll();
      }

      // ----- Layout -----
      layoutValues() {
        const W = this.scale.width, H = this.scale.height;
        const size = clamp(Math.min(W * 0.2, H * 0.2), 64, 120);
        const anchor = { x: W / 2, y: H - clamp(H * 0.12, 70, 120) };
        const forkH = size * 0.75, forkW = size * 0.42;
        const rest = { x: anchor.x, y: anchor.y - forkH + forkW * 0.15 };
        return {
          W, H, size, anchor, forkH, forkW, rest,
          ropeY: H * 0.09, lanternY: H * 0.09 + size * 0.95 + H * 0.08,
          maxPull: clamp(H * 0.2, 70, 140), stoneR: size * 0.17,
          maxRange: (rest.y - H * 0.2) * 1.15,
        };
      }

      build() {
        const L = (this.L = this.layoutValues());
        const { W, H } = L;
        // Lucht + grond
        if (this.textures.exists("sling-sky")) this.textures.remove("sling-sky");
        const c = this.textures.createCanvas("sling-sky", 4, 256);
        const g = c.getContext();
        const grad = g.createLinearGradient(0, 0, 0, 256);
        grad.addColorStop(0, "#bfe4f5"); grad.addColorStop(0.55, "#e9f3dc"); grad.addColorStop(1, "#f2e2b0");
        g.fillStyle = grad; g.fillRect(0, 0, 4, 256); c.refresh();
        this.add.image(0, 0, "sling-sky").setOrigin(0).setDisplaySize(W, H).setDepth(0);
        this.add.ellipse(W / 2, H + H * 0.05, W * 1.6, H * 0.34, 0xe7cf8b).setDepth(1);
        this.add.ellipse(W / 2, H + H * 0.09, W * 1.7, H * 0.3, 0xd9bd72).setDepth(1);
        // Decor (alleen als de productie-art geladen is)
        const deco = (key, x, y, h) => { if (!this.textures.exists(key)) return; const im = this.add.image(x, y, key).setOrigin(0.5, 1); im.setScale(h / im.height); im.setDepth(2); };
        deco("palm_01", W * 0.09, H * 0.86, Math.min(H * 0.36, 250));
        deco("palm_01", W * 0.93, H * 0.82, Math.min(H * 0.3, 210));
        deco("flower_cluster_01", W * 0.2, H * 0.92, Math.min(H * 0.12, 90));
        deco("flower_cluster_01", W * 0.82, H * 0.93, Math.min(H * 0.1, 80));
        // Touw + wimpels
        this.ropeG = this.add.graphics().setDepth(3);
        this.bandG = this.add.graphics().setDepth(5);
        this.guideG = this.add.graphics().setDepth(4);
        // Katapult (vork)
        const { anchor, forkH, forkW } = L;
        const wood = this.add.graphics().setDepth(4);
        wood.lineStyle(forkW * 0.36, 0x7a4a24, 1);
        wood.beginPath(); wood.moveTo(anchor.x, anchor.y + forkH * 0.15); wood.lineTo(anchor.x, anchor.y - forkH * 0.35);
        wood.lineTo(anchor.x - forkW, anchor.y - forkH); wood.moveTo(anchor.x, anchor.y - forkH * 0.35); wood.lineTo(anchor.x + forkW, anchor.y - forkH);
        wood.strokePath();
        this.tipL = { x: anchor.x - forkW, y: anchor.y - forkH }; this.tipR = { x: anchor.x + forkW, y: anchor.y - forkH };
        // Steen
        this.stone = this.add.circle(L.rest.x, L.rest.y, L.stoneR, 0x8d8f96).setStrokeStyle(2, 0x5d5f66).setDepth(6);
        this.stoneHi = this.add.circle(L.rest.x - L.stoneR * 0.3, L.rest.y - L.stoneR * 0.3, L.stoneR * 0.3, 0xcfd1d6, 0.8).setDepth(7);
        this.stonePos = { x: L.rest.x, y: L.rest.y };
        this.drawBand();
        if (this.mission) this.buildLanterns();
      }

      onResize() {
        if (this.state === "flying") return;
        this.tweens.killAll();
        this.children.removeAll(true);
        this.build();
      }

      // ----- Lantaarns -----
      setupMission(m) {
        this.mission = m; this.state = "idle"; this.kb = { angle: 0, pull: 0, active: false };
        this.t0 = this.time.now;
        this.stonePos = { x: this.L.rest.x, y: this.L.rest.y };
        this.placeStone();
        this.buildLanterns(true);
      }

      buildLanterns(animateIn) {
        (this.lanterns || []).forEach((l) => l.c.destroy());
        const { W, size, lanternY } = this.L;
        const m = this.mission, n = m.letters.length;
        const spacing = (W * 0.64) / (n - 1), x0 = W * 0.18;
        const amp = m.moving ? spacing * 0.28 : 0;
        const fs = Math.round(size * 0.72);
        this.lanterns = m.letters.map((letter, i) => {
          const c = this.add.container(x0 + spacing * i, lanternY).setDepth(5);
          const body = this.add.graphics();
          body.fillStyle(0xfff6dc, 1); body.lineStyle(4, 0xc9973a, 1);
          body.fillRoundedRect(-size / 2, -size / 2, size, size, size * 0.2); body.strokeRoundedRect(-size / 2, -size / 2, size, size, size * 0.2);
          const glow = this.add.circle(0, 0, size * 0.62, 0xffd54a, 0).setStrokeStyle(6, 0xffd54a, 0);
          const txt = MG.letterText(this, 0, 0, letter, size * 0.58);
          c.add([glow, body, txt]);
          if (animateIn) { c.setScale(0.2); c.setAlpha(0); this.tweens.add({ targets: c, scale: 1, alpha: 1, duration: 320, delay: i * 70, ease: "Back.Out" }); }
          return { c, glow, letter, isTarget: letter === m.target, baseX: x0 + spacing * i, amp, phase: i * 1.7, hit: false };
        });
      }

      lanternXY(l, time) {
        const x = l.baseX + (l.amp ? Math.sin(time * (this.mission.speed || 0) * 1.6 + l.phase) * l.amp : 0);
        return { x, y: this.L.lanternY };
      }

      highlightTarget() {
        this.lanterns.forEach((l) => {
          if (!l.isTarget) return;
          l.glow.setStrokeStyle(6, 0xffd54a, 1);
          this.tweens.add({ targets: l.glow, scale: { from: 0.9, to: 1.18 }, duration: 520, yoyo: true, repeat: -1, ease: "Sine.InOut" });
        });
      }

      // ----- Steen / band -----
      placeStone() {
        this.stone.setPosition(this.stonePos.x, this.stonePos.y);
        this.stoneHi.setPosition(this.stonePos.x - this.L.stoneR * 0.3, this.stonePos.y - this.L.stoneR * 0.3);
        this.drawBand();
      }
      drawBand() {
        const g = this.bandG; g.clear();
        g.lineStyle(Math.max(3, this.L.stoneR * 0.4), 0x4b2a12, 1);
        g.beginPath(); g.moveTo(this.tipL.x, this.tipL.y); g.lineTo(this.stonePos.x, this.stonePos.y); g.lineTo(this.tipR.x, this.tipR.y); g.strokePath();
      }

      // Richting + kracht uit de huidige steenpositie (trek achteruit = schiet vooruit).
      aimFromStone() {
        const { rest, maxPull } = this.L;
        const dx = rest.x - this.stonePos.x, dy = rest.y - this.stonePos.y;
        const len = Math.hypot(dx, dy);
        if (len < 1) return { dir: { x: 0, y: -1 }, f: 0, len: 0 };
        return { dir: { x: dx / len, y: dy / len }, f: Math.min(1, len / maxPull), len };
      }

      // Eerste lantaarn die de lijn raakt (voor de richtlijn); eindpunt = bereik.
      castRay(dir, range) {
        const time = (this.time.now - this.t0) / 1000;
        const r = this.L.size * 0.5, { rest } = this.L;
        for (let d = 0; d <= range; d += 4) {
          const px = rest.x + dir.x * d, py = rest.y + dir.y * d;
          if (px < 0 || px > this.L.W || py < 0) return { d, hit: null };
          for (let i = 0; i < this.lanterns.length; i++) {
            const p = this.lanternXY(this.lanterns[i], time);
            if (Math.hypot(px - p.x, py - p.y) < r) return { d, hit: i };
          }
        }
        return { d: range, hit: null };
      }

      drawGuide(dir, f) {
        const g = this.guideG; g.clear();
        if (f < 0.12) return;
        const range = this.L.maxRange; // bereik hangt niet van de trekkracht af: de steen vliegt altijd tot aan de lantaarns
        const ray = this.castRay(dir, range);
        const { rest } = this.L;
        g.fillStyle(0xffffff, 0.9);
        for (let d = this.L.stoneR * 2; d < ray.d; d += this.L.stoneR * 2.2) {
          g.fillCircle(rest.x + dir.x * d, rest.y + dir.y * d, Math.max(2.5, this.L.stoneR * 0.28));
        }
        g.lineStyle(3, 0xffd54a, 0.95);
        g.strokeCircle(rest.x + dir.x * ray.d, rest.y + dir.y * ray.d, this.L.stoneR * 0.9);
      }

      // ----- Invoer -----
      pointerOnStone(p) {
        return Math.hypot(p.x - this.stonePos.x, p.y - this.stonePos.y) < Math.max(this.L.stoneR * 3.2, 44);
      }
      onDown(p) {
        if (this.state !== "idle" || !this.mission) return;
        if (!this.pointerOnStone(p)) return;
        this.state = "dragging"; this.kb.active = false;
      }
      onMove(p) {
        if (this.state !== "dragging") return;
        const { rest, maxPull } = this.L;
        let dx = p.x - rest.x, dy = Math.max(0, p.y - rest.y); // alleen naar achteren/beneden trekken
        const len = Math.hypot(dx, dy);
        if (len > maxPull) { dx = dx / len * maxPull; dy = dy / len * maxPull; }
        this.stonePos = { x: rest.x + dx, y: rest.y + dy };
        this.placeStone();
        const a = this.aimFromStone();
        this.drawGuide(a.dir, a.f);
      }
      onUp() {
        if (this.state !== "dragging") return;
        this.release();
      }

      release() {
        const a = this.aimFromStone();
        this.guideG.clear();
        if (a.f < 0.12 || a.dir.y > -0.2) { this.returnStone(); return; } // te zwak/niet omhoog: geen schot, geen fout
        this.fire(a.dir, this.L.maxRange);
      }

      fire(dir, range) {
        this.state = "flying";
        this.shot = { x: this.stonePos.x, y: this.stonePos.y, dir, range, dist: 0 };
        // Steen springt vanaf de vorkpositie
        this.shot.x = this.L.rest.x; this.shot.y = this.L.rest.y;
        this.stonePos = { x: this.L.rest.x, y: this.L.rest.y };
        this.drawBand();
      }

      returnStone() {
        this.state = "locked";
        this.guideG.clear();
        this.tweens.add({
          targets: this.stone, x: this.L.rest.x, y: this.L.rest.y, alpha: 1, scale: 1, duration: 220, ease: "Quad.Out",
          onUpdate: () => { this.stoneHi.setPosition(this.stone.x - this.L.stoneR * 0.3, this.stone.y - this.L.stoneR * 0.3); this.stonePos = { x: this.stone.x, y: this.stone.y }; this.drawBand(); },
          onComplete: () => { this.stonePos = { x: this.L.rest.x, y: this.L.rest.y }; this.placeStone(); this.state = "idle"; },
        });
      }

      // ----- Resultaat-animaties -----
      celebrateHit() {
        const l = this.hitLantern; if (!l) return;
        l.glow.setStrokeStyle(8, 0xffd54a, 1);
        this.tweens.add({ targets: l.c, scale: 1.25, duration: 260, yoyo: true, ease: "Quad.Out" });
        for (let i = 0; i < 10; i++) {
          const s = this.add.star(l.c.x, l.c.y, 5, 4, 9, 0xffd54a).setDepth(9);
          const ang = (i / 10) * Math.PI * 2;
          this.tweens.add({ targets: s, x: l.c.x + Math.cos(ang) * 90, y: l.c.y + Math.sin(ang) * 90, alpha: 0, angle: 180, duration: 650, onComplete: () => s.destroy() });
        }
        this.state = "locked";
        this.stone.setAlpha(0); this.stoneHi.setAlpha(0);
        this.time.delayedCall(700, () => { this.stone.setAlpha(1); this.stoneHi.setAlpha(1); });
      }
      wrongHit() {
        const l = this.hitLantern; if (!l) return;
        const x0 = l.c.x;
        this.tweens.add({ targets: l.c, angle: { from: -9, to: 9 }, duration: 90, yoyo: true, repeat: 3, onComplete: () => l.c.setAngle(0) });
        this.state = "locked";
        this.stone.setAlpha(0); this.stoneHi.setAlpha(0);
        this.time.delayedCall(350, () => { this.stone.setAlpha(1); this.stoneHi.setAlpha(1); this.stone.setPosition(this.L.rest.x, this.L.rest.y); this.placeStone(); });
      }

      // ----- Frame-lus -----
      update(_, delta) {
        const time = (this.time.now - this.t0) / 1000;
        // Bewegende lantaarns
        if (this.lanterns) this.lanterns.forEach((l) => { l.c.x = this.lanternXY(l, time).x; });
        // Touwtjes
        if (this.ropeG && this.lanterns) {
          const g = this.ropeG; g.clear();
          const { W, ropeY, size, lanternY } = this.L;
          g.lineStyle(4, 0x7b5a30, 1); g.beginPath(); g.moveTo(0, ropeY); g.lineTo(W, ropeY); g.strokePath();
          this.lanterns.forEach((l) => { g.beginPath(); g.moveTo(l.c.x, ropeY); g.lineTo(l.c.x, lanternY - size / 2); g.strokePath(); });
        }
        if (this.state === "dragging") { const a = this.aimFromStone(); this.drawGuide(a.dir, a.f); }
        // Vliegende steen
        if (this.state === "flying" && this.shot) this.stepShot(delta);
      }

      // Toetsenbord (event-gebaseerd, dus ook korte aanslagen tellen): pijltjes richten
      // en trekken, spatie/enter schiet.
      onKeyDown(e) {
        if (!this.mission || (this.state !== "idle" && !(this.state === "dragging" && this.kb.active))) return;
        const key = e.key;
        if (key === " " || e.code === "Space" || key === "Enter") {
          e.preventDefault();
          if (this.kb.active) { this.kb.active = false; this.release(); }
          return;
        }
        const step = { ArrowLeft: [-4, 0], ArrowRight: [4, 0], ArrowUp: [0, 0.07], ArrowDown: [0, -0.07] }[key];
        if (!step) return;
        e.preventDefault();
        if (!this.kb.active) { this.kb.active = true; this.kb.pull = Math.max(this.kb.pull, 0.55); this.state = "dragging"; }
        this.kb.angle = clamp(this.kb.angle + step[0], -42, 42);
        this.kb.pull = clamp(this.kb.pull + step[1], 0, 1);
        const rad = Phaser.Math.DegToRad(this.kb.angle);
        const dir = { x: Math.sin(rad), y: -Math.cos(rad) };
        const len = this.kb.pull * this.L.maxPull;
        this.stonePos = { x: this.L.rest.x - dir.x * len, y: this.L.rest.y - dir.y * len };
        this.placeStone();
        this.drawGuide(dir, this.kb.pull);
      }

      stepShot(delta) {
        const sh = this.shot, speed = 1100, time = (this.time.now - this.t0) / 1000;
        let remaining = speed * (delta / 1000);
        while (remaining > 0 && sh.dist < sh.range) {
          const step = Math.min(remaining, 6);
          sh.x += sh.dir.x * step; sh.y += sh.dir.y * step; sh.dist += step; remaining -= step;
          for (let i = 0; i < this.lanterns.length; i++) {
            const p = this.lanternXY(this.lanterns[i], time);
            if (Math.hypot(sh.x - p.x, sh.y - p.y) < this.L.size * 0.5) { this.endShot(i); return; }
          }
          if (sh.x < -20 || sh.x > this.L.W + 20 || sh.y < -20) { sh.dist = sh.range; }
        }
        this.stone.setPosition(sh.x, sh.y);
        this.stoneHi.setPosition(sh.x - this.L.stoneR * 0.3, sh.y - this.L.stoneR * 0.3);
        if (sh.dist >= sh.range) { // gemist/te kort: GEEN fout
          this.shot = null;
          this.stone.setPosition(sh.x, sh.y);
          this.returnStone();
        }
      }

      endShot(index) {
        this.shot = null;
        const l = this.lanterns[index];
        this.hitLantern = l;
        this.state = "locked";
        this.events.emit("sling-hit", { letter: l.letter, isTarget: l.isTarget });
      }
    };
  }

  // ---------- Route ----------
  function route() {
    const h = location.hash;
    if (!ROUTE.test(h)) { if (active) teardown(); return; }
    if (active) return;
    setup();
  }
  window.addEventListener("hashchange", route);
  route();
})();
