// Gedeelde basis voor de letter-minigames (Katapult + Fotograaf): letter-groepen
// (heel het alfabet), voortgang per profiel, duidelijke feedback (bord + geluidje).
(() => {
  "use strict";
  const D = window.MiniCore;
  const { store, lang } = D;

  // ---------- Werelden ----------
  // Wereld 1 ("oasis"): heel het alfabet, in groepen van op elkaar lijkende letters (onderscheiden is de kern).
  // Wereld 2 ("harakat"): per level 4 letters met alle drie de klinkertekens (12 klanken); de groepen komen uit game-data.js.
  const GROUPS_OASIS = [
    ["ب", "ت", "ث"],
    ["ج", "ح", "خ"],
    ["د", "ذ", "ر", "ز"],
    ["س", "ش", "ص", "ض"],
    ["ط", "ظ", "ع", "غ"],
    ["ف", "ق", "ك", "ل"],
    ["ا", "م", "ن"],
    ["هـ", "و", "ي"],
  ];
  const shuffle = (a) => { const r = [...a]; for (let i = r.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [r[i], r[j]] = [r[j], r[i]]; } return r; };
  const worldById = (id) => ((window.GAME && window.GAME.worlds) || []).find((x) => x.id === id) || null;
  const gameWorld = () => worldById(getWorldKey() === "long" ? "river_long" : "flowers_valley");
  const worldGroups = (id) => { const w = worldById(id); return w ? w.levels.filter((l) => l.letters.length).map((l) => l.letters) : []; };
  const harakatGroups = () => worldGroups("flowers_valley");
  // wereld 3: بَا -> ب (de lange klinker achter het teken valt weg)
  const baseOf = (x) => String(x).replace(/([َُِ])[اوي]$/, "$1").replace(/[ً-ْ]/g, "").replace(/[أإآ]/g, "ا");
  const uniqueBases = (g) => { const out = []; g.forEach((x) => { const b2 = baseOf(x); if (!out.includes(b2)) out.push(b2); }); return out; };
  // Welke wereld speelt het kind nu? Onthouden per tabblad zodat een spel direct na de keuze dezelfde wereld houdt.
  const WORLD_KEY = "gp_mini_world";
  const WORLD_KEYS = ["oasis", "harakat", "long"];
  const getWorldKey = () => { try { const k = sessionStorage.getItem(WORLD_KEY); return WORLD_KEYS.includes(k) ? k : "oasis"; } catch { return "oasis"; } };
  const setWorld = (w) => { try { sessionStorage.setItem(WORLD_KEY, WORLD_KEYS.includes(w) ? w : "oasis"); } catch {} };
  const isHarakat = () => getWorldKey() === "harakat" && harakatGroups().length > 0;
  const isLong = () => getWorldKey() === "long" && worldGroups("river_long").length > 0; // wereld 3: lange klinkers
  const groups = () => (isLong() ? worldGroups("river_long") : isHarakat() ? harakatGroups() : GROUPS_OASIS);
  const labelOf = (g) => (isHarakat() || isLong() ? uniqueBases(g) : g).join(" "); // wereld 2 en 3 tonen de 4 letters, niet alle klanken
  const returnHash = () => "#/gamestage/games" + (isLong() ? "?w=3" : isHarakat() ? "?w=2" : "");

  // ---------- Levels: vaste route, elk niveau voegt letters toe en herhaalt de eerdere ----------
  // Niveau n = nieuwe letters groups()[n]; de oefenpool is alle letters t/m dat niveau.
  const pool = (level) => groups().slice(0, level + 1).flat();

  // Doelletters van een niveau: een paar nieuwe letters (max 4) + een paar herhaal-letters (max 5 missies).
  function missionTargets(level) {
    const G = groups();
    const fresh = shuffle(G[level]).slice(0, 4);
    let review = [];
    if (level > 0) {
      const prev = shuffle(pool(level - 1));
      review = prev.slice(0, Math.max(1, Math.min(2, 5 - fresh.length, prev.length)));
    }
    const all = [...fresh, ...review].slice(0, 5);
    const out = shuffle(all);
    if (!G[level].includes(out[0])) { const i = out.findIndex((l) => G[level].includes(l)); [out[0], out[i]] = [out[i], out[0]]; } // eerste missie = een nieuwe letter
    return out;
  }

  // Afleiders voor een doelletter. Wereld 1: eerst lijkende letters uit dezelfde groep, daarna de rest van de pool.
  // Wereld 2: dezelfde letter met de andere klinkertekens + een letter die erop lijkt (zie game-data.js).
  function distractors(level, target, n) {
    if (isHarakat() || isLong()) {
      const w = gameWorld(), p = pool(level);
      const first = w && w.distract ? w.distract(target, w.letters, new Set(p)) : [];
      const rest = shuffle(p.filter((l) => l !== target && !first.includes(l)));
      const list = [...first, ...rest];
      return list.length ? Array.from({ length: n }, (_, i) => list[i % list.length]) : [];
    }
    const own = groups().find((g) => g.includes(target)) || [];
    const cand = pool(level).filter((l) => l !== target);
    const list = [...shuffle(cand.filter((l) => own.includes(l))), ...shuffle(cand.filter((l) => !own.includes(l)))];
    if (!list.length) return [];
    return Array.from({ length: n }, (_, i) => list[i % list.length]);
  }

  // ---------- Voortgang ----------
  // unlocked = hoogste vrijgespeelde niveau; play = niveau dat nu gespeeld wordt (standaard = unlocked,
  // of een eerder behaald niveau dat het kind opnieuw speelt). Wereld 2 heeft zijn eigen opslag.
  const key = (pid) => (isLong() ? "gp_minil_" + pid : isHarakat() ? "gp_minih_" + pid : "gp_mini_" + pid);
  const lastLevel = () => groups().length - 1;
  function load(pid) {
    const LAST = lastLevel();
    const d = store.get(key(pid), null) || {};
    const done = Array.isArray(d.done) ? d.done : [];
    const pv = !!(window.Account && window.Account.isPreview && window.Account.isPreview()); // docent-voorbeeld: alle niveaus open
    const unlocked = pv ? LAST : Math.min(LAST, Math.max(d.unlocked || 0, d.level || 0)); // 'level' = oude opslag
    return { unlocked, play: Math.min(d.play == null ? (pv ? 0 : unlocked) : d.play, unlocked), done };
  }
  const save = (pid, d) => store.set(key(pid), d);
  const currentLevel = (pid) => load(pid).play;
  const unlockedLevel = (pid) => load(pid).unlocked;
  const doneLevels = (pid) => load(pid).done;
  function setPlay(pid, n) { const d = load(pid); if (n >= 0 && n <= d.unlocked) { d.play = n; save(pid, d); } }
  // Vanuit de wereldkaart: speel precies de letters van dit wereld-niveau (ook als de spelroute nog niet zover was).
  function focusLevel(pid, n) { const d = load(pid); n = Math.max(0, Math.min(lastLevel(), n)); d.unlocked = Math.max(d.unlocked, n); d.play = n; save(pid, d); }
  function completeLevel(pid, n) {
    const d = load(pid);
    if (!d.done.includes(n)) d.done.push(n);
    if (n >= d.unlocked) d.unlocked = Math.min(lastLevel(), n + 1);
    d.play = d.unlocked; // door naar het volgende niveau
    save(pid, d);
  }

  // ---------- Teksten ----------
  const SAY = {
    nl: { ok: "Goed zo!", no: "Probeer nog eens", next: "Volgend niveau", level: "Niveau" },
    en: { ok: "Well done!", no: "Try again", next: "Next level", level: "Level" },
    ar: { ok: "أحسنت!", no: "حاول مرة أخرى", next: "المستوى التالي", level: "المستوى" },
    tr: { ok: "Aferin!", no: "Tekrar dene", next: "Sonraki seviye", level: "Seviye" },
  };
  const AF = window.ArF || { fem: (s) => s, deep: (t) => t }; // Arabisch: vrouwelijke vorm voor meisjes (ar-gender.js)
  const say = (k) => AF.fem((SAY[lang()] || SAY.nl)[k]);

  // ---------- Feedbackbord (groot, duidelijk goed/fout) ----------
  function banner(field, { ok, letter }) {
    hideBanner(field);
    const el = document.createElement("div");
    el.className = "fb-banner " + (ok ? "is-ok" : "is-no");
    el.dataset.fb = "1";
    el.innerHTML = `<span class="fb-icon">${ok ? "✓" : "✗"}</span><span class="fb-letter" lang="ar" dir="rtl">${letter}</span><span class="fb-text">${say(ok ? "ok" : "no")}</span>`;
    field.appendChild(el);
  }
  function hideBanner(field) {
    (field || document).querySelectorAll("[data-fb]").forEach((n) => n.remove());
  }

  // ---------- Geluidjes (korte jingle, geen bestanden nodig) ----------
  let ac = null;
  function tone(freqs, dur, type) {
    try {
      if (window.AudioManager && !window.AudioManager.settings.sfxOn) return;
      ac = ac || new (window.AudioContext || window.webkitAudioContext)();
      const t0 = ac.currentTime;
      freqs.forEach((f, i) => {
        const o = ac.createOscillator(), g = ac.createGain(), s = t0 + i * 0.13;
        o.type = type || "sine"; o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, s); g.gain.exponentialRampToValueAtTime(0.22, s + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, s + dur);
        o.connect(g); g.connect(ac.destination); o.start(s); o.stop(s + dur + 0.05);
      });
    } catch {}
  }
  // ---------- Eigen geluidseffecten voor de spelletjes van wereld 2 (Web Audio, geen bestanden) ----------
  const actx = () => {
    try {
      if (window.AudioManager && window.AudioManager.settings && !window.AudioManager.settings.sfxOn) return null;
      ac = ac || new (window.AudioContext || window.webkitAudioContext)();
      if (ac.state === "suspended") ac.resume();
      return ac;
    } catch { return null; }
  };
  function noiseBurst(dur, type, f0, f1, gain, delay = 0) {
    const c = actx(); if (!c) return;
    const n = Math.max(1, Math.floor(c.sampleRate * dur)), buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(), t0 = c.currentTime + delay;
    src.buffer = buf; f.type = type; f.Q.value = 1.1;
    f.frequency.setValueAtTime(f0, t0); f.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(gain, t0 + Math.min(0.05, dur / 3)); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f); f.connect(g); g.connect(c.destination); src.start(t0); src.stop(t0 + dur + 0.05);
  }
  function glide(type, f0, f1, dur, gain, delay = 0, vib = 0) {
    const c = actx(); if (!c) return;
    const o = c.createOscillator(), g = c.createGain(), t0 = c.currentTime + delay;
    o.type = type; o.frequency.setValueAtTime(f0, t0); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
    if (vib) { const l = c.createOscillator(), lg = c.createGain(); l.frequency.value = 12; lg.gain.value = vib; l.connect(lg); lg.connect(o.frequency); l.start(t0); l.stop(t0 + dur + 0.05); }
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(gain, t0 + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(c.destination); o.start(t0); o.stop(t0 + dur + 0.05);
  }
  const fx = {
    shoot() { noiseBurst(0.25, "lowpass", 1100, 180, 0.5); glide("sine", 200, 55, 0.28, 0.42); },            // kanonschot
    pop() { noiseBurst(0.16, "highpass", 1800, 6500, 0.38); glide("sine", 1000, 1900, 0.1, 0.18); },         // bel knapt
    boing() { glide("triangle", 420, 150, 0.38, 0.26, 0, 22); },                                             // verkeerd antwoord, zacht
    horn() { glide("sawtooth", 196, 196, 0.5, 0.09); glide("sawtooth", 247, 247, 0.5, 0.07, 0.02); },       // scheepshoorn
    moor() { noiseBurst(0.32, "lowpass", 900, 120, 0.42); glide("sine", 120, 55, 0.3, 0.38); noiseBurst(0.3, "highpass", 3200, 7000, 0.1, 0.12); }, // aanleggen: bonk + ketting
    hop() { glide("sine", 360, 720, 0.14, 0.2); },                                                           // sprongetje
    landOk() { glide("triangle", 660, 990, 0.2, 0.2, 0.02); noiseBurst(0.1, "lowpass", 1200, 300, 0.2); },
    tick(i) { glide("triangle", 700 + i * 28, 760 + i * 28, 0.07, 0.13); },                              // teller: muntje erbij
    star(i) { glide("sine", 660 + i * 200, 990 + i * 300, 0.28, 0.2); glide("triangle", 1320 + i * 300, 1320 + i * 300, 0.2, 0.08, 0.05); },
    cha() { [988, 1319, 1568, 2093].forEach((f, i) => glide("triangle", f, f * 1.01, 0.28, 0.13, i * 0.1)); noiseBurst(0.35, "highpass", 5000, 9000, 0.06, 0.1); }, // kassa-gerinkel
    splashSmall() { noiseBurst(0.45, "lowpass", 3000, 300, 0.33); glide("sine", 500, 200, 0.2, 0.12); },
  };
  // Telt van 0 naar `to` met een tikje per stap; daarna een kassa-gerinkel. Voor de eindschermen.
  function countUp(to, o = {}) {
    const steps = Math.max(1, Math.min(to, 36)), ms = o.ms || Math.min(1400, 260 + steps * 38);
    to = Math.max(0, to);
    setTimeout(() => {
      if (!to) { if (o.onStep) o.onStep(0); if (o.onDone) o.onDone(); return; }
      for (let i = 1; i <= steps; i++) setTimeout(() => {
        const v = Math.round((to * i) / steps);
        if (o.onStep) o.onStep(v);
        if (o.sound !== false) fx.tick(i);
        if (i === steps) { if (o.sound !== false) setTimeout(() => fx.cha(), 120); if (o.onDone) setTimeout(o.onDone, 160); }
      }, (ms * i) / steps);
    }, o.delay || 0);
  }
  const TOTAL = { nl: "Totaal", en: "Total", ar: "المجموع", tr: "Toplam" };
  const CHEST_SVG = `<svg viewBox="0 0 90 76" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <defs><linearGradient id="chW" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b7773a"/><stop offset="1" stop-color="#7d4a1e"/></linearGradient>
    <linearGradient id="chG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff2a8"/><stop offset=".55" stop-color="#f6c744"/><stop offset="1" stop-color="#c98a10"/></linearGradient></defs>
    <g class="ch-gold"><ellipse cx="45" cy="34" rx="30" ry="9" fill="#f6c744" stroke="#c98a10" stroke-width="2"/>
      <circle cx="30" cy="30" r="7" fill="url(#chG)" stroke="#c98a10" stroke-width="1.6"/><circle cx="46" cy="26" r="8" fill="url(#chG)" stroke="#c98a10" stroke-width="1.6"/><circle cx="60" cy="31" r="7" fill="url(#chG)" stroke="#c98a10" stroke-width="1.6"/></g>
    <rect x="8" y="34" width="74" height="38" rx="6" fill="url(#chW)" stroke="#5a3112" stroke-width="3"/>
    <rect x="8" y="46" width="74" height="7" fill="url(#chG)" stroke="#5a3112" stroke-width="2"/>
    <rect x="38" y="42" width="14" height="18" rx="3" fill="url(#chG)" stroke="#5a3112" stroke-width="2.4"/><circle cx="45" cy="52" r="2.6" fill="#5a3112"/>
    <g class="ch-lid"><path d="M8 34 Q8 8 45 8 Q82 8 82 34Z" fill="url(#chW)" stroke="#5a3112" stroke-width="3"/>
      <path d="M8 34 H82" stroke="#5a3112" stroke-width="3"/><path d="M26 12 V34 M64 12 V34" stroke="url(#chG)" stroke-width="7"/><path d="M26 12 V34 M64 12 V34" stroke="#5a3112" stroke-width="1.4" fill="none"/></g></svg>`;
  const sfx = (kind) => (kind === "ok" ? tone([659, 880, 1175], 0.4, "sine") : tone([260, 207], 0.3, "triangle"));
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  // Eindscherm: sterren, groep-voortgang, nog een keer / volgende groep / terug.
  const END = {
    nl: { good: "Goed gedaan", again: "Nog een keer", back: "Terug" },
    en: { good: "Well done", again: "Play again", back: "Back" },
    ar: { good: "أحسنت", again: "مرة أخرى", back: "رجوع" },
    tr: { good: "Aferin", again: "Tekrar oyna", back: "Geri" },
  };
  const SHOP = {
    nl: "Nieuw in de kledingkast!", en: "New in the wardrobe!", ar: "جديد في الخزانة!", tr: "Dolapta yeni ürünler!",
  };
  function finish(ov, { pid, level, stars, onAgain, onBack, plain }) {
    // plain: woordspellen van wereld 3 horen niet bij een letterniveau: geen niveau-voortgang, wel een klein aantal munten
    const first = !plain && !doneLevels(pid).includes(level);
    if (!plain) completeLevel(pid, level);
    // Munten: volledig bij een nieuw niveau (10 + 2 per ster), klein bedrag bij herhalen.
    const earned = plain ? 3 + Math.max(1, stars) : first ? 10 + 2 * Math.max(1, stars) : 3;
    const Ch = window.Character;
    if (Ch) Ch.addCoins(pid, earned);
    const fresh = Ch ? Ch.checkNewUnlocks(pid) : [];
    const e = END[lang()] || END.nl;
    const hasNext = !plain && currentLevel(pid) !== level; // het volgende niveau is nu vrijgespeeld
    ov.hidden = false;
    ov.innerHTML = `
      <div class="chase-card">
        <h2>${e.good}</h2>
        ${plain ? "" : `<p class="chase-card-level">${say("level")} ${level + 1}</p>
        <span class="chase-card-letter" lang="ar" dir="rtl">${labelOf(groups()[level])}</span>`}
        <p class="chase-card-score" id="mgStars">${Array.from({ length: Math.max(1, stars) }, () => '<span class="mg-star">⭐</span>').join("")}</p>
        <div class="mg-count"><span class="mg-plus">+</span><b id="mgCoinNum">0</b><span class="mg-coin" aria-hidden="true"></span></div>
        <p class="chase-card-total" id="mgTotal" aria-live="polite"></p>
        <div class="mg-rain" id="mgRain" aria-hidden="true"></div>
        ${fresh.length ? `<a class="chase-card-shop" href="#/spel/kledingkast">👕 ${SHOP[lang()] || SHOP.nl}</a>` : ""}
        ${hasNext ? `<button id="mgNext" class="chase-cta chase-cta-primary">${say("next")} →</button>` : ""}
        <button id="mgAgain" class="chase-cta ${hasNext ? "chase-cta-ghost" : "chase-cta-primary"}">${e.again}</button>
        <button id="mgBack" class="chase-cta chase-cta-ghost">${e.back}</button>
      </div>`;
    // sterren verschijnen één voor één, daarna telt de teller de verdiende munten op met een tikje per munt
    const nStars = Math.max(1, stars);
    ov.querySelectorAll(".mg-star").forEach((el, i) => setTimeout(() => { el.classList.add("on"); fx.star(i); }, 260 + i * 330));
    countUp(earned, {
      delay: 260 + nStars * 330 + 260,
      onStep: (v) => { const n = ov.querySelector("#mgCoinNum"); if (n) n.textContent = v; },
      onDone: () => {
        const r = ov.querySelector("#mgRain");
        if (r) for (let k = 0; k < 18; k++) { const c = document.createElement("i"); c.className = "mg-rainc"; c.style.left = (4 + Math.random() * 92) + "%"; c.style.animationDelay = (Math.random() * 0.5) + "s"; r.appendChild(c); setTimeout(() => c.remove(), 1900); }
        const tt = ov.querySelector("#mgTotal"), tot = Ch && Ch.coins ? Ch.coins(pid) : null;
        if (tt && tot != null) tt.textContent = (TOTAL[lang()] || TOTAL.nl) + ": 🪙 " + tot;
      },
    });
    const go = () => { ov.hidden = true; onAgain(); };
    if (hasNext) ov.querySelector("#mgNext").onclick = go; // voortgang staat al op het volgende niveau
    ov.querySelector("#mgAgain").onclick = () => { if (!plain) setPlay(pid, level); go(); };
    ov.querySelector("#mgBack").onclick = onBack;
  }

  // Arabische letter in een Phaser-tekst. De extra padding voorkomt dat de canvas van de tekst
  // boven- of onderkant van hoge/diepe letters (ا ل ج ح ع ق) afsnijdt.
  function letterText(scene, x, y, letter, px, color) {
    if (/[\u064B-\u0652]/.test(letter)) px *= 0.8; // letters met klinkerteken zijn hoger
    return scene.add.text(x, y - px * 0.14, letter, { // Arabische glyphs liggen optisch onder het tekstmidden: iets omhoog
      fontFamily: '"Amiri", serif', fontStyle: "bold", fontSize: Math.round(px) + "px", color: color || "#3a2410",
      padding: { top: Math.round(px * 0.4), bottom: Math.round(px * 0.5), left: 6, right: 6 },
    }).setOrigin(0.5);
  }

  // Spellen komen vrij naarmate Wereld 1 (Letter Oase) vordert: aantal voltooide oase-niveaus.
  const UNLOCKS = { slingshot: 0, photographer: 0, diver: 0, bridge: 0, bubbles: 0, harbor: 0, stones: 0, vloot: 0, klank: 0 }; // alle vier de spelletjes staan open vanaf level 1
  const oasisDone = (pid) => { const lv = (store.get(`gp_state_${pid}`, {}) || {}).levels || {}; return Object.keys(lv).filter((k) => k.indexOf("letter_oasis_l") === 0).length; };
  const gameOpen = (pid, key) => !!(window.Account && window.Account.isPreview && window.Account.isPreview()) || oasisDone(pid) >= (UNLOCKS[key] || 0);
  window.MiniGames = {
    fx, countUp, chestSvg: CHEST_SVG, get GROUPS() { return groups(); }, labelOf, baseOf, setWorld, worldKey: getWorldKey, isHarakat, isLong, returnHash, shuffle, say, banner, hideBanner, sfx, wait, finish, letterText,
    focusLevel, UNLOCKS, oasisDone, gameOpen, currentLevel, unlockedLevel, setPlay, completeLevel, doneLevels, pool, missionTargets, distractors,
    group: (n) => groups()[n] || groups()[0],
  };
})();
