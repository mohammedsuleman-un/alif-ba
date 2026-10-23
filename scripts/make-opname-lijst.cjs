#!/usr/bin/env node
// Maakt de genummerde opnamelijst voor de Arabische instructiezinnen:
//   OPNAMES_ARABISCH.md   (leesbaar, om mee op te nemen)
//   opnames-arabisch.csv  (voor in Excel)
//   scripts/opnames-mapping.json (nummer → bestand in de app, voor het importscript)
// Gebruik: node scripts/make-opname-lijst.cjs
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const V = require(path.join(ROOT, "voice-manifest.js")).instructions;

// Rustvorm (waqf): de laatste klinker van elke zin vervalt en krijgt een sukoen (ْ). Tanwin ً wordt een gewone lange klank.
// [id, jongen, meisje]; meisje = null → voor beide hetzelfde. `nieuw`: zin is nieuw of nog zonder Arabische tekst.
const LINES = [
  // --- A. Bestaande zinnen ---
  ["welcome", "السَّلَامُ عَلَيْكُمْ! هَلْ أَنْتَ مُسْتَعِدّْ لِتَعَلُّمِ الْعَرَبِيَّةْ؟", "السَّلَامُ عَلَيْكُمْ! هَلْ أَنْتِ مُسْتَعِدَّةْ لِتَعَلُّمِ الْعَرَبِيَّةْ؟"],
  ["lets-start", "بِسْمِ اللهِ! هَيَّا نَبْدَأْ.", null],
  ["listen", "اِسْتَمِعْ جَيِّدَا.", "اِسْتَمِعِي جَيِّدَا."],
  ["listen-again", "اِسْتَمِعْ مَرَّةً أُخْرَى.", "اِسْتَمِعِي مَرَّةً أُخْرَى."],
  ["choose-letter", "اِخْتَرِ الْحَرْفَ الصَّحِيحْ.", "اِخْتَارِي الْحَرْفَ الصَّحِيحْ."],
  ["which-letter", "أَيَّ حَرْفٍ تَسْمَعْ؟", "أَيَّ حَرْفٍ تَسْمَعِينْ؟"],
  ["find-letter", "هَلْ تَسْتَطِيعُ أَنْ تَجِدَ الْحَرْفَ الصَّحِيحْ؟", "هَلْ تَسْتَطِيعِينَ أَنْ تَجِدِي الْحَرْفَ الصَّحِيحْ؟"],
  ["choose-sound", "اِخْتَرِ الصَّوْتَ الصَّحِيحْ.", "اِخْتَارِي الصَّوْتَ الصَّحِيحْ."],
  ["choose-word", "اِخْتَرِ الْكَلِمَةَ الصَّحِيحَةْ.", "اِخْتَارِي الْكَلِمَةَ الصَّحِيحَةْ."],
  ["which-word", "أَيَّ كَلِمَةٍ تَسْمَعْ؟", "أَيَّ كَلِمَةٍ تَسْمَعِينْ؟"],
  ["build-word", "كَوِّنِ الْكَلِمَةْ.", "كَوِّنِي الْكَلِمَةْ."],
  ["missing-letter", "أَيُّ حَرْفٍ نَاقِصْ؟", null],
  ["your-turn", "الْآنَ دَوْرُكْ!", "الْآنَ دَوْرُكِ!"],
  ["correct-01", "مَا شَاءَ اللَّهْ!", null],
  ["correct-02", "أَحْسَنْتَ!", "أَحْسَنْتِ!"],
  ["correct-03", "أَحْسَنْتَ صُنْعَا!", "أَحْسَنْتِ صُنْعَا!"],
  ["correct-04", "إِجَابَةٌ صَحِيحَةْ!", null],
  ["correct-05", "رَائِعْ!", "رَائِعَةْ!"],
  ["correct-06", "مَا شَاءَ اللَّهْ، وَاصِلْ!", "مَا شَاءَ اللَّهْ، وَاصِلِي!"],
  ["retry-01", "أَوْشَكْتَ! حَاوِلْ مَرَّةً أُخْرَى.", "أَوْشَكْتِ! حَاوِلِي مَرَّةً أُخْرَى."],
  ["retry-02", "مُحَاوَلَةٌ جَيِّدَةْ! اِسْتَمِعْ مَرَّةً أُخْرَى.", "مُحَاوَلَةٌ جَيِّدَةْ! اِسْتَمِعِي مَرَّةً أُخْرَى."],
  ["retry-03", "حَاوِلْ مَرَّةً أُخْرَى.", "حَاوِلِي مَرَّةً أُخْرَى."],
  ["level-start", "هَلْ أَنْتَ مُسْتَعِدّْ؟ هَيَّا بِنَا!", "هَلْ أَنْتِ مُسْتَعِدَّةْ؟ هَيَّا بِنَا!"],
  ["last-question", "سُؤَالٌ وَاحِدٌ فَقَطْ!", null],
  ["level-complete", "مَا شَاءَ اللَّهْ! أَكْمَلْتَ الْمُسْتَوَى!", "مَا شَاءَ اللَّهْ! أَكْمَلْتِ الْمُسْتَوَى!"],
  ["three-stars", "مَا شَاءَ اللَّهْ! ثَلَاثُ نُجُومْ!", null],
  ["new-level", "لَقَدْ فَتَحْتَ مُسْتَوًى جَدِيدَا!", "لَقَدْ فَتَحْتِ مُسْتَوًى جَدِيدَا!"],
  ["world-complete", "مَا شَاءَ اللَّهْ! أَكْمَلْتَ هَذَا الْعَالَمْ!", "مَا شَاءَ اللَّهْ! أَكْمَلْتِ هَذَا الْعَالَمْ!"],
  ["continue", "هَلْ أَنْتَ مُسْتَعِدّْ لِلْمُسْتَوَى التَّالِي؟", "هَلْ أَنْتِ مُسْتَعِدَّةْ لِلْمُسْتَوَى التَّالِي؟"],
  // --- B. Nieuwe zinnen (kaart, wereld, niveau, spellen) ---
  ["map-choose", "اِخْتَرْ عَالَمَا!", "اِخْتَارِي عَالَمَا!", "nieuw"],
  ["world-1", "الْعَالَمُ الْأَوَّلْ: الْحُرُوفُ الْعَرَبِيَّةْ.", null, "nieuw"],
  ["world-map-start", "اِلْمَسْ مُسْتَوَاكْ لِتَبْدَأْ.", "اِلْمَسِي مُسْتَوَاكِ لِتَبْدَئِي.", "nieuw"],
  ["level-choose", "تَعَلَّمِ الْحُرُوفَ، أَوِ الْعَبْ لُعْبَةْ!", "تَعَلَّمِي الْحُرُوفَ، أَوِ الْعَبِي لُعْبَةْ!", "nieuw"],
  ["slingshot-how", "اِسْحَبِ الْحَجَرَ إِلَى الْخَلْفْ ثُمَّ أَفْلِتْهْ. أَصِبِ الْفَانُوسَ الَّذِي عَلَيْهِ الْحَرْفُ الصَّحِيحْ!", "اِسْحَبِي الْحَجَرَ إِلَى الْخَلْفْ ثُمَّ أَفْلِتِيهْ. أَصِيبِي الْفَانُوسَ الَّذِي عَلَيْهِ الْحَرْفُ الصَّحِيحْ!", "nieuw"],
  ["photo-how", "قَرِّبِ الصُّورَةَ وَالْتَقِطْ صُورَةً لِلْحَرْفِ الصَّحِيحْ.", "قَرِّبِي الصُّورَةَ وَالْتَقِطِي صُورَةً لِلْحَرْفِ الصَّحِيحْ.", "nieuw"],
  ["diver-intro", "اِسْبَحْ إِلَى الْأَصْدَافْ وَخُذِ اللُّؤْلُؤَةَ الَّتِي عَلَيْهَا الْحَرْفُ الصَّحِيحْ. ثُمَّ خُذِ اللَّآلِئَ إِلَى الصَّدَفَةِ الْكَبِيرَةْ.", "اِسْبَحِي إِلَى الْأَصْدَافْ وَخُذِي اللُّؤْلُؤَةَ الَّتِي عَلَيْهَا الْحَرْفُ الصَّحِيحْ. ثُمَّ خُذِي اللَّآلِئَ إِلَى الصَّدَفَةِ الْكَبِيرَةْ.", "nieuw"],
  ["diver-hand", "اِسْبَحْ إِلَى الصَّدَفَةِ الْكَبِيرَةْ وَسَلِّمْهَا اللَّآلِئْ.", "اِسْبَحِي إِلَى الصَّدَفَةِ الْكَبِيرَةْ وَسَلِّمِيهَا اللَّآلِئْ.", "nieuw"],
  ["diver-chest", "سَتَحْصُلُ عَلَى مِفْتَاحْ. اِفْتَحِ الصُّنْدُوقْ!", "سَتَحْصُلِينَ عَلَى مِفْتَاحْ. اِفْتَحِي الصُّنْدُوقْ!", "nieuw"],
  ["bridge-how", "أَكْمِلْ صَفَّ الْحُرُوفْ. اِسْحَبِ اللَّوْحَ الصَّحِيحَ إِلَى الْمَكَانِ الْفَارِغْ.", "أَكْمِلِي صَفَّ الْحُرُوفْ. اِسْحَبِي اللَّوْحَ الصَّحِيحَ إِلَى الْمَكَانِ الْفَارِغْ.", "nieuw"],
  ["game-unlocked", "رَائِعْ! لَقَدْ كَسَبْتَ لُعْبَةً جَدِيدَةْ!", "رَائِعْ! لَقَدْ كَسَبْتِ لُعْبَةً جَدِيدَةْ!", "nieuw"],
  // --- C. Zinnen die nog geen Arabische tekst hadden (voorstel, laat controleren) ---
  ["tap-audio", "اُنْقُرْ عَلَى السَّمَّاعَةْ لِتَسْتَمِعْ.", "اُنْقُرِي عَلَى السَّمَّاعَةْ لِتَسْتَمِعِي.", "voorstel"],
  ["match", "طَابِقِ الْمُتَشَابِهَاتْ.", "طَابِقِي الْمُتَشَابِهَاتْ.", "voorstel"],
  ["hint", "هَذِهِ تَلْمِيحَةٌ صَغِيرَةْ.", null, "voorstel"],
  ["halfway", "وَصَلْتَ إِلَى النِّصْفْ!", "وَصَلْتِ إِلَى النِّصْفْ!", "voorstel"],
  ["new-badge", "لَقَدْ كَسَبْتَ وِسَامَا جَدِيدَا!", "لَقَدْ كَسَبْتِ وِسَامَا جَدِيدَا!", "voorstel"],
];

const rows = [];
let n = 0;
for (const [id, j, m, flag] of LINES) {
  if (!V[id]) throw new Error("onbekend id: " + id);
  const nl = V[id].nl;
  const group = flag === "voorstel" ? "C" : flag === "nieuw" ? "B" : "A";
  if (group === "A") {
    // Bestaande zinnen: de originele opnames (jongen, en de zinnen die voor beide gelden) blijven staan. Alleen de meisjesversie is nieuw.
    if (m !== null) rows.push({ nr: ++n, id, voor: "meisje", ar: m, nl, group, flag: "nieuw voor meisjes", file: [`audio/instructions/ar-f/${id}.mp3`] });
    continue;
  }
  if (m === null) rows.push({ nr: ++n, id, voor: "beide", ar: j, nl, group, flag: flag || "", file: [`audio/instructions/ar/${id}.mp3`, `audio/instructions/ar-f/${id}.mp3`] });
  else {
    rows.push({ nr: ++n, id, voor: "jongen", ar: j, nl, group, flag: flag || "", file: [`audio/instructions/ar/${id}.mp3`] });
    rows.push({ nr: ++n, id, voor: "meisje", ar: m, nl, group, flag: flag || "", file: [`audio/instructions/ar-f/${id}.mp3`] });
  }
}

const pad = (x) => String(x).padStart(2, "0");
const title = { A: "A. Meisjesversie van bestaande zinnen (de jongensopname bestaat al en blijft)", B: "B. Nieuwe zinnen (kaart, wereld, niveau, spellen)", C: "C. Zinnen die nog geen Arabische tekst hadden (voorstel, laat controleren)" };
let md = `# Arabische opnames: alleen wat nieuw is\n\n` +
`De originele opnames van voor vandaag (de zinnen voor jongens en de zinnen die voor beide gelden) blijven ongewijzigd en staan **niet** in deze lijst.\n\n` +
`Sla elke opname op als **het nummer** met extensie \`.mp3\` (of .m4a / .wav), bijvoorbeeld \`01.mp3\`, \`02.mp3\`. Dan weet ik precies welke zin het is.\n\n` +
`- **${rows.length} opnames** in totaal: ${rows.filter((r) => r.group === "A").length} meisjesversies van bestaande zinnen (nr ${rows.find((r) => r.group === "A").nr} t/m ${rows.filter((r) => r.group === "A").pop().nr}), ${rows.filter((r) => r.group === "B").length} nieuwe zinnen (nr ${rows.find((r) => r.group === "B").nr} t/m ${rows.filter((r) => r.group === "B").pop().nr}) en ${rows.filter((r) => r.group === "C").length} voorgestelde zinnen (nr ${rows.find((r) => r.group === "C").nr} t/m ${rows.filter((r) => r.group === "C").pop().nr}). Daarvan zijn ${rows.filter((r) => r.voor === "beide").length} voor jongens en meisjes hetzelfde.\n` +
`- **Rustvorm:** het laatste woord van elke zin eindigt op een sukoen (ْ). Spreek de laatste klinker dus niet uit. Tanwin (ً) aan het eind wordt een gewone lange klank (جَيِّدَا).\n` +
`- **Jongen / meisje:** de zin voor een jongen spreek je tegen een jongen, de zin voor een meisje tegen een meisje. "Beide" is voor allebei dezelfde opname.\n` +
`- Houd ongeveer een halve seconde stilte aan het begin en eind. Spreek rustig en duidelijk, zoals tegen een kind.\n\n`;
for (const g of ["A", "B", "C"]) {
  md += `## ${title[g]}\n\n| Nr | Voor | Arabisch | Betekenis |\n|---:|---|---|---|\n`;
  for (const r of rows.filter((x) => x.group === g)) md += `| **${pad(r.nr)}** | ${r.voor} | <span dir="rtl" lang="ar">${r.ar}</span> | ${r.nl} |\n`;
  md += "\n";
}
fs.writeFileSync(path.join(ROOT, "OPNAMES_ARABISCH.md"), md, "utf8");

const q = (v) => `"${String(v).replace(/"/g, '""')}"`;
fs.writeFileSync(path.join(ROOT, "opnames-arabisch.csv"), "﻿" + ["Nr;Voor;Arabisch;Betekenis;Groep;ID", ...rows.map((r) => [pad(r.nr), r.voor, r.ar, r.nl, r.group, r.id].map(q).join(";"))].join("\r\n"), "utf8");
fs.writeFileSync(path.join(__dirname, "opnames-mapping.json"), JSON.stringify(rows.map((r) => ({ nr: r.nr, id: r.id, voor: r.voor, group: r.group, ar: r.ar, files: r.file })), null, 1), "utf8");
console.log(`${rows.length} opnames (${LINES.length} zinnen)`);
