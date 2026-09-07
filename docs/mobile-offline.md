# Jeu mobile, transferts et mode hors ligne

Cette page décrit les contrats du code présent dans le dépôt. La disponibilité
sur le domaine public dépend de la livraison Cloudflare ; le projet iOS doit
être compilé et signé séparément et ne constitue pas une publication App Store.

## Parcours de jeu

Sur petit écran, `mobile-experience.js` organise le jeu en production, unités,
dossiers et carrière. Les compteurs, le prochain achat et l’état de sauvegarde
restent lisibles sans traverser tous les panneaux. Les objectifs des Plans sont
consultables avant leur sélection. Les recommandations d’investissement peuvent
suivre l’objectif courant, la production DOC, les CC, la qualité ou l’empreinte.
Elles comparent les gains marginaux d’un achat supplémentaire ; elles ne
prédisent pas toute la partie et ne changent pas les règles économiques.

La vue d’empire de l’application iOS utilise les mêmes commandes de jeu que les
contrôles HTML. Les bâtiments possédés et leurs quantités viennent du moteur.
Les variantes aux paliers 10 et 25 donnent une indication visuelle de croissance ;
le compteur affiche la quantité exacte. Le fond de rivière est décoratif et
ne représente aucune unité possédée. Les contrôles accessibles restent disponibles
quand le rendu graphique ne fonctionne pas. Voir le
[projet iOS](https://github.com/nclsppr/papersempire/tree/main/ios).

Une carte de carrière peut être créée à la demande, puis partagée ou téléchargée.
Elle résume la partie courante ; elle ne constitue ni un classement public ni
une preuve de score vérifiée par un serveur.

## Sauvegarder et transférer

`persistence.js` conserve la sauvegarde V3 dans `papersEmpireSave`. Une écriture
est relue pour vérifier son succès et publie l’état `pe:save-health` pour
l’interface. `save-transfer.js` porte le même parcours sur le Web et dans iOS :

1. Exporter crée un fichier `.papersempire` à télécharger ou partager. Son
   enveloppe JSON contient le format, sa version, la date d’export et l’état du
   jeu. L’export peut capturer l’état en mémoire même si le stockage est défaillant.
2. Importer sélectionne ce fichier ou un ancien JSON compatible. La validation
   accepte les sauvegardes sans version et V1, V2, V3, avec une limite de 2 Mio.
3. Un aperçu des ressources, unités et progrès précède la confirmation explicite
   du remplacement. Fermer l’aperçu laisse la partie courante intacte.
4. Avant remplacement, une sauvegarde courante valide est conservée dans
   `papersEmpireSave.previous`. La récupération locale utilise aussi un aperçu
   et une confirmation. Ce n’est qu’une copie précédente, pas un historique.

Après un import, une récupération ou une remise à zéro dans un autre onglet,
les anciennes pages refusent de réenregistrer leur état périmé. Un bandeau
permet d’exporter la partie encore affichée avant de recharger volontairement
la sauvegarde actuelle. Ce garde utilise une génération locale ; il ne constitue
pas une transaction atomique entre processus, que localStorage ne fournit pas.

Le fichier contient la carrière et l’état durable du jeu. Les préférences
d’accessibilité, l’historique complet de la Data Science Zone et les observations
facultatives d’engagement restent distincts. Il n’existe ni compte ni
synchronisation automatique entre appareils. Effacer les données du navigateur
ou désinstaller l’application peut supprimer la partie et sa copie précédente :
un fichier exporté conservé ailleurs reste nécessaire.

## Préparer le Web hors ligne

Dans les paramètres, **Préparer le jeu hors ligne** télécharge les ressources
du jeu. Attendre l’état prêt avant de couper le réseau. Le premier téléchargement
est un choix explicite ; une visite ordinaire n’inscrit pas automatiquement le
service worker. Il nécessite un navigateur compatible et une origine sécurisée.

Le cache contient les quatre entrées de langue, la Data Science Zone, les
scripts, styles, images et polices nécessaires au jeu. Les guides, la
documentation et les liens externes restent en ligne. Le cache contient les
ressources publiques de l’application, jamais la sauvegarde locale ; il ne
répond pas à `/api/` et n’accumule pas les réponses des pages visitées.

L’installation est une action distincte. Le bouton attend qu’une sauvegarde
locale soit lisible et exportable. Les navigateurs compatibles proposent leur
dialogue d’installation ; Safari nécessite l’action **Sur l’écran d’accueil**.
Safari et l’application de l’écran d’accueil peuvent utiliser des stockages
séparés : exporter d’abord, ouvrir l’application installée en ligne, importer
le fichier avec aperçu, vérifier la partie puis y préparer le mode hors ligne.
L’installation seule ne transfère pas la sauvegarde.

Les ressources peuvent être évincées par le navigateur. Revenir en ligne et
relancer la préparation répare un cache incomplet. Le module Web ne s’inscrit
pas dans l’application native `peapp://`, dont les ressources sont embarquées
dans le bundle.

### Mises à jour et retour de version

`build-offline.mjs` s’exécute après la génération des langues, des guides et des
URLs versionnées. L’empreinte du cache dépend des octets réellement servis et
du code du service worker, pas seulement du numéro de commit. Chaque fichier
téléchargé est vérifié par SHA-256. Une ressource absente ou différente fait
échouer l’installation entière et laisse la version active utilisable.

Une nouvelle version attend. **Enregistrer et recharger** vérifie la sauvegarde
avant d’autoriser son activation ; aucun rechargement automatique n’interrompt
les autres onglets. Le cache actif et son prédécesseur sont conservés pour les
ressources encore demandées par un ancien onglet. Une version en attente peut
occuper un troisième cache ; les autres versions en attente sont supprimées.
Le budget d’une version est limité à 16 Mio au build.

Une remise en production d’une version antérieure suit le même parcours de
vérification et d’acceptation. Cela rétablit les fichiers de l’application,
pas une ancienne sauvegarde. Il n’y a pas de bouton de retour de version pour
le joueur et un cache évincé ne garantit aucun retour hors ligne.

### Production pendant une absence

Le cache ne modifie pas les gains d’absence : après au moins 60 secondes, les
DOC sont calculés au retour à 50 % de la cadence retenue, dans la limite de
huit heures. Il n’y a pas de CC ni d’évolution des jauges pendant l’absence.
Un rapport est présenté au-delà de cinq minutes. Il s’agit d’un calcul au
retour, pas d’une simulation permanente en arrière-plan.

## Guides publics et données locales

Le catalogue comprend huit guides en français, anglais, allemand et
luxembourgeois : quatre hubs et 32 articles statiques. Les nouveaux parcours
expliquent la première automatisation, DOC/CC/Plans, la première réorganisation
et la comparaison d’investissements. Les boutons du guide ouvrent le panneau
correspondant du jeu, conservent la partie et identifient le contexte de lecture
dans l’URL. Les liens d’aide du jeu sont générés depuis ce même catalogue.

L’exemple d’investissement est explicitement synthétique. Son tableau est
calculé au build avec `economy-analytics.js`, lisible sans JavaScript et ne lit
aucune sauvegarde. La Data Science Zone demeure locale et `noindex`. La
[mesure facultative des étapes](engagement.md), désactivée par défaut, possède
son propre consentement et ne transmet pas de sauvegarde.

## Assemblage et vérification

`build-site.sh` crée une sortie neuve à partir des entrées Web, de `assets/`,
de `dashboard/` et de la documentation générée. Il exclut tous les répertoires
`assets/**/sources`. Il ne copie ni le projet `ios/`, ni les données d’un
navigateur, ni un export de partie. Wrangler ne publie que cette sortie `site/`.
Les tests utilisent des parties synthétiques dans des profils isolés.

Les vérifications ciblées sont `gameplay:check`, `i18n:check`, `ui:check`,
`seo:check` et `offline:check`. Le test hors ligne contrôle les dépendances,
les empreintes, les exclusions, les mises à jour, l’échec atomique d’un
téléchargement et le retour à une version précédente. Les validations réelles
sur navigateur et appareil restent nécessaires pour l’installation, la
pression de stockage, les gestes tactiles et les transferts de fichiers.
