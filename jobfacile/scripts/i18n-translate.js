// Traduit public/i18n/source.json dans toutes les langues du site avec l'IA (clés du fichier .env).
// Fournisseur : Gemini (GEMINI_API_KEY, gros paquets, rapide) sinon / en secours Groq (GROQ_API_KEY).
// Seuls les textes pas encore traduits sont envoyés : relancer le script après une modification coûte peu.
// Usage : npm run i18n                       (extraction puis traduction de toutes les langues)
//         node scripts/i18n-translate.js de pl  (seulement ces langues)
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const GEMINI_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_I18N_MODEL || 'gemini-3.1-flash-lite'; // rapide et peu demandé : les gros modèles sont souvent saturés
const GROQ_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';
const DIR = path.join(__dirname, '..', 'public', 'i18n');
// Doit correspondre à LANGUAGES dans public/js/i18n.js
const LANGS = {
    en: 'English', ar: 'Modern Standard Arabic', pl: 'Polish', de: 'German', es: 'Spanish', it: 'Italian',
    pt: 'European Portuguese', nl: 'Dutch', ro: 'Romanian', el: 'Greek', cs: 'Czech', sk: 'Slovak',
    hu: 'Hungarian', bg: 'Bulgarian', hr: 'Croatian', sl: 'Slovenian', da: 'Danish', sv: 'Swedish',
    fi: 'Finnish', et: 'Estonian', lv: 'Latvian', lt: 'Lithuanian', ga: 'Irish', mt: 'Maltese',
    uk: 'Ukrainian', no: 'Norwegian (Bokmål)'
};

let useGemini = !!GEMINI_KEY;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function prompt(items, langName) {
    const input = Object.fromEntries(items.map((t, i) => [String(i), t]));
    return `Translate the user-interface strings of a French job-search website (JobFacile) into ${langName}.
Rules:
- Keep emojis, symbols (✓ ✗ → ← · • …), numbers and punctuation where they are. Keep leading/trailing spaces out.
- Keep unchanged: JobFacile, France Travail, Pôle emploi, CACES, RQTH, CPF, ATS, SIRET, Agefiph, Cap emploi, Mission locale, CV, PDF, e-mail addresses, brand names. "IA" becomes the usual abbreviation for AI in the target language.
- French legal or administrative terms (ARE, AGEPI, Mobili-Jeune, CDI, CDD, Intérim, Alternance) : keep the French term and add a short explanation in parentheses only if the string is a sentence; for single words or menu labels translate naturally (CDI → permanent contract).
- Short, natural UI wording; polite/formal "you" as usual on websites in that language.
- Return ONLY a JSON object with the same keys and the translated strings as values.
Strings:
${JSON.stringify(input)}`;
}

async function viaGemini(text) {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`, {
        method: 'POST', headers: { 'x-goog-api-key': GEMINI_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text }] }], generationConfig: { temperature: 0.1, responseMimeType: 'application/json' } }),
        signal: AbortSignal.timeout(180000)
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { const e = new Error((d.error && d.error.message) || 'HTTP ' + r.status); e.status = r.status; throw e; }
    const parts = d.candidates && d.candidates[0] && d.candidates[0].content && d.candidates[0].content.parts;
    return (parts || []).map(p => p.text || '').join('');
}
async function viaGroq(text) {
    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST', headers: { Authorization: 'Bearer ' + GROQ_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: GROQ_MODEL, temperature: 0.1, response_format: { type: 'json_object' }, messages: [{ role: 'user', content: text }] }),
        signal: AbortSignal.timeout(120000)
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { const e = new Error((d.error && d.error.message) || 'HTTP ' + r.status); e.status = r.status; throw e; }
    return d.choices[0].message.content;
}

async function translateBatch(items, langName) {
    const raw = useGemini ? await viaGemini(prompt(items, langName)) : await viaGroq(prompt(items, langName));
    const out = JSON.parse(raw.replace(/^```(?:json)?\s*|\s*```$/g, ''));
    return items.map((t, i) => (typeof out[i] === 'string' && out[i].trim() ? out[i].trim() : null));
}

(async () => {
    if (!GEMINI_KEY && !GROQ_KEY) { console.error('GEMINI_API_KEY ou GROQ_API_KEY manquant dans .env'); process.exit(1); }
    const source = JSON.parse(fs.readFileSync(path.join(DIR, 'source.json'), 'utf8'));
    const only = process.argv.slice(2);
    for (const [code, name] of Object.entries(LANGS)) {
        if (only.length && !only.includes(code)) continue;
        const file = path.join(DIR, code + '.json');
        let dict = {};
        try { dict = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) {}
        // On garde seulement les textes encore présents dans le site
        dict = Object.fromEntries(Object.entries(dict).filter(([k]) => source.includes(k)));
        const todo = source.filter(t => !dict[t]);
        console.log(`${name} : ${todo.length} texte(s) à traduire`);
        let i = 0;
        while (i < todo.length) {
            const size = useGemini ? 120 : 40;
            const items = todo.slice(i, i + size);
            let ok = false, switched = false;
            for (let attempt = 1; attempt <= 8 && !ok && !switched; attempt++) {
                try {
                    const res = await translateBatch(items, name);
                    res.forEach((tr, k) => { if (tr) dict[items[k]] = tr; });
                    ok = true;
                } catch (e) {
                    console.warn(`  [${useGemini ? 'Gemini' : 'Groq'}] essai ${attempt} échoué : ${String(e.message).slice(0, 140)}`);
                    // Gemini indisponible ou quota du jour épuisé : on continue avec Groq (même paquet)
                    if (useGemini && GROQ_KEY && (/per day|daily|quota/i.test(e.message) || attempt >= 4)) { useGemini = false; switched = true; console.warn('  → passage à Groq'); continue; }
                    const wait = /try again in ([\d.]+)(ms|s)/.exec(e.message) || /retry in ([\d.]+)(s)/i.exec(e.message);
                    await sleep(wait ? Math.ceil(parseFloat(wait[1]) * (wait[2] === 's' ? 1000 : 1)) + 1500 : 6000 * attempt);
                }
            }
            if (switched) continue;    // on refait ce paquet avec Groq
            i += items.length;         // réussi, ou abandonné : sera retenté au prochain lancement
            fs.writeFileSync(file, JSON.stringify(dict, null, 1)); // sauvegarde au fur et à mesure
            process.stdout.write(`  ${Math.min(i, todo.length)}/${todo.length}\n`);
            await sleep(useGemini ? 4000 : 15000); // rester sous les limites gratuites
        }
        console.log(`  ${Object.keys(dict).length}/${source.length} traduits → public/i18n/${code}.json`);
    }
})();
