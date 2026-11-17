// Tests : parrainage, espace recruteur, candidature et messagerie, forum, signalements et modération
process.env.ADMIN_EMAILS = 'admin-test@exemple.test';
const { test, before, after, describe } = require('node:test');
const assert = require('node:assert/strict');
const t = require('./helpers');

before(t.start);
after(t.stop);

// Un recruteur « vérifié » (sans appeler l'annuaire des entreprises pendant les tests)
async function recruiter() {
    const acc = await t.createVerifiedUser({ firstName: 'Rémi', lastName: 'Recruteur' });
    t.updateUser(acc.email, (u) => {
        u.recruiter = { siret: '32992501007041', siren: '329925010', company: 'Logistique Test', address: '10 avenue Jean Mabuse 59600 Maubeuge', postcode: '59600', city: 'Maubeuge', lat: 50.277, lng: 3.974, contactName: 'Rémi Recruteur', verifiedAt: new Date().toISOString() };
    });
    return acc;
}
const OFFER = { title: 'Cariste H/F', contract: 'CDI', city: 'Maubeuge', salary: '1 900 € brut / mois', description: 'Au sein de notre entrepôt de Maubeuge, vous assurez le chargement et le déchargement des camions, le rangement en racks et les inventaires tournants. Travail en journée, du lundi au vendredi.', requirements: 'CACES R489 cat. 3' };
async function publish(rec, over = {}) {
    const r = await t.api('/api/recruiter/offers', { token: rec.token, body: { ...OFFER, ...over } });
    assert.equal(r.body.success, true, r.body.message);
    return r.body;
}
const APPLY_MSG = 'Bonjour, je suis cariste depuis six ans et votre offre correspond exactement à ce que je recherche près de chez moi.';

describe('Parrainage', () => {
    test('le filleul ne compte qu’une fois son e-mail vérifié', async () => {
        const parrain = await t.createVerifiedUser();
        const ref = await t.api('/api/user/referral', { token: parrain.token });
        assert.match(ref.body.code, /^[A-Z2-9]{7}$/);
        assert.equal((await t.api('/api/referral/' + ref.body.code)).body.firstName, 'Camille');
        const filleul = t.validUser({ referralCode: ref.body.code.toLowerCase() });
        await t.api('/api/register', { body: filleul });
        let r = await t.api('/api/user/referral', { token: parrain.token });
        assert.equal(r.body.count, 0);
        assert.equal(r.body.pending, 1);
        await t.api('/api/verify-code', { body: { email: filleul.email, code: t.lastCodeFor(filleul.email) } });
        r = await t.api('/api/user/referral', { token: parrain.token });
        assert.equal(r.body.count, 1);
        assert.equal(r.body.recent[0].name, 'Camille D.', 'seulement le prénom et l’initiale');
    });
    test('un code inconnu est ignoré', async () => {
        const u = t.validUser({ referralCode: 'XXXXXXX' });
        const r = await t.api('/api/register', { body: u });
        assert.equal(r.body.success, true);
        assert.equal(t.findUser(u.email).referredBy, undefined);
    });
});

describe('Espace recruteur', () => {
    test('publier exige une entreprise vérifiée', async () => {
        const acc = await t.createVerifiedUser();
        const r = await t.api('/api/recruiter/offers', { token: acc.token, body: OFFER });
        assert.equal(r.status, 403);
    });
    test('refuse un SIRET mal formé', async () => {
        const acc = await t.createVerifiedUser();
        const r = await t.api('/api/recruiter/verify', { token: acc.token, body: { siret: '1234' } });
        assert.equal(r.status, 400);
    });
    test('refuse une description trop courte', async () => {
        const rec = await recruiter();
        const r = await t.api('/api/recruiter/offers', { token: rec.token, body: { ...OFFER, description: 'Trop court.' } });
        assert.equal(r.status, 400);
    });
    test('une offre publiée est en ligne, avec l’entreprise vérifiée', async () => {
        const rec = await recruiter();
        const p = await publish(rec);
        assert.equal(p.status, 'active');
        const o = await t.api('/api/jobs/offer/' + p.id);
        assert.equal(o.body.job.company, 'Logistique Test');
        assert.equal(o.body.job.localOffer, true);
        const mine = await t.api('/api/recruiter/offers', { token: rec.token });
        assert.equal(mine.body.offers.length, 1);
    });
    test('une annonce qui demande de l’argent au candidat part en vérification', async () => {
        const rec = await recruiter();
        const p = await publish(rec, { description: OFFER.description + ' Des frais de dossier à votre charge sont à régler par Western Union avant le début.' });
        assert.equal(p.status, 'review');
        assert.equal((await t.api('/api/jobs/offer/' + p.id)).status, 404, 'invisible tant qu’elle n’est pas validée');
    });
    test('une offre fermée n’est plus visible', async () => {
        const rec = await recruiter();
        const p = await publish(rec);
        await t.api(`/api/recruiter/offers/${p.id}/status`, { token: rec.token, body: { status: 'closed' } });
        assert.equal((await t.api('/api/jobs/offer/' + p.id)).status, 404);
    });
    test('un autre compte ne peut pas modifier l’offre', async () => {
        const rec = await recruiter(), other = await recruiter();
        const p = await publish(rec);
        const r = await t.api('/api/recruiter/offers', { token: other.token, body: { ...OFFER, id: p.id, title: 'Piratée' } });
        assert.equal(r.status, 404);
    });
});

describe('Candidature et messagerie', () => {
    test('candidater ouvre une conversation, ajoute au suivi et prévient le recruteur', async () => {
        const rec = await recruiter(), cand = await t.createVerifiedUser();
        const p = await publish(rec);
        const before = t.mailsTo(rec.email).length;
        const a = await t.api(`/api/local-offers/${p.id}/apply`, { token: cand.token, body: { message: APPLY_MSG } });
        assert.equal(a.body.success, true, a.body.message);
        assert.ok(a.body.user.applications.some(x => x.id === p.id && x.status === 'applied'));
        assert.equal(t.mailsTo(rec.email).length, before + 1);
        assert.equal((await t.api('/api/messages/unread', { token: rec.token })).body.count, 1);
        const again = await t.api(`/api/local-offers/${p.id}/apply`, { token: cand.token, body: { message: APPLY_MSG } });
        assert.equal(again.status, 400, 'une seule candidature par offre');
    });
    test('on ne peut pas candidater à sa propre offre', async () => {
        const rec = await recruiter();
        const p = await publish(rec);
        assert.equal((await t.api(`/api/local-offers/${p.id}/apply`, { token: rec.token, body: { message: APPLY_MSG } })).status, 400);
    });
    test('seuls le candidat et le recruteur voient la conversation', async () => {
        const rec = await recruiter(), cand = await t.createVerifiedUser(), stranger = await t.createVerifiedUser();
        const p = await publish(rec);
        const a = await t.api(`/api/local-offers/${p.id}/apply`, { token: cand.token, body: { message: APPLY_MSG } });
        const id = a.body.conversationId;
        assert.equal((await t.api('/api/conversations/' + id, { token: stranger.token })).status, 404);
        assert.equal((await t.api(`/api/conversations/${id}/messages`, { token: stranger.token, body: { body: 'Intrusion' } })).status, 404);
        const seen = await t.api('/api/conversations/' + id, { token: rec.token });
        assert.equal(seen.body.messages.length, 2, 'présentation du profil + message');
        assert.equal((await t.api('/api/messages/unread', { token: rec.token })).body.count, 0, 'lu en ouvrant');
    });
    test('le statut choisi par le recruteur met à jour le suivi du candidat', async () => {
        const rec = await recruiter(), cand = await t.createVerifiedUser();
        const p = await publish(rec);
        const a = await t.api(`/api/local-offers/${p.id}/apply`, { token: cand.token, body: { message: APPLY_MSG } });
        const r = await t.api(`/api/conversations/${a.body.conversationId}/status`, { token: rec.token, body: { status: 'interview' } });
        assert.equal(r.body.success, true);
        assert.equal(t.findUser(cand.email).applications.find(x => x.id === p.id).status, 'interview');
        assert.ok(t.mailsTo(cand.email).some(m => /entretien/i.test(m.subject)));
        // le candidat ne peut pas changer le statut
        assert.equal((await t.api(`/api/conversations/${a.body.conversationId}/status`, { token: cand.token, body: { status: 'offer' } })).status, 404);
    });
});

describe('Forum', () => {
    test('il faut un compte vérifié pour publier', async () => {
        const u = t.validUser();
        await t.api('/api/register', { body: u });
        const login = await t.api('/api/login', { body: { email: u.email, password: u.password } });
        assert.equal(login.body.token, undefined);
        assert.equal((await t.api('/api/forum/topics', { body: { category: 'cv', title: 'Une question', body: 'Mon message de test' } })).status, 401);
    });
    test('les téléphones et e-mails sont masqués, le nom réduit au prénom + initiale', async () => {
        const acc = await t.createVerifiedUser();
        const r = await t.api('/api/forum/topics', { token: acc.token, body: { category: 'cv', title: 'Relire mon CV de cariste', body: 'Qui peut relire mon CV ? Écrivez-moi à moi@exemple.fr ou au 06 12 34 56 78.' } });
        assert.equal(r.body.success, true, r.body.message);
        const topic = (await t.api('/api/forum/topics/' + r.body.id)).body.topic;
        assert.doesNotMatch(topic.body, /moi@exemple\.fr|06 12 34 56 78/);
        assert.match(topic.body, /\[e-mail masqué\].*\[téléphone masqué\]/);
        assert.equal(topic.author, 'Camille D.');
    });
    test('répondre, voter « utile » (pas pour soi-même)', async () => {
        const a = await t.createVerifiedUser(), b = await t.createVerifiedUser();
        const topic = await t.api('/api/forum/topics', { token: a.token, body: { category: 'entretien', title: 'Question piège en entretien', body: 'Comment répondre à « quel est votre défaut » ?' } });
        const post = await t.api(`/api/forum/topics/${topic.body.id}/posts`, { token: b.token, body: { body: 'Choisissez un vrai défaut et montrez comment vous le corrigez.' } });
        assert.equal(post.body.success, true);
        assert.equal((await t.api(`/api/forum/topic/${topic.body.id}/like`, { token: a.token, body: {} })).status, 400);
        const like = await t.api(`/api/forum/post/${post.body.id}/like`, { token: a.token, body: {} });
        assert.deepEqual([like.body.liked, like.body.likes], [true, 1]);
        const list = await t.api('/api/forum/topics?cat=entretien');
        assert.equal(list.body.topics.find(x => x.id === topic.body.id).replies, 1);
    });
    test('3 signalements masquent un message ; l’administrateur décide', async () => {
        const author = await t.createVerifiedUser();
        const topic = await t.api('/api/forum/topics', { token: author.token, body: { category: 'divers', title: 'Message à signaler', body: 'Contenu signalé par trois personnes.' } });
        for (let i = 0; i < 3; i++) {
            const r = await t.createVerifiedUser();
            await t.api('/api/reports', { token: r.token, body: { kind: 'topic', id: String(topic.body.id), reason: 'test' } });
        }
        assert.equal((await t.api('/api/forum/topics/' + topic.body.id)).status, 404, 'masqué pour les visiteurs');
        const user = await t.createVerifiedUser();
        assert.equal((await t.api('/api/admin/queue', { token: user.token })).status, 403, 'réservé aux administrateurs');
        const admin = await t.createVerifiedUser({ email: 'admin-test@exemple.test' });
        assert.equal(admin.user.isAdmin, true);
        const queue = await t.api('/api/admin/queue', { token: admin.token });
        assert.ok(queue.body.items.some(i => i.kind === 'topic' && i.id === String(topic.body.id)));
        await t.api('/api/admin/action', { token: admin.token, body: { action: 'restore', kind: 'topic', id: String(topic.body.id) } });
        assert.equal((await t.api('/api/forum/topics/' + topic.body.id)).status, 200);
    });
    test('un compte suspendu ne peut plus publier et ses messages disparaissent', async () => {
        const bad = await t.createVerifiedUser();
        const topic = await t.api('/api/forum/topics', { token: bad.token, body: { category: 'divers', title: 'Message d’un compte suspendu', body: 'Ce message va disparaître.' } });
        const admin = await t.api('/api/login', { body: { email: 'admin-test@exemple.test', password: 'MotDePasse-123' } });
        const r = await t.api('/api/admin/action', { token: admin.body.token, body: { action: 'ban', userId: t.findUser(bad.email).id } });
        assert.equal(r.body.success, true);
        assert.equal((await t.api('/api/forum/topics/' + topic.body.id)).status, 404);
        assert.equal((await t.api('/api/forum/topics', { token: bad.token, body: { category: 'divers', title: 'Encore un message', body: 'Je reviens.' } })).status, 403);
    });
});
