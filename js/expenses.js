// Expenses: record spending, see it by month, by day and by category, and keep your own
// lists of categories and payment methods. (This was the whole app before it became a superapp.)
(() => {
const mod = defineModule({
  id: "expenses",
  title: "Expenses",
  tabs: [
    { id: "expenses", label: "Expenses" },
    { id: "dashboard", label: "Dashboard" },
    { id: "categories", label: "Categories" },
    { id: "payments", label: "Payments" }
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
      <p class="empty" id="empty-list">No expenses yet. Add your first one with the form above.</p>
      <ul class="list" id="expense-list"></ul>
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
  </div>`
});

const STORAGE_KEY = "personal-expenses-v1";
const CATEGORY_KEY = "personal-expenses-categories-v1";
const PAYMENT_KEY = "personal-expenses-payment-methods-v1";
// Starting categories; after the first visit, the list you edit in the Categories tab is used instead
const DEFAULT_CATEGORIES = [
  "Food & drinks", "Groceries", "Transport", "Bills & utilities", "Shopping",
  "Health", "Entertainment", "Family", "Other"
];
// Starting payment methods; edit your own list in the Payment methods tab
const DEFAULT_PAYMENT_METHODS = [
  "CASH", "QRIS", "BANK TRANSFER", "CC UOB", "CC MAYBANK", "CC PANIN", "CC BNI Platinum", "CC BNI Titanium"
];

// ---- Data ----
// Everything on screen is drawn from `data`. The `store` functions change it and save the change,
// either to this browser (localStore) or to your account in the online database (cloudStore).
// Each expense looks like:
//   { id, date: "2026-10-05", amount: 25000, category: "Food & drinks", payment_method: "CASH" or null, note: "" }
const data = { expenses: [], categories: [], paymentMethods: [] };

// The two editable lists. Both work the same way: add, rename (also renames it on expenses),
// reorder, and delete when unused.
const LISTS = {
  category: { key: "categories", table: "categories", field: "category", localKey: CATEGORY_KEY,
    defaults: DEFAULT_CATEGORIES, label: "category" },
  payment: { key: "paymentMethods", table: "payment_methods", field: "payment_method", localKey: PAYMENT_KEY,
    defaults: DEFAULT_PAYMENT_METHODS, label: "payment method" }
};
// False only while the online database hasn't been given the payment methods table yet
let paymentsReady = true;

const localStore = {
  async load() {
    data.expenses = readLocal(STORAGE_KEY) || [];
    for (const list of Object.values(LISTS)) {
      const saved = readLocal(list.localKey);
      data[list.key] = Array.isArray(saved) && saved.length ? saved : [...list.defaults];
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
    payment_method: row.payment_method || null, note: row.note || "", created_at: row.created_at };
}
// Load one list for the logged-in person; a brand-new account gets the starting list
async function loadList(list) {
  const res = await sb.from(list.table).select("name, position").order("position");
  check(res);
  data[list.key] = res.data.map(c => c.name);
  if (!data[list.key].length) {
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
  },
  async addExpense(entry) {
    const res = await sb.from("expenses").insert(entry).select().single();
    check(res);
    data.expenses.push(fromRow(res.data));
  },
  async updateExpense(id, entry) {
    check(await sb.from("expenses").update(entry).eq("id", id));
    data.expenses = data.expenses.map(e => e.id === id ? { ...e, ...entry } : e);
  },
  async deleteExpense(id) {
    check(await sb.from("expenses").delete().eq("id", id));
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
const renaming = { category: null, payment: null };    // item being renamed, per list
const listMessage = { category: null, payment: null }; // { name, text } message shown under one item
let selectedPeriod = todayString().slice(0, 7); // "2026-10" or "all"
let selectedDay = null;     // "2026-10-16" when a calendar day is tapped

// ===================== Expenses tab =====================
const form = $("entry-form");
$("date").value = todayString();

// Fill the Category and Payment method dropdowns; `keep` holds the values of an expense being edited
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
  $("payment").value = keep.payment_method || "";
  $("payment-field").hidden = !paymentsReady;
}

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
  const btn = event.target.closest("button[data-action]");
  if (!btn) return;
  const id = btn.closest("li").dataset.id;
  const action = btn.dataset.action;
  if (action === "edit") startEditing(id);
  if (action === "delete") { confirmingId = id; render(); }
  if (action === "keep") { confirmingId = null; render(); }
  if (action === "confirm-delete") deleteExpense(id);
});

// "Thu, 22 Oct" this year, "Thu, 22 Oct 2025" for older years: shorter rows in the list
function listDate(iso) { return iso.startsWith(todayString().slice(0, 4)) ? shortDate(iso) : niceDate(iso); }

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

  $("empty-list").hidden = sorted.length > 0;
  $("expense-list").innerHTML = sorted.map(e => {
    const actions = confirmingId === e.id
      ? `<span class="ask">Delete this expense?</span>
         <button type="button" class="link" data-action="keep">Keep</button>
         <button type="button" class="danger" data-action="confirm-delete">Yes, delete</button>`
      : editDeleteButtons();
    return `<li data-id="${e.id}" class="${editingId === e.id ? "editing" : ""}">
      <div class="what">
        <span class="cat">${escapeHtml(e.category)}</span>
        <span class="meta">${listDate(e.date)}${e.payment_method ? " · " + escapeHtml(e.payment_method) : ""}${e.note ? " · " + escapeHtml(e.note) : ""}</span>
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
        <span class="meta">${[e.payment_method, e.note].filter(Boolean).map(escapeHtml).join(" · ")}</span></div>
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

// ===================== Categories and Payment methods tabs =====================
// Both tabs use the same code; `kind` is "category" or "payment" (see LISTS near the top).
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
  $("payment-missing").hidden = paymentsReady;
  $("payment-form").hidden = !paymentsReady;
};
mod.load = () => store.load();
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
