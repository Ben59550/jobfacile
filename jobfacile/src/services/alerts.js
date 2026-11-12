// Alertes : nouvelles offres envoyées par e-mail et notification, vérifiées toutes les 20 minutes.
const crypto = require('crypto');
const { PUBLIC_URL, APP_SECRET } = require('../config');
const { getUsers, saveUsers } = require('../db');
const { transporter, sendEmail, simpleEmailHtml } = require('../mailer');
const { runJobSearch } = require('./jobSearch');
const { sendPushToUser } = require('./push');
const { fold } = require('../utils');

const unsubToken = (userId, alertId) => crypto.createHmac('sha256', APP_SECRET).update(`${userId}:${alertId}`).digest('hex').slice(0, 32);
const ALERT_FREQ = { daily: 24 * 3600 * 1000, weekly: 7 * 24 * 3600 * 1000 };

function alertLabel(a) {
    return [a.keyword || 'Toutes les offres', a.location ? `autour de ${a.location} (${a.radius} km)` : 'en France',
        a.type === 'alternance' ? '· alternance' : a.type === 'emploi' ? '· emploi' : '', a.remote ? '· télétravail' : ''].filter(Boolean).join(' ');
}

// Appareil lisible à partir du navigateur (ex. « Chrome sur Windows »)
function deviceLabel(ua = '') {
    const os = /iPhone|iPad/.test(ua) ? 'iPhone / iPad' : /Android/.test(ua) ? 'Android' : /Windows/.test(ua) ? 'Windows' : /Mac OS X/.test(ua) ? 'Mac' : /Linux/.test(ua) ? 'Linux' : 'appareil inconnu';
    const br = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'navigateur';
    return `${br} sur ${os}`;
}

function sendAlertConfirmation(user, alert) {
    const unsub = `${PUBLIC_URL}/api/alerts/unsubscribe?u=${encodeURIComponent(user.id)}&a=${encodeURIComponent(alert.id)}&t=${unsubToken(user.id, alert.id)}`;
    const channels = [user.alertEmail === false ? null : 'e-mail', (user.pushSubscriptions || []).length ? 'notification' : null].filter(Boolean).join(' + ') || 'e-mail';
    const rows = [
        ['Métier', alert.keyword || 'Toutes les offres'],
        ['Lieu', alert.location ? `${alert.location} (${alert.radius} km autour)` : 'Toute la France'],
        ['Contrat', alert.type === 'alternance' ? 'Alternance' : alert.type === 'emploi' ? 'Emploi' : 'Tous'],
        ...(alert.remote ? [['Télétravail', 'Oui']] : []),
        ['Fréquence', alert.frequency === 'weekly' ? 'Chaque semaine' : 'Chaque jour'],
        ['Envoi par', channels]
    ];
    const text = `Bonjour ${user.firstName}, votre alerte JobFacile est active : ${alertLabel(alert)}. Vous recevrez les nouvelles offres ${alert.frequency === 'weekly' ? 'chaque semaine' : 'chaque jour'}. Se désabonner : ${unsub}`;
    sendEmail(user.email, `✅ Alerte activée : ${alert.keyword || 'nouvelles offres'}${alert.location ? ' à ' + alert.location : ''}`, text, simpleEmailHtml({
        title: 'Votre alerte est activée ✅',
        intro: `Bonjour ${String(user.firstName).replace(/[<>&"]/g, '')}, c'est noté ! Nous vous enverrons les <strong>nouvelles offres</strong> correspondant à cette recherche, uniquement quand il y en a.`,
        rows,
        note: 'Vous pouvez modifier la fréquence, mettre en pause ou supprimer cette alerte à tout moment depuis « Mon suivi → Alertes ».',
        ctaUrl: `${PUBLIC_URL}/offres?q=${encodeURIComponent(alert.keyword || '')}&lieu=${encodeURIComponent(alert.location || '')}&rayon=${alert.radius}`,
        ctaLabel: 'Voir les offres maintenant',
        footer: `Vous n'êtes pas à l'origine de cette alerte ? <a href="${unsub}" style="color:#64748b">Ne plus recevoir cette alerte</a>`
    })).catch(() => {});
}

function sendPushConfirmation(user, device) {
    const when = new Date().toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' });
    const text = `Bonjour ${user.firstName}, les notifications JobFacile ont été activées sur ${device} le ${when}. Si ce n'est pas vous, changez votre mot de passe.`;
    sendEmail(user.email, '🔔 Notifications activées sur un nouvel appareil', text, simpleEmailHtml({
        title: 'Notifications activées 🔔',
        intro: `Bonjour ${String(user.firstName).replace(/[<>&"]/g, '')}, vous recevrez désormais vos alertes JobFacile <strong>en notification</strong> sur cet appareil, même quand le site est fermé.`,
        rows: [['Appareil', device], ['Date', when], ['Appareils abonnés', String((user.pushSubscriptions || []).length)]],
        note: 'Ce n’est pas vous ? Changez votre mot de passe dans « Mon profil → Sécurité & données » : cela déconnectera les autres appareils. Pour couper les notifications, rendez-vous dans « Mon suivi → Alertes ».',
        ctaUrl: `${PUBLIC_URL}/suivi?onglet=alertes`,
        ctaLabel: 'Gérer mes alertes'
    })).catch(() => {});
}

function alertEmailHtml(user, alert, jobs) {
    const e = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const unsub = `${PUBLIC_URL}/api/alerts/unsubscribe?u=${encodeURIComponent(user.id)}&a=${encodeURIComponent(alert.id)}&t=${unsubToken(user.id, alert.id)}`;
    const rows = jobs.map(j => `
        <tr><td style="padding:14px 0;border-bottom:1px solid #e2e8f0">
            <a href="${e(j.url || PUBLIC_URL + '/offres')}" style="font-size:16px;font-weight:700;color:#0f172a;text-decoration:none">${e(j.title)}</a>
            <div style="font-size:13px;color:#64748b;margin-top:2px">${e(j.company)} · 📍 ${e(j.location)}</div>
            <div style="font-size:12px;margin-top:6px">
                <span style="background:#ecfdf5;color:#047857;border-radius:999px;padding:2px 8px;font-weight:700">${e(j.type)}</span>
                ${j.salary ? `<span style="background:#fffbeb;color:#b45309;border-radius:999px;padding:2px 8px;font-weight:700;margin-left:4px">${e(j.salary)}</span>` : ''}
            </div>
        </td></tr>`).join('');
    return `<!doctype html><html><body style="margin:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 12px"><tr><td align="center">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden">
        <tr><td style="background:linear-gradient(135deg,#059669,#14b8a6);background-color:#059669;padding:24px">
            <div style="font-size:22px;font-weight:800;color:#ffffff">JobFacile</div>
            <div style="font-size:14px;color:#d1fae5;margin-top:4px">Bonjour ${e(user.firstName)}, ${jobs.length} nouvelle${jobs.length > 1 ? 's' : ''} offre${jobs.length > 1 ? 's' : ''} pour vous</div>
        </td></tr>
        <tr><td style="padding:8px 24px 0">
            <p style="font-size:13px;color:#64748b">Votre alerte : <strong style="color:#0f172a">${e(alertLabel(alert))}</strong></p>
            <table width="100%" cellpadding="0" cellspacing="0">${rows}</table>
            <p style="text-align:center;margin:24px 0"><a href="${PUBLIC_URL}/offres?q=${encodeURIComponent(alert.keyword || '')}&lieu=${encodeURIComponent(alert.location || '')}&rayon=${alert.radius}" style="background:#059669;color:#ffffff;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:12px;display:inline-block">Voir toutes les offres</a></p>
        </td></tr>
        <tr><td style="padding:16px 24px;background:#f8fafc;font-size:11px;color:#94a3b8;text-align:center">
            Vous recevez cet e-mail car vous avez créé une alerte sur JobFacile.<br>
            <a href="${unsub}" style="color:#64748b">Ne plus recevoir cette alerte</a>
        </td></tr>
    </table></td></tr></table></body></html>`;
}

// Exécute une alerte : cherche les nouvelles offres et envoie l'e-mail. Renvoie le nombre d'offres envoyées.
async function runAlert(userId, alertId, { preview = false } = {}) {
    let users = getUsers();
    let user = users.find(u => u.id === userId);
    let alert = user && (user.alerts || []).find(a => a.id === alertId);
    if (!user || !alert) return 0;
    const q = {
        keyword: alert.keyword, location: alert.location, radius: alert.radius, type: alert.type, remote: alert.remote,
        page: 1, limit: 20, days: alert.frequency === 'weekly' ? 7 : 1, time: 'all', ttl: 3 * 3600 * 1000
    };
    const data = await runJobSearch(q);
    if (data.demo) return 0;
    // Pour un e-mail, on ne garde que les offres dont l'intitulé correspond vraiment au métier de l'alerte
    const words = fold(alert.keyword).split(/[^a-z0-9]+/).filter(w => w.length >= 3).map(w => w.slice(0, 6));
    const relevant = words.length ? data.jobs.filter(j => words.some(w => fold(j.title).includes(w))) : data.jobs;
    const seen = new Set(alert.seenIds || []);
    const fresh = preview ? relevant.slice(0, 10) : relevant.filter(j => !seen.has(j.id)).slice(0, 10);

    // Relecture juste avant d'écrire (l'utilisateur a pu modifier son compte entre-temps)
    users = getUsers();
    user = users.find(u => u.id === userId);
    alert = user && (user.alerts || []).find(a => a.id === alertId);
    if (!user || !alert) return 0;
    alert.lastRunAt = new Date().toISOString();
    if (fresh.length) {
        let delivered = false;
        const pushed = await sendPushToUser(user, {
            title: `🔔 ${fresh.length} nouvelle${fresh.length > 1 ? 's' : ''} offre${fresh.length > 1 ? 's' : ''} : ${alert.keyword || 'votre alerte'}`,
            body: fresh.slice(0, 3).map(j => `${j.title} — ${j.location}`).join('\n'),
            url: `/offres?q=${encodeURIComponent(alert.keyword || '')}&lieu=${encodeURIComponent(alert.location || '')}&rayon=${alert.radius}`,
            tag: 'alerte-' + alert.id
        });
        if (pushed) delivered = true;
        const ok = user.alertEmail === false ? false : await sendEmail(user.email, `🔔 ${fresh.length} nouvelle${fresh.length > 1 ? 's' : ''} offre${fresh.length > 1 ? 's' : ''} : ${alert.keyword || 'votre alerte'}`,
            fresh.map(j => `${j.title} — ${j.company} (${j.location}) ${j.url || ''}`).join('\n'),
            alertEmailHtml(user, alert, fresh));
        if (ok || delivered || (!transporter && user.alertEmail !== false)) {
            alert.lastSentAt = alert.lastRunAt;
            alert.seenIds = [...fresh.map(j => j.id), ...(alert.seenIds || [])].slice(0, 300);
        }
    }
    saveUsers(users);
    return fresh.length;
}

let alertsRunning = false;
async function checkAlerts() {
    if (alertsRunning) return;
    alertsRunning = true;
    try {
        const hour = new Date().getHours();
        if (hour < 7 || hour >= 21) return; // pas d'e-mails la nuit
        const now = Date.now();
        for (const user of getUsers()) {
            if (!user.isVerified) continue;
            for (const alert of user.alerts || []) {
                if (alert.active === false) continue;
                const last = alert.lastRunAt ? new Date(alert.lastRunAt).getTime() : 0;
                if (now - last < (ALERT_FREQ[alert.frequency] || ALERT_FREQ.daily) - 30 * 60 * 1000) continue;
                try {
                    const n = await runAlert(user.id, alert.id);
                    if (n) console.log(`🔔 Alerte envoyée à ${user.firstName} : ${n} offre(s).`);
                } catch (e) { console.warn('⚠️  Alerte :', e.message); }
                await new Promise(r => setTimeout(r, 1500)); // ménage les API
            }
        }
    } finally { alertsRunning = false; }
}

module.exports = { checkAlerts, unsubToken, alertLabel, deviceLabel, sendAlertConfirmation, sendPushConfirmation, runAlert };
