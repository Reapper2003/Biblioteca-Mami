# 📚 Biblioteca mea

Un site simplu unde mama poate să **adauge cărți**, să **caute** prin ele și să
**scoată** o carte din listă. Cărțile se salvează online (Supabase), așa că lista
e aceeași de pe telefon și de pe laptop. Site-ul rulează gratuit pe GitHub Pages.

---

## Ce ai de făcut o singură dată (~10 minute)

### Pasul 1 — Creează baza de date (Supabase)

1. Intră pe **https://supabase.com** și apasă **Start your project** → fă-ți cont
   (poți folosi contul Google).
2. Apasă **New project**. Alege un nume (ex: `biblioteca`), o parolă pentru bază
   de date (notează-o undeva, dar nu îți trebuie zilnic) și o regiune apropiată
   (ex: `Central EU (Frankfurt)`). Apasă **Create new project** și așteaptă ~2 min.
3. În stânga, intră la **SQL Editor** → **New query**, lipește textul de mai jos
   și apasă **Run**:

   ```sql
   create table books (
     id bigint generated always as identity primary key,
     title text not null,
     author text,
     created_at timestamptz default now()
   );

   alter table books enable row level security;

   create policy "acces public" on books
     for all
     using (true)
     with check (true);
   ```

   Asta creează tabelul cu cărți și permite site-ului să citească/scrie în el.

### Pasul 2 — Ia cele 2 chei și pune-le în `config.js`

1. În Supabase, mergi la **Project Settings** (roata dințată, jos stânga) →
   **API** (sau **Data API**).
2. Copiază:
   - **Project URL** (ex: `https://abcdxyz.supabase.co`)
   - cheia **anon public** (un șir lung de caractere)
3. Deschide fișierul **`config.js`** și înlocuiește:
   - `PUNE_AICI_URL_UL` cu Project URL
   - `PUNE_AICI_CHEIA_ANON` cu cheia anon public

   (Lasă ghilimelele pe loc.)

### Pasul 3 — Pune site-ul pe GitHub Pages

1. Creează un cont pe **https://github.com** (dacă nu ai).
2. Apasă **New repository**, dă-i un nume (ex: `biblioteca`), bifează **Public**,
   apasă **Create repository**.
3. Apasă **uploading an existing file** și trage toate fișierele din acest folder
   (`index.html`, `style.css`, `app.js`, `config.js`, `README.md`). Apasă
   **Commit changes**.
4. Mergi la **Settings** → **Pages** → la *Branch* alege `main` și `/ (root)`,
   apasă **Save**.
5. După 1–2 minute, sus apare linkul site-ului (ceva de forma
   `https://numele-tau.github.io/biblioteca/`). **Acela e linkul pe care îl dai mamei.** 🎉

---

## Cum se folosește (pentru mama)

- **Adaugă o carte:** scrie titlul (și autorul, dacă vrei) și apasă **Adaugă**.
- **Caută:** scrie în câmpul de căutare — lista se filtrează singură.
- **Scoate o carte:** apasă pe coșul de gunoi 🗑️ din dreptul cărții.

Lista se salvează automat online. Funcționează la fel pe telefon și pe calculator.

---

## Note

- Linkul e public: oricine îl are poate vedea/edita lista. Pentru o listă de cărți
  personală, e de obicei în regulă. Dacă vrei protecție cu parolă, se poate adăuga
  ulterior.
- Plata: atât GitHub Pages cât și Supabase au planuri **gratuite** suficiente
  pentru acest site.
