import SwiftUI

struct MiniPlayerView: View {
    @EnvironmentObject private var player: PlayerStore
    @Binding var showFullPlayer: Bool

    var body: some View {
        if let track = player.nowPlaying {
            VStack(spacing: 0) {
                progressBar

                HStack(spacing: 12) {
                    AsyncImage(url: track.artworkURL ?? track.imageURL) { phase in
                        switch phase {
                        case .success(let image):
                            image
                                .resizable()
                                .aspectRatio(contentMode: .fill)
                        case .failure(_), .empty:
                            artworkPlaceholder
                        @unknown default:
                            artworkPlaceholder
                        }
                    }
                    .frame(width: 48, height: 48)
                    .clipShape(RoundedRectangle(cornerRadius: 6))

                    VStack(alignment: .leading, spacing: 2) {
                        Text(track.title)
                            .font(.subheadline)
                            .fontWeight(.medium)
                            .lineLimit(1)

                        Text(track.artist)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                            .lineLimit(1)
                    }

                    Spacer()

                    Button {
                        player.togglePlayPause()
                    } label: {
                        Image(systemName: player.isPlaying ? "pause.fill" : "play.fill")
                            .font(.title2)
                            .foregroundStyle(.primary)
                    }
                    .buttonStyle(.plain)

                    Button {
                        player.next()
                    } label: {
                        Image(systemName: "forward.fill")
                            .font(.title3)
                            .foregroundStyle(.primary)
                    }
                    .buttonStyle(.plain)
                    .disabled(!player.hasNext)
                    .opacity(player.hasNext ? 1 : 0.5)
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 10)
            }
            .background(.ultraThinMaterial)
            .contentShape(Rectangle())
            .onTapGesture {
                showFullPlayer = true
            }
        }
    }

    private var progressBar: some View {
        GeometryReader { geometry in
            Rectangle()
                .fill(Color.gray.opacity(0.3))
                .frame(height: 2)
                .overlay(alignment: .leading) {
                    Rectangle()
                        .fill(Color.accentColor)
                        .frame(width: geometry.size.width * player.progress, height: 2)
                }
        }
        .frame(height: 2)
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
