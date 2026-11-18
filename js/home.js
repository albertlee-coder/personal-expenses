// Home: the front screen. One card per module with today's numbers, in the order the user picks
// ("Customize Home": show or hide each card and move it up or down; saved on this device).
// Each module draws its own card through its home() hook (see defineModule in core.js); dress() then gives
// every card the same look: an icon and a tagline in the coloured top band, the numbers on a white inner
// card, and the module's main action ("Add expense", "Record a meal"...) as a wide button at the bottom.
(() => {
  const mod = defineModule({
    id: "home",
    title: "Lifeboard",
    navLabel: "Home",
    html: `<div class="home-cards" id="home-cards"></div>
    <p class="empty" id="home-none" hidden>All cards are hidden. Tap “Customize Home” to show some again.</p>
    <button type="button" class="home-customize" id="home-customize">⚙️ Customize Home</button>
    <dialog class="more-sheet home-pick" id="home-pick" aria-labelledby="home-pick-title">
      <div class="more-head">
        <h2 id="home-pick-title">Customize Home</h2>
        <button type="button" class="more-close" id="home-pick-close" aria-label="Close">✕</button>
      </div>
      <p class="muted small">Use the arrows to change the order of the cards, and the switch to show or hide a card. Modules stay in the menu either way. Saved on this device.</p>
      <ul class="home-pick-list" id="home-pick-list"></ul>
    </dialog>`
  });

  // Which module cards are hidden on Home (module ids), remembered on this device
  const HIDDEN_KEY = "superapp-home-hidden";
  function hiddenCards() {
    try { const list = JSON.parse(localStorage.getItem(HIDDEN_KEY)); return Array.isArray(list) ? list : []; } catch { return []; }
  }
  function setHidden(list) { try { localStorage.setItem(HIDDEN_KEY, JSON.stringify(list)); } catch {} }

  // The order of the cards (module ids); modules added later go at the end
  const ORDER_KEY = "superapp-home-order";
  function cardOrder() {
    const ids = MODULES.filter(m => m.home).map(m => m.id);
    let saved = [];
    try { const list = JSON.parse(localStorage.getItem(ORDER_KEY)); if (Array.isArray(list)) saved = list; } catch {}
    saved = saved.filter(id => ids.includes(id));
    return [...saved, ...ids.filter(id => !saved.includes(id))];
  }
  function setOrder(list) { try { localStorage.setItem(ORDER_KEY, JSON.stringify(list)); } catch {} }

  // Put the cards in the chosen order and show or hide each one. To-do always takes the full width (it is a list);
  // in a run of smaller cards, a last card left alone on its row takes the full width too.
  function applyHidden() {
    const hidden = hiddenCards();
    const tiles = document.querySelector(".home-tiles");
    let shown = 0;
    for (const id of cardOrder()) {
      const card = $("home-" + id);
      if (!card) continue;
      tiles.appendChild(card);
      card.hidden = hidden.includes(id);
      card.classList.toggle("wide", id === "todo");
      if (!card.hidden) shown++;
    }
    let run = [];
    const closeRun = () => { if (run.length % 2 === 1) run[run.length - 1].classList.add("wide"); run = []; };
    for (const card of tiles.querySelectorAll(".home-card:not([hidden])")) {
      if (card.id === "home-todo") closeRun(); else run.push(card);
    }
    closeRun();
    $("home-none").hidden = shown > 0;
  }

  const UP = '<path d="M6 15l6-6 6 6"/>', DOWN = '<path d="M6 9l6 6 6-6"/>';
  function renderPicker() {
    const hidden = hiddenCards();
    const order = cardOrder();
    $("home-pick-list").innerHTML = order.map((id, i) => {
      const m = MODULES.find(x => x.id === id);
      return `<li class="m-${m.id}" data-module="${m.id}">
        <span class="pick-move">
          <button type="button" class="icon-btn" data-move="-1" aria-label="Move ${escapeHtml(m.navLabel)} up" ${i === 0 ? "disabled" : ""}><svg viewBox="0 0 24 24" aria-hidden="true">${UP}</svg></button>
          <button type="button" class="icon-btn" data-move="1" aria-label="Move ${escapeHtml(m.navLabel)} down" ${i === order.length - 1 ? "disabled" : ""}><svg viewBox="0 0 24 24" aria-hidden="true">${DOWN}</svg></button>
        </span>
        <label>
          <span class="pick-icon"><svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[m.id] || ICONS.home}</svg></span>
          <span class="pick-name">${escapeHtml(m.navLabel)}</span>
          <input type="checkbox" role="switch" data-module="${m.id}" aria-label="Show ${escapeHtml(m.navLabel)} on Home" ${hidden.includes(m.id) ? "" : "checked"}>
        </label></li>`;
    }).join("");
  }
  $("home-pick-list").addEventListener("click", event => {
    const btn = event.target.closest("[data-move]");
    if (!btn) return;
    const id = btn.closest("li").dataset.module;
    const order = cardOrder();
    const i = order.indexOf(id), j = i + Number(btn.dataset.move);
    if (j < 0 || j >= order.length) return;
    [order[i], order[j]] = [order[j], order[i]];
    setOrder(order);
    applyHidden();
    renderPicker();
    // Keep the moved module's button under the finger so it can be tapped again
    const again = $("home-pick-list").querySelector(`li[data-module="${id}"] [data-move="${btn.dataset.move}"]`);
    (again && !again.disabled ? again : $("home-pick-list").querySelector(`li[data-module="${id}"] input`)).focus();
  });
  $("home-customize").addEventListener("click", () => { renderPicker(); $("home-pick").showModal(); });
  $("home-pick-close").addEventListener("click", () => $("home-pick").close());
  $("home-pick").addEventListener("click", event => { if (event.target === $("home-pick")) $("home-pick").close(); });
  $("home-pick-list").addEventListener("change", event => {
    const id = event.target.dataset.module;
    if (!id) return;
    const hidden = hiddenCards().filter(h => h !== id);
    if (!event.target.checked) hidden.push(id);
    setHidden(hidden);
    applyHidden();
  });

  let built = false;
  // Make one card per module that has a home() hook, the first time Home is drawn
  function build() {
    const box = $("home-cards");
    const tiles = document.createElement("div");
    tiles.className = "home-tiles";
    for (const m of MODULES) {
      if (!m.home) continue;
      const card = document.createElement("section");
      card.className = "panel home-card m-" + m.id;
      card.id = "home-" + m.id;
      tiles.appendChild(card); // applyHidden() then puts them in the chosen order

      if (m.homeSetup) m.homeSetup(card);
    }
    box.appendChild(tiles);
    built = true;
  }

  function dress(m, card) {
    const head = card.querySelector(":scope > .panel-head");
    if (!head || head.dataset.dressed) return;
    head.dataset.dressed = "1";
    const h2 = head.querySelector("h2");
    const link = head.querySelector("a");
    const titles = document.createElement("div");
    titles.className = "titles";
    titles.innerHTML = `<span class="muted small">${escapeHtml(TAGLINE[m.id] || "")}</span>`;
    titles.prepend(h2);
    head.prepend(titles);
    // A link that opens the module stays up top as a small button; an action becomes the wide button below
    let cta = null;
    if (link && /^(add|record)/i.test(link.textContent)) {
      cta = link;
      cta.className = "cta";
      cta.textContent = "+ " + cta.textContent;
      head.insertAdjacentHTML("beforeend",
        `<a class="go" href="#${m.id}" aria-label="Open ${escapeHtml(m.title)}">›</a>`);
    } else if (link) {
      link.classList.add("more");
      link.textContent += " →";
    }
    const body = document.createElement("div");
    body.className = "card-body";
    [...card.children].filter(el => el !== head && el !== cta).forEach(el => body.appendChild(el));
    card.appendChild(body);
    if (cta) card.appendChild(cta);
  }

  mod.render = () => {
    if (!built) build();
    for (const m of MODULES) if (m.home) { m.home($("home-" + m.id)); dress(m, $("home-" + m.id)); }
    applyHidden();
  };
})();
