// Letter Photographer — vorm onderscheiden. Het kind is fotograaf in de oase:
// versleep de camera, zoom in en fotografeer de lettertegel met de gevraagde letter.
// Zoomen is de kern: ب ت ث verschillen alleen door de puntjes. Route: #/gamestage/photographer/1
//
// Regels: alleen een foto van precies één hele letter telt als antwoord. Een lege foto,
// een afgesneden of meerdere letters, of een te verre foto geeft een hint en telt NIET.
// Geen timers; hulp (💡) alleen op verzoek.
(() => {
  "use strict";

  const PHASER_SRC = "https://cdnjs.cloudflare.com/ajax/libs/phaser/3.70.0/phaser.min.js";
  const ROUTE = /^#\/gamestage\/photographer(\/(\w+))?/;
  const DEBUG = location.hostname === "localhost";

  const $ = (id) => document.getElementById(id);
  const D = window.ChaseData;
  const { store, dir, lang, recordAttempt } = D;
  const RETURN_HASH = D.RETURN_HASH;

  const TXT = {
    nl: { find: "Fotografeer", good: "Goed gedaan", again: "Nog een keer", back: "Terug", listen: "Luister opnieuw", help: "Help mij",
      hint: "Sleep om te zoeken, zoom in en maak de foto",
      empty: "Zet een letter in het kader", far: "Kom dichterbij", cut: "Eén hele letter in het kader", zoomIn: "Inzoomen", zoomOut: "Uitzoomen", shutter: "Foto maken" },
    en: { find: "Photograph", good: "Well done", again: "Play again", back: "Back", listen: "Listen again", help: "Help me",
      hint: "Drag to look around, zoom in and take the photo",
      empty: "Put a letter in the frame", far: "Come closer", cut: "One whole letter in the frame", zoomIn: "Zoom in", zoomOut: "Zoom out", shutter: "Take photo" },
    ar: { find: "صوّر", good: "أحسنت", again: "مرة أخرى", back: "رجوع", listen: "استمع مرة أخرى", help: "ساعدني",
      hint: "اسحب للبحث ثم قرّب والتقط الصورة",
      empty: "ضع حرفًا داخل الإطار", far: "اقترب قليلًا", cut: "حرف واحد كامل داخل الإطار", zoomIn: "تكبير", zoomOut: "تصغير", shutter: "التقط صورة" },
    tr: { find: "Fotoğrafla", good: "Aferin", again: "Tekrar oyna", back: "Geri", listen: "Tekrar dinle", help: "Yardım et",
      hint: "Sürükleyerek ara, yakınlaş ve fotoğrafı çek",
      empty: "Bir harfi çerçevenin içine al", far: "Biraz yaklaş", cut: "Çerçevede tek bir tam harf", zoomIn: "Yakınlaştır", zoomOut: "Uzaklaştır", shutter: "Fotoğraf çek" },
  };
  const tx = () => TXT[lang()] || TXT.nl;

  const LETTERS = ["ب", "ت", "ث"];
  const shuffle = (a) => { const r = [...a]; for (let i = r.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [r[i], r[j]] = [r[j], r[i]]; } return r; };
  const WORLD = { w: 1700, h: 1000 };
  const ZOOMS = [0.9, 1.6, 2.6];

  function buildMissions() {
    // Elke missie een andere doelletter; meer tegels naarmate het spel vordert.
    return shuffle(LETTERS).map((target, i) => ({ target, count: [10, 13, 16][i] }));
  }

  // Tegels verspreid over de wereld met minimale onderlinge afstand; doel komt 2-3x voor.
  function layoutSigns(m) {
    const others = LETTERS.filter((l) => l !== m.target);
    const targets = 2 + (Math.random() < 0.5 ? 1 : 0);
    const letters = shuffle([...Array(targets).fill(m.target), ...Array.from({ length: m.count - targets }, (_, i) => others[i % others.length])]);
    const pts = [];
    const minD = 210;
    for (const letter of letters) {
      let p = null;
      for (let tries = 0; tries < 400 && !p; tries++) {
        const c = { x: 140 + Math.random() * (WORLD.w - 280), y: 190 + Math.random() * (WORLD.h - 330) };
        if (pts.every((q) => Math.hypot(q.x - c.x, q.y - c.y) >= minD)) p = c;
      }
      if (p) pts.push({ ...p, letter });
    }
    return pts;
  }

  // ---------- State ----------
  let active = false, epoch = 0, profileId = null, game = null, scene = null, resizeObs = null;
  let missions = [], missionIdx = 0, solved = [], helped = false, wrongThisMission = 0, missionStart = 0, busy = false;
  let toastTimer = null;

  function activeProfile() {
    const pid = store.get("gp_active", null);
    return store.get("gp_profiles", []).find((p) => p.id === pid) || null;
  }
  function loadScript(src) {
    return new Promise((res, rej) => { const s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = () => rej(new Error("script-load-failed")); document.head.appendChild(s); });
  }
  async function ensurePhaser() {
    if (window.Phaser) return;
    if (!ensurePhaser._p) ensurePhaser._p = loadScript(PHASER_SRC);
    await ensurePhaser._p;
  }

  function teardown() {
    active = false; epoch++;
    window.removeEventListener("keydown", onKey);
    clearTimeout(toastTimer);
    if (scene) { try { scene.shutdownScene(); } catch {} scene = null; }
    if (game) { try { game.destroy(true); } catch {} game = null; }
    if (resizeObs) { resizeObs.disconnect(); resizeObs = null; }
    document.documentElement.classList.remove("gamestage-active");
    const section = $("gamestage");
    if (section && section.dataset.owner === "photographer") { section.hidden = true; section.innerHTML = ""; delete section.dataset.owner; }
  }

  async function setup() {
    const prof = activeProfile();
    if (!prof) { location.hash = "#/spel"; return; }
    profileId = prof.id;
    const myEpoch = ++epoch;
    const section = $("gamestage");
    if (!section) return;
    section.hidden = false; section.dataset.owner = "photographer";
    active = true;
    document.documentElement.classList.add("gamestage-active");
    document.documentElement.dir = dir();
    missions = buildMissions(); missionIdx = 0; solved = []; helped = false; wrongThisMission = 0; busy = true;
    renderChrome();
    window.addEventListener("keydown", onKey);
    try {
      await ensurePhaser();
      if (document.fonts && document.fonts.load) await Promise.race([document.fonts.load('700 64px Amiri'), new Promise((r) => setTimeout(r, 1500))]);
    } catch { return; }
    if (myEpoch !== epoch) return;
    createGame(myEpoch);
  }

  function createGame(myEpoch) {
    const mount = $("phMount");
    if (!mount) return;
    const SceneClass = makeSceneClass(window.Phaser);
    const local = new window.Phaser.Game({
      type: window.Phaser.AUTO, parent: "phMount", width: mount.clientWidth || 390, height: mount.clientHeight || 500,
      transparent: true, scale: { mode: window.Phaser.Scale.NONE },
    });
    game = local;
    local.events.once("ready", () => {
      if (myEpoch !== epoch) { try { local.destroy(true); } catch {} return; }
      scene = local.scene.add("PhotoScene", SceneClass, true, {});
      scene.events.once("photo-ready", () => { if (myEpoch === epoch) startMission(); });
    });
    resizeObs = new ResizeObserver(() => {
      if (myEpoch !== epoch) return;
      const w = mount.clientWidth, h = mount.clientHeight;
      if (w > 0 && h > 0) { local.scale.resize(w, h); if (scene) scene.onResize(); layoutFrame(); }
    });
    resizeObs.observe(mount);
    if (DEBUG) window.Photographer = { get scene() { return scene; }, get missions() { return missions; } };
  }

  // ---------- DOM-chrome ----------
  function renderChrome() {
    const tt = tx();
    $("gamestage").innerHTML = `
      <div class="chase-screen">
        <header class="chase-head">
          <button id="phBack" class="g-icon-btn" aria-label="${tt.back}"><svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg></button>
          <button id="phReplay" class="chase-replay" aria-label="${tt.listen}">🔊</button>
          <div class="chase-instr">
            <span class="chase-instr-text">${tt.find}</span>
            <span class="chase-instr-letter" id="phTarget" lang="ar" dir="rtl">؟</span>
          </div>
          <button id="phHelp" class="chase-replay sling-help" aria-label="${tt.help}">💡</button>
          <div class="chase-dots" id="phDots"></div>
        </header>
        <div class="chase-field" id="phField">
          <div id="phMount" class="chase-phaser-mount"></div>
          <div class="photo-frame" id="phFrame"><i></i><i></i><i></i><i></i></div>
          <div class="photo-flash" id="phFlash"></div>
          <div class="photo-toast" id="phToast" hidden></div>
        </div>
        <div class="photo-controls" id="phControls">
          <p class="photo-hint">${tt.hint}</p>
          <div class="photo-btns">
            <button class="chase-btn" id="phZoomOut" aria-label="${tt.zoomOut}"><svg viewBox="0 0 24 24"><path d="M5 12h14"/></svg></button>
            <button class="chase-btn photo-shutter" id="phShutter" aria-label="${tt.shutter}">📷</button>
            <button class="chase-btn" id="phZoomIn" aria-label="${tt.zoomIn}"><svg viewBox="0 0 24 24"><path d="M5 12h14M12 5v14"/></svg></button>
          </div>
        </div>
        <div class="chase-overlay" id="phOverlay" hidden></div>
      </div>`;
    $("phBack").onclick = () => { location.hash = "#/gamestage/games"; };
    $("phReplay").onclick = () => playMissionAudio();
    $("phHelp").onclick = () => onHelp();
    $("phShutter").onclick = () => shutter();
    $("phZoomIn").onclick = () => scene && scene.stepZoom(1);
    $("phZoomOut").onclick = () => scene && scene.stepZoom(-1);
    updateDots();
    layoutFrame();
  }

  // Het kader is een vierkant in het midden van het speelveld (DOM, zodat het scherp blijft).
  function frameSize() {
    const f = $("phField"); if (!f) return 200;
    return Math.round(Math.min(f.clientWidth, f.clientHeight) * 0.56);
  }
  function layoutFrame() {
    const fr = $("phFrame"), f = $("phField"); if (!fr || !f) return;
    const s = frameSize();
    fr.style.width = fr.style.height = s + "px";
    fr.style.left = Math.round((f.clientWidth - s) / 2) + "px";
    fr.style.top = Math.round((f.clientHeight - s) / 2) + "px";
  }
  function updateDots() {
    const el = $("phDots"); if (!el) return;
    el.innerHTML = missions.map((_, i) => `<i class="${i < solved.length ? "done" : ""}"></i>`).join("");
  }
  function toast(msg) {
    const el = $("phToast"); if (!el) return;
    el.textContent = msg; el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, 1800);
  }

  // ---------- Audio ----------
  function playMissionAudio() {
    const m = missions[missionIdx]; if (!m) return Promise.resolve(false);
    const btn = $("phReplay");
    if (btn) { btn.disabled = true; btn.classList.add("is-playing"); }
    const done = () => { if (btn) { btn.disabled = false; btn.classList.remove("is-playing"); } };
    return window.AudioManager.playInstruction("find-letter").then(() => letterAudio(m.target)).then(done, done);
  }
  function letterAudio(letter) {
    const base = window.GAME && window.GAME.letterAudio ? window.GAME.letterAudio[letter] : null;
    return base ? window.AudioManager.playLearningAudio(base) : Promise.resolve(true);
  }

  // ---------- Verloop ----------
  function startMission() {
    const m = missions[missionIdx];
    helped = false; wrongThisMission = 0; busy = false; missionStart = performance.now();
    $("phTarget").textContent = m.target;
    $("phHelp").classList.remove("is-used");
    scene.setupMission(m, layoutSigns(m));
    playMissionAudio();
  }

  function onHelp() {
    if (!active || busy || !scene) return;
    helped = true;
    $("phHelp").classList.add("is-used");
    scene.highlightTargets();
    playMissionAudio();
  }

  function shutter() {
    if (!active || busy || !scene) return;
    flash();
    const tt = tx();
    const r = scene.evaluateShot(frameSize());
    if (r.status === "empty") return toast(tt.empty);
    if (r.status === "cut") return toast(tt.cut);
    if (r.status === "far") return toast(tt.far);
    // Precies één hele letter, dichtbij genoeg: dit is een echt antwoord.
    const m = missions[missionIdx];
    const isTarget = r.sign.letter === m.target;
    recordAttempt(profileId, {
      game: "photographer", target: m.target, selectedLetter: r.sign.letter, correct: isTarget, helped,
      mission: missionIdx + 1, responseTimeMs: Math.round(performance.now() - missionStart), timestamp: Date.now(),
    });
    busy = true;
    if (isTarget) {
      solved.push({ target: m.target, helped, wrong: wrongThisMission });
      updateDots();
      scene.celebrate(r.sign);
      const finished = missionIdx + 1 >= missions.length;
      const chain = finished ? window.AudioManager.playRandomCorrectFeedback().then(() => letterAudio(r.sign.letter)) : letterAudio(r.sign.letter);
      chain.then(() => { if (!active) return; if (finished) complete(); else { missionIdx++; startMission(); } });
    } else {
      wrongThisMission++;
      scene.wrongShot(r.sign);
      window.AudioManager.playRandomRetryFeedback().then(() => { if (active) busy = false; });
    }
  }
  function flash() {
    const el = $("phFlash"); if (!el) return;
    el.classList.remove("is-on"); void el.offsetWidth; el.classList.add("is-on");
  }

  function complete() {
    const tt = tx();
    const stars = solved.filter((s) => !s.helped).length;
    const ov = $("phOverlay");
    ov.hidden = false;
    ov.innerHTML = `
      <div class="chase-card">
        <h2>${tt.good}</h2>
        <span class="chase-card-letter" lang="ar" dir="rtl">${LETTERS.join(" ")}</span>
        <p class="chase-card-score">${"⭐".repeat(Math.max(1, stars))}</p>
        <button id="phAgain" class="chase-cta chase-cta-primary">${tt.again}</button>
        <button id="phToWorld" class="chase-cta chase-cta-ghost">${tt.back}</button>
      </div>`;
    $("phAgain").onclick = () => { ov.hidden = true; missions = buildMissions(); missionIdx = 0; solved = []; updateDots(); startMission(); };
    $("phToWorld").onclick = () => { location.hash = "#/gamestage/games"; };
  }

  function onKey(e) {
    if (!active) return;
    if (e.key === " " || e.code === "Space" || e.key === "Enter") { e.preventDefault(); shutter(); }
    else if (e.key === "+" || e.key === "=") { scene && scene.stepZoom(1); }
    else if (e.key === "-" || e.key === "_") { scene && scene.stepZoom(-1); }
    else if (e.key.startsWith("Arrow")) { e.preventDefault(); scene && scene.panKey(e.key); }
    else if (e.key === "Escape") { location.hash = "#/gamestage/games"; }
  }

  // ---------- Phaser-scène ----------
  function makeSceneClass(Phaser) {
    const clamp = Phaser.Math.Clamp;
    return class PhotoScene extends Phaser.Scene {
      constructor() { super("PhotoScene"); }

      preload() {
        ["palm_01", "rock_01", "flower_cluster_01"].forEach((id) => this.load.image(id, `assets/game/oasis/${id}.png`));
        this.load.on("loaderror", () => {});
      }

      create() {
        this.signs = [];
        this.zoomIdx = 0; this.drag = null;
        this.buildWorld();
        const cam = this.cameras.main;
        cam.setBounds(0, 0, WORLD.w, WORLD.h);
        this.applyZoom(true);
        cam.centerOn(WORLD.w * 0.3, WORLD.h * 0.5);
        this.input.on("pointerdown", (p) => { this.drag = { x: p.x, y: p.y, moved: false }; });
        this.input.on("pointermove", (p) => {
          if (!this.drag || !p.isDown) return;
          const z = this.cameras.main.zoom;
          this.cameras.main.scrollX -= (p.x - this.drag.x) / z;
          this.cameras.main.scrollY -= (p.y - this.drag.y) / z;
          this.drag.x = p.x; this.drag.y = p.y;
        });
        this.input.on("pointerup", () => { this.drag = null; });
        this.input.on("pointerupoutside", () => { this.drag = null; });
        this.events.emit("photo-ready");
      }

      shutdownScene() { this.tweens.killAll(); }

      buildWorld() {
        if (this.textures.exists("ph-sky")) this.textures.remove("ph-sky");
        const c = this.textures.createCanvas("ph-sky", 4, 256), g = c.getContext();
        const grad = g.createLinearGradient(0, 0, 0, 256);
        grad.addColorStop(0, "#bfe4f5"); grad.addColorStop(0.3, "#e4f3d6"); grad.addColorStop(1, "#ecd89a");
        g.fillStyle = grad; g.fillRect(0, 0, 4, 256); c.refresh();
        this.add.image(0, 0, "ph-sky").setOrigin(0).setDisplaySize(WORLD.w, WORLD.h).setDepth(0);
        // Zandduinen + waterstreep voor sfeer
        this.add.ellipse(WORLD.w * 0.5, WORLD.h * 0.98, WORLD.w * 1.2, WORLD.h * 0.32, 0xe3cb86).setDepth(1);
        this.add.ellipse(WORLD.w * 0.2, WORLD.h * 0.2, 520, 90, 0x7fd3e3, 0.85).setDepth(1);
        this.add.ellipse(WORLD.w * 0.78, WORLD.h * 0.26, 620, 100, 0x7fd3e3, 0.85).setDepth(1);
        const deco = (key, x, y, h) => { if (!this.textures.exists(key)) return; const im = this.add.image(x, y, key).setOrigin(0.5, 1); im.setScale(h / im.height).setDepth(2); };
        [[120, 320, 300], [520, 880, 250], [900, 260, 280], [1250, 900, 260], [1600, 340, 300], [1480, 760, 220]].forEach(([x, y, h]) => deco("palm_01", x, y, h));
        [[300, 600, 110], [760, 640, 100], [1100, 520, 110], [1380, 620, 100], [200, 930, 100], [1000, 960, 100]].forEach(([x, y, h]) => deco("flower_cluster_01", x, y, h));
        [[640, 460, 120], [1330, 300, 130]].forEach(([x, y, h]) => deco("rock_01", x, y, h));
      }

      // Zoom rond het kadermidden; kleinste stap moet de hele wereld bedekken.
      applyZoom(instant) {
        const cam = this.cameras.main;
        const min = Math.max(cam.width / WORLD.w, cam.height / WORLD.h);
        const z = Math.max(ZOOMS[this.zoomIdx], min);
        if (instant) cam.setZoom(z); else this.tweens.add({ targets: cam, zoom: z, duration: 220, ease: "Sine.InOut" });
      }
      stepZoom(d) { this.zoomIdx = clamp(this.zoomIdx + d, 0, ZOOMS.length - 1); this.applyZoom(false); }
      panKey(key) {
        const cam = this.cameras.main, s = 90 / cam.zoom;
        if (key === "ArrowLeft") cam.scrollX -= s;
        if (key === "ArrowRight") cam.scrollX += s;
        if (key === "ArrowUp") cam.scrollY -= s;
        if (key === "ArrowDown") cam.scrollY += s;
      }
      onResize() { this.applyZoom(true); }

      // ----- Missie -----
      setupMission(m, pts) {
        this.signs.forEach((s) => s.c.destroy());
        const SZ = 84;
        this.signs = pts.map((p) => {
          const c = this.add.container(p.x, p.y).setDepth(5);
          const g = this.add.graphics();
          g.fillStyle(0x7a4a24, 1); g.fillRect(-5, SZ / 2 - 4, 10, 56);
          g.fillStyle(0xfff6dc, 1); g.lineStyle(5, 0xc9973a, 1);
          g.fillRoundedRect(-SZ / 2, -SZ / 2, SZ, SZ, 16); g.strokeRoundedRect(-SZ / 2, -SZ / 2, SZ, SZ, 16);
          const glow = this.add.circle(0, 0, SZ * 0.68, 0xffd54a, 0).setStrokeStyle(6, 0xffd54a, 0);
          const t = this.add.text(0, 3, p.letter, { fontFamily: "Amiri, serif", fontStyle: "bold", fontSize: "64px", color: "#3a2410" }).setOrigin(0.5);
          c.add([glow, g, t]);
          return { c, glow, x: p.x, y: p.y, size: SZ, letter: p.letter };
        });
        // Start bij een tegel die niet de doelletter is, zodat zoeken nodig is.
        const start = this.signs.find((s) => s.letter !== m.target) || this.signs[0];
        this.zoomIdx = 0; this.applyZoom(true);
        this.cameras.main.centerOn(start.x + 180, start.y - 40);
      }

      highlightTargets() {
        const target = missions[missionIdx].target;
        this.signs.forEach((s) => {
          if (s.letter !== target) return;
          s.glow.setStrokeStyle(6, 0xffd54a, 1);
          this.tweens.add({ targets: s.glow, scale: { from: 0.9, to: 1.2 }, duration: 520, yoyo: true, repeat: -1, ease: "Sine.InOut" });
        });
      }

      // Beoordeelt wat er in het kader staat (kader = vierkant op het schermmidden).
      evaluateShot(frameScreenSize) {
        const cam = this.cameras.main, z = cam.zoom;
        const cx = cam.scrollX + cam.width / 2, cy = cam.scrollY + cam.height / 2; // zoom draait om het cameramidden
        const half = frameScreenSize / z / 2;
        const whole = [], partial = [];
        this.signs.forEach((s) => {
          const h = s.size / 2;
          const inside = Math.abs(s.x - cx) + h <= half && Math.abs(s.y - cy) + h <= half;
          const touches = Math.abs(s.x - cx) - h < half && Math.abs(s.y - cy) - h < half;
          if (inside) whole.push(s); else if (touches) partial.push(s);
        });
        if (!whole.length && !partial.length) return { status: "empty" };
        if (partial.length || whole.length > 1) return { status: "cut" };
        if (!whole.length) return { status: "empty" };
        if (whole[0].size * z < frameScreenSize * 0.4) return { status: "far", sign: whole[0] };
        return { status: "ok", sign: whole[0] };
      }

      celebrate(s) {
        s.glow.setStrokeStyle(8, 0x58cc02, 1);
        this.tweens.add({ targets: s.c, scale: 1.2, duration: 240, yoyo: true });
        for (let i = 0; i < 10; i++) {
          const st = this.add.star(s.x, s.y, 5, 6, 14, 0xffd54a).setDepth(9);
          const a = (i / 10) * Math.PI * 2;
          this.tweens.add({ targets: st, x: s.x + Math.cos(a) * 110, y: s.y + Math.sin(a) * 110, alpha: 0, angle: 180, duration: 650, onComplete: () => st.destroy() });
        }
      }
      wrongShot(s) {
        this.tweens.add({ targets: s.c, angle: { from: -8, to: 8 }, duration: 90, yoyo: true, repeat: 3, onComplete: () => s.c.setAngle(0) });
      }
    };
  }

  function route() {
    const h = location.hash;
    if (!ROUTE.test(h)) { if (active) teardown(); return; }
    if (active) return;
    setup();
  }
  window.addEventListener("hashchange", route);
  route();
})();
