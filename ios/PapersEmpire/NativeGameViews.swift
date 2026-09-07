import SwiftUI
import SpriteKit
import UniformTypeIdentifiers

/* Production Twin, native edition.
 A living ivory-and-steel industrial miniature leads the first viewport.
 Apple navigation and Liquid Glass controls float above the actual game.
 Printing is a reachable action, separate from the four navigation tabs.
 The same units, costs, career and saves drive the scene and native controls.
 Native phone/tablet evidence and gameplay verification are the finish line. */
private let empireTint = Color(red: 0.82, green: 0.29, blue: 0.08)
private enum EmpireTab: String { case empire, workshops, orders, career }
private enum EmpireSheet: Identifiable, Equatable {
    case settings, building(String), incident, offline, importPreview
    var id: String { switch self {
    case .settings: return "settings"
    case .building(let id): return "building-" + id
    case .incident: return "incident"
    case .offline: return "offline"
    case .importPreview: return "import"
    } }
}
private struct NativeShare: Identifiable { let id = UUID(); let items: [Any] }
private struct GameConfirmation: Identifiable {
    let id = UUID(); let title: String; let message: String; let action: () -> Void
}
private struct NativeGameAlerts: ViewModifier {
    @Bindable var game: NativeGameStore
    @Binding var confirmation: GameConfirmation?
    let active: Bool
    let word: (String) -> String

    func body(content: Content) -> some View {
        content
            .alert(confirmation?.title ?? word("confirmAction"), isPresented: Binding(
                get: { active && confirmation != nil },
                set: { if active && !$0 { confirmation = nil } }
            ), presenting: confirmation) { value in
                Button(word("cancel"), role: .cancel) { confirmation = nil }
                Button(word("confirm"), role: .destructive) { confirmation = nil; value.action() }
            } message: { value in Text(value.message) }
            .alert("Papers Empire", isPresented: Binding(
                get: { active && game.errorMessage != nil && game.snapshot != nil },
                set: { if active && !$0 { game.errorMessage = nil } }
            )) {
                Button("OK", role: .cancel) { game.errorMessage = nil }
            } message: { Text(game.errorMessage ?? "") }
    }
}

struct NativeGameRootView: View {
    @Bindable var game: NativeGameStore
    @Environment(\.scenePhase) private var phase
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.dynamicTypeSize) private var typeSize
    @State private var tab = EmpireTab.empire
    @State private var sheet: EmpireSheet?
    @State private var scene = EmpireScene()
    @State private var importer = false
    @State private var importAfterDismiss = false
    @State private var recoveryAfterDismiss = false
    @State private var queuedShare: NativeShare?
    @State private var share: NativeShare?
    @State private var confirmation: GameConfirmation?
    @State private var printFeedback = 0
    @State private var sheetDetent: PresentationDetent = .large
    private func word(_ key: String) -> String { NativeInterfaceCopy.text(key, language: game.language) }

    var body: some View {
        Group {
            if let snapshot = game.snapshot {
                TabView(selection: $tab) {
                    NavigationStack { empire(snapshot).navigationTitle(word("empire")).navigationBarTitleDisplayMode(.inline).toolbar { settingsToolbar } }
                        .tabItem { Label(word("empire"), systemImage: "building.2.crop.circle") }.tag(EmpireTab.empire)
                    NavigationStack { workshopList(snapshot).navigationTitle(word("workshops")).toolbar { settingsToolbar } }
                        .tabItem { Label(word("workshops"), systemImage: "building.2") }.tag(EmpireTab.workshops)
                    NavigationStack { orders(snapshot).navigationTitle(word("orders")).toolbar { settingsToolbar } }
                        .tabItem { Label(word("orders"), systemImage: "tray.full") }.tag(EmpireTab.orders)
                    NavigationStack { career(snapshot).navigationTitle(word("career")).toolbar { settingsToolbar } }
                        .tabItem { Label(word("career"), systemImage: "seal") }.tag(EmpireTab.career)
                }
            } else if game.isLoading {
                VStack(spacing: 20) {
                    Image("AppMark").resizable().scaledToFit().frame(width: 104, height: 104)
                    ProgressView(word("loading"))
                }.frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                ContentUnavailableView {
                    Label(word("unavailable"), systemImage: "externaldrive.badge.exclamationmark")
                } description: { Text(game.errorMessage ?? word("localHint")) } actions: {
                    Button(word("import"), systemImage: "square.and.arrow.down") { importer = true }
                    Button(word("recover")) { game.recoverPrevious() }
                    Button(word("reset"), role: .destructive) { confirmReset() }
                }
            }
        }
        .tint(empireTint)
        .sensoryFeedback(.impact(weight: .light), trigger: printFeedback)
        .sheet(item: $sheet, onDismiss: presentQueuedAction) { selection in
            NavigationStack {
                sheetBody(selection).toolbar {
                    ToolbarItem(placement: .confirmationAction) { Button(word("done")) { sheet = nil } }
                }
            }.tint(empireTint)
                .modifier(NativeGameAlerts(game: game, confirmation: $confirmation, active: true, word: word))
                .presentationDetents([.medium, .large], selection: $sheetDetent).presentationDragIndicator(.visible)
        }
        .popover(item: $share, attachmentAnchor: .point(.topTrailing), arrowEdge: .top) {
            NativeShareSheet(items: $0.items)
                .presentationCompactAdaptation(.sheet)
                .presentationDetents([.medium, .large])
                .onDisappear(perform: presentQueuedAction)
        }
        .fileImporter(isPresented: $importer, allowedContentTypes: [.data], allowsMultipleSelection: false) { result in
            switch result {
            case .success(let urls): if let url = urls.first { game.previewImport(from: url) }
            case .failure(let error): game.errorMessage = error.localizedDescription
            }
        }
        .modifier(NativeGameAlerts(game: game, confirmation: $confirmation, active: sheet == nil && !importer && share == nil, word: word))
        .onChange(of: game.importPreview?.id) { _, id in if id != nil { sheet = .importPreview } }
        .onChange(of: game.snapshot?.offlineReport) { _, report in
            if report != nil && sheet == nil && !importer && share == nil { sheet = .offline }
        }
        .onChange(of: sheet) { previous, next in
            if previous == .offline && next != .offline { _ = game.command("dismissOfflineReport") }
            if next != nil { sheetDetent = .large }
        }
        .onChange(of: phase) { _, value in
            if value == .active { game.sceneBecameActive() } else { game.sceneBecameInactive() }
        }
        .task {
            game.sceneBecameActive()
            if game.snapshot?.offlineReport != nil { sheet = .offline }
        }
    }

    @ToolbarContentBuilder private var settingsToolbar: some ToolbarContent {
        ToolbarItem(placement: .topBarTrailing) {
            Button(word("settings"), systemImage: "slider.horizontal.3") { sheet = .settings }.accessibilityIdentifier("native.settings")
        }
    }

    private func empire(_ snapshot: NativeGameSnapshot) -> some View {
        GeometryReader { geometry in
            ZStack {
                NativeEmpireSceneView(scene: scene,
                    lots: snapshot.buildings.map { EmpireLot(id: $0.id, quantity: $0.quantity, unlocked: $0.unlocked) },
                    reducedMotion: reduceMotion, isActive: phase == .active && tab == .empire && sheet == nil,
                    contentInsets: UIEdgeInsets(top: typeSize.isAccessibilitySize ? 220 : 150, left: 18,
                        bottom: snapshot.buildings.allSatisfy({ $0.quantity == 0 }) && geometry.size.height > 500 ? 255 : 135, right: 18),
                    accessibilityNames: Dictionary(uniqueKeysWithValues: snapshot.buildings.map { ($0.id, $0.name) }),
                    onSelectLot: { sheet = .building($0) })
                VStack(spacing: 12) {
                    resourceReadout(snapshot).padding(.horizontal, 16)
                    if !snapshot.objective.title.isEmpty && geometry.size.height > 430 {
                        Button { openObjective(snapshot) } label: {
                            HStack(spacing: 12) {
                                Image(systemName: "scope").font(.title3)
                                VStack(alignment: .leading, spacing: 5) {
                                    Text(snapshot.objective.title).font(.subheadline.weight(.semibold))
                                    ProgressView(value: min(1, max(0, snapshot.objective.progress)))
                                }
                                Image(systemName: "chevron.right").font(.caption.weight(.semibold))
                            }.padding(14).foregroundStyle(.primary)
                        }.buttonStyle(.plain).nativeGlass().padding(.horizontal, 16)
                            .accessibilityLabel(snapshot.objective.title + ". " + snapshot.objective.description)
                    }
                    if game.saveBlocked {
                        Button(word("saveError"), systemImage: "externaldrive.badge.exclamationmark") { sheet = .settings }
                            .padding(12).nativeGlass()
                    }
                    Spacer(minLength: 8)
                    if snapshot.buildings.allSatisfy({ $0.quantity == 0 }) && geometry.size.height > 500 {
                        VStack(spacing: 5) {
                            Text(word("firstPrint")).font(.headline)
                            Text(word("firstHint")).font(.subheadline).multilineTextAlignment(.center)
                        }.padding(14).nativeGlass().padding(.horizontal, 24)
                    }
                    HStack(alignment: .bottom) {
                        if snapshot.incident != nil {
                            Button { _ = game.command("openIncident"); sheet = .incident } label: {
                                Label(word("incident"), systemImage: "exclamationmark.bubble").font(.subheadline.weight(.semibold)).padding(12)
                            }.buttonStyle(.plain).nativeGlass()
                        }
                        Spacer()
                        HStack(spacing: 4) {
                            mapButton("zoomOut", symbol: "minus") { scene.zoom(by: 0.8) }
                            mapButton("zoomIn", symbol: "plus") { scene.zoom(by: 1.2) }
                            mapButton("recenter", symbol: "scope") { scene.recenter() }
                        }.nativeGlass().accessibilityElement(children: .contain)
                    }.padding(.horizontal, 16)
                    Button {
                        if game.command("print") { printFeedback += 1 }
                    } label: {
                        Label(word("print"), systemImage: "printer.fill").font(.headline).frame(minWidth: 150, minHeight: 44)
                    }.nativePrimary().disabled(game.saveBlocked).accessibilityIdentifier("native.print").padding(.bottom, 14)
                }
                .padding(.top, 8)
                .frame(maxWidth: geometry.size.width > 700 ? 600 : .infinity).frame(maxWidth: .infinity)
            }
        }
    }

    private func mapButton(_ key: String, symbol: String, action: @escaping () -> Void) -> some View {
        Button(action: action) { Image(systemName: symbol).frame(width: 44, height: 44) }.buttonStyle(.plain).accessibilityLabel(word(key))
    }
    private func openObjective(_ snapshot: NativeGameSnapshot) {
        switch snapshot["objective"]["kind"].string {
        case "career", "campaign": tab = .career
        case "client", "delivery": tab = .orders
        default: tab = snapshot["objective"]["goal"]["resource"].string == "ccTotal" ? .career : .workshops
        }
    }
    private func resourceReadout(_ snapshot: NativeGameSnapshot) -> some View {
        HStack(alignment: .center, spacing: 16) {
            VStack(alignment: .leading, spacing: 3) {
                Text(word("documents")).font(.caption).foregroundStyle(.secondary)
                Text(game.format(snapshot.resources.documents)).font(.title2.weight(.bold)).monospacedDigit().accessibilityIdentifier("native.documents")
            }
            Spacer(minLength: 0)
            VStack(alignment: .trailing, spacing: 3) {
                Label(word("production"), systemImage: "bolt.fill").font(.caption).foregroundStyle(.secondary)
                Text(game.format(snapshot.rates.docPerSecond) + " DOC/s").font(.subheadline.weight(.semibold)).monospacedDigit()
            }
        }.padding(.horizontal, 18).padding(.vertical, 12).nativeGlass().accessibilityElement(children: .combine)
    }

    private func workshopList(_ snapshot: NativeGameSnapshot) -> some View {
        List {
            Section {
                LabeledContent(word("documents"), value: game.format(snapshot.resources.documents) + " DOC")
                LabeledContent(word("production"), value: game.format(snapshot.rates.docPerSecond) + " DOC/s")
            }
            Section {
                ForEach(snapshot.buildings.filter { $0.unlocked || $0.quantity > 0 }) { building in
                    Button { sheet = .building(building.id) } label: {
                        HStack(spacing: 16) {
                            NativeBuildingArt(id: building.id).frame(width: 84, height: 88)
                            VStack(alignment: .leading, spacing: 5) {
                                Text(building.name).font(.headline).foregroundStyle(.primary)
                                Text("\(building.quantity) " + word("units")).font(.subheadline).foregroundStyle(.secondary)
                                Text(game.format(building.cost) + " DOC").font(.subheadline.weight(.semibold)).foregroundStyle(empireTint)
                            }
                            Spacer(minLength: 0)
                            Image(systemName: "chevron.right").font(.caption.weight(.semibold)).foregroundStyle(.secondary)
                        }.padding(.vertical, 5)
                    }.buttonStyle(.plain).accessibilityIdentifier("native.building." + building.id)
                }
            } footer: { Text(word("growthHint")) }
        }
    }

    @ViewBuilder private func buildingDetail(_ id: String) -> some View {
        if let building = game.snapshot?.buildings.first(where: { $0.id == id }) {
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    NativeBuildingArt(id: id).frame(height: 220).frame(maxWidth: .infinity)
                    VStack(alignment: .leading, spacing: 9) {
                        Text(building.name).font(.title.bold())
                        Text(building.description).foregroundStyle(.secondary)
                    }
                    VStack(spacing: 14) {
                        LabeledContent(word("owned"), value: "\(building.quantity)")
                        LabeledContent(word("cost"), value: game.format(building.cost) + " DOC")
                        if building.marginalDocPerSecond > 0 { LabeledContent(word("gain"), value: "+" + game.format(building.marginalDocPerSecond) + " DOC/s") }
                        Text(building.impact).font(.subheadline).foregroundStyle(.secondary).frame(maxWidth: .infinity, alignment: .leading)
                        if let next = building.milestone, next > building.quantity {
                            VStack(alignment: .leading, spacing: 8) {
                                LabeledContent(word("nextTier"), value: "\(building.quantity) / \(next)")
                                ProgressView(value: Double(building.quantity), total: Double(next))
                            }
                        }
                    }.monospacedDigit()
                    Button { tab = .empire; sheet = nil; scene.focusLot(id) } label: { Label(word("map"), systemImage: "map") }
                }.padding(24).frame(maxWidth: 620).frame(maxWidth: .infinity)
            }
            .safeAreaInset(edge: .bottom) {
                Button {
                    if game.command("buyBuilding", payload: ["id": .string(id)]) { printFeedback += 1 }
                } label: {
                    VStack(spacing: 3) {
                        Text(building.unlocked ? word("build") : word("locked")).font(.headline)
                        Text(game.format(building.cost) + " DOC").font(.subheadline).monospacedDigit()
                    }.frame(maxWidth: .infinity, minHeight: 44)
                }.nativePrimary().disabled(!building.canBuy || game.saveBlocked).accessibilityIdentifier("native.buy." + id)
                    .padding(.horizontal, 24).padding(.vertical, 12).background(.bar)
            }.navigationTitle(word("details")).navigationBarTitleDisplayMode(.inline)
        }
    }

    private func orders(_ snapshot: NativeGameSnapshot) -> some View {
        List {
            if let incident = snapshot.incident {
                Section { Button { _ = game.command("openIncident"); sheet = .incident } label: { Label(incident.title, systemImage: "exclamationmark.bubble") } }
            }
            if !snapshot.contracts["active"].isNull {
                Section(word("active")) {
                    let contract = snapshot.contracts["active"].record
                    VStack(alignment: .leading, spacing: 12) {
                        Text(contract.name).font(.headline)
                        Text(contract.description).foregroundStyle(.secondary)
                        ProgressView(value: min(1, max(0, contract["progress"].double)))
                        Text(game.format(contract["remaining"].double) + " s").monospacedDigit()
                        if !contract["clauseText"].string.isEmpty { Text(contract["clauseText"].string).font(.subheadline) }
                    }.padding(.vertical, 8)
                }
            }
            Section(word("contracts")) {
                if !snapshot.contracts["unlocked"].bool {
                    VStack(alignment: .leading, spacing: 12) {
                        Image(systemName: "tray").font(.largeTitle).foregroundStyle(empireTint)
                        Text(word("emptyOrders")).font(.headline)
                        Text(word("emptyOrdersHint")).foregroundStyle(.secondary)
                        ProgressView(value: min(snapshot.resources.totalDocuments, 1500), total: 1500)
                    }.padding(.vertical, 16)
                }
                if snapshot.contracts["unlocked"].bool {
                    ForEach(snapshot.contracts["available"].records) { contract in NativeContractRow(contract: contract, game: game) }
                    Button(word("refresh"), systemImage: "arrow.clockwise") { _ = game.command("rerollContracts") }.disabled(!snapshot.contracts["canReroll"].bool)
                }
            }
            Section(word("journal")) {
                ForEach(Array(snapshot.log.prefix(25).enumerated()), id: \.offset) { _, entry in
                    Text(entry["text"].string.isEmpty ? entry.description : entry["text"].string).font(.subheadline)
                }
            }
        }
    }

    private func career(_ snapshot: NativeGameSnapshot) -> some View {
        List {
            if !snapshot.progression["conclusion"].isNull {
                Section {
                    let conclusion = snapshot.progression["conclusion"].record
                    Text(conclusion.title).font(.headline)
                    Text(conclusion.description).foregroundStyle(.secondary)
                    if conclusion["canAcknowledge"].bool {
                        Button(game.text("career.conclusion.acknowledge")) { _ = game.command("acknowledgeConclusion") }
                    }
                }
            }
            Section {
                LabeledContent(word("culture"), value: game.format(snapshot.resources.culturePoints))
                LabeledContent(word("confidence"), value: game.format(snapshot.resources.clientConfidence) + " CC")
                ForEach([("quality", "quality"), ("footprint", "footprint"), ("brand", "brandImage")], id: \.0) { item in
                    LabeledContent(word(item.0), value: String(Int((snapshot.stats[item.1].double * 100).rounded())) + " %")
                }
            }
            Section(word("plans")) {
                ForEach(snapshot.progression["plans"].records) { plan in NativeProgressionRow(item: plan, category: "plans", game: game) }
                if snapshot.progression["canAbandonPlan"].bool {
                    Button(word("abandon"), role: .destructive) {
                        confirmation = GameConfirmation(title: word("abandon"), message: game.text("career.abandon.confirm")) {
                            _ = game.command("abandonPlan", payload: ["confirmed": .bool(true)])
                        }
                    }
                }
            }
            Section(word("challenges")) {
                ForEach(snapshot.progression["challenges"].records) { NativeProgressionRow(item: $0, category: "challenges", game: game) }
            }
            Section(word("campaigns")) {
                ForEach(snapshot.progression["campaigns"].records) { NativeProgressionRow(item: $0, category: "campaigns", game: game) }
            }
            Section(word("upgrades")) {
                ForEach(snapshot.upgrades.filter { $0.unlocked || $0.purchased }) { upgrade in
                    VStack(alignment: .leading, spacing: 10) {
                        Text(upgrade.name).font(.headline)
                        Text(upgrade.description).font(.subheadline).foregroundStyle(.secondary)
                        if upgrade.purchased { Label(word("purchased"), systemImage: "checkmark.circle.fill").foregroundStyle(.secondary) }
                        else { Button(word("purchase") + " · " + game.format(upgrade.cost) + " DOC") {
                            _ = game.command("buyUpgrade", payload: ["id": .string(upgrade.id)])
                        }.disabled(snapshot.resources.documents < upgrade.cost) }
                    }.padding(.vertical, 8)
                }
            }
            Section {
                Button(word("prestige"), systemImage: "arrow.triangle.2.circlepath") {
                    confirmation = GameConfirmation(title: word("prestige"), message: snapshot.progression["prestige"]["confirmationText"].string) {
                        _ = game.command("prestige", payload: ["confirmed": .bool(true)])
                    }
                }.disabled(!snapshot.canPrestige)
            } footer: { Text(word("prestigeHint")) }
            Section(word("achievements")) {
                ForEach(snapshot.achievements) { item in
                    HStack(alignment: .top, spacing: 12) {
                        Image(systemName: item["unlocked"].bool ? "seal.fill" : "seal").font(.title2)
                            .foregroundStyle(item["unlocked"].bool ? empireTint : Color.secondary)
                        VStack(alignment: .leading, spacing: 5) {
                            Text(item.name).font(.headline)
                            Text(item.description).font(.subheadline).foregroundStyle(.secondary)
                            if !item["rewardText"].string.isEmpty { Text(item["rewardText"].string).font(.caption) }
                        }
                    }.padding(.vertical, 5)
                }
            }
        }
    }

    @ViewBuilder private func sheetBody(_ selection: EmpireSheet) -> some View {
        switch selection {
        case .building(let id): buildingDetail(id)
        case .settings: settings
        case .incident: NativeIncidentView(game: game, dismiss: { sheet = nil })
        case .importPreview: importPreview
        case .offline: offlineReport
        }
    }
    private var settings: some View {
        Form {
            Section(word("language")) {
                Picker(word("language"), selection: Binding(get: { game.language }, set: { game.setLanguage($0) })) {
                    Text("Français").tag("fr"); Text("English").tag("en"); Text("Deutsch").tag("de"); Text("Lëtzebuergesch").tag("lb")
                }
            }
            Section {
                Button(word("export"), systemImage: "square.and.arrow.up") {
                    if let url = game.exportSave() { queuedShare = NativeShare(items: [url]); sheet = nil }
                }.accessibilityIdentifier("native.export")
                Button(word("import"), systemImage: "square.and.arrow.down") { importAfterDismiss = true; sheet = nil }.accessibilityIdentifier("native.import")
                Button(word("recover"), systemImage: "clock.arrow.circlepath") { recoveryAfterDismiss = true; sheet = nil }.disabled(!game.backupAvailable)
            } header: { Text(word("save")) } footer: { Text(word("localHint")) }
            Section {
                Button(word("share"), systemImage: "square.and.arrow.up.on.square") { createShareCard() }
                if let url = URL(string: "https://papersempire.com/" + (game.language == "fr" ? "" : game.language + "/") + "guides/") {
                    Link(destination: url) { Label(word("support"), systemImage: "book") }
                }
            }
            Section(word("appearance")) { Text(word("systemSettings")).foregroundStyle(.secondary) }
            Section {
                Toggle(game.text("settings.events"), isOn: Binding(
                    get: { game.snapshot?["eventsEnabled"].bool ?? true },
                    set: { _ = game.command("setEventsEnabled", payload: ["enabled": .bool($0)]) }
                ))
            }
            Section { Button(word("reset"), role: .destructive) { confirmReset() } }
        }.navigationTitle(word("settings")).navigationBarTitleDisplayMode(.inline)
    }

    @ViewBuilder private var importPreview: some View {
        if let preview = game.importPreview {
            Form {
                Section {
                    LabeledContent(word("documents"), value: game.format(preview.resources.documents) + " DOC")
                    LabeledContent(word("confidence"), value: game.format(preview.resources.clientConfidence) + " CC")
                    LabeledContent(word("culture"), value: game.format(preview.resources.culturePoints))
                    LabeledContent(word("owned"), value: "\(preview.unitCount)")
                    if let date = preview.savedAt { Text(date, format: .dateTime.day().month().year().hour().minute()).foregroundStyle(.secondary) }
                }
                Section {
                    Button(word("replace"), role: .destructive) { if game.confirmImport() { sheet = nil; scene.recenter() } }.accessibilityIdentifier("native.confirmImport")
                    Button(word("cancel"), role: .cancel) { game.cancelImport(); sheet = nil }
                } footer: { Text(word("replaceHint")) }
            }.navigationTitle(word("importPreview")).navigationBarTitleDisplayMode(.inline)
        }
    }
    @ViewBuilder private var offlineReport: some View {
        if let report = game.snapshot?.offlineReport {
            ScrollView {
                VStack(spacing: 22) {
                    Image(systemName: "sun.horizon.fill").font(.largeTitle).foregroundStyle(empireTint)
                    Text(word("offline")).font(.title.bold())
                    Text("+" + game.format(report["earnedDocs"].double) + " DOC").font(.largeTitle.bold()).monospacedDigit()
                    Text(report["body"].string.isEmpty ? word("offlineHint") : report["body"].string).multilineTextAlignment(.center).foregroundStyle(.secondary)
                    Button(word("continue")) { sheet = nil }.nativePrimary()
                }.padding(28).frame(maxWidth: 540).frame(maxWidth: .infinity)
            }
        }
    }
    private func confirmReset() {
        confirmation = GameConfirmation(title: word("reset"), message: word("resetHint")) {
            if game.resetGame() { sheet = nil; tab = .empire; scene.recenter() }
        }
    }
    private func presentQueuedAction() {
        if importAfterDismiss { importAfterDismiss = false; importer = true; return }
        if let value = queuedShare { queuedShare = nil; share = value; return }
        if sheet == nil && game.importPreview != nil { game.cancelImport() }
        if recoveryAfterDismiss { recoveryAfterDismiss = false; game.recoverPrevious(); return }
        if sheet == nil && !importer && share == nil && game.snapshot?.offlineReport != nil { sheet = .offline }
    }
    @MainActor private func createShareCard() {
        guard let snapshot = game.snapshot else { return }
        let renderer = ImageRenderer(content: NativeEmpireShareCard(snapshot: snapshot, game: game).frame(width: 1000, height: 600))
        renderer.scale = 1
        if let image = renderer.uiImage { queuedShare = NativeShare(items: [image, URL(string: "https://papersempire.com/")!]); sheet = nil }
    }
}

private struct NativeBuildingArt: View {
    let id: String
    var body: some View {
        if let image = NativeArtCache.image(id) {
            Image(uiImage: image).resizable().scaledToFit().accessibilityHidden(true)
        }
    }
}
@MainActor private enum NativeArtCache {
    private static var images: [String: UIImage] = [:]
    static func image(_ id: String) -> UIImage? {
        if let image = images[id] { return image }
        guard let url = Bundle.main.url(forResource: "building-" + id + "-v4", withExtension: "png", subdirectory: "NativeAssets"),
              let image = UIImage(contentsOfFile: url.path) else { return nil }
        images[id] = image
        return image
    }
}

private struct NativeContractRow: View {
    let contract: NativeGameRecord
    let game: NativeGameStore
    @State private var expanded = false
    private func word(_ key: String) -> String { NativeInterfaceCopy.text(key, language: game.language) }
    var body: some View {
        DisclosureGroup(isExpanded: $expanded) {
            VStack(alignment: .leading, spacing: 13) {
                Text(contract.description).foregroundStyle(.secondary)
                LabeledContent(word("duration"), value: game.format(contract["duration"].double) + " s")
                Text(contract["rewardText"].string).font(.subheadline.weight(.medium))
                ForEach(Array(contract["requirements"].records.enumerated()), id: \.offset) { _, item in
                    Label(item["text"].string, systemImage: item["met"].bool ? "checkmark.circle" : "circle")
                        .font(.subheadline).foregroundStyle(item["met"].bool ? Color.primary : Color.secondary)
                }
                ForEach(Array(contract["clauses"].records.enumerated()), id: \.offset) { _, clause in
                    VStack(alignment: .leading, spacing: 5) {
                        Text(clause.name).font(.subheadline.weight(.semibold))
                        Text(clause.description).font(.subheadline).foregroundStyle(.secondary)
                        Text(clause["rewardText"].string).font(.caption)
                    }
                }
                Button(word("sign")) { _ = game.command("startContract", payload: ["id": .string(contract.id)]) }
                    .nativePrimary().disabled(!contract["canStart"].bool || game.saveBlocked)
                    .accessibilityIdentifier("native.contract." + contract.id)
            }.padding(.vertical, 12)
        } label: {
            VStack(alignment: .leading, spacing: 5) {
                Text(contract.name).font(.headline)
                Text(contract["rewardText"].string).font(.subheadline).foregroundStyle(.secondary)
            }.padding(.vertical, 5)
        }
    }
}

private struct NativeProgressionRow: View {
    let item: NativeGameRecord
    let category: String
    let game: NativeGameStore
    @State private var expanded: Bool
    init(item: NativeGameRecord, category: String, game: NativeGameStore) {
        self.item = item; self.category = category; self.game = game
        _expanded = State(initialValue: item["state"].string == "active" || item["state"].string == "ready")
    }
    private func word(_ key: String) -> String { NativeInterfaceCopy.text(key, language: game.language) }
    var body: some View {
        DisclosureGroup(isExpanded: $expanded) {
            VStack(alignment: .leading, spacing: 15) {
                Text(item.description).foregroundStyle(.secondary)
                ForEach(["benefit", "tradeoff", "permanent"], id: \.self) { key in
                    if !item[key].string.isEmpty { Text(item[key].string).font(.subheadline) }
                }
                ForEach(item["objectives"].records) { objective in
                    HStack(alignment: .top, spacing: 10) {
                        Image(systemName: objective["completed"].bool ? "checkmark.circle.fill" : "circle")
                            .foregroundStyle(objective["completed"].bool ? Color.green : Color.secondary)
                        VStack(alignment: .leading, spacing: 5) {
                            Text(objective.title).font(.subheadline.weight(.medium))
                            Text(objective["criterion"].string).font(.caption).foregroundStyle(.secondary).monospacedDigit()
                        }
                    }
                }
                if !item["rewardText"].string.isEmpty { Text(item["rewardText"].string).font(.subheadline.weight(.semibold)) }
                if category == "plans" && item["canSelect"].bool {
                    Button(word("choose")) { _ = game.command("selectPlan", payload: ["id": .string(item.id)]) }
                        .nativePrimary().accessibilityIdentifier("native.plan." + item.id)
                }
                if category == "challenges" {
                    if item["canAccept"].bool {
                        Button(word("accept")) { _ = game.command("acceptChallenge", payload: ["id": .string(item.id)]) }.nativePrimary()
                    }
                    if item["canDecline"].bool {
                        Button(word("decline")) { _ = game.command("declineChallenge", payload: ["id": .string(item.id)]) }
                    }
                }
                if category == "campaigns" && item["canStart"].bool {
                    Button(word("open")) { _ = game.command("startCampaign", payload: ["id": .string(item.id)]) }.nativePrimary()
                }
            }.padding(.vertical, 12)
        } label: {
            VStack(alignment: .leading, spacing: 5) {
                Text(item.name).font(.headline)
                Text(item["status"].string).font(.caption.weight(.medium)).foregroundStyle(.secondary)
            }.padding(.vertical, 7)
        }
    }
}

private struct NativeIncidentView: View {
    let game: NativeGameStore
    let dismiss: () -> Void
    private func word(_ key: String) -> String { NativeInterfaceCopy.text(key, language: game.language) }
    var body: some View {
        ScrollView {
            if let incident = game.snapshot?.incident {
                VStack(alignment: .leading, spacing: 24) {
                    Image(systemName: "exclamationmark.bubble.fill").font(.largeTitle).foregroundStyle(empireTint)
                    Text(incident.title).font(.title.bold())
                    Text(incident.description).foregroundStyle(.secondary)
                    if !incident["minigame"].isNull {
                        let minigame = incident["minigame"].record
                        Text(minigame["prompt"].string).font(.headline)
                        HStack(spacing: 16) {
                            ForEach(minigame["answers"].array.map(\.int), id: \.self) { answer in
                                Button("\(answer)") {
                                    if game.command("minigameResponse", payload: ["answer": .number(Double(answer))]) { dismiss() }
                                }.nativePrimary().frame(maxWidth: .infinity)
                            }
                        }
                    }
                    ForEach(incident["choices"].records) { choice in
                        Button {
                            if game.command("eventChoice", payload: ["id": .string(choice.id)]) { dismiss() }
                        } label: {
                            VStack(alignment: .leading, spacing: 6) {
                                Text(choice["label"].string).font(.headline)
                                Text(choice.description).font(.subheadline)
                            }.frame(maxWidth: .infinity, minHeight: 44, alignment: .leading)
                        }.nativePrimary()
                    }
                    Button(game.text("events.archive"), role: .cancel) {
                        if game.command("archiveIncident") { dismiss() }
                    }
                }.padding(24).frame(maxWidth: 620).frame(maxWidth: .infinity)
            } else {
                ContentUnavailableView(word("completed"), systemImage: "checkmark.circle")
            }
        }.navigationTitle(word("incident")).navigationBarTitleDisplayMode(.inline)
    }
}
private struct NativeGlass: ViewModifier {
    @Environment(\.accessibilityReduceTransparency) private var reduceTransparency
    func body(content: Content) -> some View {
        if #available(iOS 26.0, *) { content.glassEffect(.regular, in: .rect(cornerRadius: 20)) }
        else if reduceTransparency { content.background(Color(uiColor: .secondarySystemBackground), in: RoundedRectangle(cornerRadius: 20)) }
        else { content.background(.regularMaterial, in: RoundedRectangle(cornerRadius: 20)) }
    }
}
private extension View {
    func nativeGlass() -> some View { modifier(NativeGlass()) }
    @ViewBuilder func nativePrimary() -> some View {
        if #available(iOS 26.0, *) { self.buttonStyle(.glassProminent).buttonBorderShape(.capsule).controlSize(.large) }
        else { self.buttonStyle(.borderedProminent).buttonBorderShape(.capsule).controlSize(.large) }
    }
}
private struct NativeShareSheet: UIViewControllerRepresentable {
    @Environment(\.dismiss) private var dismiss
    let items: [Any]
    func makeUIViewController(context: Context) -> UIActivityViewController {
        let controller = UIActivityViewController(activityItems: items, applicationActivities: nil)
        controller.preferredContentSize = CGSize(width: 420, height: 600)
        controller.completionWithItemsHandler = { _, _, _, _ in dismiss() }
        return controller
    }
    func updateUIViewController(_ controller: UIActivityViewController, context: Context) {}
}
private struct NativeEmpireShareCard: View {
    let snapshot: NativeGameSnapshot
    let game: NativeGameStore
    var body: some View {
        HStack(spacing: 36) {
            VStack(alignment: .leading, spacing: 26) {
                Image("AppMark").resizable().scaledToFit().frame(width: 90, height: 90)
                Text("Papers Empire").font(.system(size: 42, weight: .bold, design: .rounded))
                Text(game.format(snapshot.resources.totalDocuments) + " DOC").font(.system(size: 54, weight: .bold)).monospacedDigit()
                Text(game.format(snapshot.rates.docPerSecond) + " DOC/s").font(.system(size: 24, weight: .medium))
                Text("papersempire.com").font(.system(size: 20, weight: .medium))
            }.foregroundStyle(.white).frame(maxWidth: .infinity, alignment: .leading)
            VStack(spacing: -24) {
                ForEach(Array(snapshot.buildings.filter { $0.quantity > 0 }.suffix(3))) { item in NativeBuildingArt(id: item.id).frame(width: 240, height: 160) }
            }.frame(width: 290)
        }.padding(50).background(Color(red: 0.027, green: 0.067, blue: 0.122))
    }
}
