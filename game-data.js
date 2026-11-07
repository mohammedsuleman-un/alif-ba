// Spel-content: werelden en levels. Puur data — de spel-engine (game.js) leest dit uit.
// Nieuwe werelden/levels toevoegen = hier data toevoegen, geen nieuwe code.
//
// Letter-audio: hergebruikt de bestaande opnames van les 1 (het alfabet, boekpagina 5).
// Zodra er meer opnames van losse letters bijkomen, hier het pad toevoegen — de app
// laat vanzelf "opname volgt nog" zien voor letters zonder audio (zoals in het boek).
window.GAME = {
  // Volgorde/bestand van elke letter-opname (van de alfabetpagina, les 1 in het boek).
  // Dekt het hele alfabet — nieuwe werelden kunnen deze meteen hergebruiken.
  letterAudio: {
    "ا": "audio/Page1-01", "ب": "audio/Page1-02", "ت": "audio/Page1-03", "ث": "audio/Page1-04",
    "ج": "audio/Page1-05", "ح": "audio/Page1-06", "خ": "audio/Page1-07", "د": "audio/Page1-08",
    "ذ": "audio/Page1-09", "ر": "audio/Page1-10", "ز": "audio/Page1-11", "س": "audio/Page1-12",
    "ش": "audio/Page1-13", "ص": "audio/Page1-14", "ض": "audio/Page1-15", "ط": "audio/Page1-16",
    "ظ": "audio/Page1-17", "ع": "audio/Page1-18", "غ": "audio/Page1-19", "ف": "audio/Page1-20",
    "ق": "audio/Page1-21", "ك": "audio/Page1-22", "ل": "audio/Page1-23", "م": "audio/Page1-24",
    "ن": "audio/Page1-25", "و": "audio/Page1-26", "هـ": "audio/Page1-27", "لا": "audio/Page1-28",
    "ي": "audio/Page1-29", "ة": "audio/Page1-30", "ى": "audio/Page1-31", "ء": "audio/Page1-32",
  },

  badges: {
    first_letters: { icon: "🌴", ar: "حروفي الأولى", nl: "Mijn eerste letters", en: "My first letters", tr: "İlk harflerim" },
    garden_explorer: { icon: "🌷", ar: "مستكشف الحديقة", nl: "Lettertuin ontdekker", en: "Letter garden explorer", tr: "Bahçe kâşifi" },
  },

  worlds: [
    {
      id: "letter_oasis",
      theme: "oasis",
      title: { ar: "الحروف الهجائية", nl: "De Arabische letters", en: "The Arabic letters", tr: "Arap harfleri" },
      subtitle: { ar: "تعرّف على كل الحروف", nl: "Maak kennis met alle letters", en: "Meet all the letters", tr: "Tüm harflerle tanış" },
      letters: ["ب", "ت", "ث", "ج", "ح", "خ", "د", "ذ", "ر", "ز", "س", "ش", "ص", "ض", "ط", "ظ", "ع", "غ", "ف", "ق", "ك", "ل", "ا", "م", "ن", "هـ", "و", "ي"],
      badge: "first_letters",
      levels: [
        { n: 1, letters: ["ب", "ت", "ث"], review: [], types: ["AUDIO_TO_LETTER", "VISUAL_MATCH"], count: 12,
          title: { ar: "اكتشف ب ت ث", nl: "Ontdek ب ت ث", en: "Discover ب ت ث", tr: "ب ت ث harflerini keşfet" } },
        { n: 2, letters: ["ج", "ح", "خ"], review: ["ب", "ت", "ث"], types: ["AUDIO_TO_LETTER", "VISUAL_MATCH"], count: 14,
          title: { ar: "اكتشف ج ح خ", nl: "Ontdek ج ح خ", en: "Discover ج ح خ", tr: "ج ح خ harflerini keşfet" } },
        { n: 3, letters: ["د", "ذ", "ر", "ز"], review: ["ج", "ح", "خ"], types: ["AUDIO_TO_LETTER", "VISUAL_MATCH"], count: 16,
          title: { ar: "اكتشف د ذ ر ز", nl: "Ontdek د ذ ر ز", en: "Discover د ذ ر ز", tr: "د ذ ر ز harflerini keşfet" } },
        { n: 4, letters: ["س", "ش", "ص", "ض"], review: ["د", "ذ", "ر", "ز"], types: ["AUDIO_TO_LETTER", "VISUAL_MATCH", "LETTER_MATCH"], count: 16,
          title: { ar: "اكتشف س ش ص ض", nl: "Ontdek س ش ص ض", en: "Discover س ش ص ض", tr: "س ش ص ض harflerini keşfet" } },
        { n: 5, letters: ["ط", "ظ", "ع", "غ"], review: ["س", "ش", "ص", "ض"], types: ["AUDIO_TO_LETTER", "VISUAL_MATCH", "LETTER_MATCH"], count: 16,
          title: { ar: "اكتشف ط ظ ع غ", nl: "Ontdek ط ظ ع غ", en: "Discover ط ظ ع غ", tr: "ط ظ ع غ harflerini keşfet" } },
        { n: 6, letters: ["ف", "ق", "ك", "ل"], review: ["ط", "ظ", "ع", "غ"], types: ["AUDIO_TO_LETTER", "VISUAL_MATCH", "LETTER_MATCH"], count: 16,
          title: { ar: "اكتشف ف ق ك ل", nl: "Ontdek ف ق ك ل", en: "Discover ف ق ك ل", tr: "ف ق ك ل harflerini keşfet" } },
        { n: 7, letters: ["ا", "م", "ن"], review: ["ف", "ق", "ك", "ل"], types: ["AUDIO_TO_LETTER", "VISUAL_MATCH", "LETTER_MATCH"], count: 14,
          title: { ar: "اكتشف ا م ن", nl: "Ontdek ا م ن", en: "Discover ا م ن", tr: "ا م ن harflerini keşfet" } },
        { n: 8, letters: ["هـ", "و", "ي"], review: ["ا", "م", "ن"], types: ["AUDIO_TO_LETTER", "VISUAL_MATCH", "LETTER_MATCH"], count: 14,
          title: { ar: "اكتشف هـ و ي", nl: "Ontdek هـ و ي", en: "Discover هـ و ي", tr: "هـ و ي harflerini keşfet" } },
        { n: 9, letters: [], review: ["ب", "ت", "ث", "ج", "ح", "خ", "د", "ذ", "ر", "ز", "س", "ش", "ص", "ض", "ط", "ظ", "ع", "غ", "ف", "ق", "ك", "ل", "ا", "م", "ن", "هـ", "و", "ي"], types: ["AUDIO_TO_LETTER", "VISUAL_MATCH", "LETTER_MATCH"], count: 28,
          challenge: true, badge: "first_letters",
          title: { ar: "تحدي الحروف", nl: "Letter-uitdaging", en: "Letter challenge", tr: "Harf meydan okuması" } },
      ],
    },
  ],
};

// ---------- Hoofdstukken = werelden van de totale kaart ----------
// Elk hoofdstuk uit het boek is één wereld met een eigen thema en eigen kaart. `areas` = de speelbare
// kaarten (G.worlds) binnen dat hoofdstuk; leeg = nog in voorbereiding ("binnenkort").
// `stage` = leeftijdsfase van het personage (1 klein, 2 middel, 3 groot): het personage groeit mee.
// `pos` = plek op de totale kaart (fracties 0-1 van de staande kaartafbeelding, hoofdstuk 1 onderaan).
// Tekeningen (optioneel, zie ART_BRIEF_WORLDS.md): assets/worlds/overview/map.jpg en per gebied map-wide.jpg.
window.GAME.chapters = [
  { n: 1, id: "ch1", theme: "oasis", icon: "🌴", stage: 1, areas: ["letter_oasis"], pos: { x: .341, y: .303 }, c: ["#f2c14e", "#e08a2a"],
    title: { ar: "الحروف الهجائية", nl: "Letters", en: "Letters", tr: "Harfler" },
    land: { ar: "واحة الحروف", nl: "Oase", en: "Oasis", tr: "Vaha" } },
  { n: 2, id: "ch2", theme: "flowers", icon: "🌻", stage: 1, areas: ["flowers_valley"], pos: { x: .504, y: .309 }, c: ["#8fd36a", "#3fa14a"],
    title: { ar: "الحركات", nl: "Klinkertekens", en: "Vowel marks", tr: "Harekeler" },
    land: { ar: "وادي الزهور", nl: "Bloemenvallei", en: "Flower valley", tr: "Çiçek vadisi" } },
  { n: 3, id: "ch3", theme: "river", icon: "🌊", stage: 1, areas: ["river_long"], pos: { x: .661, y: .309 }, c: ["#5fc8e8", "#2a8ac0"],
    title: { ar: "المدود", nl: "Lange klinkers", en: "Long vowels", tr: "Med harfleri" },
    land: { ar: "النهر الطويل", nl: "De lange rivier", en: "The long river", tr: "Uzun nehir" } },
  { n: 4, id: "ch4", theme: "mountains", icon: "⛰️", stage: 2, areas: [], pos: { x: .337, y: .50 }, c: ["#b9a6e8", "#7a5fc0"],
    title: { ar: "الشدة والتنوين", nl: "Shadda en tanwien", en: "Shadda & tanween", tr: "Şedde ve tenvin" },
    land: { ar: "جبال الصدى", nl: "Echo-bergen", en: "Echo mountains", tr: "Yankı dağları" } },
  { n: 5, id: "ch5", theme: "light", icon: "🕌", stage: 2, areas: [], pos: { x: .508, y: .50 }, c: ["#ffe08a", "#e0a02a"],
    title: { ar: "هاء الضمير ولفظ الجلالة", nl: "Ha van het voornaamwoord en Allah", en: "Pronoun ha & the name Allah", tr: "Zamir ha ve Allah lafzı" },
    land: { ar: "مدينة النور", nl: "Lichtstad", en: "City of light", tr: "Nur şehri" } },
  { n: 6, id: "ch6", theme: "forest", icon: "🌲", stage: 2, areas: [], pos: { x: .684, y: .50 }, c: ["#6fb99a", "#2f7a62"],
    title: { ar: "أحكام النون الساكنة والتنوين", nl: "Regels van noen sakin en tanwien", en: "Noon sakin & tanween rules", tr: "Nun sakin ve tenvin hükümleri" },
    land: { ar: "غابة الضباب", nl: "Mistbos", en: "Misty forest", tr: "Sisli orman" } },
  { n: 7, id: "ch7", theme: "stars", icon: "⭐", stage: 3, areas: [], pos: { x: .341, y: .681 }, c: ["#7a8be8", "#3b46a8"],
    title: { ar: "همزة الوصل والحروف المقطعة", nl: "Hamzat al-wasl en losse letters", en: "Hamzat al-wasl & disconnected letters", tr: "Hemze-i vasl ve mukattaa harfleri" },
    land: { ar: "سماء النجوم", nl: "Sterrenhemel", en: "Starry sky", tr: "Yıldızlı gökyüzü" } },
  { n: 8, id: "ch8", theme: "sunmoon", icon: "🌙", stage: 3, areas: [], pos: { x: .510, y: .681 }, c: ["#ffb38a", "#c46a3a"],
    title: { ar: "اللام القمرية والشمسية", nl: "Zon- en maanletters", en: "Sun and moon letters", tr: "Şemsi ve kameri lam" },
    land: { ar: "جزيرة الشمس والقمر", nl: "Zon- en maaneiland", en: "Sun and moon island", tr: "Güneş ve ay adası" } },
  { n: 9, id: "ch9", theme: "library", icon: "📖", stage: 3, areas: [], pos: { x: .684, y: .681 }, c: ["#58c490", "#1f8a60"],
    title: { ar: "رموز القرآن", nl: "Koransymbolen", en: "Qur'an symbols", tr: "Kur'an işaretleri" },
    land: { ar: "مكتبة القرآن", nl: "Koranbibliotheek", en: "Qur'an library", tr: "Kur'an kütüphanesi" } },
];

// ---------- Wereld 2: de klinkertekens (فتحة، ضمة، كسرة) ----------
// Elke opname is een letter met een klinkerteken (bijv. بَ = "ba"), 28 letters x 3 tekens, in alfabetvolgorde
// (audio/H2-fatha-01 t/m 28, H2-damma-.., H2-kasra-..). De vraagteksten krijgen het teken erbij; de opname is de uitspraak.
(() => {
  const G = window.GAME;
  const FATHA = "\u064E", DAMMA = "\u064F", KASRA = "\u0650";
  const BASES = ["ا", "ب", "ت", "ث", "ج", "ح", "خ", "د", "ذ", "ر", "ز", "س", "ش", "ص", "ض", "ط", "ظ", "ع", "غ", "ف", "ق", "ك", "ل", "م", "ن", "ه", "و", "ي"];
  const MARKS = { fatha: FATHA, damma: DAMMA, kasra: KASRA };
  // alif krijgt de hamza: أَ أُ إِ (zoals in de opnames)
  const item = (i, kind) => (i === 0 ? (kind === "kasra" ? "إ" : "أ") : BASES[i]) + MARKS[kind];
  const range = (a, b) => Array.from({ length: b - a }, (_, k) => a + k);
  const forms = (kind, idx) => idx.map((i) => item(i, kind));
  G.harakat = { item, BASES, MARKS }; // voor de spelletjes van wereld 2
  ["fatha", "damma", "kasra"].forEach((kind) => BASES.forEach((_, i) => { G.letterAudio[item(i, kind)] = `audio/H2-${kind}-${String(i + 1).padStart(2, "0")}`; }));
  const baseKey = (s) => s.replace(/[\u064B-\u0652]/g, "").replace(/[أإآ]/g, "ا");
  const markOf = (s) => (s.match(/[\u064E\u064F\u0650]/) || [""])[0];
  const rnd = (arr) => arr.map((v) => [Math.random(), v]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
  // Letters die op elkaar lijken (zelfde vorm, andere puntjes of net een ander lijfje)
  const SIMILAR = {
    "ب": ["ت", "ث", "ن", "ي"], "ت": ["ب", "ث", "ن", "ي"], "ث": ["ب", "ت", "ن", "ي"], "ن": ["ب", "ت", "ث", "ي"], "ي": ["ب", "ت", "ث", "ن"],
    "ج": ["ح", "خ"], "ح": ["ج", "خ"], "خ": ["ج", "ح"], "د": ["ذ", "ر"], "ذ": ["د", "ز"], "ر": ["ز", "د"], "ز": ["ر", "ذ"],
    "س": ["ش", "ص"], "ش": ["س", "ص"], "ص": ["ض", "س"], "ض": ["ص", "ش"], "ط": ["ظ"], "ظ": ["ط"], "ع": ["غ"], "غ": ["ع"],
    "ف": ["ق", "م"], "ق": ["ف", "ن"], "ك": ["ل"], "ل": ["ك", "ا"], "ا": ["ل"], "م": ["و", "ف"], "و": ["م", "ر"], "ه": ["و", "ح"],
  };
  G.harakat.SIMILAR = SIMILAR; // ook voor wereld 3
  // Afleiders die het kind echt moeten laten luisteren: dezelfde letter met de twee andere tekens, en één letter die erop lijkt (met hetzelfde teken).
  const distract = (letter, pool, avail) => {
    const src = avail.size >= 6 ? [...avail] : pool;
    const base = baseKey(letter), mk = markOf(letter), looks = SIMILAR[base] || [];
    const isLook = (x) => looks.includes(baseKey(x));
    const cands = rnd(src.filter((x) => x !== letter));
    const sameLetter = cands.filter((x) => baseKey(x) === base);
    const everyone = rnd(pool.filter((x) => x !== letter));
    const look = cands.find((x) => isLook(x) && markOf(x) === mk) || everyone.find((x) => isLook(x) && markOf(x) === mk) || cands.find(isLook);
    const sameMark = cands.filter((x) => baseKey(x) !== base && markOf(x) === mk);
    const out = [];
    const add = (arr, n) => { for (const x of arr) { if (out.length >= 3 || n <= 0) break; if (x && !out.includes(x)) { out.push(x); n--; } } };
    add(sameLetter, 2); add([look], 1); add(sameMark, 3); add(cands, 3); add(everyone, 3);
    return out.slice(0, 3);
  };
  const ALL = range(0, 28), MARKS3 = ["fatha", "damma", "kasra"];
  const group = (idx) => idx.flatMap((i) => MARKS3.map((k) => item(i, k)));
  const GROUPS = [range(0, 4), range(4, 8), range(8, 12), range(12, 16), range(16, 20), range(20, 24), range(24, 28)];
  const all = group(ALL);
  const T = (ar, nl, en, tr) => ({ ar, nl, en, tr });
  const ty = ["AUDIO_TO_LETTER", "VISUAL_MATCH"], tyP = ["AUDIO_TO_LETTER", "VISUAL_MATCH", "LETTER_MATCH"];
  const levels = GROUPS.map((idx, k) => {
    const bases = idx.map((i) => BASES[i]).join(" ");
    return {
      n: k + 1, letters: group(idx), review: k ? group(GROUPS.slice(0, k).flat()) : [], types: k < 2 ? ty : tyP, count: k ? 30 : 24,
      title: T("اكتشف " + bases, "Ontdek " + bases, "Discover " + bases, bases + " harflerini keşfet"),
    };
  });
  levels.push({ n: 8, letters: [], review: group(range(0, 16)), types: tyP, count: 24, title: T("الحركات الثلاث ١", "Alle klinkertekens 1", "All vowel marks 1", "Tüm harekeler 1") });
  levels.push({ n: 9, letters: [], review: all, types: tyP, count: 30, challenge: true, badge: "harakat_master", title: T("تحدي الحركات", "Klinkerteken-uitdaging", "Vowel marks challenge", "Hareke meydan okuması") });
  G.worlds.push({
    id: "flowers_valley", theme: "flowers", requires: "letter_oasis", distract,
    title: T("الحركات", "Klinkertekens", "Vowel marks", "Harekeler"),
    subtitle: T("الفتحة والضمة والكسرة", "Fatha, damma en kasra", "Fatha, damma and kasra", "Fetha, damme ve kesre"),
    letters: all, badge: "harakat_master", levels,
  });
  G.badges.harakat_master = { icon: "🌻", ar: "بطل الحركات", nl: "Klinkertekenmeester", en: "Vowel marks master", tr: "Hareke ustası" };
})();

// ---------- Wereld 3: de lange klinkers (مدّ: ـَا، ـُو، ـِي) ----------
// Deel 1: elke opname is een letter met een lange klinker (bijv. بَا = "baa"), 28 letters x 3 (alif, waw, yaa), in alfabetvolgorde
// (audio/H3-alif-01 t/m 28, H3-waw-.., H3-yaa-..). Deel 2: woorden uit hoofdstuk 3 van het boek (pagina 14, 16 en 17);
// het kind hoort het woord (de bestaande boekopname Page<volgnr>-<tegel>) en kiest het juiste woord uit vier.
(() => {
  const G = window.GAME, H = G.harakat;
  const T = (ar, nl, en, tr) => ({ ar, nl, en, tr });
  const KINDS = { alif: [H.MARKS.fatha, "ا"], waw: [H.MARKS.damma, "و"], yaa: [H.MARKS.kasra, "ي"] };
  const KIND_KEYS = Object.keys(KINDS);
  const range = (a, b) => Array.from({ length: b - a }, (_, k) => a + k);
  const rnd = (arr) => arr.map((v) => [Math.random(), v]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
  // alif krijgt de hamza: أَا أُو إِي
  const form = (i, kind) => (i === 0 ? (kind === "yaa" ? "إ" : "أ") : H.BASES[i]) + KINDS[kind][0] + KINDS[kind][1];
  const info = new Map(); // vorm -> { i, kind }
  KIND_KEYS.forEach((kind) => H.BASES.forEach((_, i) => {
    const f = form(i, kind);
    info.set(f, { i, kind });
    G.letterAudio[f] = `audio/H3-${kind}-${String(i + 1).padStart(2, "0")}`;
  }));
  const group = (idx) => idx.flatMap((i) => KIND_KEYS.map((k) => form(i, k)));

  // Woorden uit de boekpagina's: [pagina n, tegelnummer, woord]. Geluid = audio/Page<volgnr van de pagina>-<tegel>.
  const BOOK_PAGE = { 14: 10, 16: 12, 17: 13 }; // n -> volgnummer van de pagina in het boek (1-based)
  const WORDS = [
    [14, 1, "قَالَ"], [14, 2, "زَاغَ"], [14, 3, "ضَاقَ"], [14, 4, "تَابَ"], [14, 5, "كَانَ"],
    [14, 6, "حَاقَ"], [14, 7, "خَابَ"], [14, 8, "ذَاتِ"], [14, 9, "عَاصِمَ"], [14, 10, "يَكَادُ"],
    [14, 11, "جَاهَدَ"], [14, 12, "عَالِمُ"], [14, 13, "غَالِبَ"], [14, 14, "فَاطِرِ"], [14, 15, "مَالِكِ"],
    [16, 1, "قِيلَ"], [16, 4, "نُرِيدُ"], [16, 9, "يُرِيدُ"], [16, 10, "دِينُكُمْ"], [16, 11, "عِبَادِي"],
    [16, 12, "أَخِيهِ"], [16, 14, "أَبَابِيلَ"], [16, 16, "يُصِيبُ"], [16, 17, "مِيعَادُ"], [16, 18, "يَضِيقُ"],
    [16, 19, "لِسَانِي"], [16, 21, "كِتَابِي"], [16, 26, "أَمْرِي"], [16, 29, "تَجْرِي"], [16, 30, "خَالِدِينَ"],
    [17, 1, "وَيَقُولُ"], [17, 2, "تَعْلَمُونَ"], [17, 4, "تَعْبُدُونَ"], [17, 6, "يَقُومُ"], [17, 9, "سَيَقُولُ"],
    [17, 12, "فَيَكُونُ"], [17, 13, "يَتْلُو"], [17, 14, "يَشْهَدُونَ"], [17, 16, "مُسْرِفُونَ"], [17, 20, "بِذُنُوبِ"],
    [17, 22, "وَيَعْقُوبَ"], [17, 23, "يَنْطِقُونَ"], [17, 29, "فَرِحُونَ"],
  ];
  const wordInfo = new Map(); // woord -> pagina (n)
  WORDS.forEach(([n, tile, w]) => {
    wordInfo.set(w, n);
    G.letterAudio[w] = `audio/Page${BOOK_PAGE[n]}-${String(tile).padStart(2, "0")}`;
  });
  const wordsOf = (...pages) => WORDS.filter((x) => pages.includes(x[0])).map((x) => x[2]);
  const bare = (w) => w.replace(/[ً-ْ]/g, "");

  // Afleiders bij een vorm: dezelfde letter met de twee andere klinkers, plus één letter die erop lijkt met dezelfde klinker.
  // Afleiders bij een woord: woorden die er qua lengte en beginletter op lijken, liefst van dezelfde pagina.
  const distract = (item, pool) => {
    const out = [];
    const add = (arr, n) => { for (const x of arr) { if (out.length >= 3 || n <= 0) break; if (x && x !== item && !out.includes(x)) { out.push(x); n--; } } };
    if (info.has(item)) {
      const { i, kind } = info.get(item);
      const looks = H.SIMILAR[i === 0 ? "ا" : H.BASES[i]] || [];
      const src = rnd(pool.filter((x) => info.has(x) && x !== item));
      const sameBase = KIND_KEYS.filter((k) => k !== kind).map((k) => form(i, k));
      const isLook = (x) => looks.includes(H.BASES[info.get(x).i]);
      add(sameBase, 2); add([src.find((x) => isLook(x) && info.get(x).kind === kind) || src.find(isLook)], 1);
      add(src.filter((x) => info.get(x).kind === kind), 3); add(src, 3);
    } else {
      const src = rnd(pool.filter((x) => wordInfo.has(x) && x !== item));
      const len = bare(item).length, first = bare(item)[0], page = wordInfo.get(item);
      const score = (x) => (bare(x)[0] === first ? 2 : 0) + (Math.abs(bare(x).length - len) <= 1 ? 2 : 0) + (wordInfo.get(x) === page ? 1 : 0);
      add(src.sort((a, b) => score(b) - score(a)), 3);
    }
    return out.slice(0, 3);
  };

  const GROUPS = [range(0, 4), range(4, 8), range(8, 12), range(12, 16), range(16, 20), range(20, 24), range(24, 28)];
  const forms = group(range(0, 28));
  const ty = ["AUDIO_TO_LETTER", "VISUAL_MATCH"], tyP = ["AUDIO_TO_LETTER", "VISUAL_MATCH", "LETTER_MATCH"];
  const levels = GROUPS.map((idx, k) => {
    const bases = idx.map((i) => H.BASES[i]).join(" ");
    return {
      n: k + 1, letters: group(idx), review: k ? group(GROUPS.slice(0, k).flat()) : [], types: k < 2 ? ty : tyP, count: k ? 30 : 24,
      title: T("اكتشف " + bases, "Ontdek " + bases, "Discover " + bases, bases + " harflerini keşfet"),
    };
  });
  const wA = wordsOf(14), wY = wordsOf(16), wW = wordsOf(17), wAll = wordsOf(14, 16, 17), wOnly = ["AUDIO_TO_LETTER"];
  levels.push({ n: 8, letters: [], review: group(range(0, 16)), types: tyP, count: 24, title: T("المدود ١", "Lange klinkers herhalen", "Long vowels review", "Med tekrarı") });
  levels.push({ n: 9, letters: [], review: wA, types: wOnly, count: 16, title: T("كلمات بالألف المدية", "Woorden met lange alif", "Words with long alif", "Uzun elifli kelimeler") });
  levels.push({ n: 10, letters: [], review: wY, types: wOnly, count: 16, title: T("كلمات بالياء المدية", "Woorden met lange yaa", "Words with long yaa", "Uzun yeli kelimeler") });
  levels.push({ n: 11, letters: [], review: wW, types: wOnly, count: 14, title: T("كلمات بالواو المدية", "Woorden met lange waw", "Words with long waw", "Uzun vavlı kelimeler") });
  levels.push({ n: 12, letters: [], review: wAll, types: wOnly, count: 24, title: T("كلمات المدّ", "Alle woorden", "All the words", "Tüm kelimeler") });
  levels.push({ n: 13, letters: [], review: forms, types: tyP, count: 30, title: T("المدود ٢", "Alle lange klinkers", "All long vowels", "Tüm med harfleri") });
  levels.push({ n: 14, letters: [], review: [...forms, ...wAll], types: wOnly, count: 30, challenge: true, badge: "long_vowel_master", title: T("تحدي المدود", "Lange-klinkers-uitdaging", "Long vowels challenge", "Med meydan okuması") });
  G.worlds.push({
    id: "river_long", theme: "river", requires: "flowers_valley", distract, noGames: true,
    title: T("المدود", "Lange klinkers", "Long vowels", "Med harfleri"),
    subtitle: T("الألف والواو والياء المدية", "Alif, waw en yaa als lange klinker", "Alif, waw and yaa as long vowels", "Med olan elif, vav ve ye"),
    letters: [...forms, ...wAll], badge: "long_vowel_master", levels,
  });
  G.badges.long_vowel_master = { icon: "🌊", ar: "بطل المدود", nl: "Meester van de lange klinkers", en: "Long vowels master", tr: "Med ustası" };
})();
