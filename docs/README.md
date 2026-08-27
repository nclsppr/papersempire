# Papers Empire

Papers Empire is a browser-based incremental game that runs entirely in the browser. You modernise an industrial print shop through eleven production units, contracts and a prestige loop. Current version: **0.25.2**.

The UI is now split across dedicated HTML, CSS, and JavaScript assets for easier maintenance. Additional helper modules power the modifier builder math and god-mode utilities so they can be unit-tested in isolation.

For a deeper dive into the architecture, commands, and debugging notes see the [developer guide in the source repository](https://github.com/nclsppr/papersempire/blob/main/docs/DOCUMENTATION.md).

## Versioned Change History

Track meaningful milestones in the project:

- **0.1** – Initial concept and single-file setup.
- **0.2** – Fix interactive flow so clicking and buy buttons immediately update the game state and UI.
- **0.3** – Stabilise production modifiers, surface their impact in the UI, and add targeted unit tests.
- **0.4** – Introduce the hidden “renard” god mode with time-scaling controls and supporting tests.
- **0.5** – Split the UI into modular assets, cache DOM references for better performance, and add extensive inline documentation plus project-wide docs.
- **0.6** – Externalise i18n, add German/Luxembourgish, refresh the mobile UI (sticky header, ripple, layout fixes), and add Playwright layout tests. See `RELEASE_NOTES.md` for details.
- **0.7** – Persistence + achievements, SEO metadata, dual deployment (game root + docs sous `/docs/`), et grosse passe accessibilité (skip links, ARIA, panneau d’options). Voir `accessibility.md` pour le détail.
- **0.8** – Ajout d'un plan structuré “site à succès” (DA, responsive, conversion, workflow images IA) dans `web-success-plan.md`.
- **0.9** – Le campus 3D lowpoly (three.js vendored, enrichissement progressif) : chaque bâtiment acheté apparaît sur la carte, caméra qui cadre l'empire et dézoome avec sa croissance, clic-achat directement sur les bâtiments, ambiances pilotées par les jauges (brouillard, lumières), secousses d'événements et fanfare de prestige. Voir `architecture.md` § Scène 3D.
- **0.10** – Passe SEO pro (canonical papersempire.com, hreflang `?lang=`, carte sociale JPEG 1200x630, JSON-LD @graph, icônes PNG + manifest, robots/sitemap réparés, 404) ; suppression des tests automatisés et du job CI (workflow direct-to-master).
- **0.11** – Couche de tokens sémantiques façon shadcn (zéro changement visuel, fondation du re-skin) + Tableau de bord temps réel : 6 KPIs avec tendance, courbe de production (crosshair + tooltip), répartition par bâtiment, baromètres en petits multiples, vue table accessible — i18n 4 langues, pont lecture seule `window.__PE_DASH__`.
- **0.12** – Design system « Atelier tamponné » (choisi par jury multi-agents) : fiches bristol opaques sur la nuit de l'atelier, boutons-tampons 3D qui s'écrasent, intercalaires kraft, visas APPROUVÉ traduits, dashboard dactylographié — contrastes AA calculés, budget motion (1 boucle infinie), high-contrast préservé. Suppression de toute mention VBS/Victor Buck/VPlatform (identifiants `brandImage`/`clientPortal` + migration de sauvegarde). Nouveaux docs : `design-system.md` (prompt-maître images), `images-todo.md`, `ROADMAP.md` (mandat produit).
- **0.13** – Gains hors-ligne : « l'équipe de nuit » produit 50 % du rendement pendant l'absence (plafond 8 h, seuil 60 s), que l'onglet soit fermé OU resté masqué (même barème, dt borné dans la boucle de jeu — pas de confiance ni de jauges hors-ligne) ; « Rapport d'activité » tamponné TRAITÉ à partir de 5 min d'absence (crédit silencieux en deçà), durée retenue affichée quand l'absence dépasse le plafond, i18n 4 langues, migration douce des sauvegardes sans `lastSeen`.
- **0.14** – Le dashboard déménage sur sa page `/dashboard/` (noindex) : mode autonome alimenté par le snapshot persisté (`pe-dash-snapshot`) et rafraîchi en direct entre onglets via les événements `storage` ; navigation kraft (lien Dashboard sur le jeu, retour atelier sur la page), autosave périodique 5 s, la page du jeu respire.
- **0.15** – Contenu : 11 nouveaux hauts faits (16 au total) sur tout l'arc de progression (jalons 10k/100k/1M, collection de bâtiments, jauges à 90 %, vétéran des réorgs), écrits dans les 4 langues avec la plume du jeu.
- **0.17** – Contenu mid-game tranche 2 : 4 contrats premium t5-t8 (Kit salon B2B 40k, Pack électoral 120k, Saison des rapports 400k, Recensement national 1M) aux exigences arbitrées par revue d'équilibrage, 3 nouveaux événements à choix (Pénurie de papier, Visite d'influenceur, Audit vert), 4 langues. Correctif au passage : le panneau des contrats ne se remplissait jamais (refs DOM jamais mises en cache), signé/vérifié de bout en bout.
- **0.17.1** – Header retravaillé (tagline sous le wordmark), footer kraft signé « Créé par Nicolas Pieper » (nicolaspieper.com) avec liens Dashboard/Docs/Source sur les deux pages, et dé-densification : plus d'ascenseurs internes (bâtiments, améliorations, contrats, hauts faits), lignes de bâtiments compactées (pastille ×N, production en une ligne, description dans le tooltip), Progression en pleine largeur sur 4 colonnes, cartes qui s'arrêtent à leur contenu.
- **0.17.2** – Harmonisation du chrome : plus aucun emoji dans l'interface (titres, boutons, jauges, footer — l'iconographie passe par les stickers/tampons générés ; engrenage en SVG encré), le kraft redevient un accent (liserés) au lieu d'un fond de contrôle, contrôles secondaires en bristol ombré, footer à double filet encré. Règles gravées dans design-system.md.
- **0.17.3** – Emojis réintroduits sur les surfaces de données uniquement (compteurs du panneau stats : 📄📈⭐🖨️, et tableau de bord : titre 📊 + tuiles KPI) ; le chrome d'action/structure reste sans emoji. Règle d'exception ajoutée à design-system.md.
- **0.18.0** – Premiers camions de livraison sur la scène 3D : deux `InstancedMesh` (caisse crème, cabine kraft) partageant géométrie et matériau, tout le parc en 2 draw calls ; ils circulent sur les deux routes dans les deux sens, leur nombre croît avec l'empire (cap 8), l'animation se coupe en reduce-motion et le rendu reste suspendu hors-écran. Suite de la refonte scène (palette, vie ambiante, optim draw calls) à venir.
- **0.18.1** – Palette de la scène 3D raccordée à « Atelier tamponné » : murs cardstock crème, toits sépia, fenêtres en or ambré émissif (fini les bleus tech froids), métal taupe, éclairage réchauffé (hémisphérique + rim), pelouse mutée, asphalte et arbres sépia, ciel crépuscule. Le diorama lit désormais comme le monde des stickers ; prochaine étape : régénérer les stickers depuis les rendus isométriques pour verrouiller la cohérence.
- **0.18.3** – Vie ambiante de la scène : fumées lowpoly qui montent des cheminées des bâtiments industriels possédés (un `InstancedMesh`, 1 draw call, animées hors reduce-motion et si particules activées), et tampon géant `seal-crest` qui s'abat sur le campus au prestige (plane texturé, descente rebondie puis fondu). Burst d'achat réchauffé (or au lieu de bleu).
- **0.18.4** – Finition scène 3D : feuilles de papier qui s'envolent au-dessus du campus (InstancedMesh), klaxon deux tons à la livraison d'un contrat, ciel de la scène synchronisé avec l'heure (jour/aube/nuit via les classes `.sky-*`), et arbres de bordure instanciés (18 meshes → 2 draw calls). Budget draw-calls révisé honnêtement dans ROADMAP : les bâtiments restent en meshes par pièce (interactifs + animés), la perf mobile tient par l'instanciation des décors + frame-skip + suspend hors-écran.
- **0.18.5** – Première livraison statique reproductible : l'assemblage `site/`, l'archive et l'inventaire de routes dérivent du même commit source.
- **0.19.0** – « Empire World » : nouveau logo vectoriel couronne de ramette, hero jouable avec HUD réel, navigation et CTA multilingues, campus three.js riche dès quantité zéro (printworks décoratif, skyline, nuages, voirie et activité), nouveau cadrage desktop/mobile, ACES et icônes PWA raccordées à la marque. High contrast, mouvement réduit et fallback progressif restent contractuels.
- **0.19.1** – Documentation opérationnelle de l'ancienne chaîne : publication et activation sont distinguées avec une preuve historique datée.
- **0.19.2** – Procédure de livraison historique visible depuis le README racine : branche, pull request, publication et réconciliation documentées.
- **0.19.3** – La cadence de l'ancienne réconciliation est documentée comme best effort ; publication et activation restent séparées.
- **0.20.0** – « Factory Key Art » : lockup illustré raster, horizons peints desktop/mobile, usine Three.js recadrée comme sujet principal et rail narratif en six étapes avant le jeu, sans métriques sociales inventées et avec i18n FR/EN/DE/LB.
- **0.21.0** – « Operations Deck » : reconstruction de l'interface de gestion en pupitre industriel asymétrique, sprite SVG maison, presse à passage de feuille, catalogue de machines enrichi, bons/visas distincts et fiabilisation tactile iPhone (voiles de modale, cibles 44 px, safe areas, rendus DOM mémoïsés), avec i18n FR/EN/DE/LB.
- **0.21.1** – Migration de la branche par défaut de `master` vers `main` :
  workflows, protection, hébergement et documentation suivent désormais le
  même nom canonique.
- **0.22.0** – « Production Twin V4 » : design system rendu révocable et
  recentré sur la miniature industrielle illustrée ; landing transformée en sas
  qui disparaît après l'entrée ; scène Three.js partagée et compacte dans le
  jeu ; remplacement des onze stickers par des machines isométriques sur
  fond alpha ; Dashboard renommé Data Science Zone avec analyses locales et
  explicables des cadences, achats quantité +1, retours en DOC et prestige. Les
  limites de couverture locale et l'absence de métriques financières réelles
  sont affichées comme partie du produit.
- **0.23.0** – « Precision Pass V5 » : retour Safari BFCache traité par une
  recharge unique des assets versionnés ; scène Three.js révélée seulement
  après une première frame valide, avec fallback conservé en contraste élevé,
  perte de contexte ou échec WebGL ; nouvelle marque vectorielle Data Science
  Zone issue d'une exploration ImageGen ; geste d'admission papier reconstruit
  autour d'une fente réellement masquante ; progression de landing réorganisée
  en liste lisible sur iPhone ; assets dynamiques, imports Three.js et manifest
  alignés sur la révision du build ; contrat de résilience vérifiable localement
  et exécuté en CI par `npm run ui:check`.
- **0.23.1** – « Quality Pass V5 » : scène Three.js agrandie sur MacBook et
  grand écran, HUD et textes live rendus entièrement lisibles, suppression du
  recouvrement de la console d'impression, catalogue desktop dédensifié,
  métriques du Dashboard non rognées, carte sociale et icônes installables
  réalignées sur la direction Production Twin.
- **0.23.2** – « Canonical Brand Pass V5 » : le logo peint de la page d'accueil
  devient l'unique source Papers Empire dans la landing, le jeu et les icônes
  installables. Les pictogrammes vectoriels plats sont retirés ; la Data Science
  Zone reçoit un emblème peint construit dans la même matière industrielle.
- **0.23.3** : les logos Papers Empire et Data Science Zone gagnent des
  dérivés avec alpha réel. L'interface les pose sans fond ni cadre ajouté, tout
  en gardant les images opaques pour les icônes installables. Le header Retype
  réutilise le même asset public et la documentation interne sort de la
  navigation publiée.
- **0.24.0** — « Dossier du moment » : un objectif unique montre la prochaine
  étape de l'atelier ou le contrat client actif, sa progression et la récompense
  attendue. Les achats détaillent leur effet réel. Les incidents aléatoires
  deviennent plus rares, peuvent être ignorés ou désactivés durablement, et les
  feuilles CSS publiées portent la révision dans leur nom de fichier.
- **0.24.1** — Cloudflare Workers devient l'unique chaîne de livraison : build
  statique reproductible, domaines personnalisés apex/`www`, redirection
  canonique, en-têtes de sécurité et validation Wrangler avant fusion.
- **0.24.2** — Les quatre pages joueur reçoivent des titles et descriptions
  plus directs, les langues naviguent vers leurs vrais chemins, HTTP converge
  vers HTTPS, les surfaces techniques sortent de l'index et le build gagne un
  contrat SEO dédié.
- **0.25.0** — Les Guides de l’atelier publient un hub et trois articles en
  quatre langues, avec auteur et transparence visibles, sources officielles,
  illustrations originales, schémas Article et sitemap généré depuis le même
  catalogue éditorial.
- **0.25.1** — L’Atelier devient visible dans la navigation du jeu, y compris
  sur mobile, et depuis la Data Science Zone. La 404 adopte la palette et le
  logo Production Twin ; les guides conservent encore leur header éditorial
  distinct.
- **0.25.2** — Correctif de cohérence : l’accueil, les hubs et articles de
  l’Atelier ainsi que la 404 partagent le vrai header global fourni par
  `site-header.css` — même shell sticky, logo peint, breakpoints et actions
  localisées. L’Atelier reste actif sur ses articles sans charger le runtime du
  jeu.

When you make notable changes (new features, mechanics, UI improvements), append a new entry with an incremented version number and a short description of what changed.

## SEO & Deployment

- Canonical domain: `https://papersempire.com/`. `index.html` embeds canonical + hreflang links for `/`, `/en/`, `/de/` and `/lb/`, Open Graph/Twitter cards, and a JSON-LD `@graph` (VideoGame + WebSite + Person author).
- `robots.txt` allows crawling and advertises the generated `sitemap.xml`, which contains the four player pages, four guide hubs and twelve localized articles. `/docs/` remains public but receives `X-Robots-Tag: noindex, follow` from the Worker.
- The social card is a 1200x630 rendered screenshot of the current landing and live 3D campus, stored at `assets/images/social-card.jpg` and referenced with absolute URLs in Open Graph/Twitter meta tags and JSON-LD.
- PNG icons (`favicon-32`, `apple-touch-icon` 180, `icon-192`, `icon-512`) are faithful crops and resizes of the painted homepage master `assets/brand/papers-empire-logo-v2.png`; `site.webmanifest` makes the game installable.
- `npm run cloudflare:build` builds the Retype documentation and assembles the complete `site/` tree from the current Git revision.
- `wrangler.jsonc` deploys that tree as Cloudflare Worker static assets, serves the apex as the canonical hostname and redirects `www` while preserving paths and query strings.
- The GitHub workflow validates UI contracts, Worker behavior, the complete static build and a Wrangler dry run. It never publishes the site.
- Cloudflare Workers Builds is the sole production publisher. It follows `main`, runs the canonical build command and promotes the resulting Worker deployment.

## Accessibility

- Features (skip link, ARIA regions, log announcements, accessibility panel for high contrast/large text/reduced motion) are documented in `accessibility.md`.
- Preferences persist automatically (localStorage) and are applied before rendering to avoid flashes.

## Architecture & Notes

- Lire [`architecture.md`](architecture.md) pour les flux techniques, la description des modules et les diagrammes Mermaid (autosave, achievements, etc.).
- Consulte [`events.md`](events.md) pour le catalogue d’événements et le mini-jeu de calibrage.
- Pour la vision gameplay, continuer avec [`game-design.md`](game-design.md).
- Le plan web introduit avec la version 0.8 est archivé dans le [dépôt source](https://github.com/nclsppr/papersempire/blob/main/docs/web-success-plan.md).
