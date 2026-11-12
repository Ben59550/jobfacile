// Outils communs aux tests : serveur lancé sur un port libre, avec une base de données temporaire.
// En mode test, le fichier .env n'est pas lu : aucune vraie clé n'est utilisée et aucun e-mail n'est envoyé
// (les e-mails sont gardés en mémoire dans « outbox » pour pouvoir lire les codes).
process.env.NODE_ENV = 'test';
const os = require('os');
const fs = require('fs');
const path = require('path');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jobfacile-test-'));
process.env.JOBFACILE_DATA_DIR = path.join(tmpDir, 'data');
process.env.JOBFACILE_UPLOADS_DIR = path.join(tmpDir, 'uploads');

const backend = require('../server.js');
const { app, getUsers, saveUsers, testOutbox: outbox, attempts } = backend;

let server = null;
let baseUrl = '';

async function start() {
    await new Promise((resolve) => { server = app.listen(0, '127.0.0.1', resolve); });
    baseUrl = `http://127.0.0.1:${server.address().port}`;
}

async function stop() {
    if (server) await new Promise((resolve) => server.close(resolve));
    try { backend.closeDb(); } catch (e) {}
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (e) {}
}

// Appel JSON : renvoie { status, body }
async function api(pathname, { body, token, headers = {}, method } = {}) {
    const h = { ...headers };
    if (body !== undefined) h['Content-Type'] = 'application/json';
    if (token) h.Authorization = 'Bearer ' + token;
    const res = await fetch(baseUrl + pathname, {
        method: method || (body !== undefined ? 'POST' : 'GET'),
        headers: h,
        body: body !== undefined ? JSON.stringify(body) : undefined
    });
    let data = null;
    try { data = await res.json(); } catch (e) {}
    return { status: res.status, body: data };
}

let counter = 0;
function newEmail(prefix = 'test') { return `${prefix}-${Date.now()}-${++counter}@exemple.test`; }

function validUser(overrides = {}) {
    return {
        firstName: 'Camille', lastName: 'Dupré', gender: 'F', birthDate: '1995-04-12', phone: '0612345678',
        email: newEmail(), password: 'MotDePasse-123', acceptTerms: true, ...overrides
    };
}

// Dernier code à 6 chiffres envoyé par e-mail à cette adresse
function lastCodeFor(email) {
    for (let i = outbox.length - 1; i >= 0; i--) {
        if (outbox[i].to === email) {
            const m = String(outbox[i].text).match(/\b(\d{6})\b/);
            if (m) return m[1];
        }
    }
    return null;
}
function mailsTo(email) { return outbox.filter((m) => m.to === email); }

// Crée un compte vérifié et renvoie { email, password, token, user }
async function createVerifiedUser(overrides = {}) {
    const u = validUser(overrides);
    const reg = await api('/api/register', { body: u });
    if (!reg.body.success) throw new Error('Inscription impossible : ' + reg.body.message);
    const verify = await api('/api/verify-code', { body: { email: u.email, code: lastCodeFor(u.email) } });
    if (!verify.body.success) throw new Error('Vérification impossible : ' + verify.body.message);
    return { email: u.email, password: u.password, token: verify.body.token, user: verify.body.user };
}

// Accès direct à un compte en base (pour simuler un code expiré, etc.)
function findUser(email) { return getUsers().find((u) => u.email === email); }
function updateUser(email, change) {
    const users = getUsers();
    const u = users.find((x) => x.email === email);
    change(u);
    saveUsers(users);
}

function port() { return server.address().port; }

module.exports = { port, start, stop, api, newEmail, validUser, lastCodeFor, mailsTo, createVerifiedUser, findUser, updateUser, outbox, attempts };
