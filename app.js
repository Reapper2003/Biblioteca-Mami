// === Biblioteca mea — logica aplicației ===

const statusEl = document.getElementById("status");
const listEl = document.getElementById("book-list");
const countEl = document.getElementById("count");
const searchEl = document.getElementById("search");
const addForm = document.getElementById("add-form");
const titleEl = document.getElementById("title");
const authorEl = document.getElementById("author");
const coverEl = document.getElementById("cover");
const coverPreviewEl = document.getElementById("cover-preview");
const addStatusEl = document.getElementById("add-status");
const scanBtn = document.getElementById("scan-btn");
const scanModal = document.getElementById("scan-modal");
const scanCloseBtn = document.getElementById("scan-close");
const scanMsg = document.getElementById("scan-msg");
const scanHelp = document.getElementById("scan-help");
const viewListBtn = document.getElementById("view-list");
const viewShelfBtn = document.getElementById("view-shelf");

const BUCKET = "covers"; // numele bucket-ului de imagini din Supabase Storage

// culori frumoase pentru cărțile fără poză (în stil raft)
const SHELF_COLORS = [
  ["#F4C0D1", "#4B1528"],
  ["#B5D4F4", "#042C53"],
  ["#9FE1CB", "#04342C"],
  ["#CECBF6", "#26215C"],
  ["#FAC775", "#412402"],
  ["#F5C4B3", "#4A1B0C"],
  ["#C0DD97", "#173404"],
  ["#F7C1C1", "#501313"],
];
function pickColor(text) {
  let h = 0;
  for (let i = 0; i < (text || "").length; i++) h = (h + text.charCodeAt(i)) % 9973;
  return SHELF_COLORS[h % SHELF_COLORS.length];
}

// etichetele pentru statusul de citire
const STATUSES = {
  de_citit: "📋 De citit",
  in_curs: "📖 În curs",
  citita: "✅ Citită",
};

let books = [];        // toate cărțile, încărcate din Supabase
let db = null;         // clientul Supabase
let editingId = null;  // id-ul cărții aflate în editare (sau null)
let view = localStorage.getItem("view") || "list"; // "list" sau "shelf"

// --- Verificăm configurarea ---
function configOK() {
  return (
    typeof CONFIG !== "undefined" &&
    CONFIG.SUPABASE_URL &&
    !CONFIG.SUPABASE_URL.includes("PUNE_AICI") &&
    CONFIG.SUPABASE_ANON_KEY &&
    !CONFIG.SUPABASE_ANON_KEY.includes("PUNE_AICI")
  );
}

function showStatus(msg, isError = false) {
  statusEl.textContent = msg;
  statusEl.classList.toggle("error", isError);
}

// --- Pornire ---
if (!configOK()) {
  showStatus(
    "⚠️ Site-ul nu este încă configurat. Trebuie completat fișierul config.js cu datele de la Supabase.",
    true
  );
} else {
  db = window.supabase.createClient(
    CONFIG.SUPABASE_URL,
    CONFIG.SUPABASE_ANON_KEY
  );
  loadBooks();
}

// --- Încarcă toate cărțile ---
async function loadBooks() {
  showStatus("Se încarcă...");
  const { data, error } = await db
    .from("books")
    .select("*")
    .order("title", { ascending: true });

  if (error) {
    showStatus("Eroare la încărcare: " + error.message, true);
    return;
  }
  books = data || [];
  showStatus("");
  render();
}

// ============================================================
//  POZE
// ============================================================

// --- Micșorează poza înainte de încărcare (mai rapid + ocupă mai puțin) ---
function compressImage(file, maxDim = 1200, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > height && width > maxDim) {
        height = Math.round((height * maxDim) / width);
        width = maxDim;
      } else if (height >= width && height > maxDim) {
        width = Math.round((width * maxDim) / height);
        height = maxDim;
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      canvas.getContext("2d").drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("Nu am putut procesa poza"))),
        "image/jpeg",
        quality
      );
    };
    img.onerror = () => reject(new Error("Fișierul nu este o imagine validă"));
    img.src = URL.createObjectURL(file);
  });
}

// --- Încarcă o poză în Supabase Storage și întoarce adresa publică ---
async function uploadCover(file) {
  const blob = await compressImage(file);
  const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
  const { error } = await db.storage
    .from(BUCKET)
    .upload(path, blob, { contentType: "image/jpeg", upsert: false });
  if (error) throw error;
  const { data } = db.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

// ============================================================
//  SCANARE COD DE BARE (ISBN)
// ============================================================

let html5Qr = null;

async function openScanner() {
  if (typeof Html5Qrcode === "undefined") {
    showStatus("Scannerul nu s-a încărcat. Verifică internetul și reîncarcă pagina.", true);
    return;
  }
  scanModal.hidden = false;
  scanMsg.textContent = "Îndreaptă camera spre codul de bare de pe spatele cărții.";
  scanMsg.classList.remove("error");

  try {
    html5Qr = new Html5Qrcode("reader", {
      formatsToSupport: [
        Html5QrcodeSupportedFormats.EAN_13,
        Html5QrcodeSupportedFormats.EAN_8,
        Html5QrcodeSupportedFormats.UPC_A,
        Html5QrcodeSupportedFormats.UPC_E,
      ],
    });
    await html5Qr.start(
      { facingMode: "environment" },
      { fps: 10, qrbox: { width: 260, height: 160 } },
      (decodedText) => onScanSuccess(decodedText),
      () => {} // ignorăm erorile per-cadru (normale cât caută codul)
    );
  } catch (err) {
    scanMsg.textContent =
      "Nu am putut porni camera. Acceptă accesul la cameră din browser și încearcă din nou.";
    scanMsg.classList.add("error");
  }
}

async function closeScanner() {
  if (html5Qr) {
    try {
      await html5Qr.stop();
      await html5Qr.clear();
    } catch (e) {}
    html5Qr = null;
  }
  scanModal.hidden = true;
}

async function onScanSuccess(code) {
  let isbn = (code || "").replace(/[^0-9Xx]/g, "");
  // unele coduri de bare au un mic adaos lipit (preț) — păstrăm doar ISBN-ul de 13 cifre
  if (isbn.length > 13) isbn = isbn.slice(0, 13);

  await closeScanner();
  clearScanHelp();
  showStatus("Cod citit: " + isbn + " — caut cartea...");

  const info = await lookupISBN(isbn);
  if (info && info.title) {
    titleEl.value = info.title;
    if (info.author) authorEl.value = info.author;
    showStatus("✅ Am găsit: " + info.title + ". Verifică și apasă butonul Adaugă.");
  } else {
    showStatus("Nu am găsit titlul automat pentru acest cod.", true);
    showScanHelp(isbn);
  }
  titleEl.focus();
}

// --- Ajutor când nu găsim cartea automat: link de căutare pe Google ---
function clearScanHelp() {
  if (!scanHelp) return;
  scanHelp.hidden = true;
  scanHelp.innerHTML = "";
}

function showScanHelp(isbn) {
  if (!scanHelp) return;
  scanHelp.innerHTML = "";

  const txt = document.createElement("span");
  txt.textContent =
    "Cod scanat: " + isbn + ". Caut-o aici, apoi scrie titlul mai jos 👇";

  const link = document.createElement("a");
  link.href =
    "https://www.google.com/search?q=" + encodeURIComponent("ISBN " + isbn + " carte");
  link.target = "_blank";
  link.rel = "noopener";
  link.className = "scan-help-link";
  link.textContent = "🔍 Caută pe Google";

  scanHelp.appendChild(txt);
  scanHelp.appendChild(link);
  scanHelp.hidden = false;
}

// --- Caută titlul/autorul după ISBN (Google Books, apoi OpenLibrary) ---
async function lookupISBN(isbn) {
  try {
    const r = await fetch(
      "https://www.googleapis.com/books/v1/volumes?q=isbn:" + isbn
    );
    const j = await r.json();
    if (j.totalItems > 0 && j.items && j.items[0].volumeInfo) {
      const v = j.items[0].volumeInfo;
      return { title: v.title || "", author: (v.authors || []).join(", ") };
    }
  } catch (e) {}

  try {
    const r = await fetch(
      "https://openlibrary.org/api/books?bibkeys=ISBN:" +
        isbn +
        "&format=json&jscmd=data"
    );
    const j = await r.json();
    const d = j["ISBN:" + isbn];
    if (d) {
      return {
        title: d.title || "",
        author: (d.authors || []).map((a) => a.name).join(", "),
      };
    }
  } catch (e) {}

  return null;
}

scanBtn.addEventListener("click", openScanner);
scanCloseBtn.addEventListener("click", closeScanner);

// ============================================================
//  RATING (steluțe) + STATUS DE CITIRE
// ============================================================

async function setRating(book, value) {
  const newVal = book.rating === value ? null : value; // re-apăsare = șterge nota
  const { error } = await db
    .from("books")
    .update({ rating: newVal })
    .eq("id", book.id);
  if (error) {
    showStatus("Nu am putut salva nota: " + error.message, true);
    return;
  }
  book.rating = newVal;
  render();
}

async function setStatus(book, value) {
  const newVal = value || null;
  const { error } = await db
    .from("books")
    .update({ status: newVal })
    .eq("id", book.id);
  if (error) {
    showStatus("Nu am putut salva statusul: " + error.message, true);
    return;
  }
  book.status = newVal;
  render();
}

function buildStars(book) {
  const wrap = document.createElement("div");
  wrap.className = "stars";
  for (let i = 1; i <= 5; i++) {
    const star = document.createElement("span");
    star.className = "star" + (book.rating >= i ? " on" : "");
    star.textContent = "★";
    star.title = i + " din 5";
    star.addEventListener("click", () => setRating(book, i));
    wrap.appendChild(star);
  }
  return wrap;
}

function buildStatusSelect(book) {
  const sel = document.createElement("select");
  sel.className = "status-select inline status-" + (book.status || "none");

  const opt0 = document.createElement("option");
  opt0.value = "";
  opt0.textContent = "▫️ Fără status";
  sel.appendChild(opt0);

  for (const [code, label] of Object.entries(STATUSES)) {
    const o = document.createElement("option");
    o.value = code;
    o.textContent = label;
    sel.appendChild(o);
  }

  sel.value = book.status || "";
  sel.addEventListener("change", () => setStatus(book, sel.value));
  return sel;
}

// ============================================================
//  AFIȘARE LISTĂ
// ============================================================

function setView(v) {
  view = v;
  localStorage.setItem("view", v);
  updateToggle();
  render();
}
function updateToggle() {
  viewListBtn.classList.toggle("active", view === "list");
  viewShelfBtn.classList.toggle("active", view === "shelf");
}
viewListBtn.addEventListener("click", () => setView("list"));
viewShelfBtn.addEventListener("click", () => setView("shelf"));
updateToggle();

function render() {
  const q = searchEl.value.trim().toLowerCase();
  const filtered = q
    ? books.filter((b) => {
        const t = (b.title || "").toLowerCase();
        const a = (b.author || "").toLowerCase();
        return t.includes(q) || a.includes(q);
      })
    : books;

  countEl.textContent = filtered.length;
  listEl.className = view === "shelf" ? "shelf-view" : "";
  listEl.innerHTML = "";

  if (filtered.length === 0) {
    const li = document.createElement("li");
    li.className = "empty";
    li.textContent = q
      ? "Nicio carte găsită pentru această căutare."
      : "Încă nu ai nicio carte. Adaugă prima carte mai sus! 📖";
    listEl.appendChild(li);
    return;
  }

  for (const book of filtered) {
    if (book.id === editingId) {
      listEl.appendChild(buildEditRow(book));
    } else if (view === "shelf") {
      listEl.appendChild(buildShelfCard(book));
    } else {
      listEl.appendChild(buildRow(book));
    }
  }
}

// --- Un card în stil raft (copertă mare) ---
function buildShelfCard(book) {
  const li = document.createElement("li");
  li.className = "shelf-card";

  const cover = document.createElement("div");
  cover.className = "shelf-cover";
  if (book.cover_url) {
    const img = document.createElement("img");
    img.src = book.cover_url;
    img.alt = book.title || "copertă";
    img.loading = "lazy";
    cover.appendChild(img);
  } else {
    const [bg, fg] = pickColor(book.title);
    cover.classList.add("shelf-cover-text");
    cover.style.background = bg;
    cover.style.color = fg;
    const t = document.createElement("span");
    t.className = "shelf-cover-title";
    t.textContent = book.title;
    cover.appendChild(t);
  }
  cover.addEventListener("click", () => {
    editingId = book.id;
    render();
  });
  li.appendChild(cover);

  const title = document.createElement("div");
  title.className = "shelf-title";
  title.textContent = book.title;
  li.appendChild(title);

  if (book.author) {
    const author = document.createElement("div");
    author.className = "shelf-author";
    author.textContent = book.author;
    li.appendChild(author);
  }

  li.appendChild(buildStars(book));
  li.appendChild(buildStatusSelect(book));

  const actions = document.createElement("div");
  actions.className = "shelf-actions";

  const edit = document.createElement("button");
  edit.className = "btn-edit";
  edit.title = "Modifică cartea";
  edit.textContent = "✏️";
  edit.addEventListener("click", () => {
    editingId = book.id;
    render();
  });

  const del = document.createElement("button");
  del.className = "btn-delete";
  del.title = "Șterge cartea";
  del.textContent = "🗑️";
  del.addEventListener("click", () => deleteBook(book));

  actions.appendChild(edit);
  actions.appendChild(del);
  li.appendChild(actions);

  return li;
}

// --- Un rând normal (mod citire) ---
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
    const author = document.createElement("div");
    author.className = "book-author";
    author.textContent = book.author;
    info.appendChild(author);
  }

  const meta = document.createElement("div");
  meta.className = "book-meta";
  meta.appendChild(buildStatusSelect(book));
  meta.appendChild(buildStars(book));
  info.appendChild(meta);

  li.appendChild(info);

  const actions = document.createElement("div");
  actions.className = "actions";

  const edit = document.createElement("button");
  edit.className = "btn-edit";
  edit.title = "Modifică cartea";
  edit.textContent = "✏️";
  edit.addEventListener("click", () => {
    editingId = book.id;
    render();
  });

  const del = document.createElement("button");
  del.className = "btn-delete";
  del.title = "Șterge cartea";
  del.textContent = "🗑️";
  del.addEventListener("click", () => deleteBook(book));

  actions.appendChild(edit);
  actions.appendChild(del);
  li.appendChild(actions);

  return li;
}

// --- Miniatura cu coperta (sau un substitut dacă nu există poză) ---
function buildCover(url, title) {
  const wrap = document.createElement("div");
  wrap.className = "cover";
  if (url) {
    const img = document.createElement("img");
    img.src = url;
    img.alt = title || "copertă";
    img.loading = "lazy";
    wrap.appendChild(img);
  } else {
    wrap.classList.add("cover-empty");
    wrap.textContent = "📖";
  }
  return wrap;
}

// --- Un rând în mod editare ---
function buildEditRow(book) {
  const li = document.createElement("li");
  li.className = "editing";

  const form = document.createElement("form");
  form.className = "edit-form";

  const tInput = document.createElement("input");
  tInput.type = "text";
  tInput.value = book.title || "";
  tInput.placeholder = "Titlul cărții";
  tInput.required = true;

  const aInput = document.createElement("input");
  aInput.type = "text";
  aInput.value = book.author || "";
  aInput.placeholder = "Autorul (opțional)";

  // zona pentru poză
  const photoRow = document.createElement("div");
  photoRow.className = "edit-photo-row";

  photoRow.appendChild(buildCover(book.cover_url, book.title));

  const photoLabel = document.createElement("label");
  photoLabel.className = "file-btn small";
  photoLabel.textContent = book.cover_url ? "🖼️ Schimbă poza" : "🖼️ Adaugă o poză";

  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = "image/*";
  fileInput.hidden = true;
  photoLabel.appendChild(fileInput);

  let removeCover = false;
  fileInput.addEventListener("change", () => {
    if (fileInput.files[0]) {
      removeCover = false;
      photoLabel.textContent = "✅ Poză nouă aleasă";
      photoLabel.appendChild(fileInput);
    }
  });

  photoRow.appendChild(photoLabel);

  if (book.cover_url) {
    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "link-danger";
    removeBtn.textContent = "Șterge poza";
    removeBtn.addEventListener("click", () => {
      removeCover = true;
      fileInput.value = "";
      photoLabel.textContent = "🖼️ Adaugă o poză";
      photoLabel.appendChild(fileInput);
      removeBtn.textContent = "Poza va fi ștearsă";
      removeBtn.disabled = true;
    });
    photoRow.appendChild(removeBtn);
  }

  // butoane salvează / renunță
  const actions = document.createElement("div");
  actions.className = "edit-actions";

  const save = document.createElement("button");
  save.type = "submit";
  save.className = "btn-primary small";
  save.textContent = "Salvează";

  const cancel = document.createElement("button");
  cancel.type = "button";
  cancel.className = "btn-ghost small";
  cancel.textContent = "Renunță";
  cancel.addEventListener("click", () => {
    editingId = null;
    render();
  });

  actions.appendChild(save);
  actions.appendChild(cancel);

  form.appendChild(tInput);
  form.appendChild(aInput);
  form.appendChild(photoRow);
  form.appendChild(actions);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const newTitle = tInput.value.trim();
    if (!newTitle) return;

    save.disabled = true;
    const updates = { title: newTitle, author: aInput.value.trim() || null };

    try {
      if (fileInput.files[0]) {
        showStatus("Se încarcă poza...");
        updates.cover_url = await uploadCover(fileInput.files[0]);
      } else if (removeCover) {
        updates.cover_url = null;
      }

      showStatus("Se salvează...");
      const { data, error } = await db
        .from("books")
        .update(updates)
        .eq("id", book.id)
        .select();
      if (error) throw error;

      const idx = books.findIndex((b) => b.id === book.id);
      if (idx !== -1 && data && data[0]) books[idx] = data[0];
      books.sort((a, b) => (a.title || "").localeCompare(b.title || "", "ro"));
      editingId = null;
      showStatus("✅ Modificările au fost salvate!");
      render();
    } catch (err) {
      save.disabled = false;
      showStatus("Nu am putut salva: " + (err.message || err), true);
    }
  });

  li.appendChild(form);
  return li;
}

// --- Previzualizare poză la adăugare ---
coverEl.addEventListener("change", () => {
  coverPreviewEl.innerHTML = "";
  const file = coverEl.files[0];
  if (!file) return;
  const img = document.createElement("img");
  img.src = URL.createObjectURL(file);
  img.className = "preview-thumb";
  const txt = document.createElement("span");
  txt.textContent = "Poză aleasă";
  coverPreviewEl.appendChild(img);
  coverPreviewEl.appendChild(txt);
});

// --- Adaugă o carte ---
addForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!db) return;

  const title = titleEl.value.trim();
  const author = authorEl.value.trim();
  if (!title) return;

  const submitBtn = addForm.querySelector('button[type="submit"]');
  submitBtn.disabled = true;

  try {
    let cover_url = null;
    if (coverEl.files[0]) {
      showStatus("Se încarcă poza...");
      cover_url = await uploadCover(coverEl.files[0]);
    }

    showStatus("Se adaugă...");
    const { data, error } = await db
      .from("books")
      .insert([
        {
          title,
          author: author || null,
          cover_url,
          status: addStatusEl.value || null,
        },
      ])
      .select();
    if (error) throw error;

    books.push(...data);
    books.sort((a, b) => (a.title || "").localeCompare(b.title || "", "ro"));
    addForm.reset();
    coverPreviewEl.innerHTML = "";
    clearScanHelp();
    titleEl.focus();
    showStatus("✅ Carte adăugată!");
    render();
  } catch (err) {
    showStatus("Nu am putut adăuga cartea: " + (err.message || err), true);
  } finally {
    submitBtn.disabled = false;
  }
});

// --- Șterge o carte ---
async function deleteBook(book) {
  if (!db) return;
  const ok = confirm(`Sigur vrei să scoți „${book.title}” din listă?`);
  if (!ok) return;

  showStatus("Se șterge...");
  const { error } = await db.from("books").delete().eq("id", book.id);

  if (error) {
    showStatus("Nu am putut șterge cartea: " + error.message, true);
    return;
  }

  books = books.filter((b) => b.id !== book.id);
  if (editingId === book.id) editingId = null;
  showStatus("🗑️ Carte ștearsă.");
  render();
}

// --- Căutare live ---
searchEl.addEventListener("input", render);
