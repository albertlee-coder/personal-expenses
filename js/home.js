// Home: the front screen. Shows the to-do list first, then one card per module with today's numbers.
// Each module draws its own card through its home() hook (see defineModule in core.js).
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

  mod.render = () => {
    if (!built) build();
    for (const m of MODULES) if (m.home) m.home($("home-" + m.id));
  };
})();
