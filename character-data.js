// Personage-item-manifest: puur data, geen logica (net als game-data.js).
// Nieuwe kleding toevoegen = hier een item toevoegen, geen code aanpassen.
//
// unlockType:
//   "starter" — direct beschikbaar zodra het personage is aangemaakt
//   "level"   — vrijgespeeld zodra het kind in totaal `unlockValue` levels heeft voltooid
//   "stars"   — vrijgespeeld bij `unlockValue` sterren in totaal
//   "world"   — vrijgespeeld zodra de wereld met id `unlockValue` is voltooid
//
// characterType: "boy" | "girl" | "both"
//
// LET OP — placeholders: de kleuren hieronder worden door character.js op een
// vaste, eenvoudige silhouet-vorm gelegd (geen unieke illustratie per item).
// Zodra er definitieve character-art is, vervang je per item het "color"-veld
// door een "asset"-veld (pad naar de eigen illustratie-laag) — character.js
// is daarop voorbereid (zie het commentaar daar).
window.CHARACTER = {
  skinTones: ["#fbe3c7", "#f0c294", "#d9a066", "#b97a45", "#8a5a34", "#5c3c22"],

  items: [
    // ---------- Kleding (jongen) ----------
    { id: "outfit_boy_starter", category: "outfit", characterType: "boy", unlockType: "starter",
      color: "#5b8fb0", label: { ar: "ثوب أزرق", nl: "Blauwe outfit", en: "Blue outfit" } },
    { id: "outfit_boy_starter2", category: "outfit", characterType: "boy", unlockType: "starter",
      color: "#8a6b4a", label: { ar: "ثوب بني", nl: "Bruine outfit", en: "Brown outfit" } },
    { id: "outfit_boy_green", category: "outfit", characterType: "boy", unlockType: "level", unlockValue: 5,
      color: "#4c8a5e", label: { ar: "ثوب أخضر", nl: "Groene outfit", en: "Green outfit" } },
    { id: "outfit_boy_thobe", category: "outfit", characterType: "boy", unlockType: "level", unlockValue: 10,
      color: "#f4f1e8", label: { ar: "ثوب أبيض", nl: "Witte thobe", en: "White thobe" } },
    { id: "outfit_boy_oasis", category: "outfit", characterType: "boy", unlockType: "world", unlockValue: "letter_oasis",
      color: "#c99a3c", label: { ar: "حلة الواحة", nl: "Oase-outfit", en: "Oasis outfit" } },

    // ---------- Kleding (meisje) ----------
    { id: "outfit_girl_starter", category: "outfit", characterType: "girl", unlockType: "starter",
      color: "#b06a9a", label: { ar: "فستان وردي", nl: "Roze jurk", en: "Pink dress" } },
    { id: "outfit_girl_starter2", category: "outfit", characterType: "girl", unlockType: "starter",
      color: "#6a7fb0", label: { ar: "فستان أزرق", nl: "Blauwe jurk", en: "Blue dress" } },
    { id: "outfit_girl_teal", category: "outfit", characterType: "girl", unlockType: "level", unlockValue: 5,
      color: "#3f8f8a", label: { ar: "فستان فيروزي", nl: "Turquoise jurk", en: "Teal dress" } },
    { id: "outfit_girl_abaya", category: "outfit", characterType: "girl", unlockType: "level", unlockValue: 10,
      color: "#3a3a4a", label: { ar: "عباية", nl: "Abaya", en: "Abaya" } },
    { id: "outfit_girl_oasis", category: "outfit", characterType: "girl", unlockType: "world", unlockValue: "letter_oasis",
      color: "#c99a3c", label: { ar: "حلة الواحة", nl: "Oase-outfit", en: "Oasis outfit" } },

    // ---------- Hijab (meisje) ----------
    { id: "hijab_rose", category: "hijab", characterType: "girl", unlockType: "starter",
      color: "#d98fa3", label: { ar: "حجاب وردي", nl: "Roze hijab", en: "Rose hijab" } },
    { id: "hijab_lilac", category: "hijab", characterType: "girl", unlockType: "starter",
      color: "#a98fd9", label: { ar: "حجاب بنفسجي", nl: "Lila hijab", en: "Lilac hijab" } },
    { id: "hijab_sky", category: "hijab", characterType: "girl", unlockType: "stars", unlockValue: 10,
      color: "#7cb9d9", label: { ar: "حجاب سماوي", nl: "Hemelsblauwe hijab", en: "Sky-blue hijab" } },
    { id: "hijab_gold", category: "hijab", characterType: "girl", unlockType: "stars", unlockValue: 25,
      color: "#d9b23c", label: { ar: "حجاب ذهبي", nl: "Gouden hijab", en: "Golden hijab" } },
    { id: "hijab_sage", category: "hijab", characterType: "girl", unlockType: "level", unlockValue: 8,
      color: "#8fae7c", label: { ar: "حجاب أخضر فاتح", nl: "Zachtgroene hijab", en: "Sage hijab" } },

    // ---------- Schoenen (beide) ----------
    { id: "shoes_brown", category: "shoes", characterType: "both", unlockType: "starter",
      color: "#6b4a26", label: { ar: "حذاء بني", nl: "Bruine schoenen", en: "Brown shoes" } },
    { id: "shoes_gold", category: "shoes", characterType: "both", unlockType: "stars", unlockValue: 15,
      color: "#c99a3c", label: { ar: "حذاء ذهبي", nl: "Gouden schoenen", en: "Golden shoes" } },

    // ---------- Accessoires (beide) ----------
    { id: "acc_none", category: "accessory", characterType: "both", unlockType: "starter",
      color: null, label: { ar: "بدون", nl: "Geen", en: "None" } },
    { id: "acc_star", category: "accessory", characterType: "both", unlockType: "stars", unlockValue: 30,
      color: "#ffd257", label: { ar: "وسام نجمة", nl: "Sterrenbadge", en: "Star badge" } },
  ],
};
