// Tests : rappels du suivi par e-mail (entretien du lendemain, candidature à relancer)
const { test, before, after, describe } = require('node:test');
const assert = require('node:assert/strict');
const t = require('./helpers');
const { checkTrackerReminders, dueReminders, reminderToken } = require('../src/services/reminders');

before(t.start);
after(t.stop);

const DAY = 24 * 3600 * 1000;
const iso = (ms) => new Date(ms).toISOString();
const localIn = (ms) => { const d = new Date(Date.now() + ms); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };
const job = (n) => ({ id: 'j' + n, title: 'Cariste ' + n, company: 'Entreprise ' + n, location: 'Maubeuge' });

function withApps(email, apps) { t.updateUser(email, (u) => { u.applications = apps; }); }

describe('Ce qui doit être rappelé', () => {
    test('un entretien dans les 24 h, pas un entretien dans 3 jours ni passé', () => {
        const due = dueReminders({ applications: [
            { id: 'a', job: job(1), status: 'interview', interview: { at: localIn(20 * 3600 * 1000) } },
            { id: 'b', job: job(2), status: 'interview', interview: { at: localIn(3 * DAY) } },
            { id: 'c', job: job(3), status: 'interview', interview: { at: localIn(-3600 * 1000) } }
        ] });
        assert.deepEqual(due.interviews.map(a => a.id), ['a']);
    });

    test('une candidature sans nouvelles depuis 7 jours, pas depuis 3 jours, ni si déjà relancée récemment', () => {
        const due = dueReminders({ applications: [
            { id: 'old', job: job(1), status: 'applied', appliedAt: iso(Date.now() - 8 * DAY) },
            { id: 'recent', job: job(2), status: 'applied', appliedAt: iso(Date.now() - 3 * DAY) },
            { id: 'followed', job: job(3), status: 'applied', appliedAt: iso(Date.now() - 10 * DAY), followUps: [iso(Date.now() - 2 * DAY)] },
            { id: 'interview', job: job(4), status: 'interview', appliedAt: iso(Date.now() - 10 * DAY) }
        ] });
        assert.deepEqual(due.relances.map(a => a.id), ['old']);
    });
});

describe('Envoi', () => {
    test('un seul e-mail regroupe tout, puis rien de plus le même jour', async () => {
        const acc = await t.createVerifiedUser();
        withApps(acc.email, [
            { id: 'a1', job: job(1), status: 'interview', interview: { at: localIn(18 * 3600 * 1000), kind: 'onsite', place: '10 rue de la Gare' } },
            { id: 'a2', job: job(2), status: 'applied', appliedAt: iso(Date.now() - 9 * DAY) }
        ]);
        const before = t.mailsTo(acc.email).length;
        await checkTrackerReminders({ force: true });
        const mails = t.mailsTo(acc.email);
        assert.equal(mails.length, before + 1);
        const mail = mails[mails.length - 1];
        assert.match(mail.subject, /entretien/i);
        assert.match(mail.text, /Entreprise 1/);
        assert.match(mail.text, /Entreprise 2/);
        assert.match(mail.html, /reminders\/unsubscribe/);
        await checkTrackerReminders({ force: true });
        assert.equal(t.mailsTo(acc.email).length, before + 1, 'pas de deuxième e-mail');
    });

    test('chaque élément n’est rappelé qu’une fois', async () => {
        const acc = await t.createVerifiedUser();
        withApps(acc.email, [{ id: 'a1', job: job(1), status: 'applied', appliedAt: iso(Date.now() - 9 * DAY) }]);
        await checkTrackerReminders({ force: true });
        t.updateUser(acc.email, (u) => { u.lastReminderAt = iso(Date.now() - 2 * DAY); }); // le lendemain
        const n = t.mailsTo(acc.email).length;
        await checkTrackerReminders({ force: true });
        assert.equal(t.mailsTo(acc.email).length, n);
    });

    test('pas d’e-mail la nuit', async () => {
        const acc = await t.createVerifiedUser();
        withApps(acc.email, [{ id: 'a1', job: job(1), status: 'applied', appliedAt: iso(Date.now() - 9 * DAY) }]);
        const night = new Date(); night.setHours(3, 0, 0, 0);
        const n = t.mailsTo(acc.email).length;
        await checkTrackerReminders({ now: night.getTime() });
        assert.equal(t.mailsTo(acc.email).length, n);
    });

    test('rien si l’utilisateur a désactivé les rappels', async () => {
        const acc = await t.createVerifiedUser();
        await t.api('/api/user/update', { token: acc.token, body: { trackerEmails: false } });
        withApps(acc.email, [{ id: 'a1', job: job(1), status: 'applied', appliedAt: iso(Date.now() - 9 * DAY) }]);
        const n = t.mailsTo(acc.email).length;
        await checkTrackerReminders({ force: true });
        assert.equal(t.mailsTo(acc.email).length, n);
    });
});

describe('Désinscription par lien', () => {
    test('un lien falsifié est refusé, le bon lien désactive les rappels', async () => {
        const acc = await t.createVerifiedUser();
        const id = t.findUser(acc.email).id;
        await t.api(`/api/tracker/reminders/unsubscribe?u=${encodeURIComponent(id)}&t=${'0'.repeat(32)}`);
        assert.notEqual(t.findUser(acc.email).trackerEmails, false);
        await t.api(`/api/tracker/reminders/unsubscribe?u=${encodeURIComponent(id)}&t=${reminderToken(id)}`);
        assert.equal(t.findUser(acc.email).trackerEmails, false);
    });
});
