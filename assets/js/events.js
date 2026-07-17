(function () {
  const BASE_INTERVAL = 30;
  const MIN_COOLDOWN = 45;
  const definitions = [
    {
      id: "machineBreakdown",
      type: "choice",
      titleKey: "events.machineBreakdown.title",
      descriptionKey: "events.machineBreakdown.desc",
      choices: [
        {
          id: "fix",
          labelKey: "events.machineBreakdown.choice.fix",
          resultKey: "events.machineBreakdown.result.fix",
          tone: "positive",
          effect(gameState) {
            const cost = Math.min(50, gameState.resources.docBank * 0.2);
            gameState.resources.docBank = Math.max(0, gameState.resources.docBank - cost);
            gameState.stats.quality = Math.min(1, gameState.stats.quality + 0.05);
          }
        },
        {
          id: "ignore",
          labelKey: "events.machineBreakdown.choice.ignore",
          resultKey: "events.machineBreakdown.result.ignore",
          tone: "negative",
          effect(gameState) {
            gameState.stats.quality = Math.max(0, gameState.stats.quality - 0.08);
          }
        }
      ]
    },
    {
      id: "auditQuality",
      type: "choice",
      titleKey: "events.auditQuality.title",
      descriptionKey: "events.auditQuality.desc",
      choices: [
        {
          id: "full",
          labelKey: "events.auditQuality.choice.full",
          resultKey: "events.auditQuality.result.full",
          tone: "positive",
          effect(gameState) {
            gameState.resources.ccTotal += 50;
            gameState.stats.quality = Math.min(1, gameState.stats.quality + 0.1);
          }
        },
        {
          id: "superficial",
          labelKey: "events.auditQuality.choice.superficial",
          resultKey: "events.auditQuality.result.superficial",
          tone: "negative",
          effect(gameState) {
            gameState.stats.quality = Math.max(0, gameState.stats.quality - 0.05);
            gameState.resources.ccTotal = Math.max(0, gameState.resources.ccTotal - 30);
          }
        }
      ]
    },
    {
      id: "newContract",
      type: "choice",
      titleKey: "events.newContract.title",
      descriptionKey: "events.newContract.desc",
      choices: [
        {
          id: "accept",
          labelKey: "events.newContract.choice.accept",
          resultKey: "events.newContract.result.accept",
          tone: "mixed",
          effect(gameState) {
            gameState.resources.docBank += 120;
            gameState.stats.footprint = Math.min(1, gameState.stats.footprint + 0.05);
          }
        },
        {
          id: "decline",
          labelKey: "events.newContract.choice.decline",
          resultKey: "events.newContract.result.decline",
          tone: "negative",
          effect(gameState) {
            gameState.resources.ccTotal = Math.max(0, gameState.resources.ccTotal - 40);
          }
        }
      ]
    },
    {
      id: "cyberAttack",
      type: "choice",
      titleKey: "events.cyberAttack.title",
      descriptionKey: "events.cyberAttack.desc",
      choices: [
        {
          id: "disconnect",
          labelKey: "events.cyberAttack.choice.disconnect",
          resultKey: "events.cyberAttack.result.disconnect",
          tone: "negative",
          effect(gameState) {
            const penalty = Math.min(gameState.resources.docBank, 80);
            gameState.resources.docBank -= penalty;
          }
        },
        {
          id: "pay",
          labelKey: "events.cyberAttack.choice.pay",
          resultKey: "events.cyberAttack.result.pay",
          tone: "negative",
          effect(gameState) {
            const penalty = Math.min(gameState.resources.ccTotal, 70);
            gameState.resources.ccTotal -= penalty;
          }
        }
      ]
    },
    {
      id: "sabotage",
      type: "choice",
      titleKey: "events.sabotage.title",
      descriptionKey: "events.sabotage.desc",
      choices: [
        {
          id: "investigate",
          labelKey: "events.sabotage.choice.investigate",
          resultKey: "events.sabotage.result.investigate",
          tone: "positive",
          effect(gameState) {
            gameState.stats.brandImage = Math.min(1, gameState.stats.brandImage + 0.06);
          }
        },
        {
          id: "ignore",
          labelKey: "events.sabotage.choice.ignore",
          resultKey: "events.sabotage.result.ignore",
          tone: "negative",
          effect(gameState) {
            gameState.stats.brandImage = Math.max(0, gameState.stats.brandImage - 0.07);
          }
        }
      ]
    },
    {
      id: "calibrationChallenge",
      type: "minigame",
      titleKey: "events.calibration.title",
      descriptionKey: "events.calibration.desc",
      resultWinKey: "events.calibration.result.win",
      resultLoseKey: "events.calibration.result.lose"
    }
  ];

  let activeEvent = null;
  let timer = 0;
  let cooldown = 20;
  let minigameCode = null;

  function tick(gameState, dt = 1) {
    if (activeEvent) return null;
    if (cooldown > 0) {
      cooldown -= dt;
      return null;
    }
    timer += dt;
    const productionFactor = Math.min(0.2, gameState.resources.docTotal / 5000);
    const spawnChance = 0.01 + productionFactor;
    if (timer >= BASE_INTERVAL && Math.random() < spawnChance) {
      activeEvent = definitions[Math.floor(Math.random() * definitions.length)];
      timer = 0;
      return activeEvent;
    }
    return null;
  }

  function resolveChoice(choiceId, gameState) {
    if (!activeEvent || activeEvent.type !== "choice") return null;
    const choice = activeEvent.choices.find(c => c.id === choiceId);
    if (!choice) return null;
    choice.effect(gameState);
    const resultKey = choice.resultKey;
    const tone = choice.tone || "mixed";
    activeEvent = null;
    cooldown = MIN_COOLDOWN;
    return { resultKey, tone };
  }

  function startMinigame() {
    if (!activeEvent || activeEvent.type !== "minigame") return null;
    minigameCode = Math.floor(Math.random() * 3) + 1;
    return { code: minigameCode };
  }

  function resolveMinigame(answer, gameState) {
    if (!activeEvent || activeEvent.type !== "minigame") return null;
    const success = Number(answer) === minigameCode;
    const tone = success ? "positive" : "negative";
    if (success) {
      gameState.resources.docBank += 80;
      gameState.stats.quality = Math.min(1, gameState.stats.quality + 0.04);
    } else {
      gameState.stats.quality = Math.max(0, gameState.stats.quality - 0.05);
    }
    const resultKey = success ? activeEvent.resultWinKey : activeEvent.resultLoseKey;
    activeEvent = null;
    cooldown = MIN_COOLDOWN;
    return { resultKey, success, tone };
  }

  function cancelActive() {
    activeEvent = null;
    minigameCode = null;
    cooldown = MIN_COOLDOWN;
  }

  function getActiveEvent() {
    return activeEvent;
  }

  function debugForceEvent(id) {
    const def = definitions.find(d => d.id === id);
    if (!def) return null;
    activeEvent = def;
    return activeEvent;
  }

  window.Events = {
    definitions,
    tick,
    resolveChoice,
    startMinigame,
    resolveMinigame,
    getActiveEvent,
    debugForceEvent,
    cancelActive
  };
})();
