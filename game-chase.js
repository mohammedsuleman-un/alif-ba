// Letter Chase Prototype (V1) — geïsoleerde gameplay-minigame.
// Doel: bewijzen dat een kind een character kan bewegen, een gesproken
// opdracht krijgt en de juiste Arabische letter kan "vangen".
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
    nl: { find: "Vind", good: "Goed gedaan!", again: "Nog een keer", toWorld: "Terug naar wereld",
      up: "Omhoog", down: "Omlaag", left: "Links", right: "Rechts", back: "Terug" },
    en: { find: "Find", good: "Well done!", again: "Play again", toWorld: "Back to world",
      up: "Up", down: "Down", left: "Left", right: "Right", back: "Back" },
    ar: { find: "ابحث عن", good: "أحسنت!", again: "مرة أخرى", toWorld: "العودة إلى العالم",
      up: "أعلى", down: "أسفل", left: "يسار", right: "يمين", back: "رجوع" },
    tr: { find: "Bul", good: "Aferin!", again: "Tekrar oyna", toWorld: "Dünyaya dön",
      up: "Yukarı", down: "Aşağı", left: "Sol", right: "Sağ", back: "Geri" },
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

  let fieldEl = null, charEl = null, lettersLayer = null;
  let fieldRect = { w: 0, h: 0 };
  let charBox = { w: 100, h: 140 };
  let charX = 0, charY = 0;  // logische positie = voetpunt van character, field-relatief
  const pressed = new Set(); // 'up'|'down'|'left'|'right'
  const SPEED = 230;         // px/sec
  let rafHandle = null;
  let lastTs = 0;

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
    charX = fieldRect.w / 2;
    charY = fieldRect.h - 56;
    applyCharTransform();
    updateProgressDots();

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    startRound();

    lastTs = performance.now();
    if (!rafHandle) rafHandle = requestAnimationFrame(loop);
  }

  function onResize() {
    if (!active) return;
    measureField();
    measureChar();
    charX = clamp(charX, charBox.w / 2, fieldRect.w - charBox.w / 2);
    charY = clamp(charY, charBox.h * 0.5, fieldRect.h - 8);
    applyCharTransform();
    // Letters zijn bij rondestart op pixelposities van het toenmalige
    // speelveld gezet; na een resize (bv. schermrotatie) kunnen ze anders
    // buiten het nieuwe speelveld komen te staan. Alleen herpositioneren
    // tijdens PLAYING, zodat een feedback-animatie niet wordt onderbroken.
    if (phase === PHASE.PLAYING && roundLetters.length) layoutLetters();
  }

  function measureField() {
    if (!fieldEl) return;
    const r = fieldEl.getBoundingClientRect();
    fieldRect = { w: r.width, h: r.height };
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

        <div class="chase-overlay" id="chaseOverlay" hidden></div>
      </div>`;

    $("chaseBack").onclick = () => { location.hash = RETURN_HASH; };
    bindControls();
  }

  function bindControls() {
    $("chaseControls").querySelectorAll(".chase-btn").forEach((btn) => {
      const d = btn.dataset.dir;
      const start = (e) => { e.preventDefault(); pressed.add(d); try { btn.setPointerCapture(e.pointerId); } catch {} };
      const end = (e) => { if (e) e.preventDefault(); pressed.delete(d); };
      btn.addEventListener("pointerdown", start, { passive: false });
      btn.addEventListener("pointerup", end);
      btn.addEventListener("pointercancel", end);
      btn.addEventListener("pointerleave", end);
    });
  }

  function onKeyDown(e) {
    if (!active || phase !== PHASE.PLAYING) return;
    const map = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right", w: "up", s: "down", a: "left", d: "right" };
    const d = map[e.key];
    if (!d) return;
    e.preventDefault();
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

  let facing = 1; // 1 = normaal, -1 = horizontaal gespiegeld (naar links bewegend)
  function applyCharTransform() {
    if (!charEl) return;
    charEl.style.left = `${charX}px`;
    charEl.style.top = `${charY}px`;
    charEl.style.transform = `translate(-50%, -100%) scaleX(${facing})`;
  }

  // ---------- Rondes ----------
  function startRound() {
    round++;
    collisionLocked = false;
    phase = PHASE.PLAYING;
    roundStartTs = performance.now();
    setCharMood(round === 1 ? "wave" : "idle");
    layoutLetters();

    // Audio: speel eerst de gesproken opdracht; ontbreekt die, dan is de
    // Promise meteen `false` en volgt alsnog de Arabische leeruitspraak van
    // de doelletter (AudioManager-gedrag, niet hier opnieuw uitgevonden).
    window.AudioManager.playInstruction("find-letter").then(() => {
      const base = window.GAME && window.GAME.letterAudio ? window.GAME.letterAudio[chaseConfig.target] : null;
      if (base) window.AudioManager.playLearningAudio(base);
    });
  }

  function layoutLetters() {
    measureField();
    const letters = shuffle([chaseConfig.target, ...chaseConfig.distractors]);
    const avoid = { x: charX / fieldRect.w, y: charY / fieldRect.h };
    const pts = [];
    let tries = 0;
    while (pts.length < letters.length && tries < 400) {
      tries++;
      const p = { x: rand(0.14, 0.86), y: rand(0.14, 0.6) };
      if (Math.hypot(p.x - avoid.x, p.y - avoid.y) < 0.26) continue;
      if (pts.some((q) => Math.hypot(p.x - q.x, p.y - q.y) < 0.24)) continue;
      pts.push(p);
    }
    while (pts.length < letters.length) pts.push({ x: rand(0.14, 0.86), y: rand(0.14, 0.6) });

    lettersLayer.innerHTML = "";
    roundLetters = letters.map((letter, i) => {
      const x = pts[i].x * fieldRect.w, y = pts[i].y * fieldRect.h;
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

  function updateMovement(dt) {
    if (phase !== PHASE.PLAYING) return;
    let dx = 0, dy = 0;
    if (pressed.has("left")) dx -= 1;
    if (pressed.has("right")) dx += 1;
    if (pressed.has("up")) dy -= 1;
    if (pressed.has("down")) dy += 1;
    if (dx || dy) {
      const len = Math.hypot(dx, dy) || 1;
      charX += (dx / len) * SPEED * dt;
      charY += (dy / len) * SPEED * dt;
      if (dx) facing = dx < 0 ? -1 : 1;
    }
    const halfW = charBox.w / 2;
    charX = clamp(charX, halfW, Math.max(halfW, fieldRect.w - halfW));
    charY = clamp(charY, charBox.h * 0.45, Math.max(charBox.h * 0.45, fieldRect.h - 6));
    applyCharTransform();
  }

  function checkCollisions() {
    if (phase !== PHASE.PLAYING || collisionLocked) return;
    const charCenterX = charX, charCenterY = charY - charBox.h * 0.35;
    const charRadius = Math.min(charBox.w, charBox.h) * 0.3;
    const letterRadius = 52; // iets groter dan de zichtbare letter — vergevingsgezind voor jonge kinderen
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

    window.AudioManager.playRandomCorrectFeedback().then(() => {
      const base = window.GAME && window.GAME.letterAudio ? window.GAME.letterAudio[item.letter] : null;
      return base ? window.AudioManager.playLearningAudio(base) : Promise.resolve(true);
    }).then(() => {
      if (!active) return;
      if (correctCount >= chaseConfig.requiredCorrect) complete();
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
      collisionLocked = false;
      phase = PHASE.PLAYING;
      layoutLetters();
      setCharMood("encouraging");
    });
  }

  function complete() {
    phase = PHASE.COMPLETE;
    pressed.clear();
    setCharMood("celebrate");
    const t = T();
    const overlay = $("chaseOverlay");
    overlay.hidden = false;
    overlay.innerHTML = `
      <div class="chase-card">
        <div class="chase-card-emoji">🎉</div>
        <h2>${t.good}</h2>
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
    charX = fieldRect.w / 2;
    charY = fieldRect.h - 56;
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

  if (DEBUG) window.GameChase = { get phase() { return phase; }, get chaseConfig() { return chaseConfig; } };
})();
