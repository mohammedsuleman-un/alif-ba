// Spel-content: werelden en levels. Puur data — de spel-engine (game.js) leest dit uit.
// Nieuwe werelden/levels toevoegen = hier data toevoegen, geen nieuwe code.
//
// Letter-audio: hergebruikt de bestaande opnames van les 1 (het alfabet, boekpagina 5).
// Zodra er meer opnames van losse letters bijkomen, hier het pad toevoegen — de app
// laat vanzelf "opname volgt nog" zien voor letters zonder audio (zoals in het boek).
window.GAME = {
  // Volgorde/bestand van elke letter-opname (van de alfabetpagina, les 1 in het boek).
  letterAudio: {
    "ا": "audio/Page1-01", "ب": "audio/Page1-02", "ت": "audio/Page1-03", "ث": "audio/Page1-04",
    "ج": "audio/Page1-05", "ح": "audio/Page1-06", "خ": "audio/Page1-07",
  },

  badges: {
    first_letters: { icon: "🌴", ar: "حروفي الأولى", nl: "Mijn eerste letters", en: "My first letters" },
  },

  worlds: [
    {
      id: "letter_oasis",
      theme: "oasis",
      title: { ar: "واحة الحروف", nl: "Letter Oase", en: "Letter Oasis" },
      subtitle: { ar: "تعرّف على أول حروفك", nl: "Maak kennis met je eerste letters", en: "Meet your first letters" },
      letters: ["ا", "ب", "ت", "ث", "ج", "ح", "خ"],
      badge: "first_letters",
      levels: [
        { n: 1, letters: ["ا"], review: [], types: ["AUDIO_TO_LETTER", "VISUAL_MATCH"], count: 4,
          title: { ar: "اكتشف حرف ا", nl: "Ontdek de ا", en: "Discover ا" } },
        { n: 2, letters: ["ب"], review: ["ا"], types: ["AUDIO_TO_LETTER", "VISUAL_MATCH"], count: 5,
          title: { ar: "اكتشف حرف ب", nl: "Ontdek de ب", en: "Discover ب" } },
        { n: 3, letters: ["ت"], review: ["ا", "ب"], types: ["AUDIO_TO_LETTER", "VISUAL_MATCH"], count: 5,
          title: { ar: "اكتشف حرف ت", nl: "Ontdek de ت", en: "Discover ت" } },
        { n: 4, letters: ["ث"], review: ["ا", "ب", "ت"], types: ["AUDIO_TO_LETTER", "VISUAL_MATCH"], count: 5,
          title: { ar: "اكتشف حرف ث", nl: "Ontdek de ث", en: "Discover ث" } },
        { n: 5, letters: [], review: ["ا", "ب", "ت", "ث"], types: ["AUDIO_TO_LETTER", "VISUAL_MATCH", "LETTER_MATCH"], count: 6,
          title: { ar: "تدريب: ا ب ت ث", nl: "Herhaling: ا ب ت ث", en: "Review: ا ب ت ث" } },
        { n: 6, letters: ["ج"], review: ["ا", "ب"], types: ["AUDIO_TO_LETTER", "VISUAL_MATCH"], count: 5,
          title: { ar: "اكتشف حرف ج", nl: "Ontdek de ج", en: "Discover ج" } },
        { n: 7, letters: ["ح"], review: ["ج"], types: ["AUDIO_TO_LETTER", "VISUAL_MATCH"], count: 5,
          title: { ar: "اكتشف حرف ح", nl: "Ontdek de ح", en: "Discover ح" } },
        { n: 8, letters: ["خ"], review: ["ج", "ح"], types: ["AUDIO_TO_LETTER", "VISUAL_MATCH"], count: 5,
          title: { ar: "اكتشف حرف خ ومقارنة ج ح خ", nl: "Ontdek de خ — vergelijk ج ح خ", en: "Discover خ — compare ج ح خ" } },
        { n: 9, letters: [], review: ["ا", "ب", "ت", "ث", "ج", "ح", "خ"], types: ["AUDIO_TO_LETTER", "VISUAL_MATCH", "LETTER_MATCH"], count: 7,
          title: { ar: "تدريب شامل", nl: "Grote mix", en: "Big mix" } },
        { n: 10, letters: [], review: ["ا", "ب", "ت", "ث", "ج", "ح", "خ"], types: ["AUDIO_TO_LETTER", "VISUAL_MATCH", "LETTER_MATCH"], count: 10,
          challenge: true, badge: "first_letters",
          title: { ar: "تحدي الواحة", nl: "Oase-uitdaging", en: "Oasis challenge" } },
      ],
    },
  ],
};
