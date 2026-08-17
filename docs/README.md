# Papers Empire

Papers Empire is a browser-based incremental game that runs entirely on the client side. The experience is intentionally light-hearted: you're modernising an industrial print shop while channeling the vibe of workplace sitcoms.

The UI is now split across dedicated HTML, CSS, and JavaScript assets for easier maintenance. Additional helper modules power the modifier builder math and god-mode utilities so they can be unit-tested in isolation.

For a deeper dive into the architecture, commands, and debugging notes see [`DOCUMENTATION.md`](DOCUMENTATION.md).

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
- **0.18.5** – Livraison Atlas : Pages et la release VPS partagent désormais le même assemblage `site/`. L'archive statique et son inventaire complet de routes sont reproductibles, publiés dans GHCR par digest et attestés depuis le commit source.
- **0.19.0** – « Empire World » : nouveau logo vectoriel couronne de ramette, hero jouable avec HUD réel, navigation et CTA multilingues, campus three.js riche dès quantité zéro (printworks décoratif, skyline, nuages, voirie et activité), nouveau cadrage desktop/mobile, ACES et icônes PWA raccordées à la marque. High contrast, mouvement réduit et fallback progressif restent contractuels.
- **0.19.1** – Documentation opérationnelle Atlas : séparation explicite entre la publication sans secret VPS et la réconciliation centrale, avec une preuve historique datée.

When you make notable changes (new features, mechanics, UI improvements), append a new entry with an incremented version number and a short description of what changed.

## SEO & Deployment

- Canonical domain: `https://papersempire.com/`. `index.html` embeds canonical + hreflang links (`?lang=en|de|lb` variants, FR default), Open Graph/Twitter cards, and a JSON-LD `@graph` (VideoGame + WebSite + Person author).
- `robots.txt` (root) allows crawling and lists both sitemaps: `sitemap.xml` (game + language variants, with xhtml hreflang annotations) and `/docs/sitemap.xml` (generated by Retype).
- The social card is a rendered screenshot of the 3D campus stored at `assets/images/social-card.jpg` (1200x630), referenced with absolute URLs in Open Graph/Twitter meta tags and JSON-LD.
- PNG icons (`favicon-32`, `apple-touch-icon` 180, `icon-192`, `icon-512`) live in `assets/images/`; `site.webmanifest` makes the game installable.
- The GitHub Actions workflow (`.github/workflows/docs.yml`) builds the docs, bundles the game assets, copies `robots.txt`/`sitemap.xml`/`404.html`/`site.webmanifest`, and deploys everything via GitHub Pages (Pages source = GitHub Actions).
- The separate `.github/workflows/vps-release.yml` workflow publishes that same `site/` tree and its route inventory as immutable, attested GHCR artifacts. It has no Atlas secret and never contacts the VPS.
- The central [`nclsppr/vps-infra`](https://github.com/nclsppr/vps-infra) reconciler owns activation. Every ten minutes it resolves the exact `master` HEAD, requires the configured checks to pass, resolves `sha-<commit>` tags to digests, and asks Atlas to verify the attestations and HTTP contract again before a transactional switch. Publication alone cannot activate a version, and the resolver does not fall back to an older green commit.
- Historical evidence observed on 18 August 2026: source `c9b5165187765b5bfc089a196d4e5bdbfefb2a2f`, published by Actions run [`32078995055`](https://github.com/nclsppr/papersempire/actions/runs/32078995055), was accepted by Atlas in central run [`32080417977`](https://github.com/nclsppr/vps-infra/actions/runs/32080417977) with site `sha256:d0c7645202e1db75c9a89008132fa53c62e37f9b17684730be62856b87cb4c7c` and routes `sha256:be525ef7f387c06c266c1a429ae524c8feca8d0235c1c2822bb7ad48a6f149f3`. This documentation commit creates another candidate of its own. Check the central workflow and Atlas protected state for the current tuple instead of treating this snapshot as a permanent active digest.

## Accessibility

- Features (skip link, ARIA regions, log announcements, accessibility panel for high contrast/large text/reduced motion) are documented in `accessibility.md`.
- Preferences persist automatically (localStorage) and are applied before rendering to avoid flashes.

## Architecture & Notes

- Lire [`architecture.md`](architecture.md) pour les flux techniques, la description des modules et les diagrammes Mermaid (autosave, achievements, etc.).
- Consulte [`events.md`](events.md) pour le catalogue d’événements et le mini-jeu de calibrage.
- Pour la vision gameplay, continuer avec [`game-design.md`](game-design.md).
- Le carnet de réflexions ouvert se trouve dans [`codex-is-thinking.md`](codex-is-thinking.md).
- La feuille de route UX/branding/conversion se trouve dans [`web-success-plan.md`](web-success-plan.md).
