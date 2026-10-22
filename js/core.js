// Personal Superapp: the shared parts every module uses.
// Each module (To-do, Expenses, Meals, Exercise, Body...) lives in its own file in js/ and calls defineModule().
// To add a module later: write js/<name>.js, add a <script> line for it in index.html,
// and add its tables to supabase-setup.sql.

// ---- Settings ----
const CURRENCY = "IDR"; // Indonesian rupiah; change to another code like "USD" if needed
const LOCALE = "id-ID";  // number style: Rp 150.000

// Online database (Supabase). Fill both in to turn on email login, with separate data per person.
// Leave them empty and the app keeps data in this browser only, with no login.
const SUPABASE_URL = "https://irbtptcuohqzklqkpzzr.supabase.co";
const SUPABASE_KEY = "sb_publishable_6QvgKe1vJBguD_4nL6lWhA_c7Q_i-8T"; // the "publishable" (anon) key; it is meant to be public, the database rules protect the data
const CLOUD = Boolean(SUPABASE_URL && SUPABASE_KEY);
let sb = null; // the Supabase connection, created at start when CLOUD is on

// ---- Helpers ----
const money = new Intl.NumberFormat(LOCALE, { style: "currency", currency: CURRENCY, maximumFractionDigits: 0 });
const plain = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0 });
const compact = new Intl.NumberFormat(LOCALE, { notation: "compact", maximumFractionDigits: 1 });
const one = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 1 });
const $ = id => document.getElementById(id);

function isoDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function todayString() { return isoDate(new Date()); }
function nowTime() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
function parseIso(iso) { const [y, m, d] = iso.split("-").map(Number); return new Date(y, m - 1, d); }
function addDays(iso, n) { const d = parseIso(iso); d.setDate(d.getDate() + n); return isoDate(d); }
function daysBetween(a, b) { return Math.round((parseIso(b) - parseIso(a)) / 86400000); }
// 1 = Monday ... 7 = Sunday
function weekday(iso) { return (parseIso(iso).getDay() + 6) % 7 + 1; }
function weekStart(iso) { return addDays(iso, 1 - weekday(iso)); }
const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7].map(i =>
  new Date(2024, 0, i).toLocaleDateString(undefined, { weekday: "long" })); // 1 Jan 2024 was a Monday

// "25.000" or "Rp 25000" -> 25000. Rupiah has no cents, so every non-digit is ignored.
function parseAmount(text) {
  const digits = String(text).replace(/\D/g, "");
  return digits ? Number(digits) : 0;
}
// "2,5" or "2.5" -> 2.5; empty -> null
function parseNum(text) {
  const s = String(text ?? "").trim().replace(",", ".");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? n : NaN;
}
function niceDate(iso) {
  return parseIso(iso).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}
function shortDate(iso) {
  return parseIso(iso).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}
// "2026-10" -> "October 2026" (or "Oct" with short = true)
function monthName(key, short = false) {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, short ? { month: "short" } : { month: "long", year: "numeric" });
}
function shiftMonth(key, step) {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(y, m - 1 + step, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
function escapeHtml(text) {
  return String(text ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function plural(n, word) { return `${n} ${word}${n === 1 ? "" : "s"}`; }

function readLocal(key) {
  try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
}
function writeLocal(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); }
  catch { throw new Error("This browser is blocking storage (private window?)."); }
}

// Turn a database error into a plain sentence
function check({ error }) {
  if (error) throw new Error(error.message || "The online database didn't respond. Check your internet connection.");
}
// True when the online database hasn't been given a table yet (supabase-setup.sql not re-run)
function isMissingTable(message) {
  return /schema cache|does not exist|could not find the table/i.test(message || "");
}

// Run a save, showing any problem in the given status line instead of failing silently
async function attempt(statusId, action) {
  try { await action(); return true; }
  catch (err) {
    $(statusId).textContent = "Couldn't save: " + err.message;
    $(statusId).classList.add("error");
    return false;
  }
}
function say(statusId, text) {
  $(statusId).classList.remove("error");
  $(statusId).textContent = text;
}

// ---- Table: one list of records, saved online (Supabase) or in this browser ----
// Used by the newer modules. Every row has an `id`; online, the database adds `user_id` itself.
class Table {
  constructor(name) {
    this.name = name;
    this.rows = [];
    this.ready = true; // false while the online database doesn't have this table yet
    this.localKey = "superapp-" + name + "-v1";
  }
  async load() {
    if (!CLOUD) { this.rows = readLocal(this.localKey) || []; return; }
    const res = await sb.from(this.name).select("*");
    if (res.error && isMissingTable(res.error.message)) { this.ready = false; this.rows = []; return; }
    check(res);
    this.rows = res.data;
    this.ready = true;
  }
  saveLocal() { if (!CLOUD) writeLocal(this.localKey, this.rows); }
  // Add one row or a list of rows; returns the saved rows
  async insert(items) {
    const list = Array.isArray(items) ? items : [items];
    if (!list.length) return [];
    let saved;
    if (CLOUD) {
      const res = await sb.from(this.name).insert(list).select();
      check(res);
      saved = res.data;
    } else {
      saved = list.map(r => ({ id: newId(), created_at: new Date().toISOString(), ...r }));
    }
    this.rows.push(...saved);
    this.saveLocal();
    return saved;
  }
  async update(id, patch) {
    if (CLOUD) check(await sb.from(this.name).update(patch).eq("id", id));
    this.rows = this.rows.map(r => r.id === id ? { ...r, ...patch } : r);
    this.saveLocal();
  }
  async remove(id) {
    if (CLOUD) check(await sb.from(this.name).delete().eq("id", id));
    this.rows = this.rows.filter(r => r.id !== id);
    this.saveLocal();
  }
  get(id) { return this.rows.find(r => r.id === id); }
}

// A notice for a module whose tables the online database doesn't have yet
function setupNotice() {
  return `<p class="notice">This part needs one more step in the online database:
    open Supabase → SQL Editor, paste the latest <strong>supabase-setup.sql</strong> and click Run. Then reload this page.</p>`;
}

// ---- Modules ----
// defineModule({ id, title, icon, tabs: [{ id, label }], html }) puts the module's screen on the page
// and returns an object the module fills in with optional hooks:
//   load()        fetch its data after login
//   onEnter(user) runs once the data is loaded
//   render()      redraw its screen from its data
//   home(el)      draw its card on the Home screen into `el`
//   homeSetup(el) runs once, to attach click handlers to that card
const MODULES = [];
const ICONS = {
  home: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/>',
  todo: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 12l3 3 5-6"/>',
  expenses: '<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18M16 15h2"/>',
  meals: '<path d="M7 3v8a2 2 0 0 0 4 0V3M9 11v10M17 3c-2 2-2 6 0 8v10"/>',
  exercise: '<path d="M6 8v8M3 10v4M18 8v8M21 10v4M6 12h12"/>',
  body: '<rect x="4" y="4" width="16" height="16" rx="4"/><path d="M8.5 9.5a5 5 0 0 1 7 0M12 10.5l1.5-2"/>'
};
// Shown next to each module's title
const EMOJI = { home: "🏠", todo: "✅", expenses: "💰", meals: "🍽️", exercise: "💪", body: "⚖️" };
// The line under each module's title, and a friendly line under today's date
const TAGLINE = {
  home: "Your life, healthier and more organized ✨",
  todo: "Keep track of what matters",
  expenses: "Track your spending and manage your money",
  meals: "Log your meals & nutrition",
  exercise: "Stay active, stay healthy",
  body: "Your body numbers and how they change"
};
const MOTTO = {
  home: "A more organized you today! ☀️",
  todo: "One thing at a time. 🎯",
  expenses: "Every rupiah counted. 💸",
  meals: "A healthier you, one meal at a time! 🥗",
  exercise: "A more active you today! 🏃",
  body: "Small steps, real progress. 📈"
};

// A round coloured icon, e.g. in front of a list row. Each name always gets the same of the 8 colours
// ("tones" in app.css), so a page shows several colours instead of only the module's own.
const TONES = ["green", "orange", "violet", "blue", "pink", "teal", "amber", "red"];
function toneFor(text) {
  let h = 0;
  for (const c of String(text)) h = (h * 31 + c.codePointAt(0)) >>> 0;
  return TONES[h % TONES.length];
}
// Emoji and colour for common category names; anything else shows its first letter
const BADGE_WORDS = [
  [/food|makan|drink|minum|resto|cafe|kopi|coffee/i, "🍴", "orange"], [/grocer|belanja|market|sayur/i, "🛒", "green"],
  [/credit|card|kartu|\bcc\b|qris|debit/i, "💳", "violet"], [/transport|bensin|fuel|parkir|\btoll?\b|grab|gojek|taxi|\bcar\b|mobil/i, "🚗", "blue"],
  [/bill|tagihan|listrik|electric|water|\bair\b|internet|phone|pulsa/i, "🧾", "amber"], [/health|doctor|dokter|medic|obat|hospital/i, "🩺", "red"],
  [/school|sekolah|kid|anak|educat|course|book/i, "🎓", "teal"], [/home|rumah|rent|sewa/i, "🏠", "amber"], [/shop|cloth|baju/i, "🛍️", "pink"],
  [/fun|entertain|movie|hobby|game|travel|holiday|liburan/i, "🎉", "pink"], [/gift|hadiah|donat|charity|zakat/i, "🎁", "red"],
  [/insur|asuransi|invest|saving|tabung/i, "🏦", "teal"], [/sport|gym|fitness/i, "🏋️", "green"]
];
function badge(text, emoji, tone) {
  const known = emoji ? [] : BADGE_WORDS.find(([re]) => re.test(text)) || [];
  const face = emoji || known[1] || escapeHtml(String(text).trim().charAt(0).toUpperCase() || "•");
  return `<span class="badge" data-tone="${tone || known[2] || toneFor(text)}" aria-hidden="true">${face}</span>`;
}
// The small pencil and bin buttons at the end of a list row (data-action "edit" and "delete")
const PENCIL = '<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4z"/><path d="M13.5 6.5l4 4"/>';
const BIN = '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/>';
function editDeleteButtons(deleteLabel = "Delete") {
  return `<button type="button" class="icon-btn" data-action="edit" aria-label="Edit" title="Edit"><svg viewBox="0 0 24 24" aria-hidden="true">${PENCIL}</svg></button>` +
    `<button type="button" class="icon-btn del" data-action="delete" aria-label="${deleteLabel}" title="${deleteLabel}"><svg viewBox="0 0 24 24" aria-hidden="true">${BIN}</svg></button>`;
}
function defineModule({ id, title, navLabel, tabs = [], html }) {
  const el = document.createElement("div");
  el.className = "module-view";
  el.id = "module-" + id;
  el.hidden = true;
  const subNav = tabs.length > 1
    ? `<nav class="tabs sub" aria-label="${escapeHtml(title)} sections">${tabs.map(t =>
        `<a href="#${id}/${t.id}" data-tab="${t.id}">${escapeHtml(t.label)}</a>`).join("")}</nav>`
    : "";
  el.innerHTML = subNav + html;
  $("views").appendChild(el);
  const mod = { id, title, navLabel: navLabel || title, tabs, el };
  MODULES.push(mod);
  return mod;
}

function renderAll() {
  for (const m of MODULES) if (m.render) m.render();
}

// ---- Moving between modules: the address ends in #module or #module/tab ----
// Older links (#dashboard, #categories, #payments) still open the matching Expenses tab.
const OLD_LINKS = { dashboard: "expenses/dashboard", categories: "expenses/categories", payments: "expenses/payments" };
function currentRoute() {
  let hash = location.hash.slice(1);
  if (OLD_LINKS[hash]) hash = OLD_LINKS[hash];
  const [modId, tabId] = hash.split("/");
  const mod = MODULES.find(m => m.id === modId) || MODULES[0];
  const tab = mod.tabs.find(t => t.id === tabId) || mod.tabs[0];
  return { mod, tab };
}
let lastRoute = "";
function showRoute() {
  const { mod, tab } = currentRoute();
  MODULES.forEach(m => { m.el.hidden = m !== mod; });
  mod.el.querySelectorAll("[data-panel]").forEach(p => { p.hidden = !tab || p.dataset.panel !== tab.id; });
  mod.el.querySelectorAll("nav.tabs a").forEach(a => {
    if (tab && a.dataset.tab === tab.id) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
  });
  document.querySelectorAll("#module-nav a").forEach(a => {
    if (a.dataset.module === mod.id) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
  });
  // The page takes the colour of the open module (see "Colourful theme" in app.css)
  document.body.className = "m-" + mod.id;
  // Home shows the app's own icon; the other modules their emoji
  $("page-emoji").innerHTML = mod.id === "home" ? `<img src="img/app-icon-192.png" alt="">` : EMOJI[mod.id] || "";
  $("page-title").innerHTML = mod.id === "home"
    ? `Personal <span class="label">Superapp</span>` : escapeHtml(mod.title);
  $("page-tagline").textContent = TAGLINE[mod.id] || "";
  $("motto").textContent = MOTTO[mod.id] || "";
  document.title = mod.id === "home" ? "Personal Superapp" : mod.title + " · Personal Superapp";
  const key = mod.id + "/" + (tab ? tab.id : "");
  if (key !== lastRoute) window.scrollTo(0, 0);
  lastRoute = key;
}
window.addEventListener("hashchange", showRoute);

function buildModuleNav() {
  $("module-nav").innerHTML = `<div class="inner">${MODULES.map(m =>
    `<a href="#${m.id}" data-module="${m.id}" class="m-${m.id}"><svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[m.id] || ICONS.home}</svg>${escapeHtml(m.navLabel)}</a>`
  ).join("")}</div>`;
}

// ---- Theme: Auto follows the device (Windows/phone) setting; Light or Dark overrides it ----
const THEME_KEY = "personal-expenses-theme";
function applyTheme(choice) {
  if (choice === "light" || choice === "dark") document.documentElement.dataset.theme = choice;
  else delete document.documentElement.dataset.theme;
  document.querySelectorAll("[data-theme-choice]").forEach(b =>
    b.setAttribute("aria-checked", String(b.dataset.themeChoice === (choice || "system"))));
}
document.querySelector(".theme-switch").addEventListener("click", event => {
  const btn = event.target.closest("[data-theme-choice]");
  if (!btn) return;
  const choice = btn.dataset.themeChoice;
  try { localStorage.setItem(THEME_KEY, choice); } catch {}
  applyTheme(choice);
});
let savedTheme = "system";
try { savedTheme = localStorage.getItem(THEME_KEY) || "system"; } catch {}
applyTheme(savedTheme);

// ===================== Login (only when the online database is set up) =====================
let signUpMode = false;
function setAuthMode(toSignUp) {
  signUpMode = toSignUp;
  $("auth-heading").textContent = toSignUp ? "Create your account" : "Log in";
  $("auth-submit").textContent = toSignUp ? "Create account" : "Log in";
  $("auth-switch-text").textContent = toSignUp ? "Already have an account?" : "New here?";
  $("auth-switch").textContent = toSignUp ? "Log in" : "Create an account";
  $("auth-password").autocomplete = toSignUp ? "new-password" : "current-password";
  $("auth-status").textContent = "";
}
$("auth-switch").addEventListener("click", () => setAuthMode(!signUpMode));

function friendlyAuthError(message) {
  if (/invalid login credentials/i.test(message)) return "Email or password is wrong.";
  if (/already registered/i.test(message)) return "This email already has an account. Log in instead.";
  if (/email not confirmed/i.test(message)) return "Confirm your email first: open the link Supabase sent you.";
  if (/password/i.test(message) && /6/.test(message)) return "Use a password of at least 6 characters.";
  return message;
}

$("auth-form").addEventListener("submit", async event => {
  event.preventDefault();
  const email = $("auth-email").value.trim();
  const password = $("auth-password").value;
  const status = $("auth-status");
  status.classList.add("error");
  if (!email || !password) { status.textContent = "Enter your email and a password."; return; }
  if (password.length < 6) { status.textContent = "Use a password of at least 6 characters."; return; }
  $("auth-submit").disabled = true;
  status.classList.remove("error");
  status.textContent = signUpMode ? "Creating your account…" : "Logging in…";
  const { data: result, error } = signUpMode
    ? await sb.auth.signUp({ email, password, options: { emailRedirectTo: location.origin + location.pathname } })
    : await sb.auth.signInWithPassword({ email, password });
  $("auth-submit").disabled = false;
  if (error) { status.classList.add("error"); status.textContent = friendlyAuthError(error.message); return; }
  if (!result.session) {
    status.textContent = "Account created. Open the confirmation link in your email, then log in.";
    setTimeout(() => setAuthMode(false), 0);
    return;
  }
  $("auth-password").value = "";
  await enterApp(result.session.user);
});

$("logout-btn").addEventListener("click", async () => {
  await sb.auth.signOut();
  // A fresh page makes sure nothing of this person's data stays on screen
  location.hash = "";
  location.reload();
});

// Which big screen is showing: "loading", "login" or "app"
function showScreen(name, message) {
  $("loading").hidden = name !== "loading";
  if (message) $("loading").textContent = message;
  $("view-login").hidden = name !== "login";
  $("app").hidden = name !== "app";
  $("module-nav").hidden = name !== "app";
  // The login screen shows the big welcome picture (see body.login in app.css)
  document.body.classList.toggle("login", name === "login");
  if (name === "app") showRoute();
}

async function enterApp(user) {
  showScreen("loading", "Loading your data…");
  try {
    await Promise.all(MODULES.map(m => m.load ? m.load() : null));
  } catch (err) {
    showScreen("loading", "Couldn't load your data: " + err.message + " Reload the page to try again.");
    return;
  }
  $("user-email").textContent = user ? user.email : "";
  if (user) {
    // "albert.lee@…" -> "Hi, Albert" and the initials "AL"
    const parts = user.email.split("@")[0].split(/[^a-zA-Z]+/).filter(Boolean);
    const first = parts[0] || "there";
    $("user-hi").textContent = "Hi, " + first.charAt(0).toUpperCase() + first.slice(1);
    $("user-initials").textContent = ((parts[0] || "?").charAt(0) + (parts[1] || parts[0] || "").charAt(parts[1] ? 0 : 1)).toUpperCase();
  }
  $("account-bar").hidden = !user;
  // With an account menu next to the date, the theme switch lives inside that menu
  if (user) $("me-menu").insertBefore(document.querySelector(".theme-switch"), $("logout-btn"));
  for (const m of MODULES) if (m.onEnter) m.onEnter(user);
  showScreen("app");
  renderAll();
}

// ===================== Start =====================
async function start() {
  $("today").textContent =
    new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  $("storage-note").textContent = CLOUD
    ? "Data is saved in your account, so it's the same on every device you log in from."
    : "Data is saved in this browser only.";
  buildModuleNav();
  if (!CLOUD) { await enterApp(null); return; }
  if (!window.supabase) {
    showScreen("loading", "Couldn't reach the login service. Check your internet connection and reload.");
    return;
  }
  // A confirmation link that failed comes back as #error=...; show it in words instead of a blank page
  const linkError = new URLSearchParams(location.hash.slice(1)).get("error_description");
  if (linkError) history.replaceState(null, "", location.pathname);
  sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  const { data: { session } } = await sb.auth.getSession();
  if (session) await enterApp(session.user);
  else {
    setAuthMode(false);
    showScreen("login");
    if (linkError) {
      $("auth-status").classList.add("error");
      $("auth-status").textContent = "That email link didn't work (" + linkError + "). Try logging in, or ask for a new link.";
    }
  }
}
