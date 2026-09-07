# Mesure facultative des étapes de jeu

Cette mesure aide à observer le parcours de jeu sur le Web. Elle est désactivée
par défaut et se choisit dans les paramètres. Aucun événement ne part avant ce
choix. La Data Science Zone et la sauvegarde restent utilisables sans l’activer.

Le retrait arrête les envois, annule les requêtes encore en cours et efface les
observations locales de ce module. Les observations déjà reçues sont agrégées
sans identifiant permettant de retrouver un joueur : le retrait ne permet donc
pas de supprimer individuellement ces lignes passées.

## Ce qui est mesuré

Sept événements sont acceptés : `start`, `first_automation`, `first_upgrade`,
`first_contract`, `first_plan`, `return_j1` et `return_j7`. Le navigateur conserve
leur émission une seule fois dans sa période d’observation. Aucun compteur de
visite générale, clic publicitaire ou battement périodique n’est envoyé.

La période commence avec la première observation consentie. Une personne qui
active la mesure au milieu de sa carrière n’est pas présentée comme un nouveau
joueur. Les étapes sont celles observées après ce choix ; les anciennes étapes
ne sont pas reconstruites depuis une sauvegarde.

J1 et J7 signifient une activité observée respectivement le lendemain et sept
jours calendaires après le jour initial, selon le calendrier local du navigateur.
Un retour à J2 ne devient pas un retour J1. Les changements d’heure sont traités
par dates calendaires, sans comparer une journée à exactement 24 heures écoulées.
Les marqueurs persistés empêchent une réémission lors d’un rechargement le même
jour. Ils ne suivent pas une personne entre appareils ou profils.

Le temps actif correspond au jeu visible, mesuré avec le temps réel du
navigateur ; il comprend donc l’observation d’une production automatique. Ce
n’est pas un temps d’interaction humaine prouvé. Le temps écoulé comprend les
absences depuis le début de la période consentie. Un tick suspendu longtemps ne
rejoue jamais plusieurs heures de temps actif. `setPlaying(false)` suspend aussi
le compteur lorsque l’introduction est affichée.

## Données et transport

Le corps JSON accepté contient uniquement :

| Champ | Contenu |
| --- | --- |
| `version` | `1` |
| `consent` | `true`, déclaration du client |
| `event` | Une des sept étapes ci-dessus |
| `lang` | `fr`, `en`, `de` ou `lb` |
| `source` | `direct`, `guide`, `internal`, `search`, `external` ou `installed` |
| `cohort` | Date partagée du début d’observation, sans heure ni identifiant |
| `activeSeconds` | Secondes visibles cumulées, entières et bornées |
| `elapsedSeconds` | Secondes écoulées cumulées, entières et bornées |

Le navigateur classe localement la provenance dans une de ces catégories. Il
n’envoie aucun référent, URL complète, chemin libre, paramètre d’URL, sauvegarde,
nom, email, adresse IP ou identifiant de joueur. Aucun identifiant aléatoire
n’est créé pour ce module. Les requêtes omettent les cookies et le Referer.
Cloudflare traite nécessairement les métadonnées réseau pour recevoir les
requêtes ; le code n’en copie aucune dans le jeu de données d’engagement et ne
journalise aucun corps de requête.

`POST /api/engagement` est accepté uniquement sur
`https://papersempire.com`, avec un Origin identique, du JSON et au plus 1 Ko
réellement lu. Les clés supplémentaires, données libres, autres origines,
paramètres d’URL, formats, dates ou compteurs invalides sont rejetés. Aucun CORS
n’est ouvert. Les réponses sont `no-store` et `noindex`.

L’origine est une barrière aux envois par un autre site, pas une authentification
ni une preuve de consentement humain. Les valeurs restent déclaratives : elles
ne servent ni à établir une facturation ni à prouver des joueurs uniques.

Le client n’effectue aucun retry ni rattrapage d’événements après une coupure.
Un événement peut donc manquer si le réseau, le stockage ou le binding est
indisponible. Les modifications du stockage local, la réactivation après retrait
ou des accès simultanés depuis plusieurs onglets peuvent modifier la couverture.
Une lecture des taux doit signaler ces limites.

Les versions natives, hors ligne, locales et de prévisualisation conservent
seulement leur rapport local après consentement. Elles n’envoient rien vers
l’endpoint de production. `getLocalReport()` expose ce résumé sans sauvegarde.

## Intégration

Charger `assets/js/engagement.js` avant `app.js`, puis :

```js
PEEngagement.configure({ locale: () => currentLang });
// Le contrôle démarre sur cette valeur ; une modification est un choix humain.
checkbox.checked = PEEngagement.isEnabled();
checkbox.addEventListener("change", () => {
  checkbox.checked = PEEngagement.setEnabled(checkbox.checked);
});
```

Appeler `record("start")` quand le jeu est réellement ouvert, y compris au retour
sur une sauvegarde, et les événements d’étape lors de leurs actions réelles.
`setPlaying(playing)` accompagne le passage introduction/jeu. Ne pas fabriquer
les étapes passées à partir d’un nombre de bâtiments ou d’archives.

## Cloudflare et activation

Le binding local est `ENGAGEMENT`, avec le dataset `papers_empire_engagement`.
Le jeu de données est créé automatiquement à la première écriture après
publication de cette configuration. Le code renvoie `503` si le binding est
absent ; il ne prétend pas avoir enregistré l’observation.

Au 7 septembre 2026, la documentation annonce une allocation Workers Free de
100 000 points écrits par jour et 10 000 requêtes de lecture par jour, et indique
que l’utilisation d’Analytics Engine n’est pas encore facturée. Aucune offre
payante n’est souscrite par cette modification. Recontrôler ces conditions avant
activation et surveiller le volume reçu. [Tarification Cloudflare](https://developers.cloudflare.com/analytics/analytics-engine/pricing/)

Cloudflare documente une conservation de trois mois pour Analytics Engine.
[Limites et conservation](https://developers.cloudflare.com/analytics/analytics-engine/limits/)
Le déploiement de la configuration, l’existence du dataset et la réception
réelle d’événements sont trois preuves distinctes. Les contrôles locaux ne
constituent aucune mesure réelle de rétention.

## Lecture des résultats

Les positions sont fixes : `blob1` événement, `blob2` langue, `blob3` catégorie
de provenance, `blob4` cohorte, `blob5` version ; `double1` vaut 1, `double2`
contient le temps actif et `double3` le temps écoulé. L’index est la cohorte,
partagée par toutes ses observations, jamais un joueur.

Prendre en compte l’échantillonnage Analytics Engine :

```sql
SELECT blob4 AS cohort, blob1 AS event,
       SUM(_sample_interval * double1) AS observations
FROM papers_empire_engagement
WHERE timestamp >= NOW() - INTERVAL '30' DAY
GROUP BY cohort, event
```

Pour une cohorte assez ancienne, comparer les observations J1 ou J7 aux `start`
de cette même cohorte. Ne pas diviser par toutes les visites du site. Le résultat
est un indicateur des navigateurs ayant consenti, sensible aux pertes de
transport, réactivations et changements de profil ; ce n’est pas la rétention
exhaustive de tous les joueurs. Pour les durées, filtrer une étape précise avant
d’en calculer la moyenne pondérée, car les compteurs sont cumulatifs.

[Écriture et requêtes Cloudflare](https://developers.cloudflare.com/analytics/analytics-engine/get-started/)
— [Échantillonnage](https://developers.cloudflare.com/analytics/analytics-engine/sampling/)

## Vérification

`node scripts/validate-engagement.mjs` vérifie l’absence d’envoi avant consentement
et après retrait, l’annulation des requêtes en cours, la déduplication J1/J7,
l’exclusion du temps masqué, la catégorisation sans transmission du référent,
l’absence d’envoi natif/local, les corps malformés ou trop grands, les origines,
les champs interdits et le défaut de binding. Le contrat Worker existant reste
validé séparément.
