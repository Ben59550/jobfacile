// JobFacile · Premium : fenêtre d'abonnement, quotas gratuits du mois, retour du paiement Stripe, pub masquée pour les abonnés.

const PREMIUM_PERKS = [
    ['✨', 'CV, lettres et relances par l’IA', 'sans limite'],
    ['🔍', 'Analyses du CV, test ATS, compétences manquantes', 'sans limite'],
    ['🎤', 'Entretiens simulés', 'sans limite'],
    ['🔊', 'Voix naturelle du recruteur', 'incluse'],
    ['🚫', 'Aucune publicité', '']
];
const USAGE_LABELS = { docs: 'Documents rédigés par l’IA', analyses: 'Analyses par l’IA', interview: 'Messages d’entretien simulé' };

function planOf(u) { return (u && u.plan) || null; }

// Ouvre la fenêtre (reason : message affiché en haut, par ex. quota atteint)
function openPremium(reason) {
    if (!currentUser || !authToken) { openAuthModal('register'); showNotification('Créez un compte gratuit pour commencer.', 'success'); return; }
    const box = document.getElementById('premium-reason');
    box.textContent = reason || '';
    box.classList.toggle('hidden', !reason);
    renderPremium();
    document.getElementById('premium-modal').classList.remove('hidden');
    // Utilisation du mois à jour
    api('/api/premium', { silent: true }).then(d => { if (d.success && currentUser) { currentUser.plan = d.plan; window._paymentsOpen = d.payments; renderPremium(); } });
}

function renderPremium() {
    const p = planOf(currentUser);
    const body = document.getElementById('premium-body');
    if (!p || !body) return;
    const date = (iso) => iso ? new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
    if (p.premium) {
        body.innerHTML = `
            <div class="rounded-2xl bg-emerald-50 border border-emerald-200 p-4">
                <p class="font-bold text-emerald-800">✓ Vous êtes Premium</p>
                <p class="text-sm text-emerald-800 mt-1">${p.periodEnd ? (p.cancelAtPeriodEnd ? 'Abonnement résilié : Premium reste actif jusqu’au ' : 'Prochain renouvellement le ') + esc(date(p.periodEnd)) + '.' : 'Accès complet.'}</p>
            </div>
            <ul class="mt-4 space-y-2">${PREMIUM_PERKS.map(([i, t]) => `<li class="flex items-center gap-3 text-sm text-slate-700"><span class="w-8 h-8 rounded-lg bg-slate-100 grid place-items-center">${i}</span>${t}</li>`).join('')}</ul>
            ${p.canManage ? `<button onclick="openBillingPortal()" class="btn-ghost w-full mt-5 py-3 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-700">Gérer mon abonnement (factures, carte, résiliation)</button>` : ''}`;
        return;
    }
    const usage = Object.keys(p.limits).map(k => {
        const used = Math.min(p.usage[k] || 0, p.limits[k]), max = p.limits[k], pct = Math.round(used / max * 100);
        return `<div>
            <div class="flex justify-between text-xs font-semibold text-slate-600 mb-1"><span>${USAGE_LABELS[k] || k}</span><span>${used} / ${max}</span></div>
            <div class="premium-track h-2.5 rounded-full overflow-hidden"><div class="h-full rounded-full ${pct >= 100 ? 'bg-rose-500' : 'btn-primary'}" style="width:${pct}%"></div></div>
        </div>`;
    }).join('');
    const closed = window._paymentsOpen === false;
    body.innerHTML = `
        <ul class="space-y-2">${PREMIUM_PERKS.map(([i, t, s]) => `<li class="flex items-center gap-3 text-sm text-slate-700"><span class="w-8 h-8 shrink-0 rounded-lg bg-amber-50 grid place-items-center">${i}</span><span class="flex-1">${t}</span>${s ? `<span class="text-xs font-bold text-emerald-700">${s}</span>` : ''}</li>`).join('')}</ul>
        <div class="premium-usage mt-5 rounded-2xl p-4 space-y-3">
            <p class="text-xs font-bold text-slate-500 uppercase tracking-wider">Votre formule gratuite ce mois-ci</p>
            ${usage}
            <p class="text-xs text-slate-500">Compteurs remis à zéro le 1er de chaque mois. La recherche d’offres, le suivi et le PDF restent gratuits et illimités.</p>
        </div>
        <p class="mt-5 text-center"><span class="text-3xl font-extrabold text-slate-900">${esc(p.price)}</span><span class="text-slate-500 font-semibold"> / mois</span><br><span class="text-xs text-slate-500">Sans engagement, résiliable à tout moment en 2 clics.</span></p>
        <label class="mt-4 flex items-start gap-3 text-xs text-slate-600 cursor-pointer">
            <input type="checkbox" id="premium-waiver" class="mt-0.5 w-4 h-4 accent-emerald-600 shrink-0">
            <span>Je demande l’accès immédiat à Premium et je reconnais perdre mon droit de rétractation de 14 jours une fois l’accès commencé.</span>
        </label>
        <button onclick="startCheckout()" id="premium-buy" ${closed ? 'disabled' : ''} class="btn-primary w-full mt-4 py-3.5 rounded-xl text-sm font-bold disabled:opacity-50">${closed ? 'Paiement bientôt disponible' : '⭐ Passer Premium'}</button>
        <p class="mt-3 text-xs text-slate-400 text-center">Paiement sécurisé par Stripe. JobFacile ne voit jamais votre numéro de carte.</p>`;
}

async function startCheckout() {
    const waiver = document.getElementById('premium-waiver');
    if (!waiver || !waiver.checked) { showNotification('Cochez la case pour accéder tout de suite à Premium.', 'error'); waiver && waiver.focus(); return; }
    const btn = document.getElementById('premium-buy');
    btn.disabled = true; btn.textContent = 'Ouverture du paiement…';
    const d = await api('/api/premium/checkout', { json: { waiver: true } });
    if (d.success && d.url) { location.href = d.url; return; }
    showNotification(d.message || 'Paiement indisponible.', 'error');
    btn.disabled = false; btn.textContent = '⭐ Passer Premium';
}

async function openBillingPortal() {
    const d = await api('/api/premium/portal', { method: 'POST' });
    if (d.success && d.url) location.href = d.url;
    else showNotification(d.message || 'Espace abonnement indisponible.', 'error');
}

// Pub masquée pour les abonnés : retenu dans le navigateur, appliqué dès le chargement suivant (voir le <head>)
function syncPremiumFlag() {
    const on = !!(currentUser && currentUser.plan && currentUser.plan.premium);
    try { on ? localStorage.setItem('jobfacile_premium', '1') : localStorage.removeItem('jobfacile_premium'); } catch (e) {}
    document.documentElement.classList.toggle('is-premium', on);
}

// Retour de la page de paiement Stripe (?premium=merci | annule | compte)
window.addEventListener('DOMContentLoaded', () => {
    const q = new URLSearchParams(location.search);
    const back = q.get('premium');
    const sessionId = q.get('session_id');
    if (!back) return;
    history.replaceState(null, '', location.pathname);
    if (back === 'annule') { showNotification('Paiement annulé : rien n’a été débité.', 'error'); return; }
    // Le serveur vérifie le paiement auprès de Stripe ; on relit le compte jusqu'à voir Premium
    let tries = 0;
    const check = async () => {
        if (!authToken) return;
        if (back === 'merci' && sessionId) await api('/api/premium/confirm', { json: { sessionId }, silent: true });
        const me = await api('/api/me', { silent: true });
        if (me.success) setSession(me.user);
        if (me.success && me.user.plan && me.user.plan.premium) {
            if (back === 'merci') { showNotification('Merci ! Premium est activé ⭐', 'success'); syncPremiumFlag(); setTimeout(() => location.reload(), 1500); }
            return;
        }
        if (back === 'merci' && ++tries < 10) setTimeout(check, 2000);
        else if (back === 'merci') showNotification('Paiement reçu : Premium sera activé dans quelques instants.', 'success');
    };
    setTimeout(check, 800);
});
