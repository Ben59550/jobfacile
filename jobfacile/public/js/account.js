// JobFacile · Compte : mot de passe oublié, profil détaillé, permis et habilitations, sécurité (mot de passe, double authentification).
// Script classique (pas un module) : les fonctions sont globales et appelées depuis les attributs onclick de index.html.
// Ordre de chargement : app-core → interview → job-detail → tracker → account → navigation → ui → search.

// ---------- Mot de passe oublié ----------
let forgotEmail = null;
function openForgot() {
    showModalPane('form-forgot-view');
    document.getElementById('forgot-step1').classList.remove('hidden');
    document.getElementById('forgot-step2').classList.add('hidden');
    document.getElementById('forgot-email').value = document.getElementById('auth-email').value.trim();
    document.getElementById('forgot-email').focus();
}
async function requestReset() {
    const email = (forgotEmail && !document.getElementById('forgot-step2').classList.contains('hidden'))
        ? forgotEmail : document.getElementById('forgot-email').value.trim();
    if (!email) return showNotification('Indiquez votre adresse e-mail.', 'error');
    await withBusy(document.getElementById('forgot-send-btn'), async () => {
        const data = await api('/api/forgot-password', { json: { email } });
        if (!data.success) return showNotification(data.message, 'error');
        forgotEmail = email;
        showNotification(data.message);
        document.getElementById('forgot-step1').classList.add('hidden');
        document.getElementById('forgot-step2').classList.remove('hidden');
        document.getElementById('forgot-code').focus();
    });
}
async function submitReset() {
    const body = {
        email: forgotEmail,
        code: document.getElementById('forgot-code').value.trim(),
        newPassword: document.getElementById('forgot-new').value,
        confirmPassword: document.getElementById('forgot-confirm').value
    };
    await withBusy(document.getElementById('forgot-reset-btn'), async () => {
        const data = await api('/api/reset-password', { json: body });
        if (!data.success) return showNotification(data.message, 'error');
        showNotification(data.message);
        ['forgot-code', 'forgot-new', 'forgot-confirm'].forEach(id => document.getElementById(id).value = '');
        openAuthModal('login');
        document.getElementById('auth-email').value = forgotEmail;
        document.getElementById('auth-password').focus();
    });
}

// ---------- Profil : informations détaillées ----------
const CONTRACT_CHOICES = ['CDI', 'CDD', 'Intérim', 'Alternance', 'Stage', 'Freelance', 'Saisonnier'];
const LANG_LEVELS = ['Notions', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'Courant', 'Langue maternelle'];
let profileContracts = [];
let profileLanguages = [];

function fillProfileInfo() {
    const u = currentUser || {};
    const set = (id, v) => { document.getElementById(id).value = v ?? ''; };
    set('prof-firstname', u.firstName); set('prof-lastname', u.lastName);
    set('prof-gender', ['H', 'F', 'A'].includes(u.gender) ? u.gender : 'A');
    set('prof-birthdate', u.birthDate); set('prof-email', u.email); set('prof-phone', u.phone);
    set('prof-city', u.city); set('prof-postal', u.postalCode); set('prof-address', u.address);
    set('prof-desired-job', u.desiredJob); set('prof-mobility', String(u.mobilityKm || 20));
    set('prof-availability', u.availability || ''); set('prof-salary', u.salaryWanted);
    set('prof-headline', u.headline); set('prof-bio', u.bio);
    set('prof-linkedin', u.linkedin); set('prof-portfolio', u.portfolio);
    set('prof-email-password', '');
    document.getElementById('prof-bio-count').textContent = (u.bio || '').length;
    document.getElementById('prof-remote').checked = !!u.remoteWanted;
    document.getElementById('prof-vehicle').checked = !!u.vehicle;
    profileQualifs = {
        licenses: Array.isArray(u.licenses) ? [...u.licenses] : (u.drivingLicense ? ['B'] : []),
        caces: Array.isArray(u.caces) ? [...u.caces] : [],
        habilitations: Array.isArray(u.habilitations) ? [...u.habilitations] : []
    };
    set('prof-other-certifs', (u.otherCertifs || []).join(', '));
    renderQualifs();
    document.getElementById('prof-email-password-box').classList.add('hidden');
    profileContracts = Array.isArray(u.desiredContracts) ? [...u.desiredContracts] : [];
    profileLanguages = Array.isArray(u.languages) ? u.languages.map(l => ({ ...l })) : [];
    renderContracts();
    renderLanguages();
    const sub = [u.headline, u.city].filter(Boolean).join(' · ');
    document.getElementById('profile-headline').textContent = sub;
    renderCompleteness();
    render2FA();
    const del = document.getElementById('delete-password');
    if (u.hasPassword === false) { del.type = 'text'; del.placeholder = 'Tapez SUPPRIMER pour confirmer'; del.autocomplete = 'off'; }
    else { del.type = 'password'; del.placeholder = 'Votre mot de passe pour confirmer'; del.autocomplete = 'current-password'; }
}

function renderContracts() {
    document.getElementById('prof-contracts').innerHTML = CONTRACT_CHOICES.map(c => {
        const on = profileContracts.includes(c);
        return `<button type="button" data-c="${c}" onclick="toggleContract(this.dataset.c)" class="px-3 py-1.5 rounded-full text-xs font-bold border transition ${on ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-white border-slate-200 text-slate-600 hover:border-emerald-300'}">${on ? '✓ ' : ''}${c}</button>`;
    }).join('');
}
function toggleContract(c) {
    profileContracts = profileContracts.includes(c) ? profileContracts.filter(x => x !== c) : [...profileContracts, c];
    renderContracts();
}

function renderLanguages() {
    document.getElementById('prof-languages').innerHTML = profileLanguages.map((l, i) => `
        <div class="flex gap-2">
            <input type="text" value="${esc(l.lang)}" placeholder="Langue (ex : Anglais)" oninput="profileLanguages[${i}].lang=this.value" class="field field-sm flex-1">
            <select onchange="profileLanguages[${i}].level=this.value" class="field field-sm !w-40">
                <option value="">Niveau</option>
                ${LANG_LEVELS.map(v => `<option ${v === l.level ? 'selected' : ''}>${v}</option>`).join('')}
            </select>
            <button type="button" onclick="profileLanguages.splice(${i},1); renderLanguages()" aria-label="Retirer" class="w-9 shrink-0 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50">✕</button>
        </div>`).join('') || '<p class="text-xs text-slate-400">Aucune langue ajoutée.</p>';
}
function addLanguage() { profileLanguages.push({ lang: '', level: '' }); renderLanguages(); }

// ---------- Permis, CACES & habilitations ----------
// [code, libellé, motif de détection dans le texte d'une offre]
const QUALIFS = {
    licenses: [
        ['AM', 'AM / BSR', /\b(permis am|bsr)\b/i], ['A1', 'A1', /\bpermis a1\b/i], ['A2', 'A2', /\bpermis a2\b/i], ['A', 'A (moto)', /\bpermis a\b(?![12])/i],
        ['B', 'B (voiture)', /\bpermis b\b(?!e)|\bpermis de conduire\b|\bpermis vl\b/i], ['BE', 'BE (remorque)', /\bpermis be\b/i],
        ['C1', 'C1', /\bpermis c1\b/i], ['C', 'C (poids lourd)', /\bpermis c\b(?![1e])|\bpermis pl\b|poids lourds?\b/i], ['CE', 'CE (super lourd)', /\bpermis c ?e\b|\bspl\b|super ?lourd/i],
        ['D', 'D (bus, car)', /\bpermis d\b|\bpermis transport en commun\b/i],
        ['FIMO', 'FIMO / FCO marchandises', /\bfimo\b|\bfco\b/i], ['FIMOV', 'FIMO / FCO voyageurs', /\bfimo voyageurs?\b/i], ['ADR', 'ADR (matières dangereuses)', /\badr\b|matières dangereuses/i]
    ],
    caces: [
        ['R489-1A', 'R489 cat. 1A (transpalette à conducteur porté)', /r\s?489[^.\n]{0,20}\b1a\b/i], ['R489-1B', 'R489 cat. 1B (gerbeur)', /r\s?489[^.\n]{0,20}\b1b\b/i],
        ['R489-3', 'R489 cat. 3 (chariot frontal)', /r\s?489[^.\n]{0,20}\b3\b|caces\s?3\b/i], ['R489-5', 'R489 cat. 5 (chariot à mât rétractable)', /r\s?489[^.\n]{0,20}\b5\b|caces\s?5\b/i],
        ['R485', 'R485 (gerbeur à conducteur accompagnant)', /r\s?485\b/i], ['R486', 'R486 (nacelle PEMP)', /r\s?486\b|nacelle|pemp/i],
        ['R482', 'R482 (engins de chantier)', /r\s?482\b|engins? de chantier/i], ['R490', 'R490 (grue auxiliaire)', /r\s?490\b|grue auxiliaire/i],
        ['R484', 'R484 (pont roulant)', /r\s?484\b|pont roulant/i], ['R487', 'R487 (grue à tour)', /r\s?487\b|grue à tour/i]
    ],
    habilitations: [
        ['B0H0', 'Habilitation électrique B0 / H0', /\bb0\b|\bh0v?\b/i], ['BS', 'Habilitation BS / BE manœuvre', /\bbs\b[^.\n]{0,20}habilit|habilit[^.\n]{0,30}\bbs\b|\bbe man/i],
        ['B1V', 'Habilitation B1V / B2V', /\bb[12]v\b/i], ['BR', 'Habilitation BR / BC', /\bbr\b[^.\n]{0,20}habilit|habilit[^.\n]{0,30}\b(br|bc)\b/i], ['H1V', 'Habilitation H1V / H2V', /\bh[12]v\b/i],
        ['SST', 'SST (sauveteur secouriste)', /\bsst\b|sauveteur secouriste/i], ['PSC1', 'PSC1', /\bpsc ?1\b/i], ['HAUTEUR', 'Travail en hauteur', /travail en hauteur|travaux en hauteur/i],
        ['AIPR', 'AIPR', /\baipr\b/i], ['HACCP', 'HACCP (hygiène alimentaire)', /\bhaccp\b/i], ['FEU', 'Permis feu', /permis feu/i], ['ATEX', 'ATEX', /\batex\b/i],
        ['SSIAP1', 'SSIAP 1', /\bssiap\b/i], ['CQPAPS', 'CQP APS / carte pro sécurité', /\bcqp aps\b|carte professionnelle|\bcnaps\b/i]
    ]
};
let profileQualifs = { licenses: [], caces: [], habilitations: [] };
const qualifLabel = (group, code) => ((QUALIFS[group] || []).find(q => q[0] === code) || [code, code])[1];

function renderQualifs() {
    const ids = { licenses: 'prof-licenses', caces: 'prof-caces', habilitations: 'prof-habilitations' };
    for (const g of Object.keys(ids)) {
        document.getElementById(ids[g]).innerHTML = QUALIFS[g].map(([code, label]) => {
            const on = profileQualifs[g].includes(code);
            return `<button type="button" aria-pressed="${on}" data-g="${g}" data-c="${code}" onclick="toggleQualif(this.dataset.g, this.dataset.c)" class="px-3 py-1.5 rounded-full text-xs font-bold border transition ${on ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-white border-slate-200 text-slate-600 hover:border-emerald-300'}">${on ? '✓ ' : ''}${esc(label)}</button>`;
        }).join('');
    }
}
function toggleQualif(g, c) {
    const list = profileQualifs[g];
    profileQualifs[g] = list.includes(c) ? list.filter(x => x !== c) : [...list, c];
    renderQualifs();
}
// Libellés lisibles de toutes les qualifications du profil (CV, IA)
function userQualifLabels(u = currentUser || {}) {
    const lic = Array.isArray(u.licenses) ? u.licenses : (u.drivingLicense ? ['B'] : []);
    return {
        licenses: lic.map(c => 'Permis ' + qualifLabel('licenses', c)),
        caces: (u.caces || []).map(c => 'CACES ' + qualifLabel('caces', c)),
        habilitations: [...(u.habilitations || []).map(c => qualifLabel('habilitations', c)), ...(u.otherCertifs || [])]
    };
}
// Exigences de l'offre (permis, CACES, habilitations) comparées au profil
function offerRequirements(j) {
    const text = `${j.title} ${j.fullDescription || j.description || ''}`;
    const u = currentUser || {};
    const have = { licenses: Array.isArray(u.licenses) ? u.licenses : (u.drivingLicense ? ['B'] : []), caces: u.caces || [], habilitations: u.habilitations || [] };
    const out = [];
    for (const g of Object.keys(QUALIFS)) {
        for (const [code, label, re] of QUALIFS[g]) {
            if (!re.test(text)) continue;
            // Un permis CE couvre le C, un C couvre le C1, etc.
            const covers = { C1: ['C', 'CE'], C: ['CE'], B: ['BE', 'C1', 'C', 'CE', 'D'] }[code] || [];
            out.push({ group: g, code, label: g === 'licenses' ? 'Permis ' + label : g === 'caces' ? 'CACES ' + label : label, ok: have[g].includes(code) || covers.some(c => have[g].includes(c)) });
        }
    }
    return out;
}

function checkEmailChange() {
    const changed = document.getElementById('prof-email').value.trim().toLowerCase() !== String(currentUser.email || '').toLowerCase();
    document.getElementById('prof-email-password-box').classList.toggle('hidden', !changed);
}

async function saveProfileInfo() {
    if (!requireLogin()) return;
    const v = (id) => document.getElementById(id).value.trim();
    const body = {
        firstName: v('prof-firstname'), lastName: v('prof-lastname'), gender: v('prof-gender'), birthDate: v('prof-birthdate'),
        newEmail: v('prof-email'), password: document.getElementById('prof-email-password').value, phone: v('prof-phone'),
        city: v('prof-city'), postalCode: v('prof-postal'), address: v('prof-address'),
        desiredJob: v('prof-desired-job'), desiredContracts: profileContracts, mobilityKm: v('prof-mobility'),
        availability: v('prof-availability'), salaryWanted: v('prof-salary'), remoteWanted: document.getElementById('prof-remote').checked,
        headline: v('prof-headline'), bio: v('prof-bio'), linkedin: v('prof-linkedin'), portfolio: v('prof-portfolio'),
        languages: profileLanguages.filter(l => (l.lang || '').trim()),
        vehicle: document.getElementById('prof-vehicle').checked,
        licenses: profileQualifs.licenses, caces: profileQualifs.caces, habilitations: profileQualifs.habilitations,
        otherCertifs: v('prof-other-certifs').split(',').map(s => s.trim()).filter(Boolean)
    };
    await withBusy(document.getElementById('save-info-btn'), async () => {
        const data = await api('/api/user/update', { json: body });
        if (data.success) {
            setSession(data.user);
            fillProfileInfo();
            document.getElementById('profile-name-title').innerText = `${data.user.firstName} ${data.user.lastName}`;
            showNotification('Informations enregistrées !');
        } else {
            if (data.needPassword) { document.getElementById('prof-email-password-box').classList.remove('hidden'); document.getElementById('prof-email-password').focus(); }
            showNotification(data.message, 'error');
        }
    });
}
// Ancien nom conservé
function updateBasicProfile() { return saveProfileInfo(); }

// Jauge « profil complété »
function renderCompleteness() {
    const u = currentUser || {};
    const checks = [
        [!!u.avatarUrl, 'Ajouter une photo', () => accessProfileView('cv')],
        [!!u.headline, 'Écrire un titre de profil', () => focusField('prof-headline')],
        [!!u.desiredJob, 'Indiquer le poste recherché', () => focusField('prof-desired-job')],
        [!!u.city, 'Indiquer votre ville', () => focusField('prof-city')],
        [(u.skills || []).length >= 3, 'Ajouter au moins 3 compétences', () => accessProfileView('cv')],
        [(u.experience || []).length >= 1, 'Ajouter une expérience', () => accessProfileView('cv')],
        [(u.education || []).length >= 1, 'Ajouter un diplôme', () => accessProfileView('cv')],
        [!!u.bio, 'Écrire quelques mots sur vous', () => focusField('prof-bio')],
        [(u.languages || []).length >= 1, 'Ajouter une langue', () => focusField('prof-languages')],
        [!!u.cvPdfUrl, 'Envoyer votre CV', () => accessProfileView('cv')]
    ];
    const done = checks.filter(c => c[0]).length;
    const pct = Math.round(done / checks.length * 100);
    window._completenessActions = checks.filter(c => !c[0]).map(c => c[2]);
    const missing = checks.filter(c => !c[0]).slice(0, 3);
    document.getElementById('profile-completeness').innerHTML = `
        <div class="flex items-center justify-between text-sm mb-2">
            <span class="font-bold text-slate-900">Profil complété à ${pct} %</span>
            <span class="text-xs text-slate-500">${pct === 100 ? 'Bravo, votre profil est complet 🎉' : 'Un profil complet donne de meilleurs scores et de meilleures lettres'}</span>
        </div>
        <div class="h-2.5 rounded-full bg-slate-100 overflow-hidden"><div class="h-full rounded-full transition-all duration-700" style="width:${pct}%; background: linear-gradient(90deg,rgb(var(--e-600)),rgb(var(--t-500)))"></div></div>
        ${missing.length ? `<div class="flex flex-wrap gap-2 mt-3">${missing.map((c, i) => `<button onclick="window._completenessActions[${i}]()" class="px-3 py-1.5 rounded-full bg-slate-100 hover:bg-emerald-50 text-xs font-semibold text-slate-600 hover:text-emerald-700 transition">+ ${c[1]}</button>`).join('')}</div>` : ''}`;
}
function focusField(id) {
    switchProfileTab('info');
    const el = document.getElementById(id);
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => el.focus && el.focus(), 400);
}

// ---------- Sécurité : mot de passe ----------
async function requestPasswordChange() {
    if (!requireLogin()) return;
    const body = {
        currentPassword: document.getElementById('pw-current').value,
        newPassword: document.getElementById('pw-new').value,
        confirmPassword: document.getElementById('pw-confirm').value
    };
    await withBusy(document.getElementById('pw-send-btn'), async () => {
        const data = await api('/api/user/request-password-change', { json: body });
        if (!data.success) return showNotification(data.message, 'error');
        showNotification(data.message);
        document.getElementById('pw-step1').classList.add('hidden');
        document.getElementById('pw-step2').classList.remove('hidden');
        document.getElementById('pw-code').focus();
    });
}
async function confirmPasswordChange() {
    const data = await api('/api/user/confirm-password-change', { json: { code: document.getElementById('pw-code').value.trim() } });
    if (!data.success) return showNotification(data.message, 'error');
    setSession(data.user);
    ['pw-current', 'pw-new', 'pw-confirm', 'pw-code'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('pw-step1').classList.remove('hidden');
    document.getElementById('pw-step2').classList.add('hidden');
    showNotification(data.message);
}

// ---------- Sécurité : double authentification ----------
function render2FA() {
    const box = document.getElementById('twofa-box');
    if (!box || !currentUser) return;
    if (currentUser.isTwoFactorEnabled) {
        box.innerHTML = `
            <p class="inline-flex items-center gap-2 text-sm font-bold text-emerald-700 bg-emerald-50 rounded-full px-3 py-1.5 mb-4">✓ Activée</p>
            <div class="flex flex-col sm:flex-row gap-2">
                <input type="password" id="twofa-disable-pw" placeholder="Mot de passe pour désactiver" autocomplete="current-password" class="field flex-1">
                <button onclick="disable2FA()" class="px-5 py-3 rounded-xl text-sm font-bold text-rose-600 border border-rose-200 hover:bg-rose-50">Désactiver</button>
            </div>
            <div class="mt-6">
                <p class="text-sm font-bold text-slate-800 mb-1">💻 Appareils enregistrés</p>
                <p class="text-xs text-slate-500 mb-3">Sur ces navigateurs, le code n’est pas redemandé pendant 30 jours. Retirez un appareil perdu ou que vous ne reconnaissez pas.</p>
                <div id="trusted-devices" class="text-sm text-slate-400">Chargement…</div>
            </div>`;
        loadTrustedDevices();
    } else {
        box.innerHTML = `
            <p class="inline-flex items-center gap-2 text-sm font-bold text-slate-600 bg-slate-100 rounded-full px-3 py-1.5 mb-4">Désactivée</p>
            <div><button onclick="setup2FA()" class="btn-primary px-5 py-3 rounded-xl text-sm font-bold">Activer la double authentification</button></div>
            <div id="twofa-setup"></div>`;
    }
}
async function loadTrustedDevices() {
    const box = document.getElementById('trusted-devices');
    if (!box) return;
    const d = await api('/api/user/devices', { silent: true });
    if (!d.success) { box.textContent = 'Liste indisponible pour le moment.'; return; }
    const day = (iso) => iso ? new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
    if (!d.devices.length) { box.innerHTML = '<p class="text-sm text-slate-500">Aucun appareil enregistré : le code est demandé à chaque connexion.</p>'; return; }
    box.innerHTML = `<ul class="space-y-2">${d.devices.map(x => `
        <li class="flex items-center gap-3 rounded-xl border border-slate-200 p-3">
            <span class="w-9 h-9 shrink-0 rounded-lg bg-slate-100 grid place-items-center">${/iPhone|Android|iPad/.test(x.label) ? '📱' : '💻'}</span>
            <div class="flex-1 min-w-0">
                <p class="font-semibold text-slate-800 truncate">${esc(x.label)}${x.current ? ' <span class="ml-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">cet appareil</span>' : ''}</p>
                <p class="text-xs text-slate-500">Ajouté le ${day(x.addedAt)} · utilisé le ${day(x.lastUsedAt)} · expire le ${day(x.expiresAt)}</p>
            </div>
            <button onclick="removeTrustedDevice('${esc(x.id)}')" class="shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold text-rose-600 hover:bg-rose-50">Retirer</button>
        </li>`).join('')}</ul>
        ${d.devices.length > 1 ? '<button onclick="removeTrustedDevice(null)" class="mt-3 text-xs font-bold text-rose-600 hover:underline">Retirer tous les appareils</button>' : ''}`;
}
async function removeTrustedDevice(id) {
    if (!id && !confirm('Retirer tous les appareils ? Le code sera redemandé partout, y compris ici.')) return;
    const d = await api('/api/user/devices/remove', { json: id ? { id } : { all: true } });
    showNotification(d.message || 'Erreur.', d.success ? 'success' : 'error');
    loadTrustedDevices();
}
async function setup2FA() {
    const data = await api('/api/user/2fa/setup', { method: 'POST' });
    if (!data.success) return showNotification(data.message, 'error');
    document.getElementById('twofa-setup').innerHTML = `
        <div class="mt-4 rounded-xl border border-slate-200 p-4 flex flex-col sm:flex-row gap-4 items-center view-enter">
            <img src="${data.qrCodeUrl}" alt="QR code" class="w-40 h-40 rounded-lg bg-white p-2 border border-slate-200">
            <div class="flex-1 w-full">
                <p class="text-sm text-slate-600 mb-1"><strong>1.</strong> Scannez ce QR code avec votre application d'authentification.</p>
                <p class="text-xs text-slate-400 mb-3 break-all">Ou saisissez la clé : <span class="font-mono">${esc(data.secret)}</span></p>
                <p class="text-sm text-slate-600 mb-2"><strong>2.</strong> Entrez le code à 6 chiffres affiché :</p>
                <div class="flex gap-2">
                    <input type="text" id="twofa-enable-code" maxlength="6" inputmode="numeric" placeholder="123456" class="field flex-1 text-center tracking-[.3em] font-mono font-bold">
                    <button onclick="enable2FA()" class="btn-primary px-5 rounded-xl text-sm font-bold">Activer</button>
                </div>
            </div>
        </div>`;
}
async function enable2FA() {
    const data = await api('/api/user/2fa/enable', { json: { token: document.getElementById('twofa-enable-code').value.trim() } });
    if (!data.success) return showNotification(data.message, 'error');
    setSession(data.user); render2FA(); showNotification(data.message);
}
async function disable2FA() {
    const data = await api('/api/user/2fa/disable', { json: { password: document.getElementById('twofa-disable-pw').value } });
    if (!data.success) return showNotification(data.message, 'error');
    setSession(data.user); render2FA(); showNotification(data.message);
}

// Champs du profil réutilisés par l'IA
function profileExtras() {
    const u = currentUser || {};
    const parts = [];
    if (u.headline) parts.push(`Titre : ${u.headline}`);
    if (u.city) parts.push(`Ville : ${u.city}`);
    if (u.bio) parts.push(`Présentation : ${u.bio}`);
    if ((u.languages || []).length) parts.push(`Langues : ${u.languages.map(l => l.level ? `${l.lang} (${l.level})` : l.lang).join(', ')}`);
    const q = userQualifLabels(u);
    const qAll = [...q.licenses, ...q.caces, ...q.habilitations];
    if (qAll.length) parts.push(`Permis et habilitations : ${qAll.join(', ')}${u.vehicle ? ', véhiculé(e)' : ''}`);
    else if (u.vehicle) parts.push('Véhiculé(e)');
    if (u.availability) parts.push(`Disponibilité : ${u.availability}`);
    return parts.length ? ' ' + parts.join('. ') + '.' : '';
}
