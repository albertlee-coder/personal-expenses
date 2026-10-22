// Body: record the 8 numbers from a body-composition scale, see whether each one is below normal, normal or
// above normal for you, and follow how each one changes over time.
// A measurement (table `body_measurements`): { id, date, weight_kg: 72.4, body_fat_pct: 21.5, muscle_pct: 74.1,
//   visceral_fat: 8, protein_pct: 17.2, body_water_pct: 55.3, bone_kg: 3.1, skeletal_muscle_pct: 36.0, note }
//   Every number is optional, so a scale that shows fewer numbers still works.
// The profile (table `body_profile`, one row per person): { id, height_cm: 170, birth_date: "1985-04-12",
//   sex: "male" | "female", ethnicity: "asian" | "european" | ... }. The normal ranges depend on it.
(() => {
  // ---- Normal ranges ----
  // These are the common guidelines that body-composition scales use. They are estimates, not medical advice.
  const ETHNICITIES = [
    ["asian", "Asian"], ["european", "European / White"], ["african", "African / Black"],
    ["latino", "Latino / Hispanic"], ["middle_eastern", "Middle Eastern"], ["other", "Other / mixed"]
  ];
  // Age groups used by the body fat and skeletal muscle tables: under 40, 40–59, 60 and over
  const ageGroup = age => age < 40 ? 0 : age < 60 ? 1 : 2;
  // Healthy body fat % by sex, ethnicity and age group (Gallagher et al. 2000, the table most scales use).
  // Asian and African tables have their own rows; everyone else uses the European row.
  const FAT = {
    male:   { asian: [[5, 17], [7, 20], [9, 21]], african: [[8, 20], [9, 22], [11, 23]], european: [[8, 20], [11, 22], [13, 25]] },
    female: { asian: [[25, 35], [25, 36], [26, 36]], african: [[20, 32], [21, 34], [23, 35]], european: [[21, 33], [23, 34], [24, 36]] }
  };
  // Skeletal muscle % by sex and age group (Omron body-composition guide)
  const SKELETAL = {
    male: [[33.3, 39.3], [33.1, 39.1], [32.9, 38.9]],
    female: [[24.3, 30.3], [24.1, 30.1], [23.9, 29.9]]
  };
  // Bone mass in kg that is typical for your sex and weight (Tanita guide); normal is within 10% of it
  function typicalBone(sex, weight) {
    if (sex === "female") return weight < 50 ? 1.95 : weight <= 75 ? 2.4 : 2.95;
    return weight < 65 ? 2.65 : weight <= 95 ? 3.29 : 3.69;
  }
  const fatTable = eth => eth === "asian" || eth === "african" ? eth : "european";
  function fatRange(p) { const [low, high] = FAT[p.sex][fatTable(p.ethnicity)][p.group]; return { low, high }; }

  // Each indicator: its column, how to show it, and its normal range for a profile `p`
  // (p has sex, ethnicity, age, group, height_m, and `m`, the measurement being judged)
  const INDICATORS = [
    { key: "weight_kg", label: "Body weight", unit: "kg", digits: 1,
      // A healthy BMI: 18.5–22.9 for Asian people (WHO Asia-Pacific), 18.5–24.9 for others
      range: p => {
        const top = p.ethnicity === "asian" ? 22.9 : 24.9;
        return { low: 18.5 * p.height_m ** 2, high: top * p.height_m ** 2, why: `a BMI of 18.5–${top} at your height` };
      } },
    { key: "body_fat_pct", label: "Body fat", unit: "%", digits: 1,
      range: p => ({ ...fatRange(p), why: "for your age, sex and ethnicity" }) },
    { key: "muscle_pct", label: "Muscle", unit: "%", digits: 1, higherOk: true,
      // Scales count muscle as everything that isn't fat or bone, so its normal range mirrors body fat
      range: p => {
        const fat = fatRange(p);
        const weight = Number(p.m && p.m.weight_kg) || 0;
        const bone = weight ? typicalBone(p.sex, weight) / weight * 100 : 4;
        return { low: 100 - fat.high - bone, high: 100 - fat.low - bone, why: "what is left after a healthy body fat and bone mass" };
      } },
    { key: "visceral_fat", label: "Visceral fat", unit: "", digits: 0, integer: true,
      range: () => ({ low: null, high: 9, why: "a level of 1–9 (10 and up is high)" }) },
    { key: "protein_pct", label: "Protein", unit: "%", digits: 1, higherOk: true,
      range: () => ({ low: 16, high: 20, why: "16–20% for adults" }) },
    { key: "body_water_pct", label: "Body water", unit: "%", digits: 1,
      range: p => p.sex === "female" ? { low: 45, high: 60, why: "45–60% for women" } : { low: 50, high: 65, why: "50–65% for men" } },
    { key: "bone_kg", label: "Bone mass", unit: "kg", digits: 1, higherOk: true,
      range: p => {
        const weight = Number(p.m && p.m.weight_kg);
        if (!weight) return null; // needs the weight from the same day
        const t = typicalBone(p.sex, weight);
        return { low: t * 0.9, high: t * 1.1, why: `around ${one.format(t)} kg for your sex and weight` };
      } },
    { key: "skeletal_muscle_pct", label: "Skeletal muscle", unit: "%", digits: 1, higherOk: true,
      range: p => { const [low, high] = SKELETAL[p.sex][p.group]; return { low, high, why: "for your age and sex" }; } }
  ];
  // The icon and colour of each number's chart on the Progress tab
  const IND_ICON = {
    weight_kg: ["⚖️", "teal"], body_fat_pct: ["🧈", "amber"], muscle_pct: ["💪", "green"], visceral_fat: ["🎯", "red"],
    protein_pct: ["🥚", "orange"], body_water_pct: ["💧", "blue"], bone_kg: ["🦴", "violet"], skeletal_muscle_pct: ["🏋️", "pink"]
  };
  const STATUS = { below: ["watch", "Below normal"], normal: ["good", "Normal"], above: ["watch", "Above normal"] };

  const fmt = (ind, v) => Number(v).toLocaleString(LOCALE, { minimumFractionDigits: ind.digits, maximumFractionDigits: ind.digits });
  const withUnit = (ind, v) => fmt(ind, v) + (ind.unit === "%" ? "%" : ind.unit ? " " + ind.unit : "");
  const has = v => v !== null && v !== undefined && v !== "";

  const field = ind => `<div class="field">
      <label for="bd-${ind.key}">${ind.label}${ind.unit ? ` (${ind.unit})` : ""}</label>
      <input id="bd-${ind.key}" inputmode="${ind.integer ? "numeric" : "decimal"}" autocomplete="off">
    </div>`;

  const mod = defineModule({
    id: "body",
    title: "Body",
    tabs: [{ id: "log", label: "Record" }, { id: "progress", label: "Progress" }, { id: "profile", label: "Profile" }],
    html: `
    <div id="bd-missing" hidden>${setupNotice()}</div>

    <!-- ===== Record tab ===== -->
    <div class="view" data-panel="log">
      <p class="notice" id="bd-need-profile" hidden>To see whether each number is normal for you, fill in your
        height, birth date, sex and ethnicity first: <a href="#body/profile">open Profile</a>.</p>

      <section class="panel" id="bd-latest-panel" aria-labelledby="bd-latest-heading" hidden>
        <div class="panel-head">
          <h2 id="bd-latest-heading" data-icon="⚖️" data-tone="teal">Latest measurement</h2>
          <span class="muted small" id="bd-latest-date"></span>
        </div>
        <ul class="gauges" id="bd-latest"></ul>
        <p class="disclaimer">Normal ranges are the common guidelines body-composition scales use, adjusted for your
          profile. They are estimates, not medical advice.</p>
      </section>

      <section aria-labelledby="bd-add-heading">
        <h2 id="bd-add-heading" data-icon="📝" data-tone="blue">Record a measurement</h2>
        <form class="entry" id="bd-form" novalidate>
          <div class="field wide">
            <label for="bd-date">Date</label>
            <input id="bd-date" type="date" required>
          </div>
          ${INDICATORS.map(field).join("")}
          <div class="field wide">
            <label for="bd-note">Note (optional)</label>
            <input id="bd-note" maxlength="200" autocomplete="off" placeholder="Morning, before breakfast">
          </div>
          <div class="actions">
            <button type="submit" class="primary" id="bd-save">Save measurement</button>
            <button type="button" id="bd-cancel" hidden>Cancel editing</button>
            <span class="hint" id="bd-status" role="status"></span>
          </div>
        </form>
        <p class="muted small">Fill in the numbers your scale shows; you can leave any of them empty.
          Weigh yourself at the same time of day each time (for example in the morning) so the numbers compare well.</p>
      </section>

      <section aria-labelledby="bd-list-heading">
        <h2 id="bd-list-heading" data-icon="🕘" data-tone="violet">Past measurements</h2>
        <p class="empty" id="bd-empty">No measurements yet. Record your first one with the form above.</p>
        <ul class="list" id="bd-list"></ul>
        <button type="button" id="bd-more" hidden>Show older measurements</button>
      </section>
    </div>

    <!-- ===== Progress tab ===== -->
    <div class="view" data-panel="progress" hidden>
      <div class="panel-head">
        <h2 data-icon="📈" data-tone="green">How each number changed</h2>
        <div class="seg" role="group" aria-label="Period" id="bd-period">
          <button type="button" data-days="90" aria-pressed="true">3 months</button>
          <button type="button" data-days="180" aria-pressed="false">6 months</button>
          <button type="button" data-days="365" aria-pressed="false">1 year</button>
          <button type="button" data-days="0" aria-pressed="false">All</button>
        </div>
      </div>
      <p class="muted small">The shaded band is the normal range for your latest measurement. Tap a chart to read a point.</p>
      <p class="empty" id="bd-progress-empty" hidden></p>
      <div class="view" id="bd-charts"></div>
    </div>

    <!-- ===== Profile tab ===== -->
    <div class="view" data-panel="profile" hidden>
      <section aria-labelledby="bd-profile-heading">
        <h2 id="bd-profile-heading" data-icon="👤" data-tone="amber">Your profile</h2>
        <p class="muted">The normal ranges depend on these: body weight on your height, body fat on your age, sex and
          ethnicity, and body water and skeletal muscle on your sex and age.</p>
        <form class="entry" id="bd-profile-form" novalidate>
          <div class="field">
            <label for="bd-height">Height (cm)</label>
            <input id="bd-height" inputmode="decimal" autocomplete="off" placeholder="170">
          </div>
          <div class="field">
            <label for="bd-birth">Birth date</label>
            <input id="bd-birth" type="date">
          </div>
          <fieldset class="chips field wide" id="bd-sex"><legend>Sex</legend>
            <label class="chip"><input type="radio" name="bd-sex" value="male"><span>Male</span></label>
            <label class="chip"><input type="radio" name="bd-sex" value="female"><span>Female</span></label>
          </fieldset>
          <div class="field wide">
            <label for="bd-ethnicity">Ethnicity</label>
            <select id="bd-ethnicity"><option value="">Choose…</option>${ETHNICITIES.map(([v, l]) =>
              `<option value="${v}">${l}</option>`).join("")}</select>
          </div>
          <div class="actions">
            <button type="submit" class="primary" id="bd-profile-save">Save profile</button>
            <span class="hint" id="bd-profile-status" role="status"></span>
          </div>
        </form>
        <p class="muted small" id="bd-profile-summary"></p>
      </section>
    </div>`
  });

  const measurements = new Table("body_measurements");
  const profiles = new Table("body_profile");
  let editingId = null, confirmingId = null;
  let shown = 20;        // how many measurements the list shows
  let periodDays = 90;   // Progress tab: 0 = all

  mod.load = () => Promise.all([measurements.load(), profiles.load()]);
  function refresh() { renderAll(); }

  // ---- Profile and status ----
  const profile = () => profiles.rows[0] || null;
  function profileComplete(p) { return Boolean(p && Number(p.height_cm) > 0 && p.birth_date && p.sex && p.ethnicity); }
  function ageOn(birth, date) {
    const b = parseIso(birth), d = parseIso(date);
    return d.getFullYear() - b.getFullYear() - (d < new Date(d.getFullYear(), b.getMonth(), b.getDate()) ? 1 : 0);
  }
  // The normal range of one indicator for one measurement, or null when the profile is incomplete
  function rangeFor(ind, m) {
    const p = profile();
    if (!profileComplete(p)) return null;
    const age = ageOn(p.birth_date, m.date);
    return ind.range({ sex: p.sex, ethnicity: p.ethnicity, age, group: ageGroup(age), height_m: Number(p.height_cm) / 100, m });
  }
  function statusOf(value, r) {
    if (!r || !has(value)) return null;
    const v = Number(value);
    if (r.low !== null && v < r.low) return "below";
    if (v > r.high) return "above";
    return "normal";
  }
  function rangeText(ind, r) {
    if (!r) return "";
    return r.low === null ? `normal: up to ${withUnit(ind, r.high)}` : `normal: ${fmt(ind, r.low)}–${withUnit(ind, r.high)}`;
  }
  const pill = s => s ? `<span class="pill ${STATUS[s][0]}">${STATUS[s][1]}</span>` : "";
  const sorted = () => [...measurements.rows].sort((a, b) => b.date.localeCompare(a.date) || (b.created_at || "").localeCompare(a.created_at || ""));

  // ===================== Record tab =====================
  $("bd-date").value = todayString();

  function resetForm() {
    editingId = null;
    INDICATORS.forEach(ind => { $("bd-" + ind.key).value = ""; });
    $("bd-note").value = "";
    $("bd-date").value = todayString();
    $("bd-save").textContent = "Save measurement";
    $("bd-cancel").hidden = true;
    $("bd-add-heading").textContent = "Record a measurement";
  }

  $("bd-form").addEventListener("submit", async event => {
    event.preventDefault();
    const fail = (text, id) => { $("bd-status").textContent = text; $("bd-status").classList.add("error"); if (id) $(id).focus(); };
    const entry = { date: $("bd-date").value || todayString(), note: $("bd-note").value.trim() };
    for (const ind of INDICATORS) {
      const v = parseNum($("bd-" + ind.key).value);
      if (Number.isNaN(v)) { fail(`Check ${ind.label.toLowerCase()}: use digits only, like 21,5.`, "bd-" + ind.key); return; }
      if (v !== null && ind.integer && !Number.isInteger(v)) { fail(`${ind.label} is a whole number, like 8.`, "bd-" + ind.key); return; }
      if (v !== null && ind.unit === "%" && v > 100) { fail(`${ind.label} can't be more than 100%.`, "bd-" + ind.key); return; }
      entry[ind.key] = v;
    }
    if (INDICATORS.every(ind => entry[ind.key] === null)) { fail("Fill in at least one number.", "bd-weight_kg"); return; }
    const wasEditing = Boolean(editingId);
    $("bd-save").disabled = true;
    const ok = await attempt("bd-status", () => wasEditing ? measurements.update(editingId, entry) : measurements.insert(entry));
    $("bd-save").disabled = false;
    if (!ok) return;
    resetForm();
    say("bd-status", wasEditing ? "Changes saved." : `Saved the measurement of ${shortDate(entry.date)}.`);
    refresh();
  });
  $("bd-cancel").addEventListener("click", () => { resetForm(); say("bd-status", ""); refresh(); });

  $("bd-list").addEventListener("click", async event => {
    const btn = event.target.closest("button[data-action]");
    if (!btn) return;
    const id = btn.closest("li").dataset.id;
    const action = btn.dataset.action;
    if (action === "edit") {
      const m = measurements.get(id);
      editingId = id; confirmingId = null;
      $("bd-date").value = m.date;
      INDICATORS.forEach(ind => { $("bd-" + ind.key).value = has(m[ind.key]) ? fmt(ind, m[ind.key]).replace(/\./g, "") : ""; });
      $("bd-note").value = m.note || "";
      $("bd-save").textContent = "Save changes";
      $("bd-cancel").hidden = false;
      $("bd-add-heading").textContent = "Edit measurement";
      say("bd-status", "");
      refresh();
      $("bd-form").scrollIntoView({ behavior: "smooth", block: "start" });
    }
    if (action === "delete") { confirmingId = id; refresh(); }
    if (action === "keep") { confirmingId = null; refresh(); }
    if (action === "confirm-delete") {
      if (!await attempt("bd-status", () => measurements.remove(id))) return;
      if (editingId === id) resetForm();
      confirmingId = null;
      say("bd-status", "Measurement deleted.");
      refresh();
    }
  });
  $("bd-more").addEventListener("click", () => { shown += 20; refresh(); });

  // A bar with the normal zone shaded and a dot where the value is
  function gauge(ind, value, r) {
    if (!r) return "";
    const low = r.low === null ? 0 : r.low;
    const span = (r.high - low) || 1;
    const min = Math.max(0, low - span * 0.75), max = r.high + span * 0.75;
    const pos = v => Math.min(100, Math.max(0, (v - min) / (max - min) * 100));
    return `<div class="gauge" aria-hidden="true">
      <div class="zone" style="left:${pos(low)}%;width:${pos(r.high) - pos(low)}%"></div>
      <div class="dot" style="left:${pos(Number(value))}%"></div></div>`;
  }

  function renderLatest() {
    const list = sorted();
    $("bd-latest-panel").hidden = !list.length;
    if (!list.length) return;
    // The latest value of each indicator (a scale may skip one now and then)
    $("bd-latest-date").textContent = niceDate(list[0].date);
    $("bd-latest").innerHTML = INDICATORS.map(ind => {
      const m = list.find(x => has(x[ind.key]));
      if (!m) return `<li><div class="line"><span>${ind.label}</span><span class="muted small">not recorded</span></div></li>`;
      const r = rangeFor(ind, m);
      const s = statusOf(m[ind.key], r);
      const older = m !== list[0] ? ` <span class="muted small">(${shortDate(m.date)})</span>` : "";
      const okNote = s === "above" && ind.higherOk ? " · above normal is usually fine here" : "";
      return `<li><div class="line"><span>${ind.label}${older}</span>
          <span class="val">${withUnit(ind, m[ind.key])} ${pill(s)}</span></div>
        ${gauge(ind, m[ind.key], r)}
        ${r ? `<span class="muted small">${rangeText(ind, r)} (${escapeHtml(r.why)})${okNote}</span>` : ""}</li>`;
    }).join("");
  }

  function renderList() {
    const list = sorted();
    $("bd-empty").hidden = list.length > 0;
    $("bd-more").hidden = list.length <= shown;
    $("bd-list").innerHTML = list.slice(0, shown).map(m => {
      const actions = confirmingId === m.id
        ? `<span class="ask">Delete this measurement?</span>
           <button type="button" class="link" data-action="keep">Keep</button>
           <button type="button" class="danger" data-action="confirm-delete">Yes, delete</button>`
        : editDeleteButtons();
      const values = INDICATORS.filter(ind => ind.key !== "weight_kg" && has(m[ind.key]))
        .map(ind => {
          const s = statusOf(m[ind.key], rangeFor(ind, m));
          return `<span class="${s && s !== "normal" ? "off" : ""}">${ind.label} ${withUnit(ind, m[ind.key])}</span>`;
        }).join(" · ");
      return `<li data-id="${m.id}" class="${editingId === m.id ? "editing" : ""}">
        <div class="what"><span class="cat">${niceDate(m.date)}</span>
          <span class="meta bd-values">${[values, m.note ? escapeHtml(m.note) : ""].filter(Boolean).join(" · ")}</span></div>
        <span class="price">${has(m.weight_kg) ? withUnit(INDICATORS[0], m.weight_kg) : ""}</span>
        <div class="row-actions">${actions}</div></li>`;
    }).join("");
  }

  // ===================== Progress tab =====================
  $("bd-period").addEventListener("click", event => {
    const btn = event.target.closest("[data-days]");
    if (!btn) return;
    periodDays = Number(btn.dataset.days);
    refresh();
  });

  // One line chart: points over time, with the normal range as a shaded band behind them
  const W = 320, H = 150, PAD = { left: 40, right: 10, top: 10, bottom: 24 };
  function chart(ind, points, r) {
    const values = points.map(p => p.v);
    let lo = Math.min(...values), hi = Math.max(...values);
    if (r) { lo = Math.min(lo, r.low ?? r.high); hi = Math.max(hi, r.high); }
    const pad = (hi - lo) * 0.12 || Math.max(1, Math.abs(hi) * 0.05);
    lo -= pad; hi += pad;
    if (ind.integer || ind.unit === "%" || ind.unit === "kg") lo = Math.max(0, lo);
    const t0 = parseIso(points[0].date).getTime(), t1 = parseIso(points[points.length - 1].date).getTime();
    const x = date => points.length === 1 ? (PAD.left + W - PAD.right) / 2
      : PAD.left + (parseIso(date).getTime() - t0) / (t1 - t0) * (W - PAD.left - PAD.right);
    const y = v => PAD.top + (hi - v) / (hi - lo) * (H - PAD.top - PAD.bottom);
    const ticks = [lo + (hi - lo) * 0.15, (lo + hi) / 2, hi - (hi - lo) * 0.15];
    const band = r ? (() => {
      const top = y(Math.min(r.high, hi)), bottom = y(Math.max(r.low ?? lo, lo));
      return `<rect class="band" x="${PAD.left}" y="${top}" width="${W - PAD.left - PAD.right}" height="${Math.max(0, bottom - top)}"/>`;
    })() : "";
    const path = points.map((p, i) => `${i ? "L" : "M"}${x(p.date).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ");
    return `<svg viewBox="0 0 ${W} ${H}" class="bd-chart" role="img" aria-label="${ind.label} over time">
      ${band}
      ${ticks.map(t => `<line class="grid" x1="${PAD.left}" x2="${W - PAD.right}" y1="${y(t)}" y2="${y(t)}"/>
        <text class="tick" x="${PAD.left - 6}" y="${y(t) + 4}" text-anchor="end">${ind.integer ? Math.round(t) : one.format(t)}</text>`).join("")}
      <text class="tick" x="${PAD.left}" y="${H - 6}">${shortDate(points[0].date)}</text>
      ${points.length > 1 ? `<text class="tick" x="${W - PAD.right}" y="${H - 6}" text-anchor="end">${shortDate(points[points.length - 1].date)}</text>` : ""}
      ${points.length > 1 ? `<path class="line" d="${path}"/>` : ""}
      ${points.map((p, i) => `<circle class="pt${i === points.length - 1 ? " last" : ""}" cx="${x(p.date)}" cy="${y(p.v)}" r="${i === points.length - 1 ? 5 : 3.5}"/>`).join("")}
      <line class="cross" y1="${PAD.top}" y2="${H - PAD.bottom}" x1="0" x2="0" visibility="hidden"/>
      <circle class="hl" r="6" cx="0" cy="0" visibility="hidden"/>
    </svg>`;
  }

  // Charts drawn last time, so tapping one can show the nearest point
  let chartData = {};
  $("bd-charts").addEventListener("click", event => showPoint(event));
  $("bd-charts").addEventListener("pointermove", event => { if (event.pointerType === "mouse") showPoint(event); });
  function showPoint(event) {
    const svg = event.target.closest("svg.bd-chart");
    if (!svg) return;
    const key = svg.closest("[data-ind]").dataset.ind;
    const { ind, points, xs, ys } = chartData[key];
    const box = svg.getBoundingClientRect();
    const px = (event.clientX - box.left) / box.width * W;
    let best = 0;
    xs.forEach((v, i) => { if (Math.abs(v - px) < Math.abs(xs[best] - px)) best = i; });
    const cross = svg.querySelector(".cross"), hl = svg.querySelector(".hl");
    cross.setAttribute("x1", xs[best]); cross.setAttribute("x2", xs[best]); cross.setAttribute("visibility", "visible");
    hl.setAttribute("cx", xs[best]); hl.setAttribute("cy", ys[best]); hl.setAttribute("visibility", "visible");
    const p = points[best];
    const s = statusOf(p.v, p.r);
    svg.closest("[data-ind]").querySelector(".readout").innerHTML = `${niceDate(p.date)}: <strong>${withUnit(ind, p.v)}</strong> ${pill(s)}`;
  }

  function renderProgress() {
    document.querySelectorAll("#bd-period [data-days]").forEach(b => b.setAttribute("aria-pressed", String(Number(b.dataset.days) === periodDays)));
    const from = periodDays ? addDays(todayString(), -periodDays) : "0000";
    const list = sorted().reverse().filter(m => m.date >= from);
    const any = measurements.rows.length > 0;
    $("bd-progress-empty").hidden = list.length > 0;
    $("bd-progress-empty").textContent = any ? "No measurements in this period. Choose a longer period."
      : "No measurements yet. Record one on the Record tab, and each number gets its own chart here.";
    chartData = {};
    if (!list.length) { $("bd-charts").innerHTML = ""; return; }

    $("bd-charts").innerHTML = INDICATORS.map(ind => {
      const rows = list.filter(m => has(m[ind.key]));
      if (!rows.length) return "";
      const points = rows.map(m => ({ date: m.date, v: Number(m[ind.key]), r: rangeFor(ind, m) }));
      const last = points[points.length - 1], first = points[0];
      const s = statusOf(last.v, last.r);
      const diff = last.v - first.v;
      const changeText = points.length < 2 ? "only one measurement in this period"
        : Math.abs(diff) < 10 ** -ind.digits / 2 ? `no change since ${shortDate(first.date)}`
        : `${diff > 0 ? "↑" : "↓"} ${withUnit(ind, Math.abs(diff))} since ${shortDate(first.date)}`;
      // Remember where each point is drawn, for tapping
      const svgHtml = chart(ind, points, last.r);
      const xs = [...svgHtml.matchAll(/class="pt[^"]*" cx="([\d.]+)" cy="([\d.]+)"/g)];
      chartData[ind.key] = { ind, points, xs: xs.map(m => Number(m[1])), ys: xs.map(m => Number(m[2])) };
      return `<section class="panel" data-ind="${ind.key}">
        <div class="panel-head"><h2 data-icon="${IND_ICON[ind.key][0]}" data-tone="${IND_ICON[ind.key][1]}">${ind.label}</h2><span class="figure">${withUnit(ind, last.v)}</span></div>
        <div class="line-info">${pill(s)} <span class="muted small">${changeText}${last.r ? " · " + rangeText(ind, last.r) : ""}</span></div>
        ${svgHtml}
        <p class="readout small muted">Tap the chart to read a point.</p>
      </section>`;
    }).join("");
  }

  // ===================== Profile tab =====================
  function fillProfile() {
    const p = profile() || {};
    $("bd-height").value = p.height_cm ? one.format(p.height_cm) : "";
    $("bd-birth").value = p.birth_date || "";
    document.querySelectorAll('input[name="bd-sex"]').forEach(i => { i.checked = i.value === p.sex; });
    $("bd-ethnicity").value = p.ethnicity || "";
  }
  function renderProfileSummary() {
    const p = profile();
    if (!profileComplete(p)) { $("bd-profile-summary").textContent = ""; return; }
    const age = ageOn(p.birth_date, todayString());
    const eth = ETHNICITIES.find(e => e[0] === p.ethnicity)?.[1] || "";
    $("bd-profile-summary").textContent = `${age} years old · ${one.format(p.height_cm)} cm · ${p.sex === "female" ? "Female" : "Male"} · ${eth}.` +
      (age < 18 ? " The normal ranges are made for adults (18 and over), so take them as a rough guide." : "");
  }

  $("bd-profile-form").addEventListener("submit", async event => {
    event.preventDefault();
    const fail = text => { $("bd-profile-status").textContent = text; $("bd-profile-status").classList.add("error"); };
    const height = parseNum($("bd-height").value);
    const sex = document.querySelector('input[name="bd-sex"]:checked')?.value;
    const entry = { height_cm: height, birth_date: $("bd-birth").value || null, sex: sex || null, ethnicity: $("bd-ethnicity").value || null };
    if (!height || Number.isNaN(height) || height < 50 || height > 250) { fail("Enter your height in centimetres, like 170."); $("bd-height").focus(); return; }
    if (!entry.birth_date || entry.birth_date >= todayString()) { fail("Choose your birth date."); $("bd-birth").focus(); return; }
    if (!entry.sex) { fail("Choose male or female."); return; }
    if (!entry.ethnicity) { fail("Choose your ethnicity."); $("bd-ethnicity").focus(); return; }
    const existing = profile();
    $("bd-profile-save").disabled = true;
    const ok = await attempt("bd-profile-status", () => existing ? profiles.update(existing.id, entry) : profiles.insert(entry));
    $("bd-profile-save").disabled = false;
    if (!ok) return;
    say("bd-profile-status", "Profile saved. The normal ranges now use it.");
    refresh();
  });

  // ===================== Draw everything =====================
  mod.onEnter = () => { resetForm(); fillProfile(); };
  mod.render = () => {
    const ready = measurements.ready && profiles.ready;
    $("bd-missing").hidden = ready;
    mod.el.querySelectorAll("[data-panel]").forEach(p => { p.style.display = ready ? "" : "none"; });
    if (!ready) return;
    $("bd-need-profile").hidden = profileComplete(profile());
    renderLatest();
    renderList();
    renderProgress();
    renderProfileSummary();
  };

  // ---- Home card: the latest weight and which numbers are outside the normal range ----
  mod.home = card => {
    if (!(measurements.ready && profiles.ready)) {
      card.innerHTML = `<div class="panel-head"><h2>Body</h2></div>${setupNotice()}`;
      return;
    }
    const list = sorted();
    const head = `<div class="panel-head"><h2>Body</h2><a href="#body">Record a measurement</a></div>`;
    if (!list.length) {
      card.innerHTML = head + `<div class="lines"><span class="muted">No measurements yet.</span></div>`;
      return;
    }
    const latest = list[0];
    const judged = INDICATORS.filter(ind => has(latest[ind.key]))
      .map(ind => ({ ind, s: statusOf(latest[ind.key], rangeFor(ind, latest)) })).filter(x => x.s);
    const off = judged.filter(x => x.s !== "normal");
    const w = INDICATORS[0];
    const summary = !profileComplete(profile()) ? `<a href="#body/profile">Fill in your profile</a> to see what's normal for you.`
      : !judged.length ? ""
      : off.length ? `${judged.length - off.length} of ${judged.length} normal. ${off.map(x => `${x.ind.label}: ${STATUS[x.s][1].toLowerCase()}`).join(", ")}.`
      : `All ${judged.length} numbers in the normal range.`;
    card.innerHTML = head + `
      <div class="lines">
        ${has(latest.weight_kg) ? `<span class="big">${withUnit(w, latest.weight_kg)}</span>` : ""}
        <span class="muted small">Last measured ${niceDate(latest.date)}</span>
        ${summary ? `<span class="small">${summary}</span>` : ""}
      </div>`;
  };
})();
