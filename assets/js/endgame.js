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
      "contracts.governancePack.desc": "Print, bind and personalise board reports with audit-proof tracking.",
      "contracts.tradeFair.name": "Trade fair kit",
      "contracts.tradeFair.desc": "Brochures, roll-up banners and branded pens: everything ends up in a tote bag, then in a drawer.",
      "contracts.electionPack.name": "Election pack",
      "contracts.electionPack.desc": "Candidate leaflets and ballot papers for a local election: the deadline is set by law, not by the client.",
      "contracts.annualReports.name": "Annual report season",
      "contracts.annualReports.desc": "The whole stock index orders its annual reports: glossy paper, cautious optimism, guaranteed tonnage.",
      "contracts.nationalCensus.name": "National census",
      "contracts.nationalCensus.desc": "Millions of official forms, each printed in triplicate, one copy going straight to the archives."
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
      "contracts.governancePack.desc": "Imprimer, relier et personnaliser les rapports CA avec traçabilité audit.",
      "contracts.tradeFair.name": "Kit salon B2B",
      "contracts.tradeFair.desc": "Brochures, roll-ups et stylos floqués : tout finira dans un tote bag, puis dans un tiroir.",
      "contracts.electionPack.name": "Pack électoral",
      "contracts.electionPack.desc": "Professions de foi et bulletins pour les municipales : la date limite est fixée par la loi, pas par le client.",
      "contracts.annualReports.name": "Saison des rapports",
      "contracts.annualReports.desc": "Tout l'indice boursier commande ses rapports annuels : papier glacé, optimisme prudent, tonnage garanti.",
      "contracts.nationalCensus.name": "Recensement national",
      "contracts.nationalCensus.desc": "Des millions de formulaires officiels, chacun en trois exemplaires, dont un directement pour les archives."
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
      "contracts.governancePack.desc": "Vorstandsberichte drucken, binden und personalisieren – revisionssicher.",
      "contracts.tradeFair.name": "B2B-Messepaket",
      "contracts.tradeFair.desc": "Broschüren, Roll-ups und bedruckte Kulis: alles landet erst im Jutebeutel und dann in der Schublade.",
      "contracts.electionPack.name": "Wahlpaket",
      "contracts.electionPack.desc": "Wahlprospekte und Stimmzettel für die Kommunalwahl: die Frist steht im Gesetz, nicht im Vertrag.",
      "contracts.annualReports.name": "Geschäftsberichts-Saison",
      "contracts.annualReports.desc": "Der ganze Aktienindex bestellt Geschäftsberichte: Hochglanzpapier, vorsichtiger Optimismus, garantierte Tonnage.",
      "contracts.nationalCensus.name": "Volkszählung",
      "contracts.nationalCensus.desc": "Millionen amtliche Formulare, jedes in dreifacher Ausfertigung, eines davon direkt fürs Archiv."
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
      "contracts.governancePack.desc": "Berichter drécken, bënnen a personaliséieren mat Audit-Tracking.",
      "contracts.tradeFair.name": "B2B-Foire-Pak",
      "contracts.tradeFair.desc": "Brochuren, Roll-ups a Bice mam Logo: alles geet fir d'éischt an de Stoffbeidel an duerno an den Tirang.",
      "contracts.electionPack.name": "Gemengewalen-Pak",
      "contracts.electionPack.desc": "Walprogrammer a Stëmmziedele fir d'Gemengewalen: den Delai steet am Gesetz, net am Kontrakt.",
      "contracts.annualReports.name": "Joresrapport-Saison",
      "contracts.annualReports.desc": "De ganzen Index bestellt seng Joresrapporten: Glanzpabeier, virsiichtegen Optimismus a garantéiert Tonnen.",
      "contracts.nationalCensus.name": "Nationale Recensement",
      "contracts.nationalCensus.desc": "Milliounen offiziell Formulairen, all an dräi Exemplairen, een dovun direkt fir d'Archiv."
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
,
    {
      id: "tradeFair",
      nameKey: "contracts.tradeFair.name",
      descKey: "contracts.tradeFair.desc",
      minDocTotal: 40000,
      duration: 180,
      requirements: { quality: 0.78, image: 0.72, volume: 45000 },
      reward: { doc: 40000, cc: 6000, cards: 7 }
    },
    {
      id: "electionPack",
      nameKey: "contracts.electionPack.name",
      descKey: "contracts.electionPack.desc",
      minDocTotal: 120000,
      duration: 220,
      requirements: { quality: 0.8, image: 0.74, volume: 140000 },
      reward: { doc: 120000, cc: 18000, cards: 9 }
    },
    {
      id: "annualReports",
      nameKey: "contracts.annualReports.name",
      descKey: "contracts.annualReports.desc",
      minDocTotal: 400000,
      duration: 260,
      requirements: { quality: 0.82, image: 0.77, volume: 450000 },
      reward: { doc: 400000, cc: 55000, cards: 12 }
    },
    {
      id: "nationalCensus",
      nameKey: "contracts.nationalCensus.name",
      descKey: "contracts.nationalCensus.desc",
      minDocTotal: 1000000,
      duration: 300,
      requirements: { quality: 0.85, image: 0.8, volume: 1100000 },
      reward: { doc: 1000000, cc: 130000, cards: 15 }
    }
  ];

  const activeContract = {
    current: null,
    timer: 0
  };

  let availableContracts = [];

  injectContractTranslations();

  function loadData(gameState, savedContract) {
    restoreActiveContract(savedContract);
    availableContracts = [];
    refillContracts(gameState);
    return Promise.resolve(CONTRACT_DEFS.length);
  }

  function restoreActiveContract(savedContract) {
    activeContract.current = null;
    activeContract.timer = 0;
    if (!savedContract || typeof savedContract !== "object") return;
    const contract = CONTRACT_DEFS.find(def => def.id === savedContract.id);
    const timer = Number(savedContract.timer);
    if (!contract || !Number.isFinite(timer) || timer <= 0) return;
    activeContract.current = contract;
    activeContract.timer = Math.min(contract.duration, timer);
  }

  function exportActiveContract() {
    if (!activeContract.current) return null;
    return {
      id: activeContract.current.id,
      timer: Math.max(0, activeContract.timer)
    };
  }

  function cancelActiveContract() {
    const hadActiveContract = Boolean(activeContract.current);
    activeContract.current = null;
    activeContract.timer = 0;
    return hadActiveContract;
  }

  function resetForPrestige(gameState) {
    cancelActiveContract();
    availableContracts = [];
    refillContracts(gameState);
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
    exportActiveContract,
    cancelActiveContract,
    resetForPrestige,
    activeContract
  };
})();
