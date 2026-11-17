// Tests : inscription, vérification de l'e-mail, connexion, session, suppression du compte
const { test, before, after, describe } = require('node:test');
const assert = require('node:assert/strict');
const t = require('./helpers');

before(t.start);
after(t.stop);

describe('Inscription', () => {
    test('refuse un formulaire incomplet', async () => {
        const r = await t.api('/api/register', { body: t.validUser({ phone: '' }) });
        assert.equal(r.status, 400);
        assert.equal(r.body.success, false);
    });

    test('refuse une adresse e-mail invalide', async () => {
        const r = await t.api('/api/register', { body: t.validUser({ email: 'pas-une-adresse' }) });
        assert.equal(r.status, 400);
        assert.match(r.body.message, /e-mail invalide/i);
    });

    test('refuse un mot de passe de moins de 8 caractères', async () => {
        const r = await t.api('/api/register', { body: t.validUser({ password: 'court' }) });
        assert.equal(r.status, 400);
        assert.match(r.body.message, /8 caractères/);
    });

    test('refuse si la politique de confidentialité n’est pas acceptée', async () => {
        const r = await t.api('/api/register', { body: t.validUser({ acceptTerms: false }) });
        assert.equal(r.status, 400);
    });

    test('crée le compte, envoie un code à 6 chiffres et ne connecte pas encore', async () => {
        const u = t.validUser();
        const r = await t.api('/api/register', { body: u });
        assert.equal(r.status, 200);
        assert.equal(r.body.success, true);
        assert.equal(r.body.token, undefined, 'pas de session avant la vérification de l’e-mail');
        assert.match(t.lastCodeFor(u.email), /^\d{6}$/);
        assert.equal(t.findUser(u.email).isVerified, false);
    });

    test('ne garde jamais le mot de passe en clair', async () => {
        const u = t.validUser();
        await t.api('/api/register', { body: u });
        const stored = t.findUser(u.email).password;
        assert.notEqual(stored, u.password);
        assert.match(stored, /^scrypt\$[0-9a-f]+\$[0-9a-f]+$/);
    });

    test('refuse une adresse déjà utilisée, même avec d’autres majuscules', async () => {
        const u = t.validUser();
        await t.api('/api/register', { body: u });
        const r = await t.api('/api/register', { body: { ...u, email: u.email.toUpperCase() } });
        assert.equal(r.status, 400);
        assert.match(r.body.message, /déjà utilisé/);
    });
});

describe('Vérification de l’e-mail', () => {
    test('refuse un mauvais code', async () => {
        const u = t.validUser();
        await t.api('/api/register', { body: u });
        const good = t.lastCodeFor(u.email);
        const wrong = good === '000000' ? '111111' : '000000';
        const r = await t.api('/api/verify-code', { body: { email: u.email, code: wrong } });
        assert.equal(r.status, 400);
        assert.equal(t.findUser(u.email).isVerified, false);
    });

    test('le bon code vérifie le compte et ouvre une session', async () => {
        const u = t.validUser();
        await t.api('/api/register', { body: u });
        const r = await t.api('/api/verify-code', { body: { email: u.email, code: t.lastCodeFor(u.email) } });
        assert.equal(r.status, 200);
        assert.ok(r.body.token);
        assert.equal(r.body.user.email, u.email);
        const me = await t.api('/api/me', { token: r.body.token });
        assert.equal(me.status, 200);
        assert.equal(me.body.user.firstName, 'Camille');
    });

    test('un code ne sert qu’une fois', async () => {
        const u = t.validUser();
        await t.api('/api/register', { body: u });
        const code = t.lastCodeFor(u.email);
        await t.api('/api/verify-code', { body: { email: u.email, code } });
        const again = await t.api('/api/verify-code', { body: { email: u.email, code } });
        assert.equal(again.status, 400);
    });

    test('« renvoyer un code » remplace l’ancien code', async () => {
        const u = t.validUser();
        await t.api('/api/register', { body: u });
        const first = t.lastCodeFor(u.email);
        // Le nouveau code est tiré au hasard : on recommence s'il tombe par hasard sur le même
        let second = first;
        for (let i = 0; i < 3 && second === first; i++) {
            await t.api('/api/resend-code', { body: { email: u.email } });
            second = t.lastCodeFor(u.email);
        }
        assert.notEqual(second, first);
        const old = await t.api('/api/verify-code', { body: { email: u.email, code: first } });
        assert.equal(old.status, 400, 'l’ancien code ne doit plus marcher');
        const ok = await t.api('/api/verify-code', { body: { email: u.email, code: second } });
        assert.equal(ok.status, 200);
    });

    test('se connecter avant d’avoir vérifié son e-mail renvoie un nouveau code, pas de session', async () => {
        const u = t.validUser();
        await t.api('/api/register', { body: u });
        const before = t.mailsTo(u.email).length;
        const r = await t.api('/api/login', { body: { email: u.email, password: u.password } });
        assert.equal(r.body.requireVerification, true);
        assert.equal(r.body.token, undefined);
        assert.equal(t.mailsTo(u.email).length, before + 1);
    });
});

describe('Connexion et session', () => {
    test('refuse un mauvais mot de passe sans dire si le compte existe', async () => {
        const acc = await t.createVerifiedUser();
        const wrong = await t.api('/api/login', { body: { email: acc.email, password: 'Mauvais-mot-de-passe' } });
        const unknown = await t.api('/api/login', { body: { email: t.newEmail('inconnu'), password: 'Mauvais-mot-de-passe' } });
        assert.equal(wrong.status, 400);
        assert.equal(unknown.status, 400);
        assert.equal(wrong.body.message, unknown.body.message, 'même message dans les deux cas');
    });

    test('connecte avec le bon mot de passe (e-mail insensible à la casse)', async () => {
        const acc = await t.createVerifiedUser();
        const r = await t.api('/api/login', { body: { email: acc.email.toUpperCase(), password: acc.password } });
        assert.equal(r.status, 200);
        assert.ok(r.body.token);
    });

    test('ne renvoie jamais de donnée sensible au navigateur', async () => {
        const acc = await t.createVerifiedUser();
        const r = await t.api('/api/login', { body: { email: acc.email, password: acc.password } });
        for (const key of ['password', 'verificationCode', 'twoFactorSecret', 'tempTwoFactorSecret', 'sessions', 'trustedDevices', 'resetCode', 'pendingPassword', 'passwordChangeCode', 'ipAddress']) {
            assert.equal(key in r.body.user, false, `« ${key} » ne doit pas sortir du serveur`);
        }
    });

    test('ne garde que l’empreinte du jeton de session en base', async () => {
        const acc = await t.createVerifiedUser();
        const stored = JSON.stringify(t.findUser(acc.email).sessions);
        assert.equal(stored.includes(acc.token), false);
    });

    test('les pages protégées exigent un jeton valide', async () => {
        assert.equal((await t.api('/api/me')).status, 401);
        assert.equal((await t.api('/api/me', { token: 'jeton-invente' })).status, 401);
    });

    test('une session expirée est refusée', async () => {
        const acc = await t.createVerifiedUser();
        t.updateUser(acc.email, (u) => { u.sessions.forEach((s) => { s.expiresAt = new Date(Date.now() - 1000).toISOString(); }); });
        assert.equal((await t.api('/api/me', { token: acc.token })).status, 401);
    });

    test('la déconnexion invalide le jeton, mais pas les autres appareils', async () => {
        const acc = await t.createVerifiedUser();
        const other = await t.api('/api/login', { body: { email: acc.email, password: acc.password } });
        const out = await t.api('/api/logout', { token: acc.token, body: {} });
        assert.equal(out.status, 200);
        assert.equal((await t.api('/api/me', { token: acc.token })).status, 401);
        assert.equal((await t.api('/api/me', { token: other.body.token })).status, 200);
    });

    test('bloque après 10 essais de connexion en 15 minutes', async () => {
        const acc = await t.createVerifiedUser();
        let last = null;
        for (let i = 0; i < 11; i++) last = await t.api('/api/login', { body: { email: acc.email, password: 'Faux-mot-de-passe' } });
        assert.equal(last.status, 429);
        // Même le bon mot de passe est refusé pendant le blocage
        const good = await t.api('/api/login', { body: { email: acc.email, password: acc.password } });
        assert.equal(good.status, 429);
    });
});

describe('Suppression du compte', () => {
    test('exige le mot de passe, puis efface le compte', async () => {
        const acc = await t.createVerifiedUser();
        const wrong = await t.api('/api/user/delete', { token: acc.token, body: { password: 'Faux-mot-de-passe' } });
        assert.equal(wrong.status, 400);
        assert.ok(t.findUser(acc.email));
        const ok = await t.api('/api/user/delete', { token: acc.token, body: { password: acc.password } });
        assert.equal(ok.status, 200);
        assert.equal(t.findUser(acc.email), undefined);
        assert.equal((await t.api('/api/me', { token: acc.token })).status, 401);
        assert.equal((await t.api('/api/login', { body: { email: acc.email, password: acc.password } })).status, 400);
    });
});
