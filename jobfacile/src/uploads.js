// Envoi de fichiers (photo de profil, CV) : formats et taille autorisés.
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const { UPLOADS_DIR } = require('./config');

const ALLOWED_MIME = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOADS_DIR),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + crypto.randomInt(1e9);
        const ext = path.extname(file.originalname).toLowerCase().replace(/[^.a-z0-9]/g, '');
        cb(null, file.fieldname + '-' + uniqueSuffix + ext);
    }
});
const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (ALLOWED_MIME.includes(file.mimetype)) cb(null, true);
        else cb(new Error('Format de fichier non supporté (PDF, JPG, PNG, WEBP ou GIF uniquement).'));
    }
});

module.exports = { storage, upload };
