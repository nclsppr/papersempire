# Codex is thinking

Un carnet de bord libre pour noter idées, questions et réflexions autour de Papers Empire. Utilisation ouverte : pistes produit, techniques, bullet journal, etc.

## Notes du jour
- Mettre en place un mode “performance” pour réduire les coûts CPU lors d’onglets inactifs ? Le `requestAnimationFrame` tourne plein pot, possible d’ajuster le tick.
- Persistences multi-slots ? (genre `profiles/slot1` etc) – demandé ou non ?
- Interface mobile : inspecter les impressions Lighthouse / axe encore, s’assurer qu’on a bien 100 en accessibility après les derniers ajouts.

### Entrée 0.7
- Le panneau Paramètres + tutoriel guidé donnent enfin une porte d’entrée claire. Prochaine étape : découper `app.js` (contrats/events) pour éviter de l’épaissir encore.
- À surveiller : coût des particules/audio sur mobiles bas de gamme. Peut-être ajouter un “performance preset” automatique.
- Idée fun : utiliser le tutoriel pour déclencher des micro-révélations (pointer le journal quand un event est en cours, pointer les contrats quand on débloque une carte). Il faudrait une API d’événements côté `Tutorial` pour écouter ces signaux.

## Idées futures
- Système de contrats clients avec pipeline (ex: `tableur → impression → finishing`). UI en Kanban ?
- Marketplace de modules (cartes) avec rareté ; pipeline de loot box optionnel (cosmétique).
- Mode “coop light” : envoyer un boost à un ami via code, ou partager un achievement. Besoin de backend ou simple share URL encodée ?

## Questions ouvertes
1. Sauvegarde cloud ? (le Worker ne propose pas encore d’API de sauvegarde). Solutions : D1, Supabase ou Firebase, à évaluer selon les priorités.
2. Monétisation / support : inscriptions newsletter, ou c’est purement un jeu vitrine ?
3. Documenter plus le game design : docs existante = MVP, besoin d’un GDD plus structuré ?

## TODO éventuels
- Automatiser screenshot (Playwright) pour social cards dynamiques.
- Créer un mode “debug overlay” dans le jeu (affiche stats brutes, timers, etc.).
- Préparer un backlog Trello/issue tracker externe si le scope grossit.

---
Maintenant que la base Persist/Accessibility est en place, prochaine étape peut-être : enrichir le contenu (mini events + clients). Notes à compléter après discussion.
