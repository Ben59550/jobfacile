// Traduit public/i18n/source.json en anglais, arabe et polonais avec l'IA (votre clé Groq du fichier .env).
// Seuls les textes pas encore traduits sont envoyés : relancer le script après une modification coûte peu.
// Usage : npm run i18n            (extraction puis traduction)
//         node scripts/i18n-translate.js en   (une seule langue)
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const KEY = process.env.GROQ_API_KEY;
const MODEL = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';
const DIR = path.join(__dirname, '..', 'public', 'i18n');
const LANGS = { en: 'English', ar: 'Modern Standard Arabic', pl: 'Polish' };
const BATCH = 40;

async function translateBatch(items, langName) {
    const input = Object.fromEntries(items.map((t, i) => [String(i), t]));
    const prompt = `Translate the user-interface strings of a French job-search website (JobFacile) into ${langName}.
Rules:
- Keep emojis, symbols (✓ ✗ → ← · • …), numbers and punctuation where they are. Keep leading/trailing spaces out.
- Keep unchanged: JobFacile, France Travail, Pôle emploi, CACES, RQTH, CPF, ATS, SIRET, Agefiph, Cap emploi, Mission locale, CV, PDF, IA→AI only in English, e-mail addresses, brand names.
- French legal or administrative terms (ARE, AGEPI, Mobili-Jeune, CDI, CDD, Intérim, Alternance) : keep the French term and add a short explanation in parentheses only if the string is a sentence; for single words or menu labels translate naturally (CDI → permanent contract).
- Short, natural UI wording; formal "you". Address the user the same way as the French.
- Return ONLY a JSON object with the same keys and the translated strings as values.
Strings:
${JSON.stringify(input)}`;
    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST', headers: { Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: MODEL, temperature: 0.1, response_format: { type: 'json_object' }, messages: [{ role: 'user', content: prompt }] }),
        signal: AbortSignal.timeout(120000)
    });
    const d = await r.json();
    if (!r.ok) throw new Error((d.error && d.error.message) || 'HTTP ' + r.status);
    const out = JSON.parse(d.choices[0].message.content);
    return items.map((t, i) => (typeof out[i] === 'string' && out[i].trim() ? out[i].trim() : null));
}

(async () => {
    if (!KEY) { console.error('GROQ_API_KEY manquant dans .env'); process.exit(1); }
    const source = JSON.parse(fs.readFileSync(path.join(DIR, 'source.json'), 'utf8'));
    const only = process.argv[2];
    for (const [code, name] of Object.entries(LANGS)) {
        if (only && only !== code) continue;
        const file = path.join(DIR, code + '.json');
        let dict = {};
        try { dict = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) {}
        // On garde seulement les textes encore présents dans le site
        dict = Object.fromEntries(Object.entries(dict).filter(([k]) => source.includes(k)));
        const todo = source.filter(t => !dict[t]);
        console.log(`${name} : ${todo.length} texte(s) à traduire`);
        for (let i = 0; i < todo.length; i += BATCH) {
            const items = todo.slice(i, i + BATCH);
            for (let attempt = 1; attempt <= 6; attempt++) {
                try {
                    const res = await translateBatch(items, name);
                    res.forEach((tr, k) => { if (tr) dict[items[k]] = tr; });
                    break;
                } catch (e) {
                    console.warn(`  paquet ${i / BATCH + 1} : essai ${attempt} échoué (${e.message})`);
                    // Limite gratuite de Groq : on attend le délai indiqué dans le message d'erreur
                    const wait = /try again in ([\d.]+)(ms|s)/.exec(e.message);
                    const ms = wait ? parseFloat(wait[1]) * (wait[2] === 's' ? 1000 : 1) : 8000 * attempt;
                    await new Promise(r => setTimeout(r, Math.ceil(ms) + 1500));
                }
            }
            await new Promise(r => setTimeout(r, 15000)); // environ 3 000 jetons par paquet : rester sous 8 000 par minute
            process.stdout.write(`  ${Math.min(i + BATCH, todo.length)}/${todo.length}\r`);
            fs.writeFileSync(file, JSON.stringify(dict, null, 1)); // sauvegarde au fur et à mesure
        }
        console.log(`  ${Object.keys(dict).length}/${source.length} traduits → public/i18n/${code}.json`);
    }
})();
