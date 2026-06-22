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

const BUCKET = "covers"; // numele bucket-ului de imagini din Supabase Storage

let books = [];        // toate cărțile, încărcate din Supabase
let db = null;         // clientul Supabase
let editingId = null;  // id-ul cărții aflate în editare (sau null)

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

// --- Afișează lista (filtrată de căutare) ---
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
    listEl.appendChild(
      book.id === editingId ? buildEditRow(book) : buildRow(book)
    );
  }
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
  photoLabel.textContent = book.cover_url ? "📷 Schimbă poza" : "📷 Adaugă o poză";

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
      photoLabel.textContent = "📷 Adaugă o poză";
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
      .insert([{ title, author: author || null, cover_url }])
      .select();
    if (error) throw error;

    books.push(...data);
    books.sort((a, b) => (a.title || "").localeCompare(b.title || "", "ro"));
    addForm.reset();
    coverPreviewEl.innerHTML = "";
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
