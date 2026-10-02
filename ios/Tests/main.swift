import Foundation

@main
struct NativeGameTests {
    @MainActor static func main() throws {
        var count = 0
        func check(_ condition: Bool, _ message: String) {
            guard condition else { fatalError("Native game failed: " + message) }
            count += 1
        }
        func rejects(_ message: String, _ operation: () throws -> Void) {
            do { try operation(); fatalError("Native game should reject: " + message) }
            catch { count += 1 }
        }
        let repository = URL(fileURLWithPath: CommandLine.arguments[1], isDirectory: true)
        let assets = repository.appendingPathComponent("ios/GameAssets", isDirectory: true)
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent("papers-native-tests-" + UUID().uuidString, isDirectory: true)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: directory) }
        let preferences = NativeGamePreferences(directory: directory.appendingPathComponent("Preferences"))
        check(preferences.language == nil, "fresh preference uses device fallback")
        try preferences.recordLanguage("de")
        check(NativeGamePreferences(directory: directory.appendingPathComponent("Preferences")).language == "de", "language persists")
        let invalidLanguage = try preferences.recordLanguage("xx")
        check(!invalidLanguage && preferences.language == "de", "unknown locale cannot overwrite preference")
        check(NativeGamePolicy.acceptsSave(Data(repeating: 65, count: NativeGamePolicy.saveByteLimit)), "exact file byte bound is accepted")
        check(!NativeGamePolicy.acceptsSave(Data(repeating: 65, count: NativeGamePolicy.saveByteLimit + 1)), "oversized file rejected")
        check(!NativeGamePolicy.acceptsSave(Data([0xff, 0xfe])), "invalid UTF-8 rejected")

        let engine = try NativeGameEngine(assetsURL: assets)
        check(!engine.hasBrowserGlobals, "JavaScriptCore rules run without browser globals or DOM mocks")
        try engine.initialize(saveRaw: nil, language: "fr")
        var snapshot = try engine.snapshot()
        check(snapshot.buildings.count == 12, "all canonical buildings are available to native UI")
        check(snapshot.language == "fr", "engine starts in selected language")
        let initialDocuments = snapshot.resources.documents
        for _ in 0..<40 { check(try engine.command("print", payload: [:])["ok"].bool, "canonical print succeeds") }
        snapshot = try engine.snapshot()
        check(snapshot.resources.documents > initialDocuments, "printing earns canonical currency")
        let first = snapshot.buildings.first { $0.id == "reproOperator" }!
        check(first.milestone == 10, "native milestone reads canonical quantity from the milestone object")
        check(first.canBuy, "printing unlocks an affordable first building")
        check(try engine.command("buyBuilding", payload: ["id": .string(first.id)])["ok"].bool, "canonical buy succeeds")
        snapshot = try engine.snapshot()
        check(snapshot.buildings.first { $0.id == first.id }!.quantity == first.quantity + 1, "exact quantity increments")
        check(snapshot.rates.docPerSecond > 0, "owned producer generates documents")
        let beforeTick = snapshot.resources.documents
        try engine.tick(1)
        check(try engine.snapshot().resources.documents > beforeTick, "headless tick produces documents")
        let portable = try engine.portableSave()
        let portableText = String(decoding: portable, as: UTF8.self)
        let preview = try engine.previewImport(portableText)
        check(preview.unitCount == 1, "portable preview reports owned units")
        let roundtrip = try NativeGameEngine(assetsURL: assets)
        try roundtrip.initialize(saveRaw: preview.raw, language: "en")
        check(try roundtrip.snapshot().buildings.first { $0.id == first.id }!.quantity == 1, "native portable save roundtrips canonical V3 state")
        check(try roundtrip.snapshot().language == "en", "language changes keep imported progress")
        for language in NativeGamePolicy.languages {
            let localized = try NativeGameEngine(assetsURL: assets)
            try localized.initialize(saveRaw: preview.raw, language: language)
            check(try localized.snapshot().language == language, "canonical locale loads: " + language)
            check(try localized.snapshot().buildings.count == 12, "localized snapshot retains every building: " + language)
        }
        for seconds in [120, 301] {
            var awaySave = try JSONSerialization.jsonObject(with: Data(preview.raw.utf8)) as! [String: Any]
            awaySave["lastSeen"] = Date().addingTimeInterval(-Double(seconds)).timeIntervalSince1970 * 1000
            awaySave["savedAt"] = awaySave["lastSeen"]
            let awayRaw = String(decoding: try JSONSerialization.data(withJSONObject: awaySave), as: UTF8.self)
            let resumed = try NativeGameEngine(assetsURL: assets)
            try resumed.initialize(saveRaw: awayRaw, language: "fr")
            let resumedSnapshot = try resumed.snapshot()
            let earnedDocuments = resumedSnapshot.resources.documents - preview.resources.documents
            check(earnedDocuments > 0, "native launch credits canonical absence reward after \(seconds) seconds")
            if seconds == 120 {
                check(resumedSnapshot.offlineReport == nil, "120-second absence credits progress silently")
            } else {
                check(resumedSnapshot.offlineReport != nil, "301-second absence presents an offline report")
                check(abs((resumedSnapshot.offlineReport?["earnedDocs"].double ?? 0) - earnedDocuments) < 0.000001, "offline report matches the credited documents")
            }
        }
        rejects("malformed import") { _ = try engine.previewImport("not JSON") }
        rejects("non-game JSON") { _ = try engine.previewImport("{\"version\":99}") }
        let encodedSnapshot = try JSONEncoder().encode(snapshot)
        check(try JSONDecoder().decode(NativeGameSnapshot.self, from: encodedSnapshot) == snapshot, "snapshot codec preserves every canonical field")

        let gameDirectory = directory.appendingPathComponent("Game", isDirectory: true)
        let exports = directory.appendingPathComponent("Exports", isDirectory: true)
        let store = NativeGameStore(directory: gameDirectory, exportsDirectory: exports, assetsURL: assets, startAutomatically: false)
        check(!store.saveBlocked && store.snapshot != nil, "native store starts with canonical rules")
        check(store.persistCurrent(), "first atomic local save succeeds")
        let primary = gameDirectory.appendingPathComponent("save.json")
        let original = try Data(contentsOf: primary)
        for _ in 0..<3 { _ = store.command("print") }
        let documentsBeforeImport = store.snapshot!.resources.documents
        store.previewImport(raw: portableText)
        check(store.importPreview?.unitCount == 1, "store exposes reviewed import summary")
        check(try Data(contentsOf: primary) == original, "preview does not replace local progress")
        store.cancelImport()
        check(store.importPreview == nil, "cancel clears only pending import")
        check(try Data(contentsOf: primary) == original, "cancel leaves local game intact")
        store.previewImport(raw: portableText)
        check(store.confirmImport(), "confirmed import succeeds")
        check(store.snapshot?.buildings.first { $0.id == first.id }?.quantity == 1, "native state follows confirmed imported game")
        let backupRaw = try String(contentsOf: gameDirectory.appendingPathComponent("save.previous.json"), encoding: .utf8)
        check(try engine.previewImport(backupRaw).resources.documents == documentsBeforeImport, "backup includes actions since the last autosave")
        check(store.backupAvailable, "recovery is advertised")
        check(store.command("setEventsEnabled", payload: ["enabled": .bool(false)]), "native incident opt-out succeeds")
        store.setLanguage("de")
        check(store.language == "de" && store.snapshot?.language == "de", "native language change rebuilds only presentation")
        check(store.snapshot?["eventsEnabled"].bool == false, "incident opt-out survives language recreation")
        check(store.persistCurrent(), "imported game autosaves")
        let restarted = NativeGameStore(directory: gameDirectory, exportsDirectory: exports, assetsURL: assets, startAutomatically: false)
        check(restarted.language == "de", "native language survives a new store process equivalent")
        check(restarted.snapshot?["eventsEnabled"].bool == false, "incident opt-out survives process equivalent restart")
        restarted.sceneBecameActive(); restarted.sceneBecameInactive(); restarted.sceneBecameActive()
        check(restarted.snapshot?["eventsEnabled"].bool == false, "incident opt-out survives background recreation")
        restarted.sceneBecameInactive()
        check(restarted.snapshot?.buildings.first { $0.id == first.id }?.quantity == 1, "native game survives store restart")
        let exported = restarted.exportSave()
        check(exported?.path.hasPrefix(exports.path) == true, "export stays in configured documents directory")
        check(try engine.previewImport(String(contentsOf: exported!, encoding: .utf8)).unitCount == 1, "native export remains accepted by canonical portable validator")
        restarted.previewImport(from: exported!)
        check(restarted.importPreview?.unitCount == 1, "native file URL reaches the same preview validator")
        restarted.cancelImport()
        restarted.recoverPrevious()
        check(restarted.importPreview != nil, "recovery previews before replacement")
        restarted.cancelImport()
        let beforeInvalid = try Data(contentsOf: primary)
        restarted.previewImport(raw: "broken")
        check(restarted.importPreview == nil && restarted.errorMessage != nil, "invalid import reports a recoverable error")
        check(try Data(contentsOf: primary) == beforeInvalid, "invalid import never mutates local save")

        let damagedDirectory = directory.appendingPathComponent("Damaged", isDirectory: true)
        try FileManager.default.createDirectory(at: damagedDirectory, withIntermediateDirectories: true)
        let damagedFile = damagedDirectory.appendingPathComponent("save.json")
        try Data("broken".utf8).write(to: damagedFile)
        let damaged = NativeGameStore(directory: damagedDirectory, exportsDirectory: exports, assetsURL: assets, startAutomatically: false)
        check(damaged.saveBlocked, "bad load blocks background saving")
        check(!damaged.persistCurrent(), "bad primary cannot become a blank autosave")
        check(try String(contentsOf: damagedFile, encoding: .utf8) == "broken", "bad primary remains intact")
        damaged.previewImport(raw: portableText)
        check(damaged.confirmImport() && !damaged.saveBlocked, "explicit validated import recovers a damaged load")

        let blockedDirectory = directory.appendingPathComponent("BlockedBackup", isDirectory: true)
        let blocked = NativeGameStore(directory: blockedDirectory, exportsDirectory: exports, assetsURL: assets, startAutomatically: false)
        check(blocked.persistCurrent(), "backup failure fixture has a valid existing game")
        let blockedPrimary = blockedDirectory.appendingPathComponent("save.json")
        let preserved = try Data(contentsOf: blockedPrimary)
        try FileManager.default.createDirectory(at: blockedDirectory.appendingPathComponent("save.previous.json"), withIntermediateDirectories: true)
        blocked.previewImport(raw: portableText)
        check(!blocked.confirmImport(), "backup write failure stops replacement")
        check(try Data(contentsOf: blockedPrimary) == preserved, "backup failure leaves primary byte-identical")

        let unsavedDirectory = directory.appendingPathComponent("UnsavedFirstSession", isDirectory: true)
        let unsaved = NativeGameStore(directory: unsavedDirectory, exportsDirectory: exports, assetsURL: assets, startAutomatically: false)
        _ = unsaved.command("print")
        let firstSessionDocuments = unsaved.snapshot!.resources.documents
        check(!FileManager.default.fileExists(atPath: unsavedDirectory.appendingPathComponent("save.json").path), "first session has not autosaved yet")
        unsaved.previewImport(raw: portableText)
        check(unsaved.confirmImport(), "first-session import succeeds")
        let firstBackup = try String(contentsOf: unsavedDirectory.appendingPathComponent("save.previous.json"), encoding: .utf8)
        check(try engine.previewImport(firstBackup).resources.documents == firstSessionDocuments, "first session is recoverable even before the first autosave")

        let blockedPrimaryDirectory = directory.appendingPathComponent("BlockedPrimary", isDirectory: true)
        let primaryFailure = NativeGameStore(directory: blockedPrimaryDirectory, exportsDirectory: exports, assetsURL: assets, startAutomatically: false)
        _ = primaryFailure.command("print")
        let beforePrimaryFailure = primaryFailure.snapshot!.resources.documents
        try FileManager.default.createDirectory(at: blockedPrimaryDirectory.appendingPathComponent("save.json"), withIntermediateDirectories: true)
        primaryFailure.previewImport(raw: portableText)
        check(!primaryFailure.confirmImport(), "primary write failure stops an import")
        check(primaryFailure.snapshot?.resources.documents == beforePrimaryFailure, "primary write failure retains the active game")
        check(primaryFailure.backupAvailable, "a verified backup stays recoverable when the subsequent primary write fails")
        print("Native JavaScriptCore: \(count) assertions passed (real canonical rules, no browser globals, V3 transfer, atomic backup, invalid-load protection, locale and recovery).")
    }
}
