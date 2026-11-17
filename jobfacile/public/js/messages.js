// JobFacile · Messagerie candidat ↔ recruteur, compteur de messages non lus, menu « Plus » de l'en-tête.
// Script classique (pas un module) : les fonctions sont globales et appelées depuis les attributs onclick de index.html.

let conversations = [], openConvId = null, convTimer = null;
const CONV_STATUS = { applied: ['📨 Candidature reçue', 'bg-sky-50 text-sky-700'], interview: ['🗓️ Entretien', 'bg-amber-50 text-amber-700'], offer: ['🎉 Retenu(e)', 'bg-emerald-50 text-emerald-700'], rejected: ['✖️ Non retenu(e)', 'bg-slate-100 text-slate-600'] };

// ---------- Menu « Plus » (ordinateur) ----------
function toggleMoreMenu(e) {
    if (e) e.stopPropagation();
    const m = document.getElementById('more-menu');
    const open = m.classList.toggle('hidden') === false;
    document.getElementById('more-btn').setAttribute('aria-expanded', open);
    if (open) setTimeout(() => m.querySelector('button:not(.hidden)').focus(), 0);
}
function closeMoreMenu() {
    const m = document.getElementById('more-menu');
    if (!m || m.classList.contains('hidden')) return;
    m.classList.add('hidden');
    document.getElementById('more-btn').setAttribute('aria-expanded', 'false');
}
document.addEventListener('click', (e) => { if (!e.target.closest('#more-menu') && !e.target.closest('#more-btn')) closeMoreMenu(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMoreMenu(); });

// ---------- Compteur de messages non lus (en-tête) ----------
function updateMessagingUI() {
    const logged = !!(currentUser && authToken);
    document.getElementById('msg-btn').classList.toggle('hidden', !logged);
    document.getElementById('admin-menu-btn').classList.toggle('hidden', !(logged && currentUser.isAdmin));
}
async function pollUnread() {
    updateMessagingUI();
    if (!currentUser || !authToken || navigator.onLine === false) return;
    const d = await api('/api/messages/unread', { silent: true }).catch(() => null);
    const badge = document.getElementById('msg-badge');
    const n = d && d.success ? d.count : 0;
    badge.classList.toggle('hidden', !n);
    badge.textContent = n > 9 ? '9+' : String(n);
    document.getElementById('msg-btn').setAttribute('aria-label', n ? `Messages : ${n} non lu${n > 1 ? 's' : ''}` : 'Messages');
}
setInterval(() => { if (!document.hidden) pollUnread(); }, 60000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) pollUnread(); });
window.addEventListener('DOMContentLoaded', () => setTimeout(pollUnread, 1500));

// ---------- Liste des conversations ----------
async function openMessages(convId) {
    if (!requireLogin()) return;
    switchView('messages');
    if (convId && !routing) setUrl('/messages?c=' + encodeURIComponent(convId), true);
    await loadConversations();
    const target = convId || (window.innerWidth >= 768 && conversations[0] ? conversations[0].id : null);
    if (target) openConversation(target);
    else renderThreadEmpty();
    clearInterval(convTimer);
    convTimer = setInterval(() => {
        if (document.getElementById('view-messages').classList.contains('hidden')) { clearInterval(convTimer); return; }
        if (!document.hidden) { loadConversations(); if (openConvId) openConversation(openConvId, true); }
    }, 15000);
}
async function loadConversations() {
    const d = await api('/api/conversations');
    if (!d.success) return;
    conversations = d.conversations;
    const box = document.getElementById('conv-list');
    box.innerHTML = conversations.length ? conversations.map(c => `
        <button data-c="${esc(c.id)}" onclick="openConversation(this.dataset.c)" class="w-full text-left px-4 py-3 border-b border-slate-100 hover:bg-slate-50 ${c.id === openConvId ? 'bg-emerald-50' : ''}" aria-current="${c.id === openConvId}">
            <div class="flex items-center justify-between gap-2">
                <p class="font-bold text-sm text-slate-900 truncate">${esc(c.otherName)}</p>
                ${c.unread ? `<span class="shrink-0 rounded-full bg-rose-600 text-white text-[10px] font-bold px-2 py-0.5">${c.unread}</span>` : `<span class="shrink-0 text-[11px] text-slate-500">${new Date(c.lastMessageAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</span>`}
            </div>
            <p class="text-xs text-emerald-700 font-semibold truncate">${c.role === 'recruiter' ? '👥 Candidat · ' : ''}${esc(c.offerTitle)}</p>
            <p class="text-xs text-slate-500 truncate ${c.unread ? 'font-bold text-slate-800' : ''}">${esc(c.preview)}</p>
        </button>`).join('') : `<div class="p-6 text-sm text-slate-500"><p class="text-3xl mb-2">💬</p>Aucune conversation. Les échanges commencent quand vous postulez à une offre « Recrute sur JobFacile », ou quand un candidat postule à vos offres.</div>`;
    pollUnread();
}
function renderThreadEmpty() {
    document.getElementById('conv-thread').innerHTML = '<div class="m-auto text-center text-sm text-slate-500 p-8"><p class="text-4xl mb-2">✉️</p>Choisissez une conversation.</div>';
}

// ---------- Une conversation ----------
async function openConversation(id, silentRefresh = false) {
    const d = await api('/api/conversations/' + encodeURIComponent(id));
    const box = document.getElementById('conv-thread');
    if (!d.success) { if (!silentRefresh) showNotification(d.message, 'error'); return; }
    const scrolled = box.querySelector('#msg-list');
    const wasAtBottom = !scrolled || scrolled.scrollHeight - scrolled.scrollTop - scrolled.clientHeight < 60;
    const keepDraft = silentRefresh && document.getElementById('msg-input') ? document.getElementById('msg-input').value : '';
    if (silentRefresh && openConvId === id && scrolled && scrolled.dataset.count === String(d.messages.length)) return; // rien de nouveau
    openConvId = id;
    const c = d.conversation;
    const [stLabel, stCls] = CONV_STATUS[c.status] || CONV_STATUS.applied;
    const fmt = (iso) => new Date(iso).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    box.innerHTML = `
        <div class="px-4 py-3 border-b border-slate-100 flex flex-wrap items-center gap-2 justify-between">
            <div class="min-w-0">
                <button onclick="openConvId=null; document.getElementById('conv-thread').innerHTML=''; renderThreadEmpty()" class="md:hidden text-xs font-bold text-emerald-700 mb-1">← Conversations</button>
                <p class="font-bold text-slate-900 truncate">${esc(c.otherName)}</p>
                <p class="text-xs text-slate-500 truncate">${esc(c.offerTitle)}${c.company && c.role === 'candidate' ? ' · ' + esc(c.company) : ''} <span class="ml-1 font-bold rounded-full px-2 py-0.5 ${stCls}">${stLabel}</span></p>
            </div>
            ${c.role === 'recruiter' ? `<label class="text-xs text-slate-600 flex items-center gap-2">Statut :
                <select onchange="setCandidateStatus('${esc(c.id)}', this.value)" class="field !w-auto !py-1.5 !text-xs">${Object.entries(CONV_STATUS).map(([k, [l]]) => `<option value="${k}" ${k === c.status ? 'selected' : ''}>${l}</option>`).join('')}</select></label>`
              : `<button data-o="${esc(c.offerId)}" onclick="openSharedOffer(this.dataset.o)" class="text-xs font-bold text-emerald-700 underline">Voir l’offre</button>`}
        </div>
        <div id="msg-list" data-count="${d.messages.length}" class="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/60" aria-live="polite">
            ${d.messages.map(m => m.system
                ? `<div class="mx-auto max-w-[90%] rounded-2xl bg-white border border-slate-200 px-4 py-3 text-xs text-slate-600 whitespace-pre-line">${esc(m.body)}<p class="text-[10px] text-slate-400 mt-1">${fmt(m.at)}</p></div>`
                : `<div class="flex ${m.mine ? 'justify-end' : 'justify-start'}"><div class="max-w-[80%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-line ${m.mine ? 'bg-emerald-600 text-white rounded-br-md' : 'bg-white border border-slate-200 text-slate-800 rounded-bl-md'} ${m.hidden ? 'italic opacity-70' : ''}">${esc(m.body)}
                    <p class="text-[10px] mt-1 ${m.mine ? 'text-emerald-100' : 'text-slate-400'}">${fmt(m.at)}${!m.mine && !m.hidden ? ` · <button onclick="reportContent('message', '${m.id}')" class="underline">signaler</button>` : ''}</p></div></div>`).join('')}
        </div>
        ${c.otherExists ? `<form onsubmit="event.preventDefault(); sendMessage(this)" class="p-3 border-t border-slate-100 flex gap-2">
            <label for="msg-input" class="sr-only">Votre message</label>
            <textarea id="msg-input" rows="1" maxlength="3000" placeholder="Votre message…" onkeydown="if(event.key==='Enter' && !event.shiftKey){event.preventDefault(); this.form.requestSubmit();}" class="field flex-1 min-w-0 resize-none"></textarea>
            <button class="btn-primary px-5 rounded-xl text-sm font-bold">Envoyer</button>
        </form>
        <p class="px-4 pb-2 text-[10px] text-slate-500">Ne communiquez jamais vos coordonnées bancaires ni de copie de pièce d’identité avant la signature d’un contrat.</p>` : '<p class="p-4 text-sm text-slate-500 border-t border-slate-100">Cette personne a supprimé son compte.</p>'}`;
    const list = document.getElementById('msg-list');
    if (wasAtBottom || !silentRefresh) list.scrollTop = list.scrollHeight;
    if (keepDraft) document.getElementById('msg-input').value = keepDraft;
    if (!silentRefresh) { loadConversations(); if (window.innerWidth >= 768 && document.getElementById('msg-input')) document.getElementById('msg-input').focus(); }
}
async function sendMessage(form) {
    const input = document.getElementById('msg-input');
    const body = input.value.trim();
    if (!body) return;
    const btn = form.querySelector('button');
    await withBusy(btn, async () => {
        const d = await api(`/api/conversations/${encodeURIComponent(openConvId)}/messages`, { json: { body } });
        if (!d.success) return showNotification(d.message, 'error');
        input.value = '';
        await openConversation(openConvId);
    });
}
async function setCandidateStatus(id, status) {
    const d = await api(`/api/conversations/${encodeURIComponent(id)}/status`, { json: { status } });
    if (!d.success) return showNotification(d.message, 'error');
    showNotification('Statut mis à jour : le candidat est prévenu.');
    openConversation(id);
}
// Ouvrir l'offre liée à une conversation
async function openSharedOffer(id) {
    let j = jobsById.get(id);
    if (!j) { const d = await api('/api/jobs/offer/' + encodeURIComponent(id)); if (d.success) { j = d.job; jobsById.set(id, j); } }
    if (!j) return showNotification('Cette offre n’est plus en ligne.', 'error');
    openJobModal(id);
}
