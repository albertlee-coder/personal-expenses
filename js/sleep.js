// Sleep: record when you go to sleep and when you wake up, then see how long and how well you sleep.
// Every tap of the big buttons saves one moment (table `sleep_events`):
//   { id, at: "2026-11-09T16:05:00Z" (a date and time), kind: "sleep" | "wake", rating: 1–5 or null, note }
// The app joins these moments into nights: Sleep → Wake up is one stretch of sleep, and when you press Sleep
// again within 3 hours of waking up (for example after waking at 2 am), that stretch belongs to the same night.
// The rating ("How did you sleep?") is kept on a wake-up.
(() => {
  const SAME_NIGHT = 3 * 60;   // minutes: going back to sleep within this time is still the same night
  const LONGEST = 16 * 60;     // minutes: a sleep with no wake-up after this long means the wake-up was forgotten
  const GOAL_LOW = 7 * 60, GOAL_HIGH = 9 * 60; // recommended sleep for adults: 7 to 9 hours
  const FACES = [["😫", "Very bad"], ["😕", "Bad"], ["😐", "Okay"], ["🙂", "Good"], ["😄", "Great"]];

  // Drawings on the big buttons: a person asleep in bed, and a person sitting up and stretching
  const ART_SLEEP = `<svg viewBox="0 0 96 64" aria-hidden="true">
    <path class="fill" d="M73 6a10 10 0 1 0 11 13a8 8 0 0 1-11-13z"/>
    <path d="M38 22h6l-6 7h6M48 12h8l-8 9h8"/>
    <path d="M8 26v30M8 50h82M88 44v12"/>
    <rect class="fill" x="12" y="36" width="17" height="10" rx="5"/>
    <circle class="fill" cx="25" cy="33" r="6.5"/>
    <path class="fill" d="M31 50v-9c0-3 2-5 5-5h10c6 0 8-4 16-4c12 0 22 3 26 8v10z"/>
  </svg>`;
  const ART_WAKE = `<svg viewBox="0 0 96 64" aria-hidden="true">
    <circle class="fill" cx="76" cy="16" r="7"/>
    <path d="M76 3v3M76 26v3M63 16h3M86 16h3M67 7l2 2M83 23l2 2M85 7l-2 2M69 23l-2 2"/>
    <path d="M8 26v30M8 50h82M88 44v12"/>
    <rect class="fill" x="12" y="38" width="15" height="8" rx="4"/>
    <circle class="fill" cx="36" cy="15" r="6.5"/>
    <path d="M36 22v18M36 28l-8-6-3-10M36 28l8-6 3-10"/>
    <path class="fill" d="M34 50v-8c0-2 2-4 4-4h32c10 0 18 4 20 12z"/>
  </svg>`;

  const mod = defineModule({
    id: "sleep",
    title: "Sleep",
    tabs: [{ id: "log", label: "Record" }, { id: "dashboard", label: "Dashboard" }],
    html: `
    <div id="sl-missing" hidden>${setupNotice()}</div>

    <!-- ===== Record tab ===== -->
    <div class="view" data-panel="log">
      <section class="panel sl-quick" aria-labelledby="sl-quick-heading">
        <h2 id="sl-quick-heading" data-icon="🌙" data-tone="violet">Quick record</h2>
        <p class="sl-state" id="sl-state" role="status"></p>
        <div class="sl-buttons">
          <button type="button" class="sl-btn sleep" id="sl-sleep">${ART_SLEEP}<strong>Sleep</strong><span>Going to sleep now</span></button>
          <button type="button" class="sl-btn wake" id="sl-wake">${ART_WAKE}<strong>Wake up</strong><span>Awake now</span></button>
        </div>
        <p class="hint" id="sl-quick-status" role="status"></p>
        <div class="sl-rate" id="sl-rate" hidden>
          <span class="small">How did you sleep?</span>
          <div class="faces">${FACES.map(([f, l], i) =>
            `<button type="button" data-rate="${i + 1}" aria-label="${l}" title="${l}">${f}</button>`).join("")}</div>
        </div>
        <p class="muted small">Woke up in the night? Press <strong>Wake up</strong>, and <strong>Sleep</strong> again when you
          lie back down. Both count toward the same night.</p>
      </section>

      <section aria-labelledby="sl-add-heading">
        <h2 id="sl-add-heading" data-icon="📝" data-tone="blue">Add a night</h2>
        <form class="entry" id="sl-form" novalidate>
          <fieldset class="chips field wide" id="sl-kind" data-part="edit"><legend>This entry is</legend>
            <label class="chip"><input type="radio" name="sl-kind" value="sleep"><span>😴 Went to sleep</span></label>
            <label class="chip"><input type="radio" name="sl-kind" value="wake"><span>🌅 Woke up</span></label>
          </fieldset>
          <div class="field" data-part="edit"><label for="sl-edit-date">Date</label><input id="sl-edit-date" type="date"></div>
          <div class="field" data-part="edit"><label for="sl-edit-time">Time</label><input id="sl-edit-time" type="time"></div>

          <p class="sl-sub field wide" data-part="new">😴 Went to sleep</p>
          <div class="field" data-part="new"><label for="sl-sleep-date">Date</label><input id="sl-sleep-date" type="date"></div>
          <div class="field" data-part="new"><label for="sl-sleep-time">Time</label><input id="sl-sleep-time" type="time"></div>
          <p class="sl-sub field wide" data-part="new">🌅 Woke up</p>
          <div class="field" data-part="new"><label for="sl-wake-date">Date</label><input id="sl-wake-date" type="date"></div>
          <div class="field" data-part="new"><label for="sl-wake-time">Time</label><input id="sl-wake-time" type="time"></div>

          <fieldset class="chips field wide sl-faces" id="sl-rating" data-part="rating"><legend>How did you sleep? (optional)</legend>
            ${FACES.map(([f, l], i) => `<label class="chip"><input type="radio" name="sl-rating" value="${i + 1}"><span>${f} ${l}</span></label>`).join("")}
          </fieldset>
          <div class="field wide">
            <label for="sl-note">Note (optional)</label>
            <input id="sl-note" maxlength="200" autocomplete="off" placeholder="Coffee late, noisy night…">
          </div>
          <div class="actions">
            <button type="submit" class="primary" id="sl-save">Save</button>
            <button type="button" id="sl-cancel" hidden>Cancel editing</button>
            <span class="hint" id="sl-status" role="status"></span>
          </div>
        </form>
        <p class="muted small" data-part="new">Forgot to press a button? Fill in only the part you missed and leave the other empty.
          To add a wake-up in the middle of the night, fill in when you woke up and when you went back to sleep.</p>
      </section>

      <section aria-labelledby="sl-list-heading">
        <h2 id="sl-list-heading" data-icon="🕘" data-tone="teal">Your nights</h2>
        <p class="empty" id="sl-empty">Nothing recorded yet. Press <strong>Sleep</strong> tonight when you go to bed.</p>
        <div class="day-list" id="sl-nights"></div>
        <button type="button" id="sl-more" hidden>Show older nights</button>
      </section>
    </div>

    <!-- ===== Dashboard tab ===== -->
    <div class="view" data-panel="dashboard" hidden>
      <div class="panel-head">
        <h2 data-icon="📊" data-tone="violet">Sleep quality</h2>
        <div class="seg" role="group" aria-label="Period" id="sl-period">
          <button type="button" data-days="7" aria-pressed="true">7 days</button>
          <button type="button" data-days="30" aria-pressed="false">30 days</button>
          <button type="button" data-days="90" aria-pressed="false">90 days</button>
        </div>
      </div>
      <p class="empty" id="sl-dash-empty" hidden></p>
      <div class="view" id="sl-dash"></div>
    </div>`
  });

  const events = new Table("sleep_events");
  // Online, read in pages of 1000 (the most the database sends at once), so years of nights still load
  events.load = async function () {
    if (!CLOUD) { this.rows = readLocal(this.localKey) || []; return; }
    const rows = [];
    for (let from = 0; ; from += 1000) {
      const res = await sb.from(this.name).select("*").order("at").range(from, from + 999);
      if (res.error && isMissingTable(res.error.message)) { this.ready = false; this.rows = []; return; }
      check(res);
      rows.push(...res.data);
      if (res.data.length < 1000) break;
    }
    this.rows = rows;
    this.ready = true;
  };

  let editingId = null, confirmingId = null;
  let lastQuick = null;        // the moment saved by the last button press, for Undo and the rating
  let nightsShown = 14;
  let periodDays = 7;
  const openNights = new Set();

  mod.load = () => events.load();
  function refresh() { renderAll(); }

  // ---- Times ----
  const ms = e => new Date(e.at).getTime();
  const pad = n => String(n).padStart(2, "0");
  const clock = t => { const d = new Date(t); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
  // 445 -> "7h 25m"
  function dur(min) {
    min = Math.round(min);
    const h = Math.floor(min / 60), m = min % 60;
    return h ? (m ? `${h}h ${m}m` : `${h}h`) : `${m}m`;
  }
  // Minutes after midday -> "23:15" (used for average bedtimes, which can pass midnight)
  const clockFromNoon = min => { const m = ((Math.round(min) + 720) % 1440 + 1440) % 1440; return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`; };
  // A night is named after the evening it starts: going to bed at 1 am on the 10th is the night of the 9th
  const nightOf = t => isoDate(new Date(t - 12 * 3600000));
  const noonOf = iso => { const d = parseIso(iso); d.setHours(12); return d.getTime(); };
  const atFrom = (date, time) => new Date(`${date}T${time}`).toISOString();
  const shortDay = t => new Date(t).toLocaleDateString(undefined, { weekday: "short" });

  // ---- Joining the moments into nights ----
  // Each night: { key, events, periods: [[from, to], ...], start, end, date, status, ...numbers }
  // status: "done", "sleeping" (asleep right now), "no-wake" (Wake up was never pressed), "no-sleep" (Sleep wasn't)
  function buildNights() {
    const list = [...events.rows].sort((a, b) => ms(a) - ms(b) || (a.created_at || "").localeCompare(b.created_at || ""));
    const nights = [];
    let night = null, asleep = null; // asleep: the Sleep moment still waiting for its wake-up
    const close = status => { if (night) { night.status = status || (night.periods.length ? "done" : "no-wake"); nights.push(night); } night = null; asleep = null; };
    for (const e of list) {
      const t = ms(e);
      if (e.kind === "sleep") {
        if (asleep) {
          // Sleep pressed twice: the later press counts, unless so much later that a wake-up was clearly forgotten
          if (t - ms(asleep) <= SAME_NIGHT * 60000) { night.events.push(e); asleep = e; continue; }
          close("no-wake");
        }
        if (night && night.periods.length && t - night.end <= SAME_NIGHT * 60000) { night.events.push(e); asleep = e; continue; }
        close();
        night = { key: e.id, events: [e], periods: [] };
        asleep = e;
      } else {
        if (asleep && t - ms(asleep) <= LONGEST * 60000) {
          night.periods.push([ms(asleep), t]);
          night.end = t;
          night.events.push(e);
          asleep = null;
          continue;
        }
        if (asleep) close("no-wake");
        // A wake-up shortly after the last one is a second press: keep it with that night, it changes nothing
        if (night && night.periods.length && t - night.end <= SAME_NIGHT * 60000) { night.events.push(e); continue; }
        close();
        nights.push({ key: e.id, events: [e], periods: [], status: "no-sleep" });
      }
    }
    if (night) {
      if (asleep && Date.now() - ms(asleep) <= LONGEST * 60000) { night.status = "sleeping"; night.since = ms(asleep); nights.push(night); night = null; }
      else close(asleep ? "no-wake" : null);
    }
    for (const n of nights) {
      const first = ms(n.events[0]);
      n.date = nightOf(first);
      if (n.status !== "done") continue;
      n.start = n.periods[0][0];
      n.inBed = (n.end - n.start) / 60000;
      n.asleep = n.periods.reduce((s, [a, b]) => s + (b - a) / 60000, 0);
      n.awake = n.inBed - n.asleep;
      n.wakeUps = n.periods.length - 1;
      const rated = n.events.filter(e => e.kind === "wake" && e.rating).pop();
      n.rating = rated ? Number(rated.rating) : null;
      // A sleep that starts between 10:00 and 18:59 and lasts under 4 hours is a nap
      const h = new Date(n.start).getHours();
      n.nap = h >= 10 && h < 19 && n.asleep < 240;
      n.bedFromNoon = (n.start - noonOf(n.date)) / 60000;
      n.wakeFromNoon = (n.end - noonOf(n.date)) / 60000;
      Object.assign(n, scoreOf(n));
    }
    return nights;
  }

  // ---- Sleep score, 0 to 100 ----
  // Based on common guidelines for adults: 7–9 hours of sleep (60 points; each hour short costs 30),
  // at most one wake-up (20 points), and no more than 20 minutes awake during the night (20 points).
  function scoreOf(n) {
    const a = n.asleep;
    const length = a < GOAL_LOW ? Math.max(0, 60 - (GOAL_LOW - a) / 60 * 30)
      : a > GOAL_HIGH ? Math.max(30, 60 - (a - GOAL_HIGH) / 60 * 15) : 60;
    const breaks = [20, 20, 12, 6][n.wakeUps] ?? 0;
    const awake = n.awake <= 20 ? 20 : Math.max(0, 20 - (n.awake - 20) / 60 * 20);
    const score = Math.round(length + breaks + awake);
    return { score, label: scoreLabel(score) };
  }
  function scoreLabel(score) {
    return score >= 90 ? ["good", "Great"] : score >= 75 ? ["good", "Good"] : score >= 55 ? ["watch", "Fair"] : ["high", "Poor"];
  }
  const scorePill = n => `<span class="pill ${n.label[0]}">${n.score} · ${n.label[1]}</span>`;

  // ===================== Quick record =====================
  async function quick(kind, statusId) {
    const was = currentState();
    const entry = { at: new Date().toISOString(), kind, note: "" };
    let saved;
    const ok = await attempt(statusId, async () => { [saved] = await events.insert(entry); });
    if (!ok) return;
    lastQuick = saved;
    const time = clock(ms(saved));
    let text;
    if (kind === "sleep") text = was.sleeping ? `Bedtime moved to ${time}. Good night! 🌙` : `Good night! Sleep recorded at ${time}. 🌙`;
    else if (was.sleeping) text = `Good morning! Wake-up recorded at ${time}, after ${dur((ms(saved) - was.since) / 60000)} of sleep. ☀️`;
    else text = `Wake-up recorded at ${time}. You weren't marked as asleep: if you forgot to press Sleep, add it below.`;
    say(statusId, text);
    if (statusId === "sl-quick-status") $("sl-quick-status").insertAdjacentHTML("beforeend", ` <button type="button" class="link" id="sl-undo">Undo</button>`);
    $("sl-rate").hidden = kind !== "wake";
    refresh();
  }
  // Asleep right now? Since when?
  function currentState() {
    const nights = buildNights();
    const last = nights[nights.length - 1];
    return last && last.status === "sleeping" ? { sleeping: true, since: last.since, night: last } : { sleeping: false, last };
  }

  $("sl-sleep").addEventListener("click", () => quick("sleep", "sl-quick-status"));
  $("sl-wake").addEventListener("click", () => quick("wake", "sl-quick-status"));
  $("sl-quick-status").addEventListener("click", async event => {
    if (event.target.id !== "sl-undo" || !lastQuick) return;
    if (!await attempt("sl-quick-status", () => events.remove(lastQuick.id))) return;
    say("sl-quick-status", `Removed the ${lastQuick.kind === "sleep" ? "Sleep" : "Wake up"} of ${clock(ms(lastQuick))}.`);
    lastQuick = null;
    $("sl-rate").hidden = true;
    refresh();
  });
  $("sl-rate").addEventListener("click", async event => {
    const btn = event.target.closest("[data-rate]");
    if (!btn || !lastQuick) return;
    const rating = Number(btn.dataset.rate);
    if (!await attempt("sl-quick-status", () => events.update(lastQuick.id, { rating }))) return;
    $("sl-rate").hidden = true;
    say("sl-quick-status", `Thanks! Saved: ${FACES[rating - 1][0]} ${FACES[rating - 1][1].toLowerCase()} night.`);
    lastQuick = null;
    refresh();
  });

  function renderState() {
    const s = currentState();
    const now = Date.now();
    $("sl-sleep").classList.toggle("next", !s.sleeping);
    $("sl-wake").classList.toggle("next", s.sleeping);
    if (s.sleeping) {
      $("sl-state").innerHTML = `<span class="dot sleeping"></span> Sleeping since <strong>${clock(s.since)}</strong> · ${dur((now - s.since) / 60000)} so far`;
    } else if (s.last && s.last.status === "done") {
      const day = isoDate(new Date(s.last.end)) === todayString() ? "today" : shortDate(isoDate(new Date(s.last.end)));
      $("sl-state").innerHTML = `<span class="dot"></span> Awake · woke up at <strong>${clock(s.last.end)}</strong> ${day}`;
    } else {
      $("sl-state").innerHTML = `<span class="dot"></span> Awake`;
    }
  }

  // ===================== Form =====================
  function defaultDates() {
    // The form is mostly for last night: went to sleep yesterday, woke up today
    $("sl-sleep-date").value = addDays(todayString(), -1);
    $("sl-wake-date").value = todayString();
  }
  function showParts(editing, kind) {
    mod.el.querySelectorAll("[data-part]").forEach(el => {
      const part = el.dataset.part;
      el.hidden = part === "edit" ? !editing : part === "new" ? editing : part === "rating" ? editing && kind !== "wake" : false;
    });
  }
  function resetForm() {
    editingId = null;
    ["sl-sleep-time", "sl-wake-time", "sl-note", "sl-edit-date", "sl-edit-time"].forEach(id => { $(id).value = ""; });
    document.querySelectorAll('input[name="sl-rating"], input[name="sl-kind"]').forEach(i => { i.checked = false; });
    defaultDates();
    showParts(false);
    $("sl-save").textContent = "Save";
    $("sl-cancel").hidden = true;
    $("sl-add-heading").textContent = "Add a night";
  }
  $("sl-kind").addEventListener("change", () => showParts(true, document.querySelector('input[name="sl-kind"]:checked')?.value));

  $("sl-form").addEventListener("submit", async event => {
    event.preventDefault();
    const fail = (text, id) => { $("sl-status").textContent = text; $("sl-status").classList.add("error"); if (id) $(id).focus(); };
    const rating = Number(document.querySelector('input[name="sl-rating"]:checked')?.value) || null;
    const note = $("sl-note").value.trim();
    if (editingId) {
      const kind = document.querySelector('input[name="sl-kind"]:checked')?.value;
      if (!$("sl-edit-date").value) { fail("Choose the date.", "sl-edit-date"); return; }
      if (!$("sl-edit-time").value) { fail("Fill in the time, like 23:15.", "sl-edit-time"); return; }
      const patch = { kind, at: atFrom($("sl-edit-date").value, $("sl-edit-time").value), note, rating: kind === "wake" ? rating : null };
      $("sl-save").disabled = true;
      const ok = await attempt("sl-status", () => events.update(editingId, patch));
      $("sl-save").disabled = false;
      if (!ok) return;
      resetForm();
      say("sl-status", "Changes saved.");
      refresh();
      return;
    }
    const sleepTime = $("sl-sleep-time").value, wakeTime = $("sl-wake-time").value;
    if (!sleepTime && !wakeTime) { fail("Fill in when you went to sleep, when you woke up, or both.", "sl-sleep-time"); return; }
    if (sleepTime && !$("sl-sleep-date").value) { fail("Choose the date you went to sleep.", "sl-sleep-date"); return; }
    if (wakeTime && !$("sl-wake-date").value) { fail("Choose the date you woke up.", "sl-wake-date"); return; }
    const list = [];
    if (sleepTime) list.push({ kind: "sleep", at: atFrom($("sl-sleep-date").value, sleepTime), note: wakeTime ? "" : note });
    if (wakeTime) list.push({ kind: "wake", at: atFrom($("sl-wake-date").value, wakeTime), note, rating });
    if (list.some(e => new Date(e.at).getTime() > Date.now() + 60000)) { fail("That time is still in the future. Check the dates."); return; }
    if (list.length === 2) {
      const gap = Math.abs(new Date(list[1].at) - new Date(list[0].at)) / 60000;
      if (gap > LONGEST) { fail("Those two times are more than 16 hours apart. Check the dates.", "sl-wake-date"); return; }
      if (gap < 1) { fail("Going to sleep and waking up can't be at the same time.", "sl-wake-time"); return; }
    }
    $("sl-save").disabled = true;
    const ok = await attempt("sl-status", () => events.insert(list));
    $("sl-save").disabled = false;
    if (!ok) return;
    resetForm();
    say("sl-status", list.length === 2 ? "Night saved." : "Saved.");
    refresh();
  });
  $("sl-cancel").addEventListener("click", () => { resetForm(); say("sl-status", ""); refresh(); });

  function startEditing(id) {
    const e = events.get(id);
    editingId = id; confirmingId = null;
    const d = new Date(e.at);
    $("sl-edit-date").value = isoDate(d);
    $("sl-edit-time").value = clock(d);
    document.querySelectorAll('input[name="sl-kind"]').forEach(i => { i.checked = i.value === e.kind; });
    document.querySelectorAll('input[name="sl-rating"]').forEach(i => { i.checked = Number(i.value) === Number(e.rating); });
    $("sl-note").value = e.note || "";
    showParts(true, e.kind);
    $("sl-save").textContent = "Save changes";
    $("sl-cancel").hidden = false;
    $("sl-add-heading").textContent = "Edit entry";
    say("sl-status", "");
    refresh();
    $("sl-form").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // ===================== Nights list =====================
  $("sl-nights").addEventListener("click", async event => {
    if (toggleDay(event, openNights)) { refresh(); return; }
    const btn = event.target.closest("button[data-action]");
    if (!btn) return;
    const id = btn.closest("li").dataset.id;
    const action = btn.dataset.action;
    if (action === "edit") startEditing(id);
    if (action === "delete") { confirmingId = id; refresh(); }
    if (action === "keep") { confirmingId = null; refresh(); }
    if (action === "confirm-delete") {
      if (!await attempt("sl-status", () => events.remove(id))) return;
      if (editingId === id) resetForm();
      confirmingId = null;
      refresh();
    }
  });
  $("sl-more").addEventListener("click", () => { nightsShown += 14; refresh(); });

  function nightSummary(n) {
    if (n.status === "sleeping") return `Sleeping since ${clock(n.since)}`;
    if (n.status === "no-wake") return `<span class="off">No wake-up recorded.</span> Tap to add or fix it.`;
    if (n.status === "no-sleep") return `<span class="off">Woke up at ${clock(ms(n.events[0]))}, but no Sleep recorded.</span>`;
    const parts = [`${clock(n.start)} → ${clock(n.end)}`];
    if (n.wakeUps) parts.push(`${plural(n.wakeUps, "wake-up")} (${dur(n.awake)} awake)`);
    if (n.rating) parts.push(FACES[n.rating - 1][0]);
    return parts.join(" · ");
  }
  function renderNights(nights) {
    const list = [...nights].reverse();
    // Keep the night being edited or deleted open
    [editingId, confirmingId].forEach(id => { const n = id && list.find(x => x.events.some(e => e.id === id)); if (n) openNights.add(n.key); });
    $("sl-empty").hidden = list.length > 0;
    $("sl-more").hidden = list.length <= nightsShown;
    $("sl-nights").innerHTML = list.slice(0, nightsShown).map(n => {
      const open = openNights.has(n.key);
      const label = (n.nap ? "Nap · " : "") + (n.date === todayString() && !n.nap ? "Tonight · " : "") + dayLabel(n.date);
      const right = n.status === "done" ? `<span class="sl-right"><span>${dur(n.asleep)}</span>${scorePill(n)}</span>` : "";
      const rows = open ? `<ul class="list">${n.events.map(e => {
        const actions = confirmingId === e.id
          ? `<span class="ask">Delete this entry?</span>
             <button type="button" class="link" data-action="keep">Keep</button>
             <button type="button" class="danger" data-action="confirm-delete">Yes, delete</button>`
          : editDeleteButtons();
        const what = e.kind === "sleep" ? "😴 Went to sleep" : "🌅 Woke up";
        const extra = [e.rating ? `${FACES[e.rating - 1][0]} ${FACES[e.rating - 1][1]}` : "", e.note ? escapeHtml(e.note) : ""].filter(Boolean).join(" · ");
        return `<li data-id="${e.id}" class="${editingId === e.id ? "editing" : ""}">
          <div class="what"><span class="cat">${what}</span>${extra ? `<span class="meta">${extra}</span>` : ""}</div>
          <span class="price">${shortDay(ms(e))} ${clock(ms(e))}</span>
          <div class="row-actions">${actions}</div></li>`;
      }).join("")}</ul>` : "";
      return `<div class="day-group${open ? " open" : ""}">
        <button type="button" class="day-row" data-day="${n.key}" aria-expanded="${open}">
          <svg class="chev" viewBox="0 0 24 24" aria-hidden="true">${CHEVRON}</svg>
          <span class="day-text"><strong>${label}</strong><span class="sum">${nightSummary(n)}</span></span>
          ${right}
        </button>${rows}</div>`;
    }).join("");
  }

  // ===================== Dashboard =====================
  $("sl-period").addEventListener("click", event => {
    const btn = event.target.closest("[data-days]");
    if (!btn) return;
    periodDays = Number(btn.dataset.days);
    refresh();
  });

  const avg = list => list.length ? list.reduce((s, v) => s + v, 0) / list.length : 0;
  const spread = list => { const m = avg(list); return Math.sqrt(avg(list.map(v => (v - m) ** 2))); };
  const tile = (label, value, sub, icon, tone) =>
    `<div class="stat">${badge(label, icon, tone)}<div class="stat-text"><span class="muted small">${label}</span><strong>${value}</strong>${sub ? `<span class="muted small">${sub}</span>` : ""}</div></div>`;

  // Each night as a bar from bedtime to wake-up, with gaps where you were awake
  function timeline(list) {
    let lo = 21 * 60 - 720, hi = 9 * 60 + 720; // at least 21:00 to 09:00, in minutes after midday
    list.forEach(n => { lo = Math.min(lo, Math.floor(n.bedFromNoon / 60) * 60); hi = Math.max(hi, Math.ceil(n.wakeFromNoon / 60) * 60); });
    const W = 320, L = 44, R = 16, row = 22, top = 6, H = top + list.length * row + 20;
    const x = m => L + (m - lo) / (hi - lo) * (W - L - R);
    const hours = [];
    for (let m = Math.ceil(lo / 120) * 120; m <= hi; m += 120) hours.push(m);
    const rows = list.map((n, i) => {
      const y = top + i * row;
      const noon = noonOf(n.date);
      const bars = n.periods.map(([a, b]) => {
        const x1 = x((a - noon) / 60000), x2 = x((b - noon) / 60000);
        return `<rect class="sl-bar ${n.label[0]}" x="${x1.toFixed(1)}" y="${y + 3}" width="${Math.max(1.5, x2 - x1).toFixed(1)}" height="${row - 7}" rx="4"/>`;
      }).join("");
      const gap = n.periods.length > 1 ? `<line class="sl-gapline" x1="${x(n.bedFromNoon)}" x2="${x(n.wakeFromNoon)}" y1="${y + row / 2 - 0.5}" y2="${y + row / 2 - 0.5}"/>` : "";
      return `<text class="tick" x="${L - 6}" y="${y + row / 2 + 3}" text-anchor="end">${shortDay(noon)} ${parseIso(n.date).getDate()}</text>${gap}${bars}`;
    }).join("");
    return `<svg viewBox="0 0 ${W} ${H}" class="sl-chart" role="img" aria-label="Bedtime and wake-up of each night">
      ${hours.map(m => `<line class="grid" x1="${x(m)}" x2="${x(m)}" y1="${top}" y2="${H - 18}"/>
        <text class="tick" x="${x(m)}" y="${H - 4}" text-anchor="middle">${clockFromNoon(m)}</text>`).join("")}
      ${rows}</svg>`;
  }

  // Hours of sleep per night, with the 7–9 hour band behind the bars
  function hoursChart(list) {
    const W = 320, H = 150, L = 30, R = 8, T = 8, B = 20;
    const max = Math.max(10 * 60, ...list.map(n => Math.ceil(n.asleep / 60) * 60));
    const y = m => T + (1 - m / max) * (H - T - B);
    const slot = (W - L - R) / list.length, bw = Math.max(2, Math.min(22, slot * 0.7));
    const labels = list.length <= 10 ? list.map((n, i) => i) : [0, Math.floor(list.length / 2), list.length - 1];
    return `<svg viewBox="0 0 ${W} ${H}" class="sl-chart" role="img" aria-label="Hours of sleep per night">
      <rect class="band" x="${L}" y="${y(GOAL_HIGH)}" width="${W - L - R}" height="${y(GOAL_LOW) - y(GOAL_HIGH)}"/>
      ${[0, 4, 7, 9].map(h => `<line class="grid" x1="${L}" x2="${W - R}" y1="${y(h * 60)}" y2="${y(h * 60)}"/>
        <text class="tick" x="${L - 5}" y="${y(h * 60) + 3}" text-anchor="end">${h}h</text>`).join("")}
      ${list.map((n, i) => `<rect class="sl-bar ${n.label[0]}" x="${(L + slot * i + (slot - bw) / 2).toFixed(1)}" y="${y(n.asleep).toFixed(1)}" width="${bw.toFixed(1)}" height="${(y(0) - y(n.asleep)).toFixed(1)}" rx="3"><title>${shortDate(n.date)}: ${dur(n.asleep)}</title></rect>`).join("")}
      ${labels.map(i => `<text class="tick" x="${L + slot * i + slot / 2}" y="${H - 5}" text-anchor="middle">${list.length <= 10 ? shortDay(noonOf(list[i].date)) : shortDate(list[i].date)}</text>`).join("")}
    </svg>`;
  }

  // Plain sentences about what stands out
  function insights(list) {
    const out = [];
    const a = avg(list.map(n => n.asleep));
    if (a < GOAL_LOW) out.push(["⏰", "amber", `You sleep ${dur(a)} a night on average, ${dur(GOAL_LOW - a)} short of the 7 hours adults need. Going to bed a little earlier is the easiest fix.`]);
    else if (a > GOAL_HIGH) out.push(["🛌", "blue", `You sleep ${dur(a)} a night on average, more than 9 hours. If you still feel tired, it can be worth mentioning to a doctor.`]);
    else out.push(["✅", "green", `You sleep ${dur(a)} a night on average, within the 7–9 hours adults need.`]);
    if (list.length >= 3) {
      const s = spread(list.map(n => n.bedFromNoon));
      if (s > 45) out.push(["🕰️", "violet", `Your bedtime changes a lot (about ±${dur(s)}). Going to bed at the same time every night helps you fall asleep and sleep better.`]);
      else out.push(["🕰️", "green", `Your bedtime is regular (within about ±${dur(Math.max(s, 1))}). Keep it up.`]);
    }
    const w = avg(list.map(n => n.wakeUps));
    if (w >= 1.5) out.push(["🌙", "red", `You wake up ${one.format(w)} times a night on average. Less caffeine after midday, a dark and cool room, and less screen time before bed can help.`]);
    const weekend = list.filter(n => [5, 6].includes(weekday(n.date))), week = list.filter(n => ![5, 6].includes(weekday(n.date)));
    if (weekend.length >= 2 && week.length >= 2) {
      const diff = avg(weekend.map(n => n.bedFromNoon + n.asleep / 2)) - avg(week.map(n => n.bedFromNoon + n.asleep / 2));
      if (Math.abs(diff) >= 60) out.push(["📅", "orange", `On weekends you sleep about ${dur(Math.abs(diff))} ${diff > 0 ? "later" : "earlier"} than on weekdays. A big shift like this can make Monday mornings harder.`]);
    }
    const good = list.filter(n => n.rating >= 4), bad = list.filter(n => n.rating && n.rating <= 2);
    if (good.length >= 2 && bad.length >= 2) {
      out.push(["😄", "teal", `On nights you rated good you slept ${dur(avg(good.map(n => n.asleep)))} and went to bed around ${clockFromNoon(avg(good.map(n => n.bedFromNoon)))}; on bad nights ${dur(avg(bad.map(n => n.asleep)))}, around ${clockFromNoon(avg(bad.map(n => n.bedFromNoon)))}.`]);
    }
    return out;
  }

  function renderDashboard(nights) {
    document.querySelectorAll("#sl-period [data-days]").forEach(b => b.setAttribute("aria-pressed", String(Number(b.dataset.days) === periodDays)));
    const from = addDays(todayString(), -periodDays);
    const done = nights.filter(n => n.status === "done" && !n.nap);
    const list = done.filter(n => n.date >= from);
    $("sl-dash-empty").hidden = list.length > 0;
    $("sl-dash-empty").textContent = done.length ? "No complete nights in this period. Choose a longer period."
      : "No complete nights yet. Press Sleep when you go to bed and Wake up in the morning, and your sleep quality shows here.";
    if (!list.length) { $("sl-dash").innerHTML = ""; return; }
    const score = Math.round(avg(list.map(n => n.score)));
    const lbl = scoreLabel(score);
    const inGoal = list.filter(n => n.asleep >= GOAL_LOW && n.asleep <= GOAL_HIGH).length;
    const rated = list.filter(n => n.rating);
    const missing = nights.filter(n => (n.status === "no-wake" || n.status === "no-sleep") && n.date >= from).length;
    const shownNights = list.slice(-31);

    $("sl-dash").innerHTML = `
      <section class="panel sl-score-panel">
        <div class="sl-score" data-level="${lbl[0]}" style="--p:${score}">
          <div class="ring"><strong>${score}</strong><span>of 100</span></div>
          <div class="sl-score-text">
            <span class="muted small">Average sleep score</span>
            <span class="pill ${lbl[0]}">${lbl[1]}</span>
            <span class="small">${plural(list.length, "night")} in the last ${periodDays} days${missing ? ` · ${plural(missing, "night")} left out (a button wasn't pressed)` : ""}</span>
          </div>
        </div>
        <div class="stat-grid">
          ${tile("Average sleep", dur(avg(list.map(n => n.asleep))), `${inGoal} of ${list.length} nights in 7–9h`, "😴", "violet")}
          ${tile("Usual bedtime", clockFromNoon(avg(list.map(n => n.bedFromNoon))), list.length > 1 ? `± ${dur(Math.max(1, spread(list.map(n => n.bedFromNoon))))}` : "", "🌙", "blue")}
          ${tile("Usual wake-up", clockFromNoon(avg(list.map(n => n.wakeFromNoon))), list.length > 1 ? `± ${dur(Math.max(1, spread(list.map(n => n.wakeFromNoon))))}` : "", "🌅", "amber")}
          ${tile("Wake-ups a night", one.format(avg(list.map(n => n.wakeUps))), `${dur(avg(list.map(n => n.awake)))} awake a night`, "👀", "pink")}
          ${tile("Time asleep in bed", Math.round(avg(list.map(n => n.inBed ? n.asleep / n.inBed : 1)) * 100) + "%", "85% or more is good", "🛏️", "teal")}
          ${tile("How you felt", rated.length ? FACES[Math.round(avg(rated.map(n => n.rating))) - 1][0] + " " + FACES[Math.round(avg(rated.map(n => n.rating))) - 1][1] : "–", rated.length ? `from ${plural(rated.length, "rating")}` : "rate a night after Wake up", "💭", "orange")}
        </div>
      </section>
      <section class="panel">
        <h2 data-icon="🛌" data-tone="blue">Your nights</h2>
        <p class="muted small">Each bar runs from going to sleep to waking up; a gap is time awake in the night.${list.length > shownNights.length ? " Showing the last 31 nights." : ""}</p>
        ${timeline(shownNights)}
        <div class="sl-legend small"><span><i class="good"></i>Great / Good</span><span><i class="watch"></i>Fair</span><span><i class="high"></i>Poor</span></div>
      </section>
      <section class="panel">
        <h2 data-icon="⏱️" data-tone="violet">Hours of sleep</h2>
        <p class="muted small">The shaded band is the 7–9 hours recommended for adults.</p>
        ${hoursChart(list)}
      </section>
      <section class="panel">
        <h2 data-icon="💡" data-tone="amber">What stands out</h2>
        <ul class="sl-insights">${insights(list).map(([icon, tone, text]) => `<li>${badge(text, icon, tone)}<span>${text}</span></li>`).join("")}</ul>
        <p class="disclaimer"><span class="info" aria-hidden="true">i</span>The sleep score (0–100) follows common guidelines for adults:
          7–9 hours of sleep (60 points), at most one wake-up (20 points) and no more than 20 minutes awake in the night (20 points).
          It's a guide, not medical advice.</p>
      </section>`;
  }

  // ===================== Draw everything =====================
  mod.onEnter = () => resetForm();
  mod.render = () => {
    $("sl-missing").hidden = events.ready;
    mod.el.querySelectorAll("[data-panel]").forEach(p => { p.style.display = events.ready ? "" : "none"; });
    if (!events.ready) return;
    const nights = buildNights();
    renderState();
    renderNights(nights);
    renderDashboard(nights);
  };
  // Keep "Sleeping since … · 7h 12m so far" up to date while the page is open
  setInterval(() => { if (events.ready && !mod.el.hidden) renderState(); }, 60000);

  // ---- Home card: last night, and the two quick buttons ----
  mod.homeSetup = card => {
    card.addEventListener("click", event => {
      const btn = event.target.closest("[data-quick]");
      if (btn) quick(btn.dataset.quick, "sl-home-status");
    });
  };
  mod.home = card => {
    if (!events.ready) { card.innerHTML = `<div class="panel-head"><h2>Sleep</h2></div>${setupNotice()}`; return; }
    const s = currentState();
    const nights = buildNights().filter(n => n.status === "done" && !n.nap);
    const last = nights[nights.length - 1];
    const status = $("sl-home-status") ? $("sl-home-status").outerHTML : `<span class="hint" id="sl-home-status" role="status"></span>`;
    let lines;
    if (s.sleeping) lines = `<span class="big">${dur((Date.now() - s.since) / 60000)}</span><span class="muted small">Sleeping since ${clock(s.since)}</span>`;
    else if (last) lines = `<span class="big">${dur(last.asleep)}</span>
      <span class="small">${last.date >= addDays(todayString(), -1) ? "Last night" : dayLabel(last.date)} · ${clock(last.start)} → ${clock(last.end)} ${scorePill(last)}</span>`;
    else lines = `<span class="muted">No nights recorded yet.</span>`;
    card.innerHTML = `<div class="panel-head"><h2>Sleep</h2><a href="#sleep/dashboard">Dashboard</a></div>
      <div class="lines">${lines}</div>
      <div class="sl-home-btns">
        <button type="button" data-quick="sleep" class="${s.sleeping ? "" : "primary"}">😴 Sleep</button>
        <button type="button" data-quick="wake" class="${s.sleeping ? "primary" : ""}">🌅 Wake up</button>
      </div>${status}`;
  };
})();
