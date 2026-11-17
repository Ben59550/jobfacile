// Pages du site : aperçu des offres partagées (Open Graph) et page unique pour toutes les adresses.
const fs = require('fs');
const path = require('path');
const router = require('express').Router();
const { ROOT_DIR, PUBLIC_URL } = require('../config');
const { findOffer } = require('../services/jobSearch');
const { ARTICLES, BY_SLUG } = require('../data/articles');
const { articleHtml, esc } = require('./articles');

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

// Titre et description propres à chaque page publique (lus par Google, AdSense et les aperçus de liens)
const PAGES = {
    '/': ['JobFacile - L’emploi au kilomètre près', 'Trouvez un emploi ou une alternance près de chez vous, créez votre CV et votre lettre avec l’IA et entraînez-vous aux entretiens. Gratuit.'],
    '/offres': ['Offres d’emploi et d’alternance près de chez vous – JobFacile', 'Des milliers d’offres d’emploi, de stage et d’alternance en France, classées par distance et par compatibilité avec votre profil.'],
    '/conseils': ['Conseils pour trouver un emploi – JobFacile', 'CV, lettre de motivation, entretien, relance, réseau : nos conseils concrets pour réussir votre recherche d’emploi.'],
    '/generateur': ['CV et lettre de motivation par IA – JobFacile', 'Rédigez un CV et une lettre de motivation adaptés à chaque offre grâce à l’intelligence artificielle, puis téléchargez-les en PDF.'],
    '/entretien': ['Simulateur d’entretien d’embauche – JobFacile', 'Entraînez-vous à l’entretien d’embauche avec un recruteur virtuel, à l’écrit ou à la voix, et recevez un bilan personnalisé.'],
    '/mes-droits': ['Mes droits : chômage et aides à l’emploi – JobFacile', 'Estimez votre allocation chômage et découvrez les aides auxquelles vous avez droit pendant votre recherche d’emploi.'],
    '/communaute': ['Communauté de chercheurs d’emploi – JobFacile', 'Posez vos questions et partagez vos expériences de recherche d’emploi avec la communauté JobFacile.'],
    '/a-propos': ['À propos de JobFacile', 'JobFacile rend la recherche d’emploi plus simple : offres locales, outils d’IA pour candidater et accompagnement gratuit.'],
    '/contact': ['Contactez-nous – JobFacile', 'Une question, un problème ou une suggestion ? Écrivez à l’équipe JobFacile, nous répondons sous 48 h.'],
    '/mentions-legales': ['Mentions légales – JobFacile', 'Éditeur, hébergeur et conditions d’utilisation du site JobFacile.'],
    '/confidentialite': ['Politique de confidentialité – JobFacile', 'Comment JobFacile protège vos données personnelles et gère les cookies.']
};
// Articles de conseil : une page chacun
for (const a of ARTICLES) PAGES['/conseils/' + a.slug] = [a.title + ' – JobFacile', a.description];
// Pages réservées aux comptes : rien à indexer
const PRIVATE = ['/profil', '/suivi', '/messages', '/moderation', '/recruteur'];
// Liste des articles écrite dans la page : Google la lit sans exécuter de JavaScript
const ARTICLES_LIST = ARTICLES.map(a => `<a href="/conseils/${a.slug}" onclick="openArticle('${a.slug}'); return false;" class="card card-hover p-6 block"><h3 class="font-bold text-slate-900 text-lg mb-2">${esc(a.title)}</h3><p class="text-sm text-slate-500 leading-relaxed">${esc(a.description)}</p><p class="text-xs font-bold text-emerald-700 mt-3">Lire · ${a.minutes} min</p></a>`).join('');

// Accueil : les 4 conseils les plus récents, une rangée chacun (contenu lisible sans JavaScript)
const HOME_ARTICLES = [...ARTICLES].sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 4)
    .map(a => `<a href="/conseils/${a.slug}" onclick="openArticle('${a.slug}'); return false;" class="article-row"><span class="article-min">${a.minutes} min</span><span><strong>${esc(a.title)}</strong><span class="article-desc">${esc(a.description)}</span></span><span class="article-go" aria-hidden="true">→</span></a>`).join('');

router.get('/robots.txt', (req, res) => {
    res.type('text/plain').send(['User-agent: *', 'Disallow: /api/', 'Disallow: /uploads/', ...PRIVATE.map(p => 'Disallow: ' + p), '', 'Sitemap: ' + PUBLIC_URL + '/sitemap.xml', ''].join('\n'));
});
router.get('/sitemap.xml', (req, res) => {
    const urls = Object.keys(PAGES).map(p => `  <url><loc>${escAttr(PUBLIC_URL + p)}</loc><changefreq>${p === '/offres' ? 'daily' : 'monthly'}</changefreq><priority>${p === '/' ? '1.0' : '0.7'}</priority></url>`);
    res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`);
});

let indexCache = null;
router.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/') || req.path.startsWith('/uploads/') || path.extname(req.path)) return next();
    const p = req.path.replace(/\/+$/, '') || '/';
    const page = PAGES[p];
    const isPrivate = PRIVATE.some(x => p === x || p.startsWith(x + '/'));
    try { if (!indexCache || process.env.NODE_ENV !== 'production') indexCache = fs.readFileSync(INDEX_FILE, 'utf8'); } catch (e) { return next(e); }
    let html = indexCache.replace('<!--ARTICLES_LIST-->', ARTICLES_LIST).replace('<!--HOME_ARTICLES-->', HOME_ARTICLES);
    const article = p.startsWith('/conseils/') && BY_SLUG.get(p.slice('/conseils/'.length));
    if (article) html = html.replace('<article id="article-body" class="article-content card p-6 sm:p-10"><!--ARTICLE_BODY-->', `<article id="article-body" data-slug="${article.slug}" class="article-content card p-6 sm:p-10">${articleHtml(article)}`);
    if (p.startsWith('/conseils/') && !article) res.status(404);
    if (!page && !isPrivate) return res.type('html').send(html);
    if (page) {
        const [title, desc] = page;
        // Aperçu du lien quand la page est partagée (réseaux sociaux, messageries)
        const og = [['og:type', article ? 'article' : 'website'], ['og:locale', 'fr_FR'], ['og:title', title], ['og:description', desc], ['og:url', PUBLIC_URL + p],
            ['og:image', PUBLIC_URL + '/icons/icon-512.png'], ['og:image:width', '512'], ['og:image:height', '512'], ['og:image:alt', 'JobFacile']
        ].map(([k, c]) => `<meta property="${k}" content="${escAttr(c)}">`).join('\n    ')
            + `\n    <meta name="twitter:card" content="summary">\n    <meta name="twitter:title" content="${escAttr(title)}">\n    <meta name="twitter:description" content="${escAttr(desc)}">`;
        // Accueil : présentation du site lisible par Google (nom, logo)
        const ld = p !== '/' ? '' : `\n    <script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@graph': [
            { '@type': 'WebSite', name: 'JobFacile', url: PUBLIC_URL + '/', description: desc, inLanguage: 'fr' },
            { '@type': 'Organization', name: 'JobFacile', url: PUBLIC_URL + '/', logo: PUBLIC_URL + '/icons/icon-512.png' }
        ] }).replace(/</g, '\\u003c')}</script>`;
        html = html.replace(/<title>[^<]*<\/title>/, `<title>${escAttr(title)}</title>`)
            .replace(/<meta name="description" content="[^"]*">/, () => `<meta name="description" content="${escAttr(desc)}">\n    <link rel="canonical" href="${escAttr(PUBLIC_URL + p)}">\n    ${og}${ld}`);
    } else {
        html = html.replace(/<meta name="description"/, '<meta name="robots" content="noindex">\n    <meta name="description"');
    }
    res.type('html').send(html);
});

module.exports = router;
