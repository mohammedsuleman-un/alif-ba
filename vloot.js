// Woordenvloot (wereld 3) — luister naar het woord en tik het bootje met het goede woord.
// Een goed bootje vaart juichend weg; een fout bootje schudt en blijft liggen. Geen timers; hulp (💡) alleen op verzoek.
// De woorden komen uit hoofdstuk 3 van het boek (zie game-data.js: GAME.longVowels). Route: #/gamestage/vloot/1
(() => {
  "use strict";

  const ROUTE = /^#\/gamestage\/vloot(\/(\w+))?/;
  const $ = (id) => document.getElementById(id);
  const D = window.MiniCore;
  const MG = window.MiniGames;
  const { store, dir, lang, recordAttempt } = D;
  const shuffle = MG.shuffle;

  const TXT = {
    nl: { instr: "Luister en tik het goede bootje", back: "Terug", listen: "Luister opnieuw", help: "Help mij", hint: "Tik op het bootje met het woord dat je hoort." },
    en: { instr: "Listen and tap the right boat", back: "Back", listen: "Listen again", help: "Help me", hint: "Tap the boat with the word you hear." },
    ar: { instr: "استمع والمس القارب الصحيح", back: "رجوع", listen: "استمع مرة أخرى", help: "ساعدني", hint: "المس القارب الذي عليه الكلمة التي تسمعها." },
    tr: { instr: "Dinle ve doğru tekneye dokun", back: "Geri", listen: "Tekrar dinle", help: "Yardım et", hint: "Duyduğun kelimenin olduğu tekneye dokun." },
  };
  const AF = window.ArF || { fem: (s) => s, deep: (t) => t };
  const tx = () => AF.deep(TXT[lang()] || TXT.nl);

  // ---------- Missies: 5 woorden; 3 bootjes, daarna 4 en bewegend ----------
  function buildMissions() {
    const G = window.GAME, words = MG.wordList(), w3 = G.worlds.find((w) => w.id === (MG.isEcho() ? "echo_mountains" : "river_long"));
    const cfgs = [{ count: 3, speed: 0 }, { count: 4, speed: 0.4 }, { count: 4, speed: 0.4 }, { count: 4, speed: 0.65 }, { count: 4, speed: 0.65 }];
    return shuffle(words).slice(0, 5).map((target, i) => {
      const cfg = cfgs[i], d = w3.distract(target, words);
      return { target, letters: shuffle([target, ...d.slice(0, cfg.count - 1)]), speed: cfg.speed };
    });
  }

  let active = false, epoch = 0, profileId = null, raf = 0;
  let missions = [], missionIdx = 0, solved = [], helped = false, wrongThisMission = 0, missionStart = 0, busy = false;
  let boats = [];

  function activeProfile() {
    const pid = store.get("gp_active", null);
    return store.get("gp_profiles", []).find((p) => p.id === pid) || null;
  }
  function teardown() {
    active = false; epoch++; cancelAnimationFrame(raf);
    window.removeEventListener("keydown", onKey); window.removeEventListener("resize", layout);
    document.documentElement.classList.remove("gamestage-active");
    const section = $("gamestage");
    if (section && section.dataset.owner === "vloot") { section.hidden = true; section.innerHTML = ""; delete section.dataset.owner; }
  }
  function setup() {
    const prof = activeProfile();
    if (!prof) { location.hash = "#/spel"; return; }
    profileId = prof.id; ++epoch;
    const section = $("gamestage"); if (!section) return;
    section.hidden = false; section.dataset.owner = "vloot"; active = true;
    document.documentElement.classList.add("gamestage-active");
    document.documentElement.dir = dir();
    missions = buildMissions(); missionIdx = 0; solved = [];
    renderChrome();
    window.addEventListener("keydown", onKey); window.addEventListener("resize", layout);
    startMission();
  }

  function renderChrome() {
    const tt = tx();
    $("gamestage").innerHTML = `
      <div class="chase-screen">
        <header class="chase-head">
          <button id="vlBack" class="g-icon-btn" aria-label="${tt.back}"><svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg></button>
          <button id="vlReplay" class="chase-replay" aria-label="${tt.listen}">🔊</button>
          <div class="chase-instr"><span class="chase-instr-text">${tt.instr}</span></div>
          <button id="vlHelp" class="chase-replay sling-help" aria-label="${tt.help}">💡</button>
          <div class="chase-dots" id="vlDots"></div>
        </header>
        <div class="chase-field vl-field" id="vlField">
          <div class="vl-sun" aria-hidden="true">🌅</div>
          <div class="vl-waves" aria-hidden="true"></div>
          <div class="bb-layer" id="vlLayer"></div>
        </div>
        <div class="sling-hint">${tt.hint}</div>
        <div class="chase-overlay" id="vlOverlay" hidden></div>
      </div>`;
    $("vlBack").onclick = () => { location.hash = MG.returnHash(); };
    $("vlReplay").onclick = () => playMissionAudio();
    $("vlHelp").onclick = () => onHelp();
    updateDots();
  }
  function updateDots() {
    const el = $("vlDots"); if (!el) return;
    el.innerHTML = missions.map((_, i) => `<i class="${i < solved.length ? "done" : ""}"></i>`).join("");
  }

  function wordAudio(word) {
    const base = window.GAME && window.GAME.letterAudio ? window.GAME.letterAudio[word] : null;
    return base ? window.AudioManager.playLearningAudio(base) : Promise.resolve(true);
  }
  function playMissionAudio() {
    const m = missions[missionIdx], btn = $("vlReplay");
    if (!m) return Promise.resolve();
    if (btn) { btn.disabled = true; btn.classList.add("is-playing"); }
    const done = () => { if (btn) { btn.disabled = false; btn.classList.remove("is-playing"); } };
    return window.AudioManager.playInstruction("listen").then((ok) => (ok === false ? false : wordAudio(m.target))).then(done, done);
  }

  // ---------- Verloop ----------
  function startMission() {
    const m = missions[missionIdx];
    helped = false; wrongThisMission = 0; busy = false; missionStart = performance.now();
    const layer = $("vlLayer"); layer.innerHTML = "";
    boats = m.letters.map((word, i) => {
      const el = document.createElement("button");
      el.className = "vl-boat"; el.type = "button"; el.dataset.i = i;
      el.innerHTML = `<span class="vl-sail" lang="ar" dir="rtl">${word}</span><i class="vl-hull"></i>`;
      el.onclick = () => pick(i);
      layer.appendChild(el);
      return { el, word, i, x: 0, y: 0, ph: i * 1.9, isTarget: word === m.target, gone: false };
    });
    layout();
    cancelAnimationFrame(raf); const my = epoch; const t0 = performance.now();
    const tick = (now) => { if (!active || my !== epoch) return; frame((now - t0) / 1000); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    playMissionAudio();
  }

  let W = 0, H = 0;
  function layout() {
    const layer = $("vlLayer"); if (!layer) return;
    const r = layer.getBoundingClientRect(); if (!r.width) { requestAnimationFrame(() => active && layout()); return; } W = r.width; H = r.height;
    const n = boats.length || 1, rows = Math.ceil(n / 2);
    const bw = Math.max(130, Math.min(210, W / 2.25)), bh = Math.max(84, Math.min(120, H / (rows + 0.5)));
    boats.forEach((b, i) => {
      const row = (i / 2) | 0, inRow = row === rows - 1 && n % 2 ? 1 : 2, col = i % 2;
      b.w = bw; b.h = bh;
      b.baseX = W * (inRow === 1 ? 0.5 : 0.27 + 0.46 * col) + (row % 2 ? 10 : -10);
      b.baseY = H * ((row + 0.6) / (rows + 0.2)) * 0.9;
      b.el.style.width = bw + "px"; b.el.style.height = bh + "px";
      b.el.style.fontSize = Math.round(bh * 0.34) + "px";
    });
  }
  function frame(t) {
    const m = missions[missionIdx]; if (!m) return;
    const amp = m.speed ? Math.min(W * 0.07, 34) : 0, ampY = m.speed ? 9 : 6;
    boats.forEach((b) => {
      if (b.gone) return;
      b.x = b.baseX + Math.sin(t * (m.speed * 1.2 + 0.5) + b.ph) * amp;
      b.y = b.baseY + Math.cos(t * (m.speed * 0.9 + 0.8) + b.ph) * ampY;
      b.el.style.transform = `translate(${b.x - b.w / 2}px, ${b.y}px) rotate(${Math.sin(t * 1.1 + b.ph) * 2.2}deg)`;
    });
  }

  async function pick(i) {
    if (busy || !active) return;
    const b = boats[i]; if (!b || b.gone) return;
    busy = true; const my = epoch;
    const field = $("vlField"), m = missions[missionIdx], ok = b.word === m.target;
    recordAttempt(profileId, {
      game: "vloot", target: m.target, selectedLetter: b.word, correct: ok, helped,
      mission: missionIdx + 1, responseTimeMs: Math.round(performance.now() - missionStart), timestamp: Date.now(),
    });
    if (ok) {
      b.gone = true; b.el.classList.add("is-away"); MG.fx.horn();
      solved.push({ helped, wrong: wrongThisMission }); updateDots();
      MG.sfx("ok"); MG.banner(field, { ok: true, letter: m.target });
      const finished = missionIdx + 1 >= missions.length;
      await MG.wait(450); await window.AudioManager.playRandomCorrectFeedback(); await MG.wait(900);
      MG.hideBanner(field);
      if (!active || my !== epoch) return;
      if (finished) complete(); else { missionIdx++; startMission(); }
    } else {
      wrongThisMission++; b.el.classList.add("is-wrong"); MG.fx.boing();
      MG.sfx("no"); MG.banner(field, { ok: false, letter: b.word });
      await MG.wait(1100); MG.hideBanner(field); b.el.classList.remove("is-wrong");
      if (!active || my !== epoch) return;
      if (wrongThisMission >= 2) onHelp(true);
      busy = false; await window.AudioManager.playRandomRetryFeedback(); playMissionAudio();
    }
  }
  function onHelp(auto) {
    if (!active) return;
    if (!auto) helped = true;
    $("vlHelp").classList.add("is-used");
    boats.forEach((b) => b.el.classList.toggle("is-help", b.isTarget && !b.gone));
    if (!auto) playMissionAudio();
  }
  function complete() {
    MG.finish($("vlOverlay"), {
      pid: profileId, level: 0, plain: true, stars: solved.filter((s) => !s.helped).length,
      onAgain: () => { missions = buildMissions(); missionIdx = 0; solved = []; updateDots(); startMission(); },
      onBack: () => { location.hash = MG.returnHash(); },
    });
  }
  function onKey(e) { if (active && e.key === "Escape") location.hash = MG.returnHash(); }

  function route() {
    const h = location.hash;
    if (!ROUTE.test(h)) { if (active) teardown(); return; }
    if (active) return;
    setup();
  }
  window.addEventListener("hashchange", route);
  route();
})();
