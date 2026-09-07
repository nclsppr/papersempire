import Foundation

var count = 0
func check(_ condition: @autoclosure () -> Bool, _ message: String) {
    guard condition() else { fatalError("Native policy failed: " + message) }
    count += 1
}
let directory = FileManager.default.temporaryDirectory.appendingPathComponent("papers-native-tests-" + UUID().uuidString, isDirectory: true)
try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
defer { try? FileManager.default.removeItem(at: directory) }
let root = directory.appendingPathComponent("WebAssets", isDirectory: true)
try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)

for language in NativeGamePolicy.languages {
    let url = NativeGamePolicy.startURL(language: language)
    let expected = language == "fr" ? "index.html" : language + "/index.html"
    check(NativeGamePolicy.resourceURL(for: url, root: root)?.path == root.appendingPathComponent(expected).path, "localized directory resolves to " + expected)
    check(NativeGamePolicy.language(for: url) == language, "language round trip " + language)
    check(URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems?.first?.value == "empire", "graphical mode survives locale " + language)
}
check(NativeGamePolicy.language(for: NativeGamePolicy.startURL(language: "xx")) == "fr", "unsupported language falls back to French")
for value in ["https://game/en/", "peapp://outside/en/", "peapp://name@game/en/", "peapp://game:9000/en/"] {
    let url = URL(string: value)!
    check(!NativeGamePolicy.acceptsBridgeOrigin(url, isMainFrame: true), "reject bridge origin " + value)
    check(NativeGamePolicy.resourceURL(for: url, root: root) == nil, "reject resource origin " + value)
}
let local = URL(string: "peapp://game/en/")!
for language in NativeGamePolicy.languages {
    let prefix = language == "fr" ? "/" : "/" + language + "/"
    let guide = URL(string: "peapp://game" + prefix + "guides/first-automation/?ignored=1#next")!
    check(NativeGamePolicy.publicGuideURL(for: guide)?.absoluteString == "https://papersempire.com" + prefix + "guides/first-automation/#next", "guide uses public HTTPS route for " + language)
}
for value in ["peapp://game/dashboard/", "peapp://game/assets/js/app.js", "https://outside/guides/", "peapp://game/fr/guides/", "peapp://game/guides/%2e%2e/dashboard/"] {
    check(NativeGamePolicy.publicGuideURL(for: URL(string: value)!) == nil, "non-guide cannot masquerade as public guide " + value)
}
check(!NativeGamePolicy.acceptsBridgeOrigin(local, isMainFrame: false), "subframes cannot invoke native bridge")
check(NativeGamePolicy.acceptsBridgeOrigin(local, isMainFrame: true), "trusted main frame may invoke bridge")
for value in ["peapp://game/../private.json", "peapp://game/%2E%2E/private.json", "peapp://game/assets/%2e%2e/%2e%2e/private.json"] {
    check(NativeGamePolicy.resourceURL(for: URL(string: value)!, root: root) == nil, "reject traversal " + value)
}
let outside = directory.appendingPathComponent("private.json")
try Data("outside".utf8).write(to: outside)
try FileManager.default.createSymbolicLink(at: root.appendingPathComponent("escape.json"), withDestinationURL: outside)
check(NativeGamePolicy.resourceURL(for: URL(string: "peapp://game/escape.json")!, root: root) == nil, "reject symlink outside resource bundle")
check(NativeGamePolicy.resourceURL(for: URL(string: "peapp://game/assets/js/app.js?v=123")!, root: root)?.path.hasSuffix("assets/js/app.js") == true, "cache query does not change local file path")

let preferencesDirectory = directory.appendingPathComponent("Preferences", isDirectory: true)
let preferences = NativeGamePreferences(directory: preferencesDirectory)
check(preferences.language == nil, "fresh preferences use device fallback")
try preferences.recordLoadedPage(URL(string: "peapp://game/de/?experience=empire#plans")!)
check(NativeGamePreferences(directory: preferencesDirectory).language == "de", "selected language survives a new application session")
let ignored = try preferences.recordLoadedPage(URL(string: "peapp://game/assets/js/app.js")!)
check(!ignored && preferences.language == "de", "asset navigation cannot alter selected language")
let externalIgnored = try preferences.recordLoadedPage(URL(string: "https://papersempire.com/fr/")!)
check(!externalIgnored && preferences.language == "de", "external navigation cannot alter preference")
try Data("{\"language\":\"invalid\"}".utf8).write(to: preferencesDirectory.appendingPathComponent("interface.json"))
check(NativeGamePreferences(directory: preferencesDirectory).language == nil, "invalid preference falls back without blocking game")
let transient = NativeGamePreferences(directory: nil)
try transient.recordLoadedPage(NativeGamePolicy.startURL(language: "lb"))
check(transient.language == "lb", "isolated QA supports transient language")
check(NativeGamePreferences(directory: nil).language == nil, "isolated QA does not persist interface preferences")

check(NativeGamePolicy.acceptsSave(Data(repeating: 0x61, count: NativeGamePolicy.saveByteLimit)), "save transport accepts exact byte boundary")
check(!NativeGamePolicy.acceptsSave(Data(repeating: 0x61, count: NativeGamePolicy.saveByteLimit + 1)), "save transport rejects overlarge payload")
check(!NativeGamePolicy.acceptsSave(Data([0xff, 0xfe, 0xff])), "invalid UTF-8 rejected before JavaScript")
check(NativeGamePolicy.acceptsSave(Data("{\"note\":\"été\"}".utf8)), "UTF-8 save text survives transport")
print("Native policy: \(count) assertions passed (four locales, origin/main-frame isolation, traversal/symlink containment, language persistence and save byte boundaries).")
