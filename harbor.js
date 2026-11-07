// Havenloods (wereld 2) — stuur de boot naar de steiger met de klank die je hoort en leg aan met het anker.
// Het kind bepaalt alles zelf: slepen of tikken om te varen, pas op ⚓ telt het als antwoord. Eilandjes zijn obstakels die je
// zacht wegduwen. Een foute steiger duwt de boot terug naar het begin. Geen timers; hulp (💡) alleen op verzoek.
// Route: #/gamestage/harbor/1
(() => {
  "use strict";

  const ROUTE = /^#\/gamestage\/harbor(\/(\w+))?/;
  const $ = (id) => document.getElementById(id);
  const D = window.MiniCore;
  const MG = window.MiniGames;
  const { store, dir, lang, recordAttempt } = D;
  const shuffle = MG.shuffle;

  const TXT = {
    nl: { instr: "Luister en vaar naar de goede steiger", back: "Terug", listen: "Luister opnieuw", help: "Help mij", anchor: "Aanleggen", hint: "Sleep of tik om te varen. Ben je bij de goede steiger? Druk op het anker." },
    en: { instr: "Listen and sail to the right pier", back: "Back", listen: "Listen again", help: "Help me", anchor: "Moor", hint: "Drag or tap to sail. At the right pier? Press the anchor." },
    ar: { instr: "استمع وأبحر إلى الرصيف الصحيح", back: "رجوع", listen: "استمع مرة أخرى", help: "ساعدني", anchor: "ارسُ", hint: "اسحب أو المس للإبحار. وصلت إلى الرصيف الصحيح؟ اضغط على المرساة." },
    tr: { instr: "Dinle ve doğru iskeleye yüz", back: "Geri", listen: "Tekrar dinle", help: "Yardım et", anchor: "Demirle", hint: "Yüzmek için sürükle veya dokun. Doğru iskelede misin? Çapaya bas." },
  };
  const AF = window.ArF || { fem: (s) => s, deep: (t) => t };
  const tx = () => AF.deep(TXT[lang()] || TXT.nl);

  // ---------- Missies: 3 steigers in de eerste, daarna 3 met meer eilandjes ----------
  function buildMissions() {
    const lvl = MG.currentLevel(profileId);
    return MG.missionTargets(lvl).map((target, i) => {
      const d = MG.distractors(lvl, target, 2);
      return { target, piers: shuffle([target, d[0], d[1]]), islands: Math.min(1 + Math.floor(i / 2), 3) };
    });
  }

  let active = false, epoch = 0, profileId = null, raf = 0;
  let missions = [], missionIdx = 0, solved = [], helped = false, wrongThisMission = 0, missionStart = 0, busy = false;
  let W = 0, H = 0, minY = 0, boat = { x: 0, y: 0, tx: 0, ty: 0 }, piers = [], islands = [], keys = {}, near = -1;

  function activeProfile() {
    const pid = store.get("gp_active", null);
    return store.get("gp_profiles", []).find((p) => p.id === pid) || null;
  }
  function teardown() {
    active = false; epoch++; cancelAnimationFrame(raf);
    window.removeEventListener("keydown", onKey); window.removeEventListener("keyup", onKeyUp); window.removeEventListener("resize", layout);
    document.documentElement.classList.remove("gamestage-active");
    const section = $("gamestage");
    if (section && section.dataset.owner === "harbor") { section.hidden = true; section.innerHTML = ""; delete section.dataset.owner; }
  }
  function setup() {
    const prof = activeProfile();
    if (!prof) { location.hash = "#/spel"; return; }
    profileId = prof.id; ++epoch;
    const section = $("gamestage"); if (!section) return;
    section.hidden = false; section.dataset.owner = "harbor"; active = true;
    document.documentElement.classList.add("gamestage-active");
    document.documentElement.dir = dir();
    missions = buildMissions(); missionIdx = 0; solved = [];
    renderChrome();
    window.addEventListener("keydown", onKey); window.addEventListener("keyup", onKeyUp); window.addEventListener("resize", layout);
    startMission();
  }

  const heroHtml = () => {
    let cfg = null; try { cfg = window.Character && Character.getConfig ? Character.getConfig(profileId) : null; } catch { cfg = null; }
    return cfg ? Character.svg(cfg, "happy") : "<span class=\"hb-emoji\">🧒</span>";
  };
  const BOAT = '<img class="hb-boat-img" src="assets/game/harbor/boat.png" alt="" draggable="false">';

  function renderChrome() {
    const tt = tx();
    $("gamestage").innerHTML = `
      <div class="chase-screen">
        <header class="chase-head">
          <button id="hbBack" class="g-icon-btn" aria-label="${tt.back}"><svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg></button>
          <button id="hbReplay" class="chase-replay" aria-label="${tt.listen}">🔊</button>
          <div class="chase-instr"><span class="chase-instr-text">${tt.instr}</span></div>
          <button id="hbHelp" class="chase-replay sling-help" aria-label="${tt.help}">💡</button>
          <div class="chase-dots" id="hbDots"></div>
        </header>
        <div class="chase-field hb-field" id="hbField">
          <div class="hb-sea-fx" aria-hidden="true"></div>
          <div class="hb-piers" id="hbPiers"></div>
          <div class="hb-islands" id="hbIslands"></div>
          <div class="hb-boat" id="hbBoat"><div class="hb-hero">${heroHtml()}</div><div class="hb-hull">${BOAT}</div></div>
          <button id="hbAnchor" class="chase-cta chase-cta-primary hb-anchor" disabled>⚓ ${tt.anchor}</button>
        </div>
        <div class="sling-hint">${tt.hint}</div>
        <div class="chase-overlay" id="hbOverlay" hidden></div>
      </div>`;
    $("hbBack").onclick = () => { location.hash = MG.returnHash(); };
    $("hbReplay").onclick = () => playMissionAudio();
    $("hbHelp").onclick = () => onHelp();
    $("hbAnchor").onclick = () => moor();
    const f = $("hbField");
    const toPoint = (e) => { const r = f.getBoundingClientRect(); boat.tx = Math.max(24, Math.min(W - 24, e.clientX - r.left)); boat.ty = Math.max(minY, Math.min(H - 30, e.clientY - r.top)); };
    f.onpointerdown = (e) => { if (e.target.closest("button")) return; toPoint(e); f.setPointerCapture(e.pointerId); f._down = true; };
    f.onpointermove = (e) => { if (f._down) toPoint(e); };
    f.onpointerup = f.onpointercancel = () => { f._down = false; };
    updateDots();
  }
  function updateDots() {
    const el = $("hbDots"); if (!el) return;
    el.innerHTML = missions.map((_, i) => `<i class="${i < solved.length ? "done" : ""}"></i>`).join("");
  }

  function letterAudio(letter) {
    const base = window.GAME && window.GAME.letterAudio ? window.GAME.letterAudio[letter] : null;
    return base ? window.AudioManager.playLearningAudio(base) : Promise.resolve(true);
  }
  function playMissionAudio() {
    const m = missions[missionIdx], btn = $("hbReplay");
    if (!m) return Promise.resolve();
    if (btn) { btn.disabled = true; btn.classList.add("is-playing"); }
    const done = () => { if (btn) { btn.disabled = false; btn.classList.remove("is-playing"); } };
    return window.AudioManager.playInstruction("find-letter").then((ok) => (ok === false ? false : letterAudio(m.target))).then(done, done);
  }

  // ---------- Verloop ----------
  function startMission() {
    const m = missions[missionIdx];
    helped = false; wrongThisMission = 0; busy = false; missionStart = performance.now(); near = -1;
    $("hbHelp").classList.remove("is-used");
    $("hbPiers").innerHTML = m.piers.map((l, i) => `<div class="hb-pier" data-i="${i}"><img class="hb-pier-img" src="assets/game/harbor/pier.png" alt="" draggable="false"><span class="hb-sign" lang="ar" dir="rtl">${l}</span></div>`).join("");
    $("hbIslands").innerHTML = Array.from({ length: m.islands }, () => `<img class="hb-island" src="assets/game/harbor/island.png" alt="" draggable="false">`).join("");
    layout(true);
    cancelAnimationFrame(raf); const my = epoch; let last = performance.now();
    const tick = (now) => { if (!active || my !== epoch) return; const dt = Math.min(0.05, (now - last) / 1000); last = now; update(dt); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    playMissionAudio();
  }

  function layout(reset) {
    const f = $("hbField"); if (!f) return;
    const r = f.getBoundingClientRect(); if (!r.width) { requestAnimationFrame(() => active && layout(reset)); return; } W = r.width; H = r.height;
    const n = missions[missionIdx] ? missions[missionIdx].piers.length : 3, pw = Math.min(150, W / (n + 0.6));
    piers = [];
    $("hbPiers").querySelectorAll(".hb-pier").forEach((el, i) => {
      const x = W * ((i + 0.5) / n), ph = pw * 1.034, top = H * 0.03; // 1.034 = hoogte/breedte van het steigerplaatje
      el.style.width = pw + "px"; el.style.left = (x - pw / 2) + "px"; el.style.top = top + "px";
      piers.push({ el, x, y: top, ph, dockY: top + ph + 18, letter: missions[missionIdx].piers[i], r: pw * 0.62 });
    });
    islands = [];
    const spots = [[0.28, 0.52], [0.72, 0.58], [0.5, 0.42]];
    $("hbIslands").querySelectorAll(".hb-island").forEach((el, i) => {
      const s = spots[i % spots.length], x = W * s[0], y = H * s[1];
      el.style.width = "118px"; el.style.left = (x - 59) + "px"; el.style.top = (y - 44) + "px"; islands.push({ x, y, r: 44 });
    });
    minY = piers.length ? Math.min(H * 0.6, piers[0].dockY + 8) : H * 0.3;
    if (reset || !boat.x) { boat.x = boat.tx = W / 2; boat.y = boat.ty = H - 56; }
    const a = $("hbAnchor"); if (a) { a.style.left = "50%"; }
  }

  function update(dt) {
    if (busy) return;
    let kx = 0, ky = 0; if (keys.ArrowLeft || keys.a) kx -= 1; if (keys.ArrowRight || keys.d) kx += 1; if (keys.ArrowUp || keys.w) ky -= 1; if (keys.ArrowDown || keys.s) ky += 1;
    if (kx || ky) { boat.tx = Math.max(24, Math.min(W - 24, boat.x + kx * 80)); boat.ty = Math.max(minY, Math.min(H - 30, boat.y + ky * 80)); }
    const dx = boat.tx - boat.x, dy = boat.ty - boat.y, d = Math.hypot(dx, dy);
    if (d > 2) { const sp = Math.min(d, 190 * dt * Math.max(0.35, Math.min(1, d / 50))); boat.x += dx / d * sp; boat.y += dy / d * sp; }
    // eilandjes duwen de boot zacht weg
    islands.forEach((is) => { const ex = boat.x - is.x, ey = boat.y - is.y, ed = Math.hypot(ex, ey), min = is.r + 26; if (ed < min && ed > 0) { boat.x = is.x + ex / ed * min; boat.y = is.y + ey / ed * min; } });
    const b = $("hbBoat"); b.style.transform = `translate(${boat.x - 56}px, ${boat.y - 72}px) rotate(${Math.max(-8, Math.min(8, dx * 0.04))}deg)`;
    b.classList.toggle("is-sailing", d > 4);
    // dichtstbijzijnde steiger: lichtt op en maakt het anker beschikbaar
    let best = -1, bd = 1e9;
    piers.forEach((p, i) => { const dd = Math.hypot(boat.x - p.x, boat.y - p.dockY); if (dd < bd) { bd = dd; best = i; } });
    const nearNow = bd < 78 ? best : -1;
    if (nearNow !== near) { near = nearNow; piers.forEach((p, i) => p.el.classList.toggle("is-near", i === near)); $("hbAnchor").disabled = near < 0; }
  }

  async function moor() {
    if (busy || near < 0 || !active) return;
    busy = true; const my = epoch, p = piers[near], m = missions[missionIdx], field = $("hbField");
    boat.tx = boat.x = p.x; boat.ty = boat.y = p.dockY; $("hbBoat").style.transform = `translate(${boat.x - 56}px, ${boat.y - 72}px)`;
    const ok = p.letter === m.target;
    recordAttempt(profileId, {
      game: "harbor", target: m.target, selectedLetter: p.letter, correct: ok, helped,
      mission: missionIdx + 1, responseTimeMs: Math.round(performance.now() - missionStart), timestamp: Date.now(),
    });
    $("hbAnchor").disabled = true; MG.fx.moor();
    if (ok) {
      solved.push({ helped, wrong: wrongThisMission }); updateDots(); p.el.classList.add("is-ok");
      MG.sfx("ok"); MG.fx.horn(); MG.banner(field, { ok: true, letter: m.target });
      const finished = missionIdx + 1 >= missions.length;
      await MG.wait(450); await window.AudioManager.playRandomCorrectFeedback(); await MG.wait(900);
      MG.hideBanner(field);
      if (!active || my !== epoch) return;
      if (finished) complete(); else { missionIdx++; startMission(); }
    } else {
      wrongThisMission++; p.el.classList.add("is-wrong"); MG.fx.boing();
      MG.sfx("no"); MG.banner(field, { ok: false, letter: p.letter });
      await MG.wait(1100); MG.hideBanner(field); p.el.classList.remove("is-wrong");
      if (!active || my !== epoch) return;
      boat.tx = boat.x = W / 2; boat.ty = boat.y = H - 56; near = -1; // de boot drijft terug naar het begin
      if (wrongThisMission >= 2) onHelp(true);
      busy = false; await window.AudioManager.playRandomRetryFeedback(); playMissionAudio();
    }
  }
  function onHelp(auto) {
    if (!active) return;
    if (!auto) helped = true;
    $("hbHelp").classList.add("is-used");
    piers.forEach((p) => p.el.classList.toggle("is-help", p.letter === missions[missionIdx].target));
    if (!auto) playMissionAudio();
  }
  function complete() {
    MG.finish($("hbOverlay"), {
      pid: profileId, level: MG.currentLevel(profileId), stars: solved.filter((s) => !s.helped).length,
      onAgain: () => { missions = buildMissions(); missionIdx = 0; solved = []; updateDots(); startMission(); },
      onBack: () => { location.hash = MG.returnHash(); },
    });
  }
  function onKey(e) {
    if (!active) return;
    if (e.key === "Escape") { location.hash = MG.returnHash(); return; }
    if (e.key === " " || e.key === "Enter") { e.preventDefault(); moor(); return; }
    keys[e.key] = true;
  }
  function onKeyUp(e) { keys[e.key] = false; }

  function route() {
    const h = location.hash;
    if (!ROUTE.test(h)) { if (active) teardown(); return; }
    if (active) return;
    setup();
  }
  window.addEventListener("hashchange", route);
  route();
})();
