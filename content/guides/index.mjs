export const SITE_ORIGIN = "https://papersempire.com";

export const AUTHOR = Object.freeze({
  name: "Nicolas Pieper",
  url: "https://nicolaspieper.com/",
});

export const LOCALES = Object.freeze({
  fr: {
    htmlLang: "fr",
    ogLocale: "fr_FR",
    label: "FR",
    nativeName: "Français",
    homePath: "/",
    hubPath: "/guides/",
    ui: {
      skip: "Aller au contenu",
      home: "Jouer",
      guides: "Guides de l’atelier",
      language: "Langues",
      breadcrumbHome: "Papers Empire",
      breadcrumbHub: "Guides de l’atelier",
      breadcrumbLabel: "Fil d’Ariane",
      published: "Publié le",
      updated: "Mis à jour le",
      minutes: "min de lecture",
      by: "Par",
      disclosureLabel: "Transparence",
      disclosure: "Ce guide est écrit par Nicolas Pieper, créateur de Papers Empire. Les jeux cités sont présentés sans note globale et les liens avec Papers Empire sont signalés.",
      sources: "Sources officielles",
      related: "À lire ensuite",
      play: "Ouvrir Papers Empire",
      back: "Tous les guides",
      sourceChecked: "Liens officiels vérifiés le",
      imageCaption: "Illustration originale de l’atelier Papers Empire.",
      footer: "Des repères honnêtes pour mieux choisir ses jeux incrémentaux de navigateur.",
    },
  },
  en: {
    htmlLang: "en",
    ogLocale: "en_US",
    label: "EN",
    nativeName: "English",
    homePath: "/en/",
    hubPath: "/en/guides/",
    ui: {
      skip: "Skip to content",
      home: "Play",
      guides: "Workshop guides",
      language: "Languages",
      breadcrumbHome: "Papers Empire",
      breadcrumbHub: "Workshop Guides",
      breadcrumbLabel: "Breadcrumb",
      published: "Published",
      updated: "Updated",
      minutes: "min read",
      by: "By",
      disclosureLabel: "Disclosure",
      disclosure: "This guide was written by Nicolas Pieper, creator of Papers Empire. The games are presented without an overall score, and the connection to Papers Empire is always stated.",
      sources: "Official sources",
      related: "Read next",
      play: "Open Papers Empire",
      back: "All guides",
      sourceChecked: "Official links checked on",
      imageCaption: "Original illustration from the Papers Empire workshop.",
      footer: "Straightforward guidance for choosing browser incremental games.",
    },
  },
  de: {
    htmlLang: "de",
    ogLocale: "de_DE",
    label: "DE",
    nativeName: "Deutsch",
    homePath: "/de/",
    hubPath: "/de/guides/",
    ui: {
      skip: "Zum Inhalt springen",
      home: "Spielen",
      guides: "Werkstatt-Guides",
      language: "Sprachen",
      breadcrumbHome: "Papers Empire",
      breadcrumbHub: "Werkstatt-Guides",
      breadcrumbLabel: "Brotkrümelnavigation",
      published: "Veröffentlicht am",
      updated: "Aktualisiert am",
      minutes: "Min. Lesezeit",
      by: "Von",
      disclosureLabel: "Transparenzhinweis",
      disclosure: "Dieser Guide stammt von Nicolas Pieper, dem Schöpfer von Papers Empire. Die Spiele erhalten keine Gesamtnote; die Verbindung zu Papers Empire wird immer offengelegt.",
      sources: "Offizielle Quellen",
      related: "Als Nächstes lesen",
      play: "Papers Empire öffnen",
      back: "Alle Guides",
      sourceChecked: "Offizielle Links geprüft am",
      imageCaption: "Originalillustration aus der Werkstatt von Papers Empire.",
      footer: "Ehrliche Orientierung für die Wahl von Incremental Games im Browser.",
    },
  },
  lb: {
    htmlLang: "lb",
    ogLocale: "lb_LU",
    label: "LB",
    nativeName: "Lëtzebuergesch",
    homePath: "/lb/",
    hubPath: "/lb/guides/",
    ui: {
      skip: "Bei den Inhalt sprangen",
      home: "Spillen",
      guides: "Atelier-Guiden",
      language: "Sproochen",
      breadcrumbHome: "Papers Empire",
      breadcrumbHub: "Atelier-Guiden",
      breadcrumbLabel: "Navigatiounswee",
      published: "Verëffentlecht den",
      updated: "Aktualiséiert den",
      minutes: "Min. Lieszäit",
      by: "Vum",
      disclosureLabel: "Transparenz",
      disclosure: "Dëse Guide ass vum Nicolas Pieper, dem Schëpfer vu Papers Empire. D’Spiller kréie keng global Bewäertung, an d’Verbindung mat Papers Empire gëtt ëmmer kloer genannt.",
      sources: "Offiziell Quellen",
      related: "Duerno liesen",
      play: "Papers Empire opmaachen",
      back: "All d’Guiden",
      sourceChecked: "Offiziell Linke kontrolléiert den",
      imageCaption: "Original Illustratioun aus dem Papers-Empire-Atelier.",
      footer: "Éierlech Orientéierung fir Incremental Games am Browser auszewielen.",
    },
  },
});

export const HUBS = Object.freeze({
  fr: {
    title: "Guides de l’atelier — Idle games de navigateur",
    h1: "Les guides de l’atelier",
    description: "Définitions, sélections et comparaisons honnêtes pour comprendre les idle games de navigateur et choisir l’expérience qui vous correspond.",
    eyebrow: "REGISTRE ÉDITORIAL · ATELIER 01",
    intro: "L’atelier ne se limite pas à produire des documents. Ici, on démonte les mécaniques des jeux idle, on compare leurs rythmes et on renvoie toujours vers leurs versions officielles.",
    promise: "Pas de notes sur 10, pas de vainqueur arrangé : des différences concrètes, des sources et le contexte nécessaire pour choisir.",
  },
  en: {
    title: "Workshop Guides — Browser idle games",
    h1: "Workshop Guides",
    description: "Clear definitions, curated selections, and honest comparisons to understand browser idle games and choose the experience that fits you.",
    eyebrow: "EDITORIAL REGISTER · WORKSHOP 01",
    intro: "The workshop is about more than producing documents. Here we take idle-game systems apart, compare their rhythms, and always point to official versions.",
    promise: "No scores out of ten and no pre-arranged winner: practical differences, primary sources, and enough context to choose.",
  },
  de: {
    title: "Werkstatt-Guides — Idle Games im Browser",
    h1: "Die Werkstatt-Guides",
    description: "Klare Definitionen, ausgewählte Spiele und ehrliche Vergleiche, um Browser-Idle-Games zu verstehen und das passende Erlebnis zu finden.",
    eyebrow: "REDAKTIONSREGISTER · WERKSTATT 01",
    intro: "In der Werkstatt geht es um mehr als Dokumente. Wir zerlegen Idle-Mechaniken, vergleichen Spielrhythmen und verlinken immer die offiziellen Versionen.",
    promise: "Keine Zehnerwertung und kein abgesprochener Sieger: konkrete Unterschiede, Primärquellen und genug Kontext für eine gute Wahl.",
  },
  lb: {
    title: "Atelier-Guiden — Idle Games am Browser",
    h1: "D’Guide vum Atelier",
    description: "Kloer Erklärungen, ausgewielte Spiller an éierlech Vergläicher fir Browser-Idle-Games ze verstoen an dat passend Spill ze fannen.",
    eyebrow: "REDAKTIOUNSREGISTER · ATELIER 01",
    intro: "Am Atelier geet et ëm méi wéi Dokumenter. Mir huelen d’Mechanike vun Idle Games auserneen, vergläichen hire Rhythmus a verlinken ëmmer déi offiziell Versiounen.",
    promise: "Keng Punkten op zéng a kee virbestëmmte Gewënner: konkret Ënnerscheeder, Primärquellen a genuch Kontext fir ze wielen.",
  },
});

const sharedSources = Object.freeze({
  papers: { label: "Papers Empire", url: "https://papersempire.com/" },
  papersDesign: {
    label: {
      fr: "Papers Empire — conception du jeu",
      en: "Papers Empire — game design",
      de: "Papers Empire — Spieldesign",
      lb: "Papers Empire — Spilldesign",
    },
    url: "https://github.com/nclsppr/papersempire/blob/main/docs/game-design.md",
  },
  paperclips: { label: "Universal Paperclips", url: "https://www.decisionproblem.com/paperclips/index2.html" },
  paperclipsCreator: { label: "Frank Lantz — Universal Paperclips", url: "https://www.franklantz.net/work" },
  cookie: { label: "Cookie Clicker", url: "https://orteil.dashnet.org/cookieclicker/" },
  kittens: { label: "Kittens Game", url: "https://kittensgame.com/web/" },
  trimps: { label: "Trimps", url: "https://trimps.github.io/" },
  industry: { label: "Industry Idle", url: "https://play.industryidle.com/" },
  evolve: { label: "Evolve", url: "https://pmotschmann.github.io/Evolve/" },
  evolveRepo: {
    label: {
      fr: "Evolve — code source",
      en: "Evolve — source code",
      de: "Evolve — Quellcode",
      lb: "Evolve — Quellcode",
    },
    url: "https://github.com/pmotschmann/Evolve",
  },
});

export const ARTICLES = Object.freeze([
  {
    id: "idle-clicker-incremental",
    image: "/assets/images/guides/idle-clicker-incremental.webp",
    datePublished: "2026-08-26",
    dateModified: "2026-08-26",
    sourcesCheckedAt: "2026-08-26",
    sources: [sharedSources.papers, sharedSources.papersDesign, sharedSources.cookie, sharedSources.paperclips],
    translations: {
      fr: {
        slug: "jeu-idle-clicker-incremental-differences",
        title: "Jeu idle, clicker ou jeu incrémental : quelles différences ?",
        description: "Idle, clicker, incrémental : ce qui change entre clic actif, automatisation, progression hors ligne et prestige, avec des exemples jouables.",
        eyebrow: "LEXIQUE DE PRODUCTION · GUIDE 01",
        lead: "Il n’existe pas de frontière normalisée unique entre ces trois étiquettes. Cette grille éditoriale distingue surtout le geste du clicker, le rapport au temps de l’idle et la croissance du système incrémental.",
        imageAlt: "Une presse manuelle reliée à une chaîne automatisée où des piles de papier grandissent, dans le style industriel de Papers Empire",
        readingMinutes: 7,
        card: "Un repère simple pour distinguer le clic, l’automatisation et les couches de progression.",
        sections: [
          { title: "La réponse courte", paragraphs: [
            "Un <strong>clicker</strong> fait du clic répété une action importante. Un <strong>idle game</strong> fait progresser ou exécute un système avec peu d’attention, au moins pendant que la partie tourne. Un <strong>jeu incrémental</strong> repose sur le réinvestissement : les nombres montent, mais surtout de nouveaux systèmes apparaissent.",
            "Ce ne sont pas trois rayons étanches. Cookie Clicker part d’un clic et construit une production automatique. Universal Paperclips commence par fabriquer des trombones à la main, puis déplace l’attention vers les machines, les prix et d’autres décisions. Papers Empire utilise le clic comme amorce avant de faire de l’atelier automatisé le cœur de la partie."
          ] },
          { title: "Clicker : le geste est au premier plan", paragraphs: [
            "Dans un clicker, l’entrée manuelle est immédiatement lisible : cliquer produit une ressource ou accélère un résultat. Ce geste peut ensuite perdre de son importance, mais il donne le rythme des premières minutes et reste souvent améliorable.",
            "Le mot décrit donc une interaction, pas toute la structure du jeu. Un clicker peut devenir largement automatique, proposer des réinitialisations et déployer plusieurs monnaies sans cesser d’être reconnu comme tel."
          ] },
          { title: "Idle : l’attention devient une ressource", paragraphs: [
            "Un idle game demande au joueur de configurer un système qui travaille sans action continue. L’intérêt ne vient pas de l’absence totale de décisions, mais de leur cadence : acheter maintenant, attendre un seuil, revenir après une production, puis réorienter la machine.",
            "Idle ne signifie pas forcément “progression navigateur fermé”. Certains jeux calculent le temps écoulé au retour, d’autres ralentissent ou s’arrêtent. Il faut distinguer l’onglet actif, l’onglet masqué et le navigateur réellement fermé."
          ] },
          { title: "Incrémental : le système change d’échelle", paragraphs: [
            "Dans un jeu incrémental, chaque gain alimente le suivant. On ne se contente pas d’accumuler la même ressource : on débloque des producteurs, des multiplicateurs, des monnaies ou des règles qui changent la lecture de la partie.",
            "Le prestige est fréquent, mais pas obligatoire. Son rôle est de transformer une remise à zéro en progression : on perd une partie de l’atelier pour conserver un avantage qui accélère ou renouvelle le prochain cycle."
          ], table: {
            caption: "Différences usuelles entre les trois familles",
            headers: ["Terme", "Question utile", "Signe fréquent"],
            rows: [
              ["Clicker", "Que fait ma main ?", "Une action répétée produit directement"],
              ["Idle", "Que produit le système sans moi ?", "Automatisation et retours espacés"],
              ["Incrémental", "Comment la partie change-t-elle d’échelle ?", "Réinvestissement et nouvelles couches"],
            ],
          } },
          { title: "Comment choisir ?", paragraphs: [
            "Choisissez un clicker si vous aimez sentir chaque première amélioration et garder une action directe. Cherchez un idle game si vous préférez préparer une production puis revenir pour arbitrer. Orientez-vous vers un incrémental plus dense si la découverte de nouvelles couches, de synergies et de réinitialisations vous motive.",
            "Papers Empire se situe au croisement : le clic lance la presse, douze unités de production et d’optimisation développent l’atelier, et la réorganisation conserve de la culture pour le cycle suivant. Nous le décrivons donc comme un “idle incremental avec une ouverture clicker”."
          ] },
        ],
      },
      en: {
        slug: "idle-game-clicker-incremental-differences",
        title: "Idle game, clicker, or incremental game: what’s the difference?",
        description: "See how active clicking, automation, offline progress, and prestige differ across idle, clicker, and incremental browser games.",
        eyebrow: "PRODUCTION GLOSSARY · GUIDE 01",
        lead: "There is no single standardized boundary between these three labels. This editorial framework separates the clicker’s input, idle design’s relationship with time, and the incremental system’s growth into new layers.",
        imageAlt: "A manual press feeding an automated conveyor where stacks of paper grow, in the industrial Papers Empire style",
        readingMinutes: 6,
        card: "A practical way to separate clicking, automation, and layered progression.",
        sections: [
          { title: "The short answer", paragraphs: [
            "A <strong>clicker</strong> makes repeated input important. An <strong>idle game</strong> advances or runs a system with limited attention, at least while the session is running. An <strong>incremental game</strong> is built around reinvestment: numbers rise, but more importantly, new systems appear.",
            "These are overlapping lenses. Cookie Clicker begins with a click and builds automation. Universal Paperclips starts with manual clips, then shifts attention to machines, pricing, and further decisions. Papers Empire uses clicking as ignition before the automated workshop takes over."
          ] },
          { title: "Clicker: the gesture comes first", paragraphs: [
            "A clicker gives immediate cause and effect: one repeated action creates a resource or speeds up an outcome. That action may become less important later, but it defines the opening rhythm and often remains upgradeable.",
            "The word describes an interaction, not the whole design. A clicker can become mostly automated, add resets, and introduce several currencies while still fitting the label."
          ] },
          { title: "Idle: attention becomes a resource", paragraphs: [
            "An idle game asks you to configure a system that works without constant input. The pleasure is not an absence of decisions; it is their cadence—buy now, wait for a threshold, return to collect production, then redirect the machine.",
            "Idle does not automatically mean progress with the browser closed. Some games calculate elapsed time on return; others slow down or stop. An active tab, a hidden tab, and a closed browser are different states."
          ] },
          { title: "Incremental: the system changes scale", paragraphs: [
            "In an incremental game, each gain funds the next. You do more than accumulate one resource: producers, multipliers, currencies, or rules change how the run is understood.",
            "Prestige is common rather than mandatory. It turns a reset into progress by trading part of the current system for a persistent advantage in the next cycle."
          ], table: {
            caption: "Typical differences between the three families",
            headers: ["Label", "Useful question", "Common signal"],
            rows: [
              ["Clicker", "What does my hand do?", "Repeated input directly produces"],
              ["Idle", "What works without me?", "Automation and spaced-out returns"],
              ["Incremental", "How does the run change scale?", "Reinvestment and new layers"],
            ],
          } },
          { title: "Which one should you choose?", paragraphs: [
            "Pick a clicker if you enjoy feeling every early upgrade and keeping a direct action. Look for idle design if you would rather prepare production and return for decisions. Choose a denser incremental if discovering layers, synergies, and resets is the main appeal.",
            "Papers Empire sits at the intersection: clicks start the press, twelve production and optimization units develop the workshop, and reorganization carries culture into the next cycle. We therefore describe it as an “idle incremental with a clicker opening.”"
          ] },
        ],
      },
      de: {
        slug: "idle-game-clicker-incremental-unterschied",
        title: "Idle Game, Clicker oder Incremental Game: Was ist der Unterschied?",
        description: "So unterscheiden sich aktives Klicken, Automatisierung, Offline-Fortschritt und Prestige – mit Beispielen aus Browser-Spielen.",
        eyebrow: "PRODUKTIONSLEXIKON · GUIDE 01",
        lead: "Für diese drei Begriffe gibt es keine einheitlich normierte Grenze. Diese redaktionelle Einteilung trennt vor allem die Clicker-Eingabe, den Umgang von Idle Design mit Zeit und das Wachsen des Incremental-Systems.",
        imageAlt: "Eine manuelle Presse führt zu einem automatisierten Förderband mit wachsenden Papierstapeln im Industriestil von Papers Empire",
        readingMinutes: 7,
        card: "Eine praktische Abgrenzung von Klicken, Automatisierung und wachsender Spieltiefe.",
        sections: [
          { title: "Die kurze Antwort", paragraphs: [
            "Bei einem <strong>Clicker</strong> ist wiederholte Eingabe wichtig. Ein <strong>Idle Game</strong> lässt ein System mit wenig Aufmerksamkeit fortschreiten oder arbeiten, zumindest solange die Sitzung läuft. Ein <strong>Incremental Game</strong> lebt vom Reinvestieren: Zahlen wachsen und neue Systeme kommen hinzu.",
            "Das sind keine getrennten Schubladen. Cookie Clicker beginnt mit einem Klick und baut Automatisierung auf. Universal Paperclips startet mit manuellen Büroklammern und lenkt den Blick später auf Maschinen, Preise und weitere Entscheidungen. Bei Papers Empire ist der Klick der Startschuss für eine automatisierte Werkstatt."
          ] },
          { title: "Clicker: Die Handlung steht am Anfang", paragraphs: [
            "Ein Clicker zeigt Ursache und Wirkung sofort: Eine wiederholte Handlung erzeugt eine Ressource oder beschleunigt ein Ergebnis. Später kann sie an Bedeutung verlieren, prägt aber den Einstieg und lässt sich häufig verbessern.",
            "Der Begriff beschreibt eine Interaktion, nicht das gesamte Design. Auch ein weitgehend automatisiertes Spiel mit Resets und mehreren Währungen kann weiterhin ein Clicker sein."
          ] },
          { title: "Idle: Aufmerksamkeit wird zur Ressource", paragraphs: [
            "Ein Idle Game lässt ein eingerichtetes System ohne dauernde Eingabe arbeiten. Der Reiz liegt nicht im Fehlen von Entscheidungen, sondern in ihrem Takt: kaufen, auf eine Schwelle warten, zurückkehren und die Produktion neu ausrichten.",
            "Idle bedeutet nicht automatisch Fortschritt bei geschlossenem Browser. Manche Spiele berechnen die vergangene Zeit beim Zurückkehren, andere bremsen oder stoppen. Aktiver Tab, versteckter Tab und geschlossener Browser sind unterschiedliche Zustände."
          ] },
          { title: "Incremental: Das System wechselt die Größenordnung", paragraphs: [
            "In einem Incremental Game finanziert jeder Gewinn den nächsten. Produzenten, Multiplikatoren, Währungen oder Regeln verändern nach und nach, wie die Partie gelesen wird.",
            "Prestige ist verbreitet, aber nicht zwingend. Ein Reset wird zur Entwicklung, wenn ein Teil des aktuellen Fortschritts gegen einen dauerhaften Vorteil für den nächsten Zyklus getauscht wird."
          ], table: {
            caption: "Typische Unterschiede der drei Begriffe",
            headers: ["Begriff", "Hilfreiche Frage", "Häufiges Zeichen"],
            rows: [
              ["Clicker", "Was tut meine Hand?", "Wiederholte Eingabe produziert direkt"],
              ["Idle", "Was arbeitet ohne mich?", "Automatisierung und längere Pausen"],
              ["Incremental", "Wie ändert sich die Größenordnung?", "Reinvestition und neue Ebenen"],
            ],
          } },
          { title: "Was passt zu dir?", paragraphs: [
            "Ein Clicker passt, wenn jede frühe Verbesserung spürbar sein soll. Idle Design passt, wenn du Produktion vorbereiten und später Entscheidungen treffen möchtest. Ein dichteres Incremental lohnt sich, wenn neue Ebenen, Synergien und Resets das Ziel sind.",
            "Papers Empire liegt dazwischen: Klicks starten die Presse, zwölf Produktions- und Optimierungseinheiten entwickeln die Werkstatt, und eine Reorganisation nimmt Kultur in den nächsten Zyklus mit. Wir beschreiben es daher als “Idle Incremental mit Clicker-Einstieg”."
          ] },
        ],
      },
      lb: {
        slug: "idle-game-clicker-incremental-ennerscheed",
        title: "Idle Game, Clicker oder Incremental Game: Wat ass den Ënnerscheed?",
        description: "Dëse Guide erkläert Klicks, Automatiséierung, Offline-Fortschrëtt a Prestige mat Beispiller aus Browser-Spiller.",
        eyebrow: "PRODUKTIOUNSLEXIKON · GUIDE 01",
        lead: "Et gëtt keng eenzeg norméiert Grenz tëscht dësen dräi Begrëffer. Dës redaktionell Andeelung ënnerscheet virun allem d’Clicker-Aktioun, d’Relatioun vun Idle Design mat der Zäit an de Wuesstem vum Incremental-System.",
        imageAlt: "Eng manuell Press, déi an eng automatiséiert Linn mat wuessende Pabeierstapele féiert, am industrielle Stil vu Papers Empire",
        readingMinutes: 7,
        card: "Eng praktesch Erklärung vu Klicken, Automatiséierung an neie Spillschichten.",
        sections: [
          { title: "Déi kuerz Äntwert", paragraphs: [
            "Bei engem <strong>Clicker</strong> ass eng widderholl Aktioun wichteg. En <strong>Idle Game</strong> léisst e System mat wéineg Opmierksamkeet virugoen oder schaffen, op d’mannst wann d’Sessioun leeft. En <strong>Incremental Game</strong> baséiert op Reinvestitioun: d’Zuele klammen an nei Systemer kommen dobäi.",
            "Dat si keng getrennte Këschten. Cookie Clicker fänkt mat engem Klick un a baut Automatiséierung op. Universal Paperclips start mat manuelle Büroklameren a wiesselt duerno op Maschinnen, Präisser an aner Decisiounen. Bei Papers Empire ass de Klick den Ufank vun engem automatiséierten Atelier."
          ] },
          { title: "Clicker: D’Aktioun steet am Mëttelpunkt", paragraphs: [
            "E Clicker weist direkt Ursaach a Wierkung: eng widderholl Aktioun produzéiert eng Ressource oder beschleunegt e Resultat. Spéider ka si manner wichteg ginn, mee si bestëmmt den Ufank a ka meeschtens verbessert ginn.",
            "De Begrëff beschreift eng Interaktioun, net de ganzen Opbau. Och e staark automatiséiert Spill mat Resets a verschiddene Wärunge kann e Clicker bleiwen."
          ] },
          { title: "Idle: Opmierksamkeet gëtt eng Ressource", paragraphs: [
            "En Idle Game léisst en ageriichte System ouni permanent Aktioun schaffen. De Spaass kënnt net dovun, datt et keng Entscheedunge gëtt, mee aus hirem Rhythmus: kafen, waarden, zeréckkommen an d’Produktioun nei ausriichten.",
            "Idle bedeit net automatesch Fortschrëtt bei zouenem Browser. Verschidde Spiller rechnen d’Zäit beim Zeréckkommen, anerer bremsen oder stoppen. En aktiven Tab, e verstoppten Tab an e zouene Browser sinn dräi verschidden Zoustänn."
          ] },
          { title: "Incremental: De System wiesselt d’Gréisst", paragraphs: [
            "An engem Incremental Game finanzéiert all Gewënn deen nächsten. Produzenten, Multiplikatoren, Wärungen oder Regele veränneren no an no, wéi d’Partie funktionéiert.",
            "Prestige ass heefeg, mee net obligatoresch. E Reset gëtt zu Fortschrëtt, wann een en Deel vum aktuelle System géint e Virdeel fir den nächsten Zyklus tauscht."
          ], table: {
            caption: "Typesch Ënnerscheeder tëscht den dräi Begrëffer",
            headers: ["Begrëff", "Nëtzlech Fro", "Heefegt Zeechen"],
            rows: [
              ["Clicker", "Wat mécht meng Hand?", "Eng widderholl Aktioun produzéiert direkt"],
              ["Idle", "Wat schafft ouni mech?", "Automatiséierung a méi laang Pausen"],
              ["Incremental", "Wéi ännert sech de System?", "Reinvestitioun an nei Schichten"],
            ],
          } },
          { title: "Wat passt bei dech?", paragraphs: [
            "Wiel e Clicker, wann s du all fréi Verbesserung direkt spiere wëlls. En Idle Game passt, wann s du Produktioun virbereede wëlls an duerno fir Entscheedungen zeréckkënns. En déift Incremental passt, wann nei Schichten, Synergien a Resets dech motivéieren.",
            "Papers Empire läit an der Mëtt: Klicks starten d’Press, zwielef Produktiouns- an Optimisatiounseenheeten entwéckelen den Atelier, an eng Reorganisatioun hëlt Kultur an den nächste Zyklus mat. Mir beschreiwen et dofir als “Idle Incremental mat Clicker-Ufank”."
          ] },
        ],
      },
    },
  },
  {
    id: "browser-idle-selection",
    image: "/assets/images/guides/browser-idle-games.webp",
    datePublished: "2026-08-26",
    dateModified: "2026-08-26",
    sourcesCheckedAt: "2026-08-26",
    sources: [sharedSources.papers, sharedSources.papersDesign, sharedSources.paperclips, sharedSources.cookie, sharedSources.kittens, sharedSources.trimps, sharedSources.industry, sharedSources.evolve, sharedSources.evolveRepo],
    translations: {
      fr: {
        slug: "idle-games-navigateur-gestion",
        title: "7 idle games de navigateur pour ceux qui préfèrent gérer plutôt que cliquer",
        description: "Sept jeux idle et incrémentaux jouables dans le navigateur, choisis pour leurs décisions, leur automatisation et leurs systèmes de gestion.",
        eyebrow: "CATALOGUE DE L’ATELIER · GUIDE 02",
        lead: "Cette sélection n’est pas un classement. Elle réunit sept jeux officiels accessibles dans le navigateur, chacun avec une façon différente de transformer l’attente en décisions.",
        imageAlt: "Plusieurs ateliers industriels reliés représentant différentes façons de gérer une production idle dans l’univers de Papers Empire",
        readingMinutes: 8,
        card: "Sept expériences officielles où l’organisation compte davantage que la vitesse du clic.",
        sections: [
          { title: "Comment cette sélection a été construite", paragraphs: [
            "Nous avons retenu des versions web officielles qui donnent rapidement quelque chose à organiser : une chaîne de production, une colonie, une escouade, un marché ou une suite de décisions. Cette sélection documentaire s’appuie sur les présentations et dépôts officiels, pas sur un test chronométré de chaque arc complet.",
            "Les liens officiels ci-dessous ont été vérifiés à la date affichée dans les sources. La présence dans cette liste ne garantit ni progression navigateur fermé, ni compatibilité mobile, ni absence de publicité : ces points demandent un protocole séparé. L’ordre suit les thèmes du guide — usines, départ manuel, systèmes longs — et non une préférence."
          ] },
          { title: "Les sept ateliers", table: {
            caption: "Sept idle games de navigateur et leur centre de gravité",
            headers: ["Jeu", "Ce que vous gérez", "À choisir si…"],
            rows: [
              ["<a href=\"https://papersempire.com/\">Papers Empire</a>", "Une imprimerie, douze unités et une culture conservée après réorganisation", "vous voulez un thème industriel précis et une sauvegarde locale"],
              ["<a href=\"https://play.industryidle.com/\">Industry Idle</a>", "Usines, ressources, logistique et marché", "la chaîne industrielle et les arbitrages économiques vous attirent"],
              ["<a href=\"https://orteil.dashnet.org/cookieclicker/\">Cookie Clicker</a>", "Cookies, bâtiments, améliorations et production automatique", "vous acceptez une ouverture très clicker avant de gérer une économie automatisée"],
              ["<a href=\"https://www.decisionproblem.com/paperclips/index2.html\">Universal Paperclips</a>", "Trombones, prix, fil, machines et projets successifs", "vous aimez une interface minimale dont les enjeux se déplacent"],
              ["<a href=\"https://kittensgame.com/web/\">Kittens Game</a>", "Ressources, bâtiments et développement d’une civilisation féline", "vous aimez les systèmes denses et la planification patiente"],
              ["<a href=\"https://trimps.github.io/\">Trimps</a>", "Ressources, équipement et progression d’une expédition", "vous voulez mêler automatisation et montée en puissance d’une équipe"],
              ["<a href=\"https://pmotschmann.github.io/Evolve/\">Evolve</a>", "Une civilisation et des couches de progression à grande échelle", "vous cherchez une longue exploration de systèmes imbriqués"],
            ],
          } },
          { title: "Pour une usine : Papers Empire ou Industry Idle", paragraphs: [
            "Papers Empire met en scène une imprimerie qui passe du geste manuel à douze unités de production et d’optimisation, avec une vue de campus et un cycle de réorganisation. Industry Idle se concentre plus directement sur le réseau d’usines, les ressources et le marché. Le premier délimite un thème précis ; le second ouvre une économie industrielle plus large.",
            "Nicolas Pieper crée Papers Empire : cette proximité est la raison pour laquelle nous ne lui attribuons ni rang ni note. Sa sauvegarde reste locale et son hors-ligne est réduit à 50 %, avec un plafond de huit heures."
          ] },
          { title: "Pour un départ manuel : Cookie Clicker ou Universal Paperclips", paragraphs: [
            "Les deux commencent par une action répétée très claire, puis donnent progressivement plus de place à l’automatisation. Cookie Clicker garde les bâtiments et améliorations au centre d’une économie de cookies ; Universal Paperclips déplace davantage le cadre et les décisions au fil des seuils.",
            "Choisissez Cookie Clicker si vous aimez conserver un geste actif identifiable. Essayez Universal Paperclips si une interface sobre qui révèle peu à peu sa vraie taille vous attire davantage."
          ] },
          { title: "Pour les systèmes longs : Kittens Game, Trimps ou Evolve", paragraphs: [
            "Kittens Game transforme une petite production de ressources en civilisation. Trimps relie récolte, équipement et expédition. Evolve étend progressivement une civilisation sur de nombreuses couches. Ces trois choix demandent davantage de patience et récompensent le plaisir de comprendre des interactions plutôt que celui de terminer vite.",
            "Commencez par celui dont le thème vous donne envie de revenir. Dans un idle game, la cadence de retour compte autant que la quantité de contenu : le bon jeu est celui dont les prochaines décisions restent lisibles."
          ] },
        ],
      },
      en: {
        slug: "browser-idle-games-for-management",
        title: "7 browser idle games for players who would rather manage than click",
        description: "Seven official browser idle and incremental games selected for meaningful decisions, automation, and management systems rather than click speed.",
        eyebrow: "WORKSHOP CATALOGUE · GUIDE 02",
        lead: "This is a selection, not a ranking. These seven official browser games turn waiting into different kinds of decisions—from production lines and markets to settlements and expeditions.",
        imageAlt: "Connected industrial workshops representing different ways to manage idle production in the Papers Empire visual world",
        readingMinutes: 7,
        card: "Seven official experiences where organization matters more than clicking fast.",
        sections: [
          { title: "How the selection was made", paragraphs: [
            "Each official web version gives you something meaningful to organize early: a production chain, colony, squad, market, or sequence of choices. This documentary selection uses official presentations and repositories rather than timed testing of every complete arc.",
            "The official links below were checked on the date shown in the sources. Inclusion does not promise closed-browser progress, mobile support, or an ad-free experience; those claims need a separate, repeatable test. The order follows the guide’s themes—factories, manual openings, then long systems—not a preference."
          ] },
          { title: "Seven workshops", table: {
            caption: "Seven browser idle games and what each asks you to manage",
            headers: ["Game", "What you manage", "Choose it if…"],
            rows: [
              ["<a href=\"https://papersempire.com/en/\">Papers Empire</a>", "A printworks, twelve units, and culture carried through reorganization", "you want a focused industrial theme and a local save"],
              ["<a href=\"https://play.industryidle.com/\">Industry Idle</a>", "Factories, resources, logistics, and a market", "industrial chains and economic trade-offs are the appeal"],
              ["<a href=\"https://orteil.dashnet.org/cookieclicker/\">Cookie Clicker</a>", "Cookies, buildings, upgrades, and automated output", "you accept a strongly clicker-led opening before managing an automated economy"],
              ["<a href=\"https://www.decisionproblem.com/paperclips/index2.html\">Universal Paperclips</a>", "Clips, price, wire, machines, and successive projects", "you like a minimal interface whose priorities keep shifting"],
              ["<a href=\"https://kittensgame.com/web/\">Kittens Game</a>", "Resources, buildings, and a growing feline civilization", "you enjoy dense systems and patient planning"],
              ["<a href=\"https://trimps.github.io/\">Trimps</a>", "Resources, equipment, and an expedition’s progress", "you want automation mixed with squad growth"],
              ["<a href=\"https://pmotschmann.github.io/Evolve/\">Evolve</a>", "A civilization and large-scale progression layers", "you want a long exploration of interlocking systems"],
            ],
          } },
          { title: "For a factory: Papers Empire or Industry Idle", paragraphs: [
            "Papers Empire frames the journey as a print shop growing from manual input to twelve production and optimization units, with a visible campus and reorganization cycle. Industry Idle focuses more directly on factory networks, resources, and the market. One defines a focused setting; the other opens a broader industrial economy.",
            "Nicolas Pieper is the creator of Papers Empire, which is why it receives neither a rank nor a score here. Its save is local only, and offline output runs at 50% with an eight-hour cap."
          ] },
          { title: "For a manual opening: Cookie Clicker or Universal Paperclips", paragraphs: [
            "Both begin with an unmistakable repeated action, then give automation more room. Cookie Clicker keeps buildings and upgrades at the center of a cookie economy; Universal Paperclips shifts its frame and decision set more dramatically as thresholds are reached.",
            "Choose Cookie Clicker if you enjoy keeping a recognizable active gesture. Try Universal Paperclips if a sparse interface that slowly reveals its true scale sounds more appealing."
          ] },
          { title: "For long systems: Kittens Game, Trimps, or Evolve", paragraphs: [
            "Kittens Game grows resource gathering into civilization. Trimps connects harvesting, equipment, and expedition. Evolve extends a civilization through many layers. All three emphasize understanding interactions over reaching a quick ending.",
            "Start with the theme that makes you want to return. In an idle game, return cadence matters as much as content volume: the right one keeps the next decision legible."
          ] },
        ],
      },
      de: {
        slug: "browser-idle-games-fuer-manager",
        title: "7 Browser-Idle-Games für alle, die lieber verwalten als klicken",
        description: "Sieben offizielle Idle- und Incremental Games im Browser, ausgewählt wegen Entscheidungen, Automatisierung und Management statt Klicktempo.",
        eyebrow: "WERKSTATTKATALOG · GUIDE 02",
        lead: "Das ist eine Auswahl, keine Rangliste. Sieben offizielle Browser-Spiele verwandeln Wartezeit in ganz unterschiedliche Entscheidungen – von Produktionslinien bis zu Siedlungen.",
        imageAlt: "Verbundene industrielle Werkstätten für unterschiedliche Arten von Idle-Management in der Bildwelt von Papers Empire",
        readingMinutes: 8,
        card: "Sieben offizielle Spiele, in denen Organisation wichtiger ist als schnelles Klicken.",
        sections: [
          { title: "So entstand die Auswahl", paragraphs: [
            "Jede offizielle Webversion bietet früh etwas Sinnvolles zum Organisieren: Produktionskette, Kolonie, Gruppe, Markt oder eine Folge von Entscheidungen. Diese dokumentarische Auswahl stützt sich auf offizielle Präsentationen und Repositories, nicht auf zeitlich gemessene Komplettdurchläufe.",
            "Die offiziellen Links unten wurden an dem bei den Quellen angegebenen Datum geprüft. Die Aufnahme verspricht weder Fortschritt bei geschlossenem Browser noch Mobile-Support oder Werbefreiheit; dafür wäre ein eigener, wiederholbarer Test nötig. Die Reihenfolge folgt den Themen Fabriken, manueller Einstieg und lange Systeme, nicht einer Wertung."
          ] },
          { title: "Sieben Werkstätten", table: {
            caption: "Sieben Browser-Idle-Games und ihr Management-Schwerpunkt",
            headers: ["Spiel", "Was du verwaltest", "Wähle es, wenn…"],
            rows: [
              ["<a href=\"https://papersempire.com/de/\">Papers Empire</a>", "Eine Druckerei, zwölf Einheiten und Kultur nach der Reorganisation", "du ein fokussiertes Industriethema und einen lokalen Spielstand willst"],
              ["<a href=\"https://play.industryidle.com/\">Industry Idle</a>", "Fabriken, Ressourcen, Logistik und Markt", "industrielle Ketten und wirtschaftliche Abwägungen reizen"],
              ["<a href=\"https://orteil.dashnet.org/cookieclicker/\">Cookie Clicker</a>", "Cookies, Gebäude, Verbesserungen und automatische Produktion", "du einen starken Clicker-Einstieg vor einer automatisierten Wirtschaft akzeptierst"],
              ["<a href=\"https://www.decisionproblem.com/paperclips/index2.html\">Universal Paperclips</a>", "Büroklammern, Preis, Draht, Maschinen und Projekte", "du eine minimale Oberfläche mit wechselnden Prioritäten magst"],
              ["<a href=\"https://kittensgame.com/web/\">Kittens Game</a>", "Ressourcen, Gebäude und eine Katzenzivilisation", "dichte Systeme und geduldige Planung dein Ding sind"],
              ["<a href=\"https://trimps.github.io/\">Trimps</a>", "Ressourcen, Ausrüstung und eine Expedition", "du Automatisierung mit Gruppenfortschritt verbinden willst"],
              ["<a href=\"https://pmotschmann.github.io/Evolve/\">Evolve</a>", "Eine Zivilisation und großflächige Fortschrittsebenen", "du lange, ineinandergreifende Systeme erkunden möchtest"],
            ],
          } },
          { title: "Für eine Fabrik: Papers Empire oder Industry Idle", paragraphs: [
            "Papers Empire erzählt den Weg einer Druckerei vom manuellen Start bis zu zwölf Produktions- und Optimierungseinheiten, sichtbarem Campus und Reorganisation. Industry Idle konzentriert sich direkter auf Fabriknetzwerke, Ressourcen und Markt. Das eine setzt einen fokussierten Rahmen, das andere öffnet eine breitere industrielle Wirtschaft.",
            "Nicolas Pieper ist der Schöpfer von Papers Empire. Deshalb erhält das Spiel hier weder Platzierung noch Note. Sein Spielstand bleibt lokal und die Offline-Produktion läuft mit 50 % bis zu acht Stunden."
          ] },
          { title: "Für einen manuellen Start: Cookie Clicker oder Universal Paperclips", paragraphs: [
            "Beide beginnen mit einer klaren, wiederholten Handlung und geben der Automatisierung danach mehr Raum. Bei Cookie Clicker bleiben Gebäude und Verbesserungen im Zentrum einer Cookie-Wirtschaft; Universal Paperclips verschiebt Rahmen und Entscheidungen an seinen Schwellen stärker.",
            "Cookie Clicker passt, wenn eine erkennbare aktive Handlung erhalten bleiben soll. Universal Paperclips passt, wenn eine sparsame Oberfläche ihre tatsächliche Größe erst nach und nach zeigen darf."
          ] },
          { title: "Für lange Systeme: Kittens Game, Trimps oder Evolve", paragraphs: [
            "Kittens Game erweitert Ressourcensammlung zur Zivilisation. Trimps verbindet Ernte, Ausrüstung und Expedition. Evolve führt eine Zivilisation durch zahlreiche Ebenen. Alle drei belohnen das Verstehen von Zusammenhängen stärker als ein schnelles Ende.",
            "Beginne mit dem Thema, das dich zurückkehren lässt. Bei Idle Games ist der Rückkehr-Rhythmus genauso wichtig wie die Menge an Inhalt."
          ] },
        ],
      },
      lb: {
        slug: "browser-idle-games-fir-manager",
        title: "7 Browser-Idle-Games fir Leit, déi léiwer geréieren ewéi klicken",
        description: "Siwen offiziell Idle- an Incremental Games am Browser, ausgewielt wéinst Entscheedungen, Automatiséierung a Management amplaz Klicktempo.",
        eyebrow: "ATELIER-KATALOG · GUIDE 02",
        lead: "Dat hei ass eng Auswiel, kee Klassement. Siwen offiziell Browser-Spiller maachen aus Waardezäit ganz verschidden Entscheedungen – vu Produktiounslinne bis zu Siedlungen.",
        imageAlt: "Verbonnen industriell Atelieren, déi verschidden Aarte vun Idle-Management an der Bildwelt vu Papers Empire weisen",
        readingMinutes: 8,
        card: "Siwen offiziell Spiller, bei deenen Organisatioun méi wichteg ass wéi séier klicken.",
        sections: [
          { title: "Wéi dës Auswiel entstanen ass", paragraphs: [
            "All offiziell Webversioun gëtt engem séier eppes Sënnvolles ze geréieren: eng Produktiounskette, eng Kolonie, eng Ekipp, e Marché oder eng Rei Entscheedungen. Dës dokumentaresch Auswiel baséiert op offizielle Presentatiounen a Repositories, net op gemoossene komplette Partien.",
            "Déi offiziell Linken hei ënne goufen op deem Datum kontrolléiert, deen an de Quelle steet. D’Auswiel versprécht kee Fortschrëtt bei zouenem Browser, keng mobil Ënnerstëtzung a keng Reklammfräiheet; dofir brauch een en eegene reproduzéierbaren Test. D’Reiefolleg follegt de Sujeten Fabricken, manuellen Ufank a laang Systemer, net enger Bewäertung."
          ] },
          { title: "Déi siwen Atelieren", table: {
            caption: "Siwen Browser-Idle-Games an hire Management-Schwéierpunkt",
            headers: ["Spill", "Wat s du geréiers", "Wiel et, wann…"],
            rows: [
              ["<a href=\"https://papersempire.com/lb/\">Papers Empire</a>", "Eng Dréckerei, zwielef Eenheeten a Kultur no der Reorganisatioun", "s du e kloert Industriethema an eng lokal Späicherung wëlls"],
              ["<a href=\"https://play.industryidle.com/\">Industry Idle</a>", "Fabricken, Ressourcen, Logistik an e Marché", "Industrieketten a wirtschaftlech Entscheedungen dech interesséieren"],
              ["<a href=\"https://orteil.dashnet.org/cookieclicker/\">Cookie Clicker</a>", "Cookies, Gebaier, Verbesserungen an automatesch Produktioun", "s du e staarke Clicker-Ufank virun enger automatiséierter Ekonomie akzeptéiers"],
              ["<a href=\"https://www.decisionproblem.com/paperclips/index2.html\">Universal Paperclips</a>", "Büroklameren, Präis, Drot, Maschinnen a Projeten", "s du eng minimalistesch Uewerfläch mat neie Prioritéite gär hues"],
              ["<a href=\"https://kittensgame.com/web/\">Kittens Game</a>", "Ressourcen, Gebaier an eng Kazen-Zivilisatioun", "s du déif Systemer a gedëlleg Planung gär hues"],
              ["<a href=\"https://trimps.github.io/\">Trimps</a>", "Ressourcen, Ausrüstung an eng Expeditioun", "s du Automatiséierung mat enger Ekipp verbannen wëlls"],
              ["<a href=\"https://pmotschmann.github.io/Evolve/\">Evolve</a>", "Eng Zivilisatioun a grouss Fortschrëttsschichten", "s du laang verbonne Systemer entdecke wëlls"],
            ],
          } },
          { title: "Fir eng Fabrick: Papers Empire oder Industry Idle", paragraphs: [
            "Papers Empire weist eng Dréckerei vum manuelle Start bis zu zwielef Produktiouns- an Optimisatiounseenheeten, engem siichtbare Campus an enger Reorganisatioun. Industry Idle konzentréiert sech méi direkt op Fabricksnetzer, Ressourcen an de Marché. Dat eent setzt e kloere Kader, dat anert mécht eng méi breet Industrieekonomie op.",
            "Nicolas Pieper ass de Schëpfer vu Papers Empire. Dofir kritt d’Spill hei keng Plaz a keng Note. Seng Späicherung bleift lokal an d’Offline-Produktioun leeft mat 50 % bis maximal aacht Stonnen."
          ] },
          { title: "Fir e manuellen Ufank: Cookie Clicker oder Universal Paperclips", paragraphs: [
            "Béid fänke mat enger kloer widderhuelter Aktioun un a ginn der Automatiséierung duerno méi Plaz. Bei Cookie Clicker bleiwen d’Gebaier an d’Verbesserungen am Zentrum vun enger Cookie-Ekonomie; Universal Paperclips verréckelt säi Kader a seng Entscheedunge méi staark.",
            "Cookie Clicker passt, wann eng aktiv Handlung erkennbar bleiwe soll. Universal Paperclips passt, wann eng einfach Uewerfläch hir richteg Gréisst eréischt no an no soll weisen."
          ] },
          { title: "Fir laang Systemer: Kittens Game, Trimps oder Evolve", paragraphs: [
            "Kittens Game mécht aus Ressourcensammelen eng Zivilisatioun. Trimps verbënnt Ressourcen, Ausrüstung an Expeditioun. Evolve féiert eng Zivilisatioun duerch vill Schichten. Déi dräi belounen d’Verstoen vun Zesummenhäng méi wéi e séiert Enn.",
            "Fänk mat deem Thema un, dat dech zeréckkomme léisst. Bei engem Idle Game ass de Rhythmus vum Zeréckkommen esou wichteg wéi d’Quantitéit vum Inhalt."
          ] },
        ],
      },
    },
  },
  {
    id: "papers-vs-paperclips",
    image: "/assets/images/guides/papers-empire-vs-paperclips.webp",
    datePublished: "2026-08-26",
    dateModified: "2026-08-26",
    sourcesCheckedAt: "2026-08-26",
    sources: [sharedSources.papers, sharedSources.papersDesign, sharedSources.paperclips, sharedSources.paperclipsCreator],
    translations: {
      fr: {
        slug: "papers-empire-universal-paperclips-deux-philosophies",
        title: "Papers Empire ou Universal Paperclips : deux empires de papier, deux philosophies",
        description: "Comparaison sans gros spoilers entre Papers Empire et Universal Paperclips : départ, automatisation, décisions, présentation et type de progression.",
        eyebrow: "FACE-À-FACE INDUSTRIEL · GUIDE 03",
        lead: "Les deux jeux partent d’un objet de bureau et d’une action simple. Papers Empire développe une imprimerie illustrée ; Universal Paperclips révèle progressivement de nouveaux systèmes dans une interface textuelle minimale.",
        imageAlt: "Deux empires de papier opposés, une imprimerie chaleureuse et une machine abstraite à trombones, dans une composition industrielle",
        readingMinutes: 7,
        card: "Un comparatif sans score pour choisir entre atelier industriel et surprise systémique.",
        sections: [
          { title: "À qui s’adresse chaque jeu ?", paragraphs: [
            "Choisissez <strong>Papers Empire</strong> si vous voulez voir une imprimerie évoluer, suivre ses unités, retrouver une partie sauvegardée localement entre deux sessions, puis préparer une réorganisation. Choisissez <strong>Universal Paperclips</strong> si vous préférez une interface textuelle minimale et une progression qui révèle peu à peu de nouveaux systèmes.",
            "Il n’y a pas de vainqueur global. Nicolas Pieper est le créateur de Papers Empire. Cette comparaison documentaire confronte les mécaniques visibles et les descriptions officielles vérifiées à la date indiquée dans les sources, sans prétendre mesurer deux parties complètes ni attribuer une note neutre."
          ] },
          { title: "Même point de départ, sensations différentes", paragraphs: [
            "Papers Empire commence devant une presse : le premier clic produit un document, puis les unités rendent le flux automatique. Le décor, les panneaux et les objectifs nomment clairement l’atelier que vous construisez.",
            "Universal Paperclips commence par un bouton pour fabriquer un trombone. Les libellés restent sobres et de nouvelles possibilités apparaissent quand certaines conditions sont atteintes. Le plaisir tient autant à ce qui n’est pas encore visible qu’à l’optimisation présente."
          ] },
          { title: "Ce que l’on automatise", table: {
            caption: "Deux approches de l’automatisation industrielle",
            headers: ["Dimension", "Papers Empire", "Universal Paperclips"],
            rows: [
              ["Objet initial", "Documents imprimés", "Trombones"],
              ["Premier passage à l’échelle", "Unités de production", "AutoClippers"],
              ["Décisions visibles", "Achats, améliorations, contrats, réorganisation", "Prix, fil, machines, calcul et projets"],
              ["Présentation", "Atelier illustré et campus", "Interface textuelle minimale"],
              ["Promesse de progression", "Développer douze unités, de la reprographie à l’IA Pampy Print", "Découvrir des phases successives sans en révéler ici la portée"],
            ],
          } },
          { title: "Le rapport au temps", paragraphs: [
            "Papers Empire crédite 50 % de la cadence nominale après une absence d’au moins 60 secondes, dans la limite de huit heures. La sauvegarde utilise le stockage local du navigateur, sans compte, cloud ni transfert automatique entre appareils, et le résultat est affiché au retour.",
            "Pour Universal Paperclips, cette comparaison ne promet pas de gains navigateur fermé : la version web officielle doit être jugée sur son propre comportement. Son rythme vient surtout de seuils qui ouvrent de nouvelles décisions et de l’équilibre entre production, matière et demande."
          ] },
          { title: "Deux trajectoires de progression", paragraphs: [
            "Papers Empire rend sa direction explicite : transformer une imprimerie en chaîne automatisée, déployer douze unités de production et d’optimisation, puis commencer un nouveau cycle avec la culture conservée après une réorganisation.",
            "Universal Paperclips révèle sa trajectoire par étapes. Il commence par un système d’optimisation compact, puis ajoute de nouveaux systèmes lorsque certaines conditions sont remplies. Papers Empire montre davantage ses prochains objectifs ; Universal Paperclips laisse une plus grande part de sa progression à découvrir."
          ] },
          { title: "Deux profils, deux limites", paragraphs: [
            "Papers Empire convient aux joueurs qui veulent une usine illustrée et des sessions espacées ; sa production hors ligne est calculée à 50 % après au moins une minute d’absence et plafonnée à huit heures. Universal Paperclips convient aux joueurs qui recherchent une progression fondée sur la découverte : Frank Lantz l’annonce comme une expérience de 4 à 6 heures, et la page officielle précise que la version web n’a pas été conçue pour les téléphones."
          ] },
        ],
      },
      en: {
        slug: "papers-empire-vs-universal-paperclips-two-philosophies",
        title: "Papers Empire vs Universal Paperclips: two paper empires, two philosophies",
        description: "A low-spoiler comparison of Papers Empire and Universal Paperclips: openings, automation, decisions, presentation, and progression style.",
        eyebrow: "INDUSTRIAL HEAD-TO-HEAD · GUIDE 03",
        lead: "Both games begin with an office object and a simple action. Papers Empire develops an illustrated print shop; Universal Paperclips gradually reveals new systems through a minimal text interface.",
        imageAlt: "Two opposing paper empires, a warm print factory and an abstract paperclip machine, in an industrial composition",
        readingMinutes: 6,
        card: "A score-free comparison between an industrial workshop and systemic surprise.",
        sections: [
          { title: "Which player is each game for?", paragraphs: [
            "Choose <strong>Papers Empire</strong> if you want to watch a print shop grow, track its units, return to a locally saved run between sessions, and prepare for reorganization. Choose <strong>Universal Paperclips</strong> if you prefer a minimal text interface and progression that gradually reveals new systems.",
            "There is no overall winner. Nicolas Pieper is the creator of Papers Empire. This documentary comparison covers visible mechanics and official descriptions checked on the date shown in the sources; it does not claim two complete measured playthroughs or a neutral score."
          ] },
          { title: "Similar openings, different sensations", paragraphs: [
            "Papers Empire opens at a press: the first click makes a document, then production units automate the flow. Scenery, panels, and objectives explicitly name the workshop you are building.",
            "Universal Paperclips begins with a button that makes one clip. Labels stay sparse and more possibilities appear when conditions are met. The appeal lies as much in what is not yet visible as in present optimization."
          ] },
          { title: "What becomes automated", table: {
            caption: "Two approaches to industrial automation",
            headers: ["Dimension", "Papers Empire", "Universal Paperclips"],
            rows: [
              ["Initial object", "Printed documents", "Paperclips"],
              ["First scaling step", "Production units", "AutoClippers"],
              ["Visible decisions", "Purchases, upgrades, contracts, reorganization", "Price, wire, machines, computing, and projects"],
              ["Presentation", "Illustrated workshop and campus", "Minimal text interface"],
              ["Progression promise", "Develop twelve units from reprographics to Pampy Print AI", "Discover successive phases whose reach is best left unspoiled"],
            ],
          } },
          { title: "Their relationship with time", paragraphs: [
            "Papers Empire credits 50% of the nominal rate after an absence of at least 60 seconds, capped at eight hours. The save uses local browser storage, with no account, cloud save, or automatic cross-device transfer, and reports the result on return.",
            "This comparison makes no closed-browser claim for Universal Paperclips; its official web version should be judged on its own behavior. Its rhythm comes from thresholds that reveal decisions and from balancing output, material, and demand."
          ] },
          { title: "Two progression paths", paragraphs: [
            "Papers Empire makes its direction explicit: turn a print shop into an automated production chain, deploy twelve production and optimization units, then begin another cycle while retaining culture after reorganization.",
            "Universal Paperclips reveals its path in stages. It begins as a compact optimization system, then adds new systems as conditions are met. Papers Empire exposes more of its next objectives; Universal Paperclips leaves more of its progression to be discovered."
          ] },
          { title: "Two profiles, two limitations", paragraphs: [
            "Papers Empire suits players who want an illustrated factory and spaced-out sessions; its offline production runs at 50% after at least one minute away and is capped at eight hours. Universal Paperclips suits players looking for progression built around discovery: Frank Lantz describes it as a four-to-six-hour experience, and the official page says the web version was not designed for phones."
          ] },
        ],
      },
      de: {
        slug: "papers-empire-universal-paperclips-zwei-philosophien",
        title: "Papers Empire vs. Universal Paperclips: zwei Papierimperien, zwei Ideen",
        description: "Spoilerarmer Vergleich von Papers Empire und Universal Paperclips: Einstieg, Automatisierung, Entscheidungen, Darstellung und Fortschritt.",
        eyebrow: "INDUSTRIELLES DUELL · GUIDE 03",
        lead: "Beide Spiele beginnen mit einem Bürogegenstand und einer einfachen Handlung. Papers Empire entwickelt eine illustrierte Druckerei; Universal Paperclips zeigt nach und nach neue Systeme in einer reduzierten Textoberfläche.",
        imageAlt: "Zwei gegensätzliche Papierimperien, eine warme Druckfabrik und eine abstrakte Büroklammermaschine in industrieller Komposition",
        readingMinutes: 7,
        card: "Ein Vergleich ohne Punktzahl: Industriewerkstatt oder systemische Überraschung.",
        sections: [
          { title: "Für wen passt welches Spiel?", paragraphs: [
            "Wähle <strong>Papers Empire</strong>, wenn du eine Druckerei wachsen sehen, ihre Einheiten im Blick behalten, zwischen Sitzungen zu einem lokal gespeicherten Spielstand zurückkehren und eine Reorganisation vorbereiten möchtest. Wähle <strong>Universal Paperclips</strong>, wenn du eine reduzierte Textoberfläche und einen Fortschritt bevorzugst, der nach und nach neue Systeme sichtbar macht.",
            "Einen Gesamtsieger gibt es nicht. Nicolas Pieper ist der Schöpfer von Papers Empire. Dieser dokumentarische Vergleich betrachtet sichtbare Mechaniken und offizielle Beschreibungen, geprüft an dem bei den Quellen angegebenen Datum; er behauptet weder zwei vollständig gemessene Partien noch eine neutrale Punktzahl."
          ] },
          { title: "Ähnlicher Start, anderes Gefühl", paragraphs: [
            "Papers Empire startet an einer Presse: Der erste Klick druckt ein Dokument, danach automatisieren Produktionseinheiten den Fluss. Kulisse, Anzeigen und Ziele benennen die entstehende Werkstatt klar.",
            "Universal Paperclips beginnt mit einem Knopf für eine Büroklammer. Die Beschriftung bleibt sparsam und weitere Möglichkeiten erscheinen bei bestimmten Bedingungen. Der Reiz liegt auch in dem, was noch nicht sichtbar ist."
          ] },
          { title: "Was automatisiert wird", table: {
            caption: "Zwei Ansätze für industrielle Automatisierung",
            headers: ["Dimension", "Papers Empire", "Universal Paperclips"],
            rows: [
              ["Ausgangsobjekt", "Gedruckte Dokumente", "Büroklammern"],
              ["Erste Skalierung", "Produktionseinheiten", "AutoClippers"],
              ["Sichtbare Entscheidungen", "Käufe, Verbesserungen, Verträge, Reorganisation", "Preis, Draht, Maschinen, Rechenleistung und Projekte"],
              ["Darstellung", "Illustrierte Werkstatt und Campus", "Minimale Textoberfläche"],
              ["Fortschrittsversprechen", "Zwölf Einheiten von der Reprografie bis zur Pampy-Print-KI", "Aufeinanderfolgende Phasen entdecken, deren Reichweite hier nicht verraten wird"],
            ],
          } },
          { title: "Der Umgang mit Zeit", paragraphs: [
            "Papers Empire schreibt nach mindestens 60 Sekunden Abwesenheit 50 % der normalen Rate gut, begrenzt auf acht Stunden. Der Spielstand liegt lokal im Browser, ohne Konto, Cloud-Speicherung oder automatische Übertragung zwischen Geräten; das Ergebnis erscheint bei der Rückkehr.",
            "Für Universal Paperclips macht dieser Vergleich keine Aussage über einen geschlossenen Browser. Der Rhythmus der offiziellen Webversion entsteht vor allem durch Schwellen, neue Entscheidungen und das Verhältnis von Produktion, Material und Nachfrage."
          ] },
          { title: "Zwei Wege des Fortschritts", paragraphs: [
            "Papers Empire macht seine Richtung deutlich: eine Druckerei zu einer automatisierten Produktionskette ausbauen, zwölf Produktions- und Optimierungseinheiten einsetzen und nach einer Reorganisation mit erhaltener Kultur einen neuen Zyklus beginnen.",
            "Universal Paperclips zeigt seinen Weg schrittweise. Es beginnt als kompaktes Optimierungssystem und ergänzt neue Systeme, sobald bestimmte Bedingungen erfüllt sind. Papers Empire macht die nächsten Ziele früher sichtbar; bei Universal Paperclips bleibt mehr vom Fortschritt zu entdecken."
          ] },
          { title: "Zwei Spielertypen, zwei Einschränkungen", paragraphs: [
            "Papers Empire passt zu Spielern, die eine illustrierte Fabrik und Sitzungen mit längeren Pausen möchten; die Offline-Produktion läuft nach mindestens einer Minute Abwesenheit mit 50 Prozent und ist auf acht Stunden begrenzt. Universal Paperclips passt zu Spielern, die Fortschritt vor allem durch Entdeckung erleben möchten: Frank Lantz beschreibt es als vier- bis sechsstündige Erfahrung, und die offizielle Seite weist darauf hin, dass die Webversion nicht für Smartphones entwickelt wurde."
          ] },
        ],
      },
      lb: {
        slug: "papers-empire-universal-paperclips-zwou-philosophien",
        title: "Papers Empire an Universal Paperclips: zwee Pabeiersräicher, zwou Iddien",
        description: "E spoilerarme Verglach vu Papers Empire an Universal Paperclips: Ufank, Automatiséierung, Entscheedungen, Presentatioun a Fortschrëtt.",
        eyebrow: "INDUSTRIELLEN DUELL · GUIDE 03",
        lead: "Béid Spiller fänke mat Büromaterial an enger einfacher Aktioun un. Papers Empire entwéckelt eng illustréiert Dréckerei; Universal Paperclips weist no an no nei Systemer an enger minimalistescher Text-Uewerfläch.",
        imageAlt: "Zwee géigesätzlech Pabeiersräicher, eng waarm Dréckerei an eng abstrakt Büroklamer-Maschinn an enger industrieller Kompositioun",
        readingMinutes: 7,
        card: "E Verglach ouni Punkten: Industrieatelier oder systemesch Iwwerraschung.",
        sections: [
          { title: "Fir wéi ee Spillertyp passt wéi ee Spill?", paragraphs: [
            "Wiel <strong>Papers Empire</strong>, wann s du eng Dréckerei wuesse gesi wëlls, hir Eenheeten am Bléck behale wëlls, tëscht de Sessiounen op e lokal gespäicherte Spillstand zeréckkomme wëlls an eng Reorganisatioun virbereede wëlls. Wiel <strong>Universal Paperclips</strong>, wann s du eng minimalistesch Text-Uewerfläch an e Fortschrëtt léiwer hues, deen no an no nei Systemer weist.",
            "Et gëtt kee globale Gewënner. Nicolas Pieper ass de Schëpfer vu Papers Empire. Dësen dokumentaresche Verglach kuckt op siichtbar Mechaniken an offiziell Beschreiwungen, déi um Datum an de Quelle kontrolléiert goufen; e behaapt weder zwou komplett gemoosse Partien nach eng neutral Punktzuel."
          ] },
          { title: "Änlechen Ufank, anert Gefill", paragraphs: [
            "Papers Empire start bei enger Press: Den éischte Klick dréckt en Dokument, duerno automatiséiere Produktiounseenheeten de Flux. Kuliss, Instrumenter an Ziler nennen den Atelier ganz kloer.",
            "Universal Paperclips fänkt mat engem Knäppche fir eng Büroklamer un. D’Uewerfläch bleift spuersam an nei Méiglechkeeten erschéngen, wann d’Konditioune passen. De Reiz läit och an deem, wat nach net ze gesinn ass."
          ] },
          { title: "Wat automatiséiert gëtt", table: {
            caption: "Zwou Aarte vun industrieller Automatiséierung",
            headers: ["Dimensioun", "Papers Empire", "Universal Paperclips"],
            rows: [
              ["Éischten Objet", "Gedréckten Dokumenter", "Büroklameren"],
              ["Éischt Skala", "Produktiounseenheeten", "AutoClippers"],
              ["Siichtbar Entscheedungen", "Akeef, Verbesserungen, Kontrakter, Reorganisatioun", "Präis, Drot, Maschinnen, Recheleeschtung a Projeten"],
              ["Presentatioun", "Illustréierten Atelier a Campus", "Minimal Text-Uewerfläch"],
              ["Fortschrëtt", "Zwielef Eenheete vun der Reprographie bis bei d’Pampy-Print-KI", "Nei Phasen entdecken, ouni hir Reechwäit hei ze verroden"],
            ],
          } },
          { title: "D’Relatioun mat der Zäit", paragraphs: [
            "Papers Empire schreift no mindestens 60 Sekonnen Ofwiesenheet 50 % vum normale Rhythmus gutt, bis maximal aacht Stonnen. D’Späicherung läit lokal am Browser, ouni Kont, Cloud oder automateschen Transfert tëscht Apparater; d’Resultat gëtt beim Zeréckkommen gewisen.",
            "Fir Universal Paperclips mécht dëse Verglach keng Ausso iwwer e zouene Browser. De Rhythmus vun der offizieller Webversioun kënnt virun allem vu Schwellen, neien Entscheedungen an der Balance tëscht Produktioun, Material an Demande."
          ] },
          { title: "Zwee Weeër vum Fortschrëtt", paragraphs: [
            "Papers Empire mécht seng Richtung kloer: eng Dréckerei zu enger automatiséierter Produktiounskette ausbauen, zwielef Produktiouns- an Optimisatiounseenheeten asetzen an no enger Reorganisatioun mat erhalener Kultur en neien Zyklus ufänken.",
            "Universal Paperclips weist säi Wee Schrëtt fir Schrëtt. Et fänkt als kompakt Optimisatioun un an nei Systemer kommen dobäi, soubal bestëmmte Konditiounen erfëllt sinn. Papers Empire weist déi nächst Ziler méi fréi; bei Universal Paperclips bleift méi vum Fortschrëtt ze entdecken."
          ] },
          { title: "Zwee Spillertypen, zwou Aschränkungen", paragraphs: [
            "Papers Empire passt fir Spiller, déi eng illustréiert Fabrick a Sessioune mat méi laange Pause wëllen; d’Offline-Produktioun leeft no op d’mannst enger Minutt Ofwiesenheet mat 50 Prozent an ass op aacht Stonne limitéiert. Universal Paperclips passt fir Spiller, déi de Fortschrëtt virun allem duerch Entdeckung erliewe wëllen: De Frank Lantz beschreift et als eng Erfarung vu véier bis sechs Stonnen, an déi offiziell Säit weist drop hin, datt d’Webversioun net fir Smartphonen entwéckelt gouf."
          ] },
        ],
      },
    },
  },
]);

export function articlePath(article, lang) {
  const prefix = lang === "fr" ? "" : `/${lang}`;
  return `${prefix}/guides/${article.translations[lang].slug}/`;
}

export function absolute(path) {
  return new URL(path, SITE_ORIGIN).href;
}
