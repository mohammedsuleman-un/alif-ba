// Letter Bridge (Friends' bridge) — de alfabetvolgorde afmaken. Een touwbrug heeft gaten:
// zet de ontbrekende letterplanken op de juiste plek (slepen of tikken), druk op
// "Oversteken" en de verkenner loopt over de planken terwijl elke letter wordt uitgesproken.
// Een verkeerde plank kantelt, de verkenner glijdt veilig terug. Route: #/gamestage/bridge/1
//
// Regels: alleen het oversteken telt als antwoord; plaatsen en verplaatsen is vrij.
// Het alfabet loopt van rechts naar links (Arabisch), ongeacht de interfacetaal.
// Geen timers; hulp (💡) alleen op verzoek.
(() => {
  "use strict";

  const ROUTE = /^#\/gamestage\/bridge(\/(\w+))?/;
  const DEBUG = location.hostname === "localhost";
  const $ = (id) => document.getElementById(id);
  const D = window.MiniCore;
  const MG = window.MiniGames;
  const { store, dir, lang, recordAttempt } = D;
  const shuffle = MG.shuffle;

  const ALPHA = ["ا", "ب", "ت", "ث", "ج", "ح", "خ", "د", "ذ", "ر", "ز", "س", "ش", "ص", "ض", "ط", "ظ", "ع", "غ", "ف", "ق", "ك", "ل", "م", "ن", "هـ", "و", "ي"];

  const TXT = {
    nl: { instr: "Maak de rij af", back: "Terug", listen: "Luister opnieuw", help: "Help mij", cross: "Oversteken", hint: "Zet de ontbrekende letters op de brug. Het alfabet loopt van rechts naar links." },
    en: { instr: "Complete the row", back: "Back", listen: "Listen again", help: "Help me", cross: "Cross", hint: "Put the missing letters on the bridge. The alphabet runs from right to left." },
    ar: { instr: "أكمل الصف", back: "رجوع", listen: "استمع مرة أخرى", help: "ساعدني", cross: "اعبر", hint: "ضع الحروف الناقصة على الجسر. الأبجدية تسير من اليمين إلى اليسار." },
    tr: { instr: "Sırayı tamamla", back: "Geri", listen: "Tekrar dinle", help: "Yardım et", cross: "Geç", hint: "Eksik harfleri köprüye koy. Alfabe sağdan sola gider." },
  };
  const AF = window.ArF || { fem: (s) => s, deep: (t) => t }; // Arabisch: vrouwelijke vorm voor meisjes (ar-gender.js)
  const tx = () => AF.deep(TXT[lang()] || TXT.nl);

  // ---------- Missies ----------
  // Drie rijen rond de gekozen letter-groep; steeds meer gaten.
  // Wereld 2: de rij is het alfabet met steeds hetzelfde klinkerteken (بَ تَ ثَ ...); elke opdracht heeft een ander teken.
  // De extra plank is dezelfde letter met een ander teken: het kind moet het teken horen.
  function buildHarakatMissions() {
    const H = window.GAME.harakat, level = MG.currentLevel(profileId), group = MG.group(level);
    const s0 = Math.max(0, H.BASES.indexOf(MG.baseOf(group[0])));
    const marks = shuffle(["fatha", "damma", "kasra"]);
    const specs = [{ len: 5, gaps: 1, off: -1 }, { len: 5, gaps: 2, off: 0 }, { len: 6, gaps: 2, off: 1 }];
    return specs.map((sp, k) => {
      const mark = marks[k % 3], start = Math.max(0, Math.min(H.BASES.length - sp.len, s0 + sp.off));
      const idx = Array.from({ length: sp.len }, (_, i) => start + i);
      const seq = idx.map((i) => H.item(i, mark));
      const cand = shuffle(seq.map((_, i) => i).filter((i) => i > 0));
      const gaps = [];
      cand.forEach((i) => { if (gaps.length < sp.gaps && gaps.every((g) => Math.abs(g - i) > 1)) gaps.push(i); });
      gaps.sort((a, b) => a - b);
      const needed = gaps.map((i) => seq[i]);
      const other = shuffle(["fatha", "damma", "kasra"].filter((m) => m !== mark))[0];
      const extra = H.item(idx[gaps[0]], other);
      return { seq, gaps, tray: shuffle([...needed, extra]) };
    });
  }
  function buildMissions() {
    if (MG.isHarakat() && window.GAME && window.GAME.harakat) return buildHarakatMissions();
    const group = MG.group(MG.currentLevel(profileId));
    const s0 = Math.max(0, ALPHA.indexOf(group[0]));
    const specs = [{ len: 5, gaps: 1, off: -1 }, { len: 5, gaps: 2, off: 0 }, { len: 6, gaps: 2, off: 1 }];
    return specs.map((sp) => {
      const start = Math.max(0, Math.min(ALPHA.length - sp.len, s0 + sp.off));
      const seq = ALPHA.slice(start, start + sp.len);
      // Gaten nooit direct naast elkaar en nooit op de eerste plank (die toont het begin van de rij).
      const cand = shuffle(seq.map((_, i) => i).filter((i) => i > 0));
      const gaps = [];
      cand.forEach((i) => { if (gaps.length < sp.gaps && gaps.every((g) => Math.abs(g - i) > 1)) gaps.push(i); });
      gaps.sort((a, b) => a - b);
      const needed = gaps.map((i) => seq[i]);
      const extra = [ALPHA[start - 1], ALPHA[start + sp.len], ALPHA[start + sp.len + 1]].filter((l) => l && !seq.includes(l));
      return { seq, gaps, tray: shuffle([...needed, extra[0] || ALPHA[(start + sp.len + 2) % ALPHA.length]]) };
    });
  }

  // ---------- State ----------
  let active = false, epoch = 0, profileId = null;
  let missions = [], missionIdx = 0, solved = [], helped = false, wrongThisMission = 0, missionStart = 0, busy = false;
  let slots = [], tray = [], selected = null, drag = null, voiceTok = 0;

  function activeProfile() {
    const pid = store.get("gp_active", null);
    return store.get("gp_profiles", []).find((p) => p.id === pid) || null;
  }

  function teardown() {
    active = false; epoch++;
    window.removeEventListener("keydown", onKey);
    window.removeEventListener("resize", layoutScene);
    document.documentElement.classList.remove("gamestage-active");
    const section = $("gamestage");
    if (section && section.dataset.owner === "bridge") { section.hidden = true; section.innerHTML = ""; delete section.dataset.owner; }
  }

  function setup() {
    const prof = activeProfile();
    if (!prof) { location.hash = "#/spel"; return; }
    profileId = prof.id;
    ++epoch;
    const section = $("gamestage"); if (!section) return;
    section.hidden = false; section.dataset.owner = "bridge";
    active = true;
    document.documentElement.classList.add("gamestage-active");
    document.documentElement.dir = dir();
    missions = buildMissions(); missionIdx = 0; solved = [];
    renderChrome();
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", layoutScene);
    startMission();
  }

  // Schatkist aan de overkant: gaat open met een regen van munten als het personage veilig is overgestoken.
  const CHEST_SVG = MG.chestSvg;

  // ---------- DOM ----------
  function renderChrome() {
    const tt = tx();
    $("gamestage").innerHTML = `
      <div class="chase-screen">
        <header class="chase-head">
          <button id="brBack" class="g-icon-btn" aria-label="${tt.back}"><svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg></button>
          <button id="brReplay" class="chase-replay" aria-label="${tt.listen}">🔊</button>
          <div class="chase-instr"><span class="chase-instr-text">${tt.instr}</span></div>
          <button id="brHelp" class="chase-replay sling-help" aria-label="${tt.help}">💡</button>
          <div class="chase-dots" id="brDots"></div>
        </header>
        <div class="chase-field br-field" id="brField">
          <div class="br-scene" id="brScene">
            <div class="br-sky" aria-hidden="true"><span class="br-sun">☀️</span><span class="br-cloud c1">☁️</span><span class="br-cloud c2">☁️</span></div>
            <div class="br-waves" aria-hidden="true"></div>
            <span class="br-lily l1" aria-hidden="true">🪷</span><span class="br-lily l2" aria-hidden="true">🪷</span>
            <div class="br-bank br-bank-r" id="brBankR" aria-hidden="true"><span class="br-deco">🌴</span><span class="br-deco2">🪨</span><span class="br-deco3">🌼</span></div>
            <div class="br-bank br-bank-l" id="brBankL" aria-hidden="true">
              <span class="br-coins"><i></i><i></i><i></i></span>
              <span class="br-chest" id="brChest">${CHEST_SVG}</span>
              <span class="br-deco3 l">🌷</span>
            </div>
            <i class="br-post br-post-r" aria-hidden="true"></i><i class="br-post br-post-l" aria-hidden="true"></i>
            <div class="br-row" id="brRow" dir="rtl"></div>
            <div class="br-explorer" id="brExplorer"></div>
          </div>
          <div class="br-tray" id="brTray" dir="rtl"></div>
          <button id="brCross" class="chase-cta chase-cta-primary br-cross" disabled>${tt.cross} ➜</button>
        </div>
        <div class="sling-hint">${tt.hint}</div>
        <div class="chase-overlay" id="brOverlay" hidden></div>
      </div>`;
    $("brBack").onclick = () => { location.hash = MG.returnHash(); };
    $("brReplay").onclick = () => playMissionAudio();
    $("brHelp").onclick = () => onHelp();
    $("brCross").onclick = () => cross();
    updateDots();
  }
  function updateDots() {
    const el = $("brDots"); if (!el) return;
    el.innerHTML = missions.map((_, i) => `<i class="${i < solved.length ? "done" : ""}"></i>`).join("");
  }

  function letterAudio(letter) {
    const base = window.GAME && window.GAME.letterAudio ? window.GAME.letterAudio[letter] : null;
    return base ? window.AudioManager.playLearningAudio(base) : Promise.resolve(true);
  }
  function playMissionAudio() {
    const btn = $("brReplay");
    if (btn) { btn.disabled = true; btn.classList.add("is-playing"); }
    const done = () => { if (btn) { btn.disabled = false; btn.classList.remove("is-playing"); } };
    return window.AudioManager.playInstruction("missing-letter").then(done, done);
  }

  // ---------- Verloop ----------
  function startMission() {
    const m = missions[missionIdx];
    helped = false; wrongThisMission = 0; busy = false; missionStart = performance.now(); selected = null;
    slots = m.seq.map((l, i) => (m.gaps.includes(i) ? null : l));
    tray = m.tray.map((l, i) => ({ id: i, letter: l, used: false }));
    $("brHelp").classList.remove("is-used");
    render();
    resetExplorer();
    // Eerste keer: eerst de uitleg van het spel, daarna de opdracht (letter).
    if (missionIdx === 0) { const idx = missionIdx; window.AudioManager.playOnce("bridge-how").then((ok) => { if (ok !== false && active && missionIdx === idx) playMissionAudio(); }); } else playMissionAudio();
  }

  function render() {
    const m = missions[missionIdx], row = $("brRow"), trayEl = $("brTray");
    row.innerHTML = m.seq.map((l, i) => {
      const gap = m.gaps.includes(i), v = slots[i];
      if (gap && !v) return `<button class="br-plank br-gap" data-i="${i}" aria-label="gap">+</button>`;
      return `<button class="br-plank ${gap ? "br-placed" : "br-fixed"}" data-i="${i}" ${gap ? "" : "tabindex=-1"}><span lang="ar">${v}</span></button>`;
    }).join("");
    trayEl.innerHTML = tray.map((t) => `<button class="br-plank br-tray-plank ${t.used ? "is-used" : ""} ${selected === t.id ? "is-selected" : ""}" data-id="${t.id}"><span lang="ar">${t.letter}</span></button>`).join("");
    row.querySelectorAll(".br-gap").forEach((b) => { b.onclick = () => onGap(+b.dataset.i); });
    row.querySelectorAll(".br-placed").forEach((b) => { b.onclick = () => removePlank(+b.dataset.i); });
    trayEl.querySelectorAll(".br-tray-plank:not(.is-used)").forEach((b) => bindDrag(b, +b.dataset.id));
    $("brCross").disabled = busy || slots.some((v, i) => m.gaps.includes(i) && !v);
    layoutScene();
  }

  // ---------- Scène: water, oevers, personage en haai ----------
  const heroCfg = () => { try { return window.Character && Character.getConfig ? Character.getConfig(profileId) : null; } catch { return null; } };
  function heroHtml(mood) {
    const cfg = heroCfg();
    return cfg ? `<div class="br-hero">${Character.svg(cfg, mood)}</div>` : `<div class="br-hero br-hero-emoji">🧒</div>`;
  }
  const setMood = (mood) => { const ex = $("brExplorer"); if (ex) ex.innerHTML = heroHtml(mood); };
  let geo = null; // { water, top, startX, startY, endX, endY }: water = hoogte van het wateroppervlak, start = oever rechts, end = oever links
  function layoutScene() {
    const scene = $("brScene"), row = $("brRow"); if (!scene || !row) return;
    const sr = scene.getBoundingClientRect(), rr = row.getBoundingClientRect();
    if (!sr.width || !rr.width) return;
    const plank = row.querySelector(".br-plank"), pr = plank ? plank.getBoundingClientRect() : rr;
    const top = pr.top - sr.top, water = rr.bottom - sr.top + 46;
    const left = rr.left - sr.left, right = sr.right - rr.right;
    scene.style.setProperty("--water", Math.round(water) + "px");
    scene.style.setProperty("--bank-top", Math.round(top + 4) + "px");
    scene.style.setProperty("--bank-wl", Math.max(44, Math.round(left + 22)) + "px");
    scene.style.setProperty("--bank-wr", Math.max(44, Math.round(right + 22)) + "px");
    geo = {
      water, top,
      startX: Math.min(sr.width - 26, rr.right - sr.left + Math.min(70, Math.max(30, right / 2))), startY: top + 2,
      endX: Math.max(26, left - Math.min(70, Math.max(30, left / 2))), endY: top + 2,
    };
    const ex = $("brExplorer");
    if (ex && !busy && !ex.classList.contains("is-grabbed")) standAt(geo.startX, geo.startY);
  }
  function standAt(x, y) { const ex = $("brExplorer"); if (ex) { ex.style.left = x + "px"; ex.style.top = y + "px"; } }
  function resetExplorer() {
    const ex = $("brExplorer"); if (!ex) return;
    layoutScene();
    ex.className = "br-explorer";
    const chest = $("brChest"); if (chest) chest.classList.remove("open");
    ex.style.transition = "none"; ex.style.opacity = 1; setMood("idle");
    if (geo) standAt(geo.startX, geo.startY);
    requestAnimationFrame(() => { ex.style.transition = ""; });
  }
  const SHARK_SVG = `<svg viewBox="0 0 130 170" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <defs>
      <linearGradient id="brSh" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#4d6f8f"/><stop offset=".5" stop-color="#7ea2c2"/><stop offset="1" stop-color="#4d6f8f"/></linearGradient>
      <radialGradient id="brMo" cx=".5" cy=".55" r=".6"><stop offset="0" stop-color="#3a0710"/><stop offset="1" stop-color="#a1182e"/></radialGradient>
    </defs>
    <path d="M40 112 L10 166 L50 146 L65 160 L80 146 L120 166 L90 112Z" fill="#46688a" stroke="#2d4660" stroke-width="3" stroke-linejoin="round"/>
    <path d="M28 70 L2 108 L40 96Z" fill="#46688a" stroke="#2d4660" stroke-width="3" stroke-linejoin="round"/>
    <path d="M102 70 L128 108 L90 96Z" fill="#46688a" stroke="#2d4660" stroke-width="3" stroke-linejoin="round"/>
    <path d="M26 62 Q24 118 52 142 L78 142 Q106 118 104 62 Q104 6 65 6 Q26 6 26 62Z" fill="url(#brSh)" stroke="#2d4660" stroke-width="3.5" stroke-linejoin="round"/>
    <path d="M44 100 Q65 150 86 100 Q65 118 44 100Z" fill="#eef6fb"/>
    <path d="M36 104 L46 110 M36 114 L48 119 M94 104 L84 110 M94 114 L82 119" stroke="#2d4660" stroke-width="3" stroke-linecap="round"/>
    <path d="M32 40 Q65 -14 98 40 Q98 74 65 80 Q32 74 32 40Z" fill="url(#brMo)" stroke="#2d4660" stroke-width="3.5" stroke-linejoin="round"/>
    <path d="M52 62 Q65 52 78 62 Q65 74 52 62Z" fill="#e0556b"/>
    <path d="M35 36 L41 52 L47 30 L54 49 L60 24 L66 47 L72 24 L78 49 L84 30 L90 52 L95 36 Q65 8 35 36Z" fill="#fff" stroke="#2d4660" stroke-width="2" stroke-linejoin="round"/>
    <path d="M38 62 L45 48 L52 64 L59 50 L65 66 L71 50 L78 64 L85 48 L92 62 Q65 84 38 62Z" fill="#fff" stroke="#2d4660" stroke-width="2" stroke-linejoin="round"/>
    <circle cx="29" cy="30" r="9" fill="#fff" stroke="#2d4660" stroke-width="3"/><circle cx="101" cy="30" r="9" fill="#fff" stroke="#2d4660" stroke-width="3"/>
    <circle cx="31" cy="32" r="4.4" fill="#16212c"/><circle cx="99" cy="32" r="4.4" fill="#16212c"/>
    <path d="M17 17 L40 26 M113 17 L90 26" stroke="#16212c" stroke-width="5.5" stroke-linecap="round"/>
    </svg>`;
  // ---------- Geluidseffecten (zelf gemaakt met Web Audio, geen bestanden): water, hap, schreeuw, plons, munten ----------
  let actx = null;
  const audioCtx = () => {
    try {
      if (window.AudioManager && window.AudioManager.settings && !window.AudioManager.settings.sfxOn) return null;
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      if (actx.state === "suspended") actx.resume();
      return actx;
    } catch { return null; }
  };
  function noiseBurst(dur, type, f0, f1, gain, delay = 0) {
    const c = audioCtx(); if (!c) return;
    const n = Math.max(1, Math.floor(c.sampleRate * dur)), buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(), t0 = c.currentTime + delay;
    src.buffer = buf; f.type = type; f.Q.value = 1.2;
    f.frequency.setValueAtTime(f0, t0); f.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(gain, t0 + Math.min(0.06, dur / 3)); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f); f.connect(g); g.connect(c.destination); src.start(t0); src.stop(t0 + dur + 0.05);
  }
  function glide(type, f0, f1, dur, gain, delay = 0, vib = 0) {
    const c = audioCtx(); if (!c) return;
    const o = c.createOscillator(), g = c.createGain(), t0 = c.currentTime + delay;
    o.type = type; o.frequency.setValueAtTime(f0, t0); o.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
    if (vib) { const l = c.createOscillator(), lg = c.createGain(); l.frequency.value = 13; lg.gain.value = vib; l.connect(lg); lg.connect(o.frequency); l.start(t0); l.stop(t0 + dur + 0.05); }
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(gain, t0 + 0.04); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(c.destination); o.start(t0); o.stop(t0 + dur + 0.05);
  }
  const FX = {
    swoosh() { noiseBurst(0.5, "bandpass", 250, 1900, 0.2); },                       // haai breekt door het water
    chomp() { noiseBurst(0.14, "lowpass", 1400, 260, 0.45); glide("sine", 150, 55, 0.2, 0.4); }, // hap
    scream() { glide("sawtooth", 1050, 330, 0.85, 0.13, 0, 60); glide("square", 520, 165, 0.85, 0.05, 0, 30); }, // "aaaaah!" van het personage
    splash() { noiseBurst(0.75, "lowpass", 3400, 260, 0.38); noiseBurst(0.3, "highpass", 2600, 5200, 0.1, 0.05); },
    coins() { [988, 1319, 1568, 2093].forEach((f, i) => glide("triangle", f, f * 1.01, 0.28, 0.13, i * 0.1)); noiseBurst(0.35, "highpass", 5000, 9000, 0.06, 0.1); },
  };
  function openChest() {
    const scene = $("brScene"), chest = $("brChest"); if (!scene || !chest) return;
    chest.classList.add("open"); FX.coins();
    const sr = scene.getBoundingClientRect(), cr = chest.getBoundingClientRect();
    const cx = cr.left - sr.left + cr.width / 2, cy = cr.top - sr.top + cr.height * 0.35;
    for (let i = 0; i < 14; i++) {
      const c = document.createElement("span"); c.className = "br-coin"; if (i % 4 === 0) c.textContent = "✨"; else c.className = "br-coin br-coin-gold";
      c.style.left = cx + "px"; c.style.top = cy + "px";
      c.style.setProperty("--dx", Math.round((Math.random() - 0.35) * 120) + "px"); c.style.setProperty("--dy", Math.round(-50 - Math.random() * 70) + "px");
      c.style.animationDelay = (i * 40) + "ms";
      scene.appendChild(c); setTimeout(() => c.remove(), 1700);
    }
  }
  // Een verkeerde plank: de haai springt uit het water, pakt het personage en ze vallen met een plons terug in het water.
  async function sharkAttack(plank) {
    const scene = $("brScene"), ex = $("brExplorer"); if (!scene || !ex || !geo) return;
    const sr = scene.getBoundingClientRect(), pr = plank.getBoundingClientRect();
    const x = pr.left - sr.left + pr.width / 2, exY = pr.top - sr.top - 1;
    const rise = Math.max(70, geo.water - exY + 46), fall = Math.max(60, geo.water - exY + 24);
    const shark = document.createElement("div"); shark.className = "br-shark"; shark.innerHTML = SHARK_SVG;
    shark.style.left = x + "px"; shark.style.top = geo.water + "px"; shark.style.setProperty("--rise", rise + "px");
    const splash = document.createElement("div"); splash.className = "br-splash"; splash.style.left = x + "px"; splash.style.top = geo.water + "px";
    splash.innerHTML = "<i></i><i></i><i></i>";
    scene.append(shark, splash);
    setMood("surprised"); ex.style.setProperty("--fall", fall + "px");
    shark.classList.add("is-jump"); ex.classList.add("is-grabbed"); splash.classList.add("is-go");
    // geluid volgt de animatie: water, hap, schreeuw tijdens de val, plons bij het water
    const at = (ms, fn) => setTimeout(() => { if (active) fn(); }, ms);
    at(60, FX.swoosh); at(640, FX.chomp); at(720, FX.scream); at(1250, FX.splash);
    await MG.wait(1750);
    shark.remove(); splash.remove();
  }

  function selectPlank(id) {
    selected = selected === id ? null : id;
    const t = tray.find((x) => x.id === id);
    if (selected !== null && t) letterAudio(t.letter); // de letter horen bij het aanraken
    render();
  }
  function placeInto(i, id) {
    const m = missions[missionIdx], t = tray.find((x) => x.id === id);
    if (!t || t.used || !m.gaps.includes(i) || slots[i]) return;
    slots[i] = t.letter; t.used = true; selected = null; render();
  }
  function onGap(i) { if (!busy && selected !== null) placeInto(i, selected); }
  function removePlank(i) {
    if (busy) return;
    const t = tray.find((x) => x.used && x.letter === slots[i]);
    if (t) t.used = false;
    slots[i] = null; render();
  }

  // Slepen met een "geest"; een kort tikje telt als selecteren.
  function bindDrag(el, id) {
    el.onpointerdown = (e) => {
      if (busy) return;
      e.preventDefault();
      drag = { id, sx: e.clientX, sy: e.clientY, moved: false, ghost: null };
      try { el.setPointerCapture(e.pointerId); } catch {}
      el.onpointermove = (ev) => {
        if (!drag) return;
        if (!drag.moved && Math.hypot(ev.clientX - drag.sx, ev.clientY - drag.sy) < 8) return;
        if (!drag.moved) { drag.moved = true; const g = el.cloneNode(true); g.className = "br-plank br-ghost"; document.body.appendChild(g); drag.ghost = g; }
        drag.ghost.style.left = ev.clientX + "px"; drag.ghost.style.top = ev.clientY + "px";
      };
      el.onpointerup = (ev) => {
        const d = drag; drag = null; el.onpointermove = el.onpointerup = null;
        if (!d) return;
        if (d.ghost) {
          d.ghost.remove();
          const target = document.elementFromPoint(ev.clientX, ev.clientY);
          const gap = target && target.closest && target.closest(".br-gap");
          if (gap) placeInto(+gap.dataset.i, d.id); else render();
        } else selectPlank(d.id);
      };
    };
  }

  function onHelp() {
    if (!active || busy) return;
    helped = true; $("brHelp").classList.add("is-used");
    const m = missions[missionIdx];
    const gi = m.gaps.find((i) => !slots[i]);
    if (gi === undefined) return;
    const t = tray.find((x) => !x.used && x.letter === m.seq[gi]);
    const trayEl = $("brTray"), row = $("brRow");
    if (t) { const b = trayEl.querySelector(`[data-id="${t.id}"]`); if (b) b.classList.add("is-help"); }
    const g = row.querySelector(`.br-gap[data-i="${gi}"]`); if (g) g.classList.add("is-help");
    playMissionAudio();
  }

  async function cross() {
    if (!active || busy) return;
    const m = missions[missionIdx], field = $("brField");
    busy = true; render();
    const row = $("brRow"), ex = $("brExplorer");
    const planks = [...row.querySelectorAll(".br-plank")];
    const place = (p) => { const r = p.getBoundingClientRect(), sc = ex.parentElement.getBoundingClientRect(); ex.style.left = (r.left - sc.left + r.width / 2) + "px"; ex.style.top = (r.top - sc.top - 1) + "px"; };
    resetExplorer(); // het personage staat op de oever rechts
    await MG.wait(350); setMood("happy");
    const myEpoch = epoch;
    let badIndex = -1;
    for (let i = 0; i < m.seq.length; i++) {
      if (!active || myEpoch !== epoch) return;
      place(planks[i]);
      const right = slots[i] === m.seq[i];
      await Promise.all([MG.wait(900), letterAudio(slots[i] || m.seq[i])]);
      await MG.wait(220); // even ademruimte: de letter klinkt helemaal uit voor de volgende plank
      if (!right) { badIndex = i; break; }
      planks[i].classList.add("is-ok");
    }
    if (badIndex < 0 && geo) { setMood("celebrate"); standAt(geo.endX, geo.endY); await MG.wait(850); openChest(); await MG.wait(700); } // veilig aan de overkant: de schatkist gaat open
    const gapLetters = m.gaps.map((i) => m.seq[i]);
    const wrongLetter = badIndex >= 0 ? slots[badIndex] : null;
    recordAttempt(profileId, {
      game: "bridge", target: badIndex >= 0 ? m.seq[badIndex] : gapLetters[0], selectedLetter: wrongLetter || gapLetters[0], correct: badIndex < 0, helped,
      mission: missionIdx + 1, gaps: m.gaps.length, responseTimeMs: Math.round(performance.now() - missionStart), timestamp: Date.now(),
    });
    if (badIndex < 0) {
      solved.push({ helped, wrong: wrongThisMission });
      updateDots();
      MG.sfx("ok");
      MG.banner(field, { ok: true, letter: m.seq[m.seq.length - 1] });
      const finished = missionIdx + 1 >= missions.length;
      await MG.wait(400); await window.AudioManager.playRandomCorrectFeedback(); await MG.wait(1100);
      MG.hideBanner(field);
      if (!active) return;
      if (finished) complete(); else { missionIdx++; startMission(); }
    } else {
      wrongThisMission++;
      planks[badIndex].classList.add("is-bad");
      MG.sfx("no");
      await sharkAttack(planks[badIndex]);
      MG.banner(field, { ok: false, letter: wrongLetter });
      await MG.wait(700);
      await window.AudioManager.playRandomRetryFeedback(); await MG.wait(300);
      MG.hideBanner(field);
      if (!active) return;
      // De foute plank gaat terug naar de bak; de rest blijft staan.
      const t = tray.find((x) => x.used && x.letter === wrongLetter); if (t) t.used = false;
      slots[badIndex] = null;
      busy = false; render(); resetExplorer(); // het personage klimt weer op de oever rechts
      ex.classList.add("is-back"); setTimeout(() => ex.classList.remove("is-back"), 900);
      playMissionAudio();
    }
  }

  function complete() {
    MG.finish($("brOverlay"), {
      pid: profileId, level: MG.currentLevel(profileId), stars: solved.filter((s) => !s.helped).length,
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
  if (DEBUG) window.Bridge = { get missions() { return missions; }, get slots() { return slots; }, get tray() { return tray; } };
})();
