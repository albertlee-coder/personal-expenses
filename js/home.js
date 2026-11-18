// Home: the front screen. Shows the to-do list first, then one card per module with today's numbers.
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
        <h2 id="home-pick-title">Show on Home</h2>
        <button type="button" class="more-close" id="home-pick-close" aria-label="Close">✕</button>
      </div>
      <p class="muted small">Turn a module off to hide its card on Home. The module itself stays in the menu. Saved on this device.</p>
      <ul class="home-pick-list" id="home-pick-list"></ul>
    </dialog>`
  });

  // Which module cards are hidden on Home (module ids), remembered on this device
  const HIDDEN_KEY = "superapp-home-hidden";
  function hiddenCards() {
    try { const list = JSON.parse(localStorage.getItem(HIDDEN_KEY)); return Array.isArray(list) ? list : []; } catch { return []; }
  }
  function setHidden(list) { try { localStorage.setItem(HIDDEN_KEY, JSON.stringify(list)); } catch {} }

  // Show or hide each card; the last card in the grid gets the full width when an odd number is showing
  function applyHidden() {
    const hidden = hiddenCards();
    let shown = 0;
    for (const m of MODULES) {
      const card = $("home-" + m.id);
      if (!card) continue;
      card.hidden = hidden.includes(m.id);
      card.classList.remove("wide");
      if (!card.hidden) shown++;
    }
    const tiles = [...document.querySelectorAll(".home-tiles > .home-card:not([hidden])")];
    if (tiles.length % 2 === 1) tiles[tiles.length - 1].classList.add("wide");
    $("home-none").hidden = shown > 0;
  }

  function renderPicker() {
    const hidden = hiddenCards();
    $("home-pick-list").innerHTML = MODULES.filter(m => m.home).map(m => `
      <li class="m-${m.id}"><label>
        <span class="pick-icon"><svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[m.id] || ICONS.home}</svg></span>
        <span class="pick-name">${escapeHtml(m.navLabel)}</span>
        <input type="checkbox" role="switch" data-module="${m.id}" ${hidden.includes(m.id) ? "" : "checked"}>
      </label></li>`).join("");
  }
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
      // To-do gets the full width at the top; the other modules share a grid of smaller cards
      (m.id === "todo" ? box : tiles).appendChild(card);
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
