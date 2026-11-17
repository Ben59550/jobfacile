// Adresse exacte des entreprises (annuaire officiel) et cache géographique.
const { db } = require('../db');
const { geoCommunes } = require('./jobSearch');
const { fold } = require('../utils');

// ---------- Adresse exacte des entreprises ----------
// Annuaire officiel des entreprises (recherche-entreprises.api.gouv.fr, gratuit, sans clé) :
// on cherche l'établissement actif de l'entreprise DANS la commune de l'offre. Résultats gardés 30 jours en base.
db.exec('CREATE TABLE IF NOT EXISTS geo_cache (key TEXT PRIMARY KEY, data TEXT, at INTEGER NOT NULL)');
const geoGet = db.prepare('SELECT data, at FROM geo_cache WHERE key = ?');
const geoSet = db.prepare('INSERT OR REPLACE INTO geo_cache (key, data, at) VALUES (?, ?, ?)');
const COMPANY_TTL = 30 * 24 * 3600 * 1000, COMPANY_MISS_TTL = 7 * 24 * 3600 * 1000;

// "59 - Maubeuge", "Maubeuge, Nord", "Maubeuge (59)" → { name: 'Maubeuge', dept: '59' }
function parseOfferLocation(loc) {
    let s = String(loc || '').trim();
    let dept = null;
    const m = s.match(/^(\d{2,3}|2[AB])\s*-\s*(.+)$/i);
    if (m) { dept = m[1]; s = m[2]; }
    const p = s.match(/\((\d{2,3}|2[AB])\)/i);
    if (p) { dept = dept || p[1]; s = s.replace(p[0], ''); }
    s = s.split(',')[0].replace(/\b(cedex|arrondissement)\b.*$/i, '').replace(/\s+\d+(e|er|ème)?$/i, '').trim();
    s = s.replace(/-(nord|sud|est|ouest|centre)$/i, ''); // cantons d'Adzuna : « Maubeuge-Sud »
    return { name: s, dept };
}
async function communeFor(loc) {
    const { name, dept } = parseOfferLocation(loc);
    if (!name || name.length < 2 || /^(france|télétravail|teletravail)$/i.test(name)) return null;
    const key = 'commune|' + fold(name) + '|' + (dept || '');
    const c = geoGet.get(key);
    if (c) return JSON.parse(c.data);
    const list = await geoCommunes(name, 5).catch(() => []);
    const hit = list.find(x => (!dept || x.codeDepartement === dept) && fold(x.nom) === fold(name)) || list.find(x => !dept || x.codeDepartement === dept) || null;
    const code = hit ? hit.code : null;
    geoSet.run(key, JSON.stringify(code), Date.now());
    return code;
}
async function locateCompany(company, location) {
    const name = String(company || '').trim();
    if (!name || /non communiqu|confidentiel|^entreprise$/i.test(name)) return null;
    const key = 'company|' + fold(name) + '|' + fold(location);
    const c = geoGet.get(key);
    if (c) {
        const data = JSON.parse(c.data);
        if (Date.now() - c.at < (data ? COMPANY_TTL : COMPANY_MISS_TTL)) return data;
    }
    const commune = await communeFor(location);
    if (!commune) return null;
    const params = new URLSearchParams({ q: name.slice(0, 100), code_commune: commune, etat_administratif: 'A', per_page: '3', limite_matching_etablissements: '5' });
    const r = await fetch('https://recherche-entreprises.api.gouv.fr/search?' + params, { signal: AbortSignal.timeout(6000) });
    if (r.status === 429) throw new Error('quota');
    if (!r.ok) throw new Error('annuaire ' + r.status);
    const data = await r.json();
    let found = null;
    for (const res of data.results || []) {
        const e = (res.matching_etablissements || []).find(x => x.commune === commune && x.etat_administratif === 'A' && x.latitude && x.longitude);
        if (e) {
            const label = (e.liste_enseignes && e.liste_enseignes[0]) || res.nom_raison_sociale || res.nom_complet;
            found = { lat: parseFloat(e.latitude), lng: parseFloat(e.longitude), address: String(e.adresse || '').replace(/\s+/g, ' ').trim(), name: label };
            break;
        }
    }
    geoSet.run(key, JSON.stringify(found), Date.now());
    return found;
}

module.exports = { geoGet, geoSet, parseOfferLocation, locateCompany };
