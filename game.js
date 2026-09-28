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
    },
    nl: { dir: "ltr", who: "Wie speelt er?", newProfile: "Nieuw profiel", namePlaceholder: "Jouw naam",
      create: "Beginnen", world: (n) => `Wereld ${n}`, level: "Level", locked: "Op slot", start: "Start",
      play: "Spelen", back: "Terug", listen: "Luister", chooseSound: "Tik op de letter die je hoorde",
      chooseMatch: "Tik op dezelfde letter", pairs: "Tik op het bijpassende paar",
      correct: ["Goed zo!", "MashaAllah!", "Uitstekend!", "Knap gedaan!"], tryAgain: "Bijna! Probeer nog eens",
      levelDone: "Level voltooid!", newLetter: "Nieuwe letter", next: "Volgend level", toMap: "Kaart",
      xp: "XP", coins: "munten", badgeEarned: "Nieuwe badge!", switchProfile: "Profiel wisselen",
      bookMode: "Boek", gameMode: "Spel", challenge: "Uitdaging",
    },
    en: { dir: "ltr", who: "Who's playing?", newProfile: "New profile", namePlaceholder: "Your name",
      create: "Start", world: (n) => `World ${n}`, level: "Level", locked: "Locked", start: "Start",
      play: "Play", back: "Back", listen: "Listen", chooseSound: "Tap the letter you heard",
      chooseMatch: "Tap the matching letter", pairs: "Tap the matching pair",
      correct: ["Well done!", "MashaAllah!", "Excellent!", "Great job!"], tryAgain: "Almost! Try again",
      levelDone: "Level complete!", newLetter: "New letter", next: "Next level", toMap: "Map",
      xp: "XP", coins: "coins", badgeEarned: "New badge!", switchProfile: "Switch profile",
      bookMode: "Book", gameMode: "Game", challenge: "Challenge",
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

  // ---------- Audio (eigen, kleine speler — onafhankelijk van de boekmodus) ----------
  const player = new Audio();
  function playLetter(letter, onEnd) {
    const base = G.letterAudio[letter];
    if (!base) return onEnd && onEnd(false);
    const sources = [base + ".m4a", base + ".mp3"];
    const tryNext = () => {
      const src = sources.shift();
      if (!src) return onEnd && onEnd(false);
      player.onerror = tryNext;
      player.onended = () => onEnd && onEnd(true);
      player.src = src;
      player.play().catch(() => {});
    };
    tryNext();
  }

  // ---------- Scherm-elementen ----------
  const scr = {
    root: $("game"), profile: $("gProfile"), map: $("gMap"), level: $("gLevel"), complete: $("gComplete"),
  };

  function showScreen(name) {
    ["profile", "map", "level", "complete"].forEach((k) => { scr[k].hidden = k !== name; });
  }

  // ---------- Profielscherm ----------
  function renderProfile() {
    const t = GT();
    document.documentElement.dir = t.dir;
    const list = profiles.all();
    scr.profile.innerHTML = `
      <a href="#/" class="g-back-book">📖 ${t.bookMode}</a>
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
  function renderMap(worldId) {
    const t = GT();
    document.documentElement.dir = t.dir;
    const world = G.worlds.find((w) => w.id === worldId) || G.worlds[0];
    const doneCount = world.levels.filter((lv) => state.levels[levelId(world, lv)]).length;
    scr.map.innerHTML = `
      <div class="g-map-head g-theme-${world.theme}">
        <button id="gSwitchProfile" class="g-icon-btn" aria-label="${t.switchProfile}">${activeProfile.avatar}</button>
        <div class="g-map-title">
          <span class="g-map-ar" lang="ar" dir="rtl">${world.title.ar}</span>
          <span class="g-map-sub">${gsub(world.subtitle)}</span>
        </div>
        <div class="g-stats">
          <span>⭐ ${Object.values(state.levels).reduce((s, l) => s + (l.stars || 0), 0)}</span>
          <span>🪙 ${state.coins}</span>
        </div>
      </div>
      <div class="g-path" id="gPath"></div>`;
    const path = $("gPath");
    world.levels.forEach((lv, i) => {
      const unlocked = isLevelUnlocked(world, i);
      const stars = levelStars(world, lv);
      const node = el("div", `g-node ${i % 2 ? "r" : "l"}`);
      const b = el("button", "g-node-btn" + (unlocked ? "" : " locked") + (lv.challenge ? " challenge" : ""));
      b.innerHTML = unlocked
        ? `<span class="g-node-n">${lv.n}</span>${lv.challenge ? "🏆" : ""}`
        : `🔒`;
      b.disabled = !unlocked;
      b.setAttribute("aria-label", `${t.level} ${lv.n}`);
      b.onclick = () => gohash(`#/spel/level/${world.id}/${lv.n}`);
      node.appendChild(b);
      const starsEl = el("div", "g-node-stars", unlocked ? "★".repeat(stars) + "☆".repeat(3 - stars) : "");
      node.appendChild(starsEl);
      const label = el("div", "g-node-label", gsub(lv.title));
      node.appendChild(label);
      path.appendChild(node);
    });
    $("gSwitchProfile").onclick = () => gohash("#/spel");
    // Scroll naar het eerstvolgende (nog niet voltooide) level.
    requestAnimationFrame(() => {
      const nodes = [...path.children];
      const target = nodes[Math.min(doneCount, nodes.length - 1)];
      target?.scrollIntoView({ block: "center", behavior: "instant" in document.documentElement.style ? "instant" : "auto" });
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
    if (level.letters.length) {
      renderIntro();
    } else {
      renderQuestion();
    }
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
      </div>`;
    $("gLvlBack").onclick = () => gohash(`#/spel/wereld/${runState.world.id}`);
    const playIt = () => playLetter(letter, () => $("gIntroLetter").classList.remove("playing"));
    $("gIntroLetter").onclick = () => { $("gIntroLetter").classList.add("playing"); playIt(); };
    $("gIntroGo").onclick = renderQuestion;
    playIt();
  }

  function renderQuestion() {
    const { questions, i } = runState;
    if (i >= questions.length) return renderComplete();
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
      </div>`;
    $("gLvlBack").onclick = () => gohash(`#/spel/wereld/${runState.world.id}`);
    let first = true, locked = false;
    if (isAudio) { const p = () => playLetter(q.letter); $("gQPlay").onclick = p; p(); }
    scr.level.querySelectorAll(".g-opt").forEach((btn) => {
      btn.onclick = () => {
        if (locked) return;
        const ok = q.options[Number(btn.dataset.i)] === q.letter;
        if (ok) locked = true;
        answerFeedback(btn, ok, first, () => { runState.i++; renderQuestion(); });
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
      </div>`;
    $("gLvlBack").onclick = () => gohash(`#/spel/wereld/${runState.world.id}`);
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
              if (solvedPairs >= needed) {
                if (first) { runState.correctFirstTry++; updateMastery(q.letter, true); }
                toast(pickCorrectMsg());
                setTimeout(() => { runState.i++; renderQuestion(); }, 500);
              }
            } else {
              if (first) { updateMastery(q.letter, false); first = false; }
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

  function answerFeedback(btn, ok, first, next) {
    if (ok) {
      btn.classList.add("correct");
      toast(pickCorrectMsg());
      setTimeout(next, 550);
    } else {
      btn.classList.add("wrong");
      setTimeout(() => btn.classList.remove("wrong"), 420);
      if (first) toast(GT().tryAgain);
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

    scr.complete.hidden = false;
    scr.complete.innerHTML = `
      <div class="g-complete-card">
        <div class="g-stars-big">${[1, 2, 3].map((n) => `<span class="${n <= stars ? "on" : ""}">★</span>`).join("")}</div>
        <h2>${t.levelDone}</h2>
        <div class="g-rewards"><span>+${xp} ${t.xp}</span><span>+${coins} 🪙</span></div>
        ${newBadge ? `<div class="g-badge-earned"><span class="g-badge-icon">${newBadge.icon}</span><span>${t.badgeEarned}<br>${gsub(newBadge)}</span></div>` : ""}
        <div class="g-complete-actions">
          <button id="gToMap" class="g-cta ghost">${t.toMap}</button>
          <button id="gNextLevel" class="g-cta">${t.next} →</button>
        </div>
      </div>`;
    $("gToMap").onclick = () => gohash(`#/spel/wereld/${world.id}`);
    const idx = world.levels.findIndex((lv) => lv.n === level.n);
    const nextLevel = world.levels[idx + 1];
    $("gNextLevel").hidden = !nextLevel;
    if (nextLevel) $("gNextLevel").onclick = () => gohash(`#/spel/level/${world.id}/${nextLevel.n}`);
  }

  // ---------- Routing ----------
  function gohash(h) { location.hash = h; }

  function gameRoute() {
    const h = location.hash;
    if (!h.startsWith("#/spel")) { scr.root.hidden = true; return; }
    scr.root.hidden = false;
    scr.complete.hidden = true;
    loadActive();
    const mWorld = h.match(/^#\/spel\/wereld\/([\w-]+)/);
    const mLevel = h.match(/^#\/spel\/level\/([\w-]+)\/(\d+)/);
    if (!activeProfile && (mWorld || mLevel)) return gohash("#/spel");
    if (mLevel) { showScreen("level"); renderLevel(mLevel[1], mLevel[2]); }
    else if (mWorld) { showScreen("map"); renderMap(mWorld[1]); }
    else { showScreen("profile"); renderProfile(); }
  }

  window.addEventListener("hashchange", gameRoute);
  document.addEventListener("DOMContentLoaded", gameRoute);
  if (document.readyState !== "loading") gameRoute();
})();
