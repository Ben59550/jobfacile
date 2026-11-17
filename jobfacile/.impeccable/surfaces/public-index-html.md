---
version: 1
slug: "public-index-html"
primary_target: "public/index.html"
related_targets: []
---

## Scope
Accueil (/) en mode Persuade ; le même univers s'étend à tout le site (en-tête, pied de page, boutons, cartes, sombre).

## Direction contract
THESIS: L'accueil est un tableau des départs : les vraies offres récentes défilent comme les prochains trains. Refuse le titre centré + barre de recherche + grille de cartes de fonctionnalités du secteur.
OWN-WORLD: Bleu départ (#0A2A6B, #061B47) en aplat pour les zones « tableau » ; jaune horaire (#FFD43B) pour l'heure, les repères et l'action principale ; texte blanc sur bleu, encre marine sur gris quai froid (#EEF2F7). Archivo étroit en capitales pour les titres, Archivo pour le texte, chiffres tabulaires. Rayons courts (8 px), filets de ligne comme les rangées d'un tableau. Ni dégradés, ni taches floues, ni emojis.
STORY: Le visiteur voit tout de suite des offres réelles qui arrivent, comprend « près de chez moi, les plus récentes d'abord », tape un métier et une ville, et part vers les offres.
FIRST VIEWPORT: Aplat bleu pleine largeur sous l'en-tête. À gauche, titre géant en capitales « Prochains départs vers votre emploi », sous-titre court, bande de recherche (métier | ville | Rechercher en jaune). À droite sur grand écran, en dessous sur téléphone : le tableau avec horloge à palettes, colonnes Publiée / Métier / Entreprise / Ville / Contrat, 6 offres réelles cliquables.
FORM: Tableau des départs de gare, candidate 5 de la liste. seed:5db8f65f85ba6739
SIGNATURE: Palettes 3D (rotation X) : l'horloge bascule chaque minute, les rangées basculent à l'arrivée des offres et toutes les 8 s ; arrêt au survol et au focus ; aucune rotation si « réduire les animations ».
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
