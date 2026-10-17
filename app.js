/* ============ 1. DATA ============ */

const img = (id) => `https://picsum.photos/id/${id}/900/700`;

const photos = [
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
    <img src="${p.src}" alt="${escapeHTML(p.title)}" loading="lazy" />
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

// Set removes duplicates; "..." spreads it back into an array
const categories = ["All", ...new Set(photos.map((p) => p.category))];

function getGalleryPhotos() {
  const sorted = sortNewestFirst(photos);
  return activeCategory === "All"
    ? sorted
    : sorted.filter((p) => p.category === activeCategory);
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
  visiblePhotos = getGalleryPhotos(); // lightbox next/prev now follows the filter too
  $("gallery-grid").innerHTML = visiblePhotos.map(photoTile).join("");
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
let currentIndex = 0;

// Each filter is just a CSS filter string
const imageFilters = {
  Original: "none",
  "B&W": "grayscale(1)",
  Sepia: "sepia(0.85)",
  Warm: "sepia(0.35) saturate(1.4) hue-rotate(-10deg)",
  Cool: "saturate(1.2) hue-rotate(15deg) brightness(1.05)",
  Vivid: "saturate(1.8) contrast(1.1)",
};

const filterBar = $("lb-filters");
filterBar.innerHTML = Object.keys(imageFilters)
  .map((name) => `<button class="lb-filter" data-filter="${name}">${name}</button>`)
  .join("");

function applyImageFilter(name) {
  lbImage.style.filter = imageFilters[name];
  filterBar.querySelectorAll(".lb-filter").forEach((btn) =>
    btn.classList.toggle("active", btn.dataset.filter === name)
  );
}

filterBar.addEventListener("click", (event) => {
  const btn = event.target.closest(".lb-filter");
  if (btn) applyImageFilter(btn.dataset.filter);
});


function showPhoto(index) {
  currentIndex = (index + visiblePhotos.length) % visiblePhotos.length; // wraps around
  const photo = visiblePhotos[currentIndex];
  lbImage.src = photo.src;
  lbImage.alt = photo.title;
  $("lb-title").textContent = photo.title;
  $("lb-date").textContent = `${fullFormat.format(new Date(photo.takenAt))} · ${photo.category}`;
  $("lb-date").textContent = `${fullFormat.format(new Date(photo.takenAt))} · ${photo.category}`;
  applyImageFilter("Original");   // ← add this
}


function openLightbox(index) {
  showPhoto(index);
  lightbox.hidden = false;
  document.body.style.overflow = "hidden";
}

function closeLightbox() {
  lightbox.hidden = true;
  document.body.style.overflow = "";
}

lightbox.querySelector(".lb-next").addEventListener("click", () => showPhoto(currentIndex + 1));
lightbox.querySelector(".lb-prev").addEventListener("click", () => showPhoto(currentIndex - 1));
lightbox.querySelector(".lb-close").addEventListener("click", closeLightbox);
lightbox.addEventListener("click", (event) => {
  if (event.target === lightbox) closeLightbox();
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
    closeLightbox();
    closeModal();
  }
  if (lightbox.hidden) return;
  if (event.key === "ArrowRight") showPhoto(currentIndex + 1);
  if (event.key === "ArrowLeft") showPhoto(currentIndex - 1);
});

/* ============ 11. START ============ */
renderGallery();
renderMonths();
renderAlbums();
showView("gallery");