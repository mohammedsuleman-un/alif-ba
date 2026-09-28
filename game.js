// Spelmodus: kinderprofielen, werelden/levelkaart, oefen-engine, XP/sterren/coins.
// Alles lokaal op het toestel (geen account, geen server) — later eenvoudig te vervangen
// door een echte backend zonder dat de rest van de engine hoeft te veranderen.
(() => {
  "use strict";

  const G = window.GAME;
  const $ = (id) => document.getElementById(id);
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const shuffle = (arr) => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const pick = (arr, n) => shuffle(arr).slice(0, n);

  // ---------- Taal (deelt de taalkeuze met de boekmodus) ----------
  const store = {
    get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  };
  const AVATARS = ["🦁", "🐪", "🦋", "🐢", "🦅", "🐬", "🐿️", "🦜"];
  const GI18N = {
    ar: { dir: "rtl", who: "من يلعب اليوم؟", newProfile: "ملف جديد", namePlaceholder: "اسمك",
      create: "ابدأ", world: (n) => `دروس ${n}`, level: "المستوى", locked: "مقفل", start: "ابدأ",
      play: "العب", back: "رجوع", listen: "استمع", chooseSound: "اضغط على الحرف الذي سمعته",
      chooseMatch: "اضغط على نفس الحرف", pairs: "اضغط على الزوج المتطابق",
      correct: ["أحسنت!", "ما شاء الله!", "ممتاز!", "رائع!"], tryAgain: "بالقرب! حاول مرة أخرى",
      levelDone: "أتممت المستوى!", newLetter: "حرف جديد", next: "المستوى التالي", toMap: "الخريطة",
      xp: "نقطة خبرة", coins: "قطع", badgeEarned: "وسام جديد!", switchProfile: "تبديل الملف",
      bookMode: "الكتاب", gameMode: "اللعبة", challenge: "تحدٍّ",
      levelsProgress: (d, n) => `${d} من ${n} مستوى`, discover: (l) => `اكتشف ${l}`,
      checkpointTitle: "محطة استراحة", checkpointReward: (n) => `+${n} 🪙`, claim: "افتح",
      worldDone: "أتممتِ الواحة!", nextWorldSoon: "عالم جديد قريبًا…",
      voiceOn: "إيقاف الإرشاد الصوتي", voiceOff: "تشغيل الإرشاد الصوتي",
      sfxOn: "إيقاف المؤثرات الصوتية", sfxOff: "تشغيل المؤثرات الصوتية",
    },
    nl: { dir: "ltr", who: "Wie speelt er?", newProfile: "Nieuw profiel", namePlaceholder: "Jouw naam",
      create: "Beginnen", world: (n) => `Wereld ${n}`, level: "Level", locked: "Op slot", start: "Start",
      play: "Spelen", back: "Terug", listen: "Luister", chooseSound: "Tik op de letter die je hoorde",
      chooseMatch: "Tik op dezelfde letter", pairs: "Tik op het bijpassende paar",
      correct: ["Goed zo!", "MashaAllah!", "Uitstekend!", "Knap gedaan!"], tryAgain: "Bijna! Probeer nog eens",
      levelDone: "Level voltooid!", newLetter: "Nieuwe letter", next: "Volgend level", toMap: "Kaart",
      xp: "XP", coins: "munten", badgeEarned: "Nieuwe badge!", switchProfile: "Profiel wisselen",
      bookMode: "Boek", gameMode: "Spel", challenge: "Uitdaging",
      levelsProgress: (d, n) => `${d} van ${n} levels`, discover: (l) => `Ontdek de ${l}`,
      checkpointTitle: "Rustplek", checkpointReward: (n) => `+${n} 🪙`, claim: "Open",
      worldDone: "Wereld voltooid!", nextWorldSoon: "Volgende wereld komt eraan…",
      voiceOn: "Gesproken instructies uitzetten", voiceOff: "Gesproken instructies aanzetten",
      sfxOn: "Geluidseffecten uitzetten", sfxOff: "Geluidseffecten aanzetten",
    },
    en: { dir: "ltr", who: "Who's playing?", newProfile: "New profile", namePlaceholder: "Your name",
      create: "Start", world: (n) => `World ${n}`, level: "Level", locked: "Locked", start: "Start",
      play: "Play", back: "Back", listen: "Listen", chooseSound: "Tap the letter you heard",
      chooseMatch: "Tap the matching letter", pairs: "Tap the matching pair",
      correct: ["Well done!", "MashaAllah!", "Excellent!", "Great job!"], tryAgain: "Almost! Try again",
      levelDone: "Level complete!", newLetter: "New letter", next: "Next level", toMap: "Map",
      xp: "XP", coins: "coins", badgeEarned: "New badge!", switchProfile: "Switch profile",
      bookMode: "Book", gameMode: "Game", challenge: "Challenge",
      levelsProgress: (d, n) => `${d} of ${n} levels`, discover: (l) => `Discover ${l}`,
      checkpointTitle: "Rest stop", checkpointReward: (n) => `+${n} 🪙`, claim: "Open",
      worldDone: "World complete!", nextWorldSoon: "Next world coming soon…",
      voiceOn: "Turn off spoken instructions", voiceOff: "Turn on spoken instructions",
      sfxOn: "Turn off sound effects", sfxOff: "Turn on sound effects",
    },
  };
  const glang = () => (I18N_LANG_OK() ? store.get("lang", "nl") : "nl");
  // De boekmodus (app.js) beheert `lang` al; we lezen 'm alleen uit.
  function I18N_LANG_OK() { return !!GI18N[store.get("lang", "nl")]; }
  const GT = () => GI18N[glang()] || GI18N.nl;
  const gsub = (obj) => (glang() === "ar" ? obj.ar : obj[glang()] || obj.ar);

  // ---------- Profielen ----------
  const profiles = {
    all() { return store.get("gp_profiles", []); },
    save(list) { store.set("gp_profiles", list); },
    active() { return store.get("gp_active", null); },
    setActive(id) { store.set("gp_active", id); },
    create(name, avatar) {
      const list = profiles.all();
      const p = { id: "p" + Date.now().toString(36), name, avatar, createdAt: Date.now() };
      list.push(p);
      profiles.save(list);
      profiles.setActive(p.id);
      return p;
    },
    get(id) { return profiles.all().find((p) => p.id === id) || null; },
  };

  const defaultState = () => ({ xp: 0, coins: 0, mastery: {}, levels: {}, badges: [], lastActivity: null });
  const gstate = {
    key(pid) { return `gp_state_${pid}`; },
    load(pid) { return store.get(gstate.key(pid), defaultState()); },
    save(pid, s) { store.set(gstate.key(pid), s); },
  };

  let activeProfile = null;
  let state = null;

  function loadActive() {
    const id = profiles.active();
    activeProfile = id ? profiles.get(id) : null;
    state = activeProfile ? gstate.load(activeProfile.id) : null;
  }

  function isLevelUnlocked(world, idx) {
    if (idx === 0) return true;
    const prev = world.levels[idx - 1];
    return !!(state.levels[levelId(world, prev)]);
  }
  const levelId = (world, level) => `${world.id}_l${level.n}`;
  const levelStars = (world, level) => (state.levels[levelId(world, level)] || {}).stars || 0;

  function updateMastery(letter, correct) {
    const cur = state.mastery[letter] ?? 50;
    state.mastery[letter] = Math.max(0, Math.min(100, cur + (correct ? 6 : -10)));
  }
  function weakLetters(pool, n) {
    return [...pool].sort((a, b) => (state.mastery[a] ?? 50) - (state.mastery[b] ?? 50)).slice(0, n);
  }

  // ---------- Audio ----------
  // Leeraudio (Arabische letteruitspraak) en gesproken instructies lopen allebei
  // via de gedeelde AudioManager (audio-manager.js), zodat ze nooit tegelijk
  // spelen. `playLetter` blijft bestaan als klein gemaksfunctie voor de rest
  // van dit bestand.
  function playLetter(letter, onEnd) {
    AudioManager.playLearningAudio(G.letterAudio[letter]).then((ok) => onEnd && onEnd(ok));
  }

  // ---------- Geluidseffecten (zelf gegenereerd, geen gedownloade bestanden) ----------
  // Kleine natuurlijk klinkende toontjes via de Web Audio API: vogelachtig getjilp
  // bij een goed antwoord, een zachte "oeps" bij fout, en een klein vreugdedeuntje
  // bij het voltooien van een level. Nooit hard/schrikkerig.
  let actx = null;
  function audioCtx() {
    if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; } }
    if (actx.state === "suspended") actx.resume().catch(() => {});
    return actx;
  }
  function tone(ctx, t0, freq, dur, { type = "sine", gain = 0.18, glideTo = null } = {}) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, t0 + dur);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + 0.015);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(g).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }
  const sfx = {
    correct() {
      if (!AudioManager.settings.sfxOn) return;
      const ctx = audioCtx(); if (!ctx) return;
      const t0 = ctx.currentTime;
      // Twee korte, oplopende "vogel-tjilpjes".
      tone(ctx, t0, 1500, 0.09, { type: "sine", glideTo: 2100, gain: 0.15 });
      tone(ctx, t0 + 0.1, 1800, 0.11, { type: "sine", glideTo: 2500, gain: 0.15 });
    },
    wrong() {
      if (!AudioManager.settings.sfxOn) return;
      const ctx = audioCtx(); if (!ctx) return;
      const t0 = ctx.currentTime;
      // Zachte, dalende "boe" — geen hard/eng geluid.
      tone(ctx, t0, 330, 0.24, { type: "sine", glideTo: 220, gain: 0.12 });
    },
    levelComplete() {
      if (!AudioManager.settings.sfxOn) return;
      const ctx = audioCtx(); if (!ctx) return;
      const t0 = ctx.currentTime;
      [660, 880, 1100, 1320].forEach((f, i) => tone(ctx, t0 + i * 0.11, f, 0.22, { type: "triangle", gain: 0.14 }));
    },
    tap() {
      if (!AudioManager.settings.sfxOn) return;
      const ctx = audioCtx(); if (!ctx) return;
      tone(ctx, ctx.currentTime, 700, 0.05, { type: "sine", gain: 0.08 });
    },
  };

  // ---------- Begeleidend diertje (eigen ontwerp: woestijnvosje) ----------
  // Reageert blij/verdrietig mee met het antwoord van het kind. Zuiver decoratief,
  // raakt de spellogica niet aan.
  const FOX = {
    idle: `<svg viewBox="0 0 100 90"><g>
        <path d="M20 55C10 40 14 18 28 10 30 22 34 30 40 34Z" fill="#e8a463"/>
        <path d="M80 55C90 40 86 18 72 10 70 22 66 30 60 34Z" fill="#e8a463"/>
        <path d="M22 56C12 42 16 22 28 14 30 24 34 31 40 35Z" fill="#fbeadb"/>
        <path d="M78 56C88 42 84 22 72 14 70 24 66 31 60 35Z" fill="#fbeadb"/>
        <ellipse cx="50" cy="55" rx="34" ry="30" fill="#f0b57e"/>
        <ellipse cx="50" cy="62" rx="18" ry="15" fill="#fbeadb"/>
        <circle cx="38" cy="50" r="4.2" fill="#3a2a1e"/>
        <circle cx="62" cy="50" r="4.2" fill="#3a2a1e"/>
        <path d="M46 63q4 4 8 0" stroke="#3a2a1e" stroke-width="2.4" fill="none" stroke-linecap="round"/>
        <ellipse cx="50" cy="58" rx="3" ry="2.2" fill="#3a2a1e"/>
      </g></svg>`,
    happy: `<svg viewBox="0 0 100 90"><g>
        <path d="M18 50C6 33 12 12 28 6 29 20 34 28 41 32Z" fill="#e8a463"/>
        <path d="M82 50C94 33 88 12 72 6 71 20 66 28 59 32Z" fill="#e8a463"/>
        <path d="M20 51C9 35 14 16 28 10 29 22 33 29 41 33Z" fill="#fbeadb"/>
        <path d="M80 51C91 35 86 16 72 10 71 22 67 29 59 33Z" fill="#fbeadb"/>
        <ellipse cx="50" cy="53" rx="35" ry="31" fill="#f0b57e"/>
        <ellipse cx="50" cy="61" rx="19" ry="16" fill="#fbeadb"/>
        <path d="M32 47q6 -7 12 0" stroke="#3a2a1e" stroke-width="2.6" fill="none" stroke-linecap="round"/>
        <path d="M56 47q6 -7 12 0" stroke="#3a2a1e" stroke-width="2.6" fill="none" stroke-linecap="round"/>
        <path d="M40 61q10 10 20 0" stroke="#3a2a1e" stroke-width="2.6" fill="none" stroke-linecap="round"/>
        <ellipse cx="50" cy="56" rx="3" ry="2.2" fill="#3a2a1e"/>
        <circle cx="30" cy="60" r="4" fill="#f4a2a2" opacity=".6"/><circle cx="70" cy="60" r="4" fill="#f4a2a2" opacity=".6"/>
      </g></svg>`,
    sad: `<svg viewBox="0 0 100 90"><g>
        <path d="M22 58C13 46 15 26 28 18 29 28 33 35 39 39Z" fill="#e8a463"/>
        <path d="M78 58C87 46 85 26 72 18 71 28 67 35 61 39Z" fill="#e8a463"/>
        <ellipse cx="50" cy="58" rx="33" ry="28" fill="#f0b57e"/>
        <ellipse cx="50" cy="64" rx="17" ry="14" fill="#fbeadb"/>
        <path d="M34 55q4 -3 8 0" stroke="#3a2a1e" stroke-width="2.4" fill="none" stroke-linecap="round"/>
        <path d="M58 55q4 -3 8 0" stroke="#3a2a1e" stroke-width="2.4" fill="none" stroke-linecap="round"/>
        <path d="M44 68q6 -4 12 0" stroke="#3a2a1e" stroke-width="2.4" fill="none" stroke-linecap="round"/>
        <ellipse cx="50" cy="60" rx="3" ry="2.2" fill="#3a2a1e"/>
        <path d="M36 58q-1 8 -3 11" stroke="#7cc7e8" stroke-width="3" fill="none" stroke-linecap="round"/>
      </g></svg>`,
  };
  let companionTimer;
  function companionMood(mood, holdMs) {
    const el = document.getElementById("gCompanion");
    if (!el) return;
    el.innerHTML = FOX[mood] || FOX.idle;
    el.className = "g-companion mood-" + mood;
    clearTimeout(companionTimer);
    if (holdMs) companionTimer = setTimeout(() => companionMood("idle"), holdMs);
  }
  function companionHtml(extraClass) {
    return `<div id="gCompanion" class="g-companion ${extraClass || ""}">${FOX.idle}</div>`;
  }

  // ---------- Scherm-elementen ----------
  const scr = {
    root: $("game"), profile: $("gProfile"), map: $("gMap"), level: $("gLevel"), complete: $("gComplete"),
  };

  function showScreen(name) {
    ["profile", "map", "level", "complete"].forEach((k) => { scr[k].hidden = k !== name; });
  }

  // ---------- Profielscherm ----------
  let welcomedThisSession = false;
  function renderProfile() {
    const t = GT();
    document.documentElement.dir = t.dir;
    if (!welcomedThisSession) { welcomedThisSession = true; AudioManager.playInstruction("welcome"); }
    const list = profiles.all();
    scr.profile.innerHTML = `
      <div class="g-profile-head">
        <a href="#/" class="g-back-book">🏠</a>
      </div>
      <h2 class="g-who">${t.who}</h2>
      <div class="g-profiles" id="gProfileList"></div>
      <button id="gAddProfile" class="g-add">+ ${t.newProfile}</button>
      <div id="gNewProfileForm" class="g-new-form" hidden>
        <div class="g-avatars">${AVATARS.map((a) => `<button type="button" class="g-avatar-pick" data-a="${a}">${a}</button>`).join("")}</div>
        <input id="gNewName" maxlength="16" placeholder="${t.namePlaceholder}">
        <button id="gCreateProfile" class="g-cta">${t.create}</button>
      </div>`;
    const listEl = $("gProfileList");
    list.forEach((p) => {
      const b = el("button", "g-profile-card", `<span class="g-avatar">${p.avatar}</span><span class="g-pname">${p.name}</span>`);
      b.onclick = () => { profiles.setActive(p.id); loadActive(); gohash("#/spel/wereld/letter_oasis"); };
      listEl.appendChild(b);
    });
    let chosenAvatar = AVATARS[0];
    $("gAddProfile").onclick = () => { $("gNewProfileForm").hidden = false; $("gAddProfile").hidden = true; };
    scr.profile.querySelectorAll(".g-avatar-pick").forEach((b) => (b.onclick = () => {
      scr.profile.querySelectorAll(".g-avatar-pick").forEach((x) => x.classList.remove("sel"));
      b.classList.add("sel"); chosenAvatar = b.dataset.a;
    }));
    $("gCreateProfile").onclick = () => {
      const name = $("gNewName").value.trim();
      if (!name) { $("gNewName").focus(); return; }
      profiles.create(name, chosenAvatar);
      loadActive();
      gohash("#/spel/wereld/letter_oasis");
    };
  }

  // ---------- Werelkaart ----------
  // ---------- Werelkaart: geïllustreerd, kronkelend avonturenpad ----------
  // Layout-geometrie (in dezelfde eenheden als de SVG-viewBox, dus 0-100 breed).
  const MAP_ROWH = 236, MAP_TOP = 140, MAP_BOT = 190, MAP_AMP = 27;
  const nodeX = (i) => 50 + Math.sin(i * 1.05 + 0.4) * MAP_AMP;
  const nodeY = (i) => MAP_TOP + i * MAP_ROWH;

  function smoothPath(pts) {
    if (pts.length < 2) return "";
    let d = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i], p1 = pts[i + 1];
      const mx = (p0.x + p1.x) / 2, my = (p0.y + p1.y) / 2;
      d += ` Q ${p0.x} ${p0.y} ${mx} ${my}`;
    }
    const last = pts[pts.length - 1];
    d += ` T ${last.x} ${last.y}`;
    return d;
  }

  // Kleine, herbruikbare SVG-decoraties (geen foto's, geen emoji als hoofdstijl).
  const ICON = {
    palm: `<svg viewBox="0 0 60 80"><path d="M30 80V40" stroke="#6b4a26" stroke-width="5" stroke-linecap="round" fill="none"/>
      <g fill="#3f6b3a"><path d="M30 40C18 30 6 32 2 24 14 20 24 26 30 40Z"/><path d="M30 40C42 30 54 32 58 24 46 20 36 26 30 40Z"/>
      <path d="M30 40C22 26 22 14 14 8 24 6 32 18 30 40Z"/><path d="M30 40C38 26 38 14 46 8 36 6 28 18 30 40Z"/>
      <path d="M30 40C30 24 30 12 30 4 22 10 24 26 30 40Z"/></g></svg>`,
    dune: `<svg viewBox="0 0 200 60" preserveAspectRatio="none"><path d="M0 60V30C40 5 80 45 130 22 160 10 180 25 200 18V60Z" fill="currentColor"/></svg>`,
    cloud: `<svg viewBox="0 0 80 40"><path d="M14 32C4 32 0 25 6 19 4 10 16 4 24 10 30 2 46 4 48 14 58 12 64 22 56 29 58 34 52 38 46 36H14Z" fill="#fff" opacity=".8"/></svg>`,
    star: `<svg viewBox="0 0 20 20"><path d="M10 0l2.4 7.2H20l-6 4.4 2.3 7.4L10 14.6 3.7 19l2.3-7.4-6-4.4h7.6z" fill="#ffe08a"/></svg>`,
    lantern: `<svg viewBox="0 0 30 46"><path d="M9 6h12l-3-6H12z" fill="#8a6218"/><rect x="6" y="6" width="18" height="26" rx="6" fill="#f2b23c"/>
      <rect x="10" y="12" width="10" height="14" rx="3" fill="#fff4d6" opacity=".85"/><path d="M12 32h6v4h-6z" fill="#8a6218"/>
      <path d="M9 40h12" stroke="#8a6218" stroke-width="3" stroke-linecap="round"/></svg>`,
    arch: `<svg viewBox="0 0 60 70"><path d="M4 70V34C4 14 14 4 30 4S56 14 56 34V70" fill="none" stroke="#c99a3c" stroke-width="4"/>
      <path d="M4 70V34C4 14 14 4 30 4S56 14 56 34V70" fill="#fff8e3" opacity=".18"/></svg>`,
    water: `<svg viewBox="0 0 160 50"><ellipse cx="80" cy="25" rx="78" ry="22" fill="#3f8f8a"/><ellipse cx="80" cy="20" rx="60" ry="14" fill="#5bb9b3" opacity=".7"/></svg>`,
    bush: `<svg viewBox="0 0 40 26"><g fill="#4c7a3f"><circle cx="10" cy="16" r="10"/><circle cx="24" cy="12" r="12"/><circle cx="34" cy="18" r="8"/></g></svg>`,
    rock: `<svg viewBox="0 0 50 26"><path d="M2 26 8 10 20 4 34 8 48 26Z" fill="#a89380"/></svg>`,
    chest: `<svg viewBox="0 0 48 40"><rect x="4" y="16" width="40" height="22" rx="4" fill="#c99a3c"/><rect x="4" y="16" width="40" height="8" fill="#8a6218"/>
      <path d="M4 18C4 8 44 8 44 18" fill="none" stroke="#8a6218" stroke-width="4"/><circle cx="24" cy="27" r="3" fill="#5c3c17"/></svg>`,
    gate: `<svg viewBox="0 0 160 140"><path d="M10 140V60C10 20 40 4 80 4S150 20 150 60V140" fill="#fff8e3" stroke="#c99a3c" stroke-width="5"/>
      <path d="M35 140V70C35 40 55 26 80 26S125 40 125 70V140" fill="none" stroke="#c99a3c" stroke-width="4"/>
      <circle cx="80" cy="20" r="7" fill="#ffe08a"/></svg>`,
    flower: `<svg viewBox="0 0 40 60"><path d="M20 60V30" stroke="#4c7a3f" stroke-width="4" stroke-linecap="round" fill="none"/>
      <g fill="#e98fb0"><circle cx="20" cy="12" r="7"/><circle cx="10" cy="18" r="7"/><circle cx="30" cy="18" r="7"/>
      <circle cx="13" cy="27" r="7"/><circle cx="27" cy="27" r="7"/></g><circle cx="20" cy="20" r="6" fill="#f2c94c"/></svg>`,
  };
  const deco = (icon, cls, style) => `<div class="g-deco ${cls || ""}" style="${style}">${ICON[icon]}</div>`;

  // Decoratie per 'zone': begin van de woestijn → oase → verte → finale.
  function zoneDecorations(i, x, y, theme) {
    const items = [];
    const far = x < 50 ? "right" : "left"; // decoratie aan de andere kant van het pad
    const near = x < 50 ? "left" : "right";
    const garden = theme === "garden";
    const duneColor = garden ? "#c9d98a" : "#e7c98a";
    const duneColor2 = garden ? "#b9cf78" : "#d9c48f";
    const waterColor = garden ? "#5bb9b3" : "#3f8f8a";
    const filler = () => (garden ? deco("flower", "g-deco-sm", `top:${y - 45}px;${near}:20%`) : "");
    // Scène A (1-3): begin van de reis — duinen, enkele planten, eerste palmboom.
    if (i === 0) items.push(deco("dune", "g-deco-dune", `top:${y - 60}px;left:0;width:100%;color:${duneColor}`));
    if (i === 1) items.push(deco("bush", "g-deco-sm", `top:${y - 60}px;${far}:8%`), deco("rock", "g-deco-sm", `top:${y + 70}px;${near}:4%`), filler());
    if (i === 2) items.push(deco("palm", "g-deco-lg", `top:${y - 150}px;${far}:6%`), deco("bush", "g-deco-xs", `top:${y + 40}px;${far}:22%`));
    // Scène B (4-7): de oase/vijver — groter water, meerdere planten, rustpaviljoen bij het checkpoint.
    if (i === 3) items.push(deco("rock", "g-deco-md", `top:${y - 50}px;${far}:10%`), deco("lantern", "g-deco-md sway", `top:${y - 110}px;${near}:16%`), filler());
    if (i === 4) items.push(
      deco("water", "g-deco-oasis", `top:${y + 60}px;left:50%;transform:translateX(-50%);color:${waterColor}`),
      deco(garden ? "flower" : "palm", "g-deco-xl", `top:${y - 30}px;left:2%`),
      deco(garden ? "flower" : "palm", "g-deco-lg", `top:${y + 10}px;right:4%`)
    );
    if (i === 5) items.push(deco("dune", "g-deco-dune", `top:${y - 40}px;left:0;width:100%;color:${duneColor2}`), deco("arch", "g-deco-lg", `top:${y - 190}px;${far}:4%`));
    if (i === 6) items.push(deco("lantern", "g-deco-md sway", `top:${y - 120}px;${far}:14%`), deco("star", "g-deco-sm twinkle", `top:${y - 190}px;${near}:22%`), deco("bush", "g-deco-sm", `top:${y + 60}px;${near}:8%`));
    // Scène C (8-10): de bestemming — rijker groen, sterren, de poort komt in zicht.
    if (i === 7) items.push(deco("palm", "g-deco-lg", `top:${y - 150}px;${near}:14%`), deco("lantern", "g-deco-sm sway", `top:${y - 60}px;${far}:10%`), filler());
    if (i === 8) items.push(
      deco("star", "g-deco-sm twinkle", `top:${y - 160}px;left:16%`),
      deco("star", "g-deco-xs twinkle", `top:${y - 210}px;right:20%`),
      deco("lantern", "g-deco-md sway", `top:${y - 90}px;${far}:8%`),
      deco("palm", "g-deco-md", `top:${y - 40}px;${near}:10%`)
    );
    return items.join("");
  }

  function nodeInner(t, lv, unlocked, current, stars) {
    const bigLetter = lv.letters.length === 1 ? lv.letters[0] : null;
    const content = bigLetter
      ? `<span class="g-node-letter" lang="ar">${bigLetter}</span>`
      : `<span class="g-node-n-big">${lv.n}</span>`;
    if (!unlocked) return `${content}<span class="g-node-lock">🔒</span>`;
    return `
      ${content}
      ${lv.challenge ? `<span class="g-node-trophy">🏆</span>` : ""}
      ${current ? `<span class="g-node-pulse" aria-hidden="true"></span><span class="g-node-sparkle">✨</span>` : ""}`;
  }

  function renderMap(worldId) {
    const t = GT();
    document.documentElement.dir = t.dir;
    const world = G.worlds.find((w) => w.id === worldId) || G.worlds[0];
    const levels = world.levels;
    const doneCount = levels.filter((lv) => state.levels[levelId(world, lv)]).length;
    const currentIdx = Math.min(doneCount, levels.length - 1);
    const totalStars = Object.values(state.levels).reduce((s, l) => s + (l.stars || 0), 0);
    const cpId = `${world.id}_cp5`;
    const cpClaimed = (state.checkpoints || []).includes(cpId);
    const cpUnlocked = !!state.levels[levelId(world, levels[4])];

    // Coördinaten van elk level + eventueel het checkpoint (tussen level 5 en 6).
    const pts = levels.map((lv, i) => ({ x: nodeX(i), y: nodeY(i), lv, i }));
    const cpPoint = { x: nodeX(4.5), y: (nodeY(4) + nodeY(5)) / 2 };
    const sceneH = MAP_TOP + (levels.length - 1) * MAP_ROWH + MAP_BOT;
    const pathPts = [...pts.slice(0, 5).map((p) => ({ x: p.x, y: p.y })), cpPoint, ...pts.slice(5).map((p) => ({ x: p.x, y: p.y }))];
    // Kleine "stapstenen" tussen de knopen, verdeeld over elk padsegment (rechte interpolatie volstaat visueel).
    const stones = [];
    for (let i = 0; i < pathPts.length - 1; i++) {
      const a = pathPts[i], b = pathPts[i + 1];
      for (let s = 1; s <= 3; s++) {
        const f = s / 4;
        stones.push({ x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f });
      }
    }

    scr.map.innerHTML = `
      <div class="g-map-head g-theme-${world.theme}">
        <button id="gSwitchProfile" class="g-icon-btn" aria-label="${t.switchProfile}">${activeProfile.avatar}</button>
        <div class="g-map-title">
          <span class="g-map-ar" lang="ar" dir="rtl">${world.title.ar}</span>
          <span class="g-map-sub">${gsub(world.subtitle)}</span>
        </div>
        <div class="g-stats">
          <span>${t.levelsProgress(doneCount, levels.length)}</span>
          <span>⭐ ${totalStars} · 🪙 ${state.coins}</span>
        </div>
      </div>
      <div class="g-scene-wrap" data-theme="${world.theme}">
        <div class="g-scene" id="gScene" style="height:${sceneH}px">
          <svg class="g-route" viewBox="0 0 100 ${sceneH}" preserveAspectRatio="none" aria-hidden="true">
            <path d="${smoothPath(pathPts)}" class="g-route-line" />
            <path d="${smoothPath(pathPts)}" class="g-route-line-inner" />
          </svg>
          ${stones.map((s) => `<div class="g-stone" style="left:${s.x}%; top:${s.y}px"></div>`).join("")}
          <div class="g-cloud g-cloud-a">${ICON.cloud}</div>
          <div class="g-cloud g-cloud-b">${ICON.cloud}</div>
          ${pts.map((p) => zoneDecorations(p.i, p.x, p.y, world.theme)).join("")}
          <div class="g-gate" style="top:${sceneH - 40}px">${ICON.gate}</div>

          <button class="g-cp ${cpUnlocked ? "" : "locked"} ${cpClaimed ? "done" : ""}" id="gCheckpoint"
            style="left:${cpPoint.x}%; top:${cpPoint.y}px" ${cpUnlocked && !cpClaimed ? "" : "disabled"}
            aria-label="${t.checkpointTitle}">
            ${cpClaimed ? "✅" : cpUnlocked ? ICON.chest : "🔒"}
          </button>

          ${pts.map((p) => {
            const unlocked = isLevelUnlocked(world, p.i);
            const stars = levelStars(world, p.lv);
            const isCurrent = unlocked && p.i === currentIdx && stars === 0;
            const label = gsub(p.lv.title);
            return `
            <div class="g-node2 ${p.i % 2 ? "side-r" : "side-l"} ${p.lv.challenge ? "is-challenge" : ""}" style="left:${p.x}%; top:${p.y}px">
              <button class="g-node-btn2 ${unlocked ? "on" : "locked"} ${isCurrent ? "current" : ""} ${stars ? "completed" : ""}"
                data-n="${p.lv.n}" aria-label="${t.level} ${p.lv.n}${unlocked ? ": " + label : ": " + t.locked}">
                ${nodeInner(t, p.lv, unlocked, isCurrent, stars)}
              </button>
              <span class="g-node-num">${p.lv.n}</span>
              ${unlocked ? `<div class="g-node-stars2">${"★".repeat(stars)}${"☆".repeat(3 - stars)}</div>` : ""}
              ${isCurrent ? `<div class="g-node-flag">${t.play} →</div>` : ""}
            </div>`;
          }).join("")}
        </div>
      </div>`;

    $("gSwitchProfile").onclick = () => gohash("#/spel");
    scr.map.querySelectorAll(".g-node-btn2.on").forEach((b) => {
      b.onclick = () => gohash(`#/spel/level/${world.id}/${b.dataset.n}`);
    });
    const cpBtn = $("gCheckpoint");
    if (cpBtn) cpBtn.onclick = () => {
      if (!cpUnlocked || cpClaimed) return;
      state.checkpoints = [...(state.checkpoints || []), cpId];
      state.coins += 20;
      gstate.save(activeProfile.id, state);
      toast(t.checkpointReward(20));
      renderMap(worldId);
    };

    // Scroll naar het huidige level — direct bij een schermlezer/reduced-motion, anders zacht.
    const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
    requestAnimationFrame(() => {
      const target = scr.map.querySelector(`.g-node-btn2[data-n="${levels[currentIdx].n}"]`);
      target?.scrollIntoView({ block: "center", behavior: reduceMotion ? "auto" : "smooth" });
    });
  }

  // ---------- Level: vraag-generators ----------
  function buildQuestions(world, level) {
    const pool = world.letters;
    // Bij een nieuwe letter: die + een paar willekeurige herhalingsletters.
    // Bij een puur herhalingslevel: alle herhalingsletters, zodat er niets wordt overgeslagen.
    // Letters waar het kind meer moeite mee heeft komen wat vaker terug.
    const reviewPart = level.letters.length
      ? pick(level.review, Math.min(level.review.length, 3))
      : weakLetters(level.review, level.review.length);
    const focus = [...level.letters, ...reviewPart];
    const targets = [];
    while (targets.length < level.count) {
      const src = level.letters.length && targets.length < level.letters.length ? level.letters : (focus.length ? focus : pool);
      targets.push(src[targets.length % src.length] || pool[(Math.random() * pool.length) | 0]);
    }
    const types = level.types;
    return shuffle(targets).map((letter, i) => ({
      type: types[i % types.length],
      letter,
      options: shuffle([letter, ...pick(pool.filter((l) => l !== letter), 3)]),
    }));
  }

  let runState = null; // { world, level, questions, i, correctFirstTry, newLetterShown }

  function renderLevel(worldId, levelN) {
    const t = GT();
    document.documentElement.dir = t.dir;
    const world = G.worlds.find((w) => w.id === worldId) || G.worlds[0];
    const level = world.levels.find((lv) => lv.n === Number(levelN));
    if (!level) return gohash(`#/spel/wereld/${world.id}`);
    runState = { world, level, questions: buildQuestions(world, level), i: 0, correctFirstTry: 0, attemptedFirst: true };
    // Alleen preloaden wat dit level ook echt gebruikt — niet de hele bibliotheek.
    const typeInstr = { AUDIO_TO_LETTER: "which-letter", VISUAL_MATCH: "find-letter", LETTER_MATCH: "match" };
    AudioManager.preload([...new Set(["level-start", "listen", "correct-01", "retry-01", ...level.types.map((ty) => typeInstr[ty])])].filter(Boolean));
    AudioManager.playInstruction("level-start");
    if (level.letters.length) renderIntro(); else renderQuestion();
  }

  function levelHeader() {
    const t = GT();
    const { level, questions, i } = runState;
    return `
      <div class="g-lvl-head">
        <button id="gLvlBack" class="g-icon-btn" aria-label="${t.back}">
          <svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>
        </button>
        <div class="g-lvl-progress"><i style="width:${(i / questions.length) * 100}%"></i></div>
        <span class="g-lvl-n">${level.n}</span>
      </div>`;
  }

  function renderIntro() {
    const t = GT();
    const { level } = runState;
    const letter = level.letters[0];
    scr.level.innerHTML = `
      ${levelHeader()}
      <div class="g-intro">
        <span class="g-intro-kicker">${t.newLetter}</span>
        <button id="gIntroLetter" class="g-big-letter" lang="ar">${letter}</button>
        <p class="g-intro-hint">👆 ${t.listen}</p>
        <button id="gIntroGo" class="g-cta">${t.play} →</button>
      </div>
      ${companionHtml("enter")}`;
    $("gLvlBack").onclick = () => gohash(`#/spel/wereld/${runState.world.id}`);
    const replayIt = () => playLetter(letter, () => $("gIntroLetter").classList.remove("playing"));
    $("gIntroLetter").onclick = () => { $("gIntroLetter").classList.add("playing"); replayIt(); };
    $("gIntroGo").onclick = renderQuestion;
    // Bij binnenkomst: eerst de instructie ("Luister goed"), dan pas de letter — nooit tegelijk.
    $("gIntroLetter").classList.add("playing");
    AudioManager.playInstruction("listen").then((ok) => { if (ok) playLetter(letter, () => $("gIntroLetter").classList.remove("playing")); });
  }

  function renderQuestion() {
    const { questions, i } = runState;
    if (i >= questions.length) return renderComplete();
    if (questions.length >= 4) {
      if (i === Math.floor(questions.length / 2)) AudioManager.playInstruction("halfway");
      else if (i === questions.length - 1) AudioManager.playInstruction("last-question");
    }
    const q = questions[i];
    if (q.type === "LETTER_MATCH") return renderPairsQuestion(q);
    renderChoiceQuestion(q);
  }

  function renderChoiceQuestion(q) {
    const t = GT();
    const isAudio = q.type === "AUDIO_TO_LETTER";
    scr.level.innerHTML = `
      ${levelHeader()}
      <div class="g-q">
        <p class="g-q-prompt">${isAudio ? t.chooseSound : t.chooseMatch}</p>
        ${isAudio
          ? `<button id="gQPlay" class="g-play-big" aria-label="${t.listen}">🔊</button>`
          : `<div class="g-q-ref" lang="ar">${q.letter}</div>`}
        <div class="g-q-options">
          ${q.options.map((o, idx) => `<button class="g-opt" data-i="${idx}" lang="ar">${o}</button>`).join("")}
        </div>
      </div>
      ${companionHtml()}`;
    $("gLvlBack").onclick = () => gohash(`#/spel/wereld/${runState.world.id}`);
    let first = true, locked = false;
    if (isAudio) {
      const replay = () => playLetter(q.letter);
      $("gQPlay").onclick = replay;
      AudioManager.playInstruction("which-letter").then((ok) => { if (ok) playLetter(q.letter); });
    } else {
      AudioManager.playInstruction("find-letter");
    }
    scr.level.querySelectorAll(".g-opt").forEach((btn) => {
      btn.onclick = () => {
        if (locked) return;
        const ok = q.options[Number(btn.dataset.i)] === q.letter;
        if (ok) locked = true;
        answerFeedback(btn, ok, first, () => { runState.i++; renderQuestion(); }, q.letter);
        if (ok && first) { runState.correctFirstTry++; updateMastery(q.letter, true); }
        else if (!ok) { if (first) updateMastery(q.letter, false); first = false; }
      };
    });
  }

  function renderPairsQuestion(q) {
    const t = GT();
    // Twee vindbare paren: de doelletter tweemaal + één afleider tweemaal.
    const distractor = pick(q.options.filter((o) => o !== q.letter), 1)[0] || q.letter;
    const deck = shuffle([
      { l: q.letter }, { l: q.letter }, { l: distractor }, { l: distractor },
    ]);
    scr.level.innerHTML = `
      ${levelHeader()}
      <div class="g-q">
        <p class="g-q-prompt">${t.pairs}</p>
        <div class="g-pairs">${deck.map((c, idx) => `<button class="g-pair-card" data-idx="${idx}" data-l="${c.l}"><span lang="ar">?</span></button>`).join("")}</div>
      </div>
      ${companionHtml()}`;
    $("gLvlBack").onclick = () => gohash(`#/spel/wereld/${runState.world.id}`);
    AudioManager.playInstruction("match");
    let open = [], lock = false, first = true, solvedPairs = 0, needed = 2;
    scr.level.querySelectorAll(".g-pair-card").forEach((card) => {
      card.onclick = () => {
        if (lock || card.classList.contains("matched") || open.includes(card)) return;
        card.classList.add("flipped");
        card.querySelector("span").textContent = card.dataset.l;
        open.push(card);
        if (open.length === 2) {
          lock = true;
          const match = open[0].dataset.l === open[1].dataset.l;
          setTimeout(() => {
            if (match) {
              open.forEach((c) => c.classList.add("matched"));
              solvedPairs++;
              sfx.correct(); companionMood("happy", 1200);
              if (solvedPairs >= needed) {
                if (first) { runState.correctFirstTry++; updateMastery(q.letter, true); }
                toast(pickCorrectMsg());
                AudioManager.playRandomCorrectFeedback();
                setTimeout(() => { runState.i++; renderQuestion(); }, 500);
              }
            } else {
              sfx.wrong(); companionMood("sad", 1100);
              if (first) { updateMastery(q.letter, false); AudioManager.playRandomRetryFeedback(); first = false; }
              open.forEach((c) => { c.classList.remove("flipped"); c.querySelector("span").textContent = "?"; });
            }
            open = []; lock = false;
          }, 550);
        }
      };
    });
  }

  function pickCorrectMsg() { const m = GT().correct; return m[(Math.random() * m.length) | 0]; }
  let toastTimer;
  function toast(msg) {
    let tEl = document.getElementById("gToast");
    if (!tEl) { tEl = el("div", "g-toast"); tEl.id = "gToast"; document.body.appendChild(tEl); }
    tEl.textContent = msg; tEl.classList.add("show");
    clearTimeout(toastTimer); toastTimer = setTimeout(() => tEl.classList.remove("show"), 1400);
  }

  function answerFeedback(btn, ok, first, next, letter) {
    if (ok) {
      btn.classList.add("correct");
      toast(pickCorrectMsg());
      sfx.correct(); companionMood("happy", 1200);
      AudioManager.playRandomCorrectFeedback();
      setTimeout(next, 550);
    } else {
      btn.classList.add("wrong");
      setTimeout(() => btn.classList.remove("wrong"), 420);
      sfx.wrong(); companionMood("sad", 1100);
      if (first) {
        toast(GT().tryAgain);
        // Vriendelijke retry-feedback, daarna de Arabische leeruitspraak nog eens.
        const base = letter && G.letterAudio[letter];
        AudioManager.playRandomRetryFeedback().then((ok) => { if (ok && base) AudioManager.playLearningAudio(base); });
      }
    }
  }

  function renderComplete() {
    const t = GT();
    const { world, level, questions, correctFirstTry } = runState;
    const ratio = correctFirstTry / questions.length;
    const stars = ratio >= 0.9 ? 3 : ratio >= 0.6 ? 2 : 1;
    const id = levelId(world, level);
    const prevStars = levelStars(world, level);
    state.levels[id] = { stars: Math.max(stars, prevStars), attempts: ((state.levels[id] || {}).attempts || 0) + 1 };
    const xp = level.challenge ? 200 : 80 + level.n;
    const coins = level.challenge ? 30 : 10;
    state.xp += xp; state.coins += coins;
    state.lastActivity = Date.now();
    let newBadge = null;
    if (level.badge && !state.badges.includes(level.badge)) { state.badges.push(level.badge); newBadge = G.badges[level.badge]; }
    gstate.save(activeProfile.id, state);
    sfx.levelComplete();
    const worldIdx0 = G.worlds.findIndex((w) => w.id === world.id);
    const isLastLevelOfWorld = world.levels[world.levels.length - 1].n === level.n;
    const worldNowComplete = isLastLevelOfWorld && !G.worlds[worldIdx0 + 1];
    const worldUnlocksNext = isLastLevelOfWorld && !!G.worlds[worldIdx0 + 1];
    (async () => {
      if (!(await AudioManager.playInstruction("level-complete"))) return;
      if (stars === 3 && !(await AudioManager.playInstruction("three-stars"))) return;
      if (newBadge && !(await AudioManager.playInstruction("new-badge"))) return;
      if (worldNowComplete || worldUnlocksNext) await AudioManager.playInstruction("world-complete");
    })();

    scr.complete.hidden = false;
    scr.complete.innerHTML = `
      <div class="g-complete-card">
        <div class="g-companion-celebrate">${FOX.happy}</div>
        <div class="g-stars-big">${[1, 2, 3].map((n) => `<span class="${n <= stars ? "on" : ""}">★</span>`).join("")}</div>
        <h2>${t.levelDone}</h2>
        <div class="g-rewards"><span>+${xp} ${t.xp}</span><span>+${coins} 🪙</span></div>
        ${newBadge ? `<div class="g-badge-earned"><span class="g-badge-icon">${newBadge.icon}</span><span>${t.badgeEarned}<br>${gsub(newBadge)}</span></div>` : ""}
        <div class="g-complete-actions">
          <button id="gToMap" class="g-cta ghost">${t.toMap}</button>
          <button id="gNextLevel" class="g-cta"><span>${t.next}</span> →</button>
        </div>
      </div>`;
    $("gToMap").onclick = () => gohash(`#/spel/wereld/${world.id}`);
    const idx = world.levels.findIndex((lv) => lv.n === level.n);
    const nextLevel = world.levels[idx + 1];
    const worldIdx = G.worlds.findIndex((w) => w.id === world.id);
    const nextWorld = !nextLevel ? G.worlds[worldIdx + 1] : null;
    const nextBtn = $("gNextLevel");
    if (nextLevel) {
      nextBtn.hidden = false;
      nextBtn.querySelector("span").textContent = t.next;
      nextBtn.onclick = () => gohash(`#/spel/level/${world.id}/${nextLevel.n}`);
    } else if (nextWorld) {
      nextBtn.hidden = false;
      nextBtn.querySelector("span").textContent = gsub(nextWorld.title);
      nextBtn.onclick = () => gohash(`#/spel/wereld/${nextWorld.id}`);
    } else {
      nextBtn.hidden = true;
    }
  }

  // ---------- Routing ----------
  function gohash(h) { location.hash = h; }

  // Een wereld is ontgrendeld als hij geen vereiste heeft, of als de laatste (uitdagings)level
  // van de vereiste wereld al minstens 1 ster heeft voor dit profiel.
  function worldUnlocked(world) {
    if (!world.requires) return true;
    const req = G.worlds.find((w) => w.id === world.requires);
    if (!req) return true;
    const last = req.levels[req.levels.length - 1];
    return !!(state.levels && state.levels[levelId(req, last)]);
  }

  function gameRoute() {
    const h = location.hash;
    if (!h.startsWith("#/spel")) { scr.root.hidden = true; return; }
    scr.root.hidden = false;
    scr.complete.hidden = true;
    loadActive();
    const mWorld = h.match(/^#\/spel\/wereld\/([\w-]+)/);
    const mLevel = h.match(/^#\/spel\/level\/([\w-]+)\/(\d+)/);
    if (!activeProfile && (mWorld || mLevel)) return gohash("#/spel");
    if (mLevel) {
      const w = G.worlds.find((x) => x.id === mLevel[1]);
      if (w && !worldUnlocked(w)) return gohash("#/spel");
      showScreen("level"); renderLevel(mLevel[1], mLevel[2]);
    } else if (mWorld) {
      const w = G.worlds.find((x) => x.id === mWorld[1]) || G.worlds[0];
      if (!worldUnlocked(w)) return gohash(`#/spel/wereld/${w.requires}`);
      showScreen("map"); renderMap(w.id);
    } else { showScreen("profile"); renderProfile(); }
  }

  window.addEventListener("hashchange", gameRoute);
  document.addEventListener("DOMContentLoaded", gameRoute);
  if (document.readyState !== "loading") gameRoute();
})();
