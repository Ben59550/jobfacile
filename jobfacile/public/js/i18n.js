// JobFacile · Langues de l'interface : français (d'origine), anglais, arabe (de droite à gauche), polonais.
// Les textes de l'interface sont remplacés à l'affichage grâce aux dictionnaires public/i18n/<langue>.json
// (générés par « npm run i18n », modifiables à la main). Restent en français : les offres d'emploi,
// les messages et le forum (écrits par les utilisateurs), les pages légales (version qui fait foi).
// Script classique, chargé en premier : il traduit aussi ce que les autres scripts affichent ensuite.

// Doit correspondre à LANGS dans scripts/i18n-translate.js (sauf le français, langue d'origine)
const LANGUAGES = {
    fr: ['Français', 'ltr', 'FR'], en: ['English', 'ltr', 'EN'], de: ['Deutsch', 'ltr', 'DE'], es: ['Español', 'ltr', 'ES'],
    it: ['Italiano', 'ltr', 'IT'], pt: ['Português', 'ltr', 'PT'], nl: ['Nederlands', 'ltr', 'NL'], pl: ['Polski', 'ltr', 'PL'],
    ro: ['Română', 'ltr', 'RO'], el: ['Ελληνικά', 'ltr', 'EL'], cs: ['Čeština', 'ltr', 'CS'], sk: ['Slovenčina', 'ltr', 'SK'],
    hu: ['Magyar', 'ltr', 'HU'], bg: ['Български', 'ltr', 'BG'], hr: ['Hrvatski', 'ltr', 'HR'], sl: ['Slovenščina', 'ltr', 'SL'],
    da: ['Dansk', 'ltr', 'DA'], sv: ['Svenska', 'ltr', 'SV'], no: ['Norsk', 'ltr', 'NO'], fi: ['Suomi', 'ltr', 'FI'],
    et: ['Eesti', 'ltr', 'ET'], lv: ['Latviešu', 'ltr', 'LV'], lt: ['Lietuvių', 'ltr', 'LT'], ga: ['Gaeilge', 'ltr', 'GA'],
    mt: ['Malti', 'ltr', 'MT'], uk: ['Українська', 'ltr', 'UK'], ar: ['العربية', 'rtl', 'ع']
};
const I18N_ATTRS = ['placeholder', 'aria-label', 'title', 'alt'];
const LEGAL_NOTICE = {
    en: 'This page is only available in French, which is the legally binding version.',
    ar: 'هذه الصفحة متوفرة باللغة الفرنسية فقط، وهي النسخة المعتمدة قانونياً.',
    pl: 'Ta strona jest dostępna tylko po francusku – to wersja wiążąca prawnie.',
    de: 'Diese Seite ist nur auf Französisch verfügbar; dies ist die rechtsverbindliche Fassung.',
    es: 'Esta página solo está disponible en francés, que es la versión jurídicamente vinculante.',
    it: 'Questa pagina è disponibile solo in francese, che è la versione giuridicamente vincolante.',
    pt: 'Esta página só está disponível em francês, que é a versão juridicamente vinculativa.',
    nl: 'Deze pagina is alleen beschikbaar in het Frans; dat is de juridisch bindende versie.',
    ro: 'Această pagină este disponibilă doar în franceză, care este versiunea cu valoare juridică.',
    el: 'Αυτή η σελίδα είναι διαθέσιμη μόνο στα γαλλικά, που είναι η νομικά δεσμευτική έκδοση.',
    cs: 'Tato stránka je k dispozici pouze ve francouzštině, která je právně závaznou verzí.',
    sk: 'Táto stránka je dostupná iba vo francúzštine, ktorá je právne záväznou verziou.',
    hu: 'Ez az oldal csak franciául érhető el, ez a jogilag kötelező változat.',
    bg: 'Тази страница е достъпна само на френски език, който е правно обвързващата версия.',
    hr: 'Ova je stranica dostupna samo na francuskom, što je pravno obvezujuća verzija.',
    sl: 'Ta stran je na voljo samo v francoščini, ki je pravno zavezujoča različica.',
    da: 'Denne side findes kun på fransk, som er den juridisk bindende version.',
    sv: 'Den här sidan finns bara på franska, som är den juridiskt bindande versionen.',
    no: 'Denne siden er bare tilgjengelig på fransk, som er den juridisk bindende versjonen.',
    fi: 'Tämä sivu on saatavilla vain ranskaksi, joka on oikeudellisesti sitova versio.',
    et: 'See leht on saadaval ainult prantsuse keeles, mis on õiguslikult siduv versioon.',
    lv: 'Šī lapa ir pieejama tikai franču valodā, kas ir juridiski saistošā versija.',
    lt: 'Šis puslapis prieinamas tik prancūzų kalba – tai teisiškai įpareigojanti versija.',
    ga: 'Níl an leathanach seo ar fáil ach i bhFraincis, arb í an leagan atá ceangailteach go dlíthiúil.',
    mt: 'Din il-paġna hija disponibbli biss bil-Franċiż, li hija l-verżjoni legalment vinkolanti.',
    uk: 'Ця сторінка доступна лише французькою мовою, яка є юридично обов’язковою версією.'
};
let currentLang = 'fr', dict = null, i18nObserver = null, applyingI18n = false;
const originalText = new WeakMap(); // nœud de texte → texte français d'origine

function i18nNorm(t) { return String(t).replace(/\s+/g, ' ').trim(); }
// Zones à ne jamais traduire : contenus écrits par les utilisateurs ou les recruteurs, champs de saisie
function skipNode(el) {
    return !el || el.closest('script, style, textarea, [translate="no"], .notranslate, #view-legal article, #msg-list, #conv-list, [data-body], #jobs-container article p, #job-modal-body .whitespace-pre-line');
}
function translateTextNode(node) {
    if (!node.parentElement || skipNode(node.parentElement)) return;
    const fr = originalText.has(node) ? originalText.get(node) : node.nodeValue;
    const key = i18nNorm(fr);
    if (!key) return;
    if (currentLang === 'fr' || !dict) { if (originalText.has(node) && node.nodeValue !== fr) node.nodeValue = fr; return; }
    const tr = dict[key];
    if (!tr) return;
    if (!originalText.has(node)) originalText.set(node, fr);
    // garde les espaces autour du texte (mise en page)
    const lead = fr.match(/^\s*/)[0], trail = fr.match(/\s*$/)[0];
    const val = lead + tr + trail;
    if (node.nodeValue !== val) node.nodeValue = val;
}
function translateAttrs(el) {
    if (skipNode(el)) return;
    for (const a of I18N_ATTRS) {
        if (!el.hasAttribute(a) && !el.hasAttribute('data-fr-' + a)) continue;
        const fr = el.getAttribute('data-fr-' + a) ?? el.getAttribute(a);
        if (currentLang === 'fr' || !dict) { if (el.hasAttribute('data-fr-' + a)) { el.setAttribute(a, fr); el.removeAttribute('data-fr-' + a); } continue; }
        const tr = dict[i18nNorm(fr)];
        if (!tr) continue;
        if (!el.hasAttribute('data-fr-' + a)) el.setAttribute('data-fr-' + a, fr);
        if (el.getAttribute(a) !== tr) el.setAttribute(a, tr);
    }
}
function translateTree(root) {
    if (!root) return;
    if (root.nodeType === 3) { translateTextNode(root); return; }
    if (root.nodeType !== 1) return;
    translateAttrs(root);
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
    let n;
    while ((n = walker.nextNode())) { if (n.nodeType === 3) translateTextNode(n); else translateAttrs(n); }
}
function applyI18n() {
    applyingI18n = true;
    try { translateTree(document.body); document.title = translateTitle(document.title); }
    finally { applyingI18n = false; }
    updateLegalNotice();
}
function translateTitle(t) {
    if (!dict || currentLang === 'fr') return t;
    return t.split(' – ').map(p => dict[i18nNorm(p)] || p).join(' – ');
}
// Ce qui s'affiche après coup (fenêtres, résultats, notifications) est traduit au fil de l'eau
function watchI18n() {
    if (i18nObserver) return;
    let queue = new Set(), scheduled = false;
    i18nObserver = new MutationObserver((records) => {
        if (applyingI18n || currentLang === 'fr') return;
        for (const r of records) {
            if (r.type === 'childList') r.addedNodes.forEach(n => queue.add(n));
            else if (r.type === 'characterData' && !originalText.has(r.target)) queue.add(r.target);
            else if (r.type === 'attributes') queue.add(r.target);
        }
        if (scheduled) return;
        scheduled = true;
        requestAnimationFrame(() => {
            scheduled = false;
            applyingI18n = true;
            try { queue.forEach(n => { if (n.isConnected) translateTree(n); }); }
            finally { applyingI18n = false; queue = new Set(); }
            const t = translateTitle(document.title);
            if (t !== document.title) document.title = t;
        });
    });
    i18nObserver.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: I18N_ATTRS });
}

async function setLanguage(lang, { save = true } = {}) {
    if (!LANGUAGES[lang]) lang = 'fr';
    if (lang !== 'fr') {
        try {
            const r = await fetch(`/i18n/${lang}.json`);
            if (!r.ok) throw new Error(r.status);
            dict = await r.json();
        } catch (e) { showNotification('Traduction indisponible pour le moment.', 'error'); return; }
    }
    // Un nœud déjà traduit dans une autre langue repart du français
    const previous = currentLang;
    currentLang = lang;
    if (previous !== 'fr' && lang !== 'fr') { const d = dict; currentLang = 'fr'; applyI18n(); currentLang = lang; dict = d; }
    document.documentElement.lang = lang;
    document.documentElement.dir = LANGUAGES[lang][1];
    if (save) { try { localStorage.setItem('jf-lang', lang); } catch (e) {} }
    applyI18n();
    if (lang !== 'fr') watchI18n();
    renderLangButton();
}
function updateLegalNotice() {
    const view = document.getElementById('view-legal');
    if (!view) return;
    let box = document.getElementById('legal-lang-notice');
    if (currentLang === 'fr') { if (box) box.remove(); return; }
    if (!box) { box = document.createElement('p'); box.id = 'legal-lang-notice'; box.className = 'mb-4 rounded-xl bg-sky-50 border border-sky-200 text-sky-800 px-4 py-3 text-sm font-semibold'; view.prepend(box); }
    box.textContent = LEGAL_NOTICE[currentLang];
}

// ---------- Sélecteur de langue (en-tête) ----------
function renderLangButton() {
    const b = document.getElementById('lang-btn');
    if (b) { b.textContent = LANGUAGES[currentLang][2]; b.setAttribute('aria-label', 'Langue : ' + LANGUAGES[currentLang][0]); }
    const menu = document.getElementById('lang-options');
    if (menu) menu.innerHTML = Object.entries(LANGUAGES).map(([k, [name]]) => `
        <button role="menuitemradio" aria-checked="${k === currentLang}" lang="${k}" data-k="${k}" onclick="setLanguage(this.dataset.k); closeLangMenu()" translate="no"
            class="w-full text-left px-3 py-2 rounded-xl text-sm font-semibold ${k === currentLang ? 'bg-slate-100 text-slate-900' : 'text-slate-600 hover:bg-slate-50'}">${name}${k === currentLang ? ' ✓' : ''}</button>`).join('');
}
function toggleLangMenu(e) {
    if (e) e.stopPropagation();
    const m = document.getElementById('lang-menu');
    const open = m.classList.toggle('hidden') === false;
    document.getElementById('lang-btn').setAttribute('aria-expanded', open);
    if (open) { renderLangButton(); setTimeout(() => m.querySelector('[aria-checked="true"]').focus(), 0); }
}
function closeLangMenu() {
    const m = document.getElementById('lang-menu');
    if (!m || m.classList.contains('hidden')) return;
    m.classList.add('hidden');
    document.getElementById('lang-btn').setAttribute('aria-expanded', 'false');
}
document.addEventListener('click', (e) => { if (!e.target.closest('#lang-menu') && !e.target.closest('#lang-btn')) closeLangMenu(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeLangMenu(); });

// Langue enregistrée, sinon celle du navigateur si elle est proposée
window.addEventListener('DOMContentLoaded', () => {
    let lang = null;
    try { lang = localStorage.getItem('jf-lang'); } catch (e) {}
    if (!lang) {
        let nav = (navigator.language || 'fr').slice(0, 2).toLowerCase();
        if (nav === 'nb' || nav === 'nn') nav = 'no'; // norvégien : bokmål / nynorsk
        lang = LANGUAGES[nav] ? nav : 'fr';
    }
    renderLangButton();
    if (lang !== 'fr') setLanguage(lang, { save: false });
});
