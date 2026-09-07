import Foundation

/// Lossless JSON values keep every canonical gameplay field available to native views.
enum NativeJSONValue: Codable, Equatable, Sendable {
    case null, bool(Bool), number(Double), string(String)
    case array([NativeJSONValue]), object([String: NativeJSONValue])

    init(from decoder: Decoder) throws {
        let value = try decoder.singleValueContainer()
        if value.decodeNil() { self = .null }
        else if let item = try? value.decode(Bool.self) { self = .bool(item) }
        else if let item = try? value.decode(Double.self) { self = .number(item) }
        else if let item = try? value.decode(String.self) { self = .string(item) }
        else if let item = try? value.decode([NativeJSONValue].self) { self = .array(item) }
        else { self = .object(try value.decode([String: NativeJSONValue].self)) }
    }
    func encode(to encoder: Encoder) throws {
        var value = encoder.singleValueContainer()
        switch self {
        case .null: try value.encodeNil()
        case .bool(let item): try value.encode(item)
        case .number(let item): try value.encode(item)
        case .string(let item): try value.encode(item)
        case .array(let item): try value.encode(item)
        case .object(let item): try value.encode(item)
        }
    }
    var string: String { if case .string(let value) = self { return value }; return "" }
    var double: Double { if case .number(let value) = self { return value }; return 0 }
    var int: Int { let value = double; return value.isFinite && value >= Double(Int.min) && value < Double(Int.max) ? Int(value) : 0 }
    var bool: Bool { if case .bool(let value) = self { return value }; return false }
    var array: [NativeJSONValue] { if case .array(let value) = self { return value }; return [] }
    var object: [String: NativeJSONValue] { if case .object(let value) = self { return value }; return [:] }
    var record: NativeGameRecord { NativeGameRecord(object) }
    var records: [NativeGameRecord] { array.compactMap { if case .object(let value) = $0 { return NativeGameRecord(value) }; return nil } }
    var isNull: Bool { if case .null = self { return true }; return false }
    subscript(_ key: String) -> NativeJSONValue { object[key] ?? .null }
    var foundationValue: Any {
        switch self {
        case .null: return NSNull()
        case .bool(let value): return value
        case .number(let value): return value
        case .string(let value): return value
        case .array(let value): return value.map(\.foundationValue)
        case .object(let value): return value.mapValues(\.foundationValue)
        }
    }
}

struct NativeGameRecord: Codable, Equatable, Identifiable, Sendable {
    var values: [String: NativeJSONValue]
    init(_ values: [String: NativeJSONValue] = [:]) { self.values = values }
    init(from decoder: Decoder) throws { values = try decoder.singleValueContainer().decode([String: NativeJSONValue].self) }
    func encode(to encoder: Encoder) throws { var container = encoder.singleValueContainer(); try container.encode(values) }
    subscript(_ key: String) -> NativeJSONValue { values[key] ?? .null }
    var id: String { self["id"].string }
    var name: String { self["name"].string.isEmpty ? self["title"].string : self["name"].string }
    var title: String { self["title"].string.isEmpty ? name : self["title"].string }
    var description: String { self["description"].string }
    var isEmpty: Bool { values.isEmpty }
}

struct NativeGameResources: Sendable {
    let record: NativeGameRecord
    var documents: Double { record["documents"].isNull ? record["docBank"].double : record["documents"].double }
    var totalDocuments: Double { record["totalDocuments"].isNull ? record["docTotal"].double : record["totalDocuments"].double }
    var clientConfidence: Double { record["clientConfidence"].isNull ? record["ccTotal"].double : record["clientConfidence"].double }
    var culturePoints: Double { record["culturePoints"].double }
}
struct NativeGameRates: Sendable {
    let record: NativeGameRecord
    var docPerSecond: Double { record["docPerSecond"].double }
    var ccPerSecond: Double { record["ccPerSecond"].double }
}
struct NativeBuilding: Identifiable, Equatable, Sendable {
    let record: NativeGameRecord
    var id: String { record.id }
    var name: String { record.name }
    var description: String { record.description }
    var quantity: Int { record["quantity"].int }
    var unlocked: Bool { record["unlocked"].bool }
    var cost: Double { record["cost"].double }
    var docPerSecond: Double { record["docPerSecond"].double }
    var marginalDocPerSecond: Double { record["marginalDocPerSecond"].double }
    var canBuy: Bool { record["canBuy"].bool }
    var milestone: Int? {
        let next = record["milestone"]
        if next.isNull { return nil }
        return next["quantity"].isNull ? next.int : next["quantity"].int
    }
    var impact: String { record["impact"].string }
}
struct NativeUpgrade: Identifiable, Equatable, Sendable {
    let record: NativeGameRecord
    var id: String { record.id }
    var name: String { record.name }
    var description: String { record.description }
    var cost: Double { record["cost"].double }
    var purchased: Bool { record["purchased"].bool }
    var unlocked: Bool { record["unlocked"].bool }
    var canBuy: Bool { record["canBuy"].bool }
}
struct NativeGameObjective: Sendable {
    let record: NativeGameRecord
    var title: String { record.title }
    var description: String { record.description }
    var progress: Double { record["progress"].double }
    var nextAction: String { record["nextAction"].string }
}
struct NativeGameSnapshot: Codable, Equatable, Sendable {
    let record: NativeGameRecord
    init(from decoder: Decoder) throws { record = try NativeGameRecord(from: decoder) }
    func encode(to encoder: Encoder) throws { try record.encode(to: encoder) }
    subscript(_ key: String) -> NativeJSONValue { record[key] }
    var started: Bool { record["started"].bool }
    var language: String { record["language"].string }
    var resources: NativeGameResources { .init(record: record["resources"].record) }
    var rates: NativeGameRates { .init(record: record["rates"].record) }
    var buildings: [NativeBuilding] { record["buildings"].records.map { .init(record: $0) } }
    var upgrades: [NativeUpgrade] { record["upgrades"].records.map { .init(record: $0) } }
    var objective: NativeGameObjective { .init(record: record["objective"].record) }
    var contracts: NativeGameRecord { record["contracts"].record }
    var progression: NativeGameRecord { record["progression"].record }
    var career: NativeGameRecord { record["career"].record }
    var stats: NativeGameRecord { record["stats"].record }
    var incident: NativeGameRecord? { record["incident"].isNull ? nil : record["incident"].record }
    var offlineReport: NativeGameRecord? { record["offlineReport"].isNull ? nil : record["offlineReport"].record }
    var achievements: [NativeGameRecord] { record["achievements"].records }
    var log: [NativeGameRecord] { record["log"].records }
    var canPrestige: Bool { record["canPrestige"].bool }
}

struct NativeSavePreview: Identifiable {
    let id = UUID()
    let raw: String
    let summary: NativeGameRecord
    var resources: NativeGameResources { .init(record: summary["resources"].record) }
    var unitCount: Int { summary["unitCount"].int }
    var ownedTypes: Int { summary["ownedTypes"].int }
    var stamps: Int { summary["stamps"].int }
    var savedAt: Date? { let time = summary["savedAt"].double; return time > 0 ? Date(timeIntervalSince1970: time / 1000) : nil }
}
