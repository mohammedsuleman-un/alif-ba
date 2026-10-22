// Gedeelde kern van de letter-minigames: opslag, interfacetaal en pogingen-registratie.
// Puur data/logica, geen DOM/Phaser. (Voorheen onderdeel van Letter Chase; de opslagsleutel
// `gp_chase_<profiel>` blijft hetzelfde zodat bestaande voortgang behouden blijft.)
(() => {
  "use strict";

  const store = {
    get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  };

  function lang() { const l = store.get("lang", "nl"); return ["nl", "en", "ar", "tr"].includes(l) ? l : "nl"; }
  function dir() { return lang() === "ar" ? "rtl" : "ltr"; }

  // Terug naar de Letter Oase-kaart (de keuze-pagina van de minigames).
  const RETURN_HASH = "#/spel/wereld/letter_oasis";

  const attemptsKey = (pid) => `gp_chase_${pid}`;
  function loadAttempts(pid) {
    return store.get(attemptsKey(pid), { attempts: [], aggregate: { attempts: 0, correct: 0, confusions: {} } });
  }
  // entry: { game, target, selectedLetter, correct, helped, mission, responseTimeMs, timestamp, ... }
  // Alleen lokaal opgeslagen (geen externe analytics); verwarringen ("ب->ت") worden geteld.
  function recordAttempt(pid, entry) {
    if (!pid) return;
    const data = loadAttempts(pid);
    data.attempts.push(entry);
    data.aggregate.attempts++;
    if (entry.correct) {
      data.aggregate.correct++;
    } else {
      const key = `${entry.target}->${entry.selectedLetter}`;
      data.aggregate.confusions[key] = (data.aggregate.confusions[key] || 0) + 1;
    }
    store.set(attemptsKey(pid), data);
  }

  window.MiniCore = { store, lang, dir, RETURN_HASH, loadAttempts, recordAttempt };
})();
