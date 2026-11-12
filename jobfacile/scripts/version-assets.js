// Met à jour les numéros de version (?v=…) des fichiers CSS et JS dans public/index.html,
// pour que les navigateurs chargent tout de suite la nouvelle version après une modification.
// Usage : npm run assets
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PUB = path.join(__dirname, '..', 'public');
const file = path.join(PUB, 'index.html');
let html = fs.readFileSync(file, 'utf8');
let changed = 0;
html = html.replace(/(href|src)="\/((?:css|js)\/[\w.-]+\.(?:css|js))\?v=([0-9a-f]+)"/g, (m, attr, rel, old) => {
    const p = path.join(PUB, rel);
    if (!fs.existsSync(p)) { console.warn('⚠️  Fichier introuvable :', rel); return m; }
    const v = crypto.createHash('sha1').update(fs.readFileSync(p)).digest('hex').slice(0, 8);
    if (v !== old) { changed++; console.log(`${rel} : ${old} → ${v}`); }
    return `${attr}="/${rel}?v=${v}"`;
});
fs.writeFileSync(file, html);
console.log(changed ? `${changed} version(s) mise(s) à jour.` : 'Tout est déjà à jour.');
