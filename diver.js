// Letter Pearl Diver (v2) — luister, zoek, verzamel. De duiker zwemt naar schelpen met parels
// (elke parel draagt een letter), verzamelt het gevraagde aantal parels met de GEHOORDE
// letter, geeft ze aan de wachter-mossel, krijgt een sleutel en opent de schatkist.
// Route: #/gamestage/diver/1
//
// Regels: alleen het overhandigen aan de mossel telt als antwoord. Zwemmen en oppakken
// is vrij; een parel in de tas kan teruggelegd worden (tik erop). Geen timers; hulp
// (💡) alleen op verzoek. Alle illustraties zijn ingebouwde SVG's (geen losse bestanden).
(() => {
  "use strict";

  const PHASER_SRC = "https://cdnjs.cloudflare.com/ajax/libs/phaser/3.70.0/phaser.min.js";
  const ROUTE = /^#\/gamestage\/diver(\/(\w+))?/;
  const DEBUG = location.hostname === "localhost";

  const $ = (id) => document.getElementById(id);
  const D = window.MiniCore;
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

  let curLevel = 0;
  function buildMissions() {
    // Alle nieuwe letters van het niveau + herhaling; afleiders komen uit de hele pool van het niveau.
    curLevel = MG.currentLevel(profileId);
    return MG.missionTargets(curLevel).map((target, i) => ({ target, need: [1, 2, 3, 3, 3][Math.min(i, 4)] }));
  }

  // ---------- Illustraties (SVG, 2x resolutie) ----------
  const svg = (w, h, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w * 2}" height="${h * 2}">${body}</svg>`;
  const lin = (id, a, b, v) => `<linearGradient id="${id}" x1="0" y1="0" x2="${v ? 0 : 1}" y2="${v ? 1 : 0}"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>`;
  const ART = {
    "dv-body": svg(240, 150, `
      <defs>${lin("s", "#34d1c4", "#17909f", 1)}${lin("t", "#ffd23f", "#f4a300")}
        <radialGradient id="l" cx=".35" cy=".3" r=".95"><stop offset="0" stop-color="#e6fbff" stop-opacity=".9"/><stop offset="1" stop-color="#4bb8e8" stop-opacity=".55"/></radialGradient></defs>
      <rect x="40" y="34" width="36" height="68" rx="16" fill="url(#t)" stroke="#c98200" stroke-width="3"/>
      <rect x="53" y="25" width="11" height="13" rx="3" fill="#8a8f98"/><rect x="48" y="52" width="24" height="5" rx="2" fill="#fff6" />
      <path d="M72 104 Q52 118 30 124" stroke="#127a88" stroke-width="16" stroke-linecap="round" fill="none"/>
      <path d="M132 80 Q158 98 178 94" stroke="#127a88" stroke-width="13" stroke-linecap="round" fill="none"/><circle cx="180" cy="94" r="9" fill="#f1bf90"/>
      <ellipse cx="112" cy="85" rx="47" ry="31" fill="url(#s)" stroke="#0f6f7c" stroke-width="3"/>
      <path d="M80 72 Q112 58 146 72" stroke="#ff9f1c" stroke-width="8" fill="none" stroke-linecap="round"/>
      <path d="M84 102 Q60 120 34 118" stroke="#1fb0bd" stroke-width="17" stroke-linecap="round" fill="none"/>
      <circle cx="165" cy="56" r="32" fill="#f4c79a" stroke="#d9a574" stroke-width="2"/>
      <path d="M133 52 Q135 22 166 20 Q198 22 200 52 Q168 38 133 52Z" fill="#14397a"/>
      <path d="M147 44 Q131 30 138 8" stroke="#ffd23f" stroke-width="7" fill="none" stroke-linecap="round"/><circle cx="138" cy="8" r="5.5" fill="#ff7b00"/>
      <circle cx="172" cy="60" r="6.5" fill="#fff"/><circle cx="190" cy="60" r="6.5" fill="#fff"/><circle cx="174" cy="61" r="3.2" fill="#2b1a10"/><circle cx="192" cy="61" r="3.2" fill="#2b1a10"/>
      <rect x="152" y="42" width="52" height="36" rx="15" fill="url(#l)" stroke="#ff7b00" stroke-width="6"/>
      <ellipse cx="167" cy="52" rx="9" ry="4" fill="#fff" opacity=".75" transform="rotate(-18 167 52)"/>
      <path d="M170 88 Q181 97 194 88" stroke="#a5532f" stroke-width="3.5" fill="none" stroke-linecap="round"/>
      <circle cx="150" cy="74" r="5" fill="#ff8a8a" opacity=".5"/>
      <path d="M124 88 Q150 110 176 106" stroke="#1fb0bd" stroke-width="14" stroke-linecap="round" fill="none"/><circle cx="178" cy="106" r="10" fill="#f4c79a" stroke="#d9a574" stroke-width="2"/>`),
    "dv-fin": svg(100, 60, `<defs>${lin("f", "#ffb347", "#e85d04")}</defs>
      <path d="M97 30 Q62 2 4 8 L16 30 L4 52 Q62 58 97 30Z" fill="url(#f)" stroke="#b34700" stroke-width="3" stroke-linejoin="round"/>
      <path d="M90 30 L18 12M90 30 L20 30M90 30 L18 48" stroke="#fff" stroke-opacity=".45" stroke-width="2.5" fill="none"/>`),
    "dv-shell-bot": svg(200, 100, `<defs>${lin("b", "#e07bb0", "#a83f86", 1)}</defs>
      <path d="M6 38 Q100 18 194 38 Q192 92 100 96 Q8 92 6 38Z" fill="url(#b)" stroke="#8c2f6d" stroke-width="4"/>
      <ellipse cx="100" cy="42" rx="82" ry="15" fill="#6d2158"/><path d="M24 66 Q100 84 176 66" stroke="#fff" stroke-opacity=".35" stroke-width="4" fill="none" stroke-linecap="round"/>`),
    "dv-shell-top": svg(200, 110, `<defs>${lin("t", "#ffc2dc", "#ec78ae", 1)}</defs>
      <path d="M100 104 C18 100 -4 52 22 30 C54 4 146 4 178 30 C204 52 182 100 100 104Z" fill="url(#t)" stroke="#c94c88" stroke-width="4"/>
      <path d="M100 100 L28 34M100 100 L52 14M100 100 L84 6M100 100 L116 6M100 100 L148 14M100 100 L172 34" stroke="#c94c88" stroke-opacity=".55" stroke-width="3.5" fill="none"/>
      <path d="M40 40 Q100 14 160 40" stroke="#fff" stroke-opacity=".5" stroke-width="5" fill="none" stroke-linecap="round"/>`),
    "dv-clam-bot": svg(300, 120, `<defs>${lin("c", "#c08ae8", "#7e3fb6", 1)}</defs>
      <path d="M8 40 Q150 12 292 40 Q288 110 150 114 Q12 110 8 40Z" fill="url(#c)" stroke="#5b2d8a" stroke-width="5"/>
      <ellipse cx="150" cy="46" rx="122" ry="20" fill="#4a1f72"/><ellipse cx="150" cy="58" rx="46" ry="14" fill="#ff8fa3"/>
      <path d="M30 80 Q150 104 270 80" stroke="#fff" stroke-opacity=".3" stroke-width="5" fill="none" stroke-linecap="round"/>`),
    "dv-clam-top": svg(300, 150, `<defs>${lin("c", "#d8b0f5", "#9a55d0", 1)}</defs>
      <path d="M150 144 C26 140 -4 76 30 44 C70 6 230 6 270 44 C304 76 274 140 150 144Z" fill="url(#c)" stroke="#5b2d8a" stroke-width="5"/>
      <path d="M150 138 L44 54M150 138 L80 24M150 138 L124 12M150 138 L176 12M150 138 L220 24M150 138 L256 54" stroke="#5b2d8a" stroke-opacity=".35" stroke-width="4" fill="none"/>
      <circle cx="108" cy="86" r="19" fill="#fff"/><circle cx="192" cy="86" r="19" fill="#fff"/><circle cx="112" cy="88" r="9" fill="#2b1a10"/><circle cx="196" cy="88" r="9" fill="#2b1a10"/>
      <circle cx="115" cy="84" r="3" fill="#fff"/><circle cx="199" cy="84" r="3" fill="#fff"/>
      <path d="M118 112 Q150 128 182 112" stroke="#5b2d8a" stroke-width="5" fill="none" stroke-linecap="round"/>
      <ellipse cx="78" cy="106" rx="12" ry="7" fill="#ff8fa3" opacity=".6"/><ellipse cx="222" cy="106" rx="12" ry="7" fill="#ff8fa3" opacity=".6"/>`),
    "dv-chest-bot": svg(200, 100, `<defs>${lin("w", "#a5702f", "#6f4417", 1)}</defs>
      <rect x="8" y="8" width="184" height="86" rx="12" fill="url(#w)" stroke="#4b2d0e" stroke-width="5"/>
      <path d="M8 36 H192M8 64 H192" stroke="#4b2d0e" stroke-opacity=".45" stroke-width="3"/>
      <rect x="8" y="8" width="26" height="86" rx="8" fill="#f2c14e" stroke="#b8861e" stroke-width="3"/><rect x="166" y="8" width="26" height="86" rx="8" fill="#f2c14e" stroke="#b8861e" stroke-width="3"/>
      <rect x="84" y="10" width="32" height="36" rx="8" fill="#f7d774" stroke="#b8861e" stroke-width="3"/><circle cx="100" cy="26" r="6" fill="#4b2d0e"/><rect x="98" y="26" width="4" height="12" fill="#4b2d0e"/>`),
    "dv-chest-top": svg(200, 70, `<defs>${lin("w", "#b98238", "#7d4f1c", 1)}</defs>
      <path d="M8 64 Q8 8 100 6 Q192 8 192 64Z" fill="url(#w)" stroke="#4b2d0e" stroke-width="5"/>
      <path d="M8 64 Q10 30 34 20 L34 64Z" fill="#f2c14e"/><path d="M192 64 Q190 30 166 20 L166 64Z" fill="#f2c14e"/>
      <rect x="86" y="8" width="28" height="56" fill="#f2c14e" stroke="#b8861e" stroke-width="3"/>
      <path d="M30 28 Q100 4 170 28" stroke="#fff" stroke-opacity=".3" stroke-width="5" fill="none" stroke-linecap="round"/>`),
    "dv-key": svg(70, 34, `<circle cx="15" cy="17" r="12" fill="none" stroke="#e8a900" stroke-width="7"/><circle cx="15" cy="17" r="12" fill="none" stroke="#ffd23f" stroke-width="3"/>
      <rect x="25" y="14" width="40" height="7" rx="3" fill="#ffd23f" stroke="#c98200" stroke-width="2"/><rect x="50" y="20" width="6" height="11" rx="2" fill="#ffd23f" stroke="#c98200" stroke-width="2"/><rect x="60" y="20" width="6" height="8" rx="2" fill="#ffd23f" stroke="#c98200" stroke-width="2"/>`),
    "dv-coral1": svg(120, 160, `<g stroke-linecap="round" fill="none"><path d="M60 156 L60 80 M60 110 L24 60 M60 96 L98 52 M24 60 L16 30 M24 60 L40 34 M98 52 L106 24 M98 52 L84 28" stroke="#ff7aa2" stroke-width="14"/>
      <path d="M60 156 L60 80 M60 110 L24 60 M60 96 L98 52" stroke="#ffb3c7" stroke-width="4"/></g><circle cx="16" cy="28" r="8" fill="#ff5c8a"/><circle cx="40" cy="32" r="8" fill="#ff5c8a"/><circle cx="106" cy="22" r="8" fill="#ff5c8a"/><circle cx="84" cy="26" r="8" fill="#ff5c8a"/>`),
    "dv-coral2": svg(140, 130, `<defs>${lin("f", "#b9a6ff", "#7a5bd6", 1)}</defs><path d="M70 126 C4 118 -4 40 24 22 C54 4 86 4 116 22 C144 40 136 118 70 126Z" fill="url(#f)" stroke="#5a3fb0" stroke-width="4"/>
      <path d="M70 120 L24 30M70 120 L46 12M70 120 L70 8M70 120 L94 12M70 120 L116 30" stroke="#5a3fb0" stroke-opacity=".5" stroke-width="3.5" fill="none"/>`),
    "dv-weed": svg(60, 200, `<path d="M30 200 C6 160 54 130 28 90 C10 62 40 40 30 4" stroke="#1f9a5a" stroke-width="12" stroke-linecap="round" fill="none"/><path d="M30 200 C54 168 8 138 34 100 C50 76 22 52 32 14" stroke="#34c37a" stroke-width="8" stroke-linecap="round" fill="none"/>`),
    "dv-rock": svg(140, 80, `<defs>${lin("r", "#9aa5b4", "#5f6b7a", 1)}</defs><path d="M6 76 Q0 30 40 22 Q70 6 100 24 Q140 30 134 76Z" fill="url(#r)" stroke="#47515f" stroke-width="4"/><path d="M40 34 Q60 22 80 30" stroke="#fff" stroke-opacity=".35" stroke-width="5" fill="none" stroke-linecap="round"/>`),
    "dv-fish": svg(80, 50, `<defs>${lin("f", "#ffb347", "#ff6b35")}</defs><path d="M62 25 L78 8 L78 42Z" fill="#ff6b35"/><ellipse cx="34" cy="25" rx="32" ry="19" fill="url(#f)" stroke="#c9480f" stroke-width="3"/>
      <path d="M30 8 Q36 25 30 42" stroke="#fff" stroke-width="5" fill="none" opacity=".8"/><circle cx="16" cy="21" r="5" fill="#fff"/><circle cx="15" cy="21" r="2.4" fill="#222"/>`),
  };
  const uri = (s) => "data:image/svg+xml;charset=utf-8," + encodeURIComponent(s);

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

  // SVG's zelf decoderen en als Image aan Phaser geven (data-URI via de Phaser-loader geeft lege textures).
  function decodeArt() {
    return Promise.all(Object.entries(ART).map(([k, s]) => new Promise((res) => {
      const im = new Image(); im.onload = () => res([k, im]); im.onerror = () => res([k, null]); im.src = uri(s);
    }))).then((pairs) => Object.fromEntries(pairs));
  }

  async function createGame(myEpoch) {
    const mount = $("dvMount");
    if (!mount) return;
    const art = await decodeArt();
    if (myEpoch !== epoch) return;
    const SceneClass = makeSceneClass(window.Phaser);
    const local = new window.Phaser.Game({
      type: window.Phaser.AUTO, parent: "dvMount", width: mount.clientWidth || 390, height: mount.clientHeight || 500,
      transparent: true, scale: { mode: window.Phaser.Scale.NONE },
    });
    game = local;
    local.events.once("ready", () => {
      if (myEpoch !== epoch) { try { local.destroy(true); } catch {} return; }
      scene = local.scene.add("DiverScene", SceneClass, true, { art });
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
    return window.AudioManager.playInstruction("find-letter").then((ok) => (ok === false ? false : letterAudio(m.target))).then(done, done);
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
    voiceDone.then(() => MG.wait(1200)).then(() => {
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
    const lerp = Phaser.Math.Linear;
    return class DiverScene extends Phaser.Scene {
      constructor() { super("DiverScene"); }

      init(data) { this.art = (data && data.art) || {}; }

      create() {
        Object.entries(this.art).forEach(([k, im]) => { if (im && !this.textures.exists(k)) this.textures.addImage(k, im); });
        this.mission = null; this.shells = []; this.bag = []; this.hasKey = false; this.handing = false; this.chestOpen = false;
        this.t = 0; this.kick = 0; this.bubbleT = 0; this.tilt = 0;
        this.makePearlTexture();
        this.keys = this.input.keyboard.addKeys({ left: "LEFT", right: "RIGHT", up: "UP", down: "DOWN", a: "A", d: "D", w: "W", s: "S" });
        this.build(true);
        this.input.on("pointerdown", (p) => this.onPointer(p));
        this.input.on("pointermove", (p) => { if (p.isDown) this.onPointer(p); });
        this.created = true;
        setTimeout(() => this.events.emit("diver-ready"), 0); // create() draait synchroon: laat de luisteraars eerst koppelen
      }
      shutdownScene() { this.tweens.killAll(); }

      makePearlTexture() {
        if (this.textures.exists("dv-pearl")) return;
        const c = this.textures.createCanvas("dv-pearl", 128, 128), g = c.getContext();
        const gr = g.createRadialGradient(46, 42, 6, 64, 64, 62);
        gr.addColorStop(0, "#ffffff"); gr.addColorStop(0.55, "#f3eefc"); gr.addColorStop(1, "#c9bfe6");
        g.fillStyle = gr; g.beginPath(); g.arc(64, 64, 60, 0, Math.PI * 2); g.fill();
        g.strokeStyle = "#b3a6d6"; g.lineWidth = 4; g.stroke();
        c.refresh();
      }

      layout() {
        const W = this.scale.width, H = this.scale.height;
        const r = clamp(Math.min(W, H) * 0.058, 22, 34);
        // Mossel (breed r*5.4) en kist (r*4.4) blijven op smalle schermen helemaal in beeld.
        const clamX = Math.max(W * 0.14, r * 2.8 + 6), chestX = Math.min(W * 0.86, W - r * 2.3 - 6);
        return { W, H, r, clam: { x: clamX, y: H * 0.79 }, chest: { x: chestX, y: H * 0.8 }, start: { x: W * 0.5, y: H * 0.2 } };
      }

      build(first) {
        const L = (this.L = this.layout()), { W, H, r } = L;
        this.t0 = this.t;
        // Water
        if (this.textures.exists("dv-sea")) this.textures.remove("dv-sea");
        const c = this.textures.createCanvas("dv-sea", 4, 256), g = c.getContext();
        const gr = g.createLinearGradient(0, 0, 0, 256);
        gr.addColorStop(0, "#9fe3f5"); gr.addColorStop(0.45, "#43b8dc"); gr.addColorStop(1, "#1d6aa5");
        g.fillStyle = gr; g.fillRect(0, 0, 4, 256); c.refresh();
        this.add.image(0, 0, "dv-sea").setOrigin(0).setDisplaySize(W, H).setDepth(0);
        // Lichtstralen en zandbodem: eenmalig naar een afbeelding "bakken" (Graphics tekent anders elk frame opnieuw: traag op telefoons)
        this.bakeSeq = (this.bakeSeq || 0) + 1;
        const bake = (w, h, draw) => {
          const key = `dv-bake-${this.bakeSeq}-${Math.random().toString(36).slice(2, 7)}`;
          const g = this.make.graphics({ x: 0, y: 0, add: false }); draw(g);
          g.generateTexture(key, Math.ceil(w), Math.ceil(h)); g.destroy();
          return key;
        };
        const raysKey = bake(W, H, (g) => {
          g.fillStyle(0xffffff, 0.09);
          for (let i = 0; i < 5; i++) { const x0 = W * (0.1 + i * 0.2); g.beginPath(); g.moveTo(x0, 0); g.lineTo(x0 + W * 0.09, 0); g.lineTo(x0 + W * 0.3, H * 0.9); g.lineTo(x0 + W * 0.12, H * 0.9); g.closePath(); g.fillPath(); }
        });
        const rays = this.add.image(0, 0, raysKey).setOrigin(0).setDepth(1);
        this.tweens.add({ targets: rays, alpha: { from: 0.45, to: 1 }, duration: 3200, yoyo: true, repeat: -1, ease: "Sine.InOut" });
        const sandKey = bake(W, H, (g) => {
          g.fillStyle(0xe6cf94, 1); g.fillEllipse(W * 0.5, H * 1.0, W * 1.7, H * 0.34);
          g.fillStyle(0xf1deaa, 1); g.fillEllipse(W * 0.45, H * 1.02, W * 1.4, H * 0.26);
          g.fillStyle(0xcdb57a, 0.5);
          for (let i = 0; i < 24; i++) g.fillCircle(Math.random() * W, H * (0.9 + Math.random() * 0.09), 2 + Math.random() * 3);
        });
        this.add.image(0, 0, sandKey).setOrigin(0).setDepth(2);
        // Koraal, wier, rotsen (achtergrond)
        const place = (key, x, y, w, depth, sway) => {
          const im = this.add.image(x, y, key).setOrigin(0.5, 1).setDepth(depth);
          im.setScale(w / im.width);
          if (sway) this.tweens.add({ targets: im, angle: { from: -sway, to: sway }, duration: 1800 + Math.random() * 1200, yoyo: true, repeat: -1, ease: "Sine.InOut" });
          return im;
        };
        place("dv-rock", W * 0.33, H * 0.93, r * 4.2, 2); place("dv-rock", W * 0.68, H * 0.94, r * 3.4, 2);
        place("dv-coral1", W * 0.05, H * 0.93, r * 2.6, 2, 1.5); place("dv-coral2", W * 0.5, H * 0.95, r * 3.2, 2); place("dv-coral1", W * 0.95, H * 0.93, r * 2.4, 2, 1.5);
        [0.22, 0.4, 0.58, 0.77].forEach((f, i) => place("dv-weed", W * f, H * 0.95, r * 1.3, 2, 5 + i));
        // Vissen die langs zwemmen (sfeer)
        [[0.34, 9000], [0.52, 12000], [0.62, 15000]].forEach(([yf, dur], i) => {
          const f = this.add.image(i % 2 ? W + 60 : -60, H * yf, "dv-fish").setDepth(1).setScale((r * 1.4) / 80 * 1).setAlpha(0.85);
          const toRight = i % 2 === 0; f.setFlipX(!toRight);
          this.tweens.add({ targets: f, x: toRight ? W + 80 : -80, duration: dur, repeat: -1, delay: i * 2500, onRepeat: () => { f.x = toRight ? -80 : W + 80; } });
          this.tweens.add({ targets: f, y: f.y + 14, duration: 1400, yoyo: true, repeat: -1, ease: "Sine.InOut" });
        });
        for (let i = 0; i < 14; i++) { // luchtbelletjes
          const b = this.add.circle(Math.random() * W, H * (0.3 + Math.random() * 0.7), 3 + Math.random() * 5, 0xffffff, 0.35).setDepth(1);
          this.tweens.add({ targets: b, y: b.y - H * 0.4, alpha: 0, duration: 4000 + Math.random() * 4000, repeat: -1, delay: Math.random() * 3000 });
        }
        this.buildClam(); this.buildChest(); this.buildDiver(first);
        this.bagG = this.add.container(0, 0).setDepth(20);
        this.drawBag();
        if (this.mission) this.buildShells();
      }

      onResize() {
        if (!this.created) return;
        this.tweens.killAll(); this.children.removeAll(true);
        const keep = this.mission, key = this.hasKey, open = this.chestOpen;
        this.shells = [];
        this.build(false);
        this.hasKey = key; this.chestOpen = open;
        this.keyIcon.setVisible(!!key);
        if (open) this.chestLid.setAngle(-62);
        if (keep) { this.buildShells(); this.drawBubble(); }
      }

      // ----- Mossel (wachter), kist, duiker -----
      buildClam() {
        const { clam, r } = this.L, w = r * 5.4;
        this.clamBot = this.add.image(clam.x, clam.y, "dv-clam-bot").setDepth(4);
        this.clamBot.setScale(w / this.clamBot.width);
        const hinge = { x: clam.x - w / 2 + w * 0.04, y: clam.y - this.clamBot.displayHeight * 0.18 };
        this.clamTop = this.add.image(hinge.x, hinge.y, "dv-clam-top").setOrigin(0.04, 0.95).setDepth(5);
        this.clamTop.setScale(w / this.clamTop.width);
        this.clamTop.setAngle(-8);
        this.tweens.add({ targets: this.clamTop, angle: { from: -8, to: -3 }, duration: 1600, yoyo: true, repeat: -1, ease: "Sine.InOut" });
        this.bubble = this.add.container(clam.x + w * 0.12, clam.y - r * 6.3).setDepth(6);
        this.drawBubble();
      }
      drawBubble() {
        const { r } = this.L;
        this.bubble.removeAll(true);
        if (!this.mission) return;
        const m = this.mission, bw = r * 4.6, bh = r * 3;
        const g = this.add.graphics();
        g.fillStyle(0xffffff, 0.96); g.fillRoundedRect(-bw / 2, -bh / 2, bw, bh, 18); g.lineStyle(4, 0x7e3fb6, 1); g.strokeRoundedRect(-bw / 2, -bh / 2, bw, bh, 18);
        g.fillStyle(0xffffff, 0.96); g.fillTriangle(-r * 0.6, bh / 2 - 2, r * 0.6, bh / 2 - 2, -r * 1.3, bh / 2 + r * 0.7);
        const t = MG.letterText(this, -bw * 0.2, 0, m.target, r * 1.6);
        this.bubble.add([g, t]);
        for (let i = 0; i < m.need; i++) {
          const p = this.add.image(bw * 0.2 + (i - (m.need - 1) / 2) * r * 0.62 * (m.need > 1 ? 1 : 0), (i - (m.need - 1) / 2) * 0, "dv-pearl").setDisplaySize(r * 0.7, r * 0.7);
          p.x = bw * 0.14 + i * r * 0.78 - ((m.need - 1) * r * 0.78) / 2 + r * 0.4;
          this.bubble.add(p);
        }
      }
      buildChest() {
        const { chest, r } = this.L, w = r * 4.4;
        this.chestBot = this.add.image(chest.x, chest.y, "dv-chest-bot").setDepth(4);
        this.chestBot.setScale(w / this.chestBot.width);
        const top = chest.y - this.chestBot.displayHeight / 2;
        this.chestLid = this.add.image(chest.x - w / 2, top + 2, "dv-chest-top").setOrigin(0, 1).setDepth(5);
        this.chestLid.setScale(w / this.chestLid.width);
        this.chestGlow = this.add.circle(chest.x, top, r * 1.6, 0xffe27a, 0).setDepth(3);
        if (this.chestOpen) this.chestLid.setAngle(-62);
      }
      buildDiver(first) {
        const { start, r } = this.L;
        const x = first || !this.diver ? start.x : this.diver.x, y = first || !this.diver ? start.y : this.diver.y;
        const d = this.add.container(x, y).setDepth(10);
        const bodyW = r * 4.6;
        this.fin = this.add.image(-bodyW * 0.3, bodyW * 0.17, "dv-fin").setOrigin(0.96, 0.5).setDepth(0);
        this.fin.setScale((bodyW * 0.36) / this.fin.width);
        this.diverBody = this.add.image(0, 0, "dv-body");
        this.diverBody.setScale(bodyW / this.diverBody.width);
        this.keyIcon = this.add.image(bodyW * 0.18, -bodyW * 0.42, "dv-key").setVisible(!!this.hasKey);
        this.keyIcon.setScale((r * 1.5) / this.keyIcon.width);
        d.add([this.fin, this.diverBody, this.keyIcon]);
        this.diver = d; this.dest = { x, y }; this.facing = 1;
      }

      // ----- Schelpen & parels -----
      buildShells() {
        (this.shells || []).forEach((s) => s.c.destroy());
        const { W, H, r } = this.L, m = this.mission;
        const others = MG.distractors(curLevel, m.target, 4);
        const letters = shuffle([...Array(m.need + 1).fill(m.target), ...Array.from({ length: 4 }, (_, i) => others[i % others.length])]);
        const pts = [], minD = r * 4.7;
        letters.forEach((letter) => {
          let p = null;
          for (let t = 0; t < 500 && !p; t++) {
            const c = { x: W * 0.15 + Math.random() * W * 0.7, y: H * 0.3 + Math.random() * H * 0.36 };
            const okClam = Math.hypot(c.x - this.L.clam.x, c.y - this.L.clam.y) > r * 5;
            const okChest = Math.hypot(c.x - this.L.chest.x, c.y - this.L.chest.y) > r * 4.6;
            const okBubble = !(c.x < this.L.clam.x + r * 3.8 && c.y > this.L.clam.y - r * 8.4);
            if (okClam && okChest && okBubble && pts.every((q) => Math.hypot(q.x - c.x, q.y - c.y) >= minD)) p = c;
          }
          if (p) pts.push({ ...p, letter });
        });
        const sw = r * 3.8;
        this.shells = pts.map((p) => {
          const c = this.add.container(p.x, p.y).setDepth(3);
          const bot = this.add.image(0, 0, "dv-shell-bot"); bot.setScale(sw / bot.width);
          const glow = this.add.circle(0, -sw * 0.04, r * 1.35, 0xffd54a, 0).setStrokeStyle(5, 0xffd54a, 0);
          const pearl = this.add.container(0, -sw * 0.06);
          pearl.add([this.add.image(0, 0, "dv-pearl").setDisplaySize(r * 1.9, r * 1.9),
            MG.letterText(this, 0, 0, p.letter, r * 1.05)]);
          const lid = this.add.image(-sw / 2 + sw * 0.05, -sw * 0.06, "dv-shell-top").setOrigin(0.05, 0.96); lid.setScale(sw / lid.width);
          c.add([bot, glow, pearl, lid]);
          return { c, lid, glow, pearl, x: p.x, y: p.y, letter: p.letter, taken: false, armed: true, lidAngle: 0 };
        });
        this.shells.forEach((s, i) => { s.c.setScale(0); this.tweens.add({ targets: s.c, scale: 1, duration: 320, delay: i * 70, ease: "Back.Out" }); });
      }

      setupMission(m) {
        this.mission = m; this.hasKey = false; this.chestOpen = false; this.handing = false;
        this.chestLid.setAngle(0); this.keyIcon.setVisible(false);
        this.bag = []; this.drawBag(); this.drawBubble();
        this.diver.setPosition(this.L.start.x, this.L.start.y); this.dest = { x: this.L.start.x, y: this.L.start.y };
        this.buildShells();
      }

      highlightTargets() {
        this.shells.forEach((s) => {
          if (s.taken || s.letter !== this.mission.target) return;
          s.glow.setStrokeStyle(5, 0xffd54a, 1);
          this.tweens.add({ targets: s.glow, scale: { from: 0.9, to: 1.25 }, duration: 520, yoyo: true, repeat: -1, ease: "Sine.InOut" });
        });
      }

      // ----- Tas (toont opgepakte parels; tik = terugleggen) -----
      slotXY(i) { const { r } = this.L; return { x: 14 + r * 1.2 + i * r * 2.3, y: 14 + r * 1.2 }; }
      drawBag() {
        const { r } = this.L;
        this.bagG.removeAll(true);
        const slots = 4, w = r * 2.3 * slots + 12, h = r * 2.4;
        const bg = this.add.graphics();
        bg.fillStyle(0x0d3b66, 0.55); bg.fillRoundedRect(8, 8, w, h, 16); bg.lineStyle(3, 0xffffff, 0.85); bg.strokeRoundedRect(8, 8, w, h, 16);
        for (let i = 0; i < slots; i++) { const p = this.slotXY(i); bg.lineStyle(2, 0xffffff, 0.45); bg.strokeCircle(p.x, p.y, r * 0.95); }
        this.bagG.add(bg);
        this.bag.forEach((b, i) => {
          if (b.arriving) return;
          const p = this.slotXY(i), pc = this.add.container(p.x, p.y);
          const hit = this.add.circle(0, 0, r * 1.05, 0xffffff, 0.001).setInteractive({ useHandCursor: true });
          hit.on("pointerdown", (pt, lx, ly, ev) => { if (ev) ev.stopPropagation(); this.putBack(i); });
          pc.add([this.add.image(0, 0, "dv-pearl").setDisplaySize(r * 1.7, r * 1.7),
            MG.letterText(this, 0, 0, b.letter, r * 0.95), hit]);
          this.bagG.add(pc);
        });
      }
      flyPearl(letter, from, to, dur, delay, done) {
        const { r } = this.L;
        const c = this.add.container(from.x, from.y).setDepth(25);
        c.add([this.add.image(0, 0, "dv-pearl").setDisplaySize(r * 1.7, r * 1.7), MG.letterText(this, 0, 0, letter, r * 0.95)]);
        this.tweens.add({ targets: c, x: to.x, duration: dur, delay, ease: "Sine.InOut" });
        this.tweens.add({ targets: c, y: to.y, duration: dur, delay, ease: "Back.In", onComplete: () => { c.destroy(); if (done) done(); } });
        this.tweens.add({ targets: c, scale: { from: 1, to: 0.85 }, duration: dur, delay });
      }
      putBack(i) {
        if (this.handing) return;
        const b = this.bag.splice(i, 1)[0]; if (!b) return;
        b.shell.taken = false; b.shell.armed = false; b.shell.pearl.setVisible(true);
        this.drawBag();
      }
      returnBag() {
        const old = this.bag.slice();
        this.bag = []; this.drawBag(); this.handing = false;
        old.forEach((b, i) => this.flyPearl(b.letter, this.slotXY(i), { x: b.shell.x, y: b.shell.y }, 520, i * 90, () => {
          b.shell.taken = false; b.shell.armed = false; b.shell.pearl.setVisible(true);
        }));
        this.tweens.add({ targets: this.clamTop, angle: { from: -3, to: -18 }, duration: 160, yoyo: true, repeat: 1 }); // mossel schudt "nee"
        this.dest = { x: this.diver.x, y: this.diver.y }; // blijf staan: zwemmen is aan het kind, niets raapt vanzelf op
      }
      giveKey() {
        const { clam, r } = this.L, old = this.bag.slice();
        this.bag = []; this.drawBag();
        const mouth = { x: clam.x, y: clam.y - r * 0.3 };
        this.tweens.add({ targets: this.clamTop, angle: -34, duration: 220, ease: "Sine.Out" });
        old.forEach((b, i) => this.flyPearl(b.letter, this.slotXY(i), mouth, 460, i * 140));
        this.time.delayedCall(460 + old.length * 140 + 80, () => {
          this.tweens.add({ targets: this.clamTop, angle: -6, duration: 180, ease: "Quad.In" });
          // De sleutel springt uit de mossel en vliegt naar de duiker.
          const key = this.add.image(mouth.x, mouth.y, "dv-key").setDepth(26); key.setScale((r * 1.8) / key.width);
          this.tweens.add({ targets: key, y: mouth.y - r * 2.2, duration: 300, ease: "Quad.Out", onComplete: () => {
            const sx = key.x, sy = key.y;
            this.tweens.addCounter({ from: 0, to: 1, duration: 650, ease: "Sine.InOut", onUpdate: (tw) => {
              const v = tw.getValue(); key.setPosition(lerp(sx, this.diver.x, v), lerp(sy, this.diver.y - r * 1.5, v)); key.angle = v * 360;
            }, onComplete: () => { key.destroy(); this.hasKey = true; this.keyIcon.setVisible(true); this.handing = false;
              this.tweens.add({ targets: this.keyIcon, scale: { from: this.keyIcon.scale * 1.6, to: this.keyIcon.scale }, duration: 250, ease: "Back.Out" }); } });
          } });
        });
      }
      openChest() {
        this.chestOpen = true; this.hasKey = false; this.keyIcon.setVisible(false);
        const { chest, r } = this.L;
        this.tweens.add({ targets: this.chestLid, angle: -62, duration: 420, ease: "Back.Out" });
        this.chestGlow.setAlpha(0.9); this.chestGlow.setScale(0.3);
        this.tweens.add({ targets: this.chestGlow, scale: 2.4, alpha: 0, duration: 900, ease: "Quad.Out" });
        const top = chest.y - this.chestBot.displayHeight / 2;
        for (let i = 0; i < 16; i++) {
          const coin = this.add.circle(chest.x, top, r * 0.22, i % 3 ? 0xffd23f : 0xffffff).setDepth(30).setStrokeStyle(2, 0xc98200);
          const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.8, d = r * (2 + Math.random() * 2.4);
          this.tweens.add({ targets: coin, x: chest.x + Math.cos(a) * d, y: top + Math.sin(a) * d, duration: 600, ease: "Quad.Out" });
          this.tweens.add({ targets: coin, y: `+=${r * 3}`, alpha: 0, delay: 600, duration: 500, onComplete: () => coin.destroy() });
        }
        for (let i = 0; i < 8; i++) {
          const st = this.add.star(chest.x, top, 5, 5, 12, 0xffffff).setDepth(31);
          const a = (i / 8) * Math.PI * 2;
          this.tweens.add({ targets: st, x: chest.x + Math.cos(a) * r * 3.2, y: top + Math.sin(a) * r * 3.2, alpha: 0, angle: 180, duration: 800, onComplete: () => st.destroy() });
        }
      }

      // ----- Invoer -----
      onPointer(p) {
        if (this.handing) return;
        const w = this.L.r * 2.3 * 4 + 24;
        if (p.y < this.L.r * 3.6 && p.x < w) return; // tikken op de tas niet als zwem-bestemming
        this.dest = { x: clamp(p.x, 20, this.L.W - 20), y: clamp(p.y, 20, this.L.H - 20) };
      }

      update(_, delta) {
        if (!this.diver) return;
        const s = delta / 1000, k = this.keys, sp = 210;
        this.t += s;
        let vx = 0, vy = 0;
        if (k.left.isDown || k.a.isDown) vx -= 1;
        if (k.right.isDown || k.d.isDown) vx += 1;
        if (k.up.isDown || k.w.isDown) vy -= 1;
        if (k.down.isDown || k.s.isDown) vy += 1;
        if (vx || vy) {
          const l = Math.hypot(vx, vy); this.dest = { x: clamp(this.diver.x + vx / l * 60, 20, this.L.W - 20), y: clamp(this.diver.y + vy / l * 60, 20, this.L.H - 20) };
        }
        const dx = this.dest.x - this.diver.x, dy = this.dest.y - this.diver.y, d = Math.hypot(dx, dy);
        const moving = d > 3;
        if (moving) {
          const step = Math.min(d, sp * s * clamp(d / 40, 0.35, 1)); // zacht afremmen bij aankomst
          this.diver.x += dx / d * step; this.diver.y += dy / d * step;
          if (Math.abs(dx) > 4) { this.facing = dx < 0 ? -1 : 1; this.diver.setScale(this.facing, 1); }
        }
        // Zwemanimatie: vin trapt, lichaam kantelt licht en deint
        this.kick += s * (moving ? 13 : 3.5);
        this.fin.setAngle(Math.sin(this.kick) * (moving ? 24 : 7));
        const wantTilt = moving ? clamp((dy / Math.max(1, Math.abs(dx) + Math.abs(dy))) * 0.5, -0.45, 0.45) : 0;
        this.tilt = lerp(this.tilt, wantTilt, 0.12);
        this.diverBody.setRotation(this.tilt);
        this.diverBody.y = Math.sin(this.t * 2.2) * 3;
        this.bubbleT -= s;
        if (moving && this.bubbleT <= 0) {
          this.bubbleT = 0.13;
          const bx = this.diver.x + this.facing * this.L.r * 2.1, by = this.diver.y - this.L.r * 0.9;
          const b = this.add.circle(bx, by, 2 + Math.random() * 3, 0xffffff, 0.6).setDepth(9);
          this.tweens.add({ targets: b, y: by - this.L.r * 2, x: bx + (Math.random() - 0.5) * 16, alpha: 0, duration: 800, onComplete: () => b.destroy() });
        }
        const dv = this.diver, r = this.L.r;
        // Schelpen: open als de duiker dichtbij is; parels dobberen; oppakken
        this.shells.forEach((sh) => {
          const dist = Math.hypot(dv.x - sh.x, dv.y - sh.y);
          sh.lidAngle = lerp(sh.lidAngle, dist < r * 4 ? -52 : (sh.taken ? -20 : 0), 0.14);
          sh.lid.setAngle(sh.lidAngle);
          sh.pearl.y = -r * 0.2 * 0 + (-this.L.r * 3.8 * 0.06) + Math.sin(this.t * 2 + sh.x) * 1.6;
          if (this.mission && !this.handing) {
            if (dist >= r * 2.3) { sh.armed = true; return; }
            if (sh.taken || !sh.armed || this.bag.length >= 4) return;
            // Alleen oppakken als je er bewust naartoe zwemt (bestemming ligt bij de schelp), niet bij langs zwemmen.
            if (Math.hypot(this.dest.x - sh.x, this.dest.y - sh.y) > r * 2.2) return;
            sh.taken = true; sh.pearl.setVisible(false);
            const entry = { letter: sh.letter, shell: sh, arriving: true };
            const slot = this.slotXY(this.bag.length);
            this.bag.push(entry); this.drawBag();
            this.flyPearl(sh.letter, { x: sh.x, y: sh.y - r * 0.3 }, slot, 420, 0, () => { entry.arriving = false; this.drawBag(); });
          }
        });
        if (this.mission && !this.handing) {
          // Overhandigen aan de mossel (alleen als alle parels in de tas zijn aangekomen)
          if (this.bag.length && !this.bag.some((b) => b.arriving) && Math.hypot(dv.x - this.L.clam.x, dv.y - this.L.clam.y) < r * 3) {
            this.handing = true;
            this.events.emit("diver-handover", this.bag.map((b) => b.letter));
          }
          // Sleutel in de kist
          if (this.hasKey && Math.hypot(dv.x - this.L.chest.x, dv.y - this.L.chest.y) < r * 3) {
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
