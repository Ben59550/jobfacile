// Tests : formule gratuite (quotas IA mensuels) et abonnement Premium (Stripe simulé : aucun vrai paiement).
// Fausses clés posées avant le chargement du serveur ; Groq, Stripe et ElevenLabs sont remplacés par des réponses simulées.
process.env.GROQ_API_KEY = 'test-groq';
process.env.STRIPE_SECRET_KEY = 'sk_test_faux';
process.env.STRIPE_PRICE_ID = 'price_test_faux';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_faux';
process.env.ELEVENLABS_API_KEY = 'test-eleven';

const { test, before, after, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const t = require('./helpers');

// ---------- Services extérieurs simulés ----------
const realFetch = global.fetch;
let groqFails = false;
let stripeCalls = [];
let fakeSession = {}; // session de paiement renvoyée par Stripe simulé
global.fetch = async (url, opts = {}) => {
    const u = String(url);
    if (u.startsWith('https://api.groq.com/')) {
        if (groqFails) return new Response(JSON.stringify({ error: { message: 'panne simulée' } }), { status: 500 });
        return new Response(JSON.stringify({ choices: [{ message: { content: 'Texte rédigé par l’IA.' } }] }), { status: 200 });
    }
    if (u.startsWith('https://api.stripe.com/')) {
        stripeCalls.push({ url: u, method: opts.method, body: opts.body ? Object.fromEntries(new URLSearchParams(opts.body)) : null });
        if (u.includes('/checkout/sessions/') && opts.method === 'GET') return new Response(JSON.stringify(fakeSession), { status: 200 });
        if (u.includes('/checkout/sessions')) return new Response(JSON.stringify({ id: 'cs_test', url: 'https://checkout.stripe.com/c/pay/cs_test' }), { status: 200 });
        if (u.includes('/billing_portal/sessions')) return new Response(JSON.stringify({ url: 'https://billing.stripe.com/p/session/test' }), { status: 200 });
        if (u.includes('/subscriptions/')) return new Response(JSON.stringify(subscription('sub_test', 'cus_test', opts.method === 'DELETE' ? 'canceled' : 'active')), { status: 200 });
    }
    if (u.startsWith('https://api.elevenlabs.io/')) return new Response(new Uint8Array([1, 2, 3]), { status: 200, headers: { 'Content-Type': 'audio/mpeg' } });
    return realFetch(url, opts);
};
function subscription(id, customer, status, userId) {
    return { id, object: 'subscription', customer, status, cancel_at_period_end: false, metadata: userId ? { userId } : {},
        items: { data: [{ current_period_end: Math.floor(Date.now() / 1000) + 30 * 86400 }] } };
}
// Notification Stripe signée comme le fait Stripe (en-tête Stripe-Signature)
async function webhook(event, secret = process.env.STRIPE_WEBHOOK_SECRET) {
    const raw = JSON.stringify(event);
    const ts = Math.floor(Date.now() / 1000);
    const sig = crypto.createHmac('sha256', secret).update(`${ts}.${raw}`).digest('hex');
    const r = await realFetch(`http://127.0.0.1:${t.port()}/api/stripe/webhook`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Stripe-Signature': `t=${ts},v1=${sig}` }, body: raw });
    return r.status;
}
const generate = (token) => t.api('/api/ai/generate', { token, body: { prompt: 'Rédige une lettre de motivation.' } });

before(t.start);
after(t.stop);
beforeEach(() => { groqFails = false; stripeCalls = []; });

describe('Formule gratuite : quotas du mois', () => {
    test('documents IA gratuits jusqu’au quota, puis Premium proposé (402)', async () => {
        const acc = await t.createVerifiedUser();
        const max = require('../src/services/plans').FREE_LIMITS.docs;
        for (let i = 1; i <= max; i++) assert.equal((await generate(acc.token)).status, 200, `document ${i}`);
        const r = await generate(acc.token);
        assert.equal(r.status, 402);
        assert.equal(r.body.quota, true);
        assert.match(r.body.message, /Premium/);
        const me = await t.api('/api/me', { token: acc.token });
        assert.equal(me.body.user.plan.premium, false);
        assert.equal(me.body.user.plan.usage.docs, max);
    });

    test('un appel IA qui échoue n’est pas décompté', async () => {
        const acc = await t.createVerifiedUser();
        groqFails = true;
        assert.equal((await generate(acc.token)).status, 502);
        const me = await t.api('/api/me', { token: acc.token });
        assert.equal(me.body.user.plan.usage.docs, 0);
    });

    test('les compteurs repartent à zéro le mois suivant', async () => {
        const acc = await t.createVerifiedUser();
        t.updateUser(acc.email, u => { u.usage = { month: '2020-01', docs: 5 }; });
        assert.equal((await generate(acc.token)).status, 200);
    });

    test('la voix naturelle est réservée à Premium (voix du navigateur sinon)', async () => {
        const acc = await t.createVerifiedUser();
        const r = await t.api('/api/ai/tts', { token: acc.token, body: { text: 'Bonjour' } });
        assert.equal(r.status, 503);
        assert.equal(r.body.premiumOnly, true);
        assert.equal(r.body.fallback, true);
    });

    test('impossible de s’attribuer Premium en modifiant son profil', async () => {
        const acc = await t.createVerifiedUser();
        await t.api('/api/user/update', { token: acc.token, body: { premium: { status: 'active' }, plan: { premium: true }, usage: { docs: -100 } } });
        const u = t.findUser(acc.email);
        assert.equal(u.premium, undefined);
        assert.equal(u.usage, undefined);
    });
});

describe('Paiement Stripe', () => {
    test('le paiement exige la renonciation au délai de rétractation', async () => {
        const acc = await t.createVerifiedUser();
        const r = await t.api('/api/premium/checkout', { token: acc.token, body: {} });
        assert.equal(r.status, 400);
        assert.equal(stripeCalls.length, 0);
    });

    test('ouvre la page de paiement Stripe avec le bon prix et le bon compte', async () => {
        const acc = await t.createVerifiedUser();
        const r = await t.api('/api/premium/checkout', { token: acc.token, body: { waiver: true } });
        assert.equal(r.status, 200);
        assert.match(r.body.url, /^https:\/\/checkout\.stripe\.com\//);
        const call = stripeCalls.find(c => c.url.endsWith('/checkout/sessions'));
        assert.equal(call.body.mode, 'subscription');
        assert.equal(call.body['line_items[0][price]'], 'price_test_faux');
        assert.equal(call.body.client_reference_id, String(acc.user.id));
        assert.equal(call.body.customer_email, acc.email);
        assert.ok(t.findUser(acc.email).premium.waiverAt, 'preuve de la renonciation gardée');
    });

    test('une notification Stripe mal signée est refusée', async () => {
        const acc = await t.createVerifiedUser();
        const status = await webhook({ type: 'checkout.session.completed', data: { object: { mode: 'subscription', client_reference_id: acc.user.id, subscription: 'sub_test' } } }, 'whsec_pirate');
        assert.equal(status, 400);
        assert.equal(t.findUser(acc.email).premium, undefined);
    });

    test('paiement réussi → Premium actif, IA illimitée ; résiliation → retour à la formule gratuite', async () => {
        const acc = await t.createVerifiedUser();
        t.updateUser(acc.email, u => { u.usage = { month: new Date().toISOString().slice(0, 7), docs: 5 }; });
        assert.equal((await generate(acc.token)).status, 402);

        assert.equal(await webhook({ type: 'checkout.session.completed', data: { object: { mode: 'subscription', client_reference_id: acc.user.id, customer: 'cus_test', subscription: 'sub_test' } } }), 200);
        const me = await t.api('/api/me', { token: acc.token });
        assert.equal(me.body.user.plan.premium, true);
        assert.equal(me.body.user.plan.canManage, true);
        assert.equal('premium' in me.body.user, false, 'les identifiants Stripe ne sont pas envoyés au navigateur');
        for (let i = 0; i < 3; i++) assert.equal((await generate(acc.token)).status, 200);
        assert.equal((await t.api('/api/ai/tts', { token: acc.token, body: { text: 'Bonjour' } })).status, 200);

        const portal = await t.api('/api/premium/portal', { token: acc.token, method: 'POST' });
        assert.match(portal.body.url, /^https:\/\/billing\.stripe\.com\//);

        assert.equal(await webhook({ type: 'customer.subscription.deleted', data: { object: subscription('sub_test', 'cus_test', 'canceled', String(acc.user.id)) } }), 200);
        const after = await t.api('/api/me', { token: acc.token });
        assert.equal(after.body.user.plan.premium, false);
        assert.equal((await generate(acc.token)).status, 402);
    });

    test('retour du paiement : le serveur vérifie la session auprès de Stripe avant d’activer Premium', async () => {
        const acc = await t.createVerifiedUser();
        const other = await t.createVerifiedUser();
        fakeSession = { id: 'cs_test_abc', client_reference_id: String(acc.user.id), status: 'complete', subscription: 'sub_test' };
        // Session d'un autre compte : refusée
        const steal = await t.api('/api/premium/confirm', { token: other.token, body: { sessionId: 'cs_test_abc' } });
        assert.equal(steal.status, 403);
        assert.equal(t.findUser(other.email).premium, undefined);
        // Identifiant farfelu : refusé sans appeler Stripe
        stripeCalls = [];
        assert.equal((await t.api('/api/premium/confirm', { token: acc.token, body: { sessionId: '../../x' } })).status, 400);
        assert.equal(stripeCalls.length, 0);
        // Paiement pas encore terminé : rien n'est activé
        fakeSession.status = 'open';
        const pending = await t.api('/api/premium/confirm', { token: acc.token, body: { sessionId: 'cs_test_abc' } });
        assert.equal(pending.body.pending, true);
        assert.equal(pending.body.plan.premium, false);
        // Paiement terminé : Premium actif
        fakeSession.status = 'complete';
        const ok = await t.api('/api/premium/confirm', { token: acc.token, body: { sessionId: 'cs_test_abc' } });
        assert.equal(ok.status, 200);
        assert.equal(ok.body.plan.premium, true);
    });

    test('supprimer son compte arrête l’abonnement Stripe', async () => {
        const acc = await t.createVerifiedUser();
        await webhook({ type: 'checkout.session.completed', data: { object: { mode: 'subscription', client_reference_id: acc.user.id, customer: 'cus_test', subscription: 'sub_test' } } });
        stripeCalls = [];
        const r = await t.api('/api/user/delete', { token: acc.token, body: { password: acc.password } });
        assert.equal(r.status, 200);
        await new Promise(res => setTimeout(res, 50));
        assert.ok(stripeCalls.some(c => c.method === 'DELETE' && c.url.endsWith('/subscriptions/sub_test')));
    });
});
