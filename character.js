// Persoonlijk leermaatje: configuratie, winkel (munten) en renderer.
// Data komt uit character-data.js (window.CHARACTER).
//
// Rendering = één scherpe, officiële illustratie per type (assets/characters/<type>/idle/default.png),
// waar in code het volgende op gebeurt (alles gecachet, eenmalig per combinatie):
//   1. huidtint (3 tinten) — alleen binnen de huidgebieden (gezicht, handen, voeten),
//   2. accentkleur (roze hijab/borduursel/schoenen) of stof- en sandaalkleur (jongen),
//   3. getekende accessoires als SVG-lagen (achter / voor het personage),
//   4. emotie = beweging + effecten (CSS), geen aparte tekeningen nodig.
// De bestaande call sites gebruiken nog steeds Character.svg(cfg, mood) (synchroon, geeft HTML);
// de gekleurde afbeelding wordt direct daarna asynchroon ingeladen (hydrate).
//
// Opslag per kindprofiel (localStorage):
//   gp_avatar_<pid>   → { v:2, type, skin, hijab, outfit, shoes, kufi, head, face, neck, hand, back, pet }
//   gp_unlocked_<pid> → ["hijab_pink", ...]   (bezit)
//   gp_state_<pid>    → .coins en .levels (gedeeld met game.js)
(() => {
  "use strict";

  const store = {
    get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  };
  const C = window.CHARACTER;
  const cfgKey = (pid) => `gp_avatar_${pid}`;
  const unlockKey = (pid) => `gp_unlocked_${pid}`;
  const stateKey = (pid) => `gp_state_${pid}`;
  const seenKey = (pid) => `gp_shelf_seen_${pid}`;

  const SLOTS = ["hijab", "outfit", "shoes", "kufi", "head", "face", "neck", "hand", "back", "pet"];
  const itemById = (id) => C.items.find((i) => i.id === id) || null;
  const forType = (i, type) => i.characterType === "both" || i.characterType === type;
  const starters = (type) => C.items.filter((i) => i.price === 0 && forType(i, type));

  // ---------- Illustratie-gegevens ----------
  // bb = bounding box van het personage in de originele afbeelding (px); skin = huidgebieden [cx, cy, rx, ry] (px);
  // a = ankerpunten in "eenheden" (breedte van het personage = 1000): hat, hatW, eyes, tilt, neck, chest, handen, achterkant.
  const ART = {
    girl: {
      src: "assets/characters/girl/idle/default.png", bb: [312, 20, 994, 1210],
      skin: [[650, 250, 135, 170], [355, 690, 75, 65], [960, 690, 65, 60], [540, 1095, 55, 50], [695, 1115, 50, 45]],
      fx: { hx: 50, hy: 19, rx: 95, ry: 56 },
      a: { H: 1745, hat: [450, 70], hatW: 420, eyeL: [408, 337], eyeR: [583, 300], eyeSep: 183, tilt: -13, neck: [510, 700], chest: [560, 905], handL: [63, 984], handR: [950, 984], back: [500, 900], petX: 835 },
    },
    boy: {
      src: "assets/characters/boy/idle/default.png", bb: [170, 36, 946, 1496],
      skin: [[520, 385, 195, 180], [335, 475, 60, 60], [688, 378, 40, 45], [240, 965, 95, 80], [880, 925, 90, 75], [290, 1405, 110, 80], [650, 1405, 110, 80], [320, 1360, 60, 45], [640, 1360, 60, 45]],
      fx: { hx: 45, hy: 24, rx: 92, ry: 61 },
      a: { H: 1881, hat: [500, 50], hatW: 470, eyeL: [367, 469], eyeR: [561, 418], eyeSep: 193, tilt: -16, neck: [455, 690], chest: [505, 860], handL: [90, 1198], handR: [915, 1146], back: [500, 1000], petX: 845 },
    },
  };
  ART.girl.ar = (ART.girl.bb[2] - ART.girl.bb[0]) / (ART.girl.bb[3] - ART.girl.bb[1]);
  ART.boy.ar = (ART.boy.bb[2] - ART.boy.bb[0]) / (ART.boy.bb[3] - ART.boy.bb[1]);

  // Leeftijdsfasen: per fase een eigen officiële tekening per type. Ontbreekt de tekening van een fase, dan
  // valt het personage terug op fase 1 (zie CHARACTER_ASSET_REQUIREMENTS.md voor wat er aangeleverd kan worden).
  const STAGES = { girl: { 1: ART.girl }, boy: { 1: ART.boy } };
  const artStage = (cfg) => (STAGES[cfg.type] && STAGES[cfg.type][cfg.stage] ? cfg.stage : 1);
  const artOf = (cfg) => STAGES[cfg.type][artStage(cfg)];

  const TONES = { light: { kl: 1.1, ks: 0.72, dh: 2 }, medium: null, dark: { kl: 0.52, ks: 0.9, dh: -4 } };

  // ---------- Kleur-helpers ----------
  function rgb2hsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const M = Math.max(r, g, b), m = Math.min(r, g, b);
    let h = 0, s = 0; const l = (M + m) / 2;
    if (M !== m) {
      const d = M - m; s = l > 0.5 ? d / (2 - M - m) : d / (M + m);
      h = M === r ? (g - b) / d + (g < b ? 6 : 0) : M === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60;
    }
    return [h, s, l];
  }
  function hsl2rgb(h, s, l) {
    h = ((h % 360) + 360) % 360 / 360;
    if (s === 0) return [l * 255, l * 255, l * 255];
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
    const f = (t) => { if (t < 0) t += 1; if (t > 1) t -= 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
    return [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255];
  }

  // ---------- Config ----------
  const hexTone = (hex) => {
    if (TONES[hex] !== undefined) return hex;
    const i = ["#fbe3c7", "#f0c294", "#d9a066", "#b97a45", "#8a5a34", "#5c3c22"].indexOf(String(hex).toLowerCase());
    return i < 0 ? "medium" : i <= 1 ? "light" : i <= 3 ? "medium" : "dark";
  };
  function normalize(cfg) {
    if (!cfg) cfg = {};
    const type = cfg.type === "girl" ? "girl" : "boy";
    const out = { v: 2, type, skin: hexTone(cfg.skin || cfg.skinTone || "medium"), stage: [1, 2, 3].includes(cfg.stage) ? cfg.stage : 1 };
    SLOTS.forEach((s) => {
      const it = cfg[s] ? itemById(cfg[s]) : null;
      if (it && it.category === s && forType(it, type)) out[s] = it.id;
    });
    ["hijab", "outfit", "shoes", "kufi"].forEach((s) => {
      if (!out[s]) { const f = starters(type).find((i) => i.category === s); if (f) out[s] = f.id; }
    });
    return out;
  }

  const Character = {
    MOODS: ["idle", "listening", "thinking", "happy", "celebrate", "encouraging", "surprised", "proud", "wave", "sad"],

    isConfigured(pid) { return !!store.get(cfgKey(pid), null); },
    getConfig(pid) {
      if (!pid) return null;
      const raw = store.get(cfgKey(pid), null);
      if (!raw) return null;
      if (raw.v === 2) return raw;
      const cfg = normalize(raw); // oude opslag (geen versie): vertalen naar het nieuwe model
      store.set(cfgKey(pid), cfg);
      store.set(unlockKey(pid), starters(cfg.type).map((i) => i.id));
      return cfg;
    },
    createConfig(pid, type, choices) {
      const cfg = normalize({ type, skin: choices && choices.skin, hijab: choices && choices.hijab, outfit: choices && choices.outfit });
      store.set(cfgKey(pid), cfg);
      store.set(unlockKey(pid), starters(type).map((i) => i.id));
      store.set(seenKey(pid), this.progress(pid));
      return cfg;
    },
    saveConfig(pid, patch) {
      const cur = this.getConfig(pid) || normalize({});
      const cfg = normalize({ ...cur, ...patch });
      store.set(cfgKey(pid), cfg);
      return cfg;
    },

    // ---------- Leeftijdsfase (het personage groeit mee met de werelden) ----------
    stageOf(pid) { const c = this.getConfig(pid); return c ? c.stage || 1 : 1; },
    setStage(pid, n) { const c = this.getConfig(pid); if (!c || (c.stage || 1) === n) return c; return this.saveConfig(pid, { stage: n }); },
    // Items die in de winkel/kast getoond worden: gratis starters, wat je al bezit, en wat bij de huidige fase past.
    isPreview() { return !!(window.Account && window.Account.isPreview && window.Account.isPreview()); }, // docent-voorbeeld
    shopItems(pid, category) {
      const cfg = this.getConfig(pid); if (!cfg) return [];
      if (this.isPreview()) return C.items.filter((i) => i.category === category && forType(i, cfg.type));
      const owned = this.getUnlocked(pid), st = cfg.stage || 1;
      return C.items.filter((i) => i.category === category && forType(i, cfg.type) && (i.price === 0 || owned.includes(i.id) || (i.stages || [1, 2, 3]).includes(st)));
    },

    // ---------- Winkel ----------
    itemsByCategory(type, category) { return C.items.filter((i) => i.category === category && forType(i, type)); },
    itemById,
    categoriesFor(type) { return C.categories.filter((c) => c.types.includes(type)); },
    getUnlocked(pid) { return store.get(unlockKey(pid), []); },
    isUnlocked(pid, id) { return this.getUnlocked(pid).includes(id); },
    unlock(pid, id) {
      const list = this.getUnlocked(pid);
      if (list.includes(id)) return false;
      list.push(id); store.set(unlockKey(pid), list); return true;
    },
    coins(pid) { return this.isPreview() ? 99999 : ((store.get(stateKey(pid), {}).coins) || 0); },
    addCoins(pid, n) {
      const st = store.get(stateKey(pid), null) || { xp: 0, coins: 0, mastery: {}, levels: {}, badges: [], lastActivity: null };
      st.coins = (st.coins || 0) + n; store.set(stateKey(pid), st); return st.coins;
    },
    // Voortgang = voltooide niveaus in de minigame-route + de oefenlevels in de wereldkaart.
    progress(pid) {
      const mini = (store.get(`gp_mini_${pid}`, {}).done || []).length;
      const lv = Object.keys(store.get(stateKey(pid), {}).levels || {}).length;
      return mini + lv;
    },
    onShelf(pid, item) { return this.isPreview() || item.shelf <= this.progress(pid); },
    levelsUntil(pid, item) { return Math.max(0, item.shelf - this.progress(pid)); },
    // koop → { ok, reason: "owned" | "locked" | "poor" }
    buy(pid, id) {
      const it = itemById(id);
      if (!it) return { ok: false, reason: "unknown" };
      if (this.isUnlocked(pid, id) || it.price === 0) { this.unlock(pid, id); return { ok: false, reason: "owned" }; }
      if (!this.onShelf(pid, it)) return { ok: false, reason: "locked" };
      if (this.coins(pid) < it.price) return { ok: false, reason: "poor" };
      if (!this.isPreview()) this.addCoins(pid, -it.price);
      this.unlock(pid, id);
      return { ok: true };
    },
    // Nieuwe winkelvoorraad sinds de vorige keer (voor de melding "nieuw in de kledingkast").
    checkNewUnlocks(pid) {
      const cfg = this.getConfig(pid); if (!cfg) return [];
      const seen = store.get(seenKey(pid), 0), now = this.progress(pid);
      store.set(seenKey(pid), now);
      return C.items.filter((i) => i.price > 0 && forType(i, cfg.type) && i.shelf > seen && i.shelf <= now);
    },

    // ---------- Renderer ----------
    // svg(cfg, mood) → HTML (synchroon). De gekleurde afbeelding komt er direct na via hydrate().
    render(cfg, mood) {
      cfg = normalize(cfg || { type: "boy" });
      mood = this.MOODS.includes(mood) ? mood : "idle";
      const A = artOf(cfg), u = "ch" + (uid++);
      const cached = imageCache.get(baseKey(cfg)) || lastUrl.get(cfg.type); // geen flits: tot de nieuwe kleur klaar is blijft de vorige staan
      const fx = A.fx;
      return `<span class="char-render" data-cfg='${JSON.stringify(cfg)}' style="--ar:${A.ar};--hx:${fx.hx}%;--hy:${fx.hy}%;--rx:${fx.rx}%;--ry:${fx.ry}%">` +
        `<span class="char-stage m-${mood}">` +
        layer(cfg, "back", u) +
        `<img class="char-base ${cached ? "ready" : ""}" src="${cached || BLANK}" alt="" draggable="false">` +
        layer(cfg, "front", u) +
        `<span class="char-fx">${fxFor(mood)}</span>` +
        `</span></span>`;
    },
    svg(cfg, mood) { return this.render(cfg, mood); },
    // Voor Phaser/canvas: URL van de gekleurde basisafbeelding (zonder accessoires).
    imageUrl(cfg) { return buildBase(normalize(cfg)); },
    hydrate,
  };

  let uid = 1;
  const BLANK = "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";

  // ---------- Gekleurde basisafbeelding ----------
  const imageCache = new Map(), pending = new Map(), srcCache = new Map(), lastUrl = new Map();
  const baseKey = (cfg) => [cfg.type, artStage(cfg), cfg.skin, cfg.hijab, cfg.outfit, cfg.shoes, cfg.kufi].join("|");
  function loadImg(src) {
    if (!srcCache.has(src)) srcCache.set(src, new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = src; }));
    return srcCache.get(src);
  }

  function accentOf(id) { const it = itemById(id); return it ? C.accents[it.color] : null; }
  function clothOf(id) { const it = itemById(id); return it ? C.cloths[it.color] : null; }

  function buildBase(cfg) {
    const key = baseKey(cfg);
    if (imageCache.has(key)) return Promise.resolve(imageCache.get(key));
    if (pending.has(key)) return pending.get(key);
    const p = loadImg(artOf(cfg).src).then((img) => {
      const A = artOf(cfg), [x0, y0, x1, y1] = A.bb, w = x1 - x0, h = y1 - y0;
      const OH = 720, OW = Math.round(OH * w / h), sc = OW / w;
      const cv = document.createElement("canvas"); cv.width = OW; cv.height = OH;
      const cx = cv.getContext("2d", { willReadFrequently: true });
      cx.drawImage(img, x0, y0, w, h, 0, 0, OW, OH);
      process(cx, OW, OH, cfg, A, sc);
      return new Promise((res) => cv.toBlob((blob) => {
        const url = blob ? URL.createObjectURL(blob) : cv.toDataURL("image/png");
        imageCache.set(key, url); lastUrl.set(cfg.type, url); pending.delete(key); res(url);
      }, "image/png"));
    });
    pending.set(key, p);
    return p;
  }

  function process(cx, W, H, cfg, A, sc) {
    const tone = TONES[cfg.skin];
    const outfit = clothOf(cfg.outfit), kufi = clothOf(cfg.kufi);
    const acc = cfg.type === "girl" ? accentOf(cfg.hijab) : null;
    const shoeAcc = cfg.type === "girl" ? accentOf(cfg.shoes) : null;
    const sandal = cfg.type === "boy" ? ((itemById(cfg.shoes) && C.sandals[itemById(cfg.shoes).color]) || null) : null;
    const plain = !tone && (!outfit || outfit.none) && (!kufi || kufi.none) && (!acc || (!acc.sh && !acc.white && !acc.black))
      && (!shoeAcc || (!shoeAcc.sh && !shoeAcc.white && !shoeAcc.black)) && (!sandal || sandal.none);
    if (plain) return;
    const d = cx.getImageData(0, 0, W, H), p = d.data;
    const [bx0, by0] = A.bb;
    const regions = A.skin.map(([x, y, rx, ry]) => [(x - bx0) * sc, (y - by0) * sc, rx * sc, ry * sc]);
    const inSkin = (px, py) => { for (let i = 0; i < regions.length; i++) { const r = regions[i], dx = (px - r[0]) / r[2], dy = (py - r[1]) / r[3]; if (dx * dx + dy * dy <= 1) return true; } return false; };
    const applyAccent = (a, h, s, l) => {
      if (a.white) return hsl2rgb(h, s * 0.08, Math.min(0.97, 0.55 + l * 0.45));
      if (a.black) return hsl2rgb(h, s * 0.12, l * 0.35);
      return hsl2rgb(h + (a.sh || 0), Math.min(1, s * (a.ks || 1)), Math.max(0.05, Math.min(0.95, l + (a.dl || 0))));
    };
    const tint = (t, k, i, l) => {
      const [r, g, b] = hsl2rgb(t.h, t.s, Math.min(0.96, l * (t.lf || 0.97)));
      p[i] = p[i] * (1 - k) + r * k; p[i + 1] = p[i + 1] * (1 - k) + g * k; p[i + 2] = p[i + 2] * (1 - k) + b * k;
    };
    for (let py = 0; py < H; py++) {
      const ny = py / H;
      for (let px = 0; px < W; px++) {
        const i = (py * W + px) * 4;
        if (p[i + 3] < 10) continue;
        const r = p[i] / 255, g = p[i + 1] / 255, b = p[i + 2] / 255;
        const M = Math.max(r, g, b), m = Math.min(r, g, b), chroma = M - m;
        // 1. stof (weinig kleur, licht): jurk/thobe en kufi — nooit binnen de huidgebieden
        if (chroma < 0.3 && (M + m) / 2 > 0.45 && !inSkin(px, py)) {
          const l = (M + m) / 2, k = Math.max(0, Math.min(1, (0.3 - chroma) / 0.14));
          if (cfg.type === "boy" && ny < 0.17 && kufi && !kufi.none) { tint(kufi, k, i, l); continue; }
          if (ny > (cfg.type === "girl" ? 0.36 : 0.37) && ny < 0.935 && outfit && !outfit.none) { tint(outfit, k, i, l); continue; }
        }
        const [h, s, l] = rgb2hsl(p[i], p[i + 1], p[i + 2]);
        // 2. huid
        if (tone && h >= 6 && h <= 36 && s > 0.2 && l > 0.45 && l < 0.84 && inSkin(px, py)) {
          const rgb = hsl2rgb(h + tone.dh, Math.min(1, s * tone.ks), Math.min(0.9, l * tone.kl));
          p[i] = rgb[0]; p[i + 1] = rgb[1]; p[i + 2] = rgb[2]; continue;
        }
        // 3. meisje: roze accent (hijab/borduursel boven, schoenen onder)
        if (cfg.type === "girl" && (h >= 338 || h <= 7) && s > 0.32 && l > 0.3 && l < 0.85) {
          const a = ny > 0.905 ? shoeAcc : acc;
          if (a) { const rgb = applyAccent(a, h, s, l); p[i] = rgb[0]; p[i + 1] = rgb[1]; p[i + 2] = rgb[2]; }
          continue;
        }
        // 4. jongen: bruine sandalen
        if (cfg.type === "boy" && ny > 0.9 && sandal && !sandal.none && h >= 8 && h <= 40 && s > 0.25 && l > 0.12 && l < 0.5) {
          const rgb = hsl2rgb(sandal.h != null ? sandal.h : h, sandal.s != null ? sandal.s : s, l * (sandal.lf || 1));
          p[i] = rgb[0]; p[i + 1] = rgb[1]; p[i + 2] = rgb[2];
        }
      }
    }
    cx.putImageData(d, 0, 0);
  }

  // ---------- Hydrate: gekleurde afbeelding in de DOM zetten ----------
  function hydrate(el) {
    if (!el || el.dataset.h) return;
    el.dataset.h = "1";
    let cfg; try { cfg = JSON.parse(el.dataset.cfg); } catch { return; }
    const img = el.querySelector(".char-base"); if (!img) return;
    buildBase(cfg).then((url) => { img.src = url; img.classList.add("ready"); }).catch(() => { img.src = artOf(cfg).src; img.classList.add("ready"); });
  }
  function hydrateIn(root) {
    if (!root || root.nodeType !== 1) return;
    if (root.matches && root.matches(".char-render")) hydrate(root);
    if (root.querySelectorAll) root.querySelectorAll(".char-render:not([data-h])").forEach(hydrate);
  }
  const start = () => {
    hydrateIn(document.body);
    new MutationObserver((muts) => muts.forEach((m) => m.addedNodes.forEach(hydrateIn))).observe(document.body, { childList: true, subtree: true });
    Object.keys(ART).forEach((t) => loadImg(ART[t].src).catch(() => {}));
  };
  if (document.body) start(); else document.addEventListener("DOMContentLoaded", start);

  // ---------- Getekende accessoires ----------
  const grad = (id, a, b, h) => `<linearGradient id="${id}" x1="0" y1="0" x2="${h ? 1 : 0}" y2="${h ? 0 : 1}"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>`;
  const star = (x, y, r, fill, stroke) => {
    const pts = Array.from({ length: 10 }, (_, i) => { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; return `${(x + Math.cos(a) * rr).toFixed(1)},${(y + Math.sin(a) * rr).toFixed(1)}`; }).join(" ");
    return `<polygon points="${pts}" fill="${fill}" stroke="${stroke || "#c98200"}" stroke-width="${r * 0.08}" stroke-linejoin="round"/>`;
  };
  const OUT = "#3a2a1e";

  const ART_FN = {
    starband(A, u) {
      const [x, y] = A.hat, w = A.hatW;
      return `<defs>${grad(u + "s", "#fff08a", "#f4a62a")}</defs><g transform="translate(${x} ${y + 70}) rotate(${A.tilt * 0.6})">
        <path d="M${-w * 0.52} 70 Q0 -60 ${w * 0.52} 70" fill="none" stroke="#ff5f96" stroke-width="34" stroke-linecap="round"/>
        <path d="M${-w * 0.5} 62 Q0 -66 ${w * 0.5} 62" fill="none" stroke="#ff9fc0" stroke-width="11" stroke-linecap="round" opacity=".8"/>
        ${star(0, -42, 78, `url(#${u}s)`)}</g>`;
    },
    party(A, u) {
      const [x, y] = A.hat;
      return `<defs>${grad(u + "p", "#ff7aa8", "#b94fe0")}</defs><g transform="translate(${x} ${y + 60}) rotate(${A.tilt * 0.8})">
        <path d="M-115 0 L0 -285 L115 0 Q0 28 -115 0Z" fill="url(#${u}p)" stroke="#8a2ea8" stroke-width="7" stroke-linejoin="round"/>
        <circle cx="-30" cy="-110" r="14" fill="#fff" opacity=".85"/><circle cx="26" cy="-165" r="12" fill="#ffe27a"/><circle cx="-4" cy="-55" r="12" fill="#7fe0ff"/><circle cx="45" cy="-70" r="10" fill="#fff" opacity=".85"/>
        <ellipse cx="0" cy="4" rx="122" ry="22" fill="#ffd23f" stroke="#c98200" stroke-width="6"/>
        <circle cx="0" cy="-290" r="32" fill="#ffe27a" stroke="#c98200" stroke-width="6"/></g>`;
    },
    flowers(A) {
      const [x, y] = A.hat; const cols = ["#ff8fb8", "#ffd23f", "#ffffff", "#ff8fb8", "#ffd23f"];
      const flowers = cols.map((c, i) => {
        const t = i / 4, fx = x - 200 + 400 * t, fy = y + 115 - 75 * Math.sin(Math.PI * t);
        const petals = [0, 72, 144, 216, 288].map((a) => `<circle cx="${Math.cos(a * Math.PI / 180) * 24}" cy="${Math.sin(a * Math.PI / 180) * 24}" r="21" fill="${c}" stroke="#d96a95" stroke-width="3"/>`).join("");
        return `<g transform="translate(${fx.toFixed(0)} ${fy.toFixed(0)})">${petals}<circle r="15" fill="#ffb22e" stroke="#c98200" stroke-width="3"/></g>`;
      }).join("");
      return `<g transform="rotate(${A.tilt * 0.4} ${x} ${y + 100})"><path d="M${x - 215} ${y + 118} Q${x} ${y - 55} ${x + 215} ${y + 118}" fill="none" stroke="#4ea85f" stroke-width="16" stroke-linecap="round"/>${flowers}</g>`;
    },
    crown(A, u) {
      const [x, y] = A.hat, w = A.hatW * 0.66;
      return `<defs>${grad(u + "c", "#ffe27a", "#e8a21a")}</defs><g transform="translate(${x} ${y + 90}) rotate(${A.tilt * 0.8})">
        <path d="M${-w / 2} 0 L${-w / 2} -95 L${-w / 4} -45 L0 -130 L${w / 4} -45 L${w / 2} -95 L${w / 2} 0 Q0 22 ${-w / 2} 0Z" fill="url(#${u}c)" stroke="#a8730d" stroke-width="7" stroke-linejoin="round"/>
        <circle cx="0" cy="-30" r="17" fill="#e5304a" stroke="#fff" stroke-width="4"/><circle cx="${-w / 3.2}" cy="-20" r="12" fill="#3aa0e8" stroke="#fff" stroke-width="3"/><circle cx="${w / 3.2}" cy="-20" r="12" fill="#3ac47a" stroke="#fff" stroke-width="3"/>
        <circle cx="0" cy="-134" r="12" fill="#fff4b0" stroke="#a8730d" stroke-width="4"/></g>`;
    },
    glasses(A) {
      const r = A.eyeSep * 0.36, [lx, ly] = A.eyeL, [rx, ry] = A.eyeR;
      const lens = (x, y) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#cfeeff" fill-opacity=".28" stroke="#2f5fa8" stroke-width="12"/><path d="M${x - r * 0.55} ${y - r * 0.35} Q${x - r * 0.25} ${y - r * 0.75} ${x + r * 0.2} ${y - r * 0.65}" stroke="#fff" stroke-width="9" fill="none" stroke-linecap="round" opacity=".75"/>`;
      return `${lens(lx, ly)}${lens(rx, ry)}<path d="M${lx + r} ${ly - 8} Q${(lx + rx) / 2} ${(ly + ry) / 2 - 34} ${rx - r} ${ry - 8}" stroke="#2f5fa8" stroke-width="11" fill="none" stroke-linecap="round"/>
        <path d="M${lx - r} ${ly} L${lx - r - 70} ${ly - 22}M${rx + r} ${ry} L${rx + r + 50} ${ry - 20}" stroke="#2f5fa8" stroke-width="10" stroke-linecap="round"/>`;
    },
    sunglasses(A, u) {
      const r = A.eyeSep * 0.4, [lx, ly] = A.eyeL, [rx, ry] = A.eyeR;
      const lens = (x, y) => `<rect x="${x - r}" y="${y - r * 0.72}" width="${r * 2}" height="${r * 1.45}" rx="${r * 0.55}" fill="url(#${u}g)" stroke="#16161c" stroke-width="9" transform="rotate(${A.tilt} ${x} ${y})"/>
        <path d="M${x - r * 0.6} ${y - r * 0.25} L${x - r * 0.1} ${y - r * 0.55}" stroke="#fff" stroke-width="9" stroke-linecap="round" opacity=".5" transform="rotate(${A.tilt} ${x} ${y})"/>`;
      return `<defs>${grad(u + "g", "#4a4a58", "#14141a")}</defs>${lens(lx, ly)}${lens(rx, ry)}<path d="M${lx + r} ${ly - 8} Q${(lx + rx) / 2} ${(ly + ry) / 2 - 30} ${rx - r} ${ry - 8}" stroke="#16161c" stroke-width="11" fill="none" stroke-linecap="round"/>`;
    },
    bowtie(A, u) {
      const [x, y] = A.neck;
      return `<defs>${grad(u + "b", "#ff5a6e", "#c9243c")}</defs><g transform="translate(${x} ${y + 25}) rotate(${A.tilt * 0.3})">
        <path d="M0 0 L-105 -52 Q-120 0 -105 52Z" fill="url(#${u}b)" stroke="#8a1626" stroke-width="6" stroke-linejoin="round"/>
        <path d="M0 0 L105 -52 Q120 0 105 52Z" fill="url(#${u}b)" stroke="#8a1626" stroke-width="6" stroke-linejoin="round"/>
        <rect x="-24" y="-30" width="48" height="60" rx="14" fill="#e03a52" stroke="#8a1626" stroke-width="6"/>
        <circle cx="-62" cy="-8" r="7" fill="#fff" opacity=".7"/><circle cx="62" cy="-8" r="7" fill="#fff" opacity=".7"/></g>`;
    },
    scarf(A, u) {
      const [x, y] = A.neck;
      return `<defs>${grad(u + "f", "#4aa3e8", "#2f78c0")}</defs><g transform="translate(${x} ${y + 40}) rotate(${A.tilt * 0.4})">
        <path d="M-170 -10 Q0 85 170 -10 L160 52 Q0 150 -160 52Z" fill="url(#${u}f)" stroke="#1f5a98" stroke-width="7" stroke-linejoin="round"/>
        <path d="M-120 20 Q0 100 120 20" stroke="#fff" stroke-width="14" fill="none" opacity=".55" stroke-linecap="round"/>
        <path d="M70 70 L135 70 L150 250 Q108 275 66 250Z" fill="url(#${u}f)" stroke="#1f5a98" stroke-width="7" stroke-linejoin="round"/>
        <path d="M82 120 L140 120M80 175 L146 175" stroke="#fff" stroke-width="13" opacity=".55"/></g>`;
    },
    medal(A, u) {
      const [x, y] = A.neck, [, cy] = A.chest;
      return `<defs>${grad(u + "m", "#ffe27a", "#e0a01a")}</defs><g transform="translate(${x} 0)">
        <path d="M-80 ${y + 20} L-20 ${cy - 35} L40 ${cy - 35} L-22 ${y + 20}Z" fill="#e5304a"/><path d="M80 ${y + 20} L20 ${cy - 35} L-40 ${cy - 35} L22 ${y + 20}Z" fill="#fff" stroke="#e5304a" stroke-width="4"/>
        <circle cx="0" cy="${cy + 25}" r="72" fill="url(#${u}m)" stroke="#a8730d" stroke-width="8"/><circle cx="0" cy="${cy + 25}" r="52" fill="none" stroke="#fff3b0" stroke-width="6"/>
        ${star(0, cy + 25, 40, "#fff8d6", "#c98200")}</g>`;
    },
    balloon(A, u) {
      const [x, y] = A.handR;
      return `<defs><radialGradient id="${u}r" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#ff9aa8"/><stop offset="1" stop-color="#d4243e"/></radialGradient></defs>
        <path d="M${x - 8} ${y - 20} Q${x - 30} ${y - 200} ${x - 36} ${y - 330}" stroke="#7a5a3a" stroke-width="5" fill="none"/>
        <g transform="translate(${x - 40} ${y - 470}) rotate(${-6})"><ellipse rx="125" ry="150" fill="url(#${u}r)" stroke="#9c1830" stroke-width="7"/><path d="M-30 150 L0 188 L30 150Z" fill="#d4243e" stroke="#9c1830" stroke-width="5" stroke-linejoin="round"/>
        <ellipse cx="-52" cy="-62" rx="28" ry="46" fill="#fff" opacity=".45" transform="rotate(25 -52 -62)"/></g>`;
    },
    lantern(A, u) {
      const [x, y] = A.handL;
      return `<defs>${grad(u + "l", "#ff8a4a", "#d93a2a")}<radialGradient id="${u}w"><stop offset="0" stop-color="#ffe27a" stop-opacity=".85"/><stop offset="1" stop-color="#ffe27a" stop-opacity="0"/></radialGradient></defs>
        <circle cx="${x + 30}" cy="${y + 190}" r="190" fill="url(#${u}w)"/>
        <path d="M${x + 5} ${y + 8} Q${x + 30} ${y + 60} ${x + 30} ${y + 100}" stroke="#7a5a3a" stroke-width="7" fill="none"/>
        <g transform="translate(${x + 30} ${y + 100}) scale(1.4)"><rect x="-30" y="-6" width="60" height="22" rx="8" fill="#e8a21a" stroke="#a8730d" stroke-width="5"/>
        <path d="M-50 16 Q-62 90 -42 150 L42 150 Q62 90 50 16Z" fill="url(#${u}l)" stroke="#8a2a1a" stroke-width="6" stroke-linejoin="round"/>
        <path d="M-26 28 Q-30 90 -20 140M0 24 L0 144M26 28 Q30 90 20 140" stroke="#ffe27a" stroke-width="6" fill="none" opacity=".8"/>
        <rect x="-36" y="146" width="72" height="20" rx="8" fill="#e8a21a" stroke="#a8730d" stroke-width="5"/></g>`;
    },
    butterfly(A, u) {
      const [x, y] = A.back;
      const wing = (s) => `<g transform="translate(${x} ${y - 150}) scale(${s * 1.25} 1.25)">
        <path d="M30 -40 C150 -330 420 -330 400 -120 C390 -30 220 10 30 20Z" fill="url(#${u}a)" stroke="#8a4ec0" stroke-width="8"/>
        <path d="M30 40 C160 40 360 40 330 220 C310 330 150 300 40 110Z" fill="url(#${u}b)" stroke="#8a4ec0" stroke-width="8"/>
        <circle cx="250" cy="-130" r="48" fill="#fff" opacity=".55"/><circle cx="170" cy="-215" r="26" fill="#fff" opacity=".5"/><circle cx="215" cy="150" r="34" fill="#fff" opacity=".5"/></g>`;
      return `<defs>${grad(u + "a", "#ff9bd0", "#b06af0", 1)}${grad(u + "b", "#9ad0ff", "#b06af0", 1)}</defs>${wing(1)}${wing(-1)}`;
    },
    cap(A, u) {
      const [x, y] = A.hat, w = A.hatW * 0.62;
      return `<defs>${grad(u + "c", "#5a9cf0", "#2b5fb8")}</defs><g transform="translate(${x} ${y + 165}) rotate(${A.tilt * 0.8})">
        <path d="M${-w / 2} 0 Q${-w / 2} ${-w * 0.6} 0 ${-w * 0.6} Q${w / 2} ${-w * 0.6} ${w / 2} 0Z" fill="url(#${u}c)" stroke="#1d4585" stroke-width="7" stroke-linejoin="round"/>
        <path d="M${-w * 0.45} -6 L${w * 0.5} -6 Q${w * 0.98} 6 ${w * 0.84} 36 Q${w * 0.15} 26 ${-w * 0.45} 8Z" fill="#2b5fb8" stroke="#1d4585" stroke-width="7" stroke-linejoin="round"/>
        <circle cx="0" cy="${-w * 0.6}" r="14" fill="#2b5fb8" stroke="#1d4585" stroke-width="5"/>
        <path d="M${-w * 0.3} ${-w * 0.32} Q0 ${-w * 0.52} ${w * 0.3} ${-w * 0.32}" stroke="#fff" stroke-width="9" fill="none" opacity=".35" stroke-linecap="round"/></g>`;
    },
    headphones(A) {
      const [x, y] = A.hat, ex = (A.eyeL[0] + A.eyeR[0]) / 2, ey = (A.eyeL[1] + A.eyeR[1]) / 2, dx = A.hatW * 0.5, cy = ey + 10;
      const cup = (cx) => `<rect x="${cx - 36}" y="${cy - 74}" width="72" height="148" rx="32" fill="#e5304a" stroke="#2a2a34" stroke-width="9"/><rect x="${cx - 18}" y="${cy - 40}" width="36" height="80" rx="16" fill="#ff7a8a" opacity=".7"/>`;
      return `<g transform="rotate(${A.tilt * 0.5} ${ex} ${ey})"><path d="M${ex - dx} ${cy} Q${ex - dx} ${y + 30} ${ex} ${y + 14} Q${ex + dx} ${y + 30} ${ex + dx} ${cy}" fill="none" stroke="#2a2a34" stroke-width="30" stroke-linecap="round"/>
        <path d="M${ex - dx + 4} ${cy - 40} Q${ex - dx + 8} ${y + 50} ${ex} ${y + 34}" fill="none" stroke="#6a6a7a" stroke-width="8" stroke-linecap="round" opacity=".7"/>${cup(ex - dx)}${cup(ex + dx)}</g>`;
    },
    watch(A) {
      const [x, y] = A.handL;
      return `<g transform="translate(${x + 78} ${y - 38}) rotate(-28)"><rect x="-34" y="-58" width="68" height="116" rx="16" fill="#3a4a6a" stroke="#1e2a44" stroke-width="7"/>
        <circle r="46" fill="#fff" stroke="#1e2a44" stroke-width="8"/><circle r="38" fill="#eaf4ff"/><path d="M0 0 L0 -26M0 0 L18 8" stroke="#1e2a44" stroke-width="7" stroke-linecap="round"/><circle r="5" fill="#e5304a"/></g>`;
    },
    tasbih(A, u) {
      const [x, y] = A.handR;
      const beads = Array.from({ length: 17 }, (_, i) => { const t = i / 16; return `<circle cx="${(x - 30 - 70 * Math.sin(Math.PI * t)).toFixed(1)}" cy="${(y + 10 + 200 * t).toFixed(1)}" r="16" fill="url(#${u}t)" stroke="#146a58" stroke-width="3"/>`; }).join("");
      return `<defs><radialGradient id="${u}t" cx=".35" cy=".3"><stop offset="0" stop-color="#8ff0d0"/><stop offset="1" stop-color="#1f9e80"/></radialGradient></defs>${beads}
        <path d="M${x - 30} ${y + 215} L${x - 30} ${y + 285}" stroke="#146a58" stroke-width="9" stroke-linecap="round"/><ellipse cx="${x - 30}" cy="${y + 292}" rx="14" ry="22" fill="#1f9e80" stroke="#146a58" stroke-width="3"/>`;
    },
    quran(A, u) {
      const [x, y] = A.handR;
      return `<defs>${grad(u + "q", "#2fae7c", "#17795a")}</defs><g transform="translate(${x - 92} ${y - 120}) rotate(12) scale(1.3)">
        <rect x="-62" y="-80" width="124" height="164" rx="12" fill="url(#${u}q)" stroke="#0f5a40" stroke-width="7"/><rect x="-48" y="-66" width="96" height="136" rx="8" fill="none" stroke="#f2c14e" stroke-width="5"/>
        <circle cx="0" cy="-8" r="26" fill="none" stroke="#f2c14e" stroke-width="5"/>${star(0, -8, 16, "#f2c14e", "#b8861e")}<rect x="-30" y="34" width="60" height="7" rx="3" fill="#f2c14e"/></g>`;
    },
    backpack(A, u) {
      const [nx, ny] = A.neck, [cx, cy] = A.chest, [bx, by] = A.back;
      const strap = (s) => `<path d="M${nx + s * 100} ${ny - 40} Q${nx + s * 170} ${cy - 40} ${cx + s * 130} ${cy + 250}" fill="none" stroke="#2a62b8" stroke-width="44" stroke-linecap="round"/><path d="M${nx + s * 100} ${ny - 40} Q${nx + s * 170} ${cy - 40} ${cx + s * 130} ${cy + 250}" fill="none" stroke="#5a96e8" stroke-width="14" stroke-linecap="round" opacity=".6"/><rect x="${cx + s * 130 - 20}" y="${cy + 120}" width="40" height="30" rx="6" fill="#e8c34a" stroke="#a8841a" stroke-width="4"/>`;
      return {
        back: `<defs>${grad(u + "k", "#4a86e0", "#2a56a8")}</defs><rect x="${bx - 300}" y="${ny - 70}" width="600" height="560" rx="110" fill="url(#${u}k)" stroke="#1d3f80" stroke-width="10"/><rect x="${bx - 130}" y="${ny + 230}" width="260" height="170" rx="54" fill="#3a70c8" stroke="#1d3f80" stroke-width="8"/>`,
        front: strap(-1) + strap(1),
      };
    },
    duck(A) {
      const x = A.petX, y = A.H - 95;
      return `<g transform="translate(${x - 20} ${y - 40}) scale(1.55)"><ellipse cx="0" cy="62" rx="88" ry="14" fill="#000" opacity=".12"/>
        <ellipse cx="0" cy="12" rx="78" ry="58" fill="#ffd93d" stroke="#d99a00" stroke-width="6"/><path d="M-62 4 Q-92 -6 -88 30 Q-74 26 -50 28Z" fill="#ffc700" stroke="#d99a00" stroke-width="5"/>
        <circle cx="38" cy="-48" r="44" fill="#ffd93d" stroke="#d99a00" stroke-width="6"/><path d="M66 -44 L112 -34 L68 -18Z" fill="#ff8a3a" stroke="#c9601a" stroke-width="5" stroke-linejoin="round"/>
        <circle cx="46" cy="-58" r="8" fill="#2a1c12"/><circle cx="49" cy="-61" r="3" fill="#fff"/><ellipse cx="14" cy="-30" rx="9" ry="6" fill="#ff9aa8" opacity=".7"/></g>`;
    },
    cat(A) {
      const x = A.petX, y = A.H - 105;
      return `<g transform="translate(${x - 30} ${y - 55}) scale(1.5)"><ellipse cx="0" cy="78" rx="96" ry="14" fill="#000" opacity=".12"/>
        <path d="M70 40 Q150 20 135 -50 Q130 -80 108 -60" fill="none" stroke="#e08a3a" stroke-width="22" stroke-linecap="round"/>
        <ellipse cx="0" cy="26" rx="82" ry="58" fill="#f2a14e" stroke="#b86a1e" stroke-width="6"/><path d="M-34 -14 L-30 28M0 -20 L0 24M34 -14 L30 28" stroke="#c97420" stroke-width="9" stroke-linecap="round"/>
        <path d="M-70 -46 L-62 -108 L-18 -72Z M70 -46 L62 -108 L18 -72Z" fill="#f2a14e" stroke="#b86a1e" stroke-width="6" stroke-linejoin="round"/>
        <ellipse cx="0" cy="-50" rx="64" ry="54" fill="#f2a14e" stroke="#b86a1e" stroke-width="6"/>
        <ellipse cx="-24" cy="-56" rx="9" ry="12" fill="#2a1c12"/><ellipse cx="24" cy="-56" rx="9" ry="12" fill="#2a1c12"/><circle cx="-21" cy="-61" r="3.5" fill="#fff"/><circle cx="27" cy="-61" r="3.5" fill="#fff"/>
        <path d="M-6 -36 L6 -36 L0 -28Z" fill="#ff7a8a"/><path d="M0 -28 Q-10 -16 -20 -22M0 -28 Q10 -16 20 -22" stroke="#7a4a22" stroke-width="4" fill="none" stroke-linecap="round"/>
        <path d="M-50 -38 L-96 -44M-50 -28 L-94 -22M50 -38 L96 -44M50 -28 L94 -22" stroke="#7a4a22" stroke-width="3" opacity=".6"/></g>`;
    },
  };
  const BACK_ART = new Set(["butterfly"]);

  function layer(cfg, which, u) {
    const A = artOf(cfg).a;
    const parts = [];
    ["back", "pet", "hand", "neck", "face", "head"].forEach((slot) => {
      const it = cfg[slot] ? itemById(cfg[slot]) : null;
      if (!it || !ART_FN[it.art]) return;
      const out = ART_FN[it.art](A, u + slot);
      if (typeof out === "object") { if (out[which]) parts.push(out[which]); return; } // tekening met een achter- en voorkant
      const isBack = BACK_ART.has(it.art);
      if ((which === "back") !== isBack) return;
      parts.push(out);
    });
    if (!parts.length) return "";
    return `<svg class="char-layer char-layer-${which}" viewBox="0 0 1000 ${A.H}" preserveAspectRatio="none" aria-hidden="true">${parts.join("")}</svg>`;
  }

  // ---------- Emoties: effecten (de bewegingen staan in character.css) ----------
  function fxFor(mood) {
    const i = (n, fn) => Array.from({ length: n }, (_, k) => fn(k)).join("");
    switch (mood) {
      case "happy": return i(4, (k) => `<i class="fx-heart" style="--d:${k * 0.45}s;--x:${(k - 1.5) * 16}px">❤</i>`);
      case "celebrate": return i(10, (k) => `<i class="fx-conf" style="--d:${(k % 5) * 0.18}s;--x:${(k - 4.5) * 17}px;--c:${["#ff5a6e", "#ffd23f", "#4aa3e8", "#58cc02", "#b06af0"][k % 5]}"></i>`) + `<i class="fx-spark" style="--d:0s">✨</i><i class="fx-spark" style="--d:.4s;left:70%">✨</i>`;
      case "thinking": return `<span class="fx-think">💭</span><b class="fx-q">?</b>`;
      case "encouraging": return `<span class="fx-pop">💪</span>`;
      case "surprised": return `<b class="fx-bang">!</b>`;
      case "proud": return i(3, (k) => `<i class="fx-spark" style="--d:${k * 0.35}s;left:${30 + k * 22}%">✨</i>`);
      case "listening": return `<svg class="fx-wave" viewBox="0 0 60 60"><path d="M10 18 Q22 30 10 42M22 12 Q40 30 22 48M34 6 Q58 30 34 54" fill="none" stroke="#3a8fd9" stroke-width="4" stroke-linecap="round"/></svg>`;
      case "wave": return `<span class="fx-hand">👋</span>`;
      case "sad": return `<i class="fx-drop">💧</i>`;
      default: return "";
    }
  }

  window.Character = Character;
})();
