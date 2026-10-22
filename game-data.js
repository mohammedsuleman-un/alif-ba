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
        { n: 1, letters: ["ب", "ت", "ث"], review: [], types: ["AUDIO_TO_LETTER", "VISUAL_MATCH"], count: 6,
          title: { ar: "اكتشف ب ت ث", nl: "Ontdek ب ت ث", en: "Discover ب ت ث", tr: "ب ت ث harflerini keşfet" } },
        { n: 2, letters: ["ج", "ح", "خ"], review: ["ب", "ت", "ث"], types: ["AUDIO_TO_LETTER", "VISUAL_MATCH"], count: 8,
          title: { ar: "اكتشف ج ح خ", nl: "Ontdek ج ح خ", en: "Discover ج ح خ", tr: "ج ح خ harflerini keşfet" } },
        { n: 3, letters: ["د", "ذ", "ر", "ز"], review: ["ج", "ح", "خ"], types: ["AUDIO_TO_LETTER", "VISUAL_MATCH"], count: 9,
          title: { ar: "اكتشف د ذ ر ز", nl: "Ontdek د ذ ر ز", en: "Discover د ذ ر ز", tr: "د ذ ر ز harflerini keşfet" } },
        { n: 4, letters: ["س", "ش", "ص", "ض"], review: ["د", "ذ", "ر", "ز"], types: ["AUDIO_TO_LETTER", "VISUAL_MATCH", "LETTER_MATCH"], count: 9,
          title: { ar: "اكتشف س ش ص ض", nl: "Ontdek س ش ص ض", en: "Discover س ش ص ض", tr: "س ش ص ض harflerini keşfet" } },
        { n: 5, letters: ["ط", "ظ", "ع", "غ"], review: ["س", "ش", "ص", "ض"], types: ["AUDIO_TO_LETTER", "VISUAL_MATCH", "LETTER_MATCH"], count: 9,
          title: { ar: "اكتشف ط ظ ع غ", nl: "Ontdek ط ظ ع غ", en: "Discover ط ظ ع غ", tr: "ط ظ ع غ harflerini keşfet" } },
        { n: 6, letters: ["ف", "ق", "ك", "ل"], review: ["ط", "ظ", "ع", "غ"], types: ["AUDIO_TO_LETTER", "VISUAL_MATCH", "LETTER_MATCH"], count: 9,
          title: { ar: "اكتشف ف ق ك ل", nl: "Ontdek ف ق ك ل", en: "Discover ف ق ك ل", tr: "ف ق ك ل harflerini keşfet" } },
        { n: 7, letters: ["ا", "م", "ن"], review: ["ف", "ق", "ك", "ل"], types: ["AUDIO_TO_LETTER", "VISUAL_MATCH", "LETTER_MATCH"], count: 8,
          title: { ar: "اكتشف ا م ن", nl: "Ontdek ا م ن", en: "Discover ا م ن", tr: "ا م ن harflerini keşfet" } },
        { n: 8, letters: ["هـ", "و", "ي"], review: ["ا", "م", "ن"], types: ["AUDIO_TO_LETTER", "VISUAL_MATCH", "LETTER_MATCH"], count: 8,
          title: { ar: "اكتشف هـ و ي", nl: "Ontdek هـ و ي", en: "Discover هـ و ي", tr: "هـ و ي harflerini keşfet" } },
        { n: 9, letters: [], review: ["ب", "ت", "ث", "ج", "ح", "خ", "د", "ذ", "ر", "ز", "س", "ش", "ص", "ض", "ط", "ظ", "ع", "غ", "ف", "ق", "ك", "ل", "ا", "م", "ن", "هـ", "و", "ي"], types: ["AUDIO_TO_LETTER", "VISUAL_MATCH", "LETTER_MATCH"], count: 14,
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
  { n: 1, id: "ch1", theme: "oasis", icon: "🌴", stage: 1, areas: ["letter_oasis"], pos: { x: .155, y: .20 }, c: ["#f2c14e", "#e08a2a"],
    title: { ar: "الحروف الهجائية", nl: "Letters", en: "Letters", tr: "Harfler" },
    land: { ar: "واحة الحروف", nl: "Oase", en: "Oasis", tr: "Vaha" } },
  { n: 2, id: "ch2", theme: "flowers", icon: "🌻", stage: 1, areas: [], pos: { x: .39, y: .21 }, c: ["#8fd36a", "#3fa14a"],
    title: { ar: "الحركات", nl: "Klinkertekens", en: "Vowel marks", tr: "Harekeler" },
    land: { ar: "وادي الزهور", nl: "Bloemenvallei", en: "Flower valley", tr: "Çiçek vadisi" } },
  { n: 3, id: "ch3", theme: "river", icon: "🌊", stage: 1, areas: [], pos: { x: .646, y: .21 }, c: ["#5fc8e8", "#2a8ac0"],
    title: { ar: "المدود", nl: "Lange klinkers", en: "Long vowels", tr: "Med harfleri" },
    land: { ar: "النهر الطويل", nl: "De lange rivier", en: "The long river", tr: "Uzun nehir" } },
  { n: 4, id: "ch4", theme: "mountains", icon: "⛰️", stage: 2, areas: [], pos: { x: .882, y: .29 }, c: ["#b9a6e8", "#7a5fc0"],
    title: { ar: "الشدة والتنوين", nl: "Shadda en tanwien", en: "Shadda & tanween", tr: "Şedde ve tenvin" },
    land: { ar: "جبال الصدى", nl: "Echo-bergen", en: "Echo mountains", tr: "Yankı dağları" } },
  { n: 5, id: "ch5", theme: "light", icon: "🕌", stage: 2, areas: [], pos: { x: .206, y: .50 }, c: ["#ffe08a", "#e0a02a"],
    title: { ar: "هاء الضمير ولفظ الجلالة", nl: "Ha van het voornaamwoord en Allah", en: "Pronoun ha & the name Allah", tr: "Zamir ha ve Allah lafzı" },
    land: { ar: "مدينة النور", nl: "Lichtstad", en: "City of light", tr: "Nur şehri" } },
  { n: 6, id: "ch6", theme: "forest", icon: "🌲", stage: 2, areas: [], pos: { x: .487, y: .52 }, c: ["#6fb99a", "#2f7a62"],
    title: { ar: "أحكام النون الساكنة والتنوين", nl: "Regels van noen sakin en tanwien", en: "Noon sakin & tanween rules", tr: "Nun sakin ve tenvin hükümleri" },
    land: { ar: "غابة الضباب", nl: "Mistbos", en: "Misty forest", tr: "Sisli orman" } },
  { n: 7, id: "ch7", theme: "stars", icon: "⭐", stage: 3, areas: [], pos: { x: .77, y: .53 }, c: ["#7a8be8", "#3b46a8"],
    title: { ar: "همزة الوصل والحروف المقطعة", nl: "Hamzat al-wasl en losse letters", en: "Hamzat al-wasl & disconnected letters", tr: "Hemze-i vasl ve mukattaa harfleri" },
    land: { ar: "سماء النجوم", nl: "Sterrenhemel", en: "Starry sky", tr: "Yıldızlı gökyüzü" } },
  { n: 8, id: "ch8", theme: "sunmoon", icon: "🌙", stage: 3, areas: [], pos: { x: .185, y: .79 }, c: ["#ffb38a", "#c46a3a"],
    title: { ar: "اللام القمرية والشمسية", nl: "Zon- en maanletters", en: "Sun and moon letters", tr: "Şemsi ve kameri lam" },
    land: { ar: "جزيرة الشمس والقمر", nl: "Zon- en maaneiland", en: "Sun and moon island", tr: "Güneş ve ay adası" } },
  { n: 9, id: "ch9", theme: "library", icon: "📖", stage: 3, areas: [], pos: { x: .83, y: .81 }, c: ["#58c490", "#1f8a60"],
    title: { ar: "رموز القرآن", nl: "Koransymbolen", en: "Qur'an symbols", tr: "Kur'an işaretleri" },
    land: { ar: "مكتبة القرآن", nl: "Koranbibliotheek", en: "Qur'an library", tr: "Kur'an kütüphanesi" } },
];
