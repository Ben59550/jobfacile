// Routes des temps de trajet domicile → offre.
const router = require('express').Router();
const { saveUsers } = require('../db');
const { requireAuth, tooManyAttempts } = require('../security');

// ---------- Temps de trajet domicile → offre ----------
// Domicile : adresse (facultative) + code postal + ville, géolocalisés par la Base Adresse Nationale (api-adresse.data.gouv.fr).
// Trajets : OSRM (OpenStreetMap). Seules des coordonnées partent vers ces services, jamais le nom ni l'e-mail.
async function homeGeo(user) {
    if (user.homeGeo) return user.homeGeo;
    const q = [user.address, user.postalCode, user.city].filter(Boolean).join(' ').trim();
    if (q.length < 3) return null;
    const params = new URLSearchParams({ q, limit: '1' });
    if (user.postalCode && /^\d{5}$/.test(user.postalCode)) params.set('postcode', user.postalCode);
    const r = await fetch('https://api-adresse.data.gouv.fr/search/?' + params, { signal: AbortSignal.timeout(6000) });
    if (!r.ok) return null;
    const f = ((await r.json()).features || [])[0];
    if (!f) return null;
    const [lng, lat] = f.geometry.coordinates;
    user.homeGeo = { lat, lng, label: f.properties.label, precise: ['housenumber', 'street'].includes(f.properties.type) };
    return user.homeGeo;
}
const commuteCache = new Map();
const round4 = (n) => Math.round(parseFloat(n) * 1e4) / 1e4;
async function osrm(base, profile, coords, extra = '') {
    const r = await fetch(`${base}/${profile}/v1/driving/${coords.map(c => c.lng + ',' + c.lat).join(';')}${extra}`, { signal: AbortSignal.timeout(8000) });
    if (!r.ok) throw new Error('OSRM ' + r.status);
    const d = await r.json();
    if (d.code !== 'Ok') throw new Error('OSRM ' + d.code);
    return d;
}
const validPoint = (p) => p && isFinite(parseFloat(p.lat)) && isFinite(parseFloat(p.lng)) && Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180;

// Durées en voiture pour toute une page d'offres (une seule requête « table »)
router.post('/api/commute', requireAuth, async (req, res) => {
    if (tooManyAttempts('commute:' + req.user.id, 120, 60 * 60 * 1000)) return res.status(429).json({ success: false, results: {} });
    const user = req.user;
    const hadGeo = !!user.homeGeo;
    const home = await homeGeo(user).catch(() => null);
    if (!home) return res.json({ success: false, noHome: true, results: {} });
    if (!hadGeo) saveUsers(req.users);
    const pts = (Array.isArray(req.body.points) ? req.body.points : []).filter(validPoint).slice(0, 60)
        .map(p => ({ id: String(p.id).slice(0, 200), lat: round4(p.lat), lng: round4(p.lng) }));
    const results = {};
    const todo = [];
    for (const p of pts) {
        const k = `${round4(home.lat)},${round4(home.lng)}>${p.lat},${p.lng}`;
        if (commuteCache.has(k)) results[p.id] = commuteCache.get(k); else todo.push({ ...p, k });
    }
    // Plusieurs offres au même endroit : une seule destination
    const uniq = [...new Map(todo.map(p => [p.lat + ',' + p.lng, p])).values()];
    if (uniq.length) {
        try {
            const r = await fetch(`https://router.project-osrm.org/table/v1/driving/${[home, ...uniq].map(c => c.lng + ',' + c.lat).join(';')}?sources=0&annotations=duration,distance`, { signal: AbortSignal.timeout(10000) });
            const d = await r.json();
            if (d.code === 'Ok') {
                uniq.forEach((p, i) => {
                    const sec = d.durations[0][i + 1], m = d.distances[0][i + 1];
                    if (sec === null || m === null) return;
                    const v = { carMin: Math.max(1, Math.round(sec / 60)), km: Math.round(m / 100) / 10 };
                    for (const t of todo.filter(x => x.lat === p.lat && x.lng === p.lng)) { commuteCache.set(t.k, v); results[t.id] = v; }
                });
                while (commuteCache.size > 5000) commuteCache.delete(commuteCache.keys().next().value);
            }
        } catch (e) { console.warn('Trajets :', e.message); }
    }
    res.json({ success: true, home: { label: home.label, precise: home.precise }, results });
});

// Détail pour une offre : voiture, vélo, marche
router.post('/api/commute/detail', requireAuth, async (req, res) => {
    if (!validPoint(req.body)) return res.status(400).json({ success: false });
    if (tooManyAttempts('commute:' + req.user.id, 120, 60 * 60 * 1000)) return res.status(429).json({ success: false });
    const user = req.user;
    const hadGeo = !!user.homeGeo;
    const home = await homeGeo(user).catch(() => null);
    if (!home) return res.json({ success: false, noHome: true });
    if (!hadGeo) saveUsers(req.users);
    const dest = { lat: round4(req.body.lat), lng: round4(req.body.lng) };
    const route = async (base) => {
        const d = await osrm(base, 'route', [home, dest], '?overview=false').catch(() => null);
        const r = d && d.routes && d.routes[0];
        return r ? { min: Math.max(1, Math.round(r.duration / 60)), km: Math.round(r.distance / 100) / 10 } : null;
    };
    const [car, bike] = await Promise.all([
        route('https://router.project-osrm.org'),
        route('https://routing.openstreetmap.de/routed-bike')
    ]);
    const km = (car || bike || {}).km;
    const walk = km && km <= 6 ? { min: Math.round(km / 4.5 * 60), km } : null; // 4,5 km/h
    res.json({ success: true, home: { label: home.label, lat: home.lat, lng: home.lng, precise: home.precise }, car, bike, walk });
});

module.exports = router;
