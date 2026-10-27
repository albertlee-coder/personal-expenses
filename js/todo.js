// To-do: tasks with an optional due date. Open tasks also show on the Home screen,
// where they can be added and ticked off without opening this module.
// Each task looks like: { id, title, note, due_date: "2026-10-20" or null, done, done_at, created_at }
(() => {
  const mod = defineModule({
    id: "todo",
    title: "To-do",
    html: `
    <div id="todo-missing" hidden>${setupNotice()}</div>
    <section aria-labelledby="todo-add-heading">
      <h2 id="todo-add-heading" data-icon="📝" data-tone="blue">Add a task</h2>
      <form class="entry" id="todo-form" novalidate>
        <div class="field wide">
          <label for="todo-title">Task</label>
          <input id="todo-title" maxlength="200" autocomplete="off" placeholder="Pay the electricity bill">
        </div>
        <div class="field">
          <label for="todo-due">Due date (optional)</label>
          <input id="todo-due" type="date">
        </div>
        <div class="field">
          <label for="todo-note">Note (optional)</label>
          <input id="todo-note" maxlength="300" autocomplete="off">
        </div>
        <div class="actions">
          <button type="submit" class="primary" id="todo-save">Add task</button>
          <button type="button" id="todo-cancel" hidden>Cancel editing</button>
          <span class="hint" id="todo-status" role="status"></span>
        </div>
      </form>
    </section>
    <section aria-labelledby="todo-list-heading">
      <div class="panel-head">
        <h2 id="todo-list-heading" data-icon="📋" data-tone="violet">Your tasks</h2>
        <div class="seg" role="group" aria-label="Show">
          <button type="button" data-filter="open" aria-pressed="true">To do</button>
          <button type="button" data-filter="done" aria-pressed="false">Done</button>
        </div>
      </div>
      <p class="empty" id="todo-empty" hidden></p>
      <ul class="tasks" id="todo-list"></ul>
    </section>`
  });

  const tasks = new Table("todos");
  let filter = "open";       // "open" or "done"
  let editingId = null;      // task being edited in the form above
  let confirmingId = null;   // task waiting for "Yes, delete"
  let lastDone = null;       // task just ticked off on Home, so it can be undone

  mod.load = () => tasks.load();
  function refresh() { renderAll(); }

  // Open tasks: overdue and dated ones first (soonest first), then the ones without a date
  function openTasks() {
    return tasks.rows.filter(t => !t.done).sort((a, b) =>
      (a.due_date || "9999").localeCompare(b.due_date || "9999") ||
      (a.created_at || "").localeCompare(b.created_at || ""));
  }
  // The due date on the right of the row: red when 3 days or less are left (or overdue), orange when 7 or less
  function dueText(t) {
    if (!t.due_date) return "";
    const days = daysBetween(todayString(), t.due_date);
    const tone = t.done ? "" : days <= 3 ? " red" : days <= 7 ? " orange" : "";
    const text = days === 0 ? "Today" : days === 1 ? "Tomorrow" : shortDate(t.due_date);
    return `<span class="due${tone}">${text}</span>`;
  }

  // One task row; `full` adds the Edit / Delete buttons used in the To-do module
  function taskItem(t, full) {
    const meta = [t.note ? escapeHtml(t.note) : "",
      t.done && t.done_at ? "Done " + shortDate(isoDate(new Date(t.done_at))) : ""].filter(Boolean).join(" · ");
    let actions = "";
    if (full) {
      actions = confirmingId === t.id
        ? `<span class="ask">Delete this task?</span>
           <button type="button" class="link" data-action="keep">Keep</button>
           <button type="button" class="danger" data-action="confirm-delete">Yes, delete</button>`
        : editDeleteButtons();
    }
    return `<li data-id="${t.id}" class="${t.done ? "done" : ""}${editingId === t.id ? " editing" : ""}">
      <input type="checkbox" data-action="toggle" ${t.done ? "checked" : ""} aria-label="Mark “${escapeHtml(t.title)}” as ${t.done ? "not done" : "done"}">
      <div class="what"><div class="line"><span class="title">${escapeHtml(t.title)}</span>${dueText(t)}</div>${meta ? `<span class="meta">${meta}</span>` : ""}</div>
      ${full ? `<div class="row-actions">${actions}</div>` : "<span></span>"}
    </li>`;
  }

  async function setDone(id, done, statusId) {
    return attempt(statusId, () => tasks.update(id, { done, done_at: done ? new Date().toISOString() : null }));
  }

  // ---- The To-do module screen ----
  function resetForm() {
    editingId = null;
    $("todo-title").value = ""; $("todo-due").value = ""; $("todo-note").value = "";
    $("todo-save").textContent = "Add task";
    $("todo-cancel").hidden = true;
    $("todo-add-heading").textContent = "Add a task";
  }

  $("todo-form").addEventListener("submit", async event => {
    event.preventDefault();
    const title = $("todo-title").value.trim();
    if (!title) { say("todo-status", "Type what needs doing."); $("todo-title").focus(); return; }
    const entry = { title, due_date: $("todo-due").value || null, note: $("todo-note").value.trim() };
    const wasEditing = Boolean(editingId);
    $("todo-save").disabled = true;
    const ok = await attempt("todo-status", () => wasEditing ? tasks.update(editingId, entry) : tasks.insert(entry));
    $("todo-save").disabled = false;
    if (!ok) return;
    resetForm();
    say("todo-status", wasEditing ? "Changes saved." : `Added “${title}”.`);
    refresh();
  });
  $("todo-cancel").addEventListener("click", () => { resetForm(); say("todo-status", ""); refresh(); });

  mod.el.querySelector(".seg").addEventListener("click", event => {
    const btn = event.target.closest("[data-filter]");
    if (!btn) return;
    filter = btn.dataset.filter;
    refresh();
  });

  $("todo-list").addEventListener("click", async event => {
    const btn = event.target.closest("[data-action]");
    if (!btn || btn.dataset.action === "toggle") return;
    const id = btn.closest("li").dataset.id;
    const action = btn.dataset.action;
    if (action === "edit") {
      const t = tasks.get(id);
      editingId = id; confirmingId = null;
      $("todo-title").value = t.title; $("todo-due").value = t.due_date || ""; $("todo-note").value = t.note || "";
      $("todo-save").textContent = "Save changes";
      $("todo-cancel").hidden = false;
      $("todo-add-heading").textContent = "Edit task";
      say("todo-status", "");
      refresh();
      $("todo-form").scrollIntoView({ behavior: "smooth", block: "start" });
      $("todo-title").focus({ preventScroll: true });
    }
    if (action === "delete") { confirmingId = id; refresh(); }
    if (action === "keep") { confirmingId = null; refresh(); }
    if (action === "confirm-delete") {
      if (!await attempt("todo-status", () => tasks.remove(id))) return;
      if (editingId === id) resetForm();
      confirmingId = null;
      say("todo-status", "Task deleted.");
      refresh();
    }
  });
  $("todo-list").addEventListener("change", async event => {
    if (event.target.dataset.action !== "toggle") return;
    const id = event.target.closest("li").dataset.id;
    if (await setDone(id, event.target.checked, "todo-status")) say("todo-status", event.target.checked ? "Marked as done." : "Moved back to To do.");
    refresh();
  });

  mod.render = () => {
    $("todo-missing").hidden = tasks.ready;
    $("todo-form").hidden = !tasks.ready;
    mod.el.querySelectorAll("[data-filter]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.filter === filter)));
    let html = "";
    if (filter === "open") {
      const open = openTasks();
      const today = todayString();
      const groups = [
        ["Overdue", open.filter(t => t.due_date && t.due_date < today)],
        ["Today", open.filter(t => t.due_date === today)],
        ["Coming up", open.filter(t => t.due_date && t.due_date > today)],
        ["No date", open.filter(t => !t.due_date)]
      ].filter(([, list]) => list.length);
      html = groups.map(([label, list]) =>
        `<li class="group-label" aria-hidden="true">${label}</li>` + list.map(t => taskItem(t, true)).join("")).join("");
      $("todo-empty").textContent = "Nothing to do. Add a task with the form above.";
      $("todo-empty").hidden = open.length > 0;
    } else {
      const done = tasks.rows.filter(t => t.done).sort((a, b) => (b.done_at || "").localeCompare(a.done_at || ""));
      html = done.slice(0, 100).map(t => taskItem(t, true)).join("");
      $("todo-empty").textContent = "No finished tasks yet.";
      $("todo-empty").hidden = done.length > 0;
    }
    $("todo-list").innerHTML = html;
  };

  // ---- Home card: the open tasks, ticked off right from the front screen (new tasks are added in To-do) ----
  const HOME_LIMIT = 8;
  mod.homeSetup = card => {
    card.innerHTML = `
      <div class="panel-head"><h2>To-do</h2><a href="#todo" id="home-todo-all">All tasks</a></div>
      <span class="hint" id="home-todo-status" role="status"></span>
      <ul class="tasks" id="home-todo-list"></ul>
      <p class="muted small" id="home-todo-more" hidden></p>`;

    card.addEventListener("change", async event => {
      if (event.target.dataset.action !== "toggle") return;
      const id = event.target.closest("li").dataset.id;
      if (!await setDone(id, event.target.checked, "home-todo-status")) { refresh(); return; }
      lastDone = event.target.checked ? id : null;
      const t = tasks.get(id);
      $("home-todo-status").classList.remove("error");
      $("home-todo-status").innerHTML = lastDone
        ? `Done: “${escapeHtml(t.title)}”. <button type="button" class="link" data-action="undo">Undo</button>` : "";
      refresh();
    });
    card.addEventListener("click", async event => {
      if (event.target.dataset.action !== "undo" || !lastDone) return;
      const id = lastDone; lastDone = null;
      if (await setDone(id, false, "home-todo-status")) say("home-todo-status", "Moved back to To do.");
      refresh();
    });
  };

  mod.home = card => {
    if (!tasks.ready) { $("home-todo-list").innerHTML = `<li>${setupNotice()}</li>`; return; }
    const open = openTasks();
    $("home-todo-list").innerHTML = open.length
      ? open.slice(0, HOME_LIMIT).map(t => taskItem(t, false)).join("")
      : `<li><span></span><span class="muted">Nothing to do right now. New tasks are added in <a href="#todo">To-do</a>.</span></li>`;
    const more = open.length - HOME_LIMIT;
    $("home-todo-more").hidden = more <= 0;
    $("home-todo-more").innerHTML = `${plural(more, "more task")} in <a href="#todo">To-do</a>.`;
  };
})();
