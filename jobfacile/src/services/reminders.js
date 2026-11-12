// Rappels du suivi par e-mail (et notification) : entretien dans les prochaines 24 h, candidatures sans réponse à relancer.
// Les recruteurs ne transmettent pas leurs réponses à JobFacile : ces e-mails rappellent ce que VOUS avez noté dans « Mon suivi ».
// Un seul e-mail par jour au maximum, chaque élément n'est rappelé qu'une fois. Vérifié toutes les 20 minutes, entre 7 h et 21 h.
const crypto = require('crypto');
const { PUBLIC_URL, APP_SECRET } = require('../config');
const { getUsers, saveUsers } = require('../db');
const { sendEmail, simpleEmailHtml } = require('../mailer');
const { sendPushToUser } = require('./push');

const DAY = 24 * 3600 * 1000;
const RELANCE_AFTER_DAYS = 7;

// Lien de désinscription signé (pas besoin d'être connecté pour l'utiliser)
const reminderToken = (userId) => crypto.createHmac('sha256', APP_SECRET).update(`${userId}:tracker-reminders`).digest('hex').slice(0, 32);
function checkReminderToken(userId, token) {
    const expected = reminderToken(String(userId));
    return !!token && String(token).length === expected.length && crypto.timingSafeEqual(Buffer.from(String(token)), Buffer.from(expected));
}

// Ce qu'il faut rappeler à cet utilisateur maintenant (sans rien modifier)
function dueReminders(user, now = Date.now()) {
    const apps = Array.isArray(user.applications) ? user.applications : [];
    const interviews = apps.filter(a => {
        if (!a.interview || !a.interview.at || a.interview.remindedAt) return false;
        const t = new Date(a.interview.at).getTime();
        return t > now && t - now <= 26 * 3600 * 1000;
    });
    const relances = apps.filter(a => {
        if (a.status !== 'applied' || !a.appliedAt || a.relanceRemindedAt) return false;
        const lastContact = Math.max(new Date(a.appliedAt).getTime(), ...(a.followUps || []).map(d => new Date(d).getTime()));
        return now - lastContact >= RELANCE_AFTER_DAYS * DAY;
    });
    return { interviews, relances };
}

function frDateTime(local) {
    const d = new Date(local);
    return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }) + ' à ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}
const KIND = { onsite: 'sur place', video: 'en visio', phone: 'par téléphone' };

function reminderEmail(user, { interviews, relances }) {
    const e = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const rows = [
        ...interviews.map(a => [`🗓️ Entretien ${KIND[a.interview.kind] || ''}`, `${a.job.title} – ${a.job.company} · ${frDateTime(a.interview.at)}${a.interview.place ? ' · ' + a.interview.place : ''}`]),
        ...relances.map(a => ['✉️ À relancer', `${a.job.title} – ${a.job.company} (envoyée il y a ${Math.floor((Date.now() - new Date(a.appliedAt)) / DAY)} jours)`])
    ];
    const subject = interviews.length
        ? `🗓️ Rappel : entretien ${interviews.length > 1 ? `(${interviews.length})` : 'demain'}${relances.length ? ` et ${relances.length} relance${relances.length > 1 ? 's' : ''}` : ''}`
        : `✉️ ${relances.length} candidature${relances.length > 1 ? 's' : ''} à relancer`;
    const intro = `Bonjour ${e(user.firstName || '')},<br>voici ce qui vous attend dans votre suivi de candidatures.`;
    const note = [
        interviews.length ? 'Pour votre entretien : relisez l’annonce, préparez 2 ou 3 exemples concrets, et entraînez-vous avec le simulateur.' : '',
        relances.length ? 'Une relance courte et polie montre votre motivation : JobFacile peut la rédiger pour vous en un clic.' : ''
    ].filter(Boolean).join('<br>');
    const off = `${PUBLIC_URL}/api/tracker/reminders/unsubscribe?u=${encodeURIComponent(user.id)}&t=${reminderToken(user.id)}`;
    const html = simpleEmailHtml({
        title: 'Votre suivi de candidatures', intro, rows, note,
        ctaUrl: `${PUBLIC_URL}/suivi${interviews.length ? '?onglet=agenda' : ''}`, ctaLabel: 'Ouvrir mon suivi',
        footer: `Rappels envoyés parce que vous suivez vos candidatures sur JobFacile. <a href="${off}" style="color:#64748b">Ne plus recevoir ces rappels</a>`
    });
    const text = rows.map(([k, v]) => `${k} : ${v}`).join('\n') + `\n\n${PUBLIC_URL}/suivi\nNe plus recevoir ces rappels : ${off}`;
    return { subject, html, text };
}

let running = false;
async function checkTrackerReminders({ now = Date.now(), force = false } = {}) {
    if (running) return 0;
    running = true;
    let sent = 0;
    try {
        const hour = new Date(now).getHours();
        if (!force && (hour < 7 || hour >= 21)) return 0; // pas d'e-mails la nuit
        for (const candidate of getUsers()) {
            if (!candidate.isVerified || candidate.trackerEmails === false) continue;
            if (candidate.lastReminderAt && now - new Date(candidate.lastReminderAt).getTime() < 20 * 3600 * 1000) continue;
            if (!dueReminders(candidate, now).interviews.length && !dueReminders(candidate, now).relances.length) continue;

            // Relecture juste avant d'écrire (le compte a pu changer entre-temps)
            const users = getUsers();
            const user = users.find(u => u.id === candidate.id);
            if (!user) continue;
            const due = dueReminders(user, now);
            if (!due.interviews.length && !due.relances.length) continue;
            const mail = reminderEmail(user, due);
            const okMail = await sendEmail(user.email, mail.subject, mail.text, mail.html);
            const okPush = await sendPushToUser(user, {
                title: mail.subject,
                body: [...due.interviews.map(a => `Entretien : ${a.job.company} – ${frDateTime(a.interview.at)}`), ...due.relances.map(a => `À relancer : ${a.job.company}`)].slice(0, 3).join('\n'),
                url: due.interviews.length ? '/suivi?onglet=agenda' : '/suivi', tag: 'rappels-suivi'
            }).catch(() => 0);
            if (!okMail && !okPush) continue;
            const stamp = new Date(now).toISOString();
            due.interviews.forEach(a => { a.interview.remindedAt = stamp; });
            due.relances.forEach(a => { a.relanceRemindedAt = stamp; });
            user.lastReminderAt = stamp;
            saveUsers(users);
            sent++;
        }
    } finally { running = false; }
    return sent;
}

module.exports = { checkTrackerReminders, dueReminders, reminderToken, checkReminderToken };
