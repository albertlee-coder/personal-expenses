// Exercise: record every workout, optionally keep a weekly plan (Monday: arms, Tuesday: squats...),
// and get feedback on the week: active minutes, strength sessions, body areas not trained yet, missed plans.
// A workout (table `workouts`): { id, date, type: "Weights", duration_min: 45, intensity: "moderate",
//   body_parts: ["Arms", "Chest"], distance_km: null, note }
// A plan item (table `exercise_plan`): { id, weekday: 1 (Monday) ... 7 (Sunday), title: "Arm day",
//   type: "Weights", body_parts: ["Arms"], duration_min: 45 }
(() => {
  // Areas that count as strength training, plus cardio
  const STRENGTH = ["Arms", "Chest", "Back", "Shoulders", "Legs", "Core"];
  const AREAS = [...STRENGTH, "Cardio"];
  // Suggested activities and the areas they usually train (you can change the areas on each workout)
  const TYPES = {
    "RPM": ["Cardio"], "Cycling": ["Cardio"], "Walk": ["Cardio"], "Running": ["Cardio"],
    "Weights": [], "Swimming": ["Cardio"], "Yoga": ["Core"], "Badminton": ["Cardio"]
  };
  const INTENSITIES = [["light", "Light"], ["moderate", "Moderate"], ["hard", "Hard"]];
  // WHO: at least 150 minutes of moderate activity a week (a hard minute counts as two),
  // and muscle-strengthening on at least 2 days a week
  const WEEK_MINUTES = 150;
  const WEEK_STRENGTH = 2;

  const areaChips = (name) => `<fieldset class="chips" id="${name}-areas"><legend>Body areas trained</legend>${AREAS.map(a =>
    `<label class="chip"><input type="checkbox" value="${a}"><span>${a}</span></label>`).join("")}</fieldset>`;
  const typeOptions = Object.keys(TYPES).map(t => `<option value="${t}"></option>`).join("");

  const mod = defineModule({
    id: "exercise",
    title: "Exercise",
    tabs: [{ id: "log", label: "Record" }, { id: "plan", label: "Weekly plan" }],
    html: `
    <div id="ex-missing" hidden>${setupNotice()}</div>
    <datalist id="ex-types">${typeOptions}</datalist>

    <!-- ===== Record tab ===== -->
    <div class="view" data-panel="log">
      <section class="panel" aria-labelledby="ex-week-heading">
        <div class="panel-head">
          <h2 id="ex-week-heading">This week</h2>
          <span class="figure" id="ex-week-minutes"></span>
        </div>
        <div class="cal-nav">
          <button type="button" id="ex-prev" aria-label="Previous week">‹</button>
          <strong id="ex-week-label" aria-live="polite"></strong>
          <button type="button" id="ex-next" aria-label="Next week">›</button>
        </div>
        <ul class="meters" id="ex-week-meters"></ul>
        <div class="area-chips" id="ex-week-areas"></div>
        <ul class="plan-check" id="ex-week-plan"></ul>
        <div><strong class="small">Suggestions</strong><ul class="advice" id="ex-advice"></ul></div>
      </section>

      <section aria-labelledby="ex-add-heading">
        <h2 id="ex-add-heading">Record a workout</h2>
        <div class="quick-add" id="ex-from-plan" hidden></div>
        <form class="entry" id="ex-form" novalidate>
          <div class="field">
            <label for="ex-date">Date</label>
            <input id="ex-date" type="date" required>
          </div>
          <div class="field">
            <label for="ex-type">Activity</label>
            <input id="ex-type" list="ex-types" maxlength="40" autocomplete="off" placeholder="RPM, Walk, Weights…">
          </div>
          <div class="field">
            <label for="ex-duration">Minutes</label>
            <input id="ex-duration" inputmode="numeric" autocomplete="off" placeholder="45">
          </div>
          <div class="field">
            <label for="ex-distance">Distance in km (optional)</label>
            <input id="ex-distance" inputmode="decimal" autocomplete="off">
          </div>
          <fieldset class="chips field wide" id="ex-intensity"><legend>How hard was it?</legend>${INTENSITIES.map(([v, l]) =>
            `<label class="chip"><input type="radio" name="ex-intensity" value="${v}" ${v === "moderate" ? "checked" : ""}><span>${l}</span></label>`).join("")}</fieldset>
          <div class="field wide">${areaChips("ex")}</div>
          <div class="field wide">
            <label for="ex-note">Note (optional)</label>
            <input id="ex-note" maxlength="200" autocomplete="off" placeholder="Bicep curls 3×12, 10 kg">
          </div>
          <div class="actions">
            <button type="submit" class="primary" id="ex-save">Save workout</button>
            <button type="button" id="ex-cancel" hidden>Cancel editing</button>
            <span class="hint" id="ex-status" role="status"></span>
          </div>
        </form>
      </section>

      <section aria-labelledby="ex-list-heading">
        <h2 id="ex-list-heading">Recent workouts</h2>
        <p class="empty" id="ex-empty">No workouts yet. Record your first one with the form above.</p>
        <ul class="list" id="ex-list"></ul>
        <button type="button" id="ex-more" hidden>Show older workouts</button>
      </section>
    </div>

    <!-- ===== Weekly plan tab ===== -->
    <div class="view" data-panel="plan" hidden>
      <p class="muted">A plan is optional: you can always record any workout. When you have a plan,
        the week check on the Record tab shows which planned days you did or missed.</p>
      <section aria-labelledby="plan-add-heading">
        <h2 id="plan-add-heading">Add to the plan</h2>
        <form class="entry" id="plan-form" novalidate>
          <div class="field">
            <label for="plan-weekday">Day</label>
            <select id="plan-weekday">${WEEKDAYS.map((d, i) => `<option value="${i + 1}">${d}</option>`).join("")}</select>
          </div>
          <div class="field">
            <label for="plan-title">Name</label>
            <input id="plan-title" maxlength="40" autocomplete="off" placeholder="Arm day">
          </div>
          <div class="field">
            <label for="plan-type">Activity</label>
            <input id="plan-type" list="ex-types" maxlength="40" autocomplete="off" placeholder="Weights">
          </div>
          <div class="field">
            <label for="plan-duration">Minutes (optional)</label>
            <input id="plan-duration" inputmode="numeric" autocomplete="off" placeholder="45">
          </div>
          <div class="field wide">${areaChips("plan")}</div>
          <div class="actions">
            <button type="submit" class="primary" id="plan-save">Add to plan</button>
            <button type="button" id="plan-cancel" hidden>Cancel editing</button>
            <span class="hint" id="plan-status" role="status"></span>
          </div>
        </form>
      </section>
      <section aria-labelledby="plan-week-heading">
        <h2 id="plan-week-heading">Your week</h2>
        <ul class="plan-week" id="plan-week"></ul>
      </section>
    </div>`
  });

  const workouts = new Table("workouts");
  const plan = new Table("exercise_plan");
  let editingId = null, confirmingId = null;
  let editingPlanId = null, confirmingPlanId = null;
  let weekOffset = 0;   // 0 = this week, -1 = last week...
  let shown = 20;       // how many workouts the list shows

  mod.load = () => Promise.all([workouts.load(), plan.load()]);
  function refresh() { renderAll(); }

  // ---- Small helpers ----
  const areasOf = r => Array.isArray(r.body_parts) ? r.body_parts : [];
  const sameText = (a, b) => (a || "").trim().toLowerCase() === (b || "").trim().toLowerCase();
  function getAreas(name) { return [...document.querySelectorAll(`#${name}-areas input:checked`)].map(i => i.value); }
  function setAreas(name, list) { document.querySelectorAll(`#${name}-areas input`).forEach(i => { i.checked = list.includes(i.value); }); }
  function knownType(text) { return Object.keys(TYPES).find(t => sameText(t, text)); }
  function workoutLine(w) {
    return [w.type, w.duration_min ? `${w.duration_min} min` : "", w.distance_km ? `${one.format(w.distance_km)} km` : "",
      areasOf(w).join(", "), w.intensity && w.intensity !== "moderate" ? INTENSITIES.find(i => i[0] === w.intensity)?.[1] : ""]
      .filter(Boolean).map(escapeHtml).join(" · ");
  }
  function planLine(p) {
    return [p.type, p.duration_min ? `${p.duration_min} min` : "", areasOf(p).join(", ")].filter(Boolean).map(escapeHtml).join(" · ");
  }
  function planFor(day) { return plan.rows.filter(p => Number(p.weekday) === day).sort((a, b) => (a.created_at || "").localeCompare(b.created_at || "")); }
  // A planned item counts as done when a workout that day has the same activity or trains one of its areas
  function matches(p, w) {
    if (p.type && sameText(p.type, w.type)) return true;
    return areasOf(p).some(a => areasOf(w).includes(a));
  }
  function weekdayName(day) { return WEEKDAYS[day - 1]; }

  // Everything the week check needs, for the week starting on Monday `start`
  function weekStats(start) {
    const end = addDays(start, 6);
    const today = todayString();
    const list = workouts.rows.filter(w => w.date >= start && w.date <= end);
    const minutes = list.reduce((s, w) => s + (Number(w.duration_min) || 0) * (w.intensity === "hard" ? 2 : 1), 0);
    const strength = new Set(list.filter(w => areasOf(w).some(a => STRENGTH.includes(a))).map(w => w.date)).size;
    const areaCount = Object.fromEntries(AREAS.map(a => [a, list.filter(w => areasOf(w).includes(a)).length]));
    const planned = [];
    for (let day = 1; day <= 7; day++) {
      const date = addDays(start, day - 1);
      for (const p of planFor(day)) {
        const done = list.some(w => w.date === date && matches(p, w));
        planned.push({ p, day, date, state: done ? "done" : date < today ? "missed" : date === today ? "today" : "later" });
      }
    }
    return { start, end, list, minutes, strength, areaCount, planned, current: today >= start && today <= end };
  }
  // The last date each area was trained, on or before `upTo`
  function lastTrained(area, upTo) {
    return workouts.rows.filter(w => w.date <= upTo && areasOf(w).includes(area)).map(w => w.date).sort().pop() || null;
  }

  // The feedback sentences for a week
  function suggestions(s) {
    const out = [];
    const today = todayString();
    const thisWeek = s.current ? "this week" : "that week";
    const upTo = s.current ? today : s.end;
    // Body areas not trained yet
    const missing = STRENGTH.filter(a => !s.areaCount[a]);
    if (missing.length) {
      const coming = s.current ? missing.filter(a => s.planned.some(x => x.date >= today && x.state !== "done" && areasOf(x.p).includes(a))) : [];
      const open = missing.filter(a => !coming.includes(a));
      if (open.length) {
        const ago = open.map(a => { const d = lastTrained(a, upTo); return d ? `${a} ${daysBetween(d, upTo)} days ago` : null; }).filter(Boolean);
        out.push(`Not trained ${thisWeek}: <strong>${open.join(", ")}</strong>.` + (ago.length ? ` Last time: ${ago.join(", ")}.` : ""));
      }
      if (coming.length) out.push(`${coming.join(", ")} still planned later ${thisWeek}.`);
    }
    // Planned days that were missed
    const missed = s.planned.filter(x => x.state === "missed");
    if (missed.length) out.push(`Missed from the plan: ${missed.map(x => `${weekdayName(x.day)} (${escapeHtml(x.p.title || x.p.type)})`).join(", ")}.`);
    // Active minutes
    if (s.minutes < WEEK_MINUTES) {
      const left = WEEK_MINUTES - s.minutes;
      const daysLeft = s.current ? daysBetween(today, s.end) + 1 : 0;
      out.push(`${left} more active minutes to reach ${WEEK_MINUTES} ${thisWeek}` +
        (daysLeft ? ` — about ${Math.ceil(left / daysLeft)} minutes a day for the ${plural(daysLeft, "day")} left (a brisk walk counts).` : "."));
    }
    // Strength days
    if (s.strength < WEEK_STRENGTH) {
      const need = WEEK_STRENGTH - s.strength;
      out.push(`${need} more strength ${need === 1 ? "day" : "days"} would reach the advised ${WEEK_STRENGTH} a week.`);
    }
    if (!out.length) out.push(`Great week: ${WEEK_MINUTES}+ active minutes, ${WEEK_STRENGTH}+ strength days and every area trained.`);
    return out;
  }

  // ===================== Record tab =====================
  $("ex-date").value = todayString();
  let areasTouched = false; // stop filling in areas from the activity once you pick them yourself
  $("ex-areas").addEventListener("change", () => { areasTouched = true; });
  $("ex-type").addEventListener("input", () => {
    const t = knownType($("ex-type").value);
    if (t && !areasTouched) setAreas("ex", TYPES[t]);
  });
  $("plan-type").addEventListener("input", () => {
    const t = knownType($("plan-type").value);
    if (t && !getAreas("plan").length) setAreas("plan", TYPES[t]);
  });

  function resetForm() {
    editingId = null; areasTouched = false;
    ["ex-type", "ex-duration", "ex-distance", "ex-note"].forEach(id => { $(id).value = ""; });
    $("ex-date").value = todayString();
    document.querySelector('input[name="ex-intensity"][value="moderate"]').checked = true;
    setAreas("ex", []);
    $("ex-save").textContent = "Save workout";
    $("ex-cancel").hidden = true;
    $("ex-add-heading").textContent = "Record a workout";
  }
  function fillForm(w) {
    $("ex-type").value = w.type || "";
    $("ex-duration").value = w.duration_min || "";
    $("ex-distance").value = w.distance_km ? one.format(w.distance_km) : "";
    $("ex-note").value = w.note || "";
    const intensity = document.querySelector(`input[name="ex-intensity"][value="${w.intensity || "moderate"}"]`);
    if (intensity) intensity.checked = true;
    setAreas("ex", areasOf(w));
    areasTouched = true;
  }

  $("ex-form").addEventListener("submit", async event => {
    event.preventDefault();
    const type = $("ex-type").value.trim();
    const minutes = parseAmount($("ex-duration").value);
    const distance = parseNum($("ex-distance").value);
    const fail = text => { $("ex-status").textContent = text; $("ex-status").classList.add("error"); };
    if (!type) { fail("Type the activity, for example Walk or Weights."); $("ex-type").focus(); return; }
    if (!minutes) { fail("Enter how many minutes."); $("ex-duration").focus(); return; }
    if (Number.isNaN(distance)) { fail("Check the distance: use digits only."); return; }
    const entry = {
      date: $("ex-date").value || todayString(), type: knownType(type) || type, duration_min: minutes,
      intensity: document.querySelector('input[name="ex-intensity"]:checked').value,
      body_parts: getAreas("ex"), distance_km: distance || null, note: $("ex-note").value.trim()
    };
    const wasEditing = Boolean(editingId);
    $("ex-save").disabled = true;
    const ok = await attempt("ex-status", () => wasEditing ? workouts.update(editingId, entry) : workouts.insert(entry));
    $("ex-save").disabled = false;
    if (!ok) return;
    resetForm();
    say("ex-status", wasEditing ? "Changes saved." : `Saved: ${entry.type}, ${entry.duration_min} min.`);
    refresh();
  });
  $("ex-cancel").addEventListener("click", () => { resetForm(); say("ex-status", ""); refresh(); });

  // "Record today's plan" buttons fill the form from a plan item
  $("ex-from-plan").addEventListener("click", event => {
    const btn = event.target.closest("[data-plan]");
    if (!btn) return;
    const p = plan.get(btn.dataset.plan);
    resetForm();
    fillForm({ type: p.type || p.title, duration_min: p.duration_min, body_parts: areasOf(p), note: p.title || "" });
    say("ex-status", "Filled in from your plan. Adjust anything, then save.");
    $("ex-duration").focus();
  });

  $("ex-list").addEventListener("click", async event => {
    const btn = event.target.closest("button[data-action]");
    if (!btn) return;
    const id = btn.closest("li").dataset.id;
    const action = btn.dataset.action;
    if (action === "edit") {
      const w = workouts.get(id);
      editingId = id; confirmingId = null;
      $("ex-date").value = w.date;
      fillForm(w);
      $("ex-save").textContent = "Save changes";
      $("ex-cancel").hidden = false;
      $("ex-add-heading").textContent = "Edit workout";
      say("ex-status", "");
      refresh();
      $("ex-form").scrollIntoView({ behavior: "smooth", block: "start" });
    }
    if (action === "delete") { confirmingId = id; refresh(); }
    if (action === "keep") { confirmingId = null; refresh(); }
    if (action === "confirm-delete") {
      if (!await attempt("ex-status", () => workouts.remove(id))) return;
      if (editingId === id) resetForm();
      confirmingId = null;
      say("ex-status", "Workout deleted.");
      refresh();
    }
  });
  $("ex-more").addEventListener("click", () => { shown += 20; refresh(); });
  $("ex-prev").addEventListener("click", () => { weekOffset--; refresh(); });
  $("ex-next").addEventListener("click", () => { if (weekOffset < 0) weekOffset++; refresh(); });

  function renderWeek() {
    const start = addDays(weekStart(todayString()), 7 * weekOffset);
    const s = weekStats(start);
    $("ex-week-heading").textContent = weekOffset === 0 ? "This week" : weekOffset === -1 ? "Last week" : "Week";
    $("ex-week-label").textContent = `${shortDate(s.start)} – ${shortDate(s.end)}`;
    $("ex-next").disabled = weekOffset >= 0;
    $("ex-week-minutes").textContent = plural(s.list.length, "workout");
    const bar = (label, value, goal, unit) => {
      const lvl = value >= goal ? "" : value >= goal / 2 ? "watch" : "high";
      return `<li><div class="line"><span>${label}</span><span class="val">${value} <span class="muted">/ ${goal} ${unit}</span></span></div>
        <div class="track"><div class="fill ${lvl}" style="width:${Math.min(100, value / goal * 100)}%"></div></div></li>`;
    };
    $("ex-week-meters").innerHTML =
      bar("Active minutes (a hard minute counts double)", s.minutes, WEEK_MINUTES, "min") +
      bar("Strength days", s.strength, WEEK_STRENGTH, "days");
    $("ex-week-areas").innerHTML = AREAS.map(a => {
      const n = s.areaCount[a];
      const cls = n ? "hit" : STRENGTH.includes(a) ? "miss" : "";
      return `<span class="area ${cls}" title="${a}: ${plural(n, "workout")}">${a}${n ? ` ${n}×` : ""}</span>`;
    }).join("");
    const MARK = { done: ["ok", "✓ done"], missed: ["miss", "✗ missed"], today: ["later", "today"], later: ["later", "coming"] };
    $("ex-week-plan").innerHTML = s.planned.map(x => {
      const [cls, word] = MARK[x.state];
      return `<li><span class="${cls}">${word}</span> · ${weekdayName(x.day)}: ${escapeHtml(x.p.title || x.p.type)}</li>`;
    }).join("");
    $("ex-advice").innerHTML = suggestions(s).map(t => `<li>${t}</li>`).join("");
  }

  function renderLog() {
    renderWeek();
    // Today's plan, as buttons that fill in the form
    const todays = planFor(weekday(todayString()));
    $("ex-from-plan").hidden = !todays.length || Boolean(editingId);
    $("ex-from-plan").innerHTML = `<span class="muted small" style="align-self:center">Today's plan:</span>` +
      todays.map(p => `<button type="button" data-plan="${p.id}">Record “${escapeHtml(p.title || p.type)}”</button>`).join("");

    const sorted = [...workouts.rows].sort((a, b) => b.date.localeCompare(a.date) || (b.created_at || "").localeCompare(a.created_at || ""));
    $("ex-empty").hidden = sorted.length > 0;
    $("ex-more").hidden = sorted.length <= shown;
    $("ex-list").innerHTML = sorted.slice(0, shown).map(w => {
      const actions = confirmingId === w.id
        ? `<span class="ask">Delete this workout?</span>
           <button type="button" class="link" data-action="keep">Keep</button>
           <button type="button" class="danger" data-action="confirm-delete">Yes, delete</button>`
        : `<button type="button" class="link" data-action="edit">Edit</button>
           <button type="button" class="link del" data-action="delete">Delete</button>`;
      return `<li data-id="${w.id}" class="${editingId === w.id ? "editing" : ""}">
        <div class="what"><span class="cat">${escapeHtml(w.type)}</span>
          <span class="meta">${[niceDate(w.date), workoutLine({ ...w, type: "" }), w.note ? escapeHtml(w.note) : ""].filter(Boolean).join(" · ")}</span></div>
        <span class="price">${w.duration_min ? w.duration_min + " min" : ""}</span>
        <div class="row-actions">${actions}</div></li>`;
    }).join("");
  }

  // ===================== Weekly plan tab =====================
  function resetPlanForm() {
    editingPlanId = null;
    ["plan-title", "plan-type", "plan-duration"].forEach(id => { $(id).value = ""; });
    setAreas("plan", []);
    $("plan-save").textContent = "Add to plan";
    $("plan-cancel").hidden = true;
    $("plan-add-heading").textContent = "Add to the plan";
  }
  $("plan-form").addEventListener("submit", async event => {
    event.preventDefault();
    const title = $("plan-title").value.trim();
    const type = $("plan-type").value.trim();
    if (!title && !type) { $("plan-status").textContent = "Give it a name or an activity."; $("plan-status").classList.add("error"); return; }
    const entry = { weekday: Number($("plan-weekday").value), title, type: knownType(type) || type,
      body_parts: getAreas("plan"), duration_min: parseAmount($("plan-duration").value) || null };
    const wasEditing = Boolean(editingPlanId);
    const ok = await attempt("plan-status", () => wasEditing ? plan.update(editingPlanId, entry) : plan.insert(entry));
    if (!ok) return;
    resetPlanForm();
    say("plan-status", wasEditing ? "Changes saved." : `Added to ${weekdayName(entry.weekday)}.`);
    refresh();
  });
  $("plan-cancel").addEventListener("click", () => { resetPlanForm(); say("plan-status", ""); refresh(); });

  $("plan-week").addEventListener("click", async event => {
    const btn = event.target.closest("button[data-action]");
    if (!btn) return;
    const action = btn.dataset.action;
    if (action === "add-day") {
      resetPlanForm();
      $("plan-weekday").value = btn.dataset.day;
      $("plan-form").scrollIntoView({ behavior: "smooth", block: "start" });
      $("plan-title").focus({ preventScroll: true });
      return;
    }
    const id = btn.closest("li[data-id]").dataset.id;
    if (action === "edit") {
      const p = plan.get(id);
      editingPlanId = id; confirmingPlanId = null;
      $("plan-weekday").value = p.weekday; $("plan-title").value = p.title || ""; $("plan-type").value = p.type || "";
      $("plan-duration").value = p.duration_min || "";
      setAreas("plan", areasOf(p));
      $("plan-save").textContent = "Save changes";
      $("plan-cancel").hidden = false;
      $("plan-add-heading").textContent = "Edit plan";
      say("plan-status", "");
      $("plan-form").scrollIntoView({ behavior: "smooth", block: "start" });
    }
    if (action === "delete") confirmingPlanId = id;
    if (action === "keep") confirmingPlanId = null;
    if (action === "confirm-delete") {
      if (!await attempt("plan-status", () => plan.remove(id))) return;
      if (editingPlanId === id) resetPlanForm();
      confirmingPlanId = null;
      say("plan-status", "Removed from the plan.");
    }
    refresh();
  });

  function renderPlan() {
    const today = weekday(todayString());
    $("plan-week").innerHTML = [1, 2, 3, 4, 5, 6, 7].map(day => {
      const items = planFor(day);
      return `<li>
        <div class="wd-head"><strong>${weekdayName(day)}${day === today ? ' <span class="today-mark">· today</span>' : ""}</strong>
          <button type="button" class="link" data-action="add-day" data-day="${day}">+ Add</button></div>
        ${items.length ? `<ul class="plan-items">${items.map(p => {
          const actions = confirmingPlanId === p.id
            ? `<span class="ask small">Remove?</span>
               <button type="button" class="link" data-action="keep">Keep</button>
               <button type="button" class="danger" data-action="confirm-delete">Yes, remove</button>`
            : `<button type="button" class="link" data-action="edit">Edit</button>
               <button type="button" class="link del" data-action="delete">Remove</button>`;
          return `<li data-id="${p.id}"><span><strong>${escapeHtml(p.title || p.type)}</strong>
            <span class="muted small">${p.title ? planLine(p) : planLine({ ...p, type: "" })}</span></span>
            <span class="cat-actions">${actions}</span></li>`;
        }).join("")}</ul>` : `<span class="muted small">Free / rest day</span>`}
      </li>`;
    }).join("");
  }

  // ===================== Draw everything =====================
  mod.onEnter = () => { resetForm(); resetPlanForm(); };
  mod.render = () => {
    const ready = workouts.ready && plan.ready;
    $("ex-missing").hidden = ready;
    mod.el.querySelectorAll("[data-panel]").forEach(p => { p.style.display = ready ? "" : "none"; });
    if (!ready) return;
    renderLog();
    renderPlan();
  };

  // ---- Home card: today's plan and the week so far ----
  mod.home = card => {
    if (!(workouts.ready && plan.ready)) {
      card.innerHTML = `<div class="panel-head"><h2>Exercise</h2></div>${setupNotice()}`;
      return;
    }
    const today = todayString();
    const s = weekStats(weekStart(today));
    const todays = s.planned.filter(x => x.date === today);
    const doneToday = workouts.rows.filter(w => w.date === today);
    const planText = todays.length
      ? todays.map(x => `${x.state === "done" ? "✓ " : ""}${escapeHtml(x.p.title || x.p.type)}`).join(", ")
      : "nothing planned";
    card.innerHTML = `
      <div class="panel-head"><h2>Exercise</h2><a href="#exercise">Record a workout</a></div>
      <div class="lines">
        <span>Today's plan: <strong>${planText}</strong></span>
        ${doneToday.length ? `<span class="muted small">Done today: ${doneToday.map(w => escapeHtml(w.type)).join(", ")}</span>` : ""}
        <span class="muted small">This week: ${s.minutes} / ${WEEK_MINUTES} active min · ${s.strength} / ${WEEK_STRENGTH} strength days</span>
        <span class="small">${suggestions(s)[0]}</span>
      </div>`;
  };
})();
