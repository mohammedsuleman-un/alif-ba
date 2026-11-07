// Klankdrie (wereld 3) — het kind hoort een woord uit hoofdstuk 3 en kiest welke lange klinker erin zit:
// alif (ـَا), waw (ـُو) of yaa (ـِي). Geen timers; hulp (💡) alleen op verzoek. Route: #/gamestage/klank/1
(() => {
  "use strict";

  const ROUTE = /^#\/gamestage\/klank(\/(\w+))?/;
  const $ = (id) => document.getElementById(id);
  const D = window.MiniCore;
  const MG = window.MiniGames;
  const { store, dir, lang, recordAttempt } = D;
  const shuffle = MG.shuffle;

  const TXT = {
    nl: { instr: "Welke lange klinker hoor je?", back: "Terug", listen: "Luister opnieuw", help: "Help mij", hint: "Luister naar het woord en tik de lange klinker die erin zit." },
    en: { instr: "Which long vowel do you hear?", back: "Back", listen: "Listen again", help: "Help me", hint: "Listen to the word and tap the long vowel in it." },
    ar: { instr: "أيّ مدٍّ تسمع؟", back: "رجوع", listen: "استمع مرة أخرى", help: "ساعدني", hint: "استمع إلى الكلمة والمس حرف المدّ الذي فيها." },
    tr: { instr: "Hangi med harfini duyuyorsun?", back: "Geri", listen: "Tekrar dinle", help: "Yardım et", hint: "Kelimeyi dinle ve içindeki med harfine dokun." },
  };
  const AF = window.ArF || { fem: (s) => s, deep: (t) => t };
  const tx = () => AF.deep(TXT[lang()] || TXT.nl);
  const KINDS = ["alif", "waw", "yaa"];
  // de lange klinker zoals hij in het woord staat: letter + teken + alif/waw/yaa
  const MADD = { alif: /(.)َا/, waw: /(.)ُو/, yaa: /(.)ِي/ };
  const TAIL = { alif: "َا", waw: "ُو", yaa: "ِي" };
  const isOne = (w) => KINDS.filter((k) => MADD[k].test(w.word)).length === 1; // woorden met twee soorten lange klinkers slaan we over
  const choicesFor = (letter) => KINDS.map((kind) => ({ kind, text: (kind === "yaa" && letter === "أ" ? "إ" : letter) + TAIL[kind] }));

  // ---------- Missies: 6 woorden, van elke klinker twee; de keuzes zijn de letter uit het woord met de drie klinkers (kaa/kuu/kii) ----------
  function buildMissions() {
    const words = window.GAME.longVowels.words.filter(isOne);
    return shuffle(KINDS.flatMap((k) => shuffle(words.filter((w) => w.kind === k && MADD[k].test(w.word))).slice(0, 2))).map((w) => {
      const letter = w.word.match(MADD[w.kind])[1];
      return { target: w.kind, word: w.word, choices: choicesFor(letter) };
    });
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
    if (section && section.dataset.owner === "klank") { section.hidden = true; section.innerHTML = ""; delete section.dataset.owner; }
  }
  function setup() {
    const prof = activeProfile();
    if (!prof) { location.hash = "#/spel"; return; }
    profileId = prof.id; ++epoch;
    const section = $("gamestage"); if (!section) return;
    section.hidden = false; section.dataset.owner = "klank"; active = true;
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
          <button id="kdBack" class="g-icon-btn" aria-label="${tt.back}"><svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg></button>
          <button id="kdReplay" class="chase-replay" aria-label="${tt.listen}">🔊</button>
          <div class="chase-instr"><span class="chase-instr-text">${tt.instr}</span></div>
          <button id="kdHelp" class="chase-replay sling-help" aria-label="${tt.help}">💡</button>
          <div class="chase-dots" id="kdDots"></div>
        </header>
        <div class="chase-field kd-field" id="kdField">
          <button id="kdWord" class="kd-word" type="button" lang="ar" dir="rtl"></button>
          <div class="kd-choices" id="kdChoices"></div>
        </div>
        <div class="sling-hint">${tt.hint}</div>
        <div class="chase-overlay" id="kdOverlay" hidden></div>
      </div>`;
    $("kdBack").onclick = () => { location.hash = MG.returnHash(); };
    $("kdReplay").onclick = () => playMissionAudio();
    $("kdWord").onclick = () => playMissionAudio();
    $("kdHelp").onclick = () => onHelp();
    updateDots();
  }
  function updateDots() {
    const el = $("kdDots"); if (!el) return;
    el.innerHTML = missions.map((_, i) => `<i class="${i < solved.length ? "done" : ""}"></i>`).join("");
  }

  function wordAudio(word) {
    const base = window.GAME && window.GAME.letterAudio ? window.GAME.letterAudio[word] : null;
    return base ? window.AudioManager.playLearningAudio(base) : Promise.resolve(true);
  }
  function playMissionAudio() {
    const m = missions[missionIdx], btn = $("kdReplay");
    if (!m) return Promise.resolve();
    if (btn) { btn.disabled = true; btn.classList.add("is-playing"); }
    const done = () => { if (btn) { btn.disabled = false; btn.classList.remove("is-playing"); } };
    return window.AudioManager.playInstruction("listen").then((ok) => (ok === false ? false : wordAudio(m.word))).then(done, done);
  }

  function startMission() {
    const m = missions[missionIdx];
    helped = false; wrongThisMission = 0; busy = false; missionStart = performance.now();
    $("kdWord").textContent = m.word;
    $("kdHelp").classList.remove("is-used");
    $("kdChoices").innerHTML = m.choices.map((c) => `<button class="kd-choice" type="button" data-kind="${c.kind}" lang="ar" dir="rtl">${c.text}</button>`).join("");
    $("kdChoices").querySelectorAll(".kd-choice").forEach((b) => { b.onclick = () => pick(b); });
    playMissionAudio();
  }

  async function pick(btn) {
    if (busy || !active) return;
    busy = true; const my = epoch;
    const field = $("kdField"), m = missions[missionIdx], ok = btn.dataset.kind === m.target;
    recordAttempt(profileId, {
      game: "klank", target: m.word, selectedLetter: btn.dataset.kind, correct: ok, helped,
      mission: missionIdx + 1, responseTimeMs: Math.round(performance.now() - missionStart), timestamp: Date.now(),
    });
    if (ok) {
      btn.classList.add("is-right"); MG.fx.landOk();
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
    $("kdHelp").classList.add("is-used");
    const m = missions[missionIdx];
    $("kdChoices").querySelectorAll(".kd-choice").forEach((b) => b.classList.toggle("is-help", b.dataset.kind === m.target));
    if (!auto) playMissionAudio();
  }
  function complete() {
    MG.finish($("kdOverlay"), {
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
