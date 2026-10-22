// Spelletjes-keuze (#/gamestage/games): kiest tussen de letter-minigames.
// Geen Phaser nodig; de spelletjes zelf laden Phaser pas als ze openen.
(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const D = window.MiniCore;
  const { lang, dir, store } = D;

  const GAMES = [
    { key: "slingshot", hash: "#/gamestage/slingshot/1", icon: "🎯",
      title: { nl: "Katapult", en: "Slingshot", ar: "المقلاع", tr: "Sapan" },
      sub: { nl: "Hoor de letter en schiet de goede lantaarn", en: "Hear the letter and hit the right lantern", ar: "اسمع الحرف وأصب الفانوس الصحيح", tr: "Harfi duy ve doğru fenere at" } },
    { key: "photographer", hash: "#/gamestage/photographer/1", icon: "📷",
      title: { nl: "Fotograaf", en: "Photographer", ar: "المصوّر", tr: "Fotoğrafçı" },
      sub: { nl: "Zoom in en fotografeer de goede letter", en: "Zoom in and photograph the right letter", ar: "قرّب وصوّر الحرف الصحيح", tr: "Yakınlaş ve doğru harfi fotoğrafla" } },
    { key: "diver", hash: "#/gamestage/diver/1", icon: "🤿",
      title: { nl: "Parelduiker", en: "Pearl Diver", ar: "غوّاص اللؤلؤ", tr: "İnci Dalgıcı" },
      sub: { nl: "Verzamel de parels met de goede letter", en: "Collect the pearls with the right letter", ar: "اجمع اللآلئ التي عليها الحرف الصحيح", tr: "Doğru harfli incileri topla" } },
    { key: "bridge", hash: "#/gamestage/bridge/1", icon: "🌉",
      title: { nl: "Letterbrug", en: "Letter Bridge", ar: "جسر الحروف", tr: "Harf Köprüsü" },
      sub: { nl: "Maak de alfabetrij af en steek over", en: "Complete the alphabet row and cross", ar: "أكمل صف الحروف واعبر", tr: "Alfabe sırasını tamamla ve geç" } },
  ];
  const HEAD = { nl: "Kies een spelletje", en: "Pick a game", ar: "اختر لعبة", tr: "Bir oyun seç" };
  const GROUP_LABEL = { nl: "Jouw route", en: "Your path", ar: "مسارك", tr: "Yolun" };
  const LOCK_TXT = {
    nl: (n) => `Speel Wereld 1 tot niveau ${n}`, en: (n) => `Reach level ${n} in World 1`,
    ar: (n) => `أكمل المستوى ${n} في العالم 1`, tr: (n) => `Dünya 1'de ${n}. seviyeye ulaş`,
  };
  const BACK = { nl: "Terug", en: "Back", ar: "رجوع", tr: "Geri" };

  let active = false;

  function teardown() {
    active = false;
    const section = $("gamestage");
    if (section && section.dataset.owner === "games") { section.hidden = true; section.innerHTML = ""; delete section.dataset.owner; }
  }

  function setup() {
    const section = $("gamestage"); if (!section) return;
    const l = GAMES[0].title[lang()] ? lang() : "nl";
    section.hidden = false; section.dataset.owner = "games";
    active = true;
    document.documentElement.classList.add("gamestage-active");
    document.documentElement.dir = dir();
    section.innerHTML = `
      <div class="chase-screen games-screen">
        <header class="chase-head">
          <a href="${D.RETURN_HASH}" class="g-icon-btn" aria-label="${BACK[l]}"><svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg></a>
          <div class="chase-instr"><span class="chase-instr-text">${HEAD[l]}</span></div>
          <div class="games-top"><span class="games-coins" id="gamesCoins">🪙 0</span><a href="#/spel/kledingkast" class="g-icon-btn" aria-label="Kledingkast">👕</a></div>
        </header>
        <div class="games-hub">
          <div class="games-levels-wrap">
            <p class="games-levels-title">${GROUP_LABEL[l]}</p>
            <div class="games-levels" id="gamesLevels"></div>
          </div>
          <div class="games-grid">
            ${GAMES.map((g) => {
              const pid = store.get("gp_active", null), MG = window.MiniGames;
              const open = !MG || !pid || MG.gameOpen(pid, g.key), need = MG ? MG.UNLOCKS[g.key] : 0;
              return open ? `
              <a class="games-card" href="${g.hash}">
                <span class="games-icon">${g.icon}</span>
                <span class="games-title">${g.title[l]}</span>
                <span class="games-sub">${g.sub[l]}</span>
              </a>` : `
              <div class="games-card is-locked" aria-disabled="true">
                <span class="games-icon">🔒</span>
                <span class="games-title">${g.title[l]}</span>
                <span class="games-sub">${LOCK_TXT[l](need)}</span>
              </div>`;
            }).join("")}
          </div>
        </div>
      </div>`;
    renderLevels();
    const pid = store.get("gp_active", null), coins = $("gamesCoins");
    if (coins && pid && window.Character) coins.textContent = "🪙 " + window.Character.coins(pid);
  }

  // Vaste route: niveaus komen na elkaar vrij; elk niveau voegt letters toe en herhaalt de eerdere.
  // Gedaan = vinkje (opnieuw te spelen), huidig = gemarkeerd, rest = op slot.
  const ROUTE_TXT = {
    nl: { title: "Jouw route", level: "Niveau", of: "van", fresh: "Nieuw", review: "+ herhaling", locked: "Nog op slot" },
    en: { title: "Your path", level: "Level", of: "of", fresh: "New", review: "+ review", locked: "Locked" },
    ar: { title: "مسارك", level: "المستوى", of: "من", fresh: "جديد", review: "+ مراجعة", locked: "مغلق" },
    tr: { title: "Yolun", level: "Seviye", of: "/", fresh: "Yeni", review: "+ tekrar", locked: "Kilitli" },
  };
  function renderLevels() {
    const MG = window.MiniGames, el = $("gamesLevels"), pid = store.get("gp_active", null);
    if (!MG || !el || !pid) return;
    const t = ROUTE_TXT[lang()] || ROUTE_TXT.nl;
    const cur = MG.currentLevel(pid), unlocked = MG.unlockedLevel(pid), done = MG.doneLevels(pid), total = MG.GROUPS.length;
    const nodes = MG.GROUPS.map((g, i) => {
      const state = i === cur ? "is-current" : done.includes(i) ? "is-done" : i <= unlocked ? "is-open" : "is-locked";
      const mark = state === "is-locked" ? "🔒" : done.includes(i) ? "✓" : "";
      return `<button class="route-node ${state}" data-i="${i}" ${i > unlocked ? "disabled" : ""} aria-label="${t.level} ${i + 1}">
        <span class="route-num">${i + 1}</span><span class="route-letters" lang="ar" dir="rtl">${g.join(" ")}</span>${mark ? `<i>${mark}</i>` : ""}</button>`;
    }).join("");
    el.innerHTML = `<p class="route-now">${t.level} ${cur + 1} ${t.of} ${total} · ${t.fresh}: <b lang="ar" dir="rtl">${MG.GROUPS[cur].join(" ")}</b>${cur > 0 ? " " + t.review : ""}</p><div class="route-path">${nodes}</div>`;
    el.querySelectorAll(".route-node:not([disabled])").forEach((b) => { b.onclick = () => { MG.setPlay(pid, +b.dataset.i); renderLevels(); }; });
  }

  function route() {
    const on = location.hash.startsWith("#/gamestage/games");
    if (on) { if (!active) setup(); } else if (active) teardown();
  }
  window.addEventListener("hashchange", route);
  route();
})();
