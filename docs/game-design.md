````markdown
# Papers Empire 📄🖨️🏭  
Game Design Document (GDD) – version développeur

---

## 1. Vision générale 🎯

### 1.1 Pitch

Idle / incremental game centré sur la transformation d'une imprimerie industrielle en acteur omnicanal de la gestion documentaire.

Tu passes de:
- une petite imprimante de bureau et un opérateur repro  
à  
- une usine d'impression industrielle 4.0 pilotée par IA, portail client sécurisé et ComBridge.

### 1.2 Plateforme cible

- Web (navigateur desktop en priorité, mobile friendly si possible)
- Tech libre, par exemple:
  - Front: HTML5 + JS / TS (React, Vue ou vanilla)
  - Backend: optionnel (peut être full client-side)

---

## 2. Modèle de données principal 🧠

### 2.1 Ressources

```ts
type Resources = {
  docBank: number;        // Documents actuellement disponibles pour achat (monnaie)
  docTotal: number;       // Documents cumulés produits depuis le début
  ccTotal: number;        // Confiance client cumulée
  culturePoints: number;  // Points de prestige persistants entre run
};
````

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
  | "officePrinter"
  | "reproOperator"
  | "reproWorkshop"
  | "digitalPress"
  | "offsetPress"
  | "finishingWorkshop"
  | "insertingLine"
  | "logistics"
  | "clientPortal"
  | "comBridge"
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
  unlocked: boolean;
  unlockCondition: UnlockCondition;
  upgrades: UpgradeId[];      // upgrades déjà achetées
};
```

### 2.4 Upgrades

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

### 2.6 Effets d’upgrade

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

### 2.7 Achievements 🏆

```ts
type Achievement = {
  id: string;
  name: string;
  description: string;
  unlocked: boolean;
  condition: AchievementCondition;
  reward?: AchievementReward;
};

type AchievementCondition =
  | { type: "docTotal"; value: number }
  | { type: "maxProductionRate"; value: number }  // DOC/sec
  | { type: "buildingQuantity"; building: BuildingId; quantity: number }
  | { type: "qualityAbove"; value: number; durationSec: number }
  | { type: "footprintBelow"; value: number; durationSec: number }
  | { type: "eventCompleted"; eventId: string };

type AchievementReward =
  | { type: "culturePoints"; value: number }
  | { type: "brandImage"; value: number }
  | { type: "flatMultiplier"; multiplier: number };
```

---

## 3. Boucle de jeu et logique de production 🔁

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
  * building.quantity
  * buildingProductionMultiplier(building.id)
  * globalProductionMultiplier;
```

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

## 4. Bâtiments en détail 🏗️

### 4.1 Résumé des paliers

| Id                | Nom                         | Base DOC/s (par unité) | Base cost DOC | Cost mult | Type principal        |
| ----------------- | --------------------------- | ---------------------- | ------------- | --------- | --------------------- |
| officePrinter     | Petite imprimante de bureau | 0 (clic only)          | 0             | -         | Clic manuel           |
| reproOperator     | Opérateur repro             | 0.5                    | 15            | 1.15      | Prod auto faible      |
| reproWorkshop     | Atelier reprographie        | 3                      | 100           | 1.15      | Prod auto moyenne     |
| digitalPress      | Presse numérique            | 20                     | 1_000         | 1.15      | Prod auto forte       |
| offsetPress       | Presse offset               | 120                    | 10_000        | 1.15      | Prod volume massif    |
| finishingWorkshop | Atelier de finition         | 0 (modificateur)       | 1_500         | 1.15      | Capacité finition     |
| insertingLine     | Ligne de mise sous pli      | 0 (modificateur CC)    | 3_000         | 1.15      | Transformation envoi  |
| logistics         | Logistique et tri postal    | 0 (global mult)        | 5_000         | 1.15      | Mult global envois    |
| clientPortal      | Portail client sécurisé     | 5                      | 8_000         | 1.15      | Prod propre + qualité |
| comBridge         | ComBridge omnicanal         | 0 (CC focus)           | 20_000        | 1.20      | Multiplicateur CC     |
| factory40         | Usine 4.0                   | 0 (global mult)        | 50_000        | 1.20      | Mult global           |
| pampyAI           | IA Pampy Print              | 0 (global + footprint) | 100_000       | 1.25      | Optimisation globale  |

Remarque:

* Certains bâtiments ne produisent pas directement des DOC, mais modifient des multiplicateurs ou des jauges.

### 4.2 Exemple complet: Opérateur repro 👨‍🏭

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

## 5. Formules de coût et scaling 💰

### 5.1 Coût d'achat d'un bâtiment

```ts
function buildingCost(b: Building): number {
  return Math.floor(b.baseCost * Math.pow(b.costMultiplier, b.quantity));
}
```

### 5.2 Coût d’un upgrade

* Fixe dans cette V1 (`Upgrade.cost`).
* Peut être modulé par des paramètres global (ex: réduction de coûts via prestige).

---

## 6. Events dynamiques 🎲

### 6.1 Modèle de données

```ts
type EventId =
  | "machineBreakdown"
  | "paperShortage"
  | "volumePeak"
  | "qualityAudit"
  | "envAudit";

type GameEvent = {
  id: EventId;
  name: string;
  description: string;
  durationSec: number;
  choices: EventChoice[];
  active: boolean;
};

type EventChoice = {
  id: string;
  label: string;
  // effet appliqué une fois la réponse choisie
  apply: (state: GameState) => GameState;
};
```

### 6.2 Exemples

#### Panne machine

* Id: `machineBreakdown`
* Trigger: probabilité par minute, augmentée si DOCps est élevé et peu de maintenance.

Effets possibles:

* Option 1: "Réparer immédiatement"

  * Coût: `docBank -= DOCps * 30` (30 secondes de production perdues)
  * Qualité ne bouge pas
* Option 2: "Continuer à produire comme ça"

  * Gain DOC normal pendant `durationSec`
  * Mais:

    * `quality -= 0.1`
    * Augmentation de `footprint` (gâchis)

#### Rupture de papier

* Option 1: "Commande urgente"

  * `docBank -= baseCostUrgent`
  * Production continue
* Option 2: "Ralentir la production"

  * DOCps réduit de 50 % pendant `durationSec`
  * Pas de malus de qualité

#### Pic de volumes (gros client)

* Bonus de DOCps pendant une période
* Si `quality > 0.8` et aucun incident pendant la durée:

  * `ccTotal += bigBonus`
  * Unlock upgrade spéciale "Contrat majeur signé"

---

## 7. Achievements détaillés 🏅

Exemples:

```ts
const achievements: Achievement[] = [
  {
    id: "ach_first_100_clicks",
    name: "Ramasse-feuilles",
    description: "Imprimer 100 documents à la main.",
    unlocked: false,
    condition: { type: "docTotal", value: 100 },
    reward: { type: "culturePoints", value: 1 }
  },
  {
    id: "ach_palette",
    name: "Palette complète",
    description: "Consommer l'équivalent d'une palette de papier.",
    unlocked: false,
    condition: { type: "docTotal", value: 50_000 },
    reward: { type: "brandImage", value: 0.05 }
  },
  {
    id: "ach_full_omnichannel",
    name: "Full omnicanal",
    description: "Lancer une campagne courrier + email + SMS + portail.",
    unlocked: false,
    condition: { type: "eventCompleted", eventId: "volumePeak" },
    reward: { type: "flatMultiplier", multiplier: 1.05 }
  }
];
```

---

## 8. Prestige et réorganisation stratégique 🔄

### 8.1 Principe

* Le joueur peut déclencher une "Réorganisation stratégique".
* Effet:

  * Reset:

    * `docBank`, `docTotal`, `ccTotal`
    * Bâtiments et upgrades
  * Conserve:

    * `culturePoints` (prestige)
  * Applique:

    * Bonus permanent sur productions et jauges.

### 8.2 Calcul des points de culture obtenus

Par exemple:

```ts
cultureGained = floor( sqrt(ccTotal / 1_000) );
```

### 8.3 Effet des points de culture

Multiplicateur global de production:

```ts
globalProductionMultiplier = 1 + culturePoints * 0.05;
```

Bonus de qualité de base:

```ts
qualityBase = 0.3 + culturePoints * 0.02;  // clamp à 1
```

---

## 9. Hooks de balancing et paramètres tunables ⚙️

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

## 10. UI et feedback joueur 🎨

Petit récap côté dev front:

* Panneau principal:

  * Bouton clic "imprimante de bureau" avec compteur DOC et CC.
  * Liste de bâtiments avec:

    * Nom, quantité, production, coût, bouton "Acheter".
  * Liste d'upgrades disponibles.

* Bandeau de jauges:

  * Qualité (barre de 0 à 100 %)
  * Empreinte papier (inversée visuellement: plus c'est vert, mieux c'est)
  * Image de marque (étoiles, par exemple)

* Panneau d'événements:

  * Popup avec 2 ou 3 boutons (choices).
  * Timer de durée restante.

* Panneau prestige:

  * Culture actuelle.
  * Simulation du gain en cas de réorg immédiate.
