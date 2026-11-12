// Diplômes et certifications français (Éducation nationale, enseignement supérieur, santé, social, sport, titres pro…).
// Proposés dans la recherche « Métiers ROME & compétences » (le référentiel ROME n'a pas les bacs généraux et technologiques)
// et dans les suggestions du champ « Diplôme ». Liste à compléter librement.

const pre = (prefix, list) => list.map(s => `${prefix} ${s}`);

const COLLEGE = ['Brevet des collèges (DNB)', 'Certificat de formation générale (CFG)', 'Diplôme d’études en langue française (DELF)', 'Diplôme approfondi de langue française (DALF)'];

const BAC_GENERAL = [
    'Bac général', 'Bac général – spécialité Mathématiques', 'Bac général – spécialité Physique-chimie', 'Bac général – spécialité SVT',
    'Bac général – spécialité SES', 'Bac général – spécialité HGGSP', 'Bac général – spécialité HLP', 'Bac général – spécialité LLCER',
    'Bac général – spécialité NSI (numérique et sciences informatiques)', 'Bac général – spécialité Sciences de l’ingénieur',
    'Bac général – spécialité Arts', 'Bac général – spécialité Biologie-écologie', 'Bac général – spécialité EPPCS (éducation physique)',
    'Bac S (scientifique)', 'Bac ES (économique et social)', 'Bac L (littéraire)'
];

const BAC_TECHNO = [
    'Bac STI2D (industrie et développement durable)',
    'Bac STI2D – Architecture et construction (AC)', 'Bac STI2D – Énergies et environnement (EE)',
    'Bac STI2D – Innovation technologique et éco-conception (ITEC)', 'Bac STI2D – Systèmes d’information et numérique (SIN)',
    'Bac STMG (management et gestion)', 'Bac STMG – Gestion et finance',
    'Bac STMG – Mercatique (marketing)', 'Bac STMG – Ressources humaines et communication', 'Bac STMG – Systèmes d’information de gestion',
    'Bac ST2S (sciences et technologies de la santé et du social)', 'Bac STL (laboratoire)',
    'Bac STL – Biotechnologies', 'Bac STL – Sciences physiques et chimiques en laboratoire',
    'Bac STD2A (sciences et technologies du design et des arts appliqués)', 'Bac STHR (hôtellerie et restauration)',
    'Bac S2TMD (théâtre, musique et danse)', 'Bac STAV (agronomie et vivant)',
    'Bac STI (ancien)', 'Bac STG (ancien)', 'Bac SMS (ancien)', 'Bac STT (ancien)', 'DAEU (diplôme d’accès aux études universitaires)'
];

const BAC_PRO = pre('Bac pro', [
    'Accompagnement, soins et services à la personne (ASSP)', 'Aéronautique', 'Agencement de l’espace architectural', 'Agroéquipement',
    'Animation – enfance et personnes âgées (AEPA)', 'Artisanat et métiers d’art', 'Aviation générale', 'Boucher charcutier traiteur',
    'Boulanger pâtissier', 'Commercialisation et services en restauration (CSR)', 'Conducteur transport routier marchandises',
    'Conduite de productions agricoles', 'Construction des carrosseries', 'Cuisine', 'Esthétique cosmétique parfumerie',
    'Étude et réalisation d’agencement', 'Fonderie', 'Forêt', 'Gestion des milieux naturels et de la faune',
    'Gestion des pollutions et protection de l’environnement', 'Hygiène, propreté, stérilisation', 'Intervention sur le patrimoine bâti',
    'Logistique', 'Maintenance des équipements industriels (MEI)', 'Maintenance des matériels', 'Maintenance des systèmes de production connectés (MSPC)',
    'Maintenance des véhicules – voitures particulières', 'Maintenance des véhicules – véhicules de transport routier',
    'Maintenance des véhicules – motocycles', 'Menuiserie aluminium-verre', 'Métiers de l’accueil', 'Métiers de l’électricité et de ses environnements connectés (MELEC)',
    'Métiers du commerce et de la vente (MCV)', 'Métiers de la coiffure', 'Métiers de la mode – vêtements', 'Métiers de la sécurité',
    'Métiers du cuir', 'Métiers du froid et des énergies renouvelables (MFER)', 'Métiers du bâtiment', 'Assistance à la gestion des organisations et de leurs activités (AGORA)',
    'Gestion-administration', 'Logistique et transport', 'Microtechniques', 'Optique lunetterie', 'Ouvrages du bâtiment – métallerie',
    'Pilote de ligne de production', 'Plastiques et composites', 'Procédés de la chimie, de l’eau et des papiers-cartons',
    'Productions aquacoles', 'Photographie', 'Prothèse dentaire', 'Réalisation de produits imprimés et plurimédia',
    'Systèmes numériques (SN)', 'Cybersécurité, informatique et réseaux, électronique (CIEL)', 'Technicien du bâtiment – organisation et réalisation du gros œuvre',
    'Technicien d’études du bâtiment', 'Technicien en chaudronnerie industrielle', 'Technicien en réalisation de produits mécaniques (TRPM)',
    'Technicien de maintenance des systèmes énergétiques et climatiques (TMSEC)', 'Technicien en installation des systèmes énergétiques et climatiques (TISEC)',
    'Technicien menuisier agenceur', 'Technicien constructeur bois', 'Technicien du froid et du conditionnement d’air', 'Technicien géomètre-topographe',
    'Technicien gaz', 'Travaux publics', 'Aménagement et finition du bâtiment', 'Services aux personnes et aux territoires (SAPAT)',
    'Conseil vente (agricole)', 'Laboratoire contrôle qualité', 'Bio-industries de transformation', 'Aménagements paysagers', 'Cultures marines',
    'Poissonnier écailler traiteur', 'Transport fluvial', 'Conducteur d’engins de chantier'
]);

const CAP = pre('CAP', [
    'Accompagnant éducatif petite enfance (AEPE)', 'Agent de propreté et d’hygiène', 'Agent de sécurité', 'Agent polyvalent de restauration',
    'Boucher', 'Boulanger', 'Carreleur mosaïste', 'Charcutier-traiteur', 'Charpentier bois', 'Chocolatier-confiseur', 'Coiffure (Métiers de la coiffure)',
    'Commercialisation et services en hôtel-café-restaurant (CSHCR)', 'Conducteur agent d’accueil en autobus et autocar',
    'Conducteur livreur de marchandises', 'Constructeur bois', 'Constructeur de routes et d’aménagements urbains', 'Couvreur', 'Cuisine',
    'Électricien', 'Équipier polyvalent du commerce (EPC)', 'Esthétique cosmétique parfumerie', 'Fleuriste', 'Ébéniste',
    'Installateur en froid et conditionnement d’air', 'Jardinier paysagiste', 'Maçon', 'Maintenance des véhicules – voitures particulières',
    'Maintenance des matériels', 'Menuisier fabricant', 'Menuisier installateur', 'Monteur en installations sanitaires', 'Monteur en installations thermiques',
    'Opérateur/opératrice logistique', 'Pâtissier', 'Peintre applicateur de revêtements', 'Plâtrier-plaquiste', 'Poissonnier écailler',
    'Production et service en restaurations', 'Primeur', 'Serrurier métallier', 'Réalisations industrielles en chaudronnerie ou soudage',
    'Signalétique et décors graphiques', 'Tailleur de pierre', 'Vendeur-magasinier en pièces de rechange', 'Métiers de la mode – vêtement flou',
    'Accompagnant éducatif petite enfance', 'Assistant technique en milieux familial et collectif (ATMFC)', 'Agricole – métiers de l’agriculture',
    'Agricole – jardinier paysagiste', 'Agricole – services aux personnes et vente en espace rural', 'Mécanicien cycles', 'Propreté de l’environnement urbain',
    'Monteur en isolation thermique et acoustique', 'Orfèvre', 'Bijouterie-joaillerie', 'Cordonnier', 'Sellier harnacheur', 'Coiffure', 'Crémier-fromager',
    'Opérateur de service – relation client et livraison', 'Réparation des carrosseries', 'Peinture en carrosserie', 'Conducteur routier marchandises'
]);

const BEP_BP = [
    'BEP (brevet d’études professionnelles)', 'BEP Métiers de la relation aux clients et aux usagers', 'BEP Carrières sanitaires et sociales',
    ...pre('BP', ['Boulanger', 'Boucher', 'Coiffure', 'Esthétique cosmétique parfumerie', 'Cuisinier', 'Arts de la cuisine', 'Arts du service et commercialisation en restauration',
        'Barman', 'Sommelier', 'Fleuriste', 'Électricien', 'Maçon', 'Menuisier', 'Préparateur en pharmacie', 'Responsable d’exploitation agricole (BPREA)',
        'Aménagements paysagers', 'Charpentier', 'Couvreur', 'Plombier', 'Peintre applicateur de revêtements', 'Métallier']),
    'BPJEPS (brevet professionnel de la jeunesse, de l’éducation populaire et du sport)', 'BPJEPS Activités de la forme', 'BPJEPS Activités aquatiques et de la natation (AAN)',
    'BPJEPS Animateur – loisirs tous publics', 'BPJEPS Éducateur sportif', 'BMA (brevet des métiers d’art)', 'BM (brevet de maîtrise)',
    'MC (mention complémentaire)', 'MC Cuisinier en desserts de restaurant', 'MC Aide à domicile', 'MC Sûreté des espaces ouverts au public', 'MC Employé barman'
];

const BTS = pre('BTS', [
    'Management commercial opérationnel (MCO)', 'Négociation et digitalisation de la relation client (NDRC)', 'Comptabilité et gestion (CG)',
    'Gestion de la PME (GPME)', 'Support à l’action managériale (SAM)', 'Services informatiques aux organisations (SIO) – SISR', 'Services informatiques aux organisations (SIO) – SLAM',
    'Commerce international', 'Communication', 'Tourisme', 'Management en hôtellerie-restauration (MHR)', 'Gestion des transports et logistique associée (GTLA)',
    'Professions immobilières', 'Banque – conseiller de clientèle', 'Assurance', 'Notariat', 'Collaborateur juriste notarial', 'Conseil et commercialisation de solutions techniques (CCST)',
    'Économie sociale familiale (ESF)', 'Services et prestations des secteurs sanitaire et social (SP3S)', 'Diététique', 'Opticien lunetier', 'Prothésiste dentaire',
    'Analyses de biologie médicale', 'Bioanalyses et contrôles', 'Biotechnologies', 'Métiers de l’esthétique-cosmétique-parfumerie (MECP)', 'Métiers de la coiffure',
    'Électrotechnique', 'Systèmes numériques – Informatique et réseaux (SN-IR)', 'Systèmes numériques – Électronique et communications (SN-EC)',
    'Cybersécurité, informatique et réseaux, électronique (CIEL)', 'Conception des produits industriels (CPI)', 'Conception des processus de réalisation de produits (CPRP)',
    'Conception et réalisation de systèmes automatiques (CRSA)', 'Conception et industrialisation en microtechniques', 'Maintenance des systèmes (MS)',
    'Maintenance des véhicules', 'Maintenance des matériels de construction et de manutention', 'Fluides, énergies, domotique (FED)', 'Bâtiment',
    'Travaux publics', 'Études et économie de la construction', 'Management économique de la construction (MEC)', 'Aménagement finition',
    'Enveloppe des bâtiments', 'Systèmes constructifs bois et habitat', 'Géomètre topographe et modélisation numérique', 'Architectures en métal : conception et réalisation',
    'Conception et réalisation en chaudronnerie industrielle (CRCI)', 'Europlastics et composites', 'Pilotage de procédés', 'Contrôle industriel et régulation automatique (CIRA)',
    'Métiers de la chimie', 'Métiers de l’eau', 'Métiers des services à l’environnement', 'Qualité dans les industries alimentaires et les bio-industries',
    'Design graphique', 'Design de produits', 'Design d’espace', 'Métiers de l’audiovisuel', 'Photographie', 'Études de réalisation d’un projet de communication (ERPC)',
    'Métiers de la mode – vêtements', 'Hygiène propreté environnement', 'Management opérationnel de la sécurité (MOS)', 'Responsable hébergement',
    'Agricole – Analyse, conduite et stratégie de l’entreprise agricole (ACSE)', 'Agricole – Aménagements paysagers', 'Agricole – Gestion et protection de la nature (GPN)',
    'Agricole – Technico-commercial', 'Agricole – Productions animales', 'Agricole – Agronomie et productions végétales', 'Agricole – Viticulture-œnologie',
    'Agricole – Sciences et technologies des aliments', 'Agricole – Génie des équipements agricoles', 'Agricole – Gestion forestière', 'Agricole – Développement, animation des territoires ruraux (DATR)',
    'Charpente-couverture', 'Technico-commercial', 'Assistant de manager (ancien)', 'Assistant de gestion PME-PMI (ancien)', 'Négociation relation client (NRC, ancien)',
    'Management des unités commerciales (MUC, ancien)', 'Transport et prestations logistiques (ancien)', 'Industrialisation des produits mécaniques (ancien)'
]);

const BUT = pre('BUT', [
    'Carrières juridiques', 'Carrières sociales', 'Chimie', 'Génie biologique', 'Génie chimique – génie des procédés', 'Génie civil – construction durable',
    'Génie électrique et informatique industrielle (GEII)', 'Génie industriel et maintenance (GIM)', 'Génie mécanique et productique (GMP)',
    'Gestion administrative et commerciale des organisations (GACO)', 'Gestion des entreprises et des administrations (GEA)',
    'Gestion logistique et transport (GLT)', 'Hygiène, sécurité, environnement (HSE)', 'Information-communication', 'Informatique',
    'Mesures physiques', 'Métiers du multimédia et de l’internet (MMI)', 'Métiers de la transition et de l’efficacité énergétiques (MT2E)',
    'Packaging, emballage et conditionnement', 'Qualité, logistique industrielle et organisation (QLIO)', 'Réseaux et télécommunications (R&T)',
    'Science et génie des matériaux', 'Statistique et informatique décisionnelle (STID)', 'Techniques de commercialisation (TC)', 'Sciences des données'
]);
const DUT = ['DUT (diplôme universitaire de technologie)', ...pre('DUT', ['Techniques de commercialisation', 'GEA', 'Informatique', 'GEII', 'GMP', 'Génie civil', 'Carrières sociales', 'Information-communication', 'Réseaux et télécommunications', 'QLIO', 'GLT', 'Génie biologique', 'Mesures physiques', 'MMI'])];

const SUP_DOMAINES = ['Droit', 'Économie', 'Économie et gestion', 'Gestion', 'Administration économique et sociale (AES)', 'Administration publique', 'Science politique',
    'Mathématiques', 'Informatique', 'MIASHS', 'Physique', 'Chimie', 'Physique-chimie', 'Sciences de la vie (SV)', 'Sciences de la Terre', 'Électronique, énergie électrique, automatique (EEA)',
    'Mécanique', 'Génie civil', 'Sciences pour l’ingénieur', 'STAPS', 'Psychologie', 'Sociologie', 'Sciences de l’éducation', 'Histoire', 'Géographie et aménagement', 'Philosophie',
    'Lettres modernes', 'Lettres classiques', 'Langues étrangères appliquées (LEA)', 'LLCER Anglais', 'LLCER Espagnol', 'LLCER Allemand', 'Information-communication', 'Arts plastiques',
    'Arts du spectacle', 'Musicologie', 'Cinéma et audiovisuel', 'Histoire de l’art et archéologie', 'Sciences sanitaires et sociales', 'Sciences du langage', 'Accès santé (LAS)'];
const LICENCE = ['Licence', ...pre('Licence', SUP_DOMAINES)];
const MASTER = ['Master', ...pre('Master', [...SUP_DOMAINES, 'MEEF (métiers de l’enseignement)', 'Management', 'Marketing', 'Finance', 'Comptabilité-contrôle-audit (CCA)', 'Ressources humaines',
    'Management de projet', 'Commerce international', 'Data science', 'Cybersécurité', 'Intelligence artificielle', 'Génie logiciel', 'Logistique et supply chain',
    'Urbanisme et aménagement', 'Environnement', 'Énergie', 'Santé publique', 'Droit des affaires', 'Droit social', 'Droit public', 'Journalisme', 'Communication', 'Tourisme'])];
const LICENCE_PRO = ['Licence professionnelle', ...pre('Licence pro', ['Commerce et distribution', 'Métiers de la gestion et de la comptabilité', 'Métiers des ressources humaines',
    'Logistique et pilotage des flux', 'Métiers de l’informatique – développement web', 'Métiers des réseaux informatiques et télécommunications', 'Métiers de l’immobilier',
    'Assurance, banque, finance', 'Métiers du BTP – bâtiment et construction', 'Maintenance des systèmes industriels', 'Métiers de l’électricité et de l’énergie',
    'Qualité, hygiène, sécurité, santé, environnement (QHSSE)', 'Métiers de l’animation sociale', 'Intervention sociale', 'Métiers du tourisme et des loisirs',
    'Métiers de la communication', 'E-commerce et marketing numérique', 'Métiers de l’industrie', 'Agronomie', 'Métiers du notariat'])];

const SUP_AUTRES = [
    'DEUG (ancien)', 'DEUST', 'Bachelor', 'Bachelor en commerce / business', 'Bachelor universitaire', 'Classe préparatoire (CPGE)', 'DCG (diplôme de comptabilité et de gestion)',
    'DSCG (diplôme supérieur de comptabilité et de gestion)', 'DEC (expertise comptable)', 'Diplôme d’ingénieur', 'Diplôme d’ingénieur – informatique',
    'Diplôme d’ingénieur – génie civil', 'Diplôme d’ingénieur – mécanique', 'Diplôme d’ingénieur – électrique', 'Diplôme d’ingénieur – agronome',
    'Diplôme d’école de commerce (programme Grande École)', 'Diplôme d’IEP (Sciences Po)', 'MBA', 'Mastère spécialisé (MS)', 'MSc (Master of Science)',
    'Doctorat', 'Doctorat (PhD)', 'HDR (habilitation à diriger des recherches)', 'DU (diplôme universitaire)', 'DIU (diplôme interuniversitaire)',
    'Diplôme d’architecte (DEA – diplôme d’État d’architecte)', 'Diplôme de notaire', 'CAPA (certificat d’aptitude à la profession d’avocat)',
    'CAPES', 'CAPET', 'CAPLP', 'CRPE (professeur des écoles)', 'Agrégation', 'Diplôme national supérieur d’expression plastique (DNSEP)', 'DN MADE (diplôme national des métiers d’art et du design)',
    'DNA (diplôme national d’art)', 'DSAA (design)', 'Diplôme d’État de docteur en médecine', 'Diplôme d’État de docteur en pharmacie', 'Diplôme d’État de docteur en chirurgie dentaire',
    'Diplôme d’État de docteur vétérinaire', 'Diplôme d’État de sage-femme'
];

const DE_SANTE_SOCIAL = pre('Diplôme d’État', [
    'd’infirmier (DEI)', 'd’aide-soignant (DEAS)', 'd’auxiliaire de puériculture (DEAP)', 'd’ambulancier (DEA)', 'de masseur-kinésithérapeute', 'd’ergothérapeute',
    'de psychomotricien', 'de manipulateur en électroradiologie médicale', 'de pédicure-podologue', 'de technicien de laboratoire médical', 'd’infirmier anesthésiste (IADE)',
    'd’infirmier de bloc opératoire (IBODE)', 'de puéricultrice', 'd’infirmier en pratique avancée (IPA)', 'de préparateur en pharmacie hospitalière',
    'd’éducateur spécialisé (DEES)', 'de moniteur-éducateur (DEME)', 'd’éducateur de jeunes enfants (DEEJE)', 'd’assistant de service social (DEASS)',
    'de conseiller en économie sociale familiale (DECESF)', 'd’accompagnant éducatif et social (DEAES)', 'd’éducateur technique spécialisé (DEETS)',
    'de technicien de l’intervention sociale et familiale (DETISF)', 'de médiateur familial', 'd’ingénierie sociale (DEIS)', 'de la jeunesse, de l’éducation populaire et du sport (DEJEPS)',
    'supérieur de la jeunesse, de l’éducation populaire et du sport (DESJEPS)', 'de professeur de musique', 'de professeur de danse'
]);
const SANTE_AUTRES = ['Certificat de capacité d’orthophoniste', 'Certificat de capacité d’orthoptiste', 'Diplôme d’audioprothésiste', 'Diplôme de psychologue (master)',
    'Diplôme d’ostéopathe', 'Diplôme d’opticien lunetier', 'Diplôme d’auxiliaire ambulancier', 'CAFERUIS', 'CAFDES', 'Certificat d’assistant de soins en gérontologie (ASG)'];

const TITRES_PRO = pre('Titre professionnel', [
    'Agent de restauration', 'Assistant de vie aux familles (ADVF)', 'Assistant(e) de direction', 'Assistant comptable', 'Assistant ressources humaines', 'Comptable assistant',
    'Gestionnaire comptable et fiscal', 'Gestionnaire de paie', 'Secrétaire assistant(e)', 'Secrétaire comptable', 'Secrétaire assistant(e) médico-administratif(ve)',
    'Employé administratif et d’accueil', 'Conseiller relation client à distance', 'Négociateur technico-commercial', 'Vendeur conseil en magasin', 'Employé commercial en magasin',
    'Manager d’unité marchande', 'Responsable de petite et moyenne structure', 'Agent magasinier', 'Préparateur de commandes en entrepôt', 'Cariste d’entrepôt',
    'Technicien en logistique d’entreposage', 'Technicien supérieur en méthodes et exploitation logistique', 'Conducteur du transport routier de marchandises sur porteur',
    'Conducteur du transport routier de marchandises sur tous véhicules', 'Conducteur du transport routier interurbain de voyageurs', 'Conducteur livreur sur véhicule utilitaire léger',
    'Agent de propreté et d’hygiène', 'Agent de sûreté et de sécurité privée (APS)', 'Cuisinier', 'Commis de cuisine', 'Serveur en restauration', 'Barman', 'Réceptionniste en hôtellerie',
    'Développeur web et web mobile (DWWM)', 'Concepteur développeur d’applications (CDA)', 'Technicien d’assistance en informatique (TAI)', 'Technicien supérieur systèmes et réseaux (TSSR)',
    'Administrateur d’infrastructures sécurisées (AIS)', 'Designer web', 'Infographiste metteur en page', 'Concepteur designer UI', 'Data analyst',
    'Électricien d’équipement du bâtiment', 'Maçon', 'Plaquiste plâtrier', 'Peintre en bâtiment', 'Carreleur chapiste', 'Menuisier poseur installateur', 'Plombier chauffagiste',
    'Installateur thermique et sanitaire', 'Technicien de maintenance industrielle', 'Soudeur assembleur industriel', 'Chaudronnier', 'Tourneur en réalisation de pièces mécaniques',
    'Opérateur régleur sur machine-outil à commande numérique', 'Agent de maintenance des bâtiments', 'Technicien d’intervention en froid commercial et climatisation',
    'Mécanicien automobile', 'Carrossier réparateur', 'Formateur professionnel d’adultes', 'Conseiller en insertion professionnelle', 'Médiateur social accès aux droits et services',
    'Agent de médiation, information, services', 'Responsable d’établissement touristique', 'Conseiller en voyages', 'Jardinier paysagiste', 'Conducteur d’engins de travaux publics'
]);

const CERTIFS = [
    'Permis B', 'Permis BE', 'Permis C', 'Permis CE', 'Permis D', 'Permis A', 'FIMO marchandises', 'FIMO voyageurs', 'FCO', 'Carte de qualification conducteur',
    'CACES R489 catégorie 1A', 'CACES R489 catégorie 1B', 'CACES R489 catégorie 3', 'CACES R489 catégorie 5', 'CACES R486 (nacelles)', 'CACES R482 (engins de chantier)',
    'CACES R490 (grues auxiliaires)', 'SST (sauveteur secouriste du travail)', 'PSC1 (premiers secours)', 'Habilitation électrique B0 H0V', 'Habilitation électrique BR', 'Habilitation électrique B1V B2V',
    'Carte professionnelle CNAPS', 'SSIAP 1', 'SSIAP 2', 'SSIAP 3', 'HACCP (hygiène alimentaire)', 'Permis d’exploitation (licence IV)', 'BAFA', 'BAFD', 'BNSSA', 'Brevet de surveillant de baignade',
    'CQP (certificat de qualification professionnelle)', 'CQP Agent de prévention et de sécurité', 'CléA (socle de connaissances et de compétences)', 'TOEIC', 'TOEFL', 'IELTS',
    'Cambridge First (B2)', 'Cambridge Advanced (C1)', 'Certification Voltaire', 'PIX (compétences numériques)', 'TOSA (Excel, Word)', 'Attestation de capacité de transport',
    'Certiphyto', 'Certificat de compétences de citoyen de sécurité civile', 'Brevet d’aptitude aux fonctions d’animateur', 'Attestation d’aptitude à la manipulation des fluides frigorigènes'
];

const DIPLOMES = [...COLLEGE, ...BAC_GENERAL, ...BAC_TECHNO, ...BAC_PRO, ...CAP, ...BEP_BP, ...BTS, ...BUT, ...DUT, ...LICENCE, ...LICENCE_PRO, ...MASTER,
    ...SUP_AUTRES, ...DE_SANTE_SOCIAL, ...SANTE_AUTRES, ...TITRES_PRO, ...CERTIFS];

// Mots de recherche en plus (ex. « baccalauréat » trouve les « Bac … »)
const SYNONYMES = [
    [/^Bac /, 'baccalauréat'], [/^CAP /, 'certificat d’aptitude professionnelle'], [/^BTS /, 'brevet de technicien supérieur'],
    [/^BUT /, 'bachelor universitaire de technologie'], [/^BP /, 'brevet professionnel'], [/^Titre professionnel /, 'titre pro'],
    [/^Diplôme d’État /, 'DE'], [/^Licence pro /, 'licence professionnelle']
];
function synonymsOf(name) { return SYNONYMES.filter(([re]) => re.test(name)).map(([, s]) => s).join(' '); }

module.exports = { DIPLOMES: [...new Set(DIPLOMES)], synonymsOf };
