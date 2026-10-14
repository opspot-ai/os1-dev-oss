import Foundation

enum Agent: String, CaseIterable, Identifiable, Codable {
    case relay
    case orbit
    case scribe

    var id: String { rawValue }

    var label: String {
        switch self {
        case .relay: return "Relay"
        case .orbit: return "Orbit"
        case .scribe: return "Scribe"
        }
    }

    var subtitle: String {
        switch self {
        case .relay: return "realtime operator"
        case .orbit: return "chief of staff"
        case .scribe: return "voice notes"
        }
    }
}

struct Message: Identifiable {
    enum Role {
        case user
        case agent(Agent)
    }

    let id = UUID()
    let role: Role
    let text: String
    let date: Date
}

struct AgentReply: Decodable {
    let ok: Bool
    let agent: String
    let source: String?
    let reply: String
}
