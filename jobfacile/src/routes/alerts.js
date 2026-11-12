// Routes des alertes e-mail et des notifications.
const crypto = require('crypto');
const router = require('express').Router();
const { PUBLIC_URL } = require('../config');
const { getUsers, saveUsers } = require('../db');
const { publicUser, requireAuth, tooManyAttempts } = require('../security');
const { unsubToken, alertLabel, deviceLabel, sendAlertConfirmation, sendPushConfirmation, runAlert } = require('../services/alerts');
const { runJobSearch } = require('../services/jobSearch');
const { VAPID, sendPushToUser } = require('../services/push');
const { fold } = require('../utils');

router.get('/api/push/key', (req, res) => {
    if (!VAPID) return res.status(503).json({ success: false, message: 'Notifications indisponibles sur ce serveur.' });
    res.json({ success: true, publicKey: VAPID.publicKey });
});

router.post('/api/user/push/subscribe', requireAuth, (req, res) => {
    const sub = req.body.subscription;
    if (!sub || typeof sub.endpoint !== 'string' || !/^https:\/\//.test(sub.endpoint) || !sub.keys || !sub.keys.p256dh || !sub.keys.auth) {
        return res.status(400).json({ success: false, message: 'Abonnement invalide.' });
    }
    const user = req.user;
    const clean = { endpoint: sub.endpoint.slice(0, 1000), expirationTime: null, keys: { p256dh: String(sub.keys.p256dh).slice(0, 200), auth: String(sub.keys.auth).slice(0, 100) } };
    const isNewDevice = !(user.pushSubscriptions || []).some(s => s.endpoint === clean.endpoint);
    user.pushSubscriptions = (user.pushSubscriptions || []).filter(s => s.endpoint !== clean.endpoint);
    user.pushSubscriptions.push(clean);
    user.pushSubscriptions = user.pushSubscriptions.slice(-5); // 5 appareils maximum
    saveUsers(req.users);
    // E-mail de confirmation (uniquement pour un nouvel appareil)
    if (isNewDevice) sendPushConfirmation(user, deviceLabel(req.headers['user-agent']));
    res.json({ success: true, message: isNewDevice ? 'Notifications activées sur cet appareil 🔔 Un e-mail de confirmation vous a été envoyé.' : 'Notifications déjà actives sur cet appareil 🔔', user: publicUser(user) });
});

router.post('/api/user/push/unsubscribe', requireAuth, (req, res) => {
    const user = req.user;
    const endpoint = String(req.body.endpoint || '');
    user.pushSubscriptions = (user.pushSubscriptions || []).filter(s => s.endpoint !== endpoint);
    saveUsers(req.users);
    res.json({ success: true, message: 'Notifications désactivées sur cet appareil.', user: publicUser(user) });
});

router.post('/api/user/push/test', requireAuth, async (req, res) => {
    if (tooManyAttempts('pushtest:' + req.user.id, 5, 60 * 60 * 1000)) return res.status(429).json({ success: false, message: 'Trop de tests, réessayez dans une heure.' });
    const n = await sendPushToUser(req.user, {
        title: 'JobFacile 🔔',
        body: `Bravo ${req.user.firstName}, les notifications fonctionnent ! Vous serez prévenu(e) des nouvelles offres.`,
        url: '/suivi?onglet=alertes',
        tag: 'jobfacile-test'
    });
    saveUsers(req.users);
    res.json(n ? { success: true, message: 'Notification de test envoyée.' } : { success: false, message: 'Aucun appareil abonné. Activez d’abord les notifications.' });
});

router.post('/api/user/alerts', requireAuth, async (req, res) => {
    const user = req.user;
    const b = req.body;
    user.alerts = Array.isArray(user.alerts) ? user.alerts : [];
    const s = (v, max) => String(v ?? '').trim().slice(0, max);

    if (b.action === 'create') {
        const alert = {
            id: 'al-' + crypto.randomBytes(6).toString('hex'),
            keyword: s(b.keyword, 100), location: s(b.location, 80),
            radius: [5, 10, 20, 30, 50, 100].includes(parseInt(b.radius)) ? parseInt(b.radius) : 20,
            type: ['all', 'emploi', 'alternance'].includes(b.type) ? b.type : 'all',
            remote: !!b.remote, frequency: b.frequency === 'weekly' ? 'weekly' : 'daily',
            active: true, createdAt: new Date().toISOString(), lastRunAt: null, lastSentAt: null, seenIds: []
        };
        if (!alert.keyword && !alert.location) return res.status(400).json({ success: false, message: 'Indiquez au moins un métier ou une ville.' });
        const same = user.alerts.find(a => fold(a.keyword) === fold(alert.keyword) && fold(a.location) === fold(alert.location) && a.radius === alert.radius && a.type === alert.type && a.remote === alert.remote);
        if (same) { same.active = true; saveUsers(req.users); return res.json({ success: true, message: 'Cette alerte existe déjà : elle est active.', user: publicUser(user) }); }
        if (user.alerts.length >= 5) return res.status(400).json({ success: false, message: 'Maximum 5 alertes. Supprimez-en une pour en créer une nouvelle.' });
        // Les offres déjà visibles aujourd'hui ne seront pas renvoyées par e-mail
        user.alerts.push(alert);
        saveUsers(req.users);
        // E-mail de confirmation de l'abonnement à l'alerte
        sendAlertConfirmation(user, alert);
        res.json({ success: true, message: `Alerte créée : vous recevrez les nouvelles offres ${alert.frequency === 'weekly' ? 'chaque semaine' : 'chaque jour'}. Un e-mail de confirmation vous a été envoyé.`, user: publicUser(user) });
        runJobSearch({ keyword: alert.keyword, location: alert.location, radius: alert.radius, type: alert.type, remote: alert.remote, page: 1, limit: 20, days: 1, time: 'all', ttl: 3 * 3600 * 1000 })
            .then(d => {
                if (d.demo) return;
                const users = getUsers(); const u = users.find(x => x.id === user.id); const a = u && (u.alerts || []).find(x => x.id === alert.id);
                if (a) { a.seenIds = d.jobs.map(j => j.id); a.lastRunAt = new Date().toISOString(); saveUsers(users); }
            }).catch(() => {});
        return;
    }

    const alert = user.alerts.find(a => a.id === b.id);
    if (!alert) return res.status(404).json({ success: false, message: 'Alerte introuvable.' });
    if (b.action === 'delete') {
        user.alerts = user.alerts.filter(a => a.id !== b.id);
        saveUsers(req.users);
        return res.json({ success: true, message: 'Alerte supprimée.', user: publicUser(user) });
    }
    if (b.action === 'update') {
        if (['daily', 'weekly'].includes(b.frequency)) alert.frequency = b.frequency;
        if (b.active !== undefined) alert.active = !!b.active;
        saveUsers(req.users);
        return res.json({ success: true, message: 'Alerte mise à jour.', user: publicUser(user) });
    }
    if (b.action === 'preview') {
        if (tooManyAttempts('alertpreview:' + user.id, 5, 60 * 60 * 1000)) return res.status(429).json({ success: false, message: 'Trop d’aperçus, réessayez dans une heure.' });
        try {
            const n = await runAlert(user.id, alert.id, { preview: true });
            const fresh = getUsers().find(u => u.id === user.id);
            return res.json({ success: true, message: n ? `Aperçu envoyé à ${user.email} (${n} offre${n > 1 ? 's' : ''}).` : 'Aucune offre récente pour cette alerte pour le moment.', user: publicUser(fresh) });
        } catch (e) {
            return res.status(502).json({ success: false, message: 'Envoi impossible pour le moment.' });
        }
    }
    res.status(400).json({ success: false, message: 'Action inconnue.' });
});

// Lien « Ne plus recevoir cette alerte » (sans connexion)
router.get('/api/alerts/unsubscribe', (req, res) => {
    const { u, a, t } = req.query;
    const page = (title, msg) => res.send(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} – JobFacile</title></head>
        <body style="font-family:Arial,sans-serif;background:#f1f5f9;display:grid;place-items:center;min-height:100vh;margin:0;padding:16px">
        <div style="background:#fff;border-radius:16px;padding:32px;max-width:420px;text-align:center">
        <div style="font-size:40px">🔕</div><h1 style="font-size:20px;color:#0f172a">${title}</h1><p style="color:#64748b">${msg}</p>
        <a href="${PUBLIC_URL}/" style="display:inline-block;margin-top:12px;background:#059669;color:#fff;text-decoration:none;font-weight:700;padding:10px 18px;border-radius:10px">Retour à JobFacile</a></div></body></html>`);
    const expected = unsubToken(String(u), String(a));
    if (!t || String(t).length !== expected.length || !crypto.timingSafeEqual(Buffer.from(String(t)), Buffer.from(expected))) return page('Lien invalide', 'Ce lien de désinscription n’est pas valide.');
    const users = getUsers();
    const user = users.find(x => x.id === u);
    const alert = user && (user.alerts || []).find(x => x.id === a);
    if (!alert) return page('Alerte introuvable', 'Cette alerte a déjà été supprimée.');
    alert.active = false;
    saveUsers(users);
    page('Alerte désactivée', `Vous ne recevrez plus l’alerte « ${String(alertLabel(alert)).replace(/[<>&"]/g, '')} ». Vous pouvez la réactiver depuis « Mon suivi ».`);
});

// Désinscription des rappels du suivi (lien signé présent dans chaque e-mail)
router.get('/api/tracker/reminders/unsubscribe', (req, res) => {
    const { checkReminderToken } = require('../services/reminders');
    const page = (title, msg) => res.send(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} – JobFacile</title></head>
        <body style="font-family:Arial,sans-serif;background:#f1f5f9;display:grid;place-items:center;min-height:100vh;margin:0;padding:16px">
        <div style="background:#fff;border-radius:16px;padding:32px;max-width:420px;text-align:center">
        <div style="font-size:40px">🔕</div><h1 style="font-size:20px;color:#0f172a">${title}</h1><p style="color:#64748b">${msg}</p>
        <a href="${PUBLIC_URL}/" style="display:inline-block;margin-top:12px;background:#059669;color:#fff;text-decoration:none;font-weight:700;padding:10px 18px;border-radius:10px">Retour à JobFacile</a></div></body></html>`);
    if (!checkReminderToken(req.query.u, req.query.t)) return page('Lien invalide', 'Ce lien de désinscription n’est pas valide.');
    const users = getUsers();
    const user = users.find(x => x.id === String(req.query.u));
    if (!user) return page('Compte introuvable', 'Ce compte n’existe plus.');
    user.trackerEmails = false;
    saveUsers(users);
    page('Rappels désactivés', 'Vous ne recevrez plus les rappels de votre suivi. Vous pouvez les réactiver dans « Mon suivi » → Alertes.');
});

module.exports = router;
