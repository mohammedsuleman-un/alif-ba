// Letter Chase V2 — gedeelde, Phaser-onafhankelijke data- en opslaglaag.
// Puur data/logica, geen DOM/Phaser-aanrakingen, zodat game-stage.js (DOM-
// chrome, routing, AudioManager, state machine) en chase-scene.js (Phaser-
// wereld) hier allebei zonder duplicatie uit kunnen putten.
(() => {
  "use strict";

  const store = {
    get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  };

  // ---------- Taal (minimale, eigen set — deelt alleen de taalkeuze zelf) ----------
  const LANG = {
    nl: { find: "Vind", good: "Goed gedaan", again: "Nog een keer", toWorld: "Terug",
      up: "Omhoog", down: "Omlaag", left: "Links", right: "Rechts", back: "Terug",
      listen: "Luister opnieuw", modeDpad: "Knoppen", modeTap: "Tik om te lopen" },
    en: { find: "Find", good: "Well done", again: "Play again", toWorld: "Back",
      up: "Up", down: "Down", left: "Left", right: "Right", back: "Back",
      listen: "Listen again", modeDpad: "Buttons", modeTap: "Tap to walk" },
    ar: { find: "ابحث عن", good: "أحسنت", again: "مرة أخرى", toWorld: "رجوع",
      up: "أعلى", down: "أسفل", left: "يسار", right: "يمين", back: "رجوع",
      listen: "استمع مرة أخرى", modeDpad: "أزرار", modeTap: "اضغط للمشي" },
    tr: { find: "Bul", good: "Aferin", again: "Tekrar oyna", toWorld: "Geri",
      up: "Yukarı", down: "Aşağı", left: "Sol", right: "Sağ", back: "Geri",
      listen: "Tekrar dinle", modeDpad: "Düğmeler", modeTap: "Yürümek için dokun" },
  };
  function lang() { const l = store.get("lang", "nl"); return LANG[l] ? l : "nl"; }
  function t() { return LANG[lang()]; }
  function dir() { return lang() === "ar" ? "rtl" : "ltr"; }

  const RETURN_HASH = "#/spel/wereld/letter_oasis";

  // ---------- Gameplay-data, los van rendering ----------
  function makeChaseConfig(target, distractors, requiredCorrect, movingTarget) {
    return { target, distractors, requiredCorrect: requiredCorrect || 3, movingTarget: !!movingTarget };
  }
  // movingTarget: V2-experiment achter een configvlag (sectie 14 van de
  // opdracht) — V1.2-gedrag blijft het gegarandeerde pad wanneer false.
  const chaseConfig = makeChaseConfig("ب", ["ت", "ث"], 3, true);

  // ---------- State machine (gedeeld tussen DOM-chrome en toekomstige scenes) ----------
  const PHASE = { INTRO: "INTRO", PLAYING: "PLAYING", FEEDBACK_CORRECT: "FEEDBACK_CORRECT", FEEDBACK_RETRY: "FEEDBACK_RETRY", COMPLETE: "COMPLETE" };

  // ---------- Wereld/spawn-configuratie ----------
  // Logische wereldgrootte (world-space, onafhankelijk van het scherm) —
  // ruim groter dan elke viewport, zodat camera follow/bounds daadwerkelijk
  // iets om te testen hebben.
  const WORLD_W = 2400, WORLD_H = 1400;
  const SPAWN_DIST = {
    mobile: { min: 100, max: 300 },
    tablet: { min: 140, max: 450 },
    desktop: { min: 180, max: 650 },
  };
  function worldTier(viewportW) { return viewportW < 640 ? "mobile" : viewportW < 1024 ? "tablet" : "desktop"; }

  // ---------- Metrics (eigen, geïsoleerde opslag — ongewijzigd t.o.v. V1.2 qua kernvelden) ----------
  const chaseKey = (pid) => `gp_chase_${pid}`;
  function loadChaseData(pid) {
    return store.get(chaseKey(pid), { attempts: [], aggregate: { attempts: 0, correct: 0, confusions: {} } });
  }
  // entry: { target, selectedLetter, correct, responseTimeMs, round, timestamp,
  //          inputMode, movingTarget, chaseDistancePx } — de laatste drie zijn
  // nieuw in V2, puur voor onderzoek, geen externe analytics, alleen lokaal.
  function recordAttempt(pid, entry) {
    if (!pid) return;
    const data = loadChaseData(pid);
    data.attempts.push(entry);
    data.aggregate.attempts++;
    if (entry.correct) {
      data.aggregate.correct++;
    } else {
      const key = `${entry.target}->${entry.selectedLetter}`;
      data.aggregate.confusions[key] = (data.aggregate.confusions[key] || 0) + 1;
    }
    store.set(chaseKey(pid), data);
  }

  window.ChaseData = {
    store, LANG, lang, t, dir, RETURN_HASH,
    chaseConfig, PHASE,
    WORLD_W, WORLD_H, SPAWN_DIST, worldTier,
    loadChaseData, recordAttempt,
  };
})();
