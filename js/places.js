// Places: an address book of favourite spots (a restaurant you liked, a church or mosque, a futsal court...).
// Each place keeps where it is (GPS coordinates from the phone or from a pasted Google Maps link), so later
// one tap opens Google Maps with directions, and another copies the details plus a map link for WhatsApp.
// A place looks like:
//   { id, name, category_id, address, lat: -6.26, lng: 106.81 (or null), maps_url: pasted link or null,
//     phone, rating: 1..5 or null, remark, last_visit: "2026-11-18" or null, photos: [...], updated_at, created_at }
//   photos: online, file paths in the storage bucket "place-photos"; offline, the pictures themselves (data: addresses).
// A category looks like: { id, name: "Restaurant", emoji: "🍽️", sort: 0 }
(() => {
  const STAR = '<path d="M12 3.5l2.6 5.3 5.9.9-4.2 4.1 1 5.8-5.3-2.8-5.3 2.8 1-5.8-4.2-4.1 5.9-.9z"/>';
  const COPY = '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/>';
  const ARROW = '<path d="M3 11l18-8-8 18-2-8z"/>';
  const SHARE = '<circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="M8.2 10.8l7.6-4.4M8.2 13.2l7.6 4.4"/>';
  const MAX_PHOTOS = 8;

  const mod = defineModule({
    id: "places",
    title: "Places",
    tabs: [{ id: "list", label: "Places" }, { id: "categories", label: "Categories" }],
    html: `
    <div id="pl-missing" hidden>${setupNotice()}</div>

    <!-- ===== Places tab ===== -->
    <div class="view" data-panel="list">
      <section aria-labelledby="pl-heading" id="pl-panel">
        <div class="panel-head">
          <h2 id="pl-heading" data-icon="📍" data-tone="red">Your places</h2>
          <button type="button" class="primary" id="pl-new">+ New place</button>
        </div>

        <form class="entry pl-form" id="pl-form" novalidate hidden>
          <p class="note-form-title" id="pl-form-title">New place</p>
          <div class="field wide">
            <label for="pl-name">Name</label>
            <input id="pl-name" maxlength="120" autocomplete="off" placeholder="Sate Khas Senayan">
          </div>
          <div class="field">
            <label for="pl-category">Category</label>
            <select id="pl-category"></select>
          </div>
          <fieldset class="field pl-stars-field"><legend class="field-label">Rating</legend>
            <div class="pl-stars" id="pl-stars" role="radiogroup" aria-label="Rating">${[1, 2, 3, 4, 5].map(n =>
              `<button type="button" role="radio" data-star="${n}" aria-label="${n} star${n > 1 ? "s" : ""}"><svg viewBox="0 0 24 24" aria-hidden="true">${STAR}</svg></button>`).join("")}
            </div>
          </fieldset>

          <div class="field wide pl-where">
            <span class="field-label">Location</span>
            <button type="button" class="pl-gps" id="pl-gps">📍 Use my current location</button>
            <label for="pl-link" class="small">…or paste a Google Maps link (or coordinates like -6.2253, 106.8018)</label>
            <input id="pl-link" autocomplete="off" inputmode="url" placeholder="https://maps.app.goo.gl/…">
            <p class="pl-found" id="pl-found" role="status"></p>
          </div>
          <div class="field wide">
            <label for="pl-address">Address</label>
            <textarea id="pl-address" rows="3" maxlength="300" placeholder="Jl. Pakubuwono VI No. 6, Kebayoran Baru, Jakarta Selatan"></textarea>
          </div>
          <div class="field">
            <label for="pl-phone">Phone (optional)</label>
            <input id="pl-phone" type="tel" maxlength="40" autocomplete="off" placeholder="021 555 0123">
          </div>
          <div class="field">
            <label for="pl-visit">Last visit (optional)</label>
            <input id="pl-visit" type="date">
          </div>
          <div class="field wide">
            <label for="pl-remark">Remark (optional)</label>
            <textarea id="pl-remark" rows="3" maxlength="1000" placeholder="Try the sate kambing. Parking is tight on weekends."></textarea>
          </div>

          <div class="field wide">
            <span class="field-label">Photos (optional, up to ${MAX_PHOTOS})</span>
            <div class="pl-photo-edit" id="pl-photo-edit"></div>
            <div class="receipt-actions">
              <button type="button" class="link" id="pl-camera">📷 Take a photo</button>
              <button type="button" class="link" id="pl-upload">🖼️ Add from gallery</button>
            </div>
            <input type="file" id="pl-camera-file" accept="image/*" capture="environment" hidden>
            <input type="file" id="pl-upload-file" accept="image/*" multiple hidden>
            <span class="hint" id="pl-photo-hint"></span>
          </div>

          <div class="actions">
            <button type="submit" class="primary" id="pl-save">Save place</button>
            <button type="button" id="pl-cancel">Cancel</button>
          </div>
        </form>
        <span class="hint" id="pl-status" role="status"></span>

        <div class="pl-tools" id="pl-tools">
          <input id="pl-search" type="search" placeholder="Search name, address, remark" aria-label="Search places" autocomplete="off">
          <div class="pl-cats" id="pl-cats" role="group" aria-label="Category"></div>
          <div class="seg" role="group" aria-label="Sort by" id="pl-sort">
            <button type="button" data-sort="name" aria-pressed="true">A–Z</button>
            <button type="button" data-sort="rating" aria-pressed="false">Rating</button>
            <button type="button" data-sort="near" aria-pressed="false">Nearest</button>
            <button type="button" data-sort="new" aria-pressed="false">Newest</button>
          </div>
        </div>
        <p class="empty" id="pl-empty" hidden></p>
        <div class="pl-list" id="pl-list"></div>
      </section>
    </div>

    <!-- ===== Categories tab ===== -->
    <div class="view" data-panel="categories" hidden>
      <section aria-labelledby="plc-add-heading" style="display:grid;gap:12px">
        <h2 id="plc-add-heading" data-icon="🏷️" data-tone="orange">Add a category</h2>
        <form class="inline-form" id="plc-form" novalidate>
          <input id="plc-emoji" class="pl-emoji-input" maxlength="4" autocomplete="off" placeholder="📍" aria-label="Emoji (optional)">
          <input id="plc-new" maxlength="40" autocomplete="off" placeholder="e.g. Bakery" aria-label="New category name">
          <button type="submit" class="primary">Add category</button>
        </form>
        <span class="hint" id="plc-status" role="status"></span>
      </section>
      <section aria-labelledby="plc-list-heading">
        <h2 id="plc-list-heading" data-icon="📂" data-tone="amber">Your categories</h2>
        <p class="muted" style="font-size:14px">Renaming a category also changes it on its places. A category can only be deleted when no place uses it.</p>
        <ul class="cat-admin" id="plc-admin"></ul>
      </section>
    </div>

    <dialog class="receipt-view pl-viewer" id="pl-viewer" aria-label="Photo">
      <form method="dialog"><span class="small" id="pl-viewer-count"></span><button class="receipt-close" aria-label="Close">✕</button></form>
      <img id="pl-viewer-img" alt="Photo of the place">
      <div class="pl-viewer-nav">
        <button type="button" id="pl-prev" aria-label="Previous photo">‹</button>
        <button type="button" id="pl-next" aria-label="Next photo">›</button>
      </div>
    </dialog>`
  });

  const places = new Table("places");
  const cats = new Table("place_categories");
  const DEFAULT_CATS = [
    ["🍽️", "Restaurant"], ["☕", "Café"], ["🛐", "Place of worship"], ["🏟️", "Sport venue"],
    ["🛍️", "Shopping"], ["🏥", "Health"], ["🏨", "Hotel"], ["🌳", "Park & outdoors"], ["📍", "Other"]
  ];

  let editingId = null;     // place open in the form
  let confirmingId = null;  // place waiting for "Yes, delete"
  let openId = null;        // place whose details are open in the list
  let catFilter = "";       // category id shown, "" = all
  let sortBy = "name";
  let here = null;          // { lat, lng } of the phone, once asked for "Nearest"
  // The form's location: coordinates and/or the pasted link
  let formWhere = { lat: null, lng: null, maps_url: null };
  let formRating = null;
  // The form's photos: { saved: path or data: address } for photos already kept, { blob, preview } for new ones
  let formPhotos = [];
  let removedPhotos = [];   // saved photos taken out in the form, deleted after saving
  // Categories tab
  let renamingId = null;
  let catMessage = null;    // { id, text }

  mod.load = async () => {
    await Promise.all([places.load(), cats.load()]);
    // A new account starts with a few common categories
    if (cats.ready && places.ready && !cats.rows.length) {
      try { await cats.insert(DEFAULT_CATS.map(([emoji, name], i) => ({ emoji, name, sort: i }))); } catch {}
    }
  };

  function catsSorted() { return cats.rows.slice().sort((a, b) => (a.sort - b.sort) || a.name.localeCompare(b.name)); }
  function catOf(p) { return p.category_id ? cats.get(p.category_id) : null; }
  function hasCoords(p) { return p.lat != null && p.lng != null; }
  function coordText(lat, lng) { return `${Number(lat).toFixed(6)},${Number(lng).toFixed(6)}`; }

  // ---- Map links ----
  // A link that shows the place on Google Maps (opens the Maps app on a phone)
  function mapLink(p) {
    if (hasCoords(p)) return "https://www.google.com/maps/search/?api=1&query=" + coordText(p.lat, p.lng);
    if (p.maps_url) return p.maps_url;
    return "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent([p.name, p.address].filter(Boolean).join(", "));
  }
  // A link that starts directions from where you are now
  function directionsLink(p) {
    if (hasCoords(p)) return "https://www.google.com/maps/dir/?api=1&destination=" + coordText(p.lat, p.lng);
    if (p.maps_url) return p.maps_url;
    return "https://www.google.com/maps/dir/?api=1&destination=" + encodeURIComponent([p.name, p.address].filter(Boolean).join(", "));
  }

  // Read the coordinates out of a Google Maps link, or out of typed coordinates like "-6.2253, 106.8018".
  // Long links hold them (…/place/Name/@-6.22,106.80,17z/data=…!3d-6.2253!4d106.8018); short ones
  // (maps.app.goo.gl/…) don't, and a browser isn't allowed to open them to look inside.
  function readPaste(text) {
    const out = { lat: null, lng: null, url: null, name: "", lines: [] };
    let s = String(text || "").trim();
    if (!s) return out;
    const urlMatch = s.match(/https?:\/\/\S+/);
    out.url = urlMatch ? urlMatch[0] : null;
    // Words around the link (Google Maps' Share gives "Name, address" followed by the link)
    out.lines = s.replace(/https?:\/\/\S+/g, "\n").split("\n").map(l => l.trim()).filter(Boolean);
    let decoded = s;
    try { decoded = decodeURIComponent(s.replace(/\+/g, " ")); } catch {}
    const tries = [
      /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/,                                             // the place itself
      /[?&](?:q|query|ll|destination|daddr|center|sll)=(?:loc:)?\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/,
      /\/maps\/(?:search|dir|place)\/[^@]*?(-?\d{1,2}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)/,
      /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/,                                                   // the middle of the map shown
      /^\s*(-?\d{1,2}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)\s*$/                                        // just two numbers
    ];
    for (const re of tries) {
      const m = decoded.match(re);
      if (!m) continue;
      const lat = Number(m[1]), lng = Number(m[2]);
      if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0)) { out.lat = lat; out.lng = lng; break; }
    }
    // A long link names the place: …/maps/place/Sate+Khas+Senayan/@…
    const named = decoded.match(/\/maps\/place\/([^/@?]+)/);
    if (named) out.name = named[1].replace(/\s+/g, " ").trim();
    if (out.lat != null && !out.url && out.lines.length === 1) out.lines = []; // only coordinates were typed
    return out;
  }
  function isShortLink(url) { return /\/\/(maps\.app\.goo\.gl|goo\.gl\/maps|g\.co\/kgs)/i.test(url || ""); }

  // Distance in km between two points on Earth
  function km(a, b) {
    const r = Math.PI / 180;
    const x = Math.sin((b.lat - a.lat) * r / 2) ** 2 +
      Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin((b.lng - a.lng) * r / 2) ** 2;
    return 12742 * Math.asin(Math.sqrt(x));
  }
  function distText(d) { return d < 1 ? Math.round(d * 1000) + " m" : one.format(d) + " km"; }

  function whereAmI() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) { reject(new Error("this browser can't tell where you are.")); return; }
      navigator.geolocation.getCurrentPosition(
        pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
        err => reject(new Error(err.code === 1
          ? "the browser isn't allowed to use your location. Allow it in the browser's site settings and try again."
          : "your location couldn't be found. Go outside or turn on GPS and try again.")),
        { enableHighAccuracy: true, timeout: 20000, maximumAge: 30000 });
    });
  }

  // ---- Photos ----
  function photoUrl(photo) {
    if (!photo || photo.startsWith("data:") || !CLOUD) return photo;
    return sb.storage.from("place-photos").getPublicUrl(photo).data.publicUrl;
  }
  // Shrink to 1280 px on the long side so a photo is ~200 KB
  async function placePhoto(file) {
    const img = await loadImage(file);
    const scale = Math.min(1, 1280 / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
    return new Promise(resolve => canvas.toBlob(resolve, "image/jpeg", 0.8));
  }
  async function addPhotos(input) {
    const files = [...input.files];
    input.value = "";
    $("pl-photo-hint").classList.remove("error");
    $("pl-photo-hint").textContent = "";
    for (const file of files) {
      if (formPhotos.length >= MAX_PHOTOS) { $("pl-photo-hint").textContent = `Up to ${MAX_PHOTOS} photos per place.`; break; }
      try {
        const blob = await placePhoto(file);
        formPhotos.push({ blob, preview: URL.createObjectURL(blob) });
      } catch (err) {
        $("pl-photo-hint").textContent = "Couldn't use that file: " + err.message;
        $("pl-photo-hint").classList.add("error");
      }
    }
    drawFormPhotos();
  }
  function drawFormPhotos() {
    $("pl-photo-edit").innerHTML = formPhotos.map((ph, i) =>
      `<div class="pl-thumb"><img src="${escapeHtml(ph.preview || photoUrl(ph.saved))}" alt="" data-view="${i}">
        <button type="button" class="pl-thumb-x" data-remove="${i}" aria-label="Remove photo">✕</button></div>`).join("");
    $("pl-camera").hidden = $("pl-upload").hidden = formPhotos.length >= MAX_PHOTOS;
  }
  $("pl-camera").addEventListener("click", () => $("pl-camera-file").click());
  $("pl-upload").addEventListener("click", () => $("pl-upload-file").click());
  $("pl-camera-file").addEventListener("change", () => addPhotos($("pl-camera-file")));
  $("pl-upload-file").addEventListener("change", () => addPhotos($("pl-upload-file")));
  $("pl-photo-edit").addEventListener("click", event => {
    const x = event.target.closest("[data-remove]");
    if (x) {
      const [ph] = formPhotos.splice(Number(x.dataset.remove), 1);
      if (ph.preview) URL.revokeObjectURL(ph.preview);
      if (ph.saved) removedPhotos.push(ph.saved);
      drawFormPhotos();
      return;
    }
    const img = event.target.closest("[data-view]");
    if (img) openViewer(formPhotos.map(ph => ph.preview || photoUrl(ph.saved)), Number(img.dataset.view));
  });

  // Upload the form's new photos for place `id`; returns the full list to keep on the place
  async function savePhotos(id) {
    const list = [];
    for (const ph of formPhotos) {
      if (ph.saved) { list.push(ph.saved); continue; }
      if (CLOUD) {
        const path = `${currentUser.id}/${id}/${Date.now()}-${Math.random().toString(36).slice(2, 6)}.jpg`;
        const up = await sb.storage.from("place-photos").upload(path, ph.blob, { contentType: "image/jpeg" });
        if (up.error) throw new Error(/bucket not found|row-level security|policy/i.test(up.error.message)
          ? "photos need one more step: run the latest supabase-setup.sql in Supabase → SQL Editor."
          : up.error.message);
        list.push(path);
      } else {
        list.push(await new Promise(resolve => { const r = new FileReader(); r.onload = () => resolve(r.result); r.readAsDataURL(ph.blob); }));
      }
    }
    return list;
  }
  function deletePhotoFiles(list) {
    const files = (list || []).filter(p => p && !p.startsWith("data:"));
    if (CLOUD && files.length) sb.storage.from("place-photos").remove(files).catch(() => {});
  }

  // Full-screen photo viewer with previous / next
  let viewer = { urls: [], i: 0 };
  function openViewer(urls, i) {
    viewer = { urls, i };
    showViewerPhoto();
    if (!$("pl-viewer").open) $("pl-viewer").showModal();
  }
  function showViewerPhoto() {
    $("pl-viewer-img").src = viewer.urls[viewer.i];
    $("pl-viewer-count").textContent = viewer.urls.length > 1 ? `${viewer.i + 1} / ${viewer.urls.length}` : "";
    $("pl-prev").hidden = $("pl-next").hidden = viewer.urls.length < 2;
  }
  function stepViewer(n) { viewer.i = (viewer.i + n + viewer.urls.length) % viewer.urls.length; showViewerPhoto(); }
  $("pl-prev").addEventListener("click", () => stepViewer(-1));
  $("pl-next").addEventListener("click", () => stepViewer(1));
  $("pl-viewer").addEventListener("keydown", e => { if (e.key === "ArrowLeft") stepViewer(-1); if (e.key === "ArrowRight") stepViewer(1); });
  $("pl-viewer").addEventListener("click", e => { if (e.target === $("pl-viewer")) $("pl-viewer").close(); });
  // Swipe left / right on a phone
  let touchX = null;
  $("pl-viewer").addEventListener("touchstart", e => { touchX = e.touches[0].clientX; }, { passive: true });
  $("pl-viewer").addEventListener("touchend", e => {
    if (touchX == null || viewer.urls.length < 2) return;
    const dx = e.changedTouches[0].clientX - touchX;
    touchX = null;
    if (Math.abs(dx) > 50) stepViewer(dx < 0 ? 1 : -1);
  });

  // ---- The form ----
  function fillCategorySelect(selected) {
    $("pl-category").innerHTML = `<option value="">No category</option>` + catsSorted().map(c =>
      `<option value="${c.id}" ${c.id === selected ? "selected" : ""}>${escapeHtml(c.emoji)} ${escapeHtml(c.name)}</option>`).join("");
  }
  function drawStars() {
    $("pl-stars").querySelectorAll("[data-star]").forEach(b => {
      const n = Number(b.dataset.star);
      b.classList.toggle("on", formRating != null && n <= formRating);
      b.setAttribute("aria-checked", String(n === formRating));
    });
  }
  $("pl-stars").addEventListener("click", event => {
    const b = event.target.closest("[data-star]");
    if (!b) return;
    const n = Number(b.dataset.star);
    formRating = formRating === n ? null : n; // tapping the same star again clears the rating
    drawStars();
  });

  function drawFound(extra) {
    const w = formWhere;
    let html = "";
    if (w.lat != null) {
      html = `✅ GPS location: <strong>${Number(w.lat).toFixed(5)}, ${Number(w.lng).toFixed(5)}</strong>
        · <a href="${escapeHtml(mapLink(w))}" target="_blank" rel="noopener">check on the map</a>
        · <button type="button" class="link" id="pl-clear-where">clear</button>`;
    } else if (w.maps_url) {
      html = `🔗 Google Maps link saved. Directions and Copy will use this link.
        <span class="muted">A short link doesn't show the exact GPS point to this app, so “Nearest” can't sort it.
        Tip: tap <strong>Use my current location</strong> when you are there.</span>
        <button type="button" class="link" id="pl-clear-where">clear</button>`;
    }
    if (extra) html += (html ? "<br>" : "") + extra;
    $("pl-found").innerHTML = html;
    $("pl-found").classList.toggle("error", Boolean(extra && extra.startsWith("⚠️")));
  }
  $("pl-found").addEventListener("click", event => {
    if (event.target.id !== "pl-clear-where") return;
    formWhere = { lat: null, lng: null, maps_url: null };
    $("pl-link").value = "";
    drawFound();
  });

  $("pl-link").addEventListener("input", () => {
    const got = readPaste($("pl-link").value);
    if (!$("pl-link").value.trim()) { drawFound(); return; }
    if (got.lat == null && !got.url) { drawFound("⚠️ That doesn't look like a Google Maps link or coordinates."); return; }
    formWhere = { lat: got.lat, lng: got.lng, maps_url: got.url };
    // Fill empty boxes from what came with the link
    const words = got.lines.filter(l => !/google maps/i.test(l));
    if (!$("pl-name").value.trim()) $("pl-name").value = got.name || (words[0] || "").split(",")[0].trim();
    if (!$("pl-address").value.trim()) {
      const rest = words.length > 1 ? words.slice(1).join(", ") : (words[0] || "").split(",").slice(1).join(",").trim();
      if (rest) $("pl-address").value = rest;
    }
    drawFound(got.lat == null && got.url && !isShortLink(got.url) && !/google\.|goo\.gl/i.test(got.url)
      ? "⚠️ This isn't a Google Maps link, but it is kept as the place's link." : "");
  });

  $("pl-gps").addEventListener("click", async () => {
    $("pl-gps").disabled = true;
    $("pl-gps").textContent = "📍 Finding you…";
    try {
      const pos = await whereAmI();
      here = pos;
      formWhere = { lat: pos.lat, lng: pos.lng, maps_url: null };
      $("pl-link").value = "";
      drawFound(pos.accuracy > 100 ? `⚠️ Rough fix (about ${Math.round(pos.accuracy)} m). Try again outdoors for a better one.` : "");
      if (!$("pl-address").value.trim()) fillAddress(pos);
    } catch (err) {
      drawFound("⚠️ Couldn't get your location: " + err.message);
    }
    $("pl-gps").disabled = false;
    $("pl-gps").textContent = "📍 Use my current location";
  });
  // Look up the street address for the coordinates (OpenStreetMap). Best effort: if it fails, type it in.
  async function fillAddress(pos) {
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=18&accept-language=id&lat=${pos.lat}&lon=${pos.lng}`);
      if (!res.ok) return;
      const found = await res.json();
      if (found && found.display_name && !$("pl-address").value.trim() && formWhere.lat === pos.lat) {
        $("pl-address").value = found.display_name.split(", ").filter(part => !/^Indonesia$|^\d{5}$/.test(part)).join(", ");
        $("pl-address").dataset.auto = "1";
        drawFound("The address was filled in from OpenStreetMap. Check it and correct it if needed.");
      }
    } catch {}
  }

  function openForm(p) {
    editingId = p ? p.id : null;
    confirmingId = null;
    $("pl-name").value = p ? p.name : "";
    fillCategorySelect(p ? p.category_id : (catFilter || ""));
    formRating = p ? p.rating : null;
    drawStars();
    formWhere = p ? { lat: p.lat, lng: p.lng, maps_url: p.maps_url } : { lat: null, lng: null, maps_url: null };
    $("pl-link").value = p && p.maps_url && !hasCoords(p) ? p.maps_url : "";
    drawFound();
    $("pl-address").value = p ? p.address : "";
    $("pl-phone").value = p ? p.phone : "";
    $("pl-visit").value = p && p.last_visit ? p.last_visit : "";
    $("pl-remark").value = p ? p.remark : "";
    formPhotos.forEach(ph => ph.preview && URL.revokeObjectURL(ph.preview));
    formPhotos = (p ? p.photos || [] : []).map(saved => ({ saved }));
    removedPhotos = [];
    drawFormPhotos();
    $("pl-photo-hint").textContent = "";
    $("pl-form-title").textContent = p ? "Edit place" : "New place";
    $("pl-form").hidden = false;
    $("pl-new").hidden = true;
    say("pl-status", "");
    renderList();
    $("pl-form").scrollIntoView({ behavior: "smooth", block: "start" });
    if (!p) $("pl-name").focus({ preventScroll: true });
  }
  function closeForm() {
    editingId = null;
    formPhotos.forEach(ph => ph.preview && URL.revokeObjectURL(ph.preview));
    formPhotos = [];
    $("pl-form").hidden = true;
    $("pl-new").hidden = false;
  }
  $("pl-new").addEventListener("click", () => openForm(null));
  $("pl-cancel").addEventListener("click", () => { closeForm(); say("pl-status", ""); renderList(); });

  $("pl-form").addEventListener("submit", async event => {
    event.preventDefault();
    const name = $("pl-name").value.trim();
    if (!name) { say("pl-status", "Give the place a name."); $("pl-status").classList.add("error"); $("pl-name").focus(); return; }
    const entry = {
      name, category_id: $("pl-category").value || null,
      address: $("pl-address").value.trim(), phone: $("pl-phone").value.trim(),
      lat: formWhere.lat, lng: formWhere.lng, maps_url: formWhere.maps_url,
      rating: formRating, remark: $("pl-remark").value.trim(), last_visit: $("pl-visit").value || null,
      updated_at: new Date().toISOString()
    };
    const wasEditing = Boolean(editingId);
    $("pl-save").disabled = true;
    say("pl-status", formPhotos.some(ph => ph.blob) ? "Saving and uploading photos…" : "Saving…");
    let id = editingId;
    const ok = await attempt("pl-status", async () => {
      if (wasEditing) await places.update(id, entry);
      else id = (await places.insert({ ...entry, photos: [] }))[0].id;
    });
    if (!ok) { $("pl-save").disabled = false; return; }
    // The photos go up after the place is saved; if only they fail, the place still stays saved
    let photoError = null;
    try {
      const list = await savePhotos(id);
      const before = places.get(id).photos || [];
      if (list.length !== before.length || list.some((x, i) => x !== before[i])) await places.update(id, { photos: list });
      deletePhotoFiles(removedPhotos);
    } catch (err) { photoError = err.message; }
    $("pl-save").disabled = false;
    closeForm();
    openId = id;
    if (photoError) {
      $("pl-status").textContent = "The place was saved, but not all of its photos: " + photoError;
      $("pl-status").classList.add("error");
    } else say("pl-status", wasEditing ? "Changes saved." : `Added “${name}”.`);
    renderAll();
  });

  // ---- Copy and share ----
  function shareText(p) {
    const c = catOf(p);
    const lines = [`📍 ${p.name}`];
    const tag = [c ? `${c.emoji} ${c.name}` : "", p.rating ? "⭐".repeat(p.rating) : ""].filter(Boolean).join(" · ");
    if (tag) lines.push(tag);
    if (p.address) lines.push(p.address);
    if (p.phone) lines.push("📞 " + p.phone);
    if (p.remark) lines.push("📝 " + p.remark);
    lines.push(mapLink(p));
    return lines.join("\n");
  }
  async function copyPlace(p) {
    try { await navigator.clipboard.writeText(shareText(p)); say("pl-status", `Copied “${p.name}”. Paste it in WhatsApp or any chat.`); }
    catch { say("pl-status", "Copying isn't allowed in this browser."); }
  }
  async function sharePlace(p) {
    try { await navigator.share({ title: p.name, text: shareText(p) }); }
    catch (err) { if (err && err.name !== "AbortError") copyPlace(p); }
  }

  // ---- The list ----
  $("pl-search").addEventListener("input", () => renderList());
  $("pl-cats").addEventListener("click", event => {
    const b = event.target.closest("[data-cat]");
    if (!b) return;
    catFilter = b.dataset.cat;
    renderList();
  });
  $("pl-sort").addEventListener("click", async event => {
    const b = event.target.closest("[data-sort]");
    if (!b) return;
    sortBy = b.dataset.sort;
    if (sortBy === "near") {
      say("pl-status", "Finding where you are…");
      try { here = await whereAmI(); say("pl-status", ""); }
      catch (err) { say("pl-status", "Couldn't sort by distance: " + err.message); sortBy = "name"; }
    }
    renderList();
  });

  $("pl-list").addEventListener("click", async event => {
    const card = event.target.closest("[data-id]");
    if (!card) return;
    const p = places.get(card.dataset.id);
    if (!p) return;
    const photo = event.target.closest("[data-photo]");
    if (photo) { openViewer((p.photos || []).map(photoUrl), Number(photo.dataset.photo)); return; }
    const btn = event.target.closest("[data-action]");
    if (!btn) {
      // Tapping the top of a card opens or closes its details
      if (event.target.closest(".pl-top")) { openId = openId === p.id ? null : p.id; confirmingId = null; renderList(); }
      return;
    }
    const action = btn.dataset.action;
    if (action === "copy") copyPlace(p);
    if (action === "share") sharePlace(p);
    if (action === "edit") openForm(p);
    if (action === "delete") { confirmingId = p.id; renderList(); }
    if (action === "keep") { confirmingId = null; renderList(); }
    if (action === "visited") {
      if (await attempt("pl-status", () => places.update(p.id, { last_visit: todayString(), updated_at: new Date().toISOString() })))
        say("pl-status", `Marked “${p.name}” as visited today.`);
      renderAll();
    }
    if (action === "confirm-delete") {
      if (!await attempt("pl-status", () => places.remove(p.id))) return;
      deletePhotoFiles(p.photos);
      if (editingId === p.id) closeForm();
      confirmingId = null;
      say("pl-status", `Deleted “${p.name}”.`);
      renderAll();
    }
  });

  function stars(n) {
    if (!n) return "";
    return `<span class="pl-rate" aria-label="${n} out of 5 stars">${[1, 2, 3, 4, 5].map(i =>
      `<svg viewBox="0 0 24 24" class="${i <= n ? "on" : ""}" aria-hidden="true">${STAR}</svg>`).join("")}</span>`;
  }
  function telLink(phone) { return "tel:" + phone.replace(/[^\d+]/g, ""); }
  function linkify(text) {
    return escapeHtml(text).replace(/\bhttps?:\/\/[^\s<]+/g, url => `<a href="${url}" target="_blank" rel="noopener">${url}</a>`);
  }

  function placeCard(p) {
    const c = catOf(p);
    const open = openId === p.id;
    const photos = p.photos || [];
    const dist = here && hasCoords(p) ? distText(km(here, p)) : "";
    const thumb = photos.length
      ? `<img class="pl-cover" src="${escapeHtml(photoUrl(photos[0]))}" alt="" loading="lazy">`
      : `<span class="pl-cover none" aria-hidden="true">${c ? escapeHtml(c.emoji) : "📍"}</span>`;
    const meta = [c ? escapeHtml(c.name) : "", dist ? `${dist} away` : ""].filter(Boolean).join(" · ");
    let details = "";
    if (open) {
      const facts = [
        p.phone ? `<li>📞 <a href="${escapeHtml(telLink(p.phone))}">${escapeHtml(p.phone)}</a></li>` : "",
        p.last_visit ? `<li>🗓️ Last visit ${dayLabel(p.last_visit)}</li>` : "",
        hasCoords(p) ? `<li>🛰️ ${Number(p.lat).toFixed(5)}, ${Number(p.lng).toFixed(5)}</li>` : p.maps_url ? `<li>🔗 Google Maps link</li>` : `<li class="muted">No GPS location yet. Tap the pencil to add it.</li>`
      ].join("");
      const tools = confirmingId === p.id
        ? `<span class="ask">Delete this place${photos.length ? " and its photos" : ""}?</span>
           <button type="button" class="link" data-action="keep">Keep</button>
           <button type="button" class="danger" data-action="confirm-delete">Yes, delete</button>`
        : `<button type="button" class="link" data-action="visited">✓ I was here today</button><span class="spacer"></span>${editDeleteButtons("Delete place")}`;
      details = `<div class="pl-details">
        ${photos.length ? `<div class="pl-strip">${photos.map((ph, i) =>
          `<button type="button" data-photo="${i}" aria-label="See photo ${i + 1}"><img src="${escapeHtml(photoUrl(ph))}" alt="" loading="lazy"></button>`).join("")}</div>` : ""}
        ${p.remark ? `<p class="pl-remark">${linkify(p.remark)}</p>` : ""}
        <ul class="pl-facts">${facts}</ul>
        <div class="note-tools">${tools}</div>
      </div>`;
    }
    return `<article class="pl-card${open ? " open" : ""}${editingId === p.id ? " editing" : ""}" data-id="${p.id}">
      <div class="pl-top" role="button" tabindex="0" aria-expanded="${open}">
        ${thumb}
        <div class="pl-what">
          <h3>${escapeHtml(p.name)}</h3>
          <div class="pl-meta">${stars(p.rating)}${meta ? `<span>${meta}</span>` : ""}</div>
          ${p.address ? `<p class="pl-addr">${escapeHtml(p.address)}</p>` : ""}
        </div>
        ${photos.length > 1 ? `<span class="pl-count" aria-label="${photos.length} photos">📷 ${photos.length}</span>` : ""}
      </div>
      <div class="pl-actions">
        <a class="pl-go" href="${escapeHtml(directionsLink(p))}" target="_blank" rel="noopener"><svg viewBox="0 0 24 24" aria-hidden="true">${ARROW}</svg><span>Directions</span></a>
        <button type="button" data-action="copy"><svg viewBox="0 0 24 24" aria-hidden="true">${COPY}</svg><span class="long">Copy location</span><span class="short">Copy</span></button>
        ${navigator.share ? `<button type="button" class="pl-share" data-action="share" aria-label="Share" title="Share"><svg viewBox="0 0 24 24" aria-hidden="true">${SHARE}</svg></button>` : ""}
      </div>
      ${details}
    </article>`;
  }
  $("pl-list").addEventListener("keydown", event => {
    if ((event.key === "Enter" || event.key === " ") && event.target.classList.contains("pl-top")) { event.preventDefault(); event.target.click(); }
  });

  function renderList() {
    const ready = places.ready && cats.ready;
    $("pl-missing").hidden = ready;
    $("pl-panel").hidden = !ready;
    if (!ready) return;
    // Category chips, with how many places each has
    const counts = {};
    places.rows.forEach(p => { counts[p.category_id || ""] = (counts[p.category_id || ""] || 0) + 1; });
    if (catFilter && !cats.get(catFilter)) catFilter = "";
    const chip = (id, label, n) => `<button type="button" data-cat="${id}" aria-pressed="${catFilter === id}">${label}${n != null ? ` <span>${n}</span>` : ""}</button>`;
    $("pl-cats").innerHTML = chip("", "All", places.rows.length) +
      catsSorted().filter(c => counts[c.id]).map(c => chip(c.id, `${escapeHtml(c.emoji)} ${escapeHtml(c.name)}`, counts[c.id])).join("");
    $("pl-sort").querySelectorAll("[data-sort]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.sort === sortBy)));
    $("pl-tools").hidden = places.rows.length < 2;

    const q = $("pl-search").value.trim().toLowerCase();
    let shown = places.rows.filter(p => !catFilter || p.category_id === catFilter);
    if (q) shown = shown.filter(p => [p.name, p.address, p.remark, catOf(p)?.name].join("\n").toLowerCase().includes(q));
    const byName = (a, b) => a.name.localeCompare(b.name);
    if (sortBy === "name") shown.sort(byName);
    if (sortBy === "rating") shown.sort((a, b) => (b.rating || 0) - (a.rating || 0) || byName(a, b));
    if (sortBy === "new") shown.sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
    if (sortBy === "near" && here) shown.sort((a, b) =>
      (hasCoords(a) ? km(here, a) : 1e9) - (hasCoords(b) ? km(here, b) : 1e9) || byName(a, b));
    $("pl-list").innerHTML = shown.map(placeCard).join("");
    $("pl-empty").textContent = places.rows.length
      ? "No places match. Try another word or category."
      : "No places yet. Tap “+ New place” when you're somewhere you want to remember: a restaurant, a church, a futsal court…";
    $("pl-empty").hidden = shown.length > 0;
  }

  // ---- Categories tab ----
  // Pull an emoji off the front of "🍜 Noodles" so both boxes can be typed in one go
  function splitEmoji(text) {
    const m = String(text).match(/^\s*(\p{Extended_Pictographic}(?:️|‍\p{Extended_Pictographic}|\p{Emoji_Modifier})*)\s*(.*)$/u);
    return m ? [m[1], m[2]] : ["", String(text).trim()];
  }
  $("plc-form").addEventListener("submit", async event => {
    event.preventDefault();
    let [emoji, name] = splitEmoji($("plc-new").value);
    emoji = $("plc-emoji").value.trim() || emoji || "📍";
    name = name.trim();
    if (!name) { say("plc-status", "Type a name for the new category."); return; }
    if (cats.rows.some(c => c.name.toLowerCase() === name.toLowerCase())) { say("plc-status", `"${name}" already exists.`); return; }
    const sort = cats.rows.reduce((m, c) => Math.max(m, c.sort || 0), -1) + 1;
    if (!await attempt("plc-status", () => cats.insert({ name, emoji, sort }))) return;
    $("plc-new").value = ""; $("plc-emoji").value = "";
    say("plc-status", `Added "${name}".`);
    renderAll();
  });

  $("plc-admin").addEventListener("click", async event => {
    const btn = event.target.closest("button[data-action]");
    if (!btn) return;
    const id = btn.closest("li").dataset.id;
    const c = cats.get(id);
    const action = btn.dataset.action;
    catMessage = null;
    if (action === "rename") { renamingId = id; renderCats(); $("plc-rename-name")?.focus(); }
    if (action === "cancel-rename") { renamingId = null; renderCats(); }
    if (action === "save-rename") saveRename(c);
    if (action === "delete") {
      const used = places.rows.filter(p => p.category_id === id).length;
      if (used) { catMessage = { id, text: `${plural(used, "place")} ${used === 1 ? "uses" : "use"} this category. Move ${used === 1 ? "it" : "them"} to another category first.` }; renderCats(); return; }
      if (!await attempt("plc-status", () => cats.remove(id))) return;
      say("plc-status", `Deleted "${c.name}".`);
      renderAll();
    }
    if (action === "up" || action === "down") {
      const list = catsSorted();
      const i = list.findIndex(x => x.id === id), j = i + (action === "up" ? -1 : 1);
      if (j < 0 || j >= list.length) return;
      [list[i], list[j]] = [list[j], list[i]];
      // Save the new order as 0, 1, 2… on every category whose number changed
      const ok = await attempt("plc-status", () => Promise.all(list.map((x, k) => x.sort === k ? null : cats.update(x.id, { sort: k }))));
      if (ok) renderAll();
    }
  });
  $("plc-admin").addEventListener("keydown", event => {
    if (event.key === "Enter" && event.target.closest("li.renaming")) { event.preventDefault(); saveRename(cats.get(renamingId)); }
  });
  async function saveRename(c) {
    const name = $("plc-rename-name").value.trim();
    const emoji = $("plc-rename-emoji").value.trim() || "📍";
    if (!name) { catMessage = { id: c.id, text: "The name can't be empty." }; renderCats(); return; }
    if (cats.rows.some(x => x.id !== c.id && x.name.toLowerCase() === name.toLowerCase())) {
      catMessage = { id: c.id, text: `"${name}" already exists.` }; renderCats(); return;
    }
    if (!await attempt("plc-status", () => cats.update(c.id, { name, emoji }))) return;
    renamingId = null;
    say("plc-status", `Saved "${emoji} ${name}".`);
    renderAll();
  }

  function renderCats() {
    const list = catsSorted();
    const counts = {};
    places.rows.forEach(p => { if (p.category_id) counts[p.category_id] = (counts[p.category_id] || 0) + 1; });
    $("plc-admin").innerHTML = list.map((c, i) => {
      const msg = catMessage && catMessage.id === c.id ? `<span class="msg">${escapeHtml(catMessage.text)}</span>` : "";
      if (renamingId === c.id) {
        return `<li data-id="${c.id}" class="renaming">
          <input id="plc-rename-emoji" class="pl-emoji-input" value="${escapeHtml(c.emoji)}" maxlength="4" aria-label="Emoji">
          <input id="plc-rename-name" value="${escapeHtml(c.name)}" maxlength="40" aria-label="New name">
          <button type="button" class="primary" data-action="save-rename">Save</button>
          <button type="button" class="link" data-action="cancel-rename">Cancel</button>${msg}</li>`;
      }
      const n = counts[c.id] || 0;
      return `<li data-id="${c.id}">
        <span class="pl-cat-emoji" aria-hidden="true">${escapeHtml(c.emoji)}</span>
        <div class="who"><span class="name">${escapeHtml(c.name)}</span><span class="uses">${n ? plural(n, "place") : "Not used yet"}</span></div>
        <div class="cat-actions">
          <button type="button" class="link" data-action="up" aria-label="Move ${escapeHtml(c.name)} up" ${i === 0 ? "disabled" : ""}>↑</button>
          <button type="button" class="link" data-action="down" aria-label="Move ${escapeHtml(c.name)} down" ${i === list.length - 1 ? "disabled" : ""}>↓</button>
          <button type="button" class="link" data-action="rename">Edit</button>
          <button type="button" class="link del" data-action="delete">Delete</button>
        </div>${msg}</li>`;
    }).join("");
  }

  mod.render = () => {
    if (!$("pl-form").hidden && document.activeElement !== $("pl-category")) fillCategorySelect($("pl-category").value);
    renderList();
    renderCats();
  };

  // Home's "+ Add a place" opens #places/new: show the empty form
  function checkNew() {
    if (location.hash !== "#places/new" || !places.ready) return;
    history.replaceState(null, "", "#places/list");
    openForm(null);
  }
  window.addEventListener("hashchange", checkNew);
  mod.onEnter = () => setTimeout(checkNew, 0);

  // ---- Home card: how many places, and the latest ones with a Directions link ----
  mod.home = card => {
    if (!places.ready || !cats.ready) { card.innerHTML = `<div class="panel-head"><h2>Places</h2></div>${setupNotice()}`; return; }
    const latest = places.rows.slice().sort((a, b) =>
      (b.last_visit || b.created_at || "").localeCompare(a.last_visit || a.created_at || "")).slice(0, 3);
    card.innerHTML = `<div class="panel-head"><h2>Places</h2><a href="#places/new">Add a place</a></div>
      <div class="lines"><span class="big">${places.rows.length}</span><span class="muted small">favourite place${places.rows.length === 1 ? "" : "s"} saved</span></div>
      ${latest.length ? `<ul class="pl-home">${latest.map(p => {
        const c = catOf(p);
        return `<li><span aria-hidden="true">${c ? escapeHtml(c.emoji) : "📍"}</span><a href="#places/list">${escapeHtml(p.name)}</a>
          <a class="pl-home-go" href="${escapeHtml(directionsLink(p))}" target="_blank" rel="noopener" aria-label="Directions to ${escapeHtml(p.name)}"><svg viewBox="0 0 24 24" aria-hidden="true">${ARROW}</svg></a></li>`;
      }).join("")}</ul>` : ""}`;
  };
})();
