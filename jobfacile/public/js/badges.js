// JobFacile · Progression : badges, séries de semaines actives et parrainage.
// Script classique (pas un module) : les fonctions sont globales et appelées depuis les attributs onclick de index.html.
// Les badges sont calculés à partir de votre suivi : rien n'est envoyé ailleurs.

// Semaines d'affilée (jusqu'à cette semaine ou la précédente) avec au moins une candidature envoyée
function weeklyStreak(apps) {
    const weeks = new Set(apps.filter(a => a.appliedAt && a.status !== 'todo').map(a => weekStart(a.appliedAt).getTime()));
    const w = weekStart(new Date());
    // La semaine en cours ne casse pas la série tant qu'elle n'est pas finie
    if (!weeks.has(w.getTime())) w.setDate(w.getDate() - 7);
    let n = 0;
    while (weeks.has(w.getTime())) { n++; w.setDate(w.getDate() - 7); }
    return n;
}
function bestStreak(apps) {
    const weeks = [...new Set(apps.filter(a => a.appliedAt && a.status !== 'todo').map(a => weekStart(a.appliedAt).getTime()))].sort((a, b) => a - b);
    let best = 0, cur = 0, prev = null;
    for (const t of weeks) { cur = prev !== null && Math.round((t - prev) / (7 * 864e5)) === 1 ? cur + 1 : 1; best = Math.max(best, cur); prev = t; }
    return best;
}

// [id, icône, nom, comment l'obtenir, test(u, ctx), progression(u, ctx) → [actuel, objectif]]
const BADGES = [
    ['first-app', '🚀', 'Premier pas', 'Envoyer votre première candidature', (u, c) => c.sent >= 1, (u, c) => [c.sent, 1]],
    ['apps-10', '📨', 'Persévérant', 'Envoyer 10 candidatures', (u, c) => c.sent >= 10, (u, c) => [c.sent, 10]],
    ['apps-50', '🏹', 'Infatigable', 'Envoyer 50 candidatures', (u, c) => c.sent >= 50, (u, c) => [c.sent, 50]],
    ['streak-3', '🔥', 'Sur la lancée', '3 semaines d’affilée avec au moins une candidature', (u, c) => c.best >= 3, (u, c) => [c.best, 3]],
    ['streak-8', '⚡', 'Régularité de pro', '8 semaines d’affilée avec au moins une candidature', (u, c) => c.best >= 8, (u, c) => [c.best, 8]],
    ['followup', '✉️', 'Relance assumée', 'Relancer un recruteur', (u, c) => c.followUps >= 1, (u, c) => [c.followUps, 1]],
    ['interview', '🗣️', 'Décroché !', 'Obtenir un entretien', (u, c) => c.interviews >= 1, (u, c) => [c.interviews, 1]],
    ['offer', '🎉', 'Mission accomplie', 'Recevoir une offre', (u, c) => c.offers >= 1, (u, c) => [c.offers, 1]],
    ['profile', '🪪', 'Profil complet', 'Titre, ville, poste, 3 compétences, une expérience et un diplôme', (u, c) => c.profile >= 6, (u, c) => [c.profile, 6]],
    ['sim-1', '🎤', 'Échauffement', 'Terminer un entretien simulé avec bilan', (u, c) => c.sims >= 1, (u, c) => [c.sims, 1]],
    ['sim-70', '🏅', 'Prêt pour le jour J', 'Obtenir 70/100 ou plus à un entretien simulé', (u, c) => c.bestSim >= 70, (u, c) => [c.bestSim, 70]],
    ['sim-up', '📈', 'En progrès', 'Gagner 15 points entre votre premier et votre meilleur entretien simulé', (u, c) => c.simGain >= 15, (u, c) => [Math.max(0, c.simGain), 15]],
    ['ambassador', '🤝', 'Ambassadeur', 'Parrainer une personne (e-mail vérifié)', (u, c) => c.referrals >= 1, (u, c) => [c.referrals, 1]],
    ['ambassador-5', '🌟', 'Super ambassadeur', 'Parrainer 5 personnes', (u, c) => c.referrals >= 5, (u, c) => [c.referrals, 5]]
];
let referralInfo = null;
function badgeContext(u) {
    const apps = (u.applications || []).filter(a => a && a.id);
    const sims = (u.interviewHistory || []).slice().reverse(); // plus ancien d'abord
    return {
        sent: apps.filter(a => a.status !== 'todo').length,
        best: bestStreak(apps), streak: weeklyStreak(apps),
        followUps: apps.reduce((n, a) => n + (a.followUps || []).length, 0),
        interviews: apps.filter(a => ['interview', 'offer'].includes(a.status)).length,
        offers: apps.filter(a => a.status === 'offer').length,
        profile: [u.headline, u.city, u.desiredJob, (u.skills || []).length >= 3, (u.experience || []).length >= 1, (u.education || []).length >= 1].filter(Boolean).length,
        sims: sims.length, bestSim: Math.max(0, ...sims.map(s => s.score || 0)),
        simGain: sims.length >= 2 ? Math.max(...sims.map(s => s.score || 0)) - (sims[0].score || 0) : 0,
        referrals: referralInfo ? referralInfo.count : 0
    };
}
function earnedBadges(u) { const c = badgeContext(u); return BADGES.filter(b => b[4](u, c)).map(b => b[0]); }

// Nouveau badge depuis la dernière visite : petite célébration
function checkNewBadges() {
    if (!currentUser || !authToken) return;
    const key = 'jf-badges-' + currentUser.id;
    const earned = earnedBadges(currentUser);
    let seen = null; try { seen = JSON.parse(localStorage.getItem(key)); } catch (e) {}
    try { localStorage.setItem(key, JSON.stringify(earned)); } catch (e) {}
    if (!Array.isArray(seen)) return; // première fois : pas de rafale de notifications
    const fresh = earned.filter(id => !seen.includes(id));
    fresh.slice(0, 2).forEach((id, i) => {
        const b = BADGES.find(x => x[0] === id);
        setTimeout(() => showNotification(`${b[1]} Nouveau badge : « ${b[2]} » !`), 600 + i * 1200);
    });
}

async function loadReferral() {
    const d = await api('/api/user/referral', { silent: true }).catch(() => null);
    if (d && d.success) referralInfo = d;
    return referralInfo;
}
async function renderProgress() {
    const box = document.getElementById('tracker-progress');
    if (!box || !currentUser) return;
    if (!referralInfo) { box.innerHTML = '<div class="skeleton h-40 w-full rounded-2xl"></div>'; await loadReferral(); }
    const u = currentUser, c = badgeContext(u);
    const earned = BADGES.filter(b => b[4](u, c));
    const card = (b, ok) => {
        const [cur, goal] = b[5](u, c);
        const pct = Math.min(100, Math.round(cur / goal * 100));
        return `<div class="card p-4 ${ok ? '' : 'opacity-70'}" title="${esc(b[3])}">
            <div class="flex items-center gap-3">
                <span class="w-12 h-12 shrink-0 rounded-2xl grid place-items-center text-2xl ${ok ? 'bg-emerald-100' : 'bg-slate-100 grayscale'}">${b[1]}</span>
                <div class="min-w-0"><p class="font-bold text-slate-900 text-sm">${esc(b[2])}</p><p class="text-xs text-slate-500">${esc(b[3])}</p></div>
            </div>
            ${ok ? '<p class="text-xs font-bold text-emerald-700 mt-3">✓ Obtenu</p>' : `<div class="mt-3"><div class="h-1.5 rounded-full bg-slate-100 overflow-hidden"><div class="h-full rounded-full bg-emerald-500" style="width:${pct}%"></div></div><p class="text-[11px] text-slate-500 mt-1">${Math.min(cur, goal)} / ${goal}</p></div>`}
        </div>`;
    };
    const r = referralInfo;
    box.innerHTML = `
        <div class="grid lg:grid-cols-3 gap-4 mb-6">
            <div class="card p-5 flex items-center gap-4">
                <span class="text-4xl">${c.streak ? '🔥' : '🕯️'}</span>
                <div><p class="text-xs font-semibold text-slate-500">Série en cours</p><p class="text-2xl font-extrabold text-slate-900">${c.streak} semaine${c.streak > 1 ? 's' : ''}</p>
                <p class="text-xs text-slate-500">${c.streak ? 'Envoyez au moins une candidature cette semaine pour la prolonger.' : 'Une candidature cette semaine lance votre série.'} Record : ${c.best}.</p></div>
            </div>
            <div class="card p-5 flex items-center gap-4">
                <span class="text-4xl">🏆</span>
                <div><p class="text-xs font-semibold text-slate-500">Badges obtenus</p><p class="text-2xl font-extrabold text-slate-900">${earned.length} / ${BADGES.length}</p>
                <div class="h-2 w-40 rounded-full bg-slate-100 overflow-hidden mt-1"><div class="h-full bg-emerald-500 rounded-full" style="width:${Math.round(earned.length / BADGES.length * 100)}%"></div></div></div>
            </div>
            <div class="card p-5">
                <p class="font-bold text-slate-900 text-sm">🤝 Parrainez vos proches</p>
                <p class="text-xs text-slate-500 mb-3">Partagez votre lien : chaque personne qui crée son compte et vérifie son e-mail compte comme filleul.</p>
                ${r ? `<div class="flex gap-2"><input id="ref-link" readonly value="${esc(r.link)}" class="field field-sm flex-1 min-w-0" aria-label="Votre lien de parrainage" onclick="this.select()">
                <button onclick="shareReferral()" class="btn-primary px-3 rounded-xl text-xs font-bold whitespace-nowrap">Partager</button></div>
                <p class="text-xs text-slate-600 mt-2">Code : <strong class="tracking-wider">${esc(r.code)}</strong> · <strong>${r.count}</strong> filleul${r.count > 1 ? 's' : ''}${r.pending ? ` (+${r.pending} en attente de vérification)` : ''}${r.recent.length ? ' : ' + r.recent.map(x => esc(x.name)).join(', ') : ''}</p>` : '<p class="text-xs text-rose-600">Lien indisponible pour le moment.</p>'}
            </div>
        </div>
        <h3 class="font-bold text-slate-900 mb-3">Mes badges</h3>
        <div class="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">${[...earned.map(b => card(b, true)), ...BADGES.filter(b => !earned.includes(b)).map(b => card(b, false))].join('')}</div>`;
}
async function shareReferral() {
    if (!referralInfo) return;
    const text = `Je cherche du travail avec JobFacile : offres près de chez soi, CV et lettres par IA, entraînement aux entretiens. Inscris-toi avec mon lien :`;
    try {
        if (navigator.share) { await navigator.share({ title: 'JobFacile', text, url: referralInfo.link }); return; }
        await navigator.clipboard.writeText(referralInfo.link);
        showNotification('Lien de parrainage copié 🔗');
    } catch (e) { if (!e || e.name !== 'AbortError') { document.getElementById('ref-link').select(); showNotification('Copiez le lien affiché.', 'error'); } }
}

// Arrivée par un lien d'invitation : /?parrain=CODE
(function captureReferral() {
    const p = new URLSearchParams(location.search);
    const code = (p.get('parrain') || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
    if (!code) return;
    try { localStorage.setItem('jf-ref', JSON.stringify({ code, at: Date.now() })); } catch (e) {}
    p.delete('parrain');
    history.replaceState(history.state, '', location.pathname + (p.toString() ? '?' + p : '') + location.hash);
    if (authToken) return; // déjà membre
    fetch('/api/referral/' + code).then(r => r.json()).then(d => {
        if (!d.success) return;
        const bar = document.createElement('div');
        bar.className = 'fixed top-20 left-1/2 -translate-x-1/2 z-40 card shadow-2xl px-4 py-3 flex items-center gap-3 max-w-[calc(100%-2rem)]';
        bar.innerHTML = `<span class="text-2xl">👋</span><p class="text-sm font-semibold text-slate-800"><span></span> vous invite sur JobFacile.</p>
            <button class="btn-primary px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap">Créer mon compte</button><button aria-label="Fermer" class="text-slate-400 hover:text-slate-700 px-1">✕</button>`;
        bar.querySelector('p span').textContent = d.firstName;
        bar.querySelector('.btn-primary').onclick = () => { bar.remove(); openAuthModal('register'); };
        bar.querySelector('[aria-label="Fermer"]').onclick = () => bar.remove();
        document.body.appendChild(bar);
    }).catch(() => {});
})();
// Code de parrainage gardé 30 jours, envoyé à l'inscription
function pendingReferralCode() {
    try {
        const r = JSON.parse(localStorage.getItem('jf-ref'));
        return r && Date.now() - r.at < 30 * 864e5 ? r.code : undefined;
    } catch (e) { return undefined; }
}
