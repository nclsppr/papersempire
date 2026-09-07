# Papers Empire pour iOS

Application SwiftUI / WebKit embarquée, avec une vue d’empire graphique et le
même moteur de jeu que le site. Le jeu et ses ressources sont copiés dans le
bundle signé à chaque compilation. `peapp://game/` sert exclusivement ces
ressources locales ; aucun serveur ni réseau n’est nécessaire au lancement.

Le minimum est iOS 17. La scène respecte la réduction des animations et dispose
des mêmes unités en contrôles accessibles si WebGL est indisponible. Le canvas
n’écrit jamais l’économie : chaque achat passe par `window.__PE_GAME__.command`.
Les compteurs de parcelle donnent les quantités exactes. La scène 2,5D emploie les
douze illustrations alpha du site et représente leur développement aux paliers
10 et 25 avec des modules annexes et des plateformes. La caméra conserve son
azimut pour rester cohérente avec ces illustrations, tout en permettant
déplacement et zoom. Les usines décoratives de la landing sont absentes.

## Compiler

Ouvrir `ios/PapersEmpire.xcodeproj`, choisir le schéma `PapersEmpire` et un
simulateur iPhone ou iPad. Le build reconstruit les quatre langues depuis les
sources du site. Node.js doit être dans le PATH, `/opt/homebrew/bin` ou
`/usr/local/bin`.

```sh
./scripts/build-ios-simulator.sh
```

Pour un appareil physique ou une archive de distribution, sélectionner son
équipe Apple dans Signing & Capabilities. Le projet ne contient aucune identité
de signature et cette livraison ne publie rien dans App Store Connect.

## Échanger avec le site

Dans les paramètres de l’empire, **Exporter ma partie** ouvre la feuille de
partage iOS avec un fichier `.papersempire`. Le site accepte ce même fichier.
Une copie exportée reste également dans Fichiers → Sur mon iPhone → Papers
Empire → Saves. Seuls ces exports sont exposés à Fichiers ; la partie active
et les préférences restent dans le stockage privé de l’application.
**Importer une partie** ouvre Fichiers. On peut aussi ouvrir un fichier
`.papersempire` depuis Fichiers : l’application lit son accès autorisé, limite
la taille à 2 Mio et ouvre l’aperçu commun `PESaveTransfer.previewImport`.
L’utilisateur vérifie le contenu puis confirme avant tout remplacement.

Les sauvegardes restent locales à l’application, distinctes de Safari. Aucun
compte ni synchronisation automatique n’est prétendu. Supprimer l’application
supprime ses données : exporter la partie avant désinstallation. Les gains
d’absence sont calculés au retour ; iOS n’exécute pas une simulation permanente.

Le menu de l’empire donne accès au sélecteur français/anglais/allemand/
luxembourgeois. Le moteur enregistre la partie avant de changer de page ; iOS
mémorise séparément la langue du document effectivement chargé et la retrouve
au lancement suivant. Cette préférence n’altère pas le format de sauvegarde
portable. Au premier lancement, la langue de l’appareil est utilisée lorsqu’elle
est prise en charge, sinon le français.

Les statistiques volontaires du site sont masquées et désactivées dans cette
version iOS embarquée : elle ne dispose pas du collecteur du site. Aucune
statistique de rétention native n’est présentée comme collectée.

`PapersEmpire/PrivacyInfo.xcprivacy` est copié dans la cible iOS et déclare
l’absence de suivi et de données collectées. Le Swift actuel n’utilise pas
`UserDefaults` : la langue est conservée dans `Application Support/interface.json`.
La liste des API à raison déclarée reste donc vide ; la raison Apple `CA92.1`
ne décrit pas ce candidat. Les tests contrôlent le manifeste, son inclusion et
l’apparition des API couvertes dans le Swift. Toute nouvelle collecte ou API
doit être réévaluée selon la [documentation Apple des API à raison déclarée](https://developer.apple.com/documentation/bundleresources/describing-use-of-required-reason-api)
avant distribution ; ce contrôle de source ne remplace pas la validation d’archive.

Le pont natif `papersNative` accepte uniquement des messages du document local
principal : `exportSave`, `importSave`, `requestImport`, `haptic`, `shareCard`.
Les cartes partagées sont des PNG bornés ; les liens associés sont limités au
domaine HTTPS `papersempire.com`. Les URLs externes activées par l’utilisateur
s’ouvrent dans le navigateur et ne peuvent pas charger du code dans ce pont.
Les liens d’aide des fiches ouvrent les guides localisés du site dans le
navigateur ; leur lecture demande donc une connexion. La Data Science Zone
n’est pas embarquée : exporter puis importer la partie dans le site permet de
l’y analyser. Un lien vers une route non embarquée conserve l’empire ouvert et
affiche cette limite au lieu de charger une ressource absente.

La vue principale reste graphique. **Construire** et **Vue accessible** donnent
accès aux mêmes unités avec noms, quantités et commandes HTML pour VoiceOver ou
le clavier. Les boutons de zoom évitent d’imposer un pincement. Les fiches
retiennent le focus et se ferment avec Échap ; la carte n’est pas une condition
d’accès à une règle de jeu. Les contrôles font au moins 44 points CSS dans la
webview à son échelle standard, les zones sûres et les préférences de grand texte
et de réduction des animations restent prises en charge. Le comportement sur
un appareil physique avec VoiceOver doit être vérifié avant distribution.

## Vérifications de livraison

Compiler le simulateur puis vérifier une partie de test neuve, impression,
achat via parcelle, croissance, déplacement/pincement, fiches de carrière et
contrats, rotation, grand texte/réduction de mouvement, export/import avec
aperçu et annulation, retour après fermeture et lancement sans réseau.
Les tests ne doivent jamais remplacer une sauvegarde personnelle existante.
Un build Debug lancé avec `--ephemeral-test` utilise un stockage temporaire isolé
pour les parcours de QA. Sans cet argument, et dans tous les builds Release,
l’application utilise son stockage persistant habituel.

```sh
./ios/Tests/run.sh
```

Ces tests Foundation exécutent les mêmes fonctions que le pont et le chargeur :
résolution des quatre routes de langue, restriction origine/document principal,
rejet des traversées et liens symboliques hors bundle, routes de guides publics,
persistance de langue et
limites de taille/UTF-8. Ils n’exercent ni les permissions Fichiers réelles, ni
le ShareSheet, ni WebGL/VoiceOver : ces parcours restent des vérifications dans
Simulator et sur appareil. L’application locale n’est pas une publication
TestFlight/App Store et ne prouve pas une acceptation par App Review.
