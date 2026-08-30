# Roadmap produit

Le mandat reste simple : **qu'un maximum de personnes prennent du plaisir à
jouer**, avec une interface qui aide réellement à comprendre et développer son
usine. Les anciennes contraintes de page unique ou de métaphore visuelle figée
ne sont plus des objectifs.

## Vision V4

Papers Empire est un idle game industriel satirique dont le monde, les actions
et les données racontent la même usine : le **production twin**.

1. **Plaisir immédiat** — interactions causales, machine vivante, feedback bref.
2. **Progression lisible** — prochain objectif, coût et impact accessibles.
3. **Décisions éclairées** — la Data Science Zone explique les arbitrages sans
   inventer de finance réelle.
4. **Retrouvailles** — les gains hors ligne récompensent le retour.
5. **Monde cohérent** — landing, jeu, Three.js et illustrations partagent une
   direction « miniature industrielle illustrée ».
6. **Accès universel** — iPhone, clavier, préférences d'accessibilité et quatre
   langues restent des surfaces de premier rang.

## Jalons livrés

- **0.12 — Atelier tamponné** : première identité cohérente et documentée.
- **0.13 — Gains hors ligne** : équipe de nuit à 50 %, plafond 8 h.
- **0.14 — Dashboard autonome** : page locale synchronisée entre onglets.
- **0.15 / 0.17 — Contenu mid-game** : hauts faits, contrats et événements.
- **0.18 — Campus vivant** : palette, véhicules et activité procédurale.
- **0.19 / 0.20 — Empire World / Factory Key Art** : marque, hero hybride et
  rail narratif.
- **0.21 — Operations Deck** : poste de commande et fiabilité tactile iPhone.
- **0.21.1 — Branche canonique `main`** : workflows, protection, hébergement et
  documentation alignés.
- **0.24 — Dossier du moment** : objectif unique, retours d'achat explicites et
  interruptions aléatoires maîtrisées.
- **0.24.1 — Livraison Cloudflare** : Worker, domaines personnalisés et build
  continu depuis `main`.
- **0.24.2 — Découverte Google** : URLs de langue canoniques, redirection HTTPS,
  surfaces techniques `noindex` et contrat SEO exécuté après chaque build.
- **0.25.0 — Guides de l’atelier** : hub éditorial et trois guides en quatre
  langues, illustrations Production Twin, schémas Article et sitemap généré.
- **0.25.1 — Atelier visible partout** : navigation persistante dans le jeu et
  sur mobile, accès depuis la Data Science Zone et 404 passée dans la palette
  Production Twin ; le header des guides reste alors distinct.
- **0.25.2 — Header global partagé** : accueil, Atelier et 404 réunis par
  `site-header.css`, avec le même shell sticky, le même logo, les mêmes
  breakpoints et des actions localisées.
- **0.26.0 — Plans de réorganisation** : neuf rangs de carrière, défis
  facultatifs, grands dossiers, clauses de contrat, paliers d'unités, Studio
  prépresse et sauvegarde V3. La spécification source est l'issue
  [#34](https://github.com/nclsppr/papersempire/issues/34).

## 0.26 — Une vraie progression longue

- [x] Plans Cadence, Qualité et Relation client, trois rangs et trois dossiers
      séquentiels par rang.
- [x] Dossier du moment conservé comme unique surface de guidage : Plan,
      étape, progression, critères facultatifs, récompense et prochaine action.
- [x] Réorganisation anticipée autorisée mais sans tampon ni bonus de Plan ;
      un Plan terminé rapporte le tampon, un bonus Culture égal au rang et son
      avantage permanent.
- [x] Courbes de Culture à rendement décroissant et rangs 3 ancrés au palier 25
      (20 000 DOC/s ou jusqu'à 10 000 000 CC selon l'orientation).
- [x] Défis Budget gelé, Zéro retour client et Toute la direction en copie,
      acceptables ou refusables sans modale automatique.
- [x] Grands dossiers Onboarding de 842 personnes, Saison des rapports annuels
      et Fusion strictement confidentielle, ouverts après 3, 6 et 9 tampons ;
      leurs étapes sont séquentielles, donc la clause du Kit d'onboarding ne
      compte pas comme la clause suivante.
- [x] Conclusion de carrière après neuf tampons et les trois grands dossiers.
- [x] Paliers de rendement ×1,10 à 10 exemplaires et ×1,25 à 25 exemplaires
      pour les douze unités, avec émission idempotente du feedback.
- [x] Clauses facultatives sur les contrats ; récompense de base toujours
      garantie et bonus conditionnel explicite.
- [x] Studio prépresse : douzième unité, miniature V4, parcelle 3D et réduction
      de 6 % par exemplaire sur la durée des contrats, plafonnée à 30 %.
- [x] Progression et récompense unique visibles sur les seize succès.
- [x] Une seule bannette d'incident persistante, ouverte volontairement ou
      classée sans suite ; aucun second tableau de missions.
- [x] Sauvegarde V3 et migrations défensives depuis les anciennes parties.
- [x] Parité FR/EN/DE/LB des clés et placeholders contrôlée automatiquement.

Anti-objectifs maintenus : aucune monnaie supplémentaire, aucun arbre de
talents, aucune gestion individuelle des salariés, aucun streak ou contenu à
durée limitée, et aucune nouvelle avalanche de notifications.

## 0.25 — Guides de l’atelier

- [x] Hub éditorial distinct du jeu et de la documentation technique.
- [x] Trois guides de fond disponibles en FR, EN, DE et LB.
- [x] Auteur Nicolas Pieper, transparence sur Papers Empire et sources
      officielles visibles.
- [x] Illustrations originales 1200 × 630 sans texte ni marque concurrente.
- [x] Canonicals, hreflang, JSON-LD et sitemap dérivés du même catalogue.
- [x] Lecture responsive, tableaux défilables, clavier et mouvement réduit.
- [x] Header global partagé avec l’accueil et la 404 ; rubrique Atelier active
      sur les hubs et les articles.
- [x] Shell éditorial léger, sans runtime de jeu, catalogue i18n navigateur ni
      Three.js.

## 0.24 — Dossier du moment

- [x] Prochaine étape interne et contrat actif réunis dans une seule synthèse.
- [x] Progression, ressources manquantes, délai et récompense rendus explicites.
- [x] Effets avant/après et confirmation locale sur les achats structurants.
- [x] Incidents rares, annulables sans effet et désactivables durablement.
- [x] Bandeaux temporaires et cadence indépendante du framerate ou du mode test.
- [x] Noms de fichiers CSS versionnés par la révision de release.

## 0.23.2 — Canonical Brand Pass V5

- [x] Logo peint de la landing conservé après l'entrée dans le jeu.
- [x] Favicons et icônes installables dérivés du même master peint.
- [x] Emblème Data Science Zone aligné sur la matière et la profondeur du logo.
- [x] Marks SVG plats retirés des surfaces actives et des contrats de test.

## 0.23.1 — Quality Pass V5

- [x] Scène desktop agrandie sans relever le DPR ni le budget de rendu.
- [x] HUD landing/jeu, statut live et phrase d'ambiance sans collision.
- [x] Console d'impression replacée dans le flux de l'Operations Deck.
- [x] Catalogue desktop 3×2, légendes lisibles et miniatures contenues.
- [x] Valeurs longues et glyphes de la Data Science Zone non rognés.
- [x] Carte sociale alignée sur Production Twin ; famille d'icônes corrigée à
      partir du master peint canonique en 0.23.2.

## 0.23 — Precision Pass V5

- [x] Rechargement unique des pages restaurées par le BFCache Safari.
- [x] Révélation du canvas uniquement après une première frame WebGL valide.
- [x] Fallback visible en contraste élevé, perte de contexte et échec WebGL.
- [x] Versionnement commun des CSS, JS, images, polices, imports Three.js,
      ressources runtime et icônes installables.
- [x] Exploration « Crown Analyzer » livrée, puis remplacée en 0.23.2 par un
      emblème peint cohérent avec le logo d'accueil.
- [x] Admission papier masquée par une vraie fente et animation sans reflow.
- [x] Rail de progression restructuré en liste lisible sur iPhone.
- [x] Contrat de résilience exécuté dans la validation Cloudflare.

## 0.22 — Production Twin V4

Contrat livré par la branche V4 ; la validation navigateur et les mesures de
performance restent les portes de sortie de la release :

- [x] design system rendu révocable : invariants produit séparés des choix
  décoratifs ;
- [x] landing transformée en sas qui disparaît après l'entrée dans l'atelier ;
- [x] scène Three.js partagée, conservée en carte compacte dans le jeu ;
- [x] Dashboard renommé **Data Science Zone** et recentré sur l'analyse locale
  de production, d'investissement DOC/CC et de prestige ;
- [x] modèle analytique quantité +1 et limites de projection documentés ;
- [x] les onze stickers remplacés dans le catalogue et l'analyse par des
  miniatures isométriques WebP sur fond alpha, avec masters PNG et fallbacks
  historiques conservés ;
- [~] montée en gamme Three.js par matériaux PBR, géométries/matériaux partagés
  et suppression du double horizon ; budgets à mesurer sur appareils réels ;
- [ ] captures comparatives desktop/iPhone, vérification clavier et revue des
  métriques WebGL avant fusion.

`[~]` signifie que le pipeline et la direction font partie de la V4, mais que la
couverture exhaustive ou la preuve sur appareil n'est pas revendiquée.

## Après 0.26

Ordre indicatif, à challenger avec les retours de jeu :

- observer des cycles Cadence/Qualité/Relation client aux trois rangs et
  ajuster objectifs, bonus et coûts à partir de sauvegardes exportées avec
  consentement explicite ;
- mesurer le temps d'accès au Studio prépresse, aux grands dossiers et à la
  conclusion sans transformer la durée de vie en attente artificielle ;
- créer un récapitulatif de carrière partageable uniquement à partir des neuf
  tampons, trois badges et faits réellement enregistrés ;
- compléter les illustrations d'incidents si elles améliorent leur lecture ;
- étudier un historique multi-appareil uniquement avec un contrat explicite de
  consentement, confidentialité et rétention.

## Budgets et règles de fonctionnement

- Scène mobile cible : au plus 50 draw calls, 80 000 triangles, environ 16 Mo
  de textures, DPR 1 / 30 fps acceptés, sans ombres temps réel ni post-process.
  Ces limites doivent être mesurées, pas déduites du code.
- Rendu Three.js suspendu hors viewport et onglet caché ; rendu à la demande en
  mouvement réduit.
- Cibles tactiles structurantes d'au moins 44 px, safe areas iOS et focus
  visible obligatoires.
- Pull requests vers `main`, fusion après les contrôles requis et validation
  manuelle proportionnée au changement.
- Chaque version significative met à jour `docs/README.md` et
  `docs/RELEASE_NOTES.md`.
- Tout changement visuel confronte sa décision à
  [`design-system.md`](design-system.md), sans considérer ce document comme un
  verrou esthétique permanent.
