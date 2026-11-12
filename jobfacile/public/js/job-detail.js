// JobFacile · Offres : compatibilité, fiche détaillée, ATS, salaire, offres masquées, comparateur, position, relance IA, lettre ciblée.
// Script classique (pas un module) : les fonctions sont globales et appelées depuis les attributs onclick de index.html.
// Ordre de chargement : app-core → interview → job-detail → tracker → account → navigation → ui → search.

// ---------- Offres : état partagé ----------
const jobsById = new Map();
let targetOffer = null;
let currentTrackerTab = 'apps';
let openJobId = null;

function foldTxt(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }
const STOPWORDS = new Set(['les', 'des', 'une', 'pour', 'avec', 'sur', 'par', 'dans', 'aux', 'est', 'poste', 'emploi', 'job', 'offre', 'confirme', 'confirmee', 'junior', 'senior', 'cdi', 'cdd', 'alternance', 'stage', 'h/f', 'f/h', 'nous', 'vous', 'votre', 'notre', 'chez', 'sera', 'etre', 'avoir', 'plus', 'tous', 'toute', 'ses', 'son', 'leur']);
function tokens(s) {
    return foldTxt(s).replace(/[^a-z0-9+#.]+/g, ' ').split(' ')
        .map(t => t.replace(/^\.+|\.+$/g, '').replace(/\.js$/, ''))
        .filter(t => t.length >= 3 && !STOPWORDS.has(t));
}
function stem(t) { return t.length > 6 ? t.slice(0, 6) : t; }

// Score de compatibilité : compétences du profil retrouvées dans l'offre + proximité de l'intitulé avec le parcours
function computeMatch(j) {
    if (!currentUser || !authToken) return null;
    const skills = Array.isArray(currentUser.skills) ? currentUser.skills : [];
    const exps = (currentUser.experience || []).map(e => e && e.title).filter(Boolean);
    const edus = (currentUser.education || []).map(e => e && e.degree).filter(Boolean);
    // Sans compétences dans le profil, un score n'aurait pas de sens
    if (!skills.length) return { score: null, matched: [] };
    const jobStems = new Set(tokens(`${j.title} ${j.domain} ${j.fullDescription || j.description}`).map(stem));
    const matched = skills.filter(s => tokens(s).some(t => jobStems.has(stem(t))));
    const profileStems = new Set(tokens([...exps, ...skills, ...edus, currentUser.desiredJob || '', currentUser.headline || ''].join(' ')).map(stem));
    const titleStems = [...new Set(tokens(j.title).map(stem))];
    const titleRatio = titleStems.length ? titleStems.filter(t => profileStems.has(t)).length / titleStems.length : 0;
    const skillRatio = skills.length ? Math.min(1, matched.length / Math.min(skills.length, 4)) : 0;
    const raw = 0.55 * skillRatio + 0.45 * titleRatio;
    return { score: Math.min(99, Math.round(100 * raw)), matched };
}
function matchBadge(m, size = 'sm') {
    // Sur les cartes, on n'affiche le score que s'il veut dire quelque chose
    if (!m || m.score === null || m.score < 20) return '';
    const cls = m.score >= 70 ? 'bg-emerald-500 text-white' : m.score >= 45 ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-500';
    const pad = size === 'lg' ? 'px-3 py-1.5 text-sm' : 'px-2.5 py-1 text-xs';
    return `<span class="${cls} ${pad} rounded-full font-bold whitespace-nowrap" title="Compatibilité avec votre profil">⚡ ${m.score} %</span>`;
}

function favorites() { return (currentUser && Array.isArray(currentUser.favorites) ? currentUser.favorites : []).filter(f => f && typeof f === 'object' && f.id); }
function applications() { return (currentUser && Array.isArray(currentUser.applications) ? currentUser.applications : []).filter(a => a && a.id); }
function isFavorite(id) { return favorites().some(f => f.id === id); }
function appFor(id) { return applications().find(a => a.id === id); }

const STATUSES = [
    { key: 'todo', label: 'À postuler', icon: '📝', dot: 'bg-slate-400', soft: 'bg-slate-100 text-slate-700' },
    { key: 'applied', label: 'Postulé', icon: '📨', dot: 'bg-sky-500', soft: 'bg-sky-50 text-sky-700' },
    { key: 'interview', label: 'Entretien', icon: '🗣️', dot: 'bg-amber-500', soft: 'bg-amber-50 text-amber-700' },
    { key: 'offer', label: 'Offre reçue', icon: '🎉', dot: 'bg-emerald-500', soft: 'bg-emerald-50 text-emerald-700' },
    { key: 'rejected', label: 'Refus', icon: '✖️', dot: 'bg-rose-400', soft: 'bg-rose-50 text-rose-700' }
];
const statusOf = (k) => STATUSES.find(s => s.key === k) || STATUSES[0];
function daysSince(iso) { return iso ? Math.floor((Date.now() - new Date(iso).getTime()) / 86400000) : null; }

function heartIcon(on) {
    return on
        ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="#f43f5e" stroke="#f43f5e" stroke-width="2"><path d="M12 21s-7.5-4.6-9.5-9.2C1 8.3 3.2 5 6.6 5c2 0 3.4 1 5.4 3 2-2 3.4-3 5.4-3 3.4 0 5.6 3.3 4.1 6.8C19.5 16.4 12 21 12 21z"/></svg>'
        : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 21s-7.5-4.6-9.5-9.2C1 8.3 3.2 5 6.6 5c2 0 3.4 1 5.4 3 2-2 3.4-3 5.4-3 3.4 0 5.6 3.3 4.1 6.8C19.5 16.4 12 21 12 21z"/></svg>';
}

function renderJobCard(j, i = 0) {
    jobsById.set(j.id, j);
    const m = computeMatch(j);
    const fav = isFavorite(j.id);
    const app = appFor(j.id);
    const seen = isSeen(j.id);
    const cmp = compareIds.includes(j.id);
    return `
        <article data-id="${esc(j.id)}" onclick="openJobModal(this.dataset.id)" class="card card-hover p-5 flex flex-col fade-up cursor-pointer ${seen ? 'job-seen' : ''}" style="animation-delay:${i * 40}ms">
            <div class="flex items-start gap-4">
                <span class="w-12 h-12 shrink-0 rounded-xl bg-gradient-to-br ${colorFor(j.company + j.domain)} text-white grid place-items-center text-xl shadow-sm">${domainIcon(j)}</span>
                <div class="min-w-0 flex-1">
                    <h3 class="font-bold text-slate-900 leading-snug">${esc(j.title)}</h3>
                    <p class="text-sm text-slate-500 truncate">${esc(j.company)}</p>
                    ${j.localOffer ? '<span class="inline-block mt-1 text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 rounded-full px-2 py-0.5">✓ Recrute sur JobFacile</span>' : ''}
                    ${seen ? '<span class="inline-block mt-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">👁 Déjà vue</span>' : ''}
                </div>
                <button type="button" data-fav-id="${esc(j.id)}" onclick="event.stopPropagation(); toggleFavorite(this.dataset.favId)" aria-label="Ajouter aux favoris" class="fav-btn w-9 h-9 shrink-0 rounded-full grid place-items-center text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition">${heartIcon(fav)}</button>
            </div>
            <div class="flex flex-wrap gap-2 mt-4">
                ${matchBadge(m)}
                <span class="text-xs font-bold px-2.5 py-1 rounded-full ${j.category === 'alternance' ? 'bg-violet-50 text-violet-700' : 'bg-emerald-50 text-emerald-700'}">${esc(j.type)}</span>
                <span class="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 max-w-full truncate">📍 ${esc(j.location)}</span>
                ${commuteChip(j)}
                ${j.salary ? `<span class="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 max-w-full truncate">💶 ${esc(j.salary)}</span>` : ''}
                ${app ? `<span class="text-xs font-bold px-2.5 py-1 rounded-full ${statusOf(app.status).soft}">${statusOf(app.status).icon} ${statusOf(app.status).label}</span>` : ''}
            </div>
            <p class="text-sm text-slate-500 mt-4 flex-1 line-clamp-3">${esc(j.description)}</p>
            <div class="flex items-center justify-between mt-5 pt-4 border-t border-slate-100">
                <span class="text-xs text-slate-400">${esc(j.date)}${j.source ? ' · ' + esc(j.source) : ''}${(j.alsoOn || []).length ? ' · aussi sur ' + j.alsoOn.map(esc).join(', ') : ''}</span>
                <span class="inline-flex items-center gap-1">
                    ${currentUser && authToken ? `<button type="button" data-id="${esc(j.id)}" onclick="event.stopPropagation(); hideJob(this.dataset.id)" title="Pas intéressé : masquer cette offre" aria-label="Masquer cette offre" class="px-2 py-1 rounded-lg text-xs font-semibold text-slate-400 hover:text-rose-600 hover:bg-rose-50">🙈</button>` : ''}
                    <button type="button" data-id="${esc(j.id)}" onclick="event.stopPropagation(); toggleCompare(this.dataset.id)" aria-pressed="${cmp}" title="Comparer (3 offres maximum)" class="cmp-btn px-2 py-1 rounded-lg text-xs font-bold ${cmp ? 'bg-emerald-600 text-white' : 'text-slate-500 hover:bg-slate-100'}">⇄ ${cmp ? 'Comparée' : 'Comparer'}</button>
                    <span class="text-sm font-bold text-emerald-600 inline-flex items-center gap-1 ml-1">Détail <span>→</span></span>
                </span>
            </div>
        </article>`;
}

function updateFavButtons() {
    document.querySelectorAll('.fav-btn').forEach(b => { b.innerHTML = heartIcon(isFavorite(b.dataset.favId)); });
}

// ---------- Fiche détaillée ----------
function openJobModal(id) {
    const j = jobsById.get(id);
    if (!j) return;
    openJobId = id;
    const m = computeMatch(j);
    const app = appFor(id);
    const desc = j.fullDescription || j.description || '';
    let matchBlock;
    if (!currentUser || !authToken) {
        matchBlock = `<div class="rounded-2xl bg-slate-50 border border-slate-200 p-4 text-sm text-slate-600">⚡ <a href="#" onclick="closeJobModal(); openAuthModal('login'); return false;" class="font-bold text-emerald-600 underline">Connectez-vous</a> pour voir votre compatibilité avec cette offre.</div>`;
    } else if (m.score === null) {
        matchBlock = `<div class="rounded-2xl bg-slate-50 border border-slate-200 p-4 text-sm text-slate-600">⚡ Pour voir votre compatibilité avec cette offre, <a href="#" onclick="closeJobModal(); accessProfileView('cv'); return false;" class="font-bold text-emerald-600 underline">ajoutez vos compétences</a> à votre profil, ou laissez l'IA les trouver en <a href="#" onclick="closeJobModal(); accessProfileView('cv'); return false;" class="font-bold text-emerald-600 underline">analysant votre CV</a>.</div>`;
    } else {
        const color = m.score >= 70 ? '#10b981' : m.score >= 45 ? '#f59e0b' : '#94a3b8';
        const verdict = m.score >= 70 ? 'Très bonne correspondance avec votre profil' : m.score >= 45 ? 'Correspondance partielle' : m.score >= 20 ? 'Peu de points communs avec votre profil' : 'Cette offre ne correspond pas à votre profil actuel';
        matchBlock = `
            <div class="rounded-2xl border border-slate-200 p-4 flex items-center gap-4">
                <div class="relative w-16 h-16 shrink-0 rounded-full grid place-items-center" style="background: conic-gradient(${color} ${m.score * 3.6}deg, #e2e8f0 0)">
                    <div class="w-12 h-12 rounded-full bg-white grid place-items-center text-sm font-extrabold text-slate-900">${m.score}%</div>
                </div>
                <div class="min-w-0">
                    <p class="font-bold text-slate-900 text-sm">${verdict}</p>
                    <p class="text-xs text-slate-500 mt-1">${m.matched.length ? 'Compétences en commun : ' + m.matched.map(esc).join(', ') : 'Aucune de vos compétences n’est citée dans l’annonce.'}</p>
                </div>
            </div>`;
    }
    document.getElementById('job-modal-body').innerHTML = `
        <div id="apply-prompt"></div>
        <div class="flex items-start gap-4 pr-10 mb-5">
            <span class="w-14 h-14 shrink-0 rounded-2xl bg-gradient-to-br ${colorFor(j.company + j.domain)} text-white grid place-items-center text-2xl shadow-sm">${domainIcon(j)}</span>
            <div class="min-w-0">
                <h3 class="text-xl sm:text-2xl font-extrabold text-slate-900 leading-tight">${esc(j.title)}</h3>
                <p class="text-slate-500 font-semibold mt-1">${esc(j.company)}${j.localOffer ? ' <span class="text-xs font-bold text-emerald-700 bg-emerald-50 rounded-full px-2 py-0.5 align-middle">✓ Entreprise vérifiée (SIRET)</span>' : ''}</p>
            </div>
        </div>
        <div class="flex flex-wrap gap-2 mb-5">
            <span class="text-xs font-bold px-2.5 py-1 rounded-full ${j.category === 'alternance' ? 'bg-violet-50 text-violet-700' : 'bg-emerald-50 text-emerald-700'}">${esc(j.type)}</span>
            <span class="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">📍 ${esc(j.location)}</span>
            ${j.salary ? `<span class="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-50 text-amber-700">💶 ${esc(j.salary)}</span>` : ''}
            ${j.domain ? `<span class="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">${esc(j.domain)}</span>` : ''}
            ${j.date ? `<span class="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">🕒 ${esc(j.date)}</span>` : ''}
        </div>
        ${matchBlock}
        ${requirementsBlock(j)}
        ${currentUser && authToken ? `<div id="skill-gap" class="mt-4"><button onclick="loadSkillGap(openJobId)" class="w-full rounded-2xl border-2 border-dashed border-slate-200 hover:border-emerald-300 hover:bg-emerald-50 p-3 text-sm font-bold text-slate-600 hover:text-emerald-700 transition">🎓 Qu'est-ce qu'il me manque pour ce poste ? <span class="font-normal text-xs">(et quelles formations suivre)</span></button></div>` : ''}
        ${currentUser && authToken ? `<div id="ats-box" class="mt-3"><button onclick="runAtsCheck(openJobId)" class="w-full rounded-2xl border-2 border-dashed border-slate-200 hover:border-sky-300 hover:bg-sky-50 p-3 text-sm font-bold text-slate-600 hover:text-sky-700 transition">🤖 Mon CV passe-t-il les robots de tri (ATS) pour cette offre ?</button></div>` : ''}
        <div id="job-salary"></div>
        <div id="job-address"></div>
        <div id="job-commute"></div>
        ${app ? `<p class="mt-4 text-sm font-semibold ${statusOf(app.status).soft} rounded-xl px-4 py-2.5">${statusOf(app.status).icon} Dans votre suivi : ${statusOf(app.status).label}</p>` : ''}
        <h4 class="font-bold text-slate-900 mt-6 mb-2">Description du poste</h4>
        <p class="text-sm text-slate-600 leading-relaxed whitespace-pre-line">${esc(desc) || 'Aucune description fournie.'}</p>
        ${currentUser && authToken ? `<p class="mt-6 text-right"><button onclick="hideJob(openJobId, true)" class="text-xs font-semibold text-slate-400 hover:text-rose-600">🙈 ${hiddenIds().has(j.id) ? 'Offre masquée · la réafficher' : 'Pas intéressé : ne plus me montrer cette offre'}</button></p>` : ''}
        ${j.localOffer ? `<p class="mt-2 text-right"><button onclick="reportContent('offer', openJobId)" class="text-xs font-semibold text-slate-400 hover:text-rose-600">🚩 Signaler cette offre (arnaque, fausse offre…)</button></p>` : ''}
        ${j.source === 'Adzuna' || desc.length < 600 ? `<p class="text-xs text-slate-400 mt-3">Extrait de l'annonce. La version complète est sur le site d'origine${j.source ? ' (via ' + esc(j.source) + ')' : ''}.</p>` : ''}
    `;
    renderJobModalActions(j);
    markSeen(j.id);
    if (j.localOffer) fetch('/api/local-offers/' + encodeURIComponent(j.id) + '/view', { method: 'POST' }).catch(() => {});
    loadSalaryInsight(j);
    renderJobAddress(j);
    const located = j.exactChecked ? Promise.resolve() : locateJobs([j]).then(() => { if (openJobId === id) renderJobAddress(j); });
    located.then(() => { if (openJobId === id) loadCommuteDetail(j); });
    document.getElementById('job-modal').classList.remove('hidden');
    if (!routing && !(history.state && history.state.modal === id)) {
        modalBaseUrl = location.pathname + location.search;
        try { history.pushState({ modal: id }, '', '/offre/' + encodeURIComponent(id)); } catch (e) {}
    }
    document.getElementById('job-modal-body').scrollTop = 0;
}

// Compétences manquantes + formations (IA), mémorisé par offre
const skillGaps = new Map();
async function loadSkillGap(id) {
    const j = jobsById.get(id);
    const box = document.getElementById('skill-gap');
    if (!j || !box) return;
    if (!skillGaps.has(id)) {
        box.innerHTML = '<div class="rounded-2xl border border-slate-200 p-4 space-y-2"><div class="skeleton h-3 w-2/3"></div><div class="skeleton h-3 w-full"></div><div class="skeleton h-3 w-4/5"></div><p class="text-xs text-slate-400">L’IA compare l’annonce à votre profil…</p></div>';
        const data = await api('/api/ai/skill-gap', { json: { offer: { title: j.title, company: j.company, fullDescription: (j.fullDescription || j.description || '').slice(0, 3000) } } });
        if (!data.success) { box.innerHTML = ''; return showNotification(data.message || 'Analyse impossible.', 'error'); }
        skillGaps.set(id, data.gap);
    }
    if (openJobId !== id) return;
    const g = skillGaps.get(id);
    const city = (currentUser && currentUser.city) || '';
    const ftUrl = (k) => 'https://candidat.francetravail.fr/formations/recherche?motsCles=' + encodeURIComponent(k) + (city ? '&lieu=' + encodeURIComponent(city) : '');
    box.innerHTML = `
        <div class="rounded-2xl border border-slate-200 p-4">
            <p class="font-bold text-slate-900 text-sm mb-2">🎓 Vos atouts et ce qu'il vous manque</p>
            ${g.have.length ? `<div class="flex flex-wrap gap-2 mb-3">${g.have.map(h => `<span class="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700">✓ ${esc(h)}</span>`).join('')}</div>` : ''}
            ${g.missing.length ? `<ul class="space-y-2">${g.missing.map(m => `
                <li class="rounded-xl bg-slate-50 p-3">
                    <div class="flex flex-wrap items-center gap-2"><span class="font-bold text-sm text-slate-900">${esc(m.skill)}</span><span class="text-[11px] font-bold px-2 py-0.5 rounded-full ${m.importance === 'indispensable' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700'}">${m.importance}</span></div>
                    ${m.training ? `<p class="text-xs text-slate-600 mt-1">📚 ${esc(m.training)}${m.duration ? ' · ' + esc(m.duration) : ''}${m.funding ? ' · 💳 ' + esc(m.funding) : ''}</p>` : ''}
                    <a href="${ftUrl(m.keywords)}" target="_blank" rel="noopener" class="inline-block mt-1.5 text-xs font-bold text-emerald-600 underline">Trouver une formation près de chez moi ↗</a>
                </li>`).join('')}</ul>` : '<p class="text-sm text-emerald-700 font-semibold">Votre profil couvre les exigences principales de l’annonce 👍</p>'}
            ${g.advice ? `<p class="text-sm text-slate-600 mt-3">💡 ${esc(g.advice)}</p>` : ''}
            <p class="text-[11px] text-slate-400 mt-2">Analyse indicative par IA. Durées et financements à vérifier auprès de l'organisme ou de votre conseiller. Votre solde CPF : <a href="https://www.moncompteformation.gouv.fr" target="_blank" rel="noopener" class="underline">moncompteformation.gouv.fr</a></p>
        </div>`;
}

async function loadCommuteDetail(j) {
    const box = document.getElementById('job-commute');
    if (!box || !currentUser || !authToken) return;
    const dest = j.exact || (isFinite(parseFloat(j.lat)) ? { lat: j.lat, lng: j.lng } : null);
    if (!dest) return;
    if (!currentUser.city) {
        box.innerHTML = `<p class="mt-4 text-sm text-slate-500">🏠 <a href="#" onclick="closeJobModal(); accessProfileView('info'); setTimeout(() => focusField('prof-city'), 300); return false;" class="font-bold text-emerald-600 underline">Indiquez votre ville</a> pour voir le temps de trajet jusqu'à cette offre.</p>`;
        return;
    }
    const key = dest.lat + ',' + dest.lng;
    if (!j.commuteDetail || j.commuteDetail.key !== key) {
        box.innerHTML = '<div class="mt-4 skeleton h-12 w-full rounded-2xl"></div>';
        const d = await api('/api/commute/detail', { json: { lat: dest.lat, lng: dest.lng } }).catch(() => null);
        if (!d || !d.success) { box.innerHTML = ''; return; }
        j.commuteDetail = { key, ...d };
        if (d.car) j.commute = { carMin: d.car.min, km: d.car.km };
    }
    if (openJobId !== j.id) return;
    const d = j.commuteDetail;
    const fmt = (m) => m >= 60 ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}` : `${m} min`;
    const item = (icon, label, v) => v ? `<div class="rounded-xl bg-slate-50 px-3 py-2 text-center"><p class="text-lg">${icon}</p><p class="font-extrabold text-slate-900 text-sm">${fmt(v.min)}</p><p class="text-[11px] text-slate-500">${label} · ${v.km} km</p></div>` : '';
    const transit = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(d.home.label)}&destination=${dest.lat},${dest.lng}&travelmode=transit`;
    box.innerHTML = `
        <div class="mt-4 rounded-2xl border border-slate-200 p-4">
            <p class="font-bold text-slate-900 text-sm mb-1">🏠 Trajet depuis chez vous</p>
            <p class="text-[11px] text-slate-400 mb-3">Départ : ${esc(d.home.label)}${d.home.precise ? '' : ' (centre-ville : ajoutez votre adresse au profil pour plus de précision)'}${j.exact ? '' : ' · arrivée approximative (centre de la ville de l\'offre)'}</p>
            <div class="grid grid-cols-3 gap-2">
                ${item('🚗', 'voiture', d.car)}${item('🚲', 'vélo', d.bike)}${item('🚶', 'à pied', d.walk)}
                <a href="${transit}" target="_blank" rel="noopener" class="rounded-xl bg-sky-50 hover:bg-sky-100 px-3 py-2 text-center"><p class="text-lg">🚌</p><p class="font-bold text-sky-800 text-sm">Transports</p><p class="text-[11px] text-sky-700">horaires réels ↗</p></a>
            </div>
            <p class="text-[11px] text-slate-400 mt-2">Voiture hors embouteillages. Calcul : OpenStreetMap (OSRM).</p>
        </div>`;
}

// ---------- Vérificateur ATS ----------
async function runAtsCheck(id) {
    if (!requireLogin()) return;
    const j = id ? jobsById.get(id) : null;
    const box = document.getElementById(id ? 'ats-box' : 'ats-gen-box');
    const targetJob = j ? j.title : document.getElementById('ai-target-job').value.trim();
    if (!targetJob) { document.getElementById('ai-target-job').focus(); return showNotification('Indiquez d’abord le poste visé.', 'error'); }
    box.innerHTML = '<div class="rounded-2xl border border-slate-200 p-4 space-y-2"><div class="skeleton h-3 w-2/3"></div><div class="skeleton h-3 w-full"></div><p class="text-xs text-slate-400">Analyse de votre CV comme le ferait un ATS…</p></div>';
    const body = { targetJob };
    if (j) body.offer = { title: j.title, fullDescription: (j.fullDescription || j.description || '').slice(0, 3000) };
    const d = await api('/api/ai/ats-check', { json: body });
    if (id && openJobId !== id) return;
    if (!d.success) { box.innerHTML = ''; return showNotification(d.message || 'Analyse impossible.', 'error'); }
    const a = d.ats;
    const color = a.score >= 70 ? '#10b981' : a.score >= 45 ? '#f59e0b' : '#f43f5e';
    box.innerHTML = `
        <div class="rounded-2xl border border-slate-200 p-4 text-left">
            <div class="flex items-center gap-3 mb-3">
                <div class="w-14 h-14 shrink-0 rounded-full grid place-items-center" style="background: conic-gradient(${color} ${a.score * 3.6}deg, #e2e8f0 0)"><div class="w-10 h-10 rounded-full bg-white grid place-items-center text-xs font-extrabold text-slate-900">${a.score}</div></div>
                <div><p class="font-bold text-slate-900 text-sm">Score ATS : ${a.score >= 70 ? 'bien parti' : a.score >= 45 ? 'à renforcer' : 'risque d’être écarté'}</p><p class="text-[11px] text-slate-500">Analyse ${a.source === 'pdf' ? 'du CV PDF envoyé dans votre profil' : 'de votre profil JobFacile (envoyez votre CV PDF pour un test exact)'}</p></div>
            </div>
            <p class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Mots-clés attendus</p>
            <div class="flex flex-wrap gap-1.5 mb-3">${a.keywords.map(k => `<span class="text-xs font-semibold px-2 py-0.5 rounded-full ${k.found ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}">${k.found ? '✓' : '✗'} ${esc(k.word)}</span>`).join('')}</div>
            <p class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Lisibilité</p>
            <ul class="space-y-1 text-xs mb-3">${a.checks.map(c => `<li class="${c.ok ? 'text-slate-600' : 'text-rose-700 font-semibold'}">${c.ok ? '✓' : '✗'} ${esc(c.label)}</li>`).join('')}</ul>
            ${a.tips.length ? `<ul class="space-y-1 text-xs text-slate-700 bg-sky-50 rounded-xl p-3">${a.tips.map(t => `<li>💡 ${esc(t)}</li>`).join('')}</ul>` : ''}
            <p class="text-[11px] text-slate-400 mt-2">N'ajoutez que des mots-clés qui correspondent vraiment à votre expérience.</p>
        </div>`;
}

// ---------- Salaire : comparaison avec le marché local ----------
// "1 800 € – 2 100 € / mois" → brut mensuel (même règle que le serveur)
function monthlyFromText(str) {
    const t = String(str || '').replace(/[\u202f\u00a0]/g, ' ');
    const nums = (t.match(/\d[\d ]*(?:[.,]\d+)?/g) || []).map(n => parseFloat(n.replace(/ /g, '').replace(',', '.'))).filter(n => n > 0);
    if (!nums.length) return null;
    const avg = nums.length > 1 ? (nums[0] + nums[1]) / 2 : nums[0];
    let v = avg;
    if (/\ban\b|annuel|year/i.test(t) || v > 10000) v /= 12;
    else if (/heure|horaire|\/ ?h\b/i.test(t) || v < 100) v *= 151.67;
    else if (/jour/i.test(t) || v < 1000) v *= 21;
    return v >= 500 && v <= 30000 ? Math.round(v) : null;
}
const salaryCache = new Map();
async function loadSalaryInsight(j) {
    const box = document.getElementById('job-salary');
    if (!box) return;
    const key = j.title + '|' + j.location;
    if (!salaryCache.has(key)) {
        salaryCache.set(key, api('/api/salary?' + new URLSearchParams({ keyword: j.title, location: j.location })).catch(() => null));
    }
    const d = await salaryCache.get(key);
    if (openJobId !== j.id || !d || !d.success || !d.enough) return;
    const eur = (v) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(v) + ' €';
    const offer = monthlyFromText(j.salary);
    const lo = Math.min(d.p25, offer || d.p25) * 0.9, hi = Math.max(d.p75, offer || d.p75) * 1.1;
    const pos = (v) => Math.max(0, Math.min(100, (v - lo) / (hi - lo) * 100));
    let verdict = '';
    if (offer) {
        const diff = Math.round((offer - d.median) / d.median * 100);
        verdict = Math.abs(diff) < 5 ? '<span class="text-slate-700">≈ dans la moyenne du marché</span>'
            : diff > 0 ? `<span class="text-emerald-700">+${diff} % au-dessus du marché</span>` : `<span class="text-rose-600">${diff} % en dessous du marché</span>`;
    }
    box.innerHTML = `
        <div class="mt-4 rounded-2xl border border-slate-200 p-4">
            <div class="flex flex-wrap items-baseline justify-between gap-2 mb-3">
                <p class="font-bold text-slate-900 text-sm">💶 ${offer ? 'Ce salaire face au marché' : 'Salaire estimé pour ce poste'}</p>
                ${offer ? `<p class="text-sm font-bold">${verdict}</p>` : `<p class="text-sm font-extrabold text-slate-900">${eur(d.p25)} – ${eur(d.p75)} <span class="font-normal text-xs text-slate-500">brut / mois</span></p>`}
            </div>
            <div class="relative h-2.5 rounded-full bg-slate-100 mx-1">
                <div class="absolute h-full rounded-full bg-emerald-200" style="left:${pos(d.p25)}%; width:${pos(d.p75) - pos(d.p25)}%"></div>
                <div class="absolute -top-1 w-0.5 h-4 bg-emerald-700" style="left:${pos(d.median)}%" title="Médiane"></div>
                ${offer ? `<div class="absolute -top-1.5 w-3.5 h-3.5 -ml-1.5 rounded-full bg-amber-500 border-2 border-white shadow" style="left:${pos(offer)}%" title="Cette offre"></div>` : ''}
            </div>
            <div class="flex justify-between text-[11px] text-slate-500 mt-2">
                <span>25 % gagnent moins de ${eur(d.p25)}</span><span class="font-bold text-emerald-700">médiane ${eur(d.median)}</span><span>25 % plus de ${eur(d.p75)}</span>
            </div>
            ${offer ? `<p class="text-[11px] text-slate-500 mt-1">● Cette offre : environ ${eur(offer)} brut / mois</p>` : ''}
            <p class="text-[11px] text-slate-400 mt-2">D'après ${d.n} offres récentes « ${esc(d.what)} » ${d.scope === 'local' ? 'à moins de 30 km de ' + esc(d.where) : 'en France (trop peu d’offres locales)'}, ramenées en brut mensuel temps plein. Indicatif.</p>
        </div>`;
}

function renderJobAddress(j) {
    const box = document.getElementById('job-address');
    if (!box) return;
    box.innerHTML = j.exact ? `
        <div class="mt-4 rounded-2xl border border-slate-200 p-4 flex items-start gap-3">
            <span class="text-xl">📍</span>
            <div class="min-w-0 flex-1">
                <p class="font-bold text-slate-900 text-sm">${esc(j.exact.name || j.company)}</p>
                <p class="text-sm text-slate-600">${esc(j.exact.address)}</p>
                <p class="text-[11px] text-slate-400 mt-1">Établissement trouvé dans l'annuaire officiel des entreprises. Vérifiez le lieu de travail dans l'annonce.</p>
            </div>
            <a href="${directionsUrl(j.exact)}" target="_blank" rel="noopener" class="shrink-0 px-3 py-2 rounded-xl bg-emerald-50 text-emerald-700 text-xs font-bold hover:bg-emerald-100">Itinéraire ↗</a>
        </div>` : '';
}

function requirementsBlock(j) {
    const reqs = offerRequirements(j);
    if (!reqs.length) return '';
    const logged = currentUser && authToken;
    const missing = reqs.filter(r => !r.ok).length;
    return `
        <div class="mt-4 rounded-2xl border border-slate-200 p-4">
            <p class="font-bold text-slate-900 text-sm mb-2">🪪 Permis et habilitations cités dans l'annonce</p>
            <div class="flex flex-wrap gap-2">${reqs.map(r => logged
                ? `<span class="text-xs font-bold px-2.5 py-1 rounded-full ${r.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}">${r.ok ? '✓' : '✗'} ${esc(r.label)}</span>`
                : `<span class="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">${esc(r.label)}</span>`).join('')}</div>
            ${logged && missing ? `<p class="text-xs text-slate-500 mt-2">Vous l'avez déjà ? <a href="#" onclick="closeJobModal(); accessProfileView('info'); setTimeout(() => focusField('prof-licenses'), 300); return false;" class="font-bold text-emerald-600 underline">Ajoutez-le à votre profil</a>.</p>` : ''}
        </div>`;
}

function renderJobModalActions(j) {
    const fav = isFavorite(j.id);
    const app = appFor(j.id);
    const trackBtn = app
        ? `<select onchange="updateApplication(openJobId, { status: this.value })" class="field !py-2.5 text-sm font-semibold sm:w-44">${STATUSES.map(s => `<option value="${s.key}" ${s.key === app.status ? 'selected' : ''}>${s.icon} ${s.label}</option>`).join('')}</select>`
        : `<button onclick="addToTracker(openJobId, 'todo')" class="btn-ghost px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-700">📋 Suivre</button>`;
    document.getElementById('job-modal-actions').innerHTML = `
        ${j.localOffer ? (app && app.conversationId
            ? `<button data-c="${esc(app.conversationId)}" onclick="closeJobModal(true); openMessages(this.dataset.c)" class="btn-primary col-span-2 sm:flex-1 text-center px-4 py-2.5 rounded-xl text-sm font-bold">💬 Candidature envoyée · voir l’échange</button>`
            : `<button onclick="openApplyForm(openJobId)" class="btn-primary col-span-2 sm:flex-1 text-center px-4 py-2.5 rounded-xl text-sm font-bold">📨 Postuler via JobFacile</button>`) : ''}
        ${j.url ? `<a href="${esc(j.url)}" target="_blank" rel="noopener" onclick="showApplyPrompt()" class="btn-primary col-span-2 sm:flex-1 text-center px-4 py-2.5 rounded-xl text-sm font-bold">Voir et postuler ↗</a>` : ''}
        <button onclick="shareOffer(openJobId)" aria-label="Partager l'offre" title="Partager" class="btn-ghost px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-700">🔗 Partager</button>
        <button onclick="tailorCvToOffer(openJobId)" class="btn-ghost px-4 py-2.5 rounded-xl border border-emerald-200 bg-emerald-50 text-sm font-bold text-emerald-700" title="Adapter mon CV à cette offre">📄 Adapter mon CV</button>
        <button onclick="applyWithAI(openJobId)" class="btn-ghost px-4 py-2.5 rounded-xl border border-emerald-200 bg-emerald-50 text-sm font-bold text-emerald-700">✨ Lettre IA</button>
        <button onclick="toggleFavorite(openJobId)" class="btn-ghost px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-bold ${fav ? 'text-rose-600' : 'text-slate-700'} inline-flex items-center justify-center gap-2">${heartIcon(fav)} <span>${fav ? 'Favori' : 'Garder'}</span></button>
        <div class="col-span-2 sm:col-span-1">${trackBtn}</div>
    `;
}

function showApplyPrompt() {
    if (!currentUser || !authToken || !openJobId) return;
    const app = appFor(openJobId);
    if (app && app.status !== 'todo') return;
    setTimeout(() => {
        const box = document.getElementById('apply-prompt');
        if (!box) return;
        box.innerHTML = `
            <div class="bubble-in mb-5 rounded-2xl border border-sky-200 bg-sky-50 p-4 flex flex-wrap items-center gap-3 justify-between">
                <p class="text-sm font-semibold text-sky-800">📨 Vous avez postulé à cette offre ?</p>
                <button onclick="addToTracker(openJobId, 'applied')" class="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-sm font-bold">Oui, l'ajouter au suivi</button>
            </div>`;
    }, 800);
}

function closeJobModal(byUser = false) {
    const modal = document.getElementById('job-modal');
    if (modal.classList.contains('hidden')) return;
    modal.classList.add('hidden');
    openJobId = null;
    // Fermée par l'utilisateur : on revient en arrière ; sinon (navigation qui suit, lien ouvert directement) on remplace l'adresse
    if (byUser && history.state && history.state.modal) history.back();
    else if (location.pathname.startsWith('/offre/')) { history.replaceState({}, '', modalBaseUrl || '/offres'); modalBaseUrl = null; }
}

// Après une modification (favori, suivi) : rafraîchit tout ce qui est affiché
// ---------- Offres masquées / déjà vues ----------
let showHiddenJobs = false;
const seenLocal = new Set();
let seenQueue = [], seenTimer = null;
function hiddenIds() { return new Set(((currentUser && currentUser.hiddenJobs) || []).map(x => x.id)); }
function isSeen(id) { return seenLocal.has(id) || !!(currentUser && (currentUser.seenJobs || []).includes(id)); }
function markSeen(id) {
    if (!currentUser || !authToken || isSeen(id)) return;
    seenLocal.add(id);
    document.querySelectorAll(`article[data-id="${CSS.escape(id)}"]`).forEach(a => a.classList.add('job-seen'));
    seenQueue.push(id);
    clearTimeout(seenTimer);
    seenTimer = setTimeout(async () => {
        const ids = seenQueue; seenQueue = [];
        const d = await api('/api/user/job-flags', { json: { seen: ids } }).catch(() => null);
        if (d && d.success) currentUser = { ...currentUser, seenJobs: d.user.seenJobs };
    }, 2500);
}
async function hideJob(id, fromModal = false) {
    if (!requireLogin()) return;
    const j = jobsById.get(id) || {};
    const already = hiddenIds().has(id);
    const d = await api('/api/user/job-flags', { json: already ? { unhide: id } : { hide: { id, title: j.title, company: j.company } } });
    if (!d.success) return showNotification(d.message, 'error');
    setSession(d.user);
    if (fromModal) closeJobModal(true);
    if (already) { showNotification('Offre réaffichée'); fetchJobs(lastJobsPage); return; }
    const card = document.querySelector(`#jobs-container article[data-id="${CSS.escape(id)}"]`);
    if (card && !showHiddenJobs) card.remove();
    showUndo('Offre masquée. Vous ne la verrez plus.', () => hideJob(id));
}
function showUndo(text, undo) {
    showNotification(text);
    window._lastUndo = undo;
}

// ---------- Comparateur (3 offres maximum) ----------
let compareIds = [];
function toggleCompare(id) {
    if (compareIds.includes(id)) compareIds = compareIds.filter(x => x !== id);
    else {
        if (compareIds.length >= 3) return showNotification('3 offres maximum : retirez-en une pour en ajouter une autre.', 'error');
        compareIds.push(id);
    }
    updateCompareUI();
}
function clearCompare() { compareIds = []; updateCompareUI(); }
function updateCompareUI() {
    document.querySelectorAll('.cmp-btn').forEach(b => {
        const on = compareIds.includes(b.dataset.id);
        b.setAttribute('aria-pressed', on);
        b.className = 'cmp-btn px-2 py-1 rounded-lg text-xs font-bold ' + (on ? 'bg-emerald-600 text-white' : 'text-slate-500 hover:bg-slate-100');
        b.textContent = on ? '⇄ Comparée' : '⇄ Comparer';
    });
    const bar = document.getElementById('compare-bar');
    bar.classList.toggle('hidden', !compareIds.length);
    document.getElementById('compare-count').textContent = `${compareIds.length} offre${compareIds.length > 1 ? 's' : ''} sélectionnée${compareIds.length > 1 ? 's' : ''}`;
    document.getElementById('compare-open').disabled = compareIds.length < 2;
    document.getElementById('compare-open').classList.toggle('opacity-50', compareIds.length < 2);
}
function closeCompare() { document.getElementById('compare-modal').classList.add('hidden'); }
async function openCompare() {
    const jobs = compareIds.map(id => jobsById.get(id)).filter(Boolean);
    if (jobs.length < 2) return;
    await loadCommutes(jobs).catch(() => {});
    const logged = currentUser && authToken;
    const rows = [
        ['Entreprise', j => esc(j.company)],
        ['Contrat', j => esc(j.type || '—')],
        ['Lieu', j => esc(j.location)],
        ['Salaire', j => j.salary ? `<strong>${esc(j.salary)}</strong>` : '<span class="text-slate-400">Non indiqué</span>'],
        ['Durée / horaires', j => esc(j.duration || j.typeLabel || '—')],
        logged ? ['Trajet en voiture', j => j.commute ? `🚗 ${j.commute.carMin} min · ${j.commute.km} km` : '<span class="text-slate-400">—</span>'] : null,
        logged ? ['Compatibilité', j => { const m = computeMatch(j); return m && m.score !== null ? `⚡ ${m.score} %` : '—'; }] : null,
        ['Permis / habilitations', j => { const r = offerRequirements(j); return r.length ? r.map(x => `<span class="${logged ? (x.ok ? 'text-emerald-700' : 'text-rose-600') : ''}">${logged ? (x.ok ? '✓' : '✗') : '•'} ${esc(x.label)}</span>`).join('<br>') : '<span class="text-slate-400">Aucun cité</span>'; }],
        ['Publiée', j => esc(j.date || '—')],
        ['Source', j => esc(j.source || '—')]
    ].filter(Boolean);
    const best = (fn) => { const v = jobs.map(fn); const m = Math.min(...v.filter(x => x !== null)); return v.map(x => x !== null && x === m && v.filter(y => y === m).length === 1); };
    const fastest = best(j => j.commute ? j.commute.carMin : null);
    document.getElementById('compare-body').innerHTML = `
        <table class="w-full text-sm border-separate border-spacing-0 min-w-[560px]">
            <thead><tr><th class="w-36"></th>${jobs.map(j => `<th class="text-left align-top p-3 border-b border-slate-200"><p class="font-extrabold text-slate-900 leading-snug">${esc(j.title)}</p><button data-id="${esc(j.id)}" onclick="closeCompare(); openJobModal(this.dataset.id)" class="mt-1 text-xs font-bold text-emerald-600 underline">Voir l'offre</button></th>`).join('')}</tr></thead>
            <tbody>${rows.map(([label, fn]) => `<tr><th class="text-left align-top p-3 border-b border-slate-100 text-xs font-bold text-slate-500 uppercase tracking-wider">${label}</th>${jobs.map((j, i) => `<td class="align-top p-3 border-b border-slate-100 text-slate-700 ${label === 'Trajet en voiture' && fastest[i] ? 'bg-emerald-50' : ''}">${fn(j)}</td>`).join('')}</tr>`).join('')}</tbody>
        </table>
        <p class="text-xs text-slate-400 mt-3">Les salaires sont ceux indiqués dans les annonces (brut, période variable selon l'offre).</p>`;
    document.getElementById('compare-modal').classList.remove('hidden');
}

// ---------- Offres près de ma position ----------
function searchNearMe() {
    if (!navigator.geolocation) return showNotification('Votre navigateur ne permet pas la géolocalisation.', 'error');
    const btn = document.getElementById('geo-btn');
    btn.textContent = '⏳';
    navigator.geolocation.getCurrentPosition(async (pos) => {
        try {
            const { latitude, longitude } = pos.coords;
            const r = await fetch(`https://api-adresse.data.gouv.fr/reverse/?lon=${longitude}&lat=${latitude}&type=municipality&limit=1`);
            const f = ((await r.json()).features || [])[0];
            if (!f) throw new Error('lieu');
            document.getElementById('location').value = f.properties.city || f.properties.name;
            document.getElementById('radius-select').value = '10';
            showNotification(`📍 Offres autour de ${f.properties.city || f.properties.name}`);
            fetchJobs(1);
        } catch (e) { showNotification('Impossible de trouver votre commune. Saisissez-la à la main.', 'error'); }
        finally { btn.textContent = '📍'; }
    }, (err) => {
        btn.textContent = '📍';
        showNotification(err.code === 1 ? 'Localisation refusée : autorisez-la dans votre navigateur, ou saisissez votre ville.' : 'Position introuvable pour le moment.', 'error');
    }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 });
}

function refreshJobViews() {
    updateFavButtons();
    if (openJobId && jobsById.has(openJobId)) {
        const scroll = document.getElementById('job-modal-body').scrollTop;
        openJobModal(openJobId);
        document.getElementById('job-modal-body').scrollTop = scroll;
    }
    if (!document.getElementById('view-tracker').classList.contains('hidden')) renderTracker();
}

async function toggleFavorite(id) {
    if (!requireLogin()) return;
    const job = jobsById.get(id) || favorites().find(f => f.id === id);
    if (!job) return;
    const data = await api('/api/user/favorites/toggle', { json: { job } });
    if (!data.success) return showNotification(data.message, 'error');
    setSession(data.user);
    showNotification(data.isFavorite ? 'Offre ajoutée à vos favoris ❤️' : 'Offre retirée des favoris');
    refreshJobViews();
}

async function addToTracker(id, status = 'todo') {
    if (!requireLogin()) return;
    const job = jobsById.get(id);
    if (!job) return;
    const data = await api('/api/user/applications', { json: { job, status } });
    if (!data.success) return showNotification(data.message, 'error');
    setSession(data.user);
    showNotification(`Ajoutée à votre suivi : ${statusOf(status).label}`);
    refreshJobViews();
}

async function updateApplication(id, patch) {
    if (!requireLogin()) return;
    const data = await api('/api/user/applications', { json: { id, ...patch } });
    if (!data.success) return showNotification(data.message, 'error');
    setSession(data.user);
    if (patch.status) showNotification(`Statut mis à jour : ${statusOf(patch.status).label}`);
    else if (patch.remove) showNotification('Candidature retirée du suivi');
    else if (patch.notes !== undefined) showNotification('Notes enregistrées');
    refreshJobViews();
}

// ---------- E-mail de relance / remerciement par IA ----------
let fuAppId = null, fuKind = 'relance';
async function openFollowUp(id, kind, regenerate = false) {
    if (!requireLogin()) return;
    const a = appFor(id);
    if (!a) return;
    fuAppId = id; fuKind = kind;
    document.getElementById('fu-title').textContent = kind === 'thanks' ? '✉️ E-mail de remerciement' : '✉️ E-mail de relance';
    document.getElementById('fu-sub').textContent = `${(a.job || {}).title || ''} · ${(a.job || {}).company || ''}`;
    document.getElementById('fu-loading').classList.remove('hidden');
    document.getElementById('fu-result').classList.add('hidden');
    document.getElementById('fu-modal').classList.remove('hidden');
    const data = await api('/api/ai/follow-up', { json: { id, kind } });
    if (fuAppId !== id) return;
    if (!data.success) { closeFollowUp(); return showNotification(data.message || 'Rédaction impossible.', 'error'); }
    document.getElementById('fu-subject').value = data.subject;
    document.getElementById('fu-body').value = data.body;
    // Une adresse e-mail notée dans la candidature sert de destinataire
    if (!regenerate) document.getElementById('fu-to').value = (String(a.notes || '').match(/[^\s@<>(),;:]+@[^\s@<>(),;:]+\.[a-z]{2,}/i) || [''])[0];
    document.getElementById('fu-loading').classList.add('hidden');
    document.getElementById('fu-result').classList.remove('hidden');
}
function closeFollowUp() { document.getElementById('fu-modal').classList.add('hidden'); fuAppId = null; }
async function copyFollowUp() {
    const text = `Objet : ${document.getElementById('fu-subject').value}\n\n${document.getElementById('fu-body').value}`;
    try { await navigator.clipboard.writeText(text); showNotification('E-mail copié !'); }
    catch (e) { showNotification('Copie impossible : sélectionnez le texte à la main.', 'error'); }
}
function mailFollowUp() {
    const to = document.getElementById('fu-to').value.trim();
    location.href = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(document.getElementById('fu-subject').value)}&body=${encodeURIComponent(document.getElementById('fu-body').value)}`;
}
async function markFollowedUp() {
    const id = fuAppId;
    if (!id) return;
    closeFollowUp();
    const data = await api('/api/user/applications', { json: { id, followedUp: true } });
    if (!data.success) return showNotification(data.message, 'error');
    setSession(data.user);
    showNotification('Relance notée dans votre suivi ✓');
    refreshJobViews();
}

// ---------- Lettre IA ciblée sur une offre ----------
function applyWithAI(id) {
    if (!requireLogin()) return;
    const j = jobsById.get(id);
    if (!j) return;
    targetOffer = j;
    closeJobModal();
    pickDocType('lm');
    document.getElementById('ai-target-job').value = j.title;
    document.getElementById('ai-offer-chip-text').innerText = `${j.title} — ${j.company}`;
    document.getElementById('ai-offer-chip').classList.remove('hidden');
    switchView('ai-generator');
    generateAIDocument();
}
// CV adapté à une offre : accroche, compétences et missions remises dans l'ordre de l'annonce
function tailorCvToOffer(id) {
    if (!requireLogin()) return;
    const j = jobsById.get(id);
    if (!j) return;
    targetOffer = j;
    closeJobModal();
    pickDocType('cv');
    pickCvTemplate(cvTemplate);
    document.getElementById('ai-target-job').value = j.title;
    document.getElementById('ai-offer-chip-text').innerText = `${j.title} — ${j.company}`;
    document.getElementById('ai-offer-chip').classList.remove('hidden');
    switchView('ai-generator');
    generateAIDocument();
}
function clearTargetOffer() {
    targetOffer = null;
    document.getElementById('ai-offer-chip').classList.add('hidden');
}
