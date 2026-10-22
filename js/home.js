// Home: the front screen. Shows the to-do list first, then one card per module with today's numbers.
// Each module draws its own card through its home() hook (see defineModule in core.js); dress() then gives
// every card the same look: an icon and a tagline in the coloured top band, the numbers on a white inner
// card, and the module's main action ("Add expense", "Record a meal"...) as a wide button at the bottom.
(() => {
  const mod = defineModule({
    id: "home",
    title: "Personal Superapp",
    navLabel: "Home",
    html: `<div class="home-cards" id="home-cards"></div>`
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
  };
})();
