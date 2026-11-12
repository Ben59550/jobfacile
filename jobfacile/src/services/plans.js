// Formules : gratuite (quotas mensuels sur l'IA) et Premium (abonnement Stripe, IA illimitée, voix naturelle, sans pub).
// Les quotas protègent le budget IA : chaque appel coûte un peu (Groq) ou beaucoup (voix ElevenLabs).
const { getUsers, saveUsers } = require('../db');

// Quotas gratuits, par mois calendaire. Modifiables ici.
const FREE_LIMITS = {
    docs: 3,        // CV, lettres, relances rédigés par l'IA
    analyses: 2,    // analyse du CV, test ATS, compétences manquantes, bilan d'entretien
    interview: 20   // messages du simulateur d'entretien (environ 2 entretiens)
};
const KIND_LABELS = {
    docs: 'documents rédigés par l’IA',
    analyses: 'analyses par l’IA',
    interview: 'messages d’entretien simulé'
};
const PREMIUM_PRICE_LABEL = process.env.PREMIUM_PRICE_LABEL || '4,99 €';

function monthKey(d = new Date()) { return d.toISOString().slice(0, 7); }

// Premium actif : abonnement Stripe en cours (ou essai), ou administrateur du site
function isPremium(u) {
    if (!u) return false;
    if (require('./moderation').isAdmin(u)) return true;
    const p = u.premium;
    if (!p || !['active', 'trialing', 'past_due'].includes(p.status)) return false;
    // past_due : paiement en échec, Stripe réessaie quelques jours ; on garde l'accès jusqu'à la fin de la période payée
    return !p.periodEnd || new Date(p.periodEnd).getTime() > Date.now() - 24 * 3600 * 1000;
}

function usageOf(u) {
    const m = monthKey();
    const usage = u.usage && u.usage.month === m ? u.usage : { month: m };
    return Object.fromEntries(Object.keys(FREE_LIMITS).map(k => [k, usage[k] || 0]));
}

// Ce que le navigateur affiche : formule, utilisation du mois, quotas
function planInfo(u) {
    const premium = isPremium(u);
    const p = u.premium || {};
    return {
        premium,
        status: p.status || null,
        periodEnd: p.periodEnd || null,
        cancelAtPeriodEnd: !!p.cancelAtPeriodEnd,
        canManage: !!p.customerId,
        usage: usageOf(u),
        limits: FREE_LIMITS,
        price: PREMIUM_PRICE_LABEL
    };
}

// Middleware : refuse l'appel si le quota gratuit du mois est atteint ; le compte n'est décompté que si l'appel réussit
function quota(kind) {
    return (req, res, next) => {
        const u = req.user;
        if (isPremium(u)) return next();
        const used = usageOf(u)[kind];
        if (used >= FREE_LIMITS[kind]) {
            return res.status(402).json({
                success: false, quota: true, kind,
                message: `Vous avez utilisé vos ${FREE_LIMITS[kind]} ${KIND_LABELS[kind]} gratuits ce mois-ci. Passez à Premium (${PREMIUM_PRICE_LABEL}/mois) pour continuer sans limite, ou revenez le mois prochain.`
            });
        }
        res.on('finish', () => {
            if (res.statusCode >= 400) return;
            // Relecture du compte : une autre requête a pu le modifier entre-temps
            const fresh = getUsers().find(x => String(x.id) === String(u.id));
            if (!fresh) return;
            const m = monthKey();
            if (!fresh.usage || fresh.usage.month !== m) fresh.usage = { month: m };
            fresh.usage[kind] = (fresh.usage[kind] || 0) + 1;
            try { saveUsers([fresh]); } catch (e) { console.warn('⚠️  Quota non enregistré :', e.message); }
        });
        next();
    };
}

module.exports = { FREE_LIMITS, PREMIUM_PRICE_LABEL, isPremium, planInfo, quota, usageOf, monthKey };
