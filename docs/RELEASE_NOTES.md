# Release Notes

## 0.25.0 — Guides de l’atelier — 2026-08-26

- Un nouvel espace éditorial public est disponible sous `/guides/`, avec un
  hub et trois articles complets en français, anglais, allemand et
  luxembourgeois. Les comparaisons citent les versions officielles, évitent les
  notes globales et déclarent que Nicolas Pieper est le créateur de Papers Empire.
- Les guides disposent d’un rendu statique léger, distinct du jeu et de la
  documentation technique : aucun runtime Three.js ou script de simulation
  n’est chargé. La typographie, les couleurs et trois nouvelles illustrations
  1200 × 630 prolongent la direction Production Twin.
- Le catalogue éditorial génère les seize pages, leurs canonicals, les clusters
  hreflang, les schémas `Article`/`CollectionPage`/`BreadcrumbList` et le
  sitemap complet de vingt URL. Le sitemap manuel devient inutile.
- Le gate SEO parcourt désormais chaque page et refuse les métadonnées en
  double, les alternates incomplets, les images absentes, les schémas
  incohérents et les routes oubliées. Le déploiement manuel et Workers Builds
  exécutent le gate complet avant Wrangler.

## 0.24.2 — Découverte Google et URLs canoniques — 2026-08-26

- Les titres et descriptions des quatre langues nomment clairement Papers
  Empire comme jeu idle gratuit dans le navigateur. Le hero français emploie
  aussi cette formulation dans le contenu visible.
- Le sélecteur de langue navigue vers `/`, `/en/`, `/de/` ou `/lb/` au lieu de
  fabriquer des variantes `?lang` contradictoires avec leur canonical.
- Le trafic HTTP rejoint l'apex HTTPS en une redirection permanente. Les hôtes
  Workers et previews sont `noindex`, comme la documentation technique, afin
  de concentrer l'indexation sur les quatre pages joueur.
- Le sitemap ne publie plus de dates `lastmod` inexactes. Un nouveau contrôle
  SEO valide après build les head localisés, hreflang, canonicals, JSON-LD,
  sitemap, robots et textes statiques sans JavaScript.

## 0.24.1 — Livraison Cloudflare Workers — 2026-08-24

- Cloudflare Workers devient l'unique plateforme de production. Le Worker sert
  le site statique complet sur `papersempire.com` et redirige définitivement
  `www.papersempire.com` vers le domaine canonique en conservant chemin et
  paramètres.
- `wrangler.jsonc` décrit les assets, les domaines personnalisés,
  l'observabilité et la date de compatibilité. Le Worker réapplique les en-têtes
  de sécurité sur les pages, les assets, les erreurs et les redirections.
- Le contrôle requis construit la documentation et les quatre variantes de
  langue, teste le Worker, puis exécute un déploiement Wrangler à blanc. Les
  pushes sur `main` sont construits et déployés par Cloudflare Workers Builds.

## 0.24.0 — « Dossier du moment » : progression lisible — 2026-08-23

- Le poste de commande présente un seul dossier prioritaire. Sans commande
  active, il indique la prochaine unité ou la réorganisation à préparer, les
  ressources manquantes et un délai quand la cadence permet de l'estimer.
- Les contrats restent dans Expéditions. Lorsqu'un contrat est accepté, il
  prend temporairement la place du dossier interne et affiche son temps écoulé,
  son temps restant et sa récompense exacte. La livraison rend ensuite le
  prochain objectif de l'atelier.
- Les achats de machines et d'améliorations indiquent le coût, l'effet avant et
  après, puis confirment localement l'action réussie. Les offres impossibles
  restent désactivées et exposent leurs prérequis.
- Chaque incident aléatoire peut être ignoré avec le bouton de fermeture ou
  `Échap`, sans appliquer de conséquence. Un bouton coupe durablement ces
  interruptions ; le réglage Interface permet de les réactiver.
- Le premier incident ne peut pas arriver avant 2 min 30, puis deux incidents
  sont séparés d'au moins 4 min 30. Leur cadence suit le temps réel, même en
  mode accéléré. Les bandeaux de résultat disparaissent après six secondes.
- Les CSS sont publiées sous `style.<sha>.css` et
  `experience-v4.<sha>.css`. Les quatre langues, le contraste élevé, le
  mouvement réduit, le clavier et les petits écrans conservent les mêmes
  contrats de résilience.

## 0.23.3 : logos détourés, 2026-08-23

- Papers Empire et Data Science Zone disposent de dérivés PNG et WebP avec
  alpha réel. Les pixels peints restent ceux des images canoniques. Les icônes
  PWA conservent leur fond plein.
- Les headers, footers et enseignes utilisent le bon signe sans ajouter de
  carte, bordure ou second fond. La Data Science Zone affiche son emblème au
  lieu de répéter le logo Papers Empire.
- La revue Ponytail simplifie le chargement des images, les observateurs du
  footer et les transitions d'état. Elle retire aussi les règles et traductions
  en double sans changer les mécaniques du jeu.
- Le header Retype réutilise le logo détouré depuis l'asset public. La
  documentation retire le journal interne de la navigation et archive l'ancien
  plan web.

## 0.23.2 — « Canonical Brand Pass V5 » : une seule source de marque — 2026-08-20

- Le pictogramme vectoriel plat introduit dans le header de jeu, le favicon et
  les icônes installables est retiré. La landing et le jeu affichent désormais
  le même lockup peint `papers-empire-logo-v2` ; les PNG navigateur, iOS et PWA
  sont des recadrages et redimensionnements fidèles de ce master.
- La Data Science Zone abandonne son interprétation SVG simplifiée. Son nouvel
  emblème reprend la couronne dorée, les rouleaux, l'acier travaillé, le papier
  ivoire et la lumière du logo d'accueil ; seul le signal cyan distingue la
  lecture analytique. Le master 1254 px reste hors build et les dérivés 512 px
  PNG/WebP alimentent l'interface.
- Les contrats de résilience interdisent maintenant le retour des anciens marks
  plats, garantissent le logo peint en mode jeu et vérifient les dimensions du
  fallback Data Science. Aucun comportement de simulation n'est modifié.

## 0.23.1 — « Quality Pass V5 » : chaque pixel compte — 2026-08-20

- Sur MacBook et grand écran, la scène Three.js gagne en hauteur et peut
  occuper jusqu'à 1920 px de large. Le renderer conserve son DPR borné et son
  redimensionnement piloté par `ResizeObserver` ; seule la surface CSS limitante
  a été corrigée.
- La console d'impression n'est plus `sticky` sur toute l'Operations Deck : sa
  grande carte reprend le flux normal et ne recouvre plus Stratégie ni
  Progression. Les valeurs de production restent wrappables.
- Le HUD empile libellé et valeur dans chaque métrique, sur la landing comme en
  jeu. Le statut du campus et la phrase d'ambiance partagent désormais une pile
  ancrée avec un espacement réel, sans superposition.
- Le catalogue desktop passe de six colonnes microscopiques à une grille 3×2 :
  légendes plus grandes, retour à la ligne et miniatures contenues. Les KPI et
  recommandations de la Data Science Zone ne rognent plus leurs glyphes ni les
  valeurs longues.
- La carte Open Graph/Twitter est une capture 1200×630 de la landing Production
  Twin actuelle. Le favicon et les icônes iOS/PWA dérivent d'un nouveau master
  vectoriel navy, ivoire, or et orange, avec fond plein compatible `maskable`.
  Les miniatures V4, badges de succès, sceau de prestige et fallbacks historiques
  restent intacts lorsqu'ils sont déjà cohérents ou sémantiquement justifiés.

## 0.23.0 — « Precision Pass V5 » : l'usine tient aussi dans la poche — 2026-08-18

- Safari ne peut plus restaurer indéfiniment une ancienne combinaison
  HTML/CSS/WebGL depuis son BFCache : le retour d'une page gelée déclenche une
  recharge unique, puis repart du build courant. HTML, CSS, JavaScript, images,
  polices, `srcset`, imports Three.js, ressources assemblées au runtime et
  icônes du manifest partagent désormais le même identifiant de révision.
- Le canvas Three.js reste caché jusqu'à sa première frame valide. L'image de
  secours demeure visible si WebGL2 est absent, si le module échoue, si le
  contexte est perdu ou lorsque le contraste élevé désactive la scène.
- La Data Science Zone reçoit l'emblème vectoriel « Crown Analyzer », conçu à
  partir d'une exploration ImageGen : couronne de papier, rouleaux et courbe de
  cadence cyan, avec nom et sous-titre conservés en HTML.
- La feuille de la presse manuelle dispose désormais d'une vraie chambre
  d'admission masquée. Elle glisse dans la fente sans s'écraser ni traverser le
  bouton ; les clics rapides rejouent une animation WAAPI sans forcer de reflow.
- Sur mobile, les six étapes de la landing deviennent une liste image/copie
  lisible, tandis que la composition verticale fidèle à l'affiche reste active
  sur grand écran.
- `npm run ui:check` verrouille les contrats BFCache, contraste élevé, première
  frame Three.js, fente de presse, cache runtime et présence du sous-logo ; le
  contrôle est exécuté par la validation Cloudflare.

## 0.22.0 — « Production Twin V4 » : le monde, le jeu et la donnée ne font plus qu'un — 2026-08-18

- Nouveau contrat visuel révocable : la métaphore « Atelier tamponné » cesse
  d'être une zone gelée. La direction active devient une miniature industrielle
  illustrée — acier bleu nuit, orange sécurité, papier ivoire, métal et lumière
  chaude — évaluée sur son utilité produit.
- La landing devient un sas : une partie vierge reste inactive jusqu'à l'entrée
  explicite dans l'atelier ; après démarrage, le contenu marketing disparaît et
  une sauvegarde existante revient directement au jeu. L'introduction reste
  consultable sans remettre la progression à zéro.
- Le production twin Three.js est partagé : spectacle dans l'affiche, carte
  compacte dans le jeu, toujours reliée aux bâtiments possédés. La nouvelle
  cible abandonne le rendu pixel/low-poly rudimentaire au profit de géométries
  procédurales mieux finies, matériaux PBR partagés et absence de double horizon.
- Les onze stickers de bâtiments sont remplacés par une famille cohérente de
  miniatures isométriques de machines sur fond alpha, avec masters PNG 512 px
  et dérivés WebP validés sur fond nuit et papier. Les anciens fichiers sont
  conservés comme fallbacks ; badges et tampons restent
  réservés aux succès et validations qui justifient cette métaphore.
- Le Dashboard devient **Data Science Zone** : coût suivant, gain marginal
  DOC/s et CC/s à quantité +1, temps d'accès, retour du coût en DOC,
  contributions observées, jauges et perspective de prestige. Les analyses
  réutilisent les règles métier sans muter la partie.
- Les contrats actifs survivent à la navigation vers la Data Science Zone. Une
  réorganisation les annule explicitement puis régénère les offres selon les
  prérequis du nouveau cycle, afin d'éviter toute récompense héritée du run
  précédent.
- La zone explicite ses limites : DOC n'est ni un revenu ni une marge,
  l'historique est local, borné et potentiellement partiel, les projections
  supposent une cadence constante et aucune donnée multi-joueur n'est inventée.
- Le contrat iPhone reste non négociable : cibles de 44 px, safe areas, focus
  cohérent avec la vue visible, mouvement réduit et budgets Three.js mesurables.
  Les contrôles navigateur, clavier, iPhone et les mesures WebGL restent requis
  avant de considérer la candidate 0.22.0 validée pour fusion.

## 0.21 – « Operations Deck » : l'affiche devient un vrai poste de commande — 2026-08-18

- Reconstruction complète du jeu sous le hero : plaque d'exploitation avec
  données réelles, console de presse manuelle, catalogue dominant, bureau des
  méthodes, expéditions et classeur de succès numérotés de 01 à 05.
- Nouveau sprite SVG industriel inline pour la presse, les machines, les
  réglages, contrats, journal, baromètres et culture ; les 11 stickers de
  bâtiments et 16 badges de succès existants restent les illustrations de
  référence, sans génération raster superflue.
- États de gestion enrichis : prochaine machine et progression de coût réelles,
  cartes achetables/possédées, rendement prioritaire, vrais boutons `disabled`,
  compteurs de métiers et de succès alimentés par la sauvegarde.
- Effets matériels sans boucle : feuille avalée par la presse, copeaux de papier
  à l'installation, visa d'amélioration et bon de contrat ; aucun DOM d'effet
  n'est créé en mouvement réduit ou lorsque l'onglet est masqué.
- Fiabilité iPhone renforcée : `viewport-fit=cover`, safe areas consolidées,
  liens du footer et actions structurantes à 44 px, retour tactile restauré et
  voiles de modale incapables d'intercepter les taps pendant leur fermeture ;
  les surfaces ne s'empilent plus, les ancres incluent l'encoche et le
  Dashboard du footer conserve la langue.
- Journal et contrats mémoïsés au lieu d'être détruits et reconstruits à chaque
  frame ; le DOM continu est plafonné à 10 Hz sans ralentir la simulation et
  les baromètres ne dépendent plus du framerate ni des lectures du dashboard.
  Régions live resserrées sur un annonceur dédié, navigation des onglets
  utilisable au clavier, focus restauré après achat et textes disponibles en
  FR/EN/DE/LB jusque dans le rapport hors ligne statique.

## 0.20 – « Factory Key Art » : le monde devient l'affiche

- Nouveau lockup illustré généré pour Papers Empire : plaque industrielle bleu
  nuit, lettres crème, couronne de papier et ruban orange, avec PNG master et
  WebP de production.
- Hero hybride : horizon peint desktop/mobile derrière un campus Three.js
  transparent, usine centrale agrandie, lumière plus cinématographique et HUD
  vertical toujours relié aux vraies données du jeu.
- Nouveau rail narratif en papier déchiré avec six illustrations originales,
  catalogue de progression et preuves produit honnêtes avant l'interface de jeu.
- Composition resserrée pour faire apparaître la progression dès le premier
  écran desktop, tout en conservant les variantes mobile, contraste élevé,
  mouvement réduit et fallback sans WebGL.
- Textes du nouveau rail disponibles en français, anglais, allemand et
  luxembourgeois ; aucun chiffre social ou classement fictif n'a été ajouté.

## 0.19 – « Empire World » : l'affiche devient jouable

- Nouveau système de marque vectoriel : couronne de ramette, lockup tracé,
  favicon et icônes installables issus du même symbole.
- Hero plein cadre inspiré des affiches d'idle games, mais alimenté par les
  vraies données : CTA d'impression, documents, DOC/s, prestige et culture.
- Campus three.js visible dès une sauvegarde vierge grâce à un printworks
  décoratif non productif, skyline, nuages, routes, lampadaires, palettes,
  piles de papier et véhicules de service.
- Canvas transparent, éclairage PBR léger, brouillard et ACES sans dépendance
  ni post-traitement lourd ; état vierge mesuré à 27 appels et 4 388 triangles.
- Responsive 390 px sans débordement, quatre langues, contraste élevé,
  mouvement réduit et désactivation de la scène revérifiés.

## 0.12 – « Atelier tamponné » : le re-skin parodique
- Nouveau design system complet : le décor crépusculaire et le diorama three.js restent la nuit de l'atelier, tout ce qui se manipule devient papeterie physique (fiches bristol à coin corné, boutons-tampons avec socle 3D et écrasement au clic, étiquettes kraft, réglettes, post-its).
- Visas « APPROUVÉ » tamponnés sur les succès débloqués, traduits en 4 langues (GUTTGEHEESCHT inclus).
- Dashboard façon rapport dactylographié : tuiles KPI en chasse fixe, courbe encre, barres kraft, baromètres.
- Accessibilité vérifiée par calcul : contrastes AA partout (encre/bristol 13,8:1), focus ring brun sur papier, prefers-reduced-motion, mode high-contrast re-testé ; budget motion : 1 seule animation infinie.
- Toute référence VBS / Victor Buck Services / VPlatform retirée du jeu et des docs ; identifiants renommés (`brandImage`, `clientPortal`) avec migration automatique des sauvegardes.
- Nouveaux documents : `design-system.md` (règles + prompt-maître de génération d'images), `images-todo.md` (backlog d'assets), `ROADMAP.md` (mandat produit, multi-pages désormais permis).

## 0.7 – UX polish & Accessibility
- Added a full settings modal (Accessibility, Audio, Interface, Save tabs) with persisted toggles, gear shortcut, and Playwright coverage.
- Implemented guided tutorial overlay (`tutorial.js`) that highlights print → buildings → journal → settings and records completion in preferences.
- Wired `ui-effects.js` to provide click/purchase particles plus Web Audio cues, including a confetti celebration for the priciest building.
- Extended i18n dictionaries with the new labels in FR/EN/DE/LB and added `tests/settings.test.js` + `tests/playwright/tutorial.spec.ts` to keep the UX regression-free.
- Refreshed the accessibility documentation with the new flow (including Mermaid diagram) and documented the module architecture in `DOCUMENTATION.md`.

## 0.6 – Multilingual Mobile Refresh
- Externalised the i18n catalog into individual language bundles and added German + Luxembourgish translations alongside French and English.
- Rebuilt the layout for mobile devices: sticky header, centred grid, ripple feedback on the print button, and Playwright layout tests targeting iPhone 15 Pro Max ensure alignment.
- Added Playwright + Node test scripts via `package.json` and configured CI-ready commands for both unit and layout checks.

Refer to previous versions in `README.md` for earlier milestones. Create a new section below for each future release.
