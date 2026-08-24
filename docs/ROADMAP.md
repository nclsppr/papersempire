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

## Après 0.22

Ordre indicatif, à challenger avec les retours de jeu :

- observer des runs early/mid/late et ajuster la courbe à partir de données
  locales explicitement consenties/exportées ;
- compléter les miniatures manquantes et traiter les illustrations d'événements ;
- créer des records et fins de partie partageables à partir de faits du run ;
- explorer un arbre de compétences (« formations internes ») seulement s'il
  ajoute de vraies décisions ;
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
