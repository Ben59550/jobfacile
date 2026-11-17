// Configuration : variables du fichier .env, dossiers, adresse publique du site, secret de signature.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT_DIR = path.join(__dirname, '..');
// En mode test (npm test), le fichier .env n'est pas lu : aucune vraie clé, aucun vrai e-mail
const IS_TEST = process.env.NODE_ENV === 'test';
if (!IS_TEST) require('dotenv').config({ path: path.join(ROOT_DIR, '.env') });
const PORT = process.env.PORT || 3000;

const DATA_DIR = process.env.JOBFACILE_DATA_DIR || path.join(ROOT_DIR, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const UPLOADS_DIR = process.env.JOBFACILE_UPLOADS_DIR || path.join(ROOT_DIR, 'uploads');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// Les secrets sont lus uniquement dans le fichier .env (jamais dans le code)
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;
if (!GROQ_API_KEY && !IS_TEST) console.warn('⚠️  GROQ_API_KEY manquant dans .env : les fonctions IA seront indisponibles.');
if ((!EMAIL_USER || !EMAIL_PASS) && !IS_TEST) console.warn('⚠️  EMAIL_USER / EMAIL_PASS manquants dans .env : les codes seront affichés dans la console.');

// Adresse publique du site (liens des e-mails) et secret qui signe les liens de désinscription
const PUBLIC_URL = (process.env.PUBLIC_URL || `http://localhost:${PORT}`).replace(/\/$/, '');
const SECRET_FILE = path.join(DATA_DIR, '.secret');
let APP_SECRET = process.env.APP_SECRET;
if (!APP_SECRET) {
    try { APP_SECRET = fs.readFileSync(SECRET_FILE, 'utf8').trim(); } catch (e) {}
    if (!APP_SECRET) { APP_SECRET = crypto.randomBytes(32).toString('hex'); fs.writeFileSync(SECRET_FILE, APP_SECRET, 'utf8'); }
}

module.exports = { IS_TEST, PORT, ROOT_DIR, DATA_DIR, UPLOADS_DIR, PUBLIC_URL, EMAIL_USER, EMAIL_PASS, USERS_FILE, GROQ_API_KEY, APP_SECRET };
