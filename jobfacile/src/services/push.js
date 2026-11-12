// Notifications sur téléphone / ordinateur (Web Push).
const fs = require('fs');
const path = require('path');
const { DATA_DIR, EMAIL_USER } = require('../config');

// ---------- Notifications sur téléphone / ordinateur (Web Push) ----------
const webpush = require('web-push');
const VAPID_FILE = path.join(DATA_DIR, 'vapid.json');
let VAPID = null;
try {
    if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
        VAPID = { publicKey: process.env.VAPID_PUBLIC_KEY, privateKey: process.env.VAPID_PRIVATE_KEY };
    } else {
        try { VAPID = JSON.parse(fs.readFileSync(VAPID_FILE, 'utf8')); } catch (e) {}
        if (!VAPID || !VAPID.publicKey) { VAPID = webpush.generateVAPIDKeys(); fs.writeFileSync(VAPID_FILE, JSON.stringify(VAPID), 'utf8'); }
    }
    // L'adresse de contact est demandée par les services de notification (Google, Mozilla, Apple)
    webpush.setVapidDetails(process.env.PUBLIC_URL && /^https:/.test(process.env.PUBLIC_URL) ? process.env.PUBLIC_URL : 'mailto:' + (EMAIL_USER || 'contact@jobfacile.fr'), VAPID.publicKey, VAPID.privateKey);
} catch (e) {
    console.warn('⚠️  Notifications indisponibles :', e.message);
    VAPID = null;
}

// Envoie une notification à tous les appareils d'un utilisateur. Renvoie le nombre d'appareils atteints.
async function sendPushToUser(user, payload) {
    if (!VAPID || !Array.isArray(user.pushSubscriptions) || !user.pushSubscriptions.length) return 0;
    let delivered = 0;
    const keep = [];
    for (const sub of user.pushSubscriptions) {
        try {
            await webpush.sendNotification(sub, JSON.stringify(payload), { TTL: 24 * 3600 });
            delivered++;
            keep.push(sub);
        } catch (e) {
            // 404 / 410 : l'appareil s'est désabonné → on l'oublie
            if (e.statusCode !== 404 && e.statusCode !== 410) { keep.push(sub); console.warn('⚠️  Notification :', e.statusCode || e.message); }
        }
    }
    user.pushSubscriptions = keep;
    return delivered;
}

module.exports = { sendPushToUser, VAPID };
