import SwiftUI

struct TabBarView: View {
    init() {
        UITabBar.appearance().backgroundColor = UIColor.black
        UITabBar.appearance().unselectedItemTintColor = UIColor.gray
    }

    @EnvironmentObject var mediaPlayerState: MediaPlayerState
    @EnvironmentObject var auth: AuthStore

    var body: some View {
        ZStack {
            TabView {
                HomeView()
                    .environmentObject(mediaPlayerState)
                    .tabItem {
                        Label("Home", systemImage: "house")
                    }
                SearchTabView()
                    .environmentObject(mediaPlayerState)
                    .tabItem {
                        Label("Search", systemImage: "magnifyingglass")
                    }
                LibraryView()
                    .environmentObject(mediaPlayerState)
                    .environmentObject(auth)
                    .tabItem {
                        Label("Library", systemImage: "books.vertical")
                    }
                ProfileView()
                    .environmentObject(auth)
                    .environmentObject(mediaPlayerState)
                    .tabItem {
                        Label("Profile", systemImage: "person.circle")
                    }
            }
            .accentColor(.purple)
            
            if mediaPlayerState.isMediaPlayerShown {
                VStack {
                    SongView()
                        .frame(height: mediaPlayerState.isMediaPlayerExpanded ? nil : 60)
                        .cornerRadius(mediaPlayerState.isMediaPlayerExpanded ? 40 : 15)
                        .padding(.horizontal, mediaPlayerState.isMediaPlayerExpanded ? 0 : 5)
                        .padding(.bottom, mediaPlayerState.isMediaPlayerExpanded ? -20 : 40)
                        .padding(.top, mediaPlayerState.isMediaPlayerExpanded ? 60 : 40)
                        .onTapGesture {
                            withAnimation(.spring()) {
                                mediaPlayerState.isMediaPlayerExpanded.toggle()
                            }
                        }
                        .environmentObject(mediaPlayerState)
                }
                .frame(maxHeight: .infinity, alignment: mediaPlayerState.isMediaPlayerExpanded ? .top : .bottom)
                .padding(.bottom)
                .ignoresSafeArea(edges: mediaPlayerState.isMediaPlayerExpanded ? .all : .top)
            }
        }
        .sheet(isPresented: $auth.authSheetPresented) {
            AuthSheetView()
        }
    }
}

struct SearchTabView: View {
    @EnvironmentObject var mediaPlayerState: MediaPlayerState
    @State private var searchText = ""
    @State private var searchResults: [Song] = []
    @State private var isSearching = false
    @State private var hasSearched = false
    
    private let api = APIClient()

    var body: some View {
        NavigationStack {
            Group {
                if searchText.isEmpty && !hasSearched {
                    ContentUnavailableView(
                        "Search",
                        systemImage: "magnifyingglass",
                        description: Text("Search for tracks")
                    )
                } else if isSearching {
                    ProgressView("Searching...")
                } else if searchResults.isEmpty && hasSearched {
                    ContentUnavailableView(
                        "No Results",
                        systemImage: "magnifyingglass",
                        description: Text("No tracks found")
                    )
                } else {
                    searchResultsList
                }
            }
            .navigationTitle("Search")
            .searchable(text: $searchText, prompt: "Search tracks...")
            .onChange(of: searchText) { _, newValue in
                performSearch(query: newValue)
            }
        }
    }

    private var searchResultsList: some View {
        List(searchResults, id: \.id) { song in
            SongRowView(song: song, isLiked: .constant(song.isLiked))
                .onTapGesture {
                    mediaPlayerState.currentSong = song
                    mediaPlayerState.isMediaPlayerShown = true
                    mediaPlayerState.isMediaPlayerExpanded = true
                }
        }
        .listStyle(PlainListStyle())
    }

    private func performSearch(query: String) {
        let trimmed = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            searchResults = []
            hasSearched = false
            return
        }

        isSearching = true
        hasSearched = true

        Task {
            do {
                try await Task.sleep(nanoseconds: 300_000_000)
                if searchText == trimmed {
                    let response: SearchResponse = try await api.requestJSON(
                        "/api/search",
                        queryParams: ["q": trimmed],
                        decode: SearchResponse.self
                    )
                    searchResults = response.results.map { track in
                        Song(
                            id: track.id,
                            videoURL: "",
                            audioURL: track.streamUrl ?? "",
                            imageURL: track.thumbnail ?? "",
                            imageLargeURL: track.artwork ?? track.thumbnail ?? "",
                            isVideoPending: false,
                            majorModelVersion: "",
                            modelName: "",
                            isLiked: false,
                            userID: track.artistId,
                            displayName: track.artist,
                            handle: "",
                            isHandleUpdated: false,
                            avatarImageURL: "",
                            isTrashed: false,
                            createdAt: "",
                            status: "",
                            title: track.title,
                            playCount: track.playbackCount ?? 0,
                            upvoteCount: track.likesCount ?? 0,
                            isPublic: true
                        )
                    }
                }
            } catch {
                print("Search error: \(error)")
            }
            isSearching = false
        }
    }
}

struct LibraryView: View {
    @EnvironmentObject var mediaPlayerState: MediaPlayerState
    @EnvironmentObject var auth: AuthStore

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 16) {
                    if auth.isAuthenticated {
                        likedSection
                        playlistsSection
                    } else {
                        notLoggedInSection
                    }
                }
                .padding()
            }
            .navigationTitle("Library")
        }
    }

    private var likedSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Liked Songs")
                .font(.headline)

            if auth.likedTracks.isEmpty {
                Text("No liked songs yet")
                    .foregroundColor(.gray)
                    .padding(.vertical, 20)
            } else {
                ForEach(auth.likedTracks.prefix(5), id: \.id) { track in
                    let song = trackToSong(track)
                    SongRowView(song: song, isLiked: .constant(true))
                        .onTapGesture {
                            mediaPlayerState.currentSong = song
                            mediaPlayerState.isMediaPlayerShown = true
                            mediaPlayerState.isMediaPlayerExpanded = true
                        }
                }
            }
        }
        .task {
            await auth.loadLikedTracks()
        }
    }

    private var playlistsSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Your Playlists")
                .font(.headline)

            if auth.userPlaylists.isEmpty {
                Text("No playlists yet")
                    .foregroundColor(.gray)
                    .padding(.vertical, 20)
            } else {
                ForEach(auth.userPlaylists) { playlist in
                    PlaylistRowView(playlist: playlist)
                }
            }
        }
        .task {
            await auth.loadUserPlaylists()
        }
    }

    private var notLoggedInSection: some View {
        VStack(spacing: 16) {
            Image(systemName: "person.crop.circle.badge.checkmark")
                .font(.system(size: 64))
                .foregroundColor(.gray)

            Text("Sign in to sync your library")
                .font(.headline)

            Button {
                auth.authSheetPresented = true
            } label: {
                Text("Sign In")
                    .fontWeight(.semibold)
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
        }
        .padding(.vertical, 60)
    }

    private func trackToSong(_ track: Track) -> Song {
        Song(
            id: track.id,
            videoURL: "",
            audioURL: track.streamUrl ?? "",
            imageURL: track.thumbnail ?? "",
            imageLargeURL: track.artwork ?? track.thumbnail ?? "",
            isVideoPending: false,
            majorModelVersion: "",
            modelName: "",
            isLiked: true,
            userID: track.artistId,
            displayName: track.artist,
            handle: "",
            isHandleUpdated: false,
            avatarImageURL: "",
            isTrashed: false,
            createdAt: "",
            status: "",
            title: track.title,
            playCount: track.playbackCount ?? 0,
            upvoteCount: track.likesCount ?? 0,
            isPublic: true
        )
    }
}

struct PlaylistRowView: View {
    let playlist: PlaylistData

    var body: some View {
        HStack {
            ZStack {
                RoundedRectangle(cornerRadius: 8)
                    .fill(Color.purple.opacity(0.2))
                    .frame(width: 50, height: 50)

                if let url = playlist.coverURL {
                    AsyncImage(url: url) { phase in
                        switch phase {
                        case .success(let image):
                            image
                                .resizable()
                                .scaledToFill()
                                .frame(width: 50, height: 50)
                                .clipShape(RoundedRectangle(cornerRadius: 8))
                        default:
                            EmptyView()
                        }
                    }
                } else {
                    Image(systemName: "music.note.list")
                        .foregroundColor(.purple)
                }
            }

            VStack(alignment: .leading) {
                Text(playlist.name)
                    .font(.body)
                    .fontWeight(.medium)
                Text("\(playlist.trackCount) tracks")
                    .font(.caption)
                    .foregroundColor(.gray)
            }

            Spacer()

            Image(systemName: "play.circle.fill")
                .font(.title2)
                .foregroundColor(.purple)
        }
    }
}

struct ProfileView: View {
    @EnvironmentObject var auth: AuthStore
    @EnvironmentObject var mediaPlayerState: MediaPlayerState

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 20) {
                    if auth.isAuthenticated {
                        profileHeader
                        statsSection
                        logoutButton
                    } else {
                        notLoggedInView
                    }
                }
                .padding()
            }
            .navigationTitle("Profile")
        }
    }

    private var profileHeader: some View {
        VStack(spacing: 12) {
            if let avatarURL = auth.me?.avatar, let url = URL(string: avatarURL) {
                AsyncImage(url: url) { phase in
                    switch phase {
                    case .success(let image):
                        image
                            .resizable()
                            .aspectRatio(contentMode: .fill)
                    default:
                        EmptyView()
                    }
                }
                .frame(width: 100, height: 100)
                .clipShape(Circle())
            } else {
                Circle()
                    .fill(Color.purple.opacity(0.2))
                    .frame(width: 100, height: 100)
                    .overlay {
                        Text(auth.me?.username?.prefix(1).uppercased() ?? "?")
                            .font(.largeTitle)
                            .fontWeight(.bold)
                            .foregroundStyle(.purple)
                    }
            }

            VStack(spacing: 4) {
                Text(auth.me?.displayName ?? auth.me?.username ?? "User")
                    .font(.title2)
                    .fontWeight(.bold)

                Text("@\(auth.me?.username ?? "")")
                    .font(.subheadline)
                    .foregroundColor(.gray)
            }
        }
    }

    private var statsSection: some View {
        HStack(spacing: 0) {
            statItem(value: auth.likedTracks.count, label: "Likes")
            statDivider
            statItem(value: auth.userPlaylists.count, label: "Playlists")
            statDivider
            statItem(value: auth.me?.followersCount ?? 0, label: "Followers")
        }
        .padding(.vertical, 16)
        .background(Color(.systemGray5))
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }

    private func statItem(value: Int, label: String) -> some View {
        VStack(spacing: 4) {
            Text("\(value)")
                .font(.headline)
                .fontWeight(.bold)
            Text(label)
                .font(.caption)
                .foregroundColor(.gray)
        }
        .frame(maxWidth: .infinity)
    }

    private var statDivider: some View {
        Rectangle()
            .fill(Color.gray.opacity(0.3))
            .frame(width: 1, height: 30)
    }

    private var logoutButton: some View {
        Button {
            auth.logout()
        } label: {
            Text("Logout")
                .fontWeight(.semibold)
                .frame(maxWidth: .infinity)
        }
        .buttonStyle(.bordered)
        .tint(.red)
    }

    private var notLoggedInView: some View {
        VStack(spacing: 16) {
            Image(systemName: "person.crop.circle.badge.checkmark")
                .font(.system(size: 64))
                .foregroundColor(.gray)

            Text("Sign in to sync your library")
                .font(.headline)

            Text("Access your liked tracks and playlists.")
                .font(.subheadline)
                .foregroundColor(.gray)
                .multilineTextAlignment(.center)

            Button {
                auth.authSheetPresented = true
            } label: {
                Text("Sign In")
                    .fontWeight(.semibold)
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .padding(.top, 8)
        }
        .padding(.vertical, 40)
    }
}

#Preview(body: {
    TabBarView()
        .environmentObject(MediaPlayerState())
        .environmentObject(AuthStore())
})
