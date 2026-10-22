// Spelletjes-keuze (#/gamestage/games): kiest tussen de letter-minigames.
// Geen Phaser nodig; de spelletjes zelf laden Phaser pas als ze openen.
(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const D = window.ChaseData;
  const { lang, dir } = D;

  const GAMES = [
    { hash: "#/gamestage/slingshot/1", icon: "🎯",
      title: { nl: "Katapult", en: "Slingshot", ar: "المقلاع", tr: "Sapan" },
      sub: { nl: "Hoor de letter en schiet de goede lantaarn", en: "Hear the letter and hit the right lantern", ar: "اسمع الحرف وأصب الفانوس الصحيح", tr: "Harfi duy ve doğru fenere at" } },
    { hash: "#/gamestage/photographer/1", icon: "📷",
      title: { nl: "Fotograaf", en: "Photographer", ar: "المصوّر", tr: "Fotoğrafçı" },
      sub: { nl: "Zoom in en fotografeer de goede letter", en: "Zoom in and photograph the right letter", ar: "قرّب وصوّر الحرف الصحيح", tr: "Yakınlaş ve doğru harfi fotoğrafla" } },
  ];
  const HEAD = { nl: "Kies een spelletje", en: "Pick a game", ar: "اختر لعبة", tr: "Bir oyun seç" };
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
      <div class="chase-screen">
        <header class="chase-head">
          <a href="${D.RETURN_HASH}" class="g-icon-btn" aria-label="${BACK[l]}"><svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg></a>
          <div class="chase-instr"><span class="chase-instr-text">${HEAD[l]}</span></div>
        </header>
        <div class="games-hub">
          ${GAMES.map((g) => `
            <a class="games-card" href="${g.hash}">
              <span class="games-icon">${g.icon}</span>
              <span class="games-title">${g.title[l]}</span>
              <span class="games-sub">${g.sub[l]}</span>
            </a>`).join("")}
        </div>
      </div>`;
  }

  function route() {
    const on = location.hash.startsWith("#/gamestage/games");
    if (on) { if (!active) setup(); } else if (active) teardown();
  }
  window.addEventListener("hashchange", route);
  route();
})();
