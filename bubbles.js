// Feestbellen (wereld 2) — luister naar de klank en schiet de bel met de goede letter + klinkerteken.
// Het kind kiest zelf: tikken op een bel richt het kanon en schiet. Een goede bel hangt als vlaggetje aan het slingertje;
// een foute bel schudt en blijft hangen. Geen timers; hulp (💡) alleen op verzoek. Route: #/gamestage/bubbles/1
(() => {
  "use strict";

  const ROUTE = /^#\/gamestage\/bubbles(\/(\w+))?/;
  const $ = (id) => document.getElementById(id);
  const D = window.MiniCore;
  const MG = window.MiniGames;
  const { store, dir, lang, recordAttempt } = D;
  const shuffle = MG.shuffle;

  const TXT = {
    nl: { instr: "Luister en schiet de goede bel", back: "Terug", listen: "Luister opnieuw", help: "Help mij", hint: "Tik op de bel met de klank die je hoort. Het kanon schiet!" },
    en: { instr: "Listen and shoot the right bubble", back: "Back", listen: "Listen again", help: "Help me", hint: "Tap the bubble with the sound you hear. The cannon fires!" },
    ar: { instr: "استمع وأصب الفقاعة الصحيحة", back: "رجوع", listen: "استمع مرة أخرى", help: "ساعدني", hint: "المس الفقاعة التي عليها الصوت الذي تسمعه. سيطلق المدفع!" },
    tr: { instr: "Dinle ve doğru balona at", back: "Geri", listen: "Tekrar dinle", help: "Yardım et", hint: "Duyduğun sesin olduğu balona dokun. Top ateşlenir!" },
  };
  const AF = window.ArF || { fem: (s) => s, deep: (t) => t };
  const tx = () => AF.deep(TXT[lang()] || TXT.nl);

  // ---------- Missies: 3 bellen in de eerste, daarna 4 en bewegend ----------
  function buildMissions() {
    const lvl = MG.currentLevel(profileId);
    const cfgs = [{ count: 3, speed: 0 }, { count: 4, speed: 0.45 }, { count: 4, speed: 0.7 }];
    return MG.missionTargets(lvl).map((target, i) => {
      const cfg = cfgs[Math.min(i, 2)], d = MG.distractors(lvl, target, 3);
      const letters = shuffle([target, ...d.slice(0, cfg.count - 1)]);
      return { target, letters, speed: cfg.speed };
    });
  }

  let active = false, epoch = 0, profileId = null, raf = 0;
  let missions = [], missionIdx = 0, solved = [], helped = false, wrongThisMission = 0, missionStart = 0, busy = false;
  let bubbles = [], garland = [];

  function activeProfile() {
    const pid = store.get("gp_active", null);
    return store.get("gp_profiles", []).find((p) => p.id === pid) || null;
  }
  function teardown() {
    active = false; epoch++; cancelAnimationFrame(raf);
    window.removeEventListener("keydown", onKey); window.removeEventListener("resize", layout);
    document.documentElement.classList.remove("gamestage-active");
    const section = $("gamestage");
    if (section && section.dataset.owner === "bubbles") { section.hidden = true; section.innerHTML = ""; delete section.dataset.owner; }
  }
  function setup() {
    const prof = activeProfile();
    if (!prof) { location.hash = "#/spel"; return; }
    profileId = prof.id; ++epoch;
    const section = $("gamestage"); if (!section) return;
    section.hidden = false; section.dataset.owner = "bubbles"; active = true;
    document.documentElement.classList.add("gamestage-active");
    document.documentElement.dir = dir();
    missions = buildMissions(); missionIdx = 0; solved = []; garland = [];
    renderChrome();
    window.addEventListener("keydown", onKey); window.addEventListener("resize", layout);
    startMission();
  }

  function renderChrome() {
    const tt = tx();
    $("gamestage").innerHTML = `
      <div class="chase-screen">
        <header class="chase-head">
          <button id="bbBack" class="g-icon-btn" aria-label="${tt.back}"><svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg></button>
          <button id="bbReplay" class="chase-replay" aria-label="${tt.listen}">🔊</button>
          <div class="chase-instr"><span class="chase-instr-text">${tt.instr}</span></div>
          <button id="bbHelp" class="chase-replay sling-help" aria-label="${tt.help}">💡</button>
          <div class="chase-dots" id="bbDots"></div>
        </header>
        <div class="chase-field bb-field" id="bbField">
          <div class="bb-sun" aria-hidden="true">☀️</div>
          <div class="bb-bunting" id="bbBunting" aria-hidden="true"></div>
          <div class="bb-layer" id="bbLayer"></div>
          <div class="bb-cannon" id="bbCannon" aria-hidden="true"><div class="bb-barrel" id="bbBarrel"></div><div class="bb-wheel"></div></div>
        </div>
        <div class="sling-hint">${tt.hint}</div>
        <div class="chase-overlay" id="bbOverlay" hidden></div>
      </div>`;
    $("bbBack").onclick = () => { location.hash = MG.returnHash(); };
    $("bbReplay").onclick = () => playMissionAudio();
    $("bbHelp").onclick = () => onHelp();
    updateDots();
  }
  function updateDots() {
    const el = $("bbDots"); if (!el) return;
    el.innerHTML = missions.map((_, i) => `<i class="${i < solved.length ? "done" : ""}"></i>`).join("");
  }

  function letterAudio(letter) {
    const base = window.GAME && window.GAME.letterAudio ? window.GAME.letterAudio[letter] : null;
    return base ? window.AudioManager.playLearningAudio(base) : Promise.resolve(true);
  }
  function playMissionAudio() {
    const m = missions[missionIdx], btn = $("bbReplay");
    if (!m) return Promise.resolve();
    if (btn) { btn.disabled = true; btn.classList.add("is-playing"); }
    const done = () => { if (btn) { btn.disabled = false; btn.classList.remove("is-playing"); } };
    return window.AudioManager.playInstruction("find-letter").then((ok) => (ok === false ? false : letterAudio(m.target))).then(done, done);
  }

  // ---------- Verloop ----------
  function startMission() {
    const m = missions[missionIdx];
    helped = false; wrongThisMission = 0; busy = false; missionStart = performance.now();
    const layer = $("bbLayer"); layer.innerHTML = "";
    bubbles = m.letters.map((letter, i) => {
      const el = document.createElement("button");
      el.className = "bb-bubble"; el.type = "button"; el.dataset.i = i;
      el.innerHTML = `<span lang="ar" dir="rtl">${letter}</span>`;
      el.onclick = () => fire(i);
      layer.appendChild(el);
      return { el, letter, i, x: 0, y: 0, ph: i * 1.9, isTarget: letter === m.target, gone: false };
    });
    layout(); drawBunting();
    cancelAnimationFrame(raf); const my = epoch; const t0 = performance.now();
    const tick = (now) => { if (!active || my !== epoch) return; frame((now - t0) / 1000); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    playMissionAudio();
  }

  let W = 0, H = 0;
  function layout() {
    const layer = $("bbLayer"); if (!layer) return;
    const r = layer.getBoundingClientRect(); W = r.width; H = r.height;
    const n = bubbles.length || 1;
    const size = Math.max(70, Math.min(124, W / (n + 0.8), H * 0.34));
    bubbles.forEach((b, i) => {
      b.size = size; b.baseX = W * ((i + 0.5) / n); b.baseY = H * (0.3 + 0.2 * ((i * 7) % 3) / 2);
      b.el.style.width = b.el.style.height = size + "px";
      b.el.style.fontSize = Math.round(size * 0.46) + "px";
    });
  }
  function frame(t) {
    const m = missions[missionIdx]; if (!m) return;
    const amp = m.speed ? Math.min(W * 0.1, 46) : 0, ampY = m.speed ? 26 : 8;
    bubbles.forEach((b) => {
      if (b.gone || b.fixed) return;
      b.x = b.baseX + Math.sin(t * (m.speed * 1.4 + 0.5) + b.ph) * amp;
      b.y = b.baseY + Math.cos(t * (m.speed * 1.1 + 0.6) + b.ph) * ampY;
      b.el.style.transform = `translate(${b.x - b.size / 2}px, ${b.y - b.size / 2}px)`;
    });
  }
  function drawBunting() {
    const el = $("bbBunting"); if (!el) return;
    const slots = Math.max(5, missions.length);
    el.innerHTML = `<div class="bb-rope"></div><div class="bb-flags">${Array.from({ length: slots }, (_, i) => `<span class="bb-flag ${garland[i] ? "has" : ""}" lang="ar" dir="rtl">${garland[i] || ""}</span>`).join("")}</div>`;
  }

  async function fire(i) {
    if (busy || !active) return;
    const b = bubbles[i]; if (!b || b.gone) return;
    busy = true; const my = epoch;
    const field = $("bbField"), cannon = $("bbCannon"), barrel = $("bbBarrel");
    const fr = field.getBoundingClientRect(), cr = cannon.getBoundingClientRect(), lr = $("bbLayer").getBoundingClientRect();
    const sx = cr.left - fr.left + cr.width / 2, sy = cr.top - fr.top + 14;
    const tgt = () => ({ x: lr.left - fr.left + b.x, y: lr.top - fr.top + b.y });
    const a0 = tgt(); barrel.style.transform = `rotate(${Math.atan2(a0.x - sx, sy - a0.y) * 180 / Math.PI}deg)`;
    const ball = document.createElement("div"); ball.className = "bb-ball"; field.appendChild(ball);
    const D0 = 430, t0 = performance.now();
    await new Promise((res) => {
      const step = (now) => {
        if (!active || my !== epoch) return res();
        const p = Math.min(1, (now - t0) / D0), e = p * (2 - p), t = tgt();
        ball.style.transform = `translate(${sx + (t.x - sx) * e - 9}px, ${sy + (t.y - sy) * e - 9}px) scale(${1 - 0.25 * e})`;
        p < 1 ? requestAnimationFrame(step) : res();
      };
      requestAnimationFrame(step);
    });
    ball.remove();
    if (!active || my !== epoch) return;
    const m = missions[missionIdx], ok = b.letter === m.target;
    recordAttempt(profileId, {
      game: "bubbles", target: m.target, selectedLetter: b.letter, correct: ok, helped,
      mission: missionIdx + 1, responseTimeMs: Math.round(performance.now() - missionStart), timestamp: Date.now(),
    });
    if (ok) {
      b.gone = true; b.el.classList.add("is-pop"); confetti(b);
      solved.push({ helped, wrong: wrongThisMission }); garland.push(m.target); drawBunting(); updateDots();
      MG.sfx("ok"); MG.banner(field, { ok: true, letter: m.target });
      const finished = missionIdx + 1 >= missions.length;
      await MG.wait(450); await window.AudioManager.playRandomCorrectFeedback(); await MG.wait(900);
      MG.hideBanner(field);
      if (!active || my !== epoch) return;
      if (finished) complete(); else { missionIdx++; startMission(); }
    } else {
      wrongThisMission++; b.el.classList.add("is-wrong");
      MG.sfx("no"); MG.banner(field, { ok: false, letter: b.letter });
      await MG.wait(1100); MG.hideBanner(field); b.el.classList.remove("is-wrong");
      if (!active || my !== epoch) return;
      if (wrongThisMission >= 2) onHelp(true);
      busy = false; await window.AudioManager.playRandomRetryFeedback(); playMissionAudio();
    }
  }
  function confetti(b) {
    const field = $("bbField"), fr = field.getBoundingClientRect(), lr = $("bbLayer").getBoundingClientRect();
    const cx = lr.left - fr.left + b.x, cy = lr.top - fr.top + b.y;
    for (let k = 0; k < 14; k++) {
      const s = document.createElement("span"); s.className = "bb-spark"; s.textContent = ["✨", "⭐", "🎉"][k % 3];
      s.style.left = cx + "px"; s.style.top = cy + "px";
      s.style.setProperty("--dx", Math.round(Math.cos(k / 14 * 6.28) * (50 + Math.random() * 40)) + "px"); s.style.setProperty("--dy", Math.round(Math.sin(k / 14 * 6.28) * (50 + Math.random() * 40)) + "px");
      field.appendChild(s); setTimeout(() => s.remove(), 900);
    }
  }
  function onHelp(auto) {
    if (!active) return;
    if (!auto) helped = true;
    $("bbHelp").classList.add("is-used");
    bubbles.forEach((b) => b.el.classList.toggle("is-help", b.isTarget && !b.gone));
    if (!auto) playMissionAudio();
  }
  function complete() {
    MG.finish($("bbOverlay"), {
      pid: profileId, level: MG.currentLevel(profileId), stars: solved.filter((s) => !s.helped).length,
      onAgain: () => { missions = buildMissions(); missionIdx = 0; solved = []; garland = []; updateDots(); startMission(); },
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
