// Page « Contactez-nous » : le message est envoyé par e-mail à l'équipe (CONTACT_EMAIL, sinon EMAIL_USER).
const router = require('express').Router();
const { EMAIL_USER } = require('../config');
const { sendEmail } = require('../mailer');
const { tooManyAttempts, clientIp } = require('../security');

const CONTACT_EMAIL = process.env.CONTACT_EMAIL || EMAIL_USER || '';
const SUBJECTS = ['Question sur le site', 'Problème technique', 'Abonnement Premium', 'Recruteur / entreprise', 'Données personnelles (RGPD)', 'Partenariat', 'Autre'];

router.get('/api/contact', (req, res) => res.json({ success: true, email: process.env.CONTACT_EMAIL || null, subjects: SUBJECTS }));

router.post('/api/contact', async (req, res) => {
    const b = req.body || {};
    // Champ caché rempli = robot : on fait semblant d'accepter
    if (b.website) return res.json({ success: true, message: 'Message envoyé, merci !' });
    const name = String(b.name || '').trim().slice(0, 100);
    const email = String(b.email || '').trim().slice(0, 200);
    const subject = SUBJECTS.includes(b.subject) ? b.subject : 'Autre';
    const message = String(b.message || '').trim().slice(0, 5000);
    if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || message.length < 10) {
        return res.status(400).json({ success: false, message: 'Indiquez votre nom, un e-mail valide et un message (10 caractères au moins).' });
    }
    if (tooManyAttempts('contact:' + clientIp(req), 5, 60 * 60 * 1000)) return res.status(429).json({ success: false, message: 'Trop de messages envoyés. Réessayez dans une heure.' });
    if (!CONTACT_EMAIL) return res.status(503).json({ success: false, message: 'Le formulaire est momentanément indisponible.' });
    const text = `Nouveau message depuis la page Contact de JobFacile\n\nNom : ${name}\nE-mail : ${email}\nSujet : ${subject}\n\n${message}\n\n— Répondez directement à ${email}`;
    const ok = await sendEmail(CONTACT_EMAIL, `[Contact] ${subject} – ${name}`, text);
    if (!ok) return res.status(502).json({ success: false, message: 'Envoi impossible pour le moment. Réessayez plus tard.' });
    res.json({ success: true, message: 'Message envoyé, merci ! Nous vous répondons sous 48 h.' });
});

module.exports = router;
