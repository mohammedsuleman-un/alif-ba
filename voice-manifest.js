// Centraal spraak-manifest: stabiele instructie-IDs met hun tekst in de drie
// bedieningstalen (NL/EN/AR). Dit bestand is de ENIGE bron voor:
//   - de AudioManager in de browser (audio-manager.js), die er de audiopaden
//     uit afleidt: audio/instructions/<taal>/<id>.mp3
//   - het genereer-script scripts/generate-voiceovers.cjs (Node), dat leest
//     welke teksten nog een audiobestand nodig hebben.
//
// BELANGRIJK: dit gaat alleen over gesproken INSTRUCTIES/feedback van de app-
// bediening, niet over de Arabische leeruitspraak (letters/harakat/woorden).
// Die laatste blijft altijd Arabisch en wordt apart, door een kundige
// Arabischspreker, ingesproken — zie game-data.js (letterAudio).
//
// needsReview: true  → tekst nog laten controleren door een Arabisch moedertaal-
//   spreker vóór definitieve productie (uitspraak/harakat/toon).
// ar: null           → nog geen Arabische tekst beschikbaar; bewust leeg gelaten
//   in plaats van zelf te verzinnen. Vul aan met een native speaker.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.VOICE = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const instructions = {
    "welcome": {
      nl: "Assalamu alaikum! Klaar om Arabisch te leren?",
      en: "Assalamu alaikum! Ready to learn Arabic?",
      ar: "السَّلَامُ عَلَيْكُمْ! هَلْ أَنْتَ مُسْتَعِدٌّ لِتَعَلُّمِ الْعَرَبِيَّةِ؟", needsReview: true,
    },
    "lets-start": {
      nl: "Bismillah! We gaan beginnen.",
      en: "Bismillah! Let's begin.",
      ar: "بِسْمِ اللهِ! هَيَّا نَبْدَأْ.", needsReview: true,
    },
    "listen": {
      nl: "Luister goed.",
      en: "Listen carefully.",
      ar: "اِسْتَمِعْ جَيِّدًا.", needsReview: true,
    },
    "listen-again": {
      nl: "Luister nog een keer.",
      en: "Listen again.",
      ar: "اِسْتَمِعْ مَرَّةً أُخْرَى.", needsReview: true,
    },
    "tap-audio": {
      nl: "Tik op de speaker om te luisteren.",
      en: "Tap the speaker to listen.",
      ar: null, needsReview: true,
    },
    "choose-letter": {
      nl: "Kies de juiste letter.",
      en: "Choose the correct letter.",
      ar: "اِخْتَرِ الْحَرْفَ الصَّحِيحَ.", needsReview: true,
    },
    "which-letter": {
      nl: "Welke letter hoor je?",
      en: "Which letter do you hear?",
      ar: "أَيَّ حَرْفٍ تَسْمَعُ؟", needsReview: true,
    },
    "find-letter": {
      nl: "Kun jij de juiste letter vinden?",
      en: "Can you find the correct letter?",
      ar: "هَلْ تَسْتَطِيعُ أَنْ تَجِدَ الْحَرْفَ الصَّحِيحَ؟", needsReview: true,
    },
    "choose-sound": {
      nl: "Kies het juiste geluid.",
      en: "Choose the correct sound.",
      ar: "اِخْتَرِ الصَّوْتَ الصَّحِيحَ.", needsReview: true,
    },
    "match": {
      nl: "Zoek wat bij elkaar hoort.",
      en: "Match the correct ones.",
      ar: null, needsReview: true,
    },
    "choose-word": {
      nl: "Kies het juiste woord.",
      en: "Choose the correct word.",
      ar: "اِخْتَرِ الْكَلِمَةَ الصَّحِيحَةَ.", needsReview: true,
    },
    "which-word": {
      nl: "Welk woord hoor je?",
      en: "Which word do you hear?",
      ar: "أَيَّ كَلِمَةٍ تَسْمَعُ؟", needsReview: true,
    },
    "build-word": {
      nl: "Maak het woord.",
      en: "Build the word.",
      ar: "كَوِّنِ الْكَلِمَةَ.", needsReview: true,
    },
    "missing-letter": {
      nl: "Welke letter ontbreekt?",
      en: "Which letter is missing?",
      ar: "أَيُّ حَرْفٍ نَاقِصٌ؟", needsReview: true,
    },
    "your-turn": {
      nl: "Nu jij!",
      en: "Your turn!",
      ar: "الآنَ دَوْرُكَ!", needsReview: true,
    },
    "correct-01": { nl: "MashaAllah!", en: "MashaAllah!", ar: "مَا شَاءَ اللهُ!", needsReview: true },
    "correct-02": { nl: "Heel goed!", en: "Very good!", ar: "أَحْسَنْتَ!", needsReview: true },
    "correct-03": { nl: "Goed gedaan!", en: "Well done!", ar: "أَحْسَنْتَ صُنْعًا!", needsReview: true },
    "correct-04": { nl: "Dat klopt!", en: "That's correct!", ar: "إِجَابَةٌ صَحِيحَةٌ!", needsReview: true },
    "correct-05": { nl: "Super!", en: "Great job!", ar: "رَائِعٌ!", needsReview: true },
    "correct-06": { nl: "MashaAllah, ga zo door!", en: "MashaAllah, keep going!", ar: "مَا شَاءَ اللهُ، وَاصِلْ!", needsReview: true },
    "retry-01": { nl: "Bijna! Probeer het nog een keer.", en: "Almost! Try again.", ar: "أَوْشَكْتَ! حَاوِلْ مَرَّةً أُخْرَى.", needsReview: true },
    "retry-02": { nl: "Goed geprobeerd! Luister nog eens.", en: "Good try! Listen again.", ar: "مُحَاوَلَةٌ جَيِّدَةٌ! اِسْتَمِعْ مَرَّةً أُخْرَى.", needsReview: true },
    "retry-03": { nl: "Probeer het nog eens.", en: "Try one more time.", ar: "حَاوِلْ مَرَّةً أُخْرَى.", needsReview: true },
    "hint": {
      nl: "Hier is een kleine hint.",
      en: "Here's a little hint.",
      ar: null, needsReview: true,
    },
    "level-start": { nl: "Klaar? Daar gaan we!", en: "Ready? Let's go!", ar: "هَلْ أَنْتَ مُسْتَعِدٌّ؟ هَيَّا بِنَا!", needsReview: true },
    "halfway": {
      nl: "Je bent al op de helft!",
      en: "You're halfway there!",
      ar: null, needsReview: true,
    },
    "last-question": { nl: "Nog één vraag!", en: "One more question!", ar: "سُؤَالٌ وَاحِدٌ فَقَطْ!", needsReview: true },
    "level-complete": { nl: "MashaAllah! Je hebt het level gehaald!", en: "MashaAllah! You completed the level!", ar: "مَا شَاءَ اللهُ! أَكْمَلْتَ الْمُسْتَوَى!", needsReview: true },
    "three-stars": { nl: "MashaAllah! Drie sterren!", en: "MashaAllah! Three stars!", ar: "مَا شَاءَ اللهُ! ثَلَاثُ نُجُومٍ!", needsReview: true },
    "new-level": { nl: "Je hebt een nieuw level vrijgespeeld!", en: "You unlocked a new level!", ar: "لَقَدْ فَتَحْتَ مُسْتَوًى جَدِيدًا!", needsReview: true },
    "new-badge": {
      nl: "Je hebt een nieuwe badge verdiend!",
      en: "You earned a new badge!",
      ar: null, needsReview: true,
    },
    "world-complete": { nl: "MashaAllah! Je hebt deze wereld voltooid!", en: "MashaAllah! You completed this world!", ar: "مَا شَاءَ اللهُ! أَكْمَلْتَ هَذَا الْعَالَمَ!", needsReview: true },
    "continue": { nl: "Klaar voor het volgende level?", en: "Ready for the next level?", ar: "هَلْ أَنْتَ مُسْتَعِدٌّ لِلْمُسْتَوَى التَّالِي؟", needsReview: true },
  };

  return { instructions };
});
