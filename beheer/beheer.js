// Alif Ba beheer: inloggen en beheren van organisaties, docenten, klassen en leerlingen.
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

  const S = { me: null, myOrgs: [], myOrg: null, shown: {}, tab: "", orgId: "", orgs: [], staff: [], classes: [], students: [], classId: "", progClass: "", progress: [], secret: null, msg: null, busy: false };

  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  async function api(method, path, body) {
    const res = await fetch(API + path, {
      method, credentials: "include",
      headers: body !== undefined ? { "content-type": "application/json" } : {},
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    let data = null; try { data = await res.json(); } catch { /* leeg */ }
    if (!res.ok) { const e = new Error((data && data.error) || `Er ging iets mis (${res.status}).`); e.status = res.status; throw e; }
    return data;
  }

  const isSuper = () => S.me && S.me.role === "superadmin";
  const orgQ = () => (isSuper() ? `?org_id=${encodeURIComponent(S.orgId)}` : "");
  const flash = (text, kind = "ok") => { S.msg = text ? { text, kind } : null; };

  // ---------- gegevens laden ----------
  async function loadOrgs() { S.orgs = (await api("GET", "/orgs")).orgs; }
  async function loadStaff() { S.staff = isSuper() && !S.orgId ? [] : (await api("GET", "/users" + orgQ())).users; }
  async function loadClasses() {
    S.classes = isSuper() && !S.orgId ? [] : (await api("GET", "/classes" + orgQ())).classes;
    if (!S.classes.some((c) => c.id === S.classId)) S.classId = S.classes[0] ? S.classes[0].id : "";
  }
  async function loadStudents() {
    if (isSuper() && !S.orgId) { S.students = []; return; }
    const q = S.classId ? `?class_id=${encodeURIComponent(S.classId)}` : orgQ();
    S.students = (await api("GET", "/students" + q)).students;
  }
  async function loadProgress() {
    if (isSuper() && !S.orgId) { S.progress = []; return; }
    const q = S.progClass ? `?class_id=${encodeURIComponent(S.progClass)}` : orgQ();
    S.progress = (await api("GET", "/students/progress" + q)).students;
  }
  async function loadFor(tab) {
    if (tab === "progress") { await loadClasses(); if (S.progClass && !S.classes.some((c) => c.id === S.progClass)) S.progClass = ""; return loadProgress(); }
    if (tab === "orgs") return loadOrgs();
    if (tab === "staff") return Promise.all([loadStaff(), loadClasses()]);
    if (tab === "classes") return Promise.all([loadClasses(), S.me.role === "teacher" ? Promise.resolve() : loadStaff()]);
    if (tab === "students") { await loadClasses(); return loadStudents(); }
  }

  function tabsFor() {
    const r = S.me.role, t = [];
    if (r === "superadmin") { t.push(["orgs", "Organisaties"]); if (S.orgId) t.push(["progress", "Voortgang"], ["staff", "Beheerders en docenten"], ["classes", "Klassen"], ["students", "Leerlingen"]); }
    else if (r === "org_admin") t.push(["progress", "Voortgang"], ["staff", "Docenten"], ["classes", "Klassen"], ["students", "Leerlingen"]);
    else t.push(["progress", "Voortgang"], ["classes", "Klassen"], ["students", "Leerlingen"]);
    return t;
  }

  async function go(tab) {
    S.tab = tab; S.shown = {}; flash(null);
    try { await loadFor(tab); } catch (e) { flash(e.message, "err"); }
    render();
  }

  // ---------- schermen ----------
  function viewLogin(err) {
    document.body.classList.add("auth");
    $app.innerHTML = `<div class="login"><img class="logo" src="../icons/icon-192.png" alt=""><h1>Alif Ba beheer</h1><p class="muted">Voor beheerders en docenten.</p>
      <form class="card" data-form="login">
        <label for="u">E-mailadres</label><input id="u" name="username" autocomplete="username" required>
        <label for="p">Wachtwoord</label><input id="p" name="password" type="password" autocomplete="current-password" required>
        ${err ? `<div class="msg err">${esc(err)}</div>` : ""}
        <p><button type="submit">Inloggen</button></p>
      </form></div>`;
  }

  function viewChangePassword(forced, err) {
    document.body.classList.add("auth");
    $app.innerHTML = `<div class="login"><img class="logo" src="../icons/icon-192.png" alt=""><h1>${forced ? "Kies een eigen wachtwoord" : "Wachtwoord wijzigen"}</h1>
      ${forced ? `<p class="muted">Je hebt een startwachtwoord gekregen. Kies nu een eigen wachtwoord (minstens 10 tekens).</p>` : ""}
      <form class="card" data-form="password">
        <label for="c">Huidig wachtwoord</label><input id="c" name="current" type="password" autocomplete="current-password" required>
        <label for="n">Nieuw wachtwoord (minstens 10 tekens)</label><input id="n" name="next" type="password" autocomplete="new-password" minlength="10" required>
        ${err ? `<div class="msg err">${esc(err)}</div>` : ""}
        <p><button type="submit">Opslaan</button> ${forced ? "" : `<button type="button" class="ghost" data-act="back">Annuleren</button>`}</p>
      </form></div>`;
  }

  const classOptions = () => S.classes.map((c) => `<option value="${esc(c.id)}" ${c.id === S.classId ? "selected" : ""}>${esc(c.name)}</option>`).join("");

  function panelOrgs() {
    const rows = S.orgs.map((o) => `<tr><td>${esc(o.name)}</td><td class="mono">${esc(o.code)}</td><td>${Number(o.active) ? `<span class="tag">actief</span>` : `<span class="tag off">uit</span>`}</td>
      <td class="actions"><button class="small" data-act="openorg" data-id="${esc(o.id)}" data-name="${esc(o.name)}">Openen</button></td></tr>`).join("");
    return `<div class="card"><h2>Organisaties</h2>
      <table><tr><th>Naam</th><th>Code</th><th>Status</th><th></th></tr>${rows || `<tr><td colspan="4" class="muted">Nog geen organisaties.</td></tr>`}</table></div>
      <form class="card" data-form="org"><h2>Nieuwe organisatie</h2><div class="row">
        <div><label>Naam</label><input name="name" required maxlength="120"></div>
        <div><label>Korte code (a-z, 0-9, streepje)</label><input name="code" required pattern="[a-z0-9][a-z0-9-]{2,39}" maxlength="40"></div>
        <button type="submit">Aanmaken</button></div></form>`;
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
    const t = Date.parse(String(iso).includes("T") ? iso : String(iso).replace(" ", "T") + "Z");
    return Number.isFinite(t) ? new Date(t).toLocaleDateString("nl-NL", { day: "numeric", month: "short" }) + " " + new Date(t).toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" }) : "";
  }

  function panelStaff() {
    const canResend = (u) => isSuper() || (S.me.role === "org_admin" && u.role === "teacher");
    const rows = S.staff.map((u) => {
      const st = staffStatus(u);
      const pending = st.key === "invited" || st.key === "pw";
      const mail = u.invite_sent_at ? `<div class="muted small-t">${esc(MAIL_TXT[u.invite_status] || "Verstuurd")} · ${esc(dateNl(u.invite_sent_at))}</div>` : "";
      const seen = u.last_login_at ? `<div class="muted small-t">Laatst ingelogd ${esc(String(u.last_login_at).slice(0, 10))}</div>` : "";
      return `<tr><td><b>${esc(u.display_name)}</b><div class="muted small-t">${esc(u.username)}</div></td>
      <td><span class="tag">${esc(ROLE_NL[u.role] || u.role)}</span>${Number(u.org_count) > 1 ? ` <span class="tag" title="Hoort bij meerdere organisaties">${Number(u.org_count)} organisaties</span>` : ""}</td>
      <td><span class="status ${st.cls}">${esc(st.text)}</span>${pending ? mail : seen}</td>
      <td class="actions">${pending && canResend(u) ? `<button class="small" data-act="staffreset" data-id="${esc(u.id)}" data-name="${esc(u.display_name)}" data-resend="1">Opnieuw sturen</button> ` : canResend(u) ? `<button class="small ghost" data-act="staffreset" data-id="${esc(u.id)}" data-name="${esc(u.display_name)}">Nieuw wachtwoord</button> ` : ""}<button class="small ghost" data-act="staffoff" data-id="${esc(u.id)}" data-off="${Number(u.disabled) ? 0 : 1}">${Number(u.disabled) ? "Aanzetten" : "Uitzetten"}</button></td></tr>`;
    }).join("");
    const counts = { invited: 0, pw: 0, active: 0 };
    S.staff.forEach((u) => { const k = staffStatus(u).key; if (counts[k] !== undefined) counts[k]++; });
    return `<div class="card"><h2>Beheerders en docenten</h2>
      <div class="stats"><div><b>${counts.active}</b><span>actief</span></div><div><b>${counts.invited + counts.pw}</b><span>nog niet actief</span></div></div>
      <div class="scroll"><table><tr><th>Naam</th><th>Rol</th><th>Status</th><th></th></tr>${rows || `<tr><td colspan="4" class="muted">Nog niemand.</td></tr>`}</table></div></div>
      <form class="card" data-form="staff"><h2>Nieuw account</h2><div class="row">
        <div><label>Naam</label><input name="name" required maxlength="120"></div>
        <div><label>E-mailadres</label><input name="email" type="email" required></div>
        <div><label>Rol</label><select name="role"><option value="teacher">Docent</option><option value="org_admin">Beheerder</option></select></div>
        <button type="submit">Aanmaken</button></div>
        <p class="muted">Je krijgt een startwachtwoord te zien. Geef dat door; de persoon kiest bij de eerste keer inloggen een eigen wachtwoord.</p></form>${panelLinkOrg()}`;
  }

  // Alleen de hoofdbeheerder: een bestaand account aan nog een organisatie koppelen (of weer losmaken).
  function panelLinkOrg() {
    if (!isSuper() || !S.staff.length) return "";
    const others = S.orgs.filter((o) => Number(o.active));
    return `<form class="card" data-form="linkorg"><h2>Account aan meerdere organisaties koppelen</h2>
      <p class="muted">Een docent of beheerder kan dan met een keuzemenu bovenin wisselen tussen de organisaties. Klassen en leerlingen blijven gescheiden per organisatie.</p>
      <div class="row">
        <div><label>Account</label><select name="user_id">${S.staff.map((u) => `<option value="${esc(u.id)}">${esc(u.display_name)} (${esc(u.username)})</option>`).join("")}</select></div>
        <div><label>Organisatie</label><select name="org_id">${others.map((o) => `<option value="${esc(o.id)}">${esc(o.name)}</option>`).join("")}</select></div>
        <div><label>Actie</label><select name="mode"><option value="add">Koppelen</option><option value="remove">Losmaken</option></select></div>
        <button type="submit">Uitvoeren</button></div></form>`;
  }

  function panelClasses() {
    const rows = S.classes.map((c) => `<tr><td>${esc(c.name)}</td></tr>`).join("");
    const teachers = S.staff.filter((u) => u.role === "teacher");
    const assign = S.me.role === "teacher" ? "" : `<form class="card" data-form="assign"><h2>Docent koppelen aan klas</h2><div class="row">
      <div><label>Klas</label><select name="class_id">${classOptions()}</select></div>
      <div><label>Docent</label><select name="teacher_id">${teachers.map((u) => `<option value="${esc(u.id)}">${esc(u.display_name)}</option>`).join("")}</select></div>
      <button type="submit" ${S.classes.length && teachers.length ? "" : "disabled"}>Koppelen</button></div></form>`;
    return `<div class="card"><h2>Klassen</h2><table><tr><th>Naam</th></tr>${rows || `<tr><td class="muted">Nog geen klassen.</td></tr>`}</table></div>
      <form class="card" data-form="class"><h2>Nieuwe klas</h2><div class="row"><div><label>Naam (bijvoorbeeld Groep 3A)</label><input name="name" required maxlength="80"></div>
      <button type="submit">Aanmaken</button></div></form>${assign}`;
  }

  function panelStudents() {
    const rows = S.students.map((s) => `<tr><td>${esc(s.display_name)}</td><td class="mono">${esc(s.username)}</td>
      <td>${s.last_login_at ? esc(String(s.last_login_at).slice(0, 10)) : '<span class="muted">nog nooit</span>'}</td>
      <td>${S.shown[s.id] ? `<span class="mono"><b>${esc(S.shown[s.id])}</b></span> <button class="small ghost" data-act="hidepw" data-id="${esc(s.id)}">Verberg</button>`
        : s.has_password ? `<button class="small ghost" data-act="showpw" data-id="${esc(s.id)}">Toon</button>` : `<span class="muted" title="Dit wachtwoord is niet bewaard. Maak een nieuw wachtwoord.">-</span>`}</td>
      <td>${s.disabled ? `<span class="tag off">uit</span>` : ""}</td>
      <td class="actions"><button class="small ghost" data-act="reset" data-id="${esc(s.id)}" data-name="${esc(s.display_name)}">Nieuw wachtwoord</button>
        <button class="small ghost" data-act="studoff" data-id="${esc(s.id)}" data-off="${s.disabled ? 0 : 1}">${s.disabled ? "Aanzetten" : "Uitzetten"}</button>
        <button class="small danger" data-act="studdel" data-id="${esc(s.id)}" data-name="${esc(s.display_name)}">Verwijderen</button></td></tr>`).join("");
    const none = !S.classes.length;
    return `<div class="card"><div class="row"><h2 style="margin:0">Leerlingen</h2>
      <div class="right"><label>Klas</label><select data-change="class">${classOptions()}</select></div></div>
      ${none ? `<p class="muted">Maak eerst een klas aan (tabblad Klassen).</p>` : `<table><tr><th>Naam</th><th>Gebruikersnaam</th><th>Laatst ingelogd</th><th>Wachtwoord</th><th></th><th></th></tr>${rows || `<tr><td colspan="6" class="muted">Nog geen leerlingen in deze klas.</td></tr>`}</table>
      <p><button class="ghost small" data-act="classcards" ${S.students.length ? "" : "disabled"}>Inlogkaartjes van deze klas tonen en printen</button></p>`}</div>
      <form class="card" data-form="students"><h2>Leerlingen toevoegen</h2>
        <p class="muted">Eén naam per regel. Elke leerling krijgt een gebruikersnaam en een wachtwoord. Je kunt de wachtwoorden later weer bekijken met de knop Toon, en de kaartjes opnieuw printen.</p>
        <textarea name="names" placeholder="Aya&#10;Bilal&#10;Zoë" ${none ? "disabled" : ""}></textarea>
        <p><button type="submit" ${none || S.busy ? "disabled" : ""}>${S.busy ? "Bezig..." : "Accounts maken"}</button></p></form>`;
  }

  // "vandaag", "gisteren", "5 dagen geleden", "nog nooit"
  function ago(iso) {
    if (!iso) return null;
    const t = Date.parse(String(iso).includes("T") ? iso : String(iso).replace(" ", "T") + "Z");
    if (!Number.isFinite(t)) return null;
    const d = Math.floor((Date.now() - t) / 86400000);
    return { days: d, text: d <= 0 ? "vandaag" : d === 1 ? "gisteren" : d < 31 ? `${d} dagen geleden` : `${Math.floor(d / 30)} maand${Math.floor(d / 30) === 1 ? "" : "en"} geleden` };
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
      const bar = `<div class="bar" title="${done} van ${WORLD1_LEVELS}"><i style="width:${Math.round((done / WORLD1_LEVELS) * 100)}%"></i></div>`;
      const weak = p && p.weak_letters.length ? p.weak_letters.map((l) => `<span class="ar" lang="ar" dir="rtl">${esc(l)}</span>`).join(" ") : (p && p.practiced_letters ? `<span class="muted">geen</span>` : `<span class="muted">-</span>`);
      return `<tr><td><b>${esc(s.display_name)}</b>${s.disabled ? ` <span class="tag off">uit</span>` : ""}<div class="muted small-t mono">${esc(s.username)}</div></td>
        <td>${p ? `${done} / ${WORLD1_LEVELS}${bar}` : `<span class="muted">nog niet gespeeld</span>`}</td>
        <td>${p ? `${p.stars} ★` : ""}</td><td>${p ? `${p.mini_done} / ${MINI_LEVELS}` : ""}</td><td>${p ? `${p.coins}` : ""}</td>
        <td>${a ? `<span class="${a.days > 7 ? "stale" : ""}">${esc(a.text)}</span>` : `<span class="muted">nog nooit</span>`}</td><td>${weak}</td></tr>`;
    }).join("");
    return `<div class="card"><div class="row"><h2 style="margin:0">Voortgang</h2>
        <div class="right"><label>Klas</label><select data-change="progclass"><option value="">Alle klassen</option>${S.classes.map((c) => `<option value="${esc(c.id)}" ${c.id === S.progClass ? "selected" : ""}>${esc(c.name)}</option>`).join("")}</select></div>
        <button class="ghost small" data-act="progcsv" ${list.length ? "" : "disabled"}>Download CSV</button></div>
      <div class="stats"><div><b>${list.length}</b><span>leerlingen</span></div><div><b>${active7}</b><span>actief afgelopen 7 dagen</span></div><div><b>${avg.toFixed(1)}</b><span>gemiddeld niveau van ${WORLD1_LEVELS}</span></div></div>
      <div class="scroll"><table><tr><th>Leerling</th><th>Wereld 1</th><th>Sterren</th><th>Spellen</th><th>Munten</th><th>Laatst actief</th><th>Aandacht voor</th></tr>
        ${rows || `<tr><td colspan="7" class="muted">Nog geen leerlingen. Voeg ze toe bij het tabblad Leerlingen.</td></tr>`}</table></div>
      <p class="muted small-t">De voortgang komt binnen zodra het kind is ingelogd en speelt (een paar seconden na elke wijziging). <b>Aandacht voor</b> toont letters die het kind vaker fout dan goed heeft.</p></div>`;
  }

  function panelSecret() {
    if (!S.secret) return "";
    const slips = S.secret.rows.map((r) => `<div class="slip"><b>${esc(r.name)}</b>
      <div class="k">${esc(S.secret.userLabel)}</div><div class="v mono">${esc(r.username)}</div>
      <div class="k">Wachtwoord</div><div class="v mono">${esc(r.password)}</div>
      <div class="site">${esc(S.secret.site)}</div></div>`).join("");
    return `<div class="card secret printable"><h2>${esc(S.secret.title)}</h2>
      ${S.secret.mailed ? `<div class="msg ok noprint">Er is ook een mail met deze inloggegevens verstuurd${S.secret.mailTo ? ` naar ${esc(S.secret.mailTo)}` : ""}.</div>` : ""}<div class="msg warn noprint">${S.secret.stored ? "Dit zijn de bewaarde inloggegevens van de klas. Laat ze niet rondslingeren: print ze en bewaar ze veilig." : "Bewaar of druk dit nu af. Voor accounts van volwassenen wordt het wachtwoord hierna <b>nooit meer</b> getoond (je kunt wel een nieuw wachtwoord laten maken)."}${S.secret.missing ? ` <b>${S.secret.missing} leerling(en) staan er niet bij</b>: hun wachtwoord is niet bewaard. Maak voor hen een nieuw wachtwoord.` : ""}</div>
      <p class="noprint"><button data-act="print">Afdrukken</button> <button class="ghost" data-act="csv">Download CSV</button> <button class="ghost right" data-act="closesecret">Sluiten</button></p>
      <div class="slips">${slips}</div></div>`;
  }

  function render() {
    if (!S.me) return viewLogin();
    document.body.classList.remove("auth");
    const tabs = tabsFor().map(([k, l]) => `<button class="tab ${S.tab === k ? "sel" : ""}" data-act="tab" data-tab="${k}">${esc(l)}</button>`).join("");
    const orgName = isSuper() && S.orgId ? (S.orgs.find((o) => o.id === S.orgId) || {}).name : "";
    const panel = { orgs: panelOrgs, staff: panelStaff, classes: panelClasses, students: panelStudents, progress: panelProgress }[S.tab];
    $app.innerHTML = `<div class="top">
        <div class="brand"><img class="brand-logo" src="../icons/icon-192.png" alt=""><h1>Alif Ba beheer</h1>${orgName ? `<span class="tag">${esc(orgName)}</span>` : ""}
          ${S.myOrgs.length > 1 ? `<select class="org-switch" data-change="myorg" aria-label="Organisatie">${S.myOrgs.map((o) => `<option value="${esc(o.id)}" ${S.myOrg && o.id === S.myOrg.id ? "selected" : ""}>${esc(o.name)}</option>`).join("")}</select>` : S.myOrg ? `<span class="tag">${esc(S.myOrg.name)}</span>` : ""}</div>
        <div class="top-user">
          <div class="who"><b>${esc(S.me.display_name)}</b><span>${esc(ROLE_NL[S.me.role])}</span></div>
          <div class="top-actions"><a class="btn-link" href="${APP_URL}/#/spel?voorbeeld" target="_blank" rel="noopener" title="Open het spel als leerling, met alles open">Spel bekijken</a><button class="ghost small" data-act="chpw">Wachtwoord wijzigen</button><button class="ghost small" data-act="logout">Uitloggen</button></div>
        </div></div>
      <div class="tabs">${tabs}</div>
      ${S.msg ? `<div class="msg ${S.msg.kind}">${esc(S.msg.text)}</div>` : ""}
      ${panelSecret()}${panel ? panel() : ""}`;
  }

  // ---------- acties ----------
  const guard = async (fn) => { try { await fn(); } catch (e) { if (e.status === 401) { S.me = null; viewLogin("Je sessie is verlopen. Log opnieuw in."); return; } flash(e.message, "err"); render(); } };

  const handlers = {
    tab: ({ tab }) => go(tab),
    back: () => { render(); },
    chpw: () => viewChangePassword(false),
    logout: async () => { try { await api("POST", "/auth/logout", {}); } catch { /* maakt niet uit */ } S.me = null; S.secret = null; viewLogin(); },
    openorg: async ({ id }) => { S.orgId = id; S.classId = ""; S.secret = null; await go("staff"); },
    staffreset: ({ id, name, resend }) => guard(async () => {
      if (!confirm(resend ? `Inloggegevens opnieuw sturen naar ${name}? Er wordt een nieuw startwachtwoord gemaakt en gemaild; het vorige werkt dan niet meer.` : `Nieuw startwachtwoord maken voor ${name}? Het oude wachtwoord werkt dan niet meer en de persoon wordt overal uitgelogd.`)) return;
      const r = await api("POST", `/users/${id}/reset-password`, {});
      S.secret = { title: `Nieuw startwachtwoord voor ${name}`, userLabel: "Inloggen met e-mailadres", site: location.origin + location.pathname, rows: [{ name, username: r.username, password: r.password }], mailed: r.mailed };
      await loadStaff(); flash(null); render(); window.scrollTo(0, 0);
    }),
    staffoff: ({ id, off }) => guard(async () => { await api("POST", `/users/${id}/disable`, { disabled: off === "1" }); flash(off === "1" ? "Account uitgezet." : "Account aangezet."); await loadStaff(); render(); }),
    reset: ({ id, name }) => guard(async () => {
      if (!confirm(`Nieuw wachtwoord maken voor ${name}? Het oude wachtwoord werkt dan niet meer.`)) return;
      const r = await api("POST", `/students/${id}/reset-password`, {});
      S.secret = { title: "Nieuw wachtwoord", userLabel: "Gebruikersnaam", site: APP_URL, rows: [{ name, username: r.username, password: r.password }] };
      flash(null); render(); window.scrollTo(0, 0);
    }),
    studoff: ({ id, off }) => guard(async () => { await api("POST", `/students/${id}/disable`, { disabled: off === "1" }); await loadStudents(); render(); }),
    studdel: ({ id, name }) => guard(async () => {
      if (!confirm(`${name} definitief verwijderen? Dit kan niet ongedaan worden gemaakt.`)) return;
      await api("DELETE", `/students/${id}`); flash(`${name} is verwijderd.`); await loadStudents(); render();
    }),
    showpw: ({ id }) => guard(async () => { const r = await api("GET", `/students/${id}/password`); S.shown[id] = r.password; render(); }),
    hidepw: ({ id }) => { delete S.shown[id]; render(); },
    classcards: () => guard(async () => {
      const r = await api("GET", `/classes/${S.classId}/credentials`);
      const rows = r.students.filter((x) => x.password).map((x) => ({ name: x.name, username: x.username, password: x.password }));
      const missing = r.students.length - rows.length;
      if (!rows.length) { flash("Van deze leerlingen is geen wachtwoord bewaard. Maak eerst een nieuw wachtwoord.", "err"); return render(); }
      S.secret = { title: `Inloggegevens ${r.class.name}`, userLabel: "Gebruikersnaam", site: APP_URL, rows, stored: true, missing };
      flash(null); render(); window.scrollTo(0, 0);
    }),
    print: () => window.print(),
    csv: () => {
      const q = (v) => `"${String(v).replace(/"/g, '""')}"`;
      const lines = [["Naam", S.secret.userLabel, "Wachtwoord"].map(q).join(";"), ...S.secret.rows.map((r) => [r.name, r.username, r.password].map(q).join(";"))];
      const url = URL.createObjectURL(new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" }));
      const a = document.createElement("a"); a.href = url; a.download = "accounts.csv"; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
    },
    closesecret: () => { S.secret = null; render(); },
    progcsv: () => {
      const q = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
      const head = ["Naam", "Gebruikersnaam", "Niveaus Wereld 1", "Sterren", "Spelniveaus", "Munten", "Laatst actief", "Aandacht voor letters"];
      const lines = [head.map(q).join(";"), ...S.progress.map((s) => { const p = s.progress, a = lastSeen(s);
        return [s.display_name, s.username, p ? p.worlds.letter_oasis || 0 : "", p ? p.stars : "", p ? p.mini_done : "", p ? p.coins : "", a ? a.text : "nog nooit", p ? p.weak_letters.join(" ") : ""].map(q).join(";"); })];
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
      S.me.must_change_password = false; await start(); flash("Wachtwoord gewijzigd."); render();
    },
    org: (f) => async () => { await api("POST", "/orgs", { name: f.name.value, code: f.code.value }); flash("Organisatie aangemaakt."); await loadOrgs(); render(); },
    staff: (f) => async () => {
      const r = await api("POST", "/users", { role: f.role.value, name: f.name.value, email: f.email.value, ...(isSuper() ? { org_id: S.orgId } : {}) });
      S.secret = { title: `Account aangemaakt voor ${r.user.display_name}`, userLabel: "Inloggen met e-mailadres", site: location.origin + location.pathname, rows: [{ name: r.user.display_name, username: r.user.username, password: r.password }], mailed: r.mailed, mailTo: r.user.username };
      flash(null); await loadStaff(); render(); window.scrollTo(0, 0);
    },
    class: (f) => async () => { await api("POST", "/classes", { name: f.name.value, ...(isSuper() ? { org_id: S.orgId } : {}) }); flash("Klas aangemaakt."); await loadClasses(); render(); },
    linkorg: (f) => async () => {
      const remove = f.mode.value === "remove";
      await api("POST", `/users/${f.user_id.value}/orgs${remove ? "/remove" : ""}`, { org_id: f.org_id.value });
      flash(remove ? "Account losgemaakt van die organisatie." : "Account gekoppeld. Die persoon kan nu wisselen van organisatie."); await loadStaff(); render();
    },
    assign: (f) => async () => { await api("POST", `/classes/${f.class_id.value}/teachers`, { teacher_id: f.teacher_id.value }); flash("Docent gekoppeld."); render(); },
    students: (f) => async () => {
      const names = f.names.value.split(/\r?\n/).map((n) => n.trim()).filter(Boolean);
      if (!names.length) { flash("Vul minstens één naam in.", "err"); return render(); }
      S.busy = true; render();
      const rows = []; let failed = null;
      try {
        for (let i = 0; i < names.length; i += MAX_BULK) {
          const r = await api("POST", "/students/bulk", { class_id: S.classId, names: names.slice(i, i + MAX_BULK) });
          rows.push(...r.students.map((s) => ({ name: s.name, username: s.username, password: s.password })));
        }
      } catch (e) { failed = e; }
      S.busy = false;
      if (rows.length) S.secret = { title: `${rows.length} leerling${rows.length === 1 ? "" : "en"} aangemaakt`, userLabel: "Gebruikersnaam", site: APP_URL, rows };
      flash(failed ? `Gestopt na ${rows.length} van ${names.length}: ${failed.message}` : null, failed ? "err" : "ok");
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
  $app.addEventListener("change", async (e) => {
    if (e.target.dataset.change === "myorg") {
      const id = e.target.value;
      await guard(async () => {
        await api("POST", "/me/org", { org_id: id });
        S.myOrg = S.myOrgs.find((o) => o.id === id) || null; S.classId = ""; S.progClass = ""; S.secret = null;
        await go(S.tab);
      });
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
      return viewLogin(afterLogin ? "Inloggen lukte, maar je browser bewaart de sessie niet. Sta cookies van deze site toe en probeer opnieuw." : "");
    }
    if (S.me.must_change_password) return viewChangePassword(true);
    await start();
  }
  window.__beheer = { boot, S };
  boot(false);
})();
