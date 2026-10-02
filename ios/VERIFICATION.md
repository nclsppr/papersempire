# Vérification du candidat natif — 8 septembre 2026

Cette note concerne l’interface SwiftUI et la scène SpriteKit. Les essais du
prototype WebKit antérieur ne valent pas comme validation de cette version.

## Résultats obtenus

- Compilation du simulateur avec Xcode 26.6 et SDK iOS 26.5 réussie ; signature
  locale ad hoc vérifiée avec `codesign --verify --deep --strict`, sans équipe
  Apple. Le script de compilation effectue maintenant cette vérification.
- 112 assertions exécutées dans le véritable JavaScriptCore : règles communes,
  absence de globals navigateur, sauvegardes portables V3, aperçu/annulation,
  remplacement atomique, récupération des dernières actions, échecs d’écriture,
  fichiers endommagés, langue et préférence des incidents persistantes.
- 17 scénarios de parité Web/native : début, milieu et fin de partie, incidents,
  contrats et clauses, Plans, défis, campagnes, prestige et gains d’absence.
  Une absence de 120 secondes crédite silencieusement ; 301 secondes exposent
  le rapport canonique.
- Validation du bundle et du manifeste de confidentialité réussie : règles et
  images locales, aucun moteur navigateur ni HTML/CSS/Three.js embarqué.
- `npm run cloudflare:check` réussi : contrôles produit, sauvegardes, progression,
  25 scénarios produit, localisation (939 clés × 4 langues), SEO (40 pages) et mode hors ligne
  (108 ressources), puis préparation Cloudflare sans publication.
- Parcours observé dans le simulateur iPhone dédié : dix impressions, achat
  du premier opérateur, affichage du bâtiment réellement possédé et production
  de 0,5 DOC/s ; conservation de la partie et du français après relance complète.
  La fiche native, le retour à la carte et le sélecteur Fichiers ont été ouverts.
- Parcours iPad natif observé : sélection du fichier Web synthétique dans Fichiers,
  aperçu de 300 unités, confirmation, calcul des gains d’absence et reprise de
  production à 882,5 k DOC/s. Passage de l’interface complète en français.
- Les douze lots exposent leurs noms localisés et leur quantité à l’accessibilité.
  L’activation de `native.lot.pampyAI` ouvre la bonne fiche native, avec 25 unités
  et le coût canonique de la prochaine unité. Cela ne remplace pas un essai
  VoiceOver sur appareil.
- Export iPad par la feuille de partage système, puis « Save to Files » : retour
  au jeu et fichier enregistré. Les 8 611 octets sont identiques au fichier
  exporté, avec les 300 unités conservées.
- Import de ce même fichier natif sur l’iPhone, par Fichiers puis aperçu et
  confirmation : 300 unités, calcul des gains d’absence et reprise de production.
  La partie avancée et le français sont conservés après arrêt et relance du
  processus de l’app.
- L’alerte « Nouvelle partie » s’affiche depuis les Réglages, y compris au niveau
  de texte `accessibility-large`. Son annulation conserve la progression.
- Un fichier invalide est sélectionné par Fichiers sur iPhone : l’alerte native
  indique que la partie est conservée ; les 300 unités et la production restent
  présentes après fermeture de l’alerte.
- Le fichier exporté par l’iPad est réimporté dans le site depuis son interface
  de sauvegarde et le sélecteur de fichiers : aperçu, remplacement, 12 types,
  300 unités, 41 de culture et 882,5 k DOC/s. Le compteur continue de progresser.
  L’export de 8 611 octets a pour SHA-256
  `a6d1139e0b2a2cf0a7d92dc42c8052805b43b81a5c9a7b1386502aa3a4714308`.
- La reprise d’une sauvegarde avancée ne relance plus le tutoriel web débutant.
  Une régression comportementale vérifie les cas neuf, première unité, unités
  sans production et partie avancée ; ce dernier ajustement web n’a pas fait
  l’objet d’un nouveau parcours visuel.
- Captures natives finales revues sur iPhone et iPad : les douze quantités sont
  lisibles et aucune commande ne masque les ateliers au cadrage initial.
  Les étiquettes utilisent la police système et les marges de la scène suivent
  la hauteur réelle des commandes. Le grand texte `accessibility-large` et les
  Réglages sombres ont été observés ; le contraste de l’accent orange sur le
  fond sombre mesuré dans la capture est de 5,15:1. Le zoom par bouton fonctionne.

## Captures de l’application native

Ces images proviennent de « Save Screen » dans Simulator, sans retouche ni
substitution par le prototype web. La partie avancée est synthétique.

- [iPhone, empire avancé](verification/iphone-final.png)
- [iPad, empire avancé](verification/ipad-final.png)
- [iPhone, grands caractères et mode sombre](verification/iphone-large-final.png)
- [iPhone, Réglages sombres et grands caractères](verification/iphone-dark-settings-final.png)

La revue indépendante de ces quatre captures ne relève aucun problème matériel
restant dans les états représentés. Elle ne couvre pas tous les écrans ni les
performances sur appareil.

## Limites et essais sur appareil

- Gestes de déplacement et de pincement : non validés par l’automatisation.
  Le déplacement synthétique a été reçu comme un appui ; son origine n’est pas
  établie. Les boutons de zoom, de recentrage et les fiches restent disponibles.
- VoiceOver réel, rotation, réduction des animations et récupération par
  l’interface après incident de stockage restent à exercer sur appareil.
- Fluidité, température, mémoire et arrière-plan sur iPhone physique.
- Signature pour appareil, archive et distribution TestFlight/App Store.

Le simulateur n’établit aucune mesure de fluidité sur appareil. Le candidat a
été fusionné dans `main` via la PR #43 le 2 octobre 2026 après une nouvelle
validation du runtime et de la compilation simulateur. La distribution
TestFlight et App Store reste à effectuer.

## Incident d’environnement résolu pour ces parcours

Le Mac n’était pas verrouillé : le message initial de l’outil CUA était erroné.
Le simulateur a ensuite présenté des blocages dans le chargement des
bibliothèques système (`dyld_sim`/`mmap`). Après récupération de ses services et
de longues attentes de chargement, le contrôle de l’iPad a repris ; les preuves
ci-dessus correspondent à des interactions et captures de la nouvelle app.
La cause racine de cet incident d’environnement n’est pas définitivement établie.

## Reproduire les contrôles automatiques

Depuis la racine du dépôt :

```sh
./ios/Tests/run.sh
./scripts/build-ios-simulator.sh
npm run cloudflare:check
```

Les tests utilisent uniquement des parties synthétiques et des répertoires
temporaires. Les essais du simulateur doivent cibler les appareils Papers Empire
dédiés, sans modifier les simulateurs utilisés par les autres projets.
