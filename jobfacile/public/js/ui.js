// JobFacile · Apparence et outils : mode sombre, thèmes de couleur, recherches récentes, carte, analyse du CV, RGPD, pages légales, application installable.
// Script classique (pas un module) : les fonctions sont globales et appelées depuis les attributs onclick de index.html.
// Ordre de chargement : app-core → interview → job-detail → tracker → account → navigation → ui → search.

// ---------- Mode sombre ----------
function updateThemeButton() {
    const dark = document.documentElement.classList.contains('dark');
    const b = document.getElementById('theme-btn');
    b.textContent = dark ? '☀️' : '🌙';
    b.title = dark ? 'Passer en mode clair' : 'Passer en mode sombre';
    document.querySelector('meta[name="theme-color"]').setAttribute('content', dark ? '#0b1120' : brandColor(600));
}
// ---------- Thèmes de couleur ----------
const COLOR_THEMES = [
    ['emeraude', 'Émeraude', '5 150 105', '20 184 166'], ['ocean', 'Océan', '37 99 235', '6 182 212'], ['violet', 'Violet', '124 58 237', '217 70 239'],
    ['corail', 'Corail', '234 88 12', '244 63 94'], ['indigo', 'Indigo', '79 70 229', '14 165 233']
];
// Couleur du thème actif, pour le code (graphiques, carte) : brandColor(600) → "rgb(5 150 105)"
function brandColor(step = 600) {
    const v = getComputedStyle(document.documentElement).getPropertyValue('--e-' + step).trim();
    return v ? `rgb(${v})` : '#059669';
}
function currentColorTheme() { return document.documentElement.getAttribute('data-color') || 'emeraude'; }
function renderColorOptions() {
    const cur = currentColorTheme();
    document.getElementById('color-options').innerHTML = COLOR_THEMES.map(([k, label, a, b]) => `
        <button role="menuitemradio" aria-checked="${k === cur}" data-k="${k}" onclick="setColorTheme(this.dataset.k)" class="w-full flex items-center gap-3 px-2 py-2 rounded-xl text-sm font-semibold ${k === cur ? 'bg-slate-100 text-slate-900' : 'text-slate-600 hover:bg-slate-50'}">
            <span class="w-6 h-6 rounded-full shrink-0" style="background: linear-gradient(135deg, rgb(${a}), rgb(${b}))"></span>${label}${k === cur ? '<span class="ml-auto">✓</span>' : ''}
        </button>`).join('');
}
function toggleColorMenu(e) {
    if (e) e.stopPropagation();
    const menu = document.getElementById('color-menu');
    const open = menu.classList.toggle('hidden') === false;
    document.getElementById('color-btn').setAttribute('aria-expanded', open);
    if (open) { renderColorOptions(); setTimeout(() => menu.querySelector('[aria-checked="true"]').focus(), 0); }
}
function closeColorMenu() {
    const menu = document.getElementById('color-menu');
    if (menu.classList.contains('hidden')) return;
    menu.classList.add('hidden');
    document.getElementById('color-btn').setAttribute('aria-expanded', 'false');
}
function setColorTheme(k) {
    if (k === 'emeraude') document.documentElement.removeAttribute('data-color');
    else document.documentElement.setAttribute('data-color', k);
    store('jobfacile_color', k);
    renderColorOptions();
    updateThemeButton();
    // Les éléments dessinés en JavaScript reprennent la nouvelle couleur
    if (typeof renderInterviewProgress === 'function') renderInterviewProgress();
    if (typeof mapJobs !== 'undefined' && mapJobs && jobsMode === 'map') renderMap(mapJobs, true);
}
document.addEventListener('click', (e) => { if (!e.target.closest('#color-menu') && !e.target.closest('#color-btn')) closeColorMenu(); });

function toggleTheme() {
    const dark = document.documentElement.classList.toggle('dark');
    store('jobfacile_theme', dark ? 'dark' : 'light');
    updateThemeButton();
}

// ---------- Recherches récentes (gardées dans ce navigateur) ----------
function getRecent() { const l = loadJSON('jobfacile_recent'); return Array.isArray(l) ? l : []; }
function saveRecentSearch(keyword, location) {
    keyword = (keyword || '').trim(); location = (location || '').trim();
    if (!keyword && !location) return;
    const key = (keyword + '|' + location).toLowerCase();
    const list = getRecent().filter(s => (s.keyword + '|' + s.location).toLowerCase() !== key);
    list.unshift({ keyword, location });
    store('jobfacile_recent', list.slice(0, 6));
    renderRecentSearches();
}
function renderRecentSearches() {
    const list = getRecent();
    const box = document.getElementById('recent-searches');
    box.innerHTML = list.length ? '<span class="text-xs font-semibold text-slate-400 mr-1">🕘 Récentes :</span>' + list.map((s, i) => `
        <span class="inline-flex items-center rounded-full border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:border-emerald-300 transition">
            <button onclick="useRecent(${i})" class="pl-3 pr-1 py-1.5 hover:text-emerald-700">${esc([s.keyword, s.location].filter(Boolean).join(' · '))}</button>
            <button onclick="removeRecent(${i})" aria-label="Retirer" class="w-6 h-6 mr-1 rounded-full grid place-items-center text-slate-400 hover:bg-slate-100 hover:text-slate-700">×</button>
        </span>`).join('') : '';
}
function useRecent(i) {
    const s = getRecent()[i]; if (!s) return;
    document.getElementById('keyword').value = s.keyword;
    document.getElementById('location').value = s.location;
    fetchJobs(1);
}
function removeRecent(i) { const l = getRecent(); l.splice(i, 1); store('jobfacile_recent', l); renderRecentSearches(); }

// ---------- Carte des offres (Leaflet + OpenStreetMap) ----------
let jobsMode = 'list';
let leafletMap = null, mapLayer = null, leafletLoading = null;
function setJobsMode(mode, refetch = true) {
    jobsMode = mode;
    const on = 'px-3 py-1.5 rounded-lg text-xs font-bold bg-white text-emerald-700 shadow-sm';
    const off = 'px-3 py-1.5 rounded-lg text-xs font-bold text-slate-500 hover:text-slate-800';
    document.getElementById('mode-list').className = mode === 'list' ? on : off;
    document.getElementById('mode-map').className = mode === 'map' ? on : off;
    document.getElementById('jobs-map-wrap').classList.toggle('hidden', mode !== 'map');
    document.getElementById('jobs-container').classList.toggle('hidden', mode === 'map');
    if (refetch) fetchJobs(1);
}
function loadLeaflet() {
    if (window.L) return Promise.resolve();
    if (leafletLoading) return leafletLoading;
    leafletLoading = new Promise((resolve, reject) => {
        const css = document.createElement('link');
        css.rel = 'stylesheet';
        css.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css';
        document.head.appendChild(css);
        const js = document.createElement('script');
        js.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js';
        js.onload = resolve;
        js.onerror = () => { leafletLoading = null; reject(new Error('Leaflet')); };
        document.head.appendChild(js);
    });
    return leafletLoading;
}
// Adresse exacte de l'établissement (annuaire officiel des entreprises), demandée au serveur
async function locateJobs(jobs) {
    const todo = jobs.filter(j => !j.exactChecked && j.company && !/non communiqu/i.test(j.company));
    if (!todo.length) return false;
    todo.forEach(j => { j.exactChecked = true; });
    const data = await api('/api/jobs/locate', { json: { jobs: todo.map(j => ({ id: j.id, company: j.company, location: j.location })) } }).catch(() => null);
    const found = (data && data.results) || {};
    let any = false;
    todo.forEach(j => { if (found[j.id]) { j.exact = found[j.id]; any = true; } });
    return any;
}
function directionsUrl(e) { return `https://www.openstreetmap.org/directions?to=${e.lat}%2C${e.lng}`; }

let mapJobs = null;
async function renderMap(jobs, located = false) {
    mapJobs = jobs;
    if (!located) {
        document.getElementById('jobs-map-note').textContent = 'Recherche des adresses exactes des entreprises…';
        locateJobs(jobs).then(() => { if (mapJobs === jobs) renderMap(jobs, true); });
    }
    try { await loadLeaflet(); } catch (e) { return showNotification('Impossible de charger la carte.', 'error'); }
    if (!leafletMap) {
        leafletMap = L.map('jobs-map', { scrollWheelZoom: false }).setView([46.6, 2.4], 5);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '&copy; OpenStreetMap' }).addTo(leafletMap);
        mapLayer = L.layerGroup().addTo(leafletMap);
    }
    mapLayer.clearLayers();
    const seen = {};
    const pts = [];
    let exact = 0;
    jobs.forEach(j => {
        const ex = j.exact;
        let lat = parseFloat(ex ? ex.lat : j.lat), lng = parseFloat(ex ? ex.lng : j.lng);
        if (!isFinite(lat) || !isFinite(lng)) return;
        if (ex) exact++;
        // Plusieurs offres au même endroit : on les écarte un peu pour pouvoir cliquer sur chacune
        const k = lat.toFixed(3) + ',' + lng.toFixed(3);
        const n = seen[k] = (seen[k] || 0) + 1;
        if (n > 1) { const a = n * 2.4; lat += Math.cos(a) * 0.004 * Math.sqrt(n); lng += Math.sin(a) * 0.006 * Math.sqrt(n); }
        const icon = L.divIcon({ className: '', html: `<div class="map-pin ${j.category === 'alternance' ? 'alt' : ''} ${ex ? '' : 'approx'}"><span>${domainIcon(j)}</span></div>`, iconSize: [34, 34], iconAnchor: [17, 34], popupAnchor: [0, -32] });
        const el = document.createElement('div');
        el.style.minWidth = '200px';
        el.innerHTML = `<p style="font-weight:700;color:#0f172a;margin:0 0 2px">${esc(j.title)}</p>
            <p style="color:#64748b;margin:0 0 6px;font-size:12px">${esc(j.company)} · ${esc(j.location)}</p>
            ${ex ? `<p style="color:#0f172a;margin:0 0 6px;font-size:12px">📍 ${esc(ex.address)} · <a href="${directionsUrl(ex)}" target="_blank" rel="noopener" style="color:${brandColor(600)};font-weight:700">Itinéraire</a></p>` : '<p style="color:#94a3b8;margin:0 0 6px;font-size:11px">Position approximative (ville)</p>'}
            ${j.salary ? `<p style="color:#b45309;margin:0 0 8px;font-size:12px;font-weight:600">💶 ${esc(j.salary)}</p>` : ''}`;
        const btn = document.createElement('button');
        btn.textContent = 'Voir le détail →';
        btn.style.cssText = 'background:' + brandColor(600) + ';color:#fff;border:0;border-radius:10px;padding:6px 12px;font-weight:700;font-size:12px;cursor:pointer';
        btn.onclick = () => openJobModal(j.id);
        el.appendChild(btn);
        L.marker([lat, lng], { icon }).bindPopup(el).addTo(mapLayer);
        pts.push([lat, lng]);
    });
    setTimeout(() => {
        leafletMap.invalidateSize();
        if (pts.length) leafletMap.fitBounds(pts, { padding: [40, 40], maxZoom: 12 });
        else leafletMap.setView([46.6, 2.4], 5);
    }, 50);
    const missing = jobs.length - pts.length;
    document.getElementById('jobs-map-note').textContent = pts.length
        ? `${pts.length} offre${pts.length > 1 ? 's' : ''} sur la carte, dont ${exact} à l'adresse exacte de l'entreprise (repères pleins ; les repères pâles sont placés au centre de la ville)${missing > 0 ? `. ${missing} sans position` : ''}.${located ? '' : ' Recherche des adresses…'}`
        : 'Aucune de ces offres n\u2019a de position précise. Passez en mode Liste pour les voir.';
}

// ---------- Analyse du CV par l'IA ----------
let lastCVAnalysis = null;
async function analyzeCV(input) {
    if (!requireLogin()) return;
    const f = input.files[0];
    input.value = '';
    if (!f) return;
    if (f.type !== 'application/pdf') return showNotification('Merci d\u2019envoyer votre CV au format PDF.', 'error');
    if (f.size > 5 * 1024 * 1024) return showNotification('CV trop lourd (5 Mo maximum).', 'error');
    const box = document.getElementById('cv-analysis');
    const label = document.getElementById('cv-upload-label');
    label.classList.add('pointer-events-none', 'opacity-60');
    box.innerHTML = `<div class="mt-5 space-y-3"><div class="skeleton h-4 w-2/3"></div><div class="skeleton h-4 w-full"></div><div class="skeleton h-4 w-5/6"></div>
        <p class="text-xs text-slate-500 pt-1">L'IA lit votre CV… (10 à 30 secondes)</p></div>`;
    const fd = new FormData();
    fd.append('cvFile', f);
    const data = await api('/api/user/cv/analyze', { method: 'POST', body: fd });
    label.classList.remove('pointer-events-none', 'opacity-60');
    if (data.user) { setSession(data.user); document.getElementById('cv-current').innerHTML = `<a href="${esc(data.user.cvPdfUrl)}" target="_blank" rel="noopener" class="font-semibold text-emerald-700 underline">📎 Voir mon CV actuel</a>`; }
    if (!data.success) { box.innerHTML = ''; return showNotification(data.message, 'error'); }
    lastCVAnalysis = data.analysis;
    renderCVAnalysis(data.analysis);
}
function renderCVAnalysis(a) {
    const color = a.score >= 75 ? '#10b981' : a.score >= 50 ? '#f59e0b' : '#f43f5e';
    const li = (arr, icon) => arr.map(x => `<li class="flex gap-2"><span>${icon}</span><span>${esc(x)}</span></li>`).join('');
    document.getElementById('cv-analysis').innerHTML = `
        <div class="mt-5 pt-5 border-t border-emerald-200 space-y-5 view-enter">
            <div class="flex items-center gap-4">
                <div class="w-16 h-16 shrink-0 rounded-full grid place-items-center" style="background: conic-gradient(${color} ${a.score * 3.6}deg, #e2e8f0 0)">
                    <div class="w-12 h-12 rounded-full bg-white grid place-items-center text-sm font-extrabold text-slate-900">${a.score}</div>
                </div>
                <div><p class="font-bold text-slate-900">Note de votre CV : ${a.score}/100</p><p class="text-sm text-slate-500">${esc(a.summary)}</p></div>
            </div>
            <div class="grid sm:grid-cols-2 gap-4">
                <div class="rounded-xl bg-white border border-slate-200 p-4"><p class="font-bold text-slate-900 text-sm mb-2">💪 Points forts</p><ul class="space-y-1.5 text-sm text-slate-600">${li(a.strengths, '✓')}</ul></div>
                <div class="rounded-xl bg-white border border-slate-200 p-4"><p class="font-bold text-slate-900 text-sm mb-2">💡 À améliorer</p><ul class="space-y-1.5 text-sm text-slate-600">${li(a.improvements, '→')}</ul></div>
            </div>
            ${a.jobIdeas.length ? `<div><p class="font-bold text-slate-900 text-sm mb-2">🎯 Postes à rechercher</p><div class="flex flex-wrap gap-2">${a.jobIdeas.map((x, i) => `<button onclick="searchJobIdea(${i})" class="px-3 py-1.5 rounded-full bg-white border border-emerald-200 text-emerald-700 text-xs font-bold hover:bg-emerald-50">🔎 ${esc(x)}</button>`).join('')}</div></div>` : ''}
            <div class="rounded-xl bg-white border border-slate-200 p-4">
                <p class="font-bold text-slate-900 text-sm mb-2">📋 Trouvé dans votre CV</p>
                <p class="text-sm text-slate-600 mb-1"><strong>${a.skills.length}</strong> compétences : ${a.skills.map(esc).join(', ') || '—'}</p>
                <p class="text-sm text-slate-600 mb-1"><strong>${a.experience.length}</strong> expériences : ${a.experience.map(e => esc(e.title + (e.company ? ' (' + e.company + ')' : ''))).join(', ') || '—'}</p>
                <p class="text-sm text-slate-600"><strong>${a.education.length}</strong> diplômes : ${a.education.map(e => esc(e.degree)).join(', ') || '—'}</p>
                <button onclick="applyCVAnalysis()" class="btn-primary mt-4 px-5 py-2.5 rounded-xl text-sm font-bold">✓ Ajouter tout à mon profil</button>
            </div>
        </div>`;
}
function searchJobIdea(i) {
    const idea = lastCVAnalysis && lastCVAnalysis.jobIdeas[i];
    if (!idea) return;
    document.getElementById('keyword').value = idea;
    accessJobsView();
}
async function applyCVAnalysis() {
    const a = lastCVAnalysis;
    if (!a) return;
    const key = (...p) => p.map(x => foldTxt(x).trim()).join('|');
    const skillKeys = new Set(userSkills.map(s => key(s)));
    a.skills.forEach(s => { if (!skillKeys.has(key(s))) { userSkills.push(s); skillKeys.add(key(s)); } });
    const expKeys = new Set(userExperience.map(e => key(e.title, e.company)));
    a.experience.forEach(e => { if (!expKeys.has(key(e.title, e.company))) { userExperience.push({ ...e }); expKeys.add(key(e.title, e.company)); } });
    const eduKeys = new Set(userEducation.map(e => key(e.degree, e.school)));
    a.education.forEach(e => { if (!eduKeys.has(key(e.degree, e.school))) { userEducation.push({ ...e }); eduKeys.add(key(e.degree, e.school)); } });
    renderSkillTags(); renderExperienceFields(); renderEducationFields();
    await saveProfileFilesAndSkills();
}

// ---------- RGPD ----------
async function exportMyData() {
    if (!requireLogin()) return;
    const res = await api('/api/user/export', { raw: true });
    if (!res || !res.ok) return showNotification('Export impossible pour le moment.', 'error');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'mes-donnees-jobfacile.json';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showNotification('Vos données ont été téléchargées.');
}
async function deleteMyAccount() {
    if (!requireLogin()) return;
    const password = document.getElementById('delete-password').value;
    if (!password) return showNotification(currentUser.hasPassword === false ? 'Tapez SUPPRIMER pour confirmer.' : 'Saisissez votre mot de passe pour confirmer.', 'error');
    if (!confirm('Supprimer définitivement votre compte JobFacile ?')) return;
    await withBusy(document.getElementById('delete-btn'), async () => {
        const data = await api('/api/user/delete', { json: { password } });
        if (!data.success) return showNotification(data.message, 'error');
        clearSession();
        switchView('home');
        showNotification(data.message);
    });
}

// ---------- Pages légales & bandeau ----------
function openLegal(tab = 'mentions') {
    currentLegalTab = tab;
    switchView('legal');
    document.getElementById('legal-mentions').classList.toggle('hidden', tab !== 'mentions');
    document.getElementById('legal-privacy').classList.toggle('hidden', tab !== 'privacy');
    document.getElementById('legal-tab-mentions').className = tab === 'mentions' ? TAB_ACTIVE : TAB_IDLE;
    document.getElementById('legal-tab-privacy').className = tab === 'privacy' ? TAB_ACTIVE : TAB_IDLE;
    if (!routing) setUrl(urlForView('legal'), true);
}
function dismissStorageBanner() {
    store('jobfacile_storage_ok', '1');
    document.getElementById('storage-banner').classList.add('hidden');
}

// ---------- Appli installable (PWA) ----------
let deferredInstall = null;
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstall = e;
    ['install-btn', 'install-menu-btn'].forEach(id => document.getElementById(id)?.classList.remove('hidden'));
});
window.addEventListener('appinstalled', () => {
    deferredInstall = null;
    ['install-btn', 'install-menu-btn'].forEach(id => document.getElementById(id)?.classList.add('hidden'));
    showNotification('JobFacile est installé ! 🎉');
});
async function installApp() {
    if (!deferredInstall) {
        return showNotification('Sur iPhone : touchez Partager puis « Sur l\u2019écran d\u2019accueil ». Sur Android/PC : menu du navigateur → Installer.');
    }
    deferredInstall.prompt();
    await deferredInstall.userChoice.catch(() => {});
    deferredInstall = null;
}
