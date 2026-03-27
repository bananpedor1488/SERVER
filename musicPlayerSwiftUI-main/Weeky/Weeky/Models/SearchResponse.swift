import Foundation

struct SearchResponse: Codable {
    let success: Bool
    let query: String
    let count: Int
    let results: [Track]
}
