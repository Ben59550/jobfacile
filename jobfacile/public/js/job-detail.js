// JobFacile · Offres : compatibilité, fiche détaillée, ATS, salaire, offres masquées, comparateur, position, relance IA, lettre ciblée.
// Script classique (pas un module) : les fonctions sont globales et appelées depuis les attributs onclick de index.html.
// Ordre de chargement : app-core → interview → job-detail → tracker → account → navigation → ui → search.

// ---------- Petites icônes dessinées (remplacent les emojis : nettes, à la couleur du texte) ----------
const ICON_PATHS = {
    pin: '<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
    euro: '<path d="M17 6.5a7 7 0 1 0 0 11"/><path d="M4 10h9M4 14h9"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    contract: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h5"/>',
    car: '<path d="M4 16v-4l2-5h12l2 5v4z"/><path d="M4 12h16"/><circle cx="8" cy="17.5" r="1.5"/><circle cx="16" cy="17.5" r="1.5"/>',
    bike: '<circle cx="5.5" cy="16.5" r="3.5"/><circle cx="18.5" cy="16.5" r="3.5"/><path d="M5.5 16.5 9 9h7l2.5 7.5M9 9 7.5 6H5.5M12 16.5 16 9M14 6h3"/>',
    walk: '<circle cx="13" cy="4.5" r="1.8"/><path d="M9 21l2.5-6.5L14 17v4M8 12l2.5-4.5 3.5 2.5 3 1M11.5 14.5 12.5 10"/>',
    bus: '<rect x="4" y="3" width="16" height="14" rx="2"/><path d="M4 10h16M7 21v-4M17 21v-4M8 13.5h.01M16 13.5h.01"/>',
    home: '<path d="M3 11 12 4l9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-5h4v5"/>',
    bolt: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
    cap: '<path d="M22 9 12 4 2 9l10 5z"/><path d="M6 11v5c3 2 9 2 12 0v-5M22 9v5"/>',
    scan: '<rect x="4" y="7" width="16" height="12" rx="2"/><path d="M12 3v4M9 12h.01M15 12h.01M9 16h6"/>',
    id: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="11" r="2"/><path d="M6 16c.6-1.4 1.7-2 3-2s2.4.6 3 2M14 10h4M14 14h3"/>',
    bulb: '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z"/>',
    book: '<path d="M4 19V5a2 2 0 0 1 2-2h14v14H6a2 2 0 0 0-2 2 2 2 0 0 0 2 2h14"/>',
    card: '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M3 10h18M7 15h3"/>',
    eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    eyeOff: '<path d="M3 3l18 18"/><path d="M10.6 6.1 12 6c5 0 9 6 9 6a16 16 0 0 1-2.6 3.2M6.6 6.6C4.3 8.1 3 12 3 12s4 6 9 6a9 9 0 0 0 4.4-1.1"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
    compare: '<path d="M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7"/>',
    share: '<circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="m8.2 10.8 7.6-4.6M8.2 13.2l7.6 4.6"/>',
    cv: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/><circle cx="10" cy="12.5" r="2"/><path d="M7 18c.5-1.3 1.6-2 3-2s2.5.7 3 2"/>',
    sparkles: '<path d="M11 3l1.8 4.7 4.7 1.8-4.7 1.8L11 16l-1.8-4.7L4.5 9.5l4.7-1.8z"/><path d="M19 14l.8 2 2 .8-2 .8L19 20l-.8-2-2-.8 2-.8z"/>',
    track: '<path d="M10 6h10M10 12h10M10 18h10"/><path d="m3.5 6 1.5 1.5L7.5 5M3.5 12l1.5 1.5L7.5 11M3.5 18l1.5 1.5L7.5 17"/>',
    send: '<path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4z"/>',
    chat: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.4A8 8 0 1 1 21 12z"/>',
    external: '<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
    flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
    check: '<path d="m5 12 5 5 9-10"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    alert: '<path d="M12 3 2 20h20z"/><path d="M12 10v4M12 17h.01"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    locate: '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>',
    map: '<path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2z"/><path d="M9 4v14M15 6v14"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/>',
    building: '<rect x="4" y="3" width="16" height="18" rx="1"/><path d="M9 7h.01M15 7h.01M9 11h.01M15 11h.01M9 15h.01M15 15h.01M10 21v-3h4v3"/>',
    shieldCheck: '<path d="M12 3 5 6v6c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V6z"/><path d="m9 12 2 2 4-4"/>',
    // Métiers
    laptop: '<rect x="4" y="4" width="16" height="11" rx="1.5"/><path d="M2 19h20"/>',
    megaphone: '<path d="M3 10v4h4l6 4V6l-6 4z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19.5 5.5a9 9 0 0 1 0 13"/>',
    bag: '<path d="M5 8h14l-1 13H6z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
    helmet: '<path d="M3 18h18"/><path d="M5 18v-3a7 7 0 0 1 14 0v3"/><path d="M10 8V5h4v3"/>',
    chart: '<path d="M3 3v18h18"/><path d="M8 16v-4M13 16V8M18 16V9"/>',
    health: '<path d="M5 3v6a5 5 0 0 0 10 0V3"/><path d="M10 14v2a5 5 0 0 0 10 0v-3"/><circle cx="20" cy="11" r="2"/>',
    care: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
    chef: '<path d="M7 3v7a2 2 0 0 0 4 0V3M9 3v18"/><path d="M17 21V3c-2 1.5-3 4-3 7 0 1.5 1 2 3 2"/>',
    truck: '<path d="M2 6h12v10H2z"/><path d="M14 9h4l4 4v3h-8"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="18" r="2"/>',
    broom: '<path d="M19 3 11 11"/><path d="M11 11c-3 0-6 2-7 6l-1 4h4c4-1 6-4 6-7z"/><path d="M6 16l2 2"/>',
    leaf: '<path d="M5 19c0-8 5-14 15-14 0 10-6 15-14 15"/><path d="M5 20c2-5 5-8 9-10"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.9 4.9 7 7M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1 7 17M17 7l2.1-2.1"/>',
    shield: '<path d="M12 3 5 6v6c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V6z"/>',
    scissors: '<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M8.5 7.8 20 18M8.5 16.2 20 6"/>',
    folder: '<path d="M3 6a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/>',
    briefcase: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M3 13h18"/>'
};
function ico(name, cls = 'w-4 h-4') {
    return `<svg class="${cls} shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON_PATHS[name] || ''}</svg>`;
}

// Métier de l'offre → icône et couleur (l'ordre compte : la première règle qui correspond l'emporte)
const JOB_DOMAINS = [
    [/développ|informati|logiciel|\bweb\b|data|réseau|admin\w* systèmes?|devops|cyber|technicien support/, 'laptop', 'from-sky-500 to-indigo-500'],
    [/aide à domicile|auxiliaire de vie|aide ménag|accompagnant|petite enfance|crèche|garde d.enfant|éducat|social|ehpad|puéricult/, 'care', 'from-pink-500 to-rose-500'],
    [/santé|soin|infirm|médic|hôpital|aide-soign|pharma|kiné|dentaire|ambulanc/, 'health', 'from-rose-500 to-red-500'],
    [/market|communic|graphis|journal/, 'megaphone', 'from-fuchsia-500 to-pink-500'],
    [/bâtiment|btp|maçon|électric|plomb|chantier|construct|peintre|menuis|charpent|carrel|couvreur|chauffag/, 'helmet', 'from-amber-500 to-orange-500'],
    [/compta|financ|gestionnaire|paie|banque|assur|audit/, 'chart', 'from-teal-500 to-cyan-600'],
    [/cuisin|restaur|serveu|hôtel|boulang|pâtiss|barista|plonge|traiteur|boucher/, 'chef', 'from-orange-500 to-amber-500'],
    [/transport|logisti|chauffeu|cariste|livr|magasinier|préparat|manutention|conducteur|entrepôt/, 'truck', 'from-indigo-500 to-violet-500'],
    [/commercial|vente|vendeu|caissi|boutique|employé de (libre|commerce)|commerce|négociat/, 'bag', 'from-rose-500 to-orange-500'],
    [/enseign|formation|professeur|animat|formateur|surveillant/, 'cap', 'from-violet-500 to-purple-500'],
    [/nettoy|propreté|entretien|ménage|agent de service|lavage/, 'broom', 'from-cyan-500 to-sky-500'],
    [/agricol|jardin|paysag|horticul|viticul|forest|élevage/, 'leaf', 'from-lime-500 to-green-600'],
    [/industri|product|usine|mécani|soud|opérateur|maintenance|usinage|régleur|monteur|câbleur|technicien/, 'gear', 'from-stone-500 to-stone-700'],
    [/sécurité|sûreté|surveill|gardien|pompier/, 'shield', 'from-blue-600 to-indigo-700'],
    [/coiff|esthéti|beauté|onglerie/, 'scissors', 'from-pink-400 to-fuchsia-500'],
    [/secrét|assistant|administratif|accueil|ressources humaines|\brh\b|juridique|office manager/, 'folder', 'from-emerald-500 to-teal-500']
];
function jobDomain(j) {
    const t = ((j.title || '') + ' ' + (j.domain || '')).toLowerCase();
    for (const [re, icon, color] of JOB_DOMAINS) if (re.test(t)) return { icon, color };
    return { icon: 'briefcase', color: 'from-emerald-500 to-teal-500' };
}
// Vignette de l'offre : logo de l'entreprise s'il existe, sinon l'icône du métier (le logo cassé disparaît tout seul)
function jobAvatar(j, size = 'md') {
    const d = jobDomain(j);
    const box = size === 'lg' ? 'w-16 h-16 rounded-2xl' : 'w-12 h-12 rounded-xl';
    const logo = j.logo ? `<img src="${esc(j.logo)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()" style="background:#fff" class="absolute inset-0 w-full h-full object-contain p-1.5">` : '';
    return `<span class="relative ${box} shrink-0 overflow-hidden bg-gradient-to-br ${d.color} text-white grid place-items-center shadow-sm ring-1 ring-black/5">${ico(d.icon, size === 'lg' ? 'w-8 h-8' : 'w-6 h-6')}${logo}</span>`;
}

// ---------- Offres : état partagé ----------
const jobsById = new Map();
let targetOffer = null;
let currentTrackerTab = 'apps';
let openJobId = null;

function foldTxt(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }
const STOPWORDS = new Set(['les', 'des', 'une', 'pour', 'avec', 'sur', 'par', 'dans', 'aux', 'est', 'poste', 'emploi', 'job', 'offre', 'confirme', 'confirmee', 'junior', 'senior', 'cdi', 'cdd', 'alternance', 'stage', 'h/f', 'f/h', 'nous', 'vous', 'votre', 'notre', 'chez', 'sera', 'etre', 'avoir', 'plus', 'tous', 'toute', 'ses', 'son', 'leur']);
function tokens(s) {
    return foldTxt(s).replace(/[^a-z0-9+#.]+/g, ' ').split(' ')
        .map(t => t.replace(/^\.+|\.+$/g, '').replace(/\.js$/, ''))
        .filter(t => t.length >= 3 && !STOPWORDS.has(t));
}
function stem(t) { return t.length > 6 ? t.slice(0, 6) : t; }

// Score de compatibilité : compétences du profil retrouvées dans l'offre + proximité de l'intitulé avec le parcours
function computeMatch(j) {
    if (!currentUser || !authToken) return null;
    const skills = Array.isArray(currentUser.skills) ? currentUser.skills : [];
    const exps = (currentUser.experience || []).map(e => e && e.title).filter(Boolean);
    const edus = (currentUser.education || []).map(e => e && e.degree).filter(Boolean);
    // Sans compétences dans le profil, un score n'aurait pas de sens
    if (!skills.length) return { score: null, matched: [] };
    const jobStems = new Set(tokens(`${j.title} ${j.domain} ${j.fullDescription || j.description}`).map(stem));
    const matched = skills.filter(s => tokens(s).some(t => jobStems.has(stem(t))));
    const profileStems = new Set(tokens([...exps, ...skills, ...edus, currentUser.desiredJob || '', currentUser.headline || ''].join(' ')).map(stem));
    const titleStems = [...new Set(tokens(j.title).map(stem))];
    const titleRatio = titleStems.length ? titleStems.filter(t => profileStems.has(t)).length / titleStems.length : 0;
    const skillRatio = skills.length ? Math.min(1, matched.length / Math.min(skills.length, 4)) : 0;
    let raw = 0.55 * skillRatio + 0.45 * titleRatio;
    // Diplôme et permis demandés par l'offre, comparés au profil
    const notes = [];
    const myLevel = Math.max(0, ...edus.map(diplomaLevel));
    if (j.diploma && j.diploma.level) {
        const need = LEVEL_NAMES[j.diploma.level] || j.diploma.label;
        if (!myLevel) notes.push({ ok: null, text: `Diplôme ${j.diploma.required ? 'exigé' : 'souhaité'} : ${need} (ajoutez vos diplômes au profil pour le comparer)` });
        else if (myLevel >= j.diploma.level) { raw += 0.1; notes.push({ ok: true, text: `Diplôme : ${need} demandé, vous avez le niveau ${LEVEL_NAMES[myLevel]}` }); }
        else { raw *= j.diploma.required ? 0.6 : 0.85; notes.push({ ok: false, text: `Diplôme ${j.diploma.required ? 'exigé' : 'souhaité'} : ${need} (votre niveau : ${LEVEL_NAMES[myLevel]})` }); }
    }
    if (Array.isArray(j.permis) && j.permis.length) {
        const mine = myPermis([...skills, ...edus]);
        for (const p of j.permis) {
            const has = mine.has(p.code) || (p.code === 'B' && [...mine].some(c => /^(C|D|BE|CE|DE)/.test(c)));
            if (has) { raw += 0.05; notes.push({ ok: true, text: `Permis ${p.code} : vous l’avez` }); }
            else { if (p.required) raw *= 0.7; notes.push({ ok: false, text: `Permis ${p.code} ${p.required ? 'exigé' : 'souhaité'} : absent de votre profil` }); }
        }
    }
    return { score: Math.max(0, Math.min(99, Math.round(100 * raw))), matched, notes };
}

// Niveau d'un diplôme du profil sur l'échelle européenne (0 = inconnu : pas de pénalité)
const LEVEL_NAMES = { 2: 'Brevet', 3: 'CAP/BEP', 4: 'Bac', 5: 'Bac+2', 6: 'Bac+3', 7: 'Bac+5', 8: 'Doctorat' };
function diplomaLevel(degree) {
    const t = foldTxt(degree);
    if (/doctorat|\bphd\b|\bhdr\b|docteur|bac\s*\+\s*8/.test(t)) return 8;
    if (/master|ingenieur|\bmba\b|mastere|\bmsc\b|\bdscg\b|expertise comptable|grande ecole|\biep\b|sciences po|\bcapa\b|agregation|architecte|sage-femme|kinesitherapeute|desjeps|cafdes|bac\s*\+\s*5/.test(t)) return 7;
    if (/licence|\bbut\b|bachelor|\bdcg\b|infirmier|educateur specialise|educateur de jeunes enfants|assistant de service social|deass|ergotherapeute|psychomotricien|manipulateur|orthophon|capes|capet|caplp|crpe|caferuis|dn made|bac\s*\+\s*[34]/.test(t)) return 6;
    if (/\bbts\b|\bdut\b|deust|\bdeug\b|dejeps|bac\s*\+\s*2|cesf|technicien superieur|titre professionnel (gestionnaire|technicien superieur|concepteur|administrateur|developpeur|comptable)/.test(t)) return 5;
    if (/\bbac\b|baccalaureat|daeu|bpjeps|\bbp\b|brevet professionnel|\bbma\b|moniteur-educateur|titre professionnel (secretaire|assistant(?! de vie)|technicien|conseiller|negociateur|responsable|manager)/.test(t)) return 4;
    if (/\bcap\b|\bbep\b|\bmc\b|mention complementaire|aide-soignant|auxiliaire de puericulture|accompagnant educatif|ambulancier|titre professionnel/.test(t)) return 3;
    if (/brevet des colleges|\bdnb\b|\bcfg\b/.test(t)) return 2;
    return 0;
}
// Permis de conduire cités dans le profil (« Permis B », « permis C et CE »…)
function myPermis(texts) {
    const out = new Set();
    for (const s of texts) {
        const m = String(s || '').match(/permis\s+((?:[A-E]{1,2}1?(?:\s*(?:,|et|\/|-)\s*)?)+)/i);
        if (m) m[1].split(/[\s,\/-]+|et/i).map(x => x.trim().toUpperCase()).filter(x => /^[A-E]{1,2}1?$/.test(x)).forEach(x => out.add(x));
    }
    return out;
}
function matchBadge(m, size = 'sm') {
    // Sur les cartes, on n'affiche le score que s'il veut dire quelque chose
    if (!m || m.score === null || m.score < 20) return '';
    const cls = m.score >= 70 ? 'bg-emerald-500 text-white' : m.score >= 45 ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-500';
    const pad = size === 'lg' ? 'px-3 py-1.5 text-sm' : 'px-2.5 py-1 text-xs';
    return `<span class="${cls} ${pad} inline-flex items-center gap-1 rounded-full font-bold whitespace-nowrap" title="Compatibilité avec votre profil">${ico('bolt', 'w-3.5 h-3.5')} ${m.score} %</span>`;
}

function favorites() { return (currentUser && Array.isArray(currentUser.favorites) ? currentUser.favorites : []).filter(f => f && typeof f === 'object' && f.id); }
function applications() { return (currentUser && Array.isArray(currentUser.applications) ? currentUser.applications : []).filter(a => a && a.id); }
function isFavorite(id) { return favorites().some(f => f.id === id); }
function appFor(id) { return applications().find(a => a.id === id); }

const STATUSES = [
    { key: 'todo', label: 'À postuler', icon: '📝', dot: 'bg-slate-400', soft: 'bg-slate-100 text-slate-700' },
    { key: 'applied', label: 'Postulé', icon: '📨', dot: 'bg-sky-500', soft: 'bg-sky-50 text-sky-700' },
    { key: 'interview', label: 'Entretien', icon: '🗣️', dot: 'bg-amber-500', soft: 'bg-amber-50 text-amber-700' },
    { key: 'offer', label: 'Offre reçue', icon: '🎉', dot: 'bg-emerald-500', soft: 'bg-emerald-50 text-emerald-700' },
    { key: 'rejected', label: 'Refus', icon: '✖️', dot: 'bg-rose-400', soft: 'bg-rose-50 text-rose-700' }
];
const statusOf = (k) => STATUSES.find(s => s.key === k) || STATUSES[0];
function daysSince(iso) { return iso ? Math.floor((Date.now() - new Date(iso).getTime()) / 86400000) : null; }

function heartIcon(on) {
    return on
        ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="#f43f5e" stroke="#f43f5e" stroke-width="2"><path d="M12 21s-7.5-4.6-9.5-9.2C1 8.3 3.2 5 6.6 5c2 0 3.4 1 5.4 3 2-2 3.4-3 5.4-3 3.4 0 5.6 3.3 4.1 6.8C19.5 16.4 12 21 12 21z"/></svg>'
        : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 21s-7.5-4.6-9.5-9.2C1 8.3 3.2 5 6.6 5c2 0 3.4 1 5.4 3 2-2 3.4-3 5.4-3 3.4 0 5.6 3.3 4.1 6.8C19.5 16.4 12 21 12 21z"/></svg>';
}

function renderJobCard(j, i = 0) {
    jobsById.set(j.id, j);
    const m = computeMatch(j);
    const fav = isFavorite(j.id);
    const app = appFor(j.id);
    const seen = isSeen(j.id);
    const cmp = compareIds.includes(j.id);
    return `
        <article data-id="${esc(j.id)}" onclick="openJobModal(this.dataset.id)" class="group card card-hover p-5 flex flex-col fade-up cursor-pointer ${seen ? 'job-seen' : ''}" style="animation-delay:${i * 40}ms">
            <div class="flex items-start gap-4">
                ${jobAvatar(j)}
                <div class="min-w-0 flex-1">
                    <h3 class="font-bold text-slate-900 leading-snug line-clamp-2 group-hover:text-emerald-700 transition-colors">${esc(j.title)}</h3>
                    <p class="text-sm text-slate-500 truncate mt-0.5">${esc(j.company)}</p>
                    ${j.localOffer || seen ? `<div class="flex flex-wrap gap-2 mt-1.5">
                        ${j.localOffer ? `<span class="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 rounded-full px-2 py-0.5">${ico('shieldCheck', 'w-3 h-3')} Recrute sur JobFacile</span>` : ''}
                        ${seen ? `<span class="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">${ico('eye', 'w-3 h-3')} Déjà vue</span>` : ''}
                    </div>` : ''}
                </div>
                <button type="button" data-fav-id="${esc(j.id)}" onclick="event.stopPropagation(); toggleFavorite(this.dataset.favId)" aria-label="Ajouter aux favoris" class="fav-btn w-9 h-9 shrink-0 rounded-full grid place-items-center text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition">${heartIcon(fav)}</button>
            </div>
            <div class="flex flex-wrap gap-2 mt-4">
                ${matchBadge(m)}
                <span class="text-xs font-bold px-2.5 py-1 rounded-full ${j.category === 'alternance' ? 'bg-violet-50 text-violet-700' : 'bg-emerald-50 text-emerald-700'}">${esc(j.type)}</span>
                <span class="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 max-w-full"><span class="contents">${ico('pin', 'w-3.5 h-3.5')}</span><span class="truncate">${esc(j.location)}</span></span>
                ${commuteChip(j)}
                ${j.salary ? `<span class="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 max-w-full">${ico('euro', 'w-3.5 h-3.5')}<span class="truncate">${esc(j.salary)}</span></span>` : ''}
                ${app ? `<span class="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full ${statusOf(app.status).soft}"><span class="w-1.5 h-1.5 rounded-full ${statusOf(app.status).dot}"></span>${statusOf(app.status).label}</span>` : ''}
            </div>
            <p class="text-sm text-slate-500 mt-3 flex-1 line-clamp-2">${esc(j.description)}</p>
            <div class="flex items-center justify-between gap-2 mt-4 pt-4 border-t border-slate-100">
                <span class="inline-flex items-center gap-1.5 text-xs text-slate-400 min-w-0"><span class="contents">${ico('clock', 'w-3.5 h-3.5')}</span><span class="truncate">${esc(j.date)}${j.source ? ' · ' + esc(j.source) : ''}${(j.alsoOn || []).length ? ' · aussi sur ' + j.alsoOn.map(esc).join(', ') : ''}</span></span>
                <span class="inline-flex items-center gap-1 shrink-0">
                    ${currentUser && authToken ? `<button type="button" data-id="${esc(j.id)}" onclick="event.stopPropagation(); hideJob(this.dataset.id)" title="Pas intéressé : masquer cette offre" aria-label="Masquer cette offre" class="w-8 h-8 rounded-lg grid place-items-center text-slate-400 hover:text-rose-600 hover:bg-rose-50">${ico('eyeOff')}</button>` : ''}
                    <button type="button" data-id="${esc(j.id)}" onclick="event.stopPropagation(); toggleCompare(this.dataset.id)" aria-pressed="${cmp}" title="Comparer (3 offres maximum)" class="cmp-btn inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-bold ${cmp ? 'bg-emerald-600 text-white' : 'text-slate-500 hover:bg-slate-100'}">${ico('compare', 'w-3.5 h-3.5')} ${cmp ? 'Comparée' : 'Comparer'}</button>
                    <span class="text-sm font-bold text-emerald-600 inline-flex items-center gap-1 ml-1 whitespace-nowrap">Voir l'offre <span class="transition-transform group-hover:translate-x-0.5">→</span></span>
                </span>
            </div>
        </article>`;
}

function updateFavButtons() {
    document.querySelectorAll('.fav-btn').forEach(b => { b.innerHTML = heartIcon(isFavorite(b.dataset.favId)); });
}

// ---------- Fiche détaillée ----------
function openJobModal(id) {
    const j = jobsById.get(id);
    if (!j) return;
    openJobId = id;
    const m = computeMatch(j);
    const app = appFor(id);
    const desc = j.fullDescription || j.description || '';
    const logged = currentUser && authToken;
    const hint = (html) => `<div class="rounded-2xl bg-slate-50 border border-slate-200 p-4 text-sm text-slate-600 flex items-start gap-3"><span class="w-8 h-8 shrink-0 rounded-full bg-emerald-50 text-emerald-600 grid place-items-center">${ico('bolt')}</span><p class="pt-1">${html}</p></div>`;
    let matchBlock;
    if (!logged) {
        matchBlock = hint(`<a href="#" onclick="closeJobModal(); openAuthModal('login'); return false;" class="font-bold text-emerald-600 underline">Connectez-vous</a> pour voir votre compatibilité avec cette offre.`);
    } else if (m.score === null) {
        matchBlock = hint(`Pour voir votre compatibilité avec cette offre, <a href="#" onclick="closeJobModal(); accessProfileView('cv'); return false;" class="font-bold text-emerald-600 underline">ajoutez vos compétences</a> à votre profil, ou laissez l'IA les trouver en <a href="#" onclick="closeJobModal(); accessProfileView('cv'); return false;" class="font-bold text-emerald-600 underline">analysant votre CV</a>.`);
    } else {
        const color = m.score >= 70 ? '#10b981' : m.score >= 45 ? '#f59e0b' : '#94a3b8';
        const verdict = m.score >= 70 ? 'Très bonne correspondance avec votre profil' : m.score >= 45 ? 'Correspondance partielle' : m.score >= 20 ? 'Peu de points communs avec votre profil' : 'Cette offre ne correspond pas à votre profil actuel';
        matchBlock = `
            <div class="rounded-2xl border border-slate-200 p-4 flex items-center gap-4">
                <div class="relative w-16 h-16 shrink-0 rounded-full grid place-items-center" style="background: conic-gradient(${color} ${m.score * 3.6}deg, #e2e8f0 0)">
                    <div class="w-12 h-12 rounded-full bg-white grid place-items-center text-sm font-extrabold text-slate-900">${m.score}%</div>
                </div>
                <div class="min-w-0">
                    <p class="font-bold text-slate-900 text-sm">${verdict}</p>
                    <p class="text-xs text-slate-500 mt-1">${m.matched.length ? 'Compétences en commun : ' + m.matched.map(esc).join(', ') : 'Aucune de vos compétences n’est citée dans l’annonce.'}</p>
                    ${(m.notes || []).map(n => `<p class="text-xs mt-1 flex items-start gap-1.5 ${n.ok === true ? 'text-emerald-700' : n.ok === false ? 'text-rose-600' : 'text-slate-500'}">${ico(n.ok === true ? 'check' : n.ok === false ? 'alert' : 'cap', 'w-3.5 h-3.5 mt-px')}<span>${esc(n.text)}</span></p>`).join('')}
                </div>
            </div>`;
    }
    // L'essentiel en 4 cases, puis les outils pour postuler, puis l'annonce
    const fact = (icon, label, value, muted) => `
        <div class="rounded-2xl bg-slate-50 border border-slate-100 p-3 min-w-0">
            <p class="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">${ico(icon, 'w-3.5 h-3.5')}${label}</p>
            <p class="mt-1 text-sm font-bold leading-snug line-clamp-2 ${muted ? 'text-slate-400' : 'text-slate-900'}">${esc(value)}</p>
        </div>`;
    const tool = (icon, title, sub, onclick) => `
        <button type="button" onclick="${onclick}" class="group text-left rounded-2xl border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50 p-3 flex items-start gap-3 transition">
            <span class="w-9 h-9 shrink-0 rounded-xl bg-emerald-50 text-emerald-600 grid place-items-center group-hover:bg-emerald-600 group-hover:text-white transition">${ico(icon)}</span>
            <span class="min-w-0"><span class="block text-sm font-bold text-slate-900">${title}</span><span class="block text-xs text-slate-500 mt-0.5">${sub}</span></span>
        </button>`;
    const section = (title) => `<h4 class="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-400 mt-7 mb-3">${title}<span class="flex-1 h-px bg-slate-100"></span></h4>`;
    document.getElementById('job-modal-body').innerHTML = `
        <div id="apply-prompt"></div>
        <div class="-mx-6 sm:-mx-8 -mt-6 sm:-mt-8 px-6 sm:px-8 pt-6 sm:pt-8 pb-6 mb-5 bg-gradient-to-b from-emerald-50 to-transparent">
            <div class="flex items-start gap-4 pr-10">
                ${jobAvatar(j, 'lg')}
                <div class="min-w-0">
                    <h3 class="text-xl sm:text-2xl font-extrabold text-slate-900 leading-tight">${esc(j.title)}</h3>
                    <p class="text-slate-600 font-semibold mt-1">${esc(j.company)}</p>
                    <div class="flex flex-wrap items-center gap-2 mt-2">
                        <span class="text-xs font-bold px-2.5 py-1 rounded-full ${j.category === 'alternance' ? 'bg-violet-100 text-violet-700' : 'bg-emerald-100 text-emerald-700'}">${esc(j.type || 'Emploi')}</span>
                        ${j.localOffer ? `<span class="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-white rounded-full px-2.5 py-1 border border-emerald-200">${ico('shieldCheck', 'w-3.5 h-3.5')} Entreprise vérifiée (SIRET)</span>` : ''}
                        ${app ? `<span class="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full ${statusOf(app.status).soft}"><span class="w-1.5 h-1.5 rounded-full ${statusOf(app.status).dot}"></span>Dans votre suivi : ${statusOf(app.status).label}</span>` : ''}
                    </div>
                </div>
            </div>
        </div>
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
            ${fact('pin', 'Lieu', j.location || 'France')}
            ${fact('euro', 'Salaire', j.salary || 'Non précisé', !j.salary)}
            ${fact('contract', 'Contrat', j.typeLabel || j.type || 'Non précisé', !(j.typeLabel || j.type))}
            ${j.duration ? fact('clock', 'Horaires', j.duration) : fact('calendar', 'Publiée', j.date || 'Non précisé', !j.date)}
        </div>
        <div class="mt-4">${matchBlock}</div>
        ${requirementsBlock(j)}
        ${section('Préparer ma candidature')}
        <div class="grid sm:grid-cols-2 gap-2">
            ${tool('cv', 'Adapter mon CV', 'Mis en avant pour cette offre', 'tailorCvToOffer(openJobId)')}
            ${tool('sparkles', 'Lettre de motivation', 'Rédigée par l’IA en 1 minute', 'applyWithAI(openJobId)')}
            ${tool('cap', 'Ce qu’il me manque', 'Compétences et formations', 'if (requireLogin()) loadSkillGap(openJobId)')}
            ${tool('scan', 'Test anti-robots (ATS)', 'Mon CV passe-t-il le tri ?', 'runAtsCheck(openJobId)')}
        </div>
        <div id="skill-gap" class="mt-3"></div>
        <div id="ats-box" class="mt-3"></div>
        <div id="job-salary"></div>
        <div id="job-address"></div>
        <div id="job-commute"></div>
        ${section('Description du poste')}
        <p class="text-sm text-slate-600 leading-relaxed whitespace-pre-line">${esc(desc) || 'Aucune description fournie.'}</p>
        ${j.source === 'Adzuna' || desc.length < 600 ? `<p class="text-xs text-slate-400 mt-3">Extrait de l'annonce. La version complète est sur le site d'origine${j.source ? ' (via ' + esc(j.source) + ')' : ''}.</p>` : ''}
        <div class="mt-6 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
            <span class="inline-flex items-center gap-1.5">${ico('clock', 'w-3.5 h-3.5')} ${esc(j.date || '')}${j.source ? ' · ' + esc(j.source) : ''}</span>
            <span class="inline-flex flex-wrap gap-3">
                ${logged ? `<button onclick="hideJob(openJobId, true)" class="inline-flex items-center gap-1 font-semibold hover:text-rose-600">${ico('eyeOff', 'w-3.5 h-3.5')} ${hiddenIds().has(j.id) ? 'Offre masquée · la réafficher' : 'Pas intéressé'}</button>` : ''}
                ${j.localOffer ? `<button onclick="reportContent('offer', openJobId)" class="inline-flex items-center gap-1 font-semibold hover:text-rose-600">${ico('flag', 'w-3.5 h-3.5')} Signaler</button>` : ''}
            </span>
        </div>
    `;
    renderJobModalActions(j);
    markSeen(j.id);
    if (j.localOffer) fetch('/api/local-offers/' + encodeURIComponent(j.id) + '/view', { method: 'POST' }).catch(() => {});
    loadSalaryInsight(j);
    renderJobAddress(j);
    const located = j.exactChecked ? Promise.resolve() : locateJobs([j]).then(() => { if (openJobId === id) renderJobAddress(j); });
    located.then(() => { if (openJobId === id) loadCommuteDetail(j); });
    document.getElementById('job-modal').classList.remove('hidden');
    if (!routing && !(history.state && history.state.modal === id)) {
        modalBaseUrl = location.pathname + location.search;
        try { history.pushState({ modal: id }, '', '/offre/' + encodeURIComponent(id)); } catch (e) {}
    }
    document.getElementById('job-modal-body').scrollTop = 0;
}

// Compétences manquantes + formations (IA), mémorisé par offre
const skillGaps = new Map();
async function loadSkillGap(id) {
    const j = jobsById.get(id);
    const box = document.getElementById('skill-gap');
    if (!j || !box) return;
    if (!skillGaps.has(id)) {
        box.innerHTML = '<div class="rounded-2xl border border-slate-200 p-4 space-y-2"><div class="skeleton h-3 w-2/3"></div><div class="skeleton h-3 w-full"></div><div class="skeleton h-3 w-4/5"></div><p class="text-xs text-slate-400">L’IA compare l’annonce à votre profil…</p></div>';
        const data = await api('/api/ai/skill-gap', { json: { offer: { title: j.title, company: j.company, fullDescription: (j.fullDescription || j.description || '').slice(0, 3000) } } });
        if (!data.success) { box.innerHTML = ''; return showNotification(data.message || 'Analyse impossible.', 'error'); }
        skillGaps.set(id, data.gap);
    }
    if (openJobId !== id) return;
    const g = skillGaps.get(id);
    const city = (currentUser && currentUser.city) || '';
    const ftUrl = (k) => 'https://candidat.francetravail.fr/formations/recherche?motsCles=' + encodeURIComponent(k) + (city ? '&lieu=' + encodeURIComponent(city) : '');
    box.innerHTML = `
        <div class="rounded-2xl border border-slate-200 p-4">
            <p class="font-bold text-slate-900 text-sm mb-2 flex items-center gap-2"><span class="text-emerald-600">${ico('cap')}</span>Vos atouts et ce qu'il vous manque</p>
            ${g.have.length ? `<div class="flex flex-wrap gap-2 mb-3">${g.have.map(h => `<span class="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700">${ico('check', 'w-3 h-3')} ${esc(h)}</span>`).join('')}</div>` : ''}
            ${g.missing.length ? `<ul class="space-y-2">${g.missing.map(m => `
                <li class="rounded-xl bg-slate-50 p-3">
                    <div class="flex flex-wrap items-center gap-2"><span class="font-bold text-sm text-slate-900">${esc(m.skill)}</span><span class="text-[11px] font-bold px-2 py-0.5 rounded-full ${m.importance === 'indispensable' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700'}">${m.importance}</span></div>
                    ${m.training ? `<p class="text-xs text-slate-600 mt-1 flex items-start gap-1.5">${ico('book', 'w-3.5 h-3.5 mt-px text-slate-400')}<span>${esc(m.training)}${m.duration ? ' · ' + esc(m.duration) : ''}${m.funding ? ' · Financement : ' + esc(m.funding) : ''}</span></p>` : ''}
                    <a href="${ftUrl(m.keywords)}" target="_blank" rel="noopener" class="inline-block mt-1.5 text-xs font-bold text-emerald-600 underline">Trouver une formation près de chez moi ↗</a>
                </li>`).join('')}</ul>` : '<p class="text-sm text-emerald-700 font-semibold">Votre profil couvre les exigences principales de l’annonce.</p>'}
            ${g.advice ? `<p class="text-sm text-slate-600 mt-3 flex items-start gap-2">${ico('bulb', 'w-4 h-4 mt-0.5 text-amber-500')}<span>${esc(g.advice)}</span></p>` : ''}
            <p class="text-[11px] text-slate-400 mt-2">Analyse indicative par IA. Durées et financements à vérifier auprès de l'organisme ou de votre conseiller. Votre solde CPF : <a href="https://www.moncompteformation.gouv.fr" target="_blank" rel="noopener" class="underline">moncompteformation.gouv.fr</a></p>
        </div>`;
}

async function loadCommuteDetail(j) {
    const box = document.getElementById('job-commute');
    if (!box || !currentUser || !authToken) return;
    const dest = j.exact || (isFinite(parseFloat(j.lat)) ? { lat: j.lat, lng: j.lng } : null);
    if (!dest) return;
    if (!currentUser.city) {
        box.innerHTML = `<p class="mt-4 text-sm text-slate-500"><a href="#" onclick="closeJobModal(); accessProfileView('info'); setTimeout(() => focusField('prof-city'), 300); return false;" class="font-bold text-emerald-600 underline">Indiquez votre ville</a> pour voir le temps de trajet jusqu'à cette offre.</p>`;
        return;
    }
    const key = dest.lat + ',' + dest.lng;
    if (!j.commuteDetail || j.commuteDetail.key !== key) {
        box.innerHTML = '<div class="mt-4 skeleton h-12 w-full rounded-2xl"></div>';
        const d = await api('/api/commute/detail', { json: { lat: dest.lat, lng: dest.lng } }).catch(() => null);
        if (!d || !d.success) { box.innerHTML = ''; return; }
        j.commuteDetail = { key, ...d };
        if (d.car) j.commute = { carMin: d.car.min, km: d.car.km };
    }
    if (openJobId !== j.id) return;
    const d = j.commuteDetail;
    const fmt = (m) => m >= 60 ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}` : `${m} min`;
    const item = (icon, label, v) => v ? `<div class="rounded-xl bg-slate-50 px-3 py-2 text-center"><p class="flex justify-center text-slate-500 mb-1">${ico(icon, 'w-5 h-5')}</p><p class="font-extrabold text-slate-900 text-sm">${fmt(v.min)}</p><p class="text-[11px] text-slate-500">${label} · ${v.km} km</p></div>` : '';
    const transit = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(d.home.label)}&destination=${dest.lat},${dest.lng}&travelmode=transit`;
    box.innerHTML = `
        <div class="mt-4 rounded-2xl border border-slate-200 p-4">
            <p class="font-bold text-slate-900 text-sm mb-1 flex items-center gap-2"><span class="text-emerald-600">${ico('home')}</span>Trajet depuis chez vous</p>
            <p class="text-[11px] text-slate-400 mb-3">Départ : ${esc(d.home.label)}${d.home.precise ? '' : ' (centre-ville : ajoutez votre adresse au profil pour plus de précision)'}${j.exact ? '' : ' · arrivée approximative (centre de la ville de l\'offre)'}</p>
            <div class="grid grid-cols-3 gap-2">
                ${item('car', 'voiture', d.car)}${item('bike', 'vélo', d.bike)}${item('walk', 'à pied', d.walk)}
                <a href="${transit}" target="_blank" rel="noopener" class="rounded-xl bg-sky-50 hover:bg-sky-100 px-3 py-2 text-center"><p class="flex justify-center text-sky-700 mb-1">${ico('bus', 'w-5 h-5')}</p><p class="font-bold text-sky-800 text-sm">Transports</p><p class="text-[11px] text-sky-700">horaires réels ↗</p></a>
            </div>
            <p class="text-[11px] text-slate-400 mt-2">Voiture hors embouteillages. Calcul : OpenStreetMap (OSRM).</p>
        </div>`;
}

// ---------- Vérificateur ATS ----------
async function runAtsCheck(id) {
    if (!requireLogin()) return;
    const j = id ? jobsById.get(id) : null;
    const box = document.getElementById(id ? 'ats-box' : 'ats-gen-box');
    const targetJob = j ? j.title : document.getElementById('ai-target-job').value.trim();
    if (!targetJob) { document.getElementById('ai-target-job').focus(); return showNotification('Indiquez d’abord le poste visé.', 'error'); }
    box.innerHTML = '<div class="rounded-2xl border border-slate-200 p-4 space-y-2"><div class="skeleton h-3 w-2/3"></div><div class="skeleton h-3 w-full"></div><p class="text-xs text-slate-400">Analyse de votre CV comme le ferait un ATS…</p></div>';
    const body = { targetJob };
    if (j) body.offer = { title: j.title, fullDescription: (j.fullDescription || j.description || '').slice(0, 3000) };
    const d = await api('/api/ai/ats-check', { json: body });
    if (id && openJobId !== id) return;
    if (!d.success) { box.innerHTML = ''; return showNotification(d.message || 'Analyse impossible.', 'error'); }
    const a = d.ats;
    const color = a.score >= 70 ? '#10b981' : a.score >= 45 ? '#f59e0b' : '#f43f5e';
    box.innerHTML = `
        <div class="rounded-2xl border border-slate-200 p-4 text-left">
            <div class="flex items-center gap-3 mb-3">
                <div class="w-14 h-14 shrink-0 rounded-full grid place-items-center" style="background: conic-gradient(${color} ${a.score * 3.6}deg, #e2e8f0 0)"><div class="w-10 h-10 rounded-full bg-white grid place-items-center text-xs font-extrabold text-slate-900">${a.score}</div></div>
                <div><p class="font-bold text-slate-900 text-sm">Score ATS : ${a.score >= 70 ? 'bien parti' : a.score >= 45 ? 'à renforcer' : 'risque d’être écarté'}</p><p class="text-[11px] text-slate-500">Analyse ${a.source === 'pdf' ? 'du CV PDF envoyé dans votre profil' : 'de votre profil JobFacile (envoyez votre CV PDF pour un test exact)'}</p></div>
            </div>
            <p class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Mots-clés attendus</p>
            <div class="flex flex-wrap gap-1.5 mb-3">${a.keywords.map(k => `<span class="text-xs font-semibold px-2 py-0.5 rounded-full ${k.found ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}">${k.found ? '✓' : '✗'} ${esc(k.word)}</span>`).join('')}</div>
            <p class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Lisibilité</p>
            <ul class="space-y-1 text-xs mb-3">${a.checks.map(c => `<li class="${c.ok ? 'text-slate-600' : 'text-rose-700 font-semibold'}">${c.ok ? '✓' : '✗'} ${esc(c.label)}</li>`).join('')}</ul>
            ${a.tips.length ? `<ul class="space-y-1 text-xs text-slate-700 bg-sky-50 rounded-xl p-3">${a.tips.map(t => `<li class="flex items-start gap-1.5">${ico('bulb', 'w-3.5 h-3.5 mt-px text-sky-600')}<span>${esc(t)}</span></li>`).join('')}</ul>` : ''}
            <p class="text-[11px] text-slate-400 mt-2">N'ajoutez que des mots-clés qui correspondent vraiment à votre expérience.</p>
        </div>`;
}

// ---------- Salaire : comparaison avec le marché local ----------
// "1 800 € – 2 100 € / mois" → brut mensuel (même règle que le serveur)
function monthlyFromText(str) {
    const t = String(str || '').replace(/[\u202f\u00a0]/g, ' ');
    const nums = (t.match(/\d[\d ]*(?:[.,]\d+)?/g) || []).map(n => parseFloat(n.replace(/ /g, '').replace(',', '.'))).filter(n => n > 0);
    if (!nums.length) return null;
    const avg = nums.length > 1 ? (nums[0] + nums[1]) / 2 : nums[0];
    let v = avg;
    if (/\ban\b|annuel|year/i.test(t) || v > 10000) v /= 12;
    else if (/heure|horaire|\/ ?h\b/i.test(t) || v < 100) v *= 151.67;
    else if (/jour/i.test(t) || v < 1000) v *= 21;
    return v >= 500 && v <= 30000 ? Math.round(v) : null;
}
const salaryCache = new Map();
async function loadSalaryInsight(j) {
    const box = document.getElementById('job-salary');
    if (!box) return;
    const key = j.title + '|' + j.location;
    if (!salaryCache.has(key)) {
        salaryCache.set(key, api('/api/salary?' + new URLSearchParams({ keyword: j.title, location: j.location })).catch(() => null));
    }
    const d = await salaryCache.get(key);
    if (openJobId !== j.id || !d || !d.success || !d.enough) return;
    const eur = (v) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(v) + ' €';
    const offer = monthlyFromText(j.salary);
    const lo = Math.min(d.p25, offer || d.p25) * 0.9, hi = Math.max(d.p75, offer || d.p75) * 1.1;
    const pos = (v) => Math.max(0, Math.min(100, (v - lo) / (hi - lo) * 100));
    let verdict = '';
    if (offer) {
        const diff = Math.round((offer - d.median) / d.median * 100);
        verdict = Math.abs(diff) < 5 ? '<span class="text-slate-700">≈ dans la moyenne du marché</span>'
            : diff > 0 ? `<span class="text-emerald-700">+${diff} % au-dessus du marché</span>` : `<span class="text-rose-600">${diff} % en dessous du marché</span>`;
    }
    box.innerHTML = `
        <div class="mt-4 rounded-2xl border border-slate-200 p-4">
            <div class="flex flex-wrap items-baseline justify-between gap-2 mb-3">
                <p class="font-bold text-slate-900 text-sm flex items-center gap-2"><span class="text-amber-500">${ico('euro')}</span>${offer ? 'Ce salaire face au marché' : 'Salaire estimé pour ce poste'}</p>
                ${offer ? `<p class="text-sm font-bold">${verdict}</p>` : `<p class="text-sm font-extrabold text-slate-900">${eur(d.p25)} – ${eur(d.p75)} <span class="font-normal text-xs text-slate-500">brut / mois</span></p>`}
            </div>
            <div class="relative h-2.5 rounded-full bg-slate-100 mx-1">
                <div class="absolute h-full rounded-full bg-emerald-200" style="left:${pos(d.p25)}%; width:${pos(d.p75) - pos(d.p25)}%"></div>
                <div class="absolute -top-1 w-0.5 h-4 bg-emerald-700" style="left:${pos(d.median)}%" title="Médiane"></div>
                ${offer ? `<div class="absolute -top-1.5 w-3.5 h-3.5 -ml-1.5 rounded-full bg-amber-500 border-2 border-white shadow" style="left:${pos(offer)}%" title="Cette offre"></div>` : ''}
            </div>
            <div class="flex justify-between text-[11px] text-slate-500 mt-2">
                <span>25 % gagnent moins de ${eur(d.p25)}</span><span class="font-bold text-emerald-700">médiane ${eur(d.median)}</span><span>25 % plus de ${eur(d.p75)}</span>
            </div>
            ${offer ? `<p class="text-[11px] text-slate-500 mt-1">● Cette offre : environ ${eur(offer)} brut / mois</p>` : ''}
            <p class="text-[11px] text-slate-400 mt-2">D'après ${d.n} offres récentes « ${esc(d.what)} » ${d.scope === 'local' ? 'à moins de 30 km de ' + esc(d.where) : 'en France (trop peu d’offres locales)'}, ramenées en brut mensuel temps plein. Indicatif.</p>
        </div>`;
}

function renderJobAddress(j) {
    const box = document.getElementById('job-address');
    if (!box) return;
    box.innerHTML = j.exact ? `
        <div class="mt-4 rounded-2xl border border-slate-200 p-4 flex items-start gap-3">
            <span class="w-9 h-9 shrink-0 rounded-xl bg-emerald-50 text-emerald-600 grid place-items-center">${ico('building')}</span>
            <div class="min-w-0 flex-1">
                <p class="font-bold text-slate-900 text-sm">${esc(j.exact.name || j.company)}</p>
                <p class="text-sm text-slate-600">${esc(j.exact.address)}</p>
                <p class="text-[11px] text-slate-400 mt-1">Établissement trouvé dans l'annuaire officiel des entreprises. Vérifiez le lieu de travail dans l'annonce.</p>
            </div>
            <a href="${directionsUrl(j.exact)}" target="_blank" rel="noopener" class="shrink-0 px-3 py-2 rounded-xl bg-emerald-50 text-emerald-700 text-xs font-bold hover:bg-emerald-100">Itinéraire ↗</a>
        </div>` : '';
}

function requirementsBlock(j) {
    const reqs = offerRequirements(j);
    if (!reqs.length) return '';
    const logged = currentUser && authToken;
    const missing = reqs.filter(r => !r.ok).length;
    return `
        <div class="mt-4 rounded-2xl border border-slate-200 p-4">
            <p class="font-bold text-slate-900 text-sm mb-2 flex items-center gap-2"><span class="text-emerald-600">${ico('id')}</span>Permis et habilitations cités dans l'annonce</p>
            <div class="flex flex-wrap gap-2">${reqs.map(r => logged
                ? `<span class="text-xs font-bold px-2.5 py-1 rounded-full ${r.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}">${r.ok ? '✓' : '✗'} ${esc(r.label)}</span>`
                : `<span class="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">${esc(r.label)}</span>`).join('')}</div>
            ${logged && missing ? `<p class="text-xs text-slate-500 mt-2">Vous l'avez déjà ? <a href="#" onclick="closeJobModal(); accessProfileView('info'); setTimeout(() => focusField('prof-licenses'), 300); return false;" class="font-bold text-emerald-600 underline">Ajoutez-le à votre profil</a>.</p>` : ''}
        </div>`;
}

function renderJobModalActions(j) {
    const fav = isFavorite(j.id);
    const app = appFor(j.id);
    const square = 'btn-ghost w-12 h-12 shrink-0 rounded-xl border border-slate-200 bg-white grid place-items-center';
    const primary = 'btn-primary flex-1 min-w-0 inline-flex items-center justify-center gap-2 px-4 h-12 rounded-xl text-sm font-bold';
    const trackBtn = app
        ? `<select onchange="updateApplication(openJobId, { status: this.value })" aria-label="Étape de ma candidature" title="Étape de ma candidature" class="field !h-12 !py-0 text-sm font-semibold !w-auto max-w-[9.5rem] shrink-0">${STATUSES.map(s => `<option value="${s.key}" ${s.key === app.status ? 'selected' : ''}>${s.label}</option>`).join('')}</select>`
        : `<button onclick="addToTracker(openJobId, 'todo')" title="Ajouter à mon suivi de candidatures" aria-label="Ajouter à mon suivi de candidatures" class="${square} text-slate-600">${ico('track', 'w-5 h-5')}</button>`;
    document.getElementById('job-modal-actions').innerHTML = `
        ${j.localOffer ? (app && app.conversationId
            ? `<button data-c="${esc(app.conversationId)}" onclick="closeJobModal(true); openMessages(this.dataset.c)" class="${primary}">${ico('chat')}<span class="truncate">Voir l’échange avec le recruteur</span></button>`
            : `<button onclick="openApplyForm(openJobId)" class="${primary}">${ico('send')}<span class="truncate">Postuler via JobFacile</span></button>`) : ''}
        ${j.url ? `<a href="${esc(j.url)}" target="_blank" rel="noopener" onclick="showApplyPrompt()" class="${primary}"><span class="truncate sm:hidden">Postuler</span><span class="truncate hidden sm:inline">Postuler sur le site de l’offre</span>${ico('external')}</a>` : ''}
        ${!j.localOffer && !j.url ? '<span class="flex-1"></span>' : ''}
        <button onclick="toggleFavorite(openJobId)" title="${fav ? 'Retirer des favoris' : 'Garder dans mes favoris'}" aria-label="${fav ? 'Retirer des favoris' : 'Garder dans mes favoris'}" class="${square} ${fav ? 'text-rose-600 border-rose-200 bg-rose-50' : 'text-slate-600'}">${heartIcon(fav)}</button>
        ${trackBtn}
        <button onclick="shareOffer(openJobId)" aria-label="Partager l'offre" title="Partager l'offre" class="${square} text-slate-600">${ico('share', 'w-5 h-5')}</button>
    `;
}

function showApplyPrompt() {
    if (!currentUser || !authToken || !openJobId) return;
    const app = appFor(openJobId);
    if (app && app.status !== 'todo') return;
    setTimeout(() => {
        const box = document.getElementById('apply-prompt');
        if (!box) return;
        box.innerHTML = `
            <div class="bubble-in mb-5 rounded-2xl border border-sky-200 bg-sky-50 p-4 flex flex-wrap items-center gap-3 justify-between">
                <p class="text-sm font-semibold text-sky-800">📨 Vous avez postulé à cette offre ?</p>
                <button onclick="addToTracker(openJobId, 'applied')" class="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-sm font-bold">Oui, l'ajouter au suivi</button>
            </div>`;
    }, 800);
}

function closeJobModal(byUser = false) {
    const modal = document.getElementById('job-modal');
    if (modal.classList.contains('hidden')) return;
    modal.classList.add('hidden');
    openJobId = null;
    // Fermée par l'utilisateur : on revient en arrière ; sinon (navigation qui suit, lien ouvert directement) on remplace l'adresse
    if (byUser && history.state && history.state.modal) history.back();
    else if (location.pathname.startsWith('/offre/')) { history.replaceState({}, '', modalBaseUrl || '/offres'); modalBaseUrl = null; }
}

// Après une modification (favori, suivi) : rafraîchit tout ce qui est affiché
// ---------- Offres masquées / déjà vues ----------
let showHiddenJobs = false;
const seenLocal = new Set();
let seenQueue = [], seenTimer = null;
function hiddenIds() { return new Set(((currentUser && currentUser.hiddenJobs) || []).map(x => x.id)); }
function isSeen(id) { return seenLocal.has(id) || !!(currentUser && (currentUser.seenJobs || []).includes(id)); }
function markSeen(id) {
    if (!currentUser || !authToken || isSeen(id)) return;
    seenLocal.add(id);
    document.querySelectorAll(`article[data-id="${CSS.escape(id)}"]`).forEach(a => a.classList.add('job-seen'));
    seenQueue.push(id);
    clearTimeout(seenTimer);
    seenTimer = setTimeout(async () => {
        const ids = seenQueue; seenQueue = [];
        const d = await api('/api/user/job-flags', { json: { seen: ids } }).catch(() => null);
        if (d && d.success) currentUser = { ...currentUser, seenJobs: d.user.seenJobs };
    }, 2500);
}
async function hideJob(id, fromModal = false) {
    if (!requireLogin()) return;
    const j = jobsById.get(id) || {};
    const already = hiddenIds().has(id);
    const d = await api('/api/user/job-flags', { json: already ? { unhide: id } : { hide: { id, title: j.title, company: j.company } } });
    if (!d.success) return showNotification(d.message, 'error');
    setSession(d.user);
    if (fromModal) closeJobModal(true);
    if (already) { showNotification('Offre réaffichée'); fetchJobs(lastJobsPage); return; }
    const card = document.querySelector(`#jobs-container article[data-id="${CSS.escape(id)}"]`);
    if (card && !showHiddenJobs) card.remove();
    showUndo('Offre masquée. Vous ne la verrez plus.', () => hideJob(id));
}
function showUndo(text, undo) {
    showNotification(text);
    window._lastUndo = undo;
}

// ---------- Comparateur (3 offres maximum) ----------
let compareIds = [];
function toggleCompare(id) {
    if (compareIds.includes(id)) compareIds = compareIds.filter(x => x !== id);
    else {
        if (compareIds.length >= 3) return showNotification('3 offres maximum : retirez-en une pour en ajouter une autre.', 'error');
        compareIds.push(id);
    }
    updateCompareUI();
}
function clearCompare() { compareIds = []; updateCompareUI(); }
function updateCompareUI() {
    document.querySelectorAll('.cmp-btn').forEach(b => {
        const on = compareIds.includes(b.dataset.id);
        b.setAttribute('aria-pressed', on);
        b.className = 'cmp-btn inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-bold ' + (on ? 'bg-emerald-600 text-white' : 'text-slate-500 hover:bg-slate-100');
        b.innerHTML = ico('compare', 'w-3.5 h-3.5') + (on ? ' Comparée' : ' Comparer');
    });
    const bar = document.getElementById('compare-bar');
    bar.classList.toggle('hidden', !compareIds.length);
    document.getElementById('compare-count').textContent = `${compareIds.length} offre${compareIds.length > 1 ? 's' : ''} sélectionnée${compareIds.length > 1 ? 's' : ''}`;
    document.getElementById('compare-open').disabled = compareIds.length < 2;
    document.getElementById('compare-open').classList.toggle('opacity-50', compareIds.length < 2);
}
function closeCompare() { document.getElementById('compare-modal').classList.add('hidden'); }
async function openCompare() {
    const jobs = compareIds.map(id => jobsById.get(id)).filter(Boolean);
    if (jobs.length < 2) return;
    await loadCommutes(jobs).catch(() => {});
    const logged = currentUser && authToken;
    const rows = [
        ['Entreprise', j => esc(j.company)],
        ['Contrat', j => esc(j.type || '—')],
        ['Lieu', j => esc(j.location)],
        ['Salaire', j => j.salary ? `<strong>${esc(j.salary)}</strong>` : '<span class="text-slate-400">Non indiqué</span>'],
        ['Durée / horaires', j => esc(j.duration || j.typeLabel || '—')],
        logged ? ['Trajet en voiture', j => j.commute ? `${j.commute.carMin} min · ${j.commute.km} km` : '<span class="text-slate-400">—</span>'] : null,
        logged ? ['Compatibilité', j => { const m = computeMatch(j); return m && m.score !== null ? `${m.score} %` : '—'; }] : null,
        ['Permis / habilitations', j => { const r = offerRequirements(j); return r.length ? r.map(x => `<span class="${logged ? (x.ok ? 'text-emerald-700' : 'text-rose-600') : ''}">${logged ? (x.ok ? '✓' : '✗') : '•'} ${esc(x.label)}</span>`).join('<br>') : '<span class="text-slate-400">Aucun cité</span>'; }],
        ['Publiée', j => esc(j.date || '—')],
        ['Source', j => esc(j.source || '—')]
    ].filter(Boolean);
    const best = (fn) => { const v = jobs.map(fn); const m = Math.min(...v.filter(x => x !== null)); return v.map(x => x !== null && x === m && v.filter(y => y === m).length === 1); };
    const fastest = best(j => j.commute ? j.commute.carMin : null);
    document.getElementById('compare-body').innerHTML = `
        <table class="w-full text-sm border-separate border-spacing-0 min-w-[560px]">
            <thead><tr><th class="w-36"></th>${jobs.map(j => `<th class="text-left align-top p-3 border-b border-slate-200"><p class="font-extrabold text-slate-900 leading-snug">${esc(j.title)}</p><button data-id="${esc(j.id)}" onclick="closeCompare(); openJobModal(this.dataset.id)" class="mt-1 text-xs font-bold text-emerald-600 underline">Voir l'offre</button></th>`).join('')}</tr></thead>
            <tbody>${rows.map(([label, fn]) => `<tr><th class="text-left align-top p-3 border-b border-slate-100 text-xs font-bold text-slate-500 uppercase tracking-wider">${label}</th>${jobs.map((j, i) => `<td class="align-top p-3 border-b border-slate-100 text-slate-700 ${label === 'Trajet en voiture' && fastest[i] ? 'bg-emerald-50' : ''}">${fn(j)}</td>`).join('')}</tr>`).join('')}</tbody>
        </table>
        <p class="text-xs text-slate-400 mt-3">Les salaires sont ceux indiqués dans les annonces (brut, période variable selon l'offre).</p>`;
    document.getElementById('compare-modal').classList.remove('hidden');
}

// ---------- Offres près de ma position ----------
function searchNearMe() {
    if (!navigator.geolocation) return showNotification('Votre navigateur ne permet pas la géolocalisation.', 'error');
    const btn = document.getElementById('geo-btn');
    const pinIcon = btn.innerHTML;
    btn.innerHTML = '<span class="w-4 h-4 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin"></span>';
    navigator.geolocation.getCurrentPosition(async (pos) => {
        try {
            const { latitude, longitude } = pos.coords;
            const r = await fetch(`https://api-adresse.data.gouv.fr/reverse/?lon=${longitude}&lat=${latitude}&type=municipality&limit=1`);
            const f = ((await r.json()).features || [])[0];
            if (!f) throw new Error('lieu');
            document.getElementById('location').value = f.properties.city || f.properties.name;
            document.getElementById('radius-select').value = '10';
            showNotification(`Offres autour de ${f.properties.city || f.properties.name}`);
            fetchJobs(1);
        } catch (e) { showNotification('Impossible de trouver votre commune. Saisissez-la à la main.', 'error'); }
        finally { btn.innerHTML = pinIcon; }
    }, (err) => {
        btn.innerHTML = pinIcon;
        showNotification(err.code === 1 ? 'Localisation refusée : autorisez-la dans votre navigateur, ou saisissez votre ville.' : 'Position introuvable pour le moment.', 'error');
    }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 });
}

function refreshJobViews() {
    updateFavButtons();
    if (openJobId && jobsById.has(openJobId)) {
        const scroll = document.getElementById('job-modal-body').scrollTop;
        openJobModal(openJobId);
        document.getElementById('job-modal-body').scrollTop = scroll;
    }
    if (!document.getElementById('view-tracker').classList.contains('hidden')) renderTracker();
}

async function toggleFavorite(id) {
    if (!requireLogin()) return;
    const job = jobsById.get(id) || favorites().find(f => f.id === id);
    if (!job) return;
    const data = await api('/api/user/favorites/toggle', { json: { job } });
    if (!data.success) return showNotification(data.message, 'error');
    setSession(data.user);
    showNotification(data.isFavorite ? 'Offre ajoutée à vos favoris ❤️' : 'Offre retirée des favoris');
    refreshJobViews();
}

async function addToTracker(id, status = 'todo') {
    if (!requireLogin()) return;
    const job = jobsById.get(id);
    if (!job) return;
    const data = await api('/api/user/applications', { json: { job, status } });
    if (!data.success) return showNotification(data.message, 'error');
    setSession(data.user);
    showNotification(`Ajoutée à votre suivi : ${statusOf(status).label}`);
    refreshJobViews();
}

async function updateApplication(id, patch) {
    if (!requireLogin()) return;
    const data = await api('/api/user/applications', { json: { id, ...patch } });
    if (!data.success) return showNotification(data.message, 'error');
    setSession(data.user);
    if (patch.status) showNotification(`Statut mis à jour : ${statusOf(patch.status).label}`);
    else if (patch.remove) showNotification('Candidature retirée du suivi');
    else if (patch.notes !== undefined) showNotification('Notes enregistrées');
    refreshJobViews();
}

// ---------- E-mail de relance / remerciement par IA ----------
let fuAppId = null, fuKind = 'relance';
async function openFollowUp(id, kind, regenerate = false) {
    if (!requireLogin()) return;
    const a = appFor(id);
    if (!a) return;
    fuAppId = id; fuKind = kind;
    document.getElementById('fu-title').textContent = kind === 'thanks' ? '✉️ E-mail de remerciement' : '✉️ E-mail de relance';
    document.getElementById('fu-sub').textContent = `${(a.job || {}).title || ''} · ${(a.job || {}).company || ''}`;
    document.getElementById('fu-loading').classList.remove('hidden');
    document.getElementById('fu-result').classList.add('hidden');
    document.getElementById('fu-modal').classList.remove('hidden');
    const data = await api('/api/ai/follow-up', { json: { id, kind } });
    if (fuAppId !== id) return;
    if (!data.success) { closeFollowUp(); return showNotification(data.message || 'Rédaction impossible.', 'error'); }
    document.getElementById('fu-subject').value = data.subject;
    document.getElementById('fu-body').value = data.body;
    // Une adresse e-mail notée dans la candidature sert de destinataire
    if (!regenerate) document.getElementById('fu-to').value = (String(a.notes || '').match(/[^\s@<>(),;:]+@[^\s@<>(),;:]+\.[a-z]{2,}/i) || [''])[0];
    document.getElementById('fu-loading').classList.add('hidden');
    document.getElementById('fu-result').classList.remove('hidden');
}
function closeFollowUp() { document.getElementById('fu-modal').classList.add('hidden'); fuAppId = null; }
async function copyFollowUp() {
    const text = `Objet : ${document.getElementById('fu-subject').value}\n\n${document.getElementById('fu-body').value}`;
    try { await navigator.clipboard.writeText(text); showNotification('E-mail copié !'); }
    catch (e) { showNotification('Copie impossible : sélectionnez le texte à la main.', 'error'); }
}
function mailFollowUp() {
    const to = document.getElementById('fu-to').value.trim();
    location.href = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(document.getElementById('fu-subject').value)}&body=${encodeURIComponent(document.getElementById('fu-body').value)}`;
}
async function markFollowedUp() {
    const id = fuAppId;
    if (!id) return;
    closeFollowUp();
    const data = await api('/api/user/applications', { json: { id, followedUp: true } });
    if (!data.success) return showNotification(data.message, 'error');
    setSession(data.user);
    showNotification('Relance notée dans votre suivi ✓');
    refreshJobViews();
}

// ---------- Lettre IA ciblée sur une offre ----------
function applyWithAI(id) {
    if (!requireLogin()) return;
    const j = jobsById.get(id);
    if (!j) return;
    targetOffer = j;
    closeJobModal();
    pickDocType('lm');
    document.getElementById('ai-target-job').value = j.title;
    document.getElementById('ai-offer-chip-text').innerText = `${j.title} — ${j.company}`;
    document.getElementById('ai-offer-chip').classList.remove('hidden');
    switchView('ai-generator');
    generateAIDocument();
}
// CV adapté à une offre : accroche, compétences et missions remises dans l'ordre de l'annonce
function tailorCvToOffer(id) {
    if (!requireLogin()) return;
    const j = jobsById.get(id);
    if (!j) return;
    targetOffer = j;
    closeJobModal();
    pickDocType('cv');
    pickCvTemplate(cvTemplate);
    document.getElementById('ai-target-job').value = j.title;
    document.getElementById('ai-offer-chip-text').innerText = `${j.title} — ${j.company}`;
    document.getElementById('ai-offer-chip').classList.remove('hidden');
    switchView('ai-generator');
    generateAIDocument();
}
function clearTargetOffer() {
    targetOffer = null;
    document.getElementById('ai-offer-chip').classList.add('hidden');
}
