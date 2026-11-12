// Parrainage : chaque compte a un code d'invitation. Un filleul ne compte qu'une fois son e-mail vérifié.
const crypto = require('crypto');
const router = require('express').Router();
const { PUBLIC_URL, APP_SECRET } = require('../config');
const { getUsers, saveUsers } = require('../db');
const { requireAuth, tooManyAttempts, clientIp } = require('../security');

// Code lisible, sans caractères ambigus (0/O, 1/I)
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function makeCode(seed) {
    const bytes = crypto.createHmac('sha256', APP_SECRET).update('parrainage:' + seed).digest();
    return Array.from(bytes.subarray(0, 7), b => ALPHABET[b % ALPHABET.length]).join('');
}
function ensureReferralCode(user, users) {
    if (user.referralCode) return user.referralCode;
    let code = makeCode(user.id), n = 0;
    while (users.some(u => u.id !== user.id && u.referralCode === code)) code = makeCode(user.id + ':' + (++n));
    user.referralCode = code;
    return code;
}
function normCode(c) { return String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12); }
function findReferrer(users, code) {
    const c = normCode(code);
    return c ? users.find(u => u.referralCode === c) || null : null;
}
// À l'inscription : relie le nouveau compte à son parrain (jamais à lui-même)
function attachReferrer(users, newUser, code) {
    const ref = findReferrer(users, code);
    if (ref && ref.id !== newUser.id && ref.email !== newUser.email) newUser.referredBy = ref.id;
}

// Prénom du parrain, pour l'accueil « X vous invite »
router.get('/api/referral/:code', (req, res) => {
    if (tooManyAttempts('refcheck:' + clientIp(req), 60, 15 * 60 * 1000)) return res.status(429).json({ success: false });
    const ref = findReferrer(getUsers(), req.params.code);
    if (!ref) return res.status(404).json({ success: false, message: 'Code d’invitation inconnu.' });
    res.json({ success: true, firstName: ref.firstName || 'Un membre' });
});

router.get('/api/user/referral', requireAuth, (req, res) => {
    const user = req.user;
    const had = !!user.referralCode;
    const code = ensureReferralCode(user, req.users);
    if (!had) saveUsers(req.users);
    const filleuls = req.users.filter(u => u.referredBy === user.id);
    const verified = filleuls.filter(u => u.isVerified);
    res.json({
        success: true, code, link: `${PUBLIC_URL}/?parrain=${code}`,
        count: verified.length, pending: filleuls.length - verified.length,
        // Seulement le prénom et l'initiale : rien d'autre sur les filleuls
        recent: verified.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).slice(0, 10)
            .map(u => ({ name: `${u.firstName || ''} ${(u.lastName || '').charAt(0)}.`.trim(), at: u.createdAt }))
    });
});

module.exports = router;
module.exports.attachReferrer = attachReferrer;
