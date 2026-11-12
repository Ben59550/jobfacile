// Pages du site : aperçu des offres partagées (Open Graph) et page unique pour toutes les adresses.
const fs = require('fs');
const path = require('path');
const router = require('express').Router();
const { ROOT_DIR, PUBLIC_URL } = require('../config');
const { findOffer } = require('../services/jobSearch');

// Route API inconnue → JSON (et pas une page HTML)
router.use('/api', (req, res) => res.status(404).json({ success: false, message: 'Route introuvable.' }));

// Toutes les adresses du site (/offres, /profil, /offre/…) affichent la même page : le navigateur choisit la vue
const INDEX_FILE = path.join(ROOT_DIR, 'public', 'index.html');
const escAttr = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// Application Android (Trusted Web Activity) : prouve que l'appli et le site appartiennent au même éditeur.
// ANDROID_PACKAGE et ANDROID_SHA256 dans .env (voir mobile/README.md).
router.get('/.well-known/assetlinks.json', (req, res) => {
    const pkg = process.env.ANDROID_PACKAGE, prints = String(process.env.ANDROID_SHA256 || '').split(',').map(s => s.trim()).filter(Boolean);
    if (!pkg || !prints.length) return res.status(404).json([]);
    res.json([{ relation: ['delegate_permission/common.handle_all_urls'], target: { namespace: 'android_app', package_name: pkg, sha256_cert_fingerprints: prints } }]);
});

router.get('/offre/:id', async (req, res, next) => {
    let job = null;
    try { job = await findOffer(String(req.params.id).slice(0, 200)); } catch (e) {}
    let html;
    try { html = fs.readFileSync(INDEX_FILE, 'utf8'); } catch (e) { return next(e); }
    const url = `${PUBLIC_URL}/offre/${encodeURIComponent(req.params.id)}`;
    const title = job ? `${job.title} – ${job.company}` : 'Offre d’emploi – JobFacile';
    const bits = job ? [job.type, '📍 ' + job.location, job.salary ? '💶 ' + job.salary : ''].filter(Boolean).join(' · ') : '';
    const desc = job ? `${bits}. ${String(job.description || '').slice(0, 220)}` : 'Cette offre n’est plus disponible. Trouvez d’autres offres près de chez vous sur JobFacile.';
    const meta = [
        ['og:type', 'website'], ['og:site_name', 'JobFacile'], ['og:locale', 'fr_FR'],
        ['og:title', title], ['og:description', desc], ['og:url', url],
        ['og:image', PUBLIC_URL + '/icons/icon-512.png'], ['og:image:width', '512'], ['og:image:height', '512'], ['og:image:alt', 'JobFacile']
    ].map(([p, c]) => `<meta property="${p}" content="${escAttr(c)}">`).join('\n    ')
        + `\n    <meta name="twitter:card" content="summary">\n    <meta name="twitter:title" content="${escAttr(title)}">\n    <meta name="twitter:description" content="${escAttr(desc)}">\n    <link rel="canonical" href="${escAttr(url)}">`;
    html = html.replace(/<title>[^<]*<\/title>/, `<title>${escAttr(title)} – JobFacile</title>`)
        .replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${escAttr(desc)}">\n    ${meta}`);
    if (!job) res.status(404);
    res.type('html').send(html);
});

router.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/') || req.path.startsWith('/uploads/') || path.extname(req.path)) return next();
    res.sendFile(INDEX_FILE);
});

module.exports = router;
