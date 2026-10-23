// Schoolaccount voor leerlingen: inloggen met gebruikersnaam + wachtwoord en voortgang bewaren op de server.
// De app blijft ook zonder account werken (lokale profielen). Met account volgt de voortgang het kind naar elk toestel.
//
// Voortgang = alle localStorage-sleutels "gp_<naam>_<profiel-id>" van het profiel; die gaan als één blok naar de server.
(() => {
  "use strict";
  const onDomain = location.hostname.endsWith("alifbakids.nl");
  const API = onDomain ? "https://api.alifbakids.nl" : "https://alif-ba-api.alif-ba-api.workers.dev";
  const ACCT = "gp_account";
  const DIRTY = "gp_account_dirty";
  const PUSH_DELAY = 6000;

  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { rawSet(k, JSON.stringify(v)); } catch { /* vol of geblokkeerd */ } },
    del(k) { try { localStorage.removeItem(k); } catch { /* */ } },
  };
  const rawSet = localStorage.setItem.bind(localStorage);

  const T = {
    nl: { hint: "Gebruik het kaartje van je juf of meester.", cancel: "Terug", login: "Inloggen met schoolaccount", user: "Gebruikersnaam", pass: "Wachtwoord", go: "Inloggen", logout: "Uitloggen", bad: "Gebruikersnaam of wachtwoord klopt niet.", teacher: "Dit is een account voor docenten. Gebruik de beheerpagina.", net: "Geen verbinding. Probeer het later opnieuw.", cookie: "Inloggen lukte, maar deze browser bewaart het niet. Probeer een andere browser.", confirm: "Uitloggen? De voortgang staat op de server en is er weer als je opnieuw inlogt.", expired: "Je bent uitgelogd. Log opnieuw in om je voortgang te bewaren.", wait: "Even geduld..." },
    en: { hint: "Use the card from your teacher.", cancel: "Back", login: "Log in with school account", user: "Username", pass: "Password", go: "Log in", logout: "Log out", bad: "Username or password is wrong.", teacher: "This is a teacher account. Use the admin page.", net: "No connection. Try again later.", cookie: "Login worked, but this browser does not keep it. Try another browser.", confirm: "Log out? Your progress is saved on the server and returns when you log in again.", expired: "You were logged out. Log in again to save your progress.", wait: "One moment..." },
    ar: { hint: "استخدم البطاقة التي أعطاك إياها معلّمك.", cancel: "رجوع", login: "تسجيل الدخول بحساب المدرسة", user: "اسم المستخدم", pass: "كلمة المرور", go: "دخول", logout: "تسجيل الخروج", bad: "اسم المستخدم أو كلمة المرور غير صحيحة.", teacher: "هذا حساب معلّم. استخدم صفحة الإدارة.", net: "لا يوجد اتصال. حاول لاحقًا.", cookie: "تم الدخول لكن هذا المتصفح لا يحفظه. جرّب متصفحًا آخر.", confirm: "تسجيل الخروج؟ تقدّمك محفوظ على الخادم وسيعود عند الدخول مجددًا.", expired: "تم تسجيل خروجك. ادخل مجددًا لحفظ تقدّمك.", wait: "لحظة..." },
    tr: { hint: "Öğretmeninin verdiği kartı kullan.", cancel: "Geri", login: "Okul hesabıyla giriş", user: "Kullanıcı adı", pass: "Şifre", go: "Giriş", logout: "Çıkış", bad: "Kullanıcı adı veya şifre yanlış.", teacher: "Bu bir öğretmen hesabı. Yönetim sayfasını kullan.", net: "Bağlantı yok. Daha sonra tekrar dene.", cookie: "Giriş yapıldı ama bu tarayıcı saklamıyor. Başka bir tarayıcı dene.", confirm: "Çıkış yapılsın mı? İlerlemen sunucuda kayıtlı, tekrar girince geri gelir.", expired: "Çıkış yapıldı. İlerlemeni kaydetmek için tekrar giriş yap.", wait: "Bir saniye..." },
  };
  const t = () => T[store.get("lang", "nl")] || T.nl;

  async function api(method, path, body) {
    let res;
    try {
      res = await fetch(API + path, {
        method, credentials: "include", keepalive: method === "PUT",
        headers: body !== undefined ? { "content-type": "application/json" } : {},
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch { const e = new Error(t().net); e.code = "net"; throw e; }
    let data = null; try { data = await res.json(); } catch { /* leeg */ }
    if (!res.ok) { const e = new Error((data && data.error) || t().net); e.status = res.status; throw e; }
    return data;
  }

  const account = () => store.get(ACCT, null);
  const keyOf = (name, pid) => `${name}_${pid}`;

  // Alle voortgangssleutels van dit profiel → { "gp_state": {...}, ... }
  function collect(pid) {
    const out = {}, suffix = `_${pid}`;
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith("gp_") && k.endsWith(suffix) && k !== ACCT) {
        try { out[k.slice(0, -suffix.length)] = JSON.parse(localStorage.getItem(k)); } catch { /* sla kapotte waarde over */ }
      }
    }
    return out;
  }
  function apply(pid, blob) {
    Object.keys(blob || {}).forEach((name) => { if (/^gp_[a-z_]+$/.test(name)) store.set(keyOf(name, pid), blob[name]); });
  }

  let timer = null, pushing = false;
  const markDirty = () => store.set(DIRTY, true);
  async function push() {
    const a = account(); clearTimeout(timer); timer = null;
    if (!a || pushing || !navigator.onLine) return;
    pushing = true;
    try { await api("PUT", "/progress", { data: { v: 1, keys: collect(a.pid) } }); store.del(DIRTY); }
    catch (e) { if (e.status === 401) store.set(ACCT, { ...a, expired: true }); }
    finally { pushing = false; }
  }
  const schedule = () => { markDirty(); if (!timer) timer = setTimeout(push, PUSH_DELAY); };

  // Elke schrijfactie naar de voortgang van het ingelogde profiel zet een (vertraagde) upload klaar.
  localStorage.setItem = function (k, v) {
    rawSet(k, v);
    const a = account();
    if (a && typeof k === "string" && k.startsWith("gp_") && k.endsWith(`_${a.pid}`)) schedule();
  };
  document.addEventListener("visibilitychange", () => { if (document.hidden && store.get(DIRTY, false)) push(); });
  window.addEventListener("pagehide", () => { if (store.get(DIRTY, false)) push(); });
  window.addEventListener("online", () => { if (store.get(DIRTY, false)) push(); });

  async function pull(pid) {
    const r = await api("GET", "/progress");
    if (r && r.data && r.data.keys && !store.get(DIRTY, false)) apply(pid, r.data.keys); // eigen niet-geüploade wijzigingen gaan voor
  }

  function ensureProfile(me) {
    const list = store.get("gp_profiles", []);
    if (!list.some((p) => p.id === me.id)) list.push({ id: me.id, name: me.display_name, avatar: "🧒", createdAt: Date.now(), account: true });
    store.set("gp_profiles", list);
    store.set("gp_active", me.id);
  }

  async function login(username, password) {
    await api("POST", "/auth/login", { username: String(username).trim(), password: String(password) }).catch((e) => {
      if (e.status === 401 || e.status === 400 || e.status === 429) e.message = e.status === 401 ? t().bad : e.message;
      throw e;
    });
    let me;
    try { me = (await api("GET", "/me")).user; } catch { throw new Error(t().cookie); }
    if (me.role !== "student") { await api("POST", "/auth/logout", {}).catch(() => {}); throw new Error(t().teacher); }
    store.set(ACCT, { pid: me.id, username: me.username, name: me.display_name });
    ensureProfile(me);
    await pull(me.id).catch(() => {});
    return me;
  }

  async function logout() {
    const a = account();
    if (a) { await push().catch(() => {}); }
    await api("POST", "/auth/logout", {}).catch(() => {});
    if (a) {
      const suffix = `_${a.pid}`, gone = [];
      for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith("gp_") && k.endsWith(suffix)) gone.push(k); }
      gone.forEach((k) => store.del(k));
      store.set("gp_profiles", store.get("gp_profiles", []).filter((p) => p.id !== a.pid));
      if (store.get("gp_active", null) === a.pid) store.del("gp_active");
    }
    store.del(ACCT); store.del(DIRTY);
  }

  // Bij het starten: nog ingelogd? Zo niet, onthoud dat zodat het profielscherm dat kan melden.
  async function check() {
    const a = account(); if (!a || !navigator.onLine) return;
    try { const me = (await api("GET", "/me")).user; if (me.id === a.pid && a.expired) store.set(ACCT, { ...a, expired: false }); if (store.get(DIRTY, false)) push(); }
    catch (e) { if (e.status === 401) store.set(ACCT, { ...a, expired: true }); }
  }

  window.Account = { login, logout, check, push, current: account, t, isLoggedIn: () => !!account() };
  check();
})();
