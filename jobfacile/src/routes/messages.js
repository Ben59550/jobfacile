// Messagerie candidat ↔ recruteur (offres publiées sur JobFacile).
// Le recruteur peut aussi changer le statut de la candidature : le candidat est prévenu et son suivi se met à jour.
const router = require('express').Router();
const { saveUsers } = require('../db');
const { requireAuth, tooManyAttempts } = require('../security');
const { displayName } = require('../utils');
const { moderate } = require('../services/moderation');
const L = require('../services/localOffers');
const M = require('../services/messaging');

const STATUS_TEXT = {
    interview: '🗓️ Le recruteur souhaite vous rencontrer en entretien. Convenez d’une date ici.',
    offer: '🎉 Bonne nouvelle : le recruteur vous propose le poste !',
    rejected: 'Le recruteur a choisi un autre candidat pour ce poste. Merci pour votre intérêt, et bon courage pour vos recherches.',
    applied: 'Votre candidature est de nouveau à l’étude.'
};

function accessible(conv, user) { return conv && (conv.candidate_id === user.id || conv.recruiter_id === user.id); }

router.get('/api/messages/unread', requireAuth, (req, res) => res.json({ success: true, count: M.unreadCount(req.user.id) }));

router.get('/api/conversations', requireAuth, (req, res) => {
    const me = req.user.id;
    const users = new Map(req.users.map(u => [u.id, u]));
    const list = M.conversationsOf(me).map(c => {
        const offer = L.getOffer(c.offer_id);
        const last = M.lastMessage(c.id);
        const asRecruiter = c.recruiter_id === me;
        const other = users.get(asRecruiter ? c.candidate_id : c.recruiter_id);
        return {
            id: c.id, role: asRecruiter ? 'recruiter' : 'candidate', status: c.status,
            otherName: asRecruiter ? displayName(other) : ((other && other.recruiter && other.recruiter.company) || (offer && offer.offer.company) || 'Recruteur'),
            offerTitle: offer ? offer.offer.title : 'Offre supprimée', offerId: c.offer_id, offerOpen: !!offer && offer.status === 'active',
            unread: asRecruiter ? c.recruiter_unread : c.candidate_unread,
            lastMessageAt: c.last_message_at,
            preview: last ? (last.sender_id === 'system' ? 'ℹ️ ' : last.sender_id === me ? 'Vous : ' : '') + String(last.body).replace(/\s+/g, ' ').slice(0, 90) : ''
        };
    });
    res.json({ success: true, conversations: list });
});

router.get('/api/conversations/:id', requireAuth, (req, res) => {
    const conv = M.getConversation(req.params.id);
    if (!accessible(conv, req.user)) return res.status(404).json({ success: false, message: 'Conversation introuvable.' });
    M.markRead(conv, req.user.id);
    const me = req.user.id;
    const asRecruiter = conv.recruiter_id === me;
    const users = new Map(req.users.map(u => [u.id, u]));
    const other = users.get(asRecruiter ? conv.candidate_id : conv.recruiter_id);
    const offer = L.getOffer(conv.offer_id);
    res.json({
        success: true,
        conversation: {
            id: conv.id, role: asRecruiter ? 'recruiter' : 'candidate', status: conv.status, offerId: conv.offer_id,
            offerTitle: offer ? offer.offer.title : 'Offre supprimée', company: offer ? offer.offer.company : '',
            otherName: asRecruiter ? displayName(other) : ((other && other.recruiter && other.recruiter.contactName) ? `${other.recruiter.contactName.split(' ')[0]} · ${other.recruiter.company}` : (offer && offer.offer.company) || 'Recruteur'),
            otherExists: !!other
        },
        messages: M.messagesOf(conv.id).map(m => ({
            id: m.id, mine: m.sender_id === me, system: m.sender_id === 'system',
            body: m.hidden ? '🛡️ Message masqué par la modération.' : m.body, hidden: !!m.hidden, at: m.created_at
        }))
    });
});

router.post('/api/conversations/:id/messages', requireAuth, async (req, res) => {
    const conv = M.getConversation(req.params.id);
    const user = req.user;
    if (!accessible(conv, user)) return res.status(404).json({ success: false, message: 'Conversation introuvable.' });
    if (user.banned) return res.status(403).json({ success: false, message: 'Votre compte ne peut plus envoyer de messages.' });
    const body = String(req.body.body || '').trim().slice(0, 3000);
    if (!body) return res.status(400).json({ success: false, message: 'Message vide.' });
    if (tooManyAttempts('msg:' + user.id, 60, 60 * 60 * 1000)) return res.status(429).json({ success: false, message: 'Trop de messages envoyés, faites une pause.' });
    const verdict = await moderate(body, 'message');
    if (!verdict.ok) return res.status(400).json({ success: false, message: verdict.reason });
    M.addMessage(conv, user.id, body);
    const recipientId = conv.candidate_id === user.id ? conv.recruiter_id : conv.candidate_id;
    const recipient = req.users.find(u => u.id === recipientId);
    const offer = L.getOffer(conv.offer_id);
    if (recipient) M.notifyRecipient(recipient, { fromName: conv.recruiter_id === user.id ? ((user.recruiter && user.recruiter.company) || displayName(user)) : displayName(user), offerTitle: offer ? offer.offer.title : 'votre candidature', convId: conv.id }).catch(() => {});
    res.json({ success: true });
});

// Statut de la candidature, choisi par le recruteur
router.post('/api/conversations/:id/status', requireAuth, (req, res) => {
    const conv = M.getConversation(req.params.id);
    if (!conv || conv.recruiter_id !== req.user.id) return res.status(404).json({ success: false, message: 'Conversation introuvable.' });
    const status = req.body.status;
    if (!STATUS_TEXT[status]) return res.status(400).json({ success: false, message: 'Statut invalide.' });
    if (status === conv.status) return res.json({ success: true });
    M.setConversationStatus(conv.id, status);
    M.addMessage(conv, 'system', STATUS_TEXT[status]);
    // Le suivi du candidat suit automatiquement
    const users = req.users;
    const candidate = users.find(u => u.id === conv.candidate_id);
    const offer = L.getOffer(conv.offer_id);
    if (candidate) {
        const app = (candidate.applications || []).find(a => a.id === conv.offer_id);
        if (app) { app.status = status; app.updatedAt = new Date().toISOString(); saveUsers(users); }
        M.notifyRecipient(candidate, {
            force: true, fromName: offer ? offer.offer.company : 'Le recruteur', offerTitle: offer ? offer.offer.title : 'votre candidature', convId: conv.id,
            subject: status === 'rejected' ? `Réponse à votre candidature : ${offer ? offer.offer.title : ''}` : status === 'offer' ? '🎉 Une proposition d’embauche vous attend' : status === 'interview' ? '🗓️ Proposition d’entretien' : 'Votre candidature'
        }).catch(() => {});
    }
    res.json({ success: true });
});

module.exports = router;
