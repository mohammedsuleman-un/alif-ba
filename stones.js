// Stapstenen (wereld 2) — het personage steekt de rivier over: hoor de klank en spring op de steen met de goede letter + klinkerteken.
// Elke opdracht is één rij stenen; een goede steen houdt je vast en de volgende rij komt in beeld, een foute steen wiebelt en je
// springt terug. Landen is het antwoord. Geen timers; hulp (💡) alleen op verzoek. Route: #/gamestage/stones/1
(() => {
  "use strict";

  const ROUTE = /^#\/gamestage\/stones(\/(\w+))?/;
  const $ = (id) => document.getElementById(id);
  const D = window.MiniCore;
  const MG = window.MiniGames;
  const { store, dir, lang, recordAttempt } = D;
  const shuffle = MG.shuffle;

  const TXT = {
    nl: { instr: "Luister en spring op de goede steen", back: "Terug", listen: "Luister opnieuw", help: "Help mij", hint: "Tik op de steen met de klank die je hoort om erheen te springen." },
    en: { instr: "Listen and jump on the right stone", back: "Back", listen: "Listen again", help: "Help me", hint: "Tap the stone with the sound you hear to jump onto it." },
    ar: { instr: "استمع واقفز على الحجر الصحيح", back: "رجوع", listen: "استمع مرة أخرى", help: "ساعدني", hint: "المس الحجر الذي عليه الصوت الذي تسمعه لتقفز إليه." },
    tr: { instr: "Dinle ve doğru taşa zıpla", back: "Geri", listen: "Tekrar dinle", help: "Yardım et", hint: "Duyduğun sesin olduğu taşa dokun ve üstüne zıpla." },
  };
  const AF = window.ArF || { fem: (s) => s, deep: (t) => t };
  const tx = () => AF.deep(TXT[lang()] || TXT.nl);

  function buildMissions() {
    const lvl = MG.currentLevel(profileId);
    return MG.missionTargets(lvl).map((target) => {
      const d = MG.distractors(lvl, target, 2);
      return { target, stones: shuffle([target, d[0], d[1]]) };
    });
  }

  let active = false, epoch = 0, profileId = null;
  let missions = [], missionIdx = 0, solved = [], helped = false, wrongThisMission = 0, missionStart = 0, busy = false;
  let W = 0, H = 0, rows = [], pos = { x: 0, y: 0 };

  function activeProfile() {
    const pid = store.get("gp_active", null);
    return store.get("gp_profiles", []).find((p) => p.id === pid) || null;
  }
  function teardown() {
    active = false; epoch++;
    window.removeEventListener("keydown", onKey); window.removeEventListener("resize", layout);
    document.documentElement.classList.remove("gamestage-active");
    const section = $("gamestage");
    if (section && section.dataset.owner === "stones") { section.hidden = true; section.innerHTML = ""; delete section.dataset.owner; }
  }
  function setup() {
    const prof = activeProfile();
    if (!prof) { location.hash = "#/spel"; return; }
    profileId = prof.id; ++epoch;
    const section = $("gamestage"); if (!section) return;
    section.hidden = false; section.dataset.owner = "stones"; active = true;
    document.documentElement.classList.add("gamestage-active");
    document.documentElement.dir = dir();
    missions = buildMissions(); missionIdx = 0; solved = [];
    renderChrome(); buildRows();
    window.addEventListener("keydown", onKey); window.addEventListener("resize", layout);
    startMission(true);
  }

  const heroHtml = (mood) => {
    let cfg = null; try { cfg = window.Character && Character.getConfig ? Character.getConfig(profileId) : null; } catch { cfg = null; }
    return cfg ? Character.svg(cfg, mood || "idle") : "<span class=\"st-emoji\">🧒</span>";
  };

  function renderChrome() {
    const tt = tx();
    $("gamestage").innerHTML = `
      <div class="chase-screen">
        <header class="chase-head">
          <button id="stBack" class="g-icon-btn" aria-label="${tt.back}"><svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg></button>
          <button id="stReplay" class="chase-replay" aria-label="${tt.listen}">🔊</button>
          <div class="chase-instr"><span class="chase-instr-text">${tt.instr}</span></div>
          <button id="stHelp" class="chase-replay sling-help" aria-label="${tt.help}">💡</button>
          <div class="chase-dots" id="stDots"></div>
        </header>
        <div class="chase-field st-field" id="stField">
          <div class="st-bank st-bank-far" aria-hidden="true"><span>🌳</span><span>🌷</span><span>🌴</span></div>
          <div class="st-river" aria-hidden="true"></div>
          <div class="st-rows" id="stRows"></div>
          <div class="st-bank st-bank-near" aria-hidden="true"><span>🌼</span><span>🪨</span></div>
          <div class="st-hero" id="stHero"></div>
        </div>
        <div class="sling-hint">${tt.hint}</div>
        <div class="chase-overlay" id="stOverlay" hidden></div>
      </div>`;
    $("stBack").onclick = () => { location.hash = MG.returnHash(); };
    $("stReplay").onclick = () => playMissionAudio();
    $("stHelp").onclick = () => onHelp();
    updateDots();
  }
  function updateDots() {
    const el = $("stDots"); if (!el) return;
    el.innerHTML = missions.map((_, i) => `<i class="${i < solved.length ? "done" : ""}"></i>`).join("");
  }
  function buildRows() {
    $("stRows").innerHTML = missions.map((m, r) => `<div class="st-row" data-r="${r}">${m.stones.map((l, i) => `<button type="button" class="st-stone" data-r="${r}" data-i="${i}"><span lang="ar" dir="rtl">${l}</span></button>`).join("")}</div>`).join("");
    $("stRows").querySelectorAll(".st-stone").forEach((b) => { b.onclick = () => jump(+b.dataset.r, +b.dataset.i); });
  }

  function letterAudio(letter) {
    const base = window.GAME && window.GAME.letterAudio ? window.GAME.letterAudio[letter] : null;
    return base ? window.AudioManager.playLearningAudio(base) : Promise.resolve(true);
  }
  function playMissionAudio() {
    const m = missions[missionIdx], btn = $("stReplay");
    if (!m) return Promise.resolve();
    if (btn) { btn.disabled = true; btn.classList.add("is-playing"); }
    const done = () => { if (btn) { btn.disabled = false; btn.classList.remove("is-playing"); } };
    return window.AudioManager.playInstruction("find-letter").then((ok) => (ok === false ? false : letterAudio(m.target))).then(done, done);
  }

  // ---------- Layout: rij 0 ligt vlak bij de oever onderaan, de laatste rij vlak bij de overkant ----------
  function layout() {
    const f = $("stField"); if (!f) return;
    const r = f.getBoundingClientRect(); if (!r.width) return; W = r.width; H = r.height;
    const n = missions.length || 1, top = H * 0.17, bottom = H * 0.82;
    const size = Math.max(64, Math.min(104, W / 3.6, (bottom - top) / (n + 0.6)));
    rows = [];
    $("stRows").querySelectorAll(".st-row").forEach((rowEl, i) => {
      const y = bottom - (i + 0.5) * ((bottom - top) / n);
      const stones = [...rowEl.querySelectorAll(".st-stone")].map((el, k) => {
        const x = W * ((k + 0.5) / 3) + (i % 2 ? 14 : -14); // rijen iets verschoven, dan lijkt het een echte rivier
        el.style.width = size + "px"; el.style.height = size * 0.78 + "px"; el.style.left = (x - size / 2) + "px"; el.style.top = (y - size * 0.39) + "px";
        el.style.fontSize = Math.round(size * 0.46) + "px";
        return { el, x, y };
      });
      rows.push({ el: rowEl, y, stones });
    });
    const hero = $("stHero"); if (hero) { hero.style.width = "56px"; hero.style.height = "78px"; }
    if (!busy) { const s = standPoint(missionIdx - 1); place(s.x, s.y); }
  }
  // Waar staat het personage na opdracht i (−1 = oever onderaan)? Op de gekozen steen van rij i.
  function standPoint(i) {
    if (i < 0) return { x: W / 2, y: H * 0.9 };
    const row = rows[i], idx = missions[i].stones.indexOf(missions[i].target);
    return { x: row.stones[idx].x, y: row.stones[idx].y - 4 };
  }
  function place(x, y) { pos = { x, y }; const h = $("stHero"); if (h) h.style.transform = `translate(${x - 28}px, ${y - 78}px)`; }

  function startMission(first) {
    helped = false; wrongThisMission = 0; busy = false; missionStart = performance.now();
    $("stHelp").classList.remove("is-used");
    if (first) $("stHero").innerHTML = heroHtml("idle");
    if (!rows.length) layout();
    rows.forEach((row, i) => { row.el.classList.toggle("is-current", i === missionIdx); row.el.classList.toggle("is-done", i < missionIdx); row.el.classList.toggle("is-future", i > missionIdx); });
    playMissionAudio();
  }

  // Springen in een boog; geeft een belofte terug als het personage geland is.
  function hop(to, ms = 520) {
    const from = { ...pos }, my = epoch;
    return new Promise((res) => {
      const t0 = performance.now();
      const step = (now) => {
        if (!active || my !== epoch) return res();
        const p = Math.min(1, (now - t0) / ms), e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2, arc = Math.sin(p * Math.PI) * 46;
        place(from.x + (to.x - from.x) * e, from.y + (to.y - from.y) * e - arc);
        pos = { x: from.x + (to.x - from.x) * e, y: from.y + (to.y - from.y) * e };
        p < 1 ? requestAnimationFrame(step) : res();
      };
      requestAnimationFrame(step);
    });
  }

  async function jump(r, i) {
    if (busy || !active || r !== missionIdx) return;
    busy = true; const my = epoch, m = missions[r], row = rows[r], st = row.stones[i], field = $("stField");
    const before = standPoint(r - 1);
    MG.fx.hop();
    await hop({ x: st.x, y: st.y - 4 });
    if (!active || my !== epoch) return;
    const letter = m.stones[i], ok = letter === m.target;
    recordAttempt(profileId, {
      game: "stones", target: m.target, selectedLetter: letter, correct: ok, helped,
      mission: r + 1, responseTimeMs: Math.round(performance.now() - missionStart), timestamp: Date.now(),
    });
    if (ok) {
      st.el.classList.add("is-ok"); MG.fx.landOk();
      solved.push({ helped, wrong: wrongThisMission }); updateDots();
      MG.sfx("ok"); MG.banner(field, { ok: true, letter: m.target });
      const finished = r + 1 >= missions.length;
      await MG.wait(450); await window.AudioManager.playRandomCorrectFeedback(); await MG.wait(700);
      MG.hideBanner(field);
      if (!active || my !== epoch) return;
      if (finished) {
        $("stHero").innerHTML = heroHtml("celebrate");
        await hop({ x: W / 2, y: H * 0.1 + 20 }, 650); await MG.wait(700);
        if (!active || my !== epoch) return;
        complete();
      } else { missionIdx++; startMission(); }
    } else {
      wrongThisMission++; st.el.classList.add("is-wrong"); MG.fx.splashSmall();
      MG.sfx("no"); MG.banner(field, { ok: false, letter });
      await MG.wait(900); MG.hideBanner(field);
      if (!active || my !== epoch) return;
      await hop(before, 480); st.el.classList.remove("is-wrong");
      if (wrongThisMission >= 2) onHelp(true);
      busy = false; await window.AudioManager.playRandomRetryFeedback(); playMissionAudio();
    }
  }
  function onHelp(auto) {
    if (!active) return;
    if (!auto) helped = true;
    $("stHelp").classList.add("is-used");
    const m = missions[missionIdx], row = rows[missionIdx];
    row.stones.forEach((s, i) => s.el.classList.toggle("is-help", m.stones[i] === m.target));
    if (!auto) playMissionAudio();
  }
  function complete() {
    MG.finish($("stOverlay"), {
      pid: profileId, level: MG.currentLevel(profileId), stars: solved.filter((s) => !s.helped).length,
      onAgain: () => { missions = buildMissions(); missionIdx = 0; solved = []; buildRows(); updateDots(); $("stHero").innerHTML = heroHtml("idle"); busy = false; layout(); startMission(); },
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
