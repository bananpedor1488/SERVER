import Foundation

struct LyricsResponse: Codable {
    let success: Bool
    let lyrics: String?
    let synced: Bool
    let syncedLyrics: String?
    let error: String?
}

public struct LyricLine: Identifiable {
    public let id: UUID
    public let time: Double
    public let text: String
    
    public init(id: UUID = UUID(), time: Double, text: String) {
        self.id = id
        self.time = time
        self.text = text
    }
}

public final class LyricsService {
    private let api = APIClient()

    func fetchLyrics(artist: String, title: String) async throws -> (lyrics: String?, syncedLines: [LyricLine], isSynced: Bool)? {
        let response: LyricsResponse = try await api.requestJSON(
            "/api/lyrics/\(artist.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? artist)/\(title.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? title)",
            decode: LyricsResponse.self
        )

        guard response.success else {
            return nil
        }

        var syncedLines: [LyricLine] = []
        if response.synced, let lrc = response.syncedLyrics {
            syncedLines = parseLRC(lrc)
        }

        return (response.lyrics, syncedLines, response.synced)
    }

    private func parseLRC(_ content: String) -> [LyricLine] {
        let lines = content.components(separatedBy: "\n")
        var result: [LyricLine] = []

        let timeRegex = #"\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)"#

        for line in lines {
            guard let regex = try? NSRegularExpression(pattern: timeRegex),
                  let match = regex.firstMatch(in: line, range: NSRange(line.startIndex..., in: line)) else {
                continue
            }

            guard let minutesRange = Range(match.range(at: 1), in: line),
                  let secondsRange = Range(match.range(at: 2), in: line),
                  let millisecondsRange = Range(match.range(at: 3), in: line),
                  let textRange = Range(match.range(at: 4), in: line) else {
                continue
            }

            let minutes = Double(line[minutesRange]) ?? 0
            let seconds = Double(line[secondsRange]) ?? 0
            var milliseconds = Double(line[millisecondsRange]) ?? 0

            if line[millisecondsRange].count == 2 {
                milliseconds *= 10
            }

            let time = minutes * 60 + seconds + milliseconds / 1000
            let text = String(line[textRange]).trimmingCharacters(in: .whitespaces)

            if !text.isEmpty {
                result.append(LyricLine(time: time, text: text))
            }
        }

        return result.sorted { $0.time < $1.time }
    }
}
