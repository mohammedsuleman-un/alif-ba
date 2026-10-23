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
      tr: "Selamün aleyküm! Arapça öğrenmeye hazır mısın?",
      ar: "السَّلَامُ عَلَيْكُمْ! هَلْ أَنْتَ مُسْتَعِدٌّ لِتَعَلُّمِ الْعَرَبِيَّةِ؟", needsReview: true,
    },
    "lets-start": {
      nl: "Bismillah! We gaan beginnen.",
      en: "Bismillah! Let's begin.",
      tr: "Bismillah! Hadi başlayalım.",
      ar: "بِسْمِ اللهِ! هَيَّا نَبْدَأْ.", needsReview: true,
    },
    "listen": {
      nl: "Luister goed.",
      en: "Listen carefully.",
      tr: "İyi dinle.",
      ar: "اِسْتَمِعْ جَيِّدًا.", needsReview: true,
    },
    "listen-again": {
      nl: "Luister nog een keer.",
      en: "Listen again.",
      tr: "Tekrar dinle.",
      ar: "اِسْتَمِعْ مَرَّةً أُخْرَى.", needsReview: true,
    },
    "tap-audio": {
      nl: "Tik op de speaker om te luisteren.",
      en: "Tap the speaker to listen.",
      tr: "Dinlemek için hoparlöre dokun.",
      ar: null, needsReview: true,
    },
    "choose-letter": {
      nl: "Kies de juiste letter.",
      en: "Choose the correct letter.",
      tr: "Doğru harfi seç.",
      ar: "اِخْتَرِ الْحَرْفَ الصَّحِيحَ.", needsReview: true,
    },
    "which-letter": {
      nl: "Welke letter hoor je?",
      en: "Which letter do you hear?",
      tr: "Hangi harfi duyuyorsun?",
      ar: "أَيَّ حَرْفٍ تَسْمَعُ؟", needsReview: true,
    },
    "find-letter": {
      nl: "Kun jij de juiste letter vinden?",
      en: "Can you find the correct letter?",
      tr: "Doğru harfi bulabilir misin?",
      ar: "هَلْ تَسْتَطِيعُ أَنْ تَجِدَ الْحَرْفَ الصَّحِيحَ؟", needsReview: true,
    },
    "choose-sound": {
      nl: "Kies het juiste geluid.",
      en: "Choose the correct sound.",
      tr: "Doğru sesi seç.",
      ar: "اِخْتَرِ الصَّوْتَ الصَّحِيحَ.", needsReview: true,
    },
    "match": {
      nl: "Zoek wat bij elkaar hoort.",
      en: "Match the correct ones.",
      tr: "Birbirine uyanları eşleştir.",
      ar: null, needsReview: true,
    },
    "choose-word": {
      nl: "Kies het juiste woord.",
      en: "Choose the correct word.",
      tr: "Doğru kelimeyi seç.",
      ar: "اِخْتَرِ الْكَلِمَةَ الصَّحِيحَةَ.", needsReview: true,
    },
    "which-word": {
      nl: "Welk woord hoor je?",
      en: "Which word do you hear?",
      tr: "Hangi kelimeyi duyuyorsun?",
      ar: "أَيَّ كَلِمَةٍ تَسْمَعُ؟", needsReview: true,
    },
    "build-word": {
      nl: "Maak het woord.",
      en: "Build the word.",
      tr: "Kelimeyi oluştur.",
      ar: "كَوِّنِ الْكَلِمَةَ.", needsReview: true,
    },
    "missing-letter": {
      nl: "Welke letter ontbreekt?",
      en: "Which letter is missing?",
      tr: "Hangi harf eksik?",
      ar: "أَيُّ حَرْفٍ نَاقِصٌ؟", needsReview: true,
    },
    "your-turn": {
      nl: "Nu jij!",
      en: "Your turn!",
      tr: "Sıra sende!",
      ar: "الآنَ دَوْرُكَ!", needsReview: true,
    },
    "correct-01": { nl: "MashaAllah!", en: "MashaAllah!", tr: "MaşaAllah!", ar: "مَا شَاءَ اللهُ!", needsReview: true },
    "correct-02": { nl: "Heel goed!", en: "Very good!", tr: "Çok iyi!", ar: "أَحْسَنْتَ!", needsReview: true },
    "correct-03": { nl: "Goed gedaan!", en: "Well done!", tr: "Aferin sana!", ar: "أَحْسَنْتَ صُنْعًا!", needsReview: true },
    "correct-04": { nl: "Dat klopt!", en: "That's correct!", tr: "Bu doğru!", ar: "إِجَابَةٌ صَحِيحَةٌ!", needsReview: true },
    "correct-05": { nl: "Super!", en: "Great job!", tr: "Harika iş!", ar: "رَائِعٌ!", needsReview: true },
    "correct-06": { nl: "MashaAllah, ga zo door!", en: "MashaAllah, keep going!", tr: "MaşaAllah, böyle devam et!", ar: "مَا شَاءَ اللهُ، وَاصِلْ!", needsReview: true },
    "retry-01": { nl: "Bijna! Probeer het nog een keer.", en: "Almost! Try again.", tr: "Neredeyse! Tekrar dene.", ar: "أَوْشَكْتَ! حَاوِلْ مَرَّةً أُخْرَى.", needsReview: true },
    "retry-02": { nl: "Goed geprobeerd! Luister nog eens.", en: "Good try! Listen again.", tr: "Güzel denemeydi! Tekrar dinle.", ar: "مُحَاوَلَةٌ جَيِّدَةٌ! اِسْتَمِعْ مَرَّةً أُخْرَى.", needsReview: true },
    "retry-03": { nl: "Probeer het nog eens.", en: "Try one more time.", tr: "Bir kez daha dene.", ar: "حَاوِلْ مَرَّةً أُخْرَى.", needsReview: true },
    "hint": {
      nl: "Hier is een kleine hint.",
      en: "Here's a little hint.",
      tr: "İşte küçük bir ipucu.",
      ar: null, needsReview: true,
    },
    "level-start": { nl: "Klaar? Daar gaan we!", en: "Ready? Let's go!", tr: "Hazır mısın? Hadi başlayalım!", ar: "هَلْ أَنْتَ مُسْتَعِدٌّ؟ هَيَّا بِنَا!", needsReview: true },
    "halfway": {
      nl: "Je bent al op de helft!",
      en: "You're halfway there!",
      tr: "Yarı yoldasın!",
      ar: null, needsReview: true,
    },
    "last-question": { nl: "Nog één vraag!", en: "One more question!", tr: "Son bir soru!", ar: "سُؤَالٌ وَاحِدٌ فَقَطْ!", needsReview: true },
    "level-complete": { nl: "MashaAllah! Je hebt het level gehaald!", en: "MashaAllah! You completed the level!", tr: "MaşaAllah! Seviyeyi tamamladın!", ar: "مَا شَاءَ اللهُ! أَكْمَلْتَ الْمُسْتَوَى!", needsReview: true },
    "three-stars": { nl: "MashaAllah! Drie sterren!", en: "MashaAllah! Three stars!", tr: "MaşaAllah! Üç yıldız!", ar: "مَا شَاءَ اللهُ! ثَلَاثُ نُجُومٍ!", needsReview: true },
    "new-level": { nl: "Je hebt een nieuw level vrijgespeeld!", en: "You unlocked a new level!", tr: "Yeni bir seviyenin kilidini açtın!", ar: "لَقَدْ فَتَحْتَ مُسْتَوًى جَدِيدًا!", needsReview: true },
    "new-badge": {
      nl: "Je hebt een nieuwe badge verdiend!",
      en: "You earned a new badge!",
      tr: "Yeni bir rozet kazandın!",
      ar: null, needsReview: true,
    },
    "world-complete": { nl: "MashaAllah! Je hebt deze wereld voltooid!", en: "MashaAllah! You completed this world!", tr: "MaşaAllah! Bu dünyayı tamamladın!", ar: "مَا شَاءَ اللهُ! أَكْمَلْتَ هَذَا الْعَالَمَ!", needsReview: true },
    "continue": { nl: "Klaar voor het volgende level?", en: "Ready for the next level?", tr: "Sonraki seviyeye hazır mısın?", ar: "هَلْ أَنْتَ مُسْتَعِدٌّ لِلْمُسْتَوَى التَّالِي؟", needsReview: true },
    "map-choose": { nl: "Kies een wereld!", en: "Choose a world!", tr: "Bir dünya seç!", ar: null, needsReview: true },
    "world-1": { nl: "Wereld één: de Arabische letters.", en: "World one: the Arabic letters.", tr: "Dünya bir: Arap harfleri.", ar: null, needsReview: true },
    "world-map-start": { nl: "Tik op jouw niveau om te beginnen.", en: "Tap your level to start.", tr: "Başlamak için seviyene dokun.", ar: null, needsReview: true },
    "level-choose": { nl: "Leer de letters, of speel een spel!", en: "Learn the letters, or play a game!", tr: "Harfleri öğren ya da bir oyun oyna!", ar: null, needsReview: true },
    "slingshot-how": { nl: "Trek de steen naar achteren en laat los. Raak de lantaarn met de goede letter!", en: "Pull the stone back and let go. Hit the lantern with the right letter!", tr: "Taşı geri çek ve bırak. Doğru harfli feneri vur!", ar: null, needsReview: true },
    "photo-how": { nl: "Zoom in en maak een foto van de goede letter.", en: "Zoom in and take a photo of the right letter.", tr: "Yakınlaştır ve doğru harfin fotoğrafını çek.", ar: null, needsReview: true },
    "diver-intro": { nl: "Zwem naar de schelpen en pak de parel met de goede letter. Breng de parels naar de grote schelp.", en: "Swim to the shells and take the pearl with the right letter. Bring the pearls to the big shell.", tr: "Deniz kabuklarına yüz ve doğru harfli incileri al. İncileri büyük kabuğa götür.", ar: null, needsReview: true },
    "diver-hand": { nl: "Zwem naar de grote schelp en geef de parels door.", en: "Swim to the big shell and hand over the pearls.", tr: "Büyük kabuğa yüz ve incileri ver.", ar: null, needsReview: true },
    "diver-chest": { nl: "Je krijgt een sleutel. Open de kist!", en: "You get a key. Open the chest!", tr: "Bir anahtar alıyorsun. Sandığı aç!", ar: null, needsReview: true },
    "bridge-how": { nl: "Maak de rij letters af. Sleep de goede plank naar de lege plek.", en: "Finish the row of letters. Drag the right plank to the empty spot.", tr: "Harf sırasını tamamla. Doğru tahtayı boş yere sürükle.", ar: null, needsReview: true },
    "game-unlocked": { nl: "Geweldig! Je hebt een nieuw spel verdiend!", en: "Great! You earned a new game!", tr: "Harika! Yeni bir oyun kazandın!", ar: null, needsReview: true },
  };

  return { instructions };
});
