# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Tout chercheur d'emploi en France (confirmé par le propriétaire) : tous âges, tous métiers, souvent sur téléphone, parfois peu à l'aise avec le numérique. Il arrive avec un besoin concret : trouver une offre près de chez lui et y postuler correctement. Audiences secondaires : alternants, recruteurs qui déposent une offre.

## Product Purpose
JobFacile réunit au même endroit les offres d'emploi et d'alternance de plusieurs sources et les outils pour y répondre : CV et lettre rédigés par IA, simulateur d'entretien, suivi des candidatures, simulateur de droits, conseils. Réussite : le visiteur trouve une offre pertinente près de chez lui et envoie une candidature soignée.

## Positioning
La recherche part du lieu de vie du candidat (« l'emploi au kilomètre près » : distance, temps de trajet, carte) et tout le parcours de candidature tient dans le même site, gratuitement.

## Operating Context
Site web unique (Express, une page `public/index.html`, Tailwind compilé), installable sur téléphone, 26 langues, mode clair et sombre. Financé par la publicité Google AdSense et un abonnement Premium facultatif. AdSense a refusé le site (contenu insuffisant) : chaque page publique doit porter un contenu original, utile et lisible sans connexion, et la navigation doit être évidente.

## Capabilities and Constraints
- Sources d'offres : France Travail, La bonne alternance, Adzuna, JSearch, recruteurs inscrits.
- Les pages sont servies par `src/routes/pages.js` (titres, SEO, articles écrits dans le HTML).
- Tout texte ajouté doit passer par `npm run i18n` ; toute classe par `npm run assets`.
- Les publicités ne doivent apparaître que sur des pages de contenu.
- Non décidé : nom de domaine propre (le site est sur jobfacile.onrender.com).

## Brand Commitments
Le nom JobFacile et le logo (épingle de localisation) sont conservés (confirmé). Vouvoiement. Aucune autre contrainte visuelle imposée.

## Evidence on Hand
Compteurs réels d'offres (API), 8 articles de conseil (`src/data/articles.js`), liste réelle des sources. Pas de témoignages, de chiffres d'utilisateurs ni de logos clients : ne pas en inventer.

## Product Principles
1. Le lieu d'abord : chaque écran aide à trouver près de chez soi.
2. Clair pour quelqu'un de pressé, sur téléphone, peu technophile.
3. Honnête : rien d'inventé, sources citées, gratuit dit sans exagération.
4. Le contenu utile passe avant la publicité.

## Accessibility & Inclusion
Contraste WCAG AA, navigation au clavier, textes simples, respect de « réduire les animations ».
