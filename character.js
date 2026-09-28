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

    // ---------- Renderer ----------
    // Eén consistente, layer-based placeholderstijl: silhouet + inkleurbare
    // vlakken (huid/kleding/hijab-of-haar/schoenen/accessoire) + stemming-
    // afhankelijk gezicht. Zodra er definitieve illustraties zijn, vervang je
    // per categorie deze vaste vormen door een <image>-laag die het "asset"-pad
    // van het gekozen item gebruikt — de aanroep (svg(cfg, mood)) blijft gelijk.
    svg(cfg, mood) {
      if (!cfg) cfg = { type: "boy", skinTone: C.skinTones[1] };
      const skin = cfg.skinTone || C.skinTones[1];
      const outfit = this.itemById(cfg.outfit);
      const outfitColor = (outfit && outfit.color) || "#5b8fb0";
      const shoes = this.itemById(cfg.shoes);
      const shoesColor = (shoes && shoes.color) || "#6b4a26";
      const acc = this.itemById(cfg.accessory);
      const hijab = cfg.type === "girl" ? this.itemById(cfg.hijab) : null;
      const hijabColor = (hijab && hijab.color) || "#d98fa3";
      const isWave = mood === "wave";
      return `<svg viewBox="0 0 120 168" xmlns="http://www.w3.org/2000/svg">
        <ellipse cx="60" cy="160" rx="28" ry="6" fill="#000" opacity=".08"/>
        <path d="M40 160 L40 130 L52 130 L52 160Z" fill="${shoesColor}"/>
        <path d="M68 160 L68 130 L80 160 L80 130Z" fill="${shoesColor}"/>
        <path d="M32 152 L34 92 Q60 80 86 92 L88 152 Q60 163 32 152Z" fill="${outfitColor}"/>
        <path d="M12 108 Q6 100 12 92" stroke="${skin}" stroke-width="9" fill="none" stroke-linecap="round"
          transform="${isWave ? "rotate(-25 12 100)" : ""}"/>
        <path d="M108 108 Q114 100 108 92" stroke="${skin}" stroke-width="9" fill="none" stroke-linecap="round"/>
        <circle cx="60" cy="56" r="30" fill="${skin}"/>
        ${cfg.type === "girl"
          ? `<path d="M27 62 Q28 18 60 14 Q92 18 93 62 L93 82 Q84 68 76 64 Q60 76 44 64 Q36 68 27 82 Z" fill="${hijabColor}"/>`
          : `<path d="M31 42 Q33 20 60 18 Q87 20 89 42 L89 36 Q60 25 31 36 Z" fill="#3a2a1e"/>`}
        ${faceFor(mood || "idle")}
        ${acc && acc.color ? `<circle cx="60" cy="98" r="6" fill="${acc.color}" stroke="#fff" stroke-width="1.5"/>` : ""}
      </svg>`;
    },
  };

  function faceFor(mood) {
    const INK = "#3a2a1e";
    const dotEyes = (r) => `<circle cx="50" cy="55" r="${r}" fill="${INK}"/><circle cx="70" cy="55" r="${r}" fill="${INK}"/>`;
    const arcEyes = `<path d="M46 54q4 -5 8 0" stroke="${INK}" stroke-width="2.4" fill="none" stroke-linecap="round"/>` +
      `<path d="M66 54q4 -5 8 0" stroke="${INK}" stroke-width="2.4" fill="none" stroke-linecap="round"/>`;
    const eyes = {
      idle: dotEyes(3),
      listening: dotEyes(3.6),
      thinking: `<circle cx="50" cy="55" r="3" fill="${INK}"/><circle cx="72" cy="53" r="3" fill="${INK}"/>`,
      happy: arcEyes,
      celebrate: arcEyes,
      encouraging: dotEyes(3),
      surprised: dotEyes(4.2),
      proud: arcEyes,
      wave: arcEyes,
    };
    const path = (d) => `<path d="${d}" stroke="${INK}" stroke-width="2.3" fill="none" stroke-linecap="round"/>`;
    const mouths = {
      idle: path("M52 66q8 4 16 0"),
      listening: `<ellipse cx="60" cy="67" rx="3.5" ry="3" fill="${INK}"/>`,
      thinking: path("M54 67q6 -1 12 0"),
      happy: path("M50 64q10 10 20 0"),
      celebrate: path("M48 63q12 14 24 0"),
      encouraging: path("M52 65q8 6 16 0"),
      surprised: `<ellipse cx="60" cy="69" rx="4.5" ry="5" fill="${INK}"/>`,
      proud: path("M50 64q10 9 20 0"),
      wave: path("M50 64q10 9 20 0"),
    };
    const cheeks = ["happy", "celebrate", "proud", "wave"].includes(mood)
      ? `<circle cx="40" cy="60" r="4" fill="#f4a2a2" opacity=".5"/><circle cx="80" cy="60" r="4" fill="#f4a2a2" opacity=".5"/>` : "";
    return `${eyes[mood] || eyes.idle}${mouths[mood] || mouths.idle}${cheeks}`;
  }

  window.Character = Character;
})();
