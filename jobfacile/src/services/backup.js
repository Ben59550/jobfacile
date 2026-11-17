// Sauvegarde automatique de la base (comptes, offres, messages, forum) : une copie par jour, les 14 dernières gardées.
// Copie cohérente même pendant l'utilisation (VACUUM INTO de SQLite).
// BACKUP_DIR dans .env : dossier de destination supplémentaire (ex. un dossier OneDrive ou un disque externe).
const fs = require('fs');
const path = require('path');
const { db } = require('../db');
const { DATA_DIR } = require('../config');

const LOCAL_DIR = path.join(DATA_DIR, 'backups');
const KEEP = 14;

function listBackups(dir = LOCAL_DIR) {
    try { return fs.readdirSync(dir).filter(f => /^jobfacile-\d{4}-\d{2}-\d{2}\.db$/.test(f)).sort(); } catch (e) { return []; }
}
function backupNow({ force = false } = {}) {
    fs.mkdirSync(LOCAL_DIR, { recursive: true });
    const day = new Date().toISOString().slice(0, 10);
    const name = `jobfacile-${day}.db`;
    const target = path.join(LOCAL_DIR, name);
    if (fs.existsSync(target) && !force) return { skipped: true, file: target };
    if (fs.existsSync(target)) fs.unlinkSync(target);
    db.exec(`VACUUM INTO '${target.replace(/'/g, "''")}'`);
    // Rotation : on garde les 14 dernières
    const all = listBackups();
    for (const old of all.slice(0, Math.max(0, all.length - KEEP))) fs.unlinkSync(path.join(LOCAL_DIR, old));
    // Copie supplémentaire hors du serveur, si configurée
    const extra = process.env.BACKUP_DIR;
    let copied = null;
    if (extra) {
        try {
            fs.mkdirSync(extra, { recursive: true });
            fs.copyFileSync(target, path.join(extra, name));
            const ext = listBackups(extra);
            for (const old of ext.slice(0, Math.max(0, ext.length - KEEP))) fs.unlinkSync(path.join(extra, old));
            copied = path.join(extra, name);
        } catch (e) { console.warn('⚠️  Copie de sauvegarde vers BACKUP_DIR impossible :', e.message); }
    }
    return { file: target, size: fs.statSync(target).size, copied };
}
function lastBackup() {
    const all = listBackups();
    if (!all.length) return null;
    const file = path.join(LOCAL_DIR, all[all.length - 1]);
    return { name: all[all.length - 1], at: fs.statSync(file).mtime.toISOString(), size: fs.statSync(file).size, count: all.length };
}
// Au démarrage puis toutes les 6 heures (une seule copie par jour)
function scheduleBackups() {
    const run = () => {
        try { const r = backupNow(); if (!r.skipped) console.log(`💾 Sauvegarde de la base : ${path.basename(r.file)}${r.copied ? ' (copiée dans BACKUP_DIR)' : ''}`); }
        catch (e) { console.error('❌ Sauvegarde de la base impossible :', e.message); }
    };
    setTimeout(run, 30 * 1000).unref();
    setInterval(run, 6 * 3600 * 1000).unref();
}

module.exports = { backupNow, lastBackup, listBackups, scheduleBackups };
