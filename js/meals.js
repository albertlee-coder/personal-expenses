// Meals: record what you eat and drink, with rough sugar, carbohydrate, saturated fat, cholesterol and protein
// numbers, and a monthly report that says whether the month leaned high in sugar or in cholesterol, and low in protein.
// My foods (table `foods`) holds the foods and drinks you usually have, with their numbers per serving.
// Each record (table `meals`) keeps its own copy of the numbers, so editing a food later doesn't change history:
//   { id, date: "2026-10-18", time: "12:30", food_id, name: "Nasi putih", servings: 1,
//     sugar_g, carbs_g, sat_fat_g, cholesterol_mg, protein_g (totals for those servings), note }
(() => {
  // The daily guides the report compares against. `good` = comfortable, `limit` = above this is high.
  // Protein works the other way round: `goal` is what to reach each day, and less than that is low.
  const NUTRIENTS = [
    { key: "sugar_g", label: "Sugar", short: "sugar", unit: "g", good: 25, limit: 50, side: "sugar",
      why: "WHO advice: under 50 g of sugar a day, ideally under 25 g." },
    { key: "carbs_g", label: "Carbohydrates", short: "carbs", unit: "g", good: 180, limit: 230, side: "sugar",
      why: "Rice, noodles, bread and sweets turn into blood sugar too. A common guide when watching blood sugar is about 45–60 g per meal." },
    { key: "sat_fat_g", label: "Saturated fat", short: "sat. fat", unit: "g", good: 13, limit: 20, side: "chol",
      why: "Saturated fat (fried food, santan, fatty meat, butter) raises LDL cholesterol the most. Heart guidelines: under 20 g a day, about 13 g when cholesterol is high." },
    { key: "cholesterol_mg", label: "Cholesterol", short: "chol.", unit: "mg", good: 200, limit: 300, side: "chol",
      why: "Cholesterol in food (egg yolk, offal, shrimp, squid). A common limit is 300 mg a day, 200 mg when cholesterol is high." },
    { key: "protein_g", label: "Protein", short: "protein", unit: "g", goal: 60, side: "protein",
      why: "Indonesia's daily guide (AKG): about 65 g of protein for men and 60 g for women; more on days you train hard." }
  ];
  const KEYS = NUTRIENTS.map(n => n.key);

  // Starting list of common foods, per serving. These are rough averages: adjust them in My foods,
  // and use the nutrition label for packaged drinks and snacks.
  const DEFAULT_FOODS = [
    ["Nasi putih", "1 plate (~150 g)", "food", 0, 42, 0.1, 0, 4],
    ["Nasi goreng", "1 plate", "food", 4, 60, 4, 120, 12],
    ["Mie goreng instan", "1 pack", "food", 5, 55, 8, 0, 8],
    ["Roti tawar", "2 slices", "food", 3, 26, 0.4, 0, 5],
    ["Telur (rebus/ceplok)", "1 egg", "food", 0.6, 0.6, 1.6, 186, 6],
    ["Ayam goreng", "1 piece with skin", "food", 0, 5, 4, 100, 20],
    ["Rendang daging", "1 piece (~70 g)", "food", 2, 4, 7, 60, 15],
    ["Sate ayam", "10 sticks with sauce", "food", 8, 15, 5, 110, 25],
    ["Bakso", "1 bowl", "food", 3, 30, 6, 50, 15],
    ["Soto ayam", "1 bowl, no rice", "food", 2, 10, 3, 60, 15],
    ["Udang", "100 g", "food", 0, 1, 0.3, 190, 20],
    ["Ikan bakar", "1 piece (~100 g)", "food", 1, 2, 1, 60, 22],
    ["Tempe goreng", "2 pieces", "food", 0, 8, 2, 0, 10],
    ["Tahu goreng", "2 pieces", "food", 0, 4, 1.5, 0, 6],
    ["Sayur (tumis/bening)", "1 bowl", "food", 3, 6, 0.5, 0, 2],
    ["Gorengan", "1 piece", "food", 3, 15, 3, 5, 2],
    ["Martabak manis", "1 slice", "food", 15, 30, 5, 25, 5],
    ["Pisang", "1 banana", "food", 14, 27, 0.1, 0, 1.3],
    ["Es teh manis", "1 glass", "drink", 25, 25, 0, 0, 0],
    ["Kopi susu gula aren", "1 cup (~250 ml)", "drink", 28, 30, 4, 15, 5],
    ["Kopi hitam tanpa gula", "1 cup", "drink", 0, 0, 0, 0, 0],
    ["Susu UHT full cream", "1 box (250 ml)", "drink", 12, 12, 5, 25, 8],
    ["Air putih", "1 glass", "drink", 0, 0, 0, 0, 0]
  ].map(([name, serving, kind, sugar_g, carbs_g, sat_fat_g, cholesterol_mg, protein_g]) =>
    ({ name, serving, kind, sugar_g, carbs_g, sat_fat_g, cholesterol_mg, protein_g }));

  const nutrientFields = (prefix, cls) => NUTRIENTS.map(n => `
        <div class="field">
          <label for="${prefix}-${n.key}">${n.label} (${n.unit})</label>
          <input id="${prefix}-${n.key}" ${cls ? `class="${cls}" data-key="${n.key}"` : ""} inputmode="decimal" autocomplete="off" placeholder="0">
        </div>`).join("");

  const mod = defineModule({
    id: "meals",
    title: "Meals",
    tabs: [
      { id: "log", label: "Record" },
      { id: "report", label: "Monthly report" },
      { id: "foods", label: "My foods" }
    ],
    html: `
    <div id="meal-missing" hidden>${setupNotice()}</div>
    <datalist id="meal-food-list"></datalist>

    <!-- ===== Record tab ===== -->
    <div class="view" data-panel="log">
      <section class="panel" aria-labelledby="meal-today-heading">
        <div class="panel-head">
          <h2 id="meal-today-heading" data-icon="🍽️" data-tone="orange">Today so far</h2>
          <span class="muted small" id="meal-today-count"></span>
        </div>
        <ul class="meters" id="meal-today-meters"></ul>
        <p class="disclaimer">All numbers are rough estimates, not exact measurements. They show which way
          your eating leans; your lab results (cholesterol, fasting blood sugar) are the real measure.</p>
      </section>

      <section aria-labelledby="meal-add-heading">
        <h2 id="meal-add-heading" data-icon="📝" data-tone="green">Record what you ate or drank</h2>
        <form class="entry" id="meal-form" novalidate>
          <div class="field">
            <label for="meal-date">Date</label>
            <input id="meal-date" type="date" required>
          </div>
          <div class="field">
            <label for="meal-time">Time</label>
            <input id="meal-time" type="time">
          </div>
          <div class="items" id="meal-items"></div>
          <div class="field wide">
            <button type="button" class="link" id="meal-add-row" style="justify-self:start;padding-left:0">+ Add another item</button>
          </div>
          <div class="field wide">
            <label for="meal-note">Note (optional)</label>
            <input id="meal-note" maxlength="200" autocomplete="off" placeholder="Lunch at the office">
          </div>
          <div class="actions">
            <button type="submit" class="primary" id="meal-save">Save</button>
            <button type="button" id="meal-cancel" hidden>Cancel editing</button>
            <span class="hint" id="meal-status" role="status"></span>
          </div>
        </form>
        <p class="muted small">Pick from My foods, or type something new: you can fill in its numbers if you know them
          (from the label), and save it to My foods for next time.</p>
      </section>

      <section aria-labelledby="meal-list-heading">
        <h2 id="meal-list-heading" data-icon="🕘" data-tone="violet">Recent records</h2>
        <p class="empty" id="meal-empty">Nothing recorded yet. Add your first meal or drink with the form above.</p>
        <p class="muted small" id="meal-tip">Each day shows its totals; tap a day to see what you had.</p>
        <div class="day-list" id="meal-days"></div>
        <button type="button" id="meal-more" hidden>Show older days</button>
      </section>
    </div>

    <!-- ===== Monthly report tab ===== -->
    <div class="view" data-panel="report" hidden>
      <div class="cal-nav">
        <button type="button" id="meal-prev" aria-label="Previous month">‹</button>
        <strong id="meal-month" aria-live="polite"></strong>
        <button type="button" id="meal-next" aria-label="Next month">›</button>
      </div>
      <p class="empty" id="meal-report-empty" hidden>No meals recorded in this month.</p>
      <div id="meal-report" class="view"></div>
      <p class="disclaimer">Averages are per day that has records, so days you didn't record don't pull the average down.
        The numbers are estimates to show a trend, not medical advice. Talk to your doctor about your cholesterol and blood sugar results.</p>
    </div>

    <!-- ===== My foods tab ===== -->
    <div class="view" data-panel="foods" hidden>
      <section aria-labelledby="food-add-heading">
        <h2 id="food-add-heading" data-icon="🥫" data-tone="amber">Add a food or drink</h2>
        <form class="entry" id="food-form" novalidate>
          <div class="field wide photo-fill" id="food-photo-row" hidden>
            <button type="button" id="food-photo-btn">📷 Fill in from a photo</button>
            <input type="file" id="food-photo-file" accept="image/*" hidden>
            <span class="hint" id="food-photo-status" role="status">Photograph the food, or better, its nutrition label.
              AI fills in the form; check the numbers before you save.</span>
          </div>
          <div class="field wide food-pic-field">
            <span class="food-pic" id="food-pic"></span>
            <div class="food-pic-actions">
              <button type="button" class="link" id="food-pic-btn">Add a photo</button>
              <button type="button" class="link del" id="food-pic-remove" hidden>Remove photo</button>
              <input type="file" id="food-pic-file" accept="image/*" hidden>
            </div>
          </div>
          <div class="field wide">
            <label for="food-name">Name</label>
            <input id="food-name" maxlength="80" autocomplete="off" placeholder="Teh kotak 300 ml">
          </div>
          <div class="field">
            <label for="food-serving">One serving is</label>
            <input id="food-serving" maxlength="60" autocomplete="off" placeholder="1 box (300 ml)">
          </div>
          <div class="field">
            <label for="food-kind">Type</label>
            <select id="food-kind"><option value="food">Food</option><option value="drink">Drink</option></select>
          </div>
          ${nutrientFields("food")}
          <p class="field wide muted small">Numbers are per serving. For packaged products, copy them from the label
            ("Gula", "Karbohidrat total", "Lemak jenuh", "Kolesterol", "Protein"). Leave empty what you don't know.</p>
          <div class="actions">
            <button type="submit" class="primary" id="food-save">Add food</button>
            <button type="button" id="food-cancel" hidden>Cancel editing</button>
            <span class="hint" id="food-status" role="status"></span>
          </div>
        </form>
      </section>
      <section aria-labelledby="food-list-heading">
        <h2 id="food-list-heading" data-icon="📖" data-tone="teal">My foods</h2>
        <p class="muted small">The starting values are rough averages; adjust them to your usual portions.
          Changes apply to new records; past records keep the numbers they were saved with.</p>
        <input id="food-search" type="search" placeholder="Search my foods" aria-label="Search my foods" autocomplete="off">
        <ul class="list" id="food-list"></ul>
      </section>
    </div>`
  });

  const foods = new Table("foods");
  const meals = new Table("meals");
  let editingId = null;        // record being edited
  let confirmingId = null;     // record waiting for "Yes, delete"
  let editingFoodId = null;    // food being edited in My foods
  let confirmingFoodId = null;
  let pendingPic = null;       // photo chosen in the My foods form: { blob, preview }, "remove", or null for no change
  let daysShown = 10;          // how many days of records the Record tab lists
  const openDays = new Set();  // days opened in the Recent records list
  let reportMonth = todayString().slice(0, 7);
  let rowCounter = 0;

  mod.load = async () => {
    await Promise.all([foods.load(), meals.load()]);
    // A new account starts with the common foods list
    if (foods.ready && meals.ready && !foods.rows.length && !meals.rows.length) await foods.insert(DEFAULT_FOODS);
  };
  function refresh() { renderAll(); }

  // ---- Numbers ----
  const round1 = n => Math.round((Number(n) || 0) * 10) / 10;
  const fmt = (n, unit) => `${one.format(round1(n))} ${unit}`;
  function totals(list) {
    const t = Object.fromEntries(KEYS.map(k => [k, 0]));
    list.forEach(r => KEYS.forEach(k => { t[k] += Number(r[k]) || 0; }));
    return t;
  }
  function level(n, value) {
    if (n.goal) return value >= n.goal ? "good" : value >= n.goal * 0.7 ? "watch" : "low";
    return value <= n.good ? "good" : value <= n.limit ? "watch" : "high";
  }
  const LEVEL_WORD = { good: "OK", watch: "Moderate", high: "High", low: "Low", none: "No data" };
  // "Low" protein gets the same red as "High" sugar
  const tone = lvl => lvl === "low" ? "high" : lvl;
  function pill(lvl) { return `<span class="pill ${tone(lvl)}">${LEVEL_WORD[lvl]}</span>`; }
  function findFood(name) {
    const key = name.trim().toLowerCase();
    return key ? foods.rows.find(f => f.name.trim().toLowerCase() === key) : null;
  }
  function foodValues(f) {
    return NUTRIENTS.map(n => `${n.short} ${fmt(f[n.key], n.unit)}`).join(" · ");
  }
  // One meter: a bar for the amount, a tick at the daily limit (or the daily goal, for protein)
  function meter(n, value, caption) {
    const target = n.goal || n.limit;
    const scale = target * 1.5;
    const lvl = level(n, value);
    return `<li title="${escapeHtml(n.why)}">
      <div class="line"><span>${n.label} ${pill(lvl)}</span>
        <span class="val">${fmt(value, n.unit)} <span class="muted">of ${target} ${n.unit} ${n.goal ? "goal" : "limit"}${caption ? " " + caption : ""}</span></span></div>
      <div class="track"><div class="fill ${lvl === "good" ? "" : tone(lvl)}" style="width:${Math.min(100, value / scale * 100)}%"></div>
        <span class="mark" style="left:${(target / scale) * 100}%"></span></div>
    </li>`;
  }

  // ===================== Record tab =====================
  $("meal-date").value = todayString();
  $("meal-time").value = nowTime();

  function addRow(values = {}) {
    const i = ++rowCounter;
    const row = document.createElement("div");
    row.className = "item-row";
    row.innerHTML = `
      <div class="field">
        <label for="meal-food-${i}">Food or drink</label>
        <input id="meal-food-${i}" class="food-name" list="meal-food-list" maxlength="80" autocomplete="off" placeholder="Nasi putih">
      </div>
      <div class="field">
        <label for="meal-serv-${i}">Servings</label>
        <input id="meal-serv-${i}" class="servings" inputmode="decimal" autocomplete="off" value="1">
      </div>
      <button type="button" class="link del remove" data-action="remove-row" aria-label="Remove this item">✕</button>
      <p class="per"></p>
      <div class="custom" hidden>
        <p class="note-line">Not in My foods yet. Fill in what you know per serving (all optional):</p>
        ${nutrientFields("meal-c" + i, "c")}
        <label class="note-line"><input type="checkbox" class="save-food"> Save to My foods for next time</label>
      </div>`;
    $("meal-items").appendChild(row);
    if (values.name) {
      row.querySelector(".food-name").value = values.name;
      row.querySelector(".servings").value = one.format(values.servings || 1);
      // A record that isn't a My foods item: show its numbers per serving so they can be corrected
      if (!findFood(values.name)) {
        row.querySelectorAll(".custom input.c").forEach(inp => {
          const per = (Number(values[inp.dataset.key]) || 0) / (Number(values.servings) || 1);
          inp.value = per ? one.format(round1(per)) : "";
        });
      }
    }
    updateRow(row);
    updateRemoveButtons();
    return row;
  }
  // Show the numbers of the chosen food, or the fields for a new one
  function updateRow(row) {
    const name = row.querySelector(".food-name").value;
    const food = findFood(name);
    row.querySelector(".custom").hidden = Boolean(food) || !name.trim();
    row.querySelector(".per").textContent = food
      ? `${food.serving ? food.serving + ": " : "Per serving: "}${foodValues(food)}` : "";
  }
  function updateRemoveButtons() {
    const rows = $("meal-items").querySelectorAll(".item-row");
    rows.forEach(r => { r.querySelector(".remove").hidden = rows.length === 1; });
  }
  $("meal-items").addEventListener("input", event => {
    if (event.target.classList.contains("food-name")) updateRow(event.target.closest(".item-row"));
  });
  $("meal-items").addEventListener("click", event => {
    if (event.target.dataset.action !== "remove-row") return;
    event.target.closest(".item-row").remove();
    updateRemoveButtons();
  });
  $("meal-add-row").addEventListener("click", () => { addRow().querySelector(".food-name").focus(); });

  function resetForm() {
    editingId = null;
    $("meal-items").innerHTML = "";
    addRow();
    $("meal-note").value = "";
    $("meal-date").value = todayString();
    $("meal-time").value = nowTime();
    $("meal-save").textContent = "Save";
    $("meal-cancel").hidden = true;
    $("meal-add-row").hidden = false;
    $("meal-add-heading").textContent = "Record what you ate or drank";
  }

  // Read one item row into a record; returns { entry, newFood } or { error }
  function readRow(row) {
    const name = row.querySelector(".food-name").value.trim();
    if (!name) return null;
    const servings = parseNum(row.querySelector(".servings").value);
    if (!servings) return { error: `Enter how many servings of “${name}” (for example 1 or 0,5).` };
    const food = findFood(name);
    const per = {};
    if (food) KEYS.forEach(k => { per[k] = Number(food[k]) || 0; });
    else {
      for (const inp of row.querySelectorAll(".custom input.c")) {
        const v = parseNum(inp.value);
        if (Number.isNaN(v)) return { error: `Check the numbers for “${name}”: use digits only.` };
        per[inp.dataset.key] = v || 0;
      }
    }
    const entry = { name: food ? food.name : name, servings, food_id: food ? food.id : null };
    KEYS.forEach(k => { entry[k] = round1(per[k] * servings); });
    const newFood = !food && row.querySelector(".save-food").checked
      ? { name, serving: "", kind: "food", ...Object.fromEntries(KEYS.map(k => [k, round1(per[k])])) } : null;
    return { entry, newFood };
  }

  $("meal-form").addEventListener("submit", async event => {
    event.preventDefault();
    const rows = [...$("meal-items").querySelectorAll(".item-row")].map(readRow).filter(Boolean);
    const problem = rows.find(r => r.error);
    if (problem) { $("meal-status").textContent = problem.error; $("meal-status").classList.add("error"); return; }
    if (!rows.length) { $("meal-status").textContent = "Type what you ate or drank."; $("meal-status").classList.add("error"); return; }
    const shared = { date: $("meal-date").value || todayString(), time: $("meal-time").value || null, note: $("meal-note").value.trim() };
    const wasEditing = Boolean(editingId);
    $("meal-save").disabled = true;
    const ok = await attempt("meal-status", async () => {
      for (const r of rows) {
        if (!r.newFood || findFood(r.newFood.name)) continue;
        const [saved] = await foods.insert(r.newFood);
        r.entry.food_id = saved.id;
      }
      const entries = rows.map(r => ({ ...shared, ...r.entry }));
      if (wasEditing) await meals.update(editingId, entries[0]);
      else await meals.insert(entries);
    });
    $("meal-save").disabled = false;
    if (!ok) return;
    resetForm();
    say("meal-status", wasEditing ? "Changes saved." : `Saved ${plural(rows.length, "item")}.`);
    refresh();
  });
  $("meal-cancel").addEventListener("click", () => { resetForm(); say("meal-status", ""); refresh(); });

  function startEditing(id) {
    const r = meals.get(id);
    if (!r) return;
    editingId = id; confirmingId = null;
    $("meal-items").innerHTML = "";
    addRow(r);
    $("meal-date").value = r.date;
    $("meal-time").value = (r.time || "").slice(0, 5);
    $("meal-note").value = r.note || "";
    $("meal-save").textContent = "Save changes";
    $("meal-cancel").hidden = false;
    $("meal-add-row").hidden = true;
    $("meal-add-heading").textContent = "Edit record";
    say("meal-status", "");
    refresh();
    $("meal-form").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  $("meal-days").addEventListener("click", async event => {
    if (toggleDay(event, openDays)) { refresh(); return; }
    const btn = event.target.closest("button[data-action]");
    if (!btn) return;
    const id = btn.closest("li").dataset.id;
    const action = btn.dataset.action;
    if (action === "edit") startEditing(id);
    if (action === "delete") { confirmingId = id; refresh(); }
    if (action === "keep") { confirmingId = null; refresh(); }
    if (action === "confirm-delete") {
      if (!await attempt("meal-status", () => meals.remove(id))) return;
      if (editingId === id) resetForm();
      confirmingId = null;
      say("meal-status", "Record deleted.");
      refresh();
    }
  });
  $("meal-more").addEventListener("click", () => { daysShown += 10; refresh(); });

  function sortRecords(list) {
    return [...list].sort((a, b) => b.date.localeCompare(a.date) ||
      (b.time || "").localeCompare(a.time || "") || (b.created_at || "").localeCompare(a.created_at || ""));
  }

  function renderLog() {
    const today = todayString();
    const todays = meals.rows.filter(r => r.date === today);
    const t = totals(todays);
    $("meal-today-count").textContent = todays.length ? plural(todays.length, "item") : "Nothing recorded today";
    $("meal-today-meters").innerHTML = NUTRIENTS.map(n => meter(n, t[n.key])).join("");

    $("meal-food-list").innerHTML = [...foods.rows].sort((a, b) => a.name.localeCompare(b.name))
      .map(f => `<option value="${escapeHtml(f.name)}"></option>`).join("");

    const byDay = {};
    sortRecords(meals.rows).forEach(r => { (byDay[r.date] = byDay[r.date] || []).push(r); });
    const days = Object.keys(byDay).sort().reverse();
    [editingId, confirmingId].forEach(id => { const r = id && meals.get(id); if (r) openDays.add(r.date); });
    $("meal-empty").hidden = days.length > 0;
    $("meal-tip").hidden = !days.length;
    $("meal-more").hidden = days.length <= daysShown;
    $("meal-days").innerHTML = days.slice(0, daysShown).map(day => {
      const dt = totals(byDay[day]);
      const open = openDays.has(day);
      const summary = `<span class="nut">sugar ${fmt(dt.sugar_g, "g")} · sat. fat ${fmt(dt.sat_fat_g, "g")} · chol. ${fmt(dt.cholesterol_mg, "mg")} · protein ${fmt(dt.protein_g, "g")}</span>`;
      return `<div class="day-group${open ? " open" : ""}">
        ${dayRow(day, open, summary, `<span class="count">${plural(byDay[day].length, "item")}</span>`)}
        ${open ? `<ul class="list">${byDay[day].map(r => {
          const actions = confirmingId === r.id
            ? `<span class="ask">Delete this record?</span>
               <button type="button" class="link" data-action="keep">Keep</button>
               <button type="button" class="danger" data-action="confirm-delete">Yes, delete</button>`
            : editDeleteButtons();
          const servings = Number(r.servings) === 1 ? "" : ` × ${one.format(r.servings)}`;
          return `<li data-id="${r.id}" class="${editingId === r.id ? "editing" : ""}">
            <div class="what"><span class="cat">${escapeHtml(r.name)}${servings}</span>
              <span class="meta nut">${[r.time ? r.time.slice(0, 5) : "", foodValues(r), r.note ? escapeHtml(r.note) : ""].filter(Boolean).join(" · ")}</span></div>
            <span></span>
            <div class="row-actions">${actions}</div></li>`;
        }).join("")}</ul>` : ""}</div>`;
    }).join("");
  }

  // ===================== Monthly report =====================
  $("meal-prev").addEventListener("click", () => { reportMonth = shiftMonth(reportMonth, -1); refresh(); });
  $("meal-next").addEventListener("click", () => { reportMonth = shiftMonth(reportMonth, 1); refresh(); });

  // Daily totals and averages for one month
  function monthStats(month) {
    const list = meals.rows.filter(r => r.date.startsWith(month + "-"));
    const byDay = {};
    list.forEach(r => { (byDay[r.date] = byDay[r.date] || []).push(r); });
    const dayTotals = Object.values(byDay).map(totals);
    const days = dayTotals.length;
    const avg = Object.fromEntries(KEYS.map(k => [k, days ? dayTotals.reduce((s, d) => s + d[k], 0) / days : 0]));
    // Days above the limit, or below the goal for protein
    const over = Object.fromEntries(NUTRIENTS.map(n => [n.key, dayTotals.filter(d => n.goal ? d[n.key] < n.goal : d[n.key] > n.limit).length]));
    return { list, days, avg, over };
  }
  // The foods that gave the most of one nutrient in the month
  function topSources(list, key, count = 3) {
    const sums = {};
    list.forEach(r => { sums[r.name] = (sums[r.name] || 0) + (Number(r[key]) || 0); });
    return Object.entries(sums).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, count);
  }
  const RANK = { good: 0, watch: 1, high: 2, low: 2 };
  function sideLevel(stats, side) {
    if (!stats.days) return "none";
    return NUTRIENTS.filter(n => n.side === side).map(n => level(n, stats.avg[n.key]))
      .reduce((a, b) => RANK[b] > RANK[a] ? b : a, "good");
  }
  const SIDE_TEXT = {
    sugar: { icon: "🩸", title: "Blood sugar", good: "This month didn't lean high in sugar.", watch: "This month leaned a little high in sugar or carbohydrates.", high: "This month leaned high in sugar or carbohydrates." },
    chol: { icon: "❤️", title: "Cholesterol", good: "This month didn't lean high in cholesterol.", watch: "This month leaned a little high in saturated fat or cholesterol.", high: "This month leaned high in saturated fat or cholesterol." },
    protein: { icon: "💪", title: "Protein", good: "You ate enough protein on an average day.", watch: "Protein was a little short of the daily goal.", low: "Protein was well below the daily goal." }
  };

  function renderReport() {
    $("meal-month").textContent = monthName(reportMonth);
    const stats = monthStats(reportMonth);
    const prevMonth = shiftMonth(reportMonth, -1);
    const prev = monthStats(prevMonth);
    $("meal-report-empty").hidden = stats.days > 0;
    if (!stats.days) { $("meal-report").innerHTML = ""; return; }

    const verdicts = ["sugar", "chol", "protein"].map(side => {
      const lvl = sideLevel(stats, side);
      const parts = NUTRIENTS.filter(n => n.side === side).map(n => `${n.short} ${fmt(stats.avg[n.key], n.unit)}`).join(", ");
      return `<div class="verdict lvl-${lvl}"><span class="verdict-top">${pill(lvl)}<span class="v-icon" aria-hidden="true">${SIDE_TEXT[side].icon}</span></span><strong>${SIDE_TEXT[side].title}</strong>
        <span>${SIDE_TEXT[side][lvl]}</span><span class="muted small">Average a day: ${parts}</span></div>`;
    }).join("");

    const rows = NUTRIENTS.map(n => {
      let compare = "";
      if (prev.days) {
        const diff = stats.avg[n.key] - prev.avg[n.key];
        compare = Math.abs(diff) < 0.5 ? `about the same as ${monthName(prevMonth, true)}`
          : `${diff > 0 ? "↑" : "↓"} ${fmt(Math.abs(diff), n.unit)} vs ${monthName(prevMonth, true)}`;
      }
      return meter(n, stats.avg[n.key], "a day") +
        `<li class="muted small" style="margin-top:-8px">${[`${n.goal ? "Below the goal" : "Above the limit"} on ${stats.over[n.key]} of ${plural(stats.days, "day")}`, compare].filter(Boolean).join(" · ")}</li>`;
    }).join("");

    // Plain advice, built from where this month's numbers came from
    const advice = [];
    const sugarSrc = topSources(stats.list, "sugar_g");
    const carbSrc = topSources(stats.list, "carbs_g");
    const satSrc = topSources(stats.list, "sat_fat_g");
    const cholSrc = topSources(stats.list, "cholesterol_mg");
    const named = (src, unit) => src.map(([name, v]) => `${escapeHtml(name)} (${fmt(v, unit)})`).join(", ");
    const lv = key => level(NUTRIENTS.find(n => n.key === key), stats.avg[key]);
    if (lv("sugar_g") !== "good" && sugarSrc.length)
      advice.push(["🍬", "pink", `Most sugar came from ${named(sugarSrc, "g")}. Sweet drinks are usually the easiest win: ask for less sugar or go unsweetened.`]);
    if (lv("carbs_g") !== "good" && carbSrc.length)
      advice.push(["🍚", "amber", `Most carbohydrates came from ${named(carbSrc, "g")}. A smaller portion of rice or noodles, with more vegetables and protein, helps blood sugar.`]);
    if (lv("sat_fat_g") !== "good" && satSrc.length)
      advice.push(["🍳", "orange", `Most saturated fat came from ${named(satSrc, "g")}. Grilled, steamed or boiled instead of fried, and less santan, lowers it.`]);
    if (lv("cholesterol_mg") !== "good" && cholSrc.length)
      advice.push(["❤️", "red", `Most cholesterol came from ${named(cholSrc, "mg")}.`]);
    if (lv("protein_g") !== "good") {
      const protSrc = topSources(stats.list, "protein_g");
      advice.push(["💪", "green", (protSrc.length ? `Most protein came from ${named(protSrc, "g")}. ` : "") +
        "Tempe, tahu, fish, chicken without skin, eggs and milk are easy ways to add protein, and help muscles recover after a workout."]);
    }
    if (!advice.length) advice.push(["🌟", "green", "All the numbers are within the comfortable range. Keep it up."]);

    $("meal-report").innerHTML = `
      <section class="panel"><div class="panel-head"><h2 data-icon="📊" data-tone="orange">How the month leaned</h2>
        <span class="muted small">${plural(stats.days, "day")} with records · ${plural(stats.list.length, "item")}</span></div>
        <div class="verdicts">${verdicts}</div></section>
      <section class="panel"><h2 data-icon="🎯" data-tone="red">Average a day</h2><ul class="meters">${rows}</ul>
        <p class="muted small">Hover or long-press a row to see where its limit comes from.</p></section>
      <section class="panel"><h2 data-icon="💡" data-tone="amber">What would help</h2><ul class="tips">${advice.map(([icon, tone, text]) =>
        `<li>${badge("", icon, tone)}<span>${text}</span></li>`).join("")}</ul></section>`;
  }

  // ===================== My foods =====================
  function resetFoodForm() {
    editingFoodId = null;
    ["food-name", "food-serving", ...KEYS.map(k => "food-" + k)].forEach(id => { $(id).value = ""; });
    $("food-kind").value = "food";
    setPendingPic(null);
    showFormPic(null);
    $("food-save").textContent = "Add food";
    $("food-cancel").hidden = true;
    $("food-add-heading").textContent = "Add a food or drink";
  }
  $("food-form").addEventListener("submit", async event => {
    event.preventDefault();
    const name = $("food-name").value.trim();
    if (!name) { say("food-status", "Type a name."); $("food-name").focus(); return; }
    const twin = findFood(name);
    if (twin && twin.id !== editingFoodId) { say("food-status", `“${twin.name}” is already in My foods.`); return; }
    const entry = { name, serving: $("food-serving").value.trim(), kind: $("food-kind").value };
    for (const n of NUTRIENTS) {
      const v = parseNum($("food-" + n.key).value);
      if (Number.isNaN(v)) { $("food-status").textContent = `Check ${n.label}: use digits only.`; $("food-status").classList.add("error"); return; }
      entry[n.key] = round1(v || 0);
    }
    const wasEditing = Boolean(editingFoodId);
    const ok = await attempt("food-status", async () => {
      const id = wasEditing ? (await foods.update(editingFoodId, entry), editingFoodId) : (await foods.insert(entry))[0].id;
      await savePic(id);
    });
    if (!ok) return;
    resetFoodForm();
    say("food-status", wasEditing ? "Changes saved." : `Added “${name}”.`);
    refresh();
  });
  $("food-cancel").addEventListener("click", () => { resetFoodForm(); say("food-status", ""); refresh(); });

  // ---- The food's own photo: a 256 px square, shown on the left of My foods ----
  // Online it goes to the storage bucket "food-photos" (<user id>/<food id>.jpg); in this-browser-only mode
  // the small picture is kept in the food itself.
  function showFormPic(url) {
    $("food-pic").innerHTML = url ? `<img src="${escapeHtml(url)}" alt="">` : "📷";
    $("food-pic-btn").textContent = url ? "Change photo" : "Add a photo";
    $("food-pic-remove").hidden = !url;
  }
  function setPendingPic(value) {
    if (pendingPic && pendingPic.preview) URL.revokeObjectURL(pendingPic.preview);
    pendingPic = value;
  }
  async function choosePic(file) {
    const blob = await squarePhoto(file);
    const preview = URL.createObjectURL(blob);
    setPendingPic({ blob, preview });
    showFormPic(preview);
  }
  $("food-pic-btn").addEventListener("click", () => $("food-pic-file").click());
  $("food-pic-file").addEventListener("change", async () => {
    const file = $("food-pic-file").files[0];
    $("food-pic-file").value = "";
    if (!file) return;
    try { await choosePic(file); say("food-status", "Photo ready; it's saved with the food."); }
    catch (err) { $("food-status").textContent = "Couldn't use the photo: " + err.message; $("food-status").classList.add("error"); }
  });
  $("food-pic-remove").addEventListener("click", () => { setPendingPic("remove"); showFormPic(null); });

  // Save the photo chosen in the form for food `id` (after the food itself is saved)
  async function savePic(id) {
    if (!pendingPic) return;
    let url = null;
    if (pendingPic !== "remove") {
      if (CLOUD) {
        const path = currentUser.id + "/" + id + ".jpg";
        const up = await sb.storage.from("food-photos").upload(path, pendingPic.blob, { upsert: true, contentType: "image/jpeg" });
        if (up.error) throw new Error(/bucket not found|row-level security|policy/i.test(up.error.message)
          ? "the photo needs one more step: run the latest supabase-setup.sql in Supabase → SQL Editor." : up.error.message);
        // The ?v= makes browsers show a new photo instead of the old one they remember
        url = sb.storage.from("food-photos").getPublicUrl(path).data.publicUrl + "?v=" + Date.now();
      } else {
        url = await new Promise(resolve => { const r = new FileReader(); r.onload = () => resolve(r.result); r.readAsDataURL(pendingPic.blob); });
      }
    } else if (CLOUD) {
      await sb.storage.from("food-photos").remove([currentUser.id + "/" + id + ".jpg"]);
    }
    try { await foods.update(id, { image_url: url }); }
    catch (err) {
      throw new Error(/image_url/.test(err.message)
        ? "the food was saved, but its photo needs one more step: run the latest supabase-setup.sql in Supabase → SQL Editor." : err.message);
    }
    setPendingPic(null);
  }

  // ---- Fill the form from a photo: the Supabase function "food-photo" asks Claude to read it ----
  // Only with the online database, since the function runs there (see supabase/functions/food-photo).
  $("food-photo-row").hidden = !CLOUD;
  $("food-photo-btn").addEventListener("click", () => $("food-photo-file").click());
  // Shrink the photo to at most 1024 px on its longest side: enough to read a label, and a small upload
  async function photoForAi(file) {
    const img = await loadImage(file);
    const scale = Math.min(1, 1024 / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.85).split(",")[1];
  }
  $("food-photo-file").addEventListener("change", async () => {
    const file = $("food-photo-file").files[0];
    $("food-photo-file").value = "";
    if (!file) return;
    const status = $("food-photo-status");
    status.classList.remove("error");
    status.textContent = "Reading the photo… this takes a few seconds.";
    $("food-photo-btn").disabled = true;
    try {
      const image = await photoForAi(file);
      const { data, error } = await sb.functions.invoke("food-photo", { body: { image, media_type: "image/jpeg" } });
      if (error) {
        let message = "";
        try { message = (await error.context.json()).error; } catch {}
        if (!message && /failed to send|not found|404/i.test(error.message)) {
          message = "Food photos aren't set up yet on Supabase (see the README, \"Food photos\").";
        }
        throw new Error(message || error.message);
      }
      if (!data.recognized) throw new Error(data.note || "No food, drink or label was found in the photo.");
      // The same photo becomes the food's picture (unless one is already set); it can be changed or removed
      if (!$("food-pic").querySelector("img")) await choosePic(file);
      // Fill the form, keeping whatever is being edited; nothing is saved until "Add food" is tapped
      $("food-name").value = data.name;
      $("food-serving").value = data.serving;
      $("food-kind").value = data.kind === "drink" ? "drink" : "food";
      KEYS.forEach(k => { $("food-" + k).value = Number(data[k]) ? one.format(round1(data[k])) : ""; });
      status.textContent = (data.source === "label" ? "Copied from the label. " : "Estimated from the photo. ") +
        (data.note ? data.note + " " : "") + "Check the numbers, then tap " + $("food-save").textContent + ".";
    } catch (err) {
      status.classList.add("error");
      status.textContent = "Couldn't read the photo: " + err.message;
    }
    $("food-photo-btn").disabled = false;
  });
  $("food-search").addEventListener("input", () => renderFoods());

  $("food-list").addEventListener("click", async event => {
    const btn = event.target.closest("button[data-action]");
    if (!btn) return;
    const id = btn.closest("li").dataset.id;
    const action = btn.dataset.action;
    if (action === "edit") {
      const f = foods.get(id);
      editingFoodId = id; confirmingFoodId = null;
      $("food-name").value = f.name; $("food-serving").value = f.serving || ""; $("food-kind").value = f.kind || "food";
      setPendingPic(null);
      showFormPic(f.image_url);
      KEYS.forEach(k => { $("food-" + k).value = Number(f[k]) ? one.format(f[k]) : ""; });
      $("food-save").textContent = "Save changes";
      $("food-cancel").hidden = false;
      $("food-add-heading").textContent = "Edit food";
      say("food-status", "");
      refresh();
      $("food-form").scrollIntoView({ behavior: "smooth", block: "start" });
    }
    if (action === "delete") { confirmingFoodId = id; refresh(); }
    if (action === "keep") { confirmingFoodId = null; refresh(); }
    if (action === "confirm-delete") {
      const pic = foods.get(id)?.image_url;
      if (!await attempt("food-status", () => foods.remove(id))) return;
      if (pic && CLOUD) sb.storage.from("food-photos").remove([currentUser.id + "/" + id + ".jpg"]); // tidy up; the food is gone either way
      if (editingFoodId === id) resetFoodForm();
      confirmingFoodId = null;
      say("food-status", "Deleted. Past records keep their numbers.");
      refresh();
    }
  });

  function renderFoods() {
    const q = $("food-search").value.trim().toLowerCase();
    const uses = {};
    meals.rows.forEach(r => { const k = r.name.toLowerCase(); uses[k] = (uses[k] || 0) + 1; });
    const list = [...foods.rows].filter(f => !q || f.name.toLowerCase().includes(q))
      .sort((a, b) => (uses[b.name.toLowerCase()] || 0) - (uses[a.name.toLowerCase()] || 0) || a.name.localeCompare(b.name));
    $("food-list").innerHTML = list.map(f => {
      const n = uses[f.name.toLowerCase()] || 0;
      const actions = confirmingFoodId === f.id
        ? `<span class="ask">Delete this food?</span>
           <button type="button" class="link" data-action="keep">Keep</button>
           <button type="button" class="danger" data-action="confirm-delete">Yes, delete</button>`
        : editDeleteButtons();
      const pic = f.image_url ? `<img class="food-thumb" src="${escapeHtml(f.image_url)}" alt="" loading="lazy">`
        : `<span class="food-thumb">${badge(f.name, f.kind === "drink" ? "🥤" : "🍽️")}</span>`;
      return `<li data-id="${f.id}" class="with-pic${editingFoodId === f.id ? " editing" : ""}">
        ${pic}
        <div class="what"><span class="cat">${escapeHtml(f.name)}</span>
          <span class="meta">${[f.kind === "drink" ? "Drink" : "Food", f.serving ? escapeHtml(f.serving) : "", n ? `recorded ${n}×` : ""].filter(Boolean).join(" · ")}</span>
          <span class="food-values nut">${foodValues(f)}</span></div>
        <span></span>
        <div class="row-actions">${actions}</div></li>`;
    }).join("") || `<li class="muted">No foods match.</li>`;
  }

  // ===================== Draw everything =====================
  mod.onEnter = () => resetForm();
  mod.render = () => {
    const ready = foods.ready && meals.ready;
    $("meal-missing").hidden = ready;
    mod.el.querySelectorAll("[data-panel]").forEach(p => { p.style.display = ready ? "" : "none"; });
    if (!ready) return;
    renderLog();
    renderReport();
    renderFoods();
  };

  // ---- Home card: today's numbers and how this month leans ----
  mod.home = card => {
    if (!(foods.ready && meals.ready)) {
      card.innerHTML = `<div class="panel-head"><h2>Meals</h2></div>${setupNotice()}`;
      return;
    }
    const today = todayString();
    const todays = meals.rows.filter(r => r.date === today);
    const t = totals(todays);
    const stats = monthStats(today.slice(0, 7));
    const sugar = NUTRIENTS[0], sat = NUTRIENTS[2], protein = NUTRIENTS[4];
    card.innerHTML = `
      <div class="panel-head"><h2>Meals</h2><a href="#meals">Record a meal</a></div>
      <div class="lines">
        <span class="muted small">Today${todays.length ? ` · ${plural(todays.length, "item")}` : ": nothing recorded yet"}</span>
        <span>Sugar ${fmt(t.sugar_g, "g")} ${todays.length ? pill(level(sugar, t.sugar_g)) : ""}</span>
        <span>Saturated fat ${fmt(t.sat_fat_g, "g")} ${todays.length ? pill(level(sat, t.sat_fat_g)) : ""}</span>
        <span>Protein ${fmt(t.protein_g, "g")} <span class="muted small">of ${protein.goal} g goal</span></span>
        ${stats.days ? `<span class="muted small">This month: blood sugar ${pill(sideLevel(stats, "sugar"))} · cholesterol ${pill(sideLevel(stats, "chol"))} · protein ${pill(sideLevel(stats, "protein"))}</span>` : ""}
      </div>`;
  };
})();
