import SwiftUI

struct TrackRow: View {
    let track: Track
    let onTap: () -> Void
    let onLike: (() -> Void)?
    let isLiked: Bool

    init(track: Track, isLiked: Bool = false, onTap: @escaping () -> Void, onLike: (() -> Void)? = nil) {
        self.track = track
        self.isLiked = isLiked
        self.onTap = onTap
        self.onLike = onLike
    }

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: 12) {
                AsyncImage(url: track.imageURL) { phase in
                    switch phase {
                    case .success(let image):
                        image
                            .resizable()
                            .aspectRatio(contentMode: .fill)
                    case .failure(_):
                        artworkPlaceholder
                    case .empty:
                        artworkPlaceholder
                    @unknown default:
                        artworkPlaceholder
                    }
                }
                .frame(width: 50, height: 50)
                .clipShape(RoundedRectangle(cornerRadius: 6))

                VStack(alignment: .leading, spacing: 2) {
                    Text(track.title)
                        .font(.body)
                        .fontWeight(.medium)
                        .foregroundStyle(.primary)
                        .lineLimit(1)

                    Text(track.artist)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }

                Spacer()

                if !track.formattedLikesCount.isEmpty {
                    HStack(spacing: 2) {
                        Image(systemName: "heart.fill")
                            .font(.caption2)
                        Text(track.formattedLikesCount)
                            .font(.caption)
                    }
                    .foregroundStyle(.secondary)
                }

                Text(track.durationText)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .monospacedDigit()

                if let onLike = onLike {
                    Button(action: onLike) {
                        Image(systemName: isLiked ? "heart.fill" : "heart")
                            .foregroundStyle(isLiked ? .red : .secondary)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.vertical, 4)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    private var artworkPlaceholder: some View {
        RoundedRectangle(cornerRadius: 6)
            .fill(Color.gray.opacity(0.3))
            .overlay {
                Image(systemName: "music.note")
                    .foregroundStyle(.secondary)
            }
    }
}
