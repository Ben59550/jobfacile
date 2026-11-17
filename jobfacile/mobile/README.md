# Application mobile JobFacile

JobFacile est déjà **installable** depuis le navigateur (Android, ordinateur, iPhone avec « Sur l'écran d'accueil ») :
notifications, mode hors connexion et raccourcis (Offres, Mon suivi, Messages, Entretien IA) fonctionnent ainsi.

Ce dossier sert à publier une vraie application sur le **Google Play Store** et l'**App Store**.
L'application ouvre le site en ligne : il faut donc que le site soit publié en **HTTPS** avant de la fabriquer.

## Deux façons de faire

| | Avantages | Ce qu'il faut |
|---|---|---|
| **A. Trusted Web Activity** (Android seulement) | Le plus simple ; l'appli est toujours à jour (c'est le site) | Site en HTTPS, outil Bubblewrap, compte Google Play (25 $ une fois) |
| **B. Capacitor** (Android + iPhone) | Une seule base pour les deux stores | Android Studio ; pour l'iPhone : un Mac avec Xcode et un compte Apple Developer (99 $/an) |

Sur cet ordinateur, le JDK 17 et le SDK Android sont déjà installés.

## A. Android avec une Trusted Web Activity (recommandé pour commencer)

```bash
npm install -g @bubblewrap/cli
bubblewrap init --manifest https://VOTRE-DOMAINE.fr/manifest.webmanifest
bubblewrap build
```

Bubblewrap affiche l'**empreinte SHA-256** de la clé de signature. Ajoutez-la dans le fichier `.env` du serveur :

```
ANDROID_PACKAGE=fr.jobfacile.app
ANDROID_SHA256=AA:BB:CC:...   (plusieurs empreintes possibles, séparées par des virgules)
```

Le serveur publie alors `https://VOTRE-DOMAINE.fr/.well-known/assetlinks.json`, ce qui permet à l'appli
de s'afficher en plein écran (sans barre d'adresse). Envoyez ensuite le fichier `.aab` produit sur la Google Play Console.

## B. Android et iPhone avec Capacitor

1. Dans `capacitor.config.json`, remplacez `https://REMPLACEZ-PAR-VOTRE-DOMAINE.fr` par l'adresse du site.
2. Dans ce dossier :
   ```bash
   npm install
   npm run android:init
   npm run android:apk        # APK de test : android/app/build/outputs/apk/debug/
   npm run android:open       # ou ouvrir le projet dans Android Studio pour la version Play Store
   ```
3. iPhone (sur un Mac) : `npm run ios:init`, puis `npx cap open ios` et publication depuis Xcode.

## À savoir

- Les **notifications** Web Push fonctionnent dans la Trusted Web Activity (Android).
  Dans Capacitor, il faudrait passer aux notifications natives (Firebase / APNs) : à prévoir si besoin.
- La **connexion avec Google** fonctionne dans la Trusted Web Activity. Dans Capacitor, ajoutez le domaine
  de l'application aux « Origines JavaScript autorisées » de votre identifiant client Google.
- Les stores demandent une **politique de confidentialité** accessible en ligne : `https://VOTRE-DOMAINE.fr/confidentialite`.
