// Persoonlijk leermaatje: configuratie, unlocks en renderer.
// Data komt uit character-data.js (window.CHARACTER); dit bestand bevat alleen
// logica, net zoals game.js los staat van game-data.js.
//
// Opslag (zelfde patroon als de rest van de app — localStorage, per kindprofiel):
//   gp_avatar_<profileId>    → { type, skinTone, outfit, hijab, shoes, accessory }
//   gp_unlocked_<profileId>  → ["outfit_boy_starter", "shoes_brown", ...]
//
// Unlocks worden niet apart bijgehouden als losse voortgang — ze worden
// AFGELEID van de bestaande spelvoortgang (state.levels / sterren / wereld-
// voltooiing in game.js), zodat er geen tweede, concurrerende bron van
// waarheid ontstaat (zie CHARACTER.items in character-data.js voor de regels).
(() => {
  "use strict";

  const store = {
    get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  };
  const C = window.CHARACTER || { skinTones: ["#e8b489"], items: [] };
  const cfgKey = (pid) => `gp_avatar_${pid}`;
  const unlockKey = (pid) => `gp_unlocked_${pid}`;

  function starterItemsFor(type) {
    return C.items.filter((i) => i.unlockType === "starter" && (i.characterType === "both" || i.characterType === type));
  }

  const Character = {
    MOODS: ["idle", "listening", "thinking", "happy", "celebrate", "encouraging", "surprised", "proud", "wave"],

    isConfigured(pid) { return !!store.get(cfgKey(pid), null); },
    getConfig(pid) { return pid ? store.get(cfgKey(pid), null) : null; },

    // Maakt het personage aan. `choices` = { skinTone, outfit, hijab } — expliciete
    // keuzes uit de onboarding-wizard. Alle starter-items voor dit type worden
    // meteen "unlocked" (zodat een kind ook nadien nog tussen de starter-opties
    // kan wisselen in de kledingkast), maar alleen de gekozen items staan aan.
    createConfig(pid, type, choices) {
      const starters = starterItemsFor(type);
      const cfg = { type, skinTone: (choices && choices.skinTone) || C.skinTones[1] };
      ["outfit", "hijab", "shoes", "accessory"].forEach((cat) => {
        const chosen = choices && choices[cat];
        const fallback = starters.find((i) => i.category === cat);
        if (chosen || fallback) cfg[cat] = chosen || fallback.id;
      });
      store.set(cfgKey(pid), cfg);
      store.set(unlockKey(pid), starters.map((i) => i.id));
      return cfg;
    },
    saveConfig(pid, patch) {
      const cfg = { ...(this.getConfig(pid) || {}), ...patch };
      store.set(cfgKey(pid), cfg);
      return cfg;
    },

    getUnlocked(pid) { return store.get(unlockKey(pid), []); },
    isUnlocked(pid, itemId) { return this.getUnlocked(pid).includes(itemId); },
    unlock(pid, itemId) {
      const list = this.getUnlocked(pid);
      if (list.includes(itemId)) return false;
      list.push(itemId);
      store.set(unlockKey(pid), list);
      return true;
    },

    itemsByCategory(type, category) {
      return C.items.filter((i) => i.category === category && (i.characterType === "both" || i.characterType === type));
    },
    itemById(id) { return C.items.find((i) => i.id === id) || null; },

    // Bepaalt welke items er sinds de vorige check nieuw zijn vrijgespeeld,
    // op basis van de bestaande spelvoortgang (game.js' state + G.worlds).
    // Roept nergens spellogica aan en verandert geen voortgang — puur afleiden.
    checkNewUnlocks(pid, gstate, worlds) {
      const cfg = this.getConfig(pid);
      if (!cfg) return [];
      const levelsDone = Object.keys(gstate.levels || {}).length;
      const totalStars = Object.values(gstate.levels || {}).reduce((s, l) => s + (l.stars || 0), 0);
      const completedWorldIds = (worlds || []).filter((w) => {
        const last = w.levels[w.levels.length - 1];
        return !!(gstate.levels && gstate.levels[`${w.id}_l${last.n}`]);
      }).map((w) => w.id);

      const newly = [];
      C.items.forEach((item) => {
        if (item.unlockType === "starter") return;
        if (item.characterType !== "both" && item.characterType !== cfg.type) return;
        if (this.isUnlocked(pid, item.id)) return;
        let earned = false;
        if (item.unlockType === "level") earned = levelsDone >= item.unlockValue;
        else if (item.unlockType === "stars") earned = totalStars >= item.unlockValue;
        else if (item.unlockType === "world") earned = completedWorldIds.includes(item.unlockValue);
        if (earned && this.unlock(pid, item.id)) newly.push(item);
      });
      return newly;
    },

    // ---------- CharacterRenderer ----------
    // render(cfg, mood) is de ENIGE aanroep die de rest van de app gebruikt
    // (home, wereldkaart, oefeningen, level-complete, rewards, profiel,
    // kledingkast, onboarding). Ze weten niets van assets vs. placeholder —
    // dat wordt hier centraal opgelost:
    //
    //   1. Kandidaat-asset-URL's opbouwen (meest specifiek → generiek) uit
    //      resolveAssetCandidates(cfg, mood): outfit-asset voor deze mood →
    //      hijab-asset (meisje) → type-brede default voor deze mood.
    //   2. Een <img> renderen die bij een 404 automatisch de volgende
    //      kandidaat probeert (onerror-cascade, geen async/fetch-probing
    //      nodig — werkt synchroon en zonder flikkering bij succes).
    //   3. Zijn ALLE kandidaten weg (nog geen enkele illustratie aangeleverd),
    //      dan vervangt de laatste onerror de <img> door de bestaande
    //      SVG-placeholder (placeholderSvg) — zo blijft de app altijd een
    //      net personage tonen, ook voordat er assets zijn.
    //
    // Assets toevoegen = alleen character-data.js invullen (per item een
    // `assets: { <mood>: "pad/naar/bestand.png" }`) of bestanden neerzetten
    // op de default-paden in assets/characters/<type>/<mood>/default.*  —
    // GEEN aanpassing aan character.js of aan de call sites nodig.
    render(cfg, mood) {
      mood = mood || "idle";
      if (!cfg) cfg = { type: "boy", skinTone: C.skinTones[1] };
      const candidates = resolveAssetCandidates(cfg, mood);
      const uid = "cr" + (idCounter++);
      const placeholder = this.placeholderSvg(cfg, mood);
      if (!candidates.length) return placeholder;
      const list = candidates.join("|");
      return `<span class="char-render" data-idx="0" data-candidates="${escapeAttr(list)}">` +
        `<img src="${candidates[0]}" alt="" draggable="false" onerror="window.Character._onImgError(this)" />` +
        `<template class="char-placeholder">${placeholder}</template>` +
        `</span>`;
    },

    // Interne fallback-handler voor de onerror-cascade hierboven.
    _onImgError(img) {
      const wrap = img.parentElement;
      if (!wrap || !wrap.classList.contains("char-render")) return;
      const list = (wrap.getAttribute("data-candidates") || "").split("|").filter(Boolean);
      const idx = parseInt(wrap.getAttribute("data-idx") || "0", 10) + 1;
      if (idx < list.length) {
        wrap.setAttribute("data-idx", String(idx));
        img.src = list[idx];
      } else {
        const tpl = wrap.querySelector("template.char-placeholder");
        wrap.outerHTML = tpl ? tpl.innerHTML : "";
      }
    },

    // Backwards-compatible alias — bestaande call sites in game.js/shell.js
    // gebruikten tot nu toe Character.svg(cfg, mood).
    svg(cfg, mood) { return this.render(cfg, mood); },

    // Eén consistente, layer-based placeholderstijl (lichaam/huid → kleding →
    // hijab-of-haar → gezicht → accessoire), met zachte gradients/schaduw voor
    // meer diepte dan platte vlakken. Dit is BEWUST tijdelijk — wordt gebruikt
    // zolang er geen (of geen passende) illustratie-asset is. Zie
    // CHARACTER_ASSET_REQUIREMENTS.md voor de definitieve assetlijst.
    placeholderSvg(cfg, mood) {
      if (!cfg) cfg = { type: "boy", skinTone: C.skinTones[1] };
      const uid = "c" + (idCounter++);
      const skin = cfg.skinTone || C.skinTones[1];
      const outfit = this.itemById(cfg.outfit);
      const outfitColor = (outfit && outfit.color) || "#5b8fb0";
      const shoes = this.itemById(cfg.shoes);
      const shoesColor = (shoes && shoes.color) || "#6b4a26";
      const acc = this.itemById(cfg.accessory);
      const hijab = cfg.type === "girl" ? this.itemById(cfg.hijab) : null;
      const hijabColor = (hijab && hijab.color) || "#d98fa3";
      const isWave = mood === "wave";
      const isCelebrate = mood === "celebrate";
      const rArm = isWave
        ? `rotate(-30 108 104)`
        : isCelebrate ? `rotate(-18 108 104)` : "";
      const lArm = isCelebrate ? `rotate(18 12 104)` : "";
      return `<svg viewBox="0 0 120 172" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="${uid}skin" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="${lighten(skin, 14)}"/><stop offset="1" stop-color="${skin}"/>
          </linearGradient>
          <linearGradient id="${uid}outfit" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="${lighten(outfitColor, 10)}"/><stop offset="1" stop-color="${darken(outfitColor, 8)}"/>
          </linearGradient>
          <linearGradient id="${uid}hijab" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="${lighten(hijabColor, 12)}"/><stop offset="1" stop-color="${darken(hijabColor, 6)}"/>
          </linearGradient>
        </defs>

        <ellipse cx="60" cy="164" rx="26" ry="5.5" fill="#000" opacity=".1"/>

        <!-- schoenen -->
        <path d="M38 164 Q38 150 41 138 L53 138 Q54 150 55 164 Q46 168 38 164Z" fill="${shoesColor}"/>
        <path d="M65 164 Q66 150 67 138 L79 138 Q82 150 82 164 Q74 168 65 164Z" fill="${shoesColor}"/>

        <!-- lichaam / outfit -->
        <path d="M34 155 L36 96 Q60 82 84 96 L86 155 Q60 167 34 155Z" fill="url(#${uid}outfit)"/>
        <path d="M60 96 L60 150" stroke="${darken(outfitColor, 14)}" stroke-width="1.4" opacity=".5"/>
        <path d="M40 105 Q60 96 80 105" stroke="${lighten(outfitColor, 20)}" stroke-width="2" fill="none" opacity=".55"/>

        <!-- armen -->
        <g transform="${lArm}">
          <path d="M35 100 Q17 104 14 122" stroke="url(#${uid}outfit)" stroke-width="15" fill="none" stroke-linecap="round"/>
          <circle cx="13" cy="126" r="7.5" fill="url(#${uid}skin)"/>
        </g>
        <g transform="${rArm}">
          <path d="M85 100 Q103 104 106 122" stroke="url(#${uid}outfit)" stroke-width="15" fill="none" stroke-linecap="round"/>
          <circle cx="107" cy="126" r="7.5" fill="url(#${uid}skin)"/>
        </g>

        <!-- hals + hoofd -->
        <rect x="52" y="70" width="16" height="16" rx="6" fill="${darken(skin, 4)}"/>
        <circle cx="60" cy="54" r="29" fill="url(#${uid}skin)"/>
        <ellipse cx="49" cy="58" rx="7" ry="9" fill="${lighten(skin, 10)}" opacity=".35"/>

        <!-- hijab of haar -->
        ${cfg.type === "girl"
          ? `<path d="M25 60 Q25 14 60 10 Q95 14 95 60 L96 84 Q90 72 85 64 Q80 58 74 58
               Q76 44 60 40 Q44 44 46 58 Q40 58 35 64 Q30 72 24 84 Z" fill="url(#${uid}hijab)"/>
             <path d="M60 10 Q95 14 95 60" stroke="${lighten(hijabColor, 22)}" stroke-width="2" fill="none" opacity=".5"/>
             <circle cx="82" cy="40" r="2.6" fill="${lighten(hijabColor, 30)}" opacity=".8"/>`
          : `<path d="M29 44 Q30 16 60 14 Q90 16 91 44 Q91 32 82 27 Q84 34 78 30
               Q78 38 68 30 Q70 38 60 31 Q52 38 52 30 Q44 38 44 30 Q38 34 40 27 Q31 32 29 44Z"
               fill="#4a3323"/>
             <path d="M32 30 Q60 15 88 30" stroke="#2a1c12" stroke-width="1.5" fill="none" opacity=".4"/>`}

        ${faceFor(mood || "idle")}
        ${acc && acc.color ? `<circle cx="60" cy="100" r="6.5" fill="${acc.color}" stroke="#fff" stroke-width="1.6"/><circle cx="60" cy="100" r="6.5" fill="none" stroke="${darken(acc.color, 15)}" stroke-width=".6"/>` : ""}
      </svg>`;
    },
  };

  let idCounter = 1;

  // Bouwt de kandidaat-lijst met assetpaden voor deze config+mood, van
  // specifiek naar generiek. Puur paden opbouwen/lezen uit character-data.js —
  // geen bestandscontrole (dat doet de onerror-cascade in de browser zelf).
  function resolveAssetCandidates(cfg, mood) {
    const type = cfg.type === "girl" ? "girl" : "boy";
    const out = [];
    const outfit = C.items.find((i) => i.id === cfg.outfit);
    if (outfit && outfit.assets && outfit.assets[mood]) out.push(outfit.assets[mood]);
    if (type === "girl") {
      const hijab = C.items.find((i) => i.id === cfg.hijab);
      if (hijab && hijab.assets && hijab.assets[mood]) out.push(hijab.assets[mood]);
    }
    out.push(`assets/characters/${type}/${mood}/default.webp`);
    out.push(`assets/characters/${type}/${mood}/default.png`);
    return out;
  }
  function escapeAttr(s) { return String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;"); }

  // Kleine kleur-helpers (hex → lichter/donkerder) voor de gradients hierboven —
  // geen afhankelijkheid nodig voor zo'n eenvoudige bewerking.
  function clamp255(v) { return Math.max(0, Math.min(255, v)); }
  function shade(hex, percent) {
    if (!hex || hex[0] !== "#") return hex;
    const num = parseInt(hex.slice(1), 16);
    const amt = Math.round(2.55 * percent);
    const r = clamp255((num >> 16) + amt);
    const g = clamp255(((num >> 8) & 0x00ff) + amt);
    const b = clamp255((num & 0x0000ff) + amt);
    return "#" + (0x1000000 + r * 0x10000 + g * 0x100 + b).toString(16).slice(1);
  }
  const lighten = (hex, pct) => shade(hex, pct);
  const darken = (hex, pct) => shade(hex, -pct);

  function faceFor(mood) {
    const INK = "#3a2a1e";
    const dotEyes = (r) => `<circle cx="50" cy="53" r="${r}" fill="${INK}"/><circle cx="70" cy="53" r="${r}" fill="${INK}"/>` +
      `<circle cx="${51.2 - r * 0.2}" cy="${52 - r * 0.2}" r="${r * 0.32}" fill="#fff" opacity=".85"/>` +
      `<circle cx="${71.2 - r * 0.2}" cy="${52 - r * 0.2}" r="${r * 0.32}" fill="#fff" opacity=".85"/>`;
    const arcEyes = `<path d="M46 52q4 -5 8 0" stroke="${INK}" stroke-width="2.4" fill="none" stroke-linecap="round"/>` +
      `<path d="M66 52q4 -5 8 0" stroke="${INK}" stroke-width="2.4" fill="none" stroke-linecap="round"/>`;
    const brows = `<path d="M44 45q6 -3 11 -1" stroke="${INK}" stroke-width="1.8" fill="none" stroke-linecap="round" opacity=".7"/>` +
      `<path d="M65 44q5 -2 11 1" stroke="${INK}" stroke-width="1.8" fill="none" stroke-linecap="round" opacity=".7"/>`;
    const browsUp = `<path d="M44 42q6 -4 11 -1" stroke="${INK}" stroke-width="1.8" fill="none" stroke-linecap="round" opacity=".7"/>` +
      `<path d="M65 41q5 -3 11 1" stroke="${INK}" stroke-width="1.8" fill="none" stroke-linecap="round" opacity=".7"/>`;
    const eyes = {
      idle: dotEyes(3),
      listening: dotEyes(3.4),
      thinking: `<circle cx="50" cy="53" r="3" fill="${INK}"/><circle cx="73" cy="50" r="3" fill="${INK}"/>`,
      happy: arcEyes,
      celebrate: arcEyes,
      encouraging: dotEyes(3),
      surprised: dotEyes(4.2),
      proud: arcEyes,
      wave: arcEyes,
    };
    const eyebrows = { thinking: browsUp, surprised: browsUp, celebrate: browsUp };
    const path = (d) => `<path d="${d}" stroke="${INK}" stroke-width="2.3" fill="none" stroke-linecap="round"/>`;
    const mouths = {
      idle: path("M52 64q8 4 16 0"),
      listening: `<ellipse cx="60" cy="65" rx="3.5" ry="3" fill="${INK}"/>`,
      thinking: path("M54 65q6 -1 12 0"),
      happy: path("M50 62q10 10 20 0"),
      celebrate: `<path d="M48 61q12 15 24 0" fill="${INK}"/><path d="M52 63q8 7 16 0" fill="#fff"/>`,
      encouraging: path("M52 63q8 6 16 0"),
      surprised: `<ellipse cx="60" cy="67" rx="4.5" ry="5" fill="${INK}"/>`,
      proud: path("M50 62q10 9 20 0"),
      wave: path("M50 62q10 9 20 0"),
    };
    const cheeks = ["happy", "celebrate", "proud", "wave"].includes(mood)
      ? `<circle cx="40" cy="58" r="4" fill="#f4a2a2" opacity=".5"/><circle cx="80" cy="58" r="4" fill="#f4a2a2" opacity=".5"/>` : "";
    return `${eyebrows[mood] || brows}${eyes[mood] || eyes.idle}${mouths[mood] || mouths.idle}${cheeks}`;
  }

  window.Character = Character;
})();
