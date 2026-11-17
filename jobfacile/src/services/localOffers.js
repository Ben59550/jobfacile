// Offres publiées directement sur JobFacile par des recruteurs vérifiés (SIRET actif dans l'annuaire officiel).
// Elles apparaissent en tête des résultats de recherche quand elles correspondent (mots-clés + distance).
const crypto = require('crypto');
const { db } = require('../db');
const { fold } = require('../utils');

db.exec(`
    CREATE TABLE IF NOT EXISTS local_offers (
        id TEXT PRIMARY KEY,
        owner_id TEXT NOT NULL,
        data TEXT NOT NULL,              -- offre au même format que les autres sources (title, company, location…)
        status TEXT NOT NULL,            -- active | review | closed | removed | hidden
        lat REAL, lng REAL, postcode TEXT,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL, expires_at TEXT NOT NULL,
        views INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS local_offers_owner ON local_offers (owner_id);
`);
const OFFER_DAYS = 60;
const st = {
    get: db.prepare('SELECT * FROM local_offers WHERE id = ?'),
    byOwner: db.prepare('SELECT * FROM local_offers WHERE owner_id = ? AND status != \'removed\' ORDER BY created_at DESC'),
    active: db.prepare('SELECT * FROM local_offers WHERE status = \'active\' AND expires_at > ?'),
    insert: db.prepare('INSERT INTO local_offers (id, owner_id, data, status, lat, lng, postcode, created_at, updated_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'),
    update: db.prepare('UPDATE local_offers SET data = ?, status = ?, lat = ?, lng = ?, postcode = ?, updated_at = ?, expires_at = ? WHERE id = ?'),
    setStatus: db.prepare('UPDATE local_offers SET status = ?, updated_at = ? WHERE id = ?'),
    view: db.prepare('UPDATE local_offers SET views = views + 1 WHERE id = ?'),
    review: db.prepare('SELECT * FROM local_offers WHERE status IN (\'review\', \'hidden\') ORDER BY updated_at')
};
const parse = (row) => row ? { ...row, offer: JSON.parse(row.data) } : null;

function newOfferId() { return 'jf-' + crypto.randomBytes(6).toString('hex'); }
function getOffer(id) { return parse(st.get.get(String(id))); }
function offersByOwner(ownerId) { return st.byOwner.all(String(ownerId)).map(parse); }
function offersToReview() { return st.review.all().map(parse); }
function saveOffer({ id, ownerId, offer, status, lat, lng, postcode }) {
    const now = new Date().toISOString();
    const expires = new Date(Date.now() + OFFER_DAYS * 864e5).toISOString();
    if (st.get.get(id)) st.update.run(JSON.stringify(offer), status, lat, lng, postcode, now, expires, id);
    else st.insert.run(id, ownerId, JSON.stringify(offer), status, lat, lng, postcode, now, now, expires);
}
function setOfferStatus(id, status) { st.setStatus.run(status, new Date().toISOString(), String(id)); }
function countView(id) { st.view.run(String(id)); }

// Distance en km entre deux points (formule de haversine)
function km(a, b) {
    const R = 6371, rad = (x) => x * Math.PI / 180;
    const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
}
// Centre d'une commune (pour la distance) — « 59 » = tout le département
const placeCache = new Map();
async function resolvePlace(location) {
    const l = String(location || '').trim();
    if (!l) return null;
    if (/^(\d{2,3}|2[ab])$/i.test(l)) return { dept: l.toUpperCase() };
    const k = fold(l);
    if (placeCache.has(k)) return placeCache.get(k);
    const params = new URLSearchParams({ fields: 'nom,code,codesPostaux,codeDepartement,centre', boost: 'population', limit: '1' });
    if (/^\d{5}$/.test(l)) params.set('codePostal', l); else params.set('nom', l);
    let place = null;
    try {
        const r = await fetch('https://geo.api.gouv.fr/communes?' + params, { signal: AbortSignal.timeout(5000) });
        const c = r.ok ? (await r.json())[0] : null;
        if (c && c.centre) place = { name: c.nom, dept: c.codeDepartement, postcode: (c.codesPostaux || [])[0] || '', lat: c.centre.coordinates[1], lng: c.centre.coordinates[0] };
    } catch (e) { /* réseau indisponible */ }
    placeCache.set(k, place);
    return place;
}

// Offres locales correspondant à une recherche (mots-clés dans l'intitulé ou la description, distance, type)
async function searchLocalOffers({ keyword, location, radius = 20, type = 'all', remote = false }) {
    let rows = st.active.all(new Date().toISOString()).map(parse);
    const words = fold(keyword).split(/[^a-z0-9]+/).filter(w => w.length >= 3).map(w => w.slice(0, 6));
    if (words.length) rows = rows.filter(r => { const t = fold(`${r.offer.title} ${r.offer.domain} ${r.offer.fullDescription}`); return words.every(w => t.includes(w)); });
    if (type !== 'all') rows = rows.filter(r => r.offer.category === type);
    if (remote) rows = rows.filter(r => r.offer.remote);
    const place = await resolvePlace(location);
    if (location && !place) return [];
    if (place && place.lat !== undefined) {
        rows = rows.filter(r => r.lat !== null && km(place, r) <= radius).map(r => ({ ...r, distance: km(place, r) })).sort((a, b) => a.distance - b.distance);
    } else if (place && place.dept) rows = rows.filter(r => String(r.postcode || '').startsWith(place.dept.length === 3 ? place.dept : place.dept.padStart(2, '0')));
    return rows.map(r => ({ ...r.offer, lat: r.lat, lng: r.lng }));
}

module.exports = { newOfferId, getOffer, offersByOwner, offersToReview, saveOffer, setOfferStatus, countView, searchLocalOffers, resolvePlace, km, OFFER_DAYS };
