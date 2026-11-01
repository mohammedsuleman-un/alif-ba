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
  const gameWorld = () => ((window.GAME && window.GAME.worlds) || []).find((x) => x.id === "flowers_valley") || null;
  const harakatGroups = () => { const w = gameWorld(); return w ? w.levels.filter((l) => l.letters.length).map((l) => l.letters) : []; };
  const baseOf = (x) => String(x).replace(/[ً-ْ]/g, "").replace(/[أإآ]/g, "ا");
  const uniqueBases = (g) => { const out = []; g.forEach((x) => { const b2 = baseOf(x); if (!out.includes(b2)) out.push(b2); }); return out; };
  // Welke wereld speelt het kind nu? Onthouden per tabblad zodat een spel direct na de keuze dezelfde wereld houdt.
  const WORLD_KEY = "gp_mini_world";
  const getWorldKey = () => { try { return sessionStorage.getItem(WORLD_KEY) === "harakat" ? "harakat" : "oasis"; } catch { return "oasis"; } };
  const setWorld = (w) => { try { sessionStorage.setItem(WORLD_KEY, w === "harakat" ? "harakat" : "oasis"); } catch {} };
  const isHarakat = () => getWorldKey() === "harakat" && harakatGroups().length > 0;
  const groups = () => (isHarakat() ? harakatGroups() : GROUPS_OASIS);
  const labelOf = (g) => (isHarakat() ? uniqueBases(g) : g).join(" "); // wereld 2 toont de 4 letters, niet alle 12 klanken
  const returnHash = () => "#/gamestage/games" + (isHarakat() ? "?w=2" : "");

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
    if (isHarakat()) {
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
  const key = (pid) => (isHarakat() ? "gp_mini2_" + pid : "gp_mini_" + pid);
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
  function finish(ov, { pid, level, stars, onAgain, onBack }) {
    const first = !doneLevels(pid).includes(level);
    completeLevel(pid, level);
    // Munten: volledig bij een nieuw niveau (10 + 2 per ster), klein bedrag bij herhalen.
    const earned = first ? 10 + 2 * Math.max(1, stars) : 3;
    const Ch = window.Character;
    if (Ch) Ch.addCoins(pid, earned);
    const fresh = Ch ? Ch.checkNewUnlocks(pid) : [];
    const e = END[lang()] || END.nl;
    const hasNext = currentLevel(pid) !== level; // het volgende niveau is nu vrijgespeeld
    ov.hidden = false;
    ov.innerHTML = `
      <div class="chase-card">
        <h2>${e.good}</h2>
        <p class="chase-card-level">${say("level")} ${level + 1}</p>
        <span class="chase-card-letter" lang="ar" dir="rtl">${labelOf(groups()[level])}</span>
        <p class="chase-card-score">${"⭐".repeat(Math.max(1, stars))}</p>
        <p class="chase-card-coins">+${earned} 🪙</p>
        ${fresh.length ? `<a class="chase-card-shop" href="#/spel/kledingkast">👕 ${SHOP[lang()] || SHOP.nl}</a>` : ""}
        ${hasNext ? `<button id="mgNext" class="chase-cta chase-cta-primary">${say("next")} →</button>` : ""}
        <button id="mgAgain" class="chase-cta ${hasNext ? "chase-cta-ghost" : "chase-cta-primary"}">${e.again}</button>
        <button id="mgBack" class="chase-cta chase-cta-ghost">${e.back}</button>
      </div>`;
    const go = () => { ov.hidden = true; onAgain(); };
    if (hasNext) ov.querySelector("#mgNext").onclick = go; // voortgang staat al op het volgende niveau
    ov.querySelector("#mgAgain").onclick = () => { setPlay(pid, level); go(); };
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
  const UNLOCKS = { slingshot: 0, photographer: 0, diver: 0, bridge: 0, bubbles: 0, harbor: 0 }; // alle vier de spelletjes staan open vanaf level 1
  const oasisDone = (pid) => { const lv = (store.get(`gp_state_${pid}`, {}) || {}).levels || {}; return Object.keys(lv).filter((k) => k.indexOf("letter_oasis_l") === 0).length; };
  const gameOpen = (pid, key) => !!(window.Account && window.Account.isPreview && window.Account.isPreview()) || oasisDone(pid) >= (UNLOCKS[key] || 0);
  window.MiniGames = {
    get GROUPS() { return groups(); }, labelOf, baseOf, setWorld, worldKey: getWorldKey, isHarakat, returnHash, shuffle, say, banner, hideBanner, sfx, wait, finish, letterText,
    focusLevel, UNLOCKS, oasisDone, gameOpen, currentLevel, unlockedLevel, setPlay, completeLevel, doneLevels, pool, missionTargets, distractors,
    group: (n) => groups()[n] || groups()[0],
  };
})();
