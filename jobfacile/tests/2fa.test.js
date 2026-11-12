// Tests : double authentification (codes à 6 chiffres d'une application comme Google Authenticator)
const { test, before, after, describe } = require('node:test');
const assert = require('node:assert/strict');
const speakeasy = require('speakeasy');
const t = require('./helpers');

before(t.start);
after(t.stop);

const totp = (secret) => speakeasy.totp({ secret, encoding: 'base32' });
const wrongCode = (secret) => (totp(secret) === '000000' ? '111111' : '000000');

// Crée un compte et active la double authentification. Renvoie aussi le secret.
async function userWith2FA() {
    const acc = await t.createVerifiedUser();
    const setup = await t.api('/api/user/2fa/setup', { token: acc.token, body: {} });
    const enable = await t.api('/api/user/2fa/enable', { token: acc.token, body: { token: totp(setup.body.secret) } });
    assert.equal(enable.body.success, true);
    return { ...acc, secret: setup.body.secret };
}

describe('Activation', () => {
    test('la configuration renvoie un secret et un QR code, sans activer tout de suite', async () => {
        const acc = await t.createVerifiedUser();
        const r = await t.api('/api/user/2fa/setup', { token: acc.token, body: {} });
        assert.equal(r.status, 200);
        assert.match(r.body.secret, /^[A-Z2-7]+$/);
        assert.match(r.body.qrCodeUrl, /^data:image\/png;base64,/);
        assert.equal(t.findUser(acc.email).isTwoFactorEnabled, false);
    });

    test('refuse d’activer sans avoir lancé la configuration', async () => {
        const acc = await t.createVerifiedUser();
        const r = await t.api('/api/user/2fa/enable', { token: acc.token, body: { token: '123456' } });
        assert.equal(r.status, 400);
    });

    test('refuse un mauvais code, accepte le bon', async () => {
        const acc = await t.createVerifiedUser();
        const setup = await t.api('/api/user/2fa/setup', { token: acc.token, body: {} });
        const bad = await t.api('/api/user/2fa/enable', { token: acc.token, body: { token: wrongCode(setup.body.secret) } });
        assert.equal(bad.status, 400);
        assert.equal(t.findUser(acc.email).isTwoFactorEnabled, false);
        const good = await t.api('/api/user/2fa/enable', { token: acc.token, body: { token: totp(setup.body.secret) } });
        assert.equal(good.status, 200);
        assert.equal(good.body.user.isTwoFactorEnabled, true);
        assert.equal('twoFactorSecret' in good.body.user, false, 'le secret ne doit pas être renvoyé');
    });

    test('exige d’être connecté', async () => {
        assert.equal((await t.api('/api/user/2fa/setup', { body: {} })).status, 401);
    });
});

describe('Connexion avec double authentification', () => {
    test('le mot de passe seul ne suffit plus', async () => {
        const acc = await userWith2FA();
        const r = await t.api('/api/login', { body: { email: acc.email, password: acc.password } });
        assert.equal(r.status, 200);
        assert.equal(r.body.require2FA, true);
        assert.equal(r.body.token, undefined);
    });

    test('refuse un mauvais code', async () => {
        const acc = await userWith2FA();
        const r = await t.api('/api/login-2fa', { body: { email: acc.email, password: acc.password, token: wrongCode(acc.secret) } });
        assert.equal(r.status, 400);
        assert.equal(r.body.token, undefined);
    });

    test('refuse le bon code si le mot de passe est faux', async () => {
        const acc = await userWith2FA();
        const r = await t.api('/api/login-2fa', { body: { email: acc.email, password: 'Faux-mot-de-passe', token: totp(acc.secret) } });
        assert.equal(r.status, 400);
        assert.equal(r.body.token, undefined);
    });

    test('refuse le bon code sans mot de passe', async () => {
        const acc = await userWith2FA();
        const r = await t.api('/api/login-2fa', { body: { email: acc.email, token: totp(acc.secret) } });
        assert.equal(r.status, 400);
    });

    test('connecte avec mot de passe + bon code', async () => {
        const acc = await userWith2FA();
        const r = await t.api('/api/login-2fa', { body: { email: acc.email, password: acc.password, token: totp(acc.secret) } });
        assert.equal(r.status, 200);
        assert.ok(r.body.token);
        assert.equal(r.body.deviceToken, null, 'pas d’appareil de confiance sans le demander');
        assert.equal((await t.api('/api/me', { token: r.body.token })).status, 200);
    });

    test('un appareil de confiance n’a plus besoin du code, un autre appareil si', async () => {
        const acc = await userWith2FA();
        const first = await t.api('/api/login-2fa', { body: { email: acc.email, password: acc.password, token: totp(acc.secret), rememberDevice: true } });
        assert.ok(first.body.deviceToken);
        const trusted = await t.api('/api/login', { body: { email: acc.email, password: acc.password }, headers: { 'X-Device-Token': first.body.deviceToken } });
        assert.ok(trusted.body.token, 'connexion directe sur l’appareil de confiance');
        assert.notEqual(trusted.body.require2FA, true);
        const other = await t.api('/api/login', { body: { email: acc.email, password: acc.password }, headers: { 'X-Device-Token': 'un-autre-appareil' } });
        assert.equal(other.body.require2FA, true);
    });

    test('un appareil de confiance expiré redemande le code', async () => {
        const acc = await userWith2FA();
        const first = await t.api('/api/login-2fa', { body: { email: acc.email, password: acc.password, token: totp(acc.secret), rememberDevice: true } });
        t.updateUser(acc.email, (u) => { u.trustedDevices.forEach((d) => { d.expiresAt = new Date(Date.now() - 1000).toISOString(); }); });
        const r = await t.api('/api/login', { body: { email: acc.email, password: acc.password }, headers: { 'X-Device-Token': first.body.deviceToken } });
        assert.equal(r.body.require2FA, true);
    });

    test('appareil enregistré : jeton jamais gardé en clair, nom lisible, liste et retrait', async () => {
        const acc = await userWith2FA();
        const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
        const first = await t.api('/api/login-2fa', { body: { email: acc.email, password: acc.password, token: totp(acc.secret), rememberDevice: true }, headers: { 'User-Agent': ua } });
        const dev = t.findUser(acc.email).trustedDevices[0];
        assert.equal(dev.token, undefined, 'seule l’empreinte du jeton est en base');
        assert.notEqual(dev.hash, first.body.deviceToken);
        assert.equal(dev.label, 'Chrome · Windows');
        // Plusieurs comptes sur le même navigateur : plusieurs jetons envoyés, le bon est reconnu
        const both = 'jeton-d-un-autre-compte-1234,' + first.body.deviceToken;
        const list = await t.api('/api/user/devices', { token: first.body.token, headers: { 'X-Device-Token': both } });
        assert.equal(list.body.devices.length, 1);
        assert.equal(list.body.devices[0].current, true);
        assert.ok(!('hash' in list.body.devices[0]));
        assert.ok((await t.api('/api/login', { body: { email: acc.email, password: acc.password }, headers: { 'X-Device-Token': both } })).body.token);
        // Retrait : le code est redemandé
        assert.equal((await t.api('/api/user/devices/remove', { token: first.body.token, body: { id: list.body.devices[0].id } })).status, 200);
        const again = await t.api('/api/login', { body: { email: acc.email, password: acc.password }, headers: { 'X-Device-Token': first.body.deviceToken } });
        assert.equal(again.body.require2FA, true);
    });

    test('bloque après 10 essais de code en 15 minutes', async () => {
        const acc = await userWith2FA();
        let last = null;
        for (let i = 0; i < 11; i++) last = await t.api('/api/login-2fa', { body: { email: acc.email, password: acc.password, token: wrongCode(acc.secret) } });
        assert.equal(last.status, 429);
    });
});

describe('Désactivation', () => {
    test('exige le mot de passe et oublie les appareils de confiance', async () => {
        const acc = await userWith2FA();
        await t.api('/api/login-2fa', { body: { email: acc.email, password: acc.password, token: totp(acc.secret), rememberDevice: true } });
        const bad = await t.api('/api/user/2fa/disable', { token: acc.token, body: { password: 'Faux-mot-de-passe' } });
        assert.equal(bad.status, 400);
        assert.equal(t.findUser(acc.email).isTwoFactorEnabled, true);
        const ok = await t.api('/api/user/2fa/disable', { token: acc.token, body: { password: acc.password } });
        assert.equal(ok.status, 200);
        const stored = t.findUser(acc.email);
        assert.equal(stored.isTwoFactorEnabled, false);
        assert.equal(stored.twoFactorSecret, null);
        assert.deepEqual(stored.trustedDevices, []);
        const login = await t.api('/api/login', { body: { email: acc.email, password: acc.password } });
        assert.ok(login.body.token, 'le mot de passe suffit à nouveau');
    });
});
