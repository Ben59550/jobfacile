// Page d'état des services : /etat (page simple, lisible même si le reste du site a un problème) et /api/status.
const router = require('express').Router();
const { requireAuth, tooManyAttempts, clientIp } = require('../security');
const { isAdmin } = require('../services/moderation');
const { getStatus, LABELS } = require('../services/status');

const ICON = { ok: ['✅', 'Fonctionne'], warn: ['⚠️', 'À surveiller'], down: ['❌', 'Perturbé'], off: ['⚪', 'Non activé'], unknown: ['⏳', 'Pas encore vérifié'] };
// Le public voit l'état, jamais le détail technique (messages d'erreur, nombre de comptes…)
const publicView = (st) => ({ checkedAt: st.checkedAt, services: Object.fromEntries(Object.entries(st.services).map(([k, v]) => [k, { state: v.state, label: LABELS[k][0], role: LABELS[k][1] }])) });

router.get('/api/status', async (req, res) => {
    res.json({ success: true, ...publicView(await getStatus()) });
});
router.get('/api/admin/status', requireAuth, async (req, res) => {
    if (!isAdmin(req.user)) return res.status(403).json({ success: false, message: 'Réservé aux administrateurs.' });
    const refresh = req.query.refresh === '1' && !tooManyAttempts('status-refresh:' + clientIp(req), 10, 10 * 60 * 1000);
    res.json({ success: true, labels: LABELS, ...(await getStatus({ refresh })) });
});

router.get('/etat', async (req, res) => {
    const st = publicView(await getStatus());
    const rows = Object.values(st.services).map(s => `<li><span class="i">${ICON[s.state][0]}</span><div><strong>${s.label}</strong><small>${s.role}</small></div><em class="${s.state}">${ICON[s.state][1]}</em></li>`).join('');
    const bad = Object.values(st.services).filter(s => s.state === 'down').length;
    res.set('Cache-Control', 'no-store').type('html').send(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>État des services – JobFacile</title><meta name="robots" content="noindex">
<style>body{font-family:system-ui,Segoe UI,Arial,sans-serif;background:#f1f5f9;color:#0f172a;margin:0;padding:24px 16px}main{max-width:640px;margin:0 auto}
h1{font-size:24px;margin:0 0 4px}p{color:#475569;margin:0 0 20px}.box{background:#fff;border-radius:16px;padding:8px 20px;box-shadow:0 1px 3px rgba(0,0,0,.08)}
.sum{padding:14px 18px;border-radius:14px;font-weight:700;margin-bottom:16px;background:${bad ? '#fef2f2;color:#991b1b' : '#ecfdf5;color:#065f46'}}
ul{list-style:none;margin:0;padding:0}li{display:flex;align-items:center;gap:14px;padding:14px 0;border-bottom:1px solid #e2e8f0}li:last-child{border:0}
.i{font-size:22px}div{flex:1}small{display:block;color:#64748b;font-size:13px}em{font-style:normal;font-size:13px;font-weight:700}
.ok{color:#047857}.warn{color:#b45309}.down{color:#b91c1c}.off,.unknown{color:#64748b}a{color:#047857;font-weight:700}
@media (prefers-color-scheme:dark){body{background:#0b1120;color:#e2e8f0}.box{background:#111a2e}li{border-color:#1e293b}p,small{color:#94a3b8}}</style></head>
<body><main><h1>État des services</h1><p>Vérifié le ${new Date(st.checkedAt).toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' })}. Mise à jour toutes les 5 minutes.</p>
<div class="sum">${bad ? `${bad} service${bad > 1 ? 's' : ''} perturbé${bad > 1 ? 's' : ''} : certaines fonctions peuvent être lentes ou indisponibles.` : 'Tout fonctionne normalement.'}</div>
<div class="box"><ul>${rows}</ul></div><p style="margin-top:20px"><a href="/">← Retour à JobFacile</a></p></main></body></html>`);
});

module.exports = router;
