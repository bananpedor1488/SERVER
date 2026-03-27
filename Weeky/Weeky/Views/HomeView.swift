import SwiftUI

struct HomeView: View {
    @EnvironmentObject private var player: PlayerStore
    @State private var trendingTracks: [Track] = []
    @State private var recommendedTracks: [Track] = []
    @State private var discoveryTracks: [Track] = []
    @State private var isLoading = true
    @State private var errorMessage: String?

    @State private var waveMixIds: [String] = []

    private let api = APIClient()

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 24) {
                    greetingHeader

                    waveSection

                    if isLoading {
                        ProgressView()
                            .padding(.top, 40)
                    } else if let error = errorMessage {
                        ContentUnavailableView(
                            "Error",
                            systemImage: "exclamationmark.triangle",
                            description: Text(error)
                        )
                    } else {
                        if !recommendedTracks.isEmpty {
                            trackSection(title: "Recommended for you", tracks: recommendedTracks)
                        }

                        if !discoveryTracks.isEmpty {
                            trackSection(title: "You might also like", tracks: discoveryTracks)
                        }

                        if !trendingTracks.isEmpty {
                            trackSection(title: "Trending Now", tracks: trendingTracks)
                        }
                    }
                }
                .padding(.bottom, 120)
            }
            .navigationTitle("Weeky")
            .refreshable {
                await loadData()
            }
        }
        .task {
            await loadData()
        }
    }

    private var greetingHeader: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(greeting)
                .font(.largeTitle)
                .fontWeight(.bold)

            Text("Listen to your favorite music")
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal)
        .padding(.top, 8)
    }

    private var greeting: String {
        let hour = Calendar.current.component(.hour, from: Date())
        if hour < 12 {
            return "Good morning"
        } else if hour < 18 {
            return "Good afternoon"
        } else {
            return "Good evening"
        }
    }

    private var waveSection: some View {
        Button {
            handleWaveToggle()
        } label: {
            ZStack {
                RoundedRectangle(cornerRadius: 20)
                    .fill(
                        LinearGradient(
                            colors: [
                                Color(hex: "667eea"),
                                Color(hex: "764ba2")
                            ],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )

                VStack(spacing: 16) {
                    Text("Моя волна")
                        .font(.title2)
                        .fontWeight(.bold)
                        .foregroundStyle(.white)

                    if isWaveActive, let track = player.nowPlaying {
                        HStack(spacing: 12) {
                            AsyncImage(url: track.imageURL) { phase in
                                if case .success(let image) = phase {
                                    image.resizable().aspectRatio(contentMode: .fill)
                                } else {
                                    Color.white.opacity(0.3)
                                }
                            }
                            .frame(width: 40, height: 40)
                            .clipShape(RoundedRectangle(cornerRadius: 6))

                            VStack(alignment: .leading, spacing: 2) {
                                Text(track.title)
                                    .font(.subheadline)
                                    .fontWeight(.medium)
                                    .foregroundStyle(.white)
                                    .lineLimit(1)
                                Text(track.artist)
                                    .font(.caption)
                                    .foregroundStyle(.white.opacity(0.8))
                                    .lineLimit(1)
                            }
                        }
                    } else {
                        Text("Tap to start your personal mix")
                            .font(.subheadline)
                            .foregroundStyle(.white.opacity(0.8))
                    }
                }

                if isWaveActive {
                    WaveProgressBar(progress: player.progress)
                        .frame(height: 3)
                        .offset(y: 50)
                }
            }
            .frame(height: 140)
            .padding(.horizontal)
        }
        .buttonStyle(.plain)
    }

    private var isWaveActive: Bool {
        guard let track = player.nowPlaying else { return false }
        return waveMixIds.contains(track.id)
    }

    private func handleWaveToggle() {
        if isWaveActive {
            player.togglePlayPause()
        } else {
            startWave()
        }
    }

    private func startWave() {
        let allTracks = recommendedTracks + discoveryTracks + trendingTracks
        guard !allTracks.isEmpty else { return }

        var mix = allTracks.shuffled()
        if mix.count > 30 {
            mix = Array(mix.prefix(30))
        }

        waveMixIds = mix.map { $0.id }

        if let firstTrack = mix.first {
            player.play(track: firstTrack, from: mix)
        }
    }

    private func trackSection(title: String, tracks: [Track]) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(title)
                .font(.headline)
                .padding(.horizontal)

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 12) {
                    ForEach(tracks) { track in
                        TrackCard(
                            track: track,
                            isLiked: player.isLiked(track),
                            onTap: {
                                player.play(track: track, from: tracks)
                            },
                            onLike: {
                                player.toggleLike(track)
                            }
                        )
                    }
                }
                .padding(.horizontal)
            }
        }
    }

    private func loadData() async {
        isLoading = true
        errorMessage = nil

        do {
            let response: SearchResponse = try await api.requestJSON(
                "/api/search",
                queryParams: ["q": "trending music"],
                decode: SearchResponse.self
            )

            var allTracks = response.results
            if allTracks.count < 20 {
                let moreResponse: SearchResponse = try await api.requestJSON(
                    "/api/search",
                    queryParams: ["q": "popular songs"],
                    decode: SearchResponse.self
                )
                allTracks.append(contentsOf: moreResponse.results)
            }

            trendingTracks = Array(allTracks.prefix(15))
            recommendedTracks = Array(allTracks.dropFirst(3).prefix(10))
            discoveryTracks = Array(allTracks.dropFirst(7).prefix(10))
        } catch {
            errorMessage = error.localizedDescription
        }

        isLoading = false
    }
}

struct WaveProgressBar: View {
    let progress: Double

    var body: some View {
        GeometryReader { geometry in
            ZStack(alignment: .leading) {
                Rectangle()
                    .fill(Color.white.opacity(0.3))

                Rectangle()
                    .fill(Color.white)
                    .frame(width: geometry.size.width * progress)
            }
        }
        .clipShape(RoundedRectangle(cornerRadius: 2))
    }
}

struct TrackCard: View {
    let track: Track
    let isLiked: Bool
    let onTap: () -> Void
    let onLike: () -> Void

    var body: some View {
        Button(action: onTap) {
            VStack(alignment: .leading, spacing: 8) {
                ZStack(alignment: .bottomTrailing) {
                    AsyncImage(url: track.imageURL) { phase in
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
                    .frame(width: 140, height: 140)
                    .clipShape(RoundedRectangle(cornerRadius: 12))

                    Button(action: onLike) {
                        Image(systemName: isLiked ? "heart.fill" : "heart")
                            .font(.title3)
                            .foregroundStyle(.white)
                            .padding(8)
                            .background(.ultraThinMaterial)
                            .clipShape(Circle())
                    }
                    .padding(8)
                }

                VStack(alignment: .leading, spacing: 2) {
                    Text(track.title)
                        .font(.subheadline)
                        .fontWeight(.medium)
                        .foregroundStyle(.primary)
                        .lineLimit(1)

                    Text(track.artist)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
                .frame(width: 140, alignment: .leading)
            }
        }
        .buttonStyle(.plain)
    }

    private var artworkPlaceholder: some View {
        RoundedRectangle(cornerRadius: 12)
            .fill(Color.gray.opacity(0.3))
            .frame(width: 140, height: 140)
            .overlay {
                Image(systemName: "music.note")
                    .font(.largeTitle)
                    .foregroundStyle(.secondary)
            }
    }
}

extension Color {
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let a, r, g, b: UInt64
        switch hex.count {
        case 3:
            (a, r, g, b) = (255, (int >> 8) * 17, (int >> 4 & 0xF) * 17, (int & 0xF) * 17)
        case 6:
            (a, r, g, b) = (255, int >> 16, int >> 8 & 0xFF, int & 0xFF)
        case 8:
            (a, r, g, b) = (int >> 24, int >> 16 & 0xFF, int >> 8 & 0xFF, int & 0xFF)
        default:
            (a, r, g, b) = (255, 0, 0, 0)
        }

        self.init(
            .sRGB,
            red: Double(r) / 255,
            green: Double(g) / 255,
            blue: Double(b) / 255,
            opacity: Double(a) / 255
        )
    }
}
