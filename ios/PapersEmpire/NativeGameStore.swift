import Foundation
import Observation

@MainActor @Observable
final class NativeGameStore {
    private(set) var snapshot: NativeGameSnapshot?
    private(set) var isLoading = true
    var errorMessage: String?
    private(set) var importPreview: NativeSavePreview?
    private(set) var language: String
    private(set) var saveBlocked = false
    private(set) var backupAvailable = false
    @ObservationIgnored private var engine: NativeGameEngine?
    @ObservationIgnored private let assetsURL: URL?
    @ObservationIgnored private let directory: URL
    @ObservationIgnored private let exportsDirectory: URL
    @ObservationIgnored private let preferences: NativeGamePreferences
    @ObservationIgnored private var timer: Timer?
    @ObservationIgnored private var lastTick = Date()
    @ObservationIgnored private var lastSave = Date()
    @ObservationIgnored private var suspendedSave: String?
    @ObservationIgnored private var active = false
    private var primaryURL: URL { directory.appendingPathComponent("save.json") }
    private var backupURL: URL { directory.appendingPathComponent("save.previous.json") }

    init(directory: URL? = nil, exportsDirectory: URL? = nil, assetsURL: URL? = Bundle.main.resourceURL?.appendingPathComponent("GameAssets", isDirectory: true), startAutomatically: Bool = true) {
        #if DEBUG
        let ephemeral = ProcessInfo.processInfo.arguments.contains("--ephemeral-test")
        #else
        let ephemeral = false
        #endif
        let standard = NativeGamePreferences.defaultDirectory ?? FileManager.default.temporaryDirectory.appendingPathComponent("PapersEmpire", isDirectory: true)
        self.directory = directory ?? (ephemeral ? FileManager.default.temporaryDirectory.appendingPathComponent("PapersEmpireQA-" + UUID().uuidString, isDirectory: true) : standard)
        self.assetsURL = assetsURL
        self.exportsDirectory = exportsDirectory ?? (FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first ?? self.directory).appendingPathComponent("Saves", isDirectory: true)
        preferences = NativeGamePreferences(directory: self.directory)
        let requested = preferences.language ?? String((Locale.preferredLanguages.first ?? "fr").prefix(2))
        language = NativeGamePolicy.languages.contains(requested) ? requested : "fr"
        boot()
        if startAutomatically { sceneBecameActive() }
    }

    private func makeEngine(_ raw: String?) throws -> NativeGameEngine {
        let next = try NativeGameEngine(assetsURL: assetsURL)
        try next.initialize(saveRaw: raw, language: language)
        _ = try next.command("setEventsEnabled", payload: ["enabled": .bool(preferences.eventsEnabled)])
        _ = try next.snapshot()
        return next
    }

    private func boot() {
        defer { isLoading = false }
        do {
            let raw = FileManager.default.fileExists(atPath: primaryURL.path) ? try readFile(primaryURL) : nil
            engine = try makeEngine(raw)
            snapshot = try engine?.snapshot()
            backupAvailable = validBackup()
        } catch {
            // Do not turn an unreadable game into an autosaved blank game.
            saveBlocked = true
            engine = try? makeEngine(nil)
            snapshot = try? engine?.snapshot()
            backupAvailable = validBackup()
            show(error, fallback: "load")
        }
    }

    func text(_ key: String, _ params: [String: NativeJSONValue] = [:]) -> String { engine?.text(key, params: params) ?? key }
    func format(_ value: Double) -> String {
        guard value.isFinite else { return "0" }
        if let formatted = engine?.format(value) { return formatted }
        let formatter = NumberFormatter(); formatter.locale = Locale(identifier: language); formatter.numberStyle = .decimal; formatter.maximumFractionDigits = value < 100 ? 1 : 0
        return formatter.string(from: NSNumber(value: value)) ?? String(value)
    }

    @discardableResult func command(_ name: String, payload: [String: NativeJSONValue] = [:]) -> Bool {
        guard !saveBlocked, let engine else { errorMessage = message("load"); return false }
        do {
            let result = try engine.command(name, payload: payload)
            snapshot = try engine.snapshot()
            if !result["ok"].bool {
                let reason = result["error"].string
                if !reason.isEmpty { errorMessage = result["message"].string.isEmpty ? message("action") : result["message"].string }
                return false
            }
            if name == "setEventsEnabled", case .bool(let enabled) = payload["enabled"] {
                do { try preferences.recordEventsEnabled(enabled) }
                catch { errorMessage = message("preferences") }
            }
            return true
        } catch { show(error, fallback: "action"); return false }
    }

    func tick() {
        guard active, !saveBlocked, let engine else { return }
        let now = Date(); let elapsed = max(0, now.timeIntervalSince(lastTick)); lastTick = now
        do {
            try engine.tick(elapsed)
            snapshot = try engine.snapshot()
            if now.timeIntervalSince(lastSave) >= 5 { _ = persistCurrent() }
        } catch { saveBlocked = true; show(error, fallback: "load") }
    }

    func sceneBecameActive() {
        guard !active else { return }
        if let suspendedSave, !saveBlocked {
            do { engine = try makeEngine(suspendedSave); snapshot = try engine?.snapshot(); self.suspendedSave = nil }
            catch { saveBlocked = true; show(error, fallback: "load") }
        }
        active = true; lastTick = Date()
        let next = Timer(timeInterval: 0.2, repeats: true) { [weak self] _ in Task { @MainActor in self?.tick() } }
        timer = next; RunLoop.main.add(next, forMode: .common)
    }

    func sceneBecameInactive() {
        guard active else { return }
        tick()
        if !saveBlocked { suspendedSave = try? engine?.saveRaw(); _ = persistCurrent() }
        active = false; timer?.invalidate(); timer = nil
    }

    func setLanguage(_ code: String) {
        guard NativeGamePolicy.languages.contains(code), code != language else { return }
        let old = language
        do {
            let raw = try engine?.saveRaw()
            language = code
            let next = try makeEngine(raw)
            try preferences.recordLanguage(code)
            engine = next; snapshot = try next.snapshot(); lastTick = Date()
        } catch { language = old; show(error, fallback: "write") }
    }

    private func readFile(_ url: URL) throws -> String {
        guard url.isFileURL else { throw NativeEngineError.invalidSave("invalid") }
        let values = try url.resourceValues(forKeys: [.fileSizeKey, .isRegularFileKey])
        guard values.isRegularFile == true, let size = values.fileSize, size <= NativeGamePolicy.saveByteLimit else { throw NativeEngineError.invalidSave("size") }
        let data = try Data(contentsOf: url, options: .mappedIfSafe)
        guard NativeGamePolicy.acceptsSave(data), let raw = String(data: data, encoding: .utf8) else { throw NativeEngineError.invalidSave("invalid") }
        return raw
    }

    func previewImport(from url: URL) {
        let scoped = url.startAccessingSecurityScopedResource()
        defer { if scoped { url.stopAccessingSecurityScopedResource() } }
        do { previewImport(raw: try readFile(url)) }
        catch { importPreview = nil; show(error, fallback: "read") }
    }

    func previewImport(raw: String) {
        do {
            guard let engine else { throw NativeEngineError.unavailable }
            importPreview = try engine.previewImport(raw)
        } catch { importPreview = nil; show(error, fallback: "read") }
    }
    func cancelImport() { importPreview = nil }

    @discardableResult func confirmImport() -> Bool {
        guard let reviewed = importPreview else { return false }
        do {
            let candidate = try makeEngine(reviewed.raw)
            try replacePrimary(reviewed.raw, keepBackup: true)
            engine = candidate; snapshot = try candidate.snapshot()
            importPreview = nil; saveBlocked = false; errorMessage = nil; suspendedSave = nil
            backupAvailable = validBackup(); lastTick = Date(); lastSave = Date()
            return true
        } catch { backupAvailable = validBackup(); show(error, fallback: "write"); return false }
    }

    func recoverPrevious() {
        do { previewImport(raw: try readFile(backupURL)) }
        catch { show(error, fallback: "read") }
    }

    @discardableResult func resetGame() -> Bool {
        do {
            let fresh = try makeEngine(nil)
            try replacePrimary(fresh.saveRaw(), keepBackup: true)
            engine = fresh; snapshot = try fresh.snapshot(); importPreview = nil; saveBlocked = false; suspendedSave = nil
            backupAvailable = validBackup(); errorMessage = nil; lastTick = Date(); lastSave = Date()
            return true
        } catch { backupAvailable = validBackup(); show(error, fallback: "write"); return false }
    }

    private func validBackup() -> Bool {
        guard let raw = try? readFile(backupURL), let engine else { return false }
        return (try? engine.previewImport(raw)) != nil
    }

    private func replacePrimary(_ raw: String, keepBackup: Bool) throws {
        let data = Data(raw.utf8)
        guard NativeGamePolicy.acceptsSave(data) else { throw NativeEngineError.invalidSave("size") }
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        let previous = try? readFile(primaryURL)
        // Preserve the displayed game, including actions since the last
        // autosave and a first session with no primary file written yet.
        let current = keepBackup && !saveBlocked ? try engine?.saveRaw() : previous
        if keepBackup, let current, (try? engine?.previewImport(current)) != nil {
            let backup = Data(current.utf8)
            try backup.write(to: backupURL, options: .atomic)
            guard try Data(contentsOf: backupURL) == backup else { throw NativeEngineError.invalidResult("Backup verification failed") }
        }
        try data.write(to: primaryURL, options: .atomic)
        do {
            guard try Data(contentsOf: primaryURL) == data else { throw NativeEngineError.invalidResult("Save verification failed") }
        } catch {
            if let previous { try? Data(previous.utf8).write(to: primaryURL, options: .atomic) }
            saveBlocked = true
            throw error
        }
    }

    @discardableResult func persistCurrent() -> Bool {
        guard !saveBlocked, let engine else { return false }
        do { try replacePrimary(engine.saveRaw(), keepBackup: false); lastSave = Date(); return true }
        catch { show(error, fallback: "write"); return false }
    }

    func exportSave() -> URL? {
        guard let engine else { errorMessage = message("load"); return nil }
        do {
            let data = try engine.portableSave()
            let exports = exportsDirectory
            try FileManager.default.createDirectory(at: exports, withIntermediateDirectories: true)
            let file = exports.appendingPathComponent("papers-empire-" + UUID().uuidString.prefix(8) + ".papersempire")
            try data.write(to: file, options: .atomic)
            return file
        } catch { show(error, fallback: "write"); return nil }
    }

    private func show(_ error: Error, fallback: String) {
        if case NativeEngineError.invalidSave(let reason) = error {
            let translated = text("saveTransfer.error." + reason)
            errorMessage = translated.hasPrefix("saveTransfer.error.") ? message("read") : translated
        } else { errorMessage = message(fallback) }
    }
    private func message(_ key: String) -> String {
        let copy: [String: [String: String]] = [
            "fr": ["load": "La partie locale ne peut pas être chargée. Elle reste intacte. Importe une sauvegarde ou récupère la précédente.", "read": "Ce fichier ne peut pas être importé. Choisis une sauvegarde Papers Empire de 2 Mio maximum.", "write": "La sauvegarde n’a pas pu être écrite. Exporte ta partie pour la conserver.", "preferences": "Ce réglage reste actif dans cette session, mais n’a pas pu être enregistré pour le prochain lancement.", "action": "Cette action n’est pas disponible pour le moment."],
            "en": ["load": "Your local game could not be loaded. It remains intact. Import a save or recover the previous one.", "read": "This file cannot be imported. Choose a Papers Empire save of at most 2 MiB.", "write": "Your game could not be saved. Export it to keep your progress.", "preferences": "This setting remains active for this session, but could not be saved for the next launch.", "action": "This action is currently unavailable."],
            "de": ["load": "Der lokale Spielstand konnte nicht geladen werden und bleibt unverändert. Importiere einen Spielstand oder stelle den vorherigen wieder her.", "read": "Diese Datei kann nicht importiert werden. Wähle einen Papers-Empire-Spielstand bis 2 MiB.", "write": "Dein Spiel konnte nicht gespeichert werden. Exportiere es, um deinen Fortschritt zu behalten.", "preferences": "Diese Einstellung bleibt für diese Sitzung aktiv, konnte aber nicht für den nächsten Start gespeichert werden.", "action": "Diese Aktion ist momentan nicht verfügbar."],
            "lb": ["load": "De lokale Spillstand konnt net geluede ginn a bleift onverännert. Importéier e Spillstand oder stell dee viregte rëm hier.", "read": "Dës Datei kann net importéiert ginn. Wiel e Papers-Empire-Spillstand bis 2 MiB.", "write": "Däi Spill konnt net gespäichert ginn. Exportéier et fir däi Fortschrëtt ze behalen.", "preferences": "Dës Astellung bleift fir dës Sessioun aktiv, mee konnt net fir den nächste Start gespäichert ginn.", "action": "Dës Aktioun ass de Moment net disponibel."]
        ]
        return copy[language]?[key] ?? copy["en"]?[key] ?? key
    }
}
