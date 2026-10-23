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
  const RETURN_HASH = "#/gamestage/games";
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
  function buildMissions() {
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
    startMission();
  }

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
          <div class="br-scene">
            <div class="br-row" id="brRow" dir="rtl"></div>
            <div class="br-explorer" id="brExplorer">🧒</div>
          </div>
          <div class="br-tray" id="brTray" dir="rtl"></div>
          <button id="brCross" class="chase-cta chase-cta-primary br-cross" disabled>${tt.cross} ➜</button>
        </div>
        <div class="sling-hint">${tt.hint}</div>
        <div class="chase-overlay" id="brOverlay" hidden></div>
      </div>`;
    $("brBack").onclick = () => { location.hash = RETURN_HASH; };
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
    const ex = $("brExplorer"); ex.className = "br-explorer"; ex.style.opacity = 0;
    render();
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
    const place = (p) => { const r = p.getBoundingClientRect(), sc = ex.parentElement.getBoundingClientRect(); ex.style.left = (r.left - sc.left + r.width / 2) + "px"; ex.style.top = (r.top - sc.top - 6) + "px"; };
    ex.style.opacity = 1; ex.style.transition = "none";
    const first = planks[0].getBoundingClientRect(), sc0 = ex.parentElement.getBoundingClientRect();
    ex.style.left = (first.left - sc0.left + first.width + 14) + "px"; ex.style.top = (first.top - sc0.top - 6) + "px"; // begint op de oever rechts
    await MG.wait(60); ex.style.transition = "";
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
      ex.classList.add("is-slip");
      MG.sfx("no");
      MG.banner(field, { ok: false, letter: wrongLetter });
      await MG.wait(1100);
      await window.AudioManager.playRandomRetryFeedback(); await MG.wait(400);
      MG.hideBanner(field);
      if (!active) return;
      // De foute plank gaat terug naar de bak; de rest blijft staan.
      const t = tray.find((x) => x.used && x.letter === wrongLetter); if (t) t.used = false;
      slots[badIndex] = null;
      ex.className = "br-explorer"; ex.style.opacity = 0;
      busy = false; render(); playMissionAudio();
    }
  }

  function complete() {
    MG.finish($("brOverlay"), {
      pid: profileId, level: MG.currentLevel(profileId), stars: solved.filter((s) => !s.helped).length,
      onAgain: () => { missions = buildMissions(); missionIdx = 0; solved = []; updateDots(); startMission(); },
      onBack: () => { location.hash = RETURN_HASH; },
    });
  }

  function onKey(e) { if (active && e.key === "Escape") location.hash = RETURN_HASH; }

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
