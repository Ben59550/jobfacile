// Routes du suivi : favoris, candidatures, offres masquées ou vues, import LinkedIn.
const crypto = require('crypto');
const multer = require('multer');
const router = require('express').Router();
const { saveUsers } = require('../db');
const { publicUser, requireAuth } = require('../security');
const { fold } = require('../utils');

// ---------- Favoris & suivi des candidatures ----------
const APP_STATUSES = ['todo', 'applied', 'interview', 'offer', 'rejected'];
function str(v, max) { return String(v ?? '').slice(0, max); }
function sanitizeJob(j) {
    if (!j || typeof j !== 'object' || !j.id) return null;
    const url = str(j.url, 1000);
    return {
        id: str(j.id, 200),
        title: str(j.title, 200),
        company: str(j.company, 150),
        location: str(j.location, 150),
        type: str(j.type, 40),
        category: j.category === 'alternance' ? 'alternance' : 'emploi',
        domain: str(j.domain, 120),
        salary: str(j.salary, 80),
        source: str(j.source, 40),
        date: str(j.date, 40),
        description: str(j.description, 400),
        fullDescription: str(j.fullDescription || j.description, 4000),
        url: /^https?:\/\//i.test(url) ? url : ''
    };
}

// ---------- Import depuis LinkedIn (archive de données : ZIP ou fichiers CSV) ----------
// LinkedIn → Préférences → Confidentialité des données → Obtenir une copie de vos données.
function parseCsv(text) {
    const rows = []; let row = [], cell = '', q = false;
    text = String(text).replace(/^\uFEFF/, '');
    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
        else if (c === '"') q = true;
        else if (c === ',') { row.push(cell); cell = ''; }
        else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
        else cell += c;
    }
    if (cell || row.length) { row.push(cell); rows.push(row); }
    // Certains fichiers commencent par des lignes « Notes: » avant l'en-tête
    let start = rows.findIndex(r => r.some(x => x.trim()) && !/^notes\s*:/i.test(r[0].trim()));
    if (start < 0) return [];
    const head = rows[start].map(h => h.trim());
    return rows.slice(start + 1).filter(r => r.some(x => x.trim())).map(r => Object.fromEntries(head.map((h, i) => [h, (r[i] || '').trim()])));
}
function linkedinDate(v) {
    if (!v) return null;
    const m = String(v).match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/); // 11/5/24, 2:31 PM (mois/jour/année)
    const d = m ? new Date(+(m[3].length === 2 ? '20' + m[3] : m[3]), +m[1] - 1, +m[2]) : new Date(v);
    return isNaN(d) ? null : d.toISOString();
}
const liUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 30 * 1024 * 1024, files: 10 } });
router.post('/api/user/import-linkedin', requireAuth, liUpload.array('files', 10), (req, res) => {
    const files = {};
    try {
        for (const f of req.files || []) {
            if (/\.zip$/i.test(f.originalname)) {
                const { unzipSync, strFromU8 } = require('fflate');
                const wanted = /(^|\/)(Job Applications|Positions|Education|Skills)\.csv$/i;
                const z = unzipSync(new Uint8Array(f.buffer), { filter: (e) => wanted.test(e.name) });
                for (const [name, data] of Object.entries(z)) files[name.split('/').pop().toLowerCase()] = strFromU8(data);
            } else if (/\.csv$/i.test(f.originalname)) files[f.originalname.split(/[\\/]/).pop().toLowerCase()] = f.buffer.toString('utf8');
        }
    } catch (e) {
        return res.status(400).json({ success: false, message: 'Archive illisible. Envoyez le fichier ZIP reçu de LinkedIn, ou les fichiers CSV.' });
    }
    const find = (re) => Object.keys(files).find(k => re.test(k));
    const pick = (o, ...keys) => { for (const k of keys) if (o[k]) return o[k]; return ''; };
    const appsCsv = find(/job applications/);
    const posCsv = find(/^positions/);
    const eduCsv = find(/^education/);
    const skillsCsv = find(/^skills/);
    if (!appsCsv && !posCsv && !eduCsv && !skillsCsv) return res.status(400).json({ success: false, message: 'Aucun fichier LinkedIn reconnu (Job Applications, Positions, Education ou Skills).' });

    const u = req.user;
    const apply = req.body.mode === 'apply';
    const now = new Date().toISOString();
    const summary = { applications: 0, experience: 0, education: 0, skills: 0 };
    u.applications = Array.isArray(u.applications) ? u.applications : [];
    if (appsCsv) {
        for (const r of parseCsv(files[appsCsv])) {
            const title = str(pick(r, 'Job Title'), 200), company = str(pick(r, 'Company Name'), 150);
            if (!title) continue;
            const at = linkedinDate(pick(r, 'Application Date')) || now;
            const id = 'li-' + crypto.createHash('sha1').update(fold(title) + '|' + fold(company) + '|' + at.slice(0, 10)).digest('hex').slice(0, 16);
            if (u.applications.some(a => a.id === id)) continue;
            summary.applications++;
            if (!apply || u.applications.length >= 300) continue;
            const url = pick(r, 'Job Url');
            const contact = [pick(r, 'Contact Email'), pick(r, 'Contact Phone Number')].filter(Boolean).join(' · ');
            u.applications.push({
                id, job: { id, title, company, location: '', type: '', category: 'emploi', domain: '', salary: '', source: 'LinkedIn', date: '', description: '', fullDescription: '', url: /^https?:\/\//.test(url) ? url : '' },
                status: 'applied', notes: contact ? 'Contact : ' + contact : '', createdAt: at, updatedAt: now, appliedAt: at
            });
        }
    }
    if (posCsv) {
        u.experience = Array.isArray(u.experience) ? u.experience : [];
        for (const r of parseCsv(files[posCsv])) {
            const title = str(pick(r, 'Title'), 120), company = str(pick(r, 'Company Name'), 120);
            if (!title || u.experience.some(e => e && fold(e.title) === fold(title) && fold(e.company) === fold(company))) continue;
            summary.experience++;
            if (apply && u.experience.length < 30) u.experience.push({ title, company, period: [pick(r, 'Started On'), pick(r, 'Finished On') || "aujourd'hui"].filter(Boolean).join(' - ').slice(0, 60), desc: str(pick(r, 'Description'), 400) });
        }
    }
    if (eduCsv) {
        u.education = Array.isArray(u.education) ? u.education : [];
        for (const r of parseCsv(files[eduCsv])) {
            const degree = str(pick(r, 'Degree Name', 'Notes'), 120) || 'Formation', school = str(pick(r, 'School Name'), 120);
            if (!school || u.education.some(e => e && fold(e.school) === fold(school) && fold(e.degree) === fold(degree))) continue;
            summary.education++;
            if (apply && u.education.length < 30) u.education.push({ degree, school, year: str(pick(r, 'End Date', 'Start Date'), 30) });
        }
    }
    if (skillsCsv) {
        u.skills = Array.isArray(u.skills) ? u.skills : [];
        const have = new Set(u.skills.map(fold));
        for (const r of parseCsv(files[skillsCsv])) {
            const name = str(pick(r, 'Name'), 60);
            if (!name || have.has(fold(name))) continue;
            have.add(fold(name));
            summary.skills++;
            if (apply && u.skills.length < 50) u.skills.push(name);
        }
    }
    if (apply) saveUsers(req.users);
    res.json({ success: true, applied: apply, summary, user: apply ? publicUser(u) : undefined });
});

// ---------- Offres masquées (« pas intéressé ») et offres déjà vues ----------
router.post('/api/user/job-flags', requireAuth, (req, res) => {
    const user = req.user;
    const b = req.body || {};
    user.hiddenJobs = Array.isArray(user.hiddenJobs) ? user.hiddenJobs : [];
    user.seenJobs = Array.isArray(user.seenJobs) ? user.seenJobs : [];
    if (b.hide && b.hide.id) {
        const j = { id: str(b.hide.id, 200), title: str(b.hide.title, 200), company: str(b.hide.company, 150), at: new Date().toISOString() };
        user.hiddenJobs = [j, ...user.hiddenJobs.filter(x => x.id !== j.id)].slice(0, 500);
    }
    if (b.unhide) user.hiddenJobs = user.hiddenJobs.filter(x => x.id !== String(b.unhide));
    if (b.unhideAll) user.hiddenJobs = [];
    if (Array.isArray(b.seen) && b.seen.length) {
        const add = b.seen.slice(0, 50).map(x => str(x, 200)).filter(Boolean);
        user.seenJobs = [...new Set([...add, ...user.seenJobs])].slice(0, 1000);
    }
    saveUsers(req.users);
    res.json({ success: true, user: publicUser(user) });
});

router.post('/api/user/favorites/toggle', requireAuth, (req, res) => {
    const user = req.user;
    const job = sanitizeJob(req.body.job);
    if (!job) return res.status(400).json({ success: false, message: 'Offre invalide.' });
    user.favorites = (Array.isArray(user.favorites) ? user.favorites : []).filter(f => f && typeof f === 'object');
    const exists = user.favorites.some(f => f.id === job.id);
    if (exists) user.favorites = user.favorites.filter(f => f.id !== job.id);
    else user.favorites.unshift({ ...job, savedAt: new Date().toISOString() });
    user.favorites = user.favorites.slice(0, 200);
    saveUsers(req.users);
    res.json({ success: true, isFavorite: !exists, user: publicUser(user) });
});

router.post('/api/user/applications', requireAuth, (req, res) => {
    const user = req.user;
    user.applications = Array.isArray(user.applications) ? user.applications : [];
    const now = new Date().toISOString();
    const { id, status, notes, remove } = req.body;

    if (req.body.job) {
        // Ajout (ou mise à jour si l'offre est déjà suivie)
        const job = sanitizeJob(req.body.job);
        if (!job) return res.status(400).json({ success: false, message: 'Offre invalide.' });
        let app_ = user.applications.find(a => a.id === job.id);
        if (!app_) {
            if (user.applications.length >= 300) return res.status(400).json({ success: false, message: 'Limite de 300 candidatures suivies atteinte.' });
            app_ = { id: job.id, job, status: 'todo', notes: '', createdAt: now, updatedAt: now, appliedAt: null };
            user.applications.unshift(app_);
        }
        if (APP_STATUSES.includes(status)) {
            app_.status = status;
            if (status !== 'todo' && !app_.appliedAt) app_.appliedAt = now;
        }
        app_.updatedAt = now;
    } else {
        const app_ = user.applications.find(a => a.id === id);
        if (!app_) return res.status(404).json({ success: false, message: 'Candidature introuvable.' });
        if (remove) {
            user.applications = user.applications.filter(a => a.id !== id);
        } else {
            if (status !== undefined) {
                if (!APP_STATUSES.includes(status)) return res.status(400).json({ success: false, message: 'Statut invalide.' });
                app_.status = status;
                if (status !== 'todo' && !app_.appliedAt) app_.appliedAt = now;
            }
            if (notes !== undefined) app_.notes = str(notes, 2000);
            if (req.body.followedUp) { app_.followUps = [now, ...(app_.followUps || [])].slice(0, 10); app_.relanceRemindedAt = undefined; }
            if (req.body.interview === null) app_.interview = null;
            else if (req.body.interview && typeof req.body.interview === 'object') {
                const iv = req.body.interview;
                const at = String(iv.at || '');
                if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(at) || isNaN(new Date(at))) return res.status(400).json({ success: false, message: 'Date d’entretien invalide.' });
                const sameTime = app_.interview && app_.interview.at === at.slice(0, 16);
                app_.interview = {
                    remindedAt: sameTime ? app_.interview.remindedAt : undefined,
                    at: at.slice(0, 16), // heure locale « AAAA-MM-JJTHH:MM »
                    duration: [30, 45, 60, 90, 120].includes(parseInt(iv.duration)) ? parseInt(iv.duration) : 60,
                    kind: ['onsite', 'video', 'phone'].includes(iv.kind) ? iv.kind : 'onsite',
                    place: str(iv.place, 300), contact: str(iv.contact, 150)
                };
                if (app_.status !== 'interview' && app_.status !== 'offer') { app_.status = 'interview'; if (!app_.appliedAt) app_.appliedAt = now; }
            }
            app_.updatedAt = now;
        }
    }
    saveUsers(req.users);
    res.json({ success: true, user: publicUser(user) });
});

module.exports = router;
