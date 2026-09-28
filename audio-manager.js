// Centrale audio-service, gedeeld door boekmodus (app.js) en spelmodus (game.js).
// Twee soorten audio, expliciet gescheiden:
//   - instructie-audio: gesproken bediening (NL/EN/AR), afhankelijk van de
//     gekozen interface-taal — bestanden in audio/instructions/<taal>/<id>.mp3
//   - leeraudio: de Arabische uitspraak zelf (letters/harakat/woorden), blijft
//     ALTIJD Arabisch, ongeacht de gekozen interface-taal.
//
// Voorkomt overlappende audio: een nieuwe aanroep onderbreekt altijd meteen
// wat er nog speelt of nog in een keten stond te wachten (barge-in), in
// plaats van alles keurig na elkaar op te stapelen. Als een kind snel
// doortikt, wordt het vorige fragment dus afgebroken — niet alsnog
// afgespeeld. Ketens als
//   await AudioManager.playInstruction("listen");
//   await AudioManager.playLearningAudio(base);
// werken nog gewoon na elkaar zolang niets ertussen komt; de aanroepende
// code moet wel de teruggegeven boolean checken en stoppen als die false is
// (onderbroken), zodat een oud restje niet alsnog start.
// Ontbrekende bestanden laten de app niet crashen: de speler valt stil, logt
// in development welk bestand ontbreekt, en het kind kan gewoon doorspelen.
(function () {
  "use strict";

  const store = {
    get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  };

  const DEV = ["localhost", "127.0.0.1", ""].includes(location.hostname);
  const VOICE = (window.VOICE && window.VOICE.instructions) ? window.VOICE : { instructions: {} };
  const INSTR_DIR = "audio/instructions/";
  const LANGS = ["nl", "en", "ar"];

  const settings = {
    get voiceOn() { return store.get("voiceInstructionsEnabled", true); },
    set voiceOn(v) { store.set("voiceInstructionsEnabled", !!v); },
    get sfxOn() { return store.get("soundEffectsEnabled", true); },
    set sfxOn(v) { store.set("soundEffectsEnabled", !!v); },
  };

  function currentLang() {
    const l = store.get("lang", "nl");
    return LANGS.includes(l) ? l : "nl";
  }

  // Eén gedeeld <audio>-element: nooit twee dingen tegelijk, en een nieuwe
  // aanroep breekt de vorige meteen af (zie uitleg hierboven).
  const player = new Audio();
  let playing = false;
  let loading = false;
  let lastError = null;
  let activeResolve = null; // resolve() van het fragment dat nu speelt/laadt, zodat stop() het kan afbreken

  function playSources(sources) {
    return new Promise((resolve) => {
      if (!sources || !sources.length) { resolve(false); return; }
      loading = true;
      activeResolve = resolve;
      const remaining = [...sources];
      const finish = (ok) => {
        loading = false; playing = false;
        if (activeResolve === resolve) activeResolve = null;
        resolve(ok);
      };
      const tryNext = () => {
        const src = remaining.shift();
        if (!src) { lastError = "not-found"; finish(false); return; }
        player.onerror = () => {
          if (DEV) console.warn("[audio] ontbreekt (nog geen opname?):", src);
          tryNext();
        };
        player.onended = () => finish(true);
        player.src = src;
        playing = true;
        const p = player.play();
        if (p && p.catch) {
          p.then(() => { loading = false; }).catch(() => {
            // Browser blokkeert autoplay (nog geen gebruikersinteractie), of bestand ontbreekt.
            lastError = "blocked-or-missing";
            finish(false);
          });
        } else {
          loading = false;
        }
      };
      tryNext();
    });
  }

  // Breekt wat nu speelt/laadt meteen af (indien iets) en speelt daarna het nieuwe fragment.
  function playNow(sources) {
    stopInternal();
    return playSources(sources);
  }

  function stopInternal() {
    try { player.pause(); } catch {}
    playing = false; loading = false;
    if (activeResolve) {
      const resolve = activeResolve;
      activeResolve = null;
      resolve(false);
    }
  }

  let lastCorrectId = null;
  let lastRetryId = null;
  const pickOtherThan = (ids, last) => {
    const pool = ids.filter((i) => i !== last);
    return pool[(Math.random() * pool.length) | 0];
  };

  const AudioManager = {
    settings,
    get isPlaying() { return playing; },
    get loading() { return loading; },
    get lastError() { return lastError; },

    // Speelt een gesproken instructie/feedback-fragment in de huidige interfacetaal.
    playInstruction(id) {
      if (!settings.voiceOn) return Promise.resolve(false);
      if (!VOICE.instructions[id]) {
        if (DEV) console.warn("[audio] onbekend instructie-ID in voice-manifest.js:", id);
        return Promise.resolve(false);
      }
      return playNow([`${INSTR_DIR}${currentLang()}/${id}.mp3`]);
    },

    // Speelt de Arabische leeruitspraak. `base` is een pad zonder extensie
    // (bv. "audio/Page1-02"), net als elders in de app — probeert .m4a dan .mp3.
    playLearningAudio(base) {
      if (!base) return Promise.resolve(false);
      return playNow([`${base}.m4a`, `${base}.mp3`]);
    },

    // Willekeurige positieve feedback; vermijdt hetzelfde fragment twee keer op rij.
    playRandomCorrectFeedback() {
      if (!settings.voiceOn) return Promise.resolve(false);
      const id = pickOtherThan(["correct-01", "correct-02", "correct-03", "correct-04", "correct-05", "correct-06"], lastCorrectId);
      lastCorrectId = id;
      return this.playInstruction(id);
    },

    // Willekeurige vriendelijke retry-feedback (nooit een hard foutgeluid).
    playRandomRetryFeedback() {
      if (!settings.voiceOn) return Promise.resolve(false);
      const id = pickOtherThan(["retry-01", "retry-02", "retry-03"], lastRetryId);
      lastRetryId = id;
      return this.playInstruction(id);
    },

    // Breekt het huidige fragment meteen af (bv. omdat het kind al verder is).
    stop() { stopInternal(); },

    // Herhaalt het laatst afgespeelde fragment (instructie of leeraudio).
    replay() {
      if (!player.src) return Promise.resolve(false);
      stopInternal();
      return new Promise((resolve) => {
        activeResolve = resolve;
        try { player.currentTime = 0; } catch {}
        player.onended = () => { if (activeResolve === resolve) activeResolve = null; resolve(true); };
        player.onerror = () => { if (activeResolve === resolve) activeResolve = null; resolve(false); };
        const p = player.play();
        if (p && p.catch) p.catch(() => { if (activeResolve === resolve) activeResolve = null; resolve(false); });
      });
    },

    // Warmt alvast een paar instructiefragmenten voor die zo nodig zijn
    // (bv. bij het starten van een level) — niet de hele bibliotheek.
    preload(ids) {
      (ids || []).forEach((id) => {
        if (!VOICE.instructions[id]) return;
        const a = new Audio();
        a.preload = "auto";
        a.src = `${INSTR_DIR}${currentLang()}/${id}.mp3`;
      });
    },
  };

  window.AudioManager = AudioManager;
})();
