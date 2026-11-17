// Modération des contenus publiés par les utilisateurs (offres de recruteurs, forum, messages).
//  - Administrateurs : adresses listées dans ADMIN_EMAILS (fichier .env), séparées par des virgules.
//  - Avant publication : coordonnées masquées sur le forum, puis vérification par l'IA (arnaques, insultes, données personnelles).
//  - Après publication : signalements ; 3 signalements de personnes différentes masquent le contenu en attendant un administrateur.
const { db } = require('../db');
const { callGroq } = require('./ai');
const { GROQ_API_KEY, IS_TEST } = require('../config');

const ADMIN_EMAILS = String(process.env.ADMIN_EMAILS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
function isAdmin(user) { return !!user && ADMIN_EMAILS.includes(String(user.email || '').toLowerCase()); }

db.exec(`
    CREATE TABLE IF NOT EXISTS reports (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        kind TEXT NOT NULL,            -- offer | topic | post | message
        target_id TEXT NOT NULL,
        reporter_id TEXT NOT NULL,
        reason TEXT,
        created_at TEXT NOT NULL,
        resolved_at TEXT,
        UNIQUE (kind, target_id, reporter_id)
    );
`);
const AUTO_HIDE_REPORTS = 3;

// Téléphones et e-mails masqués dans les contenus publics (protection des personnes et anti-démarchage)
function maskContacts(text) {
    return String(text)
        .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[e-mail masqué]')
        .replace(/(?:\+33|0033|\b0)\s*[1-9](?:[\s.-]*\d{2}){4}\b/g, '[téléphone masqué]');
}

// Signes classiques d'arnaque à l'emploi : vérifiés même sans IA
const SCAM_PATTERNS = [
    [/frais (d['’]inscription|de dossier|de formation) (à|a) (votre|ta) charge|payer? (des )?frais/i, 'demande de paiement au candidat'],
    [/western union|mandat cash|carte (pcs|neosurf|transcash)|bitcoin|crypto/i, 'moyen de paiement suspect'],
    [/(envoy|transmett)\w* (votre|ta|une copie de (votre|ta)) (rib|carte bancaire|cb|pi[eè]ce d['’]identit[eé]|passeport|carte vitale)/i, 'demande de documents sensibles avant l’embauche'],
    [/gagne[rz]? \d[\d\s]* ?(€|euros?) par (jour|semaine) (sans|depuis chez)/i, 'promesse de gains irréaliste'],
    [/whatsapp|telegram/i, 'contact hors plateforme par messagerie privée']
];
function heuristicCheck(text, kind) {
    if (kind === 'offer') for (const [re, why] of SCAM_PATTERNS) if (re.test(text)) return { ok: false, review: true, reason: 'Annonce à vérifier : ' + why + '.' };
    if (/(https?:\/\/\S+.*){4,}/is.test(text)) return { ok: false, reason: 'Trop de liens : les messages publicitaires ne sont pas acceptés.' };
    return { ok: true };
}

// Vérification par l'IA. kind = offer | topic | post | message
// Renvoie { ok: true } ou { ok: false, reason, review? } (review = publié plus tard, après contrôle humain)
async function moderate(text, kind) {
    const h = heuristicCheck(text, kind);
    if (!h.ok) return h;
    if (!GROQ_API_KEY || IS_TEST) return { ok: true };
    const rules = kind === 'offer'
        ? 'une offre d’emploi publiée par un recruteur. Refuse : arnaque (paiement demandé au candidat, documents bancaires ou d’identité avant embauche, gains irréalistes, MLM/vente pyramidale), discrimination illégale (âge, sexe, origine, religion, handicap, situation familiale…), contenu sexuel, travail illégal.'
        : 'un message sur un forum d’entraide entre demandeurs d’emploi. Refuse : insultes, harcèlement, haine, discrimination, contenu sexuel, publicité ou démarchage, arnaque, données personnelles d’un tiers. Accepte la critique, les questions naïves, la colère polie, les témoignages.';
    try {
        const raw = await callGroq([{ role: 'user', content: `Tu modères ${rules}
Réponds UNIQUEMENT avec un objet JSON {"ok": true|false, "severity": "low"|"high", "reason": "si refusé : explication courte et polie, adressée à l'auteur, en français, en le vouvoyant"}.
"severity": "high" pour une arnaque probable ou un contenu grave, "low" sinon.
Texte :
"""${String(text).slice(0, 5000)}"""` }], { json: true, temperature: 0 });
        const m = String(raw).match(/\{[\s\S]*\}/);
        const a = JSON.parse(m ? m[0] : raw);
        if (a.ok === false) return { ok: false, reason: String(a.reason || 'Contenu refusé par la modération.').slice(0, 300), review: kind === 'offer' && a.severity !== 'high' };
        return { ok: true };
    } catch (e) {
        console.warn('⚠️  Modération IA indisponible :', e.message);
        return { ok: true }; // les signalements prennent le relais
    }
}

const reportStmt = {
    add: db.prepare('INSERT OR IGNORE INTO reports (kind, target_id, reporter_id, reason, created_at) VALUES (?, ?, ?, ?, ?)'),
    count: db.prepare('SELECT COUNT(*) AS n FROM reports WHERE kind = ? AND target_id = ? AND resolved_at IS NULL'),
    open: db.prepare('SELECT kind, target_id, COUNT(*) AS n, MIN(created_at) AS first_at, GROUP_CONCAT(reason, \' | \') AS reasons FROM reports WHERE resolved_at IS NULL GROUP BY kind, target_id ORDER BY n DESC, first_at'),
    resolve: db.prepare('UPDATE reports SET resolved_at = ? WHERE kind = ? AND target_id = ? AND resolved_at IS NULL')
};
// Ajoute un signalement. Renvoie true si le seuil de masquage automatique est atteint.
function addReport(kind, targetId, reporterId, reason) {
    reportStmt.add.run(kind, String(targetId), String(reporterId), String(reason || '').slice(0, 300), new Date().toISOString());
    return reportStmt.count.get(kind, String(targetId)).n >= AUTO_HIDE_REPORTS;
}
function openReports() { return reportStmt.open.all(); }
function resolveReports(kind, targetId) { reportStmt.resolve.run(new Date().toISOString(), kind, String(targetId)); }

module.exports = { isAdmin, maskContacts, moderate, addReport, openReports, resolveReports, AUTO_HIDE_REPORTS };
