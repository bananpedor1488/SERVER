import SwiftUI

struct SongRowView: View {
    var song: Song
    @Binding var isLiked: Bool

    var body: some View {
        HStack {
            ZStack {
                AsyncImage(url: URL(string: self.song.imageURL)) { image in
                    image
                        .resizable()
                        .scaledToFill()
                        .frame(width: 60, height: 60)
                        .cornerRadius(5)
                } placeholder: {
                    Color.gray.opacity(0.3)
                        .frame(width: 60, height: 60)
                        .cornerRadius(5)
                }

                Color.black.opacity(0.1)
                    .frame(width: 60, height: 60)
                    .cornerRadius(5)

                Image(systemName: "play.circle.fill")
                    .foregroundColor(.white)
                    .font(.system(size: 20))
                    .opacity(0.7)
            }

            VStack(alignment: .leading) {
                Text(self.song.title)
                    .font(.headline)
                    .lineLimit(1)

                Text(self.song.displayName)
                    .font(.subheadline)
                    .foregroundColor(.gray)

                Text("Play count: \(self.song.playCount)")
                    .font(.caption)
                    .foregroundColor(.gray)
            }

            Spacer()

            Image(systemName: self.isLiked ? "heart.fill" : "heart")
                .foregroundColor(self.isLiked ? .pink : .gray.opacity(0.4))
                .onTapGesture {
                    self.isLiked.toggle()
                }
        }
        .padding(.vertical, 8)
    }
}

struct SongListView: View {
    var songType: SongType
    @EnvironmentObject var mediaPlayerState: MediaPlayerState
    @StateObject private var viewModel = SongViewModel()
    @State private var isLiked: Bool = false
    
    var body: some View {
        VStack {
            if viewModel.isLoading {
                ProgressView("Loading...")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if let error = viewModel.errorMessage {
                ContentUnavailableView(
                    "Error",
                    systemImage: "exclamationmark.triangle",
                    description: Text(error)
                )
            } else if viewModel.songs.isEmpty {
                ContentUnavailableView(
                    "No Songs",
                    systemImage: "music.note",
                    description: Text("No songs found for \(songType.rawValue)")
                )
            } else {
                List(viewModel.songs, id: \.id) { song in
                    SongRowView(song: song, isLiked: $isLiked)
                    .onTapGesture {
                        mediaPlayerState.currentSong = song
                        mediaPlayerState.isMediaPlayerShown = true
                        mediaPlayerState.isMediaPlayerExpanded = true
                    }
                }
                .listStyle(PlainListStyle())
            }
        }
        .onAppear { viewModel.fetchSongs(songType: songType) }
        .navigationTitle("\(songType.rawValue) Mix")
        .navigationBarTitleDisplayMode(.large)
    }
}
