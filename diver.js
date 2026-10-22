// Letter Pearl Diver — luister, zoek, verzamel. De duiker zwemt naar schelpen met parels
// (elke parel draagt een letter), verzamelt het gevraagde aantal parels met de GEHOORDE
// letter, geeft ze aan de wachter-mossel, krijgt een sleutel en opent de schatkist.
// Route: #/gamestage/diver/1
//
// Regels: alleen het overhandigen aan de mossel telt als antwoord. Zwemmen en oppakken
// is vrij; een parel in de tas kan teruggelegd worden (tik erop). Geen timers; hulp
// (💡) alleen op verzoek.
(() => {
  "use strict";

  const PHASER_SRC = "https://cdnjs.cloudflare.com/ajax/libs/phaser/3.70.0/phaser.min.js";
  const ROUTE = /^#\/gamestage\/diver(\/(\w+))?/;
  const DEBUG = location.hostname === "localhost";

  const $ = (id) => document.getElementById(id);
  const D = window.ChaseData;
  const MG = window.MiniGames;
  const { store, dir, lang, recordAttempt } = D;
  const RETURN_HASH = "#/gamestage/games";
  const shuffle = MG.shuffle;

  const TXT = {
    nl: { find: "Verzamel", back: "Terug", listen: "Luister opnieuw", help: "Help mij", hint: "Zwem naar de schelpen, pak de goede parels en geef ze aan de mossel" },
    en: { find: "Collect", back: "Back", listen: "Listen again", help: "Help me", hint: "Swim to the shells, grab the right pearls and give them to the clam" },
    ar: { find: "اجمع", back: "رجوع", listen: "استمع مرة أخرى", help: "ساعدني", hint: "اسبح إلى الأصداف، خذ اللآلئ الصحيحة وأعطها للمحارة" },
    tr: { find: "Topla", back: "Geri", listen: "Tekrar dinle", help: "Yardım et", hint: "Deniz kabuklarına yüz, doğru incileri al ve istiridyeye ver" },
  };
  const tx = () => TXT[lang()] || TXT.nl;

  let LETTERS = MG.group(0);
  function buildMissions() {
    LETTERS = MG.group(MG.currentLevel(profileId));
    return shuffle(LETTERS).map((target, i) => ({ target, need: [1, 2, 3, 3][Math.min(i, 3)] }));
  }

  // ---------- State ----------
  let active = false, epoch = 0, profileId = null, game = null, scene = null, resizeObs = null;
  let missions = [], missionIdx = 0, solved = [], helped = false, wrongThisMission = 0, missionStart = 0, busy = false;
  let voiceDone = Promise.resolve();

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
    if (scene) { try { scene.shutdownScene(); } catch {} scene = null; }
    if (game) { try { game.destroy(true); } catch {} game = null; }
    if (resizeObs) { resizeObs.disconnect(); resizeObs = null; }
    document.documentElement.classList.remove("gamestage-active");
    const section = $("gamestage");
    if (section && section.dataset.owner === "diver") { section.hidden = true; section.innerHTML = ""; delete section.dataset.owner; }
  }

  async function setup() {
    const prof = activeProfile();
    if (!prof) { location.hash = "#/spel"; return; }
    profileId = prof.id;
    const myEpoch = ++epoch;
    const section = $("gamestage");
    if (!section) return;
    section.hidden = false; section.dataset.owner = "diver";
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
    const mount = $("dvMount");
    if (!mount) return;
    const SceneClass = makeSceneClass(window.Phaser);
    const local = new window.Phaser.Game({
      type: window.Phaser.AUTO, parent: "dvMount", width: mount.clientWidth || 390, height: mount.clientHeight || 500,
      transparent: true, scale: { mode: window.Phaser.Scale.NONE },
    });
    game = local;
    local.events.once("ready", () => {
      if (myEpoch !== epoch) { try { local.destroy(true); } catch {} return; }
      scene = local.scene.add("DiverScene", SceneClass, true, {});
      scene.events.on("diver-handover", onHandover);
      scene.events.on("diver-chest", onChest);
      scene.events.once("diver-ready", () => { if (myEpoch === epoch) startMission(); });
    });
    resizeObs = new ResizeObserver(() => {
      if (myEpoch !== epoch) return;
      const w = mount.clientWidth, h = mount.clientHeight;
      if (w > 0 && h > 0) { local.scale.resize(w, h); if (scene) scene.onResize(); }
    });
    resizeObs.observe(mount);
    if (DEBUG) window.Diver = { get scene() { return scene; }, get missions() { return missions; } };
  }

  // ---------- DOM-chrome ----------
  function renderChrome() {
    const tt = tx();
    $("gamestage").innerHTML = `
      <div class="chase-screen">
        <header class="chase-head">
          <button id="dvBack" class="g-icon-btn" aria-label="${tt.back}"><svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg></button>
          <button id="dvReplay" class="chase-replay" aria-label="${tt.listen}">🔊</button>
          <div class="chase-instr">
            <span class="chase-instr-text">${tt.find}</span>
            <span class="chase-instr-letter" id="dvTarget" lang="ar" dir="rtl">؟</span>
            <span class="dv-need" id="dvNeed"></span>
          </div>
          <button id="dvHelp" class="chase-replay sling-help" aria-label="${tt.help}">💡</button>
          <div class="chase-dots" id="dvDots"></div>
        </header>
        <div class="chase-field" id="dvField"><div id="dvMount" class="chase-phaser-mount"></div></div>
        <div class="sling-hint">${tt.hint}</div>
        <div class="chase-overlay" id="dvOverlay" hidden></div>
      </div>`;
    $("dvBack").onclick = () => { location.hash = RETURN_HASH; };
    $("dvReplay").onclick = () => playMissionAudio();
    $("dvHelp").onclick = () => onHelp();
    updateDots();
  }
  function updateDots() {
    const el = $("dvDots"); if (!el) return;
    el.innerHTML = missions.map((_, i) => `<i class="${i < solved.length ? "done" : ""}"></i>`).join("");
  }

  // ---------- Audio ----------
  function letterAudio(letter) {
    const base = window.GAME && window.GAME.letterAudio ? window.GAME.letterAudio[letter] : null;
    return base ? window.AudioManager.playLearningAudio(base) : Promise.resolve(true);
  }
  function playMissionAudio() {
    const m = missions[missionIdx]; if (!m) return Promise.resolve(false);
    const btn = $("dvReplay");
    if (btn) { btn.disabled = true; btn.classList.add("is-playing"); }
    const done = () => { if (btn) { btn.disabled = false; btn.classList.remove("is-playing"); } };
    return window.AudioManager.playInstruction("find-letter").then(() => letterAudio(m.target)).then(done, done);
  }

  // ---------- Verloop ----------
  function startMission() {
    const m = missions[missionIdx];
    helped = false; wrongThisMission = 0; busy = false; missionStart = performance.now();
    $("dvTarget").textContent = m.target;
    $("dvNeed").textContent = "× " + m.need;
    $("dvHelp").classList.remove("is-used");
    scene.setupMission(m);
    playMissionAudio();
  }

  function onHelp() {
    if (!active || !scene) return;
    helped = true;
    $("dvHelp").classList.add("is-used");
    scene.highlightTargets();
    playMissionAudio();
  }

  function onHandover(bag) {
    if (!active || busy) return;
    busy = true;
    const m = missions[missionIdx], field = $("dvField");
    const wrongLetter = bag.find((l) => l !== m.target);
    const ok = bag.length === m.need && !wrongLetter;
    recordAttempt(profileId, {
      game: "diver", target: m.target, selectedLetter: wrongLetter || m.target, correct: ok, helped, need: m.need, gave: bag.length,
      mission: missionIdx + 1, responseTimeMs: Math.round(performance.now() - missionStart), timestamp: Date.now(),
    });
    if (ok) {
      solved.push({ target: m.target, helped, wrong: wrongThisMission });
      scene.giveKey();
      MG.sfx("ok");
      MG.banner(field, { ok: true, letter: m.target });
      voiceDone = MG.wait(500).then(() => window.AudioManager.playRandomCorrectFeedback()).then(() => letterAudio(m.target)).then(() => MG.wait(700)).then(() => { MG.hideBanner(field); });
    } else {
      wrongThisMission++;
      scene.returnBag();
      MG.sfx("no");
      MG.banner(field, { ok: false, letter: wrongLetter || m.target });
      MG.wait(900).then(() => window.AudioManager.playRandomRetryFeedback()).then(() => MG.wait(400)).then(() => {
        MG.hideBanner(field);
        if (!active) return;
        busy = false;
        playMissionAudio();
      });
    }
  }

  // Sleutel in het slot: schatkist open, volgende missie (na de spraak van het goede antwoord).
  function onChest() {
    if (!active) return;
    const finished = missionIdx + 1 >= missions.length;
    scene.openChest();
    updateDots();
    voiceDone.then(() => MG.wait(900)).then(() => {
      if (!active) return;
      if (finished) complete(); else { missionIdx++; startMission(); }
    });
  }

  function complete() {
    MG.finish($("dvOverlay"), {
      pid: profileId, level: MG.currentLevel(profileId), stars: solved.filter((s) => !s.helped).length,
      onAgain: () => { missions = buildMissions(); missionIdx = 0; solved = []; updateDots(); startMission(); },
      onBack: () => { location.hash = RETURN_HASH; },
    });
  }

  function onKey(e) {
    if (!active) return;
    if (e.key === "Escape") location.hash = RETURN_HASH;
  }

  // ---------- Phaser-scène ----------
  function makeSceneClass(Phaser) {
    const clamp = Phaser.Math.Clamp;
    return class DiverScene extends Phaser.Scene {
      constructor() { super("DiverScene"); }

      create() {
        this.mission = null; this.shells = []; this.bag = []; this.hasKey = false; this.handing = false; this.chestOpen = false;
        this.keys = this.input.keyboard.addKeys({ left: "LEFT", right: "RIGHT", up: "UP", down: "DOWN", a: "A", d: "D", w: "W", s: "S" });
        this.build(true);
        this.input.on("pointerdown", (p) => this.onPointer(p));
        this.input.on("pointermove", (p) => { if (p.isDown) this.onPointer(p, true); });
        setTimeout(() => this.events.emit("diver-ready"), 0); // create() draait synchroon: laat de luisteraars eerst koppelen
      }
      shutdownScene() { this.tweens.killAll(); }

      layout() {
        const W = this.scale.width, H = this.scale.height;
        const r = clamp(Math.min(W, H) * 0.058, 22, 34);
        return { W, H, r, clam: { x: W * 0.13, y: H * 0.8 }, chest: { x: W * 0.87, y: H * 0.8 }, start: { x: W * 0.5, y: H * 0.18 } };
      }

      build(first) {
        const L = (this.L = this.layout()), { W, H, r } = L;
        if (this.textures.exists("dv-sea")) this.textures.remove("dv-sea");
        const c = this.textures.createCanvas("dv-sea", 4, 256), g = c.getContext();
        const gr = g.createLinearGradient(0, 0, 0, 256);
        gr.addColorStop(0, "#8fdcf0"); gr.addColorStop(0.5, "#3fb4d8"); gr.addColorStop(1, "#1f6fa8");
        g.fillStyle = gr; g.fillRect(0, 0, 4, 256); c.refresh();
        this.add.image(0, 0, "dv-sea").setOrigin(0).setDisplaySize(W, H).setDepth(0);
        // Zandbodem, koraal en wier (vormen, geen losse art nodig)
        this.add.ellipse(W / 2, H * 1.02, W * 1.5, H * 0.3, 0xe9d49a).setDepth(1);
        for (let i = 0; i < 9; i++) {
          const x = (i + 0.5) * (W / 9), h = H * (0.08 + ((i * 37) % 7) * 0.012);
          const s = this.add.graphics().setDepth(1);
          s.fillStyle(i % 2 ? 0x2fae6b : 0x1f9a5a, 0.9); s.fillEllipse(x, H * 0.93 - h / 2, 14, h);
          this.tweens.add({ targets: s, angle: { from: -4, to: 4 }, duration: 1600 + i * 130, yoyo: true, repeat: -1, ease: "Sine.InOut" });
        }
        for (let i = 0; i < 12; i++) { // luchtbelletjes
          const b = this.add.circle(Math.random() * W, H * (0.3 + Math.random() * 0.7), 3 + Math.random() * 5, 0xffffff, 0.35).setDepth(1);
          this.tweens.add({ targets: b, y: b.y - H * 0.4, alpha: 0, duration: 4000 + Math.random() * 4000, repeat: -1, delay: Math.random() * 3000 });
        }
        this.buildClam(); this.buildChest(); this.buildDiver(first);
        this.bagG = this.add.container(0, 0).setDepth(20);
        this.drawBag();
        if (this.mission) this.buildShells();
      }

      onResize() {
        this.tweens.killAll(); this.children.removeAll(true);
        const keep = this.mission, bag = this.bag, key = this.hasKey, open = this.chestOpen;
        this.shells = []; this.bag = bag;
        this.build(false);
        this.hasKey = key; this.chestOpen = open;
        if (keep) this.buildShells();
      }

      buildClam() {
        const { clam, r } = this.L, c = this.add.container(clam.x, clam.y).setDepth(4);
        const g = this.add.graphics();
        g.fillStyle(0xb57edc, 1); g.fillEllipse(0, 0, r * 4.2, r * 3.2);
        g.fillStyle(0xd9b5f2, 1); g.fillEllipse(0, -r * 0.2, r * 3.4, r * 2.4);
        g.lineStyle(4, 0x8a56b8, 1); g.strokeEllipse(0, 0, r * 4.2, r * 3.2);
        this.clamLetter = this.add.text(-r * 0.7, -r * 0.35, "", { fontFamily: "Amiri, serif", fontStyle: "bold", fontSize: Math.round(r * 1.7) + "px", color: "#3a2410" }).setOrigin(0.5);
        this.clamNeed = this.add.text(r * 0.95, -r * 0.25, "", { fontFamily: "Nunito, sans-serif", fontStyle: "800", fontSize: Math.round(r * 1.1) + "px", color: "#5b2d8a" }).setOrigin(0.5);
        c.add([g, this.clamLetter, this.clamNeed]);
        if (this.mission) { this.clamLetter.setText(this.mission.target); this.clamNeed.setText("×" + this.mission.need); }
        this.clamObj = c;
      }
      buildChest() {
        const { chest, r } = this.L, c = this.add.container(chest.x, chest.y).setDepth(4);
        const body = this.add.graphics();
        body.fillStyle(0x8a5a2b, 1); body.fillRoundedRect(-r * 1.5, -r * 0.2, r * 3, r * 1.5, 8);
        body.fillStyle(0xf2c14e, 1); body.fillRect(-r * 0.2, -r * 0.2, r * 0.4, r * 1.5);
        this.lid = this.add.graphics();
        this.lid.fillStyle(0xa5702f, 1); this.lid.fillRoundedRect(-r * 1.5, -r * 1.0, r * 3, r * 0.9, 10);
        this.lid.fillStyle(0xf2c14e, 1); this.lid.fillRect(-r * 0.2, -r * 1.0, r * 0.4, r * 0.9);
        this.lid.setPosition(0, 0);
        c.add([body, this.lid]);
        this.chestObj = c;
        if (this.chestOpen) this.lid.setAngle(-35);
      }
      buildDiver(first) {
        const { start, r } = this.L;
        const x = first || !this.diver ? start.x : this.diver.x, y = first || !this.diver ? start.y : this.diver.y;
        const d = this.add.container(x, y).setDepth(10);
        const g = this.add.graphics();
        const s = r * 1.15;
        g.fillStyle(0x6c757d, 1); g.fillRoundedRect(-s * 0.95, -s * 0.5, s * 0.55, s * 1.2, 5); // tank
        g.fillStyle(0xff9f1c, 1); g.fillEllipse(0, s * 0.15, s * 1.5, s * 1.1);                      // lijf
        g.fillStyle(0xf1c27d, 1); g.fillCircle(s * 0.25, -s * 0.45, s * 0.5);                        // hoofd
        g.fillStyle(0x4fc3f7, 0.9); g.fillRoundedRect(s * 0.15, -s * 0.62, s * 0.6, s * 0.38, 6);     // masker
        g.fillStyle(0x2d6a4f, 1); g.fillTriangle(-s * 0.7, s * 0.55, -s * 1.5, s * 0.35, -s * 1.3, s * 0.85); // vin
        this.keyIcon = this.add.text(0, -s * 1.6, "🔑", { fontSize: Math.round(s * 0.9) + "px" }).setOrigin(0.5).setVisible(!!this.hasKey);
        d.add([g, this.keyIcon]);
        this.tweens.add({ targets: g, y: { from: -3, to: 3 }, duration: 900, yoyo: true, repeat: -1, ease: "Sine.InOut" });
        this.diver = d; this.dest = { x, y }; this.facing = 1;
      }

      // ----- Schelpen & parels -----
      buildShells() {
        (this.shells || []).forEach((s) => s.c.destroy());
        const { W, H, r } = this.L, m = this.mission;
        const others = LETTERS.filter((l) => l !== m.target);
        const letters = shuffle([...Array(m.need + 1).fill(m.target), ...Array.from({ length: 4 }, (_, i) => others[i % others.length])]);
        const pts = [], minD = r * 4.6;
        letters.forEach((letter) => {
          let p = null;
          for (let t = 0; t < 400 && !p; t++) {
            const c = { x: W * 0.14 + Math.random() * W * 0.72, y: H * 0.28 + Math.random() * H * 0.42 };
            const farFromClam = Math.hypot(c.x - this.L.clam.x, c.y - this.L.clam.y) > r * 4.5;
            const farFromChest = Math.hypot(c.x - this.L.chest.x, c.y - this.L.chest.y) > r * 4.5;
            if (farFromClam && farFromChest && pts.every((q) => Math.hypot(q.x - c.x, q.y - c.y) >= minD)) p = c;
          }
          if (p) pts.push({ ...p, letter });
        });
        this.shells = pts.map((p) => {
          const c = this.add.container(p.x, p.y).setDepth(3);
          const sh = this.add.graphics();
          sh.fillStyle(0xf7a8b8, 1); sh.fillEllipse(0, 0, r * 3.2, r * 2.5);
          sh.lineStyle(3, 0xd9798f, 1); sh.strokeEllipse(0, 0, r * 3.2, r * 2.5);
          const glow = this.add.circle(0, 0, r * 1.45, 0xffd54a, 0).setStrokeStyle(5, 0xffd54a, 0);
          const pearl = this.add.container(0, 0);
          pearl.add([this.add.circle(0, 0, r * 0.95, 0xfdfdfd).setStrokeStyle(3, 0xc9d3e0),
            this.add.text(0, 2, p.letter, { fontFamily: "Amiri, serif", fontStyle: "bold", fontSize: Math.round(r * 1.35) + "px", color: "#3a2410" }).setOrigin(0.5)]);
          c.add([sh, glow, pearl]);
          return { c, glow, pearl, x: p.x, y: p.y, letter: p.letter, taken: false, armed: true };
        });
        this.shells.forEach((s, i) => { s.c.setScale(0); this.tweens.add({ targets: s.c, scale: 1, duration: 300, delay: i * 60, ease: "Back.Out" }); });
      }

      setupMission(m) {
        this.mission = m; this.hasKey = false; this.chestOpen = false; this.handing = false;
        this.lid.setAngle(0); this.keyIcon.setVisible(false);
        this.bag = []; this.drawBag();
        this.clamLetter.setText(m.target); this.clamNeed.setText("×" + m.need);
        this.diver.setPosition(this.L.start.x, this.L.start.y); this.dest = { x: this.L.start.x, y: this.L.start.y };
        this.buildShells();
      }

      highlightTargets() {
        this.shells.forEach((s) => {
          if (s.taken || s.letter !== this.mission.target) return;
          s.glow.setStrokeStyle(5, 0xffd54a, 1);
          this.tweens.add({ targets: s.glow, scale: { from: 0.9, to: 1.2 }, duration: 520, yoyo: true, repeat: -1, ease: "Sine.InOut" });
        });
      }

      // ----- Tas (toont opgepakte parels; tik = terugleggen) -----
      drawBag() {
        const { r } = this.L;
        this.bagG.removeAll(true);
        const slots = 4, w = r * 2.2 * slots + 16, h = r * 2.3;
        const bg = this.add.graphics();
        bg.fillStyle(0xffffff, 0.75); bg.fillRoundedRect(8, 8, w, h, 14); bg.lineStyle(3, 0x1f6fa8, 1); bg.strokeRoundedRect(8, 8, w, h, 14);
        this.bagG.add(bg);
        this.bag.forEach((b, i) => {
          const x = 8 + r * 1.1 + i * r * 2.2 + 8, y = 8 + h / 2;
          const pc = this.add.container(x, y);
          const hit = this.add.circle(0, 0, r * 1.05, 0xffffff, 0.001).setInteractive({ useHandCursor: true });
          hit.on("pointerdown", (p, lx, ly, ev) => { if (ev) ev.stopPropagation(); this.putBack(i); });
          pc.add([this.add.circle(0, 0, r * 0.85, 0xfdfdfd).setStrokeStyle(3, 0xc9d3e0),
            this.add.text(0, 2, b.letter, { fontFamily: "Amiri, serif", fontStyle: "bold", fontSize: Math.round(r * 1.2) + "px", color: "#3a2410" }).setOrigin(0.5), hit]);
          this.bagG.add(pc);
        });
        this.bagPos = { x: 8 + r * 1.1 + this.bag.length * r * 2.2 + 8, y: 8 + h / 2 };
      }
      putBack(i) {
        if (this.handing) return;
        const b = this.bag.splice(i, 1)[0]; if (!b) return;
        b.shell.taken = false; b.shell.armed = false; b.shell.pearl.setVisible(true);
        this.drawBag();
      }
      returnBag() {
        this.bag.forEach((b) => { b.shell.taken = false; b.shell.armed = false; b.shell.pearl.setVisible(true); });
        this.bag = []; this.drawBag(); this.handing = false;
        this.dest = { x: this.diver.x, y: this.diver.y }; // blijf staan: zwemmen is aan het kind, niets raapt vanzelf op
      }
      giveKey() {
        this.bag = []; this.drawBag(); this.hasKey = true; this.keyIcon.setVisible(true); this.handing = false;
      }
      openChest() {
        this.chestOpen = true; this.hasKey = false; this.keyIcon.setVisible(false);
        this.tweens.add({ targets: this.lid, angle: -35, duration: 400, ease: "Back.Out" });
        const { chest, r } = this.L;
        for (let i = 0; i < 12; i++) {
          const st = this.add.star(chest.x, chest.y - r, 5, 5, 12, 0xffd54a).setDepth(30);
          const a = (i / 12) * Math.PI * 2;
          this.tweens.add({ targets: st, x: chest.x + Math.cos(a) * 100, y: chest.y - r + Math.sin(a) * 100, alpha: 0, angle: 180, duration: 700, onComplete: () => st.destroy() });
        }
      }

      // ----- Invoer -----
      onPointer(p) {
        if (this.handing) return;
        if (p.y < this.L.r * 3.4 && p.x < this.L.r * 2.2 * 4 + 24) return; // tikken op de tas niet als zwem-bestemming
        this.dest = { x: clamp(p.x, 20, this.L.W - 20), y: clamp(p.y, 20, this.L.H - 20) };
      }

      update(_, delta) {
        if (!this.diver) return;
        const s = delta / 1000, k = this.keys, sp = 210;
        let vx = 0, vy = 0;
        if (k.left.isDown || k.a.isDown) vx -= 1; if (k.right.isDown || k.d.isDown) vx += 1;
        if (k.up.isDown || k.w.isDown) vy -= 1; if (k.down.isDown || k.s.isDown) vy += 1;
        if (vx || vy) {
          const l = Math.hypot(vx, vy); this.dest = { x: clamp(this.diver.x + vx / l * 60, 20, this.L.W - 20), y: clamp(this.diver.y + vy / l * 60, 20, this.L.H - 20) };
        }
        const dx = this.dest.x - this.diver.x, dy = this.dest.y - this.diver.y, d = Math.hypot(dx, dy);
        if (d > 3) {
          const step = Math.min(d, sp * s);
          this.diver.x += dx / d * step; this.diver.y += dy / d * step;
          if (Math.abs(dx) > 4) { this.facing = dx < 0 ? -1 : 1; this.diver.setScale(this.facing, 1); }
        }
        const dv = this.diver, r = this.L.r;
        // Parels oppakken
        if (this.mission && !this.handing) {
          this.shells.forEach((sh) => {
            const near = Math.hypot(dv.x - sh.x, dv.y - sh.y) < r * 2.2;
            if (!near) { sh.armed = true; return; }
            if (sh.taken || !sh.armed) return;
            if (this.bag.length >= 4) return;
            sh.taken = true; sh.pearl.setVisible(false);
            this.bag.push({ letter: sh.letter, shell: sh });
            this.drawBag();
          });
          // Overhandigen aan de mossel
          if (this.bag.length && Math.hypot(dv.x - this.L.clam.x, dv.y - this.L.clam.y) < r * 2.6) {
            this.handing = true;
            this.events.emit("diver-handover", this.bag.map((b) => b.letter));
          }
          // Sleutel in de kist
          if (this.hasKey && Math.hypot(dv.x - this.L.chest.x, dv.y - this.L.chest.y) < r * 2.6) {
            this.hasKey = false; this.handing = true;
            this.events.emit("diver-chest");
          }
        }
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
