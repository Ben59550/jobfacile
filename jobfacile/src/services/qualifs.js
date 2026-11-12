// Libellés des permis, CACES et habilitations.

// Libellés des permis / CACES / habilitations (pour le PDF et l'IA)
const QUALIF_LABELS = {
    AM: 'AM / BSR', A1: 'A1', A2: 'A2', A: 'A (moto)', B: 'B', BE: 'BE (remorque)', C1: 'C1', C: 'C (poids lourd)', CE: 'CE (super lourd)', D: 'D (transport en commun)',
    FIMO: 'FIMO / FCO marchandises', FIMOV: 'FIMO / FCO voyageurs', ADR: 'ADR (matières dangereuses)',
    'R489-1A': 'R489 cat. 1A', 'R489-1B': 'R489 cat. 1B', 'R489-3': 'R489 cat. 3', 'R489-5': 'R489 cat. 5', R485: 'R485', R486: 'R486 (nacelle)',
    R482: 'R482 (engins de chantier)', R490: 'R490 (grue auxiliaire)', R484: 'R484 (pont roulant)', R487: 'R487 (grue à tour)',
    B0H0: 'Habilitation électrique B0/H0', BS: 'Habilitation électrique BS/BE manœuvre', B1V: 'Habilitation électrique B1V/B2V', BR: 'Habilitation électrique BR/BC',
    H1V: 'Habilitation électrique H1V/H2V', SST: 'SST (sauveteur secouriste du travail)', PSC1: 'PSC1', HAUTEUR: 'Travail en hauteur', AIPR: 'AIPR', HACCP: 'HACCP',
    FEU: 'Permis feu', ATEX: 'ATEX', SSIAP1: 'SSIAP 1', CQPAPS: 'CQP APS / carte professionnelle sécurité'
};
function qualifLabelsServer(u) {
    const lic = Array.isArray(u.licenses) ? u.licenses : (u.drivingLicense ? ['B'] : []);
    return {
        licenses: lic.map(c => 'Permis ' + (QUALIF_LABELS[c] || c)),
        caces: (u.caces || []).map(c => 'CACES ' + (QUALIF_LABELS[c] || c)),
        habilitations: [...(u.habilitations || []).map(c => QUALIF_LABELS[c] || c), ...(u.otherCertifs || [])]
    };
}

module.exports = { qualifLabelsServer };
