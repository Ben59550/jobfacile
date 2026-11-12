// JobFacile · Simulateur de droits : estimation de l'allocation chômage (ARE) et guide des aides à la mobilité.
// Script classique (pas un module). Tout est calculé dans le navigateur : aucune donnée n'est envoyée.
//
// ⚠️ Barème : les montants fixes de l'ARE sont revalorisés chaque 1er juillet et les règles changent par décret.
// Mettez à jour ARE_RULES ci-dessous quand ils évoluent (source : francetravail.fr, « montant de l'allocation »).
const ARE_RULES = {
    valuesDate: 'juillet 2025',          // date des montants ci-dessous (à vérifier)
    fixedPart: 13.18,                    // partie fixe journalière (€)
    minDaily: 32.13,                     // allocation journalière minimale (€)
    rateWithFixed: 0.404,                // 40,4 % du salaire journalier de référence + partie fixe
    rateAlone: 0.57,                     // ou 57 % du salaire journalier de référence
    capRate: 0.75,                       // jamais plus de 75 % du salaire journalier de référence
    durationCoef: 0.75,                  // coefficient de réduction de la durée (conjoncture favorable)
    minWorkedDays: 130,                  // ≈ 6 mois de travail
    maxDays: [[0, 548], [55, 685], [57, 822]], // durée maximale selon l'âge à la fin du contrat
    refMonths: [[0, 24], [55, 36]]       // période de référence : 24 mois, 36 mois à partir de 55 ans
};
const byAge = (table, age) => table.filter(([a]) => age >= a).pop()[1];
const euro = (v, d = 0) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: d, minimumFractionDigits: d }).format(v);

function estimateARE({ grossMonthly, monthsWorked, age, reason }) {
    const out = { warnings: [] };
    if (reason === 'demission') {
        out.eligible = false;
        out.reason = 'Une démission n’ouvre en principe pas de droits, sauf démission « légitime » (suivi de conjoint, non-paiement du salaire…) ou démission pour un projet de reconversion validé. Renseignez-vous auprès de France Travail.';
        return out;
    }
    const refMonths = byAge(ARE_RULES.refMonths, age);
    const months = Math.min(monthsWorked, refMonths);
    const workedDays = Math.round(months * 30.42);
    if (workedDays < ARE_RULES.minWorkedDays) {
        out.eligible = false;
        out.reason = `Il faut avoir travaillé au moins 6 mois (130 jours ou 910 heures) au cours des ${refMonths} derniers mois.`;
        return out;
    }
    out.eligible = true;
    // Salaire journalier de référence (cas simple : salaire régulier sur la période)
    const sjr = grossMonthly * 12 / 365;
    let daily = Math.max(ARE_RULES.rateWithFixed * sjr + ARE_RULES.fixedPart, ARE_RULES.rateAlone * sjr);
    daily = Math.min(daily, ARE_RULES.capRate * sjr);
    if (daily < ARE_RULES.minDaily) daily = Math.min(ARE_RULES.minDaily, ARE_RULES.capRate * sjr);
    const days = Math.min(Math.max(Math.round(workedDays * ARE_RULES.durationCoef), 182), byAge(ARE_RULES.maxDays, age));
    Object.assign(out, { sjr, daily, monthly: daily * 30, days, months: days / 30.42, refMonths });
    if (reason === 'rupture') out.warnings.push('Une indemnité de rupture supérieure au minimum légal retarde le premier versement (différé d’indemnisation).');
    out.warnings.push('Un délai d’attente de 7 jours s’applique, plus un différé correspondant à vos congés payés non pris.');
    if (grossMonthly > 4500) out.warnings.push('Au-delà d’environ 4 500 € brut par mois, l’allocation peut être réduite après quelques mois (dégressivité).');
    return out;
}

function runRightsSim() {
    const v = (id) => document.getElementById(id).value;
    const grossMonthly = parseFloat(String(v('ri-salary')).replace(',', '.').replace(/\s/g, ''));
    const monthsWorked = parseInt(v('ri-months'));
    const age = parseInt(v('ri-age'));
    const reason = v('ri-reason');
    const box = document.getElementById('ri-result');
    if (!(grossMonthly > 0) || !(monthsWorked > 0) || !(age >= 16)) {
        box.innerHTML = '<p class="text-sm text-rose-600 font-semibold">Remplissez le salaire, la durée travaillée et votre âge.</p>';
        return;
    }
    const r = estimateARE({ grossMonthly, monthsWorked, age, reason });
    if (!r.eligible) {
        box.innerHTML = `<div class="rounded-2xl border border-amber-200 bg-amber-50 p-5"><p class="font-bold text-amber-900 mb-1">Droits peu probables avec ces informations</p><p class="text-sm text-amber-900">${esc(r.reason)}</p></div>`;
        return;
    }
    const net = r.monthly * 0.93; // prélèvements sociaux d'environ 7 % (sauf petites allocations, exonérées)
    box.innerHTML = `
        <div class="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-5">
            <p class="text-xs font-bold text-emerald-700 uppercase tracking-wider mb-1">Estimation</p>
            <p class="text-3xl font-extrabold text-slate-900">${euro(r.monthly)} <span class="text-base font-semibold text-slate-500">brut / mois</span></p>
            <p class="text-sm text-slate-700">soit environ <strong>${euro(net)}</strong> net par mois (${euro(r.daily, 2)} par jour), pendant <strong>${Math.round(r.months)} mois</strong> au maximum (${r.days} jours).</p>
            <div class="grid sm:grid-cols-3 gap-2 mt-4 text-sm">
                <div class="rounded-xl bg-white/70 p-3"><p class="text-[11px] text-slate-500">Salaire journalier de référence</p><p class="font-bold">${euro(r.sjr, 2)}</p></div>
                <div class="rounded-xl bg-white/70 p-3"><p class="text-[11px] text-slate-500">Taux de remplacement</p><p class="font-bold">${Math.round(r.daily / r.sjr * 100)} % du brut</p></div>
                <div class="rounded-xl bg-white/70 p-3"><p class="text-[11px] text-slate-500">Période étudiée</p><p class="font-bold">${r.refMonths} derniers mois</p></div>
            </div>
            <ul class="mt-4 space-y-1 text-xs text-slate-600">${r.warnings.map(w => `<li>• ${esc(w)}</li>`).join('')}</ul>
        </div>
        <p class="text-[11px] text-slate-500 mt-3">Estimation simplifiée pour un salaire régulier, avec les montants connus de JobFacile (${ARE_RULES.valuesDate}). Seul France Travail calcule vos droits réels : inscrivez-vous dès la fin de votre contrat.
        Simulateur officiel de toutes vos aides : <a href="https://www.mes-droits-sociaux.gouv.fr" target="_blank" rel="noopener" class="underline font-semibold">mes-droits-sociaux.gouv.fr</a>.</p>`;
}

// ---------- Aides à la mobilité et au retour à l'emploi : guide selon votre situation ----------
const AIDS = [
    { id: 'mobilite', icon: '🚆', title: 'Aide à la mobilité (France Travail)', when: (s) => s.registered && (s.far || s.training),
      what: 'Prend en charge une partie des frais de transport, de repas et d’hébergement pour un entretien, une reprise d’emploi ou une formation éloignés (plus de 60 km aller-retour ou 2 h de trajet).',
      how: 'Demande auprès de votre conseiller France Travail, avant le déplacement.' },
    { id: 'permis', icon: '🚗', title: 'Aide au permis de conduire B', when: (s) => s.noLicense && (s.registered || s.apprentice),
      what: 'France Travail peut financer une partie du permis si son absence vous empêche de retrouver un emploi. Les apprentis majeurs peuvent recevoir une aide forfaitaire. Le permis est aussi finançable avec votre CPF.',
      how: 'Conseiller France Travail, ou votre CFA si vous êtes apprenti ; CPF sur moncompteformation.gouv.fr.' },
    { id: 'agepi', icon: '👶', title: 'Aide à la garde d’enfants (AGEPI)', when: (s) => s.singleParent && s.registered,
      what: 'Pour les parents seuls avec un enfant de moins de 10 ans qui reprennent un emploi ou une formation : aide forfaitaire pour les frais de garde.',
      how: 'Demande à France Travail dans le mois qui suit la reprise.' },
    { id: 'mobili-jeune', icon: '🏠', title: 'Mobili-Jeune (Action Logement)', when: (s) => s.apprentice && s.age < 30,
      what: 'Aide au loyer pour les alternants de moins de 30 ans, versée chaque mois pendant la formation.',
      how: 'Demande en ligne sur le site d’Action Logement.' },
    { id: 'mobilipass', icon: '📦', title: 'Aide au déménagement pour un emploi (Action Logement)', when: (s) => s.move,
      what: 'Aides pour les salariés du privé qui déménagent pour prendre un poste : frais d’accompagnement, garantie de loyer (Visale) pour rassurer le propriétaire.',
      how: 'Action Logement ; garantie Visale sur visale.fr (gratuite).' },
    { id: 'cej', icon: '🎯', title: 'Contrat d’engagement jeune', when: (s) => s.age < 26,
      what: 'Accompagnement intensif vers l’emploi pour les moins de 26 ans (30 ans en situation de handicap), avec une allocation selon vos ressources.',
      how: 'Mission locale ou France Travail ; infos sur 1jeune1solution.gouv.fr.' },
    { id: 'rqth', icon: '♿', title: 'Aides Agefiph (travailleurs handicapés)', when: (s) => s.rqth,
      what: 'Aides à la mobilité, au permis, à l’aménagement du poste ou à la formation pour les personnes ayant une RQTH.',
      how: 'Cap emploi (via France Travail) ou agefiph.fr.' },
    { id: 'are-creation', icon: '💡', title: 'Créer son entreprise avec ses droits au chômage', when: (s) => s.create,
      what: 'En créant votre activité, vous pouvez garder une partie de vos allocations (maintien) ou en toucher une partie en capital (ARCE), et bénéficier d’exonérations de charges (ACRE).',
      how: 'Votre conseiller France Travail, avant l’immatriculation.' },
    { id: 'cpf', icon: '📚', title: 'Compte personnel de formation (CPF)', when: () => true,
      what: 'Chaque année travaillée alimente votre CPF : il finance des formations certifiantes, le permis, un bilan de compétences.',
      how: 'Consultez votre solde sur moncompteformation.gouv.fr.' }
];
function runAidsGuide() {
    const c = (id) => document.getElementById(id).checked;
    const s = {
        age: parseInt(document.getElementById('ri-age').value) || 30,
        registered: c('ai-registered'), far: c('ai-far'), training: c('ai-training'), noLicense: c('ai-nolicense'),
        apprentice: c('ai-apprentice'), singleParent: c('ai-single'), move: c('ai-move'), rqth: c('ai-rqth'), create: c('ai-create')
    };
    const list = AIDS.filter(a => a.when(s));
    document.getElementById('ai-result').innerHTML = `
        <p class="text-sm font-bold text-slate-900 mb-3">${list.length} aide${list.length > 1 ? 's' : ''} à regarder de près</p>
        <div class="grid sm:grid-cols-2 gap-3">${list.map(a => `
            <div class="rounded-2xl border border-slate-200 p-4">
                <p class="font-bold text-slate-900 text-sm">${a.icon} ${esc(a.title)}</p>
                <p class="text-sm text-slate-600 mt-1">${esc(a.what)}</p>
                <p class="text-xs text-emerald-700 font-semibold mt-2">👉 ${esc(a.how)}</p>
            </div>`).join('')}</div>
        <p class="text-[11px] text-slate-500 mt-3">Conditions et montants à confirmer auprès de l’organisme : ils changent régulièrement. ${s.registered ? '' : 'La plupart des aides de France Travail demandent d’y être inscrit.'}</p>`;
}
function switchRightsTab(tab) {
    ['are', 'aids'].forEach(t => {
        document.getElementById('rights-' + t).classList.toggle('hidden', t !== tab);
        document.getElementById('rights-tab-' + t).className = t === tab ? TAB_ACTIVE : TAB_IDLE;
    });
}
function openRights(tab = 'are') {
    switchView('rights');
    switchRightsTab(tab);
    // Pré-remplissage à partir du profil
    if (currentUser && currentUser.birthDate && !document.getElementById('ri-age').value) {
        const b = new Date(currentUser.birthDate);
        const age = Math.floor((Date.now() - b) / (365.25 * 864e5));
        if (age > 15 && age < 80) document.getElementById('ri-age').value = age;
    }
    if (currentUser && !document.getElementById('ai-nolicense').dataset.init) {
        document.getElementById('ai-nolicense').checked = !(currentUser.licenses || []).includes('B') && !currentUser.drivingLicense;
        document.getElementById('ai-rqth').checked = false;
        document.getElementById('ai-nolicense').dataset.init = '1';
    }
}
