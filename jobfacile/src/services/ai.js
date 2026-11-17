// Client IA (Groq).
const { GROQ_API_KEY } = require('../config');

// ---------- IA (Groq) ----------
async function callGroq(messages, opts = {}) {
    if (!GROQ_API_KEY) throw new Error("Clé IA non configurée (GROQ_API_KEY dans .env).");
    const payload = { model: process.env.GROQ_MODEL || 'openai/gpt-oss-120b', messages, temperature: opts.temperature ?? 0.7 };
    if (opts.json) payload.response_format = { type: 'json_object' };
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(90000)
    });
    const data = await response.json().catch(() => ({}));
    const text = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    if (!response.ok || !text) {
        console.error('Erreur Groq :', response.status, data && data.error ? data.error.message : data);
        throw new Error("Réponse invalide de l'IA.");
    }
    return text;
}

module.exports = { callGroq };
