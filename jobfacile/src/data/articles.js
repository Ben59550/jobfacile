// Articles de la page Conseils (/conseils et /conseils/<slug>). Contenu original de JobFacile.
// Pour ajouter un article : copier un bloc, choisir un slug unique (minuscules, tirets), écrire le HTML (h2, p, ul, li, strong).
const ARTICLES = [
{
    slug: 'faire-un-cv-qui-se-demarque',
    emoji: '📄',
    title: 'Comment faire un CV qui se démarque',
    description: 'Structure, longueur, mots-clés, photo, erreurs à éviter : la méthode pas à pas pour un CV clair qui donne envie de vous rencontrer.',
    minutes: 6,
    date: '2026-11-15',
    html: `
<p>Un recruteur passe en moyenne moins d’une minute sur un CV avant de décider s’il le garde. Votre CV n’a donc pas besoin de tout raconter : il doit donner, en quelques secondes, une réponse claire à la question « cette personne peut-elle faire le travail ? ». Voici une méthode simple pour y arriver.</p>
<h2>1. Commencez par le poste visé, pas par votre parcours</h2>
<p>Avant d’écrire une ligne, relisez l’offre et soulignez les compétences, les outils et les qualités demandés. Votre CV sera la réponse à cette liste. Un même CV envoyé partout fonctionne mal : prenez dix minutes pour l’adapter à chaque candidature, en mettant en avant ce qui correspond le mieux.</p>
<h2>2. Une structure que l’on lit d’un coup d’œil</h2>
<ul>
<li><strong>En-tête</strong> : prénom, nom, téléphone, e-mail professionnel, ville (pas besoin de l’adresse complète), lien LinkedIn si votre profil est à jour.</li>
<li><strong>Titre</strong> : l’intitulé du poste visé, par exemple « Assistant comptable – alternance BTS CG ». C’est la première chose que l’on lit.</li>
<li><strong>Accroche</strong> (2 à 3 lignes) : qui vous êtes, ce que vous savez faire, ce que vous cherchez.</li>
<li><strong>Expériences</strong> : de la plus récente à la plus ancienne, avec pour chacune deux à quatre réalisations concrètes.</li>
<li><strong>Formation</strong>, puis <strong>compétences</strong>, <strong>langues</strong> et <strong>centres d’intérêt</strong> s’ils disent quelque chose de vous.</li>
</ul>
<p>Si vous débutez, placez la formation avant les expériences et valorisez les stages, les jobs d’été, le bénévolat ou les projets scolaires : ce sont de vraies expériences.</p>
<h2>3. Des réalisations plutôt que des tâches</h2>
<p>« Accueil des clients » décrit une tâche. « Accueil de 80 clients par jour en période de soldes, 0 réclamation » montre un résultat. Chaque fois que c’est possible, ajoutez un chiffre, une durée, un volume ou un résultat. Commencez vos phrases par un verbe d’action : organiser, vendre, réparer, former, gérer, améliorer.</p>
<h2>4. Les bons mots-clés</h2>
<p>Beaucoup d’entreprises trient les candidatures avec un logiciel (un ATS) qui cherche les mots de l’annonce. Reprenez les termes exacts de l’offre quand ils correspondent à votre expérience : si l’annonce parle de « CACES R489 », écrivez « CACES R489 » et pas seulement « permis cariste ». Notre article sur les logiciels de tri explique le reste.</p>
<h2>5. La forme compte aussi</h2>
<ul>
<li><strong>Une page</strong> suffit avant dix ans d’expérience.</li>
<li>Une police lisible, des marges aérées, deux couleurs au maximum.</li>
<li>Envoyez toujours un <strong>PDF</strong> nommé clairement : « CV-Prenom-Nom.pdf ».</li>
<li>La photo n’est pas obligatoire en France. Si vous en mettez une, choisissez une photo récente, de face, sur fond neutre.</li>
</ul>
<h2>6. Les erreurs qui coûtent cher</h2>
<ul>
<li>Les fautes d’orthographe : faites relire votre CV par une autre personne.</li>
<li>Une adresse e-mail fantaisiste : créez-en une avec votre prénom et votre nom.</li>
<li>Des trous inexpliqués : une période de recherche, de formation ou de projet personnel peut s’indiquer simplement.</li>
<li>Mentir sur un diplôme ou une compétence : cela se vérifie, souvent dès l’entretien.</li>
</ul>
<p><strong>Avec JobFacile</strong>, le générateur de CV vous propose une version adaptée à chaque offre, et l’analyse de CV vous signale les mots-clés manquants. Relisez toujours le résultat : c’est votre CV, il doit vous ressembler.</p>`
},
{
    slug: 'lettre-de-motivation-efficace',
    emoji: '✉️',
    title: 'Rédiger une lettre de motivation efficace',
    description: 'La structure « vous, moi, nous », les phrases à bannir, la bonne longueur et un exemple commenté pour écrire une lettre qui sera lue.',
    minutes: 5,
    date: '2026-11-15',
    html: `
<p>La lettre de motivation fait souvent peur, alors qu’elle sert à une chose simple : montrer que vous avez compris le besoin de l’entreprise et que vous pouvez y répondre. Une lettre courte, précise et sincère vaut mieux qu’une page de formules toutes faites.</p>
<h2>La structure en trois parties</h2>
<p>La méthode la plus utilisée tient en trois paragraphes : <strong>vous</strong> (l’entreprise), <strong>moi</strong> (le candidat), <strong>nous</strong> (ce que l’on fera ensemble).</p>
<ul>
<li><strong>Vous</strong> : montrez que vous connaissez l’entreprise. Un produit, une actualité, une valeur, un chiffre trouvé sur son site. Une ou deux phrases suffisent, mais elles doivent être propres à cette entreprise.</li>
<li><strong>Moi</strong> : présentez deux ou trois expériences ou compétences qui répondent directement à l’offre, avec un exemple concret pour chacune.</li>
<li><strong>Nous</strong> : expliquez ce que vous apporterez dans le poste et proposez une rencontre.</li>
</ul>
<h2>Les phrases à éviter</h2>
<p>Certaines formules apparaissent dans des milliers de lettres et ne disent rien de vous : « Je me permets de vous adresser ma candidature », « Je suis dynamique et motivé », « Votre entreprise leader dans son domaine ». Remplacez chaque adjectif par une preuve. Au lieu de « je suis rigoureux », écrivez « pendant mon stage, j’ai tenu l’inventaire de 1 200 références sans écart ».</p>
<h2>La bonne longueur</h2>
<p>Visez <strong>250 à 350 mots</strong>, soit trois à quatre paragraphes. Pour une candidature par e-mail ou par formulaire, une version encore plus courte (une dizaine de lignes) est souvent préférable. Le recruteur doit pouvoir la lire en moins d’une minute.</p>
<h2>Exemple d’ouverture</h2>
<p><em>« Votre magasin de Lille vient d’ouvrir un rayon vrac et cherche un vendeur capable de conseiller les clients sur ces nouveaux produits. Pendant deux étés chez un primeur, j’ai appris à présenter des produits frais et à répondre aux questions sur leur origine : c’est exactement ce que je souhaite faire chez vous. »</em></p>
<p>En deux phrases, le recruteur sait que vous avez lu l’offre, que vous avez une expérience proche et ce que vous voulez faire.</p>
<h2>Avant d’envoyer</h2>
<ul>
<li>Vérifiez le nom de l’entreprise et du destinataire : une erreur de nom fait jeter la lettre.</li>
<li>Relisez à voix haute : les phrases trop longues s’entendent tout de suite.</li>
<li>Envoyez-la en PDF, avec le CV, sauf si l’annonce demande autre chose.</li>
</ul>
<p>Le générateur de JobFacile rédige une première version à partir de votre profil et de l’offre. Personnalisez-la : ajoutez une phrase sur l’entreprise que vous seul pouvez écrire.</p>`
},
{
    slug: 'preparer-entretien-embauche',
    emoji: '🎯',
    title: 'Préparer son entretien d’embauche : la méthode complète',
    description: 'Se renseigner, préparer ses exemples avec la méthode STAR, répondre aux questions pièges et poser les bonnes questions au recruteur.',
    minutes: 7,
    date: '2026-11-15',
    html: `
<p>Un entretien se gagne en grande partie avant d’y aller. La préparation réduit le stress, évite les silences gênants et vous permet de parler de vous avec des exemples précis. Voici une méthode en quatre étapes.</p>
<h2>1. Se renseigner sur l’entreprise et le poste</h2>
<p>Passez trente minutes sur le site de l’entreprise, sa page LinkedIn et les actualités récentes. Notez ce qu’elle fait, ses clients, sa taille, ses projets. Relisez l’offre et listez les trois compétences qui comptent le plus : ce sont elles que le recruteur va vérifier.</p>
<h2>2. Préparer ses exemples avec la méthode STAR</h2>
<p>Les recruteurs demandent souvent « Racontez-moi une situation où… ». Pour répondre clairement, utilisez la méthode STAR :</p>
<ul>
<li><strong>S</strong>ituation : le contexte, en une phrase.</li>
<li><strong>T</strong>âche : ce que vous deviez faire.</li>
<li><strong>A</strong>ction : ce que <em>vous</em> avez fait concrètement.</li>
<li><strong>R</strong>ésultat : ce qui a changé, idéalement avec un chiffre.</li>
</ul>
<p>Préparez quatre ou cinq histoires de ce type : une réussite, un problème résolu, un travail en équipe, un conflit apaisé, une erreur dont vous avez tiré une leçon. Elles serviront pour la plupart des questions.</p>
<h2>3. Les questions classiques</h2>
<ul>
<li><strong>« Présentez-vous »</strong> : deux minutes maximum, du plus récent au plus ancien, en finissant par la raison de votre candidature.</li>
<li><strong>« Pourquoi ce poste ? »</strong> : reliez ce que vous avez appris sur l’entreprise à ce que vous aimez faire.</li>
<li><strong>« Vos défauts ? »</strong> : choisissez un vrai défaut qui ne bloque pas le poste, et expliquez ce que vous faites pour le corriger.</li>
<li><strong>« Vos prétentions salariales ? »</strong> : renseignez-vous avant sur les salaires du métier dans votre région et donnez une fourchette.</li>
<li><strong>« Pourquoi avez-vous quitté votre dernier emploi ? »</strong> : restez factuel et positif, sans critiquer votre ancien employeur.</li>
</ul>
<h2>4. Le jour J</h2>
<ul>
<li>Arrivez dix minutes en avance, ou testez votre connexion et votre micro un quart d’heure avant une visio.</li>
<li>Ayez votre CV, l’offre et vos notes sous la main.</li>
<li>Écoutez la question jusqu’au bout, prenez deux secondes avant de répondre : c’est un signe de calme, pas d’hésitation.</li>
<li>Préparez deux ou trois questions pour la fin : « À quoi ressemble une journée type ? », « Quels sont les objectifs des six premiers mois ? », « Quelle est la suite du processus ? ».</li>
</ul>
<h2>Après l’entretien</h2>
<p>Envoyez un court message de remerciement dans les 24 heures, en rappelant un point de l’échange. Si vous n’avez pas de nouvelles à la date annoncée, relancez poliment une fois.</p>
<p>Le simulateur d’entretien de JobFacile vous pose les questions d’un recruteur pour l’offre de votre choix, à l’écrit ou à la voix, puis vous donne un bilan. C’est le meilleur moyen de s’entraîner à parler de soi.</p>`
},
{
    slug: 'trouver-une-alternance',
    emoji: '🎓',
    title: 'Trouver une alternance : calendrier, contrats et conseils',
    description: 'Apprentissage ou professionnalisation, quand chercher, où trouver les offres et comment convaincre une entreprise de vous prendre en alternance.',
    minutes: 6,
    date: '2026-11-15',
    html: `
<p>L’alternance permet de préparer un diplôme ou un titre tout en travaillant en entreprise, avec un salaire et une formation prise en charge. Mais la place en formation n’est souvent confirmée qu’une fois le contrat signé : il faut donc chercher son entreprise tôt et avec méthode.</p>
<h2>Les deux contrats</h2>
<ul>
<li><strong>Le contrat d’apprentissage</strong> : le plus courant. Il s’adresse en principe aux jeunes de 16 à 29 ans révolus (des exceptions existent, par exemple pour les personnes en situation de handicap). Il prépare un diplôme ou un titre professionnel enregistré au RNCP.</li>
<li><strong>Le contrat de professionnalisation</strong> : ouvert aux jeunes de 16 à 25 ans et aux demandeurs d’emploi de 26 ans et plus. Il vise une qualification reconnue par la branche professionnelle.</li>
</ul>
<p>Dans les deux cas, vous êtes salarié : vous avez un contrat de travail, une fiche de paie et des congés. Le salaire dépend de votre âge et de votre année de formation ; le simulateur officiel du portail de l’alternance du gouvernement donne le montant exact.</p>
<h2>Le bon calendrier</h2>
<p>La plupart des formations démarrent en septembre ou en octobre. Les entreprises publient leurs offres dès le début de l’année : commencez vos recherches <strong>entre janvier et avril</strong>. Un contrat d’apprentissage peut en général commencer jusqu’à trois mois avant ou après le début de la formation, ce qui laisse un peu de marge si vous n’avez rien trouvé en juin.</p>
<h2>Où chercher</h2>
<ul>
<li>Les offres d’alternance de JobFacile, qui regroupent celles de France Travail et de La bonne alternance.</li>
<li>Les écoles et CFA : beaucoup ont des entreprises partenaires et aident leurs futurs élèves à trouver un contrat.</li>
<li>Les candidatures spontanées : de nombreuses entreprises n’ont jamais publié d’offre mais accepteraient un alternant.</li>
<li>Votre entourage : famille, anciens maîtres de stage, clubs, associations.</li>
</ul>
<h2>Convaincre une entreprise</h2>
<p>Pour l’entreprise, prendre un alternant, c’est investir du temps de formation. Rassurez-la :</p>
<ul>
<li>Indiquez le <strong>rythme</strong> de l’alternance (par exemple 3 jours en entreprise, 2 jours à l’école) et la durée du contrat.</li>
<li>Précisez que l’école est trouvée ou que vous êtes pré-inscrit.</li>
<li>Montrez ce que vous savez déjà faire : stages, projets, jobs d’été.</li>
<li>Rappelez que des aides à l’embauche existent pour les employeurs d’alternants : l’entreprise pourra vérifier les montants en vigueur sur le portail officiel.</li>
</ul>
<h2>Une organisation qui paie</h2>
<p>Tenez un tableau de vos candidatures, relancez au bout de dix jours et prévoyez plusieurs dizaines d’envois : c’est normal. Le suivi de candidatures de JobFacile vous rappelle quand relancer et garde l’historique de chaque échange.</p>`
},
{
    slug: 'relancer-une-candidature',
    emoji: '📬',
    title: 'Relancer une candidature sans être insistant',
    description: 'Quand relancer, par quel moyen, et trois modèles de messages prêts à adapter après une candidature ou un entretien.',
    minutes: 4,
    date: '2026-11-15',
    html: `
<p>Beaucoup de candidats n’osent pas relancer, de peur de déranger. Pourtant, une relance polie montre votre intérêt et remet votre dossier sur le dessus de la pile. Les recruteurs reçoivent beaucoup de candidatures : une relance bien faite est souvent appréciée.</p>
<h2>Quand relancer ?</h2>
<ul>
<li><strong>Après une candidature</strong> : entre 7 et 10 jours ouvrés sans réponse.</li>
<li><strong>Après un entretien</strong> : un remerciement dans les 24 heures, puis une relance si la date de réponse annoncée est dépassée de quelques jours.</li>
<li><strong>Pas plus de deux relances</strong> pour une même offre. Au-delà, mieux vaut passer à d’autres candidatures.</li>
</ul>
<h2>Par quel moyen ?</h2>
<p>Utilisez le même canal que votre candidature : e-mail si vous avez postulé par e-mail, message sur la plateforme si vous avez postulé en ligne. Le téléphone fonctionne bien dans les petites entreprises, les commerces et l’artisanat, où la personne qui recrute est souvent aussi celle qui décroche.</p>
<h2>Modèle 1 : relance après une candidature</h2>
<p><em>Objet : Candidature au poste de [poste] – [Prénom Nom]<br>
Bonjour [Madame/Monsieur Nom],<br>
Je vous ai adressé le [date] ma candidature au poste de [poste]. Ce poste m’intéresse particulièrement car [raison précise, en une phrase]. Je reste disponible pour un échange à votre convenance.<br>
Bien cordialement,<br>[Prénom Nom] – [téléphone]</em></p>
<h2>Modèle 2 : remerciement après un entretien</h2>
<p><em>Bonjour [Prénom ou Madame/Monsieur Nom],<br>
Merci pour notre échange de ce matin. Ce que vous m’avez dit sur [projet ou point abordé] confirme mon envie de rejoindre votre équipe. N’hésitez pas si vous avez besoin d’informations complémentaires.<br>
Bien cordialement,<br>[Prénom Nom]</em></p>
<h2>Modèle 3 : relance après l’entretien</h2>
<p><em>Bonjour [Madame/Monsieur Nom],<br>
Nous nous sommes rencontrés le [date] pour le poste de [poste]. Je me permets de revenir vers vous pour connaître l’avancement de votre recrutement. Ce poste m’intéresse toujours vivement.<br>
Bien cordialement,<br>[Prénom Nom]</em></p>
<h2>Et en cas de refus ?</h2>
<p>Répondez quand même par un court message de remerciement et demandez, si vous le souhaitez, ce qui aurait pu renforcer votre candidature. Certains recruteurs répondent, et gardent votre profil pour une prochaine offre.</p>
<p>Dans le suivi JobFacile, chaque candidature a une date de relance, et l’IA peut rédiger un message de relance adapté à l’offre.</p>`
},
{
    slug: 'passer-les-logiciels-de-tri-ats',
    emoji: '🤖',
    title: 'Passer les logiciels de tri des CV (ATS)',
    description: 'Comment fonctionnent les logiciels qui trient les candidatures, et les règles simples pour que votre CV soit bien lu par la machine puis par l’humain.',
    minutes: 5,
    date: '2026-11-15',
    html: `
<p>Dans les grandes entreprises et les cabinets de recrutement, votre CV est souvent lu d’abord par un logiciel appelé ATS (<em>Applicant Tracking System</em>, système de suivi des candidatures). Il extrait vos informations, les range dans une fiche et aide le recruteur à trier. Un CV mal lu par ce logiciel peut passer inaperçu, même avec un bon profil.</p>
<h2>Ce que fait vraiment un ATS</h2>
<p>Un ATS ne « rejette » pas tout seul la plupart des candidatures : il classe, filtre et affiche les profils selon les critères choisis par le recruteur, en particulier les mots-clés, l’intitulé de poste, l’expérience et la localisation. Votre objectif est donc double : être bien lu, et contenir les bons mots.</p>
<h2>Une mise en page simple</h2>
<ul>
<li>Évitez les tableaux complexes, les colonnes multiples et le texte dans des images ou des formes : le logiciel peut mélanger ou ignorer ces zones.</li>
<li>Utilisez des titres de rubriques classiques : « Expérience professionnelle », « Formation », « Compétences ».</li>
<li>Choisissez une police standard et envoyez un PDF créé depuis un traitement de texte (pas un scan).</li>
<li>Écrivez les dates de la même façon partout, par exemple « 03/2024 – 08/2025 ».</li>
</ul>
<h2>Les bons mots-clés</h2>
<ul>
<li>Reprenez l’<strong>intitulé exact</strong> du poste de l’annonce dans votre titre, s’il correspond à votre profil.</li>
<li>Reprenez les <strong>compétences et outils</strong> cités : logiciels, certifications, permis, langues.</li>
<li>Écrivez les sigles une fois en entier : « Gestion de la relation client (GRC) ».</li>
<li>N’ajoutez jamais de mots cachés ou de compétences que vous n’avez pas : le recruteur les verra, et cela vous discréditera.</li>
</ul>
<h2>Et l’humain dans tout ça ?</h2>
<p>Une fois votre CV sélectionné, c’est une personne qui le lit. Un CV bourré de mots-clés mais illisible ne passera pas cette deuxième étape. Gardez des phrases naturelles et des réalisations concrètes.</p>
<p>Le test ATS de JobFacile compare votre CV à une offre et vous montre les mots-clés présents et manquants, avec des conseils pour les intégrer de façon honnête.</p>`
},
{
    slug: 'droits-demandeur-emploi',
    emoji: '⚖️',
    title: 'Demandeur d’emploi : vos droits et démarches essentielles',
    description: 'S’inscrire à France Travail, comprendre l’allocation chômage, les aides au retour à l’emploi et les formations accessibles : les bases à connaître.',
    minutes: 6,
    date: '2026-11-15',
    html: `
<p>Perdre son emploi ou terminer ses études soulève vite beaucoup de questions administratives. Cet article présente les démarches et les droits principaux. Les règles évoluent régulièrement : vérifiez toujours votre situation précise sur <strong>francetravail.fr</strong> ou auprès de votre conseiller.</p>
<h2>1. S’inscrire à France Travail</h2>
<p>L’inscription se fait en ligne sur francetravail.fr. Elle est utile même si vous n’avez pas droit à une allocation : elle donne accès à l’accompagnement, aux offres, à certaines formations et aux aides. Inscrivez-vous rapidement après la fin de votre contrat : les délais comptent pour l’indemnisation.</p>
<p>Vous signez ensuite un contrat d’engagement et un plan d’action avec votre conseiller. Pensez à vous actualiser chaque mois, même si votre situation n’a pas changé, sinon vos droits peuvent être suspendus.</p>
<h2>2. L’allocation chômage (ARE)</h2>
<p>L’allocation d’aide au retour à l’emploi est versée si vous avez perdu votre emploi de façon involontaire (fin de CDD, licenciement, rupture conventionnelle…) et si vous avez suffisamment travaillé auparavant. En règle générale, il faut avoir travaillé l’équivalent d’environ six mois au cours des deux dernières années ; la durée de référence est plus longue pour les seniors.</p>
<p>Le montant dépend de vos anciens salaires, et la durée de versement dépend de la durée travaillée et de votre âge. Une démission n’ouvre en principe pas de droits, sauf cas de démission dite « légitime » ou de projet de reconversion validé.</p>
<p>L’outil « Mes droits » de JobFacile donne une première estimation ; seul France Travail peut calculer vos droits exacts.</p>
<h2>3. Les aides au retour à l’emploi</h2>
<ul>
<li><strong>Aides à la mobilité</strong> : prise en charge partielle de frais de déplacement, de repas ou d’hébergement pour un entretien ou une reprise d’emploi éloignée.</li>
<li><strong>Aide à la garde d’enfants</strong> pour les parents isolés qui reprennent un emploi ou une formation.</li>
<li><strong>Cumul emploi et allocation</strong> : si vous reprenez un emploi à temps partiel ou court, une partie de l’allocation peut continuer à être versée.</li>
</ul>
<h2>4. Se former</h2>
<p>Votre <strong>Compte personnel de formation (CPF)</strong>, consultable sur moncompteformation.gouv.fr, finance des formations certifiantes : permis, langues, CACES, titres professionnels… France Travail peut compléter le financement si la formation correspond à votre projet. Les régions financent aussi de nombreuses formations gratuites pour les demandeurs d’emploi.</p>
<h2>5. Les autres soutiens</h2>
<ul>
<li>Les <strong>Missions locales</strong> accompagnent les 16–25 ans (emploi, formation, logement, santé).</li>
<li>Les <strong>Cap emploi</strong> accompagnent les personnes en situation de handicap.</li>
<li>La <strong>CAF</strong> peut verser la prime d’activité ou le RSA selon vos ressources : faites une simulation sur caf.fr.</li>
</ul>
<p>Gardez une copie de chaque document (attestation employeur, courriers, justificatifs) : ils vous seront demandés à plusieurs reprises.</p>`
},
{
    slug: 'reseau-et-linkedin',
    emoji: '🤝',
    title: 'Activer son réseau et LinkedIn pour trouver un emploi',
    description: 'Beaucoup d’offres ne sont jamais publiées. Comment parler de votre recherche, optimiser votre profil LinkedIn et décrocher des rendez-vous utiles.',
    minutes: 5,
    date: '2026-11-15',
    html: `
<p>Une part importante des recrutements se fait sans offre publiée : par recommandation, cooptation ou candidature spontanée. On parle de « marché caché ». Votre réseau, même modeste, est un outil de recherche à part entière.</p>
<h2>Votre réseau est plus grand que vous le pensez</h2>
<p>Famille, amis, anciens collègues, camarades de formation, voisins, membres d’un club ou d’une association, commerçants que vous connaissez : chacune de ces personnes connaît elle-même des dizaines d’autres personnes. L’objectif n’est pas de demander un emploi, mais de faire savoir ce que vous cherchez.</p>
<h2>Savoir dire ce que l’on cherche</h2>
<p>Préparez une phrase courte et précise : <em>« Je cherche un poste de préparateur de commandes, en CDI ou en intérim, autour de Lens. J’ai mon CACES 1 et 3. Si tu entends parler d’une entreprise qui recrute, je suis preneur. »</em> Plus votre demande est claire, plus il est facile de vous aider.</p>
<h2>Un profil LinkedIn qui travaille pour vous</h2>
<ul>
<li><strong>Photo</strong> professionnelle et <strong>titre</strong> explicite : « Assistante RH – recherche CDI à Lyon » plutôt que « En recherche d’opportunités ».</li>
<li><strong>Section « Infos »</strong> : trois ou quatre phrases sur ce que vous savez faire et ce que vous cherchez.</li>
<li><strong>Expériences</strong> détaillées avec des réalisations, comme sur votre CV.</li>
<li>Activez l’option « Open to work » (visible par les recruteurs uniquement si vous préférez).</li>
<li>Ajoutez des <strong>compétences</strong> et demandez quelques recommandations à d’anciens collègues ou tuteurs.</li>
</ul>
<h2>Prendre contact sans gêne</h2>
<p>Envoyez des invitations personnalisées : « Bonjour, je vois que vous travaillez comme technicien de maintenance chez X. Je me forme à ce métier et j’aimerais vous poser deux ou trois questions sur votre quotidien, si vous avez dix minutes. » Ces échanges, appelés enquêtes métier, apportent des informations précieuses et parfois des contacts directs avec un recruteur.</p>
<h2>Entretenir son réseau</h2>
<ul>
<li>Remerciez chaque personne qui vous a aidé et tenez-la au courant.</li>
<li>Partagez ou commentez de temps en temps des contenus liés à votre métier.</li>
<li>Participez à des salons, forums emploi et job datings, y compris ceux organisés par France Travail.</li>
</ul>
<p>Et aidez à votre tour : le réseau fonctionne dans les deux sens. La communauté JobFacile est un bon endroit pour échanger avec d’autres personnes en recherche.</p>`
}
,
// Guides pratiques ajoutés ensuite (fichier séparé pour garder chaque fichier lisible)
...require('./articles-guides')
];

// Sections ajoutées aux premiers articles (articles-extra.js) : avant le paragraphe final qui renvoie vers JobFacile, sinon à la fin
const EXTRA = require('./articles-extra');
for (const art of ARTICLES) {
    const add = EXTRA[art.slug];
    if (!add) continue;
    // Forme { before, html } : insérer avant un passage précis (ex. avant la conclusion « Après l’entretien »)
    const html = typeof add === 'string' ? add : add.html;
    const last = art.html.lastIndexOf('<p>');
    let insertAt = last >= 0 && art.html.slice(last).includes('JobFacile') ? last : art.html.length;
    if (add.before && art.html.includes(add.before)) insertAt = art.html.indexOf(add.before);
    art.html = art.html.slice(0, insertAt) + html.trim() + '\n' + art.html.slice(insertAt);
    art.date = '2026-11-17';
}
// Temps de lecture calculé sur le texte réel (environ 220 mots par minute), pour ne pas l’annoncer plus long qu’il n’est
for (const art of ARTICLES) art.minutes = Math.max(2, Math.round(art.html.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length / 220));
const BY_SLUG = new Map(ARTICLES.map(a => [a.slug, a]));
module.exports = { ARTICLES, BY_SLUG };
