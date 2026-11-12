// Routes du profil : informations, fichiers, double authentification, mot de passe, export et suppression (RGPD).
const fs = require('fs');
const path = require('path');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const router = require('express').Router();
const { UPLOADS_DIR } = require('../config');
const { saveUsers, deleteUser } = require('../db');
const { sendCodeEmail } = require('../mailer');
const { hashPassword, verifyPassword, genCode, publicUser, requireAuth, tooManyAttempts } = require('../security');
const { upload } = require('../uploads');
const { normEmail, findUserIndex } = require('../utils');

// ---------- Profil (connexion obligatoire) ----------
router.post('/api/user/update-profile-files', requireAuth, upload.fields([{ name: 'cvFile', maxCount: 1 }, { name: 'avatarFile', maxCount: 1 }]), (req, res) => {
    const { skills, experience, education, cvText } = req.body;
    const user = req.user;
    const parseList = (v) => { try { const a = JSON.parse(v); return Array.isArray(a) ? a : []; } catch (e) { return []; } };

    if (skills !== undefined) user.skills = parseList(skills).filter(s => typeof s === 'string').slice(0, 50);
    if (experience !== undefined) user.experience = parseList(experience).slice(0, 30);
    if (education !== undefined) user.education = parseList(education).slice(0, 30);
    if (cvText !== undefined) user.cvText = String(cvText);

    const removeOld = (url) => {
        if (!url || !url.startsWith('/uploads/')) return;
        const p = path.join(UPLOADS_DIR, path.basename(url));
        fs.unlink(p, () => {});
    };
    if (req.files) {
        if (req.files['cvFile']) { removeOld(user.cvPdfUrl); user.cvPdfUrl = `/uploads/${req.files['cvFile'][0].filename}`; }
        if (req.files['avatarFile']) { removeOld(user.avatarUrl); user.avatarUrl = `/uploads/${req.files['avatarFile'][0].filename}`; }
    }

    saveUsers(req.users);
    res.json({ success: true, user: publicUser(user), message: 'Profil mis à jour avec succès !' });
});

const CONTRACTS = ['CDI', 'CDD', 'Intérim', 'Alternance', 'Stage', 'Freelance', 'Saisonnier'];
// Codes acceptés pour le bloc « Permis, CACES & habilitations » (mêmes codes que dans index.html)
const QUALIF_CODES = {
    licenses: ['AM', 'A1', 'A2', 'A', 'B', 'BE', 'C1', 'C', 'CE', 'D', 'FIMO', 'FIMOV', 'ADR'],
    caces: ['R489-1A', 'R489-1B', 'R489-3', 'R489-5', 'R485', 'R486', 'R482', 'R490', 'R484', 'R487'],
    habilitations: ['B0H0', 'BS', 'B1V', 'BR', 'H1V', 'SST', 'PSC1', 'HAUTEUR', 'AIPR', 'HACCP', 'FEU', 'ATEX', 'SSIAP1', 'CQPAPS']
};
const AVAILABILITY = ['Immédiate', 'Sous 1 mois', 'Sous 3 mois', 'En poste, à l’écoute'];

router.post('/api/user/update', requireAuth, (req, res) => {
    const b = req.body;
    const users = req.users;
    const user = req.user;
    const s = (v, max) => String(v ?? '').trim().slice(0, max);

    // Changer d'e-mail = changer d'identifiant de connexion : mot de passe exigé
    const newEmail = normEmail(b.newEmail);
    if (newEmail && newEmail !== normEmail(user.email)) {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) return res.status(400).json({ success: false, message: 'Adresse e-mail invalide.' });
        if (findUserIndex(users, newEmail) !== -1) return res.status(400).json({ success: false, message: 'Email déjà pris.' });
        if (!verifyPassword(user, b.password)) return res.status(400).json({ success: false, message: 'Pour changer d’e-mail, saisissez votre mot de passe actuel.', needPassword: true });
        user.email = newEmail;
    }

    // Identité
    if (b.firstName !== undefined && s(b.firstName, 60)) user.firstName = s(b.firstName, 60);
    if (b.lastName !== undefined && s(b.lastName, 60)) user.lastName = s(b.lastName, 60);
    if (['H', 'F', 'A'].includes(b.gender)) user.gender = b.gender;
    if (b.birthDate !== undefined && /^\d{4}-\d{2}-\d{2}$/.test(b.birthDate)) user.birthDate = b.birthDate;
    if (b.phone !== undefined && s(b.phone, 30)) user.phone = s(b.phone, 30);

    // Coordonnées & présentation
    const homeBefore = [user.address, user.postalCode, user.city].join('|');
    if (b.city !== undefined) user.city = s(b.city, 80);
    if (b.postalCode !== undefined) user.postalCode = s(b.postalCode, 10);
    if (b.address !== undefined) user.address = s(b.address, 160);
    if ([user.address, user.postalCode, user.city].join('|') !== homeBefore) delete user.homeGeo; // domicile à re-géolocaliser
    if (b.headline !== undefined) user.headline = s(b.headline, 120);
    if (b.bio !== undefined) user.bio = s(b.bio, 800);
    if (b.linkedin !== undefined) { const u = s(b.linkedin, 300); user.linkedin = !u || /^https?:\/\//i.test(u) ? u : 'https://' + u; }
    if (b.portfolio !== undefined) { const u = s(b.portfolio, 300); user.portfolio = !u || /^https?:\/\//i.test(u) ? u : 'https://' + u; }

    // Recherche souhaitée
    if (b.desiredJob !== undefined) user.desiredJob = s(b.desiredJob, 120);
    if (Array.isArray(b.desiredContracts)) user.desiredContracts = b.desiredContracts.filter(c => CONTRACTS.includes(c));
    if (b.mobilityKm !== undefined) { const n = parseInt(b.mobilityKm); user.mobilityKm = [5, 10, 20, 30, 50, 100].includes(n) ? n : 20; }
    if (b.availability !== undefined) user.availability = AVAILABILITY.includes(b.availability) ? b.availability : '';
    if (b.remoteWanted !== undefined) user.remoteWanted = !!b.remoteWanted;
    if (b.salaryWanted !== undefined) user.salaryWanted = s(b.salaryWanted, 40);
    if (b.onboardingDone !== undefined) user.onboardingDone = !!b.onboardingDone;
    if (b.alertEmail !== undefined) user.alertEmail = !!b.alertEmail;
    if (b.trackerEmails !== undefined) user.trackerEmails = !!b.trackerEmails;

    // Atouts
    if (b.drivingLicense !== undefined) user.drivingLicense = !!b.drivingLicense;
    for (const g of Object.keys(QUALIF_CODES)) {
        if (Array.isArray(b[g])) user[g] = [...new Set(b[g].filter(c => QUALIF_CODES[g].includes(c)))];
    }
    if (Array.isArray(user.licenses)) user.drivingLicense = user.licenses.some(c => ['B', 'BE', 'C1', 'C', 'CE', 'D'].includes(c));
    if (Array.isArray(b.otherCertifs)) user.otherCertifs = b.otherCertifs.slice(0, 10).map(c => s(c, 60)).filter(Boolean);
    if (b.vehicle !== undefined) user.vehicle = !!b.vehicle;
    if (Array.isArray(b.languages)) {
        user.languages = b.languages.slice(0, 8)
            .map(l => ({ lang: s(l && l.lang, 40), level: s(l && l.level, 30) }))
            .filter(l => l.lang);
    }

    saveUsers(users);
    res.json({ success: true, user: publicUser(user), message: 'Informations mises à jour !' });
});

router.post('/api/user/2fa/setup', requireAuth, (req, res) => {
    const user = req.user;
    const secret = speakeasy.generateSecret({ name: `JobFacile (${user.email})` });
    user.tempTwoFactorSecret = secret.base32;
    saveUsers(req.users);

    QRCode.toDataURL(secret.otpauth_url, (err, data_url) => {
        if (err) return res.status(500).json({ success: false, message: 'Erreur QR Code.' });
        res.json({ success: true, qrCodeUrl: data_url, secret: secret.base32 });
    });
});

router.post('/api/user/2fa/enable', requireAuth, (req, res) => {
    const user = req.user;
    if (!user.tempTwoFactorSecret) return res.status(400).json({ success: false, message: 'Lancez d’abord la configuration.' });
    const verified = speakeasy.totp.verify({ secret: user.tempTwoFactorSecret, encoding: 'base32', token: String(req.body.token || '').trim(), window: 1 });
    if (!verified) return res.status(400).json({ success: false, message: 'Code incorrect.' });

    user.twoFactorSecret = user.tempTwoFactorSecret;
    user.tempTwoFactorSecret = null;
    user.isTwoFactorEnabled = true;
    saveUsers(req.users);
    res.json({ success: true, user: publicUser(user), message: 'Double authentification activée !' });
});

router.post('/api/user/2fa/disable', requireAuth, (req, res) => {
    const user = req.user;
    if (!verifyPassword(user, req.body.password)) return res.status(400).json({ success: false, message: 'Mot de passe incorrect.' });

    user.isTwoFactorEnabled = false;
    user.twoFactorSecret = null;
    user.trustedDevices = [];
    saveUsers(req.users);
    res.json({ success: true, user: publicUser(user), message: 'Double authentification désactivée.' });
});

router.post('/api/user/request-password-change', requireAuth, async (req, res) => {
    const { currentPassword, newPassword, confirmPassword } = req.body;
    const user = req.user;

    if (!verifyPassword(user, currentPassword)) return res.status(400).json({ success: false, message: 'Mot de passe actuel incorrect.' });
    if (!newPassword || newPassword !== confirmPassword) return res.status(400).json({ success: false, message: 'Les mots de passe ne correspondent pas.' });
    if (String(newPassword).length < 8) return res.status(400).json({ success: false, message: 'Le mot de passe doit contenir au moins 8 caractères.' });

    const securityCode = genCode();
    user.pendingPassword = hashPassword(newPassword);
    user.passwordChangeCode = securityCode;
    saveUsers(req.users);

    await sendCodeEmail(user.email, '🔒 Code de confirmation', `Votre code : ${securityCode}`);
    res.json({ success: true, message: 'Code de confirmation envoyé par e-mail.' });
});

router.post('/api/user/confirm-password-change', requireAuth, (req, res) => {
    const user = req.user;
    if (tooManyAttempts('pwchange:' + user.id)) return res.status(429).json({ success: false, message: 'Trop de tentatives, réessayez dans 15 minutes.' });
    if (!user.passwordChangeCode || user.passwordChangeCode !== String(req.body.code || '').trim()) return res.status(400).json({ success: false, message: 'Code incorrect.' });

    user.password = user.pendingPassword;
    user.pendingPassword = null;
    user.passwordChangeCode = null;
    saveUsers(req.users);
    res.json({ success: true, user: publicUser(user), message: 'Mot de passe modifié avec succès !' });
});

// ---------- RGPD : export et suppression des données ----------
router.get('/api/user/export', requireAuth, (req, res) => {
    const data = publicUser(req.user);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="mes-donnees-jobfacile.json"');
    res.send(JSON.stringify({ exportedAt: new Date().toISOString(), ...data }, null, 2));
});

router.post('/api/user/delete', requireAuth, (req, res) => {
    const user = req.user;
    const confirmed = user.password ? verifyPassword(user, req.body.password) : String(req.body.password || '').trim().toUpperCase() === 'SUPPRIMER';
    if (!confirmed) return res.status(400).json({ success: false, message: user.password ? 'Mot de passe incorrect.' : 'Tapez SUPPRIMER pour confirmer.' });
    // Suppression des fichiers envoyés (photo, CV)
    for (const url of [user.avatarUrl, user.cvPdfUrl]) {
        if (url && url.startsWith('/uploads/')) fs.unlink(path.join(UPLOADS_DIR, path.basename(url)), () => {});
    }
    deleteUser(user.id);
    res.json({ success: true, message: 'Votre compte et vos données ont été supprimés.' });
});

module.exports = router;
