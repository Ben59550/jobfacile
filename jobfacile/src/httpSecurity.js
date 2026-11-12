// Sécurité HTTP : en-têtes (helmet), politique de contenu (CSP), compression, adresse IP réelle derrière l'hébergeur,
// limite de requêtes par adresse IP.
const helmet = require('helmet');
const compression = require('compression');
const { IS_TEST, PUBLIC_URL } = require('./config');
const { tooManyAttempts, clientIp } = require('./security');

// Google AdSense : script, publicités (cadres, images) et mesures d'audience
const ADSENSE = [
    'https://pagead2.googlesyndication.com', 'https://*.googlesyndication.com', 'https://*.g.doubleclick.net',
    'https://*.doubleclick.net', 'https://www.google.com', 'https://*.google.com', 'https://adservice.google.com',
    'https://*.gstatic.com', 'https://*.adtrafficquality.google', 'https://fundingchoicesmessages.google.com'
];

function applyHttpSecurity(app) {
    // Derrière un hébergeur (Render, Railway, Nginx…), l'adresse du visiteur arrive dans X-Forwarded-For.
    // TRUST_PROXY=1 (un intermédiaire) dans .env une fois en ligne ; sans cela, l'en-tête n'est pas cru (sinon falsifiable).
    const trust = process.env.TRUST_PROXY;
    app.set('trust proxy', trust === undefined || trust === '' ? false : /^\d+$/.test(trust) ? parseInt(trust) : trust);
    app.disable('x-powered-by');

    app.use(compression());
    app.use(helmet({
        contentSecurityPolicy: {
            useDefaults: false,
            directives: {
                defaultSrc: ["'self'"],
                // 'unsafe-inline' : nécessaire pour les attributs onclick du site et la configuration de Tailwind
                scriptSrc: ["'self'", "'unsafe-inline'", 'https://cdn.tailwindcss.com', 'https://cdnjs.cloudflare.com', 'https://accounts.google.com/gsi/client', ...ADSENSE],
                scriptSrcAttr: ["'unsafe-inline'"],
                styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com', 'https://cdnjs.cloudflare.com', 'https://accounts.google.com/gsi/style'],
                fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
                imgSrc: ["'self'", 'data:', 'blob:', 'https://*.tile.openstreetmap.org', 'https://cdnjs.cloudflare.com', 'https://*.googleusercontent.com', ...ADSENSE],
                mediaSrc: ["'self'", 'blob:'],
                connectSrc: ["'self'", 'https://api-adresse.data.gouv.fr', 'https://accounts.google.com/gsi/', 'https://cdnjs.cloudflare.com', ...ADSENSE],
                frameSrc: ['https://accounts.google.com/gsi/', ...ADSENSE],
                workerSrc: ["'self'"],
                manifestSrc: ["'self'"],
                objectSrc: ["'none'"],
                baseUri: ["'self'"],
                formAction: ["'self'"],
                frameAncestors: ["'none'"],
                ...(/^https:/.test(PUBLIC_URL) ? { upgradeInsecureRequests: [] } : {})
            }
        },
        // La connexion Google ouvre une fenêtre qui doit pouvoir répondre au site
        crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
        crossOriginEmbedderPolicy: false,
        crossOriginResourcePolicy: { policy: 'same-site' },
        referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
        // HSTS : seulement en ligne, en HTTPS (sinon le navigateur refuserait ensuite http://localhost)
        strictTransportSecurity: /^https:/.test(PUBLIC_URL) ? { maxAge: 31536000, includeSubDomains: false } : false
    }));
    // Le service hors connexion (sw.js) télécharge et met en cache Tailwind, les polices, Leaflet et les fonds de carte :
    // sa propre politique doit l'y autoriser, sinon le site s'affiche sans mise en forme.
    app.use('/sw.js', (req, res, next) => {
        res.setHeader('Content-Security-Policy', "default-src 'self'; connect-src 'self' https:; img-src 'self' https: data:");
        res.setHeader('Cache-Control', 'no-cache'); // le navigateur vérifie toujours s'il existe une nouvelle version
        next();
    });
    // Micro (entretien vocal) et position (offres près de moi) : seulement pour le site lui-même
    app.use((req, res, next) => { res.setHeader('Permissions-Policy', 'microphone=(self), geolocation=(self), camera=(), payment=(), usb=()'); next(); });

    // Limite globale par adresse IP sur l'API : 600 requêtes / 10 min (un usage normal en fait bien moins)
    app.use('/api', (req, res, next) => {
        if (IS_TEST) return next();
        if (tooManyAttempts('ip:' + clientIp(req), 600, 10 * 60 * 1000)) return res.status(429).json({ success: false, message: 'Trop de requêtes depuis votre connexion. Réessayez dans quelques minutes.' });
        next();
    });
}

module.exports = { applyHttpSecurity };
