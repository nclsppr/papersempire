(function () {
  const MAX_VISIBLE_CONTRACTS = 3;

  const CONTRACT_TRANSLATIONS = {
    en: {
      "contracts.requirementsNotMet": "You don't meet the premium contract requirements yet.",
      "contracts.rerollCountdown": "Refresh in {{seconds}} s",
      "contracts.expressFlyer.name": "Express mailshot",
      "contracts.expressFlyer.desc": "1 200 customised flyers with finishing before tomorrow's board meeting.",
      "contracts.onboardingKit.name": "Onboarding kit automation",
      "contracts.onboardingKit.desc": "Bundle contracts, welcome letters and badges into an overnight courier batch.",
      "contracts.crossMedia.name": "Cross-media campaign",
      "contracts.crossMedia.desc": "Sync print, email and SMS waves for a premium banking launch.",
      "contracts.governancePack.name": "Governance report pack",
      "contracts.governancePack.desc": "Print, bind and personalise board reports with audit-proof tracking."
    },
    fr: {
      "contracts.requirementsNotMet": "Tu ne respectes pas encore les exigences de ce contrat premium.",
      "contracts.rerollCountdown": "Rafraîchir dans {{seconds}} s",
      "contracts.expressFlyer.name": "Mailing express",
      "contracts.expressFlyer.desc": "1 200 flyers personnalisés + finition avant le comité de demain.",
      "contracts.onboardingKit.name": "Kit d'onboarding automatisé",
      "contracts.onboardingKit.desc": "Assembler contrats, lettres de bienvenue et badges pour une livraison de nuit.",
      "contracts.crossMedia.name": "Campagne cross-média",
      "contracts.crossMedia.desc": "Synchroniser print, e-mail et SMS pour un lancement bancaire premium.",
      "contracts.governancePack.name": "Pack rapport de gouvernance",
      "contracts.governancePack.desc": "Imprimer, relier et personnaliser les rapports CA avec traçabilité audit."
    },
    de: {
      "contracts.requirementsNotMet": "Die Anforderungen für diesen Premium-Vertrag sind noch nicht erfüllt.",
      "contracts.rerollCountdown": "Neu laden in {{seconds}} s",
      "contracts.expressFlyer.name": "Express-Mailing",
      "contracts.expressFlyer.desc": "1.200 personalisierte Flyer samt Veredelung bis zur morgigen Vorstandssitzung.",
      "contracts.onboardingKit.name": "Onboarding-Kit-Automation",
      "contracts.onboardingKit.desc": "Verträge, Begrüßungsbriefe und Badges bündeln und über Nacht zustellen.",
      "contracts.crossMedia.name": "Cross-Media-Kampagne",
      "contracts.crossMedia.desc": "Print-, Mail- und SMS-Wellen für einen Premium-Bankenlaunch synchronisieren.",
      "contracts.governancePack.name": "Governance-Report-Paket",
      "contracts.governancePack.desc": "Vorstandsberichte drucken, binden und personalisieren – revisionssicher."
    },
    lb: {
      "contracts.requirementsNotMet": "D'Ufuerderunge fir dëse Premium-Kontrakt sinn nach net erfëllt.",
      "contracts.rerollCountdown": "Nei Offeren an {{seconds}} s",
      "contracts.expressFlyer.name": "Express-Mailshot",
      "contracts.expressFlyer.desc": "1 200 personaliséiert Flyer mat Finish virum Mueres-Comité.",
      "contracts.onboardingKit.name": "Automatiséiert Welcome-Kit",
      "contracts.onboardingKit.desc": "Kontrakter, Begréissungsbréiwer a Badgen an engem Owend-Liwwerpak zesummesetzen.",
      "contracts.crossMedia.name": "Cross-Media-Campagne",
      "contracts.crossMedia.desc": "Dréck, E-Mail an SMS fir e Premium-Bankenlaunch ofstëmmen.",
      "contracts.governancePack.name": "Governance-Report-Paket",
      "contracts.governancePack.desc": "Berichter drécken, bënnen a personaliséieren mat Audit-Tracking."
    }
  };

  const CONTRACT_DEFS = [
    {
      id: "expressFlyer",
      nameKey: "contracts.expressFlyer.name",
      descKey: "contracts.expressFlyer.desc",
      minDocTotal: 0,
      duration: 45,
      requirements: {
        quality: 0.45,
        image: 0.35,
        volume: 800
      },
      reward: {
        doc: 600,
        cc: 120,
        cards: 1
      }
    },
    {
      id: "onboardingKit",
      nameKey: "contracts.onboardingKit.name",
      descKey: "contracts.onboardingKit.desc",
      minDocTotal: 1500,
      duration: 75,
      requirements: {
        quality: 0.55,
        image: 0.45,
        volume: 2500
      },
      reward: {
        doc: 2200,
        cc: 420,
        cards: 2
      }
    },
    {
      id: "crossMedia",
      nameKey: "contracts.crossMedia.name",
      descKey: "contracts.crossMedia.desc",
      minDocTotal: 5000,
      duration: 110,
      requirements: {
        quality: 0.65,
        image: 0.6,
        volume: 6000
      },
      reward: {
        doc: 5200,
        cc: 900,
        cards: 3
      }
    },
    {
      id: "governancePack",
      nameKey: "contracts.governancePack.name",
      descKey: "contracts.governancePack.desc",
      minDocTotal: 12000,
      duration: 150,
      requirements: {
        quality: 0.75,
        image: 0.7,
        volume: 14000
      },
      reward: {
        doc: 12000,
        cc: 1800,
        cards: 5
      }
    }
  ];

  const activeContract = {
    current: null,
    timer: 0
  };

  let availableContracts = [];

  injectContractTranslations();

  function loadData(gameState) {
    availableContracts = [];
    refillContracts(gameState);
    return Promise.resolve(CONTRACT_DEFS.length);
  }

  function getAvailableContracts(gameState) {
    ensureContracts(gameState);
    return availableContracts.slice();
  }

  function rerollContracts(gameState) {
    availableContracts = [];
    refillContracts(gameState);
    return availableContracts.slice();
  }

  function startContract(id, gameState) {
    if (activeContract.current) {
      return { ok: false, error: "running" };
    }
    const contract = CONTRACT_DEFS.find(def => def.id === id);
    if (!contract) {
      return { ok: false, error: "notFound" };
    }
    if (!meetsRequirements(contract, gameState)) {
      return { ok: false, error: "requirements" };
    }
    activeContract.current = contract;
    activeContract.timer = contract.duration;
    removeFromAvailable(contract.id);
    refillContracts(gameState);
    return { ok: true, contract };
  }

  function tickContract(dt, gameState) {
    if (!activeContract.current) return null;
    activeContract.timer -= dt;
    if (activeContract.timer > 0) {
      return null;
    }
    const finished = activeContract.current;
    activeContract.current = null;
    activeContract.timer = 0;
    applyRewards(finished, gameState);
    refillContracts(gameState);
    return finished;
  }

  function ensureContracts(gameState) {
    if (!availableContracts.length) {
      refillContracts(gameState);
    } else if (availableContracts.length < MAX_VISIBLE_CONTRACTS) {
      refillContracts(gameState);
    }
  }

  function refillContracts(gameState) {
    const docTotal = (gameState && gameState.resources && gameState.resources.docTotal) || 0;
    const pool = CONTRACT_DEFS.filter(def => {
      if (docTotal < def.minDocTotal) return false;
      if (availableContracts.some(item => item.id === def.id)) return false;
      if (activeContract.current && activeContract.current.id === def.id) return false;
      return true;
    });
    while (availableContracts.length < MAX_VISIBLE_CONTRACTS && pool.length) {
      const index = Math.floor(Math.random() * pool.length);
      availableContracts.push(pool.splice(index, 1)[0]);
    }
    if (!availableContracts.length && CONTRACT_DEFS.length) {
      availableContracts.push(CONTRACT_DEFS[0]);
    }
  }

  function removeFromAvailable(id) {
    availableContracts = availableContracts.filter(contract => contract.id !== id);
  }

  function meetsRequirements(contract, gameState) {
    const stats = (gameState && gameState.stats) || {};
    const resources = (gameState && gameState.resources) || {};
    const quality = stats.quality || 0;
    const image = stats.brandImage || 0;
    const volume = resources.docTotal || 0;
    return (
      quality >= (contract.requirements.quality || 0) &&
      image >= (contract.requirements.image || 0) &&
      volume >= (contract.requirements.volume || 0)
    );
  }

  function applyRewards(contract, gameState) {
    if (!gameState || !gameState.resources) return;
    const reward = contract.reward || {};
    if (reward.doc) {
      gameState.resources.docBank += reward.doc;
      gameState.resources.docTotal += reward.doc;
    }
    if (reward.cc) {
      gameState.resources.ccTotal += reward.cc;
    }
  }

  function injectContractTranslations() {
    if (!window.I18N) {
      window.I18N = {};
    }
    Object.keys(CONTRACT_TRANSLATIONS).forEach(lang => {
      window.I18N[lang] = window.I18N[lang] || {};
      Object.assign(window.I18N[lang], CONTRACT_TRANSLATIONS[lang]);
    });
  }

  window.EndgameModule = {
    loadData,
    availableContracts: getAvailableContracts,
    rerollContracts,
    startContract,
    tickContract,
    activeContract
  };
})();
