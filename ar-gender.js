// Arabische schermtekst in de mannelijke of vrouwelijke vorm, naar het personage van het actieve profiel.
// In het Arabisch verschilt "jij" per geslacht (اختر = jongen, اختاري = meisje). De teksten in de app zijn in de mannelijke vorm
// geschreven; voor een meisje zet deze module ze om. Alleen voor Arabisch en alleen als het personage een meisje is.
(() => {
  "use strict";

  // mannelijk → vrouwelijk (hele woorden; lange eerst). Voorvoegsels als وَ (en) staan er apart in.
  const PAIRS = [
    ["أحسنت", "أحسنتِ"], ["أتممت", "أتممتِ"], ["سمعته", "سمعتِه"], ["توقفت", "توقفتِ"],
    ["ابدأ", "ابدئي"], ["العب", "العبي"], ["وتعلّم", "وتعلّمي"], ["تعلّم الحروف", "تعلّمي الحروف"], ["استمع", "استمعي"], ["اضغط", "اضغطي"],
    ["حاول", "حاولي"], ["اكتشف", "اكتشفي"], ["افتح", "افتحي"], ["اختر", "اختاري"], ["واختر", "واختاري"], ["اصنع", "اصنعي"],
    ["اشترِ", "اشتري"], ["اشتره", "اشتريه"], ["لتحتفظ", "لتحتفظي"], ["تجرّب", "تجرّبين"], ["تحتاج", "تحتاجين"],
    ["ابحث", "ابحثي"], ["اجمع", "اجمعي"], ["صوّر", "صوّري"], ["وصوّر", "وصوّري"], ["اسحب", "اسحبي"], ["اتركه", "اتركيه"],
    ["قرّب", "قرّبي"], ["والتقط", "والتقطي"], ["التقط", "التقطي"], ["ضع", "ضعي"], ["اقترب", "اقتربي"], ["اسبح", "اسبحي"],
    ["خذ", "خذي"], ["وأعطها", "وأعطيها"], ["أكمل", "أكملي"], ["اعبر", "اعبري"], ["واعبر", "واعبري"], ["أصب", "أصيبي"], ["وأصب", "وأصيبي"],
    ["استمر", "استمري"], ["تابع", "تابعي"], ["أنت", "أنتِ"], ["مستعدّ", "مستعدّة"], ["مستعد", "مستعدة"], ["اسمع", "اسمعي"],
  ];
  const DICT = Object.fromEntries(PAIRS);
  const LET = "\\u0621-\\u064A\\u064B-\\u0652\\u0670";
  const RE = new RegExp(`(?<![${LET}])(${PAIRS.map((p) => p[0]).sort((a, b) => b.length - a.length).join("|")})(?![${LET}])`, "g");

  const read = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };
  const lang = () => read("lang") || "nl";
  function isFem() {
    const pid = read("gp_active");
    return !!pid && ((read(`gp_avatar_${pid}`) || {}).type === "girl");
  }
  const active = () => lang() === "ar" && isFem();

  function fem(s) { return typeof s === "string" && active() ? s.replace(RE, (m) => DICT[m] || m) : s; }

  // Hele tekst-tabellen (strings, lijsten, functies die tekst teruggeven) in één keer omzetten; per tabel onthouden.
  const memo = new WeakMap();
  function conv(v) {
    if (typeof v === "string") return v.replace(RE, (m) => DICT[m] || m);
    if (typeof v === "function") return (...a) => conv(v(...a));
    if (Array.isArray(v)) return v.map(conv);
    if (v && typeof v === "object") { const o = {}; for (const k of Object.keys(v)) o[k] = conv(v[k]); return o; }
    return v;
  }
  function deep(table) {
    if (!table || typeof table !== "object" || !active()) return table;
    if (!memo.has(table)) memo.set(table, conv(table));
    return memo.get(table);
  }

  window.ArF = { fem, deep, isFem, active };
})();
