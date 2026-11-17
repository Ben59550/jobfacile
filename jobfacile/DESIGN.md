---
name: JobFacile
description: Offres d'emploi près de chez soi, affichées comme un tableau des départs de gare.
colors:
  bleu-depart: "#0a2a6b"
  bleu-nuit: "#061b47"
  bleu-ligne: "#0f3296"
  bleu-pale: "#bacdfc"
  jaune-horaire: "#ffd43b"
  jaune-survol: "#ffde59"
  jaune-ombre: "#be8c00"
  gris-quai: "#eef2f7"
  encre-marine: "#0b1b3f"
  texte-second: "#3e4f6c"
  filet: "#d9e0ea"
  contour-champ: "#cdd6e4"
  blanc: "#ffffff"
  nuit-fond: "#04112b"
  nuit-carte: "#0a2150"
  nuit-filet: "#1d3d78"
  plaque-chiffre: "#020c26"
typography:
  display:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "clamp(3.1rem, 8vw, 5.6rem)"
    fontWeight: 800
    lineHeight: 0.95
    letterSpacing: "-0.01em"
  headline:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "3.75rem"
    fontWeight: 800
    lineHeight: 0.95
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "1.45rem"
    fontWeight: 800
    lineHeight: 1.15
  body:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "0.7rem"
    fontWeight: 700
    letterSpacing: "0.14em"
  data:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "1.05rem"
    fontWeight: 800
    fontFeature: "tnum"
rounded:
  plaque: "4px"
  champ: "0.5rem"
  carte: "0.75rem"
  arret: "50%"
spacing:
  rangee-y: "0.72rem"
  rangee-x: "1.25rem"
  champ: "0.75rem 1rem"
  article-y: "1.35rem"
components:
  button-primary:
    backgroundColor: "{colors.jaune-horaire}"
    textColor: "{colors.bleu-nuit}"
    rounded: "{rounded.champ}"
    padding: "1rem 1.75rem"
  button-primary-hover:
    backgroundColor: "{colors.jaune-survol}"
    textColor: "{colors.bleu-nuit}"
  button-board-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.blanc}"
  card:
    backgroundColor: "{colors.blanc}"
    rounded: "{rounded.carte}"
  input-field:
    backgroundColor: "{colors.blanc}"
    textColor: "{colors.encre-marine}"
    rounded: "{rounded.champ}"
    padding: "{spacing.champ}"
  board:
    backgroundColor: "{colors.bleu-nuit}"
    textColor: "{colors.blanc}"
    rounded: "{rounded.carte}"
  board-row:
    textColor: "{colors.blanc}"
    padding: "0.72rem 1.25rem"
    height: "3.6rem"
  board-time:
    textColor: "{colors.jaune-horaire}"
    typography: "{typography.data}"
  flap-digit:
    backgroundColor: "{colors.plaque-chiffre}"
    textColor: "{colors.jaune-horaire}"
    rounded: "{rounded.plaque}"
    width: "1.55rem"
    height: "2.15rem"
---

# Design System: JobFacile

## Overview

**Creative North Star: "Le tableau des départs"**

Le site se lit comme un hall de gare : des aplats bleu départ où les offres arrivent comme des trains, l'heure et l'action en jaune horaire, le reste posé sur un gris quai froid avec une encre marine. Tout ce qui est donnée (heure de publication, kilomètres, minutes de lecture) est en chiffres tabulaires, comme sur un afficheur.

La densité est celle d'un tableau d'affichage : rangées séparées par des filets fins, colonnes fixes, titres en capitales étroites. Le mouvement est mécanique et rare : des palettes qui basculent, jamais de flottement décoratif. Ni dégradés, ni taches floues, ni emojis.

**Key Characteristics:**
- Zones « tableau » en aplat bleu (#0a2a6b / #061b47), texte blanc, données en jaune.
- Titres Archivo étroit (75 %), 800, capitales ; texte Archivo normal.
- Rayons courts, filets de rangée plutôt qu'ombres.
- Palettes 3D en rotation X comme seule signature animée.
- Mode sombre « gare de nuit » en bleu marine, pas en ardoise.

## Colors

Deux voix sur un quai : le bleu départ porte les tableaux, le jaune horaire signale l'heure, la direction et l'action.

### Primary
- **Bleu départ** (`--e-800`, `--board`): aplat pleine largeur de l'accueil et du bandeau final, tracé de la ligne des outils, anneau extérieur du focus.
- **Bleu nuit** (`--e-900`, `--board-deep`): fond du tableau des offres, encre du bouton principal.
- **Bleu ligne** (`--e-700`): liens et flèches « aller » sur fond clair (arrêts, articles).
- **Bleu pâle** (`--e-200`): texte secondaire et en-têtes de colonnes sur le tableau.

### Secondary
- **Jaune horaire** (`--t-400`, `--hour`): heures, km, contrats alternatifs, bouton principal, arrêt terminus, soulignés de lien, anneau de focus. Jamais en aplat de section.
- **Jaune survol** (`--t-300`): survol du bouton principal, sélection de texte, accents jaunes en mode sombre.
- **Jaune ombre** (`--t-600`): l'arête de 2 px sous le bouton principal.

### Neutral
- **Gris quai** (`--quai`): fond de page en mode clair.
- **Encre marine** (`--ink`): texte courant et titres sur fond clair ; filet de 2 px en tête des rangées d'articles.
- **Texte second**: descriptions d'arrêts et d'articles.
- **Filet**: bordure des cartes, séparateurs de rangées, cloisons de la bande de recherche.
- **Contour champ**: bordure des champs de formulaire.
- **Nuit fond / Nuit carte / Nuit filet**: sol, cartes et filets du mode sombre.
- **Plaque chiffre**: le fond des chiffres de l'horloge à palettes.

### Named Rules
**The Deux Voix Rule.** Le bleu porte les surfaces, le jaune porte l'information. Si un élément jaune n'est ni une heure, ni une distance, ni l'action principale, ni un repère de focus ou de lien, il n'a pas à être jaune.

**The Thèmes Rule.** Les couleurs passent toujours par les rampes `--e-*` (marque) et `--t-*` (accent) ; les utilitaires Tailwind `emerald-*` et `teal-*` y sont branchés. L'utilisateur peut choisir d'autres thèmes (`data-color` : vert, ocean, violet, corail, indigo) ; le thème par défaut (clé `emeraude`, libellé « Bleu départ ») est la palette du tableau. Ne jamais coder en dur une couleur de marque.

## Typography

**Display Font:** Archivo à `font-stretch: 75%` (avec system-ui, sans-serif)
**Body Font:** Archivo (avec system-ui, sans-serif)

**Character:** Une seule famille, deux allures : étroite, grasse et en capitales pour l'affichage ; normale pour la lecture. C'est la typographie d'un afficheur de quai.

### Hierarchy
- **Display** (800, 3.1rem à 5.6rem, 0.95, capitales, étroit 75 %): le titre de l'aplat d'accueil, en blanc.
- **Headline** (800, 2.25rem à 3.75rem, 0.95, capitales, étroit 75 %): titres de section et de vue, en encre marine.
- **Title** (800, 1.45rem, 1.15, capitales, étroit 80 %): noms d'arrêts de la ligne ; titres d'articles en 1.15rem non capitalisés.
- **Body** (400, 1rem, 1.55 ; 1.75 et 70ch dans les articles longs): texte courant.
- **Label** (700, 0.7rem, 0.14em, capitales): en-têtes de colonnes du tableau ; les étiquettes de champs utilisent 0.75rem gras en capitales.
- **Data** (800, étroit 75 %, chiffres tabulaires): heures de publication, km, minutes de lecture, chiffres de l'horloge.

### Named Rules
**The Afficheur Rule.** Toute donnée chiffrée alignée en colonne utilise les chiffres tabulaires (`font-variant-numeric: tabular-nums`).

## Layout

Bandes pleine largeur alternant aplat bleu (accueil, bandeau final) et gris quai. Sur l'accueil, titre et recherche à gauche, tableau à droite sur grand écran, empilés sur téléphone. Le tableau a des colonnes fixes (4.6rem | 1fr | 8.5rem | 5.2rem) ; sous 640 px la colonne ville disparaît (3.4rem | 1fr | 4.6rem). La bande de recherche passe d'une pile à trois colonnes (métier | ville | bouton) à partir de 640 px. La ligne des outils est verticale sur mobile et devient horizontale à quatre arrêts à partir de 1024 px. Jamais de défilement horizontal de page (`overflow-x: clip`).

## Elevation & Depth

Profondeur surtout tonale : bleu nuit sur bleu départ, carte blanche sur gris quai, filets de 1 px. Les ombres restent basses et marines, réservées aux objets posés sur le bleu (tableau, bande de recherche) et à l'arête du bouton principal.

### Shadow Vocabulary
- **Arête du bouton** (`box-shadow: 0 2px 0 rgb(var(--t-600)), 0 8px 18px -10px rgb(var(--e-900) / .5)`): le bouton jaune, comme une touche.
- **Tableau posé** (`box-shadow: 0 0 0 1px rgb(255 255 255 / .07), 0 32px 64px -32px rgb(0 0 0 / .75)`): le tableau des offres sur l'aplat bleu.
- **Carte au repos** (`box-shadow: 0 1px 2px rgb(var(--e-900) / .05)`): cartes sur le quai.

### Named Rules
**The Filet Rule.** On sépare par un filet de rangée avant de séparer par une ombre.

## Shapes

Rayons courts et fonctionnels : 4 px pour les plaques (chiffres, pastilles de contrat), 0.5rem pour les champs, 0.75rem pour cartes et tableau. Le seul rond est l'arrêt de ligne (32 px, bordure 6 px) et le trait de ligne de 6 px. Le bouton principal perd son rayon quand il est encastré dans la bande de recherche.

## Components

### Buttons
- **Shape:** rayon court (0.5rem) ; carré (0) dans la bande de recherche.
- **Primary:** jaune horaire, encre bleu nuit, 800, arête jaune ombre ; dans la bande de recherche en capitales, 0.04em, étroit 85 %.
- **Hover / Focus:** monte de 1 px et passe au jaune survol ; focus clavier global en anneau jaune de 3 px doublé de bleu départ à 5 px.
- **Ghost sur le tableau:** texte blanc, bordure blanche 2 px à 70 % ; au survol fond blanc, texte bleu départ.
- **Liens:** gras, soulignés de 2 px en jaune horaire, décalage 5 px (blanc sur bleu, bleu ligne sur clair).

### Cards / Containers
- **Corner Style:** 0.75rem.
- **Background:** blanc ; nuit carte en sombre.
- **Border:** filet 1 px.
- **Hover:** monte de 3 px, ombre marine diffuse, bordure `--e-300`.

### Inputs / Fields
- **Style:** blanc, contour champ 1 px, 0.5rem, padding 0.75rem 1rem.
- **Focus:** bordure `--e-500` et halo 4 px à 15 %. Dans la bande de recherche, filet jaune de 3 px en bas du champ actif.

### Navigation
- Liens 600 en 0.875rem, survol fond `--e-50`. Lien actif : texte bleu départ et barre jaune de 3 px en bas, sans rayon.

### Tableau des départs
Bleu nuit, rayon 0.75rem. En-tête avec titre étroit en capitales et horloge à palettes ; colonnes Publiée / Métier / Entreprise / Ville / Contrat ; rangées de 3.6rem séparées par des filets blancs à 7 %. Heure en jaune ; pastille de contrat en contour blanc 1.5px, jaune pour l'alternative. Rangée au focus : barre jaune de 4 px à gauche.

**Mouvement:** les rangées basculent en rotation X (−95° vers 0, 0.6 s, axe haut, décalage 70 ms par rangée) à l'arrivée et toutes les 8 s ; pause au survol et au focus ; aucune rotation sous `prefers-reduced-motion`. Les chiffres de l'horloge (plaques coupées d'un trait au milieu) basculent seulement quand ils changent.

### Ligne des outils
Les outils sont les arrêts d'une ligne : trait bleu départ de 6 px, arrêts ronds blancs cerclés de bleu, terminus jaune. Au survol ou au focus, l'arrêt devient jaune et grossit de 12 %. En sombre, trait et cercles en `--e-400` sur nuit fond.

### Rangées d'articles
Filet encre de 2 px en tête, une rangée par article (4.5rem | 1fr | auto) : minutes de lecture en données bleu ligne, titre 800, description en texte second, flèche qui glisse de 4 px au survol.

## Do's and Don'ts

### Do:
- **Do** poser les zones « tableau » en aplat bleu départ ou bleu nuit avec texte blanc et données en jaune horaire.
- **Do** passer chaque couleur de marque par `--e-*` / `--t-*` pour que les thèmes `data-color` continuent de marcher.
- **Do** écrire les titres en Archivo étroit 75 %, 800, capitales, et les données en chiffres tabulaires.
- **Do** séparer les éléments répétés par des filets de rangée (1 px, `--filet` ou blanc à 7 % sur bleu).
- **Do** couper toute rotation de palettes sous `prefers-reduced-motion` et la mettre en pause au survol et au focus.
- **Do** garder le mode sombre en bleu marine (#04112b sol, #0a2150 cartes, #1d3d78 filets).

### Don't:
- **Don't** utiliser de dégradés, de taches floues ou d'emojis.
- **Don't** mettre le jaune horaire en aplat de section ou en texte courant sur fond clair.
- **Don't** utiliser de grands rayons (au-delà de 0.75rem) sur cartes, tableaux ou champs.
- **Don't** ajouter d'animation flottante ou en boucle ; la seule signature est la palette qui bascule.
- **Don't** passer le mode sombre en gris ardoise.
