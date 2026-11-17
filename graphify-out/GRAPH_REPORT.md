# Graph Report - jobfacile  (2026-11-14)

## Corpus Check
- Large corpus: 112 files · ~743,441 words. Semantic extraction will be expensive (many Claude tokens). Consider running on a subfolder.

## Summary
- 1036 nodes · 2093 edges · 49 communities (47 shown, 2 thin omitted)
- Extraction: 92% EXTRACTED · 8% INFERRED · 0% AMBIGUOUS · INFERRED: 170 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Cœur du site (API, session)
- Tests automatiques
- Fiche offre et compatibilité
- Recherche d'offres (API)
- Page HTML et Premium
- Alertes et notifications
- Dépendances serveur
- Mon compte et 2FA
- Diplômes et référentiel ROME
- Interface, carte, thèmes
- Forum communauté
- Offres recruteurs
- Suivi des candidatures
- Entretien simulé vocal
- App mobile Capacitor
- IA et analyse de CV
- Messagerie
- Logo et icônes
- Traduction (i18n)
- Connexion et appareils
- Alertes e-mail serveur
- Forum (interface)
- Base de données
- Messagerie (interface)
- Espace recruteur
- Extraction des textes
- Serveur et e-mails
- Recherche (interface)
- Profil utilisateur
- Sécurité HTTP
- Modération IA
- Paiement Stripe
- Rappels de suivi
- Badges et parrainage
- Page d'état du service
- CV et lettres PDF
- Simulateur de droits
- Traduction automatique
- Fichiers envoyés
- Import LinkedIn
- Parrainage
- Versions des fichiers
- Pages et SEO
- Sauvegardes
- Quotas Premium
- Notifications push
- Temps de trajet
- Voix (TTS)
- Service worker

## God Nodes (most connected - your core abstractions)
1. `JobFacile single-page app shell` - 30 edges
2. `fold()` - 27 edges
3. `saveUsers()` - 22 edges
4. `api()` - 19 edges
5. `getUsers()` - 19 edges
6. `requireAuth()` - 18 edges
7. `tooManyAttempts()` - 17 edges
8. `showNotification()` - 16 edges
9. `esc()` - 13 edges
10. `openJobModal()` - 13 edges

## Surprising Connections (you probably didn't know these)
- `Auth modal (login, register, verify, forgot, 2FA)` --calls--> `openAuthModal()`  [EXTRACTED]
  jobfacile/public/index.html → jobfacile/public/js/app-core.js
- `Home view (hero, quick search, features, CTA)` --calls--> `openAuthModal()`  [EXTRACTED]
  jobfacile/public/index.html → jobfacile/public/js/app-core.js
- `2FA step of auth modal` --calls--> `submit2FA()`  [EXTRACTED]
  jobfacile/public/index.html → jobfacile/public/js/app-core.js
- `Profile view (info, CV/skills/photo, security tabs)` --calls--> `searchSkills()`  [EXTRACTED]
  jobfacile/public/index.html → jobfacile/public/js/app-core.js
- `Premium modal` --references--> `openPremium()`  [INFERRED]
  jobfacile/public/index.html → jobfacile/public/js/premium.js

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **AdSense monetization and consent stack** — jobfacile_ads_google_adsense_seller_record, jobfacile_public_index_adsense_slot, jobfacile_public_index_storage_banner, jobfacile_public_index_premium_modal [INFERRED 0.85]
- **Authentication flow in auth modal** — jobfacile_public_index_auth_modal, jobfacile_public_index_twofa_step, jobfacile_public_js_app_core_openauthmodal, jobfacile_public_js_app_core_submit2fa [EXTRACTED 1.00]
- **Mobile store distribution paths** — jobfacile_mobile_readme_pwa_installable, jobfacile_mobile_readme_trusted_web_activity, jobfacile_mobile_readme_capacitor, jobfacile_mobile_readme_store_privacy_policy [EXTRACTED 1.00]

## Communities (49 total, 2 thin omitted)

### Community 0 - "Cœur du site (API, session)"
Cohesion: 0.06
Nodes (75): accessJobsView(), accessProfileView(), addEducationField(), addExperienceField(), addSkillTag(), animateCounter(), api(), applyLocalAppChange() (+67 more)

### Community 1 - "Tests automatiques"
Cohesion: 0.07
Nodes (43): assert, speakeasy, { test, before, after, describe }, totp(), userWith2FA(), wrongCode(), assert, { test, before, after, describe } (+35 more)

### Community 2 - "Fiche offre et compatibilité"
Cohesion: 0.06
Nodes (51): addToTracker(), appFor(), applications(), applyWithAI(), clearCompare(), closeFollowUp(), closeJobModal(), compareIds (+43 more)

### Community 3 - "Recherche d'offres (API)"
Cohesion: 0.07
Nodes (51): FRANCE_CITIES, NATIONAL_JOBS, ROME_FULL_REFERENTIAL, adzunaSalaries(), router, toMonthly(), communeFor(), geoGet (+43 more)

### Community 4 - "Page HTML et Premium"
Cohesion: 0.06
Nodes (49): ads.txt Google AdSense authorized seller record, assetlinks.json (ANDROID_PACKAGE / ANDROID_SHA256), Capacitor (Android + iPhone), Mobile app publishing guide (README), PWA installability (push, offline, shortcuts), Store privacy policy requirement (/confidentialite), Trusted Web Activity (Bubblewrap, Android), premium.svg (Premium logo SVG source) (+41 more)

### Community 5 - "Alertes et notifications"
Cohesion: 0.07
Nodes (38): alertText(), b64ToU8(), chatTargetJob(), createAlert(), createAlertFromSearch(), currentPushSubscription(), currentView(), disablePush() (+30 more)

### Community 6 - "Dépendances serveur"
Cohesion: 0.06
Nodes (43): dependencies, axios@^1.6.0, compression@^1.8.2, cors@^2.8.5, dotenv@^16.3.1, express@^4.18.2, fflate@^0.8.3, google-auth-library@^10.9.1 (+35 more)

### Community 7 - "Mon compte et 2FA"
Cohesion: 0.09
Nodes (25): addLanguage(), CONTRACT_CHOICES, disable2FA(), enable2FA(), fillProfileInfo(), focusField(), LANG_LEVELS, loadTrustedDevices() (+17 more)

### Community 8 - "Diplômes et référentiel ROME"
Cohesion: 0.07
Nodes (29): BAC_GENERAL, BAC_PRO, BAC_TECHNO, BEP_BP, BTS, BUT, CAP, CERTIFS (+21 more)

### Community 9 - "Interface, carte, thèmes"
Cohesion: 0.11
Nodes (19): analyzeCV(), brandColor(), COLOR_THEMES, currentColorTheme(), directionsUrl(), getRecent(), loadLeaflet(), locateJobs() (+11 more)

### Community 10 - "Forum communauté"
Cohesion: 0.13
Nodes (22): authorMap(), clean(), optionalAuth(), requireAdmin(), router, addPost(), addTopic(), CATEGORIES (+14 more)

### Community 11 - "Offres recruteurs"
Cohesion: 0.14
Nodes (21): CONTRACTS, offerSummary(), router, countView(), crypto, getOffer(), km(), newOfferId() (+13 more)

### Community 12 - "Suivi des candidatures"
Cohesion: 0.15
Nodes (22): accessTracker(), applyLinkedin(), closeModal(), downloadIcs(), fmtInterview(), googleCalendarUrl(), icsDate(), IV_KINDS (+14 more)

### Community 13 - "Entretien simulé vocal"
Cohesion: 0.22
Nodes (22): afterSpeech(), appendChatBubble(), browserSpeak(), cleanForSpeech(), frenchVoice(), onRecordingDone(), pickMime(), recChunks (+14 more)

### Community 14 - "App mobile Capacitor"
Cohesion: 0.11
Nodes (22): dependencies, @capacitor/android@^7.0.0, @capacitor/cli@^7.0.0, @capacitor/core@^7.0.0, @capacitor/ios@^7.0.0, @capacitor/splash-screen@^7.0.0, description, name (+14 more)

### Community 15 - "IA et analyse de CV"
Cohesion: 0.12
Nodes (16): multer@^2.5.0, buildProfileCvText(), cvUpload, fs, multer, path, router, QUALIF_LABELS (+8 more)

### Community 16 - "Messagerie"
Cohesion: 0.16
Nodes (15): router, STATUS_TEXT, addMessage(), conversationsOf(), createConversation(), crypto, getConversation(), getMessage() (+7 more)

### Community 17 - "Logo et icônes"
Cohesion: 0.13
Nodes (14): apple-touch-icon.png (iOS home screen icon, 180px), icon-192.png (PWA icon 192px, rounded square), icon-512.png (PWA icon 512px, rounded square), logo.svg (vector logo / favicon, green pin with J), JobFacile logo: emerald green (#059669) map pin with white circle and J, maskable-512.png (Android maskable PWA icon, full-bleed), EDGE, { execFileSync } (+6 more)

### Community 18 - "Traduction (i18n)"
Cohesion: 0.22
Nodes (16): applyI18n(), I18N_ATTRS, i18nNorm(), LANGUAGES, LEGAL_NOTICE, originalText, renderLangButton(), setLanguage() (+8 more)

### Community 19 - "Connexion et appareils"
Cohesion: 0.22
Nodes (16): crypto, router, speakeasy, createSession(), crypto, deviceLabel(), findTrustedDevice(), genCode() (+8 more)

### Community 20 - "Alertes e-mail serveur"
Cohesion: 0.26
Nodes (15): getUsers(), sendEmail(), crypto, router, ALERT_FREQ, alertEmailHtml(), alertLabel(), checkAlerts() (+7 more)

### Community 21 - "Forum (interface)"
Cohesion: 0.23
Nodes (13): ago(), categories(), createTopic(), deleteForum(), editForum(), forumState, loadTopics(), openAdmin() (+5 more)

### Community 22 - "Base de données"
Cohesion: 0.15
Nodes (13): crypto, fs, path, SECRET_FILE, USERS_FILE, crypto, { DatabaseSync }, DB_FILE (+5 more)

### Community 23 - "Messagerie (interface)"
Cohesion: 0.23
Nodes (10): CONV_STATUS, conversations, loadConversations(), openConversation(), openMessages(), pollUnread(), renderThreadEmpty(), sendMessage() (+2 more)

### Community 24 - "Espace recruteur"
Cohesion: 0.19
Nodes (7): OFFER_STATUS, openRecruiter(), REC_CONTRACTS, renderRecruiter(), saveOffer(), setOfferStatus(), verifyCompany()

### Community 25 - "Extraction des textes"
Cohesion: 0.15
Nodes (10): fs, html, legalEnd, legalStart, list, norm(), path, pieces() (+2 more)

### Community 26 - "Serveur et e-mails"
Cohesion: 0.15
Nodes (9): app, cors, express, multer, path, nodemailer, sendCodeEmail(), testOutbox (+1 more)

### Community 27 - "Recherche (interface)"
Cohesion: 0.22
Nodes (8): AUDIENCES, fetchJobs(), jobsSkeleton(), loadCommutes(), LOGO_COLORS, onSortChange(), renderAudiencePanel(), sortJobsForDisplay()

### Community 28 - "Profil utilisateur"
Cohesion: 0.17
Nodes (12): deleteUser(), writeUser(), AVAILABILITY, CONTRACTS, fs, path, QRCode, QUALIF_CODES (+4 more)

### Community 29 - "Sécurité HTTP"
Cohesion: 0.23
Nodes (10): ADSENSE, applyHttpSecurity(), compression, helmet, ICON, router, clientIp(), ipLimit() (+2 more)

### Community 30 - "Modération IA"
Cohesion: 0.23
Nodes (9): callGroq(), addReport(), ADMIN_EMAILS, heuristicCheck(), moderate(), openReports(), reportStmt, resolveReports() (+1 more)

### Community 31 - "Paiement Stripe"
Cohesion: 0.24
Nodes (9): PUBLIC_URL, applySubscription(), cancelSubscriptionNow(), crypto, periodEnd(), router, stripe(), stripeWebhook() (+1 more)

### Community 32 - "Rappels de suivi"
Cohesion: 0.30
Nodes (11): simpleEmailHtml(), notifyRecipient(), sendPushToUser(), checkReminderToken(), checkTrackerReminders(), crypto, dueReminders(), frDateTime() (+3 more)

### Community 33 - "Badges et parrainage"
Cohesion: 0.29
Nodes (8): badgeContext(), BADGES, bestStreak(), checkNewBadges(), earnedBadges(), loadReferral(), renderProgress(), weeklyStreak()

### Community 34 - "Page d'état du service"
Cohesion: 0.29
Nodes (8): lastBackup(), ago(), collect(), fs, getStatus(), path, provider(), timed()

### Community 35 - "CV et lettres PDF"
Cohesion: 0.24
Nodes (9): avatarPath(), CV_TEMPLATES, cvData(), fs, path, PDFDocument, pdfSafe(), renderLetter() (+1 more)

### Community 36 - "Simulateur de droits"
Cohesion: 0.29
Nodes (8): AIDS, ARE_RULES, byAge(), estimateARE(), euro(), openRights(), runRightsSim(), switchRightsTab()

### Community 37 - "Traduction automatique"
Cohesion: 0.27
Nodes (8): DIR, fs, LANGS, path, prompt(), translateBatch(), viaGemini(), viaGroq()

### Community 38 - "Fichiers envoyés"
Cohesion: 0.29
Nodes (8): publicUser(), checkSignature(), crypto, fs, path, serveUpload(), sig(), signUpload()

### Community 39 - "Import LinkedIn"
Cohesion: 0.20
Nodes (5): APP_STATUSES, crypto, liUpload, multer, router

### Community 40 - "Parrainage"
Cohesion: 0.31
Nodes (7): attachReferrer(), crypto, ensureReferralCode(), findReferrer(), makeCode(), normCode(), router

### Community 41 - "Versions des fichiers"
Cohesion: 0.25
Nodes (6): crypto, file, fs, html, path, PUB

### Community 42 - "Pages et SEO"
Cohesion: 0.25
Nodes (5): ROOT_DIR, fs, INDEX_FILE, path, router

### Community 43 - "Sauvegardes"
Cohesion: 0.32
Nodes (7): db, backupNow(), fs, listBackups(), LOCAL_DIR, path, scheduleBackups()

### Community 44 - "Quotas Premium"
Cohesion: 0.46
Nodes (7): FREE_LIMITS, isPremium(), KIND_LABELS, monthKey(), planInfo(), quota(), usageOf()

### Community 45 - "Notifications push"
Cohesion: 0.29
Nodes (4): fs, path, VAPID_FILE, webpush

### Community 47 - "Voix (TTS)"
Cohesion: 0.40
Nodes (3): audioUpload, multer, router

## Knowledge Gaps
- **13 isolated node(s):** `ads.txt Google AdSense authorized seller record`, `assetlinks.json (ANDROID_PACKAGE / ANDROID_SHA256)`, `Career advice view`, `About view`, `Rights simulator view (unemployment ARE, mobility aids)` (+8 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 379 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **2 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `JobFacile gold Premium logo: gold crown over gold map-pin with J, on dark navy rounded square with gold border and sparkles` connect `Page HTML et Premium` to `Paiement Stripe`?**
  _High betweenness centrality (0.353) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `fold()` (e.g. with `routes/tracker.js` and `utils.js`) actually correct?**
  _`fold()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `ads.txt Google AdSense authorized seller record`, `assetlinks.json (ANDROID_PACKAGE / ANDROID_SHA256)`, `Career advice view` to the rest of the system?**
  _13 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Cœur du site (API, session)` be split into smaller, more focused modules?**
  _Cohesion score 0.06360759493670887 - nodes in this community are weakly interconnected._
- **Should `Tests automatiques` be split into smaller, more focused modules?**
  _Cohesion score 0.06610259122157588 - nodes in this community are weakly interconnected._
- **Should `Fiche offre et compatibilité` be split into smaller, more focused modules?**
  _Cohesion score 0.06327683615819209 - nodes in this community are weakly interconnected._
- **Should `Recherche d'offres (API)` be split into smaller, more focused modules?**
  _Cohesion score 0.06610169491525424 - nodes in this community are weakly interconnected._