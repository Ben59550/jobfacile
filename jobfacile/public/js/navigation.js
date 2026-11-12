// JobFacile · Navigation (adresses et bouton Retour), guide de démarrage, alertes e-mail, bilan d’entretien, notifications.
// Script classique (pas un module) : les fonctions sont globales et appelées depuis les attributs onclick de index.html.
// Ordre de chargement : app-core → interview → job-detail → tracker → account → navigation → ui → search.

// ---------- Navigation : vraies adresses et bouton Retour ----------
let routing = false;            // vrai pendant qu'on applique une adresse (ne pas réécrire l'historique)
let currentProfileTab = 'info';
let currentLegalTab = 'mentions';
let modalBaseUrl = null;        // adresse sous la fiche d'offre ouverte
let afterLoginUrl = null;       // page demandée avant connexion
const VIEW_PATHS = { rights: '/mes-droits', recruiter: '/recruteur', messages: '/messages', community: '/communaute', admin: '/moderation', home: '/', jobs: '/offres', 'ai-generator': '/generateur', 'ai-assistant': '/entretien', advice: '/conseils', about: '/a-propos', profile: '/profil', tracker: '/suivi' };
const VIEW_TITLES = { rights: 'Mes droits', recruiter: 'Espace recruteur', messages: 'Messages', community: 'Communauté', admin: 'Modération', home: "JobFacile - L'emploi au kilomètre près", jobs: "Offres d'emploi", 'ai-generator': 'CV & lettre par IA', 'ai-assistant': "Simulateur d'entretien", advice: 'Conseils', about: 'À propos', profile: 'Mon profil', tracker: 'Mon suivi', legal: 'Informations légales' };
const PROFILE_TABS = { info: '', cv: 'parcours', security: 'securite' };
const TRACKER_TABS = { apps: '', favs: 'favoris', agenda: 'agenda', alerts: 'alertes', progress: 'progression' };

function jobsQuery() {
    const p = new URLSearchParams();
    const v = (id) => document.getElementById(id).value.trim();
    if (v('keyword')) p.set('q', v('keyword'));
    if (v('location')) p.set('lieu', v('location'));
    if (v('radius-select') !== '20') p.set('rayon', v('radius-select'));
    if (v('type-select') !== 'all') p.set('contrat', v('type-select'));
    if (v('days-select') !== '0') p.set('date', v('days-select'));
    if (v('time-select') !== 'all') p.set('horaire', v('time-select'));
    if (document.getElementById('remote-check').checked) p.set('teletravail', '1');
    if (v('salary-select') !== '0') p.set('salaire', v('salary-select'));
    if (v('audience-select')) p.set('public', v('audience-select'));
    if (v('sort-select') !== 'date') p.set('tri', v('sort-select'));
    if (typeof jobsMode !== 'undefined' && jobsMode === 'map') p.set('vue', 'carte');
    if (lastJobsPage > 1) p.set('page', lastJobsPage);
    const s = p.toString();
    return s ? '?' + s : '';
}
let lastJobsPage = 1;

function urlForView(view) {
    if (view === 'jobs') return '/offres' + jobsQuery();
    if (view === 'profile') return '/profil' + (PROFILE_TABS[currentProfileTab] ? '?onglet=' + PROFILE_TABS[currentProfileTab] : '');
    if (view === 'tracker') return '/suivi' + (TRACKER_TABS[currentTrackerTab] ? '?onglet=' + TRACKER_TABS[currentTrackerTab] : '');
    if (view === 'legal') return currentLegalTab === 'privacy' ? '/confidentialite' : '/mentions-legales';
    return VIEW_PATHS[view] || '/';
}
function setUrl(url, replace = false) {
    if (location.pathname + location.search === url) return;
    try { history[replace ? 'replaceState' : 'pushState']({}, '', url); } catch (e) {}
}
function currentView() {
    const el = document.querySelector('[id^="view-"]:not(.hidden)');
    return el ? el.id.replace('view-', '') : 'home';
}

// Applique l'adresse actuelle (chargement de la page, bouton Retour/Suivant, lien partagé)
async function route(initial = false) {
    const path = decodeURIComponent(location.pathname.replace(/\/+$/, '')) || '/';
    const p = new URLSearchParams(location.search);
    routing = true;
    try {
        // Fiche d'offre partagée : /offre/<id>
        if (path.startsWith('/offre/')) {
            const id = path.slice('/offre/'.length);
            if (initial || currentView() === 'home') { switchView('jobs'); if (!document.querySelector('#jobs-container article')) fetchJobs(1); }
            let job = jobsById.get(id);
            if (!job) {
                const d = await api('/api/jobs/offer/' + encodeURIComponent(id));
                if (d.success) { job = d.job; jobsById.set(id, job); }
            }
            if (job) { modalBaseUrl = modalBaseUrl || '/offres'; openJobModal(id); }
            else { showNotification('Cette offre n’est plus disponible : voici des offres similaires.', 'error'); history.replaceState({}, '', '/offres'); }
            return;
        }
        if (!document.getElementById('job-modal').classList.contains('hidden')) { document.getElementById('job-modal').classList.add('hidden'); openJobId = null; }

        const needLogin = (view) => {
            if (currentUser && authToken) return false;
            afterLoginUrl = location.pathname + location.search;
            history.replaceState({}, '', '/');
            switchView('home');
            openAuthModal('login');
            return true;
        };
        switch (path) {
            case '/offres': {
                const has = ['q', 'lieu', 'rayon', 'contrat', 'date', 'horaire', 'teletravail', 'salaire', 'tri', 'public'].some(k => p.has(k));
                document.getElementById('keyword').value = p.get('q') || '';
                document.getElementById('location').value = p.get('lieu') || '';
                document.getElementById('radius-select').value = ['5', '10', '20', '30', '50', '100'].includes(p.get('rayon')) ? p.get('rayon') : '20';
                document.getElementById('type-select').value = ['emploi', 'alternance'].includes(p.get('contrat')) ? p.get('contrat') : 'all';
                document.getElementById('days-select').value = ['1', '3', '7', '30'].includes(p.get('date')) ? p.get('date') : '0';
                document.getElementById('time-select').value = ['full', 'part'].includes(p.get('horaire')) ? p.get('horaire') : 'all';
                document.getElementById('remote-check').checked = p.get('teletravail') === '1';
                document.getElementById('audience-select').value = ['rqth', 'debutant', 'reconversion', 'senior'].includes(p.get('public')) ? p.get('public') : '';
                document.getElementById('salary-select').value = ['1500', '1800', '2000', '2500', '3000', '3500'].includes(p.get('salaire')) ? p.get('salaire') : '0';
                document.getElementById('sort-select').value = ['relevance', 'match', 'commute'].includes(p.get('tri')) ? p.get('tri') : 'date';
                setJobsMode(p.get('vue') === 'carte' ? 'map' : 'list', false);
                if (has) { switchView('jobs'); fetchJobs(Math.max(parseInt(p.get('page')) || 1, 1)); }
                else accessJobsView();
                break;
            }
            case '/profil': {
                if (needLogin()) break;
                const tab = Object.keys(PROFILE_TABS).find(k => PROFILE_TABS[k] === (p.get('onglet') || '')) || 'info';
                accessProfileView(tab);
                break;
            }
            case '/suivi': {
                if (needLogin()) break;
                accessTracker(Object.keys(TRACKER_TABS).find(k => TRACKER_TABS[k] === (p.get('onglet') || '')) || 'apps');
                break;
            }
            case '/mes-droits': openRights(); break;
            case '/recruteur': if (needLogin()) break; openRecruiter(); break;
            case '/messages': if (needLogin()) break; openMessages(p.get('c')); break;
            case '/moderation': if (needLogin()) break; openAdmin(); break;
            case '/communaute': openCommunity(p.get('sujet')); break;
            case '/mentions-legales': openLegal('mentions'); break;
            case '/confidentialite': openLegal('privacy'); break;
            default: {
                const view = Object.keys(VIEW_PATHS).find(k => VIEW_PATHS[k] === path);
                if (!view && path !== '/') history.replaceState({}, '', '/');
                switchView(view || 'home');
            }
        }
    } finally {
        routing = false;
    }
}

window.addEventListener('popstate', () => {
    // Retour depuis une fiche d'offre : on ferme simplement la fiche
    const modal = document.getElementById('job-modal');
    if (!modal.classList.contains('hidden') && modalBaseUrl && location.pathname + location.search === modalBaseUrl) {
        modal.classList.add('hidden'); openJobId = null; modalBaseUrl = null;
        return;
    }
    modalBaseUrl = null;
    closeAuthModal();
    route();
});

function resumeAfterLogin() {
    if (!afterLoginUrl) return;
    const url = afterLoginUrl; afterLoginUrl = null;
    history.pushState({}, '', url);
    route();
}

async function shareOffer(id) {
    const j = jobsById.get(id);
    const url = location.origin + '/offre/' + encodeURIComponent(id);
    const title = j ? `${j.title} – ${j.company}` : 'Offre JobFacile';
    // Le serveur garde l'offre 60 jours pour que le lien et son aperçu restent valables
    api('/api/jobs/share', { json: { job: { id } } }).catch(() => {});
    try {
        if (navigator.share) { await navigator.share({ title, text: title, url }); return; }
        await navigator.clipboard.writeText(url);
        showNotification('Lien de l’offre copié 🔗');
    } catch (e) {
        if (e && e.name === 'AbortError') return;
        prompt('Copiez le lien de l’offre :', url);
    }
}

// ---------- Guide après l'inscription ----------
let onbStep = 1;
let onbContracts = [];
let onbIdeas = [];
function maybeOnboarding() {
    if (!currentUser || currentUser.onboardingDone) return;
    if ((currentUser.skills || []).length || currentUser.desiredJob) return;
    let seen = null; try { seen = localStorage.getItem('jobfacile_onb_' + currentUser.id); } catch (e) {}
    if (!seen) setTimeout(openOnboarding, 600);
}
function openOnboarding() {
    if (!currentUser) return;
    store('jobfacile_onb_' + currentUser.id, '1');
    onbContracts = Array.isArray(currentUser.desiredContracts) ? [...currentUser.desiredContracts] : [];
    document.getElementById('onb-job').value = currentUser.desiredJob || '';
    document.getElementById('onb-city').value = currentUser.city || '';
    document.getElementById('onb-radius').value = String(currentUser.mobilityKm || 20);
    document.getElementById('onb-cv-result').innerHTML = '';
    document.getElementById('onb-name').textContent = currentUser.firstName || '';
    renderOnbContracts();
    showOnbStep(1);
    document.getElementById('onboarding-modal').classList.remove('hidden');
}
async function closeOnboarding() {
    document.getElementById('onboarding-modal').classList.add('hidden');
    if (currentUser && !currentUser.onboardingDone) {
        const d = await api('/api/user/update', { json: { onboardingDone: true } });
        if (d.success) setSession(d.user);
    }
}
function showOnbStep(n) {
    onbStep = n;
    [1, 2, 3].forEach(i => {
        document.getElementById('onb-step-' + i).classList.toggle('hidden', i !== n);
        const dot = document.getElementById('onb-dot-' + i);
        dot.className = 'h-2 rounded-full transition-all ' + (i === n ? 'w-8 bg-emerald-500' : i < n ? 'w-2 bg-emerald-300' : 'w-2 bg-slate-200');
    });
}
function renderOnbContracts() {
    document.getElementById('onb-contracts').innerHTML = ['CDI', 'CDD', 'Intérim', 'Alternance', 'Stage'].map(c => {
        const on = onbContracts.includes(c);
        return `<button type="button" data-c="${c}" onclick="onbToggleContract(this.dataset.c)" class="px-3 py-1.5 rounded-full text-xs font-bold border transition ${on ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-white border-slate-200 text-slate-600 hover:border-emerald-300'}">${on ? '✓ ' : ''}${c}</button>`;
    }).join('');
}
function onbToggleContract(c) { onbContracts = onbContracts.includes(c) ? onbContracts.filter(x => x !== c) : [...onbContracts, c]; renderOnbContracts(); }

async function onbUploadCV(input) {
    const f = input.files[0];
    input.value = '';
    if (!f) return;
    if (f.type !== 'application/pdf') return showNotification('Merci d’envoyer votre CV au format PDF.', 'error');
    const box = document.getElementById('onb-cv-result');
    const label = document.getElementById('onb-cv-label');
    label.classList.add('pointer-events-none', 'opacity-60');
    box.innerHTML = '<div class="mt-4 space-y-2"><div class="skeleton h-3 w-2/3"></div><div class="skeleton h-3 w-full"></div><p class="text-xs text-slate-500">L’IA lit votre CV… (10 à 30 secondes)</p></div>';
    const fd = new FormData(); fd.append('cvFile', f);
    const data = await api('/api/user/cv/analyze', { method: 'POST', body: fd });
    label.classList.remove('pointer-events-none', 'opacity-60');
    if (data.user) setSession(data.user);
    if (!data.success) { box.innerHTML = ''; return showNotification(data.message, 'error'); }
    const a = data.analysis;
    // Ajout direct au profil
    const key = (...p) => p.map(x => foldTxt(x).trim()).join('|');
    const skills = [...(currentUser.skills || [])], exps = [...(currentUser.experience || [])], edus = [...(currentUser.education || [])];
    const ks = new Set(skills.map(x => key(x))); a.skills.forEach(x => { if (!ks.has(key(x))) { skills.push(x); ks.add(key(x)); } });
    const ke = new Set(exps.map(x => key(x.title, x.company))); a.experience.forEach(x => { if (!ke.has(key(x.title, x.company))) { exps.push(x); ke.add(key(x.title, x.company)); } });
    const kd = new Set(edus.map(x => key(x.degree, x.school))); a.education.forEach(x => { if (!kd.has(key(x.degree, x.school))) { edus.push(x); kd.add(key(x.degree, x.school)); } });
    const save = new FormData();
    save.append('skills', JSON.stringify(skills)); save.append('experience', JSON.stringify(exps)); save.append('education', JSON.stringify(edus));
    const saved = await api('/api/user/update-profile-files', { method: 'POST', body: save });
    if (saved.success) setSession(saved.user);
    onbIdeas = a.jobIdeas || [];
    if (!document.getElementById('onb-job').value && onbIdeas[0]) document.getElementById('onb-job').value = onbIdeas[0];
    box.innerHTML = `
        <div class="mt-4 rounded-2xl bg-emerald-50 border border-emerald-200 p-4 view-enter">
            <p class="font-bold text-emerald-800 text-sm mb-1">✓ Profil rempli automatiquement</p>
            <p class="text-sm text-slate-600">${a.skills.length} compétences, ${a.experience.length} expériences et ${a.education.length} diplômes ajoutés. Note de votre CV : <strong>${a.score}/100</strong>.</p>
        </div>`;
    setTimeout(() => showOnbStep(2), 1600);
}

async function onbSave() {
    const desiredJob = document.getElementById('onb-job').value.trim();
    const city = document.getElementById('onb-city').value.trim();
    if (!desiredJob && !city) return showNotification('Indiquez au moins un métier ou une ville.', 'error');
    const mobilityKm = document.getElementById('onb-radius').value;
    await withBusy(document.getElementById('onb-save-btn'), async () => {
        const d = await api('/api/user/update', { json: { desiredJob, city, mobilityKm, desiredContracts: onbContracts, onboardingDone: true } });
        if (!d.success) return showNotification(d.message, 'error');
        setSession(d.user);
        if (document.getElementById('onb-alert').checked) {
            const type = onbContracts.length === 1 && onbContracts[0] === 'Alternance' ? 'alternance' : 'all';
            const al = await api('/api/user/alerts', { json: { action: 'create', keyword: desiredJob, location: city, radius: mobilityKm, type, frequency: 'daily' } });
            if (al.success) setSession(al.user);
        }
        document.getElementById('onb-summary').textContent = [desiredJob, city ? `autour de ${city} (${mobilityKm} km)` : ''].filter(Boolean).join(' ');
        showOnbStep(3);
    });
}
function onbFinish(target) {
    document.getElementById('onboarding-modal').classList.add('hidden');
    if (target === 'jobs') { document.getElementById('keyword').value = ''; document.getElementById('location').value = ''; accessJobsView(); }
    else if (target === 'profile') accessProfileView('info');
    else if (target === 'interview') switchView('ai-assistant');
}

// ---------- Alertes e-mail ----------
// Critères de la recherche affichée
let pendingAlert = null;    // alerte demandée avant connexion
let lastJobsResult = null;
function searchCriteria() {
    return {
        keyword: document.getElementById('keyword').value.trim(),
        location: document.getElementById('location').value.trim(),
        radius: parseInt(document.getElementById('radius-select').value) || 20,
        type: document.getElementById('type-select').value,
        remote: document.getElementById('remote-check').checked
    };
}
function findAlert(c) {
    const f = (s) => foldTxt(s).trim();
    return ((currentUser && currentUser.alerts) || []).find(a =>
        f(a.keyword) === f(c.keyword) && f(a.location) === f(c.location) && a.radius === c.radius && a.type === c.type && !!a.remote === !!c.remote);
}

// Encadré sous les résultats : « Recevoir ces offres par e-mail »
function renderAlertBanner() {
    const box = document.getElementById('alert-banner');
    const c = searchCriteria();
    if (!lastJobsResult || lastJobsResult.demo || (!c.keyword && !c.location)) { box.classList.add('hidden'); return; }
    const label = [c.keyword ? `« ${c.keyword} »` : 'toutes les offres', c.location ? `autour de ${c.location} (${c.radius} km)` : 'en France'].join(' ');
    const existing = findAlert(c);
    box.classList.remove('hidden');
    if (existing && existing.active !== false) {
        box.innerHTML = `
            <div class="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 flex flex-wrap items-center gap-3">
                <span class="text-xl">✅</span>
                <p class="flex-1 min-w-[200px] text-sm text-emerald-800"><strong>Alerte active</strong> : vous recevez par e-mail les nouvelles offres ${esc(label)} ${existing.frequency === 'weekly' ? 'chaque semaine' : 'chaque jour'}.</p>
                ${pushSupported() && Notification.permission === 'default' ? '<button onclick="enablePush()" class="px-3 py-1.5 rounded-full bg-white border border-emerald-200 text-xs font-bold text-emerald-700 hover:bg-emerald-100">📲 Aussi en notification</button>' : ''}
                <button onclick="accessTracker('alerts')" class="text-xs font-bold text-emerald-700 hover:underline">Gérer mes alertes →</button>
            </div>`;
        return;
    }
    box.innerHTML = `
        <div class="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4 shadow-sm">
            <span class="w-12 h-12 rounded-2xl btn-primary grid place-items-center text-2xl shrink-0">🔔</span>
            <div class="flex-1 min-w-0">
                <p class="font-bold text-slate-900">${existing ? 'Votre alerte est en pause' : 'Ne ratez plus aucune offre'}</p>
                <p class="text-sm text-slate-500">Recevez par e-mail les nouvelles offres ${esc(label)}, dès qu'elles sont publiées.</p>
            </div>
            <div class="flex items-center gap-2 shrink-0">
                <select id="alert-banner-freq" class="field !w-auto !py-2.5 !text-xs font-semibold" aria-label="Fréquence">
                    <option value="daily">Chaque jour</option>
                    <option value="weekly">Chaque semaine</option>
                </select>
                <button onclick="${existing ? `updateAlert('${esc(existing.id)}', { active: true })` : 'createAlertFromSearch()'}" id="alert-banner-btn" class="btn-primary px-5 py-2.5 rounded-xl text-sm font-bold whitespace-nowrap">${existing ? '▶ Réactiver' : '🔔 M’alerter par e-mail'}</button>
            </div>
        </div>`;
}

async function createAlertFromSearch() {
    const c = searchCriteria();
    const freqEl = document.getElementById('alert-banner-freq');
    const frequency = freqEl ? freqEl.value : 'daily';
    if (!currentUser || !authToken) {
        // On retient la demande : l'alerte sera créée juste après la connexion ou l'inscription
        pendingAlert = { ...c, frequency };
        showNotification('Connectez-vous ou créez un compte gratuit : votre alerte sera activée juste après.');
        openAuthModal('login');
        return;
    }
    await createAlert({ ...c, frequency });
}
async function createAlert(c) {
    const d = await api('/api/user/alerts', { json: { action: 'create', ...c } });
    if (!d.success) return showNotification(d.message, 'error');
    setSession(d.user);
    showNotification(d.message);
    renderAlertBanner();
    if (pushSupported() && Notification.permission === 'default') setTimeout(() => showNotification('Astuce : recevez-les aussi en notification sur cet appareil avec « 📲 Aussi en notification ».'), 1500);
}
function alertText(a) {
    return [a.keyword || 'Toutes les offres', a.location ? `autour de ${a.location} (${a.radius} km)` : 'dans toute la France',
        a.type === 'alternance' ? '· alternance' : a.type === 'emploi' ? '· emploi' : '', a.remote ? '· télétravail' : ''].filter(Boolean).join(' ');
}
function renderAlerts() {
    const box = document.getElementById('tracker-alerts');
    const alerts = (currentUser && currentUser.alerts) || [];
    const intro = `<div id="notif-settings"></div><p class="text-sm text-slate-500 mb-4">Recevez les nouvelles offres qui correspondent à vos recherches, par e-mail et/ou en notification (5 alertes maximum). Pour en créer une, faites une recherche puis cliquez sur « 🔔 M’alerter par e-mail » sous les résultats.</p>`;
    if (!alerts.length) {
        setTimeout(renderNotifSettings, 0);
        box.innerHTML = intro + `<div class="card p-12 text-center"><p class="text-5xl mb-4">🔔</p><p class="font-bold text-slate-900 text-lg mb-1">Aucune alerte</p><p class="text-sm text-slate-500 mb-6">Ne manquez plus aucune offre près de chez vous.</p><button onclick="accessJobsView()" class="btn-primary px-6 py-3 rounded-xl font-bold text-sm">Faire une recherche</button></div>`;
        return;
    }
    setTimeout(renderNotifSettings, 0);
    box.innerHTML = intro + `<div class="space-y-3">${alerts.map(a => `
        <div class="card p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-3 ${a.active === false ? 'opacity-60' : ''}">
            <span class="w-11 h-11 rounded-xl ${a.active === false ? 'bg-slate-100' : 'bg-emerald-100'} grid place-items-center text-xl shrink-0">${a.active === false ? '🔕' : '🔔'}</span>
            <div class="flex-1 min-w-0">
                <p class="font-bold text-slate-900 text-sm">${esc(alertText(a))}</p>
                <p class="text-xs text-slate-500 mt-0.5">${a.active === false ? 'En pause' : a.lastSentAt ? 'Dernier envoi : ' + new Date(a.lastSentAt).toLocaleDateString('fr-FR') : 'Aucun envoi pour l’instant'}</p>
            </div>
            <div class="flex flex-wrap items-center gap-2">
                <select data-id="${esc(a.id)}" onchange="updateAlert(this.dataset.id, { frequency: this.value })" class="field !w-auto !py-2 !text-xs font-semibold">
                    <option value="daily" ${a.frequency !== 'weekly' ? 'selected' : ''}>Chaque jour</option>
                    <option value="weekly" ${a.frequency === 'weekly' ? 'selected' : ''}>Chaque semaine</option>
                </select>
                <button data-id="${esc(a.id)}" onclick="updateAlert(this.dataset.id, { active: ${a.active === false} })" class="px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100">${a.active === false ? '▶ Réactiver' : '⏸ Pause'}</button>
                <button data-id="${esc(a.id)}" onclick="previewAlert(this.dataset.id, this)" class="px-3 py-2 rounded-xl border border-emerald-200 bg-emerald-50 text-xs font-bold text-emerald-700 hover:bg-emerald-100">📧 Aperçu</button>
                <button data-id="${esc(a.id)}" onclick="if(confirm('Supprimer cette alerte ?')) updateAlert(this.dataset.id, null)" aria-label="Supprimer" class="px-3 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-rose-600 hover:bg-rose-50">✕</button>
            </div>
        </div>`).join('')}</div>`;
}
async function updateAlert(id, patch) {
    const body = patch === null ? { action: 'delete', id } : { action: 'update', id, ...patch };
    const d = await api('/api/user/alerts', { json: body });
    if (!d.success) return showNotification(d.message, 'error');
    setSession(d.user); renderTracker(); showNotification(d.message);
}

async function previewAlert(id, btn) {
    await withBusy(btn, async () => {
        const d = await api('/api/user/alerts', { json: { action: 'preview', id } });
        if (d.user) setSession(d.user);
        showNotification(d.message, d.success ? 'success' : 'error');
        renderTracker();
    });
}

// ---------- Bilan de l'entretien simulé ----------
function chatTargetJob() { return document.getElementById('chat-target-job').value.trim(); }
function updateReportBar() {
    const answers = chatHistory.filter(m => m.role === 'user').length;
    document.getElementById('chat-report-bar').classList.toggle('hidden', answers < 2);
}
async function getInterviewReport() {
    if (!requireLogin()) return;
    const box = document.getElementById('chat-report');
    box.innerHTML = '<div class="card p-6 space-y-3"><div class="skeleton h-4 w-1/2"></div><div class="skeleton h-4 w-full"></div><div class="skeleton h-4 w-5/6"></div><p class="text-xs text-slate-500">Le coach analyse vos réponses…</p></div>';
    box.scrollIntoView({ behavior: 'smooth', block: 'start' });
    await withBusy(document.getElementById('chat-report-btn'), async () => {
        const d = await api('/api/ai/interview-report', { json: { messages: chatHistory, targetJob: chatTargetJob() } });
        if (!d.success) { box.innerHTML = ''; return showNotification(d.message, 'error'); }
        if (d.user) { setSession(d.user); renderInterviewProgress(); }
        const r = d.report;
        const color = r.score >= 75 ? '#10b981' : r.score >= 50 ? '#f59e0b' : '#f43f5e';
        const li = (arr, icon) => arr.map(x => `<li class="flex gap-2"><span>${icon}</span><span>${esc(x)}</span></li>`).join('');
        box.innerHTML = `
            <div class="card p-6 sm:p-8 view-enter">
                <div class="flex items-center gap-5 mb-6">
                    <div class="w-20 h-20 shrink-0 rounded-full grid place-items-center" style="background: conic-gradient(${color} ${r.score * 3.6}deg, #e2e8f0 0)">
                        <div class="w-16 h-16 rounded-full bg-white grid place-items-center"><span class="text-xl font-extrabold text-slate-900">${r.score}</span></div>
                    </div>
                    <div><p class="text-xs font-bold text-emerald-700 uppercase tracking-wider">🏁 Votre bilan</p><p class="text-lg font-extrabold text-slate-900 mt-1">${esc(r.verdict)}</p></div>
                </div>
                <div class="grid sm:grid-cols-2 gap-4 mb-6">
                    <div class="rounded-2xl border border-slate-200 p-4"><p class="font-bold text-slate-900 text-sm mb-2">💪 Points forts</p><ul class="space-y-1.5 text-sm text-slate-600">${li(r.strengths, '✓')}</ul></div>
                    <div class="rounded-2xl border border-slate-200 p-4"><p class="font-bold text-slate-900 text-sm mb-2">🎯 À travailler</p><ul class="space-y-1.5 text-sm text-slate-600">${li(r.improvements, '→')}</ul></div>
                </div>
                ${r.answers.length ? `<h3 class="font-bold text-slate-900 mb-3">💬 Comment mieux répondre</h3><div class="space-y-3 mb-6">${r.answers.map(x => `
                    <div class="rounded-2xl border border-slate-200 p-4">
                        <p class="text-sm font-bold text-slate-900">« ${esc(x.question)} »</p>
                        <p class="text-sm text-slate-500 mt-1">${esc(x.feedback)}</p>
                        <p class="text-sm text-emerald-800 bg-emerald-50 rounded-xl px-3 py-2 mt-2"><strong>Exemple :</strong> ${esc(x.better)}</p>
                    </div>`).join('')}</div>` : ''}
                ${r.nextSteps.length ? `<h3 class="font-bold text-slate-900 mb-2">📌 Avant votre vrai entretien</h3><ul class="space-y-1.5 text-sm text-slate-600 mb-6">${li(r.nextSteps, '•')}</ul>` : ''}
                <div class="flex flex-wrap gap-2">
                    <button onclick="resetChat(); document.getElementById('view-ai-assistant').scrollIntoView({behavior:'smooth'})" class="btn-primary px-5 py-3 rounded-xl text-sm font-bold">↺ Refaire un entretien</button>
                    <button onclick="window.print()" class="btn-ghost px-5 py-3 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-700">🖨️ Imprimer le bilan</button>
                </div>
            </div>`;
    });
}

// ---------- Notifications sur cet appareil (Web Push) ----------
function pushSupported() { return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window; }
function isIOS() { return /iphone|ipad|ipod/i.test(navigator.userAgent); }
function isInstalledApp() { return window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true; }
function b64ToU8(b64) {
    const pad = '='.repeat((4 - b64.length % 4) % 4);
    const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}
async function swReady() {
    if (!('serviceWorker' in navigator)) throw new Error('unsupported');
    if (!(await navigator.serviceWorker.getRegistration())) await navigator.serviceWorker.register('/sw.js');
    return Promise.race([navigator.serviceWorker.ready, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 5000))]);
}
async function currentPushSubscription() {
    if (!pushSupported()) return null;
    try { const reg = await swReady(); return await reg.pushManager.getSubscription(); } catch (e) { return null; }
}

async function enablePush() {
    if (!requireLogin()) return;
    if (!pushSupported()) {
        return showNotification(isIOS() && !isInstalledApp()
            ? 'Sur iPhone : ajoutez d’abord JobFacile à l’écran d’accueil (Partager → Sur l’écran d’accueil), puis activez les notifications depuis l’appli.'
            : 'Ce navigateur ne gère pas les notifications. Essayez Chrome, Edge ou Firefox.', 'error');
    }
    if (Notification.permission === 'denied') {
        return showNotification('Les notifications sont bloquées pour ce site. Autorisez-les dans les réglages du navigateur (icône 🔒 à gauche de l’adresse), puis réessayez.', 'error');
    }
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return showNotification('Notifications non autorisées.', 'error');
    try {
        const reg = await swReady();
        const k = await api('/api/push/key');
        if (!k.success) return showNotification(k.message, 'error');
        let sub = await reg.pushManager.getSubscription();
        if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToU8(k.publicKey) });
        const d = await api('/api/user/push/subscribe', { json: { subscription: sub.toJSON() } });
        if (!d.success) return showNotification(d.message, 'error');
        setSession(d.user);
        showNotification(d.message);
    } catch (e) {
        showNotification('Impossible d’activer les notifications sur ce navigateur (le site doit être en https ou sur localhost).', 'error');
    }
    renderNotifSettings();
}
async function disablePush() {
    const sub = await currentPushSubscription();
    if (sub) {
        const endpoint = sub.endpoint;
        await sub.unsubscribe().catch(() => {});
        const d = await api('/api/user/push/unsubscribe', { json: { endpoint } });
        if (d.user) setSession(d.user);
    }
    showNotification('Notifications désactivées sur cet appareil.');
    renderNotifSettings();
}
async function testPush(btn) {
    await withBusy(btn, async () => {
        const d = await api('/api/user/push/test', { method: 'POST' });
        showNotification(d.message, d.success ? 'success' : 'error');
    });
}
async function setTrackerEmails(on) {
    const d = await api('/api/user/update', { json: { trackerEmails: on } });
    if (!d.success) return showNotification(d.message, 'error');
    setSession(d.user);
    showNotification(on ? 'Rappels du suivi activés.' : 'Vous ne recevrez plus les rappels du suivi.');
    renderNotifSettings();
}
async function setAlertEmail(on) {
    const d = await api('/api/user/update', { json: { alertEmail: on } });
    if (!d.success) return showNotification(d.message, 'error');
    setSession(d.user);
    showNotification(on ? 'Alertes par e-mail activées.' : 'Vous ne recevrez plus les alertes par e-mail.');
    renderNotifSettings();
}

// Réglages « Comment recevoir vos alertes ? » (onglet Alertes de Mon suivi)
async function renderNotifSettings() {
    const box = document.getElementById('notif-settings');
    if (!box || !currentUser) return;
    const emailOn = currentUser.alertEmail !== false;
    let pushLine;
    if (!pushSupported()) {
        pushLine = `<p class="text-xs text-slate-500">${isIOS() && !isInstalledApp() ? 'Sur iPhone, ajoutez d’abord JobFacile à l’écran d’accueil (Partager → Sur l’écran d’accueil).' : 'Non disponible sur ce navigateur.'}</p>`;
    } else {
        const sub = await currentPushSubscription();
        if (sub && Notification.permission === 'granted') {
            pushLine = `<div class="flex flex-wrap gap-2"><span class="text-xs font-bold text-emerald-700 bg-emerald-50 rounded-full px-3 py-1.5">✓ Activées sur cet appareil</span>
                <button onclick="testPush(this)" class="px-3 py-1.5 rounded-full border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100">Envoyer un test</button>
                <button onclick="disablePush()" class="px-3 py-1.5 rounded-full text-xs font-bold text-slate-400 hover:text-rose-600">Désactiver</button></div>`;
        } else if (Notification.permission === 'denied') {
            pushLine = `<p class="text-xs text-rose-600">Bloquées par le navigateur : autorisez-les via l’icône 🔒 à gauche de l’adresse, puis rechargez la page.</p>`;
        } else {
            pushLine = `<button onclick="enablePush()" class="btn-primary px-4 py-2 rounded-xl text-xs font-bold">📲 Activer sur cet appareil</button>`;
        }
    }
    const others = Math.max(0, (currentUser.pushDevices || 0));
    const remindersOn = currentUser.trackerEmails !== false;
    box.innerHTML = `
        <div class="card p-5 mb-5">
            <div class="flex items-start justify-between gap-3 rounded-2xl bg-slate-50 p-4 mb-4">
                <div>
                    <p class="font-bold text-slate-900 text-sm">🗓️ Rappels de mon suivi par e-mail</p>
                    <p class="text-xs text-slate-500 mt-0.5">La veille d'un entretien noté dans votre agenda, et quand une candidature attend une relance depuis 7 jours. Un e-mail par jour au plus.</p>
                </div>
                <label class="relative inline-flex items-center cursor-pointer shrink-0">
                    <input type="checkbox" ${remindersOn ? 'checked' : ''} onchange="setTrackerEmails(this.checked)" class="sr-only peer" aria-label="Rappels de mon suivi par e-mail">
                    <span class="w-11 h-6 rounded-full bg-slate-300 peer-checked:bg-emerald-500 transition after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:w-5 after:h-5 after:rounded-full after:bg-white after:transition peer-checked:after:translate-x-5"></span>
                </label>
            </div>
            <p class="font-bold text-slate-900 mb-4">Comment recevoir vos alertes ?</p>
            <div class="grid sm:grid-cols-2 gap-3">
                <div class="rounded-2xl border border-slate-200 p-4">
                    <div class="flex items-center justify-between gap-3 mb-1">
                        <p class="font-bold text-slate-900 text-sm">📧 Par e-mail</p>
                        <label class="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" ${emailOn ? 'checked' : ''} onchange="setAlertEmail(this.checked)" class="sr-only peer">
                            <span class="w-11 h-6 rounded-full bg-slate-300 peer-checked:bg-emerald-500 transition after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:w-5 after:h-5 after:rounded-full after:bg-white after:transition peer-checked:after:translate-x-5"></span>
                        </label>
                    </div>
                    <p class="text-xs text-slate-500">À ${esc(currentUser.email)}</p>
                </div>
                <div class="rounded-2xl border border-slate-200 p-4">
                    <p class="font-bold text-slate-900 text-sm mb-1">🔔 Notifications</p>
                    <p class="text-xs text-slate-500 mb-3">Sur votre téléphone ou ordinateur, même site fermé.${others ? ` ${others} appareil${others > 1 ? 's' : ''} abonné${others > 1 ? 's' : ''}.` : ''}</p>
                    ${pushLine}
                </div>
            </div>
        </div>`;
}
