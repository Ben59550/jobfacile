// JobFacile · Recherche d’offres : appel au serveur, tri, filtres et affichage des résultats.
// Script classique (pas un module) : les fonctions sont globales et appelées depuis les attributs onclick de index.html.
// Ordre de chargement : app-core → interview → job-detail → tracker → account → navigation → ui → search.

// ---------- Offres ----------
const LOGO_COLORS = ['from-emerald-500 to-teal-500', 'from-sky-500 to-indigo-500', 'from-amber-500 to-orange-500', 'from-rose-500 to-pink-500', 'from-violet-500 to-fuchsia-500'];
function colorFor(s) { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return LOGO_COLORS[h % LOGO_COLORS.length]; }
function domainIcon(j) {
    const t = (j.title + ' ' + j.domain).toLowerCase();
    const rules = [
        [/développ|informati|logiciel|web|data|réseau|système/, '💻'], [/market|communic|commercial|vente|vendeu/, '📣'],
        [/bâtiment|btp|maçon|électric|plomb|chantier|construct/, '🏗️'], [/compta|financ|gestion|paie|banque|assur/, '📊'],
        [/santé|soin|infirm|médic|hôpital|aide-soign/, '🩺'], [/cuisin|restaur|serveu|hôtel/, '🍽️'],
        [/transport|logisti|chauffeu|cariste|livr|magasin/, '🚚'], [/enseign|formation|professeur|animat/, '🎓'],
        [/nettoy|propreté|entretien/, '🧹'], [/agricol|jardin|paysag/, '🌱'], [/industri|product|usine|mécani|soud/, '🏭'],
        [/secrét|assistant|administratif|accueil/, '🗂️']
    ];
    for (const [re, icon] of rules) if (re.test(t)) return icon;
    return '💼';
}

let citySuggestTimer = null;
function suggestCities(value) {
    clearTimeout(citySuggestTimer);
    const q = value.trim();
    if (q.length < 2 || /^\d{1,3}$/.test(q)) return;
    citySuggestTimer = setTimeout(async () => {
        const list = await api('/api/cities?q=' + encodeURIComponent(q));
        if (!Array.isArray(list)) return;
        document.getElementById('city-suggestions').innerHTML = list
            .map(c => `<option value="${esc(c.name)}">${esc(c.postalCode || c.dept || '')}</option>`).join('');
    }, 220);
}

function jobsSkeleton() {
    return Array.from({ length: 4 }).map(() => `
        <div class="card p-5"><div class="flex gap-4"><div class="skeleton w-12 h-12 rounded-xl"></div><div class="flex-1 space-y-2"><div class="skeleton h-4 w-2/3"></div><div class="skeleton h-3 w-1/2"></div></div></div><div class="skeleton h-3 w-full mt-5"></div><div class="skeleton h-3 w-4/5 mt-2"></div></div>
    `).join('');
}

// Temps de trajet en voiture depuis le domicile (une requête pour toute la page)
let commuteHome = null;
async function loadCommutes(jobs) {
    if (!currentUser || !authToken || !currentUser.city) return;
    const points = jobs.filter(j => !j.commute && isFinite(parseFloat(j.lat)) && isFinite(parseFloat(j.lng))).map(j => ({ id: j.id, lat: j.lat, lng: j.lng }));
    if (!points.length) return;
    const data = await api('/api/commute', { json: { points } }).catch(() => null);
    if (!data || !data.results) return;
    commuteHome = data.home || commuteHome;
    jobs.forEach(j => { if (data.results[j.id]) j.commute = data.results[j.id]; });
}
function commuteChip(j) {
    const c = j.commute;
    if (!c) return '';
    const cls = c.carMin <= 20 ? 'bg-emerald-50 text-emerald-700' : c.carMin <= 40 ? 'bg-slate-100 text-slate-600' : 'bg-rose-50 text-rose-700';
    return `<span class="text-xs font-semibold px-2.5 py-1 rounded-full ${cls}" title="Depuis votre domicile, en voiture, hors embouteillages">🚗 ${c.carMin} min</span>`;
}

// Conseils et aides selon la situation choisie
const AUDIENCES = {
    rqth: {
        title: '♿ Travailleurs handicapés (RQTH)',
        filter: 'Offres ouvertes aux travailleurs handicapés',
        tips: [
            'Cap emploi accompagne gratuitement les personnes handicapées dans leur recherche (demandez à votre conseiller France Travail).',
            'L’Agefiph finance des aides : aménagement du poste, formation, mobilité.',
            'Vous n’êtes pas obligé de mentionner votre handicap. Si vous le faites, l’employeur peut obtenir des aides pour aménager votre poste.',
            'Les entreprises de plus de 20 salariés doivent employer au moins 6 % de travailleurs handicapés : votre RQTH est un atout.'
        ],
        links: [['Agefiph', 'https://www.agefiph.fr']]
    },
    debutant: {
        title: '🌱 Jeunes, sans diplôme ou sans expérience',
        filter: 'Offres « débutant accepté »',
        tips: [
            'Mettez en avant vos qualités (ponctualité, motivation), vos stages, jobs d’été, bénévolat ou projets personnels.',
            'L’alternance permet de se former en étant payé, souvent sans diplôme exigé à l’entrée.',
            'Moins de 26 ans : la Mission locale vous accompagne, et le Contrat d’engagement jeune peut apporter une allocation.',
            'Les agences d’intérim recrutent beaucoup de débutants, souvent avec une formation au poste.'
        ],
        links: [['1jeune1solution', 'https://www.1jeune1solution.gouv.fr']]
    },
    reconversion: {
        title: '🔄 Reconversion professionnelle',
        filter: 'Offres recrutant par simulation (sans CV ni diplôme exigé)',
        tips: [
            'La méthode de recrutement par simulation (MRS) évalue vos capacités par des exercices pratiques, pas votre parcours.',
            'Vos compétences transférables comptent : organisation, relation client, gestion d’équipe…',
            'Votre CPF peut financer une formation qualifiante. Vous pouvez aussi demander un bilan de compétences.',
            'Une immersion en entreprise (PMSMP, quelques jours) permet de tester un métier avant de vous lancer.'
        ],
        links: [['Mon Compte Formation', 'https://www.moncompteformation.gouv.fr']]
    },
    senior: {
        title: '🧓 Seniors (50 ans et plus)',
        filter: 'Offres qui mettent en avant l’expérience',
        tips: [
            'Votre expérience est un argument : chiffrez vos réussites et montrez votre transmission de savoir-faire.',
            'Le CV n’a pas à indiquer votre âge ni à détailler les expériences de plus de 15 ans.',
            'Montrez votre aisance avec les outils numériques et votre envie d’apprendre.',
            'La discrimination liée à l’âge est interdite : une annonce ne peut pas exclure un candidat à cause de son âge.'
        ],
        links: [['Défenseur des droits', 'https://www.defenseurdesdroits.fr']]
    }
};
function renderAudiencePanel(key, source) {
    const box = document.getElementById('audience-panel');
    const a = AUDIENCES[key];
    if (!a) { box.classList.add('hidden'); box.innerHTML = ''; return; }
    const exact = source === 'France Travail' && key !== 'senior';
    box.innerHTML = `
        <details class="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4" open>
            <summary class="font-bold text-slate-900 text-sm cursor-pointer">${a.title} · <span class="font-normal text-slate-600">${exact ? a.filter : 'offres dont l’annonce mentionne cette situation'}</span></summary>
            <ul class="mt-3 space-y-1.5 text-sm text-slate-700">${a.tips.map(t => `<li class="flex gap-2"><span class="text-emerald-600">✓</span><span>${esc(t)}</span></li>`).join('')}</ul>
            <p class="mt-3 text-xs">${a.links.map(([n, u]) => `<a href="${u}" target="_blank" rel="noopener" class="font-bold text-emerald-700 underline mr-3">${n} ↗</a>`).join('')}</p>
            ${exact ? '' : '<p class="mt-2 text-[11px] text-slate-500">La source actuelle ne propose pas de filtre officiel pour cette situation : JobFacile cherche les mots qui l’indiquent dans les annonces.</p>'}
        </details>`;
    box.classList.remove('hidden');
}

// Tri « compatibilité » : fait dans le navigateur, sur les offres de la page affichée
function sortJobsForDisplay(jobs) {
    const mode = document.getElementById('sort-select').value;
    if (!currentUser || !authToken || !['match', 'commute'].includes(mode)) return jobs;
    if (mode === 'commute') return [...jobs].sort((a, b) => ((a.commute || {}).carMin ?? 1e9) - ((b.commute || {}).carMin ?? 1e9));
    return [...jobs].sort((a, b) => ((computeMatch(b) || {}).score || 0) - ((computeMatch(a) || {}).score || 0));
}
function onSortChange() {
    const v = document.getElementById('sort-select').value;
    if (['match', 'commute'].includes(v) && (!currentUser || !authToken)) { showNotification('Connectez-vous pour utiliser ce tri.', 'error'); document.getElementById('sort-select').value = 'date'; return; }
    if (v === 'commute' && !currentUser.city) showNotification('Indiquez votre ville dans votre profil pour calculer les trajets.', 'error');
    if (v === 'match' && !(currentUser.skills || []).length) showNotification('Ajoutez des compétences à votre profil pour un tri par compatibilité utile.');
    fetchJobs(lastJobsPage || 1);
}

let jobsSeq = 0;
async function fetchJobs(page = 1) {
    const seq = ++jobsSeq; // seule la dernière recherche lancée s'affiche
    const params = new URLSearchParams({
        keyword: document.getElementById('keyword').value.trim(),
        location: document.getElementById('location').value.trim(),
        type: document.getElementById('type-select').value,
        radius: document.getElementById('radius-select').value,
        days: document.getElementById('days-select').value,
        time: document.getElementById('time-select').value,
        remote: document.getElementById('remote-check').checked ? '1' : '0',
        salary: document.getElementById('salary-select').value,
        audience: document.getElementById('audience-select').value,
        sort: document.getElementById('sort-select').value === 'relevance' ? 'relevance' : 'date',
        page, limit: jobsMode === 'map' ? 50 : 10
    });
    const container = document.getElementById('jobs-container');
    container.innerHTML = jobsSkeleton();
    const data = await api('/api/jobs?' + params.toString());
    if (seq !== jobsSeq) return;
    if (!data || !Array.isArray(data.jobs)) {
        container.innerHTML = '<p class="text-sm text-rose-600">Impossible de charger les offres.</p>';
        return;
    }
    const fmt = new Intl.NumberFormat('fr-FR').format(data.total);
    const around = data.locationLabel ? ` autour de <span class="text-slate-900">${esc(data.locationLabel)}</span>` : '';
    document.getElementById('jobs-count').innerHTML = data.approxTotal
        ? `Offres${around} · page ${data.page}`
        : `<span class="text-slate-900">${fmt}</span> offre${data.total > 1 ? 's' : ''} trouvée${data.total > 1 ? 's' : ''}${around}`;
    document.getElementById('jobs-demo-banner').classList.toggle('hidden', !data.demo);
    document.getElementById('jobs-demo-reason').innerText = data.demo ? `Les vraies offres ne sont pas encore disponibles : ${data.message || 'aucune source configurée.'}` : '';
    document.getElementById('jobs-source').classList.toggle('hidden', !!data.demo);
    document.getElementById('jobs-source-name').innerText = data.source || 'France Travail';
    if (!data.demo && data.message) showNotification(data.message, 'error');
    data.jobs.forEach(j => jobsById.set(j.id, j));
    renderAudiencePanel(params.get('audience'), data.source);
    await loadCommutes(data.jobs);
    if (seq !== jobsSeq) return;
    data.jobs = sortJobsForDisplay(data.jobs);
    if (data.duplicatesRemoved) document.getElementById('jobs-count').innerHTML += ` <span class="text-xs font-normal text-slate-400">· ${data.duplicatesRemoved} doublon${data.duplicatesRemoved > 1 ? 's' : ''} masqué${data.duplicatesRemoved > 1 ? 's' : ''}</span>`;
    lastJobsPage = data.page || page;
    lastJobsResult = data;
    renderAlertBanner();
    if (!routing && !location.pathname.startsWith('/offre/') && !document.getElementById('view-jobs').classList.contains('hidden')) setUrl(urlForView('jobs'), true);
    if (page === 1 && !data.demo) saveRecentSearch(params.get('keyword'), params.get('location'));
    if (jobsMode === 'map') renderMap(data.jobs);
    const hiddenSet = hiddenIds();
    const shown = showHiddenJobs ? data.jobs : data.jobs.filter(j => !hiddenSet.has(j.id));
    const nHidden = data.jobs.length - data.jobs.filter(j => !hiddenSet.has(j.id)).length;
    if (nHidden) document.getElementById('jobs-count').innerHTML += ` <button onclick="showHiddenJobs = !showHiddenJobs; fetchJobs(lastJobsPage)" class="text-xs font-semibold text-slate-400 hover:text-emerald-600 underline">· ${nHidden} masquée${nHidden > 1 ? 's' : ''} ${showHiddenJobs ? '(les cacher)' : '(afficher)'}</button>`;
    container.innerHTML = shown.length ? shown.map((j, i) => renderJobCard(j, i)).join('') : `
        <div class="md:col-span-2 card p-12 text-center">
            <p class="text-4xl mb-3">🔍</p>
            <p class="font-bold text-slate-900 mb-1">Aucune offre ne correspond</p>
            <p class="text-sm text-slate-500">Essayez un autre mot-clé ou élargissez la zone.</p>
        </div>`;

    const pag = document.getElementById('jobs-pagination');
    pag.innerHTML = data.totalPages > 1 ? `
        <button ${data.page <= 1 ? 'disabled' : ''} onclick="fetchJobs(${data.page - 1}); document.getElementById('view-jobs').scrollIntoView({behavior:'smooth'})" class="btn-ghost px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed">← Précédent</button>
        <span class="text-sm font-semibold text-slate-600 px-2">Page ${data.page}${data.approxTotal ? '' : ' / ' + data.totalPages}</span>
        <button ${data.page >= data.totalPages ? 'disabled' : ''} onclick="fetchJobs(${data.page + 1}); document.getElementById('view-jobs').scrollIntoView({behavior:'smooth'})" class="btn-ghost px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed">Suivant →</button>
    ` : '';
}
