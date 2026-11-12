// Routes de l'entretien vocal :
//   POST /api/ai/transcribe : votre réponse enregistrée au micro → texte (Whisper, via votre compte Groq)
//   POST /api/ai/tts        : texte du recruteur → voix naturelle (ElevenLabs), si une clé est configurée
// Sans clé ElevenLabs, le navigateur utilise sa propre voix (plus robotique).
const multer = require('multer');
const router = require('express').Router();
const { GROQ_API_KEY } = require('../config');
const { requireAuth, tooManyAttempts } = require('../security');

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || '';
// Voix par défaut : « George » (voix d'exemple ElevenLabs). Choisissez une voix française dans la bibliothèque
// ElevenLabs et mettez son identifiant dans ELEVENLABS_VOICE_ID pour un accent 100 % français.
const ELEVENLABS_VOICE_ID = process.env.ELEVENLABS_VOICE_ID || 'JBFqnCBsd6RMkjVDRZzb';
const ELEVENLABS_MODEL = process.env.ELEVENLABS_MODEL || 'eleven_multilingual_v2';
let ttsDownUntil = 0; // quota épuisé ou clé refusée : on arrête d'essayer pendant un moment

// ---------- Micro → texte ----------
const audioUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 15 * 1024 * 1024 },
    fileFilter: (req, file, cb) => /^(audio|video)\//.test(file.mimetype) ? cb(null, true) : cb(new Error('Format audio non reconnu.'))
});
router.post('/api/ai/transcribe', requireAuth, audioUpload.single('audio'), async (req, res) => {
    if (!GROQ_API_KEY) return res.status(503).json({ success: false, message: 'Transcription indisponible (clé IA manquante).' });
    if (!req.file || req.file.size < 1500) return res.status(400).json({ success: false, message: 'Je n’ai rien entendu. Parlez un peu plus près du micro.' });
    if (tooManyAttempts('stt:' + req.user.id, 120, 60 * 60 * 1000)) return res.status(429).json({ success: false, message: 'Trop de réponses vocales, réessayez dans une heure.' });
    const ext = /mp4|m4a|aac/.test(req.file.mimetype) ? 'm4a' : /ogg/.test(req.file.mimetype) ? 'ogg' : /wav/.test(req.file.mimetype) ? 'wav' : 'webm';
    const form = new FormData();
    form.append('file', new Blob([req.file.buffer], { type: req.file.mimetype }), 'reponse.' + ext);
    form.append('model', process.env.GROQ_STT_MODEL || 'whisper-large-v3-turbo');
    form.append('language', 'fr');
    form.append('response_format', 'json');
    form.append('temperature', '0');
    // Le contexte aide Whisper à bien écrire le vocabulaire d'un entretien d'embauche
    const u = req.user;
    const vocab = [String(req.body.targetJob || u.desiredJob || '').slice(0, 80), u.city, ...(u.skills || []).slice(0, 12), (u.caces || []).length ? 'CACES' : '', 'CDI', 'CDD', 'intérim', 'alternance']
        .filter(Boolean).join(', ');
    form.append('prompt', ('Entretien d’embauche en français. Le candidat répond au recruteur. Vocabulaire : ' + vocab + '.').slice(0, 800));
    try {
        const r = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
            method: 'POST', headers: { Authorization: 'Bearer ' + GROQ_API_KEY }, body: form, signal: AbortSignal.timeout(45000)
        });
        const data = await r.json().catch(() => ({}));
        if (!r.ok) {
            console.error('Transcription :', r.status, data && data.error ? data.error.message : data);
            return res.status(502).json({ success: false, message: 'La transcription a échoué. Réessayez ou répondez au clavier.' });
        }
        const text = String(data.text || '').trim();
        // Whisper « invente » parfois ces phrases sur un silence
        if (!text || /^(sous-titr|merci d'avoir regardé|abonnez-vous)/i.test(text)) return res.json({ success: true, text: '' });
        res.json({ success: true, text: text.slice(0, 4000) });
    } catch (e) {
        console.error('Transcription :', e.message);
        res.status(502).json({ success: false, message: 'La transcription a échoué. Réessayez ou répondez au clavier.' });
    }
});

// ---------- Texte → voix naturelle ----------
router.post('/api/ai/tts', requireAuth, async (req, res) => {
    if (!ELEVENLABS_API_KEY) return res.status(503).json({ success: false, fallback: true, message: 'Voix naturelle non configurée.' });
    if (Date.now() < ttsDownUntil) return res.status(503).json({ success: false, fallback: true, message: 'Voix naturelle momentanément indisponible.' });
    if (tooManyAttempts('tts:' + req.user.id, 120, 60 * 60 * 1000)) return res.status(429).json({ success: false, fallback: true, message: 'Trop de demandes de voix.' });
    // Les émojis, puces et symboles ne se lisent pas
    const text = String(req.body.text || '').replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, '').replace(/[•*#_>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 1500);
    if (!text) return res.status(400).json({ success: false, fallback: true });
    try {
        const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(ELEVENLABS_VOICE_ID)}?output_format=mp3_44100_64`, {
            method: 'POST',
            headers: { 'xi-api-key': ELEVENLABS_API_KEY, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
            body: JSON.stringify({
                text, model_id: ELEVENLABS_MODEL,
                ...(/flash|turbo/.test(ELEVENLABS_MODEL) ? { language_code: 'fr' } : {}),
                voice_settings: { stability: 0.45, similarity_boost: 0.8, style: 0.15, use_speaker_boost: true }
            }),
            signal: AbortSignal.timeout(30000)
        });
        if (!r.ok) {
            const detail = await r.text().catch(() => '');
            console.warn('⚠️  ElevenLabs :', r.status, detail.slice(0, 200));
            // 401 clé refusée, 402/429 crédits ou quota épuisés : voix du navigateur pendant 10 minutes
            if ([401, 402, 429].includes(r.status) || /quota|credits/i.test(detail)) ttsDownUntil = Date.now() + 10 * 60 * 1000;
            return res.status(502).json({ success: false, fallback: true, message: 'Voix naturelle indisponible.' });
        }
        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('Cache-Control', 'no-store');
        res.send(Buffer.from(await r.arrayBuffer()));
    } catch (e) {
        console.warn('⚠️  ElevenLabs :', e.message);
        res.status(502).json({ success: false, fallback: true, message: 'Voix naturelle indisponible.' });
    }
});

// Ce que le navigateur peut utiliser
router.get('/api/voice/config', (req, res) => res.json({ stt: !!GROQ_API_KEY, naturalVoice: !!ELEVENLABS_API_KEY }));

module.exports = router;
module.exports.voiceState = () => ({ configured: !!ELEVENLABS_API_KEY, downUntil: ttsDownUntil });
