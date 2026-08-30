# Papers Empire
Game Design Document (GDD), version développeur 0.26.0

---

## 1. Vision générale

### 1.1 Pitch

Idle / incremental game centré sur la transformation d'une imprimerie industrielle en acteur omnicanal de la gestion documentaire.

Tu passes de:
- une petite imprimante de bureau et un opérateur repro  
à  
- une usine d'impression industrielle 4.0 pilotée par IA, portail client sécurisé et ComBridge.

### 1.2 Plateforme cible

- Web, avec desktop et iPhone comme surfaces de jeu de premier rang.
- Tech libre, par exemple:
  - Front: HTML5 + JS / TS (React, Vue ou vanilla)
  - Backend: optionnel (peut être full client-side)

### 1.3 Contrat d'expérience V4

L'expérience est composée de trois surfaces complémentaires, pas de trois
produits séparés :

1. la **landing** est un sas de découverte ; sur une partie vierge, elle ne
   démarre pas silencieusement la simulation ;
2. le **jeu** apparaît après l'entrée et conserve le production twin Three.js
   sous une forme compacte et interactive ;
3. la **Data Science Zone** explique la production observée et aide à arbitrer
   les achats sans inventer de données financières.

Après le premier démarrage, une sauvegarde revient directement au jeu. Le
joueur peut revoir l'introduction sans réinitialiser sa progression. L'affiche,
sa navigation marketing et son rail narratif ne restent donc pas au-dessus de
l'interface de production.

---

## 2. Modèle de données

### 2.1 Ressources

```ts
type Resources = {
  docBank: number;        // Documents actuellement disponibles pour achat (monnaie)
  docTotal: number;       // Documents cumulés produits depuis le début
  ccTotal: number;        // Confiance client cumulée
  culturePoints: number;  // Points de prestige persistants entre run
};
```

### 2.2 Jauges globales

Valeurs normalisées entre 0 et 1 (0 % à 100 %).

```ts
type GlobalStats = {
  quality: number;        // 0 à 1 – impacte CC par DOC
  footprint: number;      // 0 à 1 – 1 = empreinte énorme, 0 = très vert
  brandImage: number;       // 0 à 1 – réputation, impacte events et multiplicateurs
};
```

Convention:

* Plus `quality` est haut, mieux c'est.
* Plus `footprint` est bas, mieux c'est.
* Plus `brandImage` est haut, mieux c'est.

### 2.3 Bâtiments (paliers)

```ts
type BuildingId =
  | "reproOperator"
  | "reproWorkshop"
  | "digitalPress"
  | "offsetPress"
  | "finishingWorkshop"
  | "insertingLine"
  | "logistics"
  | "clientPortal"
  | "comBridge"
  | "prepressStudio"
  | "factory40"
  | "pampyAI";
```

```ts
type Building = {
  id: BuildingId;
  name: string;
  description: string;
  baseProduction: number;     // DOC / seconde, par unité, avant multiplicateurs
  quantity: number;           // nb d'unités possédées
  baseCost: number;           // coût initial en DOC
  costMultiplier: number;     // facteur multiplicatif par achat (ex: 1.15)
  role: "producer" | "multiplier" | "ccMultiplier";
  docMultiplierPerUnit?: number;
  ccMultiplierPerUnit?: number;
  qualityBonusPerUnit?: number;
  footprintBonusPerUnit?: number;
  imageBonusPerUnit?: number;
  contractDurationReductionPerUnit?: number;
  unlocked: boolean;
  unlockCondition: UnlockCondition;
  upgrades: UpgradeId[];      // upgrades déjà achetées
};
```

### 2.4 Améliorations

```ts
type UpgradeId = string;

type Upgrade = {
  id: UpgradeId;
  name: string;
  description: string;
  target: "global" | "building" | "stat";
  targetId?: BuildingId | keyof GlobalStats;
  effect: UpgradeEffect;
  cost: number;              // en DOC
  unlockCondition: UnlockCondition;
};
```

### 2.5 Conditions de déblocage

```ts
type UnlockCondition =
  | { type: "docTotal"; value: number }
  | { type: "buildingQuantity"; building: BuildingId; quantity: number }
  | { type: "ccTotal"; value: number }
  | { type: "culturePoints"; value: number }
  | { type: "achievement"; achievementId: string };
```

### 2.6 Effets des améliorations

```ts
type UpgradeEffect =
  | { type: "multProduction"; multiplier: number; building?: BuildingId }
  | { type: "addProduction"; value: number; building?: BuildingId }
  | { type: "multGlobalProduction"; multiplier: number }
  | { type: "addQuality"; value: number }
  | { type: "multQuality"; multiplier: number }
  | { type: "addFootprint"; value: number }          // valeur négative pour amélioration
  | { type: "multFootprint"; multiplier: number }
  | { type: "addBrandImage"; value: number }
  | { type: "multBrandImage"; multiplier: number }
  | { type: "special"; key: string; value?: any };   // pour règles custom
```

### 2.7 Succès

```ts
type Achievement = {
  id: string;
  nameKey: string;
  descKey: string;
  target: number;
  progress: (state: GameState) => number;
  reward: { doc?: number; cc?: number; culture?: number };
};
```

La sauvegarde distingue les succès `unlocked` des récompenses `rewarded`. Une
récompense est créditée une seule fois, y compris après import ou migration
d'une ancienne sauvegarde.

---

## 3. Boucle de jeu et production

### 3.1 Clic manuel

* Action: clic sur la petite imprimante de bureau.
* Variable: `clickPower`.

Formule base:

```ts
docGainedOnClick = clickPower * globalProductionMultiplier;
docBank += docGainedOnClick;
docTotal += docGainedOnClick;
```

Valeur initiale:

```ts
clickPower = 1;
```

Upgrades possibles:

* Augmenter `clickPower`.
* Ajouter un multiplicateur lié à `quality`.

### 3.2 Production automatique

Chaque building produit:

```ts
effectiveProduction(building) =
  building.baseProduction
  * effectiveQuantity(building.quantity)
  * buildingProductionMultiplier(building.id)
  * globalProductionMultiplier;
```

`effectiveQuantity` applique le palier le plus haut atteint : `×1,10` dès 10
unités, puis `×1,25` dès 25 unités. Les deux paliers ne se cumulent pas. Les
modificateurs du Plan actif et les bonus permanents de carrière sont composés
une seule fois par `modifier-utils.js` avant d'entrer dans ces formules.

Production totale par tick:

```ts
DOCps = sum(effectiveProduction(b) for all buildings);

docIncrementPerTick = DOCps * deltaTimeSeconds;
docBank += docIncrementPerTick;
docTotal += docIncrementPerTick;
```

### 3.3 Confiance client (CC)

Confiance gagnée en continu, basée sur la production, la qualité et la logistique.

Formule simple:

```ts
ccGainPerSec =
  DOCps
  * (0.1 + quality * 0.9)        // qualité influence fortement
  * (0.5 + brandImage * 0.5);      // image impacte aussi

ccTotal += ccGainPerSec * deltaTimeSeconds;
```

Éventuellement:

* Bonus ponctuels via events, audits, campagnes ComBridge.

### 3.4 Jauges dynamiques

Exemple de mise à jour simple par tick:

Qualité:

```ts
quality += (qualityTarget - quality) * qualityRecoveryRate * deltaTimeSeconds;
quality = clamp(quality, 0, 1);
```

Empreinte:

```ts
footprint += footprintDrift * deltaTimeSeconds;     // dérive naturelle
footprint += footprintFromNewProduction;            // fonction de DOCps et upgrades
footprint = clamp(footprint, 0, 1);
```

Image de marque:

```ts
brandImage += (imageTarget - brandImage) * imageRecoveryRate * deltaTimeSeconds;
brandImage = clamp(brandImage, 0, 1);
```

Les upgrades changent `qualityTarget`, `footprintDrift`, `imageTarget`, etc.

---

## 4. Unités détaillées

### 4.1 Résumé des paliers

| Id                | Nom                         | Base DOC/s (par unité) | Base cost DOC | Cost mult | Type principal        |
| ----------------- | --------------------------- | ---------------------- | ------------- | --------- | --------------------- |
| reproOperator     | Opérateur repro             | 0.5                    | 15            | 1.15      | Prod auto faible      |
| reproWorkshop     | Atelier reprographie        | 3                      | 100           | 1.15      | Prod auto moyenne     |
| digitalPress      | Presse numérique            | 20                     | 1_000         | 1.15      | Prod auto forte       |
| offsetPress       | Presse offset               | 120                    | 10_000        | 1.15      | Prod volume massif    |
| finishingWorkshop | Atelier de finition         | 0 (modificateur)       | 1_500         | 1.15      | Capacité finition     |
| insertingLine     | Ligne de mise sous pli      | 0 (modificateur CC)    | 3_000         | 1.15      | Transformation envoi  |
| logistics         | Logistique et tri postal    | 0 (global mult)        | 5_000         | 1.15      | Mult global envois    |
| clientPortal      | Portail client sécurisé     | 5                      | 8_000         | 1.15      | Prod propre + qualité |
| comBridge         | ComBridge omnicanal         | 0 (CC focus)           | 20_000        | 1.20      | Multiplicateur CC     |
| prepressStudio    | Studio prépresse             | 0 (modificateur)       | 30_000        | 1.20      | Qualité et contrats   |
| factory40         | Usine 4.0                   | 0 (global mult)        | 50_000        | 1.20      | Mult global           |
| pampyAI           | IA Pampy Print              | 0 (global + footprint) | 100_000       | 1.25      | Optimisation globale  |

Remarque:

* Certains bâtiments ne produisent pas directement des DOC, mais modifient des multiplicateurs ou des jauges.

### 4.2 Exemple complet : opérateur repro

```ts
const reproOperator: Building = {
  id: "reproOperator",
  name: "Opérateur repro",
  description: "Surveille les copieurs, recharge le papier, relance les impressions.",
  baseProduction: 0.5,
  quantity: 0,
  baseCost: 15,
  costMultiplier: 1.15,
  unlocked: true,
  unlockCondition: { type: "docTotal", value: 0 },
  upgrades: []
};
```

Upgrades associées (exemples):

```ts
const upgrades: Upgrade[] = [
  {
    id: "repro_training_basic",
    name: "Formation de base",
    description: "L'opérateur repro devient plus efficace.",
    target: "building",
    targetId: "reproOperator",
    effect: { type: "multProduction", multiplier: 2 },
    cost: 100,
    unlockCondition: { type: "buildingQuantity", building: "reproOperator", quantity: 10 }
  },
  {
    id: "repro_maintenance_routine",
    name: "Routine de maintenance",
    description: "Réduit les risques de pannes mineures sur les petites machines.",
    target: "global",
    effect: { type: "special", key: "minorBreakdownChanceMult", value: 0.8 },
    cost: 250,
    unlockCondition: { type: "buildingQuantity", building: "reproOperator", quantity: 25 }
  },
  {
    id: "repro_visual_quality_check",
    name: "Contrôle visuel qualité",
    description: "L'opérateur détecte plus vite les défauts.",
    target: "stat",
    targetId: "quality",
    effect: { type: "addQuality", value: 0.02 },
    cost: 400,
    unlockCondition: { type: "docTotal", value: 2_000 }
  }
];
```

Tu peux appliquer la même logique à chaque building.

---

## 5. Formules de coût et progression

### 5.1 Coût d'achat d'un bâtiment

```ts
function buildingCost(b: Building): number {
  return Math.floor(b.baseCost * Math.pow(b.costMultiplier, b.quantity));
}
```

### 5.2 Coût d'une amélioration

* Fixe dans cette V1 (`Upgrade.cost`).
* Peut être modulé par des paramètres global (ex: réduction de coûts via prestige).

---

## 6. Événements

### 6.1 Modèle de données

```ts
type GameEvent = {
  id: string;
  type: "choice" | "minigame";
  titleKey: string;
  descriptionKey: string;
  choices?: EventChoice[];
  resultWinKey?: string;
  resultLoseKey?: string;
};

type EventChoice = {
  id: string;
  labelKey: string;
  resultKey: string;
  tone: "positive" | "neutral" | "mixed" | "negative";
  effect: (state: GameState) => void;
};
```

Une seule définition peut attendre dans la bannette. Son arrivée n'ouvre aucune
modale : le joueur choisit quand consulter l'incident. Il peut alors répondre,
ou le classer sans effet. Tant qu'un incident attend, aucun autre n'est généré ;
son identifiant est sauvegardé. Désactiver les interruptions efface la bannette
et empêche de nouveaux tirages. Les définitions, résultats exacts et règles de
cadence sont détaillés dans [`events.md`](events.md).

### 6.2 Exemples

#### Panne machine

* Id: `machineBreakdown`
* « Réparer maintenant » retire 20 % des DOC disponibles, avec un plafond de
  50 DOC, puis ajoute jusqu'à 5 points de qualité.
* « Espérer que ça tienne » retire jusqu'à 8 points de qualité.

#### Pénurie de papier

* « Acheter du papier premium » retire 15 % des DOC disponibles, ajoute jusqu'à
  6 points de qualité et 5 points d'empreinte.
* « Passer au recyclé » retire jusqu'à 8 points d'empreinte et jusqu'à 4 points
  de qualité.

#### Défi calibrage

* Le jeu affiche un code de 1 à 3 et attend le bouton correspondant.
* Une réussite ajoute 80 DOC et jusqu'à 4 points de qualité ; un échec retire
  jusqu'à 5 points de qualité.

---

## 7. Succès détaillés

Chaque succès expose sa progression avant déblocage et crédite sa récompense
une seule fois :

| ID | Condition | Récompense |
| --- | --- | --- |
| `firstDoc` | 1 DOC produit | 5 DOC |
| `hundredDocs` | 100 DOC produits | 25 DOC |
| `thousandDocs` | 1 000 DOC produits | 100 DOC |
| `firstBuilding` | 1 unité achetée | 20 DOC |
| `firstPrestige` | 1 réorganisation réellement effectuée | 1 Culture |
| `tenKDocs` | 10 000 DOC produits | 300 DOC |
| `hundredKDocs` | 100 000 DOC produits | 1 000 DOC |
| `millionDocs` | 1 000 000 DOC produits | 1 Culture |
| `firstUpgrade` | 1 amélioration achetée | 50 DOC |
| `fiveBuildingTypes` | 5 types de bâtiments possédés | 200 CC |
| `fullCampus` | une unité des douze bâtiments | 2 Culture |
| `tenOfOne` | 10 unités d'un bâtiment | 250 DOC |
| `industrialScale` | 25 unités d'un bâtiment | 1 000 DOC |
| `qualityFreak` | qualité à 90 % | 300 CC |
| `brandStar` | image à 90 % | 300 CC |
| `cultureCollector` | 10 Culture possédées | 1 Culture |

---

## 8. Prestige et réorganisation

### 8.1 Principe

La Réorganisation stratégique devient le point de validation d'une carrière,
mais reste toujours disponible dès 10 000 CC. Elle remet à zéro les DOC, CC,
bâtiments, améliorations, jauges et contrat actif du run. Elle conserve Culture,
rangs et tampons de Plans, défis terminés, badges de campagnes, succès et
récompenses déjà créditées.

### 8.2 Calcul des points de culture obtenus

```ts
cultureGained = floor(3 * log10(1 + ccTotal / 1_000));
```

La Culture a un rendement décroissant :

```ts
prestigeMultiplier = 1 + 0.20 * sqrt(culturePoints);
qualityCultureBonus = min(0.20, 0.025 * sqrt(culturePoints));
imageCultureBonus = min(0.25, 0.03 * sqrt(culturePoints));
```

Les bonus de jauges sont exprimés en valeurs normalisées : ils sont donc
plafonnés respectivement à 20 et 25 points, avant le plafonnement final des
jauges à 100 %.

Si les trois étapes du Plan actif sont terminées, la Réorganisation valide son
rang, ajoute son tampon et verse aussi `rang` points de Culture : 1, 2 ou 3.
L'aperçu de confirmation affiche le gain garanti avant le reset : gain de base
plus bonus du Plan validé. Il précise que les récompenses de succès éventuelles
n'y sont pas encore incluses. Ces récompenses sont résolues en cascade dans la
même transaction puis détaillées dans le reçu final, dont le total est exact.
Si le Plan n'est pas prêt, la Réorganisation reste autorisée mais le Plan repart
à sa première étape, sans tampon ni bonus de rang. Un défi actif échoue ; une
campagne active repart à sa première étape.

### 8.3 Plans de carrière

Un seul Plan peut être actif. Chaque Plan possède trois rangs successifs et
trois objectifs séquentiels par rang. Les objectifs d'action ne comptent qu'à
partir du moment où ils deviennent l'étape active.

| Plan | Rang | Avantage du run | Contrepartie du run | Objectifs successifs |
| --- | ---: | --- | --- | --- |
| Cadence | 1 | DOC ×1,10 | dérive empreinte ×1,20 | 10 opérateurs → 25 DOC/s → 15 000 CC |
| Cadence | 2 | DOC ×1,15 | dérive empreinte ×1,35 | 10 presses numériques → 500 DOC/s → 75 000 CC |
| Cadence | 3 | DOC ×1,20 | dérive empreinte ×1,50 | 25 presses offset → 20 000 DOC/s → 1 000 000 CC |
| Qualité | 1 | cible qualité +4 points | DOC ×0,95 | 1 studio prépresse → 75 % qualité → 1 clause réussie |
| Qualité | 2 | cible qualité +6 points | DOC ×0,925 | 5 studios → 85 % qualité → 2 clauses réussies |
| Qualité | 3 | cible qualité +8 points | DOC ×0,90 | 25 studios → 92 % qualité → 3 clauses réussies |
| Relations clients | 1 | CC ×1,10, contrats ×1,10 | coûts ×1,05 | 65 % image → 2 contrats → 25 000 CC |
| Relations clients | 2 | CC ×1,15, contrats ×1,20 | coûts ×1,075 | 10 portails → 2 clauses → 100 000 CC |
| Relations clients | 3 | CC ×1,20, contrats ×1,30 | coûts ×1,10 | 25 ComBridge → 4 contrats → 10 000 000 CC |

Chaque rang validé laisse ensuite un bonus permanent : Cadence `+2 % DOC`,
Qualité `+1 point` sur la cible de qualité, Relations clients `+2 % CC`. Les
bonus permanents s'additionnent par rang ; le modificateur du Plan en cours se
compose avec eux.

### 8.4 Défis facultatifs

Le Dossier peut proposer le défi lié au Plan actif. Accepter ou refuser est
explicite ; un défi refusé ou raté ne revient pas dans le même cycle.

| Défi | Condition | Échec | Récompense |
| --- | --- | --- | ---: |
| Budget gelé | acheter une presse offset | acheter une amélioration | 2 Culture |
| Zéro retour | terminer 3 contrats à au moins 80 % de qualité | finir un contrat sous le seuil | 3 Culture |
| Tout le monde en copie | terminer 3 contrats distincts à au moins 75 % d'image | finir un contrat sous le seuil | 4 Culture |

### 8.5 Campagnes, badges et conclusion

Les campagnes sont des dossiers plus longs, sans nouvelle monnaie. Elles se
déverrouillent à 3, 6 et 9 tampons et livrent respectivement les badges
`badgeOnboarding842`, `badgeAnnualReportSeason` et
`badgeConfidentialMerger`. Une seule campagne peut être active ; sa progression
est elle aussi séquentielle. Les campagnes donnent du contexte à des contrats
existants et peuvent leur donner priorité dans l'offre, elles ne créent pas une
deuxième liste de quêtes.

| Campagne | Tampons | Étapes successives |
| --- | ---: | --- |
| Onboarding de 842 personnes | 3 | 5 lignes de mise sous pli → livrer `onboardingKit` → **puis** réussir une autre clause |
| Saison des rapports annuels | 6 | 1 Studio prépresse → 85 % qualité → livrer `annualReports` |
| Fusion strictement confidentielle | 9 | 10 portails client → 90 % image → livrer 3 contrats distincts |

La clause éventuellement réussie pendant le Kit d'onboarding précède
l'activation de la troisième étape : elle ne compte donc pas comme « l'autre
clause ». Cette séquence est volontaire et doit rester explicite dans l'UI.

Les neuf rangs et les trois campagnes terminés débloquent la conclusion
« Assistant du vice-directeur des opérations papier ». C'est une reconnaissance
persistante et rejouable, pas un écran qui bloque la production.

La source normative de ce périmètre est l'issue GitHub
[#34](https://github.com/nclsppr/papersempire/issues/34).

---

## 9. Paramètres d'équilibrage

Pour faciliter les tests, prévoir un fichier de config:

```ts
type GameConfig = {
  docPerClickBase: number;
  buildingCostMultiplierDefault: number;
  globalProductionMultiplierBase: number;
  qualityRecoveryRate: number;
  imageRecoveryRate: number;
  footprintDriftBase: number;
  eventFrequencyBase: number;        // probabilité de spawn d'event
  prestigeCcDivisor: number;         // pour calcul des culturePoints
};
```

Exemple:

```ts
const defaultConfig: GameConfig = {
  docPerClickBase: 1,
  buildingCostMultiplierDefault: 1.15,
  globalProductionMultiplierBase: 1,
  qualityRecoveryRate: 0.02,
  imageRecoveryRate: 0.01,
  footprintDriftBase: 0.00001,
  eventFrequencyBase: 0.02,           // 2 % par minute par exemple
  prestigeCcDivisor: 1_000
};
```

---

## 10. Interface et retours au joueur

### 10.1 Poste de production

Le jeu présente un poste d'exploitation hiérarchisé :

* une console de presse manuelle avec DOC, CC et cadence ;
* un Dossier du moment qui montre le Plan, sa prochaine étape, le défi ou la
  campagne disponibles, ou le contrat client en cours, sans créer une seconde
  liste de quêtes ;
* un catalogue de machines avec quantité, coût suivant, contribution et action
  d'achat ;
* le bureau des méthodes pour les améliorations ;
* les contrats, événements, jauges, succès et réorganisation ;
* la carte compacte du production twin, qui garde la relation spatiale avec les
  bâtiments possédés.

Les miniatures de machines isométriques remplacent les anciens
stickers bristol. Les badges tamponnés sont conservés quand ils signifient une
validation ou un haut fait. La métaphore de papeterie n'est plus appliquée à
tous les contrôles.

### 10.2 Retours au joueur

* Un clic ou un achat produit un feedback court, causal et interruptible.
* Qualité et image de marque montent visuellement avec leur valeur ; l'empreinte
  est explicitement inversée, car une valeur basse est favorable.
* Un incident signale discrètement son attente dans la bannette. Sa modale ne
  s'ouvre que sur action ; il peut être classé sans effet ou désactivé
  durablement, puis réactivé dans les paramètres.
* Un objectif, défi, contrat, palier ou succès terminé affiche un retour bref,
  traduit et causal. Les lots de succès sont regroupés pour éviter un mur de
  notifications ; le journal garde la trace détaillée.
* Le panneau prestige affiche la culture actuelle, le gain de base, le bonus de
  Plan, l'abandon d'un défi et toute reprise d'un Plan ou d'un Grand dossier
  avant confirmation.
* Le mouvement n'est jamais requis pour comprendre un état et s'arrête selon
  les préférences d'accessibilité.

### 10.3 Data Science Zone

La Data Science Zone transforme les données locales du run en décisions
pratiques : quelle machine devient abordable, quel achat apporte le meilleur
gain marginal, combien de temps son coût représente à cadence constante, quelle
source contribue à la production et quel gain de culture est disponible.

Les métriques emploient les unités du jeu :

* `DOC/s` et `CC/s` pour les cadences ;
* `DOC` pour les coûts et retours internes ;
* secondes/minutes/heures pour les horizons constants ;
* pourcentages pour qualité, empreinte et image de marque.

Le mot « rentabilité » désigne uniquement un retour de coût **en DOC**. DOC
étant à la fois le volume produit et la monnaie du jeu, la zone ne calcule ni
revenu, ni dépense réelle, ni bénéfice, ni marge. Toute projection affiche cette
hypothèse et l'étendue de son historique local.
