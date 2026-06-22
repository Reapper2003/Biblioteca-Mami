// === Biblioteca mea — logica aplicației ===

const statusEl = document.getElementById("status");
const listEl = document.getElementById("book-list");
const countEl = document.getElementById("count");
const searchEl = document.getElementById("search");
const addForm = document.getElementById("add-form");
const titleEl = document.getElementById("title");
const authorEl = document.getElementById("author");

let books = [];        // toate cărțile, încărcate din Supabase
let db = null;         // clientul Supabase

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
    const li = document.createElement("li");

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

    const del = document.createElement("button");
    del.className = "btn-delete";
    del.title = "Șterge cartea";
    del.textContent = "🗑️";
    del.addEventListener("click", () => deleteBook(book));

    li.appendChild(info);
    li.appendChild(del);
    listEl.appendChild(li);
  }
}

// --- Adaugă o carte ---
addForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!db) return;

  const title = titleEl.value.trim();
  const author = authorEl.value.trim();
  if (!title) return;

  showStatus("Se adaugă...");
  const { data, error } = await db
    .from("books")
    .insert([{ title, author: author || null }])
    .select();

  if (error) {
    showStatus("Nu am putut adăuga cartea: " + error.message, true);
    return;
  }

  books.push(...data);
  books.sort((a, b) => (a.title || "").localeCompare(b.title || "", "ro"));
  addForm.reset();
  titleEl.focus();
  showStatus("✅ Carte adăugată!");
  render();
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
  showStatus("🗑️ Carte ștearsă.");
  render();
}

// --- Căutare live ---
searchEl.addEventListener("input", render);
