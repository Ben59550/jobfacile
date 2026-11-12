// Tests : mot de passe oublié (code par e-mail) et changement de mot de passe une fois connecté
const { test, before, after, describe } = require('node:test');
const assert = require('node:assert/strict');
const t = require('./helpers');

before(t.start);
after(t.stop);

const NEW_PASSWORD = 'Nouveau-MotDePasse-456';
const other = (code) => (code === '000000' ? '111111' : '000000');

describe('Mot de passe oublié', () => {
    test('même réponse que le compte existe ou non, et aucun e-mail pour une adresse inconnue', async () => {
        const acc = await t.createVerifiedUser();
        const unknownEmail = t.newEmail('inconnu');
        const known = await t.api('/api/forgot-password', { body: { email: acc.email } });
        const unknown = await t.api('/api/forgot-password', { body: { email: unknownEmail } });
        assert.equal(known.status, 200);
        assert.equal(unknown.status, 200);
        assert.equal(known.body.message, unknown.body.message);
        assert.equal(t.mailsTo(unknownEmail).length, 0);
    });

    test('exige une adresse e-mail', async () => {
        assert.equal((await t.api('/api/forgot-password', { body: {} })).status, 400);
    });

    test('envoie un code à 6 chiffres valable 15 minutes', async () => {
        const acc = await t.createVerifiedUser();
        await t.api('/api/forgot-password', { body: { email: acc.email } });
        assert.match(t.lastCodeFor(acc.email), /^\d{6}$/);
        const minutes = (new Date(t.findUser(acc.email).resetExpires) - Date.now()) / 60000;
        assert.ok(minutes > 14 && minutes <= 15, `expiration dans ${minutes.toFixed(1)} min`);
    });

    test('refuse un mauvais code', async () => {
        const acc = await t.createVerifiedUser();
        await t.api('/api/forgot-password', { body: { email: acc.email } });
        const r = await t.api('/api/reset-password', { body: { email: acc.email, code: other(t.lastCodeFor(acc.email)), newPassword: NEW_PASSWORD, confirmPassword: NEW_PASSWORD } });
        assert.equal(r.status, 400);
        assert.ok((await t.api('/api/login', { body: { email: acc.email, password: acc.password } })).body.token, 'l’ancien mot de passe marche toujours');
    });

    test('refuse un mot de passe trop court ou une confirmation différente', async () => {
        const acc = await t.createVerifiedUser();
        await t.api('/api/forgot-password', { body: { email: acc.email } });
        const code = t.lastCodeFor(acc.email);
        const short = await t.api('/api/reset-password', { body: { email: acc.email, code, newPassword: 'court', confirmPassword: 'court' } });
        assert.equal(short.status, 400);
        const mismatch = await t.api('/api/reset-password', { body: { email: acc.email, code, newPassword: NEW_PASSWORD, confirmPassword: NEW_PASSWORD + 'x' } });
        assert.equal(mismatch.status, 400);
    });

    test('refuse un code expiré', async () => {
        const acc = await t.createVerifiedUser();
        await t.api('/api/forgot-password', { body: { email: acc.email } });
        const code = t.lastCodeFor(acc.email);
        t.updateUser(acc.email, (u) => { u.resetExpires = new Date(Date.now() - 1000).toISOString(); });
        const r = await t.api('/api/reset-password', { body: { email: acc.email, code, newPassword: NEW_PASSWORD, confirmPassword: NEW_PASSWORD } });
        assert.equal(r.status, 400);
    });

    test('refuse de réinitialiser sans avoir demandé de code', async () => {
        const acc = await t.createVerifiedUser();
        for (const code of ['', 'null', 'undefined', '000000']) {
            const r = await t.api('/api/reset-password', { body: { email: acc.email, code, newPassword: NEW_PASSWORD, confirmPassword: NEW_PASSWORD } });
            assert.equal(r.status, 400, `code « ${code} »`);
        }
    });

    test('le bon code change le mot de passe et déconnecte tous les appareils', async () => {
        const acc = await t.createVerifiedUser();
        await t.api('/api/forgot-password', { body: { email: acc.email } });
        const code = t.lastCodeFor(acc.email);
        const r = await t.api('/api/reset-password', { body: { email: acc.email, code, newPassword: NEW_PASSWORD, confirmPassword: NEW_PASSWORD } });
        assert.equal(r.status, 200);
        assert.equal(r.body.token, undefined, 'la réinitialisation ne connecte pas : il faut se reconnecter');
        assert.equal((await t.api('/api/me', { token: acc.token })).status, 401, 'l’ancienne session est fermée');
        assert.equal((await t.api('/api/login', { body: { email: acc.email, password: acc.password } })).status, 400, 'l’ancien mot de passe ne marche plus');
        assert.ok((await t.api('/api/login', { body: { email: acc.email, password: NEW_PASSWORD } })).body.token);
    });

    test('un code ne sert qu’une fois', async () => {
        const acc = await t.createVerifiedUser();
        await t.api('/api/forgot-password', { body: { email: acc.email } });
        const code = t.lastCodeFor(acc.email);
        await t.api('/api/reset-password', { body: { email: acc.email, code, newPassword: NEW_PASSWORD, confirmPassword: NEW_PASSWORD } });
        const again = await t.api('/api/reset-password', { body: { email: acc.email, code, newPassword: 'Encore-Un-Autre-789', confirmPassword: 'Encore-Un-Autre-789' } });
        assert.equal(again.status, 400);
    });

    test('bloque après 5 demandes de code en 15 minutes', async () => {
        const acc = await t.createVerifiedUser();
        let last = null;
        for (let i = 0; i < 6; i++) last = await t.api('/api/forgot-password', { body: { email: acc.email } });
        assert.equal(last.status, 429);
    });

    test('bloque après 10 essais de code en 15 minutes', async () => {
        const acc = await t.createVerifiedUser();
        await t.api('/api/forgot-password', { body: { email: acc.email } });
        const wrong = other(t.lastCodeFor(acc.email));
        let last = null;
        for (let i = 0; i < 11; i++) last = await t.api('/api/reset-password', { body: { email: acc.email, code: wrong, newPassword: NEW_PASSWORD, confirmPassword: NEW_PASSWORD } });
        assert.equal(last.status, 429);
    });
});

describe('Changement de mot de passe (connecté)', () => {
    test('exige d’être connecté', async () => {
        const r = await t.api('/api/user/request-password-change', { body: { currentPassword: 'x', newPassword: NEW_PASSWORD, confirmPassword: NEW_PASSWORD } });
        assert.equal(r.status, 401);
    });

    test('refuse si le mot de passe actuel est faux', async () => {
        const acc = await t.createVerifiedUser();
        const r = await t.api('/api/user/request-password-change', { token: acc.token, body: { currentPassword: 'Faux-mot-de-passe', newPassword: NEW_PASSWORD, confirmPassword: NEW_PASSWORD } });
        assert.equal(r.status, 400);
    });

    test('refuse un nouveau mot de passe trop court ou mal confirmé', async () => {
        const acc = await t.createVerifiedUser();
        const short = await t.api('/api/user/request-password-change', { token: acc.token, body: { currentPassword: acc.password, newPassword: 'court', confirmPassword: 'court' } });
        assert.equal(short.status, 400);
        const mismatch = await t.api('/api/user/request-password-change', { token: acc.token, body: { currentPassword: acc.password, newPassword: NEW_PASSWORD, confirmPassword: 'Autre-Chose-123' } });
        assert.equal(mismatch.status, 400);
    });

    test('le mot de passe ne change qu’après le code reçu par e-mail', async () => {
        const acc = await t.createVerifiedUser();
        const ask = await t.api('/api/user/request-password-change', { token: acc.token, body: { currentPassword: acc.password, newPassword: NEW_PASSWORD, confirmPassword: NEW_PASSWORD } });
        assert.equal(ask.status, 200);
        const code = t.lastCodeFor(acc.email);
        assert.match(code, /^\d{6}$/);
        // Tant que le code n'est pas confirmé, rien ne change
        assert.ok((await t.api('/api/login', { body: { email: acc.email, password: acc.password } })).body.token);
        const bad = await t.api('/api/user/confirm-password-change', { token: acc.token, body: { code: other(code) } });
        assert.equal(bad.status, 400);
        const ok = await t.api('/api/user/confirm-password-change', { token: acc.token, body: { code } });
        assert.equal(ok.status, 200);
        assert.equal((await t.api('/api/login', { body: { email: acc.email, password: acc.password } })).status, 400);
        assert.ok((await t.api('/api/login', { body: { email: acc.email, password: NEW_PASSWORD } })).body.token);
    });

    test('refuse de confirmer sans demande en cours', async () => {
        const acc = await t.createVerifiedUser();
        for (const code of ['', 'null', 'undefined']) {
            const r = await t.api('/api/user/confirm-password-change', { token: acc.token, body: { code } });
            assert.equal(r.status, 400, `code « ${code} »`);
        }
        assert.ok((await t.api('/api/login', { body: { email: acc.email, password: acc.password } })).body.token, 'le mot de passe n’a pas été effacé');
    });
});
