// Forum d'entraide (lecture libre ; écrire demande un compte vérifié) et outils des administrateurs.
const router = require('express').Router();
const { getUsers, saveUsers } = require('../db');
const { requireAuth, tooManyAttempts } = require('../security');
const { displayName } = require('../utils');
const { moderate, maskContacts, isAdmin, openReports, resolveReports } = require('../services/moderation');
const F = require('../services/forum');
const L = require('../services/localOffers');
const M = require('../services/messaging');

const clean = (v, max) => maskContacts(String(v ?? '').trim().replace(/\n{3,}/g, '\n\n')).slice(0, max);

// Lecture : connexion facultative (pour savoir ce que la personne a aimé et ce qu'elle peut modifier)
function optionalAuth(req, res, next) {
    if (!req.headers.authorization) return next();
    requireAuth(req, { status: () => ({ json: () => next() }) }, next);
}
function authorMap() { return new Map(getUsers().map(u => [u.id, u])); }
function canWrite(req, res) {
    const u = req.user;
    if (!u.isVerified) { res.status(403).json({ success: false, message: 'Vérifiez votre e-mail pour participer.' }); return false; }
    if (u.banned) { res.status(403).json({ success: false, message: 'Votre compte ne peut plus publier sur le forum.' }); return false; }
    return true;
}
function badgeOf(u) { return u && u.recruiter && u.recruiter.verifiedAt ? 'Recruteur vérifié' : null; }

router.get('/api/forum/categories', (req, res) => res.json({ success: true, categories: F.CATEGORIES }));

router.get('/api/forum/topics', optionalAuth, (req, res) => {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const { total, rows } = F.listTopics({ category: req.query.cat, q: String(req.query.q || '').slice(0, 80), page });
    const users = authorMap();
    res.json({
        success: true, total, page, totalPages: Math.max(1, Math.ceil(total / 20)),
        topics: rows.map(t => ({ id: t.id, category: t.category, title: t.title, excerpt: t.body.slice(0, 180), author: displayName(users.get(t.author_id)), authorBadge: badgeOf(users.get(t.author_id)), replies: t.replies, likes: t.likes, createdAt: t.created_at, lastActivity: t.last_activity }))
    });
});

router.get('/api/forum/topics/:id', optionalAuth, (req, res) => {
    const t = F.getTopic(req.params.id);
    const admin = isAdmin(req.user);
    if (!t || t.status === 'deleted' || (t.status === 'hidden' && !admin && (!req.user || req.user.id !== t.author_id))) return res.status(404).json({ success: false, message: 'Cette discussion n’existe plus.' });
    const users = authorMap();
    const me = req.user ? req.user.id : null;
    const liked = me ? F.likedBy(me) : new Set();
    const out = (kind, x) => ({
        id: x.id, author: displayName(users.get(x.author_id)), authorBadge: badgeOf(users.get(x.author_id)),
        body: x.status === 'hidden' && !admin && x.author_id !== me ? '🛡️ Message masqué par la modération.' : x.body,
        hidden: x.status === 'hidden', likes: x.likes, liked: liked.has(kind + ':' + x.id), mine: x.author_id === me,
        createdAt: x.created_at, editedAt: x.edited_at
    });
    res.json({ success: true, admin, categories: F.CATEGORIES, topic: { ...out('topic', t), title: t.title, category: t.category, replies: t.replies }, posts: F.postsOf(t.id).map(p => out('post', p)) });
});

router.post('/api/forum/topics', requireAuth, async (req, res) => {
    if (!canWrite(req, res)) return;
    const category = F.CATEGORIES[req.body.category] ? req.body.category : 'divers';
    const title = clean(req.body.title, 140), body = clean(req.body.body, 6000);
    if (title.length < 8) return res.status(400).json({ success: false, message: 'Donnez un titre clair (8 caractères minimum).' });
    if (body.length < 20) return res.status(400).json({ success: false, message: 'Détaillez un peu votre message (20 caractères minimum).' });
    if (tooManyAttempts('topic:' + req.user.id, 5, 24 * 3600 * 1000)) return res.status(429).json({ success: false, message: 'Limite de 5 nouvelles discussions par jour.' });
    const verdict = await moderate(`${title}\n${body}`, 'topic');
    if (!verdict.ok) return res.status(400).json({ success: false, message: verdict.reason });
    res.json({ success: true, id: F.addTopic(req.user.id, category, title, body) });
});

router.post('/api/forum/topics/:id/posts', requireAuth, async (req, res) => {
    if (!canWrite(req, res)) return;
    const t = F.getTopic(req.params.id);
    if (!t || t.status !== 'visible') return res.status(404).json({ success: false, message: 'Cette discussion n’accepte plus de réponses.' });
    const body = clean(req.body.body, 4000);
    if (body.length < 2) return res.status(400).json({ success: false, message: 'Réponse vide.' });
    if (tooManyAttempts('post:' + req.user.id, 40, 3600 * 1000)) return res.status(429).json({ success: false, message: 'Trop de réponses en peu de temps, faites une pause.' });
    const verdict = await moderate(body, 'post');
    if (!verdict.ok) return res.status(400).json({ success: false, message: verdict.reason });
    const id = F.addPost(t.id, req.user.id, body);
    // L'auteur du sujet est prévenu d'une nouvelle réponse (notification, s'il l'a activée)
    if (t.author_id !== req.user.id) {
        const author = getUsers().find(u => u.id === t.author_id);
        if (author) require('../services/push').sendPushToUser(author, { title: '💬 Nouvelle réponse à votre discussion', body: t.title, url: '/communaute?sujet=' + t.id, tag: 'topic-' + t.id }).catch(() => {});
    }
    res.json({ success: true, id });
});

// Modifier ou supprimer son propre message
router.post('/api/forum/:kind/:id/edit', requireAuth, async (req, res) => {
    const kind = req.params.kind === 'topic' ? 'topic' : 'post';
    const x = kind === 'topic' ? F.getTopic(req.params.id) : F.getPost(req.params.id);
    if (!x || x.author_id !== req.user.id || x.status === 'deleted') return res.status(404).json({ success: false, message: 'Message introuvable.' });
    if (req.body.delete) { F.setStatus(kind, x.id, 'deleted'); return res.json({ success: true }); }
    if (!canWrite(req, res)) return;
    const body = clean(req.body.body, kind === 'topic' ? 6000 : 4000);
    const title = kind === 'topic' ? clean(req.body.title || x.title, 140) : null;
    if (body.length < 2) return res.status(400).json({ success: false, message: 'Message vide.' });
    const verdict = await moderate(`${title || ''}\n${body}`, kind);
    if (!verdict.ok) return res.status(400).json({ success: false, message: verdict.reason });
    if (kind === 'topic') F.editTopic(x.id, title, body); else F.editPost(x.id, body);
    res.json({ success: true });
});

router.post('/api/forum/:kind/:id/like', requireAuth, (req, res) => {
    const kind = req.params.kind === 'topic' ? 'topic' : 'post';
    const x = kind === 'topic' ? F.getTopic(req.params.id) : F.getPost(req.params.id);
    if (!x || x.status !== 'visible') return res.status(404).json({ success: false });
    if (x.author_id === req.user.id) return res.status(400).json({ success: false, message: 'Vous ne pouvez pas voter pour vous-même.' });
    res.json({ success: true, ...F.toggleLike(kind, x.id, req.user.id) });
});

// ---------- Administration ----------
function requireAdmin(req, res, next) {
    if (!isAdmin(req.user)) return res.status(403).json({ success: false, message: 'Réservé aux administrateurs.' });
    next();
}
router.get('/api/admin/queue', requireAuth, requireAdmin, (req, res) => {
    const users = authorMap();
    const describe = (kind, id) => {
        if (kind === 'offer') { const o = L.getOffer(id); return o ? { title: o.offer.title, text: o.offer.fullDescription, author: displayName(users.get(o.owner_id)), authorId: o.owner_id, status: o.status, company: o.offer.company } : null; }
        if (kind === 'topic') { const t = F.getTopic(id); return t ? { title: t.title, text: t.body, author: displayName(users.get(t.author_id)), authorId: t.author_id, status: t.status, link: '/communaute?sujet=' + t.id } : null; }
        if (kind === 'post') { const p = F.getPost(id); return p ? { title: 'Réponse dans : ' + ((F.getTopic(p.topic_id) || {}).title || ''), text: p.body, author: displayName(users.get(p.author_id)), authorId: p.author_id, status: p.status, link: '/communaute?sujet=' + p.topic_id } : null; }
        if (kind === 'message') { const m = M.getMessage(id); return m ? { title: 'Message privé', text: m.body, author: displayName(users.get(m.sender_id)), authorId: m.sender_id, status: m.hidden ? 'hidden' : 'visible' } : null; }
        return null;
    };
    const reports = openReports().map(r => ({ kind: r.kind, id: r.target_id, count: r.n, reasons: String(r.reasons || '').split(' | ').filter(Boolean).slice(0, 5), firstAt: r.first_at, target: describe(r.kind, r.target_id) })).filter(r => r.target);
    const review = L.offersToReview().filter(o => !reports.some(r => r.kind === 'offer' && r.id === o.id)).map(o => ({ kind: 'offer', id: o.id, count: 0, reasons: [o.status === 'review' ? 'Signalée par la vérification automatique' : 'Masquée'], target: describe('offer', o.id) }));
    const banned = getUsers().filter(u => u.banned).map(u => ({ id: u.id, name: displayName(u), email: u.email, since: u.bannedAt }));
    res.json({ success: true, items: [...review, ...reports], banned });
});
router.post('/api/admin/action', requireAuth, requireAdmin, (req, res) => {
    const { action, kind, id, userId } = req.body;
    if (['hide', 'restore', 'dismiss'].includes(action) && ['offer', 'topic', 'post', 'message'].includes(kind)) {
        if (kind === 'offer') {
            const o = L.getOffer(id);
            if (!o) return res.status(404).json({ success: false });
            if (action === 'hide') L.setOfferStatus(id, 'removed');
            if (action === 'restore' || action === 'dismiss') L.setOfferStatus(id, 'active');
        } else F.setStatus(kind, id, action === 'hide' ? 'hidden' : 'visible');
        resolveReports(kind, id);
        return res.json({ success: true });
    }
    if (['ban', 'unban'].includes(action) && userId) {
        const users = getUsers();
        const u = users.find(x => x.id === userId);
        if (!u) return res.status(404).json({ success: false });
        if (isAdmin(u)) return res.status(400).json({ success: false, message: 'Impossible de suspendre un administrateur.' });
        u.banned = action === 'ban';
        u.bannedAt = u.banned ? new Date().toISOString() : null;
        saveUsers(users);
        if (u.banned) { F.hideAllFrom(u.id); L.offersByOwner(u.id).filter(o => o.status === 'active').forEach(o => L.setOfferStatus(o.id, 'removed')); }
        return res.json({ success: true });
    }
    res.status(400).json({ success: false, message: 'Action inconnue.' });
});

module.exports = router;
