// Référentiel ROME 4.0 (métiers et compétences) et recherche de compétences.
const fs = require('fs');
const path = require('path');
const router = require('express').Router();
const { DATA_DIR } = require('../config');
const { ROME_FULL_REFERENTIAL } = require('../referentials');
const { FT_CLIENT_ID, FT_CLIENT_SECRET } = require('../services/jobSearch');
const { fold } = require('../utils');

// ---------- Référentiel ROME 4.0 complet (France Travail) ----------
// Téléchargé une fois, gardé sur disque, rafraîchi tous les 30 jours. Recherche locale = instantanée.
const ROME_FILE = path.join(DATA_DIR, 'rome.json');
const ROME_MAX_AGE = 30 * 24 * 3600 * 1000;
let romeIndex = null; // [{ name, type, f }]
let romeLoading = null;

function buildRomeIndex(items) {
    const seen = new Set();
    const out = [];
    for (const it of items) {
        const name = String(it.name || '').trim();
        const k = fold(name);
        if (!name || seen.has(k)) continue;
        seen.add(k);
        out.push({ name, type: it.type, f: k });
    }
    return out;
}

async function downloadRome() {
    const tokenFor = async (scope) => {
        const r = await fetch('https://entreprise.francetravail.fr/connexion/oauth2/access_token?realm=%2Fpartenaire', {
            method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ grant_type: 'client_credentials', client_id: FT_CLIENT_ID, client_secret: FT_CLIENT_SECRET, scope }),
            signal: AbortSignal.timeout(15000)
        });
        const d = await r.json().catch(() => ({}));
        if (!d.access_token) throw new Error('accès ROME refusé (' + (d.error || r.status) + ')');
        return d.access_token;
    };
    const wait = (ms) => new Promise(r => setTimeout(r, ms));
    const get = async (token, url) => {
        for (let attempt = 0; attempt < 4; attempt++) {
            const r = await fetch(url, { headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' }, signal: AbortSignal.timeout(60000) });
            if (r.status === 429) { await wait(2000 * (attempt + 1)); continue; } // limite de débit : on patiente
            if (!r.ok) throw new Error(`${url.split('/').pop()} → ${r.status}`);
            return r.json();
        }
        throw new Error('limite de débit France Travail');
    };
    const BASE = 'https://api.francetravail.io/partenaire';
    const tMet = await tokenFor('api_rome-metiersv1 nomenclatureRome');
    const appellations = await get(tMet, `${BASE}/rome-metiers/v1/metiers/appellation`);
    await wait(1200);
    const tComp = await tokenFor('api_rome-competencesv1 nomenclatureRome');
    const competences = await get(tComp, `${BASE}/rome-competences/v1/competences/competence`);
    await wait(1200);
    const savoirs = await get(tComp, `${BASE}/rome-competences/v1/competences/savoir`);
    return [
        ...appellations.map(a => ({ name: a.libelle, type: 'Métier' })),
        ...competences.map(c => ({ name: c.libelle, type: 'Compétence' })),
        ...savoirs.map(s => ({ name: s.libelle, type: 'Savoir' }))
    ];
}

function loadRome() {
    if (romeLoading) return romeLoading;
    romeLoading = (async () => {
        let saved = null;
        try { saved = JSON.parse(fs.readFileSync(ROME_FILE, 'utf8')); } catch (e) {}
        if (saved && Array.isArray(saved.items)) romeIndex = buildRomeIndex(saved.items);
        const fresh = saved && Date.now() - new Date(saved.downloadedAt).getTime() < ROME_MAX_AGE;
        if (fresh) return;
        if (!FT_CLIENT_ID || !FT_CLIENT_SECRET) return;
        try {
            const items = await downloadRome();
            fs.writeFileSync(ROME_FILE, JSON.stringify({ downloadedAt: new Date().toISOString(), items }), 'utf8');
            romeIndex = buildRomeIndex(items);
            console.log(`📚 Référentiel ROME téléchargé : ${romeIndex.length} métiers et compétences.`);
        } catch (e) {
            console.warn('⚠️  Référentiel ROME indisponible :', e.message, romeIndex ? '(ancienne version utilisée)' : '(petite liste intégrée utilisée)');
        }
    })().catch(e => console.warn('⚠️  Référentiel ROME :', e.message)).finally(() => { romeLoading = null; });
    return romeLoading;
}

router.get('/api/skills/search', (req, res) => {
    const q = fold(req.query.q);
    if (q.length < 2) return res.json([]);
    const index = romeIndex || buildRomeIndex(ROME_FULL_REFERENTIAL);
    const words = q.split(/\s+/).filter(Boolean);
    const TYPE_RANK = { 'Métier': 0, 'Compétence': 1, 'Savoir': 2 };
    const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const B = '[\\s/\'(),.-]';
    const exactWord = new RegExp(`(^|${B})${esc(q)}($|${B})`);
    const wordStart = new RegExp(`(^|${B})${esc(words[0])}`);
    const results = [];
    for (const it of index) {
        if (!words.every(w => it.f.includes(w))) continue;
        // Classement : identique > mot exact > commence par > un mot commence par > contient
        const rank = it.f === q ? 0 : exactWord.test(it.f) ? 1 : it.f.startsWith(q) ? 2 : wordStart.test(it.f) ? 3 : 4;
        results.push({ it, rank });
    }
    results.sort((a, b) => a.rank - b.rank || (TYPE_RANK[a.it.type] ?? 3) - (TYPE_RANK[b.it.type] ?? 3) || a.it.name.length - b.it.name.length);
    res.json(results.slice(0, 30).map(({ it }) => ({ name: it.name, type: it.type })));
});

module.exports = router;
module.exports.loadRome = loadRome;
