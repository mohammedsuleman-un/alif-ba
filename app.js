(() => {
  "use strict";

  const BOOK = window.BOOK;
  const AUDIO_DIR = "audio/";
  const EDIT = new URLSearchParams(location.search).has("bewerk");

  const $ = (id) => document.getElementById(id);
  const els = {
    home: $("home"), lesson: $("lesson"), toc: $("toc"),
    continueBtn: $("btnContinue"), continueText: $("continueText"),
    num: $("lessonNum"), title: $("lessonTitle"), img: $("pageImg"),
    stage: $("stage"), hotspots: $("hotspots"), stageWrap: $("stageWrap"),
    prev: $("btnPrev"), next: $("btnNext"), dots: $("pageDots"),
    playAll: $("btnPlayAll"), home_btn: $("btnHome"), toast: $("toast"),
    editBar: $("editBar"), exportBtn: $("btnExport"),
  };

  // ---------- Voortgang (per apparaat) ----------
  const store = {
    get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  };
  const heard = new Set(store.get("heard", []));
  const markHeard = (id) => { heard.add(id); store.set("heard", [...heard]); };
  const lessonDone = (p) => p.tiles.length > 0 && p.tiles.every((t) => heard.has(t.id));

  // ---------- Talen voor de bediening (het boek zelf blijft Arabisch) ----------
  const arLessons = (n) => (n === 1 ? "درس واحد" : n === 2 ? "درسان" : n <= 10 ? `${n} دروس` : `${n} درسًا`);
  const I18N = {
    ar: {
      dir: "rtl",
      subtitle: "الفهرس · اضغط على درس",
      continue: (n) => `تابع الدرس ${n}`,
      lessons: arLessons,
      missing: "التسجيل قريبًا 🎙️",
      missingAll: "التسجيلات قريبًا 🎙️",
      missingSome: (n) => `بعض التسجيلات قريبًا (${n}) 🎙️`,
      noTiles: "لا توجد مربعات في هذه الصفحة بعد",
      home: "العودة إلى الفهرس", playAll: "تشغيل الكل", next: "الصفحة التالية", prev: "الصفحة السابقة",
      tile: (n) => `مربع ${n}`,
    },
    nl: {
      dir: "ltr",
      subtitle: "Inhoudsopgave · tik op een les",
      continue: (n) => `Verder met les ${n}`,
      lessons: (n) => `${n} ${n === 1 ? "les" : "lessen"}`,
      missing: "Opname volgt nog 🎙️",
      missingAll: "Opnames volgen nog 🎙️",
      missingSome: (n) => `${n} opname(s) volgen nog 🎙️`,
      noTiles: "Deze pagina heeft nog geen vierkanten",
      home: "Terug naar inhoudsopgave", playAll: "Alles afspelen", next: "Volgende pagina", prev: "Vorige pagina",
      tile: (n) => `Vierkant ${n}`,
    },
    en: {
      dir: "ltr",
      subtitle: "Contents · tap a lesson",
      continue: (n) => `Continue lesson ${n}`,
      lessons: (n) => `${n} ${n === 1 ? "lesson" : "lessons"}`,
      missing: "Recording coming soon 🎙️",
      missingAll: "Recordings coming soon 🎙️",
      missingSome: (n) => `${n} recording(s) coming soon 🎙️`,
      noTiles: "This page has no squares yet",
      home: "Back to contents", playAll: "Play all", next: "Next page", prev: "Previous page",
      tile: (n) => `Square ${n}`,
    },
  };
  const guessLang = () => {
    const l = (navigator.language || "nl").slice(0, 2);
    return I18N[l] ? l : "nl";
  };
  let lang = I18N[store.get("lang", null)] ? store.get("lang") : guessLang();
  const T = () => I18N[lang];
  // Ondertitel van les/hoofdstuk in de gekozen taal (in het Arabisch alleen de Arabische titel)
  const sub = (o) => (lang === "ar" ? "" : o[lang] || "");

  function applyLang() {
    const t = T();
    document.documentElement.lang = lang;
    document.documentElement.dir = t.dir;
    document.querySelectorAll("[data-i18n]").forEach((el) => (el.textContent = t[el.dataset.i18n]));
    document.querySelectorAll("[data-i18n-aria]").forEach((el) => el.setAttribute("aria-label", t[el.dataset.i18nAria]));
    document.querySelectorAll("[data-lang]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.lang === lang)));
  }

  // ---------- Audio ----------
  const player = new Audio();
  player.preload = "auto";
  let playToken = 0;

  function audioSrc(tile) { return AUDIO_DIR + (tile.audio || tile.id + ".mp3"); }

  // Speelt één vierkant af. Resolvet true als het geluid helemaal is afgespeeld.
  function playTile(tile, el, quiet = false) {
    const token = ++playToken;
    document.querySelectorAll(".tile.active").forEach((t) => t.classList.remove("active"));
    el.classList.add("active");
    el.scrollIntoView({ block: "nearest", behavior: "smooth" });
    return new Promise((resolve) => {
      const done = (ok) => {
        player.onended = player.onerror = null;
        if (token === playToken) el.classList.remove("active");
        resolve(ok);
      };
      player.onended = () => { markHeard(tile.id); el.classList.add("heard"); done(true); };
      player.onerror = () => {
        el.classList.remove("missing"); void el.offsetWidth; el.classList.add("missing");
        if (!quiet) toast(T().missing);
        done(false);
      };
      player.src = audioSrc(tile);
      player.play().catch(() => { /* onerror handelt ontbrekende bestanden af */ });
    });
  }

  function stopAll() {
    playToken++;
    playingAll = false;
    player.pause();
    els.playAll.classList.remove("playing");
    document.querySelectorAll(".tile.active").forEach((t) => t.classList.remove("active"));
  }

  let playingAll = false;
  async function playAll() {
    if (playingAll) return stopAll();
    const page = BOOK.pages[current];
    if (!page.tiles.length) return toast(T().noTiles);
    playingAll = true;
    els.playAll.classList.add("playing");
    const buttons = [...els.hotspots.querySelectorAll(".tile")];
    let missing = 0, none = false;
    for (let i = 0; i < page.tiles.length && playingAll; i++) {
      const ok = await playTile(page.tiles[i], buttons[i], true);
      if (!ok && ++missing === 3 && i === 2) { none = true; break; } // nog geen opnames voor deze pagina
      if (playingAll) await wait(ok ? 450 : 150);
    }
    if (missing) toast(none ? T().missingAll : T().missingSome(missing));
    stopAll();
  }
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  // ---------- Toast ----------
  let toastTimer;
  function toast(msg) {
    els.toast.textContent = msg;
    els.toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => els.toast.classList.remove("show"), 1800);
  }

  // ---------- Startscherm ----------
  // Inhoudsopgave: lessen gegroepeerd per hoofdstuk, met voortgang.
  const CHEV = `<svg class="chev" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>`;
  const heardCount = (p) => p.tiles.filter((t) => heard.has(t.id)).length;

  function renderHome() {
    const last = store.get("last", null);
    els.continueBtn.hidden = last == null;
    if (last != null) els.continueText.textContent = T().continue(last + 1);

    const chapters = BOOK.chapters || [{ ar: BOOK.title, nl: "", from: -Infinity, to: Infinity }];
    els.toc.innerHTML = "";
    chapters.forEach((ch, ci) => {
      const lessons = BOOK.pages.map((p, i) => ({ p, i })).filter(({ p }) => p.n >= ch.from && p.n <= ch.to);
      if (!lessons.length) return;
      const total = lessons.reduce((s, { p }) => s + p.tiles.length, 0);
      const done = lessons.reduce((s, { p }) => s + heardCount(p), 0);
      const pct = total ? Math.round((done / total) * 100) : 0;

      const det = document.createElement("details");
      det.className = "chapter";
      det.open = last != null ? lessons.some(({ i }) => i === last) : ci === 0;
      det.innerHTML = `
        <summary>
          <span class="ch-num">${ci + 1}</span>
          <span class="ch-text"><span class="ch-ar" lang="ar">${ch.ar}</span><span class="ch-nl">${sub(ch)}</span></span>
          <span class="ch-meta">${T().lessons(lessons.length)}<span class="bar-mini"><i style="width:${pct}%"></i></span></span>
          ${CHEV}
        </summary>
        <ol class="toc-list"></ol>`;
      const ol = det.querySelector("ol");
      lessons.forEach(({ p, i }) => {
        const n = heardCount(p);
        const li = document.createElement("li");
        const b = document.createElement("button");
        b.className = "toc-item" + (lessonDone(p) ? " done" : "") + (i === last ? " last" : "");
        b.innerHTML = `
          <span class="n">${i + 1}</span>
          <img loading="lazy" src="${p.image}" alt="">
          <span class="t"><span class="t-ar" lang="ar">${p.title}</span><span class="t-nl">${sub(p)}</span></span>
          <span class="st">${lessonDone(p) ? "★" : n ? `${n}/${p.tiles.length}` : ""}</span>`;
        b.onclick = () => go(i);
        li.appendChild(b);
        ol.appendChild(li);
      });
      els.toc.appendChild(det);
    });
  }

  // ---------- Lesscherm ----------
  let current = 0;

  function renderPage() {
    stopAll();
    const p = BOOK.pages[current];
    els.num.textContent = current + 1;
    els.title.textContent = p.title;
    store.set("last", current);
    els.img.src = p.image;
    els.dots.textContent = `${current + 1} / ${BOOK.pages.length}`;
    els.prev.disabled = current === 0;
    els.next.disabled = current === BOOK.pages.length - 1;
    renderTiles();
    els.stageWrap.scrollTop = 0;
    // Volgende pagina alvast laden
    const nx = BOOK.pages[current + 1];
    if (nx) new Image().src = nx.image;
  }

  function renderTiles() {
    const p = BOOK.pages[current];
    els.hotspots.innerHTML = "";
    p.tiles.forEach((t, i) => {
      const b = document.createElement("button");
      b.className = "tile" + (heard.has(t.id) ? " heard" : "");
      b.dataset.n = i + 1;
      b.setAttribute("aria-label", T().tile(i + 1));
      place(b, t);
      if (!EDIT) b.onclick = () => { stopAll(); playTile(t, b); };
      els.hotspots.appendChild(b);
    });
  }

  function place(el, t) {
    Object.assign(el.style, {
      left: t.x * 100 + "%", top: t.y * 100 + "%",
      width: t.w * 100 + "%", height: t.h * 100 + "%",
    });
  }

  // ---------- Navigatie (hash: #/les/3) ----------
  function go(i) { location.hash = i == null ? "" : `#/les/${i + 1}`; }

  function route() {
    const m = location.hash.match(/^#\/les\/(\d+)/);
    if (m) {
      current = Math.min(Math.max(parseInt(m[1], 10) - 1, 0), BOOK.pages.length - 1);
      els.home.hidden = true;
      els.lesson.hidden = false;
      renderPage();
    } else {
      stopAll();
      els.lesson.hidden = true;
      els.home.hidden = false;
      renderHome();
    }
  }

  els.home_btn.onclick = () => go(null);
  els.continueBtn.onclick = () => go(store.get("last", 0));
  els.prev.onclick = () => current > 0 && go(current - 1);
  els.next.onclick = () => current < BOOK.pages.length - 1 && go(current + 1);
  els.playAll.onclick = playAll;
  document.querySelectorAll("[data-lang]").forEach((b) => (b.onclick = () => {
    lang = b.dataset.lang;
    store.set("lang", lang);
    applyLang();
    route();
  }));
  window.addEventListener("hashchange", route);

  // Vegen: Arabisch boek, dus naar rechts vegen = volgende pagina
  let sx = null, sy = null;
  els.stageWrap.addEventListener("touchstart", (e) => {
    if (e.touches.length !== 1) { sx = null; return; }
    sx = e.touches[0].clientX; sy = e.touches[0].clientY;
  }, { passive: true });
  els.stageWrap.addEventListener("touchend", (e) => {
    if (sx == null || EDIT) return;
    const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
    sx = null;
    if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.5) (dx > 0 ? els.next : els.prev).click();
  });

  document.addEventListener("keydown", (e) => {
    if (els.lesson.hidden || EDIT) return;
    if (e.key === "ArrowLeft") els.next.click();
    if (e.key === "ArrowRight") els.prev.click();
    if (e.key === " ") { e.preventDefault(); playAll(); }
  });

  // ---------- Bewerkmodus: vierkanten tekenen/verschuiven, daarna exporteren ----------
  if (EDIT) {
    document.body.classList.add("editing");
    els.editBar.hidden = false;
    let selected = -1, drag = null;

    const rel = (e) => {
      const r = els.hotspots.getBoundingClientRect();
      return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
    };
    const tiles = () => BOOK.pages[current].tiles;
    const select = (i) => {
      selected = i;
      [...els.hotspots.children].forEach((c, j) => c.classList.toggle("selected", j === i));
    };
    const nextId = () => {
      const pp = String(BOOK.pages[current].n).padStart(2, "0");
      let k = 1;
      while (tiles().some((t) => t.id === `p${pp}_${String(k).padStart(2, "0")}`)) k++;
      return `p${pp}_${String(k).padStart(2, "0")}`;
    };

    els.hotspots.addEventListener("pointerdown", (e) => {
      const p = rel(e);
      const idx = [...els.hotspots.children].indexOf(e.target);
      els.hotspots.setPointerCapture(e.pointerId);
      if (idx >= 0 && e.target.classList.contains("tile")) {
        select(idx);
        const t = tiles()[idx];
        drag = { mode: "move", t, el: e.target, ox: p.x - t.x, oy: p.y - t.y };
      } else {
        select(-1);
        const d = document.createElement("div");
        d.className = "draft";
        els.hotspots.appendChild(d);
        drag = { mode: "new", sx: p.x, sy: p.y, el: d, box: null };
      }
    });
    els.hotspots.addEventListener("pointermove", (e) => {
      if (!drag) return;
      const p = rel(e);
      if (drag.mode === "move") {
        drag.t.x = +(p.x - drag.ox).toFixed(4); drag.t.y = +(p.y - drag.oy).toFixed(4);
        place(drag.el, drag.t);
      } else {
        drag.box = {
          x: Math.min(drag.sx, p.x), y: Math.min(drag.sy, p.y),
          w: Math.abs(p.x - drag.sx), h: Math.abs(p.y - drag.sy),
        };
        place(drag.el, drag.box);
      }
    });
    els.hotspots.addEventListener("pointerup", () => {
      if (drag && drag.mode === "new") {
        drag.el.remove();
        const b = drag.box;
        if (b && b.w > 0.02 && b.h > 0.01) {
          const r4 = (v) => +v.toFixed(4);
          tiles().push({ id: nextId(), x: r4(b.x), y: r4(b.y), w: r4(b.w), h: r4(b.h) });
          renderTiles();
          select(tiles().length - 1);
        }
      }
      drag = null;
    });
    document.addEventListener("keydown", (e) => {
      if ((e.key === "Delete" || e.key === "Backspace") && selected >= 0) {
        tiles().splice(selected, 1);
        renderTiles();
        select(-1);
      }
    });
    const origRender = renderPage;
    renderPage = function () { selected = -1; origRender(); };

    els.exportBtn.onclick = () => {
      const f = (v) => v.toFixed(4);
      const lines = [
        "// Aangepast in de bewerkmodus. Coördinaten zijn fracties (0-1) van de pagina.",
        "// Audio: audio/<id>.mp3, of een eigen bestandsnaam via het veld audio.",
        "window.BOOK = {",
        `  title: ${JSON.stringify(BOOK.title)},`,
        `  cover: ${JSON.stringify(BOOK.cover)},`,
        "  chapters: [",
        ...(BOOK.chapters || []).map((c) => `    ${JSON.stringify(c).replace(/"(\w+)":/g, "$1: ")},`),
        "  ],",
        "  pages: [",
        ...BOOK.pages.flatMap((p) => [
          `    { n: ${p.n}, title: ${JSON.stringify(p.title)}, nl: ${JSON.stringify(p.nl || "")}, en: ${JSON.stringify(p.en || "")}, image: ${JSON.stringify(p.image)}, tiles: [`,
          ...p.tiles.map((t) => `      { id: "${t.id}", x: ${f(t.x)}, y: ${f(t.y)}, w: ${f(t.w)}, h: ${f(t.h)}${t.audio ? `, audio: ${JSON.stringify(t.audio)}` : ""} },`),
          "    ] },",
        ]),
        "  ]",
        "};",
      ];
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([lines.join("\n") + "\n"], { type: "text/javascript" }));
      a.download = "book-data.js";
      a.click();
    };
  }

  // ---------- Offline (PWA) ----------
  if ("serviceWorker" in navigator && location.protocol === "https:") {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }

  applyLang();
  route();
})();
