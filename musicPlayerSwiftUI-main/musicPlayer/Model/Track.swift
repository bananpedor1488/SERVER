import Foundation

public struct Track: Codable, Identifiable, Equatable, Hashable {
    public let id: String
    let title: String
    let artist: String
    let artistId: String
    let artistUrl: String?
    let thumbnail: String?
    let artwork: String?
    let duration: Int
    let durationText: String
    let genre: String?
    let permalink: String?
    let permalinkUrl: String?
    let streamUrl: String?
    let waveformUrl: String?
    let playbackCount: Int?
    let likesCount: Int?
    let trackAuthorization: String?
    let type: String
    let url: String?

    var imageURL: URL? {
        guard let thumbnail = thumbnail else { return nil }
        return URL(string: thumbnail)
    }

    var artworkURL: URL? {
        guard let artwork = artwork else { return nil }
        return URL(string: artwork)
    }

    var formattedPlaybackCount: String {
        guard let count = playbackCount else { return "" }
        return formatCount(count)
    }

    var formattedLikesCount: String {
        guard let count = likesCount else { return "" }
        return formatCount(count)
    }

    private func formatCount(_ count: Int) -> String {
        if count >= 1_000_000 {
            return String(format: "%.1fM", Double(count) / 1_000_000)
        } else if count >= 1_000 {
            return String(format: "%.1fK", Double(count) / 1_000)
        }
        return "\(count)"
    }

    public static func == (lhs: Track, rhs: Track) -> Bool {
        lhs.id == rhs.id
    }

    public func hash(into hasher: inout Hasher) {
        hasher.combine(id)
    }
}
