// État des services dont dépend JobFacile (sources d'offres, IA, e-mails, voix, base de données).
// Vérifié au plus toutes les 5 minutes. Le public voit les voyants ; les administrateurs voient aussi le détail.
const fs = require('fs');
const path = require('path');
const { GROQ_API_KEY, DATA_DIR } = require('../config');
const { db } = require('../db');
const { transporter } = require('../mailer');
const J = require('./jobSearch');
const { VAPID } = require('./push');
const { lastBackup } = require('./backup');

const TTL = 5 * 60 * 1000;
let cache = null, running = null;
const ago = (t) => { const m = Math.round((Date.now() - t) / 60000); return m < 1 ? 'à l’instant' : m < 60 ? `il y a ${m} min` : `il y a ${Math.round(m / 60)} h`; };

async function timed(fn, ms = 8000) {
    return Promise.race([fn(), new Promise((_, rej) => setTimeout(() => rej(new Error('pas de réponse en ' + ms / 1000 + ' s')), ms))]);
}
// Source d'offres : on ne l'interroge pas exprès (quotas) ; on s'appuie sur les dernières recherches
function provider(name, configured) {
    if (!configured) return { state: 'off', detail: 'Non configurée (clé absente du fichier .env).' };
    const down = J.providerDown.get(name), ok = J.providerOk.get(name);
    if (down && (!ok || down.at > ok)) return { state: 'down', detail: `${down.message} (${ago(down.at)})` };
    if (ok) return { state: 'ok', detail: `Dernière recherche réussie ${ago(ok)}.` };
    return { state: 'unknown', detail: 'Pas encore utilisée depuis le démarrage du serveur.' };
}

async function collect() {
    const s = {};
    // France Travail : obtenir un jeton ne coûte rien
    if (!J.FT_CLIENT_ID) s.franceTravail = { state: 'off', detail: 'Non configurée.' };
    else {
        try { await timed(() => J.getFtToken()); s.franceTravail = provider('France Travail', true); if (s.franceTravail.state === 'unknown') s.franceTravail = { state: 'ok', detail: 'Connexion acceptée.' }; }
        catch (e) { s.franceTravail = { state: 'down', detail: e.message }; }
    }
    s.adzuna = provider('Adzuna', !!(J.ADZUNA_APP_ID && J.ADZUNA_APP_KEY));
    s.jsearch = provider('JSearch', !!J.RAPIDAPI_KEY);
    // IA (Groq) : la liste des modèles ne consomme pas de crédits
    if (!GROQ_API_KEY) s.ai = { state: 'off', detail: 'Clé GROQ_API_KEY absente.' };
    else {
        try {
            const r = await timed(() => fetch('https://api.groq.com/openai/v1/models', { headers: { Authorization: 'Bearer ' + GROQ_API_KEY } }));
            s.ai = r.ok ? { state: 'ok', detail: 'Clé acceptée.' } : { state: 'down', detail: `Groq a répondu ${r.status}${r.status === 401 ? ' (clé refusée)' : ''}.` };
        } catch (e) { s.ai = { state: 'down', detail: e.message }; }
    }
    // E-mails : connexion au serveur d'envoi
    if (!transporter) s.email = { state: 'off', detail: 'EMAIL_USER / EMAIL_PASS absents : les codes sont affichés dans la console du serveur.' };
    else {
        try { await timed(() => transporter.verify(), 10000); s.email = { state: 'ok', detail: 'Connexion au serveur d’envoi réussie.' }; }
        catch (e) { s.email = { state: 'down', detail: e.message.slice(0, 200) }; }
    }
    // Voix naturelle (ElevenLabs)
    const v = require('../routes/voice').voiceState();
    s.voice = !v.configured ? { state: 'off', detail: 'Pas de clé : voix du navigateur utilisée.' }
        : v.downUntil > Date.now() ? { state: 'down', detail: 'Refus récent (quota ou clé) : voix du navigateur en attendant.' } : { state: 'ok', detail: 'Configurée.' };
    s.push = VAPID ? { state: 'ok', detail: 'Clés de notification prêtes.' } : { state: 'down', detail: 'Clés de notification indisponibles.' };
    // Base de données et sauvegardes
    try {
        const users = db.prepare('SELECT COUNT(*) AS n FROM users').get().n;
        const size = fs.statSync(path.join(DATA_DIR, 'jobfacile.db')).size;
        const b = lastBackup();
        const stale = !b || Date.now() - new Date(b.at).getTime() > 36 * 3600 * 1000;
        s.database = { state: stale ? 'warn' : 'ok', detail: `${users} compte(s), ${(size / 1048576).toFixed(1)} Mo. ${b ? `Dernière sauvegarde ${ago(new Date(b.at).getTime())} (${b.count} gardée(s)).` : 'Aucune sauvegarde pour l’instant.'}` };
    } catch (e) { s.database = { state: 'down', detail: e.message }; }
    return { checkedAt: new Date().toISOString(), services: s };
}
async function getStatus({ refresh = false } = {}) {
    if (!refresh && cache && Date.now() - new Date(cache.checkedAt).getTime() < TTL) return cache;
    if (!running) running = collect().then(r => { cache = r; return r; }).finally(() => { running = null; });
    return running;
}

const LABELS = {
    franceTravail: ['Offres France Travail', 'Source officielle des offres d’emploi'], adzuna: ['Offres Adzuna', 'Source d’offres complémentaire'],
    jsearch: ['Offres JSearch', 'Source de secours'], ai: ['Intelligence artificielle', 'CV, lettres, entretiens, analyses'],
    email: ['E-mails', 'Codes de connexion, alertes, rappels'], voice: ['Voix naturelle', 'Entretien vocal'],
    push: ['Notifications', 'Alertes sur téléphone et ordinateur'], database: ['Comptes et données', 'Base de données et sauvegardes']
};
module.exports = { getStatus, LABELS };
