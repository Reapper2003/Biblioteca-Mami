// === Ana's collection — logica aplicației ===

const statusEl = document.getElementById("status");
const pageNav = document.getElementById("page-nav");

// colecție (Cărțile mele)
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

// listă de dorințe
const wishForm = document.getElementById("wishlist-form");
const wTitleEl = document.getElementById("w-title");
const wAuthorEl = document.getElementById("w-author");
const wCoverEl = document.getElementById("w-cover");
const wCoverPreviewEl = document.getElementById("w-cover-preview");
const wishListEl = document.getElementById("wishlist-list");
const wishCountEl = document.getElementById("wishlist-count");

// împrumutate + statistici
const loanedListEl = document.getElementById("loaned-list");
const loanedCountEl = document.getElementById("loaned-count");
const statsContentEl = document.getElementById("stats-content");

const BUCKET = "covers";

const STATUSES = {
  de_citit: "📋 De citit",
  in_curs: "📖 În curs",
  citita: "✅ Citită",
};

// culori pentru cărțile fără poză (stil raft)
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
let view = localStorage.getItem("view") || "list";

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

// ---------- Selectoare de listă ----------
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
//  RATING + STATUS + ÎMPRUMUT (acțiuni rapide)
// ============================================================
async function updateBook(book, patch) {
  const { data, error } = await db.from("books").update(patch).eq("id", book.id).select();
  if (error) { showStatus("Eroare: " + error.message, true); return false; }
  const idx = books.findIndex((b) => b.id === book.id);
  if (idx !== -1 && data && data[0]) books[idx] = data[0];
  return true;
}
async function setRating(book, value) {
  const newVal = book.rating === value ? null : value;
  if (await updateBook(book, { rating: newVal })) renderAll();
}
async function setStatus(book, value) {
  if (await updateBook(book, { status: value || null })) renderAll();
}

function buildStars(book) {
  const wrap = document.createElement("div");
  wrap.className = "stars";
  for (let i = 1; i <= 5; i++) {
    const s = document.createElement("span");
    s.className = "star" + (book.rating >= i ? " on" : "");
    s.textContent = "★";
    s.title = i + " din 5";
    s.addEventListener("click", () => setRating(book, i));
    wrap.appendChild(s);
  }
  return wrap;
}
function buildStatusSelect(book) {
  const sel = document.createElement("select");
  sel.className = "status-select inline status-" + (book.status || "none");
  const o0 = document.createElement("option");
  o0.value = ""; o0.textContent = "▫️ Fără status";
  sel.appendChild(o0);
  for (const [code, label] of Object.entries(STATUSES)) {
    const o = document.createElement("option");
    o.value = code; o.textContent = label;
    sel.appendChild(o);
  }
  sel.value = book.status || "";
  sel.addEventListener("change", () => setStatus(book, sel.value));
  return sel;
}
function buildCover(url, title) {
  const wrap = document.createElement("div");
  wrap.className = "cover";
  if (url) {
    const img = document.createElement("img");
    img.src = url; img.alt = title || "copertă"; img.loading = "lazy";
    wrap.appendChild(img);
  } else {
    wrap.classList.add("cover-empty");
    wrap.textContent = "📖";
  }
  return wrap;
}
function buildLoanedBadge(book) {
  if (!book.loaned_to) return null;
  const b = document.createElement("span");
  b.className = "loaned-badge";
  b.textContent = "📕 La " + book.loaned_to;
  return b;
}

// ============================================================
//  RENDER GENERAL
// ============================================================
function renderAll() {
  renderCollection();
  renderWishlist();
  renderLoaned();
  renderStats();
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
  if (q) arr = arr.filter((b) =>
    (b.title || "").toLowerCase().includes(q) || (b.author || "").toLowerCase().includes(q)
  );

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
  li.appendChild(buildCover(book.cover_url, book.title));

  const info = document.createElement("div");
  info.className = "book-info";

  const title = document.createElement("div");
  title.className = "book-title";
  title.textContent = book.title;
  info.appendChild(title);

  if (book.author) {
    const a = document.createElement("div");
    a.className = "book-author";
    a.textContent = book.author;
    info.appendChild(a);
  }

  const badge = buildLoanedBadge(book);
  if (badge) info.appendChild(badge);

  const meta = document.createElement("div");
  meta.className = "book-meta";
  meta.appendChild(buildStatusSelect(book));
  meta.appendChild(buildStars(book));
  info.appendChild(meta);
  li.appendChild(info);

  li.appendChild(buildActions(book));
  return li;
}

function buildActions(book) {
  const actions = document.createElement("div");
  actions.className = "actions";
  const edit = document.createElement("button");
  edit.className = "btn-edit"; edit.title = "Modifică"; edit.textContent = "✏️";
  edit.addEventListener("click", () => { editingId = book.id; renderAll(); });
  const del = document.createElement("button");
  del.className = "btn-delete"; del.title = "Șterge"; del.textContent = "🗑️";
  del.addEventListener("click", () => deleteBook(book));
  actions.appendChild(edit);
  actions.appendChild(del);
  return actions;
}

function buildShelfCard(book) {
  const li = document.createElement("li");
  li.className = "shelf-card";

  const cover = document.createElement("div");
  cover.className = "shelf-cover";
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
  cover.addEventListener("click", () => { editingId = book.id; renderAll(); });
  li.appendChild(cover);

  const title = document.createElement("div");
  title.className = "shelf-title"; title.textContent = book.title;
  li.appendChild(title);

  if (book.author) {
    const a = document.createElement("div");
    a.className = "shelf-author"; a.textContent = book.author;
    li.appendChild(a);
  }
  const badge = buildLoanedBadge(book);
  if (badge) li.appendChild(badge);

  li.appendChild(buildStars(book));
  li.appendChild(buildStatusSelect(book));
  li.appendChild(buildActions(book));
  return li;
}

// ---------- Editare (titlu / autor / poză / împrumut) ----------
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
  photoRow.appendChild(buildCover(book.cover_url, book.title));
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

  // câmp de împrumut (doar pentru cărțile din colecție)
  let loanInput = null;
  if (!book.wishlist) {
    loanInput = document.createElement("input");
    loanInput.type = "text"; loanInput.value = book.loaned_to || "";
    loanInput.placeholder = "Împrumutată lui... (gol = e la tine)";
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
  if (loanInput) form.appendChild(loanInput);
  form.appendChild(actions);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const newTitle = tInput.value.trim();
    if (!newTitle) return;
    save.disabled = true;
    const patch = { title: newTitle, author: aInput.value.trim() || null };
    if (loanInput) patch.loaned_to = loanInput.value.trim() || null;
    try {
      if (fileInput.files[0]) { showStatus("Se încarcă poza..."); patch.cover_url = await uploadCover(fileInput.files[0]); }
      else if (removeCover) patch.cover_url = null;
      showStatus("Se salvează...");
      if (await updateBook(book, patch)) {
        editingId = null;
        showStatus("✅ Modificările au fost salvate!");
        renderAll();
      } else { save.disabled = false; }
    } catch (err) {
      save.disabled = false;
      showStatus("Nu am putut salva: " + (err.message || err), true);
    }
  });

  li.appendChild(form);
  return li;
}

// ---------- LISTĂ DE DORINȚE ----------
function renderWishlist() {
  const arr = wishlistBooks().slice().sort((a, b) => (a.title || "").localeCompare(b.title || "", "ro"));
  wishCountEl.textContent = arr.length;
  wishListEl.innerHTML = "";
  if (arr.length === 0) { emptyRow(wishListEl, "Lista de dorințe e goală. Adaugă cărți pe care vrei să le cumperi! 🌟"); return; }
  for (const book of arr) {
    if (book.id === editingId) { wishListEl.appendChild(buildEditRow(book)); continue; }
    const li = document.createElement("li");
    li.appendChild(buildCover(book.cover_url, book.title));
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
  if (await updateBook(book, { wishlist: false })) {
    showStatus("🎉 „" + book.title + "” a fost mutată în colecția ta!");
    renderAll();
  }
}

// ---------- ÎMPRUMUTATE ----------
function renderLoaned() {
  const arr = loanedBooks().slice().sort((a, b) => (a.loaned_to || "").localeCompare(b.loaned_to || "", "ro"));
  loanedCountEl.textContent = arr.length;
  loanedListEl.innerHTML = "";
  if (arr.length === 0) { emptyRow(loanedListEl, "Nicio carte împrumutată momentan. 📕"); return; }
  for (const book of arr) {
    const li = document.createElement("li");
    li.appendChild(buildCover(book.cover_url, book.title));
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
      if (await updateBook(book, { loaned_to: null })) { showStatus("✅ „" + book.title + "” a fost marcată ca returnată."); renderAll(); }
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

  // autor favorit (cel mai frecvent)
  const counts = {};
  for (const b of col) { if (b.author) counts[b.author] = (counts[b.author] || 0) + 1; }
  let topAuthor = "—", topN = 0;
  for (const [a, n] of Object.entries(counts)) if (n > topN) { topAuthor = a; topN = n; }

  let html = '<div class="stats-grid">';
  html += statCard("Cărți în colecție", total);
  html += statCard("Citite", citite);
  html += statCard("În curs", inCurs);
  html += statCard("De citit", deCitit);
  html += statCard("Notă medie", "★ " + medie);
  html += statCard("În lista de dorințe", wishlistBooks().length);
  html += statCard("Împrumutate", loanedBooks().length);
  html += "</div>";

  html += `<div class="stat-author"><span class="stat-author-label">Autorul tău cu cele mai multe cărți</span>
    <span class="stat-author-name">${topAuthor}${topN ? " (" + topN + ")" : ""}</span></div>`;

  // bară pe status
  const totalStatus = citite + inCurs + deCitit || 1;
  html += `<div class="status-bar">
    <div class="seg seg-citita" style="width:${(citite / totalStatus) * 100}%"></div>
    <div class="seg seg-in_curs" style="width:${(inCurs / totalStatus) * 100}%"></div>
    <div class="seg seg-de_citit" style="width:${(deCitit / totalStatus) * 100}%"></div>
  </div>
  <div class="status-legend">
    <span><i class="dot dot-citita"></i> Citite ${citite}</span>
    <span><i class="dot dot-in_curs"></i> În curs ${inCurs}</span>
    <span><i class="dot dot-de_citit"></i> De citit ${deCitit}</span>
  </div>`;

  statsContentEl.innerHTML = html;
}

// ============================================================
//  ADĂUGARE (colecție + dorințe) cu verificare duplicate
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

// ---------- Ștergere ----------
async function deleteBook(book) {
  if (!db) return;
  if (!confirm(`Sigur vrei să scoți „${book.title}” din listă?`)) return;
  showStatus("Se șterge...");
  const { error } = await db.from("books").delete().eq("id", book.id);
  if (error) { showStatus("Nu am putut șterge: " + error.message, true); return; }
  books = books.filter((b) => b.id !== book.id);
  if (editingId === book.id) editingId = null;
  showStatus("🗑️ Carte ștearsă.");
  renderAll();
}

// ============================================================
//  NAVIGARE ÎNTRE PAGINI
// ============================================================
function showPage(name) {
  document.querySelectorAll("main > section[data-page]").forEach((s) => {
    s.hidden = s.getAttribute("data-page") !== name;
  });
  window.scrollTo({ top: 0, behavior: "smooth" });
}
pageNav.addEventListener("change", () => showPage(pageNav.value));
showPage(pageNav.value);

// ---------- Filtre / sortare / căutare ----------
searchEl.addEventListener("input", renderCollection);
filterStatusEl.addEventListener("change", renderCollection);
filterRatingEl.addEventListener("change", renderCollection);
sortByEl.addEventListener("change", renderCollection);
