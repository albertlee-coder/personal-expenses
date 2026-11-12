// To-do: tasks with an optional due date, plus Notes (lists and info without a date).
// Open tasks also show on the Home screen, where they can be ticked off without opening this module.
// Each task looks like: { id, title, note, due_date: "2026-10-20" or null, done, done_at, created_at }
// Each note looks like: { id, title, content, kind: "text" or "list", pinned, updated_at, created_at }
//   In a "list" note every line of content is one item; a ticked item starts with "[x] ".
(() => {
  const mod = defineModule({
    id: "todo",
    title: "To-do",
    tabs: [{ id: "tasks", label: "Tasks" }, { id: "notes", label: "Notes" }],
    html: `
    <!-- ===== Tasks tab ===== -->
    <div class="view" data-panel="tasks">
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
    </section>
    </div>

    <!-- ===== Notes tab ===== -->
    <div class="view" data-panel="notes">
      <div id="notes-missing" hidden>${setupNotice()}</div>
      <section aria-labelledby="notes-heading" id="notes-panel">
        <div class="panel-head">
          <h2 id="notes-heading" data-icon="🗒️" data-tone="amber">Your notes</h2>
          <button type="button" class="primary" id="note-new">+ New note</button>
        </div>
        <form class="entry note-form" id="note-form" novalidate hidden>
          <p class="note-form-title" id="note-form-title">New note</p>
          <div class="field wide">
            <label for="note-title">Title</label>
            <input id="note-title" maxlength="120" autocomplete="off" placeholder="Shopping list">
          </div>
          <fieldset class="chips field wide" id="note-kind"><legend>Type</legend>
            <label class="chip"><input type="radio" name="note-kind" value="list" checked><span>☑️ List with tick boxes</span></label>
            <label class="chip"><input type="radio" name="note-kind" value="text"><span>📝 Plain text</span></label>
          </fieldset>
          <div class="field wide">
            <label for="note-content" id="note-content-label">Items, one per line</label>
            <textarea id="note-content" rows="7" maxlength="10000"></textarea>
            <span class="muted small" id="note-content-hint"></span>
          </div>
          <label class="check-line"><input type="checkbox" id="note-pinned"> 📌 Pin to the top</label>
          <div class="actions">
            <button type="submit" class="primary" id="note-save">Save note</button>
            <button type="button" id="note-cancel">Cancel</button>
          </div>
        </form>
        <span class="hint" id="note-status" role="status"></span>
        <input id="note-search" type="search" placeholder="Search notes" aria-label="Search notes" autocomplete="off">
        <p class="empty" id="notes-empty" hidden></p>
        <div class="notes" id="notes-list"></div>
      </section>
    </div>`
  });

  const tasks = new Table("todos");
  let filter = "open";       // "open" or "done"
  let editingId = null;      // task being edited in the form above
  let confirmingId = null;   // task waiting for "Yes, delete"
  let lastDone = null;       // task just ticked off on Home, so it can be undone

  const notes = new Table("notes");
  mod.load = () => Promise.all([tasks.load(), notes.load()]);
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
    renderNotes();
  };


  // ---- Notes tab: lists and info to look up quickly (shopping list, restaurants, team members...) ----
  let noteEditingId = null;   // note open in the form
  let noteConfirmId = null;   // note waiting for "Yes, delete"
  const TICKED = /^\[x\]\s?/i;
  const COPY = '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/>';
  const PIN = '<path d="M9 4h6l-1 6 4 4H6l4-4z"/><path d="M12 14v6"/>';

  function noteKind() { return mod.el.querySelector('input[name="note-kind"]:checked').value; }
  function setKindHelp() {
    const list = noteKind() === "list";
    $("note-content-label").textContent = list ? "Items, one per line" : "Note";
    $("note-content").placeholder = list ? "Eggs\nMilk\nRice 5 kg" : "Sushi Tei, Jl. Sudirman. Try the salmon.\nPhone 021 555 0123";
    $("note-content-hint").textContent = list ? "Each line becomes a tick box. You tick them in the list below." : "";
  }
  mod.el.querySelectorAll('input[name="note-kind"]').forEach(r => r.addEventListener("change", setKindHelp));

  function openNoteForm(n) {
    noteEditingId = n ? n.id : null;
    noteConfirmId = null;
    $("note-title").value = n ? n.title : "";
    // In the form, ticked items keep their "[x] " so they stay ticked after saving
    $("note-content").value = n ? n.content : "";
    mod.el.querySelector(`input[name="note-kind"][value="${n ? n.kind : "list"}"]`).checked = true;
    $("note-pinned").checked = n ? n.pinned : false;
    $("note-form-title").textContent = n ? "Edit note" : "New note";
    $("note-form").hidden = false;
    $("note-new").hidden = true;
    setKindHelp();
    say("note-status", "");
    renderNotes();
    $("note-form").scrollIntoView({ behavior: "smooth", block: "start" });
    $("note-title").focus({ preventScroll: true });
  }
  function closeNoteForm() {
    noteEditingId = null;
    $("note-form").hidden = true;
    $("note-new").hidden = false;
  }

  $("note-new").addEventListener("click", () => openNoteForm(null));
  $("note-cancel").addEventListener("click", () => { closeNoteForm(); say("note-status", ""); renderNotes(); });
  $("note-form").addEventListener("submit", async event => {
    event.preventDefault();
    const title = $("note-title").value.trim();
    // Drop empty lines at the end, keep the rest exactly as typed
    const content = $("note-content").value.replace(/\s+$/, "");
    if (!title && !content) { say("note-status", "Type a title or some text."); $("note-title").focus(); return; }
    const entry = { title: title || content.split("\n")[0].replace(TICKED, "").slice(0, 120), content,
      kind: noteKind(), pinned: $("note-pinned").checked, updated_at: new Date().toISOString() };
    const wasEditing = Boolean(noteEditingId);
    $("note-save").disabled = true;
    const ok = await attempt("note-status", () => wasEditing ? notes.update(noteEditingId, entry) : notes.insert(entry));
    $("note-save").disabled = false;
    if (!ok) return;
    closeNoteForm();
    say("note-status", wasEditing ? "Note saved." : `Added “${entry.title}”.`);
    renderNotes();
  });
  $("note-search").addEventListener("input", () => renderNotes());

  // Save a note's new content after a tick or "Clear ticked"
  async function saveContent(n, content) {
    return attempt("note-status", () => notes.update(n.id, { content, updated_at: new Date().toISOString() }));
  }

  $("notes-list").addEventListener("change", async event => {
    const box = event.target;
    if (box.dataset.line === undefined) return;
    const n = notes.get(box.closest("[data-id]").dataset.id);
    const lines = n.content.split("\n");
    const i = Number(box.dataset.line);
    const text = lines[i].replace(TICKED, "");
    lines[i] = box.checked ? "[x] " + text : text;
    await saveContent(n, lines.join("\n"));
    renderNotes();
  });
  $("notes-list").addEventListener("click", async event => {
    const btn = event.target.closest("[data-action]");
    if (!btn) return;
    const n = notes.get(btn.closest("[data-id]").dataset.id);
    const action = btn.dataset.action;
    if (action === "edit") openNoteForm(n);
    if (action === "delete") { noteConfirmId = n.id; renderNotes(); }
    if (action === "keep") { noteConfirmId = null; renderNotes(); }
    if (action === "confirm-delete") {
      if (!await attempt("note-status", () => notes.remove(n.id))) return;
      if (noteEditingId === n.id) closeNoteForm();
      noteConfirmId = null;
      say("note-status", "Note deleted.");
      renderNotes();
    }
    if (action === "pin") {
      await attempt("note-status", () => notes.update(n.id, { pinned: !n.pinned }));
      renderNotes();
    }
    if (action === "clear") {
      await saveContent(n, n.content.split("\n").filter(l => !TICKED.test(l)).join("\n"));
      say("note-status", "Ticked items removed.");
      renderNotes();
    }
    if (action === "untick") {
      await saveContent(n, n.content.split("\n").map(l => l.replace(TICKED, "")).join("\n"));
      renderNotes();
    }
    if (action === "copy") {
      // Copy as plain text (e.g. to paste into WhatsApp); ticked items get a ✓
      const body = n.kind === "list"
        ? n.content.split("\n").filter(l => l.trim()).map(l => (TICKED.test(l) ? "✓ " : "• ") + l.replace(TICKED, "")).join("\n")
        : n.content;
      try { await navigator.clipboard.writeText(n.title + "\n" + body); say("note-status", `Copied “${n.title}”.`); }
      catch { say("note-status", "Copying isn't allowed in this browser."); }
    }
  });

  // Turn web addresses in a note into links
  function linkify(text) {
    return escapeHtml(text).replace(/\bhttps?:\/\/[^\s<]+/g, url => `<a href="${url}" target="_blank" rel="noopener">${url}</a>`);
  }

  function noteCard(n) {
    let body = "";
    let ticked = 0;
    if (n.kind === "list") {
      const items = n.content.split("\n").map((line, i) => ({ line, i })).filter(x => x.line.trim());
      body = `<ul class="note-items">${items.map(({ line, i }) => {
        const done = TICKED.test(line);
        if (done) ticked++;
        return `<li class="${done ? "done" : ""}"><label><input type="checkbox" data-line="${i}" ${done ? "checked" : ""}>
          <span>${linkify(line.replace(TICKED, ""))}</span></label></li>`;
      }).join("")}</ul>`;
      if (!items.length) body = `<p class="muted small">No items yet. Tap the pencil to add some.</p>`;
    } else {
      body = `<p class="note-text">${linkify(n.content)}</p>`;
    }
    const count = n.kind === "list" ? n.content.split("\n").filter(l => l.trim()).length : 0;
    const tools = noteConfirmId === n.id
      ? `<span class="ask">Delete this note?</span>
         <button type="button" class="link" data-action="keep">Keep</button>
         <button type="button" class="danger" data-action="confirm-delete">Yes, delete</button>`
      : `${ticked ? `<button type="button" class="link" data-action="clear">Clear ticked (${ticked})</button>
         <button type="button" class="link" data-action="untick">Untick all</button>` : ""}
         <span class="spacer"></span>
         <button type="button" class="icon-btn" data-action="copy" aria-label="Copy" title="Copy"><svg viewBox="0 0 24 24" aria-hidden="true">${COPY}</svg></button>
         ${editDeleteButtons("Delete note")}`;
    return `<article class="note${n.pinned ? " pinned" : ""}${noteEditingId === n.id ? " editing" : ""}" data-id="${n.id}" data-tone="${toneFor(n.title)}">
      <header>
        <h3>${escapeHtml(n.title)}</h3>
        ${count ? `<span class="muted small">${ticked}/${count}</span>` : ""}
        <button type="button" class="icon-btn pin" data-action="pin" aria-pressed="${n.pinned}"
          aria-label="${n.pinned ? "Unpin" : "Pin to the top"}" title="${n.pinned ? "Unpin" : "Pin to the top"}"><svg viewBox="0 0 24 24" aria-hidden="true">${PIN}</svg></button>
      </header>
      ${body}
      <div class="note-tools">${tools}</div>
    </article>`;
  }

  function renderNotes() {
    $("notes-missing").hidden = notes.ready;
    $("notes-panel").hidden = !notes.ready;
    const q = $("note-search").value.trim().toLowerCase();
    // Pinned first, then the most recently changed
    const all = notes.rows.slice().sort((a, b) => (b.pinned - a.pinned) ||
      (b.updated_at || b.created_at || "").localeCompare(a.updated_at || a.created_at || ""));
    const shown = q ? all.filter(n => (n.title + "\n" + n.content).toLowerCase().includes(q)) : all;
    $("note-search").hidden = all.length < 4 && !q;
    $("notes-list").innerHTML = shown.map(noteCard).join("");
    $("notes-empty").textContent = q ? `No notes with “${$("note-search").value.trim()}”.`
      : "No notes yet. Tap “+ New note” for a shopping list, favourite restaurants, your team's phone numbers…";
    $("notes-empty").hidden = shown.length > 0;
  }

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
