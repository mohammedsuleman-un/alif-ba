#!/usr/bin/env node
// Genereert instructie-voice-overs (NL/EN/AR) via een Text-to-Speech provider,
// op basis van het centrale manifest in voice-manifest.js.
//
// BELANGRIJK — leest dit voor gebruik:
//   - Genereert ALLEEN de instructie-/feedback-audio (welcome, listen, correct-01, ...).
//     Genereert NOOIT de Arabische leeruitspraak (letters/harakat/woorden) of
//     Qur'an-/hadith-audio — die wordt apart, door een kundige Arabischspreker
//     ingesproken en handmatig in audio/ (game-data.js: letterAudio) geplaatst.
//   - Commit nooit een API-key. Alles komt uit environment variables:
//       TTS_PROVIDER   bv. "openai" of "elevenlabs" (zie PROVIDERS hieronder)
//       TTS_API_KEY    de sleutel voor die provider
//       TTS_VOICE_NL / TTS_VOICE_EN / TTS_VOICE_AR   optioneel: voice-ID per taal
//   - Er is bewust GEEN provider hard aangesloten: kies eerst samen met de
//     projecteigenaar een betaalde provider voordat dit script echte audio genereert.
//     Zonder TTS_PROVIDER/TTS_API_KEY draait het script in rapport-modus: het
//     telt en toont precies welke bestanden ontbreken, zonder iets aan te roepen.
//
// Gebruik:
//   node scripts/generate-voiceovers.cjs [--lang=nl|en|ar|all] [--overwrite] [--dry-run]
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

function parseArgs(argv) {
  const opts = { lang: "all", overwrite: false, dryRun: false };
  for (const arg of argv) {
    if (arg.startsWith("--lang=")) opts.lang = arg.slice(7);
    else if (arg === "--overwrite") opts.overwrite = true;
    else if (arg === "--dry-run") opts.dryRun = true;
  }
  return opts;
}

// ---- Provider-adapter ----------------------------------------------------
// Bewust minimaal gehouden: dit project sluit NIET automatisch een betaalde
// provider aan. Zodra we samen een provider kiezen, vult iemand hier de fetch-
// aanroep in (voorbeelden staan in commentaar). Het contract is simpel:
//   async function synthesize(text, lang, voiceId) -> Buffer (mp3-bytes)
const PROVIDERS = {
  // Voorbeeld — NIET actief totdat TTS_PROVIDER=openai en een geldige key gezet zijn:
  // async openai(text, lang, voiceId) {
  //   const res = await fetch("https://api.openai.com/v1/audio/speech", {
  //     method: "POST",
  //     headers: { Authorization: `Bearer ${process.env.TTS_API_KEY}`, "Content-Type": "application/json" },
  //     body: JSON.stringify({ model: "tts-1", voice: voiceId || "alloy", input: text }),
  //   });
  //   if (!res.ok) throw new Error(`TTS-fout (${res.status}): ${await res.text()}`);
  //   return Buffer.from(await res.arrayBuffer());
  // },
  //
  // Voorbeeld — ElevenLabs:
  // async elevenlabs(text, lang, voiceId) {
  //   const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
  //     method: "POST",
  //     headers: { "xi-api-key": process.env.TTS_API_KEY, "Content-Type": "application/json" },
  //     body: JSON.stringify({ text, model_id: "eleven_multilingual_v2" }),
  //   });
  //   if (!res.ok) throw new Error(`TTS-fout (${res.status}): ${await res.text()}`);
  //   return Buffer.from(await res.arrayBuffer());
  // },
};

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const langs = opts.lang === "all" ? LANGS : [opts.lang];
  for (const l of langs) {
    if (!LANGS.includes(l)) { console.error(`Onbekende taal: ${l} (verwacht nl, en, ar of all)`); process.exit(1); }
  }

  const provider = process.env.TTS_PROVIDER;
  const apiKey = process.env.TTS_API_KEY;
  const synth = provider && PROVIDERS[provider];
  const canGenerate = !opts.dryRun && synth && apiKey;

  if (!canGenerate) {
    console.log("── Rapport-modus ──────────────────────────────────────────");
    if (opts.dryRun) console.log("(--dry-run: er wordt niets aangeroepen)");
    else if (!provider) console.log("Geen TTS_PROVIDER ingesteld — er wordt niets gegenereerd, alleen geteld.");
    else if (!PROVIDERS[provider]) console.log(`Provider "${provider}" is nog niet aangesloten in scripts/generate-voiceovers.cjs (zie PROVIDERS-blok).`);
    else if (!apiKey) console.log("Geen TTS_API_KEY ingesteld — er wordt niets gegenereerd, alleen geteld.");
    console.log("");
  }

  let created = 0, skipped = 0, missing = 0, errors = 0;
  const needsReviewCount = { nl: 0, en: 0, ar: 0 };
  const missingText = { nl: 0, en: 0, ar: 0 };

  for (const lang of langs) {
    const dir = path.join(OUT_DIR, lang);
    fs.mkdirSync(dir, { recursive: true });
    console.log(`\n== ${lang.toUpperCase()} ==`);
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

      if (!canGenerate) { missing++; continue; }

      try {
        const audio = PROVIDERS[provider](text, lang, process.env[`TTS_VOICE_${lang.toUpperCase()}`]);
        Promise.resolve(audio).then((buf) => {
          fs.writeFileSync(file, buf);
          console.log(`  ✓ ${id}.mp3`);
        });
        created++;
      } catch (err) {
        errors++;
        console.error(`  ✗ ${id}: ${err.message}`);
      }
    }
  }

  console.log("\n── Samenvatting ───────────────────────────────────────────");
  console.log(`Aangemaakt: ${created}   Overgeslagen (bestond al): ${skipped}   Ontbrekend (geen provider): ${missing}   Errors: ${errors}`);
  for (const lang of langs) {
    if (missingText[lang]) console.log(`Let op: ${missingText[lang]} instructie(s) hebben nog geen ${lang}-tekst in voice-manifest.js.`);
  }
  if (langs.includes("ar")) {
    console.log(`\nArabische instructieteksten (${needsReviewCount.ar} stuks) staan gemarkeerd als needsReview: true —`);
    console.log("laat deze vóór productie controleren door een Arabisch moedertaalspreker (uitspraak/harakat/toon).");
  }
  if (!canGenerate) {
    console.log("\nOm echte audio te genereren:");
    console.log("  1. Kies samen met de projecteigenaar een TTS-provider (nog niet gekozen).");
    console.log("  2. Vul die provider in bij PROVIDERS in dit script.");
    console.log("  3. Zet TTS_PROVIDER en TTS_API_KEY als environment variables (nooit committen).");
    console.log(`  4. Draai opnieuw: node scripts/generate-voiceovers.cjs --lang=${opts.lang}`);
  }
}

main();
