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
  const LANGS = ["nl", "en", "ar", "tr"];

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

  // Arabisch is mannelijk/vrouwelijk ("luister" = اِسْتَمِعْ / اِسْتَمِعِي). Een meisjespersonage hoort de meisjesopname
  // (audio/instructions/ar-f/<id>.mp3, tekst in `arF`); bestaat die niet, dan valt het terug op de jongensopname.
  function isGirlAr() {
    if (currentLang() !== "ar") return false;
    const pid = store.get("gp_active", null);
    return !!pid && (store.get(`gp_avatar_${pid}`, {}) || {}).type === "girl";
  }
  function instrSources(id) {
    const lang = currentLang(), base = `${INSTR_DIR}${lang}/${id}.mp3`;
    return isGirlAr() ? [`${INSTR_DIR}ar-f/${id}.mp3`, base] : [base];
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
      let attempt = 0;
      const finish = (ok) => {
        loading = false; playing = false;
        if (activeResolve === resolve) activeResolve = null;
        resolve(ok);
      };
      const tryNext = () => {
        const src = remaining.shift();
        if (!src) { lastError = "not-found"; finish(false); return; }
        const mine = ++attempt;
        player.onerror = () => {
          if (mine !== attempt) return;
          if (DEV) console.warn("[audio] ontbreekt (nog geen opname?):", src);
          tryNext();
        };
        player.onended = () => { if (mine === attempt) finish(true); };
        player.src = src;
        playing = true;
        const p = player.play();
        if (p && p.catch) {
          p.then(() => { loading = false; }).catch((err) => {
            // Een bestand dat ontbreekt/niet laadt: onerror probeert al de volgende bron, dus hier niet al "klaar" melden
            // (anders gaat de aanroeper door terwijl het volgende bestand nog speelt en wordt dat afgekapt).
            if (mine !== attempt) return;
            if (err && err.name === "NotSupportedError" && remaining.length) return;
            // Browser blokkeert autoplay (nog geen gebruikersinteractie), of er is geen bron meer.
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
      return playNow(instrSources(id));
    },

    // Eenmalige uitleg per kind (bv. hoe een spel werkt): speelt alleen de eerste keer en onthoudt dat pas als het
    // fragment volledig is afgespeeld. Geen opname in deze taal (bv. Arabisch) of spraak uit → meteen verder (true).
    // Resolve false = onderbroken.
    playOnce(id) {
      const entry = VOICE.instructions[id];
      if (!settings.voiceOn || !entry || !(isGirlAr() ? (entry.arF || entry.ar) : entry[currentLang()])) return Promise.resolve(true);
      const key = `gp_voice_seen_${store.get("gp_active", "x")}`, seen = store.get(key, []);
      if (seen.includes(id)) return Promise.resolve(true);
      return this.playInstruction(id).then((ok) => { if (ok) store.set(key, [...store.get(key, []), id]); return ok; });
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
    isBusy() { return playing || loading; },

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
        a.src = instrSources(id)[0];
      });
    },
  };

  window.AudioManager = AudioManager;

  // ---- Achtergrond: alles stilzetten zodra de app wegvalt (app gesloten/weggeswiped, tab verborgen, scherm uit) ----
  // Anders blijft een uitspraak of jingle doorspelen terwijl het kind al weg is.
  const ctxs = [];
  const NativeAC = window.AudioContext || window.webkitAudioContext;
  if (NativeAC) {
    const Wrapped = function (...args) { const c = new NativeAC(...args); ctxs.push(c); return c; };
    Wrapped.prototype = NativeAC.prototype;
    window.AudioContext = Wrapped; if (window.webkitAudioContext) window.webkitAudioContext = Wrapped;
  }
  const silence = () => { AudioManager.stop(); ctxs.forEach((c) => { try { c.suspend(); } catch {} }); };
  const wake = () => ctxs.forEach((c) => { try { c.resume(); } catch {} });
  document.addEventListener("visibilitychange", () => { if (document.hidden) silence(); else wake(); });
  window.addEventListener("pagehide", silence);
})();
