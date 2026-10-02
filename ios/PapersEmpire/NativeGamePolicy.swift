import Foundation

/// Pure file and locale policy shared by native storage and its tests.
enum NativeGamePolicy {
    static let languages = ["fr", "en", "de", "lb"]
    static let saveByteLimit = 2 * 1024 * 1024

    static func acceptsSave(_ data: Data) -> Bool {
        data.count <= saveByteLimit && String(data: data, encoding: .utf8) != nil
    }
}

/// Interface preference only. Game progress continues to live in the canonical JS save.
final class NativeGamePreferences {
    private struct Stored: Codable { let language: String?; let eventsEnabled: Bool? }
    private let file: URL?
    private(set) var language: String?
    private(set) var eventsEnabled = true

    static var defaultDirectory: URL? {
        FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first?.appendingPathComponent("PapersEmpire", isDirectory: true)
    }

    init(directory: URL? = NativeGamePreferences.defaultDirectory) {
        file = directory?.appendingPathComponent("interface.json")
        if let file, let data = try? Data(contentsOf: file), let stored = try? JSONDecoder().decode(Stored.self, from: data) {
            if let value = stored.language, NativeGamePolicy.languages.contains(value) { language = value }
            eventsEnabled = stored.eventsEnabled ?? true
        }
    }

    @discardableResult func recordLanguage(_ next: String) throws -> Bool {
        guard NativeGamePolicy.languages.contains(next) else { return false }
        try persist(language: next)
        language = next
        return true
    }

    func recordEventsEnabled(_ enabled: Bool) throws {
        // Even when disk writes fail, retain the chosen opt-out this session.
        eventsEnabled = enabled
        try persist(language: language)
    }

    private func persist(language: String?) throws {
        if let file {
            try FileManager.default.createDirectory(at: file.deletingLastPathComponent(), withIntermediateDirectories: true)
            try JSONEncoder().encode(Stored(language: language, eventsEnabled: eventsEnabled)).write(to: file, options: .atomic)
        }
    }
}
