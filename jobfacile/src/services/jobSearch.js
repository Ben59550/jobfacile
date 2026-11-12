// Recherche d’offres : France Travail, Adzuna, JSearch, La bonne alternance, cache 24 h, doublons, offres partagées.
const fs = require('fs');
const path = require('path');
const { DATA_DIR } = require('../config');
const { db } = require('../db');
const { NATIONAL_JOBS } = require('../referentials');
const { fold } = require('../utils');

// ---------- Offres ----------
// Communes réelles via l'API officielle geo.api.gouv.fr (gratuite, sans clé)
async function geoCommunes(q, limit = 8) {
    const isPostal = /^\d{5}$/.test(q);
    const params = new URLSearchParams({ fields: 'nom,code,codesPostaux,codeDepartement,population', boost: 'population' });
    if (isPostal) params.set('codePostal', q); else { params.set('nom', q); params.set('limit', String(limit)); }
    const r = await fetch('https://geo.api.gouv.fr/communes?' + params.toString(), { signal: AbortSignal.timeout(5000) });
    if (!r.ok) return [];
    const list = await r.json();
    // Pour un code postal : la commune la plus peuplée d'abord (ex. 59600 → Maubeuge)
    if (isPostal) list.sort((a, b) => (b.population || 0) - (a.population || 0));
    return list.slice(0, limit);
}

// --- API France Travail « Offres d'emploi v2 » ---
const FT_CLIENT_ID = process.env.FT_CLIENT_ID;
const FT_CLIENT_SECRET = process.env.FT_CLIENT_SECRET;
let ftToken = null;
let ftTokenExpires = 0;
let ftLastError = null;

async function getFtToken() {
    if (!FT_CLIENT_ID || !FT_CLIENT_SECRET) throw new Error('Identifiants France Travail absents du fichier .env.');
    if (ftToken && Date.now() < ftTokenExpires) return ftToken;
    const body = new URLSearchParams({
        grant_type: 'client_credentials', client_id: FT_CLIENT_ID, client_secret: FT_CLIENT_SECRET,
        scope: 'api_offresdemploiv2 o2dsoffre'
    });
    const r = await fetch('https://entreprise.francetravail.fr/connexion/oauth2/access_token?realm=%2Fpartenaire', {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body,
        signal: AbortSignal.timeout(10000)
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok || !data.access_token) {
        const msg = data.error === 'invalid_scope'
            ? "Votre application France Travail n'est pas abonnée à l'API « Offres d'emploi v2 »."
            : `Connexion à France Travail impossible (${data.error || r.status}).`;
        throw new Error(msg);
    }
    ftToken = data.access_token;
    ftTokenExpires = Date.now() + ((data.expires_in || 1500) - 60) * 1000;
    return ftToken;
}

// Paris, Lyon et Marseille : France Travail attend un code d'arrondissement ou le département
const BIG_CITIES = { '75056': { departement: '75' }, '69123': { commune: '69381' }, '13055': { commune: '13201' } };
const locationCache = new Map();
async function resolveLocation(location) {
    const l = String(location || '').trim();
    if (!l) return {};
    if (/^(\d{2,3}|2[ab])$/i.test(l)) return { departement: l.toUpperCase(), label: `Département ${l.toUpperCase()}` };
    const key = fold(l);
    if (locationCache.has(key)) return locationCache.get(key);
    const list = await geoCommunes(l, 1);
    if (!list.length) return { notFound: true };
    const c = list[0];
    const mapped = BIG_CITIES[c.code] || { commune: c.code };
    const result = { ...mapped, label: `${c.nom} (${c.codeDepartement})` };
    locationCache.set(key, result);
    return result;
}

function relativeDate(iso) {
    if (!iso) return '';
    const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
    if (days <= 0) return "Aujourd'hui";
    if (days === 1) return 'Hier';
    if (days < 30) return `Il y a ${days} jours`;
    return new Date(iso).toLocaleDateString('fr-FR');
}

// Niveau de diplôme sur l'échelle européenne (3 = CAP, 4 = Bac, 5 = Bac+2, 6 = Bac+3/4, 7 = Bac+5, 8 = doctorat)
function levelFromLabel(label) {
    const t = fold(label);
    if (/doctorat|bac\s*\+\s*8/.test(t)) return 8;
    if (/bac\s*\+\s*5/.test(t)) return 7;
    if (/bac\s*\+\s*[34]/.test(t)) return 6;
    if (/bac\s*\+\s*2/.test(t)) return 5;
    if (/\bbac\b|baccalaureat/.test(t)) return 4;
    if (/\bcap\b|\bbep\b/.test(t)) return 3;
    return 0;
}
// Diplôme et permis demandés par une offre France Travail (exigence E = exigé, S = souhaité)
function ftRequirements(o) {
    const forms = (o.formations || []).map(f => ({ level: levelFromLabel(f.niveauLibelle), label: f.niveauLibelle || '', field: f.domaineLibelle || '', required: f.exigence === 'E' }))
        .filter(f => f.level);
    const diploma = forms.sort((a, b) => a.level - b.level)[0]; // le niveau le plus accessible demandé
    const permis = (o.permis || []).map(p => ({ code: (String(p.libelle || '').match(/^\s*([A-E]{1,2}1?)\b/) || [])[1] || '', label: p.libelle || '', required: p.exigence === 'E' }))
        .filter(p => p.code);
    return { diploma: diploma || undefined, permis: permis.length ? permis : undefined };
}

function mapFtOffer(o) {
    const isAlt = o.alternance === true || o.natureContrat === 'Contrat apprentissage' || o.natureContrat === 'Cont. professionnalisation';
    const desc = String(o.description || '').replace(/\s+/g, ' ').trim();
    return {
        id: o.id,
        title: o.intitule || 'Offre',
        company: (o.entreprise && o.entreprise.nom) || 'Entreprise non communiquée',
        location: (o.lieuTravail && o.lieuTravail.libelle) || 'France',
        domain: o.secteurActiviteLibelle || o.romeLibelle || o.appellationlibelle || '',
        type: isAlt ? 'Alternance' : (o.typeContrat || o.typeContratLibelle || ''),
        typeLabel: o.typeContratLibelle || '',
        category: isAlt ? 'alternance' : 'emploi',
        salary: (o.salaire && (o.salaire.libelle || o.salaire.commentaire)) || '',
        duration: o.dureeTravailLibelleConverti || o.dureeTravailLibelle || '',
        source: 'France Travail',
        date: relativeDate(o.dateActualisation || o.dateCreation),
        description: desc.length > 260 ? desc.slice(0, 257) + '…' : desc,
        fullDescription: desc.slice(0, 4000),
        lat: o.lieuTravail && o.lieuTravail.latitude, lng: o.lieuTravail && o.lieuTravail.longitude,
        rome: o.romeCode || undefined, // sert à interroger La bonne alternance sur les mêmes métiers
        ...ftRequirements(o), // diplôme et permis demandés : servent au score de compatibilité
        url: `https://candidat.francetravail.fr/offres/recherche/detail/${encodeURIComponent(o.id)}`
    };
}

// ---------- Cache des recherches : 24 h, sauvegardé sur disque ----------
// Une même recherche (mots-clés + lieu + filtres + page) n'interroge les API qu'une fois par 24 h,
// même si le serveur redémarre. Les compteurs de l'accueil sont rafraîchis toutes les heures.
const SEARCH_CACHE_FILE = path.join(DATA_DIR, 'search-cache.json');
const SEARCH_TTL = 24 * 60 * 60 * 1000;
const STATS_TTL = 60 * 60 * 1000;
const SEARCH_CACHE_MAX = 500;
const searchCache = new Map();
const jsearchCursors = new Map(); // requête → curseurs des pages suivantes (JSearch)

(function loadSearchCache() {
    try {
        const saved = JSON.parse(fs.readFileSync(SEARCH_CACHE_FILE, 'utf8'));
        const now = Date.now();
        for (const [k, v] of saved.entries || []) if (v && now - v.at < SEARCH_TTL) searchCache.set(k, v);
        for (const [k, v] of saved.cursors || []) jsearchCursors.set(k, v);
        if (searchCache.size) console.log(`🗂️  ${searchCache.size} recherche(s) en cache rechargée(s).`);
    } catch (e) { /* pas encore de cache */ }
})();

let saveCacheTimer = null;
function saveSearchCacheSoon() {
    clearTimeout(saveCacheTimer);
    saveCacheTimer = setTimeout(() => {
        const now = Date.now();
        for (const [k, v] of searchCache) if (now - v.at >= SEARCH_TTL) searchCache.delete(k);
        const tmp = SEARCH_CACHE_FILE + '.tmp';
        const payload = JSON.stringify({ entries: [...searchCache], cursors: [...jsearchCursors] });
        fs.writeFile(tmp, payload, 'utf8', (err) => { if (!err) fs.rename(tmp, SEARCH_CACHE_FILE, () => {}); });
    }, 3000);
}
function cacheGet(key, ttl = SEARCH_TTL) {
    const e = searchCache.get(key);
    return e && Date.now() - e.at < ttl ? e.data : null;
}
function cacheSet(key, data) {
    searchCache.delete(key);
    searchCache.set(key, { at: Date.now(), data });
    while (searchCache.size > SEARCH_CACHE_MAX) searchCache.delete(searchCache.keys().next().value);
    saveSearchCacheSoon();
}

async function searchFranceTravail({ keyword, location, radius, type, page, limit, days, time, remote, sort, salary, audience, ttl }) {
    const cacheKey = JSON.stringify([fold(keyword), fold(location), radius, type, page, limit, days, time, remote, sort, salary, audience]);
    const cached = cacheGet(cacheKey, ttl);
    if (cached) return cached;

    const params = new URLSearchParams();
    const ftKeyword = remote ? `${keyword} télétravail`.trim() : keyword;
    if (ftKeyword) params.set('motsCles', String(ftKeyword).slice(0, 100));
    const loc = await resolveLocation(location);
    if (loc.notFound) return { total: 0, page: 1, totalPages: 1, jobs: [], source: 'France Travail', locationLabel: null, message: `Ville « ${location} » introuvable.` };
    if (loc.commune) { params.set('commune', loc.commune); params.set('distance', String(radius)); }
    if (loc.departement) params.set('departement', loc.departement);
    if (type === 'alternance') params.set('natureContrat', 'E2,FS');
    if (type === 'emploi') params.set('typeContrat', 'CDI,CDD,MIS');
    params.set('sort', sort === 'relevance' ? '0' : '1');
    if (salary) { params.set('salaireMin', String(salary)); params.set('periodeSalaire', 'M'); }
    if (days) params.set('publieeDepuis', String(days === 30 ? 31 : days));
    if (time === 'full') params.set('tempsPlein', 'true');
    if (time === 'part') params.set('tempsPlein', 'false');
    // Publics : travailleurs handicapés, débutants / sans diplôme, reconversion (recrutement par simulation, sans CV)
    if (audience === 'rqth') params.set('accesTravailleurHandicape', 'true');
    if (audience === 'debutant') params.set('experienceExigence', 'D');
    if (audience === 'reconversion') params.set('offresMRS', 'true');

    const MAX_INDEX = 3149; // limite imposée par l'API France Travail
    const start = Math.min((page - 1) * limit, MAX_INDEX);
    const end = Math.min(start + limit - 1, MAX_INDEX);
    params.set('range', `${start}-${end}`);

    const token = await getFtToken();
    const r = await fetch('https://api.francetravail.io/partenaire/offresdemploi/v2/offres/search?' + params.toString(), {
        headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
        signal: AbortSignal.timeout(10000)
    });
    if (r.status === 401) { ftToken = null; throw new Error('Jeton France Travail expiré.'); }
    if (r.status === 204) return { total: 0, page: 1, totalPages: 1, jobs: [], source: 'France Travail', locationLabel: loc.label || null };
    if (!r.ok) {
        const t = await r.text().catch(() => '');
        throw new Error(`France Travail a répondu ${r.status}${t ? ' : ' + t.slice(0, 200) : ''}`);
    }
    const data = await r.json();
    const range = r.headers.get('content-range') || '';
    const total = parseInt(range.split('/')[1], 10) || (data.resultats || []).length;
    const reachable = Math.min(total, MAX_INDEX + 1);
    const result = {
        total,
        page,
        totalPages: Math.max(1, Math.ceil(reachable / limit)),
        jobs: (data.resultats || []).map(mapFtOffer),
        source: 'France Travail',
        locationLabel: loc.label || null
    };
    cacheSet(cacheKey, result);
    return result;
}

function searchDemo({ keyword, location, type, page, limit }) {
    let results = NATIONAL_JOBS;
    const k = fold(keyword);
    const l = fold(location);
    if (k) results = results.filter(j => fold(j.title).includes(k) || fold(j.domain).includes(k) || fold(j.type).includes(k));
    if (l) results = results.filter(j => fold(j.location).includes(l) || fold(j.region).includes(l) || j.dept === l);
    if (type !== 'all') results = results.filter(r => r.category === type);
    const totalPages = Math.ceil(results.length / limit) || 1;
    const pageNum = Math.min(page, totalPages);
    return { total: results.length, page: pageNum, totalPages, jobs: results.slice((pageNum - 1) * limit, pageNum * limit) };
}

// --- Adzuna (compte développeur gratuit, ouvert aux particuliers) ---
const ADZUNA_APP_ID = process.env.ADZUNA_APP_ID;
const ADZUNA_APP_KEY = process.env.ADZUNA_APP_KEY;

function cleanText(s, max = 260) {
    const t = String(s || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    return t.length > max ? t.slice(0, max - 1) + '…' : t;
}
function formatSalary(min, max, period = '') {
    const f = (n) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(n) + ' €';
    if (min && max && Math.round(min) !== Math.round(max)) return `${f(min)} – ${f(max)}${period}`;
    if (min || max) return `${f(min || max)}${period}`;
    return '';
}

// Adzuna et JSearch n'ont pas de filtre « public » : on cherche les mots qui l'indiquent dans l'annonce
const AUDIENCE_WORDS = {
    rqth: 'handicap rqth handi-accueillant handiaccueillant',
    debutant: 'débutant debutant junior formé formée',
    reconversion: 'reconversion débutant formation formé',
    senior: 'senior expérimenté expérimentée'
};
async function searchAdzuna({ keyword, location, radius, type, page, limit, days, time, remote, sort, salary, audience, ttl }) {
    if (!ADZUNA_APP_ID || !ADZUNA_APP_KEY) throw new Error('Clés Adzuna absentes du fichier .env (ADZUNA_APP_ID / ADZUNA_APP_KEY).');
    const cacheKey = 'adz' + JSON.stringify([fold(keyword), fold(location), radius, type, page, limit, days, time, remote, sort, salary, audience]);
    const cached = cacheGet(cacheKey, ttl);
    if (cached) return cached;

    const params = new URLSearchParams({ app_id: ADZUNA_APP_ID, app_key: ADZUNA_APP_KEY, results_per_page: String(limit), 'content-type': 'application/json' });
    let what = keyword;
    if (type === 'alternance') what = `${keyword} alternance`.trim();
    if (what) params.set('what', what);
    let locationLabel = null;
    if (location) {
        // Un n° de département seul n'est pas compris par Adzuna : on prend sa préfecture/grande ville via geo.api
        let where = location;
        if (/^(\d{2,3}|2[ab])$/i.test(location)) {
            const r = await fetch(`https://geo.api.gouv.fr/departements/${location.toUpperCase()}`, { signal: AbortSignal.timeout(5000) }).catch(() => null);
            const d = r && r.ok ? await r.json() : null;
            if (d) { where = d.nom; locationLabel = `${d.nom} (${d.code})`; }
        } else {
            const c = (await geoCommunes(location, 1).catch(() => []))[0];
            if (c) { where = c.nom; locationLabel = `${c.nom} (${c.codeDepartement})`; params.set('distance', String(radius)); }
        }
        params.set('where', where);
    }
    if (type === 'emploi') params.set('what_exclude', 'alternance apprentissage stage');
    const orWords = [];
    if (remote) orWords.push('télétravail teletravail remote hybride');
    if (AUDIENCE_WORDS[audience]) orWords.push(AUDIENCE_WORDS[audience]);
    if (orWords.length) params.set('what_or', orWords.join(' '));
    params.set('max_days_old', String(days || 45)); // uniquement des offres récentes
    params.set('sort_by', sort === 'relevance' ? 'relevance' : 'date');
    if (salary) params.set('salary_min', String(salary * 12)); // Adzuna : salaire annuel
    if (time === 'full') params.set('full_time', '1');
    if (time === 'part') params.set('part_time', '1');

    const r = await fetch(`https://api.adzuna.com/v1/api/jobs/fr/search/${page}?${params.toString()}`, { signal: AbortSignal.timeout(10000) });
    if (r.status === 401 || r.status === 403) throw new Error('Clés Adzuna refusées : vérifiez ADZUNA_APP_ID et ADZUNA_APP_KEY.');
    if (!r.ok) throw new Error(`Adzuna a répondu ${r.status}.`);
    const data = await r.json();
    const total = data.count || 0;
    const jobs = (data.results || []).map(o => {
        const title = cleanText(o.title, 120);
        const text = title + ' ' + (o.description || '');
        const isAlt = /alternan|apprenti|professionnalisation/i.test(text);
        const ct = /\bstage\b|stagiaire/i.test(title) ? 'Stage'
            : o.contract_type === 'permanent' ? 'CDI' : o.contract_type === 'contract' ? 'CDD'
            : /\bCDI\b/.test(text) ? 'CDI' : /\bCDD\b/.test(text) ? 'CDD' : /intérim|interim/i.test(text) ? 'Intérim'
            : (o.contract_time === 'part_time' ? 'Temps partiel' : o.contract_time === 'full_time' ? 'Temps plein' : 'Emploi');
        // Adzuna ne précise pas la période : on la déduit du montant
        // (< 100 € = taux horaire, < 1 000 € = journalier, < 5 000 € = mensuel, au-delà = annuel)
        const salMax = o.salary_max || o.salary_min || 0;
        const salPeriod = !salMax ? '' : salMax < 100 ? ' / heure' : salMax < 1000 ? ' / jour' : salMax < 5000 ? ' / mois' : ' / an';
        return {
            id: 'adz-' + o.id,
            title,
            company: (o.company && o.company.display_name) || 'Entreprise non communiquée',
            location: (o.location && o.location.display_name) || 'France',
            domain: (o.category && o.category.label && o.category.label !== 'Unknown') ? o.category.label.replace(/ Jobs$/, '') : '',
            type: isAlt ? 'Alternance' : ct,
            category: isAlt ? 'alternance' : 'emploi',
            salary: o.salary_is_predicted === '1' ? '' : formatSalary(o.salary_min, o.salary_max, salPeriod),
            source: 'Adzuna',
            date: relativeDate(o.created),
            description: cleanText(o.description),
            fullDescription: cleanText(o.description, 4000),
            lat: o.latitude, lng: o.longitude,
            url: o.redirect_url
        };
    });
    const result = { total, page, totalPages: Math.max(1, Math.min(Math.ceil(total / limit), 100)), jobs, source: 'Adzuna', locationLabel };
    cacheSet(cacheKey, result);
    return result;
}

// --- JSearch via RapidAPI (plan gratuit : environ 200 requêtes / mois) ---
const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
async function searchJSearch({ keyword, location, radius, type, page, limit, days, time, remote, sort, salary, audience, ttl }) {
    if (!RAPIDAPI_KEY) throw new Error('Clé RapidAPI absente du fichier .env.');
    const cacheKey = 'js' + JSON.stringify([fold(keyword), fold(location), radius, type, page, days, time, remote, salary, audience]);
    const cached = cacheGet(cacheKey, ttl);
    if (cached) return cached;

    let locationLabel = null;
    let where = 'France';
    if (location) {
        if (/^(\d{2,3}|2[ab])$/i.test(location)) {
            const r = await fetch(`https://geo.api.gouv.fr/departements/${location.toUpperCase()}`, { signal: AbortSignal.timeout(5000) }).catch(() => null);
            const d = r && r.ok ? await r.json() : null;
            if (d) { where = d.nom + ', France'; locationLabel = `${d.nom} (${d.code})`; }
        } else {
            const c = (await geoCommunes(location, 1).catch(() => []))[0];
            if (c) { where = c.nom + ', France'; locationLabel = `${c.nom} (${c.codeDepartement})`; }
        }
    }
    const what = [keyword || 'emploi', type === 'alternance' ? 'alternance' : '', remote ? 'télétravail' : '', { rqth: 'handicap', debutant: 'débutant', reconversion: 'débutant accepté', senior: 'senior' }[audience] || ''].filter(Boolean).join(' ');
    const query = `${what} ${where}`;
    const params = new URLSearchParams({ query, num_pages: '1', country: 'fr', language: 'fr' });
    if (days) params.set('date_posted', { 1: 'today', 3: '3days', 7: 'week', 30: 'month' }[days]);
    if (time === 'full') params.set('employment_types', 'FULLTIME');
    if (time === 'part') params.set('employment_types', 'PARTTIME');
    // L'API v2 pagine avec un « curseur » renvoyé par la page précédente
    const cursorKey = fold(query) + '|' + days + '|' + time;
    const cursors = jsearchCursors.get(cursorKey) || [];
    if (page > 1) {
        const cursor = cursors[page - 2];
        if (cursor) params.set('cursor', cursor);
        else page = 1; // curseur perdu (ex. redémarrage du serveur) : on repart de la page 1
    }

    const r = await fetch('https://jsearch.p.rapidapi.com/search-v2?' + params.toString(), {
        headers: { 'x-rapidapi-key': RAPIDAPI_KEY, 'x-rapidapi-host': 'jsearch.p.rapidapi.com' },
        signal: AbortSignal.timeout(20000)
    });
    if (r.status === 403) throw new Error("Votre clé RapidAPI n'est pas abonnée à l'API JSearch.");
    const remaining = r.headers.get('x-ratelimit-requests-remaining');
    if (remaining !== null && Number(remaining) <= 20) console.warn(`⚠️  JSearch : plus que ${remaining} recherches ce mois-ci.`);
    if (r.status === 429) throw new Error('Quota JSearch épuisé pour ce mois.');
    if (!r.ok) throw new Error(`JSearch a répondu ${r.status}.`);
    const data = await r.json();
    const payload = data.data || {};
    const list = (Array.isArray(payload) ? payload : (payload.jobs || [])).slice(0, limit);
    const nextCursor = Array.isArray(payload) ? null : payload.cursor || null;
    if (nextCursor) { cursors[page - 1] = nextCursor; jsearchCursors.set(cursorKey, cursors); }
    if (jsearchCursors.size > 200) jsearchCursors.delete(jsearchCursors.keys().next().value);
    if (nextCursor) saveSearchCacheSoon();

    const TYPES = { FULLTIME: 'Temps plein', PARTTIME: 'Temps partiel', CONTRACTOR: 'Freelance', INTERN: 'Stage', TEMPORARY: 'Intérim' };
    const jobs = list.map(o => {
        const title = cleanText(o.job_title, 120);
        const text = title + ' ' + (o.job_description || '');
        const isAlt = /alternan|apprenti|professionnalisation/i.test(text);
        const contract = /\bCDI\b/.test(text) ? 'CDI' : /\bCDD\b/.test(text) ? 'CDD' : /intérim|interim/i.test(text) ? 'Intérim' : null;
        const et = contract || TYPES[(o.job_employment_types || [])[0]] || o.job_employment_type || 'Emploi';
        const period = { YEAR: ' / an', MONTH: ' / mois', HOUR: ' / h' }[o.job_salary_period] || '';
        return {
            id: 'js-' + o.job_id,
            title,
            company: o.employer_name || 'Entreprise non communiquée',
            location: o.job_location || [o.job_city, o.job_state].filter(Boolean).join(', ') || 'France',
            domain: o.job_publisher ? `via ${o.job_publisher}` : '',
            type: isAlt ? 'Alternance' : et,
            category: isAlt ? 'alternance' : 'emploi',
            salary: o.job_salary_string || formatSalary(o.job_min_salary, o.job_max_salary, period),
            source: 'JSearch',
            date: o.job_posted_at ? o.job_posted_at.charAt(0).toUpperCase() + o.job_posted_at.slice(1) : relativeDate(o.job_posted_at_datetime_utc),
            description: cleanText(o.job_description),
            fullDescription: cleanText(o.job_description, 4000),
            lat: o.job_latitude, lng: o.job_longitude,
            url: o.job_apply_link || o.job_google_link
        };
    }).filter(j => type === 'all' || j.category === type);
    // JSearch ne donne pas de total : on autorise la page suivante tant qu'il y a un curseur
    const hasNext = !!nextCursor && list.length > 0;
    const result = { total: (page - 1) * limit + jobs.length, page, totalPages: hasNext ? page + 1 : page, jobs, source: 'JSearch', locationLabel, approxTotal: true };
    cacheSet(cacheKey, result);
    return result;
}

// --- La bonne alternance (API officielle de l'État, gratuite : api.apprentissage.beta.gouv.fr) ---
// Offres d'alternance de La bonne alternance et de ses partenaires. Complète les résultats (elle ne remplace
// pas les autres sources) : l'API cherche par lieu et par codes métier ROME, pas par mots-clés.
const LBA_API_KEY = process.env.LBA_API_KEY;
const LBA_URL = 'https://api.apprentissage.beta.gouv.fr/api/job/v1/search';
async function communeCenter(location) {
    const l = String(location || '').trim();
    if (!l || /^(\d{2,3}|2[ab])$/i.test(l)) return null;
    const params = new URLSearchParams({ fields: 'nom,codeDepartement,centre', boost: 'population', limit: '1' });
    if (/^\d{5}$/.test(l)) params.set('codePostal', l); else params.set('nom', l);
    const r = await fetch('https://geo.api.gouv.fr/communes?' + params.toString(), { signal: AbortSignal.timeout(5000) }).catch(() => null);
    const c = r && r.ok ? (await r.json())[0] : null;
    return c && c.centre ? { lat: c.centre.coordinates[1], lng: c.centre.coordinates[0], label: `${c.nom} (${c.codeDepartement})` } : null;
}
function mapLbaJob(j) {
    const o = j.offer || {}, w = j.workplace || {}, c = j.contract || {}, loc = w.location || {};
    const coords = loc.geopoint && loc.geopoint.coordinates;
    const address = String(loc.address || '');
    const city = (address.match(/\b\d{5}\s+([^,]+)$/) || [])[1] || address.split(',').pop().trim() || 'France';
    const skills = (o.desired_skills || []).filter(Boolean);
    const desc = cleanText(o.description, 4000);
    const full = [desc, skills.length ? 'Compétences attendues : ' + skills.join(', ') + '.' : '', o.target_diploma && o.target_diploma.label ? 'Diplôme préparé : ' + o.target_diploma.label + '.' : '']
        .filter(Boolean).join('\n\n');
    const rawId = (j.identifier && (j.identifier.id || j.identifier.partner_job_id)) || '';
    return {
        id: 'lba-' + String(rawId).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 60),
        title: cleanText(o.title, 120) || 'Offre en alternance',
        company: w.brand || w.name || w.legal_name || 'Entreprise non communiquée',
        location: city,
        domain: (w.domain && w.domain.naf && w.domain.naf.label) || '',
        type: 'Alternance',
        typeLabel: (c.type || []).join(', '),
        category: 'alternance',
        salary: '',
        duration: c.duration ? `${c.duration} mois` : '',
        source: 'La bonne alternance',
        partner: j.identifier && j.identifier.partner_label,
        date: relativeDate(o.publication && o.publication.creation),
        description: cleanText(o.description),
        fullDescription: full.slice(0, 4000),
        lat: coords ? coords[1] : undefined, lng: coords ? coords[0] : undefined,
        // Diplôme préparé en alternance : niveau d'entrée = un cran en dessous (ex. BTS préparé → Bac demandé)
        diploma: o.target_diploma && Number(o.target_diploma.european) >= 4
            ? { level: Number(o.target_diploma.european) - 1, label: 'Niveau d’entrée pour préparer : ' + (o.target_diploma.label || ''), required: false } : undefined,
        url: j.apply && j.apply.url
    };
}
// romes : codes métier déduits des offres France Travail de la même recherche
async function searchLba({ keyword, location, radius, ttl }, romes = []) {
    if (!LBA_API_KEY) throw new Error('Clé LBA_API_KEY absente du fichier .env.');
    const kw = fold(keyword).split(/\s+/).filter(w => w.length > 2);
    const center = await communeCenter(location).catch(() => null);
    let dept = /^(\d{2,3}|2[ab])$/i.test(String(location || '').trim()) ? String(location).trim().toUpperCase() : null;
    // Position introuvable (service lent) : on se rabat sur le département de la ville
    if (!center && !dept && location) { const loc = await resolveLocation(location).catch(() => ({})); dept = (/\((\w{2,3})\)$/.exec(loc.label || '') || [])[1] || null; }
    if (!center && !dept && !romes.length) return { jobs: [] }; // recherche trop large : on s'abstient
    const cacheKey = 'lba' + JSON.stringify([kw, center && center.label, dept, radius, romes]);
    const cached = cacheGet(cacheKey, ttl);
    if (cached) return cached;
    const params = new URLSearchParams();
    if (center) { params.set('latitude', String(center.lat)); params.set('longitude', String(center.lng)); params.set('radius', String(Math.min(Math.max(Number(radius) || 30, 1), 200))); }
    if (dept) params.set('departements', dept);
    if (romes.length) params.set('romes', romes.join(','));
    const r = await fetch(LBA_URL + '?' + params.toString(), { headers: { Authorization: 'Bearer ' + LBA_API_KEY, Accept: 'application/json' }, signal: AbortSignal.timeout(12000) });
    if (r.status === 401 || r.status === 403) throw new Error('Clé La bonne alternance refusée.');
    if (r.status === 419 || r.status === 429) throw new Error('Limite de requêtes La bonne alternance atteinte.');
    if (!r.ok) throw new Error(`La bonne alternance a répondu ${r.status}.`);
    const data = await r.json();
    let jobs = (data.jobs || [])
        .filter(j => !j.offer || !j.offer.status || /activ/i.test(j.offer.status))
        .filter(j => !/france travail|p[oô]le emploi/i.test((j.identifier && j.identifier.partner_label) || '')) // déjà fournies par France Travail
        .map(mapLbaJob)
        .filter(j => j.url);
    // Sans codes métier, on garde les offres dont l'intitulé contient les mots recherchés
    if (!romes.length && kw.length) jobs = jobs.filter(j => { const t = fold(j.title + ' ' + j.domain); return kw.every(w => t.includes(w)); });
    const result = { jobs, source: 'La bonne alternance' };
    cacheSet(cacheKey, result);
    return result;
}
// Codes ROME les plus fréquents parmi les offres France Travail (3 au plus)
function topRomes(jobs) {
    const count = new Map();
    for (const j of jobs || []) if (j.rome && /^[A-N]\d{4}$/.test(j.rome)) count.set(j.rome, (count.get(j.rome) || 0) + 1);
    return [...count.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k]) => k);
}

// Ordre d'essai des sources : la première qui répond est utilisée
const JOB_PROVIDERS = [
    ['France Travail', searchFranceTravail],
    ['Adzuna', searchAdzuna],
    ['JSearch', searchJSearch]
];
const providerDown = new Map(); // évite de réessayer en boucle une source non configurée
const providerOk = new Map();   // dernière réponse réussie de chaque source (page d'état)

// ---------- Doublons : même poste, même entreprise, même ville (souvent republié par plusieurs sites) ----------
function jobSignature(j) {
    const t = fold(j.title).replace(/\(?\b[hf]\s*\/\s*[fh]\b\)?/g, ' ').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
    const c = fold(j.company).replace(/\b(sas|sarl|sa|eurl|france|groupe|agence)\b|[^a-z0-9]+/g, '');
    const l = fold(String(j.location).split(/[,(]/)[0]).replace(/^\d+\s*-\s*/, '').replace(/[^a-z]+/g, '');
    return t + '|' + c + '|' + l;
}
function dedupeJobs(jobs) {
    const seen = new Map();
    const out = [];
    for (const j of jobs) {
        const sig = jobSignature(j);
        const prev = seen.get(sig);
        if (prev) { prev.alsoOn = [...new Set([...(prev.alsoOn || []), j.source].filter(x => x && x !== prev.source))]; continue; }
        seen.set(sig, j);
        out.push(j);
    }
    return { jobs: out, removed: jobs.length - out.length };
}
// "1 800 € – 2 100 € / mois" → 1800 ; annuel → /12 ; horaire → ×151,67. null si illisible.
function monthlySalary(str) {
    const t = String(str || '').replace(/[  ]/g, ' ');
    const nums = (t.match(/\d[\d ]*(?:[.,]\d+)?/g) || []).map(n => parseFloat(n.replace(/ /g, '').replace(',', '.'))).filter(n => n > 0);
    if (!nums.length) return null;
    let v = nums[0];
    if (/\ban\b|annuel|year/i.test(t) || v > 10000) v /= 12;
    else if (/heure|horaire|\/ ?h\b/i.test(t) || v < 100) v *= 151.67;
    else if (/jour/i.test(t) || v < 1000) v *= 21;
    return Math.round(v);
}

// ---------- Recherche commune (route /api/jobs, alertes e-mail) ----------
async function runExternalSearch(q, { statsOnly = false } = {}) {
    const errors = [];
    for (const [name, search] of JOB_PROVIDERS) {
        if (statsOnly && name === 'JSearch') continue;
        const down = providerDown.get(name);
        if (down && Date.now() - down.at < 10 * 60 * 1000) { errors.push(`${name} : ${down.message}`); continue; }
        try {
            const data = await search(q);
            providerDown.delete(name);
            providerOk.set(name, Date.now());
            const { jobs, removed } = dedupeJobs(data.jobs || []);
            const salaryFiltered = q.salary && name === 'JSearch' ? jobs.filter(j => !j.salary || monthlySalary(j.salary) === null || monthlySalary(j.salary) >= q.salary) : jobs;
            return { ...data, jobs: salaryFiltered, duplicatesRemoved: removed, demo: false };
        } catch (e) {
            if (!down || down.message !== e.message) console.warn(`⚠️  ${name} indisponible :`, e.message);
            providerDown.set(name, { at: Date.now(), message: e.message });
            errors.push(`${name} : ${e.message}`);
        }
    }
    return { ...searchDemo(q), demo: true, message: 'Aucune source d’offres réelles n’est configurée.', details: errors };
}

// Page 1 des recherches « alternance » ou « tout » : on ajoute les offres de La bonne alternance (sans doublons)
async function addLbaOffers(q, data) {
    if (!LBA_API_KEY || data.demo || !['alternance', 'all'].includes(q.type)) return data;
    const down = providerDown.get('La bonne alternance');
    if (down && Date.now() - down.at < 10 * 60 * 1000) return data;
    try {
        const romes = q.keyword ? topRomes(data.jobs) : [];
        const lba = await searchLba(q, romes);
        providerDown.delete('La bonne alternance');
        providerOk.set('La bonne alternance', Date.now());
        const seen = new Set((data.jobs || []).map(jobSignature));
        const extra = dedupeJobs(lba.jobs).jobs.filter(j => !seen.has(jobSignature(j))).slice(0, q.type === 'alternance' ? 20 : 10);
        if (!extra.length) return data;
        // Recherche « alternance » : ces offres passent devant ; « tout » : à la suite
        const jobs = q.type === 'alternance' ? [...extra, ...(data.jobs || [])] : [...(data.jobs || []), ...extra];
        return { ...data, jobs, total: (data.total || 0) + extra.length, lbaCount: extra.length };
    } catch (e) {
        if (!down || down.message !== e.message) console.warn('⚠️  La bonne alternance indisponible :', e.message);
        providerDown.set('La bonne alternance', { at: Date.now(), message: e.message });
        return data;
    }
}

// Recherche complète : sources externes + offres publiées sur JobFacile par des recruteurs vérifiés (en tête, page 1)
async function runJobSearch(q, opts = {}) {
    let data = await runExternalSearch(q, opts);
    if (opts.statsOnly || (q.page || 1) > 1) return data;
    data = await addLbaOffers(q, data);
    let local = [];
    try { local = (await require('./localOffers').searchLocalOffers(q)).slice(0, 10).map(o => ({ ...o, date: relativeDate(o.createdAt) })); }
    catch (e) { console.warn('⚠️  Offres JobFacile :', e.message); }
    if (!local.length) return data;
    const ids = new Set(local.map(o => o.id));
    return { ...data, jobs: [...local, ...(data.jobs || []).filter(j => !ids.has(j.id))], total: (data.total || 0) + local.length, localCount: local.length };
}

// Retrouver une offre partagée par lien (parmi les recherches des dernières 24 h)
// Les offres partagées sont gardées 60 jours en base : le lien reste valable même après l'expiration du cache
db.exec('CREATE TABLE IF NOT EXISTS shared_offers (id TEXT PRIMARY KEY, data TEXT NOT NULL, at INTEGER NOT NULL)');
const sharedGet = db.prepare('SELECT data FROM shared_offers WHERE id = ? AND at > ?');
const sharedSet = db.prepare('INSERT OR REPLACE INTO shared_offers (id, data, at) VALUES (?, ?, ?)');
const SHARED_TTL = 60 * 24 * 3600 * 1000;
db.prepare('DELETE FROM shared_offers WHERE at < ?').run(Date.now() - SHARED_TTL);

// Une offre France Travail encore en ligne peut être relue directement par son numéro
async function fetchFtOffer(id) {
    if (!/^[0-9]{6,8}[A-Z]?$/i.test(id)) return null;
    const token = await getFtToken();
    const r = await fetch('https://api.francetravail.io/partenaire/offresdemploi/v2/offres/' + encodeURIComponent(id), {
        headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' }, signal: AbortSignal.timeout(8000)
    });
    if (!r.ok) return null;
    return mapFtOffer(await r.json());
}
async function findOffer(id) {
    // Offre publiée sur JobFacile : toujours la version à jour, seulement si elle est en ligne
    if (String(id).startsWith('jf-')) {
        const row = require('./localOffers').getOffer(id);
        return row && row.status === 'active' ? { ...row.offer, lat: row.lat, lng: row.lng, date: relativeDate(row.offer.createdAt) } : null;
    }
    for (const { data } of searchCache.values()) {
        const job = data && Array.isArray(data.jobs) && data.jobs.find(j => j.id === id);
        if (job) return job;
    }
    const shared = sharedGet.get(id, Date.now() - SHARED_TTL);
    if (shared) return JSON.parse(shared.data);
    const demo = NATIONAL_JOBS.find(j => j.id === id);
    if (demo) return demo;
    const ft = await fetchFtOffer(id).catch(() => null);
    if (ft) sharedSet.run(id, JSON.stringify(ft), Date.now());
    return ft;
}

module.exports = { providerDown, providerOk, getFtToken, RAPIDAPI_KEY, LBA_API_KEY, FT_CLIENT_ID, FT_CLIENT_SECRET, geoCommunes, SEARCH_TTL, STATS_TTL, ADZUNA_APP_ID, ADZUNA_APP_KEY, runJobSearch, sharedSet, findOffer };
