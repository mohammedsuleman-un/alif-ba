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
      title: { ar: "واحة الحروف", nl: "Letter Oase", en: "Letter Oasis", tr: "Harf Vahası" },
      subtitle: { ar: "تعرّف على أول حروفك", nl: "Maak kennis met je eerste letters", en: "Meet your first letters", tr: "İlk harflerinle tanış" },
      letters: ["ا", "ب", "ت", "ث", "ج", "ح", "خ"],
      badge: "first_letters",
      levels: [
        { n: 1, letters: ["ا"], review: [], types: ["AUDIO_TO_LETTER", "VISUAL_MATCH"], count: 4,
          title: { ar: "اكتشف حرف ا", nl: "Ontdek de ا", en: "Discover ا", tr: "ا harfini keşfet" } },
        { n: 2, letters: ["ب"], review: ["ا"], types: ["AUDIO_TO_LETTER", "VISUAL_MATCH"], count: 5,
          title: { ar: "اكتشف حرف ب", nl: "Ontdek de ب", en: "Discover ب", tr: "ب harfini keşfet" } },
        { n: 3, letters: ["ت"], review: ["ا", "ب"], types: ["AUDIO_TO_LETTER", "VISUAL_MATCH"], count: 5,
          title: { ar: "اكتشف حرف ت", nl: "Ontdek de ت", en: "Discover ت", tr: "ت harfini keşfet" } },
        { n: 4, letters: ["ث"], review: ["ا", "ب", "ت"], types: ["AUDIO_TO_LETTER", "VISUAL_MATCH"], count: 5,
          title: { ar: "اكتشف حرف ث", nl: "Ontdek de ث", en: "Discover ث", tr: "ث harfini keşfet" } },
        { n: 5, letters: [], review: ["ا", "ب", "ت", "ث"], types: ["AUDIO_TO_LETTER", "VISUAL_MATCH", "LETTER_MATCH"], count: 6,
          title: { ar: "تدريب: ا ب ت ث", nl: "Herhaling: ا ب ت ث", en: "Review: ا ب ت ث", tr: "Tekrar: ا ب ت ث" } },
        { n: 6, letters: ["ج"], review: ["ا", "ب"], types: ["AUDIO_TO_LETTER", "VISUAL_MATCH"], count: 5,
          title: { ar: "اكتشف حرف ج", nl: "Ontdek de ج", en: "Discover ج", tr: "ج harfini keşfet" } },
        { n: 7, letters: ["ح"], review: ["ج"], types: ["AUDIO_TO_LETTER", "VISUAL_MATCH"], count: 5,
          title: { ar: "اكتشف حرف ح", nl: "Ontdek de ح", en: "Discover ح", tr: "ح harfini keşfet" } },
        { n: 8, letters: ["خ"], review: ["ج", "ح"], types: ["AUDIO_TO_LETTER", "VISUAL_MATCH"], count: 5,
          title: { ar: "اكتشف حرف خ ومقارنة ج ح خ", nl: "Ontdek de خ — vergelijk ج ح خ", en: "Discover خ — compare ج ح خ", tr: "خ harfini keşfet — ج ح خ karşılaştır" } },
        { n: 9, letters: [], review: ["ا", "ب", "ت", "ث", "ج", "ح", "خ"], types: ["AUDIO_TO_LETTER", "VISUAL_MATCH", "LETTER_MATCH"], count: 10,
          challenge: true, badge: "first_letters",
          title: { ar: "تحدي الواحة", nl: "Oase-uitdaging", en: "Oasis challenge", tr: "Vaha meydan okuması" } },
      ],
    },
    {
      id: "letter_garden",
      theme: "garden",
      title: { ar: "حديقة الحروف", nl: "Lettertuin", en: "Letter Garden", tr: "Harf Bahçesi" },
      subtitle: { ar: "ثماني حروف جديدة في انتظارك", nl: "Acht nieuwe letters wachten op je", en: "Eight new letters await you", tr: "Sekiz yeni harf seni bekliyor" },
      letters: ["د", "ذ", "ر", "ز", "س", "ش", "ص", "ض"],
      badge: "garden_explorer",
      requires: "letter_oasis", // ontgrendelt pas na de Oase-uitdaging
      levels: [
        { n: 1, letters: ["د"], review: [], types: ["AUDIO_TO_LETTER", "VISUAL_MATCH"], count: 5,
          title: { ar: "اكتشف حرف د", nl: "Ontdek de د", en: "Discover د", tr: "د harfini keşfet" } },
        { n: 2, letters: ["ذ"], review: ["د"], types: ["AUDIO_TO_LETTER", "VISUAL_MATCH"], count: 5,
          title: { ar: "اكتشف حرف ذ ومقارنة د ذ", nl: "Ontdek de ذ — vergelijk د ذ", en: "Discover ذ — compare د ذ", tr: "ذ harfini keşfet — د ذ karşılaştır" } },
        { n: 3, letters: ["ر"], review: ["د", "ذ"], types: ["AUDIO_TO_LETTER", "VISUAL_MATCH"], count: 5,
          title: { ar: "اكتشف حرف ر", nl: "Ontdek de ر", en: "Discover ر", tr: "ر harfini keşfet" } },
        { n: 4, letters: ["ز"], review: ["ر"], types: ["AUDIO_TO_LETTER", "VISUAL_MATCH"], count: 5,
          title: { ar: "اكتشف حرف ز ومقارنة ر ز", nl: "Ontdek de ز — vergelijk ر ز", en: "Discover ز — compare ر ز", tr: "ز harfini keşfet — ر ز karşılaştır" } },
        { n: 5, letters: [], review: ["د", "ذ", "ر", "ز"], types: ["AUDIO_TO_LETTER", "VISUAL_MATCH", "LETTER_MATCH"], count: 6,
          title: { ar: "تدريب: د ذ ر ز", nl: "Herhaling: د ذ ر ز", en: "Review: د ذ ر ز", tr: "Tekrar: د ذ ر ز" } },
        { n: 6, letters: ["س"], review: ["د", "ر"], types: ["AUDIO_TO_LETTER", "VISUAL_MATCH"], count: 5,
          title: { ar: "اكتشف حرف س", nl: "Ontdek de س", en: "Discover س", tr: "س harfini keşfet" } },
        { n: 7, letters: ["ش"], review: ["س"], types: ["AUDIO_TO_LETTER", "VISUAL_MATCH"], count: 5,
          title: { ar: "اكتشف حرف ش ومقارنة س ش", nl: "Ontdek de ش — vergelijk س ش", en: "Discover ش — compare س ش", tr: "ش harfini keşfet — س ش karşılaştır" } },
        { n: 8, letters: ["ص"], review: ["س", "ش"], types: ["AUDIO_TO_LETTER", "VISUAL_MATCH"], count: 5,
          title: { ar: "اكتشف حرف ص", nl: "Ontdek de ص", en: "Discover ص", tr: "ص harfini keşfet" } },
        { n: 9, letters: ["ض"], review: ["ص"], types: ["AUDIO_TO_LETTER", "VISUAL_MATCH", "LETTER_MATCH"], count: 6,
          title: { ar: "اكتشف حرف ض ومقارنة ص ض", nl: "Ontdek de ض — vergelijk ص ض", en: "Discover ض — compare ص ض", tr: "ض harfini keşfet — ص ض karşılaştır" } },
        { n: 10, letters: [], review: ["د", "ذ", "ر", "ز", "س", "ش", "ص", "ض"], types: ["AUDIO_TO_LETTER", "VISUAL_MATCH", "LETTER_MATCH"], count: 10,
          challenge: true, badge: "garden_explorer",
          title: { ar: "تحدي الحديقة", nl: "Tuin-uitdaging", en: "Garden challenge", tr: "Bahçe meydan okuması" } },
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
  { n: 1, id: "ch1", theme: "oasis", icon: "🌴", stage: 1, areas: ["letter_oasis", "letter_garden"], pos: { x: .155, y: .20 }, c: ["#f2c14e", "#e08a2a"],
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
