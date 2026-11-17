// Fabrique les icônes PNG du logo (épingle « au kilomètre près ») avec Microsoft Edge en mode sans fenêtre.
// Usage : node scripts/make-icons.js   → public/icons/icon-192.png, icon-512.png, maskable-512.png, apple-touch-icon.png
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const OUT = path.join(__dirname, '..', 'public', 'icons');
const BRAND = '#059669';
const EDGE = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe']
    .find(p => fs.existsSync(p));
if (!EDGE) { console.error('Edge ou Chrome introuvable.'); process.exit(1); }

// Épingle blanche sur fond de couleur (dessin de 48 × 48, agrandi). rounded : coins arrondis ; scale/offset : place dans l'icône
function appIcon(size, { rounded, scale, dx, dy }) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
  <rect width="512" height="512" ${rounded ? 'rx="112"' : ''} fill="${BRAND}"/>
  <g transform="translate(${dx} ${dy}) scale(${scale})">
    <path d="M24 3C14.6 3 7 10.4 7 19.6 7 31.5 24 45 24 45s17-13.5 17-25.4C41 10.4 33.4 3 24 3Z" fill="#fff"/>
    <circle cx="24" cy="19.5" r="11.5" fill="${BRAND}"/>
    <path d="M27.4 12.6v9.6a4.6 4.6 0 0 1-9.2 0" fill="none" stroke="#fff" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/>
  </g>
</svg>`;
}

const ICONS = [
    ['icon-512.png', 512, { rounded: true, scale: 8, dx: 64, dy: 60 }],
    ['icon-192.png', 192, { rounded: true, scale: 8, dx: 64, dy: 60 }],
    ['apple-touch-icon.png', 180, { rounded: false, scale: 8, dx: 64, dy: 60 }], // iOS arrondit lui-même les coins
    ['maskable-512.png', 512, { rounded: false, scale: 6.2, dx: 107, dy: 104 }]   // Android découpe : logo dans la zone sûre (80 %)
];

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'jf-icons-'));
for (const [name, size, opts] of ICONS) {
    const html = path.join(tmp, name + '.html');
    fs.writeFileSync(html, `<!doctype html><html><body style="margin:0;background:transparent">${appIcon(size, opts)}</body></html>`);
    const out = path.join(OUT, name);
    execFileSync(EDGE, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--default-background-color=00000000',
        `--window-size=${size},${size}`, `--screenshot=${out}`, 'file:///' + html.replace(/\\/g, '/')], { stdio: 'ignore', timeout: 60000 });
    console.log(`${name} (${size} px) : ${fs.statSync(out).size} octets`);
}
fs.rmSync(tmp, { recursive: true, force: true });
