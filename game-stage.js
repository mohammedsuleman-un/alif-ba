// Letter Chase V2 — GameStage: DOM-chrome, routing, AudioManager-integratie,
// state machine en metrics. Bezit en bestuurt een Phaser.Game-instance met
// ChaseScene erin, maar praat zelf GEEN Phaser-specifieke taal naar buiten.
//
//   Alif Ba App
//      |
//      +-- normale UI (app.js/game.js/shell.js — ONGEWIJZIGD)
//      |
//      +-- GameStage (dit bestand)
//             |
//             +-- Phaser.Game
//                    |
//                    +-- ChaseScene (chase-scene.js)
//
// Phaser-loading (sectie 3/29.2 van de opdracht): GEEN npm/build-systeem.
// Phaser 3.70.0 (gepind) wordt pas geladen zodra GameStage daadwerkelijk
// wordt geopend, via een dynamisch <script>-tagje naar cdnjs — dus geen
// ~1.5MB extra download voor bezoekers die Letter Chase nooit openen.
// chase-scene.js (`class ChaseScene extends Phaser.Scene`) kan pas NA Phaser
// zelf evalueren, en wordt daarom in dezelfde stap, ook dynamisch, ná Phaser
// geladen — vandaar dat chase-scene.js GEEN eigen <script>-tag in index.html
// heeft (chase-data.js, zonder Phaser-afhankelijkheid, wel). Eenmaal geladen
// blijven `window.Phaser`/`window.ChaseScene` gewoon staan (geen dubbele load
// bij opnieuw openen van GameStage — zie ensurePhaserLoaded()).
(() => {
  "use strict";

  const PHASER_SRC = "https://cdnjs.cloudflare.com/ajax/libs/phaser/3.70.0/phaser.min.js";
  const CHASE_SCENE_SRC = "chase-scene.js";
  const DEBUG = false;

  const $ = (id) => document.getElementById(id);
  const D = window.ChaseData;
  const { store, t, dir, RETURN_HASH, chaseConfig, PHASE, WORLD_W, WORLD_H, SPAWN_DIST, worldTier, loadChaseData, recordAttempt } = D;

  const MOODS = ["idle", "wave", "happy", "thinking", "encouraging", "celebrate"];
  const CHAR_BOX = {
    mobile: { w: 92, h: 128 }, tablet: { w: 112, h: 150 }, desktop: { w: 128, h: 168 },
  };

  // ---------- Module state ----------
  let active = false;
  let chaseId = "1";
  let profileId = null;
  let charCfg = null;

  let phase = PHASE.INTRO;
  let round = 0;
  let correctCount = 0;
  let roundStartTs = 0;
  let hintGivenThisRound = false;

  let game = null;        // Phaser.Game
  let scene = null;       // actieve ChaseScene-instance
  let inputMode = "dpad"; // 'dpad' | 'tap'
  const pressed = new Set();
  let tapMarkerTimeout = null;
  let resizeObs = null;

  // Elke setup()-aanroep krijgt een eigen "epoch"-nummer. Phaser's boot en de
  // texture-probing zijn async; zonder dit kan een TRAGE, inmiddels-verlaten
  // setup()-call zijn eigen Phaser.Game nog aanmaken/boot-callback afvuren
  // NADAT een nieuwere setup() allang actief is — en dan via de gedeelde
  // module-variabelen `game`/`scene` de verkeerde instance overschrijven
  // (een race die bij snel wisselen van route dubbele/verweesde Phaser-
  // instances of "Cannot read properties of null" kan geven). Elke async
  // voortzetting hieronder checkt `myEpoch === epoch` vóórdat hij `game`/
  // `scene` aanraakt, en breekt zichzelf anders volledig af.
  let epoch = 0;

  // ---------- Opzet / teardown ----------
  function activeProfile() {
    const pid = store.get("gp_active", null);
    const list = store.get("gp_profiles", []);
    return list.find((p) => p.id === pid) || null;
  }

  function teardown() {
    active = false;
    epoch++; // maakt elke nog lopende (trage) setup()-keten voor de vorige route ongeldig
    pressed.clear();
    clearTimeout(tapMarkerTimeout);
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);
    if (resizeObs) { resizeObs.disconnect(); resizeObs = null; }
    destroyGame();
    document.documentElement.classList.remove("gamestage-active");
    const section = $("gamestage");
    if (section) { section.hidden = true; section.innerHTML = ""; }
  }

  // Zorgt dat teardown() altijd een volledige, schone Phaser-destroy doet —
  // voorkomt dubbele instances/listeners bij opnieuw openen (sectie 4/28.15-16).
  function destroyGame() {
    if (scene) { try { scene.destroyScene(); } catch {} scene = null; }
    if (game) { try { game.destroy(true); } catch {} game = null; }
  }

  async function setup(id) {
    const prof = activeProfile();
    if (!prof) { location.hash = "#/spel"; return; }
    profileId = prof.id;
    charCfg = window.Character ? window.Character.getConfig(profileId) : null;
    if (!charCfg) { location.hash = "#/spel/personage"; return; }

    const myEpoch = ++epoch;
    chaseId = id || "1";
    const section = $("gamestage");
    if (!section) return;
    section.hidden = false;
    active = true;
    document.documentElement.classList.add("gamestage-active");
    document.documentElement.dir = dir();

    renderChrome();

    correctCount = 0;
    round = 0;
    phase = PHASE.INTRO;
    hintGivenThisRound = false;
    updateProgressDots();

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    try {
      await ensurePhaserLoaded();
    } catch (e) {
      if (DEBUG) console.warn("[chase] Phaser kon niet geladen worden", e);
      return;
    }
    if (myEpoch !== epoch) return; // een nieuwere setup() is intussen gestart

    const tier = worldTier(window.innerWidth);
    const textureUrls = await resolveCharacterTextures(charCfg);
    if (myEpoch !== epoch) return;

    createGame(tier, textureUrls, myEpoch);
  }

  // ---------- Phaser lazy-load (gedocumenteerd: zie bestandskop) ----------
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = src;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error(`script-load-failed: ${src}`));
      document.head.appendChild(s);
    });
  }
  // chase-scene.js doet `class ChaseScene extends Phaser.Scene` — dat moet
  // dus NA Phaser zelf geladen worden (vandaar ook geen eigen <script>-tag
  // voor chase-scene.js in index.html, in tegenstelling tot chase-data.js
  // dat geen Phaser-afhankelijkheid heeft en gewoon eager blijft laden).
  function ensurePhaserLoaded() {
    if (window.ChaseScene) return Promise.resolve();
    if (ensurePhaserLoaded._pending) return ensurePhaserLoaded._pending;
    ensurePhaserLoaded._pending = (window.Phaser ? Promise.resolve() : loadScript(PHASER_SRC))
      .then(() => loadScript(CHASE_SCENE_SRC));
    return ensurePhaserLoaded._pending;
  }

  // ---------- Character-textures resolven (read-only hergebruik van Character.svg) ----------
  // Phaser heeft rasterafbeeldingen nodig, geen HTML-string. We hergebruiken
  // Character.svg()'s eigen kandidatenlijst (data-candidates) en proberen die
  // in dezelfde volgorde als de bestaande onerror-cascade, puur om te weten
  // welke URL écht laadt — character.js/character-data.js blijven ongewijzigd.
  function resolveCandidates(cfg, mood) {
    const html = window.Character.svg(cfg, mood);
    const wrap = document.createElement("div");
    wrap.innerHTML = html;
    const span = wrap.querySelector(".char-render");
    if (!span) return { candidates: [], placeholderSvg: html };
    return { candidates: (span.dataset.candidates || "").split("|").filter(Boolean), placeholderSvg: null };
  }
  function probeImage(url) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(url);
      img.onerror = () => resolve(null);
      img.src = url;
    });
  }
  async function resolveOneTexture(cfg, mood) {
    const { candidates, placeholderSvg } = resolveCandidates(cfg, mood);
    for (const url of candidates) {
      const ok = await probeImage(url);
      if (ok) return ok;
    }
    if (placeholderSvg) return "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(placeholderSvg)));
    // Laatste redmiddel: de idle-placeholder van character.js zelf.
    const fallback = window.Character.placeholderSvg(cfg, mood);
    return "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(fallback)));
  }
  async function resolveCharacterTextures(cfg) {
    const urls = {};
    await Promise.all(MOODS.map(async (m) => { urls[m] = await resolveOneTexture(cfg, m); }));
    return urls;
  }

  // ---------- Phaser.Game aanmaken ----------
  function createGame(tier, textureUrls, myEpoch) {
    const mount = $("chasePhaserMount");
    if (!mount) return;
    const w = mount.clientWidth || 390, h = mount.clientHeight || 500;

    // `localGame` is de instance die DEZE createGame()-aanroep specifiek
    // heeft gemaakt — de async 'ready'-callback hieronder sluit over DIE
    // vaste referentie (niet over de gedeelde, muteerbare `game`-variabele),
    // zodat een inmiddels-verlaten/vervangen epoch zijn eigen, mogelijk al
    // destroyede instance nooit kan verwarren met de huidige.
    const localGame = new window.Phaser.Game({
      type: window.Phaser.AUTO,
      parent: "chasePhaserMount",
      width: w, height: h,
      transparent: true,
      physics: { default: "arcade", arcade: { debug: false } },
      scale: { mode: window.Phaser.Scale.NONE },
    });
    game = localGame;

    // Pas NA het Game-'ready'-event is de SceneManager zelf "booted"; pas dan
    // verwerkt scene.add(..., autoStart=true, data) de nieuwe scene meteen
    // synchroon (en geeft een bruikbare instance terug) in plaats van hem in
    // de interne wachtrij te zetten voor een latere tick.
    localGame.events.once("ready", () => {
      if (myEpoch !== epoch) { try { localGame.destroy(true); } catch {} return; } // route alweer verlaten/vervangen terwijl deze Game aan het booten was
      const localScene = localGame.scene.add("ChaseScene", window.ChaseScene, true, {
        worldW: WORLD_W, worldH: WORLD_H,
        tier, spawnDist: SPAWN_DIST[tier],
        chaseConfig, textureUrls, charBoxSize: CHAR_BOX[tier],
        inputMode,
      });
      scene = localScene;
      localScene.events.on("chase-collision", onSceneCollision);
      localScene.events.on("chase-tap-marker", (pos) => showTapMarker(pos.x, pos.y));
      localScene.events.on("chase-tap-marker-hide", hideTapMarker);
      localScene.events.once("chase-ready", () => { if (myEpoch === epoch) onSceneReady(); });
    });

    resizeObs = new ResizeObserver(() => {
      if (myEpoch !== epoch || !mount) return;
      const nw = mount.clientWidth, nh = mount.clientHeight;
      if (nw > 0 && nh > 0) localGame.scale.resize(nw, nh);
    });
    resizeObs.observe(mount);
  }

  function onSceneReady() {
    round = 1;
    startRound();
  }

  // ---------- DOM-chrome (header/field-mount/controls/overlay) — hergebruikt chase.css ----------
  function renderChrome() {
    const tt = t();
    const section = $("gamestage");
    section.innerHTML = `
      <div class="chase-screen">
        <header class="chase-head">
          <button id="chaseBack" class="g-icon-btn" aria-label="${tt.back}">
            <svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>
          </button>
          <button id="chaseReplay" class="chase-replay" aria-label="${tt.listen}">🔊</button>
          <div class="chase-instr">
            <span class="chase-instr-text">${tt.find}</span>
            <span class="chase-instr-letter" lang="ar" dir="rtl">${chaseConfig.target}</span>
          </div>
          <div class="chase-dots" id="chaseDots"></div>
        </header>

        <div class="chase-field" id="chaseField">
          <div id="chasePhaserMount" class="chase-phaser-mount"></div>
          <div class="chase-tap-marker" id="chaseTapMarker"></div>
        </div>

        <div class="chase-controls" id="chaseControls">
          <button id="chaseModeToggle" class="chase-mode-toggle" type="button"></button>
          <div class="chase-dpad" id="chaseDpad">
            <button class="chase-btn chase-btn-up" data-dir="up" aria-label="${tt.up}">
              <svg viewBox="0 0 24 24"><path d="M12 5l7 7M12 5l-7 7M12 5v14"/></svg>
            </button>
            <div class="chase-btn-row">
              <button class="chase-btn chase-btn-left" data-dir="left" aria-label="${tt.left}">
                <svg viewBox="0 0 24 24"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
              </button>
              <button class="chase-btn chase-btn-down" data-dir="down" aria-label="${tt.down}">
                <svg viewBox="0 0 24 24"><path d="M12 19l7-7M12 19l-7-7M12 19V5"/></svg>
              </button>
              <button class="chase-btn chase-btn-right" data-dir="right" aria-label="${tt.right}">
                <svg viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
              </button>
            </div>
          </div>
          <p class="chase-tap-hint" id="chaseTapHint" hidden></p>
        </div>

        <div class="chase-overlay" id="chaseOverlay" hidden></div>
      </div>`;

    $("chaseBack").onclick = () => { location.hash = RETURN_HASH; };
    $("chaseReplay").onclick = () => playRoundAudio();
    $("chaseModeToggle").onclick = () => setInputMode(inputMode === "dpad" ? "tap" : "dpad");
    bindDpad();
    setInputMode(inputMode);
  }

  function setInputMode(mode) {
    inputMode = mode;
    pressed.clear();
    hideTapMarker();
    if (scene) scene.setInputMode(mode);
    const tt = t();
    const dpad = $("chaseDpad"), tapHint = $("chaseTapHint"), toggle = $("chaseModeToggle");
    if (!dpad || !tapHint || !toggle) return;
    const isTap = mode === "tap";
    dpad.hidden = isTap;
    tapHint.hidden = !isTap;
    tapHint.textContent = tt.modeTap;
    toggle.textContent = isTap ? `🕹️ ${tt.modeDpad}` : `👆 ${tt.modeTap}`;
  }

  function bindDpad() {
    $("chaseDpad").querySelectorAll(".chase-btn").forEach((btn) => {
      const d = btn.dataset.dir;
      const start = (e) => { e.preventDefault(); pressed.add(d); applyMoveVector(); try { btn.setPointerCapture(e.pointerId); } catch {} };
      const end = (e) => { if (e) e.preventDefault(); pressed.delete(d); applyMoveVector(); };
      btn.addEventListener("pointerdown", start, { passive: false });
      btn.addEventListener("pointerup", end);
      btn.addEventListener("pointercancel", end);
      btn.addEventListener("pointerleave", end);
    });
  }

  function applyMoveVector() {
    if (!scene) return;
    let x = 0, y = 0;
    if (pressed.has("left")) x -= 1;
    if (pressed.has("right")) x += 1;
    if (pressed.has("up")) y -= 1;
    if (pressed.has("down")) y += 1;
    scene.setMoveVector(x, y);
  }

  function onKeyDown(e) {
    if (!active || phase !== PHASE.PLAYING) return;
    const map = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right", w: "up", s: "down", a: "left", d: "right" };
    const d = map[e.key];
    if (!d) return;
    e.preventDefault();
    pressed.add(d);
    applyMoveVector();
  }
  function onKeyUp(e) {
    const map = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right", w: "up", s: "down", a: "left", d: "right" };
    const d = map[e.key];
    if (d) { pressed.delete(d); applyMoveVector(); }
  }

  function showTapMarker(x, y) {
    const marker = $("chaseTapMarker");
    if (!marker) return;
    clearTimeout(tapMarkerTimeout);
    marker.style.left = `${x}px`; marker.style.top = `${y}px`;
    marker.classList.remove("is-active");
    void marker.offsetWidth;
    marker.classList.add("is-active");
    tapMarkerTimeout = setTimeout(() => marker.classList.remove("is-active"), 650);
  }
  function hideTapMarker() {
    clearTimeout(tapMarkerTimeout);
    const marker = $("chaseTapMarker");
    if (marker) marker.classList.remove("is-active");
  }

  function updateProgressDots() {
    const dots = $("chaseDots");
    if (!dots) return;
    let html = "";
    for (let i = 0; i < chaseConfig.requiredCorrect; i++) html += `<i class="${i < correctCount ? "done" : ""}"></i>`;
    dots.innerHTML = html;
  }

  // ---------- Audio (ongewijzigd t.o.v. V1.2 — AudioManager blijft enige audio-eigenaar) ----------
  function playRoundAudio() {
    const btn = $("chaseReplay");
    if (btn) { btn.disabled = true; btn.classList.add("is-playing"); }
    window.AudioManager.playInstruction("find-letter").then(() => {
      const base = window.GAME && window.GAME.letterAudio ? window.GAME.letterAudio[chaseConfig.target] : null;
      return base ? window.AudioManager.playLearningAudio(base) : Promise.resolve(true);
    }).then(() => {
      if (btn) { btn.disabled = false; btn.classList.remove("is-playing"); }
    });
  }

  // ---------- Rondes / state machine ----------
  function startRound() {
    collisionRoundStartX = null;
    hintGivenThisRound = false;
    phase = PHASE.PLAYING;
    roundStartTs = performance.now();
    if (scene) {
      scene.setCharMood(round === 1 ? "wave" : "idle");
      scene.spawnRound();
      scene.unlockInput();
    }
    playRoundAudio();
  }

  let collisionRoundStartX = null; // (world pos bij ronde-start, voor chaseDistancePx)

  function onSceneCollision({ letter, isTarget, worldX, worldY }) {
    if (phase !== PHASE.PLAYING) return;
    const responseTimeMs = Math.round(performance.now() - roundStartTs);
    const playerPos = scene ? scene.getPlayerWorldPos() : { x: worldX, y: worldY };
    const chaseDistancePx = Math.round(Math.hypot(playerPos.x - worldX, playerPos.y - worldY));
    recordAttempt(profileId, {
      target: chaseConfig.target, selectedLetter: letter, correct: isTarget,
      responseTimeMs, round, timestamp: Date.now(),
      inputMode, movingTarget: chaseConfig.movingTarget, chaseDistancePx,
    });
    if (isTarget) onCorrect(worldX, worldY, letter);
    else onWrong(worldX, worldY);
  }

  function onCorrect(worldX, worldY, letter) {
    phase = PHASE.FEEDBACK_CORRECT;
    if (scene) { scene.setCharMood("happy"); scene.celebrateAt(worldX, worldY); }
    correctCount++;
    updateProgressDots();

    const finished = correctCount >= chaseConfig.requiredCorrect;
    const base = window.GAME && window.GAME.letterAudio ? window.GAME.letterAudio[letter] : null;
    const chain = finished
      ? window.AudioManager.playRandomCorrectFeedback().then(() => base ? window.AudioManager.playLearningAudio(base) : true)
      : (base ? window.AudioManager.playLearningAudio(base) : Promise.resolve(true));

    chain.then(() => {
      if (!active) return;
      if (finished) complete();
      else { round++; startRound(); }
    });
  }

  function onWrong() {
    phase = PHASE.FEEDBACK_RETRY;
    if (scene) scene.setCharMood("thinking");

    window.AudioManager.playRandomRetryFeedback().then(() => {
      if (!active) return;
      hintGivenThisRound = true;
      if (scene) {
        scene.spawnRound();
        scene.unlockInput();
        scene.setCharMood("encouraging");
      }
      phase = PHASE.PLAYING;
      roundStartTs = performance.now();
    });
  }

  function complete() {
    phase = PHASE.COMPLETE;
    if (scene) scene.setCharMood("celebrate");
    const tt = t();
    const overlay = $("chaseOverlay");
    overlay.hidden = false;
    overlay.innerHTML = `
      <div class="chase-card">
        <h2>${tt.good}</h2>
        <span class="chase-card-letter" lang="ar" dir="rtl">${chaseConfig.target}</span>
        <p class="chase-card-score">${correctCount} / ${chaseConfig.requiredCorrect}</p>
        <button id="chaseAgain" class="chase-cta chase-cta-primary">${tt.again}</button>
        <button id="chaseToWorld" class="chase-cta chase-cta-ghost">${tt.toWorld}</button>
      </div>`;
    $("chaseAgain").onclick = () => { overlay.hidden = true; resetPrototype(); };
    $("chaseToWorld").onclick = () => { location.hash = RETURN_HASH; };
  }

  function resetPrototype() {
    correctCount = 0;
    round = 1;
    updateProgressDots();
    startRound();
  }

  // ---------- Route ----------
  function chaseRoute() {
    const h = location.hash;
    const m = h.match(/^#\/gamestage\/chase\/(\w+)/);
    if (!h.startsWith("#/gamestage")) { teardown(); return; }
    const id = m ? m[1] : "1";
    if (active && id === chaseId) return;
    teardown();
    setup(id);
  }

  window.addEventListener("hashchange", chaseRoute);
  chaseRoute();

  if (DEBUG) window.GameStage = { get phase() { return phase; }, get scene() { return scene; }, get game() { return game; }, get inputMode() { return inputMode; } };
})();
