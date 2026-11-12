// JobFacile : point d'entrée du serveur.
// Le code est rangé dans src/ :
//   config.js        variables du fichier .env, dossiers, adresse publique
//   db.js            base SQLite (comptes)          security.js   mots de passe, sessions, limite d'essais
//   mailer.js        envoi des e-mails              uploads.js    fichiers envoyés (photo, CV)
//   services/        logique métier : recherche d'offres, alertes, notifications, IA, géographie
//   routes/          adresses /api/... regroupées par thème (une par fichier)
// Tests : npm test (dossier tests/).
const express = require('express');
const path = require('path');
const cors = require('cors');
const multer = require('multer');
const { PORT, PUBLIC_URL } = require('./src/config');
const { db, getUsers, saveUsers } = require('./src/db');
const { testOutbox } = require('./src/mailer');
const { attempts } = require('./src/security');
const { checkAlerts } = require('./src/services/alerts');
const { checkTrackerReminders } = require('./src/services/reminders');
const { loadRome } = require('./src/routes/rome');

const app = express();
require('./src/httpSecurity').applyHttpSecurity(app);
// CORS : seulement l'adresse du site (et localhost en développement), pas n'importe quel site
app.use(cors({ origin: (origin, cb) => cb(null, !origin || origin === PUBLIC_URL || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
// Photos et CV : seulement par lien signé (voir src/services/files.js)
app.get('/uploads/:name', require('./src/services/files').serveUpload);

// Routes par thème. « pages » reste en dernier : il répond aux adresses inconnues.
app.use(require('./src/routes/ai'));
app.use(require('./src/routes/documents'));
app.use(require('./src/routes/rome'));
app.use(require('./src/routes/auth'));
app.use(require('./src/routes/profile'));
app.use(require('./src/routes/tracker'));
app.use(require('./src/routes/jobs'));
app.use(require('./src/routes/commute'));
app.use(require('./src/routes/alerts'));
app.use(require('./src/routes/voice'));
app.use(require('./src/routes/referral'));
app.use(require('./src/routes/recruiter'));
app.use(require('./src/routes/messages'));
app.use(require('./src/routes/community'));
app.use(require('./src/routes/status'));
app.use(require('./src/routes/pages'));

// Gestion centrale des erreurs (fichier trop gros, mauvais format, JSON invalide…)
app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        const msg = err.code === 'LIMIT_FILE_SIZE' ? 'Fichier trop volumineux (5 Mo maximum).' : 'Erreur lors de l’envoi du fichier.';
        return res.status(400).json({ success: false, message: msg });
    }
    if (err && err.type === 'entity.parse.failed') return res.status(400).json({ success: false, message: 'Requête invalide.' });
    console.error('Erreur serveur :', err);
    res.status(err.status || 400).json({ success: false, message: err.message || 'Erreur serveur.' });
});

if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`🚀 Serveur JobFacile actif sur : http://localhost:${PORT}`);
        loadRome(); // référentiel des métiers (téléchargé en arrière-plan si besoin)
        setTimeout(checkAlerts, 60 * 1000);
        setInterval(checkAlerts, 20 * 60 * 1000);
        require('./src/services/backup').scheduleBackups(); // copie de la base chaque jour (data/backups)
        setTimeout(() => checkTrackerReminders().catch(e => console.warn('⚠️  Rappels :', e.message)), 90 * 1000);
        setInterval(() => checkTrackerReminders().catch(e => console.warn('⚠️  Rappels :', e.message)), 20 * 60 * 1000);
        if (PUBLIC_URL.includes('localhost')) console.log('ℹ️  Liens des e-mails : ' + PUBLIC_URL + ' (définissez PUBLIC_URL dans .env une fois le site en ligne)');
    }).on('error', (e) => {
        if (e.code === 'EADDRINUSE') {
            console.error(`\n❌ Le port ${PORT} est déjà utilisé : JobFacile est sans doute déjà ouvert dans une autre fenêtre.`);
            console.error(`   Fermez l'autre fenêtre du serveur, ou ouvrez directement http://localhost:${PORT} dans votre navigateur.\n`);
        } else console.error('❌ Le serveur n’a pas pu démarrer :', e.message);
        process.exit(1);
    });
}

module.exports = { checkTrackerReminders, app, getUsers, saveUsers, testOutbox, attempts, closeDb: () => db.close() };
