import Foundation

public enum RepeatMode: String, CaseIterable {
    case none
    case all
    case one
    
    var icon: String {
        switch self {
        case .none: return "repeat"
        case .all: return "repeat"
        case .one: return "repeat.1"
        }
    }
    
    func next() -> RepeatMode {
        switch self {
        case .none: return .all
        case .all: return .one
        case .one: return .none
        }
    }
}
