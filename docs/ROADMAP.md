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

- **0.12 — Re-skin « Atelier tamponné »** (en cours) : le design system
  parodique-papeterie sur tout le jeu + dashboard. Voir `design-system.md`.
- **0.13 — Gains hors-ligne** : à la réouverture, un « rapport d'activité »
  tamponné résume ce que l'atelier a produit en ton absence (plafonné, à
  équilibrer). Levier de rétention n°1 des idle games ; très raccord avec le
  thème bureaucratique.
- **0.14 — Le dashboard déménage sur sa page** : `/dashboard/` (multi-pages
  désormais permis), navigation d'en-tête, la page du jeu respire ; le
  dashboard y gagne la place pour plus de graphiques (historique long,
  records, stats de session).
- **0.15 — Matière graphique** : intégration des assets générés
  (`images-todo.md`) — stickers de bâtiments, tampons de hauts faits,
  key art pour la carte sociale.
- **0.16 — Contenu mid-game** : nouveaux contrats, événements illustrés,
  hauts faits supplémentaires (il n'y en a que 5), équilibrage de la courbe
  entre la presse numérique et le prestige.
- **Plus tard** : arbre de compétences (« formations internes »), records et
  fins de partie partageables, mode sombre/clair de l'atelier (jour/nuit déjà
  amorcé par `.sky-*`).

## Règles de fonctionnement

- Direct-to-master, commits/pushes fréquents, pas de tests automatisés (choix
  assumé) : vérification manuelle en navigateur avant chaque push.
- Chaque version significative : entrée dans `README.md` (Versioned Change
  History) + `RELEASE_NOTES.md` si release majeure.
- Tout changement visuel respecte `design-system.md`.
