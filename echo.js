// Tanwientrio (wereld 4) — het kind hoort een woord uit hoofdstuk 4 en kiest welk tanwien aan het eind staat:
// ـٌ (damma), ـً (fatha) of ـٍ (kasra). Het woord staat er zonder einde; na het goede antwoord staat het er helemaal. Route: #/gamestage/echo/1
(() => {
  "use strict";

  const ROUTE = /^#\/gamestage\/echo(\/(\w+))?/;
  const $ = (id) => document.getElementById(id);
  const D = window.MiniCore;
  const MG = window.MiniGames;
  const { store, dir, lang, recordAttempt } = D;
  const shuffle = MG.shuffle;

  const TXT = {
    nl: { instr: "Welk tanwien hoor je?", back: "Terug", listen: "Luister opnieuw", help: "Help mij", hint: "Luister naar het woord en tik het tanwien dat aan het eind staat." },
    en: { instr: "Which tanween do you hear?", back: "Back", listen: "Listen again", help: "Help me", hint: "Listen to the word and tap the tanween at the end." },
    ar: { instr: "أيّ تنوين تسمع؟", back: "رجوع", listen: "استمع مرة أخرى", help: "ساعدني", hint: "استمع إلى الكلمة والمس التنوين الذي في آخرها." },
    tr: { instr: "Hangi tenvini duyuyorsun?", back: "Geri", listen: "Tekrar dinle", help: "Yardım et", hint: "Kelimeyi dinle ve sondaki tenvine dokun." },
  };
  const AF = window.ArF || { fem: (s) => s, deep: (t) => t };
  const tx = () => AF.deep(TXT[lang()] || TXT.nl);
  const KINDS = ["damma", "fatha", "kasra"];
  const MARK = { damma: "ـٌ", fatha: "ـً", kasra: "ـٍ" };

  // ---------- Missies: 6 woorden, van elk tanwien twee ----------
  function buildMissions() {
    const words = window.GAME.echoTanween;
    return shuffle(KINDS.flatMap((k) => shuffle(words.filter((w) => w.kind === k)).slice(0, 2))).map((w) => ({
      target: w.kind, word: w.word, core: w.core, choices: KINDS.map((kind) => ({ kind, text: MARK[kind] })),
    }));
  }

  let active = false, epoch = 0, profileId = null;
  let missions = [], missionIdx = 0, solved = [], helped = false, wrongThisMission = 0, missionStart = 0, busy = false;

  function activeProfile() {
    const pid = store.get("gp_active", null);
    return store.get("gp_profiles", []).find((p) => p.id === pid) || null;
  }
  function teardown() {
    active = false; epoch++;
    window.removeEventListener("keydown", onKey);
    document.documentElement.classList.remove("gamestage-active");
    const section = $("gamestage");
    if (section && section.dataset.owner === "echo") { section.hidden = true; section.innerHTML = ""; delete section.dataset.owner; }
  }
  function setup() {
    const prof = activeProfile();
    if (!prof) { location.hash = "#/spel"; return; }
    profileId = prof.id; ++epoch;
    const section = $("gamestage"); if (!section) return;
    section.hidden = false; section.dataset.owner = "echo"; active = true;
    document.documentElement.classList.add("gamestage-active");
    document.documentElement.dir = dir();
    missions = buildMissions(); missionIdx = 0; solved = [];
    renderChrome();
    window.addEventListener("keydown", onKey);
    startMission();
  }

  function renderChrome() {
    const tt = tx();
    $("gamestage").innerHTML = `
      <div class="chase-screen">
        <header class="chase-head">
          <button id="ecBack" class="g-icon-btn" aria-label="${tt.back}"><svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg></button>
          <button id="ecReplay" class="chase-replay" aria-label="${tt.listen}">🔊</button>
          <div class="chase-instr"><span class="chase-instr-text">${tt.instr}</span></div>
          <button id="ecHelp" class="chase-replay sling-help" aria-label="${tt.help}">💡</button>
          <div class="chase-dots" id="ecDots"></div>
        </header>
        <div class="chase-field kd-field" id="ecField">
          <button id="ecWord" class="kd-word" type="button" lang="ar" dir="rtl"></button>
          <div class="kd-choices" id="ecChoices"></div>
        </div>
        <div class="sling-hint">${tt.hint}</div>
        <div class="chase-overlay" id="ecOverlay" hidden></div>
      </div>`;
    $("ecBack").onclick = () => { location.hash = MG.returnHash(); };
    $("ecReplay").onclick = () => playMissionAudio();
    $("ecWord").onclick = () => playMissionAudio();
    $("ecHelp").onclick = () => onHelp();
    updateDots();
  }
  function updateDots() {
    const el = $("ecDots"); if (!el) return;
    el.innerHTML = missions.map((_, i) => `<i class="${i < solved.length ? "done" : ""}"></i>`).join("");
  }

  function wordAudio(word) {
    const base = window.GAME && window.GAME.letterAudio ? window.GAME.letterAudio[word] : null;
    return base ? window.AudioManager.playLearningAudio(base) : Promise.resolve(true);
  }
  function playMissionAudio() {
    const m = missions[missionIdx], btn = $("ecReplay");
    if (!m) return Promise.resolve();
    if (btn) { btn.disabled = true; btn.classList.add("is-playing"); }
    const done = () => { if (btn) { btn.disabled = false; btn.classList.remove("is-playing"); } };
    return window.AudioManager.playInstruction("listen").then((ok) => (ok === false ? false : wordAudio(m.word))).then(done, done);
  }

  function startMission() {
    const m = missions[missionIdx];
    helped = false; wrongThisMission = 0; busy = false; missionStart = performance.now();
    $("ecWord").innerHTML = m.core + '<span class="kd-gap" id="ecGap">؟</span>';
    $("ecHelp").classList.remove("is-used");
    $("ecChoices").innerHTML = m.choices.map((c) => `<button class="kd-choice" type="button" data-kind="${c.kind}" lang="ar" dir="rtl">${c.text}</button>`).join("");
    $("ecChoices").querySelectorAll(".kd-choice").forEach((b) => { b.onclick = () => pick(b); });
    playMissionAudio();
  }

  async function pick(btn) {
    if (busy || !active) return;
    busy = true; const my = epoch;
    const field = $("ecField"), m = missions[missionIdx], ok = btn.dataset.kind === m.target;
    recordAttempt(profileId, {
      game: "echo", target: m.word, selectedLetter: btn.dataset.kind, correct: ok, helped,
      mission: missionIdx + 1, responseTimeMs: Math.round(performance.now() - missionStart), timestamp: Date.now(),
    });
    if (ok) {
      btn.classList.add("is-right"); MG.fx.landOk(); $("ecWord").textContent = m.word;
      solved.push({ helped, wrong: wrongThisMission }); updateDots();
      MG.sfx("ok"); MG.banner(field, { ok: true, letter: m.word });
      const finished = missionIdx + 1 >= missions.length;
      await MG.wait(450); await window.AudioManager.playRandomCorrectFeedback(); await MG.wait(900);
      MG.hideBanner(field);
      if (!active || my !== epoch) return;
      if (finished) complete(); else { missionIdx++; startMission(); }
    } else {
      wrongThisMission++; btn.classList.add("is-wrong"); MG.fx.boing();
      MG.sfx("no"); MG.banner(field, { ok: false, letter: m.word });
      await MG.wait(1100); MG.hideBanner(field); btn.classList.remove("is-wrong");
      if (!active || my !== epoch) return;
      if (wrongThisMission >= 2) onHelp(true);
      busy = false; await window.AudioManager.playRandomRetryFeedback(); playMissionAudio();
    }
  }
  function onHelp(auto) {
    if (!active) return;
    if (!auto) helped = true;
    $("ecHelp").classList.add("is-used");
    const m = missions[missionIdx];
    $("ecChoices").querySelectorAll(".kd-choice").forEach((b) => b.classList.toggle("is-help", b.dataset.kind === m.target));
    if (!auto) playMissionAudio();
  }
  function complete() {
    MG.finish($("ecOverlay"), {
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
