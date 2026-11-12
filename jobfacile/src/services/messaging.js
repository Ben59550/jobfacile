// Messagerie candidat ↔ recruteur : une conversation par candidature à une offre publiée sur JobFacile.
const crypto = require('crypto');
const { db } = require('../db');
const { PUBLIC_URL } = require('../config');
const { sendEmail, simpleEmailHtml } = require('../mailer');
const { sendPushToUser } = require('./push');

db.exec(`
    CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        offer_id TEXT NOT NULL,
        candidate_id TEXT NOT NULL,
        recruiter_id TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'applied',   -- applied | interview | offer | rejected
        candidate_unread INTEGER NOT NULL DEFAULT 0,
        recruiter_unread INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        last_message_at TEXT NOT NULL,
        UNIQUE (offer_id, candidate_id)
    );
    CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        conversation_id TEXT NOT NULL,
        sender_id TEXT NOT NULL,               -- 'system' pour les messages automatiques
        body TEXT NOT NULL,
        created_at TEXT NOT NULL,
        hidden INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS messages_conv ON messages (conversation_id, id);
    CREATE INDEX IF NOT EXISTS conv_candidate ON conversations (candidate_id);
    CREATE INDEX IF NOT EXISTS conv_recruiter ON conversations (recruiter_id);
`);
const st = {
    get: db.prepare('SELECT * FROM conversations WHERE id = ?'),
    find: db.prepare('SELECT * FROM conversations WHERE offer_id = ? AND candidate_id = ?'),
    mine: db.prepare('SELECT * FROM conversations WHERE candidate_id = ? OR recruiter_id = ? ORDER BY last_message_at DESC'),
    byOffer: db.prepare('SELECT * FROM conversations WHERE offer_id = ? ORDER BY last_message_at DESC'),
    insert: db.prepare('INSERT INTO conversations (id, offer_id, candidate_id, recruiter_id, created_at, last_message_at) VALUES (?, ?, ?, ?, ?, ?)'),
    msgs: db.prepare('SELECT * FROM messages WHERE conversation_id = ? ORDER BY id'),
    lastMsg: db.prepare('SELECT * FROM messages WHERE conversation_id = ? AND hidden = 0 ORDER BY id DESC LIMIT 1'),
    addMsg: db.prepare('INSERT INTO messages (conversation_id, sender_id, body, created_at) VALUES (?, ?, ?, ?)'),
    getMsg: db.prepare('SELECT * FROM messages WHERE id = ?'),
    hideMsg: db.prepare('UPDATE messages SET hidden = ? WHERE id = ?'),
    bumpCand: db.prepare('UPDATE conversations SET last_message_at = ?, candidate_unread = candidate_unread + 1 WHERE id = ?'),
    bumpRec: db.prepare('UPDATE conversations SET last_message_at = ?, recruiter_unread = recruiter_unread + 1 WHERE id = ?'),
    readCand: db.prepare('UPDATE conversations SET candidate_unread = 0 WHERE id = ?'),
    readRec: db.prepare('UPDATE conversations SET recruiter_unread = 0 WHERE id = ?'),
    status: db.prepare('UPDATE conversations SET status = ? WHERE id = ?'),
    unread: db.prepare('SELECT COALESCE(SUM(CASE WHEN candidate_id = ? THEN candidate_unread ELSE 0 END), 0) + COALESCE(SUM(CASE WHEN recruiter_id = ? THEN recruiter_unread ELSE 0 END), 0) AS n FROM conversations WHERE candidate_id = ? OR recruiter_id = ?')
};

function getConversation(id) { return st.get.get(String(id)) || null; }
function findConversation(offerId, candidateId) { return st.find.get(String(offerId), String(candidateId)) || null; }
function conversationsOf(userId) { return st.mine.all(userId, userId); }
function conversationsOfOffer(offerId) { return st.byOffer.all(String(offerId)); }
function messagesOf(convId) { return st.msgs.all(String(convId)); }
function lastMessage(convId) { return st.lastMsg.get(String(convId)) || null; }
function unreadCount(userId) { return st.unread.get(userId, userId, userId, userId).n; }
function getMessage(id) { return st.getMsg.get(Number(id)) || null; }
function setMessageHidden(id, hidden) { st.hideMsg.run(hidden ? 1 : 0, Number(id)); }
function setConversationStatus(id, status) { st.status.run(status, String(id)); }
function markRead(conv, userId) { if (conv.candidate_id === userId) st.readCand.run(conv.id); if (conv.recruiter_id === userId) st.readRec.run(conv.id); }

function createConversation(offerId, candidateId, recruiterId) {
    const id = 'c-' + crypto.randomBytes(8).toString('hex');
    const now = new Date().toISOString();
    st.insert.run(id, String(offerId), String(candidateId), String(recruiterId), now, now);
    return getConversation(id);
}
// Ajoute un message ; le destinataire voit un compteur « non lu »
function addMessage(conv, senderId, body) {
    const now = new Date().toISOString();
    const r = st.addMsg.run(conv.id, String(senderId), String(body).slice(0, 4000), now);
    if (senderId === conv.candidate_id) st.bumpRec.run(now, conv.id);
    else if (senderId === conv.recruiter_id) st.bumpCand.run(now, conv.id);
    else { st.bumpCand.run(now, conv.id); } // message automatique : pour le candidat
    return Number(r.lastInsertRowid);
}

// Prévenir le destinataire : notification sur son appareil + e-mail (au plus un toutes les 30 min par conversation)
const lastMailAt = new Map();
async function notifyRecipient(recipient, { fromName, offerTitle, convId, subject, force = false }) {
    const url = `/messages?c=${encodeURIComponent(convId)}`;
    sendPushToUser(recipient, { title: subject || `💬 Nouveau message de ${fromName}`, body: offerTitle, url, tag: 'conv-' + convId }).catch(() => {});
    const key = recipient.id + ':' + convId;
    if (!force && Date.now() - (lastMailAt.get(key) || 0) < 30 * 60 * 1000) return; // les changements de statut sont toujours envoyés
    lastMailAt.set(key, Date.now());
    const e = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    await sendEmail(recipient.email, subject || `💬 ${fromName} vous a écrit sur JobFacile`,
        `${fromName} vous a envoyé un message à propos de « ${offerTitle} ». Lisez-le et répondez : ${PUBLIC_URL}${url}`,
        simpleEmailHtml({
            title: 'Nouveau message', intro: `<strong>${e(fromName)}</strong> vous a envoyé un message à propos de l’offre « ${e(offerTitle)} ».`,
            note: 'Pour votre sécurité, le contenu du message n’est pas recopié dans cet e-mail. Ne communiquez jamais vos coordonnées bancaires.',
            ctaUrl: PUBLIC_URL + url, ctaLabel: 'Lire et répondre'
        }));
}

module.exports = {
    getConversation, findConversation, conversationsOf, conversationsOfOffer, messagesOf, lastMessage, unreadCount,
    getMessage, setMessageHidden, setConversationStatus, markRead, createConversation, addMessage, notifyRecipient
};
