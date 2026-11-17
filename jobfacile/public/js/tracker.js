// JobFacile · Mon suivi : candidatures, statistiques par semaine, agenda des entretiens, export CSV, import LinkedIn.
// Script classique (pas un module) : les fonctions sont globales et appelées depuis les attributs onclick de index.html.
// Ordre de chargement : app-core → interview → job-detail → tracker → account → navigation → ui → search.

// ---------- Mon suivi ----------
function accessTracker(tab) {
    if (!requireLogin()) return;
    if (tab) currentTrackerTab = tab;
    switchView('tracker');
    renderTracker();
}
function switchTrackerTab(tab) {
    currentTrackerTab = tab;
    renderTracker();
    if (!routing) setUrl(urlForView('tracker'), true);
}
function renderTracker() {
    if (!currentUser) return;
    const apps = applications();
    const favs = favorites();
    apps.forEach(a => a.job && jobsById.set(a.id, a.job));
    favs.forEach(f => jobsById.set(f.id, f));

    const tabA = document.getElementById('tracker-tab-apps');
    const tabF = document.getElementById('tracker-tab-favs');
    tabA.className = currentTrackerTab === 'apps' ? TAB_ACTIVE : TAB_IDLE;
    tabF.className = currentTrackerTab === 'favs' ? TAB_ACTIVE : TAB_IDLE;
    tabA.innerHTML = `📋 Candidatures <span class="ml-1 text-xs opacity-70">${apps.length}</span>`;
    tabF.innerHTML = `❤️ Favoris <span class="ml-1 text-xs opacity-70">${favs.length}</span>`;
    const tabAl = document.getElementById('tracker-tab-alerts');
    tabAl.className = currentTrackerTab === 'alerts' ? TAB_ACTIVE : TAB_IDLE;
    tabAl.innerHTML = `🔔 Alertes <span class="ml-1 text-xs opacity-70">${(currentUser.alerts || []).length}</span>`;
    document.getElementById('tracker-alerts').classList.toggle('hidden', currentTrackerTab !== 'alerts');
    renderAlerts();
    document.getElementById('tracker-apps').classList.toggle('hidden', currentTrackerTab !== 'apps');
    document.getElementById('tracker-favs').classList.toggle('hidden', currentTrackerTab !== 'favs');
    const tabAg = document.getElementById('tracker-tab-agenda');
    const upcoming = apps.filter(a => a.interview && new Date(a.interview.at) >= new Date(Date.now() - 3 * 3600 * 1000));
    tabAg.className = currentTrackerTab === 'agenda' ? TAB_ACTIVE : TAB_IDLE;
    tabAg.innerHTML = `📅 Agenda <span class="ml-1 text-xs opacity-70">${upcoming.length}</span>`;
    document.getElementById('tracker-agenda').classList.toggle('hidden', currentTrackerTab !== 'agenda');
    renderAgenda(apps);
    const tabPr = document.getElementById('tracker-tab-progress');
    tabPr.className = currentTrackerTab === 'progress' ? TAB_ACTIVE : TAB_IDLE;
    tabPr.innerHTML = `🏆 Progression <span class="ml-1 text-xs opacity-70">${earnedBadges(currentUser).length}</span>`;
    document.getElementById('tracker-progress').classList.toggle('hidden', currentTrackerTab !== 'progress');
    if (currentTrackerTab === 'progress') renderProgress();

    const toFollow = apps.filter(a => a.status === 'applied' && daysSince(a.appliedAt) >= 7);
    const stat = (label, value, icon, cls) => `<div class="card p-4"><p class="text-xs font-semibold text-slate-500 flex items-center gap-1.5">${icon} ${label}</p><p class="text-2xl font-extrabold mt-1 ${cls}">${value}</p></div>`;
    document.getElementById('tracker-stats').innerHTML =
        stat('Suivies', apps.length, '📋', 'text-slate-900') +
        stat('Envoyées', apps.filter(a => a.status !== 'todo').length, '📨', 'text-sky-600') +
        stat('Entretiens', apps.filter(a => a.status === 'interview' || a.status === 'offer').length, '🗣️', 'text-amber-600') +
        stat('À relancer', toFollow.length, '⏰', toFollow.length ? 'text-rose-600' : 'text-slate-900');

    const emptyState = (icon, title, text) => `
        <div class="card p-12 text-center">
            <p class="text-5xl mb-4">${icon}</p>
            <p class="font-bold text-slate-900 text-lg mb-1">${title}</p>
            <p class="text-sm text-slate-500 mb-6">${text}</p>
            <button onclick="accessJobsView()" class="btn-primary px-6 py-3 rounded-xl font-bold text-sm">Trouver des offres</button>
        </div>`;

    renderWeeklyStats(apps);

    // Candidatures en colonnes
    const appsBox = document.getElementById('tracker-apps');
    if (!apps.length) {
        appsBox.innerHTML = emptyState('📋', 'Aucune candidature suivie', 'Ouvrez une offre et cliquez sur « Suivre » pour la retrouver ici.');
    } else {
        appsBox.innerHTML = `<div class="grid md:grid-cols-2 xl:grid-cols-5 gap-4 items-start">${STATUSES.map(s => {
            const list = apps.filter(a => a.status === s.key);
            return `
            <section class="rounded-3xl bg-slate-100/70 p-3">
                <h3 class="flex items-center gap-2 px-2 py-1 mb-2 text-sm font-bold text-slate-700"><span class="w-2.5 h-2.5 rounded-full ${s.dot}"></span>${s.label}<span class="ml-auto text-xs font-semibold text-slate-400">${list.length}</span></h3>
                <div class="space-y-3">${list.map(renderAppCard).join('') || '<p class="text-xs text-slate-400 px-2 py-4 text-center">Vide</p>'}</div>
            </section>`;
        }).join('')}</div>`;
    }

    // Favoris
    const favBox = document.getElementById('tracker-favs');
    favBox.innerHTML = favs.length
        ? `<div class="grid md:grid-cols-2 gap-4">${favs.map((f, i) => renderJobCard(f, i)).join('')}</div>`
        : emptyState('❤️', 'Aucun favori pour le moment', 'Cliquez sur le cœur d’une offre pour la garder ici.');
}

// ---------- Statistiques : candidatures envoyées par semaine ----------
function weekStart(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; } // lundi
function renderWeeklyStats(apps) {
    const box = document.getElementById('tracker-weekly');
    box.classList.toggle('hidden', currentTrackerTab !== 'apps');
    let closed = false; try { closed = localStorage.getItem('jf-stats-closed') === '1'; } catch (e) {}
    const sent = apps.filter(a => a.appliedAt && a.status !== 'todo');
    if (!sent.length) { box.innerHTML = ''; return; }
    const N = 10;
    const thisWeek = weekStart(new Date());
    const weeks = Array.from({ length: N }, (_, i) => { const d = new Date(thisWeek); d.setDate(d.getDate() - 7 * (N - 1 - i)); return { start: d, n: 0, interviews: 0 }; });
    for (const a of sent) {
        const i = Math.round((weekStart(a.appliedAt) - weeks[0].start) / (7 * 864e5));
        if (i >= 0 && i < N) { weeks[i].n++; if (['interview', 'offer'].includes(a.status)) weeks[i].interviews++; }
    }
    let goal = 5; try { goal = Math.max(1, Math.min(50, parseInt(localStorage.getItem('jf-weekly-goal')) || 5)); } catch (e) {}
    const max = Math.max(goal, ...weeks.map(w => w.n), 1);
    const total = weeks.reduce((s, w) => s + w.n, 0);
    const active = weeks.filter(w => w.n).length;
    const avg = (total / N).toFixed(1).replace('.', ',');
    const answered = sent.filter(a => ['interview', 'offer'].includes(a.status)).length;
    const rate = Math.round(answered / sent.length * 100);
    let streak = 0; for (let i = N - 2; i >= 0 && weeks[i].n > 0; i--) streak++; if (weeks[N - 1].n > 0) streak++;
    const fmt = (d) => d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
    const cur = weeks[N - 1].n;
    box.innerHTML = `
        <details class="card p-5" ${closed ? '' : 'open'} ontoggle="try{localStorage.setItem('jf-stats-closed', this.open ? '0' : '1')}catch(e){}">
            <summary class="flex flex-wrap items-center justify-between gap-2 cursor-pointer list-none">
                <span class="font-bold text-slate-900">📊 Mes candidatures par semaine</span>
                <span class="text-xs text-slate-500">${cur >= goal ? '🎯 Objectif de la semaine atteint !' : `Cette semaine : ${cur} / ${goal}`}</span>
            </summary>
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 my-4">
                <div class="rounded-xl bg-slate-50 px-3 py-2"><p class="text-[11px] font-semibold text-slate-500">Moyenne / semaine</p><p class="text-xl font-extrabold text-slate-900">${avg}</p></div>
                <div class="rounded-xl bg-slate-50 px-3 py-2"><p class="text-[11px] font-semibold text-slate-500">Semaines actives</p><p class="text-xl font-extrabold text-slate-900">${active} / ${N}</p></div>
                <div class="rounded-xl bg-slate-50 px-3 py-2"><p class="text-[11px] font-semibold text-slate-500">Taux de réponse positive</p><p class="text-xl font-extrabold text-slate-900">${rate} %</p></div>
                <div class="rounded-xl bg-slate-50 px-3 py-2"><p class="text-[11px] font-semibold text-slate-500">Semaines d'affilée</p><p class="text-xl font-extrabold text-slate-900">${streak}</p></div>
            </div>
            <div class="relative h-40 flex items-end gap-1.5 sm:gap-3 border-b border-slate-200 pt-4" role="img" aria-label="Candidatures envoyées sur les ${N} dernières semaines : ${weeks.map(w => w.n).join(', ')}">
                <div class="absolute left-0 right-0 border-t border-dashed border-slate-300 pointer-events-none" style="bottom:${goal / max * 100}%"><span class="absolute right-0 -top-4 text-[10px] font-semibold text-slate-500">objectif ${goal}</span></div>
                ${weeks.map((w, i) => `
                <div class="group relative flex-1 h-full flex flex-col justify-end items-center" tabindex="0" aria-label="Semaine du ${fmt(w.start)} : ${w.n} candidature${w.n > 1 ? 's' : ''}">
                    ${w.n ? `<span class="text-[11px] font-bold text-slate-700 mb-0.5">${w.n}</span>` : ''}
                    <div class="w-full max-w-[38px] rounded-t ${i === N - 1 ? 'bg-emerald-600' : 'bg-emerald-300'}" style="height:${w.n / max * 100}%; min-height:${w.n ? 4 : 0}px"></div>
                    <div class="hidden group-hover:block group-focus:block absolute bottom-full mb-1 z-10 whitespace-nowrap rounded-lg bg-slate-900 text-white text-[11px] px-2 py-1">Sem. du ${fmt(w.start)} · ${w.n} envoyée${w.n > 1 ? 's' : ''}${w.interviews ? ` · ${w.interviews} entretien${w.interviews > 1 ? 's' : ''}` : ''}</div>
                </div>`).join('')}
            </div>
            <div class="flex gap-1.5 sm:gap-3 mt-1">${weeks.map((w, i) => `<span class="flex-1 text-center text-[10px] text-slate-500">${i === N - 1 ? 'Cette sem.' : i % 2 === (N - 1) % 2 ? fmt(w.start) : ''}</span>`).join('')}</div>
            <div class="flex flex-wrap items-center gap-2 mt-4 text-xs text-slate-600">
                <label for="weekly-goal">Mon objectif :</label>
                <select id="weekly-goal" onchange="try{localStorage.setItem('jf-weekly-goal', this.value)}catch(e){}; renderWeeklyStats(applications())" class="field !w-auto !py-1 !text-xs">${[2, 3, 5, 8, 10, 15].map(g => `<option ${g === goal ? 'selected' : ''} value="${g}">${g} candidatures / semaine</option>`).join('')}</select>
                <span class="text-slate-500">Comptées à la date « postulé ».</span>
            </div>
        </details>`;
}

function renderAppCard(a) {
    const j = a.job || {};
    const s = statusOf(a.status);
    const d = daysSince(a.appliedAt);
    const lastFu = daysSince((a.followUps || [])[0]);
    const relance = a.status === 'applied' && d >= 7 && (lastFu === null || lastFu >= 7);
    return `
        <article class="bg-white rounded-2xl border ${relance ? 'border-rose-200' : 'border-slate-200'} p-4 shadow-sm">
            <button data-job-id="${esc(a.id)}" onclick="openJobModal(this.dataset.jobId)" class="text-left w-full">
                <p class="font-bold text-slate-900 text-sm leading-snug hover:text-emerald-700">${esc(j.title)}</p>
                <p class="text-xs text-slate-500 mt-0.5 truncate">${esc(j.company)} · ${esc(j.location)}</p>
            </button>
            ${a.appliedAt && a.status !== 'todo' ? `<p class="text-[11px] text-slate-400 mt-2">Postulé ${d === 0 ? "aujourd'hui" : d === 1 ? 'hier' : `il y a ${d} jours`}</p>` : ''}
            ${relance ? `<p class="mt-2 text-[11px] font-bold text-rose-600 bg-rose-50 rounded-lg px-2 py-1">⏰ Pas de réponse depuis ${d} jours : pensez à relancer</p>` : ''}
            ${lastFu !== null ? `<p class="text-[11px] text-slate-400 mt-1">✉️ Relancé ${lastFu === 0 ? "aujourd'hui" : lastFu === 1 ? 'hier' : `il y a ${lastFu} jours`}${a.followUps.length > 1 ? ` (${a.followUps.length} fois)` : ''}</p>` : ''}
            ${['applied', 'interview'].includes(a.status) ? `<button data-app-id="${esc(a.id)}" data-kind="${a.status === 'interview' ? 'thanks' : 'relance'}" onclick="openFollowUp(this.dataset.appId, this.dataset.kind)" class="mt-2 w-full text-xs font-bold rounded-lg px-2 py-1.5 ${relance ? 'bg-rose-600 text-white hover:bg-rose-700' : 'bg-violet-50 text-violet-700 hover:bg-violet-100'}">✉️ ${a.status === 'interview' ? 'E-mail de remerciement IA' : 'E-mail de relance IA'}</button>` : ''}
            ${a.interview ? `<button data-app-id="${esc(a.id)}" onclick="openInterviewPlanner(this.dataset.appId)" class="mt-2 w-full text-left text-[11px] font-bold rounded-lg px-2 py-1.5 bg-amber-50 text-amber-800 hover:bg-amber-100">📅 ${esc(fmtInterview(a.interview))}</button>`
                : ['applied', 'interview'].includes(a.status) ? `<button data-app-id="${esc(a.id)}" onclick="openInterviewPlanner(this.dataset.appId)" class="mt-2 w-full text-xs font-semibold rounded-lg px-2 py-1.5 text-slate-500 hover:bg-slate-100">📅 Planifier un entretien</button>` : ''}
            <select data-app-id="${esc(a.id)}" onchange="updateApplication(this.dataset.appId, { status: this.value })" class="mt-3 w-full text-xs font-semibold rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 outline-none focus:border-emerald-400">
                ${STATUSES.map(x => `<option value="${x.key}" ${x.key === a.status ? 'selected' : ''}>${x.icon} ${x.label}</option>`).join('')}
            </select>
            <details class="mt-2 group">
                <summary class="text-[11px] font-semibold text-slate-500 cursor-pointer hover:text-emerald-600 list-none">📝 Notes${a.notes ? ' ✓' : ''}</summary>
                <textarea data-app-id="${esc(a.id)}" rows="3" placeholder="Contact, date d'entretien, questions…" onchange="updateApplication(this.dataset.appId, { notes: this.value })" class="mt-2 w-full text-xs rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 outline-none focus:border-emerald-400">${esc(a.notes)}</textarea>
            </details>
            <div class="flex justify-between items-center mt-2">
                ${j.url ? `<a href="${esc(j.url)}" target="_blank" rel="noopener" class="text-[11px] font-semibold text-emerald-600 hover:underline">Voir l'annonce ↗</a>` : '<span></span>'}
                <button data-app-id="${esc(a.id)}" onclick="if(confirm('Retirer cette candidature du suivi ?')) updateApplication(this.dataset.appId, { remove: true })" class="text-[11px] font-semibold text-slate-400 hover:text-rose-600">Retirer</button>
            </div>
        </article>`;
}

// ---------- Agenda des entretiens ----------
const IV_KINDS = { onsite: '🏢 Sur place', video: '💻 Visio', phone: '📞 Téléphone' };
let ivAppId = null;
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }
function fmtInterview(iv) {
    const d = new Date(iv.at);
    return d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' }) + ' à ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) + ' · ' + (IV_KINDS[iv.kind] || '');
}
function openInterviewPlanner(id) {
    const a = appFor(id);
    if (!a) return;
    ivAppId = id;
    const iv = a.interview || {};
    document.getElementById('iv-sub').textContent = `${(a.job || {}).title || ''} · ${(a.job || {}).company || ''}`;
    const def = new Date(Date.now() + 2 * 864e5); def.setHours(10, 0, 0, 0);
    const local = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    document.getElementById('iv-at').value = iv.at || local(def);
    document.getElementById('iv-duration').value = String(iv.duration || 60);
    document.getElementById('iv-kind').value = iv.kind || 'onsite';
    document.getElementById('iv-place').value = iv.place || '';
    document.getElementById('iv-contact').value = iv.contact || '';
    updateIvCalendarLinks();
    document.getElementById('iv-modal').classList.remove('hidden');
}
function updateIvCalendarLinks() {
    const a = appFor(ivAppId);
    const has = !!(a && a.interview);
    document.getElementById('iv-cal').classList.toggle('hidden', !has);
    if (has) document.getElementById('iv-google').href = googleCalendarUrl(a);
}
async function saveInterview() {
    const interview = {
        at: document.getElementById('iv-at').value, duration: document.getElementById('iv-duration').value,
        kind: document.getElementById('iv-kind').value, place: document.getElementById('iv-place').value.trim(), contact: document.getElementById('iv-contact').value.trim()
    };
    if (!interview.at) return showNotification('Choisissez la date et l’heure.', 'error');
    await withBusy(document.getElementById('iv-save'), async () => {
        const d = await api('/api/user/applications', { json: { id: ivAppId, interview } });
        if (!d.success) return showNotification(d.message, 'error');
        setSession(d.user);
        refreshJobViews();
        updateIvCalendarLinks();
        showNotification('Entretien enregistré 📅 Ajoutez-le à votre agenda.');
    });
}
async function removeInterview() {
    const d = await api('/api/user/applications', { json: { id: ivAppId, interview: null } });
    if (!d.success) return showNotification(d.message, 'error');
    setSession(d.user); refreshJobViews(); closeModal('iv-modal');
    showNotification('Entretien retiré de l’agenda');
}
// Dates pour les calendriers : heure locale → UTC (format 20261112T090000Z)
const icsDate = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
function ivTimes(a) { const start = new Date(a.interview.at); return [start, new Date(start.getTime() + (a.interview.duration || 60) * 60000)]; }
function ivText(a) {
    const j = a.job || {}, iv = a.interview;
    return {
        title: `Entretien : ${j.title || 'poste'}${j.company ? ' – ' + j.company : ''}`,
        details: [IV_KINDS[iv.kind], iv.contact ? 'Interlocuteur : ' + iv.contact : '', j.url ? 'Offre : ' + j.url : '', 'Préparez-vous avec le simulateur JobFacile : ' + location.origin + '/entretien'].filter(Boolean).join('\n'),
        place: iv.place || ''
    };
}
function googleCalendarUrl(a) {
    const [s, e] = ivTimes(a), t = ivText(a);
    return 'https://calendar.google.com/calendar/render?' + new URLSearchParams({ action: 'TEMPLATE', text: t.title, dates: icsDate(s) + '/' + icsDate(e), details: t.details, location: t.place });
}
function downloadIcs(ids) {
    const esc_ = (v) => String(v).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
    const events = ids.map(appFor).filter(a => a && a.interview).map(a => {
        const [s, e] = ivTimes(a), t = ivText(a);
        return ['BEGIN:VEVENT', `UID:${a.id.replace(/[^\w-]/g, '')}-${icsDate(s)}@jobfacile`, `DTSTAMP:${icsDate(new Date())}`, `DTSTART:${icsDate(s)}`, `DTEND:${icsDate(e)}`,
            `SUMMARY:${esc_(t.title)}`, `DESCRIPTION:${esc_(t.details)}`, t.place ? `LOCATION:${esc_(t.place)}` : '',
            'BEGIN:VALARM', 'TRIGGER:-PT2H', 'ACTION:DISPLAY', 'DESCRIPTION:Entretien dans 2 heures', 'END:VALARM', 'END:VEVENT'].filter(Boolean).join('\r\n');
    });
    if (!events.length) return showNotification('Aucun entretien à exporter.', 'error');
    const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//JobFacile//Agenda//FR', 'CALSCALE:GREGORIAN', ...events, 'END:VCALENDAR'].join('\r\n');
    const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url; link.download = events.length > 1 ? 'entretiens-jobfacile.ics' : 'entretien.ics';
    document.body.appendChild(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function renderAgenda(apps) {
    const box = document.getElementById('tracker-agenda');
    const list = apps.filter(a => a.interview).sort((x, y) => new Date(x.interview.at) - new Date(y.interview.at));
    const now = Date.now() - 3 * 3600 * 1000;
    const upcoming = list.filter(a => new Date(a.interview.at) >= now), past = list.filter(a => new Date(a.interview.at) < now).reverse();
    const toPlan = apps.filter(a => a.status === 'interview' && !a.interview);
    const item = (a, isPast) => {
        const d = new Date(a.interview.at);
        const days = Math.round((new Date(d.toDateString()) - new Date(new Date().toDateString())) / 864e5);
        const when = days === 0 ? "Aujourd'hui" : days === 1 ? 'Demain' : days > 1 && days < 7 ? `Dans ${days} jours` : '';
        return `
        <article class="card p-4 flex gap-4 items-start ${isPast ? 'opacity-60' : ''}">
            <div class="w-14 shrink-0 rounded-xl bg-amber-50 text-center py-2"><p class="text-[11px] font-bold text-amber-700 uppercase">${d.toLocaleDateString('fr-FR', { month: 'short' })}</p><p class="text-xl font-extrabold text-slate-900 leading-none">${d.getDate()}</p></div>
            <div class="min-w-0 flex-1">
                <p class="text-xs font-bold text-amber-700">${when ? when + ' · ' : ''}${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} · ${IV_KINDS[a.interview.kind] || ''}</p>
                <p class="font-bold text-slate-900 leading-snug">${esc((a.job || {}).title)}</p>
                <p class="text-sm text-slate-500 truncate">${esc((a.job || {}).company)}${a.interview.contact ? ' · ' + esc(a.interview.contact) : ''}</p>
                ${a.interview.place ? `<p class="text-xs text-slate-500 mt-1 truncate">📍 ${esc(a.interview.place)}</p>` : ''}
                <div class="flex flex-wrap gap-2 mt-2">
                    <button data-id="${esc(a.id)}" onclick="openInterviewPlanner(this.dataset.id)" class="text-xs font-bold text-slate-600 hover:text-emerald-700">✏️ Modifier</button>
                    ${isPast ? '' : `<button data-id="${esc(a.id)}" onclick="downloadIcs([this.dataset.id])" class="text-xs font-bold text-slate-600 hover:text-emerald-700">📥 .ics</button>
                    <a href="${googleCalendarUrl(a)}" target="_blank" rel="noopener" class="text-xs font-bold text-slate-600 hover:text-emerald-700">Google Agenda ↗</a>
                    <button onclick="document.getElementById('chat-target-job').value = ${esc(JSON.stringify((a.job || {}).title || ''))}; switchView('ai-assistant'); resetChat();" class="text-xs font-bold text-emerald-700">🎤 M'entraîner</button>`}
                </div>
            </div>
        </article>`;
    };
    box.innerHTML = `
        <div class="flex flex-wrap items-center justify-between gap-2 mb-4">
            <p class="text-sm text-slate-500">${upcoming.length ? `${upcoming.length} entretien${upcoming.length > 1 ? 's' : ''} à venir` : 'Aucun entretien à venir.'}</p>
            ${upcoming.length ? `<button onclick="downloadIcs(${esc(JSON.stringify(upcoming.map(a => a.id)))})" class="btn-ghost px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700">📥 Tout ajouter à mon agenda (.ics)</button>` : ''}
        </div>
        ${toPlan.length ? `<div class="rounded-2xl bg-amber-50 border border-amber-200 p-3 mb-4 text-sm text-amber-900">🗓️ ${toPlan.length} candidature${toPlan.length > 1 ? 's' : ''} en « Entretien » sans date : ${toPlan.map(a => `<button data-id="${esc(a.id)}" onclick="openInterviewPlanner(this.dataset.id)" class="underline font-bold mr-2">${esc((a.job || {}).company || (a.job || {}).title)}</button>`).join('')}</div>` : ''}
        <div class="grid md:grid-cols-2 gap-3">${upcoming.map(a => item(a, false)).join('')}</div>
        ${past.length ? `<h3 class="font-bold text-slate-500 text-sm mt-8 mb-3">Passés</h3><div class="grid md:grid-cols-2 gap-3">${past.map(a => item(a, true)).join('')}</div>` : ''}
        ${!list.length && !toPlan.length ? '<div class="card p-10 text-center text-sm text-slate-500"><p class="text-4xl mb-3">📅</p>Planifiez un entretien depuis une candidature (bouton « Planifier un entretien ») pour le retrouver ici et l’ajouter à votre agenda.</div>' : ''}`;
}

// ---------- Export CSV du suivi ----------
function exportTrackerCsv() {
    if (!requireLogin()) return;
    const apps = applications();
    if (!apps.length) return showNotification('Aucune candidature à exporter.', 'error');
    const d = (iso) => iso ? new Date(iso).toLocaleDateString('fr-FR') : '';
    const cell = (v) => { const t = String(v ?? '').replace(/\r?\n/g, ' '); return /[";]/.test(t) || /^[=+\-@]/.test(t) ? '"' + (/^[=+\-@]/.test(t) ? "'" : '') + t.replace(/"/g, '""') + '"' : t; };
    const head = ['Statut', 'Poste', 'Entreprise', 'Lieu', 'Contrat', 'Salaire', 'Source', 'Lien', 'Ajoutée le', 'Postulé le', 'Dernière relance', 'Entretien', 'Notes'];
    const rows = apps.map(a => {
        const j = a.job || {};
        return [statusOf(a.status).label, j.title, j.company, j.location, j.type, j.salary, j.source, j.url, d(a.createdAt), d(a.appliedAt), d((a.followUps || [])[0]),
            a.interview ? new Date(a.interview.at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : '', a.notes];
    });
    // Point-virgule + BOM : s'ouvre directement dans Excel en français
    const csv = '\uFEFF' + [head, ...rows].map(r => r.map(cell).join(';')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url; link.download = `suivi-candidatures-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showNotification(`${apps.length} candidature${apps.length > 1 ? 's' : ''} exportée${apps.length > 1 ? 's' : ''}`);
}

// ---------- Import LinkedIn ----------
function openLinkedinImport() {
    if (!requireLogin()) return;
    document.getElementById('li-files').value = '';
    document.getElementById('li-files-label').textContent = 'Choisir le ZIP ou les CSV';
    document.getElementById('li-preview').innerHTML = '';
    document.getElementById('li-modal').classList.remove('hidden');
}
function linkedinForm(mode) {
    const fd = new FormData();
    for (const f of document.getElementById('li-files').files) fd.append('files', f);
    fd.append('mode', mode);
    return fd;
}
async function previewLinkedin() {
    const files = document.getElementById('li-files').files;
    if (!files.length) return;
    document.getElementById('li-files-label').textContent = [...files].map(f => f.name).join(', ');
    const box = document.getElementById('li-preview');
    box.innerHTML = '<div class="skeleton h-10 w-full rounded-xl"></div>';
    const d = await api('/api/user/import-linkedin', { method: 'POST', body: linkedinForm('preview') });
    if (!d.success) { box.innerHTML = ''; return showNotification(d.message, 'error'); }
    const s = d.summary, total = s.applications + s.experience + s.education + s.skills;
    const line = (n, label) => n ? `<li>✓ <strong>${n}</strong> ${label}</li>` : '';
    box.innerHTML = total ? `
        <div class="rounded-2xl bg-emerald-50 border border-emerald-200 p-4">
            <p class="font-bold text-slate-900 text-sm mb-2">Nouveaux éléments trouvés :</p>
            <ul class="text-sm text-slate-700 space-y-1">${line(s.applications, 'candidature(s) → ajoutées au suivi en « Postulé »')}${line(s.experience, 'expérience(s) → profil')}${line(s.education, 'formation(s) → profil')}${line(s.skills, 'compétence(s) → profil')}</ul>
            <button onclick="applyLinkedin()" id="li-apply" class="btn-primary w-full mt-3 py-2.5 rounded-xl text-sm font-bold">Importer</button>
        </div>` : '<p class="text-sm text-slate-500">Tout est déjà dans JobFacile : rien de nouveau à importer.</p>';
}
async function applyLinkedin() {
    await withBusy(document.getElementById('li-apply'), async () => {
        const d = await api('/api/user/import-linkedin', { method: 'POST', body: linkedinForm('apply') });
        if (!d.success) return showNotification(d.message, 'error');
        setSession(d.user);
        closeModal('li-modal');
        refreshJobViews();
        showNotification('Import LinkedIn terminé ✓');
    });
}
