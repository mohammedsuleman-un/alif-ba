// Letter Chase Prototype (V1.1) — geïsoleerde gameplay-minigame, UX/gameplay polish pass.
// Doel: bewijzen dat een kind een character kan bewegen, een gesproken
// opdracht krijgt en de juiste Arabische letter kan "vangen", en dat dit
// prettig aanvoelt op een touchscherm.
//
// Volledig losstaand van de bestaande quiz-engine (game.js): eigen route-
// prefix (#/gamestage/...), eigen hashchange-listener, eigen opslagsleutel
// (gp_chase_<profielId> — raakt gp_state_<id>.levels NOOIT aan). Hergebruikt
// alleen de bestaande publieke API's van Character en AudioManager, read-only.
//
// Structuur is bewust zo opgezet dat de rendering-laag (DOM/CSS) later
// vervangen kan worden door bv. Phaser zonder de gameplay-data (chaseConfig),
// state machine of audio/progress-architectuur opnieuw te hoeven ontwerpen.
(() => {
  "use strict";

  const DEBUG = false;

  const $ = (id) => document.getElementById(id);
  const store = {
    get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  };
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const rand = (lo, hi) => lo + Math.random() * (hi - lo);
  const shuffle = (arr) => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };

  // ---------- Taal (minimale, eigen set — deelt alleen de taalkeuze zelf) ----------
  const LANG = {
    nl: { find: "Vind", good: "Goed gedaan", again: "Nog een keer", toWorld: "Terug",
      up: "Omhoog", down: "Omlaag", left: "Links", right: "Rechts", back: "Terug",
      listen: "Luister opnieuw", modeDpad: "Knoppen", modeTap: "Tik om te lopen" },
    en: { find: "Find", good: "Well done", again: "Play again", toWorld: "Back",
      up: "Up", down: "Down", left: "Left", right: "Right", back: "Back",
      listen: "Listen again", modeDpad: "Buttons", modeTap: "Tap to walk" },
    ar: { find: "ابحث عن", good: "أحسنت", again: "مرة أخرى", toWorld: "رجوع",
      up: "أعلى", down: "أسفل", left: "يسار", right: "يمين", back: "رجوع",
      listen: "استمع مرة أخرى", modeDpad: "أزرار", modeTap: "اضغط للمشي" },
    tr: { find: "Bul", good: "Aferin", again: "Tekrar oyna", toWorld: "Geri",
      up: "Yukarı", down: "Aşağı", left: "Sol", right: "Sağ", back: "Geri",
      listen: "Tekrar dinle", modeDpad: "Düğmeler", modeTap: "Yürümek için dokun" },
  };
  const lang = () => { const l = store.get("lang", "nl"); return LANG[l] ? l : "nl"; };
  const T = () => LANG[lang()];
  const dir = () => (lang() === "ar" ? "rtl" : "ltr");

  const RETURN_HASH = "#/spel/wereld/letter_oasis";

  // ---------- Gameplay-data, los van rendering (herbruikbaar voor latere letters) ----------
  function makeChaseConfig(target, distractors, requiredCorrect) {
    return { target, distractors, requiredCorrect: requiredCorrect || 3 };
  }
  const chaseConfig = makeChaseConfig("ب", ["ت", "ث"], 3);

  // ---------- State machine ----------
  const PHASE = { INTRO: "INTRO", PLAYING: "PLAYING", FEEDBACK_CORRECT: "FEEDBACK_CORRECT", FEEDBACK_RETRY: "FEEDBACK_RETRY", COMPLETE: "COMPLETE" };

  // ---------- Metrics (eigen, geïsoleerde opslag) ----------
  const chaseKey = (pid) => `gp_chase_${pid}`;
  function loadChaseData(pid) {
    return store.get(chaseKey(pid), { attempts: [], aggregate: { attempts: 0, correct: 0, confusions: {} } });
  }
  function recordAttempt(pid, entry) {
    if (!pid) return;
    const data = loadChaseData(pid);
    data.attempts.push(entry);
    data.aggregate.attempts++;
    if (entry.correct) {
      data.aggregate.correct++;
    } else {
      const key = `${entry.target}->${entry.selectedLetter}`;
      data.aggregate.confusions[key] = (data.aggregate.confusions[key] || 0) + 1;
    }
    store.set(chaseKey(pid), data);
  }

  // ---------- Begrensde gameplay-coördinatenruimte ----------
  // Op desktop mag de scenery (achtergrond) het hele scherm vullen, maar de
  // daadwerkelijke speelafstanden mogen daar NIET van afhangen (anders staan
  // letters "kilometers" uit elkaar op een breed scherm). Alle spawn- en
  // bewegingslogica werkt daarom binnen een vaste, gecentreerde "playBox"
  // die begrensd is op mobile-achtige afmetingen, ongeacht de werkelijke
  // (scenery-)breedte van .chase-field.
  const PLAY_MAX_W = 420;
  const PLAY_MAX_H = 560;

  // ---------- Module state ----------
  let active = false;        // true zolang #/gamestage-route actief is
  let chaseId = "1";
  let profileId = null;
  let charCfg = null;

  let phase = PHASE.INTRO;
  let round = 0;             // 0-based intern, round+1 getoond/gelogd
  let correctCount = 0;
  let roundStartTs = 0;
  let collisionLocked = false;
  let hintGivenThisRound = false;

  let fieldEl = null, charEl = null, lettersLayer = null;
  let fieldRect = { w: 0, h: 0 };
  let playBox = { x0: 0, y0: 0, x1: 0, y1: 0, w: 0, h: 0 };
  let charBox = { w: 100, h: 140 };
  let charX = 0, charY = 0;  // logische positie = voetpunt van character, field-relatief
  const pressed = new Set(); // 'up'|'down'|'left'|'right'
  const SPEED = 260;         // px/sec
  let rafHandle = null;
  let lastTs = 0;

  // Tap-to-move (experimentele tweede inputmethode, A/B-vergelijkbaar via een
  // zichtbare toggle — zie sectie 5 van de opdracht). Metrics worden hier
  // bewust niet apart voor uitgebreid.
  let inputMode = "dpad"; // 'dpad' | 'tap'
  let moveTarget = null;  // {x,y} field-relatief, of null

  let roundLetters = []; // [{letter, isTarget, x, y, el}]

  // ---------- Opzet / teardown ----------
  function activeProfile() {
    const pid = store.get("gp_active", null);
    const list = store.get("gp_profiles", []);
    return list.find((p) => p.id === pid) || null;
  }

  function teardown() {
    active = false;
    pressed.clear();
    moveTarget = null;
    if (rafHandle) { cancelAnimationFrame(rafHandle); rafHandle = null; }
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);
    window.removeEventListener("resize", onResize);
    document.documentElement.classList.remove("gamestage-active");
    const section = $("gamestage");
    if (section) section.hidden = true;
  }

  function setup(id) {
    const prof = activeProfile();
    if (!prof) { location.hash = "#/spel"; return; }
    profileId = prof.id;
    charCfg = window.Character ? window.Character.getConfig(profileId) : null;
    if (!charCfg) { location.hash = "#/spel/personage"; return; }

    chaseId = id || "1";
    const section = $("gamestage");
    if (!section) return;
    section.hidden = false;
    active = true;
    document.documentElement.classList.add("gamestage-active");

    render();
    fieldEl = $("chaseField");
    charEl = $("chaseChar");
    lettersLayer = $("chaseLetters");

    measureField();
    measureChar();
    window.addEventListener("resize", onResize);

    correctCount = 0;
    round = 0;
    phase = PHASE.INTRO;
    placeCharAtStart();
    updateProgressDots();

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    startRound();

    lastTs = performance.now();
    if (!rafHandle) rafHandle = requestAnimationFrame(loop);
  }

  function placeCharAtStart() {
    charX = playBox.x0 + playBox.w / 2;
    charY = playBox.y1 - Math.max(24, charBox.h * 0.15);
  }

  function onResize() {
    if (!active) return;
    measureField();
    measureChar();
    clampCharToBounds();
    applyCharTransform();
    // Letters zijn bij rondestart op pixelposities van de toenmalige playBox
    // gezet; na een resize (bv. schermrotatie) kunnen ze anders buiten de
    // nieuwe playBox komen te staan. Alleen herpositioneren tijdens PLAYING,
    // zodat een feedback-animatie niet wordt onderbroken.
    if (phase === PHASE.PLAYING && roundLetters.length) layoutLetters();
  }

  function measureField() {
    if (!fieldEl) return;
    const r = fieldEl.getBoundingClientRect();
    fieldRect = { w: r.width, h: r.height };
    const w = Math.min(fieldRect.w, PLAY_MAX_W);
    const h = Math.min(fieldRect.h, PLAY_MAX_H);
    const x0 = (fieldRect.w - w) / 2, y0 = (fieldRect.h - h) / 2;
    playBox = { x0, y0, x1: x0 + w, y1: y0 + h, w, h };
  }
  function measureChar() {
    if (!charEl) return;
    const r = charEl.getBoundingClientRect();
    if (r.width && r.height) charBox = { w: r.width, h: r.height };
  }

  // ---------- Rendering (DOM/CSS laag — vervangbaar) ----------
  function render() {
    const t = T();
    const section = $("gamestage");
    document.documentElement.dir = dir();
    section.innerHTML = `
      <div class="chase-screen">
        <header class="chase-head">
          <button id="chaseBack" class="g-icon-btn" aria-label="${t.back}">
            <svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>
          </button>
          <button id="chaseReplay" class="chase-replay" aria-label="${t.listen}">🔊</button>
          <div class="chase-instr">
            <span class="chase-instr-text">${t.find}</span>
            <span class="chase-instr-letter" lang="ar" dir="rtl">${chaseConfig.target}</span>
          </div>
          <div class="chase-dots" id="chaseDots"></div>
        </header>

        <div class="chase-field" id="chaseField">
          <div class="chase-sun"></div>
          <div class="chase-cloud chase-cloud-a"></div>
          <div class="chase-cloud chase-cloud-b"></div>
          <div class="chase-ground"></div>
          <div class="chase-letters" id="chaseLetters"></div>
          <div class="chase-char" id="chaseChar">${window.Character.svg(charCfg, "wave")}</div>
        </div>

        <div class="chase-controls" id="chaseControls">
          <button id="chaseModeToggle" class="chase-mode-toggle" type="button"></button>
          <div class="chase-dpad" id="chaseDpad">
            <button class="chase-btn chase-btn-up" data-dir="up" aria-label="${t.up}">
              <svg viewBox="0 0 24 24"><path d="M12 5l7 7M12 5l-7 7M12 5v14"/></svg>
            </button>
            <div class="chase-btn-row">
              <button class="chase-btn chase-btn-left" data-dir="left" aria-label="${t.left}">
                <svg viewBox="0 0 24 24"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
              </button>
              <button class="chase-btn chase-btn-down" data-dir="down" aria-label="${t.down}">
                <svg viewBox="0 0 24 24"><path d="M12 19l7-7M12 19l-7-7M12 19V5"/></svg>
              </button>
              <button class="chase-btn chase-btn-right" data-dir="right" aria-label="${t.right}">
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
    bindControls();
    bindFieldTap();
    setInputMode(inputMode);
  }

  function setInputMode(mode) {
    inputMode = mode;
    pressed.clear();
    moveTarget = null;
    const t = T();
    const dpad = $("chaseDpad");
    const tapHint = $("chaseTapHint");
    const toggle = $("chaseModeToggle");
    if (!dpad || !tapHint || !toggle) return;
    const isTap = mode === "tap";
    dpad.hidden = isTap;
    tapHint.hidden = !isTap;
    tapHint.textContent = t.modeTap;
    toggle.textContent = isTap ? `🕹️ ${t.modeDpad}` : `👆 ${t.modeTap}`;
  }

  function bindControls() {
    $("chaseDpad").querySelectorAll(".chase-btn").forEach((btn) => {
      const d = btn.dataset.dir;
      const start = (e) => { e.preventDefault(); moveTarget = null; pressed.add(d); try { btn.setPointerCapture(e.pointerId); } catch {} };
      const end = (e) => { if (e) e.preventDefault(); pressed.delete(d); };
      btn.addEventListener("pointerdown", start, { passive: false });
      btn.addEventListener("pointerup", end);
      btn.addEventListener("pointercancel", end);
      btn.addEventListener("pointerleave", end);
    });
  }

  function bindFieldTap() {
    fieldEl = $("chaseField");
    fieldEl.addEventListener("pointerdown", (e) => {
      if (inputMode !== "tap" || phase !== PHASE.PLAYING) return;
      const r = fieldEl.getBoundingClientRect();
      const x = clamp(e.clientX - r.left, playBox.x0, playBox.x1);
      const y = clamp(e.clientY - r.top, playBox.y0, playBox.y1);
      pressed.clear();
      moveTarget = { x, y };
    }, { passive: true });
  }

  function onKeyDown(e) {
    if (!active || phase !== PHASE.PLAYING) return;
    const map = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right", w: "up", s: "down", a: "left", d: "right" };
    const d = map[e.key];
    if (!d) return;
    e.preventDefault();
    moveTarget = null;
    pressed.add(d);
  }
  function onKeyUp(e) {
    const map = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right", w: "up", s: "down", a: "left", d: "right" };
    const d = map[e.key];
    if (d) pressed.delete(d);
  }

  function updateProgressDots() {
    const dots = $("chaseDots");
    if (!dots) return;
    let html = "";
    for (let i = 0; i < chaseConfig.requiredCorrect; i++) html += `<i class="${i < correctCount ? "done" : ""}"></i>`;
    dots.innerHTML = html;
  }

  function setCharMood(mood) {
    if (!charEl || !charCfg) return;
    charEl.innerHTML = window.Character.svg(charCfg, mood);
  }

  let facing = 1; // 1 = normaal, -1 = horizontaal gespiegeld — uitsluitend op basis van daadwerkelijke bewegingsrichting, nooit op basis van RTL
  function applyCharTransform() {
    if (!charEl) return;
    charEl.style.left = `${charX}px`;
    charEl.style.top = `${charY}px`;
    charEl.style.transform = `translate(-50%, -100%) scaleX(${facing})`;
  }

  // ---------- Audio ----------
  // Speel eerst de gesproken opdracht; ontbreekt die, dan is de Promise
  // meteen `false` en volgt alsnog de Arabische leeruitspraak van de
  // doelletter (AudioManager-barge-in-gedrag, niet hier opnieuw uitgevonden
  // — dus ook veilig tegen snel herhaald indrukken van de 🔊-knop).
  function playRoundAudio() {
    window.AudioManager.playInstruction("find-letter").then(() => {
      const base = window.GAME && window.GAME.letterAudio ? window.GAME.letterAudio[chaseConfig.target] : null;
      if (base) window.AudioManager.playLearningAudio(base);
    });
  }

  // ---------- Rondes ----------
  function startRound() {
    round++;
    collisionLocked = false;
    hintGivenThisRound = false;
    phase = PHASE.PLAYING;
    roundStartTs = performance.now();
    setCharMood(round === 1 ? "wave" : "idle");
    layoutLetters();
    playRoundAudio();
  }

  // Letterafmeting conservatief op het grootste breakpoint gehouden (zie
  // chase.css: 104px mobiel, 118px vanaf 640px) — iets te veel tussenruimte
  // op mobiel is onschuldig, te weinig ruimte geeft overlap.
  const LETTER_R = 59;

  function layoutLetters() {
    measureField();
    const letters = shuffle([chaseConfig.target, ...chaseConfig.distractors]);
    const minDist = LETTER_R * 2 + 34;              // letters nooit overlappend + comfortabele lucht
    const marginX = LETTER_R + 8, marginY = LETTER_R + 8;
    // "avoid" gebruikt het VISUELE middelpunt van het character (niet het
    // voetpunt waarop charX/charY zelf gebaseerd zijn), anders lijkt een
    // letter vlak boven het hoofd van het character niet "op" het character
    // te spawnen terwijl het er visueel wel bovenop staat.
    const avoidX = charX, avoidY = charY - charBox.h / 2;
    const avoidR = charBox.h / 2 + LETTER_R + 30;
    const yMax = playBox.y0 + playBox.h * 0.62;     // onderste deel vrij voor de startzone van het character

    const pts = [];
    let tries = 0;
    while (pts.length < letters.length && tries < 500) {
      tries++;
      const x = rand(playBox.x0 + marginX, playBox.x1 - marginX);
      const y = rand(playBox.y0 + marginY, Math.max(playBox.y0 + marginY, yMax));
      if (Math.hypot(x - avoidX, y - avoidY) < avoidR) continue;
      if (pts.some((q) => Math.hypot(x - q.x, y - q.y) < minDist)) continue;
      pts.push({ x, y });
    }
    while (pts.length < letters.length) {
      pts.push({ x: rand(playBox.x0 + marginX, playBox.x1 - marginX), y: rand(playBox.y0 + marginY, Math.max(playBox.y0 + marginY, yMax)) });
    }

    lettersLayer.innerHTML = "";
    roundLetters = letters.map((letter, i) => {
      const { x, y } = pts[i];
      const node = document.createElement("div");
      node.className = "chase-letter";
      node.dataset.letter = letter;
      node.lang = "ar"; node.dir = "rtl";
      node.style.left = `${x}px`; node.style.top = `${y}px`;
      node.textContent = letter;
      lettersLayer.appendChild(node);
      return { letter, isTarget: letter === chaseConfig.target, x, y, el: node };
    });
  }

  // ---------- Loop ----------
  function loop(ts) {
    if (!active) return;
    const dt = Math.min(0.05, (ts - lastTs) / 1000);
    lastTs = ts;
    updateMovement(dt);
    checkCollisions();
    rafHandle = requestAnimationFrame(loop);
  }

  function clampCharToBounds() {
    const halfW = charBox.w / 2;
    const minX = Math.min(playBox.x0 + halfW, playBox.x0 + playBox.w / 2);
    const maxX = Math.max(playBox.x1 - halfW, playBox.x0 + playBox.w / 2);
    charX = clamp(charX, minX, maxX);
    const minY = Math.min(playBox.y0 + charBox.h * 0.4, playBox.y1);
    const maxY = playBox.y1;
    charY = clamp(charY, minY, Math.max(minY, maxY));
  }

  function updateMovement(dt) {
    if (phase !== PHASE.PLAYING) return;
    let dx = 0, dy = 0;
    if (inputMode === "tap" && moveTarget) {
      const rdx = moveTarget.x - charX, rdy = moveTarget.y - charY;
      const dist = Math.hypot(rdx, rdy);
      if (dist < 6) {
        moveTarget = null;
      } else {
        dx = rdx / dist; dy = rdy / dist;
      }
    } else {
      if (pressed.has("left")) dx -= 1;
      if (pressed.has("right")) dx += 1;
      if (pressed.has("up")) dy -= 1;
      if (pressed.has("down")) dy += 1;
      if (dx || dy) { const len = Math.hypot(dx, dy) || 1; dx /= len; dy /= len; }
    }
    if (dx || dy) {
      charX += dx * SPEED * dt;
      charY += dy * SPEED * dt;
      if (dx) facing = dx < 0 ? -1 : 1;
    }
    clampCharToBounds();
    applyCharTransform();
  }

  function checkCollisions() {
    if (phase !== PHASE.PLAYING || collisionLocked) return;
    const charCenterX = charX, charCenterY = charY - charBox.h * 0.35;
    const charRadius = Math.min(charBox.w, charBox.h) * 0.32;
    const letterRadius = 62; // ruim groter dan de zichtbare letter — vergevingsgezind voor jonge kinderen
    for (const item of roundLetters) {
      const d = Math.hypot(charCenterX - item.x, charCenterY - item.y);
      if (d < charRadius + letterRadius) {
        onCollision(item);
        break;
      }
    }
  }

  function onCollision(item) {
    collisionLocked = true;
    pressed.clear();
    moveTarget = null;
    const responseTimeMs = Math.round(performance.now() - roundStartTs);
    recordAttempt(profileId, {
      target: chaseConfig.target, selectedLetter: item.letter, correct: item.isTarget,
      responseTimeMs, round, timestamp: Date.now(),
    });
    if (item.isTarget) onCorrect(item);
    else onWrong(item);
  }

  function onCorrect(item) {
    phase = PHASE.FEEDBACK_CORRECT;
    item.el.classList.add("is-correct");
    setCharMood("happy");
    correctCount++;
    updateProgressDots();

    const finished = correctCount >= chaseConfig.requiredCorrect;
    const base = window.GAME && window.GAME.letterAudio ? window.GAME.letterAudio[item.letter] : null;
    // Kort houden bij elke vangst (alleen de letteruitspraak zelf); de iets
    // langere positieve frase is bewaard voor de laatste vangst, vlak vóór
    // de completion-overlay, zodat het geen "lange viering na elke vangst" wordt.
    const chain = finished
      ? window.AudioManager.playRandomCorrectFeedback().then(() => base ? window.AudioManager.playLearningAudio(base) : true)
      : (base ? window.AudioManager.playLearningAudio(base) : Promise.resolve(true));

    chain.then(() => {
      if (!active) return;
      if (finished) complete();
      else startRound();
    });
  }

  function onWrong(item) {
    phase = PHASE.FEEDBACK_RETRY;
    item.el.classList.add("is-wrong");
    setCharMood("thinking");

    window.AudioManager.playRandomRetryFeedback().then(() => {
      if (!active) return;
      item.el.classList.remove("is-wrong");
      const giveHint = !hintGivenThisRound;
      hintGivenThisRound = true;
      const targetEl = roundLetters.find((l) => l.isTarget);
      const resume = () => {
        if (!active) return;
        collisionLocked = false;
        phase = PHASE.PLAYING;
        layoutLetters();
        setCharMood("encouraging");
      };
      // Bij de EERSTE fout van een ronde: laat de echte doelletter kort subtiel
      // pulsen als hint, voordat de posities opnieuw geschud worden. Niet bij
      // elke fout — anders wordt het een voortdurende hint in plaats van een
      // incidentele aanwijzing.
      if (giveHint && targetEl) {
        targetEl.el.classList.add("is-hint");
        setTimeout(() => { targetEl.el.classList.remove("is-hint"); resume(); }, 420);
      } else {
        resume();
      }
    });
  }

  function complete() {
    phase = PHASE.COMPLETE;
    pressed.clear();
    moveTarget = null;
    setCharMood("celebrate");
    const t = T();
    const overlay = $("chaseOverlay");
    overlay.hidden = false;
    overlay.innerHTML = `
      <div class="chase-card">
        <h2>${t.good}</h2>
        <span class="chase-card-letter" lang="ar" dir="rtl">${chaseConfig.target}</span>
        <p class="chase-card-score">${correctCount} / ${chaseConfig.requiredCorrect}</p>
        <button id="chaseAgain" class="chase-cta chase-cta-primary">${t.again}</button>
        <button id="chaseToWorld" class="chase-cta chase-cta-ghost">${t.toWorld}</button>
      </div>`;
    $("chaseAgain").onclick = () => { overlay.hidden = true; resetPrototype(); };
    $("chaseToWorld").onclick = () => { location.hash = RETURN_HASH; };
  }

  function resetPrototype() {
    correctCount = 0;
    round = 0;
    collisionLocked = false;
    placeCharAtStart();
    applyCharTransform();
    updateProgressDots();
    startRound();
  }

  // ---------- Route ----------
  function chaseRoute() {
    const h = location.hash;
    const m = h.match(/^#\/gamestage\/chase\/(\w+)/);
    if (!h.startsWith("#/gamestage")) { teardown(); return; }
    const id = m ? m[1] : "1";
    if (active && id === chaseId) return; // al actief op dezelfde route
    teardown();
    setup(id);
  }

  window.addEventListener("hashchange", chaseRoute);
  chaseRoute();

  if (DEBUG) window.GameChase = { get phase() { return phase; }, get chaseConfig() { return chaseConfig; }, get playBox() { return playBox; } };
})();
