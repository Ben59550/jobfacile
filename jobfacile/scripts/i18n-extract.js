// Extrait les textes de l'interface à traduire : public/index.html + textes fixes des scripts (public/js).
// Résultat : public/i18n/source.json (liste de phrases françaises). Usage : npm run i18n (extraction + traduction).
// Les pages légales (mentions, confidentialité) restent en français : elles ont une valeur juridique.
const fs = require('fs');
const path = require('path');
const PUB = path.join(__dirname, '..', 'public');

const norm = (t) => String(t).replace(/\s+/g, ' ').trim();
const looksFrench = (t) => /[A-Za-zÀ-ÿ]{2}/.test(t) && t.length <= 300;
// Exclut ce qui ressemble à du code, des classes CSS, des adresses ou des identifiants
const looksLikeCode = (t) => /[{}<>=;`$\\]|^\/|https?:|^[\w-]+\.(js|css|json|png)$|^#|^[a-z0-9_-]+$|\b(px|py|rounded|bg|text|border|flex|grid|w|h|mt|mb|gap)-[\w./[\]]+/.test(t) || /^[A-Z_]+$/.test(t);

const strings = new Set();
// 1. HTML (hors pages légales et hors scripts)
let html = fs.readFileSync(path.join(PUB, 'index.html'), 'utf8');
html = html.slice(html.indexOf('<body'));
const legalStart = html.indexOf('<!-- ================= VUE 9 : INFORMATIONS LÉGALES');
const legalEnd = html.indexOf('<!-- ================= VUE : MES DROITS');
if (legalStart > 0 && legalEnd > legalStart) html = html.slice(0, legalStart) + html.slice(legalEnd);
html = html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<!--[\s\S]*?-->/g, '');
for (const m of html.matchAll(/>([^<>]+)</g)) { const t = norm(m[1].replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')); if (looksFrench(t) && !looksLikeCode(t)) strings.add(t); }
for (const m of html.matchAll(/\s(?:placeholder|aria-label|title|alt)="([^"]+)"/g)) { const t = norm(m[1]); if (looksFrench(t) && !looksLikeCode(t)) strings.add(t); }

// 2. Scripts : textes entre guillemets et morceaux fixes des gabarits `...${x}...`
const pieces = (t) => t.split(/\$\{[^}]*\}/).map(norm);
for (const f of fs.readdirSync(path.join(PUB, 'js')).filter(f => f.endsWith('.js'))) {
    let src = fs.readFileSync(path.join(PUB, 'js', f), 'utf8').replace(/^\s*\/\/.*$/gm, '');
    const candidates = [];
    for (const m of src.matchAll(/'((?:[^'\\\n]|\\.){2,300})'/g)) candidates.push(m[1].replace(/\\'/g, "'").replace(/\\u2019/g, '’'));
    for (const m of src.matchAll(/"((?:[^"\\\n]|\\.){2,300})"/g)) candidates.push(m[1]);
    for (const m of src.matchAll(/`([^`]{2,2000})`/g)) {
        // texte visible entre balises dans les gabarits HTML
        for (const part of m[1].split(/<[^>]*>/)) candidates.push(...pieces(part));
        for (const a of m[1].matchAll(/(?:placeholder|aria-label|title)="([^"$]+)"/g)) candidates.push(a[1]);
    }
    for (let c of candidates) {
        c = norm(c.replace(/\\n/g, ' '));
        // phrases seulement : une majuscule ou un émoji au début, ou au moins deux mots
        if (!looksFrench(c) || looksLikeCode(c)) continue;
        if (!/^[A-ZÀ-Ý0-9«✓✗✨📍💶🙈⇄👁🎤🔊🏠🚗🗓️📅📊🏆🔥🤝💬⚖️🏢🛡️🚩📨🎉✉️📋❤️🔔⏰📝🗣️✖️💡📄⭐🎯🧭↺←→+…]/u.test(c) && c.split(' ').length < 2) continue;
        if (/^[a-z]+(\.[a-z]+)+$/i.test(c) || /^(GET|POST|Bearer|Content-Type|application\/)/.test(c)) continue;
        strings.add(c);
    }
}
// Encore du code, des classes CSS ou des consignes pour l'IA (jamais affichés) : on les retire
const isNoise = (t) => /^[,.;:)\]]|:\s*$|^[a-z]+[A-Z]\w*$|BEGIN:|END:|VEVENT|VCALENDAR/.test(t)
    || t.split(' ').every(w => /^[a-z0-9:!/[\].-]+$/.test(w) && /-/.test(w))
    || (t.length > 120 && /Réponds|Rédige|JSON|Tu (es|modères|simules|prépares)|N'invente|candidat\b.*(Compétences|Expériences)/.test(t));
for (const t of [...strings]) if (isNoise(t)) strings.delete(t);
// Nom de la marque : jamais traduit
for (const t of ['Job', 'Facile', 'JobFacile']) strings.delete(t);
const list = [...strings].sort((a, b) => a.localeCompare(b, 'fr'));
fs.mkdirSync(path.join(PUB, 'i18n'), { recursive: true });
fs.writeFileSync(path.join(PUB, 'i18n', 'source.json'), JSON.stringify(list, null, 1));
console.log(`${list.length} textes à traduire (${list.join(' ').split(/\s+/).length} mots) → public/i18n/source.json`);
