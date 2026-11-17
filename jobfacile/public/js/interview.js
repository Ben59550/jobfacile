// JobFacile · Simulateur d’entretien : courbe de progression, mode vocal, conversation.
// Script classique (pas un module) : les fonctions sont globales et appelées depuis les attributs onclick de index.html.
// Ordre de chargement : app-core → interview → job-detail → tracker → account → navigation → ui → search.

// ---------- Progression aux entretiens : courbe des notes ----------
function renderInterviewProgress() {
    const box = document.getElementById('interview-progress');
    if (!box) return;
    const hist = ((currentUser && currentUser.interviewHistory) || []).slice(0, 20).reverse(); // plus ancien → plus récent
    if (!currentUser || !authToken || !hist.length) { box.innerHTML = ''; return; }
    const dark = document.documentElement.classList.contains('dark');
    const ink = brandColor(dark ? 400 : 600), grid = dark ? '#1e293b' : '#e2e8f0', muted = dark ? '#94a3b8' : '#64748b', surface = dark ? '#0f172a' : '#ffffff';
    const W = 640, H = 220, L = 34, R = 16, T = 16, B = 30;
    const x = (i) => hist.length === 1 ? (L + W - R) / 2 : L + i * (W - L - R) / (hist.length - 1);
    const y = (v) => T + (100 - v) * (H - T - B) / 100;
    const pts = hist.map((e, i) => [x(i), y(e.score)]);
    const path = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
    const date = (iso) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
    const first = hist[0].score, last = hist[hist.length - 1].score, best = Math.max(...hist.map(e => e.score));
    const avg3 = Math.round(hist.slice(-3).reduce((a, e) => a + e.score, 0) / Math.min(3, hist.length));
    const delta = last - first;
    const stat = (label, value, sub = '') => `<div class="rounded-xl bg-slate-50 px-3 py-2"><p class="text-[11px] font-semibold text-slate-500">${label}</p><p class="text-xl font-extrabold text-slate-900">${value}${sub}</p></div>`;
    box.innerHTML = `
        <div class="card p-5 sm:p-6">
            <div class="flex flex-wrap items-baseline justify-between gap-2 mb-4">
                <h3 class="font-bold text-slate-900">📈 Ma progression aux entretiens</h3>
                <span class="text-xs text-slate-500">${hist.length} bilan${hist.length > 1 ? 's' : ''} · note sur 100</span>
            </div>
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
                ${stat('Dernière note', last)}${stat('Meilleure note', best)}${stat('Moyenne (3 derniers)', avg3)}
                ${stat('Depuis le début', (delta > 0 ? '+' : '') + delta, ' pts')}
            </div>
            ${hist.length > 1 ? `
            <div class="relative" id="ip-chart">
                <svg viewBox="0 0 ${W} ${H}" class="w-full h-auto" role="img" aria-label="Évolution des notes d'entretien, de ${first} à ${last} sur 100">
                    ${[0, 50, 100].map(v => `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="${grid}" stroke-width="1"/><text x="${L - 8}" y="${y(v) + 4}" text-anchor="end" font-size="11" fill="${muted}">${v}</text>`).join('')}
                    <path d="${path}" fill="none" stroke="${ink}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
                    ${pts.map((p, i) => `<circle cx="${p[0]}" cy="${p[1]}" r="4.5" fill="${ink}" stroke="${surface}" stroke-width="2"/>`).join('')}
                    ${[0, hist.length - 1].map(i => `<text x="${x(i)}" y="${H - 8}" text-anchor="${i ? 'end' : 'start'}" font-size="11" fill="${muted}">${date(hist[i].at)}</text>`).join('')}
                    <text x="${pts[pts.length - 1][0] - 8}" y="${pts[pts.length - 1][1] - 10}" text-anchor="end" font-size="12" font-weight="700" fill="${dark ? '#e2e8f0' : '#0f172a'}">${last}</text>
                    ${pts.map((p, i) => `<rect class="ip-hit" data-i="${i}" x="${p[0] - (W - L - R) / Math.max(1, hist.length - 1) / 2}" y="${T}" width="${(W - L - R) / Math.max(1, hist.length - 1)}" height="${H - T - B}" fill="transparent"/>`).join('')}
                </svg>
                <div id="ip-tip" class="hidden absolute pointer-events-none z-10 rounded-xl bg-slate-900 text-white text-xs px-3 py-2 shadow-lg max-w-[240px]"></div>
            </div>` : '<p class="text-sm text-slate-500">Faites un deuxième entretien pour voir votre courbe de progression.</p>'}
            <details class="mt-3">
                <summary class="text-xs font-semibold text-slate-500 cursor-pointer hover:text-emerald-600">Voir l'historique en tableau</summary>
                <table class="w-full text-sm mt-2"><thead><tr class="text-left text-xs text-slate-500"><th class="py-1">Date</th><th>Poste</th><th class="text-right">Note</th></tr></thead>
                <tbody>${[...hist].reverse().map(e => `<tr class="border-t border-slate-100"><td class="py-1.5 whitespace-nowrap">${date(e.at)}</td><td class="text-slate-600">${esc(e.job || 'Entretien général')}</td><td class="text-right font-bold">${e.score}</td></tr>`).join('')}</tbody></table>
            </details>
        </div>`;
    // Infobulle au survol / au toucher
    const chart = document.getElementById('ip-chart');
    if (!chart) return;
    const tip = document.getElementById('ip-tip');
    chart.querySelectorAll('.ip-hit').forEach(r => {
        const show = () => {
            const e = hist[+r.dataset.i];
            tip.innerHTML = `<p class="font-bold">${e.score}/100 · ${new Date(e.at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}</p><p class="opacity-80">${esc(e.job || 'Entretien général')}</p>${(e.improvements || [])[0] ? `<p class="mt-1 opacity-80">À travailler : ${esc(e.improvements[0])}</p>` : ''}`;
            const svg = chart.querySelector('svg').getBoundingClientRect();
            const px = pts[+r.dataset.i][0] / W * svg.width, py = pts[+r.dataset.i][1] / H * svg.height;
            tip.style.left = Math.min(Math.max(0, px - 120), svg.width - 240) + 'px';
            tip.style.top = Math.max(0, py - 70) + 'px';
            tip.classList.remove('hidden');
        };
        r.addEventListener('mouseenter', show);
        r.addEventListener('click', show);
        r.addEventListener('mouseleave', () => tip.classList.add('hidden'));
    });
}

// ---------- Entretien vocal : micro + voix du recruteur ----------
// Micro : votre réponse est enregistrée, puis transcrite par le serveur (Whisper). Fonctionne dans tous les navigateurs récents.
// Voix : naturelle (ElevenLabs) si le serveur est configuré, sinon voix du navigateur.
const canRecord = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);
let voiceMode = false, listening = false, transcribing = false;
let mediaRecorder = null, micStream = null, audioCtx = null, levelTimer = null, recChunks = [];
let voiceCfg = null, currentAudio = null, speakToken = 0;
async function voiceConfig() {
    if (!voiceCfg) voiceCfg = await api('/api/voice/config').catch(() => ({})) || {};
    return voiceCfg;
}
function voiceStatus(text, color = 'bg-sky-500') {
    const bar = document.getElementById('voice-status');
    if (!bar) return;
    bar.classList.toggle('hidden', !text);
    document.getElementById('voice-status-text').textContent = text || '';
    document.getElementById('voice-dot').className = 'w-2 h-2 rounded-full ' + color;
}
function frenchVoice() {
    const voices = window.speechSynthesis ? speechSynthesis.getVoices() : [];
    return voices.find(v => /^fr(-|_)FR/i.test(v.lang) && /natural|google|neural|online/i.test(v.name))
        || voices.find(v => /^fr(-|_)FR/i.test(v.lang)) || voices.find(v => /^fr/i.test(v.lang)) || null;
}
if (window.speechSynthesis) speechSynthesis.onvoiceschanged = () => {};
const cleanForSpeech = (text) => String(text).replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, '').replace(/[•*#_]/g, ' ');

// Quand le recruteur a fini de parler : en mode vocal, le micro s'ouvre tout seul
function afterSpeech(token) {
    if (token !== speakToken) return;
    voiceStatus('');
    if (voiceMode && canRecord) setTimeout(() => { if (voiceMode && token === speakToken && !listening && !transcribing) startMic(); }, 350);
}
async function speak(text) {
    if (!voiceMode) return;
    stopSpeaking();
    const token = ++speakToken;
    const cfg = await voiceConfig();
    if (cfg.naturalVoice) {
        voiceStatus('🔊 Le recruteur prépare sa réponse…');
        try {
            const res = await api('/api/ai/tts', { json: { text: cleanForSpeech(text) }, raw: true });
            if (token !== speakToken) return;
            if (res && res.ok) {
                const url = URL.createObjectURL(await res.blob());
                if (token !== speakToken) { URL.revokeObjectURL(url); return; }
                currentAudio = new Audio(url);
                currentAudio.onplay = () => voiceStatus('🔊 Le recruteur parle… (cliquez sur 🎤 pour l’interrompre)');
                currentAudio.onended = () => { URL.revokeObjectURL(url); currentAudio = null; afterSpeech(token); };
                currentAudio.onerror = () => { URL.revokeObjectURL(url); currentAudio = null; browserSpeak(text, token); };
                await currentAudio.play();
                return;
            }
        } catch (e) { if (token !== speakToken) return; }
    }
    browserSpeak(text, token);
}
// Secours : voix intégrée au navigateur
function browserSpeak(text, token) {
    if (token !== speakToken) return;
    if (!window.speechSynthesis) { afterSpeech(token); return; }
    const u = new SpeechSynthesisUtterance(cleanForSpeech(text));
    u.lang = 'fr-FR';
    const v = frenchVoice();
    if (v) u.voice = v;
    u.rate = 1.02;
    u.onstart = () => voiceStatus('🔊 Le recruteur parle… (cliquez sur 🎤 pour l’interrompre)');
    u.onend = () => afterSpeech(token);
    speechSynthesis.speak(u);
}
function stopSpeaking() {
    speakToken++;
    if (currentAudio) { try { currentAudio.pause(); } catch (e) {} currentAudio = null; }
    if (window.speechSynthesis && speechSynthesis.speaking) speechSynthesis.cancel();
}
async function toggleVoiceMode() {
    voiceMode = !voiceMode;
    const b = document.getElementById('voice-toggle');
    b.setAttribute('aria-pressed', voiceMode);
    b.className = voiceMode
        ? 'text-xs font-bold text-white bg-emerald-600 px-3 py-1.5 rounded-lg transition'
        : 'text-xs font-semibold text-slate-500 hover:text-emerald-600 px-3 py-1.5 rounded-lg hover:bg-emerald-50 transition';
    if (voiceMode) {
        if (!canRecord) showNotification('Le recruteur parlera, mais ce navigateur ne permet pas d’utiliser le micro : répondez au clavier.');
        const last = [...chatHistory].reverse().find(m => m.role === 'assistant');
        if (last) speak(last.content);
    } else { stopSpeaking(); stopMic(true); voiceStatus(''); }
}

// ---------- Micro : enregistrement, fin de phrase détectée par le silence ----------
function pickMime() {
    for (const t of ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus']) if (MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t)) return t;
    return '';
}
async function startMic() {
    if (!canRecord || listening || transcribing) return;
    if (!requireLogin()) return;
    stopSpeaking();
    try {
        micStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    } catch (e) {
        const denied = e && (e.name === 'NotAllowedError' || e.name === 'SecurityError');
        showNotification(denied ? 'Micro refusé : autorisez-le avec l’icône à gauche de l’adresse du site, puis réessayez.'
            : e && e.name === 'NotFoundError' ? 'Aucun micro trouvé sur cet appareil.' : 'Impossible d’ouvrir le micro (' + (e && e.name || 'erreur') + ').', 'error');
        return;
    }
    const mime = pickMime();
    recChunks = [];
    mediaRecorder = new MediaRecorder(micStream, mime ? { mimeType: mime } : undefined);
    mediaRecorder.ondataavailable = (e) => { if (e.data && e.data.size) recChunks.push(e.data); };
    mediaRecorder.onstop = () => onRecordingDone(mediaRecorder.mimeType || mime || 'audio/webm');
    mediaRecorder.start(250);
    setListening(true);
    watchSilence();
}
// Niveau sonore : après avoir parlé, 1,8 s de silence = fin de la réponse (mode vocal). 2 min maximum.
function watchSilence() {
    try {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const src = audioCtx.createMediaStreamSource(micStream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 1024;
        src.connect(analyser);
        const buf = new Float32Array(analyser.fftSize);
        const started = Date.now();
        let spoke = false, lastVoice = Date.now(), noise = 0.01;
        levelTimer = setInterval(() => {
            analyser.getFloatTimeDomainData(buf);
            let sum = 0; for (const v of buf) sum += v * v;
            const rms = Math.sqrt(sum / buf.length);
            if (Date.now() - started < 600) { noise = Math.max(noise, rms); return; } // bruit de fond de la pièce
            if (rms > Math.max(0.015, noise * 2.2)) { spoke = true; lastVoice = Date.now(); }
            const mb = document.getElementById('mic-btn');
            if (mb) mb.style.boxShadow = `0 0 0 ${Math.min(10, Math.round(rms * 120))}px rgba(225,29,72,.35)`;
            if (Date.now() - started > 120000) stopMic();
            else if (voiceMode && spoke && Date.now() - lastVoice > 1800) stopMic();
            else if (voiceMode && !spoke && Date.now() - started > 12000) { stopMic(true); voiceStatus('Je ne vous entends pas. Cliquez sur 🎤 pour répondre.', 'bg-amber-500'); }
        }, 100);
    } catch (e) { /* sans analyse du son : arrêt manuel en cliquant sur 🎤 */ }
}
function releaseMic() {
    clearInterval(levelTimer); levelTimer = null;
    if (audioCtx) { try { audioCtx.close(); } catch (e) {} audioCtx = null; }
    if (micStream) { micStream.getTracks().forEach(t => t.stop()); micStream = null; }
    const mb = document.getElementById('mic-btn');
    if (mb) mb.style.boxShadow = '';
}
// discard = true : on jette l'enregistrement (mode vocal coupé, silence total…)
function stopMic(discard = false) {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        if (discard) mediaRecorder.onstop = null;
        try { mediaRecorder.stop(); } catch (e) {}
    }
    releaseMic();
    setListening(false);
}
async function onRecordingDone(mime) {
    const blob = new Blob(recChunks, { type: mime.split(';')[0] });
    recChunks = [];
    if (blob.size < 1500) { voiceStatus('Enregistrement trop court. Cliquez sur 🎤 et parlez.', 'bg-amber-500'); return; }
    transcribing = true;
    setMicBusy(true);
    voiceStatus('✍️ Transcription de votre réponse…', 'bg-sky-500');
    const fd = new FormData();
    fd.append('targetJob', chatTargetJob());
    fd.append('audio', blob, 'reponse.' + (/mp4/.test(mime) ? 'm4a' : /ogg/.test(mime) ? 'ogg' : 'webm'));
    const d = await api('/api/ai/transcribe', { method: 'POST', body: fd });
    transcribing = false;
    setMicBusy(false);
    if (!d.success) { voiceStatus(''); return showNotification(d.message || 'Transcription impossible.', 'error'); }
    if (!d.text) { voiceStatus('Je n’ai pas compris. Cliquez sur 🎤 pour réessayer.', 'bg-amber-500'); return; }
    voiceStatus('');
    const input = document.getElementById('chat-input');
    input.value = (input.value.trim() ? input.value.trim() + ' ' : '') + d.text;
    if (voiceMode) sendChatMessage();
    else { input.focus(); showNotification('Réponse transcrite : relisez-la puis cliquez sur Envoyer.'); }
}
function setMicBusy(on) {
    const b = document.getElementById('mic-btn');
    if (!b) return;
    b.disabled = on;
    b.textContent = on ? '⏳' : '🎤';
}
function setListening(on) {
    listening = on;
    const b = document.getElementById('mic-btn');
    if (!b) return;
    b.classList.toggle('listening', on);
    b.setAttribute('aria-pressed', on);
    b.setAttribute('aria-label', on ? 'Terminer ma réponse' : 'Répondre au micro');
    if (on) voiceStatus('🎤 Je vous écoute… ' + (voiceMode ? 'parlez naturellement, l’envoi se fait après une courte pause' : 'cliquez à nouveau sur 🎤 quand vous avez fini'), 'bg-rose-500');
}
function toggleMic() { if (listening) stopMic(); else startMic(); }
if (canRecord) { const mb = document.getElementById('mic-btn'); if (mb) mb.classList.remove('hidden'); }

// ---------- Simulateur d'entretien ----------
function appendChatBubble(role, text, typing = false) {
    const box = document.getElementById('chat-messages');
    const row = document.createElement('div');
    row.className = `chat-row bubble-in flex items-end gap-2 ${role === 'user' ? 'self-end flex-row-reverse' : 'self-start'} max-w-[88%] sm:max-w-[75%]`;
    const avatar = role === 'user'
        ? `<span class="w-8 h-8 shrink-0 rounded-full bg-slate-200 grid place-items-center text-xs font-bold text-slate-600">${esc(((currentUser && currentUser.firstName) || 'V').charAt(0).toUpperCase())}</span>`
        : '<span class="w-8 h-8 shrink-0 rounded-full btn-primary grid place-items-center text-sm">🤖</span>';
    row.innerHTML = avatar;
    const bubble = document.createElement('div');
    bubble.className = role === 'user'
        ? 'bg-white border border-slate-200 text-slate-800 px-4 py-3 rounded-2xl rounded-br-md text-sm whitespace-pre-line shadow-sm'
        : 'text-white px-4 py-3 rounded-2xl rounded-bl-md text-sm whitespace-pre-line shadow-sm';
    if (role !== 'user') bubble.style.background = `linear-gradient(135deg,${brandColor(600)},${brandColor(500)})`;
    if (typing) bubble.innerHTML = '<span class="typing"><span></span><span></span><span></span></span>';
    else bubble.innerText = text;
    row.appendChild(bubble);
    box.appendChild(row);
    box.scrollTo({ top: box.scrollHeight, behavior: 'smooth' });
    return bubble;
}
function resetChat() {
    const job = document.getElementById('chat-target-job').value.trim();
    const greeting = job
        ? `Bonjour ! Je suis votre recruteur virtuel et je vous reçois pour le poste de « ${job} ». Pour commencer, présentez-vous en quelques phrases et expliquez-moi pourquoi ce poste vous intéresse.`
        : CHAT_GREETING;
    chatHistory = [{ role: 'assistant', content: greeting }];
    document.getElementById('chat-messages').innerHTML = '';
    document.getElementById('chat-report').innerHTML = '';
    document.getElementById('chat-report-bar').classList.add('hidden');
    appendChatBubble('assistant', greeting);
    speak(greeting);
}
async function sendChatMessage() {
    stopMic(true);
    stopSpeaking();
    const input = document.getElementById('chat-input');
    const text = input.value.trim();
    if (!text) return;
    if (!requireLogin()) return;
    input.value = '';
    appendChatBubble('user', text);
    chatHistory.push({ role: 'user', content: text });
    const typing = appendChatBubble('assistant', '', true);
    await withBusy(document.getElementById('chat-send-btn'), async () => {
        const data = await api('/api/ai/chat', { json: { messages: chatHistory, targetJob: chatTargetJob() } });
        if (data.success) {
            typing.innerText = data.text;
            chatHistory.push({ role: 'assistant', content: data.text });
            speak(data.text);
            updateReportBar();
            const box = document.getElementById('chat-messages');
            box.scrollTo({ top: box.scrollHeight, behavior: 'smooth' });
        } else {
            typing.closest('.chat-row').remove();
            chatHistory.pop();
            input.value = text;
            showNotification(data.message || "L'IA n'a pas pu répondre.", 'error');
        }
    });
    input.focus();
}
