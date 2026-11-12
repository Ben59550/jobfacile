// JobFacile · Communauté : forum d'entraide (sujets, réponses, votes « utile », signalements) et écran de modération.
// Script classique (pas un module) : les fonctions sont globales et appelées depuis les attributs onclick de index.html.

let forumCats = null, forumState = { cat: '', q: '', page: 1 }, currentTopic = null;
const ago = (iso) => {
    const m = Math.floor((Date.now() - new Date(iso)) / 60000);
    if (m < 1) return 'à l’instant'; if (m < 60) return `il y a ${m} min`;
    const h = Math.floor(m / 60); if (h < 24) return `il y a ${h} h`;
    const d = Math.floor(h / 24); return d < 30 ? `il y a ${d} j` : new Date(iso).toLocaleDateString('fr-FR');
};
async function categories() {
    if (!forumCats) { const d = await api('/api/forum/categories'); forumCats = d.success ? d.categories : {}; }
    return forumCats;
}

async function openCommunity(topicId) {
    if (document.getElementById('view-community').classList.contains('hidden')) switchView('community');
    if (topicId) return openTopic(topicId);
    currentTopic = null;
    if (!routing) setUrl('/communaute', true);
    const cats = await categories();
    const body = document.getElementById('community-body');
    body.innerHTML = `
        <div class="flex flex-wrap gap-2 mb-4" role="tablist" aria-label="Catégories">
            <button onclick="forumState.cat=''; forumState.page=1; loadTopics()" class="px-3 py-1.5 rounded-full text-xs font-bold border ${!forumState.cat ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-white border-slate-200 text-slate-600'}">Tout</button>
            ${Object.entries(cats).map(([k, l]) => `<button data-k="${k}" onclick="forumState.cat=this.dataset.k; forumState.page=1; loadTopics()" class="px-3 py-1.5 rounded-full text-xs font-bold border ${forumState.cat === k ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-white border-slate-200 text-slate-600'}">${l}</button>`).join('')}
        </div>
        <form onsubmit="event.preventDefault(); forumState.q=this.q.value.trim(); forumState.page=1; loadTopics()" class="flex gap-2 mb-5">
            <label for="forum-q" class="sr-only">Rechercher dans la communauté</label>
            <input id="forum-q" name="q" value="${esc(forumState.q)}" placeholder="Rechercher une discussion…" class="field flex-1">
            <button class="btn-ghost px-4 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-700">Rechercher</button>
        </form>
        <div id="topic-list"><div class="skeleton h-24 w-full rounded-2xl"></div></div>
        <p class="text-[11px] text-slate-500 mt-6">Charte : bienveillance, pas de publicité, pas de coordonnées personnelles (elles sont masquées automatiquement). Les messages sont vérifiés et peuvent être signalés.</p>`;
    loadTopics();
}
async function loadTopics() {
    if (!document.getElementById('topic-list')) return openCommunity();
    const p = new URLSearchParams({ page: forumState.page });
    if (forumState.cat) p.set('cat', forumState.cat);
    if (forumState.q) p.set('q', forumState.q);
    const d = await api('/api/forum/topics?' + p);
    const cats = await categories();
    // Boutons de catégorie à jour
    document.querySelectorAll('#community-body [role=tablist] button').forEach(b => {
        const on = (b.dataset.k || '') === forumState.cat;
        b.className = `px-3 py-1.5 rounded-full text-xs font-bold border ${on ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-white border-slate-200 text-slate-600'}`;
    });
    const box = document.getElementById('topic-list');
    if (!d.success) { box.innerHTML = '<p class="text-sm text-rose-600">Impossible de charger les discussions.</p>'; return; }
    box.innerHTML = d.topics.length ? `<div class="space-y-3">${d.topics.map(t => `
        <button data-id="${t.id}" onclick="openTopic(this.dataset.id)" class="w-full text-left card card-hover p-4">
            <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                    <p class="text-[11px] font-bold text-emerald-700">${cats[t.category] || ''}</p>
                    <p class="font-bold text-slate-900 leading-snug">${esc(t.title)}</p>
                    <p class="text-sm text-slate-500 line-clamp-2 mt-0.5">${esc(t.excerpt)}</p>
                    <p class="text-[11px] text-slate-500 mt-1.5">${esc(t.author)}${t.authorBadge ? ` · <span class="text-emerald-700 font-bold">${esc(t.authorBadge)}</span>` : ''} · ${ago(t.createdAt)}</p>
                </div>
                <div class="shrink-0 text-center text-xs text-slate-500"><p class="text-lg font-extrabold text-slate-900">${t.replies}</p>réponse${t.replies > 1 ? 's' : ''}${t.likes ? `<p class="mt-1">👍 ${t.likes}</p>` : ''}</div>
            </div>
        </button>`).join('')}</div>
        ${d.totalPages > 1 ? `<div class="flex justify-center items-center gap-3 mt-6">
            <button ${d.page <= 1 ? 'disabled' : ''} onclick="forumState.page--; loadTopics()" class="btn-ghost px-4 py-2 rounded-xl border border-slate-200 bg-white text-sm font-semibold disabled:opacity-40">← Précédent</button>
            <span class="text-sm text-slate-600">Page ${d.page} / ${d.totalPages}</span>
            <button ${d.page >= d.totalPages ? 'disabled' : ''} onclick="forumState.page++; loadTopics()" class="btn-ghost px-4 py-2 rounded-xl border border-slate-200 bg-white text-sm font-semibold disabled:opacity-40">Suivant →</button></div>` : ''}`
        : `<div class="card p-10 text-center text-sm text-slate-500"><p class="text-4xl mb-2">🌱</p>${forumState.q || forumState.cat ? 'Aucune discussion ne correspond.' : 'Aucune discussion pour l’instant : lancez la première !'}</div>`;
}

async function openTopic(id) {
    if (document.getElementById('view-community').classList.contains('hidden')) switchView('community');
    const d = await api('/api/forum/topics/' + encodeURIComponent(id));
    const body = document.getElementById('community-body');
    if (!d.success) { showNotification(d.message, 'error'); return openCommunity(); }
    currentTopic = d.topic;
    if (!routing) setUrl('/communaute?sujet=' + d.topic.id, true);
    const t = d.topic;
    const logged = currentUser && authToken;
    const msg = (kind, x) => `
        <article class="card p-5 ${x.hidden ? 'border-rose-200' : ''}" id="${kind}-${x.id}">
            <div class="flex items-center justify-between gap-2 mb-2">
                <p class="text-sm"><span class="font-bold text-slate-900">${esc(x.author)}</span>${x.authorBadge ? ` <span class="text-[11px] font-bold text-emerald-700 bg-emerald-50 rounded-full px-2 py-0.5">${esc(x.authorBadge)}</span>` : ''} <span class="text-xs text-slate-500">· ${ago(x.createdAt)}${x.editedAt ? ' · modifié' : ''}</span></p>
                ${x.hidden ? '<span class="text-[11px] font-bold text-rose-700">Masqué</span>' : ''}
            </div>
            <div class="text-sm text-slate-700 whitespace-pre-line leading-relaxed" data-body>${esc(x.body)}</div>
            <div class="flex flex-wrap items-center gap-3 mt-3 text-xs">
                <button onclick="likeForum('${kind}', ${x.id}, this)" ${!logged || x.mine ? 'disabled' : ''} aria-pressed="${x.liked}" class="px-2.5 py-1 rounded-full border ${x.liked ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-slate-200 text-slate-600'} font-bold">👍 Utile <span>${x.likes || ''}</span></button>
                ${x.mine ? `<button onclick="editForum('${kind}', ${x.id})" class="font-semibold text-slate-500 hover:text-emerald-700">Modifier</button>
                    <button onclick="deleteForum('${kind}', ${x.id})" class="font-semibold text-slate-500 hover:text-rose-600">Supprimer</button>`
                  : logged ? `<button onclick="reportContent('${kind}', '${x.id}')" class="font-semibold text-slate-500 hover:text-rose-600">🚩 Signaler</button>` : ''}
                ${d.admin ? `<button onclick="adminAction('${x.hidden ? 'restore' : 'hide'}', '${kind}', '${x.id}', () => openTopic(${t.id}))" class="font-bold text-rose-700">🛡️ ${x.hidden ? 'Réafficher' : 'Masquer'}</button>` : ''}
            </div>
        </article>`;
    body.innerHTML = `
        <button onclick="openCommunity()" class="text-sm font-bold text-emerald-700 mb-4">← Toutes les discussions</button>
        <p class="text-xs font-bold text-emerald-700">${d.categories[t.category] || ''}</p>
        <h3 class="text-2xl font-extrabold text-slate-900 mb-4">${esc(t.title)}</h3>
        <div class="space-y-3">${msg('topic', t)}${d.posts.map(p => msg('post', p)).join('')}</div>
        <div class="card p-5 mt-5">
            ${logged ? `<label for="reply-body" class="block font-bold text-slate-900 text-sm mb-2">Votre réponse</label>
                <textarea id="reply-body" rows="4" maxlength="4000" class="field leading-relaxed mb-3" placeholder="Partagez votre expérience, un conseil, un encouragement…"></textarea>
                <button onclick="replyTopic(this)" class="btn-primary px-5 py-2.5 rounded-xl text-sm font-bold">Répondre</button>`
              : `<p class="text-sm text-slate-600"><button onclick="afterLoginUrl=location.pathname+location.search; openAuthModal('login')" class="font-bold text-emerald-700 underline">Connectez-vous</button> pour répondre.</p>`}
        </div>`;
    window.scrollTo({ top: 0 });
}
async function replyTopic(btn) {
    const body = document.getElementById('reply-body').value.trim();
    if (!body) return;
    await withBusy(btn, async () => {
        const d = await api(`/api/forum/topics/${currentTopic.id}/posts`, { json: { body } });
        if (!d.success) return showNotification(d.message, 'error');
        await openTopic(currentTopic.id);
        const el = document.getElementById('post-' + d.id);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
}
async function likeForum(kind, id, btn) {
    const d = await api(`/api/forum/${kind}/${id}/like`, { json: {} });
    if (!d.success) return showNotification(d.message || 'Vote impossible.', 'error');
    btn.setAttribute('aria-pressed', d.liked);
    btn.className = `px-2.5 py-1 rounded-full border ${d.liked ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-slate-200 text-slate-600'} font-bold`;
    btn.querySelector('span').textContent = d.likes || '';
}
async function editForum(kind, id) {
    const el = document.querySelector(`#${kind}-${id} [data-body]`);
    const text = prompt('Modifier votre message :', el.textContent);
    if (text === null || !text.trim()) return;
    const d = await api(`/api/forum/${kind}/${id}/edit`, { json: { body: text, title: kind === 'topic' ? currentTopic.title : undefined } });
    if (!d.success) return showNotification(d.message, 'error');
    openTopic(currentTopic.id);
}
async function deleteForum(kind, id) {
    if (!confirm(kind === 'topic' ? 'Supprimer toute la discussion ?' : 'Supprimer votre réponse ?')) return;
    const d = await api(`/api/forum/${kind}/${id}/edit`, { json: { delete: true } });
    if (!d.success) return showNotification(d.message, 'error');
    showNotification('Supprimé.');
    if (kind === 'topic') openCommunity(); else openTopic(currentTopic.id);
}

// ---------- Nouvelle discussion ----------
async function openNewTopic() {
    if (!requireLogin()) return;
    const cats = await categories();
    switchView('community');
    document.getElementById('community-body').innerHTML = `
        <button onclick="openCommunity()" class="text-sm font-bold text-emerald-700 mb-4">← Toutes les discussions</button>
        <div class="card p-6">
            <h3 class="font-bold text-slate-900 text-lg mb-4">Nouvelle discussion</h3>
            <label for="nt-cat" class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Catégorie</label>
            <select id="nt-cat" class="field mb-3">${Object.entries(cats).map(([k, l]) => `<option value="${k}" ${k === forumState.cat ? 'selected' : ''}>${l}</option>`).join('')}</select>
            <label for="nt-title" class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Titre</label>
            <input id="nt-title" maxlength="140" class="field mb-3" placeholder="Ex : Comment parler d’un trou dans mon CV ?">
            <label for="nt-body" class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Message</label>
            <textarea id="nt-body" rows="7" maxlength="6000" class="field leading-relaxed mb-2" placeholder="Expliquez votre situation ou partagez votre conseil. Évitez les informations qui permettent de vous identifier."></textarea>
            <p class="text-[11px] text-slate-500 mb-4">Votre nom apparaîtra sous la forme « ${esc(`${currentUser.firstName || ''} ${(currentUser.lastName || '').charAt(0)}.`)} ». Téléphones et e-mails sont masqués automatiquement.</p>
            <button onclick="createTopic(this)" class="btn-primary px-6 py-3 rounded-xl text-sm font-bold">Publier</button>
        </div>`;
    document.getElementById('nt-title').focus();
}
async function createTopic(btn) {
    const v = (id) => document.getElementById(id).value.trim();
    await withBusy(btn, async () => {
        const d = await api('/api/forum/topics', { json: { category: v('nt-cat'), title: v('nt-title'), body: v('nt-body') } });
        if (!d.success) return showNotification(d.message, 'error');
        showNotification('Discussion publiée !');
        openTopic(d.id);
    });
}

// ---------- Modération (administrateurs : ADMIN_EMAILS dans .env) ----------
async function openAdmin() {
    if (!requireLogin()) return;
    switchView('admin');
    const box = document.getElementById('admin-body');
    if (!currentUser.isAdmin) { box.innerHTML = '<div class="card p-6 text-sm text-slate-600">Cette page est réservée aux administrateurs. Ajoutez votre adresse e-mail à <code>ADMIN_EMAILS</code> dans le fichier .env du serveur.</div>'; return; }
    box.innerHTML = '<div class="skeleton h-32 w-full rounded-2xl"></div>';
    const d = await api('/api/admin/queue');
    if (!d.success) { box.innerHTML = ''; return showNotification(d.message, 'error'); }
    const KIND = { offer: '🏢 Offre', topic: '💬 Discussion', post: '↩️ Réponse', message: '✉️ Message privé' };
    box.innerHTML = `
        <div id="admin-status" class="mb-8"></div>
        <h3 class="font-bold text-slate-900 mb-3">À traiter (${d.items.length})</h3>
        ${d.items.length ? `<div class="space-y-3">${d.items.map(it => `
            <article class="card p-5">
                <div class="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <p class="text-sm"><span class="font-bold">${KIND[it.kind]}</span> · ${esc(it.target.author)}${it.target.company ? ' (' + esc(it.target.company) + ')' : ''} · <span class="text-slate-500">${it.count ? it.count + ' signalement' + (it.count > 1 ? 's' : '') : 'vérification'}</span> · statut : <strong>${esc(it.target.status)}</strong></p>
                    ${it.target.link ? `<a href="${esc(it.target.link)}" onclick="event.preventDefault(); history.pushState({}, '', this.getAttribute('href')); route()" class="text-xs font-bold text-emerald-700 underline">Voir</a>` : ''}
                </div>
                <p class="font-bold text-slate-900 text-sm">${esc(it.target.title)}</p>
                <p class="text-sm text-slate-600 whitespace-pre-line max-h-40 overflow-y-auto mt-1 rounded-xl bg-slate-50 p-3">${esc(String(it.target.text).slice(0, 1500))}</p>
                ${it.reasons.length ? `<p class="text-xs text-rose-700 mt-2">Motifs : ${it.reasons.map(esc).join(' · ')}</p>` : ''}
                <div class="flex flex-wrap gap-2 mt-3">
                    <button onclick="adminAction('${it.kind === 'offer' ? 'restore' : 'restore'}', '${it.kind}', '${esc(it.id)}', openAdmin)" class="px-3 py-2 rounded-xl bg-emerald-50 text-emerald-700 text-xs font-bold">✓ ${it.kind === 'offer' ? 'Publier / garder' : 'Garder visible'}</button>
                    <button onclick="adminAction('hide', '${it.kind}', '${esc(it.id)}', openAdmin)" class="px-3 py-2 rounded-xl bg-rose-50 text-rose-700 text-xs font-bold">✖ ${it.kind === 'offer' ? 'Retirer l’offre' : 'Masquer'}</button>
                    <button onclick="if(confirm('Suspendre ce compte ? Tous ses contenus seront masqués.')) adminAction('ban', null, null, openAdmin, '${esc(it.target.authorId)}')" class="px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700">🚫 Suspendre l’auteur</button>
                </div>
            </article>`).join('')}</div>` : '<div class="card p-8 text-center text-sm text-slate-500">✅ Rien à traiter.</div>'}
        <h3 class="font-bold text-slate-900 mt-8 mb-3">Comptes suspendus (${d.banned.length})</h3>
        ${d.banned.length ? `<div class="space-y-2">${d.banned.map(u => `<div class="card p-3 flex items-center justify-between gap-2 text-sm"><span>${esc(u.name)} · <span class="text-slate-500">${esc(u.email)}</span></span><button onclick="adminAction('unban', null, null, openAdmin, '${esc(u.id)}')" class="text-xs font-bold text-emerald-700">Réactiver</button></div>`).join('')}</div>` : '<p class="text-sm text-slate-500">Aucun.</p>'}`;
    renderAdminStatus();
}

// État des services (détail réservé aux administrateurs)
async function renderAdminStatus(refresh = false) {
    const box = document.getElementById('admin-status');
    if (!box) return;
    box.innerHTML = '<div class="skeleton h-24 w-full rounded-2xl"></div>';
    const d = await api('/api/admin/status' + (refresh ? '?refresh=1' : ''));
    if (!d.success) { box.innerHTML = ''; return; }
    const ICON = { ok: '✅', warn: '⚠️', down: '❌', off: '⚪', unknown: '⏳' };
    box.innerHTML = `<div class="flex flex-wrap items-center justify-between gap-2 mb-3"><h3 class="font-bold text-slate-900">État des services</h3>
        <span class="text-xs text-slate-500">Vérifié ${new Date(d.checkedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} · <button onclick="renderAdminStatus(true)" class="font-bold text-emerald-700 underline">Vérifier maintenant</button> · <a href="/etat" target="_blank" class="underline">page publique</a></span></div>
        <div class="grid sm:grid-cols-2 gap-2">${Object.entries(d.services).map(([k, s]) => `<div class="card p-3 text-sm"><p class="font-bold text-slate-900">${ICON[s.state]} ${esc(d.labels[k][0])}</p><p class="text-xs text-slate-500 mt-0.5">${esc(s.detail)}</p></div>`).join('')}</div>`;
}
async function adminAction(action, kind, id, then, userId) {
    const d = await api('/api/admin/action', { json: { action, kind, id, userId } });
    if (!d.success) return showNotification(d.message || 'Action impossible.', 'error');
    showNotification('Fait.');
    if (typeof then === 'function') then();
}
