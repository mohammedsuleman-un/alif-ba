// Koran: de Madina-Mushaf (604 pagina's, regelindeling en lettertypes van quran.com) met luisteren.
// Verzen waarvan we een opname van de docent hebben (quran-audio.js) zijn tikbaar en kleuren groen terwijl ze klinken.
// Route: #/koran (laatst geopende pagina) of #/koran/<pagina>. Paginadata: assets/quran/pages.json.
(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const store = {
    get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  };
  const LANGS = ["nl", "en", "ar", "tr"];
  const lang = () => (LANGS.includes(store.get("lang", "nl")) ? store.get("lang", "nl") : "nl");
  const I18N = {
    ar: { sub: "استمع واقرأ", play: "استماع", pause: "إيقاف", again: "من البداية", loop: "تكرار", back: "رجوع", index: "الفهرس", page: "صفحة", next: "الصفحة التالية", prev: "الصفحة السابقة", noAudio: "لا يوجد تسجيل لهذه الآية بعد", loading: "جارٍ التحميل…", offline: "تعذّر تحميل الصفحة. تحقق من الاتصال.", retry: "حاول مرة أخرى", listen: "تسجيلات المعلّم" },
    nl: { sub: "Luister en lees mee", play: "Luisteren", pause: "Pauze", again: "Opnieuw", loop: "Herhalen", back: "Terug", index: "Inhoud", page: "Pagina", next: "Volgende pagina", prev: "Vorige pagina", noAudio: "Van dit vers is nog geen opname", loading: "Laden…", offline: "De pagina kon niet laden. Kijk of je internet hebt.", retry: "Opnieuw proberen", listen: "Met opname van de docent" },
    en: { sub: "Listen and read along", play: "Listen", pause: "Pause", again: "Again", loop: "Repeat", back: "Back", index: "Contents", page: "Page", next: "Next page", prev: "Previous page", noAudio: "No recording for this verse yet", loading: "Loading…", offline: "The page could not load. Check your internet.", retry: "Try again", listen: "With teacher recording" },
    tr: { sub: "Dinle ve oku", play: "Dinle", pause: "Duraklat", again: "Baştan", loop: "Tekrar", back: "Geri", index: "İçindekiler", page: "Sayfa", next: "Sonraki sayfa", prev: "Önceki sayfa", noAudio: "Bu ayetin henüz kaydı yok", loading: "Yükleniyor…", offline: "Sayfa yüklenemedi. İnternetini kontrol et.", retry: "Tekrar dene", listen: "Öğretmen kaydıyla" },
  };
  const T = () => I18N[lang()];
  const digits = (n) => String(n).replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[d]);

  const AUDIO = window.QURAN_AUDIO || { basmala: null, verses: {} };
  const BASMALA = "بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ";
  const LOCAL_FONTS = new Set([604]); // deze pagina-lettertypes zitten in de app (offline); de rest komt van quran.com
  const FONT_CDN = "https://verses.quran.foundation/fonts/quran/hafs/v1/woff2/";
  const LAST = 604;

  const root = $("quran");
  let DATA = null, dataP = null;
  let page = 0;
  let run = 0; // verhoogt bij elke start/stop; een oude afspeelketen stopt zodra het nummer niet meer klopt
  let play = { on: false, loop: false };
  const fontP = {};

  function loadData() {
    if (DATA) return Promise.resolve(DATA);
    return (dataP = dataP || fetch("assets/quran/pages.json").then((r) => { if (!r.ok) throw new Error("pages"); return r.json(); }).then((d) => (DATA = d)).catch((e) => { dataP = null; throw e; }));
  }
  function loadFont(n) {
    if (fontP[n]) return fontP[n];
    const url = LOCAL_FONTS.has(n) ? `assets/quran/fonts/p${n}.woff2` : `${FONT_CDN}p${n}.woff2`;
    const f = new FontFace(`qp${n}`, `url(${url})`);
    return (fontP[n] = f.load().then((ff) => { document.fonts.add(ff); }).catch((e) => { delete fontP[n]; throw e; }));
  }

  const surahOfPage = (p) => { const s = DATA.surahs; let r = s[0]; for (const x of s) { if (x.p <= p) r = x; } return r; };
  const surahById = (id) => DATA.surahs.find((x) => x.id === id);
  const hasAudio = (k) => !!AUDIO.verses[k];
  const pageAudioSurahs = (pg) => [...new Set(Object.values(pg.l).flat().map((seg) => +seg[0].split(":")[0]))].filter((s) => hasAudio(`${s}:1`));

  // ---------- Pagina tekenen ----------
  async function show(n) {
    n = Math.min(Math.max(n | 0, 1), LAST);
    stopPlay();
    page = n;
    store.set("gp_quran_page", n);
    const t = T();
    root.className = "screen q-screen";
    if (!root.querySelector(".q-bar")) {
      root.innerHTML = `
        <div class="q-bar">
          <a href="#/" class="q-ic" aria-label="${t.back}">✕</a>
          <button class="q-title" id="qTitle" type="button" aria-label="${t.index}"><span id="qTitleAr" lang="ar" dir="rtl"></span><small id="qTitlePg"></small></button>
          <button class="q-ic" id="qIndex" type="button" aria-label="${t.index}">☰</button>
        </div>
        <div class="q-stage" id="qStage">
          <button class="q-flip q-flip-l" id="qNext" type="button" aria-label="${t.next}">‹</button>
          <div class="q-page-wrap" id="qWrap"><div class="q-page" id="qPage"></div></div>
          <button class="q-flip q-flip-r" id="qPrev" type="button" aria-label="${t.prev}">›</button>
        </div>
        <div class="q-ctrl">
          <button class="q-btn" id="qAgain" type="button" aria-label="${t.again}">⏮</button>
          <button class="q-btn q-btn-main" id="qPlay" type="button"></button>
          <button class="q-btn" id="qLoop" type="button" aria-label="${t.loop}" aria-pressed="false">🔁</button>
        </div>
        <div class="q-toast" id="qToast" role="status" aria-live="polite" hidden></div>
        <div class="q-index" id="qIdx" hidden></div>`;
      $("qNext").onclick = () => go(page + 1);
      $("qPrev").onclick = () => go(page - 1);
      $("qIndex").onclick = $("qTitle").onclick = openIndex;
      $("qPlay").onclick = () => (play.on ? stopPlay() : startPlay());
      $("qAgain").onclick = () => startPlay();
      $("qLoop").onclick = (e) => { play.loop = !play.loop; e.currentTarget.setAttribute("aria-pressed", play.loop); e.currentTarget.classList.toggle("on", play.loop); };
      swipe($("qStage"));
      window.addEventListener("resize", fit);
    }
    setPlayIcon(false);
    const box = $("qPage");
    box.innerHTML = `<p class="q-msg">${t.loading}</p>`;
    try {
      await loadData();
      await loadFont(n);
    } catch {
      if (page !== n) return;
      box.innerHTML = `<p class="q-msg">${t.offline}</p><button class="q-retry" type="button">${t.retry}</button>`;
      box.querySelector(".q-retry").onclick = () => show(n);
      return;
    }
    if (page !== n) return; // intussen een andere pagina gekozen
    render(n);
    [n + 1, n - 1].forEach((m) => { if (m >= 1 && m <= LAST) loadFont(m).catch(() => {}); });
  }
  const go = (n) => { if (n >= 1 && n <= LAST) location.hash = `#/koran/${n}`; };

  function render(n) {
    const pg = DATA.pages[n - 1], t = T();
    const head = {}; // regels zonder woorden: kop van een soera en bismillah
    pg.s.forEach(([s, L]) => { if (s === 1 || s === 9) { if (L > 1) head[L - 1] = bannerRow(s); } else { head[L - 1] = basmalaRow(s); if (L > 2) head[L - 2] = bannerRow(s); } });
    const rows = [];
    for (let L = 1; L <= 15; L++) {
      const segs = pg.l[L];
      if (segs) {
        const glyphs = segs.map(([k, c]) => `<span class="q-v${hasAudio(k) ? " has-audio" : ""}" data-k="${k}">${[...c].join(" ")}</span>`).join(" ");
        rows.push(`<div class="q-line" style="font-family:qp${n}">${glyphs}</div>`);
        continue;
      }
      if (head[L]) rows.push(head[L]); else if (n > 2) rows.push(`<div class="q-line q-gap"></div>`);
    }
    $("qPage").innerHTML = rows.join("");
    $("qPage").classList.toggle("q-short", n <= 2); // de eerste twee pagina's hebben maar 7-8 regels, groter en in het midden
    $("qPage").dataset.page = n;
    const sur = surahById(+pg.l[Math.min(...Object.keys(pg.l).map(Number))][0][0].split(":")[0]);
    $("qTitleAr").textContent = `سُورَةُ ${sur.ar.replace(/^سورة\s*/, "")}`;
    $("qTitlePg").textContent = `${t.page} ${n}`;
    $("qNext").disabled = n >= LAST; $("qPrev").disabled = n <= 1;
    $("qPage").classList.toggle("has-teacher", pageAudioSurahs(pg).length > 0);
    $("qPlay").disabled = $("qAgain").disabled = pageAudioSurahs(pg).length === 0;
    root.querySelectorAll(".q-v").forEach((el) => { el.onclick = () => tapVerse(el.dataset.k); });
    fit();
  }
  function bannerRow(s) { const sr = surahById(s); return `<div class="q-line q-banner" data-s="${s}"><span lang="ar" dir="rtl">${sr.ar}</span></div>`; }
  function basmalaRow(s) { return `<div class="q-line q-basmala" data-s="${s}" lang="ar" dir="rtl"><span>${BASMALA}</span></div>`; }

  // Lettergrootte: de breedste regel vult de paginabreedte, en de 15 regels passen in de hoogte.
  function fit() {
    const wrap = $("qWrap"), box = $("qPage");
    if (!wrap || !box) return;
    const st = $("qStage").getBoundingClientRect();
    const W = Math.min(st.width - 60, 640), H = st.height - 4;
    const w = Math.min(W, H * 0.74), h = Math.min(H, w / 0.62);
    box.style.width = `${w}px`; box.style.height = `${h}px`;
    const probe = document.createElement("div");
    probe.style.cssText = "position:absolute;visibility:hidden;white-space:nowrap;font-size:40px;direction:rtl";
    let widest = 0;
    box.querySelectorAll(".q-line:not(.q-banner):not(.q-basmala):not(.q-gap)").forEach((ln) => { probe.style.fontFamily = ln.style.fontFamily; probe.textContent = ln.textContent; document.body.appendChild(probe); const lw = probe.getBoundingClientRect().width; probe.remove(); ln._w = lw; widest = Math.max(widest, lw); });
    const inner = w - 28;
    const fs = widest ? Math.min(40 * inner / widest, (h - 24) / Math.max(box.children.length, box.classList.contains("q-short") ? 10 : 15) / 1.55) : 18;
    // korte regels (einde van een soera) staan gecentreerd op hun eigen breedte, de rest wordt over de hele breedte uitgelijnd
    box.querySelectorAll(".q-line:not(.q-banner):not(.q-basmala):not(.q-gap)").forEach((ln) => ln.classList.toggle("is-end", ln._w * fs / 40 < inner * 0.8));
    box.style.setProperty("--qfs", `${fs.toFixed(2)}px`);
    box.style.setProperty("--qlh", `${((h - 24) / (box.classList.contains("q-short") ? 10 : 15)).toFixed(2)}px`);
  }

  function swipe(el) {
    let x0 = null, y0 = 0;
    el.addEventListener("pointerdown", (e) => { x0 = e.clientX; y0 = e.clientY; });
    el.addEventListener("pointerup", (e) => {
      if (x0 === null) return;
      const dx = e.clientX - x0, dy = e.clientY - y0; x0 = null;
      if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.6) go(page + (dx < 0 ? 1 : -1)); // Arabisch boek: naar links = volgende
    });
    el.addEventListener("pointercancel", () => { x0 = null; });
  }

  // ---------- Inhoud ----------
  function openIndex() {
    const t = T(), idx = $("qIdx");
    const withAudio = DATA ? DATA.surahs.filter((s) => hasAudio(`${s.id}:1`)) : [];
    const row = (s) => `<button type="button" class="q-ix-row" data-p="${s.p}"><b>${s.id}</b><span class="q-ix-ar" lang="ar" dir="rtl">${s.ar}</span><span class="q-ix-en">${s.en}</span>${hasAudio(`${s.id}:1`) ? '<i class="q-ix-snd" aria-hidden="true">🔊</i>' : ""}<em>${s.p}</em></button>`;
    idx.innerHTML = `
      <div class="q-ix-card" role="dialog" aria-modal="true">
        <div class="q-ix-head"><strong>${t.index}</strong><button type="button" class="q-ic" id="qIxClose" aria-label="${t.back}">✕</button></div>
        <div class="q-ix-list">
          ${withAudio.length ? `<h3>${t.listen}</h3>${withAudio.map(row).join("")}<h3> </h3>` : ""}
          ${DATA ? DATA.surahs.map(row).join("") : ""}
        </div>
      </div>`;
    idx.hidden = false;
    $("qIxClose").onclick = () => { idx.hidden = true; };
    idx.onclick = (e) => { if (e.target === idx) idx.hidden = true; };
    idx.querySelectorAll(".q-ix-row").forEach((b) => (b.onclick = () => { idx.hidden = true; go(+b.dataset.p); }));
  }

  // ---------- Luisteren ----------
  function setPlayIcon(on) {
    const b = $("qPlay"); if (!b) return;
    const t = T();
    b.innerHTML = on ? '<svg viewBox="0 0 24 24"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>' : '<svg viewBox="0 0 24 24"><path d="M7 4v16l13-8z"/></svg>';
    b.setAttribute("aria-label", on ? t.pause : t.play);
    b.classList.toggle("is-playing", on);
  }
  const versEls = (k) => root.querySelectorAll(`.q-v[data-k="${k}"]`);
  function mark(k, state) { versEls(k).forEach((el) => { el.classList.toggle("is-now", state === "now"); el.classList.toggle("is-read", state === "read"); }); }
  function markBasmala(s, state) { const el = root.querySelector(`.q-basmala[data-s="${s}"]`); if (el) { el.classList.toggle("is-now", state === "now"); el.classList.toggle("is-read", state === "read"); } }
  function clearMarks() { root.querySelectorAll(".is-now,.is-read").forEach((el) => el.classList.remove("is-now", "is-read")); }
  function toast(msg) { const el = $("qToast"); if (!el) return; el.textContent = msg; el.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => { el.hidden = true; }, 2200); }

  function stopPlay() {
    run++;
    if (window.AudioManager) window.AudioManager.stop();
    play.on = false;
    setPlayIcon(false);
    root.querySelectorAll(".is-now").forEach((el) => { el.classList.remove("is-now"); el.classList.add("is-read"); });
  }

  // Verzen op de huidige pagina in leesvolgorde (met bismillah voor een soera die op deze pagina begint)
  function sequence() {
    const pg = DATA.pages[page - 1], out = [], seen = new Set();
    const startOn = {}; pg.s.forEach(([s]) => { startOn[`${s}:1`] = s; });
    Object.keys(pg.l).sort((a, b) => a - b).forEach((L) => pg.l[L].forEach(([k]) => {
      if (seen.has(k)) return; seen.add(k);
      if (startOn[k] && startOn[k] !== 1 && startOn[k] !== 9 && AUDIO.basmala && hasAudio(k)) out.push({ s: startOn[k], src: AUDIO.basmala });
      if (hasAudio(k)) out.push({ k, src: AUDIO.verses[k] });
    }));
    return out;
  }
  async function playItems(items, my, pause) {
    for (const it of items) {
      if (my !== run) return false;
      if (it.k) mark(it.k, "now"); else markBasmala(it.s, "now");
      const first = it.k ? versEls(it.k)[0] : root.querySelector(`.q-basmala[data-s="${it.s}"]`);
      const ok = await window.AudioManager.playFile(it.src);
      if (my !== run) return false; // onderbroken door een nieuwe tik of pauze
      if (it.k) mark(it.k, "read"); else markBasmala(it.s, "read");
      if (!ok) return false; // bestand ontbreekt of geblokkeerd
      if (pause) await new Promise((r) => setTimeout(r, 350));
    }
    return true;
  }
  async function startPlay() {
    const items = sequence();
    if (!items.length) { toast(T().noAudio); return; }
    const my = ++run;
    window.AudioManager.stop();
    clearMarks();
    play.on = true; setPlayIcon(true);
    const done = await playItems(items, my, true);
    if (my !== run) return;
    play.on = false; setPlayIcon(false);
    if (done && play.loop) setTimeout(() => { if (my === run && root.querySelector(".q-page")) startPlay(); }, 900);
  }
  async function tapVerse(k) {
    if (!hasAudio(k)) { toast(T().noAudio); return; }
    const my = ++run;
    window.AudioManager.stop();
    clearMarks();
    play.on = true; setPlayIcon(true);
    await playItems([{ k, src: AUDIO.verses[k] }], my, false);
    if (my !== run) return;
    play.on = false; setPlayIcon(false);
  }

  // ---------- Routing ----------
  function route() {
    const h = location.hash;
    const on = h.startsWith("#/koran");
    root.hidden = !on;
    if (!on) { if (play.on) stopPlay(); return; }
    const m = h.match(/^#\/koran\/(\d+)/);
    const n = m ? +m[1] : store.get("gp_quran_page", 604);
    if (!m) { location.replace(`#/koran/${Math.min(Math.max(n | 0, 1), LAST)}`); return; }
    show(n);
  }
  window.addEventListener("hashchange", route);
  window.addEventListener("pagehide", () => { if (play.on) stopPlay(); });
  if (document.readyState !== "loading") route(); else document.addEventListener("DOMContentLoaded", route);
})();
