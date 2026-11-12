// JobFacile · Base : état de la session, appels au serveur, fenêtres, notifications, animations, connexion (dont Google), profil et générateur de documents.
// Script classique (pas un module) : les fonctions sont globales et appelées depuis les attributs onclick de index.html.
// Ordre de chargement : app-core → interview → job-detail → tracker → account → navigation → ui → search.

const DEFAULT_AVATAR = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 80 80'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' y1='0' x2='1' y2='1'%3E%3Cstop offset='0' stop-color='%23d1fae5'/%3E%3Cstop offset='1' stop-color='%23ccfbf1'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='80' height='80' fill='url(%23g)'/%3E%3Ccircle cx='40' cy='32' r='14' fill='%23059669'/%3E%3Cpath d='M14 76c4-18 16-24 26-24s22 6 26 24z' fill='%23059669'/%3E%3C/svg%3E";
const TAB_ACTIVE = "px-4 py-2 rounded-xl text-sm font-bold bg-white text-emerald-700 shadow-sm whitespace-nowrap transition";
const TAB_IDLE = "px-4 py-2 rounded-xl text-sm font-semibold text-slate-500 hover:text-slate-800 whitespace-nowrap transition";

function loadJSON(key) { try { return JSON.parse(localStorage.getItem(key)); } catch (e) { return null; } }
function store(key, value) { try { value === null ? localStorage.removeItem(key) : localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value)); } catch (e) {} }

let currentUser = loadJSON('jobfacile_current_user');
let authToken = null; try { authToken = localStorage.getItem('jobfacile_token'); } catch (e) {}
let isRegisterMode = false;
let pendingEmail = null;
let pendingPassword = null;
let userSkills = [];
let userExperience = [];
let userEducation = [];
let chatHistory = [];
const CHAT_GREETING = "Bonjour ! Je suis votre recruteur virtuel. Pour commencer, présentez-vous en quelques phrases et dites-moi quel poste vous visez.";

if (currentUser && !authToken) { currentUser = null; store('jobfacile_current_user', null); }

function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ---------- Fenêtres (modales) accessibles au clavier ----------
// À l'ouverture : le focus va dans la fenêtre. Tab reste dedans. Échap ferme. À la fermeture : le focus revient au bouton d'origine.
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type=hidden]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
const modalReturnFocus = new Map();
function openModals() { return [...document.querySelectorAll('.modal-backdrop')].filter(m => !m.classList.contains('hidden')); }
function topModal() { const list = openModals(); return list.sort((a, b) => (parseInt(getComputedStyle(b).zIndex) || 0) - (parseInt(getComputedStyle(a).zIndex) || 0))[0] || null; }
function visibleFocusables(root) { return [...root.querySelectorAll(FOCUSABLE)].filter(el => el.offsetParent !== null || el === document.activeElement); }
function watchModals() {
    const obs = new MutationObserver((records) => {
        for (const r of records) {
            const m = r.target;
            const open = !m.classList.contains('hidden');
            if (open && !modalReturnFocus.has(m)) {
                modalReturnFocus.set(m, document.activeElement);
                document.body.style.overflow = 'hidden';
                setTimeout(() => {
                    if (m.contains(document.activeElement)) return; // le code a déjà placé le focus (ex. champ de code)
                    const panel = m.querySelector('.modal-panel') || m;
                    const target = panel.querySelector('[autofocus]') || visibleFocusables(panel).find(el => !/fermer|passer/i.test(el.getAttribute('aria-label') || '')) || visibleFocusables(panel)[0];
                    if (target) target.focus({ preventScroll: true });
                }, 60);
            } else if (!open && modalReturnFocus.has(m)) {
                const back = modalReturnFocus.get(m);
                modalReturnFocus.delete(m);
                if (!openModals().length) document.body.style.overflow = '';
                if (back && document.contains(back) && back.focus) setTimeout(() => back.focus({ preventScroll: true }), 0);
            }
        }
    });
    document.querySelectorAll('.modal-backdrop').forEach(m => obs.observe(m, { attributes: true, attributeFilter: ['class'] }));
    document.addEventListener('keydown', (e) => {
        const m = topModal();
        if (!m) return;
        if (e.key === 'Escape') {
            // Même effet que le bouton de fermeture de la fenêtre
            const close = m.querySelector('[aria-label="Fermer"], [aria-label="Passer"]');
            if (close) { e.preventDefault(); close.click(); }
            return;
        }
        if (e.key !== 'Tab') return;
        const items = visibleFocusables(m);
        if (!items.length) return;
        const first = items[0], last = items[items.length - 1];
        if (!m.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
        else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
}

function showNotification(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    const ok = type === 'success';
    toast.className = `toast pointer-events-auto max-w-sm flex items-start gap-3 bg-white border ${ok ? 'border-emerald-200' : 'border-rose-200'} text-slate-800 pl-3 pr-4 py-3 rounded-2xl shadow-2xl text-sm font-semibold`;
    toast.innerHTML = `<span class="w-7 h-7 shrink-0 rounded-full grid place-items-center text-white text-xs ${ok ? 'bg-emerald-500' : 'bg-rose-500'}">${ok ? '✓' : '!'}</span><span class="pt-1"></span>`;
    toast.lastChild.innerText = message || (ok ? 'OK' : 'Une erreur est survenue.');
    if (!ok) toast.setAttribute('role', 'alert'); // erreurs annoncées tout de suite
    container.appendChild(toast);
    setTimeout(() => { toast.classList.add('out'); setTimeout(() => toast.remove(), 300); }, 4000);
}

async function api(url, options = {}) {
    const headers = Object.assign({}, options.headers || {});
    if (authToken) headers['Authorization'] = 'Bearer ' + authToken;
    let deviceToken = null; try { deviceToken = localStorage.getItem('jobfacile_device_token'); } catch (e) {}
    if (deviceToken) headers['X-Device-Token'] = deviceToken;
    if (options.json !== undefined) {
        headers['Content-Type'] = 'application/json';
        options.body = JSON.stringify(options.json);
    }
    let res;
    try {
        res = await fetch(url, { method: options.method || (options.body ? 'POST' : 'GET'), headers, body: options.body });
    } catch (e) {
        // Hors connexion : une modification du suivi est mise en attente puis envoyée au retour du réseau
        if (url === '/api/user/applications' && options.json && currentUser && authToken) return queueOfflineChange(url, options.json);
        return { success: false, message: navigator.onLine === false ? 'Vous êtes hors connexion : cette action demande Internet.' : 'Serveur injoignable. Vérifiez votre connexion.' };
    }
    if (options.raw) return res;
    let data;
    try { data = await res.json(); } catch (e) { data = { success: false, message: `Erreur serveur (${res.status}).` }; }
    if (res.status === 401 && authToken && options.silent) { clearSession(); return data; }
    if (res.status === 401 && authToken) {
        clearSession();
        showNotification(data.message || 'Session expirée, veuillez vous reconnecter.', 'error');
        openAuthModal('login');
    }
    // Quota gratuit du mois atteint : on propose Premium
    if (res.status === 402 && data.quota && typeof openPremium === 'function') setTimeout(() => openPremium(data.message), 0);
    return data;
}

// ---------- Hors connexion : suivi consultable et modifiable ----------
// Le suivi reste affiché (dernière version gardée dans ce navigateur). Les changements de statut, notes, entretiens
// faits sans réseau sont gardés dans une file d'attente et envoyés automatiquement au retour de la connexion.
const OUTBOX_KEY = 'jobfacile_outbox';
function outbox() { const l = loadJSON(OUTBOX_KEY); return Array.isArray(l) ? l : []; }
function applyLocalAppChange(body) {
    const u = JSON.parse(JSON.stringify(currentUser));
    u.applications = Array.isArray(u.applications) ? u.applications : [];
    const now = new Date().toISOString();
    if (body.job) {
        let a = u.applications.find(x => x.id === body.job.id);
        if (!a) { a = { id: body.job.id, job: body.job, status: 'todo', notes: '', createdAt: now, updatedAt: now, appliedAt: null }; u.applications.unshift(a); }
        if (body.status) { a.status = body.status; if (body.status !== 'todo' && !a.appliedAt) a.appliedAt = now; }
        a.updatedAt = now;
    } else {
        const a = u.applications.find(x => x.id === body.id);
        if (!a) return null;
        if (body.remove) u.applications = u.applications.filter(x => x.id !== body.id);
        else {
            if (body.status) { a.status = body.status; if (body.status !== 'todo' && !a.appliedAt) a.appliedAt = now; }
            if (body.notes !== undefined) a.notes = String(body.notes).slice(0, 2000);
            if (body.followedUp) a.followUps = [now, ...(a.followUps || [])].slice(0, 10);
            if (body.interview === null) a.interview = null;
            else if (body.interview) { a.interview = { ...body.interview }; if (!['interview', 'offer'].includes(a.status)) a.status = 'interview'; }
            a.updatedAt = now;
        }
    }
    return u;
}
function queueOfflineChange(url, json) {
    const u = applyLocalAppChange(json);
    if (!u) return { success: false, message: 'Candidature introuvable.' };
    store(OUTBOX_KEY, [...outbox(), { url, json, at: Date.now() }].slice(-200));
    updateOfflineBanner();
    return { success: true, user: u, queued: true };
}
let flushing = false;
async function flushOutbox() {
    if (flushing || !authToken || navigator.onLine === false) return;
    const list = outbox();
    if (!list.length) return;
    flushing = true;
    let sent = 0;
    try {
        for (const item of list) {
            let res;
            try { res = await fetch(item.url, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + authToken }, body: JSON.stringify(item.json) }); }
            catch (e) { break; } // toujours pas de réseau : on réessaiera
            if (res.status === 401) break;
            sent++; // envoyé (une erreur 4xx, ex. candidature supprimée entre-temps, n'est pas réessayée)
            store(OUTBOX_KEY, outbox().slice(1));
        }
    } finally { flushing = false; }
    if (sent) {
        const me = await api('/api/me', { silent: true });
        if (me.success) { setSession(me.user); if (typeof refreshJobViews === 'function') refreshJobViews(); }
        showNotification(`Connexion retrouvée : ${sent} modification${sent > 1 ? 's' : ''} du suivi enregistrée${sent > 1 ? 's' : ''} ✓`);
    }
    updateOfflineBanner();
}
function updateOfflineBanner() {
    const bar = document.getElementById('offline-banner');
    if (!bar) return;
    const offline = navigator.onLine === false;
    const pending = outbox().length;
    bar.classList.toggle('hidden', !offline && !pending);
    bar.innerHTML = offline
        ? `📴 Hors connexion : vous voyez la dernière version de votre suivi.${pending ? ` ${pending} modification${pending > 1 ? 's' : ''} en attente d'envoi.` : ' Vos changements de statut, notes et entretiens seront envoyés au retour du réseau.'}`
        : `⏳ Envoi de ${pending} modification${pending > 1 ? 's' : ''} faite${pending > 1 ? 's' : ''} hors connexion…`;
}
window.addEventListener('online', () => { updateOfflineBanner(); flushOutbox(); });
window.addEventListener('offline', updateOfflineBanner);

function setSession(user, token) {
    currentUser = user;
    if (token) { authToken = token; store('jobfacile_token', token); }
    store('jobfacile_current_user', user);
    updateAuthUI();
    if (typeof syncPremiumFlag === 'function') syncPremiumFlag(); // pub masquée pour les abonnés
    if (typeof renderAlertBanner === 'function') renderAlertBanner();
    if (typeof pollUnread === 'function') pollUnread(); // messages non lus, menu modération
    // Nouveau badge gagné ? (vérifié un instant après chaque mise à jour du compte)
    if (typeof checkNewBadges === 'function') { clearTimeout(window._badgeTimer); window._badgeTimer = setTimeout(checkNewBadges, 800); }
    // Alerte demandée avant la connexion : on la crée maintenant
    if (token && pendingAlert) { const p = pendingAlert; pendingAlert = null; setTimeout(() => createAlert(p), 400); }
}
function clearSession() {
    currentUser = null; authToken = null;
    if (typeof syncPremiumFlag === 'function') syncPremiumFlag();
    if (typeof updateMessagingUI === 'function') setTimeout(updateMessagingUI, 0);
    store('jobfacile_current_user', null); store('jobfacile_token', null);
    updateAuthUI();
    if (typeof renderAlertBanner === 'function') renderAlertBanner();
}
function requireLogin() {
    if (currentUser && authToken) return true;
    showNotification('Connectez-vous ou créez un compte pour utiliser cette fonction.', 'error');
    openAuthModal('login');
    return false;
}

// ---------- Animations ----------
let revealObserver = null;
function initReveal(root = document) {
    const els = root.querySelectorAll('.reveal:not(.visible)');
    if (!('IntersectionObserver' in window)) { els.forEach(el => el.classList.add('visible')); return; }
    if (!revealObserver) {
        revealObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (!entry.isIntersecting) return;
                entry.target.classList.add('visible');
                entry.target.querySelectorAll('.counter').forEach(animateCounter);
                revealObserver.unobserve(entry.target);
            });
        }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    }
    els.forEach(el => revealObserver.observe(el));
}
function animateCounter(el) {
    if (el.dataset.done || el.dataset.target === '') return; // chiffre en direct pas encore reçu
    el.dataset.done = '1';
    const target = parseInt(el.dataset.target, 10) || 0;
    const duration = 1400;
    const start = performance.now();
    const step = (now) => {
        const p = Math.min((now - start) / duration, 1);
        el.textContent = new Intl.NumberFormat('fr-FR').format(Math.round(target * (1 - Math.pow(1 - p, 3))));
        if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
}

window.addEventListener('DOMContentLoaded', async () => {
    document.getElementById('year').textContent = new Date().getFullYear();
    document.getElementById('privacy-date').textContent = '12 novembre 2026';
    updateThemeButton();
    renderRecentSearches();
    setJobsMode('list', false);
    let storageOk = null; try { storageOk = localStorage.getItem('jobfacile_storage_ok_v2'); } catch (e) {}
    if (!storageOk) setTimeout(() => document.getElementById('storage-banner').classList.remove('hidden'), 1200);
    if ('serviceWorker' in navigator && (location.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(location.hostname))) {
        navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
    updateAuthUI();
    // Connecté sur cet appareil mais profil pas encore en mémoire : on le charge avant d’ouvrir une page protégée
    if (authToken && !currentUser) { const me = await api('/api/me', { silent: true }); if (me.success) setSession(me.user); }
    route(true);
    resetChat();
    pickDocType('cv');
    pickCvTemplate(cvTemplate);
    document.getElementById('profile-avatar-preview').src = DEFAULT_AVATAR;
    document.addEventListener('click', (e) => {
        if (!document.getElementById('nav-container').contains(e.target)) closeNavMenu();
        const skillBox = document.getElementById('skill-search-input').parentElement;
        if (!skillBox.contains(e.target)) document.getElementById('skills-dropdown').classList.add('hidden');
    });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !topModal()) { closeNavMenu(); closeColorMenu(); } });
    watchModals();
    window.addEventListener('scroll', () => {
        document.getElementById('site-header').classList.toggle('shadow-md', window.scrollY > 8);
    }, { passive: true });
    // Nombre réel d'offres en France (si France Travail est connecté)
    const liveStat = (query, id) => api('/api/jobs?limit=1&stats=1' + query).then(d => {
        const el = document.getElementById(id);
        if (!d || d.demo || !d.total || d.approxTotal) {
            if (el.dataset.target === '') { el.textContent = '—'; el.dataset.done = '1'; }
            return;
        }
        el.dataset.target = d.total;
        const visible = el.closest('.reveal')?.classList.contains('visible');
        if (el.dataset.done || visible) { delete el.dataset.done; animateCounter(el); }
    });
    liveStat('', 'stat-offers');        // offres de moins de 45 jours
    liveStat('&days=1', 'stat-new');    // publiées ces dernières 24 h
    updateOfflineBanner();
    if (authToken) {
        await flushOutbox(); // modifications faites hors connexion lors d'une visite précédente
        const data = await api('/api/me', { silent: true });
        if (data.success) setSession(data.user);
    }
});

function switchView(viewName) {
    document.querySelectorAll('body > .flex-1 > [id^="view-"]').forEach(el => el.classList.add('hidden'));
    const view = document.getElementById(`view-${viewName}`);
    view.classList.remove('hidden');
    view.classList.remove('view-enter'); void view.offsetWidth; view.classList.add('view-enter');
    document.querySelectorAll('#desktop-nav [data-nav]').forEach(b => b.classList.toggle('active', b.dataset.nav === viewName));
    const more = document.getElementById('more-btn');
    if (more) more.classList.toggle('active', ['rights', 'recruiter', 'advice', 'about', 'admin'].includes(viewName));
    window.scrollTo({ top: 0, behavior: 'instant' });
    initReveal(view);
    document.title = viewName === 'home' ? VIEW_TITLES.home : (VIEW_TITLES[viewName] || 'JobFacile') + ' – JobFacile';
    if (viewName === 'ai-assistant') { prefillChatJob(); renderInterviewProgress(); }
    else if (typeof stopSpeaking === 'function') { stopSpeaking(); stopMic(true); }
    if (viewName === 'ai-generator') pickDocType(document.getElementById('ai-doc-type').value);
    if (!routing) setUrl(urlForView(viewName));
}

function toggleNavMenu(e) { if (e) e.stopPropagation(); document.getElementById('nav-dropdown-menu').classList.toggle('hidden'); }
function closeNavMenu() { document.getElementById('nav-dropdown-menu').classList.add('hidden'); }
function accessJobsView() {
    // Recherche pré-remplie avec les préférences du profil
    const kw = document.getElementById('keyword'), loc = document.getElementById('location');
    if (currentUser && authToken && !kw.value.trim() && !loc.value.trim()) {
        if (currentUser.desiredJob) kw.value = currentUser.desiredJob;
        if (currentUser.city) loc.value = currentUser.city;
        if (currentUser.mobilityKm) document.getElementById('radius-select').value = String(currentUser.mobilityKm);
        if (currentUser.remoteWanted) document.getElementById('remote-check').checked = true;
    }
    switchView('jobs'); fetchJobs(1);
}

function heroSearch(e) {
    e.preventDefault();
    document.getElementById('keyword').value = document.getElementById('hero-keyword').value.trim();
    document.getElementById('location').value = document.getElementById('hero-location').value.trim();
    accessJobsView();
}

function pickDocType(type) {
    document.getElementById('ai-doc-type').value = type;
    document.querySelectorAll('.doc-opt').forEach(b => {
        const on = b.dataset.doc === type;
        b.classList.toggle('border-emerald-500', on);
        b.classList.toggle('bg-emerald-50', on);
        b.classList.toggle('border-slate-200', !on);
        b.classList.toggle('hover:border-emerald-200', !on);
    });
    document.getElementById('cv-options').classList.toggle('hidden', type !== 'cv');
    document.getElementById('lm-options').classList.toggle('hidden', type !== 'lm');
    pickLetterTone(letterTone);
    document.getElementById('ai-offer-chip-label').textContent = type === 'cv' ? 'CV adapté à l’offre' : 'Lettre ciblée sur l’offre';
    const hasPhoto = !!(currentUser && currentUser.avatarUrl);
    const photo = document.getElementById('cv-include-photo');
    photo.disabled = !hasPhoto;
    if (!hasPhoto) photo.checked = false;
    document.getElementById('cv-photo-hint').textContent = hasPhoto ? '' : '(ajoutez une photo dans votre profil)';
}

let letterTone = 'formel';
try { letterTone = localStorage.getItem('jf-lm-tone') || 'formel'; } catch (e) {}
const TONES = {
    formel: 'Ton formel et sobre : vouvoiement, phrases mesurées, formules de politesse classiques.',
    dynamique: 'Ton dynamique et direct : phrases courtes, verbes d’action, enthousiasme sincère, formules de politesse simples. Reste professionnel.',
    creatif: 'Ton créatif : une accroche originale et mémorable en première phrase, un style vivant et personnel, sans tomber dans l’humour ni la familiarité. Reste crédible pour un recruteur.'
};
function pickLetterTone(t) {
    letterTone = TONES[t] ? t : 'formel';
    try { localStorage.setItem('jf-lm-tone', letterTone); } catch (e) {}
    document.querySelectorAll('.lm-tone').forEach(b => {
        const on = b.dataset.tone === letterTone;
        b.setAttribute('aria-pressed', on);
        b.classList.toggle('border-emerald-500', on);
        b.classList.toggle('bg-emerald-50', on);
        b.classList.toggle('border-slate-200', !on);
    });
}
let cvTemplate = 'moderne';
try { cvTemplate = localStorage.getItem('jf-cv-template') || 'moderne'; } catch (e) {}
function pickCvTemplate(t) {
    cvTemplate = ['moderne', 'classique', 'compact'].includes(t) ? t : 'moderne';
    try { localStorage.setItem('jf-cv-template', cvTemplate); } catch (e) {}
    document.querySelectorAll('.cv-tpl').forEach(b => {
        const on = b.dataset.tpl === cvTemplate;
        b.setAttribute('aria-pressed', on);
        b.classList.toggle('border-emerald-500', on);
        b.classList.toggle('bg-emerald-50', on);
        b.classList.toggle('border-slate-200', !on);
    });
}

function togglePassword() {
    const i = document.getElementById('auth-password');
    i.type = i.type === 'password' ? 'text' : 'password';
}

function showModalPane(pane) {
    ['form-auth-view', 'form-verify-view', 'form-2fa-view', 'form-forgot-view'].forEach(id => document.getElementById(id).classList.toggle('hidden', id !== pane));
}

function openAuthModal(mode) {
    isRegisterMode = (mode === 'register');
    document.getElementById('modal-title').innerText = isRegisterMode ? "Créer un compte" : "Se connecter";
    document.getElementById('modal-subtitle').innerText = isRegisterMode ? "Gratuit, en moins d'une minute ✨" : "Heureux de vous revoir 👋";
    document.getElementById('register-fields').classList.toggle('hidden', !isRegisterMode);
    document.getElementById('forgot-link').classList.toggle('hidden', isRegisterMode);
    document.getElementById('auth-submit-btn').innerText = isRegisterMode ? "Créer mon compte" : "Se connecter";
    document.getElementById('auth-switch-text').innerText = isRegisterMode ? "Déjà un compte ?" : "Pas encore de compte ?";
    document.getElementById('auth-switch-link').innerText = isRegisterMode ? "Se connecter" : "S'inscrire";
    document.getElementById('auth-password').placeholder = isRegisterMode ? 'Mot de passe (8 caractères minimum)' : 'Mot de passe';
    document.getElementById('auth-password').autocomplete = isRegisterMode ? 'new-password' : 'current-password';
    showModalPane('form-auth-view');
    initGoogleButton();
    const modal = document.getElementById('auth-modal');
    const wasHidden = modal.classList.contains('hidden');
    modal.classList.remove('hidden');
    if (wasHidden) setTimeout(() => document.getElementById(isRegisterMode ? 'auth-firstname' : 'auth-email').focus(), 50);
}

function closeAuthModal() { document.getElementById('auth-modal').classList.add('hidden'); pendingPassword = null; }
function switchAuthMode() { openAuthModal(isRegisterMode ? 'login' : 'register'); }

function updateAuthUI() {
    const container = document.getElementById('auth-container');
    const homeRegister = document.getElementById('home-register-btn');
    if (currentUser && authToken) {
        const avatarImg = currentUser.avatarUrl
            ? `<img src="${esc(currentUser.avatarUrl)}" alt="" class="w-9 h-9 rounded-full object-cover ring-2 ring-emerald-500 ring-offset-2">`
            : `<span class="w-9 h-9 rounded-full btn-primary grid place-items-center text-sm font-bold">${esc((currentUser.firstName || '?').charAt(0).toUpperCase())}</span>`;
        container.innerHTML = `
            <button onclick="accessProfileView()" aria-label="Mon profil" class="flex items-center gap-2 p-1 sm:pr-3 rounded-full hover:bg-slate-100 transition text-sm font-bold text-slate-700">
                ${avatarImg}
                <span class="hidden sm:inline xl:hidden 2xl:inline max-w-[8rem] truncate">${esc(currentUser.firstName)}</span>
            </button>
            <button onclick="logout()" aria-label="Déconnexion" class="hidden sm:inline-flex sm:px-3 sm:py-2 place-items-center rounded-xl text-slate-500 hover:bg-rose-50 hover:text-rose-600 text-xs font-semibold transition">
                <svg class="sm:hidden xl:inline 2xl:hidden" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3"/></svg>
                <span class="hidden sm:inline xl:hidden 2xl:inline">Déconnexion</span>
            </button>
        `;
        if (homeRegister) homeRegister.classList.add('hidden');
        document.getElementById('nav-logout-btn')?.classList.remove('hidden');
    } else {
        document.getElementById('nav-logout-btn')?.classList.add('hidden');
        container.innerHTML = `
            <button onclick="openAuthModal('login')" class="px-2.5 sm:px-4 py-2 text-slate-700 hover:text-emerald-600 text-sm font-bold rounded-xl hover:bg-emerald-50 transition whitespace-nowrap max-w-[9rem] truncate">Se connecter</button>
            <button onclick="openAuthModal('register')" class="hidden sm:inline-block btn-primary px-4 py-2 text-sm font-bold rounded-xl">S'inscrire</button>
        `;
        if (homeRegister) homeRegister.classList.remove('hidden');
    }
}

async function logout() {
    if (authToken) await api('/api/logout', { method: 'POST' });
    clearSession();
    switchView('home');
    showNotification("Déconnecté. À bientôt !");
}

async function withBusy(btn, fn) {
    if (btn) btn.disabled = true;
    try { return await fn(); } finally { if (btn) btn.disabled = false; }
}

async function submitAuth() {
    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value;
    if (!email || !password) return showNotification("Renseignez l'e-mail et le mot de passe.", 'error');

    await withBusy(document.getElementById('auth-submit-btn'), async () => {
        if (isRegisterMode) {
            const body = {
                firstName: document.getElementById('auth-firstname').value.trim(),
                lastName: document.getElementById('auth-lastname').value.trim(),
                gender: document.getElementById('auth-gender').value,
                birthDate: document.getElementById('auth-birthdate').value,
                phone: document.getElementById('auth-phone').value.trim(),
                acceptTerms: document.getElementById('auth-terms').checked,
                referralCode: pendingReferralCode(),
                email, password
            };
            const data = await api('/api/register', { json: body });
            if (data.success) {
                pendingEmail = data.email || email;
                showNotification("Compte créé ! Code envoyé par e-mail.");
                showModalPane('form-verify-view');
                document.getElementById('verify-code-input').focus();
            } else { showNotification(data.message, "error"); }
        } else {
            const data = await api('/api/login', { json: { email, password } });
            if (!data.success) return showNotification(data.message, "error");
            if (data.requireVerification) {
                pendingEmail = data.email;
                showNotification(data.message);
                showModalPane('form-verify-view');
            } else if (data.require2FA) {
                pendingEmail = data.email;
                pendingPassword = password;
                showModalPane('form-2fa-view');
                document.getElementById('twofa-code-input').focus();
            } else {
                setSession(data.user, data.token);
                closeAuthModal();
                document.getElementById('auth-password').value = '';
                showNotification(`Bon retour, ${data.user.firstName} !`);
                resumeAfterLogin();
                maybeOnboarding();
            }
        }
    });
}

// ---------- Connexion avec Google ----------
let googleClientId, googleReady = null, googleTicket = null;
function initGoogleButton() {
    if (!googleReady) googleReady = (async () => {
        const cfg = await api('/api/config').catch(() => null);
        googleClientId = cfg && cfg.googleClientId;
        if (!googleClientId) return false;
        await new Promise((resolve, reject) => {
            const sc = document.createElement('script');
            sc.src = 'https://accounts.google.com/gsi/client';
            sc.async = true; sc.onload = resolve; sc.onerror = reject;
            document.head.appendChild(sc);
        });
        google.accounts.id.initialize({ client_id: googleClientId, callback: onGoogleCredential, ux_mode: 'popup', locale: 'fr' });
        return true;
    })().catch(() => { googleReady = null; return false; });
    googleReady.then(ok => {
        const box = document.getElementById('google-auth');
        box.classList.toggle('hidden', !ok);
        if (!ok) return;
        const target = document.getElementById('google-btn');
        target.innerHTML = '';
        google.accounts.id.renderButton(target, {
            theme: document.documentElement.classList.contains('dark') ? 'filled_black' : 'outline',
            size: 'large', shape: 'pill', width: Math.min(360, target.clientWidth || 320), locale: 'fr',
            text: isRegisterMode ? 'signup_with' : 'continue_with'
        });
    });
}
async function onGoogleCredential(resp) {
    const data = await api('/api/auth/google', { json: { credential: resp.credential, referralCode: pendingReferralCode() } });
    if (!data.success) return showNotification(data.message || 'Connexion Google impossible.', 'error');
    if (data.require2FA) {
        pendingEmail = data.email;
        pendingPassword = null;
        googleTicket = data.googleTicket;
        showModalPane('form-2fa-view');
        document.getElementById('twofa-code-input').focus();
        return;
    }
    setSession(data.user, data.token);
    closeAuthModal();
    if (data.created) { showNotification(`Bienvenue, ${data.user.firstName} 🎉`); setTimeout(openOnboarding, 600); }
    else { showNotification(`Bon retour, ${data.user.firstName} !`); resumeAfterLogin(); maybeOnboarding(); }
}

async function submitVerificationCode() {
    const code = document.getElementById('verify-code-input').value.trim();
    if (!pendingEmail) return showNotification('Recommencez la connexion.', 'error');
    const data = await api('/api/verify-code', { json: { email: pendingEmail, code } });
    if (data.success) {
        setSession(data.user, data.token);
        closeAuthModal();
        document.getElementById('verify-code-input').value = '';
        document.getElementById('auth-password').value = '';
        showNotification("Compte vérifié ! Bienvenue 🎉");
        setTimeout(openOnboarding, 600);
    } else { showNotification(data.message, "error"); }
}

async function resendCode() {
    if (!pendingEmail) return;
    const data = await api('/api/resend-code', { json: { email: pendingEmail } });
    showNotification(data.message || 'Nouveau code envoyé.', data.success ? 'success' : 'error');
}

async function submit2FA() {
    const token = document.getElementById('twofa-code-input').value.trim();
    const rememberDevice = document.getElementById('twofa-remember').checked;
    const data = await api('/api/login-2fa', { json: { email: pendingEmail, password: pendingPassword, googleTicket, token, rememberDevice } });
    if (data.success) {
        googleTicket = null;
        if (data.deviceToken) store('jobfacile_device_token', data.deviceToken);
        setSession(data.user, data.token);
        closeAuthModal();
        document.getElementById('twofa-code-input').value = '';
        document.getElementById('auth-password').value = '';
        showNotification("Connecté avec succès !");
    } else { showNotification(data.message, "error"); }
}

function switchProfileTab(tabName) {
    ['info', 'cv', 'security'].forEach(t => {
        document.getElementById(`profile-tab-${t}`).classList.add('hidden');
        document.getElementById(`tab-btn-${t}`).className = TAB_IDLE;
    });
    const panel = document.getElementById(`profile-tab-${tabName}`);
    panel.classList.remove('hidden');
    panel.classList.remove('view-enter'); void panel.offsetWidth; panel.classList.add('view-enter');
    document.getElementById(`tab-btn-${tabName}`).className = TAB_ACTIVE;
    currentProfileTab = tabName;
    if (!routing && !document.getElementById('view-profile').classList.contains('hidden')) setUrl(urlForView('profile'), true);
}

function prefillChatJob() {
    const el = document.getElementById('chat-target-job');
    if (el && !el.value && currentUser && currentUser.desiredJob) el.value = currentUser.desiredJob;
}
function accessProfileView(tab = 'info') {
    if (!requireLogin()) return;
    fillProfileInfo();
    document.getElementById('profile-name-title').innerText = `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim() || 'Mon Profil';
    document.getElementById('profile-avatar-preview').src = currentUser.avatarUrl || DEFAULT_AVATAR;
    document.getElementById('avatar-file-input').value = '';
    document.getElementById('cv-current').innerHTML = currentUser.cvPdfUrl
        ? `<a href="${esc(currentUser.cvPdfUrl)}" target="_blank" rel="noopener" class="font-semibold text-emerald-700 underline">📎 Voir mon CV actuel</a>`
        : '';

    userSkills = Array.isArray(currentUser.skills) ? [...currentUser.skills] : [];
    userExperience = Array.isArray(currentUser.experience) ? currentUser.experience.map(e => ({ ...e })) : [];
    userEducation = Array.isArray(currentUser.education) ? currentUser.education.map(e => ({ ...e })) : [];

    renderSkillTags();
    renderExperienceFields();
    renderEducationFields();

    switchView('profile');
    switchProfileTab(tab);
}

function previewAvatar(input) {
    const f = input.files[0];
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) { showNotification('Image trop lourde (5 Mo maximum).', 'error'); input.value = ''; return; }
    document.getElementById('profile-avatar-preview').src = URL.createObjectURL(f);
    switchProfileTab('cv');
}

let skillSearchTimer = null;
let lastSkillResults = [];
function searchSkills(query) {
    clearTimeout(skillSearchTimer);
    skillSearchTimer = setTimeout(async () => {
        const dropdown = document.getElementById('skills-dropdown');
        const q = query.trim();
        if (!q) { dropdown.classList.add('hidden'); return; }
        const results = await api(`/api/skills/search?q=${encodeURIComponent(q)}`);
        if (!Array.isArray(results) || results.length === 0) {
            dropdown.innerHTML = '<div class="px-3 py-3 text-sm text-slate-400">Aucun résultat</div>';
            dropdown.classList.remove('hidden');
            return;
        }
        lastSkillResults = results;
        dropdown.innerHTML = results.map((item, i) => `
            <div class="suggestion-item" onclick="addSkillTag(lastSkillResults[${i}].name)">
                <span class="font-semibold">${esc(item.name)}</span>
                <span class="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full whitespace-nowrap">${esc(item.type)}</span>
            </div>
        `).join('');
        dropdown.classList.remove('hidden');
    }, 200);
}

function addSkillTag(skill) {
    if (!userSkills.includes(skill)) { userSkills.push(skill); renderSkillTags(); }
    document.getElementById('skill-search-input').value = '';
    document.getElementById('skills-dropdown').classList.add('hidden');
}

function removeSkillTag(i) {
    userSkills.splice(i, 1);
    renderSkillTags();
}

function renderSkillTags() {
    const container = document.getElementById('skills-tags-container');
    container.innerHTML = userSkills.length ? userSkills.map((skill, i) => `
        <span class="bubble-in inline-flex items-center pl-3 pr-1 py-1 rounded-full text-xs font-bold bg-gradient-to-r from-emerald-50 to-teal-50 text-emerald-800 border border-emerald-200">
            ${esc(skill)}
            <button type="button" onclick="removeSkillTag(${i})" aria-label="Retirer" class="ml-1.5 w-5 h-5 rounded-full grid place-items-center text-emerald-600 hover:bg-emerald-200 transition">×</button>
        </span>
    `).join('') : '<span class="text-sm text-slate-400 py-2">Aucune compétence ajoutée pour le moment.</span>';
}

function addExperienceField() { userExperience.push({ title: '', company: '', period: '', desc: '' }); renderExperienceFields(); }
function removeExperienceField(i) { userExperience.splice(i, 1); renderExperienceFields(); }
function renderExperienceFields() {
    const container = document.getElementById('experience-container');
    container.innerHTML = userExperience.map((exp, i) => `
        <div class="bubble-in p-4 bg-slate-50 rounded-xl border border-slate-200 relative">
            <div class="flex justify-between items-center mb-3">
                <span class="text-xs font-bold text-slate-400 uppercase tracking-wider">Expérience ${i + 1}</span>
                <button type="button" onclick="removeExperienceField(${i})" class="text-xs font-semibold text-rose-500 hover:text-rose-700 px-2 py-1 rounded-lg hover:bg-rose-50 transition">Supprimer</button>
            </div>
            <div class="grid sm:grid-cols-2 gap-2">
                <input type="text" placeholder="Intitulé du poste" value="${esc(exp.title)}" oninput="userExperience[${i}].title=this.value" class="field field-sm bg-white">
                <input type="text" placeholder="Entreprise" value="${esc(exp.company)}" oninput="userExperience[${i}].company=this.value" class="field field-sm bg-white">
                <input type="text" placeholder="Période (ex : 2022 - 2024)" value="${esc(exp.period)}" oninput="userExperience[${i}].period=this.value" class="field field-sm bg-white sm:col-span-2">
                <textarea placeholder="Missions principales" rows="2" oninput="userExperience[${i}].desc=this.value" class="field field-sm bg-white sm:col-span-2">${esc(exp.desc)}</textarea>
            </div>
        </div>
    `).join('');
}

function addEducationField() { userEducation.push({ degree: '', school: '', year: '' }); renderEducationFields(); }
function removeEducationField(i) { userEducation.splice(i, 1); renderEducationFields(); }
function renderEducationFields() {
    const container = document.getElementById('education-container');
    container.innerHTML = userEducation.map((edu, i) => `
        <div class="bubble-in p-4 bg-slate-50 rounded-xl border border-slate-200 relative">
            <div class="flex justify-between items-center mb-3">
                <span class="text-xs font-bold text-slate-400 uppercase tracking-wider">Diplôme ${i + 1}</span>
                <button type="button" onclick="removeEducationField(${i})" class="text-xs font-semibold text-rose-500 hover:text-rose-700 px-2 py-1 rounded-lg hover:bg-rose-50 transition">Supprimer</button>
            </div>
            <div class="grid sm:grid-cols-3 gap-2">
                <input type="text" placeholder="Diplôme" value="${esc(edu.degree)}" oninput="userEducation[${i}].degree=this.value" class="field field-sm bg-white">
                <input type="text" placeholder="École" value="${esc(edu.school)}" oninput="userEducation[${i}].school=this.value" class="field field-sm bg-white">
                <input type="text" placeholder="Année" value="${esc(edu.year)}" oninput="userEducation[${i}].year=this.value" class="field field-sm bg-white">
            </div>
        </div>
    `).join('');
}


async function saveProfileFilesAndSkills() {
    if (!requireLogin()) return;
    const formData = new FormData();
    formData.append('skills', JSON.stringify(userSkills));
    formData.append('experience', JSON.stringify(userExperience));
    formData.append('education', JSON.stringify(userEducation));
    const avatarFile = document.getElementById('avatar-file-input').files[0];
    if (avatarFile) formData.append('avatarFile', avatarFile);

    await withBusy(document.getElementById('save-profile-btn'), async () => {
        const data = await api('/api/user/update-profile-files', { method: 'POST', body: formData });
        if (data.success) {
            setSession(data.user);
            showNotification("Profil enregistré !");
            accessProfileView('cv');
        } else { showNotification(data.message, "error"); }
    });
}

async function generateAIDocument() {
    if (!requireLogin()) return;
    const type = document.getElementById('ai-doc-type').value;
    const targetJob = document.getElementById('ai-target-job').value.trim();
    if (!targetJob) { document.getElementById('ai-target-job').focus(); return showNotification('Indiquez le poste visé.', 'error'); }
    if (type === 'cv') return generateCv(targetJob);
    const userName = `${currentUser.firstName} ${currentUser.lastName}`;
    const skills = (currentUser.skills || []).join(', ') || 'non renseignées';
    const expList = (currentUser.experience || []).map(e => `${e.title} chez ${e.company} (${e.period})${e.desc ? ' : ' + e.desc : ''}`).join('; ') || 'non renseignées';
    const eduList = (currentUser.education || []).map(ed => `${ed.degree} à ${ed.school} (${ed.year})`).join('; ') || 'non renseignés';

    const prompt = type === 'cv'
        ? `Rédige un résumé de profil professionnel percutant (8 à 12 lignes) pour le CV d'un candidat au poste de "${targetJob}". Candidat : ${userName}. Compétences : ${skills}. Expériences : ${expList}. Diplômes : ${eduList}. Ne répète pas les coordonnées.`
        : `Rédige une lettre de motivation complète et personnalisée pour le poste de "${targetJob}". Candidat : ${userName}. Compétences : ${skills}. Expériences : ${expList}. Diplômes : ${eduList}. Termine par une formule de politesse et la signature du candidat. ${TONES[letterTone]}`;

    // Offre ciblée depuis la fiche : la lettre est adaptée à cette entreprise et à cette annonce
    const offerContext = targetOffer
        ? ` Offre ciblée : "${targetOffer.title}" chez ${targetOffer.company} (${targetOffer.location}). Extrait de l'annonce : ${(targetOffer.fullDescription || targetOffer.description || '').slice(0, 1500)}. Adresse le document à cette entreprise et relie précisément le profil du candidat aux attentes de l'annonce.`
        : '';

    const loading = document.getElementById('ai-loading');
    await withBusy(document.getElementById('ai-generate-btn'), async () => {
        loading.classList.remove('hidden');
        document.getElementById('ai-result-box').classList.add('hidden');
        const data = await api('/api/ai/generate', { json: { prompt: prompt + profileExtras() + offerContext } });
        loading.classList.add('hidden');
        if (data.success) {
            lastCv = null;
            document.getElementById('ai-output-label').classList.add('hidden');
            document.getElementById('cv-missing').classList.add('hidden');
            document.getElementById('ai-output-text').rows = 12;
            document.getElementById('ai-output-text').value = data.text;
            const box = document.getElementById('ai-result-box');
            box.classList.remove('hidden');
            box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            await downloadGeneratedPDF();
        } else { showNotification(data.message || "L'IA n'a pas pu répondre.", 'error'); }
    });
}

// CV : l'IA rédige l'accroche et réordonne compétences / missions (sans rien inventer), puis PDF mis en page
let lastCv = null;
async function generateCv(targetJob) {
    const loading = document.getElementById('ai-loading');
    const offer = targetOffer ? { title: targetOffer.title, company: targetOffer.company, location: targetOffer.location, fullDescription: (targetOffer.fullDescription || targetOffer.description || '').slice(0, 3000) } : null;
    await withBusy(document.getElementById('ai-generate-btn'), async () => {
        loading.classList.remove('hidden');
        document.getElementById('ai-result-box').classList.add('hidden');
        const data = await api('/api/ai/cv-content', { json: { targetJob, offer } });
        loading.classList.add('hidden');
        if (!data.success) return showNotification(data.message || "L'IA n'a pas pu répondre.", 'error');
        lastCv = data.cv;
        document.getElementById('ai-output-label').classList.remove('hidden');
        const ta = document.getElementById('ai-output-text');
        ta.rows = 6;
        ta.value = data.cv.summary;
        const miss = document.getElementById('cv-missing');
        if (data.cv.missing && data.cv.missing.length) {
            miss.innerHTML = `<p class="font-bold mb-1">⚠️ Attendu dans l'annonce mais absent de votre profil</p><p>${data.cv.missing.map(esc).join(' · ')}</p><p class="text-xs mt-1 text-amber-700">Si vous les avez, ajoutez-les à votre profil puis régénérez le CV. Sinon, parlez-en dans votre lettre (envie d'apprendre, formation prévue…).</p>`;
            miss.classList.remove('hidden');
        } else miss.classList.add('hidden');
        const box = document.getElementById('ai-result-box');
        box.classList.remove('hidden');
        box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        await downloadGeneratedPDF();
    });
}

async function downloadGeneratedPDF() {
    if (!requireLogin()) return;
    const targetJob = document.getElementById('ai-target-job').value.trim() || "Poste";
    const docType = document.getElementById('ai-doc-type').value;
    const contentText = document.getElementById('ai-output-text').value;
    const body = { targetJob, docType, contentText };
    if (docType === 'cv') {
        Object.assign(body, { template: cvTemplate, includePhoto: document.getElementById('cv-include-photo').checked, summary: contentText });
        if (lastCv) Object.assign(body, { skills: lastCv.skills, experience: lastCv.experience });
    }
    const response = await api('/api/ai/download-cv', { json: body, raw: true });
    if (response && response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${docType === 'lm' ? 'Lettre' : 'CV'}_${targetJob.replace(/\s+/g, '_')}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        showNotification("PDF téléchargé !");
    } else {
        if (response && response.status === 401) { clearSession(); openAuthModal('login'); }
        showNotification("Impossible de générer le PDF.", 'error');
    }
}
