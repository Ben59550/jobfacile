// Tests : fichiers privés (liens signés), en-têtes de sécurité, CORS, page d'état, sauvegarde de la base
process.env.ADMIN_EMAILS = 'admin-securite@exemple.test';
const { test, before, after, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const t = require('./helpers');

before(t.start);
after(t.stop);

const base = () => `http://127.0.0.1:${t.port()}`;

describe('Photos et CV privés', () => {
    test('sans signature, un fichier envoyé n’est pas accessible', async () => {
        fs.writeFileSync(path.join(process.env.JOBFACILE_UPLOADS_DIR, 'cvFile-test-1.pdf'), '%PDF-1.4 test');
        const r = await fetch(base() + '/uploads/cvFile-test-1.pdf');
        assert.equal(r.status, 403);
    });
    test('le profil renvoie un lien signé qui fonctionne, et un lien falsifié est refusé', async () => {
        const acc = await t.createVerifiedUser();
        fs.writeFileSync(path.join(process.env.JOBFACILE_UPLOADS_DIR, 'avatarFile-test-2.png'), Buffer.from('89504e470d0a1a0a', 'hex'));
        t.updateUser(acc.email, (u) => { u.avatarUrl = '/uploads/avatarFile-test-2.png'; });
        const me = await t.api('/api/me', { token: acc.token });
        assert.match(me.body.user.avatarUrl, /^\/uploads\/avatarFile-test-2\.png\?exp=\d+&sig=[0-9a-f]{32}$/);
        const ok = await fetch(base() + me.body.user.avatarUrl);
        assert.equal(ok.status, 200);
        assert.equal(ok.headers.get('content-type'), 'image/png');
        const forged = me.body.user.avatarUrl.replace(/sig=.{4}/, 'sig=0000');
        assert.equal((await fetch(base() + forged)).status, 403);
        // la signature d'un fichier ne vaut pas pour un autre
        assert.equal((await fetch(base() + me.body.user.avatarUrl.replace('avatarFile-test-2.png', 'cvFile-test-1.pdf'))).status, 403);
    });
    test('un lien expiré est refusé', async () => {
        const { checkSignature } = require('../src/services/files');
        assert.equal(checkSignature('x.png', Date.now() - 1000, 'a'.repeat(32)), false);
    });
    test('impossible de sortir du dossier des fichiers', async () => {
        assert.notEqual((await fetch(base() + '/uploads/..%2F..%2Fpackage.json?exp=9999999999999&sig=' + '0'.repeat(32))).status, 200);
    });
});

describe('En-têtes de sécurité', () => {
    test('la page porte une politique de contenu et les protections habituelles', async () => {
        const r = await fetch(base() + '/');
        const csp = r.headers.get('content-security-policy') || '';
        assert.match(csp, /default-src 'self'/);
        assert.match(csp, /object-src 'none'/);
        assert.match(csp, /frame-ancestors 'none'/);
        assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
        assert.equal(r.headers.get('x-powered-by'), null);
        assert.match(r.headers.get('permissions-policy') || '', /microphone=\(self\)/);
    });
    test('les pages sont compressées', async () => {
        const r = await fetch(base() + '/', { headers: { 'Accept-Encoding': 'gzip' } });
        assert.equal(r.headers.get('content-encoding'), 'gzip');
    });
    test('CORS : un autre site ne peut pas lire les réponses de l’API', async () => {
        const evil = await fetch(base() + '/api/status', { headers: { Origin: 'https://site-malveillant.example' } });
        assert.equal(evil.headers.get('access-control-allow-origin'), null);
        const local = await fetch(base() + '/api/status', { headers: { Origin: 'http://localhost:3000' } });
        assert.equal(local.headers.get('access-control-allow-origin'), 'http://localhost:3000');
    });
});

describe('Page d’état des services', () => {
    test('publique : voyants seulement, aucun détail technique', async () => {
        const r = await t.api('/api/status');
        assert.equal(r.body.success, true);
        assert.ok(r.body.services.database);
        for (const s of Object.values(r.body.services)) assert.equal('detail' in s, false);
        const page = await fetch(base() + '/etat');
        assert.match(await page.text(), /État des services/);
    });
    test('le détail est réservé aux administrateurs', async () => {
        const user = await t.createVerifiedUser();
        assert.equal((await t.api('/api/admin/status', { token: user.token })).status, 403);
        const admin = await t.createVerifiedUser({ email: 'admin-securite@exemple.test' });
        const r = await t.api('/api/admin/status', { token: admin.token });
        assert.equal(r.body.success, true);
        assert.match(r.body.services.database.detail, /compte/);
    });
});

describe('Sauvegarde de la base', () => {
    test('crée une copie lisible de la base du jour', async () => {
        const { backupNow, lastBackup } = require('../src/services/backup');
        const r = backupNow({ force: true });
        assert.ok(fs.statSync(r.file).size > 0);
        assert.equal(lastBackup().count, 1);
        const { DatabaseSync } = require('node:sqlite');
        const copy = new DatabaseSync(r.file, { readOnly: true });
        assert.ok(copy.prepare('SELECT COUNT(*) AS n FROM users').get().n >= 1);
        copy.close();
    });
});
