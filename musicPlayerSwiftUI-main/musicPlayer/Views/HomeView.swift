import SwiftUI

struct SongTypeView: View {
    var title: String

    var body: some View {
        ZStack {
            LinearGradient(
                colors: [.purple, .blue],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )

            Color.black.opacity(0.4)
                .cornerRadius(20)

            Text(title)
                .font(.system(size: 24, weight: .bold))
                .foregroundColor(.white)
                .rotationEffect(.degrees(-10))
        }
        .frame(width: 150, height: 150)
        .cornerRadius(20)
    }
}

struct SongTypesListView: View {
    @EnvironmentObject var mediaPlayerState: MediaPlayerState
    
    var body: some View {
        VStack(spacing: 100) {
            VStack(alignment: .leading) {
                Text("Today's Biggest Hits")
                    .font(.title)
                    .bold()
                    .padding(.leading)
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 20) {
                        ForEach(SongType.allCases, id: \.self) { songType in
                            NavigationLink(destination: SongListView(songType: songType).environmentObject(mediaPlayerState)) {
                                SongTypeView(title: songType.rawValue)
                            }
                        }
                    }
                    .padding(.horizontal)
                }
            }
            
            VStack(alignment: .leading) {
                Text("Trending Genres")
                    .font(.title)
                    .bold()
                    .padding(.leading)
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 20) {
                        ForEach(SongType.allCases.reversed(), id: \.self) { songType in
                            NavigationLink(destination: SongListView(songType: songType).environmentObject(mediaPlayerState)) {
                                SongTypeView(title: songType.rawValue)
                            }
                        }
                    }
                    .padding(.horizontal)
                }
            }
    
        }
    }
}

struct HomeView: View {
    @EnvironmentObject var mediaPlayerState: MediaPlayerState
    @StateObject private var viewModel = SongViewModel()
    @StateObject private var audioManager = AudioPlayerManager.shared
    
    var body: some View {
        NavigationView {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    trendingSection
                    
                    SongTypesListView()
                        .environmentObject(mediaPlayerState)
                    
                    Spacer()
                }
                .padding()
            }
            .background(
                Image("background")
                    .resizable()
                    .scaledToFill()
                    .opacity(0.3)
                    .ignoresSafeArea()
            )
        }
        .accentColor(.purple)
        .onAppear {
            viewModel.fetchTrending()
        }
    }

    private var trendingSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Trending Now")
                .font(.title)
                .bold()

            if viewModel.isLoading {
                HStack {
                    Spacer()
                    ProgressView()
                    Spacer()
                }
                .padding(.vertical, 20)
            } else if let error = viewModel.errorMessage {
                Text(error)
                    .foregroundColor(.red)
                    .font(.caption)
            } else {
                ForEach(viewModel.songs.prefix(5)) { song in
                    TrendingSongRow(song: song)
                        .onTapGesture {
                            playSong(song)
                        }
                }
            }
        }
    }
    
    private func playSong(_ song: Song) {
        mediaPlayerState.currentSong = song
        mediaPlayerState.isMediaPlayerShown = true
        mediaPlayerState.isMediaPlayerExpanded = true
        audioManager.loadAudio(from: song.id)
    }
}

struct TrendingSongRow: View {
    var song: Song

    var body: some View {
        HStack(spacing: 12) {
            AsyncImage(url: URL(string: song.imageURL)) { image in
                image
                    .resizable()
                    .scaledToFill()
                    .frame(width: 50, height: 50)
                    .cornerRadius(8)
            } placeholder: {
                RoundedRectangle(cornerRadius: 8)
                    .fill(Color.gray.opacity(0.3))
                    .frame(width: 50, height: 50)
            }

            VStack(alignment: .leading, spacing: 4) {
                Text(song.title)
                    .font(.body)
                    .fontWeight(.medium)
                    .lineLimit(1)

                Text(song.displayName)
                    .font(.caption)
                    .foregroundColor(.gray)
                    .lineLimit(1)
            }

            Spacer()

            Image(systemName: "play.circle.fill")
                .font(.title2)
                .foregroundColor(.purple)
        }
        .padding(.vertical, 4)
    }
}
