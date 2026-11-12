// Espace recruteur : vérification de l'entreprise (SIRET), publication et suivi des offres, candidatures reçues.
const router = require('express').Router();
const { getUsers, saveUsers } = require('../db');
const { requireAuth, tooManyAttempts, publicUser } = require('../security');
const { fold, displayName } = require('../utils');
const { moderate, addReport, isAdmin } = require('../services/moderation');
const L = require('../services/localOffers');
const M = require('../services/messaging');
const { qualifLabelsServer } = require('../services/qualifs');

const s = (v, max) => String(v ?? '').trim().slice(0, max);
const CONTRACTS = ['CDI', 'CDD', 'Intérim', 'Alternance', 'Stage', 'Saisonnier', 'Freelance'];

function requireRecruiter(req, res, next) {
    if (!req.user.recruiter || !req.user.recruiter.verifiedAt) return res.status(403).json({ success: false, message: 'Vérifiez d’abord votre entreprise (SIRET).' });
    if (req.user.banned) return res.status(403).json({ success: false, message: 'Votre compte ne peut plus publier.' });
    next();
}

// ---------- Vérification de l'entreprise par son SIRET (annuaire officiel des entreprises) ----------
router.post('/api/recruiter/verify', requireAuth, async (req, res) => {
    const siret = String(req.body.siret || '').replace(/\D/g, '');
    if (!/^\d{14}$/.test(siret)) return res.status(400).json({ success: false, message: 'Le SIRET compte 14 chiffres (sur un bulletin de salaire, un Kbis ou l’avis de situation Insee).' });
    if (tooManyAttempts('siret:' + req.user.id, 10, 60 * 60 * 1000)) return res.status(429).json({ success: false, message: 'Trop d’essais, réessayez dans une heure.' });
    let etab = null, company = null;
    try {
        const r = await fetch(`https://recherche-entreprises.api.gouv.fr/search?q=${siret}&per_page=1&limite_matching_etablissements=5`, { signal: AbortSignal.timeout(8000) });
        const d = r.ok ? await r.json() : {};
        company = (d.results || [])[0] || null;
        etab = company && [...(company.matching_etablissements || []), company.siege].find(e => e && e.siret === siret);
    } catch (e) {
        return res.status(502).json({ success: false, message: 'L’annuaire des entreprises ne répond pas. Réessayez dans un instant.' });
    }
    if (!company || !etab) return res.status(404).json({ success: false, message: 'Aucun établissement trouvé avec ce SIRET.' });
    if (etab.etat_administratif !== 'A') return res.status(400).json({ success: false, message: 'Cet établissement est fermé selon l’annuaire officiel.' });
    const name = (etab.liste_enseignes && etab.liste_enseignes[0]) || company.nom_raison_sociale || company.nom_complet;
    req.user.recruiter = {
        ...(req.user.recruiter || {}),
        siret, siren: company.siren, company: s(name, 150), legalName: s(company.nom_complet, 200),
        address: s(etab.adresse, 300), postcode: s(etab.code_postal, 10), city: s(etab.libelle_commune, 100),
        lat: parseFloat(etab.latitude) || null, lng: parseFloat(etab.longitude) || null,
        contactName: s(req.body.contactName, 100) || `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim(),
        verifiedAt: new Date().toISOString()
    };
    saveUsers(req.users);
    res.json({ success: true, recruiter: req.user.recruiter, user: publicUser(req.user) });
});

// ---------- Mes offres ----------
function offerSummary(row) {
    const convs = M.conversationsOfOffer(row.id);
    return {
        id: row.id, status: row.status, views: row.views, createdAt: row.created_at, expiresAt: row.expires_at,
        offer: row.offer, candidates: convs.length, unread: convs.reduce((n, c) => n + c.recruiter_unread, 0)
    };
}
router.get('/api/recruiter/offers', requireAuth, (req, res) => {
    res.json({ success: true, recruiter: req.user.recruiter || null, offers: L.offersByOwner(req.user.id).map(offerSummary) });
});

// Création ou modification
router.post('/api/recruiter/offers', requireAuth, requireRecruiter, async (req, res) => {
    const b = req.body || {};
    const rec = req.user.recruiter;
    const existing = b.id ? L.getOffer(b.id) : null;
    if (b.id && (!existing || existing.owner_id !== req.user.id)) return res.status(404).json({ success: false, message: 'Offre introuvable.' });
    if (!existing && tooManyAttempts('publish:' + req.user.id, 10, 24 * 3600 * 1000)) return res.status(429).json({ success: false, message: 'Limite de 10 nouvelles offres par jour atteinte.' });
    const title = s(b.title, 120), description = s(b.description, 6000);
    if (title.length < 4) return res.status(400).json({ success: false, message: 'Indiquez l’intitulé du poste.' });
    if (description.length < 120) return res.status(400).json({ success: false, message: 'Décrivez le poste en au moins 120 caractères : missions, horaires, profil recherché.' });
    const contract = CONTRACTS.includes(b.contract) ? b.contract : 'CDI';
    // Lieu de travail : la ville saisie, sinon l'adresse de l'établissement vérifié
    let place = null;
    const city = s(b.city, 100);
    if (city && fold(city) !== fold(rec.city)) {
        place = await L.resolvePlace(city);
        if (!place || place.lat === undefined) return res.status(400).json({ success: false, message: `Ville « ${city} » introuvable.` });
    } else place = { name: rec.city, postcode: rec.postcode, lat: rec.lat, lng: rec.lng };

    const verdict = await moderate(`${title}\n${description}\n${s(b.salary, 80)}`, 'offer');
    if (!verdict.ok && !verdict.review) return res.status(400).json({ success: false, message: verdict.reason });
    const id = existing ? existing.id : L.newOfferId();
    const reqs = s(b.requirements, 600);
    const offer = {
        id, title, company: rec.company, location: `${place.name}${place.postcode ? ' (' + place.postcode.slice(0, 2) + ')' : ''}`,
        domain: s(b.domain, 80), type: contract, category: contract === 'Alternance' ? 'alternance' : 'emploi',
        salary: s(b.salary, 80), duration: s(b.hours, 80), remote: !!b.remote,
        description: description.replace(/\s+/g, ' ').slice(0, 257) + (description.length > 257 ? '…' : ''),
        fullDescription: description + (reqs ? `\n\nProfil recherché : ${reqs}` : ''),
        source: 'JobFacile', localOffer: true, verifiedCompany: true, siret: rec.siret, ownerId: req.user.id,
        createdAt: existing ? existing.offer.createdAt : new Date().toISOString(), url: ''
    };
    const status = verdict.ok ? 'active' : 'review';
    L.saveOffer({ id, ownerId: req.user.id, offer, status, lat: place.lat, lng: place.lng, postcode: place.postcode || '' });
    res.json({
        success: true, id, status,
        message: status === 'active' ? (existing ? 'Offre mise à jour.' : 'Offre publiée ! Elle apparaît dans les recherches autour de ' + place.name + '.')
            : 'Offre enregistrée : elle sera publiée après vérification par l’équipe. ' + (verdict.reason || '')
    });
});

router.post('/api/recruiter/offers/:id/status', requireAuth, (req, res) => {
    const row = L.getOffer(req.params.id);
    if (!row || row.owner_id !== req.user.id) return res.status(404).json({ success: false, message: 'Offre introuvable.' });
    const want = req.body.status;
    if (want === 'closed' && row.status === 'active') L.setOfferStatus(row.id, 'closed');
    else if (want === 'active' && row.status === 'closed') {
        L.saveOffer({ id: row.id, ownerId: row.owner_id, offer: row.offer, status: 'active', lat: row.lat, lng: row.lng, postcode: row.postcode }); // republiée 60 jours
    } else if (want === 'removed') L.setOfferStatus(row.id, 'removed');
    else return res.status(400).json({ success: false, message: 'Changement impossible pour cette offre.' });
    res.json({ success: true });
});

// Candidats d'une offre (recruteur)
router.get('/api/recruiter/offers/:id/candidates', requireAuth, (req, res) => {
    const row = L.getOffer(req.params.id);
    if (!row || row.owner_id !== req.user.id) return res.status(404).json({ success: false, message: 'Offre introuvable.' });
    const users = new Map(getUsers().map(u => [u.id, u]));
    res.json({ success: true, offer: row.offer, candidates: M.conversationsOfOffer(row.id).map(c => ({ conversationId: c.id, name: displayName(users.get(c.candidate_id)), status: c.status, unread: c.recruiter_unread, lastMessageAt: c.last_message_at })) });
});

// ---------- Côté candidat ----------
router.post('/api/local-offers/:id/view', (req, res) => {
    const row = L.getOffer(req.params.id);
    if (row && row.status === 'active' && !tooManyAttempts('view:' + req.params.id + ':' + (req.ip || ''), 1, 6 * 3600 * 1000)) L.countView(row.id);
    res.json({ success: true });
});

// Candidater : ouvre une conversation avec le recruteur, présentée avec le profil du candidat
router.post('/api/local-offers/:id/apply', requireAuth, async (req, res) => {
    const u = req.user;
    const row = L.getOffer(req.params.id);
    if (!row || row.status !== 'active') return res.status(404).json({ success: false, message: 'Cette offre n’est plus disponible.' });
    if (row.owner_id === u.id) return res.status(400).json({ success: false, message: 'Vous ne pouvez pas candidater à votre propre offre.' });
    if (u.banned) return res.status(403).json({ success: false, message: 'Votre compte ne peut plus envoyer de candidatures.' });
    if (!u.isVerified) return res.status(403).json({ success: false, message: 'Vérifiez votre e-mail avant de candidater.' });
    if (M.findConversation(row.id, u.id)) return res.status(400).json({ success: false, message: 'Vous avez déjà candidaté : retrouvez l’échange dans vos messages.', conversationId: M.findConversation(row.id, u.id).id });
    if (tooManyAttempts('apply:' + u.id, 30, 24 * 3600 * 1000)) return res.status(429).json({ success: false, message: 'Limite de 30 candidatures par jour atteinte.' });
    const message = s(req.body.message, 3000);
    if (message.length < 30) return res.status(400).json({ success: false, message: 'Écrivez quelques phrases au recruteur (30 caractères minimum).' });
    const verdict = await moderate(message, 'message');
    if (!verdict.ok) return res.status(400).json({ success: false, message: verdict.reason });

    const users = req.users;
    const recruiter = users.find(x => x.id === row.owner_id);
    if (!recruiter) return res.status(404).json({ success: false, message: 'Ce recruteur n’existe plus.' });
    const conv = M.createConversation(row.id, u.id, row.owner_id);
    // Présentation du candidat, à partir de son profil
    const q = qualifLabelsServer(u);
    const lines = [
        `📄 Candidature de ${u.firstName || ''} ${u.lastName || ''}`.trim(),
        u.headline ? `Profil : ${u.headline}` : '', [u.city, u.postalCode].filter(Boolean).length ? `Ville : ${[u.postalCode, u.city].filter(Boolean).join(' ')}` : '',
        (u.skills || []).length ? `Compétences : ${u.skills.slice(0, 10).join(', ')}` : '',
        (u.experience || []).filter(e => e && e.title).length ? `Expériences : ${u.experience.filter(e => e && e.title).slice(0, 3).map(e => `${e.title}${e.company ? ' – ' + e.company : ''}${e.period ? ' (' + e.period + ')' : ''}`).join(' ; ')}` : '',
        [...q.licenses, ...q.caces, ...q.habilitations].length ? `Permis et habilitations : ${[...q.licenses, ...q.caces, ...q.habilitations].join(', ')}` : '',
        u.availability ? `Disponibilité : ${u.availability}` : '',
        req.body.shareContact ? `Contact : ${u.email}${u.phone ? ' · ' + u.phone : ''}` : '',
        req.body.shareCv && u.cvPdfUrl ? `CV (lien valable 6 mois) : ${require('../config').PUBLIC_URL}${require('../services/files').signUpload(u.cvPdfUrl, 183 * 24 * 3600 * 1000)}` : ''
    ].filter(Boolean).join('\n');
    M.addMessage(conv, 'system', lines);
    M.addMessage(conv, u.id, message);
    // La candidature apparaît dans le suivi du candidat
    u.applications = Array.isArray(u.applications) ? u.applications : [];
    if (!u.applications.some(a => a.id === row.id)) {
        const now = new Date().toISOString();
        u.applications.unshift({ id: row.id, job: { ...row.offer, fullDescription: String(row.offer.fullDescription).slice(0, 4000) }, status: 'applied', notes: 'Candidature envoyée via JobFacile (voir Messages).', createdAt: now, updatedAt: now, appliedAt: now, conversationId: conv.id });
    }
    saveUsers(users);
    M.notifyRecipient(recruiter, { fromName: displayName(u), offerTitle: row.offer.title, convId: conv.id, subject: `📄 Nouvelle candidature : ${row.offer.title}` }).catch(() => {});
    res.json({ success: true, conversationId: conv.id, user: publicUser(u), message: 'Candidature envoyée ! Le recruteur vous répondra dans vos messages.' });
});

// ---------- Signalements (offres, sujets, réponses, messages) ----------
router.post('/api/reports', requireAuth, (req, res) => {
    const kind = ['offer', 'topic', 'post', 'message'].includes(req.body.kind) ? req.body.kind : null;
    const id = s(req.body.id, 100);
    if (!kind || !id) return res.status(400).json({ success: false, message: 'Signalement invalide.' });
    if (tooManyAttempts('report:' + req.user.id, 20, 24 * 3600 * 1000)) return res.status(429).json({ success: false, message: 'Trop de signalements aujourd’hui.' });
    const reachedThreshold = addReport(kind, id, req.user.id, s(req.body.reason, 300));
    // 3 signalements de personnes différentes : le contenu est masqué en attendant un administrateur
    if (reachedThreshold) {
        if (kind === 'offer') { const row = L.getOffer(id); if (row && row.status === 'active') L.setOfferStatus(id, 'hidden'); }
        else require('../services/forum').hideByReports(kind, id);
    }
    res.json({ success: true, message: 'Merci, votre signalement a été transmis à l’équipe de modération.' });
});

module.exports = router;
module.exports.isAdminUser = isAdmin;
