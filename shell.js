// App-schil: het nieuwe startscherm ("Verder leren"), Beloningen, Profiel/oudergedeelte
// en de onderste navigatie. Staat los van de boekmodus (app.js) en de spelmodus
// (game.js) — leest alleen dezelfde localStorage-data die zij al bijhouden
// (gp_profiles/gp_active/gp_state_*, lang) en verandert er niets aan.
(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const store = {
    get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  };

  const LANGS = ["nl", "en", "ar", "tr"];
  const curLang = () => (LANGS.includes(store.get("lang", "nl")) ? store.get("lang", "nl") : "nl");
  const gsub = (obj) => (curLang() === "ar" ? obj.ar : obj[curLang()] || obj.ar);

  const SHELL_I18N = {
    ar: {
      dir: "rtl",
      nav: { leren: "تعلّم", boek: "الكتاب", beloningen: "الجوائز", profiel: "ملفي" },
      kicker: "قاعدة الفتح الربَّاني",
      greeting: (n) => `السَّلَامُ عَلَيْكُمْ، ${n}`,
      startAdventure: "هل أنت مستعدّ لبدء رحلتك في تعلّم العربية؟",
      chooseProfile: "اختر ملفك",
      continueLearning: "تابع التعلّم", wardrobe: "خزانة الملابس",
      allDone: "أتممت كل شيء! ما شاء الله",
      level: "المستوى",
      bookCardTitle: "كتابي ألف با",
      bookCardCta: "تابع من حيث توقفت",
      rewardsTitle: "جوائزي",
      stars: "نجوم", coins: "قطع", badges: "الأوسمة", noBadgesYet: "لا توجد أوسمة بعد — استمر باللعب!",
      profileTitle: "ملفي", switchProfile: "تبديل الملف", noProfileYet: "لا يوجد ملف بعد",
      language: "اللغة", forParents: "للوالدين",
      voiceOn: "إيقاف الإرشاد الصوتي", voiceOff: "تشغيل الإرشاد الصوتي",
      sfxOn: "إيقاف المؤثرات الصوتية", sfxOff: "تشغيل المؤثرات الصوتية",
      child: "الطفل", levelsDone: "مستويات مكتملة",
    },
    nl: {
      dir: "ltr",
      nav: { leren: "Leren", boek: "Boek", beloningen: "Beloningen", profiel: "Profiel" },
      kicker: "Qa'idah al-Fath ar-Rabbani",
      greeting: (n) => `Assalamu alaikum, ${n}`,
      startAdventure: "Klaar om je Arabische avontuur te beginnen?",
      chooseProfile: "Kies je profiel",
      continueLearning: "Verder leren", wardrobe: "Kledingkast",
      allDone: "Alles voltooid! MashaAllah",
      level: "Level",
      bookCardTitle: "Mijn Alif Ba Boek",
      bookCardCta: "Ga verder waar je was",
      rewardsTitle: "Mijn beloningen",
      stars: "sterren", coins: "munten", badges: "Badges", noBadgesYet: "Nog geen badges — blijf spelen!",
      profileTitle: "Profiel", switchProfile: "Profiel wisselen", noProfileYet: "Nog geen profiel",
      language: "Taal", forParents: "Voor ouders",
      voiceOn: "Gesproken instructies uitzetten", voiceOff: "Gesproken instructies aanzetten",
      sfxOn: "Geluidseffecten uitzetten", sfxOff: "Geluidseffecten aanzetten",
      child: "Kind", levelsDone: "Levels voltooid",
    },
    en: {
      dir: "ltr",
      nav: { leren: "Learn", boek: "Book", beloningen: "Rewards", profiel: "Profile" },
      kicker: "Qa'idah al-Fath ar-Rabbani",
      greeting: (n) => `Assalamu alaikum, ${n}`,
      startAdventure: "Ready to start your Arabic adventure?",
      chooseProfile: "Choose your profile",
      continueLearning: "Continue learning", wardrobe: "Wardrobe",
      allDone: "All done! MashaAllah",
      level: "Level",
      bookCardTitle: "My Alif Ba Book",
      bookCardCta: "Pick up where you left off",
      rewardsTitle: "My rewards",
      stars: "stars", coins: "coins", badges: "Badges", noBadgesYet: "No badges yet — keep playing!",
      profileTitle: "Profile", switchProfile: "Switch profile", noProfileYet: "No profile yet",
      language: "Language", forParents: "For parents",
      voiceOn: "Turn off spoken instructions", voiceOff: "Turn on spoken instructions",
      sfxOn: "Turn off sound effects", sfxOff: "Turn on sound effects",
      child: "Child", levelsDone: "Levels done",
    },
    tr: {
      dir: "ltr",
      nav: { leren: "Öğren", boek: "Kitap", beloningen: "Ödüller", profiel: "Profil" },
      kicker: "Qa'idah al-Fath ar-Rabbani",
      greeting: (n) => `Selamün aleyküm, ${n}`,
      startAdventure: "Arapça maceranı başlatmaya hazır mısın?",
      chooseProfile: "Profilini seç",
      continueLearning: "Öğrenmeye devam et", wardrobe: "Gardırop",
      allDone: "Hepsi tamamlandı! MaşaAllah",
      level: "Seviye",
      bookCardTitle: "Alif Ba Kitabım",
      bookCardCta: "Kaldığın yerden devam et",
      rewardsTitle: "Ödüllerim",
      stars: "yıldız", coins: "jeton", badges: "Rozetler", noBadgesYet: "Henüz rozet yok — oynamaya devam et!",
      profileTitle: "Profil", switchProfile: "Profil değiştir", noProfileYet: "Henüz profil yok",
      language: "Dil", forParents: "Ebeveynler için",
      voiceOn: "Sesli talimatları kapat", voiceOff: "Sesli talimatları aç",
      sfxOn: "Ses efektlerini kapat", sfxOff: "Ses efektlerini aç",
      child: "Çocuk", levelsDone: "Tamamlanan seviyeler",
    },
  };
  const ST = () => SHELL_I18N[curLang()];

  // ---------- Gedeelde speldata (alleen lezen, zelfde localStorage-sleutels als game.js) ----------
  const defaultState = () => ({ xp: 0, coins: 0, mastery: {}, levels: {}, badges: [], lastActivity: null });
  const profilesAll = () => store.get("gp_profiles", []);
  const activeProfile = () => {
    const id = store.get("gp_active", null);
    return id ? profilesAll().find((p) => p.id === id) || null : null;
  };
  const stateFor = (pid) => store.get(`gp_state_${pid}`, defaultState());
  const levelKey = (world, level) => `${world.id}_l${level.n}`;

  function worldUnlockedFor(state, world) {
    if (!world.requires) return true;
    const G = window.GAME;
    const req = G.worlds.find((w) => w.id === world.requires);
    if (!req) return true;
    const last = req.levels[req.levels.length - 1];
    return !!(state.levels && state.levels[levelKey(req, last)]);
  }

  // Vindt het eerstvolgende niet-voltooide level over alle (ontgrendelde) werelden heen.
  function nextStop(state) {
    const G = window.GAME;
    for (const world of G.worlds) {
      if (!worldUnlockedFor(state, world)) continue;
      const lv = world.levels.find((l) => !(state.levels && state.levels[levelKey(world, l)]));
      if (lv) return { world, level: lv };
    }
    const last = G.worlds[G.worlds.length - 1];
    return { world: last, level: null };
  }

  // ---------- App-home ----------
  function bookCardHtml(t) {
    return `
      <a href="#/boek" class="book-card">
        <span class="book-card-icon">📖</span>
        <span class="book-card-text">
          <strong>${t.bookCardTitle}</strong>
          <span>${t.bookCardCta}</span>
        </span>
        <span class="book-card-arrow">→</span>
      </a>`;
  }

  function renderAppHome() {
    const t = ST();
    const root = $("appHome");
    const p = activeProfile();
    if (!p) {
      root.innerHTML = `
        <div class="app-home">
          <div class="app-home-hero">
            <span class="app-home-kicker">${t.kicker}</span>
            <h1 class="app-home-title" lang="ar" dir="rtl">ألف با قرءاني</h1>
            <p class="app-home-sub">${t.startAdventure}</p>
            <a href="#/spel" class="app-cta">${t.chooseProfile} <span class="cta-arrow">→</span></a>
          </div>
          ${bookCardHtml(t)}
        </div>`;
      return;
    }
    const state = stateFor(p.id);
    const totalStars = Object.values(state.levels || {}).reduce((s, l) => s + (l.stars || 0), 0);
    const stop = nextStop(state);
    const worldLabel = gsub(stop.world.title);
    const href = stop.level ? `#/spel/level/${stop.world.id}/${stop.level.n}` : `#/spel/wereld/${stop.world.id}`;
    const doneInWorld = stop.world.levels.filter((l) => state.levels && state.levels[levelKey(stop.world, l)]).length;
    const pct = Math.round((doneInWorld / stop.world.levels.length) * 100);
    const charCfg = window.Character && window.Character.getConfig(p.id);
    // CharacterStage: hetzelfde CharacterRenderer-fragment (Character.svg) dat
    // ook op wereldkaart/oefening/level-compleet/profiel/kledingkast wordt
    // gebruikt — hier alleen groter en met een eigen "podium"-achtergrond,
    // zodat het personage op Home de dominante hero-positie krijgt in plaats
    // van een kleine avatar-badge. Zonder geconfigureerd personage valt dit
    // terug op het profiel-emoji, ook groot getoond.
    const stageHtml = charCfg
      ? `<div class="app-home-character">${window.Character.svg(charCfg, "idle")}</div>`
      : `<span class="app-home-avatar-big">${p.avatar}</span>`;
    const smallAvatarHtml = charCfg
      ? `<div class="ahc-avatar-mini">${window.Character.svg(charCfg, "idle")}</div>`
      : `<span class="ahc-avatar-mini-emoji">${p.avatar}</span>`;
    // World-preview asset-slot: nog geen wereld-thumbnail-illustraties
    // aangeleverd (zie CHARACTER_ASSET_REQUIREMENTS.md) — tot die er zijn
    // toont dit een rustige, thema-gekleurde placeholder op exact dezelfde
    // plek/afmeting, zodat het asset later 1-op-1 vervangen kan worden.
    const worldThumbHtml = `<span class="ahc-world-thumb g-theme-${stop.world.theme}" aria-hidden="true"></span>`;
    root.innerHTML = `
      <div class="app-home">
        <div class="app-home-topbar">
          ${smallAvatarHtml}
          <p class="app-home-greet">${t.greeting(p.name)}</p>
          <div class="app-home-stats">
            <span class="ahp-pill">⭐ ${totalStars}</span>
            <span class="ahp-pill">✨ ${state.xp || 0}</span>
          </div>
        </div>
        <div class="app-home-stage">${stageHtml}</div>
        <div class="app-home-worldcard">
          <div class="app-home-current">
            ${worldThumbHtml}
            <div class="ahc-current-text">
              <span class="ahc-label">${worldLabel}</span>
              <span class="ahc-level">${stop.level ? `${t.level} ${stop.level.n}` : t.allDone}</span>
              <div class="ahc-progress"><i style="width:${pct}%"></i></div>
            </div>
          </div>
          <a href="${href}" class="app-cta app-cta-full">${t.continueLearning} <span class="cta-arrow">→</span></a>
          ${charCfg ? `<a href="#/spel/kledingkast" class="app-home-wardrobe-link">👕 ${t.wardrobe}</a>` : ""}
        </div>
        ${bookCardHtml(t)}
      </div>`;
  }

  // ---------- Beloningen ----------
  function renderRewards() {
    const t = ST();
    const root = $("rewards");
    const p = activeProfile();
    if (!p) {
      root.innerHTML = `<header class="hub-head"><h1>${t.rewardsTitle}</h1></header><p class="hub-empty">${t.noProfileYet}</p><a href="#/spel" class="app-cta">${t.chooseProfile} <span class="cta-arrow">→</span></a>`;
      return;
    }
    const state = stateFor(p.id);
    const totalStars = Object.values(state.levels || {}).reduce((s, l) => s + (l.stars || 0), 0);
    const G = window.GAME;
    const badgeIds = state.badges || [];
    root.innerHTML = `
      <header class="hub-head"><h1>${t.rewardsTitle}</h1></header>
      <div class="reward-stats">
        <div class="reward-stat"><span class="rs-n">${state.xp || 0}</span><span class="rs-l">XP</span></div>
        <div class="reward-stat"><span class="rs-n">${totalStars}</span><span class="rs-l">${t.stars}</span></div>
        <div class="reward-stat"><span class="rs-n">${state.coins || 0}</span><span class="rs-l">${t.coins}</span></div>
      </div>
      <h2 class="hub-sub">${t.badges}</h2>
      <div class="badge-grid">
        ${badgeIds.length
          ? badgeIds.map((id) => {
              const b = G.badges[id];
              return b ? `<div class="badge-tile"><span class="bt-icon">${b.icon}</span><span class="bt-name">${gsub(b)}</span></div>` : "";
            }).join("")
          : `<p class="hub-empty">${t.noBadgesYet}</p>`}
      </div>`;
  }

  // ---------- Profiel + oudergedeelte ----------
  function renderProfileHub() {
    const t = ST();
    const root = $("profileHub");
    const p = activeProfile();
    const all = profilesAll();
    const langBtns = LANGS.map((l) => `<button type="button" class="lang-pick ${curLang() === l ? "sel" : ""}" data-l="${l}">${l === "ar" ? "ع" : l.toUpperCase()}</button>`).join("");
    root.innerHTML = `
      <header class="hub-head"><h1>${t.profileTitle}</h1></header>
      ${p
        ? (() => {
            const cfg = window.Character && window.Character.getConfig(p.id);
            const mini = cfg ? `<span class="pcb-avatar pcb-character">${window.Character.svg(cfg, "happy")}</span>` : `<span class="pcb-avatar">${p.avatar}</span>`;
            return `<div class="profile-card-big">
              ${mini}
              <span class="pcb-name">${p.name}</span>
              <a href="#/spel/kledingkast" class="pcb-switch">👕</a>
              <a href="#/spel" class="pcb-switch">${t.switchProfile}</a>
            </div>`;
          })()
        : `<p class="hub-empty">${t.noProfileYet}</p><a href="#/spel" class="app-cta">${t.chooseProfile} <span class="cta-arrow">→</span></a>`}
      <section class="hub-panel">
        <h2>${t.language}</h2>
        <div class="lang-picks">${langBtns}</div>
      </section>
      <section class="hub-panel hub-parents">
        <h2>${t.forParents}</h2>
        <div class="parent-sound">
          <button type="button" id="pVoiceToggle" class="parent-toggle">${AudioManager.settings.voiceOn ? "🗣️ " + t.voiceOn : "🔇 " + t.voiceOff}</button>
          <button type="button" id="pSfxToggle" class="parent-toggle">${AudioManager.settings.sfxOn ? "🔔 " + t.sfxOn : "🔕 " + t.sfxOff}</button>
        </div>
        <table class="parent-table">
          <thead><tr><th>${t.child}</th><th>XP</th><th>${t.stars}</th><th>${t.levelsDone}</th></tr></thead>
          <tbody>${all.length ? all.map((pr) => {
            const s = stateFor(pr.id);
            const stars = Object.values(s.levels || {}).reduce((a, l) => a + (l.stars || 0), 0);
            const done = Object.keys(s.levels || {}).length;
            return `<tr><td>${pr.avatar} ${pr.name}</td><td>${s.xp || 0}</td><td>${stars}</td><td>${done}</td></tr>`;
          }).join("") : `<tr><td colspan="4">${t.noProfileYet}</td></tr>`}</tbody>
        </table>
      </section>`;
    root.querySelectorAll(".lang-pick").forEach((b) => (b.onclick = () => { store.set("lang", b.dataset.l); location.reload(); }));
    const vBtn = $("pVoiceToggle");
    if (vBtn) vBtn.onclick = () => { AudioManager.settings.voiceOn = !AudioManager.settings.voiceOn; renderProfileHub(); };
    const sBtn = $("pSfxToggle");
    if (sBtn) sBtn.onclick = () => { AudioManager.settings.sfxOn = !AudioManager.settings.sfxOn; renderProfileHub(); };
  }

  // ---------- Onderste navigatie ----------
  const NAV_ITEMS = [
    { key: "leren", icon: "🗺️", href: "#/spel" },
    { key: "boek", icon: "📖", href: "#/boek" },
    { key: "beloningen", icon: "🏆", href: "#/beloningen" },
    { key: "profiel", icon: "👤", href: "#/profiel" },
  ];

  function section() {
    const h = location.hash;
    if (h.startsWith("#/spel")) return "leren";
    if (h.startsWith("#/les/") || h.startsWith("#/boek")) return "boek";
    if (h.startsWith("#/beloningen")) return "beloningen";
    if (h.startsWith("#/profiel")) return "profiel";
    return "home";
  }
  // Verbergt de navigatie tijdens het lezen van een les en tijdens een oefening,
  // zodat het kind daar het volledige scherm heeft.
  function navHidden() {
    const h = location.hash;
    return h.startsWith("#/les/") || h.startsWith("#/spel/level/");
  }

  function renderNav() {
    const t = ST();
    const sec = section();
    $("bottomNav").innerHTML = NAV_ITEMS.map((item) => `
      <a href="${item.href}" class="bn-item ${sec === item.key ? "active" : ""}">
        <span class="bn-icon">${item.icon}</span>
        <span class="bn-label">${t.nav[item.key]}</span>
      </a>`).join("");
    $("bottomNav").classList.toggle("hidden", navHidden());
  }

  function shellRoute() {
    document.documentElement.dir = ST().dir;
    const sec = section();
    $("appHome").hidden = sec !== "home";
    $("rewards").hidden = sec !== "beloningen";
    $("profileHub").hidden = sec !== "profiel";
    if (sec === "home") renderAppHome();
    else if (sec === "beloningen") renderRewards();
    else if (sec === "profiel") renderProfileHub();
    renderNav();
  }

  window.addEventListener("hashchange", shellRoute);
  document.addEventListener("DOMContentLoaded", shellRoute);
  if (document.readyState !== "loading") shellRoute();
})();
