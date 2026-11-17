// Routes des offres : recherche, villes, adresse exacte, salaire du marché, offre partagée.
const router = require('express').Router();
const { PUBLIC_URL } = require('../config');
const { FRANCE_CITIES } = require('../referentials');
const { clientIp, tooManyAttempts } = require('../security');
const { geoGet, geoSet, parseOfferLocation, locateCompany } = require('../services/geo');
const { geoCommunes, SEARCH_TTL, STATS_TTL, ADZUNA_APP_ID, ADZUNA_APP_KEY, runJobSearch, sharedSet, findOffer } = require('../services/jobSearch');
const { fold } = require('../utils');

router.get('/api/cities', async (req, res) => {
    const q = String(req.query.q || '').trim();
    if (q.length < 2) return res.json([]);
    try {
        const list = await geoCommunes(q, 8);
        res.json(list.map(c => ({ name: c.nom, dept: c.codeDepartement, code: c.code, postalCode: (c.codesPostaux || [])[0] || '' })));
    } catch (e) {
        res.json(FRANCE_CITIES.filter(c => fold(c.name).includes(fold(q))));
    }
});

router.get('/api/jobs', async (req, res) => {
    const keyword = String(req.query.keyword || '').trim();
    const location = String(req.query.location || '').trim();
    const type = ['all', 'emploi', 'alternance'].includes(req.query.type) ? req.query.type : 'all';
    const radius = [5, 10, 20, 30, 50, 100].includes(parseInt(req.query.radius)) ? parseInt(req.query.radius) : 20;
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 10, 1), 50);
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const days = [1, 3, 7, 30].includes(parseInt(req.query.days)) ? parseInt(req.query.days) : 0;
    const time = ['full', 'part'].includes(req.query.time) ? req.query.time : 'all';
    const remote = req.query.remote === '1';
    const audience = ['rqth', 'debutant', 'reconversion', 'senior'].includes(req.query.audience) ? req.query.audience : '';
    // Compteur de l'accueil : jamais via JSearch (quota mensuel trop faible), rafraîchi toutes les heures
    const statsOnly = req.query.stats === '1';
    const sort = req.query.sort === 'relevance' ? 'relevance' : 'date';
    const salary = [1500, 1800, 2000, 2500, 3000, 3500].includes(parseInt(req.query.salary)) ? parseInt(req.query.salary) : 0;
    const q = { keyword, location, radius, type, page, limit, days, time, remote, sort, salary, audience, ttl: statsOnly ? STATS_TTL : SEARCH_TTL };

    res.json(await runJobSearch(q, { statsOnly }));
});

router.post('/api/jobs/locate', async (req, res) => {
    if (tooManyAttempts('locate:' + clientIp(req), 60, 10 * 60 * 1000)) return res.status(429).json({ success: false, results: {} });
    const jobs = (Array.isArray(req.body.jobs) ? req.body.jobs : []).slice(0, 30)
        .map(j => ({ id: String(j && j.id || '').slice(0, 200), company: String(j && j.company || '').slice(0, 150), location: String(j && j.location || '').slice(0, 150) }))
        .filter(j => j.id);
    const results = {};
    // 4 requêtes en parallèle au maximum (l'annuaire limite à 7 par seconde)
    let i = 0;
    const worker = async () => {
        while (i < jobs.length) {
            const j = jobs[i++];
            try { const f = await locateCompany(j.company, j.location); if (f) results[j.id] = f; }
            catch (e) { if (e.message === 'quota') await new Promise(r => setTimeout(r, 1000)); }
        }
    };
    await Promise.all([worker(), worker(), worker(), worker()]);
    res.json({ success: true, results });
});

// ---------- Estimation de salaire : marché local ----------
// Calculée sur les salaires réellement affichés dans les offres Adzuna récentes (hors salaires « estimés » par Adzuna),
// ramenés en brut mensuel temps plein. Autour de la ville (30 km), sinon France entière.
const SALARY_TTL = 7 * 24 * 3600 * 1000;
function toMonthly(v) {
    if (!v || v <= 0) return null;
    if (v < 100) return v * 151.67;     // taux horaire
    if (v < 1000) return v * 21;        // journalier
    if (v < 5000) return v;             // mensuel
    return v / 12;                      // annuel
}
function quantile(sorted, q) {
    const pos = (sorted.length - 1) * q, lo = Math.floor(pos), hi = Math.ceil(pos);
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}
async function adzunaSalaries(what, where) {
    const params = new URLSearchParams({ app_id: ADZUNA_APP_ID, app_key: ADZUNA_APP_KEY, results_per_page: '50', what, max_days_old: '90', 'content-type': 'application/json' });
    if (where) { params.set('where', where); params.set('distance', '30'); }
    const r = await fetch('https://api.adzuna.com/v1/api/jobs/fr/search/1?' + params, { signal: AbortSignal.timeout(10000) });
    if (!r.ok) throw new Error('Adzuna ' + r.status);
    const d = await r.json();
    return (d.results || []).filter(o => o.salary_is_predicted !== '1' && (o.salary_min || o.salary_max)).map(o => {
        const a = toMonthly(o.salary_min || o.salary_max), b = toMonthly(o.salary_max || o.salary_min);
        return a && b ? (a + b) / 2 : null;
    }).filter(v => v && v >= 800 && v <= 20000); // valeurs aberrantes écartées
}
router.get('/api/salary', async (req, res) => {
    if (!ADZUNA_APP_ID || !ADZUNA_APP_KEY) return res.json({ success: false, message: 'Estimation indisponible.' });
    if (tooManyAttempts('salary:' + clientIp(req), 60, 10 * 60 * 1000)) return res.status(429).json({ success: false });
    // Intitulé simplifié : sans (H/F), sans parenthèses, 4 mots maximum
    const what = String(req.query.keyword || '').replace(/\(.*?\)|\b[hf]\s*\/\s*[fh]\b/gi, ' ').replace(/[^\p{L}\p{N}' -]+/gu, ' ').trim().split(/\s+/)
        .filter(w => /\p{L}{2,}/u.test(w) && !/^(et|ou|de|des|du|la|le|les|en|au|aux|pour|cdi|cdd|interim|intérim)$/i.test(w)).slice(0, 3).join(' ');
    const where = parseOfferLocation(req.query.location).name;
    if (what.length < 2) return res.status(400).json({ success: false });
    const key = 'salary|' + fold(what) + '|' + fold(where);
    const c = geoGet.get(key);
    if (c && Date.now() - c.at < SALARY_TTL) return res.json(JSON.parse(c.data));
    try {
        let values = where ? await adzunaSalaries(what, where) : [];
        let scope = 'local';
        if (values.length < 5) { values = await adzunaSalaries(what, ''); scope = 'national'; }
        let out;
        if (values.length < 5) out = { success: true, enough: false, n: values.length };
        else {
            values.sort((a, b) => a - b);
            const r10 = (v) => Math.round(v / 10) * 10;
            out = { success: true, enough: true, n: values.length, scope, where: scope === 'local' ? where : 'France', what,
                p25: r10(quantile(values, 0.25)), median: r10(quantile(values, 0.5)), p75: r10(quantile(values, 0.75)) };
        }
        geoSet.run(key, JSON.stringify(out), Date.now());
        res.json(out);
    } catch (e) {
        console.warn('Salaire :', e.message);
        res.json({ success: false, message: 'Estimation indisponible pour le moment.' });
    }
});

router.get('/api/jobs/offer/:id', async (req, res) => {
    const job = await findOffer(String(req.params.id).slice(0, 200));
    if (job) return res.json({ success: true, job });
    res.status(404).json({ success: false, message: 'Cette offre n’est plus disponible.' });
});

// Partage : l'offre est enregistrée pour que le lien fonctionne 60 jours
router.post('/api/jobs/share', async (req, res) => {
    if (tooManyAttempts('share:' + clientIp(req), 60, 60 * 60 * 1000)) return res.status(429).json({ success: false });
    const id = String((req.body.job || {}).id || '').slice(0, 200);
    if (!id) return res.status(400).json({ success: false });
    // On ne garde que la version connue du serveur (pas de contenu fourni par le navigateur)
    const job = await findOffer(id);
    if (!job) return res.status(404).json({ success: false, message: 'Offre introuvable.' });
    sharedSet.run(id, JSON.stringify(job), Date.now());
    res.json({ success: true, url: `${PUBLIC_URL}/offre/${encodeURIComponent(id)}` });
});

module.exports = router;
