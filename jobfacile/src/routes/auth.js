// Routes de compte : inscription, vérification de l’e-mail, connexion, double authentification, Google, mot de passe oublié.
const crypto = require('crypto');
const speakeasy = require('speakeasy');
const router = require('express').Router();
require('../config');
const { getUsers, saveUsers } = require('../db');
const { sendCodeEmail } = require('../mailer');
const { ipLimit, hashPassword, verifyPassword, genCode, publicUser, sha256, createSession, requireAuth, clientIp, tooManyAttempts, isTrustedDevice, trustDevice } = require('../security');
const { normEmail, findUserIndex } = require('../utils');

router.post('/api/check-email', (req, res) => {
    res.json({ exists: findUserIndex(getUsers(), req.body.email) !== -1 });
});

// ---------- Inscription / connexion ----------
router.post('/api/register', ipLimit('register'), async (req, res) => {
    const { firstName, lastName, gender, birthDate, phone, password } = req.body;
    const email = normEmail(req.body.email);

    if (!firstName || !lastName || !gender || !birthDate || !email || !phone || !password) {
        return res.status(400).json({ success: false, message: 'Tous les champs sont obligatoires.' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ success: false, message: 'Adresse e-mail invalide.' });
    if (String(password).length < 8) return res.status(400).json({ success: false, message: 'Le mot de passe doit contenir au moins 8 caractères.' });
    if (!req.body.acceptTerms) return res.status(400).json({ success: false, message: 'Veuillez accepter la politique de confidentialité.' });

    const users = getUsers();
    if (findUserIndex(users, email) !== -1) {
        return res.status(400).json({ success: false, message: 'Cet email est déjà utilisé.' });
    }

    const verificationCode = genCode();
    const newUser = {
        id: 'user-' + Date.now() + crypto.randomInt(1000, 10000),
        firstName: String(firstName).trim(), lastName: String(lastName).trim(), gender, birthDate, email, phone,
        password: hashPassword(password),
        skills: [], experience: [], education: [], cvText: '', cvPdfUrl: '', avatarUrl: '',
        ipAddress: clientIp(req), isVerified: false, verificationCode,
        favorites: [], searchHistory: [], twoFactorSecret: null, isTwoFactorEnabled: false, trustedDevices: [], sessions: [],
        termsAcceptedAt: new Date().toISOString(),
        createdAt: new Date().toISOString()
    };
    require('./referral').attachReferrer(users, newUser, req.body.referralCode);
    users.push(newUser);
    saveUsers(users);

    await sendCodeEmail(email, '🔑 Votre code de vérification JobFacile', `Votre code de validation : ${verificationCode}`);
    res.json({ success: true, message: 'Compte créé ! Code envoyé par e-mail.', email });
});

router.post('/api/resend-code', async (req, res) => {
    const users = getUsers();
    const idx = findUserIndex(users, req.body.email);
    if (idx === -1 || users[idx].isVerified) return res.json({ success: true });
    if (tooManyAttempts('resend:' + normEmail(req.body.email), 5)) return res.status(429).json({ success: false, message: 'Trop de demandes, réessayez plus tard.' });
    users[idx].verificationCode = genCode();
    saveUsers(users);
    await sendCodeEmail(users[idx].email, '🔑 Votre code de vérification JobFacile', `Votre code de validation : ${users[idx].verificationCode}`);
    res.json({ success: true, message: 'Nouveau code envoyé.' });
});

router.post('/api/verify-code', ipLimit('verify'), (req, res) => {
    const { email, code } = req.body;
    if (tooManyAttempts('verify:' + normEmail(email))) return res.status(429).json({ success: false, message: 'Trop de tentatives, réessayez dans 15 minutes.' });
    const users = getUsers();
    const idx = findUserIndex(users, email);
    if (idx === -1) return res.status(404).json({ success: false, message: 'Utilisateur non trouvé.' });
    const user = users[idx];

    if (user.verificationCode && user.verificationCode === String(code || '').trim()) {
        user.isVerified = true;
        user.verificationCode = null;
        const token = createSession(user);
        saveUsers(users);
        return res.json({ success: true, user: publicUser(user), token });
    }
    return res.status(400).json({ success: false, message: 'Code incorrect.' });
});

router.post('/api/login', ipLimit('login'), async (req, res) => {
    const { email, password } = req.body;
    if (tooManyAttempts('login:' + normEmail(email))) return res.status(429).json({ success: false, message: 'Trop de tentatives, réessayez dans 15 minutes.' });
    const users = getUsers();
    const idx = findUserIndex(users, email);
    const user = idx === -1 ? null : users[idx];
    if (user && !user.password && user.googleId) return res.status(400).json({ success: false, message: 'Ce compte utilise « Continuer avec Google ». Vous pouvez aussi créer un mot de passe via « Mot de passe oublié ».' });
    if (!user || !verifyPassword(user, password)) return res.status(400).json({ success: false, message: 'Email ou mot de passe incorrect.' });

    if (!user.isVerified) {
        user.verificationCode = genCode();
        saveUsers(users);
        await sendCodeEmail(user.email, '🔑 Votre code de vérification JobFacile', `Votre code de validation : ${user.verificationCode}`);
        return res.json({ success: true, requireVerification: true, email: user.email, message: 'Compte non vérifié : un nouveau code vous a été envoyé.' });
    }

    // Navigateur inconnu : code de double authentification ; appareil enregistré (30 jours) : connexion directe
    if (user.isTwoFactorEnabled && !isTrustedDevice(user, req)) {
        saveUsers(users); // conserve une éventuelle migration du mot de passe
        return res.json({ success: true, require2FA: true, email: user.email });
    }

    user.ipAddress = clientIp(req);
    const token = createSession(user);
    saveUsers(users);
    res.json({ success: true, user: publicUser(user), token });
});

router.post('/api/login-2fa', ipLimit('login'), (req, res) => {
    const { email, password, token, rememberDevice } = req.body;
    if (tooManyAttempts('2fa:' + normEmail(email))) return res.status(429).json({ success: false, message: 'Trop de tentatives, réessayez dans 15 minutes.' });

    const users = getUsers();
    const idx = findUserIndex(users, email);
    if (idx === -1) return res.status(404).json({ success: false, message: 'Utilisateur introuvable.' });
    const user = users[idx];
    // Le mot de passe (ou un ticket Google de 5 minutes) est revérifié : le code 2FA seul ne suffit pas
    const g = user.google2fa;
    const googleOk = req.body.googleTicket && g && g.hash === sha256(String(req.body.googleTicket)) && new Date(g.expiresAt) > new Date();
    if (!googleOk && !verifyPassword(user, password)) return res.status(400).json({ success: false, message: 'Email ou mot de passe incorrect.' });
    if (!user.twoFactorSecret) return res.status(400).json({ success: false, message: 'Double authentification non configurée.' });

    const verified = speakeasy.totp.verify({ secret: user.twoFactorSecret, encoding: 'base32', token: String(token || '').trim(), window: 1 });
    if (!verified) return res.status(400).json({ success: false, message: 'Code d’authentification invalide.' });

    // « Enregistrer cet appareil » : plus de code demandé sur ce navigateur pendant 30 jours
    const newDeviceToken = rememberDevice ? trustDevice(user, req) : null;

    user.google2fa = null;
    user.ipAddress = clientIp(req);
    const sessionToken = createSession(user);
    saveUsers(users);
    res.json({ success: true, user: publicUser(user), token: sessionToken, deviceToken: newDeviceToken });
});

// ---------- Connexion avec Google (Google Identity Services) ----------
// Il faut un identifiant client OAuth « Application Web » : GOOGLE_CLIENT_ID dans .env.
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
let googleClient = null;
if (GOOGLE_CLIENT_ID) { const { OAuth2Client } = require('google-auth-library'); googleClient = new OAuth2Client(GOOGLE_CLIENT_ID); }

router.get('/api/config', (req, res) => res.json({ googleClientId: GOOGLE_CLIENT_ID || null }));

router.post('/api/auth/google', async (req, res) => {
    if (!googleClient) return res.status(503).json({ success: false, message: 'Connexion Google non configurée.' });
    if (tooManyAttempts('google:' + clientIp(req), 30)) return res.status(429).json({ success: false, message: 'Trop de tentatives, réessayez dans 15 minutes.' });
    let p;
    try {
        const ticket = await googleClient.verifyIdToken({ idToken: String(req.body.credential || ''), audience: GOOGLE_CLIENT_ID });
        p = ticket.getPayload();
    } catch (e) {
        return res.status(401).json({ success: false, message: 'Connexion Google refusée. Réessayez.' });
    }
    if (!p || !p.email || !p.email_verified) return res.status(400).json({ success: false, message: 'Votre adresse Google n’est pas vérifiée.' });

    const users = getUsers();
    let user = users.find(u => u.googleId === p.sub) || users[findUserIndex(users, p.email)];
    let created = false;
    if (user) {
        // Compte existant avec la même adresse vérifiée par Google : on le relie
        if (!user.googleId) user.googleId = p.sub;
        user.isVerified = true;
    } else {
        created = true;
        user = {
            id: 'user-' + Date.now() + crypto.randomInt(1000),
            firstName: String(p.given_name || p.name || '').trim().slice(0, 60) || 'Candidat',
            lastName: String(p.family_name || '').trim().slice(0, 60),
            gender: 'A', birthDate: '', email: normEmail(p.email), phone: '',
            password: null, googleId: p.sub,
            skills: [], experience: [], education: [], cvText: '', cvPdfUrl: '', avatarUrl: '',
            ipAddress: clientIp(req), isVerified: true, verificationCode: null,
            favorites: [], searchHistory: [], twoFactorSecret: null, isTwoFactorEnabled: false, trustedDevices: [], sessions: [],
            termsAcceptedAt: new Date().toISOString(), createdAt: new Date().toISOString()
        };
        require('./referral').attachReferrer(users, user, req.body.referralCode);
        users.push(user);
    }
    if (user.isTwoFactorEnabled && !isTrustedDevice(user, req)) {
        const t = crypto.randomBytes(24).toString('hex');
        user.google2fa = { hash: sha256(t), expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString() };
        saveUsers(users);
        return res.json({ success: true, require2FA: true, email: user.email, googleTicket: t });
    }
    user.ipAddress = clientIp(req);
    const token = createSession(user);
    saveUsers(users);
    res.json({ success: true, user: publicUser(user), token, created });
});

router.post('/api/logout', requireAuth, (req, res) => {
    req.user.sessions = (req.user.sessions || []).filter(s => s.hash !== req.tokenHash);
    saveUsers(req.users);
    res.json({ success: true });
});

router.get('/api/me', requireAuth, (req, res) => {
    res.json({ success: true, user: publicUser(req.user) });
});

// ---------- Mot de passe oublié ----------
router.post('/api/forgot-password', ipLimit('forgot'), async (req, res) => {
    const email = normEmail(req.body.email);
    if (!email) return res.status(400).json({ success: false, message: 'Indiquez votre adresse e-mail.' });
    if (tooManyAttempts('forgot:' + email, 5)) return res.status(429).json({ success: false, message: 'Trop de demandes, réessayez dans 15 minutes.' });
    const users = getUsers();
    const idx = findUserIndex(users, email);
    // Même réponse que le compte existe ou non (ne pas révéler les e-mails inscrits)
    const reply = { success: true, message: 'Si un compte existe avec cette adresse, un code vient de vous être envoyé.' };
    if (idx === -1) return res.json(reply);
    const code = genCode();
    users[idx].resetCode = code;
    users[idx].resetExpires = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    saveUsers(users);
    await sendCodeEmail(users[idx].email, '🔑 Réinitialisation de votre mot de passe JobFacile', `Votre code de réinitialisation : ${code} (valable 15 minutes).`);
    res.json(reply);
});

router.post('/api/reset-password', ipLimit('verify'), (req, res) => {
    const email = normEmail(req.body.email);
    const code = String(req.body.code || '').trim();
    const { newPassword, confirmPassword } = req.body;
    if (tooManyAttempts('reset:' + email)) return res.status(429).json({ success: false, message: 'Trop de tentatives, réessayez dans 15 minutes.' });
    if (!newPassword || String(newPassword).length < 8) return res.status(400).json({ success: false, message: 'Le mot de passe doit contenir au moins 8 caractères.' });
    if (newPassword !== confirmPassword) return res.status(400).json({ success: false, message: 'Les mots de passe ne correspondent pas.' });
    const users = getUsers();
    const idx = findUserIndex(users, email);
    const user = idx === -1 ? null : users[idx];
    const valid = user && user.resetCode && user.resetCode === code && user.resetExpires && new Date(user.resetExpires) > new Date();
    if (!valid) return res.status(400).json({ success: false, message: 'Code incorrect ou expiré.' });
    user.password = hashPassword(newPassword);
    user.resetCode = null;
    user.resetExpires = null;
    user.isVerified = true;   // le code reçu par e-mail prouve l'adresse
    user.sessions = [];       // déconnecte tous les appareils
    user.trustedDevices = [];
    saveUsers(users);
    res.json({ success: true, message: 'Mot de passe modifié ! Vous pouvez vous connecter.' });
});

module.exports = router;
