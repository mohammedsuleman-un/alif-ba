#!/usr/bin/env node
// Zet de genummerde Arabische opnames (alif-ba-opnames/bron/NN.mp3) op hun plek in de app en werkt de teksten in het manifest bij.
//   - jongen   → audio/instructions/ar/<id>.mp3
//   - meisje   → audio/instructions/ar-f/<id>.mp3
//   - beide    → in allebei de mappen
//   - De zinnen die voor jongens en meisjes hetzelfde zijn en al een originele opname hadden, houden die: de oude computerstem-versie
//     voor meisjes (ar-f) wordt verwijderd, zodat de app terugvalt op de originele opname.
// Gebruik: node scripts/import-opnames.cjs [--dry-run]
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const SRC = path.join(ROOT, "..", "alif-ba-opnames", "bron");
const OUT = path.join(ROOT, "audio", "instructions");
const MANIFEST = path.join(ROOT, "voice-manifest.js");
const DRY = process.argv.includes("--dry-run");

const map = JSON.parse(fs.readFileSync(path.join(__dirname, "opnames-mapping.json"), "utf8"));
const pad = (n) => String(n).padStart(2, "0");

// 1) bestanden controleren en kopiëren
const missing = map.filter((r) => !fs.existsSync(path.join(SRC, `${pad(r.nr)}.mp3`)));
if (missing.length) { console.error("Ontbrekende opnames: " + missing.map((r) => pad(r.nr)).join(", ")); process.exit(1); }
let copied = 0;
for (const r of map) {
  const src = path.join(SRC, `${pad(r.nr)}.mp3`);
  for (const f of r.files) {
    const dst = path.join(ROOT, f);
    if (!DRY) { fs.mkdirSync(path.dirname(dst), { recursive: true }); fs.copyFileSync(src, dst); }
    copied++;
  }
}

// 2) oude computerstem-opnames voor meisjes weghalen waar de originele opname voor beide geldt
const NEUTRAL_EXISTING = ["lets-start", "missing-letter", "correct-01", "correct-04", "last-question", "three-stars"];
let removed = 0;
for (const id of NEUTRAL_EXISTING) {
  const f = path.join(OUT, "ar-f", `${id}.mp3`);
  if (fs.existsSync(f)) { if (!DRY) fs.unlinkSync(f); removed++; }
}

// 3) manifest: Arabische teksten bijwerken (ar = jongen/beide, arF = meisje/beide)
let txt = fs.readFileSync(MANIFEST, "utf8");
const esc = (s) => s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
function setField(id, field, value) {
  const start = txt.indexOf(`"${id}":`);
  if (start < 0) throw new Error("id niet in manifest: " + id);
  const end = txt.indexOf("}", start);
  let block = txt.slice(start, end + 1);
  const re = new RegExp(`(?<![A-Za-z])${field}:\\s*(?:"(?:[^"\\\\]|\\\\.)*"|null)`);
  const rep = `${field}: "${esc(value)}"`;
  if (re.test(block)) block = block.replace(re, () => rep);
  else if (/needsReview/.test(block)) block = block.replace(/(\s*)needsReview/, (m, sp) => `${sp}${rep},${sp}needsReview`);
  else block = block.replace(/\s*\}$/, `, ${rep} }`);
  txt = txt.slice(0, start) + block + txt.slice(end + 1);
}
for (const r of map) {
  if (r.group === "A") { if (r.voor === "meisje") setField(r.id, "arF", r.ar); continue; } // jongenstekst van de originelen blijft
  if (r.voor === "jongen") setField(r.id, "ar", r.ar);
  else if (r.voor === "meisje") setField(r.id, "arF", r.ar);
  else { setField(r.id, "ar", r.ar); setField(r.id, "arF", r.ar); }
}
if (!DRY) fs.writeFileSync(MANIFEST, txt, "utf8");

// 4) controle: elke zin heeft nu Arabische tekst en een opname voor jongen en meisje (meisje mag terugvallen op jongen)
delete require.cache[require.resolve(MANIFEST)];
const V = require(MANIFEST).instructions;
const problems = [];
for (const id of Object.keys(V)) {
  if (!V[id].ar) problems.push(`${id}: geen Arabische tekst`);
  if (!fs.existsSync(path.join(OUT, "ar", `${id}.mp3`))) problems.push(`${id}: geen opname voor jongens`);
}
console.log(`${DRY ? "(proefdraai) " : ""}${copied} bestanden geplaatst, ${removed} oude meisjesopnames verwijderd, ${map.length} opnames verwerkt.`);
console.log(problems.length ? "Aandachtspunten:\n  " + problems.join("\n  ") : "Controle: alle " + Object.keys(V).length + " zinnen hebben Arabische tekst en een opname.");
