// Gedeelde basis voor de letter-minigames (Katapult + Fotograaf): letter-groepen
// (heel het alfabet), voortgang per profiel, duidelijke feedback (bord + geluidje).
(() => {
  "use strict";
  const D = window.ChaseData;
  const { store, lang } = D;

  // Heel het alfabet, in groepen van op elkaar lijkende letters (onderscheiden is de kern).
  const GROUPS = [
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

  // ---------- Voortgang ----------
  const key = (pid) => `gp_mini_${pid}`;
  function load(pid) { return store.get(key(pid), { level: 0, done: [] }); }
  function currentLevel(pid) { return Math.min(load(pid).level || 0, GROUPS.length - 1); }
  function setLevel(pid, n) { const d = load(pid); d.level = Math.max(0, Math.min(GROUPS.length - 1, n)); store.set(key(pid), d); }
  function completeLevel(pid, n) {
    const d = load(pid);
    if (!d.done.includes(n)) d.done.push(n);
    d.level = Math.min(n + 1, GROUPS.length - 1);
    store.set(key(pid), d);
  }
  function doneLevels(pid) { return load(pid).done; }

  // ---------- Teksten ----------
  const SAY = {
    nl: { ok: "Goed zo!", no: "Probeer nog eens", next: "Volgende groep", group: "Groep" },
    en: { ok: "Well done!", no: "Try again", next: "Next group", group: "Group" },
    ar: { ok: "أحسنت!", no: "حاول مرة أخرى", next: "المجموعة التالية", group: "المجموعة" },
    tr: { ok: "Aferin!", no: "Tekrar dene", next: "Sonraki grup", group: "Grup" },
  };
  const say = (k) => (SAY[lang()] || SAY.nl)[k];

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
  function finish(ov, { pid, level, stars, onAgain, onBack }) {
    completeLevel(pid, level);
    const e = END[lang()] || END.nl;
    const hasNext = level + 1 < GROUPS.length;
    ov.hidden = false;
    ov.innerHTML = `
      <div class="chase-card">
        <h2>${e.good}</h2>
        <span class="chase-card-letter" lang="ar" dir="rtl">${GROUPS[level].join(" ")}</span>
        <p class="chase-card-score">${"⭐".repeat(Math.max(1, stars))}</p>
        ${hasNext ? `<button id="mgNext" class="chase-cta chase-cta-primary">${say("next")} →</button>` : ""}
        <button id="mgAgain" class="chase-cta ${hasNext ? "chase-cta-ghost" : "chase-cta-primary"}">${e.again}</button>
        <button id="mgBack" class="chase-cta chase-cta-ghost">${e.back}</button>
      </div>`;
    const go = () => { ov.hidden = true; onAgain(); };
    if (hasNext) ov.querySelector("#mgNext").onclick = go; // voortgang staat al op de volgende groep
    if (!hasNext) setLevel(pid, level);
    ov.querySelector("#mgAgain").onclick = () => { setLevel(pid, level); go(); };
    ov.querySelector("#mgBack").onclick = onBack;
  }

  window.MiniGames = {
    GROUPS, shuffle, say, banner, hideBanner, sfx, wait, finish,
    currentLevel, setLevel, completeLevel, doneLevels,
    group: (n) => GROUPS[n] || GROUPS[0],
  };
})();
