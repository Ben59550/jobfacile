// JobFacile · Espace recruteur : vérification de l'entreprise, publication des offres, candidatures reçues.
// Côté candidat : candidature à une offre JobFacile et signalement.
// Script classique (pas un module) : les fonctions sont globales et appelées depuis les attributs onclick de index.html.

const REC_CONTRACTS = ['CDI', 'CDD', 'Intérim', 'Alternance', 'Stage', 'Saisonnier', 'Freelance'];
const OFFER_STATUS = {
    active: ['En ligne', 'bg-emerald-50 text-emerald-700'], review: ['En vérification', 'bg-amber-50 text-amber-700'],
    hidden: ['Masquée (signalements)', 'bg-rose-50 text-rose-700'], closed: ['Fermée', 'bg-slate-100 text-slate-600'], removed: ['Retirée', 'bg-slate-100 text-slate-500']
};
let recruiterData = null, editingOffer = null;

async function openRecruiter() {
    switchView('recruiter');
    const body = document.getElementById('recruiter-body');
    if (!currentUser || !authToken) {
        body.innerHTML = `<div class="grid md:grid-cols-3 gap-4 mb-6">
            ${[['✅', 'Gratuit et vérifié', 'Votre entreprise est vérifiée avec son SIRET dans l’annuaire officiel : les candidats vous font confiance.'],
               ['📍', 'Des candidats près de chez vous', 'Vos offres apparaissent en tête des recherches autour de votre établissement.'],
               ['💬', 'Échangez directement', 'Recevez les candidatures avec le profil du candidat et répondez depuis la messagerie.']]
            .map(([i, t, d]) => `<div class="card p-5"><p class="text-3xl mb-2">${i}</p><p class="font-bold text-slate-900">${t}</p><p class="text-sm text-slate-500 mt-1">${d}</p></div>`).join('')}</div>
            <div class="card p-6 text-center"><p class="font-bold text-slate-900 mb-3">Connectez-vous ou créez un compte pour publier une offre.</p>
            <button onclick="afterLoginUrl='/recruteur'; openAuthModal('register')" class="btn-primary px-6 py-3 rounded-xl font-bold text-sm">Créer mon compte recruteur</button></div>`;
        return;
    }
    body.innerHTML = '<div class="skeleton h-40 w-full rounded-2xl"></div>';
    recruiterData = await api('/api/recruiter/offers');
    if (!recruiterData.success) { body.innerHTML = ''; return showNotification(recruiterData.message, 'error'); }
    renderRecruiter();
}

function renderRecruiter() {
    const body = document.getElementById('recruiter-body');
    const rec = recruiterData.recruiter;
    if (!rec || !rec.verifiedAt) {
        body.innerHTML = `
            <div class="card p-6 max-w-xl">
                <h3 class="font-bold text-slate-900 text-lg mb-1">1. Vérifions votre entreprise</h3>
                <p class="text-sm text-slate-500 mb-4">Saisissez le SIRET de votre établissement (14 chiffres). JobFacile vérifie dans l’annuaire officiel des entreprises qu’il est bien actif, et affiche son nom et son adresse sur vos offres.</p>
                <label for="rec-siret" class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">SIRET de l’établissement</label>
                <input id="rec-siret" inputmode="numeric" maxlength="17" placeholder="Ex : 329 925 010 07041" class="field mb-3">
                <label for="rec-contact" class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Votre nom et fonction (visible des candidats)</label>
                <input id="rec-contact" maxlength="100" value="${esc(`${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim())}" class="field mb-4">
                <button onclick="verifyCompany(this)" class="btn-primary w-full py-3 rounded-xl font-bold text-sm">Vérifier mon entreprise</button>
                <p class="text-[11px] text-slate-500 mt-3">En publiant, vous vous engagez à proposer de vraies offres, sans frais pour les candidats et sans discrimination (Code du travail, art. L1132-1).</p>
            </div>`;
        return;
    }
    const offers = recruiterData.offers || [];
    body.innerHTML = `
        <div class="card p-5 mb-6 flex flex-wrap items-center justify-between gap-4">
            <div class="flex items-center gap-4">
                <span class="w-12 h-12 rounded-2xl bg-emerald-100 grid place-items-center text-2xl">🏢</span>
                <div><p class="font-bold text-slate-900">${esc(rec.company)} <span class="text-xs font-bold text-emerald-700 bg-emerald-50 rounded-full px-2 py-0.5 ml-1">✓ Vérifiée</span></p>
                <p class="text-sm text-slate-500">${esc(rec.address)} · SIRET ${esc(rec.siret)}</p></div>
            </div>
            <div class="flex gap-2">
                <button onclick="openMessages()" class="btn-ghost px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-700">💬 Messages</button>
                <button onclick="openOfferForm()" class="btn-primary px-4 py-2.5 rounded-xl text-sm font-bold">+ Publier une offre</button>
            </div>
        </div>
        <div id="offer-form-box"></div>
        <h3 class="font-bold text-slate-900 mb-3">Mes offres (${offers.length})</h3>
        ${offers.length ? `<div class="space-y-3">${offers.map(o => {
            const [label, cls] = OFFER_STATUS[o.status] || [o.status, 'bg-slate-100'];
            const days = Math.max(0, Math.ceil((new Date(o.expiresAt) - Date.now()) / 864e5));
            return `<article class="card p-4 flex flex-wrap items-center gap-4">
                <div class="min-w-0 flex-1">
                    <p class="font-bold text-slate-900">${esc(o.offer.title)} <span class="text-xs font-bold rounded-full px-2 py-0.5 ${cls}">${label}</span></p>
                    <p class="text-sm text-slate-500">${esc(o.offer.type)} · ${esc(o.offer.location)}${o.offer.salary ? ' · ' + esc(o.offer.salary) : ''}${o.status === 'active' ? ` · expire dans ${days} j` : ''}</p>
                </div>
                <div class="flex gap-4 text-center text-xs text-slate-500">
                    <div><p class="text-lg font-extrabold text-slate-900">${o.views}</p>vues</div>
                    <div><p class="text-lg font-extrabold text-slate-900">${o.candidates}</p>candidat${o.candidates > 1 ? 's' : ''}</div>
                    ${o.unread ? `<div><p class="text-lg font-extrabold text-rose-600">${o.unread}</p>non lu${o.unread > 1 ? 's' : ''}</div>` : ''}
                </div>
                <div class="flex flex-wrap gap-2">
                    ${o.candidates ? `<button data-id="${esc(o.id)}" onclick="showCandidates(this.dataset.id)" class="px-3 py-2 rounded-xl bg-emerald-50 text-emerald-700 text-xs font-bold">👥 Candidats</button>` : ''}
                    <button data-id="${esc(o.id)}" onclick="openOfferForm(this.dataset.id)" class="px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700">✏️ Modifier</button>
                    ${o.status === 'active' ? `<button data-id="${esc(o.id)}" onclick="setOfferStatus(this.dataset.id, 'closed')" class="px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700">Fermer</button>` : ''}
                    ${o.status === 'closed' ? `<button data-id="${esc(o.id)}" onclick="setOfferStatus(this.dataset.id, 'active')" class="px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700">Republier 60 j</button>` : ''}
                    <button data-id="${esc(o.id)}" onclick="if(confirm('Retirer définitivement cette offre ?')) setOfferStatus(this.dataset.id, 'removed')" class="px-3 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-rose-600">Retirer</button>
                </div>
                <div id="cands-${esc(o.id)}" class="w-full"></div>
            </article>`;
        }).join('')}</div>` : '<div class="card p-8 text-center text-sm text-slate-500">Aucune offre pour le moment. Publiez la première : elle est gratuite et visible 60 jours.</div>'}`;
}

async function verifyCompany(btn) {
    await withBusy(btn, async () => {
        const d = await api('/api/recruiter/verify', { json: { siret: document.getElementById('rec-siret').value, contactName: document.getElementById('rec-contact').value } });
        if (!d.success) return showNotification(d.message, 'error');
        setSession(d.user);
        showNotification(`Entreprise vérifiée : ${d.recruiter.company} ✓`);
        openRecruiter();
    });
}

function openOfferForm(id) {
    const o = id ? (recruiterData.offers.find(x => x.id === id) || {}).offer : null;
    editingOffer = id || null;
    const rec = recruiterData.recruiter;
    const desc = o ? String(o.fullDescription).split('\n\nProfil recherché : ')[0] : '';
    const reqs = o ? (String(o.fullDescription).split('\n\nProfil recherché : ')[1] || '') : '';
    document.getElementById('offer-form-box').innerHTML = `
        <div class="card p-6 mb-6">
            <h3 class="font-bold text-slate-900 text-lg mb-4">${o ? 'Modifier l’offre' : 'Nouvelle offre'}</h3>
            <div class="grid sm:grid-cols-2 gap-3">
                <div class="sm:col-span-2"><label for="of-title" class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Intitulé du poste</label><input id="of-title" maxlength="120" class="field" placeholder="Ex : Cariste H/F" value="${esc(o ? o.title : '')}"></div>
                <div><label for="of-contract" class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Contrat</label><select id="of-contract" class="field">${REC_CONTRACTS.map(c => `<option ${o && o.type === c ? 'selected' : ''}>${c}</option>`).join('')}</select></div>
                <div><label for="of-city" class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Ville du poste</label><input id="of-city" class="field" list="city-suggestions" oninput="suggestCities(this.value)" value="${esc(o ? o.location.replace(/\s*\(\d+\)$/, '') : rec.city)}"></div>
                <div><label for="of-salary" class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Salaire</label><input id="of-salary" maxlength="80" class="field" placeholder="Ex : 1 900 € brut / mois" value="${esc(o ? o.salary : '')}"></div>
                <div><label for="of-hours" class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Horaires / durée</label><input id="of-hours" maxlength="80" class="field" placeholder="Ex : 35 h, journée" value="${esc(o ? o.duration : '')}"></div>
                <div class="sm:col-span-2"><label for="of-desc" class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Description du poste et de l’entreprise</label><textarea id="of-desc" rows="7" maxlength="6000" class="field leading-relaxed" placeholder="Missions, environnement de travail, avantages…">${esc(desc)}</textarea></div>
                <div class="sm:col-span-2"><label for="of-reqs" class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Profil recherché (facultatif)</label><textarea id="of-reqs" rows="3" maxlength="600" class="field" placeholder="Ex : CACES R489 cat. 3, permis B, débutant accepté">${esc(reqs)}</textarea></div>
                <label class="flex items-center gap-2 text-sm font-semibold text-slate-700"><input type="checkbox" id="of-remote" ${o && o.remote ? 'checked' : ''} class="accent-emerald-600 w-4 h-4"> Télétravail possible</label>
            </div>
            <div class="flex gap-2 mt-5">
                <button onclick="saveOffer(this)" class="btn-primary px-6 py-3 rounded-xl text-sm font-bold">${o ? 'Enregistrer' : 'Publier l’offre'}</button>
                <button onclick="document.getElementById('offer-form-box').innerHTML=''" class="btn-ghost px-5 py-3 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-700">Annuler</button>
            </div>
            <p class="text-[11px] text-slate-500 mt-3">Chaque offre est vérifiée automatiquement avant publication (arnaques, discriminations). Elle reste en ligne 60 jours.</p>
        </div>`;
    document.getElementById('of-title').focus();
}
async function saveOffer(btn) {
    const v = (id) => document.getElementById(id).value.trim();
    await withBusy(btn, async () => {
        const d = await api('/api/recruiter/offers', { json: { id: editingOffer, title: v('of-title'), contract: v('of-contract'), city: v('of-city'), salary: v('of-salary'), hours: v('of-hours'), description: v('of-desc'), requirements: v('of-reqs'), remote: document.getElementById('of-remote').checked } });
        if (!d.success) return showNotification(d.message, 'error');
        showNotification(d.message, d.status === 'active' ? 'success' : 'error');
        openRecruiter();
    });
}
async function setOfferStatus(id, status) {
    const d = await api(`/api/recruiter/offers/${encodeURIComponent(id)}/status`, { json: { status } });
    if (!d.success) return showNotification(d.message, 'error');
    showNotification({ closed: 'Offre fermée', active: 'Offre republiée pour 60 jours', removed: 'Offre retirée' }[status]);
    openRecruiter();
}
async function showCandidates(id) {
    const box = document.getElementById('cands-' + id);
    if (box.innerHTML) { box.innerHTML = ''; return; }
    const d = await api(`/api/recruiter/offers/${encodeURIComponent(id)}/candidates`);
    if (!d.success) return showNotification(d.message, 'error');
    const ST = { applied: '📨 Reçue', interview: '🗓️ Entretien', offer: '🎉 Retenu(e)', rejected: '✖️ Non retenu(e)' };
    box.innerHTML = `<div class="mt-2 border-t border-slate-100 pt-3 space-y-2">${d.candidates.map(c => `
        <button data-c="${esc(c.conversationId)}" onclick="openMessages(this.dataset.c)" class="w-full flex items-center justify-between gap-3 rounded-xl bg-slate-50 hover:bg-emerald-50 px-3 py-2 text-left">
            <span class="font-semibold text-sm text-slate-800">${esc(c.name)}</span>
            <span class="text-xs text-slate-500">${ST[c.status] || ''} ${c.unread ? `<span class="ml-2 rounded-full bg-rose-600 text-white px-2 py-0.5 font-bold">${c.unread}</span>` : ''}</span>
        </button>`).join('')}</div>`;
}

// ---------- Candidat : postuler à une offre JobFacile ----------
function openApplyForm(id) {
    if (!requireLogin()) return;
    const j = jobsById.get(id);
    if (!j) return;
    const box = document.getElementById('apply-prompt');
    const hasCv = !!(currentUser && currentUser.cvPdfUrl);
    box.innerHTML = `
        <div class="bubble-in mb-5 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4">
            <p class="font-bold text-slate-900 text-sm mb-1">📨 Postuler auprès de ${esc(j.company)}</p>
            <p class="text-xs text-slate-600 mb-3">Le recruteur recevra votre message et un résumé de votre profil (titre, compétences, expériences, permis). Il vous répondra dans vos messages.</p>
            <textarea id="apply-msg" rows="5" maxlength="3000" class="field leading-relaxed mb-2" placeholder="Bonjour, votre offre m’intéresse car…"></textarea>
            <button onclick="draftApplyMessage(this)" class="text-xs font-bold text-emerald-700 underline mb-3">✨ Proposer un message avec l’IA</button>
            <label class="flex items-center gap-2 text-xs text-slate-700 mb-1"><input type="checkbox" id="apply-contact" class="accent-emerald-600"> Partager mon e-mail et mon téléphone</label>
            <label class="flex items-center gap-2 text-xs text-slate-700 mb-3 ${hasCv ? '' : 'opacity-50'}"><input type="checkbox" id="apply-cv" ${hasCv ? 'checked' : 'disabled'} class="accent-emerald-600"> Joindre mon CV PDF${hasCv ? '' : ' (ajoutez-le dans votre profil)'}</label>
            <button onclick="sendApplication(this, '${esc(id)}')" class="btn-primary w-full py-3 rounded-xl text-sm font-bold">Envoyer ma candidature</button>
        </div>`;
    document.getElementById('job-modal-body').scrollTop = 0;
    document.getElementById('apply-msg').focus();
}
async function draftApplyMessage(btn) {
    const j = jobsById.get(openJobId);
    await withBusy(btn, async () => {
        const d = await api('/api/ai/generate', { json: { prompt: `Rédige un message de candidature court (5 à 7 lignes) pour l'offre « ${j.title} » chez ${j.company}. Annonce : ${(j.fullDescription || '').slice(0, 1200)}. Candidat : ${currentUser.firstName}. ${profileExtras()} Compétences : ${(currentUser.skills || []).join(', ')}. Pas d'objet, commence par « Bonjour, », termine par le prénom du candidat. N'invente aucune expérience.` } });
        if (!d.success) return showNotification(d.message, 'error');
        document.getElementById('apply-msg').value = d.text.trim();
    });
}
async function sendApplication(btn, id) {
    await withBusy(btn, async () => {
        const d = await api(`/api/local-offers/${encodeURIComponent(id)}/apply`, { json: { message: document.getElementById('apply-msg').value, shareContact: document.getElementById('apply-contact').checked, shareCv: document.getElementById('apply-cv').checked } });
        if (!d.success) {
            if (d.conversationId) { closeJobModal(true); openMessages(d.conversationId); }
            return showNotification(d.message, 'error');
        }
        setSession(d.user);
        refreshJobViews(); // redessine la fiche (bouton « Voir l’échange ») avant d’afficher la confirmation
        showNotification(d.message);
        document.getElementById('apply-prompt').innerHTML = `<div class="mb-5 rounded-2xl bg-emerald-50 border border-emerald-200 p-4 text-sm text-emerald-800 font-semibold">✓ ${esc(d.message)} <button onclick="closeJobModal(true); openMessages('${esc(d.conversationId)}')" class="underline ml-1">Voir l’échange</button></div>`;
        pollUnread();
    });
}
async function reportContent(kind, id) {
    if (!requireLogin()) return;
    const reason = prompt('Pourquoi signalez-vous ce contenu ? (arnaque, propos déplacés, fausse offre…)');
    if (reason === null) return;
    const d = await api('/api/reports', { json: { kind, id, reason } });
    showNotification(d.message || 'Signalement envoyé.', d.success ? 'success' : 'error');
}
