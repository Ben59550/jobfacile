// Tests : page Contact (formulaire envoyé par e-mail), robots.txt, sitemap.xml et titres propres à chaque page
process.env.CONTACT_EMAIL = 'equipe@exemple.test';
const { test, before, after, describe } = require('node:test');
const assert = require('node:assert/strict');
const t = require('./helpers');
const { testOutbox } = require('../src/mailer');

before(t.start);
after(t.stop);
const base = () => `http://127.0.0.1:${t.port()}`;

describe('Contact', () => {
    test('un message valide part par e-mail à l’équipe', async () => {
        const r = await t.api('/api/contact', { body: { name: 'Léa Test', email: 'lea@exemple.test', subject: 'Problème technique', message: 'Le bouton ne marche pas chez moi.' } });
        assert.equal(r.status, 200);
        const mail = testOutbox.find(m => m.to === 'equipe@exemple.test' && m.subject.includes('Léa Test'));
        assert.ok(mail);
        assert.match(mail.text, /lea@exemple\.test/);
    });
    test('refuse un e-mail invalide ou un message vide', async () => {
        assert.equal((await t.api('/api/contact', { body: { name: 'A', email: 'pas-un-mail', message: 'Bonjour à vous tous' } })).status, 400);
        assert.equal((await t.api('/api/contact', { body: { name: 'A', email: 'a@exemple.test', message: '' } })).status, 400);
    });
    test('un robot (champ caché rempli) ne déclenche aucun e-mail', async () => {
        const before = testOutbox.length;
        const r = await t.api('/api/contact', { body: { name: 'Bot', email: 'bot@exemple.test', message: 'Achetez maintenant !!!', website: 'http://spam' } });
        assert.equal(r.status, 200);
        assert.equal(testOutbox.length, before);
    });
});

describe('Référencement', () => {
    test('robots.txt annonce le sitemap et cache les pages privées', async () => {
        const txt = await (await fetch(base() + '/robots.txt')).text();
        assert.match(txt, /Sitemap: .+\/sitemap\.xml/);
        assert.match(txt, /Disallow: \/profil/);
    });
    test('sitemap.xml liste les pages publiques, dont Contact', async () => {
        const xml = await (await fetch(base() + '/sitemap.xml')).text();
        assert.match(xml, /<urlset/);
        assert.match(xml, /\/contact<\/loc>/);
        assert.doesNotMatch(xml, /\/profil/);
    });
    test('les articles de conseil sont écrits dans la page et listés dans le sitemap', async () => {
        const { ARTICLES } = require('../src/data/articles');
        assert.ok(ARTICLES.length >= 8);
        const slugs = new Set(ARTICLES.map(a => a.slug));
        assert.equal(slugs.size, ARTICLES.length, 'slugs uniques');
        const a = ARTICLES[0];
        const page = await fetch(base() + '/conseils/' + a.slug);
        const html = await page.text();
        assert.equal(page.status, 200);
        assert.ok(html.includes('<h1>' + a.title.replace(/’/g, '’') + '</h1>'), 'texte de l’article présent sans JavaScript');
        assert.match(html, new RegExp('<title>' + a.title + ' – JobFacile</title>'));
        const list = await (await fetch(base() + '/conseils')).text();
        assert.ok(ARTICLES.every(x => list.includes('href="/conseils/' + x.slug + '"')), 'liste des articles dans /conseils');
        const xml = await (await fetch(base() + '/sitemap.xml')).text();
        assert.ok(xml.includes('/conseils/' + a.slug + '</loc>'));
        assert.equal((await fetch(base() + '/conseils/inconnu')).status, 404);
        const api = await t.api('/api/articles/' + a.slug);
        assert.equal(api.body.article.slug, a.slug);
    });

    test('chaque page publique a son titre ; les pages privées ne sont pas indexées', async () => {
        const contact = await (await fetch(base() + '/contact')).text();
        assert.match(contact, /<title>Contactez-nous – JobFacile<\/title>/);
        assert.match(contact, /rel="canonical" href="[^"]+\/contact"/);
        assert.match(contact, /<meta property="og:title" content="Contactez-nous – JobFacile">/, 'aperçu de partage');
        assert.equal(contact.match(/property="og:title"/g).length, 1);
        const home = await (await fetch(base() + '/')).text();
        JSON.parse(home.match(/<script type="application\/ld\+json">(.+?)<\/script>/)[1]);
        const profil = await (await fetch(base() + '/profil')).text();
        assert.match(profil, /<meta name="robots" content="noindex">/);
    });
});
