# Vérification du candidat natif — 8 septembre 2026

Cette note concerne l’interface SwiftUI et la scène SpriteKit. Les essais du
prototype WebKit antérieur ne valent pas comme validation de cette version.

## Résultats obtenus

- Compilation du simulateur avec Xcode 26.6 et SDK iOS 26.5 réussie.
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
  localisation (939 clés × 4 langues), SEO (40 pages) et mode hors ligne
  (108 ressources), puis préparation Cloudflare sans publication.
- Parcours observé dans le simulateur iPhone dédié : dix impressions, achat
  du premier opérateur, affichage du bâtiment réellement possédé et production
  de 0,5 DOC/s ; conservation de la partie et du français après relance complète.
  La fiche native, le retour à la carte et le sélecteur Fichiers ont été ouverts.

## Essais restant à terminer

Le verrouillage du Mac a interrompu le contrôle visuel pendant le sélecteur
Fichiers. Le fichier synthétique de 300 unités n’a pas encore été confirmé dans
la nouvelle interface native. L’import/export dans les deux sens est validé
par les tests du codec ; son parcours complet à travers les interfaces reste
à confirmer pour cette version.

- Empire avancé sur iPhone et iPad : captures et revue visuelle.
- Mode sombre, grand texte, gestes et VoiceOver dans les vues natives.
- Alertes de confirmation depuis une feuille, annulation et erreurs d’import.
- Partage iOS, réimport du fichier dans le site et récupération via Fichiers.
- Essais sur iPhone physique : fluidité, température, mémoire et arrière-plan.
- Signature, archive et distribution TestFlight/App Store.

Le simulateur n’établit aucune mesure de fluidité sur appareil. Cette branche
reste un candidat en PR brouillon ; elle n’est ni fusionnée ni publiée.

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
