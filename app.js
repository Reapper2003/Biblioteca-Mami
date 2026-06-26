// === Ana's collection — logica aplicației ===

const statusEl = document.getElementById("status");
const pageNav = document.getElementById("page-nav");

// colecție
const listEl = document.getElementById("book-list");
const countEl = document.getElementById("count");
const searchEl = document.getElementById("search");
const filterStatusEl = document.getElementById("filter-status");
const filterRatingEl = document.getElementById("filter-rating");
const sortByEl = document.getElementById("sort-by");
const addForm = document.getElementById("add-form");
const titleEl = document.getElementById("title");
const authorEl = document.getElementById("author");
const coverEl = document.getElementById("cover");
const coverPreviewEl = document.getElementById("cover-preview");
const addStatusEl = document.getElementById("add-status");
const viewListBtn = document.getElementById("view-list");
const viewShelfBtn = document.getElementById("view-shelf");

// dorințe
const wishForm = document.getElementById("wishlist-form");
const wTitleEl = document.getElementById("w-title");
const wAuthorEl = document.getElementById("w-author");
const wCoverEl = document.getElementById("w-cover");
const wCoverPreviewEl = document.getElementById("w-cover-preview");
const wishListEl = document.getElementById("wishlist-list");
const wishCountEl = document.getElementById("wishlist-count");

// împrumutate / statistici / duplicate
const loanedListEl = document.getElementById("loaned-list");
const loanedCountEl = document.getElementById("loaned-count");
const statsContentEl = document.getElementById("stats-content");
const dupListEl = document.getElementById("duplicates-list");
const dupCountEl = document.getElementById("dup-count");
const storageContentEl = document.getElementById("storage-content");
const storageRefreshBtn = document.getElementById("storage-refresh");

// panou detaliu
const detailModal = document.getElementById("detail-modal");
const dmCover = document.getElementById("dm-cover");
const dmTitle = document.getElementById("dm-title");
const dmAuthor = document.getElementById("dm-author");
const dmStatus = document.getElementById("dm-status");
const dmStars = document.getElementById("dm-stars");
const dmState = document.getElementById("dm-state");
const dmWho = document.getElementById("dm-who");

const BUCKET = "covers";
const STATUSES = { de_citit: "📋 De citit", in_curs: "📖 În curs", citita: "✅ Citită" };

const SHELF_COLORS = [
  ["#7d3f4d", "#f6dfe4"], ["#3f5a7d", "#dceaf6"], ["#3f7d63", "#dcf6e9"],
  ["#5a4f7d", "#e7e2f6"], ["#7d6a3f", "#f6ecda"], ["#7d5a3f", "#f6e6da"],
  ["#5a7d3f", "#e8f6da"], ["#7d3f3f", "#f6dada"],
];
function pickColor(text) {
  let h = 0;
  for (let i = 0; i < (text || "").length; i++) h = (h + text.charCodeAt(i)) % 9973;
  return SHELF_COLORS[h % SHELF_COLORS.length];
}

let books = [];
let db = null;
let editingId = null;
let detailBook = null;
let view = localStorage.getItem("view") || "list";
let storageCache = null;
let storageLoading = false;

// ---------- Configurare ----------
function configOK() {
  return (
    typeof CONFIG !== "undefined" &&
    CONFIG.SUPABASE_URL && !CONFIG.SUPABASE_URL.includes("PUNE_AICI") &&
    CONFIG.SUPABASE_ANON_KEY && !CONFIG.SUPABASE_ANON_KEY.includes("PUNE_AICI")
  );
}
function showStatus(msg, isError = false) {
  statusEl.textContent = msg;
  statusEl.classList.toggle("error", isError);
}

if (!configOK()) {
  showStatus("⚠️ Site-ul nu este configurat. Completează config.js cu datele de la Supabase.", true);
} else {
  db = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
  loadBooks();
}

async function loadBooks() {
  showStatus("Se încarcă...");
  const { data, error } = await db.from("books").select("*").order("title", { ascending: true });
  if (error) { showStatus("Eroare la încărcare: " + error.message, true); return; }
  books = data || [];
  showStatus("");
  renderAll();
}

const collectionBooks = () => books.filter((b) => !b.wishlist);
const wishlistBooks = () => books.filter((b) => b.wishlist);
const loanedBooks = () => collectionBooks().filter((b) => b.loaned_to);

// ============================================================
//  POZE
// ============================================================
function compressImage(file, maxDim = 1200, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > height && width > maxDim) { height = Math.round((height * maxDim) / width); width = maxDim; }
      else if (height >= width && height > maxDim) { width = Math.round((width * maxDim) / height); height = maxDim; }
      const canvas = document.createElement("canvas");
      canvas.width = width; canvas.height = height;
      canvas.getContext("2d").drawImage(img, 0, 0, width, height);
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Nu am putut procesa poza"))), "image/jpeg", quality);
    };
    img.onerror = () => reject(new Error("Fișierul nu este o imagine validă"));
    img.src = URL.createObjectURL(file);
  });
}
async function uploadCover(file) {
  const blob = await compressImage(file);
  const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
  const { error } = await db.storage.from(BUCKET).upload(path, blob, { contentType: "image/jpeg" });
  if (error) throw error;
  return db.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

// ============================================================
//  ACTUALIZARE
// ============================================================
async function updateBook(book, patch) {
  const { data, error } = await db.from("books").update(patch).eq("id", book.id).select();
  if (error) { showStatus("Eroare: " + error.message, true); return false; }
  const idx = books.findIndex((b) => b.id === book.id);
  if (idx !== -1 && data && data[0]) books[idx] = data[0];
  return true;
}

// ============================================================
//  ELEMENTE REUTILIZABILE
// ============================================================
function buildCover(book) {
  const wrap = document.createElement("div");
  wrap.className = "cover";
  if (book.cover_url) {
    const img = document.createElement("img");
    img.src = book.cover_url; img.alt = book.title || "copertă"; img.loading = "lazy";
    wrap.appendChild(img);
  } else {
    wrap.classList.add("cover-empty");
    wrap.textContent = "📖";
  }
  return wrap;
}

function buildStateBadge(book) {
  let cls, txt;
  if (book.loaned_to) { cls = "badge-loaned"; txt = "📕 La " + book.loaned_to; }
  else if (book.disposition === "donated") { cls = "badge-donated"; txt = "🎁 Donată"; }
  else if (book.disposition === "sold") { cls = "badge-sold"; txt = "💰 Vândută"; }
  else return null;
  const b = document.createElement("span");
  b.className = "state-badge " + cls;
  b.textContent = txt;
  return b;
}

function buildStatusDisplay(book) {
  if (!book.status) return null;
  const s = document.createElement("span");
  s.className = "status-pill status-" + book.status;
  s.textContent = STATUSES[book.status] || "";
  return s;
}
function buildStarsDisplay(book) {
  if (!book.rating) return null;
  const w = document.createElement("div");
  w.className = "stars-ro";
  for (let i = 1; i <= 5; i++) {
    const s = document.createElement("span");
    s.className = "star" + (book.rating >= i ? " on" : "");
    s.textContent = "★";
    w.appendChild(s);
  }
  return w;
}
function buildMeta(book) {
  const st = buildStatusDisplay(book);
  const stars = buildStarsDisplay(book);
  if (!st && !stars) return null;
  const meta = document.createElement("div");
  meta.className = "book-meta";
  if (st) meta.appendChild(st);
  if (stars) meta.appendChild(stars);
  return meta;
}

function buildActions(book) {
  const actions = document.createElement("div");
  actions.className = "actions";
  const edit = document.createElement("button");
  edit.className = "btn-edit"; edit.title = "Modifică titlu / autor / poză"; edit.textContent = "✏️";
  edit.addEventListener("click", (e) => { e.stopPropagation(); editingId = book.id; renderAll(); });
  const del = document.createElement("button");
  del.className = "btn-delete"; del.title = "Șterge"; del.textContent = "🗑️";
  del.addEventListener("click", (e) => { e.stopPropagation(); deleteBook(book); });
  actions.appendChild(edit);
  actions.appendChild(del);
  return actions;
}

// ============================================================
//  PANOU DE DETALIU
// ============================================================
function setPillGroup(container, v) {
  Array.prototype.forEach.call(container.children, (p) => p.classList.toggle("on", p.dataset.v === v));
}
function setDmStars(n) {
  Array.prototype.forEach.call(dmStars.children, (s) => s.classList.toggle("on", parseInt(s.dataset.i, 10) <= n));
}
function openDetail(book) {
  detailBook = book;
  dmCover.innerHTML = "";
  dmCover.appendChild(buildCover(book));
  dmTitle.textContent = book.title;
  dmAuthor.textContent = book.author || "";
  setPillGroup(dmStatus, book.status || "");
  setDmStars(book.rating || 0);
  const state = book.loaned_to ? "loaned" : (book.disposition || "home");
  setPillGroup(dmState, state);
  dmWho.hidden = state !== "loaned";
  dmWho.value = book.loaned_to || "";
  detailModal.hidden = false;
}
function closeDetail() { detailModal.hidden = true; detailBook = null; }

async function updateDetail(patch) {
  if (!detailBook) return;
  if (await updateBook(detailBook, patch)) {
    detailBook = books.find((b) => b.id === detailBook.id) || detailBook;
    renderAll();
  }
}

dmStatus.addEventListener("click", async (e) => {
  const p = e.target.closest(".pill"); if (!p || !detailBook) return;
  const v = p.classList.contains("on") ? null : p.dataset.v;
  await updateDetail({ status: v });
  setPillGroup(dmStatus, v || "");
});
dmStars.addEventListener("click", async (e) => {
  const s = e.target.closest(".dm-star"); if (!s || !detailBook) return;
  const i = parseInt(s.dataset.i, 10);
  const v = detailBook.rating === i ? null : i;
  await updateDetail({ rating: v });
  setDmStars(v || 0);
});
dmState.addEventListener("click", async (e) => {
  const p = e.target.closest(".pill"); if (!p || !detailBook) return;
  const v = p.dataset.v;
  let patch;
  if (v === "home") patch = { loaned_to: null, disposition: null };
  else if (v === "loaned") patch = { disposition: null };
  else if (v === "donated") patch = { disposition: "donated", loaned_to: null };
  else patch = { disposition: "sold", loaned_to: null };
  await updateDetail(patch);
  setPillGroup(dmState, v);
  dmWho.hidden = v !== "loaned";
  if (v === "loaned") { dmWho.value = detailBook.loaned_to || ""; dmWho.focus(); }
});
dmWho.addEventListener("change", async () => {
  await updateDetail({ loaned_to: dmWho.value.trim() || null });
});
document.getElementById("dm-close").addEventListener("click", closeDetail);
document.getElementById("dm-x").addEventListener("click", closeDetail);
detailModal.addEventListener("click", (e) => { if (e.target === detailModal) closeDetail(); });

// ============================================================
//  RENDER
// ============================================================
function renderAll() {
  renderCollection();
  renderWishlist();
  renderLoaned();
  renderStats();
  renderDuplicates();
}
function emptyRow(container, text) {
  const li = document.createElement("li");
  li.className = "empty";
  li.textContent = text;
  container.appendChild(li);
}

// ---------- COLECȚIE ----------
function setView(v) {
  view = v;
  localStorage.setItem("view", v);
  viewListBtn.classList.toggle("active", view === "list");
  viewShelfBtn.classList.toggle("active", view === "shelf");
  renderCollection();
}
viewListBtn.addEventListener("click", () => setView("list"));
viewShelfBtn.addEventListener("click", () => setView("shelf"));
viewListBtn.classList.toggle("active", view === "list");
viewShelfBtn.classList.toggle("active", view === "shelf");

function renderCollection() {
  let arr = collectionBooks();
  const q = searchEl.value.trim().toLowerCase();
  if (q) arr = arr.filter((b) => (b.title || "").toLowerCase().includes(q) || (b.author || "").toLowerCase().includes(q));
  const fs = filterStatusEl.value;
  if (fs) arr = arr.filter((b) => b.status === fs);
  const fr = parseInt(filterRatingEl.value, 10);
  if (fr) arr = arr.filter((b) => (b.rating || 0) >= fr);

  arr = arr.slice();
  const sort = sortByEl.value;
  if (sort === "author") arr.sort((a, b) => (a.author || "").localeCompare(b.author || "", "ro"));
  else if (sort === "rating") arr.sort((a, b) => (b.rating || 0) - (a.rating || 0));
  else if (sort === "recent") arr.sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
  else arr.sort((a, b) => (a.title || "").localeCompare(b.title || "", "ro"));

  countEl.textContent = arr.length;
  listEl.className = view === "shelf" ? "shelf-view" : "";
  listEl.innerHTML = "";
  if (arr.length === 0) {
    emptyRow(listEl, q || fs || fr ? "Nicio carte pentru aceste filtre." : "Încă nu ai nicio carte. Adaugă prima carte mai sus! 📖");
    return;
  }
  for (const book of arr) {
    if (book.id === editingId) listEl.appendChild(buildEditRow(book));
    else if (view === "shelf") listEl.appendChild(buildShelfCard(book));
    else listEl.appendChild(buildRow(book));
  }
}

function buildRow(book) {
  const li = document.createElement("li");
  const cover = buildCover(book);
  cover.classList.add("clickable");
  cover.addEventListener("click", () => openDetail(book));
  li.appendChild(cover);

  const info = document.createElement("div");
  info.className = "book-info clickable";
  info.addEventListener("click", () => openDetail(book));
  const title = document.createElement("div");
  title.className = "book-title"; title.textContent = book.title;
  info.appendChild(title);
  if (book.author) {
    const a = document.createElement("div"); a.className = "book-author"; a.textContent = book.author; info.appendChild(a);
  }
  const badge = buildStateBadge(book);
  if (badge) info.appendChild(badge);
  const meta = buildMeta(book);
  if (meta) info.appendChild(meta);
  li.appendChild(info);

  li.appendChild(buildActions(book));
  return li;
}

function buildShelfCard(book) {
  const li = document.createElement("li");
  li.className = "shelf-card";

  const cover = document.createElement("div");
  cover.className = "shelf-cover clickable";
  if (book.cover_url) {
    const img = document.createElement("img");
    img.src = book.cover_url; img.alt = book.title || ""; img.loading = "lazy";
    cover.appendChild(img);
  } else {
    const [bg, fg] = pickColor(book.title);
    cover.classList.add("shelf-cover-text");
    cover.style.background = bg; cover.style.color = fg;
    const t = document.createElement("span");
    t.className = "shelf-cover-title"; t.textContent = book.title;
    cover.appendChild(t);
  }
  // ștampile / insignă peste copertă
  if (book.disposition === "sold") cover.appendChild(makeStamp("VÂNDUT", "stamp-sold"));
  else if (book.disposition === "donated") cover.appendChild(makeStamp("DONAT", "stamp-don"));
  if (book.loaned_to) {
    const lb = document.createElement("span");
    lb.className = "shelf-lbadge"; lb.textContent = "📕 " + book.loaned_to;
    cover.appendChild(lb);
  }
  cover.addEventListener("click", () => openDetail(book));
  li.appendChild(cover);

  const title = document.createElement("div");
  title.className = "shelf-title"; title.textContent = book.title;
  li.appendChild(title);
  if (book.author) {
    const a = document.createElement("div"); a.className = "shelf-author"; a.textContent = book.author; li.appendChild(a);
  }
  const meta = buildMeta(book);
  if (meta) { meta.classList.add("shelf-meta"); li.appendChild(meta); }
  li.appendChild(buildActions(book));
  return li;
}
function makeStamp(text, cls) {
  const s = document.createElement("span");
  s.className = "stamp " + cls;
  s.textContent = text;
  return s;
}

// ---------- Editare titlu / autor / poză ----------
function buildEditRow(book) {
  const li = document.createElement("li");
  li.className = "editing";
  const form = document.createElement("form");
  form.className = "edit-form";

  const tInput = document.createElement("input");
  tInput.type = "text"; tInput.value = book.title || ""; tInput.placeholder = "Titlul cărții"; tInput.required = true;
  const aInput = document.createElement("input");
  aInput.type = "text"; aInput.value = book.author || ""; aInput.placeholder = "Autorul (opțional)";

  const photoRow = document.createElement("div");
  photoRow.className = "edit-photo-row";
  photoRow.appendChild(buildCover(book));
  const photoLabel = document.createElement("label");
  photoLabel.className = "file-btn small";
  photoLabel.textContent = book.cover_url ? "🖼️ Schimbă poza" : "🖼️ Adaugă o poză";
  const fileInput = document.createElement("input");
  fileInput.type = "file"; fileInput.accept = "image/*"; fileInput.hidden = true;
  photoLabel.appendChild(fileInput);
  let removeCover = false;
  fileInput.addEventListener("change", () => {
    if (fileInput.files[0]) { removeCover = false; photoLabel.textContent = "✅ Poză nouă aleasă"; photoLabel.appendChild(fileInput); }
  });
  photoRow.appendChild(photoLabel);
  if (book.cover_url) {
    const rm = document.createElement("button");
    rm.type = "button"; rm.className = "link-danger"; rm.textContent = "Șterge poza";
    rm.addEventListener("click", () => { removeCover = true; fileInput.value = ""; photoLabel.textContent = "🖼️ Adaugă o poză"; photoLabel.appendChild(fileInput); rm.textContent = "Poza va fi ștearsă"; rm.disabled = true; });
    photoRow.appendChild(rm);
  }

  const actions = document.createElement("div");
  actions.className = "edit-actions";
  const save = document.createElement("button");
  save.type = "submit"; save.className = "btn-primary small"; save.textContent = "Salvează";
  const cancel = document.createElement("button");
  cancel.type = "button"; cancel.className = "btn-ghost small"; cancel.textContent = "Renunță";
  cancel.addEventListener("click", () => { editingId = null; renderAll(); });
  actions.appendChild(save); actions.appendChild(cancel);

  form.appendChild(tInput);
  form.appendChild(aInput);
  form.appendChild(photoRow);
  form.appendChild(actions);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const newTitle = tInput.value.trim();
    if (!newTitle) return;
    save.disabled = true;
    const patch = { title: newTitle, author: aInput.value.trim() || null };
    try {
      if (fileInput.files[0]) { showStatus("Se încarcă poza..."); patch.cover_url = await uploadCover(fileInput.files[0]); }
      else if (removeCover) patch.cover_url = null;
      showStatus("Se salvează...");
      if (await updateBook(book, patch)) {
        editingId = null; showStatus("✅ Modificările au fost salvate!"); renderAll();
      } else save.disabled = false;
    } catch (err) {
      save.disabled = false;
      showStatus("Nu am putut salva: " + (err.message || err), true);
    }
  });

  li.appendChild(form);
  return li;
}

// ---------- DORINȚE ----------
function renderWishlist() {
  const arr = wishlistBooks().slice().sort((a, b) => (a.title || "").localeCompare(b.title || "", "ro"));
  wishCountEl.textContent = arr.length;
  wishListEl.innerHTML = "";
  if (arr.length === 0) { emptyRow(wishListEl, "Lista de dorințe e goală. Adaugă cărți pe care vrei să le cumperi! 🌟"); return; }
  for (const book of arr) {
    if (book.id === editingId) { wishListEl.appendChild(buildEditRow(book)); continue; }
    const li = document.createElement("li");
    li.appendChild(buildCover(book));
    const info = document.createElement("div");
    info.className = "book-info";
    const t = document.createElement("div"); t.className = "book-title"; t.textContent = book.title; info.appendChild(t);
    if (book.author) { const a = document.createElement("div"); a.className = "book-author"; a.textContent = book.author; info.appendChild(a); }
    li.appendChild(info);

    const actions = document.createElement("div");
    actions.className = "actions";
    const buy = document.createElement("button");
    buy.className = "btn-buy"; buy.title = "Am cumpărat-o"; buy.textContent = "✅";
    buy.addEventListener("click", () => boughtBook(book));
    const edit = document.createElement("button");
    edit.className = "btn-edit"; edit.title = "Modifică"; edit.textContent = "✏️";
    edit.addEventListener("click", () => { editingId = book.id; renderAll(); });
    const del = document.createElement("button");
    del.className = "btn-delete"; del.title = "Șterge"; del.textContent = "🗑️";
    del.addEventListener("click", () => deleteBook(book));
    actions.appendChild(buy); actions.appendChild(edit); actions.appendChild(del);
    li.appendChild(actions);
    wishListEl.appendChild(li);
  }
}
async function boughtBook(book) {
  showStatus("Se mută în colecție...");
  if (await updateBook(book, { wishlist: false })) { showStatus("🎉 „" + book.title + "” a fost mutată în colecție!"); renderAll(); }
}

// ---------- ÎMPRUMUTATE ----------
function renderLoaned() {
  const arr = loanedBooks().slice().sort((a, b) => (a.loaned_to || "").localeCompare(b.loaned_to || "", "ro"));
  loanedCountEl.textContent = arr.length;
  loanedListEl.innerHTML = "";
  if (arr.length === 0) { emptyRow(loanedListEl, "Nicio carte împrumutată momentan. 📕"); return; }
  for (const book of arr) {
    const li = document.createElement("li");
    li.appendChild(buildCover(book));
    const info = document.createElement("div");
    info.className = "book-info";
    const t = document.createElement("div"); t.className = "book-title"; t.textContent = book.title; info.appendChild(t);
    if (book.author) { const a = document.createElement("div"); a.className = "book-author"; a.textContent = book.author; info.appendChild(a); }
    const who = document.createElement("div"); who.className = "loaned-who"; who.textContent = "📕 La " + book.loaned_to; info.appendChild(who);
    li.appendChild(info);
    const back = document.createElement("button");
    back.className = "btn-return"; back.textContent = "Returnată";
    back.addEventListener("click", async () => {
      showStatus("Se marchează returnată...");
      if (await updateBook(book, { loaned_to: null })) { showStatus("✅ „" + book.title + "” a fost returnată."); renderAll(); }
    });
    li.appendChild(back);
    loanedListEl.appendChild(li);
  }
}

// ---------- STATISTICI ----------
function statCard(label, value) {
  return `<div class="stat"><div class="stat-num">${value}</div><div class="stat-label">${label}</div></div>`;
}
function renderStats() {
  const col = collectionBooks();
  const total = col.length;
  const citite = col.filter((b) => b.status === "citita").length;
  const inCurs = col.filter((b) => b.status === "in_curs").length;
  const deCitit = col.filter((b) => b.status === "de_citit").length;
  const rated = col.filter((b) => b.rating);
  const medie = rated.length ? (rated.reduce((s, b) => s + b.rating, 0) / rated.length).toFixed(1) : "—";
  const donate = col.filter((b) => b.disposition === "donated").length;
  const vandute = col.filter((b) => b.disposition === "sold").length;

  const counts = {};
  for (const b of col) if (b.author) counts[b.author] = (counts[b.author] || 0) + 1;
  let topAuthor = "—", topN = 0;
  for (const [a, n] of Object.entries(counts)) if (n > topN) { topAuthor = a; topN = n; }

  let html = '<div class="stats-grid">';
  html += statCard("Cărți în colecție", total);
  html += statCard("Citite", citite);
  html += statCard("În curs", inCurs);
  html += statCard("De citit", deCitit);
  html += statCard("Notă medie", "★ " + medie);
  html += statCard("În dorințe", wishlistBooks().length);
  html += statCard("Împrumutate", loanedBooks().length);
  html += statCard("Donate", donate);
  html += statCard("Vândute", vandute);
  html += "</div>";
  html += `<div class="stat-author"><span class="stat-author-label">Autorul tău cu cele mai multe cărți</span>
    <span class="stat-author-name">${topAuthor}${topN ? " (" + topN + ")" : ""}</span></div>`;

  const ts = citite + inCurs + deCitit || 1;
  html += `<div class="status-bar">
    <div class="seg seg-citita" style="width:${(citite / ts) * 100}%"></div>
    <div class="seg seg-in_curs" style="width:${(inCurs / ts) * 100}%"></div>
    <div class="seg seg-de_citit" style="width:${(deCitit / ts) * 100}%"></div>
  </div>
  <div class="status-legend">
    <span><i class="dot dot-citita"></i> Citite ${citite}</span>
    <span><i class="dot dot-in_curs"></i> În curs ${inCurs}</span>
    <span><i class="dot dot-de_citit"></i> De citit ${deCitit}</span>
  </div>`;
  statsContentEl.innerHTML = html;
}

// ---------- DUPLICATE ----------
function renderDuplicates() {
  const map = {};
  for (const b of collectionBooks()) {
    const title = (b.title || "").trim().toLowerCase();
    if (!title) continue;
    const k = title + "|" + (b.author || "").trim().toLowerCase();
    (map[k] = map[k] || []).push(b);
  }
  const dups = Object.values(map).filter((a) => a.length > 1).sort((a, b) => b.length - a.length);
  dupCountEl.textContent = dups.length;
  dupListEl.innerHTML = "";
  if (dups.length === 0) { emptyRow(dupListEl, "Nicio carte duplicată. 👍"); return; }
  for (const group of dups) {
    const li = document.createElement("li");
    li.appendChild(buildCover(group[0]));
    const info = document.createElement("div");
    info.className = "book-info";
    const t = document.createElement("div"); t.className = "book-title"; t.textContent = group[0].title; info.appendChild(t);
    if (group[0].author) { const a = document.createElement("div"); a.className = "book-author"; a.textContent = group[0].author; info.appendChild(a); }
    li.appendChild(info);
    const c = document.createElement("span"); c.className = "count dup-badge"; c.textContent = "× " + group.length;
    li.appendChild(c);
    dupListEl.appendChild(li);
  }
}

// ---------- SPAȚIU FOLOSIT ----------
function fmtMB(bytes) { return (bytes / 1048576).toFixed(1); }

async function computeStorageBytes() {
  let total = 0, count = 0, offset = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await db.storage.from(BUCKET).list("", { limit: pageSize, offset });
    if (error) throw error;
    if (!data || data.length === 0) break;
    for (const f of data) {
      if (f.metadata && typeof f.metadata.size === "number") { total += f.metadata.size; count++; }
    }
    if (data.length < pageSize) break;
    offset += pageSize;
  }
  return { bytes: total, count };
}

async function renderStorageUsage(force) {
  if (!db || !storageContentEl) return;
  if (storageLoading) return;
  if (storageCache && !force) { paintStorage(storageCache); return; }
  storageLoading = true;
  storageContentEl.innerHTML = '<p class="hint">Se calculează spațiul folosit...</p>';
  try {
    storageCache = await computeStorageBytes();
    paintStorage(storageCache);
  } catch (e) {
    storageContentEl.innerHTML = '<p class="usage-note" style="color:var(--danger)">Nu am putut calcula spațiul pozelor: ' + (e.message || e) + "</p>";
  } finally { storageLoading = false; }
}

function paintStorage(s) {
  const limitBytes = 1024 * 1024 * 1024; // 1 GB
  const pct = Math.min(100, (s.bytes / limitBytes) * 100);
  let level = "ok";
  if (pct >= 90) level = "danger"; else if (pct >= 70) level = "warn";
  const col = collectionBooks().length;
  const withPhoto = books.filter((b) => b.cover_url).length;
  storageContentEl.innerHTML =
    `<div class="usage-row"><span class="usage-label">📷 Poze (coperți)</span>` +
    `<span class="usage-val">${fmtMB(s.bytes)} MB <span class="usage-max">/ 1024 MB</span></span></div>` +
    `<div class="usage-bar"><div class="usage-fill lvl-${level}" style="width:${pct.toFixed(1)}%"></div></div>` +
    `<p class="usage-note">${pct.toFixed(1)}% folosit · ${s.count} poze încărcate (${withPhoto} cărți au poză)</p>` +
    `<div class="usage-row" style="margin-top:16px"><span class="usage-label">📚 Cărți în colecție</span>` +
    `<span class="usage-val">${col}</span></div>` +
    `<p class="usage-note">Textul cărților ocupă foarte puțin. Limita de care te-ai putea apropia este cea de poze (1 GB) — la ritmul actual ai loc de mii de poze.</p>` +
    (level === "danger"
      ? '<p class="usage-warn">⚠️ Te apropii de limita de poze! Gândește-te să faci un backup sau să ștergi poze vechi.</p>'
      : level === "warn"
        ? '<p class="usage-warn">📌 Ai trecut de 70% din spațiul de poze — ține un ochi pe el.</p>'
        : "");
}

if (storageRefreshBtn) storageRefreshBtn.addEventListener("click", () => renderStorageUsage(true));

// ============================================================
//  ADĂUGARE (cu verificare duplicate)
// ============================================================
function isDuplicate(title, inWishlist) {
  const t = title.trim().toLowerCase();
  return books.some((b) => !!b.wishlist === inWishlist && (b.title || "").trim().toLowerCase() === t);
}
function previewImage(inputEl, previewEl) {
  inputEl.addEventListener("change", () => {
    previewEl.innerHTML = "";
    const file = inputEl.files[0];
    if (!file) return;
    const img = document.createElement("img");
    img.src = URL.createObjectURL(file); img.className = "preview-thumb";
    const txt = document.createElement("span"); txt.textContent = "Poză aleasă";
    previewEl.appendChild(img); previewEl.appendChild(txt);
  });
}
previewImage(coverEl, coverPreviewEl);
previewImage(wCoverEl, wCoverPreviewEl);

addForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!db) return;
  const title = titleEl.value.trim();
  if (!title) return;
  if (isDuplicate(title, false) && !confirm(`Ai deja „${title}” în colecție. O adaugi oricum?`)) return;
  const btn = addForm.querySelector('button[type="submit"]');
  btn.disabled = true;
  try {
    let cover_url = null;
    if (coverEl.files[0]) { showStatus("Se încarcă poza..."); cover_url = await uploadCover(coverEl.files[0]); }
    showStatus("Se adaugă...");
    const { data, error } = await db.from("books").insert([{
      title, author: authorEl.value.trim() || null, cover_url, status: addStatusEl.value || null, wishlist: false,
    }]).select();
    if (error) throw error;
    books.push(...data);
    addForm.reset(); coverPreviewEl.innerHTML = "";
    titleEl.focus();
    showStatus("✅ Carte adăugată în colecție!");
    renderAll();
  } catch (err) {
    showStatus("Nu am putut adăuga cartea: " + (err.message || err), true);
  } finally { btn.disabled = false; }
});

wishForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!db) return;
  const title = wTitleEl.value.trim();
  if (!title) return;
  if (isDuplicate(title, true) && !confirm(`„${title}” e deja în lista de dorințe. O adaugi oricum?`)) return;
  const btn = wishForm.querySelector('button[type="submit"]');
  btn.disabled = true;
  try {
    let cover_url = null;
    if (wCoverEl.files[0]) { showStatus("Se încarcă poza..."); cover_url = await uploadCover(wCoverEl.files[0]); }
    showStatus("Se adaugă...");
    const { data, error } = await db.from("books").insert([{
      title, author: wAuthorEl.value.trim() || null, cover_url, wishlist: true,
    }]).select();
    if (error) throw error;
    books.push(...data);
    wishForm.reset(); wCoverPreviewEl.innerHTML = "";
    wTitleEl.focus();
    showStatus("🌟 Adăugată în lista de dorințe!");
    renderAll();
  } catch (err) {
    showStatus("Nu am putut adăuga: " + (err.message || err), true);
  } finally { btn.disabled = false; }
});

async function deleteBook(book) {
  if (!db) return;
  if (!confirm(`Sigur vrei să scoți „${book.title}” din listă?`)) return;
  showStatus("Se șterge...");
  const { error } = await db.from("books").delete().eq("id", book.id);
  if (error) { showStatus("Nu am putut șterge: " + error.message, true); return; }
  books = books.filter((b) => b.id !== book.id);
  if (editingId === book.id) editingId = null;
  if (detailBook && detailBook.id === book.id) closeDetail();
  showStatus("🗑️ Carte ștearsă.");
  renderAll();
}

// ============================================================
//  NAVIGARE
// ============================================================
function showPage(name) {
  document.querySelectorAll("main > section[data-page]").forEach((s) => {
    s.hidden = s.getAttribute("data-page") !== name;
  });
  window.scrollTo({ top: 0, behavior: "smooth" });
  if (name === "stats") renderStorageUsage(false);
}
pageNav.addEventListener("change", () => showPage(pageNav.value));
showPage(pageNav.value);

searchEl.addEventListener("input", renderCollection);
filterStatusEl.addEventListener("change", renderCollection);
filterRatingEl.addEventListener("change", renderCollection);
sortByEl.addEventListener("change", renderCollection);
