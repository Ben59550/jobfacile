// Base de données SQLite : comptes utilisateurs (une ligne par compte).
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { DATA_DIR, USERS_FILE } = require('./config');
const { normEmail } = require('./utils');

// ---------- Utilisateurs : base SQLite (data/jobfacile.db) ----------
// Une ligne par compte. saveUsers() n'écrit que les comptes réellement modifiés, dans une transaction :
// deux requêtes simultanées sur deux comptes différents ne s'écrasent plus.
const { DatabaseSync } = require('node:sqlite');
const DB_FILE = path.join(DATA_DIR, 'jobfacile.db');
const db = new DatabaseSync(DB_FILE);
db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;
    PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE COLLATE NOCASE,
        data TEXT NOT NULL,
        created_at TEXT,
        updated_at TEXT NOT NULL
    );
`);
const stmt = {
    all: db.prepare('SELECT id, data FROM users ORDER BY rowid'),
    upsert: db.prepare(`INSERT INTO users (id, email, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET email = excluded.email, data = excluded.data, updated_at = excluded.updated_at`),
    del: db.prepare('DELETE FROM users WHERE id = ?'),
    count: db.prepare('SELECT COUNT(*) AS n FROM users')
};
function inTransaction(fn) {
    db.exec('BEGIN IMMEDIATE');
    try { const r = fn(); db.exec('COMMIT'); return r; } catch (e) { db.exec('ROLLBACK'); throw e; }
}
function writeUser(u, now = new Date().toISOString()) {
    if (!u.id) u.id = Date.now().toString() + crypto.randomInt(1e5);
    stmt.upsert.run(String(u.id), normEmail(u.email), JSON.stringify(u), u.createdAt || now, now);
}
// Migration unique depuis l'ancien fichier users.json (renommé ensuite en users.json.migrated)
(function migrateUsersJson() {
    if (!fs.existsSync(USERS_FILE) || stmt.count.get().n > 0) return;
    try {
        const list = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
        inTransaction(() => list.forEach(u => writeUser(u)));
        fs.renameSync(USERS_FILE, USERS_FILE + '.migrated');
        console.log(`🗄️  ${list.length} compte(s) migré(s) de users.json vers SQLite.`);
    } catch (e) { console.error('Migration users.json → SQLite impossible :', e.message); }
})();

function getUsers() {
    return stmt.all.all().map(r => { try { return JSON.parse(r.data); } catch (e) { return null; } }).filter(Boolean);
}
function saveUsers(users) {
    const stored = new Map(stmt.all.all().map(r => [r.id, r.data]));
    const now = new Date().toISOString();
    inTransaction(() => {
        for (const u of users) if (stored.get(String(u.id)) !== JSON.stringify(u)) writeUser(u, now);
    });
}
function deleteUser(id) { stmt.del.run(String(id)); }

module.exports = { db, getUsers, saveUsers, deleteUser };
