// Expenses: record spending, see it by month, by day and by category, and keep your own
// lists of categories, payment methods and locations. An expense can also point to a "post" (a car, a house...),
// optionally with a counter reading such as the odometer. (This was the whole app before it became a superapp.)
(() => {
const mod = defineModule({
  id: "expenses",
  title: "Expenses",
  tabs: [
    { id: "expenses", label: "Expenses" },
    { id: "dashboard", label: "Dashboard" },
    { id: "posts", label: "Posts" },
    { id: "categories", label: "Categories" },
    { id: "payments", label: "Payments" },
    { id: "locations", label: "Locations" }
  ],
  html: `
  <div class="view" data-panel="expenses">
  <div class="import-banner" id="import-banner" hidden>
    <p>This browser still has <strong id="import-count"></strong> saved from before login existed.
      Import them into your account? Only do this if they are your expenses.</p>
    <div class="actions">
      <button type="button" class="primary" id="import-btn">Import into my account</button>
      <button type="button" class="link" id="import-dismiss">Not now</button>
      <span class="hint" id="import-status" role="status"></span>
    </div>
  </div>
    <section aria-labelledby="month-heading">
      <div class="total">
        <div class="total-text">
          <span class="eyebrow" id="month-heading">Spent this month</span>
          <span class="amount" id="month-total">Rp 0</span>
          <span class="muted" id="entry-count">No expenses recorded yet.</span>
        </div>
        <div class="total-side">
          <span class="month-pill" id="month-pill"></span>
          <!-- The last 7 months, this month on the right; the full chart is on the Dashboard tab -->
          <a class="mini-bars" id="month-mini" href="#expenses/dashboard" aria-label="Open the Dashboard"></a>
        </div>
      </div>
    </section>

    <section aria-labelledby="add-heading">
      <h2 id="add-heading" data-icon="➕" data-tone="green">Add an expense</h2>
      <form class="entry" id="entry-form" novalidate>
        <div class="field">
          <label for="amount">Amount (Rp)</label>
          <input id="amount" name="amount" inputmode="numeric" autocomplete="off" placeholder="25.000" required>
          <span class="hint" id="amount-hint"></span>
        </div>
        <div class="field">
          <label for="date">Date</label>
          <input id="date" name="date" type="date" required>
        </div>
        <div class="field wide">
          <label for="category">Category</label>
          <select id="category" name="category"></select>
        </div>
        <div class="field wide" id="payment-field">
          <label for="payment">Payment method (optional)</label>
          <select id="payment" name="payment"></select>
        </div>
        <div class="field wide" id="location-field">
          <label for="location">Location (optional)</label>
          <input id="location" name="location" list="location-options" maxlength="40" autocomplete="off" placeholder="Pick one or type a new place">
          <datalist id="location-options"></datalist>
          <span class="hint" id="location-hint"></span>
        </div>
        <div class="field wide" id="post-field" hidden>
          <label for="post">Post (optional)</label>
          <select id="post" name="post"></select>
        </div>
        <div class="field wide" id="counter-field" hidden>
          <label for="counter" id="counter-label">Counter</label>
          <input id="counter" name="counter" inputmode="decimal" autocomplete="off">
          <span class="hint" id="counter-hint"></span>
        </div>
        <div class="field wide">
          <label for="note">Note (optional)</label>
          <input id="note" name="note" maxlength="120" autocomplete="off" placeholder="Nasi goreng at lunch">
        </div>
        <div class="actions">
          <button type="submit" class="primary" id="save-btn">Add expense</button>
          <button type="button" id="cancel-btn" hidden>Cancel editing</button>
          <span class="hint" id="form-status" role="status"></span>
        </div>
      </form>
    </section>

    <section aria-labelledby="list-heading">
      <h2 id="list-heading" data-icon="🕘" data-tone="violet">Recent expenses</h2>
      <p class="muted small" id="list-tip">Each day shows what you spent; tap a day to see its expenses.</p>
      <p class="empty" id="empty-list">No expenses yet. Add your first one with the form above.</p>
      <div class="day-list" id="expense-list"></div>
      <button type="button" id="expense-more" hidden>Show older days</button>
    </section>
  </div>

  <!-- ===== Dashboard tab ===== -->
  <div class="view" data-panel="dashboard" hidden>
    <section class="panel" aria-labelledby="by-month-heading">
      <div class="panel-head">
        <h2 id="by-month-heading" data-icon="📊" data-tone="green">Expenses by month</h2>
        <span class="muted" style="font-size:13px">Last 12 months · tap a month to see its categories</span>
      </div>
      <div class="month-chart" id="month-chart">
        <div class="y-axis" id="y-axis"></div>
        <div class="plot" id="plot"></div>
        <div class="x-axis" id="x-axis"></div>
        <div class="tooltip" id="tooltip" hidden></div>
      </div>
    </section>

    <section class="panel" aria-labelledby="cal-heading">
      <div class="panel-head">
        <div>
          <h2 id="cal-heading" data-icon="📅" data-tone="blue">Daily calendar</h2>
          <span class="muted" style="font-size:13px">Total spent each day · tap a day to see its expenses</span>
        </div>
        <span class="figure" id="cal-total"></span>
      </div>
      <div class="cal-nav">
        <button type="button" id="cal-prev" aria-label="Previous month">‹</button>
        <strong id="cal-month" aria-live="polite"></strong>
        <button type="button" id="cal-next" aria-label="Next month">›</button>
      </div>
      <div class="calendar" id="calendar"></div>
      <div class="day-detail" id="day-detail" hidden></div>
    </section>

    <section class="panel" aria-labelledby="by-cat-heading">
      <div class="panel-head">
        <div>
          <h2 id="by-cat-heading" data-icon="🏷️" data-tone="orange">Expenses by category</h2>
          <span class="muted" style="font-size:13px" id="cat-period-label"></span>
        </div>
        <span class="figure" id="cat-period-total"></span>
      </div>
      <div class="field">
        <label for="period">Period</label>
        <select id="period"></select>
      </div>
      <p class="empty" id="cat-empty" hidden>No expenses in this period.</p>
      <ul class="cat-bars" id="cat-bars"></ul>
    </section>
  </div>

  <!-- ===== Posts tab ===== -->
  <div class="view" data-panel="posts" hidden>
    <div id="posts-missing" hidden>${setupNotice()}</div>
    <section class="panel" id="post-chart-panel" aria-labelledby="post-chart-heading">
      <div class="panel-head">
        <div>
          <h2 id="post-chart-heading" data-icon="📈" data-tone="blue">Cost per post by month</h2>
          <span class="muted small">Last 12 months · hover or tap a month to read it</span>
        </div>
        <div class="seg" role="group" aria-label="Chart type" id="post-chart-type">
          <button type="button" data-type="bar" aria-pressed="true">Bar</button>
          <button type="button" data-type="line" aria-pressed="false">Line</button>
        </div>
      </div>
      <div class="field">
        <label for="post-pick">Show</label>
        <select id="post-pick"></select>
      </div>
      <div class="post-legend" id="post-legend"></div>
      <div id="post-chart"></div>
      <p class="post-readout" id="post-readout" aria-live="polite"></p>
    </section>

    <section class="panel" id="post-sum-panel" aria-labelledby="post-sum-heading">
      <h2 id="post-sum-heading" data-icon="🧮" data-tone="teal">Post summary</h2>
      <p class="muted small">Usage is the difference between the first and the last counter reading of the last 12 months,
        and the cost per unit is what you spent over that stretch divided by it.</p>
      <div class="table-wrap"><table class="post-table" id="post-table"></table></div>
    </section>

    <section aria-labelledby="post-add-heading">
      <h2 id="post-add-heading" data-icon="📌" data-tone="orange">Add a post</h2>
      <p class="muted small">A post is something you keep spending on, like a car or a house. When you add an expense,
        you can link it to a post, and posts with a counter also ask for the reading (odometer, electricity meter…).</p>
      <form class="entry" id="post-form" novalidate>
        <div class="field wide">
          <label for="post-name">Name</label>
          <input id="post-name" maxlength="40" autocomplete="off" placeholder="e.g. Car B 1234 XY">
        </div>
        <label class="check-line"><input type="checkbox" id="post-needs"> Ask for a counter reading with each expense</label>
        <div class="field" id="post-label-field" hidden>
          <label for="post-counter-label">Counter name</label>
          <input id="post-counter-label" maxlength="30" autocomplete="off" placeholder="Odometer">
        </div>
        <div class="field" id="post-unit-field" hidden>
          <label for="post-unit">Unit</label>
          <input id="post-unit" maxlength="12" autocomplete="off" placeholder="km">
        </div>
        <div class="actions">
          <button type="submit" class="primary" id="post-save">Add post</button>
          <button type="button" id="post-cancel" hidden>Cancel editing</button>
          <span class="hint" id="post-status" role="status"></span>
        </div>
      </form>
    </section>

    <section aria-labelledby="post-list-heading">
      <h2 id="post-list-heading" data-icon="🗂️" data-tone="violet">Your posts</h2>
      <p class="muted small">A post can only be deleted when no expense uses it.</p>
      <p class="empty" id="post-empty">No posts yet. Add your first one with the form above.</p>
      <ul class="cat-admin" id="post-admin"></ul>
    </section>
  </div>

  <!-- ===== Categories tab ===== -->
  <div class="view" data-panel="categories" hidden>
    <section aria-labelledby="category-add-heading" style="display:grid;gap:12px">
      <h2 id="category-add-heading" data-icon="🏷️" data-tone="orange">Add a category</h2>
      <form class="inline-form" id="category-form" novalidate>
        <input id="category-new" maxlength="40" autocomplete="off" placeholder="e.g. Kids' school" aria-label="New category name">
        <button type="submit" class="primary">Add category</button>
      </form>
      <span class="hint" id="category-status" role="status"></span>
    </section>
    <section aria-labelledby="category-list-heading">
      <h2 id="category-list-heading" data-icon="📂" data-tone="amber">Your categories</h2>
      <p class="muted" style="font-size:14px">Renaming a category also updates the expenses that use it. A category can only be deleted when no expense uses it.</p>
      <ul class="cat-admin" id="category-admin"></ul>
    </section>
  </div>

  <!-- ===== Payment methods tab ===== -->
  <div class="view" data-panel="payments" hidden>
    <p class="notice" id="payment-missing" hidden>Payment methods need one more step in the online database:
      open Supabase → SQL Editor, paste the latest <strong>supabase-setup.sql</strong> and click Run. Then reload this page.</p>
    <section aria-labelledby="payment-add-heading" style="display:grid;gap:12px">
      <h2 id="payment-add-heading" data-icon="💳" data-tone="violet">Add a payment method</h2>
      <form class="inline-form" id="payment-form" novalidate>
        <input id="payment-new" maxlength="40" autocomplete="off" placeholder="e.g. CC BCA" aria-label="New payment method name">
        <button type="submit" class="primary">Add payment method</button>
      </form>
      <span class="hint" id="payment-status" role="status"></span>
    </section>
    <section aria-labelledby="payment-list-heading">
      <h2 id="payment-list-heading" data-icon="👛" data-tone="blue">Your payment methods</h2>
      <p class="muted" style="font-size:14px">Renaming a payment method also updates the expenses that use it. A payment method can only be deleted when no expense uses it.</p>
      <ul class="cat-admin" id="payment-admin"></ul>
    </section>
  </div>

  <!-- ===== Locations tab ===== -->
  <div class="view" data-panel="locations" hidden>
    <p class="notice" id="location-missing" hidden>Locations need one more step in the online database:
      open Supabase → SQL Editor, paste the latest <strong>supabase-setup.sql</strong> and click Run. Then reload this page.</p>
    <section aria-labelledby="location-add-heading" style="display:grid;gap:12px">
      <h2 id="location-add-heading" data-icon="📍" data-tone="pink">Add a location</h2>
      <form class="inline-form" id="location-form" novalidate>
        <input id="location-new" maxlength="40" autocomplete="off" placeholder="e.g. Indomaret Kemang" aria-label="New location name">
        <button type="submit" class="primary">Add location</button>
      </form>
      <span class="hint" id="location-status" role="status"></span>
    </section>
    <section aria-labelledby="location-list-heading">
      <h2 id="location-list-heading" data-icon="🗺️" data-tone="teal">Your locations</h2>
      <p class="muted" style="font-size:14px">A new place typed in the expense form is added here by itself. Renaming a location also updates the expenses that use it. A location can only be deleted when no expense uses it.</p>
      <ul class="cat-admin" id="location-admin"></ul>
    </section>
  </div>`
});

const STORAGE_KEY = "personal-expenses-v1";
const CATEGORY_KEY = "personal-expenses-categories-v1";
const PAYMENT_KEY = "personal-expenses-payment-methods-v1";
const LOCATION_KEY = "personal-expenses-locations-v1";
// Starting categories; after the first visit, the list you edit in the Categories tab is used instead
const DEFAULT_CATEGORIES = [
  "Food & drinks", "Groceries", "Transport", "Bills & utilities", "Shopping",
  "Health", "Entertainment", "Family", "Other"
];
// Starting payment methods; edit your own list in the Payment methods tab
const DEFAULT_PAYMENT_METHODS = [
  "CASH", "QRIS", "BANK TRANSFER", "CC UOB", "CC MAYBANK", "CC PANIN", "CC BNI Platinum", "CC BNI Titanium"
];
// A new expense starts with this payment method selected, when it is in the list
const DEFAULT_PAYMENT = "QRIS";

// ---- Data ----
// Everything on screen is drawn from `data`. The `store` functions change it and save the change,
// either to this browser (localStore) or to your account in the online database (cloudStore).
// Each expense looks like:
//   { id, date: "2026-10-05", amount: 25000, category: "Food & drinks", payment_method: "CASH" or null, note: "",
//     location: "Indomaret Kemang" or null, post_id: id of a post or null, counter: 45210 or null }
const data = { expenses: [], categories: [], paymentMethods: [], locations: [] };

// The editable lists. They all work the same way: add, rename (also renames it on expenses),
// reorder, and delete when unused.
const LISTS = {
  category: { key: "categories", table: "categories", field: "category", localKey: CATEGORY_KEY,
    defaults: DEFAULT_CATEGORIES, label: "category" },
  payment: { key: "paymentMethods", table: "payment_methods", field: "payment_method", localKey: PAYMENT_KEY,
    defaults: DEFAULT_PAYMENT_METHODS, label: "payment method" },
  location: { key: "locations", table: "locations", field: "location", localKey: LOCATION_KEY,
    defaults: [], label: "location" }
};
// False only while the online database hasn't been given the payment methods / locations table yet
let paymentsReady = true;
let locationsReady = true;

// Posts: things you keep spending on (a car, a house...). Each is { id, name, needs_counter,
// counter_label: "Odometer", counter_unit: "km" }; an expense points to one with post_id.
const posts = new Table("posts");
function postsSorted() { return [...posts.rows].sort((a, b) => (a.created_at || "").localeCompare(b.created_at || "")); }
function postOf(e) { return e.post_id ? posts.get(e.post_id) : null; }
const counterFmt = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 2 });
function counterText(post, value) { return counterFmt.format(value) + (post && post.counter_unit ? " " + post.counter_unit : ""); }
// "45.210" or "1.234,5" -> 45210 or 1234.5: dots group thousands and a comma starts the decimals, like the amounts
function parseCounter(text) {
  const s = String(text).replace(/[\s.]/g, "").replace(",", ".");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? n : NaN;
}
// "Car B 1234 XY (45.210 km)" for a list row, or "" when the expense has no post
function postLabel(e) {
  const post = postOf(e);
  if (!post) return "";
  return post.name + (e.counter != null ? ` (${counterText(post, e.counter)})` : "");
}
// The newest counter reading of a post, leaving out the expense being edited
function lastReading(postId, skipId) {
  return data.expenses.filter(e => e.post_id === postId && e.counter != null && e.id !== skipId)
    .sort((a, b) => b.date.localeCompare(a.date) || b.counter - a.counter)[0] || null;
}

const localStore = {
  async load() {
    data.expenses = readLocal(STORAGE_KEY) || [];
    for (const list of Object.values(LISTS)) {
      const saved = readLocal(list.localKey);
      data[list.key] = Array.isArray(saved) && (saved.length || !list.defaults.length) ? saved : [...list.defaults];
    }
  },
  saveAll() {
    writeLocal(STORAGE_KEY, data.expenses);
    for (const list of Object.values(LISTS)) writeLocal(list.localKey, data[list.key]);
  },
  async addExpense(entry) { data.expenses.push({ id: newId(), ...entry }); this.saveAll(); },
  async updateExpense(id, entry) {
    data.expenses = data.expenses.map(e => e.id === id ? { ...e, ...entry } : e); this.saveAll();
  },
  async deleteExpense(id) { data.expenses = data.expenses.filter(e => e.id !== id); this.saveAll(); },
  async addItem(kind, name) { data[LISTS[kind].key].push(name); this.saveAll(); },
  async renameItem(kind, oldName, newName) {
    const { key, field } = LISTS[kind];
    data[key] = data[key].map(c => c === oldName ? newName : c);
    data.expenses = data.expenses.map(e => e[field] === oldName ? { ...e, [field]: newName } : e);
    this.saveAll();
  },
  async deleteItem(kind, name) { const { key } = LISTS[kind]; data[key] = data[key].filter(c => c !== name); this.saveAll(); },
  async reorderItems(kind, list) { data[LISTS[kind].key] = list; this.saveAll(); }
};

function fromRow(row) {
  return { id: row.id, date: row.date, amount: Number(row.amount), category: row.category,
    payment_method: row.payment_method || null, location: row.location || null, note: row.note || "", created_at: row.created_at,
    post_id: row.post_id || null, counter: row.counter == null ? null : Number(row.counter) };
}
// Load one list for the logged-in person; a brand-new account gets the starting list
async function loadList(list) {
  const res = await sb.from(list.table).select("name, position").order("position");
  check(res);
  data[list.key] = res.data.map(c => c.name);
  if (!data[list.key].length && list.defaults.length) {
    check(await sb.from(list.table).insert(list.defaults.map((name, position) => ({ name, position }))));
    data[list.key] = [...list.defaults];
  }
}

const cloudStore = {
  async load() {
    // "*" so expenses still load if the payment_method column hasn't been added yet
    const ex = await sb.from("expenses").select("*");
    check(ex);
    data.expenses = ex.data.map(fromRow);
    await loadList(LISTS.category);
    try {
      await loadList(LISTS.payment);
      paymentsReady = true;
    } catch (err) {
      // The payment_methods table doesn't exist yet: keep the rest of the app working
      if (!/payment_methods|schema cache|does not exist/i.test(err.message)) throw err;
      paymentsReady = false;
      data.paymentMethods = [];
    }
    try {
      await loadList(LISTS.location);
      locationsReady = true;
    } catch (err) {
      // The locations table doesn't exist yet (the latest supabase-setup.sql hasn't been run)
      if (!/locations|schema cache|does not exist/i.test(err.message)) throw err;
      locationsReady = false;
      data.locations = [];
    }
  },
  async addExpense(entry) {
    const res = await online(() => sb.from("expenses").insert(entry).select().single());
    check(res);
    data.expenses.push(fromRow(res.data));
  },
  async updateExpense(id, entry) {
    check(await online(() => sb.from("expenses").update(entry).eq("id", id)));
    data.expenses = data.expenses.map(e => e.id === id ? { ...e, ...entry } : e);
  },
  async deleteExpense(id) {
    check(await online(() => sb.from("expenses").delete().eq("id", id)));
    data.expenses = data.expenses.filter(e => e.id !== id);
  },
  async addItem(kind, name) {
    const { key, table } = LISTS[kind];
    check(await sb.from(table).insert({ name, position: data[key].length }));
    data[key].push(name);
  },
  async renameItem(kind, oldName, newName) {
    const { key, table, field } = LISTS[kind];
    check(await sb.from(table).update({ name: newName }).eq("name", oldName));
    check(await sb.from("expenses").update({ [field]: newName }).eq(field, oldName));
    data[key] = data[key].map(c => c === oldName ? newName : c);
    data.expenses = data.expenses.map(e => e[field] === oldName ? { ...e, [field]: newName } : e);
  },
  async deleteItem(kind, name) {
    const { key, table } = LISTS[kind];
    check(await sb.from(table).delete().eq("name", name));
    data[key] = data[key].filter(c => c !== name);
  },
  async reorderItems(kind, list) {
    const { key, table } = LISTS[kind];
    const results = await Promise.all(list.map((name, position) =>
      sb.from(table).update({ position }).eq("name", name)));
    results.forEach(check);
    data[key] = list;
  },
  // Copy expenses saved in this browser (before login existed) into the account
  async importLocal(expenses, categories) {
    const missing = categories.filter(c => !data.categories.includes(c));
    if (missing.length) {
      check(await sb.from("categories").insert(missing.map((name, i) => ({ name, position: data.categories.length + i }))));
      data.categories.push(...missing);
    }
    const rows = expenses.map(e => ({ date: e.date, amount: e.amount, category: e.category, note: e.note || "" }));
    const res = await sb.from("expenses").insert(rows).select();
    check(res);
    data.expenses.push(...res.data.map(fromRow));
  }
};

const store = CLOUD ? cloudStore : localStore;

// ---- State ----
let editingId = null;       // expense being edited, or null when adding
let confirmingId = null;    // expense waiting for "Yes, delete"
const renaming = { category: null, payment: null, location: null };    // item being renamed, per list
const listMessage = { category: null, payment: null, location: null }; // { name, text } message shown under one item
let selectedPeriod = todayString().slice(0, 7); // "2026-10" or "all"
let selectedDay = null;     // "2026-10-16" when a calendar day is tapped
const openDays = new Set(); // days opened in the Recent expenses list
let daysShown = 20;         // how many days the Recent expenses list shows

// ===================== Expenses tab =====================
const form = $("entry-form");
$("date").value = todayString();

// Fill the Category, Payment method and Location fields; `keep` holds the values of an expense being edited
function fillSelects(keep = {}) {
  const cats = [...data.categories];
  // An expense being edited may use an item that was since removed from the list; keep it selectable
  if (keep.category && !cats.includes(keep.category)) cats.push(keep.category);
  $("category").innerHTML = cats.map(c => `<option>${escapeHtml(c)}</option>`).join("");
  if (keep.category) $("category").value = keep.category;

  const methods = [...data.paymentMethods];
  if (keep.payment_method && !methods.includes(keep.payment_method)) methods.push(keep.payment_method);
  $("payment").innerHTML = `<option value="">Not set</option>` +
    methods.map(c => `<option>${escapeHtml(c)}</option>`).join("");
  // A new expense starts on QRIS; an expense being edited keeps what it had, even "Not set"
  $("payment").value = keep.id ? keep.payment_method || "" : methods.includes(DEFAULT_PAYMENT) ? DEFAULT_PAYMENT : "";
  $("payment-field").hidden = !paymentsReady;

  // Suggestions under the Location box; typing a name that isn't in the list adds it on save
  $("location-options").innerHTML = data.locations.map(c => `<option value="${escapeHtml(c)}"></option>`).join("");
  $("location").value = keep.location || "";
  $("location-hint").textContent = "";
  $("location-field").hidden = !locationsReady;

  const list = postsSorted();
  $("post").innerHTML = `<option value="">None</option>` +
    list.map(p => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join("");
  $("post").value = keep.post_id && posts.get(keep.post_id) ? keep.post_id : "";
  $("post-field").hidden = !posts.ready || !list.length;
  $("counter").value = keep.counter == null ? "" : counterFmt.format(keep.counter);
  updateCounterField();
}

// The counter field only shows for a post that asks for a reading, with the last reading as a reminder
function updateCounterField() {
  const post = posts.get($("post").value);
  const show = Boolean(post && post.needs_counter);
  $("counter-field").hidden = !show;
  $("counter-hint").classList.remove("error");
  if (!show) return;
  $("counter-label").textContent = (post.counter_label || "Counter") + (post.counter_unit ? ` (${post.counter_unit})` : "");
  const last = lastReading(post.id, editingId);
  $("counter-hint").textContent = last
    ? `Last reading: ${counterText(post, last.counter)} on ${dayLabel(last.date)}.`
    : "This is the first reading for this post.";
}
$("post").addEventListener("change", updateCounterField);

// Show the amount with thousand separators as you type: 25000 -> 25.000
$("amount").addEventListener("input", () => {
  const n = parseAmount($("amount").value);
  $("amount").value = n ? plain.format(n) : "";
  $("amount-hint").textContent = "";
  $("amount-hint").classList.remove("error");
});

form.addEventListener("submit", async event => {
  event.preventDefault();
  $("form-status").classList.remove("error");
  const amount = parseAmount($("amount").value);
  if (!amount) {
    $("amount-hint").textContent = "Enter an amount above 0.";
    $("amount-hint").classList.add("error");
    $("amount").focus();
    return;
  }
  const entry = {
    date: $("date").value || todayString(),
    amount,
    category: $("category").value,
    note: $("note").value.trim()
  };
  if (paymentsReady) entry.payment_method = $("payment").value || null;
  if (locationsReady) {
    // Use the saved spelling of a known place; a new place is added to the Locations list first
    const typed = $("location").value.trim().replace(/\s+/g, " ");
    const known = data.locations.find(c => c.toLowerCase() === typed.toLowerCase());
    if (typed && !known && !await attempt("form-status", () => store.addItem("location", typed))) return;
    entry.location = known || typed || null;
  }
  if (posts.ready) {
    const post = posts.get($("post").value);
    entry.post_id = post ? post.id : null;
    entry.counter = null;
    if (post && post.needs_counter) {
      const reading = parseCounter($("counter").value);
      if (reading == null || Number.isNaN(reading)) {
        $("counter-hint").textContent = `Enter the ${(post.counter_label || "counter").toLowerCase()} reading, e.g. 45210.`;
        $("counter-hint").classList.add("error");
        $("counter").focus();
        return;
      }
      entry.counter = reading;
    }
  }
  const wasEditing = Boolean(editingId);
  $("save-btn").disabled = true;
  const ok = await attempt("form-status", () =>
    wasEditing ? store.updateExpense(editingId, entry) : store.addExpense(entry));
  $("save-btn").disabled = false;
  if (!ok) return;
  resetForm();
  $("form-status").textContent = wasEditing ? "Changes saved." : `Added ${money.format(entry.amount)}.`;
  render();
});

$("cancel-btn").addEventListener("click", () => { resetForm(); render(); });

function resetForm() {
  editingId = null;
  $("amount").value = "";
  $("note").value = "";
  $("date").value = todayString();
  fillSelects();
  $("save-btn").textContent = "Add expense";
  $("cancel-btn").hidden = true;
  $("add-heading").textContent = "Add an expense";
  $("form-status").textContent = "";
  $("form-status").classList.remove("error");
}

function startEditing(id) {
  const e = data.expenses.find(x => x.id === id);
  if (!e) return;
  editingId = id;
  confirmingId = null;
  $("amount").value = plain.format(e.amount);
  $("date").value = e.date;
  fillSelects(e);
  $("note").value = e.note || "";
  $("save-btn").textContent = "Save changes";
  $("cancel-btn").hidden = false;
  $("add-heading").textContent = "Edit expense";
  $("form-status").textContent = "";
  render();
  form.scrollIntoView({ behavior: "smooth", block: "start" });
  $("amount").focus({ preventScroll: true });
}

async function deleteExpense(id) {
  if (!await attempt("form-status", () => store.deleteExpense(id))) return;
  if (editingId === id) resetForm();
  confirmingId = null;
  $("form-status").textContent = "Expense deleted.";
  render();
}

$("expense-list").addEventListener("click", event => {
  if (toggleDay(event, openDays)) { render(); return; }
  const btn = event.target.closest("button[data-action]");
  if (!btn) return;
  const id = btn.closest("li").dataset.id;
  const action = btn.dataset.action;
  if (action === "edit") startEditing(id);
  if (action === "delete") { confirmingId = id; render(); }
  if (action === "keep") { confirmingId = null; render(); }
  if (action === "confirm-delete") deleteExpense(id);
});

$("expense-more").addEventListener("click", () => { daysShown += 20; render(); });

function renderExpenses(expenses) {
  const monthPrefix = todayString().slice(0, 7);
  const thisMonth = expenses.filter(e => e.date.startsWith(monthPrefix));
  const total = thisMonth.reduce((sum, e) => sum + e.amount, 0);
  $("month-total").textContent = money.format(total);
  $("entry-count").textContent = thisMonth.length
    ? `${thisMonth.length} expense${thisMonth.length === 1 ? "" : "s"} this month.`
    : "No expenses recorded this month yet.";
  $("month-pill").textContent = monthName(monthPrefix);
  const recent = last12Months().slice(-7).map(key =>
    expenses.filter(e => e.date.startsWith(key)).reduce((sum, e) => sum + e.amount, 0));
  const top = Math.max(...recent, 1);
  $("month-mini").innerHTML = recent.map((v, i) =>
    `<span style="height:${Math.max(8, v / top * 100)}%"${i === recent.length - 1 ? ' class="now"' : ""}></span>`).join("");

  // Newest date first; for the same date, the most recently added first
  const sorted = expenses.map((e, i) => ({ e, i }))
    .sort((a, b) => b.e.date.localeCompare(a.e.date) ||
      (b.e.created_at || "").localeCompare(a.e.created_at || "") || b.i - a.i)
    .map(x => x.e);

  // Level 1: one row per day with its total; level 2: that day's expenses, once the day is opened
  const byDay = {};
  sorted.forEach(e => { (byDay[e.date] = byDay[e.date] || []).push(e); });
  const days = Object.keys(byDay).sort().reverse();
  // The expense being edited or deleted stays visible
  [editingId, confirmingId].forEach(id => { const e = id && expenses.find(x => x.id === id); if (e) openDays.add(e.date); });
  $("empty-list").hidden = days.length > 0;
  $("list-tip").hidden = !days.length;
  $("expense-more").hidden = days.length <= daysShown;
  $("expense-list").innerHTML = days.slice(0, daysShown).map(day => {
    const list = byDay[day];
    const open = openDays.has(day);
    const total = list.reduce((s, e) => s + e.amount, 0);
    return `<div class="day-group${open ? " open" : ""}">
      ${dayRow(day, open, escapeHtml(plural(list.length, "expense")), money.format(total))}
      ${open ? `<ul class="list">${expenseRows(list)}</ul>` : ""}</div>`;
  }).join("");
}

function expenseRows(list) {
  return list.map(e => {
    const actions = confirmingId === e.id
      ? `<span class="ask">Delete this expense?</span>
         <button type="button" class="link" data-action="keep">Keep</button>
         <button type="button" class="danger" data-action="confirm-delete">Yes, delete</button>`
      : editDeleteButtons();
    return `<li data-id="${e.id}" class="${editingId === e.id ? "editing" : ""}">
      <div class="what">
        <span class="cat">${escapeHtml(e.category)}</span>
        <span class="meta">${[e.payment_method, e.location, postLabel(e), e.note].filter(Boolean).map(escapeHtml).join(" · ") || "&nbsp;"}</span>
      </div>
      <span class="price">${money.format(e.amount)}</span>
      <div class="row-actions">${actions}</div>
    </li>`;
  }).join("");
}

// ===================== Dashboard tab =====================
// The 12 months ending with the current month, oldest first: ["2025-11", ..., "2026-10"]
function last12Months() {
  const now = new Date();
  const keys = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return keys;
}
// Round the top of the axis up to a clean number: 1, 2, 2.5 or 5 times a power of ten
function niceMax(value) {
  if (value <= 0) return 100000;
  const power = Math.pow(10, Math.floor(Math.log10(value)));
  for (const step of [1, 2, 2.5, 5, 10]) if (step * power >= value) return step * power;
}

function renderMonthChart(expenses) {
  const months = last12Months();
  const totals = Object.fromEntries(months.map(m => [m, 0]));
  expenses.forEach(e => { const k = e.date.slice(0, 7); if (k in totals) totals[k] += e.amount; });
  const top = niceMax(Math.max(...Object.values(totals)));
  const ticks = [0, top / 2, top];

  $("y-axis").innerHTML = ticks.map(t => `<span style="bottom:${(t / top) * 100}%">${compact.format(t)}</span>`).join("");
  $("plot").innerHTML =
    ticks.map(t => `<div class="gridline${t === 0 ? " baseline" : ""}" style="bottom:${(t / top) * 100}%"></div>`).join("") +
    `<div class="cols">${months.map(m => `
      <button type="button" class="col${m === selectedPeriod ? " selected" : ""}" data-month="${m}"
        aria-label="${monthName(m)}: ${money.format(totals[m])}">
        <span class="bar" style="height:${(totals[m] / top) * 100}%"></span>
      </button>`).join("")}</div>`;
  $("x-axis").innerHTML = months.map(m =>
    `<span class="${m === selectedPeriod ? "selected" : ""}">${monthName(m, true).slice(0, 3)}</span>`).join("");
  $("plot").dataset.totals = JSON.stringify(totals);
}

// Hover tooltip and tap-to-select on the month columns
$("plot").addEventListener("mouseover", event => {
  const col = event.target.closest(".col");
  if (!col) return;
  const totals = JSON.parse($("plot").dataset.totals || "{}");
  const tip = $("tooltip");
  tip.textContent = `${monthName(col.dataset.month)} · ${money.format(totals[col.dataset.month] || 0)}`;
  const chartBox = $("month-chart").getBoundingClientRect();
  const colBox = col.getBoundingClientRect();
  const bar = col.querySelector(".bar").getBoundingClientRect();
  const x = colBox.left + colBox.width / 2 - chartBox.left;
  tip.style.left = Math.min(Math.max(x, 70), chartBox.width - 70) + "px";
  tip.style.top = (bar.top - chartBox.top - 6) + "px";
  tip.hidden = false;
});
$("plot").addEventListener("mouseleave", () => { $("tooltip").hidden = true; });
$("plot").addEventListener("click", event => {
  const col = event.target.closest(".col");
  if (!col) return;
  selectedPeriod = col.dataset.month;
  selectedDay = null;
  render();
});
$("period").addEventListener("change", () => { selectedPeriod = $("period").value; selectedDay = null; render(); });

function renderCategoryChart(expenses) {
  // Period choices: all time, plus every month that has expenses, plus the current month
  const monthsWithData = new Set(expenses.map(e => e.date.slice(0, 7)));
  monthsWithData.add(todayString().slice(0, 7));
  if (selectedPeriod !== "all") monthsWithData.add(selectedPeriod);
  const options = [...monthsWithData].sort().reverse();
  $("period").innerHTML = options.map(m => `<option value="${m}">${monthName(m)}</option>`).join("") +
    `<option value="all">All time</option>`;
  $("period").value = selectedPeriod;

  const inPeriod = selectedPeriod === "all" ? expenses : expenses.filter(e => e.date.startsWith(selectedPeriod));
  const byCat = {};
  inPeriod.forEach(e => { byCat[e.category] = (byCat[e.category] || 0) + e.amount; });
  const rows = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
  const total = rows.reduce((s, [, v]) => s + v, 0);
  const biggest = rows.length ? rows[0][1] : 1;

  $("cat-period-label").textContent = selectedPeriod === "all" ? "All time" : monthName(selectedPeriod);
  $("cat-period-total").textContent = money.format(total);
  $("cat-empty").hidden = rows.length > 0;
  $("cat-bars").innerHTML = rows.map(([name, value]) => `
    <li title="${escapeHtml(name)}: ${money.format(value)}">
      <div class="line">
        <span>${escapeHtml(name)}</span>
        <span class="val">${money.format(value)} <span class="pct">${Math.round((value / total) * 100)}%</span></span>
      </div>
      <div class="track"><div class="fill" style="width:${(value / biggest) * 100}%"></div></div>
    </li>`).join("");
}

// ---- Daily calendar: one cell per day of the month, showing what was spent that day ----
// It shows the month chosen above (or this month when "All time" is chosen); ‹ › move it.
const dayCompact = new Intl.NumberFormat(LOCALE, { notation: "compact", maximumSignificantDigits: 3 }); // 150 rb, 1,55 jt
function calendarMonth() { return selectedPeriod === "all" ? todayString().slice(0, 7) : selectedPeriod; }

function renderCalendar(expenses) {
  const month = calendarMonth();
  const [y, m] = month.split("-").map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const blanks = (new Date(y, m - 1, 1).getDay() + 6) % 7; // weeks start on Monday
  const totals = {}, counts = {};
  expenses.forEach(e => {
    if (!e.date.startsWith(month + "-")) return;
    totals[e.date] = (totals[e.date] || 0) + e.amount;
    counts[e.date] = (counts[e.date] || 0) + 1;
  });
  const biggest = Math.max(0, ...Object.values(totals));
  const today = todayString();

  $("cal-month").textContent = monthName(month);
  $("cal-total").textContent = money.format(Object.values(totals).reduce((s, v) => s + v, 0));
  // 1 Jan 2024 was a Monday, so these are Mon..Sun in the browser's language
  const weekdays = [0, 1, 2, 3, 4, 5, 6].map(i =>
    `<span class="wd">${new Date(2024, 0, 1 + i).toLocaleDateString(undefined, { weekday: "short" })}</span>`);
  const cells = [];
  for (let i = 0; i < blanks; i++) cells.push(`<span class="day blank"></span>`);
  for (let d = 1; d <= daysInMonth; d++) {
    const iso = `${month}-${String(d).padStart(2, "0")}`;
    const total = totals[iso] || 0;
    // Busier days get a stronger green; days with nothing stay plain
    const shade = total ? `background: color-mix(in srgb, var(--accent) ${Math.round(10 + 35 * total / biggest)}%, var(--sheet))` : "";
    const label = `${niceDate(iso)}: ${total ? `${money.format(total)}, ${counts[iso]} expense${counts[iso] === 1 ? "" : "s"}` : "no expenses"}`;
    cells.push(`<button type="button" class="day${iso === today ? " today" : ""}${iso === selectedDay ? " selected" : ""}"
      data-day="${iso}" style="${shade}" title="${label}" aria-label="${label}">
      <span class="num">${d}</span><span class="amt">${total ? dayCompact.format(total) : ""}</span></button>`);
  }
  $("calendar").innerHTML = weekdays.join("") + cells.join("");

  // Under the calendar: the expenses of the tapped day
  const detail = $("day-detail");
  const dayItems = selectedDay && selectedDay.startsWith(month + "-") ? expenses.filter(e => e.date === selectedDay) : null;
  detail.hidden = !dayItems;
  if (!dayItems) return;
  detail.innerHTML = `<strong>${niceDate(selectedDay)} · ${money.format(totals[selectedDay] || 0)}</strong>` +
    (dayItems.length ? `<ul class="list">${dayItems.map(e => `<li>
      <div class="what"><span class="cat">${escapeHtml(e.category)}</span>
        <span class="meta">${[e.payment_method, e.location, postLabel(e), e.note].filter(Boolean).map(escapeHtml).join(" · ")}</span></div>
      <span class="price">${money.format(e.amount)}</span></li>`).join("")}</ul>`
      : `<p class="muted">No expenses on this day.</p>`);
}

$("calendar").addEventListener("click", event => {
  const day = event.target.closest("[data-day]");
  if (!day) return;
  selectedDay = selectedDay === day.dataset.day ? null : day.dataset.day;
  render();
});
$("cal-prev").addEventListener("click", () => { selectedPeriod = shiftMonth(calendarMonth(), -1); selectedDay = null; render(); });
$("cal-next").addEventListener("click", () => { selectedPeriod = shiftMonth(calendarMonth(), 1); selectedDay = null; render(); });

// ===================== Posts tab =====================
let editingPostId = null;   // post being edited in the form, or null when adding
let postMessage = null;     // { id, text } shown under one post in the list
let postPick = "all";       // which post the chart shows: "all" or a post id
let postChartType = "bar";  // "bar" or "line"
let postMonth = 11;         // the month read out under the chart (0 = oldest of the 12)
let postChart = null;       // what the chart drew last time, for the read-out

function showCounterFields() {
  const on = $("post-needs").checked;
  $("post-label-field").hidden = !on;
  $("post-unit-field").hidden = !on;
}
$("post-needs").addEventListener("change", showCounterFields);

function resetPostForm() {
  editingPostId = null;
  $("post-name").value = "";
  $("post-needs").checked = false;
  $("post-counter-label").value = "";
  $("post-unit").value = "";
  showCounterFields();
  $("post-save").textContent = "Add post";
  $("post-cancel").hidden = true;
  $("post-add-heading").textContent = "Add a post";
}
$("post-cancel").addEventListener("click", () => { resetPostForm(); $("post-status").textContent = ""; render(); });

$("post-form").addEventListener("submit", async event => {
  event.preventDefault();
  $("post-status").classList.remove("error");
  const name = $("post-name").value.trim();
  if (!name) { $("post-status").textContent = "Type a name for the post."; $("post-name").focus(); return; }
  if (posts.rows.some(p => p.id !== editingPostId && p.name.toLowerCase() === name.toLowerCase())) {
    $("post-status").textContent = `"${name}" already exists.`;
    return;
  }
  const needs = $("post-needs").checked;
  const row = {
    name, needs_counter: needs,
    counter_label: needs ? $("post-counter-label").value.trim() : "",
    counter_unit: needs ? $("post-unit").value.trim() : ""
  };
  const wasEditing = Boolean(editingPostId);
  const ok = await attempt("post-status", () => wasEditing ? posts.update(editingPostId, row) : posts.insert(row));
  if (!ok) return;
  resetPostForm();
  $("post-status").textContent = wasEditing ? "Changes saved." : `Added "${name}". You can pick it when you add an expense.`;
  if (!editingId) fillSelects();
  render();
});

$("post-admin").addEventListener("click", async event => {
  const btn = event.target.closest("button[data-action]");
  if (!btn) return;
  const post = posts.get(btn.closest("li").dataset.id);
  if (!post) return;
  postMessage = null;
  if (btn.dataset.action === "edit") {
    editingPostId = post.id;
    $("post-name").value = post.name;
    $("post-needs").checked = Boolean(post.needs_counter);
    $("post-counter-label").value = post.counter_label || "";
    $("post-unit").value = post.counter_unit || "";
    showCounterFields();
    $("post-save").textContent = "Save changes";
    $("post-cancel").hidden = false;
    $("post-add-heading").textContent = "Edit post";
    $("post-status").textContent = "";
    $("post-form").scrollIntoView({ behavior: "smooth", block: "center" });
    $("post-name").focus({ preventScroll: true });
    render();
  }
  if (btn.dataset.action === "delete") {
    const uses = data.expenses.filter(e => e.post_id === post.id).length;
    if (uses) {
      postMessage = { id: post.id, text: `${plural(uses, "expense")} ${uses === 1 ? "uses" : "use"} this post. Move ${uses === 1 ? "it" : "them"} to another post (or None) first.` };
      render();
      return;
    }
    if (!await attempt("post-status", () => posts.remove(post.id))) return;
    if (editingPostId === post.id) resetPostForm();
    if (postPick === post.id) postPick = "all";
    $("post-status").textContent = `Deleted "${post.name}".`;
    if (!editingId) fillSelects();
    render();
  }
});

$("post-pick").addEventListener("change", () => { postPick = $("post-pick").value; render(); });
$("post-chart-type").addEventListener("click", event => {
  const btn = event.target.closest("[data-type]");
  if (!btn) return;
  postChartType = btn.dataset.type;
  render();
});

// Series colours, always in this order, picked so neighbours stay apart for colour-blind eyes too.
// A post keeps its colour (by its place in your list), whatever the chart shows.
const SERIES_TONES = ["blue", "orange", "teal", "violet", "amber", "pink"];
function postTone(post) { return SERIES_TONES[postsSorted().indexOf(post) % SERIES_TONES.length]; }

// Money per month for one post, over the 12 months of the chart
function monthlyCost(expenses, postIds, months) {
  const totals = Object.fromEntries(months.map(m => [m, 0]));
  expenses.forEach(e => {
    const k = e.date.slice(0, 7);
    if (k in totals && postIds.includes(e.post_id)) totals[k] += e.amount;
  });
  return months.map(m => totals[m]);
}

// The chart's lines or bars: one per post when showing all posts (the five biggest, the rest as "Other")
function postSeries(expenses, months) {
  const list = postsSorted();
  if (postPick !== "all") {
    const post = posts.get(postPick);
    return post ? [{ name: post.name, tone: postTone(post), values: monthlyCost(expenses, [post.id], months) }] : [];
  }
  const all = list.map(p => ({ name: p.name, tone: postTone(p), id: p.id, values: monthlyCost(expenses, [p.id], months) }))
    .map(s => ({ ...s, total: s.values.reduce((a, b) => a + b, 0) }))
    .filter(s => s.total > 0)
    .sort((a, b) => b.total - a.total);
  if (all.length <= 6) return all;
  const rest = all.slice(5);
  return [...all.slice(0, 5), { name: "Other", tone: "other", values: monthlyCost(expenses, rest.map(s => s.id), months) }];
}

const PC = { W: 360, H: 200, left: 44, right: 6, top: 10, bottom: 22 };
// A bar with only its top corners rounded
function barPath(x, y, w, h, round) {
  if (h <= 0) return "";
  const r = round ? Math.min(4, h, w / 2) : 0;
  return `M${x},${y + h}V${y + r}${r ? `Q${x},${y} ${x + r},${y}` : ""}H${x + w - r}${r ? `Q${x + w},${y} ${x + w},${y + r}` : ""}V${y + h}Z`;
}

function renderPostChart(expenses) {
  const months = last12Months();
  const series = postSeries(expenses, months);
  const stacked = postChartType === "bar";
  const monthTotals = months.map((m, i) => series.reduce((s, x) => s + x.values[i], 0));
  const peak = stacked ? Math.max(0, ...monthTotals) : Math.max(0, ...series.flatMap(s => s.values));
  const top = niceMax(peak);
  const { W, H, left, right, top: padTop, bottom } = PC;
  const plotW = W - left - right, plotH = H - padTop - bottom;
  const slot = plotW / months.length;
  const x = i => left + slot * i + slot / 2;
  const y = v => padTop + plotH - (v / top) * plotH;

  let marks = "";
  if (stacked) {
    const w = Math.min(16, slot * 0.6);
    months.forEach((m, i) => {
      let base = 0;
      const parts = series.map(s => ({ s, v: s.values[i] })).filter(p => p.v > 0);
      parts.forEach((p, j) => {
        const y0 = y(base), y1 = y(base + p.v);
        // A 2px gap between stacked pieces
        const h = Math.max(0, y0 - y1 - (j ? 2 : 0));
        marks += `<path class="pc-${p.s.tone}" d="${barPath(x(i) - w / 2, y1, w, h, j === parts.length - 1)}"/>`;
        base += p.v;
      });
    });
  } else {
    series.forEach(s => {
      const d = s.values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
      marks += `<g class="pc-${s.tone}"><path class="ln" d="${d}"/>` +
        s.values.map((v, i) => `<circle cx="${x(i).toFixed(1)}" cy="${y(v).toFixed(1)}" r="3.5"/>`).join("") + `</g>`;
    });
  }
  const ticks = [0, top / 2, top];
  $("post-chart").innerHTML = `<svg viewBox="0 0 ${W} ${H}" class="post-svg" role="img" aria-label="Cost per post by month, last 12 months">
    ${ticks.map(t => `<line class="grid${t ? "" : " base"}" x1="${left}" x2="${W - right}" y1="${y(t)}" y2="${y(t)}"/>
      <text class="tick" x="${left - 6}" y="${y(t) + 3.5}" text-anchor="end">${compact.format(t)}</text>`).join("")}
    <rect class="hl-band" x="${left + slot * postMonth}" y="${padTop}" width="${slot}" height="${plotH}"/>
    ${marks}
    ${months.map((m, i) => `<text class="tick${i === postMonth ? " on" : ""}" x="${x(i)}" y="${H - 6}" text-anchor="middle">${monthName(m, true)}</text>`).join("")}
    ${months.map((m, i) => `<rect class="hit" data-i="${i}" x="${left + slot * i}" y="0" width="${slot}" height="${H}"/>`).join("")}
  </svg>`;
  $("post-legend").innerHTML = series.length > 1 || postPick === "all"
    ? series.map(s => `<span><i class="pc-${s.tone}"></i>${escapeHtml(s.name)}</span>`).join("") : "";
  postChart = { months, series, monthTotals };
  renderPostReadout();
}

// Under the chart: the numbers of one month (the latest, or the one hovered or tapped)
function renderPostReadout() {
  const { months, series, monthTotals } = postChart;
  if (!series.length) {
    $("post-readout").textContent = postPick === "all"
      ? "No expenses linked to a post in the last 12 months yet. Pick a post when you add an expense."
      : "No expenses for this post in the last 12 months.";
    return;
  }
  const i = postMonth;
  const parts = series.filter(s => s.values[i] > 0)
    .map(s => `<span><i class="pc-${s.tone}"></i>${escapeHtml(s.name)} <strong>${money.format(s.values[i])}</strong></span>`);
  $("post-readout").innerHTML = `<span><strong>${monthName(months[i])}</strong> · ${money.format(monthTotals[i])}</span>` +
    (series.length > 1 && parts.length ? `<span class="parts">${parts.join("")}</span>` : "");
}

function pickPostMonth(event) {
  const hit = event.target.closest(".hit");
  if (!hit || Number(hit.dataset.i) === postMonth) return;
  postMonth = Number(hit.dataset.i);
  renderPostChart(data.expenses);
}
$("post-chart").addEventListener("click", pickPostMonth);
$("post-chart").addEventListener("pointermove", event => { if (event.pointerType === "mouse") pickPostMonth(event); });

// Per post: this month, the change from last month, the 12-month total, and for posts with a counter
// how much was used (km, kWh...) and what one unit cost
function postStats(post, expenses, months) {
  const values = monthlyCost(expenses, [post.id], months);
  const stats = { now: values[11], before: values[10], year: values.reduce((a, b) => a + b, 0), usage: null, perUnit: null };
  if (!post.needs_counter) return stats;
  const start = months[0] + "-01";
  const readings = expenses.filter(e => e.post_id === post.id && e.counter != null)
    .sort((a, b) => a.date.localeCompare(b.date) || a.counter - b.counter);
  const inWindow = readings.filter(e => e.date >= start);
  const first = readings.filter(e => e.date < start).pop() || inWindow[0];
  const last = inWindow[inWindow.length - 1];
  if (!first || !last || first === last) return stats;
  stats.usage = last.counter - first.counter;
  // What was spent after the first reading, up to and including the last one
  const spent = expenses.filter(e => e.post_id === post.id && e.date > first.date && e.date <= last.date)
    .reduce((s, e) => s + e.amount, 0);
  if (stats.usage > 0 && spent > 0) stats.perUnit = spent / stats.usage;
  return stats;
}
function changeText(now, before) {
  if (!before) return now ? "new" : "–";
  const pct = Math.round((now - before) / before * 100);
  return pct === 0 ? "same" : `${pct > 0 ? "▲" : "▼"} ${Math.abs(pct)}%`;
}

function renderPostTable(expenses) {
  const months = last12Months();
  const rows = postsSorted().map(post => {
    const st = postStats(post, expenses, months);
    const unit = post.counter_unit ? " " + escapeHtml(post.counter_unit) : "";
    return `<tr>
      <th scope="row"><i class="pc-${postTone(post)}"></i>${escapeHtml(post.name)}</th>
      <td>${money.format(st.now)}</td>
      <td class="chg">${changeText(st.now, st.before)}</td>
      <td>${money.format(st.year)}</td>
      <td>${st.usage == null ? "–" : counterFmt.format(st.usage) + unit}</td>
      <td>${st.perUnit == null ? "–" : money.format(st.perUnit) + (unit ? " /" + unit.trim() : "")}</td>
    </tr>`;
  });
  $("post-table").innerHTML = `<thead><tr><th scope="col">Post</th><th scope="col">${monthName(months[11], true)}</th>
    <th scope="col">vs ${monthName(months[10], true)}</th><th scope="col">12 months</th>
    <th scope="col">Usage</th><th scope="col">Cost per unit</th></tr></thead><tbody>${rows.join("")}</tbody>`;
}

function renderPostAdmin(expenses) {
  const list = postsSorted();
  $("post-empty").hidden = list.length > 0;
  $("post-admin").innerHTML = list.map(post => {
    const uses = expenses.filter(e => e.post_id === post.id).length;
    const last = post.needs_counter ? lastReading(post.id) : null;
    const facts = [
      post.needs_counter ? `${post.counter_label || "Counter"}${post.counter_unit ? " in " + post.counter_unit : ""}` : "No counter",
      uses ? plural(uses, "expense") : "Not used yet",
      last ? "last " + counterText(post, last.counter) : ""
    ].filter(Boolean).map(escapeHtml).join(" · ");
    const msg = postMessage && postMessage.id === post.id ? `<span class="msg">${escapeHtml(postMessage.text)}</span>` : "";
    return `<li data-id="${post.id}" class="${editingPostId === post.id ? "editing" : ""}">
      <div class="who"><span class="name">${escapeHtml(post.name)}</span><span class="uses">${facts}</span></div>
      <div class="cat-actions">${editDeleteButtons()}</div>${msg}</li>`;
  }).join("");
}

function renderPosts(expenses) {
  $("posts-missing").hidden = posts.ready;
  $("post-form").hidden = !posts.ready;
  const any = posts.ready && posts.rows.length > 0;
  $("post-chart-panel").hidden = !any;
  $("post-sum-panel").hidden = !any;
  renderPostAdmin(expenses);
  if (!any) return;
  if (postPick !== "all" && !posts.get(postPick)) postPick = "all";
  $("post-pick").innerHTML = `<option value="all">All posts</option>` +
    postsSorted().map(p => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join("");
  $("post-pick").value = postPick;
  document.querySelectorAll("#post-chart-type [data-type]").forEach(b =>
    b.setAttribute("aria-pressed", String(b.dataset.type === postChartType)));
  renderPostChart(expenses);
  renderPostTable(expenses);
}

// ===================== Categories, Payment methods and Locations tabs =====================
// These tabs use the same code; `kind` is "category", "payment" or "location" (see LISTS near the top).
function afterListChange() { if (!editingId) fillSelects(); render(); }

Object.keys(LISTS).forEach(kind => {
  const { key, label } = LISTS[kind];
  const status = kind + "-status";

  $(kind + "-form").addEventListener("submit", async event => {
    event.preventDefault();
    $(status).classList.remove("error");
    const name = $(kind + "-new").value.trim();
    if (!name) { $(status).textContent = `Type a name for the new ${label}.`; return; }
    if (data[key].some(c => c.toLowerCase() === name.toLowerCase())) {
      $(status).textContent = `"${name}" already exists.`;
      return;
    }
    if (!await attempt(status, () => store.addItem(kind, name))) return;
    $(kind + "-new").value = "";
    $(status).textContent = `Added "${name}". It's now in the ${label} list when you add an expense.`;
    afterListChange();
  });

  $(kind + "-admin").addEventListener("click", event => {
    const btn = event.target.closest("button[data-action]");
    if (!btn) return;
    const name = btn.closest("li").dataset.name;
    const action = btn.dataset.action;
    listMessage[kind] = null;
    if (action === "rename") { renaming[kind] = name; render(); $(kind + "-rename")?.focus(); }
    if (action === "cancel-rename") { renaming[kind] = null; render(); }
    if (action === "save-rename") renameItem(kind, name, $(kind + "-rename").value.trim());
    if (action === "delete") deleteItem(kind, name);
    if (action === "up" || action === "down") moveItem(kind, name, action === "up" ? -1 : 1);
  });
  $(kind + "-admin").addEventListener("keydown", event => {
    if (event.target.id === kind + "-rename" && event.key === "Enter") {
      event.preventDefault();
      renameItem(kind, renaming[kind], event.target.value.trim());
    }
  });
});

async function renameItem(kind, oldName, newName) {
  const list = data[LISTS[kind].key];
  if (!newName) { listMessage[kind] = { name: oldName, text: "The name can't be empty." }; render(); return; }
  if (newName !== oldName && list.some(c => c.toLowerCase() === newName.toLowerCase() && c !== oldName)) {
    listMessage[kind] = { name: oldName, text: `"${newName}" already exists.` }; render(); return;
  }
  // Also moves existing expenses over to the new name
  if (newName !== oldName && !await attempt(kind + "-status", () => store.renameItem(kind, oldName, newName))) return;
  renaming[kind] = null;
  $(kind + "-status").textContent = `Renamed "${oldName}" to "${newName}".`;
  afterListChange();
}

async function deleteItem(kind, name) {
  const { key, field, label } = LISTS[kind];
  const uses = data.expenses.filter(e => e[field] === name).length;
  if (uses) {
    listMessage[kind] = { name, text: `${uses} expense${uses === 1 ? " uses" : "s use"} this ${label}. Rename it, or move those expenses to another ${label} first.` };
    render();
    return;
  }
  if (kind === "category" && data[key].length === 1) { listMessage[kind] = { name, text: "Keep at least one category." }; render(); return; }
  if (!await attempt(kind + "-status", () => store.deleteItem(kind, name))) return;
  $(kind + "-status").textContent = `Deleted "${name}".`;
  afterListChange();
}

async function moveItem(kind, name, step) {
  const list = [...data[LISTS[kind].key]];
  const i = list.indexOf(name), j = i + step;
  if (j < 0 || j >= list.length) return;
  [list[i], list[j]] = [list[j], list[i]];
  if (!await attempt(kind + "-status", () => store.reorderItems(kind, list))) return;
  afterListChange();
}

function renderListAdmin(kind, expenses) {
  const { key, field } = LISTS[kind];
  const list = data[key];
  const counts = {};
  expenses.forEach(e => { if (e[field]) counts[e[field]] = (counts[e[field]] || 0) + 1; });
  const message = listMessage[kind];
  $(kind + "-admin").innerHTML = list.map((c, i) => {
    const safe = escapeHtml(c);
    const msg = message && message.name === c ? `<span class="msg">${escapeHtml(message.text)}</span>` : "";
    if (renaming[kind] === c) {
      return `<li data-name="${safe}">
        <input id="${kind}-rename" value="${safe}" maxlength="40" aria-label="New name for ${safe}">
        <button type="button" class="primary" data-action="save-rename">Save</button>
        <button type="button" class="link" data-action="cancel-rename">Cancel</button>${msg}</li>`;
    }
    const n = counts[c] || 0;
    return `<li data-name="${safe}">
      <div class="who">
        <span class="name">${safe}</span>
        <span class="uses">${n ? `${n} expense${n === 1 ? "" : "s"}` : "Not used yet"}</span>
      </div>
      <div class="cat-actions">
      <button type="button" class="link" data-action="up" aria-label="Move ${safe} up" ${i === 0 ? "disabled" : ""}>↑</button>
      <button type="button" class="link" data-action="down" aria-label="Move ${safe} down" ${i === list.length - 1 ? "disabled" : ""}>↓</button>
      <button type="button" class="link" data-action="rename">Rename</button>
      <button type="button" class="link del" data-action="delete">Delete</button>
      </div>${msg}</li>`;
  }).join("");
}

// ---- Bring over expenses that were saved in this browser before login existed ----
const IMPORTED_KEY = "personal-expenses-imported-by";
function offerImport(user) {
  const local = readLocal(STORAGE_KEY) || [];
  const alreadyImported = readLocal(IMPORTED_KEY);
  const show = CLOUD && user && local.length > 0 && !alreadyImported;
  $("import-banner").hidden = !show;
  if (show) $("import-count").textContent = `${local.length} expense${local.length === 1 ? "" : "s"}`;
}
$("import-btn").addEventListener("click", async () => {
  const local = readLocal(STORAGE_KEY) || [];
  const localCats = readLocal(CATEGORY_KEY) || [];
  const cats = [...new Set([...localCats, ...local.map(e => e.category)])];
  $("import-btn").disabled = true;
  const ok = await attempt("import-status", () => cloudStore.importLocal(local, cats));
  $("import-btn").disabled = false;
  if (!ok) return;
  // Remember the import, so the same expenses are never offered to another account on this browser
  const { data: { user } } = await sb.auth.getUser();
  writeLocal(IMPORTED_KEY, user ? user.email : true);
  $("import-banner").hidden = true;
  $("form-status").textContent = `Imported ${local.length} expenses into your account.`;
  fillSelects();
  render();
});
$("import-dismiss").addEventListener("click", () => { $("import-banner").hidden = true; });

// ===================== Draw everything =====================
// Any change redraws the whole app, so the Home card stays up to date too
function render() { renderAll(); }

mod.render = () => {
  const expenses = data.expenses;
  renderExpenses(expenses);
  renderMonthChart(expenses);
  renderCategoryChart(expenses);
  renderCalendar(expenses);
  renderListAdmin("category", expenses);
  renderListAdmin("payment", expenses);
  renderListAdmin("location", expenses);
  renderPosts(expenses);
  $("payment-missing").hidden = paymentsReady;
  $("payment-form").hidden = !paymentsReady;
  $("location-missing").hidden = locationsReady;
  $("location-form").hidden = !locationsReady;
};
mod.load = () => Promise.all([store.load(), posts.load()]);
mod.onEnter = user => { offerImport(user); resetForm(); };

// ---- Home card: what was spent today and this month ----
mod.home = card => {
  const today = todayString();
  const month = today.slice(0, 7);
  const sum = list => list.reduce((s, e) => s + e.amount, 0);
  const todays = data.expenses.filter(e => e.date === today);
  const monthTotal = sum(data.expenses.filter(e => e.date.startsWith(month)));
  card.innerHTML = `
    <div class="panel-head"><h2>Expenses</h2><a href="#expenses">Add expense</a></div>
    <div class="lines">
      <span class="muted small">Spent today</span>
      <span class="big">${money.format(sum(todays))}</span>
      <span class="muted small">${todays.length ? plural(todays.length, "expense") + " today · " : ""}${money.format(monthTotal)} this month</span>
    </div>`;
};
})();
