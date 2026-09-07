import Foundation
import JavaScriptCore

enum NativeEngineError: Error, LocalizedError {
    case unavailable, script(String), invalidResult(String), invalidSave(String)
    var errorDescription: String? {
        switch self {
        case .unavailable: return "The bundled game engine could not be loaded."
        case .script(let message), .invalidResult(let message), .invalidSave(let message): return message
        }
    }
}

/// JavaScriptCore executes only bundled, headless rules. Every call runs on the
/// main actor; no DOM, browser, network bridge or file access is exposed to JS.
@MainActor
final class NativeGameEngine {
    private let context: JSContext
    private let api: JSValue
    private var scriptError: String?
    private struct Manifest: Decodable { let scripts: [String] }

    init(assetsURL: URL? = Bundle.main.resourceURL?.appendingPathComponent("GameAssets", isDirectory: true)) throws {
        guard let assetsURL, let context = JSContext() else { throw NativeEngineError.unavailable }
        self.context = context
        let manifest = try JSONDecoder().decode(Manifest.self, from: Data(contentsOf: assetsURL.appendingPathComponent("runtime.json")))
        guard !manifest.scripts.isEmpty else { throw NativeEngineError.unavailable }
        for relative in manifest.scripts {
            let file = assetsURL.appendingPathComponent(relative).standardizedFileURL
            guard !relative.hasPrefix("/"), !relative.split(separator: "/").contains(".."), file.path.hasPrefix(assetsURL.standardizedFileURL.path + "/"), file.pathExtension == "js" else { throw NativeEngineError.unavailable }
            context.exception = nil
            let source = try String(contentsOf: file, encoding: .utf8)
            context.evaluateScript(source, withSourceURL: file)
            if let error = context.exception { throw NativeEngineError.script(error.toString() ?? relative) }
        }
        guard let api = context.objectForKeyedSubscript("PEHeadless"), !api.isUndefined, !api.isNull else { throw NativeEngineError.unavailable }
        self.api = api
        context.exceptionHandler = { [weak self] _, exception in self?.scriptError = exception?.toString() }
    }

    private func call(_ name: String, _ arguments: [Any] = []) throws -> JSValue {
        scriptError = nil
        context.exception = nil
        guard let method = api.objectForKeyedSubscript(name), !method.isUndefined else { throw NativeEngineError.invalidResult("Missing game operation: " + name) }
        let result = api.invokeMethod(name, withArguments: arguments)
        if let error = scriptError ?? context.exception?.toString() { throw NativeEngineError.script(error) }
        guard let result else { throw NativeEngineError.invalidResult(name) }
        return result
    }

    var hasBrowserGlobals: Bool {
        ["window", "document", "navigator", "localStorage", "setTimeout", "requestAnimationFrame"].contains { name in
            guard let value = context.objectForKeyedSubscript(name) else { return false }
            return !value.isUndefined
        }
    }

    private func data(_ value: JSValue) throws -> Data {
        guard !value.isUndefined, let json = context.objectForKeyedSubscript("JSON")?.invokeMethod("stringify", withArguments: [value])?.toString(), let data = json.data(using: .utf8) else { throw NativeEngineError.invalidResult("Invalid game response") }
        return data
    }

    func initialize(saveRaw: String?, language: String) throws {
        var save: Any = NSNull()
        if let saveRaw {
            let preview = try previewImport(saveRaw)
            save = try JSONSerialization.jsonObject(with: Data(preview.raw.utf8))
        }
        let result = try call("init", [save, language])
        if result.objectForKeyedSubscript("ok")?.toBool() == false { throw NativeEngineError.invalidSave(result.objectForKeyedSubscript("reason")?.toString() ?? "invalid") }
    }

    func snapshot() throws -> NativeGameSnapshot {
        let value = try JSONDecoder().decode(NativeGameSnapshot.self, from: data(call("snapshot")))
        guard !value["resources"].isNull, !value["buildings"].isNull else { throw NativeEngineError.invalidResult("Incomplete game snapshot") }
        return value
    }

    func tick(_ deltaSeconds: Double) throws { _ = try call("tick", [max(0, deltaSeconds)]) }

    func command(_ name: String, payload: [String: NativeJSONValue]) throws -> NativeGameRecord {
        try JSONDecoder().decode(NativeGameRecord.self, from: data(call("command", [name, payload.mapValues(\.foundationValue)])))
    }

    func saveRaw() throws -> String {
        let rawData = try data(call("save"))
        guard NativeGamePolicy.acceptsSave(rawData), let raw = String(data: rawData, encoding: .utf8) else { throw NativeEngineError.invalidSave("size") }
        return try previewImport(raw).raw
    }

    func previewImport(_ raw: String) throws -> NativeSavePreview {
        guard NativeGamePolicy.acceptsSave(Data(raw.utf8)) else { throw NativeEngineError.invalidSave("size") }
        let result = try JSONDecoder().decode(NativeGameRecord.self, from: data(call("previewImport", [raw])))
        guard result["ok"].bool else { throw NativeEngineError.invalidSave(result["reason"].string) }
        let canonical = result["raw"].string
        guard !canonical.isEmpty else { throw NativeEngineError.invalidSave("invalid") }
        return NativeSavePreview(raw: canonical, summary: result["preview"].record)
    }

    func portableSave() throws -> Data {
        let save = try JSONSerialization.jsonObject(with: Data(saveRaw().utf8))
        let portable: [String: Any] = ["format": "papers-empire-save", "formatVersion": 1, "exportedAt": Date().timeIntervalSince1970 * 1000, "save": save]
        let result = try JSONSerialization.data(withJSONObject: portable, options: [.prettyPrinted, .sortedKeys])
        guard NativeGamePolicy.acceptsSave(result) else { throw NativeEngineError.invalidSave("size") }
        _ = try previewImport(String(decoding: result, as: UTF8.self))
        return result
    }

    func text(_ key: String, params: [String: NativeJSONValue] = [:]) -> String {
        (try? call("translate", [key, params.mapValues(\.foundationValue)]).toString()) ?? key
    }

    func format(_ number: Double) -> String? {
        guard let method = api.objectForKeyedSubscript("format"), !method.isUndefined else { return nil }
        return try? call("format", [number]).toString()
    }
}
