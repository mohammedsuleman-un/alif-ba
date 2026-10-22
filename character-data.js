// Personage-gegevens: puur data, geen logica (zoals game-data.js).
//
// Het personage is één officiële, scherpe illustratie per type (jongen/meisje). Alles wat het
// kind kan veranderen gebeurt in code, over die illustratie heen (zie character.js):
//   - huidskleur (3 tinten), accentkleur (hijab / borduursel), jurk- of thobe-kleur,
//     schoenen/sandalen, kufi: kleur-aanpassingen van de illustratie zelf;
//   - accessoires (hoofd, gezicht, hals, rug, hand, huisdier): getekende lagen er overheen;
//   - emoties: bewegingen + effecten (geen aparte tekeningen nodig).
//
// Winkel: elk item heeft een `price` (munten) en een `shelf` = aantal voltooide niveaus waarna het in
// de winkel verschijnt (zo komt er elke ~3 niveaus nieuwe voorraad). price 0 = gratis startitem.
window.CHARACTER = {
  skinTones: [
    { id: "light", swatch: "#f3cfae" },
    { id: "medium", swatch: "#dba074" },
    { id: "dark", swatch: "#7c4e30" },
  ],

  // Accentkleuren: hoeveel graden de roze tinten van de illustratie (hijab, borduursel, schoenen) opschuiven.
  accents: {
    pink:   { sw: "#e8678d", sh: 0 },
    red:    { sw: "#d93b4b", sh: 12, ks: 1.05, dl: -0.04 },
    orange: { sw: "#f08a3a", sh: 40, ks: 1.1 },
    yellow: { sw: "#f2c542", sh: 68, ks: 1.1, dl: 0.04 },
    green:  { sw: "#4fc77a", sh: 150 },
    teal:   { sw: "#2fb5a5", sh: 185 },
    blue:   { sw: "#4aa3e8", sh: 205 },
    navy:   { sw: "#3b5fc9", sh: 232, dl: -0.05 },
    purple: { sw: "#8b5fd6", sh: 268 },
    lilac:  { sw: "#b38be3", sh: 292, ks: 0.9, dl: 0.04 },
    white:  { sw: "#f7f4f0", white: true },
    black:  { sw: "#3a3638", black: true },
  },

  // Stofkleuren (jurk / thobe / kufi): de crème-witte stof krijgt deze tint.
  cloths: {
    cream:  { sw: "#f5ead6", none: true },
    mint:   { sw: "#bfe9d4", h: 150, s: 0.5 },
    sky:    { sw: "#bcdcf2", h: 205, s: 0.55 },
    lilac:  { sw: "#d9c7f0", h: 275, s: 0.5 },
    butter: { sw: "#f7e3a0", h: 48, s: 0.6 },
    rose:   { sw: "#f3c4d2", h: 340, s: 0.5 },
    sage:   { sw: "#c6dcb4", h: 100, s: 0.35 },
    peach:  { sw: "#f6cfb3", h: 20, s: 0.6 },
    grey:   { sw: "#d6d8de", h: 220, s: 0.1, lf: 0.9 },
    emerald:{ sw: "#3f9b78", h: 160, s: 0.55, lf: 0.62 },
    royal:  { sw: "#4b6bc0", h: 225, s: 0.55, lf: 0.64 },
    plum:   { sw: "#8a5c9c", h: 290, s: 0.4, lf: 0.62 },
    black:  { sw: "#3b3b42", h: 0, s: 0, lf: 0.3 },
  },

  // Sandalen van de jongen (bruin in de illustratie).
  sandals: {
    brown:  { sw: "#8a5a34", none: true },
    blue:   { sw: "#4a83c8", h: 215 },
    green:  { sw: "#4a9a63", h: 140 },
    red:    { sw: "#c24a4a", h: 2 },
    yellow: { sw: "#d8a93a", h: 42 },
    purple: { sw: "#7e5ab8", h: 275 },
    black:  { sw: "#3a3a3e", s: 0.08, lf: 0.55 },
  },

  items: [],   // wordt hieronder opgebouwd
};

(() => {
  const C = window.CHARACTER;
  const L = (ar, nl, en, tr) => ({ ar, nl, en, tr });
  const COLOR_NAME = {
    pink: L("وردي", "roze", "pink", "pembe"), red: L("أحمر", "rood", "red", "kırmızı"), orange: L("برتقالي", "oranje", "orange", "turuncu"),
    yellow: L("أصفر", "geel", "yellow", "sarı"), green: L("أخضر", "groen", "green", "yeşil"), teal: L("فيروزي", "turkoois", "teal", "turkuaz"),
    blue: L("أزرق", "blauw", "blue", "mavi"), navy: L("كحلي", "donkerblauw", "navy", "lacivert"), purple: L("بنفسجي", "paars", "purple", "mor"),
    lilac: L("ليلكي", "lila", "lilac", "eflatun"), white: L("أبيض", "wit", "white", "beyaz"), black: L("أسود", "zwart", "black", "siyah"),
    cream: L("كريمي", "crème", "cream", "krem"), mint: L("نعناعي", "mint", "mint", "nane"), sky: L("سماوي", "hemelsblauw", "sky blue", "gök mavisi"),
    butter: L("زبدي", "botergeel", "butter", "tereyağı"), rose: L("وردي فاتح", "zachtroze", "soft rose", "gül"), sage: L("أخضر هادئ", "saliegroen", "sage", "adaçayı"),
    peach: L("خوخي", "perzik", "peach", "şeftali"), grey: L("رمادي", "grijs", "grey", "gri"), emerald: L("زمردي", "smaragd", "emerald", "zümrüt"),
    royal: L("أزرق ملكي", "koningsblauw", "royal blue", "kraliyet mavisi"), plum: L("برقوقي", "pruim", "plum", "erik"), brown: L("بني", "bruin", "brown", "kahverengi"),
  };
  const NOUN = {
    hijab: L("حجاب", "hijab", "hijab", "başörtüsü"), dress: L("فستان", "jurk", "dress", "elbise"), thobe: L("ثوب", "thobe", "thobe", "entari"),
    shoes: L("حذاء", "schoenen", "shoes", "ayakkabı"), sandals: L("صندل", "sandalen", "sandals", "sandalet"), kufi: L("طاقية", "kufi", "kufi", "takke"),
  };
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const colorLabel = (noun, color) => ({
    ar: `${noun.ar} ${COLOR_NAME[color].ar}`, nl: `${cap(COLOR_NAME[color].nl)} ${noun.nl}`,
    en: `${cap(COLOR_NAME[color].en)} ${noun.en}`, tr: `${cap(COLOR_NAME[color].tr)} ${noun.tr}`,
  });

  // [kleur, prijs, schap] — schap 0 + prijs 0 = gratis startitem
  const add = (category, type, noun, key, list, sw) => list.forEach(([color, price, shelf]) => C.items.push({
    id: `${key}_${color}`, category, characterType: type, color, price, shelf,
    swatch: sw[color].sw, label: colorLabel(noun, color),
  }));

  // ---- Meisje ----
  add("hijab", "girl", NOUN.hijab, "hijab", [["pink", 0, 0], ["lilac", 0, 0], ["blue", 25, 0], ["green", 25, 2], ["teal", 30, 3], ["yellow", 30, 4],
    ["orange", 35, 5], ["red", 35, 6], ["white", 40, 7], ["black", 40, 8], ["navy", 40, 9], ["purple", 40, 10]], C.accents);
  add("outfit", "girl", NOUN.dress, "dress", [["cream", 0, 0], ["mint", 0, 0], ["sky", 25, 1], ["lilac", 25, 2], ["butter", 30, 3], ["rose", 30, 4], ["peach", 35, 5],
    ["sage", 35, 6], ["grey", 35, 7], ["emerald", 55, 8], ["royal", 55, 9], ["plum", 55, 10], ["black", 60, 11]], C.cloths);
  add("shoes", "girl", NOUN.shoes, "shoes_g", [["pink", 0, 0], ["white", 20, 0], ["blue", 25, 1], ["purple", 25, 3], ["yellow", 30, 4], ["red", 30, 5], ["green", 30, 6], ["black", 35, 8]], C.accents);

  // ---- Jongen ----
  add("outfit", "boy", NOUN.thobe, "thobe", [["cream", 0, 0], ["mint", 0, 0], ["sky", 25, 1], ["lilac", 25, 2], ["butter", 30, 3], ["rose", 30, 4], ["peach", 35, 5],
    ["sage", 35, 6], ["grey", 35, 7], ["emerald", 55, 8], ["royal", 55, 9], ["plum", 55, 10], ["black", 60, 11]], C.cloths);
  add("shoes", "boy", NOUN.sandals, "sandals", [["brown", 0, 0], ["blue", 20, 0], ["green", 25, 1], ["red", 25, 3], ["yellow", 30, 4], ["purple", 30, 6], ["black", 35, 8]], C.sandals);
  add("kufi", "boy", NOUN.kufi, "kufi", [["cream", 0, 0], ["sky", 20, 0], ["mint", 20, 1], ["rose", 25, 3], ["butter", 25, 4], ["emerald", 40, 6], ["royal", 40, 8], ["black", 45, 10]], C.cloths);

  // ---- Accessoires (getekende lagen; `art` = naam van de tekenfunctie in character.js) ----
  // Leeftijdsfasen (1 = klein, 2 = middel, 3 = groot): `stages` bepaalt in welke fase een item in de winkel staat.
  // Wat je al bezit blijft altijd van jou en te dragen. Default = alle fasen.
  const acc = (id, category, art, icon, price, shelf, label, type, stages) => C.items.push({ id, category, art, icon, characterType: type || "both", price, shelf, label, stages: stages || [1, 2, 3] });
  acc("head_star",    "head", "starband",  "⭐", 40, 1,  L("حزام نجمة", "Sterrenband", "Star headband", "Yıldız bandı"), "both", [1, 2]);
  acc("head_party",   "head", "party",     "🎉", 60, 3,  L("قبعة حفلة", "Feesthoedje", "Party hat", "Parti şapkası"), "both", [1]);
  acc("head_flowers", "head", "flowers",   "🌸", 80, 5,  L("إكليل زهور", "Bloemenkrans", "Flower crown", "Çiçek tacı"), "both", [1, 2]);
  acc("head_crown",   "head", "crown",     "👑", 160, 8, L("تاج ذهبي", "Gouden kroon", "Golden crown", "Altın taç"));
  acc("head_cap",     "head", "cap",       "🧢", 60, 2,  L("قبعة رياضية", "Sportpet", "Sports cap", "Spor şapka"), "both", [2, 3]);
  acc("head_phones",  "head", "headphones","🎧", 90, 5,  L("سماعات", "Koptelefoon", "Headphones", "Kulaklık"), "both", [2, 3]);
  acc("face_glasses", "face", "glasses",   "👓", 50, 2,  L("نظارة", "Ronde bril", "Round glasses", "Yuvarlak gözlük"));
  acc("face_sun",     "face", "sunglasses","🕶️", 80, 4, L("نظارة شمسية", "Zonnebril", "Sunglasses", "Güneş gözlüğü"));
  acc("neck_bow",     "neck", "bowtie",    "🎀", 30, 1,  L("ربطة فراشة", "Strik", "Bow tie", "Papyon"), "both", [1, 2]);
  acc("neck_scarf",   "neck", "scarf",     "🧣", 50, 3,  L("وشاح", "Sjaal", "Scarf", "Atkı"));
  acc("neck_medal",   "neck", "medal",     "🏅", 90, 6,  L("ميدالية", "Gouden medaille", "Gold medal", "Altın madalya"));
  acc("hand_balloon", "hand", "balloon",   "🎈", 40, 2,  L("بالون", "Ballon", "Balloon", "Balon"), "both", [1]);
  acc("hand_lantern", "hand", "lantern",   "🏮", 90, 5,  L("فانوس", "Lantaarn", "Lantern", "Fener"), "both", [1, 2]);
  acc("hand_watch",   "hand", "watch",     "⌚", 70, 4,  L("ساعة", "Horloge", "Watch", "Saat"), "both", [2, 3]);
  acc("hand_tasbih",  "hand", "tasbih",    "📿", 80, 6,  L("سبحة", "Tasbih", "Prayer beads", "Tespih"), "both", [2, 3]);
  acc("hand_quran",   "hand", "quran",     "📖", 120, 8, L("مصحف", "Koran", "Qur'an", "Kur'an"), "both", [2, 3]);
  acc("back_wings",   "back", "butterfly", "🦋", 200, 9, L("أجنحة فراشة", "Vlindervleugels", "Butterfly wings", "Kelebek kanatları"), "both", [1, 2]);
  acc("back_pack",    "back", "backpack",  "🎒", 100, 3, L("حقيبة مدرسية", "Schooltas", "School bag", "Okul çantası"), "both", [2, 3]);
  acc("pet_duck",     "pet",  "duck",      "🦆", 100, 4, L("بطة صغيرة", "Eendje", "Little duck", "Ördek"), "both", [1]);
  acc("pet_cat",      "pet",  "cat",       "🐱", 150, 7, L("قطة", "Katje", "Kitten", "Kedi"), "both", [1, 2, 3]);

  // Categorieën in de volgorde van de kledingkast; `types` = voor wie.
  C.categories = [
    { id: "skin",   icon: "🎨", types: ["girl", "boy"], label: L("لون البشرة", "Huidskleur", "Skin tone", "Ten rengi") },
    { id: "hijab",  icon: "🧕", types: ["girl"],        label: L("الحجاب", "Hijab", "Hijab", "Başörtüsü") },
    { id: "kufi",   icon: "🧢", types: ["boy"],         label: L("الطاقية", "Kufi", "Kufi", "Takke") },
    { id: "outfit", icon: "👗", types: ["girl", "boy"], label: L("الملابس", "Kleding", "Outfit", "Kıyafet") },
    { id: "shoes",  icon: "👟", types: ["girl", "boy"], label: L("الحذاء", "Schoenen", "Shoes", "Ayakkabı") },
    { id: "head",   icon: "👑", types: ["girl", "boy"], label: L("الرأس", "Hoofd", "Head", "Baş") },
    { id: "face",   icon: "👓", types: ["girl", "boy"], label: L("الوجه", "Gezicht", "Face", "Yüz") },
    { id: "neck",   icon: "🎀", types: ["girl", "boy"], label: L("الرقبة", "Hals", "Neck", "Boyun") },
    { id: "hand",   icon: "🎈", types: ["girl", "boy"], label: L("اليد", "Hand", "Hand", "El") },
    { id: "back",   icon: "🦋", types: ["girl", "boy"], label: L("الظهر", "Rug", "Back", "Sırt") },
    { id: "pet",    icon: "🐱", types: ["girl", "boy"], label: L("رفيق", "Maatje", "Buddy", "Arkadaş") },
  ];
})();
