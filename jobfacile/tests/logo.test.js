// Logos d'entreprise : seuls les serveurs autorisés par la politique de sécurité sont gardés
const test = require('node:test');
const assert = require('node:assert');
const { safeLogo } = require('../src/services/jobSearch');

test('safeLogo garde les logos France Travail et Google, refuse le reste', () => {
    assert.strictEqual(safeLogo('https://entreprise.francetravail.fr/static/img/logos/abc.png'), 'https://entreprise.francetravail.fr/static/img/logos/abc.png');
    assert.ok(safeLogo('https://encrypted-tbn0.gstatic.com/images?q=tbn:x'));
    assert.strictEqual(safeLogo('http://entreprise.francetravail.fr/logo.png'), undefined);
    assert.strictEqual(safeLogo('https://francetravail.fr.evil.com/logo.png'), undefined);
    assert.strictEqual(safeLogo('javascript:alert(1)'), undefined);
    assert.strictEqual(safeLogo(null), undefined);
});
