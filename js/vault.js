// Vault: passwords and other small secrets, locked with one master password.
// Everything is encrypted in this browser before it is saved, so the database only ever holds scrambled text:
//   - The master password turns into a "key-encryption key" with PBKDF2-SHA256 (600,000 rounds, random salt).
//   - That key unlocks a random 256-bit "vault key" (stored only in wrapped form, table `vault_keys`, one row per person).
//   - Each item is { title, username, password, website, note }, turned into JSON and encrypted with the vault key
//     using AES-GCM and a fresh random IV (table `vault_items`: { id, iv, data, updated_at, created_at }).
// Changing the master password only re-wraps the vault key, so the items themselves don't change.
// The master password and the unlocked key live only in this page's memory; the vault locks itself after
// 5 minutes without use, after 1 minute in the background, and on logout. A forgotten master password can't be recovered.
(() => {
  const ITERATIONS = 600000;
  const IDLE_LOCK = 5 * 60 * 1000;
  const HIDDEN_LOCK = 60 * 1000;
  const MIN_MASTER = 10;
  const enc = new TextEncoder(), dec = new TextDecoder();

  const keys = new Table("vault_keys");
  const items = new Table("vault_items");

  let vaultKey = null;            // CryptoKey while unlocked, null while locked
  let opened = new Map();         // item id -> decrypted item, only while unlocked
  let broken = new Set();         // ids of items that couldn't be decrypted
  let editingId = null;           // item in the form ("" = new item, null = form closed)
  let confirmingId = null;        // item asking "Delete?"
  let revealed = new Set();       // items whose password is showing
  let query = "";
  let idleTimer = null, hiddenTimer = null;

  const EYE = '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>';
  const EYE_OFF = '<path d="M3 3l18 18M10.6 5.1A10.8 10.8 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.6 6.6C3.8 8.4 2 12 2 12s3.6 7 10 7c1.9 0 3.5-.6 4.9-1.4"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>';
  const COPY = '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/>';
  const KEY = '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M17 6l3 3M14 9l2 2"/>';
  const LOCK = '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>';

  const mod = defineModule({
    id: "vault",
    title: "Vault",
    tabs: [{ id: "items", label: "Vault" }],
    html: `
    <div id="vt-missing" hidden>${setupNotice()}</div>
    <div class="view" data-panel="items">

      <!-- First time: choose a master password -->
      <section class="panel vt-gate" id="vt-setup" hidden aria-labelledby="vt-setup-heading">
        <h2 id="vt-setup-heading" data-icon="🔐" data-tone="violet">Create your vault</h2>
        <p class="small">Your vault is locked with a <strong>master password</strong>. Everything in it is encrypted on this
          device before it is saved, so nobody else can read it, not even the database.</p>
        <p class="vt-warn"><strong>Don't forget it.</strong> The master password can't be reset or recovered.
          If you lose it, everything in the vault is lost too. Write it down and keep it somewhere safe.</p>
        <form class="entry" id="vt-setup-form" novalidate>
          <div class="field wide">
            <label for="vt-new1">Master password (at least ${MIN_MASTER} characters)</label>
            <input id="vt-new1" type="password" autocomplete="off" minlength="${MIN_MASTER}">
          </div>
          <div class="field wide">
            <label for="vt-new2">Type it again</label>
            <input id="vt-new2" type="password" autocomplete="off">
          </div>
          <label class="vt-check wide"><input type="checkbox" id="vt-understand">
            I understand a forgotten master password means losing what's in the vault</label>
          <div class="actions">
            <button type="submit" class="primary" id="vt-create">Create vault</button>
            <span class="hint" id="vt-setup-status" role="status"></span>
          </div>
        </form>
      </section>

      <!-- Locked -->
      <section class="panel vt-gate" id="vt-locked" hidden aria-labelledby="vt-locked-heading">
        <h2 id="vt-locked-heading" data-icon="🔒" data-tone="violet">Vault is locked</h2>
        <form class="vt-unlock" id="vt-unlock-form" novalidate>
          <label for="vt-master" class="small">Master password</label>
          <div class="vt-unlock-row">
            <input id="vt-master" type="password" autocomplete="off">
            <button type="submit" class="primary" id="vt-unlock">Unlock</button>
          </div>
          <span class="hint" id="vt-unlock-status" role="status"></span>
        </form>
        <p class="muted small">It locks again by itself after 5 minutes without use.</p>
      </section>

      <!-- Unlocked -->
      <section id="vt-open" hidden aria-labelledby="vt-heading">
        <div class="panel-head">
          <h2 id="vt-heading" data-icon="🔑" data-tone="violet">Your vault</h2>
          <div class="vt-head-actions">
            <button type="button" class="link" id="vt-lock"><svg viewBox="0 0 24 24" aria-hidden="true">${LOCK}</svg>Lock</button>
            <button type="button" class="primary" id="vt-new">+ New</button>
          </div>
        </div>

        <form class="entry vt-form" id="vt-form" novalidate hidden>
          <p class="note-form-title" id="vt-form-title">New item</p>
          <div class="field wide">
            <label for="vt-title">Name</label>
            <input id="vt-title" maxlength="120" autocomplete="off" placeholder="Home WiFi, Netflix, Gym locker">
          </div>
          <div class="field wide">
            <label for="vt-user">Username or email (optional)</label>
            <input id="vt-user" maxlength="200" autocomplete="off" autocapitalize="none" spellcheck="false">
          </div>
          <div class="field wide">
            <label for="vt-pass">Password or PIN</label>
            <div class="vt-pass-row">
              <input id="vt-pass" type="password" maxlength="500" autocomplete="new-password" spellcheck="false">
              <button type="button" class="icon-btn" id="vt-pass-show" aria-label="Show password" title="Show"><svg viewBox="0 0 24 24" aria-hidden="true">${EYE}</svg></button>
              <button type="button" class="link" id="vt-gen" title="Make a strong random password">Generate</button>
            </div>
          </div>
          <div class="field wide">
            <label for="vt-site">Website (optional)</label>
            <input id="vt-site" maxlength="300" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="netflix.com">
          </div>
          <div class="field wide">
            <label for="vt-note">Note (optional)</label>
            <textarea id="vt-note" rows="3" maxlength="2000" placeholder="Security question answers, account number..."></textarea>
          </div>
          <div class="actions">
            <button type="submit" class="primary" id="vt-save">Save</button>
            <button type="button" id="vt-cancel">Cancel</button>
          </div>
        </form>
        <span class="hint" id="vt-status" role="status"></span>

        <input id="vt-search" type="search" placeholder="Search" aria-label="Search the vault" autocomplete="off" hidden>
        <p class="empty" id="vt-empty" hidden></p>
        <ul class="list vt-list" id="vt-list"></ul>

        <details class="vt-change">
          <summary>Change master password</summary>
          <form class="entry" id="vt-change-form" novalidate>
            <div class="field wide">
              <label for="vt-old">Current master password</label>
              <input id="vt-old" type="password" autocomplete="off">
            </div>
            <div class="field wide">
              <label for="vt-chg1">New master password (at least ${MIN_MASTER} characters)</label>
              <input id="vt-chg1" type="password" autocomplete="off">
            </div>
            <div class="field wide">
              <label for="vt-chg2">Type the new one again</label>
              <input id="vt-chg2" type="password" autocomplete="off">
            </div>
            <div class="actions">
              <button type="submit" class="primary" id="vt-change">Change master password</button>
              <span class="hint" id="vt-change-status" role="status"></span>
            </div>
          </form>
        </details>
      </section>
    </div>`
  });

  // ---------- Crypto (Web Crypto, built into the browser) ----------
  const b64 = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes)));
  const unb64 = text => Uint8Array.from(atob(text), c => c.charCodeAt(0));
  const random = n => crypto.getRandomValues(new Uint8Array(n));

  async function deriveWrapKey(master, salt, iterations) {
    const base = await crypto.subtle.importKey("raw", enc.encode(master), "PBKDF2", false, ["deriveKey"]);
    return crypto.subtle.deriveKey({ name: "PBKDF2", hash: "SHA-256", salt, iterations },
      base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  }
  const importVaultKey = raw => crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
  // The wrapped vault key for a master password: { salt, iterations, key_iv, wrapped_key }
  async function wrapVaultKey(raw, master) {
    const salt = random(16), iv = random(12);
    const wrapKey = await deriveWrapKey(master, salt, ITERATIONS);
    const wrapped = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, wrapKey, raw);
    return { salt: b64(salt), iterations: ITERATIONS, key_iv: b64(iv), wrapped_key: b64(wrapped) };
  }
  // The raw vault key, or an error when the master password is wrong (AES-GCM refuses to decrypt)
  async function unwrapVaultKey(row, master) {
    const wrapKey = await deriveWrapKey(master, unb64(row.salt), row.iterations);
    return new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(row.key_iv) }, wrapKey, unb64(row.wrapped_key)));
  }
  async function sealItem(item) {
    const iv = random(12);
    const data = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, vaultKey, enc.encode(JSON.stringify(item)));
    return { iv: b64(iv), data: b64(data) };
  }
  async function openItem(row) {
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(row.iv) }, vaultKey, unb64(row.data));
    return JSON.parse(dec.decode(plain));
  }

  // A strong random password: 20 characters, at least one of each kind, no look-alikes (0/O, 1/l/I)
  function generatePassword(length = 20) {
    const sets = ["ABCDEFGHJKLMNPQRSTUVWXYZ", "abcdefghijkmnopqrstuvwxyz", "23456789", "!@#$%^&*-_=+?"];
    const all = sets.join("");
    const pick = chars => {
      const limit = 256 - (256 % chars.length);
      for (;;) { const [b] = random(1); if (b < limit) return chars[b % chars.length]; }
    };
    for (;;) {
      const out = Array.from({ length }, () => pick(all)).join("");
      if (sets.every(s => [...out].some(c => s.includes(c)))) return out;
    }
  }

  // ---------- Locking ----------
  function lock() {
    vaultKey = null;
    opened = new Map();
    broken = new Set();
    revealed = new Set();
    editingId = null; confirmingId = null; query = "";
    clearTimeout(idleTimer); clearTimeout(hiddenTimer);
    ["vt-title", "vt-user", "vt-pass", "vt-site", "vt-note", "vt-old", "vt-chg1", "vt-chg2", "vt-search"]
      .forEach(id => { $(id).value = ""; });
    mod.render();
  }
  function touch() {
    if (!vaultKey) return;
    clearTimeout(idleTimer);
    idleTimer = setTimeout(lock, IDLE_LOCK);
  }
  mod.el.addEventListener("pointerdown", touch);
  mod.el.addEventListener("keydown", touch);
  document.addEventListener("visibilitychange", () => {
    clearTimeout(hiddenTimer);
    if (document.hidden && vaultKey) hiddenTimer = setTimeout(lock, HIDDEN_LOCK);
  });
  window.addEventListener("pagehide", () => { if (vaultKey) lock(); });

  async function unlockWith(raw) {
    vaultKey = await importVaultKey(raw);
    raw.fill(0);
    opened = new Map(); broken = new Set();
    for (const row of items.rows) {
      try { opened.set(row.id, await openItem(row)); } catch { broken.add(row.id); }
    }
    touch();
  }

  // ---------- Data ----------
  mod.load = async () => { await Promise.all([keys.load(), items.load()]); };

  // ---------- Create the vault ----------
  $("vt-setup-form").addEventListener("submit", async event => {
    event.preventDefault();
    const a = $("vt-new1").value, b = $("vt-new2").value;
    if (a.length < MIN_MASTER) return fail("vt-setup-status", `Use at least ${MIN_MASTER} characters.`);
    if (a !== b) return fail("vt-setup-status", "The two passwords are different.");
    if (!$("vt-understand").checked) return fail("vt-setup-status", "Please tick the box first.");
    $("vt-create").disabled = true;
    say("vt-setup-status", "Creating…");
    const raw = random(32);
    const ok = await attempt("vt-setup-status", async () => {
      await keys.insert(await wrapVaultKey(raw, a));
      await unlockWith(raw);
    });
    $("vt-create").disabled = false;
    if (!ok) return;
    $("vt-new1").value = $("vt-new2").value = "";
    $("vt-understand").checked = false;
    say("vt-setup-status", "");
    mod.render();
  });

  // ---------- Unlock ----------
  $("vt-unlock-form").addEventListener("submit", async event => {
    event.preventDefault();
    const row = keys.rows[0];
    if (!row) return;
    $("vt-unlock").disabled = true;
    say("vt-unlock-status", "Unlocking…");
    try {
      const raw = await unwrapVaultKey(row, $("vt-master").value);
      await unlockWith(raw);
      $("vt-master").value = "";
      say("vt-unlock-status", "");
      mod.render();
    } catch {
      fail("vt-unlock-status", "Wrong master password.");
      $("vt-master").select();
    } finally {
      $("vt-unlock").disabled = false;
    }
  });
  $("vt-lock").addEventListener("click", lock);

  // ---------- Change the master password ----------
  $("vt-change-form").addEventListener("submit", async event => {
    event.preventDefault();
    const row = keys.rows[0];
    const a = $("vt-chg1").value, b = $("vt-chg2").value;
    if (a.length < MIN_MASTER) return fail("vt-change-status", `Use at least ${MIN_MASTER} characters.`);
    if (a !== b) return fail("vt-change-status", "The two new passwords are different.");
    $("vt-change").disabled = true;
    say("vt-change-status", "Checking…");
    let raw;
    try { raw = await unwrapVaultKey(row, $("vt-old").value); }
    catch { $("vt-change").disabled = false; return fail("vt-change-status", "The current master password is wrong."); }
    const ok = await attempt("vt-change-status", async () => {
      await keys.update(row.id, await wrapVaultKey(raw, a));
    });
    raw.fill(0);
    $("vt-change").disabled = false;
    if (!ok) return;
    ["vt-old", "vt-chg1", "vt-chg2"].forEach(id => { $(id).value = ""; });
    say("vt-change-status", "Master password changed. Use the new one next time.");
  });

  // ---------- Add / edit ----------
  function openForm(id) {
    editingId = id;
    confirmingId = null;
    const it = id ? opened.get(id) || {} : {};
    $("vt-form-title").textContent = id ? "Edit item" : "New item";
    $("vt-title").value = it.title || "";
    $("vt-user").value = it.username || "";
    $("vt-pass").value = it.password || "";
    $("vt-site").value = it.website || "";
    $("vt-note").value = it.note || "";
    setPassVisible(false);
    say("vt-status", "");
    mod.render();
    $("vt-title").focus();
  }
  function closeForm() {
    editingId = null;
    ["vt-title", "vt-user", "vt-pass", "vt-site", "vt-note"].forEach(id => { $(id).value = ""; });
    mod.render();
  }
  function setPassVisible(show) {
    $("vt-pass").type = show ? "text" : "password";
    $("vt-pass-show").innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${show ? EYE_OFF : EYE}</svg>`;
    $("vt-pass-show").setAttribute("aria-label", show ? "Hide password" : "Show password");
  }
  $("vt-new").addEventListener("click", () => openForm(""));
  $("vt-cancel").addEventListener("click", closeForm);
  $("vt-pass-show").addEventListener("click", () => setPassVisible($("vt-pass").type === "password"));
  $("vt-gen").addEventListener("click", () => { $("vt-pass").value = generatePassword(); setPassVisible(true); });

  $("vt-form").addEventListener("submit", async event => {
    event.preventDefault();
    if (!vaultKey) return;
    const item = {
      title: $("vt-title").value.trim(),
      username: $("vt-user").value.trim(),
      password: $("vt-pass").value,
      website: $("vt-site").value.trim(),
      note: $("vt-note").value.trim()
    };
    if (!item.title) { fail("vt-status", "Give it a name."); $("vt-title").focus(); return; }
    $("vt-save").disabled = true;
    const id = editingId;
    const ok = await attempt("vt-status", async () => {
      const sealed = await sealItem(item);
      if (id) {
        await items.update(id, { ...sealed, updated_at: new Date().toISOString() });
        opened.set(id, item);
        broken.delete(id);
      } else {
        const [row] = await items.insert(sealed);
        opened.set(row.id, item);
      }
    });
    $("vt-save").disabled = false;
    if (!ok) return;
    closeForm();
    say("vt-status", id ? "Saved." : "Added to the vault.");
  });

  // ---------- List ----------
  $("vt-search").addEventListener("input", () => { query = $("vt-search").value.trim().toLowerCase(); renderList(); });

  async function copy(text, what) {
    try { await navigator.clipboard.writeText(text); say("vt-status", `${what} copied.`); }
    catch { fail("vt-status", "Couldn't copy. Tap the eye to show it and copy by hand."); }
  }

  $("vt-list").addEventListener("click", async event => {
    const btn = event.target.closest("[data-action]");
    if (!btn) return;
    const li = btn.closest("li[data-id]");
    const id = li.dataset.id;
    const it = opened.get(id);
    const action = btn.dataset.action;
    if (action === "copy-user" && it) return copy(it.username, "Username");
    if (action === "copy-pass" && it) return copy(it.password, "Password");
    if (action === "reveal") { if (revealed.has(id)) revealed.delete(id); else revealed.add(id); return renderList(); }
    if (action === "edit") return openForm(id);
    if (action === "delete") { confirmingId = id; return renderList(); }
    if (action === "keep") { confirmingId = null; return renderList(); }
    if (action === "confirm-delete") {
      const ok = await attempt("vt-status", () => items.remove(id));
      if (ok) { opened.delete(id); broken.delete(id); confirmingId = null; say("vt-status", "Deleted."); }
      renderList();
    }
  });

  function websiteLink(site) {
    if (!site) return "";
    const url = /^https?:\/\//i.test(site) ? site : "https://" + site;
    try { new URL(url); } catch { return escapeHtml(site); }
    return `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(site.replace(/^https?:\/\//i, ""))}</a>`;
  }

  function renderList() {
    const list = [...opened.entries()]
      .map(([id, it]) => ({ id, ...it }))
      .sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: "base" }));
    $("vt-search").hidden = list.length < 5;
    const shown = query
      ? list.filter(it => [it.title, it.username, it.website, it.note].some(v => (v || "").toLowerCase().includes(query)))
      : list;
    const empty = !list.length && !broken.size
      ? "Nothing here yet. Tap + New to add a password."
      : !shown.length && query ? "Nothing matches your search." : "";
    $("vt-empty").textContent = empty;
    $("vt-empty").hidden = !empty;
    const iconBtn = (action, label, svg) =>
      `<button type="button" class="icon-btn" data-action="${action}" aria-label="${label}" title="${label}"><svg viewBox="0 0 24 24" aria-hidden="true">${svg}</svg></button>`;
    $("vt-list").innerHTML = shown.map(it => {
      const show = revealed.has(it.id);
      const actions = confirmingId === it.id
        ? `<span class="ask">Delete "${escapeHtml(it.title)}"?</span>
           <button type="button" class="link" data-action="keep">Keep</button>
           <button type="button" class="danger" data-action="confirm-delete">Yes, delete</button>`
        : (it.username ? iconBtn("copy-user", "Copy username", COPY) : "") +
          (it.password ? iconBtn("reveal", show ? "Hide password" : "Show password", show ? EYE_OFF : EYE) +
            iconBtn("copy-pass", "Copy password", KEY) : "") +
          editDeleteButtons();
      return `<li data-id="${it.id}" class="vt-item">
        ${badge(it.title)}
        <div class="what">
          <span class="cat">${escapeHtml(it.title)}</span>
          <span class="meta">${[it.username && escapeHtml(it.username), websiteLink(it.website)].filter(Boolean).join(" · ") || "&nbsp;"}</span>
          ${show ? `<code class="vt-secret">${escapeHtml(it.password)}</code>` : ""}
          ${show && it.note ? `<span class="vt-note">${escapeHtml(it.note)}</span>` : ""}
        </div>
        <div class="row-actions">${actions}</div>
      </li>`;
    }).join("") + [...broken].map(id => `<li data-id="${id}" class="vt-item broken">
        ${badge("?", "⚠️", "red")}
        <div class="what"><span class="cat">Can't be opened</span>
          <span class="meta">This item was saved with a different key.</span></div>
        <div class="row-actions">${confirmingId === id
          ? `<button type="button" class="link" data-action="keep">Keep</button><button type="button" class="danger" data-action="confirm-delete">Yes, delete</button>`
          : `<button type="button" class="icon-btn del" data-action="delete" aria-label="Delete" title="Delete"><svg viewBox="0 0 24 24" aria-hidden="true">${BIN}</svg></button>`}</div>
      </li>`).join("");
  }

  function fail(statusId, text) {
    say(statusId, text);
    $(statusId).classList.add("error");
  }

  mod.render = () => {
    const missing = !keys.ready || !items.ready;
    $("vt-missing").hidden = !missing;
    const hasVault = keys.rows.length > 0;
    $("vt-setup").hidden = missing || hasVault;
    $("vt-locked").hidden = missing || !hasVault || Boolean(vaultKey);
    $("vt-open").hidden = missing || !vaultKey;
    if (!vaultKey) return;
    $("vt-form").hidden = editingId === null;
    $("vt-new").hidden = editingId !== null;
    renderList();
  };
  mod.onEnter = () => { if (keys.rows.length && !vaultKey) setTimeout(() => { if (!$("module-vault").hidden) $("vt-master").focus(); }, 0); };
})();
