/* ============ 1. DATA ============ */

const img = (id) => `https://picsum.photos/id/${id}/900/700`;

const allPhotos = [
  { id: "p1",  src: img(1015), title: "Dune sunrise",    takenAt: "2026-10-12T06:40:00", category: "Nature" },
  { id: "p2",  src: img(1018), title: "Rock formations", takenAt: "2026-10-12T08:15:00", category: "Nature" },
  { id: "p3",  src: img(1080), title: "Camp dinner",     takenAt: "2026-10-12T19:20:00", category: "Food" },
  { id: "p4",  src: img(1016), title: "Road trip",       takenAt: "2026-10-05T14:00:00", category: "Travel" },
  { id: "p5",  src: img(1011), title: "With friends",    takenAt: "2026-10-01T17:45:00", category: "People" },
  { id: "p6",  src: img(1005), title: "Group photo",     takenAt: "2026-10-01T18:05:00", category: "People" },
  { id: "p7",  src: img(1039), title: "Beach morning",   takenAt: "2026-08-22T09:10:00", category: "Travel" },
  { id: "p8",  src: img(1060), title: "Seafood lunch",   takenAt: "2026-08-22T13:30:00", category: "Food" },
  { id: "p9",  src: img(1043), title: "Forest walk",     takenAt: "2026-08-03T11:00:00", category: "Nature" },
  { id: "p10", src: img(1044), title: "City lights",     takenAt: "2026-01-15T20:30:00", category: "Travel" },
  { id: "p11", src: img(1050), title: "Street market",   takenAt: "2026-01-15T16:00:00", category: "Food" },
  { id: "p12", src: img(1036), title: "First snow",      takenAt: "2026-01-04T08:00:00", category: "Nature" },
];


const defaultAlbums = [
  { id: "a1", name: "Camera",          photoIds: ["p1", "p2", "p4", "p7", "p9", "p12"] },
  { id: "a2", name: "WhatsApp Images", photoIds: ["p5", "p6", "p8", "p11"] },
  { id: "a3", name: "Desert Trip",     photoIds: ["p1", "p2", "p3"] },
];

// Albums are saved in the browser (localStorage) so they survive a refresh.
function loadAlbums() {
  try {
    return JSON.parse(localStorage.getItem("albums")) || defaultAlbums;
  } catch {
    return defaultAlbums;
  }
}
function saveAlbums() {
  try {
    localStorage.setItem("albums", JSON.stringify(albums));
  } catch {
    /* storage can be blocked (private mode); the app still works without it */
  }
}

// Small helpers to save things in the browser
function loadJSON(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}
function saveJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage blocked: the app still works, it just won't remember */
  }
}

const favorites = new Set(loadJSON("favorites", []));   // ids of starred photos
const trashed   = new Set(loadJSON("trashed", []));     // ids of photos in the bin
const edits     = loadJSON("edits", {});                // { photoId: { filter, brightness... } }

// Every screen keeps using `photos`, so the bin works everywhere automatically.
let photos = allPhotos.filter((p) => !trashed.has(p.id));
function refreshPhotos() {
  photos = allPhotos.filter((p) => !trashed.has(p.id));
}

/* ============ 2. STATE ============ */
let albums = loadAlbums();
let visiblePhotos = [];   // photos currently on screen, in screen order (lightbox uses this)
let lastTab = "gallery";  // which tab to return to from a month/album

/* ============ 3. HELPERS ============ */
const $ = (id) => document.getElementById(id);
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

// Anything the USER types must be escaped before going into innerHTML.
// Otherwise an album named <script>... could run code on the page.
function escapeHTML(text) {
  return text.replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}

const monthFormat   = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" });
const dayFormat     = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric" });
const dayYearFormat = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric" });
const fullFormat    = new Intl.DateTimeFormat("en-US", { dateStyle: "long", timeStyle: "short" });

const timeFormat = new Intl.DateTimeFormat("en-US", { weekday: "short", hour: "numeric", minute: "2-digit" });

// Image presets (empty string = no filter)
const imagePresets = {
  Original: "",
  "B&W": "grayscale(1)",
  Sepia: "sepia(0.85)",
  Warm: "sepia(0.35) saturate(1.4) hue-rotate(-10deg)",
  Cool: "saturate(1.2) hue-rotate(15deg) brightness(1.05)",
  Vivid: "saturate(1.8) contrast(1.1)",
};

const defaultEdit = () => ({ filter: "Original", brightness: 100, contrast: 100, saturate: 100 });

// Combine the preset and the sliders into ONE css filter string
function buildFilter(edit) {
  return `${imagePresets[edit.filter]} brightness(${edit.brightness}%) contrast(${edit.contrast}%) saturate(${edit.saturate}%)`;
}
const filterFor = (id) => (edits[id] ? buildFilter(edits[id]) : "none");


function sortNewestFirst(list) {
  return [...list].sort((a, b) => new Date(b.takenAt) - new Date(a.takenAt));
}

function groupByMonth(sortedList) {
  const months = new Map();
  for (const photo of sortedList) {
    const key = photo.takenAt.slice(0, 7); // "2026-10"
    if (!months.has(key)) {
      months.set(key, { label: monthFormat.format(new Date(photo.takenAt)), photos: [] });
    }
    months.get(key).photos.push(photo);
  }
  return months;
}

function groupByDay(sortedList, formatter) {
  const days = new Map();
  for (const photo of sortedList) {
    const key = photo.takenAt.slice(0, 10); // "2026-10-12"
    if (!days.has(key)) {
      days.set(key, { label: formatter.format(new Date(photo.takenAt)), photos: [] });
    }
    days.get(key).photos.push(photo);
  }
  return days;
}

function photosOfAlbum(album) {
  return sortNewestFirst(photos.filter((p) => album.photoIds.includes(p.id)));
}

/* ============ 4. HTML TEMPLATES ============ */
const photoTile = (p) => `
  <figure class="photo" data-id="${p.id}">
    <img src="${p.src}" alt="${escapeHTML(p.title)}" loading="lazy" style="filter:${filterFor(p.id)}" />
    <figcaption>${escapeHTML(p.title)}</figcaption>
  </figure>`;

// One card template used by BOTH months and albums
function cardHTML({ attr, cover, title, count }) {
  const coverHTML = cover
    ? `<img src="${cover.src}" alt="" loading="lazy" />`
    : `<div class="empty-cover"></div>`;
  return `
    <article class="album-card" ${attr}>
      ${coverHTML}
      <h3>${escapeHTML(title)}</h3>
      <p>${plural(count, "photo")}</p>
    </article>`;
}

/* ============ 5. RENDER THE SCREENS ============ */
let activeCategory = "All";
const categories = ["All", "Favorites", ...new Set(allPhotos.map((p) => p.category))];

function getGalleryPhotos() {
  const sorted = sortNewestFirst(photos);
  if (activeCategory === "All") return sorted;
  if (activeCategory === "Favorites") return sorted.filter((p) => favorites.has(p.id));
  return sorted.filter((p) => p.category === activeCategory);
}

function renderChips() {
  $("chips").innerHTML = categories
    .map((cat) => `
      <button class="chip ${cat === activeCategory ? "active" : ""}" data-cat="${cat}">
        ${cat}
      </button>`)
    .join("");
}

function renderGallery() {
  visiblePhotos = getGalleryPhotos();
  $("gallery-grid").innerHTML = visiblePhotos.length
    ? visiblePhotos.map(photoTile).join("")
    : `<p class="empty-text">Nothing here yet.</p>`;
  renderChips();
}

$("chips").addEventListener("click", (event) => {
  const chip = event.target.closest(".chip");
  if (!chip) return;
  activeCategory = chip.dataset.cat;
  renderGallery();
});

function renderMonths() {
  const months = groupByMonth(sortNewestFirst(photos));
  // [...months] turns the Map into an array of [key, value] pairs
  $("months-grid").innerHTML = [...months]
    .map(([key, month]) =>
      cardHTML({
        attr: `data-month="${key}"`,
        cover: month.photos[0],        // newest photo of that month
        title: month.label,
        count: month.photos.length,
      })
    )
    .join("");
}

function renderAlbums() {
  const addCard = `
    <button class="album-card album-add" id="add-album">
      <span class="plus">+</span>
      <span>New album</span>
    </button>`;

  const cards = albums
    .map((album) => {
      const list = photosOfAlbum(album);
      return cardHTML({ attr: `data-album="${album.id}"`, cover: list[0], title: album.name, count: list.length });
    })
    .join("");

  $("albums-grid").innerHTML = addCard + cards;
}

// Opens ANY collection (a month or an album) in the detail view
function openCollection(title, list, formatter) {
  visiblePhotos = list; // list is already sorted newest-first
  $("detail-title").textContent = title;
  $("detail-sub").textContent = plural(list.length, "photo");

  if (list.length === 0) {
    $("detail-content").innerHTML = `<p class="empty-text">No photos in this album yet.</p>`;
  } else {
    const days = groupByDay(list, formatter);
    $("detail-content").innerHTML = [...days.values()]
      .map((day) => `
        <div class="day-group">
          <h3 class="day-title">${day.label}</h3>
          <div class="photo-grid">${day.photos.map(photoTile).join("")}</div>
        </div>`)
      .join("");
  }
  showView("detail");
}

/* ============ 6. SWITCHING SCREENS ============ */
const tabs = document.querySelectorAll(".tab");

function showView(name) {
  if (name !== "detail") lastTab = name; // remember where "Back" should go

  document.querySelectorAll(".view").forEach((v) => (v.hidden = v.id !== `${name}-view`));
  tabs.forEach((t) => t.classList.toggle("active", t.dataset.view === lastTab));
  $("hero").hidden = name === "detail";

  if (name === "gallery") visiblePhotos = getGalleryPhotos();
  window.scrollTo({ top: 0 });
} 

tabs.forEach((tab) => tab.addEventListener("click", () => showView(tab.dataset.view)));
$("back-btn").addEventListener("click", () => showView(lastTab));

/* ============ 7. CLICKS ON THE PAGE (event delegation) ============ */
document.querySelector("main").addEventListener("click", (event) => {
  // A photo tile -> lightbox
  const tile = event.target.closest(".photo");
  if (tile) {
    openLightbox(visiblePhotos.findIndex((p) => p.id === tile.dataset.id));
    return;
  }

  // A month card -> open that month
  const monthCard = event.target.closest("[data-month]");
  if (monthCard) {
    const key = monthCard.dataset.month;
    const list = sortNewestFirst(photos).filter((p) => p.takenAt.startsWith(key));
    openCollection(monthCard.querySelector("h3").textContent, list, dayFormat);
    return;
  }

  // An album card -> open that album
  const albumCard = event.target.closest("[data-album]");
  if (albumCard) {
    const album = albums.find((a) => a.id === albumCard.dataset.album);
    openCollection(album.name, photosOfAlbum(album), dayYearFormat);
    return;
  }

  // The "+" card -> create album
  if (event.target.closest("#add-album")) openModal();
});

/* ============ 8. LIGHTBOX ============ */
const lightbox = $("lightbox");
const lbImage = lightbox.querySelector(".lb-image");
const editPanel = $("lb-edit");
const sheet = $("sheet");
let currentIndex = 0;
let draft = null;   // the edit in progress (null = not editing)

const currentPhoto = () => visiblePhotos[currentIndex];

function showPhoto(index) {
  currentIndex = (index + visiblePhotos.length) % visiblePhotos.length; // wraps around
  const photo = currentPhoto();
  const date = new Date(photo.takenAt);

  lbImage.src = photo.src;
  lbImage.alt = photo.title;
  lbImage.style.filter = filterFor(photo.id);
  $("lb-title").textContent = photo.title;
  $("lb-date").textContent = dayYearFormat.format(date);
  $("lb-time").textContent = timeFormat.format(date);
  updateFavButton();
}

function openLightbox(index) {
  showPhoto(index);
  lightbox.hidden = false;
  document.body.style.overflow = "hidden";
}

function closeLightbox() {
  lightbox.hidden = true;
  document.body.style.overflow = "";
  closeSheet();
  if (draft) closeEdit();
  // If we're viewing the Favorites chip and un-starred something, refresh the grid
  if (activeCategory === "Favorites" && !$("gallery-view").hidden) renderGallery();
}

/* --- navigation --- */
lightbox.querySelector(".lb-next").addEventListener("click", () => { if (!draft) showPhoto(currentIndex + 1); });
lightbox.querySelector(".lb-prev").addEventListener("click", () => { if (!draft) showPhoto(currentIndex - 1); });
$("lb-close").addEventListener("click", closeLightbox);

// Clicking the empty dark area closes it
lightbox.addEventListener("click", (event) => {
  const emptySpace = event.target === lightbox || event.target.classList.contains("lb-stage");
  if (emptySpace && !draft) closeLightbox();
});

/* --- date button: jump back to the photo's place in the gallery --- */
$("lb-when").addEventListener("click", () => {
  const id = currentPhoto().id;
  closeLightbox();
  // Only look inside the screen that is currently visible
  const tile = document.querySelector(`.view:not([hidden]) .photo[data-id="${id}"]`);
  if (!tile) return;
  tile.scrollIntoView({ behavior: "smooth", block: "center" });
  tile.classList.add("flash");
  setTimeout(() => tile.classList.remove("flash"), 1500);
});

/* --- favourite star --- */
function updateFavButton() {
  const isFav = favorites.has(currentPhoto().id);
  const btn = $("lb-fav");
  btn.innerHTML = isFav ? "&#9733;" : "&#9734;";   // filled star / empty star
  btn.classList.toggle("on", isFav);
}

$("lb-fav").addEventListener("click", () => {
  const id = currentPhoto().id;
  favorites.has(id) ? favorites.delete(id) : favorites.add(id);
  saveJSON("favorites", [...favorites]);
  updateFavButton();
});

/* --- bottom sheet (shared by Share / Add to album / Details) --- */
function openSheet(title, html) {
  $("sheet-title").textContent = title;
  $("sheet-body").innerHTML = html;
  sheet.hidden = false;
}
function closeSheet() {
  sheet.hidden = true;
}
sheet.addEventListener("click", (event) => {
  if (event.target === sheet) closeSheet();
});

/* --- toast message --- */
let toastTimer;
function showToast(message, actionLabel, onAction) {
  const el = $("toast");
  el.innerHTML = `<span>${escapeHTML(message)}</span>`;
  if (actionLabel) {
    const button = document.createElement("button");
    button.textContent = actionLabel;
    button.addEventListener("click", () => {
      onAction();
      el.hidden = true;
    });
    el.appendChild(button);
  }
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.hidden = true), 5000);
}

/* --- ☰ details --- */
$("lb-more").addEventListener("click", () => {
  const p = currentPhoto();
  openSheet("Details", `
    <dl class="details">
      <dt>Title</dt><dd>${escapeHTML(p.title)}</dd>
      <dt>Taken</dt><dd>${fullFormat.format(new Date(p.takenAt))}</dd>
      <dt>Category</dt><dd>${p.category}</dd>
      <dt>Image</dt><dd><a href="${p.src}" target="_blank" rel="noopener">Open original</a></dd>
    </dl>`);
});

/* --- bottom bar buttons (event delegation again) --- */
$("lb-bottom").addEventListener("click", (event) => {
  const btn = event.target.closest("[data-action]");
  if (!btn) return;
  const actions = { share: openShare, edit: openEdit, album: openAlbumSheet, bin: trashCurrent };
  actions[btn.dataset.action]();
});

/* --- SHARE --- */
function openShare() {
  const photo = currentPhoto();
  const url = encodeURIComponent(photo.src);   // makes the text safe to put inside a link
  const text = encodeURIComponent(photo.title);

  // Phones/some browsers have a built-in share menu; offer it as "More"
  const nativeButton = navigator.share
    ? `<button class="share-item" data-native><span>📲</span>More…</button>`
    : "";

  openSheet("Share to", `
    <div class="share-grid">
      <a class="share-item" href="https://wa.me/?text=${text}%20${url}" target="_blank" rel="noopener"><span>💬</span>WhatsApp</a>
      <a class="share-item" href="https://t.me/share/url?url=${url}&text=${text}" target="_blank" rel="noopener"><span>✈️</span>Telegram</a>
      <a class="share-item" href="https://twitter.com/intent/tweet?text=${text}&url=${url}" target="_blank" rel="noopener"><span>🐦</span>X</a>
      <a class="share-item" href="mailto:?subject=${text}&body=${url}"><span>✉️</span>Email</a>
      <button class="share-item" data-copy><span>🔗</span>Copy link</button>
      ${nativeButton}
    </div>`);
}

/* --- ADD TO ALBUM --- */
function openAlbumSheet() {
  const id = currentPhoto().id;
  const rows = albums
    .map((a) => `
      <button class="sheet-row" data-album-id="${a.id}">
        <span>${escapeHTML(a.name)}</span>
        <span class="tick">${a.photoIds.includes(id) ? "✓" : ""}</span>
      </button>`)
    .join("");
  openSheet("Add to album", rows || `<p class="empty-text">No albums yet. Create one in the Albums tab.</p>`);
}

// One listener for everything inside the sheet
$("sheet-body").addEventListener("click", (event) => {
  const photo = currentPhoto();

  if (event.target.closest("[data-copy]")) {
    navigator.clipboard
      .writeText(photo.src)
      .then(() => showToast("Link copied"))
      .catch(() => showToast("Couldn't copy the link"));
    closeSheet();
    return;
  }

  if (event.target.closest("[data-native]")) {
    navigator.share({ title: photo.title, url: photo.src }).catch(() => {});
    return;
  }

  const row = event.target.closest("[data-album-id]");
  if (row) {
    const album = albums.find((a) => a.id === row.dataset.albumId);
    const position = album.photoIds.indexOf(photo.id);
    // Already inside? remove it. Not inside? add it.
    position === -1 ? album.photoIds.push(photo.id) : album.photoIds.splice(position, 1);
    saveAlbums();
    renderAlbums();
    row.querySelector(".tick").textContent = position === -1 ? "✓" : "";
  }
});

/* --- BIN --- */
// Re-draw every screen WITHOUT disturbing the lightbox's photo list
function refreshScreens() {
  const keep = visiblePhotos;
  refreshPhotos();
  renderGallery();
  renderMonths();
  renderAlbums();
  visiblePhotos = keep;
}

function trashCurrent() {
  const photo = currentPhoto();
  trashed.add(photo.id);
  saveJSON("trashed", [...trashed]);

  const remaining = visiblePhotos.filter((p) => p.id !== photo.id);
  refreshScreens();
  visiblePhotos = remaining;

  // Also remove the tile from an open month/album, and any day left empty
  document.querySelectorAll(`.photo[data-id="${photo.id}"]`).forEach((el) => el.remove());
  document.querySelectorAll(".day-group").forEach((g) => {
    if (!g.querySelector(".photo")) g.remove();
  });

  if (remaining.length === 0) closeLightbox();
  else showPhoto(Math.min(currentIndex, remaining.length - 1));

  showToast("Moved to bin", "Undo", () => {
    trashed.delete(photo.id);
    saveJSON("trashed", [...trashed]);
    refreshScreens();
    if (lightbox.hidden) showView(lastTab);
  });
}

/* --- EDIT --- */
function openEdit() {
  draft = { ...defaultEdit(), ...edits[currentPhoto().id] };   // copy, so Cancel changes nothing
  $("lb-bottom").hidden = true;
  editPanel.hidden = false;
  editPanel.querySelector('[data-tab="filters"]').click();
  renderEditControls();
}

function closeEdit() {
  draft = null;
  editPanel.hidden = true;
  $("lb-bottom").hidden = false;
}

function cancelEdit() {
  closeEdit();
  lbImage.style.filter = filterFor(currentPhoto().id);   // back to the saved look
}

function renderEditControls() {
  $("edit-filters").innerHTML = Object.keys(imagePresets)
    .map((name) => `<button class="lb-filter ${name === draft.filter ? "active" : ""}" data-filter="${name}">${name}</button>`)
    .join("");
  editPanel.querySelectorAll("[data-adjust]").forEach((input) => (input.value = draft[input.dataset.adjust]));
}

const previewDraft = () => (lbImage.style.filter = buildFilter(draft));

$("edit-filters").addEventListener("click", (event) => {
  const btn = event.target.closest("[data-filter]");
  if (!btn) return;
  draft.filter = btn.dataset.filter;
  renderEditControls();
  previewDraft();
});

// "input" fires continuously while dragging a slider, so the preview is live
editPanel.querySelectorAll("[data-adjust]").forEach((slider) =>
  slider.addEventListener("input", () => {
    draft[slider.dataset.adjust] = Number(slider.value);
    previewDraft();
  })
);

editPanel.querySelectorAll(".edit-tab").forEach((tab) =>
  tab.addEventListener("click", () => {
    editPanel.querySelectorAll(".edit-tab").forEach((t) => t.classList.toggle("active", t === tab));
    $("edit-filters").hidden = tab.dataset.tab !== "filters";
    $("edit-adjust").hidden = tab.dataset.tab !== "adjust";
  })
);

$("edit-reset").addEventListener("click", () => {
  draft = defaultEdit();
  renderEditControls();
  previewDraft();
});
$("edit-cancel").addEventListener("click", cancelEdit);

$("edit-save").addEventListener("click", () => {
  const id = currentPhoto().id;
  const unchanged = JSON.stringify(draft) === JSON.stringify(defaultEdit());
  unchanged ? delete edits[id] : (edits[id] = draft);
  saveJSON("edits", edits);

  // Update the thumbnails everywhere on the page
  document.querySelectorAll(`.photo[data-id="${id}"] img`).forEach((img) => (img.style.filter = filterFor(id)));
  closeEdit();
  lbImage.style.filter = filterFor(id);
  showToast("Edit saved");
});

/* ============ 9. CREATE ALBUM MODAL ============ */
const modal = $("album-modal");
const picker = $("picker");
const nameInput = $("album-name");
const selected = new Set(); // a Set stores unique values: perfect for "which photos are picked"

function openModal() {
  selected.clear();
  nameInput.value = "";
  picker.innerHTML = sortNewestFirst(photos)
    .map((p) => `<div class="pick" data-id="${p.id}"><img src="${p.src}" alt="${escapeHTML(p.title)}" /></div>`)
    .join("");
  modal.hidden = false;
  nameInput.focus();
}

function closeModal() {
  modal.hidden = true;
}

picker.addEventListener("click", (event) => {
  const pick = event.target.closest(".pick");
  if (!pick) return;
  const id = pick.dataset.id;
  selected.has(id) ? selected.delete(id) : selected.add(id);
  pick.classList.toggle("selected", selected.has(id));
});

$("modal-cancel").addEventListener("click", closeModal);
modal.addEventListener("click", (event) => {
  if (event.target === modal) closeModal();
});

$("modal-save").addEventListener("click", () => {
  const name = nameInput.value.trim();
  if (!name) {
    nameInput.focus();
    return;
  }
  albums.push({ id: `a${Date.now()}`, name, photoIds: [...selected] });
  saveAlbums();
  renderAlbums();
  closeModal();
});

/* ============ 10. KEYBOARD ============ */
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    if (!sheet.hidden) return closeSheet();         // 1st: close the sheet
    if (draft) return cancelEdit();                 // 2nd: cancel editing
    if (!lightbox.hidden) return closeLightbox();   // 3rd: close the viewer
    return closeModal();
  }
  if (lightbox.hidden || draft || !sheet.hidden) return;
  if (event.key === "ArrowRight") showPhoto(currentIndex + 1);
  if (event.key === "ArrowLeft") showPhoto(currentIndex - 1);
});

/* ============ 11. START ============ */
renderGallery();
renderMonths();
renderAlbums();
showView("gallery");