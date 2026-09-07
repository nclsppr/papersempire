import Foundation

/// Pure policy shared by the WebKit adapter and command-line security tests.
enum NativeGamePolicy {
    static let languages = ["fr", "en", "de", "lb"]
    static let saveByteLimit = 2 * 1024 * 1024

    static func acceptsBridgeOrigin(_ url: URL?, isMainFrame: Bool) -> Bool {
        isMainFrame && url?.scheme == "peapp" && url?.host == "game" && url?.user == nil && url?.password == nil && url?.port == nil
    }

    static func language(for url: URL) -> String? {
        guard acceptsBridgeOrigin(url, isMainFrame: true) else { return nil }
        let path = url.path.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        if path.isEmpty || path == "index.html" { return "fr" }
        return ["en", "de", "lb"].first { path == $0 || path == $0 + "/index.html" }
    }

    static func startURL(language: String) -> URL {
        let locale = languages.contains(language) ? language : "fr"
        return URL(string: "peapp://game" + (locale == "fr" ? "/" : "/\(locale)/") + "?experience=empire")!
    }

    /// Editorial help lives on the public website, never inside the privileged game view.
    static func publicGuideURL(for url: URL) -> URL? {
        guard acceptsBridgeOrigin(url, isMainFrame: true) else { return nil }
        var components = url.path.split(separator: "/").map(String.init)
        guard !components.contains(".."), !url.path.contains("\0") else { return nil }
        if let first = components.first, ["en", "de", "lb"].contains(first) { components.removeFirst() }
        guard components.first == "guides" else { return nil }
        var publicURL = URLComponents()
        publicURL.scheme = "https"
        publicURL.host = "papersempire.com"
        publicURL.path = url.path + (url.hasDirectoryPath && !url.path.hasSuffix("/") ? "/" : "")
        publicURL.fragment = url.fragment
        return publicURL.url
    }

    static func resourceURL(for requestURL: URL, root: URL) -> URL? {
        guard acceptsBridgeOrigin(requestURL, isMainFrame: true) else { return nil }
        var relative = requestURL.path
        if requestURL.hasDirectoryPath && !relative.hasSuffix("/") { relative += "/" }
        if relative.hasSuffix("/") { relative += "index.html" }
        if relative.isEmpty { relative = "/index.html" }
        guard !relative.split(separator: "/").contains(".."), !relative.contains("\0") else { return nil }
        let canonicalRoot = root.standardizedFileURL.resolvingSymlinksInPath()
        let file = canonicalRoot.appendingPathComponent(String(relative.drop(while: { $0 == "/" }))).standardizedFileURL.resolvingSymlinksInPath()
        return file.path.hasPrefix(canonicalRoot.path + "/") ? file : nil
    }

    static func acceptsSave(_ data: Data) -> Bool {
        data.count <= saveByteLimit && String(data: data, encoding: .utf8) != nil
    }
}

/// Interface preference only. Game progress continues to live in the canonical JS save.
final class NativeGamePreferences {
    private struct Stored: Codable { let language: String }
    private let file: URL?
    private(set) var language: String?

    static var defaultDirectory: URL? {
        FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first?.appendingPathComponent("PapersEmpire", isDirectory: true)
    }

    init(directory: URL? = NativeGamePreferences.defaultDirectory) {
        file = directory?.appendingPathComponent("interface.json")
        if let file, let data = try? Data(contentsOf: file), let stored = try? JSONDecoder().decode(Stored.self, from: data), NativeGamePolicy.languages.contains(stored.language) {
            language = stored.language
        }
    }

    @discardableResult func recordLoadedPage(_ url: URL) throws -> Bool {
        guard let next = NativeGamePolicy.language(for: url) else { return false }
        language = next
        if let file {
            try FileManager.default.createDirectory(at: file.deletingLastPathComponent(), withIntermediateDirectories: true)
            try JSONEncoder().encode(Stored(language: next)).write(to: file, options: .atomic)
        }
        return true
    }
}
