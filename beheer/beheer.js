// Alif Ba beheer: inloggen en beheren van organisaties, docenten, klassen en leerlingen. In vier talen (NL, EN, AR, TR).
// Alle tekst uit de server gaat door esc() voordat hij in de pagina komt. Wachtwoorden bestaan alleen in het geheugen.
(() => {
  "use strict";
  const $app = document.getElementById("app");
  const onDomain = location.hostname.endsWith("alifbakids.nl");
  const API = onDomain ? "https://api.alifbakids.nl" : "https://alif-ba-api.alif-ba-api.workers.dev";
  const APP_URL = onDomain ? "https://app.alifbakids.nl" : "https://mohammedsuleman-un.github.io/alif-ba/";
  const MAX_BULK = 40;
  const WORLD1_LEVELS = 9, MINI_LEVELS = 8; // aantal niveaus in Wereld 1 en in de spelletjesroute
  const ROLE_NL = { superadmin: "Hoofdbeheerder", org_admin: "Beheerder", teacher: "Docent", student: "Leerling" };

  // ---------- taal: NL, EN, AR, TR (zelfde keuze als in het spel) ----------
  const LANGS = ["nl", "en", "ar", "tr"];
  const LOCALE = { nl: "nl-NL", en: "en-GB", ar: "ar-u-nu-latn", tr: "tr-TR" }; // Arabisch met westerse cijfers, net als in het spel
  const DICT = window.BEHEER_I18N || {};
  let LANG = "nl";
  try { const v = JSON.parse(localStorage.getItem("lang")); if (LANGS.includes(v)) LANG = v; } catch { /* standaard Nederlands */ }
  // Sleutel = de Nederlandse tekst; {naam} wordt ingevuld. Ontbreekt een vertaling, dan blijft het Nederlands.
  const t = (k, v) => {
    let x = (LANG !== "nl" && DICT[LANG] && DICT[LANG][k]) || k;
    if (v) x = x.replace(/\{(\w+)\}/g, (m, n) => (v[n] !== undefined ? v[n] : m));
    return x;
  };
  const roleName = (r) => t(ROLE_NL[r] || r);
  function applyLang() {
    document.documentElement.lang = LANG; document.documentElement.dir = LANG === "ar" ? "rtl" : "ltr";
    document.title = t("Alif Ba beheer");
  }

  const S = { search: "", limit: 100, imp: null, impRun: null, impResult: null, menu: false, addClass: "", feedback: [], fbOpen: false, fbFilter: "new", me: null, myOrgs: [], myOrg: null, shown: {}, tab: "", orgId: "", orgs: [], staff: [], classes: [], students: [], classId: "", progClass: "", progress: [], secret: null, msg: null, busy: false, view: null };

  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const te = (k, v) => esc(t(k, v)); // vertaald en veilig voor in de pagina

  const langPicks = () => `<div class="lang-picks" role="group" aria-label="${te("Taal")}">${LANGS.map((l) => `<button type="button" class="lang-pick ${l === LANG ? "sel" : ""}" data-act="lang" data-l="${l}" ${l === "ar" ? 'lang="ar"' : ""}>${l === "ar" ? "ع" : l.toUpperCase()}</button>`).join("")}</div>`;

  async function api(method, path, body) {
    const res = await fetch(API + path, {
      method, credentials: "include",
      headers: body !== undefined ? { "content-type": "application/json" } : {},
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    let data = null; try { data = await res.json(); } catch { /* leeg */ }
    if (!res.ok) { const e = new Error(data && data.error ? t(data.error) : t("Er ging iets mis ({n}).", { n: res.status })); e.status = res.status; throw e; }
    return data;
  }

  const isSuper = () => S.me && S.me.role === "superadmin";
  const orgQ = () => (isSuper() ? `?org_id=${encodeURIComponent(S.orgId)}` : "");
  const flash = (text, kind = "ok") => { S.msg = text ? { text, kind } : null; };

  // ---------- gegevens laden ----------
  // Welke leerlingen: "" = alle, "none" = zonder klas, anders een klas-id.
  function scopeQ(classId) {
    if (classId && classId !== "none") return `?class_id=${encodeURIComponent(classId)}`;
    const org = isSuper() ? `org_id=${encodeURIComponent(S.orgId)}` : "";
    return classId === "none" ? `?class_id=none${org ? "&" + org : ""}` : (org ? "?" + org : "");
  }
  async function loadOrgs() { S.orgs = (await api("GET", "/orgs")).orgs; }
  async function loadStaff() { S.staff = isSuper() && !S.orgId ? [] : (await api("GET", "/users" + orgQ())).users; }
  async function loadClasses() {
    S.classes = isSuper() && !S.orgId ? [] : (await api("GET", "/classes" + orgQ())).classes;
    if (S.classId !== "" && S.classId !== "none" && !S.classes.some((c) => c.id === S.classId)) S.classId = "";
    if (S.addClass && !S.classes.some((c) => c.id === S.addClass)) S.addClass = "";
  }
  async function loadStudents() {
    if (isSuper() && !S.orgId) { S.students = []; return; }
    S.students = (await api("GET", "/students" + scopeQ(S.classId))).students;
  }
  async function loadProgress() {
    if (isSuper() && !S.orgId) { S.progress = []; return; }
    S.progress = (await api("GET", "/students/progress" + scopeQ(S.progClass))).students;
  }
  async function loadFeedback() { S.feedback = (await api("GET", "/feedback" + (S.fbFilter ? `?status=${S.fbFilter}` : "") + (isSuper() && S.orgId ? `${S.fbFilter ? "&" : "?"}org_id=${encodeURIComponent(S.orgId)}` : ""))).items; }
  async function loadFor(tab) {
    if (tab === "feedback") return loadFeedback();
    if (tab === "progress") { await loadClasses(); if (S.progClass && S.progClass !== "none" && !S.classes.some((c) => c.id === S.progClass)) S.progClass = ""; return loadProgress(); }
    if (tab === "orgs") return loadOrgs();
    if (tab === "staff") return Promise.all([loadStaff(), loadClasses()]);
    if (tab === "classes") return Promise.all([loadClasses(), S.me.role === "teacher" ? Promise.resolve() : loadStaff()]);
    if (tab === "students") { await loadClasses(); return loadStudents(); }
  }

  // Tabbladen: [sleutel, Nederlandse tekst]; de tekst wordt bij het tonen vertaald.
  function tabsFor() {
    const r = S.me.role, tb = [];
    if (r === "superadmin") { tb.push(["orgs", "Organisaties"]); if (S.orgId) tb.push(["progress", "Voortgang"], ["staff", "Beheerders en docenten"], ["classes", "Klassen"], ["students", "Leerlingen"]); tb.push(["feedback", "Feedback"]); }
    else if (r === "org_admin") tb.push(["progress", "Voortgang"], ["staff", "Docenten"], ["classes", "Klassen"], ["students", "Leerlingen"], ["feedback", "Feedback"]);
    else tb.push(["progress", "Voortgang"], ["classes", "Klassen"], ["students", "Leerlingen"]);
    return tb;
  }

  async function go(tab) {
    S.tab = tab; S.shown = {}; flash(null);
    try { await loadFor(tab); } catch (e) { flash(e.message, "err"); }
    render();
  }

  // ---------- schermen ----------
  function viewLogin(err) {
    S.view = { k: "login", err };
    document.body.classList.add("auth");
    $app.innerHTML = `<div class="login"><img class="logo" src="../icons/icon-192.png" alt=""><h1>${te("Alif Ba beheer")}</h1><p class="muted">${te("Voor beheerders en docenten.")}</p>
      <form class="card" data-form="login">
        <label for="u">${te("E-mailadres")}</label><input id="u" name="username" autocomplete="username" required>
        <label for="p">${te("Wachtwoord")}</label><input id="p" name="password" type="password" autocomplete="current-password" required>
        ${err ? `<div class="msg err">${esc(err)}</div>` : ""}
        <p><button type="submit">${te("Inloggen")}</button></p>
      </form>${langPicks()}</div>`;
  }

  function viewChangePassword(forced, err) {
    S.view = { k: "pw", forced, err };
    document.body.classList.add("auth");
    $app.innerHTML = `<div class="login"><img class="logo" src="../icons/icon-192.png" alt=""><h1>${forced ? te("Kies een eigen wachtwoord") : te("Wachtwoord wijzigen")}</h1>
      ${forced ? `<p class="muted">${te("Je hebt een startwachtwoord gekregen. Kies nu een eigen wachtwoord (minstens 10 tekens).")}</p>` : ""}
      <form class="card" data-form="password">
        <label for="c">${te("Huidig wachtwoord")}</label><input id="c" name="current" type="password" autocomplete="current-password" required>
        <label for="n">${te("Nieuw wachtwoord (minstens 10 tekens)")}</label><input id="n" name="next" type="password" autocomplete="new-password" minlength="10" required>
        ${err ? `<div class="msg err">${esc(err)}</div>` : ""}
        <p><button type="submit">${te("Opslaan")}</button> ${forced ? "" : `<button type="button" class="ghost" data-act="back">${te("Annuleren")}</button>`}</p>
      </form>${langPicks()}</div>`;
  }

  const classOptions = () => S.classes.map((c) => `<option value="${esc(c.id)}" ${c.id === S.classId ? "selected" : ""}>${esc(c.name)}</option>`).join("");

  function panelOrgs() {
    const rows = S.orgs.map((o) => `<tr><td>${esc(o.name)}</td><td class="mono">${esc(o.code)}</td><td>${Number(o.active) ? `<span class="tag">${te("actief")}</span>` : `<span class="tag off">${te("uit")}</span>`}</td>
      <td class="actions"><button class="small" data-act="openorg" data-id="${esc(o.id)}" data-name="${esc(o.name)}">${te("Openen")}</button></td></tr>`).join("");
    return `<div class="card"><h2>${te("Organisaties")}</h2>
      <table><tr><th>${te("Naam")}</th><th>${te("Code")}</th><th>${te("Status")}</th><th></th></tr>${rows || `<tr><td colspan="4" class="muted">${te("Nog geen organisaties.")}</td></tr>`}</table></div>
      <form class="card" data-form="org"><h2>${te("Nieuwe organisatie")}</h2><div class="row">
        <div><label>${te("Naam")}</label><input name="name" required maxlength="120"></div>
        <div><label>${te("Korte code (a-z, 0-9, streepje)")}</label><input name="code" required pattern="[a-z0-9][a-z0-9-]{2,39}" maxlength="40"></div>
        <button type="submit">${te("Aanmaken")}</button></div></form>`;
  }

  // Status van een docent/beheerder: uitgezet, uitgenodigd (nog nooit ingelogd), wachtwoord nog te kiezen, of actief.
  function staffStatus(u) {
    if (u.disabled) return { key: "off", text: "Uitgezet", cls: "off" };
    if (!u.last_login_at) return { key: "invited", text: "Uitgenodigd, nog niet ingelogd", cls: "warn" };
    if (u.must_change_password) return { key: "pw", text: "Moet nog een eigen wachtwoord kiezen", cls: "warn" };
    return { key: "active", text: "Actief", cls: "ok" };
  }
  const MAIL_TXT = { sent: "Mail verstuurd", failed: "Mail mislukt", none: "Geen mail verstuurd" };
  function dateNl(iso) {
    const ts = Date.parse(String(iso).includes("T") ? iso : String(iso).replace(" ", "T") + "Z");
    return Number.isFinite(ts) ? new Date(ts).toLocaleDateString(LOCALE[LANG], { day: "numeric", month: "short" }) + " " + new Date(ts).toLocaleTimeString(LOCALE[LANG], { hour: "2-digit", minute: "2-digit" }) : "";
  }

  function panelStaff() {
    const canResend = (u) => isSuper() || (S.me.role === "org_admin" && u.role === "teacher");
    const rows = S.staff.map((u) => {
      const st = staffStatus(u);
      const pending = st.key === "invited" || st.key === "pw";
      const mail = u.invite_sent_at ? `<div class="muted small-t">${te(MAIL_TXT[u.invite_status] || "Verstuurd")} · ${esc(dateNl(u.invite_sent_at))}</div>` : "";
      const seen = u.last_login_at ? `<div class="muted small-t">${te("Laatst ingelogd {d}", { d: String(u.last_login_at).slice(0, 10) })}</div>` : "";
      return `<tr><td><b>${esc(u.display_name)}</b><div class="muted small-t">${esc(u.username)}</div></td>
      <td><span class="tag">${esc(roleName(u.role))}</span>${Number(u.org_count) > 1 ? ` <span class="tag" title="${te("Hoort bij meerdere organisaties")}">${te("{n} organisaties", { n: Number(u.org_count) })}</span>` : ""}</td>
      <td><span class="status ${st.cls}">${te(st.text)}</span>${pending ? mail : seen}</td>
      <td class="actions">${pending && canResend(u) ? `<button class="small" data-act="staffreset" data-id="${esc(u.id)}" data-name="${esc(u.display_name)}" data-resend="1">${te("Opnieuw sturen")}</button> ` : canResend(u) ? `<button class="small ghost" data-act="staffreset" data-id="${esc(u.id)}" data-name="${esc(u.display_name)}">${te("Nieuw wachtwoord")}</button> ` : ""}<button class="small ghost" data-act="staffoff" data-id="${esc(u.id)}" data-off="${Number(u.disabled) ? 0 : 1}">${Number(u.disabled) ? te("Aanzetten") : te("Uitzetten")}</button></td></tr>`;
    }).join("");
    const counts = { invited: 0, pw: 0, active: 0 };
    S.staff.forEach((u) => { const k = staffStatus(u).key; if (counts[k] !== undefined) counts[k]++; });
    return `<div class="card"><h2>${te("Beheerders en docenten")}</h2>
      <div class="stats"><div><b>${counts.active}</b><span>${te("actief")}</span></div><div><b>${counts.invited + counts.pw}</b><span>${te("nog niet actief")}</span></div></div>
      <div class="scroll"><table><tr><th>${te("Naam")}</th><th>${te("Rol")}</th><th>${te("Status")}</th><th></th></tr>${rows || `<tr><td colspan="4" class="muted">${te("Nog niemand.")}</td></tr>`}</table></div></div>
      <form class="card" data-form="staff"><h2>${te("Nieuw account")}</h2><div class="row">
        <div><label>${te("Naam")}</label><input name="name" required maxlength="120"></div>
        <div><label>${te("E-mailadres")}</label><input name="email" type="email" required></div>
        <div><label>${te("Rol")}</label><select name="role"><option value="teacher">${te("Docent")}</option><option value="org_admin">${te("Beheerder")}</option></select></div>
        <button type="submit">${te("Aanmaken")}</button></div>
        <p class="muted">${te("Je krijgt een startwachtwoord te zien. Geef dat door; de persoon kiest bij de eerste keer inloggen een eigen wachtwoord.")}</p></form>${panelLinkOrg()}`;
  }

  // Alleen de hoofdbeheerder: een bestaand account aan nog een organisatie koppelen (of weer losmaken).
  function panelLinkOrg() {
    if (!isSuper() || !S.staff.length) return "";
    const others = S.orgs.filter((o) => Number(o.active));
    return `<form class="card" data-form="linkorg"><h2>${te("Account aan meerdere organisaties koppelen")}</h2>
      <p class="muted">${te("Een docent of beheerder kan dan met een keuzemenu bovenin wisselen tussen de organisaties. Klassen en leerlingen blijven gescheiden per organisatie.")}</p>
      <div class="row">
        <div><label>${te("Account")}</label><select name="user_id">${S.staff.map((u) => `<option value="${esc(u.id)}">${esc(u.display_name)} (${esc(u.username)})</option>`).join("")}</select></div>
        <div><label>${te("Organisatie")}</label><select name="org_id">${others.map((o) => `<option value="${esc(o.id)}">${esc(o.name)}</option>`).join("")}</select></div>
        <div><label>${te("Actie")}</label><select name="mode"><option value="add">${te("Koppelen")}</option><option value="remove">${te("Losmaken")}</option></select></div>
        <button type="submit">${te("Uitvoeren")}</button></div></form>`;
  }

  function panelClasses() {
    const rows = S.classes.map((c) => `<tr><td>${esc(c.name)}</td></tr>`).join("");
    const teachers = S.staff.filter((u) => u.role === "teacher");
    const assign = S.me.role === "teacher" ? "" : `<form class="card" data-form="assign"><h2>${te("Docent koppelen aan klas")}</h2><div class="row">
      <div><label>${te("Klas")}</label><select name="class_id">${classOptions()}</select></div>
      <div><label>${te("Docent")}</label><select name="teacher_id">${teachers.map((u) => `<option value="${esc(u.id)}">${esc(u.display_name)}</option>`).join("")}</select></div>
      <button type="submit" ${S.classes.length && teachers.length ? "" : "disabled"}>${te("Koppelen")}</button></div></form>`;
    return `<div class="card"><h2>${te("Klassen")}</h2><table><tr><th>${te("Naam")}</th></tr>${rows || `<tr><td class="muted">${te("Nog geen klassen.")}</td></tr>`}</table></div>
      <form class="card" data-form="class"><h2>${te("Nieuwe klas")}</h2><div class="row"><div><label>${te("Naam (bijvoorbeeld Groep 3A)")}</label><input name="name" required maxlength="80"></div>
      <button type="submit">${te("Aanmaken")}</button></div></form>${assign}`;
  }

  const classSelect = (value, attrs, noneLabel) => `<select ${attrs}><option value="">${esc(noneLabel)}</option>${S.classes.map((c) => `<option value="${esc(c.id)}" ${c.id === value ? "selected" : ""}>${esc(c.name)}</option>`).join("")}</select>`;

  const matches = (s, q) => !q || [s.display_name, s.student_number, s.username].some((v) => String(v || "").toLowerCase().includes(q));

  function panelStudents() {
    const q = S.search.trim().toLowerCase();
    const found = S.students.filter((s) => matches(s, q));
    const shown = found.slice(0, S.limit);
    const rows = shown.map((s) => `<tr><td>${s.student_number ? `<span class="nr">${esc(s.student_number)}</span> ` : ""}<b>${esc(s.display_name)}</b><div class="muted small-t mono">${esc(s.username)}</div></td>
      <td>${classSelect(s.class_id, `data-change="stuclass" data-id="${esc(s.id)}" class="inline"`, t("Geen klas"))}</td>
      <td>${s.last_login_at ? esc(String(s.last_login_at).slice(0, 10)) : `<span class="muted">${te("nog nooit")}</span>`}</td>
      <td>${S.shown[s.id] ? `<span class="mono"><b>${esc(S.shown[s.id])}</b></span> <button class="small ghost" data-act="hidepw" data-id="${esc(s.id)}">${te("Verberg")}</button>`
        : s.has_password ? `<button class="small ghost" data-act="showpw" data-id="${esc(s.id)}">${te("Toon")}</button>` : `<span class="muted" title="${te("Dit wachtwoord is niet bewaard. Maak een nieuw wachtwoord.")}">-</span>`}${s.disabled ? ` <span class="tag off">${te("uit")}</span>` : ""}</td>
      <td class="actions"><button class="small ghost" data-act="reset" data-id="${esc(s.id)}" data-name="${esc(s.display_name)}">${te("Nieuw wachtwoord")}</button>
        <button class="small ghost" data-act="studoff" data-id="${esc(s.id)}" data-off="${s.disabled ? 0 : 1}">${s.disabled ? te("Aanzetten") : te("Uitzetten")}</button>
        <button class="small danger" data-act="studdel" data-id="${esc(s.id)}" data-name="${esc(s.display_name)}">${te("Verwijderen")}</button></td></tr>`).join("");
    const realClass = S.classId && S.classId !== "none";
    const filter = `<select data-change="class"><option value="" ${S.classId === "" ? "selected" : ""}>${te("Alle leerlingen")}</option>${S.classes.map((c) => `<option value="${esc(c.id)}" ${c.id === S.classId ? "selected" : ""}>${esc(c.name)}</option>`).join("")}<option value="none" ${S.classId === "none" ? "selected" : ""}>${te("Zonder klas")}</option></select>`;
    return `<div class="card"><div class="row"><h2 style="margin:0">${te("Leerlingen")}</h2>
      <div class="right"><label>${te("Tonen")}</label>${filter}</div></div>
      <input type="search" class="search" data-input="search" placeholder="${te("Zoek op naam, nummer of gebruikersnaam")}" value="${esc(S.search)}" autocomplete="off">
      <p class="muted small-t">${found.length === S.students.length ? te("{n} leerlingen", { n: S.students.length }) : te("{a} van {b} leerlingen", { a: found.length, b: S.students.length })}</p>
      <div class="scroll"><table><tr><th>${te("Naam")}</th><th>${te("Klas")}</th><th>${te("Laatst ingelogd")}</th><th>${te("Wachtwoord")}</th><th></th></tr>${rows || `<tr><td colspan="5" class="muted">${te("Geen leerlingen gevonden.")}</td></tr>`}</table></div>
      ${found.length > shown.length ? `<p><button class="ghost" data-act="more">${te("Toon meer ({n} te gaan)", { n: found.length - shown.length })}</button></p>` : ""}
      ${realClass ? `<p><button class="ghost small" data-act="classcards" ${S.students.length ? "" : "disabled"}>${te("Inlogkaartjes van deze klas tonen en printen")}</button></p>` : ""}</div>
      <form class="card" data-form="students"><h2>${te("Leerlingen toevoegen")}</h2>
        <p class="muted">${t("Eén leerling per regel, met <b>voornaam en achternaam</b>. Elke leerling krijgt een nummer, een gebruikersnaam en een wachtwoord. Een klas is niet verplicht: je kunt een leerling later aan een klas koppelen. Je kunt de wachtwoorden later weer bekijken met de knop Toon.")}</p>
        <label>${te("Klas (mag leeg blijven)")}</label>${classSelect(S.addClass || (realClass ? S.classId : ""), 'name="class_id"', t("Geen klas"))}
        <label>${te("Voor- en achternaam (één leerling per regel)")}</label><textarea name="names" placeholder="${te("Aya Said\nBilal Amrani\nZoë de Vries").replace(/\n/g, "&#10;")}"></textarea>
        <p><button type="submit" ${S.busy ? "disabled" : ""}>${S.busy ? te("Bezig...") : te("Accounts maken")}</button></p></form>${panelImport()}`;
  }

  // Importeren uit een bestand (alleen beheerders): voornaam, achternaam, nummer, gebruikersnaam en wachtwoord staan al in het bestand.
  function panelImport() {
    if (S.me.role === "teacher") return "";
    const run = S.impRun, res = S.impResult;
    return `<div class="card"><h2>${te("Leerlingen importeren uit een bestand")}</h2>
      <p class="muted">${t("Voor een bestaande leerlingenlijst. Kies een CSV-bestand met de kolommen <b>nummer, voornaam, achternaam, gebruikersnaam, wachtwoord</b> (gescheiden door puntkomma's). Elke leerling krijgt dan precies die gegevens.")}</p>
      <input type="file" accept=".csv,text/csv,text/plain" data-change="importfile" ${run ? "disabled" : ""}>
      ${S.imp ? `<p><b>${S.imp.list.length}</b> ${te("leerlingen gevonden in")} <span class="mono">${esc(S.imp.name)}</span>${S.imp.bad ? `, ${te("{n} regels overgeslagen (onvolledig)", { n: S.imp.bad })}` : ""}. ${te("Voorbeeld")}: <span class="mono">${esc(S.imp.list[0].number)} ${esc(S.imp.list[0].first_name)} ${esc(S.imp.list[0].last_name)} (${esc(S.imp.list[0].username)})</span></p>
        <p><button data-act="doimport" ${run ? "disabled" : ""}>${run ? te("Bezig met importeren...") : te("Nu importeren")}</button></p>` : ""}
      ${run ? `<div class="msg warn">${te("Bezig: {done} van {total} verwerkt ({created} aangemaakt, {skipped} overgeslagen). Sluit deze pagina niet.", { done: run.done, total: run.total, created: run.created, skipped: run.skipped.length })}${run.note ? ` <b>${esc(run.note)}</b>` : ""}<div class="bar"><i style="width:${Math.round((run.done / run.total) * 100)}%"></i></div></div>` : ""}
      ${res ? `<div class="msg ${res.failed ? "err" : "ok"}">${esc(res.text)}</div>${res.skipped.length ? `<details open><summary class="muted">${te("{n} overgeslagen", { n: res.skipped.length })}</summary><table>${res.skipped.slice(0, 50).map((x) => `<tr><td class="mono">${esc(x.username)}</td><td>${esc(t(x.reason))}</td></tr>`).join("")}</table>${res.skipped.length > 50 ? `<p class="muted small-t">${te("... en {n} meer", { n: res.skipped.length - 50 })}</p>` : ""}</details>` : ""}` : ""}
    </div>`;
  }

  // CSV lezen: BOM weg, scheidingsteken ; of ,, aanhalingstekens weg. Kolommen herkennen op de kopnaam (NL, EN of TR).
  function parseImport(text) {
    const lines = String(text).replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) return { list: [], bad: 0 };
    const delim = lines[0].includes(";") ? ";" : ",";
    const cut = (l) => l.split(delim).map((c) => c.trim().replace(/^"|"$/g, "").replace(/""/g, '"'));
    const head = cut(lines[0]).map((h) => h.toLowerCase());
    const idx = (...names) => head.findIndex((h) => names.includes(h));
    const c = { number: idx("nummer", "nr", "number", "numara"), first: idx("voornaam", "first_name", "firstname", "first name", "ad"), last: idx("achternaam", "last_name", "lastname", "last name", "soyad"), user: idx("gebruikersnaam", "username", "kullanıcı adı"), pass: idx("wachtwoord", "password", "şifre") };
    if (c.first < 0 || c.user < 0 || c.pass < 0) return { list: [], bad: 0, error: "Kolommen voornaam, gebruikersnaam en wachtwoord ontbreken." };
    const list = []; let bad = 0;
    for (const l of lines.slice(1)) {
      const v = cut(l);
      const r = { number: c.number >= 0 ? v[c.number] : "", first_name: v[c.first], last_name: c.last >= 0 ? v[c.last] : "", username: v[c.user], password: v[c.pass] };
      if (!r.first_name || !r.username || !r.password) { bad++; continue; }
      list.push(r);
    }
    return { list, bad };
  }

  // "vandaag", "gisteren", "5 dagen geleden", "nog nooit"
  function ago(iso) {
    if (!iso) return null;
    const ts = Date.parse(String(iso).includes("T") ? iso : String(iso).replace(" ", "T") + "Z");
    if (!Number.isFinite(ts)) return null;
    const d = Math.floor((Date.now() - ts) / 86400000), mo = Math.floor(d / 30);
    return { days: d, text: d <= 0 ? t("vandaag") : d === 1 ? t("gisteren") : d < 31 ? t("{n} dagen geleden", { n: d }) : mo === 1 ? t("{n} maand geleden", { n: mo }) : t("{n} maanden geleden", { n: mo }) };
  }
  // Laatste teken van leven: speelactiviteit uit de voortgang, anders het inlogmoment.
  const lastSeen = (s) => ago((s.progress && s.progress.last_activity) || s.last_login_at);

  function panelProgress() {
    const list = S.progress;
    const withData = list.filter((s) => s.progress);
    const active7 = list.filter((s) => { const a = lastSeen(s); return a && a.days <= 7; }).length;
    const avg = withData.length ? (withData.reduce((n, s) => n + (s.progress.worlds.letter_oasis || 0), 0) / withData.length) : 0;
    const rows = list.map((s) => {
      const p = s.progress, a = lastSeen(s), done = p ? (p.worlds.letter_oasis || 0) : 0;
      const bar = `<div class="bar" title="${te("{done} van {total}", { done, total: WORLD1_LEVELS })}"><i style="width:${Math.round((done / WORLD1_LEVELS) * 100)}%"></i></div>`;
      const weak = p && p.weak_letters.length ? p.weak_letters.map((l) => `<span class="ar" lang="ar" dir="rtl">${esc(l)}</span>`).join(" ") : (p && p.practiced_letters ? `<span class="muted">${te("geen")}</span>` : `<span class="muted">-</span>`);
      return `<tr><td>${s.student_number ? `<span class="nr">${esc(s.student_number)}</span> ` : ""}<b>${esc(s.display_name)}</b>${s.disabled ? ` <span class="tag off">${te("uit")}</span>` : ""}<div class="muted small-t mono">${esc(s.username)}</div></td>
        <td>${p ? `<bdi dir="ltr">${done} / ${WORLD1_LEVELS}</bdi>${bar}` : `<span class="muted">${te("nog niet gespeeld")}</span>`}</td>
        <td>${p ? `${p.stars} ★` : ""}</td><td>${p ? `<bdi dir="ltr">${p.mini_done} / ${MINI_LEVELS}</bdi>` : ""}</td><td>${p ? `${p.coins}` : ""}</td>
        <td>${a ? `<span class="${a.days > 7 ? "stale" : ""}">${esc(a.text)}</span>` : `<span class="muted">${te("nog nooit")}</span>`}</td><td>${weak}</td></tr>`;
    }).join("");
    return `<div class="card"><div class="row"><h2 style="margin:0">${te("Voortgang")}</h2>
        <div class="right"><label>${te("Klas")}</label><select data-change="progclass"><option value="">${te("Alle leerlingen")}</option>${S.classes.map((c) => `<option value="${esc(c.id)}" ${c.id === S.progClass ? "selected" : ""}>${esc(c.name)}</option>`).join("")}<option value="none" ${S.progClass === "none" ? "selected" : ""}>${te("Zonder klas")}</option></select></div>
        <button class="ghost small" data-act="progcsv" ${list.length ? "" : "disabled"}>${te("Download CSV")}</button></div>
      <div class="stats"><div><b>${list.length}</b><span>${te("leerlingen")}</span></div><div><b>${active7}</b><span>${te("actief afgelopen 7 dagen")}</span></div><div><b>${avg.toFixed(1)}</b><span>${te("gemiddeld niveau van {n}", { n: WORLD1_LEVELS })}</span></div></div>
      <div class="scroll"><table><tr><th>${te("Leerling")}</th><th>${te("Wereld 1")}</th><th>${te("Sterren")}</th><th>${te("Spellen")}</th><th>${te("Munten")}</th><th>${te("Laatst actief")}</th><th>${te("Aandacht voor")}</th></tr>
        ${rows || `<tr><td colspan="7" class="muted">${te("Nog geen leerlingen. Voeg ze toe bij het tabblad Leerlingen.")}</td></tr>`}</table></div>
      <p class="muted small-t">${t("De voortgang komt binnen zodra het kind is ingelogd en speelt (een paar seconden na elke wijziging). <b>Aandacht voor</b> toont letters die het kind vaker fout dan goed heeft.")}</p></div>`;
  }

  const KIND_ICON = { defect: "🐞", idea: "💡", question: "❓" }, KIND_TXT = { defect: "Defect", idea: "Idee", question: "Vraag" };
  const ST_TXT = { new: "Nieuw", doing: "Wordt opgepakt", done: "Klaar" };
  const CTX_LABEL = { screen: "Scherm", lang: "Taal", version: "Versie", viewport: "Schermgrootte", device: "Toestel", online: "Online", mode: "Modus", user: "Gebruiker", errors: "Laatste fouten" };
  function panelFeedback() {
    const filters = [["new", "Nieuw"], ["doing", "Wordt opgepakt"], ["done", "Klaar"], ["", "Alles"]];
    const rows = S.feedback.map((f) => {
      const ctx = Object.entries(f.context || {}).filter(([, v]) => v !== "" && !(Array.isArray(v) && !v.length))
        .map(([k, v]) => `<tr><th>${te(CTX_LABEL[k] || k)}</th><td class="mono small-t">${esc(Array.isArray(v) ? v.join(" | ") : v)}</td></tr>`).join("");
      return `<div class="fb-item"><div class="fb-head"><b>${KIND_ICON[f.kind] || ""} ${te(KIND_TXT[f.kind] || f.kind)}</b> <span class="muted">${esc(f.user_name)} · ${esc(roleName(f.role))} · ${esc(dateNl(f.created_at))}</span>
          <span class="status ${f.status === "done" ? "ok" : f.status === "doing" ? "warn" : ""}">${te(ST_TXT[f.status] || f.status)}</span></div>
        <p class="fb-msg-txt">${esc(f.message)}</p>
        ${ctx ? `<details><summary class="muted small-t">${te("Technische gegevens")}</summary><table>${ctx}</table></details>` : ""}
        <div class="fb-btns">${["new", "doing", "done"].filter((x) => x !== f.status).map((x) => `<button class="small ghost" data-act="fbstatus" data-id="${esc(f.id)}" data-status="${x}">${x === "new" ? te("Terug naar nieuw") : x === "doing" ? te("Oppakken") : te("Klaar")}</button>`).join(" ")}</div></div>`;
    }).join("");
    return `<div class="card"><div class="row"><h2 style="margin:0">${te("Feedback en defecten")}</h2>
      <div class="right">${filters.map(([k, l]) => `<button class="small ${S.fbFilter === k ? "" : "ghost"}" data-act="fbfilter" data-f="${k}">${te(l)}</button>`).join(" ")}</div></div>
      ${rows || `<p class="muted">${te("Geen meldingen.")}</p>`}</div>`;
  }
  // Formulier om zelf iets door te geven (alle rollen)
  function panelFeedbackForm() {
    if (!S.fbOpen) return "";
    return `<form class="card" data-form="feedback"><h2>${te("Feedback geven")}</h2><div class="row">
      <div><label>${te("Soort")}</label><select name="kind"><option value="defect">🐞 ${te("Defect")}</option><option value="idea">💡 ${te("Idee")}</option><option value="question">❓ ${te("Vraag")}</option></select></div></div>
      <label>${te("Wat wil je doorgeven?")}</label><textarea name="message" maxlength="1500" required placeholder="${te("Bijvoorbeeld: bij Leerlingen werkt de knop Toon niet")}"></textarea>
      <p class="muted small-t">${te("We sturen automatisch mee: op welk tabblad je zat, je toestel en de versie.")}</p>
      <p><button type="submit">${te("Versturen")}</button> <button type="button" class="ghost" data-act="fbclose">${te("Annuleren")}</button></p></form>`;
  }

  function panelSecret() {
    if (!S.secret) return "";
    const slips = S.secret.rows.map((r) => `<div class="slip"><b>${esc(r.name)}</b>
      <div class="k">${te(S.secret.userLabel)}</div><div class="v mono">${esc(r.username)}</div>
      <div class="k">${te("Wachtwoord")}</div><div class="v mono">${esc(r.password)}</div>
      <div class="site">${esc(S.secret.site)}</div></div>`).join("");
    return `<div class="card secret printable"><h2>${esc(S.secret.title)}</h2>
      ${S.secret.mailed ? `<div class="msg ok noprint">${te("Er is ook een mail met deze inloggegevens verstuurd")}${S.secret.mailTo ? ` ${te("naar {to}", { to: S.secret.mailTo })}` : ""}.</div>` : ""}<div class="msg warn noprint">${S.secret.stored ? te("Dit zijn de bewaarde inloggegevens van de klas. Laat ze niet rondslingeren: print ze en bewaar ze veilig.") : t("Bewaar of druk dit nu af. Voor accounts van volwassenen wordt het wachtwoord hierna <b>nooit meer</b> getoond (je kunt wel een nieuw wachtwoord laten maken).")}${S.secret.missing ? ` <b>${te("{n} leerling(en) staan er niet bij", { n: S.secret.missing })}</b>: ${te("hun wachtwoord is niet bewaard. Maak voor hen een nieuw wachtwoord.")}` : ""}</div>
      <p class="noprint"><button data-act="print">${te("Afdrukken")}</button> <button class="ghost" data-act="csv">${te("Download CSV")}</button> <button class="ghost right" data-act="closesecret">${te("Sluiten")}</button></p>
      <div class="slips">${slips}</div></div>`;
  }

  function render() {
    if (!S.me) return viewLogin();
    S.view = null;
    document.body.classList.remove("auth");
    const tabs = tabsFor().map(([k, l]) => `<button class="tab ${S.tab === k ? "sel" : ""}" data-act="tab" data-tab="${k}">${te(l)}</button>`).join("");
    const orgName = isSuper() && S.orgId ? (S.orgs.find((o) => o.id === S.orgId) || {}).name : "";
    const panel = { feedback: panelFeedback, orgs: panelOrgs, staff: panelStaff, classes: panelClasses, students: panelStudents, progress: panelProgress }[S.tab];
    $app.innerHTML = `<div class="top ${S.menu ? "menu-open" : ""}">
        <div class="brand"><img class="brand-logo" src="../icons/icon-192.png" alt=""><h1>${te("Alif Ba beheer")}</h1>${orgName ? `<span class="tag">${esc(orgName)}</span>` : ""}
          ${S.myOrgs.length > 1 ? `<select class="org-switch" data-change="myorg" aria-label="${te("Organisatie")}">${S.myOrgs.map((o) => `<option value="${esc(o.id)}" ${S.myOrg && o.id === S.myOrg.id ? "selected" : ""}>${esc(o.name)}</option>`).join("")}</select>` : S.myOrg ? `<span class="tag">${esc(S.myOrg.name)}</span>` : ""}</div>
        <div class="top-user">
          <div class="who"><b>${esc(S.me.display_name)}</b><span>${esc(roleName(S.me.role))}</span></div>
          <button class="ghost small menu-btn" data-act="menu" aria-expanded="${S.menu}" aria-label="${te("Menu")}">${S.menu ? "✕" : "☰"} ${te("Menu")}</button>
          <div class="top-actions">${langPicks()}<button class="ghost small" data-act="fbopen">💬 ${te("Feedback")}</button><a class="btn-link" href="${APP_URL}/#/spel?voorbeeld" target="_blank" rel="noopener" title="${te("Open het spel als leerling, met alles open")}">${te("Spel bekijken")}</a><button class="ghost small" data-act="chpw">${te("Wachtwoord wijzigen")}</button><button class="ghost small" data-act="logout">${te("Uitloggen")}</button></div>
        </div></div>
      <div class="tabs">${tabs}</div>
      ${S.msg ? `<div class="msg ${S.msg.kind}">${esc(S.msg.text)}</div>` : ""}
      ${panelFeedbackForm()}${panelSecret()}${panel ? panel() : ""}`;
    labelTables();
  }

  // Op de telefoon worden tabellen kaartjes: elke cel krijgt het label van zijn kolom.
  function labelTables() {
    $app.querySelectorAll(".card table").forEach((t) => {
      if (t.closest("details")) return;
      const heads = [...t.querySelectorAll("tr:first-child th")].map((th) => th.textContent.trim());
      if (!heads.length) return;
      t.classList.add("stack");
      t.querySelectorAll("tr").forEach((tr, i) => { if (i) [...tr.children].forEach((td, j) => td.setAttribute("data-label", heads[j] || "")); });
    });
  }

  // ---------- acties ----------
  const guard = async (fn) => { try { await fn(); } catch (e) { if (e.status === 401) { S.me = null; viewLogin(t("Je sessie is verlopen. Log opnieuw in.")); return; } flash(e.message, "err"); render(); } };

  const handlers = {
    tab: ({ tab }) => go(tab),
    lang: ({ l }) => {
      if (!LANGS.includes(l)) return;
      LANG = l; try { localStorage.setItem("lang", JSON.stringify(l)); } catch { /* geen opslag */ }
      applyLang();
      if (!S.me) return viewLogin("");
      if (S.view && S.view.k === "pw") return viewChangePassword(S.view.forced, "");
      render();
    },
    back: () => { render(); },
    menu: () => { S.menu = !S.menu; render(); },
    chpw: () => viewChangePassword(false),
    logout: async () => { try { await api("POST", "/auth/logout", {}); } catch { /* maakt niet uit */ } S.me = null; S.secret = null; viewLogin(); },
    openorg: async ({ id }) => { S.orgId = id; S.classId = ""; S.secret = null; await go("staff"); },
    staffreset: ({ id, name, resend }) => guard(async () => {
      if (!confirm(resend ? t("Inloggegevens opnieuw sturen naar {name}? Er wordt een nieuw startwachtwoord gemaakt en gemaild; het vorige werkt dan niet meer.", { name }) : t("Nieuw startwachtwoord maken voor {name}? Het oude wachtwoord werkt dan niet meer en de persoon wordt overal uitgelogd.", { name }))) return;
      const r = await api("POST", `/users/${id}/reset-password`, {});
      S.secret = { title: t("Nieuw startwachtwoord voor {name}", { name }), userLabel: "Inloggen met e-mailadres", site: location.origin + location.pathname, rows: [{ name, username: r.username, password: r.password }], mailed: r.mailed };
      await loadStaff(); flash(null); render(); window.scrollTo(0, 0);
    }),
    staffoff: ({ id, off }) => guard(async () => { await api("POST", `/users/${id}/disable`, { disabled: off === "1" }); flash(off === "1" ? t("Account uitgezet.") : t("Account aangezet.")); await loadStaff(); render(); }),
    reset: ({ id, name }) => guard(async () => {
      if (!confirm(t("Nieuw wachtwoord maken voor {name}? Het oude wachtwoord werkt dan niet meer.", { name }))) return;
      const r = await api("POST", `/students/${id}/reset-password`, {});
      S.secret = { title: t("Nieuw wachtwoord"), userLabel: "Gebruikersnaam", site: APP_URL, rows: [{ name, username: r.username, password: r.password }] };
      flash(null); render(); window.scrollTo(0, 0);
    }),
    studoff: ({ id, off }) => guard(async () => { await api("POST", `/students/${id}/disable`, { disabled: off === "1" }); await loadStudents(); render(); }),
    studdel: ({ id, name }) => guard(async () => {
      if (!confirm(t("{name} definitief verwijderen? Dit kan niet ongedaan worden gemaakt.", { name }))) return;
      await api("DELETE", `/students/${id}`); flash(t("{name} is verwijderd.", { name })); await loadStudents(); render();
    }),
    showpw: ({ id }) => guard(async () => { const r = await api("GET", `/students/${id}/password`); S.shown[id] = r.password; render(); }),
    hidepw: ({ id }) => { delete S.shown[id]; render(); },
    classcards: () => guard(async () => {
      const r = await api("GET", `/classes/${S.classId}/credentials`);
      const rows = r.students.filter((x) => x.password).map((x) => ({ name: x.name, username: x.username, password: x.password }));
      const missing = r.students.length - rows.length;
      if (!rows.length) { flash(t("Van deze leerlingen is geen wachtwoord bewaard. Maak eerst een nieuw wachtwoord."), "err"); return render(); }
      S.secret = { title: t("Inloggegevens {name}", { name: r.class.name }), userLabel: "Gebruikersnaam", site: APP_URL, rows, stored: true, missing };
      flash(null); render(); window.scrollTo(0, 0);
    }),
    fbopen: () => { S.fbOpen = true; render(); window.scrollTo(0, 0); },
    fbclose: () => { S.fbOpen = false; render(); },
    fbfilter: ({ f }) => guard(async () => { S.fbFilter = f; await loadFeedback(); render(); }),
    fbstatus: ({ id, status }) => guard(async () => { await api("POST", `/feedback/${id}/status`, { status }); await loadFeedback(); render(); }),
    more: () => { S.limit += 100; render(); },
    doimport: () => guard(async () => {
      // De server rekent per leerling (veilig wachtwoord opslaan) en mag op het gratis Cloudflare-abonnement maar kort rekenen.
      // Daarom: kleine groepjes, een korte pauze ertussen, en bij een time-out even wachten en kleiner opnieuw proberen.
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      const list = S.imp.list; let size = 4, i = 0, fails = 0, failed = null;
      S.impResult = null; S.impRun = { done: 0, total: list.length, created: 0, skipped: [], note: "" }; render();
      while (i < list.length) {
        const chunk = list.slice(i, i + size);
        try {
          const r = await api("POST", "/students/import", { students: chunk, ...(isSuper() ? { org_id: S.orgId } : {}) });
          S.impRun.created += r.created.length; S.impRun.skipped.push(...r.skipped); i += chunk.length; S.impRun.done = i; fails = 0; S.impRun.note = "";
          render();
          if (r.created.length) await sleep(1500); // pauze zodat de server weer ruimte heeft
        } catch (e) {
          if (e.status === 401 || e.status === 403 || e.status === 400 || e.status === 404) { failed = e; break; }
          if (++fails > 8) { failed = e; break; }
          size = Math.max(2, Math.floor(size / 2));
          S.impRun.note = t("De server is even bezig. Wachten en opnieuw proberen ({n}/8)...", { n: fails }); render();
          await sleep(Math.min(40000, 10000 * fails)); // 10 s, 20 s, 30 s, 40 s...
        }
      }
      const run = S.impRun; S.impRun = null; S.imp = null;
      S.impResult = { failed: !!failed, skipped: run.skipped, text: failed ? t("Gestopt na {done} van {total}: {msg}. Wat al is aangemaakt blijft staan; je kunt het bestand opnieuw importeren, bestaande leerlingen worden dan overgeslagen.", { done: run.done, total: run.total, msg: failed.message }) : t("Klaar: {n} leerlingen aangemaakt", { n: run.created }) + (run.skipped.length ? t(", {n} overgeslagen", { n: run.skipped.length }) : "") + "." };
      await loadStudents(); render();
    }),
    print: () => window.print(),
    csv: () => {
      const q = (v) => `"${String(v).replace(/"/g, '""')}"`;
      const lines = [[t("Naam"), t(S.secret.userLabel), t("Wachtwoord")].map(q).join(";"), ...S.secret.rows.map((r) => [r.name, r.username, r.password].map(q).join(";"))];
      const url = URL.createObjectURL(new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" }));
      const a = document.createElement("a"); a.href = url; a.download = "accounts.csv"; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
    },
    closesecret: () => { S.secret = null; render(); },
    progcsv: () => {
      const q = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
      const head = ["Naam", "Gebruikersnaam", "Niveaus Wereld 1", "Sterren", "Spelniveaus", "Munten", "Laatst actief", "Aandacht voor letters"].map((h) => t(h));
      const lines = [head.map(q).join(";"), ...S.progress.map((s) => { const p = s.progress, a = lastSeen(s);
        return [s.display_name, s.username, p ? p.worlds.letter_oasis || 0 : "", p ? p.stars : "", p ? p.mini_done : "", p ? p.coins : "", a ? a.text : t("nog nooit"), p ? p.weak_letters.join(" ") : ""].map(q).join(";"); })];
      const url = URL.createObjectURL(new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" }));
      const a = document.createElement("a"); a.href = url; a.download = "voortgang.csv"; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
    },
  };

  const forms = {
    login: (f) => async () => {
      try {
        await api("POST", "/auth/login", { username: f.username.value, password: f.password.value });
      } catch (e) { return viewLogin(e.message); }
      await boot(true);
    },
    password: (f) => async () => {
      try { await api("POST", "/auth/change-password", { current: f.current.value, next: f.next.value }); }
      catch (e) { return viewChangePassword(S.me && S.me.must_change_password, e.message); }
      S.me.must_change_password = false; await start(); flash(t("Wachtwoord gewijzigd.")); render();
    },
    org: (f) => async () => { await api("POST", "/orgs", { name: f.name.value, code: f.code.value }); flash(t("Organisatie aangemaakt.")); await loadOrgs(); render(); },
    staff: (f) => async () => {
      const r = await api("POST", "/users", { role: f.role.value, name: f.name.value, email: f.email.value, ...(isSuper() ? { org_id: S.orgId } : {}) });
      S.secret = { title: t("Account aangemaakt voor {name}", { name: r.user.display_name }), userLabel: "Inloggen met e-mailadres", site: location.origin + location.pathname, rows: [{ name: r.user.display_name, username: r.user.username, password: r.password }], mailed: r.mailed, mailTo: r.user.username };
      flash(null); await loadStaff(); render(); window.scrollTo(0, 0);
    },
    class: (f) => async () => { await api("POST", "/classes", { name: f.name.value, ...(isSuper() ? { org_id: S.orgId } : {}) }); flash(t("Klas aangemaakt.")); await loadClasses(); render(); },
    feedback: (f) => async () => {
      await api("POST", "/feedback", { kind: f.kind.value, message: f.message.value, context: {
        screen: "beheer/" + (S.tab || ""), version: "beheer", viewport: `${innerWidth}x${innerHeight}`, device: navigator.userAgent.slice(0, 200), mode: ROLE_NL[S.me.role], user: S.me.username, lang: LANG, online: navigator.onLine } });
      S.fbOpen = false; flash(t("Bedankt! Je melding is verstuurd.")); render();
    },
    linkorg: (f) => async () => {
      const remove = f.mode.value === "remove";
      await api("POST", `/users/${f.user_id.value}/orgs${remove ? "/remove" : ""}`, { org_id: f.org_id.value });
      flash(remove ? t("Account losgemaakt van die organisatie.") : t("Account gekoppeld. Die persoon kan nu wisselen van organisatie.")); await loadStaff(); render();
    },
    assign: (f) => async () => { await api("POST", `/classes/${f.class_id.value}/teachers`, { teacher_id: f.teacher_id.value }); flash(t("Docent gekoppeld.")); render(); },
    students: (f) => async () => {
      const names = f.names.value.split(/\r?\n/).map((n) => n.trim()).filter(Boolean);
      if (!names.length) { flash(t("Vul minstens één naam in."), "err"); return render(); }
      S.addClass = f.class_id.value;
      S.busy = true; render();
      const rows = []; let failed = null;
      try {
        for (let i = 0; i < names.length; i += MAX_BULK) {
          const r = await api("POST", "/students/bulk", { names: names.slice(i, i + MAX_BULK), ...(S.addClass ? { class_id: S.addClass } : {}), ...(isSuper() && !S.addClass ? { org_id: S.orgId } : {}) });
          rows.push(...r.students.map((s) => ({ name: s.name, username: s.username, password: s.password })));
        }
      } catch (e) { failed = e; }
      S.busy = false;
      if (rows.length) S.secret = { title: rows.length === 1 ? t("{n} leerling aangemaakt", { n: 1 }) : t("{n} leerlingen aangemaakt", { n: rows.length }), userLabel: "Gebruikersnaam", site: APP_URL, rows };
      flash(failed ? t("Gestopt na {done} van {total}: {msg}", { done: rows.length, total: names.length, msg: failed.message }) : null, failed ? "err" : "ok");
      await loadStudents(); render(); window.scrollTo(0, 0);
    },
  };

  $app.addEventListener("click", (e) => {
    const b = e.target.closest("[data-act]"); if (!b) return;
    const fn = handlers[b.dataset.act]; if (fn) { e.preventDefault(); guard(() => fn(b.dataset)); }
  });
  $app.addEventListener("submit", (e) => {
    const f = e.target.closest("form[data-form]"); if (!f) return;
    e.preventDefault(); const fn = forms[f.dataset.form]; if (fn) guard(fn(f));
  });
  $app.addEventListener("input", (e) => {
    if (e.target.dataset.input !== "search") return;
    S.search = e.target.value; S.limit = 100; render();
    const el = $app.querySelector('[data-input="search"]'); if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
  });
  $app.addEventListener("change", async (e) => {
    if (e.target.dataset.change === "myorg") {
      const id = e.target.value;
      await guard(async () => {
        await api("POST", "/me/org", { org_id: id });
        S.myOrg = S.myOrgs.find((o) => o.id === id) || null; S.classId = ""; S.progClass = ""; S.secret = null;
        await go(S.tab);
      });
    }
    if (e.target.dataset.change === "importfile") {
      const file = e.target.files && e.target.files[0]; if (!file) { S.imp = null; return render(); }
      const text = await file.text(); const p = parseImport(text);
      S.impResult = null;
      if (p.error || !p.list.length) { S.imp = null; flash(t(p.error || "Geen leerlingen gevonden in dit bestand."), "err"); } else { S.imp = { name: file.name, list: p.list, bad: p.bad }; flash(null); }
      return render();
    }
    if (e.target.dataset.change === "stuclass") {
      const id = e.target.dataset.id, cid = e.target.value;
      await guard(async () => { await api("POST", `/students/${id}/class`, { class_id: cid || null }); flash(cid ? t("Leerling gekoppeld aan de klas.") : t("Leerling heeft nu geen klas.")); await loadStudents(); render(); });
    }
    if (e.target.dataset.change === "class") { S.classId = e.target.value; await guard(async () => { await loadStudents(); render(); }); }
    if (e.target.dataset.change === "progclass") { S.progClass = e.target.value; await guard(async () => { await loadProgress(); render(); }); }
  });

  // ---------- starten ----------
  async function start() {
    const first = tabsFor()[0][0];
    S.tab = S.tab && tabsFor().some(([k]) => k === S.tab) ? S.tab : first;
    if (isSuper() && !S.orgs.length) { try { await loadOrgs(); } catch { /* */ } }
    await go(S.tab);
  }
  async function boot(afterLogin) {
    try { const m = await api("GET", "/me"); S.me = m.user; S.myOrgs = m.orgs || []; S.myOrg = m.org || null; }
    catch (e) {
      S.me = null;
      return viewLogin(afterLogin ? t("Inloggen lukte, maar je browser bewaart de sessie niet. Sta cookies van deze site toe en probeer opnieuw.") : "");
    }
    if (S.me.must_change_password) return viewChangePassword(true);
    await start();
  }
  window.__beheer = { boot, S };
  applyLang();
  boot(false);
})();
