// Articles de la page Conseils : liste et contenu (le serveur les écrit aussi directement dans la page, voir pages.js)
const router = require('express').Router();
const { ARTICLES, BY_SLUG } = require('../data/articles');

const esc = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const dateFr = (iso) => new Date(iso + 'T12:00:00Z').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

// HTML complet d'un article : titre, date, temps de lecture, texte, appel à l'action
function articleHtml(a) {
    return `<p class="text-sm font-bold text-emerald-700 mb-4 uppercase tracking-wider">Conseils · ${a.minutes} min de lecture</p>
<h1>${esc(a.title)}</h1>
<p class="text-sm text-slate-500 mt-5 mb-8">Par l’équipe JobFacile · mis à jour le ${dateFr(a.date)}</p>
${a.html}
<div class="mt-8 rounded-2xl bg-emerald-50 border border-emerald-200 p-5"><p class="font-bold text-emerald-900 mb-1">Passez à l’action</p><p class="text-sm text-emerald-900 mb-0">Cherchez des offres près de chez vous, créez votre CV et entraînez-vous à l’entretien : <a href="/offres" class="font-bold underline">voir les offres</a> · <a href="/generateur" class="font-bold underline">générer mon CV</a> · <a href="/entretien" class="font-bold underline">simuler un entretien</a>.</p></div>`;
}
const summary = ({ slug, emoji, title, description, minutes, date }) => ({ slug, emoji, title, description, minutes, date });

router.get('/api/articles', (req, res) => res.json({ success: true, articles: ARTICLES.map(summary) }));
router.get('/api/articles/:slug', (req, res) => {
    const a = BY_SLUG.get(req.params.slug);
    if (!a) return res.status(404).json({ success: false, message: 'Article introuvable.' });
    res.json({ success: true, article: summary(a), html: articleHtml(a) });
});

module.exports = router;
module.exports.articleHtml = articleHtml;
module.exports.esc = esc;
