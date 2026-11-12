// Fichiers envoyés (photos, CV) : ils ne sont plus publics. Chaque lien est signé et expire.
//  - dans le site : liens valables jusqu'à la fin de la semaine suivante (même lien toute la semaine : le navigateur garde l'image en cache)
//  - CV joint à une candidature : lien valable 6 mois pour le recruteur
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const { APP_SECRET, UPLOADS_DIR } = require('../config');

const WEEK = 7 * 24 * 3600 * 1000;
const sig = (name, exp) => crypto.createHmac('sha256', APP_SECRET).update(`upload:${name}:${exp}`).digest('hex').slice(0, 32);

// "/uploads/avatarFile-123.png" → "/uploads/avatarFile-123.png?exp=…&sig=…"
function signUpload(url, ttlMs) {
    if (!url || typeof url !== 'string' || !url.startsWith('/uploads/')) return url;
    const name = path.basename(url.split('?')[0]);
    const exp = ttlMs ? Date.now() + ttlMs : Math.ceil(Date.now() / WEEK) * WEEK + WEEK;
    return `/uploads/${encodeURIComponent(name)}?exp=${exp}&sig=${sig(name, exp)}`;
}
function checkSignature(name, exp, signature) {
    const e = parseInt(exp);
    if (!e || e < Date.now() || !signature) return false;
    const expected = sig(name, e);
    return String(signature).length === expected.length && crypto.timingSafeEqual(Buffer.from(String(signature)), Buffer.from(expected));
}

// Remplace la diffusion libre du dossier uploads
function serveUpload(req, res) {
    const name = path.basename(String(req.params.name || ''));
    if (!/^[\w.-]+$/.test(name) || !checkSignature(name, req.query.exp, req.query.sig)) return res.status(403).type('text').send('Lien expiré ou invalide.');
    const file = path.join(UPLOADS_DIR, name);
    if (!fs.existsSync(file)) return res.status(404).type('text').send('Fichier introuvable.');
    const ext = path.extname(name).toLowerCase();
    const types = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.pdf': 'application/pdf' };
    if (!types[ext]) return res.status(404).type('text').send('Fichier introuvable.');
    res.setHeader('Content-Type', types[ext]);
    res.setHeader('Cache-Control', 'private, max-age=86400');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Robots-Tag', 'noindex');
    if (ext === '.pdf') res.setHeader('Content-Security-Policy', "sandbox; default-src 'none'; style-src 'unsafe-inline'"); // un PDF ne peut pas exécuter de script sur le site
    res.sendFile(file);
}

module.exports = { signUpload, serveUpload, checkSignature };
