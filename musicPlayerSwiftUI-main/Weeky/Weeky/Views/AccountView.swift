import SwiftUI

struct AccountView: View {
    @EnvironmentObject private var auth: AuthStore
    @EnvironmentObject private var player: PlayerStore
    @State private var selectedTab: ProfileTab = .likes

    enum ProfileTab: String, CaseIterable {
        case likes = "Likes"
        case playlists = "Playlists"
    }

    var body: some View {
        NavigationStack {
            Group {
                if auth.isAuthenticated {
                    profileContent
                } else {
                    notLoggedInView
                }
            }
            .navigationTitle("Profile")
            .toolbar {
                if auth.isAuthenticated {
                    ToolbarItem(placement: .topBarTrailing) {
                        Button {
                            auth.logout()
                        } label: {
                            Image(systemName: "rectangle.portrait.and.arrow.right")
                        }
                    }
                }
            }
        }
    }

    private var profileContent: some View {
        ScrollView {
            VStack(spacing: 0) {
                profileHeader
                    .padding(.horizontal, 16)
                    .padding(.top, 16)

                statsSection
                    .padding(.top, 20)

                tabsSection
                    .padding(.top, 24)

                contentSection
                    .padding(.top, 16)
            }
        }
        .task {
            await auth.loadLikedTracks()
            await auth.loadUserPlaylists()
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
                    case .failure(_), .empty:
                        avatarPlaceholder
                    @unknown default:
                        avatarPlaceholder
                    }
                }
                .frame(width: 100, height: 100)
                .clipShape(Circle())
            } else {
                avatarPlaceholder
            }

            VStack(spacing: 4) {
                Text(auth.me?.displayName ?? auth.me?.username ?? "User")
                    .font(.title2)
                    .fontWeight(.bold)

                Text("@\(auth.me?.username ?? "")")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }

            if let bio = auth.me?.bio, !bio.isEmpty {
                Text(bio)
                    .font(.body)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                    .padding(.top, 4)
            }
        }
    }

    private var avatarPlaceholder: some View {
        Circle()
            .fill(Color.accentColor.opacity(0.2))
            .frame(width: 100, height: 100)
            .overlay {
                Text(auth.me?.username?.prefix(1).uppercased() ?? "?")
                    .font(.largeTitle)
                    .fontWeight(.bold)
                    .foregroundStyle(Color.accentColor)
            }
    }

    private var statsSection: some View {
        HStack(spacing: 0) {
            statItem(value: auth.likedTracks.count, label: "Likes")
            statDivider
            statItem(value: auth.userPlaylists.count, label: "Playlists")
            statDivider
            statItem(value: auth.me?.followersCount ?? 0, label: "Followers")
            statDivider
            statItem(value: auth.me?.followingCount ?? 0, label: "Following")
        }
        .padding(.vertical, 16)
        .background(Color(.systemGray5))
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .padding(.horizontal, 16)
    }

    private func statItem(value: Int, label: String) -> some View {
        VStack(spacing: 4) {
            Text("\(value)")
                .font(.headline)
                .fontWeight(.bold)
            Text(label)
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
    }

    private var statDivider: some View {
        Rectangle()
            .fill(Color.secondary.opacity(0.3))
            .frame(width: 1, height: 30)
    }

    private var tabsSection: some View {
        HStack(spacing: 0) {
            ForEach(ProfileTab.allCases, id: \.self) { tab in
                Button {
                    withAnimation(.easeInOut(duration: 0.2)) {
                        selectedTab = tab
                    }
                } label: {
                    VStack(spacing: 8) {
                        Text(tab.rawValue)
                            .font(.subheadline)
                            .fontWeight(selectedTab == tab ? .semibold : .regular)
                            .foregroundStyle(selectedTab == tab ? Color.accentColor : .secondary)

                        Rectangle()
                            .fill(selectedTab == tab ? Color.accentColor : Color.clear)
                            .frame(height: 2)
                    }
                }
                .frame(maxWidth: .infinity)
            }
        }
        .padding(.horizontal, 16)
    }

    @ViewBuilder
    private var contentSection: some View {
        switch selectedTab {
        case .likes:
            likesContent
        case .playlists:
            playlistsContent
        }
    }

    private var likesContent: some View {
        LazyVStack(spacing: 0) {
            if auth.likedTracks.isEmpty {
                emptyStateView(
                    icon: "heart.slash",
                    title: "No liked songs yet",
                    subtitle: "Tap the heart icon on tracks you love"
                )
            } else {
                ForEach(Array(auth.likedTracks.enumerated()), id: \.element.id) { index, track in
                    TrackRow(
                        track: track,
                        isLiked: player.isLiked(track),
                        onTap: {
                            player.play(track: track, from: auth.likedTracks)
                        },
                        onLike: {
                            player.toggleLike(track)
                        }
                    )

                    if index < auth.likedTracks.count - 1 {
                        Divider()
                            .padding(.leading, 60)
                    }
                }
            }
        }
        .padding(.horizontal, 16)
    }

    private var playlistsContent: some View {
        LazyVStack(spacing: 12) {
            if auth.userPlaylists.isEmpty {
                emptyStateView(
                    icon: "music.note.list",
                    title: "No playlists yet",
                    subtitle: "Create playlists to organize your music"
                )
            } else {
                ForEach(auth.userPlaylists) { playlist in
                    PlaylistRow(playlist: playlist) {
                        if let firstTrack = playlist.tracks?.first {
                            player.play(track: firstTrack, from: playlist.tracks)
                        }
                    }
                }
            }
        }
        .padding(.horizontal, 16)
    }

    private func emptyStateView(icon: String, title: String, subtitle: String) -> some View {
        VStack(spacing: 12) {
            Image(systemName: icon)
                .font(.system(size: 48))
                .foregroundStyle(.secondary)

            Text(title)
                .font(.headline)

            Text(subtitle)
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
        }
        .padding(.vertical, 60)
    }

    private var notLoggedInView: some View {
        VStack(spacing: 16) {
            Image(systemName: "person.crop.circle.badge.checkmark")
                .font(.system(size: 64))
                .foregroundStyle(.secondary)

            Text("Sign in to sync your library")
                .font(.headline)

            Text("Access your liked tracks and preferences across devices.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 32)

            Button {
                auth.authSheetPresented = true
            } label: {
                Text("Sign In")
                    .fontWeight(.semibold)
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .padding(.horizontal, 32)
            .padding(.top, 8)
        }
        .padding(.vertical, 40)
    }
}

struct PlaylistRow: View {
    let playlist: PlaylistData
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: 12) {
                ZStack {
                    RoundedRectangle(cornerRadius: 8)
                        .fill(Color.accentColor.opacity(0.2))
                        .frame(width: 56, height: 56)

                    if let url = playlist.coverURL {
                        AsyncImage(url: url) { phase in
                            switch phase {
                            case .success(let image):
                                image
                                    .resizable()
                                    .aspectRatio(contentMode: .fill)
                            case .failure(_), .empty:
                                Image(systemName: "music.note.list")
                                    .font(.title2)
                                    .foregroundStyle(Color.accentColor)
                            @unknown default:
                                Image(systemName: "music.note.list")
                                    .font(.title2)
                                    .foregroundStyle(Color.accentColor)
                            }
                        }
                        .frame(width: 56, height: 56)
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                    } else {
                        Image(systemName: "music.note.list")
                            .font(.title2)
                            .foregroundStyle(Color.accentColor)
                    }
                }

                VStack(alignment: .leading, spacing: 4) {
                    Text(playlist.name)
                        .font(.body)
                        .fontWeight(.medium)
                        .foregroundStyle(.primary)

                    Text("\(playlist.trackCount) tracks")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                Spacer()

                Image(systemName: "play.circle.fill")
                    .font(.title2)
                    .foregroundStyle(Color.accentColor)
            }
            .padding(.vertical, 8)
        }
        .buttonStyle(.plain)
    }
}
