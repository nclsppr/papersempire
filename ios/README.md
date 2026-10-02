# Papers Empire pour iOS

L’interface est écrite en SwiftUI ; SpriteKit représente l’empire et ses douze
unités avec les illustrations PNG canoniques. Les commandes, les prix et les
revenus proviennent des règles JavaScript du site, exécutées directement dans
JavaScriptCore. Aucun navigateur, DOM, HTML, CSS ou moteur Three.js n’est chargé
par la cible iOS. La scène affiche l’état du moteur et ne modifie pas l’économie.

`NativeGameStore` sérialise les appels sur le main actor, publie des snapshots
Codable et avance le jeu toutes les 200 ms lorsqu’il est actif. Les écritures
ont lieu toutes les cinq secondes et à la mise en arrière-plan. Le retour au
premier plan réinitialise le moteur depuis l’état suspendu : les règles
canoniques calculent les gains d’absence. Il n’existe aucune simulation
permanente en arrière-plan.

## Compiler et tester

Le [relevé de vérification](VERIFICATION.md) distingue les résultats obtenus
des parcours visuels et essais sur appareil restant à terminer.

```sh
./scripts/build-ios-simulator.sh
./ios/Tests/run.sh
```

Le projet est `ios/PapersEmpire.xcodeproj`, schéma `PapersEmpire`. Le script de
compilation utilise `/Applications/Xcode.app` par `DEVELOPER_DIR`, sans modifier
la sélection Xcode du système. Node.js doit être accessible dans le PATH,
`/opt/homebrew/bin` ou `/usr/local/bin`.

Le paquet du simulateur reçoit une signature locale ad hoc, vérifiée après la
compilation. Elle ne demande aucune équipe Apple et ne permet pas la distribution
sur appareil ou dans l’App Store. Compilation et signature ne remplacent pas
un test de lancement.

`build-ios-assets.mjs` copie uniquement la liste explicite des règles et
traductions dans `GameAssets`, puis les images PNG dans `NativeAssets`. Les
fichiers JavaScript restent identiques aux sources du site. `runtime.json`
fixe leur ordre de chargement. Les pages HTML, feuilles CSS et ressources du
moteur graphique Web ne sont pas embarquées.

Les tests exécutent le véritable JavaScriptCore sur macOS, sans lancer
Simulator. Ils exercent les règles canoniques, l’absence de globals navigateur,
les commandes, le tick, le codec V3, l’import avec aperçu/annulation,
la sauvegarde précédente, un échec d’écriture de sauvegarde préalable, les
chargements endommagés et la langue persistante. Tous les fichiers de test
restent dans un répertoire temporaire isolé. Ces tests ne remplacent pas les
parcours tactiles, Fichiers, partage et VoiceOver sur appareil.

## Sauvegardes et échanges

La partie active est `Application Support/PapersEmpire/save.json` et la
sauvegarde précédente `save.previous.json`. Le fichier `interface.json`
conserve séparément la langue choisie et l’activation des incidents.
Aucun `UserDefaults` ni compte distant
n’est utilisé. Un chargement illisible bloque l’autosauvegarde pour préserver
le fichier ; un import confirmé ou une récupération explicite permet de
reprendre. Les changements de langue réinitialisent les mêmes règles avec la
sauvegarde actuelle, sans changer de partie.

L’import Fichiers lit un fichier régulier, avec accès autorisé, borné à 2 Mio et
UTF-8, puis le passe au validateur canonique. L’aperçu contient les unités,
ressources et tampons avant confirmation. La validation prépare un moteur
candidat avant l’écriture. Une ancienne partie valide est copiée et vérifiée
avant le remplacement atomique du fichier principal. Un échec de sauvegarde
préalable empêche tout remplacement. La récupération suit le même aperçu.

Les exports utilisent l’enveloppe `papers-empire-save`, version de format 1,
et la sauvegarde V3 du site. Une copie `.papersempire` est créée dans
Fichiers → Sur mon iPhone → Papers Empire → Saves avant le partage iOS.
Le site accepte ces mêmes fichiers. Les sauvegardes de Safari et de l’app
restent distinctes ; aucun échange automatique n’est annoncé.

L’ancien prototype navigateur n’a pas été distribué. Si une partie de test de
ce prototype doit être conservée, l’exporter depuis le prototype avant de le
remplacer, puis importer ce fichier dans cette version native. Le nouveau
moteur ne fouille ni ne migre les bases de stockage privées de l’ancien moteur.
La désinstallation efface les données locales de l’application.

Un build Debug avec `--ephemeral-test` démarre dans un nouveau répertoire
temporaire isolé. Les builds normaux utilisent le stockage persistant. Pour un
appareil physique ou une archive, sélectionner une équipe Apple dans Signing
& Capabilities. Aucun identifiant de signature n’est enregistré dans le dépôt.

## Confidentialité et limites de livraison

`PrivacyInfo.xcprivacy` est copié à la racine du bundle. Il décrit l’absence de
suivi, de données collectées et d’API à raison déclarée dans le code natif
actuel. La télémétrie web n’est pas embarquée. Les tests vérifient le manifeste,
son inclusion et les API concernées dans le Swift ; une future API ou collecte
nécessite une nouvelle revue selon la [documentation Apple](https://developer.apple.com/documentation/bundleresources/describing-use-of-required-reason-api).

Les contrôles SwiftUI et les fiches des unités permettent de jouer sans utiliser
la scène. La sélection de SpriteKit ne remplace pas ces alternatives. Vérifier
sur appareil la rotation, les zones sûres, le grand texte, VoiceOver et la
réduction des animations. Le build local et les tests ne constituent ni une
publication TestFlight/App Store, ni une acceptation par App Review.
