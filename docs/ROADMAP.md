# Roadmap produit

Depuis le 2026-07-18, le jeu évolue avec un mandat produit clair : **qu'un
maximum de personnes prennent du plaisir à y jouer**. Les règles historiques
(une seule page, portée MVP) ne sont plus des contraintes.

## Vision

Un idle game satirique de bureau qu'on a plaisir à laisser tourner et à
retrouver : lisible en un coup d'œil, juteux à chaque clic, drôle dans ses
mots, et gratifiant quand on revient.

## Piliers

1. **Plaisir immédiat** — chaque interaction rend quelque chose (tampon qui
   claque, chiffres qui popent), sans fatiguer (budget motion).
2. **Progression qui respire** — toujours un prochain objectif visible :
   bâtiment, amélioration, contrat, réorg.
3. **Retrouvailles** — revenir doit être une récompense, pas une punition.
4. **Partage** — le jeu se montre : belles cartes sociales, pages par langue,
   moments « screenshotables ».

## Prochaines versions (ordre de priorité)

- **0.12 — Re-skin « Atelier tamponné »** : ✅ livré. Voir `design-system.md`.
- **0.13 — Gains hors-ligne** : ✅ livré. « Rapport d'activité » tamponné à la
  réouverture ; l'équipe de nuit produit à 50 %, plafonné à 8 h.
- **0.14 — Le dashboard déménage sur sa page** : ✅ livré. `/dashboard/` avec
  synchro live inter-onglets ; l'historique long et les records restent à
  ajouter (rejoint 0.16).
- **0.15 — Contenu mid-game, tranche 1** : ✅ livré. 11 nouveaux hauts faits
  (16 au total), 4 langues.
- **0.16 — Matière graphique** : intégration des assets générés
  (`images-todo.md`) — EN ATTENTE d'une clé OpenAI valide (l'actuelle est
  rejetée par l'API).
- **0.17 — Contenu mid-game, tranche 2** : ✅ livré. Contrats t5-t8 jusqu'au
  Recensement national (1M), 3 événements, chiffres arbitrés ; l'équilibrage
  fin de la courbe reste à observer en jeu réel.
- **0.18 — La scène 3D rejoint l'atelier** (demande du 2026-07-18) : refonte
  visuelle du diorama three.js pour qu'il aille avec « Atelier tamponné »,
  plus joli et plus fun :
  - palette raccordée (crème/kraft/encre sépia, fenêtres or ambré) ;
  - **camions de livraison qui circulent sur les routes** entre les bâtiments,
    en nombre croissant avec l'empire (plafonnés, `InstancedMesh`) ;
  - vie ambiante discrète : fumées lowpoly des cheminées, feuilles de papier
    qui s'envolent, klaxon à la complétion d'un contrat, tampon géant qui
    s'abat sur le campus au moment du prestige (réutilise `seal-crest`) ;
  - ciel synchronisé avec les classes `.sky-*` existantes.
  Budget perf mobile NON NÉGOCIABLE : pixelRatio plafonné (≤ 2, 1.5 mobile),
  aucun éclairage dynamique coûteux ni ombre temps réel (blob shadows),
  matériaux partagés, < 50 draw calls, rendu suspendu quand le stage sort du
  viewport (IntersectionObserver) ou que l'onglet est masqué, cible 60 fps
  desktop / 30 fps mobile milieu de gamme.
- **Plus tard** : arbre de compétences (« formations internes »), records et
  fins de partie partageables, mode sombre/clair de l'atelier (jour/nuit déjà
  amorcé par `.sky-*`).

## Règles de fonctionnement

- Direct-to-master, commits/pushes fréquents, pas de tests automatisés (choix
  assumé) : vérification manuelle en navigateur avant chaque push.
- Chaque version significative : entrée dans `README.md` (Versioned Change
  History) + `RELEASE_NOTES.md` si release majeure.
- Tout changement visuel respecte `design-system.md`.
