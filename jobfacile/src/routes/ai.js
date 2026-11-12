// Routes IA : génération de textes, simulateur d’entretien et bilan, analyse et adaptation du CV, relance, ATS, compétences manquantes.
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const router = require('express').Router();
const { UPLOADS_DIR } = require('../config');
const { saveUsers } = require('../db');
const { publicUser, requireAuth, tooManyAttempts } = require('../security');
const { callGroq } = require('../services/ai');
const { quota } = require('../services/plans'); // quotas mensuels de la formule gratuite
const { qualifLabelsServer } = require('../services/qualifs');
const { storage } = require('../uploads');
const { fold } = require('../utils');

router.post('/api/ai/generate', requireAuth, quota('docs'), async (req, res) => {
    const prompt = String(req.body.prompt || '').slice(0, 8000);
    if (!prompt) return res.status(400).json({ success: false, message: 'Demande vide.' });
    try {
        const text = await callGroq([
            { role: 'system', content: "Tu es un expert en recrutement en France. Réponds en français, en texte brut sans Markdown (pas de **, #, ni tableaux)." },
            { role: 'user', content: prompt }
        ]);
        res.json({ success: true, text });
    } catch (error) {
        res.status(502).json({ success: false, message: error.message || "Erreur de communication avec l'IA." });
    }
});

// Simulateur d'entretien : conversation avec historique
router.post('/api/ai/chat', requireAuth, quota('interview'), async (req, res) => {
    const history = Array.isArray(req.body.messages) ? req.body.messages.slice(-20) : [];
    const messages = history
        .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
        .map(m => ({ role: m.role, content: m.content.slice(0, 2000) }));
    if (!messages.length) return res.status(400).json({ success: false, message: 'Message vide.' });
    const u = req.user;
    const targetJob = String(req.body.targetJob || u.desiredJob || '').slice(0, 120);
    const profil = (targetJob ? `Poste visé : ${targetJob}. ` : '') + `Candidat : ${u.firstName}. Compétences : ${(u.skills || []).join(', ') || 'non renseignées'}. ` +
        `Expériences : ${(u.experience || []).map(e => `${e.title} chez ${e.company}`).join('; ') || 'non renseignées'}.`;
    try {
        const text = await callGroq([
            { role: 'system', content: `Tu es un recruteur bienveillant qui fait passer un entretien d'embauche en français. ${profil} Pose une seule question à la fois, réagis brièvement à la réponse du candidat avec un conseil concret, puis pose la question suivante. Réponds en texte brut, 120 mots maximum.` },
            ...messages
        ]);
        res.json({ success: true, text });
    } catch (error) {
        res.status(502).json({ success: false, message: error.message || "Erreur de communication avec l'IA." });
    }
});

// Bilan de fin d'entretien simulé
router.post('/api/ai/interview-report', requireAuth, quota('analyses'), async (req, res) => {
    const history = Array.isArray(req.body.messages) ? req.body.messages.slice(-40) : [];
    const messages = history
        .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
        .map(m => ({ role: m.role, content: m.content.slice(0, 2000) }));
    if (messages.filter(m => m.role === 'user').length < 2) return res.status(400).json({ success: false, message: 'Répondez au moins à 2 questions avant de demander votre bilan.' });
    if (tooManyAttempts('report:' + req.user.id, 15, 60 * 60 * 1000)) return res.status(429).json({ success: false, message: 'Trop de bilans demandés, réessayez dans une heure.' });
    const targetJob = String(req.body.targetJob || req.user.desiredJob || '').slice(0, 120);
    const transcript = messages.map(m => `${m.role === 'user' ? 'CANDIDAT' : 'RECRUTEUR'} : ${m.content}`).join('\n');
    const prompt = `Tu es un coach en recrutement. Voici la transcription d'un entretien d'embauche simulé${targetJob ? ` pour le poste de « ${targetJob} »` : ''}.
Évalue uniquement les réponses du CANDIDAT et réponds UNIQUEMENT avec un objet JSON de cette forme :
{
  "score": nombre de 0 à 100,
  "verdict": "une phrase de bilan, bienveillante et honnête",
  "strengths": ["3 points forts concrets"],
  "improvements": ["3 axes de progrès concrets"],
  "answers": [{"question": "question posée", "feedback": "ce qui allait / n'allait pas", "better": "exemple de meilleure réponse, 2 à 3 phrases, à la première personne"}],
  "nextSteps": ["3 actions à faire avant un vrai entretien"]
}
"answers" contient au maximum 3 questions, celles où le candidat peut le plus progresser.
Transcription :
"""${transcript.slice(0, 14000)}"""`;
    try {
        let raw;
        try { raw = await callGroq([{ role: 'user', content: prompt }], { json: true, temperature: 0.3 }); }
        catch (e) { raw = await callGroq([{ role: 'user', content: prompt }], { temperature: 0.3 }); }
        const m = String(raw).match(/\{[\s\S]*\}/);
        const a = JSON.parse(m ? m[0] : raw);
        const s = (v, max) => String(v ?? '').trim().slice(0, max);
        const list = (v, n, f) => (Array.isArray(v) ? v : []).slice(0, n).map(f).filter(Boolean);
        const report = {
            score: Math.max(0, Math.min(100, parseInt(a.score) || 0)),
            verdict: s(a.verdict, 400),
            strengths: list(a.strengths, 4, x => s(x, 250)),
            improvements: list(a.improvements, 4, x => s(x, 250)),
            answers: list(a.answers, 3, x => x && x.question ? { question: s(x.question, 300), feedback: s(x.feedback, 400), better: s(x.better, 600) } : null),
            nextSteps: list(a.nextSteps, 4, x => s(x, 250))
        };
        // Historique des bilans (courbe de progression) : 50 derniers
        const user = req.user;
        user.interviewHistory = [{ at: new Date().toISOString(), job: targetJob, score: report.score, verdict: report.verdict, improvements: report.improvements.slice(0, 2) },
            ...(Array.isArray(user.interviewHistory) ? user.interviewHistory : [])].slice(0, 50);
        saveUsers(req.users);
        res.json({ success: true, report, user: publicUser(user) });
    } catch (e) {
        console.error('Bilan entretien :', e.message);
        res.status(502).json({ success: false, message: "L'IA n'a pas pu préparer votre bilan. Réessayez dans un instant." });
    }
});

// Analyse d'un CV PDF : extraction du texte puis lecture par l'IA
// unpdf (lecteur PDF de Mozilla) : module ESM, chargé à la demande
let unpdfModule = null;
async function pdfToText(buffer) {
    if (!unpdfModule) unpdfModule = await import('unpdf');
    const pdf = await unpdfModule.getDocumentProxy(new Uint8Array(buffer));
    const { text } = await unpdfModule.extractText(pdf, { mergePages: true });
    return Array.isArray(text) ? text.join('\n') : String(text || '');
}
const cvUpload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => file.mimetype === 'application/pdf' ? cb(null, true) : cb(new Error('Merci d’envoyer votre CV au format PDF.'))
});

router.post('/api/user/cv/analyze', requireAuth, quota('analyses'), cvUpload.single('cvFile'), async (req, res) => {
    if (!req.file) return res.status(400).json({ success: false, message: 'Aucun fichier reçu.' });
    if (tooManyAttempts('cv:' + req.user.id, 10, 60 * 60 * 1000)) return res.status(429).json({ success: false, message: 'Trop d’analyses, réessayez dans une heure.' });
    let text = '';
    try {
        const raw = await pdfToText(fs.readFileSync(req.file.path));
        text = raw.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
    } catch (e) {
        console.error('Lecture PDF :', e && e.message);
        fs.unlink(req.file.path, () => {});
        return res.status(400).json({ success: false, message: 'Impossible de lire ce PDF (fichier protégé ou abîmé).' });
    }
    if (text.length < 80) {
        fs.unlink(req.file.path, () => {});
        return res.status(400).json({ success: false, message: 'Ce PDF ne contient pas de texte lisible (CV scanné en image ?). Exportez votre CV en PDF depuis Word ou Canva.' });
    }

    // Le PDF est gardé comme CV du profil (l'ancien est supprimé)
    const user = req.user;
    if (user.cvPdfUrl && user.cvPdfUrl.startsWith('/uploads/')) fs.unlink(path.join(UPLOADS_DIR, path.basename(user.cvPdfUrl)), () => {});
    user.cvPdfUrl = `/uploads/${req.file.filename}`;
    user.cvText = text.slice(0, 20000);
    saveUsers(req.users);

    const prompt = `Voici le texte d'un CV (français). Analyse-le et réponds UNIQUEMENT avec un objet JSON de cette forme :
{
  "summary": "2 phrases qui résument le profil",
  "score": nombre de 0 à 100 (qualité globale du CV),
  "skills": ["compétences clés, 12 maximum, intitulés courts"],
  "experience": [{"title": "", "company": "", "period": "", "desc": "missions en 1 phrase"}],
  "education": [{"degree": "", "school": "", "year": ""}],
  "strengths": ["3 points forts"],
  "improvements": ["4 conseils concrets pour améliorer ce CV"],
  "jobIdeas": ["3 intitulés de postes à rechercher"]
}
N'invente rien qui ne soit pas dans le CV. Texte du CV :
"""${text.slice(0, 12000)}"""`;
    try {
        let raw;
        try { raw = await callGroq([{ role: 'user', content: prompt }], { json: true, temperature: 0.2 }); }
        catch (e) { raw = await callGroq([{ role: 'user', content: prompt }], { temperature: 0.2 }); }
        const m = String(raw).match(/\{[\s\S]*\}/);
        const a = JSON.parse(m ? m[0] : raw);
        const list = (v, n, f) => (Array.isArray(v) ? v : []).slice(0, n).map(f).filter(Boolean);
        const s = (v, max) => String(v ?? '').trim().slice(0, max);
        const analysis = {
            summary: s(a.summary, 500),
            score: Math.max(0, Math.min(100, parseInt(a.score) || 0)),
            skills: list(a.skills, 15, x => s(x, 60)),
            experience: list(a.experience, 15, x => x && (x.title || x.company) ? { title: s(x.title, 120), company: s(x.company, 120), period: s(x.period, 60), desc: s(x.desc, 400) } : null),
            education: list(a.education, 10, x => x && (x.degree || x.school) ? { degree: s(x.degree, 120), school: s(x.school, 120), year: s(x.year, 30) } : null),
            strengths: list(a.strengths, 5, x => s(x, 200)),
            improvements: list(a.improvements, 6, x => s(x, 250)),
            jobIdeas: list(a.jobIdeas, 5, x => s(x, 80))
        };
        res.json({ success: true, analysis, user: publicUser(user) });
    } catch (e) {
        console.error('Analyse CV :', e.message);
        res.status(502).json({ success: false, message: "L'IA n'a pas pu analyser le CV. Réessayez dans un instant.", user: publicUser(user) });
    }
});

// ---------- CV : contenu rédigé par l'IA (CV général ou adapté à une offre) ----------
// L'IA ne fait que reformuler et ordonner ce qui est déjà dans le profil : elle n'ajoute aucune compétence.
router.post('/api/ai/cv-content', requireAuth, quota('docs'), async (req, res) => {
    const u = req.user;
    const s = (v, max) => String(v ?? '').trim().slice(0, max);
    const targetJob = s(req.body.targetJob, 120) || s(u.desiredJob, 120) || 'Poste';
    const o = req.body.offer && typeof req.body.offer === 'object' ? req.body.offer : null;
    const offer = o ? { title: s(o.title, 200), company: s(o.company, 150), location: s(o.location, 150), description: s(o.fullDescription || o.description, 3000) } : null;
    if (tooManyAttempts('cvai:' + u.id, 30, 60 * 60 * 1000)) return res.status(429).json({ success: false, message: 'Trop de demandes, réessayez dans une heure.' });

    const skills = (u.skills || []).filter(x => typeof x === 'string');
    const exps = (u.experience || []).filter(e => e && (e.title || e.company));
    const edus = (u.education || []).filter(e => e && (e.degree || e.school));
    const q = qualifLabelsServer(u);
    const profile = [
        `Nom : ${u.firstName || ''} ${u.lastName || ''}`,
        u.headline ? `Titre : ${u.headline}` : '',
        u.bio ? `Présentation : ${u.bio}` : '',
        `Compétences (liste fermée) : ${JSON.stringify(skills)}`,
        `Expériences : ${JSON.stringify(exps.map((e, i) => ({ i, title: e.title, company: e.company, period: e.period, desc: e.desc })))}`,
        `Diplômes : ${edus.map(e => `${e.degree} ${e.school ? '- ' + e.school : ''} ${e.year || ''}`).join('; ') || 'non renseignés'}`,
        [...q.licenses, ...q.caces, ...q.habilitations].length ? `Permis et habilitations : ${[...q.licenses, ...q.caces, ...q.habilitations].join(', ')}` : '',
        (u.languages || []).length ? `Langues : ${u.languages.map(l => l.lang + (l.level ? ' (' + l.level + ')' : '')).join(', ')}` : ''
    ].filter(Boolean).join('\n');

    const prompt = `Tu prépares le CV d'un candidat pour le poste de "${targetJob}".${offer ? `
Le CV doit être ADAPTÉ à cette offre précise : "${offer.title}" chez ${offer.company} (${offer.location}).
Annonce : """${offer.description}"""` : ''}
Profil du candidat :
${profile}

Réponds UNIQUEMENT avec un objet JSON :
{
  "summary": "accroche de profil de 3 à 5 phrases, à la première personne sans « je » répétitif, orientée vers le poste${offer ? ' et les attentes de l\'annonce' : ''}",
  "skills": ["les compétences de la liste fermée, de la plus pertinente à la moins pertinente pour ce poste (8 maximum)"],
  "experience": [{"i": index de l'expérience, "desc": "missions reformulées en 1 à 2 phrases avec des verbes d'action, en mettant en avant ce qui sert ce poste"}],
  "missing": [${offer ? '"compétences ou exigences importantes de l\'annonce absentes du profil (5 maximum)"' : ''}]
}
Règles : n'invente AUCUNE compétence, expérience, entreprise, date ni chiffre. "skills" ne contient que des éléments de la liste fermée, recopiés à l'identique.`;
    try {
        let raw;
        try { raw = await callGroq([{ role: 'user', content: prompt }], { json: true, temperature: 0.3 }); }
        catch (e) { raw = await callGroq([{ role: 'user', content: prompt }], { temperature: 0.3 }); }
        const m = String(raw).match(/\{[\s\S]*\}/);
        const a = JSON.parse(m ? m[0] : raw);
        const known = new Map(skills.map(x => [fold(x), x]));
        const orderedSkills = [...new Set((Array.isArray(a.skills) ? a.skills : []).map(x => known.get(fold(x))).filter(Boolean))];
        for (const x of skills) if (!orderedSkills.includes(x)) orderedSkills.push(x); // rien n'est perdu
        const descs = {};
        for (const e of Array.isArray(a.experience) ? a.experience : []) {
            const i = parseInt(e && e.i);
            if (i >= 0 && i < exps.length && e.desc) descs[i] = s(e.desc, 500);
        }
        res.json({
            success: true,
            cv: {
                targetJob,
                summary: s(a.summary, 900),
                skills: orderedSkills.slice(0, 20),
                experience: exps.map((e, i) => ({ title: s(e.title, 120), company: s(e.company, 120), period: s(e.period, 60), desc: descs[i] || s(e.desc, 500) })),
                missing: (offer && Array.isArray(a.missing) ? a.missing : []).slice(0, 5).map(x => s(x, 80)).filter(Boolean)
            }
        });
    } catch (e) {
        console.error('Contenu CV :', e.message);
        res.status(502).json({ success: false, message: "L'IA n'a pas pu préparer votre CV. Réessayez dans un instant." });
    }
});

// ---------- E-mail de relance (ou de remerciement après entretien) rédigé par l'IA ----------
router.post('/api/ai/follow-up', requireAuth, quota('docs'), async (req, res) => {
    const u = req.user;
    const a = (u.applications || []).find(x => x && x.id === req.body.id);
    if (!a) return res.status(404).json({ success: false, message: 'Candidature introuvable.' });
    if (tooManyAttempts('fu:' + u.id, 30, 60 * 60 * 1000)) return res.status(429).json({ success: false, message: 'Trop de demandes, réessayez dans une heure.' });
    const kind = req.body.kind === 'thanks' ? 'thanks' : 'relance';
    const j = a.job || {};
    const days = a.appliedAt ? Math.floor((Date.now() - new Date(a.appliedAt).getTime()) / 86400000) : null;
    const name = `${u.firstName || ''} ${u.lastName || ''}`.trim();
    const already = (a.followUps || []).length;
    const notes = a.notes ? ` Notes du candidat (nom du contact, déroulé…) : ${String(a.notes).slice(0, 800)}` : '';
    const prompt = kind === 'thanks'
        ? `Rédige un court e-mail de remerciement après un entretien d'embauche pour le poste "${j.title}" chez ${j.company}. Candidat : ${name}.${notes} 6 à 9 lignes, chaleureux et professionnel, rappelle la motivation, sans flatterie excessive.`
        : `Rédige un e-mail de relance court et poli pour une candidature au poste "${j.title}" chez ${j.company} (${j.location}), envoyée ${days !== null ? 'il y a ' + days + ' jours' : 'récemment'}.${already ? ` C'est la relance n° ${already + 1} : reste bref et laisse une porte ouverte.` : ''} Candidat : ${name}${u.phone ? ', tél. ' + u.phone : ''}.${notes} 5 à 8 lignes, ton professionnel et motivé, propose un échange et rappelle la disponibilité.`;
    const msg = [
        { role: 'system', content: 'Tu écris des e-mails professionnels en français, en texte brut sans Markdown.' },
        { role: 'user', content: prompt + ` Réponds UNIQUEMENT avec un objet JSON {"subject": "objet de l'e-mail", "body": "corps de l'e-mail avec formule d'appel, formule de politesse et signature"}. Utilise le nom du contact s'il figure dans les notes, sinon « Madame, Monsieur ». N'invente aucun fait. ${u.gender === 'F' ? 'Le candidat est une femme : accorde au féminin.' : u.gender === 'H' ? 'Le candidat est un homme : accorde au masculin.' : 'Évite les accords genrés (ex : « je suis disponible » plutôt que « motivé »).'}` }
    ];
    try {
        let raw;
        try { raw = await callGroq(msg, { json: true, temperature: 0.5 }); } catch (e) { raw = await callGroq(msg, { temperature: 0.5 }); }
        const m = String(raw).match(/\{[\s\S]*\}/);
        const r = JSON.parse(m ? m[0] : raw);
        res.json({ success: true, kind, subject: String(r.subject || '').slice(0, 200), body: String(r.body || '').slice(0, 3000) });
    } catch (e) {
        console.error('Relance :', e.message);
        res.status(502).json({ success: false, message: "L'IA n'a pas pu rédiger l'e-mail. Réessayez dans un instant." });
    }
});

// ---------- Vérificateur ATS : le CV est-il lisible par les logiciels de tri des recruteurs ? ----------
function buildProfileCvText(u) {
    const q = qualifLabelsServer(u);
    return [
        `${u.firstName || ''} ${u.lastName || ''}`, u.headline, u.email, u.phone, [u.postalCode, u.city].filter(Boolean).join(' '),
        'Profil', u.bio,
        'Compétences', (u.skills || []).join(', '),
        'Expériences professionnelles', ...(u.experience || []).filter(e => e && e.title).map(e => `${e.title} ${e.company || ''} ${e.period || ''} ${e.desc || ''}`),
        'Formation', ...(u.education || []).filter(e => e && e.degree).map(e => `${e.degree} ${e.school || ''} ${e.year || ''}`),
        'Permis et habilitations', [...q.licenses, ...q.caces, ...q.habilitations].join(', '),
        'Langues', (u.languages || []).map(l => l.lang + ' ' + (l.level || '')).join(', ')
    ].filter(Boolean).join('\n');
}
router.post('/api/ai/ats-check', requireAuth, quota('analyses'), async (req, res) => {
    const u = req.user;
    const s_ = (v, max) => String(v ?? '').trim().slice(0, max);
    if (tooManyAttempts('ats:' + u.id, 30, 60 * 60 * 1000)) return res.status(429).json({ success: false, message: 'Trop de demandes, réessayez dans une heure.' });
    const o = req.body.offer && typeof req.body.offer === 'object' ? req.body.offer : null;
    const targetJob = s_(req.body.targetJob || (o && o.title) || u.desiredJob, 150);
    if (!targetJob) return res.status(400).json({ success: false, message: 'Indiquez le poste visé.' });
    const fromPdf = !!(u.cvText && u.cvText.length > 200);
    const text = fromPdf ? String(u.cvText) : buildProfileCvText(u);
    const f = fold(text);

    // Contrôles automatiques (sans IA)
    const words = text.split(/\s+/).filter(Boolean).length;
    const checks = [
        { ok: /[^\s@]+@[^\s@]+\.[a-z]{2,}/i.test(text), label: 'Adresse e-mail lisible' },
        { ok: /(?:\+33|0)\s*[1-9](?:[\s.-]*\d{2}){4}/.test(text), label: 'Numéro de téléphone lisible' },
        { ok: /experience|parcours|emplois?\b/.test(f), label: 'Rubrique « Expérience » reconnaissable' },
        { ok: /formation|diplome|etudes/.test(f), label: 'Rubrique « Formation » reconnaissable' },
        { ok: /competence|savoir-faire|aptitudes/.test(f), label: 'Rubrique « Compétences » reconnaissable' },
        { ok: /(19|20)\d{2}/.test(text), label: 'Dates des expériences présentes' },
        { ok: words >= 150 && words <= 900, label: words < 150 ? `CV trop court (${words} mots) : détaillez vos missions` : words > 900 ? `CV long (${words} mots) : visez 1 à 2 pages` : `Longueur adaptée (${words} mots)` }
    ];
    if (fromPdf) {
        const odd = (text.match(/[^\p{L}\p{N}\s.,;:'’()\/@+&%€-]/gu) || []).length / Math.max(1, text.length);
        checks.push({ ok: odd < 0.02, label: odd < 0.02 ? 'Texte du PDF bien extrait' : 'Beaucoup de symboles illisibles : évitez icônes, tableaux et colonnes complexes' });
    }

    const prompt = `Tu simules un logiciel de tri de CV (ATS) utilisé par un recruteur en France.
Poste : "${targetJob}"${o ? `
Annonce : """${s_(o.fullDescription || o.description, 3000)}"""` : ''}
CV du candidat :
"""${text.slice(0, 9000)}"""
Réponds UNIQUEMENT avec un objet JSON :
{
  "keywords": [{"word": "mot-clé ou compétence que l'ATS chercherait pour ce poste${o ? ' (tiré de l\'annonce)' : ''}", "found": true ou false selon qu'il figure dans le CV (ou un synonyme évident)}],
  "titleMatch": true si l'intitulé du poste visé (ou très proche) apparaît dans le CV,
  "tips": ["3 conseils concrets pour mieux passer le filtre ATS, en vouvoyant le candidat"]
}
12 à 15 mots-clés, les plus importants d'abord.`;
    try {
        let raw;
        try { raw = await callGroq([{ role: 'user', content: prompt }], { json: true, temperature: 0.2 }); }
        catch (e) { raw = await callGroq([{ role: 'user', content: prompt }], { temperature: 0.2 }); }
        const m = String(raw).match(/\{[\s\S]*\}/);
        const a = JSON.parse(m ? m[0] : raw);
        const keywords = (Array.isArray(a.keywords) ? a.keywords : []).slice(0, 15).filter(k => k && k.word).map(k => ({ word: s_(k.word, 60), found: !!k.found }));
        const kwScore = keywords.length ? keywords.filter(k => k.found).length / keywords.length : 0;
        const checkScore = checks.filter(c => c.ok).length / checks.length;
        const score = Math.round(100 * (0.6 * kwScore + 0.25 * checkScore + 0.15 * (a.titleMatch ? 1 : 0)));
        checks.unshift({ ok: !!a.titleMatch, label: a.titleMatch ? `L'intitulé « ${targetJob} » figure dans le CV` : `Ajoutez l'intitulé « ${targetJob} » en haut du CV` });
        res.json({ success: true, ats: { score, targetJob, source: fromPdf ? 'pdf' : 'profil', keywords, checks, tips: (Array.isArray(a.tips) ? a.tips : []).slice(0, 4).map(t => s_(t, 250)) } });
    } catch (e) {
        console.error('ATS :', e.message);
        res.status(502).json({ success: false, message: "L'IA n'a pas pu analyser votre CV. Réessayez dans un instant." });
    }
});

// ---------- Compétences manquantes pour une offre + formations pour les acquérir ----------
router.post('/api/ai/skill-gap', requireAuth, quota('analyses'), async (req, res) => {
    const u = req.user;
    const s = (v, max) => String(v ?? '').trim().slice(0, max);
    const o = req.body.offer && typeof req.body.offer === 'object' ? req.body.offer : {};
    const offer = { title: s(o.title, 200), company: s(o.company, 150), description: s(o.fullDescription || o.description, 3000) };
    if (!offer.title) return res.status(400).json({ success: false, message: 'Offre invalide.' });
    if (tooManyAttempts('gap:' + u.id, 40, 60 * 60 * 1000)) return res.status(429).json({ success: false, message: 'Trop de demandes, réessayez dans une heure.' });
    const q = qualifLabelsServer(u);
    const profile = [
        `Compétences : ${(u.skills || []).join(', ') || 'aucune renseignée'}`,
        `Expériences : ${(u.experience || []).filter(e => e && e.title).map(e => `${e.title}${e.desc ? ' (' + e.desc + ')' : ''}`).join('; ') || 'aucune'}`,
        `Diplômes : ${(u.education || []).filter(e => e && e.degree).map(e => e.degree).join(', ') || 'aucun'}`,
        `Permis et habilitations : ${[...q.licenses, ...q.caces, ...q.habilitations].join(', ') || 'aucun'}`,
        (u.languages || []).length ? `Langues : ${u.languages.map(l => l.lang + (l.level ? ' ' + l.level : '')).join(', ')}` : ''
    ].filter(Boolean).join('\n');
    const prompt = `Compare cette offre d'emploi au profil d'un candidat en France.
Offre : "${offer.title}" chez ${offer.company}
Annonce : """${offer.description}"""
Profil :
${profile}

Réponds UNIQUEMENT avec un objet JSON :
{
  "have": ["exigences de l'annonce que le candidat remplit déjà (5 maximum)"],
  "missing": [{"skill": "compétence, diplôme, permis ou certification demandé dans l'annonce et absent du profil", "importance": "indispensable" ou "souhaité", "training": "formation courte et réaliste en France pour l'acquérir (ex : CACES R489 cat. 3, 3 jours ; titre pro, MOOC gratuit…)", "duration": "durée indicative", "funding": "financement possible (CPF, France Travail AIF, OPCO, gratuit…)", "keywords": "2 à 4 mots-clés pour chercher cette formation"}],
  "advice": "1 à 2 phrases adressées directement au candidat en le vouvoyant (vous) : peut-il postuler dès maintenant ?"
}
5 éléments maximum dans "missing", les plus importants d'abord. Dans "have" et "missing", formule les éléments de façon neutre (sans « le candidat »). Ne liste que des exigences réellement présentes dans l'annonce. N'invente pas de nom d'organisme.`;
    try {
        let raw;
        try { raw = await callGroq([{ role: 'user', content: prompt }], { json: true, temperature: 0.2 }); }
        catch (e) { raw = await callGroq([{ role: 'user', content: prompt }], { temperature: 0.2 }); }
        const m = String(raw).match(/\{[\s\S]*\}/);
        const a = JSON.parse(m ? m[0] : raw);
        const list = (v, n) => (Array.isArray(v) ? v : []).slice(0, n);
        res.json({
            success: true,
            gap: {
                have: list(a.have, 5).map(x => s(x, 120)).filter(Boolean),
                missing: list(a.missing, 5).filter(x => x && x.skill).map(x => ({
                    skill: s(x.skill, 120), importance: x.importance === 'indispensable' ? 'indispensable' : 'souhaité',
                    training: s(x.training, 200), duration: s(x.duration, 60), funding: s(x.funding, 120), keywords: s(x.keywords || x.skill, 80)
                })),
                advice: s(a.advice, 400)
            }
        });
    } catch (e) {
        console.error('Compétences manquantes :', e.message);
        res.status(502).json({ success: false, message: "L'IA n'a pas pu comparer l'offre à votre profil. Réessayez dans un instant." });
    }
});

module.exports = router;
