#!/usr/bin/env node
// Genereert instructie-voice-overs (NL/EN/AR) via ElevenLabs, op basis van het
// centrale manifest in voice-manifest.js.
//
// BELANGRIJK — lees dit voor gebruik:
//   - Genereert ALLEEN de instructie-/feedback-audio (welcome, listen, correct-01, ...).
//     Genereert NOOIT de Arabische leeruitspraak (letters/harakat/woorden) of
//     Qur'an-/hadith-audio — die wordt apart, door een kundige Arabischspreker
//     ingesproken en handmatig in audio/ (game-data.js: letterAudio) geplaatst.
//   - Commit nooit een API-key. Alles komt uit environment variables, nooit uit
//     een bestand dat in git staat:
//       TTS_API_KEY          jouw ElevenLabs API-key
//       TTS_VOICE_AR / _NL / _EN     een ElevenLabs voice-ID per taal, OF
//       TTS_VOICE_NAME_AR / _NL / _EN   de naam van de stem zoals in ElevenLabs
//                                       (bv. "arabic young adult") — het script
//                                       zoekt dan zelf de bijbehorende voice-ID op.
//   - Zonder TTS_API_KEY draait het script in rapport-modus: het telt en toont
//     precies welke bestanden ontbreken, zonder iets aan te roepen.
//
// Gebruik:
//   node scripts/generate-voiceovers.cjs --list-voices
//     Toont al je ElevenLabs-stemmen met hun naam en voice-ID (alleen TTS_API_KEY nodig).
//
//   node scripts/generate-voiceovers.cjs [--lang=nl|en|ar|all] [--overwrite] [--dry-run]
//     Genereert de instructie-mp3's.
//
// Voorbeeld (macOS/Linux):
//   export TTS_API_KEY="..."
//   export TTS_VOICE_NAME_AR="arabic young adult"
//   node scripts/generate-voiceovers.cjs --lang=ar
//
// Voorbeeld (Windows PowerShell):
//   $env:TTS_API_KEY = "..."
//   $env:TTS_VOICE_NAME_AR = "arabic young adult"
//   node scripts/generate-voiceovers.cjs --lang=ar
//
// Gedrag:
//   1. Leest voice-manifest.js
//   2. Bepaalt voor de gekozen taal/talen welke audio/instructions/<taal>/<id>.mp3
//      al bestaan
//   3. Genereert alleen ontbrekende bestanden (of ALLE bestanden met --overwrite)
//   4. Rapporteert wat is aangemaakt, wat is overgeslagen, en eventuele errors
//   5. Waarschuwt apart voor Arabische teksten met needsReview: true

"use strict";
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const VOICE = require(path.join(ROOT, "voice-manifest.js"));
const OUT_DIR = path.join(ROOT, "audio", "instructions");
const LANGS = ["nl", "en", "ar"];
const ELEVEN_MODEL = process.env.TTS_MODEL_ID || "eleven_multilingual_v2";

function parseArgs(argv) {
  const opts = { lang: "all", overwrite: false, dryRun: false, listVoices: false };
  for (const arg of argv) {
    if (arg.startsWith("--lang=")) opts.lang = arg.slice(7);
    else if (arg === "--overwrite") opts.overwrite = true;
    else if (arg === "--dry-run") opts.dryRun = true;
    else if (arg === "--list-voices") opts.listVoices = true;
  }
  return opts;
}

async function fetchVoices(apiKey) {
  const res = await fetch("https://api.elevenlabs.io/v1/voices", { headers: { "xi-api-key": apiKey } });
  if (!res.ok) throw new Error(`Kon stemmenlijst niet ophalen (${res.status}): ${await res.text()}`);
  const data = await res.json();
  return data.voices || [];
}

async function synthesize(apiKey, text, voiceId) {
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: "POST",
    headers: { "xi-api-key": apiKey, "Content-Type": "application/json", Accept: "audio/mpeg" },
    body: JSON.stringify({ text, model_id: ELEVEN_MODEL }),
  });
  if (!res.ok) throw new Error(`ElevenLabs-fout (${res.status}): ${await res.text()}`);
  return Buffer.from(await res.arrayBuffer());
}

// Bepaalt de voice-ID voor een taal: direct (TTS_VOICE_<TAAL>) of via de naam
// (TTS_VOICE_NAME_<TAAL>), opgezocht in de ElevenLabs-stemmenlijst van dit account.
async function resolveVoiceId(apiKey, lang, voicesCache) {
  const direct = process.env[`TTS_VOICE_${lang.toUpperCase()}`];
  if (direct) return direct;
  const name = process.env[`TTS_VOICE_NAME_${lang.toUpperCase()}`];
  if (!name) return null;
  if (!voicesCache.list) voicesCache.list = await fetchVoices(apiKey);
  const match = voicesCache.list.find((v) => v.name.toLowerCase() === name.toLowerCase());
  if (!match) {
    const names = voicesCache.list.map((v) => v.name).join(", ") || "(geen stemmen gevonden op dit account)";
    throw new Error(`Geen ElevenLabs-stem gevonden met naam "${name}". Beschikbaar: ${names}`);
  }
  return match.voice_id;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const apiKey = process.env.TTS_API_KEY;

  if (opts.listVoices) {
    if (!apiKey) { console.error("Zet eerst TTS_API_KEY (je ElevenLabs API-key) als environment variable."); process.exit(1); }
    const voices = await fetchVoices(apiKey);
    console.log(`${voices.length} stem(men) op dit ElevenLabs-account:\n`);
    voices.forEach((v) => console.log(`  ${v.name}  →  ${v.voice_id}`));
    return;
  }

  const langs = opts.lang === "all" ? LANGS : [opts.lang];
  for (const l of langs) {
    if (!LANGS.includes(l)) { console.error(`Onbekende taal: ${l} (verwacht nl, en, ar of all)`); process.exit(1); }
  }

  const canGenerate = !opts.dryRun && !!apiKey;
  if (!canGenerate) {
    console.log("── Rapport-modus ──────────────────────────────────────────");
    if (opts.dryRun) console.log("(--dry-run: er wordt niets aangeroepen)");
    else console.log("Geen TTS_API_KEY ingesteld — er wordt niets gegenereerd, alleen geteld.");
    console.log("");
  }

  const voicesCache = {};
  let created = 0, skipped = 0, missing = 0, errors = 0;
  const needsReviewCount = { nl: 0, en: 0, ar: 0 };
  const missingText = { nl: 0, en: 0, ar: 0 };

  for (const lang of langs) {
    const dir = path.join(OUT_DIR, lang);
    fs.mkdirSync(dir, { recursive: true });
    console.log(`\n== ${lang.toUpperCase()} ==`);

    let voiceId = null;
    if (canGenerate) {
      try {
        voiceId = await resolveVoiceId(apiKey, lang, voicesCache);
      } catch (err) {
        console.error(`  ✗ Stem voor ${lang} kon niet worden bepaald: ${err.message}`);
      }
      if (!voiceId) {
        console.log(`  ⚠ Geen TTS_VOICE_${lang.toUpperCase()} of TTS_VOICE_NAME_${lang.toUpperCase()} ingesteld — ${lang.toUpperCase()} wordt overgeslagen.`);
      }
    }

    for (const [id, entry] of Object.entries(VOICE.instructions)) {
      const text = entry[lang];
      const file = path.join(dir, `${id}.mp3`);
      const exists = fs.existsSync(file);
      if (lang === "ar" && entry.needsReview) needsReviewCount.ar++;

      if (!text) {
        missingText[lang]++;
        console.log(`  ⚠ ${id}: geen ${lang}-tekst in voice-manifest.js — overgeslagen`);
        continue;
      }
      if (exists && !opts.overwrite) { skipped++; continue; }
      if (!canGenerate || !voiceId) { missing++; continue; }

      try {
        const audio = await synthesize(apiKey, text, voiceId);
        fs.writeFileSync(file, audio);
        console.log(`  ✓ ${id}.mp3`);
        created++;
      } catch (err) {
        errors++;
        console.error(`  ✗ ${id}: ${err.message}`);
      }
    }
  }

  console.log("\n── Samenvatting ───────────────────────────────────────────");
  console.log(`Aangemaakt: ${created}   Overgeslagen (bestond al): ${skipped}   Ontbrekend: ${missing}   Errors: ${errors}`);
  for (const lang of langs) {
    if (missingText[lang]) console.log(`Let op: ${missingText[lang]} instructie(s) hebben nog geen ${lang}-tekst in voice-manifest.js.`);
  }
  if (langs.includes("ar")) {
    console.log(`\nArabische instructieteksten (${needsReviewCount.ar} stuks) staan gemarkeerd als needsReview: true —`);
    console.log("laat deze vóór productie controleren door een Arabisch moedertaalspreker (uitspraak/harakat/toon).");
  }
  if (!canGenerate) {
    console.log("\nOm echte audio te genereren:");
    console.log("  1. Zet TTS_API_KEY als environment variable (nooit committen).");
    console.log("  2. Zet TTS_VOICE_NAME_NL / _EN / _AR (of TTS_VOICE_NL / _EN / _AR met een voice-ID).");
    console.log(`  3. Draai opnieuw: node scripts/generate-voiceovers.cjs --lang=${opts.lang}`);
  } else if (missing) {
    console.log("\nSommige talen zijn overgeslagen omdat er geen stem voor is ingesteld — zie de waarschuwingen hierboven.");
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
