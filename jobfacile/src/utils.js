// Petits outils partagés (comparaison de textes, adresses e-mail).

function normEmail(email) { return String(email || '').trim().toLowerCase(); }
function findUserIndex(users, email) { const e = normEmail(email); return users.findIndex(u => normEmail(u.email) === e); }

// Comparaison sans accents ni majuscules ("electricien" trouve "Électricien")
function fold(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim(); }

// Nom affiché publiquement : prénom + initiale du nom (jamais le nom complet)
function displayName(u) { return u ? `${u.firstName || ''} ${(u.lastName || '').charAt(0)}${u.lastName ? '.' : ''}`.trim() || 'Membre' : 'Compte supprimé'; }

module.exports = { normEmail, fold, findUserIndex, displayName };
