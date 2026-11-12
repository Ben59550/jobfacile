// Données de référence : métiers, villes et offres d’exemple (quand aucune source réelle ne répond).

// Référentiel national élargi (Métiers, Compétences, Domaines en France)
const ROME_FULL_REFERENTIAL = [
    { name: "Développeur / Développeuse web", type: "Métier ROME (M1805)", domain: "Informatique" },
    { name: "Architecte technique en informatique", type: "Métier ROME", domain: "Informatique" },
    { name: "Administrateur / Administratrice systèmes et réseaux", type: "Métier ROME", domain: "Informatique" },
    { name: "Intégrateur / Intégratrice web", type: "Appellation", domain: "Informatique" },
    { name: "Développeur full-stack", type: "Appellation", domain: "Informatique" },
    { name: "JavaScript", type: "Compétence", domain: "Informatique" },
    { name: "TypeScript", type: "Compétence", domain: "Informatique" },
    { name: "Node.js", type: "Compétence", domain: "Informatique" },
    { name: "React.js", type: "Compétence", domain: "Informatique" },
    { name: "Python", type: "Compétence", domain: "Informatique" },
    { name: "SQL / PostgreSQL", type: "Compétence", domain: "Informatique" },
    { name: "Maçon / Maçonne", type: "Métier ROME (F1608)", domain: "BTP" },
    { name: "Chef / Cheffe de chantier BTP", type: "Métier ROME", domain: "BTP" },
    { name: "Électricien / Électricienne du bâtiment", type: "Métier ROME (F1602)", domain: "BTP" },
    { name: "Plombier / Plombière", type: "Métier ROME (F1603)", domain: "BTP" },
    { name: "Attaché / Attachée commerciale", type: "Métier ROME (M1403)", domain: "Commerce" },
    { name: "Vendeur / Vendeuse en magasin", type: "Métier ROME (D1214)", domain: "Commerce" },
    { name: "Comptable", type: "Métier ROME (M1203)", domain: "Gestion / Finance" },
    { name: "Gestionnaire de paie", type: "Métier ROME", domain: "Ressources Humaines" },
    { name: "Infirmier / Infirmière diplômé(e) d'État", type: "Métier ROME (J1506)", domain: "Santé" },
    { name: "Aide-soignant / Aide-soignante", type: "Métier ROME (J1501)", domain: "Santé" },
    { name: "Assistant / Assistante de direction", type: "Métier ROME (M1607)", domain: "Administratif" },
    { name: "Cuisinier / Cuisinière", type: "Métier ROME (G1602)", domain: "Restauration / Hôtellerie" },
    { name: "Serveur / Serveuse en restauration", type: "Métier ROME (G1803)", domain: "Restauration / Hôtellerie" },
    { name: "Chauffeur / Chauffeuse poids lourd", type: "Métier ROME (N4101)", domain: "Transport / Logistique" },
    { name: "Cariste", type: "Métier ROME (N1103)", domain: "Transport / Logistique" },
    { name: "Professeur / Professeure des écoles", type: "Métier ROME (K2106)", domain: "Enseignement / Formation" }
];

const FRANCE_CITIES = [
    { name: 'Louvroil', dept: '59', region: 'Hauts-de-France' },
    { name: 'Maubeuge', dept: '59', region: 'Hauts-de-France' },
    { name: 'Valenciennes', dept: '59', region: 'Hauts-de-France' },
    { name: 'Lille', dept: '59', region: 'Hauts-de-France' },
    { name: 'Paris', dept: '75', region: 'Île-de-France' },
    { name: 'Lyon', dept: '69', region: 'Auvergne-Rhône-Alpes' },
    { name: 'Marseille', dept: '13', region: 'Provence-Alpes-Côte d\'Azur' },
    { name: 'Bordeaux', dept: '33', region: 'Nouvelle-Aquitaine' }
];

const NATIONAL_JOBS = (function generateFullNationalJobs() {
    const secteurs = [
        { title: 'Développeur Web / Logiciel', cat: 'emploi', type: 'CDI', domain: 'Informatique' },
        { title: 'Alternance Assistant Marketing Digital', cat: 'alternance', type: 'Alternance', domain: 'Marketing' },
        { title: 'Électricien Bâtiment (H/F)', cat: 'emploi', type: 'CDI', domain: 'BTP' },
        { title: 'Comptable Confirmé (H/F)', cat: 'emploi', type: 'CDI', domain: 'Gestion / Finance' }
    ];
    const fullList = [];
    let idCounter = 1;
    for (const secteur of secteurs) {
        for (const city of FRANCE_CITIES) {
            fullList.push({
                id: `nat-${idCounter++}`,
                title: secteur.title,
                company: 'TechCorp France',
                location: `${city.name} (${city.dept})`,
                region: city.region,
                cityName: city.name,
                dept: city.dept,
                domain: secteur.domain,
                type: secteur.type,
                category: secteur.cat,
                source: 'JobFacile National',
                date: "Aujourd'hui",
                description: `Poste en ${secteur.domain} à pourvoir immédiatement à ${city.name}.`,
                url: 'https://candidat.francetravail.fr'
            });
        }
    }
    return fullList;
})();

module.exports = { ROME_FULL_REFERENTIAL, NATIONAL_JOBS, FRANCE_CITIES };
