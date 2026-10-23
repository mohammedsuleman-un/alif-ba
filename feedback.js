// Feedbackknop: iedereen die is ingelogd kan snel een defect, idee of vraag doorgeven.
// De app stuurt zelf mee op welk scherm je zat, welk toestel/versie en de laatste foutmeldingen, zodat een melding direct bruikbaar is.
(() => {
  "use strict";
  const onDomain = location.hostname.endsWith("alifbakids.nl");
  const API = onDomain ? "https://api.alifbakids.nl" : "https://alif-ba-api.alif-ba-api.workers.dev";
  const read = (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } };

  const T = {
    nl: { open: "Feedback geven", title: "Wat wil je doorgeven?", defect: "Iets werkt niet", idea: "Idee", question: "Vraag", what: "Wat gaat er mis?",
      quick: ["Een knop doet niets", "Geen geluid of verkeerd geluid", "Het spel loopt vast", "Verkeerde tekst of vertaling", "Ziet er raar uit", "Iets anders"],
      detail: "Vertel er kort bij wat je deed (mag leeg)", detailIdea: "Vertel je idee of vraag", send: "Versturen", cancel: "Annuleren", sending: "Even geduld...",
      thanks: "Bedankt! We hebben je melding ontvangen.", close: "Sluiten", err: "Versturen lukte niet. Probeer het later nog eens.", auto: "We sturen automatisch mee: welk scherm, je toestel en de versie van de app.", need: "Kies wat er mis gaat of vul iets in." },
    en: { open: "Give feedback", title: "What would you like to tell us?", defect: "Something is broken", idea: "Idea", question: "Question", what: "What is going wrong?",
      quick: ["A button does nothing", "No sound or wrong sound", "The game freezes", "Wrong text or translation", "Looks strange", "Something else"],
      detail: "Briefly say what you did (optional)", detailIdea: "Tell us your idea or question", send: "Send", cancel: "Cancel", sending: "One moment...",
      thanks: "Thank you! We received your message.", close: "Close", err: "Sending failed. Please try again later.", auto: "We automatically include: which screen, your device and the app version.", need: "Pick what is wrong or write something." },
    ar: { open: "أرسل ملاحظة", title: "ماذا تريد أن تخبرنا؟", defect: "شيء لا يعمل", idea: "فكرة", question: "سؤال", what: "ما المشكلة؟",
      quick: ["زر لا يفعل شيئًا", "لا صوت أو صوت خاطئ", "اللعبة تتوقف", "نص أو ترجمة خاطئة", "شكله غريب", "شيء آخر"],
      detail: "اكتب باختصار ماذا فعلت (اختياري)", detailIdea: "اكتب فكرتك أو سؤالك", send: "إرسال", cancel: "إلغاء", sending: "لحظة...",
      thanks: "شكرًا! وصلتنا رسالتك.", close: "إغلاق", err: "تعذّر الإرسال. حاول لاحقًا.", auto: "نرسل تلقائيًا: الشاشة والجهاز ونسخة التطبيق.", need: "اختر المشكلة أو اكتب شيئًا." },
    tr: { open: "Geri bildirim", title: "Bize ne söylemek istersin?", defect: "Bir şey çalışmıyor", idea: "Fikir", question: "Soru", what: "Ne yanlış gidiyor?",
      quick: ["Bir düğme çalışmıyor", "Ses yok veya yanlış ses", "Oyun donuyor", "Yanlış metin veya çeviri", "Garip görünüyor", "Başka bir şey"],
      detail: "Ne yaptığını kısaca yaz (isteğe bağlı)", detailIdea: "Fikrini veya sorunu yaz", send: "Gönder", cancel: "İptal", sending: "Bir saniye...",
      thanks: "Teşekkürler! Mesajın bize ulaştı.", close: "Kapat", err: "Gönderilemedi. Daha sonra tekrar dene.", auto: "Otomatik olarak göndeririz: ekran, cihaz ve uygulama sürümü.", need: "Neyin yanlış olduğunu seç veya bir şey yaz." },
  };
  const lang = () => read("lang", "nl");
  const tx = () => { const t = T[lang()] || T.nl; return window.ArF ? window.ArF.deep(t) : t; };
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  // Laatste foutmeldingen bijhouden
  const errors = [];
  const keep = (m) => { errors.push(String(m).slice(0, 200)); if (errors.length > 5) errors.shift(); };
  window.addEventListener("error", (e) => keep(`${e.message} @${String(e.filename || "").split("/").pop()}:${e.lineno || 0}`));
  window.addEventListener("unhandledrejection", (e) => keep("promise: " + (e.reason && (e.reason.message || e.reason))));

  let version = "";
  async function appVersion() {
    if (version) return version;
    try { const m = /VERSION\s*=\s*"([^"]+)"/.exec(await (await fetch("sw.js", { cache: "no-store" })).text()); version = m ? m[1] : "?"; } catch { version = "?"; }
    return version;
  }

  const loggedIn = () => !!(window.Account && window.Account.isLoggedIn());
  let btn, modal, kind = "defect", quick = -1;

  function mountButton() {
    if (!btn) {
      btn = document.createElement("button");
      btn.type = "button"; btn.id = "fbBtn"; btn.textContent = "💬";
      btn.onclick = openModal;
      document.body.appendChild(btn);
    }
    btn.hidden = !loggedIn() || !!modal;
    btn.setAttribute("aria-label", tx().open); btn.title = tx().open;
  }

  function openModal() {
    const t = tx();
    kind = "defect"; quick = -1;
    modal = document.createElement("div"); modal.id = "fbModal"; modal.setAttribute("role", "dialog"); modal.setAttribute("aria-modal", "true");
    document.documentElement.dir && (modal.dir = document.documentElement.dir);
    const render = (state, msg) => {
      if (state === "done") { modal.innerHTML = `<div class="fb-card"><div class="fb-done">✅</div><p>${esc(t.thanks)}</p><button type="button" class="fb-send" data-x="close">${esc(t.close)}</button></div>`; return; }
      modal.innerHTML = `<form class="fb-card"><h3>${esc(t.title)}</h3>
        <div class="fb-kinds">${["defect", "idea", "question"].map((k) => `<button type="button" class="fb-chip ${k === kind ? "sel" : ""}" data-kind="${k}">${k === "defect" ? "🐞 " : k === "idea" ? "💡 " : "❓ "}${esc(t[k])}</button>`).join("")}</div>
        ${kind === "defect" ? `<p class="fb-label">${esc(t.what)}</p><div class="fb-quick">${t.quick.map((q, i) => `<button type="button" class="fb-chip ${i === quick ? "sel" : ""}" data-quick="${i}">${esc(q)}</button>`).join("")}</div>` : ""}
        <textarea id="fbText" maxlength="1500" rows="3" placeholder="${esc(kind === "defect" ? t.detail : t.detailIdea)}"></textarea>
        <small class="fb-auto">${esc(t.auto)}</small>
        ${msg ? `<div class="fb-msg">${esc(msg)}</div>` : ""}
        <div class="fb-actions"><button type="button" class="fb-cancel" data-x="close">${esc(t.cancel)}</button><button type="submit" class="fb-send" ${state === "sending" ? "disabled" : ""}>${esc(state === "sending" ? t.sending : t.send)}</button></div></form>`;
    };
    render("form");
    modal.addEventListener("click", async (e) => {
      if (e.target === modal || e.target.closest("[data-x=close]")) return closeModal();
      const k = e.target.closest("[data-kind]"); if (k) { const keepText = (modal.querySelector("#fbText") || {}).value || ""; kind = k.dataset.kind; quick = -1; render("form"); modal.querySelector("#fbText").value = keepText; return; }
      const q = e.target.closest("[data-quick]"); if (q) { quick = +q.dataset.quick; modal.querySelectorAll("[data-quick]").forEach((b) => b.classList.toggle("sel", +b.dataset.quick === quick)); }
    });
    modal.addEventListener("submit", async (e) => {
      e.preventDefault();
      const detail = modal.querySelector("#fbText").value.trim();
      const prefix = kind === "defect" && quick >= 0 ? t.quick[quick] : "";
      const message = [prefix, detail].filter(Boolean).join(": ");
      if (!message) return render("form", t.need);
      const keepText = detail; render("sending"); modal.querySelector("#fbText").value = keepText;
      try {
        const a = window.Account && window.Account.current();
        const res = await fetch(API + "/feedback", {
          method: "POST", credentials: "include", headers: { "content-type": "application/json" },
          body: JSON.stringify({ kind, message, context: {
            screen: location.hash || "#/", lang: lang(), version: await appVersion(), viewport: `${innerWidth}x${innerHeight}@${window.devicePixelRatio || 1}`,
            device: navigator.userAgent.slice(0, 200), online: navigator.onLine, mode: a && a.preview ? "docent-voorbeeld" : "leerling", user: a ? a.username : "", errors: errors.slice(),
          } }),
        });
        if (!res.ok) { let d = null; try { d = await res.json(); } catch { /* */ } throw new Error((d && d.error) || t.err); }
        render("done");
      } catch (err) { render("form", err.message || t.err); modal.querySelector("#fbText").value = keepText; }
    });
    document.body.appendChild(modal);
    mountButton();
    const ta = modal.querySelector("#fbText"); if (ta) ta.focus({ preventScroll: true });
  }
  function closeModal() { if (modal) { modal.remove(); modal = null; } mountButton(); }

  window.addEventListener("hashchange", mountButton);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && modal) closeModal(); });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mountButton); else mountButton();
  setInterval(mountButton, 2000); // na inloggen/uitloggen verschijnt of verdwijnt de knop vanzelf
})();
