// Abonnement Premium avec Stripe (paiement par carte, géré par Stripe : JobFacile ne voit jamais les numéros de carte).
//   POST /api/premium/checkout : ouvre la page de paiement Stripe
//   POST /api/premium/portal   : espace client Stripe (factures, carte, résiliation)
//   GET  /api/premium          : formule et utilisation du mois
//   POST /api/stripe/webhook   : Stripe prévient le serveur (paiement réussi, renouvellement, résiliation)
// Réglages dans .env : STRIPE_SECRET_KEY, STRIPE_PRICE_ID, STRIPE_WEBHOOK_SECRET (voir .env.example).
const crypto = require('crypto');
const router = require('express').Router();
const { PUBLIC_URL } = require('../config');
const { getUsers, saveUsers } = require('../db');
const { requireAuth, tooManyAttempts } = require('../security');
const { planInfo, isPremium } = require('../services/plans');

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';
const STRIPE_PRICE_ID = process.env.STRIPE_PRICE_ID || '';
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';
const configured = () => !!(STRIPE_SECRET_KEY && STRIPE_PRICE_ID);

// Appel à l'API Stripe (formulaire encodé, comme l'exige Stripe)
async function stripe(method, path, params) {
    const body = params ? new URLSearchParams(params).toString() : undefined;
    const r = await fetch('https://api.stripe.com/v1' + path, {
        method,
        headers: { Authorization: 'Bearer ' + STRIPE_SECRET_KEY, ...(body ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}) },
        body, signal: AbortSignal.timeout(20000)
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error((data.error && data.error.message) || 'Stripe a répondu ' + r.status);
    return data;
}

// Fin de la période payée (selon la version de l'API Stripe, elle est sur l'abonnement ou sur sa ligne)
function periodEnd(sub) {
    const t = sub.current_period_end || (sub.items && sub.items.data && sub.items.data[0] && sub.items.data[0].current_period_end);
    return t ? new Date(t * 1000).toISOString() : null;
}
function applySubscription(user, sub) {
    user.premium = {
        ...(user.premium || {}),
        customerId: typeof sub.customer === 'string' ? sub.customer : sub.customer && sub.customer.id,
        subscriptionId: sub.id,
        status: sub.status,
        periodEnd: periodEnd(sub),
        cancelAtPeriodEnd: !!sub.cancel_at_period_end,
        updatedAt: new Date().toISOString()
    };
}

// Page de paiement Stripe aux couleurs de JobFacile (vert émeraude, coins arrondis, nom et icône du site)
function brandingParams() {
    const p = {
        'branding_settings[display_name]': 'JobFacile',
        'branding_settings[background_color]': '#f0fdf4',
        'branding_settings[button_color]': '#059669',
        'branding_settings[border_style]': 'rounded'
    };
    // L'icône doit être joignable par Stripe : seulement une fois le site en ligne (https, pas localhost)
    if (/^https:\/\/(?!localhost|127\.)/.test(PUBLIC_URL)) {
        p['branding_settings[icon][type]'] = 'url';
        p['branding_settings[icon][url]'] = PUBLIC_URL + '/icons/icon-512.png';
    }
    return p;
}

router.get('/api/premium', requireAuth, (req, res) => res.json({ success: true, plan: planInfo(req.user), payments: configured() }));

router.post('/api/premium/checkout', requireAuth, async (req, res) => {
    if (!configured()) return res.status(503).json({ success: false, message: 'Le paiement n’est pas encore ouvert. Revenez bientôt !' });
    const u = req.user;
    if (isPremium(u) && u.premium && u.premium.subscriptionId) return res.status(400).json({ success: false, message: 'Vous êtes déjà Premium.' });
    // Service numérique fourni tout de suite : le client doit le demander et renoncer à son délai de rétractation (Code de la consommation, art. L221-28)
    if (req.body.waiver !== true) return res.status(400).json({ success: false, message: 'Cochez la case pour accéder tout de suite à Premium.' });
    if (tooManyAttempts('checkout:' + u.id, 10, 60 * 60 * 1000)) return res.status(429).json({ success: false, message: 'Trop d’essais, réessayez dans une heure.' });
    try {
        const params = {
            mode: 'subscription',
            'line_items[0][price]': STRIPE_PRICE_ID,
            'line_items[0][quantity]': '1',
            success_url: PUBLIC_URL + '/?premium=merci&session_id={CHECKOUT_SESSION_ID}', // Stripe remplace {CHECKOUT_SESSION_ID}
            cancel_url: PUBLIC_URL + '/?premium=annule',
            client_reference_id: String(u.id),
            'subscription_data[metadata][userId]': String(u.id),
            allow_promotion_codes: 'true',
            locale: 'fr'
        };
        if (u.premium && u.premium.customerId) params.customer = u.premium.customerId;
        else params.customer_email = u.email;
        const branding = brandingParams();
        let session;
        try { session = await stripe('POST', '/checkout/sessions', { ...params, ...branding }); }
        catch (e) {
            // Compte ou version d'API Stripe sans personnalisation par session : on garde l'apparence du tableau de bord
            if (!/branding/i.test(e.message)) throw e;
            session = await stripe('POST', '/checkout/sessions', params);
        }
        u.premium = { ...(u.premium || {}), waiverAt: new Date().toISOString() }; // preuve de la renonciation
        saveUsers(req.users);
        res.json({ success: true, url: session.url });
    } catch (e) {
        console.warn('⚠️  Stripe (paiement) :', e.message);
        if (/No such price/i.test(e.message)) console.warn(`   → STRIPE_PRICE_ID ne correspond pas à la clé (${STRIPE_SECRET_KEY.slice(0, 8)}…) : un prix créé en mode test ne marche qu'avec une clé de test, un prix réel qu'avec une clé réelle (live).`);
        res.status(502).json({ success: false, message: 'Le paiement est momentanément indisponible. Réessayez plus tard.' });
    }
});

// Retour de la page de paiement : le serveur demande lui-même à Stripe si la session est payée
// (aucune confiance dans le navigateur). Utile en local, où Stripe ne peut pas joindre le webhook, et si le webhook tarde.
router.post('/api/premium/confirm', requireAuth, async (req, res) => {
    const id = String(req.body.sessionId || '');
    if (!configured() || !/^cs_(test|live)_[A-Za-z0-9]+$/.test(id)) return res.status(400).json({ success: false, message: 'Session de paiement inconnue.' });
    try {
        const session = await stripe('GET', '/checkout/sessions/' + encodeURIComponent(id));
        if (String(session.client_reference_id) !== String(req.user.id)) return res.status(403).json({ success: false, message: 'Ce paiement ne correspond pas à votre compte.' });
        if (session.status !== 'complete' || !session.subscription) return res.json({ success: true, plan: planInfo(req.user), pending: true });
        const subId = typeof session.subscription === 'string' ? session.subscription : session.subscription.id;
        applySubscription(req.user, await stripe('GET', '/subscriptions/' + encodeURIComponent(subId)));
        saveUsers(req.users);
        res.json({ success: true, plan: planInfo(req.user) });
    } catch (e) {
        console.warn('⚠️  Stripe (confirmation) :', e.message);
        res.status(502).json({ success: false, message: 'Vérification du paiement impossible pour le moment.' });
    }
});

router.post('/api/premium/portal', requireAuth, async (req, res) => {
    const p = req.user.premium || {};
    if (!STRIPE_SECRET_KEY || !p.customerId) return res.status(400).json({ success: false, message: 'Aucun abonnement à gérer.' });
    try {
        const s = await stripe('POST', '/billing_portal/sessions', { customer: p.customerId, return_url: PUBLIC_URL + '/?premium=compte' });
        res.json({ success: true, url: s.url });
    } catch (e) {
        console.warn('⚠️  Stripe (espace client) :', e.message);
        res.status(502).json({ success: false, message: 'Espace abonnement momentanément indisponible.' });
    }
});

// ---------- Notifications de Stripe ----------
// Signature vérifiée (en-tête Stripe-Signature, HMAC SHA-256 avec STRIPE_WEBHOOK_SECRET) : personne d'autre ne peut activer Premium.
function verifySignature(raw, header) {
    if (!STRIPE_WEBHOOK_SECRET || !header) return false;
    const parts = Object.fromEntries(String(header).split(',').map(kv => kv.split('=')).filter(p => p.length === 2).map(([k, v]) => [k, v]));
    const signatures = String(header).split(',').filter(kv => kv.startsWith('v1=')).map(kv => kv.slice(3));
    const t = Number(parts.t);
    if (!t || !signatures.length || Math.abs(Date.now() / 1000 - t) > 300) return false; // 5 minutes : pas de rejeu
    const expected = crypto.createHmac('sha256', STRIPE_WEBHOOK_SECRET).update(`${t}.${raw}`).digest('hex');
    return signatures.some(s => s.length === expected.length && crypto.timingSafeEqual(Buffer.from(s), Buffer.from(expected)));
}

async function stripeWebhook(req, res) {
    const raw = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : '';
    if (!verifySignature(raw, req.headers['stripe-signature'])) return res.status(400).send('Signature invalide');
    let event;
    try { event = JSON.parse(raw); } catch (e) { return res.status(400).send('JSON invalide'); }
    try {
        const obj = event.data && event.data.object;
        const users = getUsers();
        const byId = (id) => users.find(u => String(u.id) === String(id));
        const byCustomer = (c) => users.find(u => u.premium && u.premium.customerId === c);
        if (event.type === 'checkout.session.completed' && obj.mode === 'subscription') {
            const user = byId(obj.client_reference_id);
            if (user && obj.subscription) {
                applySubscription(user, await stripe('GET', '/subscriptions/' + encodeURIComponent(obj.subscription)));
                saveUsers([user]);
                console.log(`⭐ Premium activé pour le compte ${user.id}`);
            }
        } else if (/^customer\.subscription\.(created|updated|deleted|paused|resumed)$/.test(event.type)) {
            const user = (obj.metadata && byId(obj.metadata.userId)) || byCustomer(obj.customer);
            if (user) {
                applySubscription(user, obj);
                saveUsers([user]);
                if (event.type === 'customer.subscription.deleted') console.log(`Premium terminé pour le compte ${user.id}`);
            }
        }
        res.json({ received: true });
    } catch (e) {
        console.error('⚠️  Webhook Stripe :', e.message);
        res.status(500).send('Erreur'); // Stripe renverra la notification plus tard
    }
}

// Suppression du compte : on arrête aussi l'abonnement (sinon la carte continuerait d'être débitée)
async function cancelSubscriptionNow(user) {
    const p = user && user.premium;
    if (!STRIPE_SECRET_KEY || !p || !p.subscriptionId || ['canceled', 'incomplete_expired'].includes(p.status)) return;
    try { await stripe('DELETE', '/subscriptions/' + encodeURIComponent(p.subscriptionId)); }
    catch (e) { console.error('⚠️  Résiliation Stripe impossible pour', user.id, ':', e.message); }
}

module.exports = router;
module.exports.stripeWebhook = stripeWebhook;
module.exports.cancelSubscriptionNow = cancelSubscriptionNow;
module.exports.paymentsConfigured = configured;
