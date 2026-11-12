// Sécurité : mots de passe hachés, sessions, limite d’essais, données publiques d’un compte.
const crypto = require('crypto');
const { getUsers } = require('./db');

// Mots de passe hachés (scrypt). Les anciens mots de passe en clair sont convertis à la connexion.
function hashPassword(password) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(String(password), salt, 64).toString('hex');
    return `scrypt$${salt}$${hash}`;
}
function verifyPassword(user, password) {
    if (!user || !user.password || password === undefined || password === null) return false;
    const stored = user.password;
    if (stored.startsWith('scrypt$')) {
        const [, salt, hash] = stored.split('$');
        const test = crypto.scryptSync(String(password), salt, 64);
        const ref = Buffer.from(hash, 'hex');
        return ref.length === test.length && crypto.timingSafeEqual(ref, test);
    }
    if (stored === String(password)) { user.password = hashPassword(password); return true; } // migration
    return false;
}
function genCode() { return crypto.randomInt(100000, 1000000).toString(); }

// Données renvoyées au navigateur : jamais de mot de passe, code ni secret
function publicUser(u) {
    const { password, verificationCode, twoFactorSecret, tempTwoFactorSecret, pendingPassword,
        passwordChangeCode, resetCode, resetExpires, trustedDevices, sessions, ipAddress, pushSubscriptions, googleId, google2fa, homeGeo,
        premium, usage, ...safe } = u;
    safe.plan = require('./services/plans').planInfo(u); // formule, quotas du mois (sans les identifiants Stripe)
    safe.hasPassword = !!password;
    safe.googleLinked = !!googleId;
    // Liens signés vers la photo et le CV (les fichiers ne sont plus publics)
    const { signUpload } = require('./services/files');
    if (safe.avatarUrl) safe.avatarUrl = signUpload(safe.avatarUrl);
    if (safe.cvPdfUrl) safe.cvPdfUrl = signUpload(safe.cvPdfUrl);
    safe.isAdmin = require('./services/moderation').isAdmin(u); // ADMIN_EMAILS dans .env
    safe.pushDevices = Array.isArray(pushSubscriptions) ? pushSubscriptions.length : 0;
    return safe;
}

// Sessions : jeton aléatoire, seul son empreinte SHA-256 est stockée
function sha256(s) { return crypto.createHash('sha256').update(s).digest('hex'); }
function createSession(user) {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();
    user.sessions = (user.sessions || []).filter(s => new Date(s.expiresAt) > new Date());
    user.sessions.push({ hash: sha256(token), expiresAt });
    return token;
}
function requireAuth(req, res, next) {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) return res.status(401).json({ success: false, message: 'Veuillez vous connecter.' });
    const h = sha256(token);
    const users = getUsers();
    const idx = users.findIndex(u => (u.sessions || []).some(s => s.hash === h && new Date(s.expiresAt) > new Date()));
    if (idx === -1) return res.status(401).json({ success: false, message: 'Session expirée, veuillez vous reconnecter.' });
    req.users = users;
    req.userIndex = idx;
    req.user = users[idx];
    req.tokenHash = h;
    next();
}
// Adresse IP du visiteur. Derrière un hébergeur, Express la lit dans X-Forwarded-For seulement si TRUST_PROXY est réglé.
function clientIp(req) { return req.ip || (req.socket && req.socket.remoteAddress) || 'inconnue'; }

// Petite protection contre les essais en rafale (codes, mots de passe)
const attempts = new Map();
// Ménage toutes les 10 minutes : on oublie les compteurs inactifs depuis plus de 24 h (sinon la mémoire grossit sans fin)
setInterval(() => { const old = Date.now() - 24 * 3600 * 1000; for (const [k, list] of attempts) if (!list.length || list[list.length - 1] < old) attempts.delete(k); }, 10 * 60 * 1000).unref();
function tooManyAttempts(key, max = 10, windowMs = 15 * 60 * 1000) {
    const now = Date.now();
    const list = (attempts.get(key) || []).filter(t => now - t < windowMs);
    list.push(now);
    attempts.set(key, list);
    return list.length > max;
}

// Limite par adresse IP (attaques qui essaient beaucoup d'e-mails différents). Désactivée pendant les tests automatiques.
const IP_LIMITS = { register: [10, 3600e3], login: [60, 900e3], verify: [60, 900e3], forgot: [20, 3600e3] };
function ipLimit(kind) {
    return (req, res, next) => {
        if (process.env.NODE_ENV === 'test') return next();
        const [max, win] = IP_LIMITS[kind];
        if (tooManyAttempts(kind + '-ip:' + clientIp(req), max, win)) return res.status(429).json({ success: false, message: 'Trop de tentatives depuis votre connexion. Réessayez plus tard.' });
        next();
    };
}

// ---------- Appareils de confiance (double authentification) ----------
// Le navigateur garde un jeton aléatoire ; la base n'en garde que l'empreinte (sha256), avec un nom lisible
// tiré du navigateur (ex. « Chrome · Windows »). Pas d'empreinte technique de la machine : un jeton suffit et respecte la vie privée.
const TRUST_DAYS = 30;
function deviceLabel(ua) {
    ua = String(ua || '');
    const browser = /Edg\//.test(ua) ? 'Edge' : /OPR\/|Opera/.test(ua) ? 'Opera' : /SamsungBrowser/.test(ua) ? 'Samsung Internet'
        : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Navigateur';
    const os = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : /Android/.test(ua) ? 'Android' : /Windows/.test(ua) ? 'Windows'
        : /Mac OS X|Macintosh/.test(ua) ? 'Mac' : /CrOS/.test(ua) ? 'Chromebook' : /Linux/.test(ua) ? 'Linux' : 'appareil inconnu';
    return `${browser} · ${os}`;
}
// Jetons envoyés par le navigateur (en-tête X-Device-Token, plusieurs séparés par des virgules s'il y a plusieurs comptes)
function sentDeviceTokens(req) { return String(req.headers['x-device-token'] || '').split(',').map(s => s.trim()).filter(t => /^[a-f0-9]{16,128}$/i.test(t) || t.length >= 8).slice(0, 10); }
function findTrustedDevice(user, req) {
    const now = new Date();
    const hashes = new Set(sentDeviceTokens(req).map(sha256));
    const plain = new Set(sentDeviceTokens(req));
    return (user.trustedDevices || []).find(d => new Date(d.expiresAt) > now && ((d.hash && hashes.has(d.hash)) || (d.token && plain.has(d.token)))) || null;
}
// Connexion depuis un appareil de confiance : on note la dernière utilisation
function isTrustedDevice(user, req) {
    const d = findTrustedDevice(user, req);
    if (d) d.lastUsedAt = new Date().toISOString();
    return !!d;
}
function trustDevice(user, req) {
    const now = new Date();
    user.trustedDevices = (user.trustedDevices || []).filter(d => new Date(d.expiresAt) > now).slice(-19); // 20 appareils au plus
    const token = crypto.randomBytes(24).toString('hex');
    user.trustedDevices.push({
        id: crypto.randomBytes(6).toString('hex'), hash: sha256(token), label: deviceLabel(req.headers['user-agent']),
        addedAt: now.toISOString(), lastUsedAt: now.toISOString(), expiresAt: new Date(Date.now() + TRUST_DAYS * 24 * 3600 * 1000).toISOString()
    });
    return token;
}

module.exports = { ipLimit, attempts, publicUser, requireAuth, tooManyAttempts, hashPassword, verifyPassword, genCode, sha256, createSession, clientIp,
    deviceLabel, findTrustedDevice, isTrustedDevice, trustDevice };
