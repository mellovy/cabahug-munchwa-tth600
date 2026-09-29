const express = require('express');
const mysql = require('mysql2/promise');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// XAMPP/phpMyAdmin defaults: user "root", empty password
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '',
  database: process.env.DB_NAME || 'munchwa',
  waitForConnections: true,
  connectionLimit: 10,
});

app.use(express.urlencoded({ extended: false }));

// Only expose the stylesheet (not server.js)
app.get('/style.css', (req, res) => res.sendFile(path.join(__dirname, 'style.css')));

/* ---------- helpers ---------- */

const STATUSES = {
  reading: 'READING',
  completed: 'COMPLETED',
  planned: 'PLAN TO READ',
  dropped: 'DROPPED',
};

const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const ratingText = (r) => (r === null || r === undefined ? '—' : `${r}/10`);

function layout(title, body, showListLink = true) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<link rel="stylesheet" href="/style.css">
</head>
<body>
<input type="checkbox" id="theme-toggle" class="theme-toggle-checkbox">
<div class="page">

<nav>
  <h1>MUNCHWA</h1>
  <div class="nav-links">
    ${showListLink ? '<a href="/">LIST</a>' : ''}
    <label class="theme-switch" for="theme-toggle">🌓 THEME</label>
  </div>
</nav>

<main>
${body}
</main>

</div>
</body>
</html>`;
}

function statusOptions(selected) {
  return Object.entries(STATUSES)
    .map(([v, l]) => `<option value="${v}"${v === selected ? ' selected' : ''}>${l}</option>`)
    .join('\n        ');
}

function entryForm({ action, entry = {}, submitLabel, cancelHref, notesPlaceholder = '' }) {
  return `<div class="card">
    <form action="${action}" method="post">
      <label for="title">TITLE</label>
      <input type="text" id="title" name="title" value="${esc(entry.title)}" maxlength="255" required>

      <label for="chapters">CHAPTERS READ</label>
      <input type="number" id="chapters" name="chapters" value="${esc(entry.chapters ?? '')}" min="0" required>

      <label for="status">STATUS</label>
      <select id="status" name="status">
        ${statusOptions(entry.status || 'reading')}
      </select>

      <label for="rating">RATING (0-10)</label>
      <input type="number" id="rating" name="rating" value="${esc(entry.rating ?? '')}" min="0" max="10">

      <label for="notes">NOTES</label>
      <textarea id="notes" name="notes" placeholder="${esc(notesPlaceholder)}">${esc(entry.notes)}</textarea>

      <div class="form-actions">
        <button type="submit" class="btn-primary">${submitLabel}</button>
        <a class="btn btn-view" href="${cancelHref}">CANCEL</a>
      </div>
    </form>
  </div>`;
}

// Validate + normalize form input
function parseForm(body) {
  const title = String(body.title || '').trim().slice(0, 255);
  const chapters = Math.max(0, parseInt(body.chapters, 10) || 0);
  const status = Object.keys(STATUSES).includes(body.status) ? body.status : 'reading';
  let rating = body.rating === '' || body.rating === undefined ? null : parseInt(body.rating, 10);
  if (rating !== null) rating = Number.isNaN(rating) ? null : Math.min(10, Math.max(0, rating));
  const notes = String(body.notes || '').trim() || null;
  return { title, chapters, status, rating, notes };
}

const getEntry = async (id) => {
  const [rows] = await pool.query('SELECT * FROM entries WHERE id = ?', [id]);
  return rows[0];
};

const notFound = (res) =>
  res.status(404).send(
    layout(
      'Not Found - Munchwa',
      `<div class="card empty-state">
    <p>ENTRY NOT FOUND.</p>
    <div class="form-actions" style="justify-content: center; margin-top: 20px;">
      <a class="btn btn-primary" href="/">BACK TO LIST</a>
    </div>
  </div>`,
    ),
  );

/* ---------- routes ---------- */

// LIST
app.get('/', async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT * FROM entries ORDER BY updated_at DESC, id DESC');

    const items = rows.length
      ? rows
          .map(
            (e) => `  <div class="card list-item">
    <div class="info">
      <h3>${esc(e.title.toUpperCase())}</h3>
      <p>${e.chapters} CH &middot; RATING ${ratingText(e.rating)}</p>
      <span class="badge ${e.status}">${STATUSES[e.status]}</span>
    </div>
    <div class="actions">
      <a class="btn btn-view" href="/view/${e.id}">VIEW</a>
      <a class="btn btn-edit" href="/edit/${e.id}">EDIT</a>
      <form action="/delete/${e.id}" method="post" style="display:inline" onsubmit="return confirm('Delete this entry?');">
        <button type="submit" class="btn-delete">DELETE</button>
      </form>
    </div>
  </div>`,
          )
          .join('\n\n')
      : `  <div class="card empty-state"><p>NO ENTRIES YET.</p></div>`;

    res.send(
      layout(
        'Munchwa',
        `  <h2>MY LIST</h2>

${items}

  <a class="add-tile" href="/add" title="Add new entry">+</a>`,
        false,
      ),
    );
  } catch (err) {
    next(err);
  }
});

// ADD
app.get('/add', (req, res) => {
  res.send(
    layout(
      'Add Entry - Munchwa',
      `  <h2>ADD NEW ENTRY</h2>
  ${entryForm({ action: '/add', submitLabel: 'ADD ENTRY', cancelHref: '/', notesPlaceholder: 'optional notes...' })}`,
    ),
  );
});

app.post('/add', async (req, res, next) => {
  try {
    const { title, chapters, status, rating, notes } = parseForm(req.body);
    if (!title) return res.redirect('/add');
    await pool.query(
      'INSERT INTO entries (title, chapters, status, rating, notes) VALUES (?, ?, ?, ?, ?)',
      [title, chapters, status, rating, notes],
    );
    res.redirect('/');
  } catch (err) {
    next(err);
  }
});

// VIEW
app.get('/view/:id', async (req, res, next) => {
  try {
    const e = await getEntry(req.params.id);
    if (!e) return notFound(res);

    res.send(
      layout(
        `${e.title} - Munchwa`,
        `  <h2>ENTRY DETAILS</h2>
  <div class="card">
    <div class="cover">${esc(e.title.toUpperCase())}</div>
    <div class="detail-row"><div class="label">TITLE</div><div>${esc(e.title)}</div></div>
    <div class="detail-row"><div class="label">CHAPTERS</div><div>${e.chapters}</div></div>
    <div class="detail-row"><div class="label">STATUS</div><div><span class="badge ${e.status}">${STATUSES[e.status]}</span></div></div>
    <div class="detail-row"><div class="label">RATING</div><div>${ratingText(e.rating)}</div></div>
    <div class="detail-row"><div class="label">NOTES</div><div>${esc(e.notes) || '—'}</div></div>
  </div>
  <div class="form-actions">
    <a class="btn btn-edit" href="/edit/${e.id}">EDIT</a>
    <a class="btn btn-view" href="/">BACK TO LIST</a>
  </div>`,
      ),
    );
  } catch (err) {
    next(err);
  }
});

// EDIT
app.get('/edit/:id', async (req, res, next) => {
  try {
    const e = await getEntry(req.params.id);
    if (!e) return notFound(res);

    res.send(
      layout(
        `Edit ${e.title} - Munchwa`,
        `  <h2>EDIT ENTRY</h2>
  ${entryForm({ action: `/edit/${e.id}`, entry: e, submitLabel: 'SAVE CHANGES', cancelHref: `/view/${e.id}` })}`,
      ),
    );
  } catch (err) {
    next(err);
  }
});

app.post('/edit/:id', async (req, res, next) => {
  try {
    const { title, chapters, status, rating, notes } = parseForm(req.body);
    if (!title) return res.redirect(`/edit/${req.params.id}`);
    const [result] = await pool.query(
      'UPDATE entries SET title = ?, chapters = ?, status = ?, rating = ?, notes = ? WHERE id = ?',
      [title, chapters, status, rating, notes, req.params.id],
    );
    if (!result.affectedRows) return notFound(res);
    res.redirect(`/view/${req.params.id}`);
  } catch (err) {
    next(err);
  }
});

// DELETE
app.post('/delete/:id', async (req, res, next) => {
  try {
    await pool.query('DELETE FROM entries WHERE id = ?', [req.params.id]);
    res.send(
      layout(
        'Entry Deleted - Munchwa',
        `  <div class="card empty-state">
    <p>ENTRY REMOVED FROM LIST.</p>
    <div class="form-actions" style="justify-content: center; margin-top: 20px;">
      <a class="btn btn-primary" href="/">BACK TO LIST</a>
    </div>
  </div>`,
      ),
    );
  } catch (err) {
    next(err);
  }
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).send(
    layout(
      'Error - Munchwa',
      `<div class="card empty-state"><p>SOMETHING WENT WRONG.</p>
    <div class="form-actions" style="justify-content: center; margin-top: 20px;">
      <a class="btn btn-primary" href="/">BACK TO LIST</a>
    </div></div>`,
    ),
  );
});

app.listen(PORT, () => console.log(`Munchwa running at http://localhost:${PORT}`));